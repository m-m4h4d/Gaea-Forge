import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
let inTauri = true;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isTauri: () => inTauri,
}));

const { bytesToBase64, saveFile, saveJsonFile, SAVE_COMMAND, ZIP_FILE } = await import('./saveFile');

describe('saveJsonFile in the desktop app', () => {
  beforeEach(() => {
    inTauri = true;
    invoke.mockReset();
  });

  it('asks Rust to save and reports where the file went', async () => {
    invoke.mockResolvedValue('/home/me/gaea.json');
    await expect(saveJsonFile('gaea.json', '{"a":1}')).resolves.toEqual({ status: 'saved', path: '/home/me/gaea.json' });
    expect(invoke).toHaveBeenCalledWith(SAVE_COMMAND, {
      defaultName: 'gaea.json',
      contentsBase64: btoa('{"a":1}'),
      filterName: 'JSON backup',
      extensions: ['json'],
    });
  });

  it('sends binary files as base64', async () => {
    invoke.mockResolvedValue('/home/me/world.zip');
    const bytes = new Uint8Array([0x50, 0x4b, 3, 4, 255, 0]);
    await saveFile('world.zip', bytes, ZIP_FILE);
    expect(invoke.mock.calls[0][1]).toMatchObject({ contentsBase64: 'UEsDBP8A', filterName: 'Zip archive', extensions: ['zip'] });
  });

  it('encodes large and non-ASCII contents', () => {
    const big = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(Uint8Array.from(atob(bytesToBase64(big)), (c) => c.charCodeAt(0))).toEqual(big);
    expect(new TextDecoder().decode(Uint8Array.from(atob(bytesToBase64(new TextEncoder().encode('Éowyn ✓'))), (c) => c.charCodeAt(0)))).toBe('Éowyn ✓');
  });

  it('reports a cancelled dialog', async () => {
    invoke.mockResolvedValue(null);
    await expect(saveJsonFile('gaea.json', '{}')).resolves.toEqual({ status: 'cancelled' });
  });

  it('passes write errors on to the caller', async () => {
    invoke.mockRejectedValue('Could not write /readonly/gaea.json: permission denied');
    await expect(saveJsonFile('gaea.json', '{}')).rejects.toMatch(/permission denied/);
  });
});

describe('saveJsonFile in a browser', () => {
  const click = vi.fn();
  beforeEach(() => {
    inTauri = false;
    invoke.mockReset();
    const anchor = { click, remove: vi.fn(), href: '', download: '' };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('downloads through the browser without calling Rust', async () => {
    await expect(saveJsonFile('gaea.json', '{}')).resolves.toEqual({ status: 'downloaded' });
    expect(click).toHaveBeenCalledOnce();
    expect(invoke).not.toHaveBeenCalled();
  });
});

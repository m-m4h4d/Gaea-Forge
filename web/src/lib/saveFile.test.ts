import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
let inTauri = true;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
  isTauri: () => inTauri,
}));

const { saveJsonFile, SAVE_COMMAND } = await import('./saveFile');

describe('saveJsonFile in the desktop app', () => {
  beforeEach(() => {
    inTauri = true;
    invoke.mockReset();
  });

  it('asks Rust to save and reports where the file went', async () => {
    invoke.mockResolvedValue('/home/me/gaea.json');
    await expect(saveJsonFile('gaea.json', '{"a":1}')).resolves.toEqual({ status: 'saved', path: '/home/me/gaea.json' });
    expect(invoke).toHaveBeenCalledWith(SAVE_COMMAND, { defaultName: 'gaea.json', contents: '{"a":1}' });
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

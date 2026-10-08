import { describe, expect, it } from 'vitest';
import { isColorMode, nextColorMode, resolveColorMode } from './colorMode';

describe('colorMode', () => {
  it('resolves system mode from the OS preference', () => {
    expect(resolveColorMode('system', true)).toBe('dark');
    expect(resolveColorMode('system', false)).toBe('light');
    expect(resolveColorMode('light', true)).toBe('light');
    expect(resolveColorMode('dark', false)).toBe('dark');
  });

  it('cycles dark -> light -> system -> dark', () => {
    expect(nextColorMode('dark')).toBe('light');
    expect(nextColorMode('light')).toBe('system');
    expect(nextColorMode('system')).toBe('dark');
  });

  it('only accepts known modes', () => {
    expect(isColorMode('light')).toBe(true);
    expect(isColorMode('sepia')).toBe(false);
    expect(isColorMode(null)).toBe(false);
  });
});

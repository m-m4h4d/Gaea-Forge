// Light/dark color mode. The resolved mode is set as data-theme on <html>;
// public/theme-init.js applies the saved mode before first paint.
export type ColorMode = 'dark' | 'light' | 'system';
export type ResolvedColorMode = 'dark' | 'light';

export const COLOR_MODE_STORAGE_KEY = 'gaea_color_mode';
// Gaea-Forge was dark-only before light mode existed, so dark stays the default
export const DEFAULT_COLOR_MODE: ColorMode = 'dark';

export function isColorMode(value: unknown): value is ColorMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function resolveColorMode(mode: ColorMode, systemPrefersDark: boolean): ResolvedColorMode {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

// Order the header toggle cycles through
export function nextColorMode(mode: ColorMode): ColorMode {
  return mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark';
}

export function getSavedColorMode(): ColorMode {
  try {
    const saved = localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return isColorMode(saved) ? saved : DEFAULT_COLOR_MODE;
  } catch {
    return DEFAULT_COLOR_MODE;
  }
}

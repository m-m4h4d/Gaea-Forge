'use client';

import { useEffect } from 'react';
import {
  COLOR_MODE_STORAGE_KEY,
  ColorMode,
  DEFAULT_COLOR_MODE,
  getSavedColorMode,
  resolveColorMode,
} from '@/lib/colorMode';
import { notifyStoredValueChange, useStoredValue } from './useStoredValue';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function applyColorMode(mode: ColorMode) {
  document.documentElement.dataset.theme = resolveColorMode(mode, window.matchMedia(DARK_QUERY).matches);
}

// The user's color mode, saved locally. public/theme-init.js applies it before
// first paint, so it is only re-applied here when it changes.
export function useColorMode() {
  const mode = useStoredValue(getSavedColorMode, DEFAULT_COLOR_MODE);

  // Follow OS changes while in system mode
  useEffect(() => {
    if (mode !== 'system') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => applyColorMode('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = (next: ColorMode) => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
    } catch {
      // Not persisted (e.g. storage disabled); still applied for this session
    }
    applyColorMode(next);
    notifyStoredValueChange();
  };

  return { mode, setMode };
}

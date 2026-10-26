'use client';

import { useSyncExternalStore } from 'react';
import { isTauri } from '@tauri-apps/api/core';

const subscribe = () => () => {};

// True inside the desktop app (Tauri). The static export is prerendered as the web
// version, so hydration starts from false and switches afterwards, without a mismatch.
export function useIsDesktopApp(): boolean {
  return useSyncExternalStore(subscribe, isTauri, () => false);
}

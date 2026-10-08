'use client';

import { useSyncExternalStore } from 'react';

// Values kept in localStorage (role, color mode, onboarding) can't be read while
// prerendering, so reading them in useState initializers made the first client
// render differ from the static HTML (a hydration mismatch). useSyncExternalStore
// renders the server value during hydration, then switches to the stored one.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

// Call after writing a stored value so components reading it re-render
export function notifyStoredValueChange() {
  listeners.forEach((listener) => listener());
}

// `read` must return a primitive (or otherwise stable) value
export function useStoredValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribe, read, () => serverValue);
}

'use client';

import { RefObject, useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// While active: move focus into the container, keep Tab inside it, and give focus
// back to whatever had it when the trap deactivates.
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean, initialFocus?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Hidden elements (display:none, e.g. a styled file input) can't take focus
    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    (initialFocus?.current ?? focusables()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      // -1 when focus is on the container itself or a non-tabbable element
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && index <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && (index === -1 || index === items.length - 1)) {
        e.preventDefault();
        items[0].focus();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      // The element that had focus may have gone or been disabled meanwhile (an action
      // button disables itself while it works). Then fall back to the dialog still
      // open underneath, so Tab keeps working inside it.
      const canRestore =
        previouslyFocused &&
        previouslyFocused !== document.body &&
        previouslyFocused.isConnected &&
        !(previouslyFocused as HTMLButtonElement).disabled;
      if (canRestore) {
        previouslyFocused.focus();
      } else {
        const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((el) => el !== container);
        openDialogs[openDialogs.length - 1]?.focus();
      }
    };
  }, [active, containerRef, initialFocus]);
}

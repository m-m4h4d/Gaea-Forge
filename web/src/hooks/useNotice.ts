'use client';

import { useCallback, useState } from 'react';

export type NoticeAction = { label: string; onClick: () => void };
export type Notice = { kind: 'success' | 'error'; text: string; action?: NoticeAction };
export type Notify = (kind: Notice['kind'], text: string, action?: NoticeAction) => void;

// How long a notice stays up: errors and notices offering an action (Undo) stay longer
const DURATION_MS = { success: 2500, error: 6000, action: 8000 };

// A single transient message, optionally with one action button
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback<Notify>((kind, text, action) => {
    const next: Notice = { kind, text, action };
    setNotice(next);
    setTimeout(
      () => setNotice((current) => (current === next ? null : current)),
      action ? DURATION_MS.action : DURATION_MS[kind]
    );
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { notice, showNotice, dismissNotice };
}

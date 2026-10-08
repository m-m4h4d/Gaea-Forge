'use client';

import { useCallback, useState } from 'react';

export type Notice = { kind: 'success' | 'error'; text: string };
export type Notify = (kind: Notice['kind'], text: string) => void;

// A single transient message; errors stay up longer than successes
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);

  const showNotice = useCallback<Notify>((kind, text) => {
    setNotice({ kind, text });
    setTimeout(
      () => setNotice((current) => (current?.text === text ? null : current)),
      kind === 'error' ? 6000 : 2500
    );
  }, []);

  return { notice, showNotice };
}

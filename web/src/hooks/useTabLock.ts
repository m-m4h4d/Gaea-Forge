'use client';

import { useEffect, useRef, useState } from 'react';
import { TabLock, TabRole } from '@/lib/tabLock';

// Whether this tab may edit the world (see lib/tabLock.ts), and a way to take over.
// Without Web Locks support every tab edits, as before.
export function useTabLock(onLoseLock: () => Promise<void> | void) {
  // Optimistic until the lock answers (a few ms), so a lone tab never flashes the notice
  const [role, setRole] = useState<TabRole>('active');
  const [isTakingOver, setIsTakingOver] = useState(false);
  const lockRef = useRef<TabLock | null>(null);
  const onLoseRef = useRef(onLoseLock);
  useEffect(() => {
    onLoseRef.current = onLoseLock;
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.locks) return;
    const lock = new TabLock({ locks: navigator.locks, onRoleChange: setRole, onLoseLock: () => onLoseRef.current() });
    lockRef.current = lock;
    lock.start();
    return () => {
      lock.dispose();
      lockRef.current = null;
    };
  }, []);

  const takeOver = async () => {
    if (!lockRef.current || isTakingOver) return;
    setIsTakingOver(true);
    try {
      await lockRef.current.takeOver();
    } finally {
      setIsTakingOver(false);
    }
  };

  return { role, takeOver, isTakingOver };
}

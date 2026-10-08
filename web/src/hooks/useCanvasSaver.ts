'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CanvasData, GaeaDatabase } from '@/lib/database';
import { upsertCanvases } from '@/lib/backup';

// IndexedDB writes cannot finish while a page unloads, so canvases that are not yet
// confirmed written are also saved synchronously to localStorage on unload and
// replayed on next start (as useArticleSaver does for articles).
const JOURNAL_KEY = 'gaea_unsaved_canvases';

function writeJournal(pending: Map<string, CanvasData>) {
  try {
    if (pending.size === 0) localStorage.removeItem(JOURNAL_KEY);
    else localStorage.setItem(JOURNAL_KEY, JSON.stringify(Array.from(pending.values())));
  } catch {
    // Quota exceeded (e.g. a large map image); the database write is still attempted
  }
}

// Apply journaled canvases that are newer than the database copy, or missing from it
async function replayJournal(db: GaeaDatabase) {
  let entries: CanvasData[];
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return;
    entries = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(entries)) return;

  const newer: CanvasData[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.last_updated !== 'number') continue;
    const doc = await db.canvases.findOne(entry.id).exec();
    if (!doc || doc.last_updated < entry.last_updated) newer.push(entry);
  }
  if (newer.length > 0) await upsertCanvases(db, newer);
  localStorage.removeItem(JOURNAL_KEY);
}

// Canvas writes: queued so they reach the database in the order they were made,
// with unconfirmed versions kept so late database change events can't revert them.
export function useCanvasSaver(db: GaeaDatabase | null, onError: (message: string) => void) {
  // Latest local version of each canvas not yet confirmed written
  const pendingRef = useRef(new Map<string, CanvasData>());
  const writesRef = useRef<Promise<void>>(Promise.resolve());

  const queueWrite = useCallback((write: () => Promise<unknown>) => {
    const next = writesRef.current.then(write);
    // Keep the queue going after a failure; callers handle their own errors
    writesRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }, []);

  const save = async (changed: CanvasData[]) => {
    if (!db || changed.length === 0) return;
    const pending = pendingRef.current;
    changed.forEach((c) => pending.set(c.id, c));
    try {
      await queueWrite(() => upsertCanvases(db, changed));
    } catch (e) {
      console.error('Error saving canvases:', e);
      onError('Could not save canvas changes.');
    } finally {
      // Drop entries unless a newer local version replaced them meanwhile
      changed.forEach((c) => {
        if (pending.get(c.id) === c) pending.delete(c.id);
      });
      if (pending.size === 0) writeJournal(pending);
    }
  };

  const remove = (id: string) => {
    pendingRef.current.delete(id);
    writeJournal(pendingRef.current);
    if (!db) return;
    queueWrite(() => db.canvases.findOne(id).remove()).catch((e) => {
      console.error('Failed to delete canvas:', e);
      onError('Could not delete the canvas.');
    });
  };

  // Wait for every queued write (before snapshots, exports and replacing the world)
  const settle = () => writesRef.current;

  // Forget unconfirmed versions, e.g. before the whole world is replaced
  const clear = () => {
    pendingRef.current.clear();
    writeJournal(pendingRef.current);
  };

  const mergeWithPending = useCallback((fromDb: CanvasData[]) => {
    const pending = pendingRef.current;
    if (pending.size === 0) return fromDb;
    const ids = new Set(fromDb.map((c) => c.id));
    return [
      ...Array.from(pending.values()).filter((c) => !ids.has(c.id)),
      ...fromDb.map((c) => pending.get(c.id) ?? c),
    ];
  }, []);

  // Recover canvas edits from an interrupted session
  useEffect(() => {
    if (!db) return;
    replayJournal(db).catch((e) => console.error('Failed to recover unsaved canvases:', e));
  }, [db]);

  useEffect(() => {
    const saveJournal = () => writeJournal(pendingRef.current);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveJournal();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', saveJournal);
    window.addEventListener('beforeunload', saveJournal);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', saveJournal);
      window.removeEventListener('beforeunload', saveJournal);
    };
  }, []);

  return { save, remove, settle, clear, mergeWithPending };
}

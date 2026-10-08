'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GaeaDatabase, LoreArticle } from '@/lib/database';
import { upsertArticles } from '@/lib/backup';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

const SAVE_DELAY_MS = 600;

// IndexedDB writes cannot finish while a page unloads, so unsaved edits are also
// written synchronously to localStorage on unload and replayed on next start.
const JOURNAL_KEY = 'gaea_unsaved_edits';

function writeJournal(dirty: Map<string, LoreArticle>) {
  try {
    if (dirty.size === 0) {
      localStorage.removeItem(JOURNAL_KEY);
    } else {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(Array.from(dirty.values())));
    }
  } catch {
    // Quota exceeded (e.g. large cover images); the async flush is still attempted
  }
}

// Apply journaled edits to articles that still exist and have not been saved since
async function replayJournal(db: GaeaDatabase) {
  let entries: LoreArticle[];
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return;
    entries = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(entries)) return;

  const newer: LoreArticle[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string') continue;
    const doc = await db.articles.findOne(entry.id).exec();
    if (doc && doc.last_updated < entry.last_updated) newer.push(entry);
  }
  if (newer.length > 0) await upsertArticles(db, newer);
  localStorage.removeItem(JOURNAL_KEY);
}

// Debounces article writes to RxDB. Edits are kept in memory until written, so
// database change events never overwrite text the user typed after the write began.
export function useArticleSaver(db: GaeaDatabase | null) {
  // Latest local version of each article that is not yet confirmed written
  const dirtyRef = useRef(new Map<string, LoreArticle>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbRef = useRef(db);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [error, setError] = useState<string | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const database = dbRef.current;
    const dirty = dirtyRef.current;
    if (!database || dirty.size === 0) return;

    const batch = Array.from(dirty.values());
    setStatus('saving');
    try {
      await upsertArticles(database, batch);
      for (const written of batch) {
        // Keep entries edited again while this write was in flight
        if (dirty.get(written.id) === written) dirty.delete(written.id);
      }
      setError(null);
      if (dirty.size === 0) writeJournal(dirty);
      setStatus(dirty.size > 0 ? 'pending' : 'saved');
    } catch (e) {
      console.error('Error saving articles:', e);
      setError(e instanceof Error ? e.message : 'Could not save changes.');
      setStatus('error');
    }
  }, []);

  const queue = useCallback(
    (article: LoreArticle) => {
      dirtyRef.current.set(article.id, article);
      setStatus('pending');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush]
  );

  // Forget unsaved edits, e.g. for an article that is being deleted or overwritten
  const discard = useCallback((ids: string[]) => {
    for (const id of ids) dirtyRef.current.delete(id);
    writeJournal(dirtyRef.current);
    if (dirtyRef.current.size === 0) setStatus('saved');
  }, []);

  // Prefer local unsaved versions over what the database currently holds
  const mergeWithPending = useCallback((fromDb: LoreArticle[]) => {
    const dirty = dirtyRef.current;
    if (dirty.size === 0) return fromDb;
    return fromDb.map((a) => dirty.get(a.id) ?? a);
  }, []);

  // Recover edits from an interrupted session, then write edits made before the database opened
  useEffect(() => {
    dbRef.current = db;
    if (!db) return;
    replayJournal(db)
      .catch((e) => console.error('Failed to recover unsaved edits:', e))
      .finally(() => {
        if (dirtyRef.current.size > 0) flush();
      });
  }, [db, flush]);

  // Save before the window is hidden or closed, and on Ctrl/Cmd+S
  useEffect(() => {
    const saveNow = () => {
      writeJournal(dirtyRef.current);
      flush();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flush();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', saveNow);
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', saveNow);
      window.removeEventListener('beforeunload', saveNow);
      window.removeEventListener('keydown', handleKeyDown);
      flush();
    };
  }, [flush]);

  return { status, error, queue, flush, discard, mergeWithPending };
}

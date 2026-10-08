'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  CanvasData,
  CanvasType,
  GaeaDatabase,
  getDatabase,
  INITIAL_SEED_ARTICLES,
  INITIAL_SEED_CANVASES,
  LoreArticle,
  WorldSnapshot,
} from '@/lib/database';
import {
  WorldBackup,
  createBackup,
  createSnapshot,
  downloadBackup,
  listSnapshots,
  pruneCanvasesToArticles,
  readWorld,
  replaceWorld,
  upsertArticles,
  upsertCanvases,
} from '@/lib/backup';
import { RoleId } from '@/lib/roles';
import { useArticleSaver } from './useArticleSaver';
import { Notify } from './useNotice';

// Owns the local database and the world's articles and canvases. State updates
// are applied immediately; writes go to RxDB, and failures are reported via notify.
// Operations that replace the world throw on failure so callers can show the reason.
export function useWorld(notify: Notify) {
  const [db, setDb] = useState<GaeaDatabase | null>(null);
  const [articles, setArticles] = useState<LoreArticle[]>(INITIAL_SEED_ARTICLES);
  // Seed shown until RxDB loads
  const [canvases, setCanvases] = useState<CanvasData[]>(INITIAL_SEED_CANVASES);
  const [, startTransition] = useTransition();

  const saver = useArticleSaver(db);
  const { mergeWithPending } = saver;

  useEffect(() => {
    let isMounted = true;
    const subscriptions: { unsubscribe: () => void }[] = [];

    getDatabase()
      .then((database) => {
        if (!isMounted) return;
        setDb(database);

        subscriptions.push(
          database.articles.find().$.subscribe((docs) => {
            if (isMounted && docs) {
              const items = docs.map((doc) => doc.toJSON() as LoreArticle);
              setArticles(mergeWithPending(items));
            }
          })
        );

        subscriptions.push(
          database.canvases.find().$.subscribe((docs) => {
            // Skip the transient empty state while a world is being replaced
            if (isMounted && docs && docs.length > 0) {
              setCanvases(docs.map((doc) => doc.toJSON() as CanvasData));
            }
          })
        );
      })
      .catch((err) => {
        console.error('Failed to open the local database:', err);
        if (isMounted) {
          notify('error', 'Could not open the local database. Changes will not be saved.');
        }
      });

    return () => {
      isMounted = false;
      subscriptions.forEach((s) => s.unsubscribe());
    };
  }, [mergeWithPending, notify]);

  // ---- Articles ----

  // Update an article in state immediately; the database write is debounced
  const updateArticle = (updated: LoreArticle) => {
    const itemToSave: LoreArticle = { ...updated, last_updated: Date.now() };
    startTransition(() => {
      setArticles((prev) => prev.map((art) => (art.id === itemToSave.id ? itemToSave : art)));
    });
    saver.queue(itemToSave);
  };

  const addArticle = async (article: LoreArticle) => {
    setArticles((prev) => [article, ...prev]);
    if (!db) return;
    try {
      await db.articles.insert(article);
    } catch (e) {
      console.error('Failed to insert article:', e);
      notify('error', `Could not save "${article.title}".`);
    }
  };

  // Delete an article and remove its nodes and their connections from every canvas
  const deleteArticle = async (id: string) => {
    const target = articles.find((a) => a.id === id);
    const remaining = articles.filter((a) => a.id !== id);
    setArticles(remaining);
    saver.discard([id]);

    const prunedCanvases = pruneCanvasesToArticles(canvases, new Set(remaining.map((a) => a.id)));

    if (db) {
      try {
        await db.articles.findOne(id).remove();
      } catch (e) {
        console.error('Failed to delete article:', e);
        notify('error', `Could not delete "${target?.title ?? id}".`);
        return;
      }
    }
    await saveCanvases(prunedCanvases);
  };

  // ---- Canvases ----

  const saveCanvases = async (changed: CanvasData[]) => {
    if (changed.length === 0) return;
    const byId = new Map(changed.map((c) => [c.id, c]));
    setCanvases((prev) => [
      ...changed.filter((c) => !prev.some((p) => p.id === c.id)),
      ...prev.map((c) => byId.get(c.id) ?? c),
    ]);
    if (!db) return;
    try {
      await upsertCanvases(db, changed);
    } catch (e) {
      console.error('Error saving canvases:', e);
      notify('error', 'Could not save canvas changes.');
    }
  };

  const updateCanvas = (canvas: CanvasData) => saveCanvases([{ ...canvas, last_updated: Date.now() }]);

  const createCanvas = (data: { title: string; type: CanvasType }): CanvasData => {
    const canvas: CanvasData = {
      id: `canvas-${Date.now()}`,
      title: data.title,
      type: data.type,
      nodes: [],
      connections: [],
      last_updated: Date.now(),
    };
    saveCanvases([canvas]);
    return canvas;
  };

  const deleteCanvas = (id: string) => {
    setCanvases((prev) => prev.filter((c) => c.id !== id));
    if (!db) return;
    db.canvases
      .findOne(id)
      .remove()
      .catch((e) => {
        console.error('Failed to delete canvas:', e);
        notify('error', 'Could not delete the canvas.');
      });
  };

  // ---- Backup, import and restore ----

  const exportBackup = async (roleId: RoleId) => {
    // Write pending edits first so the backup matches what is on screen
    await saver.flush();
    try {
      const world = db ? await readWorld(db) : { articles, canvases };
      downloadBackup(createBackup(world.articles, world.canvases, roleId));
    } catch (e) {
      console.error('Backup export failed:', e);
      notify('error', 'Could not export the backup.');
    }
  };

  const loadSnapshots = async (): Promise<WorldSnapshot[]> => {
    if (!db) return [];
    try {
      return await listSnapshots(db);
    } catch (e) {
      console.error('Failed to list snapshots:', e);
      return [];
    }
  };

  // Snapshot the current world, then replace it entirely
  const replaceWorldSafely = async (
    snapshotReason: string,
    roleId: RoleId,
    nextArticles: LoreArticle[],
    nextCanvases: CanvasData[]
  ) => {
    if (!db) throw new Error('The local database is not available, so nothing was changed.');

    await saver.flush();
    try {
      await createSnapshot(db, snapshotReason, roleId);
    } catch (e) {
      console.error('Snapshot failed:', e);
      throw new Error('Could not save a safety snapshot, so your world was not changed.');
    }

    saver.discard(articles.map((a) => a.id));
    try {
      await replaceWorld(db, nextArticles, nextCanvases);
    } catch (e) {
      console.error('Replace failed:', e);
      throw new Error(
        'Replacing the world failed partway. Restore the latest snapshot from Backup & Restore.'
      );
    }
  };

  // Merge imported articles over existing ones, or replace all articles
  // (keeping canvases, minus nodes for articles that no longer exist)
  const importArticles = async (imported: LoreArticle[], mode: 'merge' | 'replace', roleId: RoleId) => {
    if (mode === 'replace') {
      const pruned = new Map(
        pruneCanvasesToArticles(canvases, new Set(imported.map((a) => a.id))).map((c) => [c.id, c])
      );
      await replaceWorldSafely(
        `Before replacing world with ${imported.length} imported articles`,
        roleId,
        imported,
        canvases.map((c) => pruned.get(c.id) ?? c)
      );
      return;
    }

    if (!db) throw new Error('The local database is not available, so nothing was imported.');
    // Imported versions win over unsaved edits to the same articles
    saver.discard(imported.map((a) => a.id));
    await upsertArticles(db, imported);
  };

  // Replace the world with a backup; returns the canvases actually written
  const restoreBackup = async (backup: WorldBackup, snapshotReason: string, roleId: RoleId) => {
    const nextCanvases = backup.canvases.length > 0 ? backup.canvases : INITIAL_SEED_CANVASES;
    await replaceWorldSafely(snapshotReason, roleId, backup.articles, nextCanvases);
    return nextCanvases;
  };

  return {
    articles,
    canvases,
    saveStatus: saver.status,
    saveError: saver.error,
    flushSaves: saver.flush,
    updateArticle,
    addArticle,
    deleteArticle,
    updateCanvas,
    createCanvas,
    deleteCanvas,
    exportBackup,
    loadSnapshots,
    importArticles,
    restoreBackup,
  };
}

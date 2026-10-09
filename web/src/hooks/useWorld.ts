'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
  backupFileName,
  listSnapshots,
  pruneCanvasesToArticles,
  restoreArticleLinks,
  readWorld,
  replaceWorld,
  upsertArticles,
} from '@/lib/backup';
import { RoleId } from '@/lib/roles';
import { externalizeImages, storeImage as storeImageAsset } from '@/lib/assets';
import { MAX_COVER_DIMENSION, readImageFile } from '@/lib/images';
import { saveJsonFile } from '@/lib/saveFile';
import { useArticleSaver } from './useArticleSaver';
import { useCanvasSaver } from './useCanvasSaver';
import { Notify } from './useNotice';

// Owns the local database and the world's articles and canvases. State updates
// are applied immediately; writes go to RxDB, and failures are reported via notify.
// Operations that replace the world throw on failure so callers can show the reason.
export function useWorld(notify: Notify) {
  const [db, setDb] = useState<GaeaDatabase | null>(null);
  const [articles, setArticles] = useState<LoreArticle[]>(INITIAL_SEED_ARTICLES);
  // Seed shown until RxDB loads
  const [canvases, setCanvases] = useState<CanvasData[]>(INITIAL_SEED_CANVASES);
  // Which collections the database has delivered; until then the seed is on screen
  const [loaded, setLoaded] = useState({ articles: false, canvases: false, failed: false });
  const [, startTransition] = useTransition();

  const saver = useArticleSaver(db);
  const { mergeWithPending } = saver;

  const canvasSaver = useCanvasSaver(
    db,
    (message) => notify('error', message),
    // Canvases recovered from an interrupted session (e.g. created just before a
    // reload) are shown right away, not only when the database reports them
    (recovered) =>
      setCanvases((prev) => {
        const byId = new Map(recovered.map((c) => [c.id, c]));
        return [...prev.map((c) => byId.get(c.id) ?? c), ...recovered.filter((c) => !prev.some((p) => p.id === c.id))];
      })
  );

  // Undo callbacks run after later renders, so they read the latest canvases here
  const canvasesRef = useRef(canvases);
  useEffect(() => {
    canvasesRef.current = canvases;
  });
  const { mergeWithPending: mergeCanvasesWithPending } = canvasSaver;

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
              setLoaded((l) => (l.articles ? l : { ...l, articles: true }));
            }
          })
        );

        subscriptions.push(
          database.canvases.find().$.subscribe((docs) => {
            // Skip the transient empty state while a world is being replaced
            if (isMounted && docs && docs.length > 0) {
              setCanvases(mergeCanvasesWithPending(docs.map((doc) => doc.toJSON() as CanvasData)));
            }
            if (isMounted) setLoaded((l) => (l.canvases ? l : { ...l, canvases: true }));
          })
        );
      })
      .catch((err) => {
        console.error('Failed to open the local database:', err);
        if (isMounted) {
          notify('error', 'Could not open the local database. Changes will not be saved.');
          // Nothing more will arrive; carry on with the seed
          setLoaded({ articles: true, canvases: true, failed: true });
        }
      });

    return () => {
      isMounted = false;
      subscriptions.forEach((s) => s.unsubscribe());
    };
  }, [mergeWithPending, mergeCanvasesWithPending, notify]);

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

  // Delete an article and remove its nodes and their connections from every canvas.
  // Returns an undo function, or null if nothing was deleted.
  const deleteArticle = async (id: string): Promise<(() => void) | null> => {
    const target = articles.find((a) => a.id === id);
    const canvasesBefore = canvases;
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
        return null;
      }
    }
    await saveCanvases(prunedCanvases);
    return target ? () => restoreDeletedArticle(target, canvasesBefore) : null;
  };

  // Undo a deletion: bring the article back, and its canvas nodes and timeline
  // links, merged into the canvases as they are now
  const restoreDeletedArticle = async (article: LoreArticle, canvasesBefore: CanvasData[]) => {
    setArticles((prev) => (prev.some((a) => a.id === article.id) ? prev : [article, ...prev]));
    if (db) {
      try {
        await db.articles.upsert(article);
      } catch (e) {
        console.error('Failed to restore article:', e);
        notify('error', `Could not restore "${article.title}".`);
        return;
      }
    }
    await saveCanvases(restoreArticleLinks(canvasesRef.current, canvasesBefore, article.id));
  };

  // ---- Images ----

  // Store an image data URL as an asset and return the reference to save in
  // place of it. Without a database it stays inline, as older versions did.
  const storeImage = async (dataUrl: string): Promise<string> => (db ? storeImageAsset(db, dataUrl) : dataUrl);

  // Downscale, store and attach cover art, saving the article right away so the
  // reference to the new image is never left only in memory
  const setArticleCover = async (article: LoreArticle, file: File) => {
    try {
      const coverImage = await storeImage(await readImageFile(file, MAX_COVER_DIMENSION));
      updateArticle({ ...article, coverImage });
      await saver.flush();
    } catch (e) {
      console.error('Cover image upload failed:', e);
      notify('error', e instanceof Error ? e.message : 'Could not save the image.');
    }
  };

  // ---- Canvases ----

  // Update canvases in state immediately; writes are queued in order
  const saveCanvases = async (changed: CanvasData[]) => {
    if (changed.length === 0) return;
    const byId = new Map(changed.map((c) => [c.id, c]));
    setCanvases((prev) => [
      ...changed.filter((c) => !prev.some((p) => p.id === c.id)),
      ...prev.map((c) => byId.get(c.id) ?? c),
    ]);
    await canvasSaver.save(changed);
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

  // Returns an undo function that brings the canvas back
  const deleteCanvas = (id: string): (() => void) | null => {
    const canvas = canvases.find((c) => c.id === id);
    setCanvases((prev) => prev.filter((c) => c.id !== id));
    canvasSaver.remove(id);
    return canvas ? () => saveCanvases([{ ...canvas, last_updated: Date.now() }]) : null;
  };

  // ---- Backup, import and restore ----

  const exportBackup = async (roleId: RoleId) => {
    // Write pending edits first so the backup matches what is on screen
    await saver.flush();
    await canvasSaver.settle();
    try {
      const world = db ? await readWorld(db) : { articles, canvases };
      const backup = createBackup(world.articles, world.canvases, roleId);
      const result = await saveJsonFile(backupFileName(backup), JSON.stringify(backup, null, 2));
      if (result.status === 'saved') notify('success', `Backup saved to ${result.path}`);
    } catch (e) {
      console.error('Backup export failed:', e);
      // Desktop write errors arrive as a message from Rust (e.g. permission denied)
      notify('error', typeof e === 'string' ? e : 'Could not export the backup.');
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

    // Write pending edits first so the snapshot holds the latest world
    await saver.flush();
    await canvasSaver.settle();
    try {
      await createSnapshot(db, snapshotReason, roleId);
    } catch (e) {
      console.error('Snapshot failed:', e);
      throw new Error('Could not save a safety snapshot, so your world was not changed.');
    }

    saver.discard(articles.map((a) => a.id));
    // Forget unconfirmed canvas versions so they can't override the replacement
    canvasSaver.clear();
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
    const { articles: withStoredImages } = await externalizeImages(db, imported, []);
    await upsertArticles(db, withStoredImages);
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
    // The real world has loaded from the database, including canvases recovered
    // from an interrupted session (or the database failed to open)
    isLoaded: loaded.failed || (loaded.articles && loaded.canvases && canvasSaver.isRecovered),
    saveStatus: saver.status,
    saveError: saver.error,
    flushSaves: saver.flush,
    updateArticle,
    setArticleCover,
    storeImage,
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

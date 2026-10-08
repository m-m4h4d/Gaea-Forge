// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import {
  ASSET_GRACE_MS,
  externalizeImages,
  inlineImages,
  isAssetRef,
  loadImage,
  moveInlineImagesToAssets,
  storeImage,
  sweepUnusedAssets,
} from './assets';
import { CanvasData, canvasSchema, canvasMigrationStrategies, LoreArticle, loreArticleSchema, openGaeaDatabase, snapshotSchema } from './database';
import { readWorld, replaceWorld } from './backup';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const WEBP = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

let dbCount = 0;
const freshDb = () => openGaeaDatabase(`assets-${dbCount++}`, getRxStorageMemory());

const article = (id: string, coverImage?: string): LoreArticle => ({
  id,
  title: id,
  category: 'Notes',
  content: '',
  tags: [],
  properties: [],
  ...(coverImage && { coverImage }),
  last_updated: 1,
});
const mapCanvas = (id: string, mapImage?: string): CanvasData => ({
  id,
  title: id,
  type: 'map',
  nodes: [],
  connections: [],
  ...(mapImage && { mapImage }),
  last_updated: 1,
});

describe('storeImage / loadImage', () => {
  it('stores an image once and loads it back by reference', async () => {
    const db = await freshDb();
    const ref = await storeImage(db, PNG);
    expect(isAssetRef(ref)).toBe(true);
    expect(await loadImage(db, ref)).toBe(PNG);
    expect(await loadImage(db, PNG)).toBe(PNG); // inline values pass through
    expect(await loadImage(db, 'asset:missing')).toBeUndefined();
    const [asset] = await db.assets.find().exec();
    expect(asset.type).toBe('image/png');
    await db.remove();
  });

  it('refuses non-image data', async () => {
    const db = await freshDb();
    await expect(storeImage(db, 'data:text/html;base64,PHA+')).rejects.toThrow(/Only image data/);
    await db.remove();
  });
});

describe('moveInlineImagesToAssets', () => {
  it('moves inline covers and map images into assets, once', async () => {
    const db = await freshDb();
    await db.articles.insert(article('a', PNG));
    await db.canvases.insert(mapCanvas('m', WEBP));

    expect(await moveInlineImagesToAssets(db)).toBe(2);
    const a = (await db.articles.findOne('a').exec())!;
    const m = (await db.canvases.findOne('m').exec())!;
    expect(isAssetRef(a.coverImage)).toBe(true);
    expect(isAssetRef(m.mapImage)).toBe(true);
    expect(await loadImage(db, a.coverImage)).toBe(PNG);
    expect(await loadImage(db, m.mapImage)).toBe(WEBP);

    expect(await moveInlineImagesToAssets(db)).toBe(0);
    expect(await db.assets.count().exec()).toBe(2);
    await db.remove();
  });

  it('runs when an older database is opened', async () => {
    const storage = getRxStorageMemory();
    const old = await createRxDatabase({ name: 'old-images', storage });
    await old.addCollections({
      articles: { schema: loreArticleSchema },
      canvases: { schema: canvasSchema, migrationStrategies: canvasMigrationStrategies },
      snapshots: { schema: snapshotSchema },
    });
    await old.articles.insert(article('legacy', PNG));
    await old.close();

    const db = await openGaeaDatabase('old-images', storage);
    const doc = (await db.articles.findOne('legacy').exec())!;
    expect(isAssetRef(doc.coverImage)).toBe(true);
    expect(await loadImage(db, doc.coverImage)).toBe(PNG);
    await db.remove();
  });
});

describe('inlineImages / externalizeImages', () => {
  it('inlines references for export and drops ones whose image is missing', async () => {
    const db = await freshDb();
    const ref = await storeImage(db, PNG);
    const { articles, canvases } = await inlineImages(
      db,
      [article('a', ref), article('b', 'asset:gone'), article('c')],
      [mapCanvas('m', ref)]
    );
    expect(articles.map((x) => x.coverImage)).toEqual([PNG, undefined, undefined]);
    expect('coverImage' in articles[1]).toBe(false);
    expect(canvases[0].mapImage).toBe(PNG);
    await db.remove();
  });

  it('stores inline images and leaves references alone', async () => {
    const db = await freshDb();
    const ref = await storeImage(db, WEBP);
    const input = [article('a', PNG), article('b', ref), article('c')];
    const { articles } = await externalizeImages(db, input, []);
    expect(isAssetRef(articles[0].coverImage)).toBe(true);
    expect(articles[1]).toBe(input[1]);
    expect(articles[2]).toBe(input[2]);
    await db.remove();
  });
});

describe('sweepUnusedAssets', () => {
  it('deletes only unreferenced assets past the grace period', async () => {
    const db = await freshDb();
    const now = Date.now();
    const used = await storeImage(db, PNG, now - 2 * ASSET_GRACE_MS);
    const oldUnused = await storeImage(db, PNG, now - 2 * ASSET_GRACE_MS);
    const freshUnused = await storeImage(db, PNG, now);
    await db.articles.insert(article('a', used));

    expect(await sweepUnusedAssets(db, now)).toBe(1);
    expect(await loadImage(db, used)).toBe(PNG);
    expect(await loadImage(db, freshUnused)).toBe(PNG);
    expect(await db.assets.findOne(oldUnused.slice('asset:'.length)).exec()).toBeNull();
    await db.remove();
  });
});

describe('backups with stored images', () => {
  it('exports images inline and stores them again on restore', async () => {
    const db = await freshDb();
    await db.articles.insert(article('a', await storeImage(db, PNG)));

    const world = await readWorld(db);
    const exported = world.articles.find((a) => a.id === 'a')!;
    expect(exported.coverImage).toBe(PNG);

    await replaceWorld(db, world.articles, world.canvases);
    const restored = (await db.articles.findOne('a').exec())!;
    expect(isAssetRef(restored.coverImage)).toBe(true);
    expect(await loadImage(db, restored.coverImage)).toBe(PNG);
    await db.remove();
  });
});

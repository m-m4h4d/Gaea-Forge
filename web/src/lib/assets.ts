// Images (article covers, map images) stored once in their own `assets` collection.
// Articles and canvases keep a short reference ("asset:<id>") in their existing
// coverImage / mapImage fields, so saving an article no longer rewrites its image,
// and the unload recovery journals stay small. Older data may still hold an inline
// data URL in those fields; moveInlineImagesToAssets converts it.
import type { CanvasData, GaeaDatabase, LoreArticle } from './database';

export const ASSET_REF_PREFIX = 'asset:';
// Unreferenced assets younger than this are kept: an article edit pointing at a
// fresh upload may still be waiting in an unload recovery journal.
export const ASSET_GRACE_MS = 24 * 60 * 60 * 1000;

export type Asset = {
  id: string;
  dataUrl: string;
  type: string;
  size: number; // characters in dataUrl
  createdAt: number;
};

export const assetSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    dataUrl: { type: 'string' },
    type: { type: 'string' },
    size: { type: 'number' },
    createdAt: { type: 'number' },
  },
  required: ['id', 'dataUrl', 'type', 'size', 'createdAt'],
} as const;

export const isAssetRef = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(ASSET_REF_PREFIX);

export const isImageDataUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('data:image/');

const assetIdFromRef = (ref: string) => ref.slice(ASSET_REF_PREFIX.length);

// Assets never change once written (a new upload gets a new id), so loaded
// images can be cached for the session
const imageCache = new Map<string, string>();

export function getCachedImage(ref: string): string | undefined {
  return imageCache.get(ref);
}

let idCounter = 0;
const createAssetId = () => `asset-${Date.now()}-${(idCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

// Store an image data URL and return its reference
export async function storeImage(db: GaeaDatabase, dataUrl: string, now = Date.now()): Promise<string> {
  if (!isImageDataUrl(dataUrl)) throw new Error('Only image data can be stored as an asset.');
  const id = createAssetId();
  await db.assets.insert({
    id,
    dataUrl,
    type: dataUrl.slice('data:'.length, dataUrl.indexOf(';')),
    size: dataUrl.length,
    createdAt: now,
  });
  const ref = ASSET_REF_PREFIX + id;
  imageCache.set(ref, dataUrl);
  return ref;
}

// The data URL behind an image field value (a reference or a legacy inline URL)
export async function loadImage(db: GaeaDatabase, value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  if (isImageDataUrl(value)) return value;
  if (!isAssetRef(value)) return undefined;
  const cached = imageCache.get(value);
  if (cached) return cached;
  const doc = await db.assets.findOne(assetIdFromRef(value)).exec();
  if (!doc) return undefined;
  imageCache.set(value, doc.dataUrl);
  return doc.dataUrl;
}

// Replace inline image data with asset references (storing the images).
// Returns new objects only where something changed.
export async function externalizeImages(
  db: GaeaDatabase,
  articles: LoreArticle[],
  canvases: CanvasData[]
): Promise<{ articles: LoreArticle[]; canvases: CanvasData[] }> {
  const outArticles: LoreArticle[] = [];
  for (const a of articles) {
    outArticles.push(isImageDataUrl(a.coverImage) ? { ...a, coverImage: await storeImage(db, a.coverImage) } : a);
  }
  const outCanvases: CanvasData[] = [];
  for (const c of canvases) {
    outCanvases.push(isImageDataUrl(c.mapImage) ? { ...c, mapImage: await storeImage(db, c.mapImage) } : c);
  }
  return { articles: outArticles, canvases: outCanvases };
}

// Replace asset references with the image data, for self-contained backups.
// A reference whose asset is missing is dropped rather than exported broken.
export async function inlineImages(
  db: GaeaDatabase,
  articles: LoreArticle[],
  canvases: CanvasData[]
): Promise<{ articles: LoreArticle[]; canvases: CanvasData[] }> {
  const resolve = async <T extends object, K extends keyof T>(item: T, key: K): Promise<T> => {
    const value = item[key];
    if (!isAssetRef(value)) return item;
    const dataUrl = await loadImage(db, value);
    if (dataUrl) return { ...item, [key]: dataUrl };
    const copy = { ...item };
    delete copy[key];
    return copy;
  };
  return {
    articles: await Promise.all(articles.map((a) => resolve(a, 'coverImage'))),
    canvases: await Promise.all(canvases.map((c) => resolve(c, 'mapImage'))),
  };
}

// RxDB bulk calls report per-document failures instead of throwing
function assertOk(result: { error: unknown[] }, action: string) {
  if (result.error.length > 0) throw new Error(`${action} failed for ${result.error.length} document(s).`);
}

// Move inline images saved by older versions into assets. Safe to run repeatedly.
// Returns how many documents changed.
export async function moveInlineImagesToAssets(db: GaeaDatabase): Promise<number> {
  const [articleDocs, canvasDocs] = await Promise.all([
    db.articles.find().exec(),
    db.canvases.find().exec(),
  ]);
  const articles = articleDocs.map((d) => d.toJSON() as LoreArticle).filter((a) => isImageDataUrl(a.coverImage));
  const canvases = canvasDocs.map((d) => d.toJSON() as CanvasData).filter((c) => isImageDataUrl(c.mapImage));
  if (articles.length === 0 && canvases.length === 0) return 0;

  const moved = await externalizeImages(db, articles, canvases);
  // Each document is rewritten only after its image is safely stored
  if (moved.articles.length) assertOk(await db.articles.bulkUpsert(moved.articles), 'Moving article images');
  if (moved.canvases.length) assertOk(await db.canvases.bulkUpsert(moved.canvases), 'Moving map images');
  return moved.articles.length + moved.canvases.length;
}

// Delete assets no article or canvas refers to, once they are past the grace period
export async function sweepUnusedAssets(db: GaeaDatabase, now = Date.now(), graceMs = ASSET_GRACE_MS): Promise<number> {
  const [articleDocs, canvasDocs, assetDocs] = await Promise.all([
    db.articles.find().exec(),
    db.canvases.find().exec(),
    db.assets.find().exec(),
  ]);
  const referenced = new Set<string>();
  articleDocs.forEach((d) => isAssetRef(d.coverImage) && referenced.add(assetIdFromRef(d.coverImage)));
  canvasDocs.forEach((d) => isAssetRef(d.mapImage) && referenced.add(assetIdFromRef(d.mapImage)));

  const unused = assetDocs.filter((a) => !referenced.has(a.id) && a.createdAt < now - graceMs).map((a) => a.id);
  if (unused.length > 0) {
    assertOk(await db.assets.bulkRemove(unused), 'Removing unused images');
    unused.forEach((id) => imageCache.delete(ASSET_REF_PREFIX + id));
  }
  return unused.length;
}

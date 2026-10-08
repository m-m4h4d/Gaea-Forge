// Full-world backup, restore and safety snapshots for Gaea-Forge
import { CanvasData, GaeaDatabase, LoreArticle, WorldSnapshot } from './database';
import { ROLES, RoleId } from './roles';
import { sanitizeImportedHtml } from './sanitizeHtml';

export const BACKUP_FORMAT = 'gaea-forge-backup';
export const BACKUP_VERSION = 1;
const MAX_SNAPSHOTS = 5;

export type WorldBackup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  roleId?: RoleId;
  articles: LoreArticle[];
  canvases: CanvasData[];
};

export function createBackup(
  articles: LoreArticle[],
  canvases: CanvasData[],
  roleId?: RoleId
): WorldBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    roleId,
    articles,
    canvases,
  };
}

function isArticle(value: unknown): value is LoreArticle {
  if (!value || typeof value !== 'object') return false;
  const a = value as Partial<LoreArticle>;
  return typeof a.id === 'string' && typeof a.title === 'string';
}

function isCanvas(value: unknown): value is CanvasData {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<CanvasData>;
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    (c.type === 'family-tree' || c.type === 'world-web') &&
    Array.isArray(c.nodes) &&
    Array.isArray(c.connections)
  );
}

// Fill in fields that older exports or hand-written files may lack
function normalizeArticle(a: LoreArticle): LoreArticle {
  return {
    id: a.id,
    title: a.title,
    category: typeof a.category === 'string' && a.category ? a.category : 'Notes',
    content: typeof a.content === 'string' ? sanitizeImportedHtml(a.content) : '',
    tags: Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === 'string') : [],
    properties: Array.isArray(a.properties)
      ? a.properties.filter((p) => p && typeof p.key === 'string' && typeof p.value === 'string')
      : [],
    ...(typeof a.coverImage === 'string' ? { coverImage: a.coverImage } : {}),
    isPinned: Boolean(a.isPinned),
    last_updated: typeof a.last_updated === 'number' ? a.last_updated : Date.now(),
  };
}

function normalizeCanvas(c: CanvasData): CanvasData {
  return {
    id: c.id,
    title: c.title,
    type: c.type,
    nodes: c.nodes,
    connections: c.connections,
    last_updated: typeof c.last_updated === 'number' ? c.last_updated : Date.now(),
  };
}

// Returns a backup if the value is a full Gaea-Forge world backup, otherwise null.
// Legacy exports (a bare array of articles) are handled by the document importer.
export function parseWorldBackup(value: unknown): WorldBackup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Partial<WorldBackup>;
  if (v.format !== BACKUP_FORMAT || !Array.isArray(v.articles)) return null;
  if (typeof v.version === 'number' && v.version > BACKUP_VERSION) {
    throw new Error(
      'This backup was made by a newer version of Gaea-Forge. Update the app to restore it.'
    );
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof v.exportedAt === 'number' ? v.exportedAt : Date.now(),
    roleId: v.roleId && ROLES[v.roleId] ? v.roleId : undefined,
    articles: v.articles.filter(isArticle).map(normalizeArticle),
    canvases: Array.isArray(v.canvases) ? v.canvases.filter(isCanvas).map(normalizeCanvas) : [],
  };
}

export function downloadBackup(backup: WorldBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `gaea-forge-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Drop canvas nodes whose linked article no longer exists, and any connections to them.
// Returns only the canvases that changed.
export function pruneCanvasesToArticles(
  canvases: CanvasData[],
  existingArticleIds: Set<string>
): CanvasData[] {
  const changed: CanvasData[] = [];

  for (const canvas of canvases) {
    const keptNodes = canvas.nodes.filter(
      (n) => !n.articleId || existingArticleIds.has(n.articleId)
    );
    if (keptNodes.length === canvas.nodes.length) continue;

    const keptNodeIds = new Set(keptNodes.map((n) => n.id));
    changed.push({
      ...canvas,
      nodes: keptNodes,
      connections: canvas.connections.filter(
        (c) => keptNodeIds.has(c.fromNodeId) && keptNodeIds.has(c.toNodeId)
      ),
      last_updated: Date.now(),
    });
  }

  return changed;
}

// RxDB bulk operations report per-document failures instead of throwing
function assertBulkOk(result: { error: unknown[] }, action: string) {
  if (result.error.length > 0) {
    console.error(`${action} failed for ${result.error.length} document(s):`, result.error);
    throw new Error(`${action} failed for ${result.error.length} document(s).`);
  }
}

export async function readWorld(db: GaeaDatabase) {
  const [articleDocs, canvasDocs] = await Promise.all([
    db.articles.find().exec(),
    db.canvases.find().exec(),
  ]);
  return {
    articles: articleDocs.map((d) => d.toJSON() as LoreArticle),
    canvases: canvasDocs.map((d) => d.toJSON() as CanvasData),
  };
}

// Store the current world as a snapshot, keeping only the newest MAX_SNAPSHOTS
export async function createSnapshot(db: GaeaDatabase, reason: string, roleId?: RoleId) {
  const { articles, canvases } = await readWorld(db);
  const createdAt = Date.now();

  await db.snapshots.insert({
    id: `snapshot-${createdAt}`,
    createdAt,
    reason,
    articleCount: articles.length,
    canvasCount: canvases.length,
    data: JSON.stringify(createBackup(articles, canvases, roleId)),
  });

  const stale = (await listSnapshots(db)).slice(MAX_SNAPSHOTS);
  if (stale.length > 0) {
    await db.snapshots.bulkRemove(stale.map((s) => s.id));
  }
}

export async function listSnapshots(db: GaeaDatabase): Promise<WorldSnapshot[]> {
  const docs = await db.snapshots.find().exec();
  return docs
    .map((d) => d.toJSON() as WorldSnapshot)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function snapshotToBackup(snapshot: WorldSnapshot): WorldBackup {
  const backup = parseWorldBackup(JSON.parse(snapshot.data));
  if (!backup) throw new Error('This snapshot is damaged and cannot be restored.');
  return backup;
}

// Replace all articles and canvases. Callers should take a snapshot first.
export async function replaceWorld(
  db: GaeaDatabase,
  articles: LoreArticle[],
  canvases: CanvasData[]
) {
  const [oldArticles, oldCanvases] = await Promise.all([
    db.articles.find().exec(),
    db.canvases.find().exec(),
  ]);
  assertBulkOk(await db.articles.bulkRemove(oldArticles.map((d) => d.primary)), 'Removing articles');
  assertBulkOk(await db.canvases.bulkRemove(oldCanvases.map((d) => d.primary)), 'Removing canvases');
  assertBulkOk(await db.articles.bulkInsert(articles), 'Writing articles');
  assertBulkOk(await db.canvases.bulkInsert(canvases), 'Writing canvases');
}

export async function upsertArticles(db: GaeaDatabase, articles: LoreArticle[]) {
  assertBulkOk(await db.articles.bulkUpsert(articles), 'Saving articles');
}

export async function upsertCanvases(db: GaeaDatabase, canvases: CanvasData[]) {
  assertBulkOk(await db.canvases.bulkUpsert(canvases), 'Saving canvases');
}

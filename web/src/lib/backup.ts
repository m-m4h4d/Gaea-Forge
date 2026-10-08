// Full-world backup, restore and safety snapshots for Gaea-Forge
import { CANVAS_TYPES, CanvasData, GaeaDatabase, LoreArticle, TimelineEra, TimelineEvent, WorldSnapshot } from './database';
import { ROLES, RoleId } from './roles';
import { sanitizeImportedHtml } from './sanitizeHtml';
import { externalizeImages, inlineImages, isImageDataUrl } from './assets';

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
    CANVAS_TYPES.includes(c.type as CanvasData['type']) &&
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
    // Only image data; anything else is dropped
    ...(isImageDataUrl(a.coverImage) ? { coverImage: a.coverImage } : {}),
    isPinned: Boolean(a.isPinned),
    last_updated: typeof a.last_updated === 'number' ? a.last_updated : Date.now(),
  };
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optionalNumber = (v: unknown) => (isFiniteNumber(v) ? v : undefined);
const optionalString = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// Drop undefined keys so restored documents match what the app writes
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function normalizeEvent(e: unknown): TimelineEvent | null {
  if (!e || typeof e !== 'object') return null;
  const v = e as Partial<TimelineEvent>;
  if (typeof v.id !== 'string' || typeof v.title !== 'string' || !isFiniteNumber(v.year)) return null;
  return compact({
    id: v.id,
    title: v.title,
    year: v.year,
    month: optionalNumber(v.month),
    day: optionalNumber(v.day),
    endYear: optionalNumber(v.endYear),
    articleId: optionalString(v.articleId),
    description: optionalString(v.description),
  });
}

function normalizeEra(e: unknown): TimelineEra | null {
  if (!e || typeof e !== 'object') return null;
  const v = e as Partial<TimelineEra>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string' || !isFiniteNumber(v.startYear)) return null;
  return compact({ id: v.id, name: v.name, startYear: v.startYear, endYear: optionalNumber(v.endYear) });
}

function normalizeCanvas(c: CanvasData): CanvasData {
  return compact({
    id: c.id,
    title: c.title,
    type: c.type,
    nodes: c.nodes,
    connections: c.connections,
    events: Array.isArray(c.events)
      ? c.events.map(normalizeEvent).filter((e): e is TimelineEvent => e !== null)
      : undefined,
    eras: Array.isArray(c.eras)
      ? c.eras.map(normalizeEra).filter((e): e is TimelineEra => e !== null)
      : undefined,
    // Only image data URLs; anything else is dropped
    mapImage:
      typeof c.mapImage === 'string' && c.mapImage.startsWith('data:image/') ? c.mapImage : undefined,
    last_updated: typeof c.last_updated === 'number' ? c.last_updated : Date.now(),
  });
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

export function backupFileName(backup: WorldBackup): string {
  return `gaea-forge-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`;
}

// Drop canvas nodes (and map pins) whose linked article no longer exists, with any
// connections to them, and unlink timeline events from it (the event itself stays).
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
    const hasDanglingEvent = (canvas.events ?? []).some(
      (e) => e.articleId && !existingArticleIds.has(e.articleId)
    );
    if (keptNodes.length === canvas.nodes.length && !hasDanglingEvent) continue;

    const keptNodeIds = new Set(keptNodes.map((n) => n.id));
    changed.push({
      ...canvas,
      nodes: keptNodes,
      connections: canvas.connections.filter(
        (c) => keptNodeIds.has(c.fromNodeId) && keptNodeIds.has(c.toNodeId)
      ),
      ...(canvas.events && {
        events: canvas.events.map((e) => {
          if (!e.articleId || existingArticleIds.has(e.articleId)) return e;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { articleId, ...unlinked } = e;
          return unlinked;
        }),
      }),
      last_updated: Date.now(),
    });
  }

  return changed;
}

// Undo for pruneCanvasesToArticles: put an article's nodes (and map pins), their
// connections and its timeline links back into the *current* canvases, so edits
// made since the deletion are kept. `before` is the canvases as they were before it.
// Returns only the canvases that changed.
export function restoreArticleLinks(current: CanvasData[], before: CanvasData[], articleId: string): CanvasData[] {
  const changed: CanvasData[] = [];

  for (const canvas of current) {
    const old = before.find((c) => c.id === canvas.id);
    if (!old) continue;

    const nodeIds = new Set(canvas.nodes.map((n) => n.id));
    const restoredNodes = old.nodes.filter((n) => n.articleId === articleId && !nodeIds.has(n.id));
    const nodesAfter = [...canvas.nodes, ...restoredNodes];
    const allIds = new Set(nodesAfter.map((n) => n.id));
    const restoredIds = new Set(restoredNodes.map((n) => n.id));
    const connectionIds = new Set(canvas.connections.map((c) => c.id));
    const restoredConnections = old.connections.filter(
      (c) =>
        !connectionIds.has(c.id) &&
        (restoredIds.has(c.fromNodeId) || restoredIds.has(c.toNodeId)) &&
        allIds.has(c.fromNodeId) &&
        allIds.has(c.toNodeId)
    );

    // Events that pointed at the article and are now unlinked get their link back
    const relinkIds = new Set(
      (old.events ?? []).filter((e) => e.articleId === articleId).map((e) => e.id)
    );
    let relinked = false;
    const events = canvas.events?.map((e) => {
      if (!relinkIds.has(e.id) || e.articleId) return e;
      relinked = true;
      return { ...e, articleId };
    });

    if (restoredNodes.length === 0 && restoredConnections.length === 0 && !relinked) continue;
    changed.push({
      ...canvas,
      nodes: nodesAfter,
      connections: [...canvas.connections, ...restoredConnections],
      ...(events && { events }),
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

// The whole world as stored, with images inlined so backups and snapshots are self-contained
export async function readWorld(db: GaeaDatabase) {
  const [articleDocs, canvasDocs] = await Promise.all([
    db.articles.find().exec(),
    db.canvases.find().exec(),
  ]);
  return inlineImages(
    db,
    articleDocs.map((d) => d.toJSON() as LoreArticle),
    canvasDocs.map((d) => d.toJSON() as CanvasData)
  );
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
  // Store images first: if that fails, the current world has not been touched
  const next = await externalizeImages(db, articles, canvases);
  const [oldArticles, oldCanvases] = await Promise.all([
    db.articles.find().exec(),
    db.canvases.find().exec(),
  ]);
  assertBulkOk(await db.articles.bulkRemove(oldArticles.map((d) => d.primary)), 'Removing articles');
  assertBulkOk(await db.canvases.bulkRemove(oldCanvases.map((d) => d.primary)), 'Removing canvases');
  assertBulkOk(await db.articles.bulkInsert(next.articles), 'Writing articles');
  assertBulkOk(await db.canvases.bulkInsert(next.canvases), 'Writing canvases');
}

export async function upsertArticles(db: GaeaDatabase, articles: LoreArticle[]) {
  assertBulkOk(await db.articles.bulkUpsert(articles), 'Saving articles');
}

export async function upsertCanvases(db: GaeaDatabase, canvases: CanvasData[]) {
  assertBulkOk(await db.canvases.bulkUpsert(canvases), 'Saving canvases');
}

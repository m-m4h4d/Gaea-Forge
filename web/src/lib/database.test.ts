import { describe, expect, it } from 'vitest';
import { createRxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { canvasSchema, CanvasData, loreArticleSchema, openGaeaDatabase, snapshotSchema } from './database';

// The canvas schema as shipped before timeline and map canvases (version 0)
const canvasSchemaV0 = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    type: { type: 'string' },
    nodes: { type: 'array', items: { type: 'object' } },
    connections: { type: 'array', items: { type: 'object' } },
    last_updated: { type: 'number' },
  },
  required: ['id', 'title', 'type', 'nodes', 'connections', 'last_updated'],
} as const;

// The canvas schema before timeline calendars (version 1)
const canvasSchemaV1 = {
  ...canvasSchemaV0,
  version: 1,
  properties: {
    ...canvasSchemaV0.properties,
    events: { type: 'array', items: { type: 'object' } },
    eras: { type: 'array', items: { type: 'object' } },
    mapImage: { type: 'string' },
  },
} as const;

const oldCanvas: CanvasData = {
  id: 'canvas-old',
  title: 'Old Web',
  type: 'world-web',
  nodes: [{ id: 'n1', label: 'Node', category: 'Notes', x: 1, y: 2 }],
  connections: [],
  last_updated: 5,
};

// A database as an older version of the app left it
async function createV0Database(name: string, storage: ReturnType<typeof getRxStorageMemory>) {
  const db = await createRxDatabase({ name, storage });
  await db.addCollections({
    articles: { schema: loreArticleSchema },
    canvases: { schema: canvasSchemaV0 },
    snapshots: { schema: snapshotSchema },
  });
  await db.canvases.insert(oldCanvas);
  await db.close();
}

describe('database migrations', () => {
  it('keeps canvases saved with schema v0 after upgrading', async () => {
    const storage = getRxStorageMemory();
    await createV0Database('migrate-ok', storage);

    const db = await openGaeaDatabase('migrate-ok', storage);
    const doc = await db.canvases.findOne('canvas-old').exec();
    expect(doc?.toJSON()).toEqual(oldCanvas);
    // The old canvas counts, so the seed canvases are not added on top
    expect(await db.canvases.count().exec()).toBe(1);
    await db.remove();
  });

  it('keeps timelines saved with schema v1 and lets them gain a calendar', async () => {
    const storage = getRxStorageMemory();
    const timeline: CanvasData = {
      id: 'canvas-tl-v1',
      title: 'Chronicle',
      type: 'timeline',
      nodes: [],
      connections: [],
      events: [{ id: 'e1', title: 'Founding', year: 412, month: 3, day: 15 }],
      eras: [{ id: 'era1', name: 'the Restoration', startYear: 410 }],
      last_updated: 7,
    };
    const old = await createRxDatabase({ name: 'migrate-v1', storage });
    await old.addCollections({
      articles: { schema: loreArticleSchema },
      canvases: { schema: canvasSchemaV1, migrationStrategies: { 1: (d: CanvasData) => d } },
      snapshots: { schema: snapshotSchema },
    });
    await old.canvases.insert(timeline);
    await old.close();

    const db = await openGaeaDatabase('migrate-v1', storage);
    const doc = await db.canvases.findOne('canvas-tl-v1').exec();
    expect(doc?.toJSON()).toEqual(timeline);
    const withCalendar = { ...timeline, calendar: { months: [{ name: 'Frostmere', days: 30 }], yearSuffix: 'AR' } };
    await db.canvases.upsert(withCalendar);
    expect((await db.canvases.findOne('canvas-tl-v1').exec())?.toJSON()).toEqual(withCalendar);
    await db.remove();
  });

  it('refuses to open old data with a changed schema and no migration', async () => {
    const storage = getRxStorageMemory();
    await createV0Database('migrate-missing', storage);

    const db = await createRxDatabase({ name: 'migrate-missing', storage });
    await expect(db.addCollections({ canvases: { schema: canvasSchema } })).rejects.toThrow();
    // The failed collection is already torn down, so only close the database
    await db.close();
  });

  it('stores the new timeline and map fields', async () => {
    const db = await openGaeaDatabase('fresh', getRxStorageMemory());
    const timeline: CanvasData = {
      id: 'canvas-tl',
      title: 'History',
      type: 'timeline',
      nodes: [],
      connections: [],
      events: [{ id: 'e1', title: 'Founding', year: -300, articleId: 'welcome-gaea-forge' }],
      eras: [{ id: 'era1', name: 'First Age', startYear: -500, endYear: 0 }],
      last_updated: 1,
    };
    await db.canvases.insert(timeline);
    expect((await db.canvases.findOne('canvas-tl').exec())?.toJSON()).toEqual(timeline);
    await db.remove();
  });
});

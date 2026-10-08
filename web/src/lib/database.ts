import { addRxPlugin, createRxDatabase, RxCollection, RxDatabase, RxStorage } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { Asset, assetSchema, moveInlineImagesToAssets, sweepUnusedAssets } from './assets';

// Needed for schema version bumps (migrationStrategies)
addRxPlugin(RxDBMigrationSchemaPlugin);

export type EntityProperty = {
  key: string;
  value: string;
};

export type LoreArticle = {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  properties: EntityProperty[];
  coverImage?: string;
  isPinned?: boolean;
  last_updated: number;
};

export type RelationshipType =
  | 'parent-child'
  | 'spouse'
  | 'sibling'
  | 'ancestor'
  | 'mentor'
  | 'ally'
  | 'rival'
  | 'custom';

export type CanvasType = 'family-tree' | 'world-web' | 'timeline' | 'map';

export const CANVAS_TYPES: CanvasType[] = ['world-web', 'family-tree', 'timeline', 'map'];

export type CanvasNode = {
  id: string;
  articleId?: string;
  label: string;
  role?: string;
  category: string;
  x: number;
  y: number;
  z?: number;
  avatarUrl?: string;
};

export type CanvasConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: RelationshipType;
  label?: string;
};

// A dated event on a timeline canvas. Years are plain numbers in the world's own
// calendar and may be negative; month and day are optional refinements.
export type TimelineEvent = {
  id: string;
  title: string;
  year: number;
  month?: number;
  day?: number;
  // Last year of an event that spans time (a war, a reign)
  endYear?: number;
  articleId?: string;
  description?: string;
};

// A named span of years shown as a band behind events (e.g. "The Age of Ash")
export type TimelineEra = {
  id: string;
  name: string;
  startYear: number;
  endYear?: number;
};

export type CanvasData = {
  id: string;
  title: string;
  type: CanvasType;
  // World web / family tree: positioned nodes. Map: pins, with x and y as
  // fractions (0-1) of the map image's width and height.
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  // Timeline canvases
  events?: TimelineEvent[];
  eras?: TimelineEra[];
  // Map canvases: the map image as a data URL
  mapImage?: string;
  last_updated: number;
};

export const LORE_CATEGORIES = [
  'Characters',
  'Locations',
  'Kingdoms & Factions',
  'Magic & Technology',
  'Artifacts',
  'Campaign Notes',
] as const;

export const DEFAULT_LORE_CATEGORIES = [...LORE_CATEGORIES];
export type LoreCategory = string;

export const loreArticleSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    title: {
      type: 'string'
    },
    category: {
      type: 'string'
    },
    content: {
      type: 'string'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    properties: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['key', 'value']
      }
    },
    coverImage: {
      type: 'string'
    },
    isPinned: {
      type: 'boolean'
    },
    last_updated: {
      type: 'number'
    }
  },
  required: ['id', 'title', 'category', 'content', 'tags', 'properties', 'last_updated']
} as const;

export const canvasSchema = {
  // v1 added events, eras and mapImage for timeline and map canvases
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    title: {
      type: 'string'
    },
    type: {
      type: 'string'
    },
    nodes: {
      type: 'array',
      items: {
        type: 'object'
      }
    },
    connections: {
      type: 'array',
      items: {
        type: 'object'
      }
    },
    events: {
      type: 'array',
      items: {
        type: 'object'
      }
    },
    eras: {
      type: 'array',
      items: {
        type: 'object'
      }
    },
    mapImage: {
      type: 'string'
    },
    last_updated: {
      type: 'number'
    }
  },
  required: ['id', 'title', 'type', 'nodes', 'connections', 'last_updated']
} as const;

// A full copy of the world taken automatically before destructive operations
// (replace import, backup restore), so they can be undone.
export type WorldSnapshot = {
  id: string;
  createdAt: number;
  reason: string;
  articleCount: number;
  canvasCount: number;
  data: string; // Serialized WorldBackup
};

export const snapshotSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    createdAt: {
      type: 'number'
    },
    reason: {
      type: 'string'
    },
    articleCount: {
      type: 'number'
    },
    canvasCount: {
      type: 'number'
    },
    data: {
      type: 'string'
    }
  },
  required: ['id', 'createdAt', 'reason', 'articleCount', 'canvasCount', 'data']
} as const;

export type LoreArticleCollection = RxCollection<LoreArticle>;
export type CanvasCollection = RxCollection<CanvasData>;
export type SnapshotCollection = RxCollection<WorldSnapshot>;
export type AssetCollection = RxCollection<Asset>;
export type GaeaDatabaseCollections = {
  articles: LoreArticleCollection;
  canvases: CanvasCollection;
  snapshots: SnapshotCollection;
  assets: AssetCollection;
};
export type GaeaDatabase = RxDatabase<GaeaDatabaseCollections>;

let dbPromise: Promise<GaeaDatabase> | null = null;

// Canvases were stored in localStorage before they moved into RxDB.
const LEGACY_CANVAS_STORAGE_KEY = 'gaea_canvases_v3';

function loadLegacyCanvases(): CanvasData[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_CANVAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as CanvasData[];
  } catch {
    return null;
  }
}

export const INITIAL_SEED_ARTICLES: LoreArticle[] = [
  {
    id: 'welcome-gaea-forge',
    title: 'Welcome to Gaea-Forge',
    category: 'Campaign Notes',
    tags: ['welcome', 'getting-started', 'guide'],
    properties: [
      { key: 'Status', value: 'Active' },
      { key: 'Platform', value: 'Gaea-Forge' },
      { key: 'Storage', value: 'Local-First' },
    ],
    content: `
      <h1>Welcome to Gaea-Forge</h1>
      <p>Your local-first, open-source world-building platform for fantasy, sci-fi, and tabletop RPG campaign lore.</p>
      <h2>Getting Started</h2>
      <ul>
        <li><strong>Create Lore:</strong> Use the <em>New</em> button at the bottom of the sidebar (or the <em>+</em> beside a category) to add characters, places, factions and artifacts.</li>
        <li><strong>Link Your World:</strong> Type <code>[[</code> in the editor to link to another article, or create one on the spot. Each article lists everything that mentions it.</li>
        <li><strong>World Canvases:</strong> Add canvases under <em>World Canvases</em> in the sidebar: a <strong>World Web</strong> of relationships (in 2D or a 3D cosmos), <strong>Family Trees</strong>, <strong>Timelines</strong> with eras, and <strong>Maps</strong> with pins.</li>
        <li><strong>Entity Inspector:</strong> On the right, set the category, tags, custom key-value properties and artwork, and see where an article appears.</li>
        <li><strong>Import &amp; Back Up:</strong> The <em>Import</em> button at the top of the sidebar brings in .pdf, .docx, .md and .txt files, and its <em>Backup &amp; Restore</em> tab saves your whole world to a file.</li>
        <li><strong>Local &amp; Private:</strong> Everything is stored on this device, with no account or cloud. Changes save automatically; download a backup now and then.</li>
      </ul>
    `,
    isPinned: true,
    last_updated: Date.now(),
  },
];

export const INITIAL_SEED_CANVASES: CanvasData[] = [
  {
    id: 'canvas-master-web',
    title: 'Master World Web',
    type: 'world-web',
    nodes: [
      {
        id: 'node-welcome-gaea-forge',
        articleId: 'welcome-gaea-forge',
        label: 'Welcome to Gaea-Forge',
        role: 'Guide & Overview',
        category: 'Campaign Notes',
        x: 400,
        y: 250,
      },
    ],
    connections: [],
    last_updated: Date.now(),
  },
  {
    id: 'canvas-family-tree',
    title: 'Family Tree Canvas',
    type: 'family-tree',
    nodes: [],
    connections: [],
    last_updated: Date.now(),
  },
];

// Migrations for each schema version bump: { [newVersion]: (oldDoc) => newDoc }.
// Never change a schema without bumping its version and adding a strategy here,
// or existing databases fail to open.
export const canvasMigrationStrategies = {
  // v0 -> v1 only added optional fields
  1: (oldDoc: CanvasData) => oldDoc,
};

// Open (or create) the database with every collection, migrating and seeding as
// needed. Separate from getDatabase so tests can pass in-memory storage.
export async function openGaeaDatabase(name: string, storage: RxStorage<unknown, unknown>): Promise<GaeaDatabase> {
  const db = await createRxDatabase<GaeaDatabaseCollections>({ name, storage });

  await db.addCollections({
    articles: {
      schema: loreArticleSchema,
    },
    canvases: {
      schema: canvasSchema,
      migrationStrategies: canvasMigrationStrategies,
    },
    snapshots: {
      schema: snapshotSchema,
    },
    assets: {
      schema: assetSchema,
    },
  });

  // Seed if empty
  const count = await db.articles.count().exec();
  if (count === 0) {
    await db.articles.bulkInsert(INITIAL_SEED_ARTICLES);
  }

  const canvasCount = await db.canvases.count().exec();
  if (canvasCount === 0) {
    await db.canvases.bulkInsert(loadLegacyCanvases() ?? INITIAL_SEED_CANVASES);
    try {
      localStorage.removeItem(LEGACY_CANVAS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // Images saved inline by older versions move to the assets collection. A failure
  // here leaves the images inline (still working), so it must not block opening.
  try {
    await moveInlineImagesToAssets(db);
    await sweepUnusedAssets(db);
  } catch (e) {
    console.error('Could not tidy stored images:', e);
  }

  return db;
}

export const getDatabase = async (): Promise<GaeaDatabase> => {
  if (typeof window === 'undefined') {
    throw new Error('RxDB can only be initialized on the client side');
  }

  if (!dbPromise) {
    dbPromise = openGaeaDatabase('gaeafdb_v6', getRxStorageDexie()).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
};

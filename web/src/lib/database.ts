import { createRxDatabase, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

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

export type CanvasType = 'family-tree' | 'world-web';

export type CanvasNode = {
  id: string;
  articleId?: string;
  label: string;
  role?: string;
  category: string;
  x: number;
  y: number;
  avatarUrl?: string;
};

export type CanvasConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: RelationshipType;
  label?: string;
};

export type CanvasData = {
  id: string;
  title: string;
  type: CanvasType;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
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

export type LoreCategory = typeof LORE_CATEGORIES[number];

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

export type LoreArticleCollection = RxCollection<LoreArticle>;
export type GaeaDatabaseCollections = {
  articles: LoreArticleCollection;
};
export type GaeaDatabase = RxDatabase<GaeaDatabaseCollections>;

let dbPromise: Promise<GaeaDatabase> | null = null;

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
        <li><strong>Create Lore:</strong> Click <em>+ New Lore Article</em> in the sidebar to add characters, locations, factions, and artifacts.</li>
        <li><strong>World Canvases:</strong> Create multi-type canvases in the sidebar! Visualise family trees or explore the <strong>Master World Web</strong> connecting all your universe entities.</li>
        <li><strong>Rich Formatting:</strong> Use headings, text formatting, lists, blockquotes, and code in the live editor.</li>
        <li><strong>Entity Inspector:</strong> Tag your entries, define custom key-value properties, and upload entity artwork on the right.</li>
        <li><strong>Local & Private:</strong> All your world data is stored locally in IndexedDB with zero cloud dependencies. Backup anytime via <em>💾 Backup</em>.</li>
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

export const getDatabase = async (): Promise<GaeaDatabase> => {
  if (typeof window === 'undefined') {
    throw new Error('RxDB can only be initialized on the client side');
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase<GaeaDatabaseCollections>({
        name: 'gaeafdb_v6',
        storage: getRxStorageDexie(),
        ignoreDuplicate: true,
      });

      await db.addCollections({
        articles: {
          schema: loreArticleSchema,
        },
      });

      // Seed if empty
      const count = await db.articles.count().exec();
      if (count === 0) {
        await db.articles.bulkInsert(INITIAL_SEED_ARTICLES);
      }

      return db;
    })();
  }
  return dbPromise;
};

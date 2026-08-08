import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// Add dev mode plugin only in development
if (process.env.NODE_ENV === 'development') {
  try {
    addRxPlugin(RxDBDevModePlugin);
  } catch {
    // ignore if plugin registered multiple times in HMR
  }
}

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
        <li><strong>Rich Formatting:</strong> Use headings, text formatting, lists, blockquotes, and code in the live editor.</li>
        <li><strong>Entity Inspector:</strong> Tag your entries, define custom key-value properties, and upload entity artwork on the right.</li>
        <li><strong>Local & Private:</strong> All your world data is stored locally in IndexedDB with zero cloud dependencies. Backup anytime via <em>💾 Backup</em>.</li>
      </ul>
    `,
    isPinned: true,
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
        name: 'gaeafdb_v3',
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

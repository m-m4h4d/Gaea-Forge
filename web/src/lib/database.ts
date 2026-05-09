import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

// Add dev mode plugin only in development
if (process.env.NODE_ENV === 'development') {
  addRxPlugin(RxDBDevModePlugin);
}

export type LoreArticle = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  last_updated: number;
};

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
    content: {
      type: 'string'
    },
    tags: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    last_updated: {
      type: 'number'
    }
  },
  required: ['id', 'title', 'content', 'last_updated']
} as const;

export type LoreArticleCollection = RxCollection<LoreArticle>;
export type GaeaDatabaseCollections = {
  articles: LoreArticleCollection;
};
export type GaeaDatabase = RxDatabase<GaeaDatabaseCollections>;

let dbPromise: Promise<GaeaDatabase> | null = null;

export const getDatabase = async () => {
  if (!dbPromise) {
    dbPromise = createRxDatabase<GaeaDatabaseCollections>({
      name: 'gaeafdb',
      storage: getRxStorageDexie()
    }).then(async (db) => {
      await db.addCollections({
        articles: {
          schema: loreArticleSchema
        }
      });
      return db;
    });
  }
  return dbPromise;
};

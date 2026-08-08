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
    id: 'char-elora',
    title: 'Elora of the Wilds',
    category: 'Characters',
    tags: ['hero', 'druid', 'archdruid', 'wood-elf'],
    properties: [
      { key: 'Status', value: 'Alive' },
      { key: 'Location', value: 'Whispering Woods' },
      { key: 'Affiliation', value: 'Circle of Thorns' },
      { key: 'Species', value: 'Wood Elf' },
      { key: 'Role', value: 'Guardian of the Heart Tree' },
    ],
    content: `
      <h1>Elora of the Wilds</h1>
      <p>High Archdruid of the Circle of Thorns and sworn defender of the Great Heart Tree in the Whispering Woods.</p>
      <h2>Background</h2>
      <p>Born beneath the blood moon in the Third Age, Elora bound her soul to the ancient flora of the southern canopy. She wields the <strong>Staff of Verdant Wrath</strong> and commands the ancient forest spirits to protect her homeland from encroaching empire forces.</p>
      <h2>Current Motives</h2>
      <p>She seeks to cleanse the corrupted ley-lines before the Shattered Crown vanguard reaches the sacred heartland glade.</p>
      <blockquote>"The forest does not ask for peace; it demands respect."</blockquote>
    `,
    isPinned: true,
    last_updated: Date.now() - 3600000,
  },
  {
    id: 'loc-whispering-woods',
    title: 'Whispering Woods',
    category: 'Locations',
    tags: ['forest', 'ancient', 'magic', 'sylvan'],
    properties: [
      { key: 'Region', value: 'Aethelgard Border' },
      { key: 'Danger Level', value: 'High' },
      { key: 'Dominant Species', value: 'Sylvan Creatures' },
      { key: 'Climate', value: 'Temperate Mist' },
    ],
    content: `
      <h1>Whispering Woods</h1>
      <p>An ancient woodland spanning over three hundred leagues along the eastern marches of Aethelgard. Legend says the trees themselves whisper to travelers in forgotten tongues.</p>
      <h2>Key Landmarks</h2>
      <ul>
        <li><strong>The Heart Tree:</strong> Nexus of primal magic and home to the Archdruid council.</li>
        <li><strong>Mistveil Falls:</strong> A cascading waterfall shrouded in eternal, luminous fog.</li>
        <li><strong>The Forgotten Barrow:</strong> Ancient ruins containing sealed Third-Age relics.</li>
      </ul>
    `,
    isPinned: false,
    last_updated: Date.now() - 7200000,
  },
  {
    id: 'faction-circle-thorns',
    title: 'Circle of Thorns',
    category: 'Kingdoms & Factions',
    tags: ['druids', 'faction', 'guardians', 'neutral'],
    properties: [
      { key: 'Leader', value: 'Elora of the Wilds' },
      { key: 'Headquarters', value: 'Heart Tree Glade' },
      { key: 'Ideology', value: 'Natural Balance' },
      { key: 'Members', value: 'Approx. 400 Druids & Rangers' },
    ],
    content: `
      <h1>Circle of Thorns</h1>
      <p>A secretive order of druids, rangers, and elementalists dedicated to maintaining the delicate balance of nature against imperial expansion and demonic corruption.</p>
      <h2>Alliances & Enemies</h2>
      <p>They maintain a tense truce with the Kingdom of Aethelgard but actively wage guerrilla warfare against corrupting dark cults in the wildlands.</p>
    `,
    isPinned: false,
    last_updated: Date.now() - 14400000,
  },
  {
    id: 'magic-leylines',
    title: 'Ley-Line Weaving',
    category: 'Magic & Technology',
    tags: ['magic-system', 'arcane', 'world-lore', 'telluric'],
    properties: [
      { key: 'Source', value: 'Telluric Currents' },
      { key: 'Difficulty', value: 'Mastery Required' },
      { key: 'Risk', value: 'Mana Saturation Sickness' },
    ],
    content: `
      <h1>Ley-Line Weaving</h1>
      <p>The arcane art of tapping directly into subterranean rivers of raw magical energy. Practitioners channel power through runes engraved into dragon-iron focus weapons or wooden staves.</p>
      <h2>Principles of Weaving</h2>
      <ol>
        <li><strong>Harmonization:</strong> Matching one's heartbeat to the frequency of the nearest node.</li>
        <li><strong>Siphoning:</strong> Drawing raw mana without tearing the local veil.</li>
        <li><strong>Discharge:</strong> Shaping energy into elemental or protective forms.</li>
      </ol>
    `,
    isPinned: false,
    last_updated: Date.now() - 28800000,
  },
  {
    id: 'artifact-staff-verdant',
    title: 'Staff of Verdant Wrath',
    category: 'Artifacts',
    tags: ['relic', 'weapon', 'legendary', 'wood-elf'],
    properties: [
      { key: 'Rarity', value: 'Legendary' },
      { key: 'Attunement', value: 'Druid' },
      { key: 'Material', value: 'Ironwood & Solar Crystal' },
    ],
    content: `
      <h1>Staff of Verdant Wrath</h1>
      <p>Carved from the heartwood of the First Oak, this ancient staff amplifies nature magic tenfold and allows its wielder to summon thorn golems in combat.</p>
    `,
    isPinned: false,
    last_updated: Date.now() - 43200000,
  },
  {
    id: 'campaign-shattered-crown',
    title: 'The Shattered Crown',
    category: 'Campaign Notes',
    tags: ['campaign', 'main-quest', 'session-notes'],
    properties: [
      { key: 'Current Chapter', value: 'Act II: The Sylvan March' },
      { key: 'Next Session', value: 'Friday 8:00 PM' },
      { key: 'Party Level', value: 'Level 7' },
    ],
    content: `
      <h1>The Shattered Crown - Campaign Overview</h1>
      <p>The party has entered the Whispering Woods seeking the lost fragment of the Sun Crown before the Dark Regent's vanguard arrives.</p>
      <h2>Session Summaries</h2>
      <p><strong>Session 12:</strong> Reached the outskirts of Mistveil Falls. Formed a temporary alliance with Elora after defending a sacred grove from shadow wolves.</p>
    `,
    isPinned: true,
    last_updated: Date.now() - 50000,
  },
];

export const getDatabase = async (): Promise<GaeaDatabase> => {
  if (typeof window === 'undefined') {
    throw new Error('RxDB can only be initialized on the client side');
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await createRxDatabase<GaeaDatabaseCollections>({
        name: 'gaeafdb_v2',
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

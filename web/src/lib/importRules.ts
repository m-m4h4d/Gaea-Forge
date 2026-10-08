// Keyword rules that sort imported entries into the active role's categories.
// Defaults come from each category's own name plus a generic vocabulary for its
// kind of content; users can edit them per role in the import dialog.
import { RoleId, ROLES } from './roles';

export type ImportRule = { category: string; keywords: string[] };

type Kind =
  | 'character'
  | 'creature'
  | 'location'
  | 'faction'
  | 'magic'
  | 'item'
  | 'story'
  | 'project'
  | 'research'
  | 'notes';

// Which kind of content a category holds, judged from its name (first match wins)
const KIND_PATTERNS: [RegExp, Kind][] = [
  [/character|cast|npc|people|contact/i, 'character'],
  [/bestiary|monster|species|creature/i, 'creature'],
  [/location|realm|level|biome|dungeon|place|map/i, 'location'],
  [/faction|kingdom|guild|organi[sz]ation/i, 'faction'],
  [/project|roadmap/i, 'project'],
  [/magic|spell|system|mechanic|technolog|concept|idea/i, 'magic'],
  [/relic|artifact|weapon|item|gear/i, 'item'],
  [/research|reference/i, 'research'],
  [/plot|chapter|quest|dialogue|session|encounter|journal|daily|campaign/i, 'story'],
];

// Generic genre vocabulary per kind of content. Deliberately not tied to any one world.
const KIND_KEYWORDS: Record<Kind, string[]> = {
  character: [
    'character', 'person', 'people', 'npc', 'hero', 'heroine', 'villain', 'protagonist', 'antagonist',
    'king', 'queen', 'prince', 'princess', 'lord', 'lady', 'captain', 'commander', 'knight', 'soldier',
    'wizard', 'mage', 'priest', 'merchant', 'scientist', 'born', 'age', 'personality', 'backstory', 'occupation', 'rank',
  ],
  creature: [
    'creature', 'beast', 'monster', 'species', 'dragon', 'undead', 'demon', 'spirit', 'predator',
    'habitat', 'diet', 'swarm', 'hunt',
  ],
  location: [
    'location', 'place', 'city', 'town', 'village', 'capital', 'region', 'realm', 'continent', 'island',
    'mountain', 'river', 'lake', 'forest', 'desert', 'sea', 'valley', 'dungeon', 'castle', 'fortress',
    'temple', 'tower', 'ruins', 'port', 'district', 'planet', 'station', 'level', 'biome', 'population',
    'climate', 'geography',
  ],
  faction: [
    'faction', 'guild', 'order', 'clan', 'house', 'tribe', 'cult', 'army', 'empire', 'kingdom', 'nation',
    'government', 'republic', 'alliance', 'council', 'organization', 'corporation', 'church', 'collective',
    'members', 'headquarters', 'ruler', 'ideology',
  ],
  magic: [
    'magic', 'spell', 'ritual', 'arcana', 'enchantment', 'curse', 'sorcery', 'mana', 'ability', 'power',
    'system', 'mechanic', 'technology', 'rule', 'element', 'concept', 'idea', 'theory', 'propulsion',
  ],
  item: [
    'item', 'artifact', 'relic', 'weapon', 'sword', 'blade', 'bow', 'armor', 'armour', 'shield', 'ring',
    'amulet', 'staff', 'gem', 'stone', 'potion', 'tool', 'gear', 'equipment', 'forged', 'crafted', 'lance',
  ],
  story: [
    'plot', 'chapter', 'scene', 'quest', 'mission', 'session', 'encounter', 'event', 'war', 'battle',
    'history', 'journal', 'log', 'daily', 'campaign', 'dialogue', 'objective', 'reward',
  ],
  project: ['project', 'roadmap', 'milestone', 'deadline', 'task', 'goal', 'plan'],
  research: ['research', 'reference', 'paper', 'study', 'source', 'citation', 'book', 'article'],
  notes: [],
};

const STOP_WORDS = new Set(['and', 'the', 'of', 'a', 'an', '&']);

export function categoryKind(category: string): Kind {
  return KIND_PATTERNS.find(([pattern]) => pattern.test(category))?.[1] ?? 'notes';
}

// "Characters & NPCs" -> ["character", "npc"]
function nameKeywords(category: string): string[] {
  return category
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(singular);
}

// Words that look plural but are the same in the singular
const INVARIANT = new Set(['species', 'series', 'news', 'chess', 'physics', 'mathematics', 'status', 'chaos']);

function singular(word: string): string {
  if (INVARIANT.has(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

export function defaultImportRules(roleId: RoleId): ImportRule[] {
  return ROLES[roleId].categories.map((category) => ({
    category,
    keywords: Array.from(new Set([...nameKeywords(category), ...KIND_KEYWORDS[categoryKind(category)]])),
  }));
}

// The category entries go to when no rule matches (the role's notes-like category)
export function fallbackCategory(roleId: RoleId): string {
  const categories = ROLES[roleId].categories;
  return (
    categories.find((c) => categoryKind(c) === 'notes') ??
    categories.find((c) => categoryKind(c) === 'story') ??
    categories[categories.length - 1]
  );
}

const WEIGHTS = { section: 4, title: 3, body: 1 };
// Only the start of the body is read, so long entries don't win on volume alone
const BODY_SAMPLE = 600;
const MAX_BODY_HITS = 3;

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

// Occurrences of a keyword (or multi-word phrase) in already normalized words
function countHits(words: string[], keyword: string[]): number {
  if (keyword.length === 0) return 0;
  let hits = 0;
  for (let i = 0; i + keyword.length <= words.length; i++) {
    if (keyword.every((k, j) => words[i + j] === k)) hits++;
  }
  return hits;
}

export type ClassifyInput = { title: string; sectionContext: string; body: string };

// Pick the category whose keywords best match the entry. Ties go to the earlier
// rule (the role's own category order); no match at all returns the fallback.
export function classifyEntry(entry: ClassifyInput, rules: ImportRule[], fallback: string): string {
  const section = normalizeWords(entry.sectionContext);
  const title = normalizeWords(entry.title);
  const body = normalizeWords(entry.body.slice(0, BODY_SAMPLE));

  let best: { category: string; score: number } | null = null;
  for (const rule of rules) {
    let score = 0;
    for (const raw of rule.keywords) {
      const keyword = normalizeWords(raw);
      score +=
        WEIGHTS.section * Math.min(1, countHits(section, keyword)) +
        WEIGHTS.title * Math.min(1, countHits(title, keyword)) +
        WEIGHTS.body * Math.min(MAX_BODY_HITS, countHits(body, keyword));
    }
    if (score > 0 && (!best || score > best.score)) best = { category: rule.category, score };
  }
  return best?.category ?? fallback;
}

// ---- Saved rules (per role, in localStorage) ----

const storageKey = (roleId: RoleId) => `gaea_import_rules:${roleId}`;

// Saved rules for the role's current categories; categories without saved rules use the defaults
export function loadImportRules(roleId: RoleId): ImportRule[] {
  const defaults = defaultImportRules(roleId);
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(roleId)) ?? 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    const byCategory = saved as Record<string, unknown>;
    return defaults.map((rule) => {
      const keywords = byCategory[rule.category];
      return Array.isArray(keywords)
        ? { category: rule.category, keywords: keywords.filter((k): k is string => typeof k === 'string') }
        : rule;
    });
  } catch {
    return defaults;
  }
}

export function saveImportRules(roleId: RoleId, rules: ImportRule[] | null) {
  try {
    if (rules === null) localStorage.removeItem(storageKey(roleId));
    else localStorage.setItem(storageKey(roleId), JSON.stringify(Object.fromEntries(rules.map((r) => [r.category, r.keywords]))));
  } catch {
    // Not persisted; the rules still apply to this import
  }
}

// "city, Capital city ,, town" -> ["city", "capital city", "town"]
export function parseKeywordList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(',')
        .map((k) => k.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter(Boolean)
    )
  );
}

// What a new article starts with, per category: properties (with optional default
// values) and section headings. Every category has a built-in template chosen by
// keywords in its name, so all workspace roles and custom categories get sensible
// fields; users can replace a category's template, which is saved on this device
// (like the import rules).
import { EntityProperty, LoreArticle } from './database';
import { htmlToPlainText } from './search';

export type CategoryTemplate = { properties: EntityProperty[]; sections: string[] };

const t = (properties: string[], sections: string[]): CategoryTemplate => ({
  properties: properties.map((p) => {
    const [key, value = ''] = p.split('=');
    return { key, value };
  }),
  sections,
});

// First match wins; keep the vocabulary generic (see importRules.ts)
const DEFAULTS: [RegExp, CategoryTemplate][] = [
  [/character|cast|npc|people|contact|player/i, t(['Role', 'Affiliation', 'Status=Alive'], ['Appearance', 'Personality', 'Background'])],
  [/bestiary|monster|species|creature/i, t(['Habitat', 'Threat Level', 'Diet'], ['Appearance', 'Behavior', 'Lore'])],
  [/location|realm|level|biome|dungeon|place|region/i, t(['Type', 'Region', 'Ruler'], ['Description', 'History', 'Points of Interest'])],
  [/faction|kingdom|guild|organi[sz]ation/i, t(['Leader', 'Headquarters', 'Goals'], ['Overview', 'Structure', 'Relations'])],
  [/spell|magic|relic|artifact|weapon|item|gear/i, t(['Type', 'Rarity', 'Owner'], ['Description', 'Properties', 'History'])],
  [/system|mechanic/i, t(['Purpose', 'Status=Draft'], ['Overview', 'Rules', 'Balancing Notes'])],
  [/quest|dialogue|encounter/i, t(['Location', 'Reward', 'Status=Draft'], ['Summary', 'Steps', 'Outcome'])],
  [/plot|chapter|session|journal|daily/i, t(['Date', 'Status=Draft'], ['Summary', 'Key Events', 'Notes'])],
  [/project|roadmap/i, t(['Owner', 'Deadline', 'Status=Planned'], ['Goals', 'Tasks', 'Notes'])],
  [/concept|idea|research|reference/i, t(['Source', 'Status=Draft'], ['Summary', 'Details', 'Related'])],
];
// Categories nothing above matches start the way all articles used to
const FALLBACK = t(['Status=Draft'], []);

export function defaultTemplate(category: string): CategoryTemplate {
  return DEFAULTS.find(([pattern]) => pattern.test(category))?.[1] ?? FALLBACK;
}

export type SavedTemplates = Record<string, CategoryTemplate>;

export function templateForCategory(category: string, saved: SavedTemplates): { template: CategoryTemplate; isCustom: boolean } {
  const custom = saved[category];
  return custom ? { template: custom, isCustom: true } : { template: defaultTemplate(category), isCustom: false };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A new article in the category's shape. Every article also records when it was created.
export function createArticleFromTemplate(
  data: { title: string; category: string; tags: string[] },
  template: CategoryTemplate,
  timestamp = Date.now()
): LoreArticle {
  const title = escapeHtml(data.title);
  const body = template.sections.length
    ? template.sections.map((s) => `<h2>${escapeHtml(s)}</h2><p></p>`).join('')
    : `<p>Start detailing your lore for ${title}...</p>`;
  const properties = [...template.properties.map((p) => ({ ...p }))];
  if (!properties.some((p) => p.key.toLowerCase() === 'created')) {
    properties.push({ key: 'Created', value: new Date(timestamp).toLocaleDateString() });
  }
  return {
    id: `${data.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`,
    title: data.title,
    category: data.category,
    content: `<h1>${title}</h1>${body}`,
    tags: data.tags,
    properties,
    isPinned: false,
    last_updated: timestamp,
  };
}

// An existing article's shape as a template: its property names (not their values,
// which belong to that article) and its section headings
export function templateFromArticle(article: LoreArticle): CategoryTemplate {
  const sections = Array.from(article.content.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi))
    .map((m) => htmlToPlainText(m[1]))
    .filter(Boolean);
  return {
    properties: article.properties
      .filter((p) => p.key.trim() && p.key.trim().toLowerCase() !== 'created')
      .map((p) => ({ key: p.key.trim(), value: '' })),
    sections: Array.from(new Set(sections)),
  };
}

// ---- Editing as text: "Key" or "Key: default value" per line; one heading per line ----

export function propertiesToText(properties: EntityProperty[]): string {
  return properties.map((p) => (p.value ? `${p.key}: ${p.value}` : p.key)).join('\n');
}

export function parseTemplateText(propertiesText: string, sectionsText: string): CategoryTemplate {
  const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const properties: EntityProperty[] = [];
  for (const line of lines(propertiesText)) {
    const colon = line.indexOf(':');
    const key = (colon === -1 ? line : line.slice(0, colon)).trim();
    const value = colon === -1 ? '' : line.slice(colon + 1).trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    properties.push({ key, value });
  }
  return { properties, sections: Array.from(new Set(lines(sectionsText))) };
}

// ---- Saved on this device ----

const STORAGE_KEY = 'gaea_category_templates';

const isTemplate = (v: unknown): v is CategoryTemplate =>
  !!v &&
  typeof v === 'object' &&
  Array.isArray((v as CategoryTemplate).properties) &&
  (v as CategoryTemplate).properties.every((p) => p && typeof p.key === 'string' && typeof p.value === 'string') &&
  Array.isArray((v as CategoryTemplate).sections) &&
  (v as CategoryTemplate).sections.every((s) => typeof s === 'string');

export function loadTemplates(): SavedTemplates {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, v]) => isTemplate(v))) as SavedTemplates;
  } catch {
    return {};
  }
}

// Save a category's template, or pass null to go back to the built-in one
export function saveTemplate(category: string, template: CategoryTemplate | null): SavedTemplates {
  const all = loadTemplates();
  if (template) all[category] = template;
  else delete all[category];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable: the template still applies until reload
  }
  return all;
}

// Colors for article categories (3D world web, category chips). Matched by
// keywords so every role's categories, and custom ones, get a sensible color.

export type CategoryColor = {
  hex: number; // three.js color
  css: string;
  emissive: number;
};

type Bucket = 'character' | 'bestiary' | 'location' | 'faction' | 'magic' | 'item' | 'story' | 'notes';

const COLORS: Record<Bucket, CategoryColor> = {
  character: { hex: 0xf59e0b, css: '#f59e0b', emissive: 0xb45309 }, // amber
  bestiary: { hex: 0xf97316, css: '#f97316', emissive: 0xc2410c }, // orange
  location: { hex: 0x10b981, css: '#10b981', emissive: 0x047857 }, // emerald
  faction: { hex: 0x8b5cf6, css: '#8b5cf6', emissive: 0x6d28d9 }, // violet
  magic: { hex: 0x06b6d4, css: '#06b6d4', emissive: 0x0e7490 }, // cyan
  item: { hex: 0xf43f5e, css: '#f43f5e', emissive: 0xbe123c }, // rose
  story: { hex: 0x38bdf8, css: '#38bdf8', emissive: 0x0369a1 }, // sky
  notes: { hex: 0x94a3b8, css: '#94a3b8', emissive: 0x475569 }, // slate
};

// First match wins, so "Magic & Relics" is magic and "Weapons & Items" is an item
const RULES: [RegExp, Bucket][] = [
  [/character|cast|npc|people|contact/i, 'character'],
  [/bestiary|monster|species|creature/i, 'bestiary'],
  [/location|realm|level|biome|dungeon|place|map/i, 'location'],
  [/faction|kingdom|guild|organi[sz]ation|project/i, 'faction'],
  [/magic|spell|system|mechanic|technolog|concept|idea/i, 'magic'],
  [/relic|artifact|weapon|item|gear|research|reference/i, 'item'],
  [/plot|chapter|quest|dialogue|session|encounter|journal|daily|campaign/i, 'story'],
];

export function categoryColor(category: string): CategoryColor {
  const bucket = RULES.find(([pattern]) => pattern.test(category))?.[1] ?? 'notes';
  return COLORS[bucket];
}

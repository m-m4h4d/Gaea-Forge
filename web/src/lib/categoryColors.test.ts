import { describe, expect, it } from 'vitest';
import { categoryColor } from './categoryColors';
import { ROLES } from './roles';

describe('categoryColor', () => {
  it.each(Object.values(ROLES).map((r) => [r.id, r.categories] as const))(
    'gives each %s category a distinct color',
    (_id, categories) => {
      const colors = categories.map((c) => categoryColor(c).css);
      expect(new Set(colors).size).toBe(categories.length);
    }
  );

  it('resolves overlapping keywords in priority order', () => {
    expect(categoryColor('Magic & Relics')).toEqual(categoryColor('Spells & Magic Items'));
    expect(categoryColor('Weapons & Items')).toEqual(categoryColor('Artifacts'));
    expect(categoryColor('Player Characters & NPCs')).toEqual(categoryColor('Characters'));
  });

  it('falls back to a neutral color for unknown categories', () => {
    expect(categoryColor('Archive & Snippets')).toEqual(categoryColor(''));
  });
});

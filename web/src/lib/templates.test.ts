import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoreArticle } from './database';
import { ROLES } from './roles';
import {
  createArticleFromTemplate,
  defaultTemplate,
  loadTemplates,
  parseTemplateText,
  propertiesToText,
  saveTemplate,
  templateForCategory,
  templateFromArticle,
} from './templates';

describe('defaultTemplate', () => {
  it('gives every role category a template of its own kind', () => {
    expect(defaultTemplate('Characters & Cast').sections).toEqual(['Appearance', 'Personality', 'Background']);
    expect(defaultTemplate('Monsters & Bestiary').properties.map((p) => p.key)).toContain('Habitat');
    expect(defaultTemplate('Levels & Biomes').sections).toContain('Points of Interest');
    expect(defaultTemplate('Weapons & Items').properties.map((p) => p.key)).toEqual(['Type', 'Rarity', 'Owner']);
    expect(defaultTemplate('Game Systems & Mechanics').sections).toContain('Rules');
    expect(defaultTemplate('Projects & Roadmaps').properties).toContainEqual({ key: 'Status', value: 'Planned' });
    // Every category of every role starts with some fields
    for (const role of Object.values(ROLES)) {
      for (const category of role.categories) {
        const template = defaultTemplate(category);
        expect(template.properties.length, category).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the old draft shape for unknown categories', () => {
    expect(defaultTemplate('Miscellany')).toEqual({ properties: [{ key: 'Status', value: 'Draft' }], sections: [] });
  });
});

describe('createArticleFromTemplate', () => {
  const at = new Date(2026, 0, 2).getTime();
  it('adds the properties, a Created date and empty sections', () => {
    const a = createArticleFromTemplate({ title: 'Queen <Mira>', category: 'Characters & Cast', tags: ['royal'] }, defaultTemplate('Characters'), at);
    expect(a.id).toBe(`characters---cast-${at}`);
    expect(a.content).toBe('<h1>Queen &lt;Mira&gt;</h1><h2>Appearance</h2><p></p><h2>Personality</h2><p></p><h2>Background</h2><p></p>');
    expect(a.properties).toEqual([
      { key: 'Role', value: '' },
      { key: 'Affiliation', value: '' },
      { key: 'Status', value: 'Alive' },
      { key: 'Created', value: new Date(at).toLocaleDateString() },
    ]);
    expect(a.tags).toEqual(['royal']);
  });

  it('keeps the placeholder paragraph when there are no sections, and never shares property objects', () => {
    const template = defaultTemplate('Miscellany');
    const a = createArticleFromTemplate({ title: 'X', category: 'Miscellany', tags: [] }, template, at);
    expect(a.content).toBe('<h1>X</h1><p>Start detailing your lore for X...</p>');
    a.properties[0].value = 'Changed';
    expect(template.properties[0].value).toBe('Draft');
  });

  it("doesn't add a second Created property", () => {
    const a = createArticleFromTemplate({ title: 'X', category: 'C', tags: [] }, { properties: [{ key: 'created', value: '' }], sections: [] }, at);
    expect(a.properties).toEqual([{ key: 'created', value: '' }]);
  });
});

describe('templateFromArticle', () => {
  it('takes property names (not values) and section headings', () => {
    const article: LoreArticle = {
      id: 'a', title: 'Mira', category: 'Characters', tags: [], isPinned: false, last_updated: 0,
      content: '<h1>Mira</h1><h2>Look</h2><p>Tall.</p><h2>Deeds &amp; <em>Feats</em></h2><h2>Look</h2>',
      properties: [{ key: 'Age', value: '34' }, { key: 'Created', value: 'today' }, { key: ' ', value: 'x' }],
    };
    expect(templateFromArticle(article)).toEqual({ properties: [{ key: 'Age', value: '' }], sections: ['Look', 'Deeds & Feats'] });
  });
});

describe('template text', () => {
  it('round-trips properties with and without defaults, dropping blanks and duplicates', () => {
    const template = defaultTemplate('Characters');
    expect(parseTemplateText(propertiesToText(template.properties), template.sections.join('\n'))).toEqual(template);
    expect(parseTemplateText('Age\n\n age: 3\nMotto: Ever: onward\n: x', ' A \nA\nB')).toEqual({
      properties: [{ key: 'Age', value: '' }, { key: 'Motto', value: 'Ever: onward' }],
      sections: ['A', 'B'],
    });
  });
});

describe('saved templates', () => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  afterEach(() => store.clear());

  it('saves, applies and resets a custom template per category', () => {
    const custom = { properties: [{ key: 'Ship', value: '' }], sections: ['Voyages'] };
    saveTemplate('Characters & Cast', custom);
    expect(templateForCategory('Characters & Cast', loadTemplates())).toEqual({ template: custom, isCustom: true });
    expect(templateForCategory('Realms & Locations', loadTemplates()).isCustom).toBe(false);
    saveTemplate('Characters & Cast', null);
    expect(templateForCategory('Characters & Cast', loadTemplates()).isCustom).toBe(false);
  });

  it('ignores corrupt or malformed saved data', () => {
    store.set('gaea_category_templates', '{oops');
    expect(loadTemplates()).toEqual({});
    store.set('gaea_category_templates', JSON.stringify({ A: { properties: 'x', sections: [] }, B: { properties: [], sections: ['S'] } }));
    expect(loadTemplates()).toEqual({ B: { properties: [], sections: ['S'] } });
  });
});

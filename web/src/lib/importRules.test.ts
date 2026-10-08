// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  categoryKind,
  classifyEntry,
  defaultImportRules,
  fallbackCategory,
  ImportRule,
  loadImportRules,
  parseKeywordList,
  saveImportRules,
} from './importRules';
import { ROLES } from './roles';

const entry = (over: Partial<{ title: string; sectionContext: string; body: string }>) => ({
  title: '',
  sectionContext: '',
  body: '',
  ...over,
});

describe('defaultImportRules', () => {
  it('covers every category of every role, with keywords from the category name', () => {
    for (const role of Object.values(ROLES)) {
      const rules = defaultImportRules(role.id);
      expect(rules.map((r) => r.category)).toEqual(role.categories);
      for (const rule of rules) expect(rule.keywords.length).toBeGreaterThan(0);
    }
    const npcRule = defaultImportRules('game-dev').find((r) => r.category === 'Characters & NPCs')!;
    expect(npcRule.keywords).toEqual(expect.arrayContaining(['character', 'npc']));
  });

  it('keeps words that only look plural', () => {
    const species = defaultImportRules('author-bible').find((r) => r.category === 'Bestiary & Species')!;
    expect(species.keywords).toContain('species');
    expect(species.keywords).not.toContain('specy');
    expect(classifyEntry(entry({ body: 'A species of drake' }), [{ category: 'S', keywords: ['species'] }], 'N')).toBe('S');
  });

  it('detects the kind of content from category names', () => {
    expect(categoryKind('Magic & Relics')).toBe('magic');
    expect(categoryKind('Weapons & Items')).toBe('item');
    expect(categoryKind('Monsters & Bestiary')).toBe('creature');
    expect(categoryKind('Archive & Snippets')).toBe('notes');
  });
});

describe('fallbackCategory', () => {
  it("uses the role's notes-like category", () => {
    expect(fallbackCategory('personal-notes')).toBe('Archive & Snippets');
    expect(fallbackCategory('author-bible')).toBe('Plot & Chapters');
    expect(fallbackCategory('ttrpg-dm')).toBe('Session Logs & Encounters');
  });
});

describe('classifyEntry', () => {
  const rules: ImportRule[] = [
    { category: 'People', keywords: ['person', 'captain'] },
    { category: 'Places', keywords: ['city', 'capital city'] },
  ];

  it('weights the section heading above the title, and the title above the body', () => {
    expect(classifyEntry(entry({ sectionContext: 'Persons of note', body: 'a city, a city, a city' }), rules, 'Notes')).toBe('People');
    expect(classifyEntry(entry({ title: 'Captain Vale', body: 'born in the city' }), rules, 'Notes')).toBe('People');
  });

  it('matches plurals and multi-word keywords', () => {
    expect(classifyEntry(entry({ body: 'Two great cities.' }), rules, 'Notes')).toBe('Places');
    expect(classifyEntry(entry({ body: 'Capital city of the north' }), [{ category: 'X', keywords: ['capital city'] }], 'Notes')).toBe('X');
    expect(classifyEntry(entry({ body: 'the capital is a city' }), [{ category: 'X', keywords: ['capital city'] }], 'Notes')).toBe('Notes');
  });

  it('matches whole words only', () => {
    expect(classifyEntry(entry({ body: 'Unpersonable cityscape' }), rules, 'Notes')).toBe('Notes');
  });

  it('breaks ties by rule order and falls back when nothing matches', () => {
    expect(classifyEntry(entry({ body: 'person city' }), rules, 'Notes')).toBe('People');
    expect(classifyEntry(entry({ title: 'Untitled', body: 'Nothing relevant here.' }), rules, 'Notes')).toBe('Notes');
  });

  it('lets a user keyword pull entries into a category', () => {
    const custom = [...rules, { category: 'Gemstones', keywords: ['gemstone', 'stone of'] }];
    expect(classifyEntry(entry({ title: 'Stone of Embers', body: 'warm' }), custom, 'Notes')).toBe('Gemstones');
  });
});

describe('saved rules', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to defaults, and saves and resets per role', () => {
    expect(loadImportRules('author-bible')).toEqual(defaultImportRules('author-bible'));

    const edited = defaultImportRules('author-bible').map((r) =>
      r.category === 'Magic & Relics' ? { ...r, keywords: ['gemstone'] } : r
    );
    saveImportRules('author-bible', edited);
    expect(loadImportRules('author-bible')).toEqual(edited);
    expect(loadImportRules('game-dev')).toEqual(defaultImportRules('game-dev'));

    saveImportRules('author-bible', null);
    expect(loadImportRules('author-bible')).toEqual(defaultImportRules('author-bible'));
  });

  it('ignores corrupt saved data', () => {
    localStorage.setItem('gaea_import_rules:author-bible', '{not json');
    expect(loadImportRules('author-bible')).toEqual(defaultImportRules('author-bible'));
  });
});

describe('parseKeywordList', () => {
  it('splits, trims, lowercases and de-duplicates', () => {
    expect(parseKeywordList(' City, capital   city,, city ,Town')).toEqual(['city', 'capital city', 'town']);
  });
});

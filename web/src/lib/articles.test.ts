import { describe, expect, it } from 'vitest';
import { LoreArticle } from './database';
import {
  createArticleDraft,
  createRoleSampleArticle,
  filterArticles,
  isCharacterCategory,
  mergeCategories,
} from './articles';

const article = (overrides: Partial<LoreArticle>): LoreArticle => ({
  id: 'a',
  title: 'Untitled',
  category: 'Notes',
  content: '',
  tags: [],
  properties: [],
  last_updated: 0,
  ...overrides,
});

describe('filterArticles', () => {
  const articles = [
    article({ id: '1', title: 'Queen Mira', tags: ['royalty'] }),
    article({ id: '2', title: 'Ashfall', tags: ['city'] }),
  ];

  it('keeps articles with the tag, or all of them without a filter', () => {
    expect(filterArticles(articles, 'city').map((a) => a.id)).toEqual(['2']);
    expect(filterArticles(articles, null)).toBe(articles);
  });
});

describe('isCharacterCategory', () => {
  it.each(['Characters', 'Characters & Cast', 'Characters & NPCs', 'Notable People'])('accepts %s', (c) => {
    expect(isCharacterCategory(c)).toBe(true);
  });
  it.each(['Locations', 'Magic & Relics'])('rejects %s', (c) => {
    expect(isCharacterCategory(c)).toBe(false);
  });
});

describe('mergeCategories', () => {
  it('keeps role categories first, then other used categories, without duplicates or blanks', () => {
    const merged = mergeCategories(
      ['Characters', 'Locations'],
      [article({ category: 'Locations' }), article({ category: 'Old Notes' }), article({ category: '' })]
    );
    expect(merged).toEqual(['Characters', 'Locations', 'Old Notes']);
  });
});

describe('createArticleDraft', () => {
  it('builds a slugged id and escapes the title in its HTML', () => {
    const draft = createArticleDraft({ title: '<b>Mira</b>', category: 'Kingdoms & Factions', tags: ['x'] });
    expect(draft.id).toMatch(/^kingdoms---factions-\d+$/);
    expect(draft.content).toContain('&lt;b&gt;Mira&lt;/b&gt;');
    expect(draft.content).not.toContain('<b>');
    expect(draft.tags).toEqual(['x']);
  });
});

describe('createRoleSampleArticle', () => {
  it('creates a pinned article in one of the role’s categories', () => {
    const sample = createRoleSampleArticle('game-dev');
    expect(sample.isPinned).toBe(true);
    expect(sample.id).toMatch(/^starter-game-dev-\d+$/);
  });
});

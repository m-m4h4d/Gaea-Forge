import { describe, expect, it, vi } from 'vitest';
import { LoreArticle } from './database';
import { ArticleSearchIndex, articleBodyText, createArticleSearch, htmlToPlainText, makeSnippet } from './search';

const article = (over: Partial<LoreArticle>): LoreArticle => ({
  id: 'x',
  title: 'Untitled',
  category: 'Characters',
  content: '',
  tags: [],
  properties: [],
  isPinned: false,
  last_updated: 0,
  ...over,
});

describe('htmlToPlainText', () => {
  it('drops markup and attributes but keeps link labels', () => {
    expect(htmlToPlainText('<h1>Queen Mira</h1><p>Rules from <a data-lore-link="article-ashfall-123">Ashfall</a>.</p>')).toBe(
      'Queen Mira Rules from Ashfall.'
    );
  });

  it('separates words at block tags but not inside inline formatting', () => {
    expect(htmlToPlainText('<p>one</p><p>two</p><ul><li>three</li></ul>')).toBe('one two three');
    expect(htmlToPlainText('<p>Ash<strong>fall</strong> burns</p>')).toBe('Ashfall burns');
  });

  it('decodes entities', () => {
    expect(htmlToPlainText('<p>Salt &amp; Steel &lt;3&gt; &#233;t&#xe9; &#x2014; ok&nbsp;now</p>')).toBe(
      'Salt & Steel <3> été — ok now'
    );
  });
});

describe('articleBodyText', () => {
  it('leaves out the leading copy of the title', () => {
    expect(articleBodyText({ title: 'Ashfall', content: '<h1>Ashfall</h1><p>A volcanic city.</p>' })).toBe('A volcanic city.');
    expect(articleBodyText({ title: 'Ash', content: '<h1>Ashfall</h1><p>City.</p>' })).toBe('Ashfall City.');
    expect(articleBodyText({ title: 'Ashfall', content: '<p>Ashfall burns.</p>' })).toBe('burns.');
  });
});

describe('makeSnippet', () => {
  const text = 'The northern wastes are cold. Far to the south, the dragon Vyrnax sleeps beneath the volcanic peaks of Ashfall, dreaming of fire and of the queen who bound it.';

  it('shows the match with context, cut at word boundaries', () => {
    const s = makeSnippet(text, [['dragon']])!;
    expect(s.match).toBe('dragon');
    expect(s.before.startsWith('…')).toBe(true);
    expect(s.before.endsWith('the ')).toBe(true);
    expect(s.after.endsWith('…')).toBe(true);
    // Both ends fall on word boundaries
    expect(text).toContain(` ${s.before.slice(1)}`);
    expect(text).toContain(`${s.after.slice(0, -1)} `);
  });

  it('prefers earlier groups and the earliest match within a group', () => {
    expect(makeSnippet(text, [['queen who'], ['cold']])!.match).toBe('queen who');
    expect(makeSnippet(text, [['nothing here'], ['ashfall', 'cold']])!.match).toBe('cold');
  });

  it('matches accented text with folded terms and keeps the original spelling', () => {
    expect(makeSnippet('Lady Éowyn rides', [['eowyn']])!.match).toBe('Éowyn');
  });

  it('returns null when nothing matches', () => {
    expect(makeSnippet(text, [['griffin']])).toBeNull();
  });
});

describe('createArticleSearch', () => {
  const articles = [
    article({ id: 'mira', title: 'Queen Mira', tags: ['royalty'], content: '<p>Ruler of <a data-lore-link="ashfall">Ashfall</a>.</p>' }),
    article({ id: 'ashfall', title: 'Ashfall', content: '<p>A volcanic city where the dragon sleeps.</p>', tags: ['city'] }),
    article({ id: 'blade', title: 'Blade', properties: [{ key: 'Forged by', value: 'Dwarves' }] }),
    article({ id: 'vyrnax', title: 'Vyrnax the Dragon', content: '<p>Sleeps beneath Ashfall.</p>' }),
    article({ id: 'eowyn', title: 'Éowyn', content: '<p>A shieldmaiden.</p>' }),
  ];
  const search = createArticleSearch(articles);
  const ids = (q: string, tag: string | null = null) => search(q, tag).map((h) => h.article.id);

  it('returns nothing for an empty query', () => {
    expect(search('   ')).toEqual([]);
  });

  it('finds titles, text, tags and properties', () => {
    expect(ids('MIRA')).toEqual(['mira']);
    expect(ids('volcanic')).toEqual(['ashfall']);
    expect(ids('royal')).toEqual(['mira']); // prefix of a tag
    expect(ids('dwarves')).toEqual(['blade']);
    expect(ids('forged')).toEqual(['blade']);
  });

  it('never matches markup: link ids and tag names are not text', () => {
    expect(ids('data')).toEqual([]);
    expect(ids('lore')).toEqual([]);
    expect(ids('href')).toEqual([]);
    // "ashfall" appears in Mira's link id and label, but the title match ranks first
    expect(ids('ashfall')[0]).toBe('ashfall');
  });

  it('ranks title matches above mentions in the text', () => {
    expect(ids('dragon')).toEqual(['vyrnax', 'ashfall']);
  });

  it('tolerates a typo in longer words and ignores accents', () => {
    expect(ids('dragn')).toEqual(['vyrnax', 'ashfall']);
    expect(ids('drahon')).toEqual(['vyrnax', 'ashfall']);
    expect(ids('vulcanic')).toEqual(['ashfall']);
    // Short words have to be exact, or "mira" would match "mara", "myra", ...
    expect(ids('mra')).toEqual([]);
    expect(ids('eowyn')).toEqual(['eowyn']);
  });

  it('requires every word of the query', () => {
    expect(ids('dragon sleeps')).toEqual(['vyrnax', 'ashfall']);
    expect(ids('dragon dwarves')).toEqual([]);
  });

  it('combines the query with an exact tag filter', () => {
    expect(ids('ashfall', 'city')).toEqual(['ashfall']);
    expect(ids('mira', 'city')).toEqual([]);
  });

  it('gives a snippet from the text when the text matches', () => {
    const [hit] = search('volcanic');
    expect(hit.snippet).toEqual({ before: 'A ', match: 'volcanic', after: ' city where the dragon sleeps.' });
    // A title-only match has no text snippet, even when the text repeats the title
    expect(search('blade')[0].snippet).toBeNull();
    const titled = createArticleSearch([article({ id: 't', title: 'Vyrnax the Dragon', content: '<h1>Vyrnax the Dragon</h1><p>Sleeps.</p>' })]);
    expect(titled('dragon')[0].snippet).toBeNull();
  });
});

describe('ArticleSearchIndex.sync', () => {
  const titles = (index: ArticleSearchIndex, q: string) => index.search(q).map((h) => h.article.title);

  it('follows edits, additions and deletions', () => {
    const mira = article({ id: 'mira', title: 'Queen Mira', content: '<p>Rules the north.</p>' });
    const ash = article({ id: 'ash', title: 'Ashfall' });
    const index = new ArticleSearchIndex().sync([mira, ash]);
    expect(titles(index, 'north')).toEqual(['Queen Mira']);

    // An edit replaces the article object
    const edited = { ...mira, content: '<p>Rules the south.</p>' };
    index.sync([edited, ash]);
    expect(titles(index, 'north')).toEqual([]);
    expect(titles(index, 'south')).toEqual(['Queen Mira']);
    // Hits carry the current article object
    expect(index.search('south')[0].article).toBe(edited);

    const ember = article({ id: 'ember', title: 'Emberfall', content: '<p>South of the wall.</p>' });
    index.sync([edited, ember]);
    expect(titles(index, 'south').sort()).toEqual(['Emberfall', 'Queen Mira']);
    expect(titles(index, 'ashfall')).toEqual([]);
  });

  it('only re-indexes articles whose object changed', () => {
    const a = article({ id: 'a', title: 'Alpha' });
    const b = article({ id: 'b', title: 'Beta' });
    const index = new ArticleSearchIndex().sync([a, b]);
    const replace = vi.spyOn(index['index'], 'replace');
    const add = vi.spyOn(index['index'], 'add');
    index.sync([a, b]);
    expect(replace).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    index.sync([a, { ...b, title: 'Beta Prime' }]);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace.mock.calls[0][0].id).toBe('b');
    expect(titles(index, 'prime')).toEqual(['Beta Prime']);
  });

  it('ignores a duplicated id instead of failing', () => {
    const a = article({ id: 'a', title: 'Alpha' });
    expect(() => new ArticleSearchIndex().sync([a, { ...a }])).not.toThrow();
  });
});

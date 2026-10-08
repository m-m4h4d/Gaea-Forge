import { describe, expect, it } from 'vitest';
import { LoreArticle } from './database';
import {
  computeBacklinks,
  computeLinkPairs,
  createTitleResolver,
  extractLinkedArticleIds,
  linkHtml,
  resolveImportedWikiLinks,
  resolveWikiLinks,
} from './links';

const article = (id: string, title: string, content = ''): LoreArticle => ({
  id,
  title,
  category: 'Notes',
  content,
  tags: [],
  properties: [],
  last_updated: 0,
});

describe('linkHtml / extractLinkedArticleIds', () => {
  it('round-trips ids and escapes labels', () => {
    const html = `<p>${linkHtml('a"1', '<Mira>')} and ${linkHtml('b', 'Ash')} and ${linkHtml('a"1', 'again')}</p>`;
    expect(html).toContain('>&lt;Mira&gt;</a>');
    expect(extractLinkedArticleIds(html)).toEqual(['a"1', 'b']);
  });

  it('reads links whatever other attributes the editor adds', () => {
    expect(extractLinkedArticleIds('<a class="lore-link" data-lore-link="x" title="X">X</a>')).toEqual(['x']);
  });

  it('ignores ordinary links', () => {
    expect(extractLinkedArticleIds('<a href="https://example.com">site</a>')).toEqual([]);
  });
});

describe('computeBacklinks', () => {
  it('lists each source once per target and ignores self-links', () => {
    const articles = [
      article('a', 'A', linkHtml('b', 'B') + linkHtml('b', 'B again') + linkHtml('a', 'me')),
      article('b', 'B'),
      article('c', 'C', linkHtml('b', 'B')),
    ];
    const backlinks = computeBacklinks(articles);
    expect(backlinks.get('b')?.map((a) => a.id)).toEqual(['a', 'c']);
    expect(backlinks.has('a')).toBe(false);
  });

  it('keeps backlinks to deleted articles so callers can show them', () => {
    const backlinks = computeBacklinks([article('a', 'A', linkHtml('gone', 'Gone'))]);
    expect(backlinks.get('gone')?.map((a) => a.id)).toEqual(['a']);
  });
});

describe('computeLinkPairs', () => {
  it('returns one unordered pair per linked couple, skipping missing targets', () => {
    const pairs = computeLinkPairs([
      article('b', 'B', linkHtml('a', 'A')),
      article('a', 'A', linkHtml('b', 'B') + linkHtml('missing', '?')),
      article('c', 'C', linkHtml('c', 'self')),
    ]);
    expect(pairs).toEqual([['a', 'b']]);
  });
});

describe('createTitleResolver', () => {
  it('matches titles ignoring case and extra whitespace, first article wins', () => {
    const resolve = createTitleResolver([
      { id: '1', title: 'Queen  Mira' },
      { id: '2', title: 'queen mira' },
      { id: '3', title: '  ' },
    ]);
    expect(resolve('queen mira')).toBe('1');
    expect(resolve(' QUEEN MIRA ')).toBe('1');
    expect(resolve('')).toBeUndefined();
    expect(resolve('Nobody')).toBeUndefined();
  });
});

describe('resolveWikiLinks', () => {
  const resolve = createTitleResolver([
    { id: 'mira', title: 'Queen Mira' },
    { id: 'ash', title: 'Ash & Ember' },
  ]);

  it('links plain and aliased references', () => {
    expect(resolveWikiLinks('<p>See [[Queen Mira]] and [[queen mira|the Queen]].</p>', resolve)).toBe(
      `<p>See ${linkHtml('mira', 'Queen Mira')} and ${linkHtml('mira', 'the Queen')}.</p>`
    );
  });

  it('resolves titles that were HTML-escaped during import', () => {
    expect(resolveWikiLinks('<p>[[Ash &amp; Ember]]</p>', resolve)).toBe(`<p>${linkHtml('ash', 'Ash & Ember')}</p>`);
  });

  it('leaves unknown and malformed references untouched', () => {
    const html = '<p>[[Nobody]] [[]] [[Queen Mira</p>';
    expect(resolveWikiLinks(html, resolve)).toBe(html);
  });
});

describe('resolveImportedWikiLinks', () => {
  it('prefers imported titles, falls back to existing ones, and keeps untouched articles as-is', () => {
    const existing = [article('old-mira', 'Mira'), article('old-ash', 'Ash')];
    const plain = article('new-plain', 'Plain', '<p>No links</p>');
    const imported = [
      article('new-mira', 'Mira'),
      article('new-notes', 'Notes', '<p>[[Mira]] visited [[Ash]] and [[Nowhere]]</p>'),
      plain,
    ];
    const [, notes, plainOut] = resolveImportedWikiLinks(imported, existing);
    expect(extractLinkedArticleIds(notes.content)).toEqual(['new-mira', 'old-ash']);
    expect(notes.content).toContain('[[Nowhere]]');
    expect(plainOut).toBe(plain);
  });
});

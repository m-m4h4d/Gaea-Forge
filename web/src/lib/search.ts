// Ranked full-text search over articles. Article HTML is reduced to plain text before
// indexing, so markup (tags, attributes, link ids) never matches a query.
import MiniSearch from 'minisearch';
import { LoreArticle } from './database';

// Tags that separate words; inline tags (<b>, <a>, ...) can sit inside a word
const BLOCK_TAG = /<\/?(?:p|div|h[1-6]|li|ul|ol|br|hr|blockquote|pre|table|thead|tbody|tr|td|th|section|article|figure|figcaption)\b[^>]*>/gi;
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(BLOCK_TAG, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// Lowercase and drop accents, so "eowyn" finds "Éowyn"
const normalizeTerm = (term: string) => term.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export type Snippet = { before: string; match: string; after: string };
export type SearchHit = { article: LoreArticle; score: number; snippet: Snippet | null };

const SNIPPET_BEFORE = 40;
const SNIPPET_AFTER = 80;

// Where the text mentions the search, with some context. termGroups are tried in
// order (e.g. the whole phrase, then its words); within a group the earliest wins.
export function makeSnippet(text: string, termGroups: string[][]): Snippet | null {
  const folded = normalizeTerm(text);
  // Folding can change the length (e.g. ligatures); only use it when it doesn't
  const haystack = folded.length === text.length ? folded : text.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const group of termGroups) {
    for (const term of group) {
      if (!term) continue;
      const index = haystack.indexOf(term);
      if (index !== -1 && (!best || index < best.index)) best = { index, length: term.length };
    }
    if (best) break;
  }
  if (!best) return null;

  let start = Math.max(0, best.index - SNIPPET_BEFORE);
  if (start > 0) start = text.indexOf(' ', start) + 1 || start; // don't cut a word
  if (start > best.index) start = best.index;
  const matchEnd = best.index + best.length;
  let end = Math.min(text.length, matchEnd + SNIPPET_AFTER);
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > matchEnd) end = space;
  }
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, best.index),
    match: text.slice(best.index, matchEnd),
    after: text.slice(matchEnd, end) + (end < text.length ? '…' : ''),
  };
}

// Articles usually open with their title as a heading; the title is indexed (and
// shown) on its own, so leave it out of the text
export function articleBodyText(article: Pick<LoreArticle, 'title' | 'content'>): string {
  const text = htmlToPlainText(article.content);
  const title = article.title.trim();
  if (title && text.startsWith(title) && (text.length === title.length || text[title.length] === ' ')) {
    return text.slice(title.length).trimStart();
  }
  return text;
}

type IndexedArticle = { id: string; title: string; tags: string; properties: string; content: string };

const toIndexed = (a: LoreArticle, plain: string): IndexedArticle => ({
  id: a.id,
  title: a.title,
  tags: a.tags.join(' '),
  properties: a.properties.map((p) => `${p.key} ${p.value}`).join(' '),
  content: plain,
});

// A search index kept in step with the articles. sync() re-indexes only the articles
// whose object changed (edits replace the object), so it stays cheap while typing in
// an article; building it from scratch takes about 1s for 2,000 long articles.
// Ranking: relevance (BM25), weighted title > tags > properties > content; whole-word
// and exact-title matches rank above prefix and typo-tolerant ones.
export class ArticleSearchIndex {
  private index = new MiniSearch<IndexedArticle>({
    fields: ['title', 'tags', 'properties', 'content'],
    processTerm: normalizeTerm,
    searchOptions: {
      boost: { title: 5, tags: 3, properties: 2, content: 1 },
      // Partial words while typing ("dra" finds "dragon"), discounted below whole words
      prefix: true,
      // Typos: one wrong, missing or extra letter in words of 5+ letters ("dragn",
      // "drahon" find "dragon"), two in words of 9+. Short words must be exact.
      fuzzy: (term) => (term.length >= 9 ? 2 : term.length >= 5 ? 1 : false),
      weights: { prefix: 0.4, fuzzy: 0.3 },
      // Every word of the query must match
      combineWith: 'AND',
    },
  });
  private indexed = new Map<string, { article: LoreArticle; plainText: string }>();

  sync(articles: LoreArticle[]): this {
    const seen = new Set<string>();
    for (const article of articles) {
      if (seen.has(article.id)) continue;
      seen.add(article.id);
      const previous = this.indexed.get(article.id);
      if (previous?.article === article) continue;
      const plainText = articleBodyText(article);
      if (previous) this.index.replace(toIndexed(article, plainText));
      else this.index.add(toIndexed(article, plainText));
      this.indexed.set(article.id, { article, plainText });
    }
    for (const id of [...this.indexed.keys()]) {
      if (!seen.has(id)) {
        this.index.discard(id);
        this.indexed.delete(id);
      }
    }
    return this;
  }

  search(query: string, tag: string | null = null): SearchHit[] {
    const q = query.trim();
    if (!q) return [];
    const phrase = normalizeTerm(q);
    const queryTerms = MiniSearch.getDefault('tokenize')(q).map(normalizeTerm).filter(Boolean);

    const hits: SearchHit[] = [];
    for (const result of this.index.search(q)) {
      const entry = this.indexed.get(result.id);
      if (!entry || (tag && !entry.article.tags.includes(tag))) continue;
      const title = normalizeTerm(entry.article.title);
      // The whole query as typed in the title beats words scattered around the article
      const titleBoost = title === phrase ? 3 : title.includes(phrase) ? 1.5 : 1;
      hits.push({
        article: entry.article,
        score: result.score * titleBoost,
        // Prefer where the query occurs as typed, then its words, then the words it
        // matched by prefix or typo tolerance
        snippet: makeSnippet(entry.plainText, [[phrase], queryTerms, result.terms]),
      });
    }
    return hits.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
  }
}

// One-off search over a fixed set of articles
export function createArticleSearch(articles: LoreArticle[]) {
  const index = new ArticleSearchIndex().sync(articles);
  return (query: string, tag: string | null = null) => index.search(query, tag);
}

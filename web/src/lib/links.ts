// Links between articles. A link is stored in article HTML as
// <a data-lore-link="articleId">label</a>, so renaming an article never breaks it.
import { LoreArticle } from './database';

export const LORE_LINK_ATTR = 'data-lore-link';

const LINK_ID_PATTERN = new RegExp(`${LORE_LINK_ATTR}="([^"]+)"`, 'g');

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function linkHtml(articleId: string, label: string): string {
  return `<a ${LORE_LINK_ATTR}="${escapeHtml(articleId)}">${escapeHtml(label)}</a>`;
}

// Ids of the articles an article's HTML links to, in order of first appearance
export function extractLinkedArticleIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(LINK_ID_PATTERN)) {
    ids.add(unescapeHtml(match[1]));
  }
  return Array.from(ids);
}

// For each article id, the other articles that link to it
export function computeBacklinks(articles: LoreArticle[]): Map<string, LoreArticle[]> {
  const backlinks = new Map<string, LoreArticle[]>();
  for (const source of articles) {
    for (const targetId of extractLinkedArticleIds(source.content)) {
      if (targetId === source.id) continue;
      backlinks.set(targetId, [...(backlinks.get(targetId) ?? []), source]);
    }
  }
  return backlinks;
}

// Unordered pairs of distinct, existing articles where at least one links to the other
export function computeLinkPairs(articles: LoreArticle[]): [string, string][] {
  const existing = new Set(articles.map((a) => a.id));
  const seen = new Set<string>();
  const pairs: [string, string][] = [];

  for (const source of articles) {
    for (const targetId of extractLinkedArticleIds(source.content)) {
      if (targetId === source.id || !existing.has(targetId)) continue;
      const pair: [string, string] = source.id < targetId ? [source.id, targetId] : [targetId, source.id];
      const key = pair.join('\u0000');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push(pair);
    }
  }
  return pairs;
}

const normalizeTitle = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');

// Case- and whitespace-insensitive title lookup. On duplicate titles the first article wins.
export function createTitleResolver(articles: { id: string; title: string }[]) {
  const byTitle = new Map<string, string>();
  for (const a of articles) {
    const key = normalizeTitle(a.title);
    if (key && !byTitle.has(key)) byTitle.set(key, a.id);
  }
  return (title: string) => byTitle.get(normalizeTitle(title));
}

// Turn [[Title]] and [[Title|label]] in (escaped) HTML into article links.
// References that match no article are left as typed.
export function resolveWikiLinks(html: string, resolve: (title: string) => string | undefined): string {
  return html.replace(/\[\[([^[\]|<>]+?)(?:\|([^[\]<>]+?))?\]\]/g, (whole, rawTitle: string, rawLabel?: string) => {
    const title = unescapeHtml(rawTitle);
    const id = resolve(title);
    if (!id) return whole;
    const label = rawLabel !== undefined ? unescapeHtml(rawLabel) : title;
    return linkHtml(id, label.trim());
  });
}

// Resolve [[Title]] references in imported articles. Titles of the imported
// articles take precedence over existing ones, so a document links to itself.
export function resolveImportedWikiLinks(imported: LoreArticle[], existing: LoreArticle[]): LoreArticle[] {
  const resolve = createTitleResolver([...imported, ...existing]);
  return imported.map((a) => {
    const content = resolveWikiLinks(a.content, resolve);
    return content === a.content ? a : { ...a, content };
  });
}

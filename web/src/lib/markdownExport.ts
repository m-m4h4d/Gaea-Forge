// Export the world as Markdown: either a folder of files (one per article, by
// category, with YAML front matter and relative links; for Obsidian, git, other
// tools) packed as a .zip, or one document (a story bible to share or print).
// Article links become Markdown links; links to deleted articles become plain text.
import TurndownService from 'turndown';
import { zipSync, strToU8 } from 'fflate';
import { CanvasData, LoreArticle } from './database';
import { LORE_LINK_ATTR } from './links';
import { buildTimelineSections, formatEraRange, formatEventDate } from './timeline';

export type MarkdownWorld = { articles: LoreArticle[]; canvases: CanvasData[] };

const CANVAS_FOLDER = 'Canvases';
const IMAGE_FOLDER = 'images';

// ---- HTML -> Markdown ----

// Turns article HTML into Markdown; resolveLink maps an article id to a link target,
// or undefined when the article no longer exists
function createConverter() {
  let resolveLink: (articleId: string) => string | undefined = () => undefined;
  const service = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
  service.addRule('loreLink', {
    filter: (node) => node.nodeName === 'A' && (node as HTMLElement).hasAttribute(LORE_LINK_ATTR),
    replacement: (content, node) => {
      const target = resolveLink((node as HTMLElement).getAttribute(LORE_LINK_ATTR) ?? '');
      return target ? `[${content}](${target})` : content;
    },
  });
  return (html: string, linkTo: typeof resolveLink) => {
    resolveLink = linkTo;
    return service.turndown(html).trim();
  };
}

// ---- Names and paths ----

// A file or folder name that works on every OS and in Obsidian
export function safeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  return cleaned || 'Untitled';
}

// Unique (case-insensitively) names within each folder: "Mira", "Mira (2)"
function uniquePaths<T>(items: T[], folderOf: (item: T) => string, nameOf: (item: T) => string, extension: string) {
  const used = new Set<string>();
  const paths = new Map<T, string>();
  for (const item of items) {
    const folder = folderOf(item);
    const base = nameOf(item);
    let path = `${folder}/${base}${extension}`;
    for (let n = 2; used.has(path.toLowerCase()); n++) path = `${folder}/${base} (${n})${extension}`;
    used.add(path.toLowerCase());
    paths.set(item, path);
  }
  return paths;
}

// Link from one file to another (both one folder deep), encoded for Markdown
const relativeLink = (to: string) => `../${to.split('/').map(encodeURIComponent).join('/')}`;

// ---- Front matter and shared pieces ----

const yamlString = (s: string) => JSON.stringify(s);

function frontMatter(article: LoreArticle): string {
  const lines = ['---', `title: ${yamlString(article.title)}`, `category: ${yamlString(article.category)}`];
  lines.push(`tags: [${article.tags.map(yamlString).join(', ')}]`);
  if (article.properties.length) {
    lines.push('properties:');
    for (const p of article.properties) lines.push(`  ${yamlString(p.key)}: ${yamlString(p.value)}`);
  }
  if (article.isPinned) lines.push('pinned: true');
  lines.push('---');
  return lines.join('\n');
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  'parent-child': 'parent of',
  spouse: 'spouse of',
  sibling: 'sibling of',
  ancestor: 'ancestor of',
  mentor: 'mentor of',
  ally: 'ally of',
  rival: 'rival of',
};

const escapeMarkdown = (s: string) => s.replace(/([\\`*_[\]#<>|])/g, '\\$1');

// A canvas as Markdown lines (without its title heading). link(articleId) gives a
// link target for an article, or undefined.
function canvasBody(canvas: CanvasData, articles: Map<string, LoreArticle>, link: (articleId: string) => string | undefined, image?: string): string[] {
  const name = (articleId: string | undefined, fallback: string) => {
    const article = articleId ? articles.get(articleId) : undefined;
    const label = escapeMarkdown(article?.title ?? fallback);
    const target = article && link(article.id);
    return target ? `[${label}](${target})` : label;
  };
  const lines: string[] = [];

  if (canvas.type === 'timeline') {
    const events = canvas.events ?? [];
    const eras = canvas.eras ?? [];
    const eventLine = (e: (typeof events)[number]) => {
      let line = `- **${escapeMarkdown(formatEventDate(e, canvas.calendar, eras))}**: ${escapeMarkdown(e.title)}`;
      if (e.articleId && articles.has(e.articleId)) line += ` (${name(e.articleId, e.title)})`;
      if (e.description) line += ` — ${e.description.replace(/\s*\n\s*/g, ' ')}`;
      return line;
    };
    for (const section of buildTimelineSections(events, eras)) {
      if (section.kind === 'era') {
        lines.push('', `### ${escapeMarkdown(section.era.name)}`, '', `*${formatEraRange(section.era, canvas.calendar)}*`, '');
        lines.push(...(section.events.length ? section.events.map(eventLine) : ['*No events in this era.*']));
      } else {
        lines.push('', ...section.events.map(eventLine));
      }
    }
    if (!events.length && !eras.length) lines.push('', '*No events yet.*');
  } else if (canvas.type === 'map') {
    if (image) lines.push('', `![${escapeMarkdown(canvas.title)}](${image})`);
    lines.push('', '### Pins', '');
    lines.push(...(canvas.nodes.length ? canvas.nodes.map((n) => `- ${name(n.articleId, n.label)}`) : ['*No pins yet.*']));
  } else {
    const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
    const nodeName = (id: string) => {
      const node = byId.get(id);
      return node ? name(node.articleId, node.label) : '?';
    };
    lines.push('', '### Relationships', '');
    lines.push(
      ...(canvas.connections.length
        ? canvas.connections.map((c) => {
            const how = c.label?.trim() || RELATIONSHIP_LABELS[c.relationship] || 'related to';
            return `- ${nodeName(c.fromNodeId)} — ${escapeMarkdown(how)} — ${nodeName(c.toNodeId)}`;
          })
        : ['*No relationships yet.*'])
    );
    const connected = new Set(canvas.connections.flatMap((c) => [c.fromNodeId, c.toNodeId]));
    const loose = canvas.nodes.filter((n) => !connected.has(n.id));
    if (loose.length) lines.push('', `Also on this canvas: ${loose.map((n) => name(n.articleId, n.label)).join(', ')}`);
  }
  return lines;
}

// "data:image/png;base64,..." -> bytes and an extension
function decodeImage(dataUrl: string | undefined): { bytes: Uint8Array; extension: string } | null {
  const match = dataUrl && /^data:image\/([a-z0-9.+-]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase().replace('svg+xml', 'svg');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, extension };
}

const sortArticles = (articles: LoreArticle[]) =>
  [...articles].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

// ---- A folder of files ----

// path -> contents. Images in the world (covers, maps) must be inline data URLs (see readWorld).
export function buildMarkdownFiles(world: MarkdownWorld, exportedAt = new Date()): Record<string, Uint8Array> {
  const convert = createConverter();
  const articles = sortArticles(world.articles);
  const byId = new Map(articles.map((a) => [a.id, a]));
  const articlePaths = uniquePaths(articles, (a) => safeName(a.category), (a) => safeName(a.title), '.md');
  const canvasPaths = uniquePaths(world.canvases, () => CANVAS_FOLDER, (c) => safeName(c.title), '.md');
  const pathById = new Map(articles.map((a) => [a.id, articlePaths.get(a)!]));
  const link = (id: string) => {
    const path = pathById.get(id);
    return path ? relativeLink(path) : undefined;
  };

  const files: Record<string, Uint8Array> = {};
  const addImage = (dataUrl: string | undefined, name: string) => {
    const image = decodeImage(dataUrl);
    if (!image) return undefined;
    const path = `${IMAGE_FOLDER}/${safeName(name)}.${image.extension}`;
    files[path] = image.bytes;
    return relativeLink(path);
  };

  for (const article of articles) {
    const cover = addImage(article.coverImage, article.id);
    const parts = [frontMatter(article)];
    if (cover) parts.push(`![${escapeMarkdown(article.title)}](${cover})`);
    parts.push(convert(article.content, link));
    files[articlePaths.get(article)!] = strToU8(parts.filter(Boolean).join('\n\n') + '\n');
  }

  for (const canvas of world.canvases) {
    const image = canvas.type === 'map' ? addImage(canvas.mapImage, canvas.id) : undefined;
    const body = [`# ${escapeMarkdown(canvas.title)}`, ...canvasBody(canvas, byId, link, image)];
    files[canvasPaths.get(canvas)!] = strToU8(body.join('\n') + '\n');
  }

  // An index linking everything
  const index = [`# World Index`, '', `Exported from Gaea Forge on ${exportedAt.toLocaleDateString()}.`];
  let category: string | null = null;
  for (const article of articles) {
    if (article.category !== category) {
      category = article.category;
      index.push('', `## ${escapeMarkdown(category)}`, '');
    }
    index.push(`- [${escapeMarkdown(article.title)}](${articlePaths.get(article)!.split('/').map(encodeURIComponent).join('/')})`);
  }
  if (world.canvases.length) {
    index.push('', '## Canvases', '');
    for (const canvas of world.canvases) {
      index.push(`- [${escapeMarkdown(canvas.title)}](${canvasPaths.get(canvas)!.split('/').map(encodeURIComponent).join('/')})`);
    }
  }
  files['Index.md'] = strToU8(index.join('\n') + '\n');
  return files;
}

export function buildMarkdownZip(world: MarkdownWorld, exportedAt = new Date()): Uint8Array {
  return zipSync(buildMarkdownFiles(world, exportedAt), { level: 6, mtime: exportedAt });
}

// ---- One document ----

// GitHub-style heading anchors: lowercase, punctuation dropped, spaces to dashes
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

const ANCHOR = (id: string) => `@@gaea-anchor:${id}@@`;

// Push every heading in an article's Markdown down so it nests under the article's
// own heading, and drop the leading heading that repeats the title
function nestHeadings(markdown: string, title: string, depth: number): string {
  let inFence = false;
  const lines = markdown.split('\n');
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (/^```/.test(line)) inFence = !inFence;
    const heading = !inFence && /^(#{1,6})\s+(.*)$/.exec(line);
    if (!heading) return out.push(line);
    if (i === 0 && heading[2].trim() === escapeMarkdown(title).trim()) return; // the title again
    out.push(`${'#'.repeat(Math.min(6, heading[1].length + depth))} ${heading[2]}`);
  });
  return out.join('\n').trim();
}

export function buildMarkdownDocument(world: MarkdownWorld, title = 'Story Bible', exportedAt = new Date()): string {
  const convert = createConverter();
  const articles = sortArticles(world.articles);
  const byId = new Map(articles.map((a) => [a.id, a]));
  // Links point at anchors resolved once the whole document is known
  const link = (id: string) => (byId.has(id) ? `#${ANCHOR(id)}` : undefined);
  const categories = Array.from(new Set(articles.map((a) => a.category)));

  const lines: string[] = [`# ${escapeMarkdown(title)}`, '', `Exported from Gaea Forge on ${exportedAt.toLocaleDateString()}.`, '', '## Contents', ''];
  for (const category of categories) {
    lines.push(`- [${escapeMarkdown(category)}](#${ANCHOR(`category:${category}`)})`);
    for (const a of articles.filter((x) => x.category === category)) lines.push(`  - [${escapeMarkdown(a.title)}](#${ANCHOR(a.id)})`);
  }
  if (world.canvases.length) lines.push(`- [Canvases](#${ANCHOR('canvases')})`);

  // Headings that are link targets carry a marker until their anchor is known
  const marked = new Map<number, string>();
  const heading = (text: string, level: number, id?: string) => {
    lines.push('', `${'#'.repeat(level)} ${text}`, '');
    if (id) marked.set(lines.length - 2, id);
  };

  for (const category of categories) {
    heading(escapeMarkdown(category), 2, `category:${category}`);
    for (const article of articles.filter((x) => x.category === category)) {
      heading(escapeMarkdown(article.title), 3, article.id);
      const facts = [
        ...article.properties.filter((p) => p.key.trim() && p.value.trim()).map((p) => `**${escapeMarkdown(p.key)}:** ${escapeMarkdown(p.value)}`),
        ...(article.tags.length ? [`**Tags:** ${article.tags.map(escapeMarkdown).join(', ')}`] : []),
      ];
      if (facts.length) lines.push(facts.join('  \n'), '');
      // The article's own h1 is its ### title here, so its headings move down two levels
      lines.push(nestHeadings(convert(article.content, link), article.title, 2));
    }
  }

  if (world.canvases.length) {
    heading('Canvases', 2, 'canvases');
    for (const canvas of world.canvases) {
      heading(escapeMarkdown(canvas.title), 3);
      // Canvas bodies use ### for their own sections; nest them one level deeper
      lines.push(...canvasBody(canvas, byId, link).map((l) => (l.startsWith('### ') ? `#${l}` : l)));
    }
  }

  // Resolve anchors the way GitHub numbers repeated headings: "x", "x-1", "x-2"
  const counts = new Map<string, number>();
  const anchors = new Map<string, string>();
  let inFence = false;
  lines.forEach((line, i) => {
    for (const l of line.split('\n')) {
      if (/^```/.test(l)) inFence = !inFence;
      const h = !inFence && /^#{1,6}\s+(.*)$/.exec(l);
      if (!h) continue;
      const base = headingSlug(h[1].replace(/\\(.)/g, '$1'));
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      if (marked.has(i) && l === line) anchors.set(marked.get(i)!, n ? `${base}-${n}` : base);
    }
  });
  return (
    lines
      .join('\n')
      .replace(/@@gaea-anchor:(.*?)@@/g, (_, id: string) => anchors.get(id) ?? '')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

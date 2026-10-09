// Renaming an article never breaks links to it (they are keyed by id), but text that
// repeats the old title goes stale: link labels in other articles, the article's own
// heading, and canvas node labels and timeline events copied from it. planRename
// finds those places; only text that is exactly the old title is changed, so custom
// wording ("the queen") is left alone.
import { CanvasData, LoreArticle } from './database';
import { LORE_LINK_ATTR } from './links';

export type RenamePlan = {
  articles: LoreArticle[]; // changed articles (link labels, own heading)
  canvases: CanvasData[]; // changed canvases (node labels, event titles)
  linkCount: number;
  headingUpdated: boolean;
  canvasLabelCount: number;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeHtml = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// Is this HTML fragment plain text equal to the title? (formatted labels are skipped)
const isTitleText = (html: string, title: string) => !/[<>]/.test(html) && normalize(unescapeHtml(html)) === normalize(title);

// Replace the text of links to articleId whose label is the old title
export function renameLinkLabels(html: string, articleId: string, oldTitle: string, newTitle: string) {
  const idAttr = `${LORE_LINK_ATTR}="${escapeRegExp(escapeHtml(articleId))}"`;
  const pattern = new RegExp(`(<a\\b[^>]*\\s${idAttr}[^>]*>)([^<]*)(</a>)`, 'g');
  let count = 0;
  const result = html.replace(pattern, (whole, open: string, label: string, close: string) => {
    const replacement = escapeHtml(newTitle);
    if (!isTitleText(label, oldTitle) || label === replacement) return whole;
    count++;
    return open + replacement + close;
  });
  return { html: result, count };
}

// Replace the article's leading heading when it is the old title
export function renameLeadingHeading(html: string, oldTitle: string, newTitle: string) {
  const match = /^(\s*<h([1-6])\b[^>]*>)([^<]*)(<\/h\2>)/.exec(html);
  if (!match || !isTitleText(match[3], oldTitle) || match[3] === escapeHtml(newTitle)) return { html, changed: false };
  return { html: match[1] + escapeHtml(newTitle) + match[4] + html.slice(match[0].length), changed: true };
}

export function planRename(
  articleId: string,
  oldTitle: string,
  newTitle: string,
  articles: LoreArticle[],
  canvases: CanvasData[]
): RenamePlan {
  const plan: RenamePlan = { articles: [], canvases: [], linkCount: 0, headingUpdated: false, canvasLabelCount: 0 };
  const newText = newTitle.trim();
  if (!oldTitle.trim() || !newText || oldTitle.trim() === newText) return plan;

  for (const article of articles) {
    const links = renameLinkLabels(article.content, articleId, oldTitle, newText);
    let html = links.html;
    plan.linkCount += links.count;
    if (article.id === articleId) {
      const heading = renameLeadingHeading(html, oldTitle, newText);
      html = heading.html;
      plan.headingUpdated = heading.changed;
    }
    if (html !== article.content) plan.articles.push({ ...article, content: html });
  }

  for (const canvas of canvases) {
    let changed = false;
    const nodes = canvas.nodes.map((node) => {
      if (node.articleId !== articleId || normalize(node.label) !== normalize(oldTitle) || node.label === newText) return node;
      changed = true;
      plan.canvasLabelCount++;
      return { ...node, label: newText };
    });
    const events = canvas.events?.map((event) => {
      if (event.articleId !== articleId || normalize(event.title) !== normalize(oldTitle) || event.title === newText) return event;
      changed = true;
      plan.canvasLabelCount++;
      return { ...event, title: newText };
    });
    if (changed) plan.canvases.push({ ...canvas, nodes, ...(events ? { events } : {}) });
  }
  return plan;
}

export const isEmptyRenamePlan = (plan: RenamePlan) => plan.articles.length === 0 && plan.canvases.length === 0;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "2 links, its heading and 1 canvas label"
export function describeRenamePlan(plan: RenamePlan): string {
  const parts: string[] = [];
  if (plan.linkCount) parts.push(plural(plan.linkCount, 'link', 'links'));
  if (plan.headingUpdated) parts.push('its heading');
  if (plan.canvasLabelCount) parts.push(plural(plan.canvasLabelCount, 'canvas label', 'canvas labels'));
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// Pure helpers for creating, searching and grouping articles
import { LoreArticle } from './database';
import { ROLES, RoleId } from './roles';

// Case-insensitive match on title, content, tags and properties, optionally limited to one tag
export function filterArticles(
  articles: LoreArticle[],
  query: string,
  tag: string | null
): LoreArticle[] {
  const q = query.trim().toLowerCase();

  return articles.filter((art) => {
    if (tag && !art.tags.includes(tag)) return false;
    if (!q) return true;
    return (
      art.title.toLowerCase().includes(q) ||
      art.content.toLowerCase().includes(q) ||
      art.tags.some((t) => t.toLowerCase().includes(q)) ||
      art.properties.some(
        (p) => p.key.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
      )
    );
  });
}

// Categories whose articles can appear as people on family trees
export function isCharacterCategory(category: string): boolean {
  return /character|cast|npc|people/i.test(category);
}

// The role's categories first, then any other categories articles already use
export function mergeCategories(roleCategories: string[], articles: LoreArticle[]): string[] {
  return Array.from(
    new Set([...roleCategories, ...articles.map((a) => a.category).filter(Boolean)])
  );
}

// A fresh draft article for the "New Article" modal
export function createArticleDraft(data: { title: string; category: string; tags: string[] }): LoreArticle {
  const timestamp = Date.now();
  return {
    id: `${data.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`,
    title: data.title,
    category: data.category,
    content: `<h1>${escapeHtml(data.title)}</h1><p>Start detailing your lore for ${escapeHtml(data.title)}...</p>`,
    tags: data.tags,
    properties: [
      { key: 'Status', value: 'Draft' },
      { key: 'Created', value: new Date(timestamp).toLocaleDateString() },
    ],
    isPinned: false,
    last_updated: timestamp,
  };
}

// The pinned welcome article seeded when a workspace role is chosen
export function createRoleSampleArticle(roleId: RoleId): LoreArticle {
  const sample = ROLES[roleId].sampleArticle;
  const timestamp = Date.now();
  return {
    id: `starter-${roleId}-${timestamp}`,
    title: sample.title,
    category: sample.category,
    content: sample.content,
    tags: sample.tags,
    properties: sample.properties,
    isPinned: true,
    last_updated: timestamp,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

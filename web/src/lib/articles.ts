// Pure helpers for creating, searching and grouping articles
import { LoreArticle } from './database';
import { ROLES, RoleId } from './roles';
import { CategoryTemplate, createArticleFromTemplate, defaultTemplate } from './templates';

// Articles carrying the tag, or all of them without a tag filter.
// Text search lives in lib/search.ts.
export function filterArticles(articles: LoreArticle[], tag: string | null): LoreArticle[] {
  return tag ? articles.filter((art) => art.tags.includes(tag)) : articles;
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

// A fresh article for the "New Article" modal, shaped by the category's template
// (the built-in one unless the user saved their own)
export function createArticleDraft(
  data: { title: string; category: string; tags: string[] },
  template: CategoryTemplate = defaultTemplate(data.category)
): LoreArticle {
  return createArticleFromTemplate(data, template);
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

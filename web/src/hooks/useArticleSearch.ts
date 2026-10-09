'use client';

import { useMemo, useState } from 'react';
import { ArticleSearchIndex, SearchHit } from '@/lib/search';
import { LoreArticle } from '@/lib/database';

// Ranked search results, or null when there is no query. The index lives for the
// session and is only brought up to date (cheaply, changed articles only) while searching.
export function useArticleSearch(articles: LoreArticle[], query: string, tag: string | null): SearchHit[] | null {
  const [index] = useState(() => new ArticleSearchIndex());
  const isSearching = query.trim() !== '';
  return useMemo(
    () => (isSearching ? index.sync(articles).search(query, tag) : null),
    [index, isSearching, articles, query, tag]
  );
}

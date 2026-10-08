// Ranking for the Ctrl/Cmd+K quick switcher

export type SwitchItem = {
  kind: 'article' | 'canvas';
  id: string;
  title: string;
  // Category for articles, canvas type for canvases
  detail: string;
};

// Lower is better; null means no match. Exact > prefix > word start > anywhere > letters in order.
export function scoreTitle(title: string, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = title.toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  if (t.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) return 2;
  if (t.includes(q)) return 3;
  // Letters in order, e.g. "qmr" -> "Queen Mira"
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 4 : null;
}

// Best matches first. With an empty query, recently opened items come first.
export function rankSwitchItems(items: SwitchItem[], query: string, recentIds: string[], limit = 12): SwitchItem[] {
  const recency = (id: string) => {
    const index = recentIds.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  return items
    .map((item) => ({ item, score: scoreTitle(item.title, query) }))
    .filter((x): x is { item: SwitchItem; score: number } => x.score !== null)
    .sort(
      (a, b) =>
        a.score - b.score ||
        recency(a.item.id) - recency(b.item.id) ||
        a.item.title.length - b.item.title.length ||
        a.item.title.localeCompare(b.item.title)
    )
    .slice(0, limit)
    .map((x) => x.item);
}

// Most recent first, without duplicates, capped
export function pushRecent(recentIds: string[], id: string, max = 20): string[] {
  return [id, ...recentIds.filter((r) => r !== id)].slice(0, max);
}

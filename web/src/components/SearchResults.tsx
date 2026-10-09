'use client';

import { Search } from 'lucide-react';
import { SearchHit } from '@/lib/search';

interface SearchResultsProps {
  hits: SearchHit[];
  activeArticleId: string | null;
  onSelectArticle: (id: string) => void;
}

// Ranked sidebar results while a search is active, best match first, with the
// passage that matched
export default function SearchResults({ hits, activeArticleId, onSelectArticle }: SearchResultsProps) {
  return (
    <section aria-label="Search results">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="font-semibold text-slate-400 uppercase text-[11px] tracking-wider flex items-center gap-1">
          <Search size={12} aria-hidden /> Search Results
        </span>
        <span className="text-[11px] text-slate-500" aria-live="polite">
          {hits.length === 1 ? '1 match' : `${hits.length} matches`}
        </span>
      </div>

      {hits.length === 0 ? (
        <p className="px-2 py-1 text-[11px] text-slate-500 italic">No matching lore</p>
      ) : (
        <ul className="space-y-1">
          {hits.map(({ article, snippet }) => {
            const isActive = article.id === activeArticleId;
            return (
              <li key={article.id}>
                <button
                  onClick={() => onSelectArticle(article.id)}
                  className={`w-full text-left py-1.5 px-2.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-gold/15 text-gold ring-1 ring-inset ring-gold/30'
                      : 'text-slate-200 hover:bg-slate-800/80 hover:text-gold'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{article.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 truncate max-w-[40%]">{article.category}</span>
                  </span>
                  {snippet && (
                    <span className="block mt-0.5 text-[11px] leading-snug text-slate-500 line-clamp-2" data-testid="search-snippet">
                      {snippet.before}
                      <mark className="bg-gold/20 text-gold rounded-sm px-0.5">{snippet.match}</mark>
                      {snippet.after}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

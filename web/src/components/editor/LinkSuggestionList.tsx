'use client';

import { forwardRef, useImperativeHandle, useState } from 'react';

export type LinkSuggestionItem =
  | { kind: 'article'; id: string; title: string; category: string }
  | { kind: 'create'; title: string };

export type LinkSuggestionListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

type Props = {
  items: LinkSuggestionItem[];
  command: (item: LinkSuggestionItem) => void;
};

// Popup shown while typing [[ in the editor
const LinkSuggestionList = forwardRef<LinkSuggestionListHandle, Props>(function LinkSuggestionList(
  { items, command },
  ref
) {
  const [selected, setSelected] = useState(0);
  // Reset the highlight when the result list changes
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setSelected(0);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="Link to article"
      className="w-72 max-h-72 overflow-y-auto custom-scrollbar bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 text-xs text-slate-200"
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-slate-500">Type an article title…</div>
      ) : (
        items.map((item, idx) => (
          <button
            key={item.kind === 'article' ? item.id : `create-${item.title}`}
            type="button"
            role="option"
            aria-selected={idx === selected}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(item)}
            onMouseEnter={() => setSelected(idx)}
            className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between gap-2 ${
              idx === selected ? 'bg-gold text-slate-950' : 'hover:bg-slate-800'
            }`}
          >
            {item.kind === 'article' ? (
              <>
                <span className="truncate font-medium">{item.title}</span>
                <span className={`shrink-0 text-[10px] ${idx === selected ? 'text-slate-800' : 'text-slate-500'}`}>
                  {item.category}
                </span>
              </>
            ) : (
              <span className="truncate">
                + Create <strong>“{item.title}”</strong>
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
});

export default LinkSuggestionList;

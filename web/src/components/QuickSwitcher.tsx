'use client';

import React, { useRef, useState } from 'react';
import { CornerDownLeft, FileText, Plus, Search } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { rankSwitchItems, SwitchItem } from '@/lib/quickSwitch';
import { CanvasType } from '@/lib/database';
import { CANVAS_TYPE_INFO } from './canvasTypes';

interface QuickSwitcherProps {
  items: SwitchItem[];
  recentIds: string[];
  onSelect: (item: SwitchItem) => void;
  onCreateArticle: (title: string) => void;
  onClose: () => void;
}

type Row = { kind: 'item'; item: SwitchItem } | { kind: 'create'; title: string };

// Ctrl/Cmd+K: type to jump to any article or canvas, or create an article
export default function QuickSwitcher({ items, recentIds, onSelect, onCreateArticle, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(dialogRef, true, inputRef);

  const matches = rankSwitchItems(items, query, recentIds);
  const trimmed = query.trim();
  const exact = items.some((i) => i.kind === 'article' && i.title.toLowerCase() === trimmed.toLowerCase());
  const rows: Row[] = [
    ...matches.map((item): Row => ({ kind: 'item', item })),
    ...(trimmed && !exact ? [{ kind: 'create', title: trimmed } as Row] : []),
  ];
  const active = Math.min(selected, Math.max(rows.length - 1, 0));

  const choose = (row: Row | undefined) => {
    if (!row) return;
    if (row.kind === 'item') onSelect(row.item);
    else onCreateArticle(row.title);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((active + 1) % Math.max(rows.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((active - 1 + rows.length) % Math.max(rows.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-parchment"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-4 border-b border-slate-800">
          <Search size={16} className="text-slate-500" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            placeholder="Jump to an article or canvas…"
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-switcher-results"
            aria-activedescendant={rows.length ? `quick-switch-${active}` : undefined}
            aria-autocomplete="list"
            className="flex-1 bg-transparent py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="text-[11px] text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <ul id="quick-switcher-results" role="listbox" className="max-h-80 overflow-y-auto custom-scrollbar p-1.5">
          {rows.length === 0 && <li className="px-3 py-3 text-xs text-slate-500">No articles or canvases yet.</li>}
          {rows.map((row, idx) => {
            const isActive = idx === active;
            const Icon =
              row.kind === 'create'
                ? Plus
                : row.item.kind === 'canvas'
                  ? CANVAS_TYPE_INFO[row.item.detail as CanvasType]?.icon ?? FileText
                  : FileText;
            return (
              <li
                key={row.kind === 'item' ? `${row.item.kind}-${row.item.id}` : 'create'}
                id={`quick-switch-${idx}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setSelected(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer ${
                  isActive ? 'bg-gold/15 text-gold' : 'text-slate-200'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-gold' : 'text-slate-500'} aria-hidden />
                {row.kind === 'item' ? (
                  <>
                    <span className="truncate flex-1">{row.item.title}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {row.item.kind === 'canvas'
                        ? CANVAS_TYPE_INFO[row.item.detail as CanvasType]?.name ?? 'Canvas'
                        : row.item.detail}
                    </span>
                  </>
                ) : (
                  <span className="truncate flex-1">
                    Create article <strong>“{row.title}”</strong>
                  </span>
                )}
                {isActive && <CornerDownLeft size={13} className="shrink-0 opacity-70" aria-hidden />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

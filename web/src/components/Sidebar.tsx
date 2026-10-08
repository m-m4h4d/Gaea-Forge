'use client';

import React from 'react';
import { CanvasData, LoreArticle } from '@/lib/database';
import { ChevronDown, ChevronRight, Inbox, Palette, PanelLeftClose, Pin, Plus, Search, X } from 'lucide-react';
import { CANVAS_TYPE_INFO } from './canvasTypes';

export type ViewMode = 'editor' | 'canvas';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImport: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTagFilter: string | null;
  onClearTagFilter: () => void;
  canvases: CanvasData[];
  activeCanvasId: string;
  activeArticleId: string;
  activeViewMode: ViewMode;
  onSelectCanvas: (id: string) => void;
  onSelectArticle: (id: string) => void;
  onNewCanvas: () => void;
  onDeleteCanvas: (id: string, e?: React.MouseEvent) => void;
  pinnedArticles: LoreArticle[];
  filteredArticles: LoreArticle[];
  displayCategories: string[];
  expandedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  onExpandedChange: (expanded: Set<string>) => void;
  onNewArticle: (category: string) => void;
  codexTitle: string;
  newArticleLabel: string;
}

// Left navigation: search, canvases, pinned articles and category folders
export default function Sidebar({
  isOpen,
  onClose,
  onOpenImport,
  searchQuery,
  onSearchChange,
  selectedTagFilter,
  onClearTagFilter,
  canvases,
  activeCanvasId,
  activeArticleId,
  activeViewMode,
  onSelectCanvas,
  onSelectArticle,
  onNewCanvas,
  onDeleteCanvas,
  pinnedArticles,
  filteredArticles,
  displayCategories,
  expandedCategories,
  onToggleCategory,
  onExpandedChange,
  onNewArticle,
  codexTitle,
  newArticleLabel,
}: SidebarProps) {
  return (
      <aside
        className={`${
          isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none pointer-events-none'
        } shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-20 transition-all duration-300 ease-in-out relative`}
      >
        <div className="w-72 flex flex-col h-full shrink-0">
          {/* App Title & Header Actions */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Gaea-Forge Logo"
                className="w-9 h-9 rounded-lg object-cover border border-gold/30 shadow-md shadow-gold/20"
              />
              <div>
                <h1 className="text-base font-bold tracking-wider text-gold">Gaea-Forge</h1>
                <p className="text-[11px] text-slate-500 tracking-tight">Local World Architect</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenImport()}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-gold rounded-lg text-xs transition-colors flex items-center gap-1"
                title="Intelligent Document Import (.pdf, .docx, .doc, .md, .txt) & Backup"
              >
                <Inbox size={13} aria-hidden /> <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={() => onClose()}
                className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-gold rounded-lg text-xs transition-colors"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={14} aria-hidden />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/50">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search lore, tags… (Ctrl+K to jump)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-parchment placeholder-slate-500 focus:outline-none focus:border-gold transition-colors"
              />
              <Search size={13} className="absolute left-2.5 top-2 text-slate-500" aria-hidden />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1.5 text-slate-500 hover:text-gold text-xs"
                >
                  <X size={12} aria-hidden />
                </button>
              )}
            </div>

            {/* Active Tag Filter Indicator */}
            {selectedTagFilter && (
              <div className="mt-2 flex items-center justify-between bg-gold/10 border border-gold/30 rounded px-2 py-1 text-xs text-gold">
                <span>Tag filter: <strong>#{selectedTagFilter}</strong></span>
                <button onClick={() => onClearTagFilter()} className="hover:text-slate-50 font-bold">
                  <X size={12} aria-hidden />
                </button>
              </div>
            )}
          </div>

          {/* Categories & Canvases Navigation */}
          <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
            {/* World Canvases Section */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="font-semibold text-gold uppercase text-[11px] tracking-wider flex items-center gap-1">
                  <Palette size={12} aria-hidden /> World Canvases
                </span>
                <button
                  onClick={() => onNewCanvas()}
                  className="text-[11px] text-slate-400 hover:text-gold font-bold px-1 rounded transition-colors"
                  title="Create New Canvas"
                >
                  + New
                </button>
              </div>

              <ul className="space-y-1">
                {canvases.map((canvas) => (
                  <li key={canvas.id} className="group relative flex items-center">
                    <button
                      onClick={() => onSelectCanvas(canvas.id)}
                      className={`w-full text-left py-1.5 pl-2.5 pr-7 rounded-lg text-xs flex items-center justify-between transition-all ${
                        activeCanvasId === canvas.id && activeViewMode === 'canvas'
                          ? 'bg-gold/15 text-gold font-semibold ring-1 ring-inset ring-gold/30'
                          : 'text-parchment hover:bg-slate-800/80 hover:text-gold'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {React.createElement(CANVAS_TYPE_INFO[canvas.type].icon, { size: 13, 'aria-hidden': true })}
                        {canvas.title}
                      </span>
                      <span className="text-[10px] opacity-75 shrink-0 uppercase tracking-tighter ml-1">
                        {CANVAS_TYPE_INFO[canvas.type].badge}
                      </span>
                    </button>

                    {canvases.length > 1 && (
                      <button
                        onClick={(e) => onDeleteCanvas(canvas.id, e)}
                        className={`absolute right-1.5 text-xs p-1 rounded transition-opacity ${
                          activeCanvasId === canvas.id && activeViewMode === 'canvas'
                            ? 'text-gold/70 hover:text-red-400 font-bold'
                            : 'text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 font-bold'
                        }`}
                        title={`Delete ${canvas.title}`}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pinned Articles Section */}
            {pinnedArticles.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="font-semibold text-slate-400 uppercase text-[11px] tracking-wider flex items-center gap-1">
                    <Pin size={12} aria-hidden /> Pinned Codex
                  </span>
                </div>
                <ul className="space-y-1">
                  {pinnedArticles.map((art) => (
                    <li key={art.id}>
                      <button
                        onClick={() => onSelectArticle(art.id)}
                        className={`w-full text-left py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                          activeArticleId === art.id && activeViewMode === 'editor'
                            ? 'bg-gold/15 text-gold font-semibold ring-1 ring-inset ring-gold/30'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-gold'
                        }`}
                      >
                        <span className="truncate">{art.title}</span>
                        <span className="text-[11px] text-slate-500 shrink-0 ml-1 font-mono">
                          {art.category.slice(0, 3)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Category Folders */}
            <div>
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="font-semibold text-slate-400 uppercase text-[11px] tracking-wider">
                  {codexTitle}
                </span>
                <button
                  onClick={() => {
                    if (expandedCategories.size > 0) {
                      onExpandedChange(new Set());
                    } else {
                      onExpandedChange(new Set(displayCategories));
                    }
                  }}
                  className="text-[11px] text-slate-500 hover:text-gold transition-colors"
                >
                  {expandedCategories.size > 0 ? 'Collapse All' : 'Expand All'}
                </button>
              </div>

              <div className="space-y-3">
                {displayCategories.map((cat) => {
                  const categoryArticles = filteredArticles.filter((a) => a.category === cat);
                  const isExpanded = expandedCategories.has(cat);

                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-800/50 group">
                        <button
                          onClick={() => onToggleCategory(cat)}
                          className="text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors text-slate-300 group-hover:text-gold"
                        >
                          {isExpanded ? (
                <ChevronDown size={13} className="text-slate-500" aria-hidden />
              ) : (
                <ChevronRight size={13} className="text-slate-500" aria-hidden />
              )}
                          {cat}
                        </button>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                            {categoryArticles.length}
                          </span>
                          <button
                            onClick={() => onNewArticle(cat)}
                            className="text-xs text-slate-500 hover:text-gold px-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title={`Add new article in ${cat}`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Article list under category */}
                      {isExpanded && (
                        <ul className="space-y-0.5 pl-3 border-l border-slate-800 ml-2">
                          {categoryArticles.length > 0 ? (
                            categoryArticles.map((art) => (
                              <li key={art.id}>
                                <button
                                  onClick={() => onSelectArticle(art.id)}
                                  className={`w-full text-left py-1 px-2 rounded text-xs truncate transition-colors ${
                                    activeArticleId === art.id && activeViewMode === 'editor'
                                      ? 'bg-slate-800 text-gold font-medium border-l-2 border-gold'
                                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                  }`}
                                >
                                  {art.title}
                                </button>
                              </li>
                            ))
                          ) : (
                            <li className="text-[11px] text-slate-500 px-2 py-0.5 italic">
                              {searchQuery || selectedTagFilter ? 'No matching lore' : 'No articles yet'}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Quick Add Button */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80">
            <button
              onClick={() => onNewArticle(displayCategories[0] || 'Characters')}
              className="w-full py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg text-xs shadow-lg shadow-gold/20 flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden /> {newArticleLabel}
            </button>
          </div>
        </div>
      </aside>
  );
}

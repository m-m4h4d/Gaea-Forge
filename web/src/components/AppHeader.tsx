'use client';

import React from 'react';
import { CanvasData, LoreArticle } from '@/lib/database';
import { RoleConfig } from '@/lib/roles';
import { SaveStatus } from '@/hooks/useArticleSaver';
import { ViewMode } from './Sidebar';

interface AppHeaderProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  activeViewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  activeCanvas: CanvasData | undefined;
  activeArticle: LoreArticle | undefined;
  activeRoleConfig: RoleConfig;
  onOpenRolePicker: () => void;
  saveStatus: SaveStatus;
  saveError: string | null;
  onRetrySave: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onTogglePin: () => void;
  canDeleteCanvas: boolean;
  onDeleteCanvas: () => void;
}

// Top bar: view switcher, breadcrumb, role picker, save status and view actions
export default function AppHeader({
  isSidebarOpen,
  onOpenSidebar,
  activeViewMode,
  onViewModeChange,
  activeCanvas,
  activeArticle,
  activeRoleConfig,
  onOpenRolePicker,
  saveStatus,
  saveError,
  onRetrySave,
  isInspectorOpen,
  onToggleInspector,
  onTogglePin,
  canDeleteCanvas,
  onDeleteCanvas,
}: AppHeaderProps) {
  return (
      <header className="h-14 border-b border-slate-800 flex items-center px-3 sm:px-6 justify-between shrink-0 bg-slate-900/80 backdrop-blur-md z-10 gap-2">
        {/* Mode Switcher Tabs & Sidebar Toggle */}
        <div className="flex items-center gap-2 min-w-0">
          {!isSidebarOpen && (
            <button
              onClick={() => onOpenSidebar()}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-gold/60 text-gold rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0"
              title="Open Sidebar"
            >
              <span>☰</span> <span className="hidden md:inline">Codex</span>
            </button>
          )}

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => onViewModeChange('editor')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeViewMode === 'editor'
                  ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📄</span> <span className="hidden sm:inline">Lore Editor</span><span className="sm:hidden">Editor</span>
            </button>
            <button
              onClick={() => onViewModeChange('canvas')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeViewMode === 'canvas'
                  ? 'bg-gold text-slate-950 shadow-md shadow-gold/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{activeCanvas?.type === 'family-tree' ? '🌳' : '🌐'}</span> <span className="hidden sm:inline">Canvas: {activeCanvas?.title}</span><span className="sm:hidden">Canvas</span>
            </button>
          </div>

          {activeViewMode === 'editor' && (
            <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 ml-2 truncate">
              <span className="text-slate-500 font-semibold">Path:</span>
              <span className="text-slate-400 font-medium truncate">{activeArticle?.category || 'General'}</span>
              <span>/</span>
              <span className="text-gold font-bold truncate max-w-[160px]">{activeArticle?.title || 'Untitled Entity'}</span>
            </div>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Active Role & Theme Switcher Button */}
          <button
            onClick={() => onOpenRolePicker()}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:opacity-90 shrink-0"
            style={{
              borderColor: activeRoleConfig.theme.primary,
              backgroundColor: activeRoleConfig.theme.primaryLight,
              color: activeRoleConfig.theme.primary,
            }}
            title="Switch Workspace Role & Theme"
          >
            <span>{activeRoleConfig.icon}</span>
            <span className="hidden md:inline">{activeRoleConfig.shortName}</span>
            <span className="text-[10px] opacity-75">▾</span>
          </button>

          {/* Auto-save status */}
          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
            {saveStatus === 'error' ? (
              <button
                onClick={() => onRetrySave()}
                className="text-red-400 font-medium hover:underline"
                title={saveError ?? undefined}
              >
                Save failed, retry
              </button>
            ) : saveStatus === 'saving' ? (
              <span className="text-amber-400 animate-pulse">Saving...</span>
            ) : saveStatus === 'pending' ? (
              <span className="text-slate-400">Unsaved changes</span>
            ) : (
              <span className="text-slate-500">All changes saved</span>
            )}
          </div>

          {activeViewMode === 'editor' && (
            <>
              {/* Inspector Toggle Button */}
              <button
                onClick={() => onToggleInspector()}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  isInspectorOpen
                    ? 'bg-gold/20 border-gold text-gold shadow-sm shadow-gold/10'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title={isInspectorOpen ? 'Hide Entity Inspector' : 'Show Entity Inspector'}
              >
                <span>⚜</span> <span className="hidden md:inline">Inspector</span>
              </button>

              {/* Pin Toggle Button */}
              <button
                onClick={onTogglePin}
                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                  activeArticle?.isPinned
                    ? 'bg-gold/20 border-gold text-gold'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title={activeArticle?.isPinned ? 'Unpin Article' : 'Pin Article to top'}
              >
                📌 <span className="hidden sm:inline">{activeArticle?.isPinned ? 'Pinned' : 'Pin'}</span>
              </button>

            </>
          )}

          {activeViewMode === 'canvas' && canDeleteCanvas && (
            <button
              onClick={() => onDeleteCanvas()}
              className="px-3 py-1.5 bg-red-950/60 border border-red-800/80 text-red-400 hover:bg-red-900 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              title="Delete this canvas"
            >
              <span>🗑️</span> <span className="hidden sm:inline">Delete Canvas</span>
            </button>
          )}
        </div>
      </header>
  );
}

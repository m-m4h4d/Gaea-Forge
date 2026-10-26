'use client';

import React from 'react';
import { CanvasData, LoreArticle } from '@/lib/database';
import { RoleConfig } from '@/lib/roles';
import { SaveStatus } from '@/hooks/useArticleSaver';
import { ColorMode } from '@/lib/colorMode';
import { ViewMode } from './Sidebar';
import { ChevronDown, FileText, Menu, Monitor, Moon, PanelRight, Pin, Sun, Trash2 } from 'lucide-react';
import { CANVAS_TYPE_INFO } from './canvasTypes';
import RoleIcon from './RoleIcon';

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
  colorMode: ColorMode;
  onCycleColorMode: () => void;
}

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  dark: 'Dark theme',
  light: 'Light theme',
  system: 'System theme',
};

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
  colorMode,
  onCycleColorMode,
}: AppHeaderProps) {
  const ColorModeIcon = colorMode === 'dark' ? Moon : colorMode === 'light' ? Sun : Monitor;

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
              <Menu size={14} aria-hidden /> <span className="hidden md:inline">Codex</span>
            </button>
          )}

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 min-w-0">
            <button
              onClick={() => onViewModeChange('editor')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeViewMode === 'editor'
                  ? 'bg-slate-800 text-gold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={14} aria-hidden /> <span className="hidden sm:inline">Lore Editor</span><span className="sm:hidden">Editor</span>
            </button>
            <button
              onClick={() => onViewModeChange('canvas')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap min-w-0 ${
                activeViewMode === 'canvas'
                  ? 'bg-slate-800 text-gold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {activeCanvas && React.createElement(CANVAS_TYPE_INFO[activeCanvas.type].icon, { size: 14, 'aria-hidden': true })} <span className="hidden sm:inline truncate max-w-[11rem]" title={activeCanvas?.title}>{activeCanvas?.title}</span><span className="sm:hidden">Canvas</span>
            </button>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Color mode: dark -> light -> system */}
          <button
            onClick={onCycleColorMode}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-gold hover:border-gold/60 transition-colors shrink-0"
            title={`${COLOR_MODE_LABELS[colorMode]} (click to change)`}
            aria-label={`${COLOR_MODE_LABELS[colorMode]}, click to change`}
          >
            <ColorModeIcon size={15} aria-hidden />
          </button>

          {/* Active Role & Theme Switcher Button */}
          <button
            onClick={() => onOpenRolePicker()}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-gold/70 bg-gold/10 text-gold text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:bg-gold/20 shrink-0"
            title="Switch Workspace Role & Theme"
          >
            <RoleIcon roleId={activeRoleConfig.id} size={14} />
            <span className="hidden md:inline">{activeRoleConfig.shortName}</span>
            <ChevronDown size={12} className="opacity-75" aria-hidden />
          </button>

          {/* Auto-save status */}
          <div className="text-xs text-slate-400 hidden lg:flex items-center gap-1.5">
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
                <PanelRight size={14} aria-hidden /> <span className="hidden xl:inline">Inspector</span>
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
                <Pin size={13} aria-hidden /> <span className="hidden xl:inline">{activeArticle?.isPinned ? 'Pinned' : 'Pin'}</span>
              </button>

            </>
          )}

          {activeViewMode === 'canvas' && canDeleteCanvas && (
            <button
              onClick={() => onDeleteCanvas()}
              className="px-3 py-1.5 bg-red-950/60 border border-red-800/80 text-red-400 hover:bg-red-900 hover:text-slate-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              title="Delete this canvas"
            >
              <Trash2 size={13} aria-hidden /> <span className="hidden sm:inline">Delete Canvas</span>
            </button>
          )}
        </div>
      </header>
  );
}

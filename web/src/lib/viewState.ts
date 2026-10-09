// Where the user was (open article or canvas, panels, folders, recent items), saved so
// a reload or app restart reopens the same place. Kept in localStorage: it is
// per-device UI state, not world data, so it stays out of the database and backups.

export type ViewMode = 'editor' | 'canvas';

export type ViewState = {
  viewMode: ViewMode;
  articleId: string | null;
  canvasId: string | null;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  collapsedCategories: string[];
  recentIds: string[];
};

export const VIEW_STATE_KEY = 'gaea_view_state';
const MAX_LIST = 200; // guard against a corrupt or hand-edited value

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

// Read a saved value, keeping only well-formed fields
export function parseViewState(raw: string | null): Partial<ViewState> | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out: Partial<ViewState> = {};
  if (v.viewMode === 'editor' || v.viewMode === 'canvas') out.viewMode = v.viewMode;
  if (typeof v.articleId === 'string') out.articleId = v.articleId;
  if (typeof v.canvasId === 'string') out.canvasId = v.canvasId;
  if (typeof v.sidebarOpen === 'boolean') out.sidebarOpen = v.sidebarOpen;
  if (typeof v.inspectorOpen === 'boolean') out.inspectorOpen = v.inspectorOpen;
  if (isStringList(v.collapsedCategories)) out.collapsedCategories = v.collapsedCategories.slice(0, MAX_LIST);
  if (isStringList(v.recentIds)) out.recentIds = v.recentIds.slice(0, MAX_LIST);
  return out;
}

// Fit a saved view to the world as it is now: articles and canvases may have been
// deleted (or the world replaced) since it was saved
export function resolveViewState(
  saved: Partial<ViewState>,
  articleIds: Set<string>,
  canvasIds: Set<string>
): Partial<ViewState> {
  const out: Partial<ViewState> = { ...saved };
  if (out.articleId && !articleIds.has(out.articleId)) delete out.articleId;
  if (out.canvasId && !canvasIds.has(out.canvasId)) delete out.canvasId;
  // A canvas view whose canvas is gone falls back to the editor
  if (out.viewMode === 'canvas' && !out.canvasId) out.viewMode = 'editor';
  if (out.recentIds) out.recentIds = out.recentIds.filter((id) => articleIds.has(id) || canvasIds.has(id));
  return out;
}

export function loadViewState(): Partial<ViewState> | null {
  try {
    return parseViewState(localStorage.getItem(VIEW_STATE_KEY));
  } catch {
    return null; // storage unavailable (private mode, blocked)
  }
}

export function saveViewState(state: ViewState): void {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable: losing the view is harmless
  }
}

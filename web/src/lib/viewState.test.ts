import { describe, expect, it } from 'vitest';
import { parseViewState, resolveViewState, ViewState } from './viewState';

const full: ViewState = {
  viewMode: 'canvas',
  articleId: 'mira',
  canvasId: 'atlas',
  sidebarOpen: false,
  inspectorOpen: true,
  collapsedCategories: ['Bestiary & Species'],
  recentIds: ['atlas', 'mira', 'gone'],
};

describe('parseViewState', () => {
  it('reads back a saved state', () => {
    expect(parseViewState(JSON.stringify(full))).toEqual(full);
  });

  it('rejects missing, invalid and non-object values', () => {
    expect(parseViewState(null)).toBeNull();
    expect(parseViewState('not json')).toBeNull();
    expect(parseViewState('[1,2]')).toBeNull();
    expect(parseViewState('"editor"')).toBeNull();
  });

  it('keeps only well-formed fields', () => {
    expect(
      parseViewState(JSON.stringify({ viewMode: 'map', articleId: 7, sidebarOpen: 'yes', recentIds: ['a', 2], canvasId: 'c' }))
    ).toEqual({ canvasId: 'c' });
  });

  it('caps very long lists', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `a${i}`);
    expect(parseViewState(JSON.stringify({ recentIds: ids }))!.recentIds).toHaveLength(200);
  });
});

describe('resolveViewState', () => {
  const articles = new Set(['mira', 'ashfall']);
  const canvases = new Set(['atlas', 'web']);

  it('keeps a view whose article and canvas still exist', () => {
    expect(resolveViewState(full, articles, canvases)).toEqual({ ...full, recentIds: ['atlas', 'mira'] });
  });

  it('drops deleted ids and falls back to the editor when the canvas is gone', () => {
    const resolved = resolveViewState({ ...full, articleId: 'deleted', canvasId: 'deleted' }, articles, canvases);
    expect(resolved.articleId).toBeUndefined();
    expect(resolved.canvasId).toBeUndefined();
    expect(resolved.viewMode).toBe('editor');
  });

  it('keeps the canvas view when only the article is gone', () => {
    const resolved = resolveViewState({ ...full, articleId: 'deleted' }, articles, canvases);
    expect(resolved.viewMode).toBe('canvas');
    expect(resolved.canvasId).toBe('atlas');
  });
});

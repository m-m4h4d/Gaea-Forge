// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CanvasData, LoreArticle } from './database';
import { BACKUP_FORMAT, createBackup, parseWorldBackup, pruneCanvasesToArticles, restoreArticleLinks } from './backup';

const article: LoreArticle = {
  id: 'a1',
  title: 'Mira',
  category: 'Characters',
  content: '<p>Queen</p>',
  tags: ['royalty'],
  properties: [{ key: 'Age', value: '40' }],
  coverImage: 'data:image/png;base64,AAAA',
  isPinned: true,
  last_updated: 123,
};

const canvas: CanvasData = {
  id: 'c1',
  title: 'Web',
  type: 'world-web',
  nodes: [
    { id: 'n-a1', articleId: 'a1', label: 'Mira', category: 'Characters', x: 0, y: 0 },
    { id: 'n-a2', articleId: 'a2', label: 'Gone', category: 'Characters', x: 0, y: 0 },
    { id: 'n-free', label: 'Free', category: 'Notes', x: 0, y: 0 },
  ],
  connections: [
    { id: 'k1', fromNodeId: 'n-a1', toNodeId: 'n-a2', relationship: 'ally' },
    { id: 'k2', fromNodeId: 'n-a1', toNodeId: 'n-free', relationship: 'rival' },
  ],
  last_updated: 1,
};

describe('parseWorldBackup', () => {
  it('keeps a timeline calendar, dropping invalid parts', () => {
    const timeline: CanvasData = {
      id: 'tl', title: 'Chronicle', type: 'timeline', nodes: [], connections: [], last_updated: 1,
      calendar: { months: [{ name: 'Frostmere', days: 30 }, { name: 'Thaw' }], yearSuffix: 'AR', eraDates: true },
    };
    const roundTrip = parseWorldBackup(JSON.parse(JSON.stringify(createBackup([], [timeline]))))!;
    expect(roundTrip.canvases[0].calendar).toEqual(timeline.calendar);

    const junk = { ...timeline, calendar: { months: 'Frostmere', yearSuffix: '  ', eraDates: 1 } };
    const parsed = parseWorldBackup({ format: BACKUP_FORMAT, version: 1, articles: [], canvases: [junk] })!;
    expect(parsed.canvases[0]).not.toHaveProperty('calendar');
  });

  it('round-trips a backup through JSON unchanged', () => {
    const backup = createBackup([article], [canvas], 'ttrpg-dm');
    const parsed = parseWorldBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed).toEqual(backup);
  });

  it('returns null for files that are not full backups', () => {
    expect(parseWorldBackup([article])).toBeNull(); // legacy article-array export
    expect(parseWorldBackup({ articles: [article] })).toBeNull();
    expect(parseWorldBackup(null)).toBeNull();
    expect(parseWorldBackup('text')).toBeNull();
  });

  it('refuses backups from a newer format version', () => {
    expect(() => parseWorldBackup({ format: BACKUP_FORMAT, version: 99, articles: [] })).toThrow(
      /newer version/
    );
  });

  it('fills in missing fields and drops malformed entries', () => {
    const parsed = parseWorldBackup({
      format: BACKUP_FORMAT,
      version: 1,
      roleId: 'not-a-role',
      articles: [
        { id: 'x', title: 'Sparse' },
        { title: 'No id' },
        { id: 'y', title: 'Bad props', tags: ['ok', 3], properties: [{ key: 'k' }, { key: 'a', value: 'b' }] },
      ],
      canvases: [canvas, { id: 'bad', title: 'No type', nodes: [], connections: [] }],
    });

    expect(parsed?.roleId).toBeUndefined();
    expect(parsed?.articles.map((a) => a.id)).toEqual(['x', 'y']);
    expect(parsed?.articles[0]).toMatchObject({ category: 'Notes', content: '', tags: [], properties: [], isPinned: false });
    expect(parsed?.articles[1].tags).toEqual(['ok']);
    expect(parsed?.articles[1].properties).toEqual([{ key: 'a', value: 'b' }]);
    expect(parsed?.canvases.map((c) => c.id)).toEqual(['c1']);
  });

  it('keeps links between articles when restoring', () => {
    const linked = { ...article, content: '<p><a class="lore-link" data-lore-link="welcome-gaea-forge">Welcome</a></p>' };
    const parsed = parseWorldBackup(JSON.parse(JSON.stringify(createBackup([linked], []))));
    expect(parsed?.articles[0].content).toBe(linked.content);
  });

  it('accepts backups without canvases', () => {
    const parsed = parseWorldBackup({ format: BACKUP_FORMAT, version: 1, articles: [article] });
    expect(parsed?.canvases).toEqual([]);
  });
});

describe('pruneCanvasesToArticles', () => {
  it('removes nodes for missing articles and every connection touching them', () => {
    const [pruned] = pruneCanvasesToArticles([canvas], new Set(['a1']));
    expect(pruned.nodes.map((n) => n.id)).toEqual(['n-a1', 'n-free']);
    expect(pruned.connections.map((c) => c.id)).toEqual(['k2']);
  });

  it('returns only the canvases that changed', () => {
    expect(pruneCanvasesToArticles([canvas], new Set(['a1', 'a2']))).toEqual([]);
  });

  it('does not mutate the input canvas', () => {
    pruneCanvasesToArticles([canvas], new Set());
    expect(canvas.nodes).toHaveLength(3);
    expect(canvas.connections).toHaveLength(2);
  });
});

describe('timeline and map canvases', () => {
  const timeline: CanvasData = {
    id: 't1',
    title: 'History',
    type: 'timeline',
    nodes: [],
    connections: [],
    events: [
      { id: 'e1', title: 'Coronation', year: 40, month: 3, articleId: 'a1' },
      { id: 'e2', title: 'Fall', year: -12, articleId: 'gone', description: 'Ruin' },
    ],
    eras: [{ id: 'x', name: 'First Age', startYear: -100, endYear: 0 }],
    last_updated: 1,
  };
  const map: CanvasData = {
    id: 'm1',
    title: 'Realm',
    type: 'map',
    nodes: [{ id: 'pin', articleId: 'a1', label: 'Mira', category: 'Characters', x: 0.25, y: 0.5 }],
    connections: [],
    mapImage: 'data:image/png;base64,AAAA',
    last_updated: 1,
  };

  it('round-trips through a backup', () => {
    const backup = createBackup([article], [timeline, map]);
    expect(parseWorldBackup(JSON.parse(JSON.stringify(backup)))?.canvases).toEqual([timeline, map]);
  });

  it('drops malformed events and eras and non-image map data', () => {
    const parsed = parseWorldBackup({
      format: BACKUP_FORMAT,
      version: 1,
      articles: [],
      canvases: [
        { ...timeline, events: [{ id: 'ok', title: 'Ok', year: 1 }, { id: 'bad', title: 'No year' }, null], eras: [{ name: 'No id', startYear: 1 }] },
        { ...map, mapImage: 'javascript:alert(1)' },
      ],
    });
    expect(parsed?.canvases[0].events).toEqual([{ id: 'ok', title: 'Ok', year: 1 }]);
    expect(parsed?.canvases[0].eras).toEqual([]);
    expect(parsed?.canvases[1].mapImage).toBeUndefined();
  });

  it('removes pins and unlinks events when their article is deleted', () => {
    const [prunedTimeline, prunedMap] = pruneCanvasesToArticles([timeline, map], new Set(['other']));
    expect(prunedTimeline.events).toEqual([
      { id: 'e1', title: 'Coronation', year: 40, month: 3 },
      { id: 'e2', title: 'Fall', year: -12, description: 'Ruin' },
    ]);
    expect(prunedMap.nodes).toEqual([]);
  });

  it('leaves canvases alone when all their links still exist', () => {
    expect(pruneCanvasesToArticles([timeline, map], new Set(['a1', 'gone']))).toEqual([]);
  });
});

describe('restoreArticleLinks', () => {
  it('undoes pruning: nodes, their connections and timeline links come back', () => {
    const timeline: CanvasData = {
      id: 't',
      title: 'T',
      type: 'timeline',
      nodes: [],
      connections: [],
      events: [{ id: 'e', title: 'Crowned', year: 1, articleId: 'a1' }],
      last_updated: 1,
    };
    const before = [canvas, timeline];
    const pruned = pruneCanvasesToArticles(before, new Set(['a2']));
    const afterDelete = before.map((c) => pruned.find((p) => p.id === c.id) ?? c);

    const restored = restoreArticleLinks(afterDelete, before, 'a1');
    const web = restored.find((c) => c.id === 'c1')!;
    expect(web.nodes.map((n) => n.id).sort()).toEqual(['n-a1', 'n-a2', 'n-free']);
    expect(web.connections.map((c) => c.id).sort()).toEqual(['k1', 'k2']);
    expect(restored.find((c) => c.id === 't')!.events![0].articleId).toBe('a1');
  });

  it('keeps edits made after the deletion', () => {
    const [pruned] = pruneCanvasesToArticles([canvas], new Set(['a2']));
    const edited = { ...pruned, title: 'Renamed', nodes: [...pruned.nodes, { id: 'new', label: 'New', category: 'Notes', x: 5, y: 5 }] };
    const [restored] = restoreArticleLinks([edited], [canvas], 'a1');
    expect(restored.title).toBe('Renamed');
    expect(restored.nodes.map((n) => n.id).sort()).toEqual(['n-a1', 'n-a2', 'n-free', 'new']);
  });

  it('does not bring back connections to nodes that were removed separately', () => {
    const [pruned] = pruneCanvasesToArticles([canvas], new Set(['a2']));
    const withoutFree = { ...pruned, nodes: pruned.nodes.filter((n) => n.id !== 'n-free'), connections: [] };
    const [restored] = restoreArticleLinks([withoutFree], [canvas], 'a1');
    expect(restored.connections.map((c) => c.id)).toEqual(['k1']);
  });

  it('returns nothing when there is nothing to restore', () => {
    expect(restoreArticleLinks([canvas], [canvas], 'a1')).toEqual([]);
  });
});


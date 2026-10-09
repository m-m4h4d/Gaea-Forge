import { describe, expect, it } from 'vitest';
import { CanvasData, LoreArticle } from './database';
import { describeRenamePlan, isEmptyRenamePlan, planRename, renameLeadingHeading, renameLinkLabels } from './rename';

const article = (over: Partial<LoreArticle>): LoreArticle => ({
  id: 'x', title: 'Untitled', category: 'Characters', content: '', tags: [], properties: [], isPinned: false, last_updated: 0, ...over,
});
const link = (id: string, label: string) => `<a class="lore-link" data-lore-link="${id}">${label}</a>`;

describe('renameLinkLabels', () => {
  it('renames links whose label is the old title, case- and spacing-insensitively', () => {
    const html = `<p>${link('mira', 'Mira')} met ${link('mira', ' mira ')} and ${link('mira', 'the queen')}.</p>`;
    const result = renameLinkLabels(html, 'mira', 'Mira', 'Queen Mira');
    expect(result.count).toBe(2);
    expect(result.html).toBe(`<p>${link('mira', 'Queen Mira')} met ${link('mira', 'Queen Mira')} and ${link('mira', 'the queen')}.</p>`);
  });

  it('leaves links to other articles and formatted labels alone', () => {
    const html = `${link('mira-2', 'Mira')} ${link('mira', '<strong>Mira</strong>')}`;
    expect(renameLinkLabels(html, 'mira', 'Mira', 'Queen Mira').count).toBe(0);
  });

  it('escapes the new title and matches escaped old titles', () => {
    const result = renameLinkLabels(link('sw', 'Salt &amp; Steel'), 'sw', 'Salt & Steel', 'Salt <& Iron>');
    expect(result.html).toBe(link('sw', 'Salt &lt;&amp; Iron&gt;'));
  });

  it('handles ids with regex characters', () => {
    expect(renameLinkLabels(link('a.b(1)', 'Old'), 'a.b(1)', 'Old', 'New').count).toBe(1);
    expect(renameLinkLabels(link('aXb(1)', 'Old'), 'a.b(1)', 'Old', 'New').count).toBe(0);
  });
});

describe('renameLeadingHeading', () => {
  it('renames the first heading only when it is the old title', () => {
    expect(renameLeadingHeading('<h1>Mira</h1><p>Mira rules.</p>', 'Mira', 'Queen Mira')).toEqual({
      html: '<h1>Queen Mira</h1><p>Mira rules.</p>',
      changed: true,
    });
    expect(renameLeadingHeading('<h1>The Mira Saga</h1>', 'Mira', 'X').changed).toBe(false);
    expect(renameLeadingHeading('<p>x</p><h1>Mira</h1>', 'Mira', 'X').changed).toBe(false);
  });
});

describe('planRename', () => {
  const mira = article({ id: 'mira', title: 'Queen Mira', content: '<h1>Mira</h1><p>Rules Ashfall.</p>' });
  const ash = article({ id: 'ash', title: 'Ashfall', content: `<p>Ruled by ${link('mira', 'Mira')}, ${link('mira', 'her majesty')}.</p>` });
  const other = article({ id: 'other', title: 'Other', content: '<p>Mira is mentioned without a link.</p>' });
  const web: CanvasData = {
    id: 'web', title: 'Web', type: 'world-web', last_updated: 0, connections: [],
    nodes: [
      { id: 'n1', articleId: 'mira', label: 'Mira', category: 'Characters', x: 0, y: 0 },
      { id: 'n2', articleId: 'mira', label: 'The Queen', category: 'Characters', x: 0, y: 0 },
      { id: 'n3', label: 'Mira', category: 'Characters', x: 0, y: 0 },
    ],
  };
  const timeline: CanvasData = {
    id: 'tl', title: 'Chronicle', type: 'timeline', last_updated: 0, nodes: [], connections: [],
    events: [
      { id: 'e1', title: 'Mira', year: 1, articleId: 'mira' },
      { id: 'e2', title: 'Coronation', year: 2, articleId: 'mira' },
    ],
  };
  const untouched: CanvasData = { ...web, id: 'untouched', nodes: [] };

  it('updates link labels, the heading, node labels and event titles that repeat the old title', () => {
    const plan = planRename('mira', 'Mira', 'Queen Mira', [mira, ash, other], [web, timeline, untouched]);
    expect(plan.linkCount).toBe(1);
    expect(plan.headingUpdated).toBe(true);
    expect(plan.canvasLabelCount).toBe(2);
    expect(plan.articles.map((a) => a.id)).toEqual(['mira', 'ash']);
    expect(plan.articles[0].content).toBe('<h1>Queen Mira</h1><p>Rules Ashfall.</p>');
    expect(plan.articles[1].content).toContain(link('mira', 'Queen Mira'));
    expect(plan.articles[1].content).toContain(link('mira', 'her majesty'));
    expect(plan.canvases.map((c) => c.id)).toEqual(['web', 'tl']);
    expect(plan.canvases[0].nodes.map((n) => n.label)).toEqual(['Queen Mira', 'The Queen', 'Mira']);
    expect(plan.canvases[1].events!.map((e) => e.title)).toEqual(['Queen Mira', 'Coronation']);
    expect(describeRenamePlan(plan)).toBe('1 link, its heading and 2 canvas labels');
  });

  it('does nothing for an unchanged, empty or whitespace-only rename', () => {
    expect(isEmptyRenamePlan(planRename('mira', 'Mira', ' Mira ', [mira, ash], [web]))).toBe(true);
    expect(isEmptyRenamePlan(planRename('mira', 'Mira', '   ', [mira, ash], [web]))).toBe(true);
    expect(isEmptyRenamePlan(planRename('mira', '', 'Mira', [mira, ash], [web]))).toBe(true);
  });

  it('treats a change of case as a rename, counting only text that actually changes', () => {
    const lower = article({ id: 'low', content: `<p>${link('mira', 'mira')} and ${link('mira', 'Mira')}</p>` });
    const plan = planRename('mira', 'mira', 'Mira', [lower], [web]);
    expect(plan.linkCount).toBe(1);
    expect(plan.articles[0].content).toBe(`<p>${link('mira', 'Mira')} and ${link('mira', 'Mira')}</p>`);
    // The node already reads "Mira"
    expect(plan.canvasLabelCount).toBe(0);
    expect(isEmptyRenamePlan(planRename('mira', 'mira', 'Mira', [ash], [web]))).toBe(true);
  });
});

describe('describeRenamePlan', () => {
  const plan = (linkCount: number, headingUpdated: boolean, canvasLabelCount: number) =>
    ({ articles: [], canvases: [], linkCount, headingUpdated, canvasLabelCount });
  it('lists what will change', () => {
    expect(describeRenamePlan(plan(3, false, 0))).toBe('3 links');
    expect(describeRenamePlan(plan(1, true, 0))).toBe('1 link and its heading');
    expect(describeRenamePlan(plan(0, false, 1))).toBe('1 canvas label');
  });
});

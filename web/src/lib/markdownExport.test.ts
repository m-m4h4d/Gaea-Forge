import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { CanvasData, LoreArticle } from './database';
import { buildMarkdownDocument, buildMarkdownFiles, buildMarkdownZip, headingSlug, safeName } from './markdownExport';

const article = (over: Partial<LoreArticle>): LoreArticle => ({
  id: 'x', title: 'Untitled', category: 'Characters & Cast', content: '', tags: [], properties: [], isPinned: false, last_updated: 0, ...over,
});
const link = (id: string, label: string) => `<a class="lore-link" data-lore-link="${id}">${label}</a>`;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const mira = article({
  id: 'mira', title: 'Queen Mira', tags: ['royal'], isPinned: true, coverImage: PNG,
  properties: [{ key: 'Role', value: 'Queen' }, { key: 'Motto: "Ever"', value: '' }],
  content: `<h1>Queen Mira</h1><h2>Background</h2><p>Rules ${link('ash', 'Ashfall')} and mourns ${link('gone', 'Old King')}. <strong>Bold</strong>.</p><ul><li><p>one</p></li></ul>`,
});
const ash = article({ id: 'ash', title: 'Ashfall', category: 'Realms & Locations', content: `<h1>Ashfall</h1><p>Seat of ${link('mira', 'the queen')}.</p>` });
const twin = article({ id: 'twin', title: 'Queen Mira', content: '<p>A namesake.</p>' });
const timeline: CanvasData = {
  id: 'tl', title: 'Chronicle', type: 'timeline', nodes: [], connections: [], last_updated: 0,
  eras: [{ id: 'r', name: 'the Restoration', startYear: 410 }],
  events: [{ id: 'e', title: 'Coronation', year: 412, month: 1, day: 15, articleId: 'mira', description: 'Crowned\nat dawn' }],
  calendar: { months: [{ name: 'Frostmere' }], yearSuffix: 'AR' },
};
const web: CanvasData = {
  id: 'web', title: 'Court', type: 'world-web', last_updated: 0,
  nodes: [
    { id: 'n1', articleId: 'mira', label: 'Mira', category: 'Characters', x: 0, y: 0 },
    { id: 'n2', articleId: 'ash', label: 'Ashfall', category: 'Realms', x: 0, y: 0 },
    { id: 'n3', label: 'Loose Thread', category: 'Notes', x: 0, y: 0 },
  ],
  connections: [{ id: 'c', fromNodeId: 'n1', toNodeId: 'n2', relationship: 'ally' }],
};
const map: CanvasData = {
  id: 'map', title: 'Atlas', type: 'map', mapImage: PNG, connections: [], last_updated: 0,
  nodes: [{ id: 'p', articleId: 'ash', label: 'Ashfall', category: 'Realms', x: 0.5, y: 0.5 }],
};
const world = { articles: [mira, ash, twin], canvases: [timeline, web, map] };
const at = new Date(2026, 9, 9);

describe('safeName and headingSlug', () => {
  it('makes names safe for files and Obsidian', () => {
    expect(safeName('  What? A/B: [Notes] #1 ')).toBe('What- A-B- -Notes- -1');
    expect(safeName('...')).toBe('Untitled');
  });
  it('slugs headings like GitHub', () => {
    expect(headingSlug('Queen Mira & the Court!')).toBe('queen-mira--the-court');
    expect(headingSlug('Éowyn')).toBe('éowyn');
  });
});

describe('buildMarkdownFiles', () => {
  const files = buildMarkdownFiles(world, at);
  const text = (path: string) => strFromU8(files[path]);

  it('writes one file per article in category folders, with unique names', () => {
    expect(Object.keys(files).sort()).toEqual([
      'Canvases/Atlas.md',
      'Canvases/Chronicle.md',
      'Canvases/Court.md',
      'Characters & Cast/Queen Mira (2).md',
      'Characters & Cast/Queen Mira.md',
      'Index.md',
      'Realms & Locations/Ashfall.md',
      'images/map.png',
      'images/mira.png',
    ]);
  });

  it('puts metadata in front matter and converts links and formatting', () => {
    const md = text('Characters & Cast/Queen Mira.md');
    expect(md).toContain('---\ntitle: "Queen Mira"\ncategory: "Characters & Cast"\ntags: ["royal"]\nproperties:\n  "Role": "Queen"\n  "Motto: \\"Ever\\"": ""\npinned: true\n---');
    expect(md).toContain('![Queen Mira](../images/mira.png)');
    expect(md).toContain('# Queen Mira\n\n## Background');
    expect(md).toContain('Rules [Ashfall](../Realms%20%26%20Locations/Ashfall.md) and mourns Old King. **Bold**.');
    expect(md).toContain('-   one');
    expect(text('Realms & Locations/Ashfall.md')).toContain('Seat of [the queen](../Characters%20%26%20Cast/Queen%20Mira.md).');
  });

  it('exports canvases: timelines in their calendar, relationships and map pins', () => {
    expect(text('Canvases/Chronicle.md')).toBe(
      '# Chronicle\n\n### the Restoration\n\n*410 AR onward*\n\n- **15 Frostmere 412 AR**: Coronation ([Queen Mira](../Characters%20%26%20Cast/Queen%20Mira.md)) — Crowned at dawn\n'
    );
    const court = text('Canvases/Court.md');
    expect(court).toContain('- [Queen Mira](../Characters%20%26%20Cast/Queen%20Mira.md) — ally of — [Ashfall](../Realms%20%26%20Locations/Ashfall.md)');
    expect(court).toContain('Also on this canvas: Loose Thread');
    expect(text('Canvases/Atlas.md')).toContain('![Atlas](../images/map.png)\n\n### Pins\n\n- [Ashfall]');
  });

  it('writes the image bytes and an index', () => {
    expect(Array.from(files['images/mira.png'].slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(text('Index.md')).toContain('## Characters & Cast\n\n- [Queen Mira](Characters%20%26%20Cast/Queen%20Mira.md)');
  });

  it('zips the same files', () => {
    expect(Object.keys(unzipSync(buildMarkdownZip(world, at))).sort()).toEqual(Object.keys(files).sort());
  });
});

describe('buildMarkdownDocument', () => {
  const doc = buildMarkdownDocument(world, 'Story Bible', at);

  it('has contents linking to every article, with GitHub-style anchors for repeated titles', () => {
    expect(doc).toContain('- [Characters & Cast](#characters--cast)\n  - [Queen Mira](#queen-mira)\n  - [Queen Mira](#queen-mira-1)');
    expect(doc).toContain('- [Canvases](#canvases)');
  });

  it('nests each article under its category, without repeating its title', () => {
    expect(doc).toContain('### Queen Mira\n\n**Role:** Queen  \n**Tags:** royal\n\n#### Background');
    expect(doc).not.toContain('\n# Queen Mira');
    expect(doc).toContain('Rules [Ashfall](#ashfall) and mourns Old King.');
  });

  it('includes canvases without images', () => {
    expect(doc).toContain('### Chronicle\n\n#### the Restoration');
    expect(doc).not.toContain('![');
    expect(doc).not.toContain('@@gaea-anchor');
  });
});

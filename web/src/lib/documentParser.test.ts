// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { articlesToDrafts, convertTextToHtml, parseDocumentFile, recategorizeDrafts, segmentDocumentText } from './documentParser';
import { FANTASY_BIBLE, SCIFI_GUIDE } from './__fixtures__/importSamples';
import { defaultImportRules } from './importRules';

describe('convertTextToHtml', () => {
  it('escapes HTML in the title and body', () => {
    const html = convertTextToHtml('<script>', 'a < b & "c"');
    expect(html).toContain('<h1>&lt;script&gt;</h1>');
    expect(html).toContain('a &lt; b &amp; &quot;c&quot;');
  });

  it('converts markdown headings, bullet lists and bold text', () => {
    const html = convertTextToHtml('T', '## Section\n- one\n- **two**\n\nAfter');
    expect(html).toBe(
      '<h1>T</h1><h2>Section</h2><ul><li>one</li><li><strong>two</strong></li></ul><p>After</p>'
    );
  });

  it('bolds a leading "Key:" label', () => {
    expect(convertTextToHtml('T', 'Capital City: Aethelia')).toContain(
      '<p><strong>Capital City:</strong> Aethelia</p>'
    );
  });
});

describe('segmentDocumentText', () => {
  it('splits markdown sections into separate drafts with extracted properties', () => {
    const drafts = segmentDocumentText(
      '## Alpha Hero\nAge: 30\nA brave soul.\n\n## Beta City\nA city on a lake.\n',
      'author-bible'
    );
    expect(drafts.map((d) => d.title)).toEqual(['Alpha Hero', 'Beta City']);
    expect(drafts[0].properties).toEqual([{ key: 'Age', value: '30' }]);
    expect(drafts.every((d) => d.selected)).toBe(true);
    expect(new Set(drafts.map((d) => d.id)).size).toBe(2);
  });

  it('maps drafts onto the active role’s categories', () => {
    const [draft] = segmentDocumentText('## Captain Roric\nA soldier.', 'game-dev');
    expect(draft.category).toBe('Characters & NPCs');
  });

  it('keeps headerless text as a single draft', () => {
    const drafts = segmentDocumentText('just some notes in lowercase.\nmore notes here.', 'personal-notes');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rawText).toContain('more notes here.');
  });
});

describe('articlesToDrafts', () => {
  it('keeps structured fields and fills in defaults', () => {
    const drafts = articlesToDrafts(
      [
        { id: 'a', title: 'Mira', category: 'Characters', content: '<p>x</p>', tags: ['t'], coverImage: 'data:x' },
        { title: '' },
        null,
        'junk',
      ],
      'author-bible'
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ id: 'a', title: 'Mira', contentHtml: '<p>x</p>', coverImage: 'data:x' });
    expect(drafts[1].title).toBe('Untitled Lore');
    expect(drafts[1].id).toMatch(/^json-import-/);
    expect(drafts[1].category).toBe('Plot & Chapters');
  });
});

describe('parseDocumentFile', () => {
  const jsonFile = (value: unknown) =>
    new File([JSON.stringify(value)], 'world.json', { type: 'application/json' });

  it('reads a legacy array export', async () => {
    const drafts = await parseDocumentFile(jsonFile([{ id: 'a', title: 'Mira' }]), 'author-bible');
    expect(drafts.map((d) => d.id)).toEqual(['a']);
  });

  it('reads the articles of a full backup object', async () => {
    const drafts = await parseDocumentFile(
      jsonFile({ format: 'gaea-forge-backup', version: 1, articles: [{ id: 'b', title: 'Keep' }] }),
      'author-bible'
    );
    expect(drafts.map((d) => d.id)).toEqual(['b']);
  });

  it('rejects other JSON instead of treating it as prose', async () => {
    await expect(parseDocumentFile(jsonFile({ hello: 'world' }), 'author-bible')).rejects.toThrow(
      /not a Gaea-Forge backup/
    );
  });

  it('segments markdown files', async () => {
    const file = new File(['# Notes\n\n## One\nThe first entry.\n\n## Two\nThe second entry.'], 'notes.md');
    const drafts = await parseDocumentFile(file, 'author-bible');
    expect(drafts.map((d) => d.title)).toEqual(['One', 'Two']);
  });
});

describe('segmentation and categorizing without world-specific rules', () => {
  const summary = (doc: string, role: Parameters<typeof segmentDocumentText>[1]) =>
    segmentDocumentText(doc, role).map((d) => `${d.title} -> ${d.category}`);

  it('sorts a fantasy world bible into the author categories', () => {
    expect(summary(FANTASY_BIBLE, 'author-bible')).toEqual([
      'The Aethelian Dominion -> Kingdoms & Factions',
      'The Harkness Empire -> Kingdoms & Factions',
      'Roric Houstan (The Captain) -> Characters & Cast',
      'Mira Vale -> Characters & Cast',
      'Vampires -> Bestiary & Species',
      'Werewolves -> Bestiary & Species',
      'Stone of Embers -> Magic & Relics',
    ]);
  });

  it('sorts a sci-fi guide for different roles', () => {
    expect(summary(SCIFI_GUIDE, 'author-bible')).toEqual([
      'The Solar Compact -> Kingdoms & Factions',
      'Rust Collective -> Kingdoms & Factions',
      'Commander Ines Okafor -> Characters & Cast',
      'Dr. Tarik Venn -> Characters & Cast',
      'Ceres Port -> Realms & Locations',
      'Vesta Station -> Realms & Locations',
      'Fold Drive -> Magic & Relics',
      'Plasma Lance -> Magic & Relics',
    ]);
    expect(summary(SCIFI_GUIDE, 'game-dev')).toEqual([
      'The Solar Compact -> Factions & Guilds',
      'Rust Collective -> Factions & Guilds',
      'Commander Ines Okafor -> Characters & NPCs',
      'Dr. Tarik Venn -> Characters & NPCs',
      'Ceres Port -> Levels & Biomes',
      'Vesta Station -> Levels & Biomes',
      'Fold Drive -> Game Systems & Mechanics',
      'Plasma Lance -> Weapons & Items',
    ]);
  });

  it('keeps "Key: Value" lines as properties, never as new entries', () => {
    const [dominion] = segmentDocumentText(FANTASY_BIBLE, 'author-bible');
    expect(dominion.properties).toEqual([
      { key: 'Capital City', value: 'Aethelia' },
      { key: 'Ruler', value: 'High Regent Calder' },
    ]);
  });

  it('treats a lone "Label:" line as a subheading inside the entry', () => {
    const roric = segmentDocumentText(FANTASY_BIBLE, 'author-bible')[2];
    expect(roric.contentHtml).toContain('<h3>Identity &amp; Personality</h3>');
    expect(roric.rawText).toContain('A stern veteran soldier');
  });

  it('tags entries with the section they came from', () => {
    const drafts = segmentDocumentText(FANTASY_BIBLE, 'author-bible');
    expect(drafts.map((d) => d.tags[0])).toEqual([
      'governments', 'governments', 'characters', 'characters', 'bestiary', 'bestiary', 'gemstones',
    ]);
  });

  it('recognizes ALL CAPS section headings', () => {
    const drafts = segmentDocumentText('THE NORTHERN REACHES\n\nFrostgate\nA walled city in the snow.', 'author-bible');
    expect(drafts.map((d) => [d.title, d.sectionContext])).toEqual([['Frostgate', 'THE NORTHERN REACHES']]);
  });

  it('applies custom keyword rules', () => {
    const rules = defaultImportRules('author-bible').map((r) =>
      r.category === 'Plot & Chapters' ? { ...r, keywords: [...r.keywords, 'gemstone'] } : r
    );
    const stone = segmentDocumentText(FANTASY_BIBLE, 'author-bible', rules).at(-1)!;
    expect(stone.category).toBe('Plot & Chapters');
  });
});

describe('recategorizeDrafts', () => {
  it('re-sorts drafts with new rules but keeps locked categories', () => {
    const drafts = segmentDocumentText(SCIFI_GUIDE, 'author-bible');
    drafts[0] = { ...drafts[0], category: 'Plot & Chapters', categoryLocked: true };
    // Move "technology" from Magic & Relics to Realms & Locations
    const rules = defaultImportRules('author-bible').map((r) =>
      r.category === 'Realms & Locations'
        ? { ...r, keywords: [...r.keywords, 'technology'] }
        : r.category === 'Magic & Relics'
          ? { ...r, keywords: ['magic', 'relic'] }
          : r
    );
    const resorted = recategorizeDrafts(drafts, 'author-bible', rules);
    expect(resorted[0].category).toBe('Plot & Chapters');
    expect(resorted.find((d) => d.title === 'Fold Drive')!.category).toBe('Realms & Locations');
  });

  it('never re-sorts already-structured JSON imports', () => {
    const [draft] = articlesToDrafts([{ id: 'a', title: 'Mira', category: 'Characters & Cast' }], 'author-bible');
    expect(draft.categoryLocked).toBe(true);
  });
});


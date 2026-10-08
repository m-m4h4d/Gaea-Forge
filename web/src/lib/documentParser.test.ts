import { describe, expect, it } from 'vitest';
import { articlesToDrafts, convertTextToHtml, parseDocumentFile, segmentDocumentText } from './documentParser';

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

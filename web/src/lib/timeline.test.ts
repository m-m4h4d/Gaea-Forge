import { describe, expect, it } from 'vitest';
import { CanvasData, TimelineEra, TimelineEvent } from './database';
import {
  buildTimelineSections,
  compareEvents,
  eraForYear,
  findArticleEvents,
  formatEraRange,
  eraToDraft,
  eventToDraft,
  formatEventDate,
  parseEraDraft,
  parseEventDraft,
} from './timeline';

const ev = (id: string, year: number, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id,
  title: id,
  year,
  ...extra,
});
const era = (id: string, startYear: number, endYear?: number): TimelineEra => ({ id, name: id, startYear, endYear });

describe('compareEvents', () => {
  it('orders by year, then month, then day, then title, including negative years', () => {
    const sorted = [ev('b', 10, { month: 2 }), ev('a', 10, { month: 2 }), ev('c', 10), ev('d', -5), ev('e', 10, { month: 2, day: 1 })]
      .sort(compareEvents)
      .map((e) => e.id);
    expect(sorted).toEqual(['d', 'c', 'a', 'b', 'e']);
  });
});

describe('formatEventDate / formatEraRange', () => {
  it('formats years, months, days and spans', () => {
    expect(formatEventDate(ev('x', 412))).toBe('412');
    expect(formatEventDate(ev('x', -30, { month: 3, day: 15 }))).toBe('-30.3.15');
    expect(formatEventDate(ev('x', 412, { day: 9 }))).toBe('412'); // a day needs a month
    expect(formatEventDate(ev('x', 400, { endYear: 430 }))).toBe('400 – 430');
    expect(formatEventDate(ev('x', 400, { endYear: 400 }))).toBe('400');
    expect(formatEraRange(era('a', 0, 99))).toBe('0 – 99');
    expect(formatEraRange(era('a', 100))).toBe('100 onward');
  });
});

describe('eraForYear', () => {
  it('uses inclusive bounds, open-ended eras, and the latest-starting overlap', () => {
    const eras = [era('old', 0, 100), era('late', 50, 60), era('open', 200)];
    expect(eraForYear(100, eras)?.id).toBe('old');
    expect(eraForYear(55, eras)?.id).toBe('late');
    expect(eraForYear(150, eras)).toBeUndefined();
    expect(eraForYear(9999, eras)?.id).toBe('open');
  });
});

describe('buildTimelineSections', () => {
  it('interleaves eras (even empty ones) with runs of events outside any era', () => {
    const sections = buildTimelineSections(
      [ev('inA2', 20), ev('before1', -10), ev('before2', -5), ev('inA1', 10), ev('between', 150), ev('after', 999)],
      [era('B', 200, 300), era('A', 0, 100)]
    );
    expect(
      sections.map((s) => (s.kind === 'era' ? `era:${s.era.id}[${s.events.map((e) => e.id)}]` : `loose[${s.events.map((e) => e.id)}]`))
    ).toEqual(['loose[before1,before2]', 'era:A[inA1,inA2]', 'loose[between]', 'era:B[]', 'loose[after]']);
  });

  it('works with no eras', () => {
    expect(buildTimelineSections([ev('b', 2), ev('a', 1)], [])).toEqual([{ kind: 'loose', events: [ev('a', 1), ev('b', 2)] }]);
  });
});

describe('findArticleEvents', () => {
  it('finds linked events across timelines in date order', () => {
    const canvas = (id: string, events: TimelineEvent[], type: CanvasData['type'] = 'timeline'): CanvasData => ({
      id,
      title: id,
      type,
      nodes: [],
      connections: [],
      events,
      last_updated: 0,
    });
    const found = findArticleEvents(
      [canvas('t1', [ev('late', 50, { articleId: 'mira' }), ev('other', 1)]), canvas('t2', [ev('early', 5, { articleId: 'mira' })]), canvas('w', [ev('ignored', 0, { articleId: 'mira' })], 'world-web')],
      'mira'
    );
    expect(found.map((f) => `${f.canvasId}:${f.event.id}`)).toEqual(['t2:early', 't1:late']);
  });
});

describe('parseEventDraft', () => {
  const draft = (over: Partial<import('./timeline').EventDraft>) => ({
    title: 'Coronation', year: '412', month: '', day: '', endYear: '', articleId: '', description: '', ...over,
  });

  it('parses a full event and drops empty optional fields', () => {
    expect(parseEventDraft(draft({ year: ' -30 ', month: '3', day: '15', endYear: '-20', articleId: 'mira', description: ' Long live ' }))).toEqual({
      ok: true,
      value: { title: 'Coronation', year: -30, month: 3, day: 15, endYear: -20, articleId: 'mira', description: 'Long live' },
    });
    expect(parseEventDraft(draft({}))).toEqual({ ok: true, value: { title: 'Coronation', year: 412 } });
    // An end year equal to the start is not a span
    expect(parseEventDraft(draft({ endYear: '412' }))).toEqual({ ok: true, value: { title: 'Coronation', year: 412 } });
  });

  it.each([
    [{ title: '  ' }, /title/],
    [{ year: '' }, /Year must/],
    [{ year: '4.5' }, /Year must/],
    [{ month: '0' }, /Month/],
    [{ day: '2' }, /Add a month/],
    [{ endYear: '300' }, /before the year/],
    [{ endYear: 'soon' }, /End year must/],
  ])('rejects %o', (over, message) => {
    const result = parseEventDraft(draft(over));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('round-trips through eventToDraft', () => {
    const event = { id: 'e', title: 'T', year: -1, month: 2, day: 3, endYear: 5, articleId: 'a', description: 'd' };
    const parsed = parseEventDraft(eventToDraft(event));
    expect(parsed).toEqual({ ok: true, value: { title: 'T', year: -1, month: 2, day: 3, endYear: 5, articleId: 'a', description: 'd' } });
  });
});

describe('parseEraDraft', () => {
  it('parses open and closed eras and rejects bad ranges', () => {
    expect(parseEraDraft({ name: ' Age of Ash ', startYear: '-100', endYear: '' })).toEqual({ ok: true, value: { name: 'Age of Ash', startYear: -100 } });
    expect(parseEraDraft({ name: 'A', startYear: '0', endYear: '99' })).toEqual({ ok: true, value: { name: 'A', startYear: 0, endYear: 99 } });
    expect(parseEraDraft({ name: 'A', startYear: '10', endYear: '5' }).ok).toBe(false);
    expect(parseEraDraft({ name: '', startYear: '10', endYear: '' }).ok).toBe(false);
    expect(eraToDraft({ id: 'x', name: 'A', startYear: 1 })).toEqual({ name: 'A', startYear: '1', endYear: '' });
  });
});

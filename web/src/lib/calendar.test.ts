import { describe, expect, it } from 'vitest';
import { TimelineEra, TimelineEvent } from './database';
import {
  calendarToDraft,
  checkEventDate,
  formatAbsoluteDate,
  formatCalendarDate,
  formatYear,
  GREGORIAN_MONTHS,
  monthsToText,
  normalizeCalendar,
  parseCalendarDraft,
  parseMonthsText,
  TimelineCalendar,
} from './calendar';

const ev = (year: number, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({ id: 'e', title: 'Coronation', year, ...extra });
const restoration: TimelineEra = { id: 'r', name: 'the Restoration', startYear: 410, endYear: 450 };
const frost: TimelineCalendar = {
  months: [{ name: 'Frostmere', days: 30 }, { name: 'Thaw' }, { name: 'Emberwane', days: 28 }],
  yearSuffix: 'AR',
  beforeSuffix: 'BR',
};

describe('formatting without a calendar', () => {
  it('looks exactly as before', () => {
    expect(formatAbsoluteDate(ev(412))).toBe('412');
    expect(formatAbsoluteDate(ev(-30, { month: 3, day: 15 }))).toBe('-30.3.15');
    expect(formatAbsoluteDate(ev(400, { endYear: 430 }))).toBe('400 – 430');
    expect(formatCalendarDate(ev(412), undefined, restoration)).toBe('412');
  });
});

describe('formatYear', () => {
  it('adds the suffixes, dropping the minus sign before year 0', () => {
    expect(formatYear(412, frost)).toBe('412 AR');
    expect(formatYear(0, frost)).toBe('0 AR');
    expect(formatYear(-30, frost)).toBe('30 BR');
    expect(formatYear(-30, { yearSuffix: 'AR' })).toBe('-30 AR');
  });
});

describe('formatAbsoluteDate', () => {
  it('names months, day first', () => {
    expect(formatAbsoluteDate(ev(412, { month: 1, day: 15 }), frost)).toBe('15 Frostmere 412 AR');
    expect(formatAbsoluteDate(ev(412, { month: 2 }), frost)).toBe('Thaw 412 AR');
    expect(formatAbsoluteDate(ev(-30, { month: 3, day: 2 }), frost)).toBe('2 Emberwane 30 BR');
    expect(formatAbsoluteDate(ev(400, { endYear: 430 }), frost)).toBe('400 AR – 430 AR');
  });

  it('keeps numbered months when the calendar names none', () => {
    expect(formatAbsoluteDate(ev(-30, { month: 3, day: 15 }), { beforeSuffix: 'BR' })).toBe('30.3.15 BR');
    expect(formatAbsoluteDate(ev(412, { month: 3 }), { yearSuffix: 'AR' })).toBe('412.3 AR');
  });

  it('falls back to the number for a month the calendar lacks', () => {
    expect(formatAbsoluteDate(ev(412, { month: 9 }), frost)).toBe('9 412 AR');
  });
});

describe('formatCalendarDate with era dates', () => {
  const eraFrost = { ...frost, eraDates: true };
  it('counts years from the era, the first year being Year 1', () => {
    expect(formatCalendarDate(ev(410), eraFrost, restoration)).toBe('Year 1 of the Restoration');
    expect(formatCalendarDate(ev(412, { month: 1, day: 15 }), eraFrost, restoration)).toBe('15 Frostmere, Year 3 of the Restoration');
  });

  it('ends spans in the era relative to it, and others absolutely', () => {
    expect(formatCalendarDate(ev(412, { endYear: 420 }), eraFrost, restoration)).toBe('Year 3 of the Restoration – Year 11');
    expect(formatCalendarDate(ev(412, { endYear: 460 }), eraFrost, restoration)).toBe('Year 3 of the Restoration – 460 AR');
  });

  it('uses the absolute date outside eras or when turned off', () => {
    expect(formatCalendarDate(ev(300), eraFrost, undefined)).toBe('300 AR');
    expect(formatCalendarDate(ev(412), frost, restoration)).toBe('412 AR');
  });
});

describe('months text', () => {
  it('round-trips names and day counts', () => {
    const text = monthsToText(frost.months);
    expect(text).toBe('Frostmere: 30\nThaw\nEmberwane: 28');
    expect(parseMonthsText(text)).toEqual({ ok: true, value: frost.months });
  });

  it('ignores blank lines and spacing, and allows colons in names', () => {
    expect(parseMonthsText('\n  Deep Winter :  40 \n\nHigh:Sun\n')).toEqual({
      ok: true,
      value: [{ name: 'Deep Winter', days: 40 }, { name: 'High:Sun' }],
    });
  });

  it('rejects bad day counts and missing names', () => {
    expect(parseMonthsText('Frost: 0')).toMatchObject({ ok: false });
    expect(parseMonthsText('Frost: 2.5')).toMatchObject({ ok: false });
    expect(parseMonthsText(': 30')).toMatchObject({ ok: false, error: 'Month 1 needs a name.' });
  });

  it('round-trips the Gregorian preset', () => {
    expect(parseMonthsText(monthsToText(GREGORIAN_MONTHS))).toEqual({ ok: true, value: GREGORIAN_MONTHS });
  });
});

describe('parseCalendarDraft', () => {
  it('builds a calendar, or none when everything is empty', () => {
    expect(parseCalendarDraft(calendarToDraft(frost))).toEqual({ ok: true, value: frost });
    expect(parseCalendarDraft({ monthsText: ' ', yearSuffix: ' ', beforeSuffix: '', eraDates: false })).toEqual({ ok: true, value: undefined });
  });

  it('refuses to drop months or days that events use', () => {
    const events = [ev(412, { month: 3, day: 20, title: 'Ember Feast' })];
    const twoMonths = { ...calendarToDraft(frost), monthsText: 'Frostmere: 30\nThaw' };
    expect(parseCalendarDraft(twoMonths, events)).toMatchObject({ ok: false, error: expect.stringContaining('"Ember Feast" is in month 3') });
    const shortEmber = { ...calendarToDraft(frost), monthsText: 'Frostmere\nThaw\nEmberwane: 10' };
    expect(parseCalendarDraft(shortEmber, events)).toMatchObject({ ok: false, error: expect.stringContaining('day 20 of Emberwane, which has 10 days') });
  });
});

describe('checkEventDate', () => {
  it('only checks against named months', () => {
    expect(checkEventDate({ month: 13 }, undefined)).toBeNull();
    expect(checkEventDate({ month: 2, day: 99 }, frost)).toBeNull(); // Thaw has no fixed length
    expect(checkEventDate({ month: 1, day: 31 }, frost)).toMatch(/Frostmere, which has 30 days/);
  });
});

describe('normalizeCalendar', () => {
  it('keeps valid parts and drops the rest', () => {
    expect(normalizeCalendar(frost)).toEqual(frost);
    expect(
      normalizeCalendar({ months: [{ name: ' A ', days: 0 }, { name: '' }, 'x', { name: 'B', days: 12 }], yearSuffix: 5, eraDates: 'yes' })
    ).toEqual({ months: [{ name: 'A' }, { name: 'B', days: 12 }] });
    expect(normalizeCalendar({})).toBeUndefined();
    expect(normalizeCalendar('calendar')).toBeUndefined();
  });
});

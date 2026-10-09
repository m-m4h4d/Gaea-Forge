// A timeline's own calendar: named months (with optional lengths), year labels such
// as "412 AR" / "30 BR", and dates told relative to their era ("Year 3 of the Age of
// Ash"). Events keep storing plain numbers (year, 1-based month, day); the calendar
// only changes how they are entered, checked and shown. Without a calendar, dates
// look exactly as before: "412", "412.3.15", "400 – 430".
import type { TimelineEra, TimelineEvent } from './database';

export type CalendarMonth = { name: string; days?: number };

export type TimelineCalendar = {
  // Named months in order; their number is the months in a year. Empty: numbered months.
  months?: CalendarMonth[];
  // After years from 0 on, e.g. "AR" (412 AR)
  yearSuffix?: string;
  // For years before 0, shown without the minus sign, e.g. "BR" (-30 -> 30 BR)
  beforeSuffix?: string;
  // Show dates inside an era as "Year 3 of the Age of Ash"
  eraDates?: boolean;
};

export const MAX_MONTHS = 100;
export const MAX_DAYS = 1000;

// The year's number as shown and the label after it
function yearParts(year: number, calendar?: TimelineCalendar): { number: string; suffix: string } {
  if (year < 0 && calendar?.beforeSuffix) return { number: String(-year), suffix: ` ${calendar.beforeSuffix}` };
  return { number: String(year), suffix: calendar?.yearSuffix ? ` ${calendar.yearSuffix}` : '' };
}

export function formatYear(year: number, calendar?: TimelineCalendar): string {
  const { number, suffix } = yearParts(year, calendar);
  return number + suffix;
}

// The month's name, or its number when the calendar doesn't name it
export function monthLabel(month: number, calendar?: TimelineCalendar): string {
  return calendar?.months?.[month - 1]?.name ?? String(month);
}

const hasNamedMonths = (calendar?: TimelineCalendar) => Boolean(calendar?.months?.length);

// Month and day without the year: "15 Frostmere", "Frostmere", or "3.15" when numbered
function dayAndMonth(event: Pick<TimelineEvent, 'month' | 'day'>, calendar?: TimelineCalendar): string {
  if (event.month === undefined) return '';
  if (!hasNamedMonths(calendar)) return event.day !== undefined ? `${event.month}.${event.day}` : String(event.month);
  const name = monthLabel(event.month, calendar);
  return event.day !== undefined ? `${event.day} ${name}` : name;
}

// The plain date, ignoring eras: "15 Frostmere 412 AR", "412.3.15", "400 – 430"
export function formatAbsoluteDate(event: TimelineEvent, calendar?: TimelineCalendar): string {
  const parts = dayAndMonth(event, calendar);
  let label: string;
  if (!parts) label = formatYear(event.year, calendar);
  else if (hasNamedMonths(calendar)) label = `${parts} ${formatYear(event.year, calendar)}`;
  else {
    // Numbered months keep the original "year.month.day" form
    const { number, suffix } = yearParts(event.year, calendar);
    label = `${number}.${parts}${suffix}`;
  }
  if (event.endYear !== undefined && event.endYear !== event.year) label += ` – ${formatYear(event.endYear, calendar)}`;
  return label;
}

// "Year 3 of the Age of Ash" (the era's first year is Year 1)
export function formatEraYear(year: number, era: TimelineEra): string {
  return `Year ${year - era.startYear + 1} of ${era.name}`;
}

// The date as shown on the timeline: era-relative when the calendar asks for it
// and the event falls in an era, otherwise the absolute date
export function formatCalendarDate(event: TimelineEvent, calendar?: TimelineCalendar, era?: TimelineEra): string {
  if (!calendar?.eraDates || !era) return formatAbsoluteDate(event, calendar);
  const parts = dayAndMonth(event, calendar);
  let label = formatEraYear(event.year, era);
  if (parts) label = `${parts}, ${label}`;
  if (event.endYear !== undefined && event.endYear !== event.year) {
    const endsInEra = era.endYear === undefined || event.endYear <= era.endYear;
    label += endsInEra ? ` – Year ${event.endYear - era.startYear + 1}` : ` – ${formatYear(event.endYear, calendar)}`;
  }
  return label;
}

// ---- Editing ----

// "Frostmere: 30" per line (the day count is optional) <-> months
export function monthsToText(months: CalendarMonth[] = []): string {
  return months.map((m) => (m.days ? `${m.name}: ${m.days}` : m.name)).join('\n');
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseMonthsText(text: string): Parsed<CalendarMonth[]> {
  const months: CalendarMonth[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    // A trailing ": 30" is the day count; any other colon is part of the name
    const match = /^(.*):\s*(-?[\d.]+)$/.exec(line);
    const name = (match ? match[1] : line).trim();
    if (!name) return { ok: false, error: `Month ${index + 1} needs a name.` };
    if (!match) {
      months.push({ name });
      continue;
    }
    const days = Number(match[2]);
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      return { ok: false, error: `"${name}" has ${match[2]} days; use a whole number from 1 to ${MAX_DAYS}.` };
    }
    months.push({ name, days });
  }
  if (months.length > MAX_MONTHS) return { ok: false, error: `A year can have at most ${MAX_MONTHS} months.` };
  return { ok: true, value: months };
}

export type CalendarDraft = { monthsText: string; yearSuffix: string; beforeSuffix: string; eraDates: boolean };

export function calendarToDraft(calendar?: TimelineCalendar): CalendarDraft {
  return {
    monthsText: monthsToText(calendar?.months),
    yearSuffix: calendar?.yearSuffix ?? '',
    beforeSuffix: calendar?.beforeSuffix ?? '',
    eraDates: Boolean(calendar?.eraDates),
  };
}

// Form -> calendar, refusing changes that would leave existing events with a month
// or day the calendar no longer has. Returns undefined for "no calendar".
export function parseCalendarDraft(draft: CalendarDraft, events: TimelineEvent[] = []): Parsed<TimelineCalendar | undefined> {
  const months = parseMonthsText(draft.monthsText);
  if (!months.ok) return months;
  const calendar: TimelineCalendar = {
    ...(months.value.length > 0 && { months: months.value }),
    ...(draft.yearSuffix.trim() && { yearSuffix: draft.yearSuffix.trim() }),
    ...(draft.beforeSuffix.trim() && { beforeSuffix: draft.beforeSuffix.trim() }),
    ...(draft.eraDates && { eraDates: true }),
  };
  for (const event of events) {
    const problem = checkEventDate(event, calendar);
    if (problem) return { ok: false, error: `"${event.title}" ${problem} Edit that event first, or keep the month.` };
  }
  return { ok: true, value: Object.keys(calendar).length > 0 ? calendar : undefined };
}

// Why a month/day doesn't fit the calendar, or null
export function checkEventDate(event: Pick<TimelineEvent, 'month' | 'day'>, calendar?: TimelineCalendar): string | null {
  const months = calendar?.months;
  if (!months?.length || event.month === undefined) return null;
  if (event.month > months.length) return `is in month ${event.month}, but the calendar has ${months.length} months.`;
  const { name, days } = months[event.month - 1];
  if (days !== undefined && event.day !== undefined && event.day > days) return `is on day ${event.day} of ${name}, which has ${days} days.`;
  return null;
}

// Twelve months with their usual lengths, as a starting point
export const GREGORIAN_MONTHS: CalendarMonth[] = [
  ['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30],
  ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31],
].map(([name, days]) => ({ name: name as string, days: days as number }));

// A calendar from a backup or another untrusted source, keeping only valid parts
export function normalizeCalendar(value: unknown): TimelineCalendar | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const months = Array.isArray(v.months)
    ? v.months
        .filter((m): m is CalendarMonth => !!m && typeof m === 'object' && typeof (m as CalendarMonth).name === 'string' && (m as CalendarMonth).name.trim() !== '')
        .slice(0, MAX_MONTHS)
        .map((m) => ({
          name: m.name.trim(),
          ...(Number.isInteger(m.days) && m.days! >= 1 && m.days! <= MAX_DAYS && { days: m.days }),
        }))
    : [];
  const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
  const calendar: TimelineCalendar = {
    ...(months.length > 0 && { months }),
    ...(text(v.yearSuffix) && { yearSuffix: text(v.yearSuffix) }),
    ...(text(v.beforeSuffix) && { beforeSuffix: text(v.beforeSuffix) }),
    ...(v.eraDates === true && { eraDates: true }),
  };
  return Object.keys(calendar).length > 0 ? calendar : undefined;
}

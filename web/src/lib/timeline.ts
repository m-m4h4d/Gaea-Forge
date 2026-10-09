// Pure helpers for timeline canvases: ordering, eras and date labels
import { CanvasData, TimelineEra, TimelineEvent } from './database';
import { checkEventDate, formatCalendarDate, formatYear, TimelineCalendar } from './calendar';

export function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  return a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.day ?? 0) - (b.day ?? 0) || a.title.localeCompare(b.title);
}

// "412", "412.3", "412.3.15", or "412 – 430" for spans; with a calendar, named months,
// year labels and era-relative years (see lib/calendar.ts)
export function formatEventDate(event: TimelineEvent, calendar?: TimelineCalendar, eras: TimelineEra[] = []): string {
  return formatCalendarDate(event, calendar, calendar?.eraDates ? eraForYear(event.year, eras) : undefined);
}

export function formatEraRange(era: TimelineEra, calendar?: TimelineCalendar): string {
  const start = formatYear(era.startYear, calendar);
  return era.endYear === undefined ? `${start} onward` : `${start} – ${formatYear(era.endYear, calendar)}`;
}

// The era an event starts in; with overlapping eras the one that began latest wins
export function eraForYear(year: number, eras: TimelineEra[]): TimelineEra | undefined {
  return eras
    .filter((e) => e.startYear <= year && (e.endYear === undefined || year <= e.endYear))
    .sort((a, b) => b.startYear - a.startYear)[0];
}

export type TimelineSection =
  | { kind: 'era'; era: TimelineEra; events: TimelineEvent[] }
  | { kind: 'loose'; events: TimelineEvent[] };

// Chronological sections: each era with its events (including empty eras), and
// runs of events outside any era between them.
export function buildTimelineSections(events: TimelineEvent[], eras: TimelineEra[]): TimelineSection[] {
  const byEra = new Map<string, TimelineEvent[]>(eras.map((e) => [e.id, []]));
  const loose: TimelineEvent[] = [];
  for (const event of events) {
    const era = eraForYear(event.year, eras);
    if (era) byEra.get(era.id)!.push(event);
    else loose.push(event);
  }

  type Item = { year: number; era?: TimelineEra; event?: TimelineEvent };
  const items: Item[] = [
    ...eras.map((era): Item => ({ year: era.startYear, era })),
    ...loose.map((event): Item => ({ year: event.year, event })),
  ];
  items.sort((a, b) =>
    a.year - b.year ||
    // An era starting in the same year as a loose event comes first
    Number(!a.era) - Number(!b.era) ||
    (a.event && b.event ? compareEvents(a.event, b.event) : 0)
  );

  const sections: TimelineSection[] = [];
  for (const item of items) {
    if (item.era) {
      sections.push({ kind: 'era', era: item.era, events: byEra.get(item.era.id)!.sort(compareEvents) });
    } else {
      const last = sections[sections.length - 1];
      if (last?.kind === 'loose') last.events.push(item.event!);
      else sections.push({ kind: 'loose', events: [item.event!] });
    }
  }
  return sections;
}

export type ArticleTimelineEntry = {
  canvasId: string;
  canvasTitle: string;
  event: TimelineEvent;
  // For showing the date the way its timeline does
  calendar?: TimelineCalendar;
  eras: TimelineEra[];
};

// Timeline events that link to an article, across every timeline canvas
export function findArticleEvents(canvases: CanvasData[], articleId: string): ArticleTimelineEntry[] {
  return canvases
    .filter((c) => c.type === 'timeline')
    .flatMap((c) =>
      (c.events ?? [])
        .filter((e) => e.articleId === articleId)
        .map((event) => ({ canvasId: c.id, canvasTitle: c.title, event, calendar: c.calendar, eras: c.eras ?? [] }))
    )
    .sort((a, b) => compareEvents(a.event, b.event));
}

export type EventDraft = {
  title: string;
  year: string;
  month: string;
  day: string;
  endYear: string;
  articleId: string;
  description: string;
};

export type EraDraft = { name: string; startYear: string; endYear: string };

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// Whole numbers only; '' means "not set"
function parseWhole(raw: string): number | undefined | null {
  const text = raw.trim();
  if (text === '') return undefined;
  if (!/^-?\d+$/.test(text)) return null;
  return Number(text);
}

// Form fields -> event (without id), or the first problem to show the user
export function parseEventDraft(draft: EventDraft, calendar?: TimelineCalendar): Parsed<Omit<TimelineEvent, 'id'>> {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'Give the event a title.' };

  const year = parseWhole(draft.year);
  if (year === undefined || year === null) return { ok: false, error: 'Year must be a whole number, e.g. 412 or -30.' };

  const month = parseWhole(draft.month);
  const day = parseWhole(draft.day);
  if (month === null || (month !== undefined && month < 1)) return { ok: false, error: 'Month must be a positive whole number.' };
  if (day === null || (day !== undefined && day < 1)) return { ok: false, error: 'Day must be a positive whole number.' };
  if (day !== undefined && month === undefined) return { ok: false, error: 'Add a month to give a day.' };
  const calendarProblem = checkEventDate({ month, day }, calendar);
  if (calendarProblem) return { ok: false, error: `This date ${calendarProblem}` };

  const endYear = parseWhole(draft.endYear);
  if (endYear === null) return { ok: false, error: 'End year must be a whole number.' };
  if (endYear !== undefined && endYear < year) return { ok: false, error: 'End year cannot be before the year.' };

  const description = draft.description.trim();
  return {
    ok: true,
    value: {
      title,
      year,
      ...(month !== undefined && { month }),
      ...(day !== undefined && { day }),
      ...(endYear !== undefined && endYear !== year && { endYear }),
      ...(draft.articleId && { articleId: draft.articleId }),
      ...(description && { description }),
    },
  };
}

export function parseEraDraft(draft: EraDraft): Parsed<Omit<TimelineEra, 'id'>> {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: 'Give the era a name.' };
  const startYear = parseWhole(draft.startYear);
  if (startYear === undefined || startYear === null) return { ok: false, error: 'Start year must be a whole number.' };
  const endYear = parseWhole(draft.endYear);
  if (endYear === null) return { ok: false, error: 'End year must be a whole number.' };
  if (endYear !== undefined && endYear < startYear) return { ok: false, error: 'End year cannot be before the start year.' };
  return { ok: true, value: { name, startYear, ...(endYear !== undefined && { endYear }) } };
}

export function eventToDraft(event?: TimelineEvent): EventDraft {
  return {
    title: event?.title ?? '',
    year: event ? String(event.year) : '',
    month: event?.month !== undefined ? String(event.month) : '',
    day: event?.day !== undefined ? String(event.day) : '',
    endYear: event?.endYear !== undefined ? String(event.endYear) : '',
    articleId: event?.articleId ?? '',
    description: event?.description ?? '',
  };
}

export function eraToDraft(era?: TimelineEra): EraDraft {
  return {
    name: era?.name ?? '',
    startYear: era ? String(era.startYear) : '',
    endYear: era?.endYear !== undefined ? String(era.endYear) : '',
  };
}

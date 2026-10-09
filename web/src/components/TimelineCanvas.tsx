'use client';

import React, { RefObject, useId, useRef, useState } from 'react';
import { CalendarCog, CalendarPlus, Flag, Hourglass, Link2, Pencil, Trash2, X } from 'lucide-react';
import { CanvasData, LoreArticle, TimelineEra, TimelineEvent } from '@/lib/database';
import { useConfirm } from './dialogs/DialogProvider';
import Modal from './dialogs/Modal';
import {
  CalendarDraft,
  calendarToDraft,
  formatAbsoluteDate,
  formatYear,
  GREGORIAN_MONTHS,
  monthsToText,
  parseCalendarDraft,
  parseMonthsText,
  TimelineCalendar,
} from '@/lib/calendar';
import {
  buildTimelineSections,
  EraDraft,
  eraToDraft,
  EventDraft,
  eventToDraft,
  formatEraRange,
  formatEventDate,
  parseEraDraft,
  parseEventDraft,
} from '@/lib/timeline';

interface TimelineCanvasProps {
  canvasData: CanvasData;
  onChange: (updated: CanvasData) => void;
  articles: LoreArticle[];
  onOpenArticle: (articleId: string) => void;
}

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

type Editing =
  | { kind: 'event'; event?: TimelineEvent }
  | { kind: 'era'; era?: TimelineEra }
  | { kind: 'calendar' }
  | null;

// A vertical, chronological timeline of events grouped into eras
export default function TimelineCanvas({ canvasData, onChange, articles, onOpenArticle }: TimelineCanvasProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const confirm = useConfirm();
  const events = canvasData.events ?? [];
  const eras = canvasData.eras ?? [];
  const calendar = canvasData.calendar;
  const sections = buildTimelineSections(events, eras);
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const save = (changes: Partial<CanvasData>) => onChange({ ...canvasData, ...changes });

  const saveCalendar = (value: TimelineCalendar | undefined) => {
    // Without a calendar the field is left out rather than stored as undefined
    const rest: CanvasData = { ...canvasData };
    delete rest.calendar;
    onChange(value ? { ...rest, calendar: value } : rest);
    setEditing(null);
  };

  const saveEvent = (value: Omit<TimelineEvent, 'id'>, existing?: TimelineEvent) => {
    save({
      events: existing
        ? events.map((e) => (e.id === existing.id ? { id: existing.id, ...value } : e))
        : [...events, { id: createId('event'), ...value }],
    });
    setEditing(null);
  };

  const saveEra = (value: Omit<TimelineEra, 'id'>, existing?: TimelineEra) => {
    save({
      eras: existing
        ? eras.map((e) => (e.id === existing.id ? { id: existing.id, ...value } : e))
        : [...eras, { id: createId('era'), ...value }],
    });
    setEditing(null);
  };

  const deleteEvent = async (event: TimelineEvent) => {
    if (!(await confirm({ title: `Delete "${event.title}"?`, confirmLabel: 'Delete Event', tone: 'danger' }))) return;
    save({ events: events.filter((e) => e.id !== event.id) });
  };

  const deleteEra = async (era: TimelineEra) => {
    const ok = await confirm({
      title: `Delete the era "${era.name}"?`,
      message: 'Its events stay on the timeline.',
      confirmLabel: 'Delete Era',
      tone: 'danger',
    });
    if (!ok) return;
    save({ eras: eras.filter((e) => e.id !== era.id) });
  };

  const renderEvent = (event: TimelineEvent) => {
    const article = event.articleId ? articleById.get(event.articleId) : undefined;
    return (
      <li key={event.id} className="relative pl-8 group" data-testid="timeline-event">
        {/* Dot on the timeline spine */}
        <span className="absolute left-[3px] top-3.5 w-3 h-3 rounded-full bg-gold ring-4 ring-slate-950" aria-hidden />
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className="font-mono text-[11px] text-gold font-semibold"
                // With era-relative dates, the absolute date is a hover away
                title={calendar?.eraDates ? formatAbsoluteDate(event, calendar) : undefined}
              >
                {formatEventDate(event, calendar, eras)}
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-0.5">{event.title}</h3>
            </div>
            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => setEditing({ kind: 'event', event })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-gold hover:bg-slate-800"
                title={`Edit ${event.title}`}
              >
                <Pencil size={13} aria-hidden />
              </button>
              <button
                onClick={() => deleteEvent(event)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                title={`Delete ${event.title}`}
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </div>
          </div>
          {event.description && (
            <p className="text-xs text-slate-300 mt-2 whitespace-pre-wrap leading-relaxed">{event.description}</p>
          )}
          {article && (
            <button
              onClick={() => onOpenArticle(article.id)}
              className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-[11px] hover:bg-gold/20 transition-colors"
            >
              <Link2 size={11} aria-hidden /> {article.title}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-parchment relative overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-2.5 sm:p-3 flex items-center gap-2 shrink-0 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setEditing({ kind: 'event' })}
          className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg text-xs shadow-md shadow-gold/20 flex items-center gap-1.5 shrink-0"
        >
          <CalendarPlus size={14} aria-hidden /> Add Event
        </button>
        <button
          onClick={() => setEditing({ kind: 'era' })}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 flex items-center gap-1.5 shrink-0"
        >
          <Flag size={13} aria-hidden /> Add Era
        </button>
        <button
          onClick={() => setEditing({ kind: 'calendar' })}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 flex items-center gap-1.5 shrink-0"
          title="Month names, year labels and era dates"
        >
          <CalendarCog size={13} aria-hidden /> Calendar
        </button>
        <span className="text-xs text-slate-400 ml-2 shrink-0">
          <strong>{events.length}</strong> events · <strong>{eras.length}</strong> eras
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {events.length === 0 && eras.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-3">
            <Hourglass size={36} className="text-slate-500" aria-hidden />
            <h2 className="text-base font-bold text-slate-200">An empty timeline</h2>
            <p className="text-xs text-slate-400 max-w-sm">
              Add events with years in your world&apos;s own calendar (negative years work too), and group them into eras such
              as &ldquo;The Age of Ash&rdquo;. Link events to articles to see them from the article&apos;s inspector.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 relative">
            {/* The spine */}
            <div className="absolute left-[calc(1rem+8px)] sm:left-[calc(2rem+8px)] top-6 bottom-6 w-px bg-slate-800" aria-hidden />
            <div className="space-y-5 relative">
              {sections.map((section) =>
                section.kind === 'era' ? (
                  <section
                    key={section.era.id}
                    className="rounded-2xl border border-gold/20 bg-gold/5 p-3 sm:p-4"
                    aria-label={`Era: ${section.era.name}`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h2 className="text-sm font-extrabold text-gold uppercase tracking-wider truncate">
                          {section.era.name}
                        </h2>
                        <div className="text-[11px] text-slate-400 font-mono">{formatEraRange(section.era, calendar)}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditing({ kind: 'era', era: section.era })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-gold hover:bg-slate-800"
                          title={`Edit era ${section.era.name}`}
                        >
                          <Pencil size={13} aria-hidden />
                        </button>
                        <button
                          onClick={() => deleteEra(section.era)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                          title={`Delete era ${section.era.name}`}
                        >
                          <Trash2 size={13} aria-hidden />
                        </button>
                      </div>
                    </div>
                    {section.events.length > 0 ? (
                      <ol className="space-y-3">{section.events.map(renderEvent)}</ol>
                    ) : (
                      <p className="text-xs text-slate-500 italic pl-8">No events in this era yet.</p>
                    )}
                  </section>
                ) : (
                  <ol key={`loose-${section.events[0].id}`} className="space-y-3 px-3 sm:px-4">
                    {section.events.map(renderEvent)}
                  </ol>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {editing?.kind === 'event' && (
        <EventModal
          event={editing.event}
          articles={articles}
          calendar={calendar}
          onCancel={() => setEditing(null)}
          onSave={(value) => saveEvent(value, editing.event)}
        />
      )}
      {editing?.kind === 'era' && (
        <EraModal
          era={editing.era}
          calendar={calendar}
          onCancel={() => setEditing(null)}
          onSave={(value) => saveEra(value, editing.era)}
        />
      )}
      {editing?.kind === 'calendar' && (
        <CalendarModal calendar={calendar} events={events} onCancel={() => setEditing(null)} onSave={saveCalendar} />
      )}
    </div>
  );
}

const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment text-xs focus:outline-none focus:border-gold';
const labelClass = 'block text-[11px] uppercase font-bold text-slate-400 mb-1 tracking-wider';

function ModalShell({
  title,
  onCancel,
  onSubmit,
  error,
  initialFocus,
  children,
}: {
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  error: string | null;
  initialFocus?: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <Modal
      onClose={onCancel}
      labelledBy={titleId}
      initialFocus={initialFocus}
      overlayClassName="bg-black/70 backdrop-blur-sm p-4"
      className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-6 text-parchment text-xs"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-gold">{title}</h2>
          <button type="button" onClick={onCancel} className="p-1 text-slate-400 hover:text-gold" title="Close">
            <X size={16} aria-hidden />
          </button>
        </div>
        {children}
        {error && (
          <p role="alert" className="text-red-300 bg-red-950/50 border border-red-800/80 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium"
          >
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EventModal({
  event,
  articles,
  calendar,
  onCancel,
  onSave,
}: {
  event?: TimelineEvent;
  articles: LoreArticle[];
  calendar?: TimelineCalendar;
  onCancel: () => void;
  onSave: (value: Omit<TimelineEvent, 'id'>) => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EventDraft>(() => eventToDraft(event));
  const months = calendar?.months ?? [];
  const monthDays = months[Number(draft.month) - 1]?.days;
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof EventDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));
  const sortedArticles = [...articles].sort((a, b) => a.title.localeCompare(b.title));

  const submit = () => {
    const result = parseEventDraft(draft, calendar);
    if (result.ok) onSave(result.value);
    else setError(result.error);
  };

  return (
    <ModalShell title={event ? 'Edit Event' : 'Add Event'} onCancel={onCancel} onSubmit={submit} error={error} initialFocus={titleRef}>
      <div>
        <label htmlFor="event-title" className={labelClass}>Title *</label>
        <input id="event-title" ref={titleRef} value={draft.title} onChange={set('title')} placeholder="e.g. Coronation of Queen Mira" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="event-year" className={labelClass}>Year *</label>
          <input id="event-year" inputMode="numeric" value={draft.year} onChange={set('year')} placeholder="412" className={inputClass} />
        </div>
        <div>
          <label htmlFor="event-month" className={labelClass}>Month</label>
          {months.length > 0 ? (
            <select id="event-month" value={draft.month} onChange={set('month')} className={inputClass}>
              <option value="">None</option>
              {months.map((m, i) => (
                <option key={i} value={String(i + 1)}>
                  {m.name}
                </option>
              ))}
              {/* A month the calendar no longer names stays selectable */}
              {Number(draft.month) > months.length && <option value={draft.month}>Month {draft.month}</option>}
            </select>
          ) : (
            <input id="event-month" inputMode="numeric" value={draft.month} onChange={set('month')} className={inputClass} />
          )}
        </div>
        <div>
          <label htmlFor="event-day" className={labelClass}>Day</label>
          <input
            id="event-day"
            inputMode="numeric"
            value={draft.day}
            onChange={set('day')}
            placeholder={monthDays ? `1–${monthDays}` : undefined}
            className={inputClass}
          />
        </div>
      </div>
      {calendar?.beforeSuffix && (
        <p className="text-[11px] text-slate-400 -mt-2">
          Enter years before 0 as negative numbers; -30 shows as {formatYear(-30, calendar)}.
        </p>
      )}
      <div>
        <label htmlFor="event-end" className={labelClass}>End year (for wars, reigns…)</label>
        <input id="event-end" inputMode="numeric" value={draft.endYear} onChange={set('endYear')} className={inputClass} />
      </div>
      <div>
        <label htmlFor="event-article" className={labelClass}>Linked article</label>
        <select
          id="event-article"
          value={draft.articleId}
          onChange={(e) => {
            const article = articles.find((a) => a.id === e.target.value);
            // Use the article's title when the event has none yet
            setDraft((d) => ({ ...d, articleId: e.target.value, title: d.title || article?.title || '' }));
          }}
          className={inputClass}
        >
          <option value="">None</option>
          {sortedArticles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} ({a.category})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="event-description" className={labelClass}>Description</label>
        <textarea id="event-description" rows={3} value={draft.description} onChange={set('description')} className={inputClass} />
      </div>
    </ModalShell>
  );
}

function EraModal({
  era,
  calendar,
  onCancel,
  onSave,
}: {
  era?: TimelineEra;
  calendar?: TimelineCalendar;
  onCancel: () => void;
  onSave: (value: Omit<TimelineEra, 'id'>) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EraDraft>(() => eraToDraft(era));
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof EraDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  const submit = () => {
    const result = parseEraDraft(draft);
    if (result.ok) onSave(result.value);
    else setError(result.error);
  };

  return (
    <ModalShell title={era ? 'Edit Era' : 'Add Era'} onCancel={onCancel} onSubmit={submit} error={error} initialFocus={nameRef}>
      <div>
        <label htmlFor="era-name" className={labelClass}>Name *</label>
        <input id="era-name" ref={nameRef} value={draft.name} onChange={set('name')} placeholder="e.g. The Age of Ash" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="era-start" className={labelClass}>Start year *</label>
          <input id="era-start" inputMode="numeric" value={draft.startYear} onChange={set('startYear')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="era-end" className={labelClass}>End year</label>
          <input id="era-end" inputMode="numeric" value={draft.endYear} onChange={set('endYear')} placeholder="ongoing" className={inputClass} />
        </div>
      </div>
      {calendar?.eraDates && (
        <p className="text-[11px] text-slate-400">Dates in this era are counted from its start year, which is Year 1.</p>
      )}
    </ModalShell>
  );
}

const EXAMPLE_EVENT: TimelineEvent = { id: 'example', title: '', year: 412, month: 1, day: 15 };

function CalendarModal({
  calendar,
  events,
  onCancel,
  onSave,
}: {
  calendar?: TimelineCalendar;
  events: TimelineEvent[];
  onCancel: () => void;
  onSave: (value: TimelineCalendar | undefined) => void;
}) {
  const monthsRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<CalendarDraft>(() => calendarToDraft(calendar));
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof CalendarDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  // A live example of how dates will look (skipped while the months don't parse)
  const parsedMonths = parseMonthsText(draft.monthsText);
  const preview = parsedMonths.ok
    ? formatAbsoluteDate(EXAMPLE_EVENT, {
        months: parsedMonths.value,
        yearSuffix: draft.yearSuffix.trim() || undefined,
        beforeSuffix: draft.beforeSuffix.trim() || undefined,
      })
    : null;

  const submit = () => {
    const result = parseCalendarDraft(draft, events);
    if (result.ok) onSave(result.value);
    else setError(result.error);
  };

  return (
    <ModalShell title="Timeline Calendar" onCancel={onCancel} onSubmit={submit} error={error} initialFocus={monthsRef}>
      <div>
        <label htmlFor="calendar-months" className={labelClass}>Months</label>
        <textarea
          id="calendar-months"
          ref={monthsRef}
          rows={6}
          value={draft.monthsText}
          onChange={set('monthsText')}
          placeholder={'One month per line, with its days after a colon:\nFrostmere: 30\nThaw: 28'}
          className={`${inputClass} font-mono`}
        />
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="text-[11px] text-slate-400 mr-auto">Leave empty for numbered months.</span>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, monthsText: monthsToText(GREGORIAN_MONTHS) }))}
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
          >
            Use 12 standard months
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="calendar-suffix" className={labelClass}>Year label</label>
          <input id="calendar-suffix" value={draft.yearSuffix} onChange={set('yearSuffix')} placeholder="e.g. AR" className={inputClass} />
        </div>
        <div>
          <label htmlFor="calendar-before" className={labelClass}>Before year 0</label>
          <input id="calendar-before" value={draft.beforeSuffix} onChange={set('beforeSuffix')} placeholder="e.g. BR" className={inputClass} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-slate-300 cursor-pointer">
        <input type="checkbox" checked={draft.eraDates} onChange={set('eraDates')} className="mt-0.5 accent-gold" />
        <span>
          Count years from the start of each era
          <span className="block text-[11px] text-slate-400">e.g. &ldquo;Year 3 of the Age of Ash&rdquo;. Hover a date to see the full year.</span>
        </span>
      </label>
      {preview && (
        <p className="text-[11px] text-slate-400">
          Example: <span className="font-mono text-gold" data-testid="calendar-preview">{preview}</span>
        </p>
      )}
    </ModalShell>
  );
}

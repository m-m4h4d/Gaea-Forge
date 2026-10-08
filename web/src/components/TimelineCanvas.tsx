'use client';

import React, { useState } from 'react';
import { CalendarPlus, Flag, Hourglass, Link2, Pencil, Trash2, X } from 'lucide-react';
import { CanvasData, LoreArticle, TimelineEra, TimelineEvent } from '@/lib/database';
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
  | null;

// A vertical, chronological timeline of events grouped into eras
export default function TimelineCanvas({ canvasData, onChange, articles, onOpenArticle }: TimelineCanvasProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const events = canvasData.events ?? [];
  const eras = canvasData.eras ?? [];
  const sections = buildTimelineSections(events, eras);
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const save = (changes: Partial<CanvasData>) => onChange({ ...canvasData, ...changes });

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

  const deleteEvent = (event: TimelineEvent) => {
    if (!window.confirm(`Delete the event "${event.title}"?`)) return;
    save({ events: events.filter((e) => e.id !== event.id) });
  };

  const deleteEra = (era: TimelineEra) => {
    if (!window.confirm(`Delete the era "${era.name}"? Its events stay on the timeline.`)) return;
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
              <div className="font-mono text-[11px] text-gold font-semibold">{formatEventDate(event)}</div>
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
                        <div className="text-[11px] text-slate-400 font-mono">{formatEraRange(section.era)}</div>
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
          onCancel={() => setEditing(null)}
          onSave={(value) => saveEvent(value, editing.event)}
        />
      )}
      {editing?.kind === 'era' && (
        <EraModal era={editing.era} onCancel={() => setEditing(null)} onSave={(value) => saveEra(value, editing.era)} />
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
  children,
}: {
  title: string;
  onCancel: () => void;
  onSubmit: () => void;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <form
        role="dialog"
        aria-label={title}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-6 text-parchment space-y-4 text-xs"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gold">{title}</h2>
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
    </div>
  );
}

function EventModal({
  event,
  articles,
  onCancel,
  onSave,
}: {
  event?: TimelineEvent;
  articles: LoreArticle[];
  onCancel: () => void;
  onSave: (value: Omit<TimelineEvent, 'id'>) => void;
}) {
  const [draft, setDraft] = useState<EventDraft>(() => eventToDraft(event));
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof EventDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));
  const sortedArticles = [...articles].sort((a, b) => a.title.localeCompare(b.title));

  const submit = () => {
    const result = parseEventDraft(draft);
    if (result.ok) onSave(result.value);
    else setError(result.error);
  };

  return (
    <ModalShell title={event ? 'Edit Event' : 'Add Event'} onCancel={onCancel} onSubmit={submit} error={error}>
      <div>
        <label htmlFor="event-title" className={labelClass}>Title *</label>
        <input id="event-title" autoFocus value={draft.title} onChange={set('title')} placeholder="e.g. Coronation of Queen Mira" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="event-year" className={labelClass}>Year *</label>
          <input id="event-year" inputMode="numeric" value={draft.year} onChange={set('year')} placeholder="412" className={inputClass} />
        </div>
        <div>
          <label htmlFor="event-month" className={labelClass}>Month</label>
          <input id="event-month" inputMode="numeric" value={draft.month} onChange={set('month')} className={inputClass} />
        </div>
        <div>
          <label htmlFor="event-day" className={labelClass}>Day</label>
          <input id="event-day" inputMode="numeric" value={draft.day} onChange={set('day')} className={inputClass} />
        </div>
      </div>
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
  onCancel,
  onSave,
}: {
  era?: TimelineEra;
  onCancel: () => void;
  onSave: (value: Omit<TimelineEra, 'id'>) => void;
}) {
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
    <ModalShell title={era ? 'Edit Era' : 'Add Era'} onCancel={onCancel} onSubmit={submit} error={error}>
      <div>
        <label htmlFor="era-name" className={labelClass}>Name *</label>
        <input id="era-name" autoFocus value={draft.name} onChange={set('name')} placeholder="e.g. The Age of Ash" className={inputClass} />
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
    </ModalShell>
  );
}

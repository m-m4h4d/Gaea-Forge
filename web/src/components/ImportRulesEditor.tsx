'use client';

import React, { useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ImportRule, parseKeywordList } from '@/lib/importRules';

interface ImportRulesEditorProps {
  rules: ImportRule[];
  onSave: (rules: ImportRule[]) => void;
  onReset: () => void;
  // Shown on the save button, e.g. "Save & Re-sort" while drafts are under review
  saveLabel: string;
}

// Editable keyword lists that decide which category imported entries land in
export default function ImportRulesEditor({ rules, onSave, onReset, saveLabel }: ImportRulesEditorProps) {
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rules.map((r) => [r.category, r.keywords.join(', ')]))
  );

  const handleSave = () =>
    onSave(rules.map((r) => ({ category: r.category, keywords: parseKeywordList(texts[r.category] ?? '') })));

  return (
    <details className="bg-slate-950/40 border border-slate-800/60 rounded-2xl text-xs group">
      <summary className="px-5 py-3 cursor-pointer select-none font-semibold text-slate-300 flex items-center gap-1.5 hover:text-gold">
        <SlidersHorizontal size={14} aria-hidden /> Category keywords
        <span className="font-normal text-slate-500 ml-1">(how entries are sorted into categories)</span>
      </summary>
      <div className="px-5 pb-5 space-y-3">
        <p className="text-slate-400">
          Each entry goes to the category whose keywords best match it. Matches in the section heading count most, then the
          entry&apos;s title, then its text. Separate keywords with commas; phrases like <em>capital city</em> work too.
          Keywords are saved for this workspace role.
        </p>
        <div className="space-y-2">
          {rules.map((rule) => (
            <label key={rule.category} className="block">
              <span className="block text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">{rule.category}</span>
              <textarea
                rows={2}
                value={texts[rule.category] ?? ''}
                onChange={(e) => setTexts((t) => ({ ...t, [rule.category]: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-parchment focus:outline-none focus:border-gold resize-y leading-relaxed"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1.5"
          >
            <RotateCcw size={12} aria-hidden /> Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </details>
  );
}

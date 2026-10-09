'use client';

import React, { useRef, useState } from 'react';
import Modal from './dialogs/Modal';
import { LoreArticle } from '@/lib/database';
import { CategoryTemplate, parseTemplateText, propertiesToText, templateFromArticle } from '@/lib/templates';

interface TemplateEditorModalProps {
  category: string;
  template: CategoryTemplate;
  isCustom: boolean;
  // An article to copy fields from (offered when given)
  sourceArticle?: LoreArticle;
  onSave: (template: CategoryTemplate) => void;
  onReset: () => void;
  onClose: () => void;
}

const labelClass = 'block text-[11px] uppercase font-bold text-slate-400 mb-1 tracking-wider';
const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment text-xs font-mono focus:outline-none focus:border-gold';

// Edit what new articles in a category start with
export default function TemplateEditorModal({
  category,
  template,
  isCustom,
  sourceArticle,
  onSave,
  onReset,
  onClose,
}: TemplateEditorModalProps) {
  const propertiesRef = useRef<HTMLTextAreaElement>(null);
  const [propertiesText, setPropertiesText] = useState(() => propertiesToText(template.properties));
  const [sectionsText, setSectionsText] = useState(() => template.sections.join('\n'));

  const copyFrom = (article: LoreArticle) => {
    const copied = templateFromArticle(article);
    setPropertiesText(propertiesToText(copied.properties));
    setSectionsText(copied.sections.join('\n'));
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="template-editor-title"
      initialFocus={propertiesRef}
      overlayClassName="bg-black/70 backdrop-blur-sm p-4"
      className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-6 text-parchment text-xs"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(parseTemplateText(propertiesText, sectionsText));
        }}
        className="space-y-4"
      >
        <div>
          <h2 id="template-editor-title" className="text-lg font-bold text-gold">
            Template: {category}
          </h2>
          <p className="text-slate-400 mt-0.5">
            New articles in this category start with these fields and sections. Existing articles don&apos;t change.
          </p>
        </div>

        <div>
          <label htmlFor="template-properties" className={labelClass}>Properties</label>
          <textarea
            id="template-properties"
            ref={propertiesRef}
            rows={5}
            value={propertiesText}
            onChange={(e) => setPropertiesText(e.target.value)}
            placeholder={'One per line, with an optional starting value:\nAge\nStatus: Alive'}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="template-sections" className={labelClass}>Sections</label>
          <textarea
            id="template-sections"
            rows={4}
            value={sectionsText}
            onChange={(e) => setSectionsText(e.target.value)}
            placeholder={'One heading per line:\nAppearance\nBackground'}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {sourceArticle && (
            <button
              type="button"
              onClick={() => copyFrom(sourceArticle)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              Copy from &ldquo;{sourceArticle.title}&rdquo;
            </button>
          )}
          {isCustom && (
            <button
              type="button"
              onClick={onReset}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
            >
              Reset to built-in
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg">
            Save Template
          </button>
        </div>
      </form>
    </Modal>
  );
}

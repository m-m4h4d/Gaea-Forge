'use client';

import React, { useRef, useState } from 'react';
import { LORE_CATEGORIES, LoreArticle, LoreCategory } from '@/lib/database';
import { loadTemplates, saveTemplate, templateForCategory } from '@/lib/templates';
import Modal from './dialogs/Modal';
import TemplateEditorModal from './TemplateEditorModal';

interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (article: { title: string; category: LoreCategory; tags: string[] }) => void;
  defaultCategory?: LoreCategory;
  categories?: string[];
  // Offered as a source when editing a template
  currentArticle?: LoreArticle;
}

export default function NewArticleModal({
  isOpen,
  onClose,
  onCreate,
  defaultCategory,
  categories = [...LORE_CATEGORIES],
  currentArticle,
}: NewArticleModalProps) {
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LoreCategory | null>(null);
  const [tagsInput, setTagsInput] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  // Bumped after a template is saved, so the summary below re-reads it
  const [, setTemplatesVersion] = useState(0);

  if (!isOpen) return null;

  const currentCategory = selectedCategory ?? defaultCategory ?? categories[0] ?? 'General';
  // Read when the modal is open (client only), so prerendering never touches storage
  const { template, isCustom } = templateForCategory(currentCategory, loadTemplates());
  const updateTemplate = (next: Parameters<typeof saveTemplate>[1]) => {
    saveTemplate(currentCategory, next);
    setTemplatesVersion((v) => v + 1);
    setIsEditingTemplate(false);
  };

  const handleClose = () => {
    setTitle('');
    setSelectedCategory(null);
    setTagsInput('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    onCreate({
      title: title.trim(),
      category: currentCategory,
      tags,
    });

    setTitle('');
    setSelectedCategory(null);
    setTagsInput('');
    onClose();
  };

  return (
    <Modal
      onClose={handleClose}
      labelledBy="new-article-title"
      overlayClassName="bg-slate-950/80 backdrop-blur-sm p-4"
      className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-6 relative text-parchment animate-in fade-in zoom-in-95 duration-150" initialFocus={titleInputRef}
    >
        <h2 id="new-article-title" className="text-xl font-bold text-gold tracking-wide mb-1">Create New Lore Entity</h2>
        <p className="text-xs text-slate-400 mb-6">Add a new character, location, faction, artifact or campaign note to your world.</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Title / Name *
            </label>
            <input
              type="text"
              required
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kingdom of Aethelgard"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label htmlFor="new-article-category" className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Category
            </label>
            <select
              id="new-article-category"
              value={currentCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold transition-colors"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <div className="mt-1.5 flex items-start justify-between gap-2 text-[11px]" data-testid="template-summary">
              <p className="text-slate-400 leading-snug">
                {isCustom ? 'Your template' : 'Starts with'}:{' '}
                {[
                  template.properties.map((p) => p.key).join(', '),
                  template.sections.length ? `sections ${template.sections.join(', ')}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || 'no extra fields'}
              </p>
              <button type="button" onClick={() => setIsEditingTemplate(true)} className="text-gold hover:underline shrink-0">
                Edit template
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Initial Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. empire, capital, holy-city"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold transition-colors text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2 bg-gold hover:bg-gold-hover text-on-accent font-semibold rounded-lg shadow-lg shadow-gold/20 disabled:opacity-40 transition-colors text-xs"
            >
              Create Article
            </button>
          </div>
        </form>
        {isEditingTemplate && (
          <TemplateEditorModal
            category={currentCategory}
            template={template}
            isCustom={isCustom}
            sourceArticle={currentArticle}
            onSave={updateTemplate}
            onReset={() => updateTemplate(null)}
            onClose={() => setIsEditingTemplate(false)}
          />
        )}
    </Modal>
  );
}

'use client';

import React, { useState } from 'react';
import { LORE_CATEGORIES, LoreCategory } from '@/lib/database';

interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (article: { title: string; category: LoreCategory; tags: string[] }) => void;
  defaultCategory?: LoreCategory;
}

export default function NewArticleModal({
  isOpen,
  onClose,
  onCreate,
  defaultCategory = 'Characters',
}: NewArticleModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<LoreCategory>(defaultCategory);
  const [tagsInput, setTagsInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    onCreate({
      title: title.trim(),
      category,
      tags,
    });

    setTitle('');
    setTagsInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md p-6 relative text-parchment animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-xl font-bold text-gold tracking-wide mb-1">Create New Lore Entity</h2>
        <p className="text-xs text-slate-400 mb-6">Add a new character, location, faction, artifact or campaign note to your world.</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Title / Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kingdom of Aethelgard"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as LoreCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment focus:outline-none focus:border-gold transition-colors"
            >
              {LORE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
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
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors font-medium text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-5 py-2 bg-gold hover:bg-gold-hover text-slate-950 font-semibold rounded-lg shadow-lg shadow-gold/20 disabled:opacity-40 transition-colors text-xs"
            >
              Create Article
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { EntityProperty, LoreArticle, LoreCategory } from '@/lib/database';

interface EntityInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  article: LoreArticle | undefined;
  categories: string[];
  onUpdate: (article: LoreArticle) => void;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
}

// Right panel for the active article: artwork, title, category, tags and properties
export default function EntityInspector({
  isOpen,
  onClose,
  article,
  categories,
  onUpdate,
  onDelete,
  onTagClick,
}: EntityInspectorProps) {
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  const [showAddPropInput, setShowAddPropInput] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropValue, setNewPropValue] = useState('');

  // Tags Manager: Add Tag
  const handleAddTag = () => {
    if (!newTagInput.trim() || !article) return;
    const tag = newTagInput.trim().toLowerCase();
    if (article.tags.includes(tag)) {
      setNewTagInput('');
      setShowAddTagInput(false);
      return;
    }

    const updated: LoreArticle = {
      ...article,
      tags: [...article.tags, tag],
    };
    setNewTagInput('');
    setShowAddTagInput(false);
    onUpdate(updated);
  };

  // Tags Manager: Remove Tag
  const handleRemoveTag = (tagToRemove: string) => {
    if (!article) return;
    const updated: LoreArticle = {
      ...article,
      tags: article.tags.filter((t) => t !== tagToRemove),
    };
    onUpdate(updated);
  };

  // Custom Properties: Add Property
  const handleAddProperty = () => {
    if (!newPropKey.trim() || !newPropValue.trim() || !article) return;
    const newProp: EntityProperty = {
      key: newPropKey.trim(),
      value: newPropValue.trim(),
    };

    const updated: LoreArticle = {
      ...article,
      properties: [...article.properties, newProp],
    };
    setNewPropKey('');
    setNewPropValue('');
    setShowAddPropInput(false);
    onUpdate(updated);
  };

  // Custom Properties: Delete Property
  const handleDeleteProperty = (index: number) => {
    if (!article) return;
    const updatedProps = [...article.properties];
    updatedProps.splice(index, 1);

    const updated: LoreArticle = {
      ...article,
      properties: updatedProps,
    };
    onUpdate(updated);
  };

  // Custom Properties: Update Property Value
  const handleUpdatePropertyValue = (index: number, newValue: string) => {
    if (!article) return;
    const updatedProps = article.properties.map((prop, i) =>
      i === index ? { ...prop, value: newValue } : prop
    );

    const updated: LoreArticle = {
      ...article,
      properties: updatedProps,
    };
    onUpdate(updated);
  };

  // Handle Cover Image Upload (Base64 Data URL)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !article) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const updated: LoreArticle = {
        ...article,
        coverImage: dataUrl,
      };
      onUpdate(updated);
    };
    reader.readAsDataURL(file);
  };

  return (
      <aside
        className={`${
          isOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden border-none pointer-events-none'
        } shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-20 transition-all duration-300 ease-in-out relative`}
      >
        <div className="w-80 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <h2 className="font-bold text-gold tracking-wide text-sm flex items-center gap-1.5">
              <span>⚜</span> Entity Inspector
            </h2>
            <div className="flex items-center gap-2">
              {article && (
                <button
                  onClick={onDelete}
                  className="text-xs text-red-400 hover:text-red-300 hover:underline"
                  title="Delete this article"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => onClose()}
                className="p-1 text-slate-400 hover:text-gold hover:bg-slate-800 rounded transition-colors text-xs font-bold"
                title="Close Inspector"
              >
                ▶
              </button>
            </div>
          </div>

          {article ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs custom-scrollbar">
              {/* Cover Image Header */}
            <div>
              <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                Entity Artwork / Map
              </h3>
              <label className="aspect-video w-full bg-slate-950 rounded-xl flex flex-col items-center justify-center border border-slate-800 hover:border-gold cursor-pointer transition-all group relative overflow-hidden shadow-inner">
                {article.coverImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="text-center p-3">
                    <span className="text-2xl block mb-1">🖼️</span>
                    <span className="text-slate-500 group-hover:text-gold text-xs transition-colors font-medium">
                      Upload Artwork
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Entity Title & Category Fields */}
            <div className="space-y-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={article.title}
                  onChange={(e) =>
                    onUpdate({
                      ...article,
                      title: e.target.value,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-parchment font-semibold text-xs focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Category
                </label>
                <select
                  value={article.category}
                  onChange={(e) =>
                    onUpdate({
                      ...article,
                      category: e.target.value as LoreCategory,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-parchment text-xs focus:outline-none focus:border-gold"
                >
                  {Array.from(new Set([...categories, article.category])).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tags Manager */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  Tags ({article.tags.length})
                </h3>
                <button
                  onClick={() => setShowAddTagInput(!showAddTagInput)}
                  className="text-gold hover:underline text-[10px] font-semibold"
                >
                  + Add Tag
                </button>
              </div>

              {/* Tag Pills */}
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded-full text-xs text-parchment-muted hover:border-gold flex items-center gap-1 transition-colors group cursor-pointer"
                  >
                    <span onClick={() => onTagClick(tag)}>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-500 hover:text-red-400 font-bold ml-0.5 text-[10px]"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>

              {/* Add Tag Inline Form */}
              {showAddTagInput && (
                <div className="mt-2 flex gap-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="New tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-parchment focus:outline-none focus:border-gold"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-2.5 py-1 bg-gold text-slate-950 font-bold rounded text-xs hover:bg-gold-hover"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            {/* Key-Value Properties Manager */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  Custom Properties ({article.properties.length})
                </h3>
                <button
                  onClick={() => setShowAddPropInput(!showAddPropInput)}
                  className="text-gold hover:underline text-[10px] font-semibold"
                >
                  + Add Property
                </button>
              </div>

              <div className="space-y-2">
                {article.properties.map((prop, idx) => (
                  <div
                    key={`${prop.key}-${idx}`}
                    className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 text-xs group"
                  >
                    <span className="text-slate-500 font-medium w-1/3 truncate">
                      {prop.key}
                    </span>
                    <input
                      type="text"
                      value={prop.value}
                      onChange={(e) => handleUpdatePropertyValue(idx, e.target.value)}
                      className="w-1/2 bg-transparent text-right text-parchment-muted focus:bg-slate-950 focus:outline-none border-b border-transparent focus:border-gold px-1 rounded"
                    />
                    <button
                      onClick={() => handleDeleteProperty(idx)}
                      className="text-slate-600 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                      title="Remove property"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Property Inline Form */}
              {showAddPropInput && (
                <div className="mt-3 p-2 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. Danger Level)"
                    value={newPropKey}
                    onChange={(e) => setNewPropKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-parchment focus:outline-none focus:border-gold"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. Extreme)"
                    value={newPropValue}
                    onChange={(e) => setNewPropValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddProperty()}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-parchment focus:outline-none focus:border-gold"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowAddPropInput(false)}
                      className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddProperty}
                      className="px-2.5 py-0.5 bg-gold text-slate-950 font-bold text-[10px] rounded hover:bg-gold-hover"
                    >
                      Save Property
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Last Modified Info */}
            <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 space-y-1">
              <div>
                ID: <span className="font-mono text-slate-400">{article.id}</span>
              </div>
              <div>
                Last Modified:{' '}
                <span className="text-slate-400" suppressHydrationWarning>
                  {new Date(article.last_updated).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-slate-500">No entity selected.</div>
        )}
        </div>
      </aside>
  );
}

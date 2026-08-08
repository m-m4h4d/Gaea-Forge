'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Editor from '@/components/Editor';
import NewArticleModal from '@/components/NewArticleModal';
import ExportImportModal from '@/components/ExportImportModal';
import {
  getDatabase,
  LoreArticle,
  LORE_CATEGORIES,
  LoreCategory,
  EntityProperty,
  INITIAL_SEED_ARTICLES,
  GaeaDatabase,
} from '@/lib/database';

export default function Home() {
  const [db, setDb] = useState<GaeaDatabase | null>(null);
  const [articles, setArticles] = useState<LoreArticle[]>(INITIAL_SEED_ARTICLES);
  const [activeArticleId, setActiveArticleId] = useState<string>('char-elora');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  
  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [newModalCategory, setNewModalCategory] = useState<LoreCategory>('Characters');

  // UI state
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTagInput, setShowAddTagInput] = useState(false);
  
  // New Property Input state
  const [showAddPropInput, setShowAddPropInput] = useState(false);
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropValue, setNewPropValue] = useState('');

  const [, startTransition] = useTransition();

  // Initialize RxDB and subscribe to live changes
  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    getDatabase()
      .then((database) => {
        if (!isMounted) return;
        setDb(database);

        // Initial fetch
        database.articles
          .find()
          .exec()
          .then((docs) => {
            if (isMounted && docs.length > 0) {
              const items = docs.map((doc) => doc.toJSON() as LoreArticle);
              setArticles(items);
            }
          });

        // Live RxDB subscription
        subscription = database.articles.find().$.subscribe((docs) => {
          if (isMounted && docs) {
            const items = docs.map((doc) => doc.toJSON() as LoreArticle);
            setArticles(items);
          }
        });
      })
      .catch((err) => {
        console.warn('RxDB fallback mode active:', err);
      });

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Current active article document
  const activeArticle = articles.find((a) => a.id === activeArticleId) || articles[0];

  // Helper to persist updated article to state and RxDB
  const updateArticle = useCallback(
    async (updated: LoreArticle) => {
      const itemToSave: LoreArticle = {
        ...updated,
        last_updated: Date.now(),
      };
      setIsSaving(true);
      
      // Local state transition for instant responsiveness
      startTransition(() => {
        setArticles((prev) =>
          prev.map((art) => (art.id === itemToSave.id ? itemToSave : art))
        );
      });

      // RxDB upsert
      if (db) {
        try {
          await db.articles.upsert(itemToSave);
        } catch (e) {
          console.error('Error saving to RxDB:', e);
        }
      }
      
      setIsSaving(false);
      setIsSavedToast(true);
      setTimeout(() => setIsSavedToast(false), 2000);
    },
    [db]
  );

  // Content change handler from TipTap editor
  const handleContentChange = (newContent: string) => {
    if (!activeArticle || activeArticle.content === newContent) return;

    const updated: LoreArticle = {
      ...activeArticle,
      content: newContent,
    };

    updateArticle(updated);
  };

  // Create article handler
  const handleCreateArticle = async (data: {
    title: string;
    category: LoreCategory;
    tags: string[];
  }) => {
    const timestamp = Date.now();
    const newId = `${data.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${timestamp}`;
    const newDoc: LoreArticle = {
      id: newId,
      title: data.title,
      category: data.category,
      content: `<h1>${data.title}</h1><p>Start detailing your lore for ${data.title}...</p>`,
      tags: data.tags,
      properties: [
        { key: 'Status', value: 'Draft' },
        { key: 'Created', value: new Date().toLocaleDateString() },
      ],
      isPinned: false,
      last_updated: timestamp,
    };

    setArticles((prev) => [newDoc, ...prev]);
    setActiveArticleId(newDoc.id);

    if (db) {
      try {
        await db.articles.insert(newDoc);
      } catch (e) {
        console.error('Failed to insert new doc to RxDB:', e);
      }
    }
  };

  // Delete article handler
  const handleDeleteActiveArticle = async () => {
    if (!activeArticle) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${activeArticle.title}"?`
    );
    if (!confirmDelete) return;

    const targetId = activeArticle.id;
    const remaining = articles.filter((a) => a.id !== targetId);
    setArticles(remaining);

    if (remaining.length > 0) {
      setActiveArticleId(remaining[0].id);
    }

    if (db) {
      try {
        const doc = await db.articles.findOne(targetId).exec();
        if (doc) await doc.remove();
      } catch (e) {
        console.error('Failed to delete doc from RxDB:', e);
      }
    }
  };

  // Toggle Pinned status
  const handleTogglePin = () => {
    if (!activeArticle) return;
    const updated: LoreArticle = {
      ...activeArticle,
      isPinned: !activeArticle.isPinned,
    };
    updateArticle(updated);
  };

  // Tags Manager: Add Tag
  const handleAddTag = () => {
    if (!newTagInput.trim() || !activeArticle) return;
    const tag = newTagInput.trim().toLowerCase();
    if (activeArticle.tags.includes(tag)) {
      setNewTagInput('');
      setShowAddTagInput(false);
      return;
    }

    const updated: LoreArticle = {
      ...activeArticle,
      tags: [...activeArticle.tags, tag],
    };
    setNewTagInput('');
    setShowAddTagInput(false);
    updateArticle(updated);
  };

  // Tags Manager: Remove Tag
  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeArticle) return;
    const updated: LoreArticle = {
      ...activeArticle,
      tags: activeArticle.tags.filter((t) => t !== tagToRemove),
    };
    updateArticle(updated);
  };

  // Custom Properties: Add Property
  const handleAddProperty = () => {
    if (!newPropKey.trim() || !newPropValue.trim() || !activeArticle) return;
    const newProp: EntityProperty = {
      key: newPropKey.trim(),
      value: newPropValue.trim(),
    };

    const updated: LoreArticle = {
      ...activeArticle,
      properties: [...activeArticle.properties, newProp],
    };
    setNewPropKey('');
    setNewPropValue('');
    setShowAddPropInput(false);
    updateArticle(updated);
  };

  // Custom Properties: Delete Property
  const handleDeleteProperty = (index: number) => {
    if (!activeArticle) return;
    const updatedProps = [...activeArticle.properties];
    updatedProps.splice(index, 1);

    const updated: LoreArticle = {
      ...activeArticle,
      properties: updatedProps,
    };
    updateArticle(updated);
  };

  // Custom Properties: Update Property Value
  const handleUpdatePropertyValue = (index: number, newValue: string) => {
    if (!activeArticle) return;
    const updatedProps = activeArticle.properties.map((prop, i) =>
      i === index ? { ...prop, value: newValue } : prop
    );

    const updated: LoreArticle = {
      ...activeArticle,
      properties: updatedProps,
    };
    updateArticle(updated);
  };

  // Handle Cover Image Upload (Base64 Data URL)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeArticle) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const updated: LoreArticle = {
        ...activeArticle,
        coverImage: dataUrl,
      };
      updateArticle(updated);
    };
    reader.readAsDataURL(file);
  };

  // Bulk Import Handler
  const handleImportArticles = async (importedList: LoreArticle[]) => {
    setArticles(importedList);
    if (importedList.length > 0) {
      setActiveArticleId(importedList[0].id);
    }
    if (db) {
      try {
        await db.articles.bulkInsert(importedList);
      } catch (e) {
        console.warn('RxDB bulkInsert notice:', e);
      }
    }
  };

  // Filter articles based on search, category, tag
  const filteredArticles = articles.filter((art) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
      art.properties.some(
        (p) =>
          p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.value.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCategory =
      !selectedCategoryFilter || art.category === selectedCategoryFilter;

    const matchesTag = !selectedTagFilter || art.tags.includes(selectedTagFilter);

    return matchesSearch && matchesCategory && matchesTag;
  });

  const pinnedArticles = filteredArticles.filter((a) => a.isPinned);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-parchment overflow-hidden select-none font-sans">
      {/* LEFT SIDEBAR: Navigation, Categories & Search */}
      <aside className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-20">
        {/* App Title & Header Actions */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Gaea-Forge Logo"
              className="w-9 h-9 rounded-lg object-cover border border-gold/30 shadow-md shadow-gold/20"
            />
            <div>
              <h1 className="text-base font-bold tracking-wider text-gold">Gaea-Forge</h1>
              <p className="text-[10px] text-slate-500 tracking-tight">Local World Architect</p>
            </div>
          </div>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            title="Backup / Restore World Data"
          >
            💾 Backup
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/50">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, lore, tags..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-parchment placeholder-slate-500 focus:outline-none focus:border-gold transition-colors"
            />
            <span className="absolute left-2.5 top-1.5 text-slate-500 text-xs">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1.5 text-slate-500 hover:text-gold text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Active Tag Filter Indicator */}
          {selectedTagFilter && (
            <div className="mt-2 flex items-center justify-between bg-gold/10 border border-gold/30 rounded px-2 py-1 text-xs text-gold">
              <span>Tag filter: <strong>#{selectedTagFilter}</strong></span>
              <button onClick={() => setSelectedTagFilter(null)} className="hover:text-white font-bold">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Categories & Articles List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {/* Pinned Articles Section */}
          {pinnedArticles.length > 0 && (
            <div>
              <div className="font-semibold text-gold uppercase text-[10px] tracking-wider mb-1.5 px-2 flex items-center gap-1">
                <span>📌</span> Pinned Lore
              </div>
              <ul className="space-y-1">
                {pinnedArticles.map((art) => (
                  <li key={`pinned-${art.id}`}>
                    <button
                      onClick={() => setActiveArticleId(art.id)}
                      className={`w-full text-left py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        activeArticleId === art.id
                          ? 'bg-gold text-slate-950 font-semibold shadow-md shadow-gold/10'
                          : 'text-parchment hover:bg-slate-800/80 hover:text-gold'
                      }`}
                    >
                      <span className="truncate">{art.title}</span>
                      <span className="text-[10px] opacity-75 shrink-0 ml-1">{art.category.slice(0, 3)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Folders */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="font-semibold text-slate-400 uppercase text-[10px] tracking-wider">
                Categories
              </span>
              {selectedCategoryFilter && (
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="text-[10px] text-gold hover:underline"
                >
                  Show All
                </button>
              )}
            </div>

            <div className="space-y-3">
              {LORE_CATEGORIES.map((cat) => {
                const categoryArticles = filteredArticles.filter((a) => a.category === cat);
                const isSelectedCat = selectedCategoryFilter === cat;

                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-800/50 group">
                      <button
                        onClick={() =>
                          setSelectedCategoryFilter(isSelectedCat ? null : cat)
                        }
                        className={`text-xs font-semibold tracking-wide flex items-center gap-1.5 transition-colors ${
                          isSelectedCat ? 'text-gold' : 'text-slate-300 group-hover:text-gold'
                        }`}
                      >
                        <span className="text-slate-500 text-[10px]">{isSelectedCat ? '▼' : '▶'}</span>
                        {cat}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                          {categoryArticles.length}
                        </span>
                        <button
                          onClick={() => {
                            setNewModalCategory(cat);
                            setIsNewModalOpen(true);
                          }}
                          className="text-xs text-slate-500 hover:text-gold px-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title={`Add new article in ${cat}`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Article list under category */}
                    {categoryArticles.length > 0 && (
                      <ul className="space-y-0.5 pl-3 border-l border-slate-800 ml-2">
                        {categoryArticles.map((art) => (
                          <li key={art.id}>
                            <button
                              onClick={() => setActiveArticleId(art.id)}
                              className={`w-full text-left py-1 px-2 rounded text-xs truncate transition-colors ${
                                activeArticleId === art.id
                                  ? 'bg-slate-800 text-gold font-medium border-l-2 border-gold'
                                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                              }`}
                            >
                              {art.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Quick Add Button */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={() => {
              setNewModalCategory('Characters');
              setIsNewModalOpen(true);
            }}
            className="w-full py-2 bg-gradient-to-r from-gold to-amber-500 hover:from-amber-400 hover:to-gold text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-gold/20 flex items-center justify-center gap-1.5 transition-all"
          >
            <span>+</span> New Lore Article
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA: Header & TipTap Editor */}
      <main className="flex-1 flex flex-col bg-[#0b1120] relative overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 flex items-center px-6 justify-between shrink-0 bg-slate-900/80 backdrop-blur-md z-10">
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-500 font-semibold">World Lore</span>
            <span>/</span>
            <span className="text-slate-400 font-medium">{activeArticle?.category || 'General'}</span>
            <span>/</span>
            <span className="text-gold font-bold">{activeArticle?.title || 'Untitled Entity'}</span>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Auto-save status */}
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              {isSaving ? (
                <span className="text-amber-400 animate-pulse">Saving...</span>
              ) : isSavedToast ? (
                <span className="text-emerald-400 font-medium">Saved ✓</span>
              ) : (
                <span className="text-slate-500">Auto-saved</span>
              )}
            </div>

            {/* Pin Toggle Button */}
            <button
              onClick={handleTogglePin}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                activeArticle?.isPinned
                  ? 'bg-gold/20 border-gold text-gold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={activeArticle?.isPinned ? 'Unpin Article' : 'Pin Article to top'}
            >
              📌 {activeArticle?.isPinned ? 'Pinned' : 'Pin'}
            </button>

            {/* Manual Save Button */}
            <button
              onClick={() => activeArticle && updateArticle(activeArticle)}
              className="px-4 py-1.5 bg-gold text-slate-950 rounded-lg font-bold text-xs hover:bg-gold-hover transition-colors shadow-md shadow-gold/20"
            >
              Save Now
            </button>
          </div>
        </header>

        {/* Editor Main Canvas */}
        <div className="flex-1 p-6 overflow-hidden">
          {activeArticle ? (
            <Editor
              key={activeArticle.id}
              content={activeArticle.content}
              onChange={handleContentChange}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              Select or create an article to begin lore editing.
            </div>
          )}
        </div>
      </main>

      {/* RIGHT SIDEBAR: Entity Metadata, Tags & Properties Inspector */}
      <aside className="w-80 flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <h2 className="font-bold text-gold tracking-wide text-sm flex items-center gap-1.5">
            <span>⚜</span> Entity Inspector
          </h2>
          {activeArticle && (
            <button
              onClick={handleDeleteActiveArticle}
              className="text-xs text-red-400 hover:text-red-300 hover:underline"
              title="Delete this article"
            >
              Delete
            </button>
          )}
        </div>

        {activeArticle ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs custom-scrollbar">
            {/* Cover Image Header */}
            <div>
              <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                Entity Artwork / Map
              </h3>
              <label className="aspect-video w-full bg-slate-950 rounded-xl flex flex-col items-center justify-center border border-slate-800 hover:border-gold cursor-pointer transition-all group relative overflow-hidden shadow-inner">
                {activeArticle.coverImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activeArticle.coverImage}
                    alt={activeArticle.title}
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
                  value={activeArticle.title}
                  onChange={(e) =>
                    updateArticle({
                      ...activeArticle,
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
                  value={activeArticle.category}
                  onChange={(e) =>
                    updateArticle({
                      ...activeArticle,
                      category: e.target.value as LoreCategory,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-parchment text-xs focus:outline-none focus:border-gold"
                >
                  {LORE_CATEGORIES.map((cat) => (
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
                  Tags ({activeArticle.tags.length})
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
                {activeArticle.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded-full text-xs text-parchment-muted hover:border-gold flex items-center gap-1 transition-colors group cursor-pointer"
                  >
                    <span onClick={() => setSelectedTagFilter(tag)}>#{tag}</span>
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
                  Custom Properties ({activeArticle.properties.length})
                </h3>
                <button
                  onClick={() => setShowAddPropInput(!showAddPropInput)}
                  className="text-gold hover:underline text-[10px] font-semibold"
                >
                  + Add Property
                </button>
              </div>

              <div className="space-y-2">
                {activeArticle.properties.map((prop, idx) => (
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
                ID: <span className="font-mono text-slate-400">{activeArticle.id}</span>
              </div>
              <div>
                Last Modified:{' '}
                <span className="text-slate-400" suppressHydrationWarning>
                  {new Date(activeArticle.last_updated).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-slate-500">No entity selected.</div>
        )}
      </aside>

      {/* MODALS */}
      <NewArticleModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateArticle}
        defaultCategory={newModalCategory}
      />

      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        articles={articles}
        onImport={handleImportArticles}
      />
    </div>
  );
}

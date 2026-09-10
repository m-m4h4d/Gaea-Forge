'use client';

import React, { useState, useRef } from 'react';
import { LoreArticle } from '@/lib/database';
import { RoleId } from '@/lib/roles';
import { parseDocumentFile, ParsedEntityDraft } from '@/lib/documentParser';

interface DocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: LoreArticle[];
  activeRole: RoleId;
  categories: string[];
  onImportArticles: (newArticles: LoreArticle[], mode: 'merge' | 'replace') => void;
}

export default function DocumentImportModal({
  isOpen,
  onClose,
  articles,
  activeRole,
  categories,
  onImportArticles,
}: DocumentImportModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  
  // File upload & parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [parsedDrafts, setParsedDrafts] = useState<ParsedEntityDraft[]>([]);
  
  // Import review options
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file selection
  const handleProcessFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setCurrentFileName(file.name);

    try {
      const drafts = await parseDocumentFile(file, activeRole);
      if (drafts.length === 0) {
        throw new Error('No readable text or entities could be parsed from this file.');
      }
      setParsedDrafts(drafts);
    } catch (err: unknown) {
      console.error('File parsing error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to parse document';
      setParseError(msg);
      setParsedDrafts([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  // Toggle selection
  const toggleSelectAll = (select: boolean) => {
    setParsedDrafts((prev) => prev.map((d) => ({ ...d, selected: select })));
  };

  const toggleSelectDraft = (id: string) => {
    setParsedDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d))
    );
  };

  // Update draft fields
  const handleUpdateDraftTitle = (id: string, newTitle: string) => {
    setParsedDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: newTitle } : d))
    );
  };

  const handleUpdateDraftCategory = (id: string, newCategory: string) => {
    setParsedDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category: newCategory } : d))
    );
  };

  // Commit Import
  const handleConfirmImport = () => {
    const selectedDrafts = parsedDrafts.filter((d) => d.selected);
    if (selectedDrafts.length === 0) {
      alert('Please select at least one article to import.');
      return;
    }

    const newArticles: LoreArticle[] = selectedDrafts.map((draft, idx) => ({
      id: draft.id,
      title: draft.title.trim() || `Untitled Lore ${idx + 1}`,
      category: draft.category || categories[0],
      content: draft.contentHtml,
      tags: draft.tags,
      properties: draft.properties,
      isPinned: false,
      last_updated: Date.now() + idx,
    }));

    onImportArticles(newArticles, importMode);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setParsedDrafts([]);
    setCurrentFileName(null);
    setParseError(null);
    setExpandedPreviewId(null);
    setSearchFilter('');
  };

  // Export JSON backup
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(articles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `gaea-forge-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const selectedCount = parsedDrafts.filter((d) => d.selected).length;

  const filteredDrafts = parsedDrafts.filter((d) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      d.title.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 relative">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gold tracking-wide flex items-center gap-2">
              <span>📥</span> Import & Export World Data
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Intelligently parse documents (.pdf, .docx, .doc, .md, .txt) into separate organized codex articles.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => {
                setActiveTab('import');
                handleReset();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'import'
                  ? 'bg-gold text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Document Import
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'export'
                  ? 'bg-gold text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {activeTab === 'export' ? (
            /* EXPORT VIEW */
            <div className="space-y-6 max-w-xl mx-auto py-6">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center text-3xl mx-auto">
                  💾
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Full World Backup</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Export all {articles.length} lore articles, metadata properties, and custom tags into a single portable `.json` backup file.
                  </p>
                </div>
                <button
                  onClick={handleExportJSON}
                  className="px-6 py-2.5 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-xl shadow-lg shadow-gold/20 text-xs transition-all"
                >
                  Download .json Backup ({articles.length} Articles)
                </button>
              </div>
            </div>
          ) : parsedDrafts.length === 0 ? (
            /* UPLOAD FILE VIEW */
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 relative group flex flex-col items-center justify-center gap-4 ${
                  isDragOver
                    ? 'border-gold bg-gold/5 scale-[1.01]'
                    : 'border-slate-700/80 bg-slate-950/40 hover:border-gold/60 hover:bg-slate-950/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.md,.txt,.json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-20 h-20 rounded-3xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-4xl shadow-inner group-hover:scale-105 group-hover:border-gold/50 transition-all">
                  📄
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-gold transition-colors">
                    Click to browse or drag & drop documents here
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-md">
                    Upload your lore bibles, character lists, rulebooks, notes, or design documents.
                  </p>
                </div>

                {/* Supported Format Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-red-950/60 text-red-300 border border-red-800/60">
                    .PDF
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/60">
                    .DOCX / .DOC
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/60">
                    .MD
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    .TXT
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/60">
                    .JSON
                  </span>
                </div>
              </div>

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-3 animate-pulse">
                  <div className="inline-block w-8 h-8 border-3 border-gold border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-200">
                    Intelligently parsing document & segmenting lore entities...
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Detecting headings, characters, nations, bestiary entries, and attributes
                  </p>
                </div>
              )}

              {/* Parsing Error */}
              {parseError && (
                <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-2xl text-red-300 text-xs flex items-center justify-between">
                  <span>⚠️ {parseError}</span>
                  <button
                    onClick={() => setParseError(null)}
                    className="text-red-400 hover:text-white font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Features Explain Box */}
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-5 space-y-3 text-xs text-slate-400">
                <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>✨</span> How Gaea-Forge Intelligent Segmentation Works:
                </h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>Multi-Entity Splitting:</strong> If your document contains multiple characters, locations, governments, or items, each is separated into its own clean article.
                  </li>
                  <li>
                    <strong>Auto-Categorization:</strong> Matches entities to your active categories (e.g. Characters, Realms, Magic, Factions).
                  </li>
                  <li>
                    <strong>Property Extraction:</strong> Automatically detects key-value properties (e.g., <em>Capital City: Aethelia</em>, <em>Arcana: Fire</em>) and converts them into structured attributes.
                  </li>
                  <li>
                    <strong>Interactive Review:</strong> Preview, edit titles, adjust categories, or select which articles to import before saving.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* REVIEW & SELECTION VIEW */
            <div className="space-y-4">
              {/* Review Summary Bar */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gold/15 text-gold text-xs font-mono font-bold">
                      {parsedDrafts.length} Entities Found
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-xs">
                      from <strong className="text-slate-200">{currentFileName}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Select the articles you wish to import. You can customize titles and categories below.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleSelectAll(true)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => toggleSelectAll(false)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs transition-colors border border-slate-800"
                  >
                    Choose Different File
                  </button>
                </div>
              </div>

              {/* Filter Search Input */}
              <div className="flex items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="Filter detected entities..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full sm:w-72 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-parchment placeholder-slate-500 focus:outline-none focus:border-gold"
                />

                <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-gold focus:ring-gold"
                    />
                    <span>Append / Merge with existing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-gold focus:ring-gold"
                    />
                    <span className="text-amber-400">Replace current world</span>
                  </label>
                </div>
              </div>

              {/* Articles Draft List */}
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                {filteredDrafts.map((draft) => {
                  const isExpanded = expandedPreviewId === draft.id;
                  return (
                    <div
                      key={draft.id}
                      className={`border rounded-2xl p-3.5 transition-all ${
                        draft.selected
                          ? 'bg-slate-950/70 border-slate-700/80 shadow-md'
                          : 'bg-slate-950/30 border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Checkbox and Title */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={draft.selected}
                            onChange={() => toggleSelectDraft(draft.id)}
                            className="w-4 h-4 rounded text-gold focus:ring-gold bg-slate-900 border-slate-700 cursor-pointer shrink-0"
                          />
                          <input
                            type="text"
                            value={draft.title}
                            onChange={(e) => handleUpdateDraftTitle(draft.id, e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-gold hover:border-slate-700 px-1 py-0.5 text-xs font-bold text-slate-100 focus:outline-none flex-1 truncate transition-colors"
                          />
                        </div>

                        {/* Category Dropdown and Badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={draft.category}
                            onChange={(e) => handleUpdateDraftCategory(draft.id, e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-gold rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-gold"
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>

                          {draft.properties.length > 0 && (
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 font-mono border border-slate-700"
                              title={draft.properties.map((p) => `${p.key}: ${p.value}`).join('\n')}
                            >
                              ⚙ {draft.properties.length} props
                            </span>
                          )}

                          <button
                            onClick={() => setExpandedPreviewId(isExpanded ? null : draft.id)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs transition-colors"
                          >
                            {isExpanded ? 'Hide Preview' : 'Preview'}
                          </button>
                        </div>
                      </div>

                      {/* Tag badges */}
                      {draft.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pl-7">
                          {draft.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-400 border border-slate-800"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expandable Preview */}
                      {isExpanded && (
                        <div className="mt-3 pl-7 pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-2">
                          {draft.properties.length > 0 && (
                            <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {draft.properties.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500 font-semibold">{p.key}:</span>
                                  <span className="text-parchment-muted truncate">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div
                            className="prose prose-invert prose-xs max-h-48 overflow-y-auto custom-scrollbar p-3 bg-slate-900/60 rounded-xl border border-slate-800"
                            dangerouslySetInnerHTML={{ __html: draft.contentHtml }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>

          {activeTab === 'import' && parsedDrafts.length > 0 && (
            <button
              onClick={handleConfirmImport}
              disabled={selectedCount === 0}
              className="px-6 py-2 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-xl shadow-lg shadow-gold/20 text-xs disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              <span>Import {selectedCount} Articles</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

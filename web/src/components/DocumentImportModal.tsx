'use client';

import React, { useState, useRef } from 'react';
import { LoreArticle, WorldSnapshot } from '@/lib/database';
import { ROLES, RoleId } from '@/lib/roles';
import { articlesToDrafts, parseDocumentFile, ParsedEntityDraft, recategorizeDrafts } from '@/lib/documentParser';
import { defaultImportRules, ImportRule, loadImportRules, saveImportRules } from '@/lib/importRules';
import ImportRulesEditor from './ImportRulesEditor';
import { parseWorldBackup, WorldBackup } from '@/lib/backup';
import { FileUp, HardDriveDownload, Inbox, SlidersHorizontal, Sparkles, TriangleAlert, X } from 'lucide-react';

interface DocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleCount: number;
  canvasCount: number;
  activeRole: RoleId;
  categories: string[];
  snapshots: WorldSnapshot[];
  // Each returns false if the user cancelled, and throws if the write failed
  onImportArticles: (newArticles: LoreArticle[], mode: 'merge' | 'replace') => Promise<boolean>;
  onRestoreBackup: (backup: WorldBackup) => Promise<boolean>;
  onRestoreSnapshot: (snapshot: WorldSnapshot) => Promise<boolean>;
  onExportBackup: () => void;
}

export default function DocumentImportModal({
  isOpen,
  onClose,
  articleCount,
  canvasCount,
  activeRole,
  categories,
  snapshots,
  onImportArticles,
  onRestoreBackup,
  onRestoreSnapshot,
  onExportBackup,
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

  // Full world backup detected in an uploaded .json file
  const [pendingBackup, setPendingBackup] = useState<WorldBackup | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // Keyword rules for sorting entries into categories; loaded from storage per role
  const [rulesByRole, setRulesByRole] = useState<Partial<Record<RoleId, ImportRule[]>>>({});
  // Bumped on reset so the editor's text fields reload
  const [rulesVersion, setRulesVersion] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const rules = rulesByRole[activeRole] ?? loadImportRules(activeRole);

  const applyRules = (next: ImportRule[] | null) => {
    saveImportRules(activeRole, next);
    const effective = next ?? defaultImportRules(activeRole);
    setRulesByRole((prev) => ({ ...prev, [activeRole]: effective }));
    setParsedDrafts((drafts) => recategorizeDrafts(drafts, activeRole, effective));
  };

  const rulesEditor = (
    <ImportRulesEditor
      key={`${activeRole}-${rulesVersion}`}
      rules={rules}
      saveLabel={parsedDrafts.length > 0 ? 'Save & Re-sort Entries' : 'Save Keywords'}
      onSave={applyRules}
      onReset={() => {
        applyRules(null);
        setRulesVersion((v) => v + 1);
      }}
    />
  );

  // Handle file selection
  const handleProcessFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setCurrentFileName(file.name);
    setPendingBackup(null);

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const backup = parseWorldBackup(JSON.parse(await file.text()));
        if (backup) {
          setPendingBackup(backup);
          return;
        }
      }

      const drafts = await parseDocumentFile(file, activeRole, rules);
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
      // A hand-picked category is kept when entries are re-sorted
      prev.map((d) => (d.id === id ? { ...d, category: newCategory, categoryLocked: true } : d))
    );
  };

  // Run a world-changing action; close on success, stay open with the error on failure
  const runAction = async (action: () => Promise<boolean>) => {
    setIsWorking(true);
    setActionError(null);
    try {
      if (await action()) {
        handleReset();
        onClose();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong. Your world was not changed.');
    } finally {
      setIsWorking(false);
    }
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
      ...(draft.coverImage ? { coverImage: draft.coverImage } : {}),
      isPinned: false,
      last_updated: Date.now() + idx,
    }));

    runAction(() => onImportArticles(newArticles, importMode));
  };

  const handleReset = () => {
    setParsedDrafts([]);
    setCurrentFileName(null);
    setParseError(null);
    setExpandedPreviewId(null);
    setSearchFilter('');
    setPendingBackup(null);
    setActionError(null);
  };

  // Review only the articles of a full backup, to merge them into the current world
  const handleMergeBackupArticles = () => {
    if (!pendingBackup) return;
    setParsedDrafts(articlesToDrafts(pendingBackup.articles, activeRole));
    setImportMode('merge');
    setPendingBackup(null);
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
              <Inbox size={20} aria-hidden /> Import & Export World Data
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
                  ? 'bg-slate-800 text-gold shadow-sm'
                  : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Document Import
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'export'
                  ? 'bg-slate-800 text-gold shadow-sm'
                  : 'text-slate-400 hover:text-slate-50'
              }`}
            >
              Backup & Restore
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
                  <HardDriveDownload size={28} aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-50">Full World Backup</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Export all {articleCount} lore articles (with tags, properties and artwork), {canvasCount} canvases and your workspace role into a single portable `.json` file. Restore it from the Document Import tab.
                  </p>
                </div>
                <button
                  onClick={onExportBackup}
                  className="px-6 py-2.5 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-xl shadow-lg shadow-gold/20 text-xs transition-all"
                >
                  Download .json Backup
                </button>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-50">Safety Snapshots</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Gaea-Forge saves a copy of your world before any import or restore that replaces it. The last 5 are kept on this device.
                  </p>
                </div>
                {snapshots.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No snapshots yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {snapshots.map((snap) => (
                      <li
                        key={snap.id}
                        className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="text-slate-200 font-semibold truncate">{snap.reason}</div>
                          <div className="text-slate-500">
                            {new Date(snap.createdAt).toLocaleString()} · {snap.articleCount} articles · {snap.canvasCount} canvases
                          </div>
                        </div>
                        <button
                          onClick={() => runAction(() => onRestoreSnapshot(snap))}
                          disabled={isWorking}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-gold rounded-lg font-semibold shrink-0 disabled:opacity-40 transition-colors"
                        >
                          Restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : pendingBackup ? (
            /* FULL BACKUP RESTORE VIEW */
            <div className="space-y-6 max-w-xl mx-auto py-6">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-50">Gaea-Forge World Backup</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    <strong className="text-slate-200">{currentFileName}</strong>, exported{' '}
                    {new Date(pendingBackup.exportedAt).toLocaleString()}
                  </p>
                </div>
                <ul className="text-xs text-slate-300 space-y-1">
                  <li>{pendingBackup.articles.length} articles</li>
                  <li>{pendingBackup.canvases.length} canvases</li>
                  {pendingBackup.roleId && <li>Workspace: {ROLES[pendingBackup.roleId].title}</li>}
                </ul>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => runAction(() => onRestoreBackup(pendingBackup))}
                    disabled={isWorking}
                    className="flex-1 px-4 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-xl text-xs disabled:opacity-40 transition-all"
                  >
                    Restore Backup (replaces current world)
                  </button>
                  <button
                    onClick={handleMergeBackupArticles}
                    disabled={isWorking}
                    className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    Review & Merge Articles Only
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  A safety snapshot of your current world is saved before restoring.
                </p>
                <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-50 underline">
                  Choose a different file
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
                  <FileUp size={34} aria-hidden />
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-50 group-hover:text-gold transition-colors">
                    Click to browse or drag & drop documents here
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-md">
                    Upload your lore bibles, character lists, rulebooks, notes, or design documents.
                  </p>
                </div>

                {/* Supported Format Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-red-950/60 text-red-300 border border-red-800/60">
                    .PDF
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-blue-950/60 text-blue-300 border border-blue-800/60">
                    .DOCX / .DOC
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-950/60 text-purple-300 border border-purple-800/60">
                    .MD
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    .TXT
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-amber-950/60 text-amber-300 border border-amber-800/60">
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
                  <p className="text-xs text-slate-500">
                    Detecting headings, characters, nations, bestiary entries, and attributes
                  </p>
                </div>
              )}

              {/* Parsing Error */}
              {parseError && (
                <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-2xl text-red-300 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-2"><TriangleAlert size={14} aria-hidden /> {parseError}</span>
                  <button
                    onClick={() => setParseError(null)}
                    className="text-red-400 hover:text-slate-50 font-bold ml-2"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
              )}

              {/* Features Explain Box */}
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-5 space-y-3 text-xs text-slate-400">
                <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-gold" aria-hidden /> How Gaea-Forge Intelligent Segmentation Works:
                </h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>Multi-Entity Splitting:</strong> If your document contains multiple characters, locations, governments, or items, each is separated into its own clean article.
                  </li>
                  <li>
                    <strong>Auto-Categorization:</strong> Sorts entries into your workspace&apos;s categories using keywords you can adjust below.
                  </li>
                  <li>
                    <strong>Property Extraction:</strong> Automatically detects key-value properties (e.g., <em>Capital City: Aethelia</em>, <em>Arcana: Fire</em>) and converts them into structured attributes.
                  </li>
                  <li>
                    <strong>Interactive Review:</strong> Preview, edit titles, adjust categories, or select which articles to import before saving.
                  </li>
                </ul>
              </div>

              {rulesEditor}
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
                  <p className="text-xs text-slate-500 mt-1">
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
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-50 rounded-lg text-xs transition-colors border border-slate-800"
                  >
                    Choose Different File
                  </button>
                </div>
              </div>

              {rulesEditor}

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
                      data-testid="import-draft"
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
                              className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300 font-mono border border-slate-700"
                              title={draft.properties.map((p) => `${p.key}: ${p.value}`).join('\n')}
                            >
                              <SlidersHorizontal size={11} className="inline -mt-0.5" aria-hidden /> {draft.properties.length} props
                            </span>
                          )}

                          <button
                            onClick={() => setExpandedPreviewId(isExpanded ? null : draft.id)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-50 rounded-lg text-xs transition-colors"
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
                              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-800/80 text-slate-400 border border-slate-800"
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
                            <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {draft.properties.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500 font-semibold">{p.key}:</span>
                                  <span className="text-parchment-muted truncate">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div
                            className="prose dark:prose-invert prose-xs max-h-48 overflow-y-auto custom-scrollbar p-3 bg-slate-900/60 rounded-xl border border-slate-800"
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

          {actionError && (
            <span className="text-xs text-red-300 mx-3 flex-1 flex items-center justify-end gap-1.5"><TriangleAlert size={13} aria-hidden /> {actionError}</span>
          )}

          {activeTab === 'import' && parsedDrafts.length > 0 && (
            <button
              onClick={handleConfirmImport}
              disabled={selectedCount === 0 || isWorking}
              className="px-6 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-xl shadow-lg shadow-gold/20 text-xs disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              <span>
                {importMode === 'replace'
                  ? `Replace World with ${selectedCount} Articles`
                  : `Import ${selectedCount} Articles`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

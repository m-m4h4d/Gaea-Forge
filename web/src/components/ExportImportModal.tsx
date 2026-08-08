'use client';

import React, { useState } from 'react';
import { LoreArticle } from '@/lib/database';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: LoreArticle[];
  onImport: (importedArticles: LoreArticle[]) => void;
}

export default function ExportImportModal({
  isOpen,
  onClose,
  articles,
  onImport,
}: ExportImportModalProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(articles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gaea-forge-world-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setImportSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!Array.isArray(parsed)) {
          throw new Error('Invalid format: File content must be a JSON array of lore articles.');
        }
        
        // Basic validation
        const valid = parsed.every((item) => item.id && item.title && item.category);
        if (!valid) {
          throw new Error('Invalid format: Items must contain at least "id", "title", and "category".');
        }

        onImport(parsed as LoreArticle[]);
        setImportSuccess(`Successfully imported ${parsed.length} world articles!`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse JSON file';
        setImportError(msg);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative text-parchment animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-xl font-bold text-gold tracking-wide mb-1">Export & Import World Data</h2>
        <p className="text-xs text-slate-400 mb-6">Backup your entire world lore to local JSON files or restore from a previous backup.</p>

        <div className="space-y-6 text-sm">
          {/* Export Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">Export World Lore</h3>
              <p className="text-xs text-slate-400">Download all {articles.length} articles as a .json backup file.</p>
            </div>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-gold hover:bg-gold-hover text-slate-950 font-semibold rounded-lg shadow-md text-xs transition-colors shrink-0"
            >
              Export JSON
            </button>
          </div>

          {/* Import Section */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-slate-200 text-sm">Import World Lore</h3>
              <p className="text-xs text-slate-400">Select a Gaea-Forge `.json` backup file to import or merge articles into your local database.</p>
            </div>

            <label className="inline-block cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-parchment font-medium rounded-lg text-xs border border-slate-700 transition-colors">
              Choose JSON File
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {importError && (
              <div className="p-3 bg-red-950/50 border border-red-800/80 text-red-300 text-xs rounded-lg">
                ⚠️ {importError}
              </div>
            )}

            {importSuccess && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs rounded-lg">
                ✓ {importSuccess}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors font-medium text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

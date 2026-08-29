'use client';

import React, { useState } from 'react';
import { CanvasType } from '@/lib/database';

interface NewCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (canvas: { title: string; type: CanvasType }) => void;
}

export default function NewCanvasModal({
  isOpen,
  onClose,
  onCreate,
}: NewCanvasModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CanvasType>('world-web');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      type,
    });

    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar p-6 relative text-parchment animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-xl font-bold text-gold tracking-wide mb-1 flex items-center gap-2">
          <span>🎨</span> Create New World Canvas
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Add an interactive canvas to map your universe lore or character lineage.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
              Canvas Title *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Third Age Conflict Map, House of Aethelgard"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment text-xs focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider">
              Canvas Type
            </label>
            <div className="space-y-2">
              <label
                onClick={() => setType('world-web')}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  type === 'world-web'
                    ? 'bg-gold/20 border-gold text-gold ring-1 ring-gold/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="text-2xl">🌐</span>
                <div className="flex-1">
                  <div className="font-bold text-xs">Master World Web</div>
                  <div className="text-[10px] text-slate-400">
                    Network graph connecting all articles, locations, factions & artifacts in your universe.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setType('family-tree')}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  type === 'family-tree'
                    ? 'bg-gold/20 border-gold text-gold ring-1 ring-gold/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="text-2xl">🌳</span>
                <div className="flex-1">
                  <div className="font-bold text-xs">Family Tree & Lineage</div>
                  <div className="text-[10px] text-slate-400">
                    Hierarchical character tree for marriages, parentage, ancestors, and bloodlines.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
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
              className="px-5 py-2 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-lg shadow-lg shadow-gold/20 disabled:opacity-40 transition-colors text-xs"
            >
              Create Canvas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { RelationshipType } from '@/lib/database';

interface NodeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromName: string;
  toName: string;
  initialRelationship?: RelationshipType;
  initialLabel?: string;
  onSave: (relationship: RelationshipType, label: string) => void;
  onDelete?: () => void;
}

const RELATIONSHIP_OPTIONS: { type: RelationshipType; defaultLabel: string; emoji: string }[] = [
  { type: 'parent-child', defaultLabel: 'Parent of', emoji: '👨‍👩‍👧' },
  { type: 'spouse', defaultLabel: 'Spouse of', emoji: '💍' },
  { type: 'sibling', defaultLabel: 'Sibling to', emoji: '👫' },
  { type: 'ancestor', defaultLabel: 'Ancestor of', emoji: '📜' },
  { type: 'mentor', defaultLabel: 'Mentor to', emoji: '🧙' },
  { type: 'ally', defaultLabel: 'Ally of', emoji: '🛡️' },
  { type: 'rival', defaultLabel: 'Rival of', emoji: '⚔️' },
  { type: 'custom', defaultLabel: 'Related to', emoji: '🔗' },
];

export default function NodeConnectModal({
  isOpen,
  onClose,
  fromName,
  toName,
  initialRelationship = 'parent-child',
  initialLabel,
  onSave,
  onDelete,
}: NodeConnectModalProps) {
  const [relationship, setRelationship] = useState<RelationshipType>(initialRelationship);
  const [customLabel, setCustomLabel] = useState(
    initialLabel || RELATIONSHIP_OPTIONS.find((r) => r.type === initialRelationship)?.defaultLabel || 'Parent of'
  );

  if (!isOpen) return null;

  const handleSelectType = (type: RelationshipType) => {
    setRelationship(type);
    const def = RELATIONSHIP_OPTIONS.find((r) => r.type === type)?.defaultLabel || '';
    setCustomLabel(def);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(relationship, customLabel.trim() || 'Connected');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md p-6 relative text-parchment animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-xl font-bold text-gold tracking-wide mb-1 flex items-center gap-2">
          <span>🔗</span> Define Character Relationship
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Connect <strong className="text-gold">{fromName}</strong> and <strong className="text-gold">{toName}</strong> in the family tree.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider">
              Relationship Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleSelectType(opt.type)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    relationship === opt.type
                      ? 'bg-gold/20 border-gold text-gold font-bold shadow-md shadow-gold/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">{opt.emoji}</span>
                  <div>
                    <div className="font-semibold">{opt.defaultLabel}</div>
                    <div className="text-[9px] text-slate-500 capitalize">{opt.type}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">
              Custom Connection Label
            </label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Eldest Son of, Foster Parent, Adopted"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-parchment text-xs focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-300 rounded-lg font-semibold text-xs transition-colors"
              >
                Delete Link
              </button>
            ) : <div />}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-gold hover:bg-gold-hover text-slate-950 font-bold rounded-lg shadow-lg shadow-gold/20 transition-colors text-xs"
              >
                Save Relationship
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

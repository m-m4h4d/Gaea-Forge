'use client';

import { useRef } from 'react';
import { AppWindow } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// Covers a tab that is waiting while another tab edits the world (see lib/tabLock.ts)
export default function OtherTabNotice({ onTakeOver, isTakingOver }: { onTakeOver: () => void; isTakingOver: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(panelRef, true, buttonRef);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="other-tab-title"
        aria-describedby="other-tab-text"
        tabIndex={-1}
        className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-parchment text-center space-y-3 focus:outline-none"
      >
        <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center mx-auto">
          <AppWindow size={20} aria-hidden />
        </div>
        <h2 id="other-tab-title" className="text-base font-bold text-slate-50">
          Gaea Forge is open in another tab
        </h2>
        <p id="other-tab-text" className="text-xs text-slate-400 leading-relaxed">
          One tab at a time can make changes, so edits never overwrite each other. This tab keeps showing the
          other tab&apos;s saved changes, and takes over by itself when that tab closes.
        </p>
        <button
          ref={buttonRef}
          onClick={onTakeOver}
          disabled={isTakingOver}
          className="w-full px-4 py-2 bg-gold hover:bg-gold-hover text-on-accent font-bold rounded-lg text-xs shadow-md shadow-gold/20 disabled:opacity-60 transition-colors"
        >
          {isTakingOver ? 'Saving the other tab’s changes…' : 'Use this tab instead'}
        </button>
      </div>
    </div>
  );
}

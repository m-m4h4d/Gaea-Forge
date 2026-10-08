'use client';

import { Notice } from '@/hooks/useNotice';

// Bottom-right status message for results, save errors and undo offers
export default function NoticeToast({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[60] max-w-sm pl-4 pr-2 py-2 rounded-xl border text-xs shadow-2xl flex items-center gap-3 ${
        notice.kind === 'error'
          ? 'bg-red-950/95 border-red-800 text-red-200'
          : 'bg-slate-900/95 border-emerald-800 text-emerald-300'
      }`}
    >
      <span className="py-0.5">{notice.text}</span>
      {notice.action && (
        <button
          onClick={() => {
            notice.action!.onClick();
            onDismiss();
          }}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-gold font-bold shrink-0"
        >
          {notice.action.label}
        </button>
      )}
    </div>
  );
}

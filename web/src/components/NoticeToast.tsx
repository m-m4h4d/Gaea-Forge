'use client';

import { Notice } from '@/hooks/useNotice';

// Bottom-right status message for import results and save errors
export default function NoticeToast({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[60] max-w-sm px-4 py-2.5 rounded-xl border text-xs shadow-2xl ${
        notice.kind === 'error'
          ? 'bg-red-950/95 border-red-800 text-red-200'
          : 'bg-slate-900/95 border-emerald-800 text-emerald-300'
      }`}
    >
      {notice.text}
    </div>
  );
}

'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  // Danger dialogs style the confirm button red and focus Cancel first
  tone?: 'default' | 'danger';
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

// Themed replacement for window.confirm: `await confirm({...})` resolves true/false
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <DialogProvider>');
  return confirm;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // A dialog that is already open is answered "no" before the next one shows
        setPending((current) => {
          current?.resolve(false);
          return { ...options, resolve };
        });
      }),
    []
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const danger = options.tone === 'danger';
  useFocusTrap(dialogRef, true, danger ? cancelRef : confirmRef);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={options.message ? 'confirm-message' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose(false);
          }
        }}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md p-6 text-parchment"
      >
        <div className="flex items-start gap-3">
          {danger && (
            <span className="shrink-0 w-9 h-9 rounded-full bg-red-950/60 border border-red-800/80 text-red-400 flex items-center justify-center">
              <TriangleAlert size={16} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-bold text-slate-100">
              {options.title}
            </h2>
            {options.message && (
              <p id="confirm-message" className="text-xs text-slate-400 mt-1.5 leading-relaxed whitespace-pre-line">
                {options.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6 text-xs">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium"
          >
            {options.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={`px-4 py-2 rounded-lg font-bold ${
              // red-600 is not remapped by the light theme, so white text keeps 4.8:1 contrast in both modes
              danger ? 'bg-red-600 hover:brightness-110 text-white' : 'bg-gold hover:bg-gold-hover text-on-accent'
            }`}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

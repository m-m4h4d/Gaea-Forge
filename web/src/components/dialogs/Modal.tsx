'use client';

import React, { RefObject, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ModalProps {
  onClose: () => void;
  // id of the element that names the dialog (usually its heading)
  labelledBy: string;
  // Backdrop look (color, blur, padding); positioning is shared
  overlayClassName: string;
  // The dialog panel itself
  className: string;
  initialFocus?: RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

// Shared shell for the app's modals: dialog semantics, Escape to close (same as the
// modal's own Cancel/Close button) and keyboard focus kept inside while open.
// Backdrop clicks deliberately do nothing, so a stray click can't discard work in progress.
export default function Modal({ onClose, labelledBy, overlayClassName, className, initialFocus, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, initialFocus);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClassName}`}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // Lets clicks on non-interactive parts keep focus inside the dialog
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !e.defaultPrevented) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        className={`${className} focus:outline-none`}
      >
        {children}
      </div>
    </div>
  );
}

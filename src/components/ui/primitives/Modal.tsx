/**
 * Modal Component - Apple HIG Design System
 *
 * A centralized modal system with smooth animations and backdrop blur.
 * Handles focus trap, keyboard navigation, and portal rendering.
 *
 * @example
 * <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Confirm">
 *   <p>Are you sure?</p>
 * </Modal>
 */

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Button } from './Button';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal size */
  size?: ModalSize;
  /** Show close button */
  showCloseButton?: boolean;
  /** Prevent closing on overlay click */
  preventOverlayClose?: boolean;
  /** Prevent closing on escape key */
  preventEscapeClose?: boolean;
  /** Enable backdrop blur */
  blur?: boolean;
  /** Footer content */
  footer?: React.ReactNode;
  /** Additional className for content */
  className?: string;
  /** Modal content */
  children?: React.ReactNode;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const contentVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.15,
    },
  },
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  size = 'md',
  showCloseButton = true,
  preventOverlayClose = false,
  preventEscapeClose = false,
  blur = true,
  footer,
  className = '',
  children,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Stable refs for props so the focus/keydown effect runs only on `open` transitions.
  // Without this, callers that pass inline arrow functions for `onClose` cause the effect
  // to re-run on every render, which restores focus to the trigger button and makes
  // inputs inside the modal lose focus on every keystroke (feedback #ee34bf23).
  const onCloseRef = useRef(onClose);
  const preventEscapeCloseRef = useRef(preventEscapeClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    preventEscapeCloseRef.current = preventEscapeClose;
  }, [preventEscapeClose]);

  // Tab-trap the modal while open (CB-01 CODEX pass 2): confirm/delete
  // dialogs like ConfirmModal must keep keyboard focus inside — Tab on the
  // last focusable element cycles to the first, Shift+Tab on the first
  // cycles to the last. Mirrors the established codebase convention
  // (NotebookLibraryContent.tsx's inline focus trap).
  const getFocusable = useCallback((): HTMLElement[] => {
    const container = modalRef.current;
    if (!container) return [];
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !preventEscapeCloseRef.current) {
        onCloseRef.current?.();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [getFocusable]
  );

  // Capture the trigger element in TWO PASSES (RN-G5 platform lane,
  // 2026-08-12, P1 nr 2 — root cause measured with instrumented Playwright,
  // see task report, not guessed):
  //
  // Pass 1 — DURING RENDER, on the false→true edge, not in ANY effect.
  // React implements the HTML `autoFocus` attribute (e.g. the title input
  // `RoiCaseCreateModal` opens with) by calling `.focus()` itself inside
  // `commitMount`, which runs DURING the mutation phase of the SAME commit
  // that mounts this modal's children — strictly BEFORE even
  // `useLayoutEffect` fires (tried first; still lost the race). So no
  // effect in this component, however early, can read
  // `document.activeElement` before a body `autoFocus` field has already
  // stolen it: a persistent Menu 2 CTA (which survives the commit) lost
  // that race and got overwritten with the input; on close, restoring
  // focus to that (now-unmounted) input silently fell back to `<body>`.
  // Reading here, in the render body itself, runs before ANY commit for
  // this render, so the DOM still reflects the PREVIOUS commit — the real
  // trigger, always. Mutating a ref during render (not `setState`) is the
  // standard, sanctioned way to derive state from a prop transition
  // without an effect (React docs, "Adjusting state based on a prop
  // change"); it has no side effect, so it stays idempotent under
  // StrictMode's double-render.
  //
  // Pass 2 — self-heal in the passive effect below, ONLY if pass 1's
  // element didn't survive to this commit's cleanup. This exists for the
  // opposite failure mode, also measured: a kebab's row-actions menu item
  // (`RowActionsMenu.tsx`, a DIFFERENT component, out of scope for this
  // lane) is what's actually focused at click time — it is itself removed
  // from the DOM in the SAME commit that opens this modal (the popover
  // closes together with its menu-item click), so pass 1 there correctly
  // captures an element that's ABOUT to vanish. `RowActionsMenu` already
  // owns a "return focus to the kebab button" effect of its own (§7/§8) —
  // untouched here — which fires as a passive effect BEFORE this one
  // (earlier in commit order) and re-points real focus at the kebab
  // button. So: if pass 1's capture is gone by the time we'd restore to
  // it, trust whatever the DOM says is focused *right now* instead of the
  // stale reference — that reflects the opener's own cleanup, already
  // done, rather than a blind guess.
  // `useRef(false)`, NOT `useRef(open)` — some callers (`RoiTransitionDialog`)
  // return `null` instead of rendering `<Modal>` until they have content,
  // so this `<Modal>` fiber's FIRST EVER render can already have
  // `open=true` (no prior `open=false` render happened for this instance).
  // Seeding the ref with `open` would then start `wasOpenRef.current` at
  // `true`, permanently hiding the false→true edge for that mount. Seeding
  // with a hardcoded `false` makes "first render already open" register as
  // a fresh open, same as any later open transition.
  const wasOpenRef = useRef(false);
  if (open && !wasOpenRef.current) {
    previousActiveElement.current = document.activeElement as HTMLElement;
  }
  wasOpenRef.current = open;

  useEffect(() => {
    if (open) {
      if (
        previousActiveElement.current &&
        !document.contains(previousActiveElement.current)
      ) {
        const fallback = document.activeElement;
        if (fallback instanceof HTMLElement && fallback !== document.body) {
          previousActiveElement.current = fallback;
        }
      }
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      const focusTimer = setTimeout(() => {
        modalRef.current?.focus();
      }, 0);

      return () => {
        clearTimeout(focusTimer);
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
    return undefined;
  }, [open, handleKeyDown]);

  // Handle overlay click
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !preventOverlayClose) {
      onClose();
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`
            fixed inset-0 z-modal flex items-center justify-center p-4
            ${blur ? 'backdrop-blur-sm' : ''}
          `}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={overlayVariants}
          transition={{ duration: 0.15 }}
          onClick={handleOverlayClick}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/30 dark:bg-black/50"
            variants={overlayVariants}
          />

          {/* Content */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-describedby={description ? 'modal-description' : undefined}
            tabIndex={-1}
            className={`
              relative w-full ${sizeStyles[size]}
              bg-white dark:bg-navy-900
              rounded-xl
              shadow-[0_25px_50px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.1)]
              dark:shadow-[0_25px_50px_rgba(0,0,0,0.5),0_12px_24px_rgba(0,0,0,0.4)]
              overflow-hidden
              outline-none
              ${className}
            `}
            variants={contentVariants as any}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-4 p-6 pb-0">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2
                      id="modal-title"
                      className="text-lg font-semibold text-navy-900 dark:text-white"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p
                      id="modal-description"
                      className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                    >
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="flex-shrink-0 -mt-1 -mr-2"
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </Button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Convenience components for common patterns
export interface ConfirmModalProps extends Omit<ModalProps, 'footer' | 'children'> {
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant */
  confirmVariant?: 'primary' | 'danger';
  /** Loading state for confirm button */
  loading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Message to display */
  message?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onClose,
  message,
  ...props
}) => {
  return (
    <Modal
      {...props}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      {message && <p className="text-slate-600 dark:text-slate-300">{message}</p>}
    </Modal>
  );
};

export default Modal;

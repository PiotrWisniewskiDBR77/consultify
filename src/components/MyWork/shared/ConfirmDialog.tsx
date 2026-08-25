/**
 * ConfirmDialog - Replaces native confirm() with Golden Standard modal
 * Supports: delete single, bulk delete, and generic confirmations
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useId, useRef } from 'react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  confirmDisabled?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon,
  children,
  confirmDisabled = false,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => confirmRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    },
    [isOpen, onCancel, onConfirm]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const variantStyles = {
    danger: {
      iconBg: 'bg-danger-100 dark:bg-danger-500/15',
      iconColor: 'text-danger-600 dark:text-danger-400',
      confirmBg: 'bg-danger-600 hover:bg-danger-700 focus:ring-danger-500/40',
      defaultIcon: <Trash2 size={20} />,
    },
    warning: {
      iconBg: 'bg-amber-100 dark:bg-amber-500/15',
      iconColor: 'text-amber-600 dark:text-amber-400',
      confirmBg: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/40',
      defaultIcon: <AlertTriangle size={20} />,
    },
    default: {
      iconBg: 'bg-slate-100 dark:bg-white/10',
      iconColor: 'text-slate-600 dark:text-slate-300',
      confirmBg:
        'bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] focus:ring-navy-900/40',
      defaultIcon: null,
    },
  };

  const style = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.1 }}
            className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                {(icon || style.defaultIcon) && (
                  <div className={`p-2.5 rounded-xl ${style.iconBg} shrink-0`}>
                    <span className={style.iconColor}>{icon || style.defaultIcon}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    id={titleId}
                    className="text-base font-semibold text-slate-900 dark:text-white"
                  >
                    {title}
                  </h3>
                  {description && (
                    <p
                      id={descriptionId}
                      className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
                    >
                      {description}
                    </p>
                  )}
                  {children}
                </div>
                <button
                  type="button"
                  aria-label={cancelLabel}
                  onClick={onCancel}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 px-4 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 border border-slate-200 dark:border-navy-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                ref={confirmRef}
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={`h-9 px-4 rounded-lg text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 ${style.confirmBg}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook for declarative confirm dialog usage
interface UseConfirmDialogReturn {
  dialog: React.ReactNode;
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
  }) => Promise<boolean>;
}

export const useConfirmDialog = (): UseConfirmDialogReturn => {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    resolve?: (value: boolean) => void;
  }>({ isOpen: false, title: '' });

  const confirm = useCallback(
    (options: {
      title: string;
      description?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: 'danger' | 'warning' | 'default';
    }) => {
      return new Promise<boolean>((resolve) => {
        setState({ isOpen: true, ...options, resolve });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state.resolve]);

  const dialog = (
    <ConfirmDialog
      isOpen={state.isOpen}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
    />
  );

  return { dialog, confirm };
};

export default ConfirmDialog;

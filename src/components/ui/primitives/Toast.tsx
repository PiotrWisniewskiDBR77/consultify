/**
 * Toast Component - Apple HIG Design System
 *
 * A notification toast system with smooth animations.
 * Provides a simple API for showing notifications.
 *
 * @example
 * toast.success('Changes saved');
 * toast.error('Something went wrong');
 * toast.info('New update available');
 */

import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-right'
  | 'top-center'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Hook to use toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider
export interface ToastProviderProps {
  /** Position of toasts */
  position?: ToastPosition;
  /** Default duration in ms */
  defaultDuration?: number;
  /** Maximum number of toasts */
  maxToasts?: number;
  /** Children */
  children: React.ReactNode;
}

let toastId = 0;
const generateId = () => `toast-${++toastId}`;

export const ToastProvider: React.FC<ToastProviderProps> = ({
  position = 'top-right',
  defaultDuration = 5000,
  maxToasts = 5,
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        duration: defaultDuration,
        dismissible: true,
        ...toast,
      };

      setToasts((prev) => {
        const updated = [newToast, ...prev];
        return updated.slice(0, maxToasts);
      });

      // Auto dismiss
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }

      return id;
    },
    [defaultDuration, maxToasts]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const positionClasses: Record<ToastPosition, string> = {
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4',
  };

  const isTop = position.startsWith('top');

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <div
            className={`fixed z-toast flex flex-col gap-2 pointer-events-none ${positionClasses[position]}`}
            style={{ maxWidth: 'min(420px, calc(100vw - 2rem))' }}
          >
            <AnimatePresence initial={false}>
              {toasts.map((toast) => (
                <ToastItem
                  key={toast.id}
                  toast={toast}
                  onDismiss={() => removeToast(toast.id)}
                  isTop={isTop}
                />
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

// Toast Item
interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
  isTop: boolean;
}

const toastVariants = {
  hidden: (isTop: boolean) => ({
    opacity: 0,
    y: isTop ? -20 : 20,
    scale: 0.95,
  }),
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 30 },
  },
  exit: (isTop: boolean) => ({
    opacity: 0,
    y: isTop ? -20 : 20,
    scale: 0.95,
    transition: { duration: 0.15 },
  }),
};

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={20} className="text-success-500" />,
  error: <AlertCircle size={20} className="text-danger-500" />,
  warning: <AlertTriangle size={20} className="text-amber-500" />,
  info: <Info size={20} className="text-primary-500" />,
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, isTop }) => {
  return (
    <motion.div
      layout
      custom={isTop}
      variants={toastVariants as any}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`
        pointer-events-auto
        flex items-start gap-3
        w-full
        px-4 py-3
        bg-white dark:bg-navy-900
        rounded-xl
        shadow-[0_10px_40px_rgba(0,0,0,0.12)]
        dark:shadow-[0_10px_40px_rgba(0,0,0,0.4)]
        border border-slate-200/50 dark:border-navy-700
      `}
    >
      {/* Icon */}
      <span className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-navy-900 dark:text-white">{toast.title}</p>
        )}
        <p
          className={`text-sm ${toast.title ? 'text-slate-500 dark:text-slate-400' : 'text-navy-900 dark:text-white'}`}
        >
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      {toast.dismissible && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <X size={16} />
        </button>
      )}
    </motion.div>
  );
};

// Convenience functions (for imperative usage)
let globalAddToast: ToastContextValue['addToast'] | null = null;

export const setGlobalToastHandler = (addToast: ToastContextValue['addToast']) => {
  globalAddToast = addToast;
};

export const toast = {
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    globalAddToast?.({ type: 'success', message, ...options });
  },
  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    globalAddToast?.({ type: 'error', message, ...options });
  },
  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    globalAddToast?.({ type: 'warning', message, ...options });
  },
  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    globalAddToast?.({ type: 'info', message, ...options });
  },
};

// Toast Initializer component (put in App root)
export const ToastInitializer: React.FC = () => {
  const { addToast } = useToast();

  React.useEffect(() => {
    setGlobalToastHandler(addToast);
    return () => setGlobalToastHandler(null as any);
  }, [addToast]);

  return null;
};

export default ToastProvider;

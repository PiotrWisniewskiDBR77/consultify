/**
 * KeyboardShortcutsModal - Help modal for keyboard shortcuts
 * Part of My Work Module PMO Upgrade
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ShortcutAction } from '../../../types';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutAction[];
}

/**
 * Render keyboard key
 */
const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">
    {children}
  </span>
);

/**
 * KeyboardShortcutsModal Component
 */
export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  shortcuts,
}) => {
  const { t } = useTranslation();

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutAction[]>
  );

  // Format key for display
  const formatKey = (shortcut: ShortcutAction): React.ReactNode => {
    const keyString = (shortcut as any).currentKey || (shortcut as any).defaultKey || '';
    const parts = keyString.split(/[\s+]/); // Split by space or +

    return (
      <div className="flex items-center gap-1">
        {parts.map((part: any, idx: number) => (
          <React.Fragment key={idx}>
            {idx > 0 && part !== 'then' && (
              <span className="text-slate-400 dark:text-slate-500">+</span>
            )}
            {part === 'then' ? (
              <span className="mx-1 text-slate-400 dark:text-slate-500">then</span>
            ) : (
              <Key>{part}</Key>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-navy-900 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-navy-700">
              <div className="flex items-center gap-2">
                <Keyboard size={20} className="text-brand" />
                <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
                  {t('myWork.shortcuts.title', 'Keyboard Shortcuts')}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {(categoryShortcuts as any[]).map((shortcut: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-navy-700 last:border-0"
                      >
                        <span className="text-sm text-navy-900 dark:text-white">
                          {shortcut.description}
                        </span>
                        {formatKey(shortcut)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer tip */}
            <div className="p-4 border-t border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-white/5">
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                {t('myWork.shortcuts.tip', 'Press ? to open this help at any time')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsModal;

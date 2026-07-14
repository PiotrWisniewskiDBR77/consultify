/**
 * KeyboardShortcutsHelp
 * Modal showing available keyboard shortcuts
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Command, Keyboard, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ShortcutHelp, SHORTCUTS_HELP } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: ShortcutHelp[];
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts = SHORTCUTS_HELP,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const categories = {
    navigation: {
      label: t('myWork.keyboardShortcuts.label', 'Navigation'),
      icon: '🧭',
    },
    actions: {
      label: t('myWork.keyboardShortcuts.label2', 'Actions'),
      icon: '⚡',
    },
    status: {
      label: t('myWork.keyboardShortcuts.label3', 'Status'),
      icon: '🎯',
    },
    selection: {
      label: t('myWork.keyboardShortcuts.label4', 'Selection'),
      icon: '✓',
    },
  };

  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutHelp[]>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-500/10">
                  <Keyboard size={20} className="text-primary-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {t('myWork.keyboardShortcuts.keyboardShortcuts', 'Keyboard Shortcuts')}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('myWork.keyboardShortcuts.pressToShowHide', 'Press ? to show/hide')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(categories).map(([categoryKey, categoryConfig]) => {
                  const shortcuts = groupedShortcuts[categoryKey] || [];
                  if (shortcuts.length === 0) return null;

                  return (
                    <div key={categoryKey}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">{categoryConfig.icon}</span>
                        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          {categoryConfig.label}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {shortcuts.map((shortcut, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-navy-800"
                          >
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                              {shortcut.key.split('+').map((key, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && (
                                    <span className="text-slate-600 dark:text-slate-500 text-xs">
                                      +
                                    </span>
                                  )}
                                  <kbd className="px-2 py-1 rounded bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">
                                    {key.trim()}
                                  </kbd>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Command size={14} />
                <span>
                  {t(
                    'myWork.keyboardShortcuts.useCtrlWindowsOr',
                    'Use Ctrl (Windows) or ⌘ (Mac) for modifier shortcuts'
                  )}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsHelp;

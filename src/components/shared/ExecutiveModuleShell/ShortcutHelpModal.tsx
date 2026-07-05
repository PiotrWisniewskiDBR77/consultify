/**
 * ShortcutHelpModal — keyboard-shortcut listing modal for
 * `ExecutiveModuleShell` (MELS § 3.4 + EPIC-T16 D6).
 *
 * Renders a small DBR77-token modal listing the supplied shortcuts in
 * the order they were registered. Triggered by the `⌘/` shortcut
 * (`open-shortcut-help`) wired in `shortcuts.ts`; the shell owns the
 * `helpOpen` state and passes the toggle handlers down.
 *
 * Constraints:
 *   * Modal closes on Escape and on outside-click (backdrop).
 *   * Title and rows are accessible: `role="dialog"`,
 *     `aria-modal="true"`, focused close button on open.
 *   * No raw hex literals — only Tailwind tokens.
 */

import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

import type { ShortcutDescriptor } from './shortcuts';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutDescriptor[];
  /** Optional title — defaults to "Keyboard shortcuts". */
  title?: string;
  /** Optional subtitle / hint shown under the title. */
  description?: string;
  /** `data-testid` override. */
  testId?: string;
}

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({
  isOpen,
  onClose,
  shortcuts,
  title = 'Keyboard shortcuts',
  description,
  testId,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-900/50 dark:bg-navy-950/70"
      data-testid={testId ?? 'mels-shortcut-help-backdrop'}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl w-full max-w-md mx-4 p-5"
        data-testid="mels-shortcut-help"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </h2>
            {description ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close shortcut help"
            data-testid="mels-shortcut-help-close"
          >
            <X size={16} />
          </button>
        </div>

        {shortcuts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            No shortcuts registered.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-navy-800">
            {shortcuts.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between py-2 text-sm text-slate-700 dark:text-slate-300"
                data-testid={`mels-shortcut-row-${s.id}`}
              >
                <span className="truncate">{s.label}</span>
                <kbd className="ml-3 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700">
                  {s.display}
                </kbd>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ShortcutHelpModal;

/**
 * KeyboardShortcutsPanel — Overlay showing all keyboard shortcuts.
 * Opens with `?` key or from toolbar button.
 */
import { Keyboard, X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  titleEn: string;
  titlePl: string;
  shortcuts: { keys: string[]; labelEn: string; labelPl: string }[];
}

/** Stable camelCase i18n-key fragment derived from an English label (e.g. "Views & Tools" -> "viewsTools"). */
function shortcutSlug(s: string): string {
  const words = s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);
  return words
    .map((w, i) =>
      i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join('');
}

const GROUPS: ShortcutGroup[] = [
  {
    titleEn: 'Navigation',
    titlePl: 'Nawigacja',
    shortcuts: [
      { keys: ['↑', '↓'], labelEn: 'Move between rows', labelPl: 'Przejdź między wierszami' },
      { keys: ['Tab'], labelEn: 'Next cell', labelPl: 'Następna komórka' },
      { keys: ['Shift', 'Tab'], labelEn: 'Previous cell', labelPl: 'Poprzednia komórka' },
      { keys: ['Enter'], labelEn: 'Move to row below', labelPl: 'Przejdź do wiersza poniżej' },
      { keys: ['Escape'], labelEn: 'Deselect / close panel', labelPl: 'Odznacz / zamknij panel' },
      { keys: ['Ctrl', '→'], labelEn: 'Next column', labelPl: 'Następna kolumna' },
      { keys: ['Ctrl', '←'], labelEn: 'Previous column', labelPl: 'Poprzednia kolumna' },
    ],
  },
  {
    titleEn: 'Editing',
    titlePl: 'Edycja',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], labelEn: 'Undo', labelPl: 'Cofnij' },
      { keys: ['Ctrl', 'Y'], labelEn: 'Redo', labelPl: 'Ponów' },
      { keys: ['Delete'], labelEn: 'Delete selected rows', labelPl: 'Usuń zaznaczone wiersze' },
      { keys: ['Ctrl', 'S'], labelEn: 'Save', labelPl: 'Zapisz' },
      { keys: ['Ctrl', 'N'], labelEn: 'Add new row', labelPl: 'Dodaj nowy wiersz' },
    ],
  },
  {
    titleEn: 'Views & Tools',
    titlePl: 'Widoki i narzędzia',
    shortcuts: [
      { keys: ['/'], labelEn: 'Open AI Assistant', labelPl: 'Otwórz Asystenta AI' },
      { keys: ['?'], labelEn: 'Show keyboard shortcuts', labelPl: 'Pokaż skróty klawiszowe' },
      { keys: ['Ctrl', 'Shift', 'K'], labelEn: 'Switch to Kanban', labelPl: 'Przełącz na Kanban' },
      {
        keys: ['Ctrl', 'Shift', 'S'],
        labelEn: 'Switch to Sticky Notes',
        labelPl: 'Przełącz na Karteczki',
      },
      { keys: ['Ctrl', 'Shift', 'M'], labelEn: 'Switch to Matrix', labelPl: 'Przełącz na Matrix' },
      { keys: ['Ctrl', 'Shift', 'T'], labelEn: 'Switch to Table', labelPl: 'Przełącz na Tabelę' },
      { keys: ['Ctrl', 'Shift', 'F'], labelEn: 'Toggle filters', labelPl: 'Przełącz filtry' },
      {
        keys: ['Ctrl', 'Shift', 'D'],
        labelEn: 'Toggle summary dashboard',
        labelPl: 'Przełącz podsumowanie',
      },
    ],
  },
];

export const KeyboardShortcutsPanel: React.FC<KeyboardShortcutsPanelProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();

  // `?` still closes as a bespoke shortcut; Escape-to-close, focus trap,
  // and focus restore now come from useDialogA11y below (this used to
  // also handle Escape here, duplicating the hook's document-level
  // listener).
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, open]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-panel-heading"
        tabIndex={-1}
        className="w-[480px] max-w-[90vw] max-h-[80vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle">
          <Keyboard size={16} className="text-c-text-secondary" />
          <span id="keyboard-shortcuts-panel-heading" className="text-sm font-bold text-c-text">
            {t('ideas.table.shortcuts.title', 'Keyboard Shortcuts')}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto p-5 space-y-5" style={{ maxHeight: 'calc(80vh - 60px)' }}>
          {GROUPS.map((group) => (
            <div key={group.titleEn}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted mb-2.5">
                {t(`ideas.table.shortcuts.group.${shortcutSlug(group.titleEn)}`, group.titleEn)}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc) => (
                  <div key={sc.labelEn} className="flex items-center gap-3 py-1">
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {sc.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="text-[9px] text-c-text-secondary">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-c-surface-raised border border-c-border-subtle text-[10px] font-bold text-c-text-secondary shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                    <span className="text-[11px] text-c-text-secondary">
                      {t(`ideas.table.shortcuts.item.${shortcutSlug(sc.labelEn)}`, sc.labelEn)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsPanel;

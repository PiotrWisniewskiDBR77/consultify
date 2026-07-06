import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  MessageCircleQuestion,
  Minus,
  PenLine,
  Quote,
  Sparkles,
  Table2,
  Text,
  ToggleRight,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * NotebookSlashMenu — premium (Notion/Craft-grade) "/" block inserter for the
 * Living Notebook editor (N7 redesign).
 *
 * Self-contained presentation + keyboard-navigation component. The host editor
 * (TipTap/ProseMirror) detects the "/" trigger, tracks the query string and the
 * caret coordinates, then renders this menu and wires `onSelect(blockType)` to
 * the matching editor command. This component owns NO editor reference — it is a
 * pure dropdown so it can be unit-tested and reused in isolation.
 *
 * The `blockType` strings handed to `onSelect` map 1:1 to commands the notebook
 * editor REALLY supports (verified against `extensions.ts` + StarterKit +
 * NotebookToolbar). Any block that would require new editor extensions is marked
 * with a `// wymaga rozszerzenia edytora` comment and intentionally omitted.
 *
 * Suggested host wiring (the editor side, NOT part of this file):
 *
 *   const dispatch = (bt: NotebookBlockType) => {
 *     const c = editor.chain().focus().deleteRange({ from: triggerPos, to: caret });
 *     switch (bt) {
 *       case 'paragraph':   c.setParagraph().run(); break;
 *       case 'heading1':    c.toggleHeading({ level: 1 }).run(); break;
 *       case 'heading2':    c.toggleHeading({ level: 2 }).run(); break;
 *       case 'heading3':    c.toggleHeading({ level: 3 }).run(); break;
 *       case 'bulletList':  c.toggleBulletList().run(); break;
 *       case 'orderedList': c.toggleOrderedList().run(); break;
 *       case 'taskList':    c.toggleTaskList().run(); break;
 *       case 'blockquote':  c.toggleBlockquote().run(); break;
 *       case 'codeBlock':   c.toggleCodeBlock().run(); break;
 *       case 'callout':     c.run(); editor.commands.setCallout({ variant: 'info' }); break;
 *       case 'toggle':      c.run(); editor.commands.setDetails(); break;
 *       case 'divider':     c.setHorizontalRule().run(); break;
 *       case 'image':       c.run(); window.dispatchEvent(new CustomEvent('notebook-insert-image')); break;
 *       case 'table':       c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
 *       case 'ai-continue': // fall through
 *       case 'ai-summarize':
 *       case 'ai-ask':      c.run(); onAICommand(bt); break;
 *     }
 *   };
 *
 *   <NotebookSlashMenu
 *     open={slash.open}
 *     query={slash.query}
 *     position={{ x: slash.coords.left, y: slash.coords.top }}
 *     onSelect={dispatch}
 *     onClose={closeSlash}
 *     isPolish={i18n.language === 'pl'}
 *   />
 */

export type NotebookBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'callout'
  | 'toggle'
  | 'divider'
  | 'image'
  | 'table'
  | 'ai-continue'
  | 'ai-summarize'
  | 'ai-ask';

export interface NotebookSlashMenuProps {
  /** Whether the menu is visible. */
  open: boolean;
  /** Live filter text typed after the "/" trigger (without the slash). */
  query: string;
  /** Absolute viewport coordinates of the caret/trigger (top-left of the menu). */
  position: { x: number; y: number };
  /** Fired with the chosen block type. The host translates it to an editor command. */
  onSelect: (blockType: NotebookBlockType) => void;
  /** Fired on Escape, outside-click, or after a selection. */
  onClose: () => void;
  /** Language toggle for labels/descriptions. */
  isPolish: boolean;
}

type GroupId = 'basic' | 'media' | 'ai';

interface BlockDef {
  type: NotebookBlockType;
  group: GroupId;
  icon: LucideIcon;
  label: string;
  labelPl: string;
  description: string;
  descriptionPl: string;
  /** Extra match terms (typed query is matched against label + these). */
  keywords: string[];
  /** Accent the leading icon (AI items get a subtle distinct tint). */
  ai?: boolean;
}

/**
 * Block catalogue. Every entry below maps to a command the editor REALLY
 * supports today — verified against:
 *   - StarterKit:                 paragraph, heading 1-3, bullet/ordered list,
 *                                 blockquote, horizontalRule
 *   - extension-task-list:        taskList  (toggleTaskList — see NotebookToolbar)
 *   - NotebookCodeBlock:          codeBlock (lowlight)
 *   - NotebookImage:              image     (insert via host event)
 *   - extension-table:            table     (insertTable)
 *   - CalloutNode (extensions.ts):    setCallout()
 *   - DetailsNode (extensions.ts):    setDetails()  → "toggle"
 *
 * Deliberately NOT listed (would need new editor extensions):
 *   // wymaga rozszerzenia edytora — Columns / layout grid (no column node;
 *   //   the old SlashMenu faked it via a 1×2 table — omitted to keep the
 *   //   vocabulary honest)
 *   // wymaga rozszerzenia edytora — Math / equation block (no katex node)
 *   // wymaga rozszerzenia edytora — Embed / bookmark (no embed node)
 *   // wymaga rozszerzenia edytora — Synced block / database view
 */
const BLOCKS: BlockDef[] = [
  // ---- Podstawowe -----------------------------------------------------------
  {
    type: 'paragraph',
    group: 'basic',
    icon: Text,
    label: 'Text',
    labelPl: 'Tekst',
    description: 'Plain paragraph',
    descriptionPl: 'Zwykły akapit',
    keywords: ['text', 'paragraph', 'plain', 'body', 'tekst', 'akapit'],
  },
  {
    type: 'heading1',
    group: 'basic',
    icon: Heading1,
    label: 'Heading 1',
    labelPl: 'Nagłówek 1',
    description: 'Large section title',
    descriptionPl: 'Duży tytuł sekcji',
    keywords: ['h1', 'heading', 'title', 'naglowek', 'tytul'],
  },
  {
    type: 'heading2',
    group: 'basic',
    icon: Heading2,
    label: 'Heading 2',
    labelPl: 'Nagłówek 2',
    description: 'Medium section title',
    descriptionPl: 'Średni tytuł sekcji',
    keywords: ['h2', 'heading', 'subtitle', 'naglowek'],
  },
  {
    type: 'heading3',
    group: 'basic',
    icon: Heading3,
    label: 'Heading 3',
    labelPl: 'Nagłówek 3',
    description: 'Small section title',
    descriptionPl: 'Mały tytuł sekcji',
    keywords: ['h3', 'heading', 'naglowek'],
  },
  {
    type: 'bulletList',
    group: 'basic',
    icon: List,
    label: 'Bulleted list',
    labelPl: 'Lista punktowana',
    description: 'Simple bullet list',
    descriptionPl: 'Lista z punktorami',
    keywords: ['bullet', 'list', 'ul', 'unordered', 'lista', 'punkty'],
  },
  {
    type: 'orderedList',
    group: 'basic',
    icon: ListOrdered,
    label: 'Numbered list',
    labelPl: 'Lista numerowana',
    description: 'Ordered numbered list',
    descriptionPl: 'Lista z numeracją',
    keywords: ['ordered', 'numbered', 'list', 'ol', 'numerowana'],
  },
  {
    type: 'taskList',
    group: 'basic',
    icon: ListChecks,
    label: 'To-do list',
    labelPl: 'Lista zadań',
    description: 'Checklist with checkboxes',
    descriptionPl: 'Checklista z polami wyboru',
    keywords: ['todo', 'task', 'check', 'checkbox', 'checklista', 'zadania'],
  },
  {
    type: 'blockquote',
    group: 'basic',
    icon: Quote,
    label: 'Quote',
    labelPl: 'Cytat',
    description: 'Blockquote / pull quote',
    descriptionPl: 'Cytat blokowy',
    keywords: ['quote', 'blockquote', 'cytat', 'cite'],
  },
  {
    type: 'codeBlock',
    group: 'basic',
    icon: Code2,
    label: 'Code',
    labelPl: 'Kod',
    description: 'Code block with highlighting',
    descriptionPl: 'Blok kodu z podświetlaniem',
    keywords: ['code', 'pre', 'snippet', 'kod', 'fence'],
  },
  {
    type: 'callout',
    group: 'basic',
    icon: Info,
    label: 'Callout',
    labelPl: 'Wyróżnienie',
    description: 'Highlighted info block',
    descriptionPl: 'Wyróżniony blok informacji',
    keywords: ['callout', 'info', 'note', 'wyroznienie', 'uwaga'],
  },
  {
    type: 'toggle',
    group: 'basic',
    icon: ToggleRight,
    label: 'Toggle',
    labelPl: 'Sekcja zwijana',
    description: 'Collapsible section',
    descriptionPl: 'Zwijana sekcja z treścią',
    keywords: ['toggle', 'collapse', 'details', 'zwijana', 'sekcja'],
  },
  {
    type: 'divider',
    group: 'basic',
    icon: Minus,
    label: 'Divider',
    labelPl: 'Separator',
    description: 'Horizontal divider line',
    descriptionPl: 'Pozioma linia oddzielająca',
    keywords: ['divider', 'hr', 'line', 'separator', 'rule', 'linia'],
  },
  // ---- Media ----------------------------------------------------------------
  {
    type: 'image',
    group: 'media',
    icon: ImageIcon,
    label: 'Image',
    labelPl: 'Obraz',
    description: 'Upload or embed an image',
    descriptionPl: 'Wgraj lub osadź obraz',
    keywords: ['image', 'img', 'photo', 'picture', 'obraz', 'zdjecie', 'grafika'],
  },
  {
    type: 'table',
    group: 'media',
    icon: Table2,
    label: 'Table',
    labelPl: 'Tabela',
    description: 'Insert a 3×3 table',
    descriptionPl: 'Wstaw tabelę 3×3',
    keywords: ['table', 'grid', 'tabela', 'rows', 'wiersze'],
  },
  // ---- AI -------------------------------------------------------------------
  {
    type: 'ai-continue',
    group: 'ai',
    icon: PenLine,
    label: 'Continue writing',
    labelPl: 'Pisz dalej',
    description: 'Let AI continue your text',
    descriptionPl: 'Pozwól AI kontynuować tekst',
    keywords: ['ai', 'continue', 'write', 'pisz', 'dalej', 'kontynuuj'],
    ai: true,
  },
  {
    type: 'ai-summarize',
    group: 'ai',
    icon: Sparkles,
    label: 'Summarize',
    labelPl: 'Podsumuj',
    description: 'AI summarizes this note',
    descriptionPl: 'AI streszcza tę notatkę',
    keywords: ['ai', 'summarize', 'summary', 'podsumuj', 'streszcz'],
    ai: true,
  },
  {
    type: 'ai-ask',
    group: 'ai',
    icon: MessageCircleQuestion,
    label: 'Ask AI',
    labelPl: 'Zapytaj AI',
    description: "Ask AI about this note's context",
    descriptionPl: 'Zapytaj AI o kontekst notatki',
    keywords: ['ai', 'ask', 'question', 'zapytaj', 'pytanie'],
    ai: true,
  },
];

const GROUP_LABELS: Record<GroupId, { en: string; pl: string }> = {
  basic: { en: 'Basic blocks', pl: 'Podstawowe' },
  media: { en: 'Media', pl: 'Media' },
  ai: { en: 'AI', pl: 'AI' },
};

const GROUP_ORDER: GroupId[] = ['basic', 'media', 'ai'];

export const NotebookSlashMenu: React.FC<NotebookSlashMenuProps> = ({
  open,
  query,
  position,
  onSelect,
  onClose,
  isPolish,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Flat, filtered list (preserves group order) used for keyboard nav. */
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (b: BlockDef) =>
      !q ||
      (isPolish ? b.labelPl : b.label).toLowerCase().includes(q) ||
      b.label.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      b.keywords.some((k) => k.includes(q));
    return GROUP_ORDER.flatMap((g) => BLOCKS.filter((b) => b.group === g && match(b)));
  }, [query, isPolish]);

  // Reset highlight whenever the result set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Keep the active row in view.
  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Keyboard-first navigation (capture phase so it wins over the editor).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (items[activeIdx]) {
          e.preventDefault();
          onSelect(items[activeIdx].type);
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, items, activeIdx, onSelect, onClose]);

  // Dismiss on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const t = (en: string, pl: string) => (isPolish ? pl : en);

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={t('Insert block', 'Wstaw blok')}
      className="fixed z-[60] w-72 max-h-80 overflow-y-auto rounded-md border border-c-border-subtle bg-c-surface py-1 text-[13px] shadow-xl dark:border-navy-700 dark:bg-navy-900"
      style={{ top: position.y, left: position.x }}
      // Prevent the editor losing focus / selection while interacting with the menu.
      onPointerDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center text-[12px] text-c-text-muted">
          {t('No blocks found', 'Brak pasujących bloków')}
        </div>
      ) : (
        GROUP_ORDER.map((groupId) => {
          const groupItems = items.filter((b) => b.group === groupId);
          if (groupItems.length === 0) return null;
          const groupLabel = GROUP_LABELS[groupId];
          return (
            <div key={groupId} className="px-1">
              <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                {t(groupLabel.en, groupLabel.pl)}
              </div>
              {groupItems.map((block) => {
                const flatIdx = items.indexOf(block);
                const isActive = flatIdx === activeIdx;
                const Icon = block.icon;
                return (
                  <button
                    key={block.type}
                    ref={(el) => {
                      itemRefs.current[flatIdx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIdx(flatIdx)}
                    onClick={() => {
                      onSelect(block.type);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                      isActive
                        ? 'bg-c-surface-raised'
                        : 'hover:bg-c-surface-raised dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                        block.ai
                          ? 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary dark:border-navy-700 dark:bg-navy-800 dark:text-c-text-secondary'
                          : 'border-c-border-subtle bg-c-surface text-c-text-muted dark:border-navy-700 dark:bg-navy-900 dark:text-c-text-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-c-text">
                        {t(block.label, block.labelPl)}
                      </span>
                      <span className="block truncate text-[11px] text-c-text-muted">
                        {t(block.description, block.descriptionPl)}
                      </span>
                    </span>
                    {block.ai && (
                      <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-c-text-muted dark:bg-navy-800 dark:text-c-text-muted">
                        AI
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
};

export default NotebookSlashMenu;

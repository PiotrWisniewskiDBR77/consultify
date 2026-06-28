import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Code,
  Columns2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  MessageCircle,
  Minus,
  Quote,
  Scale,
  ShieldQuestion,
  Sparkles,
  ToggleRight,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AICommandType } from './AIInlineResponse';

type SlashGroupId = 'basic' | 'insert' | 'ai' | 'create';

interface SlashCommand {
  id: string;
  label: string;
  labelPl: string;
  description: string;
  descriptionPl: string;
  icon: React.ReactNode;
  keywords: string[];
  action: (editor: Editor) => void;
  aiCommand?: AICommandType;
}

const SLASH_GROUP_ORDER: SlashGroupId[] = ['basic', 'insert', 'ai', 'create'];

const SLASH_GROUP_LABELS: Record<SlashGroupId, { en: string; pl: string }> = {
  basic: { en: 'Basic blocks', pl: 'Podstawowe' },
  insert: { en: 'Insert', pl: 'Wstaw' },
  ai: { en: 'AI', pl: 'AI' },
  create: { en: 'Create', pl: 'Utwórz' },
};

// Group derived from command id (keeps the 23 command objects untouched).
const SLASH_GROUP_OF: Record<string, SlashGroupId> = {
  h1: 'basic',
  h2: 'basic',
  h3: 'basic',
  bullet: 'basic',
  ordered: 'basic',
  todo: 'basic',
  quote: 'basic',
  callout: 'basic',
  warning: 'basic',
  toggle: 'basic',
  divider: 'basic',
  code: 'basic',
  image: 'insert',
  date: 'insert',
  columns: 'insert',
  table: 'insert',
  'ai-ask': 'ai',
  'ai-expand': 'ai',
  'ai-challenge': 'ai',
  'ai-action': 'ai',
  'create-task': 'create',
  'create-decision': 'create',
  'save-as-idea': 'create',
};
const slashGroupOf = (id: string): SlashGroupId => SLASH_GROUP_OF[id] ?? 'basic';

const ICON_SIZE = 16;

const COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Heading 1',
    labelPl: 'Nagłówek 1',
    description: 'Large section heading',
    descriptionPl: 'Duży nagłówek sekcji',
    icon: <Heading1 size={ICON_SIZE} />,
    keywords: ['h1', 'heading', 'title', 'naglowek'],
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    labelPl: 'Nagłówek 2',
    description: 'Medium section heading',
    descriptionPl: 'Średni nagłówek sekcji',
    icon: <Heading2 size={ICON_SIZE} />,
    keywords: ['h2', 'heading', 'subtitle', 'naglowek'],
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    labelPl: 'Nagłówek 3',
    description: 'Small section heading',
    descriptionPl: 'Mały nagłówek sekcji',
    icon: <Heading3 size={ICON_SIZE} />,
    keywords: ['h3', 'heading', 'naglowek'],
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    labelPl: 'Lista punktowana',
    description: 'Unordered bullet list',
    descriptionPl: 'Lista z punktorami',
    icon: <List size={ICON_SIZE} />,
    keywords: ['bullet', 'list', 'ul', 'unordered', 'lista'],
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Numbered List',
    labelPl: 'Lista numerowana',
    description: 'Ordered numbered list',
    descriptionPl: 'Lista z numeracją',
    icon: <ListOrdered size={ICON_SIZE} />,
    keywords: ['ordered', 'numbered', 'list', 'ol', 'numerowana'],
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'todo',
    label: 'Todo List',
    labelPl: 'Checklista',
    description: 'Checklist with checkboxes',
    descriptionPl: 'Lista z checkboxami',
    icon: <ListChecks size={ICON_SIZE} />,
    keywords: ['todo', 'task', 'check', 'checkbox', 'checklista'],
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'image',
    label: 'Image',
    labelPl: 'Obraz',
    description: 'Upload or embed an image',
    descriptionPl: 'Wgraj lub osadź obraz',
    icon: <ImageIcon size={ICON_SIZE} />,
    keywords: ['image', 'img', 'photo', 'picture', 'obraz', 'zdjecie', 'grafika'],
    action: () => {
      window.dispatchEvent(new CustomEvent('notebook-insert-image'));
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    labelPl: 'Cytat',
    description: 'Blockquote / pull quote',
    descriptionPl: 'Cytat blokowy',
    icon: <Quote size={ICON_SIZE} />,
    keywords: ['quote', 'blockquote', 'cytat', 'cite'],
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'date',
    label: 'Date',
    labelPl: 'Data',
    description: "Insert today's date",
    descriptionPl: 'Wstaw dzisiejszą datę',
    icon: <CalendarDays size={ICON_SIZE} />,
    keywords: ['date', 'today', 'data', 'dzisiaj', 'now'],
    action: (e) => {
      const locale =
        typeof document !== 'undefined' && document.documentElement.lang === 'pl' ? 'pl-PL' : 'en-US';
      const formatted = new Date().toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      e.chain().focus().insertContent(formatted).run();
    },
  },
  {
    id: 'columns',
    label: '2 Columns',
    labelPl: '2 kolumny',
    description: 'Two-column layout',
    descriptionPl: 'Układ dwukolumnowy',
    icon: <Columns2 size={ICON_SIZE} />,
    keywords: ['columns', 'column', 'kolumny', 'kolumna', '2', 'split', 'grid'],
    action: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 1, cols: 2, withHeaderRow: false })
        .run(),
  },
  {
    id: 'callout',
    label: 'Callout',
    labelPl: 'Wyróżnienie',
    description: 'Highlighted info block',
    descriptionPl: 'Wyróżniony blok informacji',
    icon: <Info size={ICON_SIZE} />,
    keywords: ['callout', 'info', 'note', 'wyroznienie', 'uwaga'],
    action: (e) => (e.commands as any).setCallout({ variant: 'info' }),
  },
  {
    id: 'warning',
    label: 'Warning',
    labelPl: 'Ostrzeżenie',
    description: 'Warning callout block',
    descriptionPl: 'Blok ostrzeżenia',
    icon: <AlertTriangle size={ICON_SIZE} />,
    keywords: ['warning', 'alert', 'caution', 'ostrzezenie'],
    action: (e) => (e.commands as any).setCallout({ variant: 'warning' }),
  },
  {
    id: 'toggle',
    label: 'Toggle',
    labelPl: 'Sekcja zwijana',
    description: 'Collapsible section',
    descriptionPl: 'Zwijana sekcja z treścią',
    icon: <ToggleRight size={ICON_SIZE} />,
    keywords: ['toggle', 'collapse', 'details', 'zwijana', 'sekcja'],
    action: (e) => (e.commands as any).setDetails(),
  },
  {
    id: 'divider',
    label: 'Divider',
    labelPl: 'Separator',
    description: 'Horizontal divider line',
    descriptionPl: 'Pozioma linia separatora',
    icon: <Minus size={ICON_SIZE} />,
    keywords: ['divider', 'hr', 'line', 'separator'],
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'table',
    label: 'Table',
    labelPl: 'Tabela',
    description: 'Insert a simple table',
    descriptionPl: 'Wstaw prostą tabelę',
    icon: <Columns3 size={ICON_SIZE} />,
    keywords: ['table', 'grid', 'tabela'],
    action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'code',
    label: 'Code Block',
    labelPl: 'Blok kodu',
    description: 'Formatted code block',
    descriptionPl: 'Sformatowany blok kodu',
    icon: <Code size={ICON_SIZE} />,
    keywords: ['code', 'pre', 'snippet', 'kod'],
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'ai-ask',
    label: 'AI: Ask',
    labelPl: 'AI: Zapytaj',
    description: "Ask AI about your note's context",
    descriptionPl: 'Zapytaj AI o kontekst notatki',
    icon: <MessageCircle size={ICON_SIZE} className="text-slate-500" />,
    keywords: ['ask', 'ai', 'question', 'pytanie', 'zapytaj'],
    action: () => {},
    aiCommand: 'ask',
  },
  {
    id: 'ai-expand',
    label: 'AI: Expand',
    labelPl: 'AI: Rozwiń',
    description: 'AI expands and elaborates on your content',
    descriptionPl: 'AI rozwija i wzbogaca Twoją treść',
    icon: <Sparkles size={ICON_SIZE} className="text-slate-500" />,
    keywords: ['expand', 'ai', 'elaborate', 'rozwin', 'wzbogac'],
    action: () => {},
    aiCommand: 'expand',
  },
  {
    id: 'ai-challenge',
    label: 'AI: Challenge',
    labelPl: 'AI: Podważ',
    description: 'AI asks critical questions about your content',
    descriptionPl: 'AI zadaje krytyczne pytania o Twoją treść',
    icon: <ShieldQuestion size={ICON_SIZE} className="text-slate-500" />,
    keywords: ['challenge', 'ai', 'critical', 'question', 'podwaz', 'krytyczne'],
    action: () => {},
    aiCommand: 'challenge',
  },
  {
    id: 'ai-action',
    label: 'AI: Next Steps',
    labelPl: 'AI: Następne kroki',
    description: 'AI proposes concrete next steps',
    descriptionPl: 'AI proponuje konkretne następne kroki',
    icon: <Zap size={ICON_SIZE} className="text-slate-500" />,
    keywords: ['action', 'ai', 'next', 'steps', 'kroki', 'plan'],
    action: () => {},
    aiCommand: 'action',
  },
  // -- Create entity commands --
  {
    id: 'create-task',
    label: 'Create Task',
    labelPl: 'Utwórz zadanie',
    description: 'Create a task from the current context',
    descriptionPl: 'Utwórz zadanie z bieżącego kontekstu',
    icon: <CheckSquare size={ICON_SIZE} className="text-emerald-500" />,
    keywords: ['task', 'todo', 'zadanie', 'create', 'utworz'],
    action: (editor) => {
      const sel = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(sel.from, sel.to, ' ');
      window.dispatchEvent(
        new CustomEvent('notebook-create-task', { detail: { text: selectedText } })
      );
    },
  },
  {
    id: 'create-decision',
    label: 'Create Decision',
    labelPl: 'Utwórz decyzję',
    description: 'Create a decision from the current context',
    descriptionPl: 'Utwórz decyzję z bieżącego kontekstu',
    icon: <Scale size={ICON_SIZE} className="text-amber-500" />,
    keywords: ['decision', 'decyzja', 'decide', 'decide'],
    action: (editor) => {
      const sel = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(sel.from, sel.to, ' ');
      window.dispatchEvent(
        new CustomEvent('notebook-create-decision', { detail: { text: selectedText } })
      );
    },
  },
  {
    id: 'save-as-idea',
    label: 'Save as Idea',
    labelPl: 'Zapisz jako pomysł',
    description: 'Save selected text as a new idea',
    descriptionPl: 'Zapisz zaznaczony tekst jako nowy pomysł',
    icon: <Lightbulb size={ICON_SIZE} className="text-yellow-500" />,
    keywords: ['idea', 'pomysl', 'save', 'zapisz'],
    action: (editor) => {
      const sel = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(sel.from, sel.to, ' ');
      window.dispatchEvent(
        new CustomEvent('notebook-create-idea', { detail: { text: selectedText } })
      );
    },
  },
];

export interface SlashMenuState {
  open: boolean;
  query: string;
  triggerPos: number;
  coords: { top: number; left: number };
}

export const INITIAL_SLASH_STATE: SlashMenuState = {
  open: false,
  query: '',
  triggerPos: 0,
  coords: { top: 0, left: 0 },
};

/**
 * Detect slash trigger in the editor text before cursor.
 * Returns the slash menu state or null if no slash trigger found.
 */
export function detectSlashTrigger(editor: Editor): SlashMenuState | null {
  const { $from } = editor.state.selection;
  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
  const match = textBefore.match(/\/([a-zA-Z0-9]*)$/);

  if (!match) return null;

  const from = $from.pos - match[0].length;
  try {
    const coords = editor.view.coordsAtPos(from);
    return {
      open: true,
      query: match[1],
      triggerPos: from,
      coords: { top: coords.bottom + 4, left: coords.left },
    };
  } catch {
    return null;
  }
}

interface SlashMenuProps {
  editor: Editor;
  state: SlashMenuState;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAICommand?: (command: AICommandType) => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  editor,
  state,
  onClose,
  containerRef,
  onAICommand,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [selectedIdx, setSelectedIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    const q = state.query.toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.id.includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
    );
  }, [state.query]);

  // Keyboard nav must follow the VISUAL (grouped) order, not the flat COMMANDS
  // order — otherwise the highlight jumps between groups because COMMANDS
  // interleaves insert/ai/create items among the basic ones.
  const orderedItems = useMemo(
    () => SLASH_GROUP_ORDER.flatMap((g) => filteredItems.filter((c) => slashGroupOf(c.id) === g)),
    [filteredItems]
  );

  useEffect(() => {
    setSelectedIdx(0);
  }, [state.query]);

  const executeCommand = useCallback(
    (cmd: SlashCommand) => {
      const { from } = editor.state.selection;
      const deleteFrom = state.triggerPos;
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();

      if (cmd.aiCommand && onAICommand) {
        onAICommand(cmd.aiCommand);
      } else {
        cmd.action(editor);
      }
      onClose();
    },
    [editor, state.triggerPos, onClose, onAICommand]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % Math.max(orderedItems.length, 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + orderedItems.length) % Math.max(orderedItems.length, 1));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (orderedItems[selectedIdx]) {
          executeCommand(orderedItems[selectedIdx]);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [state.open, orderedItems, selectedIdx, executeCommand, onClose]);

  if (!state.open || filteredItems.length === 0) return null;

  const containerRect = containerRef.current?.getBoundingClientRect();
  const top = state.coords.top - (containerRect?.top ?? 0);
  const left = state.coords.left - (containerRect?.left ?? 0);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-lg py-1"
      style={{ top, left }}
    >
      {SLASH_GROUP_ORDER.map((groupId) => {
        const groupItems = filteredItems.filter((c) => slashGroupOf(c.id) === groupId);
        if (groupItems.length === 0) return null;
        const groupLabel = SLASH_GROUP_LABELS[groupId];
        return (
          <div key={groupId} className="px-1">
            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              {isPolish ? groupLabel.pl : groupLabel.en}
            </div>
            {groupItems.map((cmd) => {
              const idx = orderedItems.indexOf(cmd);
              const isActive = idx === selectedIdx;
              return (
                <button
                  key={cmd.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    executeCommand(cmd);
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-navy-800'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                      cmd.aiCommand
                        ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-300'
                        : 'border-slate-200 bg-white text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400'
                    }`}
                  >
                    {cmd.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[13px] text-slate-700 dark:text-slate-200">
                      {isPolish ? cmd.labelPl : cmd.label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {isPolish ? cmd.descriptionPl : cmd.description}
                    </span>
                  </span>
                  {cmd.aiCommand ? (
                    <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-500 dark:bg-navy-800 dark:text-slate-400">
                      AI
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

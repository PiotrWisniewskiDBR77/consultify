import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare,
  Code,
  Columns2,
  Columns3,
  Copy,
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
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AICommandType } from './AIInlineResponse';

type SlashGroupId = 'block' | 'basic' | 'insert' | 'ai' | 'create';

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
  contextOnly?: boolean;
  canRun?: (editor: Editor) => boolean;
  visibleWhen?: (editor: Editor) => boolean;
}

const SLASH_GROUP_ORDER: SlashGroupId[] = ['block', 'basic', 'insert', 'ai', 'create'];

const SLASH_GROUP_LABELS: Record<SlashGroupId, { en: string; pl: string }> = {
  block: { en: 'Current block', pl: 'Bieżący blok' },
  basic: { en: 'Basic blocks', pl: 'Podstawowe' },
  insert: { en: 'Insert', pl: 'Wstaw' },
  ai: { en: 'AI', pl: 'AI' },
  create: { en: 'Create', pl: 'Utwórz' },
};

// Group derived from command id (keeps the 23 command objects untouched).
const SLASH_GROUP_OF: Record<string, SlashGroupId> = {
  'block-duplicate': 'block',
  'block-move-up': 'block',
  'block-move-down': 'block',
  'block-delete': 'block',
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

function selectedTopLevelBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  if ($from.depth < 1) {
    const node = $from.nodeAfter;
    if (!node) return null;
    return {
      node,
      pos: $from.pos,
      index: $from.index(0),
      siblingCount: editor.state.doc.childCount,
    };
  }
  return {
    node: $from.node(1),
    pos: $from.before(1),
    index: $from.index(0),
    siblingCount: editor.state.doc.childCount,
  };
}

export function duplicateSelectedNotebookBlock(editor: Editor): boolean {
  const block = selectedTopLevelBlock(editor);
  if (!block) return false;
  editor.view.dispatch(editor.state.tr.insert(block.pos + block.node.nodeSize, block.node));
  editor.commands.focus();
  return true;
}

export function deleteSelectedNotebookBlock(editor: Editor): boolean {
  const block = selectedTopLevelBlock(editor);
  if (!block) return false;
  editor.view.dispatch(editor.state.tr.delete(block.pos, block.pos + block.node.nodeSize));
  editor.commands.focus();
  return true;
}

export function moveSelectedNotebookBlock(editor: Editor, direction: 'up' | 'down'): boolean {
  const block = selectedTopLevelBlock(editor);
  if (!block) return false;
  if (direction === 'up') {
    if (block.index <= 0) return false;
    const previous = editor.state.doc.child(block.index - 1);
    const targetPos = block.pos - previous.nodeSize;
    const transaction = editor.state.tr
      .delete(block.pos, block.pos + block.node.nodeSize)
      .insert(targetPos, block.node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(targetPos + 1)));
    editor.view.dispatch(transaction);
  } else {
    if (block.index >= block.siblingCount - 1) return false;
    const next = editor.state.doc.child(block.index + 1);
    const targetPos = block.pos + next.nodeSize;
    const transaction = editor.state.tr
      .delete(block.pos, block.pos + block.node.nodeSize)
      .insert(targetPos, block.node);
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(targetPos + 1)));
    editor.view.dispatch(transaction);
  }
  editor.commands.focus();
  return true;
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'block-duplicate',
    label: 'Duplicate block',
    labelPl: 'Duplikuj blok',
    description: 'Create an editable copy below',
    descriptionPl: 'Utwórz edytowalną kopię poniżej',
    icon: <Copy size={ICON_SIZE} />,
    keywords: ['duplicate', 'copy', 'duplikuj', 'kopiuj'],
    action: duplicateSelectedNotebookBlock,
    contextOnly: true,
    canRun: (editor) => selectedTopLevelBlock(editor) !== null,
  },
  {
    id: 'block-move-up',
    label: 'Move block up',
    labelPl: 'Przenieś blok wyżej',
    description: 'Move before the previous block',
    descriptionPl: 'Przenieś przed poprzedni blok',
    icon: <ArrowUp size={ICON_SIZE} />,
    keywords: ['move', 'up', 'przenies', 'wyzej'],
    action: (editor) => void moveSelectedNotebookBlock(editor, 'up'),
    contextOnly: true,
    canRun: (editor) => (selectedTopLevelBlock(editor)?.index ?? 0) > 0,
  },
  {
    id: 'block-move-down',
    label: 'Move block down',
    labelPl: 'Przenieś blok niżej',
    description: 'Move after the next block',
    descriptionPl: 'Przenieś za następny blok',
    icon: <ArrowDown size={ICON_SIZE} />,
    keywords: ['move', 'down', 'przenies', 'nizej'],
    action: (editor) => void moveSelectedNotebookBlock(editor, 'down'),
    contextOnly: true,
    canRun: (editor) => {
      const block = selectedTopLevelBlock(editor);
      return !!block && block.index < block.siblingCount - 1;
    },
  },
  {
    id: 'block-delete',
    label: 'Delete block',
    labelPl: 'Usuń blok',
    description: 'Remove this block; Undo remains available',
    descriptionPl: 'Usuń ten blok; Cofnij pozostaje dostępne',
    icon: <Trash2 size={ICON_SIZE} />,
    keywords: ['delete', 'remove', 'usun'],
    action: deleteSelectedNotebookBlock,
    contextOnly: true,
    canRun: (editor) => selectedTopLevelBlock(editor) !== null,
  },
  {
    id: 'block-callout-info',
    label: 'Callout: Info',
    labelPl: 'Wyróżnienie: Informacja',
    description: 'Set a neutral information meaning',
    descriptionPl: 'Ustaw neutralne znaczenie informacyjne',
    icon: <Info size={ICON_SIZE} />,
    keywords: ['callout', 'info', 'variant'],
    action: (editor) =>
      editor.chain().focus().updateAttributes('callout', { variant: 'info' }).run(),
    contextOnly: true,
    visibleWhen: (editor) => selectedTopLevelBlock(editor)?.node.type.name === 'callout',
  },
  {
    id: 'block-callout-warning',
    label: 'Callout: Warning',
    labelPl: 'Wyróżnienie: Ostrzeżenie',
    description: 'Mark the block as a warning',
    descriptionPl: 'Oznacz blok jako ostrzeżenie',
    icon: <AlertTriangle size={ICON_SIZE} />,
    keywords: ['callout', 'warning', 'variant'],
    action: (editor) =>
      editor.chain().focus().updateAttributes('callout', { variant: 'warning' }).run(),
    contextOnly: true,
    visibleWhen: (editor) => selectedTopLevelBlock(editor)?.node.type.name === 'callout',
  },
  {
    id: 'block-callout-success',
    label: 'Callout: Success',
    labelPl: 'Wyróżnienie: Sukces',
    description: 'Mark a positive confirmed outcome',
    descriptionPl: 'Oznacz pozytywny potwierdzony wynik',
    icon: <CheckSquare size={ICON_SIZE} />,
    keywords: ['callout', 'success', 'variant'],
    action: (editor) =>
      editor.chain().focus().updateAttributes('callout', { variant: 'success' }).run(),
    contextOnly: true,
    visibleWhen: (editor) => selectedTopLevelBlock(editor)?.node.type.name === 'callout',
  },
  {
    id: 'block-callout-critical',
    label: 'Callout: Critical',
    labelPl: 'Wyróżnienie: Krytyczne',
    description: 'Mark a critical issue',
    descriptionPl: 'Oznacz problem krytyczny',
    icon: <Zap size={ICON_SIZE} />,
    keywords: ['callout', 'critical', 'variant'],
    action: (editor) =>
      editor.chain().focus().updateAttributes('callout', { variant: 'critical' }).run(),
    contextOnly: true,
    visibleWhen: (editor) => selectedTopLevelBlock(editor)?.node.type.name === 'callout',
  },
  {
    id: 'block-toggle-open',
    label: 'Toggle: Expanded',
    labelPl: 'Sekcja: Rozwinięta',
    description: 'Show its content by default',
    descriptionPl: 'Domyślnie pokaż zawartość',
    icon: <ToggleRight size={ICON_SIZE} />,
    keywords: ['toggle', 'open', 'expanded'],
    action: (editor) => editor.chain().focus().updateAttributes('details', { open: true }).run(),
    contextOnly: true,
    visibleWhen: (editor) => selectedTopLevelBlock(editor)?.node.type.name === 'details',
  },
  {
    id: 'block-toggle-closed',
    label: 'Toggle: Collapsed',
    labelPl: 'Sekcja: Zwinięta',
    description: 'Hide its content by default',
    descriptionPl: 'Domyślnie ukryj zawartość',
    icon: <ToggleRight size={ICON_SIZE} />,
    keywords: ['toggle', 'closed', 'collapsed'],
    action: (editor) => editor.chain().focus().updateAttributes('details', { open: false }).run(),
    contextOnly: true,
    visibleWhen: (editor) => selectedTopLevelBlock(editor)?.node.type.name === 'details',
  },
  {
    id: 'block-table-row',
    label: 'Table: Add row below',
    labelPl: 'Tabela: Dodaj wiersz poniżej',
    description: 'Extend the current table',
    descriptionPl: 'Rozszerz bieżącą tabelę',
    icon: <Columns2 size={ICON_SIZE} />,
    keywords: ['table', 'row', 'wiersz'],
    action: (editor) => editor.chain().focus().addRowAfter().run(),
    contextOnly: true,
    visibleWhen: (editor) => editor.isActive('table'),
  },
  {
    id: 'block-table-column',
    label: 'Table: Add column right',
    labelPl: 'Tabela: Dodaj kolumnę z prawej',
    description: 'Extend the current table',
    descriptionPl: 'Rozszerz bieżącą tabelę',
    icon: <Columns3 size={ICON_SIZE} />,
    keywords: ['table', 'column', 'kolumna'],
    action: (editor) => editor.chain().focus().addColumnAfter().run(),
    contextOnly: true,
    visibleWhen: (editor) => editor.isActive('table'),
  },
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
        typeof document !== 'undefined' && document.documentElement.lang === 'pl'
          ? 'pl-PL'
          : 'en-US';
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
    action: (e) => e.chain().focus().insertTable({ rows: 1, cols: 2, withHeaderRow: false }).run(),
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
    icon: <MessageCircle size={ICON_SIZE} className="text-c-text-muted" />,
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
    icon: <Sparkles size={ICON_SIZE} className="text-c-text-muted" />,
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
    icon: <ShieldQuestion size={ICON_SIZE} className="text-c-text-muted" />,
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
    icon: <Zap size={ICON_SIZE} className="text-c-text-muted" />,
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
    icon: <CheckSquare size={ICON_SIZE} className="text-c-success" />,
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
    icon: <Scale size={ICON_SIZE} className="text-c-warning" />,
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
    icon: <Lightbulb size={ICON_SIZE} className="text-c-warning" />,
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
  mode: 'insert' | 'context';
}

export const INITIAL_SLASH_STATE: SlashMenuState = {
  open: false,
  query: '',
  triggerPos: 0,
  coords: { top: 0, left: 0 },
  mode: 'insert',
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
      mode: 'insert',
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
  receiptCapableActionIds?: string[];
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  editor,
  state,
  onClose,
  containerRef,
  onAICommand,
  receiptCapableActionIds,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [selectedIdx, setSelectedIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    const q = state.query.toLowerCase();
    const available = COMMANDS.filter(
      (command) =>
        (state.mode === 'context' || !command.contextOnly) &&
        (!command.visibleWhen || command.visibleWhen(editor))
    );
    if (!q) return available;
    return available.filter(
      (c) =>
        c.id.includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.includes(q))
    );
  }, [editor, state.mode, state.query]);

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
      if (
        ['create-task', 'create-decision', 'save-as-idea'].includes(cmd.id) &&
        !(receiptCapableActionIds || []).includes(cmd.id)
      ) {
        return;
      }
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
    [editor, state.triggerPos, onClose, onAICommand, receiptCapableActionIds]
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
        setSelectedIdx(
          (prev) => (prev - 1 + orderedItems.length) % Math.max(orderedItems.length, 1)
        );
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
      role="menu"
      aria-label={isPolish ? 'Polecenia notatnika' : 'Notebook commands'}
      className="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-lg py-1"
      style={{ top, left }}
    >
      {SLASH_GROUP_ORDER.map((groupId) => {
        const groupItems = filteredItems.filter((c) => slashGroupOf(c.id) === groupId);
        if (groupItems.length === 0) return null;
        const groupLabel = SLASH_GROUP_LABELS[groupId];
        return (
          <div key={groupId} className="px-1">
            <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
              {isPolish ? groupLabel.pl : groupLabel.en}
            </div>
            {groupItems.map((cmd) => {
              const idx = orderedItems.indexOf(cmd);
              const isActive = idx === selectedIdx;
              const governedUnavailable =
                ['create-task', 'create-decision', 'save-as-idea'].includes(cmd.id) &&
                !(receiptCapableActionIds || []).includes(cmd.id);
              const editorUnavailable = cmd.canRun ? !cmd.canRun(editor) : false;
              const unavailable = governedUnavailable || editorUnavailable;
              const reasonId = `notebook-slash-${cmd.id}-reason`;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  role="menuitem"
                  data-notebook-action-id={`block:${cmd.id}`}
                  aria-disabled={unavailable || undefined}
                  aria-describedby={unavailable ? reasonId : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (unavailable) return;
                    executeCommand(cmd);
                  }}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isActive ? 'bg-c-surface-raised' : 'hover:bg-c-surface-raised'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                      cmd.aiCommand
                        ? 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary'
                        : 'border-c-border-subtle bg-c-surface text-c-text-muted'
                    }`}
                  >
                    {cmd.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[13px] text-c-text">
                      {isPolish ? cmd.labelPl : cmd.label}
                    </span>
                    <span
                      id={unavailable ? reasonId : undefined}
                      className="block text-[11px] text-c-text-muted"
                    >
                      {governedUnavailable
                        ? isPolish
                          ? 'Niedostępne, dopóki serwer nie zwróci trwałego potwierdzenia'
                          : 'Unavailable until the server can return a durable action receipt'
                        : isPolish
                          ? cmd.descriptionPl
                          : cmd.description}
                    </span>
                  </span>
                  {cmd.aiCommand ? (
                    <span className="ml-auto shrink-0 rounded bg-c-surface-raised px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-c-text-muted">
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

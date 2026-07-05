/**
 * InsertMenu — dropdown z przyciskami do wstawiania elementów (bloki, AI, nagłówki).
 */
import type { Editor } from '@tiptap/react';
import {
  AlertTriangle,
  ChevronDown,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Info,
  List,
  ListChecks,
  ListOrdered,
  MessageSquare,
  Minus,
  Plus,
  Sparkles,
  ToggleRight,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const DELETABLE_BLOCKS = ['callout', 'details', 'table', 'blockquote', 'horizontalRule'];

function deleteContainingBlock(editor: Editor): boolean {
  const { state } = editor;
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (DELETABLE_BLOCKS.includes(node.type.name)) {
      const pos = $from.before(d);
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .run();
      return true;
    }
  }
  return false;
}

interface InsertMenuProps {
  editor: Editor;
  onFocusAICommand?: () => void;
  onOpenAIChat?: () => void;
  className?: string;
}

export const InsertMenu: React.FC<InsertMenuProps> = ({
  editor,
  onFocusAICommand,
  onOpenAIChat,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    if (open) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const btn = (label: string, labelPl: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      key={label}
      onClick={() => {
        onClick();
        setOpen(false);
      }}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-c-text hover:bg-c-surface-raised transition-colors text-left"
    >
      {icon}
      <span>{pl ? labelPl : label}</span>
    </button>
  );

  return (
    <div ref={ref} className={`relative ${className}`} data-insert-menu>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text transition-colors text-sm font-medium"
      >
        <Plus size={14} />
        <span>{pl ? 'Wstaw' : 'Insert'}</span>
        <ChevronDown size={12} className="opacity-70" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-xl border border-c-border bg-c-surface shadow-lg overflow-hidden">
          <div className="p-3 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted px-1">
              {pl ? 'Bloki' : 'Blocks'}
            </div>
            <div className="space-y-0.5">
              {btn(
                'Delete block',
                'Usuń blok',
                () => deleteContainingBlock(editor),
                <Trash2 size={14} className="text-c-danger" />
              )}
              {btn(
                'Callout',
                'Wyróżnienie',
                () => (editor.commands as any).setCallout({ variant: 'info' }),
                <Info size={14} className="text-c-info" />
              )}
              {btn(
                'Warning',
                'Ostrzeżenie',
                () => (editor.commands as any).setCallout({ variant: 'warning' }),
                <AlertTriangle size={14} className="text-c-warning" />
              )}
              {btn(
                'Toggle',
                'Sekcja zwijana',
                () => (editor.commands as any).setDetails(),
                <ToggleRight size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Table',
                'Tabela',
                () =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run(),
                <Columns3 size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Divider',
                'Separator',
                () => editor.chain().focus().setHorizontalRule().run(),
                <Minus size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Bullet list',
                'Lista punktowana',
                () => editor.chain().focus().toggleBulletList().run(),
                <List size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Numbered list',
                'Lista numerowana',
                () => editor.chain().focus().toggleOrderedList().run(),
                <ListOrdered size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Checklist',
                'Checklista',
                () => editor.chain().focus().toggleTaskList().run(),
                <ListChecks size={14} className="text-c-text-muted" />
              )}
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted px-1 pt-2">
              {pl ? 'Nagłówki' : 'Headings'}
            </div>
            <div className="space-y-0.5">
              {btn(
                'Heading 1',
                'Nagłówek 1',
                () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
                <Heading1 size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Heading 2',
                'Nagłówek 2',
                () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
                <Heading2 size={14} className="text-c-text-muted" />
              )}
              {btn(
                'Heading 3',
                'Nagłówek 3',
                () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
                <Heading3 size={14} className="text-c-text-muted" />
              )}
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-wide text-primary-500 px-1 pt-2">
              AI
            </div>
            <div className="space-y-0.5">
              {onFocusAICommand &&
                btn(
                  'AI command',
                  'Polecenie AI',
                  onFocusAICommand,
                  <Sparkles size={14} className="text-primary-500" />
                )}
              {onOpenAIChat &&
                btn(
                  'AI Chat',
                  'Czat AI',
                  onOpenAIChat,
                  <MessageSquare size={14} className="text-primary-500" />
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

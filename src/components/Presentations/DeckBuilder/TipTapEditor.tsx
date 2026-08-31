/**
 * TipTapEditor — inline rich-text editor for presentation blocks.
 * Supports bold, italic, lists, headings, links, text-align, highlight.
 * Custom floating toolbar on text selection (no BubbleMenu dependency).
 */

import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Strikethrough,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  headingLevel?: 1 | 2 | 3 | 4;
  isHeading?: boolean;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  onBlur,
  className = '',
  placeholder = 'Start typing...',
  headingLevel,
  isHeading = false,
}) => {
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-c-accent underline' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: formatInitialContent(content, isHeading, headingLevel),
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    onBlur: () => {
      setTimeout(() => setShowToolbar(false), 200);
      onBlur?.();
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      if (from !== to) {
        updateToolbarPosition();
        setShowToolbar(true);
      } else {
        setShowToolbar(false);
      }
    },
    editorProps: {
      attributes: {
        class: `outline-none ${className}`,
      },
    },
  });

  const updateToolbarPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !containerRef.current) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setToolbarPos({
      top: rect.top - containerRect.top - 40,
      left: rect.left - containerRect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (editor && !editor.isFocused) {
      const newContent = formatInitialContent(content, isHeading, headingLevel);
      if (editor.getHTML() !== newContent) {
        editor.commands.setContent(newContent);
      }
    }
  }, [content, editor, isHeading, headingLevel]);

  if (!editor) return null;

  return (
    <div ref={containerRef} className="relative">
      {/* Custom floating toolbar */}
      {showToolbar && (
        <div
          className="absolute flex items-center gap-0.5 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-xl px-1 py-0.5 z-30"
          style={{ top: toolbarPos.top, left: toolbarPos.left, transform: 'translateX(-50%)' }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <ToolbarBtn
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Pogrubienie"
          >
            <Bold size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Kursywa"
          >
            <Italic size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Przekreślenie"
          >
            <Strikethrough size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="Wyróżnienie"
          >
            <Highlighter size={14} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-c-border-subtle mx-0.5" />
          <ToolbarBtn
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Lista punktowana"
          >
            <List size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Lista numerowana"
          >
            <ListOrdered size={14} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-c-border-subtle mx-0.5" />
          <ToolbarBtn
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Wyrównaj do lewej"
          >
            <AlignLeft size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Wyrównaj do środka"
          >
            <AlignCenter size={14} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Wyrównaj do prawej"
          >
            <AlignRight size={14} />
          </ToolbarBtn>
          <div className="w-px h-4 bg-c-border-subtle mx-0.5" />
          <ToolbarBtn
            active={editor.isActive('link')}
            onClick={() => {
              const url = window.prompt('URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            title="Odnośnik"
          >
            <LinkIcon size={14} />
          </ToolbarBtn>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
};

const ToolbarBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? 'bg-c-accent-soft0 text-c-accent'
        : 'text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text'
    }`}
  >
    {children}
  </button>
);

function formatInitialContent(content: string, isHeading: boolean, headingLevel?: number): string {
  if (!content) return '';
  if (content.startsWith('<')) return content;
  if (isHeading && headingLevel) {
    return `<h${headingLevel}>${content}</h${headingLevel}>`;
  }
  return `<p>${content}</p>`;
}

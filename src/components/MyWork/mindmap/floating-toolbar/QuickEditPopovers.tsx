/**
 * QuickEditPopovers — Lightweight popovers for quick notes, tags, and link edits
 * without opening the full NodeDetailDrawer.
 */
import { Hash, Link2, Plus, StickyNote, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/* ─── Quick Notes ─────────────────────────────────────────────────────────── */

interface QuickNotesPopoverProps {
  isPl: boolean;
  nodeId: string;
  currentNotes: string;
  onSave: (nodeId: string, notes: string) => void;
  onClose: () => void;
}

export const QuickNotesPopover: React.FC<QuickNotesPopoverProps> = ({
  nodeId,
  currentNotes,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentNotes || '');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    onSave(nodeId, value);
    onClose();
  }, [nodeId, value, onSave, onClose]);

  return (
    <div className="w-64 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-c-text-secondary dark:text-c-text-muted">
          <StickyNote size={12} />
          {t('ideas.mindmap.notes', 'Notes')}
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
        >
          <X size={12} className="text-c-text-secondary" />
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('ideas.mindmap.addNote', 'Add a note…')}
        className="w-full h-20 text-xs bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-c-border"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
        }}
      />
      <button
        onClick={handleSave}
        className="mt-2 w-full py-1.5 rounded-lg bg-c-surface text-c-text dark:bg-c-surface-raised dark:text-c-text dark:hover:bg-c-surface-raised text-xs font-medium hover:bg-c-surface transition-colors"
      >
        {t('ideas.mindmap.save', 'Save')}
      </button>
    </div>
  );
};

/* ─── Quick Tags ──────────────────────────────────────────────────────────── */

interface QuickTagsPopoverProps {
  isPl: boolean;
  nodeId: string;
  currentTags: string[];
  onSave: (nodeId: string, tags: string[]) => void;
  onClose: () => void;
}

export const QuickTagsPopover: React.FC<QuickTagsPopoverProps> = ({
  nodeId,
  currentTags,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<string[]>(currentTags || []);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const next = [...tags, trimmed];
      setTags(next);
      onSave(nodeId, next);
    }
    setInput('');
  }, [input, tags, nodeId, onSave]);

  const removeTag = useCallback(
    (tag: string) => {
      const next = tags.filter((t) => t !== tag);
      setTags(next);
      onSave(nodeId, next);
    },
    [tags, nodeId, onSave]
  );

  return (
    <div className="w-64 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-c-text-secondary dark:text-c-text-muted">
          <Hash size={12} />
          {t('ideas.mindmap.tags', 'Tags')}
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
        >
          <X size={12} className="text-c-text-secondary" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-c-surface dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-c-danger">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={t('ideas.mindmap.newTag', 'New tag…')}
          className="flex-1 h-7 px-2 text-xs bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle rounded-lg focus:outline-none focus:ring-1 focus:ring-c-border"
        />
        <button
          onClick={addTag}
          className="h-7 w-7 flex items-center justify-center rounded-lg bg-c-surface text-c-text dark:bg-c-surface-raised dark:text-c-text dark:hover:bg-c-surface-raised hover:bg-c-surface transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
};

/* ─── Quick Link ──────────────────────────────────────────────────────────── */

interface QuickLinkPopoverProps {
  isPl: boolean;
  nodeId: string;
  currentLink: string;
  onSave: (nodeId: string, link: string) => void;
  onClose: () => void;
}

export const QuickLinkPopover: React.FC<QuickLinkPopoverProps> = ({
  nodeId,
  currentLink,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentLink || '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleSave = useCallback(() => {
    onSave(nodeId, value.trim());
    onClose();
  }, [nodeId, value, onSave, onClose]);

  return (
    <div className="w-64 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-c-text-secondary dark:text-c-text-muted">
          <Link2 size={12} />
          {t('ideas.mindmap.link', 'Link')}
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
        >
          <X size={12} className="text-c-text-secondary" />
        </button>
      </div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…"
        className="w-full h-8 text-xs bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-c-border"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
        }}
      />
      <button
        onClick={handleSave}
        className="mt-2 w-full py-1.5 rounded-lg bg-c-surface text-c-text dark:bg-c-surface-raised dark:text-c-text dark:hover:bg-c-surface-raised text-xs font-medium hover:bg-c-surface transition-colors"
      >
        {t('ideas.mindmap.save', 'Save')}
      </button>
    </div>
  );
};

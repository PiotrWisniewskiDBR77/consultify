import { ImagePlus, Smile, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * M04 Living Notebook — cover image + page-icon picker (Agent 4 / Editor PRO).
 *
 * Two small, self-contained primitives used in the note header:
 *  - <IconPickerButton/> — clickable page icon; popover with a curated emoji set.
 *  - <CoverImageBar/>     — full-width cover with change / remove affordances,
 *                            plus a "Add cover" entry when none is set.
 *
 * Both are presentational: persistence (PUT cover / save icon) is owned by the
 * caller (NotebookContent) so this file stays inside the allowed file set.
 */

/** Curated, work-appropriate icon set (no need for a full emoji-mart dep). */
const ICON_CHOICES = [
  '📝', '🧠', '💡', '🎯', '⚡', '🚀', '📊', '📈', '🗂️', '📌',
  '🔍', '🧩', '⭐', '🔥', '✅', '⚠️', '❓', '💬', '🛠️', '🌱',
  '🌿', '🏆', '📅', '🔗', '📎', '🧭', '🎨', '🧪', '💼', '🗒️',
];

interface IconPickerButtonProps {
  /** Current icon (emoji) or null. */
  value: string | null;
  /** Fallback glyph rendered when no icon is set (e.g. maturity icon). */
  fallback: React.ReactNode;
  onChange: (icon: string | null) => void;
  isPolish: boolean;
}

export const IconPickerButton: React.FC<IconPickerButtonProps> = ({
  value,
  fallback,
  onChange,
  isPolish,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={isPolish ? 'Zmień ikonę strony' : 'Change page icon'}
        className="rounded-lg p-0.5 text-3xl leading-none transition-colors hover:bg-c-surface-raised"
      >
        {value && /\p{Emoji}/u.test(value) ? value : fallback}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-c-border bg-c-surface p-2 shadow-lg dark:border-navy-700 dark:bg-navy-900">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-c-text-muted">
              <Smile size={12} />
              {isPolish ? 'Ikona' : 'Icon'}
            </span>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-[11px] text-c-text-muted transition-colors hover:text-c-danger dark:text-c-text-muted"
              >
                {isPolish ? 'Usuń' : 'Remove'}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-6 gap-0.5">
            {ICON_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xl transition-colors hover:bg-c-surface-raised ${
                  value === emoji ? 'bg-c-surface-raised' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface CoverImageBarProps {
  coverUrl: string | null;
  /** Opens the caller's file picker to choose a new cover image. */
  onPick: () => void;
  onRemove: () => void;
  isPolish: boolean;
}

export const CoverImageBar: React.FC<CoverImageBarProps> = ({
  coverUrl,
  onPick,
  onRemove,
  isPolish,
}) => {
  if (!coverUrl) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text dark:text-c-text-muted dark:hover:bg-white/[0.06] dark:hover:text-c-text"
      >
        <ImagePlus size={13} />
        {isPolish ? 'Dodaj okładkę' : 'Add cover'}
      </button>
    );
  }

  return (
    <div className="nb-cover" style={{ backgroundImage: `url("${cssUrl(coverUrl)}")` }}>
      <div className="nb-cover-actions absolute right-2 top-2 flex items-center gap-1">
        <button
          type="button"
          onClick={onPick}
          className="inline-flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <ImagePlus size={12} />
          {isPolish ? 'Zmień' : 'Change'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title={isPolish ? 'Usuń okładkę' : 'Remove cover'}
          className="inline-flex items-center rounded-md bg-black/45 p-1 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

/** Escape a URL/data-URL for safe use inside a CSS url("...") value. */
function cssUrl(url: string): string {
  return url.replace(/"/g, '%22').replace(/\n/g, '');
}

/**
 * Tiny modal to paste a remote cover image URL (alternative to file upload).
 * Optional helper exported for callers that want a URL-entry affordance.
 */
export const CoverUrlModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  isPolish: boolean;
}> = ({ open, onClose, onSubmit, isPolish }) => {
  const [value, setValue] = useState('');
  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
    setValue('');
    onClose();
  }, [value, onSubmit, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-c-border bg-c-surface p-4 shadow-xl dark:border-navy-700 dark:bg-navy-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-c-text">
            {isPolish ? 'Okładka z adresu URL' : 'Cover from URL'}
          </h3>
          <button type="button" onClick={onClose} className="text-c-text-muted hover:text-c-text">
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="https://…"
          className="w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text outline-none focus:border-[var(--c-focus-solid)] dark:border-navy-700 dark:bg-navy-800 dark:text-c-text"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-c-text-secondary transition-colors hover:bg-c-surface-raised dark:text-c-text-secondary dark:hover:bg-white/[0.06]"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-c-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            {isPolish ? 'Ustaw' : 'Set'}
          </button>
        </div>
      </div>
    </div>
  );
};

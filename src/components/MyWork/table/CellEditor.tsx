/**
 * CellEditor — Inline cell editor for the Table Platform.
 *
 * Provides type-appropriate editing UI for each FieldType.
 * Enter saves, Escape cancels. Auto-focuses on mount.
 */
import { Check, ChevronDown, Link2, Star } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FieldType, TablePlatformSelectOption } from '@/types/tablePlatform';

import { LinkedRecordPicker } from './LinkedRecordPicker';

// ── Props ────────────────────────────────────────────────────────────────────

export interface LinkedRecordContext {
  recordId: string;
  fieldId: string;
  linkedTableId: string;
}

export interface CellEditorProps {
  value: unknown;
  fieldType: FieldType;
  fieldOptions?: Record<string, unknown>;
  onSave: (newValue: unknown) => void;
  onCancel: () => void;
  linkedRecordContext?: LinkedRecordContext;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSelectOptions(fieldOptions?: Record<string, unknown>): TablePlatformSelectOption[] {
  const opts = fieldOptions as { options?: TablePlatformSelectOption[] } | undefined;
  return opts?.options ?? [];
}

const baseCls =
  'w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-[11px] md:text-[11px] text-sm text-c-text outline-none ring-2 ring-c-focus min-h-[44px] md:min-h-0 touch-manipulation';

// ── Text Editor ──────────────────────────────────────────────────────────────

const TextEditor: React.FC<CellEditorProps> = ({ value, onSave, onCancel }) => {
  const [draft, setDraft] = useState(String(value ?? ''));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(draft);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [draft, onSave, onCancel]
  );

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(draft)}
      className={baseCls}
    />
  );
};

// ── Rich Text Editor (Long Text) ─────────────────────────────────────────────

const RichTextEditor: React.FC<CellEditorProps> = ({ value, onSave, onCancel }) => {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && typeof value === 'string') {
      editorRef.current.innerHTML = value;
    }
    editorRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
          e.preventDefault();
          document.execCommand('bold');
        }
        if (e.key === 'i') {
          e.preventDefault();
          document.execCommand('italic');
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel]
  );

  const commit = useCallback(() => {
    onSave(editorRef.current?.innerHTML || '');
  }, [onSave]);

  return (
    <div className="space-y-1">
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => document.execCommand('bold')}
          className="px-1.5 py-0.5 rounded bg-c-surface-raised font-bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => document.execCommand('italic')}
          className="px-1.5 py-0.5 rounded bg-c-surface-raised italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => document.execCommand('insertUnorderedList')}
          className="px-1.5 py-0.5 rounded bg-c-surface-raised"
        >
          • {t('myWorkTable.cellEditor.list', 'List')}
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[80px] p-2 border rounded bg-c-surface text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-c-text"
        onInput={() => {
          /* value tracked via ref */
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </div>
  );
};

// ── Number Editor ────────────────────────────────────────────────────────────

const NumberEditor: React.FC<CellEditorProps> = ({ value, onSave, onCancel }) => {
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(draft === '' ? null : Number(draft));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [draft, onSave, onCancel]
  );

  return (
    <input
      ref={ref}
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(draft === '' ? null : Number(draft))}
      className={`${baseCls} tabular-nums text-right`}
    />
  );
};

// ── Date Editor ──────────────────────────────────────────────────────────────

const DateEditor: React.FC<CellEditorProps> = ({ value, onSave, onCancel }) => {
  const [draft, setDraft] = useState(value ? String(value).slice(0, 10) : '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave(draft || null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [draft, onSave, onCancel]
  );

  return (
    <input
      ref={ref}
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(draft || null)}
      className={baseCls}
    />
  );
};

// ── Single Select Editor ─────────────────────────────────────────────────────

const SingleSelectEditor: React.FC<CellEditorProps> = ({
  value,
  fieldOptions,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const options = getSelectOptions(fieldOptions);
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onCancel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div ref={ref} className="relative">
      <div className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1 max-h-48 overflow-auto">
        {options.map((opt) => {
          const optVal = String(opt.name ?? opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSave(optVal);
                setOpen(false);
              }}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-c-surface-raised transition-colors flex items-center gap-2 min-h-[44px] md:min-h-0 touch-manipulation ${
                String(value) === optVal ? 'bg-c-surface-raised' : ''
              }`}
            >
              {opt.color && (
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {optVal as React.ReactNode}
            </button>
          );
        })}
        {Boolean(value) && (
          <button
            type="button"
            onClick={() => {
              onSave(null);
              setOpen(false);
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('ideas.table.cellEditor.clear', 'Clear')}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Multi Select Editor ──────────────────────────────────────────────────────

const MultiSelectEditor: React.FC<CellEditorProps> = ({
  value,
  fieldOptions,
  onSave,
  onCancel,
}) => {
  const options = getSelectOptions(fieldOptions);
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onSave(selected);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onSave, selected, onCancel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onSave(selected);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onSave, onCancel, selected]);

  const toggle = (val: string) => {
    setSelected((prev) => (prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]));
  };

  return (
    <div ref={ref} className="relative">
      <div className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl p-1 max-h-48 overflow-auto">
        {options.map((opt) => {
          const optVal = String(opt.name ?? opt.id);
          const isSelected = selected.includes(optVal);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(optVal)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-c-surface-raised transition-colors flex items-center gap-2 min-h-[44px] md:min-h-0 touch-manipulation"
            >
              <span
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-c-text border-c-text' : 'border-c-border-subtle'
                }`}
              >
                {isSelected && <Check size={9} className="text-c-surface" />}
              </span>
              {opt.color && (
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {String(optVal)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── URL / Email / Phone Editor (with validation hint) ────────────────────────

const ValidatedTextEditor: React.FC<
  CellEditorProps & { placeholder?: string; pattern?: RegExp }
> = ({ value, onSave, onCancel, placeholder, pattern }) => {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [invalid, setInvalid] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const validate = useCallback(
    (val: string) => {
      if (!val || !pattern) return true;
      return pattern.test(val);
    },
    [pattern]
  );

  const handleSave = useCallback(() => {
    if (!validate(draft)) {
      setInvalid(true);
      return;
    }
    onSave(draft || null);
  }, [draft, validate, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      placeholder={placeholder}
      className={`${baseCls} ${invalid ? 'border-danger-400 dark:border-danger-500 ring-danger-500/30' : ''}`}
    />
  );
};

// ── Linked Record Editor ─────────────────────────────────────────────────────

const LinkedRecordEditor: React.FC<CellEditorProps> = ({
  value,
  fieldOptions,
  onSave,
  onCancel,
  linkedRecordContext,
}) => {
  const { t } = useTranslation();

  const linkedTableId =
    linkedRecordContext?.linkedTableId ??
    (fieldOptions as { linkedTableId?: string })?.linkedTableId ??
    '';

  const currentIds: string[] = Array.isArray(value)
    ? value.map(String)
    : value
      ? [String(value)]
      : [];
  const currentLinks = currentIds.map((id) => ({ id, displayValue: id }));

  if (!linkedTableId) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-c-text-secondary">
        <Link2 className="h-3.5 w-3.5" />
        {t('ideas.table.noLinkedTableConfigured', 'No linked table configured')}
      </div>
    );
  }

  return (
    <LinkedRecordPicker
      open
      onClose={onCancel}
      recordId={linkedRecordContext?.recordId ?? ''}
      fieldId={linkedRecordContext?.fieldId ?? ''}
      linkedTableId={linkedTableId}
      currentLinks={currentLinks}
      onLink={(ids) => {
        const merged = [...new Set([...currentIds, ...ids])];
        onSave(merged);
      }}
      onUnlink={(ids) => {
        const remaining = currentIds.filter((id) => !ids.includes(id));
        onSave(remaining.length > 0 ? remaining : null);
      }}
    />
  );
};

// ── Rating Editor ────────────────────────────────────────────────────────────

const RatingEditor: React.FC<CellEditorProps> = ({ value, fieldOptions, onSave, onCancel }) => {
  const max = Number((fieldOptions as { max?: number })?.max) || 5;
  const [draft, setDraft] = useState(Math.round(Number(value) || 0));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onSave(draft);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onSave, draft]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onSave(draft);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onSave, onCancel, draft]);

  return (
    <div ref={ref} className="flex items-center gap-0.5 px-1 py-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            const newVal = i + 1 === draft ? 0 : i + 1;
            setDraft(newVal);
            onSave(newVal);
          }}
          className="p-0 border-0 bg-transparent cursor-pointer"
        >
          <Star
            size={16}
            className={
              i < draft
                ? 'text-amber-400 fill-amber-400'
                : 'text-c-text-secondary hover:text-amber-300'
            }
          />
        </button>
      ))}
    </div>
  );
};

// ── Duration Editor ──────────────────────────────────────────────────────────

const DurationEditor: React.FC<CellEditorProps> = ({ value, onSave, onCancel }) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const initial = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const parseToSeconds = useCallback((str: string): number | null => {
    const parts = str.split(':').map(Number);
    if (parts.some((p) => isNaN(p) || p < 0)) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
    if (parts.length === 1) return parts[0] * 60;
    return null;
  }, []);

  const handleSave = useCallback(() => {
    if (!draft.trim()) {
      onSave(null);
      return;
    }
    const seconds = parseToSeconds(draft.trim());
    if (seconds != null) {
      onSave(seconds);
    } else {
      onSave(value);
    }
  }, [draft, parseToSeconds, onSave, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      placeholder="h:mm:ss"
      className={`${baseCls} tabular-nums`}
    />
  );
};

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.\w{2,}/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Editor router ────────────────────────────────────────────────────────────

const EDITORS: Partial<Record<FieldType, React.FC<CellEditorProps>>> = {
  singleLineText: TextEditor,
  longText: RichTextEditor,
  number: NumberEditor,
  currency: NumberEditor,
  percent: NumberEditor,
  date: DateEditor,
  singleSelect: SingleSelectEditor,
  multiSelect: MultiSelectEditor,
  url: (props) => (
    <ValidatedTextEditor {...props} placeholder="https://..." pattern={URL_PATTERN} />
  ),
  email: (props) => (
    <ValidatedTextEditor {...props} placeholder="name@example.com" pattern={EMAIL_PATTERN} />
  ),
  phone: (props) => <ValidatedTextEditor {...props} placeholder="+1 234 567 890" />,
  linkedRecord: LinkedRecordEditor,
  rating: RatingEditor,
  duration: DurationEditor,
  barcode: TextEditor,
};

export const CellEditor: React.FC<CellEditorProps> = React.memo((props) => {
  const Editor = EDITORS[props.fieldType];
  if (!Editor) return <TextEditor {...props} />;
  return <Editor {...props} />;
});

CellEditor.displayName = 'CellEditor';

export default CellEditor;

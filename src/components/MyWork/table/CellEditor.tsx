/**
 * CellEditor — Inline cell editor for the Table Platform.
 *
 * Provides type-appropriate editing UI for each FieldType.
 * Enter saves, Escape cancels. Auto-focuses on mount.
 */
import { Check, ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FieldType, SelectOption } from '@/types/tablePlatform';

// ── Props ────────────────────────────────────────────────────────────────────

export interface CellEditorProps {
  value: unknown;
  fieldType: FieldType;
  fieldOptions?: Record<string, unknown>;
  onSave: (newValue: unknown) => void;
  onCancel: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSelectOptions(fieldOptions?: Record<string, unknown>): SelectOption[] {
  const opts = fieldOptions as { options?: SelectOption[] } | undefined;
  return opts?.options ?? [];
}

const baseCls =
  'w-full rounded-lg border border-violet-400 dark:border-violet-500 bg-white dark:bg-navy-950 px-2 py-1.5 text-[11px] text-slate-800 dark:text-slate-200 outline-none ring-2 ring-violet-500/30';

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
    [draft, onSave, onCancel],
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

// ── Long Text Editor ─────────────────────────────────────────────────────────

const LongTextEditor: React.FC<CellEditorProps> = ({ value, onSave, onCancel }) => {
  const [draft, setDraft] = useState(String(value ?? ''));
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSave(draft);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [draft, onSave, onCancel],
  );

  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(draft)}
      rows={3}
      className={`${baseCls} resize-y min-h-[60px]`}
    />
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
    [draft, onSave, onCancel],
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
    [draft, onSave, onCancel],
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
      <div className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl p-1 max-h-48 overflow-auto">
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
              className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-2 ${
                String(value) === optVal ? 'bg-violet-50 dark:bg-violet-500/10' : ''
              }`}
            >
              {opt.color && (
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              {optVal}
            </button>
          );
        })}
        {value && (
          <button
            type="button"
            onClick={() => {
              onSave(null);
              setOpen(false);
            }}
            className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            Clear
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
    Array.isArray(value) ? value.map(String) : value ? [String(value)] : [],
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
    setSelected((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val],
    );
  };

  return (
    <div ref={ref} className="relative">
      <div className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl p-1 max-h-48 overflow-auto">
        {options.map((opt) => {
          const optVal = String(opt.name ?? opt.id);
          const isSelected = selected.includes(optVal);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(optVal)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors flex items-center gap-2"
            >
              <span
                className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                  isSelected
                    ? 'bg-violet-500 border-violet-500'
                    : 'border-slate-300 dark:border-navy-600'
                }`}
              >
                {isSelected && <Check size={9} className="text-white" />}
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

const ValidatedTextEditor: React.FC<CellEditorProps & { placeholder?: string; pattern?: RegExp }> = ({
  value,
  onSave,
  onCancel,
  placeholder,
  pattern,
}) => {
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
    [pattern],
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
    [handleSave, onCancel],
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
      className={`${baseCls} ${invalid ? 'border-red-400 dark:border-red-500 ring-red-500/30' : ''}`}
    />
  );
};

const URL_PATTERN = /^(https?:\/\/)?[\w.-]+\.\w{2,}/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Editor router ────────────────────────────────────────────────────────────

const EDITORS: Partial<Record<FieldType, React.FC<CellEditorProps>>> = {
  singleLineText: TextEditor,
  longText: LongTextEditor,
  number: NumberEditor,
  currency: NumberEditor,
  percent: NumberEditor,
  date: DateEditor,
  singleSelect: SingleSelectEditor,
  multiSelect: MultiSelectEditor,
  url: (props) => <ValidatedTextEditor {...props} placeholder="https://..." pattern={URL_PATTERN} />,
  email: (props) => <ValidatedTextEditor {...props} placeholder="name@example.com" pattern={EMAIL_PATTERN} />,
  phone: (props) => <ValidatedTextEditor {...props} placeholder="+1 234 567 890" />,
};

export const CellEditor: React.FC<CellEditorProps> = React.memo((props) => {
  const Editor = EDITORS[props.fieldType];
  if (!Editor) return <TextEditor {...props} />;
  return <Editor {...props} />;
});

CellEditor.displayName = 'CellEditor';

export default CellEditor;

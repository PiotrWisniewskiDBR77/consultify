/**
 * FormulaEditor — Rich formula editing component.
 *
 * Features:
 * - Monospace code input with basic syntax highlighting
 * - Autocomplete for field names and function names (Ctrl+Space or typing)
 * - Real-time API validation (debounced 500ms) with status indicator
 * - Collapsible function reference panel
 * - Preview of computed result for first record
 */
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FunctionSquare,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldInfo {
  id: string;
  name: string;
  fieldType: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  dependencies?: string[];
  resultType?: string;
}

interface FormulaEditorProps {
  tableId: string;
  value: string;
  onChange: (expression: string) => void;
  fields: FieldInfo[];
  onValidationChange?: (result: ValidationResult | null) => void;
  locked?: boolean;
}

// ── Function reference data ───────────────────────────────────────────────────

interface FunctionDef {
  name: string;
  signature: string;
  /** English default text; translated at render time via t('ideas.table.fn.<name>', description) */
  description: string;
  category: string;
}

const FORMULA_FUNCTIONS: FunctionDef[] = [
  {
    name: 'SUM',
    signature: 'SUM(field1, field2, ...)',
    description: 'Sum of values',
    category: 'math',
  },
  {
    name: 'AVG',
    signature: 'AVG(field1, field2, ...)',
    description: 'Average of values',
    category: 'math',
  },
  {
    name: 'MIN',
    signature: 'MIN(field1, field2, ...)',
    description: 'Minimum value',
    category: 'math',
  },
  {
    name: 'MAX',
    signature: 'MAX(field1, field2, ...)',
    description: 'Maximum value',
    category: 'math',
  },
  {
    name: 'ABS',
    signature: 'ABS(value)',
    description: 'Absolute value',
    category: 'math',
  },
  {
    name: 'ROUND',
    signature: 'ROUND(value, decimals)',
    description: 'Round to N decimals',
    category: 'math',
  },
  {
    name: 'CEIL',
    signature: 'CEIL(value)',
    description: 'Round up to integer',
    category: 'math',
  },
  {
    name: 'FLOOR',
    signature: 'FLOOR(value)',
    description: 'Round down to integer',
    category: 'math',
  },
  {
    name: 'IF',
    signature: 'IF(condition, true_val, false_val)',
    description: 'Conditional expression',
    category: 'logic',
  },
  {
    name: 'AND',
    signature: 'AND(cond1, cond2, ...)',
    description: 'All conditions true',
    category: 'logic',
  },
  {
    name: 'OR',
    signature: 'OR(cond1, cond2, ...)',
    description: 'Any condition true',
    category: 'logic',
  },
  {
    name: 'NOT',
    signature: 'NOT(condition)',
    description: 'Negate condition',
    category: 'logic',
  },
  {
    name: 'SWITCH',
    signature: 'SWITCH(expr, case1, val1, ...)',
    description: 'Multi-case conditional',
    category: 'logic',
  },
  {
    name: 'CONCAT',
    signature: 'CONCAT(a, " ", b)',
    description: 'Join text values',
    category: 'text',
  },
  {
    name: 'LEFT',
    signature: 'LEFT(text, count)',
    description: 'First N characters',
    category: 'text',
  },
  {
    name: 'RIGHT',
    signature: 'RIGHT(text, count)',
    description: 'Last N characters',
    category: 'text',
  },
  {
    name: 'LEN',
    signature: 'LEN(text)',
    description: 'Text length',
    category: 'text',
  },
  {
    name: 'UPPER',
    signature: 'UPPER(text)',
    description: 'Convert to uppercase',
    category: 'text',
  },
  {
    name: 'LOWER',
    signature: 'LOWER(text)',
    description: 'Convert to lowercase',
    category: 'text',
  },
  {
    name: 'TRIM',
    signature: 'TRIM(text)',
    description: 'Remove whitespace',
    category: 'text',
  },
  {
    name: 'NOW',
    signature: 'NOW()',
    description: 'Current date/time',
    category: 'date',
  },
  {
    name: 'TODAY',
    signature: 'TODAY()',
    description: 'Current date',
    category: 'date',
  },
  {
    name: 'DATEADD',
    signature: 'DATEADD(date, count, unit)',
    description: 'Add time to date',
    category: 'date',
  },
  {
    name: 'DATEDIFF',
    signature: 'DATEDIFF(date1, date2, unit)',
    description: 'Difference between dates',
    category: 'date',
  },
  {
    name: 'COUNTA',
    signature: 'COUNTA(field)',
    description: 'Count non-empty values',
    category: 'aggregate',
  },
  {
    name: 'COUNTALL',
    signature: 'COUNTALL(field)',
    description: 'Count all values',
    category: 'aggregate',
  },
];

const FUNCTION_CATEGORIES = [
  { key: 'math', en: 'Math' },
  { key: 'logic', en: 'Logic' },
  { key: 'text', en: 'Text' },
  { key: 'date', en: 'Date' },
  { key: 'aggregate', en: 'Aggregate' },
];

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Syntax highlighting ───────────────────────────────────────────────────────

function highlightFormula(
  expression: string,
  fieldNames: string[],
  functionNames: string[]
): React.ReactNode[] {
  if (!expression) return [];

  const tokens: React.ReactNode[] = [];
  const remaining = expression;
  let keyIdx = 0;

  const fieldPattern =
    fieldNames.length > 0
      ? new RegExp(
          `\\{(${fieldNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\}`,
          'g'
        )
      : null;
  const funcPattern = new RegExp(`\\b(${functionNames.join('|')})\\b`, 'gi');
  const stringPattern = /"[^"]*"|'[^']*'/g;
  const numberPattern = /\b\d+(\.\d+)?\b/g;
  const operatorPattern = /[+\-*/=<>!&|]+/g;

  // Simple token-based highlighting
  const allPatterns = [
    { pattern: stringPattern, cls: 'text-amber-500 dark:text-amber-400' },
    ...(fieldPattern
      ? [{ pattern: fieldPattern, cls: 'text-emerald-600 dark:text-emerald-400 font-semibold' }]
      : []),
    { pattern: funcPattern, cls: 'text-blue-600 dark:text-blue-400 font-semibold' },
    { pattern: numberPattern, cls: 'text-violet-600 dark:text-violet-400 font-semibold' },
    { pattern: operatorPattern, cls: 'text-c-text-secondary' },
  ];

  // Build a combined match list
  interface Match {
    start: number;
    end: number;
    text: string;
    cls: string;
  }
  const matches: Match[] = [];

  for (const { pattern, cls } of allPatterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(expression)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], cls });
    }
  }

  // Sort by start, remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  let pos = 0;
  for (const m of filtered) {
    if (m.start > pos) {
      tokens.push(
        <span key={keyIdx++} className="text-c-text">
          {expression.slice(pos, m.start)}
        </span>
      );
    }
    tokens.push(
      <span key={keyIdx++} className={m.cls}>
        {m.text}
      </span>
    );
    pos = m.end;
  }

  if (pos < expression.length) {
    tokens.push(
      <span key={keyIdx++} className="text-c-text">
        {expression.slice(pos)}
      </span>
    );
  }

  return tokens;
}

// ── Main Component ────────────────────────────────────────────────────────────

export const FormulaEditor: React.FC<FormulaEditorProps> = React.memo(
  ({ tableId, value, onChange, fields, onValidationChange, locked = false }) => {
    const { t } = useTranslation();

    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteItems, setAutocompleteItems] = useState<
      Array<{ label: string; value: string; type: 'field' | 'function'; detail?: string }>
    >([]);
    const [acHighlightIdx, setAcHighlightIdx] = useState(0);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [validating, setValidating] = useState(false);
    const [showFuncRef, setShowFuncRef] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const acRef = useRef<HTMLDivElement>(null);

    const debouncedValue = useDebounce(value, 500);

    const fieldNames = useMemo(() => fields.map((f) => f.name), [fields]);
    const functionNames = useMemo(() => FORMULA_FUNCTIONS.map((f) => f.name), []);

    // Sync scroll between textarea and highlight overlay
    const handleScroll = useCallback(() => {
      if (textareaRef.current && highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }, []);

    // Validate formula via API
    useEffect(() => {
      if (!debouncedValue.trim() || !tableId) {
        setValidation(null);
        onValidationChange?.(null);
        return;
      }

      let cancelled = false;
      setValidating(true);

      (async () => {
        try {
          const res = await TablePlatformApi.validateFormula(tableId, debouncedValue);
          if (cancelled) return;
          const result: ValidationResult = {
            valid: Boolean((res as Record<string, unknown>)?.valid ?? true),
            error: (res as Record<string, unknown>)?.error as string | undefined,
            dependencies: (res as Record<string, unknown>)?.dependencies as string[] | undefined,
            resultType: (res as Record<string, unknown>)?.resultType as string | undefined,
          };
          setValidation(result);
          onValidationChange?.(result);
        } catch {
          if (!cancelled) {
            const fallback: ValidationResult = {
              valid: false,
              error: t('ideas.table.validationError', 'Validation error'),
            };
            setValidation(fallback);
            onValidationChange?.(fallback);
          }
        } finally {
          if (!cancelled) setValidating(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [debouncedValue, tableId, t, onValidationChange]);

    // Preview formula result
    useEffect(() => {
      if (!debouncedValue.trim() || !tableId || !validation?.valid) {
        setPreview(null);
        return;
      }

      let cancelled = false;
      setPreviewLoading(true);

      (async () => {
        try {
          const res = await TablePlatformApi.previewFormula(tableId, debouncedValue);
          if (cancelled) return;
          const val = (res as Record<string, unknown>)?.result;
          setPreview(val != null ? String(val) : null);
        } catch {
          if (!cancelled) setPreview(null);
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [debouncedValue, tableId, validation?.valid]);

    // Build autocomplete suggestions
    const updateAutocomplete = useCallback(
      (cursorPos: number) => {
        const textBefore = value.slice(0, cursorPos);
        const wordMatch = textBefore.match(/[\w{]*$/);
        const currentWord = wordMatch ? wordMatch[0] : '';

        if (currentWord.length < 1) {
          setShowAutocomplete(false);
          return;
        }

        const q = currentWord.replace(/^\{/, '').toLowerCase();
        const isFieldRef = currentWord.startsWith('{');

        const items: Array<{
          label: string;
          value: string;
          type: 'field' | 'function';
          detail?: string;
        }> = [];

        // Field suggestions
        fields
          .filter((f) => f.name.toLowerCase().includes(q))
          .forEach((f) => {
            items.push({
              label: f.name,
              value: `{${f.name}}`,
              type: 'field',
              detail: f.fieldType,
            });
          });

        // Function suggestions (only if not in a field ref)
        if (!isFieldRef) {
          FORMULA_FUNCTIONS.filter((fn) => fn.name.toLowerCase().includes(q)).forEach((fn) => {
            items.push({
              label: fn.name,
              value: `${fn.name}(`,
              type: 'function',
              detail: fn.signature,
            });
          });
        }

        if (items.length > 0) {
          setAutocompleteItems(items.slice(0, 10));
          setAcHighlightIdx(0);
          setShowAutocomplete(true);
        } else {
          setShowAutocomplete(false);
        }
      },
      [value, fields]
    );

    const insertAutocomplete = useCallback(
      (item: (typeof autocompleteItems)[0]) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const textBefore = value.slice(0, cursorPos);
        const wordMatch = textBefore.match(/[\w{]*$/);
        const wordStart = wordMatch ? cursorPos - wordMatch[0].length : cursorPos;

        const newValue = value.slice(0, wordStart) + item.value + value.slice(cursorPos);
        onChange(newValue);
        setShowAutocomplete(false);

        requestAnimationFrame(() => {
          const newPos = wordStart + item.value.length;
          textarea.setSelectionRange(newPos, newPos);
          textarea.focus();
        });
      },
      [value, onChange]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (showAutocomplete) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAcHighlightIdx((prev) => Math.min(prev + 1, autocompleteItems.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAcHighlightIdx((prev) => Math.max(prev - 1, 0));
            return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            if (autocompleteItems[acHighlightIdx]) {
              insertAutocomplete(autocompleteItems[acHighlightIdx]);
            }
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setShowAutocomplete(false);
            return;
          }
        }

        // Ctrl+Space to trigger autocomplete
        if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          const textarea = textareaRef.current;
          if (textarea) updateAutocomplete(textarea.selectionStart);
        }
      },
      [showAutocomplete, autocompleteItems, acHighlightIdx, insertAutocomplete, updateAutocomplete]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        onChange(newVal);
        updateAutocomplete(e.target.selectionStart);
      },
      [onChange, updateAutocomplete]
    );

    const highlighted = useMemo(
      () => highlightFormula(value, fieldNames, functionNames),
      [value, fieldNames, functionNames]
    );

    return (
      <div className="space-y-3">
        {/* Code input with syntax highlighting */}
        <div className="relative">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
            {t('ideas.table.formulaExpression', 'Formula expression')}
          </label>
          <div className="relative rounded-xl border border-c-border-subtle bg-c-surface-raised">
            {/* Highlight overlay */}
            <div
              ref={highlightRef}
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed"
              aria-hidden="true"
            >
              {highlighted}
            </div>
            {/* Actual textarea */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              disabled={locked}
              rows={4}
              placeholder={t('ideas.table.eGIfStatusDone10', 'e.g. IF({status} = "Done", 1, 0)')}
              className="relative w-full resize-y rounded-xl bg-transparent p-3 font-mono text-xs leading-relaxed text-transparent caret-slate-800 outline-none placeholder:text-c-text-muted dark:caret-zinc-200 dark:placeholder:text-c-text-secondary"
              spellCheck={false}
            />

            {/* Autocomplete dropdown */}
            {showAutocomplete && (
              <div
                ref={acRef}
                className="absolute left-3 top-full z-50 mt-1 max-h-48 w-72 overflow-auto rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl"
              >
                {autocompleteItems.map((item, idx) => (
                  <button
                    key={`${item.type}-${item.label}`}
                    onClick={() => insertAutocomplete(item)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      idx === acHighlightIdx
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-c-surface-raised'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                        item.type === 'field'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}
                    >
                      {item.type === 'field' ? 'F' : 'fn'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-c-text">{item.label}</div>
                      {item.detail && (
                        <div className="truncate text-[10px] text-c-text-secondary">
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Validation status */}
        <div className="flex items-center gap-3">
          {validating ? (
            <div className="flex items-center gap-1.5 text-[10px] text-c-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('ideas.table.validating', 'Validating...')}
            </div>
          ) : validation ? (
            validation.valid ? (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {t('ideas.table.formulaValid', 'Formula valid')}
                {validation.resultType && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] dark:bg-emerald-900/30">
                    → {validation.resultType}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-danger-600 dark:text-danger-400">
                <X className="h-3.5 w-3.5" />
                {validation.error ?? t('ideas.table.invalidFormula', 'Invalid formula')}
              </div>
            )
          ) : null}

          {/* Dependencies */}
          {validation?.valid && validation.dependencies && validation.dependencies.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-c-text-secondary">
              <span>{t('ideas.table.dependsOn', 'Depends on:')}</span>
              {validation.dependencies.map((dep) => (
                <span
                  key={dep}
                  className="rounded bg-c-surface-raised px-1.5 py-0.5 text-[9px] font-medium text-c-text-secondary"
                >
                  {dep}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        {validation?.valid && (
          <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-4 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-c-text-secondary">
              <Sparkles className="h-3 w-3" />
              {t('ideas.table.resultPreview', 'Result preview')}
            </div>
            {previewLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-c-text-secondary" />
            ) : preview != null ? (
              <span className="font-mono text-xs font-semibold text-c-text">{preview}</span>
            ) : (
              <span className="text-[10px] italic text-c-text-secondary">
                {t('ideas.table.noPreviewDataAvailable', 'No preview data available')}
              </span>
            )}
          </div>
        )}

        {/* Function reference */}
        <div className="rounded-xl border border-c-border-subtle">
          <button
            onClick={() => setShowFuncRef(!showFuncRef)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-c-surface-raised"
          >
            <BookOpen className="h-3.5 w-3.5 text-c-text-secondary" />
            <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
              {t('ideas.table.availableFunctions', 'Available functions')}
            </span>
            {showFuncRef ? (
              <ChevronDown className="h-3.5 w-3.5 text-c-text-secondary" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-c-text-secondary" />
            )}
          </button>
          {showFuncRef && (
            <div className="border-t border-c-border-subtle px-2 py-2">
              {FUNCTION_CATEGORIES.map((cat) => {
                const funcs = FORMULA_FUNCTIONS.filter((f) => f.category === cat.key);
                const isExpanded = expandedCategory === cat.key;
                return (
                  <div key={cat.key} className="mb-1">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold text-c-text-secondary transition-colors hover:bg-c-surface-raised"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      {t(`ideas.table.cat.${cat.key}`, cat.en)} ({funcs.length})
                    </button>
                    {isExpanded && (
                      <div className="ml-4 space-y-0.5">
                        {funcs.map((fn) => (
                          <button
                            key={fn.name}
                            onClick={() => {
                              if (locked) return;
                              const textarea = textareaRef.current;
                              if (!textarea) return;
                              const pos = textarea.selectionStart;
                              const insert = `${fn.name}(`;
                              const newVal = value.slice(0, pos) + insert + value.slice(pos);
                              onChange(newVal);
                              requestAnimationFrame(() => {
                                const newPos = pos + insert.length;
                                textarea.setSelectionRange(newPos, newPos);
                                textarea.focus();
                              });
                            }}
                            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-c-surface-raised"
                          >
                            <FunctionSquare className="mt-0.5 h-3 w-3 flex-shrink-0 text-blue-500" />
                            <div>
                              <div className="font-mono text-[10px] font-semibold text-c-text">
                                {fn.signature}
                              </div>
                              <div className="text-[9px] text-c-text-secondary">
                                {t(`ideas.table.fn.${fn.name.toLowerCase()}`, fn.description)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cycle warning placeholder */}
        {validation?.valid === false && validation.error?.toLowerCase().includes('cycle') && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {t('ideas.table.dependencyCycleDetected', 'Dependency cycle detected')}
              </div>
              <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                {t(
                  'ideas.table.thisFormulaCreatesACircularDependencyModifyTheExpressionToAv',
                  'This formula creates a circular dependency. Modify the expression to avoid loops.'
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FormulaEditor.displayName = 'FormulaEditor';

export default FormulaEditor;

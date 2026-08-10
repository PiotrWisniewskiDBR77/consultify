/**
 * AddColumnDialog — Column creation dialog with grouped type selector
 * and type-specific configuration panels driven by PropertyRegistry.
 *
 * TB-P1-02 (2026-08-10): rebuilt as a compact, stay-open wizard so several
 * fields can be created in one sitting (name → type → create → repeat),
 * with inline duplicate/empty-name recovery that never closes the dialog,
 * a live preview cell (the real `CellRenderer`, not a mockup), and a
 * per-field "Undo" that calls back into the SAME delete-column command the
 * rest of the table uses — see `onUndo`.
 */
import {
  AlertCircle,
  Calculator,
  Calendar,
  Check,
  CheckSquare,
  CircleDot,
  Clock,
  DollarSign,
  File,
  Hash,
  Link2,
  List,
  ListChecks,
  Mail,
  Palette,
  Percent,
  Phone,
  Sigma,
  Smile,
  Sparkles,
  Star,
  Type,
  Undo2,
  User,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CellRenderer } from './CellRenderer';
import { FormulaEditor } from './FormulaEditor';
import { getPropertyGroups, getPropertySpec } from './PropertyRegistry';
import type { ColumnDef, ColumnType } from './tableTypes';
import { SELECT_COLORS } from './tableTypes';

const TYPE_ICONS: Record<ColumnType, React.ComponentType<{ size?: number; className?: string }>> = {
  text: Type,
  number: Hash,
  select: List,
  multiselect: ListChecks,
  status: CircleDot,
  date: Calendar,
  checkbox: CheckSquare,
  rating: Star,
  person: User,
  url: Link2,
  progress: Percent,
  formula: Calculator,
  ai_generated: Sparkles,
  file: File,
  relation: Link2,
  rollup: Sigma,
  emoji: Smile,
  color: Palette,
  currency: DollarSign,
  phone: Phone,
  email: Mail,
  created_time: Clock,
  created_by: UserPlus,
  last_edited_time: Clock,
  last_edited_by: UserCheck,
};

interface AddColumnDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (column: ColumnDef) => void;
  existingKeys: string[];
  tableId?: string;
  tableFields?: Array<{ id: string; name: string; fieldType: string }>;
  /**
   * Same-session recovery for a field just created here — calls back into
   * the table's existing delete-column command (not a new one). Optional so
   * older call sites keep compiling; without it the "Cofnij"/"Undo" chip is
   * simply not shown.
   */
  onUndo?: (key: string) => void;
}

export const AddColumnDialog: React.FC<AddColumnDialogProps> = ({
  open,
  onClose,
  onAdd,
  existingKeys,
  tableId,
  tableFields = [],
  onUndo,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [options, setOptions] = useState('');
  const [formula, setFormula] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [relationTarget, setRelationTarget] = useState('');
  const [rollupSource, setRollupSource] = useState('');
  const [rollupFunction, setRollupFunction] = useState<string>('count');
  const [formulaValidation, setFormulaValidation] = useState<{
    valid: boolean;
    error?: string;
    dependencies?: string[];
    resultType?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewValue, setPreviewValue] = useState<unknown>(null);
  const [sessionAdded, setSessionAdded] = useState<
    Array<{ key: string; header: string; type: ColumnType }>
  >([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Full reset — used when the wizard actually closes (Cancel/Done/X).
  const reset = useCallback(() => {
    setName('');
    setType('text');
    setOptions('');
    setFormula('');
    setAiPrompt('');
    setCurrencyCode('USD');
    setDateFormat('YYYY-MM-DD');
    setRelationTarget('');
    setRollupSource('');
    setRollupFunction('count');
    setFormulaValidation(null);
    setError(null);
    setPreviewValue(null);
    setSessionAdded([]);
  }, []);

  const spec = getPropertySpec(type);

  const trimmedName = name.trim();
  const computedKey =
    trimmedName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '') || '';
  const isDuplicate = trimmedName !== '' && existingKeys.includes(computedKey);

  const buildColumn = useCallback(
    (key: string): ColumnDef => {
      const optionsList = options
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      return {
        key,
        header: trimmedName || key,
        type,
        visible: true,
        width: spec.defaultWidth,
        ...(type === 'select' || type === 'multiselect'
          ? {
              options: optionsList.length > 0 ? optionsList : ['Option 1', 'Option 2', 'Option 3'],
              optionColors: Object.fromEntries(
                (optionsList.length > 0 ? optionsList : ['Option 1', 'Option 2', 'Option 3']).map(
                  (o, i) => [o, SELECT_COLORS[i % SELECT_COLORS.length]]
                )
              ),
            }
          : {}),
        ...(type === 'formula'
          ? {
              formula: formula || '{col1} + {col2}',
              formulaDependencies: formulaValidation?.dependencies,
              formulaResultType: formulaValidation?.resultType,
            }
          : {}),
        ...(type === 'ai_generated' ? { aiPrompt: aiPrompt || 'Analyze this row' } : {}),
        ...(type === 'relation' && relationTarget ? { relationTarget } : {}),
        ...(type === 'rollup'
          ? {
              rollupSource: rollupSource || undefined,
              rollupFunction: (rollupFunction as ColumnDef['rollupFunction']) || 'count',
            }
          : {}),
      } as ColumnDef;
    },
    [
      aiPrompt,
      formula,
      formulaValidation,
      options,
      relationTarget,
      rollupFunction,
      rollupSource,
      spec.defaultWidth,
      trimmedName,
      type,
    ]
  );

  // Preview column mirrors the field about to be created — same builder as
  // the real submit, so "what you see" in the preview cell is what you get.
  const previewColumn = useMemo(() => buildColumn('__preview__'), [buildColumn]);

  // New type picked → the old preview value likely doesn't fit the new
  // shape (e.g. a typed number surviving a switch to Select). Reseed from
  // the type's own default rather than leaving a stale/mismatched value.
  useEffect(() => {
    setPreviewValue(spec.defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleAdd = useCallback(() => {
    if (trimmedName === '') {
      setError(
        t('myWorkTable.addColumnDialog.nameRequired', 'Give the field a name before creating it.')
      );
      nameInputRef.current?.focus();
      return;
    }
    if (isDuplicate) {
      setError(
        t(
          'myWorkTable.addColumnDialog.duplicateName',
          'A field named "{{name}}" already exists — choose a different name.',
          { name: trimmedName }
        )
      );
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
      return;
    }

    const col = buildColumn(computedKey || `col_${Date.now()}`);
    onAdd(col);
    setSessionAdded((prev) => [...prev, { key: col.key, header: col.header, type: col.type }]);
    setError(null);
    // Stay open: clear only the name + type-specific options so the next
    // field can be entered right away (name → Enter → name → Enter…). Type
    // carries over — consecutive fields of the same kind are the common case.
    setName('');
    setOptions('');
    setPreviewValue(null);
    nameInputRef.current?.focus();
  }, [buildColumn, computedKey, isDuplicate, onAdd, t, trimmedName]);

  const handleUndoField = useCallback(
    (key: string) => {
      onUndo?.(key);
      setSessionAdded((prev) => prev.filter((f) => f.key !== key));
    },
    [onUndo]
  );

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  const handleDialogClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  if (!open) return null;

  const groups = getPropertyGroups();

  return (
    <div className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[480px] max-h-[85vh] overflow-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <div>
            <h3 className="text-sm font-bold text-c-text">
              {t('myWorkTable.addColumnDialog.addColumn')}
            </h3>
            {sessionAdded.length > 0 && (
              <p className="mt-0.5 text-[10px] text-c-text-muted">
                {t(
                  'myWorkTable.addColumnDialog.addedCount',
                  '{{count}} field(s) added this session — keep going or press Done.',
                  { count: sessionAdded.length }
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleDialogClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
            aria-label={t('myWorkTable.addColumnDialog.cancel')}
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
              {t('myWorkTable.addColumnDialog.name')}
            </label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleNameKeyDown}
              placeholder={t('myWorkTable.addColumnDialog.eGStatusPriority')}
              aria-invalid={error ? true : undefined}
              className={`w-full rounded-xl border bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 ${
                error
                  ? 'border-red-400 focus:ring-red-400/30'
                  : 'border-slate-200/60 dark:border-white/[0.03] focus:ring-blue-500/30'
              }`}
              autoFocus
            />
            {error ? (
              <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-[10px] text-red-600 dark:text-red-400">
                <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                {error}
              </p>
            ) : (
              <p className="mt-1.5 text-[9px] text-c-text-muted">
                {t('myWorkTable.addColumnDialog.enterToCreate', 'Press Enter to create and add another.')}
              </p>
            )}
          </div>

          {/* Grouped type selector */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-1.5">
              {t('myWorkTable.addColumnDialog.type')}
            </label>
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
                    {isPl ? group.label.pl : group.label.en}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {group.types.map((t) => {
                      const Icon = TYPE_ICONS[t];
                      const tSpec = getPropertySpec(t);
                      const label = isPl ? tSpec.label.pl : tSpec.label.en;
                      const isActive = type === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setType(t)}
                          className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl text-[9px] font-medium transition-all ${
                            isActive
                              ? 'bg-c-surface-raised text-c-text ring-1 ring-c-focus'
                              : 'text-c-text-secondary hover:bg-c-surface-raised'
                          }`}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Type-specific config */}
          {(type === 'select' || type === 'multiselect') && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.addColumnDialog.optionsCommaSeparated')}
              </label>
              <input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder={t(
                  'ideas.table.addColumn.optionsPlaceholder',
                  'Option 1, Option 2, Option 3'
                )}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}

          {type === 'formula' && (
            <div>
              {tableId ? (
                <FormulaEditor
                  tableId={tableId}
                  value={formula}
                  onChange={setFormula}
                  fields={tableFields}
                  onValidationChange={setFormulaValidation}
                />
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                    {t('myWorkTable.addColumnDialog.formula')}
                  </label>
                  <input
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    placeholder="{impact} * {effort}"
                    className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs font-mono text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <p className="mt-1 text-[9px] text-c-text-secondary">
                    {t('myWorkTable.addColumnDialog.useColumnKeyToReference')}
                  </p>
                </div>
              )}
              {formulaValidation &&
                !formulaValidation.valid &&
                formulaValidation.error?.toLowerCase().includes('cycle') && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-300">
                      {t('myWorkTable.addColumnDialog.formulaCreatesADependencyCycle')}
                    </span>
                  </div>
                )}
            </div>
          )}

          {type === 'ai_generated' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.addColumnDialog.aiPrompt')}
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t('myWorkTable.addColumnDialog.assessRiskBasedOnCompany')}
                rows={3}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />
            </div>
          )}

          {type === 'currency' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.addColumnDialog.currency')}
              </label>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                {['USD', 'EUR', 'PLN', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === 'date' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.addColumnDialog.dateFormat')}
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="relative">
                  {t('myWorkTable.addColumnDialog.relative2DaysAgo')}
                </option>
              </select>
            </div>
          )}

          {type === 'relation' && (
            <div>
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.addColumnDialog.relationTarget')}
              </label>
              <input
                value={relationTarget}
                onChange={(e) => setRelationTarget(e.target.value)}
                placeholder={t('myWorkTable.addColumnDialog.eGInitiativesTasks')}
                className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <p className="mt-1 text-[9px] text-c-text-secondary">
                {t('myWorkTable.addColumnDialog.pointToTheTableOr')}
              </p>
            </div>
          )}

          {type === 'rollup' && (
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                  {t('myWorkTable.addColumnDialog.sourceRelationColumn')}
                </label>
                <input
                  value={rollupSource}
                  onChange={(e) => setRollupSource(e.target.value)}
                  placeholder={t('myWorkTable.addColumnDialog.eGTasksRelation')}
                  className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                  {t('myWorkTable.addColumnDialog.function')}
                </label>
                <select
                  value={rollupFunction}
                  onChange={(e) => setRollupFunction(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="count">{t('ideas.table.addColumn.rollup.count', 'Count')}</option>
                  <option value="sum">{t('ideas.table.addColumn.rollup.sum', 'Sum')}</option>
                  <option value="avg">
                    {t('ideas.table.addColumn.rollup.average', 'Average')}
                  </option>
                  <option value="min">{t('ideas.table.addColumn.rollup.min', 'Min')}</option>
                  <option value="max">{t('ideas.table.addColumn.rollup.max', 'Max')}</option>
                  <option value="percent_checked">
                    {t('myWorkTable.addColumnDialog.checked')}
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Live preview — the real cell renderer for the type/settings chosen
              above, not a static mockup. Doubles as a quick sanity check that
              the field will actually accept valid input before it's created. */}
          <div>
            <label className="block text-[11px] font-bold text-c-text-secondary mb-1.5">
              {t('myWorkTable.addColumnDialog.preview', 'Preview')}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5">
              {(() => {
                const Icon = TYPE_ICONS[type];
                return <Icon size={14} className="flex-shrink-0 text-c-text-secondary" />;
              })()}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-semibold text-c-text">
                  {trimmedName ||
                    t('myWorkTable.addColumnDialog.untitledField', 'Untitled field')}
                </div>
                <div className="mt-1">
                  <CellRenderer
                    column={previewColumn}
                    value={previewValue}
                    rowData={{}}
                    onChange={setPreviewValue}
                    rowLabel={t('myWorkTable.addColumnDialog.preview', 'Preview')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fields created this session — each with a real, working Undo
              wired to the same delete-column command as the rest of the
              table (see `onUndo`). This is scoped, honest recovery: it does
              not claim the global Undo/Redo toolbar buttons cover schema
              changes (they don't — they undo row edits), it just makes sure
              whatever you just did here is trivially reversible. */}
          {sessionAdded.length > 0 && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-c-text-secondary mb-1">
                {t('myWorkTable.addColumnDialog.addedThisSession', 'Added this session')}
              </label>
              <ul className="space-y-1">
                {sessionAdded.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center justify-between gap-2 rounded-lg bg-c-surface-raised px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 truncate text-[11px] text-c-text">
                      <Check size={11} className="flex-shrink-0 text-emerald-500" />
                      <span className="truncate">{f.header}</span>
                      <span className="text-[9px] text-c-text-muted">
                        ({isPl ? getPropertySpec(f.type).label.pl : getPropertySpec(f.type).label.en})
                      </span>
                    </span>
                    {onUndo && (
                      <button
                        onClick={() => handleUndoField(f.key)}
                        className="inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-c-text-secondary hover:bg-c-surface hover:text-c-text transition-colors"
                      >
                        <Undo2 size={10} />
                        {t('myWorkTable.addColumnDialog.undo', 'Undo')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle">
          <button
            onClick={handleDialogClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {sessionAdded.length > 0
              ? t('myWorkTable.addColumnDialog.done', 'Done')
              : t('myWorkTable.addColumnDialog.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!trimmedName}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-40"
          >
            {sessionAdded.length > 0
              ? t('myWorkTable.addColumnDialog.addAnother', 'Create field & add another')
              : t('myWorkTable.addColumnDialog.addColumn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddColumnDialog;

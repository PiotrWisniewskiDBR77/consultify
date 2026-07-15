/**
 * AddColumnDialog — Column creation dialog with grouped type selector
 * and type-specific configuration panels driven by PropertyRegistry.
 */
import {
  AlertCircle,
  Calculator,
  Calendar,
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
  User,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
}

export const AddColumnDialog: React.FC<AddColumnDialogProps> = ({
  open,
  onClose,
  onAdd,
  existingKeys,
  tableId,
  tableFields = [],
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
  }, []);

  const spec = getPropertySpec(type);

  const handleAdd = useCallback(() => {
    const key =
      name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '') || `col_${Date.now()}`;
    if (existingKeys.includes(key)) return;

    const optionsList = options
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    const col: ColumnDef = {
      key,
      header: name.trim() || key,
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
    };

    onAdd(col);
    reset();
    onClose();
  }, [
    aiPrompt,
    existingKeys,
    formula,
    name,
    onAdd,
    onClose,
    options,
    relationTarget,
    rollupSource,
    rollupFunction,
    reset,
    spec.defaultWidth,
    type,
  ]);

  if (!open) return null;

  const groups = getPropertyGroups();

  return (
    <div className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[480px] max-h-[85vh] overflow-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border-subtle">
          <h3 className="text-sm font-bold text-c-text">
            {t('myWorkTable.addColumnDialog.addColumn')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-c-surface-raised transition-colors"
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('myWorkTable.addColumnDialog.eGStatusPriority')}
              className="w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-xs text-c-text outline-none focus:ring-2 focus:ring-blue-500/30"
              autoFocus
            />
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
                              ? 'bg-c-accent-soft text-c-accent ring-1 ring-c-focus'
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-c-border-subtle">
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('myWorkTable.addColumnDialog.cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-c-text text-c-bg hover:bg-c-text-secondary transition-colors disabled:opacity-40"
          >
            {t('myWorkTable.addColumnDialog.addColumn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddColumnDialog;

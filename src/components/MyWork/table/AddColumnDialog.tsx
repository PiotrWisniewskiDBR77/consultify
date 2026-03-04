/**
 * AddColumnDialog — Column creation dialog with type selector.
 * Supports all ColumnTypes with type-specific configuration.
 */
import {
  Calculator,
  Calendar,
  Check,
  CheckSquare,
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
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, ColumnType } from './tableTypes';
import { COLUMN_TYPE_LABELS, DEFAULT_COLUMN_WIDTH, SELECT_COLORS } from './tableTypes';

const TYPE_ICONS: Record<ColumnType, React.ComponentType<{ size?: number; className?: string }>> = {
  text: Type,
  number: Hash,
  select: List,
  multiselect: ListChecks,
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
};

interface AddColumnDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (column: ColumnDef) => void;
  existingKeys: string[];
}

export const AddColumnDialog: React.FC<AddColumnDialogProps> = ({
  open,
  onClose,
  onAdd,
  existingKeys,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [options, setOptions] = useState('');
  const [formula, setFormula] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');

  const reset = useCallback(() => {
    setName('');
    setType('text');
    setOptions('');
    setFormula('');
    setAiPrompt('');
  }, []);

  const handleAdd = useCallback(() => {
    const key = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || `col_${Date.now()}`;
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
      width: DEFAULT_COLUMN_WIDTH,
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
      ...(type === 'formula' ? { formula: formula || '{col1} + {col2}' } : {}),
      ...(type === 'ai_generated' ? { aiPrompt: aiPrompt || 'Analyze this row' } : {}),
    };

    onAdd(col);
    reset();
    onClose();
  }, [aiPrompt, existingKeys, formula, name, onAdd, onClose, options, reset, type]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[440px] max-h-[80vh] overflow-auto rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {isPl ? 'Dodaj kolumnę' : 'Add Column'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              {isPl ? 'Nazwa' : 'Name'}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isPl ? 'np. Status, Priorytet...' : 'e.g. Status, Priority...'}
              className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30"
              autoFocus
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isPl ? 'Typ' : 'Type'}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(COLUMN_TYPE_LABELS) as ColumnType[]).map((t) => {
                const Icon = TYPE_ICONS[t];
                const label = isPl ? COLUMN_TYPE_LABELS[t].pl : COLUMN_TYPE_LABELS[t].en;
                const isActive = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type-specific config */}
          {(type === 'select' || type === 'multiselect') && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {isPl ? 'Opcje (oddzielone przecinkiem)' : 'Options (comma-separated)'}
              </label>
              <input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
          )}

          {type === 'formula' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {isPl ? 'Formuła' : 'Formula'}
              </label>
              <input
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="{impact} * {effort}"
                className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              <p className="mt-1 text-[9px] text-slate-400">
                {isPl ? 'Użyj {nazwa_kolumny} aby odwołać się do wartości' : 'Use {column_key} to reference values'}
              </p>
            </div>
          )}

          {type === 'ai_generated' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                {isPl ? 'Prompt AI' : 'AI Prompt'}
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={isPl ? 'Oceń ryzyko na podstawie kontekstu firmy...' : 'Assess risk based on company context...'}
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60">
          <button
            onClick={() => { reset(); onClose(); }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            {isPl ? 'Dodaj kolumnę' : 'Add Column'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddColumnDialog;

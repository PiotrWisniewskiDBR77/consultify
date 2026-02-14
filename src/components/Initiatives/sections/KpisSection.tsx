/**
 * KpisSection - API-backed KPI table for initiative benefits tracking
 */

import { motion } from 'framer-motion';
import { Copy, Edit3, MoreVertical, Plus, Trash2, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { InlineTable } from '@/components/shared/NModeBlocks';
import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

interface KPI {
  id: string;
  name: string;
  category?: string;
  unit: string;
  baseline: string;
  target: string;
  current: string;
  status?: string;
  isOnTarget?: boolean;
}

const parseNumber = (value: string): number => {
  const normalized = String(value || '')
    .replace(',', '.')
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMetric = (value?: string, unit?: string): string => {
  const base = value && value.trim() ? value.trim() : '—';
  return unit && base !== '—' ? `${base} ${unit}` : base;
};

const KPI_NAME_EN_MAP: Record<string, string> = {
  'Skrócenie czasu changeover': 'Changeover time reduction',
  'Redukcja odpadów rozruchowych': 'Startup scrap reduction',
  'OEE po changeover': 'Post-changeover OEE',
};

const toEnglishKpiName = (name: string, isPolish: boolean): string => {
  if (isPolish) return name;
  return KPI_NAME_EN_MAP[name] || name;
};

export const KpisSection: React.FC<InitiativeSectionProps> = ({ expanded, onToggle, readonly }) => {
  const { initiativeId, isPolish } = useInitiativeContext();

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newBaseline, setNewBaseline] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [kpiMenuId, setKpiMenuId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editBaseline, setEditBaseline] = useState('');
  const [editCurrent, setEditCurrent] = useState('');
  const [editTarget, setEditTarget] = useState('');

  const loadKpis = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    try {
      const res = await Api.get(`/initiatives/${initiativeId}/kpis`);
      const rows = Array.isArray(res?.kpis) ? res.kpis : [];
      setKpis(
        rows.map((k: any, idx: number) => ({
          id: String(k.id || `kpi-${idx}`),
          name: String(k.name || ''),
          category: String(k.category || 'benefits'),
          unit: String(k.unit || ''),
          baseline: String(k.baselineValue ?? k.baseline ?? ''),
          target: String(k.targetValue ?? k.target ?? ''),
          current: String(k.currentValue ?? k.latestValue ?? k.baselineValue ?? ''),
          status: String(k.status || ''),
          isOnTarget: Boolean(k.isOnTarget),
        }))
      );
    } catch {
      setKpis([]);
      toast.error(isPolish ? 'Nie udało się pobrać KPI' : 'Failed to load KPIs');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId, isPolish]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  useEffect(() => {
    if (!kpiMenuId) return;
    const onDocClick = () => setKpiMenuId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [kpiMenuId]);

  const resetCreateForm = useCallback(() => {
    setNewName('');
    setNewUnit('');
    setNewBaseline('');
    setNewTarget('');
    setShowAdd(false);
  }, []);

  const addKpi = useCallback(async () => {
    const name = newName.trim();
    const unit = newUnit.trim();
    if (!name || !unit || !initiativeId) return;

    const baselineValue = parseNumber(newBaseline);
    const targetValue = parseNumber(newTarget);
    if (baselineValue === targetValue) {
      toast.error(
        isPolish ? 'Target musi być różny od baseline' : 'Target must be different from baseline'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
        name,
        description: null,
        category: 'benefits',
        unit,
        baselineValue,
        targetValue,
        measurementFrequency: 'monthly',
      });

      const created = res?.kpi || {};
      setKpis((prev) => [
        {
          id: String(created.id || `kpi-${Date.now()}`),
          name: String(created.name || name),
          category: String(created.category || 'benefits'),
          unit: String(created.unit || unit),
          baseline: String(created.baselineValue ?? baselineValue),
          target: String(created.targetValue ?? targetValue),
          current: String(created.currentValue ?? baselineValue),
          status: String(created.status || 'on_track'),
          isOnTarget:
            created.isOnTarget !== undefined
              ? Boolean(created.isOnTarget)
              : Number(created.currentValue ?? baselineValue) >=
                Number(created.targetValue ?? targetValue),
        },
        ...prev,
      ]);
      resetCreateForm();
      toast.success(isPolish ? 'KPI dodane' : 'KPI created');
    } catch (e: any) {
      toast.error(e?.message || (isPolish ? 'Nie udało się dodać KPI' : 'Failed to create KPI'));
    } finally {
      setIsSubmitting(false);
    }
  }, [initiativeId, isPolish, newBaseline, newName, newTarget, newUnit, resetCreateForm]);

  const startEditKpi = useCallback((kpi: KPI) => {
    setEditingKpiId(kpi.id);
    setEditName(kpi.name || '');
    setEditUnit(kpi.unit || '');
    setEditBaseline(kpi.baseline || '');
    setEditCurrent(kpi.current || '');
    setEditTarget(kpi.target || '');
  }, []);

  const cancelEditKpi = useCallback(() => {
    setEditingKpiId(null);
    setEditName('');
    setEditUnit('');
    setEditBaseline('');
    setEditCurrent('');
    setEditTarget('');
  }, []);

  const saveEditedKpi = useCallback(() => {
    if (!editingKpiId || !editName.trim() || !editUnit.trim()) return;
    setKpis((prev) =>
      prev.map((k) =>
        k.id === editingKpiId
          ? {
              ...k,
              name: editName.trim(),
              unit: editUnit.trim(),
              baseline: editBaseline.trim(),
              current: editCurrent.trim(),
              target: editTarget.trim(),
            }
          : k
      )
    );
    toast.success(isPolish ? 'KPI zaktualizowane' : 'KPI updated');
    cancelEditKpi();
  }, [
    cancelEditKpi,
    editBaseline,
    editCurrent,
    editName,
    editTarget,
    editUnit,
    editingKpiId,
    isPolish,
  ]);

  const duplicateKpi = useCallback(
    async (kpi: KPI) => {
      if (!initiativeId) return;
      setIsSubmitting(true);
      try {
        const baselineValue = parseNumber(kpi.baseline);
        const targetValue = parseNumber(kpi.target);
        const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
          name: `${kpi.name} (${isPolish ? 'kopia' : 'copy'})`,
          description: null,
          category: kpi.category || 'benefits',
          unit: kpi.unit || '%',
          baselineValue,
          targetValue,
          measurementFrequency: 'monthly',
        });

        const created = res?.kpi || {};
        setKpis((prev) => [
          {
            id: String(created.id || `kpi-${Date.now()}`),
            name: String(created.name || `${kpi.name} (${isPolish ? 'kopia' : 'copy'})`),
            category: String(created.category || 'benefits'),
            unit: String(created.unit || kpi.unit || '%'),
            baseline: String(created.baselineValue ?? baselineValue),
            target: String(created.targetValue ?? targetValue),
            current: String(created.currentValue ?? baselineValue),
            status: String(created.status || 'on_track'),
            isOnTarget:
              created.isOnTarget !== undefined
                ? Boolean(created.isOnTarget)
                : Number(created.currentValue ?? baselineValue) >=
                  Number(created.targetValue ?? targetValue),
          },
          ...prev,
        ]);
        toast.success(isPolish ? 'KPI zduplikowane' : 'KPI duplicated');
      } catch (e: any) {
        toast.error(
          e?.message || (isPolish ? 'Nie udało się zduplikować KPI' : 'Failed to duplicate KPI')
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [initiativeId, isPolish]
  );

  const removeKpi = useCallback(
    (id: string) => {
      setKpis((prev) => prev.filter((k) => k.id !== id));
      if (editingKpiId === id) cancelEditKpi();
      toast.success(isPolish ? 'KPI usunięte' : 'KPI deleted');
    },
    [cancelEditKpi, editingKpiId, isPolish]
  );

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: isPolish ? 'KPI' : 'KPI',
        render: (row: KPI) => (
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {toEnglishKpiName(row.name || '—', isPolish)}
          </span>
        ),
      },
      {
        key: 'unit',
        header: isPolish ? 'Jednostka' : 'Unit',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">{row.unit || '—'}</span>
        ),
      },
      {
        key: 'baseline',
        header: 'Baseline',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatMetric(row.baseline, row.unit)}
          </span>
        ),
      },
      {
        key: 'current',
        header: isPolish ? 'Obecnie' : 'Current',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatMetric(row.current, row.unit)}
          </span>
        ),
      },
      {
        key: 'target',
        header: 'Target',
        render: (row: KPI) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatMetric(row.target, row.unit)}
          </span>
        ),
      },
      {
        key: 'tracking',
        header: isPolish ? 'Tracking' : 'Tracking',
        align: 'right' as const,
        render: (row: KPI) => (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
              row.isOnTarget
                ? 'border-emerald-300/50 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-300/50 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
          >
            {row.isOnTarget
              ? isPolish
                ? 'On track'
                : 'On track'
              : isPolish
                ? 'Do poprawy'
                : 'Needs attention'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right' as const,
        render: (row: KPI) =>
          readonly ? null : (
            <div className="relative inline-flex">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setKpiMenuId((prev) => (prev === row.id ? null : row.id));
                }}
                className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-navy-700/60 transition-colors"
                title={isPolish ? 'Akcje KPI' : 'KPI actions'}
              >
                <MoreVertical size={14} />
              </button>
              {kpiMenuId === row.id && (
                <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                  <button
                    onClick={() => {
                      setKpiMenuId(null);
                      startEditKpi(row);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Edit3 size={13} />
                    {isPolish ? 'Edytuj' : 'Edit'}
                  </button>
                  <button
                    onClick={() => {
                      setKpiMenuId(null);
                      void duplicateKpi(row);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                  >
                    <Copy size={13} />
                    {isPolish ? 'Duplikuj' : 'Duplicate'}
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-navy-700/50" />
                  <button
                    onClick={() => {
                      setKpiMenuId(null);
                      const ok = window.confirm(isPolish ? 'Usunąć to KPI?' : 'Delete this KPI?');
                      if (ok) removeKpi(row.id);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={13} />
                    {isPolish ? 'Usuń' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ),
      },
    ],
    [duplicateKpi, isPolish, kpiMenuId, readonly, removeKpi, startEditKpi]
  );

  return (
    <CollapsibleSection
      id="kpis"
      title={isPolish ? 'KPI i korzyści' : 'KPIs & Benefits'}
      icon={<TrendingUp size={18} className="text-cyan-500 dark:text-cyan-400" />}
      iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        kpis.length > 0 ? <span className="text-xs text-slate-400">{kpis.length}</span> : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          {!readonly && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowAdd(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 text-xs font-medium transition-colors"
            >
              <Plus size={14} />
              <span>{isPolish ? 'Nowy' : 'New'}</span>
            </motion.button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {showAdd && !readonly && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border border-cyan-300/70 dark:border-cyan-500/50 bg-cyan-50/30 dark:bg-cyan-500/5 space-y-3"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isPolish ? 'Nazwa KPI...' : 'KPI name...'}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              autoFocus
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder={isPolish ? 'Jednostka' : 'Unit'}
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
              <input
                type="text"
                value={newBaseline}
                onChange={(e) => setNewBaseline(e.target.value)}
                placeholder="Baseline"
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
              <input
                type="text"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="Target"
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={resetCreateForm}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={() => void addKpi()}
                disabled={!newName.trim() || !newUnit.trim() || isSubmitting}
                className="px-3 py-1.5 text-xs bg-cyan-500 text-white rounded-lg disabled:opacity-50 hover:bg-cyan-600 transition-colors"
              >
                {isSubmitting
                  ? isPolish
                    ? 'Dodawanie...'
                    : 'Adding...'
                  : isPolish
                    ? 'Dodaj KPI'
                    : 'Add KPI'}
              </button>
            </div>
          </motion.div>
        )}

        {editingKpiId && !readonly && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border border-indigo-300/70 dark:border-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-500/5 space-y-3"
          >
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={isPolish ? 'Nazwa KPI...' : 'KPI name...'}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                placeholder={isPolish ? 'Jednostka' : 'Unit'}
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
              <input
                type="text"
                value={editBaseline}
                onChange={(e) => setEditBaseline(e.target.value)}
                placeholder="Baseline"
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
              <input
                type="text"
                value={editCurrent}
                onChange={(e) => setEditCurrent(e.target.value)}
                placeholder={isPolish ? 'Obecnie' : 'Current'}
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
              <input
                type="text"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                placeholder="Target"
                className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelEditKpi}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={saveEditedKpi}
                disabled={!editName.trim() || !editUnit.trim()}
                className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-600 transition-colors"
              >
                {isPolish ? 'Zapisz' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}

        {!isLoading && kpis.length === 0 ? (
          <EmptyStateInline
            icon={TrendingUp}
            message={isPolish ? 'Brak zdefiniowanych KPI' : 'No KPIs defined yet'}
            hint={
              isPolish
                ? 'Dodaj pierwszy KPI dla tej inicjatywy.'
                : 'Add your first KPI for this initiative.'
            }
            action={
              readonly
                ? undefined
                : {
                    label: isPolish ? 'Nowy KPI' : 'New KPI',
                    onClick: () => setShowAdd(true),
                  }
            }
          />
        ) : (
          <InlineTable<KPI>
            columns={columns}
            data={kpis}
            rowKey={(row) => row.id}
            compact
            striped
            emptyMessage={isPolish ? 'Brak KPI' : 'No KPIs'}
          />
        )}
      </div>
    </CollapsibleSection>
  );
};

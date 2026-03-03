import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  type FinanceKind,
  type FinanceRow,
  type FinanceModelRow,
  type FinanceStatus,
  type PredictionType,
  normalizeModelStatus,
  normalizeStatus,
} from '../financeTypes';
import { type FilterChip, type ModuleTab } from '../../shared/ModuleHub';

export function useFinanceData(activeTab: ModuleTab, searchQuery: string, activeFilters: FilterChip[]) {
  const { t } = useTranslation();

  const [models, setModels] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState<FinanceKind | null>('models');

  const loadModels = useCallback(async () => {
    const data = await Api.get('/api/financial-modeling/models');
    setModels(Array.isArray(data) ? data : []);
  }, []);

  const loadAnalyses = useCallback(async () => {
    const data = await Api.get('/api/economics/financial-analyses');
    setAnalyses(Array.isArray((data as any)?.analyses) ? (data as any).analyses : []);
  }, []);

  const loadValuations = useCallback(async () => {
    const data = await Api.get('/api/economics/valuations');
    setValuations(Array.isArray((data as any)?.valuations) ? (data as any).valuations : []);
  }, []);

  const loadBudgets = useCallback(async () => {
    const data = await Api.get('/api/economics/budgets');
    setBudgets(Array.isArray((data as any)?.budgets) ? (data as any).budgets : []);
  }, []);

  useEffect(() => {
    const kind: FinanceKind =
      activeTab === 'models' ? 'models'
        : activeTab === 'analysis' ? 'analysis'
          : activeTab === 'prediction' ? 'prediction'
            : 'valuation';

    let cancelled = false;
    const run = async () => {
      setLoadingTab(kind);
      try {
        if (kind === 'models') await loadModels();
        else if (kind === 'prediction') await Promise.all([loadModels(), loadBudgets()]);
        else if (kind === 'analysis') await loadAnalyses();
        else if (kind === 'valuation') await loadValuations();
      } catch (e) {
        console.error('[FinanceHub] Failed to load:', e);
        toast.error(t('common.loadFailed', 'Failed to load'));
      } finally {
        if (!cancelled) setLoadingTab(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeTab, loadModels, loadAnalyses, loadValuations, loadBudgets, t]);

  const rowsForActiveTab: FinanceRow[] = useMemo(() => {
    if (activeTab === 'models') {
      return (models || []).map((m: any) => ({
        id: String(m.id),
        title: String(m.name || t('common.untitled', 'Untitled')),
        kind: 'models' as const,
        predictionType: 'model' as PredictionType,
        status: normalizeModelStatus(m.status),
        scenario: String(m.scenario || 'base'),
        currency: String(m.currency || 'PLN'),
        horizonMonths: Number(m.horizon_months || 0),
        startDate: String(m.start_date || ''),
        updatedAt: String(m.updated_at || m.created_at || new Date().toISOString()),
      }));
    }
    if (activeTab === 'prediction') {
      const modelRows: FinanceModelRow[] = (models || []).map((m: any) => ({
        id: String(m.id),
        title: String(m.name || t('common.untitled', 'Untitled')),
        kind: 'prediction' as const,
        predictionType: 'model' as PredictionType,
        status: normalizeModelStatus(m.status),
        scenario: String(m.scenario || 'base'),
        currency: String(m.currency || 'PLN'),
        horizonMonths: Number(m.horizon_months || 0),
        startDate: String(m.start_date || ''),
        updatedAt: String(m.updated_at || m.created_at || new Date().toISOString()),
      }));
      const budgetRows: FinanceModelRow[] = (budgets || []).map((b: any) => ({
        id: `budget-${b.id}`,
        title: String(b.title || t('common.untitled', 'Untitled')),
        kind: 'prediction' as const,
        predictionType: 'budget' as PredictionType,
        status: normalizeStatus(b.status),
        scenario: 'base/opt/cons',
        currency: String(b.currency || 'PLN'),
        horizonMonths: 0,
        startDate: String(b.periodStart || b.period_start || ''),
        periodStart: String(b.periodStart || b.period_start || ''),
        periodEnd: String(b.periodEnd || b.period_end || ''),
        granularity: String(b.granularity || 'monthly'),
        updatedAt: String(b.updatedAt || b.updated_at || b.createdAt || b.created_at || new Date().toISOString()),
      }));
      return [...modelRows, ...budgetRows];
    }
    if (activeTab === 'analysis') {
      return (analyses || []).map((a: any) => ({
        id: String(a.id),
        title: String(a.title || t('common.untitled', 'Untitled')),
        kind: 'analysis' as const,
        status: normalizeStatus(a.status),
        analysisType: String(a.analysisType || a.analysis_type || 'comprehensive'),
        currency: String(a.currency || 'PLN'),
        periodCount: Array.isArray(a.periods) ? a.periods.length : 0,
        updatedAt: String(a.updatedAt || a.updated_at || a.createdAt || a.created_at || new Date().toISOString()),
      }));
    }
    return (valuations || []).map((v: any) => ({
      id: String(v.id),
      title: String(v.title || t('common.untitled', 'Untitled')),
      kind: 'valuation' as const,
      status: normalizeStatus(v.status),
      sourceType: String(v.sourceType || v.source_type || 'manual'),
      method: String(v.method || 'DCF'),
      currency: String(v.currency || 'PLN'),
      horizonYears: Number(v.horizonYears ?? v.horizon_years ?? 5),
      updatedAt: String(v.updatedAt || v.updated_at || new Date().toISOString()),
    }));
  }, [activeTab, models, analyses, valuations, budgets, t]);

  const filteredRows = useMemo(() => {
    let rows = rowsForActiveTab;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }
    const statusFilterValues = activeFilters.filter((f) => f.column === 'status').map((f) => f.value);
    if (statusFilterValues.length) {
      rows = rows.filter((r) => statusFilterValues.includes(r.status));
    }
    return rows;
  }, [rowsForActiveTab, searchQuery, activeFilters]);

  const statusCounts = useMemo(() => {
    const counts: Record<FinanceStatus, number> = { DRAFT: 0, REVIEW: 0, APPROVED: 0 };
    rowsForActiveTab.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [rowsForActiveTab]);

  return {
    models, analyses, valuations, budgets, loadingTab,
    loadModels, loadAnalyses, loadValuations, loadBudgets,
    rowsForActiveTab, filteredRows, statusCounts,
  };
}

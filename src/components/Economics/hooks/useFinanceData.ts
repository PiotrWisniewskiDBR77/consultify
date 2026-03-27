import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api, shouldAllowDemoData } from '@/services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';

import { type FilterChip, type ModuleTab } from '../../shared/ModuleHub';
import {
  deriveStatementReadinessStatus,
  type FinanceKind,
  type FinanceStatementRow,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceStatus,
  isWorkableStatement,
  normalizeModelStatus,
  normalizeStatus,
  type PredictionType,
} from '../financeTypes';

const DEMO_STATEMENTS = [
  { id: 'demo-s1', entity_name: 'Atelier Sp. z o.o.', period_label: 'FY 2025', period_start: '2025-01-01', period_end: '2025-12-31', currency: 'PLN', scaling: 'thousands', pack_readiness_status: 'ready', pack_status: 'validated', pl_count: 1, bs_count: 1, cf_count: 1, source_statement_count: 3, updated_at: '2026-03-10T14:00:00Z', statements: [] },
  { id: 'demo-s2', entity_name: 'Atelier Sp. z o.o.', period_label: 'H1 2025', period_start: '2025-01-01', period_end: '2025-06-30', currency: 'PLN', scaling: 'thousands', pack_readiness_status: 'ready', pack_status: 'validated', pl_count: 1, bs_count: 1, cf_count: 0, source_statement_count: 2, updated_at: '2026-02-15T10:00:00Z', statements: [] },
  { id: 'demo-s3', entity_name: 'NovaTech GmbH', period_label: 'FY 2025', period_start: '2025-01-01', period_end: '2025-12-31', currency: 'EUR', scaling: 'thousands', pack_readiness_status: 'recoverable', pack_status: 'pending', pl_count: 1, bs_count: 0, cf_count: 0, source_statement_count: 1, updated_at: '2026-03-14T09:00:00Z', statements: [] },
  { id: 'demo-s4', entity_name: 'GreenField Inc.', period_label: 'Q4 2025', period_start: '2025-10-01', period_end: '2025-12-31', currency: 'USD', scaling: 'units', pack_readiness_status: 'pending', pack_status: 'draft', pl_count: 1, bs_count: 1, cf_count: 1, source_statement_count: 3, updated_at: '2026-03-16T11:00:00Z', statements: [] },
];

const DEMO_MODELS = [
  { id: 'demo-m1', name: 'Atelier - FY26-FY28 Revenue & Margin Forecast', scenario: 'base', currency: 'PLN', horizon_months: 36, start_date: '2026-01-01', status: 'approved', source_statement_pack_id: 'demo-s1', updated_at: '2026-03-12T10:00:00Z' },
  { id: 'demo-m2', name: 'Atelier - FY26-FY28 Working Capital Forecast', scenario: 'base', currency: 'PLN', horizon_months: 36, start_date: '2026-01-01', status: 'review', source_statement_pack_id: 'demo-s1', updated_at: '2026-03-14T14:00:00Z' },
  { id: 'demo-m3', name: 'NovaTech - FY26-FY28 Cash Protection Forecast', scenario: 'base', currency: 'EUR', horizon_months: 36, start_date: '2026-04-01', status: 'draft', updated_at: '2026-03-15T16:00:00Z' },
];

const DEMO_ANALYSES = [
  { id: 'demo-a1', title: 'Atelier FY 2025 – Comprehensive Analysis', analysisType: 'comprehensive', currency: 'PLN', status: 'approved', periods: [1, 2, 3, 4], updatedAt: '2026-03-11T10:00:00Z' },
  { id: 'demo-a2', title: 'Cloud Migration – Investment Case', analysisType: 'investment_case', currency: 'PLN', status: 'review', periods: [1, 2, 3], updatedAt: '2026-03-13T14:00:00Z' },
  { id: 'demo-a3', title: 'NovaTech Acquisition – Due Diligence', analysisType: 'comprehensive', currency: 'EUR', status: 'draft', periods: [1, 2], updatedAt: '2026-03-16T09:00:00Z' },
];

const DEMO_VALUATIONS = [
  { id: 'demo-v1', title: 'Atelier – DCF Valuation 2026', sourceType: 'financial_model', method: 'DCF', currency: 'PLN', horizonYears: 5, status: 'approved', updatedAt: '2026-03-10T12:00:00Z' },
  { id: 'demo-v2', title: 'NovaTech – Comparable Analysis', sourceType: 'financial_analysis', method: 'Comparables', currency: 'EUR', horizonYears: 3, status: 'draft', updatedAt: '2026-03-15T15:00:00Z' },
];

const DEMO_BUDGETS = [
  { id: 'demo-b1', title: 'Atelier – Budget 2026', currency: 'PLN', status: 'approved', periodStart: '2026-01-01', periodEnd: '2026-12-31', granularity: 'monthly', updatedAt: '2026-03-01T10:00:00Z' },
  { id: 'demo-b2', title: 'Marketing Campaign – Q2 2026', currency: 'PLN', status: 'draft', periodStart: '2026-04-01', periodEnd: '2026-06-30', granularity: 'monthly', updatedAt: '2026-03-14T08:00:00Z' },
];

function isInvestmentAnalysisType(value: unknown): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return (
    normalized === 'financial' ||
    normalized === 'investment_case' ||
    normalized === 'investment' ||
    normalized === 'capex' ||
    normalized.includes('investment') ||
    normalized.includes('capex')
  );
}

export function useFinanceData(
  activeTab: ModuleTab,
  searchQuery: string,
  activeFilters: FilterChip[]
) {
  const { t } = useTranslation();

  const [models, setModels] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState<FinanceKind | null>('models');
  const allowDemoData = shouldAllowDemoData();
  const [isUsingDemoData, setIsUsingDemoData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStatements = useCallback(async () => {
    try {
      const data = await Api.get('/api/finance-statements/packs');
      const arr = Array.isArray(data) ? data : [];
      setLoadError(null);
      setIsUsingDemoData(false);
      setStatements(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.statementsRealSourceFailed',
          'Failed to load real finance statements from the active data source.'
        )
      );
      setIsUsingDemoData(false);
      setStatements([]);
    }
  }, [t]);

  const loadModels = useCallback(async () => {
    try {
      let arr: any[] = [];
      try {
        const data = await V8FinanceApi.getModels();
        arr = Array.isArray(data?.models) ? data.models : [];
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        const data = await Api.get('/api/financial-modeling/models');
        arr = Array.isArray(data) ? data : [];
      }
      setLoadError(null);
      setIsUsingDemoData(false);
      setModels(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.modelsRealSourceFailed',
          'Failed to load real finance models from the active data source.'
        )
      );
      setIsUsingDemoData(false);
      setModels([]);
    }
  }, [t]);

  const loadAnalyses = useCallback(async () => {
    try {
      let arr: any[] = [];
      try {
        const data = await V8FinanceApi.getAnalyses();
        arr = Array.isArray(data?.analyses) ? data.analyses : [];
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        const data = await Api.get('/api/economics/financial-analyses');
        arr = Array.isArray((data as any)?.analyses) ? (data as any).analyses : [];
      }
      setLoadError(null);
      setIsUsingDemoData(false);
      setAnalyses(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.analysesRealSourceFailed',
          'Failed to load real financial analyses from the active data source.'
        )
      );
      setIsUsingDemoData(false);
      setAnalyses([]);
    }
  }, [t]);

  const loadValuations = useCallback(async () => {
    try {
      let arr: any[] = [];
      try {
        const data = await V8FinanceApi.getValuations();
        arr = Array.isArray(data?.valuations) ? data.valuations : [];
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        const data = await Api.get('/api/economics/valuations');
        arr = Array.isArray((data as any)?.valuations) ? (data as any).valuations : [];
      }
      setLoadError(null);
      setIsUsingDemoData(false);
      setValuations(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.valuationsRealSourceFailed',
          'Failed to load real valuations from the active data source.'
        )
      );
      setIsUsingDemoData(false);
      setValuations([]);
    }
  }, [t]);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await Api.get('/api/economics/budgets');
      const arr = Array.isArray((data as any)?.budgets) ? (data as any).budgets : [];
      setLoadError(null);
      setIsUsingDemoData(false);
      setBudgets(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.budgetsRealSourceFailed',
          'Failed to load real budgets from the active data source.'
        )
      );
      setIsUsingDemoData(false);
      setBudgets([]);
    }
  }, [t]);

  useEffect(() => {
    const kind: FinanceKind =
      activeTab === 'statements'
        ? 'statements'
        : activeTab === 'models'
        ? 'models'
        : activeTab === 'analysis'
          ? 'analysis'
          : activeTab === 'investment'
            ? 'investment'
          : activeTab === 'prediction'
            ? 'prediction'
            : 'valuation';

    let cancelled = false;
    const run = async () => {
      setLoadingTab(kind);
      try {
        if (kind === 'statements') await loadStatements();
        else if (kind === 'models') await Promise.all([loadModels(), loadStatements()]);
        else if (kind === 'prediction') await Promise.all([loadModels(), loadBudgets()]);
        else if (kind === 'analysis' || kind === 'investment') await loadAnalyses();
        else if (kind === 'valuation') await loadValuations();
      } catch (e) {
        console.error('[FinanceHub] Failed to load:', e);
        toast.error(t('common.loadFailed', 'Failed to load'));
      } finally {
        if (!cancelled) setLoadingTab(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadStatements, loadModels, loadAnalyses, loadValuations, loadBudgets, t]);

  const rowsForActiveTab: FinanceRow[] = useMemo(() => {
    if (activeTab === 'statements') {
      return (statements || [])
        .map((s: any): FinanceStatementRow => {
          const rawStatus = String(s.pack_status || s.status || 'draft');
          const validationStatus = String(s.validation_status || 'pending');
          const readinessStatus = String(s.pack_readiness_status || s.readiness_status || 'pending');
          const childStatements = Array.isArray(s.statements)
            ? s.statements.map((statement: any) => ({
                id: String(statement.id),
                statementType: String(statement.statement_type || ''),
                rawStatus: String(statement.status || 'draft'),
                readinessStatus: String(statement.readiness_status || 'pending'),
                readinessScore: Number(statement.readiness_score ?? 0),
                validationStatus: String(statement.validation_status || 'pending'),
                mappedLineCount: Number(statement.mapped_line_count ?? 0),
                totalLineCount: Number(statement.total_line_count ?? 0),
                unmappedLineCount: Number(statement.unmapped_line_count ?? 0),
                sourceFileName: String(statement.source_file_name || ''),
                updatedAt: String(statement.updated_at || statement.created_at || ''),
              }))
            : [];
          const presentTypes = new Set<string>();
          if (Number(s.pl_count ?? 0) > 0) presentTypes.add('P&L');
          if (Number(s.bs_count ?? 0) > 0) presentTypes.add('BS');
          if (Number(s.cf_count ?? 0) > 0) presentTypes.add('CF');
          for (const statement of childStatements) {
            if (statement.statementType) presentTypes.add(statement.statementType);
          }
          const mappedLineCount = childStatements.reduce(
            (sum: number, statement: any) => sum + Number(statement.mappedLineCount || 0),
            0
          );
          const unmappedLineCount = childStatements.reduce(
            (sum: number, statement: any) => sum + Number(statement.unmappedLineCount || 0),
            0
          );
          const totalLineCount = Number(s.total_line_count ?? mappedLineCount + unmappedLineCount);
          const effectiveReadiness = String(readinessStatus || 'pending').toLowerCase();
          let readinessReasonCodes: string[] = [];
          try {
            readinessReasonCodes = Array.isArray(s.pack_quality_reason_codes)
              ? s.pack_quality_reason_codes.map((code: unknown) => String(code))
              : typeof s.pack_quality_reason_codes === 'string' &&
                  s.pack_quality_reason_codes.trim().startsWith('[')
                ? JSON.parse(s.pack_quality_reason_codes).map((code: unknown) => String(code))
                : [];
          } catch {
            readinessReasonCodes = [];
          }
          let missingStatementTypes: string[] = [];
          try {
            missingStatementTypes = Array.isArray(s.missing_statement_types)
              ? s.missing_statement_types.map((type: unknown) => String(type))
              : typeof s.missing_statement_types === 'string' &&
                  s.missing_statement_types.trim().startsWith('[')
                ? JSON.parse(s.missing_statement_types).map((type: unknown) => String(type))
                : [];
          } catch {
            missingStatementTypes = [];
          }
          const completenessLabel = ['P&L', 'BS', 'CF']
            .map((type) => (presentTypes.has(type) ? type : `—${type}`))
            .join(' / ');
          return {
            id: String(s.id),
            title: String(
              s.entity_name || s.period_label || `${t('finance.pack.titleFallback', 'Statement Pack')} ${s.period_end || ''}`
            ),
            kind: 'statements',
            status:
              effectiveReadiness === 'ready'
                ? 'APPROVED'
                : effectiveReadiness === 'recoverable'
                  ? 'REVIEW'
                  : 'DRAFT',
            statementType: 'PACK',
            statementPackId: String(s.id),
            entityName: String(s.entity_name || ''),
            periodStart: String(s.period_start || ''),
            periodEnd: String(s.period_end || ''),
            periodLabel: String(s.period_label || ''),
            currency: String(s.currency || 'PLN'),
            scaling: String(s.scaling || 'units'),
            sourceFileName: childStatements
              .map((statement: any) => statement.sourceFileName)
              .filter(Boolean)
              .join(', '),
            validationStatus,
            mappedLineCount,
            totalLineCount,
            unmappedLineCount,
            sourceStatementCount: Number(
              s.source_statement_count ??
                childStatements.length ??
                Number(s.pl_count ?? 0) + Number(s.bs_count ?? 0) + Number(s.cf_count ?? 0)
            ),
            statementIds: childStatements.map((statement: any) => statement.id),
            missingStatementTypes,
            completenessLabel,
            childStatements,
            nonFinancialLineCount: Number(s.non_financial_line_count ?? 0),
            overallConfidence: Number(s.overall_confidence ?? 0),
            rawStatus,
            readinessStatus: effectiveReadiness,
            readinessScore: Number(s.pack_readiness_score ?? s.readiness_score ?? 0),
            readinessSummary: String(s.pack_quality_summary || s.quality_summary || ''),
            readinessReasonCodes,
            documentClass: String(s.document_class || ''),
            extractionStrategy: String(s.extraction_strategy || ''),
            templateFamily: s.template_family ? String(s.template_family) : null,
            valuesVersion: Number(s.values_version ?? 0),
            isWorkable: effectiveReadiness === 'ready',
            updatedAt: String(s.updated_at || s.created_at || new Date().toISOString()),
          };
        });
    }
    if (activeTab === 'models') {
      return (models || []).map((m: any) => {
        const sourcePack = (statements || []).find(
          (statement: any) => String(statement.id) === String(m.source_statement_pack_id || '')
        );
        const forecastStartYear =
          Number.parseInt(String(m.start_date || '').slice(0, 4), 10) || new Date().getFullYear();
        return {
        id: String(m.id),
        title: String(m.name || t('common.untitled', 'Untitled')),
        kind: 'models' as const,
        predictionType: 'model' as PredictionType,
        status: normalizeModelStatus(m.status),
        scenario: String(m.scenario || 'base'),
        currency: String(m.currency || 'PLN'),
        horizonMonths: Number(m.horizon_months || 0),
        startDate: String(m.start_date || ''),
        sourceStatementId: m.source_statement_id ? String(m.source_statement_id) : undefined,
        sourceStatementPackId: m.source_statement_pack_id
          ? String(m.source_statement_pack_id)
          : undefined,
        seedSourceType: m.source_statement_pack_id
          ? 'statement_pack'
          : m.source_statement_id
            ? 'statement'
            : 'manual',
        sourceDocumentTitle: sourcePack
          ? String(sourcePack.entity_name || sourcePack.period_label || sourcePack.id)
          : m.source_statement_pack_id
            ? t('finance.model.seededFromPack', 'Seeded statement pack')
            : t('finance.model.seededManuallyShort', 'Manual'),
        forecastWindowLabel: `${forecastStartYear}-${forecastStartYear + 2}`,
        variantLabel: 'base / optimistic / conservative',
        analyticalDepthLabel: 'L1-L3',
        updatedAt: String(m.updated_at || m.created_at || new Date().toISOString()),
      };
      });
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
        sourceStatementId: m.source_statement_id ? String(m.source_statement_id) : undefined,
        sourceStatementPackId: m.source_statement_pack_id
          ? String(m.source_statement_pack_id)
          : undefined,
        seedSourceType: m.source_statement_pack_id
          ? 'statement_pack'
          : m.source_statement_id
            ? 'statement'
            : 'manual',
        sourceDocumentTitle: t('finance.model.seededFromPack', 'Seeded statement pack'),
        forecastWindowLabel: `${Number.parseInt(String(m.start_date || '').slice(0, 4), 10) || new Date().getFullYear()}-${(Number.parseInt(String(m.start_date || '').slice(0, 4), 10) || new Date().getFullYear()) + 2}`,
        variantLabel: 'base / optimistic / conservative',
        analyticalDepthLabel: 'L1-L3',
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
        updatedAt: String(
          b.updatedAt || b.updated_at || b.createdAt || b.created_at || new Date().toISOString()
        ),
      }));
      return [...modelRows, ...budgetRows];
    }
    if (activeTab === 'analysis' || activeTab === 'investment') {
      const scopedAnalyses =
        activeTab === 'investment'
          ? (analyses || []).filter((a: any) =>
              isInvestmentAnalysisType(a.analysisType || a.analysis_type)
            )
          : analyses || [];
      return scopedAnalyses.map((a: any) => ({
        id: String(a.id),
        title: String(a.title || t('common.untitled', 'Untitled')),
        kind: activeTab === 'investment' ? 'investment' : 'analysis',
        status: normalizeStatus(a.status),
        analysisType: String(a.analysisType || a.analysis_type || 'comprehensive'),
        currency: String(a.currency || 'PLN'),
        periodCount: Array.isArray(a.periods) ? a.periods.length : 0,
        sourceStatementIds: Array.isArray(a.sourceStatementIds || a.source_statement_ids)
          ? (a.sourceStatementIds || a.source_statement_ids).map((id: unknown) => String(id))
          : [],
        sourceStatementPackId: a.sourceStatementPackId || a.source_statement_pack_id || undefined,
        updatedAt: String(
          a.updatedAt || a.updated_at || a.createdAt || a.created_at || new Date().toISOString()
        ),
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
  }, [activeTab, statements, models, analyses, valuations, budgets, t]);

  const filteredRows = useMemo(() => {
    let rows = rowsForActiveTab;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }
    const statusFilterValues = activeFilters
      .filter((f) => f.column === 'status')
      .map((f) => f.value);
    if (statusFilterValues.length) {
      rows = rows.filter((r) => statusFilterValues.includes(r.status));
    }
    return rows;
  }, [rowsForActiveTab, searchQuery, activeFilters]);

  const statusCounts = useMemo(() => {
    const counts: Record<FinanceStatus, number> = { DRAFT: 0, REVIEW: 0, APPROVED: 0 };
    rowsForActiveTab.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [rowsForActiveTab]);

  return {
    models,
    statements,
    analyses,
    valuations,
    budgets,
    loadingTab,
    loadError,
    isUsingDemoData,
    loadStatements,
    loadModels,
    loadAnalyses,
    loadValuations,
    loadBudgets,
    rowsForActiveTab,
    filteredRows,
    statusCounts,
  };
}

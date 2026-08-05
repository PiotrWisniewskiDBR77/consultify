import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api, shouldAllowDemoData } from '@/services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';

import { type FilterChip, type ModuleTab } from '../../shared/ModuleHub';
import {
  deriveAnalyticalDepthLabel,
  deriveForecastWindowLabel,
  deriveVariantLabel,
} from '../financeModelLabels';
import {
  deriveStatementReadinessStatus,
  type FinanceKind,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceStatementRow,
  type FinanceStatus,
  isWorkableStatement,
  normalizeModelStatus,
  normalizeStatus,
  type PredictionType,
} from '../financeTypes';

// Dead demo data arrays removed — D1 cleanup

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
  const allowDemoData = shouldAllowDemoData();

  const [models, setModels] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState<FinanceKind | null>('models');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStatements = useCallback(async () => {
    try {
      let arr: any[] = [];
      try {
        const data = await V8FinanceApi.getStatementPacks();
        arr = Array.isArray(data?.statementPacks) ? data.statementPacks : [];
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        const data = await Api.get('/api/finance-statements/packs');
        arr = Array.isArray(data) ? data : [];
      }
      setLoadError(null);
      setStatements(arr);
    } catch {
      const demoFallbackHint = allowDemoData
        ? ` ${t(
            'finance.errors.demoModeRequiresRealSource',
            'Demo mode is enabled, but this module requires real source data.'
          )}`
        : '';
      setLoadError(
        t(
          'finance.errors.statementsRealSourceFailed',
          'Failed to load real finance statements from the active data source.'
        ) + demoFallbackHint
      );
      setStatements([]);
    }
  }, [allowDemoData, t]);

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
      setModels(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.modelsRealSourceFailed',
          'Failed to load real finance models from the active data source.'
        )
      );
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
      setAnalyses(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.analysesRealSourceFailed',
          'Failed to load real financial analyses from the active data source.'
        )
      );
      setAnalyses([]);
    }
  }, [t]);

  const loadValuations = useCallback(async () => {
    try {
      const data = await Api.get('/api/economics/valuations');
      const arr = Array.isArray((data as any)?.valuations) ? (data as any).valuations : [];
      setLoadError(null);
      setValuations(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.valuationsRealSourceFailed',
          'Failed to load real valuations from the active data source.'
        )
      );
      setValuations([]);
    }
  }, [t]);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await Api.get('/api/economics/budgets');
      const arr = Array.isArray((data as any)?.budgets) ? (data as any).budgets : [];
      setLoadError(null);
      setBudgets(arr);
    } catch {
      setLoadError(
        t(
          'finance.errors.budgetsRealSourceFailed',
          'Failed to load real budgets from the active data source.'
        )
      );
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
      return (statements || []).map((s: any): FinanceStatementRow => {
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
            s.entity_name ||
              s.period_label ||
              `${t('finance.pack.titleFallback', 'Statement Pack')} ${s.period_end || ''}`
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
          forecastWindowLabel: deriveForecastWindowLabel(m.start_date, m.horizon_months),
          variantLabel: deriveVariantLabel(m.scenario, t),
          analyticalDepthLabel: deriveAnalyticalDepthLabel(m.event_count, t),
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
        forecastWindowLabel: deriveForecastWindowLabel(m.start_date, m.horizon_months),
        variantLabel: deriveVariantLabel(m.scenario, t),
        analyticalDepthLabel: deriveAnalyticalDepthLabel(m.event_count, t),
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

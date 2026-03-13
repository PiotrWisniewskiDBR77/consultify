import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

import { type ModuleTab } from '../../shared/ModuleHub';
import {
  type FinanceModelRow,
  type FinanceRow,
  type PreviewDataState,
} from '../financeTypes';

export function useFinanceSelection(activeTab: ModuleTab) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FinanceRow | null>(null);

  const [predictionValidations, setPredictionValidations] =
    useState<PreviewDataState['predictionValidations']>(null);
  const [statementPreviewDetail, setStatementPreviewDetail] =
    useState<PreviewDataState['statementPreviewDetail']>(null);
  const [statementPreviewRatios, setStatementPreviewRatios] =
    useState<PreviewDataState['statementPreviewRatios']>(null);
  const [analysisPreviewRatios, setAnalysisPreviewRatios] =
    useState<PreviewDataState['analysisPreviewRatios']>(null);
  const [budgetPreviewScenarios, setBudgetPreviewScenarios] =
    useState<PreviewDataState['budgetPreviewScenarios']>(null);
  const [valuationPreviewResults, setValuationPreviewResults] =
    useState<PreviewDataState['valuationPreviewResults']>(null);
  const [valuationPreviewDetail, setValuationPreviewDetail] =
    useState<PreviewDataState['valuationPreviewDetail']>(null);

  useEffect(() => {
    setSelectedId(null);
    setSelectedItem(null);
    setStatementPreviewDetail(null);
    setStatementPreviewRatios(null);
    setPredictionValidations(null);
    setAnalysisPreviewRatios(null);
    setBudgetPreviewScenarios(null);
    setValuationPreviewResults(null);
    setValuationPreviewDetail(null);
  }, [activeTab]);

  const getBudgetRawId = useCallback((rowId: string) => {
    return rowId.startsWith('budget-') ? rowId.slice(7) : rowId;
  }, []);

  const loadPredictionPreview = useCallback(async (modelId: string) => {
    try {
      const val = await Api.get(`/api/financial-modeling/models/${modelId}/validations`);
      setPredictionValidations((val as any)?.summary || null);
    } catch {
      setPredictionValidations(null);
    }
  }, []);

  const loadStatementPreview = useCallback(async (statementId: string) => {
    try {
      const detail = await Api.get(`/api/finance-statements/packs/${statementId}`);
      const statements = Array.isArray((detail as any)?.statements) ? (detail as any).statements : [];
      setStatementPreviewDetail({
        entityName: String((detail as any)?.entity_name || ''),
        periodLabel: String((detail as any)?.period_label || ''),
        periodStart: String((detail as any)?.period_start || ''),
        periodEnd: String((detail as any)?.period_end || ''),
        currency: String((detail as any)?.currency || 'PLN'),
        scaling: String((detail as any)?.scaling || 'units'),
        sourceFileName: statements
          .map((statement: any) => String(statement?.source_file_name || ''))
          .filter(Boolean)
          .join(', '),
        validationStatus: String((detail as any)?.pack_status || 'pending'),
        rawStatus: String((detail as any)?.pack_status || 'draft'),
        readinessStatus: String(
          (detail as any)?.pack_readiness_status || (detail as any)?.readiness_status || 'pending'
        ),
        readinessSummary: String(
          (detail as any)?.pack_quality_summary || (detail as any)?.readiness_summary || ''
        ),
        missingStatementTypes: Array.isArray((detail as any)?.missing_statement_types)
          ? (detail as any).missing_statement_types.map((type: unknown) => String(type))
          : [],
        sourceStatementCount: Number((detail as any)?.source_statement_count ?? statements.length),
        childStatements: statements.map((statement: any) => ({
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
          valuesVersion: Number(statement.values_version ?? 0),
          validationFailCount: Number(statement.validation_fail_count ?? 0),
          validationWarningCount: Number(statement.validation_warning_count ?? 0),
        })),
        packValidations: Array.isArray((detail as any)?.validations)
          ? (detail as any).validations.map((validation: any) => ({
              validationScope: 'pack',
              checkCode: String(validation.check_code || ''),
              checkName: String(validation.check_name || ''),
              severity: String(validation.severity || 'info') as 'info' | 'warning' | 'error',
              status: String(validation.status || 'pass') as 'pass' | 'warning' | 'fail',
              expectedValue:
                validation.expected_value != null ? Number(validation.expected_value) : null,
              actualValue:
                validation.actual_value != null ? Number(validation.actual_value) : null,
              difference: validation.difference != null ? Number(validation.difference) : null,
              tolerance: validation.tolerance != null ? Number(validation.tolerance) : null,
              message: validation.message ? String(validation.message) : null,
              detailsJson: validation.details_json ? String(validation.details_json) : null,
              computedAt: validation.computed_at ? String(validation.computed_at) : '',
            }))
          : [],
        mappedLineCount: statements.reduce(
          (sum: number, statement: any) => sum + Number(statement?.mapped_line_count ?? 0),
          0
        ),
        totalLineCount: statements.reduce(
          (sum: number, statement: any) => sum + Number(statement?.total_line_count ?? 0),
          0
        ),
        unmappedLineCount: statements.reduce(
          (sum: number, statement: any) => sum + Number(statement?.unmapped_line_count ?? 0),
          0
        ),
        topLineItems: statements.slice(0, 4).map((statement: any) => ({
          label: String(statement.statement_type || ''),
          code: String(statement.readiness_status || 'pending'),
          value: Number(statement.mapped_line_count ?? 0),
        })),
      });
      setStatementPreviewRatios(null);
    } catch {
      setStatementPreviewDetail(null);
      setStatementPreviewRatios(null);
    }
  }, []);

  const loadBudgetPreviewScenarios = useCallback(async (budgetRawId: string) => {
    try {
      const data = await Api.get(`/api/economics/budgets/${budgetRawId}`);
      const scenarios = (data as any)?.scenarios;
      if (Array.isArray(scenarios) && scenarios.length > 0) {
        setBudgetPreviewScenarios(
          scenarios.map((s: any) => ({
            scenarioType: s.scenarioType || s.scenario_type || 'base',
            name: s.name || s.scenarioType || 'base',
            isActive: !!s.isActive || !!s.is_active,
            summaryMetrics: s.summaryMetrics || s.summary_metrics || {},
          }))
        );
      } else {
        setBudgetPreviewScenarios(null);
      }
    } catch {
      setBudgetPreviewScenarios(null);
    }
  }, []);

  const loadAnalysisPreviewRatios = useCallback(async (analysisId: string) => {
    try {
      const data = await Api.get(`/api/economics/financial-analyses/${analysisId}/ratios`);
      const ratios = (data as any)?.ratios;
      if (Array.isArray(ratios) && ratios.length > 0) {
        setAnalysisPreviewRatios(
          ratios.map((r: any) => ({
            category: r.category,
            ratio_code: r.ratio_code,
            ratio_name: r.ratio_name,
            value: r.value != null ? Number(r.value) : null,
          }))
        );
      } else {
        setAnalysisPreviewRatios(null);
      }
    } catch {
      setAnalysisPreviewRatios(null);
    }
  }, []);

  const loadValuationPreviewResults = useCallback(async (valuationId: string) => {
    try {
      const data = await Api.get(`/api/economics/valuations/${valuationId}`);
      const v = (data as any)?.valuation;
      const results = typeof v?.results === 'string' ? JSON.parse(v.results) : v?.results;
      const dcf = results?.dcf;
      const advisory = typeof v?.advisory === 'string' ? JSON.parse(v.advisory) : v?.advisory;
      const negotiationPack =
        typeof v?.negotiation_pack === 'string'
          ? JSON.parse(v.negotiation_pack)
          : v?.negotiation_pack;
      const sensitivity = results?.sensitivity || null;

      if (dcf) {
        setValuationPreviewResults({
          enterpriseValue: dcf.enterpriseValue != null ? Number(dcf.enterpriseValue) : null,
          equityValue: dcf.equityValue != null ? Number(dcf.equityValue) : null,
          evEbitda: dcf.impliedMultiple != null ? Number(dcf.impliedMultiple) : null,
        });
      } else {
        setValuationPreviewResults(null);
      }

      setValuationPreviewDetail({
        advisory: advisory || null,
        negotiationPack: negotiationPack || null,
        sensitivity: sensitivity || null,
      });
    } catch {
      setValuationPreviewResults(null);
      setValuationPreviewDetail(null);
    }
  }, []);

  const clearAllPreview = useCallback(() => {
    setStatementPreviewDetail(null);
    setStatementPreviewRatios(null);
    setPredictionValidations(null);
    setAnalysisPreviewRatios(null);
    setBudgetPreviewScenarios(null);
    setValuationPreviewResults(null);
    setValuationPreviewDetail(null);
  }, []);

  const onSelectRow = useCallback(
    (row: FinanceRow) => {
      setSelectedId(row.id);
      setSelectedItem(row);
      if (row.kind === 'statements') {
        loadStatementPreview(row.id);
        setPredictionValidations(null);
        setAnalysisPreviewRatios(null);
        setBudgetPreviewScenarios(null);
        setValuationPreviewResults(null);
        setValuationPreviewDetail(null);
      } else if (row.kind === 'prediction') {
        const modelRow = row as FinanceModelRow;
        if (modelRow.predictionType === 'budget') {
          setStatementPreviewDetail(null);
          setStatementPreviewRatios(null);
          setPredictionValidations(null);
          setAnalysisPreviewRatios(null);
          setValuationPreviewResults(null);
          setValuationPreviewDetail(null);
          loadBudgetPreviewScenarios(getBudgetRawId(row.id));
        } else {
          setStatementPreviewDetail(null);
          setStatementPreviewRatios(null);
          loadPredictionPreview(row.id);
          setAnalysisPreviewRatios(null);
          setBudgetPreviewScenarios(null);
          setValuationPreviewResults(null);
          setValuationPreviewDetail(null);
        }
      } else if (row.kind === 'analysis' || row.kind === 'investment') {
        setStatementPreviewDetail(null);
        setStatementPreviewRatios(null);
        setPredictionValidations(null);
        setBudgetPreviewScenarios(null);
        setValuationPreviewResults(null);
        setValuationPreviewDetail(null);
        loadAnalysisPreviewRatios(row.id);
      } else if (row.kind === 'valuation') {
        setStatementPreviewDetail(null);
        setStatementPreviewRatios(null);
        setPredictionValidations(null);
        setAnalysisPreviewRatios(null);
        setBudgetPreviewScenarios(null);
        loadValuationPreviewResults(row.id);
      } else {
        clearAllPreview();
      }
    },
    [
      loadPredictionPreview,
      loadStatementPreview,
      loadAnalysisPreviewRatios,
      loadBudgetPreviewScenarios,
      getBudgetRawId,
      loadValuationPreviewResults,
      clearAllPreview,
    ]
  );

  const deselectRow = useCallback(() => {
    setSelectedId(null);
    setSelectedItem(null);
    clearAllPreview();
  }, [clearAllPreview]);

  return {
    selectedId,
    setSelectedId,
    selectedItem,
    setSelectedItem,
    statementPreviewDetail,
    statementPreviewRatios,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    getBudgetRawId,
    loadStatementPreview,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadAnalysisPreviewRatios,
    loadValuationPreviewResults,
    onSelectRow,
    deselectRow,
    clearAllPreview,
  };
}

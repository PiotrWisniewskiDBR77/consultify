import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

import { type ModuleTab } from '../../shared/ModuleHub';
import { type FinanceModelRow, type FinanceRow, type PreviewDataState } from '../financeTypes';

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
      const [detail, ratios] = await Promise.all([
        Api.get(`/api/finance-statements/${statementId}`),
        Api.get(`/api/finance-statements/${statementId}/ratios`).catch(() => null),
      ]);

      const values = Array.isArray((detail as any)?.values) ? (detail as any).values : [];
      const mappedValues = values.filter((value: any) => value?.line_code);
      setStatementPreviewDetail({
        statementType: String((detail as any)?.statement_type || ''),
        periodLabel: String((detail as any)?.period_label || ''),
        periodStart: String((detail as any)?.period_start || ''),
        periodEnd: String((detail as any)?.period_end || ''),
        currency: String((detail as any)?.currency || 'PLN'),
        scaling: String((detail as any)?.scaling || 'units'),
        sourceFileName: String((detail as any)?.source_file_name || ''),
        validationStatus: String((detail as any)?.validation_status || 'pending'),
        rawStatus: String((detail as any)?.status || 'draft'),
        readinessStatus: String(
          (detail as any)?.readinessStatus || (detail as any)?.readiness_status || 'pending'
        ),
        readinessSummary: String(
          (detail as any)?.readinessSummary || (detail as any)?.readiness_summary || ''
        ),
        mappedLineCount: mappedValues.length,
        topLineItems: mappedValues.slice(0, 4).map((value: any) => ({
          label: String(value.line_name || value.line_name_pl || value.original_label || value.line_code || ''),
          code: String(value.line_code || ''),
          value: Number(value.value || 0),
        })),
      });

      const ratioList = Array.isArray((ratios as any)?.ratios) ? (ratios as any).ratios : [];
      const coverage = (ratios as any)?.coverageSummary;
      setStatementPreviewRatios({
        coveragePct: Number(coverage?.coveragePct ?? 0),
        computed: Number(coverage?.computed ?? ratioList.filter((item: any) => item.value != null).length),
        total: Number(coverage?.total ?? ratioList.length),
        topRatios: ratioList
          .filter((item: any) => item.value != null)
          .slice(0, 3)
          .map((item: any) => ({
            code: String(item.code || ''),
            name: String(item.name || item.namePl || item.code || ''),
            value: item.value != null ? Number(item.value) : null,
          })),
      });
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

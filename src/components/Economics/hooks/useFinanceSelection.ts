import { useCallback, useEffect, useState } from 'react';

import { Api } from '@/services/api';

import { type ModuleTab } from '../../shared/ModuleHub';
import { type FinanceModelRow, type FinanceRow, type PreviewDataState } from '../financeTypes';

export function useFinanceSelection(activeTab: ModuleTab) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FinanceRow | null>(null);

  const [predictionValidations, setPredictionValidations] =
    useState<PreviewDataState['predictionValidations']>(null);
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
      if (row.kind === 'prediction') {
        const modelRow = row as FinanceModelRow;
        if (modelRow.predictionType === 'budget') {
          setPredictionValidations(null);
          setAnalysisPreviewRatios(null);
          setValuationPreviewResults(null);
          setValuationPreviewDetail(null);
          loadBudgetPreviewScenarios(getBudgetRawId(row.id));
        } else {
          loadPredictionPreview(row.id);
          setAnalysisPreviewRatios(null);
          setBudgetPreviewScenarios(null);
          setValuationPreviewResults(null);
          setValuationPreviewDetail(null);
        }
      } else if (row.kind === 'analysis' || row.kind === 'investment') {
        setPredictionValidations(null);
        setBudgetPreviewScenarios(null);
        setValuationPreviewResults(null);
        setValuationPreviewDetail(null);
        loadAnalysisPreviewRatios(row.id);
      } else if (row.kind === 'valuation') {
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
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    getBudgetRawId,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadAnalysisPreviewRatios,
    loadValuationPreviewResults,
    onSelectRow,
    deselectRow,
    clearAllPreview,
  };
}

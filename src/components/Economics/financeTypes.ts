import { Calculator, BarChart3, TrendingUp, Target } from 'lucide-react';
import React from 'react';

import { type PreviewableItem } from '../shared/TableWithPreviewLayout';

export type FinanceStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';
export type FinanceKind = 'models' | 'analysis' | 'prediction' | 'valuation';
export type PredictionType = 'model' | 'budget';

export type FinanceRowBase = PreviewableItem & {
  kind: FinanceKind;
  status: FinanceStatus;
  updatedAt: string;
};

export type FinanceModelRow = FinanceRowBase & {
  kind: 'models' | 'prediction';
  predictionType: PredictionType;
  scenario: string;
  currency: string;
  horizonMonths: number;
  startDate: string;
  periodStart?: string;
  periodEnd?: string;
  granularity?: string;
};

export type FinanceAnalysisRow = FinanceRowBase & {
  kind: 'analysis';
  analysisType: string;
  currency: string;
  periodCount: number;
};

export type FinanceValuationRow = FinanceRowBase & {
  kind: 'valuation';
  sourceType: string;
  method: string;
  currency: string;
  horizonYears: number;
};

export type FinanceRow = FinanceModelRow | FinanceAnalysisRow | FinanceValuationRow;

export const KIND_LABELS: Record<FinanceKind, { code: string; en: string; pl: string }> = {
  models: { code: 'MDL', en: 'Model', pl: 'Model' },
  analysis: { code: 'ANL', en: 'Analysis', pl: 'Analiza' },
  prediction: { code: 'PRD', en: 'Scenario', pl: 'Scenariusz' },
  valuation: { code: 'VAL', en: 'Valuation', pl: 'Wycena' },
};

export const KIND_ICONS: Record<FinanceKind, React.ReactNode> = {
  models: React.createElement(Calculator, { size: 14, className: 'text-blue-500 dark:text-blue-400' }),
  analysis: React.createElement(BarChart3, { size: 14, className: 'text-emerald-500 dark:text-emerald-400' }),
  prediction: React.createElement(TrendingUp, { size: 14, className: 'text-purple-500 dark:text-purple-400' }),
  valuation: React.createElement(Target, { size: 14, className: 'text-amber-500 dark:text-amber-400' }),
};

export const KIND_ACCENT: Record<FinanceKind, string> = {
  models: 'border-l-blue-500 dark:border-l-blue-400',
  analysis: 'border-l-emerald-500 dark:border-l-emerald-400',
  prediction: 'border-l-purple-500 dark:border-l-purple-400',
  valuation: 'border-l-amber-500 dark:border-l-amber-400',
};

export const CANVAS_PADDING = 'pl-4 pr-1.5 pt-3 pb-4';

export function normalizeModelStatus(raw: unknown): FinanceStatus {
  const s = String(raw || '').toLowerCase();
  if (s === 'approved') return 'APPROVED';
  if (s === 'review') return 'REVIEW';
  return 'DRAFT';
}

export function normalizeStatus(raw: unknown): FinanceStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'REVIEW') return 'REVIEW';
  return 'DRAFT';
}

export function statusToItemStatus(s: FinanceStatus): 'APPROVED' | 'REVIEW' | 'DRAFT' {
  return s;
}

export function statusToProgress(s: FinanceStatus): number {
  if (s === 'APPROVED') return 100;
  if (s === 'REVIEW') return 50;
  return 10;
}

export function getTypeCode(kind: FinanceKind): string {
  return KIND_LABELS[kind].code;
}

export function formatAge(dateStr: string, isPl: boolean): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (hours < 1) return isPl ? 'Przed chwilą' : 'Just now';
  if (hours < 24) return isPl ? `${hours} h temu` : `${hours}h ago`;
  if (days < 7) return isPl ? `${days} dni temu` : `${days}d ago`;
  return d.toLocaleDateString();
}

export interface PreviewDataState {
  predictionValidations: { total: number; pass: number; fail: number; warning: number } | null;
  analysisPreviewRatios: { category: string; ratio_code: string; ratio_name: string; value: number | null }[] | null;
  budgetPreviewScenarios: { scenarioType: string; name: string; isActive: boolean; summaryMetrics: Record<string, number> }[] | null;
  valuationPreviewResults: { enterpriseValue: number | null; equityValue: number | null; evEbitda: number | null } | null;
  valuationPreviewDetail: { advisory: any; negotiationPack: any; sensitivity: any } | null;
}

/**
 * Outputs Library — URL `?tab=` contract for `/presentations` (and legacy `/reports` entry).
 * Single source for hub + My Work home bridge so queue names never drift.
 */

import type { RapTab } from './types';

/** Maps hub tab id → `tab` query value */
export const RAP_TAB_TO_QUERY: Record<RapTab, string> = {
  outputs_all: 'all',
  outputs_mine: 'mine',
  outputs_review: 'needs_review',
  outputs_documents: 'documents',
  presentations: 'presentations',
  outputs_sheets: 'sheets',
  templates: 'templates',
};

export function parseRapTabFromQuery(raw: string | null): RapTab | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  const map: Record<string, RapTab> = {
    all: 'outputs_all',
    mine: 'outputs_mine',
    needs_review: 'outputs_review',
    review: 'outputs_review',
    documents: 'outputs_documents',
    reports: 'outputs_documents',
    presentations: 'presentations',
    sheets: 'outputs_sheets',
    // #83a: Data Sources retired as a top-level tab — legacy `?tab=data` deep
    // links now land on Sheets, where the Data Sources sub-tab lives.
    data: 'outputs_sheets',
    templates: 'templates',
  };
  return map[n] ?? null;
}

/** My Work `outputs_*` targets → presentations `?tab=` value */
export type OutputsLibraryBridgeTarget = 'outputs_all' | 'outputs_mine' | 'outputs_review';

export function presentationsTabQueryForHomeBridge(target: OutputsLibraryBridgeTarget): string {
  return RAP_TAB_TO_QUERY[target];
}

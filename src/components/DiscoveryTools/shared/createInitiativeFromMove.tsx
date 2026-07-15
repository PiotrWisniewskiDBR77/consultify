/**
 * createInitiativeFromMove — shared Tools→Initiatives handoff (S6.2 / chain gap #4)
 *
 * Every consulting tool that produces "strategic moves" / recommendations
 * (GrowthPaths, MarketForces, CapabilityMapper, FocusTradeoff, NarrativeEngine,
 * PortfolioPriority, RiskUncertainty, ValueChain, AmbitionDecomposer, …) shares
 * the SAME structural move shape. R3 wired the SWOT case by hand
 * (DynamicSWOT/SWOTInsightsPhase.tsx → Api.createInitiative with sourceType:'tool').
 *
 * This module GENERALIZES that fix: one helper + one button so the output of ANY
 * tool can be promoted into the real Initiatives backbone (M13) with tool
 * provenance (sourceType:'tool', sourceId = tool session id) — a back-reference
 * from the created initiative to its source tool session. No per-tool copy-paste.
 *
 * Fail-safe: a backend error keeps the local session draft and surfaces a toast
 * instead of breaking the tool flow — identical to the SWOT reference fix.
 */
import type { TFunction } from 'i18next';
import { Lightbulb } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { InitiativeDraft, ToolSession, useToolStore } from '@/store/useToolStore';

/**
 * Structural subset shared by every tool "move" interface in the store
 * (GrowthMove, PorterMove, CapabilityMove, FocusMove, NarrativeMove,
 * PortfolioMove, RiskMove, ValueChainMove, AmbitionMove, SWOTMove, …).
 * Kept intentionally loose so any move can be passed without per-tool adapters.
 */
export interface ToolMoveLike {
  id?: string;
  title: string;
  rationale?: string;
  category?: string;
  expectedImpact?: 'high' | 'medium' | 'low';
  estimatedEffort?: 'high' | 'medium' | 'low';
  riskLevel?: 'high' | 'medium' | 'low';
  firstStep?: string;
  /** Any linked-source id field the tool exposes (linkedGapIds, linkedRiskIds, …). */
  linkedTensionIds?: string[];
  linkedItemIds?: string[];
  linkedGapIds?: string[];
  linkedRiskIds?: string[];
  linkedLeverIds?: string[];
  linkedActivityIds?: string[];
  linkedThreadIds?: string[];
  linkedImplicationIds?: string[];
  linkedTradeoffIds?: string[];
  linkedQuadrants?: string[];
  linkedItemsIds?: string[];
}

/** Map a tool move's `category` onto the InitiativeDraft `type` axis. */
function mapMoveCategoryToType(category?: string): InitiativeDraft['type'] {
  const c = (category || '').toLowerCase();
  if (
    c.includes('defensive') ||
    c.includes('defend') ||
    c.includes('protect') ||
    c.includes('risk')
  )
    return 'defensive';
  if (
    c.includes('quick-win') ||
    c.includes('operational') ||
    c.includes('reskill') ||
    c.includes('restructure')
  )
    return 'operational';
  if (
    c.includes('growth') ||
    c.includes('accelerator') ||
    c.includes('experiment') ||
    c.includes('bet')
  )
    return 'growth';
  return 'strategic';
}

/** Collect whatever linked-source ids a given move exposes, for lineage. */
function collectLinkedItems(move: ToolMoveLike): string[] {
  return [
    ...(move.linkedTensionIds || []),
    ...(move.linkedItemIds || []),
    ...(move.linkedItemsIds || []),
    ...(move.linkedGapIds || []),
    ...(move.linkedRiskIds || []),
    ...(move.linkedLeverIds || []),
    ...(move.linkedActivityIds || []),
    ...(move.linkedThreadIds || []),
    ...(move.linkedImplicationIds || []),
    ...(move.linkedTradeoffIds || []),
    ...(move.linkedQuadrants || []),
  ];
}

/**
 * Promote a single tool move into the Initiatives backbone.
 *
 * 1. Local session copy (offline-safe; drives the tool's "generated initiatives"
 *    list) via useToolStore().addInitiative — matches the SWOT reference.
 * 2. Persist to the real Initiatives module (POST /api/initiatives) with tool
 *    provenance so the back-reference (source_type:'tool', source_id) survives.
 */
export async function createInitiativeFromMove(params: {
  session: ToolSession;
  move: ToolMoveLike;
  t: TFunction;
  addInitiative: (initiative: Omit<InitiativeDraft, 'id'>) => void;
}): Promise<boolean> {
  const { session, move, t, addInitiative } = params;
  const description = move.rationale || move.title;
  const impact = move.expectedImpact || 'medium';
  const effort = move.estimatedEffort || 'medium';
  const type = mapMoveCategoryToType(move.category);

  // 1. Local draft first (never lost, even if the network call fails).
  addInitiative({
    title: move.title,
    description,
    type,
    source: session.toolType,
    linkedItems: collectLinkedItems(move),
    estimatedImpact: impact,
    estimatedEffort: effort,
    rationale: move.rationale || '',
  });

  // 2. Persist with tool provenance (chain gap #4: tool output → initiative).
  try {
    await Api.createInitiative({
      title: move.title,
      description,
      summary: description,
      impact,
      effort,
      sourceType: 'tool',
      sourceId: session.id,
    });
    toast.success(t('discoveryToolsSteps.createInitiativeFromMove.createdToast'));
    return true;
  } catch (err) {
    console.error('[Tools] initiative handoff failed:', err);
    toast.error(t('discoveryToolsSteps.createInitiativeFromMove.saveFailedToast'));
    return false;
  }
}

/**
 * Drop-in button rendered inside each tool's move card. One generic handoff
 * "Create initiative from this move" wired to createInitiativeFromMove.
 */
export function CreateInitiativeFromMoveButton({
  session,
  move,
  className,
}: {
  session: ToolSession;
  move: ToolMoveLike;
  isPolish: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { addInitiative } = useToolStore();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createInitiativeFromMove({ session, move, t, addInitiative });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ||
        'mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary-300/50 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-40 dark:border-primary-900/40 dark:bg-navy-950/40 dark:text-primary-400 dark:hover:bg-primary-950/30'
      }
    >
      <Lightbulb className="h-3 w-3" />
      {busy
        ? t('discoveryToolsSteps.createInitiativeFromMove.creating')
        : t('discoveryToolsSteps.createInitiativeFromMove.createFromMove')}
    </button>
  );
}

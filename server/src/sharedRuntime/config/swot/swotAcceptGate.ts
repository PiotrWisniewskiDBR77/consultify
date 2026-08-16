/** GENERATED MIRROR — run scripts/cleanup/sync-server-runtime-mirrors.mjs; do not edit directly. */
/**
 * swotAcceptGate — the ONE canonical accept decision for a Dynamic SWOT item.
 *
 * Why this file exists (STREAM G1, 2026-08-13):
 * Before this file, "accepting" a SWOT item had THREE independent, divergent
 * implementations:
 *   1. `useToolStore.ts`'s `acceptCard('item', id)` — stamps `evidenceStatus`
 *      from `evaluateSwotItemEvidence` (config/swot/dynamicSwotQuestionBank.ts),
 *      but is never actually wired into the Build Phase UI.
 *   2. `SWOTBuildPhase.tsx`'s local `acceptProposal()` — the function the UI
 *      ACTUALLY calls. It flips `status`/`proposalStatus` to `accepted` with a
 *      raw `updateSWOTItem(...)` and never touches `evidenceStatus` at all. If
 *      the item came from the chat-mentor AI flow
 *      (`hooks/discovery/toolAi/dynamicSwot.ts`'s `normalizeItemConclusionFields`),
 *      whatever `evidenceStatus`/`classification` the MODEL wrote sails through
 *      to `accepted` completely unverified — the model can self-report
 *      "confirmed" evidence with zero linked evidence.
 *   3. `server/src/controllers/ToolController.ts`'s `acceptSwotProposal` (the
 *      `swot_proposals` table flow) — applies `final_after_json` verbatim; that
 *      shape (`swotProposalService.ts`'s `GeneratedProposal` -> `proposedAfter`)
 *      never carries evidenceStatus/classification today, but the handler still
 *      had no gate of its own, so a future field addition there would silently
 *      inherit the same hole.
 *
 * This module is the single source of truth all three MUST route through. It
 * is deliberately framework-free (no zustand, no express, no React) so both
 * the client (`src/store/useToolStore.ts`) and the server
 * (`server/src/controllers/ToolController.ts`, via the same relative-import
 * pattern already used for `src/toolOutputs/buildSwotOutput.ts` and
 * `src/method-core/contracts/teresa.ts`) can import it verbatim.
 *
 * Two rules, both traced to code that already exists (nothing here is
 * invented methodology):
 *
 *  RULE 1 — structural minimum (blocking).
 *    An item with no text, or an unknown quadrant, is not a proposal at all.
 *
 *  RULE 2 — classification must not outrun its own definition (blocking).
 *    `classifyStrengthFromAnswers` (dynamicSwotQuestionBank.ts) defines
 *    'core-competency' and 'niche-strength' as classifications that require
 *    external validation (client-confirmed / external-proof / measurable
 *    ladder answers). Accepting an item that CLAIMS one of these two
 *    classifications while carrying zero evidence (no linked signal, no
 *    evidence note) contradicts the classification's own definition — so
 *    this is the one place "the pack/engine requires evidence that is
 *    missing" genuinely blocks, grounded in the engine's own rule, not a new
 *    one invented for this stream.
 *
 * Everything else stays the EXISTING, documented, deliberately non-blocking
 * design: `evaluateSwotItemEvidence` (dynamicSwotQuestionBank.ts) stamps
 * confirmed/declared honestly and NEVER blocks acceptance on that axis alone
 * — "a report that names uncertainty beats one that masks it" (see that
 * file's docstring). This module does not relitigate that call; it enforces
 * it consistently and additionally makes it authoritative — `evidenceStatus`
 * on accept is ALWAYS recomputed here from real linked evidence, never taken
 * on trust from an upstream (AI-authored) value.
 */

import { DECLARED_UNCONFIRMED_LABEL } from './dynamicSwotQuestionBank.js';
import type { SwotStrengthClassification } from './dynamicSwotQuestionBank.js';

export type SwotAcceptQuadrant = 'strengths' | 'weaknesses' | 'opportunities' | 'threats';

const VALID_QUADRANTS: readonly SwotAcceptQuadrant[] = [
  'strengths',
  'weaknesses',
  'opportunities',
  'threats',
];

/** Classifications whose own definition requires external validation. */
const EXTERNALLY_VALIDATED_CLASSIFICATIONS: readonly SwotStrengthClassification[] = [
  'core-competency',
  'niche-strength',
];

export type SwotAcceptBlockReasonCode =
  | 'EMPTY_TEXT'
  | 'INVALID_QUADRANT'
  | 'UNVALIDATED_CLASSIFICATION';

export interface SwotAcceptBilingualMessage {
  pl: string;
  en: string;
}

/** Minimal shape the gate needs — a structural subset of `SWOTItem`. */
export interface SwotAcceptGateItem {
  text?: string;
  quadrant?: string;
  linkedSignalIds?: string[];
  evidenceNote?: string;
  classification?: string;
  /** K1 staircase — `factRefs` also counts as evidence (see below). */
  staircase?: { factRefs?: string[] };
}

export interface SwotAcceptGateOk {
  ok: true;
  /** Always recomputed from real evidence — never trusted from the input. */
  evidenceStatus: 'confirmed' | 'declared';
  evidenceLabel?: SwotAcceptBilingualMessage;
}

export interface SwotAcceptGateBlocked {
  ok: false;
  reasonCode: SwotAcceptBlockReasonCode;
  message: SwotAcceptBilingualMessage;
}

export type SwotAcceptGateResult = SwotAcceptGateOk | SwotAcceptGateBlocked;

const MESSAGES: Record<SwotAcceptBlockReasonCode, SwotAcceptBilingualMessage> = {
  EMPTY_TEXT: {
    pl: 'Pozycja jest pusta — dodaj treść przed akceptacją.',
    en: 'The item has no text — add content before accepting.',
  },
  INVALID_QUADRANT: {
    pl: 'Nieznana ćwiartka SWOT — nie można zaakceptować.',
    en: 'Unknown SWOT quadrant — cannot accept.',
  },
  UNVALIDATED_CLASSIFICATION: {
    pl:
      'Klasyfikacja "rdzeń kompetencji"/"nisza" wymaga zewnętrznego dowodu ' +
      '(powiązanego sygnału lub notatki z dowodem). Dodaj dowód albo zmień ' +
      'klasyfikację na "deklarowana siła".',
    en:
      'The "core competency"/"niche strength" classification requires external ' +
      'evidence (a linked signal or an evidence note). Add evidence, or change ' +
      'the classification to "claimed strength".',
  },
};

/**
 * Pure evaluation — no mutation, safe to call from client or server.
 * The canonical decision every accept caller (UI, Teresa, and — when it
 * exists — voice) MUST run before an item's status becomes 'accepted'.
 */
export function evaluateSwotAcceptGate(item: SwotAcceptGateItem): SwotAcceptGateResult {
  const text = (item.text ?? '').trim();
  if (!text) {
    return { ok: false, reasonCode: 'EMPTY_TEXT', message: MESSAGES.EMPTY_TEXT };
  }

  if (!VALID_QUADRANTS.includes(item.quadrant as SwotAcceptQuadrant)) {
    return { ok: false, reasonCode: 'INVALID_QUADRANT', message: MESSAGES.INVALID_QUADRANT };
  }

  // Three independent ways an item can carry real evidence today — a linked
  // signal, a free-text note, or K1 staircase fact refs. Two earlier, slightly
  // divergent copies of this check existed before this file (useToolStore.ts's
  // inline `acceptCard` checked all three; dynamicSwotQuestionBank.ts's
  // `evaluateSwotItemEvidence` only checked the first two) — this is the
  // union of both, so nothing that used to count as evidence stops counting.
  const hasEvidence =
    Boolean(item.linkedSignalIds && item.linkedSignalIds.length > 0) ||
    Boolean(item.evidenceNote && item.evidenceNote.trim().length > 0) ||
    Boolean(item.staircase?.factRefs && item.staircase.factRefs.length > 0);

  if (
    item.classification &&
    EXTERNALLY_VALIDATED_CLASSIFICATIONS.includes(item.classification as SwotStrengthClassification) &&
    !hasEvidence
  ) {
    return {
      ok: false,
      reasonCode: 'UNVALIDATED_CLASSIFICATION',
      message: MESSAGES.UNVALIDATED_CLASSIFICATION,
    };
  }

  // Non-blocking honesty stamp (dynamicSwotQuestionBank.ts's documented,
  // deliberate design) — ALWAYS recomputed here from `hasEvidence` above,
  // never trusted from an upstream (possibly AI-authored) evidenceStatus
  // value. `evaluateSwotItemEvidence` is still the label source of truth.
  const label = hasEvidence ? undefined : { ...DECLARED_UNCONFIRMED_LABEL };
  return hasEvidence
    ? { ok: true, evidenceStatus: 'confirmed' }
    : { ok: true, evidenceStatus: 'declared', evidenceLabel: label };
}

/**
 * Generic type param `T` so both the client's `SWOTItem` (useToolStore.ts)
 * and the server's plain `Record<string, unknown>` item shape can use the
 * same stamping helper without a shared class hierarchy.
 */
export function stampAcceptedSwotItem<T extends SwotAcceptGateItem>(
  item: T,
  gate: SwotAcceptGateOk
): T & { status: 'accepted'; proposalStatus: 'accepted'; evidenceStatus: 'confirmed' | 'declared' } {
  return {
    ...item,
    status: 'accepted',
    proposalStatus: 'accepted',
    evidenceStatus: gate.evidenceStatus,
  };
}

/**
 * Pure event -> UI view-model derivation for the DRD workspace screen.
 *
 * Extracted from `DrdMethodWorkspaceScreen.tsx` (P0C, 2026-08-13) so the
 * legacy localStorage runtime path AND the new HTTP-source-of-truth path
 * (`DrdHttpMethodWorkspaceScreen.tsx`, gated by `drdHttpSourceOfTruthV1`)
 * share ONE derivation of navigator/matrix/interview view models from a
 * `MethodEvent[]` list. Both runtimes produce the same `MethodEvent` shape
 * (`@/method-core/contracts`), so this logic is runtime-agnostic by
 * construction — it never imports either session runtime.
 */
import type { TableColumn } from '@/components/standard/StandardTable';
import type {
  InterviewFocusQuestion,
  MatrixRow,
  MethodEvidenceState,
  MethodNavigatorNode,
} from '@/components/method-workspace/types';
import { compileDrdPack } from '@/method-core/methods/drd/compileDrdPack';
import { drdAdapter } from '@/method-core/methods/drd/drdAdapter';
import { DRD_STRUCTURE, type DRDAxis } from '@/services/drdStructure';
import type { MethodEvent } from '@/method-core/contracts';

export const { pack } = compileDrdPack();

// Output current/target/gap rollup IS a fixed-schema record list (rows =
// units) — TRIADA doctrine case 1, not case 3 (LiveMatrix's unit×level grid
// is the Matryca-shaped exception; this per-unit summary is not).
export const OUTPUT_UNIT_COLUMNS: TableColumn[] = [
  { id: 'unitId', label: 'Jednostka' },
  { id: 'current', label: 'Current' },
  { id: 'target', label: 'Target' },
  { id: 'gap', label: 'Gap' },
];

export function confirmedLevelsFor(events: readonly MethodEvent[], unitId: string): number[] {
  const levels = new Set<number>();
  for (const e of events) {
    if (e.type === 'ANSWER_CONFIRMED' && e.unitId === unitId && typeof e.level === 'number') {
      levels.add(e.level);
    }
  }
  return [...levels].sort((a, b) => a - b);
}

export function targetLevelFor(events: readonly MethodEvent[], unitId: string): number | null {
  let target: number | null = null;
  for (const e of events) {
    if (
      e.type === 'DECISION_APPROVED' &&
      e.unitId === unitId &&
      typeof e.level === 'number' &&
      (e.payload as { subject?: string })?.subject === 'target_level'
    ) {
      target = e.level;
    }
  }
  return target;
}

export function evidenceEventsFor(events: readonly MethodEvent[], unitId: string): MethodEvent[] {
  return events.filter((e) => e.type === 'EVIDENCE_ATTACHED' && e.unitId === unitId);
}

export function evidenceStateFor(
  events: readonly MethodEvent[],
  unitId: string,
  blockedAtLevel: number | null
): MethodEvidenceState {
  const evidence = evidenceEventsFor(events, unitId);
  if (evidence.length === 0) return 'missing';
  if (blockedAtLevel !== null) return 'weak';
  return 'complete';
}

export function buildNavigatorNodes(events: readonly MethodEvent[]): MethodNavigatorNode[] {
  const nodes: MethodNavigatorNode[] = [];
  for (const axis of DRD_STRUCTURE as DRDAxis[]) {
    const axisAreaStates = axis.areas.map((area) => {
      const confirmed = confirmedLevelsFor(events, area.id);
      const progression = drdAdapter.resolveOpenLevels({ unitId: area.id, confirmedLevels: confirmed, evidenceByLevel: {} });
      return { area, progression };
    });
    const axisEvidenceState: MethodEvidenceState = axisAreaStates.some(
      (s) => evidenceStateFor(events, s.area.id, s.progression.blockedAtLevel) === 'missing'
    )
      ? 'missing'
      : axisAreaStates.every((s) => evidenceStateFor(events, s.area.id, s.progression.blockedAtLevel) === 'complete')
        ? 'complete'
        : 'weak';

    nodes.push({
      unitId: `axis-${axis.id}`,
      name: axis.namePL || axis.name,
      parentId: null,
      order: axis.id,
      currentLevel: null,
      targetLevel: null,
      evidenceState: axisEvidenceState,
      gap: null,
      openQuestionCount: 0,
    });

    axis.areas.forEach((area, idx) => {
      const confirmed = confirmedLevelsFor(events, area.id);
      const progression = drdAdapter.resolveOpenLevels({ unitId: area.id, confirmedLevels: confirmed, evidenceByLevel: {} });
      const target = targetLevelFor(events, area.id);
      const focusLevel = progression.blockedAtLevel ?? Math.min(...area.levels.map((l) => l.level));
      const openCount = pack.questions.filter((q) => q.unitId === area.id && q.level === focusLevel).length;
      nodes.push({
        unitId: area.id,
        name: area.namePL || area.name,
        parentId: `axis-${axis.id}`,
        order: idx,
        currentLevel: progression.currentLevel,
        targetLevel: target,
        evidenceState: evidenceStateFor(events, area.id, progression.blockedAtLevel),
        gap: target !== null && progression.currentLevel !== null ? target - progression.currentLevel : null,
        openQuestionCount: openCount,
      });
    });
  }
  return nodes;
}

export function buildMatrixRowsForAxis(
  events: readonly MethodEvent[],
  axis: DRDAxis,
  pendingPreviewUnitLevels: Set<string>
): MatrixRow[] {
  return axis.areas.map((area) => {
    const confirmed = confirmedLevelsFor(events, area.id);
    const progression = drdAdapter.resolveOpenLevels({ unitId: area.id, confirmedLevels: confirmed, evidenceByLevel: {} });
    const target = targetLevelFor(events, area.id);
    const levels = area.levels.map((l) => l.level).sort((a, b) => a - b);
    return {
      unitId: area.id,
      unitName: area.namePL || area.name,
      levels: levels.map((level) => {
        const achieved = progression.currentLevel !== null && level <= progression.currentLevel;
        const aboveGap = progression.aboveGapLevels.includes(level);
        // Blocker ≠ „jeszcze nie zaczęte" — see DrdMethodWorkspaceScreen's
        // original comment (git history) for the full rationale; kept
        // verbatim in behavior here.
        const workHasStarted = confirmed.length > 0 || progression.aboveGapLevels.length > 0;
        const isBlocker = level === progression.blockedAtLevel && workHasStarted;
        return {
          unitId: area.id,
          level,
          achieved,
          proposed: pendingPreviewUnitLevels.has(`${area.id}#${level}`),
          target: target === level,
          answerState: confirmed.includes(level) ? ('confirmed' as const) : ('unresolved' as const),
          evidenceState: evidenceStateFor(events, area.id, isBlocker ? level : null),
          aiProposalPending: pendingPreviewUnitLevels.has(`${area.id}#${level}`),
          reviewRequired: aboveGap,
          blocker: isBlocker,
        };
      }),
    };
  });
}

export function questionAnswerState(
  events: readonly MethodEvent[],
  questionId: string
): { state: InterviewFocusQuestion['answerState']; text: string } {
  let state: InterviewFocusQuestion['answerState'] = null;
  let text = '';
  for (const e of events) {
    if ((e.type === 'ANSWER_CONFIRMED' || e.type === 'ANSWER_DRAFTED') && (e.payload as { questionId?: string })?.questionId === questionId) {
      const payload = e.payload as { answerState?: InterviewFocusQuestion['answerState']; text?: string };
      state = payload.answerState ?? state;
      text = payload.text ?? text;
    }
  }
  return { state, text };
}

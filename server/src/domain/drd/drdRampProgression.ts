export type DrdRampAnswerState = 'confirmed' | 'partial' | 'no' | 'dont_know' | 'no_evidence' | 'not_applicable';

export interface DrdRampEventLike {
  readonly id?: string;
  readonly type: string;
  readonly unitId?: string | null;
  readonly level?: number | null;
  readonly payload?: unknown;
}

export interface DrdRampProgressionInput {
  readonly unitId: string;
  readonly confirmedLevels: readonly number[];
  readonly blockingLevels?: readonly number[];
  readonly levelScale?: readonly number[];
}

export interface DrdRampProgressionResult {
  readonly currentLevel: number | null;
  readonly blockedAtLevel: number | null;
  readonly openLevels: number[];
  readonly aboveGapLevels: number[];
}

export interface DrdEventRampUnitResult extends DrdRampProgressionResult {
  readonly unitId: string;
  readonly answerEventIds: string[];
  readonly confirmedLevels: number[];
  readonly blockingLevels: number[];
}

function normaliseLevels(levels: readonly number[]): number[] {
  return [...new Set(levels.filter((level) => Number.isInteger(level) && level > 0))].sort((a, b) => a - b);
}

function continuousScaleFromObserved(maxLevel: number | null): number[] {
  if (maxLevel === null || maxLevel < 1) return [];
  return Array.from({ length: maxLevel }, (_, index) => index + 1);
}

export function resolveDrdRampProgression(input: DrdRampProgressionInput): DrdRampProgressionResult {
  const confirmed = new Set(normaliseLevels(input.confirmedLevels));
  const blocking = new Set(normaliseLevels(input.blockingLevels ?? []));
  const explicitScale = input.levelScale ? normaliseLevels(input.levelScale) : [];
  const observedMax = Math.max(0, ...confirmed, ...blocking);
  const scale = explicitScale.length > 0 ? explicitScale : continuousScaleFromObserved(observedMax);

  if (scale.length === 0) {
    return { currentLevel: null, blockedAtLevel: null, openLevels: [], aboveGapLevels: [] };
  }

  let currentLevel: number | null = null;
  let blockedAtLevel: number | null = null;

  for (const level of scale) {
    if (blockedAtLevel !== null) continue;
    if (blocking.has(level)) {
      blockedAtLevel = level;
      continue;
    }
    if (confirmed.has(level)) {
      currentLevel = level;
      continue;
    }
    blockedAtLevel = level;
  }

  const openLevels = blockedAtLevel === null ? [] : scale.filter((level) => level <= blockedAtLevel);
  const aboveGapLevels =
    blockedAtLevel === null ? [] : scale.filter((level) => level > blockedAtLevel && confirmed.has(level));

  return { currentLevel, blockedAtLevel, openLevels, aboveGapLevels };
}

function payloadAnswerState(payload: unknown): DrdRampAnswerState | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = (payload as { answerState?: unknown }).answerState;
  if (raw === 'confirmed' || raw === 'partial' || raw === 'no' || raw === 'dont_know' || raw === 'no_evidence' || raw === 'not_applicable') {
    return raw;
  }
  return null;
}

function isBlockingAnswer(state: DrdRampAnswerState): boolean {
  return state === 'partial' || state === 'no' || state === 'dont_know' || state === 'no_evidence' || state === 'not_applicable';
}

export function deriveDrdRampByUnitFromEvents(events: readonly DrdRampEventLike[]): Record<string, DrdEventRampUnitResult> {
  const byUnit = new Map<string, { confirmed: number[]; blocking: number[]; answerEventIds: string[] }>();

  for (const event of events) {
    if (event.type !== 'ANSWER_CONFIRMED') continue;
    if (!event.unitId || typeof event.level !== 'number' || !Number.isInteger(event.level) || event.level < 1) continue;

    let bucket = byUnit.get(event.unitId);
    if (!bucket) {
      bucket = { confirmed: [], blocking: [], answerEventIds: [] };
      byUnit.set(event.unitId, bucket);
    }
    if (event.id) bucket.answerEventIds.push(event.id);

    const state = payloadAnswerState(event.payload);
    // Backward compatibility for older kernel events that predate answerState:
    // an ANSWER_CONFIRMED event without an answerState was historically a yes.
    if (state === null || state === 'confirmed') {
      bucket.confirmed.push(event.level);
    } else if (isBlockingAnswer(state)) {
      bucket.blocking.push(event.level);
    }
  }

  const result: Record<string, DrdEventRampUnitResult> = {};
  for (const [unitId, bucket] of [...byUnit.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const progression = resolveDrdRampProgression({
      unitId,
      confirmedLevels: bucket.confirmed,
      blockingLevels: bucket.blocking,
    });
    result[unitId] = {
      unitId,
      ...progression,
      answerEventIds: [...bucket.answerEventIds],
      confirmedLevels: normaliseLevels(bucket.confirmed),
      blockingLevels: normaliseLevels(bucket.blocking),
    };
  }
  return result;
}

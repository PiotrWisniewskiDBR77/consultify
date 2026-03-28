/**
 * Narrative Engine — Layer 3: Discourse Planning
 *
 * Builds a structured discourse plan from observations and facts.
 * For each relevant observation creates a narrative arc:
 *   Observation → Explanation → Implication → Recommendation
 *
 * Respects density (concise/balanced/comprehensive) and data_level
 * (data-heavy/balanced/narrative-heavy) to control segment count and word budgets.
 * Deterministic — no LLM calls.
 */

import type {
  DiscoursePlan,
  FactSet,
  NarrativeEngineInput,
  NarrativeSegment,
  Observation,
} from './types.js';

// ── Word-count budgets per density ──────────────────────────────

interface DensityProfile {
  maxObservations: number;
  arcDepth: number; // 1 = obs-only, 2 = +explanation, 3 = +implication, 4 = full arc
  baseWords: number;
  explanationMultiplier: number;
  implicationMultiplier: number;
  recommendationMultiplier: number;
}

const DENSITY_PROFILES: Record<string, DensityProfile> = {
  concise: {
    maxObservations: 3,
    arcDepth: 2,
    baseWords: 40,
    explanationMultiplier: 0.8,
    implicationMultiplier: 0.6,
    recommendationMultiplier: 0.5,
  },
  balanced: {
    maxObservations: 6,
    arcDepth: 3,
    baseWords: 60,
    explanationMultiplier: 1.0,
    implicationMultiplier: 0.9,
    recommendationMultiplier: 0.8,
  },
  comprehensive: {
    maxObservations: 12,
    arcDepth: 4,
    baseWords: 80,
    explanationMultiplier: 1.2,
    implicationMultiplier: 1.1,
    recommendationMultiplier: 1.0,
  },
};

// ── Data-level adjustments ──────────────────────────────────────

interface DataLevelAdjustment {
  factReferenceBoost: number;
  implicationBoost: number;
}

const DATA_LEVEL_ADJUSTMENTS: Record<string, DataLevelAdjustment> = {
  'data-heavy': { factReferenceBoost: 1.5, implicationBoost: 0.7 },
  balanced: { factReferenceBoost: 1.0, implicationBoost: 1.0 },
  'narrative-heavy': { factReferenceBoost: 0.6, implicationBoost: 1.4 },
};

function getDensityProfile(density: string): DensityProfile {
  return DENSITY_PROFILES[density] ?? DENSITY_PROFILES.balanced;
}

function getDataLevelAdjustment(dataLevel: string): DataLevelAdjustment {
  return DATA_LEVEL_ADJUSTMENTS[dataLevel] ?? DATA_LEVEL_ADJUSTMENTS.balanced;
}

/**
 * Build a single narrative arc for an observation.
 */
function buildArc(
  obs: Observation,
  facts: FactSet[],
  profile: DensityProfile,
  dataAdj: DataLevelAdjustment,
  startOrder: number
): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];

  const relatedFacts = facts.filter((f) => obs.related_facts.includes(f.fact_id));
  const factLabels = relatedFacts
    .map((f) => `${f.label}: ${f.value}${f.unit ? ` ${f.unit}` : ''}`)
    .join('; ');

  segments.push({
    order: startOrder,
    segment_type: 'observation',
    content_hint: `${obs.narrative_hint}. Supporting data: ${factLabels || 'N/A'}.`,
    related_observations: [obs.observation_id],
    target_word_count: Math.round(profile.baseWords * dataAdj.factReferenceBoost),
  });

  if (profile.arcDepth >= 2) {
    segments.push({
      order: startOrder + 1,
      segment_type: 'explanation',
      content_hint: `Explain why this ${obs.type} occurred. Reference: ${factLabels || 'context data'}.`,
      related_observations: [obs.observation_id],
      target_word_count: Math.round(
        profile.baseWords * profile.explanationMultiplier * dataAdj.factReferenceBoost
      ),
    });
  }

  if (profile.arcDepth >= 3) {
    segments.push({
      order: startOrder + 2,
      segment_type: 'implication',
      content_hint: `Describe the business implication of this ${obs.type} for the organization.`,
      related_observations: [obs.observation_id],
      target_word_count: Math.round(
        profile.baseWords * profile.implicationMultiplier * dataAdj.implicationBoost
      ),
    });
  }

  if (profile.arcDepth >= 4) {
    segments.push({
      order: startOrder + 3,
      segment_type: 'recommendation',
      content_hint: `Recommend a specific action to address this ${obs.type}. Include evidence and rationale.`,
      related_observations: [obs.observation_id],
      target_word_count: Math.round(profile.baseWords * profile.recommendationMultiplier),
    });
  }

  return segments;
}

/**
 * Build a complete discourse plan for a report section.
 */
export function buildDiscoursePlan(
  observations: Observation[],
  facts: FactSet[],
  input: NarrativeEngineInput
): DiscoursePlan {
  const { report_config, section_key, section_title } = input;
  const profile = getDensityProfile(report_config.density);
  const dataAdj = getDataLevelAdjustment(report_config.data_level);

  const topObservations = observations.slice(0, profile.maxObservations);

  const segments: NarrativeSegment[] = [];
  let orderCounter = 0;

  for (const obs of topObservations) {
    const arc = buildArc(obs, facts, profile, dataAdj, orderCounter);
    segments.push(...arc);
    orderCounter += arc.length;
  }

  if (segments.length === 0) {
    segments.push({
      order: 0,
      segment_type: 'observation',
      content_hint: `General overview for "${section_title}" based on available data.`,
      related_observations: [],
      target_word_count: profile.baseWords * 2,
    });
  }

  return {
    section_key,
    section_title,
    segments,
    communication_register: report_config.communication_register,
    density: report_config.density,
  };
}

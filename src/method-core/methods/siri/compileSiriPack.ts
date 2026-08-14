/**
 * SIRI Method Pack Compiler — 16 Dimensions as the source of truth.
 *
 * Compiles a `MethodPack` (kernel contract, src/method-core/contracts/methodPack.ts)
 * for the Smart Industry Readiness Index (SIRI), where the unit of assessment is
 * the CANONICAL 16 dimensions, not the 8 pillars.
 *
 * ---------------------------------------------------------------------------
 * WHY THE 16 AND NOT THE 8
 * ---------------------------------------------------------------------------
 * `src/services/siriStructure.ts` names its 8-entry array `SIRI_DIMENSIONS` and
 * its 16-entry array `SIRI_PRIORITISATION_AREAS`. Verified against the licensed
 * source (knowledge/SIRI/SIRI-PM Whitepaper.pdf, p.7, "Background: The Smart
 * Industry Readiness Index (2017)" and Figure 4; corroborated by
 * knowledge/SIRI/[SIRI Assessor Training] Module 2 1.pdf, Table of Contents
 * "3.1 The 16 Dimensions of the SIRI Framework" / "4. Assessment Matrix —
 * DIMENSION 1..16"):
 *
 *   SIRI has 3 Building Blocks → 8 Pillars → 16 Dimensions. The 16 Dimensions
 *   are the unit that receives a Band (0–5) in the Assessment Matrix. The 8
 *   Pillars are a grouping layer for reporting, not a scored unit.
 *
 * `siriStructure.ts`'s naming is therefore inverted relative to the licensed
 * canon: its "8 Dimensions" are the 8 Pillars, and its "16 Prioritisation
 * Areas" are the 16 canonical Dimensions. This pack corrects the ROLE (16D is
 * the MethodUnit, 8-pillar is `parentId` grouping) WITHOUT touching
 * `siriStructure.ts` itself (open coordination point COORD-02 — see
 * docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/, this file only reads it).
 *
 * Canon: docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ASSESSMENT_KB_SIRI.md
 * §1 ("Model danych musi zachować 16D; 8 pillars służy grupowaniu i agregacji,
 * nie zastępuje wyników wymiarów.").
 *
 * ---------------------------------------------------------------------------
 * WHAT IS HONESTLY MISSING (do not mistake generic content for canon)
 * ---------------------------------------------------------------------------
 * The licensed training PDF (Module 2 1.pdf, pp.32-69) contains a full,
 * dimension-specific Assessment Matrix — six Band definitions with attributes,
 * per EACH of the 16 dimensions. Its cover page states: "All rights® reserved.
 * No part of this document may be reproduced, stored in a retrieval system, or
 * transmitted in any form or by any means [...] without prior written
 * permission." That content is therefore NOT transcribed here. Every
 * `MethodLevel` below carries an explicit `EVIDENCE_MISSING` marker instead of
 * fabricated or silently-generic band text — see `buildSiriLevels()`.
 *
 * The only band-level text reused from the existing codebase is the generic,
 * already-in-repo `SIRI_MATURITY_LEVELS` title (e.g. "Digital", "Integrated")
 * — that text is Consultify's own paraphrase used app-wide today, not a
 * transcription of the licensed PDF, and it is NOT dimension-specific.
 */

import type {
  MethodCompileReport,
  MethodCompileResult,
  MethodLevel,
  MethodPack,
  MethodPackManifest,
  MethodQuestion,
  MethodSourceRef,
  MethodUnit,
  ScoringFixture,
} from '../../contracts';
import {
  SIRI_MATURITY_LEVELS,
  SIRI_PRIORITISATION_AREAS,
} from '@/services/siriStructure';

export const SIRI_METHOD_PACK_ID = 'siri';
export const SIRI_METHOD_PACK_VERSION = '0.1.0-draft';

/**
 * Structural roles reused verbatim from the source, not invented:
 * knowledge/SIRI/[SIRI Assessor Training] Module 5.pdf §1.3 "Participants" —
 * "Head of Department", "leadership team", cross-functional SMEs who "cover"
 * one or more of the 16 Dimensions.
 */
const SIRI_RESPONDENT_ROLES = [
  'head_of_department',
  'subject_matter_expert',
  'leadership_team',
] as const;

/**
 * `EVIDENCE_MISSING` sentinel used throughout this pack for fields whose real
 * value is licensed content we have not transcribed. Never silently replaced
 * with fabricated prose.
 */
const EVIDENCE_MISSING_MARKER =
  'EVIDENCE_MISSING: per-dimension canonical text not transcribed in this pack ' +
  '(licensed source: knowledge/SIRI/[SIRI Assessor Training] Module 2 1.pdf, ' +
  '§4 Assessment Matrix). Requires owner-approved licensing review before ' +
  'transcription.';

// ---------------------------------------------------------------------------
// Units — the 16 canonical dimensions
// ---------------------------------------------------------------------------

export function buildSiriUnits(): MethodUnit[] {
  return SIRI_PRIORITISATION_AREAS.map((area, index) => ({
    unitId: area.id,
    name: area.name,
    description: area.description,
    // Parent grouping = one of the 8 Pillars (siriStructure.ts calls this
    // field `dimension`, but it is the Pillar id — see file-header note).
    parentId: area.dimension,
    order: index,
    levelScale: [0, 1, 2, 3, 4, 5],
    dependsOnUnitIds: [],
    respondentRoles: SIRI_RESPONDENT_ROLES,
  }));
}

// ---------------------------------------------------------------------------
// Levels — 16 units × 6 bands, honestly incomplete
// ---------------------------------------------------------------------------

/**
 * Conservative default pending owner approval: Module 5 §3.7 only states the
 * GENERAL requirement that "participants must be able to substantiate the
 * selected Band with clear and detailed information and evidence[...]" — it
 * does not differentiate a minimum evidence strength per band. E2 ("artefact
 * pointed to") is picked as the floor because Module 5 explicitly separates a
 * bare declaration from Band substantiation ("clear and DETAILED information
 * AND evidence"). This is a Consultify interpretation, not a canon value —
 * flag for owner sign-off.
 */
export const DEFAULT_MINIMUM_EVIDENCE_STRENGTH = 'E2' as const;

export function buildSiriLevels(): MethodLevel[] {
  const levels: MethodLevel[] = [];
  for (const area of SIRI_PRIORITISATION_AREAS) {
    for (const band of SIRI_MATURITY_LEVELS) {
      const level = band.level;
      levels.push({
        unitId: area.id,
        level,
        title: band.title,
        canonicalDefinition: EVIDENCE_MISSING_MARKER,
        requiredAttributes: [],
        distinctionFromPrevious: EVIDENCE_MISSING_MARKER,
        distinctionFromNext: EVIDENCE_MISSING_MARKER,
        validationQuestionIds: [],
        expectedEvidence: [],
        negativeEvidence: [],
        misScoringTraps:
          level === 0
            ? [EVIDENCE_MISSING_MARKER]
            : [
                EVIDENCE_MISSING_MARKER,
                `No-leapfrog (Module 5 §3.7): Band ${level} cannot be granted unless Band ${
                  level - 1
                } is substantiated first.`,
              ],
        examples: [],
        // Intentionally empty: siriKnowledge.ts DIMENSION_TECH is keyed by the
        // 8-pillar id, not by this 16D unit id. Reusing it here would present
        // pillar-generic tech suggestions as if they were dimension-specific
        // — misleading. Left empty rather than borrowed.
        technologyExamples: [],
        prerequisites: level === 0 ? [] : [level - 1],
        minimumEvidenceStrength: DEFAULT_MINIMUM_EVIDENCE_STRENGTH,
      });
    }
  }
  return levels;
}

// ---------------------------------------------------------------------------
// Questions — honest 0/16 coverage (see SIRI_QBANK_V1_COVERAGE below)
// ---------------------------------------------------------------------------

/**
 * `knowledge/tool-kb/siri/qbank/v1/siri-qbank.en.md` ships exactly ONE
 * dimension bucket: `[dimension_id:all]` — a generic bridge applying to every
 * dimension, not one specific canonical dimension. It also has NO `[level:1]`
 * section (only 0, 2, 3, 4, 5 are present — 15 yes/no questions total).
 *
 * Attaching that generic content to all 16 `MethodUnit`s under their real
 * ids would misrepresent it as dimension-specific coverage. It is therefore
 * NOT compiled into `MethodPack.questions` (kept empty, honestly) and is
 * instead reported here as a measured fact for the DoD / readiness call.
 */
export const SIRI_QBANK_V1_COVERAGE = {
  totalDimensions: 16,
  dimensionsWithDedicatedQuestions: 0,
  genericBridgeQuestionCount: 15,
  bandsCoveredByGenericBridge: [0, 2, 3, 4, 5] as const,
  bandsMissingFromGenericBridge: [1] as const,
  source: 'knowledge/tool-kb/siri/qbank/v1/siri-qbank.en.md',
} as const;

export function buildSiriQuestions(): MethodQuestion[] {
  return [];
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const RETRIEVED_AT = '2026-08-13T00:00:00.000Z';

export function buildSiriSources(): MethodSourceRef[] {
  return [
    {
      sourceId: 'siri-pm-whitepaper',
      title: 'SIRI-PM Whitepaper — The Prioritisation Matrix (EDB / TÜV SÜD, 2020)',
      locator: 'knowledge/SIRI/SIRI-PM Whitepaper.pdf',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'siri-assessor-training-module-2',
      title: 'SIRI Assessor Training Course — Module 2: Smart Industry Readiness Index',
      locator: 'knowledge/SIRI/[SIRI Assessor Training] Module 2 1.pdf',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'siri-assessor-training-module-5',
      title: 'SIRI Assessor Training Course — Module 5: SIRI Assessment Facilitation',
      locator: 'knowledge/SIRI/[SIRI Assessor Training] Module 5.pdf',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'restricted',
    },
    {
      sourceId: 'siri-qbank-v1',
      title: 'SIRI QBank bridge pack v1 (EN)',
      locator: 'knowledge/tool-kb/siri/qbank/v1/siri-qbank.en.md',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
    {
      sourceId: 'siri-structure-runtime',
      title: 'SIRI runtime structure (3 building blocks / 8 pillars / 16 areas)',
      locator: 'src/services/siriStructure.ts',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
    {
      sourceId: 'siri-prioritisation-engine',
      title: 'SIRI Prioritisation Matrix — Impact Value engine (existing implementation)',
      locator: 'src/services/siriPrioritisation.ts',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
    {
      sourceId: 'assessment-kb-siri-canon',
      title: 'ASSESSMENT-KB-SIRI — SIRI knowledge base + Workbench communication canon',
      locator:
        'docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/ASSESSMENT_KB_SIRI.md',
      retrievedAt: RETRIEVED_AT,
      usageRight: 'internal_reference',
    },
  ];
}

// ---------------------------------------------------------------------------
// Scoring fixtures — the 80:20 / no-leapfrog Band table, sourced verbatim
// ---------------------------------------------------------------------------

/**
 * Golden cases mirroring Module 5.pdf §3.7 "Band Scoring of the 16 Dimensions",
 * Table 5.4 "Band Scoring Guidelines" (p.22):
 *
 *   Band 0: if only SOME of the attributes are achieved
 *   Band 1: if 80% or more of the attributes are achieved
 *   Band N (N>=2): if Band N-1 is achieved AND 80%+ of Band N's attributes
 *                  are substantiated
 *
 * Consumed by `siriAdapter.computeScore` and its unit tests.
 */
export function buildSiriScoringFixtures(): ScoringFixture[] {
  return [
    {
      fixtureId: 'siri-8020-full-run-band-3',
      description:
        'Bands 0-3 each >=80% satisfied, Band 4 at 50% (below threshold) — no-leapfrog stops at Band 3.',
      kind: 'valid',
      input: {
        unitId: 'vertical_integration',
        answers: {
          '0': { satisfied: 3, total: 3 },
          '1': { satisfied: 4, total: 5 },
          '2': { satisfied: 4, total: 4 },
          '3': { satisfied: 4, total: 5 },
          '4': { satisfied: 2, total: 4 },
        },
        evidence: { '0': 'E2', '1': 'E2', '2': 'E2', '3': 'E2', '4': 'E1' },
      },
      expected: { proposedLevel: 3, verdict: 'scored' },
    },
    {
      fixtureId: 'siri-8020-boundary-exact-80',
      description: 'Exactly 80% (4/5) is sufficient to satisfy a band — boundary, not below.',
      kind: 'boundary',
      input: {
        unitId: 'horizontal_integration',
        answers: { '0': { satisfied: 1, total: 1 }, '1': { satisfied: 4, total: 5 } },
        evidence: { '0': 'E2', '1': 'E2' },
      },
      expected: { proposedLevel: 1, verdict: 'scored' },
    },
    {
      fixtureId: 'siri-8020-boundary-just-below-80',
      description: '79% (3.95/5, i.e. 3/5=60% here) is NOT sufficient — must stay at the prior band.',
      kind: 'boundary',
      input: {
        unitId: 'horizontal_integration',
        answers: { '0': { satisfied: 1, total: 1 }, '1': { satisfied: 3, total: 5 } },
        evidence: { '0': 'E2', '1': 'E2' },
      },
      expected: { proposedLevel: 0, verdict: 'scored' },
    },
    {
      fixtureId: 'siri-no-leapfrog-band0-to-band2',
      description:
        'Module 5 example verbatim: current state substantiates Band 2 attributes but NOT Band 1 ' +
        '("no leapfrogging from Band 0 to Band 2").',
      kind: 'invalid',
      input: {
        unitId: 'shop_floor_automation',
        answers: {
          '0': { satisfied: 1, total: 1 },
          '1': { satisfied: 1, total: 5 },
          '2': { satisfied: 4, total: 4 },
        },
        evidence: { '0': 'E2', '1': 'E1', '2': 'E2' },
      },
      expected: { proposedLevel: 0, verdict: 'scored' },
    },
    {
      fixtureId: 'siri-no-silent-zero-on-missing-evidence',
      description:
        'No answers supplied at all for a unit — must surface as `needs_evidence`, ' +
        'never silently scored as Band 0. Canon: ASSESSMENT_KB_SIRI.md §3 ' +
        '"brak dowodu pozostaje jawny".',
      kind: 'boundary',
      input: { unitId: 'strategy_governance', answers: {}, evidence: {} },
      expected: { proposedLevel: null, verdict: 'needs_evidence' },
    },
  ];
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export function buildSiriManifest(): MethodPackManifest {
  return {
    id: SIRI_METHOD_PACK_ID,
    name: 'Smart Industry Readiness Index (SIRI)',
    version: SIRI_METHOD_PACK_VERSION,
    ownerUserId: null,
    languages: ['en', 'pl'],
    // Honest readiness: dimension-specific band text is 0/16 transcribed,
    // QBank coverage is 0/16 dimension-specific, aggregation weighting is
    // pending owner approval. This pack cannot start a production session —
    // see `canStartSession()` in contracts/methodPack.ts (only 'released' /
    // 'pilot' may). 'draft' is the honest, non-inflated value.
    readiness: 'draft',
    licence: {
      holder: 'Singapore Economic Development Board (EDB) / TÜV SÜD Asia Pacific Pte Ltd',
      usageRestriction: 'internal_only',
      notice:
        'SIRI is a licensed methodology (EDB, in partnership with TÜV SÜD). Use in ' +
        'Consultify is for educational/internal purposes only. Source PDFs are marked ' +
        '"All rights reserved. No part of this document may be reproduced [...] without ' +
        'prior written permission" — do not copy licensed source text into public or ' +
        'client-facing outputs. See buildSiriSources() usageRight per source.',
    },
  };
}

// ---------------------------------------------------------------------------
// Pack assembly
// ---------------------------------------------------------------------------

/**
 * Coverage counters specific to SIRI. Every number here is measured from the
 * compiled pack, never estimated — they are what justifies `readiness: 'draft'`.
 */
export interface SiriCompileCoverage {
  readonly dimensionsTotal: number;
  readonly pillarsTotal: number;
  readonly buildingBlocksTotal: number;
  readonly bandsPerDimension: number;
  readonly levelsTotal: number;
  /** Levels whose canonical text is a licensed-source gap, not authored content. */
  readonly levelsMarkedEvidenceMissing: number;
  readonly dimensionsWithDedicatedQuestions: number;
  readonly questionsTotal: number;
}

export interface SiriCompileReport extends MethodCompileReport {
  readonly coverage: SiriCompileCoverage;
  /** Human-readable list of what a methodology owner still has to supply. */
  readonly evidenceMissing: readonly string[];
}

function buildSiriCompileReport(pack: MethodPack): SiriCompileReport {
  const levels = pack.levels;
  const levelsMarkedEvidenceMissing = levels.filter((l) =>
    l.canonicalDefinition.startsWith('EVIDENCE_MISSING')
  ).length;
  const pillars = new Set(pack.units.map((u) => u.parentId));

  return {
    readinessRationale:
      `SIRI pack is 'draft': ${levelsMarkedEvidenceMissing}/${levels.length} band descriptors ` +
      'carry EVIDENCE_MISSING because the per-dimension assessment matrix is licensed ' +
      'source material that must not be transcribed, and ' +
      `${SIRI_QBANK_V1_COVERAGE.dimensionsWithDedicatedQuestions}/` +
      `${SIRI_QBANK_V1_COVERAGE.totalDimensions} dimensions have dedicated questions. ` +
      'Mechanics (no-leapfrog, 80:20, aggregation, TIER) are implemented and tested; ' +
      'methodology CONTENT is not. Technical readiness and methodological readiness ' +
      'are deliberately reported apart.',
    discrepancies: [
      'siriStructure.ts names the 8 pillars "SIRI_DIMENSIONS" and the 16 canonical ' +
        'dimensions "SIRI_PRIORITISATION_AREAS" — inverted vs SIRI canon. This pack ' +
        'uses the canonical meaning; the legacy file is untouched pending COORD-02.',
      'QBank v1 holds one generic bucket keyed [dimension_id:all], not per-dimension ' +
        'content; Band 1 is absent from it entirely. Not compiled into questions.',
    ],
    evidenceMissing: [
      'Per-dimension Band descriptors (Bands 0-5 x 16 dimensions) — source: SIRI ' +
        'Assessor Training Module 2, pp. 32-69. LICENSED, must not be transcribed.',
      'Per-dimension x Band question bank — no source in repo.',
      'DOR_c / DOR_k official lookup tables — SIRI-PM Whitepaper pp. 38-39, not encoded.',
      'Industry Best-in-Class benchmarks for 14 industries — Whitepaper p. 40, not encoded.',
      '16D -> 8 pillar aggregation weights — not defined by canon; current rule is ' +
        'PENDING-OWNER-APPROVAL.',
    ],
    coverage: {
      dimensionsTotal: pack.units.length,
      pillarsTotal: pillars.size,
      buildingBlocksTotal: 3,
      bandsPerDimension: 6,
      levelsTotal: levels.length,
      levelsMarkedEvidenceMissing,
      dimensionsWithDedicatedQuestions:
        SIRI_QBANK_V1_COVERAGE.dimensionsWithDedicatedQuestions,
      questionsTotal: pack.questions.length,
    },
  };
}

/**
 * Compiles the SIRI Method Pack.
 *
 * Returns the uniform `{ pack, report }` shape shared by every method compiler
 * (COORD-09). Use `compileSiriPackOnly()` when you genuinely need just the pack.
 */
export function compileSiriPack(): MethodCompileResult<SiriCompileReport> {
  const pack = compileSiriPackOnly();
  return { pack, report: buildSiriCompileReport(pack) };
}

/** The pack alone. Kept as the narrow accessor for adapter/internal use. */
export function compileSiriPackOnly(): MethodPack {
  return {
    manifest: buildSiriManifest(),
    units: buildSiriUnits(),
    levels: buildSiriLevels(),
    questions: buildSiriQuestions(),
    sources: buildSiriSources(),
    scoringFixtures: buildSiriScoringFixtures(),
  };
}

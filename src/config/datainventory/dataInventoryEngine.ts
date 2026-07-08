/**
 * Data Inventory — synthesis engine (RDZEŃ).
 *
 * The pure, testable brain of the tool. It reads a data-inventory session
 * (data-asset registry + AI use-case) and produces the four diagnoses the
 * doctrine (data-inventory.md) demands — assessed as SEPARATE axes, because
 * they are repaired by different interventions:
 *
 *   1. INVENTORY   — the asset map: how many assets, how many orphans (no owner),
 *      how much dark data (never analyzed). Orphan/dark share is a governance
 *      signal, not a scale one.
 *   2. QUALITY     — a per-domain profile across the 8 DAMA-DMBOK dimensions.
 *      The output is a PROFILE, never a single "quality = 72%" number, because
 *      a dedup gap and a completeness gap have different causes and fixes.
 *   3. GOVERNANCE  — a Gartner 5-level maturity per domain, plus the CROSS-DOMAIN
 *      SPREAD (finance audited at 4, production Aware at 1) — the spread is
 *      itself a finding: governance goes where the absence is penalized.
 *   4. AI READINESS — whether the domains a planned AI use-case stands on can
 *      safely feed a model. AI amplifies error, so the quality bar is HIGHER
 *      than a human-facing report's; readiness is set by the WEAKEST critical
 *      domain (the model needs all its domains at once).
 *
 * On top of the diagnosis, the engine surfaces two doctrine-specific risks:
 *   - orphan datasets (no business owner — hidden risk, not a neutral fact)
 *   - dark data (collected but never analyzed — cost + unknown compliance scope)
 *   - "high quality without governance" (a transitional state, not an achievement)
 *
 * Finally it emits a W2-validated GOVERNANCE SEQUENCE, where every move carries
 * rationale / tradeOff / rejectedVariant — the near-literal transfer of the
 * "a move must justify itself" contract, so the UI never renders an unjustified
 * governance move. The sequence enforces the doctrine's order: fix master data
 * BEFORE the AI pilot, never in parallel.
 *
 * Self-contained: depends only on a minimal read-model (DataInventorySession),
 * so it compiles and tests in isolation.
 */

import {
  AI_READINESS_DIMENSIONS,
  DATA_DOMAINS,
  QUALITY_DIMENSIONS,
  dataDomainLabel,
  dataGovernanceLeverLabel,
  GOVERNANCE_MATURITY_LEVELS,
  type AiReadinessDimensionId,
  type Bilingual,
  type DataDomainId,
  type DataGovernanceLeverId,
  type GovernanceMaturityLevel,
  type QualityDimensionId,
} from './deepeningLadder';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round0 = (value: number) => Math.round(value);
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);
const pct = (ratio: number) => Math.round(clamp(ratio, 0, 1) * 100);

/** A 0..1 quality score, or undefined when the dimension was not assessed. */
type Score01 = number | undefined;

// ---------------------------------------------------------------------------
// Read-model
// ---------------------------------------------------------------------------

/**
 * Minimal read-model of one data asset (a dataset / system / "living" sheet).
 * Sourced from the tool's `assets` section.
 */
export interface DataAsset {
  id: string;
  /** Which thematic domain the asset belongs to (customer, finance, ...). */
  domain?: DataDomainId;
  /** Named business owner. Absent/empty => orphan dataset (a governance risk). */
  owner?: string;
  /** Operational data steward. */
  steward?: string;
  /** Whether the asset holds personal/sensitive data (GDPR-relevant). */
  sensitive?: boolean;
  /** Whether the asset is collected but never analyzed (dark data). */
  darkData?: boolean;
  /** How many consumers/users the asset has. 0 => dark-data candidate. */
  consumers?: number;
}

/**
 * Minimal read-model of one domain's assessment: an 8-dimension DAMA quality
 * profile, a Gartner governance maturity level, and how critical the domain is
 * to the planned AI use-case.
 */
export interface DomainAssessment {
  domain: DataDomainId;
  /** 0..1 per-dimension quality scores (missing dimensions => not assessed). */
  quality?: Partial<Record<QualityDimensionId, Score01>>;
  /** Gartner maturity 1..5, or undefined if not assessed. */
  governanceLevel?: GovernanceMaturityLevel;
  /** Whether this domain is critical to the planned AI use-case. */
  criticalForAi?: boolean;
  /** 0..1 per-dimension AI-readiness scores (availability, structure, ...). */
  aiReadiness?: Partial<Record<AiReadinessDimensionId, Score01>>;
}

/** The planned AI use-case the readiness is judged against. */
export interface AiUseCase {
  title?: string;
  /** Domains the use-case stands on (readiness needs ALL of them at once). */
  requiresDomains?: DataDomainId[];
}

/** The minimal data-inventory session shape the engine reads. */
export interface DataInventorySession {
  assets: DataAsset[];
  domains: DomainAssessment[];
  useCase?: AiUseCase;
}

const asScore01 = (raw: unknown): Score01 => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  // Accept 0..1 or 0..100 or 1..5 and normalise to 0..1.
  if (raw <= 1) return clamp(raw, 0, 1);
  if (raw <= 5) return clamp(raw / 5, 0, 1);
  return clamp(raw / 100, 0, 1);
};

/** Is a business owner assigned? (empty/whitespace/placeholder => orphan). */
const hasOwner = (asset: DataAsset): boolean => {
  const o = (asset.owner || '').trim().toLowerCase();
  if (!o) return false;
  return !/^(brak|none|n\/a|unknown|nieznany|-|\?)$/.test(o);
};

/** Dark data: explicitly flagged, or collected with zero consumers. */
const isDarkData = (asset: DataAsset): boolean =>
  asset.darkData === true || (typeof asset.consumers === 'number' && asset.consumers <= 0);

// ---------------------------------------------------------------------------
// (1) Inventory baseline — asset map, orphan share, dark-data share
// ---------------------------------------------------------------------------

export interface InventoryBaseline {
  totalAssets: number;
  /** Assets with no named business owner (orphan datasets). */
  orphanCount: number;
  /** Share of assets that are orphans, 0..1 — a governance signal. */
  orphanShare: number;
  /** Assets collected but never analyzed (dark data). */
  darkDataCount: number;
  darkDataShare: number;
  /** Assets holding personal/sensitive data (GDPR-relevant). */
  sensitiveCount: number;
  /** Sensitive assets that are ALSO orphans — unknown compliance scope. */
  sensitiveOrphanCount: number;
  /** Domains touched by at least one asset. */
  domainsCovered: number;
}

export function computeInventoryBaseline(session: DataInventorySession): InventoryBaseline {
  const assets = session.assets;
  const total = assets.length;
  const orphans = assets.filter((a) => !hasOwner(a));
  const dark = assets.filter(isDarkData);
  const sensitive = assets.filter((a) => a.sensitive);
  const sensitiveOrphan = sensitive.filter((a) => !hasOwner(a));
  const domainsCovered = new Set(assets.map((a) => a.domain).filter(Boolean)).size;

  return {
    totalAssets: total,
    orphanCount: orphans.length,
    orphanShare: total > 0 ? round1(orphans.length / total) : 0,
    darkDataCount: dark.length,
    darkDataShare: total > 0 ? round1(dark.length / total) : 0,
    sensitiveCount: sensitive.length,
    sensitiveOrphanCount: sensitiveOrphan.length,
    domainsCovered,
  };
}

// ---------------------------------------------------------------------------
// (2) Quality profile — 8 DAMA dimensions, per domain and overall
// ---------------------------------------------------------------------------

export interface DomainQualityProfile {
  domain: DataDomainId;
  label: Bilingual;
  /** Per-dimension score 0..1 (only assessed dimensions present). */
  dimensions: Partial<Record<QualityDimensionId, number>>;
  /** Mean across assessed dimensions, 0..1 (never the headline number alone). */
  overall: number;
  /** The weakest assessed dimension — the one that gates trust in the domain. */
  weakestDimension?: { id: QualityDimensionId; score: number };
  /** How many of the 8 dimensions were actually assessed. */
  assessedCount: number;
}

const buildDomainQualityProfile = (assessment: DomainAssessment): DomainQualityProfile => {
  const dims: Partial<Record<QualityDimensionId, number>> = {};
  let sum = 0;
  let count = 0;
  let weakest: { id: QualityDimensionId; score: number } | undefined;

  for (const dimId of QUALITY_DIMENSIONS) {
    const raw = assessment.quality?.[dimId];
    const s = asScore01(raw);
    if (s === undefined) continue;
    dims[dimId] = round1(s);
    sum += s;
    count += 1;
    if (!weakest || s < weakest.score) weakest = { id: dimId, score: round1(s) };
  }

  return {
    domain: assessment.domain,
    label: dataDomainLabel(assessment.domain),
    dimensions: dims,
    overall: count > 0 ? round1(sum / count) : 0,
    weakestDimension: weakest,
    assessedCount: count,
  };
};

export interface QualityDiagnosis {
  profiles: DomainQualityProfile[];
  /** Mean overall across assessed domains, 0..1 — context only, not a verdict. */
  meanOverall: number;
  /** The domain with the lowest overall quality (assessed only). */
  weakestDomain?: DomainQualityProfile;
}

export function assessQuality(session: DataInventorySession): QualityDiagnosis {
  const profiles = session.domains
    .map(buildDomainQualityProfile)
    .filter((p) => p.assessedCount > 0);

  const meanOverall =
    profiles.length > 0
      ? round1(profiles.reduce((acc, p) => acc + p.overall, 0) / profiles.length)
      : 0;
  const weakestDomain =
    profiles.length > 0
      ? profiles.reduce((min, p) => (p.overall < min.overall ? p : min), profiles[0])
      : undefined;

  return { profiles, meanOverall, weakestDomain };
}

// ---------------------------------------------------------------------------
// (3) Governance maturity — Gartner 5 levels + cross-domain spread
// ---------------------------------------------------------------------------

export interface DomainGovernance {
  domain: DataDomainId;
  label: Bilingual;
  level: GovernanceMaturityLevel;
  levelName: Bilingual;
}

export interface GovernanceDiagnosis {
  domains: DomainGovernance[];
  /** Highest / lowest assessed maturity across domains. */
  maxLevel: GovernanceMaturityLevel;
  minLevel: GovernanceMaturityLevel;
  /** maxLevel - minLevel — the cross-domain spread (a doctrine finding). */
  spread: number;
  /** Mean maturity across assessed domains, 1..5. */
  meanLevel: number;
  /**
   * "High quality but low governance" domains — a transitional state that will
   * degrade in months. Each entry names the quality it will lose.
   */
  transitionalRisk: Array<{ domain: DataDomainId; label: Bilingual; quality: number; level: GovernanceMaturityLevel }>;
}

/** Quality-high (>=0.8) + governance-low (<=2) => a transitional-state warning. */
const QUALITY_HIGH = 0.8;
const GOVERNANCE_LOW: GovernanceMaturityLevel = 2;

export function assessGovernance(session: DataInventorySession): GovernanceDiagnosis {
  const quality = assessQuality(session);
  const qualityOf = (d: DataDomainId) =>
    quality.profiles.find((p) => p.domain === d)?.overall ?? undefined;

  const domains: DomainGovernance[] = session.domains
    .filter((d) => d.governanceLevel !== undefined)
    .map((d) => ({
      domain: d.domain,
      label: dataDomainLabel(d.domain),
      level: d.governanceLevel as GovernanceMaturityLevel,
      levelName: GOVERNANCE_MATURITY_LEVELS[d.governanceLevel as GovernanceMaturityLevel].name,
    }));

  const levels = domains.map((d) => d.level);
  const maxLevel = (levels.length ? Math.max(...levels) : 1) as GovernanceMaturityLevel;
  const minLevel = (levels.length ? Math.min(...levels) : 1) as GovernanceMaturityLevel;
  const meanLevel = levels.length
    ? round1(levels.reduce((a, b) => a + b, 0) / levels.length)
    : 0;

  const transitionalRisk = domains
    .map((d) => ({ ...d, quality: qualityOf(d.domain) }))
    .filter((d) => d.quality !== undefined && d.quality >= QUALITY_HIGH && d.level <= GOVERNANCE_LOW)
    .map((d) => ({ domain: d.domain, label: d.label, quality: d.quality as number, level: d.level }));

  return {
    domains,
    maxLevel,
    minLevel,
    spread: domains.length ? maxLevel - minLevel : 0,
    meanLevel,
    transitionalRisk,
  };
}

// ---------------------------------------------------------------------------
// (4) AI readiness — weakest-critical-domain gating + higher quality bar
// ---------------------------------------------------------------------------

/**
 * The AI quality bar is HIGHER than a human-facing report's, because AI
 * amplifies error. A domain "good enough" for a BI dashboard (>=0.7) can still
 * be too weak to safely feed an agent making recommendations (bar 0.8).
 */
export const AI_QUALITY_BAR = 0.8;
export const REPORT_QUALITY_BAR = 0.7;

export interface DomainReadiness {
  domain: DataDomainId;
  label: Bilingual;
  /** Mean of the 5 AI-readiness dimensions (falls back to quality overall). */
  readiness: number;
  /** Whether the domain clears the elevated AI quality bar. */
  clearsAiBar: boolean;
  /** The weakest AI-readiness dimension for this domain, if scored. */
  weakestDimension?: { id: AiReadinessDimensionId; score: number };
  /** Governance maturity of the domain, if assessed (readiness must be durable). */
  governanceLevel?: GovernanceMaturityLevel;
}

export interface AiReadinessDiagnosis {
  useCaseTitle?: string;
  /** Readiness per domain the use-case requires (or all critical domains). */
  perDomain: DomainReadiness[];
  /** The weakest critical domain — it SETS the whole project's readiness. */
  weakestLink?: DomainReadiness;
  /** Overall readiness = the weakest link (model needs all domains at once). */
  overallReadiness: number;
  /** Whether the whole project clears the AI bar (i.e. weakest link clears it). */
  ready: boolean;
  /** Critical domains that block the project (below the AI bar). */
  blockers: DomainReadiness[];
}

const buildDomainReadiness = (
  assessment: DomainAssessment,
  qualityOverall: number
): DomainReadiness => {
  // Prefer explicit AI-readiness dimension scores; fall back to quality overall.
  const scores: number[] = [];
  let weakest: { id: AiReadinessDimensionId; score: number } | undefined;
  for (const dimId of AI_READINESS_DIMENSIONS) {
    const s = asScore01(assessment.aiReadiness?.[dimId]);
    if (s === undefined) continue;
    scores.push(s);
    if (!weakest || s < weakest.score) weakest = { id: dimId, score: round1(s) };
  }
  const readiness = scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : round1(qualityOverall);

  return {
    domain: assessment.domain,
    label: dataDomainLabel(assessment.domain),
    readiness,
    clearsAiBar: readiness >= AI_QUALITY_BAR,
    weakestDimension: weakest,
    governanceLevel: assessment.governanceLevel,
  };
};

export function assessAiReadiness(session: DataInventorySession): AiReadinessDiagnosis {
  const quality = assessQuality(session);
  const qualityOf = (d: DataDomainId) => quality.profiles.find((p) => p.domain === d)?.overall ?? 0;

  const required = session.useCase?.requiresDomains;
  const critical = session.domains.filter((d) =>
    required && required.length > 0 ? required.includes(d.domain) : d.criticalForAi
  );

  const perDomain = critical.map((d) => buildDomainReadiness(d, qualityOf(d.domain)));

  const weakestLink =
    perDomain.length > 0
      ? perDomain.reduce((min, d) => (d.readiness < min.readiness ? d : min), perDomain[0])
      : undefined;

  const overallReadiness = weakestLink ? weakestLink.readiness : 0;
  const blockers = perDomain.filter((d) => !d.clearsAiBar);

  return {
    useCaseTitle: session.useCase?.title,
    perDomain,
    weakestLink,
    overallReadiness,
    ready: perDomain.length > 0 && blockers.length === 0,
    blockers,
  };
}

// ---------------------------------------------------------------------------
// Lever scoring — where the governance effort should concentrate
// ---------------------------------------------------------------------------

export interface LeverScore {
  lever: DataGovernanceLeverId;
  label: Bilingual;
  /** 0..1 urgency of acting on this lever, derived from the diagnoses. */
  urgency: number;
  /** Short machine reason for the urgency (localised at render). */
  reason: Bilingual;
}

/**
 * Score the four governance levers by urgency. Urgency is derived from the
 * facts, not opinion: many orphans/dark data raise `inventory`; a low quality
 * floor raises `quality`; a wide maturity spread or low mean raises
 * `governance`; a blocked AI use-case raises `aiReadiness`.
 */
export function scoreLevers(session: DataInventorySession): LeverScore[] {
  const inv = computeInventoryBaseline(session);
  const q = assessQuality(session);
  const g = assessGovernance(session);
  const ai = assessAiReadiness(session);

  const inventoryUrgency = clamp(
    inv.orphanShare * 0.6 + inv.darkDataShare * 0.4 + (inv.sensitiveOrphanCount > 0 ? 0.2 : 0),
    0,
    1
  );
  // Quality urgency: how far the weakest domain sits below a trustworthy floor.
  const qualityFloor = q.weakestDomain ? q.weakestDomain.overall : 1;
  const qualityUrgency = clamp(1 - qualityFloor, 0, 1);
  // Governance urgency: low mean maturity and/or a wide cross-domain spread.
  const govLevelGap = g.meanLevel > 0 ? clamp((5 - g.meanLevel) / 4, 0, 1) : 0;
  const spreadPenalty = clamp(g.spread / 4, 0, 1) * 0.5;
  const governanceUrgency = clamp(govLevelGap * 0.7 + spreadPenalty, 0, 1);
  // AI readiness urgency: are there critical domains below the elevated bar?
  const aiUrgency =
    ai.perDomain.length === 0
      ? 0
      : clamp(ai.blockers.length / ai.perDomain.length + (1 - ai.overallReadiness) * 0.3, 0, 1);

  const scores: LeverScore[] = [
    {
      lever: 'inventory',
      label: dataGovernanceLeverLabel('inventory'),
      urgency: round1(inventoryUrgency),
      reason: {
        pl: `${pct(inv.orphanShare)}% zbiorów bez właściciela, ${pct(inv.darkDataShare)}% dark data${
          inv.sensitiveOrphanCount > 0 ? `, ${inv.sensitiveOrphanCount} wrażliwych bez właściciela` : ''
        }.`,
        en: `${pct(inv.orphanShare)}% of assets ownerless, ${pct(inv.darkDataShare)}% dark data${
          inv.sensitiveOrphanCount > 0 ? `, ${inv.sensitiveOrphanCount} sensitive without an owner` : ''
        }.`,
      },
    },
    {
      lever: 'quality',
      label: dataGovernanceLeverLabel('quality'),
      urgency: round1(qualityUrgency),
      reason: q.weakestDomain
        ? {
            pl: `Najsłabsza domena „${localize(q.weakestDomain.label, true).toLowerCase()}": jakość ${pct(q.weakestDomain.overall)}%.`,
            en: `Weakest domain "${localize(q.weakestDomain.label, false).toLowerCase()}": quality ${pct(q.weakestDomain.overall)}%.`,
          }
        : { pl: 'Brak ocenionej jakości domen.', en: 'No domain quality assessed.' },
    },
    {
      lever: 'governance',
      label: dataGovernanceLeverLabel('governance'),
      urgency: round1(governanceUrgency),
      reason:
        g.domains.length > 0
          ? {
              pl: `Średnia dojrzałość ${g.meanLevel}/5, rozjazd ${g.spread} poziomów między domenami.`,
              en: `Mean maturity ${g.meanLevel}/5, ${g.spread}-level spread across domains.`,
            }
          : { pl: 'Brak ocenionej dojrzałości governance.', en: 'No governance maturity assessed.' },
    },
    {
      lever: 'aiReadiness',
      label: dataGovernanceLeverLabel('aiReadiness'),
      urgency: round1(aiUrgency),
      reason:
        ai.perDomain.length > 0
          ? {
              pl: `${ai.blockers.length}/${ai.perDomain.length} domen krytycznych poniżej progu AI (gotowość ${pct(ai.overallReadiness)}%).`,
              en: `${ai.blockers.length}/${ai.perDomain.length} critical domains below the AI bar (readiness ${pct(ai.overallReadiness)}%).`,
            }
          : { pl: 'Brak zdefiniowanego przypadku użycia AI.', en: 'No AI use-case defined.' },
    },
  ];

  return scores;
}

// ---------------------------------------------------------------------------
// W2 move validator
// ---------------------------------------------------------------------------

export type W2Field = 'rationale' | 'tradeOff' | 'rejectedVariant';

export interface W2MoveInput {
  title?: string;
  rationale?: string;
  tradeOff?: string;
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;
const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a governance move is only valid when it justifies itself with
 * a rationale, an explicit trade-off, and a rejected variant.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];
  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) missing.push(field);
    else if (isThin(value)) weak.push(field);
  });
  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

// ---------------------------------------------------------------------------
// Governance sequence — the W2-validated roadmap
// ---------------------------------------------------------------------------

export interface SequencedMove {
  order: number;
  lever: DataGovernanceLeverId;
  /** Phase label: master-data repair is Phase 0, the AI pilot is Phase 1. */
  phase: 0 | 1;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

const VALID: W2ValidationResult = { valid: true, missing: [], weak: [] };

/**
 * Build the W2-validated governance sequence. The doctrine's iron rule shapes
 * it: master-data repair (Phase 0) must PRECEDE the AI pilot (Phase 1), never
 * run in parallel — a pilot on bad data yields a model forecasting neatly on
 * bad ground, and the weak result is misread as "AI doesn't work".
 *
 * Sequence logic:
 *   - if orphans/dark data are material -> close the register + assign owners first
 *   - if a critical AI domain is below the elevated bar -> repair its master data
 *     as a HARD Phase-0 blocker, ahead of the pilot
 *   - if a mature domain exists -> replicate its discipline onto the weak one
 *   - always defer the AI pilot behind a stated trade-off until the data is trusted
 */
export function buildGovernanceSequence(session: DataInventorySession): SequencedMove[] {
  const inv = computeInventoryBaseline(session);
  const q = assessQuality(session);
  const g = assessGovernance(session);
  const ai = assessAiReadiness(session);

  const moves: SequencedMove[] = [];
  let order = 1;

  // Phase 0 — close the register + assign owners when orphans/dark data are real.
  if (inv.orphanCount > 0 || inv.darkDataCount > 0) {
    moves.push({
      order: order++,
      lever: 'inventory',
      phase: 0,
      title: {
        pl: 'Domknij rejestr aktywów i przypisz właścicieli biznesowych',
        en: 'Close the asset register and assign business owners',
      },
      rationale: {
        pl: `${inv.orphanCount} z ${inv.totalAssets} zbiorów jest bez właściciela (${pct(inv.orphanShare)}%), a ${inv.darkDataCount} to dark data — ${
          inv.sensitiveOrphanCount > 0
            ? `${inv.sensitiveOrphanCount} zawiera dane wrażliwe bez właściciela, więc to ryzyko compliance nieznanego zakresu, nie nieporządek.`
            : 'to sieroce zbiory degradujące się cicho, dopóki błąd nie wybuchnie w decyzji zarządu.'
        }`,
        en: `${inv.orphanCount} of ${inv.totalAssets} assets have no owner (${pct(inv.orphanShare)}%) and ${inv.darkDataCount} are dark data — ${
          inv.sensitiveOrphanCount > 0
            ? `${inv.sensitiveOrphanCount} hold sensitive data with no owner, so this is compliance risk of unknown scope, not untidiness.`
            : 'orphan datasets degrade silently until the error surfaces in a board decision.'
        }`,
      },
      tradeOff: {
        pl: 'Kosztem tygodni pracy wywiadowej i decyzji o odpowiedzialności, zanim ruszy jakikolwiek projekt AI — ale to przedwarunek, nie zadanie równoległe.',
        en: 'At the cost of weeks of discovery work and accountability decisions before any AI project starts — but this is a precondition, not a parallel task.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „katalog techniczny w narzędziu i tyle": inwentarz bez imiennego właściciela biznesowego odtwarza problem sierocego zbioru z ładniejszą fasadą.',
        en: 'We reject "a technical catalog in a tool and done": an inventory with no named business owner recreates the orphan-dataset problem behind a prettier facade.',
      },
      expectedImpact: inv.sensitiveOrphanCount > 0 ? 'high' : 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // Phase 0 — repair master data of the weakest critical AI domain BEFORE the pilot.
  const blocker = ai.blockers.length > 0 ? ai.blockers[0] : ai.weakestLink;
  if (blocker && !blocker.clearsAiBar) {
    const prof = q.profiles.find((p) => p.domain === blocker.domain);
    const weak = prof?.weakestDimension;
    moves.push({
      order: order++,
      lever: 'quality',
      phase: 0,
      title: {
        pl: `Napraw master data domeny „${localize(blocker.label, true).toLowerCase()}" przed pilotem AI`,
        en: `Repair master data of the "${localize(blocker.label, false).toLowerCase()}" domain before the AI pilot`,
      },
      rationale: {
        pl: `To najsłabsze ogniwo (gotowość ${pct(blocker.readiness)}%${
          weak ? `, najsłabszy wymiar: ${pct(weak.score)}%` : ''
        }) — a model potrzebuje wszystkich krytycznych domen naraz, więc ta jedna domena wyznacza readiness całego projektu. Próg jakości pod AI jest wyższy niż pod raport dla ludzi, bo AI amplifikuje błąd.`,
        en: `This is the weakest link (readiness ${pct(blocker.readiness)}%${
          weak ? `, weakest dimension: ${pct(weak.score)}%` : ''
        }) — the model needs all critical domains at once, so this one domain sets the whole project's readiness. The AI quality bar is higher than a human report's, because AI amplifies error.`,
      },
      tradeOff: {
        pl: 'Kosztem opóźnienia startu pilota o Fazę 0 (konsolidacja źródeł, wspólny identyfikator, walidacja) — w zamian za model, który nie prognozuje pewnie na złym gruncie.',
        en: 'At the cost of delaying the pilot by a Phase 0 (source consolidation, a shared identifier, validation) — in exchange for a model that does not forecast confidently on bad ground.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „pilot równolegle, dane doczyścimy po drodze": tymczasowość trwa, a słaby wynik pilota na złych danych zostanie odczytany jako „AI nie działa", zamiast „dane nie były gotowe".',
        en: 'We reject "run the pilot in parallel, clean data along the way": the temporary lasts, and a weak pilot result on bad data reads as "AI doesn’t work" instead of "the data wasn’t ready".',
      },
      expectedImpact: 'high',
      estimatedEffort: 'high',
      validation: VALID,
    });
  }

  // Phase 0 — replicate a mature domain's discipline onto the weakest one.
  if (g.spread >= 2 && g.domains.length >= 2) {
    const mature = g.domains.reduce((a, b) => (b.level > a.level ? b : a), g.domains[0]);
    const weakDom = g.domains.reduce((a, b) => (b.level < a.level ? b : a), g.domains[0]);
    moves.push({
      order: order++,
      lever: 'governance',
      phase: 0,
      title: {
        pl: `Przenieś dyscyplinę z „${localize(mature.label, true).toLowerCase()}" na „${localize(weakDom.label, true).toLowerCase()}"`,
        en: `Replicate discipline from "${localize(mature.label, false).toLowerCase()}" onto "${localize(weakDom.label, false).toLowerCase()}"`,
      },
      rationale: {
        pl: `Rozjazd dojrzałości wynosi ${g.spread} poziomów (${localize(mature.label, true).toLowerCase()} na ${mature.level}, ${localize(weakDom.label, true).toLowerCase()} na ${weakDom.level}) — governance poszedł tam, gdzie jest kara za jego brak, nie tam, gdzie jest wartość. Replikacja rytmu przeglądu, jasnego właściciela i metryk to najszybsza droga 2→3.`,
        en: `The maturity spread is ${g.spread} levels (${localize(mature.label, false).toLowerCase()} at ${mature.level}, ${localize(weakDom.label, false).toLowerCase()} at ${weakDom.level}) — governance went where its absence is penalized, not where the value is. Replicating the review rhythm, a clear owner and metrics is the fastest 2→3 path.`,
      },
      tradeOff: {
        pl: 'Kosztem czasu właścicieli domeny wzorcowej na przekazanie praktyk — w zamian za odwrócenie historycznego rozjazdu priorytetów zamiast budowania governance od zera.',
        en: 'At the cost of the mature domain owners’ time to hand over practices — in exchange for reversing the historical priority spread instead of building governance from scratch.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „jeden wielki program governance dla całej firmy naraz": rozlewa wysiłek i gubi domenę krytyczną dla AI w morzu domen o niskiej krytyczności.',
        en: 'We reject "one big company-wide governance program at once": it spreads the effort thin and loses the AI-critical domain in a sea of low-criticality ones.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // Phase 0 — warn on "high quality without governance" transitional risk.
  if (g.transitionalRisk.length > 0) {
    const t = g.transitionalRisk[0];
    moves.push({
      order: order++,
      lever: 'governance',
      phase: 0,
      title: {
        pl: `Zabezpiecz jakość domeny „${localize(t.label, true).toLowerCase()}" stewardem, zanim spadnie`,
        en: `Lock in the "${localize(t.label, false).toLowerCase()}" domain’s quality with a steward before it slips`,
      },
      rationale: {
        pl: `Domena ma dziś wysoką jakość (${pct(t.quality)}%), ale governance na poziomie ${t.level} i brak procesu walidacji nowych rekordów — to stan tymczasowy: bez stewarda jakość spadnie w 6-12 miesięcy wraz z napływem nieaudytowanych danych.`,
        en: `The domain has high quality today (${pct(t.quality)}%) but governance at level ${t.level} and no validation of new records — a transitional state: without a steward the quality slips within 6-12 months as unaudited data flows in.`,
      },
      tradeOff: {
        pl: 'Kosztem powołania stewarda i lekkiego procesu walidacji na wejściu — tanim teraz, zamiast kosztownego odzyskiwania jakości po jej degradacji.',
        en: 'At the cost of naming a steward and a light entry-validation process — cheap now, versus expensive quality recovery after it has degraded.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „jakość jest dobra, zostawmy to": wysoka jakość bez governance to migawka, nie osiągnięcie — nowe rekordy wejdą bez tej samej dyscypliny co historyczne.',
        en: 'We reject "quality is fine, leave it": high quality without governance is a snapshot, not an achievement — new records enter without the discipline the historical ones had.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // Phase 1 — the AI pilot, gated behind trusted data.
  moves.push({
    order: order++,
    lever: 'aiReadiness',
    phase: 1,
    title: {
      pl: 'Uruchom pilot AI dopiero na oczyszczonych, zaufanych domenach',
      en: 'Launch the AI pilot only on cleaned, trusted domains',
    },
    rationale: {
      pl:
        ai.perDomain.length > 0
          ? `Pilot „${ai.useCaseTitle ?? 'AI'}" stoi na ${ai.perDomain.length} domenach; gotowość całego projektu = najsłabsze ogniwo (${pct(ai.overallReadiness)}%). Rusza dopiero po Fazie 0, bo model amplifikuje błąd wejściowego źródła płynnie i pewnie.`
          : `Pilot AI stoi na domenach danych, których gotowość wyznacza najsłabsze ogniwo — rusza dopiero po naprawie master data, bo model amplifikuje błąd wejściowego źródła płynnie i pewnie.`,
      en:
        ai.perDomain.length > 0
          ? `The "${ai.useCaseTitle ?? 'AI'}" pilot stands on ${ai.perDomain.length} domains; whole-project readiness = the weakest link (${pct(ai.overallReadiness)}%). It starts only after Phase 0, because the model amplifies the input source's error smoothly and confidently.`
          : `The AI pilot stands on data domains whose readiness is set by the weakest link — it starts only after master-data repair, because the model amplifies the input source's error smoothly and confidently.`,
    },
    tradeOff: {
      pl: 'Kosztem odłożenia startu o Fazę 0 — w zamian za wynik pilota, który mierzy model, a nie jakość danych; słaby wynik na złych danych zostałby mylnie odczytany jako porażka AI.',
      en: 'At the cost of deferring the start by Phase 0 — in exchange for a pilot result that measures the model, not the data quality; a weak result on bad data would be misread as an AI failure.',
    },
    rejectedVariant: {
      pl: 'Odrzucamy start pilota równolegle z naprawą danych: presja „zarząd chce AI w tym kwartale" prowadzi do modelu, który ładnie prognozuje na złym gruncie i utrwala fałszywy wniosek o gotowości.',
      en: 'We reject launching the pilot in parallel with the data repair: the "the board wants AI this quarter" pressure yields a model forecasting neatly on bad ground and cements a false readiness conclusion.',
    },
    expectedImpact: 'high',
    estimatedEffort: 'medium',
    validation: VALID,
  });

  return moves;
}

// ---------------------------------------------------------------------------
// One-shot synthesis
// ---------------------------------------------------------------------------

export interface DataInventoryScore {
  /** 0..100 overall data-health index (inventory + quality + governance + AI). */
  overall: number;
  /** 0..100 sub-scores, so a low overall is diagnosable, not a black box. */
  inventoryHealth: number;
  qualityHealth: number;
  governanceHealth: number;
  aiReadinessHealth: number;
}

/**
 * Deterministic 0..100 scoring. Overall is deliberately gated by AI readiness
 * when a use-case exists (the weakest critical domain caps the project), and by
 * governance otherwise (quality without governance is transitional).
 */
export function scoreDataInventory(session: DataInventorySession): DataInventoryScore {
  const inv = computeInventoryBaseline(session);
  const q = assessQuality(session);
  const g = assessGovernance(session);
  const ai = assessAiReadiness(session);

  const inventoryHealth = round0(clamp(1 - inv.orphanShare * 0.6 - inv.darkDataShare * 0.4, 0, 1) * 100);
  const qualityHealth = round0((q.weakestDomain ? q.weakestDomain.overall : q.meanOverall) * 100);
  const governanceHealth = round0(clamp(g.meanLevel > 0 ? (g.meanLevel - 1) / 4 - g.spread * 0.05 : 0, 0, 1) * 100);
  const aiReadinessHealth = ai.perDomain.length > 0 ? round0(ai.overallReadiness * 100) : governanceHealth;

  // Overall gated by the weakest of the four, then nudged by the mean — so one
  // hard blocker (a below-bar critical AI domain) cannot be averaged away.
  const parts = [inventoryHealth, qualityHealth, governanceHealth, aiReadinessHealth];
  const min = Math.min(...parts);
  const mean = parts.reduce((a, b) => a + b, 0) / parts.length;
  const overall = round0(min * 0.6 + mean * 0.4);

  return { overall, inventoryHealth, qualityHealth, governanceHealth, aiReadinessHealth };
}

export interface DataInventoryDiagnosis {
  inventory: InventoryBaseline;
  quality: QualityDiagnosis;
  governance: GovernanceDiagnosis;
  aiReadiness: AiReadinessDiagnosis;
  levers: LeverScore[];
  sequence: SequencedMove[];
  score: DataInventoryScore;
}

/** One-shot synthesis: all four diagnoses + lever scores + W2 sequence + score. */
export function synthesizeDataInventory(session: DataInventorySession): DataInventoryDiagnosis {
  return {
    inventory: computeInventoryBaseline(session),
    quality: assessQuality(session),
    governance: assessGovernance(session),
    aiReadiness: assessAiReadiness(session),
    levers: scoreLevers(session),
    sequence: buildGovernanceSequence(session),
    score: scoreDataInventory(session),
  };
}

// ---------------------------------------------------------------------------
// Adapter: OperationalToolData sections -> DataInventorySession
// ---------------------------------------------------------------------------

const asDomainId = (raw: unknown): DataDomainId | undefined =>
  (DATA_DOMAINS as string[]).includes(raw as string) ? (raw as DataDomainId) : undefined;

const asLevel = (raw: unknown): GovernanceMaturityLevel | undefined => {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return n >= 1 && n <= 5 ? (Math.round(n) as GovernanceMaturityLevel) : undefined;
};

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|tak|dark|sensitive|orphan|1/i.test(raw));

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

const readDimMap = <K extends string>(
  raw: unknown,
  keys: readonly K[]
): Partial<Record<K, number>> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const out: Partial<Record<K, number>> = {};
  let any = false;
  for (const k of keys) {
    const v = asNumber(src[k]);
    if (v !== undefined) {
      out[k] = v;
      any = true;
    }
  }
  return any ? out : undefined;
};

/**
 * Extract a DataInventorySession from the operational tool's `sections`. Reads
 * `assets` (data-asset registry), `domains` (per-domain assessment) and
 * `useCase` defensively; unknown values fall back to sane defaults rather than
 * throwing, so a partially filled tool still yields a usable diagnosis.
 */
export function toDataInventorySession(
  sections: Record<string, unknown[]> | undefined
): DataInventorySession {
  const rawAssets = ((sections?.['assets'] || sections?.['datasets'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawDomains = ((sections?.['domains'] || sections?.['assessments'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawUseCase = ((sections?.['useCase'] || sections?.['aiUseCase'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const assets: DataAsset[] = rawAssets.map((item, idx) => ({
    id: String(item.id ?? `asset-${idx}`),
    domain: asDomainId(item.domain ?? item.category),
    owner: typeof item.owner === 'string' ? item.owner : undefined,
    steward: typeof item.steward === 'string' ? item.steward : undefined,
    sensitive: truthy(item.sensitive),
    darkData: truthy(item.darkData) || truthy(item.dark),
    consumers: asNumber(item.consumers) ?? asNumber(item.users),
  }));

  const domains: DomainAssessment[] = rawDomains.map((item) => ({
    domain: asDomainId(item.domain ?? item.category) ?? 'operations',
    quality: readDimMap(item.quality, QUALITY_DIMENSIONS),
    governanceLevel: asLevel(item.governanceLevel ?? item.level ?? item.maturity),
    criticalForAi: truthy(item.criticalForAi) || truthy(item.critical),
    aiReadiness: readDimMap(item.aiReadiness, AI_READINESS_DIMENSIONS),
  }));

  const first = rawUseCase[0];
  const useCase: AiUseCase | undefined = first
    ? {
        title: typeof first.title === 'string' ? first.title : undefined,
        requiresDomains: Array.isArray(first.requiresDomains)
          ? (first.requiresDomains as unknown[]).map(asDomainId).filter((d): d is DataDomainId => !!d)
          : undefined,
      }
    : undefined;

  return { assets, domains, useCase };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; lever: DataGovernanceLeverId; phase: 0 | 1 } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    lever: seq.lever,
    phase: seq.phase,
  };
}

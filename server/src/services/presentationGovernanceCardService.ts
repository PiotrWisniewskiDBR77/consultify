/**
 * Presentation Governance Card Service
 *
 * Aggregates Quality, Confidentiality, and Telemetry signals into a single
 * Governance Card payload usable by CI gates and admin dashboards.
 *
 * Pure, side-effect-free aggregation. No DB access, no I/O.
 * Inputs are intentionally typed via local "Like" shapes to avoid coupling
 * this aggregator to upstream module paths.
 */

export type GovernanceVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE';

export type GovernanceConfidentialityLevel = 'public' | 'internal' | 'confidential';

export interface PresentationGovernanceCard {
  deckId: string;
  generatedAt: string;
  quality: {
    verdict: GovernanceVerdict;
    p0: number;
    p1: number;
    p2: number;
    gateCount: number;
  };
  confidentiality: {
    level: GovernanceConfidentialityLevel;
    sharingAllowedForRole?: string;
  };
  telemetry: {
    windowDays: number;
    proposalsCreated: number;
    editsApplied: number;
    editsRejected: number;
    exportsBlocked: number;
    lastActivityAt: string | null;
  };
  overallVerdict: GovernanceVerdict;
}

interface DeckQualityReportLike {
  result?: 'PASS' | 'PASS_WITH_P2' | 'BLOCKED_P1' | 'INCONCLUSIVE';
  scorecard?: {
    p0?: number;
    p1?: number;
    p2?: number;
    gateCount?: number;
  };
  gates?: Array<{
    priority?: 'P0' | 'P1' | 'P2';
    result?: 'PASS' | 'WARN' | 'BLOCKED' | 'INCONCLUSIVE';
  }>;
}

interface TelemetryRollupLike {
  windowDays: number;
  totals: {
    proposalsCreated: number;
    editsApplied: number;
    editsRejected: number;
    exportsBlocked: number;
    noops: number;
    total: number;
  };
  lastActivityAt: string | null;
}

export interface BuildPresentationGovernanceCardInput {
  deckId: string;
  qualityReport: DeckQualityReportLike | null;
  confidentialityLevel?: GovernanceConfidentialityLevel | null;
  callerRole?: string | null;
  telemetryRollup: TelemetryRollupLike | null;
  now?: Date;
}

function normalizeRole(role: string | null | undefined): string {
  const raw = String(role || '')
    .trim()
    .toUpperCase();
  if (raw.includes('SUPER')) return 'SUPERADMIN';
  if (raw === 'OWNER') return 'OWNER';
  if (raw === 'ADMIN' || raw === 'ADMINISTRATOR') return 'ADMIN';
  if (raw === 'PROJECT_MANAGER' || raw === 'MANAGER') return 'PROJECT_MANAGER';
  if (raw === 'USER' || raw === 'TEAM_MEMBER' || raw === 'MEMBER') return 'USER';
  return 'VIEWER';
}

// Mirrors isPresentationActionAllowedByConfidentiality({ action: 'share', ... })
// Re-implemented locally to keep the aggregator decoupled from the policy module.
function isShareAllowedFor(
  level: GovernanceConfidentialityLevel,
  role: string | null | undefined
): boolean {
  const normalized = normalizeRole(role);
  if (level === 'confidential') {
    return ['SUPERADMIN', 'OWNER', 'ADMIN', 'PROJECT_MANAGER'].includes(normalized);
  }
  if (level !== 'public' && normalized === 'PROJECT_MANAGER') {
    return false;
  }
  return true;
}

function deriveQuality(
  qualityReport: DeckQualityReportLike | null
): PresentationGovernanceCard['quality'] {
  if (!qualityReport) {
    return { verdict: 'INCONCLUSIVE', p0: 0, p1: 0, p2: 0, gateCount: 0 };
  }

  const scorecard = qualityReport.scorecard || {};
  const gates = Array.isArray(qualityReport.gates) ? qualityReport.gates : [];

  const p0 =
    typeof scorecard.p0 === 'number'
      ? scorecard.p0
      : gates.filter((g) => g?.priority === 'P0' && g?.result === 'BLOCKED').length;
  const p1 =
    typeof scorecard.p1 === 'number'
      ? scorecard.p1
      : gates.filter((g) => g?.priority === 'P1' && g?.result === 'BLOCKED').length;
  const p2 =
    typeof scorecard.p2 === 'number'
      ? scorecard.p2
      : gates.filter((g) => g?.priority === 'P2' && g?.result === 'WARN').length;
  const gateCount =
    typeof scorecard.gateCount === 'number' ? scorecard.gateCount : gates.length;

  let verdict: GovernanceVerdict =
    (qualityReport.result as GovernanceVerdict | undefined) || 'INCONCLUSIVE';

  // Hard override: any P0 BLOCKED gate forces BLOCKED_P0 regardless of upstream result.
  if (p0 > 0) verdict = 'BLOCKED_P0';

  return { verdict, p0, p1, p2, gateCount };
}

function deriveConfidentiality(
  level: GovernanceConfidentialityLevel | null | undefined,
  callerRole: string | null | undefined
): PresentationGovernanceCard['confidentiality'] {
  const resolvedLevel: GovernanceConfidentialityLevel = level || 'internal';
  const out: PresentationGovernanceCard['confidentiality'] = { level: resolvedLevel };
  if (callerRole != null && String(callerRole).trim().length > 0) {
    out.sharingAllowedForRole = isShareAllowedFor(resolvedLevel, callerRole)
      ? 'allowed'
      : 'blocked';
  }
  return out;
}

function deriveTelemetry(
  rollup: TelemetryRollupLike | null
): PresentationGovernanceCard['telemetry'] {
  if (!rollup) {
    return {
      windowDays: 0,
      proposalsCreated: 0,
      editsApplied: 0,
      editsRejected: 0,
      exportsBlocked: 0,
      lastActivityAt: null,
    };
  }
  const totals = rollup.totals || {
    proposalsCreated: 0,
    editsApplied: 0,
    editsRejected: 0,
    exportsBlocked: 0,
    noops: 0,
    total: 0,
  };
  return {
    windowDays: rollup.windowDays,
    proposalsCreated: totals.proposalsCreated,
    editsApplied: totals.editsApplied,
    editsRejected: totals.editsRejected,
    exportsBlocked: totals.exportsBlocked,
    lastActivityAt: rollup.lastActivityAt,
  };
}

function deriveOverallVerdict(
  qualityVerdict: GovernanceVerdict,
  exportsBlocked: number
): GovernanceVerdict {
  if (qualityVerdict === 'BLOCKED_P0') return 'BLOCKED_P0';
  if (qualityVerdict === 'BLOCKED_P1') return 'BLOCKED_P1';
  if (exportsBlocked > 0) return 'BLOCKED_P1';
  if (qualityVerdict === 'PASS_WITH_P2') return 'PASS_WITH_P2';
  if (qualityVerdict === 'INCONCLUSIVE') return 'INCONCLUSIVE';
  return 'PASS';
}

export function buildPresentationGovernanceCard(
  input: BuildPresentationGovernanceCardInput
): PresentationGovernanceCard {
  const generatedAt = (input.now || new Date()).toISOString();

  const quality = deriveQuality(input.qualityReport);
  const confidentiality = deriveConfidentiality(input.confidentialityLevel, input.callerRole);
  const telemetry = deriveTelemetry(input.telemetryRollup);
  const overallVerdict = deriveOverallVerdict(quality.verdict, telemetry.exportsBlocked);

  return {
    deckId: input.deckId,
    generatedAt,
    quality,
    confidentiality,
    telemetry,
    overallVerdict,
  };
}

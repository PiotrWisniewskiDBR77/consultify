/**
 * MethodOutputService — persists immutable AssessmentOutput freezes.
 *
 * Persists into `method_outputs` / `method_findings`
 * (server/migrations/20260813_method_outputs.sql). Mirrors the validation
 * rules of the pure `src/method-core/outputs/assessmentOutput.ts` factory
 * (methodology.version + limitations required, every finding needs >= 1
 * supporting evidence item) — duplicated here rather than imported because
 * `server/tsconfig.build.json` has `rootDir: "."` relative to `server/` and
 * a relative import reaching into the repo-root `src/` tree fails that
 * production build with TS6059 (same constraint documented at the top of
 * server/src/method-core/contracts/index.ts). Keep the two validation
 * functions in sync by hand when either one's rule changes.
 *
 * ★ IMMUTABILITY IS STRUCTURAL, NOT A CONVENTION: this class has no
 * `updateOutput`/`patchOutput` method, and `freezeOutput` only ever INSERTs.
 * Nothing in this file issues an `UPDATE method_outputs ...` statement — a
 * correction is a brand new row via `revisionOfOutputId`. Whether an Output
 * has since been superseded is answered by `isSuperseded()`, a READ that
 * looks for a newer row pointing back at this one; it never writes a
 * "superseded" pointer onto the historical row (see the migration's comment
 * on why there is no `superseded_by_output_id` column on this table).
 *
 * Canon: ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §2, §6;
 * METHOD_MODULE_FIVE_SURFACES_STANDARD.md §4.
 */

import * as DbPromise from '../../utils/DbPromise.js';
import { computeContentHash, genId, nowIso, parseJson, runOrThrow } from '../db.js';

// ---------------------------------------------------------------------------
// Row / record shapes (server-local — not imported from src/, see header)
// ---------------------------------------------------------------------------

export interface EvidenceLocatorInput {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly strength: 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
  readonly locator: string;
  readonly title?: string;
}

export interface OutputFindingInput {
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  /** REQUIRED, non-empty — enforced by `validateFreezeInput`. */
  readonly supportingEvidence: readonly EvidenceLocatorInput[];
  /** May be empty — absence of contradiction is a valid, common state. */
  readonly contradictingEvidence: readonly EvidenceLocatorInput[];
  readonly businessMeaning: string;
  readonly rootCauseHypothesis?: string | null;
  readonly riskOrOpportunity?: string | null;
  readonly recommendation: string;
  readonly prerequisite?: string | null;
  readonly expectedOutcome?: string | null;
  readonly kpiProposal?: unknown;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly priorityRationale?: string | null;
  readonly sourceLocators?: readonly string[];
}

export interface FreezeOutputInput {
  readonly organizationId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly module: 'assessment' | 'tools' | 'audits';
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly scope: string;
  readonly current: Readonly<Record<string, number | null>>;
  readonly target: Readonly<Record<string, number | null>>;
  readonly gap: Readonly<Record<string, number | null>>;
  readonly aggregation: unknown;
  readonly visualModel: unknown;
  readonly evidenceCompleteness: unknown;
  /** REQUIRED, non-empty — enforced by `validateFreezeInput`. */
  readonly limitations: readonly string[];
  readonly findings: readonly OutputFindingInput[];
  readonly prioritisationResult: unknown;
  /** Set when this freeze is produced by reopening a previously frozen Output. */
  readonly revisionOfOutputId?: string | null;
  readonly sourceRevisionOfSessionId?: string | null;
  /**
   * ★ Explicit demonstration marker (CLAUDE.md rule #7 / demoBypass.ts):
   * true iff the session this Output was frozen from was created through
   * the demo bypass of the pack-readiness gate. Durable and visible on every
   * read of this Output (`GET /outputs/:id`, the `freeze` response's
   * `output` field) — never inferred client-side, never silently dropped on
   * a revision (see EventDerivedOutputBridge: inherited from the session
   * row, which itself inherits it across `frozen -> active` reopens).
   */
  readonly demoBypassActive?: boolean;
}

export interface MethodFindingRecord {
  readonly id: string;
  readonly outputId: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly supportingEvidence: readonly EvidenceLocatorInput[];
  readonly contradictingEvidence: readonly EvidenceLocatorInput[];
  readonly businessMeaning: string;
  readonly rootCauseHypothesis: string | null;
  readonly riskOrOpportunity: string | null;
  readonly recommendation: string;
  readonly prerequisite: string | null;
  readonly expectedOutcome: string | null;
  readonly kpiProposal: unknown;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly priorityRationale: string | null;
  readonly sourceLocators: readonly string[];
  readonly createdAt: string;
}

/**
 * List filter for `listForOrganization` — org-scoped by construction
 * (`organizationId` is required, never optional, so a caller cannot forget
 * to scope a list read). `sessionIds` is how a `projectId` filter reaches
 * this service: the route resolves `projectId -> session ids` via
 * `MethodSessionService.listSessionIdsByProject` first (this service has no
 * `project_id` column of its own — every Output's project lives on its
 * session), then passes the resolved set down here.
 */
export interface ListOutputsFilter {
  readonly organizationId: string;
  readonly sessionId?: string;
  readonly sessionIds?: readonly string[];
  /** Computed in-memory from `revision_of_output_id` links — see below. */
  readonly status?: 'current' | 'superseded';
  readonly limit: number;
  readonly offset: number;
}

export interface MethodOutputListItem extends MethodOutputRecord {
  readonly status: 'current' | 'superseded';
  readonly supersededByOutputId: string | null;
}

export interface ListResult<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export interface MethodOutputRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly module: 'assessment' | 'tools' | 'audits';
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly outputVersion: number;
  readonly revisionOfOutputId: string | null;
  readonly scope: string;
  readonly current: Readonly<Record<string, number | null>>;
  readonly target: Readonly<Record<string, number | null>>;
  readonly gap: Readonly<Record<string, number | null>>;
  readonly aggregation: unknown;
  readonly visualModel: unknown;
  readonly evidenceCompleteness: unknown;
  readonly limitations: readonly string[];
  readonly findings: readonly MethodFindingRecord[];
  readonly prioritisationResult: unknown;
  readonly sourceRevisionOfSessionId: string | null;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly frozenAt: string;
  /** See `FreezeOutputInput.demoBypassActive`. */
  readonly demoBypassActive: boolean;
}

interface MethodOutputRow {
  id: string;
  organization_id: string;
  session_id: string;
  snapshot_id: string;
  module: string;
  method_pack_id: string;
  method_pack_version: string;
  output_version: number;
  revision_of_output_id: string | null;
  scope: string;
  current_json: unknown;
  target_json: unknown;
  gap_json: unknown;
  aggregation_json: unknown;
  visual_model_json: unknown;
  evidence_completeness_json: unknown;
  limitations_json: unknown;
  prioritisation_json: unknown;
  lineage_json: unknown;
  content_hash: string;
  created_at: string;
  frozen_at: string;
  demo_bypass_active: boolean;
}

interface MethodFindingRow {
  id: string;
  organization_id: string;
  output_id: string;
  unit_id: string;
  unit_name: string;
  current_level: number | null;
  target_level: number | null;
  gap: number | null;
  supporting_evidence_json: unknown;
  contradicting_evidence_json: unknown;
  business_meaning: string;
  root_cause_hypothesis: string | null;
  risk_or_opportunity: string | null;
  recommendation: string;
  prerequisite: string | null;
  expected_outcome: string | null;
  kpi_proposal_json: unknown;
  confidence: string;
  priority_rationale: string | null;
  source_locators_json: unknown;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Validation — mirrors src/method-core/outputs/assessmentOutput.ts + finding.ts
// ---------------------------------------------------------------------------

export class OutputValidationError extends Error {
  constructor(
    message: string,
    public readonly reasons: readonly string[]
  ) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

export function validateFreezeInput(input: FreezeOutputInput): string[] {
  const reasons: string[] = [];

  if (!input.methodPackVersion || input.methodPackVersion.trim() === '') {
    reasons.push('methodology.version is required — an Output cannot be pinned to no version');
  }
  if (!input.methodPackId || input.methodPackId.trim() === '') {
    reasons.push('methodology.methodPackId is required');
  }
  if (!input.limitations || input.limitations.length === 0) {
    reasons.push(
      'limitations must be non-empty — an honest Output always states what it does not cover'
    );
  }
  if (!input.snapshotId) {
    reasons.push('snapshotId is required — an Output must trace back to a frozen snapshot');
  }
  if (!input.scope || input.scope.trim() === '') {
    reasons.push('scope is required');
  }
  for (const finding of input.findings ?? []) {
    if (!finding.supportingEvidence || finding.supportingEvidence.length === 0) {
      reasons.push(
        `finding ${finding.unitId}: supportingEvidence must be non-empty — contradicting-only ` +
          'or no evidence at all is not enough to publish a finding'
      );
    }
    if (!finding.businessMeaning || finding.businessMeaning.trim() === '') {
      reasons.push(`finding ${finding.unitId}: businessMeaning is required`);
    }
    if (!finding.recommendation || finding.recommendation.trim() === '') {
      reasons.push(`finding ${finding.unitId}: recommendation is required`);
    }
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Deterministic hashing input — sorted IN MEMORY, never via SQL ORDER BY.
// Same regression this guards against as contentHash.ts / db.ts:
// "UPDATE bez ORDER BY + float niełączne → 6-7 różnych hashy z 10 przebiegów".
// ---------------------------------------------------------------------------

function sortByKey<T, K extends keyof T>(rows: readonly T[], key: K): T[] {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

function roundScore(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  return Math.round(value * 10_000) / 10_000;
}

function buildHashableOutputContent(input: FreezeOutputInput, outputVersion: number): unknown {
  return {
    module: input.module,
    methodPackId: input.methodPackId,
    methodPackVersion: input.methodPackVersion,
    scope: input.scope,
    snapshotId: input.snapshotId,
    current: input.current,
    target: input.target,
    gap: input.gap,
    aggregation: input.aggregation,
    limitations: [...input.limitations].sort((a, b) => a.localeCompare(b)),
    findings: sortByKey(
      input.findings.map((f) => ({
        ...f,
        currentLevel: roundScore(f.currentLevel),
        targetLevel: roundScore(f.targetLevel),
        gap: roundScore(f.gap),
        supportingEvidence: sortByKey(f.supportingEvidence, 'evidenceId'),
        contradictingEvidence: sortByKey(f.contradictingEvidence, 'evidenceId'),
        sourceLocators: [...(f.sourceLocators ?? [])].sort((a, b) => a.localeCompare(b)),
      })),
      'unitId'
    ),
    prioritisationResult: input.prioritisationResult,
    outputVersion,
  };
}

function toFindingRecord(row: MethodFindingRow): MethodFindingRecord {
  return {
    id: row.id,
    outputId: row.output_id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    currentLevel: row.current_level,
    targetLevel: row.target_level,
    gap: row.gap,
    supportingEvidence: parseJson(row.supporting_evidence_json, []),
    contradictingEvidence: parseJson(row.contradicting_evidence_json, []),
    businessMeaning: row.business_meaning,
    rootCauseHypothesis: row.root_cause_hypothesis,
    riskOrOpportunity: row.risk_or_opportunity,
    recommendation: row.recommendation,
    prerequisite: row.prerequisite,
    expectedOutcome: row.expected_outcome,
    kpiProposal: parseJson(row.kpi_proposal_json, null),
    confidence: row.confidence as MethodFindingRecord['confidence'],
    priorityRationale: row.priority_rationale,
    sourceLocators: parseJson(row.source_locators_json, []),
    createdAt: row.created_at,
  };
}

function toOutputRecord(row: MethodOutputRow, findings: MethodFindingRecord[]): MethodOutputRecord {
  const lineage = parseJson<{ sourceRevisionOfSessionId: string | null }>(row.lineage_json, {
    sourceRevisionOfSessionId: null,
  });
  return {
    id: row.id,
    organizationId: row.organization_id,
    sessionId: row.session_id,
    snapshotId: row.snapshot_id,
    module: row.module as MethodOutputRecord['module'],
    methodPackId: row.method_pack_id,
    methodPackVersion: row.method_pack_version,
    outputVersion: row.output_version,
    revisionOfOutputId: row.revision_of_output_id,
    scope: row.scope,
    current: parseJson(row.current_json, {}),
    target: parseJson(row.target_json, {}),
    gap: parseJson(row.gap_json, {}),
    aggregation: parseJson(row.aggregation_json, {}),
    visualModel: parseJson(row.visual_model_json, {}),
    evidenceCompleteness: parseJson(row.evidence_completeness_json, {}),
    limitations: parseJson(row.limitations_json, []),
    findings,
    prioritisationResult: parseJson(row.prioritisation_json, null),
    sourceRevisionOfSessionId: lineage.sourceRevisionOfSessionId,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    frozenAt: row.frozen_at,
    demoBypassActive: row.demo_bypass_active === true,
  };
}

export class MethodOutputService {
  /**
   * INSERT-only. Builds the deterministic content hash from
   * IN-MEMORY-SORTED input (never SQL ORDER BY), writes one `method_outputs`
   * row and one `method_findings` row per finding. Throws
   * `OutputValidationError` on a missing methodology version, missing
   * limitations, or a finding without supporting evidence.
   */
  async freezeOutput(input: FreezeOutputInput): Promise<MethodOutputRecord> {
    const reasons = validateFreezeInput(input);
    if (reasons.length > 0) {
      throw new OutputValidationError(`AssessmentOutput rejected: ${reasons.join('; ')}`, reasons);
    }

    const outputVersion = input.revisionOfOutputId
      ? (await this.mustGetRow(input.revisionOfOutputId)).output_version + 1
      : 1;

    const contentHash = computeContentHash(buildHashableOutputContent(input, outputVersion));

    const id = genId();
    const now = nowIso();
    const lineageJson = JSON.stringify({
      sourceSessionId: input.sessionId,
      sourceRevisionOfSessionId: input.sourceRevisionOfSessionId ?? null,
    });

    await runOrThrow(
      `INSERT INTO method_outputs
         (id, organization_id, session_id, snapshot_id, module, method_pack_id,
          method_pack_version, output_version, revision_of_output_id, scope,
          current_json, target_json, gap_json, aggregation_json, visual_model_json,
          evidence_completeness_json, limitations_json, prioritisation_json,
          lineage_json, content_hash, created_at, frozen_at, demo_bypass_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.sessionId,
        input.snapshotId,
        input.module,
        input.methodPackId,
        input.methodPackVersion,
        outputVersion,
        input.revisionOfOutputId ?? null,
        input.scope,
        JSON.stringify(input.current),
        JSON.stringify(input.target),
        JSON.stringify(input.gap),
        JSON.stringify(input.aggregation),
        JSON.stringify(input.visualModel),
        JSON.stringify(input.evidenceCompleteness),
        JSON.stringify(input.limitations),
        input.prioritisationResult == null ? null : JSON.stringify(input.prioritisationResult),
        lineageJson,
        contentHash,
        now,
        now,
        input.demoBypassActive === true,
      ]
    );

    const findingRecords: MethodFindingRecord[] = [];
    for (const finding of input.findings) {
      const findingId = genId();
      await runOrThrow(
        `INSERT INTO method_findings
           (id, organization_id, output_id, unit_id, unit_name, current_level, target_level,
            gap, supporting_evidence_json, contradicting_evidence_json, business_meaning,
            root_cause_hypothesis, risk_or_opportunity, recommendation, prerequisite,
            expected_outcome, kpi_proposal_json, confidence, priority_rationale,
            source_locators_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          findingId,
          input.organizationId,
          id,
          finding.unitId,
          finding.unitName,
          finding.currentLevel,
          finding.targetLevel,
          finding.gap,
          JSON.stringify(finding.supportingEvidence),
          JSON.stringify(finding.contradictingEvidence),
          finding.businessMeaning,
          finding.rootCauseHypothesis ?? null,
          finding.riskOrOpportunity ?? null,
          finding.recommendation,
          finding.prerequisite ?? null,
          finding.expectedOutcome ?? null,
          finding.kpiProposal == null ? null : JSON.stringify(finding.kpiProposal),
          finding.confidence,
          finding.priorityRationale ?? null,
          JSON.stringify(finding.sourceLocators ?? []),
          now,
        ]
      );
      findingRecords.push(
        toFindingRecord({
          id: findingId,
          organization_id: input.organizationId,
          output_id: id,
          unit_id: finding.unitId,
          unit_name: finding.unitName,
          current_level: finding.currentLevel,
          target_level: finding.targetLevel,
          gap: finding.gap,
          supporting_evidence_json: finding.supportingEvidence,
          contradicting_evidence_json: finding.contradictingEvidence,
          business_meaning: finding.businessMeaning,
          root_cause_hypothesis: finding.rootCauseHypothesis ?? null,
          risk_or_opportunity: finding.riskOrOpportunity ?? null,
          recommendation: finding.recommendation,
          prerequisite: finding.prerequisite ?? null,
          expected_outcome: finding.expectedOutcome ?? null,
          kpi_proposal_json: finding.kpiProposal ?? null,
          confidence: finding.confidence,
          priority_rationale: finding.priorityRationale ?? null,
          source_locators_json: finding.sourceLocators ?? [],
          created_at: now,
        })
      );
    }

    const row = await this.mustGetRow(id);
    return toOutputRecord(row, findingRecords);
  }

  async getOutput(organizationId: string, outputId: string): Promise<MethodOutputRecord | null> {
    const row = await DbPromise.get<MethodOutputRow>(`SELECT * FROM method_outputs WHERE id = ?`, [
      outputId,
    ]);
    if (!row || row.organization_id !== organizationId) return null;
    const findings = await this.listFindings(organizationId, outputId);
    return toOutputRecord(row, findings);
  }

  async listFindings(organizationId: string, outputId: string): Promise<MethodFindingRecord[]> {
    const rows = await DbPromise.all<MethodFindingRow>(
      `SELECT * FROM method_findings WHERE organization_id = ?`,
      [organizationId]
    );
    // Defensive in-memory sort by id — never trust unordered SELECT output
    // to stay stable across calls (the documented hashing defect's root cause).
    return rows
      .filter((r) => r.output_id === outputId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toFindingRecord);
  }

  /** All Output rows in one lineage (by original session), newest first. */
  async listOutputsBySession(
    organizationId: string,
    sessionId: string
  ): Promise<MethodOutputRecord[]> {
    const rows = await DbPromise.all<MethodOutputRow>(
      `SELECT * FROM method_outputs WHERE organization_id = ?`,
      [organizationId]
    );
    const matching = rows
      .filter((r) => r.session_id === sessionId)
      .sort((a, b) => b.output_version - a.output_version);
    const results: MethodOutputRecord[] = [];
    for (const row of matching) {
      const findings = await this.listFindings(organizationId, row.id);
      results.push(toOutputRecord(row, findings));
    }
    return results;
  }

  /**
   * Resolves supersession by READING for a newer row whose
   * `revision_of_output_id` points back at `outputId` — never by writing a
   * pointer onto the historical row itself (see class-level doc comment).
   */
  async isSuperseded(
    organizationId: string,
    outputId: string
  ): Promise<{ readonly superseded: boolean; readonly supersededByOutputId: string | null }> {
    const rows = await DbPromise.all<MethodOutputRow>(
      `SELECT * FROM method_outputs WHERE organization_id = ?`,
      [organizationId]
    );
    const successor = rows.find((r) => r.revision_of_output_id === outputId);
    return {
      superseded: !!successor,
      supersededByOutputId: successor?.id ?? null,
    };
  }

  /**
   * Org-wide, paginated Output listing — powers `GET /api/method/outputs`
   * ("po restarcie użytkownik odnajduje... historię pracy"). Loads the full
   * `method_outputs` table for the org (matches the kernel-wide convention
   * of filter/sort in memory — see MethodEventStore.listBySession and this
   * class's own `listFindings`/`listOutputsBySession` — rather than trusting
   * SQL ORDER BY, the documented root cause of a prior hashing defect), then
   * filters, computes current/superseded status from the SAME in-memory rows
   * (no extra query per row), sorts DETERMINISTICALLY
   * (`frozen_at DESC, id DESC` — the `id` tie-breaker is what keeps two
   * calls with identical timestamps in the same order), and only THEN
   * slices `[offset, offset+limit)` — so `total` reflects the full filtered
   * set, not just the returned page.
   */
  async listForOrganization(filter: ListOutputsFilter): Promise<ListResult<MethodOutputListItem>> {
    const rows = await DbPromise.all<MethodOutputRow>(
      `SELECT * FROM method_outputs WHERE organization_id = ?`,
      [filter.organizationId]
    );
    // organizationId is already the SQL predicate above; this re-check is a
    // defensive backstop against the test-mock's narrow WHERE-column
    // allow-list (see MethodEventStore's header comment on the same pattern).
    const orgRows = rows.filter((r) => r.organization_id === filter.organizationId);

    const successorByParent = new Map<string, string>();
    for (const r of orgRows) {
      if (r.revision_of_output_id) successorByParent.set(r.revision_of_output_id, r.id);
    }

    let matching = orgRows;
    if (filter.sessionId) matching = matching.filter((r) => r.session_id === filter.sessionId);
    if (filter.sessionIds) {
      const allow = new Set(filter.sessionIds);
      matching = matching.filter((r) => allow.has(r.session_id));
    }

    let withStatus = matching.map((row) => {
      const supersededByOutputId = successorByParent.get(row.id) ?? null;
      return {
        row,
        status: (supersededByOutputId ? 'superseded' : 'current') as 'current' | 'superseded',
        supersededByOutputId,
      };
    });
    if (filter.status) {
      withStatus = withStatus.filter((entry) => entry.status === filter.status);
    }

    withStatus.sort((a, b) => {
      const byTime = new Date(b.row.frozen_at).getTime() - new Date(a.row.frozen_at).getTime();
      return byTime !== 0 ? byTime : b.row.id.localeCompare(a.row.id);
    });

    const total = withStatus.length;
    const page = withStatus.slice(filter.offset, filter.offset + filter.limit);

    const items: MethodOutputListItem[] = [];
    for (const entry of page) {
      const findings = await this.listFindings(filter.organizationId, entry.row.id);
      items.push({
        ...toOutputRecord(entry.row, findings),
        status: entry.status,
        supersededByOutputId: entry.supersededByOutputId,
      });
    }
    return { items, total };
  }

  /**
   * Full revision chain for the lineage `outputId` belongs to (oldest first,
   * i.e. ascending `output_version`) — powers
   * `GET /api/method/outputs/:id/revisions` ("rewizje Output +
   * rozróżnienie current / superseded"). `outputId` may be ANY output in the
   * chain, not just the root or the latest — this walks back to the root via
   * `revision_of_output_id`, then forward again collecting every successor,
   * so the caller always gets the SAME full chain regardless of which
   * member they asked about. Returns `null` when `outputId` does not exist
   * in this organization (tenant-scoped — a real id from another org is
   * indistinguishable from a made-up one).
   */
  async listRevisionChain(
    organizationId: string,
    outputId: string
  ): Promise<ListResult<MethodOutputListItem> | null> {
    const rows = await DbPromise.all<MethodOutputRow>(
      `SELECT * FROM method_outputs WHERE organization_id = ?`,
      [organizationId]
    );
    const orgRows = rows.filter((r) => r.organization_id === organizationId);
    const byId = new Map(orgRows.map((r) => [r.id, r]));
    const anchor = byId.get(outputId);
    if (!anchor) return null;

    // Walk back to the root — bounded so a corrupt/cyclic pointer chain
    // cannot hang the request (mirrors collectLineageSessionIds's hop cap in
    // server/src/routes/method-core.routes.ts).
    let root = anchor;
    let backHops = 0;
    while (root.revision_of_output_id && byId.has(root.revision_of_output_id) && backHops < 25) {
      root = byId.get(root.revision_of_output_id)!;
      backHops += 1;
    }

    // Walk forward from the root collecting every successor in the chain.
    const chain: MethodOutputRow[] = [];
    const visited = new Set<string>();
    let cursor: MethodOutputRow | undefined = root;
    let forwardHops = 0;
    while (cursor && !visited.has(cursor.id) && forwardHops < 25) {
      visited.add(cursor.id);
      chain.push(cursor);
      cursor = orgRows.find((r) => r.revision_of_output_id === cursor!.id);
      forwardHops += 1;
    }

    const items: MethodOutputListItem[] = [];
    for (const row of chain) {
      const findings = await this.listFindings(organizationId, row.id);
      const successor = orgRows.find((r) => r.revision_of_output_id === row.id);
      items.push({
        ...toOutputRecord(row, findings),
        status: successor ? 'superseded' : 'current',
        supersededByOutputId: successor?.id ?? null,
      });
    }
    return { items, total: items.length };
  }

  private async mustGetRow(outputId: string): Promise<MethodOutputRow> {
    const row = await DbPromise.get<MethodOutputRow>(`SELECT * FROM method_outputs WHERE id = ?`, [
      outputId,
    ]);
    if (!row) throw new Error(`method-core: output not found: ${outputId}`);
    return row;
  }
}

export const methodOutputService = new MethodOutputService();

import DRD_STRUCTURE from '../../data/drdStructure.js';
import { methodOutputService } from '../../method-core/outputs/index.js';
import * as DbPromise from '../../utils/DbPromise.js';
import {
  AssessmentSkipReasonError,
  assessmentSkipReasonService,
  type AssessmentSkipReason,
} from './assessmentSkipReasonService.js';

const AREA_MICROSTRUCTURE = [
  'stan_faktyczny',
  'ocena_i_wiarygodnosc',
  'znaczenie_dla_przedsiebiorstwa',
  'luka_i_sens_targetu',
  'najblizszy_krok',
] as const;

// W1 (nadzorca 2026-08-28): the cover-metadata table has five fields the
// database can actually answer for — but none of them live on
// method_sessions itself, so `build()` reaches into three more tables the
// contract never touched before. Every extraction here is best-effort and
// null-safe: a field with no real source stays null and the schema/renderer
// layer already renders that as an honest "Do uzupełnienia" placeholder
// (documentDocxRenderer.ts renderDrdCoverBlock). Nothing here fabricates a
// value — it only surfaces what the day-36 seed (or any real org/project/
// session data) actually wrote.
const EMPLOYMENT_PATTERN = /zatrudnien\w*\s*:?\s*(?:ok\.?\s*)?(\d[\d\s]*\d|\d)/iu;

function extractEmploymentFromDescription(description: string | null): string | null {
  if (!description) return null;
  const match = EMPLOYMENT_PATTERN.exec(description);
  if (!match) return null;
  const count = match[1].replace(/\s+/g, '');
  if (!/^\d+$/.test(count)) return null;
  return `${count} osób`;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

const PL_DATE = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const PL_DATE_NO_YEAR = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' });

// The only two real anchors for "when was this assessment actually
// conducted" are the ANSWER_CONFIRMED events on the session — everything
// else on method_sessions/method_outputs is bookkeeping (row created,
// output frozen), not fieldwork. When there are no confirmed answers yet
// (empty/draft session) there is genuinely no period to report.
function formatAssessmentPeriod(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (isSameCalendarDay(start, end)) return PL_DATE.format(end);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${PL_DATE_NO_YEAR.format(start)} – ${PL_DATE.format(end)}`;
  }
  return `${PL_DATE.format(start)} – ${PL_DATE.format(end)}`;
}

export class AssessmentReportContractService {
  async build(organizationId: string, sessionId: string, outputId?: string) {
    const session = await DbPromise.get<{
      id: string;
      method_pack_version: string;
      created_at: string;
      project_id: string | null;
      owner_user_id: string | null;
    }>(
      `SELECT id, method_pack_version, created_at, project_id, owner_user_id FROM method_sessions
       WHERE id = ? AND organization_id = ?`,
      [sessionId, organizationId],
      { fallback: false }
    );
    if (!session) throw new AssessmentSkipReasonError('SESSION_NOT_FOUND', 404);

    const project = session.project_id
      ? await DbPromise.get<{ name: string; description: string | null }>(
          `SELECT name, description FROM projects WHERE id = ? AND organization_id = ?`,
          [session.project_id, organizationId],
          { fallback: false }
        )
      : null;

    const organization = await DbPromise.get<{ industry: string | null }>(
      `SELECT industry FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: false }
    );

    const ownerUser = session.owner_user_id
      ? await DbPromise.get<{
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }>(
          `SELECT first_name, last_name, email FROM users WHERE id = ? AND organization_id = ?`,
          [session.owner_user_id, organizationId],
          { fallback: false }
        )
      : null;
    const assessorName = [ownerUser?.first_name, ownerUser?.last_name]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
      .trim();
    const assessor = assessorName || ownerUser?.email || null;

    const answerSpan = await DbPromise.get<{ started_at: string | null; ended_at: string | null }>(
      `SELECT MIN(occurred_at) AS started_at, MAX(occurred_at) AS ended_at
       FROM method_events
       WHERE organization_id = ? AND session_id = ? AND type = 'ANSWER_CONFIRMED'`,
      [organizationId, sessionId],
      { fallback: false }
    );
    const assessmentPeriod = formatAssessmentPeriod(
      answerSpan?.started_at ?? null,
      answerSpan?.ended_at ?? null
    );

    const outputs = await methodOutputService.listOutputsBySession(organizationId, sessionId);
    const output = outputId
      ? await methodOutputService.getOutput(organizationId, outputId)
      : (outputs[0] ?? null);
    if (outputId && (!output || output.sessionId !== sessionId)) {
      throw new AssessmentSkipReasonError('REPORT_REVISION_NOT_FOUND', 404);
    }
    const skipReasons =
      outputId && output
        ? await assessmentSkipReasonService.listActiveAsOf(
            organizationId,
            sessionId,
            output.frozenAt
          )
        : await assessmentSkipReasonService.listActive(organizationId, sessionId);
    // FIX-2 (P1-2, nadzorca 2026-08-26): skip decisions are per-question
    // (unitId + questionId), never per-area. Group every active decision for
    // an area instead of collapsing to one arbitrary record — a single
    // skipped question must not make the whole area read as fully skipped.
    const skipsByUnit = new Map<string, AssessmentSkipReason[]>();
    for (const reason of skipReasons) {
      const existing = skipsByUnit.get(reason.unitId);
      if (existing) existing.push(reason);
      else skipsByUnit.set(reason.unitId, [reason]);
    }
    const findingByUnit = new Map(
      (output?.findings ?? []).map((finding) => [finding.unitId, finding])
    );

    // Area-level `skipped` is a true aggregate: true only when every
    // assessable slot of the area (one per canonical axis level, the same
    // bound already enforced on write by INVALID_UNIT_OR_LEVEL) has an
    // active skip decision. A partial skip keeps `skipped: false` and
    // surfaces the full per-question list so the consumer can see exactly
    // which questions were skipped and with which code.
    const areaSkipInfo = (
      axis: (typeof DRD_STRUCTURE)[number],
      area: (typeof DRD_STRUCTURE)[number]['areas'][number]
    ) => {
      const areaSkips = skipsByUnit.get(area.id) ?? [];
      const skips = areaSkips.map((reason) => ({
        questionId: reason.questionId,
        skipCode: reason.skipCode,
      }));
      const distinctLevelsSkipped = new Set(areaSkips.map((reason) => reason.level)).size;
      const allSkipped = areaSkips.length > 0 && distinctLevelsSkipped >= axis.levelCount;
      return {
        skipped: allSkipped,
        // Deterministic single code only when exactly one question is
        // skipped; never arbitrarily pick among multiple different codes.
        skipCode: skips.length === 1 ? skips[0].skipCode : null,
        skips,
      };
    };

    return {
      contractVersion: 'assessment-report-contract-v1',
      sessionId,
      outputId: output?.id ?? null,
      revision: output?.outputVersion ?? 0,
      generatedAt: output?.frozenAt ?? session.created_at,
      methodVersion: output?.methodPackVersion ?? session.method_pack_version,
      sessionLabel: {
        displayName: project?.name ?? null,
        source: project ? ('project' as const) : null,
        projectId: session.project_id,
      },
      // W1 cover-metadata fields — every one is null-safe; no field here is
      // ever fabricated. See the comment block above the helper functions
      // for exactly which table each one reads.
      businessProfile: organization?.industry ?? null,
      employment: extractEmploymentFromDescription(project?.description ?? null),
      assessmentPeriod,
      assessor,
      // `clientSponsor` has no home anywhere in the schema today — neither
      // method_session_roles (METHOD_PROCESS_ROLES has no 'sponsor' role:
      // owner/lead_assessor/assessor/respondent/evidence_owner/reviewer/
      // approver/observer) nor projects/organizations carry a sponsor
      // field. Left null on purpose; the renderer shows the honest
      // "Do uzupełnienia" placeholder for it.
      clientSponsor: null as string | null,
      chapters: DRD_STRUCTURE.map((axis) => ({
        axisId: axis.id,
        axisName: axis.name,
        axisNamePL: axis.namePL,
        maxLevel: axis.levelCount,
        introduction: { content: null, minWords: 120, maxWords: 180 },
        matrix: {
          caption: { content: null, minWords: 30, maxWords: 60 },
          areas: axis.areas.map((area) => {
            const finding = findingByUnit.get(area.id);
            const skipInfo = areaSkipInfo(axis, area);
            const currentLevel = finding?.currentLevel ?? null;
            const targetLevel = finding?.targetLevel ?? null;
            return {
              unitId: area.id,
              unitName: area.name,
              unitNamePL: area.namePL,
              currentLevel,
              targetLevel,
              gap:
                currentLevel === null || targetLevel === null ? null : targetLevel - currentLevel,
              skipped: skipInfo.skipped,
              skipCode: skipInfo.skipCode,
              skips: skipInfo.skips,
              evidenceState: finding
                ? finding.supportingEvidence.length > 0
                  ? 'evidenced'
                  : finding.confidence === 'low'
                    ? 'incomplete'
                    : 'declared'
                : 'not_assessed',
            };
          }),
        },
        areaComments: axis.areas.map((area) => {
          const finding = findingByUnit.get(area.id);
          const skipInfo = areaSkipInfo(axis, area);
          return {
            unitId: area.id,
            content: null,
            minWords: 110,
            maxWords: 170,
            microstructure: AREA_MICROSTRUCTURE,
            skipped: skipInfo.skipped,
            skipCode: skipInfo.skipCode,
            skips: skipInfo.skips,
            answerRefs: finding ? [finding.id] : [],
            evidenceRefs: finding?.supportingEvidence.map((evidence) => evidence.evidenceId) ?? [],
            sourceLocators: finding?.sourceLocators ?? [],
            uncertainty: finding
              ? finding.supportingEvidence.length > 0
                ? 'evidenced'
                : finding.confidence === 'low'
                  ? 'incomplete'
                  : 'declared'
              : 'not_assessed',
          };
        }),
        conclusion: {
          content: null,
          minWords: 180,
          maxWords: 260,
          decisionLine: {
            direction: null,
            priority: null,
            horizon: null,
            successCondition: null,
          },
        },
      })),
    };
  }
}

export const assessmentReportContractService = new AssessmentReportContractService();

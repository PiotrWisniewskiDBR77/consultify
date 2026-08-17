/**
 * UI-CANON G4 — real HTTP seeding for Audits domain data (program + criteria).
 *
 * Every call in here is a real authenticated HTTP request against the live
 * backend — same pattern as `rbacFixture.ts`: no SQL writes, no token
 * minting, no `page.route()` interception. The caller supplies a bearer
 * token obtained the normal way (see `loginViaApi` in `rbacFixture.ts`).
 *
 * The working path, verified by hand before writing this file:
 *
 *   1. POST /api/audits/packs/seed-demo
 *        Creates (or, if the org already has one, reuses — packSeed.ts is
 *        idempotent per org on `pack_key = internal-process-audit-demo`) a
 *        demonstration audit pack with its own non-normative criteria tree.
 *        -> 200 { success, data: AuditPack }
 *
 *   2. POST /api/audits/packs/:id/approve-expert   (skipped if already approved)
 *      POST /api/audits/packs/:id/publish          (skipped if already published)
 *        A program can only be created from a pack whose publication_status
 *        is 'published' (server/src/services/audits/packService.ts,
 *        createProgramFromPack -> AUDIT_INVALID_STATE otherwise), and
 *        publish() itself refuses without a prior expert approval
 *        (PACK_EXPERT_APPROVAL_MISSING). Both gates require
 *        isPlatformAdmin(actor); the platformAdmin persona from
 *        rbacFixture.ts clears them.
 *
 *   3. POST /api/audits/programs   { packId, name }
 *        THE canonical writer. `POST /api/audit/programs` (singular prefix,
 *        server/src/routes/audit-programs.routes.ts) is retired and returns
 *        410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED for every write — verified
 *        empirically, not assumed from a comment. Only the plural
 *        `/api/audits/programs` (the Audits kernel,
 *        server/src/routes/audits/programs.routes.ts) still writes
 *        `audit_programs`. Both prefixes' GET /programs still read the same
 *        table, so either can be used to *read back* what this helper wrote.
 *        -> 201 { success, data: { program, members, stats } }
 *
 *   4. GET /api/audits/criteria?programId=:id
 *        Criteria are NOT created through a separate POST — creating a
 *        program from a published pack snapshots the pack's criteria tree
 *        onto the program server-side
 *        (services/audits/programService.ts:createProgramFromPack). This
 *        step only reads that snapshot back. If a future change ever makes
 *        that snapshot empty, `firstCriterionId` below is honestly `null`
 *        rather than a fabricated id.
 *
 * Tenant isolation was verified empirically alongside this: a foreignTenant
 * persona's token against GET /api/audit/programs and GET /api/audits/programs
 * both returned `{ programs: [], total: 0 }`, and GET
 * /api/audits/programs/:id for the primary tenant's program returned 404
 * (AUDIT_NOT_FOUND) rather than the record.
 */

import { request as apiRequest } from '@playwright/test';

export interface SeededCriterion {
  id: string;
  refCode: string;
  nodeKind: string;
  title: string;
}

export interface AuditSeedResult {
  packId: string;
  packKey: string;
  /** Publication status observed after the seed call ran ('published'). */
  packPublicationStatus: string;
  programId: string;
  programName: string;
  /** Flattened criteria tree (domains + leaf criteria), as returned by the API. */
  criteria: SeededCriterion[];
  /**
   * First leaf-level criterion id, e.g. for exercising
   * `/audit-programs/method/:programId/criteria/:criterionId`. `null` only
   * if the program's snapshot genuinely came back empty — never fabricated.
   */
  firstCriterionId: string | null;
}

function apiBase(): string {
  return process.env.E2E_API_URL || 'http://127.0.0.1:3951';
}

interface RawCriterionNode {
  id: string;
  refCode: string;
  nodeKind: string;
  title: string;
  children?: RawCriterionNode[];
}

function flattenCriteria(nodes: RawCriterionNode[] | undefined, out: SeededCriterion[]): void {
  for (const node of nodes ?? []) {
    out.push({ id: node.id, refCode: node.refCode, nodeKind: node.nodeKind, title: node.title });
    if (Array.isArray(node.children) && node.children.length) {
      flattenCriteria(node.children, out);
    }
  }
}

/**
 * Seeds one audit program (from the demo pack, publishing it first if
 * needed) under the caller's tenant, using only real authenticated HTTP
 * calls. `token` must be a bearer token from `POST /api/auth/login`
 * (see `loginViaApi` in `rbacFixture.ts`) for a persona with platform-admin
 * rights (e.g. the `platformAdmin` persona from `createRbacFixture`) —
 * publishing a pack requires `isPlatformAdmin(actor)`.
 */
export async function seedAuditProgram(
  token: string,
  opts: { baseURL?: string; name?: string } = {}
): Promise<AuditSeedResult> {
  const baseURL = opts.baseURL || apiBase();
  const ctx = await apiRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  try {
    // 1. Seed (or reuse) the org's demo pack.
    const seedRes = await ctx.post('/api/audits/packs/seed-demo', { data: {} });
    if (seedRes.status() !== 200) {
      throw new Error(`POST /api/audits/packs/seed-demo -> ${seedRes.status()} ${await seedRes.text()}`);
    }
    const seedBody = (await seedRes.json()) as {
      data: { id: string; packKey: string; publicationStatus: string; expertApprovedBy: string | null };
    };
    const pack = seedBody.data;
    let publicationStatus = pack.publicationStatus;

    // 2. Get the pack to 'published' if it isn't already (idempotent: a
    //    second run against the same org skips both calls).
    if (publicationStatus !== 'published') {
      if (!pack.expertApprovedBy) {
        const approveRes = await ctx.post(`/api/audits/packs/${pack.id}/approve-expert`, {
          data: { note: 'auditSeed.ts (UI-CANON G4) — automated seed approval' },
        });
        if (approveRes.status() !== 200) {
          throw new Error(
            `POST /api/audits/packs/${pack.id}/approve-expert -> ${approveRes.status()} ${await approveRes.text()}`
          );
        }
      }
      const publishRes = await ctx.post(`/api/audits/packs/${pack.id}/publish`, { data: {} });
      if (publishRes.status() !== 200) {
        throw new Error(
          `POST /api/audits/packs/${pack.id}/publish -> ${publishRes.status()} ${await publishRes.text()}`
        );
      }
      const publishBody = (await publishRes.json()) as { data: { publicationStatus: string } };
      publicationStatus = publishBody.data.publicationStatus;
    }

    // 3. Create the program. Deliberately NOT /api/audit/programs (singular)
    //    — that write path is retired (410) and would throw here if used.
    const programName = opts.name || `G4 audit seed ${new Date().toISOString()}`;
    const programRes = await ctx.post('/api/audits/programs', {
      data: { packId: pack.id, name: programName },
    });
    if (programRes.status() !== 201) {
      throw new Error(`POST /api/audits/programs -> ${programRes.status()} ${await programRes.text()}`);
    }
    const programBody = (await programRes.json()) as { data: { program: { id: string; name: string } } };
    const programId = programBody.data.program.id;

    // 4. Read back the criteria snapshot created as a side effect of step 3.
    const criteriaRes = await ctx.get(`/api/audits/criteria?programId=${encodeURIComponent(programId)}`);
    if (criteriaRes.status() !== 200) {
      throw new Error(`GET /api/audits/criteria?programId=${programId} -> ${criteriaRes.status()} ${await criteriaRes.text()}`);
    }
    const criteriaBody = (await criteriaRes.json()) as { data: RawCriterionNode[] };
    const criteria: SeededCriterion[] = [];
    flattenCriteria(criteriaBody.data, criteria);
    const firstLeaf = criteria.find((c) => c.nodeKind === 'criterion') ?? null;

    return {
      packId: pack.id,
      packKey: pack.packKey,
      packPublicationStatus: publicationStatus,
      programId,
      programName,
      criteria,
      firstCriterionId: firstLeaf ? firstLeaf.id : null,
    };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Seeds one real DRD assessment report for `/audit-programs/drd-report/:reportId`.
 *
 * The route (`src/views/DRDAuditReportView.tsx`) needs a REPORT id
 * (`assessment_reports.id`, shape `report-<uuid>`), not a program id — a
 * prior run wrongly passed `seedAuditProgram()`'s `programId` there, which
 * 404s. `DRDAuditReportView` also only renders its `data-testid="drd-audit-report"`
 * root when `report.sections.length > 0`; with zero sections it renders the
 * "Report is empty" prompt branch instead (no testid) — see the component's
 * `if (report && (!report.sections || report.sections.length === 0))` guard.
 * So this helper does three real HTTP writes, in order:
 *
 *   1. POST /api/assessments/                     { name }
 *        -> 201 { assessment: { id, ... } }  (status DRAFT)
 *      Real assessment row — `assessment_reports.assessment_id` has no FK
 *      shortcut; `POST /api/assessment-reports/` 404s without one
 *      ("Assessment not found", assessment-reports.routes.ts:874).
 *
 *   2. POST /api/assessment-reports/               { assessmentId, name }
 *        -> 201 { id, builderReportId }
 *      `id` here (`report-<uuid>`) IS the id the route expects.
 *      `builderReportId` stays null (only set when the source assessment is
 *      APPROVED, ours is DRAFT — fine, the view never reads it).
 *
 *   3. POST /api/assessment-reports/:reportId/sections
 *        { sectionType, title, content }
 *        -> 201 { section }
 *      A plain, non-AI section insert (assessment-reports.routes.ts:1477) —
 *      no LLM call, unlike POST /:reportId/generate. One section is enough
 *      to clear the `sections.length === 0` empty-report branch above.
 *
 * All three are real authenticated HTTP against the live backend — same
 * pattern as `seedAuditProgram`: no SQL writes, no token minting.
 */
export interface DrdReportSeedResult {
  assessmentId: string;
  reportId: string;
  sectionId: string;
}

export async function seedDrdReport(
  token: string,
  opts: { baseURL?: string; assessmentName?: string; reportName?: string } = {}
): Promise<DrdReportSeedResult | null> {
  const baseURL = opts.baseURL || apiBase();
  const ctx = await apiRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  try {
    // 1. A real assessment row — assessment_reports needs an existing
    //    assessmentId in the same organization (assessment-reports.routes.ts:874).
    const assessmentName = opts.assessmentName || `G4 DRD report seed ${new Date().toISOString()}`;
    const assessmentRes = await ctx.post('/api/assessments/', {
      data: { name: assessmentName, type: 'DRD' },
    });
    if (assessmentRes.status() !== 201) {
      // Genuinely could not create the prerequisite assessment through HTTP —
      // report honestly rather than fabricating an id.
      return null;
    }
    const assessmentBody = (await assessmentRes.json()) as { assessment: { id: string } };
    const assessmentId = assessmentBody.assessment.id;

    // 2. The report itself — this id (`report-<uuid>`) is what the route
    //    `/audit-programs/drd-report/:reportId` expects, NOT a program id.
    const reportName = opts.reportName || `G4 DRD report ${new Date().toISOString()}`;
    const reportRes = await ctx.post('/api/assessment-reports/', {
      data: { assessmentId, name: reportName },
    });
    if (reportRes.status() !== 201) {
      return null;
    }
    const reportBody = (await reportRes.json()) as { id: string; builderReportId: string | null };
    const reportId = reportBody.id;

    // 3. One real section so the view's `sections.length > 0` check passes
    //    and it renders the full surface (with the testid) instead of the
    //    "Report is empty" prompt.
    const sectionRes = await ctx.post(`/api/assessment-reports/${encodeURIComponent(reportId)}/sections`, {
      data: {
        sectionType: 'executive_summary',
        title: 'Executive summary',
        content: 'Seeded by seedDrdReport() (UI-CANON G4) for a real, non-empty DRD audit report.',
        orderIndex: 0,
      },
    });
    if (sectionRes.status() !== 201) {
      return null;
    }
    const sectionBody = (await sectionRes.json()) as { section: { id: string } };

    return { assessmentId, reportId, sectionId: sectionBody.section.id };
  } finally {
    await ctx.dispose();
  }
}

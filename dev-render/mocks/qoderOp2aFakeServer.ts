/**
 * OP-2a (Wpis 99, wiersz planu 65 / U-27) — in-memory fake HTTP server for the
 * audits pack library, dev-render ONLY. No backend, no DB, no login.
 *
 * Why this exists: the acceptance evidence for OP-2a must show the REAL
 * `AuditsMethodHub` (list) navigating to the REAL `AuditPackObjectPage`
 * (object) in BOTH publication states (draft + published). The hub reads its
 * rows from `/api/audits/**` through `Api.get`, so the harness answers those
 * routes here instead of pointing at staging (forbidden: read-only HTTP) or a
 * local server (would need a DB dump for two fixture packs).
 *
 * Contract mirrored from `src/components/Audit/method/auditsMethodApi.ts`:
 * every body is the `{ success: true, data }` envelope (`unwrapEnvelope:403`),
 * packs list under `data.packs`, pack detail as `data.pack` + `data.criteria`
 * (`getPack:481`), programs under `data.programs` with the three required
 * non-negative counters `criteriaTotal`/`criteriaConcluded`/`findingsOpen`
 * (`mapProgramSummaryRow:544` throws `AUDITS_API_CONTRACT_ERROR` without them).
 *
 * Write routes (`POST /publish`, `POST /approve-expert`, `PUT /criteria`) are
 * answered with the mutated fixture so a click in the harness is visible —
 * this is a screenshot rig, not a re-test of `packService` authorization
 * (that lives in the server suite; OP-2a touches ZERO files in `server/**`).
 */

type Fixture = Record<string, unknown>;

const CRITERIA_DRAFT: Fixture[] = [
  {
    id: 'crit-d-1',
    parentId: null,
    ordinal: 1,
    refCode: 'QMS-4.4',
    nodeKind: 'domain',
    title: 'Quality management system processes are defined and documented',
    requirementText:
      'The organization determines the processes needed for the QMS, their sequence and interaction, and keeps documented information to support their operation.',
    sourceReference: 'QMS Procedure Manual v3.2, section 4.4',
    auditQuestion: 'Are the process owners and interactions documented for every site?',
    expectedEvidence: [{ kind: 'document', description: 'Process map', mandatory: true }],
    auditProcedure: 'Inspect the process map and interview two process owners.',
    samplingGuidance: null,
    applicabilityRule: { scope: 'all-sites' },
    mandatory: true,
    weight: 3,
    suggestedOwnerRole: 'lead_auditor',
  },
  {
    id: 'crit-d-2',
    parentId: 'crit-d-1',
    ordinal: 2,
    refCode: 'QMS-7.1.5',
    nodeKind: 'control',
    title: 'Monitoring and measuring resources are calibrated on schedule',
    requirementText:
      'Measuring equipment used for product verification is calibrated against traceable standards at planned intervals and identified by status.',
    sourceReference: 'QMS Procedure Manual v3.2, section 7.1.5',
    auditQuestion: null,
    expectedEvidence: [{ kind: 'record', description: 'Calibration log', mandatory: true }],
    auditProcedure: 'Sample five instruments from the calibration log.',
    samplingGuidance: 'Risk-based: measuring devices used for final inspection first.',
    applicabilityRule: { scope: 'production' },
    mandatory: true,
    weight: 2,
    suggestedOwnerRole: 'auditor',
  },
  {
    id: 'crit-d-3',
    parentId: null,
    ordinal: 3,
    refCode: 'QMS-8.4.1',
    nodeKind: 'criterion',
    title: 'Externally provided processes are controlled by documented criteria',
    requirementText:
      'Suppliers are evaluated and selected against documented criteria before being added to the approved supplier list.',
    sourceReference: null,
    auditQuestion: null,
    expectedEvidence: [],
    auditProcedure: null,
    samplingGuidance: null,
    applicabilityRule: {},
    mandatory: false,
    weight: null,
    suggestedOwnerRole: null,
  },
];

const CRITERIA_PUBLISHED: Fixture[] = [
  {
    id: 'crit-p-1',
    parentId: null,
    ordinal: 1,
    refCode: 'ISO-9001-5.1',
    nodeKind: 'domain',
    title: 'Leadership and commitment of top management',
    mandatory: true,
  },
  {
    id: 'crit-p-2',
    parentId: 'crit-p-1',
    ordinal: 2,
    refCode: 'ISO-9001-5.1.1',
    nodeKind: 'control',
    title: 'Accountability for the effectiveness of the QMS is demonstrated',
    mandatory: true,
  },
  {
    id: 'crit-p-3',
    parentId: 'crit-p-1',
    ordinal: 3,
    refCode: 'ISO-9001-5.1.2',
    nodeKind: 'control',
    title: 'Customer focus is evidenced in management review records',
    mandatory: true,
  },
  {
    id: 'crit-p-4',
    parentId: null,
    ordinal: 4,
    refCode: 'ISO-9001-9.2',
    nodeKind: 'domain',
    title: 'Internal audit programme is planned and performed',
    mandatory: true,
  },
  {
    id: 'crit-p-5',
    parentId: 'crit-p-4',
    ordinal: 5,
    refCode: 'ISO-9001-9.2.2',
    nodeKind: 'control',
    title: 'Audit frequency reflects the risk and the results of prior audits',
    mandatory: true,
  },
  {
    id: 'crit-p-6',
    parentId: null,
    ordinal: 6,
    refCode: 'ISO-9001-10.2',
    nodeKind: 'criterion',
    title: 'Nonconformities are reacted to and corrective actions are effective',
    mandatory: false,
  },
];

const PACK_DRAFT: Fixture = {
  id: 'pack-draft-1',
  packKey: 'qms-internal-audit',
  version: 1,
  title: 'Internal Audit Pack — Quality Management System',
  summary:
    'Draft pack for the internal QMS audit round. Criteria are still being reviewed by the audit team before expert approval.',
  purpose:
    'Verify that the documented QMS processes are implemented consistently across the production sites.',
  scope: 'Quality management system processes, production planning, supplier control.',
  objectives: 'Confirm conformity of the QMS with the internal procedure set before certification.',
  auditType: 'INTERNAL',
  sourceId: 'src-qms-1',
  sourceTitle: 'Quality Management System Procedure Manual',
  sourceVersion: '3.2',
  sourceType: 'INTERNAL_PROCEDURE',
  verificationStatus: 'VERIFIED',
  publicationStatus: 'draft',
  requiredRoles: ['lead_auditor', 'auditor'],
  criteriaCount: CRITERIA_DRAFT.length,
  updatedAt: '2026-09-16T09:20:00.000Z',
  expertApprovedBy: null,
  requiredCompetencies: ['ISO 9001 awareness', 'Process audit technique'],
  findingTaxonomy: [
    { key: 'major', label: 'Major nonconformity', nonConforming: true },
    { key: 'minor', label: 'Minor nonconformity', nonConforming: true },
    { key: 'obs', label: 'Observation', nonConforming: false },
  ],
  rightsStatus: 'ORG_OWNED',
  rightsNote: 'Internal procedure — owned by the organization.',
};

const PACK_PUBLISHED: Fixture = {
  id: 'pack-published-1',
  packKey: 'iso9001-certification',
  version: 2,
  title: 'ISO 9001 Certification Readiness Pack',
  summary:
    'Published pack used as the basis of compliance audits for the certification round.',
  purpose:
    'Provide the audit basis for the certification surveillance visit and for supplier audits.',
  scope: 'Full quality management system, including leadership and improvement clauses.',
  objectives: 'Establish conformity with ISO 9001 requirements ahead of the certification audit.',
  auditType: 'COMPLIANCE',
  sourceId: 'src-iso-1',
  sourceTitle: 'ISO 9001:2015 Requirements Standard',
  sourceVersion: null,
  sourceType: 'LICENSED_STANDARD',
  verificationStatus: 'VERIFIED',
  publicationStatus: 'published',
  requiredRoles: ['program_owner', 'lead_auditor', 'technical_expert'],
  criteriaCount: CRITERIA_PUBLISHED.length,
  updatedAt: '2026-09-15T14:05:00.000Z',
  expertApprovedBy: 'user-piotr-demo',
  requiredCompetencies: ['ISO 9001 lead auditor', 'Certification audit experience'],
  findingTaxonomy: [
    { key: 'major', label: 'Major nonconformity', nonConforming: true },
    { key: 'minor', label: 'Minor nonconformity', nonConforming: true },
    { key: 'obs', label: 'Observation', nonConforming: false },
  ],
  rightsStatus: 'LICENSED',
  rightsNote: 'Licensed standard — clause text reproduced as references only.',
};

const PACKS: Fixture[] = [PACK_DRAFT, PACK_PUBLISHED];
const CRITERIA: Record<string, Fixture[]> = {
  'pack-draft-1': CRITERIA_DRAFT,
  'pack-published-1': CRITERIA_PUBLISHED,
};

const PROGRAMS: Fixture[] = [
  {
    id: 'prog-1',
    name: 'Certification readiness — production site A',
    packId: 'pack-published-1',
    packTitle: PACK_PUBLISHED.title as string,
    packVersion: 2,
    lifecycleState: 'fieldwork',
    criteriaTotal: 6,
    criteriaConcluded: 2,
    findingsOpen: 1,
    leadAuditorId: 'user-piotr-demo',
    leadAuditorName: 'Piotr Wiśniewski',
    plannedStart: '2026-09-10',
    plannedEnd: '2026-09-30',
    updatedAt: '2026-09-16T08:00:00.000Z',
  },
];

const USERS: Fixture[] = [
  {
    id: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    role: 'ADMIN',
  },
  {
    id: 'user-auditor-1',
    firstName: 'Anna',
    lastName: 'Kowalska',
    email: 'anna.kowalska@dbr77.com',
    role: 'USER',
  },
];

let installed = false;

/**
 * Mirror of `packService.buildCriteriaTree` — the real `GET /audits/packs/:id`
 * returns a TREE (`children` nested, sorted by ordinal), not a flat list. The
 * harness has to be honest about that shape, because the OP-2b editor
 * flattens it and the replace payload is the only carrier of the hierarchy.
 */
function buildCriteriaTree(flat: Fixture[]): Fixture[] {
  const nodes = new Map<string, Fixture>();
  for (const c of flat) nodes.set(c.id as string, { ...c, children: [] });
  const roots: Fixture[] = [];
  for (const c of flat) {
    const node = nodes.get(c.id as string) as Fixture;
    const parent = c.parentId ? nodes.get(c.parentId as string) : undefined;
    if (parent) (parent.children as Fixture[]).push(node);
    else roots.push(node);
  }
  const byOrdinal = (a: Fixture, b: Fixture) => Number(a.ordinal) - Number(b.ordinal);
  const sortRec = (list: Fixture[]) => {
    list.sort(byOrdinal);
    for (const n of list) sortRec(n.children as Fixture[]);
  };
  sortRec(roots);
  return roots;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function envelope(data: unknown, total?: number): Response {
  return json(200, {
    success: true,
    data: total === undefined ? data : { ...data, total },
  });
}

/**
 * Install — patches `window.fetch`. Idempotent (guarded), pass-through for
 * everything that is not an `/api/**` call (locales, vite HMR, the harness
 * itself), same shape as `methodCoreFakeServer.installMethodCoreFakeServer`.
 */
export function installOp2aFakeServer(): void {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const idx = url.indexOf('/api/');
    if (idx < 0) return originalFetch(input as RequestInfo, init);

    const path = url.slice(idx + 4); // keep the leading slash
    const method = (init?.method ?? 'GET').toUpperCase();

    // ── pack detail (object screen) ──────────────────────────────────────
    const detailMatch = /^\/audits\/packs\/([^/]+)$/.exec(path);
    if (detailMatch && method === 'GET') {
      const id = decodeURIComponent(detailMatch[1]);
      const pack = PACKS.find((p) => p.id === id);
      if (!pack) return json(404, { success: false, error: { code: 'AUDIT_PACK_NOT_FOUND' } });
      return envelope({ pack, criteria: buildCriteriaTree(CRITERIA[id] ?? []) });
    }

    // ── OP-2b: replace the whole criteria list (PUT = replace, not patch) ─
    // Mirrors `packs.routes.ts:155-173` + `packService.replaceCriteria:693`:
    // bare array OR `{ criteria }`, 400 on anything else, 400 on an empty
    // title, 409 for a published pack, fresh ids on save (the client's `id`
    // is only a temp key for parent pairing).
    const criteriaMatch = /^\/audits\/packs\/([^/]+)\/criteria$/.exec(path);
    if (criteriaMatch && method === 'PUT') {
      const id = decodeURIComponent(criteriaMatch[1]);
      const pack = PACKS.find((p) => p.id === id);
      if (!pack) return json(404, { success: false, error: { code: 'AUDIT_PACK_NOT_FOUND' } });
      if (pack.publicationStatus === 'published') {
        return json(409, { success: false, error: { code: 'AUDIT_INVALID_STATE' } });
      }
      const raw = init?.body ? String(init.body) : '';
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        return json(400, { success: false, error: { code: 'AUDIT_CRITERIA_PAYLOAD_INVALID' } });
      }
      const incoming = Array.isArray(parsed)
        ? (parsed as Fixture[])
        : ((parsed as { criteria?: Fixture[] } | null)?.criteria ?? null);
      if (!Array.isArray(incoming)) {
        return json(400, { success: false, error: { code: 'AUDIT_CRITERIA_PAYLOAD_INVALID' } });
      }
      if (incoming.some((c) => typeof c.title !== 'string' || !c.title.trim())) {
        return json(400, { success: false, error: { code: 'AUDIT_CRITERION_TITLE_MISSING' } });
      }
      const idMap = new Map<string, string>();
      const saved: Fixture[] = incoming.map((c, index) => {
        const generated = `apc_${Math.random().toString(36).slice(2, 10)}`;
        idMap.set(typeof c.id === 'string' ? c.id : `__idx_${index}`, generated);
        return { ...c, __generated: generated };
      });
      CRITERIA[id] = saved.map((c) => ({
        id: c.__generated,
        parentId: c.parentId ? idMap.get(c.parentId as string) ?? null : null,
        ordinal: typeof c.ordinal === 'number' ? c.ordinal : 0,
        refCode: c.refCode ?? null,
        nodeKind: c.nodeKind ?? 'criterion',
        title: String(c.title).trim(),
        requirementText: c.requirementText ?? null,
        sourceReference: c.sourceReference ?? null,
        auditQuestion: c.auditQuestion ?? null,
        expectedEvidence: c.expectedEvidence ?? [],
        auditProcedure: c.auditProcedure ?? null,
        samplingGuidance: c.samplingGuidance ?? null,
        applicabilityRule: c.applicabilityRule ?? {},
        mandatory: c.mandatory ?? true,
        weight: c.weight ?? null,
        suggestedOwnerRole: c.suggestedOwnerRole ?? null,
      }));
      pack.criteriaCount = CRITERIA[id].length;
      pack.updatedAt = new Date().toISOString();
      return envelope(CRITERIA[id]);
    }

    // ── publish / approve-expert (same endpoints the list kebab calls) ───
    const transitionMatch = /^\/audits\/packs\/([^/]+)\/(publish|approve-expert)$/.exec(path);
    if (transitionMatch && method === 'POST') {
      const id = decodeURIComponent(transitionMatch[1]);
      const pack = PACKS.find((p) => p.id === id);
      if (!pack) return json(404, { success: false, error: { code: 'AUDIT_PACK_NOT_FOUND' } });
      if (transitionMatch[2] === 'approve-expert') {
        pack.expertApprovedBy = 'user-piotr-demo';
      } else {
        pack.publicationStatus = 'published';
      }
      return envelope({ pack });
    }

    // ── list ─────────────────────────────────────────────────────────────
    if (/^\/audits\/packs/.test(path) && method === 'GET') {
      return envelope({ packs: PACKS }, PACKS.length);
    }
    if (/^\/audits\/programs/.test(path) && method === 'GET') {
      return envelope({ programs: PROGRAMS }, PROGRAMS.length);
    }
    if (/^\/users/.test(path) && method === 'GET') {
      return envelope({ users: USERS }, USERS.length);
    }

    // Any other API read the hub or a tab performs (reports, findings,
    // conclusions, initiatives, sessions): answer an honest EMPTY envelope so
    // the harness has zero 4xx/5xx noise in the console/network log.
    if (method === 'GET') {
      return envelope({ items: [], packs: [], programs: [], reports: [], findings: [] }, 0);
    }
    return envelope({ ok: true });
  };
}

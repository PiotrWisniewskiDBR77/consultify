/**
 * In-memory fake HTTP server for the Shared Method Kernel API
 * (`/api/method/**`, see `src/method-core/api/methodCoreApi.ts`) —
 * dev-render ONLY, no backend/DB/login.
 *
 * Built for T5 (2026-08-13): two screens need this.
 *  1. `dev-render/screens/drd-http-workspace.tsx` mounts the REAL
 *     `DrdHttpMethodWorkspaceScreen` (`src/components/assessment/drd/
 *     DrdHttpMethodWorkspaceScreen.tsx`) — a P0C component that talks to
 *     `/api/method/sessions/**` exclusively via `DrdHttpSessionRuntime`,
 *     never localStorage-as-truth. It is NOT YET wired into production
 *     (`DrdMethodWorkspaceScreen.tsx` still defaults to the legacy runtime)
 *     — this harness is the required "screenshot before Piotr" step
 *     (CLAUDE.md #7) for that still-gated swap.
 *  2. `dev-render/screens/assessment-artifacts-restart.tsx` mounts the REAL
 *     `AssessmentHub` on the 'outputs' tab, which renders
 *     `AssessmentOutputsTab` → Outputs/Reports/Initiatives segments. That
 *     component was REWRITTEN 2026-08-13 to read the P0D kernel list
 *     endpoints (`listOutputs`/`listReports`/`listInitiativeDrafts`/
 *     `getSessionLineage`) instead of the legacy `/api/artifacts` registry —
 *     nobody has screenshotted it since. `seedArtifactsCatalog()` below
 *     seeds that screen's fixed catalog (current + superseded + lineage).
 *
 * Permissive by design: every role/permission/readiness check the real
 * server enforces (server/src/method-core/**) is granted here — this
 * harness exists to prove the UI's happy path + the component's own
 * explicit debug states (`DrdHttpMethodWorkspaceScreen`'s `forceState`
 * prop), not to re-test server authorization (that's covered by
 * `drdHttpSessionRuntime.test.ts` / the server integration suite).
 *
 * Output current/target/gap computation here is intentionally SIMPLE (max
 * confirmed level = current, last DECISION_APPROVED level = target) — good
 * enough to exercise the real UI's rendering of that data, not a
 * reimplementation of `drdAdapter.resolveOpenLevels`.
 */
import { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } from '../../src/method-core/methods/drd/compileDrdPack';
import { canTransition } from '../../src/method-core/contracts/session';
import { DRD_STRUCTURE } from '../../src/services/drdStructure';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

let seq = 1;
function genId(prefix: string): string {
  return `${prefix}-${String(seq++).padStart(4, '0')}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
/** True only for the collection path itself (`/outputs`, `/outputs?...`) —
 * never for a sub-path like `/outputs/:id` (see the router-ordering bug this
 * guards against, documented at its call site below). */
function isListPath(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}?`);
}

const UNIT_NAME: Record<string, string> = {};
for (const axis of DRD_STRUCTURE) {
  for (const area of axis.areas) {
    UNIT_NAME[area.id] = area.namePL || area.name;
  }
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

interface FakeEvent {
  id: string;
  type: string;
  organizationId: string;
  sessionId: string;
  unitId?: string;
  level?: number;
  actorKind: string;
  actorUserId: string | null;
  methodPackVersion: string;
  occurredAt: string;
  payload: unknown;
  idempotencyKey?: string;
}

interface FakeSession {
  id: string;
  organizationId: string;
  projectId: string | null;
  module: string;
  methodPackId: string;
  methodPackVersion: string;
  state: string;
  domainStage: string | null;
  mode: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  frozenSnapshotId: string | null;
  revisionOfSessionId: string | null;
}

const sessions = new Map<string, FakeSession>();
const eventsBySession = new Map<string, FakeEvent[]>();
const idemSeen = new Map<string, Response>();
const outputs = new Map<string, any>();
const reportSnapshots = new Map<string, any>();
const presentationSnapshots = new Map<string, any>();
const initiativeDrafts = new Map<string, any>();

const ORG_ID = 'org-dbr77-demo';
const USER_ID = 'user-piotr-demo';

function computeOutputFromEvents(session: FakeSession, events: FakeEvent[]) {
  const unitIds = new Set<string>();
  for (const e of events) if (e.unitId) unitIds.add(e.unitId);

  const current: Record<string, number | null> = {};
  const target: Record<string, number | null> = {};
  const gap: Record<string, number | null> = {};
  const findings: any[] = [];

  for (const unitId of unitIds) {
    const confirmed = events
      .filter((e) => e.unitId === unitId && e.type === 'ANSWER_CONFIRMED' && typeof e.level === 'number')
      .map((e) => e.level as number);
    const cur = confirmed.length ? Math.max(...confirmed) : null;
    const decisions = events
      .filter((e) => e.unitId === unitId && e.type === 'DECISION_APPROVED' && typeof e.level === 'number')
      .map((e) => e.level as number);
    const tgt = decisions.length ? decisions[decisions.length - 1] : null;
    current[unitId] = cur;
    target[unitId] = tgt;
    gap[unitId] = cur != null && tgt != null ? tgt - cur : null;

    if (cur != null || tgt != null) {
      const name = UNIT_NAME[unitId] || unitId;
      findings.push({
        id: genId('finding'),
        unitId,
        unitName: name,
        currentLevel: cur,
        targetLevel: tgt,
        gap: gap[unitId],
        businessMeaning:
          cur != null
            ? `Obszar „${name}" osiąga poziom ${cur}${tgt != null ? ` wobec celu ${tgt}` : ''} — potwierdzone odpowiedziami respondenta.`
            : `Obszar „${name}" ma zadeklarowany cel ${tgt}, ale brak potwierdzonej odpowiedzi bieżącego stanu.`,
        recommendation:
          gap[unitId] && gap[unitId]! > 0
            ? `Zamknij lukę ${gap[unitId]} poziomów w „${name}" — zacznij od najbliższego niespełnionego kryterium.`
            : `Utrzymaj bieżący poziom „${name}" i zweryfikuj dowody przy następnej rundzie.`,
      });
    }
  }

  const evidenceCount = events.filter((e) => e.type === 'EVIDENCE_ATTACHED').length;
  const limitations: string[] = [];
  if (evidenceCount === 0) limitations.push('Brak dowodów załączonych w tej sesji.');
  if (unitIds.size < 2) limitations.push('Zakres oceny ograniczony do wybranych obszarów — nie cała oś.');

  return {
    id: genId('output'),
    organizationId: session.organizationId,
    sessionId: session.id,
    module: session.module,
    methodPackId: session.methodPackId,
    methodPackVersion: session.methodPackVersion,
    outputVersion: 1,
    scope: 'Oś 1 — Procesy Cyfrowe (zakres demonstracyjny)',
    current,
    target,
    gap,
    limitations,
    findings,
    contentHash: `sha256-demo-${session.id.slice(-8)}`,
    frozenAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Task-B catalog seed — fixed Outputs/Reports/Initiative Drafts catalog for
// the "Artefakty po restarcie" screen, independent of any live DRD session.
// Includes a superseded revision chain (Output v1 -> v2) + lineage for one
// session so AssessmentOutputsTab's "View lineage" action has real content.
// ---------------------------------------------------------------------------

export function seedArtifactsCatalog(): void {
  const sessionOldId = 'sess-demo-catalog-old';
  const sessionCurrentId = 'sess-demo-catalog-current';

  sessions.set(sessionOldId, {
    id: sessionOldId,
    organizationId: ORG_ID,
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'closed',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: USER_ID,
    createdAt: '2026-05-04T08:00:00.000Z',
    updatedAt: '2026-05-18T09:30:00.000Z',
    version: 6,
    frozenSnapshotId: 'output-cat-0001',
    revisionOfSessionId: null,
  });
  sessions.set(sessionCurrentId, {
    id: sessionCurrentId,
    organizationId: ORG_ID,
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'frozen',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: USER_ID,
    createdAt: '2026-07-14T08:00:00.000Z',
    updatedAt: '2026-08-10T15:12:00.000Z',
    version: 9,
    frozenSnapshotId: 'output-cat-0002',
    revisionOfSessionId: sessionOldId,
  });

  const outputOld = {
    id: 'output-cat-0001',
    organizationId: ORG_ID,
    sessionId: sessionOldId,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: 'DBR77 · Digital Readiness — Grupa (runda Q2 2026)',
    limitations: ['Brak dowodu dla 3 obszarów z 9 w osi Procesy Cyfrowe.'],
    findings: [
      {
        id: 'finding-cat-0001',
        unitId: '1A',
        unitName: 'Procesy Sprzedaży',
        currentLevel: 2,
        targetLevel: 4,
        gap: 2,
        businessMeaning: 'Proces sprzedaży częściowo zautomatyzowany w CRM, bez regularnego przeglądu wskaźników.',
        recommendation: 'Wdróż cykliczny przegląd KPI procesu sprzedaży i domknij automatyzację do poziomu 4.',
      },
    ],
    contentHash: 'sha256-demo-cat0001',
    frozenAt: '2026-05-18T09:30:00.000Z',
    createdAt: '2026-05-18T09:30:00.000Z',
    demoBypassActive: false,
    isSuperseded: true,
    supersededByOutputId: 'output-cat-0002',
  };
  const outputCurrent = {
    id: 'output-cat-0002',
    organizationId: ORG_ID,
    sessionId: sessionCurrentId,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    outputVersion: 2,
    revisionOfOutputId: 'output-cat-0001',
    scope: 'DBR77 · Digital Readiness — Grupa (runda Q3 2026)',
    limitations: ['Brak dowodu dla 1 obszaru z 9 w osi Procesy Cyfrowe.'],
    findings: [
      {
        id: 'finding-cat-0002',
        unitId: '1A',
        unitName: 'Procesy Sprzedaży',
        currentLevel: 3,
        targetLevel: 4,
        gap: 1,
        businessMeaning: 'Proces sprzedaży w pełni ustandaryzowany, mierzony miesięcznie w CRM.',
        recommendation: 'Domknij automatyzację raportowania KPI, by osiągnąć poziom 4.',
      },
      {
        id: 'finding-cat-0003',
        unitId: '1B',
        unitName: 'Procesy Marketingowe',
        currentLevel: 1,
        targetLevel: 3,
        gap: 2,
        businessMeaning: 'Kampanie marketingowe prowadzone ręcznie, bez wspólnego systemu.',
        recommendation: 'Wdróż jeden system marketing automation dla całej grupy.',
      },
    ],
    contentHash: 'sha256-demo-cat0002',
    frozenAt: '2026-08-10T15:12:00.000Z',
    createdAt: '2026-08-10T15:12:00.000Z',
    demoBypassActive: false,
    isSuperseded: false,
    supersededByOutputId: null,
  };
  const outputStandalone = {
    id: 'output-cat-0003',
    organizationId: ORG_ID,
    sessionId: 'sess-demo-catalog-light',
    module: 'assessment',
    methodPackId: 'drd_light',
    methodPackVersion: '1.0.0',
    outputVersion: 1,
    revisionOfOutputId: null,
    scope: 'Segment Manufacturing — DRD Light (pilotaż)',
    limitations: [],
    findings: [
      {
        id: 'finding-cat-0004',
        unitId: '4A',
        unitName: 'Jakość danych',
        currentLevel: 4,
        targetLevel: 4,
        gap: 0,
        businessMeaning: 'Cel osiągnięty — dane referencyjne pod kontrolą jakości.',
        recommendation: 'Utrzymaj bieżący poziom, zweryfikuj dowody przy reassessmencie.',
      },
    ],
    contentHash: 'sha256-demo-cat0003',
    frozenAt: '2026-07-22T11:00:00.000Z',
    createdAt: '2026-07-22T11:00:00.000Z',
    demoBypassActive: true,
    isSuperseded: false,
    supersededByOutputId: null,
  };
  outputs.set(outputOld.id, outputOld);
  outputs.set(outputCurrent.id, outputCurrent);
  outputs.set(outputStandalone.id, outputStandalone);

  reportSnapshots.set('report-cat-0001', {
    id: 'report-cat-0001',
    organizationId: ORG_ID,
    outputId: outputOld.id,
    sessionId: sessionOldId,
    title: 'DBR77 Digital Readiness — Raport zarządczy Q2 2026',
    contentHash: 'sha256-demo-rep0001',
    status: 'superseded',
    supersededByOutputId: outputCurrent.id,
    supersededAt: '2026-08-10T15:12:00.000Z',
    createdAt: '2026-05-18T10:00:00.000Z',
    kind: 'report',
    demoBypassActive: false,
    content: {
      executiveSummary:
        'Sesja Q2 2026 pokazuje częściową automatyzację procesu sprzedaży (poziom 2/4) przy braku dowodów dla 3 obszarów.',
      participants: ['Piotr Wiśniewski (Owner)', 'Anna Kowalska (Approver)'],
      strengths: ['Proces sprzedaży ma podstawową dokumentację.'],
    },
  });
  reportSnapshots.set('report-cat-0002', {
    id: 'report-cat-0002',
    organizationId: ORG_ID,
    outputId: outputCurrent.id,
    sessionId: sessionCurrentId,
    title: 'DBR77 Digital Readiness — Raport zarządczy Q3 2026',
    contentHash: 'sha256-demo-rep0002',
    status: 'current',
    supersededByOutputId: null,
    supersededAt: null,
    createdAt: '2026-08-10T15:20:00.000Z',
    kind: 'report',
    demoBypassActive: false,
    content: {
      executiveSummary:
        'Sesja Q3 2026: proces sprzedaży osiągnął poziom 3/4 (automatyzacja + pomiar). Marketing pozostaje na poziomie 1/3 — priorytet na najbliższy kwartał.',
      participants: ['Piotr Wiśniewski (Owner)', 'Anna Kowalska (Approver)'],
      strengths: ['Sprzedaż: pełna standaryzacja i pomiar miesięczny.'],
      risks: ['Marketing bez wspólnego systemu — ryzyko rozjazdu danych kampanii.'],
    },
  });

  initiativeDrafts.set('draft-cat-0001', {
    id: 'draft-cat-0001',
    organizationId: ORG_ID,
    outputId: outputCurrent.id,
    sessionId: sessionCurrentId,
    title: 'Wdroż jeden system marketing automation dla grupy',
    summary: 'Initiative draft wygenerowany z findingu 1B — luka 2 poziomów w Procesach Marketingowych.',
    findingIds: ['finding-cat-0003'],
    rationale: 'Kampanie prowadzone ręcznie w kilku systemach utrudniają pomiar i eskalują koszt operacyjny.',
    expectedOutcome: 'Podniesienie poziomu dojrzałości Procesów Marketingowych z 1 do 3 w ciągu 2 kwartałów.',
    confidence: 'medium',
    status: 'current',
    supersededByOutputId: null,
    supersededAt: null,
    createdAt: '2026-08-10T15:25:00.000Z',
  });
  initiativeDrafts.set('draft-cat-0002', {
    id: 'draft-cat-0002',
    organizationId: ORG_ID,
    outputId: outputOld.id,
    sessionId: sessionOldId,
    title: 'Domknij automatyzację procesu sprzedaży w CRM',
    summary: 'Initiative draft z rundy Q2 — zastąpiony nowszym findingiem po aktualizacji Outputu.',
    findingIds: ['finding-cat-0001'],
    rationale: 'Znaleziska Outputu Q2 wskazywały lukę 2 poziomów między current a target dla 1A.',
    expectedOutcome: 'Podniesienie poziomu procesu sprzedaży do targetu.',
    confidence: 'high',
    status: 'source_updated',
    supersededByOutputId: outputCurrent.id,
    supersededAt: '2026-08-10T15:12:00.000Z',
    createdAt: '2026-05-18T10:05:00.000Z',
  });

  // Lineage for the CURRENT session — the chain "View lineage" renders.
  lineageBySession.set(sessionCurrentId, {
    session: { id: sessionCurrentId, label: `Sesja ${sessionCurrentId.slice(-8)} — zamrożona` },
    outputs: [outputOld, outputCurrent],
    reports: [reportSnapshots.get('report-cat-0001'), reportSnapshots.get('report-cat-0002')],
    presentations: [],
    initiativeDrafts: [initiativeDrafts.get('draft-cat-0002'), initiativeDrafts.get('draft-cat-0001')],
  });
}

const lineageBySession = new Map<string, unknown>();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function getSessionOr404(id: string): FakeSession | null {
  return sessions.get(id) ?? null;
}

async function route(method: string, path: string, body: any, idemKey: string | null): Promise<Response> {
  // Idempotency replay — appendEvent/createSession/transition/freeze pass a
  // key; replaying the same key must not double-create.
  if (idemKey && idemSeen.has(idemKey)) {
    return idemSeen.get(idemKey)!.clone();
  }
  const record = (res: Response): Response => {
    if (idemKey) idemSeen.set(idemKey, res.clone());
    return res;
  };

  // POST /sessions
  if (method === 'POST' && path === '/sessions') {
    if (forceNextCreateError) {
      forceNextCreateError = false;
      return json({ error: 'server_error', message: 'Symulowany błąd 500 (harness).' }, 500);
    }
    const id = genId('sess-http');
    const session: FakeSession = {
      id,
      organizationId: ORG_ID,
      projectId: body.projectId ?? null,
      module: body.module,
      methodPackId: body.methodPackId,
      methodPackVersion: body.methodPackVersion,
      state: 'draft',
      domainStage: null,
      mode: body.mode || 'guided_manual',
      ownerUserId: USER_ID,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
      frozenSnapshotId: null,
      revisionOfSessionId: null,
    };
    sessions.set(id, session);
    eventsBySession.set(id, []);
    return record(json({ session, idempotentReplay: false, demoBypassActive: !!body.demoBypass }));
  }

  const sessionMatch = path.match(/^\/sessions\/([^/]+)(.*)$/);
  if (sessionMatch) {
    const sessionId = sessionMatch[1];
    const rest = sessionMatch[2];
    const session = getSessionOr404(sessionId);
    if (!session) return json({ error: 'not_found' }, 404);

    if (method === 'GET' && rest === '') {
      return json({ session, roles: ['owner', 'lead_assessor', 'assessor', 'approver'] });
    }
    if (method === 'GET' && rest === '/events') {
      return json({ events: eventsBySession.get(sessionId) ?? [] });
    }
    if (method === 'POST' && rest === '/events') {
      const type = body.type as string;
      const event: FakeEvent = {
        id: genId('evt'),
        type,
        organizationId: session.organizationId,
        sessionId,
        unitId: body.unitId,
        level: body.level,
        actorKind: body.actorKind || 'human',
        actorUserId: USER_ID,
        methodPackVersion: session.methodPackVersion,
        occurredAt: nowIso(),
        payload: body.payload,
        idempotencyKey: idemKey ?? undefined,
      };
      const list = eventsBySession.get(sessionId) ?? [];
      list.push(event);
      eventsBySession.set(sessionId, list);
      session.updatedAt = nowIso();
      return record(json({ event }, 201));
    }
    if (method === 'POST' && rest === '/transition') {
      const to = body.to as string;
      if (typeof body.expectedVersion === 'number' && body.expectedVersion !== session.version) {
        return json({ error: 'version_conflict', currentVersion: session.version }, 409);
      }
      if (!canTransition(session.state as any, to as any)) {
        return json({ error: 'illegal_transition', from: session.state, to }, 422);
      }
      session.state = to;
      session.version += 1;
      session.updatedAt = nowIso();
      return record(json({ session }));
    }
    if (method === 'POST' && rest === '/freeze') {
      if (typeof body.expectedVersion === 'number' && body.expectedVersion !== session.version) {
        return json({ error: 'version_conflict', currentVersion: session.version }, 409);
      }
      if (!canTransition(session.state as any, 'frozen' as any)) {
        return json({ error: 'illegal_transition', from: session.state, to: 'frozen' }, 422);
      }
      const events = eventsBySession.get(sessionId) ?? [];
      const output = computeOutputFromEvents(session, events);
      outputs.set(output.id, { ...output, revisionOfOutputId: null, demoBypassActive: true, isSuperseded: false, supersededByOutputId: null });
      session.state = 'frozen';
      session.version += 1;
      session.frozenSnapshotId = output.id;
      session.updatedAt = nowIso();
      return record(json({ session, output, selfHealed: false }));
    }
    if (method === 'POST' && rest === '/teresa/preview') {
      const preview = {
        previewId: genId('preview'),
        intent: {
          capabilityId: body.capabilityId,
          unitId: body.unitId,
          level: body.level,
          questionId: body.questionId,
          utterance: body.utterance,
        },
        statements: body.statements ?? [],
        proposedChanges: body.proposedChanges ?? [],
        quality: body.quality ?? { verdict: 'valid', failedChecks: [] },
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
      return json({ preview });
    }
    if (method === 'POST' && rest === '/teresa/commit') {
      return record(json({ ok: true, eventIds: [genId('evt')] }));
    }
    if (method === 'GET' && rest === '/lineage') {
      const lineage = lineageBySession.get(sessionId);
      if (lineage) return json({ data: lineage });
      // Fall back to deriving a minimal lineage from this session's own
      // freeze, if any — keeps the DRD workspace's own "frozen" stage
      // honest without requiring a second seed path.
      const output = session.frozenSnapshotId ? outputs.get(session.frozenSnapshotId) : null;
      return json({
        data: {
          session: { id: session.id, label: `Sesja ${session.id.slice(-8)}` },
          outputs: output ? [output] : [],
          reports: [...reportSnapshots.values()].filter((r) => r.sessionId === session.id),
          presentations: [],
          initiativeDrafts: [...initiativeDrafts.values()].filter((d) => d.sessionId === session.id),
        },
      });
    }
  }

  // GET /outputs?sessionId=&projectId=&limit=&offset=
  // ★ Bug fixed while wiring this up (2026-08-13): `path.startsWith('/outputs')`
  // also matched `/outputs/output-cat-0002` (single-item GET), swallowing it
  // into the LIST response ({outputs:[...]}, no `.output` field) BEFORE the
  // `/outputs/:id` regex below ever ran — `getOutput()` then resolved with
  // `res.output === undefined`, and AssessmentOutputsTab's preview crashed on
  // `selectedDetail.output.findings.length` (real repro: click any Outputs
  // row). Same class of bug existed for /reports, /presentations,
  // /initiative-drafts below — all four now require an EXACT base match.
  if (method === 'GET' && isListPath(path, '/outputs')) {
    const [, qs] = path.split('?');
    const params = new URLSearchParams(qs || '');
    const sessionId = params.get('sessionId');
    let rows = [...outputs.values()];
    if (sessionId) rows = rows.filter((o) => o.sessionId === sessionId);
    rows.sort((a, b) => (b.frozenAt || '').localeCompare(a.frozenAt || ''));
    return json({ outputs: rows, total: rows.length });
  }
  const outputMatch = path.match(/^\/outputs\/([^/]+)(.*)$/);
  if (outputMatch) {
    const outputId = outputMatch[1];
    const rest = outputMatch[2];
    const output = outputs.get(outputId);
    if (method === 'GET' && rest === '') {
      if (!output) return json({ error: 'not_found' }, 404);
      return json({ output, superseded: !!output.isSuperseded, supersededByOutputId: output.supersededByOutputId ?? null });
    }
    if (method === 'GET' && rest === '/revisions') {
      const chain = [...outputs.values()].filter(
        (o) => o.id === outputId || o.revisionOfOutputId === outputId || o.id === output?.revisionOfOutputId
      );
      return json({
        revisions: chain.map((o) => ({
          id: o.id,
          outputVersion: o.outputVersion,
          status: o.isSuperseded ? 'superseded' : 'current',
          supersededByOutputId: o.supersededByOutputId,
          frozenAt: o.frozenAt,
          contentHash: o.contentHash,
        })),
      });
    }
    if (method === 'POST' && rest === '/report') {
      if (!output) return json({ error: 'not_found' }, 404);
      const report = {
        id: genId('report'),
        organizationId: output.organizationId,
        outputId,
        sessionId: output.sessionId,
        title: body.title,
        contentHash: `sha256-demo-${genId('h')}`,
        status: 'current',
        supersededByOutputId: null,
        supersededAt: null,
        createdAt: nowIso(),
        kind: 'report',
        demoBypassActive: true,
        content: body.content,
      };
      reportSnapshots.set(report.id, report);
      return record(json({ report }, 201));
    }
    if (method === 'POST' && rest === '/initiative-drafts') {
      if (!output) return json({ error: 'not_found' }, 404);
      const draft = {
        id: genId('draft'),
        organizationId: output.organizationId,
        outputId,
        sessionId: output.sessionId,
        title: body.title,
        summary: body.summary ?? null,
        findingIds: body.findingIds ?? [],
        rationale: body.rationale,
        expectedOutcome: body.expectedOutcome,
        confidence: body.confidence,
        status: 'current',
        supersededByOutputId: null,
        supersededAt: null,
        createdAt: nowIso(),
      };
      initiativeDrafts.set(draft.id, draft);
      return record(json({ draft }, 201));
    }
  }

  if (method === 'GET' && isListPath(path, '/reports')) {
    const [, qs] = path.split('?');
    const params = new URLSearchParams(qs || '');
    const outputId = params.get('outputId');
    let rows = [...reportSnapshots.values()];
    if (outputId) rows = rows.filter((r) => r.outputId === outputId);
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return json({ reports: rows });
  }
  const reportMatch = path.match(/^\/reports\/([^/]+)$/);
  if (reportMatch && method === 'GET') {
    const report = reportSnapshots.get(reportMatch[1]);
    if (!report) return json({ error: 'not_found' }, 404);
    return json({ report });
  }

  if (method === 'GET' && isListPath(path, '/presentations')) {
    const rows = [...presentationSnapshots.values()];
    return json({ presentations: rows });
  }

  if (method === 'GET' && isListPath(path, '/initiative-drafts')) {
    const [, qs] = path.split('?');
    const params = new URLSearchParams(qs || '');
    const outputId = params.get('outputId');
    let rows = [...initiativeDrafts.values()];
    if (outputId) rows = rows.filter((d) => d.outputId === outputId);
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return json({ initiativeDrafts: rows });
  }
  const draftMatch = path.match(/^\/initiative-drafts\/([^/]+)$/);
  if (draftMatch && method === 'GET') {
    const draft = initiativeDrafts.get(draftMatch[1]);
    if (!draft) return json({ error: 'not_found' }, 404);
    return json({ draft });
  }

  return json({ error: 'not_found', path, method }, 404);
}

// ---------------------------------------------------------------------------
// Install — patches window.fetch. Idempotent (guarded), pass-through for
// anything outside `/api/method/**`.
// ---------------------------------------------------------------------------

let installed = false;
let forceNextCreateError = false;

/** TEST/HARNESS ONLY — makes the NEXT `POST /sessions` fail with a 500, so
 * `?state=error` can show `DrdHttpMethodWorkspaceScreen`'s real bootError
 * path (`ErrorRetryView`) instead of a state the component fakes itself. */
export function forceNextSessionCreateError(): void {
  forceNextCreateError = true;
}

export function installMethodCoreFakeServer(): void {
  if (installed) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();

    const idx = url.indexOf('/api/method');
    if (idx === -1) return originalFetch(input, init);
    const path = url.slice(idx + '/api/method'.length) || '/';
    const idemKey = (init?.headers as Record<string, string> | undefined)?.['Idempotency-Key'] ?? null;

    let body: any = {};
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = {};
      }
    }

    try {
      return await route(method, path, body, idemKey);
    } catch (err) {
      // A bug in this fake server must never masquerade as a real server
      // 500 the component then has to "honestly" recover from — surface it
      // loudly in the console instead.
      // eslint-disable-next-line no-console
      console.error('[methodCoreFakeServer] route error', method, path, err);
      return json({ error: 'fake_server_error', message: err instanceof Error ? err.message : String(err) }, 500);
    }
  };
}

/** TEST/HARNESS ONLY — force a network-level failure for the next N calls to
 * `/api/method/**`, so a screen can exercise a genuine `isNetworkError`
 * offline path if it ever needs one beyond `DrdHttpMethodWorkspaceScreen`'s
 * own `forceState` prop. Not used by either T5 screen today (both reach
 * offline/conflict via `forceState`), kept small and inert until needed.
 */
export function resetMethodCoreFakeServer(): void {
  sessions.clear();
  eventsBySession.clear();
  idemSeen.clear();
  outputs.clear();
  reportSnapshots.clear();
  presentationSnapshots.clear();
  initiativeDrafts.clear();
  lineageBySession.clear();
}

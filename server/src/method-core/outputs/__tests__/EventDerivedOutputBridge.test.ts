/**
 * EventDerivedOutputBridge — the freeze -> Output bridge (A6, 2026-08-13).
 *
 * Covers vertical-slice test requirement 5 ("freeze tworzy AssessmentOutput
 * — most działa") end-to-end through the REAL `MethodSessionService`, not a
 * stub: append real kernel events, drive the real transition matrix up to
 * `frozen`, and assert a real `method_outputs` row (+ findings) exists
 * afterwards, built from those exact events.
 *
 * Also covers the pure derivation (`deriveFindingsFromEvents`) in isolation,
 * and proves a session with `outputBridge` omitted keeps the pre-A6
 * behaviour (snapshot only, no Output — never silently created either).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KernelTestDbHandle } from '../../__tests__/kernelTestDb.js';
import type { MethodEvent } from '../../contracts/index.js';

let testDb: KernelTestDbHandle;

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('../../__tests__/kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodEventStore } = await import('../../MethodEventStore.js');
const { MethodSessionService } = await import('../../MethodSessionService.js');
const { MethodOutputService } = await import('../MethodOutputService.js');
const { EventDerivedOutputBridge, deriveFindingsFromEvents } = await import(
  '../EventDerivedOutputBridge.js'
);
import type { MethodOutputBridge, PackReadinessLookup } from '../../MethodSessionService.js';

const organizationId = 'org-1';

function makeEvent(overrides: Partial<MethodEvent> = {}): MethodEvent {
  return {
    id: overrides.id ?? `ev-${Math.random().toString(36).slice(2)}`,
    type: 'ANSWER_CONFIRMED',
    organizationId,
    sessionId: 'session-1',
    unitId: '1A',
    level: 3,
    actorKind: 'human',
    actorUserId: 'user-1',
    methodPackVersion: '1.0.0',
    occurredAt: '2026-08-13T10:00:00.000Z',
    payload: {},
    ...overrides,
  };
}

describe('deriveFindingsFromEvents (pure)', () => {
  it('builds a finding only for units that have >=1 EVIDENCE_ATTACHED event', () => {
    const events: MethodEvent[] = [
      makeEvent({ id: 'e1', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 1 }),
      makeEvent({ id: 'e1b', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2 }),
      makeEvent({
        id: 'e2',
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
      }),
      // 1B has an answer but NO evidence -> current/target recorded, no finding.
      makeEvent({ id: 'e3', type: 'ANSWER_CONFIRMED', unitId: '1B', level: 1 }),
      makeEvent({
        id: 'e4',
        type: 'DECISION_APPROVED',
        unitId: '1A',
        level: 4,
        payload: { decisionId: 'd-1', subject: 'target_level', rationale: 'demo target' },
      }),
    ];

    const { findings, current, target, gap } = deriveFindingsFromEvents(events);

    expect(current).toEqual({ '1A': 2, '1B': 1 });
    expect(target).toEqual({ '1A': 4, '1B': null });
    expect(gap).toEqual({ '1A': 2, '1B': null });

    expect(findings).toHaveLength(1);
    expect(findings[0].unitId).toBe('1A');
    expect(findings[0].supportingEvidence).toHaveLength(1);
    expect(findings[0].supportingEvidence[0].evidenceId).toBe('ev-1');
    expect(findings[0].businessMeaning.length).toBeGreaterThan(0);
    expect(findings[0].recommendation.length).toBeGreaterThan(0);
  });

  it('DEC-546: a confirmed Yes advances currentLevel even before supporting evidence exists', () => {
    const events: MethodEvent[] = [
      makeEvent({ id: 'e1', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 1, payload: { questionId: 'q1', answerState: 'confirmed' } }),
      makeEvent({ id: 'e2', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2, payload: { questionId: 'q2', answerState: 'confirmed' } }),
    ];

    const { current, findings } = deriveFindingsFromEvents(events);

    expect(current['1A']).toBe(2);
    expect(findings).toHaveLength(0);
  });

  it('DEC-544: a later yes above a no/help gap never raises currentLevel', () => {
    const events: MethodEvent[] = [
      makeEvent({ id: 'e1', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 1, payload: { questionId: 'q1', answerState: 'confirmed' } }),
      makeEvent({ id: 'e2', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 2, payload: { questionId: 'q2', answerState: 'confirmed' } }),
      makeEvent({ id: 'e3', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 3, payload: { questionId: 'q3', answerState: 'no' } }),
      makeEvent({ id: 'e4', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 5, payload: { questionId: 'q5', answerState: 'confirmed' } }),
      makeEvent({
        id: 'e5',
        type: 'EVIDENCE_ATTACHED',
        unitId: '1A',
        payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
      }),
    ];
    const { current, findings } = deriveFindingsFromEvents(events);
    expect(current['1A']).toBe(2);
    expect(findings[0].currentLevel).toBe(2);
  });
});

describe('EventDerivedOutputBridge (wired into MethodSessionService.transition)', () => {
  let events: InstanceType<typeof MethodEventStore>;
  let outputs: InstanceType<typeof MethodOutputService>;
  const packs: PackReadinessLookup = { async getReadiness() { return { canStart: true }; } };

  beforeEach(() => {
    testDb.reset();
    events = new MethodEventStore();
    outputs = new MethodOutputService();
  });

  async function driveToInReview(
    service: InstanceType<typeof MethodSessionService>,
    sessionName?: string
  ) {
    const created = await service.createSession({
      organizationId,
      projectId: null,
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '1.0.0',
      ownerUserId: 'owner-1',
      mode: 'guided_manual',
      ...(sessionName === undefined ? {} : { name: sessionName }),
    });
    if (!created.ok) throw new Error('setup: createSession failed');
    const session = created.session;
    await service.assignRole(organizationId, session.id, 'owner-1', 'owner');
    await service.assignRole(organizationId, session.id, 'owner-1', 'lead_assessor');

    await events.append({
      organizationId,
      sessionId: session.id,
      type: 'ANSWER_CONFIRMED',
      unitId: '1A',
      level: 3,
      actorKind: 'human',
      actorUserId: 'owner-1',
      methodPackVersion: '1.0.0',
      payload: { questionId: 'q-1', answerState: 'confirmed' },
    });
    await events.append({
      organizationId,
      sessionId: session.id,
      type: 'EVIDENCE_ATTACHED',
      unitId: '1A',
      actorKind: 'human',
      actorUserId: 'owner-1',
      methodPackVersion: '1.0.0',
      payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
    });

    const toPrepared = await service.transition({
      sessionId: session.id,
      to: 'prepared',
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: `${session.id}-prep`,
    });
    if (!toPrepared.ok) throw new Error('setup: draft->prepared failed: ' + JSON.stringify(toPrepared));

    const toActive = await service.transition({
      sessionId: session.id,
      to: 'active',
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: `${session.id}-active`,
    });
    if (!toActive.ok) throw new Error('setup: prepared->active failed: ' + JSON.stringify(toActive));

    const toReview = await service.transition({
      sessionId: session.id,
      to: 'in_review',
      actorKind: 'human',
      actorUserId: 'owner-1',
      idempotencyKey: `${session.id}-review`,
    });
    if (!toReview.ok) throw new Error('setup: active->in_review failed: ' + JSON.stringify(toReview));
    return session;
  }

  it('requirement 5: freeze with the bridge wired creates a real AssessmentOutput (method_outputs row + findings)', async () => {
    const bridge = new EventDerivedOutputBridge(events, outputs);
    const service = new MethodSessionService(packs, events, bridge);
    const session = await driveToInReview(service);
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    const result = await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${session.id}-freeze`,
    });
    expect(result.ok).toBe(true);

    const outputRows = testDb.getRows('method_outputs');
    expect(outputRows).toHaveLength(1);
    expect(outputRows[0].session_id).toBe(session.id);

    const findingRows = testDb.getRows('method_findings');
    expect(findingRows).toHaveLength(1);
    expect(findingRows[0].unit_id).toBe('1A');

    // The bridge also appends an OUTPUT_CREATED event into the SAME store.
    const allEvents = await events.listBySession(organizationId, session.id);
    const outputCreated = allEvents.find((e) => e.type === 'OUTPUT_CREATED');
    expect(outputCreated).toBeTruthy();
    expect((outputCreated!.payload as any).outputId).toBe(outputRows[0].id);
  });

  /**
   * ★ D-48 (DLUG-PO-MVP, 2026-09-18) — test WPIĘCIA, nie obecności: DEC-602
   * dał nazwę sesji tylko nagłówkowi powłoki; w TREŚCI zamrożonego raportu
   * sesja wciąż występowała jako goły uuid (`Scope: session 63aa51e1-…`).
   * Asertujemy ARGUMENT, który realne zamrożenie `MethodSessionService`
   * przekazuje do mostka — nie lokalne lustro. Mutacja: usuń
   * `sessionName: sessionRow.name ?? null` w `snapshotOnFreeze` → oba
   * przypadki poniżej spadają (undefined !== nazwa).
   */
  it('D-48: freeze hands the bridge the session NAME (explicit and generated), not only the uuid', async () => {
    const odebrane: Array<Parameters<MethodOutputBridge['onSessionFrozen']>[0]> = [];
    const recordingBridge: MethodOutputBridge = {
      async onSessionFrozen(input) {
        odebrane.push(input);
      },
    };
    const service = new MethodSessionService(packs, events, recordingBridge);

    const nazwana = await driveToInReview(service, 'Northwind AI Readiness — pilot 2');
    await service.assignRole(organizationId, nazwana.id, 'approver-1', 'approver');
    await service.transition({
      sessionId: nazwana.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${nazwana.id}-freeze`,
    });

    expect(odebrane).toHaveLength(1);
    expect(odebrane[0].sessionId).toBe(nazwana.id);
    expect(odebrane[0].sessionName).toBe('Northwind AI Readiness — pilot 2');
    expect(odebrane[0].sessionName).not.toBe(odebrane[0].sessionId);
  });

  it('D-48: a session the user never renamed still forwards its generated label (uuid stays in sessionId)', async () => {
    const odebrane: Array<Parameters<MethodOutputBridge['onSessionFrozen']>[0]> = [];
    const recordingBridge: MethodOutputBridge = {
      async onSessionFrozen(input) {
        odebrane.push(input);
      },
    };
    const service = new MethodSessionService(packs, events, recordingBridge);

    const bezNazwy = await driveToInReview(service);
    const zapisana = await service.getSession(bezNazwy.id);
    await service.assignRole(organizationId, bezNazwy.id, 'approver-1', 'approver');
    await service.transition({
      sessionId: bezNazwy.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${bezNazwy.id}-freeze`,
    });

    expect(odebrane).toHaveLength(1);
    // `normalizeMethodSessionName` nigdy nie zostawia pustej nazwy, więc
    // mostek zawsze ma etykietę — a identyfikator zostaje w swoim polu.
    expect(odebrane[0].sessionName).toBe(zapisana?.name ?? null);
    expect(String(odebrane[0].sessionName ?? '').trim().length).toBeGreaterThan(0);
    expect(odebrane[0].sessionId).toBe(bezNazwy.id);
  });

  it('D-48: the FROZEN scope sentence carries the session name and no longer the raw uuid', async () => {
    const bridge = new EventDerivedOutputBridge(events, outputs);
    const service = new MethodSessionService(packs, events, bridge);
    const session = await driveToInReview(service, 'Northwind AI Readiness — pilot 2');
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${session.id}-freeze`,
    });

    const outputRows = testDb.getRows('method_outputs');
    expect(outputRows).toHaveLength(1);
    const scope = String(outputRows[0].scope ?? '');
    expect(scope).toContain('Northwind AI Readiness — pilot 2');
    expect(scope).not.toContain(session.id);
    // uuid nie znika z rekordu — zostaje tam, gdzie jest identyfikatorem.
    expect(outputRows[0].session_id).toBe(session.id);
  });

  it('freeze without a bridge wired keeps pre-A6 behaviour: snapshot only, no Output created', async () => {
    const service = new MethodSessionService(packs, events); // no 3rd arg
    const session = await driveToInReview(service);
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    const result = await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: `${session.id}-freeze`,
    });
    expect(result.ok).toBe(true);
    expect(testDb.getRows('method_snapshots')).toHaveLength(1);
    expect(testDb.getRows('method_outputs')).toHaveLength(0);
  });

  it('a bridge that throws fails the whole freeze — no half-frozen state silently accepted', async () => {
    const throwingBridge = {
      async onSessionFrozen(): Promise<void> {
        throw new Error('boom: downstream Output rejected the data');
      },
    };
    const service = new MethodSessionService(packs, events, throwingBridge);
    const session = await driveToInReview(service);
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    await expect(
      service.transition({
        sessionId: session.id,
        to: 'frozen',
        actorKind: 'human',
        actorUserId: 'approver-1',
        idempotencyKey: `${session.id}-freeze`,
      })
    ).rejects.toThrow(/boom/);
  });
});

/**
 * Program spójności językowej (docs/program/JEZYK_EN_PL_20260908/PLAN.md §2.5).
 *
 * `scope` i `limitations` zamrożonego Outputu to ZDANIA, które klient czyta
 * w raporcie z oceny (rozdział „Ograniczenia i założenia", stopka). Do 2026-09
 * były zaszyte po polsku niezależnie od języka konta — użytkownik EN dostawał
 * polskie zdania w dokumencie dla zarządu.
 *
 * Test pilnuje TRZECH przypadków, bo każdy ma inną przyczynę awarii:
 *   language='en'  -> angielski (regresja: powrót polskiego szablonu),
 *   language='pl'  -> polski    (regresja: „naprawa" przez zangielszczenie wszystkiego),
 *   brak language  -> angielski (regresja: cichy powrót do polskiego domyślnego).
 */
describe('EventDerivedOutputBridge — scope/limitations w języku konta', () => {
  let events: InstanceType<typeof MethodEventStore>;
  let outputs: InstanceType<typeof MethodOutputService>;

  beforeEach(() => {
    testDb.reset();
    events = new MethodEventStore();
    outputs = new MethodOutputService();
  });

  async function zamroz(language: string | null | undefined, sessionName?: string | null) {
    const sessionId = `session-lang-${String(language)}`;
    await events.append({
      organizationId,
      sessionId,
      type: 'ANSWER_CONFIRMED',
      unitId: '1A',
      level: 3,
      actorKind: 'human',
      actorUserId: 'user-1',
      methodPackVersion: '1.0.0',
      payload: { questionId: 'q-1', answerState: 'confirmed' },
    });
    await events.append({
      organizationId,
      sessionId,
      type: 'EVIDENCE_ATTACHED',
      unitId: '1A',
      actorKind: 'human',
      actorUserId: 'user-1',
      methodPackVersion: '1.0.0',
      payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
    });

    const bridge = new EventDerivedOutputBridge(events, outputs);
    await bridge.onSessionFrozen({
      organizationId,
      sessionId,
      snapshotId: `snap-${sessionId}`,
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '1.0.0',
      demoBypassActive: false,
      revisionOfSessionId: null,
      ...(sessionName === undefined ? {} : { sessionName }),
      ...(language === undefined ? {} : { language }),
    });

    const rows = testDb.getRows('method_outputs');
    const row = rows[rows.length - 1];
    const findings = testDb
      .getRows('method_findings')
      .filter((f: Record<string, unknown>) => f.output_id === row.id);
    return {
      scope: String(row.scope ?? ''),
      limitations: JSON.parse(String(row.limitations_json ?? '[]')) as string[],
      findings,
    };
  }

  /** Polskie znaki diakrytyczne — najprostszy niezaprzeczalny dowód języka. */
  const maPolskieZnaki = (text: string) => /[ąćęłńóśźż]/i.test(text);

  it("language='en' — scope i limitations są po angielsku, bez ani jednego polskiego znaku", async () => {
    const { scope, limitations } = await zamroz('en');

    expect(scope).toContain('frozen snapshot');
    expect(maPolskieZnaki(scope)).toBe(false);
    expect(limitations.length).toBeGreaterThan(0);
    for (const l of limitations) {
      expect(maPolskieZnaki(l)).toBe(false);
    }
    expect(limitations.join(' ')).toContain('derived deterministically from the confirmed answers');
  });

  /**
   * ★ FALA J3 (2026-09-14) — D5. `findings[].unitName` był KOPIĄ `unitId` dla
   * 39/39 jednostek, więc raport z oceny pisał „Area 1A" zamiast
   * „Sales Processes" (zmierzone: staging a2b0a0fe32, output fa94f405).
   * Dowód mutacyjny: przywróć `unitName: u.unitId` w mostku → obie asercje
   * poniżej spadają; usuń sam warunek języka w `outputUnitNames` → spada
   * asercja EN, PL przechodzi (czyli dokładnie stan sprzed J1/J3).
   *
   * To zmienia TREŚĆ nowych Outputów (a więc i ich `contentHash`); rekordy
   * już zamrożone są nietknięte — zapis jest INSERT-only.
   */
  it("EN: unitName to nazwa obszaru z metodyki, nie identyfikator", async () => {
    const { findings } = await zamroz('en');
    expect(findings).toHaveLength(1);
    expect(findings[0].unit_id).toBe('1A');
    expect(findings[0].unit_name).toBe('Sales Processes');
  });

  it("PL: ta sama jednostka dostaje polską nazwę", async () => {
    const { findings } = await zamroz('pl');
    expect(findings).toHaveLength(1);
    expect(findings[0].unit_name).toBe('Procesy Sprzedaży');
  });

  it('nieznana metodyka nie dostaje zmyślonej nazwy — zostaje identyfikator', async () => {
    const { unitNameResolverForPack } = await import('../outputUnitNames.js');
    expect(unitNameResolverForPack('siri', 'en')).toBeNull();
    const drd = unitNameResolverForPack('drd', 'en');
    expect(drd).not.toBeNull();
    // Jednostka spoza struktury DRD wraca jako własny identyfikator.
    expect(drd!('ZZ9')).toBe('ZZ9');
  });

  it("language='pl' — scope i limitations zostają po polsku (naprawa EN nie zabiera polskiego)", async () => {
    const { scope, limitations } = await zamroz('pl');

    expect(scope).toContain('stan zamrożony');
    expect(maPolskieZnaki(scope)).toBe(true);
    expect(limitations.join(' ')).toContain('z potwierdzonych odpowiedzi');
  });

  it('brak języka — wypada angielski, nie polski (reguła programu: EN jest domyślne)', async () => {
    const { scope, limitations } = await zamroz(undefined);

    expect(maPolskieZnaki(scope)).toBe(false);
    expect(scope).toContain('frozen snapshot');
    for (const l of limitations) {
      expect(maPolskieZnaki(l)).toBe(false);
    }
  });

  /**
   * ★ D-48 — `scope` to zdanie, które klient czyta w raporcie z oceny
   * (stopka „Ocena" i podtytuł tożsamości dokumentu). Do dziś stał w nim
   * goły uuid sesji; DEC-602 dał nazwę tylko nagłówkowi powłoki. Trzy
   * przypadki, bo każdy psuje się inaczej: nazwa obecna (EN i PL), nazwa
   * biała („naprawa" przez `??` zamiast `||` + `trim()` — zdanie brzmiałoby
   * „Scope: session , method pack …") i nazwa nieprzekazana wcale (stara
   * ścieżka: identyfikator, nie pustka i nie `undefined`).
   */
  it('D-48 EN: scope niesie nazwę sesji, nie uuid', async () => {
    const { scope } = await zamroz('en', 'Northwind AI Readiness — pilot 2');

    expect(scope).toContain('Scope: session Northwind AI Readiness — pilot 2, method pack drd 1.0.0');
    expect(scope).not.toContain('session-lang-en');
  });

  it('D-48 PL: to samo zdanie po polsku z nazwą sesji', async () => {
    const { scope } = await zamroz('pl', 'Northwind — ocena gotowości AI');

    expect(scope).toContain('Zakres: sesja Northwind — ocena gotowości AI, metodyka drd 1.0.0');
    expect(scope).not.toContain('session-lang-pl');
  });

  it('D-48: biała nazwa nie produkuje dziury w zdaniu — zostaje identyfikator', async () => {
    const { scope } = await zamroz('en', '   ');

    expect(scope).toContain('Scope: session session-lang-en, method pack drd 1.0.0');
    expect(scope).not.toContain('session ,');
  });

  it('D-48: brak nazwy w wejściu mostka — identyfikator, jak przed naprawą', async () => {
    const { scope } = await zamroz('en');

    expect(scope).toContain('Scope: session session-lang-en, method pack drd 1.0.0');
    expect(scope).not.toContain('undefined');
  });

  /**
   * FALA J2 (14.09) — „dramat właściciela". `scope`, `limitations` i zdania
   * znalezisk są DRUKOWANE w raporcie z oceny; do 14.09 mówiły o naszym
   * kodzie: „EventDerivedOutputBridge", „vertical-slice demo", „event-store",
   * „client-side". To nazwy klas i magazynów, nie język klienta — a raz
   * zamrożone zostają w rekordzie na zawsze.
   *
   * Bramka pilnuje OBU wariantów językowych naraz, bo poprzednie naprawy
   * językowe raz po raz zostawiały drugi wariant nietknięty.
   */
  const ZAKAZANE = /EventDerivedOutputBridge|vertical-slice|event-store|event store|client-side|drdAdapter|aggregation\.byGroup|businessMeaning/i;

  it.each(['pl', 'en'])(
    'język=%s — zamrożone zdania nie niosą nazw klas, plików ani magazynów',
    async (language) => {
      const { scope, limitations } = await zamroz(language);
      expect(scope).not.toMatch(ZAKAZANE);
      for (const l of limitations) {
        expect(l).not.toMatch(ZAKAZANE);
      }
    }
  );

  it.each(['pl', 'en'])(
    'język=%s — zdania znalezisk też są w języku klienta, nie w języku kodu',
    async (language) => {
      const zdania = deriveFindingsFromEvents(
        [
          makeEvent({ id: 'ev-a', type: 'ANSWER_CONFIRMED', unitId: '1A', level: 3 }),
          makeEvent({
            id: 'ev-b',
            type: 'EVIDENCE_ATTACHED',
            unitId: '1A',
            payload: { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2' },
          }),
        ],
        language as 'pl' | 'en'
      ).findings;

      expect(zdania.length).toBeGreaterThan(0);
      for (const f of zdania) {
        for (const tekst of [
          f.businessMeaning,
          f.recommendation,
          f.expectedOutcome ?? '',
          f.riskOrOpportunity ?? '',
          f.priorityRationale ?? '',
        ]) {
          expect(tekst).not.toMatch(ZAKAZANE);
        }
      }
      // Wariant językowy naprawdę się przełącza (regresja: jeden szablon na oba).
      // Diakrytyki tu nie wystarczą — polskie zdanie znaleziska potrafi nie
      // mieć ani jednej („Obszar 1A potwierdzony na poziomie 3"), więc
      // sprawdzamy słowo-znacznik wariantu.
      const tresc = zdania.map((f) => f.businessMeaning).join(' ');
      expect(tresc).toMatch(language === 'pl' ? /Obszar/ : /Area/);
      expect(tresc).not.toMatch(language === 'pl' ? /Area/ : /Obszar/);
    }
  );
});

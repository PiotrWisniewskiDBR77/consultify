/**
 * H1d — BRAMKA „AKTUALNA DECYZJA GO" PRZY STARCIE REALIZACJI, NA ŻYWYM POSTGRESIE.
 *
 * CO DOWODZI
 * ----------
 * Naprawa H16/INI-005 („decyzja GO musi być aktualna w momencie startu
 * realizacji") była MARTWA od migracji P12. Bramka w
 * `initiativeTransitionService` porównywała `currentStatus === 'SCHEDULED' &&
 * nextStatus === 'EXECUTING'`, a od `20262103_p12_initiative_status_slownik.sql`
 * kolumna `initiatives.status` nie może zawierać ani jednego z tych kodów
 * (CHECK `initiatives_status_check_p12` dopuszcza siedem: PROPOSED · DRAFT ·
 * PENDING_APPROVAL · APPROVED · IN_EXECUTION · CLOSED · REJECTED). Warunek nie
 * mógł być prawdziwy dla ŻADNEGO wiersza → `hasApprovedGateDecision` nigdy się
 * nie wołało → start realizacji przechodził bez decyzji GO.
 *
 * TEST A (RED przed naprawą): inicjatywa na etapie silnika `SCHEDULED`
 * (kolumna `APPROVED`), spełniająca WSZYSTKIE pozostałe bramki (przyjęty
 * handoff, data startu, kamień milowy, rola bramkowa PMO), ale BEZ jakiejkolwiek
 * decyzji w `initiative_lifecycle_gate_decisions` — `executeInitiativeTransition`
 * MUSI odmówić 409 `GATE_DECISION_REQUIRED`, a SELECT po akcji musi pokazać
 * niezmieniony stan. Przed naprawą ten test był czerwony: przejście wykonywało
 * się z `ok:true`.
 *
 * TEST B (GREEN): ten sam wiersz, ale z aktualną, zatwierdzoną decyzją
 * `GOVERNANCE_DECISION_MAKING` zapisaną kanoniczną drogą (propozycja → recenzja
 * A05 → wykonanie) — przejście przechodzi, `execution_started_at` jest
 * ustawione, `initiative_handoffs` dostaje wiersz.
 *
 * DLACZEGO REALNA BAZA: cały defekt polega na tym, że CHECK po drugiej stronie
 * połączenia wyklucza wartości, których kod szuka. Test jednostkowy z atrapą
 * bazy zapisałby 'SCHEDULED' bez mrugnięcia i ogłosił bramkę sprawną.
 *
 * ENV (kontrakt FIN-005):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:pg@127.0.0.1:6502/h1d \
 *   npx vitest run server/src/services/initiative/__tests__/h1d-start-execution-go-gate.pg.test.ts \
 *     --maxWorkers=1
 * Bez tych zmiennych test jest SKIPPED — nigdy cicho zielony.
 *
 * SPRZĄTANIE — Z JEDNYM ZMIERZONYM WYJĄTKIEM: każdy identyfikator niesie prefiks
 * `h1d-` i losowy UUID, a `afterAll` kasuje wszystko, co ten plik wstawił, POZA
 * `initiative_lifecycle_gate_decisions`. Ta tabela ma wyzwalacz
 * `reject_initiative_lifecycle_gate_decision_mutation` („are immutable; append a
 * new version"), więc DELETE na niej jest niemożliwy Z ZAŁOŻENIA — a skoro
 * `initiatives` ma z niej klucz obcy, wiersz inicjatywy też zostaje. Dotyczy to
 * KAŻDEGO testu przechodzącego kanoniczny łańcuch A05 (również H1c). Dlatego ten
 * plik wolno uruchamiać WYŁĄCZNIE na bazie jednorazowej (kontener `h1d-pg`),
 * NIGDY na stagingu/demo — wymóg jawnego `DATABASE_URL` jest tu bezpiecznikiem,
 * nie formalnością.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// Musi się wydarzyć PRZED importem `queryHelpers` — `vitest.config.ts` wymusza
// DB_TYPE=sqlite domyślnie.
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}

const TERESA_AGENT_ID = 'consultify:teresa:transformation-agent';

describe.skipIf(!REAL_PG_REQUESTED)('H1d — start realizacji wymaga aktualnej decyzji GO', () => {
  let sql: InstanceType<typeof import('pg').Client>;
  let executeInitiativeTransition: typeof import('../initiativeTransitionService.js').executeInitiativeTransition;
  let autoStartScheduledInitiatives: typeof import('../../../jobs/initiativeAutoStartJob.js').autoStartScheduledInitiatives;
  let proposeEarlyInitiativeTransition: typeof import('../../v8/transformationInitiativeTransitionAdapterService.js').proposeEarlyInitiativeTransition;
  let executeApprovedEarlyInitiativeTransition: typeof import('../../v8/transformationInitiativeTransitionAdapterService.js').executeApprovedEarlyInitiativeTransition;
  let reviewProposalScope: typeof import('../../v8/agentProposalGovernanceService.js').reviewProposalScope;

  const suffix = randomUUID();
  const organizationId = `h1d-org-${suffix}`;
  const projectId = `h1d-proj-${suffix}`;
  const proposerUserId = `h1d-proposer-${suffix}`;
  const reviewerUserId = `h1d-reviewer-${suffix}`;
  const initiativeId = `h1d-init-${suffix}`;
  /** Bliźniak dla testu PARYTETU przy fladze OFF — ten sam kształt, osobny wiersz. */
  const parityInitiativeId = `h1d-init-off-${suffix}`;
  const transformationCaseId = `h1d-case-${suffix}`;
  const planId = `h1d-plan-${suffix}`;
  const runId = `h1d-run-${suffix}`;
  const lineageId = `h1d-lineage-${suffix}`;
  const baselineId = `h1d-baseline-${suffix}`;

  beforeAll(async () => {
    // Bramka GO startu realizacji jest od integracji fali B3 za flagą serwerową
    // `ENABLE_LIFECYCLE_GO_GATE`, DOMYŚLNIE WYŁĄCZONĄ (rozjazd z preflightem +
    // brak ludzkiej ścieżki zapisu decyzji przy OFF-owej skrzynce H1b).
    // Testy A i B dowodzą bramki WŁĄCZONEJ, test PARYTETU (poniżej) — wyłączonej.
    process.env.ENABLE_LIFECYCLE_GO_GATE = 'true';
    const pg = await import('pg');
    sql = new pg.Client({ connectionString: CONNECTION_STRING });
    await sql.connect();

    executeInitiativeTransition = (await import('../initiativeTransitionService.js'))
      .executeInitiativeTransition;
    autoStartScheduledInitiatives = (await import('../../../jobs/initiativeAutoStartJob.js'))
      .autoStartScheduledInitiatives;
    const adapter = await import('../../v8/transformationInitiativeTransitionAdapterService.js');
    proposeEarlyInitiativeTransition = adapter.proposeEarlyInitiativeTransition;
    executeApprovedEarlyInitiativeTransition = adapter.executeApprovedEarlyInitiativeTransition;
    reviewProposalScope = (await import('../../v8/agentProposalGovernanceService.js'))
      .reviewProposalScope;

    await sql.query(`INSERT INTO organizations (id,name,status) VALUES ($1,$2,'active')`, [
      organizationId,
      'H1d fixture org',
    ]);
    for (const [id, role, memberRole] of [
      [proposerUserId, 'CONSULTANT', 'CONSULTANT'],
      [reviewerUserId, 'PMO', 'ADMIN'],
    ] as const) {
      await sql.query(
        `INSERT INTO users (id,organization_id,email,password,role,status)
           VALUES ($1,$2,$3,'unused-local-only',$4,'active')`,
        [id, organizationId, `${id}@test.invalid`, role]
      );
      await sql.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
           VALUES ($1,$2,$3,$4,'ACTIVE')`,
        [`${id}-om`, organizationId, id, memberRole]
      );
    }
    await sql.query(
      `INSERT INTO projects (id,organization_id,name,status) VALUES ($1,$2,$3,'active')`,
      [projectId, organizationId, 'H1d fixture project']
    );
    await sql.query(
      `INSERT INTO project_members (id,project_id,user_id,project_role)
         VALUES ($1,$2,$3,'CONSULTANT'),($4,$2,$5,'PROJECT_SPONSOR')`,
      [`${proposerUserId}-pm`, projectId, proposerUserId, `${reviewerUserId}-pm`, reviewerUserId]
    );

    // STAN WYJŚCIOWY: kolumna `APPROVED` (kod P12), etap silnika `SCHEDULED`
    // (DEC-490) — dokładnie ten wiersz, którego martwy warunek nigdy nie widział.
    await sql.query(
      `INSERT INTO initiatives
           (id,organization_id,project_id,name,status,owner_business_id,owner_execution_id,
            planned_start_date,planned_end_date,schedule_baseline_id,baseline_version)
         VALUES ($1,$2,$3,$4,'APPROVED',$5,$5,'2026-01-01','2026-12-31',$6,1)`,
      [initiativeId, organizationId, projectId, 'H1d fixture initiative', proposerUserId, baselineId]
    );
    await sql.query(
      `INSERT INTO ie_aggregate_state
           (organization_id,aggregate_type,aggregate_id,version,payload_json)
         VALUES ($1,'initiative',$2,1,$3::jsonb)`,
      [
        organizationId,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId,
          initiativeOwnerId: proposerUserId,
          title: 'H1d fixture initiative',
          lifecycleState: 'SCHEDULED',
        }),
      ]
    );
    await sql.query(
      `INSERT INTO initiative_milestones
           (id,initiative_id,organization_id,name,target_date,baseline_date,baseline_version)
         VALUES ($1,$2,$3,'H1d fixture milestone','2026-06-30','2026-06-30',1)`,
      [`h1d-milestone-${suffix}`, initiativeId, organizationId]
    );
    await sql.query(
      `INSERT INTO initiative_gate_roles (id,initiative_id,gate_role,user_id,assigned_at)
         VALUES ($1,$2,'PMO',$3,NOW())`,
      [`h1d-gate-role-${suffix}`, initiativeId, reviewerUserId]
    );
    // Bramka HANDOFF_AND_START_DATE — fikstura ją SPEŁNIA, nie rozbraja.
    await sql.query(
      `INSERT INTO initiative_handoffs
           (id,organization_id,initiative_id,from_status,to_status,boundary,
            readiness_allowed,actor_id)
         VALUES ($1,$2,$3,'APPROVED','APPROVED','ready-for-execution',TRUE,$4)`,
      [`h1d-handoff-seed-${suffix}`, organizationId, initiativeId, proposerUserId]
    );

    // ── BLIŹNIAK DO TESTU PARYTETU (flaga OFF) ────────────────────────────────
    // Ten sam kształt co wiersz główny: kolumna APPROVED, etap SCHEDULED,
    // kamień milowy, rola bramkowa PMO, przyjęty handoff — i ZERO decyzji GO.
    await sql.query(
      `INSERT INTO initiatives
           (id,organization_id,project_id,name,status,owner_business_id,owner_execution_id,
            planned_start_date,planned_end_date,schedule_baseline_id,baseline_version)
         VALUES ($1,$2,$3,$4,'APPROVED',$5,$5,'2026-01-01','2026-12-31',$6,1)`,
      [
        parityInitiativeId,
        organizationId,
        projectId,
        'H1d parity (flaga OFF)',
        proposerUserId,
        `${baselineId}-off`,
      ]
    );
    await sql.query(
      `INSERT INTO ie_aggregate_state
           (organization_id,aggregate_type,aggregate_id,version,payload_json)
         VALUES ($1,'initiative',$2,1,$3::jsonb)`,
      [
        organizationId,
        parityInitiativeId,
        JSON.stringify({
          initiativeId: parityInitiativeId,
          projectId,
          initiativeOwnerId: proposerUserId,
          title: 'H1d parity (flaga OFF)',
          lifecycleState: 'SCHEDULED',
        }),
      ]
    );
    await sql.query(
      `INSERT INTO initiative_milestones
           (id,initiative_id,organization_id,name,target_date,baseline_date,baseline_version)
         VALUES ($1,$2,$3,'H1d parity milestone','2026-06-30','2026-06-30',1)`,
      [`h1d-milestone-off-${suffix}`, parityInitiativeId, organizationId]
    );
    await sql.query(
      `INSERT INTO initiative_gate_roles (id,initiative_id,gate_role,user_id,assigned_at)
         VALUES ($1,$2,'PMO',$3,NOW())`,
      [`h1d-gate-role-off-${suffix}`, parityInitiativeId, reviewerUserId]
    );
    await sql.query(
      `INSERT INTO initiative_handoffs
           (id,organization_id,initiative_id,from_status,to_status,boundary,
            readiness_allowed,actor_id)
         VALUES ($1,$2,$3,'APPROVED','APPROVED','ready-for-execution',TRUE,$4)`,
      [`h1d-handoff-off-${suffix}`, organizationId, parityInitiativeId, proposerUserId]
    );

    await sql.query(
      `INSERT INTO wave8_agent_definitions
           (agent_id,organization_id,name,role,purpose,persona,approval_policy,cost_class,risk_level)
         VALUES ($1,NULL,'Teresa','transformation','H1d fixture','fixture','human_review','low','low')
         ON CONFLICT DO NOTHING`,
      [TERESA_AGENT_ID]
    );
    await sql.query(
      `INSERT INTO transformation_cases
           (transformation_case_id,organization_id,project_id,context_snapshot_id,execution_run_id,
            initiated_by_user_id,mandate,active_plan_id,lineage_id,idempotency_key,version)
         VALUES ($1,$2,$3,$4,$5,$6,'H1d fixture mandate',NULL,$7,$8,1)`,
      [
        transformationCaseId,
        organizationId,
        projectId,
        `h1d-snap-${suffix}`,
        runId,
        proposerUserId,
        lineageId,
        `h1d-idem-${suffix}`,
      ]
    );
    await sql.query(
      `INSERT INTO v8_execution_runs
           (run_id,organization_id,context_snapshot_id,initiator_user_id,goal)
         VALUES ($1,$2,$3,$4,'H1d fixture run')`,
      [runId, organizationId, `h1d-snap-${suffix}`, proposerUserId]
    );
    await sql.query(
      `INSERT INTO v8_agent_run_identities
           (canonical_run_id,organization_id,transformation_case_id,lineage_id)
         VALUES ($1,$2,$3,$4)`,
      [runId, organizationId, transformationCaseId, lineageId]
    );
    await sql.query(
      `INSERT INTO transformation_plans
           (plan_id,transformation_case_id,organization_id,version,summary,created_by_user_id)
         VALUES ($1,$2,$3,1,'H1d fixture plan',$4)`,
      [planId, transformationCaseId, organizationId, proposerUserId]
    );
    await sql.query(
      `UPDATE transformation_cases SET active_plan_id=$1
          WHERE transformation_case_id=$2 AND organization_id=$3`,
      [planId, transformationCaseId, organizationId]
    );
    await sql.query(
      `INSERT INTO transformation_case_artifact_links
           (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,
            artifact_id,lineage_role,created_by_user_id)
         VALUES ($1,$2,$3,'execution','initiative',$4,'output',$5)`,
      [`h1d-link-${suffix}`, transformationCaseId, organizationId, initiativeId, proposerUserId]
    );
  }, 60_000);

  afterAll(async () => {
    if (!sql) return;
    const cleanup: Array<[string, unknown[]]> = [
      [`DELETE FROM initiative_lifecycle_gate_decisions WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM initiative_milestones WHERE initiative_id=$1`, [initiativeId]],
      [`DELETE FROM initiative_milestones WHERE initiative_id=$1`, [parityInitiativeId]],
      [`DELETE FROM initiative_gate_roles WHERE initiative_id=$1`, [parityInitiativeId]],
      [`DELETE FROM initiative_handoffs WHERE initiative_id=$1`, [parityInitiativeId]],
      [`DELETE FROM ie_aggregate_state WHERE aggregate_id=$1`, [parityInitiativeId]],
      [`DELETE FROM initiative_gate_roles WHERE initiative_id=$1`, [initiativeId]],
      [`DELETE FROM initiative_handoffs WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM initiative_status_history WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM initiative_history WHERE initiative_id=$1`, [initiativeId]],
      [
        `DELETE FROM v8_agent_proposal_scope_reviews WHERE proposal_version_id IN
             (SELECT proposal_version_id FROM v8_agent_proposal_versions WHERE organization_id=$1)`,
        [organizationId],
      ],
      [
        `DELETE FROM v8_agent_proposal_governance_events WHERE proposal_version_id IN
             (SELECT proposal_version_id FROM v8_agent_proposal_versions WHERE organization_id=$1)`,
        [organizationId],
      ],
      [`DELETE FROM v8_agent_proposal_versions WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM transformation_case_artifact_links WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM transformation_plans WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM v8_agent_run_identities WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM v8_execution_runs WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM transformation_cases WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM project_members WHERE project_id=$1`, [projectId]],
      [`DELETE FROM projects WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM users WHERE organization_id=$1`, [organizationId]],
      [`DELETE FROM organizations WHERE id=$1`, [organizationId]],
    ];
    for (const [statement, params] of cleanup) {
      await sql.query(statement, params as never[]).catch(() => undefined);
    }
    await sql.end().catch(() => undefined);
  }, 60_000);

  it('★ PARYTET (flaga ENABLE_LIFECYCLE_GO_GATE=OFF): start realizacji przechodzi jak na linii', async () => {
    // Ten test broni WDROŻENIA: przy fladze wyłączonej zachowanie ma być
    // IDENTYCZNE z linią sprzed H1d — bo preflight (a więc i przycisk w UI)
    // nadal raportuje to przejście jako dozwolone, a ludzkiej ścieżki zapisu
    // decyzji GO nie ma (skrzynka H1b za `VITE_TRANSITION_INBOX`, też OFF).
    const previous = process.env.ENABLE_LIFECYCLE_GO_GATE;
    process.env.ENABLE_LIFECYCLE_GO_GATE = 'false';
    try {
      const decisionsBefore = (
        await sql.query<{ n: string }>(
          `SELECT COUNT(*) AS n FROM initiative_lifecycle_gate_decisions
            WHERE organization_id=$1 AND initiative_id=$2`,
          [organizationId, parityInitiativeId]
        )
      ).rows[0];
      // Premisa, nie założenie: decyzji GO naprawdę nie ma.
      expect(Number(decisionsBefore.n)).toBe(0);

      const result = await executeInitiativeTransition({
        orgId: organizationId,
        initiativeId: parityInitiativeId,
        actorId: reviewerUserId,
        actorRole: 'PMO',
        nextStatusInput: 'IN_EXECUTION',
        reason: 'H1d — parytet przy fladze OFF',
      });
      // eslint-disable-next-line no-console -- dowód wchodzi do evidence
      console.log('[H1d][PARYTET OFF] zwrotka:', JSON.stringify(result));
      expect(result.ok, 'flaga OFF zmieniła zachowanie — to byłby regres na stagingu').toBe(true);

      // DOWÓD SELECT-em PO akcji — zwrotka funkcji kłamała już raz w tej rodzinie.
      const after = (
        await sql.query<{ status: string }>(
          `SELECT status FROM initiatives WHERE id=$1 AND organization_id=$2`,
          [parityInitiativeId, organizationId]
        )
      ).rows[0];
      // eslint-disable-next-line no-console -- dowód wchodzi do evidence
      console.log('[H1d][PARYTET OFF][SELECT PO]', JSON.stringify(after));
      expect(after.status).toBe('IN_EXECUTION');
    } finally {
      process.env.ENABLE_LIFECYCLE_GO_GATE = previous;
    }
  }, 120_000);

  it('★ A (RED przed naprawą): bez aktualnej decyzji GO start realizacji jest odmówiony', async () => {
    const decisionsBefore = (
      await sql.query<{ n: string }>(
        `SELECT COUNT(*) AS n FROM initiative_lifecycle_gate_decisions
          WHERE organization_id=$1 AND initiative_id=$2`,
        [organizationId, initiativeId]
      )
    ).rows[0];
    // Premisa testu, nie założenie: decyzji GO NAPRAWDĘ nie ma.
    expect(Number(decisionsBefore.n)).toBe(0);

    const result = await executeInitiativeTransition({
      orgId: organizationId,
      initiativeId,
      actorId: reviewerUserId,
      actorRole: 'PMO',
      nextStatusInput: 'IN_EXECUTION',
      reason: 'H1d — próba startu bez decyzji GO',
    });
    // eslint-disable-next-line no-console -- dowód wchodzi do evidence
    console.log('[H1d][A] zwrotka:', JSON.stringify(result));

    expect(result.ok, 'start realizacji przeszedł BEZ decyzji GO — bramka H16 martwa').toBe(false);
    if (result.ok === false) {
      expect(result.statusCode).toBe(409);
      expect(result.body.rule).toBe('GATE_DECISION_REQUIRED');
      expect(String(result.body.gate)).toBe('GOVERNANCE_DECISION_MAKING');
    }

    // DOWÓD SELECT-em PO akcji — zwrotka funkcji kłamała już raz w tej rodzinie.
    const after = (
      await sql.query<{ status: string; stage: string | null; execution_started_at: Date | null }>(
        `SELECT i.status, i.execution_started_at,
                  agg.payload_json->>'lifecycleState' AS stage
             FROM initiatives i
             LEFT JOIN ie_aggregate_state agg ON agg.organization_id=i.organization_id
              AND agg.aggregate_type='initiative' AND agg.aggregate_id=i.id
            WHERE i.id=$1 AND i.organization_id=$2`,
        [initiativeId, organizationId]
      )
    ).rows[0];
    // eslint-disable-next-line no-console -- dowód wchodzi do evidence
    console.log('[H1d][A][SELECT PO]', JSON.stringify(after));
    expect(after.status).toBe('APPROVED');
    expect(after.stage).toBe('SCHEDULED');
    expect(after.execution_started_at).toBeNull();
  }, 120_000);

  it('★ C: cron auto-startu WIDZI kandydata i też nie omija bramki GO', async () => {
    // DWA defekty w jednym teście:
    //  (1) selektor kandydatów crona brzmiał `UPPER(status) = 'SCHEDULED'` —
    //      wartości, której CHECK P12 nie dopuszcza — więc zapytanie zwracało
    //      ZERO wierszy na każdej bazie po migracji. Cron nie startował nigdy
    //      niczego i nie zgłaszał przy tym żadnego błędu.
    //  (2) aktor systemowy nie omija kontroli aktualności decyzji GO — lista
    //      dozwolonych bramek zdejmuje z niego wyłącznie wymóg roli ludzkiej.
    const summary = await autoStartScheduledInitiatives({ limit: 200 });
    // eslint-disable-next-line no-console -- dowód wchodzi do evidence
    console.log('[H1d][C] podsumowanie crona:', JSON.stringify(summary));

    // Przed naprawą (1) `scanned` było 0 — selektor nie mógł trafić w żaden wiersz.
    expect(summary.scanned).toBeGreaterThanOrEqual(1);
    // Przed naprawą (2) cron wystartowałby realizację bez decyzji GO.
    expect(summary.started).toBe(0);
    expect(summary.skippedNoGoDecision).toBeGreaterThanOrEqual(1);

    const after = (
      await sql.query<{ status: string; execution_started_at: Date | null }>(
        `SELECT status, execution_started_at FROM initiatives WHERE id=$1 AND organization_id=$2`,
        [initiativeId, organizationId]
      )
    ).rows[0];
    // eslint-disable-next-line no-console -- dowód wchodzi do evidence
    console.log('[H1d][C][SELECT PO]', JSON.stringify(after));
    expect(after.status).toBe('APPROVED');
    expect(after.execution_started_at).toBeNull();
  }, 120_000);

  it('★ B (GREEN): z aktualną decyzją GO przejście przechodzi i stempluje start', async () => {
    const proposal = await proposeEarlyInitiativeTransition({
      organizationId,
      transformationCaseId,
      initiativeId,
      proposerUserId,
      reviewerUserId,
      targetStatus: 'EXECUTING',
      reason: 'H1d — kanoniczna droga do decyzji GO',
    });
    const review = await reviewProposalScope({
      proposalVersionId: proposal.proposalVersionId,
      organizationId,
      scopeKey: proposal.scopeKey,
      decision: 'approved',
      reason: 'H1d — recenzent zatwierdza',
      actorUserId: reviewerUserId,
    });
    expect(review.status).toBe('approved');

    const executed = await executeApprovedEarlyInitiativeTransition({
      organizationId,
      initiativeId,
      proposalVersionId: proposal.proposalVersionId,
      reviewerUserId,
      reviewerRole: 'PMO',
      reason: 'H1d — wykonanie z decyzją GO',
    });
    expect(executed.gateDecisionId).toBeTruthy();

    const after = (
      await sql.query<{ status: string; stage: string | null; execution_started_at: Date | null }>(
        `SELECT i.status, i.execution_started_at,
                  agg.payload_json->>'lifecycleState' AS stage
             FROM initiatives i
             LEFT JOIN ie_aggregate_state agg ON agg.organization_id=i.organization_id
              AND agg.aggregate_type='initiative' AND agg.aggregate_id=i.id
            WHERE i.id=$1 AND i.organization_id=$2`,
        [initiativeId, organizationId]
      )
    ).rows[0];
    // eslint-disable-next-line no-console -- dowód wchodzi do evidence
    console.log('[H1d][B][SELECT PO]', JSON.stringify(after));
    expect(after.status).toBe('IN_EXECUTION');
    expect(after.stage).toBe('IN_EXECUTION');
    // INI-005: wejście w IN_EXECUTION stempluje `execution_started_at`.
    // Przed naprawą warunek brzmiał `nextStatus === 'EXECUTING'` — kod, którego
    // CHECK nie dopuszcza, więc stempel nigdy nie powstawał.
    expect(after.execution_started_at).not.toBeNull();

    let handoff: { from_status: string; to_status: string } | undefined;
    for (let attempt = 0; attempt < 40 && !handoff; attempt += 1) {
      handoff = (
        await sql.query<{ from_status: string; to_status: string }>(
          `SELECT from_status,to_status FROM initiative_handoffs
              WHERE initiative_id=$1 AND organization_id=$2 AND to_status='IN_EXECUTION'
              ORDER BY created_at DESC LIMIT 1`,
          [initiativeId, organizationId]
        )
      ).rows[0];
      if (!handoff) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    // eslint-disable-next-line no-console -- dowód wchodzi do evidence
    console.log('[H1d][B][SELECT HANDOFF]', JSON.stringify(handoff));
    expect(handoff, 'initiative_handoffs nie dostał wiersza').toBeTruthy();
    expect(handoff!.from_status).toBe('APPROVED');
    expect(handoff!.to_status).toBe('IN_EXECUTION');
  }, 120_000);
});

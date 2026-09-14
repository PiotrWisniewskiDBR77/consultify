/**
 * H1c / DEC-506 — DOWÓD END-TO-END NA ŻYWYM POSTGRESIE.
 *
 * CO DOWODZI (DoD(3) etapu H1b, zamknięte w H1c):
 *   propozycja przejścia → recenzja A05 (approve scope) → wykonanie
 *   → (a) `initiatives.status` ZMIENIA SIĘ na kod 7-słownika P12,
 *     (b) etap silnika w agregacie = cel 12-stopniowy DEC-490,
 *     (c) `initiative_handoffs` dostaje wiersz (recordHandoff),
 *   wszystko potwierdzone SELECT-em PO akcji, nie zwrotką funkcji.
 *
 * DLACZEGO NIE WYSTARCZY TEST JEDNOSTKOWY: bloker H1b siedział w TRZECH
 * warstwach naraz (writer, oczekiwany stan w adapterze, read-back) i każda
 * z nich osobno wyglądała na sprawną. Tylko przejście całego łańcucha na
 * realnej bazie — z CHECK-iem `initiatives_status_check_p12` po drugiej
 * stronie — dowodzi, że cel da się ZAPISAĆ, a nie tylko zwalidować.
 *
 * ŚCIEŻKA WYBRANA NA DOWÓD: cel `EXECUTING` (etap silnika `IN_EXECUTION`).
 * To jedyny z pięciu celów, który zmienia OBIE prawdy naraz — kod kolumny
 * z `APPROVED` na `IN_EXECUTION` i etap ze `SCHEDULED` na `IN_EXECUTION`.
 * Cele `PROMOTED`/`PLANNING`/`SCHEDULED` zmieniają wyłącznie etap (kolaps
 * 12→7 daje ten sam kod), więc nie udowodniłyby punktu (a).
 *
 * ENV (kontrakt FIN-005, jak w `p12IntC.statusWritePaths.pg.test.ts`):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:pg@127.0.0.1:6500/h1c \
 *   npx vitest run server/src/services/v8/__tests__/h1c-lifecycle-stage-transition.pg.test.ts \
 *     --maxWorkers=1
 * Bez tych zmiennych test jest SKIPPED — nigdy cicho zielony.
 *
 * SPRZĄTANIE: każdy identyfikator niesie prefiks `h1c-` i losowy UUID, a
 * `afterAll` kasuje wszystko, co ten plik wstawił. Dane demo są twarzą
 * produktu — próbka po sobie sprząta.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// Musi się wydarzyć PRZED jakimkolwiek importem `queryHelpers` — `vitest.config.ts`
// wymusza DB_TYPE=sqlite domyślnie (patrz `initiativeCapabilityMatrix.pg.test.ts`).
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}

const TERESA_AGENT_ID = 'consultify:teresa:transformation-agent';

describe.skipIf(!REAL_PG_REQUESTED)(
  'H1c — łańcuch propozycja→recenzja A05→wykonanie na realnym Postgresie',
  () => {
    let sql: InstanceType<typeof import('pg').Client>;
    let proposeEarlyInitiativeTransition: typeof import('../transformationInitiativeTransitionAdapterService.js').proposeEarlyInitiativeTransition;
    let executeApprovedEarlyInitiativeTransition: typeof import('../transformationInitiativeTransitionAdapterService.js').executeApprovedEarlyInitiativeTransition;
    let reviewProposalScope: typeof import('../agentProposalGovernanceService.js').reviewProposalScope;

    const suffix = randomUUID();
    const organizationId = `h1c-org-${suffix}`;
    const projectId = `h1c-proj-${suffix}`;
    const proposerUserId = `h1c-proposer-${suffix}`;
    const reviewerUserId = `h1c-reviewer-${suffix}`;
    const initiativeId = `h1c-init-${suffix}`;
    const transformationCaseId = `h1c-case-${suffix}`;
    const planId = `h1c-plan-${suffix}`;
    const runId = `h1c-run-${suffix}`;
    const lineageId = `h1c-lineage-${suffix}`;
    const baselineId = `h1c-baseline-${suffix}`;

    beforeAll(async () => {
      const pg = await import('pg');
      sql = new pg.Client({ connectionString: CONNECTION_STRING });
      await sql.connect();

      const adapter = await import('../transformationInitiativeTransitionAdapterService.js');
      proposeEarlyInitiativeTransition = adapter.proposeEarlyInitiativeTransition;
      executeApprovedEarlyInitiativeTransition = adapter.executeApprovedEarlyInitiativeTransition;
      reviewProposalScope = (await import('../agentProposalGovernanceService.js'))
        .reviewProposalScope;

      await sql.query(`INSERT INTO organizations (id,name,status) VALUES ($1,$2,'active')`, [
        organizationId,
        'H1c fixture org',
      ]);
      // `users.role` niesie słownik ról produktu (PMO/CONSULTANT), a
      // `organization_members.role` ma WŁASNY, węższy CHECK
      // (`organization_members_role_check`: OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST).
      // To dwa różne słowniki na dwóch tabelach — fikstura musi uszanować oba.
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
        [projectId, organizationId, 'H1c fixture project']
      );
      // Recenzent MUSI mieć rolę projektową PROJECT_SPONSOR/STEERING_COMMITTEE —
      // to jest bramka rozdziału obowiązków, której ten test nie obchodzi, tylko spełnia.
      await sql.query(
        `INSERT INTO project_members (id,project_id,user_id,project_role)
         VALUES ($1,$2,$3,'CONSULTANT'),($4,$2,$5,'PROJECT_SPONSOR')`,
        [`${proposerUserId}-pm`, projectId, proposerUserId, `${reviewerUserId}-pm`, reviewerUserId]
      );

      // STAN WYJŚCIOWY: kolumna `APPROVED` (kod P12), etap silnika `SCHEDULED`
      // (DEC-490). Ta para jest sednem H1c — dwie prawdy, obie ważne, jedna
      // niewyrażalna w drugiej.
      await sql.query(
        `INSERT INTO initiatives
           (id,organization_id,project_id,name,status,owner_business_id,owner_execution_id,
            planned_start_date,planned_end_date,schedule_baseline_id,baseline_version)
         VALUES ($1,$2,$3,$4,'APPROVED',$5,$5,'2026-01-01','2026-12-31',$6,1)`,
        [initiativeId, organizationId, projectId, 'H1c fixture initiative', proposerUserId, baselineId]
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
            title: 'H1c fixture initiative',
            lifecycleState: 'SCHEDULED',
          }),
        ]
      );

      // Bramka gotowości (`schedule_milestones`) wymaga co najmniej jednego
      // kamienia milowego — inicjatywa na etapie SCHEDULED z definicji ma
      // zablokowany baseline, więc fikstura go niesie.
      await sql.query(
        `INSERT INTO initiative_milestones
           (id,initiative_id,organization_id,name,target_date,baseline_date,baseline_version)
         VALUES ($1,$2,$3,'H1c fixture milestone','2026-06-30','2026-06-30',1)`,
        [`h1c-milestone-${suffix}`, initiativeId, organizationId]
      );

      // Bramka RBAC przejścia APPROVED→IN_EXECUTION (gate START) wymaga roli
      // PMO, a bramka rozdziału obowiązków przy propozycji wymaga od tego
      // samego recenzenta PROJECT_SPONSOR. Obie role nadajemy jawnie —
      // `initiative_gate_roles` jest produktowym miejscem na przypisanie roli
      // bramkowej per inicjatywa, więc fikstura spełnia obie bramki bez
      // dotykania którejkolwiek z nich.
      await sql.query(
        `INSERT INTO initiative_gate_roles (id,initiative_id,gate_role,user_id,assigned_at)
         VALUES ($1,$2,'PMO',$3,NOW())`,
        [`h1c-gate-role-${suffix}`, initiativeId, reviewerUserId]
      );

      // Bramka `HANDOFF_AND_START_DATE` (APPROVED→IN_EXECUTION) wymaga
      // PRZYJĘTEGO handoffu z poprzedniego przejścia. W produkcie zostawia go
      // krok APPROVED_BACKLOG→SCHEDULED; skoro fikstura startuje już na etapie
      // SCHEDULED, musi też nieść jego ślad. To spełnienie bramki, nie jej
      // rozbrojenie — bramka zostaje nietknięta.
      await sql.query(
        `INSERT INTO initiative_handoffs
           (id,organization_id,initiative_id,from_status,to_status,boundary,
            readiness_allowed,actor_id)
         VALUES ($1,$2,$3,'APPROVED','APPROVED','ready-for-execution',TRUE,$4)`,
        [`h1c-handoff-seed-${suffix}`, organizationId, initiativeId, proposerUserId]
      );

      await sql.query(
        `INSERT INTO wave8_agent_definitions
           (agent_id,organization_id,name,role,purpose,persona,approval_policy,cost_class,risk_level)
         VALUES ($1,NULL,'Teresa','transformation','H1c fixture','fixture','human_review','low','low')
         ON CONFLICT DO NOTHING`,
        [TERESA_AGENT_ID]
      );
      await sql.query(
        `INSERT INTO transformation_cases
           (transformation_case_id,organization_id,project_id,context_snapshot_id,execution_run_id,
            initiated_by_user_id,mandate,active_plan_id,lineage_id,idempotency_key,version)
         VALUES ($1,$2,$3,$4,$5,$6,'H1c fixture mandate',NULL,$7,$8,1)`,
        [
          transformationCaseId,
          organizationId,
          projectId,
          `h1c-snap-${suffix}`,
          runId,
          proposerUserId,
          lineageId,
          `h1c-idem-${suffix}`,
        ]
      );
      // Tożsamość kanonicznego biegu wisi na `v8_execution_runs` (FK), a
      // `loadTransformationAgentExecutionContext` odmawia, gdy `execution_run_id`
      // sprawy i `canonical_run_id` tożsamości się rozjeżdżają — fikstura musi
      // postawić wszystkie trzy wiersze spójnie.
      await sql.query(
        `INSERT INTO v8_execution_runs
           (run_id,organization_id,context_snapshot_id,initiator_user_id,goal)
         VALUES ($1,$2,$3,$4,'H1c fixture run')`,
        [runId, organizationId, `h1c-snap-${suffix}`, proposerUserId]
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
         VALUES ($1,$2,$3,1,'H1c fixture plan',$4)`,
        [planId, transformationCaseId, organizationId, proposerUserId]
      );
      // `transformation_cases.active_plan_id` i `transformation_plans.
      // transformation_case_id` wskazują NA SIEBIE (FK w obie strony), więc
      // sprawa musi powstać bez planu, plan po niej, a podpięcie planu jest
      // trzecim krokiem. To kształt schematu, nie obejście testu.
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
        [`h1c-link-${suffix}`, transformationCaseId, organizationId, initiativeId, proposerUserId]
      );
    }, 60_000);

    afterAll(async () => {
      if (!sql) return;
      const cleanup: Array<[string, unknown[]]> = [
        [`DELETE FROM initiative_milestones WHERE initiative_id=$1`, [initiativeId]],
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

    it('★ DoD(3): cel 12-stopniowy zapisuje się jako kod 7-słownika, etap i handoff', async () => {
      // ── STAN PRZED (SELECT, nie założenie) ────────────────────────────────
      const before = (
        await sql.query<{ status: string; stage: string | null; handoffs: string }>(
          `SELECT i.status,
                  agg.payload_json->>'lifecycleState' AS stage,
                  (SELECT COUNT(*) FROM initiative_handoffs h WHERE h.initiative_id=i.id) AS handoffs
             FROM initiatives i
             LEFT JOIN ie_aggregate_state agg ON agg.organization_id=i.organization_id
              AND agg.aggregate_type='initiative' AND agg.aggregate_id=i.id
            WHERE i.id=$1 AND i.organization_id=$2`,
          [initiativeId, organizationId]
        )
      ).rows[0];
      // eslint-disable-next-line no-console -- dowód wchodzi do evidence
      console.log('[H1c][SELECT PRZED]', JSON.stringify(before));
      expect(before.status).toBe('APPROVED');
      expect(before.stage).toBe('SCHEDULED');
      // Jeden wiersz to ślad poprzedniego przejścia z fikstury — nowy handoff
      // musi dojść PONAD niego, więc liczymy przyrost, nie wartość absolutną.
      expect(Number(before.handoffs)).toBe(1);

      // ── KROK 1: PROPOZYCJA (cel w słowniku etapów, nie kodów) ─────────────
      const proposal = await proposeEarlyInitiativeTransition({
        organizationId,
        transformationCaseId,
        initiativeId,
        proposerUserId,
        reviewerUserId,
        targetStatus: 'EXECUTING',
        reason: 'H1c — dowód domknięcia łańcucha przejścia',
      });
      expect(proposal.proposalVersionId).toBeTruthy();
      expect(proposal.expectedStatus).toBe('SCHEDULED');

      // ── KROK 2: RECENZJA A05 (zatwierdzenie zakresu przez recenzenta) ─────
      const review = await reviewProposalScope({
        proposalVersionId: proposal.proposalVersionId,
        organizationId,
        scopeKey: proposal.scopeKey,
        decision: 'approved',
        reason: 'H1c — recenzent zatwierdza przejście',
        actorUserId: reviewerUserId,
      });
      expect(review.status).toBe('approved');

      // ── KROK 3: WYKONANIE (to tu H1b kończyło się 409) ────────────────────
      const executed = await executeApprovedEarlyInitiativeTransition({
        organizationId,
        initiativeId,
        proposalVersionId: proposal.proposalVersionId,
        reviewerUserId,
        reviewerRole: 'PMO',
        reason: 'H1c — wykonanie zatwierdzonego przejścia',
      });
      expect(executed.gateDecisionId).toBeTruthy();

      // ── DOWÓD: SELECT PO AKCJI, nie zwrotka funkcji ───────────────────────
      const after = (
        await sql.query<{ status: string; stage: string | null }>(
          `SELECT i.status, agg.payload_json->>'lifecycleState' AS stage
             FROM initiatives i
             LEFT JOIN ie_aggregate_state agg ON agg.organization_id=i.organization_id
              AND agg.aggregate_type='initiative' AND agg.aggregate_id=i.id
            WHERE i.id=$1 AND i.organization_id=$2`,
          [initiativeId, organizationId]
        )
      ).rows[0];
      // eslint-disable-next-line no-console -- dowód wchodzi do evidence
      console.log('[H1c][SELECT PO]', JSON.stringify(after));
      // (a) kod kolumny zmienił się na wartość z siedmiu kodów P12
      expect(after.status).toBe('IN_EXECUTION');
      // (b) etap silnika = cel 12-stopniowy
      expect(after.stage).toBe('IN_EXECUTION');

      // (c) `initiative_handoffs` dostał wiersz — to była trzecia rzecz, której
      //     H1b nie dowoził, bo transakcja padała przed zapisem statusu.
      //     `recordHandoff` jest efektem PO commicie (celowo — audyt nie może
      //     wywrócić przejścia), więc odpytujemy z krótkim oczekiwaniem.
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
      console.log('[H1c][SELECT HANDOFF]', JSON.stringify(handoff));
      expect(handoff, 'initiative_handoffs nie dostał wiersza').toBeTruthy();
      expect(handoff!.from_status).toBe('APPROVED');
      expect(handoff!.to_status).toBe('IN_EXECUTION');
      const handoffCount = (
        await sql.query<{ n: string }>(
          `SELECT COUNT(*) AS n FROM initiative_handoffs WHERE initiative_id=$1`,
          [initiativeId]
        )
      ).rows[0];
      expect(Number(handoffCount.n)).toBe(2);

      // Bezpiecznik na cichy rozjazd: agregat i kolumna muszą się zgadzać —
      // etap `IN_EXECUTION` mapuje się dokładnie na kod `IN_EXECUTION`.
      const { INITIATIVE_STAGE_TO_STATUS } = await import(
        '../../../constants/initiativeLifecycleStages.js'
      );
      expect(INITIATIVE_STAGE_TO_STATUS[after.stage as 'IN_EXECUTION']).toBe(after.status);
    }, 120_000);
  }
);

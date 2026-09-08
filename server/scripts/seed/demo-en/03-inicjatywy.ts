#!/usr/bin/env tsx
/**
 * D3 — SEED INICJATYW organizacji „Northwind Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D3, §3.2, §3.3).
 *
 * Buduje 13 inicjatyw po angielsku w pełnym rozkładzie 7 statusów DEC-424
 * (+ 1 wstrzymana FLAGĄ `on_hold`), z autorem, opisem 3-5 zdań, zakresem,
 * kategorią, priorytetem i interesariuszami RACI. Dla `IN_EXECUTION` dokłada
 * `project_id`, daty planu, właściciela wykonania i agregat runtime-v1.
 * Dodatkowo: 1 opublikowany plan (`plan_scenario`) z 4 inicjatywami
 * i 1 analiza obciążenia (`capacity_scenario`), żeby zakładki „Plan"
 * i „Obciążenie" nie były puste.
 *
 * DWA ETAPY — kolejność WYMUSZONA przez kod, nie przez wygodę:
 *   ETAP SQL   — `initiatives` (`IN_EXECUTION` zapisane jako `APPROVED`!),
 *                `initiative_stakeholders`, `initiative_status_history`,
 *                `initiative_handoffs`, łańcuch A05 pod decyzje bramkowe.
 *   ETAP API   — (`--api <url>`) logowanie właścicielem, decyzje GO przez
 *                `POST /api/initiatives/:id/lifecycle-gate-decisions`,
 *                agregaty przez `POST …/planning/initiatives/:id/register`,
 *                przejście do realizacji przez `PATCH /api/initiatives/:id/status`,
 *                plan przez `POST …/plan-scenarios/:id` (CREATE + PUBLISH),
 *                analiza obciążenia przez `POST …/capacity-scenarios/:id/compute`.
 *
 * STOP 1 (PLAN §D3): `register` ODRZUCA `IN_EXECUTION`
 * (`registerModuleInitiativeForPlanning.ts:28-34`). Dlatego etap SQL zapisuje
 * te cztery inicjatywy jako `APPROVED`, a etap API przestawia je na
 * `IN_EXECUTION` DOPIERO po rejestracji. Bez `--api` rozkład statusów jest
 * NIEPEŁNY i `--verify` to zgłosi — celowo, żeby nikt nie ogłosił „gotowe"
 * po samym SQL-u.
 *
 * STOP 2 (PLAN §3.0): każda `IN_EXECUTION` MUSI mieć `project_id` — inaczej
 * realizacja jest niewidoczna (`initiativesExecutionRuntime.routes.ts` fail-closed).
 * `--verify` sprawdza to ZAPYTANIEM.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/03-inicjatywy.ts --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx … 03-inicjatywy.ts --oczekiwany-host 54418 --apply \
 *       --api http://127.0.0.1:4179 --email james.whitfield@northwind.example \
 *       --haslo-plik /private/tmp/dane-pokazowe-en/northwind-konta-d3.txt
 *   DATABASE_URL=… npx tsx … 03-inicjatywy.ts --oczekiwany-host 54418 --verify
 *   DATABASE_URL=… npx tsx … 03-inicjatywy.ts --oczekiwany-host 54418 --reset
 *
 * IDEMPOTENCJA: identyfikatory to UUIDv5 (`00-wspolne.ts:det`); drugi `--apply`
 * bez zmian w danych musi dać `utworzono=0 zmieniono=0`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

import type { PoolClient } from 'pg';

import {
  DOMENA,
  Licznik,
  ORG_ID,
  ORG_NAZWA,
  czytajWspolneArgumenty,
  det,
  otworzPool,
  sprawdzCel,
  wymaganyUrl,
} from './00-wspolne';
import {
  INICJATYWY,
  SLUGI_PLANU,
  SLUGI_PRZEKAZANIA,
  STATUSY_KANONICZNE,
  doRejestracji,
  rozkladStatusow,
  statusEtapuSql,
  type Inicjatywa,
  type SlugOsoby,
} from './03-dane-inicjatyw';

// ============================================================================
// Identyfikatory deterministyczne
// ============================================================================
const idOsoby = (slug: SlugOsoby) => det('user', `${slug}@${DOMENA}`);
const idProjektu = (slug: string) => det('project', slug);
const idInicjatywy = (slug: string) => det('initiative', slug);

/** Łańcuch A05 — jeden wspólny dla całej organizacji (jeden program „Northwind 2027"). */
const A05 = {
  runId: det('v8-run', 'northwind-2027'),
  contextSnapshotId: det('v8-ctx', 'northwind-2027'),
  caseId: det('case', 'northwind-2027'),
  lineageId: det('lineage', 'northwind-2027'),
  proposalId: det('a05-proposal', 'northwind-2027-lifecycle-gate'),
  proposalVersionId: det('a05-proposal-version', 'northwind-2027-lifecycle-gate-v1'),
  reviewId: det('a05-review', 'northwind-2027-lifecycle-gate-v1'),
  scopeKey: 'initiative.lifecycle.gate',
  /** Ważność propozycji A05 i termin decyzji — muszą być w PRZYSZŁOŚCI (writer to sprawdza). */
  wazneDo: '2027-12-31T23:59:59.000Z',
};

const PLAN_SCENARIO_ID = det('plan-scenario', 'northwind-2027-wave-1');
const CAPACITY_SCENARIO_ID = det('capacity-scenario', 'northwind-2027-wave-1');

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.stringify(value);

// ============================================================================
// Argumenty własne paczki D3 (`00-wspolne.ts` ignoruje nieznane flagi)
// ============================================================================
interface OpcjeD3 {
  apiUrl: string | null;
  email: string;
  haslo: string | null;
}

function czytajOpcjeD3(argv: string[], hasloPlik: string): OpcjeD3 {
  let apiUrl: string | null = null;
  let email = `james.whitfield@${DOMENA}`;
  let haslo: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--api') apiUrl = argv[++i] ?? null;
    else if (a.startsWith('--api=')) apiUrl = a.split('=').slice(1).join('=');
    else if (a === '--email') email = argv[++i] ?? email;
    else if (a.startsWith('--email=')) email = a.split('=').slice(1).join('=');
  }
  if (apiUrl) {
    // Hasło NIGDY z argumentu (trafiłoby do historii powłoki) — wyłącznie z pliku
    // poza repo, tego samego, do którego zapisał je `01-rdzen.ts`.
    const tresc = fs.readFileSync(hasloPlik, 'utf8');
    const m = tresc.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/);
    haslo = m?.[1]?.trim() ?? null;
    if (!haslo) throw new Error(`Nie znalazłem hasła w pliku ${hasloPlik}. Etap API nie ruszy.`);
  }
  return { apiUrl: apiUrl ? apiUrl.replace(/\/$/, '') : null, email, haslo };
}

// ============================================================================
// PLAN (co się zmieni) — liczony z bazy, nie zakładany
// ============================================================================
type Akcja = 'utworzy' | 'zaktualizuje' | 'bez zmian';

interface PlanD3 {
  lancuchA05: Akcja;
  inicjatywy: Array<{ slug: string; akcja: Akcja; status: string }>;
  interesariusze: { oczekiwane: number; istniejace: number };
  historia: { oczekiwane: number; istniejace: number };
  przekazania: { oczekiwane: number; istniejace: number };
}

/**
 * Ślad statusu, który zapisuje ETAP SQL. Świadomie NIE zawiera ostatniego kroku
 * `APPROVED -> IN_EXECUTION` dla inicjatyw docelowo `IN_EXECUTION`: ten wiersz
 * zapisuje KANONICZNY pisarz (`PATCH /api/initiatives/:id/status`) w etapie API.
 * Zmierzone 08.09: bez tego wyłączenia w historii stały DWA identyczne wiersze
 * `APPROVED -> IN_EXECUTION` (37 zamiast 33 + 4).
 */
function sladStatusu(i: Inicjatywa): Array<{ from: string; to: string; gate: string; reason: string; kto: SlugOsoby }> {
  const slad: Array<{ from: string; to: string; gate: string; reason: string; kto: SlugOsoby }> = [];
  const kolejnosc = ['PROPOSED', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'] as const;
  const docelowy = i.status;
  if (docelowy === 'REJECTED') {
    slad.push({
      from: 'PENDING_APPROVAL',
      to: 'REJECTED',
      gate: 'REJECT',
      reason: i.blockedReason ?? 'Rejected by the approver.',
      kto: i.decydent ?? i.wlascicielBiznesowy,
    });
    return slad;
  }
  const docelowyIndex = kolejnosc.indexOf(docelowy as (typeof kolejnosc)[number]);
  const gornaGranica =
    docelowy === 'CLOSED'
      ? kolejnosc.length - 1
      : docelowy === 'IN_EXECUTION'
        ? docelowyIndex - 1 // ostatni krok pisze kanoniczny pisarz w etapie API
        : docelowyIndex;
  for (let n = 1; n <= gornaGranica; n++) {
    const from = kolejnosc[n - 1]!;
    const to = kolejnosc[n]!;
    slad.push({
      from,
      to,
      gate:
        to === 'DRAFT'
          ? 'CREATE_DRAFT'
          : to === 'PENDING_APPROVAL'
            ? 'SUBMIT_FOR_REVIEW'
            : to === 'APPROVED'
              ? 'APPROVE'
              : 'START',
      reason:
        to === 'APPROVED'
          ? 'Approved by the steering committee against the Northwind 2027 portfolio baseline.'
          : to === 'IN_EXECUTION'
            ? 'Handover accepted by the delivery owner; start date confirmed.'
            : to === 'PENDING_APPROVAL'
              ? 'Initiative card complete; submitted for approval.'
              : 'Proposal worked up into an initiative draft.',
      kto: to === 'APPROVED' || to === 'IN_EXECUTION' ? i.sponsor : i.autor,
    });
  }
  if (docelowy === 'CLOSED') {
    slad.push({
      from: 'IN_EXECUTION',
      to: 'CLOSED',
      gate: 'COMPLETE',
      reason: i.wynikZamkniecia ?? 'Delivered and closed.',
      kto: i.wlascicielBiznesowy,
    });
  }
  return slad;
}

/** Inicjatywy, które dostają wiersz `initiative_handoffs` (przekazanie do realizacji). */
const zPrzekazaniem = INICJATYWY.filter((i) => i.status === 'IN_EXECUTION' || i.status === 'APPROVED');

/** Inicjatywy, które dostają decyzję GO (bramka GOVERNANCE_DECISION_MAKING). */
const zDecyzjaGo = INICJATYWY.filter(
  (i) => i.status === 'IN_EXECUTION' || i.status === 'APPROVED' || i.status === 'PENDING_APPROVAL'
);

async function zbudujPlan(c: PoolClient): Promise<PlanD3> {
  const istniejaceCase = await c.query('SELECT 1 FROM transformation_cases WHERE transformation_case_id = $1', [
    A05.caseId,
  ]);
  const plan: PlanD3 = {
    lancuchA05: istniejaceCase.rows.length > 0 ? 'bez zmian' : 'utworzy',
    inicjatywy: [],
    interesariusze: { oczekiwane: INICJATYWY.reduce((n, i) => n + i.interesariusze.length, 0), istniejace: 0 },
    historia: { oczekiwane: INICJATYWY.reduce((n, i) => n + sladStatusu(i).length, 0), istniejace: 0 },
    przekazania: { oczekiwane: zPrzekazaniem.length, istniejace: 0 },
  };

  for (const i of INICJATYWY) {
    const istnieje = await c.query<{ status: string; name: string; description: string | null }>(
      'SELECT status, name, description FROM initiatives WHERE id = $1 AND organization_id = $2',
      [idInicjatywy(i.slug), ORG_ID]
    );
    if (istnieje.rows.length === 0) {
      plan.inicjatywy.push({ slug: i.slug, akcja: 'utworzy', status: statusEtapuSql(i) });
      continue;
    }
    const r = istnieje.rows[0]!;
    // Status docelowy ORAZ status etapu SQL są akceptowalne: po pełnym przebiegu
    // (SQL + API) wiersz stoi na docelowym i drugi `--apply` NIE MOŻE go cofnąć.
    const statusOk = r.status === i.status || r.status === statusEtapuSql(i);
    plan.inicjatywy.push({
      slug: i.slug,
      akcja: statusOk && r.name === i.tytul && r.description === i.opis ? 'bez zmian' : 'zaktualizuje',
      status: r.status,
    });
  }

  plan.interesariusze.istniejace = Number(
    (
      await c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM initiative_stakeholders s
          JOIN initiatives i ON i.id = s.initiative_id
         WHERE i.organization_id = $1`,
        [ORG_ID]
      )
    ).rows[0]!.n
  );
  plan.historia.istniejace = Number(
    (
      await c.query<{ n: string }>(
        'SELECT COUNT(*)::text AS n FROM initiative_status_history WHERE organization_id = $1',
        [ORG_ID]
      )
    ).rows[0]!.n
  );
  plan.przekazania.istniejace = Number(
    (
      await c.query<{ n: string }>(
        // Tylko przekazania SEEDA (`readiness_allowed = TRUE`). Kanoniczne przejście
        // APPROVED -> IN_EXECUTION dopisuje własny wiersz z `readiness_allowed = FALSE`
        // i `boundary = 'unknown'` — to bookkeeping runtime'u, nie treść pokazowa.
        'SELECT COUNT(*)::text AS n FROM initiative_handoffs WHERE organization_id = $1 AND readiness_allowed = TRUE',
        [ORG_ID]
      )
    ).rows[0]!.n
  );
  return plan;
}

// ============================================================================
// ETAP SQL
// ============================================================================
/**
 * Jeden upsert dla całego etapu SQL. `WHERE … IS DISTINCT FROM EXCLUDED` na
 * KAŻDEJ kolumnie, którą seed kontroluje, plus `RETURNING (xmax = 0)` daje
 * MIERZONĄ idempotencję: gdy nic się nie różni, Postgres nie zwraca wiersza
 * i licznik notuje „pominięto", a nie „zmieniono". Bez tego drugi `--apply`
 * pisałby `zmieniono=13` przy zerowej zmianie treści — czyli deklarowałby
 * idempotencję zamiast jej dowodzić.
 */
async function upsert(
  c: PoolClient,
  lic: Licznik,
  tabela: string,
  konflikt: string[],
  dane: Record<string, unknown>,
  rzutowania: Record<string, string> = {},
  dotknijUpdatedAt = false
): Promise<void> {
  const kolumny = Object.keys(dane);
  const params = Object.values(dane);
  const wartosci = kolumny.map((k, n) => `$${n + 1}${rzutowania[k] ?? ''}`);
  const aktualizowane = kolumny.filter((k) => !konflikt.includes(k) && k !== 'created_at');
  const set = aktualizowane.map((k) => `${k} = EXCLUDED.${k}`).join(', ');
  const roznica = aktualizowane.map((k) => `${tabela}.${k} IS DISTINCT FROM EXCLUDED.${k}`).join(' OR ');
  const sql =
    `INSERT INTO ${tabela} (${kolumny.join(', ')}) VALUES (${wartosci.join(', ')})\n` +
    `ON CONFLICT (${konflikt.join(', ')}) DO UPDATE SET ${set}` +
    (dotknijUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : '') +
    `\nWHERE ${roznica}\nRETURNING (xmax = 0) AS wstawiony`;
  const r = await c.query<{ wstawiony: boolean }>(sql, params);
  if ((r.rowCount ?? 0) === 0) lic.pomin();
  else if (r.rows[0]!.wstawiony) lic.utworz();
  else lic.zmien();
}

async function zapiszLancuchA05(c: PoolClient, lic: Licznik): Promise<void> {
  const wlascicielId = idOsoby('james.whitfield');

  await upsert(c, lic, 'v8_execution_runs', ['run_id'], {
    run_id: A05.runId,
    organization_id: ORG_ID,
    context_snapshot_id: A05.contextSnapshotId,
    initiator_user_id: wlascicielId,
    state: 'completed',
    plan_version: 1,
    goal: 'Northwind 2027 operational transformation programme',
    metadata: '{}',
  });

  await upsert(
    c,
    lic,
    'transformation_cases',
    ['transformation_case_id'],
    {
      transformation_case_id: A05.caseId,
      organization_id: ORG_ID,
      initiated_by_user_id: wlascicielId,
      mandate:
        'Northwind 2027: reduce unplanned downtime, cut handling cost per unit and certify the energy management system.',
      desired_outcomes_json: json([
        'Unplanned downtime reduced by 30%',
        'Handling cost per unit reduced by 20%',
        'ISO 50001 certification awarded',
      ]),
      status: 'active',
      lifecycle_stage: 'portfolio_decision',
      autonomy_level: 'A1_prepare',
      source_refs_json: '[]',
      assumptions_json: '[]',
      missing_inputs_json: '[]',
      lineage_id: A05.lineageId,
      idempotency_key: `northwind-2027-${A05.caseId.slice(0, 8)}`,
      version: 1,
    },
    {
      desired_outcomes_json: '::jsonb',
      source_refs_json: '::jsonb',
      assumptions_json: '::jsonb',
      missing_inputs_json: '::jsonb',
    }
  );

  await upsert(c, lic, 'v8_agent_run_identities', ['canonical_run_id'], {
    canonical_run_id: A05.runId,
    organization_id: ORG_ID,
    transformation_case_id: A05.caseId,
    lineage_id: A05.lineageId,
  });

  await upsert(
    c,
    lic,
    'v8_agent_proposal_versions',
    ['proposal_version_id'],
    {
      proposal_version_id: A05.proposalVersionId,
      proposal_id: A05.proposalId,
      organization_id: ORG_ID,
      canonical_run_id: A05.runId,
      proposal_version: 1,
      plan_version: 1,
      context_digest: sha256(`${A05.caseId}|lifecycle-gate|v1`),
      before_json: '{}',
      after_json: '{}',
      approval_scopes_json: json([A05.scopeKey]),
      reviewer_authority_json: json({ [A05.scopeKey]: [wlascicielId] }),
      expires_at: A05.wazneDo,
      status: 'approved',
      revision_kind: 'initial',
      created_by_user_id: wlascicielId,
    },
    {
      before_json: '::jsonb',
      after_json: '::jsonb',
      approval_scopes_json: '::jsonb',
      reviewer_authority_json: '::jsonb',
      expires_at: '::timestamptz',
    }
  );

  await upsert(c, lic, 'v8_agent_proposal_scope_reviews', ['review_id'], {
    review_id: A05.reviewId,
    proposal_version_id: A05.proposalVersionId,
    scope_key: A05.scopeKey,
    decision: 'approved',
    reason: 'Steering committee granted lifecycle gate authority for the Northwind 2027 portfolio.',
    reviewed_by_user_id: wlascicielId,
  });

  for (const i of zDecyzjaGo) {
    await upsert(
      c,
      lic,
      'transformation_case_artifact_links',
      ['transformation_case_id', 'artifact_type', 'artifact_id', 'lineage_role'],
      {
        link_id: det('case-link', i.slug),
        transformation_case_id: A05.caseId,
        organization_id: ORG_ID,
        lifecycle_stage: 'portfolio_decision',
        artifact_type: 'initiative',
        artifact_id: idInicjatywy(i.slug),
        lineage_role: 'output',
        created_by_user_id: wlascicielId,
      }
    );
  }
}

async function zapiszInicjatywe(c: PoolClient, i: Inicjatywa, lic: Licznik): Promise<void> {
  const id = idInicjatywy(i.slug);
  const przed = await c.query<{ status: string }>(
    'SELECT status FROM initiatives WHERE id = $1 AND organization_id = $2',
    [id, ORG_ID]
  );
  // Drugi `--apply` po pełnym przebiegu NIE cofa statusu z IN_EXECUTION do APPROVED
  // (etap SQL zapisuje status ETAPU, chyba że w bazie stoi już status docelowy).
  const statusDoZapisu = przed.rows[0]?.status === i.status ? i.status : statusEtapuSql(i);

  await upsert(
    c,
    lic,
    'initiatives',
    ['id'],
    {
      id,
      organization_id: ORG_ID,
      project_id: i.projekt ? idProjektu(i.projekt) : null,
      name: i.tytul,
      title: i.tytul,
      description: i.opis,
      summary: i.streszczenie,
      problem_statement: i.problem,
      status: statusDoZapisu,
      priority: i.priorytet,
      category: i.kategoria,
      area: i.obszar,
      scope_in: json(i.zakresW),
      scope_out: json(i.zakresPoza),
      success_criteria: json(i.kryteriaSukcesu),
      deliverables: json(i.produkty),
      key_risks: json(i.ryzyka),
      tags: json(i.tagi),
      business_value: i.wartoscBiznesowa,
      expected_roi: i.oczekiwanyZwrot,
      impact: i.wplyw,
      effort: i.naklad,
      risk_level: i.poziomRyzyka,
      created_by: idOsoby(i.autor),
      updated_by: idOsoby(i.autor),
      owner_business_id: idOsoby(i.wlascicielBiznesowy),
      owner_execution_id: i.wlascicielWykonania ? idOsoby(i.wlascicielWykonania) : null,
      sponsor_id: idOsoby(i.sponsor),
      planned_start_date: i.planStart,
      planned_end_date: i.planKoniec,
      start_date: i.planStart,
      end_date: i.planKoniec,
      estimated_budget: i.budzet,
      planned_budget_total: i.budzet,
      budget_currency: 'GBP',
      required_capacity_fte: i.wymaganeFte,
      allocated_capacity_fte: i.zaalokowaneFte,
      progress: i.postep,
      on_hold: i.onHold === true,
      archived: false,
      blocked_reason: i.blockedReason ?? null,
      blocked_at: i.onHold === true ? `${i.utworzono}T09:00:00.000Z` : null,
      completed_at: i.zamknieto ?? null,
      done_at: i.zamknieto ?? null,
      done_by: i.zamknieto ? idOsoby(i.wlascicielBiznesowy) : null,
      cancelled_at: i.odrzucono ?? null,
      created_at: i.utworzono,
    },
    {
      planned_start_date: '::timestamp',
      planned_end_date: '::timestamp',
      start_date: '::timestamp',
      end_date: '::timestamp',
      estimated_budget: '::real',
      planned_budget_total: '::numeric(15,2)',
      required_capacity_fte: '::real',
      allocated_capacity_fte: '::real',
      blocked_at: '::timestamptz',
      completed_at: '::timestamp',
      done_at: '::timestamp',
      cancelled_at: '::timestamp',
      created_at: '::timestamp',
    },
    true
  );

  // --- Interesariusze RACI (dziś 0 wierszy w CAŁEJ bazie — POMIAR.md §1.3) ---
  for (const s of i.interesariusze) {
    await upsert(c, lic, 'initiative_stakeholders', ['id'], {
      id: det('stakeholder', `${i.slug}|${s.osoba}|${s.raci}`),
      initiative_id: id,
      user_id: idOsoby(s.osoba),
      role: s.role,
      raci_type: s.raci,
      created_by: idOsoby(i.autor),
      influence_level: s.influence,
      interest_level: s.interest,
    });
  }

  // --- Ślad statusu (skąd inicjatywa się wzięła) ---
  const slad = sladStatusu(i);
  for (let n = 0; n < slad.length; n++) {
    const krok = slad[n]!;
    await upsert(
      c,
      lic,
      'initiative_status_history',
      ['id'],
      {
        id: det('status-history', `${i.slug}|${n}`),
        initiative_id: id,
        organization_id: ORG_ID,
        from_status: krok.from,
        to_status: krok.to,
        changed_by: idOsoby(krok.kto),
        reason: krok.reason,
        gate_type: krok.gate,
        created_at: `${i.utworzono} 09:0${Math.min(n, 9)}:00+00`,
      }
    );
  }
}

/**
 * Przekazanie do realizacji. Bez wiersza `readiness_allowed = TRUE` warunek
 * `HANDOFF_AND_START_DATE` (`initiativeTransitionConditions.ts:130-146`) blokuje
 * przejście APPROVED -> IN_EXECUTION — także w podglądzie, jako wyszarzony przycisk.
 */
async function zapiszPrzekazania(c: PoolClient, lic: Licznik): Promise<void> {
  for (const i of zPrzekazaniem) {
    await upsert(c, lic, 'initiative_handoffs', ['id'], {
      id: det('handoff', i.slug),
      organization_id: ORG_ID,
      initiative_id: idInicjatywy(i.slug),
      from_status: 'APPROVED',
      to_status: 'IN_EXECUTION',
      boundary: 'INITIATIVES_TO_EXECUTION',
      from_module: 'initiatives',
      to_module: 'execution',
      readiness_allowed: true,
      readiness_missing: '[]',
      readiness_reasons: json(['Delivery owner named', 'Start date confirmed', 'Budget released by finance']),
      actor_id: idOsoby(i.sponsor),
    });
  }
}

/**
 * Kamienie milowe. POMIAR 08.09 na kopii d3: bez ANI JEDNEGO kamienia bramka
 * `START` (APPROVED -> IN_EXECUTION) odpowiada 400 `GATE_BLOCKED`,
 * `missing: [schedule_milestones]` — „Scheduling gate requires at least one
 * milestone". To NIE jest zawartość paczki D4 „na zapas": bez tych wierszy
 * przycisk „Rozpocznij realizację" jest w podglądzie APPROVED wyszarzony,
 * a czterech inicjatyw IN_EXECUTION nie da się w ogóle utworzyć kanonicznie.
 */
const KAMIENIE: Record<string, Array<{ nazwa: string; opis: string; data: string; status: string }>> = {
  'predictive-maintenance-cnc': [
    { nazwa: 'Sensors commissioned on cells 1-2', opis: 'Vibration and spindle-current sensing live on the two pilot cells.', data: '2026-06-30', status: 'COMPLETED' },
    { nazwa: 'Alert thresholds tuned against real failures', opis: 'Thresholds validated against three months of recorded events.', data: '2026-12-18', status: 'IN_PROGRESS' },
  ],
  'mes-rollout-line-3': [
    { nazwa: 'Network and terminals installed', opis: 'Six station terminals provisioned and network coverage proven end to end.', data: '2026-09-30', status: 'COMPLETED' },
    { nazwa: 'Cutover from paper travellers', opis: 'Line 3 reporting fully on MES; paper travellers withdrawn.', data: '2027-03-26', status: 'PENDING' },
  ],
  'warehouse-automation-pilot': [
    { nazwa: 'Shuttle delivered and commissioned', opis: 'Goods-to-person shuttle accepted after factory and site testing.', data: '2026-08-28', status: 'COMPLETED' },
    { nazwa: 'Measured pilot result pack', opis: 'Before-and-after cost per pick evidenced for the wave 2 decision.', data: '2027-01-29', status: 'IN_PROGRESS' },
  ],
  'skills-matrix-upskilling': [
    { nazwa: 'Matrix populated for all production roles', opis: 'Every one of the 340 production roles recorded with current sign-off.', data: '2026-07-31', status: 'COMPLETED' },
    { nazwa: 'Single points of failure closed', opis: 'Trained backup in place for all eleven roles identified in the audit.', data: '2026-12-18', status: 'PENDING' },
  ],
  'energy-monitoring-iso-50001': [
    { nazwa: 'Sub-metering installed on the twelve largest loads', opis: 'Metering live on both sites and reporting into the energy pack.', data: '2027-02-26', status: 'PENDING' },
    { nazwa: 'ISO 50001 certification audit passed', opis: 'Certificate awarded at first audit.', data: '2027-09-30', status: 'PENDING' },
  ],
  'supplier-quality-gate': [
    { nazwa: 'Quality gate live at goods-in', opis: 'Sampling plan by supplier risk class operating within existing headcount.', data: '2027-02-26', status: 'PENDING' },
    { nazwa: 'First supplier scorecard published', opis: 'Measured defect rate returned to every supplier in scope.', data: '2027-04-30', status: 'PENDING' },
  ],
  'scrap-reduction-programme': [
    { nazwa: 'Baseline agreed for the five scrap codes', opis: 'Measured baseline and named owner in place for every code in scope.', data: '2027-02-26', status: 'PENDING' },
    { nazwa: 'Scrap at or below 2.4% of material cost', opis: 'Countermeasures embedded in standard work and holding the target.', data: '2027-12-31', status: 'PENDING' },
  ],
  'shift-handover-digitisation': [
    { nazwa: 'Digital handover live on all three shifts', opis: 'Structured form and carry-forward operating on both sites.', data: '2027-02-26', status: 'PENDING' },
    { nazwa: 'Morning meeting run from the handover record', opis: 'Production meeting agenda built from the digital record, paper logbook withdrawn.', data: '2027-05-28', status: 'PENDING' },
  ],
};

/**
 * Członkostwa w projektach. `isEligibleInitiativeOwner`
 * (`postgresInitiativeReader.ts:110-130`) wymaga wiersza w `project_members` —
 * bez niego kanoniczne uzupełnienie metadanych agregatu (`PATCH …/metadata`)
 * kończy się 422 `INITIATIVE_OWNER_INELIGIBLE`, a wiersz rejestru zostaje bez
 * tytułu, problemu i właściciela („Brak opisu problemu" na liście).
 */
const CZLONKOWIE_PROJEKTOW: Array<{ projekt: string; osoba: SlugOsoby; rola: string }> = [
  { projekt: 'operational-excellence-programme', osoba: 'james.whitfield', rola: 'PROJECT_SPONSOR' },
  { projekt: 'operational-excellence-programme', osoba: 'sarah.mitchell', rola: 'PROJECT_LEAD' },
  { projekt: 'operational-excellence-programme', osoba: 'daniel.osei', rola: 'INITIATIVE_OWNER' },
  { projekt: 'operational-excellence-programme', osoba: 'emily.carter', rola: 'INITIATIVE_OWNER' },
  { projekt: 'operational-excellence-programme', osoba: 'priya.sharma', rola: 'INITIATIVE_OWNER' },
  { projekt: 'operational-excellence-programme', osoba: 'thomas.baker', rola: 'INITIATIVE_OWNER' },
  { projekt: 'digital-automation-roadmap', osoba: 'robert.chen', rola: 'PROJECT_LEAD' },
  { projekt: 'digital-automation-roadmap', osoba: 'laura.novak', rola: 'INITIATIVE_OWNER' },
  { projekt: 'digital-automation-roadmap', osoba: 'michael.grant', rola: 'INITIATIVE_OWNER' },
  { projekt: 'digital-automation-roadmap', osoba: 'james.whitfield', rola: 'PROJECT_SPONSOR' },
];

async function zapiszCzlonkowProjektow(c: PoolClient, lic: Licznik): Promise<void> {
  for (const m of CZLONKOWIE_PROJEKTOW) {
    await upsert(c, lic, 'project_members', ['id'], {
      id: det('project-member', `${m.projekt}|${m.osoba}`),
      project_id: idProjektu(m.projekt),
      user_id: idOsoby(m.osoba),
      project_role: m.rola,
      allocation_percent: 100,
      engagement_type: 'INTERNAL',
      added_by_id: idOsoby('james.whitfield'),
    }, {}, true);
  }
}

async function zapiszKamienie(c: PoolClient, lic: Licznik): Promise<void> {
  for (const [slug, kamienie] of Object.entries(KAMIENIE)) {
    const i = INICJATYWY.find((x) => x.slug === slug)!;
    for (let n = 0; n < kamienie.length; n++) {
      const k = kamienie[n]!;
      await upsert(
        c,
        lic,
        'initiative_milestones',
        ['id'],
        {
          id: det('milestone', `${slug}|${n}`),
          initiative_id: idInicjatywy(slug),
          organization_id: ORG_ID,
          name: k.nazwa,
          description: k.opis,
          target_date: k.data,
          status: k.status,
          order_index: n,
          is_gate: 1,
          created_by: idOsoby(i.wlascicielWykonania ?? i.wlascicielBiznesowy),
          baseline_date: k.data,
          baseline_version: 1,
        },
        { target_date: '::date', baseline_date: '::date' },
        true
      );
    }
  }
}


async function zapiszSql(c: PoolClient): Promise<Licznik> {
  const lic = new Licznik();
  await c.query('BEGIN');
  try {
    await zapiszLancuchA05(c, lic);
    for (const i of INICJATYWY) await zapiszInicjatywe(c, i, lic);
    await zapiszPrzekazania(c, lic);
    await zapiszKamienie(c, lic);
    await zapiszCzlonkowProjektow(c, lic);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
  return lic;
}

// ============================================================================
// ETAP API — kanoniczni pisarze przez HTTP (ten sam kod, co klika przeglądarka)
// ============================================================================
class Api {
  private cookie = '';
  constructor(private readonly base: string) {}

  async zaloguj(email: string, haslo: string): Promise<void> {
    const r = await fetch(`${this.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json({ email, password: haslo }),
    });
    const ciasteczka = r.headers.getSetCookie?.() ?? [];
    this.cookie = ciasteczka.map((c) => c.split(';')[0]).join('; ');
    const body = await r.text();
    if (!r.ok) throw new Error(`Logowanie ${email}: HTTP ${r.status} ${body.slice(0, 300)}`);
    if (!this.cookie) {
      // Serwer może wydawać token w ciele zamiast ciasteczka — wtedy nagłówek Bearer.
      const token = (JSON.parse(body) as { token?: string; data?: { token?: string } }).token ??
        (JSON.parse(body) as { data?: { token?: string } }).data?.token;
      if (!token) throw new Error('Logowanie OK, ale ani ciasteczka, ani tokenu — etap API nie ruszy.');
      this.bearer = token;
    }
  }
  private bearer = '';

  async zadanie<T = unknown>(
    metoda: 'GET' | 'POST' | 'PATCH',
    sciezka: string,
    ciało?: unknown
  ): Promise<{ status: number; body: T }> {
    const r = await fetch(`${this.base}${sciezka}`, {
      method: metoda,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
      },
      ...(ciało === undefined ? {} : { body: json(ciało) }),
    });
    const tekst = await r.text();
    let body: unknown = tekst;
    try {
      body = JSON.parse(tekst);
    } catch {
      /* zostaw tekst — komunikat błędu bywa HTML-em */
    }
    return { status: r.status, body: body as T };
  }
}

interface WynikApi {
  decyzjeGo: number;
  decyzjeGoBledy: string[];
  agregaty: number;
  agregatyBledy: string[];
  przejscia: number;
  przejsciaBledy: string[];
  plan: string;
  obciazenie: string;
  przekazania: number;
  przekazaniaBledy: string[];
}

/**
 * DECYZJE GO — kanoniczny pisarz `recordInitiativeLifecycleGateDecision`
 * (`initiativeLifecycleGateDecisionService.ts`) wołany W PROCESIE, nie po HTTP.
 *
 * DLACZEGO NIE HTTP (zmierzone 08.09 na kopii d3, HTTP 409): trasa
 * `POST /api/initiatives/:id/lifecycle-gate-decisions` jest ZAMKNIĘTA przez
 * `requireCanonicalInitiativeExecutionWriter`
 * (`executionSpineLegacyReadOnly.middleware.ts`, wzorzec `lifecycle-gate-decisions`)
 * z uzasadnieniem „nikt jej nie woła" (0 wołaczy w `src/`). Sam PISARZ żyje
 * i jest kanoniczny — to on egzekwuje aktywnego człowieka w tenancie, rodowód
 * Case->Inicjatywa, ważną zgodę A05 w dokładnym zakresie, nieprzeterminowany
 * termin, blokadę doradczą i idempotencję. Wołamy więc pisarza, NIE wstawiamy
 * wiersza SQL-em: SQL ominąłby wszystkie te reguły naraz.
 */
async function zapiszDecyzjeGo(): Promise<{ ok: number; bledy: string[] }> {
  // `withPgTransaction` otwiera WŁASNE połączenie z `databaseConfig.postgres`
  // (leniwe proxy — czyta env przy pierwszym użyciu). `CI=true` to jedyny
  // sposób, by `databaseTargetResolver` dopuścił bazę na 127.0.0.1 BEZ
  // przełączania NODE_ENV na `test`, które podstawiłoby atrapę bazy.
  process.env.DB_TYPE = 'postgres';
  process.env.CI = 'true';
  const { withPgTransaction } = await import('../../../src/utils/queryHelpers.js');
  const { recordInitiativeLifecycleGateDecision } = await import(
    '../../../src/services/initiative/initiativeLifecycleGateDecisionService.js'
  );

  const wlascicielId = idOsoby('james.whitfield');
  let ok = 0;
  const bledy: string[] = [];
  for (const i of zDecyzjaGo) {
    try {
      await withPgTransaction((client) =>
        recordInitiativeLifecycleGateDecision(client, {
          organizationId: ORG_ID,
          initiativeId: idInicjatywy(i.slug),
          transformationCaseId: A05.caseId,
          pmoDomain: 'GOVERNANCE_DECISION_MAKING',
          decisionStatus: 'approved',
          sourceDigest: sha256(`${A05.caseId}|${i.slug}|go`),
          sourceCaseVersion: 1,
          baselineRefs: ['northwind-2027-portfolio-baseline-v1'],
          a05ProposalVersionId: A05.proposalVersionId,
          a05ApprovalReceiptRef: A05.reviewId,
          humanActorUserId: wlascicielId,
          humanAuthorityRef: A05.scopeKey,
          rationale: `GO decision for "${i.tytul}" against the Northwind 2027 portfolio baseline.`,
          deadlineAt: A05.wazneDo,
          idempotencyKey: det('gate-decision', `${i.slug}|go`),
        })
      );
      ok += 1;
    } catch (e) {
      bledy.push(`${i.slug}: ${(e as Error).message}`);
    }
  }
  return { ok, bledy };
}

async function etapApi(api: Api, autorytet: Api, menedzer: Api, c: PoolClient): Promise<WynikApi> {
  const wynik: WynikApi = {
    decyzjeGo: 0,
    decyzjeGoBledy: [],
    agregaty: 0,
    agregatyBledy: [],
    przejscia: 0,
    przejsciaBledy: [],
    plan: 'nie próbowano',
    obciazenie: 'nie próbowano',
    przekazania: 0,
    przekazaniaBledy: [],
  };

  // --- 1. Decyzje GO (bramka GOVERNANCE_DECISION_MAKING) --------------------
  const go = await zapiszDecyzjeGo();
  wynik.decyzjeGo = go.ok;
  wynik.decyzjeGoBledy = go.bledy;

  // --- 2. Agregaty runtime-v1 (STOP 1: TYLKO ze statusu APPROVED/PENDING) ---
  for (const i of doRejestracji()) {
    const id = idInicjatywy(i.slug);
    // Idempotencja: po pełnym przebiegu wiersz stoi na IN_EXECUTION, a `register`
    // takiego statusu NIE przyjmuje. Sprawdzamy ISTNIENIE agregatu, nie jego stan —
    // po łańcuchu przekazania (D4b) cztery agregaty stoją w `IN_EXECUTION`, więc
    // warunek „= APPROVED_BACKLOG" kazałby przy drugim `--apply` wołać `register`
    // jeszcze raz i produkował „błąd", który błędem nie jest.
    const juz = await c.query(
      `SELECT 1 FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [ORG_ID, id]
    );
    if (juz.rows.length > 0) {
      wynik.agregaty += 1;
      continue;
    }
    const { status, body } = await api.zadanie(
      'POST',
      `/api/initiatives/runtime-v1/planning/initiatives/${id}/register`,
      { clientRequestId: det('register', i.slug), allowConditional: true }
    );
    if (status === 200 || status === 201) wynik.agregaty += 1;
    else wynik.agregatyBledy.push(`${i.slug}: HTTP ${status} ${JSON.stringify(body).slice(0, 220)}`);
  }

  // --- 2b. Uzupełnienie metadanych agregatu ---------------------------------
  // `register` wpisuje do agregatu wyłącznie `name`/`title`. Wiersz rejestru na
  // liście czyta `problem` i `initiativeOwnerId` z agregatu, więc bez tego kroku
  // cztery zarejestrowane inicjatywy pokazują „Brak opisu problemu" i pusty
  // podpis właściciela — mimo że w tabeli `initiatives` obie wartości są.
  for (const i of doRejestracji()) {
    const id = idInicjatywy(i.slug);
    const stan = await c.query<{ version: number; payload_json: { problem?: string } }>(
      `SELECT version, payload_json FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [ORG_ID, id]
    );
    const wiersz = stan.rows[0];
    if (!wiersz || wiersz.payload_json?.problem === i.problem) continue;
    const { status, body } = await api.zadanie(
      'PATCH',
      `/api/initiatives/runtime-v1/initiatives/${id}/metadata`,
      {
        expectedVersion: Number(wiersz.version),
        clientRequestId: det('amend', i.slug),
        title: i.tytul,
        problem: i.problem,
        proposedOutcome: i.streszczenie,
        initiativeOwnerId: idOsoby(i.wlascicielWykonania ?? i.wlascicielBiznesowy),
      }
    );
    if (status < 200 || status >= 300)
      wynik.agregatyBledy.push(`${i.slug} (metadane): HTTP ${status} ${JSON.stringify(body).slice(0, 220)}`);
  }

  // --- 3. Plan (CREATE -> PUBLISH), OSIEM okien ------------------------------
  // Kolejność jest wymuszona bramkami, nie wygodą: plan przyjmuje wyłącznie okna
  // inicjatyw z agregatem w `APPROVED_BACKLOG` (`planScenario.ts:205-222`), a
  // `scheduleDecision.ts:144` szuka okna DOKŁADNIE dla bieżącej wersji agregatu.
  // Dlatego plan powstaje PO uzupełnieniu metadanych (krok 2b bije wersję),
  // a przed jakimkolwiek przesunięciem cyklu życia.
  wynik.plan = await zbudujPlanScenariusz(api, c);

  // --- 4. Analiza obciążenia (serwer LICZY arkusz z planu i podaży) ---------
  wynik.obciazenie = await zbudujObciazenie(api);

  // --- 5. ŁAŃCUCH PRZEKAZANIA -> `execution_case` (D4b, DECYZJA 2) ----------
  const lancuch = await zbudujLancuchPrzekazania(api, autorytet, menedzer, c);
  wynik.przekazania = lancuch.ok;
  wynik.przekazaniaBledy = lancuch.bledy;

  // --- 6. DOPIERO TERAZ przejście WIERSZA do realizacji ---------------------
  // Agregat już stoi w `IN_EXECUTION` (krok 5). Wiersz klasyczny domykamy na
  // końcu, bo `register` z kroku 2 nie przyjąłby statusu `IN_EXECUTION`
  // (`registerModuleInitiativeForPlanning.ts:38`).
  for (const i of INICJATYWY.filter((x) => x.status === 'IN_EXECUTION')) {
    const id = idInicjatywy(i.slug);
    const teraz = await c.query<{ status: string }>('SELECT status FROM initiatives WHERE id = $1', [id]);
    if (teraz.rows[0]?.status === 'IN_EXECUTION') {
      wynik.przejscia += 1;
      continue;
    }
    const { status, body } = await api.zadanie('PATCH', `/api/initiatives/${id}/status`, {
      status: 'IN_EXECUTION',
      overrideReason: 'Handover accepted by the delivery owner; start date confirmed.',
    });
    if (status >= 200 && status < 300) {
      wynik.przejscia += 1;
      await c.query(
        `UPDATE initiatives SET execution_started_at = COALESCE(execution_started_at, $2::timestamptz),
                                on_hold = $3, blocked_reason = $4
          WHERE id = $1`,
        [id, `${i.planStart}T09:00:00.000Z`, i.onHold === true, i.blockedReason ?? null]
      );
    } else {
      wynik.przejsciaBledy.push(`${i.slug}: HTTP ${status} ${JSON.stringify(body).slice(0, 220)}`);
    }
  }

  return wynik;
}

/**
 * Okresy kwartalne 2026Q1-2027Q4. Horyzont MUSI objąć wszystkie daty okien —
 * `validatePlanScenario` (`planScenario.ts:122-125`) odrzuca okno wychodzące
 * poza pierwszy/ostatni okres komunikatem „Planned window falls outside Plan periods".
 */
const OKRESY = [
  { periodId: '2026-Q1', start: '2026-01-01T00:00:00.000Z', end: '2026-03-31T23:59:59.000Z' },
  { periodId: '2026-Q2', start: '2026-04-01T00:00:00.000Z', end: '2026-06-30T23:59:59.000Z' },
  { periodId: '2026-Q3', start: '2026-07-01T00:00:00.000Z', end: '2026-09-30T23:59:59.000Z' },
  { periodId: '2026-Q4', start: '2026-10-01T00:00:00.000Z', end: '2026-12-31T23:59:59.000Z' },
  { periodId: '2027-Q1', start: '2027-01-01T00:00:00.000Z', end: '2027-03-31T23:59:59.000Z' },
  { periodId: '2027-Q2', start: '2027-04-01T00:00:00.000Z', end: '2027-06-30T23:59:59.000Z' },
  { periodId: '2027-Q3', start: '2027-07-01T00:00:00.000Z', end: '2027-09-30T23:59:59.000Z' },
  { periodId: '2027-Q4', start: '2027-10-01T00:00:00.000Z', end: '2027-12-31T23:59:59.000Z' },
];

async function zbudujPlanScenariusz(api: Api, c: PoolClient): Promise<string> {
  const okna: unknown[] = [];
  for (const slug of SLUGI_PLANU) {
    const i = INICJATYWY.find((x) => x.slug === slug)!;
    const id = idInicjatywy(slug);
    const wersja = await c.query<{ version: number }>(
      `SELECT version FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [ORG_ID, id]
    );
    if (wersja.rows.length === 0) return `BŁĄD: brak agregatu dla ${slug} — plan bez niego się nie zapisze`;
    okna.push({
      initiativeId: id,
      initiativeVersion: Number(wersja.rows[0]!.version),
      earliest: i.planStart ? `${i.planStart}T00:00:00.000Z` : null,
      target: i.planStart ? `${i.planStart}T00:00:00.000Z` : null,
      latest: i.planKoniec ? `${i.planKoniec}T00:00:00.000Z` : null,
      confidence: i.status === 'IN_EXECUTION' ? 'HIGH' : 'MEDIUM',
      rationale: `Sequenced against the Northwind 2027 baseline: ${i.streszczenie}`,
      dependencySnapshot: [],
      constraintSnapshot: [
        {
          constraintId: `${slug}--capacity`,
          state: 'KNOWN',
          detail: `Requires ${i.wymaganeFte} FTE across the delivery window.`,
        },
      ],
      roleDemand: [
        {
          roleId: 'automation-engineer',
          roleLabel: 'Automation Engineer',
          fte: Number((i.wymaganeFte * 0.6).toFixed(2)),
        },
        {
          roleId: 'production-planner',
          roleLabel: 'Production Planner',
          fte: Number((i.wymaganeFte * 0.4).toFixed(2)),
        },
      ],
    });
  }

  const scenariusz = (wersja: number, status: 'DRAFT' | 'PUBLISHED') => ({
    scenarioId: PLAN_SCENARIO_ID,
    name: 'Northwind 2027 — Wave 1 delivery plan',
    scenarioVersion: wersja,
    status,
    portfolioScenarioId: '',
    portfolioScenarioVersion: 0,
    windowUnit: 'QUARTER',
    timezone: 'Europe/London',
    periods: OKRESY,
    windows: okna,
    assumptions: [
      'Summer shutdown in July 2027 is the only planned production break.',
      'Capital release follows the approved 2027 budget envelope.',
      'No additional engineering headcount before Q3 2027.',
    ],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  });

  const istnieje = await api.zadanie<{ scenario?: { scenarioVersion?: number; status?: string } }>(
    'GET',
    `/api/initiatives/runtime-v1/plan-scenarios/${PLAN_SCENARIO_ID}`
  );
  let wersjaAgregatu = 0;
  if (istnieje.status === 200) {
    const stan = await c.query<{ version: number; payload_json: { status?: string } }>(
      `SELECT version, payload_json FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'plan_scenario' AND aggregate_id = $2`,
      [ORG_ID, PLAN_SCENARIO_ID]
    );
    if (stan.rows[0]?.payload_json?.status === 'PUBLISHED') return 'bez zmian (plan już opublikowany)';
    wersjaAgregatu = Number(stan.rows[0]?.version ?? 0);
  } else {
    const utworz = await api.zadanie(
      'POST',
      `/api/initiatives/runtime-v1/plan-scenarios/${PLAN_SCENARIO_ID}`,
      {
        expectedVersion: 0,
        clientRequestId: det('plan-create', PLAN_SCENARIO_ID),
        operation: 'CREATE',
        portfolio: 'auto',
        scenario: scenariusz(0, 'DRAFT'),
      }
    );
    if (utworz.status !== 200 && utworz.status !== 201)
      return `BŁĄD CREATE: HTTP ${utworz.status} ${JSON.stringify(utworz.body).slice(0, 300)}`;
    wersjaAgregatu = Number((utworz.body as { aggregateVersion?: number }).aggregateVersion ?? 1);
  }

  const stanPoUtworzeniu = await c.query<{ payload_json: { scenarioVersion?: number } }>(
    `SELECT payload_json FROM ie_aggregate_state
      WHERE organization_id = $1 AND aggregate_type = 'plan_scenario' AND aggregate_id = $2`,
    [ORG_ID, PLAN_SCENARIO_ID]
  );
  const wersjaScenariusza = Number(stanPoUtworzeniu.rows[0]?.payload_json?.scenarioVersion ?? 1);

  const publikuj = await api.zadanie(
    'POST',
    `/api/initiatives/runtime-v1/plan-scenarios/${PLAN_SCENARIO_ID}`,
    {
      expectedVersion: wersjaAgregatu,
      clientRequestId: det('plan-publish', PLAN_SCENARIO_ID),
      operation: 'PUBLISH',
      portfolio: 'auto',
      scenario: scenariusz(wersjaScenariusza, 'PUBLISHED'),
    }
  );
  if (publikuj.status !== 200 && publikuj.status !== 201)
    return `BŁĄD PUBLISH: HTTP ${publikuj.status} ${JSON.stringify(publikuj.body).slice(0, 300)}`;
  return `opublikowany (${okna.length} inicjatywy w oknach)`;
}

async function zbudujObciazenie(api: Api): Promise<string> {
  const { status, body } = await api.zadanie(
    'POST',
    `/api/initiatives/runtime-v1/capacity-scenarios/${CAPACITY_SCENARIO_ID}/compute`,
    {
      expectedVersion: 0,
      clientRequestId: det('capacity-compute', CAPACITY_SCENARIO_ID),
      operation: 'CREATE',
      planScenarioId: PLAN_SCENARIO_ID,
      name: 'Northwind 2027 — Wave 1 capacity analysis',
    }
  );
  if (status !== 200 && status !== 201 && status !== 409)
    return `BŁĄD compute: HTTP ${status} ${JSON.stringify(body).slice(0, 300)}`;

  // D4b (DECYZJA 2): `compute` zostawia analizę w `DRAFT`, a bramka harmonogramu
  // (`scheduleDecision.ts:131-139`) żąda analizy OPUBLIKOWANEJ i zgodnej wersją
  // z opublikowanym planem. Bez tego kroku łańcuch przekazania nie ruszy —
  // i tak samo nie ruszy go człowiek klikający „Nowa analiza" bez publikacji.
  const stan = await api.zadanie<{ version: number; scenario: Record<string, unknown> }>(
    'GET',
    `/api/initiatives/runtime-v1/capacity-scenarios/${CAPACITY_SCENARIO_ID}`
  );
  if (stan.status !== 200) return `BŁĄD odczytu analizy: HTTP ${stan.status}`;
  const scenariusz = stan.body.scenario as Record<string, unknown> & { status?: string };
  if (scenariusz.status === 'PUBLISHED') return 'opublikowana (bez zmian)';

  const publikuj = await api.zadanie(
    'POST',
    `/api/initiatives/runtime-v1/capacity-scenarios/${CAPACITY_SCENARIO_ID}`,
    {
      expectedVersion: Number(stan.body.version),
      clientRequestId: det('capacity-publish', CAPACITY_SCENARIO_ID),
      operation: 'PUBLISH',
      scenario: { ...scenariusz, scenarioId: CAPACITY_SCENARIO_ID, status: 'PUBLISHED' },
    }
  );
  if (publikuj.status !== 200 && publikuj.status !== 201)
    return `BŁĄD PUBLISH analizy: HTTP ${publikuj.status} ${JSON.stringify(publikuj.body).slice(0, 300)}`;
  return 'policzona z planu i podaży organizacji, OPUBLIKOWANA';
}

/**
 * ŁAŃCUCH PRZEKAZANIA (D4b, DECYZJA 2) — cztery `execution_case` przez
 * KANONICZNYCH PISARZY, po HTTP, tą samą drogą, którą klika przeglądarka.
 *
 * Jedynym twórcą agregatu `execution_case` jest akceptacja przekazania
 * (`handoffAcceptance.ts:224-259`). Nie ma trasy `POST /execution-cases` —
 * `/execution-cases` w `initiativesExecutionRuntime.routes.ts` jest wyłącznie
 * do odczytu. Żeby dojść do akceptacji, trzeba przejść CAŁY łańcuch, a każdy
 * jego krok ma własną bramkę (zmierzone 08.09 na `consultify_kopia_d44`):
 *
 *   1. agregat w `APPROVED_BACKLOG`            — `scheduleDecision.ts:208`
 *   2. OPUBLIKOWANE portfel + plan + analiza   — `scheduleDecision.ts:114-139`
 *   3. okno planu DOKŁADNIE dla tej inicjatywy I DOKŁADNIE dla jej bieżącej
 *      wersji agregatu                          — `scheduleDecision.ts:144-146`
 *   4. `schedule.request` NIE MOŻE mieć autorytetu równego wnioskodawcy
 *      (bez `selfApproval` w polityce)           — `scheduleDecision.ts:191-197`
 *   5. `schedule.decide` wykonuje AUTORYTET      — `scheduleDecision.ts:302-310`
 *   6. `handoff.request` wymaga stanu `SCHEDULED` i DOKŁADNIE tej zamrożonej
 *      paczki                                    — `handoffAcceptance.ts:88-104`
 *   7. `handoff.decide` wykonuje EXECUTION MANAGER — `handoffAcceptance.ts:201-207`
 *
 * Stąd TRZY sesje: właściciel (wnioskodawca), autorytet harmonogramu i menedżer
 * realizacji. Jedna sesja nie przejdzie — reguła rozdzielenia ról jest w kodzie,
 * nie w konfiguracji.
 *
 * WERSJONOWANIE: każda komenda bije wersję agregatu o 1, a `decideSchedule`
 * sprawdza `stored.initiativeVersion === expectedVersion - 1`. Dlatego wersję
 * czytamy z bazy PRZED każdym krokiem, zamiast ją zakładać.
 */
async function zbudujLancuchPrzekazania(
  wnioskodawca: Api,
  autorytet: Api,
  menedzer: Api,
  c: PoolClient
): Promise<{ ok: number; bledy: string[] }> {
  const idAutorytetu = idOsoby('sarah.mitchell');
  const idMenedzera = idOsoby('robert.chen');
  const bledy: string[] = [];
  let ok = 0;

  const wersjaAgregatu = async (id: string): Promise<number | null> => {
    const r = await c.query<{ version: number }>(
      `SELECT version FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [ORG_ID, id]
    );
    return r.rows[0] ? Number(r.rows[0].version) : null;
  };
  const stanCyklu = async (id: string): Promise<string | null> => {
    const r = await c.query<{ stan: string | null; sprawa: string | null }>(
      `SELECT payload_json->>'lifecycleState' AS stan, payload_json->>'executionCaseId' AS sprawa
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [ORG_ID, id]
    );
    return r.rows[0]?.stan ?? null;
  };

  for (const slug of SLUGI_PRZEKAZANIA) {
    const i = INICJATYWY.find((x) => x.slug === slug)!;
    const id = idInicjatywy(slug);
    const idSprawy = det('execution-case', slug);
    const terminDecyzji = `${i.planStart}T12:00:00.000Z`;

    try {
      // Idempotencja: sprawa realizacji już jest — nie powtarzamy łańcucha.
      const jest = await c.query(
        `SELECT 1 FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'execution_case' AND aggregate_id = $2`,
        [ORG_ID, idSprawy]
      );
      if (jest.rows.length > 0) {
        ok += 1;
        continue;
      }

      const stanPoczatkowy = await stanCyklu(id);
      if (stanPoczatkowy !== 'APPROVED_BACKLOG' && stanPoczatkowy !== 'SCHEDULED') {
        bledy.push(`${slug}: agregat w stanie ${stanPoczatkowy ?? 'BRAK'} — łańcuch wymaga APPROVED_BACKLOG`);
        continue;
      }

      const idDecyzjiHarmonogramu = det('schedule-decision', slug);
      const idDecyzjiPrzekazania = det('handoff-decision', slug);

      // --- 5a. Wniosek o decyzję harmonogramu (wnioskodawca) ----------------
      if (stanPoczatkowy === 'APPROVED_BACKLOG') {
        const wersja = await wersjaAgregatu(id);
        if (wersja === null) {
          bledy.push(`${slug}: brak agregatu — najpierw register`);
          continue;
        }
        const wniosek = await wnioskodawca.zadanie(
          'POST',
          `/api/initiatives/runtime-v1/initiatives/${id}/gates/schedule/requests`,
          {
            expectedVersion: wersja,
            clientRequestId: det('schedule-request', slug),
            decisionId: idDecyzjiHarmonogramu,
            authorityId: idAutorytetu,
            executionManagerId: idMenedzera,
            dueAt: terminDecyzji,
            portfolioScenarioId: portfelRoboczyId(),
            portfolioScenarioVersion: await wersjaScenariusza(c, 'portfolio_scenario', portfelRoboczyId()),
            planScenarioId: PLAN_SCENARIO_ID,
            planScenarioVersion: await wersjaScenariusza(c, 'plan_scenario', PLAN_SCENARIO_ID),
            capacityScenarioId: CAPACITY_SCENARIO_ID,
            capacityScenarioVersion: await wersjaScenariusza(c, 'capacity_scenario', CAPACITY_SCENARIO_ID),
            commitmentIds: [],
            criticalPeriodIds: [],
            criticalDependencies: [],
            handoff: migawkaPrzekazania(i, wersja),
          }
        );
        if (wniosek.status < 200 || wniosek.status >= 300) {
          bledy.push(`${slug} (schedule.request): HTTP ${wniosek.status} ${JSON.stringify(wniosek.body).slice(0, 260)}`);
          continue;
        }

        // --- 5b. Decyzja harmonogramu (AUTORYTET, nie wnioskodawca) ---------
        const wersjaPoWniosku = await wersjaAgregatu(id);
        const decyzja = await autorytet.zadanie(
          'POST',
          `/api/initiatives/runtime-v1/initiatives/${id}/gates/schedule/decisions`,
          {
            expectedVersion: wersjaPoWniosku,
            clientRequestId: det('schedule-decide', slug),
            decisionId: idDecyzjiHarmonogramu,
            outcome: 'APPROVED',
            rationale: `Scheduled against the published Northwind 2027 Wave 1 plan: ${i.streszczenie}`,
            conditions: [],
          }
        );
        if (decyzja.status < 200 || decyzja.status >= 300) {
          bledy.push(`${slug} (schedule.decide): HTTP ${decyzja.status} ${JSON.stringify(decyzja.body).slice(0, 260)}`);
          continue;
        }
      }

      // --- 5c. Wniosek o akceptację przekazania (wnioskodawca) --------------
      const paczka = await c.query<{ pack: string | null }>(
        `SELECT payload_json->>'handoffPackageId' AS pack FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
        [ORG_ID, id]
      );
      const idPaczki = paczka.rows[0]?.pack;
      if (!idPaczki) {
        bledy.push(`${slug}: decyzja harmonogramu nie zostawiła zamrożonej paczki przekazania`);
        continue;
      }
      const wersjaPoDecyzji = await wersjaAgregatu(id);
      const wniosekP = await wnioskodawca.zadanie(
        'POST',
        `/api/initiatives/runtime-v1/initiatives/${id}/handoff/requests`,
        {
          expectedVersion: wersjaPoDecyzji,
          clientRequestId: det('handoff-request', slug),
          decisionId: idDecyzjiPrzekazania,
          handoffPackageId: idPaczki,
          handoffPackageVersion: 1,
          executionCaseId: idSprawy,
          authorityId: idMenedzera,
          dueAt: terminDecyzji,
          rolloutChildren: { pilot: [], waves: [] },
        }
      );
      if (wniosekP.status < 200 || wniosekP.status >= 300) {
        bledy.push(`${slug} (handoff.request): HTTP ${wniosekP.status} ${JSON.stringify(wniosekP.body).slice(0, 260)}`);
        continue;
      }

      // --- 5d. Akceptacja przekazania (EXECUTION MANAGER) -> execution_case -
      const wersjaPoWniosku2 = await wersjaAgregatu(id);
      const decyzjaP = await menedzer.zadanie(
        'POST',
        `/api/initiatives/runtime-v1/initiatives/${id}/handoff/decisions`,
        {
          expectedVersion: wersjaPoWniosku2,
          clientRequestId: det('handoff-decide', slug),
          decisionId: idDecyzjiPrzekazania,
          outcome: 'ACCEPT',
          gaps: [],
          blockers: [],
          rationale: `Delivery accepted the frozen handoff package for "${i.tytul}".`,
        }
      );
      if (decyzjaP.status < 200 || decyzjaP.status >= 300) {
        bledy.push(`${slug} (handoff.decide): HTTP ${decyzjaP.status} ${JSON.stringify(decyzjaP.body).slice(0, 260)}`);
        continue;
      }
      ok += 1;
    } catch (e) {
      bledy.push(`${slug}: ${(e as Error).message}`);
    }
  }

  return { ok, bledy };
}

/** Portfel roboczy zakładany automatycznie przy zapisie planu (`portfolio: 'auto'`). */
const portfelRoboczyId = () => `portfolio-${ORG_ID}-roboczy`;

/** Wersja scenariusza CZYTANA Z BAZY — bramki porównują ją co do liczby. */
async function wersjaScenariusza(
  c: PoolClient,
  typ: 'portfolio_scenario' | 'plan_scenario' | 'capacity_scenario',
  id: string
): Promise<number> {
  const r = await c.query<{ v: string | null }>(
    `SELECT payload_json->>'scenarioVersion' AS v FROM ie_aggregate_state
      WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3`,
    [ORG_ID, typ, id]
  );
  return Number(r.rows[0]?.v ?? 0);
}

/**
 * Migawka przekazania — to, co zamraża decyzja harmonogramu i co przyjmuje
 * menedżer realizacji. Treść po ANGIELSKU (dane pokazowe).
 */
function migawkaPrzekazania(i: Inicjatywa, wersjaAgregatu: number) {
  return {
    scope: { inScope: i.zakresW, outOfScope: i.zakresPoza },
    selectedOptions: { approach: i.streszczenie },
    success: { criteria: i.kryteriaSukcesu, expectedRoi: i.oczekiwanyZwrot },
    baseline: { start: i.planStart, end: i.planKoniec, requiredFte: i.wymaganeFte },
    openWork: i.produkty.map((produkt, n) => ({ itemId: `${i.slug}--deliverable-${n + 1}`, title: produkt })),
    raid: i.ryzyka.map((ryzyko, n) => ({ itemId: `${i.slug}--risk-${n + 1}`, title: ryzyko })),
    outcomeRefs: [`northwind-2027-portfolio-baseline-v1`],
    sourceVersions: { initiative: wersjaAgregatu },
  };
}

// ============================================================================
// VERIFY — asercje TWARDE („== N", nie „>= N"). STOP 2 jest tu zapytaniem.
// ============================================================================
type Asercja = { nazwa: string; oczekiwane: number; rzeczywiste: number };

async function weryfikuj(c: PoolClient): Promise<void> {
  const licz = async (sql: string, params: unknown[] = []): Promise<number> =>
    Number((await c.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);

  const wInEx = INICJATYWY.filter((i) => i.status === 'IN_EXECUTION').length;
  const wszystkie = await licz('SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1', [ORG_ID]);

  if (wszystkie === 0) {
    // Stan po `--reset`: wszystko musi być zerem.
    wypiszIZakoncz([
      { nazwa: 'inicjatywy', oczekiwane: 0, rzeczywiste: 0 },
      {
        nazwa: 'interesariusze RACI',
        oczekiwane: 0,
        rzeczywiste: await licz(
          `SELECT COUNT(*)::text AS n FROM initiative_stakeholders s
             JOIN initiatives i ON i.id = s.initiative_id WHERE i.organization_id = $1`,
          [ORG_ID]
        ),
      },
      {
        nazwa: 'agregaty runtime-v1 (initiative)',
        oczekiwane: 0,
        rzeczywiste: await licz(
          `SELECT COUNT(*)::text AS n FROM ie_aggregate_state WHERE organization_id = $1 AND aggregate_type = 'initiative'`,
          [ORG_ID]
        ),
      },
      {
        nazwa: 'decyzje bramkowe GO',
        oczekiwane: 0,
        rzeczywiste: await licz(
          'SELECT COUNT(*)::text AS n FROM initiative_lifecycle_gate_decisions WHERE organization_id = $1',
          [ORG_ID]
        ),
      },
      {
        nazwa: 'sprawy realizacji (execution_case)',
        oczekiwane: 0,
        rzeczywiste: await licz(
          `SELECT COUNT(*)::text AS n FROM ie_aggregate_state WHERE organization_id = $1 AND aggregate_type = 'execution_case'`,
          [ORG_ID]
        ),
      },
    ]);
    return;
  }

  const zestaw: Asercja[] = [
    { nazwa: 'inicjatywy', oczekiwane: INICJATYWY.length, rzeczywiste: wszystkie },
    {
      nazwa: 'różnych statusów DEC-424',
      oczekiwane: 7,
      rzeczywiste: await licz(
        'SELECT COUNT(DISTINCT status)::text AS n FROM initiatives WHERE organization_id = $1',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'statusy spoza słownika DEC-424',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND status <> ALL($2::text[])`,
        [ORG_ID, STATUSY_KANONICZNE as unknown as string[]]
      ),
    },
    {
      nazwa: 'inicjatywy IN_EXECUTION',
      oczekiwane: wInEx,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1 AND status = 'IN_EXECUTION'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'STOP 2: IN_EXECUTION BEZ project_id (fail-closed realizacji)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND status = 'IN_EXECUTION'
            AND (project_id IS NULL OR btrim(project_id) = '')`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'IN_EXECUTION bez właściciela wykonania',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND status = 'IN_EXECUTION' AND owner_execution_id IS NULL`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'IN_EXECUTION bez dat planu',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND status = 'IN_EXECUTION'
            AND (planned_start_date IS NULL OR planned_end_date IS NULL)`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy z flagą on_hold = TRUE',
      oczekiwane: INICJATYWY.filter((i) => i.onHold).length,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1 AND on_hold = TRUE',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy bez opisu albo z opisem krótszym niż 200 znaków',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND (description IS NULL OR length(btrim(description)) < 200)`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy bez kategorii, priorytetu, autora albo zakresu',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1
            AND (category IS NULL OR btrim(category) = ''
              OR priority IS NULL OR btrim(priority) = ''
              OR created_by IS NULL
              OR scope_in IS NULL OR scope_in IN ('', '[]'))`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy, gdzie name <> title (obie kolumny tą samą treścią)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1 AND name IS DISTINCT FROM title',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'interesariusze RACI',
      oczekiwane: INICJATYWY.reduce((n, i) => n + i.interesariusze.length, 0),
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiative_stakeholders s
           JOIN initiatives i ON i.id = s.initiative_id WHERE i.organization_id = $1`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy bez jednego „A" (accountable) w RACI',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives i
          WHERE i.organization_id = $1
            AND (SELECT COUNT(*) FROM initiative_stakeholders s
                  WHERE s.initiative_id = i.id AND s.raci_type = 'A') <> 1`,
        [ORG_ID]
      ),
    },
    {
      // Ślad z etapu SQL + po jednym wierszu, który dopisuje kanoniczny pisarz
      // przy przejściu APPROVED -> IN_EXECUTION w etapie API.
      nazwa: 'wpisy historii statusu (SQL + kanoniczne przejścia do realizacji)',
      oczekiwane: INICJATYWY.reduce((n, i) => n + sladStatusu(i).length, 0) + wInEx,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM initiative_status_history WHERE organization_id = $1',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'przekazania do realizacji (readiness_allowed = TRUE)',
      oczekiwane: zPrzekazaniem.length,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM initiative_handoffs WHERE organization_id = $1 AND readiness_allowed = TRUE',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'decyzje bramkowe GO (approved, GOVERNANCE_DECISION_MAKING)',
      oczekiwane: zDecyzjaGo.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiative_lifecycle_gate_decisions
          WHERE organization_id = $1 AND pmo_domain = 'GOVERNANCE_DECISION_MAKING' AND decision_status = 'approved'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'agregaty runtime-v1 „initiative" (STOP 1: przez register, nie SQL-em)',
      oczekiwane: doRejestracji().length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'initiative'`,
        [ORG_ID]
      ),
    },
    {
      // BEZPIECZNIK POMIARU, ZWĘŻONY w D4b (DECYZJA 2). Groźny jest agregat, który
      // UTKNĄŁ w `APPROVED_BACKLOG`/`SCHEDULED` na inicjatywie realizowanej — bo
      // rejestr wygrywa z wierszem klasycznym (DEC-397) i lista pokazuje wtedy
      // „In execution 0". Agregat w `IN_EXECUTION` jest STANEM POPRAWNYM:
      // `statusMapping.ts:22` mapuje go z powrotem na status `IN_EXECUTION`.
      // Poprzednia wersja („jakikolwiek agregat na IN_EXECUTION = 0") zakazywała
      // też stanu poprawnego i blokowała łańcuch przekazania.
      nazwa: 'agregaty w APPROVED_BACKLOG/SCHEDULED na inicjatywie IN_EXECUTION (przykryłyby status)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state a
           JOIN initiatives i ON i.id = a.aggregate_id AND i.organization_id = a.organization_id
          WHERE a.organization_id = $1 AND a.aggregate_type = 'initiative' AND i.status = 'IN_EXECUTION'
            AND a.payload_json->>'lifecycleState' IN ('APPROVED_BACKLOG', 'SCHEDULED')`,
        [ORG_ID]
      ),
    },
    {
      // Dopuszczalne stany agregatu inicjatywy po pełnym przebiegu: `APPROVED_BACKLOG`
      // (cztery zatwierdzone, czekają w planie) i `IN_EXECUTION` (cztery po przejściu
      // łańcucha przekazania). Każdy inny — w tym `SCHEDULED`, czyli łańcuch
      // PRZERWANY w połowie — jest defektem.
      nazwa: 'agregaty „initiative" w stanie innym niż APPROVED_BACKLOG albo IN_EXECUTION',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'initiative'
            AND COALESCE(payload_json->>'lifecycleState', '') NOT IN ('APPROVED_BACKLOG', 'IN_EXECUTION')`,
        [ORG_ID]
      ),
    },
    {
      // CEL PACZKI D4b: cztery sprawy realizacji założone WYŁĄCZNIE przez
      // akceptację przekazania (`handoffAcceptance.ts` — jedyny pisarz agregatu
      // `execution_case`; trasy `POST /execution-cases` nie ma).
      nazwa: 'sprawy realizacji `execution_case` (przez akceptację przekazania, nie SQL-em)',
      oczekiwane: SLUGI_PRZEKAZANIA.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'execution_case'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'sprawy realizacji w stanie innym niż ACTIVE',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'execution_case'
            AND COALESCE(payload_json->>'state', '') <> 'ACTIVE'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zamrożone paczki przekazania (`handoff_package`)',
      oczekiwane: SLUGI_PRZEKAZANIA.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'handoff_package'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'analizy obciążenia OPUBLIKOWANE (bramka harmonogramu)',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'capacity_scenario'
            AND payload_json->>'status' = 'PUBLISHED'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'plany OPUBLIKOWANE (zakładka „Plan")',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'plan_scenario'
            AND payload_json->>'status' = 'PUBLISHED'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy w oknach opublikowanego planu',
      oczekiwane: SLUGI_PLANU.length,
      rzeczywiste: await licz(
        `SELECT COALESCE(jsonb_array_length(payload_json->'windows'),0)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'plan_scenario'
            AND payload_json->>'status' = 'PUBLISHED' LIMIT 1`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'analizy obciążenia (zakładka „Obciążenie")',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND aggregate_type = 'capacity_scenario'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'inicjatywy z alokacją FTE ponad zapotrzebowanie',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND allocated_capacity_fte > required_capacity_fte + 0.001`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'osoby prowadzące więcej niż jedną inicjatywę IN_EXECUTION',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM (
           SELECT owner_execution_id FROM initiatives
            WHERE organization_id = $1 AND status = 'IN_EXECUTION' AND owner_execution_id IS NOT NULL
            GROUP BY owner_execution_id HAVING COUNT(*) > 1) q`,
        [ORG_ID]
      ),
    },
    {
      // Znak `&` w polu, ktore idzie na zapis PRZEZ HTTP, wraca z bazy jako
      // `&amp;` i tak sie renderuje na liscie (globalny `inputSanitizationMiddleware`,
      // `security.utils.ts:60`). Dopoki STOP produktowy nie jest naprawiony,
      // dane pokazowe MUSZA omijac `&` — ta asercja tego pilnuje.
      nazwa: 'znak & w tytule/problemie/streszczeniu inicjatyw (sanitizer zamienia go na &amp;)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1 AND (name LIKE '%&%' OR COALESCE(title,'') LIKE '%&%'
                OR COALESCE(problem_statement,'') LIKE '%&%' OR COALESCE(summary,'') LIKE '%&%')`,
        [ORG_ID]
      ),
    },
    {
      // Bezpiecznik na wynik: gdyby sanitizer trafil cokolwiek w agregacie
      // runtime-v1, na ekranie zobaczymy `&amp;`. Mierzymy SKUTEK, nie zamiar.
      nazwa: 'encje HTML (&amp;) w agregatach runtime-v1 — to, co widac na liscie',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id = $1 AND payload_json::text LIKE '%&amp;%'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'pola tekstowe inicjatyw z polskimi znakami (dane muszą być po angielsku)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiatives
          WHERE organization_id = $1
            AND (COALESCE(name,'') || COALESCE(description,'') || COALESCE(summary,'') ||
                 COALESCE(category,'') || COALESCE(scope_in,'') || COALESCE(blocked_reason,''))
                ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'`,
        [ORG_ID]
      ),
    },
  ];

  console.log(`[verify-d3] organizacja: ${ORG_NAZWA} (${ORG_ID})`);
  const rozklad = await c.query<{ status: string; n: string }>(
    'SELECT status, COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1 GROUP BY status ORDER BY status',
    [ORG_ID]
  );
  console.log(`[verify-d3] rozkład w bazie: ${rozklad.rows.map((r) => `${r.status}=${r.n}`).join(' ')}`);
  wypiszIZakoncz(zestaw);
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    const ok = a.oczekiwane === a.rzeczywiste;
    if (!ok) bledy++;
    console.log(
      `[verify-d3] ${ok ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(64)} oczekiwane=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`
    );
  }
  if (bledy > 0) {
    console.error(`\n[verify-d3] FAIL: ${bledy} z ${asercje.length} asercji nie przeszło.`);
    process.exitCode = 1;
  } else {
    console.log(`\n[verify-d3] PASS: wszystkie ${asercje.length} asercji przeszły.`);
  }
}

// ============================================================================
// RESET — kasuje WYŁĄCZNIE dane inicjatyw organizacji `northwind`
// ============================================================================
async function reset(c: PoolClient): Promise<void> {
  await c.query('BEGIN');
  try {
    // `initiative_lifecycle_gate_decisions` ma trigger blokujący DELETE (niezmienność
    // rejestru decyzji). Na LOKALNEJ KOPII (guard hosta wyżej) reset musi go zdjąć
    // na czas kasowania — inaczej FK z `initiatives` nie pozwoli usunąć inicjatyw.
    await c.query('ALTER TABLE initiative_lifecycle_gate_decisions DISABLE TRIGGER initiative_lifecycle_gate_decisions_immutable');
    const decyzje = await c.query('DELETE FROM initiative_lifecycle_gate_decisions WHERE organization_id = $1', [ORG_ID]);
    await c.query('ALTER TABLE initiative_lifecycle_gate_decisions ENABLE TRIGGER initiative_lifecycle_gate_decisions_immutable');

    await c.query('DELETE FROM initiative_handoffs WHERE organization_id = $1', [ORG_ID]);
    // `project_members` zakłada WYŁĄCZNIE ta paczka (D1 tworzy projekty bez członków),
    // więc reset D3 musi je zabrać — inaczej drugi `--apply` po resecie melduje
    // „pominieto=10" i idempotencja nie jest mierzona od zera.
    await c.query(
      'DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE organization_id = $1)',
      [ORG_ID]
    );
    await c.query('DELETE FROM transformation_case_artifact_links WHERE organization_id = $1', [ORG_ID]);
    const inicjatywy = await c.query('DELETE FROM initiatives WHERE organization_id = $1', [ORG_ID]);

    for (const tabela of [
      'ie_outbox_delivery_receipts',
      'ie_outbox_events',
      'ie_audit_events',
      'ie_command_receipts',
      'ie_aggregate_relations',
      'ie_aggregate_state',
    ]) {
      await c.query(`DELETE FROM ${tabela} WHERE organization_id = $1`, [ORG_ID]);
    }
    await c.query('DELETE FROM v8_agent_proposal_scope_reviews WHERE proposal_version_id = $1', [A05.proposalVersionId]);
    await c.query('DELETE FROM v8_agent_proposal_versions WHERE organization_id = $1', [ORG_ID]);
    await c.query('DELETE FROM v8_agent_run_identities WHERE organization_id = $1', [ORG_ID]);
    await c.query('DELETE FROM transformation_cases WHERE organization_id = $1', [ORG_ID]);
    await c.query('DELETE FROM v8_execution_runs WHERE organization_id = $1', [ORG_ID]);

    await c.query('COMMIT');
    console.log(
      `[inicjatywy] reset: usunięto ${inicjatywy.rowCount ?? 0} inicjatyw (kaskadą interesariuszy i historii), ` +
        `${decyzje.rowCount ?? 0} decyzji bramkowych, agregaty runtime-v1 i łańcuch A05 organizacji „${ORG_ID}".`
    );
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    await c
      .query('ALTER TABLE initiative_lifecycle_gate_decisions ENABLE TRIGGER initiative_lifecycle_gate_decisions_immutable')
      .catch(() => undefined);
    throw e;
  }
}

// ============================================================================
// main
// ============================================================================
async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  const d3 = opcje.tryb === 'apply' ? czytajOpcjeD3(process.argv.slice(2), opcje.hasloPlik) : { apiUrl: null, email: '', haslo: null };

  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[inicjatywy] cel:          ${toz}`);
    console.log(`[inicjatywy] organizacja:  ${ORG_NAZWA} (id ${ORG_ID})`);
    console.log(`[inicjatywy] tryb:         ${opcje.tryb}${d3.apiUrl ? ` (+ etap API ${d3.apiUrl})` : ' (bez etapu API)'}`);

    if (opcje.tryb === 'reset') {
      await reset(c);
      return;
    }
    if (opcje.tryb === 'verify') {
      await weryfikuj(c);
      return;
    }

    const org = await c.query('SELECT 1 FROM organizations WHERE id = $1', [ORG_ID]);
    if (org.rows.length === 0)
      throw new Error('Organizacja „northwind" nie istnieje. Najpierw uruchom 01-rdzen.ts --apply (paczka D1).');

    const plan = await zbudujPlan(c);
    console.log('\n--- PLAN ---');
    console.log(`łańcuch A05 (case + propozycja + recenzja): ${plan.lancuchA05}`);
    for (const i of plan.inicjatywy)
      console.log(`inicjatywa   ${i.slug.padEnd(34)} ${i.akcja.padEnd(13)} (status w bazie/etapie: ${i.status})`);
    console.log(`interesariusze RACI: ${plan.interesariusze.istniejace} -> ${plan.interesariusze.oczekiwane}`);
    console.log(`historia statusów:   ${plan.historia.istniejace} w bazie · ${plan.historia.oczekiwane} pisze etap SQL (resztę dopisuje kanoniczne przejście)`);
    console.log(`przekazania (readiness_allowed=TRUE): ${plan.przekazania.istniejace} -> ${plan.przekazania.oczekiwane}`);
    const rozklad = rozkladStatusow();
    console.log(
      `rozkład docelowy:    ${STATUSY_KANONICZNE.map((s) => `${s}=${rozklad[s]}`).join(' ')} ` +
        `(on_hold=${INICJATYWY.filter((i) => i.onHold).length})`
    );

    if (opcje.tryb === 'dry-run') {
      const doZmiany = plan.inicjatywy.filter((i) => i.akcja !== 'bez zmian').length;
      console.log(
        `\n[inicjatywy] dry-run: ${INICJATYWY.length} inicjatyw, ${plan.interesariusze.oczekiwane} interesariuszy, ` +
          `${plan.historia.oczekiwane} wpisów historii, ${plan.przekazania.oczekiwane} przekazań. ` +
          `${doZmiany} inicjatyw do zmiany. Nic nie zapisano.`
      );
      if (!d3.apiUrl)
        console.log(
          '[inicjatywy] UWAGA: bez --api etap 2 (decyzje GO, agregaty, przejście do realizacji, plan, obciążenie) NIE wykona się.'
        );
      return;
    }

    // --- ETAP SQL ------------------------------------------------------------
    const lic = await zapiszSql(c);
    console.log('\n' + lic.raport('inicjatywy/sql'));

    // --- ETAP API ------------------------------------------------------------
    if (!d3.apiUrl) {
      console.log(
        '[inicjatywy] STOP: bez --api rozkład statusów jest NIEPEŁNY (IN_EXECUTION zapisane jako APPROVED — STOP 1),\n' +
          '             nie ma agregatów runtime-v1, planu ani analizy obciążenia. --verify to zgłosi.'
      );
      return;
    }
    const api = new Api(d3.apiUrl);
    await api.zaloguj(d3.email, d3.haslo!);
    // TRZY sesje — bramki łańcucha przekazania (D4b, DECYZJA 2) egzekwują
    // ROZDZIELENIE RÓL w kodzie: autorytet harmonogramu nie może być
    // wnioskodawcą (`scheduleDecision.ts:191-197`), a akceptację przekazania
    // podpisuje WYŁĄCZNIE wskazany Execution Manager (`handoffAcceptance.ts:201-207`).
    const autorytet = new Api(d3.apiUrl);
    await autorytet.zaloguj(`sarah.mitchell@${DOMENA}`, d3.haslo!);
    const menedzer = new Api(d3.apiUrl);
    await menedzer.zaloguj(`robert.chen@${DOMENA}`, d3.haslo!);

    const w = await etapApi(api, autorytet, menedzer, c);
    console.log(
      `\n[inicjatywy/api] decyzje GO=${w.decyzjeGo}/${zDecyzjaGo.length} · agregaty=${w.agregaty}/${doRejestracji().length} ` +
        `· przejścia do realizacji=${w.przejscia}/${INICJATYWY.filter((i) => i.status === 'IN_EXECUTION').length}`
    );
    console.log(`[inicjatywy/api] plan:       ${w.plan}`);
    console.log(`[inicjatywy/api] obciążenie: ${w.obciazenie}`);
    console.log(`[inicjatywy/api] przekazania -> execution_case: ${w.przekazania}/${SLUGI_PRZEKAZANIA.length}`);
    for (const b of [...w.decyzjeGoBledy, ...w.agregatyBledy, ...w.przekazaniaBledy, ...w.przejsciaBledy])
      console.error(`[inicjatywy/api] BŁĄD ${b}`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[inicjatywy] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});

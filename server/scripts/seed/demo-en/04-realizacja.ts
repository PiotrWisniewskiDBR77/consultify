#!/usr/bin/env tsx
/**
 * D4 — SEED REALIZACJI organizacji „Northwind Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D4, §3.1 poz. 7).
 *
 * Buduje moduł REALIZACJA po angielsku na czterech inicjatywach `IN_EXECUTION`
 * z paczki D3 (jedna z flagą `on_hold`): 36 zadań z osobami, terminami
 * i pracochłonnością (8 po terminie), 7 pozycji RAID, 9 decyzji z opcjami
 * i uzasadnieniem (3 po terminie), plan bazowy ośmiu kamieni z dwoma
 * udokumentowanymi przesunięciami, 2 raporty statusu i 2 migawki raportów.
 *
 * DWA ETAPY — podział wynika z POMIARU kontraktów zapisu, nie z wygody:
 *
 *   ETAP SQL (`tasks`, `status_reports`, `plan_baselines`, `initiative_milestones`)
 *     `server/src/routes/pmo/tasks.routes.ts:62-80` mówi wprost, że kanoniczna
 *     komenda `execution.task.*` NIE pisze do tabeli `tasks`, a to z niej czyta
 *     całe UI Realizacji. `plan_baselines` ma jednego pisarza
 *     (`rolloutBaselineService.ts:100`) będącego czystym INSERT-em, a
 *     `POST /api/baselines/:roadmapId/capture` (`BaselinesController.ts:20-40`)
 *     to ATRAPA — loguje i zwraca 201 bez zapisu.
 *
 *   ETAP API (`--api <url>`) — tam, gdzie ekran czyta agregat albo gdzie
 *     serwis egzekwuje regułę, której baza nie zna:
 *       · RAID  → `POST /api/initiatives/runtime-v1/initiatives/:id/raid-items/:raidId`
 *         (dual-write: `postgresMaterialCommandUnitOfWork.ts:82` pisze `raid_items`
 *         I `ie_aggregate_state`; `GET /api/raid` czyta wersję agregatu
 *         przez LEFT JOIN — `raid.routes.ts:79-82`).
 *       · Decyzje → `POST /api/decisions` (transakcja z `decision_history`,
 *         `DecisionController.ts:1408-1463`), opcje → `POST /:id/alternatives`
 *         (jedyny pisarz `decision_alternatives`, `decisionCollaborationService.ts:386`),
 *         rozstrzygnięcie → `PUT /:id/decide` (bramka `RATIONALE_REQUIRED`
 *         żyje w `decisionOutcomeService.ts:87-93`, nie w bazie).
 *       · Migawki raportów → `POST /api/execution-reports/runs` (walidacja
 *         `SnapshotSchema` + bramka MVP 409 `WAVE_2`, `executionReports.routes.ts:378`).
 *
 * SYGNAŁY OPÓŹNIEŃ nie są seedowane: `GET /api/execution-control/delay-signals`
 * bez `?persisted=true` liczy je NA ŻYWO z terminów zadań i inicjatyw
 * (`delayDetectionService.ts:340-386`), a oba zapisy tej trasy (`/detect`,
 * `/dismiss`) są zamknięte bramką 409 `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`
 * (`Gateway.ts:1435`), dla której nie ma następcy w Runtime-v1.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/04-realizacja.ts --oczekiwany-host 127.0.0.1 --dry-run
 *   DATABASE_URL=… npx tsx … 04-realizacja.ts --oczekiwany-host 127.0.0.1 --apply \
 *       --api http://127.0.0.1:4184 --haslo-plik /private/tmp/dane-pokazowe-en/northwind-konta-d4.txt
 *   DATABASE_URL=… npx tsx … 04-realizacja.ts --oczekiwany-host 127.0.0.1 --verify
 *   DATABASE_URL=… npx tsx … 04-realizacja.ts --oczekiwany-host 127.0.0.1 --reset
 *
 * IDEMPOTENCJA MIERZONA: drugi `--apply` musi wypisać `utworzono=0 zmieniono=0`.
 */
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
  DECYZJE,
  KLUCZE_MIGAWEK,
  PRZESUNIECIA_KAMIENI,
  RAID,
  RAPORTY_STATUSU,
  SLUGI_REALIZOWANE,
  ZADANIA,
  type Decyzja,
  type SlugInicjatywy,
  type SlugOsoby,
} from './04-dane-realizacji';

// ============================================================================
// Identyfikatory deterministyczne — te same przestrzenie co D1/D3
// ============================================================================
const idOsoby = (slug: SlugOsoby) => det('user', `${slug}@${DOMENA}`);
const idInicjatywy = (slug: SlugInicjatywy) => det('initiative', slug);
const idZadania = (slug: string) => det('task', slug);
const idRaid = (slug: string) => det('raid-item', slug);
const idRaportu = (slug: string) => det('status-report', slug);
const idPlanuBazowego = (projektId: string) => det('plan-baseline', projektId);

const json = (v: unknown) => JSON.stringify(v);

/**
 * „Dziś" paczki. Baza pokazowa ma wyglądać identycznie w każdy dzień odbioru,
 * więc granica po terminie / w oknie jest STAŁA, nie liczona z zegara.
 */
const DZIS = '2026-09-08';
const PONIEDZIALEK_BIEZACY = '2026-09-07';

// ============================================================================
// Argumenty własne paczki D4 (`00-wspolne.ts` ignoruje nieznane flagi)
// ============================================================================
interface OpcjeD4 {
  apiUrl: string | null;
  email: string;
  haslo: string | null;
}

function czytajOpcjeD4(argv: string[], hasloPlik: string): OpcjeD4 {
  let apiUrl: string | null = null;
  let email = `james.whitfield@${DOMENA}`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--api') apiUrl = argv[++i] ?? null;
    else if (a.startsWith('--api=')) apiUrl = a.split('=').slice(1).join('=');
    else if (a === '--email') email = argv[++i] ?? email;
    else if (a.startsWith('--email=')) email = a.split('=').slice(1).join('=');
  }
  let haslo: string | null = null;
  if (apiUrl) {
    // Hasło NIGDY z argumentu (trafiłoby do historii powłoki) — wyłącznie z pliku
    // poza repozytorium, tego samego, do którego zapisał je `01-rdzen.ts`.
    const tresc = fs.readFileSync(hasloPlik, 'utf8');
    const m = tresc.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/);
    haslo = m?.[1]?.trim() ?? null;
    if (!haslo) throw new Error(`Nie znalazłem hasła w pliku ${hasloPlik}. Etap API nie ruszy.`);
  }
  return { apiUrl: apiUrl ? apiUrl.replace(/\/$/, '') : null, email, haslo };
}

// ============================================================================
// Klient API — logowanie ciasteczkiem albo Bearerem (wzór z D3)
// ============================================================================
class Api {
  private cookie = '';
  private bearer = '';
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
      const parsed = JSON.parse(body) as { token?: string; data?: { token?: string } };
      const token = parsed.token ?? parsed.data?.token;
      if (!token) throw new Error('Logowanie OK, ale ani ciasteczka, ani tokenu — etap API nie ruszy.');
      this.bearer = token;
    }
  }

  async zadanie<T = unknown>(
    metoda: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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

// ============================================================================
// Rodowód projektu — realizacja BEZ `project_id` jest fail-closed
// (`initiativesExecutionRuntime.routes.ts:4844-4861`, `postgresInitiativeReader.ts:172`).
// Czytamy go z bazy, nie zakładamy.
// ============================================================================
async function projektyInicjatyw(c: PoolClient): Promise<Map<SlugInicjatywy, string>> {
  const mapa = new Map<SlugInicjatywy, string>();
  for (const slug of SLUGI_REALIZOWANE) {
    const r = await c.query<{ project_id: string | null; status: string }>(
      'SELECT project_id, status FROM initiatives WHERE organization_id = $1 AND id = $2',
      [ORG_ID, idInicjatywy(slug)]
    );
    const wiersz = r.rows[0];
    if (!wiersz)
      throw new Error(
        `Brak inicjatywy „${slug}" w organizacji ${ORG_ID}. Uruchom najpierw 03-inicjatywy.ts --apply.`
      );
    if (!wiersz.project_id)
      throw new Error(
        `Inicjatywa „${slug}" nie ma project_id — realizacja byłaby niewidoczna (fail-closed). STOP.`
      );
    mapa.set(slug, wiersz.project_id);
  }
  return mapa;
}

// ============================================================================
// PLAN (co się zmieni) — liczony z bazy, nie zakładany
// ============================================================================
interface PlanD4 {
  zadania: { utworzy: number; zaktualizuje: number; bezZmian: number };
  raid: { utworzy: number; bezZmian: number };
  decyzje: { utworzy: number; bezZmian: number };
  raportyStatusu: { utworzy: number; bezZmian: number };
  planyBazowe: { utworzy: number; bezZmian: number };
  przesunieciaKamieni: { utworzy: number; bezZmian: number };
  migawki: { utworzy: number; bezZmian: number };
}

async function zbudujPlan(c: PoolClient): Promise<PlanD4> {
  const istnieje = async (sql: string, params: unknown[]) =>
    Number((await c.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0) > 0;

  const plan: PlanD4 = {
    zadania: { utworzy: 0, zaktualizuje: 0, bezZmian: 0 },
    raid: { utworzy: 0, bezZmian: 0 },
    decyzje: { utworzy: 0, bezZmian: 0 },
    raportyStatusu: { utworzy: 0, bezZmian: 0 },
    planyBazowe: { utworzy: 0, bezZmian: 0 },
    przesunieciaKamieni: { utworzy: 0, bezZmian: 0 },
    migawki: { utworzy: 0, bezZmian: 0 },
  };

  for (const z of ZADANIA) {
    const r = await c.query<{ title: string; status: string; estimated_hours: number | null }>(
      'SELECT title, status, estimated_hours FROM tasks WHERE organization_id = $1 AND id = $2',
      [ORG_ID, idZadania(z.slug)]
    );
    if (r.rowCount === 0) plan.zadania.utworzy++;
    else if (r.rows[0]!.title !== z.tytul || r.rows[0]!.status !== z.status) plan.zadania.zaktualizuje++;
    else plan.zadania.bezZmian++;
  }

  for (const r of RAID) {
    (await istnieje('SELECT COUNT(*)::text AS n FROM raid_items WHERE organization_id=$1 AND id=$2', [
      ORG_ID,
      idRaid(r.slug),
    ]))
      ? plan.raid.bezZmian++
      : plan.raid.utworzy++;
  }

  for (const d of DECYZJE) {
    (await istnieje('SELECT COUNT(*)::text AS n FROM decisions WHERE organization_id=$1 AND title=$2', [
      ORG_ID,
      d.tytul,
    ]))
      ? plan.decyzje.bezZmian++
      : plan.decyzje.utworzy++;
  }

  for (const s of RAPORTY_STATUSU) {
    (await istnieje('SELECT COUNT(*)::text AS n FROM status_reports WHERE organization_id=$1 AND id=$2', [
      ORG_ID,
      idRaportu(s.slug),
    ]))
      ? plan.raportyStatusu.bezZmian++
      : plan.raportyStatusu.utworzy++;
  }

  const projekty = new Set((await projektyInicjatyw(c)).values());
  for (const p of projekty) {
    (await istnieje('SELECT COUNT(*)::text AS n FROM plan_baselines WHERE organization_id=$1 AND id=$2', [
      ORG_ID,
      idPlanuBazowego(p),
    ]))
      ? plan.planyBazowe.bezZmian++
      : plan.planyBazowe.utworzy++;
  }

  for (const p of PRZESUNIECIA_KAMIENI) {
    const r = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM initiative_milestones
        WHERE organization_id=$1 AND initiative_id=$2 AND name=$3 AND target_date = $4::date`,
      [ORG_ID, idInicjatywy(p.inicjatywa), p.nazwa, p.nowyTermin]
    );
    Number(r.rows[0]!.n) > 0 ? plan.przesunieciaKamieni.bezZmian++ : plan.przesunieciaKamieni.utworzy++;
  }

  for (const klucz of KLUCZE_MIGAWEK) {
    (await istnieje(
      'SELECT COUNT(*)::text AS n FROM execution_report_snapshots WHERE organization_id::text=$1 AND definition_key=$2',
      [ORG_ID, klucz]
    ))
      ? plan.migawki.bezZmian++
      : plan.migawki.utworzy++;
  }

  return plan;
}

function wypiszPlan(plan: PlanD4): void {
  console.log('\n--- PLAN ---');
  const w = (etykieta: string, o: Record<string, number>) =>
    console.log(
      `${etykieta.padEnd(26)} ${Object.entries(o)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')}`
    );
  w('zadania', plan.zadania);
  w('RAID', plan.raid);
  w('decyzje', plan.decyzje);
  w('raporty statusu', plan.raportyStatusu);
  w('plany bazowe', plan.planyBazowe);
  w('przesunięcia kamieni', plan.przesunieciaKamieni);
  w('migawki raportów', plan.migawki);
}

// ============================================================================
// ETAP SQL
// ============================================================================
async function zapiszSql(c: PoolClient): Promise<Licznik> {
  const lic = new Licznik();
  const projekty = await projektyInicjatyw(c);
  await c.query('BEGIN');
  try {
    // --- 36 zadań ---------------------------------------------------------------
    for (const z of ZADANIA) {
      const id = idZadania(z.slug);
      const projektId = projekty.get(z.inicjatywa)!;
      const assignee = idOsoby(z.osoba);
      const istnieje = await c.query<{ title: string; status: string; estimated_hours: number | null }>(
        'SELECT title, status, estimated_hours FROM tasks WHERE organization_id=$1 AND id=$2',
        [ORG_ID, id]
      );
      const zakonczone = z.status === 'done' ? `${z.termin}T16:00:00` : null;
      if (istnieje.rowCount === 0) {
        await c.query(
          `INSERT INTO tasks (
             id, organization_id, project_id, initiative_id, title, description,
             status, priority, task_type, assignee_id, owner_id, reporter_id, created_by,
             due_date, created_at, updated_at, completed_at,
             estimated_hours, actual_hours, effort_estimate_hours,
             acceptance_criteria, source, risk_rating, progress
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$11,
                     $12::timestamp,$13::timestamp,$13::timestamp,$14::timestamp,
                     $15,$16,$15,$17,'manual',$18,$19)`,
          [
            id,
            ORG_ID,
            projektId,
            idInicjatywy(z.inicjatywa),
            z.tytul,
            z.opis,
            z.status,
            z.priorytet,
            z.typ,
            assignee,
            idOsoby('james.whitfield'),
            `${z.termin}T17:00:00`,
            `${z.start}T08:00:00`,
            zakonczone,
            z.godziny,
            z.godzinyFaktyczne,
            z.kryterium,
            z.priorytet === 'critical' || z.priorytet === 'urgent' ? 'high' : 'low',
            z.status === 'done' ? '100' : z.status === 'in_progress' ? '40' : '0',
          ]
        );
        lic.utworz();
      } else if (
        istnieje.rows[0]!.title !== z.tytul ||
        istnieje.rows[0]!.status !== z.status ||
        Number(istnieje.rows[0]!.estimated_hours ?? -1) !== z.godziny
      ) {
        await c.query(
          `UPDATE tasks SET title=$3, description=$4, status=$5, priority=$6, task_type=$7,
                            assignee_id=$8, owner_id=$8, due_date=$9::timestamp, created_at=$10::timestamp,
                            completed_at=$11::timestamp, estimated_hours=$12, actual_hours=$13,
                            effort_estimate_hours=$12, acceptance_criteria=$14, updated_at=CURRENT_TIMESTAMP
            WHERE organization_id=$1 AND id=$2`,
          [
            ORG_ID,
            id,
            z.tytul,
            z.opis,
            z.status,
            z.priorytet,
            z.typ,
            assignee,
            `${z.termin}T17:00:00`,
            `${z.start}T08:00:00`,
            zakonczone,
            z.godziny,
            z.godzinyFaktyczne,
            z.kryterium,
          ]
        );
        lic.zmien();
      } else lic.pomin();
    }

    // --- 2 raporty statusu -------------------------------------------------------
    for (const s of RAPORTY_STATUSU) {
      const id = idRaportu(s.slug);
      const jest = await c.query('SELECT 1 FROM status_reports WHERE organization_id=$1 AND id=$2', [ORG_ID, id]);
      if (jest.rowCount !== 0) {
        lic.pomin();
        continue;
      }
      await c.query(
        `INSERT INTO status_reports (
           id, organization_id, initiative_id, project_id, title, content, health, period,
           period_type, period_start, period_end, period_label,
           overall_status, overall_trend, executive_summary, accomplishments, next_steps,
           escalations, risks_and_issues, recommendations,
           progress_percent, budget_consumed_percent, generation_method, status,
           created_by, created_at, published_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'MANUAL','PUBLISHED',$23,$24::timestamp,$24)`,
        [
          id,
          ORG_ID,
          idInicjatywy(s.inicjatywa),
          projekty.get(s.inicjatywa)!,
          s.tytul,
          json({ summary: s.streszczenie }),
          s.stan.toLowerCase(),
          s.typOkresu.toLowerCase(),
          s.typOkresu,
          s.okresOd,
          s.okresDo,
          s.etykietaOkresu,
          s.stan,
          s.trend,
          s.streszczenie,
          s.osiagniecia,
          s.nastepneKroki,
          s.eskalacje,
          s.ryzykaIProblemy,
          s.rekomendacje,
          s.postepProcent,
          s.budzetProcent,
          idOsoby(s.autor),
          `${s.okresDo}T17:00:00`,
        ]
      );
      lic.utworz();
    }

    // --- Plan bazowy: znacznik na kamieniach + migawka projektu -------------------
    for (const p of PRZESUNIECIA_KAMIENI) {
      const r = await c.query<{ id: string; target_date: string; baseline_date: string | null }>(
        `SELECT id, target_date::text AS target_date, baseline_date::text AS baseline_date
           FROM initiative_milestones WHERE organization_id=$1 AND initiative_id=$2 AND name=$3`,
        [ORG_ID, idInicjatywy(p.inicjatywa), p.nazwa]
      );
      const kamien = r.rows[0];
      if (!kamien)
        throw new Error(`Brak kamienia „${p.nazwa}" inicjatywy „${p.inicjatywa}" — D3 go nie założył. STOP.`);
      if (kamien.target_date === p.nowyTermin) {
        lic.pomin();
        continue;
      }
      await c.query(
        `UPDATE initiative_milestones
            SET target_date = $2::date,
                baseline_date = COALESCE(baseline_date, target_date),
                schedule_shift_count = 1,
                description = CASE WHEN description IS NULL OR description = '' THEN $3
                                   ELSE description || ' Rebaselined: ' || $3 END,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [kamien.id, p.nowyTermin, p.powod]
      );
      lic.zmien();
    }

    // `baseline_set_at` na WSZYSTKICH ośmiu kamieniach realizowanych inicjatyw:
    // plan bazowy jest ustawiony wtedy, gdy widać KIEDY go zamrożono.
    const znacznik = await c.query(
      `UPDATE initiative_milestones
          SET baseline_set_at = $3::timestamptz, baseline_version = 1,
              baseline_date = COALESCE(baseline_date, target_date)
        WHERE organization_id = $1 AND initiative_id = ANY($2::text[]) AND baseline_set_at IS NULL`,
      [ORG_ID, SLUGI_REALIZOWANE.map((s) => idInicjatywy(s)), `${DZIS}T00:00:00Z`]
    );
    for (let i = 0; i < (znacznik.rowCount ?? 0); i++) lic.zmien();

    for (const projektId of new Set(projekty.values())) {
      const id = idPlanuBazowego(projektId);
      const jest = await c.query('SELECT 1 FROM plan_baselines WHERE organization_id=$1 AND id=$2', [ORG_ID, id]);
      if (jest.rowCount !== 0) {
        lic.pomin();
        continue;
      }
      const kamienie = await c.query<{
        id: string;
        name: string;
        initiative_id: string;
        baseline_date: string | null;
      }>(
        `SELECT m.id, m.name, m.initiative_id, m.baseline_date::text AS baseline_date
           FROM initiative_milestones m
           JOIN initiatives i ON i.id = m.initiative_id
          WHERE m.organization_id = $1 AND i.project_id = $2 AND i.status = 'IN_EXECUTION'
          ORDER BY m.target_date`,
        [ORG_ID, projektId]
      );
      const nazwaProjektu = await c.query<{ name: string }>('SELECT name FROM projects WHERE id=$1', [projektId]);
      await c.query(
        `INSERT INTO plan_baselines (id, organization_id, project_id, label, snapshot, reason, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          ORG_ID,
          projektId,
          `Baseline 1 — ${nazwaProjektu.rows[0]?.name ?? projektId}`,
          json({
            capturedAt: `${DZIS}T00:00:00Z`,
            baselineVersion: 1,
            milestones: kamienie.rows.map((k) => ({
              milestoneId: k.id,
              initiativeId: k.initiative_id,
              name: k.name,
              baselineDate: k.baseline_date,
            })),
          }),
          'Delivery baseline frozen at the Northwind 2027 programme start.',
          idOsoby('james.whitfield'),
          `${DZIS}T00:00:00Z`,
        ]
      );
      lic.utworz();
    }

    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
  return lic;
}

// ============================================================================
// ETAP API
// ============================================================================
interface WynikApi {
  raid: string;
  decyzje: string;
  migawki: string;
  bledy: string[];
  /** Blokady PRODUKTU (nie paczki) — nie przerywają seeda, trafiają do meldunku. */
  stopy: string[];
}

async function etapApi(c: PoolClient, api: Api): Promise<WynikApi> {
  const bledy: string[] = [];
  const stopy: string[] = [];
  const projekty = await projektyInicjatyw(c);

  // --- RAID przez kanonicznego writera (dual-write) ----------------------------
  let raidUtworzone = 0;
  let raidIstniejace = 0;
  for (const r of RAID) {
    const id = idRaid(r.slug);
    const jest = await c.query('SELECT 1 FROM raid_items WHERE organization_id=$1 AND id=$2', [ORG_ID, id]);
    if (jest.rowCount !== 0) {
      raidIstniejace++;
      continue;
    }
    const { status, body } = await api.zadanie(
      'POST',
      `/api/initiatives/runtime-v1/initiatives/${idInicjatywy(r.inicjatywa)}/raid-items/${id}`,
      {
        expectedVersion: 0,
        clientRequestId: det('raid-create', r.slug),
        type: r.typ,
        title: r.tytul,
        description: r.opis,
        status: r.status,
        probability: r.prawdopodobienstwo,
        severity: r.wplyw,
        ownerId: idOsoby(r.osoba),
        dueDate: r.termin,
        mitigationPlan: r.planZaradczy,
        linkedItems: [],
      }
    );
    if (status === 200 || status === 201) raidUtworzone++;
    else bledy.push(`RAID ${r.slug}: HTTP ${status} ${json(body).slice(0, 200)}`);
  }

  // --- Decyzje: utworzenie + opcje + rozstrzygnięcie ---------------------------
  let decUtworzone = 0;
  let decIstniejace = 0;
  let opcjeUtworzone = 0;
  let rozstrzygniete = 0;
  const idDecyzji = async (d: Decyzja): Promise<string | null> => {
    const r = await c.query<{ id: string }>('SELECT id FROM decisions WHERE organization_id=$1 AND title=$2', [
      ORG_ID,
      d.tytul,
    ]);
    return r.rows[0]?.id ?? null;
  };

  for (const d of DECYZJE) {
    let id = await idDecyzji(d);
    if (id) decIstniejace++;
    else {
      const { status, body } = await api.zadanie<{ id?: string; data?: { id?: string } }>('POST', '/api/decisions', {
        title: d.tytul,
        description: d.opis,
        initiativeId: idInicjatywy(d.inicjatywa),
        projectId: projekty.get(d.inicjatywa)!,
        decisionOwnerId: idOsoby(d.decydent),
        dueDate: `${d.termin}T17:00:00.000Z`,
        priority: d.priorytet,
        impact: d.wplyw,
        pmoDomain: d.domena,
        decisionType: d.typ,
        // JAWNY wpis wpływu, celowo `isBlocker: false`. Bez niego
        // `DecisionController.ts:1308-1330` dokłada DOMYŚLNY wpis blokujący dla
        // typów SCOPE_CHANGE / RISK_ACCEPTANCE / BLOCKER_RESOLUTION /
        // PHASE_TRANSITION / EXECUTION, a `applyDecisionBlockTransitionOnClient`
        // (`:1512`) ustawia inicjatywie `on_hold = TRUE` i dopisuje wiersz
        // `initiative_status_history` z `gate_type='DECISION_AUTO_BLOCK'`.
        // ZMIERZONE 08.09: przy pierwszym przebiegu D4 zablokowało w ten sposób
        // MES Rollout Line 3 — na liście stały DWIE inicjatywy „On hold" zamiast
        // jednej, a `--verify` paczki D3 spadał na dwóch asercjach. Te dziewięć
        // decyzji czeka na odpowiedź, ale ŻADNA nie wstrzymuje całej inicjatywy.
        impacts: [
          {
            impactedType: 'initiative' as const,
            impactedId: idInicjatywy(d.inicjatywa),
            impactDescription: 'Decision needed to keep this initiative on plan.',
            isBlocker: false,
          },
        ],
      });
      if (status !== 200 && status !== 201) {
        bledy.push(`Decyzja ${d.slug}: HTTP ${status} ${json(body).slice(0, 200)}`);
        continue;
      }
      id = await idDecyzji(d);
      if (!id) {
        bledy.push(`Decyzja ${d.slug}: utworzona (HTTP ${status}), ale nie widać jej w bazie po tytule.`);
        continue;
      }
      decUtworzone++;
    }

    // Opcje — jedyny rejestr, który czyta karta decyzji.
    for (const o of d.opcje) {
      const jest = await c.query('SELECT 1 FROM decision_alternatives WHERE decision_id=$1 AND title=$2', [
        id,
        o.tytul,
      ]);
      if (jest.rowCount !== 0) continue;
      const { status, body } = await api.zadanie('POST', `/api/decisions/${id}/alternatives`, {
        title: o.tytul,
        description: o.opis,
        benefits: o.korzysci,
        drawbacks: o.wady,
        costOrFeasibility: o.koszt,
        isRecommended: o.rekomendowana,
      });
      if (status === 200 || status === 201) opcjeUtworzone++;
      else bledy.push(`Opcja „${o.tytul}" (${d.slug}): HTTP ${status} ${json(body).slice(0, 160)}`);
    }

    // Rozstrzygnięcie — bramka `RATIONALE_REQUIRED` żyje w serwisie, nie w bazie.
    if (d.rozstrzygniecie) {
      const stan = await c.query<{ status: string }>('SELECT status FROM decisions WHERE id=$1', [id]);
      if ((stan.rows[0]?.status ?? '').toLowerCase() === 'pending') {
        const { status, body } = await api.zadanie('PUT', `/api/decisions/${id}/decide`, {
          decision: d.rozstrzygniecie,
          rationale: d.uzasadnienie ?? '',
        });
        if (status === 200 || status === 201) rozstrzygniete++;
        else bledy.push(`Rozstrzygnięcie ${d.slug}: HTTP ${status} ${json(body).slice(0, 200)}`);
      }
    }
  }

  // Kopia opcji do kolumny `decisions.options` — czytniki legacy (karta decyzji
  // sprzed rejestru `decision_alternatives`) biorą listę stamtąd i bez tego
  // pokazują pustą sekcję „Opcje".
  for (const d of DECYZJE) {
    const id = await idDecyzji(d);
    if (!id) continue;
    await c.query('UPDATE decisions SET options = $2 WHERE id = $1 AND COALESCE(options, \'[]\') IN (\'\', \'[]\')', [
      id,
      json(
        d.opcje.map((o, i) => ({
          id: `option-${i + 1}`,
          label: o.tytul,
          description: o.opis,
          recommended: o.rekomendowana,
        }))
      ),
    ]);
  }

  // --- Migawki raportów realizacji ---------------------------------------------
  let migawkiUtworzone = 0;
  let migawkiIstniejace = 0;
  for (const klucz of KLUCZE_MIGAWEK) {
    const jest = await c.query(
      'SELECT 1 FROM execution_report_snapshots WHERE organization_id::text=$1 AND definition_key=$2',
      [ORG_ID, klucz]
    );
    if (jest.rowCount !== 0) {
      migawkiIstniejace++;
      continue;
    }
    const migawka = await zbudujMigawke(c, klucz);
    const { status, body } = await api.zadanie<{ id?: string }>('POST', '/api/execution-reports/runs', migawka);
    if (status !== 200 && status !== 201) {
      // STOP PRODUKTU, nie usterka paczki: `execution_report_snapshots.organization_id`
      // i `report_definitions.organization_id` mają typ UUID, a `organizations.id`
      // jest typu TEXT i dla tej organizacji to slug „northwind". Zapytania
      // `executionReports.routes.ts:268` i `:313` wywracają się na
      // `invalid input syntax for type uuid`, warstwa `dbAll` łyka wyjątek
      // i zwraca [] — zakładka „Raporty" (tor nowego rejestru migawek) jest
      // CICHO pusta dla każdej organizacji o identyfikatorze innym niż UUID.
      stopy.push(
        `Migawka „${klucz}" niemożliwa: HTTP ${status} ${json(body).slice(0, 160)} ` +
          '— execution_report_snapshots.organization_id jest UUID, a organizations.id to TEXT („northwind").'
      );
      continue;
    }
    migawkiUtworzone++;
    const id = (body as { id?: string }).id;
    if (id && klucz === 'weekly-exec') {
      const pub = await api.zadanie('POST', `/api/execution-reports/runs/${id}/publish`, {});
      if (pub.status !== 200 && pub.status !== 201)
        bledy.push(`Publikacja migawki ${klucz}: HTTP ${pub.status} ${json(pub.body).slice(0, 160)}`);
    }
  }

  return {
    raid: `utworzone=${raidUtworzone} istniejące=${raidIstniejace}`,
    decyzje: `utworzone=${decUtworzone} istniejące=${decIstniejace} opcje=${opcjeUtworzone} rozstrzygnięcia=${rozstrzygniete}`,
    migawki: `utworzone=${migawkiUtworzone} istniejące=${migawkiIstniejace}`,
    bledy,
    stopy,
  };
}

/**
 * Migawka raportu budowana Z DANYCH W BAZIE (nie z literałów), tak jak robi to
 * front (`executionReportModel.ts:112-137` czyta inicjatywy, zadania, decyzje,
 * RAID i sygnały). Dzięki temu liczby na raporcie zgadzają się z tabelami.
 */
async function zbudujMigawke(c: PoolClient, klucz: (typeof KLUCZE_MIGAWEK)[number]) {
  const liczba = async (sql: string, params: unknown[] = []) =>
    Number((await c.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);
  const idyRealizowanych = SLUGI_REALIZOWANE.map((s) => idInicjatywy(s));

  const zadaniaRazem = await liczba(
    'SELECT COUNT(*)::text AS n FROM tasks WHERE organization_id=$1 AND initiative_id = ANY($2::text[])',
    [ORG_ID, idyRealizowanych]
  );
  const zadaniaZamkniete = await liczba(
    `SELECT COUNT(*)::text AS n FROM tasks WHERE organization_id=$1 AND initiative_id = ANY($2::text[])
       AND LOWER(COALESCE(status,'')) IN ('done','completed')`,
    [ORG_ID, idyRealizowanych]
  );
  const zadaniaPoTerminie = await liczba(
    `SELECT COUNT(*)::text AS n FROM tasks WHERE organization_id=$1 AND initiative_id = ANY($2::text[])
       AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','cancelled')
       AND due_date IS NOT NULL AND due_date < $3::timestamp`,
    [ORG_ID, idyRealizowanych, PONIEDZIALEK_BIEZACY]
  );
  const zadaniaZablokowane = await liczba(
    `SELECT COUNT(*)::text AS n FROM tasks WHERE organization_id=$1 AND initiative_id = ANY($2::text[])
       AND LOWER(COALESCE(status,'')) = 'blocked'`,
    [ORG_ID, idyRealizowanych]
  );
  const decyzjeOtwarte = await liczba(
    `SELECT COUNT(*)::text AS n FROM decisions WHERE organization_id=$1 AND LOWER(COALESCE(status,''))='pending'`,
    [ORG_ID]
  );
  const raidOtwarte = await liczba(
    `SELECT COUNT(*)::text AS n FROM raid_items WHERE organization_id=$1 AND status <> 'CLOSED'`,
    [ORG_ID]
  );

  const wierszeRyzyk = await c.query<{ title: string; type: string; probability: string; impact: string; owner: string }>(
    `SELECT r.title, r.type, COALESCE(r.probability,'') AS probability, COALESCE(r.impact,'') AS impact,
            COALESCE(u.first_name || ' ' || u.last_name, '') AS owner
       FROM raid_items r LEFT JOIN users u ON u.id = r.owner_id
      WHERE r.organization_id = $1 AND r.status <> 'CLOSED'
      ORDER BY CASE r.impact WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END, r.title
      LIMIT 5`,
    [ORG_ID]
  );
  const wierszeDecyzji = await c.query<{ title: string; deadline: string | null; owner: string }>(
    `SELECT d.title, d.deadline::text AS deadline,
            COALESCE(u.first_name || ' ' || u.last_name, '') AS owner
       FROM decisions d LEFT JOIN users u ON u.id = d.decision_maker_id
      WHERE d.organization_id = $1 AND LOWER(COALESCE(d.status,'')) = 'pending'
      ORDER BY d.deadline NULLS LAST LIMIT 5`,
    [ORG_ID]
  );

  const wspolne = {
    period: { start: '2026-08-31', end: '2026-09-06' },
    asOf: `${DZIS}T06:00:00.000Z`,
    metrics: [
      { id: 'initiatives', label: 'Initiatives in execution', value: String(SLUGI_REALIZOWANE.length), tone: 'NEUTRAL' as const },
      { id: 'tasks', label: 'Tasks total', value: String(zadaniaRazem), tone: 'NEUTRAL' as const },
      { id: 'tasks-done', label: 'Tasks completed', value: String(zadaniaZamkniete), tone: 'OK' as const },
      { id: 'tasks-overdue', label: 'Tasks past their due date', value: String(zadaniaPoTerminie), tone: 'CRIT' as const },
      { id: 'tasks-blocked', label: 'Tasks blocked', value: String(zadaniaZablokowane), tone: 'WARN' as const },
      { id: 'decisions', label: 'Decisions awaiting an answer', value: String(decyzjeOtwarte), tone: 'WARN' as const },
      { id: 'raid', label: 'Open RAID items', value: String(raidOtwarte), tone: 'WARN' as const },
    ],
  };

  const sekcjaRyzyk = {
    id: 'risks',
    title: 'Top open RAID items',
    table: {
      columns: [
        { id: 'title', label: 'Item' },
        { id: 'type', label: 'Type' },
        { id: 'exposure', label: 'Probability x impact' },
        { id: 'owner', label: 'Owner' },
      ],
      rows: wierszeRyzyk.rows.map((r) => ({
        title: r.title,
        type: r.type,
        exposure: `${r.probability} x ${r.impact}`,
        owner: r.owner,
      })),
    },
    empty: 'No open RAID items.',
  };
  const sekcjaDecyzji = {
    id: 'decisions',
    title: 'Decisions awaiting an answer',
    table: {
      columns: [
        { id: 'title', label: 'Decision' },
        { id: 'owner', label: 'Decision maker' },
        { id: 'due', label: 'Due' },
      ],
      rows: wierszeDecyzji.rows.map((d) => ({
        title: d.title,
        owner: d.owner,
        due: (d.deadline ?? '').slice(0, 10),
      })),
    },
    empty: 'No decisions awaiting an answer.',
  };

  if (klucz === 'weekly-exec')
    return {
      definitionKey: 'weekly-exec',
      title: 'Northwind 2027 — weekly execution pack, week 36',
      subtitle: 'Four initiatives in execution across two programmes',
      rag: 'AMBER' as const,
      ragReason:
        'Delivery is moving, but eight tasks and two RAID items are past their due date and three decisions are overdue.',
      ...wspolne,
      sections: [
        {
          id: 'summary',
          title: 'Where we are',
          narrative:
            'MES Rollout Line 3 and Predictive Maintenance are progressing to plan. Warehouse Automation is held at one aisle until the works council signs the safety case. Skills Matrix and Upskilling is paused until the 2027 budget round.',
          bullets: [
            'Shuttle commissioned; measured pick rate 27 per cent above the manual baseline.',
            'MES terminals complete; ERP work-order interface in configuration.',
            'Predictive alerting has caught two genuine spindle failures on cells 1 and 2.',
          ],
        },
        sekcjaRyzyk,
        sekcjaDecyzji,
        {
          id: 'next',
          title: 'Next two weeks',
          bullets: [
            'Close the downtime reason-code taxonomy with Quality.',
            'Run ten end-to-end test work orders through the MES-ERP interface.',
            'Complete pilot aisle re-slotting and start the before-and-after pick measurement.',
          ],
        },
      ],
    };

  return {
    definitionKey: 'program-health',
    title: 'Northwind 2027 — programme health summary',
    subtitle: 'Steering committee view, September 2026',
    rag: 'AMBER' as const,
    ragReason:
      'Two of four initiatives carry a critical-impact open item, and one initiative is on hold pending the 2027 budget.',
    ...wspolne,
    sections: [
      {
        id: 'health',
        title: 'Initiative health',
        table: {
          columns: [
            { id: 'initiative', label: 'Initiative' },
            { id: 'state', label: 'State' },
            { id: 'call', label: 'Call' },
          ],
          rows: [
            { initiative: 'MES Rollout Line 3', state: 'In execution', call: 'Amber — reason codes unagreed, firmware dependency' },
            { initiative: 'Predictive Maintenance for CNC Line', state: 'In execution', call: 'Green — two genuine catches, extension approved' },
            { initiative: 'Warehouse Automation Pilot', state: 'In execution', call: 'Amber — safety case unsigned, aisle two on hold' },
            { initiative: 'Skills Matrix and Upskilling', state: 'In execution, on hold', call: 'Amber — paused to the 2027 budget round' },
          ],
        },
      },
      sekcjaRyzyk,
      sekcjaDecyzji,
      {
        id: 'asks',
        title: 'What the committee is asked to do',
        bullets: [
          'Approve the Line 3 cutover date of 26 March 2027.',
          'Note that aisle two is ordered but will not be installed until the safety case is signed.',
          'Confirm the skills programme returns in the 2027 budget round in November.',
        ],
      },
    ],
  };
}

// ============================================================================
// VERIFY — asercje TWARDE („== N", nie „>= N")
// ============================================================================
/**
 * ZAKRES ZADAN PACZKI D4 w tabeli `tasks`.
 *
 * `tasks` jest WSPOLDZIELONA z paczka D6, ktora zaklada 6 ZADAN OSOBISTYCH
 * OWNER-a (`task_type='personal'`, bez inicjatywy i bez projektu — zasilaja
 * Skrzynke „Moja praca"). Bez tego zawezenia asercje D4 mierza cudzy zbior:
 * po `06-materialy.ts --apply` licznik „zadania" rosl 36 -> 42, „zadania BEZ
 * inicjatywy" 0 -> 6, a „zadania PO TERMINIE" 8 -> 10 (zmierzone D4b 08.09
 * na `consultify_kopia_d44`). Ten sam warunek obowiazuje `--reset`, zeby D4
 * nie kasowal danych D6.
 */
const ZADANIA_D4 = "organization_id=$1 AND COALESCE(task_type,'') <> 'personal'";

type Asercja = { nazwa: string; oczekiwane: number; rzeczywiste: number };

async function weryfikuj(c: PoolClient): Promise<void> {
  const licz = async (sql: string, params: unknown[] = []): Promise<number> =>
    Number((await c.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);
  const idyRealizowanych = SLUGI_REALIZOWANE.map((s) => idInicjatywy(s));

  const zadan = await licz(`SELECT COUNT(*)::text AS n FROM tasks WHERE ${ZADANIA_D4}`, [ORG_ID]);
  if (zadan === 0) {
    // Stan po `--reset`: wszystko musi być zerem.
    wypiszIZakoncz([
      { nazwa: 'zadania', oczekiwane: 0, rzeczywiste: 0 },
      {
        nazwa: 'pozycje RAID',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM raid_items WHERE organization_id=$1', [ORG_ID]),
      },
      {
        nazwa: 'decyzje',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM decisions WHERE organization_id=$1', [ORG_ID]),
      },
      {
        nazwa: 'raporty statusu',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM status_reports WHERE organization_id=$1', [ORG_ID]),
      },
      {
        nazwa: 'plany bazowe',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM plan_baselines WHERE organization_id=$1', [ORG_ID]),
      },
      {
        nazwa: 'migawki raportów',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM execution_report_snapshots WHERE organization_id::text=$1', [
          ORG_ID,
        ]),
      },
      {
        nazwa: 'kamienie z przesuniętym terminem wobec planu bazowego',
        oczekiwane: 0,
        rzeczywiste: await licz(
          `SELECT COUNT(*)::text AS n FROM initiative_milestones
            WHERE organization_id=$1 AND baseline_date IS NOT NULL AND target_date <> baseline_date`,
          [ORG_ID]
        ),
      },
    ]);
    return;
  }

  const asercje: Asercja[] = [
    { nazwa: 'zadania', oczekiwane: ZADANIA.length, rzeczywiste: zadan },
    {
      nazwa: 'zadania BEZ inicjatywy (0 — wymaganie paczki)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks WHERE ${ZADANIA_D4} AND (initiative_id IS NULL OR initiative_id='')`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zadania BEZ osoby (0 — wymaganie paczki)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks WHERE ${ZADANIA_D4} AND (assignee_id IS NULL OR assignee_id='')`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zadania BEZ rodowodu projektu (realizacja fail-closed)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks WHERE ${ZADANIA_D4} AND (project_id IS NULL OR project_id='')`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zadania BEZ terminu albo BEZ pracochłonności',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks
          WHERE ${ZADANIA_D4} AND (due_date IS NULL OR estimated_hours IS NULL OR estimated_hours <= 0)`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zadania PO TERMINIE (otwarte, termin przed bieżącym poniedziałkiem)',
      oczekiwane: 8,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks
          WHERE ${ZADANIA_D4} AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','validated','cancelled')
            AND due_date IS NOT NULL AND due_date < $2::timestamp`,
        [ORG_ID, PONIEDZIALEK_BIEZACY]
      ),
    },
    {
      nazwa: 'zadania na inicjatywach SPOZA czterech realizowanych',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks WHERE ${ZADANIA_D4} AND NOT (initiative_id = ANY($2::text[]))`,
        [ORG_ID, idyRealizowanych]
      ),
    },
    {
      nazwa: 'osoby z POPYTEM w oknie 8 tygodni (Zasoby: popyt > 0)',
      oczekiwane: 9,
      rzeczywiste: await licz(
        `SELECT COUNT(DISTINCT assignee_id)::text AS n FROM tasks
          WHERE ${ZADANIA_D4} AND assignee_id IS NOT NULL
            AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','validated','cancelled')`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'osoby z ZALEGŁOŚCIĄ (zadania po terminie z godzinami do zrobienia)',
      oczekiwane: 5,
      rzeczywiste: await licz(
        `SELECT COUNT(DISTINCT assignee_id)::text AS n FROM tasks
          WHERE ${ZADANIA_D4} AND LOWER(COALESCE(status,'')) NOT IN ('done','completed','validated','cancelled')
            AND due_date IS NOT NULL AND due_date < $2::timestamp
            AND COALESCE(estimated_hours,0) - COALESCE(actual_hours,0) > 0`,
        [ORG_ID, PONIEDZIALEK_BIEZACY]
      ),
    },
    {
      nazwa: 'osobo-tygodnie z PRZECIĄŻENIEM w pierwszym tygodniu okna (> 105 %)',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM (
           SELECT t.assignee_id, SUM(t.estimated_hours) AS h, MAX(u.weekly_capacity_hours) AS cap
             FROM tasks t JOIN users u ON u.id = t.assignee_id
            WHERE t.organization_id = $1 AND COALESCE(t.task_type,'') <> 'personal'
              AND LOWER(COALESCE(t.status,'')) NOT IN ('done','completed','validated','cancelled')
              AND t.created_at >= $2::timestamp AND t.due_date < ($2::timestamp + INTERVAL '7 days')
            GROUP BY t.assignee_id
         ) x WHERE x.h > x.cap * 1.05`,
        [ORG_ID, PONIEDZIALEK_BIEZACY]
      ),
    },
    {
      nazwa: 'pozycje RAID',
      oczekiwane: RAID.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM raid_items WHERE organization_id=$1', [ORG_ID]),
    },
    {
      nazwa: 'pozycje RAID bez p x w, właściciela, terminu albo planu zaradczego',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM raid_items
          WHERE organization_id=$1 AND (probability IS NULL OR impact IS NULL OR owner_id IS NULL
                OR due_date IS NULL OR mitigation_plan IS NULL OR mitigation_plan = '')`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'pozycje RAID z agregatem runtime-v1 (dual-write przez kanonicznego writera)',
      oczekiwane: RAID.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM ie_aggregate_state
          WHERE organization_id=$1 AND aggregate_type='raid_item'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'decyzje',
      oczekiwane: DECYZJE.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM decisions WHERE organization_id=$1', [ORG_ID]),
    },
    {
      nazwa: 'decyzje bez decydenta albo bez terminu',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM decisions
          WHERE organization_id=$1 AND (decision_maker_id IS NULL OR decision_maker_id='' OR deadline IS NULL)`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'decyzje PO TERMINIE (otwarte, termin w przeszłości)',
      oczekiwane: 3,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM decisions
          WHERE organization_id=$1 AND LOWER(COALESCE(status,''))='pending' AND deadline < $2::timestamp`,
        [ORG_ID, DZIS]
      ),
    },
    {
      nazwa: 'decyzje ROZSTRZYGNIĘTE z uzasadnieniem',
      oczekiwane: DECYZJE.filter((d) => d.rozstrzygniecie).length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM decisions
          WHERE organization_id=$1 AND LOWER(COALESCE(status,'')) IN ('approved','rejected')
            AND decision_rationale IS NOT NULL AND LENGTH(decision_rationale) > 40`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'opcje decyzji (rejestr decision_alternatives)',
      oczekiwane: DECYZJE.reduce((s, d) => s + d.opcje.length, 0),
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM decision_alternatives a
           JOIN decisions d ON d.id = a.decision_id WHERE d.organization_id=$1`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'decyzje bez ani jednej opcji',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM decisions d
          WHERE d.organization_id=$1
            AND NOT EXISTS (SELECT 1 FROM decision_alternatives a WHERE a.decision_id = d.id)`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'wpisy historii decyzji (kanoniczny pisarz, nie SQL)',
      oczekiwane: DECYZJE.length + DECYZJE.filter((d) => d.rozstrzygniecie).length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM decision_history h
           JOIN decisions d ON d.id = h.decision_id WHERE d.organization_id=$1`,
        [ORG_ID]
      ),
    },
    {
      // BEZPIECZNIK: żadna decyzja D4 nie może wstrzymać inicjatywy. Wstrzymana
      // ma być DOKŁADNIE jedna — „Skills Matrix and Upskilling" z paczki D3.
      nazwa: 'inicjatywy wstrzymane flagą on_hold (ma zostać wyłącznie ta z D3)',
      oczekiwane: 1,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id=$1 AND on_hold',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'automatyczne blokady inicjatyw założone decyzjami (DECISION_AUTO_BLOCK)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiative_status_history h
           JOIN initiatives i ON i.id = h.initiative_id
          WHERE i.organization_id=$1 AND h.gate_type = 'DECISION_AUTO_BLOCK'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'kamienie milowe czterech realizowanych inicjatyw',
      oczekiwane: 8,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM initiative_milestones WHERE organization_id=$1 AND initiative_id = ANY($2::text[])',
        [ORG_ID, idyRealizowanych]
      ),
    },
    {
      nazwa: 'kamienie bez planu bazowego (baseline_date albo baseline_set_at)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiative_milestones
          WHERE organization_id=$1 AND initiative_id = ANY($2::text[])
            AND (baseline_date IS NULL OR baseline_set_at IS NULL)`,
        [ORG_ID, idyRealizowanych]
      ),
    },
    {
      nazwa: 'kamienie z terminem przesuniętym wobec planu bazowego',
      oczekiwane: PRZESUNIECIA_KAMIENI.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM initiative_milestones
          WHERE organization_id=$1 AND baseline_date IS NOT NULL AND target_date <> baseline_date`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'migawki planu bazowego projektów (plan_baselines)',
      oczekiwane: 2,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM plan_baselines WHERE organization_id=$1', [ORG_ID]),
    },
    {
      nazwa: 'raporty statusu (opublikowane)',
      oczekiwane: RAPORTY_STATUSU.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM status_reports WHERE organization_id=$1 AND status='PUBLISHED'`,
        [ORG_ID]
      ),
    },
    {
      // STOP A ZAMKNIETY w D4b (DECYZJA 1): `execution_report_snapshots.organization_id`
      // jest typu UUID (jak 11 innych kolumn `organization_id` w schemacie), wiec
      // slug „northwind" konczyl sie `invalid input syntax for type uuid`, ktore
      // `dbAll` polykalo — migawki nie powstawaly, a zakladka „Raporty" byla cicho
      // pusta. Od D4b `ORG_ID` to deterministyczny UUIDv5 i migawki sie zapisuja.
      nazwa: 'migawki raportów realizacji (org-id typu UUID — DECYZJA 1 D4b)',
      oczekiwane: KLUCZE_MIGAWEK.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM execution_report_snapshots WHERE organization_id::text=$1', [
        ORG_ID,
      ]),
    },
    {
      // Sygnały liczy detektor NA ŻYWO z tej samej reguły (`delayDetectionService.ts`:
      // JOIN inicjatyw, `due_date < now`, status poza done/cancelled PRZEZ LOWER —
      // po naprawie D4b DECYZJA 3). Asercja liczy dokładnie to zapytanie, żeby
      // „sygnały > 0" było mierzone, nie deklarowane.
      nazwa: 'źródło sygnałów opóźnień: zadania po terminie z inicjatywą (musi być > 0)',
      oczekiwane: 8,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM tasks t JOIN initiatives i ON i.id = t.initiative_id
          WHERE i.organization_id=$1
            AND LOWER(COALESCE(t.status,'')) NOT IN ('done','cancelled')
            AND t.due_date IS NOT NULL AND t.due_date < $2::timestamp`,
        [ORG_ID, DZIS]
      ),
    },
    {
      nazwa: 'pola tekstowe realizacji z polskimi znakami (dane muszą być po angielsku)',
      oczekiwane: 0,
      rzeczywiste:
        (await licz(
          `SELECT COUNT(*)::text AS n FROM tasks
            WHERE ${ZADANIA_D4} AND (title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' OR COALESCE(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
                  OR COALESCE(acceptance_criteria,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')`,
          [ORG_ID]
        )) +
        (await licz(
          `SELECT COUNT(*)::text AS n FROM raid_items
            WHERE organization_id=$1 AND (title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' OR COALESCE(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
                  OR COALESCE(mitigation_plan,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')`,
          [ORG_ID]
        )) +
        (await licz(
          `SELECT COUNT(*)::text AS n FROM decisions
            WHERE organization_id=$1 AND (title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' OR COALESCE(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
                  OR COALESCE(decision_rationale,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')`,
          [ORG_ID]
        )) +
        (await licz(
          `SELECT COUNT(*)::text AS n FROM status_reports
            WHERE organization_id=$1 AND (COALESCE(title,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
                  OR COALESCE(executive_summary,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')`,
          [ORG_ID]
        )),
    },
    {
      nazwa: 'znak & w danych realizacji (sanitizer runtime-v1 zamienia go na &amp;)',
      oczekiwane: 0,
      rzeczywiste:
        (await licz(
          `SELECT COUNT(*)::text AS n FROM raid_items WHERE organization_id=$1 AND (title LIKE '%&%' OR COALESCE(description,'') LIKE '%&%' OR COALESCE(mitigation_plan,'') LIKE '%&%')`,
          [ORG_ID]
        )) +
        (await licz(
          `SELECT COUNT(*)::text AS n FROM tasks WHERE ${ZADANIA_D4} AND (title LIKE '%&%' OR COALESCE(description,'') LIKE '%&%')`,
          [ORG_ID]
        )),
    },
  ];

  wypiszIZakoncz(asercje);
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    const ok = a.oczekiwane === a.rzeczywiste;
    if (!ok) bledy++;
    console.log(
      `[verify-d4] ${ok ? 'OK  ' : 'BŁĄD'} ${a.nazwa.padEnd(70)} oczekiwane=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`
    );
  }
  if (bledy > 0) {
    console.error(`\n[verify-d4] FAIL: ${bledy} z ${asercje.length} asercji nie przeszło.`);
    process.exitCode = 1;
  } else console.log(`\n[verify-d4] PASS: wszystkie ${asercje.length} asercji przeszły.`);
}

// ============================================================================
// RESET — kasuje WYŁĄCZNIE to, co założył D4 w organizacji `northwind`
// ============================================================================
async function reset(c: PoolClient): Promise<string> {
  await c.query('BEGIN');
  try {
    const przesuniete = await c.query(
      `UPDATE initiative_milestones
          SET target_date = baseline_date, schedule_shift_count = 0, baseline_set_at = NULL, baseline_version = 1
        WHERE organization_id = $1 AND baseline_date IS NOT NULL`,
      [ORG_ID]
    );
    const migawki = await c.query('DELETE FROM execution_report_snapshots WHERE organization_id::text=$1', [ORG_ID]);
    const bazowe = await c.query('DELETE FROM plan_baselines WHERE organization_id=$1', [ORG_ID]);
    const raporty = await c.query('DELETE FROM status_reports WHERE organization_id=$1', [ORG_ID]);
    await c.query(
      `DELETE FROM decision_alternatives WHERE decision_id IN (SELECT id FROM decisions WHERE organization_id=$1)`,
      [ORG_ID]
    );
    await c.query(
      `DELETE FROM decision_history WHERE decision_id IN (SELECT id FROM decisions WHERE organization_id=$1)`,
      [ORG_ID]
    );
    await c.query(
      `DELETE FROM decision_impacts WHERE decision_id IN (SELECT id FROM decisions WHERE organization_id=$1)`,
      [ORG_ID]
    );
    // NAPRAWA PO AUTOMATYCZNEJ BLOKADZIE: wcześniejsze przebiegi D4 (przed
    // dołożeniem jawnego `impacts.isBlocker=false`) wstrzymywały inicjatywy
    // decyzją. Cofamy dokładnie to, co zostawił ten mechanizm — po znaczniku
    // `gate_type='DECISION_AUTO_BLOCK'`, a nie po zgadywaniu, która inicjatywa
    // „powinna" być wstrzymana.
    const odblokowane = await c.query<{ initiative_id: string }>(
      `SELECT DISTINCT h.initiative_id FROM initiative_status_history h
         JOIN initiatives i ON i.id = h.initiative_id
        WHERE i.organization_id = $1 AND h.gate_type = 'DECISION_AUTO_BLOCK'`,
      [ORG_ID]
    );
    if (odblokowane.rowCount) {
      await c.query(
        `UPDATE initiatives SET on_hold = FALSE, blocked_at = NULL, blocked_reason = NULL
          WHERE organization_id = $1 AND id = ANY($2::text[])`,
        [ORG_ID, odblokowane.rows.map((r) => r.initiative_id)]
      );
      await c.query(
        `DELETE FROM initiative_status_history h
          USING initiatives i
          WHERE i.id = h.initiative_id AND i.organization_id = $1 AND h.gate_type = 'DECISION_AUTO_BLOCK'`,
        [ORG_ID]
      );
    }
    const decyzje = await c.query('DELETE FROM decisions WHERE organization_id=$1', [ORG_ID]);
    await c.query(`DELETE FROM ie_aggregate_relations WHERE organization_id=$1 AND target_type='raid_item'`, [ORG_ID]);
    await c.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='raid_item'`, [ORG_ID]);
    // PARAGONY KOMEND — bez tego reset jest POZORNY. Zmierzone 08.09: po
    // `--reset` bez tej linii kolejny `--apply` dostawał z `POST …/raid-items/:id`
    // HTTP 200 „już wykonane" (idempotencja po `clientRequestId`,
    // `ie_command_receipts` PK `(organization_id, client_request_id)`), więc
    // meldunek mówił „utworzone=7", a w `raid_items` było ZERO wierszy.
    await c.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_type='raid_item'`, [ORG_ID]);
    await c.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1 AND aggregate_type='raid_item'`, [ORG_ID]);
    await c.query(`DELETE FROM ie_audit_events WHERE organization_id=$1 AND aggregate_type='raid_item'`, [ORG_ID]);
    const raid = await c.query('DELETE FROM raid_items WHERE organization_id=$1', [ORG_ID]);
    const zadania = await c.query(`DELETE FROM tasks WHERE ${ZADANIA_D4}`, [ORG_ID]);
    await c.query('COMMIT');
    return (
      `reset: usunięto ${zadania.rowCount} zadań, ${raid.rowCount} pozycji RAID (z agregatami), ` +
      `${decyzje.rowCount} decyzji (z opcjami i historią), ${raporty.rowCount} raportów statusu, ` +
      `${bazowe.rowCount} planów bazowych, ${migawki.rowCount} migawek; ` +
      `${przesuniete.rowCount} kamieni przywrócono do terminu z planu bazowego; ` +
      `${odblokowane.rowCount} inicjatyw odblokowano po DECISION_AUTO_BLOCK.`
    );
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main(): Promise<void> {
  const wspolne = czytajWspolneArgumenty(process.argv.slice(2));
  const opcje = czytajOpcjeD4(process.argv.slice(2), wspolne.hasloPlik);
  const url = wymaganyUrl();
  const cel = sprawdzCel(url, wspolne.oczekiwanyHost, wspolne.celZdalny);

  const pool = otworzPool(url);
  const c = await pool.connect();
  try {
    console.log(`[realizacja] cel:          ${cel}`);
    console.log(`[realizacja] organizacja:  ${ORG_NAZWA} (id ${ORG_ID})`);
    console.log(
      `[realizacja] tryb:         ${wspolne.tryb}${opcje.apiUrl ? ` (+ etap API ${opcje.apiUrl})` : ' (bez etapu API)'}`
    );

    if (wspolne.tryb === 'reset') {
      console.log(`[realizacja] ${await reset(c)}`);
      return;
    }
    if (wspolne.tryb === 'verify') {
      await weryfikuj(c);
      return;
    }

    const plan = await zbudujPlan(c);
    wypiszPlan(plan);

    if (wspolne.tryb === 'dry-run') {
      const doZmiany =
        plan.zadania.utworzy +
        plan.zadania.zaktualizuje +
        plan.raid.utworzy +
        plan.decyzje.utworzy +
        plan.raportyStatusu.utworzy +
        plan.planyBazowe.utworzy +
        plan.przesunieciaKamieni.utworzy +
        plan.migawki.utworzy;
      console.log(`\n[realizacja] dry-run: ${doZmiany} pozycji do zmiany. Nic nie zapisano.`);
      if (!opcje.apiUrl)
        console.log(
          '[realizacja] UWAGA: bez --api etap 2 (RAID przez kanonicznego writera, decyzje z opcjami i uzasadnieniem, migawki raportów) NIE wykona się.'
        );
      return;
    }

    const lic = await zapiszSql(c);
    console.log(`\n[realizacja/sql] ${lic.raport('realizacja/sql')}`);

    if (!opcje.apiUrl) {
      console.log(
        '[realizacja] UWAGA: bez --api NIE powstały: RAID, decyzje z opcjami, migawki raportów. `--verify` to zgłosi.'
      );
      return;
    }
    const api = new Api(opcje.apiUrl);
    await api.zaloguj(opcje.email, opcje.haslo!);
    const wynik = await etapApi(c, api);
    console.log(`[realizacja/api] RAID:     ${wynik.raid}`);
    console.log(`[realizacja/api] decyzje:  ${wynik.decyzje}`);
    console.log(`[realizacja/api] migawki:  ${wynik.migawki}`);
    if (wynik.stopy.length) {
      console.warn(`\n[realizacja/api] ${wynik.stopy.length} STOP produktu (nie usterka paczki):`);
      for (const st of wynik.stopy) console.warn(`  · ${st}`);
    }
    if (wynik.bledy.length) {
      console.error(`\n[realizacja/api] ${wynik.bledy.length} BŁĘDÓW:`);
      for (const b of wynik.bledy) console.error(`  · ${b}`);
      process.exitCode = 1;
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`\n[realizacja] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});

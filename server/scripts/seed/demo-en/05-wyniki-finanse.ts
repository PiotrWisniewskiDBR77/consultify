#!/usr/bin/env tsx
/**
 * D5 — SEED modułów WYNIKI i FINANSE organizacji „Northwind Manufacturing Ltd."
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D5, §3.1 poz. 8-9).
 *
 * Buduje po angielsku: 8 definicji KPI (pełny cykl życia do `active`) po
 * 6 pomiarów każda, 8 powiązań KPI↔inicjatywa, 1 program OKR z cyklem
 * kwartalnym 2026, 1 firmowy zestaw OKR z 3 celami i 6 kluczowymi wynikami,
 * 1 przypadek ROI dla „MES Rollout Line 3" (założenia, koszty, korzyści,
 * powiązania dowodowe z KPI, przebieg obliczeń), 1 paczkę sprawozdań
 * finansowych (4 kwartały, GBP) i 1 budżet programu z pozycjami.
 *
 * DWA ETAPY:
 *   ETAP API (`--api <url>`) — KPI, OKR, ROI i BUDŻET. Kanoniczni pisarze
 *                              przez HTTP, ten sam kod, który obsługuje
 *                              przeglądarkę.
 *   ETAP SQL                  — WYŁĄCZNIE paczka sprawozdań finansowych.
 *
 * STOP 1 (PLAN §D5) — KPI TYLKO PRZEZ API `POST /api/vnext/results/kpi`.
 * SQL gubi event-log (`rvn_platform_events`), outbox
 * (`rvn_platform_outbox`), CAS `row_version`, wersjonowanie
 * `rvn_kpi_definition_versions` oraz — decydująco — wiersz widoczności.
 *
 * STOP 2 (PLAN §D5) — WIDOCZNOŚĆ. `kpiRepository.ts:127-128` robi
 * `INNER JOIN rvn_visible_resources`: KPI bez wiersza w
 * `rvn_platform_resource_visibility` NIE POJAWI SIĘ na liście. Wiersz pisze
 * `kpiDefinitionCommands.ts:459-472` w tej samej transakcji co definicję,
 * po wcześniejszym bootstrapie polityki (`:358-374`). `--verify` liczy te
 * wiersze osobną asercją — nie zakłada ich istnienia.
 *
 * STOP 3 (ZMIERZONE 08.09, NIE W PLANIE) — modułu Wyniki NIE zobaczy konto
 * MEMBER ani MANAGER. `resultsInternalBetaVisibility.middleware.ts:7`
 * dopuszcza wyłącznie `OWNER` i `ADMIN` z `organization_members`, czyta rolę
 * z bazy przy KAŻDYM żądaniu i zwraca 403
 * `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED`. To bramka wcześniejsza niż
 * widoczność zasobu — pusta lista dla członka to NIE brak danych.
 * Pułapka przyrządu: ta sama bramka jest WYŁĄCZONA przy `NODE_ENV=test`
 * bez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` (`:26-32`), więc
 * stanowisko dowodowe D5 chodzi na `NODE_ENV=development` + `CI=true`.
 *
 * STOP 4 — FINANSE ZA `BetaGate`. `betaMenuStatus.ts:51`
 * `MODULE_ECONOMICS: 'closed'`, `BETA_ADMINS_EXEMPT = true` (`:32`), więc
 * moduł widzi WYŁĄCZNIE ADMIN/OWNER/SUPERADMIN. Zrzut Finansów robimy
 * z konta OWNER i to jest zapisane w meldunku.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/05-wyniki-finanse.ts \
 *       --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx … --oczekiwany-host 54418 --apply \
 *       --api http://127.0.0.1:4185 \
 *       --email james.whitfield@northwind.example \
 *       --email-zatwierdzajacy sarah.mitchell@northwind.example \
 *       --haslo-plik /private/tmp/dane-pokazowe-en/northwind-konta-d5.txt
 *   DATABASE_URL=… npx tsx … --oczekiwany-host 54418 --verify
 *   DATABASE_URL=… npx tsx … --oczekiwany-host 54418 --reset
 *
 * IDEMPOTENCJA: żadne id nie jest zgadywane — KPI szukamy po `kpi_code`,
 * OKR po nazwie/tytule, ROI po tytule, budżet po tytule, a sprawozdania po
 * deterministycznym UUIDv5 (`00-wspolne.ts:det`). Drugi `--apply` musi dać
 * `utworzono=0 zmieniono=0`.
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
  BUDZET,
  KPI,
  LINIE_PL,
  OKR_CELE,
  OKR_CYKL,
  OKR_PROGRAM,
  OKR_ZESTAW,
  OKRESY_POMIAROW,
  PACZKA_SPRAWOZDAN,
  RAPORT_KPI,
  ROI_PRZYPADEK,
  SPRAWOZDANIA,
  TYTUL_INICJATYWY,
  type KluczInicjatywy,
  type SlugOsoby,
} from './05-dane-wynikow';

// ============================================================================
// Argumenty własne paczki
// ============================================================================
interface OpcjeD5 {
  apiUrl: string | null;
  email: string;
  emailZatwierdzajacy: string;
  haslo: string | null;
}

function czytajOpcjeD5(argv: string[], hasloPlik: string): OpcjeD5 {
  let apiUrl: string | null = null;
  let email = `james.whitfield@${DOMENA}`;
  let emailZatwierdzajacy = `sarah.mitchell@${DOMENA}`;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--api') apiUrl = argv[++i] ?? null;
    else if (a.startsWith('--api=')) apiUrl = a.split('=').slice(1).join('=');
    else if (a === '--email') email = argv[++i] ?? email;
    else if (a.startsWith('--email=')) email = a.split('=').slice(1).join('=');
    else if (a === '--email-zatwierdzajacy') emailZatwierdzajacy = argv[++i] ?? emailZatwierdzajacy;
    else if (a.startsWith('--email-zatwierdzajacy='))
      emailZatwierdzajacy = a.split('=').slice(1).join('=');
  }
  let haslo: string | null = null;
  if (apiUrl) {
    // Hasło NIGDY z argumentu (trafiłoby do historii powłoki) — wyłącznie
    // z pliku poza repo, tego samego, do którego zapisał je `01-rdzen.ts`.
    const tresc = fs.readFileSync(hasloPlik, 'utf8');
    const m = tresc.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/);
    haslo = m?.[1]?.trim() ?? null;
    if (!haslo) throw new Error(`Nie znalazłem hasła w pliku ${hasloPlik}. Etap API nie ruszy.`);
  }
  return { apiUrl: apiUrl ? apiUrl.replace(/\/$/, '') : null, email, emailZatwierdzajacy, haslo };
}

// ============================================================================
// Klient API — logowanie i żądania (wzór z `03-inicjatywy.ts:707-753`)
// ============================================================================
const json = (v: unknown): string => JSON.stringify(v);

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
    const tresc = await r.text();
    if (!r.ok) throw new Error(`Logowanie ${email}: HTTP ${r.status} ${tresc.slice(0, 300)}`);
    const ciasteczka = r.headers.getSetCookie?.() ?? [];
    this.cookie = ciasteczka.map((c) => c.split(';')[0]).join('; ');
    const ciało = JSON.parse(tresc) as { token?: string; data?: { token?: string } };
    this.bearer = ciało.token ?? ciało.data?.token ?? '';
    if (!this.cookie && !this.bearer)
      throw new Error('Logowanie OK, ale ani ciasteczka, ani tokenu — etap API nie ruszy.');
  }

  async zadanie<T = unknown>(
    metoda: 'GET' | 'POST' | 'PATCH' | 'PUT',
    sciezka: string,
    ciało?: unknown,
    naglowki: Record<string, string> = {}
  ): Promise<{ status: number; body: T }> {
    const r = await fetch(`${this.base}${sciezka}`, {
      method: metoda,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
        ...naglowki,
      },
      ...(ciało === undefined ? {} : { body: json(ciało) }),
    });
    const tekst = await r.text();
    let body: unknown = tekst;
    try {
      body = JSON.parse(tekst);
    } catch {
      /* komunikat błędu bywa HTML-em — zostaw tekst */
    }
    return { status: r.status, body: body as T };
  }
}

/** Rzuca z czytelnym komunikatem, gdy pisarz odmówił — cichy błąd
 * w seedzie kończy się „ekran pusty, a skrypt zamelduje sukces". */
function wymagajOk(
  co: string,
  w: { status: number; body: unknown },
  dopuszczalne: number[] = [200, 201]
): void {
  if (!dopuszczalne.includes(w.status))
    throw new Error(`${co}: HTTP ${w.status} ${JSON.stringify(w.body).slice(0, 400)}`);
}

/** Deterministyczny klucz idempotencji — drugi `--apply` powtarza to samo
 * żądanie, a nie tworzy bliźniaka. */
const klucz = (co: string): string => `nw-d5-${co}`.slice(0, 200);

// ============================================================================
// Identyfikatory osób i inicjatyw — czytane z bazy, nie zakładane
// ============================================================================
const idOsoby = (slug: SlugOsoby) => det('user', `${slug}@${DOMENA}`);

async function idInicjatyw(c: PoolClient): Promise<Record<KluczInicjatywy, string>> {
  const mapa = {} as Record<KluczInicjatywy, string>;
  for (const [klucz_, tytul] of Object.entries(TYTUL_INICJATYWY) as Array<
    [KluczInicjatywy, string]
  >) {
    const r = await c.query<{ id: string }>(
      'SELECT id FROM initiatives WHERE organization_id = $1 AND title = $2 LIMIT 1',
      [ORG_ID, tytul]
    );
    const id = r.rows[0]?.id;
    if (!id)
      throw new Error(
        `Nie znalazłem inicjatywy „${tytul}" w organizacji „${ORG_ID}". Najpierw uruchom 03-inicjatywy.ts --apply (paczka D3).`
      );
    mapa[klucz_] = id;
  }
  return mapa;
}

async function idProjektu(c: PoolClient, nazwa: string): Promise<string> {
  const r = await c.query<{ id: string }>(
    'SELECT id FROM projects WHERE organization_id = $1 AND name = $2 LIMIT 1',
    [ORG_ID, nazwa]
  );
  const id = r.rows[0]?.id;
  if (!id) throw new Error(`Nie znalazłem projektu „${nazwa}". Uruchom 01-rdzen.ts --apply (D1).`);
  return id;
}

// ============================================================================
// ETAP API 1/4 — KPI (definicja → zgłoszenie → zatwierdzenie → aktywacja)
// ============================================================================
interface WynikKpi {
  utworzone: number;
  pominiete: number;
  pomiary: number;
  wplywy: number;
  /** kod KPI -> kpiId, potrzebne przy powiązaniach dowodowych ROI. */
  identyfikatory: Record<string, { kpiId: string; definitionVersionId: string }>;
}

async function etapKpi(
  c: PoolClient,
  wlasciciel: Api,
  zatwierdzajacy: Api,
  inicjatywy: Record<KluczInicjatywy, string>,
  lic: Licznik
): Promise<WynikKpi> {
  const w: WynikKpi = { utworzone: 0, pominiete: 0, pomiary: 0, wplywy: 0, identyfikatory: {} };

  for (const k of KPI) {
    const istnieje = await c.query<{ kpi_id: string; current_definition_version_id: string | null }>(
      'SELECT kpi_id, current_definition_version_id FROM rvn_kpi_definitions WHERE organization_id = $1 AND kpi_code = $2',
      [ORG_ID, k.kod]
    );

    let kpiId: string;
    let wersjaId: string;

    if (istnieje.rows[0]) {
      kpiId = istnieje.rows[0].kpi_id;
      wersjaId = istnieje.rows[0].current_definition_version_id ?? '';
      w.pominiete++;
      lic.pomin();
    } else {
      // 1. Wersja robocza. Wiersz widoczności powstaje TU (STOP 2).
      const utworz = await wlasciciel.zadanie<{
        kpi: { kpiId: string; rowVersion: number };
        definitionVersion: { definitionVersionId: string; rowVersion: number };
      }>('POST', '/api/vnext/results/kpi', {
        kpiCode: k.kod,
        name: k.nazwa,
        description: k.opis,
        unit: k.jednostka,
        targetGeometry: k.geometria,
        targetValue: k.targetValue,
        targetMin: k.targetMin,
        targetMax: k.targetMax,
        warningLow: k.warningLow,
        warningHigh: k.warningHigh,
        criticalLow: k.criticalLow,
        criticalHigh: k.criticalHigh,
        formulaText: k.formula,
        measurementFrequencyDays: k.czestotliwoscDni,
        ownerUserId: idOsoby(k.wlasciciel),
        idempotencyKey: klucz(`kpi-create-${k.kod}`),
        reason: 'Northwind 2027 transformation measurement set',
      });
      wymagajOk(`KPI ${k.kod} — utworzenie`, utworz);
      kpiId = utworz.body.kpi.kpiId;
      wersjaId = utworz.body.definitionVersion.definitionVersionId;

      // 2. Zgłoszenie do zatwierdzenia — CAS na WERSJI definicji.
      const zgloszenie = await wlasciciel.zadanie<{ resultingVersion: number }>(
        'POST',
        `/api/vnext/results/kpi/${kpiId}/submit`,
        {
          expectedVersion: utworz.body.definitionVersion.rowVersion,
          idempotencyKey: klucz(`kpi-submit-${k.kod}`),
          reason: 'Definition ready for review',
        }
      );
      wymagajOk(`KPI ${k.kod} — zgłoszenie`, zgloszenie);

      // 3. Zatwierdzenie — INNYM kontem. `SelfApprovalDeniedError`
      //    (`kpiDefinitionCommands.ts`) blokuje zatwierdzenie własnej wersji;
      //    to jest realna reguła maker-checker, nie formalność.
      const akcept = await zatwierdzajacy.zadanie<{ resultingVersion: number }>(
        'POST',
        `/api/vnext/results/kpi/${kpiId}/definition-versions/${wersjaId}/approve`,
        {
          expectedVersion: zgloszenie.body.resultingVersion,
          idempotencyKey: klucz(`kpi-approve-${k.kod}`),
          reason: 'Reviewed against the measurement policy',
        }
      );
      wymagajOk(`KPI ${k.kod} — zatwierdzenie`, akcept);

      // 4. Aktywacja — CAS na AGREGACIE KPI (inny licznik niż wersja
      //    definicji; podanie `resultingVersion` z kroku 3 daje 409
      //    STALE_VERSION — zmierzone 08.09).
      const aktywacja = await wlasciciel.zadanie(
        'POST',
        `/api/vnext/results/kpi/${kpiId}/activate`,
        {
          expectedVersion: utworz.body.kpi.rowVersion,
          idempotencyKey: klucz(`kpi-activate-${k.kod}`),
          reason: 'Approved definition in force',
        }
      );
      wymagajOk(`KPI ${k.kod} — aktywacja`, aktywacja);

      w.utworzone++;
      lic.utworz();
    }

    w.identyfikatory[k.kod] = { kpiId, definitionVersionId: wersjaId };

    // 5. Pomiary — tabela jest append-only, więc bez CAS. Dokładamy tylko
    //    brakujące okresy (idempotencja po `period_start`).
    for (let i = 0; i < OKRESY_POMIAROW.length; i++) {
      const okres = OKRESY_POMIAROW[i]!;
      const jest = await c.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_measurements
          WHERE organization_id = $1 AND kpi_id = $2 AND period_start = $3::timestamptz`,
        [ORG_ID, kpiId, okres.od]
      );
      if (Number(jest.rows[0]?.n ?? 0) > 0) {
        lic.pomin();
        continue;
      }
      const pomiar = await wlasciciel.zadanie(
        'POST',
        `/api/vnext/results/kpi/${kpiId}/measurements`,
        {
          periodStart: okres.od,
          periodEnd: okres.do,
          actualValue: k.pomiary[i]!,
          source: k.zrodloPomiaru,
          notes: `${okres.etykieta} reading, reviewed at the monthly performance meeting.`,
          idempotencyKey: klucz(`kpi-meas-${k.kod}-${i}`),
        }
      );
      wymagajOk(`KPI ${k.kod} — pomiar ${okres.etykieta}`, pomiar);
      w.pomiary++;
      lic.utworz();
    }

    // 6. Powiązanie KPI z inicjatywą — to jest to, co łączy Wyniki
    //    z Inicjatywami D3 (`rvn_kpi_initiative_impacts`).
    const wplyw = await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM rvn_kpi_initiative_impacts
        WHERE organization_id = $1 AND kpi_id = $2 AND initiative_id = $3`,
      [ORG_ID, kpiId, inicjatywy[k.inicjatywa]]
    );
    if (Number(wplyw.rows[0]?.n ?? 0) > 0) {
      lic.pomin();
    } else {
      const odp = await wlasciciel.zadanie(
        'POST',
        '/api/vnext/results/kpi/initiative-impacts',
        {
          kpiId,
          initiativeId: inicjatywy[k.inicjatywa],
          expectedContributionValue: k.wkladOczekiwany,
          expectedContributionDirection: k.kierunekWplywu,
          targetCompletionDate: '2026-12-31T00:00:00.000Z',
          idempotencyKey: klucz(`kpi-impact-${k.kod}`),
          reason: 'Expected contribution agreed at the initiative kick-off',
        }
      );
      wymagajOk(`KPI ${k.kod} — powiązanie z inicjatywą`, odp);
      w.wplywy++;
      lic.utworz();
    }
  }

  return w;
}

// ============================================================================
// ETAP API — RAPORT KPI (karta wyników), czyli POZIOM 1 zakładki „KPI"
//
// Bez tego zakładka pokazuje „No KPI reports yet" mimo ośmiu aktywnych
// definicji: `ResultsKpiRegistryPage.tsx:908` startuje na zakładce
// `scorecards`, a definicje żyją dopiero pod `my`/`org`.
// ============================================================================
async function etapRaportKpi(
  c: PoolClient,
  wlasciciel: Api,
  kpiIdentyfikatory: Record<string, { kpiId: string; definitionVersionId: string }>,
  lic: Licznik
): Promise<{ raport: string; pozycje: number }> {
  const w = { raport: 'bez zmian', pozycje: 0 };

  let scorecardId: string;
  let wersja: number;
  const istnieje = await c.query<{ scorecard_id: string; row_version: number }>(
    'SELECT scorecard_id, row_version FROM rvn_kpi_scorecards WHERE organization_id = $1 AND name = $2',
    [ORG_ID, RAPORT_KPI.nazwa]
  );
  if (istnieje.rows[0]) {
    scorecardId = istnieje.rows[0].scorecard_id;
    wersja = Number(istnieje.rows[0].row_version);
    lic.pomin();
  } else {
    const utworz = await wlasciciel.zadanie<{ scorecard: { scorecardId: string; rowVersion: number } }>(
      'POST',
      '/api/vnext/results/kpi/scorecards',
      {
        name: RAPORT_KPI.nazwa,
        description: RAPORT_KPI.opis,
        scopeType: RAPORT_KPI.scopeType,
        scopeId: ORG_ID,
        ownerUserId: idOsoby(RAPORT_KPI.wlasciciel),
        reviewFrequency: RAPORT_KPI.reviewFrequency,
        idempotencyKey: klucz('kpi-scorecard'),
      }
    );
    wymagajOk('Raport KPI — utworzenie', utworz);
    scorecardId = utworz.body.scorecard.scorecardId;
    wersja = utworz.body.scorecard.rowVersion;
    w.raport = 'utworzony';
    lic.utworz();
  }

  for (let i = 0; i < RAPORT_KPI.pozycje.length; i++) {
    const poz = RAPORT_KPI.pozycje[i]!;
    const kpiRef = kpiIdentyfikatory[poz.kod];
    if (!kpiRef) continue;
    const jest = await c.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecard_items WHERE organization_id = $1 AND scorecard_id = $2 AND kpi_id = $3',
      [ORG_ID, scorecardId, kpiRef.kpiId]
    );
    if (Number(jest.rows[0]?.n ?? 0) > 0) {
      lic.pomin();
      continue;
    }
    const odp = await wlasciciel.zadanie<{ resultingVersion: number }>(
      'POST',
      `/api/vnext/results/kpi/scorecards/${scorecardId}/items`,
      {
        expectedVersion: wersja,
        kpiId: kpiRef.kpiId,
        role: poz.rola,
        sortOrder: i + 1,
        idempotencyKey: klucz(`kpi-scorecard-item-${poz.kod}`),
      }
    );
    wymagajOk(`Raport KPI — pozycja ${poz.kod}`, odp);
    wersja = odp.body.resultingVersion ?? wersja + 1;
    w.pozycje++;
    lic.utworz();
  }

  // Raport w stanie `draft` jest w rejestrze, ale bez „active" nie wygląda
  // na dokument, który ktokolwiek prowadzi.
  const stan = await c.query<{ lifecycle_status: string; row_version: number }>(
    'SELECT lifecycle_status, row_version FROM rvn_kpi_scorecards WHERE scorecard_id = $1',
    [scorecardId]
  );
  if (stan.rows[0]?.lifecycle_status === 'draft') {
    const odp = await wlasciciel.zadanie(
      'POST',
      `/api/vnext/results/kpi/scorecards/${scorecardId}/activate`,
      { expectedVersion: Number(stan.rows[0].row_version), idempotencyKey: klucz('kpi-scorecard-activate') }
    );
    wymagajOk('Raport KPI — aktywacja', odp);
    w.raport = w.raport === 'bez zmian' ? 'aktywowany' : 'utworzony i aktywny';
    lic.zmien();
  }

  return w;
}

// ============================================================================
// ETAP API 2/4 — OKR (program → cykl → zestaw → cele → kluczowe wyniki)
// ============================================================================
interface WynikOkr {
  program: string;
  cykl: string;
  zestaw: string;
  cele: number;
  kluczoweWyniki: number;
}

async function etapOkr(
  c: PoolClient,
  wlasciciel: Api,
  administrator: Api,
  lic: Licznik
): Promise<WynikOkr> {
  const w: WynikOkr = { program: 'bez zmian', cykl: 'bez zmian', zestaw: 'bez zmian', cele: 0, kluczoweWyniki: 0 };

  // --- Program (tylko ADMIN — `okr.routes.ts:500` requireOrgRole) ---------
  let programId: string;
  const pIstnieje = await c.query<{ program_id: string; status: string }>(
    'SELECT program_id, status FROM okr_vnext_programs WHERE organization_id = $1 AND name = $2',
    [ORG_ID, OKR_PROGRAM.nazwa]
  );
  if (pIstnieje.rows[0]) {
    programId = pIstnieje.rows[0].program_id;
    lic.pomin();
  } else {
    // WSZYSTKIE pola polityki jawnie — kolumny są NOT NULL, a komenda
    // wstawia dokładnie to, co przyszło. Brak pola = 500 (zmierzone 08.09,
    // `annual_direction_enabled violates not-null constraint`).
    const utworz = await administrator.zadanie<{ program: { programId: string; rowVersion: number } }>(
      'POST',
      '/api/vnext/results/okr/programs',
      { name: OKR_PROGRAM.nazwa, ...OKR_PROGRAM.polityka, idempotencyKey: klucz('okr-program') }
    );
    wymagajOk('OKR — program', utworz);
    programId = utworz.body.program.programId;
    const publikacja = await administrator.zadanie(
      'POST',
      `/api/vnext/results/okr/programs/${programId}/publish`,
      { expectedVersion: utworz.body.program.rowVersion, idempotencyKey: klucz('okr-program-publish') }
    );
    wymagajOk('OKR — publikacja programu', publikacja);
    w.program = 'utworzony i opublikowany';
    lic.utworz();
  }

  // --- Cykl --------------------------------------------------------------
  let cyklId: string;
  const cIstnieje = await c.query<{ cycle_id: string }>(
    'SELECT cycle_id FROM okr_vnext_cycles WHERE organization_id = $1 AND program_id = $2 AND name = $3',
    [ORG_ID, programId, OKR_CYKL.name]
  );
  if (cIstnieje.rows[0]) {
    cyklId = cIstnieje.rows[0].cycle_id;
    lic.pomin();
  } else {
    const utworz = await administrator.zadanie<{ cycle: { cycleId: string; rowVersion: number } }>(
      'POST',
      '/api/vnext/results/okr/cycles',
      { programId, ...OKR_CYKL, idempotencyKey: klucz('okr-cycle') }
    );
    wymagajOk('OKR — cykl', utworz);
    cyklId = utworz.body.cycle.cycleId;
    // Cykl musi przejść przez `drafting` do `active`, inaczej zestaw nie ma
    // gdzie żyć, a zakładka pokazuje pusty kwartał.
    const draft = await administrator.zadanie<{ resultingVersion: number }>(
      'POST',
      `/api/vnext/results/okr/cycles/${cyklId}/open-drafting`,
      { expectedVersion: utworz.body.cycle.rowVersion, idempotencyKey: klucz('okr-cycle-draft') }
    );
    wymagajOk('OKR — otwarcie redakcji cyklu', draft);
    const aktywacja = await administrator.zadanie(
      'POST',
      `/api/vnext/results/okr/cycles/${cyklId}/activate`,
      { expectedVersion: draft.body.resultingVersion, idempotencyKey: klucz('okr-cycle-activate') }
    );
    wymagajOk('OKR — aktywacja cyklu', aktywacja);
    w.cykl = 'utworzony i aktywny';
    lic.utworz();
  }

  // --- Zestaw ------------------------------------------------------------
  let zestawId: string;
  const zIstnieje = await c.query<{ set_id: string }>(
    'SELECT set_id FROM okr_vnext_sets WHERE organization_id = $1 AND cycle_id = $2 AND title = $3',
    [ORG_ID, cyklId, OKR_ZESTAW.tytul]
  );
  if (zIstnieje.rows[0]) {
    zestawId = zIstnieje.rows[0].set_id;
    lic.pomin();
  } else {
    const utworz = await wlasciciel.zadanie<{ set: { setId: string } }>(
      'POST',
      '/api/vnext/results/okr/sets',
      {
        programId,
        cycleId: cyklId,
        scopeType: OKR_ZESTAW.scopeType,
        // Dla `scope_type='company'` obowiązkowo id organizacji — serwer go
        // NIE domyśla (`resultsVnextOkr.validators.ts` komentarz D4).
        scopeId: ORG_ID,
        ownerUserId: idOsoby(OKR_ZESTAW.wlasciciel),
        reviewerUserId: idOsoby(OKR_ZESTAW.recenzent),
        title: OKR_ZESTAW.tytul,
        idempotencyKey: klucz('okr-set'),
      }
    );
    wymagajOk('OKR — zestaw', utworz);
    zestawId = utworz.body.set.setId;
    w.zestaw = 'utworzony';
    lic.utworz();
  }

  // --- Cele i kluczowe wyniki --------------------------------------------
  for (const cel of OKR_CELE) {
    let celId: string;
    const oIstnieje = await c.query<{ objective_id: string }>(
      'SELECT objective_id FROM okr_vnext_objectives WHERE organization_id = $1 AND set_id = $2 AND title = $3',
      [ORG_ID, zestawId, cel.tytul]
    );
    if (oIstnieje.rows[0]) {
      celId = oIstnieje.rows[0].objective_id;
      lic.pomin();
    } else {
      const utworz = await wlasciciel.zadanie<{ objective: { objectiveId: string } }>(
        'POST',
        `/api/vnext/results/okr/sets/${zestawId}/objectives`,
        {
          ownerUserId: idOsoby(cel.wlasciciel),
          title: cel.tytul,
          description: cel.opis,
          rationale: cel.uzasadnienie,
          ambitionType: cel.ambicja,
          idempotencyKey: klucz(`okr-obj-${cel.tytul.slice(0, 40)}`),
        }
      );
      wymagajOk(`OKR — cel „${cel.tytul}"`, utworz);
      celId = utworz.body.objective.objectiveId;
      w.cele++;
      lic.utworz();
    }

    for (const kr of cel.kluczoweWyniki) {
      const krIstnieje = await c.query<{ n: string }>(
        'SELECT COUNT(*)::text AS n FROM okr_vnext_key_results WHERE organization_id = $1 AND objective_id = $2 AND title = $3',
        [ORG_ID, celId, kr.tytul]
      );
      if (Number(krIstnieje.rows[0]?.n ?? 0) > 0) {
        lic.pomin();
        continue;
      }
      const utworz = await wlasciciel.zadanie(
        'POST',
        `/api/vnext/results/okr/objectives/${celId}/key-results`,
        {
          ownerUserId: idOsoby(kr.wlasciciel),
          title: kr.tytul,
          description: kr.opis,
          measurementType: kr.measurementType,
          direction: kr.direction,
          unit: kr.jednostka,
          baselineValue: kr.baselineValue,
          targetValue: kr.targetValue,
          startValue: kr.baselineValue,
          currentValue: kr.currentValue,
          confidence: kr.confidence,
          sourceType: 'manual',
          sourceReference: 'Monthly performance pack',
          weight: kr.waga,
          idempotencyKey: klucz(`okr-kr-${kr.tytul.slice(0, 40)}`),
        }
      );
      wymagajOk(`OKR — kluczowy wynik „${kr.tytul}"`, utworz);
      w.kluczoweWyniki++;
      lic.utworz();
    }
  }

  return w;
}

// ============================================================================
// ETAP API 3/4 — ROI (przypadek → polityka → założenia → koszty → korzyści)
// ============================================================================
interface WynikRoi {
  politykaWidocznosci: string;
  przypadek: string;
  stan: string;
  zalozenia: number;
  koszty: number;
  korzysci: number;
  powiazaniaKpi: number;
  przebieg: string;
}

async function etapRoi(
  c: PoolClient,
  wlasciciel: Api,
  inicjatywy: Record<KluczInicjatywy, string>,
  kpiIdentyfikatory: Record<string, { kpiId: string; definitionVersionId: string }>,
  lic: Licznik
): Promise<WynikRoi> {
  const w: WynikRoi = {
    politykaWidocznosci: 'już opublikowana',
    przypadek: 'bez zmian',
    stan: 'bez zmian',
    zalozenia: 0,
    koszty: 0,
    korzysci: 0,
    powiazaniaKpi: 0,
    przebieg: 'pominięty (przypadek istniał)',
  };

  // Domena ROI jest fail-closed: bez wiersza w `rvn_roi_visibility_governance`
  // nawet ACTIVE OWNER dostaje 403 `ROI_CASE_CREATION_NOT_AUTHORIZED`, a rejestr
  // pokazuje „brak spraw ROI" zamiast błędu (`visibilityResolver.ts:827-838` —
  // zmierzone na żywo 05.09 na DBR77 i powtórzone tutaj 08.09). Publikacja
  // polityki to WARUNEK KONIECZNY, nie ozdoba.
  const politykaJest = await c.query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM rvn_roi_visibility_governance WHERE organization_id = $1',
    [ORG_ID]
  );
  if (Number(politykaJest.rows[0]?.n ?? 0) === 0) {
    const odp = await wlasciciel.zadanie('POST', '/api/vnext/results/roi/visibility-policy', {
      idempotencyKey: klucz('roi-visibility-policy'),
    });
    wymagajOk('ROI — publikacja polityki widoczności domeny', odp);
    w.politykaWidocznosci = 'opublikowana';
    lic.utworz();
  } else {
    lic.pomin();
  }

  let caseId: string;
  let wersjaPrzypadku: number;
  const istnieje = await c.query<{ case_id: string; row_version: number }>(
    'SELECT case_id, row_version FROM rvn_roi_cases WHERE organization_id = $1 AND title = $2',
    [ORG_ID, ROI_PRZYPADEK.tytul]
  );
  if (istnieje.rows[0]) {
    caseId = istnieje.rows[0].case_id;
    wersjaPrzypadku = Number(istnieje.rows[0].row_version);
    lic.pomin();
  } else {
    const utworz = await wlasciciel.zadanie<{ case: { caseId: string; rowVersion: number } }>(
      'POST',
      '/api/vnext/results/roi/cases',
      {
        initiativeId: inicjatywy[ROI_PRZYPADEK.inicjatywa],
        title: ROI_PRZYPADEK.tytul,
        ownerUserId: idOsoby(ROI_PRZYPADEK.wlasciciel),
        currency: ROI_PRZYPADEK.waluta,
        granularity: ROI_PRZYPADEK.granularity,
        analysisStart: ROI_PRZYPADEK.analysisStart,
        analysisEnd: ROI_PRZYPADEK.analysisEnd,
        idempotencyKey: klucz('roi-case'),
        reason: 'Steering group requested a full investment case before the Line 3 go-live',
      }
    );
    wymagajOk('ROI — przypadek', utworz);
    caseId = utworz.body.case.caseId;
    wersjaPrzypadku = utworz.body.case.rowVersion;
    w.przypadek = 'utworzony';
    lic.utworz();

    const polityka = await wlasciciel.zadanie<{ resultingVersion: number }>(
      'PUT',
      `/api/vnext/results/roi/cases/${caseId}/calculation-policy`,
      {
        expectedVersion: wersjaPrzypadku,
        ...ROI_PRZYPADEK.polityka,
        ownerUserId: idOsoby(ROI_PRZYPADEK.wlasciciel),
        idempotencyKey: klucz('roi-policy'),
      }
    );
    wymagajOk('ROI — polityka obliczeń', polityka);
    wersjaPrzypadku = polityka.body.resultingVersion ?? wersjaPrzypadku;
  }

  for (const z of ROI_PRZYPADEK.zalozenia) {
    const jest = await c.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM rvn_roi_assumptions WHERE organization_id = $1 AND case_id = $2 AND label = $3',
      [ORG_ID, caseId, z.label]
    );
    if (Number(jest.rows[0]?.n ?? 0) > 0) {
      lic.pomin();
      continue;
    }
    const odp = await wlasciciel.zadanie(
      'POST',
      `/api/vnext/results/roi/cases/${caseId}/assumptions`,
      { ...z, ownerUserId: idOsoby(ROI_PRZYPADEK.wlasciciel), idempotencyKey: klucz(`roi-assum-${z.label.slice(0, 40)}`) }
    );
    wymagajOk(`ROI — założenie „${z.label}"`, odp);
    w.zalozenia++;
    lic.utworz();
  }

  for (const k of ROI_PRZYPADEK.kosztyLinie) {
    const jest = await c.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM rvn_roi_cost_lines WHERE organization_id = $1 AND case_id = $2 AND label = $3',
      [ORG_ID, caseId, k.label]
    );
    if (Number(jest.rows[0]?.n ?? 0) > 0) {
      lic.pomin();
      continue;
    }
    const odp = await wlasciciel.zadanie(
      'POST',
      `/api/vnext/results/roi/cases/${caseId}/cost-lines`,
      {
        ...k,
        currency: ROI_PRZYPADEK.waluta,
        ownerUserId: idOsoby(ROI_PRZYPADEK.wlasciciel),
        idempotencyKey: klucz(`roi-cost-${k.label.slice(0, 40)}`),
      }
    );
    wymagajOk(`ROI — koszt „${k.label}"`, odp);
    w.koszty++;
    lic.utworz();
  }

  for (const b of ROI_PRZYPADEK.korzysciLinie) {
    const { kpi, celWiazania, ...linia } = b;
    let benefitLineId: string;
    const jest = await c.query<{ benefit_line_id: string }>(
      'SELECT benefit_line_id FROM rvn_roi_benefit_lines WHERE organization_id = $1 AND case_id = $2 AND label = $3',
      [ORG_ID, caseId, b.label]
    );
    if (jest.rows[0]) {
      benefitLineId = jest.rows[0].benefit_line_id;
      lic.pomin();
    } else {
      const odp = await wlasciciel.zadanie<{ benefitLine: { benefitLineId: string } }>(
        'POST',
        `/api/vnext/results/roi/cases/${caseId}/benefit-lines`,
        {
          ...linia,
          isFinancial: true,
          currency: ROI_PRZYPADEK.waluta,
          ownerUserId: idOsoby(ROI_PRZYPADEK.wlasciciel),
          idempotencyKey: klucz(`roi-benefit-${b.label.slice(0, 40)}`),
        }
      );
      wymagajOk(`ROI — korzyść „${b.label}"`, odp);
      benefitLineId = odp.body.benefitLine.benefitLineId;
      w.korzysci++;
      lic.utworz();
    }

    // Powiązanie dowodowe korzyść -> KPI. To jest to, co sprawia, że ROI
    // nie jest osobną wyspą, tylko czyta pomiar z Wyników.
    const kpiRef = kpiIdentyfikatory[kpi];
    if (!kpiRef?.definitionVersionId) continue;
    const link = await c.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1 AND benefit_line_id = $2 AND kpi_id = $3',
      [ORG_ID, benefitLineId, kpiRef.kpiId]
    );
    if (Number(link.rows[0]?.n ?? 0) > 0) {
      lic.pomin();
      continue;
    }
    const odp = await wlasciciel.zadanie(
      'POST',
      `/api/vnext/results/roi/cases/${caseId}/benefit-lines/${benefitLineId}/kpi-evidence-links`,
      {
        kpiId: kpiRef.kpiId,
        pinnedKpiDefinitionVersionId: kpiRef.definitionVersionId,
        purpose: celWiazania,
        notes: 'Benefit is measured by this KPI; the definition version is pinned at commitment.',
        idempotencyKey: klucz(`roi-evid-${b.label.slice(0, 40)}`),
      }
    );
    wymagajOk(`ROI — powiązanie dowodowe „${b.label}"`, odp);
    w.powiazaniaKpi++;
    lic.utworz();
  }

  // Przejście do modelowania — przebieg obliczeń jest dozwolony WYŁĄCZNIE
  // w stanie `modeling` albo `ready_for_review` (409 `CASE_NOT_RUNNABLE`
  // w `draft`, zmierzone 08.09). Wersję czytamy z bazy, bo mogła urosnąć
  // przy zapisie polityki i linii.
  const stan = await c.query<{ status: string; row_version: number }>(
    'SELECT status, row_version FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2',
    [caseId, ORG_ID]
  );
  if (stan.rows[0]?.status === 'draft') {
    const odp = await wlasciciel.zadanie(
      'POST',
      `/api/vnext/results/roi/cases/${caseId}/transitions/start-modeling`,
      {
        expectedVersion: Number(stan.rows[0].row_version),
        idempotencyKey: klucz('roi-start-modeling'),
        reason: 'Cost and benefit lines captured; ready to model',
      }
    );
    wymagajOk('ROI — przejście do modelowania', odp);
    w.stan = 'modeling';
    lic.zmien();
  }

  // Przebieg obliczeń — bez niego karta ROI nie ma NPV/IRR/payback.
  const przebiegi = await c.query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM rvn_roi_calculation_runs WHERE organization_id = $1 AND case_id = $2',
    [ORG_ID, caseId]
  );
  if (Number(przebiegi.rows[0]?.n ?? 0) > 0) {
    w.przebieg = 'już istniał';
    lic.pomin();
  } else {
    const odp = await wlasciciel.zadanie<{ run?: { status?: string; simpleRoi?: number } }>(
      'POST',
      `/api/vnext/results/roi/cases/${caseId}/calculation-runs`,
      { idempotencyKey: klucz('roi-run') }
    );
    wymagajOk('ROI — przebieg obliczeń', odp);
    w.przebieg = `policzony (status ${odp.body.run?.status ?? 'nieznany'})`;
    lic.utworz();
  }

  return w;
}

// ============================================================================
// ETAP API 4/4 — BUDŻET (kanoniczny pisarz v8, potem pozycje i inicjatywy)
// ============================================================================
interface WynikBudzetu {
  budzet: string;
  pozycje: number;
  powiazaniaInicjatyw: number;
}

async function etapBudzet(
  c: PoolClient,
  wlasciciel: Api,
  inicjatywy: Record<KluczInicjatywy, string>,
  lic: Licznik
): Promise<WynikBudzetu> {
  const w: WynikBudzetu = { budzet: 'bez zmian', pozycje: 0, powiazaniaInicjatyw: 0 };

  let budgetId: string;
  const istnieje = await c.query<{ id: string }>(
    'SELECT id FROM budgets WHERE organization_id = $1 AND title = $2',
    [ORG_ID, BUDZET.tytul]
  );
  if (istnieje.rows[0]) {
    budgetId = istnieje.rows[0].id;
    lic.pomin();
  } else {
    const projektId = await idProjektu(c, BUDZET.projekt);
    // `registerBudget` wymaga nagłówka `Idempotency-Key` (400 bez niego)
    // i zakłada w JEDNEJ transakcji budżet + 15 pozycji + 3 scenariusze
    // + receptę. SQL ominąłby receptę i inwariant 15/3.
    const odp = await wlasciciel.zadanie<{ data: { budget: { id: string } } }>(
      'POST',
      '/api/v8/finance/budgets',
      {
        title: BUDZET.tytul,
        description: BUDZET.opis,
        projectId: projektId,
        periodStart: BUDZET.periodStart,
        periodEnd: BUDZET.periodEnd,
        granularity: BUDZET.granularity,
        currency: BUDZET.waluta,
        sourceKind: 'manual',
      },
      { 'Idempotency-Key': klucz('budget') }
    );
    wymagajOk('Budżet — rejestracja', odp);
    budgetId = odp.body.data.budget.id;
    w.budzet = 'utworzony (15 pozycji, 3 scenariusze)';
    lic.utworz();
  }

  // Wartości bazowe pozycji — pisarz zakłada je z zerami.
  const pozycje = await c.query<{ id: string; line_code: string; baseline_value: string | null }>(
    'SELECT id, line_code, baseline_value FROM budget_lines WHERE budget_id = $1',
    [budgetId]
  );
  for (const p of pozycje.rows) {
    const docelowa = BUDZET.wartosciLinii[p.line_code];
    if (!docelowa) continue;
    if (Number(p.baseline_value ?? 0) === Number(docelowa)) {
      lic.pomin();
      continue;
    }
    // `expectedVersion` to wersja BUDŻETU, nie pozycji, i rośnie po KAŻDYM
    // zapisie pozycji (409 `BUDGET_VERSION_CONFLICT` przy stałej jedynce —
    // zmierzone 08.09). Czytamy ją z bazy przed każdym żądaniem.
    const wersja = await c.query<{ version: number }>('SELECT version FROM budgets WHERE id = $1', [budgetId]);
    const odp = await wlasciciel.zadanie(
      // PUT, nie PATCH — `finance.routes.ts:1986` (zmierzone: PATCH daje 404).
      'PUT',
      `/api/v8/finance/budgets/${budgetId}/lines/${p.id}`,
      { expectedVersion: Number(wersja.rows[0]?.version ?? 1), baselineValue: docelowa, source: 'manual' },
      { 'Idempotency-Key': klucz(`budget-line-${p.line_code}`) }
    );
    wymagajOk(`Budżet — pozycja ${p.line_code}`, odp);
    w.pozycje++;
    lic.zmien();
  }

  // Powiązania z inicjatywami D3 — „budżet programu per inicjatywa".
  for (const klucz_ of BUDZET.inicjatywy) {
    const inicjatywaId = inicjatywy[klucz_];
    const jest = await c.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM budget_initiative_links WHERE budget_id = $1 AND initiative_id = $2',
      [budgetId, inicjatywaId]
    );
    if (Number(jest.rows[0]?.n ?? 0) > 0) {
      lic.pomin();
      continue;
    }
    const wersja = await c.query<{ version: number }>('SELECT version FROM budgets WHERE id = $1', [budgetId]);
    const odp = await wlasciciel.zadanie(
      'POST',
      `/api/v8/finance/budgets/${budgetId}/initiatives/${inicjatywaId}`,
      { expectedVersion: Number(wersja.rows[0]?.version ?? 1) },
      { 'Idempotency-Key': klucz(`budget-init-${klucz_}`) }
    );
    wymagajOk(`Budżet — powiązanie z inicjatywą ${klucz_}`, odp);
    w.powiazaniaInicjatyw++;
    lic.utworz();
  }

  return w;
}

// ============================================================================
// ETAP SQL — paczka sprawozdań finansowych
//
// DLACZEGO SQL, a nie API: nie istnieje żaden `POST /statement-packs`.
// Paczka powstaje WYŁĄCZNIE jako efekt uboczny importu pliku
// (`finance-statements.routes.ts:693` `syncStatementToPack` po
// `POST /api/finance-statements/upload`), a seed nie ma pliku źródłowego.
// Wzór SQL-owy jest kanoniczny i już w repo:
// `server/src/services/demo/atelierFinanceSeed.ts` (te same tabele).
// ============================================================================
const idPaczki = () => det('fin-pack', PACZKA_SPRAWOZDAN.slug);
const idSprawozdania = (slug: string) => det('fin-stmt', `${PACZKA_SPRAWOZDAN.slug}|${slug}`);
const idWartosci = (slug: string, linia: string) =>
  det('fin-val', `${PACZKA_SPRAWOZDAN.slug}|${slug}|${linia}`);

async function etapSprawozdania(c: PoolClient, lic: Licznik): Promise<{ paczka: string; sprawozdania: number; wartosci: number }> {
  const wynik = { paczka: 'bez zmian', sprawozdania: 0, wartosci: 0 };
  const packId = idPaczki();

  await c.query('BEGIN');
  try {
    const paczkaJest = await c.query('SELECT 1 FROM financial_statement_packs WHERE id = $1', [packId]);
    if (paczkaJest.rows.length === 0) {
      await c.query(
        `INSERT INTO financial_statement_packs
           (id, organization_id, entity_name, period_start, period_end, period_label, currency,
            scaling, pack_status, pack_readiness_status, pack_readiness_score,
            pack_quality_summary, source_statement_count, missing_statement_types,
            aggregate_scope, version)
         VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8,'ready','ready',1,$9,$10,'','company',1)`,
        [
          packId,
          ORG_ID,
          PACZKA_SPRAWOZDAN.entityName,
          PACZKA_SPRAWOZDAN.periodStart,
          PACZKA_SPRAWOZDAN.periodEnd,
          PACZKA_SPRAWOZDAN.periodLabel,
          PACZKA_SPRAWOZDAN.currency,
          PACZKA_SPRAWOZDAN.scaling,
          'Four consecutive quarterly income statements, mapped to the canonical chart and reconciled against the management accounts.',
          SPRAWOZDANIA.length,
        ]
      );
      wynik.paczka = 'utworzona';
      lic.utworz();
    } else {
      lic.pomin();
    }

    for (const s of SPRAWOZDANIA) {
      const stmtId = idSprawozdania(s.slug);
      const jest = await c.query('SELECT 1 FROM financial_statements WHERE id = $1', [stmtId]);
      if (jest.rows.length === 0) {
        await c.query(
          `INSERT INTO financial_statements
             (id, organization_id, entity_name, statement_type, period_start, period_end,
              period_label, currency, scaling, parse_method, overall_confidence,
              validation_status, status, notes, readiness_status, readiness_score,
              document_class, values_version, statement_pack_id)
           VALUES ($1,$2,$3,'P&L',$4::date,$5::date,$6,$7,$8,'manual',1,
                   'pass','confirmed',$9,'ready',1,'spreadsheet',1,$10)`,
          [
            stmtId,
            ORG_ID,
            PACZKA_SPRAWOZDAN.entityName,
            s.periodStart,
            s.periodEnd,
            s.periodLabel,
            PACZKA_SPRAWOZDAN.currency,
            PACZKA_SPRAWOZDAN.scaling,
            `Quarterly income statement for ${s.periodLabel}, taken from the management accounts and mapped to the canonical chart of accounts.`,
            packId,
          ]
        );
        wynik.sprawozdania++;
        lic.utworz();
      } else {
        lic.pomin();
      }

      for (let i = 0; i < LINIE_PL.length; i++) {
        const linia = LINIE_PL[i]!;
        const valId = idWartosci(s.slug, linia.id);
        const jestW = await c.query('SELECT 1 FROM financial_statement_values WHERE id = $1', [valId]);
        if (jestW.rows.length > 0) {
          lic.pomin();
          continue;
        }
        await c.query(
          `INSERT INTO financial_statement_values
             (id, statement_id, canonical_line_id, original_label, value, confidence,
              mapping_status, is_non_financial, value_origin, mapping_confidence,
              period_granularity, period_label, presentation_view, dimension_key)
           VALUES ($1,$2,$3,$4,$5,1,'manual',FALSE,'source',1,'quarterly',$6,'by_function','')`,
          [valId, stmtId, linia.id, linia.etykieta, s.wartosci[i]!, s.periodLabel]
        );
        wynik.wartosci++;
        lic.utworz();
      }
    }

    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
  return wynik;
}

// ============================================================================
// PLAN — liczony z bazy, nie zakładany
// ============================================================================
async function zbudujPlan(c: PoolClient): Promise<string[]> {
  const licz = async (sql: string, params: unknown[] = []): Promise<number> =>
    Number((await c.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);

  const kpiJest = await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_definitions WHERE organization_id = $1', [ORG_ID]);
  const pomiaryJest = await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_measurements WHERE organization_id = $1', [ORG_ID]);
  const widocznoscJest = await licz(
    `SELECT COUNT(*)::text AS n FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'kpi'`,
    [ORG_ID]
  );
  const raportJest = await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecards WHERE organization_id = $1', [ORG_ID]);
  const celeJest = await licz('SELECT COUNT(*)::text AS n FROM okr_vnext_objectives WHERE organization_id = $1', [ORG_ID]);
  const roiJest = await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_cases WHERE organization_id = $1', [ORG_ID]);
  const sprawJest = await licz('SELECT COUNT(*)::text AS n FROM financial_statements WHERE organization_id = $1', [ORG_ID]);
  const budzetJest = await licz('SELECT COUNT(*)::text AS n FROM budgets WHERE organization_id = $1', [ORG_ID]);

  const pomiaryOczekiwane = KPI.length * OKRESY_POMIAROW.length;
  const krOczekiwane = OKR_CELE.reduce((s, c_) => s + c_.kluczoweWyniki.length, 0);

  return [
    `definicje KPI (API)             ${kpiJest} -> ${KPI.length}`,
    `pomiary KPI (API)               ${pomiaryJest} -> ${pomiaryOczekiwane}`,
    `wiersze widoczności KPI         ${widocznoscJest} -> ${KPI.length}   (STOP 2 — bez nich lista jest pusta)`,
    `powiązania KPI <-> inicjatywa   -> ${KPI.length}`,
    `raport KPI (poziom 1) / pozycje ${raportJest} -> 1 / ${RAPORT_KPI.pozycje.length}`,
    `cele OKR / kluczowe wyniki      ${celeJest} -> ${OKR_CELE.length} / ${krOczekiwane}`,
    `przypadki ROI                   ${roiJest} -> 1 (${ROI_PRZYPADEK.kosztyLinie.length} kosztów, ${ROI_PRZYPADEK.korzysciLinie.length} korzyści, ${ROI_PRZYPADEK.zalozenia.length} założeń)`,
    `sprawozdania finansowe (SQL)    ${sprawJest} -> ${SPRAWOZDANIA.length} (${SPRAWOZDANIA.length * LINIE_PL.length} wartości, 1 paczka)`,
    `budżety                         ${budzetJest} -> 1 (15 pozycji, ${BUDZET.inicjatywy.length} powiązań z inicjatywami)`,
  ];
}

// ============================================================================
// VERIFY — asercje TWARDE (== N, nigdy >= N)
// ============================================================================
interface Asercja {
  nazwa: string;
  oczekiwane: number;
  rzeczywiste: number;
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    const ok = a.oczekiwane === a.rzeczywiste;
    if (!ok) bledy++;
    console.log(
      `[verify-d5] ${ok ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(70)} oczekiwane=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`
    );
  }
  if (bledy > 0) {
    console.error(`\n[verify-d5] FAIL: ${bledy} z ${asercje.length} asercji nie przeszło.`);
    process.exitCode = 1;
  } else {
    console.log(`\n[verify-d5] PASS: wszystkie ${asercje.length} asercji przeszły.`);
  }
}

async function weryfikuj(c: PoolClient): Promise<void> {
  const licz = async (sql: string, params: unknown[] = []): Promise<number> =>
    Number((await c.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);

  const kpiWszystkie = await licz(
    'SELECT COUNT(*)::text AS n FROM rvn_kpi_definitions WHERE organization_id = $1',
    [ORG_ID]
  );

  if (kpiWszystkie === 0) {
    // Stan po `--reset` — wszystko ma być zerem.
    wypiszIZakoncz([
      { nazwa: 'definicje KPI', oczekiwane: 0, rzeczywiste: 0 },
      {
        nazwa: 'pomiary KPI',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_measurements WHERE organization_id = $1', [ORG_ID]),
      },
      {
        nazwa: 'wiersze widoczności KPI',
        oczekiwane: 0,
        rzeczywiste: await licz(
          `SELECT COUNT(*)::text AS n FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'kpi'`,
          [ORG_ID]
        ),
      },
      {
        nazwa: 'raporty KPI (karty wyników)',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecards WHERE organization_id = $1', [ORG_ID]),
      },
      {
        nazwa: 'cele OKR',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM okr_vnext_objectives WHERE organization_id = $1', [ORG_ID]),
      },
      {
        nazwa: 'przypadki ROI',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_cases WHERE organization_id = $1', [ORG_ID]),
      },
      {
        nazwa: 'sprawozdania finansowe',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM financial_statements WHERE organization_id = $1', [ORG_ID]),
      },
      {
        nazwa: 'budżety',
        oczekiwane: 0,
        rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM budgets WHERE organization_id = $1', [ORG_ID]),
      },
    ]);
    return;
  }

  const krOczekiwane = OKR_CELE.reduce((s, c_) => s + c_.kluczoweWyniki.length, 0);

  const zestaw: Asercja[] = [
    { nazwa: 'definicje KPI', oczekiwane: KPI.length, rzeczywiste: kpiWszystkie },
    {
      nazwa: 'definicje KPI w stanie „active"',
      oczekiwane: KPI.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_definitions WHERE organization_id = $1 AND status = 'active'`,
        [ORG_ID]
      ),
    },
    {
      // STOP 2 — bez tego wiersza KPI nie przechodzi przez INNER JOIN
      // w `kpiRepository.ts:127-128` i lista jest pusta mimo danych.
      nazwa: 'wiersze widoczności KPI (STOP 2 — INNER JOIN listy)',
      oczekiwane: KPI.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_platform_resource_visibility
          WHERE organization_id = $1 AND resource_type = 'kpi'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'KPI BEZ wiersza widoczności (musi być 0)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_definitions kd
          WHERE kd.organization_id = $1
            AND NOT EXISTS (SELECT 1 FROM rvn_platform_resource_visibility v
                             WHERE v.organization_id = kd.organization_id
                               AND v.resource_type = 'kpi'
                               AND v.resource_id = kd.kpi_id::text)`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zatwierdzone wersje definicji KPI',
      oczekiwane: KPI.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_definition_versions
          WHERE organization_id = $1 AND approval_status = 'approved'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'wersje definicji zatwierdzone przez SIEBIE (maker-checker, musi być 0)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_definition_versions
          WHERE organization_id = $1 AND approved_by IS NOT NULL AND approved_by = submitted_by`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'pomiary KPI',
      oczekiwane: KPI.length * OKRESY_POMIAROW.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_measurements WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'KPI z liczbą pomiarów inną niż 6',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM (
           SELECT kd.kpi_id FROM rvn_kpi_definitions kd
             LEFT JOIN rvn_kpi_measurements m ON m.kpi_id = kd.kpi_id
            WHERE kd.organization_id = $1
            GROUP BY kd.kpi_id HAVING COUNT(m.measurement_id) <> $2
         ) t`,
        [ORG_ID, OKRESY_POMIAROW.length]
      ),
    },
    {
      nazwa: 'zdarzenia platformy Wyników (event-log — dowód drogi przez API)',
      oczekiwane: 0,
      rzeczywiste: 0, // zastąpione niżej — placeholder trzyma kolejność czytania
    },
    {
      nazwa: 'powiązania KPI <-> inicjatywa',
      oczekiwane: KPI.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_initiative_impacts WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'powiązania KPI wskazujące inicjatywę spoza organizacji (musi być 0)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_initiative_impacts imp
          WHERE imp.organization_id = $1
            AND NOT EXISTS (SELECT 1 FROM initiatives i
                             WHERE i.id = imp.initiative_id AND i.organization_id = $1)`,
        [ORG_ID]
      ),
    },
    {
      // POZIOM 1 zakładki „KPI" to RAPORTY, nie definicje. Bez raportu ekran
      // mówi „No KPI reports yet" mimo ośmiu aktywnych mierników.
      nazwa: 'raporty KPI (poziom 1 zakładki) w stanie „active"',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecards WHERE organization_id = $1 AND lifecycle_status = 'active'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'pozycje raportu KPI',
      oczekiwane: RAPORT_KPI.pozycje.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecard_items WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'programy OKR (opublikowane)',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM okr_vnext_programs WHERE organization_id = $1 AND status = 'active'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'cykle OKR (aktywne)',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM okr_vnext_cycles WHERE organization_id = $1 AND status = 'active'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'zestawy OKR',
      oczekiwane: 1,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM okr_vnext_sets WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'cele OKR',
      oczekiwane: OKR_CELE.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM okr_vnext_objectives WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'kluczowe wyniki OKR',
      oczekiwane: krOczekiwane,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM okr_vnext_key_results WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'wiersze widoczności zestawów OKR',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_platform_resource_visibility
          WHERE organization_id = $1 AND resource_type = 'okr_set'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'przypadki ROI',
      oczekiwane: 1,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_cases WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'wiersze widoczności przypadków ROI',
      oczekiwane: 1,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM rvn_platform_resource_visibility
          WHERE organization_id = $1 AND resource_type = 'roi_case'`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'linie kosztów ROI',
      oczekiwane: ROI_PRZYPADEK.kosztyLinie.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_cost_lines WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'linie korzyści ROI',
      oczekiwane: ROI_PRZYPADEK.korzysciLinie.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_benefit_lines WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'założenia ROI',
      oczekiwane: ROI_PRZYPADEK.zalozenia.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_assumptions WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'powiązania dowodowe korzyść ROI -> KPI',
      oczekiwane: ROI_PRZYPADEK.korzysciLinie.length,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'przebiegi obliczeń ROI',
      oczekiwane: 1,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM rvn_roi_calculation_runs WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'paczki sprawozdań finansowych',
      oczekiwane: 1,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM financial_statement_packs WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'sprawozdania finansowe (4 kwartały)',
      oczekiwane: SPRAWOZDANIA.length,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM financial_statements WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'sprawozdania nieprzypięte do paczki (musi być 0)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM financial_statements WHERE organization_id = $1 AND statement_pack_id IS NULL',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'wartości sprawozdań',
      oczekiwane: SPRAWOZDANIA.length * LINIE_PL.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM financial_statement_values v
           JOIN financial_statements s ON s.id = v.statement_id
          WHERE s.organization_id = $1`,
        [ORG_ID]
      ),
    },
    {
      // Hub liczy `mapped_line_count` po `canonical_line_id IS NOT NULL`
      // (`financialStatementPackService.ts:846-848`). Wartość bez mapowania
      // daje na ekranie „0 / N" mimo pełnej tabeli.
      nazwa: 'wartości BEZ mapowania na linię kanoniczną (ekran pokazałby 0/N)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM financial_statement_values v
           JOIN financial_statements s ON s.id = v.statement_id
          WHERE s.organization_id = $1 AND v.canonical_line_id IS NULL`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'sprawozdania, w których rachunek się nie domyka (revenue - cogs <> gross)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM (
           SELECT s.id
             FROM financial_statements s
             JOIN financial_statement_values r ON r.statement_id = s.id AND r.canonical_line_id = 'fsl-pl-revenue'
             JOIN financial_statement_values c2 ON c2.statement_id = s.id AND c2.canonical_line_id = 'fsl-pl-cogs'
             JOIN financial_statement_values g ON g.statement_id = s.id AND g.canonical_line_id = 'fsl-pl-gross'
            WHERE s.organization_id = $1 AND (r.value - c2.value) <> g.value
         ) t`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'budżety',
      oczekiwane: 1,
      rzeczywiste: await licz('SELECT COUNT(*)::text AS n FROM budgets WHERE organization_id = $1', [ORG_ID]),
    },
    {
      nazwa: 'pozycje budżetu',
      oczekiwane: 15,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM budget_lines bl
           JOIN budgets b ON b.id = bl.budget_id WHERE b.organization_id = $1`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'pozycje budżetu z wartością bazową 0 (musi być 0)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM budget_lines bl
           JOIN budgets b ON b.id = bl.budget_id
          WHERE b.organization_id = $1 AND COALESCE(bl.baseline_value, 0) = 0`,
        [ORG_ID]
      ),
    },
    {
      nazwa: 'recepty rejestracji budżetu (dowód drogi przez kanonicznego pisarza)',
      oczekiwane: 1,
      rzeczywiste: await licz(
        'SELECT COUNT(*)::text AS n FROM finance_budget_registration_receipts WHERE organization_id = $1',
        [ORG_ID]
      ),
    },
    {
      nazwa: 'powiązania budżetu z inicjatywami',
      oczekiwane: BUDZET.inicjatywy.length,
      rzeczywiste: await licz(
        `SELECT COUNT(*)::text AS n FROM budget_initiative_links bil
           JOIN budgets b ON b.id = bil.budget_id WHERE b.organization_id = $1`,
        [ORG_ID]
      ),
    },
    {
      // Dane pokazowe MUSZĄ być po angielsku. Etykiety interfejsu to inny
      // dług (program JĘZYK) — ta asercja patrzy WYŁĄCZNIE na dane.
      nazwa: 'teksty KPI/OKR/ROI z polskimi znakami (dane muszą być po angielsku)',
      oczekiwane: 0,
      rzeczywiste: await licz(
        `SELECT (
           (SELECT COUNT(*) FROM rvn_kpi_definition_versions
             WHERE organization_id = $1
               AND (name ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' OR COALESCE(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'))
         + (SELECT COUNT(*) FROM okr_vnext_objectives
             WHERE organization_id = $1
               AND (title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' OR COALESCE(description,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'))
         + (SELECT COUNT(*) FROM okr_vnext_key_results
             WHERE organization_id = $1 AND title ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
         + (SELECT COUNT(*) FROM rvn_roi_cost_lines
             WHERE organization_id = $1 AND label ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
         + (SELECT COUNT(*) FROM rvn_roi_benefit_lines
             WHERE organization_id = $1 AND label ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
         )::text AS n`,
        [ORG_ID]
      ),
    },
  ];

  // Podmiana placeholdera zdarzeń — liczba zdarzeń zależy od liczby komend,
  // więc asercja jest „więcej niż zero", wyrażona jako 1==1 przy niepustym.
  const zdarzenia = await licz('SELECT COUNT(*)::text AS n FROM rvn_platform_events WHERE organization_id = $1', [ORG_ID]);
  const idx = zestaw.findIndex((a) => a.nazwa.startsWith('zdarzenia platformy'));
  zestaw[idx] = {
    nazwa: `zdarzenia platformy Wyników — event-log niepusty (jest ${zdarzenia})`,
    oczekiwane: 1,
    rzeczywiste: zdarzenia > 0 ? 1 : 0,
  };

  console.log(`[verify-d5] organizacja: ${ORG_NAZWA} (${ORG_ID})`);
  const statusy = await c.query<{ status: string; n: string }>(
    'SELECT status, COUNT(*)::text AS n FROM rvn_kpi_definitions WHERE organization_id = $1 GROUP BY status ORDER BY status',
    [ORG_ID]
  );
  console.log(`[verify-d5] KPI wg stanu: ${statusy.rows.map((r) => `${r.status}=${r.n}`).join(' ') || '(brak)'}`);
  wypiszIZakoncz(zestaw);
}

// ============================================================================
// RESET — kasuje WYŁĄCZNIE dane Wyników i Finansów organizacji `northwind`
//
// Kolejność jest wymuszona kluczami obcymi ZMIERZONYMI na kopii (08.09), nie
// zgadniętymi. Dwie pułapki, na które reset musi mieć odpowiedź:
//  · `finance_budget_registration_receipts` ma trigger niezmienności —
//    tak samo jak rejestr decyzji bramkowych w D3;
//  · pomiar poniżej progu krytycznego zakłada `rvn_kpi_deviation_cases`
//    i `action_cards` (`kpi.routes.ts:1018` `ensureActionCardForKpiDeviation`),
//    więc pomiarów nie da się skasować „wprost".
// ============================================================================
async function reset(c: PoolClient): Promise<void> {
  const kroki: Array<[string, string, unknown[]]> = [
    ['korekty KPI', 'DELETE FROM rvn_kpi_corrective_actions WHERE organization_id = $1', [ORG_ID]],
    ['działania naprawcze KPI', 'DELETE FROM rvn_kpi_recovery_actions WHERE organization_id = $1', [ORG_ID]],
    ['punkty kontrolne KPI', 'DELETE FROM rvn_kpi_recovery_checkpoints WHERE organization_id = $1', [ORG_ID]],
    ['sprawy odchyleń KPI', 'DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1', [ORG_ID]],
    [
      'karty działań z odchyleń',
      `DELETE FROM action_cards WHERE organization_id = $1 AND COALESCE(source_kind,'') ILIKE '%kpi%'`,
      [ORG_ID],
    ],
    ['powiązania KPI <-> inicjatywa', 'DELETE FROM rvn_kpi_initiative_impacts WHERE organization_id = $1', [ORG_ID]],
    [
      'pomiary migawek raportu KPI',
      'DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements WHERE organization_id = $1',
      [ORG_ID],
    ],
    ['migawki przeglądu raportu KPI', 'DELETE FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1', [ORG_ID]],
    ['pozycje raportu KPI', 'DELETE FROM rvn_kpi_scorecard_items WHERE organization_id = $1', [ORG_ID]],
    ['raporty KPI (karty wyników)', 'DELETE FROM rvn_kpi_scorecards WHERE organization_id = $1', [ORG_ID]],
    [
      'powiązania dowodowe ROI -> KPI',
      'DELETE FROM rvn_roi_benefit_evidence_links WHERE organization_id = $1',
      [ORG_ID],
    ],
    ['pomiary KPI', 'DELETE FROM rvn_kpi_measurements WHERE organization_id = $1', [ORG_ID]],
    [
      'wskazanie bieżącej wersji definicji',
      'UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1',
      [ORG_ID],
    ],
    ['wersje definicji KPI', 'DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1', [ORG_ID]],
    ['definicje KPI', 'DELETE FROM rvn_kpi_definitions WHERE organization_id = $1', [ORG_ID]],
    ['przebiegi obliczeń ROI', 'DELETE FROM rvn_roi_calculation_runs WHERE organization_id = $1', [ORG_ID]],
    ['scenariusze ROI', 'DELETE FROM rvn_roi_scenario_overrides WHERE organization_id = $1', [ORG_ID]],
    ['warianty ROI', 'DELETE FROM rvn_roi_scenarios WHERE organization_id = $1', [ORG_ID]],
    ['linie korzyści ROI', 'DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1', [ORG_ID]],
    ['linie kosztów ROI', 'DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1', [ORG_ID]],
    ['założenia ROI', 'DELETE FROM rvn_roi_assumptions WHERE organization_id = $1', [ORG_ID]],
    ['polityka obliczeń ROI', 'DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1', [ORG_ID]],
    ['plany bazowe ROI', 'DELETE FROM rvn_roi_baselines WHERE organization_id = $1', [ORG_ID]],
    ['przypadki ROI', 'DELETE FROM rvn_roi_cases WHERE organization_id = $1', [ORG_ID]],
    ['kluczowe wyniki OKR', 'DELETE FROM okr_vnext_key_results WHERE organization_id = $1', [ORG_ID]],
    ['cele OKR', 'DELETE FROM okr_vnext_objectives WHERE organization_id = $1', [ORG_ID]],
    [
      'wersje zestawów OKR',
      'DELETE FROM okr_vnext_set_versions WHERE set_id IN (SELECT set_id FROM okr_vnext_sets WHERE organization_id = $1)',
      [ORG_ID],
    ],
    ['zestawy OKR', 'DELETE FROM okr_vnext_sets WHERE organization_id = $1', [ORG_ID]],
    [
      'okna meldunków OKR',
      'DELETE FROM okr_vnext_checkin_occurrences WHERE cycle_id IN (SELECT cycle_id FROM okr_vnext_cycles WHERE organization_id = $1)',
      [ORG_ID],
    ],
    ['cykle OKR', 'DELETE FROM okr_vnext_cycles WHERE organization_id = $1', [ORG_ID]],
    [
      'wskazanie aktywnej polityki programu OKR',
      'UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1',
      [ORG_ID],
    ],
    ['wersje polityki programu OKR', 'DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1', [ORG_ID]],
    ['programy OKR', 'DELETE FROM okr_vnext_programs WHERE organization_id = $1', [ORG_ID]],
    [
      // `rvn_platform_resource_acl` NIE ma kolumny `organization_id`
      // (zmierzone) — kasujemy po zasobach tej organizacji.
      'uprawnienia zasobów platformy',
      `DELETE FROM rvn_platform_resource_acl a
        WHERE EXISTS (SELECT 1 FROM rvn_platform_resource_visibility v
                       WHERE v.organization_id = $1
                         AND v.resource_type = a.resource_type
                         AND v.resource_id = a.resource_id)`,
      [ORG_ID],
    ],
    ['wiersze widoczności platformy', 'DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1', [ORG_ID]],
    ['polityki widoczności platformy', 'DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1', [ORG_ID]],
    [
      'skrzynka nadawcza platformy',
      'DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)',
      [ORG_ID],
    ],
    [
      'znaczniki konsumentów platformy',
      'DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)',
      [ORG_ID],
    ],
    ['zobowiązania platformy', 'DELETE FROM rvn_platform_obligations WHERE organization_id = $1', [ORG_ID]],
    ['zdarzenia platformy', 'DELETE FROM rvn_platform_events WHERE organization_id = $1', [ORG_ID]],
    [
      'wartości sprawozdań',
      `DELETE FROM financial_statement_values WHERE statement_id IN
         (SELECT id FROM financial_statements WHERE organization_id = $1)`,
      [ORG_ID],
    ],
    [
      // `financial_statement_validations` też nie ma `organization_id` —
      // wiąże się przez sprawozdanie albo paczkę.
      'walidacje sprawozdań',
      `DELETE FROM financial_statement_validations
        WHERE statement_id IN (SELECT id FROM financial_statements WHERE organization_id = $1)
           OR statement_pack_id IN (SELECT id FROM financial_statement_packs WHERE organization_id = $1)`,
      [ORG_ID],
    ],
    ['sprawozdania finansowe', 'DELETE FROM financial_statements WHERE organization_id = $1', [ORG_ID]],
    ['paczki sprawozdań', 'DELETE FROM financial_statement_packs WHERE organization_id = $1', [ORG_ID]],
    [
      'powiązania budżetu z inicjatywami',
      'DELETE FROM budget_initiative_links WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id = $1)',
      [ORG_ID],
    ],
  ];

  await c.query('BEGIN');
  try {
    for (const [nazwa, sql, params] of kroki) {
      try {
        await c.query(sql, params);
      } catch (e) {
        const msg = (e as Error).message;
        // Tabela może nie istnieć na starszej migracji — reset nie może się
        // o to wywrócić, ale MUSI to powiedzieć głośno.
        if (/does not exist/i.test(msg)) {
          console.warn(`[reset-d5] POMINIĘTO „${nazwa}": ${msg.split('\n')[0]}`);
          await c.query('ROLLBACK');
          await c.query('BEGIN');
          continue;
        }
        throw new Error(`reset „${nazwa}": ${msg}`);
      }
    }

    // Rejestr publikacji domeny ROI jest APPEND-ONLY (trigger
    // `…activation is append-only`). Musi zniknąć RAZEM z polityką
    // widoczności: gdyby został, `--apply` uznałby domenę za włączoną
    // i pominął publikację, a `createRoiCase` i tak odmówiłby 409
    // `NO_ACTIVE_VISIBILITY_POLICY` (dwie różne tabele, jeden warunek —
    // zmierzone 08.09).
    await c.query('ALTER TABLE rvn_roi_visibility_governance DISABLE TRIGGER USER');
    await c.query('DELETE FROM rvn_roi_visibility_governance WHERE organization_id = $1', [ORG_ID]);
    await c.query('ALTER TABLE rvn_roi_visibility_governance ENABLE TRIGGER USER');

    // Recepty komend budżetu są niezmienne z założenia (trigger
    // `finance_budget_*_receipt_immutable`) — tak samo jak rejestr decyzji
    // bramkowych w D3. Na LOKALNEJ KOPII (guard hosta wyżej) reset zdejmuje
    // je na czas kasowania; bez tego klucze obce nie pozwolą usunąć ani
    // pozycji budżetu, ani samego budżetu. Lista tabel pochodzi z zapytania
    // o klucze obce wskazujące `budgets`/`budget_lines`/`budget_scenarios`,
    // nie z pamięci.
    const receptyBudzetu = [
      'finance_budget_line_command_receipts',
      'finance_budget_initiative_link_receipts',
      'finance_budget_initiative_unlink_receipts',
      'finance_budget_approval_command_receipts',
      'finance_budget_discard_command_receipts',
      'finance_budget_document_import_receipts',
      'finance_budget_projection_command_receipts',
      'finance_budget_scenario_adjustment_command_receipts',
      'finance_budget_registration_receipts',
    ];
    for (const tabela of receptyBudzetu) {
      await c.query(`ALTER TABLE ${tabela} DISABLE TRIGGER USER`);
      await c.query(`DELETE FROM ${tabela} WHERE organization_id = $1`, [ORG_ID]);
      await c.query(`ALTER TABLE ${tabela} ENABLE TRIGGER USER`);
    }
    await c.query(
      'DELETE FROM budget_lines WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id = $1)',
      [ORG_ID]
    );
    await c.query(
      'DELETE FROM budget_scenarios WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id = $1)',
      [ORG_ID]
    );
    await c.query(
      'DELETE FROM budget_snapshots WHERE budget_id IN (SELECT id FROM budgets WHERE organization_id = $1)',
      [ORG_ID]
    );
    await c.query('DELETE FROM budgets WHERE organization_id = $1', [ORG_ID]);

    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }

  console.log(
    `[wyniki-finanse] reset: usunięto KPI z pomiarami i widocznością, OKR (program/cykl/zestaw/cele), ` +
      `ROI (przypadek z modelem), sprawozdania finansowe i budżet organizacji „${ORG_ID}".`
  );
}

// ============================================================================
// main
// ============================================================================
async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  const d5 =
    opcje.tryb === 'apply'
      ? czytajOpcjeD5(process.argv.slice(2), opcje.hasloPlik)
      : { apiUrl: null, email: '', emailZatwierdzajacy: '', haslo: null };

  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[wyniki-finanse] cel:          ${toz}`);
    console.log(`[wyniki-finanse] organizacja:  ${ORG_NAZWA} (id ${ORG_ID})`);
    console.log(
      `[wyniki-finanse] tryb:         ${opcje.tryb}${d5.apiUrl ? ` (+ etap API ${d5.apiUrl})` : ' (bez etapu API)'}`
    );

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
    const inicjatywy = await idInicjatyw(c);

    console.log('\n--- PLAN ---');
    for (const w of await zbudujPlan(c)) console.log(w);

    if (opcje.tryb === 'dry-run') {
      console.log(
        `\n[wyniki-finanse] dry-run: ${KPI.length} KPI, ${KPI.length * OKRESY_POMIAROW.length} pomiarów, ` +
          `${OKR_CELE.length} celów OKR, 1 przypadek ROI, ${SPRAWOZDANIA.length} sprawozdań, 1 budżet. Nic nie zapisano.`
      );
      console.log(
        '[wyniki-finanse] UWAGA: bez --api etap API (KPI, OKR, ROI, budżet) NIE wykona się — zostanie sam SQL sprawozdań.'
      );
      return;
    }

    const lic = new Licznik();

    // --- ETAP SQL (sprawozdania) --------------------------------------------
    const spraw = await etapSprawozdania(c, lic);
    console.log(
      `\n[wyniki-finanse/sql] paczka sprawozdań: ${spraw.paczka} · sprawozdania=${spraw.sprawozdania} · wartości=${spraw.wartosci}`
    );

    // --- ETAP API -----------------------------------------------------------
    if (!d5.apiUrl) {
      console.log(
        '[wyniki-finanse] STOP: bez --api nie powstaną KPI (STOP 1 — wyłącznie przez API),\n' +
          '                 OKR, ROI ani budżet. --verify to zgłosi.'
      );
      console.log('\n' + lic.raport('wyniki-finanse'));
      return;
    }

    const wlasciciel = new Api(d5.apiUrl);
    await wlasciciel.zaloguj(d5.email, d5.haslo!);
    const zatwierdzajacy = new Api(d5.apiUrl);
    await zatwierdzajacy.zaloguj(d5.emailZatwierdzajacy, d5.haslo!);

    const wKpi = await etapKpi(c, wlasciciel, zatwierdzajacy, inicjatywy, lic);
    console.log(
      `[wyniki-finanse/api] KPI: utworzone=${wKpi.utworzone} pominięte=${wKpi.pominiete} · ` +
        `pomiary=${wKpi.pomiary} · powiązania z inicjatywami=${wKpi.wplywy}`
    );

    const wRaport = await etapRaportKpi(c, wlasciciel, wKpi.identyfikatory, lic);
    console.log(
      `[wyniki-finanse/api] Raport KPI (poziom 1 zakładki): ${wRaport.raport} · pozycje=${wRaport.pozycje}`
    );

    const wOkr = await etapOkr(c, wlasciciel, zatwierdzajacy, lic);
    console.log(
      `[wyniki-finanse/api] OKR: program ${wOkr.program} · cykl ${wOkr.cykl} · zestaw ${wOkr.zestaw} · ` +
        `cele=${wOkr.cele} · kluczowe wyniki=${wOkr.kluczoweWyniki}`
    );

    const wRoi = await etapRoi(c, wlasciciel, inicjatywy, wKpi.identyfikatory, lic);
    console.log(
      `[wyniki-finanse/api] ROI: polityka widoczności ${wRoi.politykaWidocznosci} · przypadek ${wRoi.przypadek} · założenia=${wRoi.zalozenia} · koszty=${wRoi.koszty} · ` +
        `korzyści=${wRoi.korzysci} · powiązania z KPI=${wRoi.powiazaniaKpi} · stan ${wRoi.stan} · przebieg ${wRoi.przebieg}`
    );

    const wBud = await etapBudzet(c, wlasciciel, inicjatywy, lic);
    console.log(
      `[wyniki-finanse/api] Budżet: ${wBud.budzet} · pozycje z wartością=${wBud.pozycje} · ` +
        `powiązania z inicjatywami=${wBud.powiazaniaInicjatyw}`
    );

    console.log('\n' + lic.raport('wyniki-finanse'));
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[wyniki-finanse] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});

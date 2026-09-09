#!/usr/bin/env tsx
/**
 * D9 — DOSIEW PO TESCIE — organizacja „Northwind Manufacturing Ltd." (`northwind`).
 *
 * ZRODLO ZLECENIA: `docs/program/TEST_JEZYK_I_DANE_20260909/RAPORT_DANE.md` §5
 * („Co dokladnie dosiac") — test TEST-DANE orzekl: dane sa wysylane poprawnie,
 * ale NIEWYSTARCZAJACE. Piec brakow, w kolejnosci priorytetu raportu:
 *
 *   BRAK 1  Organizacja — profil (industry_code, strategic_priorities, opis,
 *           digital_maturity_overall, technology_stack, primary_markets).
 *   BRAK 2  Wywiad — `interview_assignments` (+ `interview_assignment_members`).
 *   BRAK 3  Wyniki — opublikowana migawka przegladu karty KPI.
 *   BRAK 4  Realizacja — rozklad zadan w czasie + zaleglosc, zeby zakladka
 *           Zasoby miala co pokazac.
 *   BRAK 5  Pola pochodne — FORMAT, SOURCE, LEVEL, VARIANCE, AREA/AXIS.
 *
 * ==========================================================================
 * TRZY PREMISY RAPORTU, KTORE POMIAR NA KOPII OBALIL (KROK 0 — zmierz premise)
 * ==========================================================================
 * P1. „Profil ma 13 pol, UI liczy 8/13."  W KODZIE SA **15** POL.
 *     `src/views/ContextBuilder/modules/organizationProfileTaxonomy.tsx:317-335`
 *     (`completenessChecks`) wylicza 15 warunkow; `OrganizationReadinessScreen.tsx:13`
 *     mowi wprost „te same 15 pol". Denominator „13" nie ma pokrycia w kodzie.
 *     Ten etap celuje w 15/15, nie w 13/13.
 *
 * P2. „Wywiad: statusy `pending`, `answered`, `approved`."  SLOWNIK KANONICZNY
 *     TAKICH WARTOSCI NIE MA. `InterviewAssignmentService.ts:452` wstawia
 *     `'assigned'`, a `:819` porzadkuje po `assigned|sent_back|in_progress|submitted`.
 *     `interviewStatusNormalization.ts:17` tylko normalizuje wielkosc liter —
 *     nie ma aliasu `pending`→`assigned` ani `answered`→`submitted`.
 *     Dosiewamy `assigned` / `submitted` / `approved` (odpowiedniki 1:1).
 *
 * P3. „Realizacja: 7 z 8 tygodni ma zerowy popyt."  W BAZIE OSIEM TYGODNI MA
 *     POPYT (pomiar `evidence/dane-pokazowe-en/d9/pomiar-PRZED.txt`: 23 zadania,
 *     356 h w oknie 8 tygodni, kazdy z osmiu tygodni niepusty). Realnym
 *     problemem jest NISKIE OBLOZENIE: 356 h popytu wobec ~2704 h podazy
 *     (9 osob x ~338 h/tydz. x 8) = 13 %. Dlatego ten etap podnosi
 *     PRACOCHLONNOSC do skali realnego programu, a nie „rozklada terminy",
 *     ktore juz sa rozlozone.
 *
 * ==========================================================================
 * SKAD WIADOMO, CO WYPELNIC (kazde pole ma zmierzonego czytelnika)
 * ==========================================================================
 * BRAK 1 — INDUSTRY to NIE byl defekt renderowania ani pusty `industry_code`.
 *   `OrganizationIdentityOperatingScreen.tsx:677` czyta `profile.industry`
 *   (wypelnione: „Industrial Manufacturing") i rysuje je przez natywny
 *   `<select>` (`OrganizationCardPrimitives.tsx:300-326`), ktorego opcje
 *   pochodza WYLACZNIE ze slownika `INDUSTRIES`
 *   (`organizationProfileTaxonomy.tsx:164-183`). „Industrial Manufacturing"
 *   w tym slowniku NIE WYSTEPUJE (sa osobno „Manufacturing" i „Industrial"),
 *   wiec `<select>` nie ma pasujacej opcji i pokazuje `emptyLabel = '—'`.
 *   => TO JEST DEFEKT DANYCH, USUWALNY ZASIEWEM: wartosc musi nalezec do
 *   slownika. Ustawiamy `industry = 'Manufacturing'`, a „Industrial
 *   Manufacturing" zostaje czytelnie w `industry_subsector`/`industry_code`.
 *   (Ta sama poprawka idzie do `01-rdzen.ts` PROFIL.industry — inaczej ponowny
 *   `01 --apply` cofnalby ja przez `ON CONFLICT DO UPDATE`.)
 *
 * BRAK 1 — `profile_completeness` NIE JEST LICZONE PRZEZ SERWER. Trasa
 *   `PUT /api/organization-profiles/:orgId`
 *   (`server/src/routes/organization/organization-profiles.routes.ts:439,502`)
 *   przyjmuje te liczbe z CIALA ZADANIA i zapisuje jak zwykla kolumne. Liczy
 *   ja FRONT: `computeCompleteness()` (taksonomia, `:337-340`) — i to wlasnie
 *   „ten sam mechanizm, ktory liczy je w produkcie". Ten etap nie wpisuje 100
 *   na sztywno: `policzKompletnosc()` nizej jest przepisaniem 1:1 tych samych
 *   15 warunkow, liczonym z ladunku, ktory faktycznie wysylamy.
 *   (UWAGA: w module zyja TRZY rozne definicje kompletnosci — front 15 pol,
 *   backendowe `GET` z 5 pol (`:226-235`) i kolumna. To dlug kodu, nie danych.)
 *
 * BRAK 3 — pisarz kanoniczny istnieje i jest DWUKROKOWY:
 *   `POST /api/vnext/results/kpi/scorecards/:id/review-snapshots` tworzy DRAFT
 *   (`kpiScorecardCommands.ts:873-938` — `snapshot_payload` NULL), a dopiero
 *   `POST .../review-snapshots/:snapshotId/publish` materializuje ladunek,
 *   liczy `content_hash` i wypelnia
 *   `rvn_kpi_scorecard_review_snapshot_measurements` (`:1183-1217`).
 *   Surowy INSERT dalby wiersz `published` z pustym `snapshot_payload` —
 *   `GET .../published` zwrocilby 200 z pustka zamiast przegladu. Dlatego
 *   BRAK 3 jest WYLACZNIE etapem API.
 *
 * BRAK 4 — zakladke Zasoby zasila `getExecutionResourcePlan()`
 *   (`server/src/services/workloadCapacityService.ts:827-1010`):
 *     * POPYT   = `tasks.estimated_hours` (NIE `effort_estimate_hours`)
 *                 rozlozone rowno miedzy `tasks.created_at` (start — tabela
 *                 NIE MA kolumny `start_date`, `:840-842`) a `due_date`,
 *                 start przyciety do biezacego poniedzialku;
 *     * ZALEGLOSC = zadania otwarte z `due_date` PRZED biezacym poniedzialkiem,
 *                 `max(estimated_hours - actual_hours, 0)`, stawiana w wierszu
 *                 PIERWSZEGO tygodnia (`:995`), w pozostalych 0 → front rysuje
 *                 „—" (`ExecutionResourcesSurface.tsx:489`). „—" w wierszach
 *                 tygodni 2-8 jest ZAMIERZONE, nie jest defektem;
 *     * PODAZ   = `users.weekly_capacity_hours` x `availability_percent`;
 *     * filtr   = `assignee_id IS NOT NULL` i status poza
 *                 done/completed/validated/cancelled.
 *   Dlatego ten etap rusza `estimated_hours`, `created_at`/`started_at`
 *   i `due_date` — i nic poza tym.
 *
 * BRAK 5 — kazda z pieciu kolumn ma zmierzonego czytelnika:
 *     FORMAT   `v8_output_artifacts.origin_summary_json -> exportFormat`
 *              (`artifactRegistryService.ts:2770-2810` `resolvePersistedArtifactFormat`);
 *     SOURCE   `v8_artifact_origin_links.origin_runtime` — JUZ WYPELNIONE dla
 *              wszystkich 7 artefaktow (pomiar PRZED), wiec ta kolumna czeka
 *              tylko na FORMAT; w rejestrze inicjatyw SOURCE bierze
 *              `initiatives.source_type` (`initiativeRegisterProjection.ts:378`);
 *     LEVEL    `initiatives.current_stage` (`executionRealData.ts:349-354`) — 0/13;
 *     VARIANCE `initiatives.baseline_end_date` (`executionRealData.ts:214-237`) — 0/13;
 *     AREA/AXIS `initiatives.area` (JUZ 13/13) → `axis` → `category`
 *              (`initiativeRegisterColumns.shared.ts:142-160`). Kaskada zaczyna
 *              sie od `area`, wiec ta kolumna NIE byla pusta z powodu danych;
 *              `axis` uzupelniamy, bo zasila etykiete typu realizacji.
 *   Do tego `rvn_kpi_scorecard_items.area_name/indicator_type/benchmark_value/
 *   limit_percent` (8/8 NULL) — kolumny AREA, TYPE, BENCHMARK, LIMIT % raportu
 *   KPI (`kpiReportPresenters.tsx:660-735`).
 *
 * ==========================================================================
 * UZYCIE
 * ==========================================================================
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/09-dosiew-po-tescie.ts \
 *       --oczekiwany-host 54418 --dry-run
 *   DATABASE_URL=… npx tsx … --oczekiwany-host 54418 --apply \
 *       --api http://127.0.0.1:4210 \
 *       --email james.whitfield@northwind.example \
 *       --haslo-plik /Users/…/northwind-konta-STAGING.txt
 *   DATABASE_URL=… npx tsx … --oczekiwany-host 54418 --verify
 *   DATABASE_URL=… npx tsx … --oczekiwany-host 54418 --reset
 *
 * IDEMPOTENCJA: etap SQL adresuje wiersze po deterministycznych id
 * (`00-wspolne.ts:det`) albo po naturalnym kluczu (tytul zadania/inicjatywy),
 * a UPDATE-y sa wartosciowe — drugi `--apply` daje `utworzono=0 zmieniono=0`.
 * Etap API uzywa `idempotencyKey`, wiec powtorzone zadanie zwraca istniejacy
 * rekord zamiast bliznaka. `--dry-run` wykonuje DOKLADNIE te same instrukcje
 * SQL i ROLLBACK-uje; etap API w `--dry-run` NIE jest wolany (HTTP nie cofa sie
 * z transakcji — to jest powiedziane w logu, nie przemilczane).
 *
 * ZALEZNOSCI: `01-rdzen.ts` (osoby, profil), `03-inicjatywy.ts` (13 inicjatyw),
 * `04-realizacja.ts` (42 zadania), `05-wyniki-finanse.ts` (karta KPI + 8 pozycji),
 * `06-materialy.ts` (7 artefaktow).
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

// ============================================================================
// Tozsamosci — liczone tak samo jak w D1-D6
// ============================================================================
const email = (slug: string) => `${slug}@${DOMENA}`;
const uid = (slug: string) => det('user', email(slug));

const WLASCICIEL = 'james.whitfield';

// ============================================================================
// BRAK 1 — PROFIL ORGANIZACJI
// ============================================================================

/**
 * `industry` MUSI byc wartoscia ze slownika `INDUSTRIES`
 * (`organizationProfileTaxonomy.tsx:164-183`), inaczej `<select>` na ekranie
 * Identity nie ma pasujacej opcji i pokazuje „—" (defekt D-03 raportu).
 * „Industrial Manufacturing" nie jest w slowniku; „Manufacturing" jest.
 */
export const BRANZA_ZE_SLOWNIKA = 'Manufacturing';

export const PROFIL_D9 = {
  industry: BRANZA_ZE_SLOWNIKA,
  // NACE Rev. 2 / UK SIC 25.62 — „Machining". Kod branzy, nie nazwa.
  industry_code: 'C25.62',
  industry_subsector: 'Precision Components',
  description:
    'Northwind Manufacturing Ltd. machines and assembles precision components for pump, ' +
    'compressor and driveline builders across the UK and northern Europe. Three plants ' +
    '(Leeds, Rotherham and Telford) run 340 people over a two-shift pattern, with a ' +
    'single ERP and a machining base that is still largely paper-driven below the ' +
    'work-order layer.',
  strategic_priorities: [
    'Raise overall equipment effectiveness on the machining lines from 61 % to 78 % by the end of 2027',
    'Cut internal scrap cost by a third through in-process quality control rather than end-of-line inspection',
    'Digitise work instructions and shift handover across all three plants',
    'Move maintenance from calendar-based to condition-based planning on the CNC estate',
  ],
  // Skala 1-7 (`OrganizationDirectionConstraintsScreen.tsx:96` — „Digital Maturity (1-7)").
  // 3,4 odpowiada ocenie 3/5 z zakonczonego Assessmentu Northwind (7 osi).
  digital_maturity_overall: 3.4,
  technology_stack: [
    'SAP ECC 6.0 — ERP, single instance across all three plants',
    'Siemens Opcenter MES — Line 3 pilot only',
    'Ignition SCADA — Leeds shop floor',
    'Microsoft 365 and Power BI — reporting',
    'Maximo — maintenance work orders',
  ],
  primary_markets: ['United Kingdom', 'Germany', 'Poland', 'Republic of Ireland'],
  customer_segments: [
    'Pump and compressor OEMs',
    'Driveline and transmission tier-one suppliers',
    'Industrial aftermarket and spares distribution',
  ],
  key_competitors: [
    'Halstead Precision Engineering',
    'Hartmann Feinmechanik GmbH',
    'Delta Machining Group',
  ],
  regulatory_environment: [
    'ISO 9001:2015 quality management',
    'IATF 16949 automotive quality management',
    'ISO 14001 environmental management',
    'UK REACH chemical registration',
    'Machinery Directive 2006/42/EC',
  ],
  cloud_adoption_level: 'HYBRID',
  digital_budget_percent: 2.4,
} as const;

/**
 * PRZEPISANIE 1:1 `computeCompleteness()` z
 * `src/views/ContextBuilder/modules/organizationProfileTaxonomy.tsx:317-340`.
 *
 * NIE wpisujemy 100 na sztywno: backend tej liczby NIE LICZY (przyjmuje ja
 * z ciala PUT, `organization-profiles.routes.ts:439,502`), wiec jedynym
 * „mechanizmem produktu" jest ta funkcja. Gdy front zmieni liste pol, test
 * `09-dosiew.test.ts` porownujacy obie listy ma zaczac krzyczec.
 */
export const POLA_KOMPLETNOSCI = [
  'organization_type',
  'industry',
  'companySize',
  'headquarters_country',
  'strategic_priorities',
  'competitive_position',
  'growth_stage',
  'technology_stack',
  'mission_statement',
  'description',
  'employee_count',
  'risk_appetite',
  'regulatory_environment',
  'communication_style',
  'key_competitors',
] as const;

export function policzKompletnosc(p: Record<string, unknown>): number {
  const wypelnione = (klucz: string): boolean => {
    const v = p[klucz];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
    return Boolean(v);
  };
  const spelnione = POLA_KOMPLETNOSCI.filter((k) => wypelnione(k)).length;
  return Math.round((spelnione / POLA_KOMPLETNOSCI.length) * 100);
}

// ============================================================================
// BRAK 2 — PRZYDZIALY WYWIADU
//
// Szablony sa GLOBALNE (`interview_library_templates.organization_id IS NULL`),
// po angielsku i w stanie `approved` — pomiar 09.09 na kopii. Nie tworzymy
// wlasnych: uzycie biblioteki jest tym, co robi produkt.
// ============================================================================
export const PRZYDZIALY = [
  {
    slug: 'strategic-direction',
    templateId: 'v6_t03_strategic_direction_discovery',
    assignee: WLASCICIEL,
    // `assigned` = kanoniczny odpowiednik „pending" ze zlecenia (patrz P2).
    status: 'assigned',
    dniDoTerminu: 11,
    priority: 'high',
    processRef: 'northwind:strategy-2027:en',
    notes:
      'Steering group asked for the 2027 direction to be captured in the tool before the October board review.',
    sesja: null as string | null,
    czlonkowie: [WLASCICIEL, 'sarah.mitchell'],
  },
  {
    slug: 'plant-operations-leeds',
    templateId: 'v6_t07_manufacturing_walkthrough',
    assignee: 'sarah.mitchell',
    // `submitted` = kanoniczny odpowiednik „answered".
    status: 'submitted',
    dniDoTerminu: -6,
    priority: 'medium',
    processRef: 'northwind:plant-operations-leeds:en',
    notes: 'Walkthrough of the Leeds machining cells ahead of the MES rollout on Line 3.',
    sesja: 'Plant Operations — Leeds',
    czlonkowie: ['sarah.mitchell', 'emily.carter', WLASCICIEL],
  },
  {
    slug: 'quality-compliance',
    templateId: 'v6_t18_quality_compliance_risk',
    assignee: 'robert.chen',
    status: 'approved',
    dniDoTerminu: -20,
    priority: 'medium',
    processRef: 'northwind:quality-compliance:en',
    notes: 'Quality and compliance baseline for the supplier quality gate business case.',
    sesja: 'Quality & Compliance — Head of Quality',
    czlonkowie: ['robert.chen', WLASCICIEL],
  },
] as const;

// ============================================================================
// BRAK 3 — MIGAWKA PRZEGLADU KARTY KPI
// ============================================================================
export const KARTA_KPI_NAZWA = 'Northwind 2027 — monthly performance report';
/** Okres przegladu = trzeci kwartal 2026, czyli kwartal, ktory karta domyka. */
export const OKRES_PRZEGLADU = {
  od: '2026-07-01T00:00:00.000Z',
  do: '2026-09-30T23:59:59.000Z',
} as const;

// ============================================================================
// BRAK 4 — ROZKLAD PRACOCHLONNOSCI ZADAN
//
// Cel liczbowy z RAPORT_DANE §5 poz. 4: popyt w >= 6 z 8 tygodni i
// wykorzystanie > 40 %. Podaz Northwind = 338 h/tydzien (9 osob), czyli
// 2704 h w oknie osmiu tygodni; 40 % = 1082 h popytu.
//
// Stan zastany: 356 h. NIE „rozkladamy terminow" (osiem tygodni juz ma popyt
// — premisa P3), tylko URALNIAMY PRACOCHLONNOSC. 30 h na „Commission the
// MES-to-SCADA data bridge" to niecale cztery dni jednej osoby na most
// integracyjny miedzy MES a SCADA — to byla liczba nie do obrony. Ponizsze
// wartosci sa w skali osobo-tygodni programu transformacji.
//
// `startPrzed` = ile DNI przed terminem zaczyna sie praca. Serwis rozklada
// godziny rowno miedzy `created_at` a `due_date` (`workloadCapacityService.ts:934-951`),
// wiec bez tego pola CALA praca lezalaby na tygodniu pierwszym.
// ============================================================================
export type PlanZadania = { tytul: string; godziny: number; startPrzed: number };

/** Zadania w oknie osmiu tygodni — popyt zakladki Zasoby. */
export const PLAN_POPYTU: PlanZadania[] = [
  // tydzien 1 (termin 11.09)
  { tytul: 'Validate barcode traceability at the packing station', godziny: 80, startPrzed: 21 },
  { tytul: 'Tune alert thresholds against the 2026 failure history', godziny: 40, startPrzed: 14 },
  { tytul: 'Connect the condition-monitoring gateway to the historian', godziny: 64, startPrzed: 21 },
  { tytul: 'Prepare the restart decision pack for the paused programme', godziny: 20, startPrzed: 7 },
  { tytul: 'Configure the MES work-order interface to ERP', godziny: 96, startPrzed: 28 },
  // tydzien 2 (termin 18.09)
  { tytul: 'Define the OEE calculation rules with Quality', godziny: 36, startPrzed: 14 },
  { tytul: 'Migrate paper travellers for the top twenty part numbers', godziny: 112, startPrzed: 28 },
  { tytul: 'Re-slot the pilot aisle by pick frequency', godziny: 72, startPrzed: 21 },
  { tytul: 'Write the Line 3 cutover runbook', godziny: 40, startPrzed: 14 },
  // tydzien 3 (termin 25.09)
  { tytul: 'Extend sensors to cells 3, 4 and 5', godziny: 84, startPrzed: 21 },
  { tytul: 'Run the false-positive review with the shift leads', godziny: 48, startPrzed: 14 },
  { tytul: 'Refresh the training records interface with HR', godziny: 52, startPrzed: 21 },
  { tytul: 'Commission the MES-to-SCADA data bridge', godziny: 120, startPrzed: 28 },
  // tydzien 4-8 (terminy 02.10 - 30.10)
  { tytul: 'Measure pick rate before and after re-slotting', godziny: 44, startPrzed: 21 },
  { tytul: 'Integrate the shuttle controller with the warehouse system', godziny: 104, startPrzed: 28 },
  { tytul: 'Quantify the labour saving per shift', godziny: 32, startPrzed: 21 },
  { tytul: 'Train Line 3 operators on the MES terminal', godziny: 88, startPrzed: 28 },
  { tytul: 'Document the predictive maintenance standard operating procedure', godziny: 48, startPrzed: 21 },
  { tytul: 'Cost the upskilling programme for 2027', godziny: 28, startPrzed: 14 },
];

/**
 * Zadania PO TERMINIE — zaleglosc zakladki Zasoby. Zostaja tam, gdzie sa
 * (nie przesuwamy terminow — zaleglosc ma byc widoczna), dostaja tylko realna
 * pracochlonnosc i czesciowe `actual_hours`, zeby „pozostalo" bylo mniejsze
 * niz „oszacowano" (serwis liczy `max(estimated - actual, 0)`).
 */
export const PLAN_ZALEGLOSCI: Array<{ tytul: string; godziny: number; wykonane: number }> = [
  { tytul: 'Agree the shuttle safety case with the works council', godziny: 36, wykonane: 12 },
  { tytul: 'Agree the MES downtime reason-code taxonomy', godziny: 40, wykonane: 16 },
  { tytul: 'Close the pilot aisle housekeeping actions', godziny: 24, wykonane: 10 },
  { tytul: 'Cost the spare-parts holding reduction', godziny: 28, wykonane: 8 },
  { tytul: 'Agree the cross-training rota with the shift leads', godziny: 32, wykonane: 14 },
  { tytul: 'Retrain the goods-out team on the new pick path', godziny: 30, wykonane: 12 },
  { tytul: 'Agree the maintenance work-order trigger with Planning', godziny: 26, wykonane: 6 },
  { tytul: 'Identify single points of failure per line', godziny: 44, wykonane: 20 },
];

/**
 * Zadania osobiste wlasciciela (paczka D6, `task_type='personal'`) nie mialy
 * ANI JEDNEJ estymaty — przez to wlasciciel jako jedyny mial zaleglosc 0 h
 * i jego wiersz w Zasobach byl pusty mimo dwoch zadan po terminie.
 */
export const PLAN_OSOBISTYCH: Array<{ tytul: string; godziny: number }> = [
  { tytul: 'Approve Q3 capex request', godziny: 4 },
  { tytul: 'Follow up with Rotherham plant manager on downtime log', godziny: 3 },
  { tytul: 'Sign off Line 3 MES kickoff deck', godziny: 3 },
  { tytul: 'Review supplier corrective action plan', godziny: 4 },
  { tytul: 'Draft opening remarks for steering committee', godziny: 3 },
  { tytul: 'Prepare board pack for October review', godziny: 8 },
];

// ============================================================================
// BRAK 5 — POLA POCHODNE
// ============================================================================

/**
 * LEVEL (`initiatives.current_stage`) + VARIANCE (`initiatives.baseline_end_date`)
 * + AXIS (`initiatives.axis`, slownik walidatora:
 * `strategic|operational|transformational|compliance`).
 *
 * `baseline_end_date` = pierwotny termin z zatwierdzenia biznes case'u.
 * Rozjazd wobec `planned_end_date` jest ZAMIERZONY i rozny co do znaku —
 * inaczej kolumna VARIANCE pokazywalaby zero w kazdym wierszu i nie dalaby
 * sie przetestowac (sortowanie, filtr, znak).
 */
export const POCHODNE_INICJATYW: Array<{
  tytul: string;
  stage: string;
  axis: string;
  baselineEnd: string | null;
  actualEnd?: string | null;
}> = [
  { tytul: 'MES Rollout Line 3', stage: 'Rollout', axis: 'transformational', baselineEnd: '2027-04-30' },
  { tytul: 'Warehouse Automation Pilot', stage: 'Pilot Preparation', axis: 'operational', baselineEnd: '2027-01-29' },
  { tytul: 'Predictive Maintenance for CNC Line', stage: 'Rollout', axis: 'operational', baselineEnd: '2027-01-29' },
  { tytul: 'Skills Matrix and Upskilling', stage: 'Value Realization', axis: 'operational', baselineEnd: '2027-01-29' },
  { tytul: 'Shift Handover Digitisation', stage: 'Business Case', axis: 'transformational', baselineEnd: '2027-05-28' },
  { tytul: 'Supplier Quality Gate', stage: 'Business Case', axis: 'compliance', baselineEnd: '2027-06-30' },
  { tytul: 'Energy Monitoring and ISO 50001', stage: 'Business Case', axis: 'compliance', baselineEnd: '2027-09-30' },
  { tytul: 'Scrap Reduction Programme', stage: 'Business Case', axis: 'operational', baselineEnd: '2028-03-31' },
  { tytul: 'Digital Work Instructions', stage: 'Discovery', axis: 'transformational', baselineEnd: '2027-08-31' },
  { tytul: 'Customer Portal for Order Tracking', stage: 'Discovery', axis: 'strategic', baselineEnd: '2027-12-17' },
  { tytul: 'Cybersecurity Hardening OT', stage: 'Discovery', axis: 'compliance', baselineEnd: '2027-03-31' },
  {
    tytul: 'SAP S/4 Migration Assessment',
    stage: 'Closed',
    axis: 'strategic',
    baselineEnd: '2026-05-29',
    actualEnd: '2026-06-30',
  },
  { tytul: 'Sustainability Reporting (CSRD)', stage: 'Stopped', axis: 'compliance', baselineEnd: '2027-06-30' },
];

/**
 * FORMAT (`v8_output_artifacts.origin_summary_json -> exportFormat`,
 * czytane przez `resolvePersistedArtifactFormat`). Format odpowiada rodzajowi
 * artefaktu — nie zmyslamy eksportu, ktorego nie ma: dokumenty Northwind sa
 * wydawane jako DOCX, talie jako PPTX, skoroszyt jako XLSX.
 * SOURCE (`v8_artifact_origin_links.origin_runtime`) jest JUZ wypelniony 7/7 —
 * ta kolumna nie potrzebuje zasiewu (pomiar PRZED).
 */
export const FORMATY_ARTEFAKTOW: Array<{ tytul: string; format: 'docx' | 'pptx' | 'xlsx' }> = [
  { tytul: 'Operational Excellence Charter', format: 'docx' },
  { tytul: 'OEE Baseline Report Q2 2026', format: 'docx' },
  { tytul: 'Supplier Quality Gate Procedure', format: 'docx' },
  { tytul: 'Digital Roadmap 2026–2028', format: 'docx' },
  { tytul: 'Steering Committee — September 2026', format: 'pptx' },
  { tytul: 'Line 3 MES Rollout Kick-off', format: 'pptx' },
  { tytul: 'Scrap Cost Model', format: 'xlsx' },
];

/**
 * AREA / TYPE / BENCHMARK / LIMIT % raportu KPI
 * (`rvn_kpi_scorecard_items`, czytane przez `kpiReportPresenters.tsx:660-735`;
 * `area_name` grupuje wiersze — bez niego wszystkie osiem miernikow siedzi
 * w jednej grupie „No area"). Klucz = `rvn_kpi_definitions.kpi_code`.
 */
export const POZYCJE_KARTY_KPI: Array<{
  kod: string;
  area: string;
  typ: string;
  benchmark: number;
  limit: number;
}> = [
  // Benchmark = wartosc rynkowa (mediana branzy precyzyjnej obrobki
  // skrawaniem), NIE cel Northwind — cel siedzi juz w
  // `rvn_kpi_definition_versions.target_value`. Kolumna BENCHMARK ma
  // pokazywac, gdzie jest reszta rynku, inaczej duplikowalaby cel.
  // `indicator_type` MA WLASNY SLOWNIK W BAZIE:
  // `rvn_kpi_scorecard_items_indicator_type_chk` dopuszcza WYLACZNIE
  // `settlement` albo `informational` (sprawdzone `pg_constraint` 09.09).
  // „leading/lagging" — pierwszy odruch — konczy sie naruszeniem CHECK.
  // Mapowanie zgodne z opisem karty: cztery miary rozliczeniowe (`primary`,
  // z nich rozlicza sie komitet) = `settlement`, cztery wspierajace
  // (`supporting`, wskazniki wczesne) = `informational`.
  { kod: 'NW-OEE-L3', area: 'Manufacturing Performance', typ: 'settlement', benchmark: 75, limit: 10 },
  { kod: 'NW-SCRAP', area: 'Quality', typ: 'settlement', benchmark: 3.1, limit: 15 },
  { kod: 'NW-OTD', area: 'Supply Chain', typ: 'settlement', benchmark: 94, limit: 5 },
  { kod: 'NW-DOWNTIME', area: 'Manufacturing Performance', typ: 'settlement', benchmark: 46, limit: 12 },
  { kod: 'NW-FPY', area: 'Quality', typ: 'informational', benchmark: 92, limit: 5 },
  { kod: 'NW-ENERGY', area: 'Energy & Sustainability', typ: 'informational', benchmark: 4.8, limit: 10 },
  { kod: 'NW-INV-TURNS', area: 'Supply Chain', typ: 'informational', benchmark: 8, limit: 12 },
  { kod: 'NW-TRAINING', area: 'People & Capability', typ: 'informational', benchmark: 10, limit: 20 },
];

// ============================================================================
// CLI wlasne D9 (poza `czytajWspolneArgumenty`)
// ============================================================================
type OpcjeD9 = { apiUrl: string | null; emailWlasciciela: string; haslo: string | null };

export function czytajOpcjeD9(argv: string[], hasloPlik: string): OpcjeD9 {
  let apiUrl: string | null = null;
  let emailWlasciciela = email(WLASCICIEL);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--api') apiUrl = argv[++i] ?? null;
    else if (a.startsWith('--api=')) apiUrl = a.split('=').slice(1).join('=');
    else if (a === '--email') emailWlasciciela = argv[++i] ?? emailWlasciciela;
    else if (a.startsWith('--email=')) emailWlasciciela = a.split('=').slice(1).join('=');
  }
  let haslo: string | null = null;
  if (apiUrl) {
    // Haslo NIGDY z argumentu (trafiloby do historii powloki) — wylacznie
    // z pliku poza repozytorium. Wzor z `05-wyniki-finanse.ts:120-127`.
    const tresc = fs.readFileSync(hasloPlik, 'utf8');
    const m =
      tresc.match(/Wspólne hasło do wszystkich kont poniżej \(dostęp pokazowy\): (.+)/) ??
      tresc.match(/^\s*(?:HASLO|HASŁO|PASSWORD)\s*[:=]\s*(.+)$/im);
    haslo = m?.[1]?.trim() ?? null;
    if (!haslo) throw new Error(`Nie znalazlem hasla w pliku ${hasloPlik}. Etap API nie ruszy.`);
  }
  return { apiUrl: apiUrl ? apiUrl.replace(/\/$/, '') : null, emailWlasciciela, haslo };
}

// ============================================================================
// Klient API — wzor 1:1 z `05-wyniki-finanse.ts:136-183`
// ============================================================================
const json = (v: unknown): string => JSON.stringify(v);

export class Api {
  private cookie = '';
  private bearer = '';
  constructor(private readonly base: string) {}

  async zaloguj(adres: string, haslo: string): Promise<void> {
    const r = await fetch(`${this.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json({ email: adres, password: haslo }),
    });
    const tresc = await r.text();
    if (!r.ok) throw new Error(`Logowanie ${adres}: HTTP ${r.status} ${tresc.slice(0, 300)}`);
    const ciasteczka = r.headers.getSetCookie?.() ?? [];
    this.cookie = ciasteczka.map((c) => c.split(';')[0]).join('; ');
    const cialo = JSON.parse(tresc) as { token?: string; data?: { token?: string } };
    this.bearer = cialo.token ?? cialo.data?.token ?? '';
    if (!this.cookie && !this.bearer)
      throw new Error('Logowanie OK, ale ani ciasteczka, ani tokenu — etap API nie ruszy.');
  }

  async zadanie<T = unknown>(
    metoda: 'GET' | 'POST' | 'PATCH' | 'PUT',
    sciezka: string,
    cialo?: unknown
  ): Promise<{ status: number; body: T }> {
    const r = await fetch(`${this.base}${sciezka}`, {
      method: metoda,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
      },
      ...(cialo === undefined ? {} : { body: json(cialo) }),
    });
    const tekst = await r.text();
    let body: unknown = tekst;
    try {
      body = JSON.parse(tekst);
    } catch {
      /* komunikat bledu bywa HTML-em — zostaw tekst */
    }
    return { status: r.status, body: body as T };
  }
}

/** Cichy blad pisarza konczy sie „ekran pusty, a skrypt melduje sukces". */
function wymagajOk(co: string, w: { status: number; body: unknown }, dopuszczalne = [200, 201]): void {
  if (!dopuszczalne.includes(w.status))
    throw new Error(`${co}: HTTP ${w.status} ${JSON.stringify(w.body).slice(0, 400)}`);
}

const kluczIdem = (co: string): string => `nw-d9-${co}`.slice(0, 200);

// ============================================================================
// Pomocnicze — daty
// ============================================================================
const DZIEN_MS = 86_400_000;

/** Poniedzialek tygodnia, w ktorym wypada `data` (zgodnie z `getMonday`). */
export function poniedzialek(data: Date): Date {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const dzien = d.getDay();
  d.setDate(d.getDate() - (dzien === 0 ? 6 : dzien - 1));
  return d;
}

const iso = (d: Date): string => d.toISOString();

// ============================================================================
// ETAP SQL — BRAK 2 (czlonkowie + statusy), BRAK 4, BRAK 5
// ============================================================================
async function etapSql(c: PoolClient, lic: Licznik): Promise<void> {
  const teraz = new Date();
  const poniedzialekTegoTygodnia = poniedzialek(teraz);

  // --- BRAK 4a: popyt --------------------------------------------------
  for (const z of PLAN_POPYTU) {
    const r = await c.query(
      `UPDATE tasks
          SET estimated_hours = $3,
              effort_estimate_hours = $3,
              created_at = due_date - ($4 || ' days')::interval,
              -- UWAGA: tasks.started_at jest kolumna TEKSTOWA (pomiar
              -- information_schema 09.09), nie timestamp — stad rzutowanie
              -- na text zamiast bezposredniego przypisania.
              started_at = CASE WHEN started_at IS NULL THEN NULL
                                ELSE (due_date - ($4 || ' days')::interval)::text END,
              updated_at = now()
        WHERE organization_id = $1 AND title = $2
          AND (estimated_hours IS DISTINCT FROM $3
               OR created_at IS DISTINCT FROM due_date - ($4 || ' days')::interval)`,
      [ORG_ID, z.tytul, z.godziny, String(z.startPrzed)]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();
  }

  // --- BRAK 4b: zaleglosc ----------------------------------------------
  for (const z of PLAN_ZALEGLOSCI) {
    const r = await c.query(
      `UPDATE tasks
          SET estimated_hours = $3, effort_estimate_hours = $3, actual_hours = $4, updated_at = now()
        WHERE organization_id = $1 AND title = $2
          AND (estimated_hours IS DISTINCT FROM $3 OR actual_hours IS DISTINCT FROM $4)`,
      [ORG_ID, z.tytul, z.godziny, z.wykonane]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();
  }

  // --- BRAK 4c: zadania osobiste wlasciciela ----------------------------
  for (const z of PLAN_OSOBISTYCH) {
    const r = await c.query(
      `UPDATE tasks
          SET estimated_hours = $3, effort_estimate_hours = $3, updated_at = now()
        WHERE organization_id = $1 AND title = $2 AND estimated_hours IS DISTINCT FROM $3`,
      [ORG_ID, z.tytul, z.godziny]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();
  }

  // --- BRAK 5a: LEVEL / VARIANCE / AXIS na inicjatywach ------------------
  for (const i of POCHODNE_INICJATYW) {
    const r = await c.query(
      // UWAGA TYPY (pomiar information_schema 09.09): `baseline_end_date` jest
      // kolumna TEKSTOWA, a `actual_end_date` to `timestamp without time zone`.
      // Rzutowanie na `timestamptz` konczylo sie „operator does not exist:
      // text = timestamp with time zone" — dlatego kazda z nich ma wlasny typ.
      `UPDATE initiatives
          SET current_stage = $3, axis = $4,
              baseline_end_date = $5::text,
              actual_end_date = COALESCE($6::timestamp, actual_end_date),
              updated_at = now()
        WHERE organization_id = $1 AND title = $2
          AND (current_stage IS DISTINCT FROM $3
               OR axis IS DISTINCT FROM $4
               OR baseline_end_date IS DISTINCT FROM $5::text
               OR ($6::timestamp IS NOT NULL AND actual_end_date IS DISTINCT FROM $6::timestamp))`,
      [ORG_ID, i.tytul, i.stage, i.axis, i.baselineEnd, i.actualEnd ?? null]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();
  }

  // --- BRAK 5b: FORMAT artefaktow ---------------------------------------
  // `origin_summary_json` jest kolumna TEKSTOWA (nie jsonb) — czyta ja
  // `safeJsonParse` w `resolvePersistedArtifactFormat`. Scalamy, zeby nie
  // zgubic tego, co juz w niej stoi.
  for (const a of FORMATY_ARTEFAKTOW) {
    const r = await c.query(
      `UPDATE v8_output_artifacts
          SET origin_summary_json = (
                COALESCE(NULLIF(origin_summary_json, '')::jsonb, '{}'::jsonb)
                || jsonb_build_object('exportFormat', $3::text)
              )::text
        WHERE organization_id = $1 AND title_snapshot = $2 AND artifact_family <> 'template'
          AND COALESCE(NULLIF(origin_summary_json, '')::jsonb, '{}'::jsonb) ->> 'exportFormat'
              IS DISTINCT FROM $3::text`,
      [ORG_ID, a.tytul, a.format]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();
  }

  // --- BRAK 5c: AREA / TYPE / BENCHMARK / LIMIT % raportu KPI ------------
  for (const p of POZYCJE_KARTY_KPI) {
    const r = await c.query(
      `UPDATE rvn_kpi_scorecard_items i
          SET area_name = $3, indicator_type = $4, benchmark_value = $5, limit_percent = $6
         FROM rvn_kpi_definitions d
        WHERE d.kpi_id = i.kpi_id AND d.kpi_code = $2
          AND i.organization_id = $1
          AND (i.area_name IS DISTINCT FROM $3 OR i.indicator_type IS DISTINCT FROM $4
               OR i.benchmark_value IS DISTINCT FROM $5 OR i.limit_percent IS DISTINCT FROM $6)`,
      [ORG_ID, p.kod, p.area, p.typ, p.benchmark, p.limit]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();
  }

  // --- BRAK 2b: statusy przydzialow + wiazanie z sesjami + czlonkowie ----
  //
  // DLACZEGO SQL, A NIE PISARZ: przejscie `assigned -> submitted` robi
  // `POST /api/interview/assignments/:id/submit`, ale ten pisarz TWORZY NOWA
  // SESJE (`startAssignment` -> `interview_sessions`). Northwind ma dokladnie
  // dwie sesje z 22 odpowiedziami (D2) i to do NICH przydzialy maja sie
  // odnosic — wywolanie pisarza dolozyloby trzecia i czwarta sesje bez ani
  // jednej odpowiedzi, czyli pogorszyloby dane, ktore mamy naprawic.
  // Sam WIERSZ przydzialu powstaje pisarzem kanonicznym (etap API).
  for (const p of PRZYDZIALY) {
    const idPrzydzialu = await idPrzydzialuZBazy(c, p.processRef);
    if (!idPrzydzialu) continue;

    let sesjaId: string | null = null;
    if (p.sesja) {
      const s = await c.query<{ id: string }>(
        'SELECT id FROM interview_sessions WHERE organization_id = $1 AND name = $2 LIMIT 1',
        [ORG_ID, p.sesja]
      );
      sesjaId = s.rows[0]?.id ?? null;
      if (!sesjaId)
        throw new Error(
          `Nie znalazlem sesji wywiadu „${p.sesja}". Uruchom najpierw 02-odkrycie.ts --apply (D2).`
        );
    }

    const zlozono = p.status === 'submitted' || p.status === 'approved' ? iso(new Date(Date.now() + p.dniDoTerminu * DZIEN_MS)) : null;
    const r = await c.query(
      `UPDATE interview_assignments
          SET status = $2, session_id = COALESCE($3, session_id),
              started_at = COALESCE(started_at, $4::timestamptz),
              submitted_at = COALESCE(submitted_at, $5::timestamptz),
              updated_at = now()
        WHERE id = $1 AND (status IS DISTINCT FROM $2 OR session_id IS DISTINCT FROM COALESCE($3, session_id))`,
      [idPrzydzialu, p.status, sesjaId, zlozono, zlozono]
    );
    if ((r.rowCount ?? 0) > 0) lic.zmien();
    else lic.pomin();

    // Sesja musi tez wskazywac przydzial — `getMyAssignments` LEFT JOIN-uje
    // `interview_sessions s ON s.id = a.session_id`, a ekran sesji czyta
    // `assignment_id` w druga strone.
    if (sesjaId) {
      const rs = await c.query(
        `UPDATE interview_sessions SET assignment_id = $2, updated_at = now()
          WHERE id = $1 AND assignment_id IS DISTINCT FROM $2`,
        [sesjaId, idPrzydzialu]
      );
      if ((rs.rowCount ?? 0) > 0) lic.zmien();
      else lic.pomin();
    }

    for (const slug of p.czlonkowie) {
      const czlonekId = det('interview-assignment-member', `${p.slug}|${slug}`);
      const rm = await c.query(
        `INSERT INTO interview_assignment_members
           (id, assignment_id, user_id, role, progress_percent, joined_at, completed_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5, now(), $6, now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [
          czlonekId,
          idPrzydzialu,
          uid(slug),
          slug === p.assignee ? 'lead' : 'contributor',
          p.status === 'assigned' ? 0 : 100,
          p.status === 'assigned' ? null : new Date().toISOString(),
        ]
      );
      if ((rm.rowCount ?? 0) > 0) lic.utworz();
      else lic.pomin();
    }
  }

  void poniedzialekTegoTygodnia;
}

async function idPrzydzialuZBazy(c: PoolClient, processRef: string): Promise<string | null> {
  const r = await c.query<{ id: string }>(
    'SELECT id FROM interview_assignments WHERE organization_id = $1 AND process_ref = $2 LIMIT 1',
    [ORG_ID, processRef]
  );
  return r.rows[0]?.id ?? null;
}

// ============================================================================
// ETAP API — BRAK 1 (profil), BRAK 2a (utworzenie przydzialow), BRAK 3 (migawka)
// ============================================================================
async function etapApi(c: PoolClient, api: Api, lic: Licznik): Promise<void> {
  // --- BRAK 1: profil organizacji przez pisarza kanonicznego -------------
  const istniejacy = await c.query<{
    organization_type: string | null;
    company_size: string | null;
    headquarters_country: string | null;
    competitive_position: string | null;
    growth_stage: string | null;
    mission_statement: string | null;
    employee_count: number | null;
    risk_appetite: string | null;
    communication_style: string | null;
  }>(
    `SELECT organization_type, company_size, headquarters_country, competitive_position,
            growth_stage, mission_statement, employee_count, risk_appetite, communication_style
       FROM organization_profiles WHERE organization_id = $1`,
    [ORG_ID]
  );
  const stary = istniejacy.rows[0];
  if (!stary)
    throw new Error('Brak wiersza organization_profiles. Uruchom najpierw 01-rdzen.ts --apply (D1).');

  const ladunek: Record<string, unknown> = {
    description: PROFIL_D9.description,
    industry: PROFIL_D9.industry,
    industry_code: PROFIL_D9.industry_code,
    industry_subsector: PROFIL_D9.industry_subsector,
    strategic_priorities: [...PROFIL_D9.strategic_priorities],
    technology_stack: [...PROFIL_D9.technology_stack],
    primary_markets: [...PROFIL_D9.primary_markets],
    customer_segments: [...PROFIL_D9.customer_segments],
    key_competitors: [...PROFIL_D9.key_competitors],
    regulatory_environment: [...PROFIL_D9.regulatory_environment],
    digital_maturity_overall: PROFIL_D9.digital_maturity_overall,
    digital_budget_percent: PROFIL_D9.digital_budget_percent,
    cloud_adoption_level: PROFIL_D9.cloud_adoption_level,
    // Pola, ktore JUZ SA w bazie — wchodza do ladunku wylacznie po to, zeby
    // `policzKompletnosc` liczyla z PELNEGO stanu profilu (formula frontu
    // liczy z calego obiektu, nie z samej roznicy).
    organization_type: stary.organization_type,
    companySize: stary.company_size,
    headquarters_country: stary.headquarters_country,
    competitive_position: stary.competitive_position,
    growth_stage: stary.growth_stage,
    mission_statement: stary.mission_statement,
    employee_count: stary.employee_count,
    risk_appetite: stary.risk_appetite,
    communication_style: stary.communication_style,
  };
  ladunek.profile_completeness = policzKompletnosc(ladunek);

  const odpProfil = await api.zadanie('PUT', `/api/organization-profiles/${ORG_ID}`, ladunek);
  wymagajOk('BRAK 1 — profil organizacji', odpProfil);
  lic.zmien();
  console.log(
    `[d9] BRAK 1: profil zapisany, kompletnosc = ${ladunek.profile_completeness} % ` +
      `(${POLA_KOMPLETNOSCI.length} pol formuly frontu)`
  );

  // --- BRAK 2a: utworzenie przydzialow pisarzem kanonicznym --------------
  for (const p of PRZYDZIALY) {
    if (await idPrzydzialuZBazy(c, p.processRef)) {
      lic.pomin();
      continue;
    }
    const odp = await api.zadanie('POST', '/api/interview/assignments', {
      assigneeUserId: uid(p.assignee),
      templateId: p.templateId,
      templateVersion: 1,
      dueAt: iso(new Date(Date.now() + p.dniDoTerminu * DZIEN_MS)),
      priority: p.priority,
      processRef: p.processRef,
      notes: p.notes,
      idempotencyKey: kluczIdem(`assignment-${p.slug}`),
    });
    wymagajOk(`BRAK 2 — przydzial ${p.slug}`, odp);
    lic.utworz();
  }

  // --- BRAK 3: migawka przegladu karty KPI -------------------------------
  const karta = await c.query<{ scorecard_id: string; row_version: number }>(
    'SELECT scorecard_id, row_version FROM rvn_kpi_scorecards WHERE organization_id = $1 AND name = $2',
    [ORG_ID, KARTA_KPI_NAZWA]
  );
  const scorecardId = karta.rows[0]?.scorecard_id;
  if (!scorecardId)
    throw new Error(
      `Nie znalazlem karty KPI „${KARTA_KPI_NAZWA}". Uruchom najpierw 05-wyniki-finanse.ts --apply (D5).`
    );

  const juz = await c.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecard_review_snapshots
      WHERE organization_id = $1 AND scorecard_id = $2 AND status = 'published'`,
    [ORG_ID, scorecardId]
  );
  if (Number(juz.rows[0]?.n ?? 0) > 0) {
    lic.pomin();
  } else {
    const utworz = await api.zadanie<{
      snapshot: { snapshotId: string; rowVersion: number };
      resultingVersion?: number;
    }>('POST', `/api/vnext/results/kpi/scorecards/${scorecardId}/review-snapshots`, {
      reviewPeriodStart: OKRES_PRZEGLADU.od,
      reviewPeriodEnd: OKRES_PRZEGLADU.do,
      reason: 'Q3 2026 performance review for the plant management meeting',
      idempotencyKey: kluczIdem('review-snapshot-q3-2026'),
    });
    wymagajOk('BRAK 3 — utworzenie migawki (draft)', utworz);
    const snapshotId = utworz.body.snapshot?.snapshotId;
    const wersja = utworz.body.snapshot?.rowVersion ?? utworz.body.resultingVersion ?? 1;
    if (!snapshotId)
      throw new Error(`BRAK 3 — pisarz nie zwrocil snapshotId: ${JSON.stringify(utworz.body).slice(0, 300)}`);

    const publikuj = await api.zadanie(
      'POST',
      `/api/vnext/results/kpi/scorecards/${scorecardId}/review-snapshots/${snapshotId}/publish`,
      {
        expectedVersion: wersja,
        reason: 'Published for the September steering committee',
        idempotencyKey: kluczIdem('review-snapshot-q3-2026-publish'),
      }
    );
    wymagajOk('BRAK 3 — publikacja migawki', publikuj);
    lic.utworz();

    // Bramka uczciwosci: pisarz odpowiedzial 200, ale liczy sie to, co ODCZYTA
    // ekran. Bez tego sprawdzenia meldunek „migawka opublikowana" moglby byc
    // prawdziwy co do HTTP i falszywy co do produktu.
    const odczyt = await api.zadanie(
      'GET',
      `/api/vnext/results/kpi/scorecards/${scorecardId}/review-snapshots/published`
    );
    wymagajOk('BRAK 3 — odczyt opublikowanej migawki (ta sama sciezka, co UI)', odczyt, [200]);
  }
}

// ============================================================================
// RESET — kasuje WYLACZNIE to, co ta paczka dodala; wartosci nadpisane
// przywraca do stanu sprzed D9 tam, gdzie stan sprzed byl NULL/pusty.
// ============================================================================
async function reset(c: PoolClient): Promise<void> {
  await c.query('BEGIN');
  try {
    const przydzialy = PRZYDZIALY.map((p) => p.processRef);
    await c.query(
      `DELETE FROM interview_assignment_members
        WHERE assignment_id IN (SELECT id FROM interview_assignments
                                 WHERE organization_id = $1 AND process_ref = ANY($2))`,
      [ORG_ID, przydzialy]
    );
    await c.query(
      `UPDATE interview_sessions SET assignment_id = NULL
        WHERE organization_id = $1
          AND assignment_id IN (SELECT id FROM interview_assignments
                                 WHERE organization_id = $1 AND process_ref = ANY($2))`,
      [ORG_ID, przydzialy]
    );
    await c.query('DELETE FROM interview_assignments WHERE organization_id = $1 AND process_ref = ANY($2)', [
      ORG_ID,
      przydzialy,
    ]);

    await c.query(
      `DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements
        WHERE snapshot_id IN (SELECT snapshot_id FROM rvn_kpi_scorecard_review_snapshots
                               WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await c.query('DELETE FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1', [ORG_ID]);

    await c.query(
      `UPDATE initiatives SET current_stage = NULL, axis = NULL, baseline_end_date = NULL
        WHERE organization_id = $1 AND title = ANY($2)`,
      [ORG_ID, POCHODNE_INICJATYW.map((i) => i.tytul)]
    );
    await c.query(
      `UPDATE v8_output_artifacts
          SET origin_summary_json = (
                (COALESCE(NULLIF(origin_summary_json, '')::jsonb, '{}'::jsonb) - 'exportFormat')::text)
        WHERE organization_id = $1 AND title_snapshot = ANY($2) AND artifact_family <> 'template'`,
      [ORG_ID, FORMATY_ARTEFAKTOW.map((a) => a.tytul)]
    );
    await c.query(
      `UPDATE rvn_kpi_scorecard_items
          SET area_name = NULL, indicator_type = NULL, benchmark_value = NULL, limit_percent = NULL
        WHERE organization_id = $1`,
      [ORG_ID]
    );

    await c.query('COMMIT');
    console.log('[d9] reset: przydzialy, migawki i pola pochodne D9 usuniete.');
    console.log(
      '[d9] reset UWAGA: pracochlonnosci zadan (BRAK 4) NIE cofamy — stan sprzed D9 to ' +
        'wartosci z 04-realizacja.ts. Zeby je odtworzyc, uruchom 04-realizacja.ts --reset --apply.'
    );
    console.log('[d9] reset UWAGA: profilu organizacji (BRAK 1) nie cofamy — patrz 01-rdzen.ts --apply.');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}

// ============================================================================
// VERIFY — piec kontroli, jedna na kazdy brak z RAPORT_DANE §5
// ============================================================================
type Asercja = { nazwa: string; prog: string; oczekiwane: number; rzeczywiste: number; ok: boolean };

export async function verifyD9(c: PoolClient): Promise<Asercja[]> {
  const licz = async (sql: string, params: unknown[] = []): Promise<number> => {
    const r = await c.query<{ n: string }>(sql, params);
    return Number(r.rows[0]?.n ?? 0);
  };
  const asercje: Asercja[] = [];
  const dodaj = (nazwa: string, prog: string, oczekiwane: number, rzeczywiste: number, gte = true) =>
    asercje.push({ nazwa, prog, oczekiwane, rzeczywiste, ok: gte ? rzeczywiste >= oczekiwane : rzeczywiste === oczekiwane });

  // KONTROLA 1 — profil organizacji (RAPORT §5 poz. 1: „5 pol -> komplet").
  const profil = await c.query<{
    industry: string | null;
    industry_code: string | null;
    strategic_priorities: string | null;
    technology_stack: string | null;
    primary_markets: string | null;
    digital_maturity_overall: number | null;
    profile_completeness: number | null;
  }>(
    `SELECT industry, industry_code, strategic_priorities, technology_stack, primary_markets,
            digital_maturity_overall, profile_completeness
       FROM organization_profiles WHERE organization_id = $1`,
    [ORG_ID]
  );
  const p = profil.rows[0];
  const dlugosc = (v: string | null): number => {
    if (!v) return 0;
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };
  // Bramka na PRZYCZYNE D-03: sama niepustosc nie wystarcza — wartosc musi byc
  // w slowniku `INDUSTRIES`, inaczej `<select>` dalej pokaze „—".
  dodaj('BRAK 1 — industry ze slownika INDUSTRIES', `= '${BRANZA_ZE_SLOWNIKA}'`, 1, p?.industry === BRANZA_ZE_SLOWNIKA ? 1 : 0);
  dodaj('BRAK 1 — industry_code niepusty', '>= 1 znak', 1, (p?.industry_code ?? '').trim().length > 0 ? 1 : 0);
  dodaj('BRAK 1 — strategic_priorities', '>= 3', 3, dlugosc(p?.strategic_priorities ?? null));
  dodaj('BRAK 1 — technology_stack', '>= 3', 3, dlugosc(p?.technology_stack ?? null));
  dodaj('BRAK 1 — primary_markets', '>= 2', 2, dlugosc(p?.primary_markets ?? null));
  dodaj('BRAK 1 — digital_maturity_overall', '> 0 (skala 1-7)', 1, Number(p?.digital_maturity_overall ?? 0) > 0 ? 1 : 0);
  dodaj('BRAK 1 — profile_completeness (formula frontu, 15 pol)', '= 100 %', 100, Math.round(Number(p?.profile_completeness ?? 0)));

  // KONTROLA 2 — przydzialy wywiadu (RAPORT §5 poz. 2: „>= 3, po jednym na status").
  dodaj(
    'BRAK 2 — przydzialy Northwind',
    '>= 3',
    3,
    await licz('SELECT COUNT(*)::text AS n FROM interview_assignments WHERE organization_id = $1', [ORG_ID])
  );
  for (const st of ['assigned', 'submitted', 'approved']) {
    dodaj(
      `BRAK 2 — przydzial w statusie ${st}`,
      '>= 1',
      1,
      await licz(
        `SELECT COUNT(*)::text AS n FROM interview_assignments
          WHERE organization_id = $1 AND lower(replace(status,'-','_')) = $2`,
        [ORG_ID, st]
      )
    );
  }
  dodaj(
    'BRAK 2 — czlonkowie przydzialow',
    '>= 3',
    3,
    await licz(
      `SELECT COUNT(*)::text AS n FROM interview_assignment_members m
         JOIN interview_assignments a ON a.id = m.assignment_id
        WHERE a.organization_id = $1`,
      [ORG_ID]
    )
  );
  // Ta asercja odtwarza WARUNEK `getMyAssignments` (InterviewAssignmentService.ts:787-799),
  // a nie „czy sa jakies wiersze" — Inbox wlasciciela ma byc niepusty.
  dodaj(
    'BRAK 2 — Inbox wlasciciela (warunek getMyAssignments)',
    '>= 1',
    1,
    await licz(
      `SELECT COUNT(*)::text AS n FROM interview_assignments a
        WHERE a.organization_id = $1
          AND lower(replace(a.status,'-','_')) <> 'completed'
          AND (a.assignee_user_id = $2
               OR EXISTS (SELECT 1 FROM interview_assignment_members m
                           WHERE m.assignment_id = a.id AND m.user_id = $2))`,
      [ORG_ID, uid(WLASCICIEL)]
    )
  );

  // KONTROLA 3 — migawka przegladu (RAPORT §5 poz. 3: „>= 1 published").
  dodaj(
    'BRAK 3 — migawki przegladu w statusie published',
    '>= 1',
    1,
    await licz(
      `SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecard_review_snapshots
        WHERE organization_id = $1 AND status = 'published'`,
      [ORG_ID]
    )
  );
  // Migawka `published` z pustym `snapshot_payload` dalaby 200 z pustka —
  // to jest dokladnie ten ksztalt falszywego „gotowe", ktory sprawdzamy.
  dodaj(
    'BRAK 3 — migawka ma zmaterializowany snapshot_payload.items',
    '>= 1 pozycja',
    1,
    await licz(
      `SELECT COALESCE(MAX(jsonb_array_length(snapshot_payload -> 'items')), 0)::text AS n
         FROM rvn_kpi_scorecard_review_snapshots
        WHERE organization_id = $1 AND status = 'published' AND snapshot_payload IS NOT NULL`,
      [ORG_ID]
    )
  );

  // KONTROLA 4 — rozklad w czasie (RAPORT §5 poz. 4: „42 zadania na >= 8 tygodni",
  // cel zakladki Zasoby: popyt w >= 6 z 8 tygodni i wykorzystanie > 40 %).
  // Liczone TAK, JAK LICZY `getExecutionResourcePlan`: `estimated_hours`,
  // zadania otwarte z przypisaniem, okno osmiu tygodni od biezacego poniedzialku.
  dodaj(
    'BRAK 4 — tygodnie z popytem w oknie 8 tygodni',
    '>= 6 z 8',
    6,
    await licz(
      `SELECT COUNT(DISTINCT date_trunc('week', due_date))::text AS n
         FROM tasks
        WHERE organization_id = $1 AND assignee_id IS NOT NULL
          AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
          AND estimated_hours > 0
          AND due_date >= date_trunc('week', now())
          AND due_date <  date_trunc('week', now()) + interval '8 weeks'`,
      [ORG_ID]
    )
  );
  const popyt = await licz(
    `SELECT COALESCE(ROUND(SUM(estimated_hours)::numeric), 0)::text AS n
       FROM tasks
      WHERE organization_id = $1 AND assignee_id IS NOT NULL
        AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
        AND due_date >= date_trunc('week', now())
        AND due_date <  date_trunc('week', now()) + interval '8 weeks'`,
    [ORG_ID]
  );
  const podaz = await licz(
    `SELECT COALESCE(ROUND(SUM(COALESCE(weekly_capacity_hours,40) * COALESCE(availability_percent,100)/100.0)::numeric * 8), 0)::text AS n
       FROM users WHERE organization_id = $1`,
    [ORG_ID]
  );
  const wykorzystanie = podaz > 0 ? Math.round((popyt / podaz) * 100) : 0;
  dodaj('BRAK 4 — wykorzystanie w oknie 8 tygodni', '> 40 %', 41, wykorzystanie);
  dodaj(
    'BRAK 4 — osoby z zalegloscia (backlog > 0 h)',
    '>= 3',
    3,
    await licz(
      `SELECT COUNT(*)::text AS n FROM (
         SELECT assignee_id FROM tasks
          WHERE organization_id = $1 AND assignee_id IS NOT NULL
            AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
            AND due_date < date_trunc('week', now())
          GROUP BY assignee_id
         HAVING SUM(GREATEST(COALESCE(estimated_hours,0) - COALESCE(actual_hours,0), 0)) > 0) z`,
      [ORG_ID]
    )
  );

  // KONTROLA 5 — pola pochodne (RAPORT §5 poz. 5: „dla wszystkich istniejacych rekordow").
  dodaj(
    'BRAK 5 — LEVEL: inicjatywy z current_stage',
    '= 13 (wszystkie)',
    13,
    await licz(
      'SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1 AND current_stage IS NOT NULL',
      [ORG_ID]
    )
  );
  dodaj(
    'BRAK 5 — VARIANCE: inicjatywy z baseline_end_date',
    '= 13 (wszystkie)',
    13,
    await licz(
      'SELECT COUNT(*)::text AS n FROM initiatives WHERE organization_id = $1 AND baseline_end_date IS NOT NULL',
      [ORG_ID]
    )
  );
  dodaj(
    'BRAK 5 — AREA/AXIS: inicjatywy z area i axis',
    '= 13 (wszystkie)',
    13,
    await licz(
      `SELECT COUNT(*)::text AS n FROM initiatives
        WHERE organization_id = $1 AND area IS NOT NULL AND axis IS NOT NULL`,
      [ORG_ID]
    )
  );
  dodaj(
    'BRAK 5 — FORMAT: artefakty z exportFormat',
    '= 7 (wszystkie nie-szablony)',
    7,
    await licz(
      `SELECT COUNT(*)::text AS n FROM v8_output_artifacts
        WHERE organization_id = $1 AND artifact_family <> 'template'
          AND COALESCE(NULLIF(origin_summary_json,'')::jsonb,'{}'::jsonb) ->> 'exportFormat'
              IN ('docx','pdf','pptx','xlsx')`,
      [ORG_ID]
    )
  );
  dodaj(
    'BRAK 5 — SOURCE: artefakty z origin_runtime',
    '= 7 (wszystkie nie-szablony)',
    7,
    await licz(
      `SELECT COUNT(*)::text AS n FROM v8_artifact_origin_links l
         JOIN v8_output_artifacts a ON a.artifact_id = l.artifact_id
        WHERE a.organization_id = $1 AND a.artifact_family <> 'template'
          AND COALESCE(l.origin_runtime,'') <> ''`,
      [ORG_ID]
    )
  );
  dodaj(
    'BRAK 5 — raport KPI: pozycje z AREA i TYPE',
    '= 8 (wszystkie)',
    8,
    await licz(
      `SELECT COUNT(*)::text AS n FROM rvn_kpi_scorecard_items
        WHERE organization_id = $1 AND area_name IS NOT NULL AND indicator_type IS NOT NULL`,
      [ORG_ID]
    )
  );

  // Bramka jezykowa — dane D9 maja byc po angielsku.
  dodaj(
    'D9 — polskie znaki w danych dosianych przez ten etap',
    '= 0',
    0,
    await licz(
      `SELECT (
         (SELECT COUNT(*) FROM organization_profiles
           WHERE organization_id = $1
             AND (COALESCE(strategic_priorities,'') || COALESCE(technology_stack,'')
                  || COALESCE(primary_markets,'') || COALESCE(industry_code,'')) ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
       + (SELECT COUNT(*) FROM interview_assignments
           WHERE organization_id = $1 AND COALESCE(notes,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
       + (SELECT COUNT(*) FROM initiatives
           WHERE organization_id = $1 AND COALESCE(current_stage,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
       + (SELECT COUNT(*) FROM rvn_kpi_scorecard_items
           WHERE organization_id = $1 AND COALESCE(area_name,'') ~ '[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]')
       )::text AS n`,
      [ORG_ID]
    ),
    false
  );

  return asercje;
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    if (!a.ok) bledy++;
    console.log(
      `[verify] ${a.ok ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(58)} prog ${a.prog.padEnd(28)} rzeczywiste=${a.rzeczywiste}`
    );
  }
  if (bledy > 0) {
    console.error(`\n[verify] FAIL: ${bledy} z ${asercje.length} asercji nie przeszlo.`);
    process.exitCode = 1;
  } else {
    console.log(`\n[verify] PASS: wszystkie ${asercje.length} asercji przeszly (5/5 kontroli).`);
  }
}

// ============================================================================
// main
// ============================================================================
async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  const d9 = czytajOpcjeD9(process.argv.slice(2), opcje.hasloPlik);
  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[d9] cel:  ${toz}`);
    console.log(`[d9] tryb: ${opcje.tryb}`);
    console.log(`[d9] organizacja: ${ORG_NAZWA}`);

    if (opcje.tryb === 'reset') {
      await reset(c);
      return;
    }
    if (opcje.tryb === 'verify') {
      wypiszIZakoncz(await verifyD9(c));
      return;
    }

    const org = await c.query('SELECT 1 FROM organizations WHERE id = $1', [ORG_ID]);
    if (org.rows.length === 0)
      throw new Error(`Organizacja "${ORG_ID}" nie istnieje. Uruchom najpierw 01-rdzen.ts --apply.`);

    const lic = new Licznik();

    // ETAP API — tylko przy --apply i tylko z --api. HTTP nie cofa sie razem
    // z transakcja, wiec w --dry-run go NIE WOLAMY i mowimy o tym wprost.
    if (opcje.tryb === 'apply' && d9.apiUrl && d9.haslo) {
      const api = new Api(d9.apiUrl);
      await api.zaloguj(d9.emailWlasciciela, d9.haslo);
      console.log(`[d9] etap API: zalogowany jako ${d9.emailWlasciciela} na ${d9.apiUrl}`);
      await etapApi(c, api, lic);
    } else if (opcje.tryb === 'apply') {
      console.log(
        '[d9] etap API POMINIETY (brak --api). BRAK 1 (profil), BRAK 2a (utworzenie ' +
          'przydzialow) i BRAK 3 (migawka) NIE zostana dosiane — --verify to pokaze.'
      );
    } else {
      console.log('[d9] etap API pominiety w --dry-run (HTTP nie cofa sie z ROLLBACK-iem).');
    }

    // ETAP SQL — jedna transakcja, `--dry-run` ROLLBACK-uje.
    await c.query('BEGIN');
    try {
      await etapSql(c, lic);
      if (opcje.tryb === 'apply') await c.query('COMMIT');
      else await c.query('ROLLBACK');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    }

    console.log('\n' + lic.raport('d9'));
    if (opcje.tryb === 'dry-run')
      console.log('[d9] dry-run: transakcja SQL wykonana i wycofana (ROLLBACK) — nic nie zapisano.');
    else if (lic.utworzono === 0 && lic.zmieniono === 0)
      console.log('[d9] idempotentnie: nic nie bylo do zrobienia.');
  } finally {
    c.release();
    await pool.end();
  }
}

// Uruchamiamy main WYLACZNIE, gdy plik jest wywolany jako skrypt — test
// importuje z niego stale i funkcje czyste (`policzKompletnosc`, plany).
const wywolanyJakoSkrypt =
  typeof process.argv[1] === 'string' && process.argv[1].includes('09-dosiew-po-tescie');
if (wywolanyJakoSkrypt) {
  main().catch((e) => {
    console.error(`[d9] BLAD: ${(e as Error).message}`);
    process.exit(1);
  });
}

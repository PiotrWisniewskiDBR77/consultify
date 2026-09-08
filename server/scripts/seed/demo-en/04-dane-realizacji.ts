/**
 * D4 — DANE REALIZACJI organizacji „Northwind Manufacturing Ltd." (`northwind`)
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D4, §3.1 poz. 7).
 *
 * Wyłącznie DANE (po angielsku) + słowniki zmierzone w kodzie. Mechanika siedzi
 * w `04-realizacja.ts`. Podział jak w D3 (`03-dane-inicjatyw.ts`), żeby plik
 * mechaniki dało się czytać bez przewijania trzystu wierszy treści.
 *
 * ZAKOTWICZENIE W CZASIE: „dziś" = 2026-09-08 (wtorek). Poniedziałek bieżącego
 * tygodnia = 2026-09-07 — to jest granica, po której `workloadCapacityService.ts`
 * (`:918-934`) przenosi zadanie z POPYTU do ZALEGŁOŚCI. Wszystkie terminy poniżej
 * są dobrane WZGLĘDEM tej granicy i celowo NIE są liczone od `Date.now()`:
 * baza pokazowa ma wyglądać tak samo w każdy dzień odbioru.
 */

// ============================================================================
// Osoby — slugi zgodne z `01-rdzen.ts` (e-mail = `<slug>@northwind.example`)
// ============================================================================
export const OSOBY = [
  'james.whitfield',
  'sarah.mitchell',
  'robert.chen',
  'emily.carter',
  'daniel.osei',
  'laura.novak',
  'michael.grant',
  'priya.sharma',
  'thomas.baker',
] as const;
export type SlugOsoby = (typeof OSOBY)[number];

/** Cztery inicjatywy `IN_EXECUTION` z D3 (`03-dane-inicjatyw.ts`). */
export const SLUGI_REALIZOWANE = [
  'mes-rollout-line-3',
  'predictive-maintenance-cnc',
  'warehouse-automation-pilot',
  'skills-matrix-upskilling',
] as const;
export type SlugInicjatywy = (typeof SLUGI_REALIZOWANE)[number];

// ============================================================================
// ZADANIA — 36, każde z inicjatywą, osobą, terminem i pracochłonnością
//
// Słownik statusów: `server/src/validators/task.validators.ts:14-23`
//   todo | in_progress | review | done | blocked | on_hold | backlog | cancelled
// Priorytety (`:24`): low | medium | high | urgent | critical
// Typy (`:25-35`): execution | analysis | decision | design | build | test |
//   deploy | interview | other
//
// `start` trafia do `tasks.created_at` — to JEST początek okna zadania w liczeniu
// popytu (`workloadCapacityService.ts:854-856`: `created_at AS start_at`;
// tabela `tasks` NIE ma kolumny daty startu — zmierzone w `information_schema`).
// ============================================================================
export interface Zadanie {
  slug: string;
  inicjatywa: SlugInicjatywy;
  tytul: string;
  opis: string;
  osoba: SlugOsoby;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priorytet: 'low' | 'medium' | 'high' | 'urgent' | 'critical';
  typ: 'execution' | 'analysis' | 'decision' | 'design' | 'build' | 'test' | 'deploy';
  start: string;
  termin: string;
  godziny: number;
  godzinyFaktyczne: number;
  /** Kryterium odbioru — kolumna `acceptance_criteria`, widoczna w podglądzie zadania. */
  kryterium: string;
}

export const ZADANIA: readonly Zadanie[] = [
  // --- MES Rollout Line 3 (10) -------------------------------------------------
  {
    slug: 'mes-terminals',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Install shop-floor terminals on Line 3',
    opis: 'Mount and network the eleven ruggedised terminals along Line 3, including the two packing stations.',
    osoba: 'laura.novak',
    status: 'done',
    priorytet: 'high',
    typ: 'build',
    start: '2026-05-04',
    termin: '2026-06-26',
    godziny: 60,
    godzinyFaktyczne: 62,
    kryterium: 'All eleven terminals reachable from the MES server with under 50 ms latency.',
  },
  {
    slug: 'mes-erp-interface',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Configure the MES work-order interface to ERP',
    opis: 'Map work orders, routings and material issues between the MES and the ERP production module.',
    osoba: 'laura.novak',
    status: 'in_progress',
    priorytet: 'critical',
    typ: 'build',
    start: '2026-09-07',
    termin: '2026-09-11',
    godziny: 24,
    godzinyFaktyczne: 9,
    kryterium: 'Ten test work orders flow end to end without manual correction.',
  },
  {
    slug: 'mes-traceability',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Validate barcode traceability at the packing station',
    opis: 'Prove that a finished pallet can be traced back to batch, machine and operator in one query.',
    osoba: 'laura.novak',
    status: 'todo',
    priorytet: 'high',
    typ: 'test',
    start: '2026-09-07',
    termin: '2026-09-11',
    godziny: 24,
    godzinyFaktyczne: 0,
    kryterium: 'Traceability query returns batch, machine and operator for twenty sampled pallets.',
  },
  {
    slug: 'mes-travellers',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Migrate paper travellers for the top twenty part numbers',
    opis: 'Rebuild the twenty highest-volume travellers as MES routings and retire the printed copies.',
    osoba: 'emily.carter',
    status: 'in_progress',
    priorytet: 'high',
    typ: 'execution',
    start: '2026-09-07',
    termin: '2026-09-18',
    godziny: 28,
    godzinyFaktyczne: 11,
    kryterium: 'Twenty routings released in MES and the paper masters withdrawn from the line.',
  },
  {
    slug: 'mes-operator-training',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Train Line 3 operators on the MES terminal',
    opis: 'Two-hour hands-on session per shift, with a short competence check at the end.',
    osoba: 'priya.sharma',
    status: 'todo',
    priorytet: 'medium',
    typ: 'execution',
    start: '2026-10-05',
    termin: '2026-10-16',
    godziny: 24,
    godzinyFaktyczne: 0,
    kryterium: 'Every Line 3 operator has a signed competence check on file.',
  },
  {
    slug: 'mes-reason-codes',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Agree the MES downtime reason-code taxonomy',
    opis: 'Quality and Operations use different downtime vocabularies; the MES needs one agreed list.',
    osoba: 'robert.chen',
    status: 'blocked',
    priorytet: 'urgent',
    typ: 'analysis',
    start: '2026-08-10',
    termin: '2026-08-21',
    godziny: 16,
    godzinyFaktyczne: 6,
    kryterium: 'One signed reason-code list published to both departments.',
  },
  {
    slug: 'mes-oee-rules',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Define the OEE calculation rules with Quality',
    opis: 'Fix availability, performance and quality definitions so the Line 3 OEE figure is comparable across shifts.',
    osoba: 'robert.chen',
    status: 'todo',
    priorytet: 'medium',
    typ: 'analysis',
    start: '2026-09-14',
    termin: '2026-09-18',
    godziny: 10,
    godzinyFaktyczne: 0,
    kryterium: 'OEE definition sheet approved by the Head of Quality.',
  },
  {
    slug: 'mes-scada-bridge',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Commission the MES-to-SCADA data bridge',
    opis: 'Stream machine states and cycle counts from the Line 3 SCADA layer into the MES.',
    osoba: 'daniel.osei',
    status: 'todo',
    priorytet: 'high',
    typ: 'build',
    start: '2026-09-14',
    termin: '2026-09-25',
    godziny: 30,
    godzinyFaktyczne: 0,
    kryterium: 'Machine state changes appear in the MES within five seconds for eight hours of running.',
  },
  {
    slug: 'mes-cutover-runbook',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Write the Line 3 cutover runbook',
    opis: 'Hour-by-hour plan for the switch from paper travellers, including the rollback point.',
    osoba: 'laura.novak',
    status: 'todo',
    priorytet: 'high',
    typ: 'execution',
    start: '2026-09-14',
    termin: '2026-09-18',
    godziny: 12,
    godzinyFaktyczne: 0,
    kryterium: 'Runbook reviewed in a dry run with the shift leads.',
  },
  {
    slug: 'mes-acceptance-pack',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Sign off the MES acceptance test pack',
    opis: 'Formal acceptance against the forty test cases agreed with the vendor.',
    osoba: 'sarah.mitchell',
    status: 'todo',
    priorytet: 'high',
    typ: 'test',
    start: '2027-03-15',
    termin: '2027-03-26',
    godziny: 16,
    godzinyFaktyczne: 0,
    kryterium: 'Forty test cases passed and countersigned by the vendor.',
  },

  // --- Predictive Maintenance for CNC Line (10) --------------------------------
  {
    slug: 'pdm-sensors-cells-1-2',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Commission vibration sensors on cells 1 and 2',
    opis: 'Install triaxial sensors on the spindle housings and route them to the condition-monitoring gateway.',
    osoba: 'daniel.osei',
    status: 'done',
    priorytet: 'high',
    typ: 'build',
    start: '2026-04-06',
    termin: '2026-06-30',
    godziny: 80,
    godzinyFaktyczne: 84,
    kryterium: 'Continuous vibration signal recorded for fourteen days without a gap.',
  },
  {
    slug: 'pdm-failure-catalogue',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Build the failure-mode catalogue for spindle bearings',
    opis: 'Classify the last three years of spindle failures into modes with an early-warning signature.',
    osoba: 'michael.grant',
    status: 'done',
    priorytet: 'medium',
    typ: 'analysis',
    start: '2026-05-04',
    termin: '2026-07-10',
    godziny: 40,
    godzinyFaktyczne: 38,
    kryterium: 'Every 2023-2026 spindle failure mapped to a named failure mode.',
  },
  {
    slug: 'pdm-thresholds',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Tune alert thresholds against the 2026 failure history',
    opis: 'Set warning and alarm levels so that real failures are caught without drowning the shift in alerts.',
    osoba: 'michael.grant',
    status: 'in_progress',
    priorytet: 'high',
    typ: 'analysis',
    start: '2026-09-07',
    termin: '2026-09-11',
    godziny: 12,
    godzinyFaktyczne: 5,
    kryterium: 'Back-test catches at least eight of the ten recorded failures with under two false alerts a week.',
  },
  {
    slug: 'pdm-historian',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Connect the condition-monitoring gateway to the historian',
    opis: 'Persist the raw and derived signals so the analysis can be reproduced after the pilot.',
    osoba: 'daniel.osei',
    status: 'in_progress',
    priorytet: 'high',
    typ: 'build',
    start: '2026-09-07',
    termin: '2026-09-11',
    godziny: 20,
    godzinyFaktyczne: 8,
    kryterium: 'Thirty days of signal retained and queryable from the historian.',
  },
  {
    slug: 'pdm-work-order-trigger',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Agree the maintenance work-order trigger with Planning',
    opis: 'Decide what an alert does: raise a work order automatically, or queue it for the planner.',
    osoba: 'emily.carter',
    status: 'todo',
    priorytet: 'urgent',
    typ: 'decision',
    start: '2026-08-24',
    termin: '2026-09-03',
    godziny: 12,
    godzinyFaktyczne: 4,
    kryterium: 'Trigger rule written into the maintenance standard operating procedure.',
  },
  {
    slug: 'pdm-sensors-cells-3-5',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Extend sensors to cells 3, 4 and 5',
    opis: 'Repeat the cell 1-2 installation on the remaining three CNC cells.',
    osoba: 'daniel.osei',
    status: 'todo',
    priorytet: 'high',
    typ: 'build',
    start: '2026-09-21',
    termin: '2026-09-25',
    godziny: 22,
    godzinyFaktyczne: 0,
    kryterium: 'All five cells streaming vibration data to the gateway.',
  },
  {
    slug: 'pdm-false-positive-review',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Run the false-positive review with the shift leads',
    opis: 'Walk through every alert raised in August with the people who had to act on it.',
    osoba: 'daniel.osei',
    status: 'todo',
    priorytet: 'high',
    typ: 'analysis',
    start: '2026-09-21',
    termin: '2026-09-25',
    godziny: 22,
    godzinyFaktyczne: 0,
    kryterium: 'Every August alert classified as true or false, with the reason recorded.',
  },
  {
    slug: 'pdm-spares-costing',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Cost the spare-parts holding reduction',
    opis: 'Quantify how much spindle spares stock can be released once alerting is trusted.',
    osoba: 'thomas.baker',
    status: 'todo',
    priorytet: 'medium',
    typ: 'analysis',
    start: '2026-08-17',
    termin: '2026-08-28',
    godziny: 10,
    godzinyFaktyczne: 2,
    kryterium: 'Stock release figure agreed with the Finance Controller and Maintenance.',
  },
  {
    slug: 'pdm-sop',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Document the predictive maintenance standard operating procedure',
    opis: 'One page per role: what an alert means, who acts, and how the outcome is recorded.',
    osoba: 'laura.novak',
    status: 'todo',
    priorytet: 'medium',
    typ: 'execution',
    start: '2026-10-12',
    termin: '2026-10-23',
    godziny: 18,
    godzinyFaktyczne: 0,
    kryterium: 'Procedure issued in the quality system and acknowledged by the maintenance team.',
  },
  {
    slug: 'pdm-benefit-review',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Review benefit realisation with the Plant Manager',
    opis: 'Compare unplanned downtime before and after the pilot against the business case.',
    osoba: 'sarah.mitchell',
    status: 'todo',
    priorytet: 'medium',
    typ: 'analysis',
    start: '2026-11-16',
    termin: '2026-11-27',
    godziny: 8,
    godzinyFaktyczne: 0,
    kryterium: 'Benefit note signed off or a corrective action agreed.',
  },

  // --- Warehouse Automation Pilot (9) ------------------------------------------
  {
    slug: 'wap-shuttle-commissioning',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Commission the shuttle system in the pilot aisle',
    opis: 'Mechanical install, safety fencing and controls handover for the single-aisle shuttle.',
    osoba: 'daniel.osei',
    status: 'done',
    priorytet: 'critical',
    typ: 'build',
    start: '2026-03-02',
    termin: '2026-08-28',
    godziny: 90,
    godzinyFaktyczne: 96,
    kryterium: 'Shuttle runs a full shift at rated throughput with no safety stop.',
  },
  {
    slug: 'wap-reslotting',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Re-slot the pilot aisle by pick frequency',
    opis: 'Move the fastest-moving two hundred SKUs into the shuttle-served locations.',
    osoba: 'emily.carter',
    status: 'in_progress',
    priorytet: 'high',
    typ: 'execution',
    start: '2026-09-14',
    termin: '2026-09-18',
    godziny: 18,
    godzinyFaktyczne: 4,
    kryterium: 'Two hundred SKUs re-slotted and the location master updated.',
  },
  {
    slug: 'wap-pick-rate',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Measure pick rate before and after re-slotting',
    opis: 'Two weeks of measured picks per hour, split by shift, to prove the pilot claim.',
    osoba: 'michael.grant',
    status: 'todo',
    priorytet: 'high',
    typ: 'analysis',
    start: '2026-09-21',
    termin: '2026-10-02',
    godziny: 20,
    godzinyFaktyczne: 0,
    kryterium: 'Before and after pick rates published with the sample size stated.',
  },
  {
    slug: 'wap-safety-case',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Agree the shuttle safety case with the works council',
    opis: 'The council asked for a written position on manual intervention inside the shuttle aisle.',
    osoba: 'priya.sharma',
    status: 'blocked',
    priorytet: 'critical',
    typ: 'execution',
    start: '2026-08-03',
    termin: '2026-08-14',
    godziny: 14,
    godzinyFaktyczne: 5,
    kryterium: 'Safety case signed by the works council chair.',
  },
  {
    slug: 'wap-wcs-integration',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Integrate the shuttle controller with the warehouse system',
    opis: 'Replace the vendor console with tasks issued from the warehouse management system.',
    osoba: 'laura.novak',
    status: 'todo',
    priorytet: 'high',
    typ: 'build',
    start: '2026-09-28',
    termin: '2026-10-09',
    godziny: 26,
    godzinyFaktyczne: 0,
    kryterium: 'A full day of picking driven from the warehouse system with no vendor console use.',
  },
  {
    slug: 'wap-result-pack',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Write the pilot result pack for the steering committee',
    opis: 'Measured throughput, labour saving, safety findings and the recommendation for aisle two.',
    osoba: 'emily.carter',
    status: 'todo',
    priorytet: 'high',
    typ: 'analysis',
    start: '2027-01-11',
    termin: '2027-01-29',
    godziny: 20,
    godzinyFaktyczne: 0,
    kryterium: 'Pack issued five working days before the steering committee.',
  },
  {
    slug: 'wap-goods-out-retraining',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Retrain the goods-out team on the new pick path',
    opis: 'The pick path changed with re-slotting; the goods-out team is still walking the old route.',
    osoba: 'priya.sharma',
    status: 'todo',
    priorytet: 'high',
    typ: 'execution',
    start: '2026-08-24',
    termin: '2026-09-01',
    godziny: 12,
    godzinyFaktyczne: 3,
    kryterium: 'All twelve goods-out operators briefed and signed off.',
  },
  {
    slug: 'wap-labour-saving',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Quantify the labour saving per shift',
    opis: 'Convert the measured pick rate into hours released per shift and per year.',
    osoba: 'thomas.baker',
    status: 'todo',
    priorytet: 'medium',
    typ: 'analysis',
    start: '2026-10-05',
    termin: '2026-10-16',
    godziny: 14,
    godzinyFaktyczne: 0,
    kryterium: 'Saving stated in hours and in pounds, with the assumptions listed.',
  },
  {
    slug: 'wap-housekeeping',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Close the pilot aisle housekeeping actions',
    opis: 'Eleven small actions raised during commissioning: labelling, cable routing, floor marking.',
    osoba: 'emily.carter',
    status: 'todo',
    priorytet: 'low',
    typ: 'execution',
    start: '2026-08-17',
    termin: '2026-08-25',
    godziny: 8,
    godzinyFaktyczne: 1,
    kryterium: 'All eleven actions closed on the commissioning punch list.',
  },

  // --- Skills Matrix and Upskilling (7, inicjatywa wstrzymana) ------------------
  {
    slug: 'skl-matrix',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Populate the skills matrix for all production roles',
    opis: 'Record the current competence level of every production employee against the role standard.',
    osoba: 'priya.sharma',
    status: 'done',
    priorytet: 'high',
    typ: 'execution',
    start: '2026-02-02',
    termin: '2026-07-31',
    godziny: 70,
    godzinyFaktyczne: 72,
    kryterium: 'Matrix complete for all 214 production employees.',
  },
  {
    slug: 'skl-single-points',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Identify single points of failure per line',
    opis: 'Find every task that only one person on site can perform, and rank them by production impact.',
    osoba: 'priya.sharma',
    status: 'in_progress',
    priorytet: 'urgent',
    typ: 'analysis',
    start: '2026-08-24',
    termin: '2026-09-04',
    godziny: 16,
    godzinyFaktyczne: 6,
    kryterium: 'Ranked list of single-deep tasks agreed with each line manager.',
  },
  {
    slug: 'skl-cross-training-rota',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Agree the cross-training rota with the shift leads',
    opis: 'Two hours a week per shift to close the highest-impact single points of failure.',
    osoba: 'sarah.mitchell',
    status: 'todo',
    priorytet: 'high',
    typ: 'execution',
    start: '2026-08-17',
    termin: '2026-08-31',
    godziny: 12,
    godzinyFaktyczne: 0,
    kryterium: 'Rota published for all three shifts.',
  },
  {
    slug: 'skl-2027-costing',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Cost the upskilling programme for 2027',
    opis: 'Training days, backfill cost and external provider fees for the 2027 budget submission.',
    osoba: 'thomas.baker',
    status: 'todo',
    priorytet: 'medium',
    typ: 'analysis',
    start: '2026-10-19',
    termin: '2026-10-30',
    godziny: 10,
    godzinyFaktyczne: 0,
    kryterium: 'Costed submission accepted into the 2027 budget round.',
  },
  {
    slug: 'skl-training-records',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Refresh the training records interface with HR',
    opis: 'The matrix and the HR system disagree on 60 records; reconcile and automate the feed.',
    osoba: 'michael.grant',
    status: 'todo',
    priorytet: 'medium',
    typ: 'build',
    start: '2026-09-14',
    termin: '2026-09-25',
    godziny: 16,
    godzinyFaktyczne: 0,
    kryterium: 'Zero unexplained differences between the matrix and the HR system.',
  },
  {
    slug: 'skl-levy-funding',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Confirm the apprenticeship levy funding route',
    opis: 'Check which parts of the programme can be funded from the existing levy pot.',
    osoba: 'thomas.baker',
    status: 'todo',
    priorytet: 'low',
    typ: 'analysis',
    start: '2026-10-26',
    termin: '2026-11-06',
    godziny: 8,
    godzinyFaktyczne: 0,
    kryterium: 'Written confirmation from the levy provider.',
  },
  {
    slug: 'skl-restart-pack',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Prepare the restart decision pack for the paused programme',
    opis: 'What it would take to restart in January 2027, and what the pause is costing in cover risk.',
    osoba: 'james.whitfield',
    status: 'todo',
    priorytet: 'high',
    typ: 'decision',
    start: '2026-09-07',
    termin: '2026-09-11',
    godziny: 6,
    godzinyFaktyczne: 0,
    kryterium: 'Pack tabled at the September operations review.',
  },
] as const;

// ============================================================================
// RAID — 7 pozycji
//
// Słowniki (LUSTRO kodu, nie zgadywanie):
//   typ           `src/components/Execution/raidGovernance.ts:49`  RISK|ISSUE|DEPENDENCY|ASSUMPTION
//   status        tamże `:54`                                      OPEN|MITIGATED|REALIZED|CLOSED
//   prawdop.      tamże `:31-35`                                   LOW=2|MEDIUM=3|HIGH=4
//   wpływ         tamże `:37-42`                                   LOW=2|MEDIUM=3|HIGH=4|CRITICAL=5
//   EKSPOZYCJA = prawdopodobieństwo x wpływ (skala 5x5, `ekspozycjaRaid` `:76`)
// Te same wartości egzekwuje CHECK bazy (`server/migrations/063_raid_items.sql:8-13`)
// i kanoniczny writer (`RaidItemCreateSchema`, `initiativesExecutionRuntime.routes.ts:994`).
// ============================================================================
export interface PozycjaRaid {
  slug: string;
  inicjatywa: SlugInicjatywy;
  typ: 'RISK' | 'ISSUE' | 'DEPENDENCY' | 'ASSUMPTION';
  tytul: string;
  opis: string;
  status: 'OPEN' | 'MITIGATED' | 'REALIZED' | 'CLOSED';
  prawdopodobienstwo: 'LOW' | 'MEDIUM' | 'HIGH';
  wplyw: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  osoba: SlugOsoby;
  termin: string;
  planZaradczy: string;
}

export const RAID: readonly PozycjaRaid[] = [
  {
    slug: 'raid-cutover-window',
    inicjatywa: 'mes-rollout-line-3',
    typ: 'RISK',
    tytul: 'Line 3 cutover slips past the summer shutdown window',
    opis: 'The only production break long enough for a clean cutover is the July 2027 shutdown. A slip pushes the switch into a running month.',
    status: 'OPEN',
    prawdopodobienstwo: 'HIGH',
    wplyw: 'CRITICAL',
    osoba: 'laura.novak',
    termin: '2026-10-30',
    planZaradczy:
      'Freeze the cutover scope at the top twenty part numbers and run a full dry cutover in week 40, so the shutdown slot is confirmed three months early.',
  },
  {
    slug: 'raid-reason-codes',
    inicjatywa: 'mes-rollout-line-3',
    typ: 'ISSUE',
    tytul: 'Downtime reason codes are not agreed between Quality and Operations',
    opis: 'Two vocabularies are in use. Until one list is signed, the Line 3 OEE figure cannot be compared across shifts.',
    status: 'OPEN',
    prawdopodobienstwo: 'HIGH',
    wplyw: 'HIGH',
    osoba: 'robert.chen',
    termin: '2026-09-04',
    planZaradczy:
      'Joint workshop with Quality and Operations; if no agreement by week 38, the Plant Manager picks the list and both sides adopt it.',
  },
  {
    slug: 'raid-firmware-dependency',
    inicjatywa: 'mes-rollout-line-3',
    typ: 'DEPENDENCY',
    tytul: 'SCADA bridge depends on the vendor firmware release',
    opis: 'The machine-state tags the bridge needs only appear in firmware 4.2, currently promised for November 2026.',
    status: 'OPEN',
    prawdopodobienstwo: 'MEDIUM',
    wplyw: 'HIGH',
    osoba: 'daniel.osei',
    termin: '2026-11-13',
    planZaradczy:
      'Written release commitment from the vendor by the end of September, plus a polling fallback that reads the existing tags at a lower resolution.',
  },
  {
    slug: 'raid-false-positives',
    inicjatywa: 'predictive-maintenance-cnc',
    typ: 'RISK',
    tytul: 'False positives erode operator trust in predictive alerts',
    opis: 'Early tuning raised eleven alerts in August, of which four were genuine. Shift leads have started ignoring the amber level.',
    status: 'MITIGATED',
    prawdopodobienstwo: 'MEDIUM',
    wplyw: 'MEDIUM',
    osoba: 'michael.grant',
    termin: '2026-10-16',
    planZaradczy:
      'Thresholds re-tuned against the 2026 failure history and every alert reviewed with the shift lead who acted on it; target is under two false alerts a week.',
  },
  {
    slug: 'raid-spares-assumption',
    inicjatywa: 'predictive-maintenance-cnc',
    typ: 'ASSUMPTION',
    tytul: 'Spare-parts holding can be cut by fifteen per cent without service impact',
    opis: 'The business case assumes predictive alerting removes the need for a full spindle spares buffer on site.',
    status: 'OPEN',
    prawdopodobienstwo: 'MEDIUM',
    wplyw: 'HIGH',
    osoba: 'thomas.baker',
    termin: '2026-12-18',
    planZaradczy:
      'Hold the reduction until six months of alerting data exist, then release stock in two steps with a service-level check between them.',
  },
  {
    slug: 'raid-works-council',
    inicjatywa: 'warehouse-automation-pilot',
    typ: 'ISSUE',
    tytul: 'Works council has not signed the shuttle safety case',
    opis: 'The council wants a written position on manual intervention inside the shuttle aisle before the pilot extends to a second aisle.',
    status: 'OPEN',
    prawdopodobienstwo: 'HIGH',
    wplyw: 'CRITICAL',
    osoba: 'priya.sharma',
    termin: '2026-08-28',
    planZaradczy:
      'Safety engineer drafts the intervention procedure, the council reviews it at the September meeting, and the pilot stays in one aisle until it is signed.',
  },
  {
    slug: 'raid-single-deep-cover',
    inicjatywa: 'skills-matrix-upskilling',
    typ: 'RISK',
    tytul: 'Paused upskilling leaves key roles single-deep',
    opis: 'Nine production tasks can be performed by one person only. The programme that was closing them is on hold until the 2027 budget.',
    status: 'OPEN',
    prawdopodobienstwo: 'HIGH',
    wplyw: 'HIGH',
    osoba: 'sarah.mitchell',
    termin: '2026-11-27',
    planZaradczy:
      'Cross-train the three highest-impact tasks inside the existing shift rota at no extra cost, and re-table the full programme in the 2027 budget round.',
  },
] as const;

// ============================================================================
// DECYZJE — 9 (decydent, termin, 3 po terminie, opcje, uzasadnienie)
//
// `POST /api/decisions` (`DecisionController.ts:1205`) przyjmuje: title, description,
// decisionOwnerId (-> `decision_maker_id`), dueDate (-> `deadline`), priority, impact,
// pmoDomain, initiativeId, decisionType. OPCJI nie przyjmuje — opcje to osobny
// rejestr `decision_alternatives` (`POST /api/decisions/:id/alternatives`,
// `decisions.routes.ts:269`). Uzasadnienie zapisuje `PUT /api/decisions/:id/decide`
// (`DecideSchema`, `decision.validators.ts:83`), które wymaga go dla APPROVED/REJECTED.
// ============================================================================
export interface Opcja {
  tytul: string;
  opis: string;
  korzysci: string;
  wady: string;
  koszt: string;
  rekomendowana: boolean;
}

export interface Decyzja {
  slug: string;
  inicjatywa: SlugInicjatywy;
  tytul: string;
  opis: string;
  decydent: SlugOsoby;
  termin: string;
  priorytet: 'low' | 'medium' | 'high' | 'critical';
  wplyw: 'low' | 'medium' | 'high';
  domena:
    | 'GOVERNANCE_DECISION_MAKING'
    | 'SCOPE_CHANGE_CONTROL'
    | 'SCHEDULE_MILESTONES'
    | 'RISK_ISSUE_MANAGEMENT'
    | 'RESOURCE_RESPONSIBILITY'
    | 'PERFORMANCE_MONITORING'
    | 'BENEFITS_REALIZATION';
  typ: string;
  /** `null` = wciąż otwarta. */
  rozstrzygniecie: 'approved' | 'rejected' | null;
  uzasadnienie: string | null;
  opcje: readonly Opcja[];
}

export const DECYZJE: readonly Decyzja[] = [
  {
    slug: 'dec-cutover-date',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Approve the Line 3 cutover date of 26 March 2027',
    opis: 'The cutover can run at the March maintenance weekend or wait for the July shutdown. Waiting costs five months of double running.',
    decydent: 'sarah.mitchell',
    termin: '2026-10-09',
    priorytet: 'high',
    wplyw: 'high',
    domena: 'SCHEDULE_MILESTONES',
    typ: 'PHASE_TRANSITION',
    rozstrzygniecie: null,
    uzasadnienie: null,
    opcje: [
      {
        tytul: 'Cut over at the March 2027 maintenance weekend',
        opis: 'Two days of planned downtime, with the paper travellers kept as a rollback for one week.',
        korzysci: 'Ends double running five months earlier and releases the planning effort.',
        wady: 'Only 48 hours to fall back; needs the vendor on site.',
        koszt: 'GBP 18k of weekend cover and vendor support.',
        rekomendowana: true,
      },
      {
        tytul: 'Cut over at the July 2027 shutdown',
        opis: 'Two weeks of shutdown, no production at risk.',
        korzysci: 'Lowest operational risk; no weekend premium.',
        wady: 'Five extra months of running paper and MES in parallel.',
        koszt: 'GBP 60k of parallel running effort.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-reason-codes',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Choose the MES downtime reason-code taxonomy',
    opis: 'Quality proposes the ISO-aligned 42-code list; Operations wants the 18-code list the shift leads already use.',
    decydent: 'robert.chen',
    termin: '2026-09-04',
    priorytet: 'critical',
    wplyw: 'high',
    domena: 'GOVERNANCE_DECISION_MAKING',
    typ: 'SCOPE_CHANGE',
    rozstrzygniecie: null,
    uzasadnienie: null,
    opcje: [
      {
        tytul: 'Adopt the 18-code operations list',
        opis: 'The list the shift leads already use, extended with three quality codes.',
        korzysci: 'No retraining; codes get used correctly from day one.',
        wady: 'Not directly comparable with the group reporting standard.',
        koszt: 'Two days of mapping effort.',
        rekomendowana: true,
      },
      {
        tytul: 'Adopt the 42-code ISO-aligned list',
        opis: 'Full quality taxonomy, mapped down for shop-floor entry.',
        korzysci: 'Comparable with group reporting and the external audit.',
        wady: 'Shift leads pick the wrong code when the list is long; entry quality drops.',
        koszt: 'Two weeks of training and a mapping layer.',
        rekomendowana: false,
      },
      {
        tytul: 'Run both and reconcile monthly',
        opis: 'Operations enters the short list; Quality maps it to the long list once a month.',
        korzysci: 'Neither side has to give way.',
        wady: 'Two sources of truth; the reconciliation is a permanent overhead.',
        koszt: 'One day a month, indefinitely.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-firmware-dependency',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'Accept the vendor firmware release as a hard dependency',
    opis: 'Firmware 4.2 is promised for November 2026. Accepting it as a hard dependency means the bridge cannot be commissioned earlier.',
    decydent: 'james.whitfield',
    termin: '2026-11-06',
    priorytet: 'medium',
    wplyw: 'medium',
    domena: 'RISK_ISSUE_MANAGEMENT',
    typ: 'RISK_ACCEPTANCE',
    rozstrzygniecie: null,
    uzasadnienie: null,
    opcje: [
      {
        tytul: 'Accept the dependency with a polling fallback',
        opis: 'Wait for firmware 4.2, but build a lower-resolution polling reader as insurance.',
        korzysci: 'Keeps the cutover date intact even if the vendor slips.',
        wady: 'Two weeks of engineering that may never be used.',
        koszt: 'GBP 9k of controls engineering.',
        rekomendowana: true,
      },
      {
        tytul: 'Accept the dependency with no fallback',
        opis: 'Take the vendor date at face value.',
        korzysci: 'No wasted engineering.',
        wady: 'A vendor slip moves the cutover into a running month.',
        koszt: 'None now; GBP 60k if it slips.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-extend-cells',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Extend predictive maintenance to cells 3, 4 and 5',
    opis: 'Cells 1 and 2 have run eight weeks with two genuine catches. The question is whether that is enough evidence to fit the remaining three cells.',
    decydent: 'sarah.mitchell',
    termin: '2026-08-21',
    priorytet: 'high',
    wplyw: 'high',
    domena: 'BENEFITS_REALIZATION',
    typ: 'EXECUTION',
    rozstrzygniecie: 'approved',
    uzasadnienie:
      'Two genuine catches on cells 1 and 2 avoided an estimated 14 hours of unplanned downtime, which already covers the sensor cost for the remaining three cells. Extending now keeps one installation team on site instead of remobilising in 2027.',
    opcje: [
      {
        tytul: 'Fit all three remaining cells now',
        opis: 'One mobilisation, same specification as cells 1 and 2.',
        korzysci: 'Cheapest per cell; the whole line is covered before the winter peak.',
        wady: 'Commits capital before the full benefit case is proven.',
        koszt: 'GBP 42k of sensors and installation.',
        rekomendowana: true,
      },
      {
        tytul: 'Fit cell 3 only and review in Q1 2027',
        opis: 'One more cell as a second data point.',
        korzysci: 'Smaller commitment; a further review point.',
        wady: 'Second mobilisation costs GBP 11k more in total.',
        koszt: 'GBP 16k now, GBP 37k later.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-alert-policy',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Set the predictive alert threshold policy',
    opis: 'A tighter threshold catches more failures but raises more false alerts. Shift leads have asked for a written rule they can hold us to.',
    decydent: 'daniel.osei',
    termin: '2026-09-02',
    priorytet: 'high',
    wplyw: 'medium',
    domena: 'PERFORMANCE_MONITORING',
    typ: 'GENERAL',
    rozstrzygniecie: null,
    uzasadnienie: null,
    opcje: [
      {
        tytul: 'Catch-first policy: under two false alerts a week',
        opis: 'Thresholds tuned to catch at least eight failures in ten, accepting up to two false alerts a week.',
        korzysci: 'A number the shift leads can hold us to.',
        wady: 'Two false alerts a week still costs about an hour of investigation.',
        koszt: 'One hour a week of maintenance time.',
        rekomendowana: true,
      },
      {
        tytul: 'Quiet policy: no more than one false alert a month',
        opis: 'Alarm level only; warnings suppressed.',
        korzysci: 'Almost no wasted investigation.',
        wady: 'Back-test suggests only five failures in ten would be caught.',
        koszt: 'Roughly 20 hours a year of unplanned downtime not avoided.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-spares-target',
    inicjatywa: 'predictive-maintenance-cnc',
    tytul: 'Approve the spare-parts holding reduction target',
    opis: 'Finance has modelled a fifteen per cent reduction in spindle spares. Maintenance is willing at ten per cent until a full year of data exists.',
    decydent: 'thomas.baker',
    termin: '2026-12-04',
    priorytet: 'medium',
    wplyw: 'medium',
    domena: 'BENEFITS_REALIZATION',
    typ: 'GENERAL',
    rozstrzygniecie: null,
    uzasadnienie: null,
    opcje: [
      {
        tytul: 'Reduce by ten per cent now, review after twelve months',
        opis: 'Two-step release with a service-level check between the steps.',
        korzysci: 'Banks two thirds of the benefit with a reversible first step.',
        wady: 'Full benefit lands a year later than the business case assumed.',
        koszt: 'GBP 0; releases GBP 61k of working capital.',
        rekomendowana: true,
      },
      {
        tytul: 'Reduce by fifteen per cent immediately',
        opis: 'Take the modelled figure in one step.',
        korzysci: 'Full benefit in the current financial year.',
        wady: 'No service-level evidence yet; a stock-out costs a shift.',
        koszt: 'GBP 0; releases GBP 92k, with a stock-out exposure of GBP 30k.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-second-aisle',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Continue the warehouse shuttle pilot into a second aisle',
    opis: 'The single-aisle pilot has run since March. A second aisle would prove the throughput claim at scale, but the safety case is still open.',
    decydent: 'james.whitfield',
    termin: '2026-08-14',
    priorytet: 'high',
    wplyw: 'high',
    domena: 'SCOPE_CHANGE_CONTROL',
    typ: 'EXECUTION',
    rozstrzygniecie: 'approved',
    uzasadnienie:
      'Approved with one condition: no work starts on aisle two until the works council signs the safety case. The measured pick rate in aisle one is 27 per cent above the manual baseline, which is enough evidence to commit the capital, and the aisle two lead time is fourteen weeks, so waiting for a signature before ordering would push delivery past the 2027 peak.',
    opcje: [
      {
        tytul: 'Order aisle two now, start work after the safety sign-off',
        opis: 'Place the order to protect the fourteen-week lead time; installation waits for the council.',
        korzysci: 'Protects the delivery date without pre-empting the safety decision.',
        wady: 'Capital committed before the safety case closes.',
        koszt: 'GBP 310k of capital, GBP 40k non-refundable if cancelled.',
        rekomendowana: true,
      },
      {
        tytul: 'Wait for the safety sign-off before ordering',
        opis: 'No commitment until the council signs.',
        korzysci: 'No capital at risk.',
        wady: 'Fourteen-week lead time pushes go-live past the 2027 peak.',
        koszt: 'GBP 0 now; one peak season of benefit lost.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-pause-skills',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Pause the skills passport programme until the 2027 budget',
    opis: 'The programme needs 340 training days that are not funded in 2026. The alternative is to take them from production time.',
    decydent: 'james.whitfield',
    termin: '2026-07-31',
    priorytet: 'high',
    wplyw: 'high',
    domena: 'RESOURCE_RESPONSIBILITY',
    typ: 'GENERAL',
    rozstrzygniecie: 'approved',
    uzasadnienie:
      'Paused, not cancelled. The 340 training days cannot be funded in 2026 without taking them out of production during the autumn peak. The three highest-impact single points of failure will be closed inside the existing shift rota at no extra cost, and the full programme is re-tabled in the 2027 budget round in November.',
    opcje: [
      {
        tytul: 'Pause until the 2027 budget, cover the top three risks in the rota',
        opis: 'Programme on hold; three highest-impact tasks cross-trained within the existing shift pattern.',
        korzysci: 'No production time lost in the peak; the worst cover gaps still close.',
        wady: 'Six of the nine single-deep tasks stay open until 2027.',
        koszt: 'GBP 0 incremental.',
        rekomendowana: true,
      },
      {
        tytul: 'Continue at full pace using production time',
        opis: 'Take the 340 days out of the autumn production plan.',
        korzysci: 'All nine cover gaps closed by March 2027.',
        wady: 'Roughly 1.5 per cent of autumn output at risk during the peak.',
        koszt: 'GBP 240k of lost contribution.',
        rekomendowana: false,
      },
      {
        tytul: 'Cancel the programme',
        opis: 'Close the initiative and absorb the cover risk.',
        korzysci: 'Frees the HR business partner for the 2027 recruitment plan.',
        wady: 'Nine single-deep tasks stay open indefinitely.',
        koszt: 'GBP 0; unquantified cover risk.',
        rekomendowana: false,
      },
    ],
  },
  {
    slug: 'dec-training-platform',
    inicjatywa: 'skills-matrix-upskilling',
    tytul: 'Decide on the third-party training platform proposal',
    opis: 'A supplier has offered a hosted competence platform at GBP 34k a year. The skills matrix currently lives in a spreadsheet.',
    decydent: 'priya.sharma',
    termin: '2026-08-28',
    priorytet: 'medium',
    wplyw: 'medium',
    domena: 'RESOURCE_RESPONSIBILITY',
    typ: 'GENERAL',
    rozstrzygniecie: null,
    uzasadnienie: null,
    opcje: [
      {
        tytul: 'Keep the matrix in the current system and automate the HR feed',
        opis: 'Reconcile the 60 disputed records and automate the feed from the HR system.',
        korzysci: 'No new licence; one source of truth.',
        wady: 'No built-in competence expiry reminders.',
        koszt: 'GBP 6k of integration work.',
        rekomendowana: true,
      },
      {
        tytul: 'Buy the hosted competence platform',
        opis: 'Move the matrix to the supplier platform with expiry tracking and evidence upload.',
        korzysci: 'Expiry reminders and audit evidence out of the box.',
        wady: 'A third system holding employee data; annual licence with no exit plan.',
        koszt: 'GBP 34k a year plus GBP 12k of migration.',
        rekomendowana: false,
      },
    ],
  },
] as const;

// ============================================================================
// KAMIENIE MILOWE — plan bazowy i przesunięcia
//
// Osiem kamieni czterech inicjatyw realizowanych ZAŁOŻYŁ D3 (`03-dane-inicjatyw.ts`)
// razem z `baseline_date`. D4 NIE dubluje ich — dokłada to, czego D3 nie miał:
// znacznik ustawienia planu bazowego (`baseline_set_at`, `baseline_version`),
// dwa udokumentowane przesunięcia terminu wobec planu bazowego
// (`schedule_shift_count`) oraz migawkę projektu w `plan_baselines`.
// ============================================================================
export interface PrzesuniecieKamienia {
  /** Fragment nazwy kamienia z D3 — dopasowanie po nazwie, nie po pozycji. */
  nazwa: string;
  inicjatywa: SlugInicjatywy;
  /** Nowy termin; `baseline_date` zostaje bez zmian — stąd widoczny poślizg. */
  nowyTermin: string;
  powod: string;
}

export const PRZESUNIECIA_KAMIENI: readonly PrzesuniecieKamienia[] = [
  {
    nazwa: 'Cutover from paper travellers',
    inicjatywa: 'mes-rollout-line-3',
    nowyTermin: '2027-04-30',
    powod: 'Vendor firmware 4.2 moved to November 2026, which pushed the dry cutover and the March maintenance weekend.',
  },
  {
    nazwa: 'Measured pilot result pack',
    inicjatywa: 'warehouse-automation-pilot',
    nowyTermin: '2027-02-26',
    powod: 'Re-slotting started four weeks late, so the before-and-after measurement window moved with it.',
  },
] as const;

// ============================================================================
// RAPORTY STATUSU — 2 (tabela `status_reports`, schemat 066)
// Słowniki z komentarzy migracji `066_status_reports.sql:17,23,24,47,51`.
// ============================================================================
export interface RaportStatusu {
  slug: string;
  inicjatywa: SlugInicjatywy;
  tytul: string;
  typOkresu: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  okresOd: string;
  okresDo: string;
  etykietaOkresu: string;
  stan: 'GREEN' | 'AMBER' | 'RED';
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  autor: SlugOsoby;
  streszczenie: string;
  osiagniecia: string;
  nastepneKroki: string;
  eskalacje: string;
  ryzykaIProblemy: string;
  rekomendacje: string;
  postepProcent: number;
  budzetProcent: number;
}

export const RAPORTY_STATUSU: readonly RaportStatusu[] = [
  {
    slug: 'sr-mes-w36',
    inicjatywa: 'mes-rollout-line-3',
    tytul: 'MES Rollout Line 3 — weekly status, week 36',
    typOkresu: 'WEEKLY',
    okresOd: '2026-08-31',
    okresDo: '2026-09-06',
    etykietaOkresu: 'Week 36 2026',
    stan: 'AMBER',
    trend: 'STABLE',
    autor: 'laura.novak',
    streszczenie:
      'Terminals and network are complete and the ERP interface is being configured. The rollout is amber because the downtime reason-code taxonomy is still unagreed and the SCADA bridge now depends on a vendor firmware release promised for November.',
    osiagniecia:
      'All eleven shop-floor terminals commissioned and accepted. Work-order interface mapping started against the ERP production module. First eight paper travellers rebuilt as MES routings.',
    nastepneKroki:
      'Finish the ERP interface and run ten end-to-end test work orders. Close the reason-code taxonomy with Quality. Get a written firmware release commitment from the vendor.',
    eskalacje:
      'Reason-code taxonomy: escalated to the Plant Manager for a decision if Quality and Operations do not agree by week 38.',
    ryzykaIProblemy:
      'Cutover slipping past the summer shutdown window (high, critical). Reason codes unagreed (open issue, four days past its due date). SCADA bridge dependent on vendor firmware 4.2.',
    rekomendacje:
      'Approve the March 2027 cutover date now so the dry cutover can be booked, and fund the polling fallback for the SCADA bridge.',
    postepProcent: 42,
    budzetProcent: 38,
  },
  {
    slug: 'sr-wap-aug',
    inicjatywa: 'warehouse-automation-pilot',
    tytul: 'Warehouse Automation Pilot — monthly status, August 2026',
    typOkresu: 'MONTHLY',
    okresOd: '2026-08-01',
    okresDo: '2026-08-31',
    etykietaOkresu: 'August 2026',
    stan: 'AMBER',
    trend: 'IMPROVING',
    autor: 'emily.carter',
    streszczenie:
      'The shuttle was commissioned in August and is running a full shift at rated throughput. The pilot is amber only because the works council has not signed the safety case, which blocks any extension to a second aisle.',
    osiagniecia:
      'Shuttle commissioned and accepted after a full shift at rated throughput. Measured pick rate in the pilot aisle is 27 per cent above the manual baseline. Re-slotting of the top two hundred SKUs started.',
    nastepneKroki:
      'Complete re-slotting, measure the pick rate before and after, integrate the shuttle controller with the warehouse system, and retrain the goods-out team on the new pick path.',
    eskalacje:
      'Works council safety case: tabled for the September council meeting; aisle two stays on hold until it is signed.',
    ryzykaIProblemy:
      'Works council has not signed the shuttle safety case (high, critical, two weeks past its due date). Goods-out retraining and the commissioning punch list are both past their due dates.',
    rekomendacje:
      'Order aisle two now to protect the fourteen-week lead time, with installation conditional on the safety sign-off.',
    postepProcent: 61,
    budzetProcent: 55,
  },
] as const;

// ============================================================================
// MIGAWKI RAPORTÓW REALIZACJI — 2 (`execution_report_snapshots`)
// Klucze MVP: `executionReports.routes.ts:52-55` (initiative-card, weekly-exec,
// program-health, sponsor-onepager). Klucz spoza MVP daje 409 `WAVE_2` (`:378`).
// ============================================================================
export const KLUCZE_MIGAWEK = ['weekly-exec', 'program-health'] as const;

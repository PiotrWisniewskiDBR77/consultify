/**
 * D3 — DANE inicjatyw „Northwind Manufacturing Ltd." (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md`
 * §3.2 + §D3). Oddzielny plik od `03-inicjatywy.ts` po to, żeby rozkład statusów,
 * kompletność kart i stabilność identyfikatorów dało się przetestować BEZ bazy.
 *
 * TREŚĆ WYŁĄCZNIE PO ANGIELSKU (dane pokazowe). Komentarze po polsku (kod zespołu).
 *
 * ROZKŁAD (13 inicjatyw, 7 statusów DEC-424 + 1 flaga `on_hold`):
 *   PROPOSED 1 · DRAFT 1 · PENDING_APPROVAL 1 · APPROVED 4 · IN_EXECUTION 4 (1 `on_hold`)
 *   · CLOSED 1 · REJECTED 1
 *
 * DLACZEGO NIE „DRAFT ×3 / PENDING_APPROVAL ×2" — POMIAR, nie preferencja (08.09, kopia d3):
 * ekran Inicjatyw scala DWA źródła (`InitiativesHub.tsx:522-575`, DEC-397) i wiersz
 * z rejestru runtime-v1 WYGRYWA z wierszem klasycznym. Status pokazany na liście
 * bierze się wtedy z `payload_json->lifecycleState` agregatu, a `register` ustawia
 * ten stan na `APPROVED_BACKLOG` → `runtimeToStatus` mapuje go na **APPROVED**
 * (`src/contracts/initiatives-execution/statusMapping.ts:20`). Zmierzone: po
 * zarejestrowaniu czterech inicjatyw `IN_EXECUTION` lista pokazywała
 * „In execution 0" i SZEŚĆ statusów zamiast siedmiu. Poza łańcuchem przekazania
 * (`handoffAcceptance.ts:284`, paczka D4 — wymaga stanu `SCHEDULED` i zamrożonej
 * paczki przekazania) nic nie przesuwa agregatu za `APPROVED_BACKLOG`.
 * To samo dotyczy `PENDING_APPROVAL`: `register` z `allowConditional` też ustawia
 * `APPROVED_BACKLOG`, więc zarejestrowany wniosek pokazuje się jako „Approved"
 * (zmierzone: chip „Pending approval 0" przy dwóch wnioskach w bazie).
 *
 * SPROSTOWANIE D4b (DECYZJA 2), zmierzone 08.09 na `consultify_kopia_d44`:
 * zdanie „poza łańcuchem przekazania nic nie przesuwa agregatu" jest prawdziwe,
 * ale wniosek „więc agregaty tylko dla APPROVED" był ZA SZEROKI. Łańcuch DA SIĘ
 * przejść kanonicznymi pisarzami po HTTP (`register` -> okno w opublikowanym
 * planie -> `initiative.schedule.request/decide` -> `initiative.handoff.
 * request/decide`), a `decideHandoffAcceptance` ustawia `lifecycleState`
 * na `IN_EXECUTION` (`handoffAcceptance.ts:277`) — co `statusMapping.ts:22`
 * mapuje z powrotem na status `IN_EXECUTION`. Dlatego OSIEM inicjatyw ma agregat
 * i OSIEM okien w planie, a na liście dalej widać SIEDEM statusów, bo żaden
 * agregat nie zostaje w `APPROVED_BACKLOG`/`SCHEDULED` na wierszu realizowanym.
 * `PENDING_APPROVAL` zostaje bez agregatu (nie ma dla niego łańcucha).
 */

/** Status kanoniczny (`server/src/constants/initiativeStatuses.ts:1-15`). */
export type StatusInicjatywy =
  | 'PROPOSED'
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_EXECUTION'
  | 'CLOSED'
  | 'REJECTED';

export const STATUSY_KANONICZNE: readonly StatusInicjatywy[] = [
  'PROPOSED',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_EXECUTION',
  'CLOSED',
  'REJECTED',
];

/** Slug osoby z D1 (`01-rdzen.ts`). E-mail = `<slug>@northwind.example`. */
export type SlugOsoby =
  | 'james.whitfield'
  | 'sarah.mitchell'
  | 'robert.chen'
  | 'emily.carter'
  | 'daniel.osei'
  | 'laura.novak'
  | 'michael.grant'
  | 'priya.sharma'
  | 'thomas.baker';

/** Slug projektu z D1 (`01-rdzen.ts`). */
export type SlugProjektu = 'operational-excellence-programme' | 'digital-automation-roadmap';

export type RACI = 'R' | 'A' | 'C' | 'I';

export interface Interesariusz {
  osoba: SlugOsoby;
  /** Rola opisowa w karcie inicjatywy — PO ANGIELSKU, widoczna na ekranie. */
  role: string;
  raci: RACI;
  influence: 1 | 2 | 3 | 4 | 5;
  interest: 1 | 2 | 3 | 4 | 5;
}

export interface Inicjatywa {
  slug: string;
  /** `initiatives.name` ORAZ `initiatives.title` — obie kolumny tą samą treścią. */
  tytul: string;
  status: StatusInicjatywy;
  /** Flaga DEC-424 — wstrzymanie NIE jest statusem. */
  onHold?: true;
  /** Powód wstrzymania / odrzucenia (`initiatives.blocked_reason`). */
  blockedReason?: string;
  /** 3-5 zdań, po angielsku. */
  opis: string;
  /** Krótkie streszczenie do wiersza listy i nagłówka podglądu. */
  streszczenie: string;
  problem: string;
  kategoria: string;
  priorytet: 'low' | 'medium' | 'high' | 'critical';
  obszar: string;
  /** Autor karty (`initiatives.created_by`). */
  autor: SlugOsoby;
  /** Właściciel biznesowy (`owner_business_id`). */
  wlascicielBiznesowy: SlugOsoby;
  /** Właściciel wykonania (`owner_execution_id`) — OBOWIĄZKOWY dla IN_EXECUTION. */
  wlascicielWykonania?: SlugOsoby;
  sponsor: SlugOsoby;
  /** Projekt — OBOWIĄZKOWY dla IN_EXECUTION (fail-closed realizacji). */
  projekt?: SlugProjektu;
  zakresW: string[];
  zakresPoza: string[];
  kryteriaSukcesu: string[];
  produkty: string[];
  ryzyka: string[];
  tagi: string[];
  wartoscBiznesowa: string;
  oczekiwanyZwrot: string;
  wplyw: 'low' | 'medium' | 'high';
  naklad: 'low' | 'medium' | 'high';
  poziomRyzyka: 'low' | 'medium' | 'high';
  budzet: number;
  /** Daty ISO (YYYY-MM-DD). Rok 2026/2027 — część w przeszłości, część w przyszłości. */
  planStart: string | null;
  planKoniec: string | null;
  utworzono: string;
  /** Popyt na zasoby całej inicjatywy w FTE i to, co realnie zaalokowano. */
  wymaganeFte: number;
  zaalokowaneFte: number;
  postep: number;
  /** CLOSED — data zamknięcia i zrealizowana korzyść. */
  zamknieto?: string;
  wynikZamkniecia?: string;
  /** REJECTED — data i powód odrzucenia + decydent. */
  odrzucono?: string;
  decydent?: SlugOsoby;
  interesariusze: Interesariusz[];
}

export const INICJATYWY: readonly Inicjatywa[] = [
  // ---------------------------------------------------------------- IN_EXECUTION (4)
  {
    slug: 'predictive-maintenance-cnc',
    tytul: 'Predictive Maintenance for CNC Line',
    status: 'IN_EXECUTION',
    opis:
      'Unplanned stoppages on the Leeds CNC cells cost Northwind an estimated 640 production hours in 2025, and every stoppage pushes work to the Rotherham site at a premium. This initiative fits vibration and spindle-current sensors to cells 1 to 6 and streams the readings into a condition-monitoring model that raises a work order before a bearing fails. Maintenance planning moves from a fixed 12-week calendar to a condition-based schedule agreed with the shift engineers. The first two cells run as a controlled pilot so the alert thresholds can be tuned against real failure data before the rollout continues.',
    streszczenie:
      'Condition-based maintenance on Leeds CNC cells 1-6, replacing the fixed 12-week service calendar.',
    problem:
      'Unplanned CNC stoppages cost 640 production hours in 2025 and are invisible until the machine stops.',
    kategoria: 'Maintenance & Reliability',
    priorytet: 'high',
    obszar: 'Manufacturing Operations',
    autor: 'sarah.mitchell',
    wlascicielBiznesowy: 'sarah.mitchell',
    wlascicielWykonania: 'daniel.osei',
    sponsor: 'james.whitfield',
    projekt: 'operational-excellence-programme',
    zakresW: [
      'Leeds CNC cells 1-6 (vibration and spindle-current sensing)',
      'Condition-monitoring model and alert thresholds',
      'Work-order trigger into the existing maintenance planner',
      'Shift engineer training and response runbook',
    ],
    zakresPoza: [
      'Rotherham CNC cells (planned for wave 2)',
      'Replacement of the maintenance planning system itself',
      'Press shop and assembly equipment',
    ],
    kryteriaSukcesu: [
      'Unplanned CNC downtime reduced by 30% against the 2025 baseline',
      'At least 80% of alerts confirmed as genuine by the shift engineer',
      'Mean time to repair reduced from 5.2 to 3.5 hours',
    ],
    produkty: [
      'Sensor installation on six CNC cells',
      'Condition-monitoring dashboard for the shift engineers',
      'Alert-to-work-order integration',
      'Response runbook and training record',
    ],
    ryzyka: [
      'Sensor cabling requires cell downtime that competes with the order book',
      'Alert thresholds too sensitive in the first weeks, eroding operator trust',
    ],
    tagi: ['reliability', 'iiot', 'leeds'],
    wartoscBiznesowa:
      'Recovers production hours lost to unplanned stoppages and reduces premium transfers to Rotherham.',
    oczekiwanyZwrot: 'Payback in 14 months on avoided downtime and reduced expedited freight.',
    wplyw: 'high',
    naklad: 'medium',
    poziomRyzyka: 'medium',
    budzet: 285000,
    planStart: '2026-04-06',
    planKoniec: '2027-03-31',
    utworzono: '2026-02-11',
    wymaganeFte: 1.8,
    zaalokowaneFte: 1.6,
    postep: 45,
    interesariusze: [
      { osoba: 'daniel.osei', role: 'Delivery lead', raci: 'R', influence: 4, interest: 5 },
      { osoba: 'sarah.mitchell', role: 'Business owner', raci: 'A', influence: 5, interest: 5 },
      { osoba: 'robert.chen', role: 'Quality assurance', raci: 'C', influence: 3, interest: 3 },
      { osoba: 'thomas.baker', role: 'Finance controller', raci: 'I', influence: 3, interest: 2 },
    ],
  },
  {
    slug: 'mes-rollout-line-3',
    tytul: 'MES Rollout Line 3',
    status: 'IN_EXECUTION',
    opis:
      'Rotherham Line 3 still reports production on paper travellers that are keyed into the ERP the following morning, so schedule adherence is always a day old. This initiative deploys the manufacturing execution system already running on Lines 1 and 2 to Line 3, including station terminals, barcode traceability and automatic downtime capture. Planners gain live order status and the quality team gains a per-unit genealogy record they can pull during a customer audit. The rollout is sequenced around the summer shutdown so that no confirmed customer order is put at risk.',
    streszczenie:
      'Extends the existing MES from Lines 1-2 to Rotherham Line 3, replacing paper travellers with live reporting.',
    problem:
      'Line 3 production data reaches the ERP a day late, so schedule adherence cannot be managed within the shift.',
    kategoria: 'Manufacturing Systems',
    priorytet: 'critical',
    obszar: 'Digital Manufacturing',
    autor: 'laura.novak',
    wlascicielBiznesowy: 'sarah.mitchell',
    wlascicielWykonania: 'laura.novak',
    sponsor: 'robert.chen',
    projekt: 'digital-automation-roadmap',
    zakresW: [
      'Six station terminals on Rotherham Line 3',
      'Barcode traceability and per-unit genealogy',
      'Automatic downtime and scrap capture',
      'Interface to the existing ERP order backlog',
    ],
    zakresPoza: [
      'Replacement of the ERP',
      'Lines 1 and 2 (already live)',
      'Warehouse goods-in scanning',
    ],
    kryteriaSukcesu: [
      'Paper travellers withdrawn from Line 3',
      'Schedule adherence reported within 15 minutes of the event',
      'Full unit genealogy available for every Line 3 order from go-live',
    ],
    produkty: [
      'Terminal installation and network provisioning',
      'MES configuration for the Line 3 routing',
      'Operator training for three shifts',
      'Cutover and fallback plan',
    ],
    ryzyka: [
      'Network coverage at the far end of Line 3 is unproven',
      'Cutover window is constrained by the summer shutdown date',
    ],
    tagi: ['mes', 'traceability', 'rotherham'],
    wartoscBiznesowa:
      'Gives planners and quality the same live view on Line 3 that Lines 1 and 2 already have.',
    oczekiwanyZwrot: 'Payback in 19 months from reduced expediting and faster audit response.',
    wplyw: 'high',
    naklad: 'high',
    poziomRyzyka: 'high',
    budzet: 410000,
    planStart: '2026-05-04',
    planKoniec: '2027-06-30',
    utworzono: '2026-01-28',
    wymaganeFte: 2.4,
    zaalokowaneFte: 2.0,
    postep: 35,
    interesariusze: [
      { osoba: 'laura.novak', role: 'Delivery lead', raci: 'R', influence: 4, interest: 5 },
      { osoba: 'sarah.mitchell', role: 'Business owner', raci: 'A', influence: 5, interest: 5 },
      { osoba: 'emily.carter', role: 'Production planning', raci: 'C', influence: 3, interest: 4 },
      { osoba: 'james.whitfield', role: 'Sponsor', raci: 'I', influence: 5, interest: 3 },
    ],
  },
  {
    slug: 'warehouse-automation-pilot',
    tytul: 'Warehouse Automation Pilot',
    status: 'IN_EXECUTION',
    opis:
      'Handling cost per unit in the Leeds finished-goods store has risen 11% over two years while order lines have grown only 4%, because picking still walks the whole aisle. This pilot installs a goods-to-person shuttle for the fastest-moving 400 stock keeping units and reworks the pick face around it. The pilot deliberately covers one aisle only, so the business case for the full store can be measured rather than assumed. If the measured saving holds, wave 2 extends the shuttle to the remaining three aisles in 2027.',
    streszczenie:
      'Goods-to-person shuttle for the 400 fastest-moving SKUs in one Leeds aisle, sized to prove the business case.',
    problem:
      'Handling cost per unit rose 11% in two years while order lines grew only 4%; picking walks the full aisle.',
    kategoria: 'Logistics & Warehousing',
    priorytet: 'high',
    obszar: 'Supply Chain',
    autor: 'james.whitfield',
    wlascicielBiznesowy: 'james.whitfield',
    wlascicielWykonania: 'emily.carter',
    sponsor: 'james.whitfield',
    projekt: 'operational-excellence-programme',
    zakresW: [
      'One aisle of the Leeds finished-goods store',
      'Goods-to-person shuttle for the top 400 SKUs',
      'Reworked pick face and replenishment rules',
      'Measured before-and-after cost per pick',
    ],
    zakresPoza: [
      'Remaining three aisles (wave 2, subject to the pilot result)',
      'Raw material store',
      'Outbound transport planning',
    ],
    kryteriaSukcesu: [
      'Cost per pick in the pilot aisle reduced by 20%',
      'Pick accuracy maintained at or above 99.6%',
      'Business case for wave 2 evidenced by measured data, not vendor claims',
    ],
    produkty: [
      'Shuttle installation and commissioning',
      'Revised replenishment rules',
      'Measured pilot result pack for the wave 2 decision',
    ],
    ryzyka: [
      'Vendor lead time for the shuttle is 22 weeks and already committed',
      'Peak season overlaps the commissioning window',
    ],
    tagi: ['automation', 'warehouse', 'leeds'],
    wartoscBiznesowa: 'Reduces handling cost per unit and frees floor space for the growing order book.',
    oczekiwanyZwrot: 'Payback in 26 months at pilot scale; shorter if wave 2 proceeds.',
    wplyw: 'high',
    naklad: 'high',
    poziomRyzyka: 'medium',
    budzet: 520000,
    planStart: '2026-03-02',
    planKoniec: '2027-01-29',
    utworzono: '2025-12-15',
    wymaganeFte: 1.5,
    zaalokowaneFte: 1.4,
    postep: 60,
    interesariusze: [
      { osoba: 'emily.carter', role: 'Delivery lead', raci: 'R', influence: 4, interest: 5 },
      { osoba: 'james.whitfield', role: 'Business owner', raci: 'A', influence: 5, interest: 5 },
      { osoba: 'thomas.baker', role: 'Investment appraisal', raci: 'C', influence: 4, interest: 4 },
      { osoba: 'michael.grant', role: 'Measurement and reporting', raci: 'I', influence: 2, interest: 4 },
    ],
  },
  {
    slug: 'skills-matrix-upskilling',
    // BEZ ZNAKU „&" W TYTULE — swiadoma decyzja D4b, nie przypadek. Globalny
    // `inputSanitizationMiddleware` (`security.utils.ts:60`) escapuje KAZDY string
    // ciala zadania NA ZAPISIE, wiec tytul zapisany przez HTTP (`register`
    // i `PATCH .../metadata`) laduje w agregacie runtime-v1 jako „&amp;" i tak
    // TRAFIA NA EKRAN listy Inicjatyw (zmierzone 08.09: wiersz klasyczny „Skills
    // Matrix & Upskilling", agregat „Skills Matrix &amp; Upskilling"). STOP
    // produktowy zapisany w rejestrze D3 („sanitizer runtime-v1 escapuje &") —
    // do naprawy osobna paczka, bo dotyczy calego produktu. Do tego czasu dane
    // pokazowe omijaja `&`, tak samo jak dane paczki D4.
    tytul: 'Skills Matrix and Upskilling',
    status: 'IN_EXECUTION',
    onHold: true,
    blockedReason:
      'Paused until the Q4 shift pattern review concludes. Training slots cannot be booked before the new rota is agreed with the works council.',
    opis:
      'Northwind has no single record of who is signed off on which machine, so cover for absence is arranged by memory on the shift. This initiative builds a skills matrix for all 340 production roles, links it to the training records already held by HR, and schedules the upskilling needed to remove the eleven single points of failure identified in the 2026 audit. The matrix becomes the input to shift planning rather than a document that is refreshed once a year. Work is currently on hold while the Q4 shift pattern review runs, because training slots cannot be booked against a rota that is about to change.',
    streszczenie:
      'A live skills matrix for 340 production roles, feeding shift planning and closing eleven single points of failure.',
    problem:
      'No single record of machine sign-off; cover for absence is arranged from memory and eleven roles have no backup.',
    kategoria: 'People & Capability',
    priorytet: 'medium',
    obszar: 'Human Resources',
    autor: 'priya.sharma',
    wlascicielBiznesowy: 'james.whitfield',
    wlascicielWykonania: 'priya.sharma',
    sponsor: 'james.whitfield',
    projekt: 'operational-excellence-programme',
    zakresW: [
      'Skills matrix for all 340 production roles',
      'Link to existing HR training records',
      'Upskilling plan for eleven single points of failure',
      'Matrix as an input to weekly shift planning',
    ],
    zakresPoza: [
      'Office and engineering roles',
      'Replacement of the HR system',
      'Apprenticeship programme design',
    ],
    kryteriaSukcesu: [
      'Zero production roles without a trained backup',
      'Skills matrix refreshed within one working day of a sign-off',
      'Shift planners using the matrix as the source for cover decisions',
    ],
    produkty: [
      'Skills matrix covering every production role',
      'Upskilling schedule agreed with the works council',
      'Shift planning procedure update',
    ],
    ryzyka: [
      'The Q4 shift pattern review may change the role structure the matrix is built on',
      'Training capacity competes with the order book in the run-up to year end',
    ],
    tagi: ['people', 'capability', 'resilience'],
    wartoscBiznesowa: 'Removes single points of failure that currently stop a cell when one person is absent.',
    oczekiwanyZwrot: 'Avoided downtime from absence cover, estimated at 90 production hours a year.',
    wplyw: 'medium',
    naklad: 'medium',
    poziomRyzyka: 'low',
    budzet: 95000,
    planStart: '2026-02-02',
    planKoniec: '2026-12-18',
    utworzono: '2025-11-20',
    wymaganeFte: 0.9,
    zaalokowaneFte: 0.6,
    postep: 30,
    interesariusze: [
      { osoba: 'priya.sharma', role: 'Delivery lead', raci: 'R', influence: 3, interest: 5 },
      { osoba: 'james.whitfield', role: 'Business owner', raci: 'A', influence: 5, interest: 4 },
      { osoba: 'sarah.mitchell', role: 'Shift planning', raci: 'C', influence: 4, interest: 4 },
      { osoba: 'robert.chen', role: 'Quality sign-off', raci: 'I', influence: 3, interest: 2 },
    ],
  },

  // -------------------------------------------------------------------- APPROVED (4)
  {
    slug: 'energy-monitoring-iso-50001',
    tytul: 'Energy Monitoring and ISO 50001',
    status: 'APPROVED',
    opis:
      'Northwind buys 14.2 GWh a year across the two sites but meters it at four points, so no department can be held to an energy budget. This initiative installs sub-metering on the twelve largest loads, publishes consumption per production hour, and uses the resulting evidence base to certify the energy management system to ISO 50001. Certification is a customer requirement in two of the three largest accounts and is expected in the next tender round. The board approved the business case in July on the condition that the metering data is available before the certification audit is booked.',
    streszczenie:
      'Sub-metering of the twelve largest loads, energy per production hour, and ISO 50001 certification.',
    problem:
      '14.2 GWh a year is metered at four points only, so no department can be held to an energy budget.',
    kategoria: 'Energy & Sustainability',
    priorytet: 'high',
    obszar: 'Sustainability',
    autor: 'thomas.baker',
    wlascicielBiznesowy: 'thomas.baker',
    wlascicielWykonania: 'daniel.osei',
    sponsor: 'james.whitfield',
    projekt: 'operational-excellence-programme',
    zakresW: [
      'Sub-metering on the twelve largest loads across both sites',
      'Energy consumption per production hour by department',
      'ISO 50001 energy management system documentation',
      'Certification audit preparation',
    ],
    zakresPoza: [
      'On-site generation or solar investment',
      'Building fabric improvements',
      'Scope 3 supply chain emissions',
    ],
    kryteriaSukcesu: [
      'ISO 50001 certificate awarded at first audit',
      'Energy per production hour reported monthly by department',
      'Energy cost per unit reduced by 8% within twelve months of go-live',
    ],
    produkty: [
      'Sub-metering installation',
      'Energy reporting pack by department',
      'ISO 50001 management system manual',
    ],
    ryzyka: [
      'Certification body lead time may push the audit past the tender deadline',
      'Metering installation on the main incomer needs a planned shutdown',
    ],
    tagi: ['energy', 'iso-50001', 'esg'],
    wartoscBiznesowa: 'Protects two of the three largest accounts where certification is a tender requirement.',
    oczekiwanyZwrot: 'Payback in 21 months on energy savings, before any revenue protection is counted.',
    wplyw: 'high',
    naklad: 'medium',
    poziomRyzyka: 'medium',
    budzet: 180000,
    planStart: '2026-10-05',
    planKoniec: '2027-09-30',
    utworzono: '2026-05-18',
    wymaganeFte: 1.2,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'thomas.baker', role: 'Business owner', raci: 'A', influence: 4, interest: 5 },
      { osoba: 'daniel.osei', role: 'Technical lead', raci: 'R', influence: 3, interest: 4 },
      { osoba: 'james.whitfield', role: 'Sponsor', raci: 'C', influence: 5, interest: 4 },
      { osoba: 'michael.grant', role: 'Reporting', raci: 'I', influence: 2, interest: 3 },
    ],
  },
  {
    slug: 'supplier-quality-gate',
    tytul: 'Supplier Quality Gate',
    status: 'APPROVED',
    opis:
      'Two thirds of the non-conformances raised in 2026 originate in bought-in castings, but the current goods-in check is a visual inspection with no supplier feedback loop. This initiative introduces a documented quality gate at goods-in with sampling rules by supplier risk class, and returns the measured defect rate to the supplier every month. Suppliers in the highest risk class move to a corrective action plan with an agreed exit criterion. The gate is designed to be run by the existing goods-in team without adding headcount.',
    streszczenie:
      'A documented goods-in quality gate with risk-based sampling and a monthly defect feedback loop to suppliers.',
    problem:
      'Two thirds of 2026 non-conformances come from bought-in castings; goods-in is a visual check with no feedback loop.',
    kategoria: 'Quality & Compliance',
    priorytet: 'high',
    obszar: 'Quality',
    autor: 'robert.chen',
    wlascicielBiznesowy: 'robert.chen',
    wlascicielWykonania: 'michael.grant',
    sponsor: 'james.whitfield',
    projekt: 'digital-automation-roadmap',
    zakresW: [
      'Goods-in quality gate for bought-in castings and machined parts',
      'Sampling rules by supplier risk class',
      'Monthly defect rate reporting back to suppliers',
      'Corrective action plans for the highest risk class',
    ],
    zakresPoza: [
      'Supplier selection and commercial negotiation',
      'In-process quality control on the lines',
      'Customer complaint handling',
    ],
    kryteriaSukcesu: [
      'Supplier-caused non-conformances reduced by 40% within twelve months',
      'Every supplier in the top risk class on an agreed corrective action plan',
      'Gate operated within the existing goods-in headcount',
    ],
    produkty: [
      'Quality gate procedure and sampling plan',
      'Supplier scorecard published monthly',
      'Corrective action plan template and register',
    ],
    ryzyka: [
      'Sampling adds dwell time at goods-in during peak inbound weeks',
      'Two key suppliers have no quality contact named in the contract',
    ],
    tagi: ['quality', 'supplier', 'non-conformance'],
    wartoscBiznesowa: 'Moves the cost of poor quality back to its source instead of absorbing it on the line.',
    oczekiwanyZwrot: 'Payback in 11 months on avoided rework and scrap.',
    wplyw: 'high',
    naklad: 'low',
    poziomRyzyka: 'low',
    budzet: 72000,
    planStart: '2026-11-02',
    planKoniec: '2027-08-31',
    utworzono: '2026-06-09',
    wymaganeFte: 0.8,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'robert.chen', role: 'Business owner', raci: 'A', influence: 5, interest: 5 },
      { osoba: 'michael.grant', role: 'Analysis and reporting', raci: 'R', influence: 2, interest: 4 },
      { osoba: 'emily.carter', role: 'Goods-in scheduling', raci: 'C', influence: 3, interest: 3 },
      { osoba: 'thomas.baker', role: 'Cost of quality', raci: 'I', influence: 3, interest: 3 },
    ],
  },

  // ------------------------------------------------------------ PENDING_APPROVAL (1)
  {
    slug: 'digital-work-instructions',
    tytul: 'Digital Work Instructions',
    status: 'PENDING_APPROVAL',
    opis:
      'Work instructions are printed, laminated and kept in a folder at each station, which means an engineering change takes up to three weeks to reach every shift. This initiative replaces the folders with tablet-based instructions served from the current revision, so a change is live at the station the moment it is released. Photographs and short video replace the text-heavy sheets for the eight most error-prone operations. The request is with the steering committee for approval, with the investment appraisal already reviewed by finance.',
    streszczenie:
      'Tablet-based work instructions served from the current revision, replacing laminated folders at the station.',
    problem:
      'An engineering change takes up to three weeks to reach every shift because instructions are printed and laminated.',
    kategoria: 'Digital Shopfloor',
    priorytet: 'medium',
    obszar: 'Digital Manufacturing',
    autor: 'laura.novak',
    wlascicielBiznesowy: 'sarah.mitchell',
    wlascicielWykonania: 'laura.novak',
    sponsor: 'robert.chen',
    zakresW: [
      'Tablet terminals at 24 assembly stations',
      'Instruction authoring and revision control',
      'Photo and video content for the eight most error-prone operations',
      'Withdrawal of the printed folders',
    ],
    zakresPoza: [
      'Machine shop set-up sheets',
      'Training records (covered by Skills Matrix and Upskilling)',
      'Customer-facing documentation',
    ],
    kryteriaSukcesu: [
      'Engineering change live at every station within one shift of release',
      'Operation-related defects on the eight target operations reduced by 25%',
      'No printed instruction folders remaining on the assembly floor',
    ],
    produkty: [
      'Tablet deployment at 24 stations',
      'Authoring and revision control procedure',
      'Content set for the eight target operations',
    ],
    ryzyka: [
      'Content authoring effort is routinely underestimated',
      'Tablet ruggedisation must survive coolant and swarf',
    ],
    tagi: ['digital', 'work-instructions', 'change-control'],
    wartoscBiznesowa: 'Removes the three-week lag between an engineering change and the shop floor.',
    oczekiwanyZwrot: 'Payback in 17 months on reduced rework and faster change adoption.',
    wplyw: 'medium',
    naklad: 'medium',
    poziomRyzyka: 'medium',
    budzet: 140000,
    planStart: '2027-01-11',
    planKoniec: '2027-10-29',
    utworzono: '2026-07-14',
    wymaganeFte: 1.0,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'laura.novak', role: 'Author and technical lead', raci: 'R', influence: 3, interest: 5 },
      { osoba: 'sarah.mitchell', role: 'Business owner', raci: 'A', influence: 5, interest: 4 },
      { osoba: 'robert.chen', role: 'Sponsor and change control', raci: 'C', influence: 5, interest: 4 },
      { osoba: 'priya.sharma', role: 'Operator readiness', raci: 'I', influence: 2, interest: 3 },
    ],
  },

  // ----------------------------------------------------------------------- DRAFT (1)
  {
    slug: 'customer-portal-order-tracking',
    tytul: 'Customer Portal for Order Tracking',
    status: 'DRAFT',
    opis:
      'Northwind receives around 190 order status enquiries a month by telephone and email, each one handled manually by customer service against three separate screens. This draft proposes a customer portal that exposes confirmed delivery date, current production stage and dispatch tracking for every open order. The intent is to remove the routine enquiry rather than to answer it faster, freeing customer service for the exceptions that actually need a person. The draft is being prepared for submission to approval once the integration effort with the ERP has been sized.',
    streszczenie:
      'A self-service portal exposing delivery date, production stage and dispatch tracking for every open order.',
    problem:
      '190 order status enquiries a month are answered manually against three separate screens.',
    kategoria: 'Customer Experience',
    priorytet: 'medium',
    obszar: 'Commercial',
    autor: 'michael.grant',
    wlascicielBiznesowy: 'michael.grant',
    sponsor: 'james.whitfield',
    zakresW: [
      'Order status, confirmed delivery date and dispatch tracking',
      'Self-service access for the top 40 accounts',
      'Read-only integration with the ERP order backlog',
    ],
    zakresPoza: [
      'Online ordering or quotation',
      'Payment and credit control',
      'Accounts outside the top 40 in the first release',
    ],
    kryteriaSukcesu: [
      'Order status enquiries reduced by 60% for the accounts on the portal',
      'Confirmed delivery date visible without contacting customer service',
      'Portal adoption above 70% of the invited accounts within six months',
    ],
    produkty: ['Portal for the top 40 accounts', 'ERP read integration', 'Customer onboarding pack'],
    ryzyka: [
      'Delivery dates in the ERP are not reliable enough to publish without cleansing',
      'Integration effort is unsized until the ERP review is complete',
    ],
    tagi: ['customer', 'self-service', 'portal'],
    wartoscBiznesowa: 'Removes routine enquiries from customer service and makes the promise date visible.',
    oczekiwanyZwrot: 'To be confirmed when the integration effort is sized.',
    wplyw: 'medium',
    naklad: 'medium',
    poziomRyzyka: 'medium',
    budzet: 160000,
    planStart: '2027-03-01',
    planKoniec: '2027-12-17',
    utworzono: '2026-08-11',
    wymaganeFte: 1.1,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'michael.grant', role: 'Author and business owner', raci: 'A', influence: 2, interest: 5 },
      { osoba: 'emily.carter', role: 'Order promise data', raci: 'R', influence: 3, interest: 4 },
      { osoba: 'james.whitfield', role: 'Sponsor', raci: 'C', influence: 5, interest: 3 },
    ],
  },
  {
    slug: 'scrap-reduction-programme',
    tytul: 'Scrap Reduction Programme',
    status: 'APPROVED',
    opis:
      'Scrap ran at 3.4% of material cost in 2026 against an industry benchmark of 2.1%, which is roughly 640 thousand pounds a year of avoidable loss. The request is for a structured reduction programme built on the top five scrap codes, each with a named owner, a measured baseline and a countermeasure reviewed weekly. It deliberately avoids a site-wide campaign in favour of five focused problems that can be closed. Finance confirmed the material cost baseline in August and the steering committee approved the programme in September; delivery starts in January.',
    streszczenie:
      'A focused programme on the five largest scrap codes, each with an owner, a baseline and a weekly countermeasure review.',
    problem:
      'Scrap at 3.4% of material cost against a 2.1% benchmark is about GBP 640k a year of avoidable loss.',
    kategoria: 'Quality & Compliance',
    priorytet: 'high',
    obszar: 'Quality',
    autor: 'robert.chen',
    wlascicielBiznesowy: 'robert.chen',
    wlascicielWykonania: 'sarah.mitchell',
    sponsor: 'james.whitfield',
    projekt: 'operational-excellence-programme',
    zakresW: [
      'Top five scrap codes across both sites',
      'Measured baseline per code and named owner',
      'Weekly countermeasure review',
      'Standard work updates arising from the countermeasures',
    ],
    zakresPoza: [
      'Supplier-caused defects (covered by Supplier Quality Gate)',
      'Capital equipment replacement',
      'Packaging and transit damage',
    ],
    kryteriaSukcesu: [
      'Scrap reduced from 3.4% to 2.4% of material cost within twelve months',
      'Every one of the five codes with a measured baseline and named owner',
      'Countermeasures embedded in standard work, not held as actions',
    ],
    produkty: [
      'Scrap baseline pack by code',
      'Countermeasure register with owners',
      'Updated standard work for the affected operations',
    ],
    ryzyka: [
      'Two of the five codes span both sites and need joint ownership',
      'Countermeasure capacity competes with the MES rollout in the first quarter',
    ],
    tagi: ['scrap', 'cost-of-quality', 'lean'],
    wartoscBiznesowa: 'Converts avoidable material loss directly into margin without new capital.',
    oczekiwanyZwrot: 'Estimated GBP 470k annual saving, confirmed against the August finance baseline.',
    wplyw: 'high',
    naklad: 'low',
    poziomRyzyka: 'low',
    budzet: 60000,
    planStart: '2027-01-04',
    planKoniec: '2027-12-31',
    utworzono: '2026-08-24',
    wymaganeFte: 0.7,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'robert.chen', role: 'Author and business owner', raci: 'A', influence: 5, interest: 5 },
      { osoba: 'sarah.mitchell', role: 'Line ownership', raci: 'R', influence: 4, interest: 4 },
      { osoba: 'thomas.baker', role: 'Cost baseline', raci: 'C', influence: 4, interest: 3 },
      { osoba: 'michael.grant', role: 'Scrap measurement', raci: 'I', influence: 2, interest: 4 },
    ],
  },
  {
    slug: 'shift-handover-digitisation',
    tytul: 'Shift Handover Digitisation',
    status: 'APPROVED',
    opis:
      'Shift handover is a verbal briefing supported by a paper logbook, and the audit in June found that 30% of open issues were not carried across the handover. This draft proposes a structured digital handover with a standing agenda, open-issue carry-forward and a searchable history. The same record then feeds the morning production meeting, which currently rebuilds the picture from memory. The mandatory field set was agreed with the night shift in August and the initiative was approved in September, ahead of a November start.',
    streszczenie:
      'A structured digital shift handover with open-issue carry-forward and a searchable history.',
    problem:
      'The June audit found 30% of open issues were lost at handover because the record is verbal plus a paper logbook.',
    kategoria: 'Digital Shopfloor',
    priorytet: 'medium',
    obszar: 'Manufacturing Operations',
    autor: 'emily.carter',
    wlascicielBiznesowy: 'sarah.mitchell',
    wlascicielWykonania: 'michael.grant',
    sponsor: 'james.whitfield',
    projekt: 'digital-automation-roadmap',
    zakresW: [
      'Structured handover form for all three shifts on both sites',
      'Open-issue carry-forward with an owner and a due shift',
      'Searchable handover history',
      'Feed into the morning production meeting',
    ],
    zakresPoza: [
      'Maintenance work order management',
      'Quality non-conformance workflow',
      'Office and engineering handover',
    ],
    kryteriaSukcesu: [
      'Open issues carried across handover with no loss',
      'Morning production meeting run from the handover record',
      'Handover completed within the existing ten-minute overlap',
    ],
    produkty: [
      'Handover form and carry-forward rules',
      'Searchable history for the last twelve months',
      'Morning meeting agenda built from the record',
    ],
    ryzyka: [
      'Night shift resistance if the form takes longer than the verbal briefing',
      'Handover overlap is only ten minutes and cannot be extended',
    ],
    tagi: ['handover', 'shopfloor', 'standard-work'],
    wartoscBiznesowa: 'Stops issues from being lost between shifts and gives the morning meeting a real record.',
    oczekiwanyZwrot: 'Avoided rework and repeat stoppages, estimated at GBP 85k a year.',
    wplyw: 'medium',
    naklad: 'low',
    poziomRyzyka: 'low',
    budzet: 45000,
    planStart: '2026-11-16',
    planKoniec: '2027-05-28',
    utworzono: '2026-08-31',
    wymaganeFte: 0.5,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'emily.carter', role: 'Author', raci: 'R', influence: 3, interest: 5 },
      { osoba: 'sarah.mitchell', role: 'Business owner', raci: 'A', influence: 5, interest: 4 },
      { osoba: 'priya.sharma', role: 'Shift engagement', raci: 'C', influence: 2, interest: 3 },
    ],
  },

  // -------------------------------------------------------------------- PROPOSED (1)
  {
    slug: 'cybersecurity-hardening-ot',
    tytul: 'Cybersecurity Hardening OT',
    status: 'PROPOSED',
    opis:
      'The operational technology network shares flat addressing with the office network, and eleven programmable controllers still run firmware that the vendor no longer supports. This proposal segments the OT network, brings the controllers onto a supported firmware baseline and introduces monitored remote access for vendor support. It is raised now because the group insurer has made network segmentation a condition of the 2027 renewal. The proposal has not yet been worked into a full initiative card.',
    streszczenie:
      'Segment the OT network, retire unsupported controller firmware and monitor vendor remote access.',
    problem:
      'OT and office share flat addressing and eleven controllers run firmware the vendor no longer supports.',
    kategoria: 'OT Security',
    priorytet: 'critical',
    obszar: 'Information Technology',
    autor: 'laura.novak',
    wlascicielBiznesowy: 'robert.chen',
    sponsor: 'james.whitfield',
    zakresW: [
      'Network segmentation between OT and office',
      'Firmware baseline for eleven programmable controllers',
      'Monitored remote access for vendor support',
    ],
    zakresPoza: [
      'Office endpoint security',
      'Cloud application access review',
      'Physical site security',
    ],
    kryteriaSukcesu: [
      'OT network segmented and evidenced to the insurer before the 2027 renewal',
      'No controller running unsupported firmware',
      'All vendor remote access sessions logged and reviewable',
    ],
    produkty: [
      'Segmentation design and implementation',
      'Firmware upgrade plan for eleven controllers',
      'Remote access policy and monitoring',
    ],
    ryzyka: [
      'Firmware upgrades require line downtime on machines with no spare capacity',
      'Insurer deadline is fixed and outside Northwind control',
    ],
    tagi: ['security', 'ot', 'insurance'],
    wartoscBiznesowa: 'Protects the 2027 insurance renewal and removes an unmanaged route into production control.',
    oczekiwanyZwrot: 'Risk avoidance; no direct saving claimed at proposal stage.',
    wplyw: 'high',
    naklad: 'medium',
    poziomRyzyka: 'high',
    budzet: 210000,
    planStart: null,
    planKoniec: null,
    utworzono: '2026-09-01',
    wymaganeFte: 0.0,
    zaalokowaneFte: 0.0,
    postep: 0,
    interesariusze: [
      { osoba: 'laura.novak', role: 'Proposer', raci: 'R', influence: 3, interest: 5 },
      { osoba: 'robert.chen', role: 'Accountable owner', raci: 'A', influence: 5, interest: 4 },
      { osoba: 'james.whitfield', role: 'Sponsor', raci: 'I', influence: 5, interest: 3 },
    ],
  },

  // ---------------------------------------------------------------------- CLOSED (1)
  {
    slug: 'sap-s4-migration-assessment',
    tytul: 'SAP S/4 Migration Assessment',
    status: 'CLOSED',
    opis:
      'The current ERP goes out of mainstream vendor support in 2029, so the board asked for an evidenced view of the migration options before committing capital. This assessment compared a technical upgrade, a greenfield reimplementation and a move to a mid-market alternative, each costed against the same scope and the same three-year run cost. The recommendation was a phased technical upgrade beginning in 2028, with the finance and controlling modules first. The assessment closed on time in June and its recommendation was accepted by the board in July.',
    streszczenie:
      'Costed comparison of three ERP migration routes; recommendation accepted by the board in July 2026.',
    problem:
      'The current ERP leaves mainstream vendor support in 2029 and no costed migration route existed.',
    kategoria: 'Enterprise Systems',
    priorytet: 'high',
    obszar: 'Information Technology',
    autor: 'thomas.baker',
    wlascicielBiznesowy: 'thomas.baker',
    wlascicielWykonania: 'michael.grant',
    sponsor: 'james.whitfield',
    zakresW: [
      'Costed comparison of three migration routes',
      'Three-year run cost for each route',
      'Recommendation with a phasing proposal',
    ],
    zakresPoza: [
      'The migration itself',
      'Vendor selection and contracting',
      'Data cleansing',
    ],
    kryteriaSukcesu: [
      'Three routes costed against identical scope',
      'Recommendation accepted by the board',
      'Assessment delivered within the agreed window',
    ],
    produkty: [
      'Options paper with costed comparison',
      'Three-year total cost of ownership model',
      'Board recommendation pack',
    ],
    ryzyka: [
      'Vendor list price assumptions age quickly',
      'Scope comparability between routes is easy to lose',
    ],
    tagi: ['erp', 'assessment', 'board'],
    wartoscBiznesowa: 'Replaces a deadline with a costed plan and a decision the board could actually take.',
    oczekiwanyZwrot: 'Avoided an unbudgeted reimplementation estimated at GBP 3.1m.',
    wplyw: 'high',
    naklad: 'medium',
    poziomRyzyka: 'medium',
    budzet: 120000,
    planStart: '2026-01-12',
    planKoniec: '2026-06-30',
    utworzono: '2025-10-06',
    wymaganeFte: 0.6,
    zaalokowaneFte: 0.6,
    postep: 100,
    zamknieto: '2026-06-30',
    wynikZamkniecia:
      'Delivered on 30 June 2026. The board accepted the phased technical upgrade from 2028, finance and controlling first, and released GBP 3.1m of contingency that a greenfield reimplementation would have required.',
    interesariusze: [
      { osoba: 'thomas.baker', role: 'Business owner', raci: 'A', influence: 4, interest: 5 },
      { osoba: 'michael.grant', role: 'Analysis lead', raci: 'R', influence: 2, interest: 4 },
      { osoba: 'james.whitfield', role: 'Sponsor', raci: 'C', influence: 5, interest: 4 },
    ],
  },

  // -------------------------------------------------------------------- REJECTED (1)
  {
    slug: 'sustainability-reporting-csrd',
    tytul: 'Sustainability Reporting (CSRD)',
    status: 'REJECTED',
    blockedReason:
      'Rejected on 21 August 2026 by Thomas Baker, Finance Controller. Northwind reports through the group consolidation, which already discharges the CSRD obligation for the UK entities; a separate reporting build would duplicate the group programme at an estimated GBP 240k. To be revisited only if the group scope changes.',
    opis:
      'The proposal was to build a standalone CSRD reporting capability covering both sites, with its own data collection, assurance trail and disclosure pack. Finance reviewed it against the group reporting programme and found the same disclosures already covered by the group consolidation that Northwind feeds. Building a second capability would duplicate roughly 240 thousand pounds of work already funded at group level. The request was rejected in August, with a standing instruction to revisit it only if the group reporting scope changes.',
    streszczenie:
      'Standalone CSRD reporting build; rejected because the group consolidation already discharges the obligation.',
    problem:
      'CSRD disclosure obligations for the UK entities needed a clear reporting route.',
    kategoria: 'Energy & Sustainability',
    priorytet: 'medium',
    obszar: 'Finance',
    autor: 'priya.sharma',
    wlascicielBiznesowy: 'thomas.baker',
    sponsor: 'james.whitfield',
    zakresW: [
      'Standalone data collection for both sites',
      'Assurance trail for the disclosed metrics',
      'Annual disclosure pack',
    ],
    zakresPoza: ['Group consolidation reporting', 'Scope 3 supplier engagement'],
    kryteriaSukcesu: [
      'Disclosures produced without reliance on the group programme',
      'Assurance trail acceptable to the external auditor',
    ],
    produkty: ['Data collection design', 'Assurance trail', 'Disclosure pack template'],
    ryzyka: [
      'Duplicates a group programme that is already funded',
      'Two reporting routes would need reconciling every year',
    ],
    tagi: ['esg', 'csrd', 'reporting'],
    wartoscBiznesowa: 'None additional — the obligation is already discharged through the group consolidation.',
    oczekiwanyZwrot: 'Not applicable; the request was rejected as duplicate spend.',
    wplyw: 'low',
    naklad: 'medium',
    poziomRyzyka: 'low',
    budzet: 240000,
    planStart: null,
    planKoniec: null,
    utworzono: '2026-07-02',
    wymaganeFte: 0.0,
    zaalokowaneFte: 0.0,
    postep: 0,
    odrzucono: '2026-08-21',
    decydent: 'thomas.baker',
    interesariusze: [
      { osoba: 'thomas.baker', role: 'Decision maker', raci: 'A', influence: 4, interest: 4 },
      { osoba: 'priya.sharma', role: 'Requestor', raci: 'R', influence: 2, interest: 4 },
      { osoba: 'james.whitfield', role: 'Sponsor', raci: 'I', influence: 5, interest: 2 },
    ],
  },
];

/** Rozkład statusów policzony z danych, nie zadeklarowany. */
export function rozkladStatusow(
  inicjatywy: readonly Inicjatywa[] = INICJATYWY
): Record<StatusInicjatywy, number> {
  const out = {} as Record<StatusInicjatywy, number>;
  for (const s of STATUSY_KANONICZNE) out[s] = 0;
  for (const i of inicjatywy) out[i.status] += 1;
  return out;
}

/**
 * STOP 1 (`PLAN.md` §D3) — kolejność wymuszona przez KOD, nie przez wygodę.
 *
 * Dwie niezależne reguły mówią to samo: inicjatywa nie może wejść do bazy od razu
 * jako `IN_EXECUTION`.
 *   1) `VALID_TRANSITIONS` (`initiativeStatuses.ts`) dopuszcza `IN_EXECUTION` tylko
 *      z `APPROVED`, przez bramkę `START` — więc jedyna uczciwa droga to zapisać
 *      `APPROVED` i przejść kanonicznym pisarzem (`PATCH /api/initiatives/:id/status`),
 *      który sprawdzi przekazanie, datę startu i gotowość bramki.
 *   2) `register` (`registerModuleInitiativeForPlanning.ts:28-34`) wprost ODRZUCA
 *      `IN_EXECUTION` — `PLANNABLE_MODULE_STATUSES` to `APPROVED`/`PENDING_APPROVAL`.
 * Ta funkcja zwraca status ETAPU SQL (przed przejściem kanonicznym).
 */
export function statusEtapuSql(inicjatywa: Inicjatywa): StatusInicjatywy {
  return inicjatywa.status === 'IN_EXECUTION' ? 'APPROVED' : inicjatywa.status;
}

/**
 * Inicjatywy, dla których zakładamy agregat runtime-v1 przez `register`.
 *
 * D4b (DECYZJA 2) — OSIEM: cztery `APPROVED` (zostają w `APPROVED_BACKLOG`)
 * ORAZ cztery `IN_EXECUTION`, które przechodzą PEŁNY łańcuch przekazania
 * (`register` -> okno planu -> `scheduleDecision` -> `handoffAcceptance`)
 * i kończą w `lifecycleState = 'IN_EXECUTION'`.
 *
 * DLACZEGO TO NIE PRZYKRYWA STATUSU (obawa D3, DEC-397): rejestr runtime-v1
 * wygrywa z wierszem klasycznym, ale `statusMapping.ts:22` mapuje
 * `lifecycleState = 'IN_EXECUTION'` na status `IN_EXECUTION` — więc po pełnym
 * łańcuchu lista pokazuje PRAWDĘ. Groźny jest wyłącznie agregat, który UTKNĄŁ
 * w `APPROVED_BACKLOG`/`SCHEDULED` na inicjatywie realizowanej; dokładnie to
 * (i tylko to) pilnuje zwężona asercja `--verify`.
 *
 * KOLEJNOŚĆ JEST WYMUSZONA: `register` odmawia statusu `IN_EXECUTION`
 * (`registerModuleInitiativeForPlanning.ts:38` — `PLANNABLE_MODULE_STATUSES =
 * ['APPROVED','PENDING_APPROVAL']`), dlatego etap SQL zapisuje realizowane jako
 * `APPROVED` (`statusEtapuSql`), a przejście wiersza na `IN_EXECUTION` idzie
 * DOPIERO po domknięciu łańcucha.
 */
export function doRejestracji(
  inicjatywy: readonly Inicjatywa[] = INICJATYWY
): readonly Inicjatywa[] {
  return inicjatywy.filter((i) => i.status === 'APPROVED' || i.status === 'IN_EXECUTION');
}

/** Cztery realizowane inicjatywy — dla nich D4b buduje `execution_case`. */
export const SLUGI_PRZEKAZANIA = [
  'predictive-maintenance-cnc',
  'mes-rollout-line-3',
  'warehouse-automation-pilot',
  'skills-matrix-upskilling',
] as const;

/**
 * Osiem inicjatyw wchodzących do opublikowanego planu (zakładka „Plan").
 * Muszą to być DOKŁADNIE te z `doRejestracji()` — plan przyjmuje wyłącznie okna
 * z agregatem w stanie `APPROVED_BACKLOG` (`planScenario.ts:205-222`), a
 * `scheduleDecision.ts:144-146` żąda okna DOKŁADNIE dla tej inicjatywy i
 * DOKŁADNIE dla jej bieżącej wersji agregatu („Exact Initiative planned window
 * is missing"). Bez okna dla czterech realizowanych łańcucha nie da się przejść.
 */
export const SLUGI_PLANU = [
  'energy-monitoring-iso-50001',
  'supplier-quality-gate',
  'scrap-reduction-programme',
  'shift-handover-digitisation',
  ...SLUGI_PRZEKAZANIA,
] as const;

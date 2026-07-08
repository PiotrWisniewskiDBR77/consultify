/**
 * Logistics Automation — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * logistics-automation "depth staircase" per warehouse zone of the flow:
 *
 *   1. surface          — what is the current flow / mechanisation in this zone?
 *   2. evidence         — is it measured on the floor (gemba), or read off a WMS report?
 *   3. quantification   — how much labour / volume / walking cost sits here, baseline vs peak?
 *   4. risk-capability  — what must be true (process first, inventory accuracy >95%) to automate it?
 *
 * The five canonical zones mirror the disciplined end-to-end warehouse flow the
 * doctrine walks physically (przyjęcie → składowanie → kompletacja → pakowanie →
 * wysyłka), because automation candidates are located zone-by-zone, never in the
 * abstract:
 *   - receiving : unload / scan / qualify inbound units
 *   - storage   : put-away and hold — the ASRS / vertical-system question
 *   - picking   : order compilation — where walking/searching usually dominates (up to 70%)
 *   - packing   : pack stations, standardisation, robotic packing
 *   - shipping  : sortation, dock loading, cut-off window pressure
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (logisticsEngine.ts).
 */

export type LogisticsZoneId =
  | 'receiving'
  | 'storage'
  | 'picking'
  | 'packing'
  | 'shipping';

export const LOGISTICS_ZONES: LogisticsZoneId[] = [
  'receiving',
  'storage',
  'picking',
  'packing',
  'shipping',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and zone-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'risk-capability';
  /** 1-4 depth level (surface..risk) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing. */
  rationale: Bilingual;
}

const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const LOGISTICS_LADDER_RUNG_ORDER = RUNG_ORDER;

const LOGISTICS_ZONE_LABEL: Record<LogisticsZoneId, Bilingual> = {
  receiving: { pl: 'Przyjęcie', en: 'Receiving' },
  storage: { pl: 'Składowanie', en: 'Storage' },
  picking: { pl: 'Kompletacja', en: 'Picking' },
  packing: { pl: 'Pakowanie', en: 'Packing' },
  shipping: { pl: 'Wysyłka', en: 'Shipping' },
};

export const logisticsZoneLabel = (zone: LogisticsZoneId): Bilingual =>
  LOGISTICS_ZONE_LABEL[zone];

/**
 * Per-zone deepening ladder. Each zone has exactly 4 rungs in RUNG_ORDER, so the
 * synthesis engine can rely on a stable shape.
 */
export const LOGISTICS_DEEPENING_LADDER: Record<LogisticsZoneId, LadderRung[]> = {
  receiving: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak dziś wygląda przyjęcie towaru — jednorodne palety czy nieregularny mix, ile doków, ile ręcznego skanowania na jednostkę?',
        en: 'What does receiving look like today — uniform pallets or an irregular mix, how many docks, how much manual scanning per unit?',
      },
      rationale: {
        pl: 'Automatyzacja przyjęcia ma sens przy wysokim wolumenie jednorodnych jednostek, a nie przy nieregularnym miksie — najpierw trzeba wiedzieć, co realnie wjeżdża przez dok.',
        en: 'Automating receiving pays off with high volumes of uniform units, not with an irregular mix — you first have to know what actually rolls through the dock.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd znacie czas i pracochłonność przyjęcia — z obserwacji na hali czy z raportu WMS pokazującego tylko throughput na wyjściu?',
        en: 'Where does your receiving time and labour figure come from — floor observation, or a WMS report that shows only output throughput?',
      },
      rationale: {
        pl: 'Raport WMS pokaże ile jednostek przyjęto, nie pokaże kolejki ciężarówek na doku ani obejść procedur — dowodem jest gemba, nie eksport z systemu.',
        en: 'A WMS report shows how many units were received, not the truck queue at the dock or the procedure workarounds — the evidence is gemba, not a system export.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE i ile jednostek/dzień przechodzi przez przyjęcie w baseline i w szczycie, jaki % czasu to oczekiwanie/rozładunek vs praca właściwa?',
        en: 'How many FTE and units/day pass through receiving at baseline and at peak, and what share of time is waiting/unloading versus value-added work?',
      },
      rationale: {
        pl: 'Przyjęcie bywa głośne (kolejki na doku), ale przy niskim FTE jego absolutna dźwignia finansowa jest zwykle mała — liczba FTE × % nieprodukcyjny mówi, czy to realny kandydat.',
        en: 'Receiving is often loud (dock queues) but at low FTE its absolute financial leverage is usually small — FTE × non-productive share tells you whether it is a real candidate.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy dane wejściowe (ASN, etykiety dostawców) są na tyle uporządkowane, by automatyczne skanowanie/OCR działało bez ciągłej ręcznej korekty?',
        en: 'Is inbound data (ASN, supplier labels) clean enough for automated scanning/OCR to run without constant manual correction?',
      },
      rationale: {
        pl: 'Automatyczne przyjęcie na nieuporządkowanych danych dostawcy przenosi pracę z rozładunku na korektę wyjątków — najpierw ustandaryzuj wejście, potem automatyzuj.',
        en: 'Automated receiving on messy supplier data shifts work from unloading to exception handling — standardise the inbound stream first, then automate.',
      },
    },
  ],
  storage: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak składujecie — regały statyczne, jaka gęstość SKU, i czy budynek jest wykorzystany pionowo, czy tylko poziomo?',
        en: 'How do you store today — static racking, what SKU density, and is the building used vertically or only horizontally?',
      },
      rationale: {
        pl: 'Niewykorzystana wysokość budynku wygląda atrakcyjnie dla ASRS/systemów pionowych, ale sama wolna kubatura to jeszcze nie business case — to dopiero sygnał do zbadania.',
        en: 'Unused building height looks attractive for ASRS/vertical systems, but free cubic space alone is not yet a business case — it is only a signal to investigate.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaka jest realna dokładność zapasu (inventory accuracy) — zmierzona cyklicznym liczeniem, czy założona „bo WMS tak pokazuje"?',
        en: 'What is the real inventory accuracy — measured by cycle counting, or assumed "because the WMS says so"?',
      },
      rationale: {
        pl: 'Dokładność zapasu poniżej ~95% jest twardym warunkiem wstępnym: automatyzacja składowania na niepewnych danych o lokalizacji przewozi błędy szybciej, nie je eliminuje.',
        en: 'Inventory accuracy below ~95% is a hard precondition: automating storage on unreliable location data moves errors faster, it does not eliminate them.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile m² i jaka gęstość składowania obecna vs teoretyczna, jaki koszt m²/miesiąc — i czy odzysk powierzchni jest realnie monetyzowalny (podnajem, uniknięcie ekspansji)?',
        en: 'How many m² and what current vs theoretical storage density, what m²/month cost — and is reclaimed space genuinely monetisable (sublease, avoided expansion)?',
      },
      rationale: {
        pl: 'Odzysk powierzchni ma wartość tylko wtedy, gdy można go zamienić na pieniądz — w przeciwnym razie „gęściej” to wskaźnik próżności, nie linia w business case.',
        en: 'Reclaimed space has value only if it converts into money — otherwise "denser" is a vanity metric, not a line in the business case.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy budynek udźwignie technologię (wysokość, nośność podłogi, zasilanie) i czy horyzont wolumenu/najmu uzasadnia 15-25-letnie życie ASRS?',
        en: 'Can the building carry the technology (height, floor loading, power) and does the volume/lease horizon justify the 15-25-year life of an ASRS?',
      },
      rationale: {
        pl: 'ASRS o życiu 15-25 lat w obiekcie z umową najmu na 3 lata to zła decyzja niezależnie od ROI na papierze — ograniczenia budynku i horyzont są twardsze niż model finansowy.',
        en: 'An ASRS with a 15-25-year life in a building leased for 3 years is a bad decision regardless of the ROI on paper — building limits and horizon are harder than the financial model.',
      },
    },
  ],
  picking: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak kompletujecie zamówienia — picker chodzi po całej hali, jak ustawiony jest slotting (wg rotacji czy wg daty przyjęcia), pojedyncze SKU czy multi-SKU?',
        en: 'How do you pick orders — does the picker walk the whole floor, how is slotting set (by rotation or by receipt date), single-SKU or multi-SKU?',
      },
      rationale: {
        pl: 'Losowy slotting (wg daty przyjęcia, nie rotacji) to najczęstsza ukryta przyczyna nadmiernego chodzenia — najpierw zobacz układ trasy, zanim policzysz roboty.',
        en: 'Random slotting (by receipt date, not rotation) is the most common hidden cause of excess walking — see the route layout before you count robots.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile % czasu pickera to realnie chodzenie i szukanie, a ile faktyczna kompletacja — zmierzone stoperem na trasie, czy zgadnięte?',
        en: 'What share of the picker\'s time is really walking and searching versus actual compilation — measured with a stopwatch on the route, or guessed?',
      },
      rationale: {
        pl: 'W typowym magazynie do 70% czasu pickera to ruch, nie praca dodająca wartość — ta jedna, dobrze zmierzona liczba jest zwykle największym pojedynczym argumentem całej oceny.',
        en: 'In a typical warehouse up to 70% of a picker\'s time is motion, not value-added work — that single, well-measured number is usually the biggest single argument in the whole assessment.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE w kompletacji, jaki koszt pracy w pełni obciążony, ile linii/dzień baseline i peak — jaki roczny koszt daje sam nieprodukcyjny ruch w tym obszarze?',
        en: 'How many FTE in picking, what fully-loaded labour cost, how many lines/day at baseline and peak — what annual cost does non-productive motion alone generate here?',
      },
      rationale: {
        pl: 'Picking zwykle skupia najwięcej FTE, więc % nieprodukcyjny × liczba FTE × koszt pracy daje największą pojedynczą kwotę — to ona uzasadnia priorytet, nie „głośność” obszaru.',
        en: 'Picking usually concentrates the most FTE, so non-productive % × FTE × labour cost yields the largest single amount — that, not the zone\'s "loudness", justifies priority.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy da się najpierw usunąć chodzenie reorganizacją procesu (re-slotting wg ABC/rotacji) bez CAPEX — i co zostaje jako kandydat na AMR/goods-to-person PO uporządkowaniu?',
        en: 'Can the walking be removed first by process reorg (re-slotting by ABC/rotation) without CAPEX — and what remains as an AMR/goods-to-person candidate AFTER the cleanup?',
      },
      rationale: {
        pl: 'Automatyzacja pickingu przed re-slottingiem utrwala nieefektywność — droższą i szybszą; sama reorganizacja procesu daje 10-20% poprawy przepustowości zanim padnie złotówka na sprzęt.',
        en: 'Automating picking before re-slotting cements the inefficiency — pricier and faster; process reorg alone yields 10-20% throughput gain before a zloty is spent on hardware.',
      },
    },
  ],
  packing: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak pakujecie — ręczne stacje, jak zestandaryzowane są opakowania, ile wariantów rozmiarów kartonów obsługujecie?',
        en: 'How do you pack — manual stations, how standardised is packaging, how many carton-size variants do you handle?',
      },
      rationale: {
        pl: 'Automatyczne stacje pakujące i pakowanie robotyczne mają sens przy wysokiej standaryzacji opakowań — mnogość niestandardowych wariantów podnosi koszt integracji ponad korzyść.',
        en: 'Automated pack stations and robotic packing pay off with high packaging standardisation — a proliferation of bespoke variants pushes integration cost above the benefit.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że pakowanie jest wąskim gardłem — z obserwacji kolejki przed stacjami, czy z ogólnego wrażenia „i tu się korkuje”?',
        en: 'How do you know packing is a bottleneck — from observing the queue in front of the stations, or from a general impression that "it jams here too"?',
      },
      rationale: {
        pl: 'Kolejka przed pakowaniem bywa objawem problemu w kompletacji (nierówny dopływ), nie samego pakowania — dowodem jest gdzie fizycznie narasta bufor, nie odczucie.',
        en: 'A queue before packing is often a symptom of a picking problem (uneven feed), not of packing itself — the evidence is where the buffer physically builds, not a feeling.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE i przesyłek/dzień przechodzi przez pakowanie baseline vs peak, jaki % czasu to przezbrojenia opakowań vs praca właściwa?',
        en: 'How many FTE and shipments/day pass through packing at baseline vs peak, and what share of time is packaging changeovers versus value-added work?',
      },
      rationale: {
        pl: 'Jeśli pakowanie ma nadmiarową zdolność względem kompletacji, jego automatyzacja przyspieszy krok, którego throughput i tak wyznacza wąskie gardło gdzie indziej.',
        en: 'If packing has spare capacity relative to picking, automating it speeds up a step whose throughput is capped by a bottleneck elsewhere anyway.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy standaryzacja opakowań (ograniczenie wariantów kartonów, jednolite kartony) da się zrobić najpierw procesowo, zanim kupicie stację pakującą?',
        en: 'Can packaging standardisation (fewer carton variants, uniform cartons) be done as a process step first, before buying a pack station?',
      },
      rationale: {
        pl: 'Standaryzacja opakowań jest tania i procesowa — wykonana przed automatyzacją zwiększa jej zwrot; wykonana po zmusza do przeprojektowania świeżo kupionej stacji.',
        en: 'Packaging standardisation is cheap and process-based — done before automation it raises its return; done after, it forces a redesign of a freshly bought station.',
      },
    },
  ],
  shipping: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak wygląda wysyłka — ręczne sortowanie na doki, ile przesyłek/dzień, jak ostry jest cut-off (okno czasowe wysyłki)?',
        en: 'What does shipping look like — manual sortation to docks, how many shipments/day, how tight is the cut-off (dispatch time window)?',
      },
      rationale: {
        pl: 'Sortery i automatyczne ładowanie mają sens przy wysokim wolumenie przesyłek i twardej presji cut-off — bez ostrego okna czasowego korzyść jest głównie kosmetyczna.',
        en: 'Sorters and automated loading pay off with high shipment volume and hard cut-off pressure — without a tight time window the benefit is mostly cosmetic.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że wysyłka nie wyrabia — z obserwacji spiętrzenia przed cut-off, czy z reklamacji przewoźnika o spóźnionych podstawieniach?',
        en: 'How do you know shipping can\'t keep up — from observing the pile-up before cut-off, or from carrier complaints about late dispatch?',
      },
      rationale: {
        pl: 'Spiętrzenie na wysyłce zwykle dziedziczy problem z pakowania/kompletacji — automatyzacja samej wysyłki bez usunięcia źródła przyspiesza ostatni krok bałaganu.',
        en: 'A shipping pile-up usually inherits a packing/picking problem — automating shipping alone without removing the source speeds up the last step of the mess.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE i przesyłek/dzień przechodzi przez wysyłkę baseline vs peak, ile kosztuje przekroczony cut-off (kara przewoźnika, utracone okno)?',
        en: 'How many FTE and shipments/day pass through shipping at baseline vs peak, and what does a missed cut-off cost (carrier penalty, lost window)?',
      },
      rationale: {
        pl: 'Koszt przekroczonego cut-off jest realną liczbą do business case — bez niej „szybsza wysyłka” to obietnica bez ceny, której nie da się obronić przed zarządem.',
        en: 'The cost of a missed cut-off is a real number for the business case — without it "faster shipping" is a promise without a price, indefensible to the board.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy wysyłka jest realnym ograniczeniem całego przepływu, czy tylko ostatnim widocznym krokiem — i czy sorter usunie wąskie gardło, czy je tylko przesunie?',
        en: 'Is shipping the real end-to-end constraint, or just the last visible step — and would a sorter remove the bottleneck or merely relocate it?',
      },
      rationale: {
        pl: 'Automatyzacja wysyłki, która nie jest ograniczeniem przepływu, jest kosztowna i widoczna, ale nie zmienia throughputu end-to-end — najpierw zlokalizuj prawdziwe wąskie gardło.',
        en: 'Automating shipping when it is not the flow constraint is costly and visible but does not change end-to-end throughput — locate the true bottleneck first.',
      },
    },
  ],
};

export interface ZoneProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per zone. Consumed when AI (or the offline
 * fallback) proposes candidate automation moves. Mirrors Inventory's
 * INVENTORY_PROPOSAL_BANK. Every zone keeps the doctrine's sequence: a
 * process-first, no-CAPEX proposal precedes any hardware proposal.
 */
export const LOGISTICS_PROPOSAL_BANK: Record<LogisticsZoneId, ZoneProposal[]> = {
  receiving: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować profil przyjęcia: jednorodne palety vs mix',
        en: 'Map the receiving profile: uniform pallets vs mix',
      },
      explanation: {
        pl: 'Rozbijcie inbound na jednorodne palety i nieregularny mix — automatyzacja przyjęcia opłaca się tylko dla wysokiego wolumenu jednorodnych jednostek, nie dla miksu.',
        en: 'Split inbound into uniform pallets and irregular mix — receiving automation only pays for high volumes of uniform units, not for the mix.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć czas rozładunku na doku (gemba), nie z WMS',
        en: 'Measure dock unload time on the floor (gemba), not from WMS',
      },
      explanation: {
        pl: 'Obserwujcie kolejkę ciężarówek i rzeczywisty czas rozładunku na hali — raport WMS pokazuje throughput na wyjściu, nie oczekiwanie na doku.',
        en: 'Observe the truck queue and real unload time on the floor — the WMS report shows output throughput, not dock waiting.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć FTE i % nieprodukcyjny przyjęcia baseline vs peak',
        en: 'Quantify receiving FTE and non-productive % baseline vs peak',
      },
      explanation: {
        pl: 'Zsumujcie FTE i udział oczekiwania w przyjęciu osobno dla dnia typowego i szczytowego — niskie FTE oznacza małą absolutną dźwignię mimo widocznych kolejek.',
        en: 'Sum receiving FTE and the waiting share separately for a typical and a peak day — low FTE means small absolute leverage despite visible queues.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustandaryzować dane dostawcy (ASN/etykiety) przed OCR',
        en: 'Standardise supplier data (ASN/labels) before OCR',
      },
      explanation: {
        pl: 'Wymuście spójne awizacje i etykiety dostawców, zanim wdrożycie automatyczne skanowanie — inaczej automat przeniesie pracę na obsługę wyjątków.',
        en: 'Enforce consistent supplier ASN and labels before deploying automated scanning — otherwise the automation shifts work to exception handling.',
      },
    },
  ],
  storage: [
    {
      rung: 'surface',
      title: {
        pl: 'Ocenić wykorzystanie wysokości budynku vs pozioma zabudowa',
        en: 'Assess building-height use vs horizontal footprint',
      },
      explanation: {
        pl: 'Zmierzcie realną gęstość składowania i niewykorzystaną wysokość — to sygnał do zbadania ASRS/systemów pionowych, jeszcze nie business case.',
        en: 'Measure real storage density and unused height — a signal to investigate ASRS/vertical systems, not yet a business case.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zwalidować dokładność zapasu cyklicznym liczeniem',
        en: 'Validate inventory accuracy with cycle counting',
      },
      explanation: {
        pl: 'Zmierzcie realną dokładność zapasu przed jakąkolwiek oceną technologii — jeśli <95%, pierwsza inwestycja to dane i dyscyplina WMS, nie ASRS.',
        en: 'Measure real inventory accuracy before any technology assessment — if below 95%, the first investment is data and WMS discipline, not an ASRS.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wycenić odzysk m² tylko jeśli monetyzowalny',
        en: 'Value reclaimed m² only if monetisable',
      },
      explanation: {
        pl: 'Policzcie odzyskaną powierzchnię wyłącznie jako pieniądz (podnajem, uniknięcie ekspansji) — bez tego „gęściej” jest wskaźnikiem próżności, nie linią business case.',
        en: 'Count reclaimed space strictly as money (sublease, avoided expansion) — otherwise "denser" is a vanity metric, not a business-case line.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zweryfikować ograniczenia budynku i horyzont inwestycji',
        en: 'Verify building limits and investment horizon',
      },
      explanation: {
        pl: 'Sprawdźcie wysokość, nośność podłogi, zasilanie i horyzont najmu/wolumenu — ASRS o życiu 15-25 lat wymaga pewności, że obiekt i wolumen to udźwigną.',
        en: 'Check height, floor loading, power and lease/volume horizon — an ASRS with a 15-25-year life needs certainty the building and volume will carry it.',
      },
    },
  ],
  picking: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować ścieżki kompletacji i obecny slotting',
        en: 'Map picking routes and current slotting',
      },
      explanation: {
        pl: 'Prześledźcie trasę pickera i zasadę slottingu — losowy układ (wg daty przyjęcia, nie rotacji) to najczęstsza ukryta przyczyna nadmiernego chodzenia.',
        en: 'Trace the picker route and the slotting rule — a random layout (by receipt date, not rotation) is the most common hidden cause of excess walking.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć % czasu chodzenia stoperem na trasie',
        en: 'Measure walking-time % with a stopwatch on the route',
      },
      explanation: {
        pl: 'Rozbijcie czas pickera na chodzenie/szukanie vs kompletację, mierząc na hali — ta liczba (nawet do 70% ruchu) jest zwykle najmocniejszym argumentem całej oceny.',
        en: 'Split picker time into walking/searching vs compilation, measured on the floor — that number (up to 70% motion) is usually the strongest argument in the whole assessment.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyliczyć roczny koszt nieprodukcyjnego ruchu w pickingu',
        en: 'Cost the annual non-productive motion in picking',
      },
      explanation: {
        pl: 'Pomnóżcie % nieprodukcyjny × FTE × koszt pracy w pełni obciążony — to daje pojedynczą, obronialną kwotę rocznego kosztu chodzenia w tym obszarze.',
        en: 'Multiply non-productive % × FTE × fully-loaded labour cost — this yields a single, defensible annual cost of walking in this zone.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Najpierw re-slotting wg ABC/rotacji, dopiero potem AMR',
        en: 'Re-slot by ABC/rotation first, only then consider AMR',
      },
      explanation: {
        pl: 'Przeprojektujcie slotting (najszybciej rotujące SKU najbliżej pakowania) bez CAPEX — 10-20% poprawy przepustowości; kandydat na AMR/goods-to-person oceniajcie na oczyszczonym procesie.',
        en: 'Redesign slotting (fastest-rotating SKUs nearest packing) with no CAPEX — 10-20% throughput gain; assess the AMR/goods-to-person candidate on the cleaned-up process.',
      },
    },
  ],
  packing: [
    {
      rung: 'surface',
      title: {
        pl: 'Zinwentaryzować warianty opakowań i stanowiska pakujące',
        en: 'Inventory packaging variants and pack stations',
      },
      explanation: {
        pl: 'Policzcie liczbę wariantów kartonów i typów opakowań — automatyczne stacje mają sens przy wysokiej standaryzacji, mnogość wariantów podnosi koszt integracji.',
        en: 'Count carton variants and packaging types — automated stations pay off with high standardisation; a proliferation of variants raises integration cost.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Sprawdzić, czy kolejka to problem pakowania czy dopływu',
        en: 'Check if the queue is a packing or a feed problem',
      },
      explanation: {
        pl: 'Zaobserwujcie, gdzie fizycznie narasta bufor — kolejka przed pakowaniem często dziedziczy nierówny dopływ z kompletacji, nie brak zdolności samego pakowania.',
        en: 'Observe where the buffer physically builds — a queue before packing often inherits an uneven feed from picking, not a lack of packing capacity.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć zdolność pakowania względem kompletacji',
        en: 'Cost packing capacity relative to picking',
      },
      explanation: {
        pl: 'Zestawcie przepustowość pakowania z pickingiem — jeśli pakowanie ma nadmiar zdolności, jego automatyzacja przyspiesza krok ograniczony i tak gdzie indziej.',
        en: 'Compare packing throughput with picking — if packing has spare capacity, automating it speeds a step capped elsewhere anyway.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustandaryzować opakowania procesowo przed automatyzacją',
        en: 'Standardise packaging as a process before automating',
      },
      explanation: {
        pl: 'Ograniczcie warianty kartonów i ujednolićcie opakowania jako tani krok procesowy — wykonany przed zakupem stacji zwiększa jej zwrot, po zmusza do przeprojektowania.',
        en: 'Cut carton variants and unify packaging as a cheap process step — done before buying a station it raises its return; done after, it forces a redesign.',
      },
    },
  ],
  shipping: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować sortowanie na doki i ostrość cut-off',
        en: 'Map dock sortation and cut-off tightness',
      },
      explanation: {
        pl: 'Opiszcie ręczne sortowanie na doki i twardość okna cut-off — sortery/automatyczne ładowanie mają sens przy wysokim wolumenie i ostrej presji czasowej.',
        en: 'Describe manual dock sortation and cut-off hardness — sorters/automated loading pay off with high volume and tight time pressure.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Sprawdzić, czy spiętrzenie to źródło czy dziedziczenie',
        en: 'Check whether the pile-up is a source or inherited',
      },
      explanation: {
        pl: 'Zaobserwujcie spiętrzenie przed cut-off — jeśli dziedziczy problem z pakowania/kompletacji, automatyzacja wysyłki przyspieszy ostatni krok bałaganu.',
        en: 'Observe the pile-up before cut-off — if it inherits a packing/picking problem, automating shipping speeds the last step of the mess.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wycenić koszt przekroczonego cut-off',
        en: 'Cost a missed cut-off',
      },
      explanation: {
        pl: 'Policzcie karę przewoźnika i koszt utraconego okna wysyłki — to realna liczba, bez której „szybsza wysyłka” jest obietnicą bez ceny.',
        en: 'Cost the carrier penalty and the lost dispatch window — a real number without which "faster shipping" is a promise with no price.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zlokalizować prawdziwe ograniczenie przed zakupem sortera',
        en: 'Locate the true constraint before buying a sorter',
      },
      explanation: {
        pl: 'Ustalcie, czy wysyłka jest realnym wąskim gardłem end-to-end, czy tylko ostatnim widocznym krokiem — sorter na nie-ograniczeniu przesuwa problem, nie usuwa go.',
        en: 'Establish whether shipping is the real end-to-end bottleneck or just the last visible step — a sorter on a non-constraint relocates the problem, it does not remove it.',
      },
    },
  ],
};

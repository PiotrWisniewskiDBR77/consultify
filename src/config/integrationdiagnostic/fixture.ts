/**
 * Integration Diagnostic — worked-example fixture.
 *
 * Distribution company worked example from the doctrine SSOT
 * (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/integration-diagnostic.md §7):
 * mid-size distributor, 18 active systems, 22 mapped integrations, 2 manual
 * re-keying bridges, ERP as a de facto unowned hub (9 of 22 integrations
 * touch it), maturity level 1-2 (Gartner: Ad hoc / Enlightened).
 *
 * Encodes the raw doctrine facts into `OperationalToolData.sections` using the
 * exact keys `toIntegrationSession` (./index.ts) reads: `systems`,
 * `integrations`, `bridges`, `moves`. Each section item is typed as the base
 * `OperationalItem` plus the extra fields the adapter defensively reads off
 * the raw record (see index.ts's `toIntegrationSession` field-by-field doc
 * comment) — those extra fields have no dedicated slot on `OperationalItem`,
 * so every section defines a small local extension type instead of relying on
 * excess-property-check-defeating casts.
 */

import type { OperationalItem, OperationalToolData, InitiativeDraft } from '@/store/useToolStore';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';

// ---------------------------------------------------------------------------
// Section item extension types (OperationalItem + the adapter's extra reads)
// ---------------------------------------------------------------------------

type SystemItem = OperationalItem & {
  hasApi?: boolean;
  owned?: boolean;
};

type IntegrationItem = OperationalItem & {
  from?: string;
  to?: string;
  critical?: boolean;
  spof?: boolean;
  documented?: boolean;
  monitored?: boolean;
  reusesApi?: boolean;
  mttrHours?: number;
  pointToPoint?: boolean;
};

type BridgeItem = OperationalItem & {
  people?: number;
  hoursPerMonth?: number;
  errorRate?: number;
  critical?: boolean;
  bothHaveApi?: boolean;
};

type MoveItem = OperationalItem & {
  evidence?: string[];
};

// ---------------------------------------------------------------------------
// Systems — 18 active systems (application landscape)
// ---------------------------------------------------------------------------

const systems: SystemItem[] = [
  {
    id: 'erp',
    title: 'ERP',
    description: 'System core: zamówienia, produkcja, magazyn wirtualny, integracje finansowe.',
    impact: 'high',
    effort: 'high',
    category: 'core',
    target: 'ERP',
    // Hub-owner gap is deliberate: ERP is the de facto integration hub but no one
    // formally owns the *integration role* — the app has IT, the hub does not.
    owned: false,
    hasApi: true,
  },
  {
    id: 'wms',
    title: 'WMS magazynowy',
    description: 'Zarządzanie magazynem: przyjęcia, lokalizacje, kompletacja, wysyłki.',
    impact: 'high',
    effort: 'high',
    category: 'core',
    target: 'WMS',
    owned: false,
    hasApi: false,
  },
  {
    id: 'ecommerce',
    title: 'E-commerce B2B',
    description: 'Sklep B2B dla klientów hurtowych: katalog, ceny, dostępność, zamówienia.',
    impact: 'high',
    effort: 'medium',
    category: 'core',
    target: 'E-commerce B2B',
    owner: 'Dział e-commerce',
    owned: true,
    hasApi: true,
  },
  {
    id: 'crm',
    title: 'CRM',
    description: 'Sprzedaż, historia klienta, lejek ofertowy.',
    impact: 'high',
    effort: 'medium',
    category: 'core',
    target: 'CRM',
    owner: 'Dział sprzedaży',
    owned: true,
    hasApi: true,
  },
  {
    id: 'accounting',
    title: 'Księgowość',
    description: 'Faktury, rozrachunki, sprawozdawczość finansowa.',
    impact: 'high',
    effort: 'medium',
    category: 'core',
    target: 'Księgowość',
    owner: 'Finanse',
    owned: true,
    hasApi: true,
  },
  {
    id: 'payments',
    title: 'Bramka płatności',
    description: 'Rozliczenia płatności online i przelewów B2B.',
    impact: 'medium',
    effort: 'low',
    category: 'satellite',
    target: 'Płatności',
    owner: 'IT',
    owned: true,
    hasApi: true,
  },
  {
    id: 'hr-saas',
    title: 'HR SaaS',
    description: 'Kadry i płace, ewidencja czasu pracy.',
    impact: 'low',
    effort: 'low',
    category: 'satellite',
    target: 'HR SaaS',
    owned: false,
    hasApi: true,
  },
  {
    id: 'marketing-saas',
    title: 'Marketing Automation SaaS',
    description: 'Kampanie e-mail/SMS, scoring leadów.',
    impact: 'low',
    effort: 'low',
    category: 'satellite',
    target: 'Marketing Automation',
    owned: false,
    hasApi: true,
  },
  {
    id: 'helpdesk-saas',
    title: 'Helpdesk SaaS',
    description: 'Obsługa zgłoszeń klientów i reklamacji.',
    impact: 'medium',
    effort: 'low',
    category: 'satellite',
    target: 'Helpdesk',
    owned: false,
    hasApi: true,
  },
  {
    id: 'bi-saas',
    title: 'BI / Reporting SaaS',
    description: 'Dashboardy zarządcze, raportowanie sprzedaży i marż.',
    impact: 'medium',
    effort: 'low',
    category: 'satellite',
    target: 'BI/Reporting',
    owned: false,
    hasApi: false,
  },
  {
    id: 'email-tool',
    title: 'Narzędzie mailingowe',
    description: 'Wysyłki masowe do klientów, poza CRM.',
    impact: 'low',
    effort: 'low',
    category: 'helper',
    target: 'Mailing',
    owned: false,
    hasApi: false,
  },
  {
    id: 'docmgmt',
    title: 'Zarządzanie dokumentami',
    description: 'Repozytorium umów i dokumentów działowych.',
    impact: 'low',
    effort: 'low',
    category: 'helper',
    target: 'DMS dokumentów',
    owned: false,
    hasApi: false,
  },
  {
    id: 'scheduling',
    title: 'Planowanie tras dostaw',
    description: 'Harmonogramowanie tras kierowców i dostaw.',
    impact: 'medium',
    effort: 'low',
    category: 'helper',
    target: 'Planowanie tras',
    owned: false,
    hasApi: false,
  },
  {
    id: 'fleet',
    title: 'Śledzenie floty',
    description: 'GPS i telemetria pojazdów dostawczych.',
    impact: 'low',
    effort: 'low',
    category: 'helper',
    target: 'Flota GPS',
    owned: false,
    hasApi: true,
  },
  {
    id: 'qa-tool',
    title: 'Narzędzie jakości/QA',
    description: 'Rejestr reklamacji jakościowych i kontroli partii.',
    impact: 'low',
    effort: 'low',
    category: 'helper',
    target: 'QA',
    owned: false,
    hasApi: false,
  },
  {
    id: 'procurement',
    title: 'Portal zakupowy',
    description: 'Zamówienia do dostawców, śledzenie dostaw wejściowych.',
    impact: 'medium',
    effort: 'low',
    category: 'helper',
    target: 'Zakupy',
    owned: false,
    hasApi: true,
  },
  {
    id: 'expenses',
    title: 'Rozliczenia wydatków',
    description: 'Delegacje i wydatki pracownicze.',
    impact: 'low',
    effort: 'low',
    category: 'helper',
    target: 'Wydatki',
    owned: false,
    hasApi: false,
  },
  {
    id: 'intranet',
    title: 'Intranet firmowy',
    description: 'Komunikaty wewnętrzne, katalog pracowników.',
    impact: 'low',
    effort: 'low',
    category: 'helper',
    target: 'Intranet',
    owned: false,
    hasApi: false,
  },
];

// ---------------------------------------------------------------------------
// Integrations — 22 mapped connections (§7 Krok 1-2: 17/22 point-to-point, 77%)
// ---------------------------------------------------------------------------

const integrations: IntegrationItem[] = [
  // ERP touches 9 of 22 — de facto unowned hub (§7 Krok 5: bus factor 1,5 osoby)
  {
    id: 'erp-wms',
    title: 'ERP ↔ WMS',
    description: 'Eksport/import pliku płaskiego zleceń i stanów, 2x/dzień.',
    impact: 'high',
    effort: 'medium',
    category: 'file',
    frequency: 'batch',
    from: 'erp',
    to: 'wms',
    pointToPoint: true,
    documented: false,
    critical: true,
    monitored: false,
    mttrHours: 6,
  },
  {
    id: 'erp-accounting',
    title: 'ERP ↔ Księgowość',
    description: 'API własne, częściowo udokumentowane.',
    impact: 'high',
    effort: 'medium',
    category: 'api',
    frequency: 'realtime',
    from: 'erp',
    to: 'accounting',
    pointToPoint: false,
    documented: true,
    critical: true,
    monitored: true,
  },
  {
    id: 'erp-payments',
    title: 'ERP ↔ Płatności',
    description: 'API dostawcy płatności, reużywa istniejący System API.',
    impact: 'medium',
    effort: 'low',
    category: 'api',
    frequency: 'realtime',
    from: 'erp',
    to: 'payments',
    pointToPoint: false,
    documented: true,
    critical: true,
    monitored: true,
    reusesApi: true,
    mttrHours: 1,
  },
  {
    id: 'erp-crm',
    title: 'ERP ↔ CRM',
    description: 'Status zamówienia i dostępność do CRM — jedyna droga, brak alternatywy.',
    impact: 'high',
    effort: 'high',
    category: 'api',
    frequency: 'batch',
    from: 'erp',
    to: 'crm',
    pointToPoint: true,
    documented: false,
    critical: true,
    spof: true,
    monitored: false,
    mttrHours: 8,
  },
  {
    id: 'erp-hr-saas',
    title: 'ERP ↔ HR SaaS',
    description: 'Eksport kosztów pracy do modułu finansowego.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'erp',
    to: 'hr-saas',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'erp-procurement',
    title: 'ERP ↔ Portal zakupowy',
    description: 'Zamówienia do dostawców tworzone na żądanie.',
    impact: 'medium',
    effort: 'medium',
    category: 'api',
    frequency: 'ondemand',
    from: 'erp',
    to: 'procurement',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'erp-expenses',
    title: 'ERP ↔ Rozliczenia wydatków',
    description: 'Eksport rozliczeń do księgi głównej raz dziennie.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'erp',
    to: 'expenses',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'erp-bi-saas',
    title: 'ERP ↔ BI/Reporting',
    description: 'Odczyt bezpośrednio ze współdzielonej bazy ERP.',
    impact: 'medium',
    effort: 'medium',
    category: 'db',
    frequency: 'batch',
    from: 'erp',
    to: 'bi-saas',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'erp-qa-tool',
    title: 'ERP ↔ QA',
    description: 'Eksport partii produkcyjnych do rejestru jakości.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'erp',
    to: 'qa-tool',
    pointToPoint: true,
    documented: false,
  },
  // remaining 13 — not touching ERP
  {
    id: 'crm-marketing-saas',
    title: 'CRM ↔ Marketing Automation',
    description: 'Segmenty i scoring leadów, API dostawcy marketingu.',
    impact: 'medium',
    effort: 'low',
    category: 'api',
    frequency: 'realtime',
    from: 'crm',
    to: 'marketing-saas',
    pointToPoint: true,
    documented: true,
    reusesApi: true,
  },
  {
    id: 'crm-helpdesk-saas',
    title: 'CRM ↔ Helpdesk',
    description: 'Widok historii klienta w zgłoszeniach, routowane centralnie.',
    impact: 'medium',
    effort: 'low',
    category: 'api',
    frequency: 'realtime',
    from: 'crm',
    to: 'helpdesk-saas',
    pointToPoint: false,
    documented: true,
    monitored: true,
    reusesApi: true,
  },
  {
    id: 'crm-email-tool',
    title: 'CRM ↔ Narzędzie mailingowe',
    description: 'Eksport list adresowych do wysyłek masowych.',
    impact: 'low',
    effort: 'low',
    category: 'api',
    frequency: 'batch',
    from: 'crm',
    to: 'email-tool',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'ecommerce-payments',
    title: 'E-commerce ↔ Płatności',
    description: 'Płatności online w sklepie B2B, routowane przez centralną bramkę.',
    impact: 'high',
    effort: 'low',
    category: 'api',
    frequency: 'realtime',
    from: 'ecommerce',
    to: 'payments',
    pointToPoint: false,
    documented: true,
    critical: true,
    monitored: true,
    reusesApi: true,
  },
  {
    id: 'ecommerce-marketing-saas',
    title: 'E-commerce ↔ Marketing Automation',
    description: 'Zdarzenia koszykowe do kampanii remarketingowych.',
    impact: 'low',
    effort: 'low',
    category: 'api',
    frequency: 'batch',
    from: 'ecommerce',
    to: 'marketing-saas',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'ecommerce-helpdesk-saas',
    title: 'E-commerce ↔ Helpdesk',
    description: 'Eksport zamówień do zgłoszeń reklamacyjnych.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'ecommerce',
    to: 'helpdesk-saas',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'wms-fleet',
    title: 'WMS ↔ Śledzenie floty',
    description: 'Status wysyłki i lokalizacja pojazdu w czasie rzeczywistym.',
    impact: 'medium',
    effort: 'low',
    category: 'api',
    frequency: 'realtime',
    from: 'wms',
    to: 'fleet',
    pointToPoint: true,
    documented: true,
  },
  {
    id: 'wms-scheduling',
    title: 'WMS ↔ Planowanie tras',
    description: 'Lista wysyłek dnia eksportowana do planera tras.',
    impact: 'medium',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'wms',
    to: 'scheduling',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'wms-qa-tool',
    title: 'WMS ↔ QA',
    description: 'Partie towaru zablokowane do kontroli jakości.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'wms',
    to: 'qa-tool',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'accounting-expenses',
    title: 'Księgowość ↔ Rozliczenia wydatków',
    description: 'Współdzielona baza rozrachunków pracowniczych.',
    impact: 'low',
    effort: 'low',
    category: 'db',
    frequency: 'batch',
    from: 'accounting',
    to: 'expenses',
    pointToPoint: true,
    documented: true,
  },
  {
    id: 'accounting-payments',
    title: 'Księgowość ↔ Płatności',
    description: 'Rekoncyliacja płatności, routowana przez centralną bramkę.',
    impact: 'medium',
    effort: 'low',
    category: 'api',
    frequency: 'realtime',
    from: 'accounting',
    to: 'payments',
    pointToPoint: false,
    documented: true,
    monitored: true,
    reusesApi: true,
  },
  {
    id: 'hr-saas-intranet',
    title: 'HR SaaS ↔ Intranet',
    description: 'Katalog pracowników synchronizowany plikiem.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'hr-saas',
    to: 'intranet',
    pointToPoint: true,
    documented: false,
  },
  {
    id: 'docmgmt-intranet',
    title: 'Zarządzanie dokumentami ↔ Intranet',
    description: 'Linki do najnowszych dokumentów działowych na intranecie.',
    impact: 'low',
    effort: 'low',
    category: 'file',
    frequency: 'batch',
    from: 'docmgmt',
    to: 'intranet',
    pointToPoint: true,
    documented: false,
  },
];

// ---------------------------------------------------------------------------
// Manual bridges — 2 re-keying bridges (§7 Krok 4)
// ---------------------------------------------------------------------------

const bridges: BridgeItem[] = [
  {
    id: 'bridge-crm-ecommerce',
    title: 'CRM ↔ E-commerce (Excel ręczny)',
    description:
      'Dział sprzedaży raz w tygodniu przepisuje ceny i dostępność z CRM do arkusza importowanego do sklepu B2B — 1 osoba × 3h/tydz. (≈156h/rok), stopa błędu ~8% widoczna w reklamacjach na rozjazd cen/dostępności.',
    impact: 'high',
    effort: 'low',
    category: 'manual',
    frequency: 'manual',
    owner: 'Dział sprzedaży',
    people: 1,
    hoursPerMonth: 13,
    errorRate: 0.08,
    critical: false,
    bothHaveApi: true,
  },
  {
    id: 'bridge-ecommerce-wms',
    title: 'E-commerce ↔ WMS (telefon/Slack)',
    description:
      'Brak integracji dostępności magazynowej — obsługa klienta i magazyn koordynują ręcznie telefonem/Slackiem; 2 osoby × ~2,5h/tydz. łącznie, 5 przypadków nadsprzedaży/kwartał (~15% dotkniętych zamówień), WMS nie ma jeszcze Systemu API.',
    impact: 'high',
    effort: 'medium',
    category: 'manual',
    frequency: 'manual',
    owner: 'Obsługa klienta + magazyn',
    people: 2,
    hoursPerMonth: 5,
    errorRate: 0.15,
    critical: true,
    bothHaveApi: false,
  },
];

// ---------------------------------------------------------------------------
// Candidate moves — 2 per lever, feeding the lever ranking
// ---------------------------------------------------------------------------

const moves: MoveItem[] = [
  {
    id: 'move-inventory-full-map',
    title: 'Dokończ pełny inwentarz integracji (w tym nieoficjalnych)',
    description: 'Wywiady z działami (nie tylko IT) ujawniają integracje nieformalne poza rejestrem IT.',
    impact: 'medium',
    effort: 'low',
    category: 'inventory',
    evidence: ['3 integracje nieudokumentowane, wiedza tylko u 1 osoby'],
  },
  {
    id: 'move-inventory-catalog',
    title: 'Uruchom katalog API i rejestr integracji',
    description: 'Centralny rejestr, żeby zespoły nie budowały integracji od zera zamiast reużyć istniejącej.',
    impact: 'medium',
    effort: 'medium',
    category: 'inventory',
    evidence: ['3 nowe integracje zbudowane od zera mimo istniejącego System API do ERP'],
  },
  {
    id: 'move-topology-erp-owner',
    title: 'Nadaj formalnego właściciela roli hub-integracji ERP',
    description: 'ERP jest hubem 9 integracji bez formalnego właściciela roli integracyjnej — SPOF.',
    impact: 'high',
    effort: 'medium',
    category: 'topology',
    evidence: ['ERP dotyka 9/22 integracji', 'ERP↔CRM: critical + SPOF, MTTR 8h'],
  },
  {
    id: 'move-topology-system-api-wms',
    title: 'Zbuduj System API na WMS',
    description: 'WMS nie ma dziś żadnego API — blokuje izolację ERP i automatyzację mostka z e-commerce.',
    impact: 'high',
    effort: 'high',
    category: 'topology',
    evidence: ['WMS hasApi=false', '5 przypadków nadsprzedaży/kwartał'],
  },
  {
    id: 'move-bridges-automate-crm-ecommerce',
    title: 'Zautomatyzuj mostek CRM↔E-commerce (REST)',
    description: 'Oba systemy mają już API — najszybszy zwrot, dowód wartości programu integracji.',
    impact: 'high',
    effort: 'low',
    category: 'bridges',
    evidence: ['156h/rok, 8% stopa błędu', 'CRM i E-commerce mają gotowe API'],
  },
  {
    id: 'move-bridges-alerting-ecommerce-wms',
    title: 'Alerting + fallback na E-commerce↔WMS do czasu integracji',
    description: 'Blokada sprzedaży przy utracie sygnału dostępności zamiast czekania na zgłoszenie klienta.',
    impact: 'medium',
    effort: 'low',
    category: 'bridges',
    evidence: ['5 przypadków nadsprzedaży/kwartał', 'zero monitoringu dziś'],
  },
  {
    id: 'move-apiled-select-ipaas',
    title: 'Wybierz lekką platformę iPaaS po zamknięciu inwentarza',
    description: 'Start od migracji integracji ERP-centric o najwyższym zwrocie, nie big-bang.',
    impact: 'high',
    effort: 'high',
    category: 'apiled',
    evidence: ['77% integracji point-to-point', '2 nowe systemy planowane w przyszłym roku'],
  },
  {
    id: 'move-apiled-system-process-experience',
    title: 'Wprowadź warstwę System→Process→Experience API na order→invoice',
    description: 'Zacznij od 10-15% integracji o najwyższej wartości, nie od "zintegrujmy wszystko".',
    impact: 'medium',
    effort: 'high',
    category: 'apiled',
    evidence: ['28% systemów realnie zintegrowanych vs benchmark MuleSoft ~28%'],
  },
];

// ---------------------------------------------------------------------------
// Recommended initiatives (summary) — mirrors §7 "Insighty → inicjatywy"
// ---------------------------------------------------------------------------

const recommendedInitiatives: InitiativeDraft[] = [
  {
    id: 'init-ecommerce-wms-api',
    title: 'Zbuduj System+Experience API dla dostępności magazynowej (E-commerce↔WMS)',
    description:
      'Buduj System API na WMS (nie istnieje) + Experience API dla e-commerce, eliminując koordynację telefon/Slack.',
    type: 'operational',
    source: 'integration-diagnostic',
    linkedItems: ['bridge-ecommerce-wms', 'wms'],
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    rationale:
      'Brak integracji dostępności magazynowej powoduje nadsprzedaż — 5 przypadków/kwartał, koszt obsługi + reputacja. Priorytet #1, bo dotyka bezpośrednio klienta końcowego. Kosztem budowy Systemu API na WMS od zera; odrzucamy dalsze poleganie na telefonie/Slacku, bo koszt zaniechania (reklamacje, nadsprzedaż) rośnie z wolumenem.',
  },
  {
    id: 'init-crm-ecommerce-rest',
    title: 'Zautomatyzuj mostek CRM↔E-commerce (REST, quick win)',
    description: 'Zastąp cotygodniowy ręczny Excel integracją REST — oba systemy mają już gotowe API.',
    type: 'operational',
    source: 'integration-diagnostic',
    linkedItems: ['bridge-crm-ecommerce'],
    estimatedImpact: 'high',
    estimatedEffort: 'low',
    rationale:
      'Ręczny Excel raz/tydzień, 8% stopa błędu w cenach/dostępności → przy regule 1-10-100 koszt korekt/reklamacji przewyższa koszt integracji REST. Kosztem krótkiego sprintu wdrożeniowego; odrzucamy "róbmy dalej ręcznie, bo działa" — rekeying to nie tylko koszt FTE, ale źródło błędów drogich w raporcie zarządczym.',
  },
  {
    id: 'init-erp-hub-owner',
    title: 'Zabezpiecz ERP jako hub: właściciel roli + warstwa System API',
    description: 'Formalny właściciel integracyjnej roli ERP oraz warstwa izolująca przed kaskadową awarią.',
    type: 'strategic',
    source: 'integration-diagnostic',
    linkedItems: ['erp', 'erp-crm'],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    rationale:
      'ERP jako nieformalny hub 9 integracji, bez formalnego właściciela roli integracyjnej — każda zmiana w ERP ryzykuje kaskadową awarię. Warunek wstępny dla bezpiecznego wdrożenia jakiegokolwiek nowego systemu w przyszłości; kosztem pracy nad izolującą warstwą bez nowej funkcji biznesowej wprost.',
  },
  {
    id: 'init-ipaas-selection',
    title: 'Wybór lekkiej platformy iPaaS i migracja integracji ERP-centric',
    description: 'Start od migracji 3 najbardziej krytycznych integracji dotykających ERP.',
    type: 'strategic',
    source: 'integration-diagnostic',
    linkedItems: ['erp-wms', 'erp-crm', 'erp-bi-saas'],
    estimatedImpact: 'medium',
    estimatedEffort: 'high',
    rationale:
      '77% integracji to point-to-point, dojrzałość 1-2 wg Gartner — przy 2 planowanych nowych systemach koszt utrzymania integracji wzrośnie nieproporcjonalnie. Kosztem czasu na wybór i wdrożenie platformy; odrzucamy migrację wszystkiego naraz (big-bang), bo multiplikuje ryzyko.',
  },
  {
    id: 'init-document-critical-integrations',
    title: 'Udokumentuj 3 krytyczne integracje znane tylko jednej osobie',
    description: 'Zerokosztowe zabezpieczenie wiedzy operacyjnej w tym kwartale.',
    type: 'operational',
    source: 'integration-diagnostic',
    linkedItems: ['erp-wms', 'erp-crm', 'erp-hr-saas'],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    rationale:
      '3 integracje nieudokumentowane, wiedza tylko u 1 osoby każda — ryzyko operacyjne niezależne od budżetu na nowe projekty. Kosztem czasu przeglądu i spisania; odrzucamy odłożenie tego do czasu większego programu integracyjnego, bo ryzyko bus-factor jest natychmiastowe.',
  },
];

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const INTEGRATION_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal:
      'Zdiagnozować dojrzałość integracji systemów firmy dystrybucyjnej i wskazać, gdzie inwestycja w integrację zwraca się najszybciej przed rozbudową o nowe kanały.',
    scope:
      'Cała mapa systemów (18 aktywnych: ERP, WMS, e-commerce B2B, CRM, księgowość, płatności, 4 SaaS działowe, 8 narzędzi pomocniczych) i 22 zmapowane integracje + 2 ręczne mostki.',
    timeframe: 'medium',
    successSignal:
      'Zredukowany udział point-to-point, zautomatyzowany najdroższy ręczny mostek, formalny właściciel roli hub-ERP.',
    assumptions: 'Budżet IT nie rośnie skokowo; dział IT pozostaje na poziomie 6 osób w horyzoncie diagnozy.',
    constraints: 'Brak budżetu na big-bang migrację; priorytet quick winów i integracji na krytycznym przepływie zamówienie→faktura.',
    understanding:
      'Firma dystrybucyjna, ~120 mln PLN przychodu rocznie, 18 aktywnych systemów, dział IT = 6 osób; presja: rosnąca liczba systemów SaaS bez planu integracji i widoczne silosy danych (sprzedaż nie widzi dostępności magazynowej).',
  }),
  sections: {
    systems,
    integrations,
    bridges,
    moves,
  },
  summary: {
    keyInsights: [
      'ERP jest hubem dla 9 z 22 integracji bez formalnego właściciela roli integracyjnej — pojedynczy punkt awarii bez planu ciągłości, pilny niezależnie od historii awarii.',
      'Ręczny mostek CRM↔E-commerce kosztuje ~156h/rok (0,08 FTE) i 8% stopę błędu w cenach/dostępności — oba systemy mają już API, automatyzacja zwraca się najszybciej.',
      'Brak integracji dostępności magazynowej (E-commerce↔WMS) daje 5 przypadków nadsprzedaży/kwartał — priorytet #1, bo dotyka bezpośrednio klienta końcowego.',
      '77% zmapowanych integracji to bezpośrednie połączenia point-to-point przy dojrzałości 1-2/5 (Gartner) — koszt utrzymania rośnie kwadratowo wraz z każdym nowym systemem.',
    ],
    executiveSummary:
      'Diagnostyka ujawnia klasyczny wzorzec firmy na poziomie dojrzałości Ad hoc/Enlightened: spaghetti point-to-point wokół nieformalnego huba ERP, dwa udowodnione ręczne mostki i zero warstwy izolującej. Sekwencja: quick win na mostkach → zabezpieczenie huba → wybór platformy dopiero po inwentarzu.',
      appliedConclusions: [
        'Zacznij od automatyzacji mostka CRM↔E-commerce (oba systemy mają API) i zabezpieczenia ERP jako hubu.',
        'Nie kupuj platformy iPaaS/ESB przed zamknięciem inwentarza integracji nieoficjalnych.',
        'Zweryfikuj plan 2 nowych systemów w przyszłym roku pod kątem wpływu na wzrost point-to-point.',
      ],
    verdict:
      'Firma nie potrzebuje "zintegrować wszystko" — potrzebuje zabezpieczyć nieformalny hub ERP i zamknąć dwa udowodnione ręczne mostki, zanim rozważy platformę integracyjną.',
    tradeoffs: [
      {
        chosen: 'Automatyzacja mostka CRM↔E-commerce jako pierwszy krok',
        rejected: 'Migracja wszystkich integracji na nową platformę naraz (big-bang)',
        why: 'Quick win z gotowym API po obu stronach dowodzi wartości programu bez multiplikacji ryzyka wdrożeniowego.',
      },
    ],
    expectedEffect: {
      text: '~276 h/rok FTE odzyskane z re-keyingu, redukcja nadsprzedaży e-commerce, usunięcie pojedynczego punktu awarii bez właściciela.',
      horizon: '2-3 kwartały',
    },
    recommendedInitiatives,
  },
};

/**
 * Dev-render: AUDYTY → RAPORTY DRD.
 *
 * ★ NAPRAWA PRZEWODU ODBIORU (2026-09-03). Wariant `list` (domyślny — ten,
 * który właściciel oglądał 2026-09-02) montował
 * `src/components/Audit/AuditsHub.tsx`, a ten komponent NIE JEST ZAMONTOWANY
 * NIGDZIE w produkcie. Mówi to wprost kod samego modułu,
 * `src/components/Audit/method/AuditsMethodHub.tsx:10`:
 *   „Dawny równoległy `AuditsHub` nad `/api/audit` nie jest już mounted;
 *    jego write endpoints pozostają wycofane po stronie serwera."
 * `git grep -w AuditsHub -- src/` poza definicją zwraca wyłącznie testy.
 * Audyt: `docs/program/waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`,
 * wiersz `audyty-drd-report` — „ROZJAZD".
 *
 * Realny moduł Audyty to `AuditsMethodHub` pod `/audit-programs`
 * (`src/routes/AppRoutes.tsx:1678-1686`), a jego zakładka „Raporty"
 * (`AuditsMethodHub.tsx:530` → `AuditReportsTab`) to realne zestawienie
 * raportów audytowych — dokładnie to, co ekran ma pokazywać.
 *
 * Dwa warianty (`&variant=`):
 *   list (domyślny) — REALNY `AuditsMethodHub` z wymuszonym `?tab=reports`.
 *     Mocki `/audits/**` pochodzą z `./audyty-piec-powierzchni` (ten sam,
 *     realny hub, ten sam kontrakt `auditsMethodApi.ts`) — import tego modułu
 *     instaluje je na poziomie modułu; nie duplikujemy 1200 linii atrap.
 *   report — REALNY `DRDAuditReportView`, czyli komponent, który montuje
 *     realna trasa `/audit-programs/drd-report/:reportId`
 *     (`DRDAuditReportRoute`, `src/routes/AppRoutes.tsx:801-806`) po przejściu
 *     bramki `isDrdReportEnabled()` (domyślnie OFF → przekierowanie na
 *     `/audit-programs`). Harness ustawia `localStorage['ff.drdReport']='1'`,
 *     czyli DOKŁADNIE ten sam przełącznik, którego używa bramka — nie omija
 *     jej, tylko ją włącza.
 *
 * URL: ?screen=audyty-drd-report[&variant=list|report][&theme=light|dark]
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { DRDAuditReportView } from '../../src/views/DRDAuditReportView';
import { seedRealisticSession } from '../mocks/seedStore';
// Import instaluje na poziomie modułu komplet atrap `/audits/**` dla REALNEGO
// `AuditsMethodHub` (patrz nagłówek tamtego pliku) i eksportuje ten hub w
// realnym `AppProviders`.
import AudytyPiecPowierzchniScreen from './audyty-piec-powierzchni';

seedRealisticSession();
try {
  window.localStorage.setItem('ff.drdReport', '1');
} catch {
  /* ignore — private mode / storage disabled */
}

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'list';

if (variant !== 'report') {
  const p = new URLSearchParams(window.location.search);
  p.set('tab', 'reports');
  window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
}

const AUDIT_PROGRAMS = [
  {
    id: 'audit-prog-elkomtech-iso',
    organizationId: 'org-dbr77-demo',
    name: 'Przegląd gotowości bezpieczeństwa informacji — Elkomtech',
    description: 'Wywiady przed przeglądem zarządczym, 4 obszary kontrolne.',
    objective: 'Potwierdzić gotowość organizacji do wewnętrznego przeglądu bezpieczeństwa informacji w Q4 2026.',
    status: 'active',
    preset: 'new-company',
    config: {
      templateIds: ['tmpl-secreview-a5', 'tmpl-secreview-a9'],
      assigneeIds: ['user-anna', 'user-marek'],
      surveysGenerated: true,
      generation: { requested: 8, created: 8, failed: 0, at: '2026-07-18T10:00:00Z' },
    },
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-05T09:00:00Z',
    updatedAt: '2026-07-18T10:00:00Z',
  },
  {
    id: 'audit-prog-nordfarm-drd',
    organizationId: 'org-dbr77-demo',
    name: 'Audyt DRD — NordFarm',
    description: null,
    objective: 'Zebrać dane wejściowe do raportu dojrzałości cyfrowej NordFarm.',
    status: 'draft',
    preset: null,
    config: { templateIds: ['tmpl-drd-core'], assigneeIds: [], surveysGenerated: false },
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-22T14:00:00Z',
  },
];

const DRD_REPORTS = [
  {
    id: 'rep-drd-elkomtech-2026',
    name: 'Audyt DRD — Elkomtech 2026',
    assessmentName: 'Elkomtech — Audyt DRD 2026',
    status: 'FINAL',
    updatedAt: '2026-07-21T15:40:00Z',
  },
  {
    id: 'rep-drd-nordfarm-q2-2026',
    name: 'Audyt DRD — NordFarm, Q2 2026',
    assessmentName: 'NordFarm — ocena dojrzałości cyfrowej',
    status: 'DRAFT',
    updatedAt: '2026-07-15T09:15:00Z',
  },
  {
    id: 'rep-drd-bielmar-2025-update',
    name: 'Audyt DRD — Bielmar, aktualizacja roczna',
    assessmentName: 'Bielmar — przegląd roczny dojrzałości cyfrowej',
    status: 'FINAL',
    updatedAt: '2026-06-02T08:00:00Z',
  },
];

const FULL_REPORT = {
  id: 'rep-drd-elkomtech-2026',
  name: 'Audyt DRD — Elkomtech 2026',
  status: 'DRAFT' as const,
  assessmentId: 'assess-elkomtech-drd-2026',
  assessmentName: 'Elkomtech — Audyt DRD 2026',
  projectName: 'Elkomtech — transformacja cyfrowa',
  organizationName: 'Elkomtech Sp. z o.o.',
  axisData: {
    strategy: {
      actual: 2.4,
      target: 4.0,
      justification: 'Strategia cyfrowa nieformalna, brak mierzalnych KPI.',
    },
    process: {
      actual: 3.1,
      target: 4.0,
      justification: 'Część procesów zautomatyzowana (ERP), integracje ręczne.',
    },
    data: {
      actual: 2.0,
      target: 3.5,
      justification: 'Dane rozproszone w 5 systemach, brak jednego źródła prawdy.',
    },
    technology: {
      actual: 3.4,
      target: 4.5,
      justification: 'Infrastruktura chmurowa wdrożona, legacy w produkcji.',
    },
    people: {
      actual: 2.7,
      target: 4.0,
      justification: 'Kompetencje cyfrowe skoncentrowane w jednym zespole.',
    },
    customer: {
      actual: 3.0,
      target: 4.0,
      justification: 'Portal klienta działa, brak personalizacji.',
    },
    governance: {
      actual: 2.2,
      target: 3.5,
      justification: 'Brak formalnego komitetu sterującego IT.',
    },
  },
  sections: [
    {
      id: 'sec-exec-summary',
      reportId: 'rep-drd-elkomtech-2026',
      sectionType: 'executive_summary',
      title: 'Streszczenie zarządcze',
      content:
        'Elkomtech osiąga dziś średni wynik dojrzałości cyfrowej 2,7/5 wobec celu 4,0/5 wyznaczonego na koniec 2027. ' +
        'Największa luka dotyczy governance i danych — brak jednego źródła prawdy podnosi ryzyko błędnych decyzji ' +
        'operacyjnych. Rekomendujemy rozpoczęcie od konsolidacji danych i powołania komitetu sterującego IT, zanim ' +
        'firma zainwestuje w kolejne narzędzia automatyzacji.',
      dataSnapshot: {},
      orderIndex: 0,
      isAiGenerated: true,
      version: 2,
      updatedAt: '2026-07-21T15:40:00Z',
    },
    {
      id: 'sec-axis-scores',
      reportId: 'rep-drd-elkomtech-2026',
      sectionType: 'axis_scores',
      title: 'Wynik na 7 osiach dojrzałości',
      content:
        'Najsilniejsza oś to technologia (3,4/5) dzięki wdrożonej infrastrukturze chmurowej. Najsłabsze osie to ' +
        'governance (2,2/5) i dane (2,0/5) — obie wymagają decyzji organizacyjnych, nie tylko technologii.',
      dataSnapshot: {},
      orderIndex: 1,
      isAiGenerated: true,
      version: 1,
      updatedAt: '2026-07-20T11:00:00Z',
    },
    {
      id: 'sec-recommendations',
      reportId: 'rep-drd-elkomtech-2026',
      sectionType: 'recommendations',
      title: 'Rekomendacje i plan 90 dni',
      content:
        '1) Powołać komitet sterujący IT (miesiąc 1). 2) Zaprojektować jedno źródło prawdy dla danych klienckich ' +
        '(miesiące 1-2). 3) Zdefiniować 3 mierzalne KPI strategii cyfrowej i właścicieli (miesiąc 2). ' +
        '4) Pilotaż integracji ERP-CRM na jednym segmencie klientów (miesiąc 3).',
      dataSnapshot: {},
      orderIndex: 2,
      isAiGenerated: false,
      version: 3,
      updatedAt: '2026-07-21T09:30:00Z',
    },
  ],
  templateId: 'tpl-canon-drd-standard-elkomtech',
  createdAt: '2026-07-05T09:00:00Z',
  updatedAt: '2026-07-21T15:40:00Z',
};

function jsonEnvelope<T>(data: T): { data: T } {
  return { data };
}

const g = window as unknown as { __AUDYTY_DRD_FETCH__?: boolean };
const tenEkran = params.get('screen') === 'audyty-drd-report';
if (tenEkran && !g.__AUDYTY_DRD_FETCH__) {
  g.__AUDYTY_DRD_FETCH__ = true;

  Api.getAssessmentReports = (async () => DRD_REPORTS) as typeof Api.getAssessmentReports;
  Api.getFullReport = (async () => FULL_REPORT) as typeof Api.getFullReport;

  const realGet = Api.get.bind(Api);
  Api.get = (async (url: string) => {
    if (String(url).startsWith('/audit/programs')) {
      return jsonEnvelope({
        programs: AUDIT_PROGRAMS,
        total: AUDIT_PROGRAMS.length,
        limit: AUDIT_PROGRAMS.length,
        offset: 0,
      });
    }
    return realGet(url);
  }) as typeof Api.get;

  // Safety net for anything else the hub / heavy providers fire on mount.
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AudytyDrdReportScreen(): React.ReactElement {
  if (variant === 'report') {
    return (
      <AppProviders>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
          <DRDAuditReportView reportId={FULL_REPORT.id} />
        </div>
      </AppProviders>
    );
  }

  // Wariant listowy: REALNY `AuditsMethodHub` (z `audyty-piec-powierzchni`)
  // z wymuszoną zakładką „Raporty". `?tab=` czyta `useSearchParams` w hubie
  // przy renderze, więc wystarczy dopisać je do adresu przed montowaniem.
  return <AudytyPiecPowierzchniScreen />;
}

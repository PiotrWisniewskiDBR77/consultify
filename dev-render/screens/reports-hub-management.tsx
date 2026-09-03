/**
 * dev-render host dla `reports-hub-management` — REALNY `<ReportsHub>`
 * (src/components/Reports/Management/ReportsHub.tsx), moduł raportów
 * zarządczych PMO (Team Meeting / Team Weekly / Steering Committee /
 * Portfolio Health / RAID). Wzorzec 1:1 z `inicjatywy-lista.tsx` (montujemy
 * REALNY komponent produktu w `<AppProviders>`, zero re-implementacji;
 * `AppProviders` sam owija `<BrowserRouter>`, więc `useSearchParams` w
 * `ReportsHub` działa bez dodatkowego routera).
 *
 * PIERWSZY W HISTORII wpis harnessu dla tego ekranu (dyżur 2026-09-03,
 * pomiar "dziewięć ekranów bez wpisu"). Trasa produkcyjna:
 * `/reports/management` (ROUTES.REPORTS.MANAGEMENT, routeConfig.ts:125),
 * montowana leniwie jako `<ManagementReportsHub>` w AppRoutes.tsx (import
 * `Reports/Management/ReportsHub` → `.ReportsHub`). Wcześniejsza wzmianka
 * "ReportsHub" w `dev-render/screens/report-artifact.tsx:14` to WYŁĄCZNIE
 * komentarz ("na poziomie hosta ReportsHub/ExecutionHub") — nie montuje
 * realnego komponentu.
 *
 * Trzy wywołania ładujące dane przy mount (`loadData`, linie 172-193):
 *   - `Api.get('/api/management-reports/history?limit=50')`
 *   - `Api.get('/api/management-reports/templates')`
 *   - `Api.get('/api/management-reports/schedules')`
 * Wszystkie trzy oczekują koperty axios-like `{ data: { reports|templates|
 * schedules: [...] } }` (`reportsRes.data?.reports || []` itd.) — mockujemy
 * `Api.get` bezpośrednio (ten sam wzorzec podmiany metody na singletonie co
 * `karta-task.tsx`/`mywork-decisions.tsx`), rozróżniając URL po substringu,
 * NIE jednym uniwersalnym kształtem (pułapka zmierzona w `teresa-chipy
 * -sugestii` — brakujące pole wywala ErrorBoundary).
 *
 * Sześć raportów historycznych pokrywających wszystkie pięć typów
 * (`ManagementReportType`) i wszystkie cztery statusy, z uniwersum demo
 * Grupa Termika/NordFarm/Bielmar/Kolej Wschodnia — ciągłość z
 * `mywork-decisions.tsx`/`mywork-tasks.tsx`. Dwa szablony i jeden aktywny
 * harmonogram, żeby zakładki "Reports"/"Automation" (jeśli klikane ręcznie)
 * też miały realne dane, nie pustkę.
 *
 * URL: ?screen=reports-hub-management[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { ReportsHub } from '../../src/components/Reports/Management/ReportsHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const hoursFromNow = (h: number) => new Date(now + h * 3_600_000).toISOString();

const REPORTS_HISTORY = [
  {
    id: 'report-termika-steering-sierpien',
    title: 'Steering Committee — Grupa Termika, sierpień 2026',
    reportType: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    status: 'FINAL',
    generatedBy: 'user-piotr-demo',
    generatedByName: 'Piotr Wiśniewski',
    projectName: 'Grupa Termika Q3',
    createdAt: daysAgo(3),
    periodStart: daysAgo(33),
    periodEnd: daysAgo(3),
    pdfPath: '/mock/reports/termika-steering-sierpien.pdf',
    versionNumber: 2,
    versionLabel: '2',
  },
  {
    id: 'report-portfolio-health-q3',
    title: 'Portfolio Health — przegląd Q3 2026',
    reportType: 'PORTFOLIO_HEALTH',
    scope: 'PORTFOLIO',
    status: 'APPROVED',
    generatedBy: 'user-piotr-demo',
    generatedByName: 'Piotr Wiśniewski',
    createdAt: daysAgo(8),
    periodStart: daysAgo(98),
    periodEnd: daysAgo(8),
    pdfPath: '/mock/reports/portfolio-health-q3.pdf',
    pptxPath: '/mock/reports/portfolio-health-q3.pptx',
    versionNumber: 1,
    versionLabel: '1',
  },
  {
    id: 'report-nordfarm-team-meeting',
    title: 'Team Meeting — HurtNord Logistyka, tydzień 35',
    reportType: 'TEAM_MEETING',
    scope: 'PROJECT',
    status: 'DRAFT',
    generatedBy: 'user-marek-demo',
    generatedByName: 'Marek Zieliński',
    projectName: 'HurtNord Logistyka — Onboarding',
    createdAt: daysAgo(1),
    periodStart: daysAgo(7),
    periodEnd: daysAgo(1),
  },
  {
    id: 'report-bielmar-raid',
    title: 'RAID Log — Bielmar, wrzesień 2026',
    reportType: 'RAID',
    scope: 'PROJECT',
    status: 'FINAL',
    generatedBy: 'user-anna-demo',
    generatedByName: 'Anna Kowalska',
    projectName: 'Bielmar',
    createdAt: daysAgo(5),
    periodStart: daysAgo(35),
    periodEnd: daysAgo(5),
    pdfPath: '/mock/reports/bielmar-raid-wrzesien.pdf',
    versionNumber: 1,
    versionLabel: '1',
  },
  {
    id: 'report-kolej-wschodnia-weekly',
    title: 'Team Weekly — Kolej Wschodnia, tydzień 34',
    reportType: 'TEAM_WEEKLY',
    scope: 'PROJECT',
    status: 'ARCHIVED',
    generatedBy: 'user-kasia-demo',
    generatedByName: 'Kasia Nowak',
    projectName: 'Kolej Wschodnia — Modernizacja',
    createdAt: daysAgo(14),
    periodStart: daysAgo(21),
    periodEnd: daysAgo(14),
    pdfPath: '/mock/reports/kolej-wschodnia-weekly-34.pdf',
    versionNumber: 1,
    versionLabel: '1',
  },
  {
    id: 'report-termika-steering-wrzesien',
    title: 'Steering Committee — Grupa Termika, wrzesień 2026',
    reportType: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    status: 'DRAFT',
    generatedBy: 'user-piotr-demo',
    generatedByName: 'Piotr Wiśniewski',
    projectName: 'Grupa Termika Q3',
    createdAt: daysAgo(0),
    periodStart: daysAgo(30),
    periodEnd: daysAgo(0),
  },
];

const REPORT_TEMPLATES = [
  {
    id: 'template-steering-standard',
    name: 'Steering Committee — standard',
    description: 'Status projektu, ryzyka, decyzje do podjęcia, budżet.',
    reportType: 'STEERING_COMMITTEE',
    sections: ['status', 'risks', 'decisions', 'budget'],
    createdAt: daysAgo(60),
    createdByName: 'Piotr Wiśniewski',
  },
  {
    id: 'template-portfolio-health-standard',
    name: 'Portfolio Health — kwartalny',
    description: 'Zdrowie portfela projektów, trendy, alokacja zasobów.',
    reportType: 'PORTFOLIO_HEALTH',
    sections: ['overview', 'trends', 'resourcing'],
    createdAt: daysAgo(90),
    createdByName: 'Piotr Wiśniewski',
  },
];

const REPORT_SCHEDULES = [
  {
    id: 'schedule-termika-steering-monthly',
    reportType: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    projectId: 'proj-termika-q3',
    projectName: 'Grupa Termika Q3',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    timeOfDay: '08:00',
    timezone: 'Europe/Warsaw',
    isActive: true,
    nextScheduledAt: hoursFromNow(240),
    recipients: ['piotr@dbr77.com', 'zarzad@grupa-termika.pl'],
  },
];

Api.get = (async (url: string) => {
  if (url.includes('/api/management-reports/history')) {
    return { data: { reports: REPORTS_HISTORY } };
  }
  if (url.includes('/api/management-reports/templates')) {
    return { data: { templates: REPORT_TEMPLATES } };
  }
  if (url.includes('/api/management-reports/schedules')) {
    return { data: { schedules: REPORT_SCHEDULES } };
  }
  return { data: [], items: [] };
}) as typeof Api.get;

// Siatka bezpieczeństwa: cokolwiek jeszcze komponent odpali przy montowaniu
// (np. lista userów do przypisania, org context) dostaje neutralny payload
// zamiast uderzać w nieobecny backend dev-render — wzorzec z
// inicjatywy-lista.tsx/mywork-inbox.tsx. Router instalujemy TYLKO gdy TEN
// ekran jest wybrany (main.tsx importuje wszystkie ekrany naraz).
const g = window as unknown as { __REPORTS_HUB_FETCH__?: boolean };
const __tenEkran =
  new URLSearchParams(window.location.search).get('screen') === 'reports-hub-management';
if (__tenEkran && !g.__REPORTS_HUB_FETCH__) {
  g.__REPORTS_HUB_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/my-work/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function ReportsHubManagementScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ReportsHub />
      </div>
    </AppProviders>
  );
}

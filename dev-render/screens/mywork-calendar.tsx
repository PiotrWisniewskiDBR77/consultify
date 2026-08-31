/**
 * dev-render host dla `mywork-calendar` — REALNY `<MyWorkHub>` na zakładce
 * `calendar`, bazowy widok, normalny (desktop) viewport.
 *
 * Zero re-implementacji: renderujemy PRAWDZIWY `<MyWorkHub>` (wzorzec
 * `mywork-idea-topbar.tsx`) i przełączamy jedyny `BrowserRouter` z
 * `AppProviders` na trasę `/my-work/calendar` — `parseMyWorkPathIntent()`
 * (MyWorkHub.tsx:606-694) czyta `location.pathname` bezpośrednio, więc
 * `setActiveTab('calendar')` odpala się bez dodatkowego routingu.
 *
 * Który komponent renderuje zakładka: `MyWorkHub.tsx:4016-4038` —
 * `isMyWorkCalendarV2Enabled()` (domyślnie OFF, `src/utils/myWorkCalendarV2Flag.ts`)
 * przełącza między `<CalendarV2>` i `<CalendarView>`. Bez parametru w adresie
 * flaga jest OFF → to jest ekran BAZOWY zgodnie z zamówieniem dyżuru:
 * `<CalendarView>` (`src/components/MyWork/Calendar/CalendarView.tsx`).
 *
 * Wywołania API przy mount (zweryfikowane w źródle, nie zgadywane):
 *   - `useCalendarData` (Calendar/useCalendarData.ts:48) → `Api.getMyWorkCalendarUnified(...)`
 *     — JEDYNE źródło wydarzeń siatki. Puste `{events:[]}` = pusty kalendarz.
 *   - `CalendarView.tsx:250` → `Api.getIntegrations()` (status Google/Outlook w pasku bocznym)
 *   - `CalendarView.tsx:325` → `Api.getMyWorkCalendarConflicts(dateKey)` (panel obciążenia dnia)
 *   - `CalendarView.tsx:395` → `Api.updateMyWorkCalendarEvent(payload)` (drag/edycja — no-op wystarczy)
 * Wzorzec mocków 1:1 z `dev-render/screens/mw-007-calendar-narrow-viewport.tsx`
 * (ten sam komponent, tam pod kątem wąskiego viewportu) — tu normalny desktop
 * (1440×900, jak reszta toru grafiki) i bogatszy zestaw wydarzeń.
 *
 * ZGŁOSZENIE (znalezione przy budowie tego ekranu, nie naprawiane tutaj):
 * `getInitialMyWorkTab()` (MyWorkHub.tsx:586-604) wyznacza pierwszą zakładkę
 * WYŁĄCZNIE z `searchParams` (`?tab=vault|agent` / `?taskId=` itp.) — nigdy z
 * `location.pathname`. Dopiero OSOBNY efekt (MyWorkHub.tsx:1658-1703) czyta
 * `parseMyWorkPathIntent(location.pathname,...)` i koryguje zakładkę. Efekt
 * uboczny: świeże wejście na `/my-work/calendar` (albo dowolną nie-domyślną
 * zakładkę) montuje na chwilę `<InboxContent>` (domyślny fallback 'inbox'),
 * który odpala własny fetch Skrzynki, ZANIM druga zakładka przejmie ekran —
 * zmarnowane wywołanie sieciowe przy KAŻDYM deep-linku spoza Skrzynki. W tym
 * harnessie ten przelotowy montaż Inbox wyłapywał `V8MyWorkApi.getCanonicalInboxTable`
 * niezamockowane w TYM pliku → siatka bezpieczeństwa fetch zwracała kopertę
 * `{data:[],items:[]}`, `tableRes.items` nie było tablicą i `fetchInbox()`
 * kończył się `toast.error('Nie udało się załadować Inbox')` WIDOCZNYM na
 * zrzucie zakładki Kalendarz. Mockujemy więc też (poniżej) `getCanonicalInboxTable`/
 * `getCanonicalInboxStats` pustą, ale POPRAWNIE ukształtowaną odpowiedzią —
 * tak zachowałby się realny backend z pustą skrzynką, bez błędu.
 *
 * URL: ?screen=mywork-calendar[&lang=pl|en][&theme=light|dark]
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { V8MyWorkApi } from '../../src/services/api/v8/my-work';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Patrz komentarz "ZGŁOSZENIE" wyżej — łagodzi przelotowy montaż InboxContent
// przy starcie na tej zakładce, żeby nie sypał toastem błędu na zrzucie.
V8MyWorkApi.getCanonicalInboxTable = (async () => ({
  items: [],
})) as typeof V8MyWorkApi.getCanonicalInboxTable;
V8MyWorkApi.getCanonicalInboxStats = (async () => ({
  total: 0,
  byPriority: {},
  bySection: {},
  byStatus: {},
  bySlaStatus: {},
})) as typeof V8MyWorkApi.getCanonicalInboxStats;
V8MyWorkApi.materializeCanonicalInbox = (async () => ({
  success: true,
  upserted: 0,
})) as typeof V8MyWorkApi.materializeCanonicalInbox;

const TODAY = new Date();
const atDay = (offsetDays: number, hour = 0, minute = 0) => {
  const d = new Date(TODAY);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const isoDateTime = (d: Date) => d.toISOString();

/**
 * Sześć wydarzeń różnych typów w tym samym uniwersum demo co karta-task/
 * mywork-inbox (klienci Grupa Termika/NordFarm/Bielmar, inicjatywa DRD) —
 * rozłożone wokół "dziś", żeby były widoczne w domyślnym widoku miesiąca
 * niezależnie od dnia uruchomienia zrzutu.
 */
(Api as any).getMyWorkCalendarUnified = async () => ({
  events: [
    {
      id: 'evt-task-mapa-asis',
      title: 'Termin: mapa AS-IS raportowania (DRD)',
      start: isoDate(atDay(-1)),
      allDay: true,
      source: 'task',
      sourceId: 'task-dbr77-demo-1',
      projectId: 'proj-drd-raporty',
      projectName: 'DRD Automatyzacja Raportów',
      status: 'in_progress',
      priority: 'high',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-decision-narzedzie-drd',
      title: 'Decyzja: podejście do automatyzacji raportów DRD',
      start: isoDate(atDay(0)),
      allDay: true,
      source: 'decision',
      sourceId: 'decision-dbr77-demo-1',
      projectName: 'DRD Automatyzacja Raportów',
      status: 'pending',
      priority: 'critical',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-meeting-warsztat-zarzad',
      title: 'Warsztat z zarządem — mapa AS-IS',
      start: isoDateTime(atDay(2, 10, 0)),
      end: isoDateTime(atDay(2, 12, 0)),
      allDay: false,
      source: 'consultify',
      sourceId: 'meeting-warsztat-drd',
      projectName: 'DRD Automatyzacja Raportów',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-google-telefon-nordfarm',
      title: 'Telefon z klientem — NordFarm',
      start: isoDateTime(atDay(1, 14, 30)),
      end: isoDateTime(atDay(1, 15, 0)),
      allDay: false,
      source: 'google',
      sourceId: 'gcal-nordfarm-call',
      projectName: 'NordFarm — wdrożenie',
      provider: 'google',
      editAuthority: 'remote_owner',
      syncState: 'in_sync',
    },
    {
      id: 'evt-initiative-kamien-milowy',
      title: 'Kamień milowy: Faza 1 — Automatyzacja raportowania',
      start: isoDate(atDay(4)),
      allDay: true,
      source: 'initiative',
      sourceId: 'init-drd-automatyzacja',
      projectName: 'DRD Automatyzacja Raportów',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-task-akcept-raport-termika',
      title: 'Akceptacja raportu końcowego — Grupa Termika Q3',
      start: isoDate(atDay(-3)),
      allDay: true,
      source: 'task',
      sourceId: 'task-dbr77-demo-akcept-raportu',
      projectName: 'Grupa Termika — raport Q3',
      status: 'blocked',
      priority: 'high',
      provider: 'internal',
      editAuthority: 'local_only',
    },
  ],
});

(Api as any).getIntegrations = async () => [
  { provider: 'google', status: 'connected', onboarding_status: null },
];

(Api as any).getMyWorkCalendarConflicts = async (dateKey: string) => ({
  totalItems: dateKey === isoDate(atDay(2)) ? 2 : 1,
  hasConflicts: false,
  tasks: [{ id: 'task-dbr77-demo-1', title: 'Termin: mapa AS-IS raportowania (DRD)' }],
  decisions: [
    { id: 'decision-dbr77-demo-1', title: 'Decyzja: podejście do automatyzacji raportów DRD' },
  ],
  suggestion: null,
});

(Api as any).updateMyWorkCalendarEvent = async () => ({ ok: true });

// Siatka bezpieczeństwa: cokolwiek jeszcze hub odpali przy montowaniu
// (presence, powiadomienia, sugestie AI…) dostaje neutralny payload zamiast
// uderzać w nieobecny backend dev-render — wzorzec z karta-task.tsx /
// mindmap-canvas.tsx. Router instalujemy TYLKO gdy TEN ekran jest wybrany
// (main.tsx importuje wszystkie ekrany naraz).
const g = window as unknown as { __MYWORK_CALENDAR_FETCH__?: boolean };
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'mywork-calendar';
if (__tenEkran && !g.__MYWORK_CALENDAR_FETCH__) {
  g.__MYWORK_CALENDAR_FETCH__ = true;
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

function MyWorkCalendarRoute(): React.ReactElement {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/my-work/calendar', { replace: true });
  }, [navigate]);
  return <MyWorkHub />;
}

export function MyWorkCalendarScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkCalendarRoute />
      </div>
    </AppProviders>
  );
}

export default MyWorkCalendarScreen;

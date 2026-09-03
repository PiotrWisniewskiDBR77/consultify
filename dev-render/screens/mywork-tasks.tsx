/**
 * dev-render host dla `mywork-tasks` — REALNY `<MyWorkHub>` na zakładce
 * `tasks` (Zadania), montujący REALNY `<MyTasksListContent>`
 * (MyWorkHub.tsx:4093). Wzorzec 1:1 z `mywork-inbox.tsx`/`mywork-decisions.tsx`
 * (MemoryRouter+navigate zamiast <Route>, bo `parseMyWorkPathIntent()` w
 * hubie czyta `location.pathname` bezpośrednio).
 *
 * PIERWSZY W HISTORII wpis harnessu dla tego ekranu (dyżur 2026-09-03,
 * pomiar "dziewięć ekranów bez wpisu"). Istniejące ekrany `karta-task.tsx`/
 * `karta-task-pelna.tsx` montują pojedynczą KARTĘ zadania (double-click,
 * N-mode) i celowo zwracają PUSTĄ listę z `Api.getPersonalTasks` (patrz
 * karta-task.tsx:509) — nie pokrywają WIDOKU LISTY, który jest osobnym,
 * realnie osiągalnym ekranem (MyWorkHub.tsx:159 import, :4093 mount).
 * `preview-4-zakladki.tsx` (KARTY N, 2026-07-21) to bespoke re-implementacja
 * podglądu 4 zakładek, nie montuje `<MyTasksListContent>` — cytuje go tylko
 * w komentarzu jako źródło danych do podglądu.
 *
 * Zawartość zakładki renderuje `<MyTasksListContent>`
 * (src/components/MyWork/MyTasksListContent.tsx). Trzy wywołania ładujące
 * dane przy mount:
 *   - `Api.getPersonalTasks({ includeDone: true })` (linia 1512) — zwraca
 *     TABLICĘ zadań wprost (`setTasks(data || [])`).
 *   - `Api.getDataContext()` (linia 1528) — diagnostyka (status/bazy/org/user),
 *     nigdzie nierenderowana wprost w tym ekranie, ale trzymamy realny
 *     kontrakt `DataContextSummary` (services/api.ts:647), nie kopertę ad-hoc.
 *   - `Api.get('/my-work/focus/state')` (linia 1535) — stan "dziś/w tym
 *     tygodniu" per-zadanie (Focus). Pusta lista `items` = realny, poprawny
 *     kontrakt pustego stanu (żaden task nie ma jeszcze przypiętego ogniska).
 *
 * Osiem zadań z tego samego uniwersum demo co `mywork-inbox.tsx`/
 * `mywork-decisions.tsx` (klienci Grupa Termika/NordFarm/Bielmar/Kolej
 * Wschodnia, inicjatywa DRD, zespół Piotr/Anna/Marek/Kasia) — ciągłość
 * między ekranami odbioru. Rozkład pokrywa statusy todo/in_progress/review/
 * blocked/done, wszystkie priorytety i termin przeterminowany/dziś/jutro/
 * przyszły, żeby kolumny (status, priorytet, termin z podświetleniem
 * overdue, assignee) miały co pokazać.
 *
 * URL: ?screen=mywork-tasks[&lang=pl|en][&theme=light|dark]
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api, type DataContextSummary } from '../../src/services/api';
import { V8MyWorkApi } from '../../src/services/api/v8/my-work';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Patrz mywork-calendar.tsx/mywork-decisions.tsx — przelotowy montaż
// InboxContent (fallback 'inbox') przy świeżym wejściu na inną zakładkę.
// Łagodzimy identycznie, żeby zrzut nie sypał toastem błędu.
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

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86_400_000).toISOString();
const todayAt = (h: number) => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const tomorrowAt = (h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

interface DemoAssignee {
  id: string;
  firstName: string;
  lastName: string;
}

const PIOTR: DemoAssignee = { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'Wiśniewski' };
const ANNA: DemoAssignee = { id: 'user-anna-demo', firstName: 'Anna', lastName: 'Kowalska' };
const MAREK: DemoAssignee = { id: 'user-marek-demo', firstName: 'Marek', lastName: 'Zieliński' };
const KASIA: DemoAssignee = { id: 'user-kasia-demo', firstName: 'Kasia', lastName: 'Nowak' };

interface DemoTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assignee?: DemoAssignee;
  assigneeId?: string;
  projectName?: string;
  initiativeName?: string;
  createdAt: string;
  attachments?: unknown[];
  dependencies?: unknown[];
}

const TASKS: DemoTask[] = [
  {
    id: 'task-drd-mapa-procesu-raportowania',
    title: 'Przygotować mapę procesu raportowania AS-IS dla warsztatu z zarządem',
    description: 'Wsad liczbowy do warsztatu 29.07 — bez mapy nie da się obronić szacunku oszczędności.',
    status: 'in_progress',
    priority: 'high',
    dueDate: tomorrowAt(17),
    assignee: PIOTR,
    assigneeId: PIOTR.id,
    projectName: 'DRD — Automatyzacja raportowania',
    initiativeName: 'init-drd-automatyzacja',
    createdAt: daysAgo(2),
  },
  {
    id: 'task-termika-warsztat-scenariuszowy',
    title: 'Zebrać dane wejściowe do warsztatu scenariuszowego — Grupa Termika',
    description: 'Trzy scenariusze redukcji kosztów energii do zatwierdzenia przez zarząd.',
    status: 'todo',
    priority: 'critical',
    dueDate: todayAt(16),
    assignee: PIOTR,
    assigneeId: PIOTR.id,
    projectName: 'Grupa Termika Q3',
    createdAt: daysAgo(1),
  },
  {
    id: 'task-nordfarm-eksport-danych',
    title: 'Wynegocjować z IT klienta termin eksportu danych magazynowych — NordFarm',
    description: 'Blokuje diagnozę logistyki — trzeci dzień bez odpowiedzi.',
    status: 'blocked',
    priority: 'critical',
    dueDate: daysAgo(1),
    assignee: KASIA,
    assigneeId: KASIA.id,
    projectName: 'HurtNord Logistyka — Onboarding',
    createdAt: daysAgo(4),
  },
  {
    id: 'task-bielmar-harmonogram-aktualizacja',
    title: 'Zaktualizować harmonogram warsztatu z zarządem — Bielmar',
    description: 'Termin minął wczoraj — klient pyta o nowy harmonogram.',
    status: 'todo',
    priority: 'medium',
    dueDate: daysAgo(1),
    assignee: MAREK,
    assigneeId: MAREK.id,
    projectName: 'Bielmar',
    createdAt: daysAgo(4),
  },
  {
    id: 'task-termika-raport-koncowy-review',
    title: 'Przegląd redakcyjny raportu końcowego przed wysyłką do klienta',
    description: 'Ostatni przegląd przed akceptem partnera — sprawdzić liczby względem warsztatu 21.08.',
    status: 'review',
    priority: 'high',
    dueDate: daysFromNow(1),
    assignee: ANNA,
    assigneeId: ANNA.id,
    projectName: 'Grupa Termika Q3',
    createdAt: daysAgo(3),
  },
  {
    id: 'task-kolej-wschodnia-agenda-kickoff',
    title: 'Przygotować agendę kick-off — nowy klient Atelier Toys',
    description: 'Zamknięte po akcepcie Kasi — agenda wysłana klientowi.',
    status: 'done',
    priority: 'normal',
    dueDate: daysAgo(2),
    assignee: KASIA,
    assigneeId: KASIA.id,
    projectName: 'Atelier Toys — Kickoff',
    createdAt: daysAgo(6),
  },
  {
    id: 'task-nordfarm-model-finansowy',
    title: 'Zbudować model finansowy oszczędności logistycznych — NordFarm',
    description: 'Model do warsztatu z zarządem — trzy warianty konsolidacji tras.',
    status: 'in_progress',
    priority: 'medium',
    dueDate: daysFromNow(5),
    assignee: MAREK,
    assigneeId: MAREK.id,
    projectName: 'HurtNord Logistyka — Onboarding',
    createdAt: daysAgo(3),
  },
  {
    id: 'task-bielmar-dokumentacja-dostawcy',
    title: 'Zarchiwizować dokumentację poprzedniego dostawcy — Bielmar',
    description: 'Niski priorytet — porządkowanie po decyzji o pozostaniu przy obecnym dostawcy.',
    status: 'todo',
    priority: 'low',
    dueDate: daysFromNow(10),
    assignee: PIOTR,
    assigneeId: PIOTR.id,
    projectName: 'Bielmar',
    createdAt: hoursAgo(20),
  },
];

Api.getPersonalTasks = (async () => TASKS) as typeof Api.getPersonalTasks;
Api.getDataContext = (async (): Promise<DataContextSummary> => ({
  status: 'ok',
  generatedAt: new Date().toISOString(),
  database: { source: 'dev-render-mock', host: null, name: null, readonly: true },
  organization: { activeOrganizationId: 'org-dbr77-demo', userOrganizationId: 'org-dbr77-demo' },
  user: { id: PIOTR.id, email: 'piotr@dbr77.com' },
  demo: { enabled: true, organizationId: 'org-dbr77-demo', headerActive: true },
})) as typeof Api.getDataContext;
Api.get = (async (url: string) => {
  if (url.includes('/my-work/focus/state')) {
    return { data: { items: [] } };
  }
  return { data: [], items: [] };
}) as typeof Api.get;

// Siatka bezpieczeństwa: wzorzec z mywork-inbox.tsx/mywork-decisions.tsx —
// cokolwiek jeszcze hub odpali przy montowaniu dostaje neutralny payload.
// Router instalujemy TYLKO gdy TEN ekran jest wybrany (main.tsx importuje
// wszystkie ekrany naraz).
const g = window as unknown as { __MYWORK_TASKS_FETCH__?: boolean };
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'mywork-tasks';
if (__tenEkran && !g.__MYWORK_TASKS_FETCH__) {
  g.__MYWORK_TASKS_FETCH__ = true;
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

function MyWorkTasksRoute(): React.ReactElement {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/my-work/tasks', { replace: true });
  }, [navigate]);
  return <MyWorkHub />;
}

export function MyWorkTasksScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkTasksRoute />
      </div>
    </AppProviders>
  );
}

export default MyWorkTasksScreen;

/**
 * dev-render host for the REAL `<TaskDetailView>` (archetyp C · Rekord,
 * SPEC-A powłoka N-mode) — karta Task.
 *
 * `TaskDetailView` (src/components/MyWork/TaskDetailView.tsx, 7389 linii) to
 * PRAWDZIWY komponent produkcyjny — zero przepisywania. Sam pobiera dane
 * przez `Api.getPersonalTask(id)` w `loadTask()` (efekt na `taskId`), plus
 * `Api.get('/users')` + `InitiativeService.getAll()` w efekcie mount.
 *
 * WAŻNA RÓŻNICA vs decision-record.tsx: `TaskDetailView` NIE MA własnych
 * stałych DEMO_* (grep `DEMO_`/`isDemo` → 0 trafień), więc nie da się
 * "pożyczyć" danych z trybu demo tak jak robi to DecisionDetailView. Cały
 * rekord — checklist, komentarze, załączniki, linked items, tagi — musi
 * przyjść z mocka `Api.getPersonalTask`. Kształt pól odwzorowany 1:1 z
 * mapowania w `loadTask()` (linie ~800-865) oraz z typów `Comment`
 * (shared/CommentsSection.tsx), `Attachment` (shared/AttachmentsSection.tsx)
 * i `LinkedItem`/`LinkedItemType` (shared/LinkedItemsSection.tsx).
 *
 * `Api` jest zwykłym eksportowanym obiektem (`export const Api = {...}`),
 * więc podmiana metody łata ten sam singleton, który importuje każdy moduł
 * (wzorzec z dev-render/screens/decision-record.tsx i melscanvas-workspace.tsx).
 *
 * Tryb prezentacji: `usePresentationMode('task')` → fallback 'n', a komponent
 * dodatkowo wymusza 'n' efektem (linie 634-638), więc renderuje się kanoniczna
 * ścieżka N (NModeHeader + NModeLeftNav + NModeCanvas + ArtifactRightPanel),
 * nie legacy D-mode. Nie trzeba nic ustawiać w localStorage.
 *
 * URL: ?screen=karta-task[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { TaskDetailView } from '../../src/components/MyWork/TaskDetailView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { InitiativeService } from '../../src/services/initiativeService';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const TASK_ID = 'task-dbr77-demo-1';
const INITIATIVE_ID = 'init-drd-automatyzacja';

const MOCK_USERS = [
  {
    id: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
  },
  { id: 'user-anna', firstName: 'Anna', lastName: 'Kowalska', email: 'anna.kowalska@dbr77.com' },
  { id: 'user-marek', firstName: 'Marek', lastName: 'Zieliński', email: 'marek.zielinski@dbr77.com' },
  {
    id: 'user-kasia',
    firstName: 'Katarzyna',
    lastName: 'Nowak',
    email: 'katarzyna.nowak@dbr77.com',
  },
];

const MOCK_INITIATIVES = [
  { id: INITIATIVE_ID, name: 'DRD — Automatyzacja raportowania', type: 'program' },
  { id: 'init-sla-enterprise', name: 'Podniesienie SLA dla klientów enterprise', type: 'project' },
  { id: 'init-onboarding', name: 'Skrócenie onboardingu konsultanta', type: 'project' },
];

/**
 * Rekord w kształcie, jakiego oczekuje `loadTask()`. Realna praca konsultanta
 * w połowie realizacji: zadanie w toku, checklist częściowo odhaczony,
 * dyskusja w komentarzach, powiązania z decyzją i inicjatywą.
 */
const MOCK_TASK = {
  id: TASK_ID,
  title: 'Przygotować mapę procesu raportowania AS-IS dla warsztatu z zarządem',
  description:
    'Zebrać i zwizualizować obecny przebieg powstawania raportu końcowego DRD — od zamknięcia ' +
    'wywiadów klienckich, przez konsolidację notatek, po akcept partnera i wysyłkę do klienta.\n\n' +
    'Zakres: 4 aktywne projekty klienckie (Grupa Termika, NordFarm, Bielmar, Kolej Wschodnia). ' +
    'Dla każdego kroku notujemy: właściciela, czas przejścia (lead time), narzędzie oraz punkty ' +
    'oczekiwania. Mapa jest wsadem do warsztatu 29.07 — bez niej nie da się rzetelnie oszacować ' +
    'oszczędności z automatyzacji, a to jest główny argument w decyzji budżetowej na Q4.\n\n' +
    'Poza zakresem: projektowanie stanu TO-BE (osobne zadanie po warsztacie).',
  status: 'in_progress',
  priority: 'high',
  dueDate: '2026-07-28T00:00:00Z',
  startedAt: '2026-07-14T00:00:00Z',
  blockedReason: '',
  ownerId: 'user-piotr-demo',
  assigneeId: 'user-anna',
  initiativeId: INITIATIVE_ID,
  projectId: 'proj-drd-raporty',
  projectName: 'DRD Automatyzacja Raportów',
  createdByName: 'Marek Zieliński',
  createdBy: 'user-marek',
  createdAt: '2026-07-11T09:20:00Z',
  updatedAt: '2026-07-20T16:45:00Z',
  sourceType: 'decision',
  sourceId: 'decision-dbr77-demo-1',
  blockedByDecisionId: '',
  tags: ['warsztat-29.07', 'AS-IS', 'lead-time', 'zarząd'],

  checklist: [
    {
      id: 'chk-1',
      text: 'Wyciągnąć timestampy etapów raportu z 4 projektów (eksport z bazy)',
      completed: true,
    },
    {
      id: 'chk-2',
      text: 'Wywiad z Anną i Kasią — gdzie realnie stoi praca (nie gdzie „powinna")',
      completed: true,
    },
    {
      id: 'chk-3',
      text: 'Policzyć lead time i czas oczekiwania per krok (mediana, nie średnia)',
      completed: true,
    },
    { id: 'chk-4', text: 'Narysować mapę AS-IS w Process Flow + oznaczyć wąskie gardła', completed: false },
    { id: 'chk-5', text: 'Walidacja mapy z Markiem (partner prowadzący) przed warsztatem', completed: false },
    { id: 'chk-6', text: 'Wysłać pre-read do uczestników warsztatu na 48h przed', completed: false },
  ],

  comments: [
    {
      id: 'cmt-1',
      content:
        'Uwaga do zakresu: w Kolei Wschodniej raport przechodzi dodatkowy obieg przez dział ' +
        'prawny, którego nie ma w pozostałych trzech projektach. Zmapujmy to jako wariant, ' +
        'nie jako regułę — inaczej zawyżymy średni lead time dla całego portfela.',
      authorId: 'user-marek',
      authorName: 'Marek Zieliński',
      createdAt: '2026-07-16T11:05:00Z',
      likes: 2,
      likedByMe: true,
    },
    {
      id: 'cmt-2',
      content:
        'Zgoda. Wyniosłam obieg prawny do osobnej ścieżki na mapie. Przy okazji: dane z eksportu ' +
        'pokazują, że najdłuższe oczekiwanie to nie pisanie raportu (2,5 dnia), tylko akcept ' +
        'partnera — mediana 6 dni roboczych. To jest prawdziwe wąskie gardło.',
      authorId: 'user-anna',
      authorName: 'Anna Kowalska',
      createdAt: '2026-07-17T09:40:00Z',
      likes: 4,
      likedByMe: false,
    },
    {
      id: 'cmt-3',
      content:
        'Te 6 dni trzeba pokazać na warsztacie wprost, bez owijania. Jeśli automatyzujemy ' +
        'redakcję, a akcept zostaje ręczny, to skracamy 2,5 dnia z 11 — czyli obiecujemy ' +
        'zarządowi oszczędność, której nie dowieziemy.',
      authorId: 'user-piotr-demo',
      authorName: 'Piotr Wiśniewski',
      createdAt: '2026-07-18T14:12:00Z',
      likes: 3,
      likedByMe: false,
    },
    {
      id: 'cmt-4',
      content:
        'Dorzucam liczby z NordFarm: 3 rundy poprawek redakcyjnych na raport, każda ~1,5 dnia ' +
        'obiegu. Materiał do slajdu o kosztach jakości.',
      authorId: 'user-kasia',
      authorName: 'Katarzyna Nowak',
      createdAt: '2026-07-20T08:25:00Z',
      likes: 1,
      likedByMe: false,
    },
  ],

  attachments: [
    {
      id: 'att-1',
      name: 'AS-IS_raportowanie_eksport-timestampow.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 248_320,
      url: '#',
      uploadedAt: '2026-07-15T10:30:00Z',
      uploadedBy: 'Anna Kowalska',
    },
    {
      id: 'att-2',
      name: 'Notatki z wywiadów — zespół dostarczania (4 projekty).pdf',
      type: 'application/pdf',
      size: 1_142_784,
      url: '#',
      uploadedAt: '2026-07-16T13:15:00Z',
      uploadedBy: 'Katarzyna Nowak',
    },
    {
      id: 'att-3',
      name: 'Mapa AS-IS — szkic roboczy v3.png',
      type: 'image/png',
      size: 684_032,
      url: '#',
      uploadedAt: '2026-07-19T17:50:00Z',
      uploadedBy: 'Anna Kowalska',
    },
  ],

  linkedItems: [
    {
      id: 'decision-dbr77-demo-1',
      type: 'decision',
      title: 'Wybór podejścia do automatycznego generowania raportów DRD',
      status: 'pending',
      priority: 'high',
      linkRelation: 'informs',
      linkDirection: 'outgoing',
      comment: 'Mapa AS-IS jest wsadem liczbowym do tej decyzji.',
    },
    {
      id: INITIATIVE_ID,
      type: 'initiative',
      title: 'DRD — Automatyzacja raportowania',
      status: 'active',
      linkRelation: 'parent_of',
      linkDirection: 'incoming',
    },
    {
      id: 'task-dbr77-demo-2',
      type: 'task',
      title: 'Zaprojektować stan TO-BE procesu raportowania',
      status: 'todo',
      priority: 'medium',
      linkRelation: 'blocks',
      linkDirection: 'outgoing',
      comment: 'TO-BE startuje dopiero po walidacji AS-IS na warsztacie.',
    },
    {
      id: 'insight-lead-time-akcept',
      type: 'insight',
      title: 'Akcept partnera to 55% całkowitego lead time raportu',
      linkRelation: 'related',
      linkDirection: 'outgoing',
    },
  ],
};

// ── Stuby źródeł danych komponentu ──────────────────────────────────────────
Api.getPersonalTask = (async () => MOCK_TASK) as typeof Api.getPersonalTask;
InitiativeService.getAll = (async () => MOCK_INITIATIVES) as typeof InitiativeService.getAll;

// Podpowiedzi "powiązane notatki" / "sugerowane idee" — komponent odpala je
// debounce'em na tytule+opisie. Puste tablice = sekcja renderuje swój stan
// pusty, zamiast wisieć w spinnerze.
Api.getNotebookPages = (async () => []) as typeof Api.getNotebookPages;
Api.suggestMyIdeas = (async () => []) as typeof Api.suggestMyIdeas;
Api.getLinkGraphBacklinks = (async () => []) as typeof Api.getLinkGraphBacklinks;

const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url === '/users') return { users: MOCK_USERS };
  if (url === '/initiatives') return { initiatives: MOCK_INITIATIVES };
  if (url === '/assessments') return { assessments: [] };
  if (url === '/reports') return { reports: [] };
  if (url === '/interview/insights') return { insights: [] };
  return realApiGet(url);
}) as typeof Api.get;

// Picker "dodaj powiązanie" (Promise.allSettled na 8 źródłach) — niech ma
// czym wypełnić listy wyboru zamiast lecieć w błąd sieci.
Api.getPersonalTasks = (async () => []) as typeof Api.getPersonalTasks;
Api.getDecisions = (async () => []) as typeof Api.getDecisions;
Api.getProjects = (async () => []) as typeof Api.getProjects;
Api.listToolSessions = (async () => []) as typeof Api.listToolSessions;

// Siatka bezpieczeństwa: cokolwiek jeszcze ten ciężki komponent odpali przy
// montowaniu (presence, notyfikacje, AI suggestions…) dostaje neutralny,
// pusty payload zamiast uderzać w nieobecny backend dev-render i sypać
// błędem parsowania JSON z odpowiedzi HTML. i18n (/locales/**) przechodzi
// do prawdziwego fetcha.
const g = window as unknown as { __KARTA_TASK_FETCH__?: boolean };
// ★ Router instalujemy TYLKO gdy TEN ekran jest wybrany w adresie.
// main.tsx importuje WSZYSTKIE ekrany naraz, wiec bez tego warunku siedem
// routerow podmienia window.fetch jeden po drugim; ostatni jest najbardziej
// zewnetrzny i odpowiada WLASNYM fallbackiem zamiast oddac sterowanie dalej.
// Skutek przed poprawka: karta-initiative dostawala koperte obcego ekranu.
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'karta-task';
if (__tenEkran && !g.__KARTA_TASK_FETCH__) {
  g.__KARTA_TASK_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/my-work/') || url.includes('/users')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function KartaTaskScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <TaskDetailView
            key={`task-${TASK_ID}`}
            taskId={TASK_ID}
            onClose={() => {}}
            onSaved={() => {}}
            onOpenDecision={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaTaskScreen;

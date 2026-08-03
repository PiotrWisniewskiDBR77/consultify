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
  {
    id: 'user-marek',
    firstName: 'Marek',
    lastName: 'Zieliński',
    email: 'marek.zielinski@dbr77.com',
  },
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

  /**
   * ★ KRYTERIA AKCEPTACJI (pole „Oczekiwany rezultat", SPEC-A §6.2/§6.3).
   *
   * HISTORIA DEFEKTU (NAPRAWIONY 2026-07-23, fala 2): `TaskDetailView.loadTask()`
   * mapowało 24 pola rekordu, ale `expectedOutcome` nie było wśród nich — stan
   * startował z `useState('')` i zapisywał go wyłącznie generator AI. Karta
   * flagowego zadania demo pokazywała placeholder „Zdefiniuj mierzalny
   * rezultat…", choć dane były w bazie. Audyt runtime pokazał, że łańcuch był
   * przerwany w trzech miejscach naraz (GET nie zwracał kolumny, PUT jej nie
   * przyjmował, front nie mapował) — naprawione wszystkie trzy.
   * Weryfikacja: `.value` textarei „Oczekiwany rezultat" = 1166 znaków.
   *
   * Kryteria napisane falsyfikowalnie: każde da się jednoznacznie orzec
   * (spełnione / niespełnione) przed warsztatem 29.07.
   */
  expectedOutcome:
    'Zadanie jest wykonane, gdy spełnione są trzy warunki (każdy sprawdzalny przed 29.07):\n\n' +
    '1. KOMPLETNOŚĆ. Mapa AS-IS obejmuje 4 projekty (Grupa Termika, NordFarm, Bielmar, ' +
    'Kolej Wschodnia) × wszystkie kroki od zamknięcia wywiadów do wysyłki, a przy każdym kroku ' +
    'jest właściciel, narzędzie i lead time liczony jako mediana z eksportu timestampów. ' +
    'Sprawdzenie: brak kroku bez wartości lead time.\n\n' +
    '2. WALIDACJA. Mapa zwalidowana przez Marka Zielińskiego (partner prowadzący) — pisemne ' +
    '„tak" w komentarzu do zadania albo lista poprawek do naniesienia. ' +
    'Sprawdzenie: wpis Marka w karcie, nie ustna zgoda.\n\n' +
    '3. GOTOWOŚĆ WARSZTATU. Pre-read (mapa + 3 liczby wąskiego gardła) wysłany do wszystkich ' +
    'uczestników co najmniej 48 h przed warsztatem 29.07, czyli do 27.07 godz. 9:00. ' +
    'Sprawdzenie: data wysyłki w wątku warsztatowym.\n\n' +
    'Poza kryterium: uzgodnienie stanu TO-BE i wyliczenie oszczędności — to warsztat, ' +
    'nie to zadanie.\n\n' +
    'Warunek falsyfikujący całość: jeśli eksport timestampów okaże się niekompletny dla ' +
    'co najmniej jednego z 4 projektów, mapa nie jest wsadem liczbowym do decyzji budżetowej ' +
    'i zadanie trzeba przeciąć — zamiast mapy idzie na warsztat notatka o luce w danych.',
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
    {
      id: 'chk-4',
      text: 'Narysować mapę AS-IS w Process Flow + oznaczyć wąskie gardła',
      completed: false,
    },
    {
      id: 'chk-5',
      text: 'Walidacja mapy z Markiem (partner prowadzący) przed warsztatem',
      completed: false,
    },
    {
      id: 'chk-6',
      text: 'Wysłać pre-read do uczestników warsztatu na 48h przed',
      completed: false,
    },
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

// ── Stub AI (weryfikacja naprawy atrap, 2026-07-23) ─────────────────────────
// `?ai=ok`   → `/ai/generate` odpowiada realnym kształtem `{ text }` (ścieżka sukcesu)
// `?ai=down` → `/ai/generate` rzuca błędem serwera (ścieżka „AI niedostępne")
// bez parametru → zachowanie jak dotąd (siatka bezpieczeństwa window.fetch).
// ★ Patchujemy METODĘ `Api.post`, nie `window.fetch` — window.fetch jest tu
// wspólną siatką dla wszystkich ekranów i zwraca `{data:[],items:[]}`.
const __aiTryb = new URLSearchParams(window.location.search).get('ai');
if (__aiTryb === 'ok' || __aiTryb === 'down') {
  const realApiPost = Api.post.bind(Api);
  const odpowiedziAi: Record<string, string> = {
    'Task Reminder Advisor': JSON.stringify({
      type: 'before_due',
      days: 3,
      recipients: 'stakeholders',
      message:
        'Za 3 dni termin mapy AS-IS. Bez niej warsztat 29.07 nie ma wsadu liczbowego — potwierdź walidację z Markiem.',
    }),
    'Task Escalation Advisor': JSON.stringify({
      warningDays: 2,
      criticalDays: 5,
      afterDays: 3,
      escalationMode: 'manager_review',
      escalateTo: 'user-marek',
      message:
        'Mapa AS-IS przekroczyła termin. Eskalacja do partnera prowadzącego — warsztat 29.07 jest zagrożony.',
    }),
    'Task Comment Advisor':
      'Najwęższym gardłem jest akcept partnera (mediana 6 dni), nie redakcja. Zanim domkniesz mapę, ustal z Markiem docelowy SLA akceptu — inaczej oszczędność pokazana zarządowi będzie nie do dowiezienia.',
    'Task Description Writer':
      'Zmapować obecny przebieg powstawania raportu DRD dla 4 projektów klienckich: Grupa Termika, NordFarm, Bielmar, Kolej Wschodnia. Dla każdego kroku zanotować właściciela, lead time, narzędzie i punkt oczekiwania. Wynik jest wsadem liczbowym do warsztatu 29.07 — bez niego nie da się obronić szacunku oszczędności przed zarządem. Poza zakresem: projektowanie stanu TO-BE.',
    'Task Outcome Writer':
      'Mapa AS-IS obejmuje 4 projekty i wszystkie kroki od zamknięcia wywiadów po wysyłkę do klienta.\nDla każdego kroku podany lead time (mediana) i właściciel.\nWąskie gardła oznaczone, w tym akcept partnera (mediana 6 dni).\nMarek (partner prowadzący) potwierdził zgodność mapy z rzeczywistością.\nPre-read wysłany uczestnikom warsztatu na 48h przed 29.07.',
    'Task Checklist Planner': JSON.stringify({
      items: [
        'Wyeksportować timestampy etapów raportu z 4 projektów',
        'Policzyć medianę lead time i czasu oczekiwania per krok',
        'Wyodrębnić obieg prawny Kolei Wschodniej jako wariant, nie regułę',
        'Narysować mapę AS-IS w Process Flow i oznaczyć wąskie gardła',
        'Zwalidować mapę z Markiem przed warsztatem',
        'Wysłać pre-read uczestnikom na 48h przed 29.07',
      ],
    }),
    'Task Implementation Advisor': JSON.stringify({
      ideas: [
        {
          title: 'Mapa z eksportu danych, wywiad tylko na weryfikację',
          description:
            'Podstawą mapy są timestampy z bazy (4 projekty), a wywiady z Anną i Kasią służą wyłącznie potwierdzeniu spornych kroków. Skraca pracę o ~2 dni i usuwa ryzyko mapy „jak powinno być".',
        },
        {
          title: 'Dwie ścieżki: standard + wariant prawny Kolei Wschodniej',
          description:
            'Jedna mapa główna dla trzech projektów i oznaczony wariant z obiegiem prawnym. Zapobiega zawyżeniu średniego lead time całego portfela.',
        },
        {
          title: 'Mapa pod decyzję budżetową, nie pod kompletność',
          description:
            'Zakres ograniczony do kroków, które wchodzą do rachunku oszczędności — w tym akcept partnera (mediana 6 dni). Reszta jako aneks.',
        },
      ],
    }),
    'Task Risk Analyst': JSON.stringify({
      risks: [
        {
          title: 'Akcept partnera (mediana 6 dni) zostaje ręczny mimo automatyzacji redakcji',
          probability: 'high',
          impact: 'critical',
          category: 'operational',
          mitigation: 'Pokazać rozbicie 11 dni na warsztacie i ustalić docelowy SLA akceptu.',
          contingency: 'Zawęzić obietnicę dla zarządu do 2,5 dnia redakcji.',
        },
        {
          title: 'Mapa nieprzewalidowana z Markiem przed 29.07',
          probability: 'medium',
          impact: 'high',
          category: 'business',
          mitigation: 'Slot walidacyjny 27.07 w kalendarzu partnera.',
          contingency: 'Warsztat prowadzony na danych surowych zamiast na mapie.',
        },
      ],
    }),
    'Task Alternatives Advisor': JSON.stringify({
      alternatives: [
        {
          title: 'Mapa na danych z eksportu (mediany)',
          description:
            'Lead time liczony z timestampów, wywiady tylko jako weryfikacja spornych kroków.',
          pros: ['Odporna na „jak powinno być"', 'Krótsza o ~2 dni'],
          cons: ['Braki w projektach bez kompletnych timestampów'],
          isRecommended: true,
        },
        {
          title: 'Mapa z warsztatu z zespołem dostarczania',
          description: 'Mapowanie na żywo z Anną, Kasią i Markiem zamiast pracy na eksporcie.',
          pros: ['Wysoka akceptacja zespołu'],
          cons: ['Ryzyko mapy życzeniowej', 'Blokuje 3 osoby na pół dnia'],
          isRecommended: false,
        },
      ],
    }),
    'RACI Team Advisor': JSON.stringify({
      stakeholders: [
        { userId: 'user-piotr-demo', role: 'accountable' },
        { userId: 'user-anna', role: 'responsible' },
        { userId: 'user-marek', role: 'consulted' },
        { userId: 'user-kasia', role: 'informed' },
      ],
    }),
  };
  Api.post = (async (url: string, data: any) => {
    if (String(url).includes('/ai/generate')) {
      if (__aiTryb === 'down') {
        const err: any = new Error('LLM provider unavailable');
        err.status = 503;
        err.data = { code: 'NO_AI_PROVIDER' };
        throw err;
      }
      const text = odpowiedziAi[String(data?.roleName)] ?? 'OK';
      await new Promise((r) => setTimeout(r, 300));
      return { text } as any;
    }
    return realApiPost(url, data);
  }) as typeof Api.post;
}

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

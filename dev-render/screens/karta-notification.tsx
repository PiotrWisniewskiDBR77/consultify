/**
 * PRV-MYWORK — dev-render host dla PRAWDZIWEGO `<NotificationDetailView>`
 * (src/components/MyWork/NotificationDetailView.tsx) — karta "Notification".
 *
 * Komponent NIE przyjmuje danych propsem — sam je fetchuje w `loadNotification()`
 * (`Api.getNotificationById` → fallback `Api.getNotifications`), a następnie
 * `loadSourceEntity()` / `loadComments()` / `loadActivityLog()` (te dwa ostatnie
 * leniwie, dopiero po wejściu w sekcję). Propsy wymagane to tylko
 * `notificationId` + `onClose`; `onNavigateToSource` jest opcjonalny.
 *
 * Dlatego stubujemy metody singletona `Api` (jest to zwykły `export const Api = {...}`,
 * więc podmiana metody łata ten sam obiekt we wszystkich modułach — wzorzec 1:1
 * z dev-render/screens/decision-record.tsx i melscanvas-workspace.tsx).
 *
 * `commentsCount` / `activityCount` czytane są z pól rekordu powiadomienia
 * (`commentsCount` / `activityCount`) — bez nich sekcje "Komentarze" i
 * "Historia aktywności" w ogóle nie pojawiłyby się w LeftNav (są warunkowe:
 * `count > 0`). Ustawiamy je, żeby nadzorca zobaczył PEŁNY zestaw 5 sekcji.
 *
 * Typ `AI_RISK_DETECTED` jest dobrany świadomie: `nModeSections` włącza sekcję
 * "Analiza AI" gdy `type` zawiera "AI" lub `data` ma riskLevel/recommendation/
 * impact/confidence — mamy tu wszystkie te pola, więc widać wariant najbogatszy.
 * `relatedObjectType: 'DECISION'` daje primaryCta `open_decision`.
 *
 * Komponent nie ma własnego providera — używa i18n (`useTranslation`),
 * `useAppStore`, `useConversationStore`, `usePresentationMode` i react-hot-toast.
 * `AppProviders` + `FeatureFlagsProvider` pokrywają to w całości, tak jak w
 * pozostałych harnessach; `seedRealisticSession()` sadza currentUser.
 *
 * URL: ?screen=karta-notification[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { NotificationDetailView } from '../../src/components/MyWork/NotificationDetailView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const NOTIFICATION_ID = 'notif-dbr77-demo-1';
const DECISION_ID = 'decision-dbr77-demo-1';

const MOCK_NOTIFICATION = {
  id: NOTIFICATION_ID,
  type: 'AI_RISK_DETECTED',
  title: 'Ryzyko poślizgu bramki G2 w projekcie „Automatyzacja raportów DRD"',
  message:
    'Analiza AI wykryła, że decyzja o architekturze generowania raportów czeka na ' +
    'rozstrzygnięcie 9 dni przy planowanym buforze 3 dni. Blokuje to 4 zadania wdrożeniowe ' +
    'i przesuwa bramkę G2 z 12.03 na co najmniej 24.03. Dwaj klienci enterprise mają ' +
    'umowne terminy dostarczenia raportów w marcu.',
  severity: 'WARNING' as const,
  category: 'ai' as const,
  isRead: false,
  isActionable: true,
  createdAt: '2026-07-20T08:12:00.000Z',
  expiresAt: '2026-08-03T08:12:00.000Z',
  actionLabel: 'Otwórz decyzję',
  relatedObjectId: DECISION_ID,
  relatedObjectType: 'DECISION' as const,
  projectId: 'proj-drd-raporty',
  projectName: 'DRD — Automatyzacja raportów',
  // Liczniki: bez nich sekcje Komentarze / Historia nie wejdą do LeftNav.
  commentsCount: 3,
  activityCount: 4,
  data: {
    aiGenerated: true,
    riskLevel: 'high',
    confidence: 0.82,
    impact: 'Poślizg bramki G2 o ~12 dni roboczych; ryzyko kar umownych u 2 klientów enterprise.',
    recommendation:
      'Zwołać 45-minutową sesję decyzyjną z właścicielem programu jeszcze w tym tygodniu ' +
      'i zamknąć wybór na modelu hybrydowym (AI + recenzja konsultanta) — POC potwierdził ' +
      'jakość, brakuje wyłącznie formalnej akceptacji.',
    savings_annual: 96000,
    blocked:
      'Blokuje: 4 zadania wdrożeniowe (integracja szablonów, pipeline eksportu, testy UAT, ' +
      'szkolenie zespołu klienta) oraz bramkę G2.',
    contextLine:
      'Program DRD — faza wyboru architektury po zakończonym POC (5 tygodni, 3 warianty).',
    daysWaiting: 9,
    owner: 'Anna Kowalska',

    /**
     * ★ POLE „OPIS" NIE MOŻE BYĆ KOPIĄ TYTUŁU.
     *
     * `NotificationDetailView` hydratuje trzy pierwsze pola karty łańcuchem
     * `data.worksheet.<pole> ?? contract.<pole> ?? notification.message`
     * (NotificationDetailView.tsx:1383-1391), a `contract.what` to DOSŁOWNIE
     * `normalize(n.title)` (notificationContent.ts:1083). Bez `worksheet`
     * pierwsze pole karty przepisywało tytuł, czyli nie niosło ani jednej
     * nowej informacji. `worksheet` ma pierwszeństwo — i tu go podajemy.
     *
     * Układ: wniosek najpierw (ile czeka i co z tego wynika), potem skutek
     * na terminie, potem zasięg blokady, na końcu twardy skutek biznesowy.
     */
    worksheet: {
      description:
        'Decyzja o architekturze generowania raportów czeka 9 dni przy buforze 3 dni. ' +
        'Bramka G2 przesuwa się z 12.03 na 24.03, czyli o 12 dni roboczych. ' +
        'Zablokowane są 4 zadania wdrożeniowe. Dwaj klienci enterprise mają umowne terminy ' +
        'dostarczenia raportów w marcu — przy tym przesunięciu wchodzimy w ryzyko kar.',
      whyImportant:
        'Nie chodzi o samą zwłokę, tylko o to, że czekanie nic już nie wnosi. POC zamknięty ' +
        '(5 tygodni, 3 warianty), wariant hybrydowy wypadł najlepiej: 92% raportów bez poprawek ' +
        'konsultanta. Brakuje wyłącznie formalnej akceptacji właściciela programu — ' +
        'każdy kolejny dzień kupuje zero nowej wiedzy, a kosztuje jeden dzień bramki G2.\n\n' +
        'Skala: przy stawce 32 tys. PLN za tydzień niezafakturowanej pracy 12 dni roboczych ' +
        'to ok. 77 tys. PLN (ZAŁOŻENIE: stawka z rozliczenia programu za II kw. 2026).',
      blocked:
        'Bezpośrednio zablokowane (4 zadania): integracja szablonów raportu, pipeline eksportu, ' +
        'testy UAT u klienta, szkolenie zespołu klienta.\n' +
        'Pośrednio: bramka G2 całego programu DRD i dwa odbiory etapu u klientów enterprise.\n' +
        'NIE jest zablokowane: prace na module wywiadów i migracja danych historycznych — ' +
        'te idą niezależnie od wyboru architektury.',
      expectedAction:
        'Zwołać 45-minutową sesję decyzyjną z właścicielem programu do piątku i zamknąć wybór ' +
        'na modelu hybrydowym (AI + recenzja konsultanta). Slot na czwartek 10:00 jest ' +
        'zarezerwowany, czeka na potwierdzenie.\n\n' +
        'Co obaliłoby tę rekomendację: gdyby walidacja danych źródłowych dla modelu w pełni ' +
        'automatycznego dała się zamknąć w mniej niż 3 tygodnie — wtedy warto poczekać ' +
        'i wybrać wariant docelowy zamiast pośredniego. Marek Zieliński ocenia to jako nierealne ' +
        'przy terminie marcowym; to jedyne założenie, które trzeba potwierdzić przed sesją.',
    },
  },
};

const MOCK_SOURCE_ENTITY = {
  id: DECISION_ID,
  type: 'decision',
  title: 'Wybór podejścia do automatycznego generowania raportów DRD',
  status: 'pending',
  priority: 'high',
  decider: 'Piotr Wiśniewski',
  dueDate: '2026-07-24T16:00:00.000Z',
  projectName: 'DRD — Automatyzacja raportów',
};

const MOCK_COMMENTS = [
  {
    id: 'notif-comment-1',
    content:
      'POC zamknięty, wariant hybrydowy wypadł najlepiej: 92% raportów bez poprawek ' +
      'konsultanta. Materiał porównawczy wrzuciłam do folderu programu.',
    createdAt: '2026-07-20T09:40:00.000Z',
    user: { id: 'user-anna', firstName: 'Anna', lastName: 'Kowalska' },
  },
  {
    id: 'notif-comment-2',
    content:
      'Od strony wdrożenia: model w pełni automatyczny wymaga jeszcze ok. 3 tygodni na ' +
      'walidację danych źródłowych. Przy terminie marcowym to nierealne.',
    createdAt: '2026-07-20T12:05:00.000Z',
    user: { id: 'user-marek', firstName: 'Marek', lastName: 'Zieliński' },
  },
  {
    id: 'notif-comment-3',
    content:
      'Zarezerwowałem slot na czwartek 10:00 — proszę o potwierdzenie, wtedy decyzja ' +
      'zdąży przed bramką G2.',
    createdAt: '2026-07-21T07:15:00.000Z',
    user: { id: 'user-kasia', firstName: 'Katarzyna', lastName: 'Nowak' },
  },
];

const MOCK_ACTIVITY_LOG = [
  {
    id: 'notif-log-1',
    action: 'created',
    description: 'Powiadomienie wygenerowane przez silnik ryzyka (reguła: decyzja > 7 dni)',
    userName: 'Teresa (AI)',
    createdAt: '2026-07-20T08:12:00.000Z',
  },
  {
    id: 'notif-log-2',
    action: 'commented',
    description: 'Dodano komentarz z wynikami POC',
    userName: 'Anna Kowalska',
    createdAt: '2026-07-20T09:40:00.000Z',
  },
  {
    id: 'notif-log-3',
    action: 'assigned',
    description: 'Przypisano właściciela decyzji: Piotr Wiśniewski',
    userName: 'Anna Kowalska',
    createdAt: '2026-07-20T14:22:00.000Z',
  },
  {
    id: 'notif-log-4',
    action: 'updated',
    description: 'Podniesiono poziom ryzyka z medium na high (9 dzień oczekiwania)',
    userName: 'Teresa (AI)',
    createdAt: '2026-07-21T06:30:00.000Z',
  },
];

Api.getNotificationById = (async () => MOCK_NOTIFICATION) as typeof Api.getNotificationById;
Api.getNotifications = (async () => [MOCK_NOTIFICATION]) as typeof Api.getNotifications;
Api.getNotificationSourceEntity = (async () =>
  MOCK_SOURCE_ENTITY) as typeof Api.getNotificationSourceEntity;
Api.getNotificationComments = (async () => MOCK_COMMENTS) as typeof Api.getNotificationComments;
Api.getNotificationActivityLog = (async () =>
  MOCK_ACTIVITY_LOG) as typeof Api.getNotificationActivityLog;

// ── Tryby awarii do testowania UCZCIWOŚCI wskaźnika zapisu ──────────────────
// Karta gubiła treść i pokazywała „Zapisano". Naprawa musi być sprawdzalna, więc
// harness umie na żądanie odtworzyć dwa warunki, których sam z siebie nie ma:
//   &failsave=1  → zapis arkusza ZAWSZE pada. Oczekiwane: nagłówek pokazuje
//                  „Błąd zapisu" (nie „Zapisano"), toast błędu, brak pętli ponowień.
//   &aidelay=<ms> → auto-analiza AI zwraca POPRAWNY JSON po zadanym opóźnieniu.
//                  Pozwala odtworzyć wyścig: piszesz w polu, po chwili wraca AI.
//                  Oczekiwane: AI NIE nadpisuje pola, które w tym czasie zmieniłeś.
const __params = new URLSearchParams(window.location.search);
const __failSave = __params.get('failsave') === '1';
const __aiDelay = Number(__params.get('aidelay') || 0);

Api.markNotificationRead = (async () => ({
  success: true,
})) as unknown as typeof Api.markNotificationRead;
Api.updateNotificationChecklist = (async () => ({
  success: true,
})) as unknown as typeof Api.updateNotificationChecklist;
Api.updateNotificationWorksheet = (async () => {
  if (__failSave) throw new Error('Failed to update notification worksheet (harness failsave=1)');
  return { success: true };
}) as unknown as typeof Api.updateNotificationWorksheet;

if (__aiDelay > 0) {
  const AI_JSON = JSON.stringify({
    description: 'TRESC-OD-AI opis sytuacji',
    whyImportant: 'TRESC-OD-AI dlaczego to wazne',
    blocked: 'TRESC-OD-AI co jest zablokowane',
    expectedAction: 'TRESC-OD-AI oczekiwana akcja',
    checklist: [],
  });
  const realPost = Api.post.bind(Api);
  Api.post = (async (url: string, body?: unknown) => {
    // ★ 2026-07-23: karta wola teraz /ai/generate (jedyny endpoint zwracajacy
    // {text}); /ai/chat zostaje w warunku tylko dla starych linkow harnessu.
    if (String(url).includes('/ai/generate') || String(url).includes('/ai/chat')) {
      await new Promise((r) => setTimeout(r, __aiDelay));
      return { text: AI_JSON };
    }
    return realPost(url as never, body as never);
  }) as unknown as typeof Api.post;
}

// Siatka bezpieczeństwa: cokolwiek jeszcze ten ciężki ekran odpali na mount
// (presence, AI /ai/chat, katalogi) dostaje neutralny pusty payload zamiast
// HTML-a z vite-dev-servera (który wywala JSON.parse w konsoli).
// i18n `/locales/**` przepuszczamy do prawdziwego fetcha.
const g = window as unknown as { __KARTA_NOTIFICATION_FETCH__?: boolean };
// ★ Router instalujemy TYLKO gdy TEN ekran jest wybrany w adresie.
// main.tsx importuje WSZYSTKIE ekrany naraz, wiec bez tego warunku siedem
// routerow podmienia window.fetch jeden po drugim; ostatni jest najbardziej
// zewnetrzny i odpowiada WLASNYM fallbackiem zamiast oddac sterowanie dalej.
// Skutek przed poprawka: karta-initiative dostawala koperte obcego ekranu.
const __tenEkran =
  new URLSearchParams(window.location.search).get('screen') === 'karta-notification';
if (__tenEkran && !g.__KARTA_NOTIFICATION_FETCH__) {
  g.__KARTA_NOTIFICATION_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/notifications') || url.includes('/ai/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function KartaNotificationScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'auto' }}
          className="bg-white dark:bg-navy-900"
        >
          <NotificationDetailView
            key={`notification-${NOTIFICATION_ID}`}
            notificationId={NOTIFICATION_ID}
            onClose={() => {}}
            onNavigateToSource={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaNotificationScreen;

/**
 * PRV-MYWORK — dev-render host dla PRAWDZIWEJ karty `<DecisionDetailView>`
 * (src/components/MyWork/DecisionDetailView.tsx, archetyp C · Rekord, powłoka
 * SPEC-A / NModeShell). Zero re-implementacji — montujemy komponent produkcyjny.
 *
 * ROZPOZNANIE (KROK 1):
 * - Propsy: `decisionId: string | null` (WYMAGANY), `onClose: () => void`
 *   (WYMAGANY), `onSaved?: (data) => void` (opcjonalny). Nic więcej — cała
 *   treść karty pochodzi z self-fetchu.
 * - Komponent SAM fetchuje: `Api.getDecision(id)`, `Api.getDecisionHistory(id)`,
 *   `Api.get('/decisions/:id/stakeholders')`, `Api.get('/users')`
 *   (efekty loadDecision + loadUsers, kluczowane na `decisionId`).
 *   `Api` to zwykły eksportowany obiekt (`export const Api = {...}`), więc
 *   podmiana metody łata ten sam singleton, który importuje każdy moduł
 *   (wzorzec z dev-render/screens/melscanvas-workspace.tsx i decision-record.tsx).
 * - Konteksty/hooki: useTranslation (i18n), useDemoSession, useAppStore,
 *   useConversationStore, useOpenChatWithContext, usePresentationMode,
 *   useCloudIntegrations, react-router (ROUTES/nawigacja), FeatureFlags.
 *   Wszystkie dostarcza `AppProviders` + `FeatureFlagsProvider`, pod warunkiem
 *   że `currentUser` jest zasiany — robi to `seedRealisticSession()`.
 *
 * RÓŻNICA WOBEC ISTNIEJĄCEGO `decision-record.tsx`: tamten harness świadomie
 * zostawia alternatywy/ryzyka/komentarze/RACI pustymi w mocku, żeby komponent
 * spadł na swoje wbudowane stałe DEMO_* — a te są PO ANGIELSKU. Ten ekran
 * podaje komplet danych PO POLSKU wprost w payloadzie (`alternatives`, `risks`,
 * `comments`, `linkedItems`, `attachments`) oraz stubuje endpoint
 * `/decisions/:id/stakeholders`, więc karta pokazuje realistyczną polską pracę
 * konsultanta, a nie angielski seed deweloperski.
 *
 * URL: ?screen=karta-decision[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { DecisionDetailView } from '../../src/components/MyWork/DecisionDetailView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

/**
 * `DecisionDetailView.loadDecision()` ma WBUDOWANY fallback na angielskie
 * stałe `DEMO_ALTERNATIVES`/`DEMO_RISKS`/`DEMO_COMMENTS`/`DEMO_ATTACHMENTS`/
 * `DEMO_STAKEHOLDERS`/`DEMO_ESCALATION`/`DEMO_REMINDERS` za każdym razem, gdy
 * tablica z API jest pusta A `isDemo === true` (linie ~1983-2050 w src).
 * `seedRealisticSession()` ustawia `isDemoMode: true` dla WSZYSTKICH ekranów
 * (potrzebne dla currentUser/providerów) — bez wyłączenia tego przełącznika
 * TUTAJ obie wersje karty (pusta i `?dane=pelne`) pokazywałyby gdzieniegdzie
 * angielski seed deweloperski zamiast treści z MOCK_* poniżej, co łamie
 * „jedna historia po polsku". Wyłączamy `isDemoMode`/`currentUser.isDemo` NA
 * TYM EKRANIE ZAWSZE (obie wersje) i sami w 100% kontrolujemy puste/pełne
 * przez `MOCK_DECISION_EFEKTYWNY` niżej — provider tree zostaje pełny, bo
 * zależy od `currentUser?.id`, nie od `isDemo`.
 */
const __danePelneWczesnie = new URLSearchParams(window.location.search).get('dane') === 'pelne';
{
  const cu = useAppStore.getState().currentUser;
  useAppStore.setState({
    isDemoMode: false,
    currentUser: cu ? ({ ...cu, isDemo: false } as any) : cu,
  });
}

const DECISION_ID = 'decision-prv-mywork-1';

/**
 * ★ LICZBY MUSZĄ BYĆ WIDOCZNE NA EKRANIE, NIE TYLKO W DANYCH.
 *
 * Karta ma na celu pokazać trade-offy, ale `DecisionDetailView` renderuje
 * z każdej opcji wyłącznie tytuł, opis, argumenty za/przeciw, znaczniki
 * i „ryzyko: <poziom>". Pola `estimatedCost`, `estimatedDuration`,
 * `confidence`, `impactScore` oraz `isRecommended` (poza kropką przy tytule)
 * NIE MAJĄ dziś miejsca w widoku — sprawdzone na żywym renderze harnessu.
 * Zgłoszone jako wymagane do dorobienia PO STRONIE KOMPONENTU.
 *
 * Do czasu tej poprawki liczby wchodzą do pierwszego wiersza `description`
 * (koszt · czas · pewność wyceny · rekomendacja) wraz z JAWNYM ZAŁOŻENIEM
 * wyliczenia — inaczej karta o kompromisach nie pokazuje ani jednej liczby.
 * Pola strukturalne zostają nietknięte i zgodne co do grosza z opisem.
 */
const MOCK_ALTERNATIVES = [
  {
    id: 'alt-1',
    title: 'Migracja na własną instancję w EU (Frankfurt)',
    description:
      'KOSZT 168 000 PLN · CZAS 6 tygodni · PEWNOŚĆ WYCENY wysoka · REKOMENDOWANY.\n' +
      'Podstawa wyceny: 6 tygodni × 2 osoby = 12 osobotygodni zespołu platformowego ' +
      '× 14 000 PLN za osobotydzień (stawka wewnętrzna, kontroling VI 2026).\n\n' +
      'Przeniesienie całego przetwarzania danych wywiadowczych na dedykowaną instancję ' +
      'w regionie EU. Pełna kontrola nad rezydencją danych, własny klucz szyfrowania, ' +
      'brak transferu poza EOG. Wymaga przebudowy warstwy kolejkowania i re-certyfikacji.\n\n' +
      'Co obaliłoby tę rekomendację: gdyby dział prawny obu klientów pisemnie zaakceptował ' +
      'pseudonimizację jako wystarczającą, wariant B daje ten sam efekt za 44% kosztu ' +
      'i o 3 tygodnie szybciej. Odpowiedź kancelarii spodziewana przed 5 sierpnia.',
    pros: [
      'Zdejmuje blokadę prawną 2 klientów: 3 z 3 zastrzeżeń',
      'Rezydencja danych w EU bez klauzul transferowych',
      'Własny klucz szyfrowania — argument w przetargach publicznych 2027',
    ],
    cons: [
      'Najwyższy koszt: 168 000 PLN, czyli 2,3× wariantu B',
      '6 tygodni zespołu platformowego — wolne okno 10-24 sierpnia',
      'Ponowna certyfikacja dostawcy — poza naszym harmonogramem',
    ],
    estimatedCost: 168000,
    estimatedDuration: '6 tygodni',
    isRecommended: true,
    riskLevel: 'medium',
    confidence: 'high',
    impactScore: { scope: 'high', schedule: 'medium', cost: 'high', quality: 'high' },
  },
  {
    id: 'alt-2',
    title: 'Model hybrydowy — anonimizacja przed przetwarzaniem',
    description:
      'KOSZT 74 000 PLN · CZAS 3 tygodnie · PEWNOŚĆ WYCENY średnia · niezalecany dziś.\n' +
      'Podstawa wyceny: 4 osobotygodnie × 14 000 PLN = 56 000 PLN + 18 000 PLN za opinię ' +
      'zewnętrznej kancelarii o pseudonimizacji. Pewność średnia, bo zakres warstwy ' +
      'pseudonimizacji zależy od uwag prawnych, których jeszcze nie mamy.\n\n' +
      'Dane pozostają u obecnego dostawcy, ale przed przetwarzaniem przechodzą przez ' +
      'warstwę pseudonimizacji (usuwanie PII, podmiana nazw podmiotów na identyfikatory). ' +
      'Mapowanie trzymane wyłącznie po naszej stronie.',
    pros: [
      'Wdrożenie w 3 tygodnie zamiast 6, bez przebudowy platformy',
      '74 000 PLN, czyli 44% kosztu wariantu A',
      'Odwracalny — migrację można dołożyć później bez straty wykonanej pracy',
    ],
    cons: [
      'Zamyka 2 z 3 zastrzeżeń — rezydencja danych zostaje otwarta',
      'Ryzyko utraty kontekstu w cytatach — pilot na 40 wywiadach',
      'Wymaga pisemnej zgody działu prawnego klienta — brak',
    ],
    estimatedCost: 74000,
    estimatedDuration: '3 tygodnie',
    isRecommended: false,
    riskLevel: 'medium',
    confidence: 'medium',
    impactScore: { scope: 'medium', schedule: 'low', cost: 'medium', quality: 'medium' },
  },
  {
    id: 'alt-3',
    title: 'Status quo z aneksem umownym (DPA)',
    description:
      'KOSZT 9 000 PLN · CZAS 1 tydzień (5 dni roboczych) · PEWNOŚĆ WYCENY wysoka · odrzucony.\n' +
      'Podstawa wyceny: 2 dni pracy radcy prawnego × 4 500 PLN za dzień. Zero pracy ' +
      'zespołu platformowego.\n\n' +
      'Utrzymanie obecnej architektury, uzupełnione o aneks powierzenia przetwarzania ' +
      'oraz standardowe klauzule umowne. Zmiana wyłącznie formalno-prawna.\n\n' +
      'Wariant trzymamy w zestawieniu jako punkt odniesienia kosztowy, nie jako opcję ' +
      'do wyboru — obaj klienci odrzucili go już na etapie due diligence.',
    pros: [
      'Najniższy koszt: 9 000 PLN, zero pracy zespołu platformowego',
      'Możliwe do zamknięcia w 5 dni roboczych, przed terminem 5 sierpnia',
    ],
    cons: [
      'Odrzucony przez 2 klientów w due diligence: 0 z 3 zastrzeżeń',
      'Odsuwa problem, nie rozwiązuje go — wraca przy kolejnym odbiorze etapu',
      'Blokuje przetargi publiczne 2027 — wymóg rezydencji w EOG',
    ],
    estimatedCost: 9000,
    estimatedDuration: '1 tydzień',
    isRecommended: false,
    riskLevel: 'high',
    confidence: 'high',
    impactScore: { scope: 'low', schedule: 'low', cost: 'low', quality: 'low' },
  },
];

const MOCK_RISKS = [
  {
    id: 'risk-1',
    title: 'Przekroczenie okna migracyjnego i kolizja z zamknięciem kwartału',
    probability: 'medium',
    impact: 'high',
    category: 'operational',
    mitigation:
      'Okno migracyjne wyznaczone na 10-24 sierpnia, przed zamknięciem Q3. Cotygodniowy ' +
      'punkt kontrolny z zespołem platformowym, twardy próg decyzyjny 17 sierpnia.',
    contingency:
      'Wariant awaryjny: uruchomienie równoległej instancji i przełączenie ruchu klienta ' +
      'po kwartale, bez wstrzymywania pozostałych projektów.',
  },
  {
    id: 'risk-2',
    title: 'Utrata jakości cytatów z wywiadów po pseudonimizacji',
    probability: 'high',
    impact: 'medium',
    category: 'technical',
    mitigation:
      'Pilot na zamkniętym zbiorze 40 wywiadów z projektu Orlen; porównanie raportów ' +
      'przed i po anonimizacji przez dwóch niezależnych konsultantów.',
    contingency:
      'Powrót do przetwarzania pełnotekstowego dla sekcji cytatów, z ręcznym przeglądem.',
  },
  {
    id: 'risk-3',
    title: 'Brak akceptacji działu prawnego klienta dla wariantu hybrydowego',
    probability: 'medium',
    impact: 'critical',
    category: 'legal',
    mitigation:
      'Wstępna konsultacja z radcą klienta przed formalnym złożeniem wariantu. ' +
      'Przygotowana opinia zewnętrznej kancelarii na temat pseudonimizacji.',
    contingency:
      'Natychmiastowe przejście na wariant A (pełna migracja) z uruchomionym budżetem rezerwowym.',
  },
  {
    id: 'risk-4',
    title: 'Niedoszacowanie kosztu utrzymania własnej instancji',
    probability: 'medium',
    impact: 'medium',
    category: 'business',
    mitigation:
      'Model kosztowy zweryfikowany przez dział finansowy, 20% bufor na pierwsze 12 miesięcy. ' +
      'Przegląd rzeczywistych kosztów po 3 miesiącach od uruchomienia.',
    contingency:
      'Renegocjacja stawki z dostawcą infrastruktury lub konsolidacja z instancją produkcyjną.',
  },
];

const MOCK_COMMENTS = [
  {
    id: 'cmt-1',
    content:
      'Przeanalizowałam wariant pełnej migracji pod kątem due diligence obu klientów. ' +
      'Wariant A zdejmuje wszystkie trzy zastrzeżenia zgłoszone przez ich dział prawny. ' +
      'Wariant B zamyka dwa z trzech — zostaje kwestia formalnej rezydencji danych.',
    authorId: 'user-anna',
    authorName: 'Anna Kowalska',
    createdAt: '2026-07-14T10:20:00Z',
    likes: 4,
    likedByMe: true,
  },
  {
    id: 'cmt-2',
    content:
      'Od strony platformy: 6 tygodni jest realne pod warunkiem, że nie wchodzimy w tym ' +
      'samym oknie z przebudową kolejek. Proponuję rozdzielić to na dwa etapy — ' +
      'najpierw rezydencja danych, dopiero potem optymalizacja przepustowości.',
    authorId: 'user-marek',
    authorName: 'Marek Zieliński',
    createdAt: '2026-07-15T09:05:00Z',
    likes: 2,
  },
  {
    id: 'cmt-3',
    content:
      'Analiza AI: na podstawie 14 podobnych decyzji w historii portfela, wariant A ma ' +
      'najwyższy stosunek wartości do ryzyka przy horyzoncie 24-miesięcznym. Główny czynnik ' +
      'ryzyka: koncentracja pracy zespołu platformowego w jednym oknie. Pewność rekomendacji: 84%.',
    authorId: 'ai-assistant',
    authorName: 'Asystent AI',
    createdAt: '2026-07-16T07:40:00Z',
    likes: 6,
    isAIGenerated: true,
  },
  {
    id: 'cmt-4',
    content:
      'Finanse: budżet 168 tys. mieści się w rezerwie programu, ale wymaga przesunięcia ' +
      'z puli na rozwój narzędzi w Q4. Potrzebuję decyzji do 5 sierpnia, żeby zdążyć ' +
      'z korektą planu przed komitetem.',
    authorId: 'user-kasia',
    authorName: 'Katarzyna Nowak',
    createdAt: '2026-07-17T13:55:00Z',
    likes: 1,
  },
];

const MOCK_LINKED_ITEMS = [
  {
    id: 'link-1',
    type: 'initiative',
    title: 'Program zgodności danych klienckich 2026',
    status: 'W realizacji',
    priority: 'high',
  },
  {
    id: 'link-2',
    type: 'task',
    title: 'Audyt lokalizacji danych u obecnego dostawcy',
    status: 'Zakończone',
    priority: 'high',
  },
  {
    id: 'link-3',
    type: 'task',
    title: 'Wycena instancji dedykowanej we Frankfurcie',
    status: 'W realizacji',
    priority: 'medium',
  },
  {
    id: 'link-4',
    type: 'decision',
    title: 'Wybór dostawcy infrastruktury dla obciążeń AI',
    status: 'Zatwierdzone',
    priority: 'high',
  },
  {
    id: 'link-5',
    type: 'risk',
    title: 'Opóźnienie certyfikacji blokujące przetargi publiczne',
    status: 'Monitorowane',
    priority: 'high',
  },
];

const MOCK_ATTACHMENTS = [
  {
    id: 'att-1',
    name: 'Analiza_rezydencji_danych_EU.pdf',
    type: 'application/pdf',
    size: 3128400,
    url: '/attachments/att-1',
    uploadedAt: '2026-07-12T09:15:00Z',
    uploadedBy: 'Anna Kowalska',
  },
  {
    id: 'att-2',
    name: 'Model_kosztowy_warianty_A_B_C.xlsx',
    type: 'application/vnd.ms-excel',
    size: 918600,
    url: '/attachments/att-2',
    uploadedAt: '2026-07-15T11:40:00Z',
    uploadedBy: 'Katarzyna Nowak',
  },
  {
    id: 'att-3',
    name: 'Opinia_kancelarii_pseudonimizacja.pdf',
    type: 'application/pdf',
    size: 642300,
    url: '/attachments/att-3',
    uploadedAt: '2026-07-16T16:05:00Z',
    uploadedBy: 'Marek Zieliński',
  },
];

const MOCK_STAKEHOLDERS = [
  {
    id: 'stk-1',
    decisionId: DECISION_ID,
    userId: 'user-piotr-demo',
    userName: 'Piotr Wiśniewski',
    userEmail: 'piotr.wisniewski@dbr77.com',
    role: 'accountable',
    notificationSettings: {
      enabled: true,
      triggers: ['on_status_change', 'on_deadline_approaching'],
      emailEnabled: true,
      inAppEnabled: true,
      integrationChannels: ['teams'],
      syncTargets: ['msteams:zarzad-programu'],
    },
  },
  {
    id: 'stk-2',
    decisionId: DECISION_ID,
    userId: 'user-anna',
    userName: 'Anna Kowalska',
    userEmail: 'anna.kowalska@dbr77.com',
    role: 'responsible',
    notificationSettings: {
      enabled: true,
      triggers: ['on_status_change'],
      emailEnabled: true,
      inAppEnabled: true,
      integrationChannels: [],
      syncTargets: [],
    },
  },
  {
    id: 'stk-3',
    decisionId: DECISION_ID,
    userId: 'user-marek',
    userName: 'Marek Zieliński',
    userEmail: 'marek.zielinski@dbr77.com',
    role: 'consulted',
    notificationSettings: {
      enabled: true,
      triggers: ['on_comment'],
      emailEnabled: false,
      inAppEnabled: true,
      integrationChannels: [],
      syncTargets: [],
    },
  },
  {
    id: 'stk-4',
    decisionId: DECISION_ID,
    userId: 'user-kasia',
    userName: 'Katarzyna Nowak',
    userEmail: 'katarzyna.nowak@dbr77.com',
    role: 'informed',
    notificationSettings: {
      enabled: false,
      triggers: [],
      emailEnabled: false,
      inAppEnabled: true,
      integrationChannels: [],
      syncTargets: [],
    },
  },
];

const MOCK_DECISION = {
  id: DECISION_ID,
  title: 'Rezydencja danych wywiadowczych — wybór modelu przetwarzania',
  description:
    'Dwaj klienci enterprise zablokowali odbiór etapu na due diligence, wskazując na brak ' +
    'gwarancji rezydencji danych z wywiadów w granicach EOG. Musimy wybrać między pełną ' +
    'migracją na dedykowaną instancję w EU, modelem hybrydowym z pseudonimizacją, ' +
    'a utrzymaniem status quo z aneksem umownym. Decyzja wpływa na 4 aktywne projekty ' +
    'i na możliwość startu w przetargach publicznych w 2027.',
  status: 'pending',
  workflowStatus: 'review',
  priority: 'high',
  category: 'strategic',
  dueDate: '2026-08-05T00:00:00Z',
  decisionDate: null,
  createdAt: '2026-07-10T08:00:00Z',
  updatedAt: '2026-07-18T15:30:00Z',
  rationale:
    'Decyzję trzeba zamknąć do 5 sierpnia, bo zwłoka kosztuje więcej niż różnica między ' +
    'wariantami.\n\n' +
    'Podstawa: zwłoka blokuje odbiór etapu w dwóch projektach o łącznej wartości 1,4 mln PLN ' +
    'i wstrzymuje podpisanie aneksu z trzecim klientem. Każdy tydzień opóźnienia to ok. ' +
    '32 000 PLN niezafakturowanej pracy (ZAŁOŻENIE: 2,3 etatu konsultanta × 5 dni × ' +
    '2 800 PLN dziennej stawki rozliczeniowej — rozliczenie programu za II kw. 2026).\n\n' +
    'Termin twardy wynika z komitetu inwestycyjnego 5 sierpnia: po tej dacie budżet na ' +
    'wariant A wypada z rezerwy programu i wraca dopiero w planie na 2027.\n\n' +
    'Uczciwa niepewność: nie znamy jeszcze stanowiska kancelarii w sprawie pseudonimizacji. ' +
    'Jeśli przyjdzie przed 5 sierpnia i będzie pozytywne, rekomendacja zmienia się na wariant B.',
  requestedByName: 'Anna Kowalska',
  deciderId: 'user-piotr-demo',
  projectName: 'Program zgodności danych klienckich 2026',
  contextDetails:
    'Faza wyboru architektury po zakończeniu audytu lokalizacji danych i wycenie wariantów. ' +
    'Rekomendacja zespołu: wariant A (pełna migracja do EU).',
  selectedAlternativeId: 'alt-1',
  alternatives: MOCK_ALTERNATIVES,
  risks: MOCK_RISKS,
  comments: MOCK_COMMENTS,
  linkedItems: MOCK_LINKED_ITEMS,
  attachments: MOCK_ATTACHMENTS,
};

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

const MOCK_HISTORY = [
  {
    id: 'hist-1',
    action: 'created',
    userName: 'Anna Kowalska',
    createdAt: '2026-07-10T08:00:00Z',
    details: 'Utworzono decyzję po audycie lokalizacji danych',
  },
  {
    id: 'hist-2',
    action: 'commented',
    userName: 'Marek Zieliński',
    createdAt: '2026-07-15T09:05:00Z',
    details: 'Zgłoszono zastrzeżenie do okna migracyjnego',
  },
  {
    id: 'hist-3',
    action: 'status_changed',
    userName: 'Piotr Wiśniewski',
    createdAt: '2026-07-18T15:30:00Z',
    details: 'Przeniesiono do etapu recenzji',
  },
];

// ★ NAPRAWA (2026-08-30, tor grafiki): `DecisionDetailView.loadDecision()` NIE
// wywołuje `Api.getDecision(id)` — realny caller to `Api.get('/decisions/:id/detail')`
// (zwraca proxy, gdzie `.data` = rekord). Stary patch łatał metodę, której komponent
// nigdy nie woła, więc `detailResponse.data` trafiał w siatkę bezpieczeństwa
// (`window.fetch` → `{data:[],items:[]}`) i karta renderowała się PUSTA (tytuł
// placeholder, „Ta sekcja jest jeszcze pusta") niezależnie od treści MOCK_DECISION.
// `Api.getDecision` zostaje (nieużywany przez ten komponent, ale nieszkodliwy —
// inne miejsca w apce mogą go wołać przez ten sam singleton).
Api.getDecision = (async () => MOCK_DECISION) as typeof Api.getDecision;
Api.getDecisionHistory = (async () => MOCK_HISTORY) as typeof Api.getDecisionHistory;

/**
 * `?dane=pelne` — Piotr nigdy nie ocenia pustej karty (CLAUDE.md #7). Domyślnie
 * (bez parametru) rekord ma tylko opis i kontekst — sekcje, które w produkcie
 * zapełnia Teresa po kliknięciu AI (Alternatywy = „Decision Option Analyzer",
 * RACI = „RACI Team Advisor") albo dodaje człowiek (Ryzyka, Komentarze,
 * Załączniki, Powiązania) zostają puste, tak jak świeża decyzja bez pracy.
 * Z parametrem — komplet treści z MOCK_DECISION/MOCK_* powyżej (bez zmian —
 * to ta sama polska historia: rezydencja danych wywiadowczych, 2 klientów
 * enterprise, termin 5 sierpnia).
 */
const __danePelne = __danePelneWczesnie;
const MOCK_DECISION_EFEKTYWNY = __danePelne
  ? MOCK_DECISION
  : {
      ...MOCK_DECISION,
      alternatives: [],
      selectedAlternativeId: '',
      risks: [],
      comments: [],
      linkedItems: [],
      attachments: [],
    };
const MOCK_STAKEHOLDERS_EFEKTYWNY = __danePelne ? MOCK_STAKEHOLDERS : [];

const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url === '/users') return { users: MOCK_USERS };
  if (url.includes(`/decisions/${DECISION_ID}/detail`)) return { data: MOCK_DECISION_EFEKTYWNY };
  if (url.includes('/stakeholders')) return { stakeholders: MOCK_STAKEHOLDERS_EFEKTYWNY };
  return realApiGet(url);
}) as typeof Api.get;

// Siatka bezpieczeństwa: cokolwiek jeszcze ten ciężki komponent odpali przy
// montowaniu (obecność, powiadomienia, podpowiedzi AI…) dostaje pusty payload
// zamiast uderzać w nieistniejący backend dev-render i wywalać w konsoli błąd
// parsowania JSON z ciała HTML. Pliki i18n (/locales/**) przechodzą do realnego fetcha.
const g = window as unknown as { __KARTA_DECISION_FETCH__?: boolean };
// ★ Router instalujemy TYLKO gdy TEN ekran jest wybrany w adresie.
// main.tsx importuje WSZYSTKIE ekrany naraz, wiec bez tego warunku siedem
// routerow podmienia window.fetch jeden po drugim; ostatni jest najbardziej
// zewnetrzny i odpowiada WLASNYM fallbackiem zamiast oddac sterowanie dalej.
// Skutek przed poprawka: karta-initiative dostawala koperte obcego ekranu.
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'karta-decision';
if (__tenEkran && !g.__KARTA_DECISION_FETCH__) {
  g.__KARTA_DECISION_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/decisions/') || url.includes('/users')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function KartaDecisionScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <DecisionDetailView
            key={`karta-decision-${DECISION_ID}`}
            decisionId={DECISION_ID}
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaDecisionScreen;

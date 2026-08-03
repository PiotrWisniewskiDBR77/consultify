/**
 * dev-render host for the REAL `<InterviewWorkspace>` — karta "Interview
 * Session" (SPEC-A powłoka NModeShell, archetyp zbliżony do C · Rekord).
 *
 * `InterviewWorkspace` (src/components/Interview/InterviewWorkspace.tsx) jest
 * komponentem PRODUKCYJNYM — nic tu nie jest przepisane ani udawane.
 * Komponent sam fetchuje dane w `loadSession()`:
 *   V8InterviewApi.getSession(id)  → sesja
 *   Api.get('/interview/sessions/:id/questions' | '/notes' | '/evidence'
 *           | '/summary' | '/linked-items')
 *   Api.get('/interview/context')  → profil firmy
 * Zarówno `Api`, jak i `V8InterviewApi` to zwykłe eksportowane obiekty
 * (`export const ... = {...}`), więc podmiana metody łata ten sam singleton,
 * który importuje każdy moduł (wzorzec z dev-render/screens/decision-record.tsx
 * i melscanvas-workspace.tsx).
 *
 * DLACZEGO WŁASNE DANE, A NIE WBUDOWANE `createInterviewDemoDataset`:
 * komponent ma własny zestaw demo, ale (a) jest w całości po angielsku,
 * (b) wchodzi tylko dla id z prefiksem `demo-interview` (`isInterviewDemoId`).
 * Karta ma być materiałem do odbioru po polsku, więc podajemy realne id sesji
 * i karmimy produkcyjną ścieżkę ładowania polskimi danymi. Trust-guard
 * komponentu („nigdy nie podstawiaj demo pod realną sesję") jest przez to
 * zachowany — nie mieszamy dwóch źródeł.
 *
 * DWIE ŚWIADOME DECYZJE DOTYCZĄCE KSZTAŁTU MOCKA (istotne przy odbiorze):
 *  1. `runtimeModeDefault: 'task_list'` — bo tylko tryb `task_list` /
 *     `conversational` renderuje powłokę `NModeShell` (Menu 1 + prawy panel).
 *     Tryb `single_question` renderuje pełnoekranowy runtime BEZ powłoki.
 *  2. BRAK `assignmentId` — efekt wyboru trybu (linia ~672) wymusza
 *     `single_question` dla KAŻDEJ sesji z przypisaniem. Karta z powłoką i
 *     karta z przypisaniem wykluczają się w obecnym kodzie; wybieramy powłokę.
 *     Skutkiem ubocznym pola „Szablon"/„Termin" w prawym panelu pokazują „-",
 *     a akcja „Wyślij do przeglądu" nie wchodzi — to opisane w raporcie.
 *
 * URL: ?screen=karta-interview[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { InterviewWorkspace } from '../../src/components/Interview/InterviewWorkspace';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { V8InterviewApi } from '../../src/services/api/v8/interview';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const SESSION_ID = 'interview-dbr77-spawalnia-2026';

// ==========================================
// SESJA
// ==========================================

const MOCK_SESSION = {
  id: SESSION_ID,
  organizationId: 'org-dbr77-demo',
  projectId: 'proj-dbr77-spawalnia',
  name: 'Wywiad diagnostyczny — robotyzacja spawalni, Metalpol Kielce',
  ownerId: 'user-piotr-demo',
  status: 'in_progress',
  progress: {},
  totalQuestions: 14,
  answeredQuestions: 9,
  runtimeModeDefault: 'task_list',
  startedAt: '2026-07-06T09:15:00Z',
  lastActivityAt: '2026-07-20T16:42:00Z',
  templateName: 'Diagnoza gotowości do automatyzacji (DRD v3)',
  summaryFacts: [],
  summaryGaps: [],
  summaryConstraints: [],
  summaryPainPoints: [],
};

// ==========================================
// PYTANIA (5 kategorii — takie same jak CATEGORY_ORDER)
// ==========================================

type Q = {
  id: string;
  category: string;
  questionText: string;
  answerText: string;
  status: string;
  confidenceScore: number;
  isRequired?: boolean;
  contextNote?: string;
  sortOrder: number;
};

const RAW_QUESTIONS: Q[] = [
  // --- STRATEGIA ---
  {
    id: 'q-str-1',
    category: 'strategy',
    questionText: 'Jaki jest cel biznesowy stojący za robotyzacją spawalni?',
    answerText:
      'Zarząd zakontraktował na 2027 r. dwa duże zlecenia OEM (ramy podwozi, ok. 42 tys. szt./rok). ' +
      'Obecna spawalnia domyka maksymalnie 26 tys. szt./rok na trzy zmiany. Celem nie jest redukcja ' +
      'etatów, tylko zdjęcie sufitu przepustowości bez budowy drugiej hali.',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'q-str-2',
    category: 'strategy',
    questionText: 'Kto jest sponsorem projektu i jaki ma mandat decyzyjny?',
    answerText:
      'Sponsor: Marek Zieliński, Dyrektor Operacyjny — mandat do 1,8 mln zł bez uchwały zarządu. ' +
      'Powyżej tej kwoty wymagana zgoda rady nadzorczej (posiedzenia kwartalne, najbliższe 12.09.2026).',
    status: 'answered',
    confidenceScore: 4,
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: 'q-str-3',
    category: 'strategy',
    questionText: 'Jakie są kryteria sukcesu wdrożenia z perspektywy zarządu i jak będą mierzone?',
    answerText: '',
    status: 'not_started',
    confidenceScore: 0,
    isRequired: true,
    contextNote:
      'Do dopytania na warsztacie 28.07 — Marek deklarował, że „to zależy od finansów". Bez twardych ' +
      'kryteriów nie da się zdefiniować bramki odbioru.',
    sortOrder: 3,
  },

  // --- OPERACJE ---
  {
    id: 'q-ops-1',
    category: 'operations',
    questionText: 'Jak wygląda obecny przebieg procesu spawania — od pobrania detalu do kontroli?',
    answerText:
      'Pobranie z buforowego regału (wózek widłowy, ok. 6 min) → pozycjonowanie w przyrządzie ręcznym ' +
      '(11 min) → spawanie MAG przez operatora (18-24 min zależnie od wariantu) → studzenie ' +
      '→ kontrola wizualna 100% + badanie penetracyjne co 10. sztuka. Cykl brutto: 47-58 min.',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'q-ops-2',
    category: 'operations',
    questionText: 'Jaki jest obecny poziom braków i jakie są ich główne przyczyny?',
    answerText:
      'Braki wewnętrzne 4,1% (dane z SPC za H1 2026). Dominują: niepełny przetop przy narożniku ' +
      'wspornika (ok. 58% braków) i odkształcenia po spawaniu wymagające prostowania (27%). ' +
      'Reklamacje klienta: 0,3%, ale jedna w czerwcu kosztowała 84 tys. zł kary umownej.',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: 'q-ops-3',
    category: 'operations',
    questionText: 'Ile wariantów detali przechodzi przez spawalnię i jak często zmienia się mix?',
    answerText:
      'W kartotece 61 indeksów, ale 80% wolumenu to 9 indeksów. Przezbrojenie przyrządu: 35-50 min, ' +
      'średnio 4 przezbrojenia na zmianę.',
    status: 'answered',
    confidenceScore: 4,
    sortOrder: 3,
  },
  {
    id: 'q-ops-4',
    category: 'operations',
    questionText:
      'Jakie są rzeczywiste dostępności maszyn (OEE) na gnieździe spawalniczym w ostatnich 12 miesiącach?',
    answerText:
      'Utrzymanie ruchu podało 71% wstępnie, ale liczone bez postojów na przezbrojenia. ' +
      'Poproszono o surowy eksport z systemu — obiecany do 24.07.',
    status: 'in_progress',
    confidenceScore: 2,
    isRequired: true,
    contextNote:
      'Liczba 71% niewiarygodna — nie używać w raporcie do czasu weryfikacji na surowych danych.',
    sortOrder: 4,
  },

  // --- CYFRYZACJA ---
  {
    id: 'q-dig-1',
    category: 'digital',
    questionText: 'Jakie systemy IT/OT są dziś w użyciu i jak wymieniają dane?',
    answerText:
      'ERP: Comarch XL (moduły produkcja + gospodarka magazynowa). Brak MES. Zlecenia drukowane na ' +
      'papierze, meldunki zwrotne wprowadzane ręcznie przez mistrza raz na zmianę. Sterowniki ' +
      'spawarek Fronius nie są podpięte do żadnej sieci.',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'q-dig-2',
    category: 'digital',
    questionText: 'Czy istnieje dokumentacja 3D detali i przyrządów w wersji aktualnej?',
    answerText:
      'Modele 3D detali: tak, SolidWorks, aktualne. Przyrządy spawalnicze: tylko rysunki 2D z 2014-2019 r., ' +
      'a co najmniej trzy przyrządy były modyfikowane na hali bez aktualizacji dokumentacji.',
    status: 'answered',
    confidenceScore: 4,
    sortOrder: 2,
  },
  {
    id: 'q-dig-3',
    category: 'digital',
    questionText: 'Kto po stronie klienta odpowiada za integrację OT i jakie ma zasoby?',
    answerText: '',
    status: 'needs_follow_up',
    confidenceScore: 0,
    contextNote:
      'Klient wskazał firmę zewnętrzną (Automatyka-Serwis), ale nie ma umowy ramowej ani SLA. ' +
      'Ryzyko własnościowe dla utrzymania po wdrożeniu.',
    sortOrder: 3,
  },

  // --- LUDZIE ---
  {
    id: 'q-ppl-1',
    category: 'people',
    questionText: 'Ilu jest spawaczy z uprawnieniami i jaka jest struktura wieku?',
    answerText:
      '17 spawaczy z aktualnymi uprawnieniami PN-EN ISO 9606-1. Średnia wieku 49 lat, ' +
      'sześciu nabywa uprawnienia emerytalne w ciągu 4 lat. Od 2023 r. nie udało się zatrudnić ' +
      'żadnego spawacza poniżej 30. roku życia mimo trzech kampanii rekrutacyjnych.',
    status: 'answered',
    confidenceScore: 5,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'q-ppl-2',
    category: 'people',
    questionText: 'Jaki jest stosunek załogi i związków zawodowych do automatyzacji?',
    answerText:
      'Rozmowa z przewodniczącym OPZZ (p. Sylwester Bąk): brak sprzeciwu wobec robotyzacji jako takiej, ' +
      'warunek to pisemna gwarancja braku zwolnień grupowych przez 24 mies. Załoga na hali raczej ' +
      'sceptyczna — pamiętają nieudane wdrożenie cel zrobotyzowanych w 2018 r. (robot stoi do dziś).',
    status: 'answered',
    confidenceScore: 4,
    isRequired: true,
    sortOrder: 2,
  },
  {
    id: 'q-ppl-3',
    category: 'people',
    questionText: 'Kto będzie programował i utrzymywał stanowisko zrobotyzowane po odbiorze?',
    answerText: '',
    status: 'not_started',
    confidenceScore: 0,
    isRequired: true,
    contextNote: 'Kluczowe dla oceny ryzyka — bez odpowiedzi powtórzy się scenariusz z 2018 r.',
    sortOrder: 3,
  },

  // --- FINANSE ---
  {
    id: 'q-fin-1',
    category: 'finance',
    questionText: 'Jaki jest dostępny budżet CAPEX i w jakim horyzoncie?',
    answerText:
      'Zatwierdzone 1,8 mln zł na 2026/2027 z podziałem 60/40. Klient liczy na dofinansowanie ' +
      'z FENG (ścieżka SMART, moduł „Wdrożenie innowacji") — wniosek nie został jeszcze złożony.',
    status: 'answered',
    confidenceScore: 4,
    isRequired: true,
    sortOrder: 1,
  },
  {
    id: 'q-fin-2',
    category: 'finance',
    questionText: 'Jaki jest oczekiwany okres zwrotu i próg akceptacji inwestycji?',
    answerText:
      'CFO deklaruje maksymalnie 4 lata prostego payback. Przy obecnym koszcie roboczogodziny ' +
      '(87 zł brutto obciążone) i wolumenie z kontraktu OEM próg wygląda na osiągalny, ' +
      'ale zależy od tego, co wyjdzie z weryfikacji OEE.',
    status: 'in_progress',
    confidenceScore: 3,
    isRequired: true,
    sortOrder: 2,
  },
];

const MOCK_QUESTIONS = RAW_QUESTIONS.map((q) => ({
  ...q,
  sessionId: SESSION_ID,
  answerType: 'text',
  allowVoice: true,
  allowFileUpload: true,
  allowUrl: true,
  allowContextNote: true,
  answeredBy: q.status === 'answered' ? 'user-piotr-demo' : undefined,
  answeredAt: q.status === 'answered' ? '2026-07-20T16:42:00Z' : undefined,
  tags: [],
  isTemplate: false,
}));

// ==========================================
// NOTATKI
// ==========================================

const MOCK_NOTES = [
  {
    id: 'note-1',
    sessionId: SESSION_ID,
    category: 'operations',
    title: 'Obserwacja z gemba — narożnik wspornika',
    content:
      'Podczas obchodu hali 14.07 trzech różnych spawaczy wykonywało narożnik wspornika w trzech ' +
      'różnych sekwencjach ściegów. Instrukcja WPS wisi przy stanowisku, ale jest z 2016 r. i nie ' +
      'odpowiada obecnej geometrii detalu. To najprawdopodobniej pierwotna przyczyna 58% braków, ' +
      'a nie „czynnik ludzki", jak twierdzi kierownik produkcji.',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-14T13:20:00Z',
    updatedAt: '2026-07-14T13:20:00Z',
  },
  {
    id: 'note-2',
    sessionId: SESSION_ID,
    category: 'people',
    title: 'Wdrożenie z 2018 r. — do rozbrojenia przed rekomendacją',
    content:
      'Robot z 2018 r. stoi nieużywany, bo nikt nie potrafi go przeprogramować po odejściu ' +
      'integratora. Załoga traktuje to jako dowód, że „roboty u nas nie działają". Każda ' +
      'rekomendacja musi jawnie adresować kompetencje utrzymaniowe, inaczej zostanie odrzucona ' +
      'niezależnie od jakości uzasadnienia finansowego.',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-15T09:05:00Z',
    updatedAt: '2026-07-18T11:30:00Z',
  },
  {
    id: 'note-3',
    sessionId: SESSION_ID,
    category: 'strategy',
    title: 'Do weryfikacji: czy kontrakt OEM jest podpisany',
    content:
      'Cała teza o zdjęciu sufitu przepustowości stoi na kontrakcie 42 tys. szt./rok. ' +
      'Marek mówi „zakontraktowane", ale nie pokazał umowy — możliwe, że to LOI. ' +
      'Poprosić o dokument przed warsztatem 28.07.',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-19T15:48:00Z',
    updatedAt: '2026-07-19T15:48:00Z',
  },
];

// ==========================================
// DOWODY (pliki, linki, komentarze, audio)
// ==========================================

const MOCK_EVIDENCE = [
  {
    id: 'ev-1',
    sessionId: SESSION_ID,
    questionId: 'q-ops-2',
    category: 'operations',
    evidenceType: 'file',
    name: 'SPC_spawalnia_H1_2026.xlsx',
    title: 'Karty kontrolne SPC — spawalnia, I półrocze 2026',
    description: 'Eksport z systemu jakości, przekazany przez p. Nowak (Kontrola Jakości) 12.07.',
    fileSize: 486_912,
    fileType: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-12T10:14:00Z',
    createdAt: '2026-07-12T10:14:00Z',
  },
  {
    id: 'ev-2',
    sessionId: SESSION_ID,
    questionId: 'q-ops-1',
    category: 'operations',
    evidenceType: 'file',
    name: 'gniazdo_spawalnicze_layout.pdf',
    title: 'Layout hali — gniazdo spawalnicze z wymiarami',
    description:
      'Rysunek z 2021 r. Zweryfikowany na hali — zgodny poza dostawioną szafą narzędziową.',
    fileSize: 2_310_400,
    fileType: 'pdf',
    mimeType: 'application/pdf',
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-14T08:40:00Z',
    createdAt: '2026-07-14T08:40:00Z',
  },
  {
    id: 'ev-3',
    sessionId: SESSION_ID,
    questionId: 'q-fin-1',
    category: 'finance',
    evidenceType: 'link',
    name: 'FENG — ścieżka SMART, moduł Wdrożenie innowacji',
    title: 'Warunki naboru FENG (PARP)',
    url: 'https://www.parp.gov.pl/component/grants/grants/sciezka-smart',
    description:
      'Nabór do 30.10.2026, intensywność wsparcia dla średniego przedsiębiorstwa: do 40%.',
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-16T12:02:00Z',
    createdAt: '2026-07-16T12:02:00Z',
  },
  {
    id: 'ev-4',
    sessionId: SESSION_ID,
    questionId: 'q-ppl-2',
    category: 'people',
    evidenceType: 'audio',
    name: 'rozmowa_zwiazki_2026-07-15.m4a',
    title: 'Rozmowa ze związkami zawodowymi (fragment, 6:41)',
    transcriptText:
      'Nie jesteśmy przeciwko robotom. Jesteśmy przeciwko temu, żeby ktoś przyjechał, postawił ' +
      'żelastwo i pojechał, a my zostaniemy z tym sami — tak jak w osiemnastym roku.',
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-15T14:55:00Z',
    createdAt: '2026-07-15T14:55:00Z',
  },
  {
    id: 'ev-5',
    sessionId: SESSION_ID,
    questionId: 'q-ops-4',
    category: 'operations',
    evidenceType: 'comment',
    name: 'Zastrzeżenie do danych OEE',
    description:
      'Podane 71% nie obejmuje przezbrojeń ani mikroprzestojów. Do czasu otrzymania surowego ' +
      'eksportu traktować jako niepotwierdzone — nie cytować w raporcie końcowym.',
    uploadedBy: 'user-piotr-demo',
    uploadedAt: '2026-07-20T16:42:00Z',
    createdAt: '2026-07-20T16:42:00Z',
  },
];

// ==========================================
// PROFIL FIRMY (endpoint /interview/context)
// ==========================================

const MOCK_CONTEXT = {
  companyName: 'Metalpol Kielce Sp. z o.o.',
  industry: 'Konstrukcje stalowe / poddostawca motoryzacyjny',
  companySize: 'Średnie przedsiębiorstwo',
  location: 'Kielce, woj. świętokrzyskie',
  employeeCount: 212,
  annualRevenue: '148 mln zł (2025)',
};

// ==========================================
// PODSUMOWANIE — TYLKO FAKTY (bez rekomendacji, zgodnie z zasadą komponentu)
// ==========================================

const MOCK_SUMMARY = {
  facts: [
    'Obecna przepustowość spawalni: 26 tys. szt./rok na trzy zmiany.',
    'Kontrakt OEM na 2027 r. zakłada 42 tys. szt./rok (dokument niezweryfikowany).',
    'Braki wewnętrzne 4,1%, z czego 58% to niepełny przetop narożnika wspornika.',
    '17 spawaczy z uprawnieniami, średnia wieku 49 lat, 6 odejść emerytalnych w ciągu 4 lat.',
    'Budżet CAPEX zatwierdzony: 1,8 mln zł, mandat DO bez uchwały zarządu.',
    'Brak MES; meldunki zwrotne wprowadzane ręcznie raz na zmianę.',
  ],
  gaps: [
    'Brak kryteriów sukcesu wdrożenia zdefiniowanych przez zarząd.',
    'Brak wiarygodnych danych OEE (podane 71% liczone bez przezbrojeń).',
    'Nieustalona odpowiedzialność za programowanie i utrzymanie po odbiorze.',
    'Brak umowy ramowej/SLA z firmą wskazaną do integracji OT.',
  ],
  constraints: [
    'Wydatek powyżej 1,8 mln zł wymaga rady nadzorczej — najbliższe posiedzenie 12.09.2026.',
    'Warunek związków zawodowych: pisemna gwarancja braku zwolnień grupowych przez 24 mies.',
    'Wniosek FENG do złożenia przed 30.10.2026, inaczej odpada 40% dofinansowania.',
    'Dokumentacja przyrządów spawalniczych tylko 2D i częściowo nieaktualna.',
  ],
  painPoints: [
    'Nieudane wdrożenie robota w 2018 r. — stanowisko nieużywane do dziś, brak kompetencji utrzymaniowych.',
    'Instrukcja WPS z 2016 r. niezgodna z obecną geometrią detalu; trzech spawaczy, trzy sekwencje ściegów.',
    'Jedna reklamacja klienta w czerwcu 2026 kosztowała 84 tys. zł kary umownej.',
    'Zero skutecznych rekrutacji spawaczy poniżej 30 lat od 2023 r. mimo trzech kampanii.',
  ],
};

// ==========================================
// POWIĄZANE OBIEKTY
// ==========================================

const MOCK_LINKED_ITEMS = [
  {
    id: 'init-spawalnia-1',
    edgeId: 'edge-1',
    type: 'initiative',
    title: 'Gniazdo zrobotyzowane — ramy podwozi (faza koncepcji)',
    status: 'in_progress',
  },
  {
    id: 'task-oee-1',
    edgeId: 'edge-2',
    type: 'task',
    title: 'Pozyskać surowy eksport OEE z systemu utrzymania ruchu',
    status: 'in_progress',
  },
  {
    id: 'decision-scope-1',
    edgeId: 'edge-3',
    type: 'decision',
    title: 'Zakres wdrożenia: jedno gniazdo pilotażowe czy dwa równolegle',
    status: 'pending',
  },
];

// ==========================================
// PODMIANA ŹRÓDEŁ DANYCH (produkcyjne singletony)
// ==========================================

V8InterviewApi.getSession = (async () => ({
  session: MOCK_SESSION,
})) as unknown as typeof V8InterviewApi.getSession;

const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url.includes(`/interview/sessions/${SESSION_ID}/questions`)) return MOCK_QUESTIONS;
  if (url.includes(`/interview/sessions/${SESSION_ID}/notes`)) return MOCK_NOTES;
  if (url.includes(`/interview/sessions/${SESSION_ID}/evidence`)) return MOCK_EVIDENCE;
  if (url.includes(`/interview/sessions/${SESSION_ID}/summary`)) return MOCK_SUMMARY;
  if (url.includes(`/interview/sessions/${SESSION_ID}/linked-items`)) return MOCK_LINKED_ITEMS;
  if (url.includes('/interview/context')) return MOCK_CONTEXT;
  if (url.includes(`/interview/sessions/${SESSION_ID}`)) return MOCK_SESSION;
  return realApiGet(url);
}) as typeof Api.get;

// Siatka bezpieczeństwa: cokolwiek jeszcze ten ciężki komponent odpali przy
// montowaniu (presence, powiadomienia, wyszukiwarka powiązań, sugestie AI)
// dostaje pusty payload zamiast uderzać w serwer vite dev-render i wywalać
// błąd parsowania JSON z ciała HTML. Tłumaczenia (/locales/**) przechodzą
// do prawdziwego fetcha. Wzorzec 1:1 z dev-render/screens/decision-record.tsx.
const g = window as unknown as { __KARTA_INTERVIEW_FETCH__?: boolean };
// ★ Router instalujemy TYLKO gdy TEN ekran jest wybrany w adresie.
// main.tsx importuje WSZYSTKIE ekrany naraz, wiec bez tego warunku siedem
// routerow podmienia window.fetch jeden po drugim; ostatni jest najbardziej
// zewnetrzny i odpowiada WLASNYM fallbackiem zamiast oddac sterowanie dalej.
// Skutek przed poprawka: karta-initiative dostawala koperte obcego ekranu.
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'karta-interview';
if (__tenEkran && !g.__KARTA_INTERVIEW_FETCH__) {
  g.__KARTA_INTERVIEW_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/interview/')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function KartaInterviewScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <InterviewWorkspace
            key={`interview-${SESSION_ID}`}
            sessionId={SESSION_ID}
            projectId="proj-dbr77-spawalnia"
            onClose={() => {}}
            onComplete={() => {}}
            onSessionChange={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaInterviewScreen;

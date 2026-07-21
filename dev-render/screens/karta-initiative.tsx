/**
 * KARTA INITIATIVE — dev-render host for the REAL Initiative artefakt
 * (archetyp C·Rekord, SPEC-A). Mounts `<InitiativeDocumentView>`
 * (src/components/Initiatives/InitiativeDocumentView.tsx) — the canonical full
 * initiative view (src/components/Initiatives/index.ts: "P11 contract §2.7 —
 * InitiativeDocumentView is the canonical full view"). The component already
 * implements the SPEC-A shell inline (NModeHeader = Menu 1,
 * InitiativeContext.Provider, N-mode canvas + right accordion panel), so it is
 * mounted directly, like any real screen.
 *
 * ── DLACZEGO NIE ŚCIEŻKA `init-showcase-*` ────────────────────────────────
 * `InitiativeDocumentView.fetchAll()` short-circuits ids starting with
 * `init-showcase-` to an in-memory fixture (`initiativesDemoData.ts`). Wygodne,
 * ale WSZYSTKIE blueprinty w tym pliku są PO ANGIELSKU ("Margin Leakage
 * Recovery Sprint", "Recover pricing and claims leakage…") i są zapiekane w
 * module — nie da się ich nadpisać z zewnątrz bez edycji pliku produkcyjnego,
 * czego to zadanie zabrania (8 agentów pracuje równolegle w tym worktree).
 *
 * Dlatego ten ekran jedzie ŚCIEŻKĄ PRODUKCYJNĄ (id BEZ prefiksu showcase):
 * komponent robi realny `V8PlanningApi.getInitiative()` + ~20 równoległych
 * fetchy pobocznych, a my podstawiamy ROUTER `window.fetch`, który serwuje
 * polskie dane doradcze w dokładnie tych kopertach, których oczekują warstwy
 * API. To ta sama logika renderowania co na produkcji — mockiem jest wyłącznie
 * transport HTTP.
 *
 * ── KOPERTY (łatwo tu o cichy błąd) ───────────────────────────────────────
 * `v8Get()` (src/services/api/v8/client.ts:11-22) rozpakowuje ZEWNĘTRZNĄ
 * kopertę `{ data: T }`, a każde `V8PlanningApi.getX()` czyta potem NAZWANY
 * klucz z wnętrza `T` — np. `getHistory` robi
 * `v8Get<{events:[]}>(...).then(data => data.events)`. Klucz musi więc siedzieć
 * WEWNĄTRZ `data`, nie obok niego: `{data:{events:[…]}}`, nigdy
 * `{data:[],events:[…]}` (to drugie daje `undefined`, nie `[]`, i przewraca
 * `initiativeNSections` przy `history.length`). Zwykłe `Api.get()`
 * (/decisions, /tasks, /users) czyta płaską kopertę bez `data`.
 *
 * KOLEJNOŚĆ DOPASOWAŃ MA ZNACZENIE: '/status-history' musi być sprawdzone
 * PRZED '/history' (substring!), a gołe `/planning/initiatives/<id>` na końcu,
 * po wszystkich pod-ścieżkach.
 */
import React from 'react';

import { InitiativeDocumentView } from '../../src/components/Initiatives/InitiativeDocumentView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// Celowo BEZ prefiksu `init-showcase-` — chcemy realną ścieżkę fetchową.
const INITIATIVE_ID = 'init-showcase-knowledge-hub-rollout'; // short-circuit demo-data w komponencie (initiativesDemoData.ts:179) — bez routera fetch

const daysFromNow = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

// ── OSOBY (realny zespół doradczy + strona klienta) ────────────────────────
const USERS = [
  {
    id: 'user-piotr-demo',
    name: 'Piotr Wiśniewski',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
  },
  {
    id: 'user-anna-kowalczyk',
    name: 'Anna Kowalczyk',
    firstName: 'Anna',
    lastName: 'Kowalczyk',
    email: 'a.kowalczyk@nordfood.pl',
  },
  {
    id: 'user-marek-zielinski',
    name: 'Marek Zieliński',
    firstName: 'Marek',
    lastName: 'Zieliński',
    email: 'm.zielinski@nordfood.pl',
  },
  {
    id: 'user-katarzyna-nowak',
    name: 'Katarzyna Nowak',
    firstName: 'Katarzyna',
    lastName: 'Nowak',
    email: 'k.nowak@nordfood.pl',
  },
  {
    id: 'user-tomasz-baran',
    name: 'Tomasz Baran',
    firstName: 'Tomasz',
    lastName: 'Baran',
    email: 't.baran@dbr77.com',
  },
];

// ── INICJATYWA ────────────────────────────────────────────────────────────
const INITIATIVE = {
  id: INITIATIVE_ID,
  title: 'Skrócenie przezbrojeń linii pakowania L3 (SMED)',
  name: 'Skrócenie przezbrojeń linii pakowania L3 (SMED)',
  status: 'IN_PROGRESS',
  priority: 'high',
  progress: 42,
  axis: 'operational',
  level: 'quick_win',
  ownerId: 'user-marek-zielinski',
  sponsorId: 'user-anna-kowalczyk',
  organizationId: 'org-dbr77-demo',
  riskScore: 46,
  valueScore: 81,
  expectedRoi: 210,
  estimatedBudget: '185000',
  budget: 185000,
  currency: 'PLN',
  plannedStartDate: daysFromNow(-38),
  plannedEndDate: daysFromNow(72),
  targetDate: daysFromNow(72),
  estimatedDurationMonths: 4,
  createdAt: daysFromNow(-52),
  updatedAt: daysFromNow(-2),
  tags: ['SMED', 'OEE', 'linia L3', 'lean', 'quick win'],

  summary:
    'Skrócenie średniego czasu przezbrojenia linii pakowania L3 z 96 do 45 minut, aby odblokować ' +
    'dodatkowe zdolności produkcyjne bez inwestycji w nową linię.',
  description:
    'Inicjatywa obejmuje pełen cykl SMED na linii L3: nagranie i rozbiór wideo trzech przezbrojeń, ' +
    'rozdzielenie czynności wewnętrznych od zewnętrznych, standaryzację wózka narzędziowego oraz ' +
    'przeszkolenie trzech zmian. Zakres celowo ograniczony do jednej linii i dwóch rodzin SKU, ' +
    'żeby zweryfikować efekt w jednym kwartale przed decyzją o rozszerzeniu na L1, L2 i L4.',

  problemDefinition: {
    symptom:
      'Przezbrojenia na L3 trwają średnio 96 minut przy normie zakładowej 60 minut, a rozrzut między ' +
      'zmianami sięga 40 minut. Planowanie kompensuje to dłuższymi seriami, przez co rosną zapasy ' +
      'wyrobu gotowego i spada elastyczność wobec zamówień promocyjnych sieci handlowych.',
    rootCause:
      'Brak standardu przezbrojenia — każda zmiana pracuje wg własnej praktyki. Czynności możliwe do ' +
      'wykonania przy pracującej maszynie (przygotowanie formatu, kompletacja narzędzi, pobranie folii) ' +
      'wykonywane są po zatrzymaniu linii. Narzędzia nie mają wyznaczonych miejsc, a szukanie kluczy ' +
      'i podkładek zajmuje w obserwacjach 11-18 minut na przezbrojenie.',
    costOfInaction:
      'Przy 14 przezbrojeniach tygodniowo strata to ok. 8,4 godziny dostępności linii tygodniowo, ' +
      'czyli ok. 1,9 mln PLN utraconej marży pokrycia rocznie. Utrzymanie status quo oznacza też ' +
      'konieczność powrotu do wniosku CAPEX na czwartą linię w budżecie 2027.',
  },
  marketContext:
    'Dwie największe sieci handlowe skróciły horyzont zamówień promocyjnych z 6 do 3 tygodni. ' +
    'Bez krótszych przezbrojeń zakład nie jest w stanie obsłużyć krótkich serii bez kar za ' +
    'niedostarczenie i nadgodzin weekendowych.',

  targetState: {
    description:
      'Przezbrojenie L3 wykonywane wg jednego standardu przez wszystkie trzy zmiany\n' +
      'Czynności zewnętrzne przygotowane przed zatrzymaniem linii, wózek SMED skompletowany\n' +
      'Czas przezbrojenia mierzony automatycznie z MES i przeglądany na odprawie zmianowej',
    successCriteria: [
      'Średni czas przezbrojenia ≤ 45 minut w trzech kolejnych tygodniach pomiaru',
      'Rozrzut między zmianami poniżej 10 minut',
      'OEE linii L3 powyżej 72% (dziś 61%)',
      'Standard SMED zatwierdzony przez kierownika produkcji i wdrożony na trzech zmianach',
    ],
    deliverables: [
      'Analiza wideo trzech przezbrojeń z rozbiorem czynności',
      'Karta standardu przezbrojenia L3 (wersja na halę, A3)',
      'Projekt i wykonanie wózka narzędziowego SMED',
      'Program szkolenia operatorów + lista obecności trzech zmian',
      'Raport końcowy z pomiarem po wdrożeniu i rekomendacją rozszerzenia',
    ],
  },
  deliverablesDone: [true, true, false, false, false],

  scope: {
    inScope: [
      'Linia pakowania L3',
      'Rodziny SKU: kubki 400 g i 500 g',
      'Trzy zmiany produkcyjne',
      'Przezbrojenia formatowe i smakowe',
    ],
    outScope: [
      'Linie L1, L2 i L4 (osobna decyzja po pilotażu)',
      'Wymiana sterowania linii i modernizacja PLC',
      'Renegocjacja umów z dostawcami folii',
      'Zmiana systemu premiowego operatorów',
    ],
  },
  killCriteria: [
    'Brak danych z MES o czasach przezbrojeń przez dwa kolejne tygodnie',
    'Niedostępność operatorów na szkolenia w oknie sierpniowym',
    'Efekt po pilotażu poniżej 15% skrócenia czasu',
  ],

  resourceTools: ['MES Proficy', 'Consultify Process Flow', 'Kamera Sony + statyw', 'MS Teams'],

  milestones: [
    {
      id: 'ms-1',
      name: 'Nagranie i rozbiór trzech przezbrojeń',
      date: daysFromNow(-24),
      actualDate: daysFromNow(-22),
      status: 'completed',
      description: 'Materiał wideo z trzech zmian, rozbiór na 47 czynności elementarnych.',
    },
    {
      id: 'ms-2',
      name: 'Warsztat SMED z zespołem produkcyjnym',
      date: daysFromNow(-9),
      actualDate: daysFromNow(-9),
      status: 'completed',
      description: 'Rozdział czynności wewnętrznych i zewnętrznych, 2 dni na hali.',
    },
    {
      id: 'ms-3',
      name: 'Wózek SMED gotowy i odebrany',
      date: daysFromNow(14),
      status: 'in_progress',
      description: 'Wykonanie przez dział utrzymania ruchu wg projektu z warsztatu.',
    },
    {
      id: 'ms-4',
      name: 'Szkolenie trzech zmian zakończone',
      date: daysFromNow(38),
      status: 'pending',
    },
    {
      id: 'ms-5',
      name: 'Pomiar potwierdzający i decyzja o rozszerzeniu',
      date: daysFromNow(70),
      status: 'pending',
      description: 'Bramka: wynik ≤ 45 min otwiera rozszerzenie na L1/L2/L4.',
    },
  ],
};

// ── KPI ───────────────────────────────────────────────────────────────────
const KPIS = [
  {
    id: 'kpi-1',
    initiativeId: INITIATIVE_ID,
    name: 'Średni czas przezbrojenia L3',
    description: 'Mediana z wszystkich przezbrojeń formatowych i smakowych w tygodniu, źródło: MES.',
    category: 'operational',
    unit: 'min',
    baselineValue: 96,
    targetValue: 45,
    currentValue: 71,
    latestValue: 71,
    progressPercentage: 49,
    status: 'ON_TRACK',
    measurementFrequency: 'WEEKLY',
    alertDirection: 'ABOVE',
    isPrimary: true,
    isOnTarget: false,
    sortOrder: 0,
    createdAt: daysFromNow(-38),
  },
  {
    id: 'kpi-2',
    initiativeId: INITIATIVE_ID,
    name: 'OEE linii L3',
    description: 'Dostępność × wydajność × jakość, liczone zmianowo.',
    category: 'operational',
    unit: '%',
    baselineValue: 61,
    targetValue: 72,
    currentValue: 66,
    latestValue: 66,
    progressPercentage: 45,
    status: 'ON_TRACK',
    measurementFrequency: 'WEEKLY',
    alertDirection: 'BELOW',
    isPrimary: false,
    isOnTarget: false,
    sortOrder: 1,
    createdAt: daysFromNow(-38),
  },
  {
    id: 'kpi-3',
    initiativeId: INITIATIVE_ID,
    name: 'Rozrzut czasu między zmianami',
    description: 'Różnica między najszybszą a najwolniejszą zmianą w tygodniu.',
    category: 'operational',
    unit: 'min',
    baselineValue: 40,
    targetValue: 10,
    currentValue: 27,
    latestValue: 27,
    progressPercentage: 43,
    status: 'AT_RISK',
    measurementFrequency: 'WEEKLY',
    alertDirection: 'ABOVE',
    isPrimary: false,
    isOnTarget: false,
    sortOrder: 2,
    createdAt: daysFromNow(-31),
  },
];

// ── RAID ──────────────────────────────────────────────────────────────────
const RAID_ITEMS = [
  {
    id: 'raid-1',
    initiativeId: INITIATIVE_ID,
    type: 'risk',
    title: 'Sezon szczytowy sierpień-wrzesień ogranicza okna na szkolenia',
    description:
      'Plan produkcji na sierpień zakłada obłożenie 94%, co praktycznie wyklucza zatrzymanie linii ' +
      'na szkolenia w dni robocze.',
    status: 'open',
    severity: 'HIGH',
    probability: 'HIGH',
    riskScore: 16,
    scoreCategory: 'high',
    ownerId: 'user-marek-zielinski',
    dueDate: daysFromNow(21),
    mitigationPlan:
      'Szkolenia w soboty w blokach 4-godzinnych, po dwie zmiany na sobotę; zgoda działu HR na ' +
      'rozliczenie nadgodzin uzyskana.',
    responseStrategy: 'mitigate',
    mitigationOwnerId: 'user-katarzyna-nowak',
    mitigationDueDate: daysFromNow(18),
    mitigationStatus: 'in_progress',
    createdAt: daysFromNow(-26),
  },
  {
    id: 'raid-2',
    initiativeId: INITIATIVE_ID,
    type: 'issue',
    title: 'Dane o czasach przezbrojeń z MES niekompletne dla zmiany nocnej',
    description:
      'Operatorzy zmiany nocnej nie zamykają zlecenia w MES bezpośrednio po przezbrojeniu — ' +
      'ok. 30% rekordów ma czas zawyżony o przerwę śniadaniową.',
    status: 'open',
    severity: 'MEDIUM',
    probability: 'HIGH',
    riskScore: 9,
    scoreCategory: 'medium',
    ownerId: 'user-tomasz-baran',
    dueDate: daysFromNow(7),
    mitigationPlan:
      'Do czasu poprawy dyscypliny w MES — pomiar ręczny stoperem przez brygadzistę, arkusz ' +
      'kontrolny na tablicy przy linii.',
    responseStrategy: 'mitigate',
    mitigationStatus: 'in_progress',
    createdAt: daysFromNow(-15),
  },
  {
    id: 'raid-3',
    initiativeId: INITIATIVE_ID,
    type: 'assumption',
    title: 'Utrzymanie ruchu wykona wózek SMED własnymi siłami',
    description:
      'Założono wykonanie w warsztacie zakładowym (koszt materiału ok. 12 000 PLN). Jeśli warsztat ' +
      'nie znajdzie mocy do 15. dnia, potrzebne zlecenie zewnętrzne za ok. 34 000 PLN.',
    status: 'open',
    severity: 'MEDIUM',
    ownerId: 'user-marek-zielinski',
    dueDate: daysFromNow(12),
    createdAt: daysFromNow(-9),
  },
  {
    id: 'raid-4',
    initiativeId: INITIATIVE_ID,
    type: 'dependency',
    title: 'Standaryzacja formatów opakowań (inicjatywa PKG-02)',
    description:
      'Redukcja liczby wariantów formatu z 9 do 6 skraca listę przezbrojeń. Bez tego cel 45 minut ' +
      'jest osiągalny, ale margines jest minimalny.',
    status: 'open',
    severity: 'LOW',
    ownerId: 'user-anna-kowalczyk',
    dueDate: daysFromNow(45),
    createdAt: daysFromNow(-30),
  },
  {
    id: 'raid-5',
    initiativeId: INITIATIVE_ID,
    type: 'risk',
    title: 'Odpływ przeszkolonych operatorów po podwyżkach u konkurencji',
    description:
      'W promieniu 30 km uruchomiono dwa zakłady rekrutujące operatorów pakowania. Rotacja na ' +
      'L3 wzrosła z 8% do 14% rok do roku.',
    status: 'monitoring',
    severity: 'MEDIUM',
    probability: 'MEDIUM',
    riskScore: 6,
    scoreCategory: 'medium',
    ownerId: 'user-katarzyna-nowak',
    dueDate: daysFromNow(60),
    mitigationPlan: 'Szkolić o dwóch operatorów więcej niż minimum obsadowe na każdej zmianie.',
    responseStrategy: 'mitigate',
    mitigationStatus: 'planned',
    createdAt: daysFromNow(-11),
  },
];

// ── ZADANIA ───────────────────────────────────────────────────────────────
const TASKS = [
  {
    id: 'task-1',
    title: 'Nagrać przezbrojenie na zmianie A, B i C',
    description: 'Trzy pełne cykle, kamera z pozycji stałej + druga z ręki przy stole formatu.',
    status: 'DONE',
    priority: 'HIGH',
    dueDate: daysFromNow(-25),
    taskType: 'analysis',
    estimatedHours: 12,
    assigneeId: 'user-tomasz-baran',
    assigneeName: 'Tomasz Baran',
    source: 'manual',
    isMilestone: false,
  },
  {
    id: 'task-2',
    title: 'Rozbiór czynności i klasyfikacja wewnętrzne/zewnętrzne',
    description: '47 czynności elementarnych, arkusz w Consultify Table.',
    status: 'DONE',
    priority: 'HIGH',
    dueDate: daysFromNow(-18),
    taskType: 'analysis',
    estimatedHours: 20,
    assigneeId: 'user-piotr-demo',
    assigneeName: 'Piotr Wiśniewski',
    source: 'manual',
    isMilestone: false,
  },
  {
    id: 'task-3',
    title: 'Warsztat SMED z operatorami trzech zmian',
    description: 'Dwa dni na hali, 11 uczestników, wypracowanie docelowej sekwencji.',
    status: 'DONE',
    priority: 'CRITICAL',
    dueDate: daysFromNow(-9),
    taskType: 'workshop',
    estimatedHours: 32,
    assigneeId: 'user-piotr-demo',
    assigneeName: 'Piotr Wiśniewski',
    source: 'manual',
    isMilestone: true,
    milestoneDate: daysFromNow(-9),
  },
  {
    id: 'task-4',
    title: 'Opracować kartę standardu przezbrojenia (A3 na halę)',
    description: 'Sekwencja czynności, przypisanie ról, zdjęcia punktów krytycznych.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: daysFromNow(5),
    taskType: 'documentation',
    estimatedHours: 16,
    assigneeId: 'user-tomasz-baran',
    assigneeName: 'Tomasz Baran',
    source: 'manual',
    isMilestone: false,
  },
  {
    id: 'task-5',
    title: 'Zaprojektować i wykonać wózek narzędziowy SMED',
    description: 'Obrysy narzędzi, miejsce na komplet formatu, hamulec i zaczep przy L3.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: daysFromNow(14),
    taskType: 'implementation',
    estimatedHours: 40,
    assigneeId: 'user-marek-zielinski',
    assigneeName: 'Marek Zieliński',
    source: 'manual',
    isMilestone: true,
    milestoneDate: daysFromNow(14),
  },
  {
    id: 'task-6',
    title: 'Uzgodnić z HR okna szkoleniowe w soboty',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    dueDate: daysFromNow(9),
    taskType: 'coordination',
    estimatedHours: 6,
    assigneeId: 'user-katarzyna-nowak',
    assigneeName: 'Katarzyna Nowak',
    source: 'manual',
    isMilestone: false,
  },
  {
    id: 'task-7',
    title: 'Przeszkolić operatorów zmiany A',
    status: 'TODO',
    priority: 'HIGH',
    dueDate: daysFromNow(24),
    taskType: 'training',
    estimatedHours: 8,
    assigneeId: 'user-tomasz-baran',
    assigneeName: 'Tomasz Baran',
    source: 'manual',
    isMilestone: false,
  },
  {
    id: 'task-8',
    title: 'Naprawić rejestrację czasów w MES na zmianie nocnej',
    description: 'Wynik z RAID-2 — krótki instruktaż + zmiana kolejności ekranów w terminalu.',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: daysFromNow(7),
    taskType: 'implementation',
    estimatedHours: 10,
    assigneeId: 'user-marek-zielinski',
    assigneeName: 'Marek Zieliński',
    source: 'manual',
    isMilestone: false,
  },
  {
    id: 'task-9',
    title: 'Pomiar potwierdzający — trzy tygodnie po szkoleniach',
    status: 'TODO',
    priority: 'HIGH',
    dueDate: daysFromNow(68),
    taskType: 'analysis',
    estimatedHours: 14,
    assigneeId: 'user-piotr-demo',
    assigneeName: 'Piotr Wiśniewski',
    source: 'manual',
    isMilestone: false,
  },
];

// ── DECYZJE ───────────────────────────────────────────────────────────────
const DECISIONS = [
  {
    id: 'dec-1',
    title: 'Pilotaż tylko na L3 zamiast równolegle na L3 i L4',
    description:
      'Ograniczenie do jednej linii pozwala zamknąć cykl w kwartale i oprzeć decyzję o rozszerzeniu ' +
      'na twardym pomiarze zamiast na deklaracji.',
    decisionType: 'SCOPE',
    status: 'APPROVED',
    priority: 'HIGH',
    decisionOwnerId: 'user-anna-kowalczyk',
    ownerName: 'Anna Kowalczyk',
    requestedByName: 'Piotr Wiśniewski',
    createdAt: daysFromNow(-34),
    source: 'manual',
  },
  {
    id: 'dec-2',
    title: 'Wózek SMED wykonany w warsztacie zakładowym, nie zlecony na zewnątrz',
    description:
      'Oszczędność ok. 22 000 PLN i szybsze poprawki po pierwszym użyciu. Ryzyko: dostępność ' +
      'warsztatu (RAID-3).',
    decisionType: 'RESOURCE',
    status: 'APPROVED',
    priority: 'MEDIUM',
    decisionOwnerId: 'user-marek-zielinski',
    ownerName: 'Marek Zieliński',
    requestedByName: 'Tomasz Baran',
    createdAt: daysFromNow(-8),
    source: 'manual',
  },
  {
    id: 'dec-3',
    title: 'Czy podnieść cel z 45 na 38 minut po wynikach warsztatu?',
    description:
      'Sekwencja wypracowana na warsztacie daje teoretycznie 38 minut. Zespół produkcyjny ostrzega, ' +
      'że to nie zostawia marginesu na awarie formatu. Do rozstrzygnięcia na przeglądzie sponsora.',
    decisionType: 'GENERAL',
    status: 'PENDING',
    priority: 'MEDIUM',
    decisionOwnerId: 'user-anna-kowalczyk',
    ownerName: 'Anna Kowalczyk',
    requestedByName: 'Piotr Wiśniewski',
    dueDate: daysFromNow(6),
    createdAt: daysFromNow(-3),
    source: 'manual',
  },
];

// ── ZESPÓŁ / ZASOBY ───────────────────────────────────────────────────────
const RESOURCES = [
  {
    id: 'res-1',
    initiativeId: INITIATIVE_ID,
    userId: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    name: 'Piotr Wiśniewski',
    role: 'Lider projektu (DBR77)',
    allocationPercentage: 40,
    startDate: daysFromNow(-38),
    endDate: daysFromNow(72),
  },
  {
    id: 'res-2',
    initiativeId: INITIATIVE_ID,
    userId: 'user-tomasz-baran',
    firstName: 'Tomasz',
    lastName: 'Baran',
    name: 'Tomasz Baran',
    role: 'Konsultant lean (DBR77)',
    allocationPercentage: 60,
    startDate: daysFromNow(-38),
    endDate: daysFromNow(50),
  },
  {
    id: 'res-3',
    initiativeId: INITIATIVE_ID,
    userId: 'user-marek-zielinski',
    firstName: 'Marek',
    lastName: 'Zieliński',
    name: 'Marek Zieliński',
    role: 'Kierownik produkcji (właściciel)',
    allocationPercentage: 25,
    startDate: daysFromNow(-38),
    endDate: daysFromNow(72),
  },
  {
    id: 'res-4',
    initiativeId: INITIATIVE_ID,
    userId: 'user-katarzyna-nowak',
    firstName: 'Katarzyna',
    lastName: 'Nowak',
    name: 'Katarzyna Nowak',
    role: 'HR — szkolenia i obsada zmian',
    allocationPercentage: 10,
    startDate: daysFromNow(-20),
    endDate: daysFromNow(45),
    notes: 'Zaangażowana wyłącznie w okno szkoleniowe.',
  },
];

const BUDGET_ITEMS = [
  {
    id: 'bud-1',
    initiativeId: INITIATIVE_ID,
    category: 'consulting',
    costType: 'OPEX',
    amount: 96000,
    currency: 'PLN',
    description: 'Wsparcie doradcze DBR77 — analiza, warsztat, raport końcowy',
  },
  {
    id: 'bud-2',
    initiativeId: INITIATIVE_ID,
    category: 'equipment',
    costType: 'CAPEX',
    amount: 12000,
    currency: 'PLN',
    description: 'Materiały na wózek SMED i oprzyrządowanie formatu',
  },
  {
    id: 'bud-3',
    initiativeId: INITIATIVE_ID,
    category: 'training',
    costType: 'OPEX',
    amount: 48000,
    currency: 'PLN',
    description: 'Szkolenia sobotnie trzech zmian wraz z nadgodzinami',
  },
  {
    id: 'bud-4',
    initiativeId: INITIATIVE_ID,
    category: 'other',
    costType: 'OPEX',
    amount: 29000,
    currency: 'PLN',
    description: 'Rezerwa na zlecenie wózka na zewnątrz (scenariusz z RAID-3)',
  },
];

const TOOLS = [
  {
    id: 'tool-1',
    initiativeId: INITIATIVE_ID,
    name: 'MES Proficy — moduł raportowania przezbrojeń',
    category: 'software',
    vendor: 'GE Digital',
    licenseCost: 0,
    licenseType: 'existing',
    status: 'active',
    notes: 'Licencja zakładowa, wymaga tylko konfiguracji nowego raportu.',
  },
  {
    id: 'tool-2',
    initiativeId: INITIATIVE_ID,
    name: 'Consultify — Process Flow i Table',
    category: 'software',
    vendor: 'DBR77',
    licenseCost: 0,
    licenseType: 'subscription',
    status: 'active',
  },
  {
    id: 'tool-3',
    initiativeId: INITIATIVE_ID,
    name: 'Zestaw do nagrań (kamera + statyw + oświetlenie)',
    category: 'hardware',
    vendor: 'wypożyczenie',
    licenseCost: 1800,
    licenseType: 'rental',
    status: 'planned',
  },
];

const INTANGIBLE_ASSETS = [
  {
    id: 'int-1',
    initiativeId: INITIATIVE_ID,
    assetType: 'knowledge',
    name: 'Standard przezbrojenia L3 (karta A3)',
    description: 'Wypracowany na warsztacie, do wykorzystania jako wzorzec dla pozostałych linii.',
    cost: 0,
    currency: 'PLN',
    status: 'in_progress',
  },
  {
    id: 'int-2',
    initiativeId: INITIATIVE_ID,
    assetType: 'training',
    name: 'Program szkolenia SMED dla operatorów pakowania',
    description: 'Moduł 4-godzinny, powtarzalny przy wdrożeniu na L1/L2/L4 oraz przy onboardingu.',
    cost: 14000,
    currency: 'PLN',
    status: 'planned',
  },
];

// ── INTERESARIUSZE / OBSERWUJĄCY ──────────────────────────────────────────
const STAKEHOLDERS = [
  {
    id: 'sth-1',
    userId: 'user-marek-zielinski',
    name: 'Marek Zieliński',
    firstName: 'Marek',
    lastName: 'Zieliński',
    email: 'm.zielinski@nordfood.pl',
    raciType: 'R',
  },
  {
    id: 'sth-2',
    userId: 'user-anna-kowalczyk',
    name: 'Anna Kowalczyk',
    firstName: 'Anna',
    lastName: 'Kowalczyk',
    email: 'a.kowalczyk@nordfood.pl',
    raciType: 'A',
  },
  {
    id: 'sth-3',
    userId: 'user-katarzyna-nowak',
    name: 'Katarzyna Nowak',
    firstName: 'Katarzyna',
    lastName: 'Nowak',
    email: 'k.nowak@nordfood.pl',
    raciType: 'C',
  },
  {
    id: 'sth-4',
    userId: 'user-tomasz-baran',
    name: 'Tomasz Baran',
    firstName: 'Tomasz',
    lastName: 'Baran',
    email: 't.baran@dbr77.com',
    raciType: 'C',
  },
  {
    id: 'sth-5',
    userId: 'user-piotr-demo',
    name: 'Piotr Wiśniewski',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    raciType: 'I',
  },
];

const WATCHERS = [
  {
    id: 'w-1',
    initiativeId: INITIATIVE_ID,
    userId: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    createdAt: daysFromNow(-38),
  },
  {
    id: 'w-2',
    initiativeId: INITIATIVE_ID,
    userId: 'user-katarzyna-nowak',
    firstName: 'Katarzyna',
    lastName: 'Nowak',
    email: 'k.nowak@nordfood.pl',
    createdAt: daysFromNow(-20),
  },
];

// ── KOMENTARZE ────────────────────────────────────────────────────────────
const COMMENTS = [
  {
    id: 'com-1',
    content:
      'Po rozbiorze wideo widać, że 31 z 47 czynności da się wykonać przy pracującej linii. To samo ' +
      'w sobie daje ok. 34 minuty, jeszcze przed jakąkolwiek zmianą techniczną.',
    authorId: 'user-piotr-demo',
    authorName: 'Piotr Wiśniewski',
    createdAt: daysFromNow(-17),
    likes: 4,
    likedByMe: true,
  },
  {
    id: 'com-2',
    content:
      'Zmiana B robi to od dawna po swojemu i ma najlepsze czasy. Warto oprzeć standard na ich ' +
      'sekwencji, zamiast pisać go od zera — łatwiej to sprzedać pozostałym zmianom.',
    authorId: 'user-marek-zielinski',
    authorName: 'Marek Zieliński',
    createdAt: daysFromNow(-12),
    likes: 6,
    likedByMe: false,
  },
  {
    id: 'com-3',
    content:
      'Uwaga do celu 38 minut: przy takim napięciu pierwsza awaria formatu wywróci wynik i zespół ' +
      'straci wiarę w standard. Rekomenduję zostać przy 45 i wrócić do tematu po pierwszym pomiarze.',
    authorId: 'user-tomasz-baran',
    authorName: 'Tomasz Baran',
    createdAt: daysFromNow(-3),
    likes: 3,
    likedByMe: false,
  },
  {
    id: 'com-4',
    content:
      'Soboty szkoleniowe wstępnie zaklepane — 16 i 23 sierpnia, po dwie zmiany dziennie. Czekam na ' +
      'potwierdzenie liczby uczestników do piątku.',
    authorId: 'user-katarzyna-nowak',
    authorName: 'Katarzyna Nowak',
    createdAt: daysFromNow(-1),
    likes: 2,
    likedByMe: false,
  },
];

// ── HISTORIA ──────────────────────────────────────────────────────────────
const HISTORY_EVENTS = [
  {
    id: 'h-1',
    initiativeId: INITIATIVE_ID,
    eventType: 'initiative_created',
    actorId: 'user-piotr-demo',
    createdAt: daysFromNow(-52),
    notes: 'Inicjatywa utworzona z wniosku po przeglądzie OEE zakładu.',
  },
  {
    id: 'h-2',
    initiativeId: INITIATIVE_ID,
    eventType: 'field_changed',
    actorId: 'user-anna-kowalczyk',
    createdAt: daysFromNow(-38),
    oldValue: 'PLANNING',
    newValue: 'IN_PROGRESS',
    notes: 'Zatwierdzenie budżetu 185 000 PLN i start prac.',
  },
  {
    id: 'h-3',
    initiativeId: INITIATIVE_ID,
    eventType: 'field_changed',
    actorId: 'user-piotr-demo',
    createdAt: daysFromNow(-34),
    oldValue: 'L3 + L4',
    newValue: 'L3',
    notes: 'Zawężenie zakresu do jednej linii (decyzja DEC-1).',
  },
  {
    id: 'h-4',
    initiativeId: INITIATIVE_ID,
    eventType: 'kpi_updated',
    actorId: 'user-tomasz-baran',
    createdAt: daysFromNow(-10),
    oldValue: '84',
    newValue: '71',
    notes: 'Średni czas przezbrojenia po pierwszych zmianach organizacyjnych.',
  },
  {
    id: 'h-5',
    initiativeId: INITIATIVE_ID,
    eventType: 'progress_updated',
    actorId: 'user-marek-zielinski',
    createdAt: daysFromNow(-2),
    oldValue: '35',
    newValue: '42',
    notes: 'Warsztat zamknięty, karta standardu w opracowaniu.',
  },
];

const STATUS_HISTORY = [
  {
    id: 'sh-1',
    initiativeId: INITIATIVE_ID,
    fromStatus: 'DRAFT',
    toStatus: 'PLANNING',
    changedBy: 'user-piotr-demo',
    changedByFirstName: 'Piotr',
    changedByLastName: 'Wiśniewski',
    reason: 'Wstępna kwalifikacja jako quick win po przeglądzie OEE.',
    gateType: null,
    createdAt: daysFromNow(-48),
  },
  {
    id: 'sh-2',
    initiativeId: INITIATIVE_ID,
    fromStatus: 'PLANNING',
    toStatus: 'IN_PROGRESS',
    changedBy: 'user-anna-kowalczyk',
    changedByFirstName: 'Anna',
    changedByLastName: 'Kowalczyk',
    reason: 'Budżet zatwierdzony, zespół obsadzony, bramka G2 zamknięta.',
    gateType: 'G2',
    createdAt: daysFromNow(-38),
  },
];

/**
 * UWAGA — `capabilities` NIE jest ozdobnikiem. Komponent wyprowadza z tego bloku
 * WSZYSTKIE uprawnienia edycyjne:
 *   canEditCards = gateReadiness?.capabilities?.cards?.canEditCards  (linia 1331)
 *   canUseAi     = gateReadiness?.capabilities?.ctaBar?.canUseAi     (linia 1332)
 *   canEditPriority/Owner/TargetDate ← capabilities.topBar           (linie 1323-1326)
 * Bez tego bloku wszystko jest `undefined` → `!!undefined` = false → karta
 * renderuje się CAŁA w trybie tylko-do-odczytu: tytuł zablokowany, kafle bez
 * edycji, AI wyszarzone, kebab bez Archiwizuj/Usuń. Ekran wyglądałby wtedy na
 * "zepsuty", choć to byłby wyłącznie artefakt zubożonego mocka — dlatego
 * podajemy pełne uprawnienia, jakie ma właściciel inicjatywy w toku.
 */
const GATE_READINESS = {
  currentStatus: 'IN_PROGRESS',
  userRoles: ['owner', 'sponsor'],
  availableTransitions: [
    {
      targetStatus: 'COMPLETED',
      gate: 'G4',
      requiredRoles: ['sponsor'],
      assignedApprovers: [{ gateRole: 'sponsor', userId: 'user-anna-kowalczyk' }],
      canCurrentUserExecute: false,
      hasAssignedApprover: true,
    },
    {
      targetStatus: 'ON_HOLD',
      gate: null,
      requiredRoles: ['owner'],
      assignedApprovers: [{ gateRole: 'owner', userId: 'user-marek-zielinski' }],
      canCurrentUserExecute: true,
      hasAssignedApprover: true,
    },
  ],
  capabilities: {
    version: 1,
    source: 'backend' as const,
    topBar: { canEditPriority: true, canEditOwner: true, canEditTargetDate: true },
    cards: { canEditCards: true, reasonCode: null },
    reasonCodes: {
      topBar: { priority: null, owner: null, targetDate: null },
      cards: { edit: null },
      ai: { use: null },
    },
    ctaBar: {
      workflowActions: [
        { targetStatus: 'COMPLETED', gate: 'G4' },
        { targetStatus: 'ON_HOLD', gate: null },
      ],
      contextCreateActions: ['task', 'decision', 'raid'],
      canUseAi: true,
    },
  },
  // Lista kontrolna bramki G4 — mieszanka zaliczonych i niezaliczonych, żeby
  // widok gotowości nie był sztucznie zielony.
  readiness: [
    { key: 'owner_assigned', label: 'Właściciel przypisany', pass: true, severity: 'blocking' },
    { key: 'sponsor_assigned', label: 'Sponsor przypisany', pass: true, severity: 'blocking' },
    { key: 'kpi_defined', label: 'KPI zdefiniowane z wartością bazową', pass: true, severity: 'blocking' },
    { key: 'budget_approved', label: 'Budżet zatwierdzony', pass: true, severity: 'blocking' },
    {
      key: 'raid_reviewed',
      label: 'Otwarte ryzyka wysokie mają plan mitygacji',
      pass: false,
      severity: 'warning',
      suggestedAction: 'Domknąć plan dla RAID-1 (okna szkoleniowe w sezonie szczytowym)',
      suggestedActor: 'Marek Zieliński',
    },
    {
      key: 'benefits_measured',
      label: 'Pomiar potwierdzający wykonany',
      pass: false,
      severity: 'blocking',
      suggestedAction: 'Wykonać pomiar po szkoleniach (zadanie zaplanowane)',
      suggestedActor: 'Piotr Wiśniewski',
    },
  ],
  allBlocking: false,
  allWarnings: false,
};

const GATE_ROLES = [
  {
    id: 'gr-1',
    initiativeId: INITIATIVE_ID,
    gateRole: 'sponsor',
    userId: 'user-anna-kowalczyk',
    firstName: 'Anna',
    lastName: 'Kowalczyk',
    email: 'a.kowalczyk@nordfood.pl',
    assignedBy: 'user-piotr-demo',
    assignedAt: daysFromNow(-38),
    source: 'explicit',
  },
  {
    id: 'gr-2',
    initiativeId: INITIATIVE_ID,
    gateRole: 'owner',
    userId: 'user-marek-zielinski',
    firstName: 'Marek',
    lastName: 'Zieliński',
    email: 'm.zielinski@nordfood.pl',
    assignedBy: 'user-piotr-demo',
    assignedAt: daysFromNow(-38),
    source: 'explicit',
  },
];

// ── ROUTER FETCH ──────────────────────────────────────────────────────────
const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** Koperta V8: nazwany klucz MUSI siedzieć wewnątrz `data`. */
const v8 = (payload: Record<string, unknown>): Response => json({ data: payload });

/** Neutralna koperta na wszystko, czego świadomie nie obsługujemy. */
const V8_EMPTY = {
  initiative: null,
  dependencies: [],
  watchers: [],
  stakeholders: [],
  roles: [],
  history: [],
  events: [],
  comments: [],
  readiness: null,
  resources: [],
  kpis: [],
  budgetItems: [],
  tools: [],
  intangibleAssets: [],
  items: [],
};

const g = window as unknown as { __KARTA_INITIATIVE_FETCH__?: boolean };
if (!g.__KARTA_INITIATIVE_FETCH__) {
  g.__KARTA_INITIATIVE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // i18n idzie do prawdziwego backendu vite — inaczej ekran wyszedłby po angielsku.
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    // Zapisy (autosave odpala się ~3 s po montażu) kwitujemy bez efektu.
    const method = String(init?.method || 'GET').toUpperCase();
    if (method !== 'GET' && url.includes('/api/')) return json({ data: {}, success: true });

    if (url.includes('/api/v8/')) {
      // UWAGA: '/status-history' PRZED '/history' — inaczej substring zje pierwsze.
      if (url.includes('/status-history')) return v8({ history: STATUS_HISTORY });
      if (url.includes('/gate-readiness-check')) return v8({ readiness: GATE_READINESS });
      if (url.includes('/gate-roles')) return v8({ roles: GATE_ROLES });
      if (url.includes('/task-dependencies')) return v8({ dependencies: [] });
      if (url.includes('/intangible-assets')) return v8({ intangibleAssets: INTANGIBLE_ASSETS });
      if (url.includes('/budget-items')) return v8({ budgetItems: BUDGET_ITEMS });
      if (url.includes('/stakeholders')) return v8({ stakeholders: STAKEHOLDERS });
      if (url.includes('/watchers')) return v8({ watchers: WATCHERS });
      if (url.includes('/resources')) return v8({ resources: RESOURCES });
      if (url.includes('/comments')) return v8({ comments: COMMENTS });
      if (url.includes('/history')) return v8({ events: HISTORY_EVENTS });
      if (url.includes('/tools')) return v8({ tools: TOOLS });
      if (url.includes('/kpis')) return v8({ kpis: KPIS });
      if (url.includes('/raid')) return v8({ items: RAID_ITEMS });
      // Gołe `/planning/initiatives/<id>` — po wszystkich pod-ścieżkach.
      if (url.includes('/planning/initiatives/')) return v8({ initiative: INITIATIVE });
      return v8(V8_EMPTY);
    }

    if (url.includes('/api/')) {
      if (url.includes('/decisions')) {
        // Wariant `type=GATE_APPROVAL` pyta o oczekujące zatwierdzenia bramki —
        // tu żadnych nie ma, więc pusta lista (inaczej DEC-3 udawałaby approval).
        if (url.includes('GATE_APPROVAL')) return json({ decisions: [] });
        return json({ decisions: DECISIONS });
      }
      if (url.includes('/tasks')) return json({ tasks: TASKS });
      if (url.includes('/users')) return json({ users: USERS });
      // `organizations: []` domyka OrgContext (src/contexts/OrgContext.tsx:92
      // robi `data.organizations || data || []`, a potem `.find()` — bez tego
      // klucza `.find` leci na obiekcie koperty i hałasuje w konsoli).
      return json({ data: [], items: [], events: [], organizations: [] });
    }

    return realFetch(input as RequestInfo, init);
  };
}

export function KartaInitiativeScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <InitiativeDocumentView
            key={`karta-initiative-${INITIATIVE_ID}`}
            initiativeId={INITIATIVE_ID}
            sourceModule="initiatives"
            onBack={() => {}}
            onStatusChange={() => {}}
            onOpenTask={() => {}}
            onOpenDecision={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default KartaInitiativeScreen;

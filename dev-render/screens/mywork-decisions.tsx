/**
 * dev-render host dla `mywork-decisions` — REALNY `<MyWorkHub>` na zakładce
 * `decisions` (Decyzje), montujący REALNY `<DecisionsPanelContent>`
 * (MyWorkHub.tsx:4202). Wzorzec 1:1 z `mywork-inbox.tsx` (patrz tam po
 * uzasadnienie mechaniki: MemoryRouter+navigate zamiast <Route>, bo
 * `parseMyWorkPathIntent()` w hubie czyta `location.pathname` bezpośrednio).
 *
 * PIERWSZY W HISTORII wpis harnessu dla tego ekranu (dyżur 2026-09-03,
 * pomiar "dziewięć ekranów bez wpisu"). `DecisionsPanelContent` to następca
 * dwunastu kolejek decyzyjnych wycofanych z produkcji — żywy, osiągalny
 * (MyWorkHub.tsx:135 import, :4202 mount), nigdy dotąd niezmierzony ani
 * niepokazany właścicielowi.
 *
 * Zawartość zakładki renderuje `<DecisionsPanelContent>`
 * (src/components/MyWork/DecisionsPanelContent.tsx). Jedyne wywołania
 * ładujące dane przy mount:
 *   - `Api.getDecisions()` (linia 827) — zwraca TABLICĘ decyzji wprost
 *     (`setDecisions(Array.isArray(data) ? data : [])`), zero koperty.
 *   - `Api.getUsers()` (linia 848) — do dropdowna delegacji (RowActions).
 * Klik w wiersz (poza zakresem statycznego zrzutu, ale kontrakt trzymamy)
 * odpala `Api.getDecision(id)` + `Api.get('/my-work/decisions/:id/brief')`
 * (linie 869/877) — oba mockowane realnym rekordem z tej samej listy, żeby
 * podgląd nie wybuchł, gdyby ktoś kliknął podczas ręcznej inspekcji.
 *
 * Osiem decyzji z tego samego uniwersum demo co `mywork-inbox.tsx`/
 * `karta-task.tsx` (klienci Grupa Termika/NordFarm/Bielmar/Kolej Wschodnia,
 * inicjatywa DRD, zespół Piotr/Anna/Marek/Kasia) — ciągłość między ekranami
 * odbioru. Rozkład pokrywa TRZY liczniki zakładki (MyWorkHub.tsx:973-982):
 * `decisionOwnerId === currentUser.id` (Piotr, user-piotr-demo) → "Moje";
 * `requestedById === currentUser.id && decisionOwnerId !== currentUser.id`
 * → "Oczekujące"; oraz pełen wachlarz statusów/priorytetów/typów, żeby
 * kolumny (typ z ikoną, status EntityStatusChip, priorytet PriorityChip,
 * termin z podświetleniem overdue) miały co pokazać.
 *
 * ZGŁOSZENIE (znalezione przy budowie tego ekranu, potwierdzone identycznie
 * w `mywork-calendar.tsx`): `getInitialMyWorkTab()` wyznacza pierwszą
 * zakładkę wyłącznie z `searchParams`, więc świeże wejście na
 * `/my-work/decisions` montuje na chwilę `<InboxContent>` (domyślny
 * fallback 'inbox') PRZED przejęciem ekranu przez zakładkę Decyzje —
 * zmarnowane wywołanie sieciowe przy każdym deep-linku spoza Skrzynki.
 * Bez mocka `V8MyWorkApi.getCanonicalInboxTable`/`getCanonicalInboxStats`
 * ten przelotowy montaż kończy się `console.error('Failed to load inbox')`
 * + toastem błędu widocznym na zrzucie. Mockujemy więc (poniżej) pustą, ale
 * poprawnie ukształtowaną odpowiedzią — tak zachowałby się realny backend
 * z pustą skrzynką, bez błędu.
 *
 * URL: ?screen=mywork-decisions[&lang=pl|en][&theme=light|dark]
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

const ORG_ID = 'org-dbr77-demo';
const PIOTR_ID = 'user-piotr-demo';
const ANNA_ID = 'user-anna-demo';
const MAREK_ID = 'user-marek-demo';
const KASIA_ID = 'user-kasia-demo';

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const hoursFromNow = (h: number) => new Date(now + h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86_400_000).toISOString();

interface DemoDecision {
  id: string;
  title: string;
  description?: string;
  decisionType?: string;
  status: string;
  decisionOwnerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: string;
  requestedById?: string;
  requestedByName?: string;
  projectId?: string;
  projectName?: string;
  priority?: string;
  createdAt: string;
  dueDate?: string;
  answer?: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  decidedAt?: string;
  decidedByName?: string;
  rationale?: string;
  escalatedAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
}

const DECISIONS: DemoDecision[] = [
  {
    id: 'decision-drd-automatyzacja-podejscie',
    title: 'Wybór podejścia do automatycznego generowania raportów DRD',
    description:
      'Marek czeka na rekomendację przed warsztatem 29.07 — decyzja blokuje dalszy zakres wdrożenia.',
    decisionType: 'GO_NO_GO',
    status: 'PENDING',
    decisionOwnerId: PIOTR_ID,
    ownerName: 'Piotr Wiśniewski',
    ownerRole: 'Partner',
    requestedById: MAREK_ID,
    requestedByName: 'Marek Zieliński',
    projectId: 'proj-drd-automatyzacja',
    projectName: 'DRD — Automatyzacja raportowania',
    priority: 'CRITICAL',
    createdAt: daysAgo(1),
    dueDate: hoursFromNow(20),
  },
  {
    id: 'decision-termika-budzet-warsztatu',
    title: 'Zatwierdzenie budżetu dodatkowego warsztatu z zarządem — Grupa Termika',
    description:
      'Klient prosi o drugi warsztat scenariuszowy poza pierwotnym zakresem umowy — koszt 18 000 PLN.',
    decisionType: 'BUDGET_APPROVAL',
    status: 'ESCALATED',
    decisionOwnerId: PIOTR_ID,
    ownerName: 'Piotr Wiśniewski',
    ownerRole: 'Partner',
    requestedById: ANNA_ID,
    requestedByName: 'Anna Kowalska',
    projectId: 'proj-termika-q3',
    projectName: 'Grupa Termika Q3',
    priority: 'HIGH',
    createdAt: daysAgo(4),
    dueDate: daysAgo(1),
    escalatedAt: hoursAgo(12),
    lastReminderAt: hoursAgo(36),
    reminderCount: 2,
  },
  {
    id: 'decision-nordfarm-zakres-eksportu',
    title: 'Zmiana zakresu: rezygnacja z eksportu danych magazynowych NordFarm',
    description:
      'Dział IT klienta nie udostępni eksportu w terminie — trzeba zdecydować, czy ciąć zakres, czy przesuwać kamień milowy.',
    decisionType: 'SCOPE_CHANGE',
    status: 'PENDING',
    decisionOwnerId: MAREK_ID,
    ownerName: 'Marek Zieliński',
    ownerRole: 'Manager projektu',
    requestedById: PIOTR_ID,
    requestedByName: 'Piotr Wiśniewski',
    projectId: 'proj-nordfarm-logistyka',
    projectName: 'HurtNord Logistyka — Onboarding',
    priority: 'HIGH',
    createdAt: daysAgo(2),
    dueDate: daysFromNow(3),
  },
  {
    id: 'decision-bielmar-harmonogram',
    title: 'Nowy harmonogram warsztatu z zarządem — Bielmar',
    description: 'Termin minął wczoraj — klient pyta o nowy harmonogram.',
    decisionType: 'SCHEDULE_MILESTONES',
    status: 'PENDING',
    decisionOwnerId: PIOTR_ID,
    ownerName: 'Piotr Wiśniewski',
    ownerRole: 'Partner',
    requestedById: KASIA_ID,
    requestedByName: 'Kasia Nowak',
    projectId: 'proj-bielmar',
    projectName: 'Bielmar',
    priority: 'MEDIUM',
    createdAt: daysAgo(4),
    dueDate: daysAgo(1),
  },
  {
    id: 'decision-kolej-wschodnia-narzedzie-backlog',
    title: 'Wybór narzędzia do zarządzania backlogiem — Kolej Wschodnia',
    description: 'Odłożone do Q4 — nie blokuje bieżącego zakresu.',
    decisionType: 'GENERAL',
    status: 'DEFERRED',
    decisionOwnerId: PIOTR_ID,
    ownerName: 'Piotr Wiśniewski',
    ownerRole: 'Partner',
    requestedById: ANNA_ID,
    requestedByName: 'Anna Kowalska',
    projectId: 'proj-kolej-wschodnia',
    projectName: 'Kolej Wschodnia — Modernizacja',
    priority: 'LOW',
    createdAt: daysAgo(9),
    decidedAt: daysAgo(5),
    decidedByName: 'Piotr Wiśniewski',
    rationale: 'Priorytet Q4 — najpierw domykamy fazę 1 wdrożenia DRD.',
    answer: 'DEFERRED',
  },
  {
    id: 'decision-termika-raport-koncowy-akcept',
    title: 'Akceptacja raportu końcowego — Grupa Termika Q3',
    description: 'Anna zgłosiła raport do akceptu partnera przed wysyłką do klienta.',
    decisionType: 'APPROVAL',
    status: 'APPROVED',
    decisionOwnerId: PIOTR_ID,
    ownerName: 'Piotr Wiśniewski',
    ownerRole: 'Partner',
    requestedById: ANNA_ID,
    requestedByName: 'Anna Kowalska',
    projectId: 'proj-termika-q3',
    projectName: 'Grupa Termika Q3',
    priority: 'HIGH',
    createdAt: daysAgo(6),
    decidedAt: hoursAgo(18),
    decidedByName: 'Piotr Wiśniewski',
    rationale: 'Raport kompletny, liczby zweryfikowane z klientem na warsztacie 21.08.',
    answer: 'APPROVED',
  },
  {
    id: 'decision-bielmar-dostawca-ryzyko',
    title: 'Akceptacja ryzyka: zmiana dostawcy komponentów w trakcie wdrożenia',
    description: 'Zespół Bielmar rekomenduje zmianę dostawcy mimo ryzyka opóźnienia dostaw o 2 tygodnie.',
    decisionType: 'RISK_ACCEPTANCE',
    status: 'REJECTED',
    decisionOwnerId: PIOTR_ID,
    ownerName: 'Piotr Wiśniewski',
    ownerRole: 'Partner',
    requestedById: MAREK_ID,
    requestedByName: 'Marek Zieliński',
    projectId: 'proj-bielmar',
    projectName: 'Bielmar',
    priority: 'MEDIUM',
    createdAt: daysAgo(10),
    decidedAt: daysAgo(7),
    decidedByName: 'Piotr Wiśniewski',
    rationale: 'Ryzyko opóźnienia zbyt wysokie na tym etapie — zostajemy przy obecnym dostawcy.',
    answer: 'REJECTED',
  },
  {
    id: 'decision-nordfarm-zasoby-analityk',
    title: 'Alokacja dodatkowego analityka do fazy diagnozy — NordFarm',
    description: 'Kasia prosi o wsparcie na 2 tygodnie — obecny zespół nie domknie diagnozy w terminie.',
    decisionType: 'RESOURCE_ALLOCATION',
    status: 'PENDING',
    decisionOwnerId: MAREK_ID,
    ownerName: 'Marek Zieliński',
    ownerRole: 'Manager projektu',
    requestedById: KASIA_ID,
    requestedByName: 'Kasia Nowak',
    projectId: 'proj-nordfarm-logistyka',
    projectName: 'HurtNord Logistyka — Onboarding',
    priority: 'MEDIUM',
    createdAt: hoursAgo(20),
    dueDate: daysFromNow(4),
  },
];

const USERS = [
  { id: PIOTR_ID, name: 'Piotr Wiśniewski', email: 'piotr@dbr77.com' },
  { id: ANNA_ID, name: 'Anna Kowalska', email: 'anna@dbr77.com' },
  { id: MAREK_ID, name: 'Marek Zieliński', email: 'marek@dbr77.com' },
  { id: KASIA_ID, name: 'Kasia Nowak', email: 'kasia@dbr77.com' },
];

Api.getDecisions = (async () => DECISIONS) as typeof Api.getDecisions;
Api.getUsers = (async () => USERS) as typeof Api.getUsers;
Api.getDecision = (async (id: string) => {
  const found = DECISIONS.find((d) => d.id === id);
  return found || null;
}) as typeof Api.getDecision;
Api.get = (async (url: string) => {
  if (url.includes('/brief')) {
    const id = url.split('/decisions/')[1]?.split('/')[0];
    const found = DECISIONS.find((d) => d.id === id);
    return {
      summary: found?.description || '',
      keyPoints: [],
      relatedItems: [],
    };
  }
  return { data: [], items: [] };
}) as typeof Api.get;

// Siatka bezpieczeństwa: wzorzec z mywork-inbox.tsx — cokolwiek jeszcze hub
// odpali przy montowaniu (presence, powiadomienia, sugestie AI…) dostaje
// neutralny payload zamiast uderzać w nieobecny backend dev-render. Router
// instalujemy TYLKO gdy TEN ekran jest wybrany (main.tsx importuje wszystkie
// ekrany naraz).
const g = window as unknown as { __MYWORK_DECISIONS_FETCH__?: boolean };
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'mywork-decisions';
if (__tenEkran && !g.__MYWORK_DECISIONS_FETCH__) {
  g.__MYWORK_DECISIONS_FETCH__ = true;
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

// Silence unused-import lint for ORG_ID (kept for parity with sibling
// screens / future field additions — decisions don't carry organizationId
// on the Decision interface itself).
void ORG_ID;

function MyWorkDecisionsRoute(): React.ReactElement {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/my-work/decisions', { replace: true });
  }, [navigate]);
  return <MyWorkHub />;
}

export function MyWorkDecisionsScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkDecisionsRoute />
      </div>
    </AppProviders>
  );
}

export default MyWorkDecisionsScreen;

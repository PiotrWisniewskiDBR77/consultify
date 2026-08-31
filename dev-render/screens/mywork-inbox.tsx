/**
 * dev-render host dla `mywork-inbox` — REALNY `<MyWorkHub>` na zakładce
 * `inbox` (Skrzynka), DOMYŚLNY ekran startowy modułu Moja Praca
 * (`MyWorkHub.tsx:258` — `MY_WORK_FALLBACK_TAB: ModuleTab = 'inbox'`).
 *
 * Zero re-implementacji: renderujemy PRAWDZIWY `<MyWorkHub>` (wzorzec
 * `mywork-idea-topbar.tsx`) i przełączamy jedyny `BrowserRouter` z
 * `AppProviders` na trasę `/my-work/inbox` (`useNavigate` w efekcie) —
 * `parseMyWorkPathIntent()` w hubie (MyWorkHub.tsx:606-694) czyta
 * `location.pathname` bezpośrednio (bez `useParams`/`<Route>`), więc
 * `setActiveTab('inbox')` odpala się bez żadnego dodatkowego routingu.
 *
 * Zawartość zakładki renderuje `<InboxContent>` (MyWorkHub.tsx:4039-4061).
 * `InboxContent` NIE MA własnych stałych DEMO_* — cały rekord musi przyjść
 * z mocka. Jedyne wywołanie ładujące dane przy mount (`fetchInbox`,
 * InboxContent.tsx:2332-2428) to:
 *   - `V8MyWorkApi.getCanonicalInboxTable({status, limit})`
 *   - `V8MyWorkApi.getCanonicalInboxStats()`
 *   - `V8MyWorkApi.materializeCanonicalInbox()` (wynik odrzucany, tylko
 *     efekt uboczny w Promise.all)
 * Mockujemy te TRZY metody bezpośrednio na obiekcie `V8MyWorkApi` (ten sam
 * wzorzec co podmiana metod na `Api` w karta-task.tsx) — próba złapania na
 * poziomie `window.fetch` ominęłaby te wywołania (idą przez `v8Get`, nie
 * przez bezpośredni `Api.get`).
 *
 * ★ SPROSTOWANIE WOBEC BRIEFU (zweryfikowane w źródle): dyżur zlecający ten
 * ekran prosił o dane demo w "oba stany nieprzeczytane/przeczytane". Taki
 * stan NIE ISTNIEJE w `InboxContent` — grep `isRead`/`unread` w pliku = 0
 * trafień. Model danych zna wyłącznie `itemStatus: 'open'|'done'|'saved'`
 * (zakładki Skrzynki) i `triaged: boolean` (pochodna statusu, nie osobny
 * wskaźnik "przeczytane" — nie steruje pogrubieniem/kropką w UI, tylko
 * pokazaniem sugerowanej akcji AI). Zamiast fabrykować nieistniejący stan,
 * mock różnicuje to, co REALNIE rozróżnia UI: typ (`itemType`), sekcję
 * (`section`) i `status` (pending/resolved/snoozed — API filtruje po nim
 * tak jak zrobiłby to prawdziwy backend, patrz `ALL_ITEMS`/`byStatus` niżej),
 * żeby zakładki Open/Done/Saved/All dawały spójny, nie-pusty obraz.
 *
 * URL: ?screen=mywork-inbox[&lang=pl|en][&theme=light|dark]
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import type { V8CanonicalInboxItem, V8CanonicalInboxStats } from '../../src/services/api/v8/my-work';
import { V8MyWorkApi } from '../../src/services/api/v8/my-work';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const ORG_ID = 'org-dbr77-demo';
const USER_ID = 'user-piotr-demo';

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();
const hoursFromNow = (h: number) => new Date(now + h * 3_600_000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const daysFromNow = (d: number) => new Date(now + d * 86_400_000).toISOString();

/**
 * Osiem pozycji Skrzynki — ten sam uniwersum demo co `karta-task.tsx`
 * (klienci Grupa Termika/NordFarm/Bielmar/Kolej Wschodnia, inicjatywa DRD,
 * zespół Piotr/Anna/Marek/Kasia) dla ciągłości między ekranami odbioru.
 * Sześć `pending` (widoczne domyślnie w zakładce "Otwarte"), po jednej w
 * `resolved`/`snoozed` (widoczne w "Zamknięte"/"Zapisane"/"Wszystkie").
 */
const ALL_ITEMS: V8CanonicalInboxItem[] = [
  {
    id: 'inbox-1',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'task',
    sourceEntityType: 'task',
    sourceEntityId: 'task-dbr77-demo-1',
    title: 'Przygotować mapę procesu raportowania AS-IS dla warsztatu z zarządem',
    description: 'Wsad liczbowy do warsztatu 29.07 — bez mapy nie da się obronić szacunku oszczędności.',
    priority: 'high',
    section: 'assigned_tasks',
    status: 'pending',
    slaDeadline: daysFromNow(2),
    slaStatus: 'at_risk',
    initiativeId: 'init-drd-automatyzacja',
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(6),
  },
  {
    id: 'inbox-2',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'decision',
    sourceEntityType: 'decision',
    sourceEntityId: 'decision-dbr77-demo-1',
    title: 'Wybór podejścia do automatycznego generowania raportów DRD',
    description: 'Marek czeka na Twoją rekomendację przed warsztatem — decyzja blokuje dalszy zakres.',
    priority: 'critical',
    section: 'decisions_required',
    status: 'pending',
    slaDeadline: hoursFromNow(20),
    slaStatus: 'at_risk',
    initiativeId: 'init-drd-automatyzacja',
    createdAt: daysAgo(1),
  },
  {
    id: 'inbox-3',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'approval',
    sourceEntityType: 'task',
    sourceEntityId: 'task-dbr77-demo-akcept-raportu',
    title: 'Akceptacja raportu końcowego — Grupa Termika Q3',
    description: 'Anna zgłosiła raport do akceptu partnera przed wysyłką do klienta.',
    priority: 'high',
    section: 'approvals_gates',
    status: 'pending',
    slaDeadline: hoursFromNow(6),
    slaStatus: 'at_risk',
    createdAt: hoursAgo(18),
  },
  {
    id: 'inbox-4',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'escalation',
    sourceEntityType: 'task',
    sourceEntityId: 'task-dbr77-demo-blokada-nordfarm',
    title: 'Eskalacja: blokada dostępu do danych klienta NordFarm',
    description: 'Dział IT klienta nie nadał dostępu do eksportu — zadanie stoi trzeci dzień.',
    priority: 'critical',
    section: 'blocked_escalations',
    status: 'pending',
    slaDeadline: hoursAgo(3),
    slaStatus: 'breached',
    createdAt: daysAgo(3),
  },
  {
    id: 'inbox-5',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'task',
    sourceEntityType: 'task',
    sourceEntityId: 'task-dbr77-demo-harmonogram-bielmar',
    title: 'Zaktualizować harmonogram warsztatu z zarządem — Bielmar',
    description: 'Termin minął wczoraj — klient pyta o nowy harmonogram.',
    priority: 'normal',
    section: 'overdue_sla_breach',
    status: 'pending',
    slaDeadline: daysAgo(1),
    slaStatus: 'breached',
    createdAt: daysAgo(4),
  },
  {
    id: 'inbox-6',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'mention',
    sourceEntityType: 'user',
    sourceEntityId: 'task-dbr77-demo-1',
    title: 'Marek Zieliński wspomniał Cię w komentarzu do zadania',
    description: '„Te 6 dni trzeba pokazać na warsztacie wprost, bez owijania."',
    priority: 'low',
    section: 'fyi_mentions',
    status: 'pending',
    createdAt: hoursAgo(5),
  },
  {
    id: 'inbox-7',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'signal',
    sourceEntityType: 'ai',
    sourceEntityId: 'insight-lead-time-akcept',
    title: 'AI: akcept partnera odpowiada za 55% lead time raportu',
    description: 'Wzorzec wykryty w 4 projektach — wart pokazania na warsztacie 29.07.',
    priority: 'normal',
    section: 'ai_insights',
    status: 'pending',
    createdAt: hoursAgo(1),
  },
  {
    id: 'inbox-8',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'task',
    sourceEntityType: 'task',
    sourceEntityId: 'task-dbr77-demo-agenda-kickoff',
    title: 'Przygotować agendę kick-off — nowy klient Atelier Toys',
    description: 'Zamknięte po akcepcie Kasi — agenda wysłana klientowi.',
    priority: 'normal',
    section: 'assigned_tasks',
    status: 'resolved',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
    resolvedAt: daysAgo(1),
  },
  {
    id: 'inbox-9',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'decision',
    sourceEntityType: 'decision',
    sourceEntityId: 'decision-dbr77-demo-odlozona',
    title: 'Wybór narzędzia do zarządzania backlogiem — odłożone do Q4',
    description: 'Zapisane na później — nie blokuje bieżącego zakresu.',
    priority: 'low',
    section: 'decisions_required',
    status: 'snoozed',
    createdAt: daysAgo(5),
  },
];

const V8_STATUS_TO_CANONICAL: Record<string, V8CanonicalInboxItem['status']> = {
  pending: 'pending',
  resolved: 'resolved',
  snoozed: 'snoozed',
};

function buildStats(items: V8CanonicalInboxItem[]): V8CanonicalInboxStats {
  const byPriority: Record<string, number> = {};
  const bySection: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const bySlaStatus: Record<string, number> = {};
  for (const item of items) {
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    bySection[item.section] = (bySection[item.section] || 0) + 1;
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    bySlaStatus[item.slaStatus] = (bySlaStatus[item.slaStatus] || 0) + 1;
  }
  return { total: items.length, byPriority, bySection, byStatus, bySlaStatus };
}

V8MyWorkApi.getCanonicalInboxTable = (async (params?: { status?: string }) => {
  const wanted = params?.status ? V8_STATUS_TO_CANONICAL[params.status] : undefined;
  const items = wanted ? ALL_ITEMS.filter((i) => i.status === wanted) : ALL_ITEMS;
  return { items };
}) as typeof V8MyWorkApi.getCanonicalInboxTable;

V8MyWorkApi.getCanonicalInboxStats = (async () =>
  buildStats(ALL_ITEMS)) as typeof V8MyWorkApi.getCanonicalInboxStats;

V8MyWorkApi.materializeCanonicalInbox = (async () => ({
  success: true,
  upserted: 0,
})) as typeof V8MyWorkApi.materializeCanonicalInbox;

// Akcje triage/AI (klik w wiersz) — nie są potrzebne do statycznego zrzutu,
// ale no-op zamiast crasha jeśli ktoś kliknie podczas ręcznej inspekcji.
V8MyWorkApi.triageCanonicalInboxItem = (async () => ({
  success: true,
  triagedAt: new Date().toISOString(),
  item: null,
})) as typeof V8MyWorkApi.triageCanonicalInboxItem;
V8MyWorkApi.bulkTriageCanonicalInbox = (async () => ({
  success: true,
})) as unknown as typeof V8MyWorkApi.bulkTriageCanonicalInbox;
Api.undoLastAITriage = (async () => ({ success: false })) as typeof Api.undoLastAITriage;

// Siatka bezpieczeństwa: cokolwiek jeszcze hub odpali przy montowaniu
// (presence, powiadomienia, sugestie AI…) dostaje neutralny payload zamiast
// uderzać w nieobecny backend dev-render — wzorzec z karta-task.tsx /
// mindmap-canvas.tsx. Router instalujemy TYLKO gdy TEN ekran jest wybrany
// (main.tsx importuje wszystkie ekrany naraz).
const g = window as unknown as { __MYWORK_INBOX_FETCH__?: boolean };
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'mywork-inbox';
if (__tenEkran && !g.__MYWORK_INBOX_FETCH__) {
  g.__MYWORK_INBOX_FETCH__ = true;
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

function MyWorkInboxRoute(): React.ReactElement {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/my-work/inbox', { replace: true });
  }, [navigate]);
  return <MyWorkHub />;
}

export function MyWorkInboxScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkInboxRoute />
      </div>
    </AppProviders>
  );
}

export default MyWorkInboxScreen;

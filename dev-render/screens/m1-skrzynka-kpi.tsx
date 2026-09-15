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
 * URL: ?screen=mywork-inbox[&lang=pl|en][&theme=light|dark][&stan=pelny|pusty|brak-dostepu]
 *
 * `stan` (MYW-PHOTO-002 dowód PRZED/PO, dyżur mw-skrzynka-pasek-20260903):
 * harness sam nie umiał wymusić pustego/403 stanu Skrzynki (`InboxContent`
 * nie ma propa do tego — jedyna dźwignia to co zwraca zmockowane
 * `V8MyWorkApi`), więc dokładamy trzy warianty tego samego mocka zamiast
 * trzech osobnych plików ekranu:
 *   - `pelny` (domyślny) — 9 pozycji demo jak dotychczas.
 *   - `pusty` — 200 OK, `items: []` (prawdziwie pusta skrzynka, zero błędu).
 *   - `brak-dostepu` — `getCanonicalInboxTable` odrzuca z `err.status = 403`
 *     (ten sam kształt błędu co `services/api.ts:1105` `err.status = res.status`
 *     dla realnego 401/403 z backendu), żeby wymusić gałąź
 *     `loadErrorIsAccessDenied` w `InboxContent.tsx`.
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
 * Jedenaście pozycji Skrzynki — ten sam uniwersum demo co `karta-task.tsx`
 * (klienci Grupa Termika/NordFarm/Bielmar/Kolej Wschodnia, inicjatywa DRD,
 * zespół Piotr/Anna/Marek/Kasia) dla ciągłości między ekranami odbioru.
 * Dziewięć `pending` (widoczne domyślnie w zakładce "Otwarte"), po jednej w
 * `resolved`/`snoozed` (widoczne w "Zamknięte"/"Zapisane"/"Wszystkie").
 *
 * MYW-PHOTO-001/007 (dyżur 2026-09-03): pomiar wobec `InboxSection`
 * (InboxContent.tsx:201-210, 9 wartości) pokazał, że pierwsza wersja tego
 * mocka (inbox-1..9) nie miała ani jednej pozycji w `fyi_system` ani `other`
 * — dwie z dziewięciu sekcji filtra (`INBOX_SECTION_FILTER_OPTIONS`,
 * InboxContent.tsx:1001-1034) zawsze pokazywałyby licznik zero. Dołożone
 * `inbox-10` (`fyi_system`) i `inbox-11` (`other`), bez zmiany istniejących
 * dziewięciu pozycji cytowanych w `docs/program/grafika/status.json` (wpis
 * `mywork-inbox`, „9 pozycji" — zaktualizowany razem z tym commitem).
 */
const ALL_ITEMS: V8CanonicalInboxItem[] = [
  {
    id: 'm1-card',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'task',
    sourceEntityType: 'action_card',
    sourceEntityId: '0dae5e2c-5c53-40ae-b071-b4bf3cf5b827',
    title: 'Deviation: On-time delivery 08.2026 — result 72 % is outside the limit',
    description:
      'The KPI result is outside its target limit. Explain the shortfall and record a corrective action.',
    priority: 'high',
    section: 'assigned_tasks',
    status: 'pending',
    slaDeadline: daysFromNow(3),
    slaStatus: 'at_risk',
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(1),
  },
  {
    id: 'm1-task',
    userId: USER_ID,
    organizationId: ORG_ID,
    itemType: 'task',
    sourceEntityType: 'task',
    sourceEntityId: 'a78daec5-4e51-42b5-a21a-5d3f76aa2dca',
    title:
      'Explain the shortfall of 28 % against the target for On-time delivery in 08.2026 (result 72 %, target 100 %) and record a corrective action with a deadline.',
    description: 'Created from the KPI deviation action card (source: action_card).',
    priority: 'high',
    section: 'assigned_tasks',
    status: 'pending',
    slaDeadline: daysFromNow(5),
    slaStatus: 'on_track',
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(1),
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

const STAN = new URLSearchParams(window.location.search).get('stan') ?? 'pelny';

if (STAN === 'brak-dostepu') {
  // Same error shape a real 401/403 produces (`services/api.ts:1104-1105`:
  // `const err: any = new Error(...); err.status = res.status;`) so
  // `InboxContent.tsx`'s `loadErrorIsAccessDenied` branch fires exactly as
  // it would against a real backend rejection — not a harness-only shortcut.
  const accessDenied = () => {
    const err: any = new Error('Forbidden');
    err.status = 403;
    return Promise.reject(err);
  };
  V8MyWorkApi.getCanonicalInboxTable = accessDenied as typeof V8MyWorkApi.getCanonicalInboxTable;
  V8MyWorkApi.getCanonicalInboxStats = accessDenied as typeof V8MyWorkApi.getCanonicalInboxStats;
  Api.shouldFallbackToLegacyMyWorkInbox = (() => false) as typeof Api.shouldFallbackToLegacyMyWorkInbox;
} else if (STAN === 'pusty') {
  V8MyWorkApi.getCanonicalInboxTable = (async () => ({
    items: [],
  })) as typeof V8MyWorkApi.getCanonicalInboxTable;
  V8MyWorkApi.getCanonicalInboxStats = (async () =>
    buildStats([])) as typeof V8MyWorkApi.getCanonicalInboxStats;
} else {
  V8MyWorkApi.getCanonicalInboxTable = (async (params?: { status?: string }) => {
    const wanted = params?.status ? V8_STATUS_TO_CANONICAL[params.status] : undefined;
    const items = wanted ? ALL_ITEMS.filter((i) => i.status === wanted) : ALL_ITEMS;
    return { items };
  }) as typeof V8MyWorkApi.getCanonicalInboxTable;

  V8MyWorkApi.getCanonicalInboxStats = (async () =>
    buildStats(ALL_ITEMS)) as typeof V8MyWorkApi.getCanonicalInboxStats;
}

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
const g = window as unknown as { __M1_SKRZYNKA_FETCH__?: boolean };
const __tenEkran = new URLSearchParams(window.location.search).get('screen') === 'm1-skrzynka-kpi';
if (__tenEkran && !g.__M1_SKRZYNKA_FETCH__) {
  g.__M1_SKRZYNKA_FETCH__ = true;
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

function M1SkrzynkaKpiRoute(): React.ReactElement {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/my-work/inbox', { replace: true });
  }, [navigate]);
  return <MyWorkHub />;
}

export function M1SkrzynkaKpiScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <M1SkrzynkaKpiRoute />
      </div>
    </AppProviders>
  );
}

export default M1SkrzynkaKpiScreen;

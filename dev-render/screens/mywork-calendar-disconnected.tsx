/**
 * dev-render host dla `mywork-calendar-disconnected` — REALNY `<MyWorkHub>`
 * na zakładce `calendar`, tożsamy z `mywork-calendar.tsx`, ale z Google
 * Calendar / Outlook w stanie 'disconnected' (puste `getIntegrations()`).
 *
 * POWÓD ISTNIENIA (ZLECENIE 1.1-K, 06.09): baza `mywork-calendar.tsx` mockuje
 * oba providery jako `status: 'connected'`, więc lewa kolumna nigdy nie
 * pokazuje ani wiersza "Podłącz w Integracjach →", ani (przed naprawą) drugiego,
 * zdublowanego komunikatu "Niepołączone… Połącz" pod listą ŹRÓDŁA — czyli
 * dokładnie ten stan, który właściciel odrzucił, nie renderuje się na
 * ekranie bazowym. Ten wariant istnieje wyłącznie do zrzutu dowodowego tego
 * jednego dyżuru: zero wpisów integracji → `CalendarView.tsx`'s
 * `fetchAvailability` reduce startuje z domyślnym
 * `{ google: 'disconnected', outlook: 'disconnected' }` i tak zostaje.
 *
 * URL: ?screen=mywork-calendar-disconnected[&lang=pl|en][&theme=light|dark]
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { V8MyWorkApi } from '../../src/services/api/v8/my-work';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

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

const TODAY = new Date();
const atDay = (offsetDays: number, hour = 0, minute = 0) => {
  const d = new Date(TODAY);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const isoDateTime = (d: Date) => d.toISOString();

(Api as any).getMyWorkCalendarUnified = async () => ({
  events: [
    {
      id: 'evt-task-mapa-asis',
      title: 'Termin: mapa AS-IS raportowania (DRD)',
      start: isoDate(atDay(-1)),
      allDay: true,
      source: 'task',
      sourceId: 'task-dbr77-demo-1',
      projectId: 'proj-drd-raporty',
      projectName: 'DRD Automatyzacja Raportów',
      status: 'in_progress',
      priority: 'high',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-decision-narzedzie-drd',
      title: 'Decyzja: podejście do automatyzacji raportów DRD',
      start: isoDate(atDay(0)),
      allDay: true,
      source: 'decision',
      sourceId: 'decision-dbr77-demo-1',
      projectName: 'DRD Automatyzacja Raportów',
      status: 'pending',
      priority: 'critical',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-meeting-warsztat-zarzad',
      title: 'Warsztat z zarządem — mapa AS-IS',
      start: isoDateTime(atDay(2, 10, 0)),
      end: isoDateTime(atDay(2, 12, 0)),
      allDay: false,
      source: 'consultify',
      sourceId: 'meeting-warsztat-drd',
      projectName: 'DRD Automatyzacja Raportów',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-initiative-kamien-milowy',
      title: 'Kamień milowy: Faza 1 — Automatyzacja raportowania',
      start: isoDate(atDay(4)),
      allDay: true,
      source: 'initiative',
      sourceId: 'init-drd-automatyzacja',
      projectName: 'DRD Automatyzacja Raportów',
      provider: 'internal',
      editAuthority: 'local_only',
    },
    {
      id: 'evt-task-akcept-raport-termika',
      title: 'Akceptacja raportu końcowego — Grupa Termika Q3',
      start: isoDate(atDay(-3)),
      allDay: true,
      source: 'task',
      sourceId: 'task-dbr77-demo-akcept-raportu',
      projectName: 'Grupa Termika — raport Q3',
      status: 'blocked',
      priority: 'high',
      provider: 'internal',
      editAuthority: 'local_only',
    },
  ],
});

// Klucz tego wariantu: brak wpisów integracji → oba providery zostają
// 'disconnected' (CalendarView.tsx fetchAvailability reduce, wartość domyślna).
(Api as any).getIntegrations = async () => [];

(Api as any).getMyWorkCalendarConflicts = async (dateKey: string) => ({
  totalItems: dateKey === isoDate(atDay(2)) ? 2 : 1,
  hasConflicts: false,
  tasks: [{ id: 'task-dbr77-demo-1', title: 'Termin: mapa AS-IS raportowania (DRD)' }],
  decisions: [{ id: 'decision-dbr77-demo-1', title: 'Decyzja: podejście do automatyzacji raportów DRD' }],
  suggestion: null,
});

(Api as any).updateMyWorkCalendarEvent = async () => ({ ok: true });

const g = window as unknown as { __MYWORK_CALENDAR_DISCONNECTED_FETCH__?: boolean };
const __tenEkran =
  new URLSearchParams(window.location.search).get('screen') === 'mywork-calendar-disconnected';
if (__tenEkran && !g.__MYWORK_CALENDAR_DISCONNECTED_FETCH__) {
  g.__MYWORK_CALENDAR_DISCONNECTED_FETCH__ = true;
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

function MyWorkCalendarDisconnectedRoute(): React.ReactElement {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/my-work/calendar', { replace: true });
  }, [navigate]);
  return <MyWorkHub />;
}

export function MyWorkCalendarDisconnectedScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkCalendarDisconnectedRoute />
      </div>
    </AppProviders>
  );
}

export default MyWorkCalendarDisconnectedScreen;

/**
 * Dev-render: K5-I4 — pasek „Top Warnings" osi czasu (REALNY
 * <ExecutionTimelineView>, ten sam komponent, którego używa oś czasu Inicjatyw
 * przez `InitiativesTimelineView`).
 *
 * PO CO OSOBNY EKRAN: pasek pokazuje się tylko wtedy, gdy są ostrzeżenia,
 * a wbudowany zestaw demo Inicjatyw po naprawie nie ma ani jednej realizacji
 * faktycznie zablokowanej — właśnie o to chodziło. Żeby ODEBRAĆ nowy kształt
 * pigułki, potrzebny jest portfel, który ostrzeżenia PRODUKUJE:
 *
 *   · jedna inicjatywa realnie po terminie (179 dni — liczba ze zrzutu stagingu),
 *   · jedna realnie wstrzymana (`onHold`) i jedna z jawnym `blockedReason`,
 *   · trzy zdrowe realizacje, które PRZED naprawą także dostawały „Blocked"
 *     (warunek brzmiał `status === IN_EXECUTION`).
 */
import React from 'react';

import { ExecutionTimelineView } from '../../src/components/Execution/ExecutionTimelineView';
import { AppProviders } from '../../src/providers/AppProviders';
import { InitiativeStatus, type FullInitiative } from '../../src/types';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

/* Harness nie ma backendu — bez tego `OrgContext` sypie 404 do konsoli i psuje
   bramkę „zero błędów konsoli" na zrzucie odbiorowym. Tylko odczyt. */
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api') || url.includes('/api/')) {
    return new Response(JSON.stringify({ data: [], organizations: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const INITIATIVES = [
  {
    id: 'i-overdue',
    name: 'Automatyzacja optymalizacji przezbrojeń',
    status: InitiativeStatus.IN_EXECUTION,
    priority: 'High',
    progress: 35,
    plannedStartDate: iso(320),
    plannedEndDate: iso(179),
  },
  {
    id: 'i-onhold',
    name: 'Pełna identyfikowalność partii',
    status: InitiativeStatus.IN_EXECUTION,
    priority: 'Medium',
    progress: 20,
    onHold: true,
    plannedStartDate: iso(60),
    plannedEndDate: iso(-40),
  },
  {
    id: 'i-blocked-reason',
    name: 'S&OP oparty na jednym źródle danych',
    status: InitiativeStatus.IN_EXECUTION,
    priority: 'Medium',
    progress: 10,
    blockedReason: 'Waiting for the vendor contract',
    plannedStartDate: iso(30),
    plannedEndDate: iso(-60),
  },
  {
    id: 'i-healthy-1',
    name: 'Automatyzacja magazynu WIP',
    status: InitiativeStatus.IN_EXECUTION,
    priority: 'Medium',
    progress: 55,
    plannedStartDate: iso(20),
    plannedEndDate: iso(-70),
  },
  {
    id: 'i-healthy-2',
    name: 'Robotyzacja gniazda spawalniczego',
    status: InitiativeStatus.IN_EXECUTION,
    priority: 'Medium',
    progress: 40,
    plannedStartDate: iso(10),
    plannedEndDate: iso(-80),
  },
  {
    id: 'i-healthy-3',
    name: 'Transformacja DevOps',
    status: InitiativeStatus.IN_EXECUTION,
    priority: 'High',
    progress: 60,
    plannedStartDate: iso(5),
    plannedEndDate: iso(-90),
  },
] as unknown as FullInitiative[];

export default function K5NaprawyOstrzezeniaScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionTimelineView initiatives={INITIATIVES} onInitiativeClick={() => undefined} />
      </div>
    </AppProviders>
  );
}

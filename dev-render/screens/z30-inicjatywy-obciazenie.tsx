/**
 * Z-30 (14.09) — REALNY <InitiativesHub> (Menu 1/2/3 w komplecie) z aktywną
 * zakładką Menu 1 „Obciążenie" (`InitiativeWorkloadSurface`, heatmapa Q1 P3)
 * PRZY WŁĄCZONEJ fladze `VITE_INITIATIVES_WORKLOAD=true`.
 *
 * CLAUDE.md §7: właściciel NIGDY nie jest pierwszym testerem wizualnym. Ten
 * ekran montuje CAŁĄ powłokę modułu Inicjatywy (nie sam
 * `InitiativeWorkloadSurface` w oderwaniu) — zrzut ma dowodzić, że heatmapa
 * żyje wewnątrz prawdziwego Menu 1/2/3, a chipy rejestru cyklu życia
 * (Wszystkie/Do zatwierdzenia/W realizacji) z reszty Inicjatyw NIE przeciekają
 * do tej zakładki (patrz test-strażnik dodany w
 * `InitiativesHub.kanonPaskow.source.test.ts`, opis „Q1 P3 DEC-495").
 *
 * Wzorzec: `z27-inicjatywy-skrzynka.tsx` (seedRealisticSession + wyłączenie
 * isDemoMode w STORZE i w localStorage — sam zapis do localStorage NIE
 * wystarcza, zustand `persist` nadpisuje go po ~300 ms).
 *
 * Atrapa `/api/execution-control/capacity/initiative-workload` zwraca 4 osoby
 * × 8 tygodni: pasma 70/90/120% + jedna osoba z 0 h dostępności i niezerowym
 * popytem (capacityExceeded → „No capacity", krytyczne).
 *
 * Flaga `VITE_INITIATIVES_WORKLOAD` jest ODCZYTYWANA W BUDOWIE
 * (import.meta.env), więc harness NIE potrafi jej przełączyć przez URL —
 * trzeba uruchomić serwer dev-render z tą zmienną env ustawioną (parytet OFF
 * = osobne uruchomienie serwera bez niej, patrz `z30-*-off` w SCREENS):
 *
 *   VITE_INITIATIVES_WORKLOAD=true VITE_INITIATIVES_FOUR_BUTTONS=true \
 *     npx vite --config dev-render/vite.config.ts --port <PORT> --strictPort
 *
 * Query:
 *   &tab=capacity              — wymagane, żeby Menu 1 od razu otworzyło zakładkę
 *   &openPreview=1             — dodatkowo klika pierwszy wiersz (person), żeby
 *                                 otworzyć StandardPreview osoby (wariant (b))
 *   &lang=pl|en &theme=light|dark  — jak wszędzie w harnessie
 */
import React, { useEffect } from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Patrz `z27-inicjatywy-skrzynka.tsx`: sam localStorage nie wystarcza, bo
// zustand persist nadpisuje go po ~300 ms i rejestr po cichu wraca na demo.
useAppStore.setState({ isDemoMode: false });
try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // brak localStorage nie powinien wywalic harnessu
}

// Rejestr (Menu 1 „Initiatives") — kilka wierszy, żeby pozostałe zakładki nie
// pokazywały pustego stanu w tle (fetchData rejestru wywoływane bezwarunkowo
// przy montowaniu, niezależnie od aktywnej zakładki).
const REGISTER_ROWS = [
  {
    id: 'ini-1',
    organizationId: 'org-z30',
    name: 'ERP rollout — phase 2 (finance close)',
    title: 'ERP rollout — phase 2 (finance close)',
    summary: 'Finance close automation, phase 2 of the ERP rollout.',
    status: 'SCHEDULED',
    archived: false,
    onHold: false,
    priority: 'HIGH',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-09-12T09:30:00.000Z',
  },
  {
    id: 'ini-2',
    organizationId: 'org-z30',
    name: 'Warehouse automation pilot',
    title: 'Warehouse automation pilot',
    summary: 'Pilot automation across two picking lanes.',
    status: 'EXECUTING',
    archived: false,
    onHold: false,
    priority: 'MEDIUM',
    createdAt: '2026-08-05T09:00:00.000Z',
    updatedAt: '2026-09-13T14:05:00.000Z',
  },
];

// --- Atrapa heatmapy: 4 osoby × 8 tygodni ----------------------------------
const WEEK_STARTS = Array.from({ length: 8 }, (_, i) => {
  const d = new Date('2026-09-14T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + i * 7);
  return d.toISOString().slice(0, 10);
});

type Person = {
  userId: string;
  name: string;
  role: string;
  weeklyCapacityHours: number;
  availabilityPercent: number;
  supplySource: 'PROFIL' | 'DOMYSLNA';
  backlogHours: number;
  unscheduledHours: number;
  backlogTaskIds: string[];
  backlogTasks: unknown[];
};

const PEOPLE: Person[] = [
  {
    userId: 'u-green',
    name: 'Anna Kwiatkowska',
    role: 'Project Manager',
    weeklyCapacityHours: 40,
    availabilityPercent: 100,
    supplySource: 'PROFIL',
    backlogHours: 0,
    unscheduledHours: 4,
    backlogTaskIds: [],
    backlogTasks: [],
  },
  {
    userId: 'u-amber',
    name: 'Marek Sikora',
    role: 'Business Analyst',
    weeklyCapacityHours: 40,
    availabilityPercent: 80,
    supplySource: 'PROFIL',
    backlogHours: 6,
    unscheduledHours: 0,
    backlogTaskIds: ['task-amber-1'],
    backlogTasks: [],
  },
  {
    userId: 'u-red',
    name: 'Ewa Lis',
    role: 'Solution Architect',
    weeklyCapacityHours: 40,
    availabilityPercent: 90,
    supplySource: 'PROFIL',
    backlogHours: 12,
    unscheduledHours: 0,
    backlogTaskIds: ['task-red-1', 'task-red-2'],
    backlogTasks: [],
  },
  {
    userId: 'u-critical',
    name: 'Paweł Górski',
    role: 'Data Engineer',
    weeklyCapacityHours: 0,
    availabilityPercent: 0,
    supplySource: 'DOMYSLNA',
    backlogHours: 0,
    unscheduledHours: 0,
    backlogTaskIds: [],
    backlogTasks: [],
  },
];

const rowFor = (userId: string, weekStart: string, percent: number, capacityExceeded: boolean) => {
  const supplyHours = capacityExceeded ? 0 : 40;
  const demandHours = capacityExceeded ? 8 : Math.round((percent / 100) * supplyHours);
  return {
    userId,
    name: PEOPLE.find((p) => p.userId === userId)!.name,
    role: PEOPLE.find((p) => p.userId === userId)!.role,
    weekStart,
    demandHours,
    supplyHours,
    utilizationPercent: percent,
    gapHours: supplyHours - demandHours,
    overdueHours: 0,
    backlogHours: 0,
    backlogTaskIds: [],
    backlogTasks: [],
    taskCount: capacityExceeded ? 1 : 3,
    supplySource: PEOPLE.find((p) => p.userId === userId)!.supplySource,
    capacityExceeded,
  };
};

const ROWS = WEEK_STARTS.flatMap((weekStart) => [
  rowFor('u-green', weekStart, 70, false),
  rowFor('u-amber', weekStart, 90, false),
  rowFor('u-red', weekStart, 120, false),
  rowFor('u-critical', weekStart, 0, true),
]);

const WORKLOAD_RESPONSE = {
  asOf: '2026-09-14T06:00:00.000Z',
  weeks: WEEK_STARTS,
  rows: ROWS,
  people: PEOPLE,
  summary: {
    peopleCount: PEOPLE.length,
    demandHours: ROWS.reduce((sum, r) => sum + r.demandHours, 0),
    supplyHours: ROWS.reduce((sum, r) => sum + r.supplyHours, 0),
    gapHours: ROWS.reduce((sum, r) => sum + r.gapHours, 0),
    utilizationPercent: 92,
    overloadedWeeks: WEEK_STARTS.length, // czerwony pas (u-red) w każdym tygodniu
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const params = new URLSearchParams(window.location.search);
const e234 = params.get('e234') === '1';
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const path = new URL(url, window.location.origin).pathname;
  if (path === '/api/organizations/current') {
    return json({
      organizations: [
        {
          id: 'org-dbr77-demo',
          name: 'DBR77 Demo',
          role: 'OWNER',
          access_type: 'OWNER',
          is_current: true,
        },
      ],
    });
  }
  if (/^\/api\/organizations\/[^/]+\/members$/.test(path)) {
    return json([
      {
        userId: 'user-piotr-demo',
        name: 'Piotr Wiśniewski',
        email: 'piotr@example.test',
        role: 'OWNER',
        status: 'active',
        joinedAt: '2026-08-01T08:00:00.000Z',
      },
    ]);
  }
  if (path === '/api/users') {
    return json({
      users: [
        {
          id: 'user-piotr-demo',
          firstName: 'Piotr',
          lastName: 'Wiśniewski',
          email: 'piotr@example.test',
          role: 'ADMIN',
        },
      ],
      total: 1,
    });
  }
  if (path === '/api/v8/planning/pending-decisions') {
    return json({ pendingDecisionChains: [] });
  }
  if (path === '/api/v8/admin/flags') {
    return json({ flags: [] });
  }
  if (url.includes('/api/execution-control/capacity/initiative-workload')) {
    if (e234) {
      return json({
        ...WORKLOAD_RESPONSE,
        people: PEOPLE.map((person) =>
          person.userId === 'u-green'
            ? { ...person, userId: 'user-piotr-demo', name: 'Piotr Wiśniewski' }
            : person
        ),
        rows: ROWS.map((row) =>
          row.userId === 'u-green'
            ? { ...row, userId: 'user-piotr-demo', name: 'Piotr Wiśniewski' }
            : row
        ),
      });
    }
    return json(WORKLOAD_RESPONSE);
  }
  if (e234 && url.includes('/api/users/user-piotr-demo/capacity')) {
    return json({
      userId: 'user-piotr-demo',
      weeklyCapacityHours: 36,
      availabilityPercent: 90,
    });
  }
  if (e234 && url.includes('/api/initiatives/runtime-v1/workload-proposals')) {
    return json({
      mode: 'RULE_BASED_AI',
      planningOnly: true,
      applied: false,
      proposals: [
        {
          proposalId: 'task-plan-1:u-amber:2026-09-14',
          taskId: 'task-plan-1',
          taskTitle: 'Prepare ERP pilot plan',
          initiativeId: 'ini-1',
          initiativeStatus: 'APPROVED',
          weekStart: '2026-09-14',
          fromUserId: 'u-red',
          fromUserName: 'Ewa Lis',
          toUserId: 'u-amber',
          toUserName: 'Marek Sikora',
          proposedHours: 8,
          rationale: 'Move 8 h from an overloaded plan to available capacity',
          requiresHumanApproval: true,
          applied: false,
        },
      ],
    });
  }
  if (
    e234 &&
    url.endsWith('/api/initiatives/runtime-v1/report-definitions') &&
    (!init?.method || init.method === 'GET')
  ) {
    return json({ items: [{ definitionId: 'workload-definition' }] });
  }
  if (
    e234 &&
    url.endsWith('/api/initiatives/runtime-v1/report-definitions/workload-definition')
  ) {
    return json({
      definitionId: 'workload-definition',
      versions: [
        {
          definitionVersion: 1,
          state: 'PUBLISHED',
          ownerId: 'user-piotr-demo',
          approverId: 'user-approver-demo',
          audience: ['pmo@example.test'],
          name: 'Weekly workload review',
          outputSchema: { kind: 'initiative_workload_report' },
          sourceBindings: [{ sourceType: 'initiative_workload' }],
        },
      ],
    });
  }
  if (e234 && url.includes('/api/initiatives/runtime-v1/report-runs/')) {
    return json({ aggregateVersion: 3 });
  }
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) {
    return json({ proposals: [] });
  }
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    return json({ initiatives: [], nextCursor: null });
  }
  if (url.includes('/my-work/definition-approvals')) {
    return json({ enabled: false, items: [] });
  }
  if (url.includes('/capabilities')) {
    return json({ canUpdate: true, canReview: true, canSelfApprove: true });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    return json(REGISTER_ROWS);
  }
  return originalFetch(input, init);
};

const openPreview = params.get('openPreview') === '1';
const openProposals = params.get('openProposals') === '1';

export default function Z30InicjatywyObciazenieScreen(): React.ReactElement {
  useEffect(() => {
    if (!openPreview) return;
    // Wariant (b): kliknij pierwszy wiersz tabeli heatmapy, żeby otworzyć
    // StandardPreview osoby (klik działa na `<tr>`, patrz onRowClick w
    // `InitiativeWorkloadSurface` / `StandardTable`).
    const timer = window.setTimeout(() => {
      const row = document.querySelector('tbody tr');
      if (row instanceof HTMLElement) row.click();
    }, 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!openProposals) return;
    const proposalTimer = window.setTimeout(() => {
      const trigger = Array.from(document.querySelectorAll('button')).find((button) =>
        /Propose plan moves|Zaproponuj przesunięcia planu/i.test(button.textContent || '')
      );
      if (trigger instanceof HTMLElement) trigger.click();
    }, 650);
    const previewTimer = window.setTimeout(() => {
      const row = document.querySelector('[data-testid="workload-proposals-panel"] tbody tr');
      if (row instanceof HTMLElement) row.click();
    }, 1100);
    return () => {
      window.clearTimeout(proposalTimer);
      window.clearTimeout(previewTimer);
    };
  }, []);

  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="z30-inicjatywy-obciazenie">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}

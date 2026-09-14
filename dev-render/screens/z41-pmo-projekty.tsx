/**
 * Z-41 (14.09) — REALNY <MyProjects /> (S5 PMO E3: `/projects`, lista
 * projektów + podgląd z 5 bramkami etapów `ProjectStageGatesPanel`).
 *
 * Wzór 1:1 z `dev-render/screens/zwornik-projects.tsx` (ten sam komponent,
 * ten sam wzorzec stubowania `window.fetch` po URL-u — `Api.*`/`StakeholderApi.*`
 * wołają `fetch('/api/...')` pod spodem). Rozszerzenie: atrapa
 * `/stage-gates/:id/current` + `/stage-gates/:id/history` (kontrakt z
 * `src/services/api.ts:3656-3680` i `src/components/MyWork/
 * projectStageGateModel.ts`), żeby prawy panel pokazywał realny
 * `<ProjectStageGatesPanel>` (StandardTable, 5 bramek: READINESS_GATE
 * PASSED, DESIGN_GATE NOT_READY z dwoma brakującymi elementami, pozostałe
 * trzy UPCOMING).
 *
 * `<MyProjects>` sam w sobie JEST powłoką Triady (StandardModuleBar z
 * breadcrumbs „My Work > Projects" = Menu 1, taby Projects|Programs = Menu 2,
 * chipy = Menu 3, StandardTable, StandardPreview) — nie owijamy w
 * `MainLayout`/sidebar, bo produkcyjna trasa `/projects`
 * (`src/routes/AppRoutes.tsx:1747-1752`) robi dokładnie to samo (montuje
 * `<MyProjects/>` wewnątrz `MainLayout`, ale sam ekran-obiekt renderowany
 * przez Triadę tu jest identyczny — patrz `z41-pmo-projekty-off.tsx` dla
 * dowodu trasy OFF przez `AppRoutes` w całości).
 *
 * Jeden projekt „PMO E3 Chicago Pilot" ACTIVE, zespół = 1 osoba, żeby zrzut
 * czytelnie pokazywał panel bramek bez szumu wielu wierszy.
 *
 * URL: ?screen=z41-pmo-projekty&lang=pl|en&theme=light|dark
 *   Po zamontowaniu kliknij pierwszy wiersz projektu, żeby otworzyć podgląd
 *   z bramkami. Przycisk „New project"/"Nowy projekt" w prawym górnym rogu
 *   otwiera `<CreateProjectModal>` (bez sieci przy samym otwarciu).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { MyProjects } from '../../src/components/MyWork/MyProjects';

// ── Mock payloads ────────────────────────────────────────────────────────
const CAPTURE_STATE = new URLSearchParams(window.location.search).get('state') || 'full';

const PROJECTS = CAPTURE_STATE === 'empty' ? [] : [
  {
    id: 'p1',
    name: 'PMO E3 Chicago Pilot',
    status: 'active',
    memberCount: 1,
    initiativeCount: 3,
    created_at: '2026-08-04',
    program_id: null,
  },
];

const PROGRAMS: any[] = [];

const STAKEHOLDERS_BY_PROJECT: Record<string, any[]> = {
  p1: [
    {
      id: 's1',
      userId: 'u1',
      firstName: 'Piotr',
      lastName: 'Wiśniewski',
      role: 'Sponsor',
      raciType: 'A',
      inherited: false,
      assessmentRedacted: false,
    },
  ],
};

const FINANCE_BY_PROJECT: Record<string, any> = {
  p1: {
    currency: 'USD',
    initiativeCount: 3,
    budget: { containerTotal: 850000 },
    initiativesBudget: { totalPlanned: 620000, totalActual: 140000 },
    value: { total: 2100000 },
    benefits: { count: 3, targetTotal: 2100000, currentTotal: 300000 },
    roi: { avgExpectedRoiPercent: 147.2, npvTotal: 1250000 },
    variance: {
      containerBudget: 850000,
      initiativesPlanned: 620000,
      delta: 230000,
      overCommitted: false,
    },
  },
};

const TEAM_BY_PROJECT: Record<string, any[]> = {
  p1: [
    {
      id: 'm1',
      user_id: 'u1',
      first_name: 'Piotr',
      last_name: 'Wiśniewski',
      email: 'piotr@dbr77.com',
      role: 'OWNER',
    },
    {
      id: 'm2',
      user_id: 'u2',
      first_name: 'Anna',
      last_name: 'Kowalska',
      email: 'anna.kowalska@dbr77.com',
      role: 'PROJECT_SPONSOR',
    },
  ],
};

const TASKS_BY_PROJECT: Record<string, any[]> = {
  p1: [
    {
      id: 't1',
      title: 'Assess Chicago plant baseline',
      status: 'done',
      priority: 'high',
      assignee: { firstName: 'Piotr', lastName: 'Wiśniewski' },
    },
    {
      id: 't2',
      title: 'Gap analysis review with sponsor',
      status: 'in_progress',
      priority: 'high',
      assignee: { firstName: 'Piotr', lastName: 'Wiśniewski' },
    },
  ],
};

// Stage gates (kontrakt: src/services/api.ts:3656-3680,
// src/components/MyWork/projectStageGateModel.ts):
//  - READINESS_GATE: PASSED (w historii)
//  - DESIGN_GATE: bieżąca brama, NOT_READY, brakuje 2 elementów
//  - PLANNING_GATE / EXECUTION_GATE / CLOSURE_GATE: UPCOMING (brak w historii,
//    nie są bieżącą bramą — model sam je oznacza UPCOMING)
const STAGE_GATE_HISTORY: Record<string, any[]> = {
  p1: [
    {
      id: 'sg1',
      gate_type: 'READINESS_GATE',
      status: 'PASSED',
      approved_at: '2026-08-18T10:00:00.000Z',
      notes: null,
    },
  ],
};

const STAGE_GATE_CURRENT: Record<string, any> = {
  p1: {
    currentPhase: 'Assessment',
    gateType: 'DESIGN_GATE',
    status: 'NOT_READY',
    nextGate: 'DESIGN_GATE',
    nextPhase: 'Initiatives',
    completionCriteria: [
      { criterion: 'assessmentComplete', isMet: false, evidence: '' },
      { criterion: 'gapAnalysisReviewed', isMet: false, evidence: '' },
    ],
    missingElements: ['assessmentComplete', 'gapAnalysisReviewed'],
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function idFrom(path: string, marker: string): string {
  const after = path.split(marker)[1] || '';
  return after.split('/')[0].split('?')[0];
}

const g = window as unknown as { __Z41_FETCH__?: boolean };
if (!g.__Z41_FETCH__) {
  g.__Z41_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/stage-gates/') && url.includes('/current')) {
        const id = idFrom(url, '/stage-gates/');
        return jsonResponse(STAGE_GATE_CURRENT[id] || STAGE_GATE_CURRENT.p1);
      }
      if (url.includes('/stage-gates/') && url.includes('/history')) {
        const id = idFrom(url, '/stage-gates/');
        return jsonResponse(STAGE_GATE_HISTORY[id] || []);
      }
      if (url.includes('/pmo/stakeholders/project/') && url.includes('/effective')) {
        const id = idFrom(url, '/project/');
        return jsonResponse({ stakeholders: STAKEHOLDERS_BY_PROJECT[id] || [] });
      }
      if (url.includes('/pmo/projects/') && url.includes('/finance')) {
        const id = idFrom(url, '/pmo/projects/');
        return jsonResponse(FINANCE_BY_PROJECT[id] || FINANCE_BY_PROJECT.p1);
      }
      if (url.includes('/project-members/')) {
        const id = idFrom(url, '/project-members/');
        return jsonResponse(TEAM_BY_PROJECT[id] || []);
      }
      if (url.includes('/pmo/projects/') && url.includes('/members')) {
        const id = idFrom(url, '/pmo/projects/');
        return jsonResponse(TEAM_BY_PROJECT[id] || []);
      }
      if (url.includes('/pmo/projects/') && url.includes('/operating-model')) {
        // Kształt: server/src/domain/pmo/projectOperatingModel.ts
        // (deriveProjectOperatingModel) + `permissions` z ProjectController.ts:718-725.
        return jsonResponse({
          roles: [],
          responsibilities: [],
          capacity: [],
          communication: [],
          approvalInputs: {
            roleBindings: [
              {
                roleKey: 'BUSINESS_AUTHORITY',
                bindingType: 'REVIEWER',
                projectRoleKey: 'PROJECT_SPONSOR',
                principalId: 'u2',
              },
              {
                roleKey: 'GATE_REQUESTER',
                bindingType: 'REQUESTER',
                projectRoleKey: 'PROJECT_LEADER',
                principalId: 'u1',
              },
            ],
          },
          missingRequiredRoles: [],
          permissions: { canManageTeam: true, canManageCommunication: true },
        });
      }
      if (url.includes('/pmo/projects/') && url.includes('/notification-settings')) {
        return jsonResponse({ channels: [] });
      }
      if (url.includes('/tasks')) {
        const pid = new URLSearchParams(url.split('?')[1] || '').get('projectId') || 'p1';
        return jsonResponse(TASKS_BY_PROJECT[pid] || []);
      }
      if (url.includes('/initiatives/programs')) {
        return jsonResponse({ programs: PROGRAMS });
      }
      if (url.endsWith('/projects') || url.includes('/projects?')) {
        return jsonResponse(PROJECTS);
      }
      if (url.includes('/users')) {
        return jsonResponse([]);
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function Z41PmoProjektyScreen(): React.ReactElement {
  return (
    <MemoryRouter>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MyProjects />
      </div>
    </MemoryRouter>
  );
}

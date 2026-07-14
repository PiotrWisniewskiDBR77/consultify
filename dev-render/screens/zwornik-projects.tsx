/**
 * Dev-render host for the ZWORNIK Projects screen (#78) — the REAL
 * `<MyProjects />` production component mounted offline. No re-implementation:
 * the component fetches everything through `Api` / `StakeholderApi` (both use
 * `fetch('/api/...')`), so we stub `window.fetch` with engine-shaped mock JSON
 * keyed by URL path. This exercises the existing Stakeholders + Finance rollup
 * sections AND the new Zespół / Role / Zadania sections (#78) in the project
 * preview panel, using the same StandardModuleBar + StandardTable + StandardPreview
 * facades the app already ships. Dev-only; never ships to demo.
 *
 * Screenshot flow: mounts on the "Projekty" tab; click the first project row to
 * open the preview panel — the 5 read-only sections stack there (light+dark).
 */
import React from 'react';

import { MyProjects } from '../../src/components/MyWork/MyProjects';

// ── Mock payloads (engine-shaped, mln PLN-scale like the DBR77 demo) ────────
const PROJECTS = [
  {
    id: 'p1',
    name: 'DBR77 · Scale-Up 2026',
    status: 'active',
    memberCount: 5,
    initiativeCount: 4,
    created_at: '2026-05-04',
    program_id: 'prog1',
  },
  {
    id: 'p2',
    name: 'Atelier · Digital Readiness',
    status: 'active',
    memberCount: 3,
    initiativeCount: 2,
    created_at: '2026-06-11',
    program_id: null,
  },
  {
    id: 'p3',
    name: 'Grupa · PMO Transformation',
    status: 'completed',
    memberCount: 8,
    initiativeCount: 6,
    created_at: '2026-03-19',
    program_id: 'prog1',
  },
];

const PROGRAMS = [
  {
    id: 'prog1',
    name: 'Transformacja Operacyjna',
    description: 'Program spinający projekty scale-up i PMO.',
    status: 'active',
    parentProgramId: null,
    initiativeCount: 10,
    childProgramCount: 0,
    createdAt: '2026-02-01',
  },
];

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
    {
      id: 's2',
      externalName: 'Anna Kowalska',
      role: 'Client Lead',
      raciType: 'R',
      inherited: false,
      assessmentRedacted: false,
    },
    {
      id: 's3',
      externalName: 'Regulator (UODO)',
      role: 'Regulator',
      raciType: 'I',
      inherited: true,
      assessmentRedacted: true,
    },
  ],
};

const FINANCE_BY_PROJECT: Record<string, any> = {
  p1: {
    currency: 'PLN',
    initiativeCount: 4,
    budget: { containerTotal: 4200000 },
    initiativesBudget: { totalPlanned: 3850000, totalActual: 1240000 },
    value: { total: 9600000 },
    benefits: { count: 6, targetTotal: 9600000, currentTotal: 2100000 },
    roi: { avgExpectedRoiPercent: 128.5, npvTotal: 5400000 },
    variance: {
      containerBudget: 4200000,
      initiativesPlanned: 3850000,
      delta: 350000,
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
      first_name: 'Marta',
      last_name: 'Zielińska',
      email: 'marta@dbr77.com',
      role: 'MANAGER',
    },
    {
      id: 'm3',
      user_id: 'u3',
      first_name: 'Tomasz',
      last_name: 'Nowak',
      email: 'tomasz@dbr77.com',
      role: 'LEAD',
    },
    {
      id: 'm4',
      user_id: 'u4',
      first_name: 'Kasia',
      last_name: 'Lewandowska',
      email: 'kasia@dbr77.com',
      role: 'MEMBER',
    },
    {
      id: 'm5',
      user_id: 'u5',
      first_name: 'Jan',
      last_name: 'Wójcik',
      email: 'jan@dbr77.com',
      role: 'MEMBER',
    },
  ],
};

const TASKS_BY_PROJECT: Record<string, any[]> = {
  p1: [
    {
      id: 't1',
      title: 'Zdefiniować kartę Zwornika',
      status: 'done',
      priority: 'high',
      assignee: { firstName: 'Tomasz', lastName: 'Nowak' },
    },
    {
      id: 't2',
      title: 'Rollup finansowy — walidacja z kontrolerem',
      status: 'in_progress',
      priority: 'high',
      assignee: { firstName: 'Marta', lastName: 'Zielińska' },
    },
    {
      id: 't3',
      title: 'Rejestr interesariuszy — import z org',
      status: 'in_progress',
      priority: 'medium',
      assignee: { firstName: 'Kasia', lastName: 'Lewandowska' },
    },
    {
      id: 't4',
      title: 'Macierz ról projektowych',
      status: 'todo',
      priority: 'medium',
      assignee: null,
    },
    {
      id: 't5',
      title: 'Uzgodnić budżety inicjatyw',
      status: 'blocked',
      priority: 'high',
      assignee: { firstName: 'Jan', lastName: 'Wójcik' },
    },
    { id: 't6', title: 'Przegląd kwartalny Q3', status: 'todo', priority: 'low', assignee: null },
  ],
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

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __ZWORNIK_FETCH__?: boolean };
if (!g.__ZWORNIK_FETCH__) {
  g.__ZWORNIK_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
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
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function ZwornikProjectsScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <MyProjects />
    </div>
  );
}

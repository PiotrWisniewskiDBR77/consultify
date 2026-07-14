/**
 * Dev-render host for the REAL `<TemplatesManager />` (Report Builder →
 * Templates library), migrated off a bespoke HTML table onto the production
 * <StandardTable>/<StandardModuleBar>/<StandardPreview> facades (kanon
 * TRIADA §27-todo backlog item). No re-implementation: the component fetches
 * through `Api.get()` (services/api.ts, backed by `fetch('/api/...')`), so we
 * stub `window.fetch` with engine-shaped mock JSON keyed by URL path
 * (pattern from dev-render/screens/assessment-reports-table.tsx).
 *
 * Exercises: Menu2/3 (search + New Template CTA + All/App/Org chips),
 * StandardTable columns (Type/Template/Module/Audience/Format/User/Sections/
 * Updated) with filterable lejki, kebab (Use template + Duplicate for org
 * templates, Duplicate-to-org for App templates, universal Preview/Edit
 * disabled for App templates, destructive Delete disabled for App), side
 * preview panel with resolution actions.
 */
import React from 'react';

import { TemplatesManager } from '../../src/components/ReportBuilder/TemplatesManager';

const TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'Assessment Diagnostic — Standard',
    description: 'Standard diagnostic report for Assessment sourceType.',
    sourceType: 'ASSESSMENT',
    reportType: 'vertical',
    isSystem: true,
    isDefault: true,
    isPublic: true,
    sections: [
      { key: 's1', type: 'summary', title: 'Executive Summary', required: true, order: 0 },
      { key: 's2', type: 'findings', title: 'Findings', required: true, order: 1 },
    ],
    createdAt: '2026-01-05T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
    createdByName: 'System',
    audience: 'executive',
  },
  {
    id: 'tpl-2',
    name: 'Interview Debrief',
    description: 'Structured debrief for stakeholder interviews.',
    sourceType: 'INTERVIEW',
    reportType: 'vertical',
    isSystem: true,
    isDefault: false,
    isPublic: true,
    sections: [{ key: 's1', type: 'summary', title: 'Summary', required: true, order: 0 }],
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-05-15T08:00:00Z',
    createdByName: 'System',
    audience: 'analyst',
  },
  {
    id: 'tpl-3',
    name: 'Board Deck — Quarterly',
    description: 'Horizontal exec deck for board review.',
    sourceType: 'INITIATIVE',
    reportType: 'horizontal',
    isSystem: false,
    isDefault: false,
    isPublic: false,
    sections: [
      { key: 's1', type: 'summary', title: 'Highlights', required: true, order: 0 },
      { key: 's2', type: 'kpi', title: 'KPI Scorecard', required: true, order: 1 },
      { key: 's3', type: 'risk', title: 'Risks', required: false, order: 2 },
    ],
    createdAt: '2026-02-20T08:00:00Z',
    updatedAt: '2026-07-10T08:00:00Z',
    createdByName: 'Piotr Wiśniewski',
    audience: 'executive',
  },
  {
    id: 'tpl-4',
    name: 'Tool Findings — Team Readout',
    description: 'Team-facing readout for tool-based diagnostic results.',
    sourceType: 'TOOL',
    reportType: 'vertical',
    isSystem: false,
    isDefault: false,
    isPublic: false,
    sections: [{ key: 's1', type: 'summary', title: 'Summary', required: true, order: 0 }],
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-07-12T08:00:00Z',
    createdByName: 'Anna Kowalska',
    audience: 'team',
  },
  {
    id: 'tpl-5',
    name: 'Client External Summary',
    description: 'External-facing summary, no internal notes.',
    sourceType: 'ASSESSMENT',
    reportType: 'vertical',
    isSystem: false,
    isDefault: false,
    isPublic: false,
    sections: [],
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-07-13T08:00:00Z',
    createdByName: 'Marek Zieliński',
    audience: 'external',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __REPORT_BUILDER_TEMPLATES_FETCH__?: boolean };
if (!g.__REPORT_BUILDER_TEMPLATES_FETCH__) {
  g.__REPORT_BUILDER_TEMPLATES_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/report-builder/templates')) {
        if (url.match(/\/templates\/[^/]+\/duplicate$/)) {
          return jsonResponse({ ok: true });
        }
        if (init?.method === 'POST' || init?.method === 'PUT') {
          return jsonResponse({ ok: true });
        }
        if (init?.method === 'DELETE') {
          return jsonResponse({ ok: true });
        }
        return jsonResponse({ templates: TEMPLATES });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function ReportBuilderTemplatesScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px', height: 720 }}>
      <TemplatesManager onUseTemplate={() => {}} />
    </div>
  );
}

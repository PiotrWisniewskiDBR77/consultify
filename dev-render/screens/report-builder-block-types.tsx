/**
 * Dev-render host for the REAL `<BlockTypesManager />` (Report Builder →
 * Block Types library), migrated off a bespoke HTML table onto the production
 * <StandardTable>/<StandardModuleBar>/<StandardPreview> facades (kanon
 * TRIADA §27-todo backlog item). No re-implementation: the component fetches
 * through `Api.get()` (services/api.ts, backed by `fetch('/api/...')`), so we
 * stub `window.fetch` with engine-shaped mock JSON keyed by URL path
 * (pattern from dev-render/screens/assessment-reports-table.tsx).
 *
 * Exercises: Menu2/3 (search + New Block CTA + All/App/Org chips), StandardTable
 * columns (Block/Type/Category/Render/Sources/Updated) with filterable lejki,
 * kebab (Edit + Duplicate-to-org note for App blocks, universal Preview/Edit,
 * destructive Deactivate disabled for App blocks), side preview panel.
 */
import React from 'react';

import { BlockTypesManager } from '../../src/components/ReportBuilder/BlockTypesManager';

const BLOCKS = [
  {
    id: 'blk-1',
    name: 'Executive Summary',
    description: 'High-level narrative summary of key findings and recommendations.',
    sourceTypes: ['ASSESSMENT', 'INITIATIVE'],
    renderKind: 'markdown',
    promptTemplate: 'Write an executive summary using: {{facts}}',
    defaultLength: 'medium',
    defaultLanguage: 'business',
    isSystem: true,
    isActive: true,
    category: 'content',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
  },
  {
    id: 'blk-2',
    name: 'KPI Scorecard',
    description: 'Tabular scorecard of KPIs vs targets.',
    sourceTypes: ['INITIATIVE'],
    renderKind: 'table',
    promptTemplate: '',
    defaultLength: 'short',
    defaultLanguage: 'business',
    isSystem: true,
    isActive: true,
    category: 'data',
    createdAt: '2026-01-12T08:00:00Z',
    updatedAt: '2026-05-20T08:00:00Z',
  },
  {
    id: 'blk-3',
    name: 'Risk Callout',
    description: 'Highlighted callout box for critical risks.',
    sourceTypes: ['ASSESSMENT'],
    renderKind: 'callout',
    promptTemplate: 'List top 3 risks from: {{facts}}',
    defaultLength: 'short',
    defaultLanguage: 'technical',
    isSystem: false,
    isActive: true,
    category: 'content',
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-07-05T08:00:00Z',
  },
  {
    id: 'blk-4',
    name: 'Trend Chart',
    description: 'Line chart of a metric over time.',
    sourceTypes: ['TOOL', 'INITIATIVE'],
    renderKind: 'chart',
    promptTemplate: '',
    defaultLength: 'medium',
    defaultLanguage: 'general',
    isSystem: false,
    isActive: true,
    category: 'visual',
    createdAt: '2026-03-15T08:00:00Z',
    updatedAt: '2026-07-11T08:00:00Z',
  },
  {
    id: 'blk-5',
    name: 'Impact Matrix',
    description: 'Effort vs impact matrix visual.',
    sourceTypes: ['TOOL'],
    renderKind: 'matrix',
    promptTemplate: '',
    defaultLength: 'medium',
    defaultLanguage: 'business',
    isSystem: true,
    isActive: true,
    category: 'visual',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-07-12T08:00:00Z',
  },
  {
    id: 'blk-6',
    name: 'Raw Data Export',
    description: 'Raw JSON payload for downstream consumers.',
    sourceTypes: ['ASSESSMENT', 'TOOL', 'INITIATIVE'],
    renderKind: 'json',
    promptTemplate: '',
    defaultLength: 'long',
    defaultLanguage: 'technical',
    isSystem: false,
    isActive: true,
    category: 'data',
    createdAt: '2026-05-01T08:00:00Z',
    updatedAt: '2026-07-13T08:00:00Z',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __REPORT_BUILDER_BLOCK_TYPES_FETCH__?: boolean };
if (!g.__REPORT_BUILDER_BLOCK_TYPES_FETCH__) {
  g.__REPORT_BUILDER_BLOCK_TYPES_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/report-builder/block-types')) {
        if (init?.method === 'POST' || init?.method === 'PUT') {
          return jsonResponse({ ok: true });
        }
        if (init?.method === 'DELETE') {
          return jsonResponse({ ok: true });
        }
        return jsonResponse({ blocks: BLOCKS });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function ReportBuilderBlockTypesScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px', height: 720 }}>
      <BlockTypesManager />
    </div>
  );
}

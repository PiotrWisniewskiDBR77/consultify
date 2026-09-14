/**
 * Z-42 — full ExecutionHub shell with the E4 governed execution-report list.
 * Run with VITE_EXECUTION_REPORT_E4=true and use &tab=reports.
 */
import React, { useEffect } from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
useAppStore.setState({ isDemoMode: false });

const OWNER_ID = 'user-piotr-demo';
const APPROVER_ID = 'user-anna-admin';
const ORG_ID = 'org-dbr77-demo';
const REPORT_RUN_ID = 'run-execution-weekly-01';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const method = (init?.method || 'GET').toUpperCase();

  if (url.includes('/api/execution-reports/definitions') && method === 'GET') {
    return json({
      definitions: [
        {
          key: 'weekly-exec',
          name: 'Weekly execution review',
          audience: 'PMO',
          cadence: 'Weekly',
          scope: 'Organization',
          sections: ['Delivery', 'KPI'],
          level: 'PMO',
          mvp: true,
          formats: ['SCREEN', 'PDF'],
        },
      ],
    });
  }
  if (url.includes('/report-definitions/def-execution-weekly') && method === 'GET') {
    return json({
      definitionId: 'def-execution-weekly',
      versions: [
        {
          definitionVersion: 1,
          state: 'PUBLISHED',
          name: 'Weekly execution review',
          ownerId: OWNER_ID,
          approverId: APPROVER_ID,
        },
      ],
    });
  }
  if (url.endsWith('/report-definitions') && method === 'GET') {
    return json({ items: [{ definitionId: 'def-execution-weekly' }] });
  }
  if (url.endsWith('/report-runs') && method === 'GET') {
    return json({
      items: [
        {
          reportRunId: REPORT_RUN_ID,
          status: 'APPROVED',
          version: 4,
          ownerId: OWNER_ID,
          approverId: APPROVER_ID,
          period: { start: '2026-09-07T00:00:00.000Z', end: '2026-09-13T23:59:59.000Z' },
          audience: ['anna.nowak@dbr77.com', 'pmo@dbr77.com'],
          sources: [
            {
              sourceType: 'execution_report_snapshot',
              sourceId: 'snapshot-private-id',
              sourceVersion: 1,
              capturedAt: '2026-09-14T09:00:00.000Z',
            },
          ],
          frozenSnapshot: {
            audience: ['anna.nowak@dbr77.com', 'pmo@dbr77.com'],
            workReport: {
              profile: 'execution_report',
              title: 'Weekly execution — 7–13 September',
              templateId: 'weekly-exec',
              cadence: 'WEEKLY',
              detailLevel: 'MANAGEMENT',
              content: { title: 'Weekly execution — 7–13 September' },
            },
          },
          workReport: {
            profile: 'execution_report',
            title: 'Weekly execution — 7–13 September',
            templateId: 'weekly-exec',
            cadence: 'WEEKLY',
            detailLevel: 'MANAGEMENT',
          },
        },
      ],
    });
  }
  if (url.includes(`/api/organizations/${ORG_ID}/members`)) {
    return json([
      {
        userId: APPROVER_ID,
        firstName: 'Anna',
        lastName: 'Nowak',
        email: 'anna.nowak@dbr77.com',
        role: 'admin',
        status: 'active',
      },
    ]);
  }
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) {
    return json({ proposals: [] });
  }
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    return json({ initiatives: [], nextCursor: null });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) return json([]);
  if (url.includes('/api/') || url.startsWith('/api/')) {
    return json({ items: [], cases: [], data: [], results: [] });
  }
  return originalFetch(input, init);
};

function OpenPreview(): null {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const cell = Array.from(document.querySelectorAll('td')).find((node) =>
        node.textContent?.includes('Weekly execution')
      );
      if (cell) {
        (cell as HTMLElement).click();
        window.clearInterval(timer);
      } else if (attempts > 40) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}

export default function Z42RealizacjaRaportyScreen(): React.ReactElement {
  return (
    <AppProviders>
      <OpenPreview />
      <div style={{ height: '100vh' }} data-testid="z42-realizacja-raporty">
        <ExecutionHub />
      </div>
    </AppProviders>
  );
}

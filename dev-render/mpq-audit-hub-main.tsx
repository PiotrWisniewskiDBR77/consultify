/**
 * TEMPORARY audit-only entry — see mpq-audit-hub.html header. Mounts the
 * EXISTING screens/assessment-five-surfaces.tsx (real AssessmentHub, mocked
 * Api). Adds a fetch() intercept for the V8 `/api/v8/assessment/definitions/DRD`
 * endpoint (used only by the Library tab) since that module calls the raw
 * fetch-based v8Get client, not the `Api` singleton already patched by that
 * screen file — without this the Library tab would only ever show its
 * network-error state.
 *
 * DELETE THIS FILE after the audit.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import AssessmentFiveSurfacesScreen from './screens/assessment-five-surfaces';

const originalFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (url.includes('/api/v8/assessment/definitions/DRD')) {
    return new Response(
      JSON.stringify({
        data: {
          methodologyId: 'DRD',
          versions: [
            {
              id: 'def-drd-v3',
              methodologyId: 'DRD',
              version: 3,
              status: 'published',
              publishedAt: '2026-07-01T09:00:00.000Z',
              updatedAt: '2026-07-01T09:00:00.000Z',
              createdAt: '2026-05-01T09:00:00.000Z',
            },
          ],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return originalFetch(input as any, init);
}) as typeof window.fetch;

const mount = document.getElementById('dev-render-root')!;
createRoot(mount).render(
  <React.StrictMode>
    <AssessmentFiveSurfacesScreen />
  </React.StrictMode>
);

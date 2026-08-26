/**
 * Day 15 visual evidence harness for the real PlatformOperationsView.
 * Fixture-only: no login, backend, database, or production route is used.
 * URL: ?screen=superadmin-platform-operations-day15&scene=ready|empty|error
 */
import React from 'react';

import { PlatformOperationsView } from '../../src/views/superadmin/PlatformOperationsView';

const params = new URLSearchParams(window.location.search);
const scene = params.get('scene') || 'ready';

const readyPayloads: Record<string, unknown> = {
  '/api/superadmin/organizations': {
    organizations: [
      { id: 'org-northstar', name: 'Northstar Manufacturing', status: 'active' },
      { id: 'org-vistula', name: 'Vistula Operations', status: 'suspended' },
    ],
  },
  '/api/superadmin/users': {
    users: [
      { id: 'user-anna', email: 'anna@northstar.example', status: 'active' },
      { id: 'user-marek', email: 'marek@vistula.example', status: 'active' },
    ],
  },
  '/api/superadmin/connectors': {
    connectors: [
      { id: 'slack', name: 'Slack', affectedTenants: 12 },
      { id: 'hubspot', name: 'HubSpot', affectedTenants: 4 },
    ],
  },
  '/api/virtual-workers': {
    workers: [
      { id: 'worker-teresa', name: 'Teresa', status: 'active' },
      { id: 'worker-analyst', name: 'Operations Analyst', status: 'active' },
    ],
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const globalState = window as typeof window & { __DAY15_PLATFORM_OPS_FIXTURE__?: boolean };
if (!globalState.__DAY15_PLATFORM_OPS_FIXTURE__) {
  globalState.__DAY15_PLATFORM_OPS_FIXTURE__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, window.location.origin).pathname;
    if (path in readyPayloads) {
      if (scene === 'error' && path === '/api/superadmin/connectors') {
        return json({ code: 'CATALOG_UNAVAILABLE' }, 503);
      }
      if (scene === 'empty') return json({});
      return json(readyPayloads[path]);
    }
    if (path.startsWith('/api/superadmin/') && (init?.method || 'GET') !== 'GET') {
      return json({ success: true });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function SuperadminPlatformOperationsDay15Screen(): React.ReactElement {
  React.useEffect(() => {
    const root = document.getElementById('dev-render-root');
    if (!root) return;
    const previousWidth = root.style.width;
    const previousHeight = root.style.height;
    root.style.width = '100%';
    root.style.height = 'auto';
    return () => {
      root.style.width = previousWidth;
      root.style.height = previousHeight;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <PlatformOperationsView />
    </main>
  );
}

import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ConnectedAppsSettings } from '../../src/components/settings/ConnectedAppsSettings';

const CATALOG_IDS = [
  'gmail', 'outlook', 'slack', 'teams', 'google_calendar', 'outlook_calendar',
  'apple_calendar', 'calendly', 'jira', 'asana', 'trello', 'clickup', 'monday',
  'notion', 'todoist', 'linear', 'google_drive', 'onedrive', 'dropbox', 'box',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const state = window as unknown as { __DAY377_FETCH_INSTALLED__?: boolean };
if (!state.__DAY377_FETCH_INSTALLED__) {
  state.__DAY377_FETCH_INSTALLED__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/settings/integrations/oauth/status')) {
      return jsonResponse({
        availability: Object.fromEntries(
          CATALOG_IDS.map((id) => [id, { configured: id === 'teams', authType: 'oauth2' }])
        ),
      });
    }
    if (url.includes('/api/settings/integrations/teams/connect') && init?.method === 'POST') {
      return jsonResponse(
        {
          error: 'Integracja nie jest dostępna w tej wersji',
          code: 'GOVERNED_CONNECTOR_NOT_APPROVED',
        },
        501
      );
    }
    if (url.includes('/api/settings/integrations')) {
      return jsonResponse({ integrations: [], providers: [], connectedCount: 0 });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function Day377GovernedConnectScreen(): React.ReactElement {
  return (
    <MemoryRouter>
      <div className="min-h-screen bg-c-bg p-8">
        <ConnectedAppsSettings />
      </div>
    </MemoryRouter>
  );
}

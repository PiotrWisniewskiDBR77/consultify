import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import { ProjectContextSwitcher } from '../src/components/Projects/ProjectContextSwitcher';
import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';

const projects = [
  { projectId: '6174636d-c4f2-552d-9a5a-d2695738f9bc', projectName: 'Operational Excellence Programme' },
  { projectId: 'ac3c5d4c-2c4c-4af6-9516-314e0d962402', projectName: 'Portfolio — direct initiatives' },
  { projectId: 'ae6cfbae-1ba8-5328-9048-d86f2a52a09e', projectName: 'Digital & Automation Roadmap' },
];

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const lang = params.get('lang') === 'pl' ? 'pl' : 'en';

document.documentElement.classList.toggle('dark', theme === 'dark');
document.body.style.margin = '0';
document.body.style.background = 'var(--c-bg)';
void i18n.changeLanguage(lang);

useAppStore.setState({ currentProjectId: null, theme } as any);

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/projects/my-memberships')) {
    return new Response(JSON.stringify({ memberships: projects }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

function Harness() {
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  return (
    <MemoryRouter initialEntries={['/initiatives']}>
      <div className="min-h-screen bg-c-bg p-6 text-c-text">
        <div className="flex h-12 items-center justify-end gap-4 border-b border-c-border-subtle bg-c-surface px-4 shadow-sm">
          <ProjectContextSwitcher />
        </div>
        <output data-testid="selected-project" className="mt-4 block text-sm text-c-text-secondary">
          {currentProjectId || 'all'}
        </output>
      </div>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('dev-render-root')!).render(<Harness />);

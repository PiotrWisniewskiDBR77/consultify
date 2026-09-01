/**
 * M03 (dyżur 20260830) ISOLATED TEST HARNESS entry — see
 * `mywork-projects-tab.html` header for why this is a SEPARATE entry point
 * from `dev-render/main.tsx`'s shared screen registry (that file is on the
 * "nie ruszaj" list for this dyżur; this entry never touches it).
 *
 * Mounts the REAL `<MyWorkHub/>` (src/components/MyWork/MyWorkHub.tsx) inside
 * the REAL `<AppProviders>` — same pattern as
 * `dev-render/screens/mywork-idea-topbar.tsx` (`seedRealisticSession` unlocks
 * the heavy provider tree exactly like a logged-in session, no auth token
 * written so no real network calls fire from AccessPolicyContext/OrgContext).
 * Purpose: render-verify the new "Projekty" tab (M03 task — add a hub entry
 * point for the orphaned `/projects` route, decyzja właściciela) BEFORE the
 * owner sees it (CLAUDE.md #7), and prove PRZED/PO that the rest of the hub
 * (Menu 2 tab row, other tabs) is byte-for-byte unchanged.
 *
 * `Api.getProjects`/`Api.getPrograms` are mocked with a couple of realistic
 * rows so the new tab shows real-looking data instead of an honest-but-empty
 * error banner (MyProjects.tsx already degrades gracefully on fetch failure —
 * this harness just gives it something to degrade FROM into something nicer).
 * Every other tab's fetches are left real/unmocked on purpose — they are
 * NOT the surface under test here, and MyWorkHub's child list components
 * (InboxContent, MyTasksListContent, …) already catch fetch failures into
 * their own empty/error states rather than crashing.
 *
 * URL params: &lang=pl|en (default pl), &theme=light|dark (default light),
 * &tab=projects (land directly on the new tab instead of the default Inbox).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import { MyWorkHub } from '../src/components/MyWork/MyWorkHub';
import i18n from '../src/i18n';
import { AppProviders } from '../src/providers/AppProviders';
import { Api } from '../src/services/api';
import { useAppStore } from '../src/store/useAppStore';
import { seedRealisticSession } from './mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'pl';
const theme = params.get('theme') || 'light';
const initialTab = params.get('tab');

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' } as any);
new MutationObserver(() => {
  const powinnaByc = theme === 'dark';
  if (root.classList.contains('dark') !== powinnaByc) {
    root.classList.toggle('dark', powinnaByc);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

void i18n.changeLanguage(lang);

// ── Mock STANOWY: kilka realnych wierszy projektów/programów, żeby ekran
// (i nowa zakładka) pokazywał dane, nie honest-error banner. ──────────────
const MOCK_PROJECTS = [
  {
    id: 'proj-transformacja-dbr77',
    name: 'Transformacja DBR77',
    status: 'active',
    memberCount: 8,
    initiativeCount: 5,
    createdAt: '2025-11-03T09:00:00Z',
    is_system: false,
    program_id: null,
  },
  {
    id: 'proj-optymalizacja-lancucha',
    name: 'Optymalizacja łańcucha dostaw',
    status: 'active',
    memberCount: 5,
    initiativeCount: 3,
    createdAt: '2026-02-18T09:00:00Z',
    is_system: false,
    program_id: null,
  },
  {
    id: 'proj-wdrozenie-crm',
    name: 'Wdrożenie CRM — faza 2',
    status: 'completed',
    memberCount: 4,
    initiativeCount: 2,
    createdAt: '2025-08-01T09:00:00Z',
    is_system: false,
    program_id: null,
  },
];

Api.getProjects = (async () => MOCK_PROJECTS) as typeof Api.getProjects;
Api.getPrograms = (async () => []) as typeof Api.getPrograms;

// This harness is served from `/mywork-projects-tab.html`, not from the
// app's real router — MyWorkHub reads `window.location.pathname` at mount
// (`parseMyWorkPathIntent`) to decide the initial tab, so rewrite the visible
// path BEFORE React mounts (same technique as `mindmap-canvas.tsx`'s
// `forceMelsCanvasOn`). No page reload — client-side routing only.
if (initialTab === 'projects') {
  window.history.replaceState({}, '', '/my-work/projects');
} else {
  window.history.replaceState({}, '', '/my-work');
}

const mount = document.getElementById('dev-render-root')!;

createRoot(mount).render(
  <React.StrictMode>
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkHub />
      </div>
    </AppProviders>
    <Toaster position="bottom-center" />
  </React.StrictMode>
);

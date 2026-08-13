/**
 * S2 CEL 1 ISOLATED TEST HARNESS entry — see `drd-artifacts.html` header.
 *
 * Deliberately NOT the shared `dev-render/main.tsx` registry (same
 * rationale as `drd-workspace-main.tsx`/`method-workspace-main.tsx`: an
 * isolated entry avoids that registry's unrelated static imports). Mounts
 * ONLY `dev-render/screens/drd-artifacts.tsx` — real HTTP, real components,
 * zero mock fetch.
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';
import { DrdArtifactsHarnessScreen, type DrdArtifactsHarnessView } from './screens/drd-artifacts';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') || 'light';
const view = (params.get('view') || 'artifacts') as DrdArtifactsHarnessView;
const sessionId = params.get('sessionId') || undefined;
const currentUserId = params.get('currentUserId') || 'test-user-id';
const token = params.get('token');

// Auth: if the fixture passed a `token` query param, write it to
// localStorage BEFORE mount so `src/services/tokenService.ts`'s
// `getToken()` (and hence every fetch this harness makes) authenticates as
// that SPECIFIC actor. Absent -> falls through to the server's
// ENABLE_TEST_AUTH_BYPASS identity (test-user-id/test-org-id).
if (token) {
  window.localStorage.setItem('token', token);
} else {
  window.localStorage.removeItem('token');
}

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light' } as any);
document.body.style.background = 'var(--c-bg)';

void i18n.changeLanguage('pl');

const mount = document.getElementById('dev-render-root')!;

createRoot(mount).render(
  <React.StrictMode>
    <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Ładowanie…</div>}>
      <DrdArtifactsHarnessScreen view={view} sessionId={sessionId} currentUserId={currentUserId} />
    </React.Suspense>
  </React.StrictMode>
);

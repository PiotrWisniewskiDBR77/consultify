/**
 * D-48 evidence harness entry (QC20) — separate entry point on purpose, like
 * `qoder-u29-conclusion-readout-main.tsx`: the shared `main.tsx` registry
 * statically imports screens that do not exist at this worktree's base commit.
 *
 * Mounts the REAL `AssessmentReportView` through the existing mock fixture
 * screen `dev-render/screens/assessment-output-report.tsx` (which stubs
 * `window.fetch`), so the screenshot shows the production component, not a
 * copy. `?variant=named` adds `session.name` to the mocked
 * `GET /api/method/sessions/:id` answer — the field the server has returned
 * since migration 20262230 and which the document's SESSION property ignored
 * until D-48 (it printed the raw uuid). `?variant=happy` is the same scene
 * WITHOUT a name, i.e. the honest fallback to the identifier.
 *
 * URL params: &variant=named|happy (default named), &theme=light|dark,
 * &lang=en|pl (default en).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AssessmentOutputReportScreen from './screens/assessment-output-report';
import { FeatureFlagsProvider } from '../src/contexts/FeatureFlagsContext';
import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'en';
const theme = params.get('theme') || 'light';

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light', language: lang } as never);
new MutationObserver(() => {
  const shouldBeDark = theme === 'dark';
  if (root.classList.contains('dark') !== shouldBeDark) {
    root.classList.toggle('dark', shouldBeDark);
  }
}).observe(root, { attributes: true, attributeFilter: ['class'] });
document.body.style.background = 'var(--c-bg)';

void i18n.changeLanguage(lang).then(() => {
  const mount = document.getElementById('dev-render-root')!;
  createRoot(mount).render(
    <React.StrictMode>
      <React.Suspense fallback={<div style={{ padding: 24, color: '#64748b' }}>Loading…</div>}>
        <MemoryRouter>
          <FeatureFlagsProvider>
            <AssessmentOutputReportScreen />
          </FeatureFlagsProvider>
        </MemoryRouter>
      </React.Suspense>
      <Toaster position="bottom-center" />
    </React.StrictMode>
  );
});

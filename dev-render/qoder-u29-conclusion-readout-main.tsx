/**
 * U-29 evidence harness entry — separate entry point (like
 * `method-workspace-main.tsx` / `qoder-op2a-pack-object-main.tsx`) so it never
 * touches the shared `main.tsx` screen registry, which statically references
 * screens that do not exist at this worktree's base commit.
 *
 * Bootstrap: theme via the app store + `<html class="dark">` MutationObserver
 * (NOT `emulateMedia` — the app is not media-driven), locale from `&lang`.
 *
 * The REAL `ConclusionReadout` is a pure presentational component
 * (`detail` + `onBack`) with no mount-time fetches, so no fake server is
 * installed. The inline fixture reproduces the U-29 audit-source surface:
 * `sourceModule='audit'` + `evidenceRefs` carrying the raw server type keys
 * `audit_evidence` / `audit_report`.
 *
 * URL params: &lang=en (default en), &theme=light|dark (default light).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import { ConclusionReadout } from '../src/components/Conclusions/ConclusionReadout';
import i18n from '../src/i18n';
import type { ConclusionDetail } from '../src/services/api/conclusions.api';
import { useAppStore } from '../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'en';
const theme = params.get('theme') || 'light';

const detail: ConclusionDetail = {
  conclusion: {
    id: 'concl-audit-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    title: 'Audit found gaps in the supplier onboarding controls',
    statement:
      'The internal audit of the supplier onboarding process identified two control gaps that block the readout from being published without remediation.',
    sourceModule: 'audit',
    sourceArtifactRefs: [
      { type: 'audit_report', id: 'audit-report-77', title: 'Supplier onboarding audit 2026-Q3', url: null },
    ],
    sourcePackId: 'pack-audit-1',
    confidenceLevel: 'medium',
    limits: 'Based on a sample of 12 onboarding files; does not cover the emergency-vendor path.',
    evidenceRefs: [
      {
        type: 'audit_evidence',
        ref: 'ev-audit-1',
        excerpt: 'Maintenance log shows the control was bypassed on 2026-08-14 without an approval record.',
      },
      {
        type: 'audit_evidence',
        ref: 'ev-audit-2',
        excerpt: 'Three of twelve onboarding files were missing the required second-signature attestation.',
      },
      {
        type: 'audit_report',
        ref: 'audit-report-77',
        excerpt: 'Audit conclusion: control design adequate, operating effectiveness not evidenced.',
      },
    ],
    recommendedNextAction: 'Route to the process owner for remediation before the quarterly readout.',
    status: 'candidate',
    ownerId: 'u-owner',
    reviewerId: null,
    sponsorId: null,
    createdBy: 'u-audit',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  },
  sourcePack: {
    id: 'pack-audit-1',
    organizationId: 'org-1',
    projectId: 'proj-1',
    sourceModule: 'audit',
    sourceArtifactRefs: [],
    evidenceRefs: [],
    contextSummary: 'Captured from the supplier onboarding audit run on 2026-09-10 against the 2026 control set.',
    limitations: ['Sample of 12 files', 'Emergency-vendor path out of scope'],
    capturedAt: '2026-09-10T00:00:00.000Z',
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  },
  conversions: [],
};

const root = document.documentElement;
root.classList.toggle('dark', theme === 'dark');
useAppStore.setState({ theme: theme === 'dark' ? 'dark' : 'light', language: lang } as any);
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
        <div style={{ padding: 24 }}>
          <ConclusionReadout detail={detail} onBack={() => undefined} />
        </div>
      </React.Suspense>
      <Toaster position="bottom-center" />
    </React.StrictMode>
  );
});

/**
 * D-36 (QA16) evidence harness entry — separate entry point (like
 * `qoder-u29-conclusion-readout-main.tsx`) so it never touches the shared
 * `main.tsx` screen registry, which statically references screens that do not
 * exist at this worktree's base commit.
 *
 * Bootstrap: theme via the app store + `<html class="dark">` MutationObserver
 * (NOT `emulateMedia` — the app is not media-driven), locale from `&lang`.
 *
 * The REAL `TemplatesGalleryView` is a pure presentational component
 * (`templates` + callbacks) with no mount-time fetches, so no fake server is
 * installed. The inline fixtures reproduce the D-36 defect surface: a tile whose
 * hover action row carries FOUR labelled buttons (Build / Edit · Use template ·
 * Duplicate · Preview) under `flex-nowrap`, which overflows the ~427px tile the
 * debt measured in the real hub (`lg:grid-cols-3`, viewport 1440px).
 *
 * The container is pinned to 1321px so each of the 3 columns lands on ~427px,
 * matching the documented real-hub tile width.
 *
 * URL params: &lang=en (default en), &theme=light|dark (default light).
 */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import { TemplatesGalleryView } from '../src/components/ReportsAndPresentations/TemplatesGalleryView';
import type { TemplateItem } from '../src/components/ReportsAndPresentations/types';
import i18n from '../src/i18n';
import { useAppStore } from '../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') || 'en';
const theme = params.get('theme') || 'light';

const fixtures: TemplateItem[] = [
  {
    id: 'tpl-report-1',
    artifactIndexId: 'tpl-report-1',
    canonicalTemplateId: 'c-report-1',
    originRuntime: 'document_template',
    source: 'canonical',
    orphaned: false,
    title: 'Quarterly business review report',
    description: 'Narrative quarterly pack with executive summary and findings.',
    type: 'report',
    category: 'R2',
    scope: 'organization',
    status: 'approved',
    sectionCount: 7,
    updatedAt: '2026-09-12T00:00:00.000Z',
    createdBy: 'System',
  },
  {
    id: 'tpl-pres-1',
    artifactIndexId: 'tpl-pres-1',
    canonicalTemplateId: 'c-pres-1',
    originRuntime: 'deck_template',
    source: 'canonical',
    orphaned: false,
    title: 'Investor update deck',
    description: 'Board-ready presentation with metrics and roadmap slides.',
    type: 'presentation',
    category: 'executive_update',
    scope: 'personal',
    status: 'approved',
    slideCount: 9,
    updatedAt: '2026-09-14T00:00:00.000Z',
    createdBy: 'A. Nowak',
  },
  {
    id: 'tpl-sheet-1',
    artifactIndexId: 'tpl-sheet-1',
    canonicalTemplateId: 'c-sheet-1',
    originRuntime: 'sheet_template',
    source: 'canonical',
    orphaned: false,
    title: 'Supplier scorecard workbook',
    description: 'Accepted TEMPLATE-1 system base for supplier scoring.',
    type: 'sheet',
    category: 'custom',
    scope: 'system',
    status: 'approved',
    updatedAt: '2026-09-16T00:00:00.000Z',
    createdBy: 'System',
  },
  {
    id: 'tpl-report-2',
    artifactIndexId: 'tpl-report-2',
    canonicalTemplateId: 'c-report-2',
    originRuntime: 'document_template',
    source: 'canonical',
    orphaned: false,
    title: 'Initiative closeout report',
    description: 'Final report capturing outcomes, lessons and next steps.',
    type: 'report',
    category: 'initiative_review',
    scope: 'organization',
    status: 'approved',
    sectionCount: 5,
    updatedAt: '2026-09-10T00:00:00.000Z',
    createdBy: 'M. Kowalska',
  },
  {
    id: 'tpl-pres-2',
    artifactIndexId: 'tpl-pres-2',
    canonicalTemplateId: 'c-pres-2',
    originRuntime: 'deck_template',
    source: 'canonical',
    orphaned: false,
    title: 'Project kickoff deck',
    description: 'Kickoff presentation with scope, team and timeline.',
    type: 'presentation',
    category: 'project_kickoff',
    scope: 'organization',
    status: 'approved',
    slideCount: 12,
    updatedAt: '2026-09-08T00:00:00.000Z',
    createdBy: 'System',
  },
  {
    id: 'tpl-sheet-2',
    artifactIndexId: 'tpl-sheet-2',
    canonicalTemplateId: 'c-sheet-2',
    originRuntime: 'sheet_template',
    source: 'canonical',
    orphaned: false,
    title: 'Financial review workbook',
    description: 'Spreadsheet template for monthly financial review.',
    type: 'sheet',
    category: 'financial_review',
    scope: 'personal',
    status: 'approved',
    updatedAt: '2026-09-05T00:00:00.000Z',
    createdBy: 'J. Wisniewski',
  },
];

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
        {/* 1321px container → 3 columns of ~427px each, the tile width the
            D-36 debt measured in the real hub at viewport 1440px. */}
        <div style={{ width: 1321, margin: '0 auto', padding: '24px 0' }}>
          <TemplatesGalleryView
            templates={fixtures}
            scopeLabel={(scope) =>
              scope === 'personal'
                ? 'Personal'
                : scope === 'system'
                  ? 'Application'
                  : scope === 'organization'
                    ? 'Organization'
                    : 'Unknown'
            }
            resolveUsePath={() => '/presentations?tab=templates'}
            onUse={() => undefined}
            onBuild={() => undefined}
            onDuplicate={() => undefined}
            onPreview={() => undefined}
          />
        </div>
      </React.Suspense>
      <Toaster position="bottom-center" />
    </React.StrictMode>
  );
});

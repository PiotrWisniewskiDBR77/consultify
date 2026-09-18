/**
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q1(b) + Q2) — harness host for the
 * STANDALONE document screen `/documents/:artifactId` reached four ways:
 *
 *   entry=url         → the bare deep link (chat / e-mail / browser history)
 *   entry=initiative  → REAL `InitiativeCompactPanel` › Outputs › row click
 *   entry=notebook    → REAL `NotebookContextPanel` › linked output › Open,
 *                       consumed by the REAL `MyWorkHub` `mywork-open-item` handler
 *   entry=rezultaty   → REAL `RezultatyView` › deliverable › Open
 *
 * What is real: the route component (`DocumentViewerRoute`, exported by
 * `src/routes/AppRoutes.tsx` — the same symbol the registration renders), the
 * whole `DocumentViewerPage` → `DocumentViewer` → `documentContentResolver`
 * chain, the three caller components, the real `react-router` navigation each
 * caller performs, and the registry payloads: `mocks/doc0-etap2a-registry.json`
 * was captured read-only from the PRODUCTION service
 * (`artifactRegistryService.getArtifactForUser` + `buildActionTargetPayload`)
 * against the local staging dump copy (row `4d6600e3-…`, org `468b234c-…`,
 * `delivery_state=ready`), and the document body is the captured production
 * envelope `mocks/doc0-digital-roadmap-envelope.json` (etap 1).
 *
 * What is stubbed: transport only (`window.fetch`), because the harness has no
 * backend. Two harness adapters are documented inline below (the case shell's
 * one-line navigation and the notebook panel's rail container); neither
 * recomputes a path — every path comes from production code.
 *
 * Flag ON through the URL (`?ff_doc0_document_viewer=1`, highest precedence in
 * `documentViewerFlag`); `=0` shows the OFF parity (no viewer, old target).
 *
 * URL: /doc0-etap2a.html?lang=en&theme=light|dark&ff_doc0_document_viewer=1&entry=url|initiative|notebook|rezultaty
 */
import React from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';

import type {
  CaseArtifactLink,
  CaseCoreView,
  ValueMeasurement,
} from '../../src/components/CaseWorkspace/types';
import { RezultatyView } from '../../src/components/CaseWorkspace/RezultatyView';
import type { PortfolioInitiative } from '../../src/types';
import { InitiativeCompactPanel } from '../../src/components/Initiatives/InitiativeCompactPanel';
import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { NotebookContextPanel } from '../../src/components/MyWork/notebook/NotebookContextPanel';
import { STORY_RAIL_DISMISSED_KEY } from '../../src/components/demo/storyRailStops';
import { doneKey } from '../../src/components/Onboarding/useFirstRunOnboarding';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { MainLayout } from '../../src/layouts/MainLayout';
import { AppProviders } from '../../src/providers/AppProviders';
import { DocumentViewerRoute } from '../../src/routes/AppRoutes';
import { Api } from '../../src/services/api';

import ENVELOPE from '../mocks/doc0-digital-roadmap-envelope.json';
import REGISTRY from '../mocks/doc0-etap2a-registry.json';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
localStorage.setItem(doneKey('user-piotr-demo'), 'true');
localStorage.setItem(STORY_RAIL_DISMISSED_KEY, 'true');

const ARTIFACT = REGISTRY.artifactEnvelope.data;
const ARTIFACT_ID = ARTIFACT.artifactId;
const ORIGIN_RECORD_ID = ARTIFACT.originRecordId;
const TITLE = ARTIFACT.resolvedTitle;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Transport stub. Order matters — the longest/most specific URL first.
const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(`/api/artifacts/${ARTIFACT_ID}/content`)) return jsonResponse(ENVELOPE);
  if (url.includes(`/api/artifacts/${ARTIFACT_ID}/action-target`)) {
    return jsonResponse(REGISTRY.actionTargetEnvelope);
  }
  if (url.includes(`/api/artifacts/${ARTIFACT_ID}`)) return jsonResponse(REGISTRY.artifactEnvelope);
  // `useArtifactOutputsForOrigins` (NotebookContextPanel) reads ONE artifact per
  // origin: `/api/artifacts/origin/<runtime>/<id>` → `{ data: <item> }`.
  if (url.includes('/api/artifacts/origin/')) return jsonResponse({ data: ARTIFACT });
  // Every registry LIST read (`?limit=`, `?sourceInitiativeId=`, `?originRuntime=`)
  // answers with the one real captured row.
  if (url.includes('/api/artifacts')) return jsonResponse({ data: [ARTIFACT] });
  // `v8Get` unwraps `data`, and `buildInboxResponseFromCanonical` then reads
  // `.items` — an array under `data` would throw and log 4 console errors.
  if (url.includes('/my-work/inbox/canonical')) {
    return jsonResponse({ data: { items: [], total: 0, bySection: {} } });
  }
  // `RezultatyView` › `useOtwarciaZBackendu` — the authoritative open-state read.
  if (url.includes('/artifact-links/') && url.endsWith('/open')) {
    return jsonResponse({
      linkId: 'cwlink-doc0-1',
      caseId: 'case-doc0-1',
      relation: 'DELIVERABLE',
      state: 'AVAILABLE',
      deepLink: { artifactType: 'document', artifactId: ARTIFACT_ID },
      isStale: false,
      staleReason: null,
      staleMarkedAt: null,
      unavailableReason: null,
      unavailableMarkedAt: null,
      unlinkReason: null,
      unlinkedAt: null,
      returnContext: { caseId: 'case-doc0-1' },
      resolvedAt: '2026-09-18T10:00:00.000Z',
    });
  }
  if (url.includes(`/api/initiatives/`)) {
    return jsonResponse({ data: INITIATIVE, id: INITIATIVE.id, name: INITIATIVE.name });
  }
  // Benign catch-all (etap 1 pattern): OrgContext and the shell read raw
  // `window.fetch`; without this the browser auto-logs a 404 and
  // `bledyKonsoli` ≠ 0 even though every consumer degrades gracefully.
  if (url.includes('/api/')) return jsonResponse({ data: [], items: [], organizations: [] });
  return realFetch(input as RequestInfo | URL, init);
}) as typeof window.fetch;

const INITIATIVE = {
  id: 'ini-doc0-1',
  name: 'Digital transformation programme',
  status: 'in_progress',
  health: 'GREEN',
  progress: 62,
  owner: 'Daniel Osei',
  startDate: '2026-03-02',
  endDate: '2026-12-18',
} as unknown as PortfolioInitiative;

// `Api.getInitiativeById` is the panel's own read; answer it with the same
// realistic row instead of letting it fall into the empty catch-all.
(Api as unknown as Record<string, unknown>).getInitiativeById = async () => INITIATIVE;

const CASE_ITEM = {
  caseId: 'case-doc0-1',
  projectId: 'proj-doc0-1',
  organizationId: ARTIFACT.organizationId,
  caseName: 'Operating model review — Northwind',
  caseProfile: 'STANDARD',
  governanceTier: 'T2',
  autonomyPolicy: 'HUMAN_IN_THE_LOOP',
  autonomyPolicyRef: null,
  caseStatus: 'IN_FLIGHT',
  contractedClosureType: 'DELIVERY',
  deliveryStatus: 'OPEN',
  decisionStatus: 'OPEN',
  implementationStatus: 'OPEN',
  outcomeStatus: 'NOT_MEASURED',
  closureType: null,
  closedAt: null,
  closedByActorId: null,
  closureEvidenceRef: null,
  sponsorUserId: null,
  acceptanceCriteriaRef: null,
  budgetPolicyRef: null,
  currentPlanVersionId: null,
  createdByActorId: 'actor-doc0-1',
  version: 3,
  createdAt: '2026-08-04T09:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
  completedAt: null,
  projectName: 'Northwind operations',
  projectDescription: null,
  projectOwnerId: null,
} as unknown as CaseCoreView;

const MEASUREMENTS: ValueMeasurement[] = [];

const ARTIFACT_LINKS = [
  {
    linkId: 'cwlink-doc0-1',
    caseId: 'case-doc0-1',
    artifactType: 'document',
    artifactId: ARTIFACT_ID,
    artifactRevision: null,
    relation: 'DELIVERABLE',
    linkStatus: 'ACTIVE',
    isStale: false,
    staleReason: null,
    linkedAt: '2026-09-08T15:10:00.000Z',
    updatedAt: '2026-09-08T15:10:00.000Z',
  },
] as unknown as CaseArtifactLink[];

/** entry=initiative — the REAL compact panel, Outputs tab, real row click. */
function InitiativeEntry() {
  return (
    <MainLayout breadcrumbs={['Initiatives']} noPadding>
      <div className="relative h-full min-h-0">
        <InitiativeCompactPanel
          initiative={INITIATIVE}
          initiativeId={INITIATIVE.id}
          isOpen
          onClose={() => undefined}
          mode="overlay"
        />
      </div>
    </MainLayout>
  );
}

/**
 * entry=notebook — the REAL producer (`NotebookContextPanel`, mounted in the
 * rail container the production notebook gives it) beside the REAL consumer
 * (`MyWorkHub`, whose `mywork-open-item` handler performs the navigation).
 * The panel is placed in a rail-width column on the right because the harness
 * does not mount the 4,400-line Tiptap notebook editor next to it; the panel
 * itself, its rows and its click are production code.
 */
function NotebookEntry() {
  return (
    <div className="relative h-screen min-h-0">
      <MyWorkHub />
      <div className="fixed right-0 top-0 z-50 h-full w-[380px] overflow-y-auto border-l border-c-border-subtle bg-c-surface">
        <NotebookContextPanel
          open
          onClose={() => undefined}
          editor={null}
          noteId="page-doc0-1"
          noteTitle="Workshop 3 — data migration"
          noteTags={['workshop', 'migration']}
          allNotes={[]}
          noteConvertedTo={[{ type: 'report', id: ORIGIN_RECORD_ID }]}
        />
      </div>
    </div>
  );
}

/**
 * entry=rezultaty — the REAL `RezultatyView`. The case shell normally performs
 * the navigation (`CaseDetailScreen.tsx:1411 navigate(zadanie.sciezka)` after
 * saving the return snapshot); the harness does exactly that one line, so the
 * path itself still comes from `RezultatyView`'s own classifier.
 */
function RezultatyEntry() {
  const navigate = useNavigate();
  return (
    <MainLayout breadcrumbs={['Cases', CASE_ITEM.caseName]} noPadding>
      <div className="h-full min-h-0 overflow-y-auto p-6">
        <RezultatyView
          caseItem={CASE_ITEM}
          measurements={MEASUREMENTS}
          artifactLinks={ARTIFACT_LINKS}
          onOpenDeliverable={(zadanie) => navigate(zadanie.sciezka)}
        />
      </div>
    </MainLayout>
  );
}

export default function Doc0Etap2aDeepLinkScreen() {
  return (
    <FeatureFlagsProvider showDevTools={false}>
      <AppProviders>
        <div className="h-screen min-h-0 bg-c-canvas text-c-text">
          <Routes>
            <Route path="/documents/:artifactId" element={<DocumentViewerRoute />} />
            <Route path="/initiatives/:initiativeId" element={<InitiativeEntry />} />
            <Route path="/my-work" element={<NotebookEntry />} />
            <Route path="/my-work/*" element={<NotebookEntry />} />
            <Route path="/cases/:caseId" element={<RezultatyEntry />} />
            <Route
              path="*"
              element={
                <div className="p-6 text-sm text-c-text-secondary" data-testid="doc0-etap2a-noentry">
                  Unknown harness entry ({TITLE} · {ARTIFACT_ID})
                </div>
              }
            />
          </Routes>
        </div>
      </AppProviders>
    </FeatureFlagsProvider>
  );
}

export const DOC0_ETAP2A_TARGETS = { ARTIFACT_ID, ORIGIN_RECORD_ID, TITLE };

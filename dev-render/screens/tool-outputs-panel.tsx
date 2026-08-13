/**
 * Harness: ToolOutputsPanel (S4 read/list/reopen surface).
 *
 * Same philosophy as tools-swot-report.tsx: builds a REAL Output through the
 * real domain chain (buildSwotOutput → approve → renderToolReport), then
 * serves it to the REAL production component (`ToolOutputsView`, which wraps
 * `ToolOutputsPanel` — same S4 read/list/reopen logic, calling
 * `src/services/api.ts`) via a STATEFUL `fetch` stub — mutating the stub's
 * in-memory store on `reopen`, matching this repo's own established lesson
 * (loop-do-9: "mock w harnessie MUSI być stanowy") rather than a static
 * fixture that can't exercise the reopen flow at all.
 *
 * H1 (SPEC-A shell fala): `ToolOutputsView` is the shared shell
 * (`ToolArtifactShell` → Menu 1 + right panel) around the unchanged
 * `ToolOutputsPanel` — see src/components/DiscoveryTools/report/ToolOutputsView.tsx.
 *
 * Renders the REAL component, not a screenshot mockup — CLAUDE.md #7.
 *
 * URL: ?screen=tool-outputs-panel&theme=light|dark
 */
import React from 'react';

import ToolOutputsView from '@/components/DiscoveryTools/report/ToolOutputsView';
import { approve, reopen as reopenLifecycle, submitForReview } from '@/toolOutputs/outputLifecycle';
import { renderToolReport } from '@/toolOutputs/renderReport';
import { buildSwotOutput } from '@/toolOutputs/buildSwotOutput';
import type { SWOTItem, SWOTMove, SWOTTension } from '@/store/useToolStore';
import type { ToolOutput } from '@/toolOutputs/types';

const SESSION_ID = 'sess-demo-1';

const ITEMS: SWOTItem[] = [
  {
    id: 'i1',
    text: 'Zespół wdrożeniowy z 40 zamkniętymi projektami',
    impact: 'high',
    quadrant: 'strengths',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
  {
    id: 'i2',
    text: 'Popyt w DACH rośnie trzeci kwartał z rzędu',
    impact: 'high',
    quadrant: 'opportunities',
    proposalStatus: 'accepted',
    evidenceStatus: 'confirmed',
  },
] as SWOTItem[];

const TENSIONS: SWOTTension[] = [
  {
    id: 't1',
    title: 'Doświadczony zespół × rosnący popyt w DACH',
    type: 'attack',
    linkedCorrelationIds: [],
    linkedItemIds: ['i1', 'i2'],
    insight: 'Przewaga wdrożeniowa jest niewykorzystana w otwierającym się oknie.',
  },
] as SWOTTension[];

const MOVES: SWOTMove[] = [
  {
    id: 'm1',
    title: 'Uruchomić pilota referencyjnego w DACH',
    category: 'quick-win',
    rationale: 'Popyt rośnie, a zdolność wdrożeniowa jest wolna.',
    linkedTensionIds: ['t1'],
    linkedItemIds: ['i1', 'i2'],
    expectedImpact: 'high',
    estimatedEffort: 'medium',
    firstStep: 'Wybrać klienta pilotażowego',
    ownerRole: 'Dyrektor sprzedaży',
    tradeoff: { chosen: 'Pilot w DACH', deferred: 'Rozwój produktu', cost: 'Dług produktowy +1Q' },
    rejectedAlternative: { option: 'Wejście przez partnera', reason: 'Utrata kontroli nad wdrożeniem' },
  },
] as SWOTMove[];

function buildApprovedOutput(id: string, version: number, supersedesId?: string): ToolOutput {
  const { output } = buildSwotOutput({
    id,
    organizationId: 'org-demo',
    toolSessionId: SESSION_ID,
    methodPackVersion: '1.0.0',
    title: 'Dynamic SWOT — wejście na rynek DACH',
    createdAt: '2026-08-13T10:00:00Z',
    items: ITEMS,
    tensions: TENSIONS,
    moves: MOVES,
  });
  const approved = approve(submitForReview(output), 'piotr', '2026-08-13T12:00:00Z');
  return { ...approved, id, version, supersedesId };
}

/** In-memory, mutable store — reopen() genuinely mutates it, like the real backend. */
const store: { outputs: ToolOutput[] } = {
  outputs: [buildApprovedOutput('out-1', 1)],
};

const reportDoc = renderToolReport([store.outputs[0]], {
  id: 'rep-1',
  organizationId: 'org-demo',
  kind: 'report',
  title: 'Dynamic SWOT — wejście na rynek DACH',
});
const presentationDoc = renderToolReport([store.outputs[0]], {
  id: 'deck-1',
  organizationId: 'org-demo',
  kind: 'presentation',
  title: 'Wejście na rynek DACH — rekomendacja',
});

const outputSummary = (o: ToolOutput) => ({
  id: o.id,
  toolSessionId: o.toolSessionId,
  toolType: o.toolType,
  version: o.version,
  supersedesId: o.supersedesId ?? null,
  title: o.title,
  status: o.status,
  contentHash: o.contentHash,
  createdAt: o.createdAt,
  approvedAt: o.approvedAt ?? null,
  isCurrent: o.status !== 'superseded',
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Stateful fetch stub — routes by URL/method against the mutable `store`. */
function installFetchStub() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/tool-outputs') && method === 'GET' && !url.includes('/reports') && !url.match(/\/tool-outputs\/[^/?]+$/) && !url.includes('/initiative-proposals')) {
      return json({ outputs: store.outputs.map(outputSummary) });
    }
    const reportsMatch = url.match(/\/tool-outputs\/([^/?]+)\/reports$/);
    if (reportsMatch && method === 'GET') {
      const outputId = reportsMatch[1];
      const exists = store.outputs.some((o) => o.id === outputId);
      if (!exists) return json({ error: 'not found' }, 404);
      return json({
        reports: [
          { id: 'rep-1', kind: 'report', title: reportDoc.title, status: 'approved', createdAt: '2026-08-13T12:05:00Z' },
          { id: 'deck-1', kind: 'presentation', title: presentationDoc.title, status: 'approved', createdAt: '2026-08-13T12:05:00Z' },
        ],
      });
    }
    const reportDetailMatch = url.match(/\/tool-outputs\/reports\/([^/?]+)$/);
    if (reportDetailMatch && method === 'GET') {
      const doc = reportDetailMatch[1] === 'deck-1' ? presentationDoc : reportDoc;
      return json({ report: { id: doc.id, kind: doc.kind, title: doc.title, doc } });
    }
    const proposalsMatch = url.match(/\/tool-outputs\/([^/?]+)\/initiative-proposals$/);
    if (proposalsMatch && method === 'GET') {
      return json({
        proposals: [
          {
            id: 'prop-1',
            proposedTitle: 'Uruchomić pilota referencyjnego w DACH',
            status: 'accepted',
            initiativeId: 'init-1',
            sourceConclusionId: 'm1',
          },
        ],
      });
    }
    const reopenMatch = url.match(/\/tool-outputs\/([^/?]+)\/reopen$/);
    if (reopenMatch && method === 'POST') {
      const outputId = reopenMatch[1];
      const current = store.outputs.find((o) => o.id === outputId && o.status !== 'superseded');
      if (!current) return json({ error: 'not found or not approved' }, current ? 409 : 404);
      const newId = `out-${store.outputs.length + 1}`;
      const { superseded, revision } = reopenLifecycle(current, newId, new Date().toISOString());
      const approvedRevision = approve(submitForReview(revision), 'piotr', new Date().toISOString());
      store.outputs = store.outputs.map((o) => (o.id === current.id ? superseded : o));
      store.outputs.push(approvedRevision);
      return json({
        superseded: { id: superseded.id, status: superseded.status },
        revision: {
          id: approvedRevision.id,
          version: approvedRevision.version,
          supersedesId: approvedRevision.supersedesId,
          status: approvedRevision.status,
          contentHash: approvedRevision.contentHash,
        },
      });
    }
    const detailMatch = url.match(/\/tool-outputs\/([^/?]+)$/);
    if (detailMatch && method === 'GET') {
      const found = store.outputs.find((o) => o.id === detailMatch[1]);
      if (!found) return json({ error: 'not found' }, 404);
      return json({ output: { ...outputSummary(found), items: found.items, tensions: found.tensions, conclusions: found.conclusions } });
    }

    return realFetch(input, init);
  };
}

installFetchStub();

export default function ToolOutputsPanelScreen() {
  return (
    <div className="h-screen bg-c-bg">
      <ToolOutputsView toolSessionId={SESSION_ID} sessionTitle="Dynamic SWOT — wejście na rynek DACH" />
    </div>
  );
}

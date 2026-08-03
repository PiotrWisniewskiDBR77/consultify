/**
 * EXE-002-004 — UI audit harness for the execution management spine
 * (plan/milestone/task · role/resource · RAID) added on top of the
 * `init-showcase-margin-leakage-recovery` fixture (same base as
 * `initiative-record.tsx`, see that file's header for the fetchAll()
 * short-circuit strategy).
 *
 * WHY A DEDICATED HARNESS (not just reusing initiative-record.tsx as-is):
 * that screen's generic `/api/**` safety net returns one flat, stateless
 * empty envelope for every call — fine for the sections it wasn't built to
 * exercise, but useless for verifying THIS branch's actual changes:
 *   - milestone creation (TasksMilestonesSection.tsx: new "Add milestone"
 *     button/modal/list) needs POST to actually create a row and GET to
 *     reflect it, or the list would always render empty and the toast would
 *     fire over nothing.
 *   - RAID persistence (RaidSection.tsx: was pure local-state before this
 *     branch, now POST/PATCH/DELETE-backed) needs the same round-trip to
 *     prove the fix — a generic mock would make a still-broken RaidSection
 *     look identical to a fixed one (both would "work" against a stub that
 *     always returns success with no real backing store).
 *
 * MOCK STRATEGY: patch `window.fetch` (confirmed by reading src/services/
 * api.ts — `Api.get/post/patch/delete` build a URL via `buildApiUrl` and
 * call the global `fetch()`, there is no separate axios/XHR layer to
 * intercept) with a small in-memory, STATEFUL store for exactly the
 * endpoints this branch touches. Everything else (v8, misc /api/**)
 * degrades to the same empty-envelope safety net as initiative-record.tsx
 * so the rest of the artifact shell renders exactly as it does today.
 */
import React from 'react';

import { InitiativeDocumentView } from '../../src/components/Initiatives/InitiativeDocumentView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

const INITIATIVE_ID = 'init-showcase-margin-leakage-recovery';

type MilestoneRow = {
  id: string;
  name: string;
  description?: string;
  targetDate: string | null;
  status: string;
  isGate: boolean;
  createdAt: string;
};

type RaidRow = Record<string, unknown> & { id: string; type: string; title: string };

type TaskRow = Record<string, unknown> & { id: string; title: string };

// Seed one pre-existing milestone + one pre-existing RAID item so the
// "already has data, does GET/reopen render it" path is exercised too, not
// just the empty-state.
const state = {
  milestones: [
    {
      id: 'ms-seed-1',
      name: 'Discovery workshop complete',
      description: 'Kickoff + stakeholder mapping',
      targetDate: '2026-08-15',
      status: 'PENDING',
      isGate: false,
      createdAt: new Date().toISOString(),
    },
  ] as MilestoneRow[],
  raid: [
    {
      id: 'raid-seed-1',
      type: 'RISK',
      title: 'Vendor SLA gap',
      description: 'Existing risk seeded for the audit',
      status: 'OPEN',
      impact: 'HIGH',
      probability: 'MEDIUM',
      riskScore: 6,
      ownerId: null,
      dueDate: null,
    },
  ] as RaidRow[],
  tasks: [] as TaskRow[],
  nextId: 100,
};

const genId = (prefix: string) => `${prefix}-${state.nextId++}`;

async function readJsonBody(init?: RequestInit): Promise<any> {
  if (!init?.body) return {};
  try {
    return JSON.parse(init.body as string);
  } catch {
    return {};
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// `refreshInitiativeWriteTruth` (fired ~3s after mount by InitiativeDocumentView's
// autosave timer, and again on manual save) re-fetches gate-readiness over the
// network and OVERWRITES the showcase fixture's `gateReadiness` — which is the
// only thing carrying `capabilities.cards.canEditCards`. Without a realistic
// response here, every edit affordance (including RaidSection/TasksMilestonesSection's
// "Dodaj element"/"Add milestone" buttons, gated by `!locked`/`canEditCards`)
// silently re-locks a few seconds after mount, well before a human has time to
// click anything. Mirrors the showcase fixture's gateReadiness shape
// (initiativesDemoData.ts:1208-1245) so canEditCards stays true.
const GATE_READINESS_TRUE: Record<string, unknown> = {
  currentStatus: 'EXECUTING',
  userRoles: ['INITIATIVE_OWNER', 'SPONSOR'],
  availableTransitions: [],
  capabilities: {
    version: 1,
    source: 'backend',
    topBar: { canEditPriority: true, canEditOwner: true, canEditTargetDate: true },
    cards: { canEditCards: true, reasonCode: null },
    reasonCodes: {},
    ctaBar: {
      workflowActions: [],
      contextCreateActions: ['task', 'decision', 'risk'],
      canUseAi: true,
    },
  },
  readiness: [],
};

const V8_EMPTY_ENVELOPE = {
  initiative: null,
  dependencies: [],
  watchers: [],
  stakeholders: [],
  roles: [],
  history: [],
  events: [],
  comments: [],
  readiness: null,
  resources: [],
  kpis: [],
  budgetItems: [],
  tools: [],
  intangibleAssets: [],
  items: [],
};

const g = window as unknown as { __EXE002004_AUDIT_FETCH__?: boolean };
if (!g.__EXE002004_AUDIT_FETCH__) {
  g.__EXE002004_AUDIT_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes('/gate-readiness-check')) {
      if (url.includes('/api/v8/')) {
        return jsonResponse({ data: { readiness: GATE_READINESS_TRUE } });
      }
      return jsonResponse(GATE_READINESS_TRUE);
    }

    // ── EXE-02: milestones ──────────────────────────────────────────────
    const milestonesMatch = url.match(/\/initiatives\/[^/]+\/milestones(?:\/([^/?]+))?/);
    if (milestonesMatch) {
      const milestoneId = milestonesMatch[1];
      if (method === 'GET') {
        return jsonResponse({ milestones: state.milestones });
      }
      if (method === 'POST') {
        const body = await readJsonBody(init);
        const idempotencyKey = body.idempotencyKey as string | undefined;
        if (idempotencyKey) {
          const existing = state.milestones.find(
            (m) => (m as any)._idempotencyKey === idempotencyKey
          );
          if (existing)
            return jsonResponse({ success: true, idempotent: true, milestone: existing });
        }
        const created: MilestoneRow & { _idempotencyKey?: string } = {
          id: genId('ms'),
          name: String(body.name || ''),
          description: body.description || '',
          targetDate: body.targetDate || null,
          status: 'PENDING',
          isGate: Boolean(body.isGate),
          createdAt: new Date().toISOString(),
          _idempotencyKey: idempotencyKey,
        };
        state.milestones.push(created);
        return jsonResponse({ success: true, milestone: created }, 201);
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = await readJsonBody(init);
        const idx = state.milestones.findIndex((m) => m.id === milestoneId);
        if (idx >= 0) state.milestones[idx] = { ...state.milestones[idx], ...body };
        return jsonResponse({ success: true, milestone: state.milestones[idx] });
      }
      if (method === 'DELETE') {
        state.milestones = state.milestones.filter((m) => m.id !== milestoneId);
        return jsonResponse({ success: true });
      }
    }

    // ── EXE-04: RAID ─────────────────────────────────────────────────────
    const raidMatch = url.match(/\/initiatives\/[^/]+\/raid(?:\/([^/?]+))?/);
    if (raidMatch) {
      const raidId = raidMatch[1];
      if (method === 'GET') {
        return jsonResponse({ items: state.raid });
      }
      if (method === 'POST') {
        const body = await readJsonBody(init);
        const idempotencyKey = body.idempotencyKey as string | undefined;
        if (idempotencyKey) {
          const existing = state.raid.find((r) => (r as any)._idempotencyKey === idempotencyKey);
          if (existing) return jsonResponse({ success: true, idempotent: true, id: existing.id });
        }
        const created: RaidRow & { _idempotencyKey?: string } = {
          id: genId('raid'),
          type: String(body.type || 'RISK').toUpperCase(),
          title: body.title || '',
          description: body.description || '',
          status: 'OPEN',
          impact: body.severity ? String(body.severity).toUpperCase() : 'MEDIUM',
          probability: body.probability ? String(body.probability).toUpperCase() : undefined,
          ownerId: body.ownerId || null,
          dueDate: body.dueDate || null,
          _idempotencyKey: idempotencyKey,
        };
        state.raid.push(created);
        return jsonResponse({ success: true, id: created.id }, 201);
      }
      if (method === 'PATCH' || method === 'PUT') {
        const body = await readJsonBody(init);
        const idx = state.raid.findIndex((r) => r.id === raidId);
        if (idx >= 0) state.raid[idx] = { ...state.raid[idx], ...body };
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        state.raid = state.raid.filter((r) => r.id !== raidId);
        return jsonResponse({ success: true });
      }
    }

    // ── EXE-02: tasks (POST /api/tasks with initiativeId in body) ────────
    if (/\/tasks\/?$/.test(url) && !url.includes('/tasks/')) {
      if (method === 'POST') {
        const body = await readJsonBody(init);
        const idempotencyKey = body.idempotencyKey as string | undefined;
        if (idempotencyKey && body.initiativeId) {
          const existing = state.tasks.find((t) => (t as any)._idempotencyKey === idempotencyKey);
          if (existing) return jsonResponse({ ...existing, idempotent: true });
        }
        const created: TaskRow & { _idempotencyKey?: string } = {
          id: genId('task'),
          title: body.title || '',
          status: body.status || 'todo',
          priority: body.priority || 'medium',
          initiativeId: body.initiativeId,
          _idempotencyKey: idempotencyKey,
        };
        state.tasks.push(created);
        return jsonResponse(created, 201);
      }
    }

    if (url.includes('/api/v8/')) return jsonResponse({ data: V8_EMPTY_ENVELOPE });
    if (url.includes('/api/')) {
      return jsonResponse({ data: [], items: [], events: [], organizations: [] });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function Exe002004UiAuditScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
          <InitiativeDocumentView
            key={`exe-002-004-audit-${INITIATIVE_ID}`}
            initiativeId={INITIATIVE_ID}
            sourceModule="execution"
            onBack={() => {}}
            onStatusChange={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default Exe002004UiAuditScreen;

/**
 * FORMULA-20 — dev-render host for the REAL `<DecisionDetailView>` (archetyp
 * C · Rekord, SPEC-A powłoka NModeShell) — Decision artifact.
 *
 * `DecisionDetailView` (src/components/MyWork/DecisionDetailView.tsx) is the
 * REAL production component — no re-implementation. It self-fetches through
 * `Api.getDecision` / `Api.getDecisionHistory` / `Api.get('/decisions/:id/
 * stakeholders')` / `Api.get('/users')` (loadDecision + loadUsers effects,
 * keyed on `decisionId`). `Api` is a plain exported object
 * (`export const Api = {...}`), so reassigning a method patches the same
 * singleton every module imports (pattern from
 * dev-render/screens/melscanvas-workspace.tsx).
 *
 * We only stub `Api.getDecision` with the record's own fields (title,
 * description, status, priority, category, dates, rationale, decider,
 * project). We deliberately leave alternatives/risks/stakeholders/comments/
 * attachments/linkedItems/reminders/escalation OUT of the mock — the real
 * component's `loadDecision()` already falls back to its own
 * DEMO_ALTERNATIVES / DEMO_RISKS / DEMO_STAKEHOLDERS (RACI) / DEMO_COMMENTS /
 * DEMO_ATTACHMENTS / DEMO_LINKED_ITEMS / DEMO_REMINDERS / DEMO_ESCALATION
 * constants whenever `isDemo` is true (useDemoSession → isDemoMode ||
 * currentUser.isDemo, both set by `seedRealisticSession()`). That gives us a
 * fully populated Options/Criteria(impactScore)/Recommendation/RACI/Risk
 * record for free, using the SAME data the real app shows in its own demo
 * mode — not a bespoke reinvention.
 *
 * `Api.getDecisionHistory` / `Api.get('/users')` are stubbed directly so the
 * activity-log and RACI "assign person" dropdown have data without hitting
 * the absent dev-render backend; `Api.get('/decisions/:id/stakeholders')`
 * is left to reject (caught internally → DEMO_STAKEHOLDERS fallback, same
 * as the real component's own offline/error path).
 *
 * Mounted inside `AppProviders` (supplies BrowserRouter + the full provider
 * tree once `currentUser` is seeded) + `FeatureFlagsProvider`, matching the
 * melscanvas-workspace.tsx harness pattern 1:1.
 *
 * URL: ?screen=decision-record[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { DecisionDetailView } from '../../src/components/MyWork/DecisionDetailView';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const DECISION_ID = 'decision-dbr77-demo-1';

const MOCK_DECISION = {
  id: DECISION_ID,
  title: 'Wybór podejścia do automatycznego generowania raportów DRD',
  description:
    'Musimy zdecydować, jak zautomatyzować generowanie raportów końcowych z wywiadów ' +
    'klienckich — w pełni zautomatyzowana pipeline AI, model hybrydowy z recenzją ' +
    'konsultanta, czy szablon manualny. Wybór wpływa na 4 aktywne projekty klienckie.',
  status: 'pending',
  workflowStatus: 'review',
  priority: 'high',
  category: 'technical',
  dueDate: '2026-08-05T00:00:00Z',
  decisionDate: null,
  createdAt: '2026-07-10T08:00:00Z',
  updatedAt: '2026-07-18T15:30:00Z',
  rationale:
    'Opóźnienie decyzji o sposobie generowania raportów zablokuje 4 aktywne projekty ' +
    'klienckie przed terminowym dostarczeniem raportów DRD. Każdy tydzień zwłoki ' +
    'zwiększa koszt manualnej pracy o ~€8 000 i zagraża wskaźnikom SLA. Dwaj klienci ' +
    'enterprise mają umowne terminy w marcu 2026.',
  requestedByName: 'Anna Kowalska',
  deciderId: 'user-piotr-demo',
  projectName: 'DRD Automatyzacja Raportów',
  contextDetails:
    'Program automatyzacji raportowania — faza wyboru architektury po zakończeniu POC.',
};

const MOCK_USERS = [
  {
    id: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
  },
  { id: 'user-anna', firstName: 'Anna', lastName: 'Kowalska', email: 'anna.kowalska@dbr77.com' },
  {
    id: 'user-marek',
    firstName: 'Marek',
    lastName: 'Zieliński',
    email: 'marek.zielinski@dbr77.com',
  },
  {
    id: 'user-kasia',
    firstName: 'Katarzyna',
    lastName: 'Nowak',
    email: 'katarzyna.nowak@dbr77.com',
  },
];

Api.getDecision = (async () => MOCK_DECISION) as typeof Api.getDecision;
Api.getDecisionHistory = (async () => []) as typeof Api.getDecisionHistory;

const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url === '/users') return { users: MOCK_USERS };
  if (url.includes('/stakeholders')) throw new Error('mock: stakeholders endpoint not stubbed');
  return realApiGet(url);
}) as typeof Api.get;

// Safety net: anything else this heavy component fires on mount (presence,
// notifications, knowledge-card lookups, AI suggestions, …) resolves to an
// empty/neutral payload instead of hitting the dev-render vite server and
// throwing an HTML-body JSON-parse console error. i18n's /locales/** still
// passes through to the real fetch.
const g = window as unknown as { __DECISION_RECORD_FETCH__?: boolean };
if (!g.__DECISION_RECORD_FETCH__) {
  g.__DECISION_RECORD_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/api/') || url.includes('/decisions/') || url.includes('/users')) {
      return new Response(JSON.stringify({ data: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function DecisionRecordScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <DecisionDetailView
            key={`decision-${DECISION_ID}`}
            decisionId={DECISION_ID}
            onClose={() => {}}
            onSaved={() => {}}
          />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default DecisionRecordScreen;

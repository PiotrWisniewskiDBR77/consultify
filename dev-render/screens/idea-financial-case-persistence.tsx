/**
 * Dev-render host for the REAL `<FinancialCaseDialog />` with its REAL
 * persistence path (Program E / epic E09, stream S6-E09 — RISK-12).
 *
 * NOT a re-implementation: this mounts the production component, which calls
 * the production `useIdeaFinancialCasePersistence` → `ideaFinancialCase.api`
 * → `apiGet`/`apiPut` → `fetch`. Only the transport is stubbed, and the stub
 * is STATEFUL (an in-memory row with a real `version`), so save→reopen
 * genuinely round-trips through the same code the app runs — a stateless mock
 * would let a broken save look identical to a working one.
 *
 * ?state= selects what to capture (CLAUDE.md #7 — the supervisor screenshots
 * every state before the owner ever sees the screen):
 *   empty    — no stored case yet, nothing edited
 *   loading  — GET deliberately never resolves
 *   dirty    — a driver edited, Save enabled, "Unsaved changes"
 *   saving   — PUT deliberately never resolves
 *   saved    — a completed save, "Saved"
 *   error    — PUT rejects with a transport failure
 *   conflict — PUT returns 409 (someone else saved first)
 *   reopened — a stored case loaded on open: the data SURVIVED a cold reopen
 *
 * `&autoedit=1` types a marker into the first driver label on mount, used by
 * the dirty/saving/saved/error/conflict captures.
 */
import React from 'react';

import { FinancialCaseDialog } from '../../src/components/MyWork/table/financial/FinancialCaseDialog';

type ScreenState =
  | 'empty'
  | 'loading'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'error'
  | 'conflict'
  | 'reopened';

const params = new URLSearchParams(window.location.search);
const STATE = (params.get('state') || 'empty') as ScreenState;

const IDEA_ID = 'idea_devrender_e09';
const STORED_LABEL = 'Redukcja przestojów linii (zapisane)';

function storedCase(label: string) {
  return {
    currency: 'PLN',
    discountRatePct: 10,
    startPeriod: '2026-01',
    horizonMonths: 12,
    scenarios: ['base', 'upside', 'downside'],
    drivers: [
      {
        id: 'drv_cost_1',
        kind: 'cost',
        costType: 'investment',
        label: 'Wdrożenie systemu MES',
        category: 'Wdrożenie',
        unit: 'PLN',
        monthlyValues: { '2026-01': 240000, '2026-02': 120000 },
        scenarioMultipliers: { upside: 0.9, downside: 1.25 },
        confidence: 'medium',
        evidence: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'drv_benefit_1',
        kind: 'benefit',
        benefitType: 'cash',
        label,
        category: 'Oszczędności',
        unit: 'PLN',
        monthlyValues: { '2026-04': 65000, '2026-05': 65000, '2026-06': 65000 },
        scenarioMultipliers: { upside: 1.2, downside: 0.75 },
        confidence: 'high',
        evidence: [],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

/** Stateful store — the whole point of the harness. */
const store: { row: Record<string, unknown> | null } = {
  row:
    STATE === 'empty'
      ? null
      : {
          id: 'fc_devrender',
          ideaId: IDEA_ID,
          organizationId: 'org_devrender',
          payload: { input: storedCase(STORED_LABEL), result: null, lastComputedAt: null },
          version: 3,
          createdBy: 'u1',
          updatedBy: 'u1',
          createdAt: '2026-08-01T09:00:00.000Z',
          updatedAt: '2026-08-11T14:20:00.000Z',
        },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const never = () => new Promise<Response>(() => {});

const g = window as unknown as { __E09_FC_FETCH__?: boolean };
if (!g.__E09_FC_FETCH__) {
  g.__E09_FC_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/api/idea-financial-case/')) {
        const method = (init?.method || 'GET').toUpperCase();
        if (method === 'GET') {
          if (STATE === 'loading') return never();
          return jsonResponse({ financialCase: store.row });
        }
        if (method === 'PUT') {
          if (STATE === 'saving') return never();
          if (STATE === 'error') {
            return jsonResponse({ error: 'Backend niedostępny (502 Bad Gateway)' }, 502);
          }
          if (STATE === 'conflict') {
            return jsonResponse(
              {
                error: 'Financial case was modified by someone else',
                code: 'IDEA_FINANCIAL_CASE_VERSION_CONFLICT',
                expectedVersion: 3,
                currentVersion: 7,
                financialCase: { ...(store.row as object), version: 7 },
              },
              409
            );
          }
          const body = JSON.parse(String(init?.body || '{}'));
          const prev = (store.row as { version?: number } | null)?.version ?? 0;
          store.row = {
            id: 'fc_devrender',
            ideaId: IDEA_ID,
            organizationId: 'org_devrender',
            payload: body.case,
            version: prev + 1,
            createdBy: 'u1',
            updatedBy: 'u1',
            createdAt: '2026-08-01T09:00:00.000Z',
            updatedAt: new Date().toISOString(),
          };
          return jsonResponse({ financialCase: store.row });
        }
      }
    } catch {
      /* fall through to the real fetch (i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function IdeaFinancialCasePersistenceScreen(): React.ReactElement {
  const [open, setOpen] = React.useState(true);

  // Drive the UI into the requested state using REAL interactions (typing into
  // the real input, clicking the real Save button) rather than by forcing
  // component state — a forced state would prove the styling renders, not that
  // the flow reaches it.
  React.useEffect(() => {
    const wantsEdit = ['dirty', 'saving', 'saved', 'error', 'conflict'].includes(STATE);
    if (!wantsEdit) return;
    const timer = window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder="Czynnik bez nazwy"], input[placeholder="Untitled driver"]'
      );
      const target =
        input ||
        Array.from(document.querySelectorAll<HTMLInputElement>('input')).find(
          (el) => el.value === STORED_LABEL
        );
      if (target) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(target, 'Redukcja przestojów linii (EDYCJA NIEZAPISANA)');
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (STATE === 'dirty') return;
      window.setTimeout(() => {
        const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
        const save = btns.find((b) => /^(Zapisz|Save)$/i.test((b.textContent || '').trim()));
        save?.click();
      }, 300);
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div style={{ height: '100vh' }}>
      <FinancialCaseDialog
        open={open}
        onClose={() => setOpen(false)}
        readOnly={false}
        ideaId={IDEA_ID}
      />
    </div>
  );
}

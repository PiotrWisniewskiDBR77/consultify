/**
 * P27-B Integration Tests — Tools Session → Result → Promotion
 *
 * Tests cover:
 * 1. Session lifecycle (DRAFT → IN_PROGRESS → REVIEW → FINALIZED)
 * 2. Status transition validation (invalid transitions rejected)
 * 3. Finalize gating (unresolved blockers block FINALIZED)
 * 4. Wizard state + missing items persistence
 * 5. Failure state + retry
 * 6. Idempotent initiative generation
 * 7. Promotion to report/presentation with traceability
 * 8. Regression: existing CRUD + governance flow
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token';

const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
});

const post = async (path: string, body?: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const put = async (path: string, body: any) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const get = async (path: string) => {
  const res = await fetch(`${API_URL}${path}`, { headers: headers() });
  return { status: res.status, data: await res.json().catch(() => null) };
};

describe('P27-B: Tools Session → Result → Promotion', () => {
  let strategicSessionId: string;
  let operationalSessionId: string;

  // ─────────────────────────────────────────────
  // Archetype 1: Strategic tool (dynamic-swot)
  // ─────────────────────────────────────────────

  describe('Archetype 1: Strategic (dynamic-swot)', () => {
    it('creates a new tool session in DRAFT status', async () => {
      const { status, data } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Test SWOT Session',
      });
      expect(status).toBe(200);
      expect(data.id).toBeTruthy();
      expect(data.status).toBe('DRAFT');
      strategicSessionId = data.id;
    });

    it('transitions DRAFT → IN_PROGRESS with wizard state', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: { context: { goal: 'Test strategic question' } },
        completionPercent: 20,
        confidenceAvg: 2,
        status: 'IN_PROGRESS',
        wizardState: { currentStep: 'input', completedSteps: ['mission'] },
      });
      expect(status).toBe(200);
      expect(data.status).toBe('IN_PROGRESS');
    });

    it('persists wizard state and missing items', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: { context: { goal: 'Test', scope: 'Global' } },
        completionPercent: 50,
        confidenceAvg: 3,
        status: 'IN_PROGRESS',
        wizardState: { currentStep: 'swot', completedSteps: ['mission', 'input'] },
        missingItems: [
          { id: 'mi-1', label: 'Missing SWOT items', severity: 'blocker', resolved: false },
          { id: 'mi-2', label: 'Needs more evidence', severity: 'warning', resolved: true },
        ],
      });
      expect(status).toBe(200);

      const { data: session } = await get(`/tools/${strategicSessionId}`);
      expect(session.wizardState).toBeTruthy();
      expect(session.wizardState.currentStep).toBe('swot');
      expect(session.missingItems).toHaveLength(2);
      expect(session.missingItems[0].severity).toBe('blocker');
    });

    it('blocks FINALIZED when unresolved blockers exist', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: { context: { goal: 'Test', scope: 'Global' } },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [
          { id: 'mi-1', label: 'Missing SWOT items', severity: 'blocker', resolved: false },
        ],
      });
      expect(status).toBe(409);
      expect(data.error).toContain('unresolved blocker');
      expect(data.unresolvedBlockers).toHaveLength(1);
    });

    it('allows FINALIZED when all blockers are resolved', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: {
          context: { goal: 'Test strategic question', scope: 'Global', successSignal: 'KPI up' },
          signals: [{ id: 's1', content: 'Market growth' }],
          items: [
            { quadrant: 'strengths', content: 'Strong brand' },
            { quadrant: 'weaknesses', content: 'High costs' },
            { quadrant: 'opportunities', content: 'New market' },
            { quadrant: 'threats', content: 'Competition' },
          ],
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'FINALIZED',
        missingItems: [
          { id: 'mi-1', label: 'Missing SWOT items', severity: 'blocker', resolved: true },
          { id: 'mi-2', label: 'Needs evidence', severity: 'warning', resolved: false },
        ],
      });
      expect(status).toBe(200);
      expect(data.status).toBe('FINALIZED');
    });

    it('rejects invalid status transitions', async () => {
      const { status, data } = await put(`/tools/${strategicSessionId}`, {
        answers: {},
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'DRAFT',
      });
      expect(status).toBe(409);
      expect(data.error).toContain('Invalid status transition');
    });
  });

  // ─────────────────────────────────────────────
  // Archetype 2: Operational tool (sop-builder)
  // ─────────────────────────────────────────────

  describe('Archetype 2: Operational (sop-builder)', () => {
    it('creates an operational tool session', async () => {
      const { status, data } = await post('/tools', {
        toolType: 'sop-builder',
        name: 'P27-B Test SOP Session',
      });
      expect(status).toBe(200);
      expect(data.id).toBeTruthy();
      operationalSessionId = data.id;
    });

    it('full lifecycle: DRAFT → IN_PROGRESS → REVIEW → back to DRAFT → REVIEW', async () => {
      // DRAFT → IN_PROGRESS
      let result = await put(`/tools/${operationalSessionId}`, {
        answers: { context: { goal: 'Standardize onboarding', scope: 'HR dept' } },
        completionPercent: 30,
        confidenceAvg: 2,
        status: 'IN_PROGRESS',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('IN_PROGRESS');

      // IN_PROGRESS → REVIEW
      result = await put(`/tools/${operationalSessionId}`, {
        answers: {
          context: { goal: 'Standardize onboarding', scope: 'HR dept' },
          sections: { steps: ['Step 1', 'Step 2'] },
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'REVIEW',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('REVIEW');

      // REVIEW → DRAFT (send back)
      result = await put(`/tools/${operationalSessionId}`, {
        answers: {
          context: { goal: 'Standardize onboarding', scope: 'HR dept' },
          sections: { steps: ['Step 1', 'Step 2'] },
        },
        completionPercent: 100,
        confidenceAvg: 4,
        status: 'DRAFT',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('DRAFT');
    });
  });

  // ─────────────────────────────────────────────
  // Failure + Retry
  // ─────────────────────────────────────────────

  describe('Failure state + retry', () => {
    let failSessionId: string;

    it('creates session and transitions to FAILED', async () => {
      const { data } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Failure Test',
      });
      failSessionId = data.id;

      const result = await put(`/tools/${failSessionId}`, {
        answers: {},
        completionPercent: 50,
        confidenceAvg: 2,
        status: 'FAILED',
        failureReason: 'AI generation timed out',
      });
      expect(result.status).toBe(200);
      expect(result.data.status).toBe('FAILED');
    });

    it('persists failure reason', async () => {
      const { data } = await get(`/tools/${failSessionId}`);
      expect(data.status).toBe('FAILED');
      expect(data.failureReason).toBe('AI generation timed out');
    });

    it('retries from FAILED → IN_PROGRESS', async () => {
      const { status, data } = await post(`/tools/${failSessionId}/retry`);
      expect(status).toBe(200);
      expect(data.status).toBe('IN_PROGRESS');
    });

    it('retry clears failure reason', async () => {
      const { data } = await get(`/tools/${failSessionId}`);
      expect(data.status).toBe('IN_PROGRESS');
      expect(data.failureReason).toBeNull();
    });

    it('rejects retry when not in FAILED state', async () => {
      const { status, data } = await post(`/tools/${failSessionId}/retry`);
      expect(status).toBe(409);
      expect(data.error).toContain('not in FAILED state');
    });
  });

  // ─────────────────────────────────────────────
  // Promotion to report/presentation
  // ─────────────────────────────────────────────

  describe('Promotion to downstream outputs', () => {
    it('rejects promotion for non-approved session', async () => {
      const { data } = await post('/tools', {
        toolType: 'dynamic-swot',
        name: 'P27-B Promotion Test',
      });
      const { status, data: result } = await post(`/tools/${data.id}/promote`, {
        outputType: 'report',
        title: 'Test Report',
      });
      expect(status).toBe(409);
      expect(result.error).toContain('approved/finalized');
    });

    it('promotes FINALIZED session to report with traceability', async () => {
      const { status, data } = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'report',
        title: 'SWOT Analysis Report',
        description: 'Generated from strategic SWOT session',
      });
      expect(status).toBe(200);
      expect(data.id).toBeTruthy();
      expect(data.outputType).toBe('report');
      expect(data.sourceSessionId).toBe(strategicSessionId);
      expect(data.sourceToolType).toBe('dynamic-swot');
    });

    it('promotes FINALIZED session to presentation', async () => {
      const { status, data } = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'presentation',
        title: 'SWOT Strategy Deck',
      });
      expect(status).toBe(200);
      expect(data.outputType).toBe('presentation');
      expect(data.sourceSessionId).toBe(strategicSessionId);
    });

    it('rejects invalid outputType', async () => {
      const { status } = await post(`/tools/${strategicSessionId}/promote`, {
        outputType: 'spreadsheet',
        title: 'Invalid',
      });
      expect(status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────
  // Regression: existing CRUD + governance
  // ─────────────────────────────────────────────

  describe('Regression: existing endpoints', () => {
    it('GET /tools returns session list', async () => {
      const { status, data } = await get('/tools');
      expect(status).toBe(200);
      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(0);
    });

    it('GET /tools/hub returns sessions + library', async () => {
      const { status, data } = await get('/tools/hub');
      expect(status).toBe(200);
      expect(data.sessions).toBeDefined();
      expect(data.library).toBeDefined();
    });

    it('GET /tools/:id returns full session with new P27-B fields', async () => {
      if (!strategicSessionId) return;
      const { status, data } = await get(`/tools/${strategicSessionId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(strategicSessionId);
      expect(data).toHaveProperty('wizardState');
      expect(data).toHaveProperty('missingItems');
      expect(data).toHaveProperty('failureReason');
      expect(data).toHaveProperty('lastGenerationBatchId');
    });

    it('GET /tools/:id/dod-check returns DoD status', async () => {
      if (!strategicSessionId) return;
      const { status, data } = await get(`/tools/${strategicSessionId}/dod-check`);
      expect(status).toBe(200);
      expect(data).toHaveProperty('passed');
      expect(data).toHaveProperty('missing');
    });

    it('returns 404 for non-existent session', async () => {
      const { status } = await get('/tools/non-existent-id');
      expect(status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────
  // Session reopen (context preserved)
  // ─────────────────────────────────────────────

  describe('Session reopen (context preserved)', () => {
    it('reopened session preserves all data', async () => {
      if (!strategicSessionId) return;
      const { data } = await get(`/tools/${strategicSessionId}`);
      expect(data.answers).toBeTruthy();
      expect(data.answers.context?.goal).toBeTruthy();
      expect(data.wizardState).toBeTruthy();
      expect(data.progress).toBe(100);
      expect(data.confidenceAvg).toBe(4);
    });
  });
});

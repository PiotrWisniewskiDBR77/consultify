/**
 * L4 Smoke - Interview to Initiative Wizard
 *
 * Covers the new transformation initiative creator entrypoint from Interview:
 * - API contract for wizard sessions, candidate generation, and triage.
 * - UI entrypoint in Interview -> Initiatives Menu 3.
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import { expectAppMounted, gotoRuntimeGateRoute, seedE2EAuth } from './runtime-gate-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const IS_MOCK_DB = process.env.MOCK_DB === 'true' || process.env.E2E_MOCK_DB === 'true';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

async function jsonOrText(res: any): Promise<any> {
  const contentType = String(res.headers()?.['content-type'] || '');
  if (contentType.includes('application/json')) return res.json().catch(() => null);
  return res.text().catch(() => '');
}

async function expectStatus(res: any, expected: number, label: string) {
  if (res.status() === expected) return;
  throw new Error(`${label}: expected ${expected}, got ${res.status()} body=${JSON.stringify(await jsonOrText(res))}`);
}

test.describe('L4 Smoke - Interview to Initiative Wizard [@module:interview] [@module:initiatives]', () => {
  test.setTimeout(120000);

  test('wizard API creates session, generates candidates, audits decisions, and rejects invalid input', async ({
    request,
  }) => {
    const { token } = readTestSupportState();
    const headers = authHeaders(token);

    const invalidMode = await request.post(`${API_BASE_URL}/api/initiatives/wizard/sessions`, {
      headers,
      data: {
        mode: 'silent_execution',
        targetCount: 3,
      },
    });
    expect(invalidMode.status()).toBeLessThan(500);
    expect([400, 422]).toContain(invalidMode.status());

    const missingGenerate = await request.post(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/missing-session/candidates/generate`,
      { headers }
    );
    await expectStatus(missingGenerate, 404, 'missing session generate');

    const createSession = await request.post(`${API_BASE_URL}/api/initiatives/wizard/sessions`, {
      headers,
      data: {
        mode: 'generate_from_evidence',
        businessPriorities: ['quality', 'automation', 'governance'],
        targetCount: 3,
        timeHorizon: '90_days',
        riskAppetite: 'balanced',
        manualNotes:
          'Playwright smoke: build transformation initiatives from interview evidence with explicit approval.',
        sourceBasket: [
          {
            type: 'interview_insight',
            id: 'playwright-insight-source',
            title: 'Manual reporting and fragmented data',
          },
        ],
      },
    });
    expect(createSession.ok(), JSON.stringify(await jsonOrText(createSession))).toBeTruthy();

    const sessionBody = await createSession.json();
    const sessionId = String(sessionBody?.session?.id || '');
    expect(sessionId).toBeTruthy();
    expect(sessionBody?.session?.mode).toBe('generate_from_evidence');

    const generate = await request.post(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/${sessionId}/candidates/generate`,
      { headers }
    );
    expect(generate.ok(), JSON.stringify(await jsonOrText(generate))).toBeTruthy();

    const generatedBody = await generate.json();
    const candidates = Array.isArray(generatedBody?.candidates) ? generatedBody.candidates : [];
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0]?.title).toBeTruthy();
    expect(candidates[0]?.triageStatus).toBe('new_candidate');

    const triage = await request.patch(
      `${API_BASE_URL}/api/initiatives/wizard/candidates/${candidates[0].id}/triage`,
      {
        headers,
        data: {
          triageStatus: 'accepted_for_shortlist',
          triageReason: 'Playwright smoke approval.',
        },
      }
    );
    expect(triage.ok(), JSON.stringify(await jsonOrText(triage))).toBeTruthy();

    const triageBody = await triage.json();
    expect(triageBody?.candidate?.triageStatus).toBe('accepted_for_shortlist');

    const list = await request.get(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/${sessionId}/candidates`,
      { headers }
    );
    expect(list.ok(), JSON.stringify(await jsonOrText(list))).toBeTruthy();
    const listBody = await list.json();
    const accepted = (listBody?.candidates || []).find((item: any) => item.id === candidates[0].id);
    expect(accepted?.triageStatus).toBe('accepted_for_shortlist');

    const invalidTriage = await request.patch(
      `${API_BASE_URL}/api/initiatives/wizard/candidates/${candidates[0].id}/triage`,
      {
        headers,
        data: { triageStatus: 'auto_create_without_approval' },
      }
    );
    expect(invalidTriage.status()).toBeLessThan(500);
    expect([400, 422]).toContain(invalidTriage.status());

    const missingCandidate = await request.patch(
      `${API_BASE_URL}/api/initiatives/wizard/candidates/missing-candidate/triage`,
      {
        headers,
        data: { triageStatus: 'accepted_for_shortlist' },
      }
    );
    await expectStatus(missingCandidate, 404, 'missing candidate triage');

    const audit = await request.get(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/${sessionId}/audit-events`,
      { headers }
    );
    expect(audit.ok(), JSON.stringify(await jsonOrText(audit))).toBeTruthy();
    const auditBody = await audit.json();
    const eventTypes = (auditBody?.events || []).map((event: any) => event.eventType);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'wizard_session_created',
        'wizard_candidates_generated',
        'wizard_candidate_triaged',
      ])
    );

    // P0 #6: candidates must carry evidence anchored to sourceBasket items.
    const acceptedCandidate = candidates[0];
    expect(Array.isArray(acceptedCandidate?.sourceRefs)).toBeTruthy();
    expect(acceptedCandidate?.sourceRefs?.length || 0).toBeGreaterThan(0);
    expect(Array.isArray(acceptedCandidate?.evidenceRefs)).toBeTruthy();
    expect(acceptedCandidate?.evidenceRefs).toContain('playwright-insight-source');

    // P0 #7: shortlist gate evaluation must be reachable and pass when evidence is present.
    const gateRes = await request.get(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/${sessionId}/shortlist-gate`,
      { headers }
    );
    expect(gateRes.ok(), JSON.stringify(await jsonOrText(gateRes))).toBeTruthy();
    const gateBody = await gateRes.json();
    expect(gateBody?.gate?.ok).toBe(true);
    expect(Number(gateBody?.gate?.shortlistCount || 0)).toBeGreaterThanOrEqual(1);

    // P0 #8: drafts-created endpoint records audit event and surfaces gate result.
    const draftsAudit = await request.post(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/${sessionId}/drafts-created`,
      {
        headers,
        data: {
          draftCount: 1,
          candidateIds: [acceptedCandidate.id],
        },
      }
    );
    expect(draftsAudit.ok(), JSON.stringify(await jsonOrText(draftsAudit))).toBeTruthy();

    const auditAfter = await request.get(
      `${API_BASE_URL}/api/initiatives/wizard/sessions/${sessionId}/audit-events`,
      { headers }
    );
    expect(auditAfter.ok()).toBeTruthy();
    const auditAfterBody = await auditAfter.json();
    const eventTypesAfter = (auditAfterBody?.events || []).map((event: any) => event.eventType);
    expect(eventTypesAfter).toEqual(expect.arrayContaining(['wizard_drafts_created']));
  });

  test('Interview initiatives tab creates draft through approval flow and survives refresh', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(240000);

    await seedE2EAuth(page);
    await gotoRuntimeGateRoute(page, '/interview?tab=initiatives');
    await expectAppMounted(page);

    await expect(page.getByTestId('interview-hub')).toBeVisible({ timeout: 30000 });
    const addInitiatives = page.getByTestId('interview-add-initiatives-cta');
    await expect(addInitiatives).toBeVisible({ timeout: 30000 });
    await addInitiatives.click();

    const wizardDialog = page.getByTestId('initiative-wizard-modal');
    await expect(wizardDialog).toBeVisible({ timeout: 30000 });
    // Heading copy may evolve; assert wizard identity via stable keywords.
    await expect(wizardDialog).toContainText(/kreator inicjatyw|initiative wizard/i);
    await expect(
      wizardDialog.getByText(/proposal -> approval -> execution -> audit/i)
    ).toBeVisible();

    await page
      .getByRole('button', {
        name: /Wygeneruj kandydatów|Wygeneruj kandydatow|Generate candidates/i,
      })
      .click();

    await expect(page.getByText(/Szczeg[oó]ły kandydata|Candidate details/i)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/Impact:/i).first()).toBeVisible();

    const candidateTitle = await page
      .locator('h3')
      .filter({ hasText: /Zbudowac|Ograniczyc|Wprowadzic|Skrocic/i })
      .first()
      .innerText();
    await page.getByRole('button', { name: /^Accept$/i }).click();
    await expect(page.getByText(/Zaakceptowany|Accepted/i).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(wizardDialog.getByText(/1 kandydatow w shortlist|1 candidate/i)).toBeVisible({
      timeout: 30000,
    });

    await page
      .getByRole('status')
      .filter({ hasText: /Kandydaci inicjatyw/i })
      .waitFor({
        state: 'hidden',
        timeout: 5000,
      })
      .catch(() => {});
    await wizardDialog.getByTestId('initiative-wizard-governance-preview').click({ force: true });
    await expect(page.getByText(/Proposal preview/i)).toBeVisible();
    await expect(page.getByText(/draft inicjatywy|draft initiative/i).first()).toBeVisible();

    await wizardDialog.getByTestId('initiative-wizard-create-drafts').click({
      force: true,
    });
    await expect(page.getByText(/Kreator zakonczyl prace|Wizard completed/i)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/Utworzone drafty: 1|Created drafts: 1/i)).toBeVisible();
    await page.getByRole('button', { name: /Zamknij|Close/i }).click();

    await expect(page.getByText(candidateTitle)).toBeVisible({ timeout: 30000 });
    if (IS_MOCK_DB) {
      // MOCK_DB can accept writes without guaranteeing persistence across route reloads.
      // The hard refresh gate should run against a persistent local/CI database.
      return;
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectAppMounted(page);
    await expect(page.getByTestId('interview-hub')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(candidateTitle)).toBeVisible({ timeout: 30000 });
  });
});

/**
 * Interview Module E2E Tests - v2.0 ClickUp-like Redesign
 *
 * Tests the Interview module functionality:
 * - 5 Categories: Strategy, Operations, Digital, People, Finance
 * - Task-list style questions with status, confidence, tags
 * - 4 Tabs: Questions, Notes, Evidence, Summary
 * - Session management
 * - Context export to Tools/Assessment
 *
 * @see PROMPT 8 in wdrozenia/PROMPTY_DLA_AGENTOW.md
 *
 * SAFETY (2026-07-13): This spec used to authenticate with a hard-coded
 * REAL account (piotr.wisniewski@dbr77.com / 123456) against the seeded
 * project-dbr77-001 in the real DBR77 workspace. Every run wrote real
 * "Interview <date>" sessions/assignments/notes directly into that org
 * (a3e05d4a-5397-419d-b486-8e44366c0063) — hundreds of garbage records
 * accumulated this way. It now runs exclusively against the isolated
 * E2E test-support tenant (server/src/routes/testSupport.routes.ts) and
 * self-seeds its own project + approved template, so it never depends on
 * (or touches) any real organization's data.
 *
 * REQUIRES: ENABLE_TEST_SUPPORT=true on the backend + a global-setup run
 * that wrote tests/e2e/_helpers/testSupportState.ts's state file — i.e.
 * `E2E_USE_WEB_SERVER=true` or `E2E_REQUIRE_TEST_SUPPORT=true` (see
 * package.json `test:e2e:tier0`). Running via plain `npm run test:e2e`
 * without those env vars now fails fast (missing state file) instead of
 * silently falling back to a real account.
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from './_helpers/testSupportState';
import { dismissTourModal, seedE2EAuthWithBootstrap } from './smoke/runtime-gate-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

test.describe('Interview Module - v2.0', () => {
  test.beforeEach(async ({ page }) => {
    // Isolated E2E tenant (test-support bootstrap) — never the real DBR77 account.
    await seedE2EAuthWithBootstrap(page);
    await page.goto('/interview');
    await dismissTourModal(page);
  });

  test('should display interview hub with tabs', async ({ page }) => {
    await page.goto('/interview');

    // Manager/admin sees full module tabs
    await expect(page.locator('button:has-text("Inbox")')).toBeVisible();
    await expect(page.locator('button:has-text("Sessions")')).toBeVisible();
    await expect(page.locator('button:has-text("Templates")')).toBeVisible();
    await expect(page.locator('button:has-text("Insights")')).toBeVisible();
    await expect(page.locator('button:has-text("Assigned")')).toBeVisible();
  });

  test('should start a new session and open workspace', async ({ page }) => {
    await page.goto('/interview');

    // Go to Sessions tab
    await page.click('button:has-text("Sessions")');

    // Click New Session (top-right) if present
    await page.click('button:has-text("New Session"), button:has-text("Nowa sesja")');

    // Workspace should show category sections
    await expect(page.getByRole('button', { name: /Strategy/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Operations/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Digital/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /People/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Finance/i }).first()).toBeVisible();
  });

  test('should persist an answer and resume the same session', async ({ page }) => {
    test.setTimeout(120_000);
    const answer = `Durable interview answer ${Date.now()}`;
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    const flagsResponse = await page.request.get(`${API_BASE_URL}/api/v8/admin/flags`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(flagsResponse.ok(), await flagsResponse.text()).toBeTruthy();
    const flagsPayload = await flagsResponse.json();
    expect(flagsPayload?.data?.workspace).toBe(true);
    const projectResponse = await page.request.post(`${API_BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `E2E Interview Browser Project ${Date.now()}` },
    });
    expect(projectResponse.ok(), await projectResponse.text()).toBeTruthy();

    // Completing first-run onboarding may redirect to AI Chat. Return to the
    // intended module before proving the Interview lifecycle.
    await page.goto('/interview');
    await expect(page.getByText(/Interview is unavailable/i)).not.toBeVisible();
    await page.click('button:has-text("Sessions")');
    const createSessionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/interview/sessions') &&
        response.ok()
    );
    await page.getByRole('button', { name: /New session|Nowa sesja/i }).click();
    const createdSession = await (await createSessionResponse).json();
    const sessionId = String(createdSession?.id || createdSession?.data?.id || '');
    expect(sessionId).toBeTruthy();

    const answerBox = page.getByRole('textbox', {
      name: /Write the answer or record it below|Napisz odpowiedź/i,
    });
    await answerBox.fill(answer);
    await expect(answerBox).toHaveValue(answer);
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/interview/questions/')
    );
    await page.getByRole('button', { name: /Save answer|Zapisz odpowiedź/i }).click();
    const savedResponse = await saveResponse;
    expect(savedResponse.ok()).toBeTruthy();
    const savedQuestion = await savedResponse.json();
    expect(savedQuestion?.questionText).toBeTruthy();

    // A fresh document navigation proves that the answer is read back from the
    // same durable session rather than retained in React state.
    await page.goto(`/interview?sessionId=${encodeURIComponent(sessionId)}`);
    await dismissTourModal(page);
    await expect(page).toHaveURL(new RegExp(`sessionId=${sessionId}`));
    const savedQuestionPattern = new RegExp(
      String(savedQuestion.questionText).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80)
    );
    await page.getByRole('button', { name: savedQuestionPattern }).click();
    await expect(answerBox).toHaveValue(answer, { timeout: 30_000 });
  });
});

test.describe('Interview API - v2.0', () => {
  async function login(
    request: any
  ): Promise<{ token: string; userId: string; projectId: string }> {
    // Isolated E2E tenant token — never a real login against a real account.
    const state = readTestSupportState();
    const token = state.token;
    const userId = state.userId;

    // Self-seed an isolated project inside the E2E tenant org — never
    // project-dbr77-001 or any other real organization's project.
    const projectResponse = await request.post(`${API_BASE_URL}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `E2E Interview Project ${Date.now()}` },
    });
    expect(projectResponse.ok()).toBeTruthy();
    const projectBody = await projectResponse.json();
    const projectId = String(projectBody?.id || projectBody?.data?.id || '');
    expect(projectId).toBeTruthy();

    return { token, userId, projectId };
  }

  /**
   * Self-seeds an approved template with a handful of questions, so the
   * assignment workflow test never depends on whatever templates happen to
   * be pre-loaded in the environment (system template libraries are not
   * guaranteed under a MOCK_DB harness).
   */
  async function seedApprovedTemplate(request: any, token: string): Promise<string> {
    const createRes = await request.post(`${API_BASE_URL}/api/interview/templates`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `E2E Template ${Date.now()}`,
        status: 'approved',
        category: 'CUSTOM',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const template = await createRes.json();
    const templateId = String(template?.id || '');
    expect(templateId).toBeTruthy();

    const seedQuestions = [
      { category: 'strategy', questionText: 'What are your main business goals?' },
      { category: 'operations', questionText: 'What are your main operational challenges?' },
      { category: 'digital', questionText: 'How mature is your digital tooling?' },
    ];
    for (const q of seedQuestions) {
      const qRes = await request.post(`${API_BASE_URL}/api/interview/templates/${templateId}/questions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: q,
      });
      expect(qRes.ok()).toBeTruthy();
    }

    return templateId;
  }

  test('should create interview session via API', async ({ request }) => {
    const { token, projectId } = await login(request);

    // Create session
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Interview Session',
        projectId,
      },
    });

    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();
    expect(session.id).toBeDefined();
    expect(session.status).toBe('in_progress');
  });

  test('should get organization context via API', async ({ request }) => {
    const { token } = await login(request);

    // Get context
    const contextResponse = await request.get('/api/interview/context', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(contextResponse.ok()).toBeTruthy();
    const context = await contextResponse.json();
    expect(context.organizationId).toBeDefined();
  });

  test('should add question via API', async ({ request }) => {
    const { token, projectId } = await login(request);

    // Create session first
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Session for Questions',
        projectId,
      },
    });

    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();

    // Add question (using new 5 categories)
    const questionResponse = await request.post(`/api/interview/sessions/${session.id}/questions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        category: 'strategy', // One of: strategy, operations, digital, people, finance
        questionText: 'What are your main business goals?',
      },
    });

    expect(questionResponse.ok()).toBeTruthy();
    const question = await questionResponse.json();
    expect(question.category).toBe('strategy');
    expect(question.questionText).toBe('What are your main business goals?');
  });

  test('should update question with answer and status via API', async ({ request }) => {
    const { token, projectId } = await login(request);

    // Create session
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Session for Update',
        projectId,
      },
    });

    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();

    // Add question
    const questionResponse = await request.post(`/api/interview/sessions/${session.id}/questions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        category: 'operations',
        questionText: 'What are your main operational challenges?',
      },
    });

    expect(questionResponse.ok()).toBeTruthy();
    const question = await questionResponse.json();

    // Update question with answer
    const updateResponse = await request.patch(`/api/interview/questions/${question.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        answerText: 'We have issues with manual processes and data silos.',
        status: 'answered',
        confidenceScore: 4,
        tags: ['risk', 'priority'],
      },
    });

    expect(updateResponse.ok()).toBeTruthy();
    const updated = await updateResponse.json();
    expect(updated.status).toBe('answered');
    expect(updated.confidenceScore).toBe(4);
  });

  test('should create note via API', async ({ request }) => {
    const { token, projectId } = await login(request);

    // Create session
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Session for Notes',
        projectId,
      },
    });

    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();

    // Create note
    const noteResponse = await request.post(`/api/interview/sessions/${session.id}/notes`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        title: 'Key Observation',
        content: 'The organization has strong digital culture but lacks formal processes.',
        category: 'digital',
      },
    });

    expect(noteResponse.ok()).toBeTruthy();
    const note = await noteResponse.json();
    expect(note.title).toBe('Key Observation');
    expect(note.category).toBe('digital');
  });

  test('should execute full assignment workflow (create → start → answer → submit → approve)', async ({
    request,
  }) => {
    const { token, userId, projectId } = await login(request);

    // Self-seed an approved template in the isolated tenant — never reads
    // from (or depends on) a shared/global template library.
    const templateId = await seedApprovedTemplate(request, token);

    // Ensure creator has a management role in the selected project (dev DB can seed admin as MEMBER)
    try {
      await request.patch(`/api/projects/${projectId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { role: 'WORKSTREAM_OWNER' },
      });
    } catch {
      // ignore - if endpoint doesn't exist, test will fail at assignment create
    }

    // Create assignment to self
    const createAssignmentRes = await request.post('/api/interview/assignments', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        assigneeUserId: userId,
        templateId,
        projectId,
        priority: 'medium',
      },
    });
    expect(createAssignmentRes.ok()).toBeTruthy();
    const assignment = await createAssignmentRes.json();
    expect(assignment.id).toBeDefined();

    // Start assignment (creates session with template questions)
    const startRes = await request.post(`/api/interview/assignments/${assignment.id}/start`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(startRes.ok()).toBeTruthy();
    const started = await startRes.json();
    const sessionId = started?.session?.id || started?.sessionId;
    expect(sessionId).toBeDefined();

    // Answer enough questions to pass approval threshold (>50%)
    const questionsRes = await request.get(`/api/interview/sessions/${sessionId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(questionsRes.ok()).toBeTruthy();
    const questions = await questionsRes.json();
    expect(Array.isArray(questions)).toBeTruthy();
    expect(questions.length).toBeGreaterThan(0);

    const toAnswer = Math.max(1, Math.ceil(questions.length * 0.6));
    for (let i = 0; i < toAnswer; i++) {
      const q = questions[i];
      const upd = await request.patch(`/api/interview/questions/${q.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          answerText: `E2E answer ${i + 1}`,
          status: 'answered',
          confidenceScore: 4,
          tags: ['e2e'],
        },
      });
      expect(upd.ok()).toBeTruthy();
    }

    // Submit assignment
    const submitRes = await request.post(`/api/interview/assignments/${assignment.id}/submit`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(submitRes.ok()).toBeTruthy();
    const submitted = await submitRes.json();
    expect(submitted?.assignment?.status).toBe('submitted');

    // Approve assignment
    const approveRes = await request.post(`/api/interview/assignments/${assignment.id}/approve`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(approveRes.ok()).toBeTruthy();
  });
});

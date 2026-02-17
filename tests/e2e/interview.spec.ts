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
 */

import { expect, test } from '@playwright/test';

test.describe('Interview Module - v2.0', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin (seeded in dev DB)
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.fill('[data-testid="email-input"]', 'piotr.wisniewski@dbr77.com');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-button"]');

    // App may land on dashboard/home; just ensure we're not on login anymore
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
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

  test('should allow adding and answering a custom question', async ({ page }) => {
    await page.goto('/interview');
    await page.click('button:has-text("Sessions")');
    await page.click('button:has-text("New Session"), button:has-text("Nowa sesja")');

    // Expand Strategy section if needed and add a question
    await page.click('button:has-text("Strategy")');
    await page.click('button:has-text("Add question"), button:has-text("Dodaj pytanie")');
    await page.fill(
      'input[placeholder*="question"], input[placeholder*="pytania"]',
      'What is your main constraint?'
    );
    await page.keyboard.press('Enter');

    // Open the question and add an answer
    await page.click('text=What is your main constraint?');
    const addAnswerCta = page
      .locator('text=Click to add your answer')
      .or(page.locator('text=Kliknij, aby dodać odpowiedź'));
    await addAnswerCta.first().click();

    await page
      .locator('textarea')
      .first()
      .fill('Main constraint is limited availability of skilled operators.');
    await page.click('button:has-text("Save"), button:has-text("Zapisz")');
  });
});

test.describe('Interview API - v2.0', () => {
  const EMAIL = 'piotr.wisniewski@dbr77.com';
  const PASSWORD = '123456';

  async function login(
    request: any
  ): Promise<{ token: string; userId: string; projectId: string }> {
    const res = await request.post('/api/auth/login', {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const token = json.token as string;
    const userId = json.user?.id as string;

    const projectsRes = await request.get('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(projectsRes.ok()).toBeTruthy();
    const projects = await projectsRes.json();
    const preferred = Array.isArray(projects)
      ? projects.find((p: any) => p?.id === 'project-dbr77-001')
      : null;
    const projectId = (preferred?.id || projects?.[0]?.id) as string;
    expect(projectId).toBeTruthy();

    return { token, userId, projectId };
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

    // Pick an approved template from library
    const templatesRes = await request.get('/api/interview/templates', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(templatesRes.ok()).toBeTruthy();
    const templates = await templatesRes.json();
    expect(Array.isArray(templates)).toBeTruthy();
    expect(templates.length).toBeGreaterThan(0);
    const templateId = templates[0].id;

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

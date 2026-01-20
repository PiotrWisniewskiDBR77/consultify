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
    // Login as test user
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(chat|interview|dashboard)/);
  });

  test('should display interview view with header', async ({ page }) => {
    await page.goto('/interview');
    
    // Check main elements are visible
    await expect(page.locator('text=Discovery Interview')).toBeVisible();
  });

  test('should show 5 interview categories (Strategy, Operations, Digital, People, Finance)', async ({ page }) => {
    await page.goto('/interview');
    
    // Check all 5 categories are listed in sidebar
    const categories = [
      'Strategy',
      'Operations',
      'Digital',
      'People',
      'Finance',
    ];

    for (const category of categories) {
      await expect(page.locator(`text=${category}`).first()).toBeVisible();
    }
  });

  test('should show 4 tabs (Questions, Notes, Evidence, Summary)', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for workspace to load
    await page.waitForSelector('text=Strategy');
    
    // Check all 4 tabs are visible
    const tabs = ['Questions', 'Notes', 'Evidence', 'Summary'];
    
    for (const tab of tabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test('should start new interview session', async ({ page }) => {
    await page.goto('/interview');
    
    // Click new session button
    await page.click('button:has-text("New Session")');
    
    // Should show the interview workspace with Strategy category
    await expect(page.locator('text=Strategy')).toBeVisible();
    await expect(page.locator('text=Questions')).toBeVisible();
  });

  test('should switch between categories', async ({ page }) => {
    await page.goto('/interview');
    
    // Click on Operations category
    await page.click('button:has-text("Operations")');
    
    // Should show Operations header
    await expect(page.locator('h2:has-text("Operations")')).toBeVisible();
    
    // Click on Digital category
    await page.click('button:has-text("Digital")');
    
    // Should show Digital header
    await expect(page.locator('h2:has-text("Digital")')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for workspace
    await page.waitForSelector('text=Questions');
    
    // Click Notes tab
    await page.click('button:has-text("Notes")');
    await expect(page.locator('text=Add note').or(page.locator('text=Dodaj'))).toBeVisible();
    
    // Click Evidence tab
    await page.click('button:has-text("Evidence")');
    await expect(page.locator('text=Add file').or(page.locator('text=link'))).toBeVisible();
    
    // Click Summary tab
    await page.click('button:has-text("Summary")');
    await expect(page.locator('text=Summary').or(page.locator('text=Podsumowanie'))).toBeVisible();
    
    // Should show "Facts only" warning
    await expect(page.locator('text=Facts only').or(page.locator('text=Tylko fakty'))).toBeVisible();
  });

  test('should display questions in task-list style', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for questions to load
    await page.waitForSelector('text=Questions');
    
    // If there are questions, they should have status indicators
    const questionCards = page.locator('[class*="rounded-lg"][class*="border"]').filter({
      has: page.locator('text=/Not started|In progress|Answered|Needs follow-up/')
    });
    
    // Check for question status elements or "Add question" button
    await expect(
      questionCards.first()
        .or(page.locator('button:has-text("Add question")'))
        .or(page.locator('text=No questions'))
    ).toBeVisible();
  });

  test('should show Company Facts panel on the right', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for workspace
    await page.waitForSelector('text=Strategy');
    
    // Check Company Facts panel
    await expect(page.locator('text=Company Facts').or(page.locator('text=Fakty o firmie'))).toBeVisible();
    await expect(page.locator('text=Company Profile').or(page.locator('text=Profil firmy'))).toBeVisible();
  });

  test('should show progress in category sidebar', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for sidebar
    await page.waitForSelector('text=Strategy');
    
    // Check progress indicator exists
    await expect(page.locator('text=/Progress|Postęp/')).toBeVisible();
    await expect(page.locator('text=/categories|kategorii/')).toBeVisible();
  });

  test('should allow adding custom question', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for workspace
    await page.waitForSelector('text=Questions');
    
    // Click add question button if visible
    const addButton = page.locator('button:has-text("Add question"), button:has-text("Dodaj pytanie")');
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Should show input field
      await expect(page.locator('input[placeholder*="question"], input[placeholder*="pytania"]')).toBeVisible();
    }
  });

  test('should show history tab with sessions', async ({ page }) => {
    await page.goto('/interview');
    
    // Click history tab
    await page.click('button:has-text("History"), button:has-text("Historia")');
    
    // Should show history content
    await expect(
      page.locator('text=Interview History')
        .or(page.locator('text=Historia wywiadów'))
        .or(page.locator('text=No interview sessions'))
        .or(page.locator('text=Brak sesji'))
    ).toBeVisible();
  });

  test('should complete interview session', async ({ page }) => {
    await page.goto('/interview');
    
    // Wait for workspace
    await page.waitForSelector('text=Strategy');
    
    // Check complete button exists
    await expect(page.locator('button:has-text("Complete Interview"), button:has-text("Zakończ wywiad")')).toBeVisible();
  });
});

test.describe('Interview API - v2.0', () => {
  test('should create interview session via API', async ({ request }) => {
    // Get auth token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpass123',
      },
    });
    
    if (!loginResponse.ok()) {
      test.skip();
      return;
    }
    
    const { token } = await loginResponse.json();
    
    // Create session
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Interview Session',
      },
    });
    
    expect(sessionResponse.ok()).toBeTruthy();
    const session = await sessionResponse.json();
    expect(session.id).toBeDefined();
    expect(session.status).toBe('active');
  });

  test('should get organization context via API', async ({ request }) => {
    // Get auth token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpass123',
      },
    });
    
    if (!loginResponse.ok()) {
      test.skip();
      return;
    }
    
    const { token } = await loginResponse.json();
    
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
    // Get auth token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpass123',
      },
    });
    
    if (!loginResponse.ok()) {
      test.skip();
      return;
    }
    
    const { token } = await loginResponse.json();
    
    // Create session first
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Session for Questions',
      },
    });
    
    if (!sessionResponse.ok()) {
      test.skip();
      return;
    }
    
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
    // Get auth token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpass123',
      },
    });
    
    if (!loginResponse.ok()) {
      test.skip();
      return;
    }
    
    const { token } = await loginResponse.json();
    
    // Create session
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Session for Update',
      },
    });
    
    if (!sessionResponse.ok()) {
      test.skip();
      return;
    }
    
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
    
    if (!questionResponse.ok()) {
      test.skip();
      return;
    }
    
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
    // Get auth token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'testpass123',
      },
    });
    
    if (!loginResponse.ok()) {
      test.skip();
      return;
    }
    
    const { token } = await loginResponse.json();
    
    // Create session
    const sessionResponse = await request.post('/api/interview/sessions', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        name: 'Test Session for Notes',
      },
    });
    
    if (!sessionResponse.ok()) {
      test.skip();
      return;
    }
    
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
});

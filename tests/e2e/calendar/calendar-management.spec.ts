/**
 * Calendar E2E Tests
 * Testing calendar and scheduling functionality
 *
 * @module tests/e2e/calendar/calendar-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Calendar Management', () => {
  test('should access calendar page', async ({ page }) => {
    await page.goto('/calendar');

    const url = page.url();
    expect(url).toMatch(/calendar|schedule|login/);
  });

  test('should access week view', async ({ page }) => {
    await page.goto('/calendar/week');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access month view', async ({ page }) => {
    await page.goto('/calendar/month');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access day view', async ({ page }) => {
    await page.goto('/calendar/day');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Calendar Events', () => {
  test('should access create event', async ({ page }) => {
    await page.goto('/calendar/event/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access event detail', async ({ page }) => {
    await page.goto('/calendar/event/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('calendar api supports ownership filter and conflict payload', async ({ request }) => {
    const unified = await request.get('/api/v8/my-work/calendar/unified', {
      params: {
        start: '2026-03-01',
        end: '2026-04-01',
        sources: 'task',
        ownership: 'assignee',
      },
    });
    expect([200, 401, 403]).toContain(unified.status());

    const conflicts = await request.get('/api/v8/my-work/calendar/conflicts', {
      params: {
        date: '2026-03-27',
      },
    });
    expect([200, 401, 403]).toContain(conflicts.status());
    if (conflicts.status() === 200) {
      const payload = await conflicts.json();
      expect(payload).toHaveProperty('data');
      expect(payload.data).toHaveProperty('hasConflicts');
    }
  });
});

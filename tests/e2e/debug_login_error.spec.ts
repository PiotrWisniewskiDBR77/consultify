import { test, expect } from '@playwright/test';

test('debug login error', async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@localhost');
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');

  // Intercept response
  const loginResponse = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.status() !== 404,
    { timeout: 10000 }
  );

  await page.click('button[type="submit"]');

  const response = await loginResponse;
  console.log('LOGIN RESPONSE STATUS:', response.status());
  console.log('LOGIN RESPONSE BODY:', await response.text());

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'debug-login-result.png' });

  if (response.status() === 200) {
    console.log('LOGIN SUCCESSFUL!');
  } else {
    console.log('LOGIN FAILED with status', response.status());
  }
});

import { expect, test } from '@playwright/test';

type DiagnosticStep = {
  name: string;
  path: string;
  expectedText: RegExp;
  expectedMarker?: string;
};

const DIAGNOSTIC_SEQUENCE: DiagnosticStep[] = [
  {
    name: 'boot',
    path: '/chat?diag=boot',
    expectedText: /Boot screen loaded before React providers/i,
    expectedMarker: 'boot_screen_only',
  },
  {
    name: 'min-react',
    path: '/chat?diag=min-react',
    expectedText: /Minimal React root mounted/i,
    expectedMarker: 'min_react_mount',
  },
  {
    name: 'providers-only',
    path: '/chat?diag=providers-only',
    expectedText: /AppProviders mounted without AppContent/i,
    expectedMarker: 'providers_only_mount',
  },
  {
    name: 'no-auth',
    path: '/chat?diag=no-auth',
    expectedText: /Consultify|Welcome|Login|Zaloguj|AI/i,
    expectedMarker: 'auth_verification_skipped',
  },
  {
    name: 'no-router-sync',
    path: '/chat?diag=no-router-sync',
    expectedText: /Consultify|chat|AI|Teresa/i,
    expectedMarker: 'router_sync_skipped',
  },
  {
    name: 'full-chat',
    path: '/chat',
    expectedText: /Consultify|Welcome|Login|Zaloguj|chat|AI|Teresa/i,
  },
];

test.describe('Runtime Diagnostic Sequence [@module:runtime]', () => {
  test.setTimeout(180000);

  test('walks boot isolation ladder without renderer crash', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleLines: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      consoleLines.push(`${message.type()}: ${message.text()}`);
    });

    for (const step of DIAGNOSTIC_SEQUENCE) {
      await test.step(step.name, async () => {
        await page.goto(step.path, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.waitForFunction(
          () => {
            const root = document.querySelector('#root');
            return Boolean(root && (root.childElementCount > 0 || root.textContent?.trim()));
          },
          null,
          { timeout: 30000 }
        );

        await expect(page.locator('#root')).toContainText(step.expectedText, { timeout: 30000 });
        expect(page.isClosed(), `${step.name} should not close the renderer`).toBe(false);

        if (step.expectedMarker) {
          expect(
            consoleLines.some((line) => line.includes('[stability:diagnostic]') && line.includes(step.expectedMarker)),
            `${step.name} should emit ${step.expectedMarker}`
          ).toBe(true);
        }
      });
    }

    expect(pageErrors, `Browser page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  });
});


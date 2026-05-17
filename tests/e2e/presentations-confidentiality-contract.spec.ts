import { expect, test } from '@playwright/test';

const browserHarness = `
  <button id="export-confidential">Export Confidential</button>
  <button id="share-internal">Share Internal</button>
  <button id="share-public">Share Public</button>
  <pre id="status"></pre>
  <script>
    async function exportPresentationDeck(deckId, title) {
      const response = await fetch('/api/presentations/decks/' + deckId + '/download', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' }
      });
      if (!response.ok) {
        let payload = {};
        try { payload = await response.json(); } catch {}
        const error = new Error(payload.error || 'Export failed');
        error.code = payload.code;
        error.action = payload.action;
        error.confidentiality = payload.confidentiality;
        throw error;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (title || 'presentation') + '.pptx';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      return { ok: true };
    }

    async function sharePresentationDeck(deckId) {
      const response = await fetch('/api/presentations/decks/' + deckId + '/share', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deckId: deckId })
      });
      let payload = {};
      try { payload = await response.json(); } catch {}
      if (!response.ok) {
        const error = new Error(payload.error || 'Share failed');
        error.code = payload.code;
        error.action = payload.action;
        error.confidentiality = payload.confidentiality;
        throw error;
      }
      return payload;
    }

    document.getElementById('export-confidential').addEventListener('click', async () => {
      try {
        const result = await exportPresentationDeck('deck-confidential', 'VTS Confidential');
        document.getElementById('status').textContent = JSON.stringify({ ok: true, result });
      } catch (error) {
        document.getElementById('status').textContent = JSON.stringify({
          ok: false,
          code: error.code,
          action: error.action,
          confidentiality: error.confidentiality,
          message: error.message
        });
      }
    });

    document.getElementById('share-internal').addEventListener('click', async () => {
      try {
        const result = await sharePresentationDeck('deck-internal');
        document.getElementById('status').textContent = JSON.stringify({ ok: true, result });
      } catch (error) {
        document.getElementById('status').textContent = JSON.stringify({
          ok: false,
          code: error.code,
          action: error.action,
          confidentiality: error.confidentiality,
          message: error.message
        });
      }
    });

    document.getElementById('share-public').addEventListener('click', async () => {
      try {
        const result = await sharePresentationDeck('deck-public');
        document.getElementById('status').textContent = JSON.stringify({ ok: true, result });
      } catch (error) {
        document.getElementById('status').textContent = JSON.stringify({
          ok: false,
          code: error.code,
          action: error.action,
          confidentiality: error.confidentiality,
          message: error.message
        });
      }
    });
  </script>
`;

test.describe('presentation confidentiality browser contract', () => {
  test('blocks PPTX export of a confidential deck for unprivileged role', async ({ page }) => {
    await page.route('**/presentation-export-harness', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: browserHarness });
    });
    await page.route('**/api/presentations/decks/deck-confidential/download', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Action blocked by confidentiality policy.',
          code: 'CONFIDENTIALITY_POLICY_BLOCKED',
          action: 'export',
          confidentiality: 'confidential',
        }),
      });
    });
    await page.goto('/presentation-export-harness');

    await page.getByRole('button', { name: 'Export Confidential' }).click();

    await expect(page.locator('#status')).toContainText('"code":"CONFIDENTIALITY_POLICY_BLOCKED"');
    await expect(page.locator('#status')).toContainText('"confidentiality":"confidential"');

    let downloadTriggered = false;
    try {
      await page.waitForEvent('download', { timeout: 1000 });
      downloadTriggered = true;
    } catch (error) {
      downloadTriggered = false;
    }
    expect(downloadTriggered).toBe(false);
  });

  test('blocks share link creation for non-public deck for project manager', async ({ page }) => {
    await page.route('**/presentation-export-harness', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: browserHarness });
    });
    await page.route('**/api/presentations/decks/deck-internal/share', async (route) => {
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Sharing non-public decks requires admin approval.',
          code: 'CONFIDENTIALITY_SHARE_REQUIRES_ADMIN',
          action: 'share',
          confidentiality: 'internal',
        }),
      });
    });
    await page.goto('/presentation-export-harness');

    await page.getByRole('button', { name: 'Share Internal' }).click();

    await expect(page.locator('#status')).toContainText('"code":"CONFIDENTIALITY_SHARE_REQUIRES_ADMIN"');
    await expect(page.locator('#status')).toContainText('"confidentiality":"internal"');
  });

  test('allows public deck share to succeed and surfaces share token in the harness', async ({ page }) => {
    await page.route('**/presentation-export-harness', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: browserHarness });
    });
    await page.route('**/api/presentations/decks/deck-public/share', async (route) => {
      expect(route.request().method()).toBe('POST');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { shareToken: 'tok-abc-123', expiresAt: '2026-12-01T00:00:00.000Z' },
        }),
      });
    });
    await page.goto('/presentation-export-harness');

    await page.getByRole('button', { name: 'Share Public' }).click();

    await expect(page.locator('#status')).toContainText('"shareToken":"tok-abc-123"');
  });
});

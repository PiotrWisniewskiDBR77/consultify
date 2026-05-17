import { expect, test } from '@playwright/test';

const browserExportHarness = `
  <button id="export-pptx">Export PPTX</button>
  <button id="export-blocked">Export Blocked</button>
  <pre id="status"></pre>
  <script>
    async function exportPresentationDeck(deckId, title, format) {
      const endpoint = format === 'pptx'
        ? { url: '/api/presentations/decks/' + deckId + '/download', method: 'GET', extension: 'pptx' }
        : { url: '/api/presentations/decks/' + deckId + '/export/' + format, method: 'POST', extension: format };
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: { Authorization: 'Bearer test-token' }
      });
      if (!response.ok) {
        let payload = {};
        try { payload = await response.json(); } catch {}
        const error = new Error(payload.error || 'Export failed');
        error.code = payload.code;
        error.result = payload.result;
        error.scorecard = payload.scorecard;
        error.gates = payload.gates;
        throw error;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (title || 'presentation') + '.' + endpoint.extension;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      return { format, extension: endpoint.extension };
    }

    document.getElementById('export-pptx').addEventListener('click', async () => {
      try {
        const result = await exportPresentationDeck('deck-ok', 'VTS Board Briefing', 'pptx');
        document.getElementById('status').textContent = JSON.stringify({ ok: true, result });
      } catch (error) {
        document.getElementById('status').textContent = JSON.stringify({ ok: false, code: error.code, message: error.message });
      }
    });

    document.getElementById('export-blocked').addEventListener('click', async () => {
      try {
        await exportPresentationDeck('deck-blocked', 'VTS Blocked', 'pptx');
      } catch (error) {
        document.getElementById('status').textContent = JSON.stringify({
          ok: false,
          code: error.code,
          result: error.result,
          scorecard: error.scorecard,
          gates: error.gates,
          message: error.message
        });
      }
    });
  </script>
`;

test.describe('presentation export browser contract', () => {
  test('downloads PPTX only after a successful export response', async ({ page }) => {
    await page.route('**/presentation-export-harness', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: browserExportHarness });
    });
    await page.route('**/api/presentations/decks/deck-ok/download', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        body: 'pptx-binary-placeholder',
      });
    });
    await page.goto('/presentation-export-harness');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PPTX' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('VTS Board Briefing.pptx');
    await expect(page.locator('#status')).toContainText('"ok":true');
  });

  test('surfaces quality gate blockers without fake success download', async ({ page }) => {
    await page.route('**/presentation-export-harness', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: browserExportHarness });
    });
    await page.route('**/api/presentations/decks/deck-blocked/download', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Deck is blocked by quality gates.',
          code: 'QUALITY_GATE_BLOCKED',
          result: 'BLOCKED_P1',
          scorecard: { p0: 0, p1: 1, p2: 0, passVocabulary: 'BLOCKED_P1' },
          gates: [
            {
              id: 'missing-source',
              priority: 'P1',
              severity: 'error',
              message: 'Missing source traceability.',
              cardIndex: 2,
            },
          ],
        }),
      });
    });
    await page.goto('/presentation-export-harness');

    let downloaded = false;
    page.on('download', () => {
      downloaded = true;
    });
    await page.getByRole('button', { name: 'Export Blocked' }).click();

    await expect(page.locator('#status')).toContainText('QUALITY_GATE_BLOCKED');
    await expect(page.locator('#status')).toContainText('BLOCKED_P1');
    await expect(page.locator('#status')).toContainText('"scorecard"');
    await expect(page.locator('#status')).toContainText('"priority":"P1"');
    expect(downloaded).toBe(false);
  });
});

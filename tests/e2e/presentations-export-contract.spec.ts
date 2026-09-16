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
      let warnings = [];
      const warningHeader = response.headers.get('X-Presentation-Quality-Warnings');
      if (warningHeader) warnings = JSON.parse(decodeURIComponent(warningHeader));
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (title || 'presentation') + '.' + endpoint.extension;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      return { format, extension: endpoint.extension, warnings };
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
        const result = await exportPresentationDeck('deck-blocked', 'VTS Review', 'pptx');
        document.getElementById('status').textContent = JSON.stringify({ ok: true, result });
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

  test('downloads with advisory review findings in the response header', async ({ page }) => {
    await page.route('**/presentation-export-harness', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: browserExportHarness });
    });
    await page.route('**/api/presentations/decks/deck-blocked/download', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        headers: {
          'X-Presentation-Quality-Warnings': encodeURIComponent(JSON.stringify([
            { id: 'missing-source', message: 'Missing source traceability.', cardIndex: 2 }
          ])),
        },
        body: 'pptx-binary-with-review-findings',
      });
    });
    await page.goto('/presentation-export-harness');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Blocked' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('VTS Review.pptx');
    await expect(page.locator('#status')).toContainText('"ok":true');
    await expect(page.locator('#status')).toContainText('Missing source traceability.');
  });
});

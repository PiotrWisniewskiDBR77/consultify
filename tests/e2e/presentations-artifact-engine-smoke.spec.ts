import { expect, test } from '@playwright/test';

const browserHarness = `
  <button id="gen-outline">Generate Outline</button>
  <button id="gen-deck">Generate Deck</button>
  <button id="run-gates">Run Quality Gates</button>
  <button id="agent-propose">Agent Propose</button>
  <button id="agent-accept">Agent Accept</button>
  <button id="governance-card">Governance Card</button>
  <button id="export-pdf">Export PDF</button>
  <pre id="status"></pre>
  <script>
    function writeStatus(payload) {
      document.getElementById('status').textContent = JSON.stringify(payload);
    }

    async function callJson(url, method, body) {
      const init = {
        method: method,
        headers: { Authorization: 'Bearer test-token' }
      };
      if (body !== undefined && body !== null) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      const response = await fetch(url, init);
      const text = await response.text();
      var payload;
      try { payload = text ? JSON.parse(text) : {}; } catch (e) { payload = { raw: text }; }
      if (!response.ok) {
        const error = new Error((payload && payload.error) || ('Request failed: ' + response.status));
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    document.getElementById('gen-outline').addEventListener('click', async () => {
      try {
        const payload = await callJson('/api/presentations/generate/outline', 'POST', { topic: 'smoke' });
        writeStatus({ step: 'gen-outline', ok: true, payload: payload });
      } catch (error) {
        writeStatus({ step: 'gen-outline', ok: false, message: error.message, payload: error.payload });
      }
    });

    document.getElementById('gen-deck').addEventListener('click', async () => {
      try {
        const payload = await callJson('/api/presentations/generate/deck', 'POST', { outline: [] });
        writeStatus({ step: 'gen-deck', ok: true, payload: payload });
      } catch (error) {
        writeStatus({ step: 'gen-deck', ok: false, message: error.message, payload: error.payload });
      }
    });

    document.getElementById('run-gates').addEventListener('click', async () => {
      try {
        const payload = await callJson('/api/presentations/decks/deck-smoke-001/quality-gates', 'POST', {});
        writeStatus({ step: 'run-gates', ok: true, payload: payload });
      } catch (error) {
        writeStatus({ step: 'run-gates', ok: false, message: error.message, payload: error.payload });
      }
    });

    document.getElementById('agent-propose').addEventListener('click', async () => {
      try {
        const payload = await callJson(
          '/api/presentations/decks/deck-smoke-001/agent-edit',
          'POST',
          { prompt: 'Make this concise' }
        );
        writeStatus({ step: 'agent-propose', ok: true, payload: payload });
      } catch (error) {
        writeStatus({ step: 'agent-propose', ok: false, message: error.message, payload: error.payload });
      }
    });

    document.getElementById('agent-accept').addEventListener('click', async () => {
      try {
        const payload = await callJson(
          '/api/presentations/decks/deck-smoke-001/agent-edit/op-001/accept',
          'POST',
          {}
        );
        writeStatus({ step: 'agent-accept', ok: true, payload: payload });
      } catch (error) {
        writeStatus({ step: 'agent-accept', ok: false, message: error.message, payload: error.payload });
      }
    });

    document.getElementById('governance-card').addEventListener('click', async () => {
      try {
        const payload = await callJson(
          '/api/presentations/decks/deck-smoke-001/governance-card',
          'GET'
        );
        writeStatus({ step: 'governance-card', ok: true, payload: payload });
      } catch (error) {
        writeStatus({ step: 'governance-card', ok: false, message: error.message, payload: error.payload });
      }
    });

    document.getElementById('export-pdf').addEventListener('click', async () => {
      try {
        const response = await fetch('/api/presentations/decks/deck-smoke-001/export/pdf', {
          method: 'GET',
          headers: { Authorization: 'Bearer test-token' }
        });
        if (!response.ok) {
          throw new Error('PDF export failed: ' + response.status);
        }
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = 'deck-smoke-001.pdf';
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(objectUrl);
        writeStatus({
          step: 'export-pdf',
          ok: true,
          payload: {
            contentType: response.headers.get('Content-Type'),
            size: blob.size
          }
        });
      } catch (error) {
        writeStatus({ step: 'export-pdf', ok: false, message: error.message });
      }
    });
  </script>
`;

test.describe('presentation artifact engine smoke (mocked happy path)', () => {
  test('happy path: generate outline → gates pass → agent edit proposal → accept → governance pass → PDF download', async ({
    page,
  }) => {
    await page.route('**/presentation-smoke-harness', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: browserHarness,
      });
    });

    await page.route('**/api/presentations/generate/outline', async (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['authorization']).toBe('Bearer test-token');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          outline: [
            { title: 'Executive summary', summary: 'Why this matters now.' },
            { title: 'Findings', summary: 'Top three signals from analysis.' },
            { title: 'Recommendations', summary: 'What to do next.' },
          ],
        }),
      });
    });

    await page.route('**/api/presentations/generate/deck', async (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['authorization']).toBe('Bearer test-token');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deckId: 'deck-smoke-001' }),
      });
    });

    await page.route(
      '**/api/presentations/decks/deck-smoke-001/quality-gates',
      async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().headers()['authorization']).toBe('Bearer test-token');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              result: 'PASS',
              score: 92,
              gates: [],
              scorecard: { p0: 0, p1: 0, p2: 0 },
            },
          }),
        });
      },
    );

    await page.route(
      '**/api/presentations/decks/deck-smoke-001/agent-edit',
      async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().headers()['authorization']).toBe('Bearer test-token');
        const requestBody = route.request().postDataJSON();
        expect(requestBody).toEqual({ prompt: 'Make this concise' });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              operationId: 'op-001',
              status: 'proposal',
              plan: {
                scope: 'global',
                mutationKinds: ['content'],
                targetSlides: [],
                requiresApproval: true,
                actionable: true,
              },
              diff: { editPlan: { scope: 'global' } },
              reply: 'Proposal ready.',
            },
          }),
        });
      },
    );

    await page.route(
      '**/api/presentations/decks/deck-smoke-001/agent-edit/op-001/accept',
      async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().headers()['authorization']).toBe('Bearer test-token');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              operationId: 'op-001',
              appliedActions: ['made copy concise'],
              version: 2,
            },
          }),
        });
      },
    );

    await page.route(
      '**/api/presentations/decks/deck-smoke-001/governance-card',
      async (route) => {
        expect(route.request().method()).toBe('GET');
        expect(route.request().headers()['authorization']).toBe('Bearer test-token');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              deckId: 'deck-smoke-001',
              overallVerdict: 'PASS',
              quality: {
                verdict: 'PASS',
                p0: 0,
                p1: 0,
                p2: 0,
                gateCount: 4,
              },
              confidentiality: { level: 'internal' },
              telemetry: {
                windowDays: 7,
                proposalsCreated: 1,
                editsApplied: 1,
                editsRejected: 0,
                exportsBlocked: 0,
                lastActivityAt: '2026-05-07T03:30:00.000Z',
              },
            },
          }),
        });
      },
    );

    await page.route(
      '**/api/presentations/decks/deck-smoke-001/export/pdf',
      async (route) => {
        expect(route.request().method()).toBe('GET');
        expect(route.request().headers()['authorization']).toBe('Bearer test-token');
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.4 smoke-placeholder'),
        });
      },
    );

    await page.goto('/presentation-smoke-harness');

    const status = page.locator('#status');

    await page.getByRole('button', { name: 'Generate Outline' }).click();
    await expect(status).toContainText('"step":"gen-outline"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"outline"');
    await expect(status).toContainText('Executive summary');

    await page.getByRole('button', { name: 'Generate Deck' }).click();
    await expect(status).toContainText('"step":"gen-deck"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"deckId":"deck-smoke-001"');

    await page.getByRole('button', { name: 'Run Quality Gates' }).click();
    await expect(status).toContainText('"step":"run-gates"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"result":"PASS"');
    await expect(status).toContainText('"score":92');
    await expect(status).toContainText('"p0":0');

    await page.getByRole('button', { name: 'Agent Propose' }).click();
    await expect(status).toContainText('"step":"agent-propose"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"operationId":"op-001"');
    await expect(status).toContainText('"status":"proposal"');
    await expect(status).toContainText('"requiresApproval":true');
    await expect(status).toContainText('"reply":"Proposal ready."');

    await page.getByRole('button', { name: 'Agent Accept' }).click();
    await expect(status).toContainText('"step":"agent-accept"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"operationId":"op-001"');
    await expect(status).toContainText('"version":2');
    await expect(status).toContainText('made copy concise');

    await page.getByRole('button', { name: 'Governance Card' }).click();
    await expect(status).toContainText('"step":"governance-card"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"overallVerdict":"PASS"');
    await expect(status).toContainText('"deckId":"deck-smoke-001"');
    await expect(status).toContainText('"gateCount":4');
    await expect(status).toContainText('"editsApplied":1');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename().endsWith('.pdf')).toBe(true);
    await expect(status).toContainText('"step":"export-pdf"');
    await expect(status).toContainText('"ok":true');
    await expect(status).toContainText('"contentType":"application/pdf"');
  });
});

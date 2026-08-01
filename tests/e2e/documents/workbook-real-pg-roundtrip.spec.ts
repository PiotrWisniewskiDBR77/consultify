import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';

import {
  API_BASE_URL,
  authHeaders,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

test.describe('MAT-05 workbook durable round-trip', () => {
  test('browser create → value/formula edits → reload → XLSX and tenant boundary', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);

    // Use the real product entry point: it POSTs /workbook/blank and navigates
    // to the durable object returned by the backend.
    await page.goto('/excele?view=new&entry=blank');
    await expect(page).toHaveURL(/\/excele\?artifactId=[0-9a-f-]+$/i, { timeout: 30_000 });
    const workbookId = new URL(page.url()).searchParams.get('artifactId');
    expect(workbookId).toBeTruthy();

    const grid = page.getByTestId('editable-spreadsheet-grid');
    await expect(grid).toBeVisible({ timeout: 20_000 });
    const formulaBar = page.getByTestId('workbook-formula-bar');

    await page.getByTestId('workbook-cell-0-A').click();
    await formulaBar.fill('21');
    await formulaBar.press('Enter');
    await expect(page.getByText(/^(Zapisano|Saved)$/)).toBeVisible();

    await page.getByTestId('workbook-cell-0-B').click();
    await formulaBar.fill('=A2*2');
    await formulaBar.press('Enter');
    await expect(page.getByText(/^(Zapisano|Saved)$/)).toBeVisible();
    await expect(page.getByTestId('workbook-cell-0-B')).toHaveText('42');

    // A hard reload clears browser component state and forces GET /workbook/:id.
    await page.reload();
    await expect(grid).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('workbook-cell-0-A')).toHaveText('21');
    await expect(page.getByTestId('workbook-cell-0-B')).toHaveText('42');
    await page.getByTestId('workbook-cell-0-B').click();
    await expect(formulaBar).toHaveValue('=A2*2');

    // The downloaded binary must be rebuilt from persisted schema_json, not
    // from the pre-edit in-memory buffer.
    const download = await page.request.get(
      `${API_BASE_URL}/api/workbook/${encodeURIComponent(workbookId!)}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(download.status()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await download.body());
    const sheet = workbook.getWorksheet('Arkusz1');
    expect(sheet?.getCell('A2').value).toBe(21);
    expect(sheet?.getCell('B2').value).toEqual(expect.objectContaining({ formula: 'A2*2' }));

    // A second bootstrap creates a distinct organization. The same UUID must
    // not be readable across that boundary.
    const otherSession = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
      data: { runId: `mat05-isolation-${Date.now()}`, role: 'ADMIN' },
    });
    expect(otherSession.status()).toBe(200);
    const otherToken = String((await otherSession.json()).token || '');
    expect(otherToken).toBeTruthy();
    const denied = await page.request.get(
      `${API_BASE_URL}/api/workbook/${encodeURIComponent(workbookId!)}`,
      { headers: authHeaders(otherToken) }
    );
    expect(denied.status()).toBe(404);
  });
});

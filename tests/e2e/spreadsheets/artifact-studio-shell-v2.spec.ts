import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

import { dismissOverlayIfPresent, suppressOnboarding } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

async function bootstrap(page: Page): Promise<string> {
  const runId = `xlsx-shell-v2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
    headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId },
  });
  expect(response.ok(), 'test-support bootstrap must create an isolated E2E session').toBe(true);
  return String(((await response.json()) as { token?: string }).token || '');
}

async function seedAuth(page: Page, token: string): Promise<void> {
  await page.addInitScript((sessionToken: string) => {
    localStorage.setItem('token', sessionToken);
    localStorage.setItem('refreshToken', 'e2e-refresh');
    const user = {
      id: 'e2e-xlsx-shell-user',
      email: 'e2e-xlsx-shell@local.test',
      role: 'ADMIN',
      organizationId: 'e2e-org-id',
      organizationName: 'E2E Organization',
      firstName: 'E2E',
      lastName: 'XLSX Shell',
      isAuthenticated: true,
      accessLevel: 'full',
    };
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem(
      'consultinity-storage',
      JSON.stringify({
        state: {
          sessionMode: 'FULL',
          currentUser: user,
          currentOrganization: { id: 'e2e-org-id', name: 'E2E Organization' },
        },
        version: 0,
      })
    );
  }, token);
}

async function createWorkbook(page: Page, token: string): Promise<string> {
  const response = await page.request.post(`${API_BASE_URL}/api/workbook/blank`, {
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { title: `Artifact Studio XLSX ${Date.now()}` },
  });
  expect(response.status(), 'blank workbook fixture must be persisted through the real local API').toBe(
    201
  );
  return String(((await response.json()) as { id?: string }).id || '');
}

test.describe('Spreadsheet Artifact Studio shell V2 [@module:spreadsheets]', () => {
  test.setTimeout(120_000);

  test('persists classification governance through the real API and rejects an unaudited downgrade', async ({ page }) => {
    const token = await bootstrap(page);
    const workbookId = await createWorkbook(page, token);
    const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const initial = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, { headers });
    expect(initial.status()).toBe(200);
    const baseVersion = Number(((await initial.json()) as { version?: number }).version);
    expect(Number.isInteger(baseVersion)).toBe(true);

    const rejected = await page.request.patch(`${API_BASE_URL}/api/workbook/${workbookId}/governance`, {
      headers,
      data: { field: 'classification', value: 'public', baseVersion },
    });
    const rejectedBody = await rejected.json();
    expect(rejected.status(), JSON.stringify(rejectedBody)).toBe(422);
    expect(rejectedBody.code).toBe('CLASSIFICATION_DOWNGRADE_REASON_REQUIRED');

    const accepted = await page.request.patch(`${API_BASE_URL}/api/workbook/${workbookId}/governance`, {
      headers,
      data: {
        field: 'classification',
        value: 'public',
        reason: 'E2E governance evidence for an explicitly public demo workbook.',
        baseVersion,
      },
    });
    expect(accepted.status()).toBe(200);
    expect(await accepted.json()).toMatchObject({ classification: 'public', unchanged: false });

    const reopened = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, { headers });
    expect(reopened.status()).toBe(200);
    expect(await reopened.json()).toMatchObject({ classification: 'public' });

    const audit = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}/governance-events`,
      { headers }
    );
    expect(audit.status()).toBe(200);
    expect((await audit.json()).events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'classification.changed',
          previousValue: 'internal',
          nextValue: 'public',
          reason: 'E2E governance evidence for an explicitly public demo workbook.',
        }),
      ])
    );
  });

  test('mounts one Menu2 line, one contextual Menu3 and no local right rail', async ({ page }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const workbookId = await createWorkbook(page, token);

    await page.goto(
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);

    const shell = page.getByTestId('spreadsheet-artifact-studio');
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute('data-artifact-studio', 'true');
    await expect(shell.getByTestId('artifact-menu3')).toHaveCount(1);
    await expect(shell.getByTestId('mels-left-rail')).toHaveCount(1);
    await expect(shell.getByTestId('mels-right-rail')).toHaveCount(0);
    await expect(shell.getByTestId('mels-left-inspector-rail')).toHaveCount(0);
    await expect(shell.getByTestId('artifact-studio-bottom-bar')).toBeVisible();
    await expect(shell.getByRole('button', { name: 'Teresa', exact: true })).toBeVisible();

    const topBars = shell.getByRole('toolbar', { name: 'Arkusze top bar' });
    await expect(topBars).toHaveCount(1);
    const topBarHeight = await topBars.evaluate((element) =>
      Math.round(element.getBoundingClientRect().height)
    );
    expect(topBarHeight, 'Menu2 must stay on a single compact row').toBeLessThanOrEqual(58);

    await expect(shell.getByTestId('artifact-menu3').getByText('Teresa', { exact: true })).toHaveCount(
      0
    );
  });

  test('lane kill-switch immediately restores the legacy spreadsheet shell', async ({ page }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const workbookId = await createWorkbook(page, token);

    await page.goto(
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=0`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);

    await expect(page.getByTestId('spreadsheet-artifact-studio')).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('artifact-menu3')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Task (?:Progress|completed)/ })).toBeVisible();
    await expect(page.getByText('Excele', { exact: true })).toBeVisible();
    await expect(page.getByText('/ Workspace', { exact: true })).toBeVisible();
  });

  test('opens the selected cell context menu from the keyboard and restores focus', async ({ page }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const workbookId = await createWorkbook(page, token);

    await page.goto(
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);

    const shell = page.getByTestId('spreadsheet-artifact-studio');
    await expect(shell).toBeVisible({ timeout: 30_000 });

    const firstCell = shell.getByRole('gridcell').first();
    await firstCell.click();
    await firstCell.focus();
    await expect(firstCell).toBeFocused();

    await page.keyboard.press('Shift+F10');
    const contextMenu = page.getByTestId('spreadsheet-selection-context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByRole('menuitem').first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(contextMenu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(contextMenu).toHaveCount(0);
    await expect(firstCell).toBeFocused();
  });

  test('persists a versioned mutation, cold-reopens it and exports the fresh XLSX', async ({
    page,
  }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const workbookId = await createWorkbook(page, token);
    const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const initialResponse = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
      timeout: 60_000,
    });
    expect(initialResponse.ok(), 'persisted blank workbook must reopen through the real API').toBe(
      true
    );
    const initial = (await initialResponse.json()) as {
      version: number;
      schema_json: { sheets: Array<{ name: string; rows: Array<{ cells: Record<string, unknown> }> }> };
    };

    const commandResponse = await page.request.post(
      `${API_BASE_URL}/api/workbook/${workbookId}/commands`,
      {
        headers,
        data: {
          commandId: 'xlsx.e2e.roundtrip',
          baseVersion: initial.version,
          idempotencyKey: `xlsx-e2e-${workbookId}`,
          operations: [
            { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 },
            { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'B', formula: '=A2*2' },
          ],
        },
      }
    );
    expect(commandResponse.ok(), await commandResponse.text()).toBe(true);
    const commandResult = (await commandResponse.json()) as { newVersion?: number; version?: number };
    expect(commandResult.newVersion ?? commandResult.version).toBe(initial.version + 1);

    const reopenedResponse = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}`,
      { headers }
    );
    expect(reopenedResponse.ok()).toBe(true);
    const reopened = (await reopenedResponse.json()) as {
      version: number;
      schema_json: {
        sheets: Array<{
          name: string;
          rows: Array<{ cells: Record<string, { value?: unknown; formula?: string }> }>;
        }>;
      };
    };
    expect(reopened.version).toBe(initial.version + 1);
    expect(reopened.schema_json.sheets[0].rows[0].cells.A?.value).toBe(21);
    expect(reopened.schema_json.sheets[0].rows[0].cells.B?.formula).toBe('A2*2');

    await page.goto('/materials?tab=sheets', { waitUntil: 'domcontentloaded' });
    await page.goto(
      `/excele?artifactId=${workbookId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);
    const shell = page.getByTestId('spreadsheet-artifact-studio');
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell.getByRole('gridcell').filter({ hasText: '21' }).first()).toBeVisible();

    const downloadResponse = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}/download?mode=draft`,
      { headers }
    );
    expect(downloadResponse.ok(), await downloadResponse.text()).toBe(true);
    expect(downloadResponse.headers()['content-type']).toContain('spreadsheetml');
    expect(downloadResponse.headers()['x-artifact-export-mode']).toBe('draft');
    expect(downloadResponse.headers()['x-artifact-draft']).toBe('true');

    const bytes = Buffer.from(await downloadResponse.body());
    expect(bytes.subarray(0, 2).toString('ascii')).toBe('PK');
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(bytes);
    const sheet = exported.getWorksheet(reopened.schema_json.sheets[0].name);
    expect(sheet).toBeDefined();
    expect(sheet!.getCell('A2').value).toBe(21);
    expect(sheet!.getCell('B2').value).toEqual(expect.objectContaining({ formula: 'A2*2' }));
  });

  test('executes and undoes an approved Teresa workbook proposal with an audit trail', async ({
    page,
  }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    const workbookId = await createWorkbook(page, token);
    const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const initialResponse = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
    });
    expect(initialResponse.ok()).toBe(true);
    const initial = (await initialResponse.json()) as {
      version: number;
      schema_json: {
        sheets: Array<{ rows: Array<{ cells: Record<string, { value?: unknown }> }> }>;
      };
    };
    const originalValue = initial.schema_json.sheets[0].rows[0].cells.A?.value ?? null;
    const proposalValue = 37;
    const sessionId = `xlsx-teresa-${Date.now()}`;

    const createResponse = await page.request.post(`${API_BASE_URL}/api/v8/teresa/proposal`, {
      headers,
      data: {
        sessionId,
        idempotencyKey: `${sessionId}:proposal`,
        targetModule: 'excele',
        handoffContext: {
          origin: 'teresa',
          user_intent: 'Set the selected workbook cell to the approved value.',
          active_surface: 'spreadsheet-studio',
          org_context_ref: 'e2e-org-id',
          bounded_context_pack: [{ ref: workbookId, type: 'workbook' }],
          constraints: ['proposal_first'],
          assumptions: [],
          uncertainty_boundary: {
            missing_inputs: [],
            conflicts: [],
            what_would_change_next_action: [],
          },
          evidence_pointers: [`workbook:${workbookId}`, 'selection:A2'],
          proposed_next_action: {
            target_module: 'excele',
            handoff_intent: 'update_workbook',
            requires_approval: true,
          },
          audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
        },
        targetPayload: {
          prompt: 'Set A2 to 37 after explicit approval.',
          proposal_only: true,
          requires_structured_mutation: true,
          workbook_context: {
            workbook_id: workbookId,
            version_id: initial.version,
            active_sheet_index: 0,
            selection: { kind: 'cell', address: 'A2' },
          },
          workbook_mutation: {
            command_id: 'teresa.workbook.e2eApprovedMutation',
            operations: [
              { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: proposalValue },
            ],
          },
        },
      },
    });
    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const created = (await createResponse.json()) as { data?: { proposalId?: string; state?: string } };
    const proposalId = String(created.data?.proposalId || '');
    expect(proposalId).not.toBe('');
    expect(created.data?.state).toBe('proposal');

    const approveResponse = await page.request.post(
      `${API_BASE_URL}/api/v8/teresa/proposal/${proposalId}/approve`,
      { headers }
    );
    expect(approveResponse.ok(), await approveResponse.text()).toBe(true);
    expect(((await approveResponse.json()) as { data?: { state?: string } }).data?.state).toBe(
      'approved'
    );

    const executeResponse = await page.request.post(
      `${API_BASE_URL}/api/v8/teresa/proposal/${proposalId}/execute`,
      { headers }
    );
    expect(executeResponse.ok(), await executeResponse.text()).toBe(true);
    const executed = (await executeResponse.json()) as {
      data?: {
        execution?: { state?: string; handoff_result?: { version?: number; mutation_applied?: boolean } };
        proposal?: { state?: string };
      };
    };
    expect(executed.data?.execution?.state).toBe('completed');
    expect(executed.data?.execution?.handoff_result).toMatchObject({
      version: initial.version + 1,
      mutation_applied: true,
    });
    expect(executed.data?.proposal?.state).toBe('completed');

    const changedResponse = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
      timeout: 60_000,
    });
    expect(changedResponse.ok()).toBe(true);
    const changed = (await changedResponse.json()) as typeof initial;
    expect(changed.version).toBe(initial.version + 1);
    expect(changed.schema_json.sheets[0].rows[0].cells.A?.value).toBe(proposalValue);

    const auditResponse = await page.request.get(
      `${API_BASE_URL}/api/v8/teresa/audit/${proposalId}`,
      { headers }
    );
    expect(auditResponse.ok(), await auditResponse.text()).toBe(true);
    const audit = (await auditResponse.json()) as { data?: Array<{ action?: string }> };
    expect(audit.data?.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['proposal_created', 'approved', 'execution_completed'])
    );

    const undoResponse = await page.request.post(
      `${API_BASE_URL}/api/v8/teresa/proposal/${proposalId}/undo`,
      { headers }
    );
    expect(undoResponse.ok(), await undoResponse.text()).toBe(true);
    const undone = (await undoResponse.json()) as {
      data?: { execution?: { state?: string; handoff_result?: { version?: number; mutation_undone?: boolean } } };
    };
    expect(undone.data?.execution?.state).toBe('undone');
    expect(undone.data?.execution?.handoff_result).toMatchObject({
      version: initial.version + 2,
      mutation_undone: true,
    });

    const restoredResponse = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
      timeout: 60_000,
    });
    expect(restoredResponse.ok()).toBe(true);
    const restored = (await restoredResponse.json()) as typeof initial;
    expect(restored.version).toBe(initial.version + 2);
    expect(restored.schema_json.sheets[0].rows[0].cells.A?.value ?? null).toBe(originalValue);

    const finalAuditResponse = await page.request.get(
      `${API_BASE_URL}/api/v8/teresa/audit/${proposalId}`,
      { headers }
    );
    expect(finalAuditResponse.ok()).toBe(true);
    const finalAudit = (await finalAuditResponse.json()) as { data?: Array<{ action?: string }> };
    expect(finalAudit.data?.map((entry) => entry.action)).toContain('execution_undone');
  });

  test('persists multi-sheet styles, source-to-range anchors and command audit through cold reopen/export', async ({
    page,
  }) => {
    const token = await bootstrap(page);
    const workbookId = await createWorkbook(page, token);
    const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };

    const initialResponse = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}`, {
      headers,
    });
    expect(initialResponse.ok(), await initialResponse.text()).toBe(true);
    const initial = (await initialResponse.json()) as {
      version: number;
      schema_json: { sheets: Array<{ id?: string; name: string }> };
    };
    const primarySheetId = String(initial.schema_json.sheets[0]?.id || '');
    expect(primarySheetId, 'the persisted workbook must expose a stable primary sheet id').not.toBe(
      ''
    );
    const assumptionsSheetId = '11111111-1111-4111-8111-111111111111';

    const styleCommand = await page.request.post(
      `${API_BASE_URL}/api/workbook/${workbookId}/commands`,
      {
        headers,
        data: {
          commandId: 'xlsx.e2e.multisheet-style',
          baseVersion: initial.version,
          idempotencyKey: `xlsx-style-${workbookId}`,
          operations: [
            { type: 'addSheet', name: 'Assumptions', sheetId: assumptionsSheetId },
            { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 0.184 },
            {
              type: 'setCellStyle',
              sheetIndex: 0,
              startRow: 0,
              endRow: 1,
              startColumn: 0,
              endColumn: 1,
              patch: {
                bold: true,
                bgColor: '#FFF2CC',
                numberFormat: '0.00%',
                alignment: 'center',
                wrapText: true,
                border: 'thin',
              },
            },
          ],
        },
      }
    );
    expect(styleCommand.ok(), await styleCommand.text()).toBe(true);
    const styleVersion = Number(
      ((await styleCommand.json()) as { newVersion?: number; version?: number }).newVersion ??
        initial.version + 1
    );
    expect(styleVersion).toBe(initial.version + 1);

    const secondSheetCommand = await page.request.post(
      `${API_BASE_URL}/api/workbook/${workbookId}/commands`,
      {
        headers,
        data: {
          commandId: 'xlsx.e2e.second-sheet',
          baseVersion: styleVersion,
          idempotencyKey: `xlsx-second-sheet-${workbookId}`,
          operations: [
            {
              type: 'setCell',
              sheetIndex: 1,
              rowIndex: 0,
              columnKey: 'A',
              value: 'Validated assumption',
            },
            {
              type: 'setCellStyle',
              sheetIndex: 1,
              startRow: 0,
              endRow: 1,
              startColumn: 0,
              endColumn: 1,
              patch: { bold: true, fontColor: '#FFFFFF', bgColor: '#1F4E78' },
            },
          ],
        },
      }
    );
    expect(secondSheetCommand.ok(), await secondSheetCommand.text()).toBe(true);
    const secondSheetVersion = Number(
      ((await secondSheetCommand.json()) as { newVersion?: number; version?: number }).newVersion ??
        styleVersion + 1
    );
    expect(secondSheetVersion).toBe(styleVersion + 1);

    const sourceResponse = await page.request.post(
      `${API_BASE_URL}/api/workbook/${workbookId}/sources`,
      {
        headers,
        data: {
          label: 'CRM snapshot 2026-08-05',
          sourceRef: 'source:e2e-crm',
          sourceType: 'dataset',
          sheetId: primarySheetId,
          range: 'A2:B3',
          idempotencyKey: `xlsx-source-${workbookId}`,
          baseVersion: secondSheetVersion,
        },
      }
    );
    expect(sourceResponse.status(), await sourceResponse.text()).toBe(201);
    const sourceVersion = Number(((await sourceResponse.json()) as { version?: number }).version);
    expect(sourceVersion).toBe(secondSheetVersion + 1);

    const shiftCommand = await page.request.post(
      `${API_BASE_URL}/api/workbook/${workbookId}/commands`,
      {
        headers,
        data: {
          commandId: 'xlsx.e2e.anchor-shift',
          baseVersion: sourceVersion,
          idempotencyKey: `xlsx-anchor-shift-${workbookId}`,
          operations: [{ type: 'insertRows', sheetIndex: 0, atIndex: 0, count: 1 }],
        },
      }
    );
    expect(shiftCommand.ok(), await shiftCommand.text()).toBe(true);
    const finalVersion = Number(
      ((await shiftCommand.json()) as { newVersion?: number; version?: number }).newVersion ??
        sourceVersion + 1
    );
    expect(finalVersion).toBe(sourceVersion + 1);

    const sources = await page.request.get(`${API_BASE_URL}/api/workbook/${workbookId}/sources`, {
      headers,
    });
    expect(sources.ok(), await sources.text()).toBe(true);
    expect((await sources.json()).bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sheetId: primarySheetId,
          range: 'A3:B4',
          label: 'CRM snapshot 2026-08-05',
          sourceRef: 'source:e2e-crm',
          sourceType: 'dataset',
          anchorState: 'active',
        }),
      ])
    );

    const revisions = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}/revisions`,
      { headers }
    );
    expect(revisions.ok(), await revisions.text()).toBe(true);
    const revisionCommands = ((await revisions.json()) as {
      revisions?: Array<{ command_id?: string }>;
    }).revisions?.map((entry) => entry.command_id);
    expect(revisionCommands).toEqual(
      expect.arrayContaining([
        'xlsx.e2e.multisheet-style',
        'xlsx.e2e.second-sheet',
        'xlsx.sources.bind',
        'xlsx.e2e.anchor-shift',
      ])
    );

    const reopenedResponse = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}`,
      { headers }
    );
    expect(reopenedResponse.ok(), await reopenedResponse.text()).toBe(true);
    const reopened = (await reopenedResponse.json()) as {
      version: number;
      schema_json: {
        sheets: Array<{
          id?: string;
          name: string;
          rows: Array<{
            cells: Record<
              string,
              { value?: unknown; style?: { bold?: boolean; bgColor?: string; numberFormat?: string } }
            >;
          }>;
        }>;
      };
    };
    expect(reopened.version).toBe(finalVersion);
    expect(reopened.schema_json.sheets.map((sheet) => sheet.name)).toEqual([
      initial.schema_json.sheets[0].name,
      'Assumptions',
    ]);
    expect(reopened.schema_json.sheets[0].rows[1].cells.A).toMatchObject({
      value: 0.184,
      style: { bold: true, bgColor: '#FFF2CC', numberFormat: '0.00%' },
    });
    expect(reopened.schema_json.sheets[1].rows[0].cells.A).toMatchObject({
      value: 'Validated assumption',
      style: { bold: true, bgColor: '#1F4E78' },
    });

    const downloadResponse = await page.request.get(
      `${API_BASE_URL}/api/workbook/${workbookId}/download?mode=draft`,
      { headers }
    );
    expect(downloadResponse.ok(), await downloadResponse.text()).toBe(true);
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(Buffer.from(await downloadResponse.body()));
    expect(exported.worksheets.map((sheet) => sheet.name)).toEqual([
      initial.schema_json.sheets[0].name,
      'Assumptions',
      'Info',
    ]);
    const exportedPrimary = exported.getWorksheet(initial.schema_json.sheets[0].name)!;
    expect(exportedPrimary.getCell('A3').value).toBe(0.184);
    expect(exportedPrimary.getCell('A3').font.bold).toBe(true);
    expect(exportedPrimary.getCell('A3').numFmt).toBe('0.00%');
    expect(exportedPrimary.getCell('A3').alignment.horizontal).toBe('center');
    expect(exportedPrimary.getCell('A3').alignment.wrapText).toBe(true);
    expect(exportedPrimary.getCell('A3').border.top?.style).toBe('thin');
    expect(exported.getWorksheet('Assumptions')!.getCell('A2').value).toBe(
      'Validated assumption'
    );
  });

  test('reopens a real tp_tables-origin artifact through the canonical Table Studio route', async ({
    page,
  }) => {
    const token = await bootstrap(page);
    await seedAuth(page, token);
    await suppressOnboarding(page);
    const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const workspaceId = `xlsx-origin-${Date.now().toString(36)}`;

    const baseResponse = await page.request.post(`${API_BASE_URL}/api/table-platform/bases`, {
      headers,
      data: { workspaceId, name: 'Artifact Studio Origin Base' },
    });
    expect(baseResponse.status(), await baseResponse.text()).toBe(201);
    const basePayload = (await baseResponse.json()) as {
      id?: string;
      base_id?: string;
      baseId?: string;
    };
    const baseId = String(basePayload.id || basePayload.base_id || basePayload.baseId || '');
    expect(baseId).not.toBe('');

    const tableResponse = await page.request.post(
      `${API_BASE_URL}/api/table-platform/bases/${baseId}/tables`,
      { headers, data: { name: 'Artifact Studio Origin Table' } }
    );
    expect(tableResponse.status(), await tableResponse.text()).toBe(201);
    const tablePayload = (await tableResponse.json()) as {
      id?: string;
      table_id?: string;
      tableId?: string;
    };
    const tableId = String(tablePayload.id || tablePayload.table_id || tablePayload.tableId || '');
    expect(tableId).not.toBe('');

    const persistedTable = await page.request.get(
      `${API_BASE_URL}/api/table-platform/tables/${tableId}`,
      { headers }
    );
    expect(persistedTable.ok(), await persistedTable.text()).toBe(true);
    expect(await persistedTable.json()).toMatchObject({ name: 'Artifact Studio Origin Table' });

    await page.goto(
      `/excele?artifactId=${tableId}&ff_excele=1&ff_artifactStudio=1&ff_spreadsheetStudioV2=1`,
      { waitUntil: 'domcontentloaded' }
    );
    await dismissOverlayIfPresent(page);

    await expect(page).toHaveURL(
      new RegExp(
        `/my-work/ideas/${workspaceId}/workspace/table\\?tpTable=${tableId}(?:&|$)`
      ),
      { timeout: 30_000 }
    );
    await expect(page.getByTestId('spreadsheet-artifact-studio')).toHaveCount(0);
    await expect(page.getByText('Artifact not found', { exact: false })).toHaveCount(0);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3411';
const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3410';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

test('signed XLSX statement confirm registers a canonical pack and import survives cold reopen', async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(300_000);
  const state = readTestSupportState();
  const runId = `fin-import-${Date.now()}`;
  const flagKeys = [
    'financeStatementPackWorkspaceV2',
    'financeWorkspacePlatformV1',
    'financeExportImportV1',
  ] as const;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let statementId = '';
  let statementPackId = '';
  let artifactId = '';
  let businessVersionId = '';
  let workingRevisionId = '';
  let foreignArtifactCountBeforeCleanup = 0;
  const foreignOrganizationId = `org-fin-import-decoy-${randomUUID()}`;
  const foreignArtifactId = `artifact-fin-import-decoy-${randomUUID()}`;

  try {
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      foreignOrganizationId,
      'Finance import foreign cleanup decoy',
    ]);
    await pool.query(
      `INSERT INTO finance_artifacts (artifact_id, organization_id, artifact_type)
       VALUES ($1, $2, 'STATEMENT_PACK')`,
      [foreignArtifactId, foreignOrganizationId]
    );

    for (const flagKey of flagKeys) {
      const enabled = await request.post(`${API_BASE_URL}/api/test-support/org-feature-flag`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { flagKey, organizationId: state.organizationId, enabled: true, runId },
      });
      expect(enabled.status(), `enable ${flagKey}`).toBe(200);
    }

    await page.addInitScript(({ token, organizationId, userId }) => {
      const user = {
        id: userId,
        organizationId,
        email: 'finance-import@local.test',
        role: 'OWNER',
        isAuthenticated: true,
        accessLevel: 'full',
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(
        'consultinity-storage',
        JSON.stringify({
          state: {
            sessionMode: 'FULL',
            currentUser: user,
            currentOrganization: { id: organizationId, name: 'E2E Organization' },
          },
          version: 0,
        })
      );
    }, state);

    await page.goto(`${WEB_BASE_URL}/finance?tab=statements`);
    const skip = page.getByText(/Skip for now|Pomiń/i).last();
    if (
      await skip
        .waitFor({ state: 'visible', timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await skip.click();
    }
    await page
      .getByRole('button', { name: /Import statement|Importuj sprawozdanie/i })
      .first()
      .click();

    const sourceWorkbook = path.resolve('tests/fixtures/finance/dbr77-financial-statements.xlsx');
    await page.locator('input[type=file][accept*=".xlsx"]').setInputFiles(sourceWorkbook);
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/(?:v8\/finance\/statements|finance-statements)\/upload-and-analyze$/.test(
          new URL(response.url()).pathname
        ) &&
        response.request().method() === 'POST' &&
        response.status() === 201
    );
    await page.getByRole('button', { name: /Upload & Analyze|Prześlij.*analizuj/i }).click();
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    const stagedResponse = await uploadResponse.json();
    const staged = stagedResponse.data || stagedResponse;
    expect(staged).toMatchObject({ mode: 'fallback', statementPackId: null });
    expect(staged.statementIds).toHaveLength(1);
    statementId = String(staged.statementIds[0]);

    await page.locator('select').first().selectOption('BS');
    await page.getByPlaceholder('e.g. 2024').fill('2026');

    const extract = page.getByRole('button', {
      name: /Extract selected statement section|Extract Financial Lines|Wyodrębnij/i,
    });
    await extract.waitFor({ state: 'visible', timeout: 30_000 });
    await extract.click();

    const derivedLabel = '[CFO-derived] Total Assets − Current Assets';
    const editDerived = page.getByRole('button', {
      name: `Edit ${derivedLabel} value`,
      exact: true,
    });
    await expect(editDerived).toBeVisible();
    await editDerived.click();
    const derivedInput = page.getByRole('spinbutton', { name: `${derivedLabel} value` });
    await derivedInput.fill('9500000');
    await derivedInput.press('Enter');
    await expect(editDerived).toContainText('9,500,000');

    const continueToConfirm = page.getByRole('button', {
      name: /Save & Validate|Zapisz.*waliduj/i,
    });
    await continueToConfirm.waitFor({ state: 'visible', timeout: 30_000 });
    await continueToConfirm.click();

    const stagedState = await pool.query(
      `SELECT extraction_strategy, status, statement_pack_id FROM financial_statements WHERE id = $1`,
      [statementId]
    );
    expect(stagedState.rows[0]).toMatchObject({
      extraction_strategy: 'spreadsheet_structured_staged',
      statement_pack_id: null,
    });
    expect(String(stagedState.rows[0]?.status).toLowerCase()).not.toBe('confirmed');

    const explicitValidation = await request.post(
      `${API_BASE_URL}/api/finance-statements/${statementId}/validate`,
      {
        headers: {
          Authorization: `Bearer ${state.token}`,
          'x-org-context': state.organizationId,
        },
      }
    );
    expect(explicitValidation.status(), await explicitValidation.text()).toBe(200);
    expect(await explicitValidation.json()).toMatchObject({
      statementId,
      statementPackId: null,
    });

    const beforeConfirm = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM financial_statements WHERE id = $1 AND statement_pack_id IS NOT NULL) AS pack_items,
         (SELECT count(*)::int FROM finance_artifact_aliases WHERE legacy_table = 'financial_statement_packs' AND organization_id = $2) AS aliases,
         (SELECT count(*)::int FROM finance_artifacts WHERE organization_id = $2 AND artifact_type = 'STATEMENT_PACK') AS artifacts`,
      [statementId, state.organizationId]
    );
    expect(beforeConfirm.rows[0]).toEqual({ pack_items: 0, aliases: 0, artifacts: 0 });

    const confirmResponsePromise = page.waitForResponse(
      (response) =>
        /\/api\/(?:v8\/finance\/statements|finance-statements)\/[^/]+\/confirm$/.test(
          new URL(response.url()).pathname
        ) &&
        response.request().method() === 'POST' &&
        response.status() === 200
    );
    await page.getByRole('button', { name: /Confirm & Save|Potwierdź.*zapisz/i }).click();
    const confirmResponse = await confirmResponsePromise;
    expect(confirmResponse.status()).toBe(200);
    const confirmedResponse = await confirmResponse.json();
    const confirmed = confirmedResponse.data || confirmedResponse;
    expect(confirmed).toMatchObject({ success: true, canonicalReplay: false });
    expect(confirmed.statementPackId).toBeTruthy();
    expect(confirmed.canonicalArtifactId).toBeTruthy();
    expect(confirmed.canonicalBusinessVersionId).toBeTruthy();
    expect(confirmed.canonicalWorkingRevisionId).toBeTruthy();
    statementPackId = String(confirmed.statementPackId);
    artifactId = String(confirmed.canonicalArtifactId);
    businessVersionId = String(confirmed.canonicalBusinessVersionId);

    await page.goto(`${WEB_BASE_URL}/finance/statements/${confirmed.statementPackId}`);
    await page.getByRole('button', { name: 'Excel', exact: true }).click();
    const panel = page.getByTestId('finance-export-import-panel');
    await expect(panel).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await panel.getByTestId('export-button').click();
    const download = await downloadPromise;
    const exportedWorkbook = await download.path();
    expect(exportedWorkbook).toBeTruthy();

    await panel.getByTestId('import-file-input').setInputFiles({
      name: 'statement-pack-export.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: fs.readFileSync(exportedWorkbook!),
    });
    await expect(panel.getByTestId('import-parsed')).toContainText(/Manifest OK/i);
    await panel.getByTestId('import-preview-button').click();
    await expect(panel.getByTestId('import-preview')).toBeVisible();
    await expect(panel.getByTestId('import-apply-button')).toBeEnabled();
    const applyResponsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v8/finance-v2/import/apply' &&
        response.request().method() === 'POST'
    );
    await panel.getByTestId('import-apply-button').click();
    const applyResponse = await applyResponsePromise;
    expect(applyResponse.status()).toBe(200);
    const applied = await applyResponse.json();
    const appliedData = applied.data || applied;
    const appliedWorkingRevisionId = String(appliedData.newWorkingRevisionId);
    workingRevisionId = appliedWorkingRevisionId;
    await expect(panel.getByTestId('import-applied')).toContainText(appliedWorkingRevisionId);

    const cold = await browser.newPage();
    try {
      await cold.addInitScript(({ token, organizationId, userId }) => {
        localStorage.setItem('token', token);
        localStorage.setItem(
          'user',
          JSON.stringify({ id: userId, organizationId, role: 'OWNER', isAuthenticated: true })
        );
      }, state);
      const coldVersionPromise = cold.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/v8/finance-v2/versions/${confirmed.canonicalBusinessVersionId}` &&
          response.request().method() === 'GET' &&
          response.status() === 200
      );
      await cold.goto(`${WEB_BASE_URL}/finance/statements/${confirmed.statementPackId}`);
      const coldVersion = await (await coldVersionPromise).json();
      expect(coldVersion.data).toMatchObject({
        artifactId: confirmed.canonicalArtifactId,
        businessVersionId: confirmed.canonicalBusinessVersionId,
        sourceWorkingRevisionId: appliedWorkingRevisionId,
      });
      await cold.getByRole('button', { name: 'Excel', exact: true }).click();
      await expect(cold.getByTestId('finance-export-import-panel')).toBeVisible();
    } finally {
      await cold.close();
    }
  } finally {
    let cleanupStatus = 0;
    let cleanupBody = '';
    let residue: Record<string, number> | undefined;
    let foreignArtifactCountAfterCleanup = 0;
    const flagOffStatuses: Array<{ flagKey: (typeof flagKeys)[number]; status: number }> = [];
    try {
      foreignArtifactCountBeforeCleanup = Number(
        (
          await pool.query(
            `SELECT count(*)::int AS count FROM finance_artifacts WHERE artifact_id = $1`,
            [foreignArtifactId]
          )
        ).rows[0]?.count || 0
      );
      const cleanup = await request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
        headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
        data: { runId: state.runId },
      });
      cleanupStatus = cleanup.status();
      cleanupBody = await cleanup.text();
      residue = (
        await pool.query(
          `SELECT
             (SELECT count(*)::int FROM financial_statements WHERE id = $1) AS statements,
             (SELECT count(*)::int FROM financial_statement_packs WHERE id = $2) AS packs,
             (SELECT count(*)::int FROM finance_artifacts WHERE artifact_id = $3) AS artifacts,
             (SELECT count(*)::int FROM finance_business_versions WHERE business_version_id = $5) AS business_versions,
             (SELECT count(*)::int FROM finance_artifact_aliases WHERE artifact_id = $3) AS aliases,
             (SELECT count(*)::int FROM finance_import_receipts WHERE artifact_id = $3) AS receipts,
             (SELECT count(*)::int FROM finance_working_revisions WHERE working_revision_id = $4) AS revisions`,
          [
            statementId || null,
            statementPackId || null,
            artifactId || null,
            workingRevisionId || null,
            businessVersionId || null,
          ]
        )
      ).rows[0];
      foreignArtifactCountAfterCleanup = Number(
        (
          await pool.query(
            `SELECT count(*)::int AS count FROM finance_artifacts WHERE artifact_id = $1`,
            [foreignArtifactId]
          )
        ).rows[0]?.count || 0
      );
    } finally {
      for (const flagKey of flagKeys) {
        const disabled = await request.post(`${API_BASE_URL}/api/test-support/org-feature-flag`, {
          headers: { 'x-test-support-key': TEST_SUPPORT_KEY },
          data: { flagKey, organizationId: state.organizationId, enabled: false, runId },
        });
        flagOffStatuses.push({ flagKey, status: disabled.status() });
      }
      await pool.query(`DELETE FROM finance_artifacts WHERE artifact_id = $1`, [foreignArtifactId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [foreignOrganizationId]);
      await pool.end();
    }

    expect(cleanupStatus, cleanupBody).toBe(200);
    expect(flagOffStatuses).toEqual(flagKeys.map((flagKey) => ({ flagKey, status: 200 })));
    expect(residue).toEqual({
      statements: 0,
      packs: 0,
      artifacts: 0,
      business_versions: 0,
      aliases: 0,
      receipts: 0,
      revisions: 0,
    });
    expect(foreignArtifactCountBeforeCleanup).toBe(1);
    expect(foreignArtifactCountAfterCleanup).toBe(1);
  }
});

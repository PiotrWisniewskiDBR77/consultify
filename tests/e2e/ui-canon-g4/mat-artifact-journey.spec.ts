import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import {
  API,
  auth,
  bootstrap,
  cleanup,
  expectJsonOk,
  signInPage,
  type SignedFixture,
} from './_g4/matArtifactJourneyFixture';
import {
  collectSchemaText,
  fetchArtifactSchema,
  seedDocumentArtifact,
} from '../documents/_document-studio-helpers';

test.describe('MAT exact mounted DOC/PPT/XLSX journey', () => {
  test.setTimeout(10 * 60_000);

  let owner: SignedFixture;
  let foreign: SignedFixture;

  test.beforeEach(async ({ request, page }) => {
    const suffix = `${process.pid}-${Date.now()}`;
    owner = await bootstrap(request, `mat-journey-owner-${suffix}`);
    foreign = await bootstrap(request, `mat-journey-foreign-${suffix}`);
    await signInPage(page, owner);
  });

  test.afterEach(async ({ request }) => {
    if (foreign) await cleanup(request, foreign);
    if (owner) await cleanup(request, owner);
  });

  test('create, edit, version, restore, cold reopen and export keep exact tenant identity', async ({
    page,
    request,
  }) => {
    const headers = auth(owner.token);
    const foreignHeaders = auth(foreign.token);

    // DOC: create -> CAS edit -> checkpoint -> second edit -> rollback -> cold read -> DOCX.
    const seeded = await seedDocumentArtifact(request, owner.token, {
      description: 'MAT governed document journey',
      documentType: 'operating_model_review',
    });
    const docId = seeded.artifactId;
    const firstSections = structuredClone(seeded.schema.sections);
    firstSections[0].blocks[0].content.text = 'MAT-DOC-V1';
    const save1 = await request.put(`${API}/api/document-studio/${docId}/content`, {
      headers,
      data: { sections: firstSections, expectedVersion: seeded.schema.updatedAt },
    });
    expect(save1.status(), await save1.text()).toBe(200);
    const saved1 = (await save1.json()).schema;
    const checkpoint = await request.post(`${API}/api/document-studio/${docId}/snapshots`, {
      headers,
      data: { label: 'MAT V1' },
    });
    expect(checkpoint.status(), await checkpoint.text()).toBe(201);
    const checkpointBody = await checkpoint.json();
    const versionId = String(checkpointBody.snapshot?.versionId || checkpointBody.versionId || '');
    expect(versionId).not.toBe('');
    const secondSections = structuredClone(saved1.sections);
    secondSections[0].blocks[0].content.text = 'MAT-DOC-V2';
    expect(
      (
        await request.put(`${API}/api/document-studio/${docId}/content`, {
          headers,
          data: { sections: secondSections, expectedVersion: saved1.updatedAt },
        })
      ).status()
    ).toBe(200);
    const rollback = await request.post(
      `${API}/api/document-studio/${docId}/snapshots/${versionId}/rollback`,
      {
        headers,
        data: { reason: 'MAT restore proof' },
      }
    );
    expect(rollback.status(), await rollback.text()).toBe(200);
    const coldDoc = await fetchArtifactSchema(request, owner.token, docId);
    expect(collectSchemaText(coldDoc)).toContain('MAT-DOC-V1');
    expect(collectSchemaText(coldDoc)).not.toContain('MAT-DOC-V2');
    expect(
      (
        await request.get(`${API}/api/document-studio/${docId}`, { headers: foreignHeaders })
      ).status()
    ).toBe(404);
    const docx = await request.get(`${API}/api/document-studio/${docId}/export/docx?mode=draft`, {
      headers,
    });
    expect(docx.status(), await docx.text()).toBe(200);
    const docZip = await JSZip.loadAsync(Buffer.from((await docx.json()).contentBase64, 'base64'));
    expect(await docZip.file('word/document.xml')!.async('string')).toContain('MAT-DOC-V1');

    // PPT: real create -> autosave -> versions -> restore -> cold read -> PPTX.
    const deckCreate = await request.post(`${API}/api/presentations/decks`, {
      headers,
      data: {
        title: 'MAT deck',
        theme: 'modern',
        slides: [{ type: 'title', content: { title: 'MAT-PPT-V1' } }],
      },
    });
    expect(deckCreate.status(), await deckCreate.text()).toBe(201);
    const deckId = String((await deckCreate.json()).data?.id || '');
    const deck0 = await expectJsonOk(
      await request.get(`${API}/api/presentations/decks/${deckId}`, { headers })
    );
    const baseVersion = Number(deck0.data?.version ?? 1);
    const autosave = await request.put(`${API}/api/presentations/decks/${deckId}/autosave`, {
      headers: { ...headers, 'x-deck-version': String(baseVersion) },
      data: {
        cards: [{ type: 'title', content: { title: 'MAT-PPT-V2' }, speaker_notes: 'MAT notes' }],
      },
    });
    expect(autosave.status(), await autosave.text()).toBe(200);
    const versions = await expectJsonOk(
      await request.get(`${API}/api/presentations/decks/${deckId}/versions`, { headers })
    );
    expect(versions.data?.length || versions.versions?.length).toBeGreaterThan(0);
    const firstDeckVersion = (versions.data || versions.versions)[0];
    const restoredDeck = await request.post(
      `${API}/api/presentations/decks/${deckId}/versions/${firstDeckVersion.id}/restore`,
      { headers, data: { expectedVersion: baseVersion + 1 } }
    );
    expect(restoredDeck.status(), await restoredDeck.text()).toBe(200);
    expect(
      (
        await request.get(`${API}/api/presentations/decks/${deckId}`, { headers: foreignHeaders })
      ).status()
    ).toBe(404);
    const pptx = await request.get(`${API}/api/presentations/decks/${deckId}/download?mode=draft`, {
      headers,
      timeout: 120_000,
    });
    expect(pptx.status(), await pptx.text()).toBe(200);
    const pptZip = await JSZip.loadAsync(await pptx.body());
    expect(
      Object.keys(pptZip.files).some((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    ).toBe(true);

    // XLSX: real browser entry/edit/reload plus revision/restore and inspectable download.
    await page.goto('/excele?view=new&entry=blank');
    await expect(page).toHaveURL(/artifactId=/, { timeout: 30_000 });
    const workbookId = new URL(page.url()).searchParams.get('artifactId')!;
    const onboarding = page.getByRole('dialog').filter({ hasText: 'Welcome to Consultify' });
    if (await onboarding.isVisible().catch(() => false)) {
      await onboarding.getByRole('button', { name: 'Skip for now' }).click();
      await expect(onboarding).toBeHidden();
    }
    const firstDataRow = page.getByRole('row', { name: /^2(?:\s|$)/ });
    const cellA2 = firstDataRow.getByRole('gridcell').nth(0);
    const cellB2 = firstDataRow.getByRole('gridcell').nth(1);
    await cellA2.dblclick();
    const cellA2Editor = cellA2.getByRole('textbox');
    await cellA2Editor.fill('21');
    const saveA2 = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/workbook/${workbookId}/cell`)
    );
    await cellA2Editor.press('Enter');
    expect((await saveA2).status()).toBe(200);
    await cellB2.click();
    const formulaBar = page.getByRole('textbox', { name: 'Select a cell to see its content' });
    await expect(formulaBar).toBeEditable();
    await formulaBar.fill('=A2*2');
    const saveB2 = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().includes(`/api/workbook/${workbookId}/cell`)
    );
    await formulaBar.press('Enter');
    expect((await saveB2).status()).toBe(200);
    await page.reload();
    const coldFirstDataRow = page.getByRole('row', { name: /^2(?:\s|$)/ });
    await expect(coldFirstDataRow.getByRole('gridcell').nth(0)).toHaveText('21');
    await expect(coldFirstDataRow.getByRole('gridcell').nth(1)).toHaveText('42');
    await coldFirstDataRow.getByRole('gridcell').nth(1).click();
    await expect(
      page.getByRole('textbox', { name: 'Select a cell to see its content' })
    ).toHaveValue('=A2*2');
    const head = await expectJsonOk(
      await request.get(`${API}/api/workbook/${workbookId}`, { headers })
    );
    const checkpointForRestore = await expectJsonOk(
      await request.post(`${API}/api/workbook/${workbookId}/commands`, {
        headers,
        data: {
          commandId: `mat-checkpoint-${workbookId}`,
          baseVersion: Number(head.version),
          idempotencyKey: `mat-checkpoint-${workbookId}`,
          operations: [{ type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 }],
        },
      })
    );
    const mutateForRestore = await expectJsonOk(
      await request.post(`${API}/api/workbook/${workbookId}/commands`, {
        headers,
        data: {
          commandId: `mat-mutate-${workbookId}`,
          baseVersion: Number(checkpointForRestore.version),
          idempotencyKey: `mat-mutate-${workbookId}`,
          operations: [{ type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 999 }],
        },
      })
    );
    const revisions = await expectJsonOk(
      await request.get(`${API}/api/workbook/${workbookId}/revisions`, { headers })
    );
    const revisionRows = revisions.revisions || revisions.data;
    expect(revisionRows.map((row: any) => Number(row.version))).toContain(
      Number(checkpointForRestore.version)
    );
    const restoreWorkbook = await request.post(
      `${API}/api/workbook/${workbookId}/revisions/${Number(checkpointForRestore.version)}/restore`,
      { headers, data: { baseVersion: Number(mutateForRestore.version) } }
    );
    expect(restoreWorkbook.status(), await restoreWorkbook.text()).toBe(200);
    const restoredWorkbook = await expectJsonOk(
      await request.get(`${API}/api/workbook/${workbookId}`, { headers })
    );
    expect(restoredWorkbook.schema_json.sheets[0].rows[0].cells.A.value).toBe(21);
    expect(
      (await request.get(`${API}/api/workbook/${workbookId}`, { headers: foreignHeaders })).status()
    ).toBe(404);
    const xlsxResponse = await request.get(`${API}/api/workbook/${workbookId}/download`, {
      headers,
    });
    expect(xlsxResponse.status(), await xlsxResponse.text()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await xlsxResponse.body());
    expect(workbook.getWorksheet('Arkusz1')?.getCell('B2').value).toEqual(
      expect.objectContaining({ formula: 'A2*2' })
    );

    expect(
      (await request.get(`${API}/api/artifacts?drafts=include&dedupe=false`, { headers })).status()
    ).toBe(200);
    expect((await request.get(`${API}/api/document-studio/${docId}`)).status()).toBe(401);
  });
});

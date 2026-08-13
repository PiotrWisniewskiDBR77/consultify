import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import jwt from 'jsonwebtoken';

import { API_BASE_URL, DOC_STUDIO_BASE, authHeaders } from '../documents/_document-studio-helpers';

const OUTPUT_DIR = path.resolve(
  process.env.ARTIFACT_REVIEW_OUTPUT_DIR || 'test-results/artifact-studio-strict'
);
const BASELINE_DIR = process.env.ARTIFACT_REVIEW_BASELINE_DIR;

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test.describe('Artifact Studio strict cold-reopen [@module:artifact-studio]', () => {
  test('reopens persisted IDs in a new session after an externally enforced backend restart', async ({
    request,
  }) => {
    const manifestPath =
      process.env.ARTIFACT_REVIEW_MANIFEST || path.join(OUTPUT_DIR, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const runId = String(process.env.ARTIFACT_REVIEW_RUN_ID || manifest.runId || '').trim();
    expect(runId, 'ARTIFACT_REVIEW_RUN_ID (or manifest.runId) is required').not.toBe('');
    const organizationId = String(process.env.ARTIFACT_REVIEW_ORGANIZATION_ID || '').trim();
    const userId = String(process.env.ARTIFACT_REVIEW_USER_ID || '').trim();
    const email = String(process.env.ARTIFACT_REVIEW_USER_EMAIL || '').trim();
    expect(organizationId, 'ARTIFACT_REVIEW_ORGANIZATION_ID is required').not.toBe('');
    expect(userId, 'ARTIFACT_REVIEW_USER_ID is required').not.toBe('');
    expect(email, 'ARTIFACT_REVIEW_USER_EMAIL is required').not.toBe('');
    const token = jwt.sign(
      {
        id: userId,
        email,
        name: 'Cold reopen verifier',
        role: 'ADMIN',
        organizationId,
        isSuperAdmin: false,
        runId,
        jti: `cold-reopen-${Date.now()}`,
      },
      process.env.JWT_SECRET || 'artifact-qa-local-only-secret-20260812',
      { expiresIn: '10m' }
    );
    expect(token).not.toBe('');
    const headers = authHeaders(token);

    const doc = await request.get(`${DOC_STUDIO_BASE}/${manifest.artifactIds.document}`, {
      headers,
    });
    expect(doc.ok(), await doc.text()).toBe(true);
    const docPayload = ((await doc.json()) as any).schema;
    expect(docPayload.title).toBe(manifest.title);
    expect(docPayload.sourceRefs.map((source: any) => source.sourceId)).toEqual(
      manifest.sources.map((source: any) => source.sourceId)
    );

    const docExport = await request.get(
      `${DOC_STUDIO_BASE}/${manifest.artifactIds.document}/export/docx?mode=draft`,
      { headers, timeout: 90_000 }
    );
    expect(docExport.ok(), await docExport.text()).toBe(true);
    const docBytes = Buffer.from(((await docExport.json()) as any).contentBase64, 'base64');
    const docZip = await JSZip.loadAsync(docBytes);
    const docXml = (await docZip.file('word/document.xml')?.async('string')) || '';
    expect(docXml).toContain(manifest.caseId);
    expect(docXml).toContain('DEFER pending evidence');

    const deck = await request.get(
      `${API_BASE_URL}/api/presentations/decks/${manifest.artifactIds.presentation}`,
      { headers }
    );
    expect(deck.ok(), await deck.text()).toBe(true);
    const deckExport = await request.get(
      `${API_BASE_URL}/api/presentations/decks/${manifest.artifactIds.presentation}/download?mode=draft`,
      { headers, timeout: 90_000 }
    );
    expect(deckExport.ok(), await deckExport.text()).toBe(true);
    const deckBytes = Buffer.from(await deckExport.body());
    const deckZip = await JSZip.loadAsync(deckBytes);
    const deckText = (
      await Promise.all(
        Object.keys(deckZip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .map((name) => deckZip.file(name)!.async('string'))
      )
    ).join('\n');
    expect(deckText).toContain('DEFER');
    expect(deckText).toContain('UNKNOWN');

    const workbook = await request.get(
      `${API_BASE_URL}/api/workbook/${manifest.artifactIds.workbook}`,
      {
        headers,
      }
    );
    expect(workbook.ok(), await workbook.text()).toBe(true);
    const workbookPayload = (await workbook.json()) as any;
    expect(workbookPayload.sourcePack).toMatchObject({ packId: manifest.caseId });
    expect(workbookPayload.evidenceRefs.map((source: any) => source.sourceId)).toEqual(
      manifest.sources.map((source: any) => source.sourceId)
    );
    const bindings = await request.get(
      `${API_BASE_URL}/api/workbook/${manifest.artifactIds.workbook}/sources`,
      { headers }
    );
    expect(bindings.ok(), await bindings.text()).toBe(true);
    const nativeBindings = ((await bindings.json()) as any).bindings;
    expect(new Set(nativeBindings.map((binding: any) => binding.sourceRef))).toEqual(
      new Set(manifest.sources.map((source: any) => source.sourceId))
    );

    const workbookExport = await request.get(
      `${API_BASE_URL}/api/workbook/${manifest.artifactIds.workbook}/download?mode=draft`,
      { headers, timeout: 90_000 }
    );
    expect(workbookExport.ok(), await workbookExport.text()).toBe(true);
    const workbookBytes = Buffer.from(await workbookExport.body());
    const xlsx = new ExcelJS.Workbook();
    await xlsx.xlsx.load(workbookBytes);
    expect(xlsx.worksheets.map((sheet) => sheet.name)[0]).toBe('Info');
    const decisionSummary = xlsx.getWorksheet('Decision Summary')!;
    expect(decisionSummary.getCell('B2').value).toBe(manifest.caseId);
    for (const address of ['B6', 'B7']) {
      expect(typeof decisionSummary.getCell(address).value, `${address} must remain numeric`).toBe(
        'number'
      );
    }
    const gapValue = decisionSummary.getCell('B8').value;
    expect(gapValue, 'B8 must remain a calculated numeric gap').toMatchObject({ formula: 'B6-B7' });
    expect(typeof (gapValue as ExcelJS.CellFormulaValue).result).toBe('number');
    expect(decisionSummary.getCell('B9').value).toBe('UNKNOWN');
    expect(xlsx.getWorksheet('Sources')!.getColumn(2).values).toEqual(
      expect.arrayContaining(manifest.sources.map((source: any) => source.sourceId))
    );

    await Promise.all([
      fs.writeFile(path.join(OUTPUT_DIR, 'cold-reopen.docx'), docBytes),
      fs.writeFile(path.join(OUTPUT_DIR, 'cold-reopen.pptx'), deckBytes),
      fs.writeFile(path.join(OUTPUT_DIR, 'cold-reopen.xlsx'), workbookBytes),
    ]);

    const evidence: Record<string, unknown> = {
      runId,
      reopenedAt: new Date().toISOString(),
      artifacts: {
        document: { artifactId: manifest.artifactIds.document, sha256: sha256(docBytes) },
        presentation: { artifactId: manifest.artifactIds.presentation, sha256: sha256(deckBytes) },
        workbook: { artifactId: manifest.artifactIds.workbook, sha256: sha256(workbookBytes) },
      },
      semanticChecks: {
        document: ['title', 'source-order', 'case-id', 'DEFER'],
        presentation: ['DEFER', 'UNKNOWN'],
        workbook: ['Info-first', 'case-id', 'UNKNOWN', 'source-order'],
      },
    };
    if (BASELINE_DIR) {
      const baselinePath = (format: 'docx' | 'pptx' | 'xlsx') =>
        path.join(BASELINE_DIR, `strict-case.${format}`);
      const baseline = {
        document: await fs.readFile(baselinePath('docx')),
        presentation: await fs.readFile(baselinePath('pptx')),
        workbook: await fs.readFile(baselinePath('xlsx')),
      };
      (evidence as any).baselineHashes = {
        document: sha256(baseline.document),
        presentation: sha256(baseline.presentation),
        workbook: sha256(baseline.workbook),
      };
      (evidence as any).byteIdentical = {
        document: baseline.document.equals(docBytes),
        presentation: baseline.presentation.equals(deckBytes),
        workbook: baseline.workbook.equals(workbookBytes),
      };
    }
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'cold-reopen-evidence.json'),
      JSON.stringify(evidence, null, 2)
    );
  });
});

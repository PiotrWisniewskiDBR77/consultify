import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

import {
  authHeaders,
  DOC_STUDIO_BASE,
  seedDocumentArtifact,
  setupDocumentStudioSession,
} from './_document-studio-helpers';

type ExportPayload = {
  format: 'docx' | 'pdf';
  filename: string;
  contentBase64: string;
  manifest?: Record<string, unknown>;
};

function decodeBase64(payload: string): Buffer {
  return Buffer.from(payload, 'base64');
}

test.describe('Artifact Studio V2 — Document realDB export', () => {
  test('reopens a persisted document and exports inspectable draft DOCX and PDF', async ({
    page,
  }) => {
    const token = await setupDocumentStudioSession(page);
    const title = `Artifact Studio realDB export ${Date.now()}`;
    const { artifactId } = await seedDocumentArtifact(page.request, token, {
      title,
      description:
        'Create a governed investment decision document with an executive recommendation, evidence, risks and an implementation plan.',
      documentType: 'business_case',
      language: 'en',
    });

    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );

    const shell = page.getByTestId('document-studio-mels-shell');
    await expect(shell).toBeVisible({ timeout: 30_000 });
    await expect(shell).toHaveAttribute('data-artifact-studio', 'true');
    await expect(shell.getByText(title, { exact: true })).toBeVisible();

    // A cold navigation must hydrate the same persisted artifact, not fall
    // back to intake or silently create a replacement document.
    await page.goto('/materials?tab=documents', { waitUntil: 'domcontentloaded' });
    await page.goto(
      `/document-studio/${encodeURIComponent(artifactId)}?ff_artifactStudio=1&ff_documentStudioV2=1`,
      { waitUntil: 'domcontentloaded', timeout: 60_000 }
    );
    await expect(page.getByTestId('document-studio-mels-shell')).toHaveAttribute(
      'data-artifact-studio',
      'true'
    );
    await expect(page.getByText(title, { exact: true })).toBeVisible();

    const docxResponse = await page.request.get(
      `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/export/docx?mode=draft`,
      { headers: authHeaders(token), timeout: 60_000 }
    );
    if (docxResponse.status() === 403) {
      const entitlement = (await docxResponse.json()) as { error?: string; code?: string };
      if (entitlement.error === 'TRIAL_EXPORT_DISABLED') {
        test.info().annotations.push({
          type: 'EVIDENCE_MISSING',
          description:
            'The staging organization is trial-gated. Re-run with an export-entitled organization to inspect DOCX/PDF bytes.',
        });
        expect(entitlement.code).toBe('TRIAL_EXPORT_DISABLED');
        return;
      }
    }
    expect(docxResponse.ok(), await docxResponse.text()).toBe(true);
    expect(docxResponse.headers()['x-artifact-export-mode']).toBe('draft');
    expect(docxResponse.headers()['x-artifact-draft']).toBe('true');
    const docxPayload = (await docxResponse.json()) as ExportPayload;
    expect(docxPayload.format).toBe('docx');
    expect(docxPayload.filename.toLowerCase()).toContain('.docx');
    expect(docxPayload.contentBase64.length).toBeGreaterThan(1_000);

    const docx = decodeBase64(docxPayload.contentBase64);
    expect(docx.subarray(0, 2).toString('ascii')).toBe('PK');
    const zip = await JSZip.loadAsync(docx);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeTruthy();
    expect(documentXml).toContain(title);
    expect(zip.file('[Content_Types].xml')).not.toBeNull();
    expect(Number(docxPayload.manifest?.byteLength ?? 0)).toBe(docx.byteLength);

    const pdfResponse = await page.request.get(
      `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/export/pdf?mode=draft`,
      { headers: authHeaders(token), timeout: 60_000 }
    );
    expect(pdfResponse.ok(), await pdfResponse.text()).toBe(true);
    expect(pdfResponse.headers()['x-artifact-export-mode']).toBe('draft');
    expect(pdfResponse.headers()['x-artifact-draft']).toBe('true');
    const pdfPayload = (await pdfResponse.json()) as ExportPayload;
    expect(pdfPayload.format).toBe('pdf');
    expect(pdfPayload.filename.toLowerCase()).toContain('.pdf');
    const pdf = decodeBase64(pdfPayload.contentBase64);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(1_000);
    expect(Number(pdfPayload.manifest?.byteLength ?? 0)).toBe(pdf.byteLength);
  });
});

/**
 * Document Studio — generate -> export happy path (Module 10 hardening).
 *
 * Exercises the full pipeline end-to-end through the real service:
 *   1. `materializeDocumentArtifact` plans an outline from intake, builds
 *      the schema, and persists a wave5 artifact (deterministic Mode 1).
 *   2. `getDocumentArtifact` reads the persisted schema back.
 *   3. `exportDocumentArtifact` renders a real PDF and DOCX from that
 *      schema and marks the artifact exported.
 *
 * The wave5 runtime is mocked with a STATEFUL in-memory store so the
 * artifact created in step 1 is the one read + exported in steps 2-3 —
 * i.e. this validates the real create -> read -> render handoff, not a
 * fixed fixture.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import * as mammoth from 'mammoth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredArtifact {
  artifact_id: string;
  organization_id: string;
  title: string;
  content: string;
  content_json: unknown;
  metadata_json: unknown;
  status?: string;
}

const store = new Map<string, StoredArtifact>();
let seq = 0;
const generateChatResponseMock = vi.fn();

vi.mock('../../aiService.js', () => ({
  generateChatResponse: (...args: unknown[]) => generateChatResponseMock(...args),
}));

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(
    async (params: {
      organizationId: string;
      title: string;
      content: string;
      contentJson: unknown;
      metadata: unknown;
    }) => {
      seq += 1;
      const artifactId = `art-happy-${seq}`;
      const row: StoredArtifact = {
        artifact_id: artifactId,
        organization_id: params.organizationId,
        title: params.title,
        content: params.content,
        content_json: params.contentJson,
        metadata_json: params.metadata,
        status: 'draft',
      };
      store.set(`${params.organizationId}::${artifactId}`, row);
      return { artifactId, artifact_id: artifactId };
    }
  ),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    return store.get(`${organizationId}::${artifactId}`) ?? null;
  }),
  buildWave5ExportManifest: vi.fn(async (artifactId: string) => ({
    artifactId,
    formats: ['markdown', 'pdf_print', 'docx'],
  })),
  markWave5ArtifactExported: vi.fn(async (artifactId: string, organizationId: string) => {
    const row = store.get(`${organizationId}::${artifactId}`);
    if (row) row.status = 'exported';
    return { artifact_id: artifactId, status: 'exported' };
  }),
}));

import { markWave5ArtifactExported } from '../../wave5ArtifactRuntimeService.js';
import { runDocumentQa } from '../documentQaService.js';
import {
  exportDocumentArtifact,
  getDocumentArtifact,
  materializeDocumentArtifact,
} from '../documentStudioService.js';

const markExported = vi.mocked(markWave5ArtifactExported);

describe('Document Studio generate -> export happy path', () => {
  beforeEach(() => {
    store.clear();
    seq = 0;
    markExported.mockClear();
    generateChatResponseMock.mockReset();
  });

  it('materializes a deterministic artifact and exports it to PDF + DOCX', async () => {
    const run = await materializeDocumentArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      intake: {
        description:
          'Recommend whether to consolidate the three regional data centers into one cloud region.',
        language: 'en',
        goal: 'decide',
        audience: ['Board'],
      },
      // useLlm omitted -> deterministic content path (no LLM dependency).
    });

    expect(run.artifactId).toBeTruthy();
    expect(run.schema.sections.length).toBeGreaterThan(0);
    expect(run.schema.documentStatus).toBe('draft');

    // Read-back through the real service path. The artifact is resolved by
    // the canonical wave5 id; the schema body is the one persisted at
    // materialization time.
    const schema = await getDocumentArtifact(run.artifactId, 'org-1');
    expect(schema).not.toBeNull();
    expect(schema?.title).toBe(run.schema.title);
    expect(schema?.documentType).toBe(run.schema.documentType);

    // Export to PDF — real %PDF- stream.
    const pdf = await exportDocumentArtifact(run.artifactId, 'org-1', 'pdf');
    expect(pdf.format).toBe('pdf');
    const pdfBuffer = Buffer.from(String(pdf.contentBase64), 'base64');
    expect(pdfBuffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.manifest.renderedFromSchema).toBe(true);

    // Export to DOCX — real ZIP container.
    const docx = await exportDocumentArtifact(run.artifactId, 'org-1', 'docx');
    expect(docx.format).toBe('docx');
    const docxBuffer = Buffer.from(String(docx.contentBase64), 'base64');
    expect(docxBuffer[0]).toBe(0x50); // P
    expect(docxBuffer[1]).toBe(0x4b); // K
    expect(docxBuffer.includes(Buffer.from('[Content_Types].xml'))).toBe(true);

    // Both binary exports marked the artifact exported.
    expect(markExported).toHaveBeenCalledTimes(2);
    expect(store.get(`org-1::${run.artifactId}`)?.status).toBe('exported');
  });

  it('isolates tenants — a cross-tenant read returns null', async () => {
    const run = await materializeDocumentArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      intake: { description: 'Tenant isolation check.', language: 'en', goal: 'inform' },
    });
    const crossTenant = await getDocumentArtifact(run.artifactId, 'org-2');
    expect(crossTenant).toBeNull();
  });

  it('DELTA: final persisted schema removes post-premium unsupported claims and recomputes assumptions', async () => {
    generateChatResponseMock.mockImplementation(async (request: any) => {
      const prompt = String(request?.messages?.[0]?.content ?? '');
      const targets = [
        ...prompt.matchAll(/"blockId":\s*"([^"]+)"[\s\S]*?"kind":\s*"([^"]+)"/g),
      ].map((match) => ({ blockId: match[1], kind: match[2] }));
      return {
        content: JSON.stringify({
          blocks: targets.map(({ blockId, kind }, index) =>
            kind === 'items'
              ? { blockId, items: ['DACH', '8 inicjatyw', 'Horyzont 6-9 miesięcy'] }
              : {
                  blockId,
                  text:
                    index === 0
                      ? '{ "columns": [], "rows": [] }'
                      : 'DACH: 8 inicjatyw w horyzoncie 6-9 miesięcy; wynik 85%.',
                }
          ),
        }),
      };
    });

    const run = await materializeDocumentArtifact({
      organizationId: 'org-delta',
      userId: 'user-delta',
      intake: {
        title: 'Raport DELTA',
        description:
          'Polski raport zarządu DELTA. Potwierdzone fakty: 72% realizacji planu, budżet programu 1,4 mln EUR oraz ukończono 18 z 21 kamieni milowych.',
        documentType: 'board_report',
        language: 'pl',
        goal: 'inform',
        audience: ['Zarząd'],
      },
      outline: {
        documentType: 'board_report',
        title: 'Raport DELTA',
        recommendedDensity: 'concise',
        recommendedRegister: 'executive',
        recommendedLanguageStyle: 'consulting',
        sections: [
          {
            title: 'Podsumowanie',
            level: 1,
            purpose: 'Podsumowanie dla zarządu',
            expectedLengthHint: 'short',
          },
          {
            title: 'Decisions Required',
            level: 1,
            purpose: 'Decyzje zarządu',
            expectedLengthHint: 'short',
          },
          {
            title: 'Risks',
            level: 1,
            purpose: 'Ryzyka i działania ograniczające',
            expectedLengthHint: 'short',
          },
        ],
      },
      useLlm: true,
    });

    const persisted = store.get(`org-delta::${run.artifactId}`)?.content_json as
      import('../documentStudioTypes.js').DocumentSchema | undefined;
    expect(persisted).toBeDefined();
    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toMatch(/DACH|8 inicjatyw|horyzoncie 6-9|85%/);
    expect(serialized).not.toContain('{ \\"columns\\": [], \\"rows\\": [] }');
    expect(persisted!.sections).toHaveLength(7);
    expect(serialized).toContain('Realizacja planu wynosi 72%');
    expect(serialized).toContain('18/21');
    const assumptions = persisted!.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.isAssumption === true);
    expect(assumptions.length).toBeGreaterThan(0);
    const reopened = await getDocumentArtifact(run.artifactId, 'org-delta');
    expect(reopened?.sections).toEqual(run.schema.sections);
    const reopenedAssumptions = reopened!.sections
      .flatMap((section) => section.blocks)
      .filter((block) => block.isAssumption === true);
    expect(reopenedAssumptions).toHaveLength(assumptions.length);
    expect(reopened?.evidence?.assumptions).toEqual(run.schema.evidence?.assumptions);
    expect(persisted!.evidence?.risks.join(' ')).toMatch(/bloków oznaczonych jako założenie/);
    expect(persisted!.evidence?.assumptions.length).toBeGreaterThan(0);
    expect(persisted!.evidence?.confidence).not.toBe('high');
    const risk = persisted!.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.type === 'risk_table');
    expect((risk?.content as any)?.columns).toEqual([
      'Ryzyko',
      'Prawdopodobieństwo',
      'Wpływ',
      'Właściciel',
      'Mitygacja',
    ]);
  });

  it('OMEGA: persisted Polish artifact localizes canonical headings and blocks Language QA mismatch', async () => {
    generateChatResponseMock.mockImplementation(async (request: any) => {
      const prompt = String(request?.messages?.[0]?.content ?? '');
      const targets = [
        ...prompt.matchAll(/"blockId":\s*"([^"]+)"[\s\S]*?"kind":\s*"([^"]+)"/g),
      ].map((match) => ({ blockId: match[1], kind: match[2] }));
      return {
        content: JSON.stringify({
          blocks: targets.map(({ blockId, kind }) =>
            kind === 'items'
              ? { blockId, items: ['Financial Constraints', 'Optimized resource allocation'] }
              : { blockId, text: 'Financial Constraints and Optimized resource allocation.' }
          ),
        }),
      };
    });

    const canonicalTitles = [
      'Executive Summary',
      'Decisions Required',
      'For Information',
      'Portfolio Status',
      'Financial Snapshot',
      'Risks',
      'Next Steps',
    ];
    const run = await materializeDocumentArtifact({
      organizationId: 'org-omega',
      userId: 'user-omega',
      intake: {
        title: 'Raport OMEGA',
        description:
          'Polski raport zarządu OMEGA. Potwierdzone fakty: 72% realizacji planu, budżet programu 1,4 mln EUR oraz ukończono 18 z 21 kamieni milowych.',
        documentType: 'board_report',
        language: 'pl',
        goal: 'inform',
        audience: ['Zarząd'],
      },
      outline: {
        documentType: 'board_report',
        title: 'Raport OMEGA',
        recommendedDensity: 'concise',
        recommendedRegister: 'executive',
        recommendedLanguageStyle: 'consulting',
        sections: canonicalTitles.map((title) => ({
          title,
          level: 1 as const,
          purpose: title,
          expectedLengthHint: 'short' as const,
        })),
      },
      useLlm: true,
    });

    const persisted = store.get(`org-omega::${run.artifactId}`)?.content_json as
      import('../documentStudioTypes.js').DocumentSchema | undefined;
    expect(persisted).toBeDefined();
    const serialized = JSON.stringify(persisted);
    for (const english of canonicalTitles) expect(serialized).not.toContain(english);
    expect(serialized).not.toContain('Financial Constraints');
    expect(serialized).not.toContain('Optimized resource allocation');
    expect(persisted!.sections.map((section) => section.title)).toEqual([
      'Podsumowanie zarządcze',
      'Wymagane decyzje',
      'Do wiadomości',
      'Status portfela',
      'Podsumowanie finansowe',
      'Ryzyka',
      'Następne kroki',
    ]);
    for (const section of persisted!.sections) {
      for (const heading of section.blocks.filter((block) => block.type === 'heading')) {
        expect((heading.content as any).text).toBe(section.title);
      }
    }
    const languageQa = runDocumentQa(persisted!).categories.find(
      (category) => category.category === 'language'
    );
    expect(languageQa?.findings.filter((finding) => finding.code === 'language_mismatch')).toEqual(
      []
    );
    expect(languageQa?.blocking).toBe(false);
  });

  it('SIGMA-2: materializes a useful grounded board report with assumptions and clean QA', async () => {
    generateChatResponseMock.mockImplementation(async (request: any) => {
      const prompt = String(request?.messages?.[0]?.content ?? '');
      const targets = [
        ...prompt.matchAll(/"blockId":\s*"([^"]+)"[\s\S]*?"kind":\s*"([^"]+)"/g),
      ].map((match) => ({ blockId: match[1], kind: match[2] }));
      return {
        content: JSON.stringify({
          blocks: targets.map(({ blockId, kind }) =>
            kind === 'items'
              ? { blockId, items: ['DACH', '8 inicjatyw', 'Miesięczne monitorowanie'] }
              : {
                  blockId,
                  text: 'Budżet wykorzystany. Realizacja budżetu 72%. Finalizacja inicjatyw w DACH.',
                }
          ),
        }),
      };
    });
    const titles = [
      'Executive Summary',
      'Decisions Required',
      'For Information',
      'Portfolio Status',
      'Financial Snapshot',
      'Risks',
      'Next Steps',
    ];
    const run = await materializeDocumentArtifact({
      organizationId: 'org-sigma-2',
      userId: 'user-sigma-2',
      intake: {
        title: 'Raport SIGMA-2',
        description:
          'Polski raport zarządu. Potwierdzone fakty: 72% realizacji planu, budżet programu 1,4 mln EUR oraz ukończono 18 z 21 kamieni milowych.',
        documentType: 'board_report',
        language: 'pl',
        goal: 'decide',
        audience: ['Zarząd'],
      },
      outline: {
        documentType: 'board_report',
        title: 'Raport SIGMA-2',
        recommendedDensity: 'standard',
        recommendedRegister: 'executive',
        recommendedLanguageStyle: 'consulting',
        sections: titles.map((title) => ({
          title,
          level: 1 as const,
          purpose: title,
          expectedLengthHint: 'medium' as const,
        })),
      },
      sourceRefs: [
        { sourceType: 'intake', sourceId: 'sigma-2-brief', sourceTitle: 'Jawny brief SIGMA-2' },
      ],
      useLlm: true,
    });
    const persisted = store.get(`org-sigma-2::${run.artifactId}`)?.content_json as
      import('../documentStudioTypes.js').DocumentSchema | undefined;
    expect(persisted).toBeDefined();
    const text = JSON.stringify(persisted);
    expect(text).toContain('Realizacja planu wynosi 72%');
    expect(text).toContain('1,4 mln EUR');
    expect(text).toContain('18/21');
    expect(text).not.toMatch(/DACH|8 inicjatyw|Realizacja budżetu 72%|Budżet wykorzystany/);
    expect(
      persisted!.sections.flatMap((section) => section.blocks).filter((block) => block.isAssumption)
        .length
    ).toBeGreaterThan(0);
    const qa = runDocumentQa(persisted!);
    expect(
      qa.categories.filter((category) => category.blocking).map((category) => category.category)
    ).toEqual([]);
    expect(qa.anyBlocking).toBe(false);

    // Release proof for the same seven-section canonical schema used by the
    // SIGMA runtime acceptance artifact. This deliberately exercises the
    // public service boundary (base64 payload), writes the bytes back to a
    // .docx, and reopens them with an independent Word parser. ZIP magic
    // alone is not sufficient evidence that the exported document is usable.
    const exported = await exportDocumentArtifact(run.artifactId, 'org-sigma-2', 'docx');
    const docxBuffer = Buffer.from(String(exported.contentBase64), 'base64');
    const reopenedDocx = await mammoth.extractRawText({ buffer: docxBuffer });
    const reopenedText = reopenedDocx.value.replace(/\s+/g, ' ').trim();
    expect(exported.filename).toMatch(/\.docx$/);
    expect(docxBuffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(reopenedDocx.messages.filter((message) => message.type === 'error')).toEqual([]);
    for (const title of [
      'Podsumowanie zarządcze',
      'Wymagane decyzje',
      'Do wiadomości',
      'Status portfela',
      'Podsumowanie finansowe',
      'Ryzyka',
      'Następne kroki',
    ]) {
      expect(reopenedText).toContain(title);
    }
    expect(reopenedText).toContain('72%');
    expect(reopenedText).toContain('1,4 mln EUR');
    expect(reopenedText).toContain('18/21');
    expect(reopenedText).not.toMatch(
      /DACH|8 inicjatyw|Realizacja budżetu 72%|Budżet wykorzystany|\[PLACEHOLDER\]|Lorem ipsum|TODO|TBD/i
    );

    // Opt-in visual QA is kept in this regression instead of a one-off shell
    // script. Release runners set DOCX_VISUAL_QA=1; LibreOffice reopens the
    // generated Word file, renders it to PDF, Poppler inspects every page's
    // text, and the first page is rasterized to prove the render is non-empty.
    if (process.env.DOCX_VISUAL_QA === '1') {
      const qaDir = mkdtempSync(join(tmpdir(), 'consultify-sigma-docx-qa-'));
      try {
        const docxPath = join(qaDir, exported.filename);
        writeFileSync(docxPath, docxBuffer);
        execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', qaDir, docxPath]);
        const pdfPath = join(qaDir, `${basename(exported.filename, '.docx')}.pdf`);
        const renderedText = execFileSync('pdftotext', [pdfPath, '-'], {
          encoding: 'utf8',
        }).replace(/\s+/g, ' ');
        const pdfInfo = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
        execFileSync('pdftoppm', [
          '-f',
          '1',
          '-singlefile',
          '-png',
          '-r',
          '96',
          pdfPath,
          join(qaDir, 'page-1'),
        ]);
        expect(pdfInfo).toMatch(/^Pages:\s+[1-9]\d*$/m);
        expect(readFileSync(pdfPath).subarray(0, 5).toString('ascii')).toBe('%PDF-');
        expect(statSync(join(qaDir, 'page-1.png')).size).toBeGreaterThan(1_000);
        expect(renderedText).toContain('Podsumowanie zarządcze');
        expect(renderedText).toContain('Następne kroki');
        expect(renderedText).toContain('72%');
        expect(renderedText).toContain('1,4 mln EUR');
        expect(renderedText).toContain('18/21');
        expect(renderedText).not.toMatch(
          /DACH|8 inicjatyw|Realizacja budżetu 72%|Budżet wykorzystany|\[PLACEHOLDER\]|Lorem ipsum|TODO|TBD/i
        );
      } finally {
        rmSync(qaDir, { recursive: true, force: true });
      }
    }
  });
});

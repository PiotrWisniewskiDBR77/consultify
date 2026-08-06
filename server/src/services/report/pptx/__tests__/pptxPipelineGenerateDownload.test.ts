/**
 * Generate -> PPTX download happy path (Module 12 audit gap #7).
 *
 * The presentation generate/download pipeline is:
 *   unified JSON -> PptxPipelineService.generateFromUnifiedJson() -> .pptx buffer
 *   -> written to exports/presentations/<deckId>.pptx -> served by
 *      GET /decks/:id/download via res.sendFile(export_path).
 *
 * This integration test exercises the load-bearing core of that pipeline: it
 * generates a real deck from unified JSON, then verifies that:
 *   - a non-empty Buffer is produced
 *   - the buffer is a valid OOXML .pptx (ZIP "PK" signature + [Content_Types].xml)
 *   - the reported slide count covers the input slides (+ closing slide)
 *   - the buffer round-trips to disk and back (what the download route serves)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CurrentPptxExportError,
  ensureCurrentPptxExport,
} from '../../../../routes/presentations.routes.js';
import { deckDocumentFromUnifiedJson } from '../../../presentationDeckDocumentService.js';
import { PptxPipelineService } from '../PptxPipelineService.js';
import type { UnifiedReportJSON } from '../types.js';

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"

function buildUnifiedReport(): UnifiedReportJSON {
  return {
    meta: {
      client: 'Acme Corp',
      project: 'Q3 Strategy Review',
      date: '2026-06-02',
      author: 'Consultify',
      confidentiality: 'internal',
      language: 'en',
      template: 'corporate',
    },
    slides: [
      {
        intent: 'cover',
        key_message: 'Q3 strategy review',
        content: {
          type: 'cover',
          title: 'Q3 Strategy Review',
          subtitle: 'Outcomes and Q4 priorities',
          organization: 'Acme Corp',
          date: '2026-06-02',
          confidentiality: 'internal',
        },
      },
      {
        intent: 'executive_summary',
        key_message: 'Strong quarter, clear priorities ahead',
        content: {
          type: 'executive_summary',
          headline: 'Strong quarter, clear priorities ahead',
          key_findings: [
            'Revenue grew 18% QoQ on enterprise expansion.',
            'Net revenue retention held at 124%.',
            'EMEA pipeline doubled after the new go-to-market motion.',
          ],
          recommendation: 'Double down on enterprise and ship Studio v2 in Q4.',
        },
      },
    ],
  };
}

describe('Generate -> PPTX download happy path', () => {
  const tmpFiles: string[] = [];

  afterEach(() => {
    for (const f of tmpFiles.splice(0)) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* ignore cleanup errors */
      }
    }
  });

  it('generates a valid .pptx buffer from unified JSON', async () => {
    const service = new PptxPipelineService();
    const result = await service.generateFromUnifiedJson(buildUnifiedReport());

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(1000);
    // .pptx is a ZIP/OOXML container — must start with the ZIP local-file header.
    expect(result.buffer.subarray(0, 4).equals(ZIP_SIGNATURE)).toBe(true);
    // Every OOXML package carries a [Content_Types].xml part.
    expect(result.buffer.includes(Buffer.from('[Content_Types].xml'))).toBe(true);

    // 2 input slides + the pipeline's closing slide.
    expect(result.slideCount).toBeGreaterThanOrEqual(3);
  });

  it('round-trips through disk exactly as the download route serves it', async () => {
    const service = new PptxPipelineService();
    const result = await service.generateFromUnifiedJson(buildUnifiedReport());

    const deckId = `test-deck-${Date.now()}`;
    const exportPath = path.join(os.tmpdir(), `${deckId}.pptx`);
    tmpFiles.push(exportPath);

    // Mirror presentationGeneratorService: write buffer to export_path.
    fs.writeFileSync(exportPath, result.buffer);

    expect(fs.existsSync(exportPath)).toBe(true);
    const onDisk = fs.readFileSync(exportPath);
    expect(onDisk.length).toBe(result.buffer.length);
    // The served file is still a valid .pptx package.
    expect(onDisk.subarray(0, 4).equals(ZIP_SIGNATURE)).toBe(true);
  });

  it('fails closed and preserves the old file when a stale deck cannot be regenerated', async () => {
    const report = buildUnifiedReport();
    const deckDocument = deckDocumentFromUnifiedJson({
      deckId: 'stale-deck',
      organizationId: 'org-1',
      title: 'Stale deck',
      unifiedJson: report,
    });
    const exportPath = path.join(os.tmpdir(), `stale-deck-${Date.now()}.pptx`);
    tmpFiles.push(exportPath);
    const oldBytes = Buffer.from('old-pptx-bytes');
    fs.writeFileSync(exportPath, oldBytes);
    const oldTime = new Date(Date.now() - 60_000);
    fs.utimesSync(exportPath, oldTime, oldTime);

    const generate = vi.fn(async () => {
      throw new Error('renderer unavailable');
    });
    const persist = vi.fn(async () => undefined);

    await expect(
      ensureCurrentPptxExport(
        {
          id: 'stale-deck',
          organization_id: 'org-1',
          export_path: exportPath,
          updated_at: new Date().toISOString(),
          deck_json: JSON.stringify(deckDocument),
          unified_json: JSON.stringify(report),
        },
        { generate, persist }
      )
    ).rejects.toBeInstanceOf(CurrentPptxExportError);

    expect(generate).toHaveBeenCalledOnce();
    expect(persist).not.toHaveBeenCalled();
    expect(fs.readFileSync(exportPath)).toEqual(oldBytes);
  });

  it('materializes and persists a current PPTX when export_path is missing', async () => {
    const report = buildUnifiedReport();
    const deckId = `missing-export-${Date.now()}`;
    const deckDocument = deckDocumentFromUnifiedJson({
      deckId,
      organizationId: 'org-1',
      title: 'Missing export',
      unifiedJson: report,
    });
    const generatedBytes = Buffer.from('fresh-pptx-bytes');
    const generate = vi.fn(async () => ({
      buffer: generatedBytes,
      slideCount: deckDocument.cards.length,
      warnings: [],
    }));
    const persist = vi.fn(async () => undefined);

    const result = await ensureCurrentPptxExport(
      {
        id: deckId,
        organization_id: 'org-1',
        export_path: null,
        updated_at: new Date().toISOString(),
        deck_json: JSON.stringify(deckDocument),
        unified_json: JSON.stringify(report),
      },
      { generate, persist }
    );
    tmpFiles.push(result.export_path);

    expect(generate).toHaveBeenCalledOnce();
    expect(fs.readFileSync(result.export_path)).toEqual(generatedBytes);
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId,
        organizationId: 'org-1',
        exportPath: result.export_path,
        slideCount: deckDocument.cards.length,
      })
    );
  });
});

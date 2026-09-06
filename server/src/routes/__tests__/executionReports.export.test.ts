/**
 * @vitest-environment node
 */
/**
 * 1.12-R4 — eksport migawki raportu Realizacji.
 *
 * Broni trzech rzeczy, z których każda zawiodła na pierwszym przebiegu 06.09:
 *  1. DOCX jest REALNYM plikiem (zip OOXML), nie pustką i nie HTML-em w .doc;
 *  2. nagłówek dokumentu jest PO POLSKU (mutacja: angielska etykieta → RED);
 *  3. encje HTML z sanitizera wejścia są odkodowane przed renderem
 *     („Compliance &amp; GDPR Audit" nie ma prawa trafić do pliku).
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { unifiedExportService } from '../../services/export/UnifiedExportService.js';
import { decodeSnapshotEntities, snapshotToMarkdown } from '../executionReports.routes.js';

const snapshot = {
  definitionKey: 'weekly-exec',
  title: 'Tygodniowy pakiet realizacji · 06.09.2026',
  subtitle: 'Zamrożona migawka danych realizacji',
  rag: 'RED' as const,
  ragReason: '10 blokad, 20 sygnałów krytycznych.',
  period: { start: '2026-08-31T00:00:00.000Z', end: '2026-09-07T00:00:00.000Z' },
  asOf: '2026-09-06T12:00:00.000Z',
  metrics: [
    { id: 'overdue', label: 'Zadania po terminie', value: '20', tone: 'CRIT' as const },
  ],
  sections: [
    {
      id: 'progress',
      title: 'Podsumowanie postępu',
      narrative: 'Domknięte zadania: 6. Otwarte po terminie: 20.',
    },
    {
      id: 'milestones',
      title: 'Najbliższe kamienie',
      table: {
        columns: [
          { id: 'title', label: 'Inicjatywa' },
          { id: 'planned', label: 'Koniec wg planu' },
        ],
        rows: [{ title: 'Compliance &amp; GDPR Audit', planned: '20.09.2026' }],
      },
    },
    { id: 'empty', title: 'Blokady', empty: 'Brak danych w tym okresie.' },
  ],
};

async function docxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

describe('1.12-R4 — eksport raportu Realizacji przez UnifiedExportService', () => {
  it('DOCX jest realnym plikiem OOXML i nie jest pusty', async () => {
    const buffer = await unifiedExportService.exportDocx({
      title: snapshot.title,
      markdown: snapshotToMarkdown(decodeSnapshotEntities(snapshot) as any, 'PMO', 'Szkic'),
    });
    expect(buffer.length).toBeGreaterThan(4000);
    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK'); // sygnatura zip
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('word/document.xml')).toBeTruthy();
  });

  it('nagłówek dokumentu jest po polsku i niesie stan na, okres i RAG', async () => {
    const buffer = await unifiedExportService.exportDocx({
      title: snapshot.title,
      markdown: snapshotToMarkdown(decodeSnapshotEntities(snapshot) as any, 'PMO', 'Szkic'),
    });
    const content = await docxText(buffer);
    expect(content).toContain('Tygodniowy pakiet realizacji');
    expect(content).toContain('Status: Szkic');
    expect(content).toContain('Poziom raportu: PMO');
    expect(content).toContain('Okres: 31.08.2026 – 07.09.2026');
    expect(content).toContain('Stan danych na: 06.09.2026');
    expect(content).toContain('Ocena RAG: Czerwony');
    // MUTACJA: podmiana którejkolwiek etykiety na angielską („Period:", „Status:"
    // z UnifiedExportService `lifecycle`/`updatedAt`) wywraca te asercje.
    expect(content).not.toContain('Lifecycle:');
    expect(content).not.toContain('Updated:');
  });

  it('encje HTML z sanitizera wejścia są odkodowane przed renderem', async () => {
    const buffer = await unifiedExportService.exportDocx({
      title: snapshot.title,
      markdown: snapshotToMarkdown(decodeSnapshotEntities(snapshot) as any, 'PMO', 'Szkic'),
    });
    const content = await docxText(buffer);
    expect(content).toContain('Compliance & GDPR Audit');
  });

  it('sekcja bez treści drukuje etykietę braku danych, a nie pusty nagłówek', () => {
    const markdown = snapshotToMarkdown(snapshot as any, 'PMO', 'Szkic');
    expect(markdown).toContain('## Blokady');
    expect(markdown).toContain('Brak danych w tym okresie.');
  });

  it('PDF ma poprawną sygnaturę i realną objętość', async () => {
    const buffer = await unifiedExportService.exportPdf({
      title: snapshot.title,
      markdown: snapshotToMarkdown(decodeSnapshotEntities(snapshot) as any, 'STEERCO', 'Opublikowany'),
    });
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(10000);
  });
});

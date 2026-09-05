/**
 * FALA 4 (mvp/naprawy-noc-4) — regresja rodziny "ZAKTUALIZOWANO"/"Aktualizacja"
 * uciętej na 1440px (ten sam defekt co AuditLibraryTab.tsx, naprawiony w
 * mvp/naprawy-noc-3, commit 0b2e18bb7f — patrz
 * tests/components/Audit/AuditLibraryTab.updatedAtColumnWidth.test.ts).
 *
 * Naprawa NAPRAWA PO JEDNEJ POWIERZCHNI ODRASTA (CLAUDE.md, złote reguły):
 * fala 3 naprawiła WYŁĄCZNIE AuditLibraryTab.tsx i we własnym commit message
 * wprost zgłosiła AssessmentHub/FinanceHub/DiscoveryToolsHub jako to samo
 * rodzeństwo, poza zakresem tamtego zlecenia. Ten test pilnuje CAŁEJ rodziny
 * znalezionej `grep`em po `id: 'updatedAt'` (+ jednego bliźniaka,
 * `publishedAt` w AuditReportsTab.tsx, ujawnionego live screenshotem podczas
 * odbioru tej fali) w 13 plikach:
 *  - src/components/Discovery/DiscoveryToolsHub.tsx (4x)
 *  - src/components/assessment/AssessmentHub.tsx (1x, `updatedCol`,
 *    reużywany w zakładkach "list" i "reports")
 *  - src/components/Economics/FinanceHub.tsx (1x, `baseUpdatedCol`)
 *  - src/components/ResultsVNext/roi/roiCaseFullToolPresenters.tsx (2x)
 *  - src/components/ResultsVNext/roi/roiCaseDetailPresenters.tsx (4x)
 *  - src/components/ResultsVNext/roi/roiRegistryPresenters.tsx (1x)
 *  - src/components/ResultsVNext/okr/okrObjectivePresenters.tsx (1x)
 *  - src/components/ResultsVNext/okr/okrKeyResultPresenters.tsx (1x)
 *  - src/components/ResultsVNext/okr/okrRegistryPresenters.tsx (1x)
 *  - src/components/Audit/method/tabs/AuditReportsTab.tsx (2x: updatedAt +
 *    publishedAt)
 *  - src/components/Audit/method/tabs/AuditProcessesTab.tsx (1x)
 *  - src/components/Audit/method/tabs/AuditInitiativesTab.tsx (1x)
 *  - src/components/assessment/manage/ReportsManagementPanel.tsx (1x)
 *
 * Weryfikacja NA ŻYWO (nie tylko w kodzie): zrzuty 1440px zalogowaną sesją na
 * lokalnym stanowisku NOC (127.0.0.1:4100 + własny vite :3096) —
 * evidence/mvp-naprawy-noc-4/*-po.png(.json) — potwierdzają brak ucięcia dla
 * /discovery-tools?tab=sessions, /assessment?tab=list|reports,
 * /audit-programs?tab=library|reports|processes|initiatives. FilterableTable
 * mierzy nagłówki przez canvas, którego jsdom nie uruchomi (patrz komentarz w
 * AuditLibraryTab.updatedAtColumnWidth.test.ts) — to jest strażnik
 * źródłowy: pilnuje, żeby ktoś PO CICHU nie cofnął `width`/`dataType`.
 *
 * Mutacja: cofnięcie któregokolwiek `width` poniżej progu albo usunięcie
 * `dataType: 'date'` z bloku kolumny wywala odpowiedni test.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

/**
 * Zwraca bloki `id: '<columnId>', ...` (okno znaków po dopasowaniu) które SĄ
 * definicjami kolumny `TableColumn` (mają `width:` w oknie) — pomija
 * bliźniacze `id: '<columnId>'` w wierszach podglądu/property-list
 * (`{ id: 'updatedAt', label: ..., value: ... }`), które nie mają `width` i
 * nie podlegają algorytmowi dopasowania FilterableTable.
 */
function columnBlocks(source: string, columnId: string, windowSize = 260): string[] {
  const marker = `id: '${columnId}',`;
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start === -1) break;
    const block = source.slice(start, start + windowSize);
    if (/width:\s*'\d+px'/.test(block)) blocks.push(block);
    from = start + marker.length;
  }
  return blocks;
}

function expectWidthAtLeast(block: string, minWidth: number, context: string): void {
  const match = block.match(/width:\s*'(\d+)px'/);
  expect(match, `no width found in ${context}: ${block}`).not.toBeNull();
  const width = Number(match![1]);
  expect(width, `${context}: width ${width}px < ${minWidth}px`).toBeGreaterThanOrEqual(minWidth);
}

function expectDataTypeDate(block: string, context: string): void {
  expect(block, `${context}: missing dataType: 'date'`).toMatch(/dataType:\s*'date'/);
}

type Case = { file: string; columnId: string; count: number; minWidth: number };

const CASES: Case[] = [
  { file: 'src/components/Discovery/DiscoveryToolsHub.tsx', columnId: 'updatedAt', count: 4, minWidth: 180 },
  { file: 'src/components/assessment/AssessmentHub.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/Economics/FinanceHub.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/ResultsVNext/roi/roiCaseFullToolPresenters.tsx', columnId: 'updatedAt', count: 2, minWidth: 180 },
  { file: 'src/components/ResultsVNext/roi/roiCaseDetailPresenters.tsx', columnId: 'updatedAt', count: 4, minWidth: 180 },
  { file: 'src/components/ResultsVNext/roi/roiRegistryPresenters.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/ResultsVNext/okr/okrObjectivePresenters.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/ResultsVNext/okr/okrKeyResultPresenters.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/ResultsVNext/okr/okrRegistryPresenters.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/Audit/method/tabs/AuditReportsTab.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/Audit/method/tabs/AuditReportsTab.tsx', columnId: 'publishedAt', count: 1, minWidth: 160 },
  { file: 'src/components/Audit/method/tabs/AuditProcessesTab.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/Audit/method/tabs/AuditInitiativesTab.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
  { file: 'src/components/assessment/manage/ReportsManagementPanel.tsx', columnId: 'updatedAt', count: 1, minWidth: 180 },
];

describe('Rodzina "ZAKTUALIZOWANO"/"Aktualizacja" — kolumny daty mają margines na 1440px (fala 4)', () => {
  for (const { file, columnId, count, minWidth } of CASES) {
    it(`${file} :: ${columnId} — ${count} wystąpień, width >= ${minWidth}px + dataType 'date'`, () => {
      const source = readSource(file);
      const blocks = columnBlocks(source, columnId);
      expect(blocks.length, `${file}: expected ${count}x id:'${columnId}', found ${blocks.length}`).toBe(
        count
      );
      blocks.forEach((block, i) => {
        const context = `${file} #${i} (${columnId})`;
        expectWidthAtLeast(block, minWidth, context);
        expectDataTypeDate(block, context);
      });
    });
  }
});

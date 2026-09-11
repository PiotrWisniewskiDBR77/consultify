/**
 * @vitest-environment node
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] D-6 (odbiór W2B 20260910,
 * `ODBIOR_W2B_INICJATYWY_REALIZACJA_20260910.md` §2.1) — kebab wiersza
 * KANONICZNEGO w Realizacja → Praca, pozycja „Zaktualizuj zadanie"/
 * „Update task" (`ExecutionWorkSurface.tsx` → `onClick: openWorkspaceForAction`
 * → `openWorkspace` → `onOpenDocument(row)` → `ExecutionHub.handleOpenWorkDocument`)
 * ustawia `activeDocumentId` postaci `work:<executionCaseId>:<workId>`
 * (np. `work:review-exec-supply-chain:task-supplier-data`).
 *
 * POMIAR ŹRÓDŁA: `renderContent()` miał JUŻ poprawny handler dla tego
 * prefiksu — w gałęzi `if (activeTab === 'work') { if
 * (activeDocumentId?.startsWith('work:')) {…} }`, renderujący
 * `ExecutionWorkSurface` z `documentId` (wbudowany podgląd pracy, ta sama
 * rodzina napraw co E1b/R1 i E1c/F1). Był jednak MARTWY: wcześniejszy,
 * bezwarunkowy `if (activeDocumentId) {…}` na górze tej samej funkcji
 * sprawdzał `execution-intelligence:*` i `report:*`, ale NIE `work:*`, więc
 * KAŻDE otwarcie `work:…` spadało na ogólny fallback
 * `<ExecutionInitiativeDocumentView initiativeId={activeDocumentId} …>` —
 * karta próbowała otworzyć „inicjatywę" o id `work:…` i dostawała 404 na
 * czterech trasach (`/api/v8/planning/initiatives/work%3A…`,
 * `/api/initiatives/work:…/suggested-changes`, `/api/initiatives/work:…`,
 * `/api/initiatives/runtime-v1/initiatives/work%3A…`) plus mieszany
 * PL/EN komunikat błędu karty inicjatywy.
 *
 * NAPRAWA: obsłużyć `work:` w GÓRNYM bloku, przed fallbackiem do
 * `ExecutionInitiativeDocumentView` — ten sam wzorzec co już istniejące
 * `report:`/`execution-intelligence:` gałęzie tam.
 *
 * Dlaczego na ŹRÓDLE, a nie na zamontowanym drzewie: `ExecutionHub` ma
 * kilka tysięcy linii — montowanie w vitest jest znanym źródłem OOM
 * (patrz `ExecutionHub.kanonPaskow.source.test.ts`,
 * `ExecutionHub.realizacjeKebab.source.test.ts`).
 *
 * MUTACJA (weryfikacja ręczna): usunięcie nowej gałęzi `work:` z górnego
 * bloku → test czerwony na asercji (a) i (b); przesunięcie jej PO
 * fallbackowym `return <ExecutionInitiativeDocumentView …>` → czerwony na (b).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hub = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');

const renderContentStart = hub.indexOf('const renderContent = () => {');
const activeDocumentBlockStart = hub.indexOf('if (activeDocumentId) {', renderContentStart);
const activeTabListStart = hub.indexOf("if (activeTab === 'list') {", activeDocumentBlockStart);

describe('D-6 — ExecutionHub renderContent kieruje work:<id> do ExecutionWorkSurface', () => {
  it('(a) blok activeDocumentId obsługuje prefiks work: przed fallbackiem karty inicjatywy', () => {
    expect(renderContentStart).toBeGreaterThan(-1);
    expect(activeDocumentBlockStart).toBeGreaterThan(renderContentStart);
    expect(activeTabListStart).toBeGreaterThan(activeDocumentBlockStart);

    const body = hub.slice(activeDocumentBlockStart, activeTabListStart);
    expect(body).toContain("activeDocumentId.startsWith('work:')");
    expect(body).toContain('<ExecutionWorkSurface');
    expect(body).toContain('<ExecutionInitiativeDocumentView');
  });

  it('(b) gałąź work: jest UMIESZCZONA PRZED fallbackiem ExecutionInitiativeDocumentView', () => {
    const body = hub.slice(activeDocumentBlockStart, activeTabListStart);
    const workBranchIndex = body.indexOf("activeDocumentId.startsWith('work:')");
    const fallbackIndex = body.indexOf('<ExecutionInitiativeDocumentView');
    expect(workBranchIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(workBranchIndex).toBeLessThan(fallbackIndex);
  });

  it('(c) gałąź work: przekazuje documentId z reszty identyfikatora (join po drugim ":")', () => {
    const body = hub.slice(activeDocumentBlockStart, activeTabListStart);
    const workBranchIndex = body.indexOf("activeDocumentId.startsWith('work:')");
    const snippet = body.slice(workBranchIndex, workBranchIndex + 400);
    expect(snippet).toContain("activeDocumentId.split(':')");
    expect(snippet).toContain('documentId={workIdParts.join(\':\')}');
  });
});

/**
 * HP-16 (B-HP16-S) — sheet (arkusz) evidence contract.
 *
 * Sheet generuje w tle (`docGenerationRuntime.startSheet`, 202+poll) i był
 * JEDYNYM z 8 narzędzi Teresy bez `EvidenceContract`/`EvidenceEnvelope`. Ten test
 * dowodzi, że:
 *   1. `buildSheetEvidenceContract` liczy pewność DETERMINISTYCZNIE z realnych
 *      sygnałów (grounded / premium / rowCount / sourceRefs) — bez LLM, bez I/O.
 *   2. kontrakt persystuje się przez `safePersistEvidenceContract` jako koperta
 *      `artifactType='sheet'` (dokładnie punkt wpięcia w `startSheet`).
 */
import { describe, expect, it, vi } from 'vitest';

import { safePersistEvidenceContract } from '../../../../../server/src/services/evidence/evidenceContractBridge.js';
import { buildSheetEvidenceContract } from '../../../../../server/src/services/evidence/sheetEvidenceContract.js';

describe('buildSheetEvidenceContract — deterministic quality signals', () => {
  it('grounded + premium + ≥3 source refs ⇒ high confidence, no fabrication risk', () => {
    const contract = buildSheetEvidenceContract({
      sourceRefs: [
        { sourceType: 'initiative', sourceId: 'i-1', sourceTitle: 'Program A' },
        { sourceType: 'insight', sourceId: 'ins-1', sourceTitle: 'Insight X' },
        { sourceType: 'report', sourceId: 'r-1', sourceTitle: 'Q3 report' },
      ],
      seedText: 'zbuduj arkusz kosztów',
      grounded: true,
      premium: true,
      rowCount: 12,
    });

    // seed (chat_intent) + 3 refs = 4 sources ⇒ ≥3 gate satisfied
    expect(contract.sources.length).toBe(4);
    expect(contract.sources[0]).toMatchObject({ type: 'chat_intent' });
    expect(contract.sources[1]).toMatchObject({ type: 'initiative', ref: 'i-1' });
    expect(contract.risks).toEqual([]);
    expect(contract.confidence).toBe('high');
  });

  it('grounded but legacy markdown (not premium) ⇒ still no fabrication risk, quality 80', () => {
    const contract = buildSheetEvidenceContract({
      sourceRefs: [{ sourceType: 'note', sourceId: 'n-1', sourceTitle: 'Notatka' }],
      seedText: 'tabela',
      grounded: true,
      premium: false,
      rowCount: 5,
    });
    // grounded ⇒ NO fabrication risk; but legacy ⇒ typed-schema toVerify present
    expect(contract.risks).toEqual([]);
    expect(contract.toVerify.some((v) => v.includes('typowanego schematu'))).toBe(true);
    // 2 sources (< 3) ⇒ not high, but grounded ⇒ medium
    expect(contract.confidence).toBe('medium');
  });

  it('NOT grounded ⇒ explicit fabrication risk + toVerify + hard low confidence (§0.3)', () => {
    const contract = buildSheetEvidenceContract({
      sourceRefs: [
        { sourceType: 'initiative', sourceId: 'i-1', sourceTitle: 'A' },
        { sourceType: 'initiative', sourceId: 'i-2', sourceTitle: 'B' },
        { sourceType: 'initiative', sourceId: 'i-3', sourceTitle: 'C' },
      ],
      seedText: 'arkusz przykładowy',
      grounded: false,
      premium: true,
      rowCount: 8,
    });
    // even with ≥3 sources, no real org data ⇒ quality 20 < 40 ⇒ low
    expect(contract.risks.some((r) => r.includes('ilustracyjne'))).toBe(true);
    expect(contract.toVerify.some((v) => v.includes('przykłady'))).toBe(true);
    expect(contract.confidence).toBe('low');
  });

  it('no rows ⇒ empty-sheet toVerify; no seed/refs ⇒ 0 sources ⇒ low', () => {
    const contract = buildSheetEvidenceContract({
      grounded: false,
      premium: false,
      rowCount: 0,
    });
    expect(contract.sources).toEqual([]);
    expect(contract.toVerify.some((v) => v.includes('żadnych wierszy'))).toBe(true);
    expect(contract.confidence).toBe('low');
  });
});

describe('sheet evidence persist — artifactType=sheet (startSheet wiring)', () => {
  it('persists the sheet EvidenceContract as an envelope with artifactType=sheet', async () => {
    const upsertEnvelope = vi.fn().mockResolvedValue({ id: 'env-sheet-1' });
    const contract = buildSheetEvidenceContract({
      sourceRefs: [{ sourceType: 'report', sourceId: 'r-1', sourceTitle: 'Q3' }],
      seedText: 'koszty per dział',
      grounded: true,
      premium: false,
      rowCount: 6,
    });

    const ok = await safePersistEvidenceContract(
      contract,
      {
        organizationId: 'org-sheet-hp16',
        artifactType: 'sheet',
        artifactId: 'draft-sheet-1',
        service: 'docGenerationRuntime.startSheet',
        createdBy: 'user-1',
      },
      { writer: { upsertEnvelope } }
    );

    expect(ok).toBe(true);
    expect(upsertEnvelope).toHaveBeenCalledTimes(1);
    const input = upsertEnvelope.mock.calls[0][0];
    expect(input.artifactType).toBe('sheet');
    expect(input.artifactId).toBe('draft-sheet-1');
    expect(input.organizationId).toBe('org-sheet-hp16');
    expect(input.computedBy.service).toBe('docGenerationRuntime.startSheet');
    // grounded + 2 sources ⇒ medium ⇒ confidenceToNumeric 0.55
    expect(input.confidence).toBe(0.55);
  });
});

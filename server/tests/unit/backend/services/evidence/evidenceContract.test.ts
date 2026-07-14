/**
 * HP-14 + HP-15 Evidence Layer — testy jednostkowe (pure, zero DB).
 *
 * Pokrywa 3 punkty walidacji zlecenia:
 *   1. kontrakt waliduje KSZTAŁT (validateEvidenceContract),
 *   2. pewność jest DETERMINISTYCZNA z realnych sygnałów (deriveConfidence, bramka dowodowa),
 *   3. runtime citation verification oznacza NIEZWERYFIKOWANE + 2 serwisy zwracają evidence.
 */
import { describe, expect, it } from 'vitest';

import type { VerificationReport } from '../../../../../src/services/ai/citationVerifier.js';
import {
  adaptRuntimeCitation,
  adaptRuntimeCitations,
  confidenceFromVerification,
  numericConfidenceFromVerification,
} from '../../../../../src/services/ai/runtimeCitationVerification.js';
import {
  deriveConfidence,
  emptyEvidenceContract,
  type EvidenceContract,
  isEvidenceConfidence,
  validateEvidenceContract,
} from '../../../../../src/services/evidence/evidenceContract.js';
import { buildFinanceEvidenceContract } from '../../../../../src/services/financeReportSectionService.js';
import { buildEvidenceContractFromCandidate } from '../../../../../src/services/insightMaterializationService.js';

describe('HP-14 EvidenceContract — walidator kształtu', () => {
  it('akceptuje pełny, poprawny kontrakt', () => {
    const contract: EvidenceContract = {
      sources: [{ type: 'interview', ref: 'ans_1', snippet: 'cyt' }],
      assumptions: ['WACC 10%'],
      risks: ['pokrycie jednoźródłowe'],
      confidence: 'medium',
      toVerify: ['zweryfikuj dane Q3'],
    };
    const res = validateEvidenceContract(contract);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('emptyEvidenceContract() jest poprawny i ma confidence low', () => {
    const empty = emptyEvidenceContract();
    expect(validateEvidenceContract(empty).valid).toBe(true);
    expect(empty.confidence).toBe('low');
  });

  it('odrzuca zły kształt (assumptions nie-string[], zła confidence, źródło bez type)', () => {
    const res = validateEvidenceContract({
      sources: [{ ref: 'x' }],
      assumptions: [1, 2],
      risks: [],
      confidence: 'certain',
      toVerify: [],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('sources[0].type'))).toBe(true);
    expect(res.errors.some((e) => e.includes('assumptions'))).toBe(true);
    expect(res.errors.some((e) => e.includes('confidence'))).toBe(true);
  });

  it('isEvidenceConfidence rozpoznaje tylko low/medium/high', () => {
    expect(isEvidenceConfidence('high')).toBe(true);
    expect(isEvidenceConfidence('unknown')).toBe(false);
  });
});

describe('HP-14 deriveConfidence — deterministyczna bramka dowodowa (zero LLM)', () => {
  it('0 źródeł → zawsze low ("Deklaracja—niepotwierdzone")', () => {
    expect(deriveConfidence({ sourceCount: 0, qualityScore: 100 })).toBe('low');
  });

  it('cienki materiał (qualityScore < 40) → sufit low mimo wielu źródeł', () => {
    expect(deriveConfidence({ sourceCount: 5, qualityScore: 30 })).toBe('low');
  });

  it('≥3 źródła + brak cytowań + brak luk + dobra jakość → high', () => {
    expect(deriveConfidence({ sourceCount: 3, unresolvedGaps: 0, qualityScore: 80 })).toBe('high');
  });

  it('cytowania w większości niezweryfikowane obniżają pewność', () => {
    // 4 źródła, ale 1/4 cytowań zweryfikowana (ratio 0.25 < 0.5) → low
    expect(deriveConfidence({ sourceCount: 4, totalCitations: 4, verifiedCitations: 1 })).toBe(
      'low'
    );
    // ta sama liczba źródeł, 3/4 zweryfikowane (0.75 ≥ 0.5, <0.8) → medium
    expect(deriveConfidence({ sourceCount: 4, totalCitations: 4, verifiedCitations: 3 })).toBe(
      'medium'
    );
  });

  it('nierozwiązane luki blokują high (spada do medium)', () => {
    expect(deriveConfidence({ sourceCount: 5, unresolvedGaps: 2, qualityScore: 90 })).toBe(
      'medium'
    );
  });
});

describe('HP-15 runtime citation adapter + oznaczanie niezweryfikowanych', () => {
  it('governed citation (brak sourceId) → mapuje na document BEZ sourceId (będzie unverified)', () => {
    const c = adaptRuntimeCitation(
      { id: 'governed_1_x', type: 'document', title: 'Doc', reference: 'ref', excerpt: 'e' },
      0
    );
    expect(c).not.toBeNull();
    expect(c!.sourceType).toBe('document');
    expect(c!.sourceId).toBeUndefined(); // ← powód, dla którego weryfikator oznaczy 'unverified'
  });

  it('deep_research citation → external, z URL i flagą retrievedBySystem', () => {
    const c = adaptRuntimeCitation(
      {
        id: 'deep_research_1',
        type: 'external',
        title: 'Src',
        link: 'https://example.com',
        excerpt: 'e',
      },
      0
    );
    expect(c!.sourceType).toBe('external');
    expect(c!.sourceUrl).toBe('https://example.com');
    expect((c as any).retrievedBySystem).toBe(true);
  });

  it('adaptRuntimeCitations pomija śmieci i indeksuje', () => {
    const out = adaptRuntimeCitations([{ id: 'a', type: 'document' }, null, 'x', { id: 'b' }]);
    expect(out).toHaveLength(2);
    expect(out[0]!.index).toBe(0);
  });

  it('confidenceFromVerification: raport z niezweryfikowanymi → low', () => {
    const report: VerificationReport = {
      totalCitations: 4,
      verified: 1,
      unverified: 3,
      broken: 0,
      overallScore: 0.25,
      results: [],
      timestamp: new Date().toISOString(),
    };
    expect(confidenceFromVerification(report, false)).toBe('low');
    expect(numericConfidenceFromVerification(report, false)).toBeCloseTo(0.52);
  });

  it('confidenceFromVerification: wszystkie zweryfikowane (≥3) → high', () => {
    const report: VerificationReport = {
      totalCitations: 4,
      verified: 4,
      unverified: 0,
      broken: 0,
      overallScore: 1,
      results: [],
      timestamp: new Date().toISOString(),
    };
    expect(confidenceFromVerification(report, true)).toBe('high');
  });

  it('brak raportu (null) → low bez źródeł nie-ogólnych, medium gdy są', () => {
    expect(confidenceFromVerification(null, false)).toBe('low');
    expect(confidenceFromVerification(null, true)).toBe('medium');
  });
});

describe('HP-14 serwis #1 (Insight) zwraca wypełniony EvidenceContract', () => {
  it('buduje kontrakt z evidence_map + material_quality (źródła, ryzyka, toVerify, confidence realne)', () => {
    const contract = buildEvidenceContractFromCandidate(
      {
        title: 'T',
        executive_summary: 'S',
        themes: [{ title: 'th', description: 'd', evidence_refs: ['ans_1', 'ans_2'] }],
        issues: [{ title: 'i', description: 'd', evidence_refs: ['ans_3'] }],
        opportunities: [],
        signals: [],
        evidence_map: [
          { item_id: 'ans_1', answer_snippet: 'snippet 1' },
          { item_id: 'ans_2', answer_snippet: 'snippet 2' },
          { item_id: 'ans_3', answer_snippet: 'snippet 3' },
        ],
        missing_data: ['brak danych o kosztach'],
        material_quality: {
          score: 82,
          answer_quality_posture: 'strong',
          coverage_posture: 'good_coverage',
          missing_voices: [],
          limitations: ['próba ograniczona do 1 działu'],
          recommended_followups: ['dopytaj CFO'],
        },
      },
      'interview'
    );
    expect(validateEvidenceContract(contract).valid).toBe(true);
    expect(contract.sources).toHaveLength(3); // 3 unikalne item_id
    expect(contract.sources[0]!.type).toBe('interview');
    expect(contract.risks).toContain('próba ograniczona do 1 działu');
    expect(contract.toVerify).toEqual(
      expect.arrayContaining(['brak danych o kosztach', 'dopytaj CFO'])
    );
    // 3 źródła + jakość 82, ALE 1 nierozwiązana luka (missing_data) → gate blokuje high → medium.
    // To dowód, że bramka jest deterministyczna i uczciwa (luka ≠ pełna pewność).
    expect(contract.confidence).toBe('medium');
  });

  it('bez luk (missing_data puste, 3 źródła, jakość wysoka) → high', () => {
    const contract = buildEvidenceContractFromCandidate(
      {
        title: 'T',
        executive_summary: 'S',
        themes: [{ title: 'th', description: 'd', evidence_refs: ['ans_1', 'ans_2', 'ans_3'] }],
        issues: [],
        opportunities: [],
        signals: [],
        evidence_map: [
          { item_id: 'ans_1', answer_snippet: 's1' },
          { item_id: 'ans_2', answer_snippet: 's2' },
          { item_id: 'ans_3', answer_snippet: 's3' },
        ],
        missing_data: [],
        material_quality: {
          score: 85,
          answer_quality_posture: 'strong',
          coverage_posture: 'good_coverage',
          missing_voices: [],
          limitations: [],
          recommended_followups: [],
        },
      },
      'interview'
    );
    expect(contract.confidence).toBe('high');
  });

  it('single_source dodaje ryzyko pokrycia i obniża pewność', () => {
    const contract = buildEvidenceContractFromCandidate(
      {
        title: 'T',
        executive_summary: 'S',
        themes: [],
        issues: [{ title: 'i', description: 'd', evidence_refs: ['ans_1'] }],
        opportunities: [],
        signals: [],
        evidence_map: [{ item_id: 'ans_1', answer_snippet: 's' }],
        missing_data: ['luka A', 'luka B'],
        material_quality: {
          score: 45,
          answer_quality_posture: 'thin',
          coverage_posture: 'single_source',
          missing_voices: ['operacje'],
          limitations: [],
          recommended_followups: [],
        },
      },
      'tool'
    );
    expect(contract.risks.some((r) => r.includes('jednoźródłowe'))).toBe(true);
    expect(contract.risks.some((r) => r.includes('operacje'))).toBe(true);
    expect(contract.confidence).not.toBe('high');
  });
});

describe('HP-14 serwis #2 (Finance) zwraca wypełniony EvidenceContract', () => {
  const lineage = {
    packId: 'pack_1',
    sourcePack: null,
    generatedAt: '2026-07-14T00:00:00.000Z',
    assumptions: [
      { key: 'WACC', value: '10%', sourceType: 'user' as const, rationale: 'przyjęte z klientem' },
    ],
    entries: [
      {
        id: 'CURRENT_RATIO',
        category: 'ratio' as const,
        label: 'Current Ratio',
        value: '1.4',
        method: 'CA/CL',
        sourcePack: null,
        assumptions: [],
      },
      {
        id: 'ROIC_WACC',
        category: 'ratio' as const,
        label: 'ROIC-WACC',
        value: '3%',
        method: 'spread',
        sourcePack: null,
        assumptions: [],
      },
      {
        id: 'R1',
        category: 'reconcile' as const,
        label: 'BS balance',
        value: 'fail',
        method: 'A=L+E',
        sourcePack: null,
        assumptions: [],
      },
    ],
  };

  it('buduje kontrakt: źródła z lineage, ryzyka z reconcile fail, toVerify z braków', () => {
    const contract = buildFinanceEvidenceContract(
      lineage,
      {
        available: true,
        enforceMode: false,
        overallStatus: 'fail',
        summary: { passed: 0, warnings: 0, failed: 1, skipped: 0 },
        checks: [
          {
            checkCode: 'R1',
            checkName: 'BS balance',
            severity: 'error',
            status: 'fail',
            message: 'niezbilansowane',
            difference: 100,
            tolerance: 0,
          },
        ],
        computedAt: '2026-07-14T00:00:00.000Z',
        blocksReady: true,
      },
      { available: false, valuationId: null, valuationTitle: null, basket: null },
      { total: 4, computed: 2, skipped: 2 },
      ['CF']
    );
    expect(validateEvidenceContract(contract).valid).toBe(true);
    expect(contract.sources.length).toBeGreaterThanOrEqual(2);
    expect(contract.assumptions.some((a) => a.includes('WACC'))).toBe(true);
    expect(contract.risks.some((r) => r.includes('R1'))).toBe(true);
    expect(contract.risks.some((r) => r.includes('CF'))).toBe(true);
    expect(contract.toVerify.some((v) => v.includes('pominiętych'))).toBe(true);
    // 1 failed check + 1 brakujące sprawozdanie → luki > 0 → nie high
    expect(contract.confidence).not.toBe('high');
  });

  it('reconcile niedostępny → toVerify sygnalizuje brak recompute', () => {
    const contract = buildFinanceEvidenceContract(
      lineage,
      {
        available: false,
        enforceMode: false,
        overallStatus: 'na',
        summary: null,
        checks: [],
        computedAt: null,
        blocksReady: false,
      },
      { available: false, valuationId: null, valuationTitle: null, basket: null },
      { total: 2, computed: 2, skipped: 0 },
      []
    );
    expect(contract.toVerify.some((v) => v.includes('Reconcile R1-R8 nie policzony'))).toBe(true);
  });
});

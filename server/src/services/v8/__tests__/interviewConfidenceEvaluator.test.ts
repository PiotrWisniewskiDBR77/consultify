/**
 * Testy graniczne współdzielonego evaluatora pewności (M03R-012).
 *
 * Sedno: granica high/medium biegnie po ROZRZUCIE ŹRÓDEŁ, nie po liczbie
 * pointerów. Dlatego każdy przypadek „2 pointery" występuje tu w dwóch
 * wariantach — z jednego i z dwóch źródeł — bo to jedyna para, która wcześniej
 * dawała ten sam wynik przy trzech różnych progach w kodzie.
 */
import { describe, expect, it } from 'vitest';

import {
  evaluateConfidence,
  evaluateSourceCoverage,
} from '../interviewConfidenceEvaluator.js';
import type { P10EvidencePointer, P10EvidencePointerType } from '../interviewInsightCanon.js';

function pointer(
  overrides: Partial<P10EvidencePointer> & { sourceRef: string }
): P10EvidencePointer {
  return {
    pointerId: overrides.pointerId ?? `p-${overrides.sourceRef}`,
    type: (overrides.type ?? 'interview_session') as P10EvidencePointerType,
    sourceRef: overrides.sourceRef,
    capturedAt: overrides.capturedAt ?? '2026-08-04T00:00:00.000Z',
    sourceFingerprint: overrides.sourceFingerprint ?? 'fp',
    capturedExcerpt: overrides.capturedExcerpt ?? null,
    removalReason: overrides.removalReason ?? null,
    isTombstone: overrides.isTombstone ?? false,
  };
}

describe('evaluateConfidence — granica high/medium', () => {
  it('2 pointery z DWÓCH źródeł => high', () => {
    const r = evaluateConfidence({
      pointers: [
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
        pointer({ sourceRef: 'interview_session:b', pointerId: 'p2' }),
      ],
    });
    expect(r.level).toBe('high');
    expect(r.distinctSourceCount).toBe(2);
    expect(r.meetsHighRule).toBe(true);
  });

  it('2 pointery z JEDNEGO źródła => medium, nie high', () => {
    const r = evaluateConfidence({
      pointers: [
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p2' }),
      ],
    });
    expect(r.level).toBe('medium');
    expect(r.distinctSourceCount).toBe(1);
    expect(r.meetsHighRule).toBe(false);
  });

  it('dwa cytaty z tej samej rozmowy to JEDEN segment (kotwica # nie tworzy źródła)', () => {
    const r = evaluateConfidence({
      pointers: [
        pointer({ sourceRef: 'transcript:42#l10', type: 'transcript_excerpt', pointerId: 'p1' }),
        pointer({ sourceRef: 'transcript:42#l88', type: 'transcript_excerpt', pointerId: 'p2' }),
      ],
    });
    expect(r.distinctSourceCount).toBe(1);
    expect(r.level).toBe('medium');
  });

  it('1 pointer + clear triangulation NIE wystarcza — reguła wymaga 2+ pointerów', () => {
    const r = evaluateConfidence({
      pointers: [pointer({ sourceRef: 'interview_session:a' })],
      clearTriangulation: true,
    });
    expect(r.level).not.toBe('high');
  });

  it('2 pointery z jednego źródła + clear triangulation => high', () => {
    const r = evaluateConfidence({
      pointers: [
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p2' }),
      ],
      clearTriangulation: true,
    });
    expect(r.level).toBe('high');
  });

  it('3 pointery z jednego źródła to nadal medium — stary próg >= 3 dawałby tu complete', () => {
    const input = {
      pointers: [
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p2' }),
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p3' }),
      ],
    };
    expect(evaluateConfidence(input).level).toBe('medium');
    expect(evaluateSourceCoverage(input)).toBe('partial');
  });
});

describe('evaluateConfidence — medium/low i strong artifact', () => {
  it('1 pointer typu transcript_excerpt => medium (strong artifact)', () => {
    const r = evaluateConfidence({
      pointers: [pointer({ sourceRef: 'transcript:1', type: 'transcript_excerpt' })],
    });
    expect(r.level).toBe('medium');
    expect(r.hasStrongArtifact).toBe(true);
  });

  it('1 pointer typu operator_note => low (wąski sygnał)', () => {
    const r = evaluateConfidence({
      pointers: [pointer({ sourceRef: 'note:1', type: 'operator_note' })],
    });
    expect(r.level).toBe('low');
    expect(r.hasStrongArtifact).toBe(false);
  });

  it('1 pointer typu interview_session => low', () => {
    expect(
      evaluateConfidence({ pointers: [pointer({ sourceRef: 'interview_session:a' })] }).level
    ).toBe('low');
  });
});

describe('evaluateConfidence — tombstone, brak dowodów, sprzeczność', () => {
  it('tombstone nie liczy się do rozrzutu źródeł', () => {
    const r = evaluateConfidence({
      pointers: [
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
        pointer({ sourceRef: 'interview_session:b', pointerId: 'p2', isTombstone: true }),
      ],
    });
    expect(r.activePointerCount).toBe(1);
    expect(r.distinctSourceCount).toBe(1);
    expect(r.level).toBe('low');
  });

  it('zero aktywnych pointerów => insufficient', () => {
    expect(evaluateConfidence({ pointers: [] }).level).toBe('insufficient');
    expect(
      evaluateConfidence({
        pointers: [pointer({ sourceRef: 'interview_session:a', isTombstone: true })],
      }).level
    ).toBe('insufficient');
  });

  it('nierozwiązana sprzeczność przy 2+ pointerach => contradicted i blokuje high', () => {
    const input = {
      pointers: [
        pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
        pointer({ sourceRef: 'interview_session:b', pointerId: 'p2' }),
      ],
      unresolvedMaterialContradiction: true,
    };
    const r = evaluateConfidence(input);
    expect(r.level).toBe('contradicted');
    expect(r.meetsHighRule).toBe(false);
    expect(evaluateSourceCoverage(input)).toBe('partial');
  });

  it('sprzeczność przy JEDNYM pointerze nie tworzy contradicted — nie ma z czym się sprzeczać', () => {
    const r = evaluateConfidence({
      pointers: [pointer({ sourceRef: 'note:1', type: 'operator_note' })],
      unresolvedMaterialContradiction: true,
    });
    expect(r.level).toBe('low');
  });
});

describe('evaluateSourceCoverage — complete tylko po regule high', () => {
  it('complete gdy 2+ źródła', () => {
    expect(
      evaluateSourceCoverage({
        pointers: [
          pointer({ sourceRef: 'interview_session:a', pointerId: 'p1' }),
          pointer({ sourceRef: 'interview_session:b', pointerId: 'p2' }),
        ],
      })
    ).toBe('complete');
  });

  it('partial przy pustym zbiorze dowodów', () => {
    expect(evaluateSourceCoverage({ pointers: [] })).toBe('partial');
  });
});

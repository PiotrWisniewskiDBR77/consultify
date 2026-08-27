import { describe, expect, it } from 'vitest';

import type { MethodFindingRecord } from '../../../method-core/outputs/MethodOutputService.js';
import { composeAreaNarrative } from '../assessmentNarrativeComposer.js';

const finding: MethodFindingRecord = {
  id: 'finding-1A',
  outputId: 'output-1',
  unitId: '1A',
  unitName: 'Obszar 1A',
  currentLevel: 2,
  targetLevel: 4,
  gap: 2,
  supportingEvidence: [
    { evidenceId: 'evidence-1', evidenceType: 'interview', strength: 'E2', locator: 'Q1' },
  ],
  contradictingEvidence: [],
  businessMeaning: 'Planowanie nie korzysta ze wspólnego obrazu obciążenia maszyn.',
  rootCauseHypothesis: 'Dane są aktualizowane w osobnych arkuszach.',
  riskOrOpportunity: 'Wspólny obraz ograniczy ręczne uzgodnienia.',
  recommendation: 'Połączyć plan z potwierdzeniami wykonania.',
  prerequisite: 'Uzgodnić identyfikatory operacji.',
  expectedOutcome: 'Plan będzie aktualizowany tym samym rytmem co wykonanie.',
  kpiProposal: null,
  confidence: 'high',
  priorityRationale: 'Luka wpływa na terminowość zleceń.',
  sourceLocators: ['interview:Q1'],
  createdAt: '2026-08-28T00:00:00.000Z',
};

const context = { axisId: 1, evidenceState: 'evidenced' } as const;

describe('Day 50 deterministic area narrative composer', () => {
  it('composes all five required elements and labels a root-cause hypothesis', () => {
    const result = composeAreaNarrative(finding, context);
    expect(result?.kind).toBe('full');
    expect(result?.text).toContain('Stan faktyczny:');
    expect(result?.text).toContain('Ocena i wiarygodność:');
    expect(result?.text).toContain('Znaczenie dla przedsiębiorstwa:');
    expect(result?.text).toContain('Luka i sens poziomu docelowego:');
    expect(result?.text).toContain('Najbliższy krok:');
    expect(result?.text).toContain('Hipoteza przyczyny:');
  });

  it('returns an honest factual short form without business meaning', () => {
    const result = composeAreaNarrative({ ...finding, businessMeaning: '' }, context);
    expect(result?.kind).toBe('factual_short');
    expect(result?.text).toContain('Brak treści wymaganej do pełnego komentarza');
    expect(result?.text).not.toContain('Znaczenie dla przedsiębiorstwa:');
  });

  it('returns an honest factual short form without a recommendation', () => {
    const result = composeAreaNarrative({ ...finding, recommendation: '' }, context);
    expect(result?.kind).toBe('factual_short');
    expect(result?.text).toContain('najbliższy krok');
  });

  it('returns null without a finding', () => {
    expect(composeAreaNarrative(null, context)).toBeNull();
  });

  it('returns null for a fully skipped area even when narrative fields are filled', () => {
    expect(composeAreaNarrative(finding, { ...context, skipped: true })).toBeNull();
  });

  it('describes low confidence and no supporting evidence in Polish', () => {
    const result = composeAreaNarrative(
      { ...finding, confidence: 'low', supportingEvidence: [] },
      { ...context, evidenceState: 'incomplete' }
    );
    expect(result?.text).toContain('pewność niska');
    expect(result?.text).toContain('liczba dowodów: 0');
    expect(result?.text).toContain('stan dowodów niepełne');
    expect(result?.text).not.toMatch(/\blow\b/u);
    expect(result?.text).not.toMatch(/\bincomplete\b/u);
  });

  it('counts contradicting evidence', () => {
    const result = composeAreaNarrative(
      {
        ...finding,
        contradictingEvidence: [
          { evidenceId: 'contra-1', evidenceType: 'document', strength: 'E2', locator: 'D1' },
        ],
      },
      context
    );
    expect(result?.text).toContain('liczba dowodów przeciwnych: 1');
    expect(result?.provenance.evidenceRefs).toContain('contra-1');
  });

  it('names only source fields that are non-empty on the finding', () => {
    const result = composeAreaNarrative(finding, context);
    expect(result).not.toBeNull();
    for (const sourceField of result?.provenance.sourceFields ?? []) {
      const value = finding[sourceField as keyof MethodFindingRecord];
      expect(value, sourceField).not.toBeNull();
      if (typeof value === 'string') expect(value.trim(), sourceField).not.toBe('');
      if (Array.isArray(value)) expect(value.length, sourceField).toBeGreaterThan(0);
    }
  });

  it('is byte-for-byte deterministic', () => {
    expect(composeAreaNarrative(finding, context)).toEqual(composeAreaNarrative(finding, context));
  });

  it('does not emit a full paragraph above the 170-word ceiling', () => {
    expect(
      composeAreaNarrative({ ...finding, businessMeaning: 'wartość '.repeat(180) }, context)
    ).toBeNull();
  });
});

/**
 * @vitest-environment jsdom
 *
 * SIRI/ADMA AI-guidance parity (Oxford O5.2) — verifies SIRIAssessmentEditor and
 * ADMAAssessmentEditor wire `getAssessmentGuidanceLive` (assessmentGuidanceRuntime)
 * IDENTICALLY to DRDAssessmentEditor: a "Podpowiedź AI" affordance per dimension×level
 * that fetches canon-grounded guidance and renders whyItMatters/levelInterpretation/
 * canonContext/pitfalls, scoped to the correct framework id ('SIRI' / 'ADMA').
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AssessmentGuidanceOutput } from '@/services/assessmentKnowledge/assessmentGuidanceService';

// react-i18next: minimal stub so components using useTranslation render in Polish.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'pl' },
  }),
}));

const guidanceFixture: AssessmentGuidanceOutput = {
  whyItMatters: 'Testowy powód, dla którego ten wymiar ma znaczenie w transformacji.',
  levelInterpretation: 'Testowa interpretacja poziomu — dowód, nie aspiracja.',
  canonContext: 'Testowy kontekst kanonu frameworku.',
  validationQuestions: ['Czy istnieje udokumentowany proces?'],
  pitfalls: ['Nie oceniaj po planach.'],
  confidence: 'medium',
  source: 'llm',
};

const getAssessmentGuidanceLive = vi.fn().mockResolvedValue(guidanceFixture);

vi.mock('@/services/assessmentKnowledge/assessmentGuidanceRuntime', () => ({
  getAssessmentGuidanceLive: (...args: unknown[]) => getAssessmentGuidanceLive(...args),
}));

import { ADMAAssessmentEditor } from '@/components/assessment/adma/ADMAAssessmentEditor';
import { SIRIAssessmentEditor } from '@/components/assessment/siri/SIRIAssessmentEditor';

describe('SIRIAssessmentEditor — AI guidance parity with DRD', () => {
  it('fetches and renders canon-grounded guidance scoped to framework SIRI', async () => {
    getAssessmentGuidanceLive.mockClear();
    render(
      <SIRIAssessmentEditor assessmentId="a1" value={undefined} onChange={vi.fn()} />
    );

    const btn = screen.getByText(/AI guidance/i);
    fireEvent.click(btn);

    expect(await screen.findByText(guidanceFixture.whyItMatters)).toBeTruthy();
    expect(await screen.findByText(guidanceFixture.canonContext)).toBeTruthy();

    expect(getAssessmentGuidanceLive).toHaveBeenCalledTimes(1);
    const call = getAssessmentGuidanceLive.mock.calls[0][0];
    expect(call.framework).toBe('SIRI');
    expect(typeof call.dimensionId).toBe('string');
    expect(typeof call.levelNumber).toBe('number');
  });
});

describe('ADMAAssessmentEditor — AI guidance parity with DRD', () => {
  it('fetches and renders canon-grounded guidance scoped to framework ADMA', async () => {
    getAssessmentGuidanceLive.mockClear();
    render(
      <ADMAAssessmentEditor assessmentId="a2" value={undefined} onChange={vi.fn()} />
    );

    const btn = screen.getByText(/AI guidance/i);
    fireEvent.click(btn);

    expect(await screen.findByText(guidanceFixture.whyItMatters)).toBeTruthy();
    expect(await screen.findByText(guidanceFixture.canonContext)).toBeTruthy();

    expect(getAssessmentGuidanceLive).toHaveBeenCalledTimes(1);
    const call = getAssessmentGuidanceLive.mock.calls[0][0];
    expect(call.framework).toBe('ADMA');
    expect(typeof call.dimensionId).toBe('string');
    expect(typeof call.levelNumber).toBe('number');
  });
});

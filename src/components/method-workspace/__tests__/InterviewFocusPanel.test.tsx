/**
 * @vitest-environment jsdom
 *
 * Interview Focus is the assessor's default work screen. Three things this
 * suite protects:
 *  1. the evidence badge never reads as a critical/error tone for the normal
 *     "brak dowodu"/"dowód słaby" cases — only genuinely conflicting evidence
 *     (which really does block freeze) gets the danger token;
 *  2. evidence STRENGTH (E0-E4) renders as its own, separately-styled badge —
 *     a third axis, never folded into the evidenceState rollup badge;
 *  3. a long answer/question does not blow out the fixed-width layout.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InterviewFocusPanel } from '../InterviewFocusPanel';
import { makeInterviewFocusQuestion, makeResolutionData } from './fixtures';

function baseProps(overrides: Partial<React.ComponentProps<typeof InterviewFocusPanel>> = {}) {
  return {
    breadcrumb: ['DRD', 'Strategia i governance', 'Poziom 2'],
    questions: [makeInterviewFocusQuestion()],
    questionIndex: 0,
    questionTotal: 4,
    resolutionData: makeResolutionData(),
    onAnswerChange: vi.fn(),
    onAnswerStateChange: vi.fn(),
    onResolutionAction: vi.fn(),
    onEvidenceDrop: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn(),
    onNext: vi.fn(),
    onSkip: vi.fn(),
    onAskTeresa: vi.fn(),
    canGoBack: true,
    canGoNext: true,
    ...overrides,
  };
}

describe('InterviewFocusPanel — evidence tone never reads as critical for normal gaps', () => {
  it('evidenceState "missing" uses the warning token, never the danger token', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'missing' })] })} />);
    const badge = screen.getByText('Brak dowodu').closest('span')!;
    expect(badge.className).toMatch(/text-c-warning/);
    expect(badge.className).not.toMatch(/text-c-danger/);
  });

  it('evidenceState "weak" uses the warning token, never the danger token', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'weak' })] })} />);
    const badge = screen.getByText('Dowód słaby').closest('span')!;
    expect(badge.className).toMatch(/text-c-warning/);
    expect(badge.className).not.toMatch(/text-c-danger/);
  });

  it('evidenceState "conflicting" is the ONE legitimate danger case — contradicts and blocks freeze', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'conflicting' })] })} />);
    const badge = screen.getByText('Dowody sprzeczne').closest('span')!;
    expect(badge.className).toMatch(/text-c-danger/);
  });

  it('evidenceState "complete" uses the success token', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'complete' })] })} />);
    const badge = screen.getByText('Dowód kompletny').closest('span')!;
    expect(badge.className).toMatch(/text-c-success/);
  });
});

describe('InterviewFocusPanel — three independent axes render as three distinct signals', () => {
  it('evidence STRENGTH (E0-E4) renders in its own badge, separate from the evidenceState rollup badge', () => {
    render(
      <InterviewFocusPanel
        {...baseProps({
          questions: [makeInterviewFocusQuestion({ evidenceState: 'weak', evidenceStrength: 'E2' })],
        })}
      />
    );
    const strengthBadge = screen.getByTestId('evidence-strength-badge');
    expect(strengthBadge).toHaveTextContent('E2');
    // Not the same element as the rollup badge, and not colored like a warning —
    // strength describes the source, it is not itself an alarm.
    const rollupBadge = screen.getByText('Dowód słaby').closest('span')!;
    expect(strengthBadge).not.toBe(rollupBadge);
    expect(strengthBadge.className).not.toMatch(/text-c-warning|text-c-danger/);
  });

  it('omits the strength badge entirely when no evidence strength has been recorded yet', () => {
    render(
      <InterviewFocusPanel
        {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceStrength: null })] })}
      />
    );
    expect(screen.queryByTestId('evidence-strength-badge')).not.toBeInTheDocument();
  });

  it('the answer-state control (approval axis) and the evidence badges are separate DOM regions', () => {
    render(<InterviewFocusPanel {...baseProps()} />);
    const answerControl = screen.getByTestId('answer-state-control');
    const evidenceZone = screen.getByTestId('evidence-drop-zone');
    expect(answerControl).toBeInTheDocument();
    expect(evidenceZone).toBeInTheDocument();
    expect(answerControl.contains(evidenceZone)).toBe(false);
    expect(evidenceZone.contains(answerControl)).toBe(false);
  });
});

describe('InterviewFocusPanel — long text does not break the layout', () => {
  it('renders a very long canonical question and a long existing answer without throwing, keeping the command row intact', () => {
    const longWording = (
      'Czy proces sprzedaży jest udokumentowany, wersjonowany, regularnie przeglądany przez właściciela procesu oraz ' +
      'współdzielony ze wszystkimi członkami zespołu handlowego w sposób który pozwala na jego audyt i doskonalenie w czasie '.repeat(
        3
      )
    ).trim();
    const longAnswer = 'Tak, mamy udokumentowany proces. '.repeat(40);
    render(
      <InterviewFocusPanel
        {...baseProps({
          questions: [
            makeInterviewFocusQuestion({
              question: { ...makeInterviewFocusQuestion().question, canonicalWording: longWording },
              answerText: longAnswer,
            }),
          ],
        })}
      />
    );
    expect(screen.getByText(longWording)).toBeInTheDocument();
    // The command row (Wstecz/Zapisz/Dalej) survives regardless of content length.
    expect(screen.getByText('Dalej')).toBeInTheDocument();
    expect(screen.getByText('Wstecz')).toBeInTheDocument();
  });
});

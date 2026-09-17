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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    const badge = screen.getByText('No evidence').closest('span')!;
    expect(badge.className).toMatch(/text-c-warning/);
    expect(badge.className).not.toMatch(/text-c-danger/);
  });

  it('evidenceState "weak" uses the warning token, never the danger token', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'weak' })] })} />);
    const badge = screen.getByText('Evidence weak').closest('span')!;
    expect(badge.className).toMatch(/text-c-warning/);
    expect(badge.className).not.toMatch(/text-c-danger/);
  });

  it('evidenceState "conflicting" is the ONE legitimate danger case — contradicts and blocks freeze', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'conflicting' })] })} />);
    const badge = screen.getByText('Evidence conflicting').closest('span')!;
    expect(badge.className).toMatch(/text-c-danger/);
  });

  it('evidenceState "complete" uses the success token', () => {
    render(<InterviewFocusPanel {...baseProps({ questions: [makeInterviewFocusQuestion({ evidenceState: 'complete' })] })} />);
    const badge = screen.getByText('Evidence complete').closest('span')!;
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
    const rollupBadge = screen.getByText('Evidence weak').closest('span')!;
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
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });
});

describe('K-24 — active evidence register and governed removal', () => {
  const questionWithEvidence = makeInterviewFocusQuestion({
    evidenceState: 'complete',
    evidenceCount: 1,
    evidenceStrength: 'E2',
    evidence: [{
      eventId: 'event-1', evidenceId: 'evidence-1', label: 'policy.pdf',
      evidenceType: 'document', strength: 'E2', level: 2,
      occurredAt: '2026-09-17T10:00:00.000Z',
    }],
  });

  it('lists the evidence and removes it only after explicit confirmation', async () => {
    const onEvidenceRemove = vi.fn().mockResolvedValue(undefined);
    render(<InterviewFocusPanel {...baseProps({ questions: [questionWithEvidence], onEvidenceRemove })} />);

    expect(screen.getByText('policy.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence policy.pdf' }));
    expect(onEvidenceRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onEvidenceRemove).toHaveBeenCalledWith('event-1'));
  });

  it('cancel and read-only mode never call or expose the removal action', () => {
    const onEvidenceRemove = vi.fn();
    const { rerender } = render(<InterviewFocusPanel {...baseProps({ questions: [questionWithEvidence], onEvidenceRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence policy.pdf' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(onEvidenceRemove).not.toHaveBeenCalled();

    rerender(<InterviewFocusPanel {...baseProps({ questions: [questionWithEvidence], onEvidenceRemove, readOnly: true })} />);
    expect(screen.queryByRole('button', { name: 'Remove evidence policy.pdf' })).not.toBeInTheDocument();
  });

  it('keeps the row and shows an actionable error when the server rejects removal', async () => {
    const onEvidenceRemove = vi.fn().mockRejectedValue(new Error('conflict'));
    render(<InterviewFocusPanel {...baseProps({ questions: [questionWithEvidence], onEvidenceRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove evidence policy.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be removed');
    expect(screen.getByText('policy.pdf')).toBeInTheDocument();
  });
});

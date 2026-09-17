import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MethodEvent, MethodLevel, MethodQuestion } from '@/method-core/contracts';
import {
  DRD_HELP_JUSTIFICATION_MARKER,
  DrdLevelInterviewWorkspace,
  drdLevelDecisions,
  pickDrdEvidenceOwnerId,
} from '../DrdLevelInterviewWorkspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, values?: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        'common.saveError': 'Save failed',
      };
      return Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        fallback ?? messages[key] ?? key
      );
    },
    i18n: { language: 'en' },
  }),
}));

const levels: MethodLevel[] = [1, 2, 3].map((level) => ({
  unitId: '1A', level, title: `L${level}`, canonicalDefinition: `D${level}`,
  requiredAttributes: [], distinctionFromPrevious: '', distinctionFromNext: '', validationQuestionIds: [`q${level}`],
  expectedEvidence: [], negativeEvidence: [], misScoringTraps: [], examples: [], technologyExamples: [], prerequisites: [], minimumEvidenceStrength: 'E0',
}));
const questions: MethodQuestion[] = [1, 2, 3].map((level) => ({
  questionId: `q${level}`, unitId: '1A', level, canonicalWording: `Question ${level}`,
  intent: '', plainLanguageExplanation: '', whyItMatters: `Why ${level}`, glossaryRefs: [], positiveAnswerExample: '', partialAnswerExample: '', negativeAnswerExample: '', expectedEvidence: [], likelyRespondentRoles: [], followUpQuestionIds: [], commonMisunderstanding: '', allowedTeresaCapabilities: [], sourceRefs: [],
}));
const axis = { id: 1, name: 'Digital Processes', levelCount: 3, areas: [] };
const area = { id: '1A', name: 'Sales Processes', levels: [] };
function event(level: number, answerState: string, justification?: string): MethodEvent {
  return { id: `${level}-${answerState}`, type: 'ANSWER_CONFIRMED', organizationId: 'o', sessionId: 's', unitId: '1A', level, actorKind: 'human', actorUserId: 'u', methodPackVersion: 'v', occurredAt: '2026-09-16T00:00:00Z', payload: { questionId: `q${level}`, answerState, justification } } as MethodEvent;
}

const baseProps = {
  axis, area, levels, questions, events: [] as MethodEvent[], selectedLevel: 2, currentLevel: 1, targetLevel: 3,
  answerText: 'Northwind evidence', canWrite: true, onAnswerChange: vi.fn(), onSelectLevel: vi.fn(),
  onSaveDecision: vi.fn(async () => {}), onEvidenceDrop: vi.fn(), onAskTeresa: vi.fn(),
};

describe('DRD-2 DEC-552 level interview', () => {
  it('projects the last Yes/No/Help decision per level', () => {
    const result = drdLevelDecisions([
      event(1, 'confirmed'), event(2, 'no'), event(2, 'dont_know', `${DRD_HELP_JUSTIFICATION_MARKER} owner task`),
    ], '1A');
    expect([...result.entries()]).toEqual([[1, 'yes'], [2, 'help']]);
  });

  it('addresses help to the evidence owner and falls back to the session owner', () => {
    expect(pickDrdEvidenceOwnerId({ roles: [{ userId: 'respondent', role: 'respondent' }, { userId: 'evidence', role: 'evidence_owner' }] }, 'owner')).toBe('evidence');
    expect(pickDrdEvidenceOwnerId({ roles: [] }, 'owner')).toBe('owner');
  });

  it('renders one answer, three decisions, and keeps No neutral', () => {
    render(<DrdLevelInterviewWorkspace {...baseProps} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByTestId('drd-levels-column')).toBeInTheDocument();
    const no = screen.getByRole('button', { name: 'No' });
    expect(no.className).not.toContain('danger');
    fireEvent.click(no);
    expect(no.className).not.toContain('danger');
  });

  it('saves the selected decision and disables levels above a No', async () => {
    const onSaveDecision = vi.fn(async () => {});
    const { rerender } = render(<DrdLevelInterviewWorkspace {...baseProps} onSaveDecision={onSaveDecision} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & next level' }));
    await waitFor(() => expect(onSaveDecision).toHaveBeenCalledWith('yes', 'Northwind evidence'));

    rerender(<DrdLevelInterviewWorkspace {...baseProps} events={[event(2, 'no')]} selectedLevel={2} />);
    expect(screen.getByRole('button', { name: /L3/ })).toBeDisabled();
  });

  it('shows a save error and keeps the decision selected when persistence fails', async () => {
    const onSaveDecision = vi.fn(async () => {
      throw new Error('write failed');
    });
    render(<DrdLevelInterviewWorkspace {...baseProps} onSaveDecision={onSaveDecision} />);

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save & next level' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save & next level' })).toBeEnabled();
    expect(onSaveDecision).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

import { ContextStep } from '../ContextStep';

function resetSession() {
  useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
  useToolStore.getState().createSession('dynamic-swot');
}

function Harness() {
  const session = useToolStore((state) => state.currentSession);
  if (!session) return null;
  return <ContextStep toolType="dynamic-swot" session={session} isPolish={false} />;
}

describe('ContextStep mission navigation', () => {
  beforeEach(resetSession);

  it('shows one question, retains the answer when navigating forward and back', () => {
    render(<Harness />);

    expect(screen.getAllByTestId('mission-question')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', {
        name: /discoveryToolsSteps\.contextStep\.dynamicSwot\.direction\.companyDirection\.label/,
      })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'discoveryToolsSteps.contextStep.dynamicSwot.ui.next',
      })
    );

    expect(screen.getAllByTestId('mission-question')).toHaveLength(1);
    expect(screen.getByText('2/5')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mission-prev'));
    expect(screen.getByText('1/5')).toBeInTheDocument();
    const context = (useToolStore.getState().currentSession?.inputData as any).context;
    expect(context.question1Confirmed).toBeTruthy();
    expect(context.directionChoices).toContain('company-direction');
  });

  it('cold-opens a completed mission on the persisted summary', () => {
    useToolStore.getState().updateInputData({
      context: {
        ...(useToolStore.getState().currentSession!.inputData as any).context,
        question1Confirmed: true,
        question2Confirmed: true,
        question3Confirmed: true,
        question4Confirmed: true,
        question5Confirmed: true,
      },
    } as any);

    render(<Harness />);

    expect(screen.getByTestId('mission-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('mission-question')).not.toBeInTheDocument();
  });
});

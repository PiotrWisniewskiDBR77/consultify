import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const translate = (key: string, fallback?: string) =>
    ({
      'sharedComponents.riskCanvas.analyzeRisks': 'Analyze Risks',
      'sharedComponents.riskCanvas.noRisksIdentified': 'No risks identified',
      'sharedComponents.riskCanvas.addFirstRisk': 'Add first risk',
      'sharedComponents.riskCanvas.addRisk': 'Add Risk',
      'sharedComponents.riskCanvas.riskImpact': 'Risk & Impact',
    })[key] || fallback || key;
  return {
    ...actual,
    useTranslation: () => ({ t: translate, i18n: { language: 'en' } }),
  };
});

import { RiskCanvas } from '@/components/shared/NModeSections/RiskCanvas';

describe('Task Analyze risk failure contract', () => {
  it('shows a persistent truthful error and exposes a real Retry action', () => {
    const analyze = vi.fn();
    const retry = vi.fn();
    render(
      <RiskCanvas
        risks={[]}
        onAddRisk={vi.fn()}
        onUpdateRisk={vi.fn()}
        onRemoveRisk={vi.fn()}
        onAIGenerate={analyze}
        isGeneratingAI={false}
        aiErrorMessage="Analysis unavailable (rate limited). The list was left unchanged."
        onAIRetry={retry}
        artifactType="task"
        artifactContext={{ title: 'Plan', status: 'todo', priority: 'high', type: 'task' }}
        fieldKeyPrefix="t"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('list was left unchanged');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('disables Analyze and Retry while a request is running', () => {
    render(
      <RiskCanvas
        risks={[]}
        onAddRisk={vi.fn()}
        onUpdateRisk={vi.fn()}
        onRemoveRisk={vi.fn()}
        onAIGenerate={vi.fn()}
        isGeneratingAI
        aiErrorMessage="Previous failure"
        onAIRetry={vi.fn()}
        artifactType="task"
        artifactContext={{ title: 'Plan', status: 'todo', priority: 'high', type: 'task' }}
        fieldKeyPrefix="t"
      />
    );

    expect(screen.getByRole('button', { name: 'Analyze Risks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
  });
});

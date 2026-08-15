/**
 * Smoke tests for ToolCanvas step routing + the "not implemented" guard.
 *
 * The literal "Step content not implemented yet." string must never appear:
 * shipped tools resolve a real step, and unresolved steps render a graceful
 * on-brand panel instead.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'discoveryToolsMain.toolCanvas.stepBeingPrepared': 'This step is being prepared',
        'discoveryToolsMain.toolCanvas.stepBeingPreparedDescription':
          'This workspace will be available soon.',
      };
      return translations[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import type { StepDefinition, ToolSession, ToolType } from '@/store/useToolStore';

import { ToolCanvas } from '../ToolCanvas';

function makeSession(toolType: ToolType, sections: Record<string, unknown[]>): ToolSession {
  return {
    id: 'sess-1',
    toolType,
    name: 'Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: 1,
    steps: [],
    inputData: { context: {} as never, sections } as never,
    chatHistory: [],
    generatedInitiatives: [],
    status: 'DRAFT',
  } as ToolSession;
}

const NOT_IMPLEMENTED = 'Step content not implemented yet.';

describe('ToolCanvas — digital trio domain steps', () => {
  const cases: Array<{ toolType: ToolType; stepId: string; name: string }> = [
    { toolType: 'ai-discovery', stepId: 'use-cases', name: 'Use cases' },
    { toolType: 'pain-explorer', stepId: 'problems', name: 'Problems' },
    { toolType: 'rpa-scanner', stepId: 'candidates', name: 'Candidates' },
  ];

  for (const c of cases) {
    it(`routes ${c.toolType}/${c.stepId} to a real domain step (no fallback)`, () => {
      const stepDefinition: StepDefinition = {
        id: c.stepId,
        name: c.name,
        namePl: c.name,
        description: 'desc',
        descriptionPl: 'desc',
        required: true,
        aiAssisted: true,
      };
      render(
        <ToolCanvas
          toolType={c.toolType}
          currentStep={1}
          stepDefinition={stepDefinition}
          session={makeSession(c.toolType, { [c.stepId]: [] })}
          isStreaming={false}
          streamedContent=""
          isPolish={false}
          onOpenChat={() => {}}
        />
      );
      expect(screen.getByText(c.name)).toBeInTheDocument();
      expect(screen.queryByText(NOT_IMPLEMENTED)).not.toBeInTheDocument();
    });
  }
});

describe('ToolCanvas — guard for unresolved steps', () => {
  it('never renders the raw "not implemented" string for an unknown step', () => {
    const stepDefinition: StepDefinition = {
      id: 'totally-unknown-step',
      name: 'Unknown',
      namePl: 'Unknown',
      description: 'desc',
      descriptionPl: 'desc',
      required: false,
      aiAssisted: false,
    };
    render(
      <ToolCanvas
        toolType={'value-chain' as ToolType}
        currentStep={1}
        stepDefinition={stepDefinition}
        session={makeSession('value-chain' as ToolType, {})}
        isStreaming={false}
        streamedContent=""
        isPolish={false}
        onOpenChat={() => {}}
      />
    );
    expect(screen.queryByText(NOT_IMPLEMENTED)).not.toBeInTheDocument();
    // Graceful on-brand panel instead.
    expect(screen.getByText('This step is being prepared')).toBeInTheDocument();
  });
});

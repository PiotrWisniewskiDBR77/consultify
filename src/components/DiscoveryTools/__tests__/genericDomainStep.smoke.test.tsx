/**
 * Smoke tests for GenericDomainStep — the Wave 1 digital-tool domain step.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const locale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const english: Record<string, string> = {
        'discoveryToolsTools.digital.genericDomainStep.defaultHint':
          'Teresa can help you refine this item.',
        'discoveryToolsTools.digital.genericDomainStep.namePlaceholder': 'Item title...',
        'discoveryToolsTools.digital.genericDomainStep.descPlaceholder': 'Description...',
        'discoveryToolsTools.digital.genericDomainStep.empty': 'No items yet',
        'discoveryToolsTools.common.add': 'Add',
        'discoveryToolsTools.common.remove': 'Remove',
      };
      const polish: Record<string, string> = {
        'discoveryToolsTools.digital.genericDomainStep.defaultHint':
          'Teresa może pomóc dopracować tę pozycję.',
        'discoveryToolsTools.digital.genericDomainStep.namePlaceholder': 'Nazwa pozycji...',
        'discoveryToolsTools.digital.genericDomainStep.descPlaceholder': 'Opis...',
        'discoveryToolsTools.digital.genericDomainStep.empty': 'Brak pozycji',
        'discoveryToolsTools.common.add': 'Dodaj',
        'discoveryToolsTools.common.remove': 'Usuń',
      };
      return (locale.current === 'pl' ? polish : english)[key] ?? key;
    },
    i18n: { language: locale.current },
  }),
}));

import type { ToolSession } from '@/store/useToolStore';

import { GenericDomainStep } from '../tools/Digital/GenericDomainStep';

function makeSession(overrides: Partial<ToolSession> = {}): ToolSession {
  return {
    id: 'sess-1',
    toolType: 'ai-discovery',
    name: 'Test session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStep: 1,
    steps: [],
    inputData: {
      context: {} as never,
      sections: { 'use-cases': [] },
    } as never,
    chatHistory: [],
    generatedInitiatives: [],
    status: 'DRAFT',
    ...overrides,
  } as ToolSession;
}

describe('GenericDomainStep', () => {
  beforeEach(() => {
    locale.current = 'en';
  });

  it('renders the domain title, description and Teresa assist hint', () => {
    render(
      <GenericDomainStep
        sectionId="use-cases"
        title="Use cases"
        description="Shortlist candidate AI use cases"
        session={makeSession()}
        isPolish={false}
      />
    );

    expect(screen.getByText('Use cases')).toBeInTheDocument();
    expect(screen.getByText('Shortlist candidate AI use cases')).toBeInTheDocument();
    // Teresa-branded inline assist hint is present.
    expect(screen.getByText(/Teresa/)).toBeInTheDocument();
  });

  it('shows an empty state when no items exist', () => {
    render(
      <GenericDomainStep
        sectionId="use-cases"
        title="Use cases"
        description="desc"
        session={makeSession()}
        isPolish={false}
      />
    );
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('disables the Add button until a title is entered', () => {
    render(
      <GenericDomainStep
        sectionId="use-cases"
        title="Use cases"
        description="desc"
        session={makeSession()}
        isPolish={false}
      />
    );
    const addBtn = screen.getByRole('button', { name: /Add/ });
    expect(addBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Item title...'), {
      target: { value: 'Invoice triage automation' },
    });
    expect(addBtn).not.toBeDisabled();
  });

  it('renders Polish labels when isPolish is true', () => {
    locale.current = 'pl';
    render(
      <GenericDomainStep
        sectionId="use-cases"
        title="Case'y"
        description="opis"
        session={makeSession()}
        isPolish
      />
    );
    expect(screen.getByText('Brak pozycji')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nazwa pozycji...')).toBeInTheDocument();
  });
});

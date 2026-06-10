/**
 * Smoke tests for GenericDomainStep — the Wave 1 digital-tool domain step.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

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

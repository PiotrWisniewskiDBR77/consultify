/**
 * Smoke tests for GenericDomainStep — the Wave 1 digital-tool domain step.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';
import type { ToolSession } from '@/store/useToolStore';

// GenericDomainStep's own strings (Teresa hint, empty state, placeholders) go
// through real t() calls with no defaultValue (see GenericDomainStep.tsx), so
// this opts in to the real shipped translation.json — see
// tests/setup.ts (global mock is intentionally key-agnostic) and
// src/test-utils/realTranslations.ts. The `isPolish` prop only controls the
// caller-supplied title/description text, not the component's own i18n
// language, so language is switched per test via vi.doMock + a fresh dynamic
// import (same pattern as KPITimeSeriesDrawer.a11y.test.tsx).
function mockI18n(lang: 'en' | 'pl') {
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({ t: createRealT(lang), i18n: { language: lang } }),
  }));
}

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

let GenericDomainStepImport: typeof import('../tools/Digital/GenericDomainStep');

async function loadComponent(lang: 'en' | 'pl') {
  vi.resetModules();
  mockI18n(lang);
  GenericDomainStepImport = await import('../tools/Digital/GenericDomainStep');
}

describe('GenericDomainStep', () => {
  beforeEach(() => {
    vi.doUnmock('react-i18next');
  });

  it('renders the domain title, description and Teresa assist hint', async () => {
    await loadComponent('en');
    const { GenericDomainStep } = GenericDomainStepImport;
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

  it('shows an empty state when no items exist', async () => {
    await loadComponent('en');
    const { GenericDomainStep } = GenericDomainStepImport;
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

  it('disables the Add button until a title is entered', async () => {
    await loadComponent('en');
    const { GenericDomainStep } = GenericDomainStepImport;
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

  it('renders Polish labels when isPolish is true', async () => {
    await loadComponent('pl');
    const { GenericDomainStep } = GenericDomainStepImport;
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

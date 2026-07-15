/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { ToolWizardShell } from '../../src/components/shared/ToolWizard/ToolWizardShell';
import type {
  WizardSessionData,
  WizardToolConfig,
} from '../../src/components/shared/ToolWizard/types';

const config: WizardToolConfig = {
  toolType: 'test-tool',
  toolName: { en: 'Test Tool', pl: 'Test Tool' },
  toolDescription: { en: 'Testing shell contract', pl: 'Testing shell contract' },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: [
    { id: 'define', label: { en: 'Define', pl: 'Okresl' } },
    { id: 'inputs', label: { en: 'Inputs', pl: 'Dane' } },
    { id: 'work', label: { en: 'Work', pl: 'Praca' } },
    { id: 'review', label: { en: 'Review', pl: 'Przeglad' } },
    { id: 'finalize', label: { en: 'Finalize', pl: 'Finalizacja' } },
    { id: 'outputs', label: { en: 'Outputs', pl: 'Wyniki' } },
  ],
  outputCapabilities: ['initiative', 'report', 'presentation', 'idea'],
};

const sessionData: WizardSessionData = {
  sessionId: 'session-1',
  toolType: 'test-tool',
  status: 'DRAFT',
  currentStep: 'define',
  define: {},
  inputs: {},
  assumptions: [],
  workData: null,
  review: {
    summaries: [],
    missingItems: [],
    aiSuggestions: [],
  },
  outputs: [],
  locked: false,
  createdAt: '2026-03-29T10:00:00.000Z',
  updatedAt: '2026-03-29T10:00:00.000Z',
};

function renderView() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ToolWizardShell
        config={config}
        sessionData={sessionData}
        onSessionUpdate={vi.fn()}
        onStepChange={vi.fn()}
        onFinalize={vi.fn()}
        onCreateOutput={vi.fn()}
        onBack={vi.fn()}
      />
    </I18nextProvider>,
  );
}

describe('ToolWizardShell canon runtime', () => {
  it('shows the governed runtime contract inside the session shell', () => {
    renderView();

    expect(screen.getByText('This session follows the canonical tools runtime')).toBeInTheDocument();
    expect(screen.getByText('AI works through propose / accept, not hidden mutation.')).toBeInTheDocument();
    expect(screen.getByText('Outputs remain linked to this session for downstream traceability.')).toBeInTheDocument();
    expect(screen.getByText('Promote into')).toBeInTheDocument();
    expect(screen.getByText('Initiative')).toBeInTheDocument();
  });
});

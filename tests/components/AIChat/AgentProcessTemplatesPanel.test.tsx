/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  agentTemplateLabel,
  AgentProcessTemplatesPanel,
} from '../../../src/components/AIChat/AgentProcessTemplatesPanel';

const listMock = vi.fn();
const transitionMock = vi.fn();
const instantiateMock = vi.fn();
const governanceMock = vi.fn();
const startIntakeMock = vi.fn();
const answerIntakeMock = vi.fn();
const convertIntakeMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    listAgentProcessTemplates: (...args: unknown[]) => listMock(...args),
    transitionAgentProcessTemplate: (...args: unknown[]) => transitionMock(...args),
    instantiateAgentProcessTemplate: (...args: unknown[]) => instantiateMock(...args),
    getAgentProcessTemplateGovernance: (...args: unknown[]) => governanceMock(...args),
  },
}));
vi.mock('@/services/api/v8/transformation-cases', () => ({
  TransformationCasesApi: {
    startPlanningIntakeFromTemplate: (...args: unknown[]) => startIntakeMock(...args),
    answerPlanningIntake: (...args: unknown[]) => answerIntakeMock(...args),
    convertTemplatePlanningIntake: (...args: unknown[]) => convertIntakeMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('AgentProcessTemplatesPanel', () => {
  it('localizes template lifecycle keys and humanizes unknown events', () => {
    expect(agentTemplateLabel('published', true)).toBe('Opublikowany');
    expect(agentTemplateLabel('deprecated', false)).toBe('Deprecated');
    expect(agentTemplateLabel('runtime_bundle_rotated', false)).toBe('Runtime bundle rotated');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue({
      data: [
        { id: 'draft-1', key: 'draft', title: 'Draft process', status: 'draft', version: 1 },
        {
          id: 'published-1',
          key: 'published',
          title: 'Published process',
          status: 'published',
          version: 3,
          usage_count: 2,
          has_planning_blueprint: true,
        },
      ],
    });
    transitionMock.mockResolvedValue({ data: {} });
    instantiateMock.mockResolvedValue({ data: { graphId: 'graph-1' } });
    governanceMock.mockResolvedValue({
      data: {
        versions: [
          {
            version: 3,
            status_at_version: 'PUBLISHED',
            change_notes: 'Finance specialist pinned',
            runtime_bundle_digest: '1234567890abcdef',
          },
        ],
        events: [{ event_id: 'event-1', version: 3, event_type: 'published', reason: 'QA passed' }],
      },
    });
    startIntakeMock.mockResolvedValue({
      data: {
        intakeId: 'intake-1',
        status: 'needs_clarification',
        mandate: 'Transform operations',
        measurableOutcomes: [],
        sponsor: null,
        scope: null,
        horizon: null,
        missingKeys: ['measurable_outcomes', 'sponsor', 'scope', 'horizon'],
        convertedCaseId: null,
        sourceTemplateId: 'published-1',
        sourceTemplateVersion: 3,
        sourceTemplateDigest: 'digest-template-v3',
        idempotentReplay: false,
      },
    });
    answerIntakeMock.mockResolvedValue({
      data: {
        intakeId: 'intake-1',
        status: 'ready',
        mandate: 'Transform operations',
        measurableOutcomes: ['Lead time 2 days'],
        sponsor: 'COO',
        scope: 'Operations',
        horizon: 'Q4',
        missingKeys: [],
        convertedCaseId: null,
        sourceTemplateId: 'published-1',
        sourceTemplateVersion: 3,
        sourceTemplateDigest: 'digest-template-v3',
        idempotentReplay: false,
      },
    });
    convertIntakeMock.mockResolvedValue({
      data: { transformationCaseId: 'case-1', planId: 'plan-1', canonicalRunId: 'run-1' },
    });
  });

  const renderPanel = () =>
    render(
      <MemoryRouter>
        <AgentProcessTemplatesPanel />
      </MemoryRouter>
    );

  it('loads governed versions and exposes actions matching template status', async () => {
    renderPanel();

    expect(await screen.findByText('Draft process')).toBeInTheDocument();
    expect(screen.getByText('Published process')).toBeInTheDocument();
    expect(screen.getByText('v3 · uses: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use for transformation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deprecate' })).toBeInTheDocument();
  });

  it('requires a governance reason before publishing', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('Approved by process owner');
    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(transitionMock).toHaveBeenCalledWith('draft-1', 'publish', 'Approved by process owner')
    );
  });

  it('pins a published planning template, clarifies inline, and creates a Case without a pasted run ID', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Use for transformation' }));
    expect(await screen.findByText('Transform operations')).toBeInTheDocument();
    expect(screen.queryByLabelText('Execution run ID')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Measurable outcomes'), {
      target: { value: 'Lead time 2 days' },
    });
    fireEvent.change(screen.getByLabelText('Sponsor'), { target: { value: 'COO' } });
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'Operations' } });
    fireEvent.change(screen.getByLabelText('Horizon'), { target: { value: 'Q4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete and create Case' }));
    await waitFor(() =>
      expect(answerIntakeMock).toHaveBeenCalledWith(
        'intake-1',
        expect.objectContaining({ sponsor: 'COO', scope: 'Operations', horizon: 'Q4' })
      )
    );
    await waitFor(() =>
      expect(convertIntakeMock).toHaveBeenCalledWith(
        'intake-1',
        'digest-template-v3',
        expect.any(String)
      )
    );
    expect(instantiateMock).not.toHaveBeenCalled();
  });

  it('reads immutable version and governance-event history', async () => {
    renderPanel();

    const historyButtons = await screen.findAllByRole('button', { name: 'History' });
    fireEvent.click(historyButtons[1]);

    expect(await screen.findByText(/Finance specialist pinned/)).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 1234567890ab/)).toBeInTheDocument();
    expect(screen.getByText(/Published · QA passed/)).toBeInTheDocument();
    expect(governanceMock).toHaveBeenCalledWith('published-1');
  });

  it('renders a persistent load error with keyboard-operable recovery', async () => {
    listMock.mockRejectedValueOnce(new Error('template service unavailable'));
    renderPanel();

    expect(await screen.findByText('Failed to load templates')).toBeInTheDocument();
    expect(screen.getByText('template service unavailable')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Try again' });
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.keyDown(retry, { key: 'Enter' });
    fireEvent.click(retry);
    expect(await screen.findByText('Draft process')).toBeInTheDocument();
  });

  it('fails closed for unauthorized template governance without a retry action', async () => {
    listMock.mockRejectedValueOnce(
      Object.assign(new Error('forbidden'), { response: { status: 403 } })
    );
    renderPanel();

    expect(await screen.findByText('Template governance access denied')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(transitionMock).not.toHaveBeenCalled();
    expect(startIntakeMock).not.toHaveBeenCalled();
  });
});

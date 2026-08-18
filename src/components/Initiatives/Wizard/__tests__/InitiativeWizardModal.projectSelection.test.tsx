/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
    i18n: { language: 'en', getFixedT: () => (key: string) => key },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const apiPost = vi.fn();
const apiPatch = vi.fn();
const createInitiativeWriteTruth = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    getProjects: vi.fn(async () => [
      { id: 'project-a', name: 'Project A' },
      { id: 'project-b', name: 'Project B' },
    ]),
    get: vi.fn(async () => ({ activeCount: 0, suggestedCount: 3, overload: 'green' })),
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
  },
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: { listInsights: vi.fn(async () => ({ insights: [] })) },
}));

vi.mock('@/services/initiativeWriteTruth', () => ({
  createInitiativeWriteTruth: (...args: unknown[]) => createInitiativeWriteTruth(...args),
}));

vi.mock('@/utils/initiativeDuplicateDetection', () => ({
  checkDuplicateInitiative: vi.fn(() => null),
}));

import { InitiativeWizardModal } from '../InitiativeWizardModal';

const candidate = {
  id: 'candidate-1',
  title: 'Governed initiative',
  problemStatement: 'Problem',
  opportunityStatement: 'Opportunity',
  rationale: 'Rationale',
  confidenceLevel: 'high',
  limits: [],
  impactScore: 4,
  effortScore: 2,
  riskScore: 2,
  timeToValueScore: 4,
  strategicFitScore: 4,
  suggestedKpi: 'KPI',
  initiativeLevel: 'standard',
  triageStatus: 'new_candidate',
  sourceRefs: [],
  evidenceRefs: [],
};

describe('InitiativeWizardModal project anchoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPost.mockImplementation(async (path: string) => {
      if (path === '/initiatives/wizard/sessions') return { session: { id: 'session-1' } };
      if (path.endsWith('/candidates/generate')) return { candidates: [candidate] };
      return {};
    });
    apiPatch.mockResolvedValue({
      candidate: { ...candidate, triageStatus: 'accepted_for_shortlist' },
    });
    createInitiativeWriteTruth.mockResolvedValue({
      createdId: 'initiative-1',
      truth: { initiative: { id: 'initiative-1', title: candidate.title, status: 'DRAFT' } },
    });
  });

  it('requires a project and propagates the same selected project through session and draft creation', async () => {
    render(
      <InitiativeWizardModal
        isOpen
        existingInitiatives={[]}
        language="en"
        onClose={() => {}}
        onCreated={() => {}}
      />
    );

    const projectPicker = await screen.findByLabelText('Project *');
    const generate = await screen.findByRole('button', { name: 'Generate candidates' });
    expect(generate).toBeDisabled();

    fireEvent.change(projectPicker, { target: { value: 'project-b' } });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);

    expect((await screen.findAllByText('Governed initiative')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Governance preview' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create drafts (1)' }));

    await waitFor(() => expect(createInitiativeWriteTruth).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith(
      '/initiatives/wizard/sessions',
      expect.objectContaining({ projectId: 'project-b' })
    );
    expect(createInitiativeWriteTruth).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-b' })
    );
  });
});

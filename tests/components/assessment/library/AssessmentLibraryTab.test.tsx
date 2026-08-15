/**
 * @vitest-environment jsdom
 *
 * ASM-001A — Task 2/3 coverage: AssessmentLibraryTab renders the published
 * DRD definition, keeps the accepted MVP scope free of unsupported promises,
 * Start creates an assessment bound to definitionId/definitionVersion
 * and navigates to the editor, and a 422 DEFINITION_NOT_PUBLISHED response is
 * surfaced (not swallowed into a false success).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDefinitionsMock, createAssessmentMock, navigateMock } = vi.hoisted(() => ({
  getDefinitionsMock: vi.fn(),
  createAssessmentMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/api/v8', () => ({
  V8AssessmentApi: {
    getDefinitions: getDefinitionsMock,
    createAssessment: createAssessmentMock,
  },
}));

import { AssessmentLibraryTab } from '../../../../src/components/assessment/library/AssessmentLibraryTab';

function publishedDrdVersion(overrides: Record<string, any> = {}) {
  return {
    id: 'asdef_drd_2.0',
    methodologyId: 'DRD',
    version: '2.0',
    title: 'DRD canonical definition',
    status: 'published',
    isReadOnly: true,
    definition: {},
    createdBy: 'user-123',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    publishedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('AssessmentLibraryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the accepted DRD scope with its published version', async () => {
    getDefinitionsMock.mockResolvedValue({
      methodologyId: 'DRD',
      versions: [
        publishedDrdVersion(),
        // An older draft should be ignored by "pick latest published".
        publishedDrdVersion({
          id: 'asdef_drd_1.0',
          version: '1.0',
          status: 'draft',
          publishedAt: undefined,
        }),
      ],
    });

    render(<AssessmentLibraryTab />);

    expect(await screen.findByText('Digital Readiness Diagnosis')).toBeInTheDocument();
    expect(await screen.findByText('Published v2.0')).toBeInTheDocument();

    expect(screen.queryByText('Smart Industry Readiness Index')).not.toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();

    const startButtons = screen.getAllByRole('button', { name: /Start/i });
    // DRD is the only advertised framework and is actionable.
    const enabled = startButtons.filter((b) => !(b as HTMLButtonElement).disabled);
    const disabled = startButtons.filter((b) => (b as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(1);
    expect(disabled).toHaveLength(0);
  });

  it('Start on DRD calls create with definitionId/definitionVersion and navigates to the new editor', async () => {
    getDefinitionsMock.mockResolvedValue({
      methodologyId: 'DRD',
      versions: [publishedDrdVersion()],
    });
    createAssessmentMock.mockResolvedValue({
      id: 'asm_new_1',
      assessment: { id: 'asm_new_1' },
    });

    render(<AssessmentLibraryTab />);

    await screen.findByText('Published v2.0');
    const startButtons = screen.getAllByRole('button', { name: /Start/i });
    const drdStart = startButtons.find((b) => !(b as HTMLButtonElement).disabled)!;
    fireEvent.click(drdStart);

    await waitFor(() => {
      expect(createAssessmentMock).toHaveBeenCalledTimes(1);
    });
    const payload = createAssessmentMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      assessmentType: 'DRD',
      definitionId: 'asdef_drd_2.0',
      definitionVersion: '2.0',
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/assessment/drd/asm_new_1');
    });
  });

  it('surfaces a 422 DEFINITION_NOT_PUBLISHED error instead of a false success', async () => {
    getDefinitionsMock.mockResolvedValue({
      methodologyId: 'DRD',
      versions: [publishedDrdVersion()],
    });
    const notPublishedError = Object.assign(new Error('Definition not published'), {
      status: 422,
      data: { code: 'DEFINITION_NOT_PUBLISHED' },
    });
    createAssessmentMock.mockRejectedValueOnce(notPublishedError);

    render(<AssessmentLibraryTab />);

    await screen.findByText('Published v2.0');
    const startButtons = screen.getAllByRole('button', { name: /Start/i });
    const drdStart = startButtons.find((b) => !(b as HTMLButtonElement).disabled)!;
    fireEvent.click(drdStart);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(navigateMock).not.toHaveBeenCalled();
    // Re-fetches the catalog after a stale-definition rejection.
    await waitFor(() => {
      expect(getDefinitionsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an inline error with retry when the definition catalog fails to load', async () => {
    getDefinitionsMock.mockRejectedValueOnce(new Error('network down'));

    render(<AssessmentLibraryTab />);

    expect(await screen.findByText('DRD definition catalog')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Could not connect to load the methodology catalog. Check your connection and try again.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('network down')).not.toBeInTheDocument();

    getDefinitionsMock.mockResolvedValueOnce({
      methodologyId: 'DRD',
      versions: [publishedDrdVersion()],
    });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Published v2.0')).toBeInTheDocument();
    });
  });
});

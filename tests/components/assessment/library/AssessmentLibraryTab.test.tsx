/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  navigate: vi.fn(),
  language: 'en',
}));

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useNavigate: () => mocks.navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: mocks.language } }),
}));

vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(() => 'toast'), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/method-core/api/methodCoreApi', () => {
  class MethodCoreApiError extends Error {
    status: number;
    body: any;
    isNetworkError: boolean;
    constructor(message: string, status = 0, body: any = null, isNetworkError = false) {
      super(message);
      this.status = status;
      this.body = body;
      this.isNetworkError = isNetworkError;
    }
  }
  return {
    MethodCoreApiError,
    createSession: mocks.create,
    getSession: mocks.get,
    newIdempotencyKey: () => 'stable-start-key',
  };
});

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';
import { AssessmentLibraryTab } from '../../../../src/components/assessment/library/AssessmentLibraryTab';

const canonicalSession = {
  id: 'session-exact-123',
  tenantId: 'tenant-1',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: '2.0.0-methodpack.1',
  state: 'active',
  version: 7,
  mode: 'guided_manual',
  projectId: null,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
};

describe('AssessmentLibraryTab canonical method-core flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.language = 'en';
    mocks.get.mockResolvedValue({ session: canonicalSession, roles: ['owner'] });
  });

  it('keeps Library pure: it shows frameworks but no canonical session register', () => {
    render(<AssessmentLibraryTab />);

    expect(screen.getByText('Digital Readiness Diagnosis')).toBeInTheDocument();
    expect(screen.queryByText('Your canonical DRD sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('session-exact-123')).not.toBeInTheDocument();
  });

  it('opens a readable methodology preview for available and coming-soon rows', () => {
    render(<AssessmentLibraryTab />);

    fireEvent.click(screen.getByText('Smart Industry Readiness Index'));
    expect(screen.getAllByText('Smart manufacturing')).toHaveLength(2);
    expect(screen.getByText('Knowledge available; execution coming soon')).toBeInTheDocument();
    expect(screen.getByText('Not configured in catalog')).toBeInTheDocument();
    expect(screen.getByText(/Process, technology and organization view/)).toBeInTheDocument();

    // Reading is available, but the unavailable framework must not acquire a
    // truthful-looking Start action inside the preview.
    expect(screen.queryByRole('button', { name: 'Start assessment' })).not.toBeInTheDocument();
  });

  it('retries an ambiguous create with the same idempotency key', async () => {
    mocks.create
      .mockRejectedValueOnce(new MethodCoreApiError('Offline', 0, null, true))
      .mockResolvedValueOnce({ session: canonicalSession });
    render(<AssessmentLibraryTab />);

    const start = screen
      .getAllByRole('button', { name: 'Start' })
      .find((button) => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0][1]).toBe('stable-start-key');
    expect(mocks.create.mock.calls[1][1]).toBe('stable-start-key');
    expect(mocks.navigate).toHaveBeenCalledWith('/assessment/drd/session-exact-123');
  });

  it.each([
    [404, 'not found during canonical readback'],
    [409, 'version or identity conflict'],
  ])('keeps the same create key across a %s canonical readback failure', async (status, copy) => {
    mocks.create.mockResolvedValue({ session: canonicalSession });
    mocks.get
      .mockRejectedValueOnce(
        new MethodCoreApiError('readback refused', status, { error: 'readback_refused' })
      )
      .mockResolvedValueOnce({ session: canonicalSession, roles: ['owner'] });
    render(<AssessmentLibraryTab />);

    const start = screen
      .getAllByRole('button', { name: 'Start' })
      .find((button) => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/assessment/drd/session-exact-123')
    );
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls.map((call) => call[1])).toEqual([
      'stable-start-key',
      'stable-start-key',
    ]);
  });

  it('renders the pure catalog controls in Polish and keeps non-DRD methods disabled', () => {
    mocks.language = 'pl';
    render(<AssessmentLibraryTab />);
    expect(screen.queryByText('Twoje kanoniczne sesje DRD')).not.toBeInTheDocument();
    expect(screen.getAllByText('Wkrótce')).toHaveLength(4);
    const startButtons = screen.getAllByRole('button', { name: 'Uruchom' });
    expect(startButtons.filter((button) => (button as HTMLButtonElement).disabled)).toHaveLength(4);
  });
});

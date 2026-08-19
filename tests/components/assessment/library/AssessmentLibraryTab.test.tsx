/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
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
    listSessions: mocks.list,
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
    mocks.list.mockResolvedValue({ sessions: [canonicalSession], total: 1 });
    mocks.get.mockResolvedValue({ session: canonicalSession, roles: ['owner'] });
  });

  it('lists and cold-opens the exact canonical session and pinned versions', async () => {
    render(<AssessmentLibraryTab />);

    expect(await screen.findByText('session-exact-123')).toBeInTheDocument();
    expect(screen.getByText('Method: 2.0.0-methodpack.1')).toBeInTheDocument();
    expect(screen.getByText('Session: v7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/assessment/drd/session-exact-123');
  });

  it('retries an ambiguous create with the same idempotency key', async () => {
    mocks.create
      .mockRejectedValueOnce(new MethodCoreApiError('Offline', 0, null, true))
      .mockResolvedValueOnce({ session: canonicalSession });
    render(<AssessmentLibraryTab />);
    await screen.findByText('session-exact-123');

    const start = screen.getAllByRole('button', { name: 'Start' }).find((button) => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create.mock.calls[0][1]).toBe('stable-start-key');
    expect(mocks.create.mock.calls[1][1]).toBe('stable-start-key');
    expect(mocks.navigate).toHaveBeenCalledWith('/assessment/drd/session-exact-123');
  });

  it('renders a durable fail-closed 403 with an explicit retry', async () => {
    mocks.list.mockRejectedValueOnce(new MethodCoreApiError('Forbidden', 403));
    render(<AssessmentLibraryTab />);
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have access');

    mocks.list.mockResolvedValueOnce({ sessions: [canonicalSession], total: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('session-exact-123')).toBeInTheDocument();
  });

  it.each([
    [404, 'not found during canonical readback'],
    [409, 'version or identity conflict'],
  ])('keeps the same create key across a %s canonical readback failure', async (status, copy) => {
    mocks.create.mockResolvedValue({ session: canonicalSession });
    mocks.get
      .mockRejectedValueOnce(new MethodCoreApiError('readback refused', status, { error: 'readback_refused' }))
      .mockResolvedValueOnce({ session: canonicalSession, roles: ['owner'] });
    render(<AssessmentLibraryTab />);
    await screen.findByText('session-exact-123');

    const start = screen.getAllByRole('button', { name: 'Start' }).find((button) => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent(copy);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/assessment/drd/session-exact-123'));
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls.map((call) => call[1])).toEqual(['stable-start-key', 'stable-start-key']);
  });

  it('renders the canonical session controls in Polish and keeps non-DRD methods disabled', async () => {
    mocks.language = 'pl';
    render(<AssessmentLibraryTab />);
    expect(await screen.findByText('Twoje kanoniczne sesje DRD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otwórz' })).toBeEnabled();
    expect(screen.getAllByText('Wkrótce')).toHaveLength(4);
    const startButtons = screen.getAllByRole('button', { name: 'Uruchom' });
    expect(startButtons.filter((button) => (button as HTMLButtonElement).disabled)).toHaveLength(4);
  });

  it('never silently truncates more than 100 sessions and loads the next deduplicated page', async () => {
    const firstPage = [
      ...Array.from({ length: 99 }, (_, index) => ({ ...canonicalSession, id: `session-${index}` })),
      { ...canonicalSession, id: 'tool-session-hidden', module: 'tools' },
    ];
    mocks.list
      .mockResolvedValueOnce({ sessions: firstPage, total: 101 })
      .mockResolvedValueOnce({ sessions: [{ ...canonicalSession, id: 'session-100' }], total: 101 });
    render(<AssessmentLibraryTab />);

    expect(await screen.findByText('Showing 99 DRD sessions; scanned 100 of 101')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('session-100')).toBeInTheDocument();
    expect(screen.queryByText('Showing 99 DRD sessions; scanned 100 of 101')).not.toBeInTheDocument();
    expect(mocks.list.mock.calls[1][0]).toMatchObject({ limit: 100, offset: 100 });
  });
});

/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null, key: 'test' }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key,
  }),
}));
vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(() => 'toast-1'), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/components/standard', () => ({
  StandardTable: (props: any) => {
    const actionColumn = props.columns.find((column: any) => column.id === 'actions');
    return <div>{actionColumn.render(props.data[0])}</div>;
  },
  StandardPreview: () => null,
}));
vi.mock('@/method-core/api/methodCoreApi', () => ({
  createSession: mocks.createSession,
  getSession: mocks.getSession,
  newIdempotencyKey: () => 'stable-retry-key',
  MethodCoreApiError: class extends Error {},
}));

import { AssessmentLibraryTab } from '../AssessmentLibraryTab';

describe('Assessment Library — offline retry state (Z-64)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSession
      .mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))
      .mockResolvedValueOnce({ session: { id: 'session-after-retry' } });
    mocks.getSession.mockResolvedValue({
      session: {
        id: 'session-after-retry',
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
      },
    });
  });

  it('mounts a canonical error state after an aborted request and retries with the same idempotency key', async () => {
    render(<AssessmentLibraryTab />);

    fireEvent.click(screen.getByTestId('library-start-DRD'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not start assessment');
    expect(alert).toHaveTextContent('The request was interrupted');
    const retry = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retry);

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledTimes(2));
    expect(mocks.createSession.mock.calls[0]?.[1]).toBe('stable-retry-key');
    expect(mocks.createSession.mock.calls[1]?.[1]).toBe('stable-retry-key');
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/assessment/drd/session-after-retry'));
  });
});

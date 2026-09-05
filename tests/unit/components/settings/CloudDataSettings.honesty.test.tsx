import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudDataSettings } from '@/components/settings/CloudDataSettings';

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

describe('CloudDataSettings OAuth honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((url: string) => {
      if (url === '/api/cloud/sources') return Promise.resolve({ sources: [] });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  async function openGoogleForm() {
    render(<CloudDataSettings />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add source' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Company Drive'), {
      target: { value: 'Company Drive' },
    });
    return screen.getByRole('button', { name: 'Connect' });
  }

  it('keeps Connect disabled and explains when Google Drive is not configured', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/api/cloud/sources') return Promise.resolve({ sources: [] });
      if (url === '/api/settings/integrations/oauth/status')
        return Promise.resolve({
          availability: { google_drive: { configured: false, approved: true, authType: 'oauth2' } },
          connected: [],
        });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const connect = await openGoogleForm();
    await waitFor(() => expect(connect).toBeDisabled());
    expect(screen.getByText('Integracja nieskonfigurowana')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('starts real OAuth and does not create a source when no token is connected', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/api/cloud/sources') return Promise.resolve({ sources: [] });
      if (url === '/api/settings/integrations/oauth/status')
        return Promise.resolve({
          availability: { google_drive: { configured: true, approved: true, authType: 'oauth2' } },
          connected: [],
        });
      if (url === '/api/settings/integrations/oauth/start/google_drive')
        return Promise.resolve({ authUrl: 'https://accounts.google.test/oauth' });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);

    const connect = await openGoogleForm();
    await waitFor(() => expect(connect).toBeEnabled());
    fireEvent.click(connect);

    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('/api/settings/integrations/oauth/start/google_drive')
    );
    expect(assign).toHaveBeenCalledWith('https://accounts.google.test/oauth');
    expect(postMock).not.toHaveBeenCalled();
    assign.mockRestore();
  });

  it('creates and reads back a named source only when OAuth is already connected', async () => {
    let sourceReads = 0;
    getMock.mockImplementation((url: string) => {
      if (url === '/api/settings/integrations/oauth/status')
        return Promise.resolve({
          availability: { google_drive: { configured: true, approved: true, authType: 'oauth2' } },
          connected: [{ connectorId: 'google_drive' }],
        });
      if (url === '/api/cloud/sources') {
        sourceReads += 1;
        return Promise.resolve({
          sources:
            sourceReads === 1
              ? []
              : [
                  {
                    id: 'source-1',
                    provider: 'google_drive',
                    name: 'Company Drive',
                    status: 'active',
                    createdAt: '2026-09-05T00:00:00.000Z',
                  },
                ],
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    postMock.mockResolvedValue({ source: { id: 'source-1' } });

    const connect = await openGoogleForm();
    await waitFor(() => expect(connect).toBeEnabled());
    fireEvent.click(connect);

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/cloud/sources', {
        provider: 'google_drive',
        name: 'Company Drive',
      })
    );
    expect(await screen.findByText('Company Drive')).toBeInTheDocument();
  });

  it('does not offer unsupported SharePoint as a connectable provider', async () => {
    await openGoogleForm();
    expect(screen.queryByRole('option', { name: /SharePoint/ })).toBeNull();
  });
});

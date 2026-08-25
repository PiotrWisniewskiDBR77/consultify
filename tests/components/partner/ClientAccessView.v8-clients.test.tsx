/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Real key -> real PL runtime value (verbatim from public/locales/pl/translation.json,
// partner.clientAccess.*), not the source's inline fallback argument. This decouples the
// test from whether ClientAccessView.tsx happens to pass a `t()` default value — see FIX-5:
// day 12 removed the English literal fallbacks (P.5 hygiene, the keys already resolve to
// real PL/EN values at runtime), and the previous version of this mock (`fallback ?? key`)
// broke the moment a call became `t('key')` with no second argument, because it fell back to
// returning the raw dotted key instead of real text.
const CLIENT_ACCESS_PL: Record<string, string> = {
  'partner.clientAccess.loadError': 'Nie udało się załadować danych',
  'partner.clientAccess.linkGenerated': 'Link dostępu wygenerowany!',
  'partner.clientAccess.featureSoon': 'Wkrótce dostępne',
  'partner.clientAccess.linkFailed': 'Nie udało się wygenerować linku',
  'partner.clientAccess.title': 'Menedżer dostępu klientów',
  'partner.clientAccess.subtitle':
    'Zarządzaj dostępem pracowników do kont klientów w jednym miejscu',
  'partner.clientAccess.clients': 'Klienci',
  'partner.clientAccess.employees': 'Pracownicy',
  'partner.clientAccess.getAccessLink': 'Pobierz link dostępu',
  'partner.clientAccess.generatedLink': 'Twój link dostępu jest gotowy:',
  'partner.clientAccess.allRegions': 'Wszystkie regiony',
  'partner.clientAccess.noClients': 'Nikogo tu nie ma',
  'partner.clientAccess.noClientsDesc': 'Nie masz dostępu do żadnego klienta.',
  'partner.clientAccess.employeesDesc':
    'Zarządzaj dostępem pracowników do kont klientów w jednym miejscu',
  'partner.clientAccess.employeeName': 'Imię i nazwisko',
  'partner.clientAccess.statusActive': 'Aktywny',
  'partner.clientAccess.statusDeactivated': 'Dezaktywowany',
  'partner.clientAccess.permissionSet': 'Zestaw uprawnień',
  'partner.clientAccess.totalClients': 'Łączna liczba klientów',
  'partner.clientAccess.col.status': 'Status',
  'partner.clientAccess.lastActive': 'Ostatnia aktywność',
  'partner.clientAccess.noEmployees': 'Brak członków zespołu',
  'partner.clientAccess.compliance': 'Zgodność',
  'partner.clientAccess.complianceDesc':
    'Wszystkie zmiany dostępu są rejestrowane zgodnie z domeną PMO RESOURCE_RESPONSIBILITY i mapowane na grupę przedmiotową zasobów ISO 21500 (klauzula 4.6).',
  'partner.clientAccess.userCount': '{{count}} użytkowników',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, ...rest: any[]) => {
      const options = rest.find((arg) => arg && typeof arg === 'object');
      const legacyFallback = rest.find((arg) => typeof arg === 'string');
      const template = CLIENT_ACCESS_PL[key] ?? legacyFallback ?? key;
      return options
        ? template.replace(/\{\{(\w+)\}\}/g, (_match: string, name: string) =>
            String(options[name] ?? '')
          )
        : template;
    },
    i18n: { language: 'pl' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getClients: vi.fn(),
    getEmployees: vi.fn(),
    getReferralTools: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';
import { ClientAccessView } from '@/views/partner/ClientAccessView';

describe('ClientAccessView partner clients seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PartnerApi.getEmployees).mockResolvedValue({ employees: [] } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/employees') {
        return { success: true, data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(Api.post).mockResolvedValue({ success: false } as any);
  });

  it('prefers governed partner clients before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({
      clients: [
        {
          id: 'org-1',
          organizationId: 'org-1',
          name: 'ACME GmbH',
          organizationName: 'ACME GmbH',
          clientName: 'ACME GmbH',
          status: 'active',
          accessLevel: 'referral link',
          users: 0,
          userCount: 0,
          projects: 0,
          assessmentScore: 0,
          industry: 'Unspecified',
          region: null,
          plan: null,
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('ACME GmbH')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getClients).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/clients');
  });

  it('falls back to legacy partner clients on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getClients).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/clients') {
        return {
          success: true,
          data: {
            data: [
              {
                id: 'org-2',
                name: 'Fallback Industries',
                status: 'active',
                industry: 'Unspecified',
                users: 0,
                projects: 0,
                assessmentScore: 0,
              },
            ],
          },
        } as any;
      }

      if (url === '/api/partners/employees') {
        return { success: true, data: [] } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Fallback Industries')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/clients');
  });

  it('prefers governed partner employees before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({ clients: [] } as any);
    vi.mocked(V8PartnerApi.getEmployees).mockResolvedValue({
      employees: [
        {
          id: 'user-1',
          employeeName: 'Alice Admin',
          email: 'alice@example.com',
          accessType: 'Admin',
          permissionSet: 'Admin',
          clientCount: null,
          status: 'ACTIVE',
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pracownicy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pracownicy'));

    await waitFor(() => {
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getEmployees).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/employees');
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it('falls back to legacy partner employees on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({ clients: [] } as any);
    vi.mocked(V8PartnerApi.getEmployees).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/employees') {
        return {
          success: true,
          data: [
            {
              id: 'user-2',
              employeeName: 'Fallback Member',
              email: 'fallback@example.com',
              accessType: 'Viewer',
              permissionSet: 'Viewer',
              status: 'ACTIVE',
            },
          ],
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pracownicy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pracownicy'));

    await waitFor(() => {
      expect(screen.getByText('Fallback Member')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/employees');
  });

  it('uses governed referral tools for access-link reads before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({ clients: [] } as any);
    vi.mocked(V8PartnerApi.getReferralTools).mockResolvedValue({
      tools: {
        referralCode: 'PARTNER-123',
        referralLink: 'https://example.com/r/PARTNER-123',
        referralLinkSlug: 'PARTNER-123',
        campaignLinks: [],
      },
    } as any);

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pobierz link dostępu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pobierz link dostępu'));

    await waitFor(() => {
      expect(screen.getByText('https://example.com/r/PARTNER-123')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getReferralTools).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/referral-tools');
    expect(Api.post).not.toHaveBeenCalledWith('/api/partners/access-links', {});
  });

  it('falls back to legacy referral tools for bounded access-link compatibility errors', async () => {
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({ clients: [] } as any);
    vi.mocked(V8PartnerApi.getReferralTools).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/employees') {
        return { success: true, data: [] } as any;
      }
      if (url === '/api/partners/referral-tools') {
        return {
          success: true,
          data: {
            referralLink: 'https://example.com/r/FALLBACK-123',
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pobierz link dostępu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Pobierz link dostępu'));

    await waitFor(() => {
      expect(screen.getByText('https://example.com/r/FALLBACK-123')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/referral-tools');
    expect(Api.post).not.toHaveBeenCalledWith('/api/partners/access-links', {});
  });
});

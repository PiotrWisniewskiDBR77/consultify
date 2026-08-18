/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tMock = (_key: string, fallback?: string) => fallback || _key;

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getAttributions: vi.fn(),
    deleteCampaignLink: vi.fn(),
    getReferralAnalytics: vi.fn(),
    getReferralTools: vi.fn(),
    createCampaignLink: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { ReferralToolsSection } from '@/views/partner/sections/ReferralToolsSection';
import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';

describe('ReferralToolsSection V8 campaign create seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue({
      success: true,
      data: {
        referralCode: 'PARTNER-123',
        referralLink: 'https://example.com/r/PARTNER-123',
        referralLinkSlug: 'PARTNER-123',
        campaignLinks: [
          {
            id: 'campaign-1',
            name: 'Spring launch',
            slug: 'spring-launch',
            fullUrl: 'https://example.com/?c=spring-launch',
            clickCount: 0,
            signupCount: 0,
            conversionCount: 0,
            isActive: true,
            createdAt: '2026-03-26T10:00:00.000Z',
          },
        ],
      },
    } as any);
    vi.mocked(V8PartnerApi.getReferralAnalytics).mockResolvedValue({
      analytics: {
        totalClicks: 42,
        uniqueClicks: 30,
        signups: 8,
        trials: 5,
        paidCustomers: 3,
        conversionRate: 10,
        clicksByDay: [],
        clicksBySource: [],
      },
      days: 30,
    } as any);
    vi.mocked(V8PartnerApi.getAttributions).mockResolvedValue({
      attributions: [],
    } as any);
    vi.mocked(V8PartnerApi.getReferralTools).mockResolvedValue({
      tools: {
        referralCode: 'PARTNER-123',
        referralLink: 'https://example.com/r/PARTNER-123',
        referralLinkSlug: 'PARTNER-123',
        campaignLinks: [
          {
            id: 'campaign-1',
            name: 'Spring launch',
            slug: 'spring-launch',
            fullUrl: 'https://example.com/?c=spring-launch',
            clickCount: 0,
            signupCount: 0,
            conversionCount: 0,
            isActive: true,
            createdAt: '2026-03-26T10:00:00.000Z',
          },
        ],
      },
    } as any);
  });

  it('prefers governed referral-tools read before legacy fallback', async () => {
    render(<ReferralToolsSection subsection="referral-tools" />);

    await waitFor(() => {
      expect(screen.getByText('PARTNER-123')).toBeInTheDocument();
      expect(screen.getByText('Spring launch')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getReferralTools).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/referral-tools');
  });

  it('falls back to legacy referral-tools read on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getReferralTools).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/referral-tools') {
        return {
          success: true,
          data: {
            referralCode: 'LEGACY-456',
            referralLink: 'https://example.com/r/LEGACY-456',
            referralLinkSlug: 'LEGACY-456',
            campaignLinks: [],
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<ReferralToolsSection subsection="referral-tools" />);

    await waitFor(() => {
      expect(screen.getByText('LEGACY-456')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/referral-tools');
  });

  it('prefers governed referred-customer list before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getAttributions).mockResolvedValue({
      attributions: [
        {
          id: 'attr-1',
          organizationId: 'org-1',
          organizationName: 'ACME GmbH',
          attributionType: 'REFERRAL_LINK',
          signupCompletedAt: '2026-03-11',
          firstPaymentAt: '2026-03-22',
          lifetimeValue: 12000,
          totalCommissionEarned: 120,
          commissionRatePercent: 15,
          commissionDurationMonths: 12,
          status: 'ACTIVE',
          attributedAt: '2026-03-10',
        },
      ],
    } as any);

    render(<ReferralToolsSection subsection="referred-organizations" />);

    await waitFor(() => {
      expect(screen.getByText('ACME GmbH')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('2026-03-11')).toBeInTheDocument();
      expect(screen.getByText('2026-03-22')).toBeInTheDocument();
      expect(screen.getByText('15%')).toBeInTheDocument();
      expect(screen.getByText('12 months')).toBeInTheDocument();
      expect(screen.getByText('€12,000')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getAttributions).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/attributions');
  });

  it('falls back to legacy referred-customer list on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getAttributions).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/referral-tools') {
        return {
          success: true,
          data: {
            referralCode: 'PARTNER-123',
            referralLink: 'https://example.com/r/PARTNER-123',
            referralLinkSlug: 'PARTNER-123',
            campaignLinks: [],
          },
        } as any;
      }
      if (url === '/api/partners/attributions') {
        return {
          success: true,
          data: {
            items: [
              {
                id: 'attr-legacy-1',
                organizationId: 'org-legacy-1',
                organizationName: 'Legacy Customer',
                attributionType: 'PROMO_CODE',
                signupCompletedAt: '2026-02-21',
                firstPaymentAt: null,
                lifetimeValue: 2500,
                totalCommissionEarned: 0,
                commissionRatePercent: 10,
                commissionDurationMonths: 6,
                status: 'PENDING',
                attributedAt: '2026-02-20',
              },
            ],
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<ReferralToolsSection subsection="referred-organizations" />);

    await waitFor(() => {
      expect(screen.getByText('Legacy Customer')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('2026-02-21')).toBeInTheDocument();
      expect(screen.getAllByText('10%').length).toBeGreaterThan(0);
      expect(screen.getByText('6 months')).toBeInTheDocument();
      expect(screen.getByText('€2,500')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/attributions');
  });

  it('prefers governed campaign creation before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.createCampaignLink).mockResolvedValue({
      campaignLink: {
        id: 'campaign-1',
        name: 'Spring launch',
        slug: 'spring-launch',
      },
    } as any);

    render(<ReferralToolsSection subsection="referral-tools" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Campaign' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g., LinkedIn Q1')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., LinkedIn Q1'), {
      target: { value: 'Spring launch' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await waitFor(() => {
      expect(V8PartnerApi.createCampaignLink).toHaveBeenCalledWith({
        name: 'Spring launch',
        utmSource: undefined,
        utmMedium: undefined,
        utmCampaign: undefined,
      });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/partners/campaign-links', expect.anything());
  });

  it('fails closed without legacy campaign creation on governed writer errors', async () => {
    vi.mocked(V8PartnerApi.createCampaignLink).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({
      success: true,
      data: { id: 'campaign-legacy-1' },
    } as any);

    render(<ReferralToolsSection subsection="referral-tools" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Campaign' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g., LinkedIn Q1')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., LinkedIn Q1'), {
      target: { value: 'Spring launch' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await waitFor(() => expect(V8PartnerApi.createCampaignLink).toHaveBeenCalled());
    expect(Api.post).not.toHaveBeenCalledWith('/api/partners/campaign-links', expect.anything());
  });

  it('prefers governed campaign deletion before legacy fallback', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(V8PartnerApi.deleteCampaignLink).mockResolvedValue({
      success: true,
      deleted: 'campaign-1',
    } as any);

    render(<ReferralToolsSection subsection="referral-tools" />);

    await waitFor(() => {
      expect(screen.getByText('Spring launch')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle('Actions'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    });

    await waitFor(() => {
      expect(V8PartnerApi.deleteCampaignLink).toHaveBeenCalledWith('campaign-1');
    });

    expect(Api.delete).not.toHaveBeenCalledWith('/api/partners/campaign-links/campaign-1');
  });

  it('fails closed without legacy campaign deletion on governed writer errors', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(V8PartnerApi.deleteCampaignLink).mockRejectedValue({ status: 404 });
    vi.mocked(Api.delete).mockResolvedValue({ success: true } as any);

    render(<ReferralToolsSection subsection="referral-tools" />);

    await waitFor(() => {
      expect(screen.getByText('Spring launch')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle('Actions'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    });

    await waitFor(() => expect(V8PartnerApi.deleteCampaignLink).toHaveBeenCalledWith('campaign-1'));
    expect(Api.delete).not.toHaveBeenCalledWith('/api/partners/campaign-links/campaign-1');
  });
});

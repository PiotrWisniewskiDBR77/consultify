import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Delete: vi.fn(),
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { shouldFallbackToLegacyPartner, V8PartnerApi } from '@/services/api/v8/partner';
import { v8Delete, v8Get, v8Post, v8Put } from '@/services/api/v8/client';

describe('V8PartnerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests partner referral analytics from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      analytics: {
        totalClicks: 12,
        uniqueClicks: 9,
        signups: 3,
        trials: 2,
        paidCustomers: 1,
        conversionRate: 11.1,
        clicksByDay: [],
        clicksBySource: [],
      },
      days: 30,
    });

    const data = await V8PartnerApi.getReferralAnalytics();

    expect(v8Get).toHaveBeenCalledWith('/partner/referral-analytics', { days: '30' });
    expect(data.analytics.totalClicks).toBe(12);
  });

  it('requests partner earnings summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      earnings: {
        totalEarned: 1000,
        totalPending: 150,
        totalApproved: 700,
        totalPaid: 300,
        thisMonth: 80,
        thisMonthCount: 2,
        lastMonth: 60,
        readyForPayout: 120,
        currency: 'EUR',
      },
    });

    const data = await V8PartnerApi.getEarningsSummary();

    expect(v8Get).toHaveBeenCalledWith('/partner/earnings-summary');
    expect(data.earnings.readyForPayout).toBe(120);
  });

  it('requests partner payout from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      payout: {
        id: 'payout-1',
        status: 'requested',
        netAmount: 148.5,
        currency: 'EUR',
      },
    });

    const data = await V8PartnerApi.requestPayout({ notes: 'Please process this cycle' });

    expect(v8Post).toHaveBeenCalledWith('/partner/payouts/request', {
      notes: 'Please process this cycle',
    });
    expect(data.payout.id).toBe('payout-1');
  });

  it('requests campaign-link creation from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      campaignLink: {
        id: 'campaign-1',
        name: 'Spring launch',
        slug: 'spring-launch',
      },
    });

    const data = await V8PartnerApi.createCampaignLink({
      name: 'Spring launch',
      utmSource: 'newsletter',
    });

    expect(v8Post).toHaveBeenCalledWith('/partner/campaign-links', {
      name: 'Spring launch',
      utmSource: 'newsletter',
    });
    expect(data.campaignLink.id).toBe('campaign-1');
  });

  it('requests campaign-link deletion from the V8 namespace', async () => {
    vi.mocked(v8Delete).mockResolvedValue({
      success: true,
      deleted: 'campaign-1',
    });

    const data = await V8PartnerApi.deleteCampaignLink('campaign-1');

    expect(v8Delete).toHaveBeenCalledWith('/partner/campaign-links/campaign-1');
    expect(data.deleted).toBe('campaign-1');
  });

  it('requests organization updates from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      success: true,
      message: 'Organization updated successfully',
    });

    const data = await V8PartnerApi.updateOrganization({
      name: 'Test Partner Co',
      contactEmail: 'partner@example.com',
      taxId: 'DE123456789',
      contactPhone: '+49 30 12345',
      website: 'https://test.example.com',
    });

    expect(v8Put).toHaveBeenCalledWith('/partner/organization', {
      name: 'Test Partner Co',
      contactEmail: 'partner@example.com',
      taxId: 'DE123456789',
      contactPhone: '+49 30 12345',
      website: 'https://test.example.com',
    });
    expect(data.message).toBe('Organization updated successfully');
  });

  it('requests specialization updates from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      success: true,
      message: 'Specializations updated successfully',
    });

    const data = await V8PartnerApi.updateOrganizationSpecializations({
      specializations: ['DRD', 'SIRI'],
    });

    expect(v8Put).toHaveBeenCalledWith('/partner/organization/specializations', {
      specializations: ['DRD', 'SIRI'],
    });
    expect(data.message).toBe('Specializations updated successfully');
  });

  it('requests region updates from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      success: true,
      message: 'Regions updated successfully',
    });

    const data = await V8PartnerApi.updateOrganizationRegions({
      regions: ['DACH', 'CEE'],
    });

    expect(v8Put).toHaveBeenCalledWith('/partner/organization/regions', {
      regions: ['DACH', 'CEE'],
    });
    expect(data.message).toBe('Regions updated successfully');
  });

  it('requests public-listing updates from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      success: true,
      publicListingEnabled: true,
    });

    const data = await V8PartnerApi.updateOrganizationListing({ publicListingEnabled: true });

    expect(v8Put).toHaveBeenCalledWith('/partner/organization/listing', {
      publicListingEnabled: true,
    });
    expect(data.publicListingEnabled).toBe(true);
  });

  it('falls back to legacy partner routes only for bounded compatibility statuses', () => {
    expect(shouldFallbackToLegacyPartner({ status: 404 })).toBe(true);
    expect(shouldFallbackToLegacyPartner({ status: 501 })).toBe(true);
    expect(shouldFallbackToLegacyPartner({ status: 500 })).toBe(false);
  });
});

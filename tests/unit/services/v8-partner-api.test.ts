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

  it('requests connection state from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ connected: false, selfConnectEnabled: false });

    const data = await V8PartnerApi.getConnection();

    expect(v8Get).toHaveBeenCalledWith('/partner/connection');
    expect(data.connected).toBe(false);
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

  it('requests partner attributions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      attributions: [
        {
          id: 'attr-1',
          organizationId: 'org-1',
          organizationName: 'ACME GmbH',
          status: 'ACTIVE',
        },
      ],
    });

    const data = await V8PartnerApi.getAttributions();

    expect(v8Get).toHaveBeenCalledWith('/partner/attributions');
    expect(data.attributions[0].id).toBe('attr-1');
  });

  it('requests partner clients from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      clients: [
        {
          id: 'org-1',
          organizationId: 'org-1',
          name: 'ACME GmbH',
          organizationName: 'ACME GmbH',
          clientName: 'ACME GmbH',
          status: 'active',
        },
      ],
    });

    const data = await V8PartnerApi.getClients();

    expect(v8Get).toHaveBeenCalledWith('/partner/clients');
    expect(data.clients[0].id).toBe('org-1');
  });

  it('requests partner projects from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      projects: [
        {
          id: 'project-1',
          name: 'Digital Transformation',
          clientId: 'org-1',
          clientName: 'ACME GmbH',
          framework: 'PMBOK',
          progress: 35,
          status: 'active',
        },
      ],
    });

    const data = await V8PartnerApi.getProjects();

    expect(v8Get).toHaveBeenCalledWith('/partner/projects');
    expect(data.projects[0].id).toBe('project-1');
  });

  it('requests partner employees from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
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
    });

    const data = await V8PartnerApi.getEmployees();

    expect(v8Get).toHaveBeenCalledWith('/partner/employees');
    expect(data.employees[0].id).toBe('user-1');
  });

  it('requests partner referral tools from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      tools: {
        referralCode: 'PARTNER-123',
        referralLink: 'https://example.com/r/PARTNER-123',
        referralLinkSlug: 'PARTNER-123',
        qrCodeUrl: null,
        campaignLinks: [],
      },
    });

    const data = await V8PartnerApi.getReferralTools();

    expect(v8Get).toHaveBeenCalledWith('/partner/referral-tools');
    expect(data.tools.referralCode).toBe('PARTNER-123');
  });

  it('requests partner onboarding status from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'professional',
        paymentSetup: false,
        completed: false,
      },
    });

    const data = await V8PartnerApi.getOnboardingStatus();

    expect(v8Get).toHaveBeenCalledWith('/partner/onboarding-status');
    expect(data.status.pricingTier).toBe('professional');
  });

  it('requests partner onboarding legal acceptance from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      message: 'Terms accepted',
    });

    const data = await V8PartnerApi.acceptOnboardingTerms({
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    expect(v8Post).toHaveBeenCalledWith('/partner/onboarding/accept-terms', {
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });
    expect(data.success).toBe(true);
  });

  it('requests partner onboarding pricing-tier selection from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      tier: 'professional',
      message: 'Pricing tier selected',
    });

    const data = await V8PartnerApi.selectOnboardingTier({
      tier: 'professional',
    });

    expect(v8Post).toHaveBeenCalledWith('/partner/onboarding/select-tier', {
      tier: 'professional',
    });
    expect(data.tier).toBe('professional');
  });

  it('requests partner onboarding completion from the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({
      success: true,
      message: 'Onboarding completed!',
    });

    const data = await V8PartnerApi.completeOnboarding();

    expect(v8Post).toHaveBeenCalledWith('/partner/onboarding/complete', {});
    expect(data.success).toBe(true);
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

  it('requests partner commission transactions from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      transactions: [
        {
          id: 'tx-1',
          organizationName: 'ACME GmbH',
          transactionType: 'RECURRING',
          status: 'APPROVED',
        },
      ],
    });

    const data = await V8PartnerApi.getCommissionTransactions();

    expect(v8Get).toHaveBeenCalledWith('/partner/commission-transactions');
    expect(data.transactions[0].id).toBe('tx-1');
  });

  it('requests partner payout history from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      payouts: [
        {
          id: 'payout-1',
          status: 'COMPLETED',
          netAmount: 148.5,
          transactionCount: 3,
        },
      ],
    });

    const data = await V8PartnerApi.getPayouts();

    expect(v8Get).toHaveBeenCalledWith('/partner/payouts');
    expect(data.payouts[0].id).toBe('payout-1');
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

  it('requests payout-settings reads from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      settings: {
        minimumThreshold: 250,
        payoutMethod: 'BANK_TRANSFER',
        autoPayoutEnabled: true,
        payoutAccount: {
          accountHolderName: 'Partner Co',
          iban: 'DE123',
          bicSwift: 'COBADEFF',
          bankName: 'Commerzbank',
        },
      },
    });

    const data = await V8PartnerApi.getPayoutSettings();

    expect(v8Get).toHaveBeenCalledWith('/partner/payout-settings');
    expect(data.settings.minimumThreshold).toBe(250);
  });

  it('requests payout-settings updates from the V8 namespace', async () => {
    vi.mocked(v8Put).mockResolvedValue({
      success: true,
      settings: {
        minimumThreshold: 500,
        payoutMethod: 'PAYPAL',
        autoPayoutEnabled: false,
        payoutAccount: null,
      },
    });

    const data = await V8PartnerApi.updatePayoutSettings({
      minimumThreshold: 500,
      payoutMethod: 'PAYPAL',
      autoPayoutEnabled: false,
      payoutAccount: null,
    });

    expect(v8Put).toHaveBeenCalledWith('/partner/payout-settings', {
      minimumThreshold: 500,
      payoutMethod: 'PAYPAL',
      autoPayoutEnabled: false,
      payoutAccount: null,
    });
    expect(data.settings.payoutMethod).toBe('PAYPAL');
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

  it('never falls back from the canonical V8 partner contract', () => {
    expect(shouldFallbackToLegacyPartner({ status: 404 })).toBe(false);
    expect(shouldFallbackToLegacyPartner({ status: 501 })).toBe(false);
    expect(shouldFallbackToLegacyPartner({ status: 500 })).toBe(false);
  });
});

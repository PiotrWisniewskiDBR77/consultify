import { v8Delete, v8Get, v8Post, v8Put } from './client';

export interface V8PartnerReferralAnalytics {
  totalClicks: number;
  uniqueClicks: number;
  signups: number;
  trials: number;
  paidCustomers: number;
  conversionRate: number;
  clicksByDay: { date: string; clicks: number }[];
  clicksBySource: { source: string; clicks: number }[];
}

export interface V8PartnerEarningsSummary {
  totalEarned: number;
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  thisMonth: number;
  thisMonthCount: number;
  lastMonth: number;
  readyForPayout: number;
  currency: string;
  lifecyclePhase?: string;
  whatNext?: string[];
  hold?: { amount: number; reasonCode?: string | null; note?: string | null } | null;
  degraded?: { reason: string; snapshotAt: string };
}

export interface V8PartnerProgramStatus {
  lifecyclePhase: 'onboard' | 'activate' | 'earn' | 'payout';
  partnerOrganizationStatus?: string | null;
  onboardChecklist?: Record<string, unknown>;
  payoutSettingsComplete: boolean;
  balances: {
    grossEarned: number;
    paidOut: number;
    heldAmount: number;
    availableToPayout: number;
    currency: string;
  };
  whatNext: string[];
  hold: { amount: number; reasonCode?: string | null; note?: string | null } | null;
  degraded?: { reason: string; snapshotAt: string };
}

export interface V8PartnerPayoutRequestPayload {
  payoutAccountId?: string;
  notes?: string;
  amount?: number;
}

export interface V8PartnerPayoutRequestResult {
  id: string;
  status?: string;
  netAmount?: number;
  grossAmount?: number;
  currency?: string;
}

export interface V8PartnerPayoutRequestResponse {
  payout: V8PartnerPayoutRequestResult;
  lifecyclePhase: string;
  balances: V8PartnerProgramStatus['balances'];
  whatNext: string[];
  hold: V8PartnerProgramStatus['hold'];
  error?: string;
}

export interface V8PartnerPayoutHistoryItem {
  id: string;
  status: string;
  netAmount?: number;
  grossAmount?: number;
  transactionCount?: number;
  periodStart?: string;
  periodEnd?: string;
  completedAt?: string | null;
  currency?: string;
}

export interface V8PartnerCommissionTransaction {
  id: string;
  partnerOrgId: string;
  organizationId: string;
  organizationName?: string;
  transactionType: string;
  transactionDate: string;
  grossAmount?: number;
  commissionRate?: number;
  commissionAmount?: number;
  currency?: string;
  status: string;
  approvedAt?: string;
  payoutId?: string;
  createdAt?: string;
}

export interface V8PartnerAttribution {
  id: string;
  partnerOrgId: string;
  organizationId: string;
  organizationName?: string;
  attributionType: string;
  referralCodeUsed?: string;
  signupCompletedAt?: string;
  firstPaymentAt?: string;
  lifetimeValue?: number;
  totalCommissionEarned?: number;
  commissionRatePercent?: number;
  commissionDurationMonths?: number;
  status: string;
  attributedAt: string;
  createdAt?: string;
}

export interface V8PartnerReferralToolsCampaignLink {
  id: string;
  name: string;
  slug: string;
  fullUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickCount?: number;
  signupCount?: number;
  conversionCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface V8PartnerReferralTools {
  referralCode: string;
  referralLink: string;
  referralLinkSlug: string;
  qrCodeUrl?: string | null;
  campaignLinks: V8PartnerReferralToolsCampaignLink[];
}

export interface V8PartnerOnboardingStatus {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  pricingTier: string | null;
  paymentSetup: boolean;
  completed: boolean;
}

export interface V8PartnerClient {
  id: string;
  organizationId: string;
  name: string;
  organizationName: string;
  clientName: string;
  status: 'active' | 'onboarding' | 'inactive';
  accessLevel: string;
  users: number;
  userCount: number;
  projects: number;
  assessmentScore: number;
  industry: string;
  region: string | null;
  plan: string | null;
  onboardedAt?: string;
  contractValue?: number;
  lifetimeValue?: number;
  totalCommissionEarned?: number;
}

export interface V8PartnerProject {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  framework: string;
  progress: number;
  status: string;
  startDate?: string;
  targetEndDate?: string;
}

export interface V8PartnerEmployee {
  id: string;
  employeeName: string;
  email: string;
  accessType: string;
  permissionSet?: string;
  clients?: string[];
  clientCount?: number | null;
  status: string;
  lastActive?: string;
}

export interface V8PartnerOnboardingAcceptTermsPayload {
  termsVersion?: string;
  privacyVersion?: string;
}

export interface V8PartnerOnboardingAcceptTermsResult {
  success: boolean;
  message: string;
}

export interface V8PartnerOnboardingSelectTierPayload {
  tier: 'starter' | 'professional' | 'enterprise';
}

export interface V8PartnerOnboardingSelectTierResult {
  success: boolean;
  tier: string;
  message: string;
}

export interface V8PartnerOnboardingCompleteResult {
  success: boolean;
  message: string;
}

export interface V8PartnerCampaignCreatePayload {
  name: string;
  description?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  destinationUrl?: string;
}

export interface V8PartnerCampaignLink {
  id: string;
  name: string;
  slug: string;
  fullUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickCount?: number;
  signupCount?: number;
  conversionCount?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface V8PartnerCampaignDeleteResult {
  success: boolean;
  deleted: string;
}

export interface V8PartnerOrganizationUpdatePayload {
  name: string;
  taxId?: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
}

export interface V8PartnerOrganizationUpdateResult {
  success: boolean;
  message: string;
}

export interface V8PartnerSpecializationsUpdatePayload {
  specializations: string[];
}

export interface V8PartnerSpecializationsUpdateResult {
  success: boolean;
  message: string;
}

export interface V8PartnerRegionsUpdatePayload {
  regions: string[];
}

export interface V8PartnerRegionsUpdateResult {
  success: boolean;
  message: string;
}

export interface V8PartnerListingUpdatePayload {
  publicListingEnabled: boolean;
}

export interface V8PartnerListingUpdateResult {
  success: boolean;
  publicListingEnabled: boolean;
}

export interface V8PartnerPayoutAccount {
  accountHolderName: string;
  iban: string;
  bicSwift: string;
  bankName: string;
}

export interface V8PartnerPayoutSettings {
  minimumThreshold: number;
  payoutMethod: 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'WISE';
  autoPayoutEnabled: boolean;
  payoutAccount: V8PartnerPayoutAccount | null;
}

export interface V8PartnerPayoutSettingsUpdatePayload {
  minimumThreshold: number;
  payoutMethod: 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE' | 'WISE';
  autoPayoutEnabled: boolean;
  payoutAccount: V8PartnerPayoutAccount | null;
}

export const isPartnerLegacyRollbackEnabled = (): boolean =>
  String(import.meta.env.VITE_PARTNER_LEGACY_ROLLBACK_ENABLED || '').toLowerCase() === 'true';

export const shouldFallbackToLegacyPartner = (error: unknown): boolean => {
  // Cutover default: V8 failures stay visible and never silently execute a
  // legacy writer/read. The bounded rollback is explicit, build-time visible
  // and independently mirrored by PARTNER_LEGACY_ROLLBACK_ENABLED server-side.
  if (!isPartnerLegacyRollbackEnabled()) return false;
  const directStatus = Number((error as { status?: number })?.status);
  const nestedStatus = Number((error as { response?: { status?: number } })?.response?.status);
  const status = Number.isFinite(directStatus) && directStatus > 0 ? directStatus : nestedStatus;
  const data =
    (error as { data?: { code?: string } })?.data ||
    (error as { response?: { data?: { code?: string } } })?.response?.data;
  const code = String(data?.code || '').toUpperCase();
  if (status === 403 && code === 'PARTNER_ORG_REQUIRED') {
    return true;
  }
  return [400, 404, 405, 501].includes(status);
};

export const V8PartnerApi = {
  getReferralAnalytics: (days = 30) =>
    v8Get<{ analytics: V8PartnerReferralAnalytics; days: number }>('/partner/referral-analytics', {
      days: String(days),
    }),
  getClients: () => v8Get<{ clients: V8PartnerClient[] }>('/partner/clients'),
  getProjects: () => v8Get<{ projects: V8PartnerProject[] }>('/partner/projects'),
  getEmployees: () => v8Get<{ employees: V8PartnerEmployee[] }>('/partner/employees'),
  getOnboardingStatus: () =>
    v8Get<{ status: V8PartnerOnboardingStatus }>('/partner/onboarding-status'),
  getProgramStatus: () => v8Get<V8PartnerProgramStatus>('/partner/program/status'),
  acceptOnboardingTerms: (body: V8PartnerOnboardingAcceptTermsPayload = {}) =>
    v8Post<V8PartnerOnboardingAcceptTermsResult>('/partner/onboarding/accept-terms', body),
  selectOnboardingTier: (body: V8PartnerOnboardingSelectTierPayload) =>
    v8Post<V8PartnerOnboardingSelectTierResult>('/partner/onboarding/select-tier', body),
  completeOnboarding: () =>
    v8Post<V8PartnerOnboardingCompleteResult>('/partner/onboarding/complete', {}),
  getReferralTools: () => v8Get<{ tools: V8PartnerReferralTools }>('/partner/referral-tools'),
  getEarningsSummary: () =>
    v8Get<{ earnings: V8PartnerEarningsSummary }>('/partner/earnings-summary'),
  getAttributions: () => v8Get<{ attributions: V8PartnerAttribution[] }>('/partner/attributions'),
  getCommissionTransactions: () =>
    v8Get<{ transactions: V8PartnerCommissionTransaction[] }>('/partner/commission-transactions'),
  getPayouts: () => v8Get<{ payouts: V8PartnerPayoutHistoryItem[] }>('/partner/payouts'),
  requestPayout: (body: V8PartnerPayoutRequestPayload = {}) =>
    v8Post<V8PartnerPayoutRequestResponse>('/partner/payouts/request', body),
  createCampaignLink: (body: V8PartnerCampaignCreatePayload) =>
    v8Post<{ campaignLink: V8PartnerCampaignLink }>('/partner/campaign-links', body),
  deleteCampaignLink: (campaignId: string) =>
    v8Delete<V8PartnerCampaignDeleteResult>(`/partner/campaign-links/${campaignId}`),
  updateOrganization: (body: V8PartnerOrganizationUpdatePayload) =>
    v8Put<V8PartnerOrganizationUpdateResult>('/partner/organization', body),
  updateOrganizationSpecializations: (body: V8PartnerSpecializationsUpdatePayload) =>
    v8Put<V8PartnerSpecializationsUpdateResult>('/partner/organization/specializations', body),
  updateOrganizationRegions: (body: V8PartnerRegionsUpdatePayload) =>
    v8Put<V8PartnerRegionsUpdateResult>('/partner/organization/regions', body),
  updateOrganizationListing: (body: V8PartnerListingUpdatePayload) =>
    v8Put<V8PartnerListingUpdateResult>('/partner/organization/listing', body),
  getPayoutSettings: () => v8Get<{ settings: V8PartnerPayoutSettings }>('/partner/payout-settings'),
  updatePayoutSettings: (body: V8PartnerPayoutSettingsUpdatePayload) =>
    v8Put<{ success: boolean; settings: V8PartnerPayoutSettings }>(
      '/partner/payout-settings',
      body
    ),
};

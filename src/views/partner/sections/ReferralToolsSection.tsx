/**
 * ReferralToolsSection - Partner Referral Tools and Link Management
 *
 * Features:
 * - Display referral code and link
 * - Create campaign links with UTM parameters
 * - QR code generation
 * - Copy to clipboard functionality
 *
 * Part of Partner Portal - Referral System
 */

import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  MousePointerClick,
  QrCode,
  Share2,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { FilterableTable, type FilterChip } from '@/components/shared/ModuleHub';
import { type RowAction } from '@/components/shared/RowActionsMenu';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyPartner,
  V8PartnerApi,
  type V8PartnerAttribution,
  type V8PartnerReferralAnalytics,
  type V8PartnerReferralTools,
} from '@/services/api/v8';
import { cn } from '@/utils/cn';

interface CampaignLink {
  id: string;
  name: string;
  slug: string;
  fullUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickCount: number;
  signupCount: number;
  conversionCount: number;
  isActive: boolean;
  createdAt: string;
}

interface ReferralTools {
  referralCode: string;
  referralLink: string;
  referralLinkSlug: string;
  qrCodeUrl?: string;
  campaignLinks: CampaignLink[];
}

interface ReferredCustomer {
  id: string;
  organizationId: string;
  organizationName?: string;
  attributionType: string;
  referralCodeUsed?: string;
  signupCompletedAt?: string;
  firstPaymentAt?: string;
  lifetimeValue?: number;
  status: string;
  totalCommissionEarned: number;
  commissionRatePercent?: number;
  commissionDurationMonths?: number;
  attributedAt: string;
}

interface ReferralToolsSectionProps {
  subsection?: 'referral-tools' | 'referral-analytics' | 'referred-organizations';
}

const unwrapApiData = (response: any) => {
  const descriptor = response ? Object.getOwnPropertyDescriptor(response, 'data') : undefined;
  return descriptor?.value ?? response?.data ?? response;
};

const REFERRAL_TOOLS_RETRY_DELAY_MS = 700;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ReferralToolsSection: React.FC<ReferralToolsSectionProps> = ({
  subsection = 'referral-tools',
}) => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ReferralTools | null>(null);
  const [v8Analytics, setV8Analytics] = useState<V8PartnerReferralAnalytics | null>(null);
  const [referredCustomers, setReferredCustomers] = useState<ReferredCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Canon §5 — per-column filters. Source data unchanged.
  const [campaignFilters, setCampaignFilters] = useState<FilterChip[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const campaignNameInputRef = useRef<HTMLInputElement | null>(null);

  const normalizeTools = useCallback(
    (payload: any): ReferralTools => ({
      referralCode: String(payload?.referralCode ?? ''),
      referralLink: String(payload?.referralLink ?? ''),
      referralLinkSlug: String(payload?.referralLinkSlug ?? ''),
      qrCodeUrl: payload?.qrCodeUrl ? String(payload.qrCodeUrl) : undefined,
      campaignLinks: Array.isArray(payload?.campaignLinks)
        ? payload.campaignLinks.map((item: any) => ({
            id: String(item?.id ?? ''),
            name: String(item?.name ?? ''),
            slug: String(item?.slug ?? ''),
            fullUrl: String(item?.fullUrl ?? ''),
            utmSource: item?.utmSource ? String(item.utmSource) : undefined,
            utmMedium: item?.utmMedium ? String(item.utmMedium) : undefined,
            utmCampaign: item?.utmCampaign ? String(item.utmCampaign) : undefined,
            clickCount: Number(item?.clickCount ?? 0),
            signupCount: Number(item?.signupCount ?? 0),
            conversionCount: Number(item?.conversionCount ?? 0),
            isActive: Boolean(item?.isActive),
            createdAt: String(item?.createdAt ?? ''),
          }))
        : [],
    }),
    []
  );

  const hasUsableReferralIdentity = useCallback((payload: ReferralTools | null | undefined) => {
    const referralCode = String(payload?.referralCode || '').trim();
    const referralLink = String(payload?.referralLink || '').trim();
    return Boolean(referralCode && referralLink);
  }, []);

  const normalizeAttribution = useCallback(
    (payload: any): ReferredCustomer => ({
      id: String(payload?.id ?? ''),
      organizationId: String(payload?.organizationId ?? ''),
      organizationName: payload?.organizationName ? String(payload.organizationName) : undefined,
      attributionType: String(payload?.attributionType ?? 'UNKNOWN'),
      referralCodeUsed: payload?.referralCodeUsed ? String(payload.referralCodeUsed) : undefined,
      signupCompletedAt: payload?.signupCompletedAt ? String(payload.signupCompletedAt) : undefined,
      firstPaymentAt: payload?.firstPaymentAt ? String(payload.firstPaymentAt) : undefined,
      lifetimeValue:
        payload?.lifetimeValue === null || payload?.lifetimeValue === undefined
          ? undefined
          : Number(payload.lifetimeValue),
      status: String(payload?.status ?? 'PENDING'),
      totalCommissionEarned: Number(payload?.totalCommissionEarned ?? 0),
      commissionRatePercent:
        payload?.commissionRatePercent === null || payload?.commissionRatePercent === undefined
          ? undefined
          : Number(payload.commissionRatePercent),
      commissionDurationMonths:
        payload?.commissionDurationMonths === null ||
        payload?.commissionDurationMonths === undefined
          ? undefined
          : Number(payload.commissionDurationMonths),
      attributedAt: String(payload?.attributedAt ?? ''),
    }),
    []
  );

  const pageCopy = {
    'referral-tools': {
      title: t('partner.referrals.title', 'My Referral Links & Codes'),
      subtitle: t(
        'partner.referrals.subtitle',
        'Share your unique links and codes to earn commissions'
      ),
      runtimeTitle: t('partner.referrals.v8RuntimeTitle', 'V8 Referral Summary'),
      runtimeSubtitle: t(
        'partner.referrals.v8RuntimeSubtitle',
        'Governed click and conversion analytics from the V8 namespace.'
      ),
    },
    'referral-analytics': {
      title: t('partner.referrals.analyticsTitle', 'Click Analytics'),
      subtitle: t(
        'partner.referrals.analyticsSubtitle',
        'Review governed referral funnel signals alongside your live campaign tools.'
      ),
      runtimeTitle: t('partner.referrals.v8AnalyticsRuntimeTitle', 'V8 Referral Analytics'),
      runtimeSubtitle: t(
        'partner.referrals.v8AnalyticsRuntimeSubtitle',
        'Governed referral clicks, signups, and conversion health from the V8 namespace.'
      ),
    },
    'referred-organizations': {
      title: t('partner.referrals.referredOrganizationsTitle', 'Referred Customers'),
      subtitle: t(
        'partner.referrals.referredOrganizationsSubtitle',
        'Review governed customer-acquisition summary alongside the existing referral tooling.'
      ),
      runtimeTitle: t(
        'partner.referrals.v8ReferredOrganizationsRuntimeTitle',
        'V8 Customer Acquisition Summary'
      ),
      runtimeSubtitle: t(
        'partner.referrals.v8ReferredOrganizationsRuntimeSubtitle',
        'Governed signups, trials, and paid-customer progression from the V8 namespace.'
      ),
    },
  }[subsection];

  // Fetch referral tools from API
  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const loadUsableTools = async (): Promise<ReferralTools | null> => {
        try {
          const response = await V8PartnerApi.getReferralTools();
          if (response?.tools) {
            const normalized = normalizeTools(response.tools as V8PartnerReferralTools);
            if (hasUsableReferralIdentity(normalized)) {
              return normalized;
            }
          }
        } catch (error) {
          if (!shouldFallbackToLegacyPartner(error)) {
            throw error;
          }
        }

        try {
          const response = await Api.get('/api/partners/referral-tools');
          const legacyTools = unwrapApiData(response);
          if (response?.success && legacyTools) {
            const normalized = normalizeTools(legacyTools);
            if (hasUsableReferralIdentity(normalized)) {
              return normalized;
            }
          }
        } catch (legacyError) {
          if (!shouldFallbackToLegacyPartner(legacyError)) {
            throw legacyError;
          }
        }

        return null;
      };

      const immediateTools = await loadUsableTools();
      if (immediateTools) {
        setTools(immediateTools);
        return;
      }

      await wait(REFERRAL_TOOLS_RETRY_DELAY_MS);
      const retriedTools = await loadUsableTools();
      if (retriedTools) {
        setTools(retriedTools);
        return;
      }

      setTools((prev) => (hasUsableReferralIdentity(prev) ? prev : null));

      setError(
        t(
          'partner.referrals.identityMissingError',
          'Referral identity is being initialized. Refresh in a moment.'
        )
      );
    } catch (err: any) {
      console.error('Error fetching referral tools:', err);
      setError(
        err?.response?.data?.error ||
          t('partner.referrals.loadError', 'Failed to load referral tools')
      );
    } finally {
      setLoading(false);
    }
  }, [hasUsableReferralIdentity, normalizeTools, t]);

  const fetchV8Analytics = useCallback(async () => {
    try {
      const response = await V8PartnerApi.getReferralAnalytics();
      setV8Analytics(response.analytics);
    } catch {
      setV8Analytics(null);
    }
  }, []);

  const fetchReferredCustomers = useCallback(async () => {
    if (subsection !== 'referred-organizations') {
      setReferredCustomers([]);
      return;
    }

    try {
      const response = await V8PartnerApi.getAttributions();
      setReferredCustomers(
        Array.isArray(response?.attributions)
          ? response.attributions.map((item: V8PartnerAttribution) => normalizeAttribution(item))
          : []
      );
    } catch (error) {
      if (!shouldFallbackToLegacyPartner(error)) {
        setReferredCustomers([]);
        return;
      }
      const response = await Api.get('/api/partners/attributions');
      const legacyData = unwrapApiData(response);
      const legacyItems = Array.isArray(legacyData?.items)
        ? legacyData.items
        : Array.isArray(legacyData)
          ? legacyData
          : [];
      setReferredCustomers(legacyItems.map((item: ReferredCustomer) => normalizeAttribution(item)));
    }
  }, [normalizeAttribution, subsection]);

  useEffect(() => {
    fetchTools();
    void fetchV8Analytics();
    void fetchReferredCustomers();
  }, [fetchReferredCustomers, fetchTools, fetchV8Analytics]);

  // Copy to clipboard
  const copyToClipboard = useCallback(
    async (text: string, field: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success(t('partner.referrals.copied', 'Copied to clipboard!'));
        setTimeout(() => setCopiedField(null), 2000);
      } catch {
        toast.error(t('partner.referrals.copyFailed', 'Failed to copy'));
      }
    },
    [t]
  );

  // Generate a QR code for the referral link (lazy-import qrcode lib).
  const handleGetQrCode = useCallback(
    async (link?: string) => {
      const url = link || tools?.referralLink || '';
      if (!url) {
        toast.error(t('partner.referrals.noLink', 'No referral link available yet'));
        return;
      }
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 320,
          margin: 2,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
        setQrDataUrl(dataUrl);
      } catch {
        toast.error(t('partner.referrals.qrFailed', 'Could not generate QR code'));
      }
    },
    [t, tools?.referralLink]
  );

  // Open the referral link in a new tab (preview the landing experience).
  const handlePreview = useCallback(
    (link?: string) => {
      const url = link || tools?.referralLink || '';
      if (!url) {
        toast.error(t('partner.referrals.noLink', 'No referral link available yet'));
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [t, tools?.referralLink]
  );

  // Create new campaign link via API
  const handleCreateCampaign = async () => {
    const candidateName = String(
      newCampaign.name || campaignNameInputRef.current?.value || ''
    ).trim();
    if (!candidateName) {
      toast.error(t('partner.referrals.nameRequired', 'Campaign name is required'));
      return;
    }

    try {
      setCreating(true);
      const response = await V8PartnerApi.createCampaignLink({
        name: candidateName,
        utmSource: newCampaign.utmSource || undefined,
        utmMedium: newCampaign.utmMedium || undefined,
        utmCampaign: newCampaign.utmCampaign || undefined,
      });

      if (response?.campaignLink) {
        // Refresh tools to get updated list
        await fetchTools();
        setShowNewCampaign(false);
        setNewCampaign({ name: '', utmSource: '', utmMedium: '', utmCampaign: '' });
        toast.success(t('partner.referrals.campaignCreated', 'Campaign link created!'));
      }
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      toast.error(
        err?.response?.data?.error ||
          t('partner.referrals.createFailed', 'Failed to create campaign')
      );
    } finally {
      setCreating(false);
    }
  };

  // Delete campaign link via API
  const handleDeleteCampaign = async (campaignId: string) => {
    if (
      !confirm(
        t('partner.referrals.confirmDelete', 'Are you sure you want to delete this campaign link?')
      )
    ) {
      return;
    }

    try {
      setDeleting(campaignId);
      const response = await V8PartnerApi.deleteCampaignLink(campaignId);

      if (response?.success && response?.deleted) {
        // Remove from local state
        setTools((prev) =>
          prev
            ? { ...prev, campaignLinks: prev.campaignLinks.filter((c) => c.id !== campaignId) }
            : prev
        );
        toast.success(t('partner.referrals.campaignDeleted', 'Campaign link deleted'));
      }
    } catch (err: any) {
      console.error('Error deleting campaign:', err);
      toast.error(
        err?.response?.data?.error ||
          t('partner.referrals.deleteFailed', 'Failed to delete campaign')
      );
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !tools) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-full bg-danger-500/10 mb-4">
          <Link2 className="w-8 h-8 text-danger-400" />
        </div>
        <p className="text-c-text-secondary mb-4">{error}</p>
        <button
          onClick={fetchTools}
          className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors"
        >
          {t('common.retry', 'Try Again')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-c-text">{pageCopy.title}</h2>
        <p className="text-c-text-secondary">{pageCopy.subtitle}</p>
      </div>

      {v8Analytics && (
        <div className="bg-c-surface rounded-xl border border-primary-200 dark:border-primary-900/40 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-c-text flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                {pageCopy.runtimeTitle}
              </h3>
              <p className="text-sm text-c-text-muted mt-1">{pageCopy.runtimeSubtitle}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: t('partner.referrals.v8TotalClicks', 'Governed total clicks'),
                value: String(v8Analytics.totalClicks ?? 0),
                detail: `${v8Analytics.uniqueClicks ?? 0} unique`,
              },
              {
                label: t('partner.referrals.v8Signups', 'Governed signups'),
                value: String(v8Analytics.signups ?? 0),
                detail: `${v8Analytics.trials ?? 0} trials`,
              },
              {
                label: t('partner.referrals.v8PaidCustomers', 'Governed paid customers'),
                value: String(v8Analytics.paidCustomers ?? 0),
                detail: `${v8Analytics.clicksBySource?.length ?? 0} sources`,
              },
              {
                label: t('partner.referrals.v8ConversionRate', 'Governed conversion rate'),
                value: `${v8Analytics.conversionRate ?? 0}%`,
                detail: `${v8Analytics.clicksByDay?.length ?? 0} tracked days`,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-primary-200/70 dark:border-primary-900/30 bg-primary-50/50 dark:bg-primary-950/20 p-4"
              >
                <div className="text-xs uppercase tracking-wide text-c-text-muted">
                  {card.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-c-text">{card.value}</div>
                <div className="mt-1 text-sm text-c-text-muted">{card.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subsection === 'referred-organizations' && (
        <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary-400" />
            <div>
              <h3 className="text-lg font-semibold text-c-text">
                {t('partner.referrals.referredCustomersList', 'Referred customers')}
              </h3>
              <p className="text-sm text-c-text-secondary">
                {t(
                  'partner.referrals.referredCustomersListDesc',
                  'A governed customer list from partner attribution records.'
                )}
              </p>
            </div>
          </div>

          {referredCustomers.length > 0 ? (
            <div className="space-y-3">
              {referredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-lg border border-c-border-subtle bg-c-surface-raised/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      {/* Never headline a raw UUID. When the name cannot be
                          resolved we say so, and keep the identifier as a
                          secondary technical detail. */}
                      {customer.organizationName ? (
                        <p className="font-medium text-c-text">{customer.organizationName}</p>
                      ) : (
                        <p className="font-medium italic text-c-text-muted">
                          {t('partner.clients.unavailable', 'Klient niedostępny')}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-c-text-secondary">
                        {customer.attributionType.toLowerCase().replaceAll('_', ' ')}
                        {customer.referralCodeUsed ? ` · ${customer.referralCodeUsed}` : ''}
                      </p>
                      {!customer.organizationName && customer.organizationId && (
                        <p className="mt-1 font-mono text-xs text-c-text-muted">
                          {t('partner.clients.technicalId', 'ID')}: {customer.organizationId}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-c-surface-subtle px-2 py-1 text-xs font-medium text-c-text-secondary">
                      {customer.status.toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-c-text-secondary">
                    <span>
                      {t('partner.referrals.customerAttributedAt', 'Attributed')}{' '}
                      {customer.attributedAt}
                    </span>
                    <span>
                      {t('partner.referrals.customerCommissionEarned', 'Commission earned')} €
                      {customer.totalCommissionEarned.toLocaleString()}
                    </span>
                  </div>
                  {(customer.signupCompletedAt ||
                    customer.firstPaymentAt ||
                    customer.commissionRatePercent !== undefined ||
                    customer.commissionDurationMonths !== undefined ||
                    customer.lifetimeValue !== undefined) && (
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-lg border border-white/5 bg-c-surface/60 p-3 dark:bg-navy-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                          {t('partner.referrals.customerSignupCompleted', 'Signup completed')}
                        </div>
                        <div className="mt-1 text-sm font-medium text-c-text">
                          {customer.signupCompletedAt || t('common.pending', 'Pending')}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-c-surface/60 p-3 dark:bg-navy-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                          {t('partner.referrals.customerFirstPayment', 'First payment')}
                        </div>
                        <div className="mt-1 text-sm font-medium text-c-text">
                          {customer.firstPaymentAt || t('common.pending', 'Pending')}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-c-surface/60 p-3 dark:bg-navy-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                          {t('partner.referrals.customerCommissionRate', 'Commission rate')}
                        </div>
                        <div className="mt-1 text-sm font-medium text-c-text">
                          {customer.commissionRatePercent !== undefined
                            ? `${customer.commissionRatePercent}%`
                            : t('common.notAvailable', 'Not available')}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-c-surface/60 p-3 dark:bg-navy-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                          {t('partner.referrals.customerCommissionDuration', 'Commission duration')}
                        </div>
                        <div className="mt-1 text-sm font-medium text-c-text">
                          {customer.commissionDurationMonths !== undefined
                            ? `${customer.commissionDurationMonths} ${t('common.months', 'months')}`
                            : t('common.notAvailable', 'Not available')}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-c-surface/60 p-3 dark:bg-navy-950/40">
                        <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
                          {t('partner.referrals.customerLifetimeValue', 'Lifetime value')}
                        </div>
                        <div className="mt-1 text-sm font-medium text-c-text">
                          {customer.lifetimeValue !== undefined
                            ? `€${customer.lifetimeValue.toLocaleString()}`
                            : t('common.notAvailable', 'Not available')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-c-border p-6 text-center">
              <p className="text-c-text-secondary">
                {t('partner.referrals.noReferredCustomers', 'No referred customers yet')}
              </p>
              <p className="mt-1 text-sm text-c-text-muted">
                {t(
                  'partner.referrals.noReferredCustomersDesc',
                  'When attributed organizations appear, they will be listed here.'
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Main Referral Code & Link */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Referral Code */}
        <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <Link2 className="w-5 h-5 text-primary-400" />
            </div>
            <span className="text-sm text-c-text-secondary">
              {t('partner.referrals.yourCode', 'Your Referral Code')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-3 bg-c-surface-raised rounded-lg text-lg font-mono text-c-text border border-c-border-subtle">
              {tools?.referralCode}
            </code>
            <button
              onClick={() => copyToClipboard(tools?.referralCode || '', 'code')}
              className="p-3 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors"
            >
              {copiedField === 'code' ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-c-text-muted mt-2">
            {t('partner.referrals.codeHint', 'Customers can enter this code during signup')}
          </p>
        </div>

        {/* Referral Link */}
        <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Share2 className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm text-c-text-secondary">
              {t('partner.referrals.yourLink', 'Your Referral Link')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={tools?.referralLink || ''}
              readOnly
              className="flex-1 px-4 py-3 bg-c-surface-raised rounded-lg text-sm text-c-text border border-c-border-subtle truncate"
            />
            <button
              onClick={() => copyToClipboard(tools?.referralLink || '', 'link')}
              className="p-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              {copiedField === 'link' ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <button
              type="button"
              onClick={() => handleGetQrCode()}
              className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              <QrCode className="w-3 h-3" />
              {t('partner.referrals.getQR', 'Get QR Code')}
            </button>
            <button
              type="button"
              onClick={() => handlePreview()}
              className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              {t('partner.referrals.preview', 'Preview')}
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Links Section */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-c-border-subtle p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-c-text">
              {t('partner.referrals.campaignLinks', 'Campaign Links')}
            </h3>
            <p className="text-sm text-c-text-secondary">
              {t(
                'partner.referrals.campaignLinksDesc',
                'Track performance by campaign with UTM parameters'
              )}
            </p>
          </div>
          <button
            onClick={() => setShowNewCampaign(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-c-text px-4 text-sm font-medium text-c-bg transition-colors hover:bg-c-text-secondary"
          >
            {t('partner.referrals.newCampaign', 'New Campaign')}
          </button>
        </div>

        {/* New Campaign Form */}
        {showNewCampaign && (
          <div className="mb-4 p-4 bg-c-surface-raised/50 rounded-lg border border-primary-500/30">
            <h4 className="text-sm font-medium text-c-text mb-3">
              {t('partner.referrals.createCampaign', 'Create Campaign Link')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-c-text-secondary mb-1 block">Campaign Name*</label>
                <input
                  ref={campaignNameInputRef}
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., LinkedIn Q1"
                  className="w-full px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-sm text-c-text focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-c-text-secondary mb-1 block">UTM Source</label>
                <input
                  type="text"
                  value={newCampaign.utmSource}
                  onChange={(e) =>
                    setNewCampaign((prev) => ({ ...prev, utmSource: e.target.value }))
                  }
                  placeholder="e.g., linkedin"
                  className="w-full px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-sm text-c-text focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-c-text-secondary mb-1 block">UTM Medium</label>
                <input
                  type="text"
                  value={newCampaign.utmMedium}
                  onChange={(e) =>
                    setNewCampaign((prev) => ({ ...prev, utmMedium: e.target.value }))
                  }
                  placeholder="e.g., social"
                  className="w-full px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-sm text-c-text focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-c-text-secondary mb-1 block">UTM Campaign</label>
                <input
                  type="text"
                  value={newCampaign.utmCampaign}
                  onChange={(e) =>
                    setNewCampaign((prev) => ({ ...prev, utmCampaign: e.target.value }))
                  }
                  placeholder="e.g., partner-q1-2026"
                  className="w-full px-3 py-2 bg-c-surface border border-c-border-subtle rounded-lg text-sm text-c-text focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowNewCampaign(false)}
                className="px-4 py-2 text-sm text-c-text-secondary hover:text-c-text dark:hover:text-white transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={creating}
                className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:bg-primary-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {creating && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {t('common.create', 'Create')}
              </button>
            </div>
          </div>
        )}

        {/* Campaign Links Table */}
        <FilterableTable
          canvasClassName="p-0"
          persistKey="partner.referrals.campaignLinks"
          columns={[
            {
              id: 'name',
              label: t('partner.referrals.campaign', 'Campaign'),
              render: (campaign) => (
                <div className="min-w-0">
                  <p className="font-medium text-c-text truncate">{campaign.name}</p>
                  <p className="text-xs text-c-text-muted truncate">
                    {campaign.utmSource && `${campaign.utmSource}`}
                    {campaign.utmMedium && ` / ${campaign.utmMedium}`}
                  </p>
                </div>
              ),
            },
            {
              id: 'clickCount',
              label: t('partner.referrals.clicks', 'Clicks'),
              width: '90px',
              align: 'right',
              render: (campaign) => (
                <span className="text-sm font-medium text-c-text">{campaign.clickCount}</span>
              ),
            },
            {
              id: 'signupCount',
              label: t('partner.referrals.signups', 'Signups'),
              width: '90px',
              align: 'right',
              render: (campaign) => (
                <span className="text-sm text-c-text">{campaign.signupCount}</span>
              ),
            },
            {
              id: 'conversionCount',
              label: t('partner.referrals.conversions', 'Paid'),
              width: '90px',
              align: 'right',
              render: (campaign) => (
                <span className="text-sm font-medium text-c-success">
                  {campaign.conversionCount}
                </span>
              ),
            },
            {
              id: 'convRate',
              label: t('partner.referrals.convRate', 'Conv %'),
              width: '90px',
              align: 'right',
              render: (campaign) => (
                <span className="text-sm text-c-text-secondary">
                  {campaign.clickCount > 0
                    ? `${((campaign.conversionCount / campaign.clickCount) * 100).toFixed(1)}%`
                    : '0%'}
                </span>
              ),
            },
          ]}
          data={(tools?.campaignLinks ?? []).map((campaign) => ({ ...campaign, id: campaign.id }))}
          activeFilters={campaignFilters}
          onFilterChange={setCampaignFilters}
          getRowActions={(row): RowAction[] => {
            const campaign = row as unknown as CampaignLink;
            return [
              {
                id: 'copy',
                label: t('partner.referrals.copyLink', 'Copy link'),
                icon: Copy,
                onClick: () => copyToClipboard(campaign.fullUrl, campaign.id),
              },
              {
                id: 'delete',
                label: t('common.delete', 'Delete'),
                icon: Trash2,
                variant: 'danger',
                divider: true,
                disabled: deleting === campaign.id,
                onClick: () => handleDeleteCampaign(campaign.id),
              },
            ];
          }}
          emptyMessage={t(
            'partner.referrals.noCampaigns',
            'No campaign links yet. Create one to start tracking!'
          )}
        />
      </div>

      {/* Tips Section */}
      <div className="bg-gradient-to-br from-primary-900/30 to-primary-800/20 rounded-xl border border-primary-500/20 p-4">
        <h4 className="text-sm font-semibold text-primary-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          {t('partner.referrals.tips', 'Tips for Better Conversions')}
        </h4>
        <ul className="space-y-2 text-sm text-c-text-secondary">
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            Share your link on LinkedIn with a compelling message about digital transformation
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            Use campaign links to track which channels perform best
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            Add your referral code to your email signature
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            Share case studies alongside your referral link for higher trust
          </li>
        </ul>
      </div>

      {/* QR Code modal */}
      {qrDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setQrDataUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-c-surface rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-c-text mb-1">
              {t('partner.referrals.qrTitle', 'Referral QR Code')}
            </h3>
            <p className="text-xs text-c-text-muted mb-4">
              {t('partner.referrals.qrHint', 'Scan to open your referral link')}
            </p>
            <img
              src={qrDataUrl}
              alt={t('partner.referrals.qrAlt', 'Referral QR code')}
              className="w-full max-w-[240px] mx-auto rounded-lg border border-c-border-subtle dark:border-white/10"
            />
            <div className="flex items-center gap-2 mt-4">
              <a
                href={qrDataUrl}
                download="consultify-referral-qr.png"
                className="flex-1 px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium transition-colors"
              >
                {t('common.download', 'Download')}
              </a>
              <button
                type="button"
                onClick={() => setQrDataUrl(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-c-surface-raised text-c-text-secondary text-sm font-medium hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralToolsSection;

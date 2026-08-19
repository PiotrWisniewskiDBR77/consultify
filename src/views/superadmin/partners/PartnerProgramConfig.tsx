/**
 * PartnerProgramConfig - SuperAdmin Partner Program Configuration
 *
 * Features:
 * - Commission rates per tier
 * - Client discount settings
 * - Payout settings and thresholds
 *
 * Part of SuperAdmin Partner Management
 */

import {
  AlertCircle,
  Check,
  DollarSign,
  Edit2,
  Percent,
  RefreshCw,
  Save,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { v8Post } from '@/services/api/v8/client';
import { cn } from '@/utils/cn';

import { LoadingState } from '../../../components/ui/primitives';

interface CommissionRate {
  tier: string;
  tierName: string;
  rate: number;
  minRevenue?: number;
  color: string;
}

interface DiscountConfig {
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  durationMonths: number;
  maxDiscountPerMonth?: number;
  isActive: boolean;
}

interface PayoutSettings {
  minimumThreshold: number;
  payoutSchedule: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  processingFeePercent: number;
  autoPayoutEnabled: boolean;
  paymentMethods: string[];
}

interface CertificationReviewItem {
  id: string;
  partner_name?: string;
  certification_name?: string;
  certification_track?: string;
  certification_level?: string;
  review_state?: string;
  progress_percent?: number;
  updated_at?: string;
}

interface PartnerApplicationItem {
  id: string;
  full_name: string;
  email: string;
  company: string;
  website?: string | null;
  country?: string | null;
  role?: string | null;
  focus_area?: string | null;
  team_size?: string | null;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_follow_up';
  review_note?: string | null;
  created_at?: string;
}

const useLegacyPartnerOperatorReview = () =>
  String(import.meta.env.VITE_PARTNER_LEGACY_ROLLBACK_ENABLED || '').toLowerCase() === 'true';

const operatorReviewKey = (operation: string, targetId: string) =>
  `${operation}:${targetId}:${Date.now()}:${globalThis.crypto.randomUUID()}`;

interface PartnerProgramReporting {
  certificationsByTrack: Array<{
    track: string;
    level: string;
    status: string;
    count: number;
  }>;
  reviewBacklog: Array<{
    review_state: string;
    count: number;
  }>;
  examPassRates: Array<{
    track: string;
    level: string;
    pass_rate: number;
    attempts: number;
  }>;
  blockedReasons: Array<{
    reason: string;
    count: number;
  }>;
  resourceDownloads?: Array<{
    category: string;
    downloads: number;
  }>;
  partnerDocViews?: Array<{
    slug: string;
    views: number;
  }>;
}

const DEFAULT_TIERS: CommissionRate[] = [
  { tier: 'REGISTERED', tierName: 'Registered', rate: 10, minRevenue: 0, color: 'bg-slate-500' },
  { tier: 'BRONZE', tierName: 'Bronze', rate: 12, minRevenue: 5000, color: 'bg-amber-600' },
  { tier: 'SILVER', tierName: 'Silver', rate: 15, minRevenue: 15000, color: 'bg-slate-400' },
  { tier: 'GOLD', tierName: 'Gold', rate: 18, minRevenue: 50000, color: 'bg-yellow-500' },
  { tier: 'PLATINUM', tierName: 'Platinum', rate: 20, minRevenue: 100000, color: 'bg-slate-700' },
];

const PAYMENT_METHODS = [
  { id: 'BANK_TRANSFER', name: 'Bank Transfer', icon: Wallet },
  { id: 'PAYPAL', name: 'PayPal', icon: DollarSign },
  { id: 'STRIPE', name: 'Stripe', icon: DollarSign },
  { id: 'WISE', name: 'Wise', icon: DollarSign },
];

// AMD-PRT-ECONOMICS-002 is a compile-time owner decision. The operator UI
// must not expose authoring controls while Partner economics are approved out.
const ECONOMICS_OPERATIONS_AVAILABLE = false as const;

const unwrapApiData = <T,>(response: any): T | undefined => {
  const ownData = response ? Object.getOwnPropertyDescriptor(response, 'data')?.value : undefined;
  const body = ownData ?? response?.data ?? response;
  return (body?.data && body.data !== body ? body.data : body) as T | undefined;
};

export const PartnerProgramConfig: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>(DEFAULT_TIERS);
  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({
    discountType: 'PERCENTAGE',
    discountValue: 15,
    durationMonths: 12,
    maxDiscountPerMonth: undefined,
    isActive: true,
  });
  const [payoutSettings, setPayoutSettings] = useState<PayoutSettings>({
    minimumThreshold: 100,
    payoutSchedule: 'MONTHLY',
    processingFeePercent: 1,
    autoPayoutEnabled: false,
    paymentMethods: ['BANK_TRANSFER'],
  });

  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [reviewQueue, setReviewQueue] = useState<CertificationReviewItem[]>([]);
  const [partnerApplications, setPartnerApplications] = useState<PartnerApplicationItem[]>([]);
  const [reporting, setReporting] = useState<PartnerProgramReporting | null>(null);

  // Fetch configuration
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const reviewRes = await Api.get('/api/superadmin/partner-config/review-queue');
      if (reviewRes?.success) {
        const queue = unwrapApiData<CertificationReviewItem[]>(reviewRes);
        setReviewQueue(Array.isArray(queue) ? queue : []);
      }

      const applicationsRes = await Api.get('/api/superadmin/partner-config/applications');
      if (applicationsRes?.success) {
        const applications = unwrapApiData<PartnerApplicationItem[]>(applicationsRes);
        setPartnerApplications(Array.isArray(applications) ? applications : []);
      }

      const reportingRes = await Api.get('/api/superadmin/partner-config/reporting');
      if (reportingRes?.success) {
        const reportingData = unwrapApiData<PartnerProgramReporting>(reportingRes);
        setReporting(reportingData && !Array.isArray(reportingData) ? reportingData : null);
      }
    } catch (err: any) {
      console.error('Error fetching config:', err);
      setError(err?.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save commission rate
  const handleSaveCommissionRate = async (tier: string, rate: number) => {
    void tier;
    void rate;
    toast.error('Partner economics are unavailable under AMD-PRT-ECONOMICS-002');
  };

  // Save discount config
  const handleSaveDiscountConfig = async () => {
    toast.error('Partner economics are unavailable under AMD-PRT-ECONOMICS-002');
  };

  const handlePartnerApplicationDecision = async (
    applicationId: string,
    status: PartnerApplicationItem['status']
  ) => {
    try {
      setSaving(true);
      const useLegacy = useLegacyPartnerOperatorReview();
      const response = useLegacy
        ? await Api.post(`/api/superadmin/partner-config/applications/${applicationId}/review`, {
            status,
          })
        : await v8Post(
            `/admin/partners/applications/${encodeURIComponent(applicationId)}/review`,
            { status },
            {
              extraHeaders: {
                'Idempotency-Key': operatorReviewKey('partner-application-review', applicationId),
              },
            }
          );

      if (!useLegacy || response?.success) {
        setPartnerApplications((prev) =>
          prev.map((item) => (item.id === applicationId ? { ...item, status } : item))
        );
        toast.success('Partner application updated');
      } else {
        toast.error(response?.error || 'Failed to update partner application');
      }
    } catch (err: any) {
      console.error('Error updating partner application:', err);
      toast.error(err?.message || 'Failed to update partner application');
    } finally {
      setSaving(false);
    }
  };

  // Save payout settings
  const handleSavePayoutSettings = async () => {
    toast.error('Partner economics are unavailable under AMD-PRT-ECONOMICS-002');
  };

  // Toggle payment method
  const togglePaymentMethod = (methodId: string) => {
    setPayoutSettings((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(methodId)
        ? prev.paymentMethods.filter((m) => m !== methodId)
        : [...prev.paymentMethods, methodId],
    }));
  };

  const handleReviewDecision = async (
    certificationId: string,
    reviewState: 'approved' | 'changes_requested'
  ) => {
    try {
      setSaving(true);
      const useLegacy = useLegacyPartnerOperatorReview();
      const response = useLegacy
        ? await Api.post(`/api/superadmin/partner-config/review-queue/${certificationId}`, {
            reviewState,
          })
        : await v8Post(
            `/admin/partners/certifications/${encodeURIComponent(certificationId)}/review`,
            { reviewState },
            {
              extraHeaders: {
                'Idempotency-Key': operatorReviewKey(
                  'partner-certification-review',
                  certificationId
                ),
              },
            }
          );
      if (!useLegacy || response?.success) {
        toast.success(
          reviewState === 'approved' ? 'Certification approved' : 'Changes requested sent'
        );
        await fetchConfig();
      } else {
        toast.error(response?.error || 'Failed to update review state');
      }
    } catch (err: any) {
      console.error('Error updating review state:', err);
      toast.error(err?.message || 'Failed to update review state');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="py-12" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-c-text">
            {t('superadmin.partnerConfig.title', 'Partner Program Configuration')}
          </h1>
          <p className="text-slate-600 dark:text-slate-500">
            {t(
              'superadmin.partnerConfig.subtitle',
              'Review Partner program operations and historical economics'
            )}
          </p>
        </div>
        <button
          onClick={fetchConfig}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-500 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger-400" />
            <span className="text-danger-300">{error}</span>
          </div>
        </div>
      )}

      <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <h2 className="font-semibold text-c-text">Partner economics are read-only</h2>
            <p className="mt-1 text-sm text-c-text-secondary">
              Commission, discount, accrual and payout authoring is unavailable under
              AMD-PRT-ECONOMICS-002. Historical records remain available for review.
            </p>
          </div>
        </div>
      </div>

      {ECONOMICS_OPERATIONS_AVAILABLE && (
        <>
      {/* Commission Rates */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-c-text">
              {t('superadmin.partnerConfig.commissionRates', 'Commission Rates by Tier')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-500">
              Set commission percentages for each partner tier
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {commissionRates.map((tier) => (
                <div
                  key={tier.tier}
                  className="bg-c-surface/50 rounded-xl border border-white/5 p-4"
                >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', tier.color)} />
                  <span className="font-medium text-c-text">{tier.tierName}</span>
                </div>
                {editingTier !== tier.tier && (
                  <button
                    onClick={() => {
                      setEditingTier(tier.tier);
                      setEditRate(tier.rate);
                    }}
                    className="p-1 text-slate-600 dark:text-slate-500 hover:text-white rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editingTier === tier.tier ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editRate}
                      onChange={(e) => setEditRate(Number(e.target.value))}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 bg-c-surface-raised border border-white/10 rounded-lg text-c-text text-center"
                    />
                    <span className="text-slate-600 dark:text-slate-500">%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveCommissionRate(tier.tier, editRate)}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTier(null)}
                      className="px-3 py-1.5 text-slate-600 dark:text-slate-500 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-3xl font-bold text-c-text">{tier.rate}%</p>
                  {tier.minRevenue !== undefined && tier.minRevenue > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Min: €{tier.minRevenue.toLocaleString()} revenue
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Client Discount Settings */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
                <div className="rounded-lg bg-c-surface p-2">
                  <Percent className="h-5 w-5 text-c-text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">
                {t('superadmin.partnerConfig.clientDiscount', 'Client Discount Settings')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Configure discounts for clients referred by partners
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-500">
              {discountConfig.isActive ? 'Active' : 'Disabled'}
            </span>
            <button
              onClick={() =>
                setDiscountConfig({ ...discountConfig, isActive: !discountConfig.isActive })
              }
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                discountConfig.isActive ? 'bg-emerald-600' : 'bg-slate-600'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform',
                  discountConfig.isActive ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Discount Type
            </label>
            <select
              value={discountConfig.discountType}
              onChange={(e) =>
                setDiscountConfig({ ...discountConfig, discountType: e.target.value as any })
              }
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Discount Value {discountConfig.discountType === 'PERCENTAGE' ? '(%)' : '(€)'}
            </label>
            <input
              type="number"
              value={discountConfig.discountValue}
              onChange={(e) =>
                setDiscountConfig({ ...discountConfig, discountValue: Number(e.target.value) })
              }
              min={0}
              max={discountConfig.discountType === 'PERCENTAGE' ? 100 : undefined}
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Duration (months)
            </label>
            <input
              type="number"
              value={discountConfig.durationMonths}
              onChange={(e) =>
                setDiscountConfig({ ...discountConfig, durationMonths: Number(e.target.value) })
              }
              min={1}
              max={60}
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Max Discount/Month (€)
            </label>
            <input
              type="number"
              value={discountConfig.maxDiscountPerMonth || ''}
              onChange={(e) =>
                setDiscountConfig({
                  ...discountConfig,
                  maxDiscountPerMonth: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="No limit"
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={handleSaveDiscountConfig}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Discount Settings
          </button>
        </div>
      </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Users className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">Public Partner Applications</h2>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Lightweight qualification leads submitted from the public recruitment page
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {partnerApplications.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-c-surface/40 p-4 text-sm text-slate-600">
                No partner applications submitted yet.
              </div>
            ) : (
              partnerApplications.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/5 bg-c-surface/40 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-c-text font-medium">{item.company}</div>
                      <div className="text-xs text-slate-600">
                        {item.full_name} • {item.email}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
                      {item.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    {item.role ? <div>Role: {item.role}</div> : null}
                    {item.country ? <div>Country: {item.country}</div> : null}
                    {item.team_size ? <div>Team size: {item.team_size}</div> : null}
                    {item.focus_area ? <div>Focus: {item.focus_area}</div> : null}
                    {item.created_at ? (
                      <div>Submitted: {new Date(item.created_at).toLocaleString()}</div>
                    ) : null}
                  </div>

                  {item.message ? (
                    <div className="rounded-lg bg-black/20 px-3 py-2 text-sm text-slate-600">
                      {item.message}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePartnerApplicationDecision(item.id, 'approved')}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handlePartnerApplicationDecision(item.id, 'needs_follow_up')}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Follow up
                    </button>
                    <button
                      onClick={() => handlePartnerApplicationDecision(item.id, 'rejected')}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-c-surface-raised hover:bg-slate-600 text-c-text text-sm disabled:opacity-50"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Shield className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">
                {t('superadmin.partnerConfig.reviewQueue', 'Certification Review Queue')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Review advanced partner certifications that require operator approval
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {reviewQueue.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-c-surface/40 p-4 text-sm text-slate-600">
                No certifications are waiting for operator review.
              </div>
            ) : (
              reviewQueue.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/5 bg-c-surface/40 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-c-text font-medium">{item.certification_name}</div>
                      <div className="text-xs text-slate-600">
                        {item.partner_name || 'Partner'} • {item.certification_track} /{' '}
                        {item.certification_level}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-300">
                      {item.review_state || 'pending'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Progress: {item.progress_percent || 0}% • Updated:{' '}
                    {item.updated_at ? new Date(item.updated_at).toLocaleString() : 'n/a'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReviewDecision(item.id, 'approved')}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReviewDecision(item.id, 'changes_requested')}
                      disabled={saving}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm disabled:opacity-50"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Request changes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-lg bg-c-surface p-2">
              <Users className="h-5 w-5 text-c-text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-c-text">
                {t('superadmin.partnerConfig.programSignals', 'Program Signals')}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                Adoption, blockers, and knowledge usage across the partner rollout
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(reporting?.blockedReasons || []).map((item) => (
              <div
                key={item.reason}
                className="rounded-xl border border-white/5 bg-c-surface/40 p-4"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">{item.reason}</div>
                <div className="mt-1 text-2xl font-semibold text-c-text">{item.count}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {(reporting?.examPassRates || []).slice(0, 4).map((item) => (
              <div
                key={`${item.track}-${item.level}`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-c-surface/40 p-3"
              >
                <div className="text-sm text-c-text">
                  {item.track} / {item.level}
                </div>
                <div className="text-sm text-slate-600">
                  {item.pass_rate || 0}% pass • {item.attempts || 0} attempts
                </div>
              </div>
            ))}
            {(reporting?.partnerDocViews || []).slice(0, 3).map((item) => (
              <div
                key={item.slug}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-c-surface/40 p-3"
              >
                <div className="text-sm text-c-text">{item.slug}</div>
                <div className="text-sm text-slate-600">{item.views || 0} views</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {ECONOMICS_OPERATIONS_AVAILABLE && (
        <>
      {/* Payout Settings */}
      <div className="bg-c-surface-raised/50 rounded-xl border border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <Wallet className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-c-text">
              {t('superadmin.partnerConfig.payoutSettings', 'Payout Settings')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-500">
              Configure payout thresholds, schedules, and payment methods
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Minimum Threshold (€)
            </label>
            <input
              type="number"
              value={payoutSettings.minimumThreshold}
              onChange={(e) =>
                    setPayoutSettings({
                      ...payoutSettings,
                      minimumThreshold: Number(e.target.value),
                    })
              }
              min={0}
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Payout Schedule
            </label>
            <select
              value={payoutSettings.payoutSchedule}
              onChange={(e) =>
                setPayoutSettings({ ...payoutSettings, payoutSchedule: e.target.value as any })
              }
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Processing Fee (%)
            </label>
            <input
              type="number"
              value={payoutSettings.processingFeePercent}
              onChange={(e) =>
                setPayoutSettings({
                  ...payoutSettings,
                  processingFeePercent: Number(e.target.value),
                })
              }
              min={0}
              max={10}
              step={0.1}
              className="w-full px-4 py-2.5 bg-c-text text-c-bg border border-white/10 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-500 mb-2">
              Auto-payout
            </label>
            <div className="flex items-center gap-3 h-[42px]">
              <button
                onClick={() =>
                  setPayoutSettings({
                    ...payoutSettings,
                    autoPayoutEnabled: !payoutSettings.autoPayoutEnabled,
                  })
                }
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  payoutSettings.autoPayoutEnabled ? 'bg-emerald-600' : 'bg-slate-600'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform',
                    payoutSettings.autoPayoutEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-500">
                {payoutSettings.autoPayoutEnabled ? 'Enabled' : 'Manual approval'}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mb-4">
          <label className="block text-sm text-slate-600 dark:text-slate-500 mb-3">
            Enabled Payment Methods
          </label>
          <div className="flex flex-wrap gap-3">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => togglePaymentMethod(method.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  payoutSettings.paymentMethods.includes(method.id)
                    ? 'border-c-border bg-c-surface-raised'
                    : 'bg-c-surface border-white/10 text-slate-600 dark:text-slate-500 hover:text-white'
                )}
              >
                <method.icon className="w-4 h-4" />
                {method.name}
                {payoutSettings.paymentMethods.includes(method.id) && (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSavePayoutSettings}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Payout Settings
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default PartnerProgramConfig;

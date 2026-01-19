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
  Plus,
  QrCode,
  Share2,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
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

export const ReferralToolsSection: React.FC = () => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ReferralTools | null>(null);
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

  // Fetch referral tools from API
  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await Api.get('/api/partners/referral-tools');

      if (response?.data?.success && response?.data?.data) {
        setTools(response.data.data);
      } else if (response?.data?.data) {
        setTools(response.data.data);
      } else {
        setError(t('partner.referrals.loadError', 'Failed to load referral tools'));
      }
    } catch (err: any) {
      console.error('Error fetching referral tools:', err);
      setError(
        err?.response?.data?.error ||
          t('partner.referrals.loadError', 'Failed to load referral tools')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

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

  // Create new campaign link via API
  const handleCreateCampaign = async () => {
    if (!newCampaign.name) {
      toast.error(t('partner.referrals.nameRequired', 'Campaign name is required'));
      return;
    }

    try {
      setCreating(true);
      const response = await Api.post('/api/partners/campaign-links', {
        name: newCampaign.name,
        utmSource: newCampaign.utmSource || undefined,
        utmMedium: newCampaign.utmMedium || undefined,
        utmCampaign: newCampaign.utmCampaign || undefined,
      });

      if (response?.data?.success) {
        // Refresh tools to get updated list
        await fetchTools();
        setShowNewCampaign(false);
        setNewCampaign({ name: '', utmSource: '', utmMedium: '', utmCampaign: '' });
        toast.success(t('partner.referrals.campaignCreated', 'Campaign link created!'));
      } else {
        toast.error(
          response?.data?.error || t('partner.referrals.createFailed', 'Failed to create campaign')
        );
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
      const response = await Api.delete(`/api/partners/campaign-links/${campaignId}`);

      if (response?.data?.success) {
        // Remove from local state
        setTools((prev) =>
          prev
            ? { ...prev, campaignLinks: prev.campaignLinks.filter((c) => c.id !== campaignId) }
            : prev
        );
        toast.success(t('partner.referrals.campaignDeleted', 'Campaign link deleted'));
      } else {
        toast.error(
          response?.data?.error || t('partner.referrals.deleteFailed', 'Failed to delete campaign')
        );
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
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !tools) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-4 rounded-full bg-red-500/10 mb-4">
          <Link2 className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-slate-400 dark:text-slate-500 mb-4">{error}</p>
        <button
          onClick={fetchTools}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
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
        <h2 className="text-xl font-semibold text-white">
          {t('partner.referrals.title', 'My Referral Links & Codes')}
        </h2>
        <p className="text-slate-400 dark:text-slate-500">
          {t('partner.referrals.subtitle', 'Share your unique links and codes to earn commissions')}
        </p>
      </div>

      {/* Main Referral Code & Link */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Referral Code */}
        <div className="bg-navy-800/50 rounded-xl border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-violet-500/20">
              <Link2 className="w-5 h-5 text-violet-400" />
            </div>
            <span className="text-sm text-slate-400 dark:text-slate-500">
              {t('partner.referrals.yourCode', 'Your Referral Code')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 px-4 py-3 bg-navy-900 rounded-lg text-lg font-mono text-white border border-white/10">
              {tools?.referralCode}
            </code>
            <button
              onClick={() => copyToClipboard(tools?.referralCode || '', 'code')}
              className="p-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              {copiedField === 'code' ? (
                <Check className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {t('partner.referrals.codeHint', 'Customers can enter this code during signup')}
          </p>
        </div>

        {/* Referral Link */}
        <div className="bg-navy-800/50 rounded-xl border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Share2 className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-sm text-slate-400 dark:text-slate-500">
              {t('partner.referrals.yourLink', 'Your Referral Link')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={tools?.referralLink || ''}
              readOnly
              className="flex-1 px-4 py-3 bg-navy-900 rounded-lg text-sm text-white border border-white/10 truncate"
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
            <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              <QrCode className="w-3 h-3" />
              {t('partner.referrals.getQR', 'Get QR Code')}
            </button>
            <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              {t('partner.referrals.preview', 'Preview')}
            </button>
          </div>
        </div>
      </div>

      {/* Campaign Links Section */}
      <div className="bg-navy-800/50 rounded-xl border border-white/5 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {t('partner.referrals.campaignLinks', 'Campaign Links')}
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t(
                'partner.referrals.campaignLinksDesc',
                'Track performance by campaign with UTM parameters'
              )}
            </p>
          </div>
          <button
            onClick={() => setShowNewCampaign(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('partner.referrals.newCampaign', 'New Campaign')}
          </button>
        </div>

        {/* New Campaign Form */}
        {showNewCampaign && (
          <div className="mb-4 p-4 bg-navy-900/50 rounded-lg border border-violet-500/30">
            <h4 className="text-sm font-medium text-white mb-3">
              {t('partner.referrals.createCampaign', 'Create Campaign Link')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">
                  Campaign Name*
                </label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="e.g., LinkedIn Q1"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">
                  UTM Source
                </label>
                <input
                  type="text"
                  value={newCampaign.utmSource}
                  onChange={(e) => setNewCampaign({ ...newCampaign, utmSource: e.target.value })}
                  placeholder="e.g., linkedin"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">
                  UTM Medium
                </label>
                <input
                  type="text"
                  value={newCampaign.utmMedium}
                  onChange={(e) => setNewCampaign({ ...newCampaign, utmMedium: e.target.value })}
                  placeholder="e.g., social"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 mb-1 block">
                  UTM Campaign
                </label>
                <input
                  type="text"
                  value={newCampaign.utmCampaign}
                  onChange={(e) => setNewCampaign({ ...newCampaign, utmCampaign: e.target.value })}
                  placeholder="e.g., partner-q1-2026"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowNewCampaign(false)}
                className="px-4 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={creating}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
        {tools?.campaignLinks && tools.campaignLinks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                    {t('partner.referrals.campaign', 'Campaign')}
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                    {t('partner.referrals.clicks', 'Clicks')}
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                    {t('partner.referrals.signups', 'Signups')}
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                    {t('partner.referrals.conversions', 'Paid')}
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
                    {t('partner.referrals.convRate', 'Conv %')}
                  </th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tools.campaignLinks.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-white/5">
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium text-white">{campaign.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {campaign.utmSource && `${campaign.utmSource}`}
                          {campaign.utmMedium && ` / ${campaign.utmMedium}`}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-white font-medium">{campaign.clickCount}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-white">{campaign.signupCount}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-emerald-400 font-medium">
                        {campaign.conversionCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-slate-400 dark:text-slate-500">
                        {campaign.clickCount > 0
                          ? `${((campaign.conversionCount / campaign.clickCount) * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => copyToClipboard(campaign.fullUrl, campaign.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded transition-colors"
                          title="Copy link"
                        >
                          {copiedField === campaign.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          disabled={deleting === campaign.id}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-400 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === campaign.id ? (
                            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <MousePointerClick className="w-12 h-12 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500">
              {t(
                'partner.referrals.noCampaigns',
                'No campaign links yet. Create one to start tracking!'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Tips Section */}
      <div className="bg-gradient-to-br from-violet-900/30 to-violet-800/20 rounded-xl border border-violet-500/20 p-4">
        <h4 className="text-sm font-semibold text-violet-300 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          {t('partner.referrals.tips', 'Tips for Better Conversions')}
        </h4>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            Share your link on LinkedIn with a compelling message about digital transformation
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            Use campaign links to track which channels perform best
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            Add your referral code to your email signature
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            Share case studies alongside your referral link for higher trust
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ReferralToolsSection;

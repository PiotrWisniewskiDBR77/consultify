import { Pause, Play, Plus, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  created_at?: string;
  started_at?: string | null;
  enrollments_total?: number;
  sent_count?: number;
}

export const PartnerOutreachPanel: React.FC = () => {
  const { t } = useTranslation();
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [newCampaignName, setNewCampaignName] = useState('');
  const [newFromName, setNewFromName] = useState('');
  const [newFromEmail, setNewFromEmail] = useState('');
  const [newReplyTo, setNewReplyTo] = useState('');
  const [stepSubject, setStepSubject] = useState('');
  const [stepBodyText, setStepBodyText] = useState('');

  const exampleCsv = useMemo(
    () => `email,company,first_name,last_name,country,region,source,lawful_basis
ceo@example.com,Example Co,Ada,Lovelace,US,NA,manual,legitimate_interest`,
    []
  );

  const normalizeCampaigns = (payload: any): Campaign[] => {
    if (Array.isArray(payload)) return payload as Campaign[];
    if (Array.isArray(payload?.data)) return payload.data as Campaign[];
    if (Array.isArray(payload?.campaigns)) return payload.campaigns as Campaign[];
    return [];
  };

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      const resp = await Api.get('/superadmin/partner-outreach/campaigns');
      // Accept both shapes:
      // - { success: true, data: Campaign[] }
      // - Campaign[] (legacy/unwrapped)
      if (resp?.success === false) throw new Error(resp?.error || 'Failed');
      const nextCampaigns = normalizeCampaigns(resp?.data ?? resp);
      setCampaigns(nextCampaigns);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const importLeads = async () => {
    try {
      setImporting(true);
      const content = csv.trim().length > 0 ? csv : exampleCsv;
      const resp = await Api.post('/superadmin/partner-outreach/leads/import', {
        csv: content,
      });
      if (!resp?.success) throw new Error(resp?.error || 'Import failed');
      toast.success(
        t('partners.outreach.importSuccess', 'Leads imported') +
          ` (${resp.data?.inserted || 0}/${resp.data?.total || 0})`
      );
      setCsv('');
    } catch (e: any) {
      toast.error(e?.message || t('partners.outreach.importFailed', 'Import failed'));
    } finally {
      setImporting(false);
    }
  };

  const createCampaign = async () => {
    try {
      if (!newCampaignName.trim()) {
        toast.error(t('partners.outreach.nameRequired', 'Campaign name required'));
        return;
      }
      if (!stepSubject.trim()) {
        toast.error(t('partners.outreach.subjectRequired', 'Step subject required'));
        return;
      }
      const resp = await Api.post('/superadmin/partner-outreach/campaigns', {
        name: newCampaignName.trim(),
        fromName: newFromName.trim() || undefined,
        fromEmail: newFromEmail.trim() || undefined,
        replyTo: newReplyTo.trim() || undefined,
        steps: [
          {
            delayDays: 0,
            subject: stepSubject.trim(),
            bodyText: stepBodyText,
          },
        ],
      });
      if (!resp?.success) throw new Error(resp?.error || 'Create failed');
      toast.success(t('partners.outreach.campaignCreated', 'Campaign created'));
      setNewCampaignName('');
      setStepSubject('');
      setStepBodyText('');
      await fetchCampaigns();
    } catch (e: any) {
      toast.error(e?.message || t('partners.outreach.campaignCreateFailed', 'Create failed'));
    }
  };

  const startCampaign = async (id: string) => {
    try {
      const resp = await Api.post(`/superadmin/partner-outreach/campaigns/${id}/start`, {});
      if (!resp?.success) throw new Error(resp?.error || 'Start failed');
      toast.success(t('partners.outreach.campaignStarted', 'Campaign started'));
      await fetchCampaigns();
    } catch (e: any) {
      toast.error(e?.message || t('partners.outreach.campaignStartFailed', 'Start failed'));
    }
  };

  const pauseCampaign = async (id: string) => {
    try {
      const resp = await Api.post(`/superadmin/partner-outreach/campaigns/${id}/pause`, {});
      if (!resp?.success) throw new Error(resp?.error || 'Pause failed');
      toast.success(t('partners.outreach.campaignPaused', 'Campaign paused'));
      await fetchCampaigns();
    } catch (e: any) {
      toast.error(e?.message || t('partners.outreach.campaignPauseFailed', 'Pause failed'));
    }
  };

  const resumeCampaign = async (id: string) => {
    try {
      const resp = await Api.post(`/superadmin/partner-outreach/campaigns/${id}/resume`, {});
      if (!resp?.success) throw new Error(resp?.error || 'Resume failed');
      toast.success(t('partners.outreach.campaignResumed', 'Campaign resumed'));
      await fetchCampaigns();
    } catch (e: any) {
      toast.error(e?.message || t('partners.outreach.campaignResumeFailed', 'Resume failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('partners.outreach.title', 'Partner Outreach')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(
            'partners.outreach.subtitle',
            'Import leads, create campaigns, and run compliance-friendly outreach.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('partners.outreach.importLeads', 'Import leads (CSV)')}
            </h3>
            <button
              disabled={importing}
              onClick={importLeads}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {t('partners.outreach.importCta', 'Import')}
            </button>
          </div>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={exampleCsv}
            className="w-full h-44 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
          />
          <p className="text-xs text-slate-500 dark:text-slate-500">
            {t(
              'partners.outreach.importHint',
              'Headers: email, company, first_name, last_name, country, region, source, lawful_basis'
            )}
          </p>
        </div>

        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('partners.outreach.createCampaign', 'Create campaign')}
            </h3>
            <button
              onClick={createCampaign}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white text-sm"
            >
              <Plus className="w-4 h-4" />
              {t('partners.outreach.createCta', 'Create')}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder={t('partners.outreach.campaignName', 'Campaign name')}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm"
            />
            <input
              value={newFromName}
              onChange={(e) => setNewFromName(e.target.value)}
              placeholder={t('partners.outreach.fromName', 'From name (optional)')}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm"
            />
            <input
              value={newFromEmail}
              onChange={(e) => setNewFromEmail(e.target.value)}
              placeholder={t('partners.outreach.fromEmail', 'From email (optional)')}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm"
            />
            <input
              value={newReplyTo}
              onChange={(e) => setNewReplyTo(e.target.value)}
              placeholder={t('partners.outreach.replyTo', 'Reply-to (optional)')}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm"
            />
          </div>
          <input
            value={stepSubject}
            onChange={(e) => setStepSubject(e.target.value)}
            placeholder={t('partners.outreach.stepSubject', 'Step 1 subject')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm w-full"
          />
          <textarea
            value={stepBodyText}
            onChange={(e) => setStepBodyText(e.target.value)}
            placeholder={t(
              'partners.outreach.stepBody',
              'Step 1 body (text). Use {FirstName}, {Company}.'
            )}
            className="w-full h-24 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-900 dark:text-white">
            {t('partners.outreach.campaigns', 'Campaigns')}
          </h3>
          <button
            onClick={fetchCampaigns}
            className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
        {loadingCampaigns ? (
          <div className="text-sm text-slate-500">{t('common.loading', 'Loading...')}</div>
        ) : normalizeCampaigns(campaigns).length === 0 ? (
          <div className="text-sm text-slate-500">
            {t('partners.outreach.noCampaigns', 'No campaigns yet')}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {normalizeCampaigns(campaigns).map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white truncate">
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-500">
                    {t('partners.outreach.status', 'Status')}: {c.status} •{' '}
                    {t('partners.outreach.enrollments', 'Enrollments')}: {c.enrollments_total || 0}{' '}
                    • {t('partners.outreach.sent', 'Sent')}: {c.sent_count || 0}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.status === 'draft' || c.status === 'paused' ? (
                    <button
                      onClick={() =>
                        c.status === 'paused' ? resumeCampaign(c.id) : startCampaign(c.id)
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                    >
                      <Play className="w-4 h-4" />
                      {c.status === 'paused'
                        ? t('partners.outreach.resume', 'Resume')
                        : t('partners.outreach.start', 'Start')}
                    </button>
                  ) : (
                    <button
                      onClick={() => pauseCampaign(c.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm"
                    >
                      <Pause className="w-4 h-4" />
                      {t('partners.outreach.pause', 'Pause')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerOutreachPanel;

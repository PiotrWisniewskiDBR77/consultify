import { AlertCircle, ArrowRight, Building2, Check, Globe2, ShieldCheck, User } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

/**
 * OrgSetupWizard — Phase D: Organization Setup
 *
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-D1: Organization as Decision Container
 * - EPIC-D2: Deliberate Slowness Over Convenience
 * - EPIC-D3: System Memory Activation
 *
 * RULES:
 * - 4 steps required, no shortcuts
 * - No defaults pre-selected
 * - Memory activation requires explicit consent
 * - Language is organizational, not personal
 *
 * OUTPUT: Organization created with memory activated
 */

type OrgType = 'OPERATING' | 'CONSULTING' | null;
type OrgUserRole = 'EXECUTIVE' | 'DIRECTOR' | 'MANAGER' | 'SPECIALIST' | 'CONSULTANT' | null;
type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+' | null;

interface OrgSetupState {
  orgName: string;
  domain: string;
  country: string;
  vatNumber: string;
  userRole: OrgUserRole;
  userTitle: string;
  phone: string;
  orgType: OrgType;
  industry: string;
  companySize: CompanySize;
  memoryConsent: boolean;
  isSubmitting: boolean;
}

/** Listy wyboru = ENUMY zapisywane w bazie → słowniki kluczy (PLAN §2 pkt 6). */
const INDUSTRIES = ['technology', 'financial', 'healthcare', 'manufacturing', 'professional', 'other'];

const COMPANY_SIZES = [
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1000' },
  { value: '1000+', label: '1000+' },
];

const COUNTRIES = ['PL', 'DE', 'UK', 'US', 'OTHER'];

const USER_ROLES: OrgUserRole[] = [
  'EXECUTIVE' as OrgUserRole,
  'DIRECTOR' as OrgUserRole,
  'MANAGER' as OrgUserRole,
  'SPECIALIST' as OrgUserRole,
  'CONSULTANT' as OrgUserRole,
];

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'proton.me',
  'protonmail.com',
  'wp.pl',
  'o2.pl',
  'interia.pl',
]);

function normalizeDomain(value?: string | null): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

function getBusinessDomain(email?: string | null): string {
  const domain = normalizeDomain(email?.split('@')[1]);
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return '';
  return domain;
}

function humanizeOrgNameFromDomain(domain: string): string {
  if (!domain) return '';
  const root = domain.split('.')[0] || '';
  if (!root) return '';
  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const OrgSetupWizard: React.FC = () => {
  const { t } = useTranslation();
  const { setCurrentView, currentUser, currentOrganization } = useAppStore();
  const suggestedDomain = normalizeDomain(
    currentOrganization?.name ? '' : getBusinessDomain(currentUser?.email)
  );
  const suggestedOrgName =
    currentOrganization?.name ||
    currentUser?.companyName ||
    humanizeOrgNameFromDomain(suggestedDomain);

  const handleSkipSetup = async () => {
    try {
      await Api.post('/onboarding/skip', {});
    } catch {
      // Fallback: try direct org update
      const orgId = currentOrganization?.id;
      if (orgId) {
        await Api.put(`/organizations/${orgId}`, {
          onboardingStatus: 'ORG_SETUP_COMPLETED',
        }).catch(() => undefined);
      }
    }
    setCurrentView(AppView.AI_CHAT);
  };

  const [state, setState] = useState<OrgSetupState>({
    orgName: suggestedOrgName,
    domain: suggestedDomain,
    country: currentUser?.country || '',
    vatNumber: '',
    userRole: null,
    userTitle: currentUser?.title || currentUser?.jobTitle || '',
    phone: currentUser?.phone || '',
    orgType: null,
    industry: '',
    companySize: null,
    memoryConsent: false,
    isSubmitting: false,
  });

  const updateState = (updates: Partial<OrgSetupState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const canSubmit = state.orgName.trim().length >= 2 && state.memoryConsent;

  const handleCreateOrganization = async () => {
    if (!canSubmit) return;

    updateState({ isSubmitting: true });

    try {
      const org = await Api.post('/organizations', {
        name: state.orgName,
        industry: state.industry,
        domain: state.domain,
        vatNumber: state.vatNumber || undefined,
        attributionData: {
          orgProfileType: state.orgType,
          userRole: state.userRole,
          companySize: state.companySize,
          country: state.country,
          memoryActivated: true,
          memoryConsentAt: new Date().toISOString(),
        },
      });

      if (org?.id) {
        try {
          if (currentUser?.id && (state.userTitle.trim() || state.phone.trim())) {
            await Api.put(`/users/${currentUser.id}`, {
              title: state.userTitle.trim() || undefined,
              phone: state.phone.trim() || undefined,
            });
          }
        } catch {
          // Non-blocking: organization setup is more important than profile enrichment.
        }

        try {
          await Api.put(`/organizations/${org.id}`, { onboardingStatus: 'ORG_SETUP_COMPLETED' });
        } catch {
          // Non-blocking: the main organization row already exists.
        }

        toast.success(t('organization.setupWizard.created', 'Organization created. Trial data filled in.'));
        trackFunnelEvent('trial_org_setup_completed', {
          organizationId: org.id,
          industry: state.industry,
          orgProfileType: state.orgType,
          userRole: state.userRole,
          companySize: state.companySize,
          country: state.country,
        });
        setCurrentView(AppView.ONBOARDING_WIZARD); // Move to Phase E
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('organization.setupWizard.createFailed', 'Could not create the organization');
      toast.error(message);
    } finally {
      updateState({ isSubmitting: false });
    }
  };

  return (
    <div className="min-h-screen bg-c-surface px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-c-border-subtle/80 bg-c-surface shadow-sm dark:border-navy-700 dark:bg-navy-900/90">
          <div className="border-b border-c-border-subtle px-6 py-6 dark:border-navy-700 sm:px-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
              <Building2 size={14} />
              {t('organization.setupWizard.badge', 'New organization')}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy-900 dark:text-white">
              {t('organization.setupWizard.heading', 'Create a space for your team')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-c-text-secondary sm:text-base">
              {t('organization.setupWizard.subheading', 'Start with a name. You can refine the rest now or later in the organization settings.')}
            </p>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-3 rounded-2xl border border-c-border-subtle bg-c-bg/80 p-4 text-sm text-c-text-secondary dark:border-navy-700 dark:bg-navy-950/60 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{t('organization.setupWizard.bullet1', 'You are creating a shared space for decisions, knowledge and the team\'s work.')}</span>
              </div>
              <div className="flex items-start gap-3">
                <Globe2 size={16} className="mt-0.5 shrink-0 text-primary-500" />
                <span>{t('organization.setupWizard.bullet2', 'Domain, country and industry help set sensible context from the start.')}</span>
              </div>
              <div className="flex items-start gap-3">
                <User size={16} className="mt-0.5 shrink-0 text-sky-500" />
                <span>{t('organization.setupWizard.bullet3', 'You can add team members and extra settings later.')}</span>
              </div>
            </div>

            <section className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                  {t('organization.setupWizard.orgName', 'Organization name')}
                </label>
                <input
                  type="text"
                  value={state.orgName}
                  onChange={(e) => updateState({ orgName: e.target.value })}
                  placeholder={t('organization.setupWizard.orgNamePh', 'e.g. "VTS Group" or "PMO Europe"')}
                  className="w-full rounded-xl border-2 border-c-border-subtle bg-c-surface px-4 py-3 text-lg text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  autoFocus
                />
                <p className="mt-2 text-sm text-c-text-muted">{t('organization.setupWizard.orgNameHint', 'This is the only field required to start.')}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.domain', 'Domain or website')}
                  </label>
                  <input
                    type="text"
                    value={state.domain}
                    onChange={(e) => updateState({ domain: normalizeDomain(e.target.value) })}
                    placeholder={t('organization.setupWizard.domainPh', 'e.g. vtsgroup.com')}
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.country', 'Country')}
                  </label>
                  <select
                    value={state.country}
                    onChange={(e) => updateState({ country: e.target.value })}
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  >
                    <option value="">{t('organization.setupWizard.selectOrSkip', 'Select or skip')}</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`organization.setupWizard.countryOption.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <details className="group rounded-2xl border border-c-border-subtle bg-c-surface p-4 dark:border-navy-700 dark:bg-navy-950/30">
              <summary className="cursor-pointer list-none text-sm font-semibold text-c-text">
                {t('organization.setupWizard.detailsSummary', 'Refine now or do it later')}
                <span className="ml-2 text-xs font-normal text-c-text-muted">
                  {t('organization.setupWizard.detailsHint', 'role, industry, size, VAT')}
                </span>
              </summary>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.userTitle', 'Your job title')}
                  </label>
                  <input
                    type="text"
                    value={state.userTitle}
                    onChange={(e) => updateState({ userTitle: e.target.value })}
                    placeholder={t('organization.setupWizard.userTitlePh', 'e.g. CFO, PMO Lead')}
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.phone', 'Phone')}
                  </label>
                  <input
                    type="tel"
                    value={state.phone}
                    onChange={(e) => updateState({ phone: e.target.value })}
                    placeholder="+48 123 456 789"
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.userRole', 'Your role')}
                  </label>
                  <select
                    value={state.userRole || ''}
                    onChange={(e) =>
                      updateState({ userRole: (e.target.value as OrgUserRole) || null })
                    }
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  >
                    <option value="">{t('organization.setupWizard.notNow', 'Not now')}</option>
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role || ''}>
                        {t(`organization.setupWizard.userRoleOption.${role}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.orgType', 'Organization type')}
                  </label>
                  <select
                    value={state.orgType || ''}
                    onChange={(e) => updateState({ orgType: (e.target.value as OrgType) || null })}
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  >
                    <option value="">{t('organization.setupWizard.notNow', 'Not now')}</option>
                    <option value="OPERATING">{t('organization.setupWizard.orgTypeOption.OPERATING', 'Operating company')}</option>
                    <option value="CONSULTING">{t('organization.setupWizard.orgTypeOption.CONSULTING', 'Consulting / advisory')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.industry', 'Industry')}
                  </label>
                  <select
                    value={state.industry}
                    onChange={(e) => updateState({ industry: e.target.value })}
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  >
                    <option value="">{t('organization.setupWizard.notNow', 'Not now')}</option>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>
                        {t(`organization.setupWizard.industryOption.${ind}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.companySize', 'Organization size')}
                  </label>
                  <select
                    value={state.companySize || ''}
                    onChange={(e) =>
                      updateState({ companySize: (e.target.value as CompanySize) || null })
                    }
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  >
                    <option value="">{t('organization.setupWizard.notNow', 'Not now')}</option>
                    {COMPANY_SIZES.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-c-text-secondary">
                    {t('organization.setupWizard.vat', 'Tax ID / VAT')}
                  </label>
                  <input
                    type="text"
                    value={state.vatNumber}
                    onChange={(e) => updateState({ vatNumber: e.target.value })}
                    placeholder={t('organization.setupWizard.vatPh', 'e.g. LU12345678 or PL1234567890')}
                    className="w-full rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3 text-navy-900 outline-none transition-colors focus:border-primary-500 dark:border-navy-700 dark:bg-navy-950 dark:text-white"
                  />
                </div>
              </div>
            </details>

            <section className="rounded-2xl border border-c-border-subtle bg-c-bg/80 p-5 dark:border-navy-700 dark:bg-navy-950/60">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-primary-600 dark:text-primary-300"
                  size={20}
                />
                <div>
                  <h2 className="font-semibold text-c-text">{t('organization.setupWizard.memoryTitle', 'Organization memory')}</h2>
                  <p className="mt-1 text-sm text-c-text-secondary">
                    {t('organization.setupWizard.memoryBody', 'The system will remember the organization\'s context, agreements and conclusions so that later interactions stay continuous.')}
                  </p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={state.memoryConsent}
                  onChange={(e) => updateState({ memoryConsent: e.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-c-border text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                />
                <span className="text-sm text-c-text-secondary">
                  {t('organization.setupWizard.memoryConsent', 'I understand and accept that the work memory belongs to the organization, not to an individual person.')}
                </span>
              </label>

              {!state.memoryConsent && (
                <div className="mt-3 flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {t('organization.setupWizard.memoryRequired', 'Confirming organization memory is required to create the workspace.')}
                  </span>
                </div>
              )}
            </section>

            <div className="flex flex-col-reverse gap-3 border-t border-c-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-navy-700">
              <div className="text-sm text-c-text-muted">
                {t('organization.setupWizard.changeLater', 'You can change all of this later in the organization settings.')}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button
                  onClick={handleSkipSetup}
                  className="text-sm text-c-text-muted transition-colors hover:text-c-text-secondary dark:hover:text-slate-200"
                >
                  {t('organization.setupWizard.skip', 'Skip setup')}
                </button>
                <button
                  onClick={handleCreateOrganization}
                  disabled={!canSubmit || state.isSubmitting}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition-colors ${
                    canSubmit && !state.isSubmitting
                      ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800'
                      : 'cursor-not-allowed bg-slate-200 text-c-text-secondary dark:bg-slate-800 dark:text-c-text-muted'
                  }`}
                >
                  {state.isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{t('organization.setupWizard.submitting', 'Creating…')}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('organization.setupWizard.submit', 'Create organization')}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgSetupWizard;

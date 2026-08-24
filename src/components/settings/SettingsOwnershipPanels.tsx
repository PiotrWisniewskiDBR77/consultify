import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  Link2,
  Settings2,
  Shield,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { Button } from '../ui/primitives/Button';
import type { SettingsSection } from './SettingsSidebar';
import { SettingsTaxonomyPanel } from './SettingsTaxonomyPanel';

type RegistryResolveResponse = {
  value: unknown;
  source: 'personal' | 'module' | 'tenant' | 'system' | 'default';
};

type ModulePreferenceCard = {
  id: string;
  title: string;
  target: SettingsSection;
  values: [string, string][];
  notice?: string;
};

type OrganizationContextSummary = {
  profile?: {
    defaultLanguage?: string | null;
    defaultTimezone?: string | null;
    currency?: string | null;
    brandColor?: string | null;
    accentColor?: string | null;
    customDomain?: string | null;
  };
  trust?: {
    mfa?: { required?: boolean };
    sso?: { enforced?: boolean; provider?: string | null; configured?: boolean };
    security?: { sessionTimeout?: number | null };
  };
};

type SettingsOwnershipPanelsProps = {
  mode:
    | 'overview'
    | 'tenant-defaults'
    | 'tenant-branding'
    | 'tenant-security'
    | 'module-preferences';
  onOpenSection?: (section: SettingsSection) => void;
};

const RESOLVE_KEYS = [
  'default_language',
  'default_timezone',
  'default_currency',
  'default_sharing_mode',
  'mfa_required',
  'sso_enforced',
  'session_timeout_minutes',
  'guest_access_enabled',
  'external_link_sharing',
  'tool_approval_required',
  'default_tool_visibility',
  'recording_auto_start',
  'ai_transcription_enabled',
  'default_export_format',
  'scoring_scale',
  'model_preference',
  'citation_style',
] as const;

function formatValue(value: unknown, t: TFunction): string {
  if (value === null || value === undefined || value === '') {
    return t('settings.ownership.value.notConfigured', 'Not configured');
  }
  if (typeof value === 'boolean') {
    return value
      ? t('settings.ownership.value.enabled', 'Enabled')
      : t('settings.ownership.value.disabled', 'Disabled');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function useSettingsOwnershipData(t: TFunction) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgContext, setOrgContext] = useState<OrganizationContextSummary | null>(null);
  const [resolved, setResolved] = useState<Record<string, RegistryResolveResponse>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [context, ...registryValues] = await Promise.all([
          Api.get('/organization-context'),
          ...RESOLVE_KEYS.map((key) => Api.get(`/settings/registry/${key}/resolve`)),
        ]);

        if (cancelled) return;

        const nextResolved = registryValues.reduce<Record<string, RegistryResolveResponse>>(
          (acc, item, index) => {
            acc[RESOLVE_KEYS[index]] = item as RegistryResolveResponse;
            return acc;
          },
          {}
        );

        setOrgContext((context || {}) as OrganizationContextSummary);
        setResolved(nextResolved);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          normalizeApiErrorMessage(
            err,
            t('settings.ownership.loadError', 'Failed to load settings ownership data.')
          )
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return { loading, error, orgContext, resolved };
}

const SectionCard: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, actionLabel, onAction, children }) => (
  <section className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 bg-c-surface p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-c-accent-soft text-c-accent dark:bg-c-accent-soft">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-c-text">{title}</h3>
          <p className="mt-1 text-sm text-c-text-secondary">{subtitle}</p>
        </div>
      </div>
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction} className="shrink-0">
          {actionLabel}
        </Button>
      ) : null}
    </div>
    <div className="mt-4 space-y-3">{children}</div>
  </section>
);

const ValueRow: React.FC<{
  label: string;
  value: string;
  source?: string;
  readOnly?: boolean;
  t: TFunction;
}> = ({ label, value, source, readOnly = false, t }) => (
  <div className="flex flex-col gap-1 rounded-xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-c-text">{label}</span>
      {readOnly ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {t('settings.ownership.readOnly', 'Read-only')}
        </span>
      ) : null}
    </div>
    <div className="text-sm text-c-text-secondary">{value}</div>
    {source ? (
      <div className="text-xs uppercase tracking-wide text-c-text-muted">
        {t('settings.ownership.source', 'Source')}: {source}
      </div>
    ) : null}
  </div>
);

const EmptyState: React.FC<{ error?: string | null; t: TFunction }> = ({ error, t }) => (
  <div
    role="alert"
    className="rounded-2xl border border-dashed border-c-border-subtle dark:border-navy-700 bg-c-surface-raised p-6 text-sm text-c-text-secondary"
  >
    <div className="flex items-center gap-3">
      <AlertTriangle size={18} className="text-amber-500" />
      <span>
        {error ||
          t(
            'settings.ownership.unavailable',
            'Settings ownership data is temporarily unavailable.'
          )}
      </span>
    </div>
  </div>
);

function TenantDefaultsPanel({
  resolved,
  onOpenOrganization,
  t,
}: {
  resolved: Record<string, RegistryResolveResponse>;
  onOpenOrganization: () => void;
  t: TFunction;
}) {
  return (
    <SectionCard
      title={t('settings.ownership.tenantDefaults.title', 'Tenant defaults')}
      subtitle={t(
        'settings.ownership.tenantDefaults.subtitle',
        'Organization defaults are visible in Settings, but their source of truth stays in Organization or tenant-level policy.'
      )}
      icon={Building2}
      actionLabel={t('settings.ownership.openOrganization', 'Open Organization')}
      onAction={onOpenOrganization}
    >
      <ValueRow
        label={t('settings.ownership.defaultLanguage', 'Default language')}
        value={formatValue(resolved.default_language?.value, t)}
        source={resolved.default_language?.source}
        readOnly
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.defaultTimezone', 'Default timezone')}
        value={formatValue(resolved.default_timezone?.value, t)}
        source={resolved.default_timezone?.source}
        readOnly
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.defaultCurrency', 'Default currency')}
        value={formatValue(resolved.default_currency?.value, t)}
        source={resolved.default_currency?.source}
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.defaultSharingMode', 'Default sharing mode')}
        value={formatValue(resolved.default_sharing_mode?.value, t)}
        source={resolved.default_sharing_mode?.source}
        t={t}
      />
    </SectionCard>
  );
}

function TenantBrandingPanel({
  orgContext,
  onOpenBranding,
  t,
}: {
  orgContext: OrganizationContextSummary | null;
  onOpenBranding: () => void;
  t: TFunction;
}) {
  return (
    <SectionCard
      title={t('settings.ownership.branding.title', 'Branding reuse from P30')}
      subtitle={t(
        'settings.ownership.branding.subtitle',
        'Branding fields are consumed read-only from the organization context. Settings does not write organization branding.'
      )}
      icon={Sparkles}
      actionLabel={t('settings.ownership.openBranding', 'Open Branding')}
      onAction={onOpenBranding}
    >
      <ValueRow
        label={t('settings.ownership.brandColor', 'Brand color')}
        value={formatValue(orgContext?.profile?.brandColor, t)}
        readOnly
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.accentColor', 'Accent color')}
        value={formatValue(orgContext?.profile?.accentColor, t)}
        readOnly
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.customDomain', 'Custom domain')}
        value={formatValue(orgContext?.profile?.customDomain, t)}
        readOnly
        t={t}
      />
    </SectionCard>
  );
}

function TenantSecurityPanel({
  resolved,
  orgContext,
  onOpenAdmin,
  t,
}: {
  resolved: Record<string, RegistryResolveResponse>;
  orgContext: OrganizationContextSummary | null;
  onOpenAdmin: () => void;
  t: TFunction;
}) {
  const ssoProvider = orgContext?.trust?.sso?.provider;
  const sessionTimeout =
    typeof resolved.session_timeout_minutes?.value === 'number'
      ? resolved.session_timeout_minutes.value
      : null;

  return (
    <SectionCard
      title={t('settings.ownership.security.title', 'Security handoff to Admin')}
      subtitle={t(
        'settings.ownership.security.subtitle',
        'Security policy remains visible here with clear impact, but all writes route to Admin.'
      )}
      icon={Shield}
      actionLabel={t('settings.ownership.openAdminSecurity', 'Open Admin Security')}
      onAction={onOpenAdmin}
    >
      <ValueRow
        label={t('settings.ownership.mfaRequired', 'MFA required')}
        value={formatValue(resolved.mfa_required?.value, t)}
        source={resolved.mfa_required?.source}
        readOnly
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.ssoEnforced', 'SSO enforced')}
        value={`${formatValue(resolved.sso_enforced?.value, t)}${ssoProvider ? ` (${ssoProvider})` : ''}`}
        source={resolved.sso_enforced?.source}
        readOnly
        t={t}
      />
      <ValueRow
        label={t('settings.ownership.sessionTimeout', 'Session timeout')}
        value={
          sessionTimeout !== null
            ? t('settings.ownership.minutes', '{{count}} minutes', {
                count: sessionTimeout,
              })
            : t('settings.ownership.value.notConfigured', 'Not configured')
        }
        source={resolved.session_timeout_minutes?.source}
        readOnly
        t={t}
      />
      <CollaborationControlsPlannedNotice t={t} />
    </SectionCard>
  );
}

/**
 * DEC-2026-08-24-12 — guest access, external link sharing, and tool approval
 * required are not enforced anywhere downstream (see
 * AdminCollaborationControlsPanel.tsx for the full rationale). Showing them
 * here as read-only values would repeat the same "policy placebo" the owner
 * ruled out for the Admin panel, so both places share this notice instead.
 */
const CollaborationControlsPlannedNotice: React.FC<{ t: TFunction }> = ({ t }) => (
  <div className="flex items-start gap-3 rounded-xl border border-dashed border-c-border-subtle dark:border-navy-700 bg-c-surface-raised px-4 py-3">
    <Link2 size={16} className="mt-0.5 shrink-0 text-c-text-muted" aria-hidden="true" />
    <p className="text-sm text-c-text-secondary">
      {t(
        'admin.security.collaborationControls.plannedNotice',
        'Planned — this policy will be enforced once implemented.'
      )}
    </p>
  </div>
);

function ModulePreferencesPanel({
  resolved,
  onOpenSection,
  t,
}: {
  resolved: Record<string, RegistryResolveResponse>;
  onOpenSection?: (section: SettingsSection) => void;
  t: TFunction;
}) {
  const cards = useMemo<ModulePreferenceCard[]>(
    () => [
      {
        id: 'interview',
        title: t('settings.ownership.modules.interview', 'Interview'),
        target: 'work-preferences' as SettingsSection,
        values: [
          [
            t('settings.ownership.recordingAutoStart', 'Recording auto-start'),
            formatValue(resolved.recording_auto_start?.value, t),
          ],
          [
            t('settings.ownership.aiTranscription', 'AI transcription'),
            formatValue(resolved.ai_transcription_enabled?.value, t),
          ],
        ],
      },
      {
        id: 'tools',
        title: t('settings.ownership.modules.tools', 'Tools'),
        target: 'connected-apps' as SettingsSection,
        values: [
          [
            t('settings.ownership.defaultToolVisibility', 'Default tool visibility'),
            formatValue(resolved.default_tool_visibility?.value, t),
          ],
        ],
        // DEC-2026-08-24-12 — tool approval is not enforced downstream; show
        // the same planned notice as AdminCollaborationControlsPanel instead
        // of a read-only value.
        notice: t(
          'admin.security.collaborationControls.plannedNotice',
          'Planned — this policy will be enforced once implemented.'
        ),
      },
      {
        id: 'outputs',
        title: t('settings.ownership.modules.outputs', 'Outputs'),
        target: 'import-export' as SettingsSection,
        values: [
          [
            t('settings.ownership.defaultExportFormat', 'Default export format'),
            formatValue(resolved.default_export_format?.value, t),
          ],
        ],
      },
      {
        id: 'assessment',
        title: t('settings.ownership.modules.assessment', 'Assessment'),
        target: 'work-preferences' as SettingsSection,
        values: [
          [
            t('settings.ownership.scoringScale', 'Scoring scale'),
            formatValue(resolved.scoring_scale?.value, t),
          ],
        ],
      },
      {
        id: 'copilot',
        title: t('settings.ownership.modules.copilot', 'AI / Copilot'),
        target: 'ai-model-params' as SettingsSection,
        values: [
          [
            t('settings.ownership.modelPreference', 'Model preference'),
            formatValue(resolved.model_preference?.value, t),
          ],
          [
            t('settings.ownership.citationStyle', 'Citation style'),
            formatValue(resolved.citation_style?.value, t),
          ],
        ],
      },
    ],
    [resolved, t]
  );

  return (
    <SectionCard
      title={t('settings.ownership.modulePreferences.title', 'Module preferences')}
      subtitle={t(
        'settings.ownership.modulePreferences.subtitle',
        'Module settings stay discoverable under one Settings root while inheriting the same ownership model.'
      )}
      icon={Settings2}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-c-text">{card.title}</div>
                <div className="mt-2 space-y-1 text-sm text-c-text-secondary">
                  {card.values.map(([label, value]) => (
                    <div key={label}>
                      <span className="font-medium text-c-text">{label}:</span> {value}
                    </div>
                  ))}
                  {card.notice ? (
                    <div className="flex items-start gap-1.5 pt-1 text-xs text-c-text-muted">
                      <Link2 size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{card.notice}</span>
                    </div>
                  ) : null}
                </div>
              </div>
              {onOpenSection ? (
                <Button variant="ghost" size="sm" onClick={() => onOpenSection(card.target)}>
                  <ExternalLink size={14} />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export const SettingsOwnershipPanels: React.FC<SettingsOwnershipPanelsProps> = ({
  mode,
  onOpenSection,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { loading, error, orgContext, resolved } = useSettingsOwnershipData(t);

  const openOrganizationProfile = () => navigate(ROUTES.ORGANIZATION.PROFILE);
  const openOrganizationBranding = () => navigate(ROUTES.ORGANIZATION.BRANDING);
  const openAdminSecurity = () => navigate(`${ROUTES.ADMIN.ROOT}?tab=security`);

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  if (error) {
    return <EmptyState error={error} t={t} />;
  }

  if (mode === 'overview') {
    return (
      <div className="space-y-6">
        <SettingsTaxonomyPanel />
        <TenantDefaultsPanel
          resolved={resolved}
          onOpenOrganization={openOrganizationProfile}
          t={t}
        />
        <TenantSecurityPanel
          resolved={resolved}
          orgContext={orgContext}
          onOpenAdmin={openAdminSecurity}
          t={t}
        />
        <ModulePreferencesPanel resolved={resolved} onOpenSection={onOpenSection} t={t} />
      </div>
    );
  }

  if (mode === 'tenant-defaults') {
    return (
      <TenantDefaultsPanel resolved={resolved} onOpenOrganization={openOrganizationProfile} t={t} />
    );
  }

  if (mode === 'tenant-branding') {
    return (
      <TenantBrandingPanel
        orgContext={orgContext}
        onOpenBranding={openOrganizationBranding}
        t={t}
      />
    );
  }

  if (mode === 'tenant-security') {
    return (
      <TenantSecurityPanel
        resolved={resolved}
        orgContext={orgContext}
        onOpenAdmin={openAdminSecurity}
        t={t}
      />
    );
  }

  return <ModulePreferencesPanel resolved={resolved} onOpenSection={onOpenSection} t={t} />;
};

export default SettingsOwnershipPanels;

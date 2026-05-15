import {
  AlertTriangle,
  Building2,
  ExternalLink,
  Loader2,
  Settings2,
  Shield,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';

import { Api } from '../../services/api';
import { Button } from '../ui/primitives/Button';
import type { SettingsSection } from './SettingsSidebar';
import { SettingsTaxonomyPanel } from './SettingsTaxonomyPanel';

type RegistryResolveResponse = {
  value: unknown;
  source: 'personal' | 'module' | 'tenant' | 'system' | 'default';
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not configured';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function useSettingsOwnershipData() {
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
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load settings ownership data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

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
  <section className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
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
}> = ({ label, value, source, readOnly = false }) => (
  <div className="flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950/60 px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      {readOnly ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          Read-only
        </span>
      ) : null}
    </div>
    <div className="text-sm text-slate-700 dark:text-slate-300">{value}</div>
    {source ? (
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
        Source: {source}
      </div>
    ) : null}
  </div>
);

const EmptyState: React.FC<{ error?: string | null }> = ({ error }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-950/60 p-6 text-sm text-slate-600 dark:text-slate-400">
    <div className="flex items-center gap-3">
      <AlertTriangle size={18} className="text-amber-500" />
      <span>{error || 'Settings ownership data is temporarily unavailable.'}</span>
    </div>
  </div>
);

function TenantDefaultsPanel({
  resolved,
  onOpenOrganization,
}: {
  resolved: Record<string, RegistryResolveResponse>;
  onOpenOrganization: () => void;
}) {
  return (
    <SectionCard
      title="Tenant defaults"
      subtitle="Organization defaults are visible in Settings, but their source of truth stays in Organization or tenant-level policy."
      icon={Building2}
      actionLabel="Open Organization"
      onAction={onOpenOrganization}
    >
      <ValueRow
        label="Default language"
        value={formatValue(resolved.default_language?.value)}
        source={resolved.default_language?.source}
        readOnly
      />
      <ValueRow
        label="Default timezone"
        value={formatValue(resolved.default_timezone?.value)}
        source={resolved.default_timezone?.source}
        readOnly
      />
      <ValueRow
        label="Default currency"
        value={formatValue(resolved.default_currency?.value)}
        source={resolved.default_currency?.source}
      />
      <ValueRow
        label="Default sharing mode"
        value={formatValue(resolved.default_sharing_mode?.value)}
        source={resolved.default_sharing_mode?.source}
      />
    </SectionCard>
  );
}

function TenantBrandingPanel({
  orgContext,
  onOpenBranding,
}: {
  orgContext: OrganizationContextSummary | null;
  onOpenBranding: () => void;
}) {
  return (
    <SectionCard
      title="Branding reuse from P30"
      subtitle="Branding fields are consumed read-only from the organization context. Settings does not write organization branding."
      icon={Sparkles}
      actionLabel="Open Branding"
      onAction={onOpenBranding}
    >
      <ValueRow label="Brand color" value={formatValue(orgContext?.profile?.brandColor)} readOnly />
      <ValueRow
        label="Accent color"
        value={formatValue(orgContext?.profile?.accentColor)}
        readOnly
      />
      <ValueRow
        label="Custom domain"
        value={formatValue(orgContext?.profile?.customDomain)}
        readOnly
      />
    </SectionCard>
  );
}

function TenantSecurityPanel({
  resolved,
  orgContext,
  onOpenAdmin,
}: {
  resolved: Record<string, RegistryResolveResponse>;
  orgContext: OrganizationContextSummary | null;
  onOpenAdmin: () => void;
}) {
  const ssoProvider = orgContext?.trust?.sso?.provider;

  return (
    <SectionCard
      title="Security handoff to Admin"
      subtitle="Security policy remains visible here with clear impact, but all writes route to Admin."
      icon={Shield}
      actionLabel="Open Admin Security"
      onAction={onOpenAdmin}
    >
      <ValueRow
        label="MFA required"
        value={formatValue(resolved.mfa_required?.value)}
        source={resolved.mfa_required?.source}
        readOnly
      />
      <ValueRow
        label="SSO enforced"
        value={`${formatValue(resolved.sso_enforced?.value)}${ssoProvider ? ` (${ssoProvider})` : ''}`}
        source={resolved.sso_enforced?.source}
        readOnly
      />
      <ValueRow
        label="Session timeout"
        value={
          resolved.session_timeout_minutes?.value
            ? `${resolved.session_timeout_minutes.value} minutes`
            : 'Not configured'
        }
        source={resolved.session_timeout_minutes?.source}
        readOnly
      />
      <ValueRow
        label="Guest access"
        value={formatValue(resolved.guest_access_enabled?.value)}
        source={resolved.guest_access_enabled?.source}
        readOnly
      />
      <ValueRow
        label="External link sharing"
        value={formatValue(resolved.external_link_sharing?.value)}
        source={resolved.external_link_sharing?.source}
        readOnly
      />
      <ValueRow
        label="Tool approval required"
        value={formatValue(resolved.tool_approval_required?.value)}
        source={resolved.tool_approval_required?.source}
        readOnly
      />
    </SectionCard>
  );
}

function ModulePreferencesPanel({
  resolved,
  onOpenSection,
}: {
  resolved: Record<string, RegistryResolveResponse>;
  onOpenSection?: (section: SettingsSection) => void;
}) {
  const cards = useMemo(
    () => [
      {
        id: 'interview',
        title: 'Interview',
        target: 'work-preferences' as SettingsSection,
        values: [
          ['Recording auto-start', formatValue(resolved.recording_auto_start?.value)],
          ['AI transcription', formatValue(resolved.ai_transcription_enabled?.value)],
        ],
      },
      {
        id: 'tools',
        title: 'Tools',
        target: 'connected-apps' as SettingsSection,
        values: [
          ['Default tool visibility', formatValue(resolved.default_tool_visibility?.value)],
          ['Tool approval', formatValue(resolved.tool_approval_required?.value)],
        ],
      },
      {
        id: 'outputs',
        title: 'Outputs',
        target: 'import-export' as SettingsSection,
        values: [['Default export format', formatValue(resolved.default_export_format?.value)]],
      },
      {
        id: 'assessment',
        title: 'Assessment',
        target: 'work-preferences' as SettingsSection,
        values: [['Scoring scale', formatValue(resolved.scoring_scale?.value)]],
      },
      {
        id: 'copilot',
        title: 'AI / Copilot',
        target: 'ai-model-params' as SettingsSection,
        values: [
          ['Model preference', formatValue(resolved.model_preference?.value)],
          ['Citation style', formatValue(resolved.citation_style?.value)],
        ],
      },
    ],
    [resolved]
  );

  return (
    <SectionCard
      title="Module preferences"
      subtitle="Module settings stay discoverable under one Settings root while inheriting the same ownership model."
      icon={Settings2}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  {card.values.map(([label, value]) => (
                    <div key={label}>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {label}:
                      </span>{' '}
                      {value}
                    </div>
                  ))}
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
  const { loading, error, orgContext, resolved } = useSettingsOwnershipData();

  const openOrganizationProfile = () => navigate(ROUTES.ORGANIZATION.PROFILE);
  const openOrganizationBranding = () => navigate(ROUTES.ORGANIZATION.BRANDING);
  const openAdminSecurity = () => navigate(`${ROUTES.ADMIN.ROOT}?tab=security`);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return <EmptyState error={error} />;
  }

  if (mode === 'overview') {
    return (
      <div className="space-y-6">
        <SettingsTaxonomyPanel />
        <TenantDefaultsPanel resolved={resolved} onOpenOrganization={openOrganizationProfile} />
        <TenantSecurityPanel
          resolved={resolved}
          orgContext={orgContext}
          onOpenAdmin={openAdminSecurity}
        />
        <ModulePreferencesPanel resolved={resolved} onOpenSection={onOpenSection} />
      </div>
    );
  }

  if (mode === 'tenant-defaults') {
    return <TenantDefaultsPanel resolved={resolved} onOpenOrganization={openOrganizationProfile} />;
  }

  if (mode === 'tenant-branding') {
    return (
      <TenantBrandingPanel orgContext={orgContext} onOpenBranding={openOrganizationBranding} />
    );
  }

  if (mode === 'tenant-security') {
    return (
      <TenantSecurityPanel
        resolved={resolved}
        orgContext={orgContext}
        onOpenAdmin={openAdminSecurity}
      />
    );
  }

  return <ModulePreferencesPanel resolved={resolved} onOpenSection={onOpenSection} />;
};

export default SettingsOwnershipPanels;

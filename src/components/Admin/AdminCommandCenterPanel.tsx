/**
 * Admin Command Center Panel (F-CC1 fundament + F-CC2 pierwsze wiring,
 * blok Harvey-Parity HP-10…13).
 *
 * Sekcja `command` w hubie org-admina (`AdminSettingsModule`) — "Trust &
 * Control": przegląd posture spinający istniejące panele (role/SSO/audyt,
 * reużyte 1:1, NIE przepisane) + docelowo wiring 16 endpointów
 * `/api/admin/enterprise-compliance/*` (SOC2 export, DLP, data residency,
 * retencja, polityka AI).
 *
 * Zakres TEJ dostawy (F-CC1+F-CC2): zakładka "Przegląd" z kaflami-linkami
 * do people/security/audit (reuse, bez przepisywania) + dwa read-only kafle
 * podpięte pod realne endpointy (`GET /ai-policy`, `GET /data-residency`)
 * z jawnym stanem loading/error. Pozostałe zakładki (Audyt SOC2 / DLP /
 * Residency / Retencja / AI-policy) = szkielet z pustym stanem — pełny
 * wiring (tabele, formularze zapisu) to F-CC3/F-CC4.
 */
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Globe,
  Loader2,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import {
  type DataResidencyPolicy,
  getAiPolicy,
  getDataResidency,
  type OrgAiPolicy,
} from '../../services/enterpriseComplianceApi';
import { cn } from '../../utils/cn';
import type { AdminSettingsSection } from './AdminSettingsSidebar';
import { UnavailableState } from './AdminState';

type TabId = 'overview' | 'audit' | 'dlp' | 'residency' | 'retention' | 'ai-policy';

interface AdminCommandCenterPanelProps {
  onSectionChange?: (section: AdminSettingsSection) => void;
}

interface LinkTile {
  id: string;
  section: AdminSettingsSection;
  icon: React.ElementType;
  labelKey: string;
  labelDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
}

const LINK_TILES: LinkTile[] = [
  {
    id: 'people',
    section: 'people',
    icon: Users,
    labelKey: 'commandCenter.overview.tiles.people.label',
    labelDefault: 'Team & Access',
    descriptionKey: 'commandCenter.overview.tiles.people.description',
    descriptionDefault: 'Roles, ownership, and permissions for this organization.',
  },
  {
    id: 'security',
    section: 'security',
    icon: ShieldCheck,
    labelKey: 'commandCenter.overview.tiles.security.label',
    labelDefault: 'SSO & Identity',
    descriptionKey: 'commandCenter.overview.tiles.security.description',
    descriptionDefault: 'Authentication policy, SCIM lifecycle, and delegated IAM.',
  },
  {
    id: 'audit',
    section: 'audit',
    icon: ScrollText,
    labelKey: 'commandCenter.overview.tiles.audit.label',
    labelDefault: 'Audit Log',
    descriptionKey: 'commandCenter.overview.tiles.audit.description',
    descriptionDefault: 'High-risk admin events and compliance evidence.',
  },
];

const LinkTileCard: React.FC<{
  tile: LinkTile;
  onOpen?: (section: AdminSettingsSection) => void;
}> = ({ tile, onOpen }) => {
  const { t } = useTranslation();
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(tile.section)}
      className="group flex w-full flex-col items-start gap-3 rounded-xl border border-c-border bg-c-surface p-4 text-left transition hover:border-c-focus hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"
    >
      <div className="flex w-full items-start justify-between">
        <div className="rounded-lg bg-c-surface-raised p-2 text-c-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-c-text-muted transition group-hover:translate-x-0.5 group-hover:text-c-text-secondary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-c-text">
          {t(tile.labelKey, { defaultValue: tile.labelDefault })}
        </p>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(tile.descriptionKey, { defaultValue: tile.descriptionDefault })}
        </p>
      </div>
      <span className="text-xs font-medium text-c-text-secondary group-hover:text-c-text">
        {t('commandCenter.overview.tiles.open', { defaultValue: 'Open' })}
      </span>
    </button>
  );
};

interface DataTileState<T> {
  loading: boolean;
  error: string | null;
  value: T | null;
}

const DataTileShell: React.FC<{
  icon: React.ElementType;
  label: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}> = ({ icon: Icon, label, loading, error, children }) => (
  <div className="rounded-xl border border-c-border bg-c-surface p-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-c-text-secondary">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-2">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-c-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-c-danger">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const CommandCenterOverviewTab: React.FC<{
  onSectionChange?: (section: AdminSettingsSection) => void;
}> = ({ onSectionChange }) => {
  const { t } = useTranslation();
  const [residency, setResidency] = useState<DataTileState<DataResidencyPolicy>>({
    loading: true,
    error: null,
    value: null,
  });
  const [aiPolicy, setAiPolicy] = useState<DataTileState<OrgAiPolicy>>({
    loading: true,
    error: null,
    value: null,
  });

  const loadResidency = useCallback(async () => {
    setResidency((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const value = await getDataResidency();
      setResidency({ loading: false, error: null, value });
    } catch (error: any) {
      setResidency({
        loading: false,
        error:
          error?.message ||
          t('commandCenter.overview.tiles.residency.error', 'Failed to load data residency policy'),
        value: null,
      });
    }
  }, [t]);

  const loadAiPolicy = useCallback(async () => {
    setAiPolicy((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const value = await getAiPolicy();
      setAiPolicy({ loading: false, error: null, value });
    } catch (error: any) {
      setAiPolicy({
        loading: false,
        error:
          error?.message ||
          t('commandCenter.overview.tiles.aiPolicy.error', 'Failed to load AI policy'),
        value: null,
      });
    }
  }, [t]);

  useEffect(() => {
    void loadResidency();
    void loadAiPolicy();
  }, [loadResidency, loadAiPolicy]);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.overview.linksTitle', 'Trust surfaces')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'commandCenter.overview.linksSubtitle',
            'These live in their own sections — Command Center only links to them.'
          )}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {LINK_TILES.map((tile) => (
            <LinkTileCard key={tile.id} tile={tile} onOpen={onSectionChange} />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.overview.complianceTitle', 'Compliance posture')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'commandCenter.overview.complianceSubtitle',
            'Live from /api/admin/enterprise-compliance — org-scoped by token.'
          )}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <DataTileShell
            icon={Globe}
            label={t('commandCenter.overview.tiles.residency.label', 'Data residency')}
            loading={residency.loading}
            error={residency.error}
          >
            {residency.value && (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {residency.value.dataResidencyRegion ||
                    t('commandCenter.overview.tiles.residency.notSet', 'Not set')}
                </p>
                <p className="mt-1 text-xs text-c-text-secondary">
                  {residency.value.enforceEuOnly
                    ? t('commandCenter.overview.tiles.residency.euEnforced', 'EU-only enforced')
                    : t(
                        'commandCenter.overview.tiles.residency.euNotEnforced',
                        'EU-only not enforced'
                      )}
                </p>
              </div>
            )}
          </DataTileShell>

          <DataTileShell
            icon={Sparkles}
            label={t('commandCenter.overview.tiles.aiPolicy.label', 'Org AI policy')}
            loading={aiPolicy.loading}
            error={aiPolicy.error}
          >
            {aiPolicy.value && (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {t('commandCenter.overview.tiles.aiPolicy.citationMode', {
                    defaultValue: 'Citations: {{mode}}',
                    mode: aiPolicy.value.requiredCitationMode,
                  })}
                </p>
                <p className="mt-1 text-xs text-c-text-secondary">
                  {t('commandCenter.overview.tiles.aiPolicy.maxTokens', {
                    defaultValue: 'Max {{tokens}} tokens / message',
                    tokens: aiPolicy.value.maxTokensPerMessage,
                  })}
                </p>
              </div>
            )}
          </DataTileShell>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DataTileShell
          icon={Lock}
          label={t('commandCenter.overview.tiles.dlp.label', 'DLP rules')}
          loading={false}
          error={null}
        >
          <p className="text-sm text-c-text-secondary">
            {t('commandCenter.overview.tiles.dlp.comingSoon', 'Wired in a follow-up step (F-CC3).')}
          </p>
        </DataTileShell>
        <DataTileShell
          icon={Clock}
          label={t('commandCenter.overview.tiles.retention.label', 'Retention')}
          loading={false}
          error={null}
        >
          <p className="text-sm text-c-text-secondary">
            {t(
              'commandCenter.overview.tiles.retention.comingSoon',
              'Wired in a follow-up step (F-CC4).'
            )}
          </p>
        </DataTileShell>
      </div>
    </div>
  );
};

const PlaceholderTab: React.FC<{ titleKey: string; titleDefault: string }> = ({
  titleKey,
  titleDefault,
}) => {
  const { t } = useTranslation();
  return (
    <UnavailableState
      title={t(titleKey, { defaultValue: titleDefault })}
      description={t(
        'commandCenter.placeholder.description',
        'This tab is scheduled for a follow-up delivery step and is not wired yet.'
      )}
    />
  );
};

export const AdminCommandCenterPanel: React.FC<AdminCommandCenterPanelProps> = ({
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = useMemo(
    () => [
      {
        id: 'overview',
        label: t('commandCenter.tabs.overview', 'Overview'),
        icon: ShieldCheck,
      },
      {
        id: 'audit',
        label: t('commandCenter.tabs.audit', 'SOC2 audit'),
        icon: ScrollText,
      },
      {
        id: 'dlp',
        label: t('commandCenter.tabs.dlp', 'DLP'),
        icon: Lock,
      },
      {
        id: 'residency',
        label: t('commandCenter.tabs.residency', 'Data residency'),
        icon: Globe,
      },
      {
        id: 'retention',
        label: t('commandCenter.tabs.retention', 'Retention'),
        icon: Clock,
      },
      {
        id: 'ai-policy',
        label: t('commandCenter.tabs.aiPolicy', 'AI policy'),
        icon: Sparkles,
      },
    ],
    [t]
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = useMemo(() => {
    const raw = searchParams.get('tab');
    return tabs.some((tab) => tab.id === raw) ? (raw as TabId) : 'overview';
  }, [searchParams, tabs]);
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="text-lg font-semibold text-c-text">
          {t('commandCenter.title', 'Command Center')}
        </h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t(
            'commandCenter.description',
            'One trust & control surface — SOC2 audit export, DLP, data residency, retention, and org AI policy. Roles, SSO, and the audit log live in their own sections and are only linked from here.'
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                  activeTab === tab.id
                    ? 'bg-c-text text-c-bg'
                    : 'bg-transparent text-c-text-secondary hover:bg-c-surface-raised'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'overview' && <CommandCenterOverviewTab onSectionChange={onSectionChange} />}
      {activeTab === 'audit' && (
        <PlaceholderTab titleKey="commandCenter.tabs.audit" titleDefault="SOC2 audit" />
      )}
      {activeTab === 'dlp' && (
        <PlaceholderTab titleKey="commandCenter.tabs.dlp" titleDefault="DLP" />
      )}
      {activeTab === 'residency' && (
        <PlaceholderTab titleKey="commandCenter.tabs.residency" titleDefault="Data residency" />
      )}
      {activeTab === 'retention' && (
        <PlaceholderTab titleKey="commandCenter.tabs.retention" titleDefault="Retention" />
      )}
      {activeTab === 'ai-policy' && (
        <PlaceholderTab titleKey="commandCenter.tabs.aiPolicy" titleDefault="AI policy" />
      )}
    </div>
  );
};

export default AdminCommandCenterPanel;

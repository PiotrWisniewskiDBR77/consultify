/**
 * WorkflowDashboard — Unified dashboard for all workflow features:
 * Automations, Sync, Webhooks, Sharing, and Distributions.
 * Shows summary cards with quick links to each manager.
 */
import { ArrowRight, Bell, Loader2, RefreshCw, Send, Users, Webhook, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

import { AutomationsManager } from './automations/AutomationsManager';
import { WebhookRelayPanel } from './connectors/WebhookRelayPanel';
import { DistributionBuilder } from './DistributionBuilder';
import { SharingManager } from './sharing/SharingManager';
import { SyncManager } from './sync/SyncManager';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowDashboardProps {
  tableId: string;
  baseId: string;
  workspaceId: string;
  tables?: {
    id: string;
    name: string;
    fields?: { id: string; name: string; fieldType: string }[];
  }[];
  views?: { id: string; name: string; shareToken?: string }[];
  fields?: Array<{ id: string; name: string; fieldType: string }>;
  locked?: boolean;
}

type ActivePanel = null | 'automations' | 'sync' | 'webhooks' | 'sharing' | 'distributions';

interface DashboardStats {
  automationsCount: number;
  automationsActive: number;
  syncsCount: number;
  webhooksCount: number;
  distributionsCount: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowDashboard({
  tableId,
  baseId,
  workspaceId,
  tables = [],
  views = [],
  fields = [],
  locked,
}: WorkflowDashboardProps) {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [stats, setStats] = useState<DashboardStats>({
    automationsCount: 0,
    automationsActive: 0,
    syncsCount: 0,
    webhooksCount: 0,
    distributionsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const isLocked = Boolean(locked);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [automations, syncs, distributions] = await Promise.allSettled([
        TablePlatformApi.listAutomations(tableId),
        TablePlatformApi.listTableSyncs(tableId),
        TablePlatformApi.listDistributions(baseId),
      ]);

      let webhookCount = 0;
      try {
        const bases = await TablePlatformApi.listBases(workspaceId);
        const firstBase = Array.isArray(bases) ? bases[0] : null;
        if (firstBase) {
          const bId = String((firstBase as Record<string, unknown>).id ?? '');
          const data = await TablePlatformApi.listWebhookRelays(bId);
          const relays = data?.relays ?? [];
          webhookCount = Array.isArray(relays) ? relays.length : 0;
        }
      } catch {
        /* best-effort */
      }

      const autoList =
        automations.status === 'fulfilled' && Array.isArray(automations.value)
          ? automations.value
          : [];
      const syncList =
        syncs.status === 'fulfilled' && Array.isArray(syncs.value) ? syncs.value : [];
      const distList =
        distributions.status === 'fulfilled' && Array.isArray(distributions.value)
          ? distributions.value
          : [];

      setStats({
        automationsCount: autoList.length,
        automationsActive: autoList.filter((a: any) => a.enabled).length,
        syncsCount: syncList.length,
        webhooksCount: webhookCount,
        distributionsCount: distList.length,
      });
    } catch {
      // stats are best-effort
    } finally {
      setLoading(false);
    }
  }, [tableId, baseId, workspaceId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // If a panel is active, render it full-screen within the tab
  if (activePanel === 'automations') {
    return (
      <div className="h-full flex flex-col">
        <BackBar
          label={isPl ? 'Automatyzacje' : 'Automations'}
          onBack={() => {
            setActivePanel(null);
            loadStats();
          }}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <AutomationsManager
            tableId={tableId}
            baseId={baseId}
            fields={fields}
            onClose={() => {
              setActivePanel(null);
              loadStats();
            }}
          />
        </div>
      </div>
    );
  }

  if (activePanel === 'sync') {
    return (
      <div className="h-full flex flex-col">
        <BackBar
          label={isPl ? 'Synchronizacja' : 'Table Sync'}
          onBack={() => {
            setActivePanel(null);
            loadStats();
          }}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <SyncManager
            tableId={tableId}
            baseId={baseId}
            tables={tables}
            onClose={() => {
              setActivePanel(null);
              loadStats();
            }}
          />
        </div>
      </div>
    );
  }

  if (activePanel === 'sharing') {
    return (
      <div className="h-full flex flex-col">
        <BackBar label={isPl ? 'Udostępnianie' : 'Sharing'} onBack={() => setActivePanel(null)} />
        <div className="flex-1 overflow-y-auto p-4">
          <SharingManager baseId={baseId} views={views} onClose={() => setActivePanel(null)} />
        </div>
      </div>
    );
  }

  if (activePanel === 'webhooks') {
    return (
      <div className="h-full flex flex-col">
        <BackBar
          label={isPl ? 'Webhook Relay' : 'Webhook Relays'}
          onBack={() => {
            setActivePanel(null);
            loadStats();
          }}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <WebhookRelayPanel
            workspaceId={workspaceId}
            onClose={() => {
              setActivePanel(null);
              loadStats();
            }}
          />
        </div>
      </div>
    );
  }

  if (activePanel === 'distributions') {
    return (
      <div className="h-full flex flex-col">
        <DistributionBuilder
          baseId={baseId}
          onClose={() => {
            setActivePanel(null);
            loadStats();
          }}
        />
      </div>
    );
  }

  // ── Dashboard View ─────────────────────────────────────────────────────

  const cards: {
    id: ActivePanel;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    iconColor: string;
    bgColor: string;
    titleEn: string;
    titlePl: string;
    descEn: string;
    descPl: string;
    stat: string;
  }[] = [
    {
      id: 'automations',
      icon: Zap,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      titleEn: 'Automations',
      titlePl: 'Automatyzacje',
      descEn: 'Triggers, actions, and scheduled workflows',
      descPl: 'Wyzwalacze, akcje i zaplanowane procesy',
      stat: `${stats.automationsActive}/${stats.automationsCount} ${isPl ? 'aktywnych' : 'active'}`,
    },
    {
      id: 'sync',
      icon: RefreshCw,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      titleEn: 'Table Sync',
      titlePl: 'Synchronizacja',
      descEn: 'Keep tables in sync automatically',
      descPl: 'Automatyczna synchronizacja tabel',
      stat: `${stats.syncsCount} ${isPl ? 'konfiguracji' : 'configured'}`,
    },
    {
      id: 'webhooks',
      icon: Webhook,
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      titleEn: 'Webhook Relays',
      titlePl: 'Webhooki',
      descEn: 'Forward events to Zapier, Make, or any URL',
      descPl: 'Przekazuj zdarzenia do Zapier, Make lub dowolnego URL',
      stat: `${stats.webhooksCount} ${isPl ? 'konfiguracji' : 'configured'}`,
    },
    {
      id: 'sharing',
      icon: Users,
      iconColor: 'text-c-accent',
      bgColor: 'bg-c-accent-soft',
      titleEn: 'Sharing',
      titlePl: 'Udostępnianie',
      descEn: 'Share views, manage collaborators and API access',
      descPl: 'Udostępniaj widoki, zarządzaj współpracownikami i API',
      stat: `${views.filter((v) => v.shareToken).length} ${isPl ? 'udostępnionych' : 'shared'}`,
    },
    {
      id: 'distributions',
      icon: Send,
      iconColor: 'text-pink-500',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
      titleEn: 'Distributions',
      titlePl: 'Dystrybucja',
      descEn: 'Send data via email, Slack, Teams, or webhook',
      descPl: 'Wysyłaj dane przez email, Slack, Teams lub webhook',
      stat: `${stats.distributionsCount} ${isPl ? 'konfiguracji' : 'configured'}`,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Bell size={16} className="text-indigo-500" />
        <h2 className="text-sm font-semibold text-c-text">
          {isPl ? 'Workflow' : 'Workflow'}
        </h2>
        {loading && <Loader2 size={12} className="animate-spin text-c-text-secondary" />}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => {
                if (!isLocked) setActivePanel(card.id);
              }}
              disabled={isLocked}
              className={`group text-left rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 transition-all ${
                isLocked
                  ? 'cursor-not-allowed opacity-60'
                  : 'hover:border-c-border-subtle hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon size={16} className={card.iconColor} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold text-c-text">
                    {isPl ? card.titlePl : card.titleEn}
                  </h3>
                  <p className="text-[10px] text-c-text-secondary mt-0.5">
                    {card.stat}
                  </p>
                </div>
                <ArrowRight
                  size={14}
                  className="text-c-text-secondary group-hover:text-c-text-muted transition-colors"
                />
              </div>
              <p className="text-[11px] text-c-text-muted leading-relaxed">
                {isPl ? card.descPl : card.descEn}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── BackBar ──────────────────────────────────────────────────────────────────

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-c-border-subtle bg-c-surface-raised">
      <button
        onClick={onBack}
        className="text-[11px] font-medium text-c-text-muted hover:text-c-text transition-colors"
      >
        ← {isPl ? 'Workflow' : 'Workflow'}
      </button>
      <span className="text-c-text-secondary">/</span>
      <span className="text-[11px] font-semibold text-c-text">{label}</span>
    </div>
  );
}

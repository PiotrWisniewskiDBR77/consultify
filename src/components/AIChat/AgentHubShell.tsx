/**
 * AgentHubShell — powłoka zakładki "Run agent" z dwiema pod-zakładkami (AGT-010).
 *
 * Piotr 2026-07-24 (zrzut demo): wejście w Run agent pokazywało od razu
 * launcher 31 gotowych agentów (AgentPlanWorkspace → AgentManifestLauncher).
 * Brakowało warstwy pośredniej — user ma WIELE uruchomionych/zapisanych
 * procesów, potrzebna tabela pozycji jak w Decisions, nie od razu kreator.
 *
 * Ta powłoka wchodzi PRZED AgentPlanWorkspace:
 *   "Moje procesy" — StandardTable nad `listAgentPlans` (GET /api/ai/agent-plan).
 *     Klik w wiersz otwiera AgentPlanWorkspace z `initialPlanId` (ten sam
 *     canvas/panel co dotąd — flow AGT-006/007/009 bez zmian).
 *   "Szablony" — placeholder; AGT-011 wypełnia galerią wzorców procesu.
 *
 * "Nowy proces" tworzy plan generatorem procesu (ProcessLibrary, domyślny
 * `classic-5` — 5 faz Kubr/ILO) w trybie `draft: true`: backend kładzie
 * schemat i zostawia plan w statusie 'planning' (NIE dispatchuje wykonania —
 * patrz agent-plan.routes.ts `effectiveDraft`), user przestawia klocki na
 * canvasie i dopiero jawne "Uruchom" startuje wykonanie.
 *
 * Kanon: consultify-triada (StandardModuleBar Menu2 pigułki + StandardTable
 * facada — zero własnej tabeli/menu) + consultify-gestosc (hub 2 zakładki
 * ≤ 6; jedna akcja "Nowy proces" ma jeden dom — Menu2 primary CTA, nie
 * duplikat w kebabie).
 */
import { FileStack, ListChecks, PlayCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState, LoadingState } from '@/components/shared/states';
import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { EntityStatusChip, MetaChip } from '@/components/ui/primitives/chips';
import {
  type AgentPlan,
  cancelAgentPlan,
  createAgentPlan,
  listAgentPlans,
} from '@/services/api/agentPlan.api';

import { AgentPlanWorkspace } from './AgentPlanWorkspace';

type AgentHubTab = 'processes' | 'templates';

const formatPlanDate = (iso: string, isPolish: boolean): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const AgentHubShell: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [tab, setTab] = useState<AgentHubTab>('processes');
  const [plans, setPlans] = useState<AgentPlan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchPlans = useCallback(() => {
    setLoadError(null);
    listAgentPlans({ mine: true })
      .then(({ plans: fetched }) => setPlans(fetched))
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : 'Failed to load agent plans');
      });
  }, []);

  useEffect(() => {
    if (tab === 'processes' && !openPlanId) {
      fetchPlans();
    }
  }, [tab, openPlanId, fetchPlans]);

  const handleOpenPlan = useCallback((planId: string) => {
    setOpenPlanId(planId);
  }, []);

  const handleClosePlan = useCallback(() => {
    setOpenPlanId(null);
    fetchPlans();
  }, [fetchPlans]);

  const handleNewProcess = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const { plan } = await createAgentPlan({
        title: t('agentPlan.hub.newProcessTitle', 'New consulting process'),
        processId: 'classic-5',
        draft: true,
      });
      setOpenPlanId(plan.id);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create process');
    } finally {
      setCreating(false);
    }
  }, [t]);

  const handleCancelPlan = useCallback(
    async (planId: string) => {
      try {
        await cancelAgentPlan(planId);
        fetchPlans();
      } catch {
        /* best-effort — row stays until next refresh */
      }
    },
    [fetchPlans]
  );

  // Plan otwarty → ten sam canvas/panel co dotąd (AGT-007/009), bez zmian.
  if (openPlanId) {
    return <AgentPlanWorkspace initialPlanId={openPlanId} onClose={handleClosePlan} />;
  }

  const columns: TableColumn[] = [
    {
      id: 'title',
      label: t('agentPlan.hub.columns.name', isPolish ? 'Nazwa' : 'Name'),
      width: '360px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return <span className="text-sm font-semibold text-c-text">{plan.title}</span>;
      },
    },
    {
      id: 'status',
      label: t('agentPlan.hub.columns.status', isPolish ? 'Status' : 'Status'),
      width: '160px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return <EntityStatusChip status={plan.status} />;
      },
    },
    {
      id: 'progress',
      label: t('agentPlan.hub.columns.progress', isPolish ? 'Postęp' : 'Progress'),
      width: '140px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <MetaChip
            icon={ListChecks}
            label={`${plan.completedSteps}/${plan.totalSteps}`}
            title={t(
              'agentPlan.hub.columns.progressTitle',
              isPolish ? 'Ukończone kroki' : 'Steps completed'
            )}
          />
        );
      },
    },
    {
      id: 'date',
      label: t('agentPlan.hub.columns.created', isPolish ? 'Data' : 'Date'),
      width: '140px',
      render: (row: TableRow) => {
        const plan = row as unknown as AgentPlan;
        return (
          <span className="text-xs text-c-text-secondary">
            {formatPlanDate(plan.createdAt, isPolish)}
          </span>
        );
      },
    },
  ];

  const tableRows = (plans ?? []) as unknown as TableRow[];

  const renderProcesses = () => {
    if (loadError) {
      return (
        <EmptyState
          variant="error"
          title={t(
            'agentPlan.hub.loadErrorTitle',
            isPolish ? 'Nie udało się wczytać procesów' : 'Failed to load processes'
          )}
          description={loadError}
          onRetry={fetchPlans}
          className="h-full"
        />
      );
    }
    if (plans === null) {
      return (
        <div className="p-4">
          <LoadingState template="list" rows={4} />
        </div>
      );
    }
    if (plans.length === 0) {
      return (
        <EmptyState
          variant="new"
          icon={PlayCircle}
          title={t('agentPlan.hub.emptyTitle', isPolish ? 'Brak procesów' : 'No processes yet')}
          description={t(
            'agentPlan.hub.emptyDescription',
            isPolish
              ? 'Uruchom klasyczny schemat konsultingowy albo wybierz gotowego agenta w Szablonach.'
              : 'Start the classic consulting process or pick a ready-made agent from Templates.'
          )}
          primaryAction={{
            label: t('agentPlan.hub.newProcess', isPolish ? 'Nowy proces' : 'New process'),
            onClick: () => void handleNewProcess(),
          }}
          className="h-full"
        />
      );
    }
    return (
      <div className="p-4 pt-3">
        {createError ? <p className="mb-2 text-xs text-c-danger">{createError}</p> : null}
        <StandardTable
          columns={columns}
          data={tableRows}
          onRowClick={(row) => handleOpenPlan(String(row.id))}
          rowActions={(row) => {
            const plan = row as unknown as AgentPlan;
            const cancellable = ['planning', 'executing', 'awaiting_approval', 'paused'].includes(
              plan.status
            );
            return [
              {
                id: 'open',
                kind: 'open',
                actions: [
                  {
                    id: 'open',
                    label: t('agentPlan.hub.rowOpen', isPolish ? 'Otwórz' : 'Open'),
                    onClick: () => handleOpenPlan(plan.id),
                  },
                ],
              },
              {
                id: 'danger',
                kind: 'danger',
                actions: [
                  {
                    id: 'cancel',
                    label: t('agentPlan.hub.rowCancel', isPolish ? 'Anuluj' : 'Cancel'),
                    variant: 'danger' as const,
                    disabled: !cancellable,
                    description: cancellable
                      ? undefined
                      : t(
                          'agentPlan.hub.rowCancelNote',
                          isPolish ? 'Plan już zakończony' : 'Plan already finished'
                        ),
                    onClick: () => void handleCancelPlan(plan.id),
                  },
                ],
              },
            ];
          }}
          persistKey="agent.myprocesses.list"
        />
      </div>
    );
  };

  const renderTemplatesPlaceholder = () => (
    <EmptyState
      icon={FileStack}
      title={t('agentPlan.hub.templatesTitle', isPolish ? 'Szablony' : 'Templates')}
      description={t(
        'agentPlan.hub.templatesDescription',
        isPolish
          ? 'Galeria gotowych wzorców procesu — w przygotowaniu (AGT-011).'
          : 'Ready-made process template gallery — coming soon (AGT-011).'
      )}
      className="h-full"
    />
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
      <StandardModuleBar
        tabs={[
          {
            id: 'processes',
            label: t('agentPlan.hub.tabs.processes', isPolish ? 'Moje procesy' : 'My processes'),
          },
          {
            id: 'templates',
            label: t('agentPlan.hub.tabs.templates', isPolish ? 'Szablony' : 'Templates'),
          },
        ]}
        activeTab={tab}
        onTabChange={(id) => setTab(id as AgentHubTab)}
        primaryCta={
          tab === 'processes'
            ? {
                label: creating
                  ? t('agentPlan.hub.newProcessLoading', isPolish ? 'Tworzenie…' : 'Creating…')
                  : t('agentPlan.hub.newProcess', isPolish ? 'Nowy proces' : 'New process'),
                icon: PlayCircle,
                onClick: () => void handleNewProcess(),
              }
            : undefined
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'processes' ? renderProcesses() : renderTemplatesPlaceholder()}
      </div>
    </div>
  );
};

export default AgentHubShell;

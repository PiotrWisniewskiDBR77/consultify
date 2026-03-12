import { AlertTriangle, Database, GitBranch, History } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Callout, InlineTable, ToggleBlock } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';

interface ContextResponse {
  counts: {
    items: number;
    claims: number;
    conflicts: number;
  };
  conflicts: Array<{ claimPath: string; values: unknown[]; sourceTypes: string[] }>;
}

interface TimelineResponse {
  timeline: Array<{
    id: string;
    sourceType: string;
    sourceLabel: string | null;
    createdAt: string;
    channel: string;
    isExplicit: boolean;
    summary: string;
  }>;
}

interface OrganizationContextOverviewProps {
  organizationId?: string;
}

export const OrganizationContextOverview: React.FC<OrganizationContextOverviewProps> = ({
  organizationId,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse['timeline']>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [contextResponse, timelineResponse] = await Promise.all([
          Api.organizationContextGet().catch(() => null),
          Api.organizationContextGetTimeline(8).catch(() => ({ timeline: [] })),
        ]);
        if (!isMounted) return;
        setContext((contextResponse as ContextResponse) || null);
        setTimeline(((timelineResponse as TimelineResponse)?.timeline || []).slice(0, 8));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  const timelineRows = useMemo(
    () =>
      timeline.map((item) => ({
        ...item,
        createdAtLabel: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
      })),
    [timeline]
  );

  if (!organizationId) return null;

  return (
    <div className="space-y-4">
      <Callout
        variant={context?.counts?.conflicts ? 'warning' : 'purple'}
        title={isPolish ? 'Organization Context OS' : 'Organization Context OS'}
        compact
      >
        {loading
          ? isPolish
            ? 'Ładowanie aktualnego stanu kontekstu organizacji...'
            : 'Loading organization context status...'
          : isPolish
            ? `Aktywnych wpisów: ${context?.counts?.items || 0}, claimów: ${context?.counts?.claims || 0}, konfliktów: ${context?.counts?.conflicts || 0}.`
            : `Active entries: ${context?.counts?.items || 0}, claims: ${context?.counts?.claims || 0}, conflicts: ${context?.counts?.conflicts || 0}.`}
      </Callout>

      <ToggleBlock
        title={isPolish ? 'Context Health' : 'Context Health'}
        badge={context?.counts?.claims || 0}
        icon={<Database size={14} />}
        defaultOpen
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: isPolish ? 'Entries' : 'Entries',
                value: context?.counts?.items || 0,
              },
              {
                label: isPolish ? 'Claims' : 'Claims',
                value: context?.counts?.claims || 0,
              },
              {
                label: isPolish ? 'Conflicts' : 'Conflicts',
                value: context?.counts?.conflicts || 0,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-slate-50/50 dark:bg-navy-900/30 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {item.label}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-700 dark:text-slate-200">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {context?.conflicts?.length ? (
            <Callout
              variant="warning"
              title={isPolish ? 'Claims wymagające przeglądu' : 'Claims needing review'}
              compact
              icon={AlertTriangle}
            >
              {(context.conflicts || [])
                .slice(0, 3)
                .map((conflict) => conflict.claimPath)
                .join(', ')}
            </Callout>
          ) : (
            <Callout variant="success" compact>
              {isPolish
                ? 'Brak wykrytych konfliktów w aktualnym snapshotcie.'
                : 'No conflicts detected in the current snapshot.'}
            </Callout>
          )}
        </div>
      </ToggleBlock>

      <ToggleBlock
        title={isPolish ? 'Recent Sources' : 'Recent Sources'}
        badge={timelineRows.length}
        icon={<History size={14} />}
        defaultOpen={false}
      >
        <InlineTable
          compact
          columns={[
            {
              key: 'summary',
              header: isPolish ? 'Source' : 'Source',
              render: (row) => (
                <div>
                  <div className="text-sm text-slate-700 dark:text-slate-200">{row.summary}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">{row.sourceType}</div>
                </div>
              ),
            },
            {
              key: 'channel',
              header: isPolish ? 'Channel' : 'Channel',
              width: 'w-28',
              render: (row) => row.channel,
            },
            {
              key: 'createdAtLabel',
              header: isPolish ? 'Updated' : 'Updated',
              width: 'w-40',
              render: (row) => row.createdAtLabel,
            },
          ]}
          data={timelineRows}
          rowKey={(row) => row.id}
          emptyMessage={
            isPolish ? 'Brak wpisów w timeline kontekstu.' : 'No entries in the context timeline.'
          }
        />
      </ToggleBlock>

      <ToggleBlock
        title={isPolish ? 'Source Provenance' : 'Source Provenance'}
        badge={context?.counts?.items || 0}
        icon={<GitBranch size={14} />}
        defaultOpen={false}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isPolish
            ? 'Każdy zapis do Context OS zachowuje źródło, kanał i explicitness, dzięki czemu AI może pracować na trwałym kontekście zamiast na pojedynczym prompt snapshot.'
            : 'Every Context OS write keeps source, channel, and explicitness so AI can work on durable context instead of a single prompt snapshot.'}
        </p>
      </ToggleBlock>
    </div>
  );
};

export default OrganizationContextOverview;

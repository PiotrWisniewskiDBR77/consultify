import React, { useEffect, useMemo, useState } from 'react';

import { useFinanceWorkspacePlatformFlag } from '@/hooks/useFinanceWorkspacePlatformFlag';
import {
  getFinanceBusinessVersion,
  listFinanceArtifactVersions,
} from '@/services/api/financeV2.api';
import type { FinanceArtifactType } from '@/services/api/financeV2.types';

import { FinanceCommentsPanel } from '../comments/FinanceCommentsPanel';
import { FinanceComparePanel } from '../compare/FinanceComparePanel';
import { FinanceExportImportPanel } from '../exportImport/FinanceExportImportPanel';
import { FinanceLineageNavigator } from '../lineage/FinanceLineageNavigator';
import { FinanceSavedViewsPanel } from '../savedViews/FinanceSavedViewsPanel';

type Tool = 'lineage' | 'compare' | 'comments' | 'views' | 'exchange';

export interface FinanceWorkspaceUtilitiesProps {
  artifactId: string;
  businessVersionId: string;
  artifactType: FinanceArtifactType;
}

/** Canonical, flag-gated host for the five formerly dev-render-only Finance tools. */
export function FinanceWorkspaceUtilities({
  artifactId,
  businessVersionId,
  artifactType,
}: FinanceWorkspaceUtilitiesProps): React.ReactElement | null {
  const { enabled } = useFinanceWorkspacePlatformFlag();
  const [active, setActive] = useState<Tool | null>(null);
  const [versionIds, setVersionIds] = useState<string[]>([]);
  const [workingRevisionId, setWorkingRevisionId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([
      listFinanceArtifactVersions(artifactId),
      getFinanceBusinessVersion(businessVersionId),
    ])
      .then(([versions, current]) => {
        if (cancelled) return;
        setVersionIds(versions.map((version) => version.businessVersionId));
        setWorkingRevisionId(current.workingRevisionId);
      })
      .catch(() => {
        if (!cancelled) {
          setVersionIds([businessVersionId]);
          setWorkingRevisionId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId, businessVersionId, enabled]);

  const comparisonVersionId = useMemo(
    () => versionIds.find((id) => id !== businessVersionId) ?? null,
    [businessVersionId, versionIds]
  );

  if (!enabled) return null;

  const tools: Array<[Tool, string]> = [
    ['lineage', 'Powiązania'],
    ['compare', 'Porównaj'],
    ['comments', 'Komentarze'],
    ['views', 'Widoki'],
    ['exchange', 'Excel'],
  ];

  return (
    <aside
      className="w-full shrink-0 border-t border-c-border-subtle bg-c-surface"
      data-testid="finance-workspace-utilities"
    >
      <div className="flex flex-wrap gap-2 p-3" role="toolbar" aria-label="Narzędzia Finance">
        {tools.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="rounded-full border border-c-border-subtle px-3 py-1.5 text-sm text-c-text-secondary hover:bg-c-surface-raised"
            aria-pressed={active === id}
            onClick={() => setActive((current) => (current === id ? null : id))}
          >
            {label}
          </button>
        ))}
      </div>
      {active && (
        <div className="max-h-[42vh] overflow-auto border-t border-c-border-subtle p-4">
          {active === 'lineage' && (
            <FinanceLineageNavigator businessVersionId={businessVersionId} />
          )}
          {active === 'comments' && (
            <FinanceCommentsPanel artifactId={artifactId} businessVersionId={businessVersionId} />
          )}
          {active === 'views' && <FinanceSavedViewsPanel artifactId={artifactId} />}
          {active === 'compare' && comparisonVersionId && (
            <FinanceComparePanel
              request={{
                kind: 'versions',
                params: {
                  artifactType,
                  artifactId,
                  businessVersionIdA: comparisonVersionId,
                  businessVersionIdB: businessVersionId,
                  labelA: 'Poprzednia wersja',
                  labelB: 'Bieżąca wersja',
                },
              }}
            />
          )}
          {active === 'compare' && !comparisonVersionId && (
            <p role="status" className="text-sm text-c-text-secondary">
              Porównanie będzie dostępne po utworzeniu drugiej wersji artefaktu.
            </p>
          )}
          {active === 'exchange' && workingRevisionId && (
            <FinanceExportImportPanel
              artifactId={artifactId}
              businessVersionId={businessVersionId}
              expectedWorkingRevisionId={workingRevisionId}
            />
          )}
          {active === 'exchange' && !workingRevisionId && (
            <p role="status" className="text-sm text-c-text-secondary">
              Eksport/import wymaga aktywnej rewizji roboczej.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

export default FinanceWorkspaceUtilities;

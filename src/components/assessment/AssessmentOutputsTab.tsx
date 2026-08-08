import { ExternalLink, Package } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { formatListDate } from '@/utils/listDateFormat';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import {
  type AssessmentOutputArtifact,
  buildAssessmentOutputPreviewDetails,
  fetchAssessmentOutputArtifacts,
} from './assessmentOutputs';

/**
 * T22-TABLE-PREVIEW-COMPONENT (T22-TABLE-T00 / T22-PREVIEW-P01 core) —
 * isolated Outputs table + row preview, built directly against the
 * canonical Outputs Library (`GET /api/artifacts`, filtered client-side to
 * `originRuntime === 'assessment_report'`; see assessmentOutputs.ts).
 *
 * T22-KEBAB-K01 / T22-PPM-C01: `rowMenu` below is a strict, truthful
 * reflection of what the registry actually gives each row —
 * `universalHandlers.preview` (always available; opens the same docked
 * StandardPreview row click does) and a `primary` "Open full" item ONLY
 * when `row.openPath` is present (today: assessment_report rows have one,
 * pointing back to the assessment run; exportPath/deletePath are always
 * null for this origin, so no Export/Delete/Duplicate/Edit/Archive/Rename
 * item — real or disabled — is offered). Passing `rowMenu` to StandardTable
 * gives PPM (right-click) the identical action set automatically
 * (FilterableTable's PPM-mirror reads the same `getRowActionSections`
 * derivation the kebab uses) — no separate PPM implementation here.
 *
 * Still deliberately excludes selection/Menu 3 (`selection` prop omitted) —
 * a separate, not-yet-authorized atom (T22-MENU_1_2_3-M14).
 *
 * NOT wired into AssessmentHub yet — the local five-surfaces shell isn't
 * reconciled (see the T22 read-only preflight, R10). Do not treat T22-TABLE-
 * T00 / T22-PREVIEW-P01 as fully closed until that integration lands.
 */
export const AssessmentOutputsTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [items, setItems] = useState<AssessmentOutputArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  // QA-CORRECTION-2: a boolean flag, not the raw error text. A server/network
  // failure can carry URLs, SQL fragments, or credential-shaped strings in
  // `e.message` — that must never reach the DOM. The actual error is logged
  // for developers only (console.error below); the UI always renders one
  // fixed, localized, generic string (computed at render time, see `error`
  // below) regardless of what failed or why.
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deliberately NO dependency on `t`: react-i18next's `t` is not guaranteed
  // referentially stable across renders (and isn't in this suite's mock),
  // so depending on it here would re-trigger the effect below on every
  // render — re-fetching and, worse, racing a freshly-selected row's data
  // out from under an open preview. `load` only closes over stable setState
  // functions, so an empty dependency array is correct, not a lint escape.
  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setHasLoadError(false);
    fetchAssessmentOutputArtifacts()
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
      })
      .catch(() => {
        if (cancelled) return;
        // Honest error state — no fallback to a fabricated/demo row set.
        setItems([]);
        setHasLoadError(true);
        // Do not log the raw exception: upstream messages can contain URLs,
        // SQL fragments, authorization headers, or other sensitive values.
        // eslint-disable-next-line no-console -- fixed diagnostic only.
        console.error('[AssessmentOutputsTab] failed to load outputs registry');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const previewDetailsText = useMemo(
    () => buildAssessmentOutputPreviewDetails(selected, isPolish ? 'pl' : 'en'),
    [selected, isPolish]
  );

  // QA-CORRECTION-1: every fallback below is a `render`-time visual
  // placeholder only — it never gets written back into `items`/state, so it
  // can never be mistaken for a persisted fact (contrast with the Details
  // prose in assessmentOutputs.ts, which says "not persisted" explicitly
  // instead of substituting a placeholder).
  const untitledLabel = t('assessment.outputs.table.untitled', 'Untitled output');
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'resolvedTitle',
        label: t('assessment.outputs.table.title', 'Title'),
        sortable: true,
        render: (row) => row.resolvedTitle || untitledLabel,
      },
      {
        id: 'outputType',
        label: t('assessment.outputs.table.type', 'Type'),
        width: '120px',
        sortable: true,
        render: (row) => row.outputType || '—',
      },
      {
        id: 'deliveryState',
        label: t('assessment.outputs.table.status', 'Status'),
        width: '120px',
        sortable: true,
        render: (row) => row.deliveryState || '—',
      },
      {
        id: 'ownerName',
        label: t('assessment.outputs.table.owner', 'Owner'),
        width: '160px',
        render: (row) => row.ownerName || '—',
      },
      {
        id: 'lastTransitionAt',
        label: t('assessment.outputs.table.updated', 'Updated'),
        width: '140px',
        sortable: true,
        render: (row) => (row.lastTransitionAt ? formatListDate(row.lastTransitionAt) : '—'),
      },
    ],
    [t, untitledLabel]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [];
    // QA-CORRECTION-1: a pill is only rendered when there is a real value to
    // show. A missing outputType/deliveryState is not "neutral" or
    // "success" — it's absent, so no pill for it at all, rather than a
    // fabricated label or a tone (warning/success) implying a status we
    // don't actually have.
    if (selected.outputType) {
      pills.push({ label: selected.outputType, tone: 'neutral' });
    }
    if (selected.deliveryState) {
      pills.push({
        label: selected.deliveryState,
        tone: selected.isDraft ? 'warning' : 'success',
      });
    }
    return pills;
  }, [selected]);

  // T22-KEBAB-K01 / T22-PPM-C01: see the module doc comment above — strictly
  // truthful, no invented actions/labels, drives both kebab and PPM.
  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const openPath = typeof row.openPath === 'string' ? row.openPath : null;
      return {
        primary: openPath
          ? [
              {
                id: 'open-full',
                label: t('assessment.outputs.rowMenu.openFull', 'Open full'),
                icon: ExternalLink,
                onClick: () => navigate(openPath),
              },
            ]
          : undefined,
        universalHandlers: {
          preview: () => setSelectedId(String(row.id)),
        },
      };
    },
    [navigate, t]
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          columns={columns}
          data={items}
          loading={loading}
          error={
            hasLoadError
              ? isPolish
                ? 'Nie udało się wczytać artefaktów. Spróbuj ponownie.'
                : 'Failed to load outputs. Please try again.'
              : null
          }
          onRetry={load}
          persistKey="assessment.outputs"
          defaultSort={{ columnId: 'lastTransitionAt', direction: 'desc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            icon: Package,
            title: t('assessment.outputs.emptyState.title', 'No outputs yet'),
            description: t(
              'assessment.outputs.emptyState.description',
              'Assessment outputs promoted to the Outputs Library will appear here.'
            ),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.resolvedTitle || untitledLabel}
            onClose={() => setSelectedId(null)}
            onOpenFull={selected.openPath ? () => navigate(selected.openPath as string) : undefined}
            meta={{
              pills: metaPills,
              trailing: selected.lastTransitionAt ? (
                <span className="text-[11px] font-semibold text-c-text-secondary">
                  {formatListDate(selected.lastTransitionAt)}
                </span>
              ) : undefined,
            }}
            details={{
              text: previewDetailsText,
              onCopy: () => {
                void navigator.clipboard?.writeText(previewDetailsText);
              },
            }}
            relations={[]}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default AssessmentOutputsTab;

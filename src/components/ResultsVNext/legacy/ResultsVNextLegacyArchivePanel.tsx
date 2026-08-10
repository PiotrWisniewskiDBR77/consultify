/**
 * ResultsVNextLegacyArchivePanel — ONE shared, read-only registry for the
 * `.../legacy` index every RN-G2 domain already exposes
 * (`kpiLegacyArchive.routes.ts` → `/api/vnext/results/kpi/legacy`,
 * `roiLegacyArchive.routes.ts` → `.../roi/legacy`,
 * `okrLegacyArchive.routes.ts` → `.../okr/legacy` — all GET-only, verified by
 * reading all three route files: `denyMutations` is mounted FIRST in every
 * one of them, RN_G2_UI_SCOPE.md §C).
 *
 * Built on top of `ResultsVNextRegistryShell` (the same P0 shell KPI/ROI's
 * own registries use) — StandardModuleBar + StandardTable + StandardPreview,
 * zero bespoke chrome. Domain is a prop; `?domain=kpi|roi|okr` in dev-render
 * drives the harness screen the same way every other RN-G2 screen does.
 *
 * SCOPE (intentional, see `legacyArchiveApi.ts`'s header): this shows the
 * INDEX of legacy source tables per domain (label / origin / row count) —
 * NOT a drill-down into each sub-table's individual legacy rows. Each of the
 * ~20 sub-tables across the three domains is a raw, genuinely different
 * legacy DB row shape; building per-table `StandardTable` columns for all of
 * them is real per-domain work for the wave that wires this panel into a hub
 * tab (task explicitly scopes this package as "prep — do not wire into any
 * existing hub yet").
 *
 * READ-ONLY, twardo: no create/edit CTA anywhere, `moduleBar` has no
 * `primaryCta`/`onNewItem`; the row kebab exposes "Podgląd"/"Preview" as the
 * only enabled action, everything else (`Edit`/`Archive`/`Delete`) stays
 * VISIBLE but disabled with an explicit "archiwum tylko do odczytu" reason
 * (TRIADA §C3 — a disabled item stays visible with a reason, never hidden),
 * built via the same `universalHandlers.*Note` mechanism as every other
 * RN-G2 domain, no bespoke disabling logic here.
 *
 * `persistKey` uses the `results-vnext.*` namespace (RN_G2_UI_SCOPE.md §H) —
 * `results-vnext.legacy-archive.<domain>`, distinct per domain so KPI/ROI/OKR
 * archive tabs never share column-layout localStorage state.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type StandardPreviewProps,
  type StandardRowMenu,
  type TableColumn,
} from '@/components/standard';
import { Archive as ArchiveIcon } from 'lucide-react';

import { ResultsVNextRegistryShell, type ResultsVNextTableProps } from '../ResultsVNextRegistryShell';
import type { ResultsVNextDomain } from '../types';
import {
  type LegacyArchiveIndexRow,
  type LegacyArchiveOriginDomain,
  LegacyArchiveApiError,
  listLegacyArchiveIndex,
} from './legacyArchiveApi';

export interface ResultsVNextLegacyArchivePanelProps {
  /** Which domain's `.../legacy` index to show — kpi | roi | okr. */
  domain: ResultsVNextDomain;
  className?: string;
}

const DOMAIN_TITLE: Record<ResultsVNextDomain, { pl: string; en: string }> = {
  kpi: { pl: 'Archiwum KPI (tylko do odczytu)', en: 'KPI archive (read-only)' },
  roi: { pl: 'Archiwum ROI (tylko do odczytu)', en: 'ROI archive (read-only)' },
  okr: { pl: 'Archiwum OKR (tylko do odczytu)', en: 'OKR archive (read-only)' },
};

const ORIGIN_LABEL: Record<LegacyArchiveOriginDomain, { pl: string; en: string }> = {
  results_legacy: { pl: 'Archiwum Results (legacy)', en: 'Results legacy archive' },
  table_platform_live: { pl: 'Table Platform (żywy, zewnętrzny)', en: 'Table Platform (live, external)' },
};

/** `StandardTable`/`FilterableTable` require `row.id: string` — the index
 * response's natural identity is `sourceTable`, so mapped once here rather
 * than threading unsafe casts through every table/rowMenu callback. */
type LegacyArchiveTableRow = LegacyArchiveIndexRow & { id: string };

export const ResultsVNextLegacyArchivePanel: React.FC<ResultsVNextLegacyArchivePanelProps> = ({
  domain,
  className,
}) => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [rows, setRows] = useState<LegacyArchiveIndexRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLegacyArchiveIndex(domain)
      .then((resp) => {
        if (cancelled) return;
        setRows(resp.data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof LegacyArchiveApiError
            ? err.message
            : isPolish
              ? 'Nie udało się wczytać archiwum.'
              : 'Failed to load the archive.';
        setError(message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, isPolish]);

  useEffect(() => load(), [load, reloadToken]);

  // Selection may point at a row that just disappeared from a fresh fetch —
  // never carry a dangling preview forward.
  useEffect(() => {
    if (selectedTable && !rows.some((r) => r.sourceTable === selectedTable)) {
      setSelectedTable(null);
    }
  }, [rows, selectedTable]);

  const tableRows: LegacyArchiveTableRow[] = useMemo(
    () => rows.map((r) => ({ ...r, id: r.sourceTable })),
    [rows]
  );

  const selectedRow = useMemo(
    () => tableRows.find((r) => r.sourceTable === selectedTable) ?? null,
    [tableRows, selectedTable]
  );

  const readOnlyReason = isPolish
    ? 'Archiwum tylko do odczytu — brak zapisów w tej powierzchni.'
    : 'Read-only archive — no writes are possible on this surface.';

  // `row.label` (server-supplied, e.g. "Legacy archive — read-only") is
  // deliberately NOT shown as its own column: reading all three
  // `*LegacyArchive.routes.ts` files, it is always `LEGACY_LABELS[originDomain]`
  // — a hardcoded-English, 1:1 derivative of `originDomain` (never a
  // per-table string) — so showing it verbatim would both duplicate the
  // "Pochodzenie"/"Origin" column below AND leak an untranslated server
  // string. `ORIGIN_LABEL` re-derives the same information, localized.
  const columns: TableColumn[] = [
    {
      id: 'sourceTable',
      label: isPolish ? 'Tabela' : 'Table',
      sortable: true,
      width: '240px',
      render: (row) => <span className="font-mono text-sm text-c-text">{row.sourceTable}</span>,
    },
    {
      id: 'originDomain',
      label: isPolish ? 'Pochodzenie' : 'Origin',
      sortable: true,
      width: '220px',
      render: (row) => {
        const origin = row.originDomain as LegacyArchiveOriginDomain;
        const copy = ORIGIN_LABEL[origin];
        return (
          <span className="text-sm text-c-text-secondary">
            {copy ? (isPolish ? copy.pl : copy.en) : origin}
          </span>
        );
      },
    },
    {
      id: 'count',
      label: isPolish ? 'Liczba rekordów' : 'Record count',
      sortable: true,
      align: 'right',
      width: '140px',
      // Always a real COUNT(*) int from the repository — never fabricated,
      // 0 is a real, honest "no legacy rows for this tenant" answer.
      render: (row) => <span className="tabular-nums text-sm">{row.count}</span>,
    },
  ];

  const buildRowMenu = useCallback(
    (row: LegacyArchiveTableRow): StandardRowMenu => ({
      // Only "Podgląd"/"Preview" gets a real handler (`u.preview`) — Edit/
      // Archive/Delete are declared WITHOUT `onClick`, only a `*Note`/`note`
      // reason, which is exactly `StandardTable`'s built-in "visible,
      // disabled, with a business-lock reason" contract (TRIADA §C3) — no
      // bespoke disabling logic needed here.
      universalHandlers: {
        preview: () => setSelectedTable(row.sourceTable),
        editNote: readOnlyReason,
        archiveNote: readOnlyReason,
      },
      destructive: {
        label: isPolish ? 'Usuń' : 'Delete',
        note: readOnlyReason,
      },
    }),
    [isPolish, readOnlyReason]
  );

  const table: ResultsVNextTableProps = {
    columns,
    data: tableRows,
    persistKey: `results-vnext.legacy-archive.${domain}`,
    loading,
    error,
    onRetry: () => setReloadToken((n) => n + 1),
    empty: {
      title: isPolish ? 'Brak archiwalnych tabel' : 'No archived tables',
      description: isPolish
        ? 'Ta domena nie ma jeszcze żadnych zarejestrowanych tabel legacy.'
        : 'This domain has no registered legacy tables yet.',
    },
    selectedRowId: selectedTable,
    onRowClick: (row) => setSelectedTable(String(row.sourceTable)),
    rowMenu: (row) => buildRowMenu(row as unknown as LegacyArchiveTableRow),
    defaultSort: { columnId: 'sourceTable', direction: 'asc' },
  };

  const preview: StandardPreviewProps | null = selectedRow
    ? {
        // Row identity, NOT `selectedRow.label` — that server field is the
        // same generic English string for every row sharing an origin (see
        // the `columns` comment above), so it would render as a useless,
        // non-unique preview title.
        title: selectedRow.sourceTable,
        onClose: () => setSelectedTable(null),
        meta: {
          pills: [
            {
              label: isPolish
                ? (ORIGIN_LABEL[selectedRow.originDomain]?.pl ?? selectedRow.originDomain)
                : (ORIGIN_LABEL[selectedRow.originDomain]?.en ?? selectedRow.originDomain),
              tone: 'neutral',
            },
          ],
          recommendation: readOnlyReason,
        },
        details: {
          // `StandardPreview.details.propertyLabel/valueLabel` default to the
          // English literals 'Property'/'Value' when a caller omits them
          // (StandardPreview.tsx — deliberately NOT changed by this package,
          // see its own comment there) — pass them explicitly so this new
          // panel never depends on that default.
          propertyLabel: isPolish ? 'Właściwość' : 'Property',
          valueLabel: isPolish ? 'Wartość' : 'Value',
          properties: [
            {
              id: 'sourceTable',
              label: isPolish ? 'Tabela' : 'Table',
              value: <span className="font-mono">{selectedRow.sourceTable}</span>,
            },
            { id: 'count', label: isPolish ? 'Liczba rekordów' : 'Record count', value: selectedRow.count, mono: true },
            {
              id: 'readOnly',
              label: isPolish ? 'Zapis' : 'Writes',
              value: isPolish ? 'Zablokowany' : 'Blocked',
            },
          ],
        },
        relations: [],
        actions: {
          informational: [
            {
              id: 'archive-note',
              variant: 'neutral',
              label: isPolish ? 'Archiwum tylko do odczytu' : 'Read-only archive',
              icon: ArchiveIcon,
              disabled: true,
              onClick: () => undefined,
            },
          ],
        },
      }
    : null;

  return (
    <div className={className ?? 'h-full'} data-testid={`results-vnext-legacy-archive-${domain}`}>
      <ResultsVNextRegistryShell
        domain={domain}
        moduleBar={{
          breadcrumbs: [{ label: isPolish ? DOMAIN_TITLE[domain].pl : DOMAIN_TITLE[domain].en }],
        }}
        table={table}
        preview={preview}
      />
    </div>
  );
};

export default ResultsVNextLegacyArchivePanel;

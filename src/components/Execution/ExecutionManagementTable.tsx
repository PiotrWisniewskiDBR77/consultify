import { ChevronRight } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type MetaPill, StandardPreview } from '../standard/StandardPreview';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';
import type { ManagerModuleId } from './ManagerModuleView';

/**
 * T35 R12 — canonical Execution/Management table + preview.
 *
 * ENTITY CHOICE: rows are the six real management lanes
 * (action-queue/decisions/blockers/risk/workload/people-change), sourced
 * from `managerLaneCounts` — the same factual total/critical/warning data
 * ExecutionManagementView already renders as six dashboard tiles. This was
 * chosen over the real Benefits register (`BenefitsRegisterPanel`,
 * GET/POST /api/benefits-register/benefits) because: (a) the lanes ARE the
 * top-level structure of the "Management" surface itself — the tab exists
 * to organize and open these six areas; (b) BenefitsRegisterPanel already
 * IS a complete, working register UI for benefit records, so building a
 * second StandardTable over the identical live data would duplicate it
 * outright rather than add a distinct canonical surface; the instruction is
 * to preserve BenefitsRegisterPanel as its own tool, not re-skin it.
 * Mixing lane summaries and benefit records into one row shape was avoided
 * as a fictional merge of two unlike entities.
 *
 * The one real row action is opening a lane — it calls the *existing*
 * `setSubview(laneId)` transition ExecutionManagementView's own tiles
 * already use (passed in as `onOpenLane`), not a new capability. Lanes are
 * a fixed taxonomy, not individually owned/assignable/deletable records, so
 * there is no truthful edit/archive/delete/assign/change-status here — the
 * old T35 registry entry's `assign`/`change-status` bulk actions and
 * title/type/status/owner/dueDate columns described fields no lane row
 * (and no benefit row either) actually has; see surfaceRegister.ts T35.
 */

export interface ManagementLaneRow extends TableRow {
  id: ManagerModuleId;
  label: string;
  total: number;
  critical: number;
  warning: number;
}

export interface ExecutionManagementTableProps {
  rows: ManagementLaneRow[];
  onOpenLane?: (id: ManagerModuleId) => void;
}

export const ExecutionManagementTable: React.FC<ExecutionManagementTableProps> = ({
  rows,
  onOpenLane,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'label',
        label: t('execution.managementTable.lane', 'Lane'),
        sortable: true,
      },
      {
        id: 'total',
        label: t('execution.managementTable.total', 'Items'),
        width: '100px',
        align: 'right',
        sortable: true,
      },
      {
        id: 'critical',
        label: t('execution.managementTable.critical', 'Critical'),
        width: '100px',
        align: 'right',
        sortable: true,
      },
      {
        id: 'warning',
        label: t('execution.managementTable.warning', 'Warning'),
        width: '100px',
        align: 'right',
        sortable: true,
      },
    ],
    [t]
  );

  const metaPills: MetaPill[] = useMemo(() => {
    if (!selected) return [];
    const pills: MetaPill[] = [];
    if (selected.critical > 0) {
      pills.push({ label: `${selected.critical} critical`, tone: 'danger' });
    }
    if (selected.warning > 0) {
      pills.push({ label: `${selected.warning} warning`, tone: 'warning' });
    }
    if (selected.critical === 0 && selected.warning === 0) {
      pills.push({ label: isPolish ? 'Zdrowe' : 'Healthy', tone: 'success' });
    }
    return pills;
  }, [selected, isPolish]);

  const previewDetailsText = useMemo(() => {
    if (!selected) return '';
    return isPolish
      ? `Lane: ${selected.label}. Elementy: ${selected.total}. Krytyczne: ${selected.critical}. Ostrzeżenia: ${selected.warning}.`
      : `Lane: ${selected.label}. Items: ${selected.total}. Critical: ${selected.critical}. Warning: ${selected.warning}.`;
  }, [selected, isPolish]);

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const r = row as unknown as ManagementLaneRow;
      return {
        primary: onOpenLane
          ? [
              {
                id: 'open-lane',
                label: t('execution.managementTable.openLane', 'Open lane'),
                icon: ChevronRight,
                onClick: () => onOpenLane(r.id),
              },
            ]
          : undefined,
        universalHandlers: {
          preview: () => setSelectedId(String(row.id)),
        },
      };
    },
    [onOpenLane, t]
  );

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          surfaceId="T35"
          columns={columns}
          data={rows}
          persistKey="execution.management"
          defaultSort={{ columnId: 'critical', direction: 'desc' }}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String(row.id))}
          rowMenu={rowMenu}
          rowDescription={() => null}
          empty={{
            title: t('execution.managementTable.emptyTitle', 'No management lanes'),
          }}
        />
      </div>

      {selected ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={selected.label}
            onClose={() => setSelectedId(null)}
            onOpenFull={onOpenLane ? () => onOpenLane(selected.id) : undefined}
            meta={{ pills: metaPills }}
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

export default ExecutionManagementTable;

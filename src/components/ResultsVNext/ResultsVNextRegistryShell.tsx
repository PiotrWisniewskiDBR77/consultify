/**
 * ResultsVNextRegistryShell — the ONE shared registry layout for every
 * RN-G2 domain (KPI / ROI / OKR). This is P0 of the RN-G2 work breakdown
 * (docs/product/results-vnext/RN_G2_UI_SCOPE.md §G) — the shell only, no
 * domain screens yet.
 *
 * Composes the Triada standard EXACTLY — StandardModuleBar (Menu 1/2/3, in
 * `children` mode) hosting a StandardTable + StandardPreview split, 1:1 with
 * the established pattern in `ReportsTabContent.tsx` / My Work Tasks
 * (`docs/ui-standards/TRIADA_KANON.md`). The shell does NOT reimplement any
 * of the three standard components' mechanics — it only wires their props
 * together and adds ONE thing none of them has on its own: a top-level
 * "forbidden" state that replaces the whole content area for a deep link to
 * a visibility-denied resource (§D).
 *
 * A future domain screen (P1's KPI registry, etc.) supplies only:
 *  - `moduleBar` — Menu 2/3 config (tabs/statusFilters/chips/bulk/...)
 *  - `table`     — columns/data/rowMenu/persistKey/... (StandardTableProps)
 *  - `preview`   — StandardPreviewProps for the selected row, or null/undefined
 *  - `forbidden` — set only when a deep link resolves to an ABAC DENY
 *
 * Loading/empty/error are NOT special-cased here — they are native to
 * `StandardTable` (`loading`/`empty`/`emptyMessage`/`error`+`onRetry`) and a
 * domain screen sets them directly on `table`, exactly like every other
 * StandardTable consumer in the repo. "Locked / lifecycle-gated" is per-row
 * (kebab `disabled`+`note`, see `LifecycleLockBadge.lockedRowMenuAction`) and
 * per-field (`HonestValueCell`) — also no shell-level special case needed.
 */

import React from 'react';

import {
  StandardModuleBar,
  type StandardModuleBarProps,
  StandardPreview,
  type StandardPreviewProps,
  StandardTable,
  type StandardTableProps,
} from '@/components/standard';

import type { ResultsVNextDomain, ResultsVNextForbiddenDetail } from './types';
import { ResultsVNextForbiddenState } from './ResultsVNextForbiddenState';

/** `persistKey` is REQUIRED here — RN-G2 must not silently fall back to an
 * unnamespaced key. See RN_G2_UI_SCOPE.md §H "collision trap": legacy
 * KPI/ROI/OKR already occupy `results.kpi-scorecards` / `results.roi-reviews`
 * / `results.okr-sets` (T36-T38 in the closed TableSurfaceId union) — RN-G2's
 * keys MUST be distinct or column-layout localStorage state corrupts both
 * screens. Every RN-G2 domain page in this package uses a
 * `results-vnext.<domain>-registry` key (see ResultsKpi/Roi/OkrRegistryPage.tsx).
 */
export type ResultsVNextTableProps = StandardTableProps & { persistKey: string };

export interface ResultsVNextRegistryShellProps {
  /** Used for `data-testid`/ARIA labelling only — no behavioral branching. */
  domain: ResultsVNextDomain;
  /** Menu 1/2/3 — everything StandardModuleBar takes except `children`. */
  moduleBar: Omit<StandardModuleBarProps, 'children'>;
  /** The registry table — columns/data/rowMenu/persistKey/loading/empty/error. */
  table: ResultsVNextTableProps;
  /** The row preview — omit/null when nothing is selected. */
  preview?: StandardPreviewProps | null;
  /**
   * Deep-link ABAC DENY (§D) — when set, replaces the ENTIRE content area
   * (table + preview) with the honest "you don't have access" state. Does
   * NOT affect the Menu 1/2/3 bar, which still orients the user.
   */
  forbidden?: ResultsVNextForbiddenDetail | null;
  onForbiddenBack?: () => void;
  className?: string;
}

export const ResultsVNextRegistryShell: React.FC<ResultsVNextRegistryShellProps> = ({
  domain,
  moduleBar,
  table,
  preview,
  forbidden,
  onForbiddenBack,
  className,
}) => {
  return (
    <div
      className={className ?? 'h-full'}
      data-testid={`results-vnext-${domain}-registry-shell`}
      data-domain={domain}
    >
      <StandardModuleBar {...moduleBar}>
        {forbidden ? (
          <div className="h-full min-h-0 overflow-auto">
            <ResultsVNextForbiddenState forbidden={forbidden} onBack={onForbiddenBack} />
          </div>
        ) : (
          <div className="h-full flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
              <StandardTable {...table} />
            </div>
            {preview ? (
              <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                <StandardPreview {...preview} />
              </aside>
            ) : null}
          </div>
        )}
      </StandardModuleBar>
    </div>
  );
};

export default ResultsVNextRegistryShell;

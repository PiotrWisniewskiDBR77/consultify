/**
 * List/detail-facing status cell for Discovery Tools (tool sessions + tool
 * outputs). Wires the canonical mapper (src/domain/toolStatus.ts) into the
 * ItemStatus-typed grid/filter machinery `DiscoveryToolsHub.tsx` already has,
 * WITHOUT re-introducing the ad-hoc `Record<string, ItemStatus>` maps that
 * caused the "approved/GENERATED renders as Draft" defect — see
 * docs/program/METHOD_TOOLS_2026-08-13/STATUS_CANON.md for the full
 * inventory.
 *
 * Split into its own file (rather than living inline in the ~5000-line
 * DiscoveryToolsHub.tsx) so it can be component-tested in isolation.
 */
import React from 'react';

import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import { resolveToolStatus, type ToolStatusDomain } from '@/domain/toolStatus';

import type { ItemStatus } from '../shared/ModuleHub';

/**
 * Canonical tool-status domain -> ItemStatus, for the ItemStatus-typed
 * grid/filter machinery this hub already has (dot color, tab filters). This
 * is ONLY the tone/bucket carrier — the user-visible LABEL always comes from
 * `resolveToolStatus(raw).labelPl/labelEn` via `renderToolStatusCell()`
 * below, never from this table. `unknown` intentionally lands on 'DRAFT'
 * here (a harmless WIP bucket for filtering) because the visible label is
 * always overridden with the explicit "nieznany status: <raw>" text — it is
 * never silently SHOWN as "Draft".
 */
export const TOOL_STATUS_DOMAIN_TO_ITEM_STATUS: Record<ToolStatusDomain, ItemStatus> = {
  draft: 'DRAFT',
  in_progress: 'EXECUTING',
  in_review: 'PENDING_REVIEW',
  approved: 'APPROVED',
  generated: 'DONE',
  finalized: 'DONE',
  superseded: 'ARCHIVED',
  failed: 'BLOCKED',
  unknown: 'DRAFT',
};

/**
 * Table/list-facing status cell: the canonical mapper drives BOTH the dot
 * tone and the label text. Pass the RAW backend status (tool_sessions.status
 * or tool_outputs.status) — never a pre-collapsed ItemStatus, or the label
 * degrades to the generic ItemStatus humanization.
 */
export function renderToolStatusCell(rawStatus: unknown, isPolish: boolean): React.ReactElement {
  const info = resolveToolStatus(
    typeof rawStatus === 'string' ? rawStatus : String(rawStatus ?? '')
  );
  const itemStatus = TOOL_STATUS_DOMAIN_TO_ITEM_STATUS[info.domain];
  return (
    <EntityStatusChip
      status={info.isUnknown ? 'unknown' : itemStatus}
      label={isPolish ? info.labelPl : info.labelEn}
    />
  );
}

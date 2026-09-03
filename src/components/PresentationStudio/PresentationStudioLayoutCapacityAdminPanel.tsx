/**
 * PresentationStudioLayoutCapacityAdminPanel (Sprint S20).
 *
 * SuperAdmin governance surface for the layout-capacity registry
 * built across S13 / S17 / S18 / S19. Closes three accumulated UI
 * carry-overs in one component:
 *
 *   - R-S17-3: SuperAdmin admin endpoint had no UI surface.
 *   - R-S18-4: persistence loadWarning surfaced only via the admin
 *     GET response, not in any UI.
 *   - R-S19-3: reset-to-defaults action (S19) had no UI button — a
 *     SuperAdmin had to call /reset/propose + /reset/execute via curl.
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - .cursor/rules/ai-actions-menu3.mdc
 *   - DRD/UI_UX_SOURCE_OF_TRUTH.md
 *   - DRD/consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md
 *
 * UI/UX governance:
 *   - The panel renders as a canvas section card adjacent to the rest
 *     of the Studio surface. Form-scoped buttons (Propose override,
 *     Confirm apply, Propose reset, Confirm reset) live inline with
 *     their forms because they are NOT contextual AI actions on the
 *     active deck/preview — they act on the registry config and
 *     need the textarea/reason context to be meaningful. The Studio
 *     page's Menu 3 right slot continues to host the deck-scoped AI
 *     actions (Run preview / Request approval / Confirm generate).
 *   - Server-driven visibility: a non-SuperAdmin GET returns 403
 *     PERMISSION_DENIED and the panel renders nothing — no fake
 *     "you don't have access" toast, the panel simply does not exist
 *     for users without the capability. This avoids a confusing
 *     "ghost surface" that returns 403 on every interaction.
 *   - Honest states: loading, success, error, empty, and degraded
 *     (loadWarning) are all rendered explicitly. No fake success on
 *     a failed propose, no infinite spinner during slow ticket
 *     redemptions, no hidden writes.
 *   - Canonical color palette: slate / blue / amber / emerald / rose;
 *     primary reserved for the destructive `Confirm reset to defaults`
 *     CTA so it stands out as a high-attention action.
 *   - The reset flow shows the pre-reset snapshot in the confirmation
 *     panel so the SuperAdmin sees exactly what configuration would
 *     be wiped — single-click resets are deliberately not supported.
 */

import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  LayoutCapacityAdminApiError,
  type LayoutCapacityAdminApprovalTicket,
  type LayoutCapacityAdminGetResponse,
  type LayoutCapacityAdminValidationError,
  type LayoutCapacityOverridesPayload,
  type LayoutCapacityRegistryLoadWarning,
  type LayoutCapacityRegistrySnapshot,
  PresentationStudioLayoutCapacityAdminApi,
} from '@/services/api/presentationStudioLayoutCapacityAdmin.api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for the typed `INVALID_APPROVAL_TICKET`
 * reasons. Mirrors the Studio page's labels so a SuperAdmin sees
 * the same wording across the deck-generate flow and the
 * layout-capacity admin flow.
 */
const TICKET_REJECTION_LABELS: Record<string, string> = {
  not_found: 'Ticket not found.',
  expired: 'Ticket expired before confirmation.',
  consumed: 'Ticket has already been used.',
  tenant_mismatch: 'Ticket was issued for a different organization.',
  user_mismatch: 'Ticket was issued for a different user.',
  payload_mismatch:
    'Override payload or reason changed since the ticket was issued. Re-propose to mint a fresh ticket.',
};

const LOAD_WARNING_LABELS: Record<LayoutCapacityRegistryLoadWarning['reason'], string> = {
  corrupt: 'Persisted overrides file is corrupt and could not be parsed.',
  unsupported_schema:
    'Persisted overrides file uses an unsupported schema version (deploy may be older than the file).',
  io_error:
    'I/O error reading or writing the persisted overrides file. Last apply may not be durable.',
  rejected_by_validator:
    'Persisted overrides were rejected by the current registry validator (likely a baseline change).',
  signature_mismatch:
    'Persisted overrides file signature is missing or invalid. Runtime overrides were ignored.',
};

function formatTicketRejection(reason: string | null | undefined): string {
  if (!reason) return 'Approval ticket was rejected.';
  return TICKET_REJECTION_LABELS[reason] || `Approval ticket rejected: ${reason}`;
}

function formatLoadWarning(reason: LayoutCapacityRegistryLoadWarning['reason']): string {
  return LOAD_WARNING_LABELS[reason] || `Persistence warning: ${reason}`;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

interface BootstrapState {
  status: 'loading' | 'forbidden' | 'ready' | 'error';
  data: LayoutCapacityAdminGetResponse | null;
  error: string | null;
}

interface OverrideFlowState {
  jsonText: string;
  reason: string;
  /** Validation errors raised at /propose time (412). */
  proposeErrors: LayoutCapacityAdminValidationError[] | null;
  /** Free-text error from a non-validation failure (e.g. JSON parse, network). */
  proposeError: string | null;
  /** Single-use ticket held between /propose success and /execute. */
  ticket: LayoutCapacityAdminApprovalTicket | null;
  /** Honest banner when /execute fails. */
  executeError: string | null;
  /** Snapshot returned by a successful /execute. */
  appliedSnapshot: LayoutCapacityRegistrySnapshot | null;
  pending: 'proposing' | 'executing' | null;
}

interface ResetFlowState {
  reason: string;
  ticket: LayoutCapacityAdminApprovalTicket | null;
  /**
   * Pre-reset snapshot displayed in the confirmation step so the
   * SuperAdmin sees what would be wiped. Captured at /reset/propose
   * time from the bootstrap snapshot (the propose endpoint itself
   * does NOT mutate state, so the bootstrap snapshot is still
   * authoritative).
   */
  preview: LayoutCapacityRegistrySnapshot | null;
  proposeError: string | null;
  executeError: string | null;
  /** Snapshot returned by a successful /reset/execute. */
  resetSnapshot: LayoutCapacityRegistrySnapshot | null;
  pending: 'proposing' | 'executing' | null;
}

const INITIAL_OVERRIDE_STATE: OverrideFlowState = {
  jsonText: '',
  reason: '',
  proposeErrors: null,
  proposeError: null,
  ticket: null,
  executeError: null,
  appliedSnapshot: null,
  pending: null,
};

const INITIAL_RESET_STATE: ResetFlowState = {
  reason: '',
  ticket: null,
  preview: null,
  proposeError: null,
  executeError: null,
  resetSnapshot: null,
  pending: null,
};

// ---------------------------------------------------------------------------
// Snapshot diff helpers
// ---------------------------------------------------------------------------

interface SnapshotDiffRow {
  /** Human-readable path, e.g. `densityBudgets.balanced.titleMaxChars`. */
  path: string;
  /** Stringified default value for inline display. */
  defaultValue: string;
  /** Stringified current value. */
  currentValue: string;
  /** True iff `current !== default` (drives the highlight). */
  changed: boolean;
}

function diffSnapshots(
  current: LayoutCapacityRegistrySnapshot,
  defaults: LayoutCapacityRegistrySnapshot
): SnapshotDiffRow[] {
  const rows: SnapshotDiffRow[] = [];

  // Density budgets — exhaustive, fixed three tiers.
  for (const tier of ['visual', 'balanced', 'document'] as const) {
    for (const field of ['titleMaxChars', 'keyMessageMaxChars', 'blocksMax'] as const) {
      const cur = current.densityBudgets[tier][field];
      const def = defaults.densityBudgets[tier][field];
      rows.push({
        path: `densityBudgets.${tier}.${field}`,
        defaultValue: String(def),
        currentValue: String(cur),
        changed: cur !== def,
      });
    }
  }

  // Family overrides — only included if `current` has any (sparse).
  const familyKeys = new Set([
    ...Object.keys(current.templateFamilyOverrides),
    ...Object.keys(defaults.templateFamilyOverrides),
  ]);
  for (const familyName of Array.from(familyKeys).sort()) {
    const cur = current.templateFamilyOverrides[familyName];
    const def = defaults.templateFamilyOverrides[familyName];
    const curStr = cur ? JSON.stringify(cur) : '—';
    const defStr = def ? JSON.stringify(def) : '—';
    rows.push({
      path: `templateFamilyOverrides.${familyName}`,
      defaultValue: defStr,
      currentValue: curStr,
      changed: curStr !== defStr,
    });
  }

  // Family aliases — same sparse treatment.
  const aliasKeys = new Set([
    ...Object.keys(current.familyAliasByDeckType),
    ...Object.keys(defaults.familyAliasByDeckType),
  ]);
  for (const aliasKey of Array.from(aliasKeys).sort()) {
    const cur = current.familyAliasByDeckType[aliasKey];
    const def = defaults.familyAliasByDeckType[aliasKey];
    rows.push({
      path: `familyAliasByDeckType.${aliasKey}`,
      defaultValue: def ?? '—',
      currentValue: cur ?? '—',
      changed: cur !== def,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Visual primitives
// ---------------------------------------------------------------------------

function ErrorList({
  errors,
  testId,
}: {
  errors: LayoutCapacityAdminValidationError[];
  testId?: string;
}): React.ReactElement {
  return (
    <ul
      className="list-disc space-y-0.5 pl-5 text-danger-700 dark:text-danger-300"
      data-testid={testId}
    >
      {errors.map((e, i) => (
        <li key={i}>
          <span className="font-mono text-xs">{e.path}</span>: {e.reason}
        </li>
      ))}
    </ul>
  );
}

function PendingButtonContent({
  pending,
  idleIcon,
  idleLabel,
  pendingLabel,
}: {
  pending: boolean;
  idleIcon: React.ReactNode;
  idleLabel: string;
  pendingLabel: string;
}): React.ReactElement {
  return (
    <>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : idleIcon}
      <span>{pending ? pendingLabel : idleLabel}</span>
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface PresentationStudioLayoutCapacityAdminPanelProps {
  /**
   * Optional override for the API surface. Production code uses the
   * default singleton; tests inject a mock so component tests do not
   * have to mock the api module globally.
   */
  api?: typeof PresentationStudioLayoutCapacityAdminApi;
  /** Test hook for stable element targeting. */
  testId?: string;
}

export const PresentationStudioLayoutCapacityAdminPanel: React.FC<
  PresentationStudioLayoutCapacityAdminPanelProps
> = ({
  api = PresentationStudioLayoutCapacityAdminApi,
  testId = 'studio-layout-capacity-admin',
}) => {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [overrideFlow, setOverrideFlow] = useState<OverrideFlowState>(INITIAL_OVERRIDE_STATE);
  const [resetFlow, setResetFlow] = useState<ResetFlowState>(INITIAL_RESET_STATE);

  // ---------------------------------------------------------------------------
  // Bootstrap (server-driven visibility)
  // ---------------------------------------------------------------------------

  const loadBootstrap = useCallback(async () => {
    setBootstrap({ status: 'loading', data: null, error: null });
    try {
      const data = await api.get();
      setBootstrap({ status: 'ready', data, error: null });
    } catch (err) {
      if (err instanceof LayoutCapacityAdminApiError && err.status === 403) {
        // Honest hide-yourself: non-SuperAdmin sees nothing.
        setBootstrap({ status: 'forbidden', data: null, error: null });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error loading admin surface.';
      setBootstrap({ status: 'error', data: null, error: message });
    }
  }, [api]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // ---------------------------------------------------------------------------
  // Override propose
  // ---------------------------------------------------------------------------

  const proposeOverride = useCallback(async () => {
    const trimmed = overrideFlow.jsonText.trim();
    let parsed: LayoutCapacityOverridesPayload;
    try {
      parsed = trimmed === '' ? {} : (JSON.parse(trimmed) as LayoutCapacityOverridesPayload);
    } catch (err) {
      setOverrideFlow((prev) => ({
        ...prev,
        proposeError:
          err instanceof Error
            ? `Could not parse overrides JSON: ${err.message}`
            : 'Could not parse overrides JSON.',
        proposeErrors: null,
        ticket: null,
      }));
      return;
    }

    setOverrideFlow((prev) => ({
      ...prev,
      pending: 'proposing',
      proposeError: null,
      proposeErrors: null,
      ticket: null,
      executeError: null,
      appliedSnapshot: null,
    }));
    try {
      const result = await api.proposeOverrides({
        overrides: parsed,
        reason: overrideFlow.reason || null,
      });
      setOverrideFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: result.ticket,
        proposeError: null,
        proposeErrors: null,
      }));
    } catch (err) {
      if (err instanceof LayoutCapacityAdminApiError && err.code === 'INVALID_OVERRIDES_PAYLOAD') {
        setOverrideFlow((prev) => ({
          ...prev,
          pending: null,
          ticket: null,
          proposeErrors: err.errors ?? [],
          proposeError: null,
        }));
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown error proposing override.';
      setOverrideFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: null,
        proposeError: message,
        proposeErrors: null,
      }));
    }
  }, [api, overrideFlow.jsonText, overrideFlow.reason]);

  // ---------------------------------------------------------------------------
  // Override execute
  // ---------------------------------------------------------------------------

  const executeOverride = useCallback(async () => {
    if (!overrideFlow.ticket) return;
    let parsed: LayoutCapacityOverridesPayload;
    try {
      const trimmed = overrideFlow.jsonText.trim();
      parsed = trimmed === '' ? {} : (JSON.parse(trimmed) as LayoutCapacityOverridesPayload);
    } catch {
      // Should never happen — propose already validated parse.
      return;
    }
    setOverrideFlow((prev) => ({
      ...prev,
      pending: 'executing',
      executeError: null,
      appliedSnapshot: null,
    }));
    try {
      const result = await api.executeOverrides({
        approvalTicket: overrideFlow.ticket.ticketId,
        overrides: parsed,
        reason: overrideFlow.reason || null,
      });
      setOverrideFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: null, // single-use; clear once redeemed
        executeError: null,
        appliedSnapshot: result.registrySnapshotAfter,
      }));
      // Refresh the bootstrap snapshot so the diff view reflects the
      // new state. We could just splice in `result.registrySnapshotAfter`
      // but a full refresh also picks up any concurrent loadWarning
      // updates from the persistence layer.
      void loadBootstrap();
    } catch (err) {
      const isApi = err instanceof LayoutCapacityAdminApiError;
      const message = isApi
        ? err.code === 'INVALID_APPROVAL_TICKET'
          ? formatTicketRejection(err.reason)
          : err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error confirming override.';
      setOverrideFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: null, // any rejection invalidates the ticket
        executeError: message,
      }));
    }
  }, [api, loadBootstrap, overrideFlow.jsonText, overrideFlow.reason, overrideFlow.ticket]);

  // ---------------------------------------------------------------------------
  // Reset propose
  // ---------------------------------------------------------------------------

  const proposeReset = useCallback(async () => {
    setResetFlow((prev) => ({
      ...prev,
      pending: 'proposing',
      proposeError: null,
      executeError: null,
      ticket: null,
      preview: null,
      resetSnapshot: null,
    }));
    try {
      const result = await api.proposeReset({ reason: resetFlow.reason || null });
      setResetFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: result.ticket,
        // Capture the bootstrap snapshot so the confirmation panel
        // shows the exact state that would be wiped. /reset/propose
        // does NOT mutate state, so this is still authoritative.
        preview: bootstrap.data?.current ?? null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error proposing reset.';
      setResetFlow((prev) => ({ ...prev, pending: null, ticket: null, proposeError: message }));
    }
  }, [api, bootstrap.data, resetFlow.reason]);

  // ---------------------------------------------------------------------------
  // Reset execute
  // ---------------------------------------------------------------------------

  const executeReset = useCallback(async () => {
    if (!resetFlow.ticket) return;
    setResetFlow((prev) => ({ ...prev, pending: 'executing', executeError: null }));
    try {
      const result = await api.executeReset({
        approvalTicket: resetFlow.ticket.ticketId,
        reason: resetFlow.reason || null,
      });
      setResetFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: null,
        executeError: null,
        resetSnapshot: result.registrySnapshotAfter,
      }));
      void loadBootstrap();
    } catch (err) {
      const isApi = err instanceof LayoutCapacityAdminApiError;
      const message = isApi
        ? err.code === 'INVALID_APPROVAL_TICKET'
          ? formatTicketRejection(err.reason)
          : err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error confirming reset.';
      setResetFlow((prev) => ({
        ...prev,
        pending: null,
        ticket: null,
        executeError: message,
      }));
    }
  }, [api, loadBootstrap, resetFlow.reason, resetFlow.ticket]);

  // ---------------------------------------------------------------------------
  // Memoized derived UI fields
  // ---------------------------------------------------------------------------

  const diffRows = useMemo<SnapshotDiffRow[]>(() => {
    if (!bootstrap.data) return [];
    return diffSnapshots(bootstrap.data.current, bootstrap.data.defaults);
  }, [bootstrap.data]);

  const changedRowCount = useMemo<number>(
    () => diffRows.filter((r) => r.changed).length,
    [diffRows]
  );

  // ---------------------------------------------------------------------------
  // Render — short-circuit branches
  // ---------------------------------------------------------------------------

  // Honest hide-yourself for non-SuperAdmin. We intentionally render
  // nothing — no toast, no banner — so the panel does not exist for
  // users who lack the capability.
  if (bootstrap.status === 'forbidden') {
    return null;
  }

  if (bootstrap.status === 'loading') {
    return (
      <section
        className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        data-testid={`${testId}-loading`}
      >
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading layout-capacity admin surface…</span>
        </div>
      </section>
    );
  }

  if (bootstrap.status === 'error' || !bootstrap.data) {
    return (
      <section
        className="rounded-xl border border-danger-200 bg-danger-50 px-5 py-4 dark:border-danger-900/60 dark:bg-danger-900/40"
        data-testid={`${testId}-error`}
        role="alert"
      >
        <div className="flex items-start gap-3 text-sm text-danger-700 dark:text-danger-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">Failed to load layout-capacity admin surface</div>
            <div className="mt-1">{bootstrap.error}</div>
            <button
              type="button"
              onClick={() => void loadBootstrap()}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-danger-300 bg-white px-3 py-1 text-xs font-medium text-danger-700 hover:bg-danger-50 dark:border-danger-700 dark:bg-danger-900/40 dark:text-danger-200 dark:hover:bg-danger-900/60"
              data-testid={`${testId}-retry`}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Ready state — bootstrap.data is present.
  const data = bootstrap.data;

  return (
    <section
      className="space-y-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      data-testid={testId}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Layout-capacity admin (SuperAdmin)
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tenant-scoped registry that drives the Studio layout audit for the authenticated
            organization. Changes are gated by an explicit approval ticket and audited as
            <span className="ml-1 font-mono text-xs">
              presentation_studio_layout_capacity_overrides_*
            </span>
            .
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          scope: {data.scope}
        </span>
      </header>

      {/* Honest degraded-load banner (Sprint S18 + S20). */}
      {data.loadWarning ? (
        <div className="px-5">
          <div
            className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
              data.loadWarning.reason === 'corrupt' ||
              data.loadWarning.reason === 'rejected_by_validator' ||
              data.loadWarning.reason === 'signature_mismatch'
                ? 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
            }`}
            role="alert"
            data-testid={`${testId}-load-warning`}
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{formatLoadWarning(data.loadWarning.reason)}</div>
              <div className="mt-1 break-words font-mono text-xs">
                {data.loadWarning.sourcePath}
              </div>
              {data.loadWarning.details ? (
                <div className="mt-1 break-words">{data.loadWarning.details}</div>
              ) : null}
              <div className="mt-1 text-xs opacity-80">raised: {data.loadWarning.raisedAt}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Snapshot diff (current vs defaults). */}
      <div className="px-5 pb-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Current vs defaults
          </h3>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                changedRowCount === 0
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              }`}
              data-testid={`${testId}-changed-count`}
            >
              {changedRowCount} changed
            </span>
            <button
              type="button"
              onClick={() => void loadBootstrap()}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              data-testid={`${testId}-refresh`}
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
        <div
          className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800"
          data-testid={`${testId}-diff-table`}
        >
          <table
            /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800"
          >
            <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Path
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Default
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Current
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {diffRows.map((row) => (
                <tr
                  key={row.path}
                  className={
                    row.changed ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'bg-white dark:bg-slate-900'
                  }
                >
                  <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-300">
                    {row.path}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-500 dark:text-slate-400">
                    {row.defaultValue}
                  </td>
                  <td
                    className={`px-3 py-1.5 font-mono ${
                      row.changed
                        ? 'font-medium text-blue-700 dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {row.currentValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override flow */}
      <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Apply layout-capacity override
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Paste a `LayoutCapacityOverridesPayload` JSON below. The server validates strictly before
          minting an approval ticket; your input is never silently coerced.
        </p>

        <label className="mt-3 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Overrides JSON
          <textarea
            value={overrideFlow.jsonText}
            onChange={(e) =>
              setOverrideFlow((prev) => ({
                ...prev,
                jsonText: e.target.value,
                proposeError: null,
                proposeErrors: null,
                ticket: null, // changing the payload invalidates any prior ticket
              }))
            }
            rows={6}
            placeholder={'{\n  "densityBudgets": { "balanced": { "titleMaxChars": 100 } }\n}'}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-sm focus-visible:border-c-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-800"
            disabled={overrideFlow.pending !== null}
            data-testid={`${testId}-overrides-json`}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Reason (recorded in audit_logs)
          <input
            type="text"
            value={overrideFlow.reason}
            onChange={(e) =>
              setOverrideFlow((prev) => ({
                ...prev,
                reason: e.target.value,
                ticket: null, // reason is part of the fingerprint
              }))
            }
            placeholder="e.g. tightening title cap for executive decks"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:border-c-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-800"
            disabled={overrideFlow.pending !== null}
            data-testid={`${testId}-overrides-reason`}
          />
        </label>

        {overrideFlow.proposeError ? (
          <div
            className="mt-3 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid={`${testId}-overrides-propose-error`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">{overrideFlow.proposeError}</div>
          </div>
        ) : null}

        {overrideFlow.proposeErrors ? (
          <div
            className="mt-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid={`${testId}-overrides-validation-errors`}
          >
            <div className="mb-1 font-medium">Server validator rejected the payload:</div>
            <ErrorList errors={overrideFlow.proposeErrors} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!overrideFlow.ticket ? (
            <button
              type="button"
              onClick={() => void proposeOverride()}
              disabled={overrideFlow.pending !== null}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              data-testid={`${testId}-overrides-propose`}
            >
              <PendingButtonContent
                pending={overrideFlow.pending === 'proposing'}
                idleIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                idleLabel="Propose override"
                pendingLabel="Validating…"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void executeOverride()}
              disabled={overrideFlow.pending === 'executing'}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
              data-testid={`${testId}-overrides-execute`}
            >
              <PendingButtonContent
                pending={overrideFlow.pending === 'executing'}
                idleIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                idleLabel={`Confirm apply · ticket ${overrideFlow.ticket.ticketId.slice(-6)}`}
                pendingLabel="Applying…"
              />
            </button>
          )}
        </div>

        {overrideFlow.executeError ? (
          <div
            className="mt-3 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid={`${testId}-overrides-execute-error`}
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">{overrideFlow.executeError}</div>
          </div>
        ) : null}

        {overrideFlow.appliedSnapshot ? (
          <div
            className="mt-3 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
            role="status"
            data-testid={`${testId}-overrides-success`}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Override applied and audited</div>
              <div className="mt-1 text-xs opacity-80">
                Audit event: presentation_studio_layout_capacity_overrides_applied
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Reset flow */}
      <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Reset to canonical defaults
        </h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Drops every prior override and reverts the registry to the defaults baked into this
          deploy. Persisted on disk via the S18 hook so the reset survives a server restart.
        </p>

        <label className="mt-3 block text-xs font-medium text-slate-700 dark:text-slate-300">
          Reason (recorded in audit_logs)
          <input
            type="text"
            value={resetFlow.reason}
            onChange={(e) =>
              setResetFlow((prev) => ({ ...prev, reason: e.target.value, ticket: null }))
            }
            placeholder="e.g. returning to defaults after S17 experiment"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:border-c-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:disabled:bg-slate-800"
            disabled={resetFlow.pending !== null}
            data-testid={`${testId}-reset-reason`}
          />
        </label>

        {resetFlow.proposeError ? (
          <div
            className="mt-3 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid={`${testId}-reset-propose-error`}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">{resetFlow.proposeError}</div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!resetFlow.ticket ? (
            <button
              type="button"
              onClick={() => void proposeReset()}
              disabled={resetFlow.pending !== null}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40"
              data-testid={`${testId}-reset-propose`}
            >
              <PendingButtonContent
                pending={resetFlow.pending === 'proposing'}
                idleIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
                idleLabel="Propose reset"
                pendingLabel="Requesting ticket…"
              />
            </button>
          ) : (
            <div
              className="w-full space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40"
              data-testid={`${testId}-reset-confirmation`}
            >
              <div className="flex items-start gap-3 text-sm text-amber-800 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">Confirm reset to defaults</div>
                  <div className="mt-1 text-xs">
                    The pre-reset snapshot below is the configuration that will be wiped and
                    recorded in the audit row. Re-propose with a different reason to mint a new
                    ticket.
                  </div>
                </div>
              </div>

              {resetFlow.preview ? (
                <pre
                  className="max-h-48 overflow-auto rounded border border-amber-200 bg-white p-2 text-xs text-slate-700 dark:border-amber-900/60 dark:bg-slate-950 dark:text-slate-300"
                  data-testid={`${testId}-reset-preview`}
                >
                  {JSON.stringify(resetFlow.preview, null, 2)}
                </pre>
              ) : null}

              <button
                type="button"
                onClick={() => void executeReset()}
                disabled={resetFlow.pending === 'executing'}
                className="inline-flex items-center gap-2 rounded-full bg-danger-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-danger-500 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-danger-500 dark:hover:bg-danger-400"
                data-testid={`${testId}-reset-execute`}
              >
                <PendingButtonContent
                  pending={resetFlow.pending === 'executing'}
                  idleIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
                  idleLabel={`Confirm reset · ticket ${resetFlow.ticket.ticketId.slice(-6)}`}
                  pendingLabel="Resetting…"
                />
              </button>
            </div>
          )}
        </div>

        {resetFlow.executeError ? (
          <div
            className="mt-3 flex items-start gap-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:border-danger-900/60 dark:bg-danger-900/40 dark:text-danger-300"
            role="alert"
            data-testid={`${testId}-reset-execute-error`}
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">{resetFlow.executeError}</div>
          </div>
        ) : null}

        {resetFlow.resetSnapshot ? (
          <div
            className="mt-3 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
            role="status"
            data-testid={`${testId}-reset-success`}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">Registry reset to canonical defaults</div>
              <div className="mt-1 text-xs opacity-80">
                Audit event: presentation_studio_layout_capacity_overrides_reset
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PresentationStudioLayoutCapacityAdminPanel;

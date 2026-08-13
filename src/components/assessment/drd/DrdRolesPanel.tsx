/**
 * DrdRolesPanel — process roles, assignment, role history and approval
 * trail for a Method Kernel session (agent S2, CEL 3, 2026-08-13).
 *
 * Talks to `server/src/routes/method-core-roles.routes.ts` over
 * `src/method-core/api/methodCoreRolesApi.ts` — the HTTP surface this
 * agent's work adds. Closes the gap
 * `DrdHttpMethodWorkspaceScreen.tsx`'s header comment names explicitly:
 * "no HTTP endpoint assigns extra process roles after session creation" —
 * this panel is the UI for that endpoint, not wired into that screen (a
 * separate, gated visual-risk step per CLAUDE.md rule #7 — this file is a
 * standalone component a workspace screen can embed later).
 *
 * Three lists, all through `StandardTable` (kanon §1 — a module screen may
 * not hand-roll its own table): current assignments, append-only grant/
 * revoke history, and the approval trail (DECISION_APPROVED /
 * DECISION_SENT_BACK / OUTPUT_APPROVED events, scoped to this exact session
 * id — see `MethodSessionRoleService.approvalTrail`'s doc comment on why a
 * reopened revision never inherits another revision's trail). Plus a small
 * grant form and a send-back form (comment required — hard rule #3).
 *
 * Kanon: crimson (`c-danger`) reserved for blockers/errors only; CTA/focus
 * use neutral/`c-focus` tokens; states empty/loading/error.
 */
import { AlertCircle, ShieldOff, UserMinus, UserPlus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { StandardTable, type TableColumn, type TableRow } from '@/components/standard/StandardTable';
import { METHOD_PROCESS_ROLES, type MethodProcessRole } from '@/method-core/contracts';
import {
  approvalTrail as apiApprovalTrail,
  assignRole as apiAssignRole,
  listRoles as apiListRoles,
  revokeRole as apiRevokeRole,
  roleHistory as apiRoleHistory,
  sendBack as apiSendBack,
  MethodCoreRolesApiError,
  type ApprovalTrailEntry,
  type RoleAssignment,
  type RoleHistoryEntry,
} from '@/method-core/api/methodCoreRolesApi';

export interface DrdRolesPanelProps {
  readonly sessionId: string;
  /** Current authenticated user — used only to disable the "grant approver
   * to myself" combination client-side (the server refuses it either way;
   * this is a UX shortcut, never the enforcement point). */
  readonly currentUserId: string;
}

const ROLE_COLUMNS: TableColumn[] = [
  { id: 'role', label: 'Rola', sortable: true },
  { id: 'userId', label: 'Użytkownik', sortable: true },
  { id: 'createdAt', label: 'Nadano', sortable: true, render: (row: TableRow) => formatDate(row.createdAt as string) },
];

const HISTORY_COLUMNS: TableColumn[] = [
  { id: 'occurredAt', label: 'Kiedy', sortable: true, render: (row: TableRow) => formatDate(row.occurredAt as string) },
  { id: 'eventType', label: 'Zdarzenie', sortable: true, render: (row: TableRow) => (row.eventType === 'granted' ? 'Nadano' : 'Odebrano') },
  { id: 'role', label: 'Rola', sortable: true },
  { id: 'userId', label: 'Użytkownik', sortable: true },
  { id: 'actorUserId', label: 'Kto wykonał', sortable: true },
];

const APPROVAL_COLUMNS: TableColumn[] = [
  { id: 'occurredAt', label: 'Kiedy', sortable: true, render: (row: TableRow) => formatDate(row.occurredAt as string) },
  { id: 'type', label: 'Decyzja', sortable: true, render: (row: TableRow) => approvalTypeLabel(row.type as string) },
  { id: 'version', label: 'Rewizja (v)', align: 'right', render: (row: TableRow) => (row.version == null ? '—' : String(row.version)) },
  { id: 'actorUserId', label: 'Kto', sortable: true, render: (row: TableRow) => (row.actorUserId as string) ?? '—' },
  { id: 'rationale', label: 'Uzasadnienie', render: (row: TableRow) => (row.rationale as string) ?? '—' },
];

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pl-PL');
  } catch {
    return iso;
  }
}

function approvalTypeLabel(type: string): string {
  if (type === 'DECISION_APPROVED') return 'Zatwierdzono';
  if (type === 'DECISION_SENT_BACK') return 'Odesłano do pracy';
  if (type === 'OUTPUT_APPROVED') return 'Zatwierdzono Output';
  return type;
}

type SectionStatus = 'loading' | 'ready' | 'error';

export const DrdRolesPanel: React.FC<DrdRolesPanelProps> = ({ sessionId, currentUserId }) => {
  const [roles, setRoles] = useState<RoleAssignment[]>([]);
  const [history, setHistory] = useState<RoleHistoryEntry[]>([]);
  const [trail, setTrail] = useState<ApprovalTrailEntry[]>([]);
  const [status, setStatus] = useState<SectionStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  // -- grant form ---------------------------------------------------------
  const [grantUserId, setGrantUserId] = useState('');
  const [grantRoleValue, setGrantRoleValue] = useState<MethodProcessRole>('reviewer');
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  // -- send-back form -------------------------------------------------------
  const [sendBackComment, setSendBackComment] = useState('');
  const [sendBackBusy, setSendBackBusy] = useState(false);
  const [sendBackError, setSendBackError] = useState<string | null>(null);
  const [sendBackResult, setSendBackResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [rolesRes, historyRes, trailRes] = await Promise.all([
        apiListRoles(sessionId),
        apiRoleHistory(sessionId),
        apiApprovalTrail(sessionId),
      ]);
      setRoles(rolesRes);
      setHistory(historyRes);
      setTrail(trailRes);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof MethodCoreRolesApiError ? err.message : 'Nie udało się wczytać ról sesji.');
      setStatus('error');
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGrant = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setGrantError(null);
      if (!grantUserId.trim()) {
        setGrantError('Podaj identyfikator użytkownika.');
        return;
      }
      if (grantRoleValue === 'approver' && grantUserId.trim() === currentUserId) {
        setGrantError('Nie możesz nadać roli „approver" samemu sobie.');
        return;
      }
      setGrantBusy(true);
      try {
        await apiAssignRole(sessionId, grantUserId.trim(), grantRoleValue);
        setGrantUserId('');
        await load();
      } catch (err) {
        setGrantError(
          err instanceof MethodCoreRolesApiError
            ? mapAssignErrorMessage(err)
            : 'Nadanie roli nie powiodło się.'
        );
      } finally {
        setGrantBusy(false);
      }
    },
    [grantUserId, grantRoleValue, currentUserId, sessionId, load]
  );

  const handleRevoke = useCallback(
    async (userId: string, role: MethodProcessRole) => {
      try {
        await apiRevokeRole(sessionId, userId, role);
        await load();
      } catch (err) {
        setError(err instanceof MethodCoreRolesApiError ? err.message : 'Odebranie roli nie powiodło się.');
      }
    },
    [sessionId, load]
  );

  const handleSendBack = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setSendBackError(null);
      setSendBackResult(null);
      if (!sendBackComment.trim()) {
        setSendBackError('Komentarz jest wymagany — odesłanie bez uzasadnienia jest niemożliwe.');
        return;
      }
      setSendBackBusy(true);
      try {
        const res = await apiSendBack(sessionId, sendBackComment.trim());
        setSendBackComment('');
        setSendBackResult(
          res.newRevision
            ? `Odesłano. Nowa rewizja: ${res.newRevision.id.slice(0, 8)} (stan: ${res.newRevision.state}).`
            : `Odesłano. Sesja wraca do stanu: ${res.session.state}.`
        );
        await load();
      } catch (err) {
        setSendBackError(err instanceof MethodCoreRolesApiError ? err.message : 'Odesłanie nie powiodło się.');
      } finally {
        setSendBackBusy(false);
      }
    },
    [sendBackComment, sessionId, load]
  );

  const isLoading = status === 'loading';

  return (
    <div className="space-y-6" data-testid="drd-roles-panel">
      {/* Roles — current assignments */}
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-c-text">Role w sesji</h2>
        </div>

        <form onSubmit={handleGrant} className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="drd-role-user" className="text-[11px] font-medium text-c-text-secondary">
              Użytkownik (id)
            </label>
            <input
              id="drd-role-user"
              type="text"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              placeholder="user-id"
              className="rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="drd-role-select" className="text-[11px] font-medium text-c-text-secondary">
              Rola
            </label>
            <select
              id="drd-role-select"
              value={grantRoleValue}
              onChange={(e) => setGrantRoleValue(e.target.value as MethodProcessRole)}
              className="rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus"
            >
              {METHOD_PROCESS_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={grantBusy}
            className="flex items-center gap-1.5 rounded-md border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-c-focus"
          >
            <UserPlus size={13} /> Nadaj rolę
          </button>
          {grantError ? (
            <p className="flex items-center gap-1 text-[11px] text-c-danger" role="alert">
              <AlertCircle size={12} /> {grantError}
            </p>
          ) : null}
        </form>

        <StandardTable
          columns={ROLE_COLUMNS}
          data={roles.map((r) => ({ id: `${r.userId}:${r.role}`, ...r }))}
          loading={isLoading}
          error={status === 'error' ? error : null}
          onRetry={load}
          empty={{
            title: 'Brak ról w tej sesji',
            description: 'Nadaj pierwszą rolę powyżej — bez roli „owner" sesja nie może przejść dalej niż draft.',
            icon: ShieldOff,
          }}
          rowMenu={(row) => ({
            destructive: {
              label: 'Odbierz rolę',
              icon: UserMinus,
              onClick: () => void handleRevoke(row.userId as string, row.role as MethodProcessRole),
            },
          })}
          persistKey="drd.rolesPanel.roles"
          density="compact"
        />
      </section>

      {/* Send back — reject in_review or reopen a frozen session */}
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-c-text">Odeślij do pracy</h2>
        <p className="mb-2 text-xs text-c-text-muted">
          Wymaga komentarza. Jeśli sesja jest zamrożona, odesłanie tworzy nową rewizję (reopen); jeśli jest w recenzji,
          wraca do pracy w tej samej sesji.
        </p>
        <form onSubmit={handleSendBack} className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <label htmlFor="drd-send-back-comment" className="text-[11px] font-medium text-c-text-secondary">
              Komentarz (wymagany)
            </label>
            <input
              id="drd-send-back-comment"
              type="text"
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              placeholder="Powód odesłania…"
              className="rounded-md border border-c-border bg-c-surface px-2 py-1.5 text-xs text-c-text focus:border-c-focus focus:outline-none focus:ring-1 focus:ring-c-focus"
            />
          </div>
          <button
            type="submit"
            disabled={sendBackBusy}
            className="rounded-md border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-c-focus"
          >
            Odeślij
          </button>
        </form>
        {sendBackError ? (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-c-danger" role="alert">
            <AlertCircle size={12} /> {sendBackError}
          </p>
        ) : null}
        {sendBackResult ? <p className="mt-2 text-[11px] text-c-text-secondary">{sendBackResult}</p> : null}
      </section>

      {/* Role history — append-only */}
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-c-text">Historia ról (append-only)</h2>
        <StandardTable
          columns={HISTORY_COLUMNS}
          // `h` już niesie `id`; wcześniejsze `{ id: h.id, ...h }` dawało TS2783
          // („id jest nadpisywane przez spread") i blokowało realny build —
          // vitest/esbuild tego nie łapią, bo nie sprawdzają typów.
          data={history}
          loading={isLoading}
          error={status === 'error' ? error : null}
          onRetry={load}
          empty={{ title: 'Brak historii', description: 'Nadania i odebrania ról pojawią się tutaj.' }}
          persistKey="drd.rolesPanel.history"
          density="compact"
        />
      </section>

      {/* Approval trail */}
      <section className="rounded-xl border border-c-border bg-c-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-c-text">Ślad zatwierdzeń</h2>
        <StandardTable
          columns={APPROVAL_COLUMNS}
          data={trail.map((t) => ({ id: t.eventId, ...t }))}
          loading={isLoading}
          error={status === 'error' ? error : null}
          onRetry={load}
          empty={{
            title: 'Brak zatwierdzeń dla tej rewizji',
            description: 'Decyzje (zatwierdzenie, odesłanie) dla tej dokładnej rewizji pojawią się tutaj.',
          }}
          persistKey="drd.rolesPanel.approvalTrail"
          density="compact"
        />
      </section>
    </div>
  );
};

function mapAssignErrorMessage(err: MethodCoreRolesApiError): string {
  if (err.body.error === 'cannot_self_assign_approver') {
    return 'Nie możesz nadać roli „approver" samemu sobie.';
  }
  if (err.status === 403 || err.status === 404) {
    return 'Sesja nie należy do Twojej organizacji.';
  }
  if (err.body.error === 'unknown_role') {
    return 'Nieznana rola.';
  }
  return err.message;
}

export default DrdRolesPanel;

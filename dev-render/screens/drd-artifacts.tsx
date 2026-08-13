/**
 * DrdArtifactsHarnessScreen — S2 CEL 1 browser E2E harness (2026-08-13).
 *
 * Mounts the REAL `DrdArtifactsPanel` (S1) and the REAL `DrdRolesPanel`
 * (S2, this agent) against a REAL running server over REAL `fetch` —
 * NO mock, no localStorage-only runtime. This is deliberately NOT the full
 * `DrdMethodWorkspaceScreen`/`DrdHttpMethodWorkspaceScreen` (S3's territory,
 * out of scope) — just the two artefact/role surfaces this agent owns,
 * standalone, so `tests/e2e/drd-full-chain.spec.ts` can screenshot and
 * assert on them in isolation.
 *
 * `view`:
 *  - 'library'  — GET /api/method/packs, rendered as a StandardTable.
 *  - 'session'  — a small session-detail header (GET /sessions/:id).
 *  - 'roles'    — DrdRolesPanel only.
 *  - 'artifacts'— DrdArtifactsPanel only (Outputs/Reports/Presentations/
 *                 Initiative Drafts + lineage list, all four sections).
 *  - 'lineage'  — same DrdArtifactsPanel, scrolled/anchored so the lineage
 *                 section is the visible one (screenshot #06).
 */
import React, { useEffect, useState } from 'react';

import { StandardTable, type TableColumn, type TableRow } from '../../src/components/standard/StandardTable';
import { DrdArtifactsPanel } from '../../src/components/assessment/drd/DrdArtifactsPanel';
import { DrdRolesPanel } from '../../src/components/assessment/drd/DrdRolesPanel';
import { DrdSourceIndicator } from '../../src/components/assessment/drd/DrdSourceIndicator';
import { listPacks, getSession, type MethodPackSummary } from '../../src/method-core/api/methodCoreApi';
import type { MethodSession } from '../../src/method-core/contracts';

const PACK_COLUMNS: TableColumn[] = [
  { id: 'name', label: 'Nazwa', sortable: true },
  { id: 'packId', label: 'Pack ID', sortable: true },
  { id: 'version', label: 'Wersja' },
  { id: 'readiness', label: 'Gotowość' },
];

export type DrdArtifactsHarnessView = 'library' | 'session' | 'roles' | 'artifacts' | 'lineage';

export interface DrdArtifactsHarnessScreenProps {
  readonly view: DrdArtifactsHarnessView;
  readonly sessionId?: string;
  readonly currentUserId: string;
}

const LibraryView: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [packs, setPacks] = useState<MethodPackSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listPacks();
        setPacks(res);
        setStatus('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się wczytać listy packów.');
        setStatus('error');
      }
    })();
  }, []);

  return (
    <section className="rounded-xl border border-c-border bg-c-surface p-4" data-testid="drd-e2e-library">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-c-text">Library — Method Packs</h2>
        <DrdSourceIndicator source="SERVER" title="GET /api/method/packs — realny serwer." />
      </div>
      <StandardTable
        columns={PACK_COLUMNS}
        data={packs.map((p) => ({ id: p.id, name: p.name, packId: p.packId, version: p.version, readiness: p.readiness }))}
        loading={status === 'loading'}
        error={status === 'error' ? error : null}
        empty={{ title: 'Brak packów', description: 'Żaden Method Pack nie jest zarejestrowany dla tej organizacji.' }}
        density="compact"
      />
    </section>
  );
};

const SessionView: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [session, setSession] = useState<MethodSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getSession(sessionId);
        setSession(res.session);
        setStatus('ready');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się wczytać sesji.');
        setStatus('error');
      }
    })();
  }, [sessionId]);

  return (
    <section className="rounded-xl border border-c-border bg-c-surface p-4" data-testid="drd-e2e-session">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-c-text">Sesja</h2>
        <DrdSourceIndicator source="SERVER" title="GET /api/method/sessions/:id — realny serwer." />
      </div>
      {status === 'loading' ? <p className="text-xs text-c-text-muted">Wczytywanie…</p> : null}
      {status === 'error' ? <p className="text-xs text-c-danger">{error}</p> : null}
      {status === 'ready' && session ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" data-testid="drd-e2e-session-detail">
          <dt className="text-c-text-muted">ID</dt>
          <dd className="font-mono text-c-text" data-testid="drd-e2e-session-id">{session.id}</dd>
          <dt className="text-c-text-muted">Stan</dt>
          <dd className="text-c-text" data-testid="drd-e2e-session-state">{session.state}</dd>
          <dt className="text-c-text-muted">Wersja</dt>
          <dd className="text-c-text" data-testid="drd-e2e-session-version">{session.version}</dd>
          <dt className="text-c-text-muted">Pack</dt>
          <dd className="text-c-text">{session.methodPackId}@{session.methodPackVersion}</dd>
          <dt className="text-c-text-muted">Rewizja</dt>
          <dd className="text-c-text">{session.revisionOfSessionId ?? '—'}</dd>
        </dl>
      ) : null}
    </section>
  );
};

export const DrdArtifactsHarnessScreen: React.FC<DrdArtifactsHarnessScreenProps> = ({
  view,
  sessionId,
  currentUserId,
}) => {
  return (
    <div className="min-h-screen bg-c-bg p-6" data-testid="drd-e2e-harness" data-view={view}>
      <div className="mx-auto max-w-4xl space-y-6">
        {view === 'library' ? <LibraryView /> : null}
        {view === 'session' && sessionId ? <SessionView sessionId={sessionId} /> : null}
        {view === 'roles' && sessionId ? <DrdRolesPanel sessionId={sessionId} currentUserId={currentUserId} /> : null}
        {(view === 'artifacts' || view === 'lineage') && sessionId ? (
          <DrdArtifactsPanel sessionId={sessionId} />
        ) : null}
      </div>
    </div>
  );
};

export default DrdArtifactsHarnessScreen;

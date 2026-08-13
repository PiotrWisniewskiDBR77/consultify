/**
 * DrdArtifactsPanel — S1 CEL 2: after a browser restart, the user must be
 * able to FIND and OPEN every artefact already produced against a DRD
 * session — the WHOLE reopen lineage, not just whatever the CURRENT session
 * happens to hold in memory/localStorage (2026-08-13).
 *
 * ★ Structural guarantee, not a convention: this component takes ONLY a
 * `sessionId` prop. There is no `currentOutput`/`currentSessionSnapshot`/
 * `liveAnswers` prop it could fall back to — every Output/Report/
 * Presentation/Initiative Draft rendered here comes from exactly ONE call,
 * `getSessionLineage` (src/method-core/api/methodCoreApi.ts ->
 * `GET /api/method/sessions/:id/lineage`, server/src/routes/method-core.routes.ts),
 * which is itself backed only by `method_outputs` / `method_report_snapshots`
 * / `method_initiative_drafts` rows in Postgres. This component never reads
 * `localStorage`, never imports the DRD session-runtime
 * (`drdSessionRuntime`/`drdHttpSessionRuntime`), and never computes a
 * finding/output from whatever answers happen to be on screen right now —
 * see `__tests__/DrdArtifactsPanel.test.tsx` ("does not reconstruct from
 * local/session state").
 *
 * ★ `RECOVERY_DRAFT` (`DrdSourceIndicator`) is reserved for an UNSAVED local
 * draft (see that component's own header comment). This panel never shows
 * it — everything rendered here already has a server-issued id, so every
 * section carries the `SERVER` badge instead.
 *
 * States: `loading` -> `error` (explicit retry, never a silent blank) |
 * `empty` (explicit "nothing frozen yet" message, never a blank panel) |
 * `ready` (four `StandardTable` sections + a lineage list). Per
 * CLAUDE.md's Triada rule, list content uses ONLY the `StandardTable`
 * facade — this file never hand-rolls a raw table element of its own.
 */
import { FileStack, FileText, GitBranch, Layers, Presentation } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { EmptyState } from '@/components/shared/states/EmptyState';
import { ErrorState } from '@/components/shared/states/ErrorState';
import { LoadingState } from '@/components/shared/states/LoadingState';
import { StandardTable, type TableColumn, type TableRow } from '@/components/standard/StandardTable';
import {
  getSessionLineage,
  MethodCoreApiError,
  type MethodSessionLineage,
} from '@/method-core/api/methodCoreApi';

import { DrdSourceIndicator } from './DrdSourceIndicator';

export interface DrdArtifactsPanelProps {
  /** The session id to open the recovery/lineage view for. ANY session id
   * in a reopen chain works — the server walks the whole lineage, not just
   * this one session's own rows. */
  readonly sessionId: string;
  readonly className?: string;
}

type PanelState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly lineage: MethodSessionLineage };

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pl-PL');
}

const OUTPUT_COLUMNS: TableColumn[] = [
  { id: 'version', label: 'Wersja' },
  { id: 'status', label: 'Status' },
  { id: 'scope', label: 'Zakres' },
  { id: 'frozenAt', label: 'Zamrożony' },
  { id: 'sessionId', label: 'Sesja' },
];

const ARTEFACT_COLUMNS: TableColumn[] = [
  { id: 'title', label: 'Tytuł' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Utworzono' },
];

const DRAFT_COLUMNS: TableColumn[] = [
  { id: 'title', label: 'Tytuł' },
  { id: 'confidence', label: 'Pewność' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Utworzono' },
];

export const DrdArtifactsPanel: React.FC<DrdArtifactsPanelProps> = ({ sessionId, className }) => {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const lineage = await getSessionLineage(sessionId);
      setState({ kind: 'ready', lineage });
    } catch (err) {
      const message =
        err instanceof MethodCoreApiError
          ? err.isNetworkError
            ? 'Brak połączenia z serwerem — artefakty są zapisane po stronie serwera, spróbuj ponownie.'
            : `Serwer odmówił odczytu artefaktów (HTTP ${err.status}).`
          : 'Nie udało się wczytać artefaktów sesji.';
      setState({ kind: 'error', message });
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <div className={className} data-testid="drd-artifacts-panel-loading">
        <LoadingState template="list" rows={4} label="Wczytywanie artefaktów sesji…" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className={className} data-testid="drd-artifacts-panel-error">
        <ErrorState title="Nie udało się wczytać artefaktów" description={state.message} onRetry={load} />
      </div>
    );
  }

  const { lineage } = state;
  const totalArtefacts =
    lineage.outputs.length +
    lineage.reports.length +
    lineage.presentations.length +
    lineage.initiativeDrafts.length;

  if (totalArtefacts === 0) {
    return (
      <div className={className} data-testid="drd-artifacts-panel-empty">
        <EmptyState
          variant="new"
          title="Ta sesja nie ma jeszcze żadnych zatwierdzonych artefaktów"
          description="Output/Report/Presentation/Initiative Draft pojawią się tu dopiero po zamrożeniu (freeze) sesji przez approvera."
        />
      </div>
    );
  }

  const outputRows: TableRow[] = lineage.outputs.map((o) => ({
    id: o.id,
    version: `v${o.outputVersion}`,
    status: o.status,
    scope: o.scope,
    frozenAt: formatDate(o.frozenAt),
    sessionId: o.sessionId,
  }));

  const reportRows: TableRow[] = lineage.reports.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: formatDate(r.createdAt),
  }));

  const presentationRows: TableRow[] = lineage.presentations.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    createdAt: formatDate(p.createdAt),
  }));

  const draftRows: TableRow[] = lineage.initiativeDrafts.map((d) => ({
    id: d.id,
    title: d.title,
    confidence: d.confidence,
    status: d.status,
    createdAt: formatDate(d.createdAt),
  }));

  return (
    <div className={className} data-testid="drd-artifacts-panel-ready">
      <section data-testid="drd-artifacts-outputs" aria-label="Outputy">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-c-text">
            <Layers className="h-4 w-4" aria-hidden="true" /> Outputy ({lineage.outputs.length})
          </h3>
          <DrdSourceIndicator source="SERVER" title="Zatwierdzony snapshot z bazy — nigdy z bieżącej sesji." />
        </header>
        <StandardTable columns={OUTPUT_COLUMNS} data={outputRows} emptyMessage="Brak Outputów w tej linii rewizji." />
      </section>

      <section data-testid="drd-artifacts-reports" aria-label="Reporty" className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-c-text">
          <FileText className="h-4 w-4" aria-hidden="true" /> Reporty ({lineage.reports.length})
        </h3>
        <StandardTable columns={ARTEFACT_COLUMNS} data={reportRows} emptyMessage="Brak Reportów w tej linii rewizji." />
      </section>

      <section data-testid="drd-artifacts-presentations" aria-label="Prezentacje" className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-c-text">
          <Presentation className="h-4 w-4" aria-hidden="true" /> Prezentacje ({lineage.presentations.length})
        </h3>
        <StandardTable
          columns={ARTEFACT_COLUMNS}
          data={presentationRows}
          emptyMessage="Brak Prezentacji w tej linii rewizji."
        />
      </section>

      <section data-testid="drd-artifacts-drafts" aria-label="Draft inicjatyw" className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-c-text">
          <FileStack className="h-4 w-4" aria-hidden="true" /> Initiative Drafts ({lineage.initiativeDrafts.length})
        </h3>
        <StandardTable columns={DRAFT_COLUMNS} data={draftRows} emptyMessage="Brak draftów inicjatyw." />
      </section>

      <section data-testid="drd-artifacts-lineage" aria-label="Linia rewizji" className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-c-text">
          <GitBranch className="h-4 w-4" aria-hidden="true" /> Linia rewizji ({lineage.sessions.length}{' '}
          {lineage.sessions.length === 1 ? 'sesja' : 'sesje'})
        </h3>
        <ol className="space-y-1 border-l border-c-border pl-4">
          {lineage.sessions.map((s) => (
            <li
              key={s.id}
              data-testid="drd-lineage-session"
              data-session-id={s.id}
              className="text-sm text-c-text-muted"
            >
              <span className="font-mono text-xs text-c-text">
                {s.id === sessionId ? '→ ' : ''}
                {s.id.slice(0, 8)}
              </span>
              {' — '}
              <span>{s.state}</span>
              {s.revisionOfSessionId ? (
                <span className="ml-1 text-xs text-c-text-muted">(korekta {s.revisionOfSessionId.slice(0, 8)})</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

export default DrdArtifactsPanel;

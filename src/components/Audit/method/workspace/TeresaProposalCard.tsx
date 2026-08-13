/**
 * TeresaProposalCard — Teresa dla Criterion Workspace: Intent → Preview →
 * Confirmation (człowiek) → Commit → Settle.
 *
 * Kontrakt (mandat W1, `CLAUDE.md` #Teresa): pokazuje INTENCJĘ, PODGLĄD
 * zmiany (przed/po, pole po polu), uzasadnienie, pewność i źródła. Człowiek
 * akceptuje albo odrzuca (`decide`) — DOPIERO wtedy `commit` staje się
 * dostępny jako OSOBNY, drugi krok. Propozycja bez źródeł (`sources.length
 * === 0`) nigdy nie ma aktywnego „Zastosuj" — sprawdzane tu niezależnie od
 * tego, że serwer (`aiProposalService.assertHasSources`) już odrzuca taką
 * propozycję przy tworzeniu; to jest obrona w głąb po stronie UI, nie
 * zaufanie do jednego miejsca.
 *
 * Teresa NIGDY nie ma tu przycisku, który sam z siebie wydaje formalne
 * ustalenie/wniosek/zamknięcie — ten komponent tylko: (1) tworzy roboczą
 * propozycję, (2) czeka na jawną decyzję człowieka, (3) wykonuje `commit` W
 * KONTEKŚCIE UPRAWNIEŃ TEGO CZŁOWIEKA (server-side `requireCapability` +
 * `assertAiMayCommit` — patrz `aiProposalService.ts`). `canCommit` tutaj jest
 * tylko UI-podpowiedzią (żeby nie pokazywać martwego przycisku); serwer
 * bramkuje ponownie.
 */
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { PreviewActionButton } from '@/components/shared/PreviewPane/PreviewActionButton';

import type { AiIntent, AiTargetType, WorkspaceAiProposal } from './workspaceApi';
import * as workspaceApi from './workspaceApi';

export interface TeresaProposalCardProps {
  /** Etykieta widoczna nad kartą, np. „Teresa: wyjaśnienie kryterium". */
  label: string;
  programId: string;
  targetType: AiTargetType;
  targetId: string | null;
  intent: AiIntent;
  context?: Record<string, unknown>;
  /** `ai.propose` — czy TEN człowiek może w ogóle zapytać Teresę w tym programie. */
  canPropose: boolean;
  /** `ai.commit` — czy TEN człowiek może wykonać (zastosować) propozycję. */
  canCommit: boolean;
  isPolish: boolean;
  /** Wywołane po udanym `commit` — nadrzędny ekran odświeża dane. */
  onCommitted?: () => void;
  className?: string;
}

type CardPhase = 'idle' | 'asking' | 'pending' | 'deciding' | 'committing' | 'error';

function renderPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((v) => renderPreviewValue(v)).join('; ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('title' in obj || 'content' in obj) {
      return String(obj.title ?? obj.content ?? JSON.stringify(obj));
    }
    return JSON.stringify(obj);
  }
  return String(value);
}

interface PreviewFieldRow {
  key: string;
  before: unknown;
  after: unknown;
}

function extractPreviewRows(preview: Record<string, unknown>): PreviewFieldRow[] {
  const rows: PreviewFieldRow[] = [];
  if ('before' in preview || 'after' in preview) {
    rows.push({ key: String(preview.field ?? 'value'), before: preview.before, after: preview.after });
  }
  const additional = preview.additionalFields as Record<string, { before: unknown; after: unknown }> | undefined;
  if (additional && typeof additional === 'object') {
    for (const [key, val] of Object.entries(additional)) {
      rows.push({ key, before: val?.before, after: val?.after });
    }
  }
  if (rows.length === 0) {
    // Propozycje analityczne (np. luki dowodowe) nie mają before/after — pokaż
    // surowy JSON jako jedną sekcję zamiast pustej karty.
    rows.push({ key: 'preview', before: null, after: preview });
  }
  return rows;
}

export const TeresaProposalCard: React.FC<TeresaProposalCardProps> = ({
  label,
  programId,
  targetType,
  targetId,
  intent,
  context,
  canPropose,
  canCommit,
  isPolish,
  onCommitted,
  className = '',
}) => {
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [proposal, setProposal] = useState<WorkspaceAiProposal | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const t = useCallback(
    (pl: string, en: string) => (isPolish ? pl : en),
    [isPolish]
  );

  const handleAsk = useCallback(async () => {
    setPhase('asking');
    setErrorMessage(null);
    try {
      const created = await workspaceApi.createIntent({
        programId,
        targetType,
        targetId: targetId ?? null,
        intent,
        context: context ?? {},
      });
      setProposal(created);
      setPhase('pending');
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : t('Nie udało się uzyskać propozycji Teresy', 'Could not get a proposal from Teresa'));
      setPhase('error');
    }
  }, [programId, targetType, targetId, intent, context, t]);

  const handleDecide = useCallback(
    async (decision: 'accept' | 'reject') => {
      if (!proposal) return;
      setPhase('deciding');
      setErrorMessage(null);
      try {
        const decided = await workspaceApi.decideProposal(proposal.id, { decision });
        setProposal(decided);
        setPhase('pending');
      } catch (e: unknown) {
        setErrorMessage(e instanceof Error ? e.message : t('Nie udało się zapisać decyzji', 'Could not save the decision'));
        setPhase('error');
      }
    },
    [proposal, t]
  );

  const handleCommit = useCallback(async () => {
    if (!proposal) return;
    setPhase('committing');
    setErrorMessage(null);
    try {
      const committed = await workspaceApi.commitProposal(proposal.id);
      setProposal(committed);
      setPhase('pending');
      onCommitted?.();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : t('Nie udało się wykonać propozycji', 'Could not apply the proposal'));
      setPhase('error');
    }
  }, [proposal, onCommitted, t]);

  const handleReset = useCallback(() => {
    setProposal(null);
    setErrorMessage(null);
    setPhase('idle');
  }, []);

  const busy = phase === 'asking' || phase === 'deciding' || phase === 'committing';
  const hasSources = !!proposal && Array.isArray(proposal.sources) && proposal.sources.length > 0;

  return (
    <div
      data-testid="teresa-proposal-card"
      data-intent={intent}
      className={`rounded-token-lg border border-c-border-subtle bg-c-surface-raised/40 p-4 ${className}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={15} className="text-c-text-muted" aria-hidden />
        <span className="text-sm font-semibold text-c-text">{label}</span>
      </div>

      {!canPropose && (
        <p className="text-xs text-c-text-muted">
          {t(
            'Zapytanie Teresy wymaga uprawnienia do rozmowy z Teresą w tym programie.',
            'Asking Teresa requires the ai.propose permission in this program.'
          )}
        </p>
      )}

      {canPropose && !proposal && phase !== 'asking' && (
        <PreviewActionButton
          variant="neutral"
          label={t('Zapytaj Teresę', 'Ask Teresa')}
          icon={Sparkles}
          onClick={handleAsk}
          disabled={busy}
        />
      )}

      {phase === 'asking' && (
        <div className="flex items-center gap-2 text-xs text-c-text-muted" role="status" aria-live="polite">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          {t('Teresa przygotowuje propozycję…', 'Teresa is preparing a proposal…')}
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-c-danger">
            {errorMessage}
          </p>
          <PreviewActionButton
            variant="neutral"
            label={t('Spróbuj ponownie', 'Try again')}
            onClick={proposal ? handleCommit : handleAsk}
          />
        </div>
      )}

      {proposal && phase !== 'error' && (
        <div className="mt-3 space-y-3">
          <div className="rounded-token-md border border-c-border-subtle bg-c-surface p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('Podgląd zmiany (przed / po)', 'Change preview (before / after)')}
            </p>
            <div className="space-y-2">
              {extractPreviewRows(proposal.preview).map((row) => (
                <div key={row.key} data-testid={`teresa-preview-row-${row.key}`} className="text-xs">
                  <div className="font-medium text-c-text">{row.key}</div>
                  <div className="mt-0.5 grid grid-cols-2 gap-2">
                    <div className="rounded-token-sm bg-c-danger/5 p-1.5 text-c-text-muted line-through decoration-c-text-muted/40">
                      {renderPreviewValue(row.before)}
                    </div>
                    <div className="rounded-token-sm bg-c-success/10 p-1.5 text-c-text">
                      {renderPreviewValue(row.after)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {proposal.rationale && (
            <p className="text-xs text-c-text-muted">
              <span className="font-medium text-c-text">{t('Uzasadnienie: ', 'Rationale: ')}</span>
              {proposal.rationale}
            </p>
          )}

          <p className="text-xs text-c-text-muted">
            {t('Pewność', 'Confidence')}: {proposal.confidence !== null ? `${Math.round(proposal.confidence * 100)}%` : '—'}
          </p>

          <div data-testid="teresa-sources" className="text-xs text-c-text-muted">
            <span className="font-medium text-c-text">{t('Źródła: ', 'Sources: ')}</span>
            {hasSources ? (
              <ul className="mt-1 list-disc pl-4">
                {proposal.sources.map((s, i) => (
                  <li key={i}>{String((s as Record<string, unknown>).excerpt ?? (s as Record<string, unknown>).id ?? '—')}</li>
                ))}
              </ul>
            ) : (
              <span className="text-c-danger">
                {t('Brak źródeł — propozycja nie może zostać zastosowana.', 'No sources — the proposal cannot be applied.')}
              </span>
            )}
          </div>

          {proposal.status === 'pending' && (
            <div className="flex flex-wrap gap-2">
              <PreviewActionButton
                variant="positive"
                label={t('Akceptuj', 'Accept')}
                icon={Check}
                onClick={() => handleDecide('accept')}
                disabled={busy}
              />
              <PreviewActionButton
                variant="destructive"
                label={t('Odrzuć', 'Reject')}
                icon={X}
                onClick={() => handleDecide('reject')}
                disabled={busy}
              />
            </div>
          )}

          {proposal.status === 'accepted' && !proposal.committedAt && (
            <div className="space-y-1.5">
              {!canCommit && (
                <p className="text-xs text-c-text-muted">
                  {t(
                    'Wykonanie (zastosowanie) propozycji wymaga uprawnienia ai.commit w tym programie.',
                    'Applying the proposal requires the ai.commit permission in this program.'
                  )}
                </p>
              )}
              <PreviewActionButton
                variant="positive"
                label={t('Zastosuj', 'Apply')}
                icon={Check}
                onClick={handleCommit}
                disabled={!canCommit || !hasSources || busy}
              />
              {!hasSources && (
                <p className="text-xs text-c-danger">
                  {t(
                    'Propozycja bez źródeł nie może zostać zastosowana.',
                    'A proposal without sources cannot be applied.'
                  )}
                </p>
              )}
            </div>
          )}

          {proposal.status === 'rejected' && (
            <p className="text-xs text-c-text-muted">{t('Propozycja odrzucona.', 'Proposal rejected.')}</p>
          )}

          {proposal.committedAt && (
            <p className="text-xs font-medium text-c-success">
              {t('Zastosowano.', 'Applied.')}
            </p>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] text-c-text-muted underline decoration-dotted hover:text-c-text"
          >
            {t('Nowe zapytanie', 'New question')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TeresaProposalCard;

/**
 * Deliverables — lekki runtime: ŻYWY ARTEFAKT DECKA w split-view (L1, krok 4)
 *
 * Prawy panel Kimi-style dla startera 'presentation': read-mostly renderer
 * kart decka (reuse CardRenderer z DeckBuilder), NIE ciężki edytor.
 * Pełna edycja = "Otwórz w Deck Builder". Podczas generacji panel sam
 * poluje wiersz decka aż status przejdzie generating → ready|failed.
 *
 * docs/plans/DELIVERABLES_LIGHT_TARGET.md §3 (Artifact Workspace) + §10.2 pkt 4.
 */

import { ExternalLink, Loader2, Presentation, RefreshCw, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  deckFromUnifiedJson,
  safeJsonParse,
} from '@/components/Presentations/DeckBuilder/deckData';
import type { Deck } from '@/components/Presentations/wizard/types';
import { Api } from '@/services/api';

const CardRenderer = React.lazy(() =>
  import('@/components/Presentations/DeckBuilder/CardRenderer').then((m) => ({
    default: m.CardRenderer,
  }))
);

const GENERATING_POLL_MS = 2500;

type DeckLoadPhase = 'loading' | 'generating' | 'ready' | 'failed' | 'empty';

interface CanvasPresentationViewProps {
  deckId?: string | null;
  onClose?: () => void;
}

function deckFromRow(deckId: string, row: any): Deck | null {
  const status = (String(row?.status || 'draft').toLowerCase() as Deck['status']) || 'draft';
  const title = row?.title ? String(row.title) : undefined;
  const deckJson = safeJsonParse<any>(row?.deck_json, null);
  if (deckJson && typeof deckJson === 'object' && Array.isArray(deckJson.cards)) {
    return {
      ...deckJson,
      deck_id: deckId,
      title: title || deckJson.title || 'Untitled',
      status,
    };
  }
  return deckFromUnifiedJson({
    deckId,
    title,
    unifiedJson: row?.unified_json,
    status,
  });
}

export function CanvasPresentationView({ deckId, onClose }: CanvasPresentationViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = React.useState<DeckLoadPhase>(deckId ? 'loading' : 'empty');
  const [deck, setDeck] = React.useState<Deck | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  React.useEffect(() => {
    if (!deckId) {
      setPhase('empty');
      setDeck(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = (await Api.get(`/presentations/decks/${deckId}`)) as any;
        const payload = res?.data;
        const row =
          payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
        if (cancelled) return;

        const status = String(row?.status || '').toLowerCase();
        if (status === 'failed') {
          setPhase('failed');
          setError(null);
          return;
        }
        const loaded = deckFromRow(deckId, row);
        if (loaded && loaded.cards.length > 0) {
          setDeck(loaded);
          setPhase('ready');
          setError(null);
          return;
        }
        // Wiersz istnieje, ale nie ma jeszcze kart — generacja w toku (poll).
        setPhase('generating');
        timer = setTimeout(load, GENERATING_POLL_MS);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Load failed');
        setPhase('failed');
      }
    };

    setPhase('loading');
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deckId, reloadNonce]);

  const openInBuilder = () => {
    if (deckId) navigate(`/presentations/builder/${deckId}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Presentation className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {deck?.title || t('canvas.presentation.title', 'Prezentacja')}
          </span>
          {phase === 'generating' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('canvas.presentation.generating', 'Generuję…')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {deckId && phase === 'ready' && (
            <button
              type="button"
              onClick={openInBuilder}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('canvas.presentation.openInBuilder', 'Otwórz w Deck Builder')}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Zamknij')}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {phase === 'empty' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Presentation className="h-8 w-8 opacity-40" />
            <p>
              {t(
                'canvas.presentation.empty',
                'Brak prezentacji. Poproś Teresę: „zrób z tego prezentację”.'
              )}
            </p>
          </div>
        )}

        {(phase === 'loading' || phase === 'generating') && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p>
              {phase === 'generating'
                ? t(
                    'canvas.presentation.generatingBody',
                    'Teresa generuje slajdy — pojawią się tutaj automatycznie.'
                  )
                : t('canvas.presentation.loading', 'Wczytuję prezentację…')}
            </p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm">
            <p className="text-destructive">
              {error || t('canvas.presentation.failed', 'Generacja prezentacji nie powiodła się.')}
            </p>
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('common.retry', 'Spróbuj ponownie')}
            </button>
          </div>
        )}

        {phase === 'ready' && deck && (
          <React.Suspense
            fallback={
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {deck.cards.map((card, index) => (
                <div
                  key={card.card_id || index}
                  className="overflow-hidden rounded-lg border border-border shadow-sm"
                >
                  <CardRenderer card={card} colorSetId={deck.color_set_id} scale={1} />
                </div>
              ))}
            </div>
          </React.Suspense>
        )}
      </div>
    </div>
  );
}

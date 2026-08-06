import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { CardRenderer } from './DeckBuilder/CardRenderer';
import { deckFromUnifiedJson } from './DeckBuilder/deckData';
import type { Deck } from './wizard/types';

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export const SharedPresentationView: React.FC = () => {
  const { t } = useTranslation();
  const { shareToken } = useParams<{ shareToken: string }>();
  const location = useLocation();
  const isEmbed = location.pathname.includes('/presentations/embed/');
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!shareToken) {
        setError('Missing share token');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/presentations/shared/${encodeURIComponent(shareToken)}`);
        const payload = await response.json();
        if (!response.ok || !payload?.success || !payload?.data) {
          throw new Error(payload?.error || 'Failed to load shared presentation');
        }

        const row = payload.data;
        // New share payloads expose the already-normalized canonical deck as
        // `deck`. `deck_json` remains a compatibility fallback for links
        // minted before that contract was introduced.
        const deckJson = safeJsonParse<Deck | null>(row.deck ?? row.deck_json, null);
        const loadedDeck =
          deckJson && Array.isArray(deckJson.cards)
            ? {
                ...deckJson,
                deck_id: String(row.id || deckJson.deck_id || shareToken),
                title: String(row.title || deckJson.title || 'Untitled'),
                status: 'shared' as const,
                updated_at: String(
                  row.updated_at || deckJson.updated_at || new Date().toISOString()
                ),
              }
            : deckFromUnifiedJson({
                deckId: String(row.id || shareToken),
                title: String(row.title || 'Untitled'),
                unifiedJson: row.unified_json,
                orgId: row.organization_id,
                createdBy: row.generated_by || row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                status: 'shared',
              });

        if (!loadedDeck) {
          throw new Error('Presentation has no renderable deck data');
        }

        if (!cancelled) {
          setDeck(loadedDeck);
          setActiveIndex(0);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(String(err?.message || 'Failed to load shared presentation'));
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const cards = deck?.cards || [];
  const currentCard = cards[activeIndex];

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < cards.length - 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && canGoPrev) setActiveIndex((prev) => prev - 1);
      if ((event.key === 'ArrowRight' || event.key === ' ') && canGoNext) {
        event.preventDefault();
        setActiveIndex((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canGoNext, canGoPrev]);

  const shellClassName = useMemo(
    () => (isEmbed ? 'min-h-screen bg-transparent' : 'min-h-screen bg-slate-950 text-white'),
    [isEmbed]
  );

  if (loading) {
    return (
      <div className={`${shellClassName} flex items-center justify-center`}>
        <div className="text-sm text-slate-600">
          {t('presentations.shared.loading', 'Loading shared presentation...')}
        </div>
      </div>
    );
  }

  if (!deck || !currentCard) {
    return (
      <div className={`${shellClassName} flex items-center justify-center px-6`}>
        <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center">
          <h1 className="text-lg font-semibold text-white">
            {t('presentations.shared.unavailableTitle', 'Presentation unavailable')}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ||
              t('presentations.shared.unavailableBody', 'The shared link is invalid or expired.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      {!isEmbed && (
        <div className="border-b border-slate-800 bg-slate-950/90 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                {t('presentations.shared.badge', 'Shared presentation')}
              </div>
              <h1 className="mt-1 text-lg font-semibold text-white">{deck.title}</h1>
            </div>
            <div className="text-sm text-slate-600">
              {activeIndex + 1} / {cards.length}
            </div>
          </div>
        </div>
      )}

      <div className={`${isEmbed ? 'p-3' : 'mx-auto max-w-6xl px-6 py-8'}`}>
        <div className="mx-auto max-w-5xl">
          <CardRenderer card={currentCard} colorSetId={deck.color_set_id} />
        </div>

        {cards.length > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={() => canGoPrev && setActiveIndex((prev) => prev - 1)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              {t('common.previous', 'Previous')}
            </button>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => canGoNext && setActiveIndex((prev) => prev + 1)}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('common.next', 'Next')}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedPresentationView;

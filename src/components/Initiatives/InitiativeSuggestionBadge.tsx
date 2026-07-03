/**
 * InitiativeSuggestionBadge — F2 SKRZYNKA KANDYDATÓW (D5/D8): badge kontekstowy
 * „AI sugeruje inicjatywę →" przy artefaktach rozpoznania (insight / assessment / audyt).
 *
 * Cel: gdy AI wygenerował kandydata inicjatywy z TEGO artefaktu (i czeka on jako
 * `pending` w skrzynce), pokaż przy artefakcie dyskretny przycisk, który pozwala
 * jednym kliknięciem zaakceptować propozycję (→ generator F1) bez wchodzenia w hub.
 *
 * Zachowanie:
 *   - czyta pending-kandydatów (GET /api/initiatives/candidates?status=pending),
 *   - renderuje się TYLKO gdy któryś kandydat pasuje do (sourceType, sourceId),
 *   - klik → jeśli `onCreate` podany → woła go z kandydatem (host decyduje co dalej,
 *     np. otwiera generator F1); w przeciwnym razie → POST /candidates/:id/accept
 *     i znika po sukcesie.
 *
 * Samowystarczalny: reużywa API_URL/getHeaders z baseClient (zero edycji współdzielonych
 * API), i18n PL/EN przez t() z fallbackami PL, dark-mode-aware (klasy dark:). Fail-soft —
 * błąd fetcha = badge ukryty (nie psuje widoku-hosta).
 */
import { Loader2, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api/baseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Typ artefaktu rozpoznania, do którego przypięty jest badge. */
export type SuggestionSourceType = 'interview_insight' | 'assessment' | 'audit' | string;

export interface InitiativeCandidateLite {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  rationale: string;
  fitScore: number;
  status: string;
}

export interface InitiativeSuggestionBadgeProps {
  /** Typ artefaktu-źródła (np. 'audit'). */
  sourceType: SuggestionSourceType;
  /** Id artefaktu-źródła. */
  sourceId: string;
  /**
   * Opcjonalny handler kliknięcia. Gdy podany — wołany z dopasowanym kandydatem
   * ZAMIAST domyślnego POST accept (host przejmuje akcję, np. otwiera generator F1).
   * Może być async; badge pokazuje stan zajętości na czas jego trwania.
   */
  onCreate?: (candidate: InitiativeCandidateLite) => void | Promise<void>;
  /** Dodatkowe klasy kontenera (host layout). */
  className?: string;
}

const CANDIDATES_BASE = `${API_URL}/initiatives/candidates`;

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InitiativeSuggestionBadge({
  sourceType,
  sourceId,
  onCreate,
  className,
}: InitiativeSuggestionBadgeProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [candidate, setCandidate] = useState<InitiativeCandidateLite | null>(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Pobierz pending-kandydatów i znajdź dopasowanie do tego artefaktu.
  useEffect(() => {
    let cancelled = false;
    if (!sourceType || !sourceId) {
      setCandidate(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${CANDIDATES_BASE}?status=pending`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await readJson(res);
        const list: InitiativeCandidateLite[] = Array.isArray(data?.candidates)
          ? data.candidates
          : [];
        const match =
          list.find(
            (c) =>
              String(c.sourceType) === String(sourceType) &&
              c.sourceId != null &&
              String(c.sourceId) === String(sourceId)
          ) ?? null;
        if (!cancelled && mounted.current) setCandidate(match);
      } catch {
        // fail-soft — brak dopasowania = badge ukryty, host nietknięty
        if (!cancelled && mounted.current) setCandidate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceType, sourceId]);

  const handleClick = useCallback(async () => {
    if (!candidate || busy) return;
    setBusy(true);
    try {
      if (onCreate) {
        await onCreate(candidate);
        if (mounted.current) setAccepted(true);
        return;
      }
      const res = await fetch(
        `${CANDIDATES_BASE}/${encodeURIComponent(candidate.id)}/accept`,
        { method: 'POST', headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (mounted.current) setAccepted(true);
    } catch {
      // fail-soft — zostaw badge widoczny by można było spróbować ponownie
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [candidate, busy, onCreate]);

  // Brak dopasowanego kandydata lub już zaakceptowany → nic nie renderuj.
  if (!candidate || accepted) return null;

  const label = t('initiatives.suggestionBadge.label', 'AI sugeruje inicjatywę');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={t(
        'initiatives.suggestionBadge.aria',
        'Akceptuj sugerowaną inicjatywę z tego artefaktu'
      )}
      title={candidate.rationale || label}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-medium transition-colors',
        'border-indigo-200 bg-indigo-50 text-indigo-700',
        'hover:bg-indigo-100 hover:border-indigo-300',
        'dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
        'dark:hover:bg-indigo-500/20',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className || '',
      ].join(' ')}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" data-testid="suggestion-badge-spinner" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" data-testid="suggestion-badge-icon" />
      )}
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </button>
  );
}

export default InitiativeSuggestionBadge;

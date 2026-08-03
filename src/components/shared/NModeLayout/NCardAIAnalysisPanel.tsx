/**
 * NCardAIAnalysisPanel — PANEL WYNIKÓW „Analizuj z AI" (ETAP 3 standardu n-Type).
 *
 * Kontrakt właściciela (2026-07-23, dosłownie):
 *   „kliknięcie otwiera panel wyników → wynik podzielony na
 *    Braki · Ryzyka · Sugestie · Proponowane zmiany → każda zmiana ma akcje
 *    Zastosuj · Pokaż różnicę · Odrzuć → AI NIE nadpisuje treści bez potwierdzenia."
 *
 * ── CZTERY SZUFLADY, KOLEJNOŚĆ WIĄŻĄCA ──────────────────────────────────────
 * Panel NIE decyduje o podziale — dostaje `CardAnalysisResult` z czterema
 * gotowymi listami i renderuje je w kolejności z kontraktu. Pusta szuflada jest
 * pokazana z jawnym „brak", a nie schowana: brak braków to WYNIK, nie brak wyniku.
 *
 * ── ZAKAZ NADPISANIA (egzekwowany tu, nie tylko obiecany) ───────────────────
 * Panel nie ma dostępu do stanu karty. Jedyną drogą zapisu jest `onApplyChange`,
 * wywoływane WYŁĄCZNIE z handlera przycisku „Zastosuj". Nie ma efektu, timera
 * ani ścieżki auto-apply. Pozycja po zastosowaniu przechodzi w stan `applied`
 * i nie da się jej kliknąć ponownie; nieudany zapis daje `failed` z uczciwym
 * komunikatem, a nie fałszywy sukces.
 *
 * ── KOLOR ────────────────────────────────────────────────────────────────────
 * Akcent AI = FIOLET (`violet-*`, przemapowany w tailwind.config.js:434 na HBS
 * Purple) — spójnie z `Menu2AIButton`. Reszta wyłącznie tokenami `c-*`
 * (powierzchnie, obramowania, tekst, sygnały danger/warning/success). ZAKAZ
 * rodziny `primary` (KAŻDY numer = Harvard Crimson) i tokenu akcentu brandowego
 * w powłoce artefaktów — bezpiecznik: `scripts/check-artefakt.sh`,
 * `.claude/hooks/check-triada.sh`. Twarde palety (navy/slate/hex) = dług tokenów.
 * Fokus wyłącznie `c-focus`. Klasy przezroczystości spoza skali Tailwinda
 * zapisujemy w nawiasie kwadratowym (`/[0.14]`), bo `/14` nie istnieje.
 *
 * @see src/services/cardAnalysis — silnik (rubryka + wywołanie LLM)
 * @see src/components/shared/NModeLayout/NModeMenu2.tsx — przycisk otwierający
 */

import {
  AlertTriangle,
  Check,
  CircleAlert,
  Copy,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  SquarePen,
  Undo2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  CardAnalysisApply,
  CardAnalysisChange,
  CardAnalysisChangeState,
  CardAnalysisFinding,
  CardAnalysisResult,
  CardAnalysisSeverity,
} from '@/services/cardAnalysis';

// ── Etykiety dwujęzyczne bez wpisów w translation.json ──────────────────────
// Wzorzec 1:1 z NModeMenu2/NModeCardState: `t(klucz, 'English default')`
// renderowałby po polsku angielski default do czasu dopisania klucza.
const L = {
  title: { en: 'AI analysis', pl: 'Analiza AI' },
  subtitle: { en: 'active card', pl: 'aktywna karta' },
  close: { en: 'Close', pl: 'Zamknij' },
  rerun: { en: 'Run again', pl: 'Analizuj ponownie' },
  running: { en: 'Analyzing the card…', pl: 'Analizuję kartę…' },
  runningHint: {
    en: 'Assessing content against the card standard and the artifact-type criteria.',
    pl: 'Oceniam treść wobec standardu karty i kryteriów typu artefaktu.',
  },
  completeness: { en: 'Completeness', pl: 'Kompletność' },
  completenessNote: {
    en: 'AI score, not a system gate — nothing is blocked.',
    pl: 'Ocena AI, nie bramka systemowa — nic nie jest blokowane.',
  },
  gaps: { en: 'Gaps', pl: 'Braki' },
  risks: { en: 'Risks', pl: 'Ryzyka' },
  suggestions: { en: 'Suggestions', pl: 'Sugestie' },
  changes: { en: 'Proposed changes', pl: 'Proponowane zmiany' },
  none: { en: 'Nothing found', pl: 'Nic nie znaleziono' },
  apply: { en: 'Apply', pl: 'Zastosuj' },
  showDiff: { en: 'Show difference', pl: 'Pokaż różnicę' },
  hideDiff: { en: 'Hide difference', pl: 'Ukryj różnicę' },
  reject: { en: 'Reject', pl: 'Odrzuć' },
  applied: { en: 'Applied', pl: 'Zastosowano' },
  rejected: { en: 'Rejected', pl: 'Odrzucono' },
  failed: { en: 'Could not apply', pl: 'Nie udało się zastosować' },
  undo: { en: 'Restore to list', pl: 'Przywróć na listę' },
  before: { en: 'Now', pl: 'Teraz' },
  after: { en: 'After change', pl: 'Po zmianie' },
  empty: { en: '(empty)', pl: '(puste)' },
  modeAppend: { en: 'adds to the end', pl: 'dopisuje na końcu' },
  modeReplace: { en: 'replaces the content', pl: 'podmienia treść' },
  copy: { en: 'Copy the text', pl: 'Kopiuj treść' },
  copied: { en: 'Copied', pl: 'Skopiowano' },
  noTarget: {
    en: 'The card does not expose this field for writing — copy the text and paste it manually.',
    pl: 'Karta nie udostępnia tego pola do zapisu — skopiuj treść i wklej ręcznie.',
  },
  readMode: {
    en: 'Preview mode is on — switch to Edit to apply changes.',
    pl: 'Włączony tryb Podglądu — przełącz na Edycję, żeby stosować zmiany.',
  },
  criterion: { en: 'criterion', pl: 'kryterium' },
  errTitle: { en: 'Analysis failed', pl: 'Analiza nie powiodła się' },
  errParse: {
    en: 'The model did not return a readable result. Run the analysis again.',
    pl: 'Model nie zwrócił czytelnego wyniku. Uruchom analizę ponownie.',
  },
  errRequest: {
    en: 'The AI service did not respond.',
    pl: 'Usługa AI nie odpowiedziała.',
  },
  errBudget: {
    en: 'The AI budget for this organization is exhausted.',
    pl: 'Budżet AI tej organizacji jest wyczerpany.',
  },
} as const;

const pick = (pair: { en: string; pl: string }, isPolish: boolean) =>
  isPolish ? pair.pl : pair.en;

// ── Waga → kropka koloru. Sygnał krytyczny (`c-danger`) TYLKO dla „high". ────
const SEVERITY_DOT: Record<CardAnalysisSeverity, string> = {
  high: 'bg-c-danger',
  medium: 'bg-c-warning',
  low: 'bg-c-text-muted',
};

const CARD_SHELL = 'rounded-lg border border-c-border-subtle bg-c-surface p-3 transition-colors';

const ACTION_BTN =
  'inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

// ─────────────────────────────────────────────────────────────────────────────
// Sekcja znalezisk (Braki / Ryzyka / Sugestie)
// ─────────────────────────────────────────────────────────────────────────────

interface FindingSectionProps {
  icon: React.ReactNode;
  title: string;
  items: CardAnalysisFinding[];
  isPolish: boolean;
}

const FindingSection: React.FC<FindingSectionProps> = ({ icon, title, items, isPolish }) => (
  <section className="flex flex-col gap-2">
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
      <span className="shrink-0">{icon}</span>
      {title}
      <span className="ml-auto font-normal tabular-nums">{items.length}</span>
    </h3>

    {items.length === 0 ? (
      <p className="px-1 text-xs text-c-text-muted">{pick(L.none, isPolish)}</p>
    ) : (
      <ul className="flex flex-col gap-1.5">
        {items.map((f) => (
          <li key={f.id} className={CARD_SHELL}>
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[f.severity]}`}
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-c-text">{f.title}</p>
                {f.detail && f.detail !== f.title && (
                  <p className="mt-1 text-[11px] leading-relaxed text-c-text-secondary">
                    {f.detail}
                  </p>
                )}
                {f.criterionId && (
                  <p className="mt-1.5 text-[10px] text-c-text-muted">
                    {pick(L.criterion, isPolish)}: <code>{f.criterionId}</code>
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// Pozycja „Proponowana zmiana" — Zastosuj · Pokaż różnicę · Odrzuć
// ─────────────────────────────────────────────────────────────────────────────

interface ChangeRowProps {
  change: CardAnalysisChange;
  state: CardAnalysisChangeState;
  /** Pole realnie zapisywalne przez kartę (z deklaracji `CardAnalysisField`). */
  writable: boolean;
  /** Tryb Podglądu blokuje zapis w całej karcie. */
  readMode: boolean;
  busy: boolean;
  isPolish: boolean;
  onApply: () => void;
  onReject: () => void;
  onRestore: () => void;
  failure?: string;
}

const ChangeRow: React.FC<ChangeRowProps> = ({
  change,
  state,
  writable,
  readMode,
  busy,
  isPolish,
  onApply,
  onReject,
  onRestore,
  failure,
}) => {
  const [diffOpen, setDiffOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const afterValue = useMemo(() => {
    if (change.mode === 'replace') return change.proposedValue;
    const cur = change.currentValue.trim();
    return cur
      ? `${change.currentValue.replace(/\s+$/, '')}\n${change.proposedValue}`
      : change.proposedValue;
  }, [change]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(change.proposedValue)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        /* schowek niedostępny — przycisk nic nie zrobi, bez fałszywego „skopiowano" */
      });
  }, [change.proposedValue]);

  const settled = state === 'applied' || state === 'rejected';

  // Powód, dla którego „Zastosuj" jest wyłączone. Pokazujemy go WPROST —
  // wyłączony przycisk bez wyjaśnienia to najgorszy wariant.
  const blockReason = !writable
    ? pick(L.noTarget, isPolish)
    : readMode
      ? pick(L.readMode, isPolish)
      : '';

  return (
    <li
      className={`${CARD_SHELL} ${
        state === 'applied'
          ? 'border-c-success/50 bg-c-success/[0.06]'
          : state === 'rejected'
            ? 'opacity-55'
            : state === 'failed'
              ? 'border-c-danger/50'
              : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[change.severity]}`}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium text-c-text">
            {change.fieldLabel}
            <span className="text-[10px] font-normal text-c-text-muted">
              · {pick(change.mode === 'append' ? L.modeAppend : L.modeReplace, isPolish)}
            </span>
          </p>

          {change.rationale && (
            <p className="mt-1 text-[11px] leading-relaxed text-c-text-secondary">
              {change.rationale}
            </p>
          )}

          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-c-border-subtle bg-c-surface-raised p-2 text-[11px] leading-relaxed text-c-text">
            {change.proposedValue}
          </pre>

          {/* ── Różnica: przed / po ─────────────────────────────────────── */}
          {diffOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {pick(L.before, isPolish)}
                </p>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md border border-c-border-subtle bg-c-surface-raised p-2 text-[11px] leading-relaxed text-c-text-secondary">
                  {change.currentValue.trim() || pick(L.empty, isPolish)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {pick(L.after, isPolish)}
                </p>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md border border-violet-400/40 bg-violet-500/[0.06] p-2 text-[11px] leading-relaxed text-c-text">
                  {afterValue}
                </pre>
              </div>
            </div>
          )}

          {/* ── Stan / powód blokady ────────────────────────────────────── */}
          {state === 'failed' && (
            <p className="mt-2 text-[11px] text-c-danger">
              {pick(L.failed, isPolish)}
              {failure ? ` — ${failure}` : ''}
            </p>
          )}
          {!settled && state !== 'failed' && blockReason && (
            <p className="mt-2 text-[11px] text-c-text-muted">{blockReason}</p>
          )}

          {/* ── Akcje ───────────────────────────────────────────────────── */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {settled ? (
              <>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    state === 'applied' ? 'text-c-success' : 'text-c-text-muted'
                  }`}
                >
                  {state === 'applied' ? <Check size={12} /> : <X size={12} />}
                  {pick(state === 'applied' ? L.applied : L.rejected, isPolish)}
                </span>
                {state === 'rejected' && (
                  <button
                    type="button"
                    onClick={onRestore}
                    className={`${ACTION_BTN} border border-c-border-subtle text-c-text-secondary hover:bg-state-hover`}
                  >
                    <Undo2 size={12} />
                    {pick(L.undo, isPolish)}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onApply}
                  disabled={busy || !writable || readMode}
                  title={blockReason || undefined}
                  className={`${ACTION_BTN} border border-violet-400/50 bg-violet-500/10 text-violet-700 hover:bg-violet-500/[0.18] dark:border-violet-400/40 dark:text-violet-300`}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {pick(L.apply, isPolish)}
                </button>

                <button
                  type="button"
                  onClick={() => setDiffOpen((v) => !v)}
                  aria-expanded={diffOpen}
                  className={`${ACTION_BTN} border border-c-border-subtle text-c-text-secondary hover:bg-state-hover`}
                >
                  <SquarePen size={12} />
                  {pick(diffOpen ? L.hideDiff : L.showDiff, isPolish)}
                </button>

                <button
                  type="button"
                  onClick={onReject}
                  className={`${ACTION_BTN} text-c-text-muted hover:bg-state-hover hover:text-c-text-secondary`}
                >
                  <X size={12} />
                  {pick(L.reject, isPolish)}
                </button>

                {/* Ratunek, gdy pole nie jest zapisywalne — treść nie ginie. */}
                {!writable && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`${ACTION_BTN} border border-c-border-subtle text-c-text-secondary hover:bg-state-hover`}
                  >
                    <Copy size={12} />
                    {pick(copied ? L.copied : L.copy, isPolish)}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────

export interface NCardAIAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  /** true dopóki trwa wywołanie modelu. */
  loading: boolean;
  /** Wynik ostatniego przebiegu; `null` gdy jeszcze nie ma. */
  result: CardAnalysisResult | null;
  /** Uczciwy powód niepowodzenia (kod z `CardAnalysisError`). */
  errorCode?: string | null;
  /** Kod błędu z backendu (np. AI_BUDGET_EXHAUSTED). */
  serverErrorCode?: string | null;
  /** Ponowne uruchomienie analizy tej samej karty. */
  onRerun: () => void;
  /**
   * ZAPIS. Jedyna droga, którą treść AI może trafić do karty. Wywoływane
   * wyłącznie z „Zastosuj". Zwrot `false` ⇒ pozycja dostaje stan `failed`.
   */
  onApplyChange: CardAnalysisApply;
  /** Id pól, do których karta REALNIE potrafi zapisać. */
  writableFieldIds: readonly string[];
  /** Tryb Podglądu (Menu 2) — blokuje „Zastosuj" w całym panelu. */
  readMode?: boolean;
  isPolish?: boolean;
  /** Offset od góry — panel jest przyklejony do prawej krawędzi pod nagłówkiem. */
  topOffsetClass?: string;
}

export const NCardAIAnalysisPanel: React.FC<NCardAIAnalysisPanelProps> = ({
  open,
  onClose,
  loading,
  result,
  errorCode = null,
  serverErrorCode = null,
  onRerun,
  onApplyChange,
  writableFieldIds,
  readMode = false,
  isPolish = false,
  topOffsetClass = 'top-[56px]',
}) => {
  const [states, setStates] = useState<Record<string, CardAnalysisChangeState>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Nowy wynik = czysty stan decyzji. Bez tego „zastosowano" z poprzedniego
  // przebiegu przykleiłoby się do pozycji o tym samym indeksie (id są `chg-N`).
  useEffect(() => {
    setStates({});
    setFailures({});
    setBusyId(null);
  }, [result?.generatedAt]);

  // Esc zamyka (TRIADA_KANON część B pkt 42).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const writable = useMemo(() => new Set(writableFieldIds), [writableFieldIds]);

  const handleApply = useCallback(
    async (change: CardAnalysisChange) => {
      setBusyId(change.id);
      try {
        const ok = await onApplyChange(change);
        setStates((prev) => ({ ...prev, [change.id]: ok ? 'applied' : 'failed' }));
        if (!ok) setFailures((prev) => ({ ...prev, [change.id]: '' }));
      } catch (err) {
        setStates((prev) => ({ ...prev, [change.id]: 'failed' }));
        setFailures((prev) => ({ ...prev, [change.id]: (err as Error)?.message ?? '' }));
      } finally {
        setBusyId(null);
      }
    },
    [onApplyChange]
  );

  if (!open) return null;

  const errorText = errorCode
    ? serverErrorCode === 'AI_BUDGET_EXHAUSTED'
      ? pick(L.errBudget, isPolish)
      : errorCode === 'REQUEST_FAILED'
        ? pick(L.errRequest, isPolish)
        : pick(L.errParse, isPolish)
    : '';

  return (
    <aside
      role="complementary"
      aria-label={pick(L.title, isPolish)}
      data-testid="ncard-ai-analysis-panel"
      // Slide-over BEZ przyciemniania kanwy — kolumna przy prawej krawędzi,
      // jak `AIConsultantPanel` (SPEC-N §2.2: panel, nie modal).
      className={`fixed right-0 ${topOffsetClass} bottom-0 z-30 flex w-[380px] max-w-full flex-col border-l border-c-border-subtle bg-c-surface-raised shadow-[-8px_0_24px_rgba(0,0,0,0.06)] dark:shadow-[-8px_0_24px_rgba(0,0,0,0.4)]`}
    >
      {/* ── Nagłówek ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-c-border-subtle px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-400/50 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:text-violet-300">
          <Sparkles size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-c-text">{pick(L.title, isPolish)}</p>
          <p className="truncate text-[10px] text-c-text-muted">
            {result?.cardLabel ? `${result.cardLabel} · ` : ''}
            {pick(L.subtitle, isPolish)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRerun}
          disabled={loading}
          aria-label={pick(L.rerun, isPolish)}
          title={pick(L.rerun, isPolish)}
          className="rounded-md p-1.5 text-c-text-muted transition-colors hover:bg-state-hover hover:text-c-text-secondary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={pick(L.close, isPolish)}
          className="rounded-md p-1.5 text-c-text-muted transition-colors hover:bg-state-hover hover:text-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Treść ─────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && !result && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Loader2 size={20} className="animate-spin text-violet-600 dark:text-violet-300" />
            <p className="text-xs font-medium text-c-text">{pick(L.running, isPolish)}</p>
            <p className="max-w-[16rem] text-[11px] leading-relaxed text-c-text-muted">
              {pick(L.runningHint, isPolish)}
            </p>
          </div>
        )}

        {!loading && errorCode && (
          <div className="rounded-lg border border-c-danger/50 bg-c-danger/[0.06] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-c-danger">
              <AlertTriangle size={13} />
              {pick(L.errTitle, isPolish)}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-c-text-secondary">{errorText}</p>
            {serverErrorCode && (
              <p className="mt-1 text-[10px] text-c-text-muted">
                <code>{serverErrorCode}</code>
              </p>
            )}
            <button
              type="button"
              onClick={onRerun}
              className={`${ACTION_BTN} mt-2 border border-c-border-subtle text-c-text-secondary hover:bg-state-hover`}
            >
              <RefreshCw size={12} />
              {pick(L.rerun, isPolish)}
            </button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            {/* Ocena kompletności + werdykt */}
            <section className="rounded-lg border border-violet-400/40 bg-violet-500/[0.06] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {pick(L.completeness, isPolish)}
                </p>
                <p className="text-lg font-semibold leading-none tabular-nums text-violet-700 dark:text-violet-300">
                  {result.completeness}
                  <span className="text-xs font-normal text-c-text-muted">/100</span>
                </p>
              </div>
              <div
                role="progressbar"
                aria-valuenow={result.completeness}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-c-surface"
              >
                <div
                  className="h-full rounded-full bg-violet-500 transition-[width]"
                  style={{ width: `${result.completeness}%` }}
                />
              </div>
              {result.verdict && (
                <p className="mt-2 text-[11px] leading-relaxed text-c-text-secondary">
                  {result.verdict}
                </p>
              )}
              <p className="mt-1.5 text-[10px] text-c-text-muted">
                {pick(L.completenessNote, isPolish)}
              </p>
            </section>

            {/* Kontrakt: Braki · Ryzyka · Sugestie · Proponowane zmiany */}
            <FindingSection
              icon={<CircleAlert size={12} />}
              title={pick(L.gaps, isPolish)}
              items={result.gaps}
              isPolish={isPolish}
            />
            <FindingSection
              icon={<AlertTriangle size={12} />}
              title={pick(L.risks, isPolish)}
              items={result.risks}
              isPolish={isPolish}
            />
            <FindingSection
              icon={<Lightbulb size={12} />}
              title={pick(L.suggestions, isPolish)}
              items={result.suggestions}
              isPolish={isPolish}
            />

            <section className="flex flex-col gap-2">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                <SquarePen size={12} className="shrink-0" />
                {pick(L.changes, isPolish)}
                <span className="ml-auto font-normal tabular-nums">{result.changes.length}</span>
              </h3>

              {result.changes.length === 0 ? (
                <p className="px-1 text-xs text-c-text-muted">{pick(L.none, isPolish)}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {result.changes.map((c) => (
                    <ChangeRow
                      key={c.id}
                      change={c}
                      state={states[c.id] ?? 'pending'}
                      writable={writable.has(c.fieldId)}
                      readMode={readMode}
                      busy={busyId === c.id}
                      isPolish={isPolish}
                      failure={failures[c.id]}
                      onApply={() => void handleApply(c)}
                      onReject={() => setStates((prev) => ({ ...prev, [c.id]: 'rejected' }))}
                      onRestore={() =>
                        setStates((prev) => {
                          const next = { ...prev };
                          delete next[c.id];
                          return next;
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </aside>
  );
};

export default NCardAIAnalysisPanel;

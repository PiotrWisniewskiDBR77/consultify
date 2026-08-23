/**
 * NModeCardState — wspólny komponent „stanu karty AI-draft" (wzorzec N)
 *
 * KEYSTONE wzorca N. Jeden generyczny, props-driven komponent konsumowany przez
 * 4 artefakty N (Insight · Inicjatywa · Decyzja · Task). Zawiera:
 *
 *   • Model stanu karty (union `NModeCardStatus`):
 *       empty | generating | ai-draft | edited | done | error
 *   • Nagłówek karty:  [nazwa sekcji] [✨AI] [badge stanu]
 *       - badge AI-draft = niebieski `c-info`  (NIE crimson)
 *       - badge „edytowane" = neutralny szary (`c-text-secondary` na `c-surface-raised`)
 *       - badge „done" = zielony ✓ (`c-success`)
 *   • Pasek akcji karty (stała kolejność §3.3):
 *       ✨ Regeneruj · ✎ Edytuj · ✓ Zaakceptuj · ⋯ (Wyczyść · Historia · Ukryj)
 *   • Stany zawartości:
 *       generating → skeleton + „Teresa pisze…"
 *       empty      → „✨ Wygeneruj z AI" + „✎ Wypełnij ręcznie"
 *       error      → uczciwy komunikat + „Spróbuj ponownie"
 *
 * TWARDE ZASADY (powłoka artefaktu = NEUTRALNA, kanon §11.2):
 *   - CRIMSON-SAFE: żadnych klas `primary-*` / `bg-primary` / `text-primary`.
 *   - TOKENY c-* zamiast slate/navy/hex: `c-text`/`c-text-secondary`/`c-text-muted`,
 *     `c-surface`/`c-surface-raised`, `c-border`/`c-border-subtle`.
 *   - Badge AI-draft = `c-info`; done = `c-success`; błąd = `c-danger`;
 *     akcent AI (✨/regeneracja) = teal (jak reszta kitu); fokus = `c-focus`.
 *   - Tokeny c-* są theme-aware (CSS vars :root/.dark) → bez `dark:` wariantów.
 *
 * Wpina się OBOK `NModeSectionWrapper` (ten wrapper daje spacing/heading sekcji;
 * `NModeCardState` daje badge stanu + pasek akcji + stany empty/loading/error).
 *
 * @see Harvard/wdrozenie-100/_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md §3
 * @see Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §11.2
 */

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Model stanu karty ────────────────────────────────────────────────────────

/**
 * Stan pojedynczej karty-sekcji wzorca N (dok. §3.2).
 *
 *   empty      — jeszcze nie wypełniona (placeholder z dwiema drogami)
 *   generating — AI pisze teraz (skeleton + „Teresa pisze…")
 *   ai-draft   — AI napisało, człowiek jeszcze nie zaakceptował (badge „AI")
 *   edited     — człowiek zmienił treść (badge „edytowane")
 *   done       — człowiek zatwierdził (✓)
 *   error      — generacja padła (uczciwy błąd + „Spróbuj ponownie")
 */
export type NModeCardStatus = 'empty' | 'generating' | 'ai-draft' | 'edited' | 'done' | 'error';

type BilingualText = { en: string; pl: string };

// ── Wybór funkcji tłumaczącej ────────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslation>['t'];
type I18nInstance = ReturnType<typeof useTranslation>['i18n'];

/**
 * Wybiera `t` przypięte do języka wymuszonego propem `isPolish`, a gdy propu
 * nie ma — zwykłe `t` z hooka.
 *
 * R2/defekt #4 (2026-07-23): `i18n.getFixedT` było wołane bez guardu. Pełna
 * instancja i18next zawsze ją ma, ale testy (i każdy `I18nextProvider`
 * z atrapą/okrojoną instancją) podstawiają obiekt bez tej metody — wtedy
 * KAŻDA karta wzorca N wywracała się na `TypeError: i18n.getFixedT is not
 * a function`, co przewracało cały render Insightu (38 błędów, 10 czerwonych
 * testów z JEDNEJ linii). Zachowanie produkcyjne bez zmian: przy sprawnej
 * instancji nadal dostajemy `getFixedT`; awaryjnie schodzimy na `t` z hooka,
 * czyli język bieżącej instancji zamiast wywrotki komponentu.
 */
function useFixedT(i18n: I18nInstance, tHook: TFunc, isPolishProp?: boolean): TFunc {
  if (typeof isPolishProp !== 'boolean') return tHook;
  if (typeof i18n?.getFixedT !== 'function') return tHook;
  return i18n.getFixedT(isPolishProp ? 'pl' : 'en') as TFunc;
}

// ── Badge stanu ──────────────────────────────────────────────────────────────

/**
 * NModeCardBadge — mały znacznik stanu karty w nagłówku.
 * Eksportowany osobno na wypadek, gdyby artefakt renderował własny nagłówek
 * sekcji i chciał tylko badge (np. Insight z bespoke headerem).
 */
export const NModeCardBadge: React.FC<{ status: NModeCardStatus; isPolish?: boolean }> = ({
  status,
  isPolish: isPolishProp,
}) => {
  const { t: tHook, i18n } = useTranslation();
  const t = useFixedT(i18n, tHook, isPolishProp);

  // Wspólna baza pastylki badge.
  const base =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0';

  switch (status) {
    case 'ai-draft':
      // Niebieski `c-info` — sygnał „to napisało AI, zweryfikuj". NIGDY crimson.
      return (
        <span
          className={`${base} bg-c-info/10 text-c-info border-c-info/30`}
          title={t('sharedComponents.nModeCardState.aiDraftTooltip')}
        >
          <Sparkles size={10} />
          {t('sharedComponents.nModeCardState.aiDraftBadge')}
        </span>
      );
    case 'edited':
      // Neutralny szary — człowiek dotknął treści.
      return (
        <span
          className={`${base} bg-c-surface-raised text-c-text-secondary border-c-border`}
          title={t('sharedComponents.nModeCardState.editedTooltip')}
        >
          <Pencil size={10} />
          {t('sharedComponents.nModeCardState.editedBadge')}
        </span>
      );
    case 'done':
      // Zielony `c-success` — zatwierdzone.
      return (
        <span
          className={`${base} bg-c-success/10 text-c-success border-c-success/30`}
          title={t('sharedComponents.nModeCardState.doneTooltip')}
        >
          <Check size={10} />
          {t('sharedComponents.nModeCardState.doneBadge')}
        </span>
      );
    case 'error':
      return (
        <span
          className={`${base} bg-c-danger/10 text-c-danger border-c-danger/30`}
          title={t('sharedComponents.nModeCardState.errorTooltip')}
        >
          <AlertTriangle size={10} />
          {t('sharedComponents.nModeCardState.errorBadge')}
        </span>
      );
    case 'generating':
      return (
        <span
          className={`${base} bg-c-info/10 text-c-info border-c-info/30`}
          title={t('sharedComponents.nModeCardState.generatingTooltip')}
        >
          <Loader2 size={10} className="animate-spin" />
          {t('sharedComponents.nModeCardState.generatingBadge')}
        </span>
      );
    case 'empty':
    default:
      return null;
  }
};

// ── Kebab karty ──────────────────────────────────────────────────────────────

interface CardKebabProps {
  onClear?: () => void;
  onHistory?: () => void;
  onHide?: () => void;
  t: (key: string) => string;
}

/** Kebab karty: Wyczyść · Historia karty · Ukryj sekcję (kolejność stała §3.3). */
const CardKebab: React.FC<CardKebabProps> = ({ onClear, onHistory, onHide, t }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
  }> = [
    {
      key: 'clear',
      icon: <Trash2 size={13} />,
      label: t('sharedComponents.nModeCardState.clearAction'),
      onClick: onClear,
    },
    {
      key: 'history',
      icon: <History size={13} />,
      label: t('sharedComponents.nModeCardState.cardHistoryAction'),
      onClick: onHistory,
    },
    {
      key: 'hide',
      icon: <Eye size={13} />,
      label: t('sharedComponents.nModeCardState.hideSectionAction'),
      onClick: onHide,
    },
  ].filter((i) => typeof i.onClick === 'function');

  if (items.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('sharedComponents.nModeCardState.moreTooltip')}
        aria-label={t('sharedComponents.nModeCardState.moreCardActionsLabel')}
        className="inline-flex items-center justify-center p-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-[160px] py-1 rounded-lg border border-c-border bg-c-surface-raised shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface transition-colors text-left focus-visible:outline-none focus-visible:bg-c-surface"
            >
              <span className="shrink-0 text-c-text-muted">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Pasek akcji karty ────────────────────────────────────────────────────────

/** Baza przycisku paska akcji karty — neutralny/ghost, fokus = `c-focus`. */
const CARD_ACTION_BASE =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

// ── Props głównego komponentu ────────────────────────────────────────────────

export interface NModeCardStateProps {
  /** Aktualny stan karty (steruje badge + renderem zawartości). */
  state: NModeCardStatus;
  /** Nazwa sekcji (nagłówek karty). Bilingual lub gotowy string. */
  sectionName: string | BilingualText;
  /**
   * Czy treść tej karty pochodzi z AI (pokazuje ikonę ✨ przy nazwie sekcji).
   * Niezależne od `state` — karta może być `edited`, a wciąż AI-generated.
   */
  aiGenerated?: boolean;

  // ── Handlery akcji (każdy artefakt wpina swoje) ──
  /** ✨ Regeneruj — AI pisze kartę od nowa. Może zwracać Promise. */
  onRegenerate?: () => void | Promise<void>;
  /** ✎ Edytuj — człowiek edytuje treść inline. */
  onEdit?: () => void;
  /** ✓ Zaakceptuj — zatwierdza kartę (ai-draft/edited → done). */
  onAccept?: () => void;
  /** Kebab: Wyczyść treść karty. */
  onClear?: () => void;
  /** Kebab: Historia karty. */
  onHistory?: () => void;
  /** Kebab: Ukryj sekcję. */
  onHide?: () => void;

  // ── Stany empty/error ──
  /** Empty: „✨ Wygeneruj z AI" (jeśli brak — pokaże tylko „Wypełnij ręcznie"). */
  onGenerate?: () => void | Promise<void>;
  /** Empty: „✎ Wypełnij ręcznie". */
  onFillManually?: () => void;
  /** Error: „Spróbuj ponownie". */
  onRetry?: () => void | Promise<void>;
  /** Error: opcjonalny konkretny komunikat (nadpisuje domyślny „uczciwy błąd"). */
  errorMessage?: string;

  /**
   * Gdy true: regeneracja karty w stanie `edited` musi być potwierdzona
   * („Zastąpić Twoje zmiany?") zanim wywoła `onRegenerate` (dok. §3.3).
   * Domyślnie true — chroni ręczną pracę człowieka.
   */
  confirmOverwrite?: boolean;

  /** Wymusza język (inaczej z i18n). */
  isPolish?: boolean;

  /** Ukrycie całego paska akcji (np. tryb Read-only). */
  hideActions?: boolean;

  /**
   * Ukrycie badge'a stanu w nagłówku karty („Szkic AI" / „Edytowane" / „Gotowe").
   * Osobno od `hideActions`, bo to inna oś: akcje bywają zdejmowane także przy
   * zablokowanym etapie w trybie Edycja (`isDecisionStageLocked`), a badge ma
   * znikać WYŁĄCZNIE w Podglądzie — to informacja o kuchni redakcyjnej, której
   * klient patrzący na artefakt nie ma prawa widzieć. W trybie Edycja badge
   * zostaje bez zmian.
   */
  hideBadge?: boolean;

  /** Optional honest hand-off when this card still requires the parent artifact's Save action. */
  persistenceNotice?: string;

  /**
   * Treść karty (pola strukturalne / listy / edytor). Renderowana w stanach
   * `ai-draft` · `edited` · `done`. W `generating`/`empty`/`error` komponent
   * pokazuje własny stan zamiast children.
   */
  children?: React.ReactNode;
}

// ── Główny komponent ─────────────────────────────────────────────────────────

export const NModeCardState: React.FC<NModeCardStateProps> = ({
  state,
  sectionName,
  aiGenerated = false,
  onRegenerate,
  onEdit,
  onAccept,
  onClear,
  onHistory,
  onHide,
  onGenerate,
  onFillManually,
  onRetry,
  errorMessage,
  confirmOverwrite = true,
  isPolish: isPolishProp,
  hideActions = false,
  hideBadge = false,
  persistenceNotice,
  children,
}) => {
  const { t: tHook, i18n } = useTranslation();
  const t = useFixedT(i18n, tHook, isPolishProp);
  const isPolish = isPolishProp ?? i18n.language === 'pl';

  const [regenerating, setRegenerating] = useState(false);

  const title =
    typeof sectionName === 'string' ? sectionName : isPolish ? sectionName.pl : sectionName.en;

  // Regeneracja: gdy karta jest `edited` i włączono ochronę → potwierdź nadpisanie.
  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    if (state === 'edited' && confirmOverwrite) {
      const ok = window.confirm(t('sharedComponents.nModeCardState.confirmOverwritePrompt'));
      if (!ok) return;
    }
    try {
      setRegenerating(true);
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  // Nagłówek karty: [nazwa sekcji] [✨AI] [badge stanu]
  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="min-w-0 flex items-center gap-2 text-base font-semibold text-c-text">
        <span className="min-w-0 truncate">{title}</span>
        {aiGenerated && (
          <Sparkles
            size={14}
            className="shrink-0 text-teal-500 dark:text-teal-400"
            aria-label={t('sharedComponents.nModeCardState.aiGeneratedLabel')}
          />
        )}
        {!hideBadge && <NModeCardBadge status={state} isPolish={isPolish} />}
      </h3>
    </div>
  );

  // Pasek akcji: ✨ Regeneruj · ✎ Edytuj · ✓ Zaakceptuj · ⋯ (stała kolejność)
  const isAccepted = state === 'done';
  const actionBar =
    hideActions || state === 'empty' || state === 'generating' || state === 'error' ? null : (
      <div className="flex items-center gap-1 pt-3 mt-3 border-t border-c-border-subtle">
        {onRegenerate && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            title={t('sharedComponents.nModeCardState.regenerateTooltip')}
            className={`${CARD_ACTION_BASE} text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/25`}
          >
            {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
            {t('sharedComponents.nModeCardState.regenerateAction')}
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            title={t('sharedComponents.nModeCardState.editManuallyTooltip')}
            className={`${CARD_ACTION_BASE} text-c-text-secondary hover:bg-c-surface-raised`}
          >
            <Pencil size={13} />
            {t('sharedComponents.nModeCardState.editAction')}
          </button>
        )}
        {onAccept && (
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepted}
            title={t('sharedComponents.nModeCardState.acceptCardTooltip')}
            className={`${CARD_ACTION_BASE} ${
              isAccepted
                ? 'text-c-success'
                : 'text-c-text-secondary hover:bg-c-success/10 hover:text-c-success'
            }`}
          >
            {isAccepted ? <CheckCircle2 size={13} /> : <Check size={13} />}
            {t('sharedComponents.nModeCardState.acceptAction')}
          </button>
        )}
        <div className="flex-1" />
        <CardKebab onClear={onClear} onHistory={onHistory} onHide={onHide} t={t} />
      </div>
    );

  // ── Render zawartości wg stanu ──
  let body: React.ReactNode;

  if (state === 'generating') {
    // Skeleton + „Teresa pisze…"
    body = (
      <div className="py-2" aria-busy="true" aria-live="polite">
        <div className="flex items-center gap-2 text-xs font-medium text-c-info mb-3">
          <Loader2 size={13} className="animate-spin" />
          {t('sharedComponents.nModeCardState.teresaWriting')}
        </div>
        <div className="space-y-2.5">
          <div className="h-3.5 rounded bg-c-border-subtle animate-pulse w-[92%]" />
          <div className="h-3.5 rounded bg-c-border-subtle animate-pulse w-full" />
          <div className="h-3.5 rounded bg-c-border-subtle animate-pulse w-[78%]" />
          <div className="h-3.5 rounded bg-c-border-subtle animate-pulse w-[85%]" />
        </div>
      </div>
    );
  } else if (state === 'empty') {
    // Placeholder z dwiema drogami: „✨ Wygeneruj z AI" + „✎ Wypełnij ręcznie"
    body = (
      <div className="text-center py-10">
        <Sparkles size={26} className="mx-auto text-c-text-muted mb-3" />
        <p className="text-sm text-c-text-secondary mb-4">
          {t('sharedComponents.nModeCardState.sectionEmptyHint')}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {onGenerate && (
            <button
              type="button"
              onClick={() => onGenerate()}
              className={`${CARD_ACTION_BASE} bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:border-teal-700/40 dark:text-teal-300 dark:hover:bg-teal-900/40`}
            >
              <Sparkles size={13} />
              {t('sharedComponents.nModeCardState.generateWithAiAction')}
            </button>
          )}
          {onFillManually && (
            <button
              type="button"
              onClick={onFillManually}
              className={`${CARD_ACTION_BASE} border border-c-border text-c-text-secondary hover:bg-c-surface-raised`}
            >
              <Pencil size={13} />
              {t('sharedComponents.nModeCardState.fillManuallyAction')}
            </button>
          )}
        </div>
      </div>
    );
  } else if (state === 'error') {
    // Uczciwy błąd + „Spróbuj ponownie"
    body = (
      <div className="text-center py-8">
        <AlertTriangle size={24} className="mx-auto text-c-danger mb-3" />
        <p className="text-sm text-c-text mb-1">
          {errorMessage || t('sharedComponents.nModeCardState.generationFailedMessage')}
        </p>
        <p className="text-xs text-c-text-muted mb-4">
          {t('sharedComponents.nModeCardState.errorNotYourFaultHint')}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={() => onRetry()}
            className={`${CARD_ACTION_BASE} border border-c-border text-c-text-secondary hover:bg-c-surface-raised`}
          >
            <RotateCw size={13} />
            {t('sharedComponents.nModeCardState.tryAgainAction')}
          </button>
        )}
      </div>
    );
  } else {
    // ai-draft · edited · done → pokaż treść karty
    body = <div className="text-sm text-c-text-secondary">{children}</div>;
  }

  return (
    <div className="space-y-3">
      {header}
      {body}
      {persistenceNotice && (state === 'ai-draft' || state === 'edited') ? (
        <p role="status" className="text-xs text-c-text-muted">
          {persistenceNotice}
        </p>
      ) : null}
      {actionBar}
    </div>
  );
};

export default NModeCardState;

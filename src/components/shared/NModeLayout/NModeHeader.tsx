/**
 * NModeHeader
 *
 * Standard header bar (Menu 1) for all N-mode artifact detail views.
 * Contains: back button, title (text→input on click), status pill, save-state
 * indicator, ONE primary CTA, and an overflow (⋮) menu that holds
 * "copy object code" + "copy link".
 *
 * ETAP 1.1 standardu n-Type (2026-07-23) — przełącznik widoku N/C ZNIKA z Menu 1
 * kart N (najczęstsza uwaga właściciela: „ikony między AI a akcją główną").
 * `showModeSwitcher` domyślnie `false`; jedyny konsument, który go jeszcze włącza,
 * to Interview (nie jest kartą N).
 *
 * Decisions 2026-07-22 (Piotr) implemented here:
 *   D-B — status = labelled pill (statusLabel/statusTone, c-* tokens), not a bare dot.
 *   D-C — save state = non-clickable text indicator (autosave on blur stays).
 *   D-D — object code + permalink moved off the bar into the ⋮ kebab.
 *   D6  — title truncates with ellipsis (view = text, click → input).
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.1
 * @see Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §11.2 (kanon Menu 1)
 */

import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  Copy,
  Lightbulb,
  Link2,
  MoreVertical,
  Rocket,
  Scale,
  Sparkles,
  Wrench,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PresentationModeSwitcher } from '@/components/MyWork/shared/PresentationModeSwitcher';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import type { PresentationMode } from '@/hooks/usePresentationMode';
import {
  ARTIFACT_IDENTITY,
  type ArtifactType,
  buildArtifactPermalink,
} from '@/utils/artifactLinks';

import type { NModeHeaderConfig } from './types';

interface NModeHeaderProps extends NModeHeaderConfig {
  /** Current presentation mode */
  presentationMode: PresentationMode;
  /** Mode change handler */
  onPresentationModeChange: (mode: PresentationMode) => void;
  /**
   * Pokazuje przełącznik gęstości N/C w Menu 1. DOMYŚLNIE `false` — standard
   * n-Type ETAP 1.1 (2026-07-23): karty N mają JEDEN widok, więc przełącznik
   * znika z ich nagłówków. Zostaje wyłącznie dla konsumentów, którzy jawnie
   * podadzą `true` (dziś: Interview — nie jest kartą N).
   */
  showModeSwitcher?: boolean;
  /** Build artifact code string from type + id */
  buildArtifactCode?: (type: ArtifactType, id: string) => string;
  /** Optional id for the title input (for guided focus/jump) */
  titleInputId?: string;
}

// ── Status pill tone → c-* classes ─────────────────────────────────────────
// Same map as ArtifactApprovalStatusBar.tsx:55-60. c-* ONLY (no crimson/slate/
// navy/hex). draft/neutral read as quiet surface; review/approved/rejected use
// the info/success/danger tokens at a 15% tint so the pill never shouts.
type StatusTone = NonNullable<NModeHeaderConfig['statusTone']>;
const STATUS_PILL_CLASS: Record<StatusTone, string> = {
  draft: 'bg-c-surface-raised text-c-text-muted',
  review: 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info',
  approved: 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success',
  rejected: 'bg-[color-mix(in_srgb,var(--c-danger)_15%,transparent)] text-c-danger',
  neutral: 'bg-c-surface-raised text-c-text-muted',
};

// ── Ikona-typ artefaktu w Menu 1 (M1) ───────────────────────────────────────
// Mapa nazw ikon z ARTIFACT_IDENTITY (SSOT tożsamości artefaktu) na komponenty
// Lucide. Renderowana przed tytułem, 16px, c-text-muted (neutralna — to znacznik
// typu, nie akcent). Nowy typ w ARTIFACT_IDENTITY z ikoną spoza tej mapy → brak
// ikony (fallback null), bez błędu.
const TYPE_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Scale, // decision
  CheckSquare, // task
  Bell, // notification
  Lightbulb, // insight
  Wrench, // tool
  Rocket, // initiative
  CheckCircle2, // interview / assessment
};

// ── Overflow (⋮) menu ───────────────────────────────────────────────────────
// Portaled to <body>: the header wrapper is `overflow-hidden` (rounded card +
// backdrop-blur), so an in-flow dropdown would be clipped. Fixed-positioned via
// the trigger's rect, right-anchored. c-* tokens only; focus ring = c-focus.
interface OverflowMenuItem {
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  onClick: () => void;
  /** Optional tooltip (e.g. keyboard-shortcut hint). */
  title?: string;
  /** Destructive item — separator above + c-danger tone (see `extraOverflowItems`). */
  danger?: boolean;
}

const HeaderOverflowMenu: React.FC<{ items: OverflowMenuItem[]; ariaLabel: string }> = ({
  items,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r)
        setPos({ top: r.bottom + 6, right: Math.max(8, Math.round(window.innerWidth - r.right)) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-c-text-secondary hover:bg-state-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        title={ariaLabel}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={18} />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-context-menu"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="fixed z-context-menu min-w-[200px] rounded-lg border border-c-border-subtle bg-c-surface p-1 shadow-lg"
              style={{ top: pos.top, right: pos.right }}
            >
              {items.map((it, idx) => {
                const Icon = it.icon;
                // Separator nad pierwszą pozycją destrukcyjną — oddziela
                // działania techniczne od nieodwracalnych (standard n-Type §3.5).
                const needsSeparator = Boolean(it.danger) && idx > 0 && !items[idx - 1]?.danger;
                return (
                  <React.Fragment key={it.id}>
                    {needsSeparator ? (
                      <div className="my-1 border-t border-c-border-subtle" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      title={it.title}
                      onClick={() => {
                        it.onClick();
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
                        it.danger
                          ? 'text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)]'
                          : 'text-c-text hover:bg-c-surface-raised'
                      }`}
                    >
                      <Icon
                        size={14}
                        className={`shrink-0 ${it.danger ? 'text-c-danger' : 'text-c-text-muted'}`}
                      />
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export const NModeHeader: React.FC<NModeHeaderProps> = ({
  title,
  onTitleChange,
  titleReadOnly = false,
  titlePlaceholder,
  artifactId,
  artifactType,
  onSave,
  saving = false,
  saveState,
  lastSavedLabel,
  isDirty = false,
  onChat,
  onClose,
  statusLabel,
  statusTone = 'neutral',
  presentationMode,
  onPresentationModeChange,
  showModeSwitcher = false,
  buildArtifactCode,
  titleInputId,
  secondaryActions,
  primaryAction,
  extraOverflowItems,
  showChatButton = false,
  // NOTE: `statusDotColor` (deprecated, D-B) is intentionally NOT destructured
  // or rendered — the bare dot is replaced by the status pill above. The prop
  // stays in NModeHeaderConfig (accepted) so cards that still pass it typecheck.
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // Title: text in view, <input> on click (D6). New artifacts (no id) open in
  // edit mode + autofocus, preserving the old `autoFocus={!artifactId}`.
  const [isEditingTitle, setIsEditingTitle] = useState(() => !artifactId);
  const resolvedPlaceholder = titlePlaceholder
    ? isPolish
      ? titlePlaceholder.pl
      : titlePlaceholder.en
    : '';

  const artifactCode =
    artifactId && buildArtifactCode
      ? buildArtifactCode(artifactType, artifactId)
      : artifactId || '';

  const copyObjectCode = useCallback(async () => {
    if (!artifactCode) return;
    try {
      await navigator.clipboard.writeText(artifactCode);
      toast.success(t('sharedComponents.nModeHeader.copyCodeSuccess'));
    } catch {
      toast.error(t('sharedComponents.artifactPermalinkButton.copyFailed'));
    }
  }, [artifactCode, t]);

  const copyPermalink = useCallback(async () => {
    if (!artifactId) return;
    try {
      await navigator.clipboard.writeText(buildArtifactPermalink(artifactType, artifactId));
      toast.success(t('sharedComponents.artifactPermalinkButton.copied'));
    } catch {
      toast.error(t('sharedComponents.artifactPermalinkButton.copyFailed'));
    }
  }, [artifactId, artifactType, t]);

  const overflowItems: OverflowMenuItem[] = [
    ...(artifactId
      ? [
          {
            id: 'copy-code',
            label: t('sharedComponents.nModeHeader.copyObjectCode'),
            icon: Copy,
            onClick: () => void copyObjectCode(),
          },
          {
            id: 'copy-link',
            label: t('sharedComponents.nModeHeader.copyLink'),
            icon: Link2,
            onClick: () => void copyPermalink(),
          },
        ]
      : []),
    // Pozycje karty (standard n-Type §3.5) — techniczne/administracyjne.
    // Doklejane, nigdy nie zastępują pozycji powłoki.
    ...(extraOverflowItems ?? []),
  ];

  // Save state — non-clickable text (D-C). Autosave still fires on title blur.
  const effectiveSaveState = saveState || (saving ? 'saving' : isDirty ? 'dirty' : 'saved');
  const saveInfo = {
    saved: {
      label: t('sharedComponents.nModeHeader.savedLabel'),
      title: lastSavedLabel || t('sharedComponents.nModeHeader.savedTitle'),
    },
    saving: {
      label: t('sharedComponents.nModeHeader.savingLabel'),
      title: t('sharedComponents.nModeHeader.savingTitle'),
    },
    dirty: {
      label: t('sharedComponents.nModeHeader.unsavedLabel'),
      title: t('sharedComponents.nModeHeader.dirtyTitle'),
    },
    error: {
      label: t('sharedComponents.nModeHeader.saveFailedLabel'),
      title: t('sharedComponents.nModeHeader.saveFailedTitle'),
    },
  }[effectiveSaveState];

  return (
    <motion.div
      data-nmode-header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      /* Pasek Menu 1 — powierzchnia „podniesiona" MUSI mieć granicę.
       * Zmierzone PRZED (dev-render, getComputedStyle): tło paska vs otoczenie
       * dawało kontrast 1,00–1,05:1 w LIGHT **i** w DARK, przy `border: 0px`
       * i `box-shadow: none` → tytuł „wisiał w powietrzu".
       * Powód w dark: nadpisanie `dark:bg-c-surface/70` odbierało paskowi token
       * `--c-surface-raised` i malowało go kolorem karty (dosłownie 1,000:1).
       * Naprawa systemowa (ten sam wzorzec co dropdowny/NModeMenu2 —
       * `border border-c-border` + `bg-c-surface-raised`): granica z tokenu
       * bordera + `shadow-elevation-1` (kanoniczna „raised card, resting”,
       * theme-aware). Token `--c-surface-raised` ZOSTAJE bez zmian — jego
       * przyciemnienie zbiłoby `text-c-text-muted` na tej powierzchni poniżej
       * progu WCAG AA (zmierzone 4,55:1, próg 4,5:1). */
      className="col-span-full border border-c-border bg-c-surface-raised/90 backdrop-blur-xl rounded-2xl overflow-hidden shadow-elevation-1"
    >
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 lg:flex-nowrap lg:gap-4">
        {/* Back button — icon-only (ChevronLeft), so it needs an explicit
            accessible name: axe-core (critical, 2026-08-12 sweep) found this
            control had none on every N-mode detail screen. `onClose` is the
            shared "go back to where you came from" handler every consumer
            wires here (goToList/onBack/…, see NModeHeaderConfig.onClose) —
            never a same-view dialog dismiss — so "Wstecz"/"Back" describes
            the real action without overclaiming a specific destination.
            Bilingual literal (not t()) mirrors `primaryAction.title` below:
            this string is intentionally NOT in the translation catalogue. */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label={isPolish ? 'Wstecz' : 'Back'}
          title={isPolish ? 'Wstecz' : 'Back'}
          className="p-2 -ml-2 rounded-xl text-c-text-secondary hover:bg-state-hover transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
        >
          <ChevronLeft size={20} />
        </motion.button>

        {/* Title area: title (truncate) · status pill · save-state text */}
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          {/* Ikona-typ artefaktu (M1) — znacznik typu przed tytułem, neutralny. */}
          {(() => {
            const iconName = ARTIFACT_IDENTITY[artifactType]?.icon;
            const TypeIcon = iconName ? TYPE_ICON[iconName] : undefined;
            return TypeIcon ? (
              <TypeIcon size={16} className="shrink-0 text-c-text-muted" aria-hidden />
            ) : null;
          })()}
          {isEditingTitle && !titleReadOnly ? (
            <input
              id={titleInputId}
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false);
                // Canon A1: auto-save on blur. Only when there are unsaved
                // changes and we're not mid-save (avoid double-submit).
                if (isDirty && !saving && effectiveSaveState !== 'saving') {
                  onSave?.();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="min-w-0 flex-1 text-xl font-bold bg-transparent text-c-text placeholder-c-text-muted border-b-2 border-transparent focus:outline-none focus:border-c-focus-solid transition-colors"
              placeholder={resolvedPlaceholder || undefined}
              autoFocus
            />
          ) : titleReadOnly ? (
            <span
              id={titleInputId}
              className="min-w-0 truncate text-xl font-bold text-c-text"
              title={title || resolvedPlaceholder}
            >
              {title || (
                <span className="text-c-text-muted font-normal">{resolvedPlaceholder}</span>
              )}
            </span>
          ) : (
            <button
              id={titleInputId}
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="min-w-0 truncate rounded-sm text-left text-xl font-bold bg-transparent text-c-text border-b-2 border-transparent hover:border-c-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              title={title || resolvedPlaceholder}
            >
              {title || (
                <span className="text-c-text-muted font-normal">{resolvedPlaceholder}</span>
              )}
            </button>
          )}

          {/* Status lifecycle pill (D-B). Rendered only when the card supplies
              a label; no bare dot fallback. */}
          {statusLabel && (
            <span
              className={`inline-flex shrink-0 items-center h-5 px-2 rounded-md text-[11px] font-medium whitespace-nowrap ${STATUS_PILL_CLASS[statusTone]}`}
            >
              {statusLabel}
            </span>
          )}

          {/* Save-state indicator — text, not a control (D-C). */}
          <span
            className={`shrink-0 whitespace-nowrap text-xs ${
              effectiveSaveState === 'error' ? 'text-c-danger' : 'text-c-text-muted'
            }`}
            title={saveInfo.title}
          >
            {saveInfo.label}
          </span>
        </div>

        {/* Action buttons */}
        <div
          data-nmode-header-action-row
          className="flex w-full min-w-0 items-center gap-1 sm:gap-2 lg:w-auto lg:shrink-0"
        >
          {secondaryActions ? (
            <div
              data-nmode-header-secondary-actions
              className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain sm:gap-2 lg:max-w-[55vw] lg:flex-none"
            >
              {secondaryActions}
            </div>
          ) : null}
          {/* AI (#27/#37): header slot for klasa S (Task/Decision — no M3),
              opt-in via showChatButton so other NModeHeader consumers that
              already pass onChat (Notification/Initiative/Insight) are
              unaffected until reviewed separately. */}
          {showChatButton && onChat && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onChat}
              /* h-9 (36 px) zamiast `py-2` (dawało 38 px z ramką): to JEDYNY
                 przycisk Menu 1, który wyznaczał wysokość paska własnym
                 paddingiem, przez co Menu 1 w Zadaniu mierzyło 62 px zamiast
                 60 px jak w pozostałych kartach (pomiar 2026-07-23). Stała
                 wysokość = jedna linia bazowa dla całego rzędu akcji. */
              className="flex h-9 items-center gap-1.5 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 text-sm font-medium text-c-text transition-all duration-fast ease-standard hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
              title={t('sharedComponents.nModeHeader.aiAssistantTitle')}
            >
              <Sparkles size={16} className="text-c-text-muted" />
              <span>AI</span>
            </motion.button>
          )}

          {/* Mode Switcher */}
          {showModeSwitcher && (
            <>
              <div className="w-px h-6 bg-c-border-subtle" aria-hidden="true" />
              <PresentationModeSwitcher
                value={presentationMode}
                onChange={onPresentationModeChange}
              />
            </>
          )}

          {/* M1 primary CTA (SPEC-A §299) — ONE action, rightmost edge. Omitted
              by every other NModeHeader consumer (Task/Decision/…) unless they
              explicitly pass `primaryAction`. */}
          {primaryAction && (
            <>
              <div className="w-px h-6 bg-c-border-subtle" />
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                title={
                  primaryAction.title
                    ? isPolish
                      ? primaryAction.title.pl
                      : primaryAction.title.en
                    : undefined
                }
                className={`${MENU_1_PRIMARY_CTA} shrink-0 whitespace-nowrap !gap-1 !px-2 !text-xs sm:!gap-2 sm:!px-4 sm:!text-sm ${primaryAction.className ?? ''}`}
              >
                {primaryAction.icon && <primaryAction.icon size={16} />}
                <span>{isPolish ? primaryAction.label.pl : primaryAction.label.en}</span>
              </button>
            </>
          )}

          {/* Overflow (⋮): copy object code + copy link (D-D). Only when the
              artifact has an id (nothing to copy otherwise). */}
          <HeaderOverflowMenu
            items={overflowItems}
            ariaLabel={t('sharedComponents.nModeHeader.moreActions')}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default NModeHeader;

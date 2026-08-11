/**
 * StandardPreview — JEDYNA fasada panelu podglądu (Triada standard).
 *
 * SSOT wzorca: My Work Decisions preview + NOTATKA-PRAWO
 * `_STANDARD_TRIADA_NOTATKA.md` (ANEKS #5). ŻELAZNA kolejność 6 bloków:
 *
 *  (1) Header — tytuł / pin / Open / ×          → PreviewPaneShell
 *  (2) Karta meta — chipy Status/Priorytet/…
 *      + termin (trailing) + linia rekomendacji → PreviewMetaCard
 *  (3) DETAILS z ⋮ Copy / Export / Pobierz      → PreviewDetailsSection
 *  (4) Ramka AI z chipami per encja             → PreviewAIHintStrip
 *  (5) Relations                                → PreviewRelations
 *  (6) AKCJE — grid 2 kolumny:
 *      rząd 1 = rozstrzygnięcia (Approve[A]/Reject[R]),
 *      rząd 2 = informacyjne (More info[I]/Delegate[G]),
 *      rząd 3 = czas/eskalacja (Remind/Escalate/Snooze[Z])
 *      → WYŁĄCZNIE PreviewActionButton (4 warianty, moduł nie styluje).
 *
 * Skróty klawiszowe: `standardPreviewShortcuts(actions)` → podłącz do
 * TableWithPreviewLayout.actionShortcuts.
 */

import { ExternalLink, type LucideIcon, Pin, PinOff } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  type DetailsAction,
  type MetaPill,
  PreviewActionButton,
  type PreviewActionVariant,
  PreviewAIHintStrip,
  type PreviewAIHintStripProps,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
  SKELETON_LINE_1,
  SKELETON_LINE_2,
  SKELETON_LINE_3,
  SKELETON_LINE_4,
} from '../shared/PreviewPane';
import { PreviewPaneShell } from '../ui/ResizableTable/PreviewPaneShell';
import { ArtifactPropertiesTable, type ArtifactPropertyRow } from './ArtifactPropertiesTable';

export type { MetaPill, RelationItem } from '../shared/PreviewPane';

export interface StandardPreviewAction {
  id: string;
  variant: PreviewActionVariant;
  label: string;
  icon?: LucideIcon;
  /** Pojedynczy klawisz (badge + skrót w TableWithPreviewLayout). */
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface StandardPreviewActions {
  /** Rząd 1 — rozstrzygnięcia (Approve[A] / Reject[R]). */
  resolutions?: StandardPreviewAction[];
  /** Rząd 2 — informacyjne (More info[I] / Delegate[G]). */
  informational?: StandardPreviewAction[];
  /** Rząd 3 — czas / eskalacja (Remind / Escalate / Snooze[Z]). */
  time?: StandardPreviewAction[];
}

export interface StandardPreviewWhatsNextItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}

export interface StandardPreviewWhatsNext {
  /** Nagłówek sekcji (default: "What's next"). */
  label?: string;
  /**
   * Dopisek dla CAŁEJ grupy (np. "Creates a MyWork session first") —
   * pokazany RAZ pod chipami, NIGDY per-pozycja. Audyt
   * `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md` #4/#254: bespoke WHAT'S NEXT
   * powtarzał ten dopisek ×3 (raz na pozycję) — kanon wymusza jeden.
   */
  note?: string;
  items: StandardPreviewWhatsNextItem[];
}

export interface StandardPreviewMeta {
  pills: MetaPill[];
  /** Termin / SLA — prawa strona karty meta. */
  trailing?: React.ReactNode;
  /** Linia rekomendacji pod chipami (np. brief AI). */
  recommendation?: React.ReactNode;
}

export interface StandardPreviewDetails {
  text?: string;
  loading?: boolean;
  label?: string;
  /**
   * WŁAŚCIWOŚCI encji (klucz–wartość) — zamiast sklejania ich w akapit `text`.
   *
   * Przegląd 128 zrzutów naliczył CZTERY podglądy, w których blok treści był
   * zrzutem pól: Interview → Sessions („Answers: 0/6 Started: … Owner: …"),
   * Tools → Assessment („Type: … Progress: 0%"), Tools → Reports, Tools →
   * Initiatives („Type: … Author: —"). Wszystkie robiły to samo obejście —
   * wkładały właściwości w pole na prozę, bo nie miały gdzie indziej.
   *
   * Renderowane przez `ArtifactPropertiesTable` (SPEC-A §11.2), czyli ten sam
   * komponent, który przegląd wskazał jako wzorzec w Tools → Reports
   * („czytelniejsza niż chipy etykieta:wartość"). Licznik słów przy tym
   * wariancie znika sam — nad tabelą nic by nie znaczył.
   *
   * `text` i `properties` można podać razem: najpierw opis, pod nim tabela.
   */
  properties?: ArtifactPropertyRow[];
  /** Nagłówki kolumn tabeli właściwości (przetłumaczone). */
  propertyLabel?: string;
  valueLabel?: string;
  /** ⋮ Copy — zawsze pierwszy w kebabie Details. */
  onCopy?: () => void;
  /** ⋮ Export (np. do formatu udostępnienia). */
  onExport?: () => void;
  exportLabel?: string;
  /** ⋮ Pobierz (plik). */
  onDownload?: () => void;
  downloadLabel?: string;
  /** Dodatkowe pozycje kebaba PO standardowych. */
  extraActions?: DetailsAction[];
}

export interface StandardPreviewProps {
  /* Blok 1 — Header */
  title: string;
  onClose?: () => void;
  onOpenFull?: () => void;
  openLabel?: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  headerExtra?: React.ReactNode;
  /** Parent layout owns header/footer chrome; render the canonical preview body only. */
  embedded?: boolean;

  /* Blok 2 — karta meta */
  meta?: StandardPreviewMeta;

  /* Blok 3 — Details */
  details?: StandardPreviewDetails;

  /* Blok 4 — ramka AI (chipy per encja) */
  ai?: PreviewAIHintStripProps;

  /* Blok 5 — Relations */
  relations?: RelationItem[];
  relationsEmptyLabel?: string;

  /* Blok 6 — akcje (PreviewActionButton, grid 2 kolumny) */
  actions?: StandardPreviewActions;

  /**
   * Blok opcjonalny — WHAT'S NEXT (ANEKS #4, `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10`
   * #4/#254). Kanonizuje ścieżki konwersji z dołu preview (dziś bespoke per
   * moduł, np. "Convert to Initiative/Report/Presentation") jako chipy z
   * JEDNYM wspólnym dopiskiem — zamiast ściśniętej, powtarzającej się
   * tabelki. Renderowany na samym dole, po bloku 6. Brak deklaracji ⇒ blok
   * całkowicie pominięty (addytywne — istniejące preview bez `whatsNext`
   * renderują się identycznie jak dziś).
   */
  whatsNext?: StandardPreviewWhatsNext;

  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Zbiera skróty ze wszystkich rzędów akcji → TableWithPreviewLayout.actionShortcuts. */
export function standardPreviewShortcuts(
  actions?: StandardPreviewActions
): Record<string, () => void> {
  const map: Record<string, () => void> = {};
  for (const row of [actions?.resolutions, actions?.informational, actions?.time]) {
    for (const action of row ?? []) {
      if (action.shortcut && !action.disabled) map[action.shortcut.toUpperCase()] = action.onClick;
    }
  }
  return map;
}

/**
 * Kanon A6/A8: akcja DESTRUKCYJNA stoi ZAWSZE NA KOŃCU stopki podglądu,
 * po akcjach zwykłych — nigdy jako pierwszy przycisk, na który pada wzrok.
 *
 * PILNE-10 / N-83 (przegląd 128 zrzutów, 2026-07-27): reguła była łamana na
 * PIĘCIU ekranach naraz — Tools→Assessment, Tools→Reports, Tools→Initiatives,
 * Initiatives→Portfolio — i za każdym razem z tego samego powodu: ekran wkładał
 * `Delete` do rzędu `resolutions` (bo to formalnie „rozstrzygnięcie"), a
 * `Duplicate` do `informational`. Rzędy renderują się w kolejności
 * resolutions → informational → time, więc jedyna nieodwracalna akcja lądowała
 * NAD wszystkimi pozostałymi. Kebab tego samego wiersza robił to poprawnie —
 * jeden ekran, dwie sprzeczne reguły.
 *
 * Dlatego kolejność jest wymuszana TUTAJ, a nie poprawiana per ekran: żaden
 * nowy ekran nie ma jak jej złamać, choćby podał akcje w dowolnym porządku.
 *
 * Reguła:
 *   1. akcje `destructive` są wyjmowane ze wszystkich rzędów,
 *   2. rzędy zachowują swoją kolejność i zawartość,
 *   3. destrukcyjne wracają na KONIEC ostatniego niepustego rzędu
 *      (albo tworzą własny rząd, gdy nic innego nie zostało).
 *
 * Przypadek Approve/Reject (Decisions) przechodzi bez zmiany: `Reject` jest
 * destrukcyjny i już stoi na końcu swojego rzędu.
 */
export function orderPreviewActionRows(
  actions?: StandardPreviewActions
): StandardPreviewAction[][] {
  const zrzedy = [actions?.resolutions, actions?.informational, actions?.time].map(
    (row) => row ?? []
  );

  const destrukcyjne = zrzedy.flat().filter((a) => a.variant === 'destructive');
  if (destrukcyjne.length === 0) {
    return zrzedy.filter((row) => row.length > 0);
  }

  const bezDestrukcyjnych = zrzedy
    .map((row) => row.filter((a) => a.variant !== 'destructive'))
    .filter((row) => row.length > 0);

  if (bezDestrukcyjnych.length === 0) return [destrukcyjne];

  const ostatni = bezDestrukcyjnych.length - 1;
  return bezDestrukcyjnych.map((row, i) => (i === ostatni ? [...row, ...destrukcyjne] : row));
}

const ActionGridRow: React.FC<{ actions: StandardPreviewAction[] }> = ({ actions }) => (
  /* ANEKS #5 — grid 2 kolumny. */
  <div className="grid grid-cols-2 gap-2">
    {actions.map((action) => (
      <PreviewActionButton
        key={action.id}
        variant={action.variant}
        label={action.label}
        icon={action.icon}
        shortcut={action.shortcut}
        onClick={action.onClick}
        disabled={action.disabled}
      />
    ))}
  </div>
);

export const StandardPreview: React.FC<StandardPreviewProps> = ({
  title,
  onClose,
  onOpenFull,
  openLabel,
  pinned,
  onTogglePin,
  headerExtra,
  embedded = false,
  meta,
  details,
  ai,
  relations,
  relationsEmptyLabel,
  actions,
  whatsNext,
  loading,
  className,
  children,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  // Blok 3 — kebab Details: Copy / Export / Pobierz (żelazny zestaw).
  const detailsActions: DetailsAction[] | undefined = details
    ? [
        ...(details.onCopy
          ? [
              {
                id: 'copy',
                label: t('common.copy', isPolish ? 'Kopiuj' : 'Copy'),
                onClick: details.onCopy,
              },
            ]
          : []),
        ...(details.onExport
          ? [
              {
                id: 'export',
                label: details.exportLabel ?? t('common.export', isPolish ? 'Eksportuj' : 'Export'),
                onClick: details.onExport,
              },
            ]
          : []),
        ...(details.onDownload
          ? [
              {
                id: 'download',
                label:
                  details.downloadLabel ?? t('common.download', isPolish ? 'Pobierz' : 'Download'),
                onClick: details.onDownload,
              },
            ]
          : []),
        ...(details.extraActions ?? []),
      ]
    : undefined;

  const actionRows = orderPreviewActionRows(actions);

  const footer =
    ai || relations || actionRows.length > 0 || whatsNext ? (
      // canon §7.3 — footer cards stacked space-y-2.5, bez dividerów między kartami.
      <div className="space-y-2.5">
        {/* Blok 4 — ramka AI */}
        {ai ? (
          <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
            <PreviewAIHintStrip {...ai} />
          </div>
        ) : null}

        {/* Blok 5 — Relations */}
        {relations ? (
          <PreviewRelations
            items={relations}
            emptyLabel={
              relationsEmptyLabel ??
              t('common.noRelations', isPolish ? 'Brak powiązań' : 'No relations')
            }
          />
        ) : null}

        {/* Blok 6 — pełny blok akcji na dole */}
        {actionRows.length > 0 ? (
          <div className="space-y-2.5 py-1">
            {actionRows.map((row, idx) => (
              <ActionGridRow key={idx} actions={row} />
            ))}
          </div>
        ) : null}

        {/* Blok opcjonalny — WHAT'S NEXT (ANEKS #4). Chipy zamiast ściśniętej
            tabelki; JEDEN dopisek dla całej grupy pod chipami, nie per-pozycja. */}
        {whatsNext ? (
          <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
              {whatsNext.label ?? t('common.whatsNext', isPolish ? 'Co dalej' : "What's next")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {whatsNext.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-c-border bg-c-surface px-2.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {Icon ? <Icon size={12} /> : null}
                    {item.label}
                  </button>
                );
              })}
            </div>
            {whatsNext.note ? (
              <div className="mt-1.5 text-[10px] text-c-text-muted">{whatsNext.note}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : undefined;

  return (
    <PreviewPaneShell
      title={title}
      onClose={onClose}
      className={className}
      actions={
        <>
          {onTogglePin ? (
            <button
              type="button"
              onClick={onTogglePin}
              className={`inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                pinned
                  ? 'text-[var(--c-info)] bg-state-selected'
                  : 'text-c-text-muted hover:bg-state-hover'
              }`}
              title={pinned ? 'Unpin' : 'Pin for comparison'}
            >
              {pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          ) : null}
          {headerExtra}
          {onOpenFull ? (
            <button
              type="button"
              onClick={onOpenFull}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
              title={openLabel ?? t('common.open', isPolish ? 'Otwórz' : 'Open')}
            >
              <ExternalLink size={13} />
              {openLabel ?? t('common.open', isPolish ? 'Otwórz' : 'Open')}
            </button>
          ) : null}
        </>
      }
      footer={footer}
      embedded={embedded}
    >
      {loading ? (
        <div className="space-y-2 animate-pulse" data-testid="standard-preview-loading">
          <div className={SKELETON_LINE_1} />
          <div className={SKELETON_LINE_2} />
          <div className={SKELETON_LINE_3} />
          <div className={SKELETON_LINE_4} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Blok 2 — karta meta */}
          {meta ? (
            <PreviewMetaCard pills={meta.pills} trailing={meta.trailing}>
              {meta.recommendation ? (
                <div className="mt-2 text-xs text-c-text-muted">{meta.recommendation}</div>
              ) : null}
            </PreviewMetaCard>
          ) : null}

          {/* Blok 3 — Details z ⋮ */}
          {details ? (
            <PreviewDetailsSection
              text={details.text}
              loading={details.loading}
              label={details.label}
              customActions={detailsActions?.length ? detailsActions : undefined}
              // Licznik słów opisuje prozę. Gdy blok niesie WYŁĄCZNIE tabelę
              // właściwości, liczyłby słowa etykiet — dokładnie ten bezsens, co
              // „~30 words" nad listą plików w Sejfie (PILNE-8).
              showWordCount={!(details.properties?.length && !details.text)}
            >
              {details.properties?.length ? (
                <ArtifactPropertiesTable
                  rows={details.properties}
                  propertyLabel={details.propertyLabel ?? 'Property'}
                  valueLabel={details.valueLabel ?? 'Value'}
                />
              ) : null}
            </PreviewDetailsSection>
          ) : null}

          {children}
        </div>
      )}
    </PreviewPaneShell>
  );
};

export default StandardPreview;

/**
 * TemplatesGalleryView — "Biblioteka wzorców" as a GALERIA of thumbnail
 * tiles, alternative to the table view inside `TemplatesTabContent`.
 *
 * Origin: accepted prototype `proto/galeria-szablonow`
 * (`dev-render/screens/proto-galeria-szablonow.tsx`), reviewed by the
 * session supervisor in both themes and shown to the owner (Piotr) — this is
 * the SAME look/behaviour ported to real `TemplateItem[]` data, not a
 * redesign. Gated behind `ff_galeria_szablonow` (default OFF, see
 * `src/utils/templatesGalleryFlag.ts`) — `TemplatesTabContent` only mounts
 * this component when the flag is ON and the user has the toggle set to
 * "Galeria"; the "Tabela" side of the toggle keeps using the real
 * `StandardTable` (canon — no bespoke table lives here).
 *
 * Data honesty (N4 requirement): thumbnails are built from whatever
 * `TemplateItem` actually carries.
 *   - presentation → `slideCount` known → N neutral `SlideSilhouette` tiles
 *     (intent left unmapped on purpose — we don't know the real per-slide
 *     intent, so we never claim a specific layout, only "this many slides").
 *     `slideCount` missing/0 → generic format glyph, no invented slides.
 *   - report       → `sectionCount` known → N neutral sections fed into
 *     `DocumentStructurePreview` (uniform level/length — we don't know the
 *     real hierarchy, so we don't invent one, only "this many sections").
 *     `sectionCount` missing/0 → the component's own built-in empty state.
 *   - sheet         → `TemplateItem` carries NO structural field for sheets
 *     at all today (`mapCanonicalTemplateArtifact` in useRapData.ts never
 *     sets one) → always the fixed `NEUTRAL_SHEET_SILHOUETTE` glyph, which
 *     makes no claim about real column/row/tab counts.
 *
 * Filtry (format + źródło): od DEC-423d (właściciel, 06.09.2026) chipy fasetowe
 * NIE stoją już w tym komponencie — mieszkają w Menu 3 huba
 * (`ReportsAndPresentationsHub`), wspólne dla Galerii i Tabeli. Ten plik
 * eksportuje wyłącznie ich etykiety/kolejność (`TEMPLATE_TYPE_LABEL_PLURAL`,
 * `TEMPLATE_TYPE_ORDER`, `TEMPLATE_SCOPE_ORDER`, `templateScopeLabel`), żeby
 * oba widoki i menu mówiły jednym słownikiem.
 */
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, Eye, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { StructurePreviewSection } from '@/components/DocumentStudio/DocumentStructurePreview';
import { DocumentStructurePreview } from '@/components/DocumentStudio/DocumentStructurePreview';
import { SlideSilhouette } from '@/components/Presentations/SlideSilhouette';
import { MENU_1_PRIMARY_CTA, MENU_3_ACTION_NEUTRAL } from '@/components/shared/ModuleMenu3';
import { NEUTRAL_SHEET_SILHOUETTE, SheetSilhouette } from '@/components/Sheets/SheetSilhouette';
import { cn } from '@/utils/cn';

import {
  TEMPLATE_TYPE_META,
  type TemplateItem,
  type TemplateScope,
  type TemplateType,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Polish plural helper (bloki: sekcje/slajdy) — mirrors the prototype's
// `jednostkaBlokow`, made grammatically exact (n=1 / 2-4 / 5+ with the
// 12-14 exception) since it is cheap and this is user-facing copy.
// ─────────────────────────────────────────────────────────────────────────────

function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

function blockCountLabel(item: TemplateItem): string | null {
  if (item.type === 'report' && typeof item.sectionCount === 'number') {
    return pluralPl(item.sectionCount, 'sekcja', 'sekcje', 'sekcji');
  }
  if (item.type === 'presentation' && typeof item.slideCount === 'number') {
    return pluralPl(item.slideCount, 'slajd', 'slajdy', 'slajdów');
  }
  // sheet, or count unknown for this item → omit the metric instead of
  // fabricating a number (degradacja elegancka).
  return null;
}

/**
 * Etykiety i kolejność faset (format · źródło) Biblioteki wzorców.
 * EKSPORTOWANE, bo od DEC-423d (właściciel, 06.09.2026) pasek tych chipów
 * mieszka w Menu 3 huba (`ReportsAndPresentationsHub`), a nie we własnym
 * rzędzie w treści zakładki. Jedno źródło etykiet dla obu widoków
 * (Galeria/Tabela) — filtr pisze do tego samego `activeFilters`.
 */
export const TEMPLATE_TYPE_LABEL_PLURAL: Record<TemplateType, string> = {
  report: 'Raporty',
  sheet: 'Tabele',
  presentation: 'Prezentacje',
};

export const TEMPLATE_TYPE_ORDER: TemplateType[] = ['report', 'sheet', 'presentation'];
export const TEMPLATE_SCOPE_ORDER: TemplateScope[] = [
  'personal',
  'system',
  'organization',
  'unknown',
];

/**
 * Etykieta zakresu wg kanonu materials.ts (system|organization|personal|unknown).
 * Legacy 'application' zostaje obsłużone dla wpisów sprzed migracji.
 * Pure — bierze `t` z zewnątrz, żeby dało się jej użyć i w hubie (Menu 3),
 * i w treści zakładki (kafle, podgląd), bez dwóch rozjeżdżających się kopii.
 */
export function templateScopeLabel(
  t: TFunction,
  scope: TemplateItem['scope'] | TemplateScope
): string {
  if (scope === 'personal') return t('reports.personal');
  if (scope === 'system' || scope === 'application') return t('reports.application');
  if (scope === 'organization') return t('reports.organization');
  return t('rap.templates.scopeUnknown', 'Nieznany');
}

const TYPE_ICON: Record<TemplateType, LucideIcon> = {
  report: FileText,
  sheet: FileSpreadsheet,
  presentation: Presentation,
};

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail — dispatches by format, degrading elegantly when the structural
// field is missing (see file header).
// ─────────────────────────────────────────────────────────────────────────────

const SLIDE_TILE_CAP = 6;
const SECTION_CAP = 8;
/** Deliberately unmapped in `SlideSilhouette`'s intent table → renders the
 *  neutral "default" kind. Not a real intent, never sent anywhere else. */
const NEUTRAL_SLIDE_INTENT = 'unstructured';

const NeutralFormatGlyph: React.FC<{ icon: LucideIcon }> = ({ icon: Icon }) => (
  <div className="flex h-full w-full items-center justify-center">
    <Icon size={28} className="text-c-text-muted/40" aria-hidden="true" />
  </div>
);

const TemplateThumbnail: React.FC<{ item: TemplateItem }> = ({ item }) => {
  if (item.type === 'presentation') {
    const count = item.slideCount ?? 0;
    if (count <= 0) return <NeutralFormatGlyph icon={Presentation} />;
    const shown = Math.min(count, SLIDE_TILE_CAP);
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="grid w-fit grid-cols-3 gap-2">
          {Array.from({ length: shown }).map((_, i) => (
            <SlideSilhouette key={i} intent={NEUTRAL_SLIDE_INTENT} />
          ))}
        </div>
      </div>
    );
  }
  if (item.type === 'report') {
    const count = item.sectionCount ?? 0;
    const sections: StructurePreviewSection[] = Array.from({
      length: Math.min(count, SECTION_CAP),
    }).map(() => ({ title: '', level: 1, required: false, expectedLengthHint: 'medium' }));
    return (
      <div className="w-full opacity-80">
        <DocumentStructurePreview sections={sections} className="w-full" />
      </div>
    );
  }
  // sheet — no structural field on TemplateItem today; honest neutral glyph
  // (see file header), never a fabricated column/row/tab count.
  return <SheetSilhouette {...NEUTRAL_SHEET_SILHOUETTE} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// Badges — same copy/i18n keys as the table's "title" column render, so the
// same underlying flag reads identically in both views.
// ─────────────────────────────────────────────────────────────────────────────

const OrphanedBadge: React.FC<{ t: TFunction }> = ({ t }) => (
  <span
    data-testid="template-gallery-orphaned-badge"
    title={t(
      'rap.templates.orphanedHint',
      'Brak kanonicznego rekordu wzorca — nie można go użyć do generacji.'
    )}
    className="inline-flex shrink-0 items-center gap-1 rounded-token-xs border border-c-warning/40 bg-c-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-warning"
  >
    <AlertTriangle size={10} />
    {t('rap.templates.orphanedBadge', 'Brak źródła')}
  </span>
);

const LegacyBadge: React.FC<{ t: TFunction }> = ({ t }) => (
  <span
    title={t(
      'rap.templates.legacyHint',
      'Wzorzec ze starego rejestru (report_builder_templates) — generacja bez zmian.'
    )}
    className="shrink-0 rounded-token-xs border border-c-border bg-c-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted"
  >
    {t('rap.templates.legacyBadge', 'Legacy')}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tile — primary "Użyj wzorca" CTA on hover/focus (NOT in a kebab, N-requirement),
// secondary "Podgląd" opens the same StandardPreview the table uses.
// ─────────────────────────────────────────────────────────────────────────────

const TemplateTile: React.FC<{
  item: TemplateItem;
  usePath: string | null;
  scopeLabel: (scope: TemplateItem['scope']) => string;
  onUse: (item: TemplateItem) => void;
  onPreview: (item: TemplateItem) => void;
}> = ({ item, usePath, scopeLabel, onUse, onPreview }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const isDeprecated = String(item.status).toLowerCase() === 'deprecated';
  const disabledUse = !usePath || isDeprecated;
  const meta = TEMPLATE_TYPE_META[item.type];
  const IconFormat = TYPE_ICON[item.type];

  const footerParts: React.ReactNode[] = [
    <span key="format" className="inline-flex items-center gap-1.5 text-c-text-secondary">
      <IconFormat size={12} />
      {isPolish ? meta.labelPl : meta.label}
    </span>,
  ];
  const blockLabel = blockCountLabel(item);
  if (blockLabel)
    footerParts.push(
      <span key="blocks" className="tabular-nums">
        {blockLabel}
      </span>
    );
  footerParts.push(<span key="scope">{scopeLabel(item.scope)}</span>);

  return (
    <article
      data-testid={`template-gallery-tile-${item.id}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-token-lg border border-c-border bg-c-surface transition-shadow duration-100 focus-within:ring-2 focus-within:ring-c-focus',
        !disabledUse && 'cursor-pointer hover:border-c-border-strong hover:shadow-token-card-hover'
      )}
    >
      {/* miniatura: niesie STRUKTURĘ, nie jest szarym prostokątem */}
      <div
        className={cn(
          'relative h-[152px] overflow-hidden border-b border-c-border-subtle bg-c-bg p-3',
          disabledUse && 'opacity-45'
        )}
      >
        <TemplateThumbnail item={item} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-c-bg to-transparent" />
      </div>

      {/* akcja główna na hover/fokus — NIE w kebabie */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[152px] items-center justify-center gap-2 bg-c-surface/95 opacity-0 backdrop-blur-[3px] transition-opacity duration-100 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {disabledUse ? (
          <div className="px-4 text-center">
            <button
              type="button"
              disabled
              data-testid={`template-gallery-use-disabled-${item.id}`}
              className={cn(MENU_3_ACTION_NEUTRAL, 'cursor-not-allowed opacity-70')}
            >
              {t('rap.actions.useTemplate', 'Użyj wzorca')}
            </button>
            <p className="mt-2 text-[11px] leading-4 text-c-text-muted">
              {isDeprecated
                ? t('rap.templates.deprecatedUseBlocked', 'Wycofany wzorzec nie może być użyty.')
                : t(
                    'rap.templates.useBlocked',
                    'Brak kanonicznego rekordu wzorca — nie ma czego użyć.'
                  )}
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              data-testid={`template-gallery-use-${item.id}`}
              className={MENU_1_PRIMARY_CTA}
              onClick={() => onUse(item)}
            >
              <Check size={16} />
              {t('rap.actions.useTemplate', 'Użyj wzorca')}
            </button>
            <button type="button" className={MENU_3_ACTION_NEUTRAL} onClick={() => onPreview(item)}>
              <Eye size={12} />
              {t('rap.preview.open', 'Podgląd')}
            </button>
          </>
        )}
      </div>

      {/* opis */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              'text-sm font-semibold leading-5',
              disabledUse ? 'text-c-text-muted' : 'text-c-text'
            )}
          >
            {item.title}
          </h3>
          {item.orphaned ? (
            <OrphanedBadge t={t} />
          ) : item.source === 'legacy' || item.legacy ? (
            <LegacyBadge t={t} />
          ) : null}
        </div>

        <p className="line-clamp-2 text-xs leading-5 text-c-text-muted">
          {item.description?.trim() || t('common.noDescription', 'No description')}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[11px] text-c-text-muted">
          {footerParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <span className="text-c-border-strong">·</span> : null}
              {part}
            </React.Fragment>
          ))}
        </div>
      </div>
    </article>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export interface TemplatesGalleryViewProps {
  /** Fully filtered (search + activeFilters) — rendered as tiles. */
  templates: TemplateItem[];
  scopeLabel: (scope: TemplateItem['scope']) => string;
  resolveUsePath: (item: TemplateItem) => string | null;
  onUse: (item: TemplateItem) => void;
  onPreview: (item: TemplateItem) => void;
}

export const TemplatesGalleryView: React.FC<TemplatesGalleryViewProps> = ({
  templates,
  scopeLabel,
  resolveUsePath,
  onUse,
  onPreview,
}) => {
  const { t } = useTranslation();

  /* DEC-423d (właściciel, 06.09.2026, zrzut Biblioteki wzorców): „ten cały
     pasek powinien wjechać do menu trzeciego". Rząd chipów format · źródło stał
     TUTAJ — czyli poza kanonem Menu 1/2/3, w treści zakładki, i tylko w widoku
     Galerii, mimo że filtrował oba widoki. Teraz rysuje go Menu 3 huba
     (`ReportsAndPresentationsHub.commandRowLeftSlot`), a filtr pisze do tego
     samego `activeFilters`, więc Galeria i Tabela widzą ten sam wybór. */
  return (
    <div>
      {templates.length === 0 ? (
        <div className="rounded-token-lg border border-dashed border-c-border p-10 text-center text-sm text-c-text-muted">
          {t('rap.templates.galleryEmpty', 'Żaden wzorzec nie pasuje do tych filtrów.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {templates.map((item) => (
            <TemplateTile
              key={item.id}
              item={item}
              usePath={resolveUsePath(item)}
              scopeLabel={scopeLabel}
              onUse={onUse}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplatesGalleryView;

/**
 * AgentWorkshopPalette — PRAWA kolumna warsztatu agenta: paleta klocków.
 *
 * Rola: pokazać WSZYSTKO, co można wstawić do procesu — pogrupowane, z
 * czytelnymi nazwami po polsku, i z jawnie oznaczoną mapą drogową. Pozycje bez
 * implementacji NIE są ukryte (właściciel chce je widzieć), tylko wyszarzone,
 * nieklikalne, z plakietką „Wkrótce" i podpowiedzią CZEGO brakuje
 * (`soonReason` w agentWorkshopCatalog.ts — tam też twarde kryterium
 * active/soon i lista realnych narzędzi z toolDefinitions.ts).
 *
 * Powłoka: reużywa `ArtifactRightPanel` (accordion sekcji, tokeny c-*, fokus
 * c-focus) — grupa katalogu = sekcja panelu, więc paleta dziedziczy wygląd
 * powłoki artefaktu zamiast budować własny kontener. Pole szukania siedzi w
 * slocie `statusBar` (nad sekcjami), bo ma dotyczyć wszystkich grup naraz.
 *
 * Wstawianie klocka — DWIE drogi, obie prowadzą do tego samego `onAdd`:
 *  - klik w pozycję → klocek ląduje na końcu schematu,
 *  - przeciągnięcie (HTML5 drag&drop, `dataTransfer` z id pozycji) → klocek
 *    ląduje w konkretne miejsce między klockami (strefy zrzutu obsługuje
 *    `AgentPlanCanvas`). Bez biblioteki DnD; klik zostaje jako droga w pełni
 *    klawiaturo-dostępna, bo natywne DnD nie ma sensownej obsługi klawiatury.
 *
 * Zero crimson (zakazane rodziny tokenów kolorów marki) — akcent informacyjny
 * = `c-info`, fokus = `c-focus`, reszta neutralna.
 */
import {
  Bot,
  Boxes,
  Clock,
  Database,
  GitBranch,
  Lock,
  type LucideIcon,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArtifactRightPanel } from '@/components/standard/ArtifactRightPanel';

import {
  AGENT_BLOCK_CATALOG,
  type AgentBlockCatalogEntry,
  catalogGroupHintKey,
  catalogGroupLabelKey,
  catalogHintKey,
  catalogLabelKey,
  catalogSoonReasonKey,
  type PlanBlockKind,
} from './agentWorkshopCatalog';

/** Typ MIME przeciąganej pozycji palety — czytany przez strefy zrzutu w canvasie. */
export const PALETTE_DND_MIME = 'application/x-consultify-agent-block';

const GROUP_ICON: Record<string, LucideIcon> = {
  moduly: Boxes,
  ai: Sparkles,
  dane: Database,
  automaty: Wand2,
  kontrola: ShieldCheck,
  integracje: Plug,
};

const KIND_ICON: Record<PlanBlockKind, LucideIcon> = {
  'etap-modul': Boxes,
  'ai-teresa': Sparkles,
  'vault-kontekst': Lock,
  'brama-akceptu': ShieldCheck,
  automat: Wand2,
  informacja: GitBranch,
  pauza: Clock,
};

export interface AgentWorkshopPaletteProps {
  /** Wstawia klocek na koniec schematu (klik) — wołający tworzy `PlanSchemaBlock`. */
  onAdd: (entry: AgentBlockCatalogEntry) => void;
  /** Paleta nie pozwala nic dodać (plan już wystartował). */
  disabled?: boolean;
  /**
   * Szerokość panelu. Domyślnie token `--ntype-right-panel-width` (320 px) —
   * ★ 2026-09-01 (dyżur 164): stało tu 300 px, czyli piąta szerokość prawego
   * pasa w aplikacji. Nie wpisuj liczby.
   */
  width?: number | string;
}

const PaletteItem: React.FC<{
  entry: AgentBlockCatalogEntry;
  disabled: boolean;
  onAdd: (entry: AgentBlockCatalogEntry) => void;
}> = ({ entry, disabled, onAdd }) => {
  const { t } = useTranslation();
  const Icon = KIND_ICON[entry.kind];
  const soon = entry.status === 'soon';
  const blocked = soon || disabled;
  const label = t(catalogLabelKey(entry), entry.label);
  const hint = t(catalogHintKey(entry), entry.hint);

  if (soon) {
    // Wyszarzona pozycja mapy drogowej — świadomie NIE jest <button>: nic nie
    // robi, więc nie udaje kontrolki. `title` niesie powód (soonReason).
    return (
      <div
        title={entry.soonReason ? t(catalogSoonReasonKey(entry), entry.soonReason) : undefined}
        data-testid={`palette-entry-${entry.id}`}
        data-status="soon"
        className="flex items-start gap-2 rounded-lg border border-dashed border-c-border-subtle px-2 py-1.5 opacity-55"
      >
        <Icon size={14} className="mt-0.5 shrink-0 text-c-text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-c-text-muted">{label}</span>
            <span className="shrink-0 rounded-full border border-c-border-subtle px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('agentPlan.catalog.soonBadge', 'Wkrótce')}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-c-text-muted">{hint}</p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      draggable={!blocked}
      data-testid={`palette-entry-${entry.id}`}
      data-status="active"
      onDragStart={(e) => {
        e.dataTransfer.setData(PALETTE_DND_MIME, entry.id);
        e.dataTransfer.setData('text/plain', label);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onAdd(entry)}
      disabled={blocked}
      title={hint}
      className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 px-2 py-1.5 text-left transition-colors hover:border-c-info/50 hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
    >
      <Icon size={14} className="mt-0.5 shrink-0 text-c-text-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-c-text">{label}</span>
          {entry.approval ? (
            <span className="shrink-0 rounded-full border border-c-warning/40 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-c-warning">
              {t('agentPlan.catalog.approvalBadge', 'zgoda')}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-c-text-muted">{hint}</p>
      </div>
    </button>
  );
};

export const AgentWorkshopPalette: React.FC<AgentWorkshopPaletteProps> = ({
  onAdd,
  disabled = false,
  width = 'var(--ntype-right-panel-width)',
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AGENT_BLOCK_CATALOG;
    return AGENT_BLOCK_CATALOG.map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => {
        const label = t(catalogLabelKey(entry), entry.label).toLowerCase();
        const hint = t(catalogHintKey(entry), entry.hint).toLowerCase();
        return (
          label.includes(q) ||
          hint.includes(q) ||
          entry.label.toLowerCase().includes(q) ||
          entry.hint.toLowerCase().includes(q) ||
          (entry.module ?? '').toLowerCase().includes(q)
        );
      }),
    })).filter((group) => group.entries.length > 0);
  }, [query, t]);

  const sections = groups.map((group) => ({
    id: `palette-${group.id}`,
    label: t(catalogGroupLabelKey(group), group.label),
    icon: GROUP_ICON[group.id],
    badge: group.entries.length,
    // D-104 (2026-08-30) — owner note on ?screen=agent-plan-canvas: "ikony w
    // poszczególnych oknach powinny startować zwinięte, bo przerażają swoją
    // ilością". Root cause: `moduly`/`kontrola` were force-opened here, so
    // the palette landed on screen already showing all 11 `moduly` rows —
    // each rendering the SAME icon (Boxes, one per `etap-modul` entry, see
    // KIND_ICON above) — a wall of 11 identical glyphs before the user did
    // anything. The icons themselves are fine (a shared category icon is the
    // right call); the defect was showing all of them unprompted. Every
    // group now starts collapsed like the rest of the accordion — the header
    // badge (entry count) still tells you whether it's worth opening — and a
    // search hit still force-opens its matching group(s), unchanged.
    defaultOpen: query.trim().length > 0,
    children: (
      <div className="space-y-1.5">
        <p className="text-[10px] text-c-text-muted">
          {t(catalogGroupHintKey(group), group.hint)}
        </p>
        {group.entries.map((entry) => (
          <PaletteItem key={entry.id} entry={entry} disabled={disabled} onAdd={onAdd} />
        ))}
      </div>
    ),
  }));

  return (
    <ArtifactRightPanel
      ariaLabel="Paleta klocków agenta"
      width={width}
      className="agent-workshop-palette"
      statusBar={
        <div className="space-y-2" data-testid="agent-palette-header">
          <div className="flex items-center gap-2">
            <Bot size={14} className="shrink-0 text-c-text-muted" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              Paleta klocków
            </span>
          </div>
          <label className="relative block">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj klocka…"
              aria-label="Szukaj klocka w palecie"
              className="h-8 w-full rounded-full border border-c-border-subtle bg-c-surface-raised/40 pl-8 pr-3 text-xs text-c-text placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            />
          </label>
          <p className="text-[10px] text-c-text-muted">
            {disabled
              ? 'Plan już wystartował — schemat jest zamrożony.'
              : 'Kliknij, żeby dodać na koniec. Przeciągnij, żeby wstawić w wybrane miejsce.'}
          </p>
        </div>
      }
      sections={
        sections.length > 0
          ? sections
          : [
              {
                id: 'palette-empty',
                label: 'Brak wyników',
                collapsible: false,
                children: (
                  <p className="py-1.5 text-xs text-c-text-muted">
                    Żaden klocek nie pasuje do „{query}".
                  </p>
                ),
              },
            ]
      }
    />
  );
};

export default AgentWorkshopPalette;

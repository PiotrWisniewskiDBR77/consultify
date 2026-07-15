/**
 * ArtifactRightPanel — wspólny prawy panel artefaktu (accordion sekcji).
 *
 * SSOT: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2 / §11.2 (SPEC-A).
 * Powłoka wspólna dla WSZYSTKICH 5 archetypów (A Canvas · B Dokument · C Rekord
 * · D Matryca · E Deck) — to jest dla ARTEFAKTU tym, czym StandardPreview dla LISTY.
 *
 * Sekcje w STAŁEJ kolejności (moduł deklaruje treść, komponent narzuca wygląd):
 *   Akcje · Właściwości · Powiązania · Komentarze · Historia/AI.
 *
 * Zasady (jak StandardTable/StandardPreview):
 *  - Moduł podaje `sections` (id + label + treść). Wygląd (nagłówek h-11 L1 +
 *    chevron, ramki, tło, collapse) narzuca ten komponent.
 *  - Wyłącznie tokeny `c-*` (zero navy/slate/hex, zero crimson). Fokus = c-focus.
 *  - Treść sekcji budujemy z prymitywów `shared/PreviewPane/*`
 *    (PreviewActionBar/PreviewRelations/PreviewActivityStrip/PreviewAIHintStrip…) —
 *    ten komponent jest tylko kontenerem-accordion, nie renderuje treści sam.
 *  - Brak Headless UI w projekcie → własny collapsible (useState).
 */
import { ChevronDown, type LucideIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface ArtifactRightPanelSection {
  /** Stabilny id sekcji (np. 'actions' | 'properties' | 'relations' | 'comments' | 'history'). */
  id: string;
  /** Etykieta nagłówka (już przetłumaczona przez wywołującego). Renderowana jako L1 UPPERCASE. */
  label: string;
  /** Ikona typu sekcji (opcjonalnie, 14px, c-text-muted). */
  icon?: LucideIcon;
  /** Treść sekcji (zwykle złożona z prymitywów PreviewPane). Renderowana gdy sekcja otwarta. */
  children: React.ReactNode;
  /** Czy sekcja jest zwijalna (default true). false = zawsze otwarta, bez chevronu. */
  collapsible?: boolean;
  /** Stan początkowy (default true = otwarta). */
  defaultOpen?: boolean;
  /** Licznik przy nagłówku (np. liczba komentarzy). 0/undefined = brak. */
  badge?: number;
  /** Gdy true — sekcja pokazuje stan pusty zamiast treści. */
  isEmpty?: boolean;
  /** Tekst stanu pustego (gdy isEmpty). */
  emptyLabel?: string;
}

export interface ArtifactRightPanelProps {
  /** Sekcje w kolejności deklaracji (kanon: Akcje·Właściwości·Powiązania·Komentarze·Historia/AI). */
  sections: ArtifactRightPanelSection[];
  /** Szerokość panelu w px (default 360; kanon §11.2 zakres 320–420). */
  width?: number;
  /** Dodatkowa klasa kontenera. */
  className?: string;
  /** Aria-label kontenera (a11y). */
  ariaLabel?: string;
  /**
   * HP-8 (Harvey-Parity workflow engine): opcjonalny slot NAD sekcjami dla
   * paska stanu draft/review/approved (np. `ArtifactApprovalStatusBar`,
   * src/components/standard/ArtifactApprovalStatusBar.tsx). Czysto addytywne
   * — gdy nieustawione (domyślnie wszędzie dziś), panel renderuje się 1:1
   * jak wcześniej. Wołający decyduje KIEDY go pokazać (typowo za flagą
   * `artifactApprovalUi`, patrz src/utils/artifactApprovalUiFlag.ts) —
   * wygląd/dobór miejsca to praca Vegas po akceptacji zrzutów (DoD §18.1),
   * ten prop tylko udostępnia miejsce w powłoce.
   */
  statusBar?: React.ReactNode;
}

const SectionRow: React.FC<{
  section: ArtifactRightPanelSection;
  open: boolean;
  onToggle: () => void;
}> = ({ section, open, onToggle }) => {
  const { label, icon: Icon, children, collapsible = true, badge, isEmpty, emptyLabel } = section;
  const showBadge = typeof badge === 'number' && badge > 0;

  const header = (
    <div className="flex items-center gap-2 min-w-0">
      {Icon ? <Icon size={14} className="shrink-0 text-c-text-muted" /> : null}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted truncate">
        {label}
      </span>
      {showBadge ? (
        <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold tabular-nums text-c-text-muted bg-c-surface-raised">
          {badge}
        </span>
      ) : null}
    </div>
  );

  const body = (
    <div className="px-4 pb-4 pt-1">
      {isEmpty ? (
        <p className="text-xs italic text-c-text-muted py-1.5">{emptyLabel ?? '—'}</p>
      ) : (
        children
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <section className="border-b border-c-border-subtle last:border-b-0">
        <div className="flex items-center h-11 px-4">{header}</div>
        {body}
      </section>
    );
  }

  return (
    <section className="border-b border-c-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 h-11 px-4 transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-inset"
      >
        {header}
        <ChevronDown
          size={16}
          className={`shrink-0 text-c-text-muted transition-transform duration-200 ${open ? '' : '-rotate-90'} motion-reduce:transition-none`}
        />
      </button>
      {open ? body : null}
    </section>
  );
};

export const ArtifactRightPanel: React.FC<ArtifactRightPanelProps> = ({
  sections,
  width = 360,
  className,
  ariaLabel,
  statusBar,
}) => {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(sections.filter((s) => s.defaultOpen ?? true).map((s) => s.id))
  );

  // Fix (fotograf HP-4): gdy wołający podmienia CAŁY zestaw sekcji między
  // renderami bez remountu (np. AgentPlanPanel: placeholder {id:'loading'} ->
  // {plan, progress, approvals, report} po dociągnięciu danych), `openIds`
  // liczone raz w leniwym inicjalizatorze useState zostawało z id, które już
  // nie istnieją, a nowe id (nawet defaultOpen) startowały jako domknięte.
  // Ten efekt dogania: gdy w sections pojawi się id nieobecne poprzednio,
  // dopisuje je do openIds (jeśli defaultOpen), NIE ruszając id ręcznie
  // zwiniętych/rozwiniętych przez usera. Dla konsumentów ze stałym zestawem
  // id (Insight/Decision/Task — sections budowane ze stałej listy kluczy)
  // zbiór id nigdy się nie zmienia między renderami, więc efekt nic nie robi.
  const sectionIdSetRef = useRef<Set<string>>(new Set(sections.map((s) => s.id)));

  useEffect(() => {
    const prevIds = sectionIdSetRef.current;
    const newlyAppeared = sections.filter((s) => !prevIds.has(s.id));
    if (newlyAppeared.length > 0) {
      const toOpen = newlyAppeared.filter((s) => s.defaultOpen ?? true);
      if (toOpen.length > 0) {
        setOpenIds((prev) => {
          const next = new Set(prev);
          let changed = false;
          toOpen.forEach((s) => {
            if (!next.has(s.id)) {
              next.add(s.id);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }
    sectionIdSetRef.current = new Set(sections.map((s) => s.id));
  }, [sections]);

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <aside
      aria-label={ariaLabel ?? 'Artifact details'}
      style={{ width, minWidth: width }}
      className={`shrink-0 h-full overflow-y-auto bg-c-surface border-l border-c-border-subtle ${className ?? ''}`}
    >
      {statusBar ? (
        <div className="border-b border-c-border-subtle px-4 py-3">{statusBar}</div>
      ) : null}
      {sections.map((section) => (
        <SectionRow
          key={section.id}
          section={section}
          open={(section.collapsible ?? true) ? openIds.has(section.id) : true}
          onToggle={() => toggle(section.id)}
        />
      ))}
    </aside>
  );
};

export default ArtifactRightPanel;

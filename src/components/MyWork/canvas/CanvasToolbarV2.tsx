/**
 * CanvasToolbarV2 — lightweight canvas toolbar (Piotr's L→R spec).
 *
 * Source of truth: Harvard/wdrozenie-100/_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md
 * wpisy #87-#87d (systematyczny przegląd toolbara canvas L→R).
 *
 * Canonical layout (nota nadzorcy #87c):
 *   [+] New Canvas (czysty na górze + template'y) │
 *   STREFA 1: dokumenty [Prezentacja/Raport/Excel] │
 *   STREFA 2: idea+notatka [Mind Map/Process Flow/Whiteboard/Tabela/Notatka] │
 *   import-MD · export-MD · widok(MD↔dokument) · X │
 *   [⋯] kebab (odchudzony — tylko power-user, zero duplikatów z paskiem)
 *
 * Removed vs. the legacy toolbar (`WorkCanvasDocumentPanel`), per Piotr:
 *   - "Promote" strip (#87b — "nie wiem po co jest")
 *   - Task / Decision / Initiative shortcuts (#87b — nie na poziomie canvas)
 *   - Version History icon button (#87c — "Historia do niczego niepotrzebna";
 *     power-user history stays reachable from the kebab only, not the bar)
 *
 * This component is pure/presentational — it owns no canvas state. The
 * caller wires every action to the real handlers that already exist in
 * `WorkCanvasDocumentPanel` (runOutputAction/runWorkspaceAction/
 * exportDocument/setMode/selectTemplate/close). Zone items carry an optional
 * `capability` badge ('real' | 'partial' | 'soon') so the toolbar stays
 * honest about what is backend-wired today vs. still a gap (doctrine:
 * REAL/PARTIAL badges, never silently fake a working button).
 *
 * Density doctrine (docs/ui-standards/DOKTRYNA_GESTOSCI.md): zones are
 * visually grouped ("jeden dom" per zone) rather than 13 loose icons; the
 * kebab only ever renders items with a real handler (no dead entries).
 */

import {
  ChevronDown,
  Download,
  FileText,
  GitBranch,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Presentation,
  StickyNote,
  Table,
  Table2,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import React from 'react';

export type CanvasToolbarV2Capability = 'real' | 'partial' | 'soon';
export type CanvasToolbarV2View = 'document' | 'markdown';

export interface CanvasToolbarV2Template {
  id: string;
  label: string;
  description?: string;
  capability?: CanvasToolbarV2Capability;
}

export interface CanvasToolbarV2ZoneItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  capability?: CanvasToolbarV2Capability;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
}

export interface CanvasToolbarV2KebabItem {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface CanvasToolbarV2Props {
  /** "+" menu: blank canvas first, templates below (Piotr #87). */
  onNewCanvasBlank: () => void;
  templates: CanvasToolbarV2Template[];
  onSelectTemplate: (templateId: string) => void;
  activeTemplateId?: string | null;

  /** STREFA 1 — Prezentacja / Raport / Excel (#87a). */
  documentActions: CanvasToolbarV2ZoneItem[];

  /** STREFA 2 — Mind Map / Process Flow / Whiteboard / Tabela / Notatka (#87b). */
  ideaActions: CanvasToolbarV2ZoneItem[];

  /** File ops (#87c). onImportMarkdown omitted → button renders disabled/soon. */
  onImportMarkdown?: () => void;
  onExportMarkdown: () => void;
  view: CanvasToolbarV2View;
  onToggleView: (next: CanvasToolbarV2View) => void;
  onClose: () => void;

  /** Kebab — power-user only, zero duplication with the bar (#87d). */
  kebabItems?: CanvasToolbarV2KebabItem[];

  className?: string;
  /** Test id root override, defaults to 'canvas-toolbar-v2'. */
  testId?: string;
  /**
   * When true, renders without its own height/border/background/padding —
   * for embedding inline as a flex sibling inside a host header row that
   * already supplies that chrome (e.g. WorkCanvasDocumentPanel's 42px
   * title+controls row). Defaults to false (standalone full bar, used by
   * the dev-render harness and any future full-row replacement).
   */
  bare?: boolean;
}

const iconButtonBase =
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

const zoneWrapClass =
  'flex items-center gap-0.5 rounded-full border border-c-border bg-c-surface px-1 py-0.5';

function CapabilityDot({ capability }: { capability?: CanvasToolbarV2Capability }) {
  if (!capability || capability === 'real') return null;
  const color = capability === 'partial' ? 'bg-c-info' : 'bg-c-text-muted';
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ${color}`}
    />
  );
}

function ZoneButton({ item }: { item: CanvasToolbarV2ZoneItem }) {
  const Icon = item.icon;
  const title =
    item.capability && item.capability !== 'real'
      ? `${item.label} (${item.capability === 'partial' ? 'częściowo' : 'wkrótce'})`
      : item.label;
  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={item.disabled || !item.onClick}
      aria-label={item.label}
      title={title}
      data-testid={`canvas-toolbar-v2-zone-item-${item.id}`}
      className={`relative ${iconButtonBase}`}
    >
      {item.busy ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-c-border-strong border-t-c-text" />
      ) : (
        <Icon size={15} />
      )}
      <CapabilityDot capability={item.capability} />
    </button>
  );
}

export function CanvasToolbarV2({
  onNewCanvasBlank,
  templates,
  onSelectTemplate,
  activeTemplateId,
  documentActions,
  ideaActions,
  onImportMarkdown,
  onExportMarkdown,
  view,
  onToggleView,
  onClose,
  kebabItems = [],
  className,
  testId = 'canvas-toolbar-v2',
  bare = false,
}: CanvasToolbarV2Props) {
  const [isNewMenuOpen, setIsNewMenuOpen] = React.useState(false);
  const [isKebabOpen, setIsKebabOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsNewMenuOpen(false);
        setIsKebabOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid={testId}
      className={
        bare
          ? `flex items-center gap-1.5 ${className || ''}`
          : `flex h-10 shrink-0 items-center gap-1.5 border-b border-c-border-subtle bg-c-surface px-3 ${className || ''}`
      }
    >
      {/* [+] New Canvas — blank on top, templates below (#87). */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsNewMenuOpen((open) => !open);
            setIsKebabOpen(false);
          }}
          aria-label="New Canvas"
          aria-expanded={isNewMenuOpen}
          title="New Canvas"
          data-testid="canvas-toolbar-v2-new"
          className={iconButtonBase}
        >
          <Plus size={16} />
        </button>
        {isNewMenuOpen ? (
          <div
            className="absolute left-0 z-dropdown mt-2 w-[260px] rounded-2xl border border-c-border bg-c-surface p-2 text-xs shadow-lg"
            data-testid="canvas-toolbar-v2-new-menu"
          >
            <button
              type="button"
              onClick={() => {
                setIsNewMenuOpen(false);
                onNewCanvasBlank();
              }}
              data-testid="canvas-toolbar-v2-new-blank"
              className="w-full rounded-xl px-2.5 py-2 text-left font-semibold text-c-text transition-colors hover:bg-c-surface-raised"
            >
              Czysty canvas
            </button>
            {templates.length > 0 ? (
              <>
                <div className="mx-1 my-1.5 h-px bg-c-border-subtle" />
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                  Z template'u
                </div>
                <div className="space-y-0.5">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setIsNewMenuOpen(false);
                        onSelectTemplate(template.id);
                      }}
                      data-testid={`canvas-toolbar-v2-template-${template.id}`}
                      className={`w-full rounded-xl px-2.5 py-1.5 text-left transition-colors ${
                        activeTemplateId === template.id
                          ? 'bg-c-surface-raised text-c-text'
                          : 'text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{template.label}</span>
                        {template.capability && template.capability !== 'real' ? (
                          <span className="rounded-full bg-c-info/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-c-info">
                            {template.capability === 'partial' ? 'partial' : 'soon'}
                          </span>
                        ) : null}
                      </div>
                      {template.description ? (
                        <div className="mt-0.5 text-[11px] text-c-text-muted">
                          {template.description}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="h-5 w-px bg-c-border-subtle" />

      {/* STREFA 1 — dokumenty: Prezentacja / Raport / Excel (#87a). */}
      <div className={zoneWrapClass} data-testid="canvas-toolbar-v2-zone-documents">
        {documentActions.map((item) => (
          <ZoneButton key={item.id} item={item} />
        ))}
      </div>

      {/* STREFA 2 — idea + notatka: Mind Map / Process Flow / Whiteboard / Tabela / Notatka (#87b). */}
      <div className={zoneWrapClass} data-testid="canvas-toolbar-v2-zone-idea">
        {ideaActions.map((item) => (
          <ZoneButton key={item.id} item={item} />
        ))}
      </div>

      <div className="flex-1" />

      {/* File ops — import/export MD, widok, X (#87c). */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onImportMarkdown}
          disabled={!onImportMarkdown}
          aria-label="Import Markdown"
          title={onImportMarkdown ? 'Import Markdown' : 'Import Markdown (wkrótce)'}
          data-testid="canvas-toolbar-v2-import-md"
          className={iconButtonBase}
        >
          <Upload size={15} />
        </button>
        <button
          type="button"
          onClick={onExportMarkdown}
          aria-label="Export Markdown"
          title="Export Markdown"
          data-testid="canvas-toolbar-v2-export-md"
          className={iconButtonBase}
        >
          <Download size={15} />
        </button>
        <button
          type="button"
          onClick={() => onToggleView(view === 'document' ? 'markdown' : 'document')}
          aria-label="Przełącz widok MD / dokument"
          title={view === 'document' ? 'Widok: dokument (kliknij → MD)' : 'Widok: MD (kliknij → dokument)'}
          data-testid="canvas-toolbar-v2-view-toggle"
          className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <FileText size={14} />
          {view === 'document' ? 'Dok' : 'MD'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij canvas"
          title="Zamknij"
          data-testid="canvas-toolbar-v2-close"
          className={iconButtonBase}
        >
          <X size={15} />
        </button>
      </div>

      <div className="h-5 w-px bg-c-border-subtle" />

      {/* Kebab — power-user only, zero duplikatów z paskiem (#87d). */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsKebabOpen((open) => !open);
            setIsNewMenuOpen(false);
          }}
          aria-label="Więcej"
          aria-expanded={isKebabOpen}
          title="Więcej"
          data-testid="canvas-toolbar-v2-kebab"
          className={iconButtonBase}
        >
          <MoreHorizontal size={15} />
        </button>
        {isKebabOpen && kebabItems.length > 0 ? (
          <div
            className="absolute right-0 z-dropdown mt-2 w-[220px] rounded-2xl border border-c-border bg-c-surface p-1.5 text-xs shadow-lg"
            data-testid="canvas-toolbar-v2-kebab-menu"
          >
            {kebabItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setIsKebabOpen(false);
                  item.onClick();
                }}
                disabled={item.disabled}
                data-testid={`canvas-toolbar-v2-kebab-item-${item.id}`}
                className="w-full rounded-xl px-2.5 py-1.5 text-left font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CanvasToolbarV2;

// ---------------------------------------------------------------------------
// Icon presets — canonical mapping for the three zones, reused by both the
// real wiring (WorkCanvasDocumentPanel) and the dev-render harness so the
// icon choice stays in one place.
// ---------------------------------------------------------------------------
export const CANVAS_TOOLBAR_V2_ICONS = {
  presentation: Presentation,
  report: FileText,
  excel: Table2,
  mindMap: GitBranch,
  processFlow: Workflow,
  whiteboard: LayoutGrid,
  ideaTable: Table,
  note: StickyNote,
  chevronDown: ChevronDown,
} as const;

/**
 * Triada Standard — JEDYNE komponenty Menu / Tabela / Preview dla list encji.
 *
 * SSOT: Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md (+ aneksy #2-#5)
 * + żywy ekran My Work Tasks/Decisions. Moduły używają WYŁĄCZNIE tych fasad;
 * własny chrome / własne tabele / własne preview = błąd implementacji.
 */
export {
  StandardModuleBar,
  type StandardModuleBarProps,
  type StandardBreadcrumb,
  type StandardModuleTab,
  type StandardCounterChip,
  type StandardBulkAction,
  type StandardBulkState,
  type StandardPrimaryCta,
} from './StandardModuleBar';
export {
  StandardTable,
  type StandardTableProps,
  type StandardTableEmpty,
  type StandardTableSelection,
  type StandardRowMenu,
  type StandardRowMenuAction,
  type TableColumn,
  type TableRow,
  type RowAction,
  type RowActionSection,
} from './StandardTable';
export {
  StandardPreview,
  standardPreviewShortcuts,
  type StandardPreviewProps,
  type StandardPreviewAction,
  type StandardPreviewActions,
  type StandardPreviewMeta,
  type StandardPreviewDetails,
  type MetaPill,
  type RelationItem,
} from './StandardPreview';
export {
  StandardKanban,
  type StandardKanbanProps,
  type StandardKanbanColumn,
  type StandardKanbanUrgency,
} from './StandardKanban';
export {
  // Komponent karty (wartość) + model danych `StandardKanbanCard` (typ) — JEDEN
  // kanon karty kanban (#75b). Nazwa dzielona: wartość=komponent, typ=dane.
  StandardKanbanCard,
  type StandardKanbanCardProps,
  type StandardKanbanChip,
} from './StandardKanbanCard';
export {
  // Komponent karty (wartość) + model danych `StandardGridCard` (typ) — JEDEN
  // kanon karty grid/kafelkowego (#76a). Nazwa dzielona: wartość=komponent,
  // typ=dane.
  StandardGridCard,
  type StandardGridCardProps,
  type StandardGridCardChip,
  type StandardGridCardMetric,
  type StandardGridCardUrgency,
} from './StandardGridCard';

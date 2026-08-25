/**
 * Triada Standard — JEDYNE komponenty Menu / Tabela / Preview dla list encji.
 *
 * SSOT: Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md (+ aneksy #2-#5)
 * + żywy ekran My Work Tasks/Decisions. Moduły używają WYŁĄCZNIE tych fasad;
 * własny chrome / własne tabele / własne preview = błąd implementacji.
 */
export {
  // Komponent karty (wartość) + model danych `StandardGridCard` (typ) — JEDEN
  // kanon karty grid/kafelkowego (#76a). Nazwa dzielona: wartość=komponent,
  // typ=dane.
  StandardGridCard,
  type StandardGridCardChip,
  type StandardGridCardMetric,
  type StandardGridCardProps,
  type StandardGridCardUrgency,
} from './StandardGridCard';
export {
  StandardKanban,
  type StandardKanbanColumn,
  type StandardKanbanProps,
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
  type StandardBreadcrumb,
  type StandardBulkAction,
  type StandardBulkState,
  type StandardCounterChip,
  StandardModuleBar,
  type StandardModuleBarProps,
  type StandardModuleTab,
  type StandardPrimaryCta,
} from './StandardModuleBar';
export {
  type MetaPill,
  type RelationItem,
  StandardPreview,
  type StandardPreviewAction,
  type StandardPreviewActions,
  type StandardPreviewDetails,
  type StandardPreviewMeta,
  type StandardPreviewProps,
  standardPreviewShortcuts,
} from './StandardPreview';
export {
  type RowAction,
  type RowActionSection,
  rowMenuToSections,
  type StandardRowMenu,
  type StandardRowMenuAction,
  StandardTable,
  type StandardTableEmpty,
  type StandardTableProps,
  type StandardTableSelection,
  type TableColumn,
  type TableRow,
} from './StandardTable';

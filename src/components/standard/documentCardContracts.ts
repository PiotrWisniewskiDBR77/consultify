import type { LucideIcon } from 'lucide-react';
import { BarChart3, CalendarRange, CheckSquare, FileText, Gauge, GitBranch, ListOrdered, Sparkles, Table2, Users } from 'lucide-react';

import type { ArtifactPanelSectionId } from './ArtifactRightPanel';

export interface DocumentCardSectionContract {
  readonly id: string;
  readonly label: { readonly pl: string; readonly en: string };
  readonly icon: LucideIcon;
  readonly iconName: string;
  readonly aiReason: string;
}

export const PLAN_CARD_CONTRACT = [
  { id: 'horizon', label: { pl: 'Horyzont', en: 'Horizon' }, icon: CalendarRange, iconName: 'Calendar', aiReason: 'Horyzont jest edytowany przez człowieka w generatorze.' },
  { id: 'scope', label: { pl: 'Zakres inicjatyw', en: 'Initiative scope' }, icon: CheckSquare, iconName: 'CheckSquare', aiReason: 'Zakres wybiera człowiek.' },
  { id: 'windows', label: { pl: 'Kolejność i okna', en: 'Sequence and windows' }, icon: ListOrdered, iconName: 'ListOrdered', aiReason: 'Propozycję tworzy istniejący solver planu.' },
  { id: 'dependencies', label: { pl: 'Zależności i konflikty', en: 'Dependencies and conflicts' }, icon: GitBranch, iconName: 'GitBranch', aiReason: 'Konflikty są wynikiem deterministycznego solvera.' },
  { id: 'capacity', label: { pl: 'Obciążenie ról', en: 'Role load' }, icon: Users, iconName: 'Users', aiReason: 'Podaż jest ręczna i pochodzi z analizy obciążenia.' },
  { id: 'decisions', label: { pl: 'Decyzje', en: 'Decisions' }, icon: BarChart3, iconName: 'BarChart3', aiReason: 'Decyzję publikacji podejmuje człowiek.' },
] as const satisfies readonly DocumentCardSectionContract[];

export const CAPACITY_ANALYSIS_CARD_CONTRACT = [
  { id: 'source', label: { pl: 'Plan źródłowy', en: 'Source plan' }, icon: CheckSquare, iconName: 'CheckSquare', aiReason: 'Źródłem jest opublikowany plan.' },
  { id: 'worksheet', label: { pl: 'Arkusz obciążenia', en: 'Load worksheet' }, icon: Table2, iconName: 'Table2', aiReason: 'Arkusz pokazuje zapisane dane.' },
  { id: 'pressure', label: { pl: 'Luki i presja', en: 'Gaps and pressure' }, icon: Gauge, iconName: 'Gauge', aiReason: 'Luki liczy ta sama reguła co doradca.' },
  { id: 'proposals', label: { pl: 'Propozycje zmian', en: 'Change proposals' }, icon: Sparkles, iconName: 'Sparkles', aiReason: 'Propozycje tworzy istniejący capacityOptionsAdvisor.' },
  { id: 'decisions', label: { pl: 'Decyzje', en: 'Decisions' }, icon: BarChart3, iconName: 'BarChart3', aiReason: 'Decyzję podejmuje człowiek.' },
] as const satisfies readonly DocumentCardSectionContract[];

export const EXECUTION_REPORT_CARD_CONTRACT = [
  { id: 'metrics', label: { pl: 'Mierniki', en: 'Metrics' }, icon: BarChart3, iconName: 'BarChart3', aiReason: 'Mierniki są zamrożoną migawką raportu.' },
  { id: 'content', label: { pl: 'Treść raportu', en: 'Report content' }, icon: FileText, iconName: 'FileText', aiReason: 'Treść pochodzi z opublikowanej migawki raportu.' },
] as const satisfies readonly DocumentCardSectionContract[];

export const MANAGEMENT_REPORT_CARD_CONTRACT = [
  { id: 'report', label: { pl: 'Raport', en: 'Report' }, icon: FileText, iconName: 'FileText', aiReason: 'Raport jest wynikiem istniejącego generatora zarządczego.' },
] as const satisfies readonly DocumentCardSectionContract[];

// --- P14-B: rodzina DocumentCardNFrame (presentation/report-builder/template-architect-*/finance-statement-pack) ---
//
// P14-A i P14-B stworzyły ten plik niezależnie (konflikt add/add przy scaleniu
// [ODMROZENIE 11_MATERIALS DEC-432]). Obie części zostają — obsługują dwie różne
// rodziny kart: P14-A (wyżej) karmi `DocumentCardMenu5`/`StandardArtifactShell`
// (ikona + `aiReason` na sekcję), P14-B (niżej) karmi `DocumentCardNFrame`
// (podział main/right + poziom `ai`). Kształty kontraktu różnią się celowo —
// żadna strona nie jest nadmiarowa — więc nazwa `DocumentCardSectionContract`
// z P14-A zostaje bez zmian, a wewnętrzny typ P14-B (nigdzie indziej nie
// importowany po nazwie) jest przemianowany na `DocumentCardNFrameSectionContract`,
// żeby uniknąć podwójnej deklaracji tej samej nazwy w jednym pliku.

export type DocumentCardNType =
  | 'presentation'
  | 'report-builder'
  | 'template-architect-doc'
  | 'template-architect-deck'
  | 'finance-statement-pack';

export interface DocumentCardNFrameSectionContract {
  id: string;
  label: { pl: string; en: string };
  column: 'main' | 'right';
  ai: 'writes' | 'assists' | 'read-only';
}

const RIGHT_PANEL: DocumentCardNFrameSectionContract[] = (
  ['actions', 'properties', 'relations', 'evidence', 'comments', 'history'] as const
).map((id: ArtifactPanelSectionId) => ({
  id,
  label: {
    actions: { pl: 'Akcje', en: 'Actions' },
    properties: { pl: 'Właściwości', en: 'Properties' },
    relations: { pl: 'Powiązania', en: 'Relations' },
    evidence: { pl: 'Źródła i założenia', en: 'Sources and assumptions' },
    results: { pl: 'Rezultaty', en: 'Results' },
    comments: { pl: 'Komentarze', en: 'Comments' },
    history: { pl: 'Historia', en: 'History' },
  }[id],
  column: 'right',
  ai: 'read-only',
}));

const contract = (
  main: Array<Omit<DocumentCardNFrameSectionContract, 'column'>>
): DocumentCardNFrameSectionContract[] => [
  ...main.map((section) => ({ ...section, column: 'main' as const })),
  ...RIGHT_PANEL,
];

/**
 * K1/K2/K24 SSOT for P14-B. Consumers derive the visible section picker and
 * the right-panel order from this catalogue; they must not repeat labels.
 */
export const DOCUMENT_CARD_CONTRACTS: Record<DocumentCardNType, DocumentCardNFrameSectionContract[]> = {
  presentation: contract([
    { id: 'slides', label: { pl: 'Slajdy', en: 'Slides' }, ai: 'writes' },
    { id: 'speaker-notes', label: { pl: 'Notatki prelegenta', en: 'Speaker notes' }, ai: 'writes' },
  ]),
  'report-builder': contract([
    { id: 'report-content', label: { pl: 'Treść raportu', en: 'Report content' }, ai: 'writes' },
    { id: 'report-review', label: { pl: 'Przegląd', en: 'Review' }, ai: 'assists' },
  ]),
  'template-architect-doc': contract([
    { id: 'definition', label: { pl: 'Definicja wzorca', en: 'Template definition' }, ai: 'writes' },
    { id: 'structure', label: { pl: 'Struktura dokumentu', en: 'Document structure' }, ai: 'assists' },
  ]),
  'template-architect-deck': contract([
    { id: 'definition', label: { pl: 'Definicja wzorca', en: 'Template definition' }, ai: 'writes' },
    { id: 'structure', label: { pl: 'Struktura prezentacji', en: 'Deck structure' }, ai: 'assists' },
  ]),
  'finance-statement-pack': contract([
    { id: 'statements', label: { pl: 'Sprawozdania', en: 'Statements' }, ai: 'read-only' },
    { id: 'analysis', label: { pl: 'Analiza', en: 'Analysis' }, ai: 'assists' },
  ]),
};

export const getDocumentCardMainSections = (type: DocumentCardNType) =>
  DOCUMENT_CARD_CONTRACTS[type].filter((section) => section.column === 'main');

export const getDocumentCardRightSections = (type: DocumentCardNType) =>
  DOCUMENT_CARD_CONTRACTS[type].filter((section) => section.column === 'right');

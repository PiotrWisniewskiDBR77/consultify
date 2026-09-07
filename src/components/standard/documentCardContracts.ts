import type { ArtifactPanelSectionId } from './ArtifactRightPanel';

export type DocumentCardNType =
  | 'presentation'
  | 'report-builder'
  | 'template-architect-doc'
  | 'template-architect-deck'
  | 'finance-statement-pack';

export interface DocumentCardSectionContract {
  id: string;
  label: { pl: string; en: string };
  column: 'main' | 'right';
  ai: 'writes' | 'assists' | 'read-only';
}

const RIGHT_PANEL: DocumentCardSectionContract[] = (
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
  main: Array<Omit<DocumentCardSectionContract, 'column'>>
): DocumentCardSectionContract[] => [
  ...main.map((section) => ({ ...section, column: 'main' as const })),
  ...RIGHT_PANEL,
];

/**
 * K1/K2/K24 SSOT for P14-B. Consumers derive the visible section picker and
 * the right-panel order from this catalogue; they must not repeat labels.
 */
export const DOCUMENT_CARD_CONTRACTS: Record<DocumentCardNType, DocumentCardSectionContract[]> = {
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

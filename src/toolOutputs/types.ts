/**
 * Model Outputu narzędzia i dokumentów pochodnych.
 *
 * Zamyka lukę L8: runtime dowoził wyłącznie `initiative`
 * (`src/config/consultingToolsStandard.ts:35`), a Report/Presentation nie
 * istniały. Odbudowa jest zgodna ze wspólnym kontraktem, nie mechanicznym
 * przywróceniem wyciętych, niedziałających wariantów.
 *
 * Zasada nadrzędna: Report i Presentation to DETERMINISTYCZNE renderery tego
 * samego zatwierdzonego Artifactu — nigdy zrzuty ekranu.
 */

/** Status Outputu. Po `approved` rekord jest tylko do odczytu. */
export type ToolOutputStatus = 'draft' | 'in_review' | 'approved' | 'superseded';

/** Rodzaj dokumentu pochodnego. */
export type ToolReportKind = 'report' | 'presentation';

/** Motyw premium. Oba muszą przejść MPQ osobno. */
export type ToolReportTheme = 'executive-paper' | 'executive-night';

/** Typ dowodu — wspólny język evidence w całej domenie. */
export type EvidenceKind = 'fact' | 'observation' | 'hypothesis';

/** Pozycja analizy zaakceptowana w sesji. */
export interface OutputEvidenceItem {
  id: string;
  label: string;
  /** Np. ćwiartka SWOT, siła Portera, aktywność łańcucha wartości. */
  bucket: string;
  evidenceKind: EvidenceKind;
  impact: 'low' | 'medium' | 'high';
}

/** Napięcie/konflikt wyliczone deterministycznie przez silnik metody. */
export interface OutputTension {
  id: string;
  /** Postawa nadana przez silnik, np. attack/repair/defend/protect. */
  posture: string;
  title: string;
  /** Dokładnie dwie pozycje źródłowe — to jest traceability napięcia. */
  sourceItemIds: [string, string];
  /** Waga z silnika (impact-weighted). Nigdy z modelu językowego. */
  priority: number;
}

/**
 * Wniosek w formule K1-K4 (CONCLUSION_LAYER_STANDARD §W2).
 * K1 pochodzi z silnika i NIGDY nie jest redagowany narracyjnie —
 * zmiana K1 wymaga zmiany danych lub obliczeń.
 */
export interface OutputConclusion {
  id: string;
  /** K1 CO JEST — fakt z silnika. */
  k1Fact: string;
  /** K2 CO TO ZNACZY — interpretacja na zamkniętym groundingu. */
  k2Meaning: string;
  /** K3 CO ROBIĆ NAJPIERW — maks. 3 akcje, kolejność z rankingu silnika. */
  k3Actions: string[];
  /** K4 JAKI EFEKT — rezultat z horyzontem czasowym. */
  k4Effect: string;
  /** W2: wybrane / odrzucone / dlaczego. */
  tradeoff: { chosen: string; rejected: string; why: string };
  /** Napięcia, z których wniosek wynika — lineage do dowodów. */
  sourceTensionIds: string[];
}

/** Niezmienny snapshot zatwierdzonej wersji sesji. */
export interface ToolOutput {
  id: string;
  organizationId: string;
  toolSessionId: string;
  toolType: string;
  methodPackVersion: string;

  version: number;
  /** Poprzednia rewizja; poprawka nigdy nie nadpisuje zatwierdzonego snapshotu. */
  supersedesId?: string;

  title: string;
  status: ToolOutputStatus;

  items: OutputEvidenceItem[];
  tensions: OutputTension[];
  conclusions: OutputConclusion[];

  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  contentHash: string;
}

// --- model dokumentu (wejście renderera, nie obrazek) ----------------------

export type ReportBlock =
  | { kind: 'action-title'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'evidence-list'; items: Array<{ label: string; evidenceKind: EvidenceKind }> }
  | { kind: 'tension-list'; items: Array<{ posture: string; title: string; priority: number }> }
  | {
      kind: 'conclusion';
      k1Fact: string;
      k2Meaning: string;
      k3Actions: string[];
      k4Effect: string;
      tradeoff: { chosen: string; rejected: string; why: string };
    }
  | { kind: 'signature-visual'; archetype: string; payload: unknown };

export interface ReportSection {
  id: string;
  /** Action title — wniosek, nie etykieta („Marża spada", nie „Analiza marży"). */
  actionTitle: string;
  /** Output, z którego sekcja pochodzi — lineage dokumentu. */
  sourceOutputId: string;
  blocks: ReportBlock[];
}

export interface ToolReportDocument {
  id: string;
  organizationId: string;
  kind: ToolReportKind;
  theme: ToolReportTheme;
  title: string;
  /** Ten sam Output + ta sama wersja renderera = ten sam dokument. */
  rendererVersion: string;
  /** Lineage: Report/Presentation → Outputs → Session. */
  sourceOutputIds: string[];
  sections: ReportSection[];
  contentHash: string;
}

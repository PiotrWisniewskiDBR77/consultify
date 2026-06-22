/**
 * catalogTypes — wspólny kształt wpisu katalogu dla 90 scenariuszy.
 */

import type { ScenarioMeta } from '../scoring/scoringTypes.js';
import type { DeckCriteria } from '../scoring/deckScoring.js';
import type { DocCriteria, DocumentArtifact } from '../scoring/docScoring.js';
import type { TableCriteria, GeneratedTable } from '../scoring/tableScoring.js';
import type { DeckLayoutDirectorResult } from '../../../../server/src/services/presentationLayoutDirectorService.js';

export interface DeckCatalogEntry {
  meta: ScenarioMeta;
  criteria: DeckCriteria;
  /** Artefakt KNOWN-GOOD który musi przejść scoring dla `criteria`. */
  mockPass: DeckLayoutDirectorResult;
}

export interface DocCatalogEntry {
  meta: ScenarioMeta;
  criteria: DocCriteria;
  mockPass: DocumentArtifact;
}

export interface TableCatalogEntry {
  meta: ScenarioMeta;
  criteria: TableCriteria;
  mockPass: GeneratedTable;
}

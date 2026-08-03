/**
 * Publiczne wejście silnika „Analizuj z AI" (ETAP 3 standardu n-Type).
 * Karty importują WYŁĄCZNIE stąd — nie z plików wewnętrznych.
 */

export type {
  AnalysisCriterion,
  Bilingual,
  CardStandard,
  CompletenessBand,
  DoctrineRule,
  ResolvedCriterion,
  SeverityAnchor,
} from './cardAnalysisRubric';
export {
  ARTIFACT_CRITERIA,
  buildCardStandard,
  COMPLETENESS_BANDS,
  completenessBandsFor,
  criteriaFor,
  DOCTRINE_RULES,
  doctrineFor,
  findCanonicalCard,
  SEVERITY_ANCHORS,
  severityAnchorsFor,
} from './cardAnalysisRubric';
export type { CardAnalysisErrorCode } from './cardAnalysisService';
export {
  analyzeCard,
  buildAnalysisPrompt,
  CardAnalysisError,
  mergeChangeValue,
} from './cardAnalysisService';
export type {
  CardAnalysisApply,
  CardAnalysisArtifactType,
  CardAnalysisBucket,
  CardAnalysisChange,
  CardAnalysisChangeMode,
  CardAnalysisChangeState,
  CardAnalysisField,
  CardAnalysisFieldKind,
  CardAnalysisFinding,
  CardAnalysisInput,
  CardAnalysisResult,
  CardAnalysisSeverity,
} from './cardAnalysisTypes';

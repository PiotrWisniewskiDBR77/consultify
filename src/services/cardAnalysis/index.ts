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
  completenessBandsFor,
  COMPLETENESS_BANDS,
  criteriaFor,
  doctrineFor,
  DOCTRINE_RULES,
  findCanonicalCard,
  severityAnchorsFor,
  SEVERITY_ANCHORS,
} from './cardAnalysisRubric';
export type { CardAnalysisErrorCode } from './cardAnalysisService';
export { analyzeCard, buildAnalysisPrompt, CardAnalysisError, mergeChangeValue } from './cardAnalysisService';
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

export { AssessmentPresentationView } from './AssessmentPresentationView';
export type { AssessmentPresentationViewProps, PresentationFetchResult } from './AssessmentPresentationView';
export {
  buildPresentationDeck,
  type DimensionProfileEntry,
  type FindingHighlight,
  type PresentationDeckModel,
  type PresentationNarrativeInput,
  type UnknownReasonBreakdown,
  type UnknownsModel,
  type UnknownUnitEntry,
} from './buildPresentationDeck';
export { extractUnknownReasonBreakdown, isPlausibleRawOutput, toAssessmentOutput } from './outputAdapter';
export { PresentationDeck, type PresentationDeckProps } from './PresentationDeck';
export type {
  RawAssessmentOutputRecord,
  RawEvidenceCompleteness,
  RawFinding,
  RawGetOutputResponse,
  RawUnknownReasonBreakdown,
} from './rawOutputTypes';
export { PRESENTATION_SLIDE_COUNT } from './slides';

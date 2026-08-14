/**
 * Method Workspace UI shell — public surface.
 *
 * Shared by DRD (A6) and SIRI (A7). Behind `methodWorkspaceShellV1`
 * (default OFF — see src/hooks/useFeatureFlags.tsx) until owner acceptance
 * on screenshots (CLAUDE.md #7).
 */
export { AnswerStateControl } from './AnswerStateControl';
export type { AnswerStateControlProps } from './AnswerStateControl';

export { InterviewFocusPanel } from './InterviewFocusPanel';
export type { InterviewFocusPanelProps } from './InterviewFocusPanel';

export { LiveMatrix } from './LiveMatrix';
export type { LiveMatrixProps } from './LiveMatrix';

export { MethodNavigator } from './MethodNavigator';
export type { MethodNavigatorProps } from './MethodNavigator';

export { MethodPresentationView } from './MethodPresentationView';
export type { MethodPresentationViewProps } from './MethodPresentationView';

export { MethodReportView } from './MethodReportView';
export type { MethodReportViewProps } from './MethodReportView';

export { MethodWorkspaceShell } from './MethodWorkspaceShell';
export type { MethodWorkspaceShellProps } from './MethodWorkspaceShell';

export { QuestionHelpDisclosure } from './QuestionHelpDisclosure';
export type { QuestionHelpDisclosureProps } from './QuestionHelpDisclosure';

export { ResolutionCard } from './ResolutionCard';
export type { ResolutionCardProps } from './ResolutionCard';

export { SaveStateIndicator } from './SaveStateIndicator';
export type { SaveStateIndicatorProps } from './SaveStateIndicator';

export { TeresaPreviewPanel } from './TeresaPreviewPanel';
export type { TeresaPreviewPanelProps } from './TeresaPreviewPanel';

export { useMethodWorkspaceSave } from './useMethodWorkspaceSave';
export type {
  UseMethodWorkspaceSaveOptions,
  UseMethodWorkspaceSaveReturn,
} from './useMethodWorkspaceSave';

export { VoiceAnswerChannel } from './VoiceAnswerChannel';
export type { VoiceAnswerChannelProps } from './VoiceAnswerChannel';

export * from './types';

/**
 * Method Workspace UI shell — public surface.
 *
 * Shared by DRD (A6) and SIRI (A7). Behind `methodWorkspaceShellV1`
 * (default OFF — see src/hooks/useFeatureFlags.tsx) until owner acceptance
 * on screenshots (CLAUDE.md #7).
 */
export type { AnswerStateControlProps } from './AnswerStateControl';
export { AnswerStateControl } from './AnswerStateControl';
export type { InterviewFocusPanelProps } from './InterviewFocusPanel';
export { InterviewFocusPanel } from './InterviewFocusPanel';
export type { LiveMatrixProps } from './LiveMatrix';
export { LiveMatrix } from './LiveMatrix';
export type { MethodNavigatorProps } from './MethodNavigator';
export { MethodNavigator } from './MethodNavigator';
export type { MethodWorkspaceShellProps } from './MethodWorkspaceShell';
export { MethodWorkspaceShell } from './MethodWorkspaceShell';
export type { QuestionHelpDisclosureProps } from './QuestionHelpDisclosure';
export { QuestionHelpDisclosure } from './QuestionHelpDisclosure';
export type { ResolutionCardProps } from './ResolutionCard';
export { ResolutionCard } from './ResolutionCard';
export type { SaveStateIndicatorProps } from './SaveStateIndicator';
export { SaveStateIndicator } from './SaveStateIndicator';
export type { TeresaPreviewPanelProps } from './TeresaPreviewPanel';
export { TeresaPreviewPanel } from './TeresaPreviewPanel';
export * from './types';
export type {
  UseMethodWorkspaceSaveOptions,
  UseMethodWorkspaceSaveReturn,
} from './useMethodWorkspaceSave';
export { useMethodWorkspaceSave } from './useMethodWorkspaceSave';
export type { VoiceAnswerChannelProps } from './VoiceAnswerChannel';
export { VoiceAnswerChannel } from './VoiceAnswerChannel';

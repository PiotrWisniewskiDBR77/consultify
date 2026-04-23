import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { OnboardTelemetryEventName, OnboardTelemetryProps } from '@/models/onboarding/OnboardTelemetry';

import { isConnectorsTelemetryFullEnabled } from './connectorsTelemetryFullFlag';
import { isLearningTelemetryEnabled } from './learningTelemetryFlag';
import { isOnboardTelemetryEnabled } from './onboardTelemetryFlag';
import { isOutcomeTelemetryEnabled } from './outcomeTelemetryFlag';
import { isReasoningTelemetryEnabled } from './reasoningTelemetryFlag';
import { isResearchTelemetryEnabled } from './researchTelemetryFlag';

export type V10RuntimeTelemetrySource = 'admin_panel' | 'chat' | 'unknown';
export type V10RuntimeTelemetryFailReason =
  | 'flag_off'
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'not_implemented'
  | 'server_error'
  | 'network'
  | 'unknown';

export type V10RuntimeHttpStatusBucket = '2xx' | '4xx' | '5xx' | '0' | 'unknown';
export type V10RuntimeLatencyBucketMs = 'lt_250' | 'lt_1000' | 'lt_5000' | 'gte_5000' | 'unknown';
export type V10ConnectorLifecycleStatus =
  | 'connected'
  | 'pending'
  | 'needs_reauth'
  | 'disconnected'
  | 'completed'
  | 'stored';

export function bucketLatencyMs(ms: number | null | undefined): V10RuntimeLatencyBucketMs {
  if (ms === null || ms === undefined) return 'unknown';
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms < 250) return 'lt_250';
  if (ms < 1000) return 'lt_1000';
  if (ms < 5000) return 'lt_5000';
  return 'gte_5000';
}

export function bucketHttpStatus(status: number | null | undefined): V10RuntimeHttpStatusBucket {
  if (status === null || status === undefined) return 'unknown';
  if (!Number.isFinite(status)) return 'unknown';
  if (status === 0) return '0';
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'unknown';
}

function safeTrack(enabled: boolean, eventName: string, payload: Record<string, unknown>): boolean {
  if (!enabled) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackFunnelEvent(eventName as any, payload);
    return true;
  } catch {
    return false;
  }
}

function normalizeFailReason(input: {
  readonly enabled: boolean;
  readonly status?: number | null;
  readonly error?: unknown;
}): V10RuntimeTelemetryFailReason {
  if (!input.enabled) return 'flag_off';
  const status = input.status ?? null;
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 400 || status === 422) return 'validation';
  if (status === 404) return 'not_found';
  if (status === 405 || status === 501) return 'not_implemented';
  if (status !== null && status >= 500) return 'server_error';
  if (input.error instanceof TypeError) return 'network';
  return 'unknown';
}

type EmitArgsBase = {
  readonly source: V10RuntimeTelemetrySource;
  readonly latencyBucketMs?: V10RuntimeLatencyBucketMs;
  readonly httpStatusBucket?: V10RuntimeHttpStatusBucket;
};

// ---------------------------------------------------------------------------
// Reasoning Runtime (V10-RSN-023)
// ---------------------------------------------------------------------------

export function emitReasoningRuntimeStarted(payload: { readonly source: V10RuntimeTelemetrySource }): boolean {
  return safeTrack(isReasoningTelemetryEnabled(), 'reasoning_runtime_started', { ...payload });
}

export function emitReasoningRuntimeSucceeded(payload: EmitArgsBase): boolean {
  return safeTrack(isReasoningTelemetryEnabled(), 'reasoning_runtime_succeeded', { ...payload });
}

export function emitReasoningRuntimeFailed(payload: EmitArgsBase & { readonly reason: V10RuntimeTelemetryFailReason }): boolean {
  return safeTrack(isReasoningTelemetryEnabled(), 'reasoning_runtime_failed', { ...payload });
}

// ---------------------------------------------------------------------------
// Research Runtime (V10-RSR-024)
// ---------------------------------------------------------------------------

export function emitResearchRuntimeStarted(payload: { readonly source: V10RuntimeTelemetrySource }): boolean {
  return safeTrack(isResearchTelemetryEnabled(), 'research_runtime_started', { ...payload });
}

export function emitResearchRuntimeSucceeded(payload: EmitArgsBase): boolean {
  return safeTrack(isResearchTelemetryEnabled(), 'research_runtime_succeeded', { ...payload });
}

export function emitResearchRuntimeFailed(payload: EmitArgsBase & { readonly reason: V10RuntimeTelemetryFailReason }): boolean {
  return safeTrack(isResearchTelemetryEnabled(), 'research_runtime_failed', { ...payload });
}

// ---------------------------------------------------------------------------
// Connectors Runtime (V10-CON-023)
// ---------------------------------------------------------------------------

export function emitConnectorsRuntimeStarted(payload: { readonly source: V10RuntimeTelemetrySource }): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connectors_runtime_started', { ...payload });
}

export function emitConnectorsRuntimeSucceeded(payload: EmitArgsBase): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connectors_runtime_succeeded', { ...payload });
}

export function emitConnectorsRuntimeFailed(payload: EmitArgsBase & { readonly reason: V10RuntimeTelemetryFailReason }): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connectors_runtime_failed', { ...payload });
}

export function emitConnectorsRegistryLoaded(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly total: number;
  readonly available: number;
  readonly planned: number;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connectors_registry_loaded', { ...payload });
}

export function emitConnectorSessionConnected(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorId: string;
  readonly status: V10ConnectorLifecycleStatus;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_session_connected', { ...payload });
}

export function emitConnectorAuthStarted(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorId: string;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_auth_started', { ...payload });
}

export function emitConnectorAuthCompleted(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorId: string;
  readonly status: V10ConnectorLifecycleStatus;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_auth_completed', { ...payload });
}

export function emitConnectorSourceSearched(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorCount: number;
  readonly sourceCount: number;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_source_searched', { ...payload });
}

export function emitConnectorSourceRead(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorId: string;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_source_read', { ...payload });
}

export function emitConnectorTokenRefreshed(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorId: string;
  readonly status: V10ConnectorLifecycleStatus;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_token_refreshed', { ...payload });
}

export function emitConnectorSessionDisconnected(payload: {
  readonly source: V10RuntimeTelemetrySource;
  readonly connectorId: string;
}): boolean {
  return safeTrack(isConnectorsTelemetryFullEnabled(), 'connector_session_disconnected', { ...payload });
}

// ---------------------------------------------------------------------------
// Learning Runtime (V10-LRN-012)
// ---------------------------------------------------------------------------

export function emitLearningRuntimeStarted(payload: { readonly source: V10RuntimeTelemetrySource }): boolean {
  return safeTrack(isLearningTelemetryEnabled(), 'learning_runtime_started', { ...payload });
}

export function emitLearningRuntimeSucceeded(payload: EmitArgsBase): boolean {
  return safeTrack(isLearningTelemetryEnabled(), 'learning_runtime_succeeded', { ...payload });
}

export function emitLearningRuntimeFailed(payload: EmitArgsBase & { readonly reason: V10RuntimeTelemetryFailReason }): boolean {
  return safeTrack(isLearningTelemetryEnabled(), 'learning_runtime_failed', { ...payload });
}

// ---------------------------------------------------------------------------
// Outcome Runtime (V10-OUT-018)
// ---------------------------------------------------------------------------

export function emitOutcomeRuntimeStarted(payload: { readonly source: V10RuntimeTelemetrySource }): boolean {
  return safeTrack(isOutcomeTelemetryEnabled(), 'outcome_runtime_started', { ...payload });
}

export function emitOutcomeRuntimeSucceeded(payload: EmitArgsBase): boolean {
  return safeTrack(isOutcomeTelemetryEnabled(), 'outcome_runtime_succeeded', { ...payload });
}

export function emitOutcomeRuntimeFailed(payload: EmitArgsBase & { readonly reason: V10RuntimeTelemetryFailReason }): boolean {
  return safeTrack(isOutcomeTelemetryEnabled(), 'outcome_runtime_failed', { ...payload });
}

// ---------------------------------------------------------------------------
// Onboarding Runtime (V10-ONB-023)
// ---------------------------------------------------------------------------

export function emitOnboardRuntimeStarted(payload: { readonly source: V10RuntimeTelemetrySource }): boolean {
  return safeTrack(isOnboardTelemetryEnabled(), 'onboard_runtime_started', { ...payload });
}

export function emitOnboardRuntimeSucceeded(payload: EmitArgsBase): boolean {
  return safeTrack(isOnboardTelemetryEnabled(), 'onboard_runtime_succeeded', { ...payload });
}

export function emitOnboardRuntimeFailed(payload: EmitArgsBase & { readonly reason: V10RuntimeTelemetryFailReason }): boolean {
  return safeTrack(isOnboardTelemetryEnabled(), 'onboard_runtime_failed', { ...payload });
}

export function emitOnboardTelemetryEvent(
  eventName: OnboardTelemetryEventName,
  payload: OnboardTelemetryProps
): boolean {
  return safeTrack(isOnboardTelemetryEnabled(), eventName, payload);
}

export function emitOnboardArtifactBlocked(payload: OnboardTelemetryProps & { readonly reasonCode?: string }): boolean {
  return safeTrack(isOnboardTelemetryEnabled(), 'onboard.artifact_blocked', payload);
}

export function inferFailReason(args: {
  readonly enabled: boolean;
  readonly httpStatus?: number | null;
  readonly error?: unknown;
}): V10RuntimeTelemetryFailReason {
  return normalizeFailReason({ enabled: args.enabled, status: args.httpStatus, error: args.error });
}


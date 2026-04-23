import { useMutation, useQuery } from '@tanstack/react-query';

import type { OnboardingKpiDashboard } from '@/models/onboarding/ActivationKpiDashboard';
import type {
  OnboardTelemetryEventName,
  OnboardTelemetryProps,
} from '@/models/onboarding/OnboardTelemetry';
import type { OnboardingResumeSnapshot } from '@/models/onboarding/ResumeOnAbandonment';
import {
  type OnboardingPersonaCaptureResponse,
  type OnboardingResumeResponse,
  OnboardingRuntimeApi,
} from '@/services/api/v10';
import { isOnboardActivationKpiDashboardEnabled } from '@/utils/v10/onboardActivationKpiDashboardFlag';
import { isOnboardPersonaCaptureEnabled } from '@/utils/v10/onboardPersonaCaptureFlag';
import { isOnboardResumeAbandonmentEnabled } from '@/utils/v10/onboardResumeAbandonmentFlag';

export type {
  OnboardingPersonaCaptureResponse,
  OnboardingResumeResponse,
} from '@/services/api/v10';

export interface OnboardingRuntimeCapabilities {
  readonly enabled: boolean;
  readonly capturePersona: boolean;
  readonly saveSnapshot: boolean;
  readonly resume: boolean;
  readonly recordEvent: boolean;
  readonly kpiSummary: boolean;
}

export interface UseOnboardingRuntimeOptions {
  readonly enabled?: boolean;
}

function createCapabilityError(capability: string): Error {
  return new Error(`Onboarding Runtime capability "${capability}" is disabled.`);
}

export function buildOnboardingRuntimeCapabilities(
  options: UseOnboardingRuntimeOptions = {}
): OnboardingRuntimeCapabilities {
  const baseEnabled = options.enabled ?? true;
  const personaCaptureEnabled = baseEnabled && isOnboardPersonaCaptureEnabled();
  const resumeEnabled = baseEnabled && isOnboardResumeAbandonmentEnabled();
  const kpiEnabled = baseEnabled && isOnboardActivationKpiDashboardEnabled();

  return {
    enabled: personaCaptureEnabled || resumeEnabled || kpiEnabled,
    capturePersona: personaCaptureEnabled,
    saveSnapshot: resumeEnabled,
    resume: resumeEnabled,
    recordEvent: kpiEnabled,
    kpiSummary: kpiEnabled,
  };
}

export function useOnboardingRuntime(options: UseOnboardingRuntimeOptions = {}) {
  const capabilities = buildOnboardingRuntimeCapabilities(options);

  const capturePersonaMutation = useMutation<
    OnboardingPersonaCaptureResponse,
    Error,
    {
      onboardingId?: string;
      persona: string;
      personaConfidence?: 'low' | 'medium' | 'high';
      sourceType?: string;
      trustMode?: string;
      residencyRegion?: string;
      approvalRequired?: boolean;
    }
  >({
    mutationFn: async (payload) => {
      if (!capabilities.capturePersona) throw createCapabilityError('capture_persona');
      return OnboardingRuntimeApi.capturePersona(payload);
    },
  });

  const saveSnapshotMutation = useMutation<
    unknown,
    Error,
    {
      onboardingId: string;
      snapshot: OnboardingResumeSnapshot;
      status?: 'in_progress' | 'paused' | 'abandoned' | 'completed';
      reason?: string;
    }
  >({
    mutationFn: async (payload) => {
      if (!capabilities.saveSnapshot) throw createCapabilityError('save_snapshot');
      return OnboardingRuntimeApi.saveSnapshot(payload);
    },
  });

  const resumeMutation = useMutation<
    OnboardingResumeResponse,
    Error,
    {
      onboardingId?: string;
      resumeToken?: string;
      currentSourceHashes?: Record<string, string>;
    }
  >({
    mutationFn: async (payload) => {
      if (!capabilities.resume) throw createCapabilityError('resume');
      return OnboardingRuntimeApi.resume(payload);
    },
  });

  const recordEventMutation = useMutation<
    unknown,
    Error,
    {
      onboardingId: string;
      eventName: OnboardTelemetryEventName;
      props: OnboardTelemetryProps;
    }
  >({
    mutationFn: async (payload) => {
      if (!capabilities.recordEvent) throw createCapabilityError('record_event');
      return OnboardingRuntimeApi.recordEvent(payload);
    },
  });

  const kpiSummaryQuery = useQuery<OnboardingKpiDashboard>({
    queryKey: ['v10', 'onboarding-runtime', 'kpi-summary'],
    queryFn: () => {
      if (!capabilities.kpiSummary) throw createCapabilityError('kpi_summary');
      return OnboardingRuntimeApi.getKpiSummary();
    },
    enabled: false,
  });

  const isWorking =
    capturePersonaMutation.isPending ||
    saveSnapshotMutation.isPending ||
    resumeMutation.isPending ||
    recordEventMutation.isPending ||
    kpiSummaryQuery.isFetching;

  return {
    capabilities,
    isEnabled: capabilities.enabled,
    isWorking,
    isFetching: kpiSummaryQuery.isFetching,
    capturePersona: capturePersonaMutation.mutateAsync,
    saveSnapshot: saveSnapshotMutation.mutateAsync,
    resume: resumeMutation.mutateAsync,
    recordEvent: recordEventMutation.mutateAsync,
    loadKpiSummary: kpiSummaryQuery.refetch,
    capturePersonaMutation,
    saveSnapshotMutation,
    resumeMutation,
    recordEventMutation,
    kpiSummaryQuery,
  };
}

import type { OnboardingKpiDashboard } from '@/models/onboarding/ActivationKpiDashboard';
import type {
  OnboardTelemetryEventName,
  OnboardTelemetryProps,
} from '@/models/onboarding/OnboardTelemetry';
import type { OnboardingResumeSnapshot } from '@/models/onboarding/ResumeOnAbandonment';

import { fetchWithRetry, handleDataResponse } from '../baseClient';

export type OnboardingPersonaCaptureResponse = {
  onboardingId: string;
  resumeToken: string;
  resumeExpiresAt: string;
  now: string;
  accepted: true;
};

export type OnboardingResumeResponse = {
  outcome: 'resumed' | 'expired' | 'not_found';
  onboardingId: string | null;
  resumeToken: string | null;
  resumeExpiresAt: string | null;
  resumedAt: string;
  snapshot: OnboardingResumeSnapshot | null;
  currentStep: string | null;
  deltaBanner: string | null;
  changedSourceIds: string[];
};

export const OnboardingRuntimeApi = {
  capturePersona: async (body: {
    onboardingId?: string;
    persona: string;
    personaConfidence?: 'low' | 'medium' | 'high';
    sourceType?: string;
    trustMode?: string;
    residencyRegion?: string;
    approvalRequired?: boolean;
  }): Promise<OnboardingPersonaCaptureResponse> => {
    const res = await fetchWithRetry('/api/v10/onboarding-runtime/persona', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<OnboardingPersonaCaptureResponse>(
      res,
      'Failed to capture onboarding persona'
    );
  },

  saveSnapshot: async (body: {
    onboardingId: string;
    snapshot: OnboardingResumeSnapshot;
    status?: 'in_progress' | 'paused' | 'abandoned' | 'completed';
    reason?: string;
  }) => {
    const res = await fetchWithRetry('/api/v10/onboarding-runtime/snapshot', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<unknown>(res, 'Failed to save onboarding snapshot');
  },

  resume: async (body: {
    onboardingId?: string;
    resumeToken?: string;
    currentSourceHashes?: Record<string, string>;
  }): Promise<OnboardingResumeResponse> => {
    const res = await fetchWithRetry('/api/v10/onboarding-runtime/resume', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<OnboardingResumeResponse>(res, 'Failed to resume onboarding session');
  },

  recordEvent: async (body: {
    onboardingId: string;
    eventName: OnboardTelemetryEventName;
    props: OnboardTelemetryProps;
  }) => {
    const res = await fetchWithRetry('/api/v10/onboarding-runtime/events', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<unknown>(res, 'Failed to record onboarding event');
  },

  getKpiSummary: async (): Promise<OnboardingKpiDashboard> => {
    const response = await fetchWithRetry('/api/v10/onboarding-runtime/kpis/summary', {
      method: 'GET',
    });
    return handleDataResponse<OnboardingKpiDashboard>(
      response,
      'Failed to load onboarding KPI summary'
    );
  },
};

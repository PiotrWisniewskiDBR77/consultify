import { v8Get, v8Post } from './client';

/** Stable path for smoke checks and cross-layer alignment with `server/src/routes/v8/prompt-os.routes.ts`. */
export const V8_PROMPT_OS_RUNTIME_SUMMARY_PATH = '/prompt-os/runtime/summary' as const;

export interface V8PromptOsRuntimeSummary {
  contract: string;
  purposeFamiliesSupported: readonly string[];
  presetCount: number;
  bundleCount: number;
  activeBundleCount: number;
}

export interface V8PromptOsBundle {
  bundleId: string;
  version: string;
  presetId: string;
  promptVersion: string;
  modelVersion: string;
  policyVersion: string;
  runtimeConfigVersion: string;
  status: 'draft' | 'staging' | 'canary' | 'active' | 'rolled_back';
}

export interface V8PromptOsEvalGate {
  gateId: string;
  gateType: 'hard' | 'soft';
  purposeFamily: string;
  changeType: string;
  result: 'passed' | 'failed' | 'warning';
  evaluatedAt: string;
}

export interface V8PromptOsCanary {
  configId: string;
  orgScoped: boolean;
  purposeFamilyScoped: boolean;
  presetScoped: boolean;
  rollbackEnabled: boolean;
}

export const V8PromptOsApi = {
  getRuntimeSummary: () => v8Get<V8PromptOsRuntimeSummary>(V8_PROMPT_OS_RUNTIME_SUMMARY_PATH),
  getBundles: () => v8Get<V8PromptOsBundle[]>('/prompt-os/bundles'),
  getEvalGates: (bundleId: string) =>
    v8Get<V8PromptOsEvalGate[]>(`/prompt-os/bundles/${bundleId}/eval-gates`),
  getCanary: (bundleId: string) => v8Get<V8PromptOsCanary>(`/prompt-os/bundles/${bundleId}/canary`),
  activateBundle: (bundleId: string) =>
    v8Post<V8PromptOsBundle>(`/prompt-os/bundles/${bundleId}/activate`),
  rollbackBundle: (bundleId: string, reason: string) =>
    v8Post(`/prompt-os/bundles/${bundleId}/rollback`, { reason }),
};

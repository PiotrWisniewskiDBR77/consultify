import { v8Get } from './client';

/** Stable path for smoke checks and cross-layer alignment with `server/src/routes/v8/prompt-os.routes.ts`. */
export const V8_PROMPT_OS_RUNTIME_SUMMARY_PATH = '/prompt-os/runtime/summary' as const;

export interface V8PromptOsRuntimeSummary {
  contract: string;
  purposeFamiliesSupported: readonly string[];
  presetCount: number;
  bundleCount: number;
  activeBundleCount: number;
}

export const V8PromptOsApi = {
  getRuntimeSummary: () => v8Get<V8PromptOsRuntimeSummary>(V8_PROMPT_OS_RUNTIME_SUMMARY_PATH),
};

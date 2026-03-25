import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import {
  V8PromptOsApi,
  V8_PROMPT_OS_RUNTIME_SUMMARY_PATH,
} from '@/services/api/v8/prompt-os';
import { v8Get } from '@/services/api/v8/client';

describe('V8PromptOsApi', () => {
  beforeEach(() => {
    vi.mocked(v8Get).mockResolvedValue({
      contract: 'prompt-os-runtime-v8',
      purposeFamiliesSupported: [],
      presetCount: 0,
      bundleCount: 0,
      activeBundleCount: 0,
    });
  });

  it('requests runtime summary from the V8 prompt-os namespace', async () => {
    const data = await V8PromptOsApi.getRuntimeSummary();
    expect(v8Get).toHaveBeenCalledWith(V8_PROMPT_OS_RUNTIME_SUMMARY_PATH);
    expect(data.contract).toBe('prompt-os-runtime-v8');
    expect(data.presetCount).toBe(0);
  });
});

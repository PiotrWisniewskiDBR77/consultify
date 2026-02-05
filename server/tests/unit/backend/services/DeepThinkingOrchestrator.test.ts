import { describe, expect, it, vi } from 'vitest';

import { DeepThinkingOrchestrator } from '../../../../src/services/ai/deepThinkingOrchestrator.js';

describe('DeepThinkingOrchestrator', () => {
  it('emits dt_state events and returns format addon when enabled', async () => {
    const emit = vi.fn();
    const orchestrator = new DeepThinkingOrchestrator();

    const out = await orchestrator.runPrelude({
      message: 'Test decision',
      language: 'en',
      context: {},
      aiModes: { deepResearch: true, webSearch: false, showReasoning: false },
      emit,
    });

    expect(out.systemInstructionAddon).toContain('DEEP THINKING OUTPUT FORMAT');
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'dt_state', state: 'research_visibility' })
    );
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'dt_state', state: 'research' }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'dt_state', state: 'thinking' }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'dt_state', state: 'synthesis' }));
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'dt_state', state: 'closure' }));
  });

  it('emits research_progress error when webSearch enabled but key missing', async () => {
    const prev = process.env.TAVILY_API_KEY;
    process.env.TAVILY_API_KEY = '';

    const emit = vi.fn();
    const orchestrator = new DeepThinkingOrchestrator();

    await orchestrator.runPrelude({
      message: 'Test research',
      language: 'en',
      context: {},
      aiModes: { deepResearch: true, webSearch: true, showReasoning: false },
      emit,
    });

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'research_progress',
        stage: 'complete',
      })
    );

    process.env.TAVILY_API_KEY = prev;
  });
});


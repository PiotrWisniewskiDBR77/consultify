import { afterEach, describe, expect, it, vi } from 'vitest';

import { computeDynamicSwotPhaseSummaries } from '@/components/DiscoveryTools/toolCompletion';
import {
  SWOT_STEPS,
  TOOL_STEP_DEFINITIONS,
  type ToolType,
  useToolStore,
} from '@/store/useToolStore';

const allToolTypes = Object.keys(TOOL_STEP_DEFINITIONS) as ToolType[];
const originalSession = useToolStore.getState().currentSession;

function selectTool(toolType: ToolType) {
  useToolStore.setState({ currentSession: { toolType } as never });
}

describe('Dynamic SWOT runtime wiring', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    useToolStore.setState({ currentSession: originalSession });
  });

  it('keeps the exact five-step object when the flag is OFF', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'false');
    selectTool('dynamic-swot');

    expect(useToolStore.getState().getStepDefinitions()).toBe(SWOT_STEPS);
  });

  it('returns seven ordered runtime steps when the flag is ON', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');
    selectTool('dynamic-swot');

    expect(useToolStore.getState().getStepDefinitions().map((step) => step.id)).toEqual([
      'mission',
      'input',
      'swot',
      'insights',
      'recommendations',
      'outputs',
      'review',
    ]);
  });

  it('leaves every other tool definition on its existing object', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');

    for (const toolType of allToolTypes.filter((type) => type !== 'dynamic-swot')) {
      selectTool(toolType);
      expect(useToolStore.getState().getStepDefinitions()).toBe(TOOL_STEP_DEFINITIONS[toolType]);
    }
  });

  it('keeps five completion tiles when the flag is OFF', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'false');

    expect(computeDynamicSwotPhaseSummaries(undefined, true).map((phase) => phase.id)).toEqual([
      'mission',
      'input',
      'swot',
      'insights',
      'outputs',
    ]);
  });

  it('returns seven ordered completion tiles when the flag is ON', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');

    expect(computeDynamicSwotPhaseSummaries(undefined, true).map((phase) => phase.id)).toEqual([
      'mission',
      'input',
      'swot',
      'insights',
      'recommendations',
      'outputs',
      'review',
    ]);
  });

  it('exposes distinct localized labels for both new completion phases', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');

    const polish = computeDynamicSwotPhaseSummaries(undefined, true).slice(-3);
    const english = computeDynamicSwotPhaseSummaries(undefined, false).slice(-3);
    expect(polish.find((phase) => phase.id === 'recommendations')?.label).toBe('Rekomendacje');
    expect(english.find((phase) => phase.id === 'recommendations')?.label).toBe('Recommendations');
    expect(polish.find((phase) => phase.id === 'review')?.label).toBe('Przegląd');
    expect(english.find((phase) => phase.id === 'review')?.label).toBe('Review');
  });
});

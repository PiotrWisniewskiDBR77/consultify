import { afterEach, describe, expect, it, vi } from 'vitest';
import { dynamicSwotPack, getDynamicSwotPackForCurrentFlags } from '../packs/dynamicSwot.pack';

describe('Dynamic SWOT — siedem etapów za flagą OFF', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('brak zmiennej zachowuje dokładnie pięć dotychczasowych faz', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', '');
    expect(getDynamicSwotPackForCurrentFlags()).toBe(dynamicSwotPack);
    expect(dynamicSwotPack.phases.map((phase) => phase.id)).toEqual(['mission', 'input', 'swot', 'insights', 'outputs']);
  });

  it('jawne OFF zachowuje dokładnie pięć dotychczasowych faz', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'false');
    expect(getDynamicSwotPackForCurrentFlags()).toBe(dynamicSwotPack);
  });

  it('ON daje siedem faz i osobną bramę dla każdej nowej fazy', () => {
    vi.stubEnv('VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES', 'true');
    const pack = getDynamicSwotPackForCurrentFlags();
    expect(pack.phases.map((phase) => phase.id)).toEqual(['mission', 'input', 'swot', 'insights', 'recommendations', 'outputs', 'review']);
    expect(pack.questions.find((q) => q.phaseId === 'recommendations')?.id).toBe('swot-recommendations-direction');
    expect(pack.questions.find((q) => q.phaseId === 'review')?.id).toBe('swot-review-decision');
  });
});

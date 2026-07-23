import { beforeEach, describe, expect, it } from 'vitest';

import {
  deleteTemplatePreset,
  readTemplatePresets,
  saveTemplatePreset,
} from '../../../src/utils/exceleTemplatePresets';

describe('exceleTemplatePresets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty list when nothing is saved yet', () => {
    expect(readTemplatePresets('threeScenarioPnL')).toEqual([]);
  });

  it('saves a preset and reads it back, newest first', () => {
    saveTemplatePreset('threeScenarioPnL', 'Base case', { growth: 5, discount: 8 });
    const list = saveTemplatePreset('threeScenarioPnL', 'Aggressive', { growth: 15, discount: 6 });
    expect(list.map((p) => p.name)).toEqual(['Aggressive', 'Base case']);
    expect(list[0].values).toEqual({ growth: 15, discount: 6 });
  });

  it('overwrites an existing preset with the same (trimmed, case-insensitive) name', () => {
    saveTemplatePreset('threeScenarioPnL', 'Base case', { growth: 5 });
    const list = saveTemplatePreset('threeScenarioPnL', '  base case  ', { growth: 7 });
    expect(list).toHaveLength(1);
    expect(list[0].values).toEqual({ growth: 7 });
  });

  it('keeps presets scoped per templateId', () => {
    saveTemplatePreset('threeScenarioPnL', 'Base case', { growth: 5 });
    saveTemplatePreset('otherTemplate', 'Base case', { growth: 9 });
    expect(readTemplatePresets('threeScenarioPnL')).toHaveLength(1);
    expect(readTemplatePresets('otherTemplate')).toHaveLength(1);
    expect(readTemplatePresets('threeScenarioPnL')[0].values).toEqual({ growth: 5 });
  });

  it('ignores a blank name and does not save', () => {
    const list = saveTemplatePreset('threeScenarioPnL', '   ', { growth: 5 });
    expect(list).toEqual([]);
  });

  it('deletes a preset by id', () => {
    const [saved] = saveTemplatePreset('threeScenarioPnL', 'Base case', { growth: 5 });
    const afterDelete = deleteTemplatePreset('threeScenarioPnL', saved.id);
    expect(afterDelete).toEqual([]);
  });

  it('never throws on malformed localStorage content', () => {
    window.localStorage.setItem('consultify-excele-template-presets-v1', '{not json');
    expect(readTemplatePresets('threeScenarioPnL')).toEqual([]);
  });
});

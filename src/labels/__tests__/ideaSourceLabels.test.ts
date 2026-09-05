import { describe, expect, it } from 'vitest';

import { ideaSourceLabelEntries, sourceLabel } from '../ideaSourceLabels';

describe('sourceLabel', () => {
  it('maps every known source in Polish and English', () => {
    expect(ideaSourceLabelEntries).toEqual({
      manual: { pl: 'Ręcznie', en: 'Manual' },
      ai: { pl: 'AI', en: 'AI' },
    });
    expect(sourceLabel('manual', true)).toBe('Ręcznie');
    expect(sourceLabel('manual', false)).toBe('Manual');
    expect(sourceLabel('ai', true)).toBe('AI');
    expect(sourceLabel('ai', false)).toBe('AI');
  });

  it('never exposes an unknown raw value', () => {
    expect(sourceLabel('unknown_future_value', true)).toBe('Nieznane źródło');
    expect(sourceLabel('unknown_future_value', false)).toBe('Unknown source');
    expect(sourceLabel('unknown_future_value', true)).not.toContain('unknown_future_value');
  });
});

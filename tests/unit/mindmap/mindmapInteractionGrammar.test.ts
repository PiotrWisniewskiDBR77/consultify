import { describe, expect, it } from 'vitest';

import {
  getMindmapConnectToolbarAction,
  normalizeMindmapNodeQuickAction,
} from '@/components/MyWork/mindmap/mindmapInteractionGrammar';

describe('mindmapInteractionGrammar', () => {
  it('normalizes legacy mm_* add actions to the canonical handler names', () => {
    expect(normalizeMindmapNodeQuickAction('mm_add_child')).toBe('add_child');
    expect(normalizeMindmapNodeQuickAction('mm_add_sibling')).toBe('add_sibling');
    expect(normalizeMindmapNodeQuickAction('open_properties')).toBe('open_properties');
  });

  it('uses the connect button as an explicit exit when already connecting', () => {
    expect(getMindmapConnectToolbarAction('select')).toBe('mm_connect_mode');
    expect(getMindmapConnectToolbarAction('pan')).toBe('mm_connect_mode');
    expect(getMindmapConnectToolbarAction('connect')).toBe('mm_select_mode');
  });
});

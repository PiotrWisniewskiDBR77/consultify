import { describe, expect, it } from 'vitest';

import {
  getMindmapPointerToggleTooltip,
  getMindmapConnectToolbarAction,
  normalizeMindmapNodeQuickAction,
  stabilizeMindmapInteractionMode,
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

  it('uses connect-specific pointer copy instead of reusing pan copy', () => {
    expect(getMindmapPointerToggleTooltip('connect', false)).toBe(
      'Connect — click Connect or empty canvas to return to select'
    );
    expect(getMindmapPointerToggleTooltip('connect', true)).toBe(
      'Łączenie — kliknij Connect lub pusty canvas, aby wrócić do zaznaczania'
    );
  });

  it('stabilizes accidental connect-to-pan transitions back to select', () => {
    expect(stabilizeMindmapInteractionMode('connect', 'pan')).toBe('select');
    expect(stabilizeMindmapInteractionMode('connect', 'select')).toBe('select');
    expect(stabilizeMindmapInteractionMode('select', 'pan')).toBe('pan');
  });
});

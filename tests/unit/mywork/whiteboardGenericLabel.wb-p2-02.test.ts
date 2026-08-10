/**
 * WB-P2-02 (docs/qa/ideas-manual-audit-2026-08-09/08_P1_P3_EXECUTION_PLAN_
 * FOR_CLAUDE.md §6 Whiteboard): "when labels are still generic/default,
 * disable or coach `Find themes`... do not let AI present generic output as
 * insight." These are the pure label-classification helpers
 * `runWhiteboardAIAction` gates on before calling the AI generator.
 */
import { describe, expect, it } from 'vitest';

import {
  collectGenericWhiteboardLabels,
  isGenericWhiteboardLabel,
} from '../../../src/components/MyWork/IdeaWhiteboardTool';

// Mirrors the real EN/PL strings in public/locales/*/translation.json under
// myWork.whiteboard.nodes.default* — a small fake `t` (not a full i18next
// instance) so this test doesn't depend on loading the real JSON resources.
const EN: Record<string, string> = {
  defaultSticky: 'New note',
  defaultText: 'Text',
  defaultGroup: 'Group',
  defaultShape: 'Shape',
  defaultFrame: 'Section',
  defaultImage: 'Image',
  defaultLink: 'Link',
  defaultKpi: 'KPI',
  defaultScore: 'Score',
  defaultProgress: 'Progress',
  defaultSummary: 'Summary',
};
const PL: Record<string, string> = {
  defaultSticky: 'Nowa notatka',
  defaultText: 'Tekst',
  defaultGroup: 'Grupa',
  defaultShape: 'Kształt',
  defaultFrame: 'Sekcja',
  defaultImage: 'Obraz',
  defaultLink: 'Link',
  defaultKpi: 'KPI',
  defaultScore: 'Wynik',
  defaultProgress: 'Postęp',
  defaultSummary: 'Podsumowanie',
};

function fakeT(key: string, opts?: Record<string, unknown>): string {
  const suffix = key.split('.').pop() as string;
  const table = opts?.lng === 'pl' ? PL : EN;
  return table[suffix] ?? key;
}

describe('collectGenericWhiteboardLabels / isGenericWhiteboardLabel (WB-P2-02)', () => {
  const generic = collectGenericWhiteboardLabels(fakeT);

  it('flags a brand-new EN default label as generic', () => {
    expect(isGenericWhiteboardLabel('New note', generic)).toBe(true);
  });

  it('flags a brand-new PL default label as generic — even when the active language is EN', () => {
    // Board content can mix locales; the check must not be blind to the
    // OTHER language's defaults just because the UI is currently in EN.
    expect(isGenericWhiteboardLabel('Nowa notatka', generic)).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isGenericWhiteboardLabel('  NEW NOTE  ', generic)).toBe(true);
  });

  it('flags empty/whitespace-only labels as generic (no real content either)', () => {
    expect(isGenericWhiteboardLabel('', generic)).toBe(true);
    expect(isGenericWhiteboardLabel('   ', generic)).toBe(true);
    expect(isGenericWhiteboardLabel(undefined, generic)).toBe(true);
  });

  it('does NOT flag real, user-authored content as generic', () => {
    expect(isGenericWhiteboardLabel('Q4 churn risk is rising', generic)).toBe(false);
    expect(isGenericWhiteboardLabel('Ryzyko utraty klienta rośnie', generic)).toBe(false);
  });

  it('under the known pre-existing raw-key i18n test mock, defaults and real content still resolve consistently', () => {
    // House-rule-documented pre-existing behavior: some test mocks return the
    // raw key from `t()` instead of a translated label. In that world every
    // GENERIC_WHITEBOARD_LABEL_I18N_KEYS entry collapses to the same raw key
    // string for both `lng` variants — which is still CORRECT, because a
    // freshly-created node's default label comes from that exact same `t()`
    // call, so the two sides stay in sync either way.
    const rawKeyT = (key: string) => key;
    const genericUnderMock = collectGenericWhiteboardLabels(rawKeyT);
    expect(
      isGenericWhiteboardLabel('myWork.whiteboard.nodes.defaultSticky', genericUnderMock)
    ).toBe(true);
    expect(isGenericWhiteboardLabel('Q4 churn risk is rising', genericUnderMock)).toBe(false);
  });
});

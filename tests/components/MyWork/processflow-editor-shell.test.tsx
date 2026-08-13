/**
 * @vitest-environment jsdom
 *
 * Editor Shell reskin for Process Flow (VEGAS D-I, UI-L13 / UI-L9).
 * Guards:
 *   - UI-L13: exactly ONE mode segmented control (not two redundant mode rows),
 *     with human-readable labels + descriptive tooltips.
 *   - Command row: overflow "…" menu holds duplicate / delete / ask-AI / convert.
 *   - UI-L9: convert targets carry a display `group` so the panel renders 3 clusters.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProcessFlowToolbar } from '../../../src/components/MyWork/processflow/ProcessFlowToolbar';
import {
  IDEA_CONVERT_TARGETS,
  IDEA_CONVERT_GROUP_ORDER,
  IDEA_CONVERT_GROUP_LABELS,
} from '../../../src/components/MyWork/ideaConvertTargets';
import { FLOW_MODE_GUIDANCE } from '../../../src/components/MyWork/processflow/ProcessFlowToolbar';

/**
 * N6.4 (2026-08-10) — ten mock musiał urosnąć o DWIE rzeczy, obie z powodu
 * REALNYCH braków w nim samym, nie z powodu zmiany w komponencie:
 *
 *  1. `initReactI18next` — od podłączenia paska do rejestru akcji
 *     (`ideaActionRegistry.ts` → `services/api.ts` → `src/i18n.ts`) moduł
 *     `src/i18n.ts` wykonuje się przy imporcie i woła `.use(initReactI18next)`.
 *     Bez tego eksportu w mocku CAŁY plik testowy przestawał się nawet
 *     ZBIERAĆ („no tests"), więc dopisanie go przywraca zbieralność.
 *  2. `t` — mock NIGDY go nie zwracał, a `ProcessFlowToolbar` robi
 *     `const { t } = useTranslation()`. Efekt: SIEDEM z dziewięciu testów w
 *     tym pliku było CZERWONYCH na długo przed tą falą (`t is not a
 *     function`) — sprawdzone `git stash`-em na commicie bazowym. Ten plik
 *     strzeże dokładnie tej powierzchni, którą teraz okablowujemy (zakładki
 *     trybu + menu „Więcej"), więc zostawienie go w całości czerwonego
 *     znaczyłoby „przepuszczam zmianę bez żadnej osłony". Mock `t` zwraca
 *     `defaultValue` (drugi argument), czyli DOKŁADNIE te angielskie napisy,
 *     na których asercje tego pliku były pisane.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: unknown) =>
      typeof defaultValue === 'string' ? defaultValue : _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

function baseProps(overrides: Record<string, any> = {}) {
  return {
    isPl: false,
    locked: false,
    flowMode: 'classic' as const,
    setFlowMode: vi.fn(),
    semanticKit: 'classic',
    availableShapes: [] as any[],
    addNode: vi.fn(),
    addLane: vi.fn(),
    insertBetween: vi.fn(),
    splitPath: vi.fn(),
    runValidation: vi.fn(),
    showWarnings: false,
    warnings: [] as { message: string }[],
    showCoach: false,
    setShowCoach: vi.fn(),
    coachLoading: false,
    runProcessCoach: vi.fn(),
    showSummary: false,
    setShowSummary: vi.fn(),
    summaryLoading: false,
    generateSummary: vi.fn(),
    showKPIDashboard: false,
    setShowKPIDashboard: vi.fn(),
    canUndo: true,
    canRedo: true,
    undo: vi.fn(),
    redo: vi.fn(),
    handleAutoLayout: vi.fn(),
    duplicateSelected: vi.fn(),
    deleteSelected: vi.fn(),
    saving: false,
    syncLabel: 'Saved',
    handleSave: vi.fn(),
    stepCount: 3,
    laneCount: 2,
    guidance: FLOW_MODE_GUIDANCE.classic,
    ...overrides,
  };
}

describe('ProcessFlowToolbar — Editor Shell (UI-L13)', () => {
  it('renders exactly ONE mode segmented control (single tablist, 3 tabs)', () => {
    render(<ProcessFlowToolbar {...(baseProps() as any)} />);
    const tablist = screen.getByRole('tablist', { name: 'Flow mode' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Classic Flow',
      'Automation',
      'Value Stream',
    ]);
  });

  it('marks the active mode and switches on click', () => {
    const setFlowMode = vi.fn();
    render(<ProcessFlowToolbar {...(baseProps({ setFlowMode }) as any)} />);
    const tablist = screen.getByRole('tablist', { name: 'Flow mode' });
    const [classicTab, autoTab] = within(tablist).getAllByRole('tab');
    expect(classicTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(autoTab);
    expect(setFlowMode).toHaveBeenCalledWith('automation');
  });

  it('each mode tab carries a descriptive tooltip (no cryptic labels)', () => {
    render(<ProcessFlowToolbar {...(baseProps() as any)} />);
    const tablist = screen.getByRole('tablist', { name: 'Flow mode' });
    for (const tab of within(tablist).getAllByRole('tab')) {
      const title = tab.getAttribute('title') || '';
      expect(title.length).toBeGreaterThan(20);
      expect(title).toContain('—');
    }
  });

  it('shows a kit chip ONLY for a specialised semantic kit (not classic/automation/vsm)', () => {
    const { rerender } = render(<ProcessFlowToolbar {...(baseProps({ semanticKit: 'classic' }) as any)} />);
    expect(screen.queryByText(/BPMN notation/i)).toBeNull();
    rerender(<ProcessFlowToolbar {...(baseProps({ semanticKit: 'bpmn' }) as any)} />);
    expect(screen.getByText('BPMN notation')).toBeDefined();
  });
});

describe('ProcessFlowToolbar — command-row overflow', () => {
  it('hides duplicate/delete/convert behind a "…" overflow menu (not inline primary)', () => {
    const onConvert = vi.fn();
    render(<ProcessFlowToolbar {...(baseProps({ onConvert }) as any)} />);
    // Convert should NOT be visible until overflow is opened.
    expect(screen.queryByRole('menuitem')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    const items = screen.getAllByRole('menuitem');
    const labels = items.map((i) => i.textContent);
    expect(labels.some((l) => /Duplicate/.test(l || ''))).toBe(true);
    expect(labels.some((l) => /Delete/.test(l || ''))).toBe(true);
    expect(labels.some((l) => /Initiative/.test(l || ''))).toBe(true);
  });

  it('overflow convert item fires onConvert with the pf_ action', () => {
    const onConvert = vi.fn();
    render(<ProcessFlowToolbar {...(baseProps({ onConvert }) as any)} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Initiative/ }));
    expect(onConvert).toHaveBeenCalledWith('pf_convert_initiative');
  });
});

describe('ideaConvertTargets — UI-L9 grouping SSOT', () => {
  it('every target declares a group in the canonical order', () => {
    for (const t of IDEA_CONVERT_TARGETS) {
      expect(IDEA_CONVERT_GROUP_ORDER).toContain(t.group);
    }
  });

  it('has a label for every group and produces 3 non-empty clusters', () => {
    const nonEmpty = IDEA_CONVERT_GROUP_ORDER.filter((g) =>
      IDEA_CONVERT_TARGETS.some((t) => t.group === g)
    );
    expect(nonEmpty).toHaveLength(3);
    for (const g of IDEA_CONVERT_GROUP_ORDER) {
      expect(IDEA_CONVERT_GROUP_LABELS[g].en).toBeTruthy();
      expect(IDEA_CONVERT_GROUP_LABELS[g].pl).toBeTruthy();
    }
  });

  it('live working actions land in the "work" group', () => {
    const work = IDEA_CONVERT_TARGETS.filter((t) => t.group === 'work').map((t) => t.id);
    expect(work).toEqual(
      expect.arrayContaining(['initiative', 'task_set', 'decision', 'team_chat'])
    );
    const docs = IDEA_CONVERT_TARGETS.filter((t) => t.group === 'docs').map((t) => t.id);
    expect(docs).toEqual(expect.arrayContaining(['report', 'presentation']));
  });
});

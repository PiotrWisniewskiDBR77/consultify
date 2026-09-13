import { describe, expect, it } from 'vitest';

import {
  EXECUTION_FUNCTION_IDS,
  executionDeepLinkTabs,
  executionFunctionLabel,
  executionModuleTabIds,
  isExecutionDeepLinkTabAllowed,
  resolveExecutionDeepLinkTab,
} from '../executionModuleTabs';

describe('Menu 2 modułu Realizacja', () => {
  it('Menu 2 Realizacji ma dokładnie cztery funkcje w kolejności właściciela przy fladze kokpitu ON i OFF', () => {
    const expected = ['list', 'work', 'control', 'reports'];
    expect(EXECUTION_FUNCTION_IDS).toEqual(expected);
    expect(executionModuleTabIds({ summaryOneLookEnabled: true })).toEqual(expected);
    expect(executionModuleTabIds({ summaryOneLookEnabled: false })).toEqual(expected);
    expect(EXECUTION_FUNCTION_IDS.map((id) => executionFunctionLabel(id, true))).toEqual([
      'Bank realizacji',
      'Praca',
      'Zarządzanie ryzykiem',
      'Raporty',
    ]);
    expect(EXECUTION_FUNCTION_IDS.map((id) => executionFunctionLabel(id, false))).toEqual([
      'Execution bank',
      'Work',
      'Risk management',
      'Reports',
    ]);
  });

  it('historyczne powierzchnie nie tworzą piątej funkcji Menu 2', () => {
    for (const tab of ['resources', 'summary', 'rollout']) {
      expect(executionModuleTabIds({ summaryOneLookEnabled: true })).not.toContain(tab);
    }
  });
});

describe('historyczne aliasy deep-linków', () => {
  it('control, sterowanie, decyzje-i-ryzyka, decisions-risks i decisions otwierają tę samą funkcję Zarządzanie ryzykiem', () => {
    for (const alias of [
      'control',
      'sterowanie',
      'decyzje-i-ryzyka',
      'decisions-risks',
      'decisions',
    ]) {
      expect(resolveExecutionDeepLinkTab(alias)).toBe('control');
      expect(isExecutionDeepLinkTabAllowed(alias, { summaryOneLookEnabled: false })).toBe(true);
    }
  });

  it('wpuszcza historyczne resources, summary i rollout do adaptera niezależnie od flagi', () => {
    for (const alias of ['resources', 'summary', 'rollout']) {
      expect(isExecutionDeepLinkTabAllowed(alias, { summaryOneLookEnabled: false })).toBe(true);
      expect(isExecutionDeepLinkTabAllowed(alias, { summaryOneLookEnabled: true })).toBe(true);
    }
  });

  it('lista wejść deep-link zawiera cztery funkcje i jawne aliasy podwidoków', () => {
    expect(executionDeepLinkTabs({ summaryOneLookEnabled: false })).toEqual([
      'list',
      'work',
      'control',
      'reports',
      'resources',
      'summary',
      'rollout',
    ]);
  });
});

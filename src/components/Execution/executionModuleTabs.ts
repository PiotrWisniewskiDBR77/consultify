/** Cztery funkcje właścicielskie Menu 2 Realizacji, w wiążącej kolejności. */
export const EXECUTION_FUNCTION_IDS = ['list', 'work', 'control', 'reports'] as const;
export type ExecutionFunctionId = (typeof EXECUTION_FUNCTION_IDS)[number];

const EXECUTION_FUNCTION_LABELS: Record<ExecutionFunctionId, { polish: string; english: string }> =
  {
    list: { polish: 'Bank realizacji', english: 'Execution bank' },
    work: { polish: 'Praca', english: 'Work' },
    control: { polish: 'Zarządzanie ryzykiem', english: 'Risk management' },
    reports: { polish: 'Raporty', english: 'Reports' },
  };

/** Historyczne powierzchnie pozostają osiągalne jako podwidoki funkcji. */
export const EXECUTION_SUBVIEW_DEEP_LINK_IDS = ['resources', 'summary', 'rollout'] as const;

export interface ExecutionTabOptions {
  /** Bramka dotyczy renderu kokpitu, nie jego pozycji w Menu 2. */
  summaryOneLookEnabled: boolean;
}

export function executionModuleTabIds(_options: ExecutionTabOptions): ExecutionFunctionId[] {
  return [...EXECUTION_FUNCTION_IDS];
}

export function executionFunctionLabel(id: ExecutionFunctionId, isPolish: boolean): string {
  const labels = EXECUTION_FUNCTION_LABELS[id];
  return isPolish ? labels.polish : labels.english;
}

export function executionDeepLinkTabs(_options: ExecutionTabOptions): string[] {
  return [...EXECUTION_FUNCTION_IDS, ...EXECUTION_SUBVIEW_DEEP_LINK_IDS];
}

const DEEP_LINK_TAB_ALIASES: Record<string, string> = {
  sterowanie: 'control',
  'decyzje-i-ryzyka': 'control',
  'decisions-risks': 'control',
  decisions: 'control',
};

export function resolveExecutionDeepLinkTab(targetTab: string): string {
  const value = String(targetTab || '')
    .trim()
    .toLowerCase();
  return DEEP_LINK_TAB_ALIASES[value] ?? value;
}

export function isExecutionDeepLinkTabAllowed(
  targetTab: string,
  options: ExecutionTabOptions
): boolean {
  return executionDeepLinkTabs(options).includes(resolveExecutionDeepLinkTab(targetTab));
}

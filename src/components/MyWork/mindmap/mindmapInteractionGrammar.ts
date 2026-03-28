export function normalizeMindmapNodeQuickAction(action: string): string {
  if (action === 'mm_add_child') return 'add_child';
  if (action === 'mm_add_sibling') return 'add_sibling';
  return action;
}

export function getMindmapConnectToolbarAction(interactionMode: 'select' | 'pan' | 'connect') {
  return interactionMode === 'connect' ? 'mm_select_mode' : 'mm_connect_mode';
}

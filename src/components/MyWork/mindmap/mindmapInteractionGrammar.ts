export function normalizeMindmapNodeQuickAction(action: string): string {
  if (action === 'mm_add_child') return 'add_child';
  if (action === 'mm_add_sibling') return 'add_sibling';
  return action;
}

export function getMindmapConnectToolbarAction(interactionMode: 'select' | 'pan' | 'connect') {
  return interactionMode === 'connect' ? 'mm_select_mode' : 'mm_connect_mode';
}

export function getMindmapPointerToggleTooltip(
  interactionMode: 'select' | 'pan' | 'connect',
  isPolish: boolean
): string {
  if (interactionMode === 'select') {
    return isPolish
      ? 'Zaznaczanie — klik zaznacza, kliknij by przełączyć na przesuwanie'
      : 'Select — click to select nodes, click to switch to pan';
  }

  if (interactionMode === 'connect') {
    return isPolish
      ? 'Łączenie — kliknij Connect lub pusty canvas, aby wrócić do zaznaczania'
      : 'Connect — click Connect or empty canvas to return to select';
  }

  return isPolish
    ? 'Przesuwanie — przeciągaj canvas, kliknij by przełączyć na zaznaczanie'
    : 'Pan — drag the canvas, click to switch to select';
}

export function stabilizeMindmapInteractionMode(
  previousMode: 'select' | 'pan' | 'connect',
  requestedMode: 'select' | 'pan' | 'connect'
): 'select' | 'pan' | 'connect' {
  if (previousMode === 'connect' && requestedMode === 'pan') {
    return 'select';
  }

  return requestedMode;
}

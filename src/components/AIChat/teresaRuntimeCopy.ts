export function getTeresaStartFailureMessage(language?: string): string {
  const base = String(language || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];

  if (base === 'pl') {
    return '⚠️ Teresa jest chwilowo niedostepna. Sprobuj ponownie za chwile. Jesli problem wraca, rozpocznij nowa rozmowe lub odswiez widok.';
  }

  return '⚠️ Teresa is temporarily unavailable. Please try again in a moment. If the problem persists, start a new chat or refresh the view.';
}

export function getTeresaEmptyResponseMessage(language?: string): string {
  const base = String(language || 'en')
    .trim()
    .toLowerCase()
    .split('-')[0];

  if (base === 'pl') {
    return '⚠️ Teresa nie zwrocila pelnej odpowiedzi. Sprobuj ponownie za chwile.';
  }

  return '⚠️ Teresa did not return a complete answer. Please try again in a moment.';
}

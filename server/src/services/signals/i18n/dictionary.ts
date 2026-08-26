const pl: Record<string, string> = {
  'signals.exec.task.overdue.title': 'Zadanie po terminie',
  'signals.exec.task.overdue.body': 'Zadanie jest po terminie o {value} dni.',
  'signals.exec.task.due_soon_not_started.title': 'Zbliża się termin nierozpoczętego zadania',
  'signals.exec.task.due_soon_not_started.body': 'Do terminu pozostało {value} dni.',
  'signals.exec.task.blocked_stale.title': 'Zablokowane zadanie bez aktualizacji',
  'signals.exec.task.blocked_stale.body': 'Brak aktualizacji od {value} dni.',
  'signals.exec.initiative.no_baseline.title': 'Inicjatywa bez baseline',
  'signals.exec.initiative.no_baseline.body': 'Aktywna inicjatywa nie ma baseline harmonogramu.',
  'signals.dec.pending_stale.title': 'Decyzja oczekuje zbyt długo',
  'signals.dec.pending_stale.body': 'Decyzja oczekuje od {value} dni.',
  'signals.dec.blocking_dependents.title': 'Decyzja blokuje zależne obiekty',
  'signals.dec.blocking_dependents.body': 'Decyzja blokuje {value} obiektów.',
};

const en: Record<string, string> = {
  'signals.exec.task.overdue.title': 'Task overdue',
  'signals.exec.task.overdue.body': 'The task is {value} days overdue.',
  'signals.exec.task.due_soon_not_started.title': 'Unstarted task due soon',
  'signals.exec.task.due_soon_not_started.body': '{value} days remain until the due date.',
  'signals.exec.task.blocked_stale.title': 'Blocked task without an update',
  'signals.exec.task.blocked_stale.body': 'No update for {value} days.',
  'signals.exec.initiative.no_baseline.title': 'Initiative without a baseline',
  'signals.exec.initiative.no_baseline.body': 'The active initiative has no schedule baseline.',
  'signals.dec.pending_stale.title': 'Decision pending too long',
  'signals.dec.pending_stale.body': 'The decision has been pending for {value} days.',
  'signals.dec.blocking_dependents.title': 'Decision blocks dependent objects',
  'signals.dec.blocking_dependents.body': 'The decision blocks {value} objects.',
};

export function translateSignal(
  key: string | null,
  params: Record<string, unknown>,
  locale: string
): string {
  if (!key) return '';
  const dictionary = locale.toLowerCase().startsWith('en') ? en : pl;
  const template = dictionary[key] ?? key;
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

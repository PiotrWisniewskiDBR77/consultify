/**
 * #21 Notatnik-centrum-myśli — read-path helper for the reminder chip.
 *
 * Backend persists a "przypomnij mi …" reminder inside the note's
 * `capture_metadata.reminder` JSON (server/src/services/notebookService.ts →
 * { dueAt, term, createdAt, status }). The read-path (my-work.routes) returns it
 * as `captureMetadata.reminder`. This helper turns it into a display-ready label
 * (PL/EN date) for <NotebookReminderChip/>. Pure, no side effects, no writes.
 */

import i18n from '../../../i18n';

export interface NotebookReminderMetadata {
  dueAt?: string | null;
  term?: string | null;
  createdAt?: string | null;
  status?: string | null;
}

export interface NotebookReminderSummary {
  /** Short chip label, e.g. "Przypomnienie: 14 lip 2026, 09:00". */
  label: string;
  /** Full title/tooltip. */
  title: string;
  /** Raw due timestamp (ISO) when present. */
  dueAt: string | null;
}

function formatReminderDate(dueAt: string, isPolish: boolean): string | null {
  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) return null;
  const hasTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
  return parsed.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/**
 * Build the reminder chip summary from a note's capture metadata.
 * Returns null when there is no usable reminder (neither a parseable date nor a
 * free-text term) — the chip then renders nothing, exactly like the other
 * notebook metadata badges.
 */
export function getNotebookReminderSummary(
  captureMetadata: { reminder?: NotebookReminderMetadata | null } | null | undefined,
  isPolish: boolean
): NotebookReminderSummary | null {
  const reminder = captureMetadata?.reminder;
  if (!reminder) return null;

  const dueAt = typeof reminder.dueAt === 'string' && reminder.dueAt.trim() ? reminder.dueAt : null;
  const term =
    typeof reminder.term === 'string' && reminder.term.trim() ? reminder.term.trim() : null;

  const formattedDate = dueAt ? formatReminderDate(dueAt, isPolish) : null;

  // Nothing meaningful to show.
  if (!formattedDate && !term) return null;

  const prefix = i18n.t('notebook.reminderSummary.prefix', 'Reminder');
  const when = formattedDate || term!;
  const label = `${prefix}: ${when}`;
  const title = term && formattedDate ? `${prefix}: ${term} · ${formattedDate}` : label;

  return { label, title, dueAt };
}

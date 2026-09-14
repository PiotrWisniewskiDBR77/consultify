/**
 * Etykiety statusu inicjatywy — SSOT dla `InitiativePreviewV3` i
 * `TransitionInboxSurface` (H1f, DEC-507).
 *
 * WYDZIELONE Z `InitiativePreviewV3.tsx` (2026-09-14): oba ekrany potrzebują
 * TEJ SAMEJ mapy i18n (żeby „Approved"/„Scheduled" miały jeden tekst
 * niezależnie od tego, który preview je pokazuje), ale `InitiativePreviewV3`
 * ciągnie za sobą `InitiativeSourceLink` → `@/i18n` (singleton z realną
 * inicjalizacją `initReactI18next`) — import całego pliku w
 * `TransitionInboxSurface` wywalał testy montowane, których mock
 * `react-i18next` nie zna `initReactI18next`. Plik bez zależności ciężkich
 * modułów rozwiązuje to bez kopiowania tekstów.
 */
import type { TFunction } from 'i18next';

/** Humanize an unknown enum key (never surface a raw UPPER_SNAKE key). */
export const humanizeKey = (raw: string): string => {
  const spaced = raw.trim().replace(/[_-]+/g, ' ').trim().toLowerCase();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
};

/**
 * Localized initiative status label — canon §7.3: no raw enum keys in preview.
 * Tone stays owned by statusChipTone(); this only supplies the text.
 */
export const initiativeStatusLabel = (t: TFunction, raw: string): string => {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const map: Record<string, string> = {
    draft: t('preview.statuses.draft', 'Draft'),
    pending_review: t('initiatives.status.pendingReview', 'Pending review'),
    review: t('preview.statuses.review', 'In review'),
    promoted: t('initiatives.status.promoted', 'Promoted'),
    planning: t('initiatives.status.planning', 'Planning'),
    approved: t('preview.statuses.approved', 'Approved'),
    scheduled: t('initiatives.status.scheduled', 'Scheduled'),
    executing: t('initiatives.status.executing', 'Executing'),
    blocked: t('initiatives.status.blocked', 'Blocked'),
    done: t('initiatives.status.done', 'Done'),
    tracking: t('initiatives.status.tracking', 'Tracking'),
    cancelled: t('initiatives.status.cancelled', 'Cancelled'),
    archived: t('initiatives.status.archived', 'Archived'),
  };
  return map[key] ?? humanizeKey(raw);
};

/**
 * Jedno źródło prawdy dla semantyki stanu dowodu (`MethodEvidenceState`).
 *
 * ★ Powód powstania (Opus, 2026-08-13, przy naprawie MPQ Work View).
 * Ten sam zestaw czterech stanów był interpretowany RÓŻNIE w trzech
 * komponentach jednego ekranu:
 *
 *   stan          MethodNavigator   InterviewFocusPanel   LiveMatrix
 *   weak          warning           warning               neutralny
 *   missing       neutralny         warning               warning
 *   conflicting   danger            danger                warning
 *
 * Skutek: konsultant przechodzący między lewą nawigacją, panelem wywiadu i
 * macierzą widział bursztyn oznaczający trzy różne rzeczy. To nie jest
 * naruszenie reguły „kolor nigdy sam nie niesie informacji" (teksty były
 * poprawne wszędzie) — to gorszy problem: ten sam kolor ZNACZYŁ co innego.
 *
 * Kanon rozstrzyga (TOOL_SESSION_WORKSPACE_STANDARD §7 + ASSESSMENT_EVIDENCE
 * _AND_SCORING_CONTRACT.md §6):
 *
 *   complete    → success   dowód zebrany i wystarczający
 *   weak        → warning   dowód JEST, ale za słaby — realna luka do domknięcia
 *   missing     → neutralny dowodu jeszcze nie zebrano — to nie jest alarm
 *   conflicting → danger    dowody się wykluczają — blokuje freeze do rozstrzygnięcia
 *
 * ★ Dlaczego `missing` MUSI być neutralne: na starcie oceny KAŻDY obszar ma
 * `missing`. Malowanie tego bursztynem daje ścianę ostrzeżeń w sesji, w której
 * nikt jeszcze nic nie zrobił źle — i wypala uwagę na ostrzeżenia, które coś
 * znaczą. Alarm ma się zapalać, gdy coś jest NIE TAK, a nie gdy praca się
 * jeszcze nie zaczęła.
 */
import type { MethodEvidenceState } from './types';

export type EvidenceTone = 'success' | 'warning' | 'danger' | 'neutral';

export const EVIDENCE_TONE: Record<MethodEvidenceState, EvidenceTone> = {
  complete: 'success',
  weak: 'warning',
  missing: 'neutral',
  conflicting: 'danger',
};

/** Etykieta PL — nigdy nie pokazuj klientowi surowego identyfikatora stanu. */
export const EVIDENCE_LABEL_PL: Record<MethodEvidenceState, string> = {
  complete: 'dowód kompletny',
  weak: 'dowód słaby',
  missing: 'brak dowodu',
  conflicting: 'dowody sprzeczne',
};

/** Klasy „chip" (tło + tekst) dla etykiety stanu dowodu. */
export const EVIDENCE_CHIP_CLASS: Record<EvidenceTone, string> = {
  success: 'bg-c-success/10 text-c-success',
  warning: 'bg-c-warning/10 text-c-warning',
  danger: 'bg-c-danger/10 text-c-danger',
  neutral: 'bg-c-surface-raised text-c-text-secondary',
};

/** Kropka statusu w nawigatorze. */
export const EVIDENCE_DOT_CLASS: Record<EvidenceTone, string> = {
  success: 'bg-c-success',
  warning: 'bg-c-warning',
  danger: 'bg-c-danger',
  neutral: 'bg-c-text-muted',
};

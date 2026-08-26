/**
 * DRD "Pomiń z uzasadnieniem" — closed dictionary of 4 skip-reason codes.
 *
 * Decyzja właściciela DEC-2026-08-25-55 (docs/program/waves/WAVE_03_ACCEPTANCE/
 * OWNER_DECISION_LEDGER_2026-08-24.md, wiersz 107): "Cztery kody: «poza modelem
 * operacyjnym» · «poza zakresem zlecenia» · «odroczone do kolejnej rewizji» ·
 * «zastąpione innym rozwiązaniem»; wybór kodu wymagany przy decyzji Pomiń."
 *
 * A free-text justification is no longer accepted here — the picker only
 * offers these four values, so the persisted reason is always one of the
 * four canonical Polish labels below (never operator-typed text).
 *
 * Persistence note: the kernel's `AnswerEventPayload` (src/method-core/
 * contracts/events.ts) does not yet carry a dedicated `skipReason` field —
 * that would be a shared-contract change (Audits/SIRI also depend on the
 * same payload shape). Until that field exists, the picked label is written
 * into the SAME `justification` field `recordAnswer` already accepts and
 * persists end-to-end on both the legacy and HTTP DRD runtimes, prefixed so
 * it reads unambiguously as a skip rather than an ordinary answer note.
 */

export type DrdSkipReasonCode =
  | 'poza_modelem_operacyjnym'
  | 'poza_zakresem_zlecenia'
  | 'odroczone_do_kolejnej_rewizji'
  | 'zastapione_innym_rozwiazaniem';

export const SKIP_REASON_LABELS: Record<DrdSkipReasonCode, string> = {
  poza_modelem_operacyjnym: 'poza modelem operacyjnym',
  poza_zakresem_zlecenia: 'poza zakresem zlecenia',
  odroczone_do_kolejnej_rewizji: 'odroczone do kolejnej rewizji',
  zastapione_innym_rozwiazaniem: 'zastąpione innym rozwiązaniem',
};

export const SKIP_REASON_OPTIONS: ReadonlyArray<{ code: DrdSkipReasonCode; label: string }> = (
  Object.keys(SKIP_REASON_LABELS) as DrdSkipReasonCode[]
).map((code) => ({ code, label: SKIP_REASON_LABELS[code] }));

export function isDrdSkipReasonCode(value: string): value is DrdSkipReasonCode {
  return Object.prototype.hasOwnProperty.call(SKIP_REASON_LABELS, value);
}

/** `justification` text written for a skipped question — kept in one place
 * so both DRD screens format it identically. */
export function formatSkipJustification(code: DrdSkipReasonCode): string {
  return `Pominięto — ${SKIP_REASON_LABELS[code]}.`;
}

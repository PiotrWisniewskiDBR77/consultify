/**
 * Hard-disabled gate for the legacy ISO 27001 preset (#19c,
 * `ISO_27001_PRESET` in auditPresets.ts).
 *
 * AMD-AUD-RIGHTS-001 (docs/program/evidence/closure/decisions/
 * INTERNAL_BETA_OWNER_DECISIONS_20260817_AMENDMENT.json, 2026-08-17): "The
 * legacy ISO 27001 preset must be default-OFF and inaccessible without a
 * future rights-cleared decision." The preset is static frontend data with
 * no `audit_norm_sources` row and no `packValidator` gate — it bypasses the
 * rights kernel entirely, so launching it produces a program whose criteria
 * trace to no rights-checked source.
 *
 * This gate has NO runtime input of ANY kind, deliberately:
 *   - no URL query parameter,
 *   - no localStorage / sessionStorage key,
 *   - no `import.meta.env` / `process.env` variable,
 *   - no test-only or development-only escape hatch,
 *   - no feature-flag registry entry (it is intentionally absent from
 *     `feature_flags` and from `g4_test_flag_overrides`, so neither the
 *     product flag resolver nor the G4 fixture override system can reach it).
 *
 * An earlier revision of this gate was a conventional runtime flag, matching
 * the sibling `auditProgramEditStubFlag.ts` pattern. That was wrong for this
 * specific gate: a user — or a script, or a copy-pasted support link — could
 * self-activate a preset implying ISO 27001 rights Consultify has not
 * verified. A user may not grant themselves rights or licensing. The sibling
 * pattern is fine for hiding an unfinished screen; it is not fine for a
 * rights boundary.
 *
 * Changing this value therefore requires editing this constant and shipping a
 * new build, which is the point: reactivation is a repo-owned product/legal
 * decision (AUD-POL-001 decision packet, Section 1 item 2 / Section 3 option
 * B), not something any runtime input can flip.
 */
export const AUDIT_ISO27001_LEGACY_PRESET_ENABLED = false as const;

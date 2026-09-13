# F2-1 E1 shell and schedule checkpoint

Status: **PARTIAL / HOLD for full E1**. This checkpoint implements the flag-gated register shell and schedule views only. It does not claim I1.6-I1.18, consulting-quality portfolio analysis, a durable analysis queue, bulk decision acceptance, or DEC-479 disposition completion.

## 1.0 Binding owner decisions

- DEC-479: portfolio disposition is a separate `IN / PARKING / ARCHIVE` fact with reason, deciding actor, decision time, frozen input snapshot, and return condition. It does not add lifecycle statuses. Legacy `REJECTED -> CLOSED` projection must retain rejection meaning through disposition. This checkpoint does not write disposition.
- DEC-480: E3 capacity is measured per person from each person's declared percentage of weekly time; values above 100% are critical. Roles are summaries only. This is recorded here but is outside E1 implementation.

## Delivered subset

- `VITE_INITIATIVES_FOUR_BUTTONS` is default OFF and enables the new surface only for exact `true`.
- Menu 2 keeps exactly the existing four functions in owner order; the mounted contract verifies Initiatives, Plan, Load and Work report.
- Menu 3 for Initiatives has two button chips and preserves legacy `?lens=` aliases.
- Project and Current/Archive filters live in Menu 2. Both runtime lifecycle `ARCHIVED` and the classic projection `archived` flag are mapped into the shared row; reconciliation preserves an archived value from either source. Current and Archive are mutually exclusive.
- List view modes expose Table, Kanban, Gantt, Calendar. `timeline` is locally labelled Gantt without changing shared labels for other modules.
- One horizon control provides 1/3/6/12 months. Calendar uses weekly ticks for 1/3 and monthly ticks for 6/12. Gantt always uses weekly ticks. Its header and row SVGs share one physical timeline width, including at 6/12 months.
- Calendar header and rows use the same proportional time-cell widths inside the same explicit timeline width at both weekly and monthly granularities; the cells cover the complete track without a blank tail. Gantt tick positions and SVG bars use that same date-to-pixel scale. The axis derives the semantic month from the anchor's local calendar fields before storing UTC dates, so a Chicago September 30 evening does not jump to October.
- Missing/invalid dates remain visible as schedule unavailable. Fully out-of-horizon work is counted and does not render a false edge bar.
- New copy has English and Polish flag-specific locale keys; the flag-OFF workspace retains its existing copy and controls.
- Flag-owned filter/data state is cleared when user or organization identity changes. A request-generation guard prevents a delayed response from the previous identity from refilling the register.

## Explicitly open before E1 can be accepted

- Table 2 must be a governed StandardTable + StandardPreview over durable analysis items with visible source/provenance.
- Portfolio analysis needs a versioned input snapshot, `asOf`, rules and real model output; the existing deterministic portfolio health service remains insufficient. A temporary client-side Jaccard implementation was removed during independent review.
- Each observation/recommendation/decision item needs rationale, evidence, confidence, alternatives and missing data, plus per-item and homogeneous bulk human acceptance.
- Accepted selections must use canonical `portfolioDecision`; no list PATCH.
- DEC-479 needs additive aggregate-JSON contract and readback, including return-condition suppression and reappearance after the condition changes. No migration is required for the generic aggregate store; no migration was added.
- Real-model quality proof on two distinct organization contexts and built light/dark browser evidence remain open.

## Evidence

- Baseline Menu 3 behavior RED: `menu3-filters-red.json` (exact-base Hub, candidate test; exit 1).
- Final focused candidate: `e1-shell-green-v15.json`, 5 test files / 21 tests PASS under `TZ=America/Chicago`, SHA256 `5174a093893aa30c0578274f86969fe7441e256868b239d4a9999be462af21d2`.
- The final denominator includes behavior for both archive source shapes, canonical-true/classic-false precedence, exact four Menu 2 tabs and order, project filtering with a matching status denominator, exact-`true` flag exposure, flag-OFF parity, delayed organization A response after organization B is active, complete-track Calendar 1/6-month geometry, the Chicago month boundary, Gantt weekly 6/12-month axes, one-month Gantt tick/bar alignment, outside-horizon omission, and shared Gantt header/body geometry.
- Shared `ModuleNavBar` safety/a11y regression: `module-nav-bar-green-v1.json`, 2 tests PASS, SHA256 `436552a938bced1f7660699c7ecf3482109df0002497d7e4d9d730ce62f3f4c9`.
- Scoped ESLint for the 12 substantive formatted files: `e1-shell-eslint-v16.json`, 0 errors / 137 warnings, SHA256 `900107e20e49d5ea8e0c80844c710960bdca3d8f18df56361d02fbbbc0df78a6`. EN/PL JSON parse, `git diff --check`, and the staged `check-triada.sh` scan of the new schedule view pass after replacing the two rejected crimson tokens with neutral slate state colors.
- `StandardModuleBar.tsx` is deliberately a three-line prop/pass-through diff. Exact-base and candidate lint each report the same 43 formatting/import errors and 12 warnings (`standard-module-bar-base-candidate-lint-v1.json`, SHA256 `184cbf6bd8eb856df88018cb08746385cb147d43637445998fb1fccf10b78891`); reformatting the whole inherited file would add a 49+/49- churn unrelated to this contract. Its existing test file has four Router-setup failures and is not counted as GREEN or as a candidate regression. The combined historical runner also has two unrelated language-harness failures (`e1-shell-regression-v1.json`). This remains an evidence gap for the normal hook rather than a passed check.
- `check-list-canon.sh --all`: 158 files, 322 current violations, repository baseline 357, exit 0. The KANAL values 125/361 are stale for exact base `cfea70de8a`.
- `check-artefakt.sh --report`: crimson 8, R1 warnings 2, R2+R3 0, danger 117, exit 0. `--all` is not a supported invocation and exits 2.

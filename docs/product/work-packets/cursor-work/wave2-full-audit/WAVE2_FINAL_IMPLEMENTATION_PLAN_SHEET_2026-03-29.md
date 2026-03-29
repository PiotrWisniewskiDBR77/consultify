# Wave 2 Final Implementation Plan - Sheet

Date: 2026-03-29
Module: `Sheet`
Scope: final implementation plan for the governed Wave 2 sheet artifact contract

## 1. Scope

This plan covers only `Sheet` as the third governed artifact class in the Wave 2 family.

It does not widen scope into:

- full spreadsheet-suite parity
- every table or database workflow in the product
- fake export-only sheet claims

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_A_OUTPUTS_AND_ARTIFACT_FAMILY.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_SHEET.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_GAP_BACKLOG_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- governed workbook-style artifacts with durable identity, honest limits, and basic reopen continuity

Benchmark interpretation:

- real artifact identity matters more than broad spreadsheet parity
- honest non-goals matter more than fake completeness
- persistence and reopen must be explicit

## 4. Intended Final Product Behavior

`Sheet` should behave like a real governed artifact type:

- create or materialize from declared context
- land in the library with durable identity
- reopen honestly within the declared scope
- export without pretending to be a full spreadsheet suite

## 5. Current Repo Truth

What is already true:

- bounded substrate for sheet artifacts exists
- the family already recognizes `Sheet` as a planned artifact class

What is still incomplete:

- end-to-end `Sheet` product truth remains the weakest artifact contract
- persistence, reopen, and runtime honesty still need one explicit closure packet
- the broad gap to spreadsheet-suite expectations remains intentionally open

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | bounded substrate | real sheet artifact | product honesty |
| `Flow completeness` | materialize basics | create-store-open-export sequence | lifecycle closure |
| `UX quality` | partial | honest and explicit limits | non-goal clarity |
| `Data / logic quality` | identity exists | stable persistence and reopen semantics | persistence depth |
| `Integration quality` | family slot exists | clean library and family participation | family closure |
| `Trust / governance / error handling` | partial | no fake parity claims | trust honesty |
| `Market standard fit` | low | credible bounded artifact | expectation control |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Sheet contract alignment packet` | make the product claim honest | contract, naming, artifact semantics, non-goals | one clear bounded `Sheet` promise | full spreadsheet suite | the user can tell what `Sheet` is and is not |
| `Sheet governed runtime packet` | close the real lifecycle | materialize, persist, list, open, export | one believable governed sheet runtime | every table/database workflow | a declared sheet can be created, found, and reopened honestly |
| `Sheet library and family packet` | converge with the artifact family | library listing, type semantics, traceability | sheet behaves like a true family member | full rich authoring parity | the library and adjacent surfaces treat `Sheet` as one explicit artifact class |

## 8. Dependencies And Risks

Dependencies:

- `Outputs Library`
- `ArtifactRun z czatu`
- `Provenance / review / visibility`

Risks:

- calling export-only behavior a finished product
- importing spreadsheet ambition before the bounded contract is credible
- confusing `Sheet` with broader tables or database products

## 9. Final Acceptance Bar

`Sheet` is finally implemented for its declared Wave 2 role only when:

- the user sees one honest bounded `Sheet` contract
- declared sheet artifacts can be created, stored, listed, and reopened
- library and family semantics stay consistent
- the module does not overclaim spreadsheet-suite parity

## 10. Non-Goals And Unsafe Claims

Non-goals:

- Excel or Google Sheets parity
- full formula, collaboration, and modeling depth
- replacing broader table/database products

Unsafe claims until separately proven:

- `Sheet is now a full spreadsheet product`
- `all spreadsheet expectations are covered`
- `bounded sheet substrate already closes the broad category gap`

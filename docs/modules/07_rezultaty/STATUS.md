---
module_id: MODULE_RESULTS
doc_kind: STATUS
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Status — Rezultaty / Results & Value Realization

## Current Module Status

- docs integration status: `APPROVED_FOR_DOCS`
- runtime status: `BLOCKED_P1`
- gate status: `PASS` (`0` errors, `0` warnings)
- canonicalization status: `DONE_DOC` — duplicate frontmatter and repeated packet/status blocks removed on 2026-05-11.

## Runtime Baseline Tags

- `real`: `/benefits` mounts `ResultsHub` and serves primary Results functions.
- `partial`: `/kpi-okr` companion route remains active and is impact-only in current docs.
- `real`: V8 results contracts are active through `src/services/api/v8/results.ts`.
- `pass_with_p2`: some high-impact claims remain evidence-depth follow-ups by design.

## Function Readiness Snapshot

| Function | Docs gate | Runtime posture | Open evidence |
| --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | `APPROVED_FOR_DOCS` | `WAITING_P2_EVIDENCE_DEPTH` | dedicated initiatives-tab branch assertion depth. |
| `RZ_KPI_WORKSPACE` | `APPROVED_FOR_DOCS` | `WAITING_P2_EVIDENCE_DEPTH` | direct scorecards/lifecycle evidence depth. |
| `RZ_REPORTS_WORKSPACE` | `APPROVED_FOR_DOCS` | `BLOCKED_P1` | approval/finalization guard and no-hidden-finalization regression. |
| `RZ_ROI_TRACKING` | `APPROVED_FOR_DOCS` | `WAITING_P2_EVIDENCE_DEPTH` | no-leak ownership proof against Finance-owned truth. |
| `RZ_ROI_ANALYSIS` | `APPROVED_FOR_DOCS` | `BLOCKED_P1` | explicit approval/lock state and no-hidden-approval proof. |
| `RZ_KPI_OKR_ROUTE` (impact-only) | `PASS_WITH_P2` | `P2_DECISION_PENDING` | owner decision: parallel vs alias vs retirement. |

## Normalized Gap Summary

| Priority | Count | Summary |
| --- | --- | --- |
| `P0 must close` | `0` | docs canonicalization and taskboard mapping are closed. |
| `P1 runtime evidence` | `3` | reports guard, ROI analysis approval/lock proof, branch-depth assertions. |
| `P2 premium hardening` | `3` | R1-R4 lineage, Results/Finance no-leak proof, `/kpi-okr` strategy. |

## Decision

Docs are approved for continued work. Runtime full-go remains `BLOCKED_P1` until the P1 evidence rows above are closed with route/component/API/test proof.

## Pomiar 2026-09-01 — widoczność OKR/ROI na demo, mianownik pokrycia, crosswalk

Pełne cytaty i metoda: `docs/functional/POMIAR_2026-09-01_FINANSE_WYNIKI_MATERIALY.md`
(sekcja 2); źródła: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY234_WYNIKI_REPORT.md`,
`docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`.

- ★ **OBALONE 1.09.** Nadzorca powiedział właścicielowi „OKR i ROI są
  niewidoczne na demo, ~22 z 33 elementów nikt nie zobaczy". **Obie części
  fałszywe.** Zmienna środowiskowa `VITE_DEMO_ACCEPTANCE` jest ustawiona na
  `demo.consultify.ai` (potwierdził właściciel w Railway 28.08,
  `DEC-2026-08-28-216`) i działa jako wczesny `return true` w
  `isDemoAcceptanceProfileEnabled`, który omija logikę flag KPI/ROI/OKR.
  **Realny stan:** gołe repo bez zmiennych — `24/33` elementów nieosiągalne;
  realny `demo.consultify.ai` — `0/33` nieosiągalne. Zawsze podawać obie
  liczby razem z kontekstem, który jest który.
- `withdrawn`: mianownik pokrycia tras mutujących **`135` nie jest
  odtwarzalny żadną zmierzoną metodą i jest wycofany**. Trzy reprodukowalne
  metody dają `130` (literalne rejestracje), `146` (literalne + wywołania
  helperów) i `152` (introspekcja zbudowanych stosów Express w runtime —
  najdokładniejsza). Wybór kanonicznego mianownika (146 vs 152) jest
  **nierozstrzygnięty**, decyzja należy do nadzorcy.
- `gap`: mechanizm crosswalk/backfill KPI (`kpiCrosswalkService.ts:36,74`,
  `kpiShadowReadService.ts:56`) ma **zero wołaczy produktowych** — biblioteka
  bez wywołania. Montaż wymaga osobnej decyzji produktowej.

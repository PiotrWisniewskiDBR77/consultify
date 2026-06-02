# Operator Start Here - Final Closeout (2026-05-28)

Status: `day_0_entrypoint`

Audience: CTO / Delivery Owner / module owner

Purpose: jeden startowy dokument, ktory prowadzi krok po kroku od zera do aktywnego execution.

---

## 1) Start in 15 minutes

1. Otworz `FINAL_CLOSEOUT_ACCEPTANCE_REQUIREMENTS_AND_GATES_2026-05-28.md`.
2. Otworz `S0_PROGRAM_BOARD_STATUS_2026-05-28.md`.
3. Potwierdz aktywne WIP=2:
   - `18 Ustawienia`
   - `17 Panel Administratora`
4. Otworz odpowiednie G1 runbooki:
   - `G1_CHECK_RUN_TEMPLATE_18_USTAWIENIA_2026-05-28.md`
   - `G1_CHECK_RUN_TEMPLATE_17_PANEL_ADMINISTRATORA_2026-05-28.md`
5. Uruchom G1 dla obu aktywnych modułów.

---

## 2) Canonical execution pack

Minimum set:

- `FINAL_SYSTEM_CLOSEOUT_EXECUTION_PATH_2026-05-28.md`
- `FINAL_CLOSEOUT_ACCEPTANCE_REQUIREMENTS_AND_GATES_2026-05-28.md`
- `FINAL_CLOSEOUT_EPICS_AND_USER_STORIES_ALL_MODULES_2026-05-28.md`
- `FINAL_CLOSEOUT_MODULE_ACCEPTANCE_CHECKLISTS_ALL_19_2026-05-28.md`
- `S0_PROGRAM_BOARD_STATUS_2026-05-28.md`
- `S1_CONTRACT_READINESS_MATRIX_2026-05-28.md`

---

## 3) What to do each day (short version)

1. Update S0 board (status/blocker/next step).
2. Run gates for max 2 active modules.
3. Record decisions in gate register.
4. Move next module from queue only if no `BLOCKED_P1`.
5. Publish day-end report.

---

## 4) Hard rules

- Zero pracy bez kontraktu.
- Zero pracy poza aktywnym WIP=2.
- Zero "done" bez evidence.
- `BLOCKED_P1` zatrzymuje lane.
- Brak `GO` bez security/tenant checks.

---

## 5) Ready-to-run checklist (today)

- [ ] S0 board updated with real owners.
- [ ] S1 matrix updated for `17` and `18`.
- [ ] G1 executed for `17`.
- [ ] G1 executed for `18`.
- [ ] Decisions logged in board.
- [ ] Next queue candidate selected (`01 Czat` or `02 Moja Praca`).

---

## 6) End-of-day deliverable

Create one report:

`DAY_REPORT_YYYY-MM-DD.md`

Required sections:

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step


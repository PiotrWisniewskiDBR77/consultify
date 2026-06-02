# S5 - Artifact Tools Closeout

Stage id: `S5`

Stage goal: domknac moduly artifactowe do poziomu produkcyjnie wiarygodnego workflow.

Target duration: 4-7 dni

In-scope modules:

- Excel
- Word
- Prezentacje

---

## 1) Definition of Ready (DoR)

- [ ] S4 ma wynik `GO`.
- [ ] Kontrakty Excel/Word/Prezentacje sa approved.
- [ ] Kryteria export i quality gate sa zdefiniowane.

---

## 2) Operational checklist

Per module:

- [ ] Core workflow: create -> edit -> save -> reopen -> export.
- [ ] Save state vs lifecycle state sa rozdzielone.
- [ ] Read-back po refresh.
- [ ] Error/degraded states sa uczciwe.
- [ ] Brak raw internals.

Shared layout and UX:

- [ ] 3-strefowy layout zgodny z kanonem.
- [ ] Menu 2 i Menu 3 zgodne z governance.
- [ ] Teresa jako jedyny agent czatu.
- [ ] Akcje AI po prawej stronie Menu 3.

---

## 3) Epics and tasks

## EPIC-S5-1 Word module closure

- T1: Document authoring reliability.
- T2: Save/reopen/export stability.
- T3: QA and governance readback.

## EPIC-S5-2 Excel module closure

- T1: Sheet edit and data persistence.
- T2: Structured output integrity.
- T3: Export parity.

## EPIC-S5-3 Presentation module closure

- T1: Deck editing stability.
- T2: Theme/layout continuity.
- T3: Export and review flow integrity.

## EPIC-S5-4 Cross-module artifact consistency

- T1: Shared UX invariants.
- T2: Lifecycle and save-state correctness.
- T3: Auditability of critical actions.

---

## 4) Test checklist (S5)

### Technical gate

- [ ] API Gate for artifact operations.
- [ ] DB-Compat for save/version data.
- [ ] UI Smoke for create/edit/save/export.

### Functional gate

- [ ] Word workflow smoke.
- [ ] Excel workflow smoke.
- [ ] Prezentacje workflow smoke.
- [ ] Reopen after refresh smoke.

### UX and governance gate

- [ ] Save vs lifecycle correctness test.
- [ ] Menu 3 AI placement audit.
- [ ] Teresa-only agent visibility test.

### Manual evidence

- [ ] Focused Anygravity pass for each module.

---

## 5) Gate criteria

### GO

- Wszystkie 3 moduly artifactowe maja min. `PASS_WITH_P2`.
- Export workflow jest potwierdzony.
- UI/UX i governance gate sa zaliczone.

### NO_GO

- Nieprzechodzacy core workflow.
- Brak read-back po refresh.
- Niespelnione kryteria agent/menu governance.

---

## 6) Required output artifact

`S5_ARTIFACT_TOOLS_EVIDENCE_PACK.md`:

1. module decisions
2. export verification
3. UI/UX compliance
4. residual P2 ownership

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step
6. Deploy decision


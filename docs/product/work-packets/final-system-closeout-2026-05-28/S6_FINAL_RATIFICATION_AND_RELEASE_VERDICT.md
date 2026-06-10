# S6 - Final Ratification And Release Verdict

Stage id: `S6`

Stage goal: wydac finalny, uczciwy werdykt release oparty o dowody.

Target duration: 1-2 dni

---

## 1) Definition of Ready (DoR)

- [ ] S5 ma wynik `GO`.
- [ ] Kazdy modul ze scope ma final decision.
- [ ] Evidence packs dla stage S0-S5 sa kompletne.

---

## 2) Operational checklist

- [ ] Zrekoncyliowac wszystkie decisions modulowe.
- [ ] Potwierdzic brak otwartego P0/P1 bez ownera i planu.
- [ ] Potwierdzic security/tenant closure.
- [ ] Potwierdzic UI/UX closure dla modulow UI.
- [ ] Potwierdzic testing canon decisions.
- [ ] Oznaczyc wszystkie residual P2 i ownerow.
- [ ] Podjac finalny verdict:
  - `GO`
  - `GO_WITH_LIMITATIONS`
  - `NO_GO`

---

## 3) Epics and tasks

## EPIC-S6-1 Evidence reconciliation

- T1: Zebranie evidence stage S0-S5.
- T2: Ujednolicenie statusow.
- T3: Sprawdzenie traceability.

## EPIC-S6-2 Risk ownership

- T1: Przypisac ownerow dla residual P2.
- T2: Ustalic daty i follow-up.
- T3: Oznaczyc ryzyka po-release.

## EPIC-S6-3 Release verdict

- T1: Przygotowac final board.
- T2: Przeprowadzic final gate review.
- T3: Opublikowac decyzje GO/NO_GO.

---

## 4) Test checklist (S6)

### Final technical sweep

- [ ] Final system smoke cross-module.
- [ ] Final auth/tenant sanity.
- [ ] Final route availability sanity.

### Final UX trust sweep

- [ ] Brak fake success na krytycznych flow.
- [ ] Degraded state honesty.
- [ ] Refresh resistance on key paths.

### Final governance sweep

- [ ] Proposal/approval/audit contract preserved.
- [ ] No hidden learning and no silent execution.
- [ ] ACL and tenant guardrails hold.

---

## 5) Gate criteria

### GO

- Wszystkie moduly maja finalny decision.
- Brak niezarzadzonych P0/P1.
- Evidence i traceability sa kompletne.

### GO_WITH_LIMITATIONS

- Brak P0/P1.
- Sa znane P2 z ownerami i terminami.
- Ograniczenia sa jawnie opisane.

### NO_GO

- Otwarty P0/P1 bez mitigacji.
- Brak krytycznego evidence.
- Niespelnione security/tenant warunki.

---

## 6) Required output artifact

`S6_FINAL_RELEASE_VERDICT_REPORT.md`:

1. final decision
2. module-by-module decision map
3. unresolved risks and owners
4. release recommendation
5. immediate next actions

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step
6. Final release verdict


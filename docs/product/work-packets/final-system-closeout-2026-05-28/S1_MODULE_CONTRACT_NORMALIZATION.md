# S1 - Module Contract Normalization

Stage id: `S1`

Stage goal: doprowadzic kazdy modul do kompletnego kontraktu delivery i planu sprintowego.

Target duration: 2-3 dni

---

## 1) Definition of Ready (DoR)

- [ ] S0 ma wynik `GO`.
- [ ] Lista modulow i ownerow jest zatwierdzona.
- [ ] Dostepny jest template kontraktu.

---

## 2) Operational checklist

Dla kazdego modulu:

- [ ] Goal i measurable outcome.
- [ ] Non-goals.
- [ ] Source of truth.
- [ ] Locked decisions before start.
- [ ] Scope in: create/update/untouched files.
- [ ] Acceptance criteria.
- [ ] Validation matrix (unit/integration/ui/smoke/manual/security).
- [ ] UI/UX gate matrix (jesli UI w scope).
- [ ] Testing canon mapping.
- [ ] Risk register + rollback.
- [ ] Open questions <= 3.
- [ ] Ordered sprint plan.

---

## 3) Epics and tasks

## EPIC-S1-1 Contract completion wave A

- T1: Kontrakty dla fundamentu (setting/admin + zaleznosci).
- T2: Walidacja kompletności sekcji.
- T3: Zamkniecie open questions.

## EPIC-S1-2 Contract completion wave B

- T1: Kontrakty dla core experience.
- T2: Walidacja matrix testow i UI gate.
- T3: Plan approval.

## EPIC-S1-3 Contract completion wave C

- T1: Kontrakty dla Idea i artifact tools.
- T2: Risk alignment i hard-stop review.
- T3: Final contract readiness review.

---

## 4) Test checklist (S1)

### Contract completeness tests

- [ ] 100% wymaganych sekcji kontraktu.
- [ ] Brak "TBD" w sekcjach krytycznych.
- [ ] Scope jest frozen i rozlaczny z scope out.

### Planning integrity tests

- [ ] File map jest konkretny.
- [ ] Kolejnosc sprintow jest wykonalna.
- [ ] Ryzyka maja mitigacje i ownerow.

---

## 5) Gate criteria

### GO

- Wszystkie moduly maja kompletne kontrakty.
- Plan approval gate przechodzi dla kazdego modulu.
- Open questions >3 nie istnieja.

### NO_GO

- Braki w sekcjach kontraktu.
- Brak validation matrix albo risk register.
- Niejasny scope in/out.

---

## 6) Required output artifact

`S1_CONTRACT_READINESS_MATRIX.md`:

1. modul
2. contract completeness (`yes/no`)
3. approval status
4. blockers
5. next sprint start readiness

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step


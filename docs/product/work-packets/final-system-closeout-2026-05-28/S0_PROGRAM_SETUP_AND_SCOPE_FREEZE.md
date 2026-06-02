# S0 - Program Setup And Scope Freeze

Stage id: `S0`

Stage goal: uruchomic program closeout na jednym, zamrozonym zakresie.

Target duration: 1-2 dni

---

## 1) Definition of Ready (DoR)

- [ ] Owner programu wskazany.
- [ ] Lista modulow closeout potwierdzona.
- [ ] Kanon dokumentacyjny wskazany.
- [ ] WIP rule (`max 2`) zaakceptowana.

---

## 2) Operational checklist

- [ ] Potwierdz scope in (15 modulow).
- [ ] Potwierdz scope out (bez nowych feature).
- [ ] Nadaj status startowy kazdemu modulowi:
  - `READY`
  - `PARTIAL`
  - `BLOCKED_P1`
  - `DEFERRED`
- [ ] Przypisz ownera i backup ownera do kazdego modulu.
- [ ] Ustal kolejnosc closeout (lane order).
- [ ] Potwierdz hard-stopy.
- [ ] Potwierdz format raportowania gate.

---

## 3) Epics and tasks

## EPIC-S0-1 Scope lock

- T1: Zamrozic liste modulow.
- T2: Potwierdzic scope out.
- T3: Oznaczyc rzeczy zdeferowane.

## EPIC-S0-2 Program board

- T1: Stworzyc board statusow.
- T2: Dodac ownerow.
- T3: Dodac lane order i WIP limits.

## EPIC-S0-3 Governance setup

- T1: Ustalic kanon dokumentow.
- T2: Potwierdzic hard-stopy.
- T3: Potwierdzic GO/NO_GO cadence.

---

## 4) Test checklist (S0)

### Docs and governance tests

- [ ] Wszystkie linki do SoT dzialaja.
- [ ] Nie ma konfliktu kanonu i planu wykonawczego.
- [ ] Wszystkie moduly maja status i ownera.

### Program sanity tests

- [ ] WIP=2 wymuszone.
- [ ] Brak modulu bez statusu startowego.
- [ ] Brak modulu bez next action.

---

## 5) Gate criteria

### GO

- Wszystkie 15 modulow ma status startowy, ownera i next action.
- Scope freeze jest jawnie zatwierdzony.
- Brak otwartych blokad governance.

### NO_GO

- Brakuje ownerow lub statusow.
- Scope pozostaje niezamrozony.
- Brak potwierdzonego formatu gate evidence.

---

## 6) Required output artifact

`S0_PROGRAM_BOARD_STATUS.md` zawierajacy:

1. modul
2. status startowy
3. owner
4. blocker
5. next step

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step


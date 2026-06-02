# S3 - Core Experience Closeout

Stage id: `S3`

Stage goal: domknac rdzen produktu widoczny codziennie dla uzytkownika.

Target duration: 4-7 dni

In-scope modules:

- Czat
- Canvas
- Teresa
- Radar
- Calendar
- Zarzadzanie taskami
- PMO funkcje

---

## 1) Definition of Ready (DoR)

- [ ] S2 ma wynik `GO`.
- [ ] Kontrakty ww. modulow sa approved.
- [ ] Krytyczne zaleznosci runtime sa stabilne.

---

## 2) Operational checklist

Dla kazdego modulu:

- [ ] Access/load dziala.
- [ ] Core workflow przechodzi end-to-end.
- [ ] Brak martwej glownej akcji.
- [ ] Save/read-back i refresh resistance.
- [ ] Error/degraded/empty states sa uczciwe.
- [ ] Toast/banner feedback jest poprawny.
- [ ] Brak silent write i hidden learning.

Cross-module:

- [ ] Handoff miedzy Czat-Canvas-Teresa jest czytelny.
- [ ] Radar sygnaly prowadza do wykonalnej akcji.
- [ ] Calendar/Tasks/PMO petla operacyjna jest spojna.

---

## 3) Epics and tasks

## EPIC-S3-1 Chat and Teresa reliability

- T1: Stabilizacja send/response loop.
- T2: Handoff governance (proposal/approval/audit).
- T3: Error and retry trust behavior.

## EPIC-S3-2 Canvas continuity

- T1: Save and read-back hardening.
- T2: Refresh persistence.
- T3: Artifact context integrity.

## EPIC-S3-3 Radar operational value

- T1: Signal freshness and load consistency.
- T2: Actionability handoff proof.
- T3: Degraded honesty.

## EPIC-S3-4 Calendar tasks PMO loop

- T1: Calendar and task continuity.
- T2: PMO visible execution control.
- T3: Workflow closure proof.

---

## 4) Test checklist (S3)

### Mandatory 3-step gate

- [ ] API Gate.
- [ ] DB-Compat Gate.
- [ ] UI Smoke Gate.

### Module-level test list

- [ ] Czat smoke + failure path.
- [ ] Canvas save/read-back.
- [ ] Teresa proposal/approval path.
- [ ] Radar signal/readback.
- [ ] Calendar flow smoke.
- [ ] Tasks flow smoke.
- [ ] PMO action flow smoke.

### Manual evidence

- [ ] Focused Anygravity manual per core module.
- [ ] UI/Network/Console evidence attached.

---

## 5) Gate criteria

### GO

- Wszystkie moduły core maja co najmniej `PASS_WITH_P2`.
- Brak otwartego `BLOCKED_P1`.
- Cross-module handoff jest udowodniony.

### NO_GO

- Krytyczne workflow nie przechodzi.
- Dane gina po refresh.
- Brak wiarygodnych dowodow manual/API.

---

## 6) Required output artifact

`S3_CORE_EXPERIENCE_GATE_BOARD.md`:

1. modul
2. decision
3. critical findings
4. evidence refs
5. residual P2

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step
6. Testing canon decision


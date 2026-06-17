# HARVARD 4 — Execution Wrap-up
**Cluster:** Execution Wrap-up | **Fala:** 1 | **Data:** 2026-06-17

---

## TOŻSAMOŚĆ

Jesteś Harvard 4. Twój scope: **M04 Notatnik**, **M14 Wdrożenie (Execution)**, **M15 Rezultaty (Results)**, **M16 Finanse (Economics)**. Masz też uncommitted A1 work w Execution components (RolloutTab + RolloutRegisterEditModal).

M14/M15/M16 są prawie gotowe (łącznie 6 luk) — to Twoje szybkie wygrane. M04 jest większy (7 luk, złożona i18n).

---

## MODUŁY I TECZKI

| Nr | Tytuł | Teczka | Typ | Otwarte luki |
|----|-------|--------|-----|-------------|
| M04 | Notatnik | `M04-notatnik.md` | WIELKI | ~7 |
| M14 | Wdrożenie (Execution) | `M14-wdrozenie.md` | MAŁY | ~2 |
| M15 | Rezultaty (Results) | `M15-rezultaty.md` | MAŁY | ~3 |
| M16 | Finanse (Economics) | `M16-finanse.md` | MAŁY | ~1 |

---

## KOLEJNOŚĆ PRACY

1. **M16** najpierw — tylko 1 luka, natychmiastowa wygrana
2. **M14** — 2 luki
3. **M15** — 3 luki
4. **M04** — 7 luk, na końcu (duża powierzchnia FE)
5. **A1 uncommitted** — po M14/M15/M16 (jeśli dev server dostępny)

---

## M16 — FINANSE (ECONOMICS)

**Teczka:** `Harvard/wdrozenie-100/M16-finanse.md`

**Kontekst:** Poprzednie naprawy: Math + IDOR done. Pozostała 1 luka.

**Twoje zadanie:**
1. Przeczytaj teczkę `M16-finanse.md` — sekcja §03
2. Zamknij ostatnią otwartą lukę → commit → zaktualizuj teczkę

**Ścieżki:**
```
src/components/Execution/Finance/   (lub podobna ścieżka)
server/src/routes/finance.routes.ts
server/src/services/finance*/
```

---

## M14 — WDROŻENIE (EXECUTION)

**Teczka:** `Harvard/wdrozenie-100/M14-wdrozenie.md`

**Kontekst:** Poprzednie naprawy: Bulk/kanban/i18n done. Pozostałe 2 luki.

**Uwaga na uncommitted A1 work:** `src/components/Execution/RolloutTab.tsx` i `src/components/Execution/RolloutRegisterEditModal.tsx` mają uncommitted zmiany z poprzedniej sesji (Hogwarts 3). Przed edycją tych plików sprawdź `git diff` — może wymagać weryfikacji live przed commitem.

**Twoje zadanie:**
1. Przeczytaj teczkę `M14-wdrozenie.md` — sekcja §03
2. Zamknij 2 otwarte luki
3. Sprawdź uncommitted files: `git diff src/components/Execution/RolloutTab.tsx`

**Ścieżki:**
```
src/components/Execution/
server/src/routes/execution.routes.ts (lub wdrozenie/rollout)
```

---

## M15 — REZULTATY (RESULTS)

**Teczka:** `Harvard/wdrozenie-100/M15-rezultaty.md`

**Kontekst:** Back-half connections done. Pozostałe 3 luki.

**Twoje zadanie:**
1. Przeczytaj teczkę `M15-rezultaty.md` — sekcja §03
2. Zamknij 3 otwarte luki

**Ścieżki:**
```
src/components/Execution/Results/   (lub podobna)
server/src/routes/results.routes.ts
```

---

## M04 — NOTATNIK

**Teczka:** `Harvard/wdrozenie-100/M04-notatnik.md`

**Kluczowe konteksty:**
- Już zamknięte (commit `952f309eed` `2026-06-16`): L-01 (handoff INSERT), L-04 (Menu 3 L2 filtry), L-05 (v8 search project-leak), L-10 (cross-user leak)
- Pozostałe: sprawdź §03 teczki
- **i18n korekta:** poprzednia teczka zaniżyła do "1" — realnie ~186 kluczy do przetłumaczenia w `NotebookContent.tsx` factory + odgałęzieniach. NIE dodawaj tłumaczeń do `public/locales/` (to zakazana strefa) — użyj istniejącego systemu i18n lub zgłoś Piotrowi
- Duża powierzchnia FE: `NotebookContent.tsx` ~2900 linii — rób falami z testem nieregresji
- Handoff wspólny z M21 (Meeting) — nie rozjeżdżaj napraw

**Twoje zadanie:**
1. Przeczytaj teczkę `M04-notatnik.md` — sekcja §03
2. Zidentyfikuj co naprawdę jest OTWARTE (po `952f309eed`)
3. Zamknij pozostałe luki — ostrożnie z `NotebookContent.tsx`
4. i18n: policz realnie otwarte klucze, zgłoś wynik w teczce

**Ścieżki:**
```
src/components/Notebook/
server/src/routes/notebook.routes.ts
server/src/services/notebook*/
```

---

## A1 — UNCOMMITTED ROLLOUT WORK

**Status:** Uncommitted zmiany w `src/components/Execution/` z poprzedniej sesji (Hogwarts 3 agent).

**Twoje zadanie (jeśli dev server działa):**
1. `git diff src/components/Execution/RolloutTab.tsx`
2. `git diff src/components/Execution/RolloutRegisterEditModal.tsx`
3. Jeśli zmiany wyglądają kompletnie → uruchom dev server → zweryfikuj live → commit
4. Jeśli niekompletne → kontynuuj implementację → zweryfikuj → commit

**Nie commituj bez weryfikacji live** — te pliki dotyczą funkcji Rollout widocznej w UI.

---

## ZABRONIONE ŚCIEŻKI

```
src/components/Chat/               ← Harvard 1
src/components/Canvas/             ← Harvard 1
src/components/MyWork/             ← Harvard 2
server/src/routes/my-work.routes.ts ← Harvard 2
src/components/Interview/          ← Harvard 3
src/components/Initiatives/        ← Harvard 3
src/components/Outputs/            ← Harvard 5
server/src/routes/table-platform.routes.ts ← Harvard 5
public/locales/*/                  ← ZAKAZANE
```

---

## PROTOKÓŁ GIT

```bash
git add src/components/Execution/Finance/SomeFile.tsx
git add server/src/routes/finance.routes.ts
git add -f tests/integration/execution/some.test.ts
git commit -m "fix(M16/L-xx): opis naprawy"
```

Zawsze sprawdź uncommitted changes przed `git add`:
```bash
git status
git diff src/components/Execution/
```

---

## DEFINICJA DONE

- [ ] M16: 1 luka zamknięta
- [ ] M14: 2 luki zamknięte
- [ ] M15: 3 luki zamknięte
- [ ] M04: wszystkie OTWARTE luki zamknięte lub FALSE POSITIVE; i18n zinwentaryzowane
- [ ] A1 uncommitted changes: zweryfikowane i committed (lub udokumentowane dlaczego nie)
- [ ] Teczki zaktualizowane z SHA commitów
- [ ] Brak nowych błędów TypeScript

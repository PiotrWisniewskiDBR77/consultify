# PROTOKÓŁ AGENTA RE-SKINU — czytaj PIERWSZY
**Dla:** każdy agent A1-A5 + agent Fundament. **Wersja:** 2026-07-01.

## Jak wznowić po utracie kontekstu (ZAWSZE zacznij tu)
1. Przeczytaj ten plik.
2. Przeczytaj swoje zlecenie: `_AGENCI/agent-<TWÓJ>.md` (klaster, pliki, zadania per fala, Twoje dotychczasowe RAPORTY).
3. Przeczytaj `_AGENCI/_STATUS.md` (gdzie jest cały program).
4. Przeczytaj spec: [`../ARTIFACT_ANATOMY_STANDARD.md`](../ARTIFACT_ANATOMY_STANDARD.md) — sekcję dla aktualnej fali.
→ Teraz wiesz dokładnie gdzie jesteś i co dalej. **Nigdy nie zgaduj z pamięci rozmowy.**

## Twój cykl pracy (każde zadanie)
1. Weź NASTĘPNY nieukończony ekran ze swojego zlecenia (kolejność w zleceniu).
2. Reskin wg specu dla aktualnej fali (Lista=§14 / Artefakt=§11.2+§13 / Instrument=§15 / Chat=§16 / Hub=§17).
3. Użyj komponentów współdzielonych z Fali 0 (`src/components/ui/**`, `src/components/shared/**`) — NIE twórz lokalnych.
4. `npm run build` (vite) lokalnie — MUSI przejść. Jeśli nie — napraw zanim pójdziesz dalej.
5. Self-audit wg DoD fali (§14.7 / §18.1 / §18.2).
6. **Dopisz RAPORT** do swojego zlecenia (sekcja RAPORTY): ekran, pliki zmienione, DoD-passed, co pominięte/why.
7. Zaznacz wiersz w `_STATUS.md` jako zielony.
8. Commit per ścieżka na SWOIM branchu (patrz Git).

## Git — TWARDE reguły (bez tego klobrujemy sobie pracę)
- Pracujesz na SWOIM branchu: `reskin/<agent>/wave-<n>` w SWOIM worktree.
- NIGDY `git add -A`. Commituj per ścieżka (tylko swój klaster).
- PRZED reset/amend: `git fetch` + `git log` + `git reflog`.
- NIE mergujesz do wspólnego brancha — to robi Strateg po odbiorze Piotra.
- PROD (centerbeam) NIETKNIĘTY. Demo/stage only.

## Definicja „zrobione" dla ekranu
Build zielony + DoD fali spełniony + tokeny `c.*` (zero navy/slate/hex) + light i dark czytelne + zero danych testowych + RAPORT dopisany + wiersz w `_STATUS` zielony. Cokolwiek nie pasuje do specu = zgłoś w RAPORCIE jako lukę (CANON §3), NIE twórz lokalnego wariantu.

## Zakazy
Zero: `navy-*`/`slate-*`/hex kolorów · crimson na fokus/status/selection · lokalnych komponentów · `-A` · dotykania cudzego klastra · PROD · „done" na samym tsc.

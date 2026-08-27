# Raport dyżuru 58 — przywrócenie wartości dowodowej CI

Stan raportu: roboczy, uzupełniany po każdej pozycji w kolejności wiążącej.

## 1. Marker i baza

`df -h /`: `/dev/disk3s1s1`, dostępne `11Gi` — próg 5 GB spełniony.

`git log --oneline -25 github-backup/codex/m03-admin-20260824` rozpoczął się od:

```text
b3179d0a52 docs(ledger): DEC-248 teza nadzorcy o katalogu czlonkow obalona pomiarem
c8d59a0397 docs(handoff): przekazanie roli nadzorcy — kodeks pracy dla agenta prowadzacego
2f99ef5ebe docs(ledger): DEC-247 Narzedzia 54 + FIX-y scalone, wykonawca obalil instrukcje nadzorcy
```

`git merge-base --is-ancestor b3179d0a52603f62b5cd3673caa754c8fc3b0055 github-backup/codex/m03-admin-20260824`:

```text
MARKER OK
```

Tip był równy markerowi; zakres `marker..tip` był pusty. Worktree: `/private/tmp/consultify-ci-day58`, gałąź `codex/ci-day58-20260828`.

## 2. Weryfikacja stanu wejściowego

- Port: `lsof -nP -iTCP:5858 -sTCP:LISTEN || echo "5858 WOLNY"` → `5858 WOLNY`.
- Macierz: `CI_MATRIX_REPO=/private/tmp/consultify-ci-day58 node /private/tmp/consultify-ci-day58-artefakty/ci-matrix.mjs ...` → `PODSUMOWANIE: 150 kombinacji; 32 = job zielony bez ani jednego kroku testowego.`
- Lint: `npm run lint` → `exit=1`, `48506 problems (48506 errors, 0 warnings)`, `48493 ... potentially fixable with --fix`.
- Type-check: `npm run type-check` → `exit=2`; własny grep policzył `24` diagnostyki TS w `16` plikach.
- Bramki DB: własne grepy → `38` zmiennych, `50` plików rodziny 1, `7` rodziny 2, unia `56`, w tym `51` plików testowych; `.github/` nie zawiera `DB_PREFIX`.
- Acceptance: `grep -rn "acceptance" .github/workflows/` → 0 trafień; `find tests/acceptance -mindepth 1 -maxdepth 1 -print | wc -l` → `152`.
- Retry: `playwright.config.ts:80` ma `retries: process.env.CI ? 2 : 0`; `vitest.config.ts:331` ma `retry: 0`.
- Cztery pakiety z §E, `--retry=0 --reporter=verbose`: `19 failed | 16 passed`; lista nazw jest zgodna z instrukcją.

## 3. Korekty wobec instrukcji

1. §B.0 potwierdzony: job `lint-typecheck` pada na pierwszym kroku, więc type-check nie jest osiągany w realnej sekwencji joba.
2. Inwentarz DB na markerze jest większy o jeden od pomiaru autora: `38/50/7/56/51`, nie `37/49/7/55/50`. Pełne listy są w artefaktach `db-prefix-vars.txt`, `db-f1.txt`, `db-f2.txt`, `db-union.txt`.
3. Jest `24` błędów TSC, lecz w `16`, nie `15` plikach; tabela autora również wymienia 16 ścieżek.

## 4. Tabela zbiorcza pozycji

| pozycja | werdykt | commit SHA | dowód |
| --- | --- | --- | --- |
| §B.0 | ZROBIONE_WG_DoD | PENDING | §B.0 |
| §B.1 | NIEROZPOCZĘTE | — | — |
| §A | NIEROZPOCZĘTE | — | — |
| §C | NIEROZPOCZĘTE | — | — |
| §D | NIEROZPOCZĘTE | — | — |
| §E | NIEROZPOCZĘTE | — | — |
| §F | NIEROZPOCZĘTE | — | — |

## §B.0 — ESLint przed type-checkiem

Komenda główna:

```text
npm run lint > /private/tmp/consultify-ci-day58-artefakty/lint-PRZED.txt 2>&1
exit=1
✖ 48506 problems (48506 errors, 0 warnings)
48493 errors and 0 warnings potentially fixable with the --fix option.
```

Niezależny pomiar JSON:

```text
npx eslint . --quiet -f json -o /private/tmp/consultify-ci-day58-artefakty/eslint.json
exit=1
plikow z bledami: 1924 z 1924
prettier/prettier 47381
simple-import-sort/imports 1065
simple-import-sort/exports 27
prefer-const 18
react-hooks/rules-of-hooks 3
no-irregular-whitespace 2
no-extra-boolean-cast 2
no-useless-escape 2
@typescript-eslint/no-unused-expressions 2
@typescript-eslint/no-namespace 1
```

Rozstrzygnięcie: `lint-typecheck` kończy się na `npm run lint`; `npm run type-check` nie jest w tym jobie wykonywany. To nie jest artefakt jednego pliku ani odmiennej liczby nadzorcy. Nie wykonano `eslint --fix` ani `prettier --write`.

Warianty decyzji:

- W1 — osobny szeregowany dyżur pełnego formatowania, gdy nie żyją inne gałęzie. Cena: diff obejmujący ok. 1924 pliki i trudny merge; ryzyko: konflikt z aktywnym WIP. Zaleta: przywraca rygor bez osłabiania reguł.
- W2 — rozdzielić blokujący `typecheck` od tymczasowo nieblokującego lintu z zapadką liczbową względem zatwierdzonego baseline. Cena: dodatkowy job i utrzymanie baseline; ryzyko: dług formatowania pozostaje, ale nie może rosnąć. To wariant rekomendowany operacyjnie, jeśli W1 nie dostanie natychmiastowego okna wyłączności.
- W3 — zmienić `prettier/prettier` z `error` na `warn`. ODRZUCAM: to obniżenie progu, narusza Z9 i nie rozwiązuje błędów semantycznych.

`DECISION_REQUIRED`: czy właściciel wybiera jednorazowe pełne sformatowanie w szeregowanym oknie (W1), czy rozdzielenie joba z zapadką (W2)?

Niezweryfikowane dla §B.0: nie uruchamiałem realnego runnera GitHuba (Z8); nie mierzyłem jeszcze, czy wynik lintu różni się na `origin/Londyn`.

## 9. DECISION_REQUIRED

- ESLint: W1 albo W2, zgodnie z §B.0.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

- Czy historyczne realne przebiegi GitHub Actions na tej gałęzi były zielone.
- Zachowanie realnego runnera GitHuba przy `needs` i `if` bez `always()`.
- Czy błędy TSC są zastane na `origin/Londyn`, czy wniesione przez bazę dyżuru.
- Ostateczny warunek `readiness-smoke`.
- Zachowanie realnego runnera GitHuba po przyszłych zmianach — uruchomienie jest zabronione przez Z8.

## 12. Deklaracja

**NIE przepisałem liczb nadzorcy ani autora instrukcji — zmierzyłem sam.**

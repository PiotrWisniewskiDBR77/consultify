# E2E-1 krok 2 — macierz wariantów (tor B)

## Zakres mechaniki

Pakiet dodaje repozytoryjny runner Playwright i workflow nocny dla kontraktu z KANAL.md Wpis 89:

- 4 konteksty użytkownik–organizacja: Irina ADMIN Northwind, Kasia ADMIN Northwind, Tomek ADMIN Northwind i Tomek OWNER DBR77;
- 2 języki (`en`, `pl`) i 2 motywy (`light`, `dark`), łącznie 16 wariantów;
- 16 modułów w każdym wariancie, łącznie 256 przebiegów modułu;
- siedem wymaganych klas powierzchni: Menu 1, Menu 2, Menu 3, kebab, prawy panel, wejście tworzenia i wejście AI;
- zrzut stanu flag stagingu, zrzut ekranu oraz błędy konsoli/HTTP przy każdej komórce;
- różnica wobec poprzedniego artefaktu tego samego wariantu;
- `workflow_dispatch` oraz cron codziennie o 05:07 UTC;
- pełny mianownik fail-closed: brak wariantu, modułu lub powierzchni jest `MISSING`, a nie pominięciem.

## Granica zapisu i sprzątania

Krok 2 uruchamia wejścia do tworzenia i AI, lecz nie zatwierdza formularzy ani nie generuje treści bez jawnego adaptera danego modułu. Runner obserwuje domenowe `POST`, `PUT`, `PATCH` i `DELETE` do tego samego originu `/api/**`, z wyłączeniem uwierzytelnienia i pasywnej telemetrii (`/api/v10/teresa/voice-event`, `/api/errors`). Każdy nieoczekiwany zapis domenowy jest blokowany przed siecią i daje FAIL całego wariantu. Dzięki temu bieżąca mechanika gwarantuje zero rekordów testowych po przebiegu.

Pełne scenariusze „utwórz → sprawdź → usuń → potwierdź brak” wymagają jawnych adapterów per moduł. Nie wolno zastępować ich generycznym klikaniem przycisków, bo mogłoby to zostawić rekord lub uruchomić kosztowną akcję AI.

## Sekrety i uruchomienie

Workflow wyłącznie odwołuje się do sześciu nazw GitHub Secrets:

- `E2E_IRINA_EMAIL`, `E2E_IRINA_PASSWORD`;
- `E2E_KASIA_EMAIL`, `E2E_KASIA_PASSWORD`;
- `E2E_TOMEK_EMAIL`, `E2E_TOMEK_PASSWORD`.

Pakiet nie dodaje wartości sekretów i nie uruchamia workflow. Zgodnie z Wpisem 89 wartości dodaje CTO po odbiorze.

## Dowody lokalne

Bezpieczny przebieg jednego pełnego wariantu wykonano na stagingu jako Irina / Northwind / ADMIN / EN / light. Konto zostało po przebiegu przełączone z powrotem do organizacji sprzed testu (`HTTP 200`). Dowód nie zawiera sekretów.

- moduły: 16/16;
- komórki: 277;
- PASS: 246;
- FAIL: 9;
- MISSING: 17;
- BLOCKED przez próbę zapisu domenowego: 5;
- snapshot V8: `ai_core`, `chat`, `lifecycle`, `multiplayer`, `outputs`, `pm_sync`, `results`, `workspace` ON; `finance` OFF;
- remote runtime flags: pusty zbiór dla tego tenant-contextu;
- wejścia Menu 1: 14 PASS, 2 przekierowania/FAIL (Admin i Partners dla Iriny ADMIN);
- zachowane 16 zrzutów wejść modułów oraz zminimalizowany wynik w `evidence/irina-northwind-admin-en-light/`.

Przebieg ujawnił prawdziwe zapisy przy odczycie i zatrzymał je przed siecią:

- My Work: `POST /api/v8/my-work/inbox/canonical/materialize`;
- Audits → Conclusions: `POST /api/conclusions/sync`;
- Chat → New conversation: `POST /api/conversations` po kliknięciu wejścia tworzenia.

Pierwsze dwa są write-on-view i powinny wejść do kolejki napraw. Trzeci dowodzi, że do pełnego testu tworzenia potrzeba adaptera „utwórz → pobierz ID → usuń → readback 404/pusty”. Do czasu tych adapterów komórki akcji tworzących/AI pozostają uczciwie `BLOCKED`/`MISSING`, a pakiet jest mechaniką Fali 2, nie dowodem pełnego E2E tych zapisów.

## Walidacja pakietu

- `node --test scripts/e2e-1-matrix/contract.test.mjs`: 5/5 PASS;
- syntetyczna pełna macierz: 16 wariantów, 256 przebiegów modułu, 1792 minimalne komórki, agregat PASS;
- `npx eslint --no-ignore scripts/e2e-1-matrix/*.mjs`: PASS;
- `node --check` dla wszystkich skryptów `.mjs`: PASS;
- `npx prettier --check` dla skryptów, workflow i raportu: PASS;
- parser YAML: 16 wariantów, cron `7 5 * * *`, oba joby obecne;
- pełny `type-check:server`: 0 błędów;
- pełny `type-check` frontu: 169 zastanych błędów, delta pakietu 0 (zero zmienionych plików `.ts`/`.tsx`);
- `git diff --check`: PASS.

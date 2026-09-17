# TPL-1a v4 (W214) — RECEIPT końcowy

Data: 2026-09-17
Właściciel paczki: `[B] Codex-2`
Baza: `fa075366be0c8bafa666275c8f8cb7868e5f0099`
Zakres: wyłącznie tor B, P1-1 i P1-2 z Wpisu 214

## Werdykt

**READY FOR CTO REVIEW — etap 1 i etap 2.** Systemowy SHEET-BASE duplikuje się przez żywy router na kopii dumpu stagingowego z HTTP 201 i nowym id. Wszystkie wejścia `Use template` dla SHEET są wyłączone i wyjaśniają użycie `Duplicate`. Tabela przy otwartym podglądzie mieści się w torze 912 px; pomiar przeglądarkowy daje 0 zasłoniętych i 0 uciętych pól.

## P1-1 — SHEET `Use` i `Duplicate`

- Kafel, kebab i nagłówek podglądu pokazują wyłączone `Use template` z komunikatem `Use Duplicate to create an editable scorecard workbook.`
- `POST /api/workbook/templates/:id/build` dopuszcza widoczne wzorce systemowe `organization_id='__system__'` także wtedy, gdy `created_by='migration:…'`.
- Zaakceptowany snapshot SHEET-BASE w formacie eksportowym jest konwertowany do kanonicznego `WorkbookSchema`; zachowane są dwa arkusze, wartości, formuły A1, szerokości, freeze panes i autofilter.
- Trasa zwraca HTTP 201 dla utworzonego workbooka.
- Realny test uruchomił zamontowany router, realny `verifyToken` i PostgreSQL z przywróconego dumpu. Wynik: źródło `2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1`, HTTP 201, nowy workbook `646ef531-6efa-43c2-9fab-10315d98dd1d`.
- Mutacja przywracająca stary filtr bez `__system__` daje HTTP 404 i RED; po przywróceniu kodu test jest GREEN.

## P1-2 — tor tabeli 912 px

- Przy otwartym preview zestaw kolumn wynosi `Name · Type · Scope · Status`; `Category` i `Last updated` są wtedy świadomie ukryte.
- Pomiar DOM: `clientWidth=912`, `scrollWidth=912`, 5 wierszy, `coveredCount=0`, `truncatedCount=0`.
- Test komponentowy asercjonuje dokładny responsywny zestaw kolumn oraz wyłączone wejście `Use` w nagłówku z tym samym powodem.
- Mutacja cofająca filtr kolumn przywraca `Category` i `Last updated`, przez co test przechodzi na RED.
- D-36 (rząd akcji galerii) pozostaje poza zakresem zgodnie z W214.

## Bramka

| Kontrola | Wynik |
|---|---|
| Testy celowane | **12/12 PASS**, 4/4 plików |
| Real HTTP + kopia PostgreSQL | **PASS**, HTTP 201 i nowe id |
| Mutacja starego filtra systemowego | **RED**, HTTP 404 |
| Mutacja responsywnego zestawu kolumn | **RED**, zestaw rozszerzony do 6 kolumn |
| TypeScript serwera | **RC=0** |
| TypeScript frontu | **RC=2**, 167 zastanych diagnostyk; 0 w plikach paczki |
| ESLint plików paczki | **0 błędów**, 28 ostrzeżeń |
| Bramka językowa | **OK**, dług nie wzrósł |
| Flagi Dockerfile | **OK**, 0 brakujących |
| Kanon list | **OK**, 345 vs baseline 346 |
| Artefakt | **OK**, 8 vs baseline 8 |
| `git diff --check` | **RC=0** |
| Migracje | 0 |
| Pliki toru A | 0 |

Pełny frontowy `tsc` nie jest zielony na tej linii i nie jest przedstawiany jako zielony. Lista 167 diagnostyk nie zawiera żadnego z plików zmienionych przez paczkę. Serwerowy `tsc` przechodzi w całości.

## Dowody

- `evidence/real-http-sheet-duplicate-result.json` — wynik realnego HTTP na kopii dumpu;
- `evidence/real-http-sheet-duplicate-green.txt` — przebieg GREEN;
- `evidence/mutation-real-http-old-filter-red.txt` — 404/RED po przywróceniu starego filtra;
- `evidence/visual-overlap-measurement.txt` — dokładny pomiar 912 px i 0/0;
- `evidence/tpl1a-v4-preview-lane912.png` — podgląd EN light z wyłączonym `Use` i pełną tabelą;
- `evidence/mutation-preview-columns-red.txt` — RED po cofnięciu responsywnego zestawu;
- `evidence/focused-tests-final.txt`, `server-tsc.txt`, `front-tsc.txt`, `eslint.txt` i wyniki bramek statycznych.

SHA256 obrazu 912 px: `414ad42b0b3e2de2ca3d5cd775853ea05190895a7b5a23848446b46c30449f97`.

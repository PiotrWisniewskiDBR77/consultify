# CODEX DAY 285 — A11Y HARNESS

Data: 2026-09-03  
Marker: `80c0d29865`  
Gałąź: `codex/day285-a11y-harness-i-kontrast-20260903`

## Werdykt

`PARTIAL / G06 NOT_STARTED`. R1 usunął udowodniony szum skanu całego dokumentu,
R2 objął 248/248 ekranów w jednej konfiguracji inwentarzowej, R3 naprawił kontrast
`c-warning/10 text-c-warning`, a R4 naprawił cztery współdzielone źródła nazw.
Pełna macierz R5 (PL/EN × light/dark × 1440/1024) nie została wykonana, dlatego
żadna z szesnastu bramek G06 nie może zostać zamknięta.

## Wejście

`MARKER OK`. `HEAD` po utworzeniu worktree:

```text
80c0d29865a32b83f0d185c807798fbb857099c0
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z instrukcją
praca rozpoczęła się dokładnie z markera. Rozjazd zawierał między innymi późniejsze
pomiary G06 modułów 05–16 oraz sprostowanie diagnozy dyżuru 285; nie wykonywano
rebase ani scalania.

## R1 — zakres skanu

Przed: `org-declared-challenges` zgłaszał `heading-order`, `landmark-one-main`,
`region`. Po `include('#dev-render-root')`: zniknęły `landmark-one-main` i `region`,
ale `heading-order` pozostał. Nie wyłączono żadnej reguły. Ten sam zakres zastosowano
w `grafika-zrzuty.mjs` i `pkgi-a11y-audit.mjs`.

Artefakty:

- `/private/tmp/cx-day285-a11y-artefakty/r1-przed.json` — `df1e003deb5f7ba9b6d62665772af017a550c1b916df06cda99c4ef3c1cc5c8c`
- `/private/tmp/cx-day285-a11y-artefakty/r1-po.json` — `0bef3dd1d8549e956428d58b3be781e02f8eea3db73f4d681f45d92625991fa4`

## R2 — inwentarz

Pomiar: PL, light, 1440×900, 248/248 ekranów, 0 błędów końcowych po jawnym
rerunie siedmiu entrypointów montowanych pod `#root`. Wynik: 101 ekranów z
naruszeniami, 147 czystych. Pełne selektory, HTML węzłów, komunikaty axe,
konsola i HTTP: `/private/tmp/cx-day285-a11y-artefakty/r2-inventory.json`
(`9676c3a76ca3c04dcadf3fb27c63372a3e7665927e64adad879f87f0e4807bec`).

| Moduł | czerwone / wszystkie |
| --- | ---: |
| 01_ORGANIZATION | 18 / 21 |
| 02_INTERVIEW | 4 / 6 |
| 03_TOOLS | 5 / 7 |
| 04_ASSESSMENT | 11 / 17 |
| 05_INITIATIVES | 3 / 6 |
| 06_EXECUTION | 3 / 8 |
| 07_MY_WORK_AGENT | 15 / 40 |
| 08_MEETINGS | 0 / 2 |
| 09_RESULTS | 4 / 19 |
| 10_FINANCE | 2 / 13 |
| 11_MATERIALS | 6 / 35 |
| 12_AUDITS | 1 / 4 |
| 13_CHAT | 1 / 7 |
| 14_ADMIN | 10 / 42 |
| 15_SETTINGS | 7 / 9 |
| 16_PARTNER | 11 / 12 |

Najszersze reguły: `color-contrast` 50 ekranów, `heading-order` 26, `label` 16,
`select-name` 14, `button-name` 14, `landmark-unique` 14. Pozostałe realne
klasy: `empty-table-header`, `aria-required-parent`, `nested-interactive`,
`scrollable-region-focusable`, `aria-required-children`, `listitem`,
`definition-list`, `landmark-no-duplicate-banner`, `aria-prohibited-attr`,
`landmark-main-is-top-level`, `aria-progressbar-name`, `aria-allowed-role`.

## R3 — kontrast

Jasny `c-warning` zmieniono z `#AE6429` na `#A3541C`. Obliczony kontrast tekstu
na 10% własnego tintu wzrósł z około 4,00:1 do 4,77:1 przy niezmienionym progu
4,5:1. Kontrolowany rerun `assessment-list` przeszedł z dwóch węzłów
`bg-c-warning/10 text-c-warning` do zera. Inne pary kontrastowe pozostają długiem.

## R4 — nazwy

- TemplateBuilder: widoczne `Field.label` jest wiązane przez `id/htmlFor` z
  natywnym input/textarea/select; reprezentatywny ekran stracił `label` i
  `select-name`.
- wspólne toggle Settings i AI Settings mają `aria-label={label}`;
- `WizardStepper` i `InterviewPipelineStepper` mają nazwany progressbar.

To nie usuwa pozostałych nazw w innych komponentach. Rerun po R4 nadal wykazuje
między innymi trzy `select-name` w `ustawienia-ai-automatyzacja`.

## Testy i pułapki

Pakiet był czysto komponentowy: `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`.
Pułapki (a)–(e) dotyczące tras/RealPG/globalnego fetch nie są dowodem tego
pakietu; dowodem głównym jest bezpośredni axe na realnym DOM dev-render.
Przed i po przeszło 16/16 tych samych pełnych nazw testów. Diff nazw jest pusty.

- `przed-nazwy.txt`: `fb324aee69c7cc432887e5888713389864da76fec72421f5d885f42677a58432`
- `po-nazwy.txt`: `fb324aee69c7cc432887e5888713389864da76fec72421f5d885f42677a58432`

Pełny `tsc` nie jest dowodem: proces Node zakończył się awarią sterty i stosem,
bez wiarygodnego wyniku diagnostycznego.

RealPG 6292: pełne migracje przeszły, drugi przebieg zastosował `0` migracji.
Logi: `migrate-1.log` `ad23289ec2ee0b5019d52bd6d531990ac29acd4889a7959609f825331a976cfa`,
`migrate-2.log` `9123e84446dd2b51199ff6e97da7760f17d2d726e5589ad41e897f6e465fd577`.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## KOREKTY WOBEC INSTRUKCJI

1. Sprostowanie mówi, że po skanie `#dev-render-root` sześć reguł krajobrazowych
   znika. Pomiar wykazał, że `heading-order`, `landmark-unique` i
   `landmark-no-duplicate-banner` nadal występują wewnątrz fragmentu. Znikają
   reguły zależne wyłącznie od poziomu dokumentu, ale nie wolno hurtowo odjąć sześciu.
2. Tezy 16/21, 5/6, 10/15 nie potwierdziły się. W aktualnym mianowniku wynik to
   odpowiednio 18/21, 4/6, 11/17.
3. Rejestr markera ma 236 ekranów i 15 modułów; 12 ekranów Partnera pozyskano
   read-only z późniejszego commita tipa, bez scalania kodu.
4. Instrukcja odwołuje się do tabeli licencji, której nie ma w 721-liniowym pliku.
   Zastosowano bezpieczniejszą interpretację Z13: tylko audytory, token kontrastu,
   nazwy/etykiety i ten jeden raport.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełna macierz R5 PL/EN × light/dark × 1440/1024 nie została wykonana.
- Nie ma podstaw do `PASS` dla żadnego G06; wyniki R2 są jedną konfiguracją
  inwentarzową, nie odbiorem pełnej bramki.
- Nie naprawiono klas poza licencją R3/R4, w tym semantyki tabel, drzew,
  landmarków, zagnieżdżonych interakcji i przewijanych regionów.
- Nie wykonano produkcyjnego runtime HTTP ani urządzenia; ten dyżur dotyczył
  hosta dev-render i komponentów dostępności.

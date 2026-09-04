# CODEX DAY 329 — MARTWE OD KORZENIA + BIBLIOTEKA METODYK

Data: 2026-09-04

Gałąź: `codex/day329-martwe-i-biblioteka-20260904`

Marker: `1c3d3da844ae03c87985a8f5dc74846a073c0220`
Stan: **PARTIAL — rdzeń kodowy wykonany; osiem PNG istnieje i jest rozłączne, ale kanoniczne narzędzie zaklasyfikowało wszystkie jako `wynik BRAK`, więc warunek pełnego dowodu wizualnego nie jest spełniony.**

## 0. Wejście i granice

Instrukcję odczytano do EOF bezpośrednio z `github-backup/grafika/m03-20260902` w bare-vaulcie. Dokument miał stan `WYDANY`.

Wynik markera i sanity, dosłownie:

```text
MARKER OK
1c3d3da844ae03c87985a8f5dc74846a073c0220
```

`git status --short | head -3` nie wypisał żadnej linii. Po materializacji worktree było 57 GiB wolnego miejsca. `lsof` nie wykazał nasłuchu na 6355 ani 5495; liczba kontenerów `cx-day329`: `0`. Wariant C był wiążący: nie postawiono bazy ani nie uruchomiono `server/src/index.ts`.

Stan dwóch cudzych worktree zmierzono wyłącznie dozwolonymi poleceniami:

```text
git -C /private/tmp/cx-day293-biblioteka status --short | wc -l => 0
git -C /private/tmp/cx-day297-martwe-od-korzenia status --short | wc -l => 0
```

Tip bazowy wyprzedzał marker o kolejne commity instrukcji; zgodnie z regułą rozejścia praca rozpoczęła się dokładnie z markera. Scalenie nowszego tipa pozostaje zadaniem nadzorcy.

Bezpieczeństwo wysyłki:

```text
BRAK ZMIENNYCH POCZTY
```

`grep` drenów w `server/src/Gateway.ts` dał zero trafień. Nie ustawiono żadnej zmiennej SMTP ani flagi wysyłki. Nie było bazy dyżuru. Nie uruchomiono `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## R1 — scalenie 293

Scalono lokalny ref `codex/day293-ocena-biblioteka-metodyk-20260903` o SHA `e4dc14df6e`. Ref zdalny nie istnieje. Próbne scalenie wykazało dokładnie jeden konflikt w `AssessmentLibraryTab.day178.empty-state.test.ts`.

Konflikt rozwiązano wersją HEAD. Pełny diff wobec wersji 293, który uzasadnia decyzję:

```diff
-import React from 'react';
 import { render, screen } from '@testing-library/react';
+import React from 'react';
 import { describe, expect, it, vi } from 'vitest';

-    expect(screen.getByRole('heading', { name: 'Brak dostępnych metodyk oceny' })).toBeInTheDocument();
-    // Day 286 / G15: the approved product copy names the honest empty state
-    // directly; keep the contract exact so a load-error claim cannot return.
+    expect(
+      screen.getByRole('heading', { name: 'Brak dostępnych metodyk oceny' })
+    ).toBeInTheDocument();
     expect(screen.getByText('Katalog metodyk jest pusty.')).toBeInTheDocument();
-    expect(screen.queryByText('The methodology catalog could not be loaded.')).not.toBeInTheDocument();
+    expect(
+      screen.queryByText('The methodology catalog could not be loaded.')
+    ).not.toBeInTheDocument();
```

W drzewie pozostawiono wariant po stronie `-`: komentarz `Day 286 / G15` i trzy asercje zostały zachowane. `grep -rnE '^(<{7} |={7}$|>{7} )' src/ tests/ dev-render/ docs/` dał zero trafień. `esbuild` komponentu zakończył się `Done in 512ms` (6 ostrzeżeń, bundle 1.9 MB, exit 0).

Bramki PRZED i PO:

| Bramka | PRZED | PO |
| --- | --- | --- |
| `check-list-canon` | exit 0, 368/368 | exit 0, 368/368 |
| `check-artefakt` | exit 0, 8 aktualnie / baseline 9 | exit 0, 8/9 |
| `check-focus-canon --ci` | exit 0, 61 plików / 169 wystąpień | exit 0, 61/169 |

## §0.4a — pełne nazwy testów

PRZED: 19/19 PASS. PO: 25/25 PASS. Żadna pełna nazwa nie zniknęła. `diff przed-nazwy.txt po-nazwy.txt` dodał:

```text
AssessmentLibraryTab B2 canonical contract declares exactly seven B2 columns and no session rows
AssessmentLibraryTab B2 canonical contract opens StandardPreview with axes and the existing start action
AssessmentLibraryTab B2 canonical contract renders the real StandardTable structure instead of a bespoke table
reachability from product roots accepts the measured baseline after the mutation is removed
reachability from product roots rejects a newly added file that is unreachable from app, harness, and tests
reachability from product roots rejects a newly added product file that is reachable only from a test
```

Artefakty: `/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`, `day329-final-tests.json`.

## R2 — scalenie 297 i pomiar

- lokalny ref scalony: `e843a1c2fddc262230688374694ee81ef313ef7b`;
- ref zdalny świadomie niescalony: `682375d32217269642e8b4616d2399df6f9e1681` (sam starszy raport STOP).

Własny przebieg na drzewie po R1:

```text
mianownik 4817
app 3044
harness-only 30
test-only 1017
unreachable 726
Reachability baseline OK (729 accepted unreachable files)
check-baseline=0
```

Baseline po scaleniu nie wymagał aktualizacji. Osiągalność od korzenia śledzi pełny graf zależności od wejść produktu, harnessu i testów; metoda „plik bez importera” błędnie uznaje importy wewnątrz martwego poddrzewa za życie — w ten sposób przepuściła `NotificationSettingsV2` (8 plików i hook).

## R3 — ratchet `test-only`

Przed zmianą para `src/__day329_probe__.ts` + importujący `tests/unit/canon/__day329_probe__.test.ts`:

```text
Reachability baseline OK (729 accepted unreachable files)
PRZED_RATCHET_EXIT=0
```

Po dodaniu oddzielnej bazy `testOnlyFiles`:

```text
New test-only files (1):
src/__day329_probe__.ts
PO_RATCHET_PROBE_EXIT=1
```

Mutacja odwrotna: po tymczasowym usunięciu warunku `test-only` nowy przypadek kontraktowy miał 2 PASS / 1 FAIL (`expected [Function] to throw an error`). Po przywróceniu przez `cp`: 3/3 PASS oraz:

```text
Reachability baseline OK (726 accepted unreachable, 1017 accepted test-only files)
RESTORED_EXIT=0
```

Sondy usunięto; `git status --short` nie zawierał ich nazw. 1017 plików to dług policzony, nie naprawiony, i 1017 kandydatów do przyszłej klasyfikacji. `harness-only` nie zostało objęte ratchetem: klasa oznacza celowe powierzchnie odbiorowe osiągalne z `dev-render/main.tsx`; jej wzrost nie jest sam w sobie dowodem martwego kodu produktu.

## R4 — osiem kadrów PRZED/PO

Wszystkie pliki powstały kanonicznym `scripts/dev/grafika-zrzuty.mjs` z obowiązkowymi opcjami `--rozwin-sekcje=1`, `--cofnij-jesli-skraca=1`, `--osiad-po-rozwinieciu=800`, `--klik-po-rozwinieciu=1`. Harness pracował wyłącznie na 5495 i został zatrzymany po własnym PID.

| Faza/język/motyw | SHA-256 | jasność | bajty |
| --- | --- | ---: | ---: |
| PO/en/dark | `855a5a7a48d54f47de5bf95a5d1b0749943d9eee3cbf1666f2f7089741a85d98` | 28.027989 | 424485 |
| PO/en/light | `3a62d1df9144c68cafbd0d97a3691a9ae3706d5642ddaabc552ed75ad1e54561` | 245.734963 | 424669 |
| PO/pl/dark | `776218c658a42710cbb8fb31d1f969826486bc2eb6a994712ad9bb81bd5aacec` | 29.449139 | 472960 |
| PO/pl/light | `cefe69e380f1c173fb63ac95aac82def45c3b0f520e9efea41c46a99a10ea344` | 245.138986 | 472657 |
| PRZED/en/dark | `24fa28f5f43f7c60984d77b15a1769fd5ebf4a573cf888fa3ad0db63e336cd60` | 23.450417 | 274524 |
| PRZED/en/light | `4379fb78a9797f7e2832a9228b8944f401f9db7d95192fff6cac514f36f44317` | 248.292143 | 274976 |
| PRZED/pl/dark | `9b394adfc0656e34e4098dbb2378481192924188539f3f42160430f46a80ba88` | 23.732140 | 302067 |
| PRZED/pl/light | `c8e5f707a6126c1b17d91c94f8b7064931200f16bedde3a2fd595eb893aaa11f` | 248.046924 | 302428 |

Katalog: `/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/kadry/04-ocena`. JSON-y: `PRZED-pl.json`, `PRZED-en.json`, `PO-pl.json`, `PO-en.json`. Wszystkie osiem SHA są różne; pary light/dark różnią się także jasnością i rozmiarem.

**Korekta przyrządu / ograniczenie dowodu:** kanoniczne narzędzie raportuje `0/2 zrzutów wykonanych` dla każdego języka i oznacza obrazy `wynik BRAK`, ponieważ po pętli rozwijania widzi `aria-expanded=false` na prawidłowo zwiniętych kontrolkach wyszukiwania, filtrów, ustawień widoku oraz kebabach. PNG są użytecznym materiałem diagnostycznym i pokazują tabelę oraz podgląd, lecz nie spełniają pełnego progu odbiorowego instrukcji. Narzędzie jest tylko do odczytu w tym dyżurze; potrzebny osobny brief dla opcji rozróżniającej akordeon treści od popoverów i przełączników.

`check-list-canon` po zmianie: exit 0, 368/368. W scalonej wersji nie powstała bespoke tabela. Test bez mocka potwierdza realne `table[data-min-table-width]` i kontrolkę ustawień widoku. Mutacja `StandardTable` na własne `<table>` czerwieniła nowy przypadek; po cofnięciu 3/3 PASS.

Liście słowników PRZED/PO: pl `35198 → 35198`, en `33065 → 33065`; nic nie zmalało.

## §0.2e — pułapki fałszywej zieleni

Pakiet Biblioteki i test realnej tabeli: pułapki HTTP (a)–(d) nie dotyczą statycznego katalogu. Dowód `grep -lE "ApiGateway|verifyToken|v8FeatureGate|resultsInternalBetaVisibility" AssessmentLibraryTab.tsx drd-library-entry.tsx` dał zero trafień. Dotyczy pułapka (e): historyczna replika harnessu i mock `@/components/standard`; przewód renderuje realny `AssessmentHub`, a nowy przypadek dynamicznie odmockowuje `@/components/standard` i asertuje strukturę prawdziwej tabeli.

Pakiet reachability: pułapki (a)–(e) HTTP nie dotyczą narzędzia plikowego AST. Uruchomiono wariant C (`RUN_DB_TESTS=0 MOCK_DB=true`), `--retry=0`; dowodem ochrony jest dwukierunkowa mutacja samego ratchetu, nie zielony kod wyjścia runnera.

Harness zrzutowy: nie jest runtime'em produktu i nie uruchamia strażników HTTP ani bazy. Właściwa pułapka (e) została wyłączona przez realny `AssessmentHub initialTab="library"`; przyrząd nadal ma opisane wyżej ograniczenie klasyfikacji zwiniętych kontrolek.

## Korekty wobec instrukcji

- Własny mianownik osiągalności to 4817, nie 4808; klasy to 3044/30/1017/726, nie 3040/29/1010/729.
- Pakiet PRZED zawierał 19, nie 9 pełnych przypadków, bo wiążąca komenda obejmuje także testy `src/components/assessment/__tests__` spoza samej Biblioteki.
- Kanoniczny skrypt utworzył osiem PNG, ale wszystkie zaklasyfikował jako `wynik BRAK`; sama różność SHA/jasności/rozmiaru nie usuwa tej czerwonej oceny przyrządu.
- Pierwsza próba zrzutowa została przerwana przez limit procesu po pierwszym obrazie; została powtórzona w trwałej sesji harnessu i nie jest liczona do tabeli dowodów.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełny odbiór wizualny R4 pozostaje **EVIDENCE_MISSING**, ponieważ kanoniczne narzędzie uznało wszystkie osiem PNG za `wynik BRAK`.
- Akcept właściciela nie został wykonany ani ogłoszony.
- Produkcyjny HTTP dla „Rozpocznij ocenę” pozostaje niezweryfikowany i poza zakresem.
- Nie zweryfikowano kompletności rejestrów po stringu, porównania per plik z inwentarzem 238, czterech tabel, bezpiecznego zbioru poddrzew do usunięcia, kluczy i18n ani esbuildów sąsiadów z raportu 297.
- Nie usunięto żadnego pliku produktu; 726 `unreachable` i 1017 `test-only` to kandydaci do klasyfikacji, nie zgoda na usunięcie.

## Commity pozycji

- R1: `cc8f0b1999` — merge 293;
- R2: `a9e994ec52` — merge 297;
- R3: `1c5ce81fcf` — ratchet `test-only`;
- R4: `32926309a1` — realna `StandardTable` bez mocka;
- R5: `4ec00b164a` — dopiski do raportów 293/297.

Każdy commit został wypchnięty wyłącznie na `github-backup/codex/day329-martwe-i-biblioteka-20260904`.

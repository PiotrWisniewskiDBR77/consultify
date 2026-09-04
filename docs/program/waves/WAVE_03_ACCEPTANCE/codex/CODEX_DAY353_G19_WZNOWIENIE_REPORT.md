# Raport dyżuru 353 — G19 wznowienie

Stan: **CZĘŚCIOWE / ZERO WIERSZY PODNIESIONYCH**. R1–R6 wykonano. Day307 ma ważny dowód GREEN→RED→GREEN dla workloadu, pięć pozostałych modułów A ma wykonane kandydackie suity i jawne czerwone kontrakty braków. Cały G19 nie jest domknięty w żadnym module.

## 1. Co odziedziczyłem i potwierdziłem

| Mianownik | Autor | Mój pomiar |
| --- | --- | --- |
| pliki dryfu / bez testów | 106 / 90 | 106 / 90 |
| Blok 1 `przed` | 131 / 127 / 4 | 131 / 127 / 4 |
| Blok 2 `przed` | 218 / 218 / 0 | 218 / 218 / 0 |
| Blok 3 `przed` | 18 / 11 / 7 | 18 / 11 / 7 |
| dystans wszystkie / bez merge / first-parent | 1216 / 1015 / 315 | 1216 / 1015 / 315 |
| mianownik wpisany w G19 | 49 | 49 |
| kubełki | A=7 / B=0 / C=9 | A=7 / B=0 / C=9 jako hipoteza przed R3 |
| moduły A bez dowodu | 5 | 5 |
| wiersze podniesione / dowody zmiany | — | 0 / 0 |
| słowniki; bramki | 35199 / 33066; 0/0/0/0 | 35199 / 33066; 0/0/0/0 przed i po |

Liczba `615` nie jest odtwarzalna z kotwicy wpisanej w macierz. Szczegóły: `evidence/g19/day353/r1-porownanie-liczb.md`.

Dosłowny wynik markera:

```text
MARKER OK
```

Dosłowny sanity worktree:

```text
29fcbd4de20ca26d2febc50d9455128cab47ffce
```

`git status --short | head -3` nie zwrócił wiersza. Tip źródłowy był siedem commitów przed markerem; zgodnie z regułą rozejścia praca pozostała na markerze.

## 2. Liczby obalone własnym pomiarem

- Aktualny Blok 1: **131/131/0**, nie dziedziczone 131/127/4. Cztery czerwienie nie odtworzyły się; nie wykonywałem naprawy produktu.
- Aktualny Blok 3: **18/18/0**, nie dziedziczone 18/11/7. Siedem czerwieni nie odtworzyło się na czystej bazie.
- `615 commitów`: nieodtwarzalne; prawidłowe wyniki jawnych wariantów to 1216/1015/315.
- Liczby słowników z wcześniejszego zlecenia 35198/33065 są nieaktualne; marker i mój pomiar dają 35199/33066.

## 3. R2 — orzeczenie 01 i 08

Na `127.0.0.1:6412/cx353`, po migracjach 894 i idempotentnym drugim przebiegu 0, `GET /api/pmo/tasks/workload/day307-user-owner` dał obcemu 404/64 B, właścicielowi 200/243 B z `total=1`. Usunięcie `AND organization_id = ?` dało RED `expected 200 to be 404`; przywrócenie przez `cp` dało GREEN i pusty diff produktu.

- `01_ORGANIZATION`: udowodniono izolację workloadu, ale nie cały rosnący mianownik G19.
- `08_MEETINGS`: day307 nie wykonuje trasy Meetings. Potrzebna osobna para na `GET /api/meetings/:id` i mutacja faktycznego strażnika.

Pełny dowód: `evidence/g19/day353/r2-day307-orzeczenie.md`.

## 4. R3 — pięć modułów A

| Moduł | Przelot | Mutacja / wynik |
| --- | --- | --- |
| 04_ASSESSMENT | day274 2/2, day275 1/1 | niedopuszczona przez licencję poza TaskController; czerwony kontrakt odczytu oceny |
| 05_INITIATIVES | day277 2/2 | czerwony kontrakt mutacji filtra decision enhancements |
| 06_EXECUTION | dropdown 2/2 | brak obcego tenanta; czerwony kontrakt pary execution case |
| 11_MATERIALS | deck 2/2, workbook 2/2 | czerwony kontrakt mutacji filtra workbook; deck bez pary |
| 13_CHAT | Agent Hub limiter 9/9 | test tekstowy, nie PG; czerwony kontrakt rozmowy/agent planu |

Pięć kontraktów wykonało `5 total / 0 passed / 5 failed`, zgodnie z nagłówkiem „CZERWONY Z ZAŁOŻENIA”. Bloki: 131/131/0, 218/218/0, 18/18/0. Pomiar nazw: 371 przed, 376 po, dokładnie pięć dodanych, zero znikniętych. Szczegóły i SHA artefaktów: `evidence/g19/day353/r3-piec-modulow-i-bloki.md`.

## 5. R4 — orzeczenie 16 wierszy

| Moduł | Kubełek | Udowodnione | Brak | Kto |
| --- | --- | --- | --- | --- |
| 01 | A/luka | day307 workload 404/200 + mutacja | pozostały mianownik i reguła kotwicy | osobne zlecenie + właściciel |
| 02 | C | wspólne bloki | PL/EN, NModeLeftNav i formularze na realnej rozmowie | właściciel |
| 03 | C | wspólne bloki | PL/EN, formularze i ErrorState na realnym narzędziu | właściciel |
| 04 | A/luka | day274/day275 | mutacja cross-org odczytu oceny | osobne zlecenie |
| 05 | A/luka | day277 | mutacja filtra decision enhancements | osobne zlecenie |
| 06 | A/luka | dropdown PG | para cross-org execution case + mutacja | osobne zlecenie |
| 07 | C | wspólne bloki | PL/EN i wspólna powłoka na realnym My Work | właściciel |
| 08 | A/luka | brak dowodu Meetings | para `/api/meetings/:id` + mutacja | osobne zlecenie |
| 09 | C | wspólne bloki | HelpButton/ErrorState i PL/EN na realnym raporcie | właściciel |
| 10 | C | wspólne bloki | treść/stany PL/EN na realnym rekordzie Finance | właściciel |
| 11 | A/luka | day276 deck/workbook | mutacja workbook i para deck | osobne zlecenie |
| 12 | C | wspólne bloki | PL/EN, formularze/stany na realnym audycie | właściciel |
| 13 | A/luka | limiter 9/9 | para rozmowy/agent planu + mutacja | osobne zlecenie |
| 14 | C | wspólne bloki | PL/EN, HelpButton/ErrorState na realnym admin | właściciel |
| 15 | C | wspólne bloki | PL/EN i formularze na realnych ustawieniach | właściciel |
| 16 | C | wspólne bloki | PL/EN na realnym rekordzie partnera | właściciel |

Suma: 0 domkniętych maszynowo, 9 warunkowo czeka wyłącznie na wskazany odbiór właściciela po ustaleniu kotwicy, 7 ma realną lukę. Pełne orzeczenie: `evidence/g19/day353/r4-orzeczenie.md`.

## 6. R5 część A

**Zero wierszy podniesionych, zero dowodów załączonych do zmiany macierzy.** Żaden `MODULE_ACCEPTANCE.md` nie został zmieniony. Dla A istnieją nazwane luki, B jest pusty, C zależy od odbioru właściciela i reguły ważności.

## 7. Pytanie o kotwicę

Warianty z konsekwencjami:

- **A — ZAMROŻONA:** najwyższy koszt ponowień, najprostszy audyt; dowód wygasa przy następnym odbiorze.
- **B — PRÓG:** dowód ważny do N plików lub zmiany krytycznej; wymaga N i listy krytycznej.
- **C — WARSTWY:** osobna ważność wspólnej warstwy i modułu; średni koszt wdrożenia, później proporcjonalne ponowienia.
- **D — ZDARZENIOWA:** manifest plik→obowiązek i ponawianie promienia zmiany; najwyższy koszt wdrożenia, najniższy koszt kolejnych odbiorów.

Pytanie do właściciela: którą regułę przyjmujemy — **ZAMROŻONA, PRÓG, WARSTWY czy ZDARZENIOWA**? Do odpowiedzi definicja i wiersze pozostają bez zmian. Pełna strona: `evidence/g19/day353/r5-podniesienie-i-pytanie-o-kotwice.md`.

## 8. Niewykonane i dlaczego

- Nie podniesiono żadnego G19: żaden cały wiersz nie spełnił kryterium, a synonim PASS jest zakazany.
- Nie wykonano mutacji produktu dla `04/05/06/11/13`: Z40 i tabela licencji zezwalają na zapis w `server/src` wyłącznie dla tymczasowej mutacji TaskController z R2. Bezpieczniejsze rozstrzygnięcie to czerwone kontrakty + brief.
- Nie wykonano zdalnego/stagingowego ani wizualnego odbioru: poza zakresem i zakazane.
- Nie uruchomiono całych 1904 tras day307; R2 wymagał konkretnej pary workloadu, a filtrowany ważny przypadek wykonał się 1/1. Dwa wcześniejsze uruchomienia z błędnego cwd miały 0 przypadków i zostały odrzucone.

## Korekty wobec instrukcji

1. §0.2c przykładowe komendy B/C zawierają w miejscu listy testów wklejony opis prose. Zastosowałem właściwe, imienne ścieżki z artefaktów day348 i pełny obowiązkowy env.
2. R3 wymaga mutacji zabezpieczeń pięciu modułów, podczas gdy Z40 i B.1 zakazują zapisu w każdym `server/src/**` poza mutacją TaskController. Wybrałem zakaz zapisu i działanie zastępcze z §0.5: pięć czerwonych kontraktów.
3. Instrukcja każe Blok 2 uruchomić z cwd `server/`, ale `server/vitest.config.ts` nie obejmuje sześciu plików `tests/unit/**`; wynik wyniósł 0. Ważny pomiar wykonano z root config: 218/218.
4. Dosłowny grep konfliktów z podstawieniem wielu nazw w `bash -c` potraktował kolejne pliki jak komendy i dał `Permission denied`. Kontrolę wykonano bezpiecznie przez NUL-delimited `xargs -0 grep`; zero znaczników.

## Końcowe bramki, czystość i zasoby

- Słowniki: pl 35199, en 33066 — identyczne.
- focus=0 (61 plików/169 zastanych naruszeń, baseline nie rośnie); list=0 (157 plików, 368 zastanych); artefakt=0; reach=0 (719 accepted unreachable, 1017 accepted test-only).
- `git diff -- server/src/controllers/TaskController.ts`: pusty. Brak zmian w `src/**`, `server/src/**` i słownikach.
- Kontener `cx-day353-pg`: usunięty z wolumenem. Porty 6412/5552 po pracy wolne.
- Dysk: 40 GiB przed, 20 GiB po końcowym sprzątaniu.
- Z30: brak SMTP w środowisku i bazie, brak drenaży, brak wysyłki.

## Commity

1. `71ef5d13c4` — R1.
2. `d4ec9f1e3b` — R2.
3. `c7df42e7d5` — R3.
4. `7588b38218` — R4.
5. `6b42cc6116` — R5.
6. R6 — ten raport i sekcja R rejestru.

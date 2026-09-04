# CODEX — dyżur 359 — G20 zamknięcie

## Korekty wobec instrukcji

- Tip `github-backup/grafika/m03-20260902` uciekł o 8 commitów względem markera; zgodnie z `DEC-2026-08-26-95` praca pozostała na markerze. Diff tipa obejmował 39 plików.
- Tezy liczbowe wejścia zostały potwierdzone. Wyszukanie `TECHNICAL_REGRESSION_PASS` dało trafienia wyłącznie w opisach odrzucenia, nie w wierszach macierzy.
- Wolny dysk zmalał z 26 GiB do 7.8 GiB, lecz pozostał ponad twardym progiem 5 GiB.

## Baza i marker

`MARKER OK`

`2a7273e087cbd3e44344725b524f6ddd79d5badc`

Sanity po utworzeniu worktree: status pusty. Porty 6430 i 5570 były wolne. Kontener nie powstał.

## R1 — mianowniki

| # | Obiekt | Autor | Pomiar |
|---:|---|---|---|
| 1 | BLOKUJE | 13 | 13 |
| 2 | mianownik | 121 | 121 |
| 3 | rozkład | 32/34/42/0/13 | 32/34/42/0/13 |
| 4 | exit wejścia | 1 | 1 |
| 5 | test wejścia | 0 | 0; 21/21 |
| 6 | G20 NOT_STARTED | 16 | 16 |
| 7 | Entry gate | 0/7 | 0/7 |
| 8 | G19 NOT_PROVEN | 16 | 16 |
| 9 | rozstrzygnięte/dowody | — | 13/13, w tym A=2, C=11 |
| 10 | G20/dowody | — | 16/16 |
| 11 | słowniki/bramki | 35199/33066; 0/0/0/0 | 35199/33066; 0/0/0/0 |

## Siedem warunków Entry gate

| Warunek | Orzeczenie |
|---|---|
| 16 modułów miało MODULE_ACCEPTED_ON_SHA | mierzalne historycznie; nieodznaczone |
| obowiązki shared-component zamknięte | zablokowane: G19 16/16 NOT_PROVEN |
| czysty finalny SHA zamrożony | niespełnione: UNSET |
| client/server readback zgodny | zablokowane brakiem frozen SHA |
| baza izolowana i persony wskazane | niewykonywane; runtime nie był potrzebny do archeologii |
| zero P0/P1 | niespełnione: 11 BLOKUJE |
| każdy P2/P3 ma dyspozycję | wymaga osobnego pełnego przeglądu rejestrów |

## R2 — 13 pozycji

Pełna tabela 13×6: `evidence/g20/day359/r2-archeologia.md`. Wynik: **A=2, B=0, C=11**. A: `EXE-OWN-005` → `aa0cefc347`; `INI-OWN-001` → `5c6d72066f`. Pozostałe C zachowują BLOKUJE z imiennym brakiem i decydentem.

## R3 — wpisy i bezpieczniki

- 13 pozycji / 13 plików dowodowych / 13 osobnych commitów.
- Licznik: przed `exit 1`, 13 BLOKUJE; po `exit 1`, 11 BLOKUJE.
- Mianownik przed i po: 121. Rozkład po: 34/34/42/0/11.
- Kontrola wsteczna zmieniła wyłącznie `EXE-OWN-005` i `INI-OWN-001`: BLOKUJE → NAPRAWIONE.
- Mutacja `EXE-OWN-005`: `aa0cefc347` → starszy `7b7ec198aa` dała `SHA_STARSZY_NIZ_ZGLOSZENIE` i BLOKUJE; po przywróceniu `SHA_OK` i NAPRAWIONE. Diff licznika po przywróceniu pusty.
- Test licznika przed/po: 21/21, exit 0; porównanie 21 pełnych nazw: zero dodanych i zero znikniętych.

## R4 — wiersz → dowód

| Moduł | Dowód |
|---|---|
| 01_ORGANIZATION | `evidence/g20/day359/r4-01_ORGANIZATION.md` |
| 02_INTERVIEW | `evidence/g20/day359/r4-02_INTERVIEW.md` |
| 03_TOOLS | `evidence/g20/day359/r4-03_TOOLS.md` |
| 04_ASSESSMENT | `evidence/g20/day359/r4-04_ASSESSMENT.md` |
| 05_INITIATIVES | `evidence/g20/day359/r4-05_INITIATIVES.md` |
| 06_EXECUTION | `evidence/g20/day359/r4-06_EXECUTION.md` |
| 07_MY_WORK_AGENT | `evidence/g20/day359/r4-07_MY_WORK_AGENT.md` |
| 08_MEETINGS | `evidence/g20/day359/r4-08_MEETINGS.md` |
| 09_RESULTS | `evidence/g20/day359/r4-09_RESULTS.md` |
| 10_FINANCE | `evidence/g20/day359/r4-10_FINANCE.md` |
| 11_MATERIALS | `evidence/g20/day359/r4-11_MATERIALS.md` |
| 12_AUDITS | `evidence/g20/day359/r4-12_AUDITS.md` |
| 13_CHAT | `evidence/g20/day359/r4-13_CHAT.md` |
| 14_ADMIN | `evidence/g20/day359/r4-14_ADMIN.md` |
| 15_SETTINGS | `evidence/g20/day359/r4-15_SETTINGS.md` |
| 16_PARTNER | `evidence/g20/day359/r4-16_PARTNER.md` |

16 wierszy i 16 dowodów. Wspólny stan: `ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`; nie jest to zaliczenie replay.

## R5 — rozdział danych od miernika

Ryzyko: `scripts/dev/p0p1-licznik-e1.mjs:28–79` trzyma werdykty obok `gitShaState`; osoba edytująca rozstrzygnięcia ma techniczną możliwość osłabienia miernika, czego sam wygenerowany rejestr nie wykryje. Nienałożony patch `evidence/g20/day359/r5-rozdzial-danych.patch` wynosi dane do `.mjs` (wybór zachowuje komentarze i bezstratny kształt JS).

Warunki przyjęcia: (a) rejestr bajt w bajt identyczny; (b) zastany test licznika zielony bez zmian; (c) nowy test udowadnia odczyt pliku danych mutacją usunięcia wpisu i zmianą werdyktu.

## Pytania do właściciela — pozycje C

1. `EXE-OWN-003`: zatwierdzić wskazany deterministyczny dataset jako review-only (umożliwi SHA), czy wymagać danych z governed handoff (pozostaje BLOKUJE)?
2. `FIN-OWN-001`: uznać pięć odzyskanych rejestrów za kanoniczny dataset (potrzebna imienna DEC), czy wskazać inne źródło (BLOKUJE)?
3. `INT-INIT-AI-OBS-001`: udzielić licencji na real-provider replay bez wysyłek, czy odłożyć funkcję imienną DEC?
4. `MYW-CAL-REC-002`: zatwierdzić kontrakt attendees/guests/organizer/status do implementacji, czy odłożyć imienną DEC?
5. `MYW-CAL-REC-003`: zatwierdzić kontrakt artifact-link dla spotkań, czy odłożyć imienną DEC?
6. `MYW-CV-REC-001`: po świeżym zrzucie zaakceptować aktualny standard table/preview, czy wskazać konkretne różnice do naprawy?
7. `MYW-CV-REC-002`: uznać obecne right-click/kebab imienną DEC, czy wymagać nowej izolowanej naprawy z SHA?
8. `MYW-DEC-REC-001`: uznać aktualny Decisions list imienną DEC, czy wymagać nie-checkpointowego SHA dotykającego MyWorkHub?
9. `MYWORK-DEC-OWN-001`: zamknąć osobny ID tą samą imienną DEC co duplikat, czy pozostawić osobno BLOKUJE?
10. `RES-OWN-003`: licencjonować writer i cold readback 4/3/3, czy odłożyć ten wymóg imienną DEC?
11. `RES-OWN-004`: uznać stan pre-existing CTA imienną DEC, czy wymagać izolowanego SHA Results?

## Niewykonane i dlaczego

- Nie uruchomiono runtime ani PostgreSQL: brak writera dla `RES-OWN-003` jest granicą funkcjonalną, a uruchomienie read-only nie dostarczyłoby wymaganego dowodu zapisu/cold readbacku.
- Nie wykonano świeżego zrzutu `MYW-CV-REC-001`: instrukcja jawnie tego zabrania w tym dyżurze.
- Nie odhaczono Entry gate ani nie ustawiono frozen SHA: warunki pozostają niespełnione.
- Nie zmieniono kodu produktu, workflow, testów ani funkcji bezpiecznika.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Dysk

- Przed: 26 GiB wolne.
- Po: 7.8 GiB wolne (powyżej progu 5 GiB).

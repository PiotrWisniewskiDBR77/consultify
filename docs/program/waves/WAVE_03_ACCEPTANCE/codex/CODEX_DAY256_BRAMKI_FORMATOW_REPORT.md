# CODEX DAY 256 — BRAMKI FORMATÓW

## Streszczenie

Na markerze `df7f13056f` odtworzono lukę M19: raport z jawnym `0 ryzyk` i niepustą sekcją ryzyk przechodził jako `valid: true`. Do `RulesEngine.ts` dodano wąską, deterministyczną regułę `ZERO_CLAIM_CONTRADICTS_SOURCE`. Reguła blokuje wyłącznie slajd `key_messages`, który twierdzi `0 inicjatyw/ryzyk` (PL/EN), gdy ten sam `UnifiedReportJSON` zawiera niepusty slajd `initiative_portfolio`/`risk_management`. Nie zmieniono M18, istniejących 14 reguł slajdowych, progów punktacji ani Gate 6 DeckBuildera.

Stan wejścia, dosłownie:

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
git status --short: (brak wyjścia)
```

Tip gałęzi bazowej uciekł do `7a733cb63d`; zgodnie z DEC-95 praca zaczęła się dokładnie z markera. Zakres rozjazdu zapisano komendami `git log df7f13056f..github-backup/codex/m03-admin-20260824` i `git diff --name-only ...`; obejmuje instrukcje/raporty programu, bez scalania i bez rebase.

## R1 — pełny inwentarz bramek na markerze

| Silnik                      | Reguła/kategoria              | Format i tor                   | Co sprawdza                                                                                                                     | Blokuje eksport?                                            |
| --------------------------- | ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| M18 `documentQaService.ts`  | brand                         | DOCX, wiązka + Document Studio | marka                                                                                                                           | TAK dla 9 typów przy wyniku blocking                        |
| M18                         | language                      | DOCX                           | język i gęstość                                                                                                                 | TAK                                                         |
| M18                         | completeness                  | DOCX                           | kompletność                                                                                                                     | TAK                                                         |
| M18                         | sources                       | DOCX                           | źródła                                                                                                                          | TAK                                                         |
| M18                         | methodology                   | DOCX                           | metodologia                                                                                                                     | TAK                                                         |
| M18                         | executive                     | DOCX                           | warstwa executive                                                                                                               | TAK                                                         |
| M18                         | risk                          | DOCX                           | ryzyka                                                                                                                          | TAK                                                         |
| M18                         | data                          | DOCX                           | dane                                                                                                                            | TAK                                                         |
| M18                         | format                        | DOCX                           | format                                                                                                                          | TAK                                                         |
| M18                         | export                        | DOCX                           | gotowość eksportu                                                                                                               | TAK; override osobno autoryzowany                           |
| M19 `RulesEngine.ts`        | TITLE_LENGTH                  | PPTX, wiązka                   | do 14 słów w key message                                                                                                        | NIE, warning                                                |
| M19                         | REQUIRED_FIELDS               | PPTX, wiązka                   | intent/key_message/content                                                                                                      | TAK, error                                                  |
| M19                         | MAX_KPI_DASHBOARD             | PPTX, wiązka                   | do 6 KPI                                                                                                                        | NIE, warning                                                |
| M19                         | MAX_BULLETS_EXEC              | PPTX, wiązka                   | do 5 findings                                                                                                                   | NIE, warning                                                |
| M19                         | MAX_KEY_MESSAGES              | PPTX, wiązka                   | do 4 komunikatów                                                                                                                | NIE, warning                                                |
| M19                         | MAX_RECOMMENDATIONS           | PPTX, wiązka                   | do 8 rekomendacji                                                                                                               | NIE, warning                                                |
| M19                         | MAX_RISKS                     | PPTX, wiązka                   | do 8 ryzyk                                                                                                                      | NIE, warning                                                |
| M19                         | MAX_ACTIONS                   | PPTX, wiązka                   | do 10 akcji                                                                                                                     | NIE, warning                                                |
| M19                         | MAX_ROADMAP_PHASES            | PPTX, wiązka                   | do 5 faz                                                                                                                        | NIE, warning                                                |
| M19                         | ROOT_CAUSE_LIMIT              | PPTX, wiązka                   | do 5 przyczyn                                                                                                                   | NIE, warning                                                |
| M19                         | MAX_INITIATIVES               | PPTX, wiązka                   | do 6 inicjatyw                                                                                                                  | NIE, warning                                                |
| M19                         | INITIATIVE_REQUIRED_FIELDS    | PPTX, wiązka                   | nazwa inicjatywy                                                                                                                | TAK, error                                                  |
| M19                         | PRIORITIZATION_QUADRANT_LIMIT | PPTX, wiązka                   | do 5 elementów/kwadrant                                                                                                         | NIE, warning                                                |
| M19                         | APPENDIX_BODY_LENGTH          | PPTX, wiązka                   | do 2000 znaków                                                                                                                  | NIE, warning                                                |
| M19                         | EMPTY_REPORT                  | PPTX, wiązka                   | co najmniej jeden slajd                                                                                                         | TAK, error                                                  |
| M19, NOWA                   | ZERO_CLAIM_CONTRADICTS_SOURCE | PPTX, wiązka                   | `0 inicjatyw/ryzyk` kontra niepuste dane w tym samym raporcie                                                                   | TAK, error                                                  |
| DeckBuilder Gates           | 1 Empty deck                  | PPTX/PDF/PNG/HTML interaktywny | pusty deck                                                                                                                      | TAK, error                                                  |
| DeckBuilder Gates           | 2 Missing cover               | interaktywny                   | brak cover                                                                                                                      | wg severity error                                           |
| DeckBuilder Gates           | 3 Card bounds                 | interaktywny                   | za mało/za dużo kart                                                                                                            | errors blokują; warning nie                                 |
| DeckBuilder Gates           | 4 Content integrity           | interaktywny                   | puste/mało informacyjne, brak layout evidence, raw internals, placeholdery, encoding, thesis, inventory leak, decision sections | tylko pozycje error                                         |
| DeckBuilder Gates           | 5 Brand                       | interaktywny                   | Brand Kit, header/footer                                                                                                        | tylko errors                                                |
| DeckBuilder Gates           | 6 Traceability                | interaktywny                   | pokrycie `source_refs`                                                                                                          | NIE: P2/warning                                             |
| DeckBuilder Gates           | 7 Freshness/decision evidence | interaktywny                   | stale blocks, ślady decyzji, confidence                                                                                         | tylko errors                                                |
| DeckBuilder Gates           | 8 Visual consistency          | interaktywny                   | różnorodność layoutów                                                                                                           | NIE, warning                                                |
| DeckBuilder Gates           | 9 Speaker notes               | interaktywny                   | pokrycie notatkami                                                                                                              | NIE, warning                                                |
| DeckBuilder Gates           | 10 Density                    | interaktywny                   | wyłącznie nadmiar słów `> max*1.5`                                                                                              | NIE: P2/warning                                             |
| `presentationExportGate.ts` | enforcement + override        | eksport interaktywny           | `canExport`, 422, override ADMIN/OWNER/SUPERADMIN                                                                               | TAK, gdy wynik zawiera error i brak autoryzowanego override |

Pomiar: `RulesEngine.ts` miał 358 linii, 15 miejsc emitujących `rule:` (14 reguł slajdowych + `EMPTY_REPORT`) i `grep -icE source|traceab|evidence|language|density` zwrócił `0`. `bundleDeckQa.ts` importował wyłącznie `validateReport`; `bundleDocQa.ts` importował `runDocumentQa` i zwracał `anyBlocking`. Nie znaleziono konsumenta `bundle.quality.doc/deck` w `src/`; wynik jest obecnie składany w `bundleGenerationRuntime.ts`, ale brak potwierdzonej powierzchni właścicielskiej.

Decyzja zakresowa: naprawiono wyłącznie M19, bo to ten tor przepuścił incydent. Gate 6 DeckBuildera pozostaje P2/warning: rozszerzenie promienia rażenia poza zmierzony tor nie było potrzebne do R2/R3 i wymaga osobnego odbioru produktu. Nowa blokada nie ma override; rekomendacja instrukcji „na start bez obejścia” została zachowana.

## R2 — reprodukcja i reguła

PRZED zmianą `/private/tmp/cx-day256-bramki-formatow-scratch/before-repro.ts` zwrócił:

```json
{ "valid": true, "violations": [] }
```

Dokładny typ `UnifiedReportJSON` nie ma globalnych pól `initiatives` ani `risks`. Najbliższy bezpieczny wariant porównuje twierdzenie w `key_messages` z niepustymi, typowanymi slajdami `initiative_portfolio` i `risk_management` w tym samym raporcie. Nie używa LLM ani dopasowania dowolnej liczby.

## R3 — para dowodowa i mutacja

Komenda końcowa biegła z pełnym env real-PG, `DB_TYPE=postgres`, `--config server/vitest.config.ts` (wywołanym z katalogu `server`) i `--retry=0`. Oba pakiety są czysto jednostkowe; nie otwierają DB, Gateway ani fetch. Pułapki Z33 (feature/auth/test-mode) nie leżą na ścieżce tych funkcji; mimo to jawny env został podany, a pierwsze testy obu pakietów dowodzą `process.env.DB_TYPE === 'postgres'`.

Wynik końcowy: 4/4 PASS, pełne nazwy:

```text
Day 256 bundle deck source traceability gate keeps a clean SPINE valid
Day 256 bundle deck source traceability gate blocks a SPINE whose slide claims zero risks while source data is non-zero
Day 256 RulesEngine source traceability rule blocks a zero-risk claim contradicted by non-zero report source data
Day 256 RulesEngine source traceability rule allows a zero-risk claim when report source data is also empty
```

Mutacja: odłączono `REPORT_RULES` od `validateReport`; dokładnie dwa przypadki blokujące stały się RED (2 PASS / 2 FAIL), a obie kontrole czyste pozostały PASS. Przywrócenie przez `cp` dało 4 PASS / 0 FAIL; `git diff --check` bez wyjścia.

Pomiar nazw PRZED→PO: przed utworzeniem licencjonowanych nowych plików zbiór był pusty; po zmianie dodano powyższe cztery nazwy, żadna nazwa nie zniknęła.

## Środowisko i bezpieczeństwo

- przed worktree: 12 GiB wolne; po worktree i DB: 9.4 GiB, ponad próg 5 GB;
- porty 6252, 5232, 5233 były wolne; użyto wyłącznie `cx-day256-pg` na `127.0.0.1:6252`;
- obraz `pgvector/pgvector:pg16`; pierwszy przebieg migracji zakończony `Postgres migrations complete`, drugi: `Applying migrations: 0`;
- `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; Gateway nie zawiera drenów outbox;
- Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
- nie użyto Railway, zdalnej bazy, origin, LLM ani portu spoza licencji.

Artefakty:

| Plik                         | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `day256-mutacja.json`        | `cd6a8f3ffada9430d8892e862c826a80cc8b6808c965ebdfc295f3a33fd9b763` |
| `day256-pakiet-realenv.json` | `ffba1fdd6c326a95f1c1a5fe023c926f104257291e8230c28f2886ca09a85de7` |
| `po-nazwy.txt`               | `6a2270b632c76077496efd220bf0b5c0b25ee034cbaca91ad0869f97f10ca01d` |
| `przed-nazwy.txt`            | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano pełnego realnego HTTP/ApiGateway, bo R2/R3 są czystymi funkcjami bez I/O, a licencja wymagała testów funkcji M19 i adaptera wiązki.
- Nie zweryfikowano wizualnego PPTX ani eksportu; ta pozycja naprawia wynik bramki przed rendererem.
- Brak konsumenta `bundle.quality.doc/deck` w `src/` ustalono przez pełny `rg`, ale nie wykonano wizualnego runtime.

## Korekty wobec instrukcji

1. Instrukcja mówi o „13 regułach”, lecz pomiar wykazał 14 reguł slajdowych oraz globalną `EMPTY_REPORT` (15 emisji `rule:`). To wynik pomiaru, nie STOP.
2. Szkic R2 zakłada `report.initiatives`/`report.risks`; typ na markerze nie ma takich pól. Użyto odpowiadających im, niepustych sekcji slajdów w tym samym `UnifiedReportJSON`.
3. Znaleziono dodatkową warstwę `presentationExportGate.ts`, ale nie czwarty silnik oceny: scala wynik DeckBuildera z autoryzowanym override i 422.
4. Gate 6 nie został podniesiony, aby nie rozszerzać zmiany poza zmierzony tor wiązki.

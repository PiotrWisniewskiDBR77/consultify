# CODEX DAY 346 — fałszywa kompletność raportu Oceny

Data: 2026-09-04
Stan: **R1–R6 wykonane; naprawa licznika VERIFIED lokalnie; wydanie i produkcja NOT_PROVEN**

## Baza, marker i zasoby

Instrukcję odczytano w całości (1122 linie) z bare-vaulta. Dokument: `WYDANY`.

Wynik §0.1 (2), dosłownie:

```text
2b793b6fda fix: uratuj artefakty dowodowe dyzuru 335 do repo (blok3-po.json cytowany z SHA, a lezal poza repo)
1203348444 Merge agent/instr-K — instrukcje 347, 348, 349, 350
6972825bea docs(instrukcje): dyzury 347-350 — przyczyna 542 czerwieni, przemiar G19, czerwien UI + niestabilnosc, pakiet G16
97e15ee9fe Merge agent/instr-J — instrukcje 343, 344, 345, 346
ee1c810fe5 docs(instrukcje): dyzur 346 (falszywa kompletnosc raportu Oceny) + korekta sciezek testow w 344/345
a0a85ae181 docs(instrukcje): dyzur 345 — domkniecie panelu Idei/Notatnika
3943e4c92a docs(instrukcje): dyzur 344 — kafle etapow SWOT
e9e4408dd7 docs(instrukcje): dyzur 343 — DEC-388 domkniecie
d3ecaa3c4a Merge agent/naprawa-334
53a1cc29fc docs(naprawa-334): raport naprawy G20 + M29
56a0690e0d docs(licznik-g20): przegenerowany rejestr P0/P1
afc923d912 fix(licznik-g20): cofniecie trzech falszywych rozstrzygniec
7b7d7a5a92 fix(licznik-g20): SHA uznany za dowod naprawy musi byc mlodszy niz zgloszenie defektu
6a4919f72d fix(day341,342): przenies testy spod src/ do tests/ — bezpiecznik osiagalnosci zielony
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
6a4919f72db338e7f49a2cacb3787d20cc649883
```

Tip uciekł do `2b793b6fda`; praca pozostała dokładnie na markerze. Przed startem: 21 GiB wolne, porty 6393/5533 wolne. Utworzono wyłącznie `cx-day346-pg` (`pgvector/pgvector:pg16`, baza `cx346`). Pierwszy przebieg dał `schema_migrations=894`; drugi: `Applying migrations: 0`, `Postgres migrations complete`. Po pomiarze wykonano `docker rm -fv cx-day346-pg`; oba porty są ponownie wolne.

## R1 — reprodukcja z modelu

`buildDrdReportModel` z `input.areaScores` manifestu 339 dał:

```json
{"actualPositive":7,"targetPositive":39,"credibility":{"assessedAreas":39,"totalAreas":39,"completionPercent":100,"confidenceLabel":"Wysoka"}}
```

Warunek `actual > 0 || target > 0` istniał w obu bliźniakach: `server/src/services/report/drdReportModel.ts:358` i `src/services/report/drdReportModel.ts:393`. Cel był dodatni dla wszystkich 39 obszarów, więc alternatywa zamieniała każdy cel w rzekomą odpowiedź.

Konsumenci liczby w łańcuchu raportu:

- `server/src/services/report/drdReportHtml.ts:410` — karta okładki;
- `server/src/services/evidence/drdReportEvidenceBridge.ts:109` — confidence koperty dowodowej;
- `server/src/services/conclusions/reportConclusionBridge.ts:94` — kontekst wniosku/narratora.

Dosłowne zdanie przed naprawą: `Pomiar 346 — overall 0.4→2.4 (100% assessed, narrative: deterministic).`

## R2 — naprawa i mutacje

Oba modele liczą teraz wyłącznie `Number(s.actual) > 0`. Konsumenci pobierają poprawioną wartość z modelu. Karta wiarygodności pozostała.

| Sesja | Obszary | Kompletność | Etykieta |
| --- | ---: | ---: | --- |
| 7/39 | 7/39 | 18% | Niewystarczająca |
| 39/39 | 39/39 | 100% | Wysoka |

Korekta: przy 18% zastane progi zwracają `Niewystarczająca`; `Niska` zaczyna się od 30%. Progów nie zmieniono pod oczekiwanie instrukcji.

Mutacja licznika (`actual > 0 || target > 0` w obu modelach):

```text
success=false; 1 passed, 1 failed
AssertionError: expected { assessedAreas: 39, … } to match object { assessedAreas: 7, … }
```

Przywrócenie przez `cp`; `diff -u` kopia–plik pusty; ponownie `success=true; 2 passed, 0 failed`.

Mutacja zdania narratora (stałe `100%` przy dobrym liczniku):

```text
success=false; 1 passed, 1 failed
AssertionError: expected 'Pomiar 346 — overall 0.4→2.4 (100% as…' to contain '(18% assessed,'
```

Przywrócenie przez `cp`; `diff -u` pusty; końcowo `success=true; 2 passed, 0 failed`. Artefakty mutacji są w `/private/tmp/cx-day346-falszywa-kompletnosc-artefakty/`.

Pułapki (a)–(e): R2 był czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), bez V8/auth/visibility/DB/LLM; wejściem był manifest w repo, nie tymczasowy katalog 339.

## R3 — silnik 298

`grep -rn TechProd server/src/services/report/` dał zero trafień. Proza pochodzi z importu prototypu w przyrządzie, nie z `buildAcceptedDrdReportModel`. Przyrząd dostał opt-in parametry katalogów i sesji; przelot zapisał wyłącznie do katalogów 346. Pierwsza strona hybrydy pokazuje:

```text
DEMO UKŁADU — treść prototypowa, liczby z sesji 3c016470-a5f9-449d-9e99-822eaede71de
```

Nie dodano wołacza produkcyjnego i nie zmieniono prototypu.

## R4 — trzy silniki na 39/39

Sesja `3c016470-a5f9-449d-9e99-822eaede71de`, organizacja `day346-report-engine-org`. Realny test: ApiGateway, podpisany JWT, 39 odpowiedzi HTTP `201`, zimny GET zdarzeń `200`, GET kontraktu `200`, readback PostgreSQL. `r4-session39.json`: `success=true`, `1/1 PASS`, `--retry=0`.

| Silnik | Strony | Jawne braki / zera | Kompletność | Czas do PDF | Zgodność 21 stron | SHA-256 PDF |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| MethodSession DOCX | 18 | 39 × `nie oceniono — brak danych źródłowych` | n/d | 6985,56 ms | 18/21 | `e4dae262b786a00df1b2cc626105ceba66be2c9bd308094c81d868cd808fed35` |
| HTML | 9 | 0 obszarów z `actual=0` | 100%, 39/39 | 3485,78 ms | 9/21 | `008ae45da78fad7db787dabddac502f43b6bc3734c901cdff4bd97f40a2006f2` |
| Model 298 | 21 | 0 braków zależnych od sesji; statyczna proza oznaczona | n/d | 3974,15 ms | 21/21 | `4426acc863e1cc48bd90569d04c575ba3113c0a8e15df6909ab0588baf5ec2c2` |

Po 7/39 → 39/39 zniknęły 32 zerowe obszary HTML. Nie zniknęły różnice 18/9/21 stron ani hybrydowość 298. Najważniejsze obalenie tezy: DOCX zachował 39 komunikatów braku mimo 39 odpowiedzi. Kontrakt nie mapuje samych `ANSWER_CONFIRMED` do tych pól, więc wcześniejszych 148 braków nie wolno przypisać wyłącznie rzadkości danych.

Pułapki (a)–(e): R4 miał w jednej linii `DB_TYPE=postgres`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL`, JWT i `--retry=0`. Strażnik RealPG był bez argumentów. Przyrząd: `NODE_ENV=test MOCK_DB=false DB_TYPE=postgres DOTENV_DISABLED=1`, bez kluczy czterech dostawców. Nie użyto cudzego outputu.

## R5 — rekomendacja

R7 dyżuru 339 pozostaje: 298 jest najlepszym docelowym kontraktem układu 21 stron, ale nie wolno go podłączać obecnie. Pełna sesja potwierdziła przewagę strukturalną oraz statyczność prozy. HTML po R2 jest najuczciwszym działającym modelem liczbowym, nie docelowym układem. Następny krok: osobne mapowanie realnej MethodSession i metadanych do 298 oraz odbiór właściciela na pliku.

**DO DECYZJI WŁAŚCICIELA:** kolejność integracji — układ 298 czy najpierw osiągalny HTML. Zabrakło zatwierdzonego kryterium ważenia układu wobec gotowości produkcyjnej i akceptu właściciela na pliku 39/39; dyżur nie miał licencji na podłączenie silnika.

## Zasięg testów po nazwach

Komenda z roota i `--config server/vitest.config.ts` zebrała 0 testów — BŁĄD, nie PASS. Config serwera wymaga cwd `server/`. Bazowy i końcowy szeroki pakiet miał te same 5 nazw; w obu testy PG nie były dowodem przy `RUN_DB_TESTS=0`, a day339 kończył suite błędem. Nie przypisano mu zieleni.

Diff: 0 nazw znikniętych, 4 dodane — trzy R2/R3 i realny R4. `przed-nazwy.txt` SHA `ad0465f622ce038d103a75665eb1d6e27db79d8414f6cab24615459136b5bcbe`; `po-nazwy.txt` SHA `01767ba816708fc144d96aff4ab5142019ad267a5c5eb2a9f97185903c0f9ba2`.

## Brak wysyłki

Potwierdzono: `BRAK ZMIENNYCH POCZTY`; tabela `settings` ma 0 kluczy `smtp%`; `Gateway.ts` ma 0 drenaży.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Korekty wobec instrukcji

1. Worktree i gałąź istniały już na markerze. Współbieżna próba zobaczyła uruchomiony przeze mnie kontener jako obcy i dodała `8359496ef4` z przedwczesnym STOP-em. Historii nie resetowano; ten raport zastępuje werdykt pełnym pomiarem.
2. Oczekiwane „Niska” przy 18% przeczy progom; wynik to „Niewystarczająca”.
3. Bazowa komenda Vitest z roota zbiera 0 testów; właściwy cwd to `server/`.
4. Pierwszy runner migracji przekroczył czas wywołania, ale kontynuował. Równoległy runner fail-closed odmówił advisory lock; po zakończeniu potwierdzono 894 migracje, a właściwy drugi przebieg zastosował 0.
5. Teza o karaniu DOCX głównie rzadkością danych została obalona: 39 komunikatów zostało na 39/39.

## TWIERDZENIA NIEZWERYFIKOWANE

- Zachowanie narratora z realnym kluczem dostawcy.
- Zachowanie produkcyjnej trasy HTML po włączeniu domyślnie wyłączonej flagi.
- Czy natywny PDF produktu wygląda jak kontrolny PDF z LibreOffice.
- Wdrożenie, produkcyjny runtime, urządzenia/przeglądarki i akcept właściciela.
- Pełne znaczenie historycznej liczby 148; dyżur 346 zastosował odtwarzalny mianownik 39 dosłownych komunikatów braku danych obszaru.

## Commity

- R1 `d696511ca7`
- R2 `e791f749c6`
- R3 `9b2d559094`
- R4 `2640961a75`
- R5 `3c56e92dd6`
- R6: commit zawierający ten raport

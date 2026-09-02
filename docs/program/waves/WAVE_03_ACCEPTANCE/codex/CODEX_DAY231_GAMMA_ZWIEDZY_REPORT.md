# CODEX DAY 231 — GAMMA: DECK Z WIEDZY ORGANIZACJI

Data: 2026-09-01  
Gałąź: `codex/day231-gamma-zwiedzy-20260901`  
Marker: `9fb7942a01`  
Werdykt: **PARTIAL — rdzeń za flagą wdrożony; bramka realnym modelem niewykonana z powodu sprzeczności Z15/R5c.**

## 0. Baza pracy i marker

Wynik §0.1 (2):

```text
9fb7942a01 G-3 c.d.: Gamma SAMA ostrzega ze uklady rozjada sie w PPTX (...)
MARKER OK
```

Wynik §0.1 (7):

```text
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`git status --short | head -3` nie wypisał nic. Dysk: 13 GiB wolne. Porty 6175, 5138 i 5139 były wolne. Tip gałęzi bazowej był sześć commitów przed markerem; diff dotyczył dokumentacji, a log dla `presentations.routes.ts` i `presentationGeneratorService.ts` był pusty — kolizji zasobowej nie wykryto.

## 1. Wynik pozycji

### R1 — konspekt z wiedzy: ZREALIZOWANY W KODZIE, NIEZWERYFIKOWANY REALNYM MODELEM

- Dodano `ENABLE_DECK_FROM_KNOWLEDGE`, default OFF, odczytywaną świeżo z env.
- Nowy `presentationKnowledgeOutlineService.ts` przechodzi przez istniejący `AIPipeline`; kontekst organizacji buduje istniejący pipeline.
- Model dostaje istniejącą rodzinę READ; callback wywołuje wyłącznie `executeToolCall`, bez własnego SELECT z tabel wiedzy.
- Przebieg fail-closed odrzuca wynik, jeśli model nie wywoła `search_knowledge_base`.
- `zrodla` są filtrowane względem surowego wyniku executora: ID wymyślone przez model zostaje usunięte; pusta lista pozostaje dozwolona.
- Przy fladze OFF pozostaje dotychczasowa gałąź szablon/słowa kluczowe.

### R2 — konspekt przed deckiem: TEZA INSTRUKCJI OBALONA

Produkcja już ma pełną kolejność: `PresentationWizard.handleGenerateOutline` woła `/presentations/generate/outline`, ustawia `step='outline'`, renderuje realny `OutlineStep`, pozwala edytować tytuł i `keyMessage`, a dopiero `handleGenerate` woła `/generate/deck`. Rozszerzono istniejący `OutlineStep` o widoczne etykiety źródeł i zsynchronizowano edycję tezy.

### R3 — prowieniencja: CZĘŚCIOWO ZREALIZOWANA

Teza „nikt nie zapisuje source_type/source_id” była fałszywa: marker już zapisuje oba pola w `generateOutline`. Zmiana uzupełnia `source_refs_json`; dla ścieżki wiedzy zapisuje `source_type='org_knowledge_outline'`, `source_id=projectId` (fallback organizationId), a w `source_refs_json` wyłącznie źródła potwierdzone wynikiem executora. Atrybucji każdej liczby wewnątrz `deck_json/unified_json` nie dowiedziono — patrz twierdzenia niezweryfikowane.

### R4 — zasięg i prywatność: NIEZWERYFIKOWANY END-TO-END

Kod generatora nie buduje drugiej drogi SQL i korzysta z `executeToolCall`. Nie wykonano pary in-scope/out-of-scope na nowej ścieżce decku, ponieważ wymagałaby przebiegu R5 z modelem. Nie ogłaszam PASS.

### R5 — bramka treściowa: NIE WYKONANO

Instrukcja jest sprzeczna:

- `Z15`: „Zero modelu językowego w tym dyżurze. Żaden pomiar (...) nie woła llmService”.
- `R5c`: „przebieg z realnym modelem”, budżet dwa przebiegi.

Zgodnie z sekcją „JEŚLI COŚ (...) JEST SPRZECZNE” wybrałem bezpieczniejsze `Z15`. **Modelu nie wołałem.** Nie wykonano zielonego/czerwonego przebiegu treściowego i nie ma podstawy do twierdzenia, że fakt 63,4% / 51,2% przechodzi przez nową ścieżkę.

### R6 — zrzuty: PASS JAKO STORY/HARNESS, NIE DOWÓD RUNTIME

Ekran montuje realny `OutlineStep`; dane pochodzą z propsów harnessu, nie z realnego przebiegu. Zrzuty:

- `/private/tmp/cx-day231-gamma-zwiedzy-artefakty/day231-konspekt-light.png`, mean_luma 244,3, SHA-256 `05902a2c82084f9ebb959bc2af7783ff315880b8f398fee8f6400bd82c4f7604`
- `/private/tmp/cx-day231-gamma-zwiedzy-artefakty/day231-konspekt-dark.png`, mean_luma 26,9, SHA-256 `a47c55f22d90ed7bb746173b4d608dd8ff79ce2762a761a864fee54fe2547be2`
- różnica luminancji: 217,4 (>150), oba PNG 1280×807.

## 2. RealPG / ApiGateway / mutacja

Kontener: `cx-day231-pg`, `pgvector/pgvector:pg16`, port `127.0.0.1:6175`, baza `cx231`. Pierwszy pełny przebieg migracji: `Postgres migrations complete`; drugi: `Applying migrations: 0` i sukces.

Dowód flagi OFF:

```text
Day231 outline route through real ApiGateway keeps flag-OFF behavior deterministic and persists honest empty source_refs_json :: passed
```

Łańcuch: podpisany JWT → realny `ApiGateway.getInstance().initializeRoutes(app)` → HTTP POST `/api/presentations/generate/outline` → INSERT do PostgreSQL → niezależny SQL readback: `source_type=manual`, `source_id=NULL`, `source_refs_json=[]`.

Mutacja produkcyjna (`JSON.stringify(knowledgeSources)` → `NULL`):

```text
failed AssertionError: expected null to deeply equal []
```

Po odtworzeniu przez `cp`:

```text
Day231 outline route through real ApiGateway keeps flag-OFF behavior deterministic and persists honest empty source_refs_json :: passed
```

Diff pliku produkcyjnego po cofnięciu mutacji: pusty. Artefakty: `day231-gateway-mutation-red.json` SHA-256 `11d05bd07e40bc0a93badfe3f55dfae5980b1430d2ea01c665919dcbfcc8aae5`; `day231-gateway-after-restore-green.json` SHA-256 `373cee6c7d631dfda389db60f559e73156d683df3ebe055be9ebd41eda457f68`.

## 3. Zasięg testów pełnymi nazwami

Dodane nazwy:

```text
Day231 outline route through real ApiGateway keeps flag-OFF behavior deterministic and persists honest empty source_refs_json
Day231 presentation knowledge outline contract keeps zrodla empty instead of inventing incomplete references
Day231 presentation knowledge outline contract parses a grounded thesis and preserves exact provenance
Day231 presentation knowledge outline contract removes a model-proposed source id that was absent from governed tool evidence
```

`po-nazwy.txt` SHA-256 `20434ab28612f601f94221dddf51371d6751d9dbc23f4f107b05f2b8bced7b8c`; `diff-nazwy.txt` SHA-256 `cfc8d656c9fb69db5f2e4091b7a2f1eb6c348d19e51635068f09a6600f0d06cf`.

**Ograniczenie pomiaru:** `przed-nazwy.txt` jest pusty, ponieważ na markerze nie istniały pliki `day231.*`; nie uruchomiono przed zmianami pełnego pakietu katalogów z §0.2c. To jest EVIDENCE_MISSING wobec pełnego wymogu §0.4a, a nie PASS pełnego korpusu. Dwa pierwsze uruchomienia pod `server/vitest.config.ts` zwróciły 0 suites / success=false i zostały odrzucone jako brak pomiaru; właściwe przebiegi użyły configu root.

Pułapki wyłączone dla RealPG: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny `DATABASE_URL`, jawny `JWT_SECRET`, `--retry=0`. Flaga nowej funkcji była jawnie OFF w dowodzie kompatybilności.

## 4. Korekty wobec instrukcji

1. `server/src/services/ai/ragService.ts` nie istnieje; realny plik jest `server/src/services/ragService.ts`.
2. Szeroki grep `source_type|source_id | sed -n 1,4p` pokazuje wcześniejsze, niezwiązane tabele i nie dowodzi decków; dokładne trafienia są później w migracji.
3. Produkcyjny krok konspektu istnieje i jest renderowany; nie budowano nowego kreatora.
4. `source_type/source_id` były już zapisywane przy tworzeniu konspektu; brakowało `source_refs_json`.
5. `Z15` i `R5c` wykluczają się; zastosowano bezpieczniejsze `Z15`.

## 5. Bezpieczeństwo poczty

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Runtime zrzutów stanowił wyłącznie Vite dev-render na porcie 5138; backend `server/src/index.ts` nie był uruchamiany. Nie wykonano połączeń do Railway, demo, stagingu ani produkcji.

## 6. Commity i push

- `c4f4759070` — rdzeń konspektu, prowieniencja, UI i test jednostkowy
- `11f3dcb837` — ekran dowodowy light/dark
- `e679c7adf3` — fail-closed dla wymyślonych źródeł
- `2c7e7a6bee` — RealPG/ApiGateway i mutacja

Po każdym commicie wykonano push wyłącznie do `github-backup/codex/day231-gamma-zwiedzy-20260901`.

## 7. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano, że realny model sam wywołuje `search_knowledge_base` na nowej trasie `/generate/outline`.
- Nie zweryfikowano treściowej pary 63,4% / 51,2% ON oraz utraty obu liczb po mutacji OFF.
- Nie zweryfikowano imiennie zaseedowanego dokumentu spoza zasięgu w konspekcie i gotowym decku.
- Nie zweryfikowano atrybucji każdej liczby w `deck_json` / `unified_json`.
- Nie wykonano pełnego pakietu testów katalogowych ani pełnego porównania nazw przed/po.
- Zrzuty są dowodem renderu realnego komponentu z propsami harnessu, nie dowodem danych z RealPG ani realnego modelu.
- Nie wygenerowano i nie zweryfikowano finalnego PPTX z nowej ścieżki.


# CODEX DAY 209 — INDEKSACJA ARTEFAKTÓW DO WIEDZY

Data pomiaru: 2026-08-31  
Gałąź: `codex/day209-indeksacja-20260831`  
Baza: wyłącznie lokalny `cx-day209-pg`, `127.0.0.1:6149/cx209`  
Werdykt: **PARTIAL / NOT_PROVEN**

## 0. Wejście i marker

Wynik §0.1 (2), dosłownie:

```text
529c12a707 fix(instrukcje): marker 208/209 poprawiony na TIP ZDALNY 29f004c670 (bylo e96e003abd = commit lokalny toru grafiki, nigdy niewypchniety -> MARKER BRAK); praca grafiki zabezpieczona na backup/m03-local-grafika-20260831
29f004c670 docs(codex): dyzur 210 P0 wydany — wyciek prywatnych dokumentow w obrebie organizacji POTWIERDZONY pomiarem; korekta: dwa handlery search_knowledge_base o przeciwnej postawie (czat wycieka, agent szczelny); 210 przed 209
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
29f004c670b677443364868df73106a2d6c300d4
```

`git status --short | head -3` był pusty. Tip uciekł o jeden commit dotyczący wyłącznie korekty instrukcji 208/209; praca zgodnie z instrukcją zaczęła się dokładnie z `29f004c670`.

Przy starcie: 14 GiB wolne; `lsof` dla `6149`, `5090`, `5091`, `5060`, `5061` był pusty. Runtime 5090/5091 nie był potrzebny i nie został uruchomiony.

## 1. Co dostarczono

### R1 — dokumenty: PARTIAL

- Dodano `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`, `z.boolean().default(false)`; helper czyta env per-call.
- Hook jest jeden, na końcu `materializeDocumentArtifact`, po trwałym zapisie artefaktu, evidence/lifecycle/overlay i przed `return`.
- OFF jest fail-fast no-op: przed wywołaniem indexera nie ma żadnego SELECT/INSERT indeksacji.
- Wspólny `artifactKnowledgeIndexer.ts` mapuje `confidential|restricted -> user`, pozostałe wartości -> `organization`.
- `KnowledgeService.processDocument` dostał wyłącznie addytywny czwarty parametr `skipGlobalEmbeddingIndex=false`. Dla `scope=user` indexer zawsze przekazuje `true`.
- Tekstem dokumentu jest dokładnie markdown wygenerowany przez istniejący `renderSchemaToMarkdown`, nie surowy JSON.

Nie ogłaszam R1 jako wykonane wg DoD: świeży RealPG ujawnił zastaną niezgodność schematu opisaną w STOP poniżej.

Commit i push po pozycji: `4a133bc73a feat(day209): add guarded document knowledge index hook (partial)`.

### R2 — decki: PARTIAL

- Hook jest bezpośrednio po udanym `UPDATE presentation_decks SET status='ready'`.
- Flaga jest sprawdzana przed dodatkowym SELECT-em.
- `confidentiality`, `deck_json`, `unified_json`, tytuł i `generated_by` są odczytywane z realnego wiersza o `status='ready'`.
- Kanonicznym źródłem jest `deck_json`, ponieważ zapisuje pełny `DeckDocument.cards` (tytuły, key message, block content, speaker notes). `unified_json.slides` jest fallbackiem tylko przy braku czytelnych kart.
- Prywatny deck nie tworzy wiersza `ai_knowledge_embeddings`; lustrzany test `search_knowledge_base` nie zwrócił jego unikalnej treści.

Pełne zaindeksowanie decka pozostaje zablokowane przez tę samą zastaną niezgodność `KnowledgeService.processDocument`.

Commit i push po pozycji: `3331d27917 feat(day209): add guarded deck knowledge index hook (partial)`.

### Ochrona niezależna od dyżuru 210

Rozwiązanie nie zakłada, że równoległy dyżur 210 wylądował. Dla `scope=user` globalny zapis embeddingu jest lokalnie pomijany. Nawet przy całkowitym braku filtra scope w domyślnym wyszukiwaniu prywatna treść nowego artefaktu nie może zostać znaleziona w `ai_knowledge_embeddings`, ponieważ nie ma tam jej wiersza.

## 2. STOP merytoryczny R1/R2

### STOP — R1 pełna indeksacja dokumentów

Rodzaj: MERYTORYCZNY  
Powód: istniejący `KnowledgeService.processDocument` wpisuje `knowledge_chunks.created_at`, lecz świeża tabela po 871 migracjach nie ma tej kolumny.  
Licencja, którą sprawdziłem: `server/src/services/KnowledgeService.ts — WYŁĄCZNIE nowy opcjonalny parametr skipGlobalEmbeddingIndex`; naprawa SQL INSERT byłaby drugim, zabronionym rodzajem zmiany w tym pliku.  
Dowód: RealPG zwrócił `column "created_at" of relation "knowledge_chunks" does not exist` dla INSERT-u z `KnowledgeService.ts:704`; `\d knowledge_chunks` potwierdziło brak kolumny. Test org: 0 wierszy w globalnym indeksie. Test private: 0 wierszy w `knowledge_chunks`.  
Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt RealPG, bezpieczny parametr `skipGlobalEmbeddingIndex`, hook za flagą OFF i gotowy brief promienia naprawy.  
Co zrobiłbym, gdyby zapadła decyzja X: po rozszerzeniu licencji usunąłbym zależność INSERT-u od `created_at` albo dodał jawnie wydaną migrację, następnie powtórzyłbym mutację i realny readback obu tabel.  
Rekomendacja dla nadzorcy: naprawić zgodność `KnowledgeService.processDocument` ze świeżym schematem przed włączeniem flagi. Promień: wszystkie uploady Vault oraz oba nowe hooki.  
Stan: zacommitowano częściowo w `4a133bc73a`.  
Czy kontynuowałem pozostałe pozycje: TAK — R2 i R3.

### STOP — R2 pełna indeksacja decków

Rodzaj: MERYTORYCZNY  
Powód: deck używa tego samego, czerwonego `processDocument`; hook i ochrona private są obecne, lecz chunk/readback pozytywny nie jest możliwy.  
Licencja, którą sprawdziłem: ta sama wyłączna licencja na opcjonalny parametr w `KnowledgeService.ts`.  
Dowód: wspólny pakiet RealPG ma 6 przypadków: 4 PASS, 2 FAIL; oba FAIL dotyczą brakującego zapisu chunków/globalnego indeksu, nie ochrony private.  
Co dostarczyłem ZAMIAST zmiany: lustrzany kontrakt private deck + ekstrakcję kanonicznego tekstu + hook za flagą OFF.  
Co zrobiłbym, gdyby zapadła decyzja X: po naprawie wspólnego INSERT-u wykonałbym generację decka, SQL readback i domyślne wyszukiwanie.  
Rekomendacja dla nadzorcy: nie włączać `ENABLE_ARTIFACT_KNOWLEDGE_INDEX` przed zielonym readbackiem R1 i R2.  
Stan: zacommitowano częściowo w `3331d27917`.  
Czy kontynuowałem pozostałe pozycje: TAK — R3.

## 3. R3 — inwentarz raportów (zero implementacji)

Polecenie startowe zwróciło 11 ścieżek, nie „~20”. Pomiar rozdziela realne silniki od wrapperów/markerów.

| Plik / ścieżka | Gdzie materializuje wynik | Punkt zbiegu | Priorytet przyszłego dyżuru |
|---|---|---|---|
| `aiAssessmentReportGenerator.ts` | Nie zapisuje; zwraca obiekt `report` do tras `assessment-ai.routes.ts` | Jeden obiekt z 4 wariantami (`full`, stakeholder, benchmark, initiative plan), ale zapis zależy od callerów | P2 — najpierw ustalić właściciela trwałości i ACL |
| `ai/reportContentGenerator.ts` | Nigdzie; jawny `{__unavailable__: true}` | Brak generatora | P4 — nie liczyć jako generator |
| `ai/reportContentGenerator` | Bezrozszerzeniowy re-export poprzedniego pliku | Brak | P4 — duplikat kompatybilności |
| `ai/reportGeneratorService.ts` | Nigdzie; jawny `{__unavailable__: true}` | Brak generatora | P4 — nie liczyć jako generator |
| `ai/reportGeneratorService` | Bezrozszerzeniowy re-export poprzedniego pliku | Brak | P4 — duplikat kompatybilności |
| `ai/bcgReportGenerator` | Bezrozszerzeniowy re-export do nieobecnego `bcgReportGenerator.js` | Brak realnej implementacji w `server/src` | P3 — usunąć fantom lub wskazać SSOT w osobnym dyżurze |
| `ai/comprehensiveReportGenerator` | Bezrozszerzeniowy re-export do nieobecnego `comprehensiveReportGenerator.js` | Brak realnej implementacji w `server/src` | P3 — jak wyżej |
| `report/drdReportGenerator.ts` | Zwraca `{html, model}`; sam nie zapisuje | Jeden czysty generator, orchestration w `drdReportService.ts` | P2 — hook powinien siedzieć u trwałego callera, nie w czystym generatorze |
| `report/ReportGeneratorService.ts` | Zwraca dane admin raportu z SELECT-ów, bez trwałego zapisu | Jedna klasa, 5 typów danych | P3 — raczej eksport doraźny niż wiedza trwała |
| `report/ReportGeneratorService` | Bezrozszerzeniowy re-export klasy | Duplikat kompatybilności | P4 — nie liczyć osobno |
| `reportGenerationService.ts` | `report_builder_reports` + `report_builder_sections.generated_content`; status `GENERATED`, metadata w `generation_metadata` | Realny jeden punkt zbiegu: `generateFullReport`; one-click `generateReport` deleguje do niego | **P1** — najlepszy kandydat 17-J-2 po naprawie wspólnego processDocument |

Wniosek: realne, odrębne ścieżki to cztery, nie 11 i nie ~20. Najtańszy następny hook to zakończenie `reportGenerationService.generateFullReport`, ponieważ ma trwały raport i status końcowy.

## 4. Pomiary wejściowe i korekty wobec instrukcji

1. `materializeDocumentArtifact` pozostaje w jednej definicji. Rzeczywistych wykonań jest 7: `document-studio.routes.ts` ×2, `work-canvas.routes.ts` ×1, `docGenerationRuntime.ts` ×2, `chatTargetMappingService.ts` ×1, `ideaHandoffService.ts` ×1. Surowe `grep -rln` dodatkowo podnosi komentarz w `caseWorkspace/adapters/documentsAdapter.ts`, więc liczba plików z tekstem nie jest liczbą callerów.
2. `wave5_artifacts` nie ma kolumny scope/confidentiality. `content_json_native` dostaje cały `provisionalSchema`; hook korzysta z tej samej finalnej wartości `finalSchema.confidentiality`, która jest następnie widoczna w trwałym schema overlay/read path. Domyślne `internal` jest ustawione w `documentContentGenerator.ts:704`, nie w oczekiwanej linii 674.
3. `presentation_decks.confidentiality` istnieje; oba JSON-y są zapisane przy przejściu do `ready`.
4. `embeddingService.ts` nie zna scope. `searchKnowledgeBase.ts` daje `documentIds` tylko dla filtrów tool-pack. Nie zakładano wyniku dyżuru 210.
5. Sąsiednia flaga `ENABLE_TERESA_RECORD_CREATE` ma dziś default ON (`default(true)` i env `!== 'false'`), nie OFF. Nowa flaga zgodnie z instrukcją ma default OFF.
6. Instrukcja podaje `~20` generatorów; pomiar daje 11 trafień nazwowych, z czego tylko cztery realne ścieżki logiki.
7. Fresh RealPG obalił założenie, że obecny `processDocument` zapisuje `knowledge_chunks`: INSERT odwołuje się do nieistniejącej kolumny `created_at`.

## 5. Testy i zasięg nazw

### Przed

Pełny wskazany korpus, `--retry=0`, RealPG:

- 783 suites; 2444 testy;
- 2344 PASS, 55 FAIL, 37 pending;
- 2430 unikalnych pełnych nazw;
- wynik czerwony — nie jest PASS.

### Po

- 785 suites; 2450 testów;
- 2347 PASS, 58 FAIL, 37 pending;
- 2436 unikalnych pełnych nazw;
- wynik czerwony — nie jest PASS.

`diff przed-nazwy.txt po-nazwy.txt`: sześć nazw dodanych, zero znikniętych. Dodane nazwy są zapisane w `nazwy.diff`; dwie są czerwonym kontraktem wspólnego INSERT-u, cztery przechodzą (env/scope, private search, ekstrakcja decka, private deck).

Zmiana statusów zastanych testów między dwoma pełnymi przebiegami nie jest regresją nazw: jedna wcześniejsza porażka stała się zielona, dwie inne istniejące nazwy stały się czerwone. Nie przypisuję im PASS ani naprawy.

Pułapki Z33:

- (a), (b), (d): ustawiono w tej samej linii `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `ENABLE_TEST_AUTH_BYPASS=false`.
- (c): `MOCK_DB=false DB_TYPE=postgres`, asercja w nowym pakiecie potwierdziła `DB_TYPE=postgres`; strażnik połączył się z `127.0.0.1:6149/cx209`.
- (e): generator embeddingu był deterministycznie zastąpiony na prototypie wyłącznie w teście; żadnego providera/modelu nie wywołano. INSERT pgvector i SELECT/readback były realne. Prywatność nie zależała od scope filter wyszukiwania.

Nie wykonano dowodu HTTP przez ApiGateway, podpisany JWT i realną trasę. Ten brak jest powodem `NOT_PROVEN`; testowany zakres to backendowe funkcje po materializacji oraz realny PostgreSQL/readback.

## 6. Migracje i Z30

- Pierwszy przebieg migracji: `Applying migrations: 871`, exit 0.
- Drugi przebieg: `Applying migrations: 0`, exit 0.
- `env` zwrócił `BRAK ZMIENNYCH POCZTY`.
- `settings WHERE key LIKE 'smtp%'`: 0 wierszy.
- `Gateway.ts`: 0 trafień drenów wskazanych w §0.2b.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 7. Artefakty poza repo

| Plik | SHA-256 |
|---|---|
| `/private/tmp/cx-day209-indeksacja-artefakty/day209-vitest-przed.json` | `26a92aca7bf198d19cf1676dad2c2dfb185f17f27dfed84bef1f6a3c2ee13fc5` |
| `/private/tmp/cx-day209-indeksacja-artefakty/day209-vitest-po.json` | `9aee7b9c0140b96c3fe33b386e8e8fee2b91772ea36ecc24bee0221ef2c52897` |
| `/private/tmp/cx-day209-indeksacja-artefakty/day209-r1.json` | `01fe66cdb125052f648c8f629f3593edee1a33f42589001efdd6607d4a8afd22` |
| `/private/tmp/cx-day209-indeksacja-artefakty/day209-r2.json` | `8e587e9e9c3766874a91558a6b479cf4748a61fe931c38dbb8be65a3f966c0fa` |
| `/private/tmp/cx-day209-indeksacja-artefakty/przed-nazwy.txt` | `1888d68b445731cec6df8980925c54c278f862843691558c0ed191ade6982611` |
| `/private/tmp/cx-day209-indeksacja-artefakty/po-nazwy.txt` | `ec6e07b51e63c82a7c61334e4431506e584080834c3c0c5330024caba9673d8d` |
| `/private/tmp/cx-day209-indeksacja-artefakty/nazwy.diff` | `7b447d01bac358135256f2f9111e1d9e58bad062436225bd9c08035ac320df9a` |

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- NIEZWERYFIKOWANE przez prawdziwe HTTP: że wszystkie wejścia do `materializeDocumentArtifact` dochodzą do nowego hooka przez produkcyjny ApiGateway.
- NIEZWERYFIKOWANE przez pełną generację decka: że w każdym historycznym wariancie `deck_json` ma ten sam kształt kart; fallback `unified_json` jest zabezpieczeniem.
- NIEZWERYFIKOWANE: zachowanie po scaleniu dyżuru 210; rozwiązanie Day 209 świadomie od niego nie zależy.
- ZWERYFIKOWANE statycznie i przez zachowanie domyślnego parametru: istniejący caller bez czwartego argumentu zachowuje `skipGlobalEmbeddingIndex=false`. Nie ogłaszam pełnej regresji callerów, bo wspólny zastany INSERT jest czerwony na Fresh RealPG.
- NIEZWERYFIKOWANE dla całego repo: wszystkie alternatywne bezpośrednie SELECT-y z `ai_knowledge_embeddings`; zakres odczytu zgodny z licencją obejmował wskazane ścieżki.
- NIEZWERYFIKOWANE jako działające: pozytywne wyszukiwanie artefaktu org oraz trwały chunk private — oba jawnie czerwone z powodu braku `knowledge_chunks.created_at`.

## 9. Pliki i stan końcowy

Pliki produktowe/testowe w commitach R1/R2:

```text
server/src/config/FeatureFlags.ts
server/src/services/KnowledgeService.ts
server/src/services/documentStudio/documentStudioService.ts
server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts
server/src/services/knowledge/artifactKnowledgeIndexer.ts
server/src/services/presentationGeneratorService.ts
```

Flaga pozostaje OFF. Nie zmieniono UI, generatorów raportów, middleware, globalnej infrastruktury testowej, `embeddingService.ts`, `ragService.ts`, `searchKnowledgeBase.ts` ani `documentGovernance.ts`.

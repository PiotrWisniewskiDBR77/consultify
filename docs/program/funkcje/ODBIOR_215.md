# ★ SCALONE PO FIX-215 (`b1f66ad9d6`) — 31.08.2026

Raporty zasilają bazę wiedzy — **ostatni z trzech typów artefaktu**. Pętla
„system odżywia się pracą" domknięta na dokumentach, deckach i raportach.

## Co potwierdził odbiór adwersaryjny (własnymi rękami, nie z logów)
11/11 realnie się wykonało · powtarzalność 3× prawdziwa · hook łapie **wszystkich
trzech** wołaczy (czwarte trafienie grepa to inna funkcja o tej samej nazwie) ·
flaga reużyta, zero nowych, domyślnie OFF · atrapy w `beforeEach` (poprawnie) ·
**mutacja zasięgu daje czerwień TREŚCIOWĄ** — wyciekał losowy znacznik, nie sama
zmiana liczby wyników. To NIE jest pusto-prawdziwa asercja z dyżuru 210.

## FIX-215 — transport poufności
Audytor zmierzył łańcuch: interfejs → hook → trasa → serwis → kolumna, i wykazał,
że pole nie dojeżdża. Naprawione **na poziomie trasy** (chroni wszystkich wołaczy,
obecnych i przyszłych) plus w hooku. Decyzja wykonawcy: pole najwyższego poziomu,
bez odczytu zapasowego z `config_json` — jedno źródło prawdy zamiast dwuznaczności,
które wygrywa przy konflikcie.

**Bramka — czerwień treściowa:** cofnięcie naprawy ⇒ `expected 'internal' to be
'confidential'` oraz `expected { scope: 'organization' } to match { scope: 'user' }`.
Przywrócenie ⇒ 3/3 zielone, pakiet 209+215 razem 14/14.

**Pętla domknięta dowodem:** raport oznaczony jako poufny ⇒ `scope='user'`, **zero
wierszy w indeksie**, treść nieznajdowana przez realne `search_knowledge_base` w
kontekście innego członka organizacji. Kontrola pozytywna: raport wewnętrzny JEST
znajdowany — czyli brak wyniku nie jest artefaktem zepsutego wyszukiwania.

**Punkt 2:** dowód osiągalności przez pełną `ApiGateway.initializeRoutes` — trasa
odpowiada 201 w produkcyjnym drzewie tras, przez cały stos pośredników.

## ★ SPROSTOWANIE WYKONAWCY WOBEC DIAGNOZY AUDYTORA (zweryfikowane przez nadzorcę)
Audytor napisał, że „każdy raport z żywego wizarda ma poufność `internal`
niezależnie od wyboru użytkownika". Wykonawca to sprawdził i **obalił**:
`useReportBuilder.ts`/`IntentStep.tsx` to kod **osierocony** — `index.ts:8` mówi
wprost „Legacy Wizard (removed 2026-07-27 — never imported)". Nadzorca zweryfikował
niezależnie: `IntentStep` ma **zero importerów** poza sobą, a z dziesięciu żywych
wołaczy trasy **żaden** nie wysyła poufności — ani w polu najwyższego poziomu, ani
w `config`.

**Prawdziwy stan: dziś żaden zamontowany ekran nie daje użytkownikowi wyboru
poufności.** Nic nie jest gubione, bo nie ma czego gubić — wszystkie raporty
dostają wartość domyślną. Naprawa transportu jest nadal potrzebna (jedyne miejsce
prawdy dla każdego przyszłego wołania), ale ryzyko „na żywo" było **węższe**, niż
opisał audytor i niż nadzorca zameldował właścicielowi. Zameldowane sprostowanie.

**Pozycja otwarta:** przywrócić użytkownikowi wybór poufności raportu w
zamontowanym ekranie — osobny dyżur, bo to zmiana produktowa, nie naprawa.

---

## Pierwotna karta odbioru adwersaryjnego

---
doc_id: funkcje-odbior-215
status: evidence
truth_type: work-status
established: 2026-08-31
---

# Odbiór adwersaryjny — dyżur 215 (indeksacja raportów do bazy wiedzy AI)

**Werdykt: `B` — SCALIĆ PO FIX. Mechanizm dyżuru 215 jest realny i sprawdzony
mutacją własnymi rękami (przeciek treściowy, nie tylko liczbowy). Ale
mechanizm ten chroni kolumnę `confidentiality`, która dla raportów tworzonych
przez żywy wizard UI dziś NIGDY nie dostaje wartości użytkownika — utyka na
DEFAULT `'internal'`. To pre-istniejąca luka (nie wprowadzona przez 215),
ale wprost unieważnia sedno bezpieczeństwa tego dyżuru, jeśli flaga
kiedykolwiek zostanie włączona bez naprawy.**

Materiał: worktree `/private/tmp/cx-day215-indeks-raportow`, gałąź
`codex/day215-indeks-raportow-20260831`, commity `b68405379a` (raport) i
`1e3cb53c31` (implementacja + testy). Weryfikacja na własnym, świeżo
zbudowanym PostgreSQL 16 + pgvector, port 6301 (kontener
`cx-day215-audit-pg`, sprzątnięty `docker rm -fv` po zakończeniu). Migracje
od pustej bazy: `npx tsx server/scripts/migrate.postgres.ts` z katalogu
repo (nie `server/`) → `✅ Postgres migrations complete`, bez błędów.

## Co wykonawca TWIERDZIŁ i co POTWIERDZIŁ audytor

| Teza wykonawcy | Werdykt | Dowód audytora |
|---|---|---|
| „11/11 zielonych, `--retry=0`" | **PRAWDA** | Uruchomiono własnymi rękami 4 pliki testowe (day209 + day215) razem: `artifactKnowledgeIndexer.pg.test.ts` (6), `document-studio-knowledge-index.http.pg.test.ts` (1), `reportArtifactKnowledgeIndexer.pg.test.ts` (2), `report-builder-knowledge-index.http.pg.test.ts` (2) = 11. `Test Files 4 passed (4)`, `Tests 11 passed (11)`. Żadnego „No test files found", żaden `describe.skipIf` nie pominął — `REAL_DB` i `FLAG_ON` były prawdziwe (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_ARTIFACT_KNOWLEDGE_INDEX=true`), potwierdzone realnymi INSERT/SELECT w logach Postgres. |
| „Bramka powtarzalności: 3× po 4/4" | **PRAWDA** | Powtórzono 3 pełne przebiegi obu nowych plików (`reportArtifactKnowledgeIndexer.pg.test.ts` + `report-builder-knowledge-index.http.pg.test.ts`) na tej samej bazie: `4 passed` za każdym razem. |
| „Mutacja zakresu ujawniła rzeczywisty wyciek przez `search_knowledge_base`" | **PRAWDA, i to jest przeciek TREŚCIOWY, nie tylko liczbowy** | Zmutowano własnymi rękami `inferKnowledgeScope()` → zwraca na sztywno `'organization'` (`server/src/services/knowledge/artifactKnowledgeIndexer.ts:15-16`). Wynik: 2 testy poczerwieniały. Kluczowy: `reportArtifactKnowledgeIndexer.pg.test.ts:124` — `expect(foundAsOtherUser.results.some((row) => row.content.includes(privateSecret))).toBe(false)` → `AssertionError: expected true to be false`. `privateSecret` to losowy string (`DAY215_CONFIDENTIAL_REPORT_MUST_NOT_LEAK_${suffix}`), nie pusty ciąg — asercja NIE jest pusto-prawdziwa z dyżuru 210 (tam porównywane pole było zawsze puste). Tu pole `row.content` jest realnie wypełnione i test łapie faktyczne pojawienie się prywatnej treści w globalnym wyszukiwaniu. Po przywróceniu pliku (`cp` z backupu) — `git status`/`git diff` puste, 3 kolejne pełne przebiegi zielone (4/4). |
| „`generateFullReport` ma 3, nie 2 produkcyjnych wołaczy" | **PRAWDA, policzone samodzielnie** | `grep -rn "generateFullReport" server/src --include="*.ts"` (bez testów) → dokładnie 3 wołania funkcji `reportGenerationService.ts:1580`: (1) `report-builder.routes.ts:2625` (trasa HTTP), (2) `scheduledReportService.ts:553` (scheduler, dynamiczny import), (3) `reportGenerationService.ts:2013` wewnątrz `generateReport()` (na markerze linia 1960, przesunięta po diffie o +53 linie — zgadza się). Czwarty trafiony wynik, `aiAssessmentReportGenerator.ts:157`, to INNA funkcja o tej samej nazwie na innym obiekcie (`aiAssessmentReportGenerator.generateFullReport`) — nie woła kodu z hookiem. Hook jest wpisany BEZPOŚREDNIO w ciało wspólnej funkcji (`reportGenerationService.ts:1849-1895`, przed `return`), więc wszystkie 3 realne ścieżki go uruchamiają — nie tylko jedna. |
| „Pełny test `ApiGateway.initializeRoutes` pozostaje PARTIAL" | **PRAWDA, uczciwie ujawnione, nie blokuje** | Test HTTP montuje `report-builder.routes.ts` bezpośrednio na gołym `express()`, nie przez `Gateway.ts` → `initializeRoutes`. Potwierdzono niezależnie: `report-builder.routes.ts` JEST zamontowany w prawdziwym `Gateway.ts:1173-1176` pod `/api/report-builder` (nie osierocony). Luka dowodowa jest realna, ale wąska — trasa istnieje w produkcyjnym gatewayu, tylko sam test jej nie przeszedł przez pełną inicjalizację. |

## CZWARTA WARSTWA (zadanie własne 6) — wynik: WOŁANY, nie fantom

Hook `isArtifactKnowledgeIndexEnabled()` → `indexReportArtifactForKnowledge(...)`
znajduje się wewnątrz ciała `generateFullReport` (`reportGenerationService.ts:1849-1895`),
bezpośrednio przed `return { totalTokens, generatedSections }`. To nie jest
biblioteka bez wywołania: własny test HTTP audytora (uruchomiony przeze mnie,
nie na logach wykonawcy) przeszedł żądanie przez prawdziwy router
`report-builder.routes.ts` → `ReportGenerationService.generateFullReport` →
hook → `knowledge_docs` z poprawnym `scope`/`owner_id`/`organization_id`.
Wołacz jest realny i osiągalny z HTTP.

## FLAGA (zadanie własne 7) — wynik: PRAWDA, zero nowych flag

`server/src/config/FeatureFlags.ts:53` — `ENABLE_ARTIFACT_KNOWLEDGE_INDEX:
z.boolean().default(false)`, niezmieniona przez dyżur 215
(`git diff fe33ce8036..HEAD -- server/src/config/FeatureFlags.ts` = brak
wyjścia). Dyżur 215 reużywa dokładnie tej samej flagi co dyżur 209, nie mnoży
flag. Grep po repo (`.env*`, `.yml`, `.yaml`) nie znalazł żadnego miejsca,
które ustawia ją na `true` w konfiguracji — pozostaje wyłączona domyślnie
wszędzie poza jawnym env dla testu.

## ZASIĘG embeddingów (zadanie własne 8) — wynik: parytet z dokumentami/deckami

`KnowledgeService.addDocument` (`KnowledgeService.ts:621-657`) zapisuje
`organization_id`, `project_id`, `owner_id`, `scope` wprost z parametrów
wołającego — dla raportu to `input.organizationId`, `input.ownerId`,
`scope = inferKnowledgeScope(input.confidentiality)`. Potwierdzone własnym
przebiegiem testu HTTP: raport `internal` → `knowledge_docs.scope='organization'`;
raport `confidential` → `scope='user'`, `owner_id` ustawiony, zero wierszy w
`ai_knowledge_embeddings` dla tego `document_id` (globalny indeks pominięty
przez `skipGlobalEmbeddingIndex = scope==='user'` w
`artifactKnowledgeIndexer.ts:52-56`). Ten sam mechanizm co dla dokumentów/decków
z dyżuru 209 — nie ma osobnej, słabszej ścieżki dla raportów.

## Luka poufności (zadanie własne 9) — wynik: **PRAWDA, POTWIERDZONA KODEM, GUBIONA DZIŚ**

Zmierzone statycznie w czterech plikach, bez domysłów:

1. `src/components/ReportBuilder/steps/IntentStep.tsx:542-544` — UI trzyma
   `intent.confidentiality` w stanie kroku Intent (select: confidential /
   internal / public).
2. `src/components/ReportBuilder/useReportBuilder.ts:255-272` — `createReport()`
   wysyła do `Api.post('/report-builder', { sourceType, sourceId, title,
   description, config })`. Brak top-level `confidentiality` w payloadzie —
   cokolwiek jest w `intent`, trafia (o ile w ogóle) zagnieżdżone wewnątrz
   `config`, nie jako osobne pole.
3. `server/src/routes/report-builder.routes.ts:1919-1921` — handler `POST /`
   destrukturyzuje `req.body` do `{ sourceType, sourceId, sourceName, title,
   description, templateId, config }` i przekazuje do `createReport(...)`
   WYŁĄCZNIE `config` jako obiekt — nigdy nie wyciąga `confidentiality` (ani
   żadnego innego pola V3: `reportTypeV3`, `goalV3`, `communicationRegister`,
   `density`, `periodFrom`, `periodTo`) jako osobnego parametru.
4. `server/src/services/reportBuilderService.ts:1112-1120` — gałąź zapisu
   wybierana przez `hasV3Configuration = Boolean(params.reportTypeV3 ||
   params.goalV3 || ... || params.confidentiality)`. Ponieważ trasa HTTP nigdy
   nie ustawia `params.confidentiality` (tylko `params.config`), warunek jest
   **zawsze fałszywy** dla raportów tworzonych przez żywy wizard → używana jest
   gałąź `INSERT` BEZ kolumny `confidentiality` w ogóle.
5. Kolumna ma `DEFAULT 'internal'`
   (`server/migrations/20260823_runtime_ddl_schema_convergence.sql:22`) —
   Postgres wstawia tę wartość domyślną automatycznie. Sprawdzono brak
   jakiegokolwiek fallbacku odczytującego `confidentiality` z `config_json`
   gdziekolwiek w `reportBuilderService.ts` / `reportGenerationService.ts` —
   grep nie znalazł takiego mostka.

**Wniosek zmierzony, nie domniemany:** każdy raport utworzony dziś przez
żywy wizard Report Buildera ma `confidentiality='internal'` w bazie
NIEZALEŻNIE od tego, co użytkownik wybrał w `IntentStep` — nawet jeśli
zaznaczył „Confidential". Skoro hook dyżuru 215 poprawnie czyta tę kolumnę
(`SELECT confidentiality FROM report_builder_reports WHERE id = ? AND
organization_id = ?`, `reportGenerationService.ts:1851-1856`) i poprawnie
klasyfikuje `'internal' → scope='organization'`, to mechanizm ochronny
DZIAŁA ZGODNIE Z KOLUMNĄ — ale kolumna dziś kłamie o intencji użytkownika.
Efekt końcowy: raport oznaczony przez użytkownika jako „Confidential" **stanie
się globalnie przeszukiwalny w całej organizacji**, jeśli flaga
`ENABLE_ARTIFACT_KNOWLEDGE_INDEX` zostanie kiedykolwiek włączona bez tej
naprawy. Wykonawca ujawnił to sam i uczciwie („DO DECYZJI WŁAŚCICIELA"), nie
naprawiał (poza licencją dyżuru) — audytor to POTWIERDZA jako realną,
zmierzoną lukę, nie hipotezę.

To NIE jest defekt wprowadzony przez dyżur 215 — pliki `IntentStep.tsx`,
`useReportBuilder.ts`, `report-builder.routes.ts` (handler `POST /`) i
`reportBuilderService.ts` nie są w diffie 215 (`git diff fe33ce8036..HEAD
--stat` pokazuje tylko 4 pliki, żaden z tych czterech). Ale jest to luka,
która wprost unieważnia sens ochrony, którą 215 buduje.

## Sprawdzenie z pułapki 209 (zadanie własne 10) — wynik: OK, `beforeEach`

Oba nowe pliki testowe instalują mock `EmbeddingService.prototype.generateEmbedding`
w `beforeEach` (`reportArtifactKnowledgeIndexer.pg.test.ts:64-67`,
`report-builder-knowledge-index.http.pg.test.ts:87-90`), nie w `beforeAll`.
Globalny `tests/setup.ts` woła `vi.clearAllMocks()` w `beforeEach` — ponieważ
mock jest instalowany PO globalnym `clearAllMocks` w tej samej fazie
`beforeEach` (kolejność rejestracji: setup globalny → lokalny), implementacja
przeżywa do właściwego testu. Potwierdzone empirycznie: wszystkie testy w
obu plikach, uruchomione razem, są zielone, w tym drugi i kolejne testy w
pliku — nie widać wzorca „pierwszy test przechodzi, reszta cicho idzie
prawdziwą ścieżką" z odbioru 209.

## R3 — pozostałe generatory (zweryfikowane)

- `management_reports`: schemat `271_management_reports_extended.sql:14-46`
  potwierdzony — ma `scope` (`PROJECT`/`PORTFOLIO`, poziom agregacji, NIE
  poufność), brak `confidentiality`/`visibility`/`is_private`. Decyzja DEFER
  uzasadniona — dodanie klasyfikacji poufności od zera to nowa powierzchnia,
  słusznie poza licencją jednego dyżuru.
- `aiAssessmentReportGenerator`: `grep -n "INSERT INTO\|dbRun\|queryRun"
  aiAssessmentReportGenerator.ts` → zero trafień, potwierdzone. Trasa
  `assessment-ai.routes.ts:848` robi `res.json(result)` bezpośrednio, bez
  zapisu. Brak trwałego artefaktu z `id` — decyzja NIE DOTYCZY poprawna.

## Sprzątanie audytora

Kontener `cx-day215-audit-pg` (port 6301, poza zakazaną pulą 6151-6157 i
5092-5105) usunięty `docker rm -fv` po zakończeniu. Worktree
`/private/tmp/cx-day215-indeks-raportow` czysty (`git status --short` puste,
`git diff --stat` puste) po przywróceniu mutacji. Brak pushy, brak dotknięcia
demo/staging/produkcji/Railway. Brak `git stash`.

## FIX-y wymagane przed włączeniem flagi na żywo

1. **[BLOKUJĄCY dla flagi, nie dla tego mergu]** Przekazać `confidentiality`
   (i pozostałe pola V3) z UI przez cały łańcuch: `useReportBuilder.ts:255-272`
   (dodać `confidentiality` jako top-level pole payloadu obok `config`) →
   `report-builder.routes.ts:1919-1921` (wyciągnąć `confidentiality` z
   `req.body` i przekazać jako osobny parametr do `createReport`) →
   `reportBuilderService.ts:1112-1120` (już obsługuje `params.confidentiality`,
   wystarczy że dotrze). Bez tego FIX-u flaga `ENABLE_ARTIFACT_KNOWLEDGE_INDEX`
   NIE MOŻE być włączona na żadnym środowisku ze skutkiem produkcyjnym —
   każdy raport „Confidential" stanie się organizacyjnie widoczny po
   indeksacji.
2. **[niski priorytet]** Domknąć dowód `ApiGateway.initializeRoutes` dla
   trasy `report-builder`, analogicznie do FIX-209.3 (`document-studio-knowledge-index.http.pg.test.ts`
   jako wzorzec) — usuwa PARTIAL wobec Z22, nie zmienia wyniku bezpieczeństwa.

## Ocena i werdykt

**Ocena: B** — mechanizm dyżuru 215 działa przez interfejs (HTTP → hook →
`knowledge_docs`/`ai_knowledge_embeddings`) i mutacja w obie strony
(zepsuto → poczerwieniało treściowo; przywrócono → zielono 3×) — to
kwalifikowałoby się do „A", GDYBY nie nazwana, zmierzona granica: ochrona
opiera się na kolumnie, którą produkcyjny wizard dziś nigdy nie ustawia
zgodnie z wyborem użytkownika. Stąd „B — działa z nazwanymi ograniczeniami",
nie „A".

**WERDYKT: SCALIĆ PO FIX.** Kod dyżuru 215 sam w sobie jest bezpieczny do
scalenia (flaga OFF domyślnie, brak nowych migracji, brak dotknięcia
istniejących wołaczy poza jednym hookiem fire-and-forget z `catch` logującym
błąd). FIX-1 (łańcuch `confidentiality` UI→DB) jest jednak TWARDYM warunkiem
przed jakimkolwiek włączeniem flagi — inaczej dyżur 215 daje fałszywe
poczucie bezpieczeństwa: kod chroni scope poprawnie, ale scope jest liczony
z kolumny, która dziś zawsze kłamie w kierunku mniej bezpiecznym (`internal`
zamiast wybranego `confidential`).

**Czy poufność raportu jest dziś gubiona po drodze — jednoznacznie: TAK.**
Zmierzone kodem w 4 miejscach (`IntentStep.tsx:542-544` →
`useReportBuilder.ts:255-272` → `report-builder.routes.ts:1919-1921` →
`reportBuilderService.ts:1112-1120`), nie domniemane. Wybór użytkownika w UI
nigdy nie dociera do kolumny `confidentiality`; kolumna zostaje na
`DEFAULT 'internal'` dla każdego raportu utworzonego przez żywy wizard.

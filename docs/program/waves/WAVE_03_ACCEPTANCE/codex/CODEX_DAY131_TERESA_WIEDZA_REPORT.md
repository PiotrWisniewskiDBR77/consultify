# CODEX DAY 131 — TERESA / WIEDZA ORGANIZACJI

Data: 2026-08-29

Marker: `70d8e8a9c9b290dbad559cd0f4330aa3959f6b3b`

Gałąź: `codex/day131-teresa-wiedza-20260829`
Werdykt: **PARTIAL — kod A.2/A.4/A.5 i kontrakty są dostarczone; brak pełnego dowodu HTTP/LLM i niezależnego baseline promptu A.3.**

## Sanity wejścia

```text
$ git -C /private/tmp/cx-day131-teresa-wiedza rev-parse HEAD
70d8e8a9c9b290dbad559cd0f4330aa3959f6b3b
$ git -C /private/tmp/cx-day131-teresa-wiedza status --short | head -3
<brak wyjścia>
```

Porty `6014`, `4928`, `4929`: `WOLNY`. Przedział `20261720-20261739`: pomiar W6 = `0` istniejących migracji.

## Korekty wobec instrukcji

1. W3 wskazuje `server/src/services/documentGovernance.ts`; plik nie istnieje. Realny odpowiednik to `server/src/services/ai/documentGovernance.ts:18`. To rozbieżność ścieżki, nie STOP. W nim potwierdziłem odczyt z błędnej tabeli `knowledge_documents`; upload zapisuje do `knowledge_docs` (`KnowledgeService.ts:642`).
2. Instrukcja odwołuje się do „tabeli licencji” i `§0.4a`, ale w wydanym pliku nie ma ani tabeli licencji, ani sekcji `0.4a` (nagłówki przechodzą z `0.2d` do `0.5`). Wybrałem bezpiecznie tylko pliki wskazane imiennie w zakresie/A.2–A.5 oraz dwa dedykowane testy i jedną migrację z przydzielonego przedziału.
3. Pierwszy odczyt instrukcji został obcięty przez limit narzędzia. Przeczytałem ponownie cały plik zakresami z tego samego `git show`; nie czytałem checkoutu właściciela.
4. Próba powiązanych testów `server/src/**` z `server/vitest.config.ts` wykonała `0` testów. Nie zaliczam jej jako PASS. Ponowienie przez config root wykonało `14/14`.

## W1–W6 — stan wejściowy

- W1: `ai.routes.ts:4136` (przed zmianą) — legacy `searchRelevantChunks` dostawał `documentIds: attachmentDocIds`; T1 potwierdzona.
- W2: `retrieveContext` ok. `4095`, wynik konsumowany tylko przez `recordContextRetrievalLineage`; T2 potwierdzona.
- W3: realny plik `services/ai/documentGovernance.ts:34` czytał `knowledge_documents`, upload `KnowledgeService.ts:642` pisał `knowledge_docs`; nieznany ID i wyjątek były fail-open; T3 potwierdzona.
- W4: `init-pgvector.sql:20-28` bez kolumny `organization_id`; T4 część 1 potwierdzona.
- W5: `embeddingService.ts:296` dopuszczał `metadata->>'organization_id' IS NULL`; T4 część 2 potwierdzona.
- W6: `0`.

## A.1 — tabela ścieżki wiedzy

| Ogniwo | Werdykt | Dowód |
| --- | --- | --- |
| Wgranie pliku | ISTNIEJE | `knowledge.routes.ts:885`, `:1615` — `upload.single('file')` |
| Ekstrakcja tekstu | ISTNIEJE | `knowledge.routes.ts:980`, `:1678` — `extractDocumentText(...)` |
| Podział na fragmenty | ISTNIEJE | `KnowledgeService.ts:674` — `chunkText(..., chunkSize 1000, overlap 200)` |
| Wektory | NIEDOKOŃCZONE | `KnowledgeService.ts:690`, `embeddingService.ts:88`; kod istnieje, ale zgodnie z Z15 nie wykonałem zewnętrznego embedding API |
| Metadane organizacji | ISTNIEJE | `KnowledgeService.ts:714`, `embeddingService.ts:174-186`; po zmianie również kolumna pierwszej klasy z migracji `20261720...sql` |
| Pytanie → wektor | NIEDOKOŃCZONE | `embeddingService.ts:198`; kod istnieje, brak wywołania sieciowego przez Z15 |
| Wyszukanie korpusu organizacji | NIEDOKOŃCZONE | `ContextRetrievalService.ts:215,343`; po zmianie `ai.routes.ts:4091` uruchamia `org_context_research_mode` za flagą OFF; brak pełnego HTTP/LLM |
| Filtr uprawnień | ISTNIEJE | `ContextRetrievalService.ts:122-158` filtruje `knowledge_docs` po organizacji/scope/owner; A.4 fail-closed w `documentGovernance.ts:18-113`; real-PG 3/3 |
| Wstrzyknięcie do promptu | NIEDOKOŃCZONE | `ai.routes.ts:4135,4231` dodaje blok `ORGANIZATION KNOWLEDGE` tylko przy fladze; kontrakt źródłowy zielony, brak realnego HTTP/LLM |
| Cytowanie źródła | NIEDOKOŃCZONE | `ai.routes.ts:4147,4243` niesie filename i prawdziwy `fragmentIndex`; brak pełnego odczytu odpowiedzi modelu przez Z15 |

## A.2 i A.3 — podpięcie oraz OFF

- `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` jest aktywne wyłącznie dla literalnego `=== 'true'`; brak zmiennej = OFF.
- Bez załączników używany jest `org_context_research_mode`, czyli cały zatwierdzony korpus organizacji.
- Z załącznikami używany jest `selected_material_plus_approved_org_context`.
- Trafienia są wstrzykiwane jako `[K1] nazwa (fragment N)` i emitowane jako cytowania.
- Brak trafień wstrzykuje jawne: `No matching organization knowledge was found for this question.`
- A.3: kontrakt statyczny potwierdza, że cały nowy blok leży za flagą. **Nie wykonano niezależnego byte-for-byte baseline promptu sprzed zmiany**, więc A.3 pozostaje `PARTIAL`, nie `VERIFIED`.

Mutacja A.2:

```text
zmiana: orgKnowledgeRetrievalEnabled = false
wynik: 4 total, 3 passed, 1 failed
RED: Day 131 Teresa organization knowledge boundaries keeps organization retrieval default-off and injects hits or an explicit no-hit result
przywrócenie przez cp; diff kopia↔plik: pusty
GREEN końcowy: 4/4
```

## A.4 — właściwa tabela i fail-closed

- odczyt i aktualizacje używają `knowledge_docs`;
- nieznany identyfikator trafia do `blocked`;
- błąd zapytania zwraca wszystkie żądane ID jako `blocked`;
- migracja dodaje `ai_visibility NOT NULL DEFAULT 'allowed'` i `sensitivity NOT NULL DEFAULT 'internal'`.

Mutacja A.4:

```text
zmiana: unknown i wyjątek ponownie fail-open
wynik: 4 total, 2 passed, 2 failed
RED: ...reads the upload table and denies an unknown id
RED: ...denies every requested id when its query fails
przywrócenie przez cp; diff kopia↔plik: pusty
GREEN końcowy: unit 4/4; real-PG governance 1/1
```

## A.5 — izolacja organizacji

- migracja addytywna dodaje `ai_knowledge_embeddings.organization_id`, backfilluje z JSON i tworzy `idx_ai_embeddings_org_source`;
- zapis embeddingu utrwala kolumnę i zachowuje JSON dla kompatybilności;
- wyszukiwanie dopuszcza właściciela lub jawne globalne typy `tool_pack`, `methodology`, `product_pill`; sam NULL nie daje dostępu.

Pomiar świeżej efemerycznej bazy:

```text
przed migracją: metadata organization_id NULL/blank = 0
po migracji: organization_id NULL i nie-globalny source_type = 0
```

To **nie jest pomiar danych demo/produkcji** (Z28/Z9); nie wiadomo, ile legacy rows pozostanie na realnym środowisku. Migracja niczego nie kasuje.

Mutacja A.5:

```text
zmiana: przywrócony filtr metadata NULL => global
wynik real-PG: 3 total, 2 passed, 1 failed
RED: ...returns own and explicitly global chunks but not foreign or unowned legacy chunks
przywrócenie przez cp; diff kopia↔plik: pusty
GREEN końcowy real-PG: 3/3
```

## Migracje i testy

```text
pełny pierwszy przebieg: Applying migrations: 863; complete
pełny drugi przebieg: Applying migrations: 0; complete
po dodaniu migracji: Applying migrations: 1; 20261720_day131_teresa_knowledge_boundaries.sql
ponowienie: Applying migrations: 0; complete
unit końcowy: 4/4 PASS
real-PG końcowy: 3/3 PASS
powiązane testy root: 49/49 PASS
powiązane server/src przez config root: 14/14 PASS
```

Pułapki §0.2d:

- (a), (b), (d): pełny env zawierał `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `ENABLE_TEST_AUTH_BYPASS=false`; nowe testy nie mierzą tych bramek.
- (c): pierwsze dwa real-PG uruchomienia wykazały `DB_TYPE=sqlite` i 0 wykonanych przypadków; nie zostały zaliczone. Dedykowany plik ustawia `postgres` przed importem kodu serwera wyłącznie przy jawnym `DATABASE_URL`, a pierwsza asercja sprawdza wartość.
- (e): dokładnie przedmiot A.4; test na realnym PG wstawia wiersze do `knowledge_docs`, a produkcyjny strażnik je odczytuje.
- Wszystkie komendy dowodowe miały `--retry=0`.

Artefakty kluczowe i SHA-256:

- `day131-unit-final-green.json`: `46d64f1d1368ec71e54167a3740531ecca0e42b070ac2212ca74e317e20e2b1a`
- `day131-realpg-final-green.json`: `fbf4a41e3548b00584c8435ce9c4dcb6c7e3b94dfc3000374b13841a8a7cd38f`
- `day131-a2-mutation-red.json`: `18b9e14b0c7b4538b623d76635f14328a59be1a94c6c4b10ec90cb122960260f`
- `day131-a4-mutation-red.json`: `74e18aa9ed649bf62086aed731ffb5ad3c009c6f3ae0dc83c5b6c712c09938a4`
- `day131-a5-mutation-red.json`: `459170d22a4d832f2480c69794bae93092bae7408cc97a9c2ce4c697e30160be`
- `day131-related-root.json`: `b0f6573a69b7d0c2d9e1a9217c175c28929e01580313efa07663eb31ac059398`
- `day131-related-server-root-config.json`: `2671f34363efdccc61a22b92fd9acd841475cb52573653b32deb574f20703670`

## Z30

Przed zapisami: `BRAK ZMIENNYCH POCZTY`; `Gateway.ts`: `BRAK DRENAZY W GATEWAY`; po migracjach zapytanie `settings WHERE key LIKE 'smtp%'`: `0 rows`.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Nienaprawione

1. Nie wykonano prawdziwego żądania HTTP `/api/ai/chat/stream` z modelem: Z15 zabrania modelu i `/api/ai/**` jako pomiaru. Z tego powodu A.2 nie ma pełnego dowodu Z34.
2. A.3 nie ma niezależnego promptu baseline sprzed zmiany byte-for-byte; jest tylko kontrakt, że nowy kod nie biegnie przy OFF.
3. Nie zmierzono legacy/null rows na demo, stagingu ani produkcji — Z28/Z9. Wynik `0→0` dotyczy świeżej bazy dyżuru.
4. Nie uruchomiono całego repo testów. Zmierzono 66 wykonanych, nazwanych przypadków związanych z zakresem (4 + 3 + 49 + 14), bez traktowania podzbioru jako pełnej regresji.
5. Nie zaktualizowano `MODULE_ACCEPTANCE.md`, bo status całości pozostaje PARTIAL.

## Commit, push i sprzątanie

Pierwszy commit: `cf0e0daa6b924e71a4bab91ece26eeadfde602fc`. Po Z34a został natychmiast wypchnięty na `github-backup/codex/day131-teresa-wiedza-20260829`; `git ls-remote` zwrócił ten sam SHA.

Lista plików z `git diff --name-only 70d8e8a9c9b290dbad559cd0f4330aa3959f6b3b..HEAD`:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY131_TERESA_WIEDZA_REPORT.md
server/migrations/20261720_day131_teresa_knowledge_boundaries.sql
server/src/routes/ai.routes.ts
server/src/services/ai/documentGovernance.ts
server/src/services/ai/embeddingService.ts
tests/integration/ai/day131-teresa-knowledge-boundaries.realpg.test.ts
tests/unit/backend/ai/day131TeresaKnowledgeBoundaries.test.ts
```

Sprzątanie: `docker rm -fv cx-day131-pg` zwróciło `cx-day131-pg`; ponowny odczyt `docker ps -a` potwierdził `KONTENER USUNIETY`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Niezweryfikowane: realny model otrzymuje blok organizacji i cytuje `[K#]` w odpowiedzi końcowej.
- Niezweryfikowane: prompt przy fladze OFF jest bajt w bajt identyczny z niezależnie zapisanym baseline sprzed zmiany.
- Niezweryfikowane: liczba i klasyfikacja nieprzypisanych embeddingów w środowisku docelowym.
- Niezweryfikowane: pełna ścieżka HTTP przez `ApiGateway → verifyToken → handler → prompt → model`, ponieważ byłaby sprzeczna z Z15 w tym dyżurze.

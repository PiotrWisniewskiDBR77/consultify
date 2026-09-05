# CODEX DAY 370 — akcje wiadomości

Stan: **PARTIAL / K4 i K8 naprawione na gałęzi dowodowej; brak wdrożenia i akceptacji właściciela.** Gałąź: `codex/day370-akcje-wiadomosci-20260905`, marker `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`.

## Wejście

Instrukcję vault odczytałem do EOF: 1130 linii, stan `WYDANY`. `df -h /`: 48 GiB wolne po materializacji. Marker:

```text
MARKER OK
9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c
```

Worktree był czysty. Porty 6441/5581 były wolne, kontenerów `cx-day370` było 0. Tip `github-backup/grafika/m03-20260902` był przed markerem; zgodnie z instrukcją pracowałem dokładnie z markera, bez rebase.

## R0 — pięć twardych zasad

Przeczytałem i stosowałem zasadę asercji zachowania, nie tekstu źródła. Nie utworzyłem tabeli ani własnego INSERT-u inicjatywy; gałąź K4 woła kanoniczny `createInitiative`. K8 dowodzi kolejności `createIdeaFromChat` przed `setMyWorkIntent` i nawigacją. Prawdziwe `idea-*` kieruje workspace do odczytu istniejącego rekordu, nie do ścieżki `new-idea-*`. Gałąź decyzji zachowała ten sam INSERT, kod 200 i kształt odpowiedzi `{success, decisionId}`.

## RealPG i Z30

Kontener `cx-day370-pg`, obraz `pgvector/pgvector:pg16`, `127.0.0.1:6441/cx370`. Migracje: pierwszy przebieg `Applying migrations: 896`, drugi `Applying migrations: 0`; oba zakończone `Postgres migrations complete`.

Przed testami zapisującymi: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; grep drenów w `server/src/Gateway.ts` zwrócił 0 trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## R1 — K4

PRZED: test przez realny `ApiGateway`, podpisany JWT i PostgreSQL potwierdził `decision` → `{decisions:+1, initiatives:+0}` oraz `initiative` → również `{decisions:+1, initiatives:+0}`. Czerwony komunikat: oczekiwano `{decisions:1, initiatives:1}`, otrzymano `{decisions:2, initiatives:0}`.

PO: `type=decision` dodaje wyłącznie `ai_decision_outcomes`; `type=initiative` dodaje wyłącznie `initiatives`, zwraca `initiativeId`, zapisuje `organization_id`, `source_type=ai_chat_deep_thinking`, `source_id=conversationId`. GET `/api/initiatives` jako drugi org nie ujawnił rekordu. CTA decyzji wywołuje handler bez trzeciego argumentu, CTA inicjatywy z `'initiative'`.

Mutacja: usunięcie rozgałęzienia serwera dało RED (`r1-mutacja-red.json`, exit 1); odtworzenie przez `cp` dało 3/3 GREEN (`r1-mutacja-green.json`, exit 0). Finalny pakiet RealPG ma 4/4 GREEN, w tym K8.

## R2 — K8

PRZED/mutacja: przy `navigateToMyWork:true` mock `createIdeaFromChat` miał 0 wywołań, mimo wykonania nawigacji (`r2-przed-red.json`, exit 1). PO: API jest wywołane przed `setMyWorkIntent`; intencja dostaje `idea-1700000000000-a1b2c3`, który nie zaczyna się od `new-idea-` (`r2-po-green.json`, exit 0).

RealPG: POST `/api/my-work/my-ideas/from-chat` dodał dokładnie jeden wiersz dla `sourceConversationId/sourceMessageId`, zwrócił realne `idea-*`; ponowny GET tego `ideaId` pozostawił licznik bez zmian. Guard `IdeaMapWorkspace.tsx:353` klasyfikuje ten identyfikator jako istniejący i wybiera `Api.getMyIdea`, nie `Api.createMyIdea`. Nie zmieniałem guardu ani trasy serwera. Toast „Opened in Ideas workspace” jest po naprawie uczciwszy, bo rekord istnieje przed jego wyświetleniem; nie wymaga technicznie nowego klucza, decyzja copy pozostaje właścicielowi.

## Testy i pułapki §0.2e

- `day370.deep-thinking-save-record.pg.test.ts`: 4 pełne nazwy GREEN; jawne `DB_TYPE=postgres`, `MOCK_DB=false`, `RUN_DB_TESTS=1`, auth bypass false, V8 true, visibility enforce, własny URL DB i `--retry=0`. Log `DB_IDENTITY` potwierdził `127.0.0.1:6441/cx370`. To wyłącza pułapki atrapy DB, złego portu, bypassu auth i retry.
- `MessageRenderer.context-save.test.tsx`: 2/2 GREEN, czysty unit z `RUN_DB_TESTS=0 MOCK_DB=true`; nie twierdzi nic o DB ani HTTP, tylko o argumentach dwóch CTA.
- `UnifiedChatPanel.test.tsx`: nowy przypadek K8 GREEN i mutacyjny RED→GREEN. Pełny plik ma 4 zastane czerwone przypadki Canvas/fallback niezwiązane z K4/K8; nie osłabiłem ich. Pakiet jednostkowy dowodzi kolejności mocków, nie egzekucji serwerowej.

Pełne nazwy nowych przypadków: `keeps decision writes exclusively...`; `writes initiative requests exclusively...`; `does not expose...another organization...`; `creates exactly one chat idea...`; `routes Deep Thinking decision and initiative CTAs...`; `Day 370 saves an idea before navigation...`. Żaden przypadek nie zniknął wskutek zmiany; pełny pomiar PRZED całej istniejącej suity nie został wykonany — patrz twierdzenia niezweryfikowane.

Artefakty JSON są w `/private/tmp/cx-day370-akcje-wiadomosci-artefakty/`; kluczowe SHA-256: `r1-przed.json` `a58be204...`; `r1-mutacja-red.json` `3f82fda7...`; `r1-mutacja-green.json` `e36fc31f...`; `r1-r2-realpg-green.json` `555531e8...`; `r2-przed-red.json` `56b0362d...`; `r2-po-green.json` `071de81a...`; `message-renderer-green.json` `91a77e20...`.

## R3

Pełna tabela i relacja bezpośrednich handlerów do `ai_actions` znajduje się w `evidence/akcje-wiadomosci-20260905/R3_INWENTARZ.md`. Mianownik: 14 typów `ChatActionType`, 0 tworzących wprost wskazane rekordy; `ASSIGN_INTERVIEW` jest synchronicznym wzorcem. Zmierzono 20 plików produkcyjnych z `INSERT INTO initiatives`; nowa gałąź nie jest 21. bezpośrednim writerem, tylko nowym konsumentem lejka.

## Korekty wobec instrukcji

- Liczba kluczy na markerze: `pl 35200`, `en 33067`, nie `35204/33071`.
- `reach=1` zgłasza jeden zastany plik `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`, nie trzy pliki.
- Realna ścieżka K4 to `server/src/routes/ai/deep-thinking.routes.ts`, zgodnie z korektą w instrukcji, nie ścieżka brifu bez `/ai/`.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

K1, K2, K3, K5, K6, K7, K9 oraz trzy rodziny P2 są wyszczególnione z `plik:linia` w tabeli R3 i nie były naprawiane. Osobnego porządkowania wymaga 20 writerów: `ToolController`, `InitiativeController`, `assessment-workflow-v2.routes`, `report-builder.routes`, `economics.routes`, `my-work.routes`, `onboardingService`, `demoSeedService`, `cqrs/initiative/CreateInitiative`, `ArtifactConversionService`, `aiActionExecutor`, `reportImportService`, `healthProbeService`, `ToolInitiativeService`, `reportInitiativeService`, `assessmentInitiativeService`, `legacyCutover/registry/economics`, `notebookConversionService`, `InitiativeDefinitionService`, `createInitiativeService`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Brak wdrożenia, produkcyjnego HTTP, urządzenia/przeglądarki i akceptacji właściciela.
- Nie wykonano pełnego pomiaru nazw wszystkich istniejących testów PRZED zmianą; porównanie §0.4a dla całej suity pozostaje `EVIDENCE_MISSING`.
- Nie zamontowano pełnego `IdeaMapWorkspace` w nowym izolowanym teście z licznikiem `Api.createMyIdea=0`; wniosek opiera się na realnym kształcie ID, istniejącym guardzie i RealPG GET bez duplikatu. Ten szczegół progu pozostaje `PARTIAL`.
- Nie potwierdzono, że dwutorowość `handleSaveAs*` kontra `ai_actions` jest zamierzona.

## PYTANIA DO WŁAŚCICIELA

1. Czy `sourceType='ai_chat_deep_thinking'` + `sourceId=conversationId` to właściwy ślad audytu, czy wolisz `messageId` albo inny identyfikator? **tak / nie / inny**.
2. Czy po zmianie kolejności K8 toast powinien dostać nowe brzmienie, mimo że obecne „Opened in Ideas workspace” jest już prawdziwe? **tak / nie**.

## Commity

```text
f6185ef6d6 — 4 files, 193 insertions, 2 deletions
cd6f3ff960 — 2 files, 41 insertions, 11 deletions
afe4821f6f — 1 file, 31 insertions
```

Każdy checkpoint został wypchnięty na `github-backup/codex/day370-akcje-wiadomosci-20260905`.

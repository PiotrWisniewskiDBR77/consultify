# CODEX DAY217 — GF-AGT-02

Stan: **PARTIAL / moduł 17 NIEZAMKNIĘTY**. R0–R4 i trzy powtórzenia działają; R5 zatrzymała realna bramka dostępu przed modelem.

## Baza i sanity

Marker:

```text
MARKER OK
89630f9a8a83cb0cde6ad4521196ccdac28737ee
```

R0: `git merge --ff-only github-backup/codex/m03-admin-20260824` wykonał czysty fast-forward `89630f9a8a..5c959d9f13`, bez konfliktu i bez commita merge. W1: 205/206/209/210 scalone; W2: marker jest przodkiem tipa, 207 jest na bazie. Dysk przed startem: 6,8 GiB wolne. Porty 6157/5104/5105: 3/3 wolne. Kontener: `cx-day217-pg`, wyłącznie `127.0.0.1:6157/cx217`. Migracje: pierwszy pełny przebieg zakończony, replay: `Applying migrations: 0`.

Korekta wobec instrukcji: W15 zwrócił `0`, nie oczekiwane `6`, dla `git log --oneline 89630f9a8a..github-backup/codex/day207-write-proposal-20260831 | wc -l`. Martwej gałęzi nie scalono. Przed pierwszym commitem `git log --all --not <baza>` pokazał starsze, niescalone tory dotykające plików AI, ale żadnego konkurencyjnego Day217; pliki mechanizmu pozostawiono read-only.

## Z30

`BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera startu drenaży. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Wynik R1–R4 i R6

`tests/integration/day217-gf-agt-02.realdb.test.ts`, realny ApiGateway, podpisany JWT, realny PostgreSQL, `--retry=0`: **4/4 PASS**. Trzy iteracje użyły świeżych markerów i actionId. Każda wykonała `/api/ai/chat/stream`, READ `search_knowledge_base`, SSE `execution_proposal`, approve, execute, SQL readback zadania, GET My Work, POST Document Studio, SQL readback artefaktu, `knowledge_docs` i `ai_knowledge_embeddings`.

Pełny prompt każdego przebiegu zawierał `DAY217-ORG-CONTEXT-89630f9a8a`, zapisany przez `recordOrganizationContextStoreSave`. Artefakt: `/private/tmp/cx-day217-gf-agt-02-artefakty/day217-chain.json`, SHA-256 `497472eae9400fc9bcfffa72d292feb15527c70bc9fbc240b3bbca11b78558d4`.

Mutacja R2: po zmianie bramki na `if (false && action.status !== APPROVED)` wynik **3 PASS / 1 RED**, czerwony dokładnie kontrakt PENDING (`expected true to be false`); po przywróceniu 4/4 PASS i diff pliku produkcyjnego pusty. Artefakt RED: `day217-r2-mutation-red.json`, SHA-256 `232fbb4d234a7db48735591bfde696fab9555c2d186b649adbc500037cce37a0`.

Mutacja R4: `inferKnowledgeScope => 'organization'` dała **2 PASS / 4 RED**, w tym realny przeciek prywatnej treści (`expected true to be false`); po przywróceniu 6/6 PASS i diff pliku produkcyjnego pusty. Artefakt RED: `day217-r4-mutation-red.json`, SHA-256 `2b75549d5e8ead1cac36438218ecdadbeac460b9580db007f51d94a448297e07`.

Pułapki Z33: `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false`, `DB_TYPE=postgres` i jawny `DATABASE_URL` były w tej samej linii. Mock embeddingu instalowano w lokalnym `beforeEach`, po globalnym `clearAllMocks`. Test nie montował gołego routera: użył `ApiGateway.getInstance().initializeRoutes(app)`.

## R5 — realny model

Plik klucza był obecny; użyto wyłącznie `set -a; . ~/.consultify-openrouter; set +a`; wartości nie zapisano ani nie wypisano. Dostawca: OpenRouter, środowisko TAK; model nie został faktycznie uruchomiony. Dwie dozwolone tury HTTP (READ ON/OFF) zakończyły się `TRIAL_PROFILE_INCOMPLETE`, `degraded.reason=access_policy`, bez `LLM call success`, bez tool-step i bez odpowiedzi. Zgodnie z zakazem ponawiania nie wykonano trzeciej tury i nie obchodzono bramki. Zmierzony budżet: 2 przebiegi HTTP, **0 rund modelu**. Artefakt: `day217-real-model.json`, SHA-256 `3e6252f719d544c3444f9c9184f6b04d0e3d1603d456c865f6567b5f2290d86`.

### STOP — R5
Rodzaj: MERYTORYCZNY
Powód: realna bramka profilu zatrzymała obie tury przed modelem.
Licencja, którą sprawdziłem: zapis wyłącznie `server/scripts/day217-real-model-probe.ts`; bramek platformowych nie wolno zmieniać.
Dowód: `day217-real-model.json`, kod `TRIAL_PROFILE_INCOMPLETE` dla ON i OFF.
Co dostarczyłem ZAMIAST zmiany: odtwarzalny skrypt tsx i pełny transkrypt SSE.
Co zrobiłbym, gdyby zapadła decyzja X: po poprawnym, nieobchodzonym ukończeniu profilu wykonać nowy, osobno autoryzowany budżet dwóch tur.
Rekomendacja dla nadzorcy: ustalić prawidłowy fixture profilu/trial dla lokalnego GF-AGT-02; nie osłabiać access policy.
Stan: zacommitowano częściowo w commicie dyżuru.
Czy kontynuowałem pozostałe pozycje: TAK — R1–R4, mutacje, nazwy i dokumentacja są niezależne.

## Zasięg nazw testów

Przed: 7 nazw. Po: 17 nazw. Dodano 6 nazw istniejącego pakietu Day209 do jawnej bramki po zmianach oraz 4 nowe nazwy Day217; nie zniknęła żadna nazwa. Diff: `/private/tmp/cx-day217-gf-agt-02-artefakty/nazwy.diff`.

## Werdykt sześciu ogniw

Ogniwo 1 (READ w rozmowie): działa — trzy realne żądania HTTP przez ApiGateway/JWT uruchomiły `search_knowledge_base` i zwróciły kroki narzędzia.
Ogniwo 2 (kontekst organizacji w promptcie): działa — marker `DAY217-ORG-CONTEXT-89630f9a8a`, zapisany przez `OrganizationContextService`, wystąpił w pełnym wyrenderowanym promptcie każdego przebiegu.
Ogniwo 3 (propozycja zapisu → zgoda → wykonanie → realne zadanie w My Work): działa — trzy actionId dały po jednym zadaniu z `source_type='ai_chat_proposal'`, `source_id=actionId`, widocznym przez GET My Work.
Ogniwo 4 (dokument realną drogą): działa — trzy POST `/api/document-studio/generate` zapisały trzy artefakty ze świeżymi markerami.
Ogniwo 5 (indeksacja z zasięgiem): działa — trzy dokumenty trafiły do `knowledge_docs` i `ai_knowledge_embeddings` ze scope `organization`; mutacja scope dała 4/6 czerwonych testów.
Ogniwo 6 (druga rozmowa cytuje znalezisko z pierwszej): nie działa — obie dozwolone tury R5 zostały zatrzymane przez `TRIAL_PROFILE_INCOMPLETE` przed modelem, więc brak tool-call, cytatu i dowodu R3 Day206.

## Pliki

`server/scripts/day217-real-model-probe.ts`, `tests/integration/day217-gf-agt-02.realdb.test.ts`, ten raport, dopisek §12 i odsyłacz §6 w architekturze oraz dopisek statusu punktów 3–4. Żaden plik mechanizmu 205/206/207/209/210 nie został pozostawiony zmieniony.

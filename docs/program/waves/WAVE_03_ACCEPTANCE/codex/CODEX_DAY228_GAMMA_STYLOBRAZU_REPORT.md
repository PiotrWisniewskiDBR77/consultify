# CODEX DAY 228 — GAMMA STYLOBRAZU — RAPORT

Data: 2026-09-01  
Gałąź: `codex/day228-gamma-stylobrazu-20260901`  
Marker: `9fb7942a01`  
Commit produktu: `4f5094a059`

## Werdykt

`R1+R2+R3+R4 BACKEND VERIFIED`, UI pole zaimplementowane, lecz dowód zrzutowy pozostaje
`EVIDENCE_MISSING`. Nie wołałem realnego modelu obrazowego ani wizyjnego.

Jedna flaga `ENABLE_PRESENTATION_IMAGE_STYLE`, domyślnie `false`, steruje doklejaniem stylu
i obiema bramkami. Przy OFF prompt pozostaje bajt w bajt bez zmian, a OCR i detektor twarzy
nie są uruchamiane.

## Baza i marker — wynik dosłowny

```text
MARKER OK
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`git status --short | head -3` po utworzeniu worktree: wynik pusty.

Tip `github-backup/codex/m03-admin-20260824` był nowszy o sześć commitów instrukcyjnych
(`69143cb3d3..c557c502c2`). Zgodnie z regułą rozjazdu praca wystartowała dokładnie z markera;
nie wykonywałem rebase.

Porty `6172`, `5132`, `5133` były wolne. Dysk: 16 GiB wolne. Kontener:
`cx-day228-pg`, baza `cx228`, obraz `pgvector/pgvector:pg16`.

## Zakres zmiany

- pole `imageStylePrompt` zapisuje się do `layout_policy_json` bez nowej migracji;
- runtime szablonu czyta pole z już sparsowanego policy;
- generator buduje appendix w kolejności: motyw pierwszy, preset drugi;
- reużyto sześć istniejących presetów; cztery mają fragment promptu, a
  `data_focused` i `minimal_no_images` celowo nie mają fragmentu obrazu;
- jeden punkt `generateImageVisual` przekazuje finalny prompt do OpenAI, Gemini i Replicate;
- OCR używa lokalnego `tesseract.js`, próg to `>2` znaki po `trim()`;
- twarze są domyślnie odrzucane dla każdego stylu; detektor jest wstrzykiwalny;
- maksymalnie trzy generacje, potem istniejący stock fallback, a po jego braku jawny warning;
- UI edytora motywu ma pole tekstowe „Styl obrazu”.

Decyzja architektoniczna R3: reużyłem sześć istniejących presetów zamiast tworzyć taksonomię
pięciu nazw Gammy; stały styl marki poprzedza incydentalny preset generacji.

Martwego `deckImageResolverService.ts` i `iconSuggestionService.ts` nie usunąłem: zero
importerów potwierdzono ponownie, ale usunięcie było opcjonalne i poza rdzeniem.

## Korekty wobec instrukcji

1. `tesseract.js` był wpisany w `server/package.json` i lockfile, ale nie był obecny w
   udostępnionym `node_modules`. Do pomiaru zainstalowałem dokładnie `7.0.0` poza repo w
   `/private/tmp/cx-day228-gamma-stylobrazu-scratch/ocr-runtime`; repo i lockfile pozostały
   bez zmian. Realny OCR następnie przeszedł.
2. RealPG ujawnił, że `getTemplateForOrgOrSystem` zwraca `layout_policy_json` jako obiekt.
   Dotychczasowe `JSON.parse(existing.layout_policy_json)` wpadało w `catch` i cicho kasowało
   sąsiedni `colorTemplateId`. Handler obsługuje teraz string i obiekt. Test najpierw był
   czerwony (utrata `ocean`), potem zielony z niezależnym SQL readback.
3. Pełny rootowy `tsc` nie zwrócił diagnozy typów: proces V8 zakończył się OOM, exit 134.
   Serwerowy `tsc -p server/tsconfig.json --noEmit` przeszedł (pusty log, exit 0).
4. Nie uruchomiłem kanonicznego runtime do zrzutów. Skrypt w trybie `create` sam wykonuje
   migracje i natychmiast startuje `server/src/index.ts`, nie dając punktu na wymagany przez
   §0.2b(4) SQL `smtp%` bezpośrednio po migracjach i przed startem. Wybrałem bezpieczniejszą
   interpretację: brak zrzutów zamiast osłabienia protokołu Z30.

## Koordynacja z dyżurem 226

Na markerze i przy pierwszej edycji handler nie zawierał `customTemplate`. Przed commitem,
po świeżym fetchu, pojawiła się ukończona zdalna gałąź
`github-backup/codex/day226-gamma-edytor-20260901`; nie była jednak scalona do wiążącej
gałęzi bazowej. Nie kopiowałem ani nie odtwarzałem jej pracy. Mój warunek pozostaje
`colorTemplateId !== undefined || imageStylePrompt !== undefined`; nadzorca przy scalaniu
powinien zachować człon 226 i uzyskać trzyczęściowy warunek.

## Dowody

### Migracje

- przebieg 1: pełny łańcuch zakończony `Postgres migrations complete`;
- replay: `Applying migrations: 0`, exit 0.

### Poczta

`BRAK ZMIENNYCH POCZTY`; tabela `settings` zwróciła 0 wierszy `smtp%`; grep drenaży w
`server/src/Gateway.ts` był pusty.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden
e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

### Testy rdzenia

- unit: 12/12 PASS, `--retry=0`; trzy gałęzie dostawców, OFF, cztery presety, kolejność,
  twarz, dokładnie trzy próby, fallback, realny OCR tekst/blank;
- RealPG: 1/1 PASS, `--retry=0`; realny `ApiGateway.initializeRoutes`, podpisany JWT,
  `verifyToken`, tenant fixture, PUT HTTP 200, niezależny SQL i GET/runtime readback;
- serwerowy typecheck: exit 0.

Pułapki Z33: unit nie przechodzi przez auth/DB; ma jawne `RUN_DB_TESTS=0 MOCK_DB=true` i
wstrzyknięte zależności, więc dowodzi wyłącznie dyspozycji promptu i decyzji bramek. RealPG
ma w tej samej komendzie `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=... JWT_SECRET=...` oraz
asercję `DB_TYPE=postgres`; log potwierdza `DB_IDENTITY ... 127.0.0.1:6172/cx228`.

### Dowód mutacyjny RED → GREEN

Mutacja produkcyjna usunęła appendix z finalnego promptu. Wynik: 3 FAIL / 9 PASS, exit 1;
każda gałąź dostawcy otrzymała `BASE PROMPT` zamiast oczekiwanego stringu. Po odtworzeniu
pliku SHA obu kopii był identyczny:
`53a660db2281a125d70f43c5f4326470a9d388294a9b55d4e5795d6eae00f17e`.
Powtórka: 12/12 PASS, exit 0. Mutację cofnięto przez `cp`, bez stash.

### Zasięg nazw §0.4a

Przed: 1422 unikalne pełne nazwy. Po: 1434. Dodano dokładnie 12 nazw Day 228; znikniętych
nazw: zero. Korpus był i pozostał zastanie czerwony: przed 1010/1430 PASS, po 1022/1442
PASS, po obu stronach 218 FAIL. Liczby nie są przedstawiane jako zieleń całego korpusu.

RealPG test ma dodatkową pełną nazwę, ale nie wszedł do porównania czysto jednostkowego,
ponieważ wymaga innego, jawnego kompletu env; jego wynik jest raportowany osobno.

### Artefakty i SHA-256

- `migrate-1.log` — `1ef1396fd3bdd58419cb98be7657a171ecd6d45cd84f8fbe028e836ea3edabb8`
- `migrate-2.log` — `2fa1dd3fcf82790395c2d5cb8ffaa201031abf49bcf24a25d8244b79e206788d`
- `mutation-red.log` — `2c151a16ba21becc9b1bba19822ba4b98c9d0d98a6d2598334d76e4011f4bee0`
- `mutation-green.log` — `cf5ccbe49849b053ceb7e729682e021fe72e62a3d275fee9e8d87a54a69af071`
- `realpg.log` — `d63be1f78ab4a0b8535b171a9aee312f415d9ad6581f6646aae695823c975253`
- `nazwy.diff` — `46e3930a601e19b8d9911171496c29829eee0f08e8d25a04d80725c81e266dc0`
- `przed-nazwy.txt` — `f3edf254900a67c3faadcd3cfcf95c937f4b1940679b4792571e6311d9c538f5`
- `po-nazwy.txt` — `7e115afb7bbfbd8dc183701f43a70285da36bc035e1e0ff916fd6d77e5f08fd9`

Wszystkie leżą w `/private/tmp/cx-day228-gamma-stylobrazu-artefakty`.

## Zrzuty UI

`EVIDENCE_MISSING`: nie wykonano zrzutów dwóch motywów ani pomiaru `mean_luma`; nie twierdzę,
że UI zostało zweryfikowane wizualnie. Kod pola istnieje i przeszedł hooki repo, ale pełny
rootowy typecheck zakończył się OOM. To nie jest dowód realnego przebiegu ani props harnessu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Importerzy `deckImageResolverService.ts` i `iconSuggestionService.ts`: ZWERYFIKOWANE zero
  na bazie markera; pliki pozostawiono.
- Przewód template/theme do wywołań około 2041/2058: ZWERYFIKOWANY pomiarem; żywy caller
  przekazuje `templateRuntime.imageStylePrompt` oraz `setup.imageStylePreset` jako jeden
  `styleAppendix` do obu generacji.
- Koordynacja 226: ZWERYFIKOWANA; gałąź 226 została wypchnięta przed moim commitem, ale nie
  była scalona do bazy. Nie integrowałem cudzej gałęzi; wymagane jest trójczłonowe scalenie
  przez nadzorcę.
- Realny model obrazowy/wizyjny: NIE WOŁAŁEM, zero wywołań, brak osobnej zgody.
- OCR: ZWERYFIKOWANY realnym `tesseract.js` 7.0.0 na deterministycznym PNG z tekstem i
  jednolitym PNG; nie użyto atrapy OCR.
- Detektor twarzy: ZWERYFIKOWANO wstrzykiwalność i logikę atrapą; testy nie wołały modelu.
  Domyślnego realnego klienta OpenAI/Gemini nie uruchomiono.
- Zrzuty: NIEZWERYFIKOWANE, nie pochodzą ani z realnego runtime, ani z props harnessu.
- Zachowanie produkcyjne z prawdziwym dostawcą obrazu: NIEZWERYFIKOWANE bez zgody właściciela.

## Lista plików produktu

```text
server/src/config/FeatureFlags.ts
server/src/routes/__tests__/day228.imageStylePrompt.pg.test.ts
server/src/routes/presentations.routes.ts
server/src/services/ai/__tests__/day228.imageStyleSafety.test.ts
server/src/services/ai/deckImageSafetyGates.ts
server/src/services/ai/deckVisualsService.ts
server/src/services/presentationGeneratorService.ts
server/src/services/presentationTemplateRuntimeService.ts
src/components/Presentations/PresentationTemplateArchitectView.tsx
```

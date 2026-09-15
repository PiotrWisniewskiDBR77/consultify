# K4 v2 — niezależny ponowny przegląd

**Werdykt: HOLD.** Kandydat `95b5935e531c99875322f74125d388dfc9880f43` przywraca uczciwy widok `throw` i statyczny mianownik PDF `36 → 0`, ale nie dowodzi działającej granicy dla klasy `(b)`: 438 z 1579 sklasyfikowanych komunikatów przechodzi przez polską lokalizację bez zmiany. Dodatkowo `runtime:false` nadal maskuje co najmniej wpis z zagnieżdżonym template literal, principal czyta inne źródło niż kanoniczne `users.language`, a test właściciela miernika jest czerwony (`71/72`).

## Zakres

- kandydat: `origin/backup/codex/c-k4-k8sen-20260915` = `95b5935e531c99875322f74125d388dfc9880f43`;
- kod naprawczy: `63a538e6c2dec742d1aa795e567a16fe3678f1ea`;
- baza K1: `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`;
- poprzedni HOLD: `80d46c61c211fe1a808ce83237a5b63530b03e8f`;
- produkt nie był edytowany w przeglądzie.

## Blokery

### P1 — 438/1579 komunikatów klasy `(b)` nadal jest po angielsku dla profilu PL

Klasyfikacja przypisuje 1579 wpisów do `b:http-error-boundary` jednym wspólnym uzasadnieniem, że każda propagacja do `message/error` zostanie zlokalizowana. Próba wykonania `localizeServerErrorField(entry.text, 'pl')` dla całej klasy dała `438` wartości niezmienionych. Przykłady: `Meeting execution requires organizationId`, `Meeting execution requires title and start_time`, `Unknown step type: ${step.type}`, `update_status requires taskId and status`, `Simulation engine unavailable`.

Przyczyna jest deterministyczna: heurystyka w `serverPayloadLocalizer.ts:88-101` rozpoznaje tylko krótki słownik słów. Bezpośredni probe realnego payloadu:

```json
{"success":false,"error":"Meeting execution requires organizationId","status":400,"code":"BAD_REQUEST"}
```

z principalem `language='pl'` zwrócił identyczny JSON. To ma realną ścieżkę propagacji: `meetingExecutor.ts:29-33` rzuca ten wyjątek, adapter oddaje jego tekst w wyniku, a `actionDecisions.routes.ts:360-366` wysyła wynik jako HTTP 400. `status` i `code` pozostają bez zmian, lecz `error` nie jest polski.

Pozostałe komunikaty złapane przez heurystykę są zastępowane wspólnym `Nie udało się wykonać operacji.`, więc tracą szczegół domenowy. Nie można zatem utrzymać tezy „wszystkie b są lokalizowane na granicy bez utraty”. Residual `K8sen=1581` jest uczciwy jako jawny dług, ale manifest klas nie jest dowodem jego spłaty.

### P1 — `runtime:false` nadal może ukryć realny sink w pomiarze

Loader `scripts/i18n/pomiar-jezyka.mjs:973-984` parsuje obiekt regexem kończącym dopasowanie na pierwszym `}`. Dla wpisu `Invalid code. ${remainingAttempts ...}` z `batch05.ts:189-191` dopasowanie urywa się wewnątrz interpolacji, przed polem `runtime:false`; probe zwrócił `runtimeFalseSeen=false`. Tekst trafia więc do zbioru „zlokalizowanych”, mimo że lokalizator runtime jawnie go odrzuca przez `runtime:false`. Raport K8sen nie zawiera tej frazy. Deklaracja manifestu `runtimeFalseCountsAsLocalized=false` jest fałszywa dla tego kształtu danych.

### P1 — realny principal nie czyta kanonicznego języka profilu

Nowy kod `auth.middleware.ts:989-999` czyta wyłącznie `user_preferences(key='language')`. Repozytorium określa `users.language` jako account-level SSOT (`auth.routes.ts:134-138`), a zapis wyboru języka idzie przez `PUT /users/:id` do `users.language`. Test mockuje dodatkowy rekord w `user_preferences`, którego zwykła ścieżka profilu nie zapisuje. Użytkownik z `users.language='pl'` i bez tego niekanonicznego wpisu nadal dostanie principal bez `language`; wymagane pierwszeństwo profil → Accept-Language → EN nie jest dowiedzione na realnym źródle profilu.

### P1 — pełna regresja miernika jest czerwona

Deklarowane `34/34` obejmuje cztery wybrane pliki (`28/28` w niezależnym uruchomieniu), ale pomija test właściciela K1. `npx vitest run scripts/i18n/__tests__/pomiar-jezyka.e2f-bis.test.mjs --retry=0` kończy się `71 passed, 1 failed`: przypadek `K8s pomija sanitowany Error...` oczekuje `K8sen=1`, a po usunięciu maski otrzymuje `2` (`pomiar-jezyka.e2f-bis.test.mjs:171-176`). Zmiana kontraktu miernika i jego regresja nie są zsynchronizowane.

## Elementy naprawione lub potwierdzone

- globalna maska `throw new Error` została usunięta; raport uczciwie pokazuje residual `K8sen=1581`;
- manifest ma 50/50 wpisów, a wszystkie 50 rozmiarów i SHA-256 zgadza się z kandydatem;
- detektor PDF pokazuje `36 → 0`; kod przekazuje locale do sześciu zmienianych rodzin PDF, a test etykiet Management Reports potwierdza wariant PL. Dowód behawioralny nie obejmuje wygenerowanych bajtów wszystkich sześciu rodzin, więc przy obecnym HOLD nie podnoszę tego do pełnego sign-off;
- AIPipeline `process()` i `processStream()` oddają polski payload dla jawnego `request.options.language='pl'`; oba publiczne wywołania przeszły;
- brak zmian w `DrdHttpMethodWorkspaceScreen.tsx`, `languagePolicy.ts`, `Dockerfile.api` i `server/migrations/**`;
- dwa tekstowe trafienia `as any` są treścią katalogu komunikatów, nie nowym wykonywalnym rzutowaniem.

## Powtórzone bramki

| Bramka | Wynik |
|---|---|
| focused delta | PASS `28/28`, `--retry=0` |
| pełny test miernika K1 | **FAIL `71/72`** |
| server TypeScript | PASS, `0` |
| frontend TypeScript | TIMEOUT po 118 s, `0` diagnostyk (nie potwierdza progu `≤177`) |
| język | PASS ratchet, residual `K8sen=1581`, `K7 -11` |
| list canon | PASS `349/349` |
| artefakt | PASS `8-0-117` |
| production build | PASS, `10754` modułów |
| freeze hash | PASS `50/50` |

## Warunek zdjęcia HOLD

1. Sklasyfikować klasę `(b)` według rzeczywistych ujść i zapewnić tłumaczenie każdego komunikatu, który rzeczywiście dochodzi do użytkownika; testować reprezentatywne ścieżki także poza słowami obecnej heurystyki.
2. Zastąpić regexowe czytanie obiektów katalogu parserem lub eksportem runtime, który niezawodnie respektuje `runtime:false`, także dla zagnieżdżonych template literals.
3. W `verifyToken` czytać kanoniczne `users.language` z bezpiecznym fallbackiem zgodnym z istniejącym profilem i udowodnić tę samą ścieżkę, którą zapisuje UI.
4. Uzgodnić zmianę mianownika z regresją K1 i doprowadzić pełny test miernika do zieleni.

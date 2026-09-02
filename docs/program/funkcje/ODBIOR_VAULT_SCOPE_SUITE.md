---
doc_id: funkcje-vault-scope-suite
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Czerwony pakiet izolacji sejfów — PRZYRZĄD, i to NASZA regresja z dzisiaj

Pytanie nadrzędne brzmiało: **kłamie przyrząd czy przecieka produkt?**
Odpowiedź, zmierzona sondą dla wszystkich jedenastu czerwieni: **przyrząd.**

## Przyczyna — jedna, wspólna, zmierzona nie z rozumowania

```
warn: [executeKBSearch] Policy gateway error (fail-closed):
      Cannot read properties of undefined (reading 'allowedScopes')
PROBE_RAW={"results":[],"note":"Blocked by policy gateway"}
```

`toolDefinitions.ts:899` czyta `policyResult.decision.scopeResolution.allowedScopes`.
Atrapa w teście zwracała obiekt **bez** `scopeResolution` ⇒ wyjątek ⇒ `catch`
fail-closed (`:910`) ⇒ **funkcja wygaszona we wszystkich 18 przypadkach**.

**Produkt nie przeciekał.** Diff naprawy to wyłącznie plik testowy — zero zmian
w kodzie produkcyjnym, zero usuniętych asercji.

## ★ Winowajcą jest NASZ commit z dzisiaj

`ae70377533` — *fix(day206) pkt 2/5/6: privateMode do pętli i egzekucja w KB*,
**31.08 o 10:55**. Dodał odczyt `scopeResolution.allowedScopes`, nie aktualizując
atrapy. Bisekt **empiryczny**, nie z rozumowania:
- `ae70377533^` ⇒ `Tests 18 passed (18)`
- `ae70377533` i HEAD ⇒ `Tests 11 failed | 7 passed (18)`

Podejrzenia nadzorcy (FIX-213, kontrakt parametru) **obalone** — nie dotykają tej ścieżki.

## ★★ Siedem „zielonych" było FAŁSZYWIE zielonych

Podział nie był przypadkowy:
- **wszystkie 11 czerwonych** to asercje „**właściciel WIDZI**";
- **wszystkie 7 zielonych** to asercje „**obcy NIE widzi**" — świeciły, bo **nikt nie
  widział niczego**.

Pakiet meldował „izolacja OK" dokładnie wtedy, gdy cała funkcja była martwa. To jest
kształt **„zamknięte przez wygaszenie"** w najczystszej postaci — czwarty raz tego
samego dnia, tym razem w samym przyrządzie pomiarowym.

## Naprawa: atrapa USUNIĘTA, nie podrasowana

Zmierzono, że realny `chatPolicyGateway` działa w tym środowisku bez bazy. Test
używa więc **realnego gateway'a** — nie może się już rozjechać z kontraktem.
To ważniejsze niż sama zieleń: usunięto źródło przyszłych rozjazdów.

## Trzy zabezpieczenia okazały się NIEUDOWODNIONE — domknięte

Przebieg dziewięciu mutacji pokazał, że sama poprawiona atrapa nie wystarcza:
**M4 (autorytet folderu) i M9 (`projectIds` z FIX-213) PRZEŻYŁY** — testy zostały
zielone przy skasowanym zabezpieczeniu.

1. **Autorytet folderu** — oba istniejące przypadki kończyły się wcześniej, na checku
   widoczności (`:1067`), i nigdy nie dochodziły do linii autorytetu (`:1077-1078`).
   Wektor realny: dokument projektu A złożony w folderze projektu B jest widoczny dla
   kogoś, kto nie jest członkiem A — schemat nie wymusza zgodności projektu folderu
   i dokumentu.
2. **`projectIds`** (naprawa z FIX-213) nie miała w tym pakiecie żadnej bramki.
3. **Dwa przypadki fail-closed** przechodziły po usunięciu checku widoczności — pusty
   wynik wychodził z drugiej warstwy. Dodano asercje na `note`, odróżniające
   „odmówiono, bo nie twój" od „wpuszczono, ale akurat pusto".

Wszystko domknięte **dodaniem** przypadków. Stan: **21/21 zielone, i każdy z 21
przypadków czerwienieje pod co najmniej jedną z dziesięciu mutacji.**

## Regresja
5 plików / 19 testów zielone na realnym Postgresie (migracje strict od pustej bazy),
z ominięciem obu pułapek: cichej atrapy bazy (`Database.ts:79-85`) i `DB_TYPE`
przybitego do sqlite (`vitest.config.ts:210`). Że to realna baza, dowiedziono
mutacyjnie na łańcuchu produkcyjnym.

## Pozycja otwarta
Ten sam wektor mógł trafić inne pakiety commita `ae70377533`. Sprawdzono sąsiadów
(`day206.toolLoopBehaviour`, `sideEffectTools` — zielone), nie cały zbiór.
**Pewność co do całego commita wymaga osobnego pomiaru.**

## ★★★ DOMKNIĘCIE (31.08, gałąź `fix/blast-radius-ae70377533`) — pełny zasięg zmierzony

### 1. Inwentarz atrap decyzji polityki retrievalu
Przeszukano CAŁY zbiór testów pod kątem: (a) każdego pliku importującego
`evaluateRetrievalPolicyDecision`/`chatPolicyGateway`, (b) każdego `vi.mock` tych
modułów (niezależnie od nazwy pliku), (c) każdego testu wołającego
`executeToolCall`/`executeKBSearch`/`kb_search`/`toolDefinitions`. Wynik — **jedyna
atrapa decyzji polityki w całym repo** to ta już naprawiona w tym pliku
(`tests/unit/backend/toolDefinitions.executeKBSearch.vaultScope.test.ts`).
Wszystko inne odpada z konkretnego powodu:

| Plik | scopeResolution w atrapie? | Werdykt |
|---|---|---|
| `tests/unit/backend/toolDefinitions.executeKBSearch.vaultScope.test.ts` | TAK (po naprawie fb08e9aa8f — `chatPolicyGateway` NIE jest już atrapowany, gateway jest realny) | naprawiony, w zakresie |
| `tests/unit/backend/chatPolicyGateway.contract.test.ts` | n/d | woła `evaluateChatPolicyDecision` (INNA funkcja) bez mocka — poza wektorem |
| `server/src/services/ai/__tests__/chatPolicyGateway.contract.test.ts` | n/d | jw., atrapuje tylko `enterpriseSecurity.scanAndSanitize` |
| `server/src/services/ai/__tests__/chatPolicyGateway.retrieval.test.ts` | n/d (realny gateway) | testuje SAM gateway, atrapuje tylko `enterpriseSecurity` — poza wektorem |
| `tests/unit/backend/wave8AgentRuntimeService.test.ts` | n/d | atrapuje CAŁE `executeToolCall` — nigdy nie dotyka `evaluateRetrievalPolicyDecision` |
| `tests/integration/ai/day206.toolLoopRoute.test.ts` | n/d | atrapuje `executeToolCall`, ale REALNY handler `ai.routes.ts` (pkt 2/5/6) — poza wektorem punktu 1, w zakresie punktu 2 |
| `server/src/services/ai/__tests__/day180.agent-plan-retry-admission.pg.test.ts` | n/d | atrapuje CAŁE `toolDefinitions.js` (retry/governance, nie KB) — poza wektorem |
| `day206.privateModeToolScope.pg.test.ts`, `day206.crossOrgToolScope.pg.test.ts`, `day213.projectScopeRealChain.pg.test.ts`, `day210.realchain.proof.pg.test.ts`, `fix217.vaultProjectNameContract.pg.test.ts`, `day174.agent-resource-policy.pg.redis.test.ts` | n/d (realny gateway, realny Postgres) | atrapują co najwyżej `ragService`/`toolDefinitions` (inny mock), nigdy politykę — poza wektorem |
| `day206.teresaToolLoop.contract.test.ts`, `sideEffectTools.test.ts`, `day206.toolLoopBehaviour.test.ts` | n/d | nigdy nie wołają `kb_search`/polityki (inne narzędzia lub statyczny Set) — potwierdzone, nie tylko "sąsiedzi zieloni" |

**Zero nowych atrap znalezionych.** Jedyna, która istniała, była już naprawiona.

### 2. Pozostałe punkty commita (privateMode w pętli, slot SSE `timeout`, wycena kosztu w try)
`tests/integration/ai/day206.toolLoopRoute.test.ts` i
`src/components/AIChat/__tests__/day206.toolStepsSlot.test.tsx` wołają REALNY kod
(`ai.routes.ts` handler / `applyToolStepEvent`) bez atrapowania nowych pól —
zmierzone przejściem (6/6 i osobno reducer). **Nie znaleziono drugiego miejsca, gdzie
kod produkcyjny czyta pole, którego atrapa nie zwraca.**

### 3. Sonda RAW (fałszywa zieleń?)
Zbudowano jednorazową sondę (`executeToolCall` na realnym Postgresie, bez żadnej
atrapy `chatPolicyGateway`) i wypisano surowe JSON-y:
```
PROBE_RAW_1={"source":"knowledge_base","query":"probe","results":[]}
PROBE_RAW_2={"source":"knowledge_base","query":"probe","privateMode":true,"results":[],"note":"Tryb prywatny: sejf organizacji/projektu jest poza zakresem tej rozmowy"}
PROBE_RAW_3={"source":"knowledge_base","query":"probe","results":[],"note":"Brak dokumentów w dostępnym zakresie Vault"}
```
Żaden wynik nie niesie `"note":"Blocked by policy gateway"` (sygnatura wygaszenia
fail-closed sprzed naprawy). Wszystkie 9 pakietów z tabeli powyżej uruchomiono na
realnym Postgresie (`RUN_DB_TESTS=1`, `DB_TYPE=postgres`, kontener lokalny) —
**52/52 testów zielonych, zero pakietów zielonych przez wygaszenie.**

### 4. Naprawa
Nic do naprawienia — jedyna atrapa była już usunięta w tej samej gałęzi przed tym
pomiarem (fb08e9aa8f/2875adc9b5).

### 5. Bramka mutacyjna (zabezpieczenie `privateMode` odcina sejf org/projektu)
Zmutowano `toolDefinitions.ts:899` (`orgScopeAllowed = policyResult.decision
.scopeResolution.allowedScopes.includes('org_shared')` → `orgScopeAllowed = true`,
czyli wyłączono egzekucję trybu prywatnego):
- **czerwień**: `toolDefinitions.executeKBSearch.vaultScope.test.ts` → 2 failed,
  `day206.privateModeToolScope.pg.test.ts` → 1 failed (3/24 czerwone, dokładnie te,
  które sprawdzają odcięcie sejfu organizacji w trybie prywatnym).
- **przywrócono kod → 24/24 zielone** (oba pakiety, realny Postgres).

### Para dowodowa
Obecna w każdym sprawdzonym pakiecie realnego łańcucha: `day210.realchain.proof` —
"owner sees own private doc" + "other org member does NOT see"; `day206.crossOrgToolScope`
— "nie zwraca cudzej organizacji" + "właściciel nadal widzi własną";
`day206.privateModeToolScope` — "org doc NIE wchodzi" + "org doc JEST w zakresie
(czułość)". Żaden pakiet nie polega wyłącznie na "obcy NIE widzi".

### Wynik końcowy
**Zasięg rażenia `ae70377533` = 1 plik, już naprawiony.** Pozycja domknięta.

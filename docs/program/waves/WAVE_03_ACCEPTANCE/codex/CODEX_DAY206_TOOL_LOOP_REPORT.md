# CODEX DAY206 — TOOL LOOP READ

Stan: **PARTIAL / NOT_PROVEN dla pełnego DoD R2–R3**. Rdzeń R1 jest zbudowany i
zabezpieczony na `github-backup`; nie zawyżam testów kontraktowych do realnego scenariusza.

## Baza i sanity — dosłownie

```text
MARKER OK
c50847c25974d9a38783ab02362c8078716dab53
```

Tip uciekł o trzy commity dokumentacyjne. `git diff --name-only` wykazał wyłącznie pakiety
werdyktowe i instrukcje 205/206; brak kolizji w czterech gorących plikach produktu. Porty
`6146`, `5084`, `5085`: **3 z 3 wolne**. Pierwsze migracje: komplet zastosowany; replay:
`Applying migrations: 0` i `Postgres migrations complete`.

## Korekty wobec instrukcji

- T1 potwierdzona pomiarem: `19` w `AI_TOOLS`, `8` w `SIDE_EFFECT_TOOLS`, READ `11 z 19`.
- P1 był zbyt szeroki: pętla model-driven już istniała (`maxIterations: 4`), brakowało READ.
- Definicje `AI_TOOLS` były martwe modelowo: `getAvailableTools` miało tylko definicję, zero
  wołaczy. Dyspozytor `executeToolCall` żył w planerze, V8 i playbooku.
- `query_structured_data` jest side-effect i nie weszło do 17-B.
- Agent-plan nie ma SSE; wzorce są w `ai.routes.ts`.

## R1a — kompletna tabela

| # | Narzędzie | Side effect | Cena USD | Dyspozytor | Decyzja 206 |
|---:|---|---:|---:|---|---|
|1|`search_web`|nie|0.02|`executeToolCall`|READ|
|2|`search_knowledge_base`|nie|0.01|dwa rejestry; w 206 `executeToolCall`|READ|
|3|`list_enterprise_connectors`|nie|0|`executeToolCall`|READ|
|4|`search_enterprise_connector`|nie|0.05|`executeToolCall`|READ|
|5|`get_assessment_data`|nie|0|`executeToolCall`|READ|
|6|`calculate_financial`|nie|0|`executeToolCall`|READ|
|7|`run_monte_carlo`|nie|0|`executeToolCall`|READ|
|8|`get_initiative_status`|nie|0|`executeToolCall`|READ|
|9|`compare_benchmarks`|nie|0|`executeToolCall`|READ|
|10|`find_similar_decisions`|nie|0|`executeToolCall`|READ|
|11|`get_stakeholder_analysis`|nie|0|`executeToolCall`|READ|
|12|`create_initiative_draft`|tak|0|`executeToolCall`|poza zbiorem|
|13|`generate_report_section`|tak|0|`executeToolCall`|poza zbiorem|
|14|`schedule_meeting`|tak|0|`executeToolCall`|poza zbiorem|
|15|`create_notebook_entry`|tak|0|`executeToolCall`|poza zbiorem|
|16|`query_structured_data`|tak|0.01|`executeToolCall`|poza zbiorem|
|17|`create_task`|tak|0|`executeToolCall`|poza zbiorem|
|18|`update_task`|tak|0|`executeToolCall`|poza zbiorem|
|19|`create_decision`|tak|0|`executeToolCall`|poza zbiorem|

Wszystkie narzędzia READ mają cenę: **11 z 11**. Płatne: trzy. Rozstrzygnięcie kolizji:
**pętla READ czatu używa implementacji `toolDefinitions.ts`; MCP pozostaje bez zmian dla
starych konsumentów**.

## Zbudowany łańcuch R1

Flaga `ENABLE_TERESA_TOOL_LOOP` ma default OFF. `AIPipeline` podaje 11 definicji READ do
addytywnej rodziny `readTools`; `llmService.callStream` wykonuje ją przez osobny callback,
nie przez MCP. Limit iteracji pochodzi z `TERESA_TOOL_LOOP_MAX_ITERATIONS`, default `4`, zakres
`1..8`. Timeout narzędzia to 12 s w całkowitym budżecie strumienia 60 s. Limit kosztu tury
wynosi 0.08 USD i jest egzekwowany przed wykonaniem. SSE niesie tylko nazwę, status i sumę
kosztu — nigdy wynik narzędzia.

Front: demux zapisuje kroki w metadanych bieżącego dymka, `MessageRenderer` montuje realny
`ToolStepList`. Zrzut harnessu używa **realnego komponentu**, ale dane pochodzą z propsów w
kształcie `tool_step`, nie z realnego SSE.

## Testy i zasięg nazw

Przed: 16 pełnych nazw. Po: 22 pełne nazwy. Dodano sześć, zniknęło **0**. Wynik po:
`22/22 PASS`, `--retry=0`. Nowe nazwy są w `po-nazwy.txt`; diff jest w artefaktach.

Pułapki: pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie dowodzi
Postgresa, ApiGateway ani polityk runtime. Nie dotyczy mu bypass auth ani V8 gate. Sprawdza
brak WRITE, kompletność ceny, OFF i sanitarny kontrakt źródłowy. Pełny `tsc` nie jest PASS:
proces zakończył się OOM przy ok. 4 GB.

## Zrzuty

| Motyw | mean_luma | SHA-256 |
|---|---:|---|
|jasny|249.000|`a3ff7731adf6577784716051e38d9eb0a383e9c080bd5a6409cd6181fceabf06`|
|ciemny|17.164|`5d107058721ccc30270758ed80deaec3498f5a7d83624a2641ecf8e960b213c3`|

Różnica: **231.836 > 150**. Pliki: `/private/tmp/cx-day206-tool-loop-artefakty/`.

## R2 i R3 — stan uczciwy

R2 polityki przechodzą przez `executeToolCall` w kodzie, ale nie wykonano jeszcze wymaganego
testu pętli na realnym Postgresie ani dowodu mutacyjnego izolacji. `consumerClass` pozostaje
`agent`; zmierzono, że executor tak woła bramkę, ale nie udowodniono różnicy klas runtime.

R3a jest **NOT_PROVEN**: prefetch KB pozostaje niezmieniony, więc przy ON ryzyko podwójnego
źródła nadal istnieje. R3b: wykonano **0 przebiegów / 0 rund modelu**; nie użyto klucza i nie
zużyto budżetu. Nie ma dowodu modelowego ani realnych liczb inicjatywy. To blokuje werdykt
`VERIFIED`, ale nie unieważnia dostarczonego rdzenia R1.

## Z30 — deklaracja

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy
konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden
e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Artefakty

- `input-T1-T13.log` — `76cd5e10de1090b0c61cf9b55f4eaa93f801e25706b3ddf63802bf6a3c7239c1`
- `przed.json` — `08167845fabe2be0110d18cf80550d8ba8ed8a5e140a02ff9885f53c02af258d`
- `po.json` — `9eb1645a3fc7a3d817b0595caf103ee5212fe80620401218e1b38d1d963ce41d`
- `migrate-first.log` — `425e488dcdca413835b1db22e8829a03d0b304d944281126d8abc1d1ef1271fc`
- `migrate-second.log` — `398fb167042b6034390798cccd9b58e2809928ca690819dbf3261223fbfacf2c`

## TWIERDZENIA NIEZWERYFIKOWANE

- Tabela 19/19 jest kompletna i zmierzona, nie skrócona.
- T3 (`mcpServer.execute`) oraz brak wołaczy `getAvailableTools` zmierzono grepem.
- Dane na zrzutach są z propsów harnessu, nie z realnego SSE.
- Rund modelu: 0; scenariusza R3b nie wykonano.
- `consumerClass='agent'` zmierzono w kodzie, nie w realnym przebiegu polityki.
- Cennik sprawdzono dla wszystkich 11 READ testem; zachowania płatnego limitu nie dowiedziono
  mutacją runtime.
- ApiGateway + JWT + realny Postgres + odpowiedź modelu: NOT_PROVEN.

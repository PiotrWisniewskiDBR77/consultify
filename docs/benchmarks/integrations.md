---
brief: integrations
module: Integracje / sync platform
sources: [Workato docs (scrape 2026-06, docs.workato.com/en — pełna treść stron + ~1017 zrzutów UI), MuleSoft / Anypoint docs (docs.mulesoft.com — dataweave/studio/mcp/connectors, ~1778 zrzutów), Boomi help (help.boomi.com/docs/Atomsphere — connectors/process-building/MCP)]
status: done
grounding: scrape
updated: 2026-06-10
---

# Benchmark: Integracje / sync platform

> Po co: zaprojektować nasz model integracji (sync kalendarza, Google Drive, dane zewnętrzne
> do Consultify) na sprawdzonym, reużywalnym modelu iPaaS — **connector → trigger → action →
> mapping** — zamiast pisać każdy konektor ad-hoc. Nie budujemy iPaaS; kradniemy jego abstrakcje.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature | Model mentalny |
|---|---|---|---|
| **Workato** | Recipe-driven automation / iPaaS dla biznesu+IT | **Recipe = trigger + actions**, ogromny katalog prebuilt connectorów, SDK do własnych | Niski próg wejścia, najbliżej naszych potrzeb |
| **MuleSoft (Anypoint)** | Enterprise API-led integration | **DataWeave** (transformacja) + Anypoint Studio (flow canvas) + Exchange (katalog assetów) | Ciężki, deweloperski, API-first |
| **Boomi (Atomsphere)** | Wizualny iPaaS, low-code | **Process canvas** (steps na kanwie) + Connectors + Atom runtime | Wizualny proces jako graf step'ów |

Wniosek strategiczny: **Workato to nasz wzorzec modelu i UX** (recipe = trigger+akcje, connector jako
abstrakcja, lookup/data tables). MuleSoft to wzorzec **warstwy transformacji** (DataWeave → nasz
mapping). Boomi to wzorzec **wizualnego grafu procesu** (gdybyśmy dali userowi budować flowy).
Dla v1 Consultify potrzebujemy najmniejszego wycinka: kilka first-party connectorów (Calendar, Drive),
trigger (webhook/poll/schedule), action (upsert do naszej bazy), mapping (pole→pole).

## 2. Screenshoty (realne UI produktu)

Korekta wobec poprzedniej wersji briefu: pakiety **zawierają** realne zrzuty UI docs (Workato ~1017
png, MuleSoft ~1778 png; Boomi help to tylko ikony SVG). Skopiowano 3 najwartościowsze do
`assets/integrations/`:

- `workato-recipe-trigger-actions-retry.png` — recipe builder Workato: **TRIGGER** (New/updated Account
  w Salesforce) → **ACTIONS** (Search/Update/Create w Zendesk) + blok **MONITOR … for error** z
  **IF Error message … RETRY all actions up to 3 times**. Jeden obraz = cały model trigger→akcje
  →error-handling+retry, który kradniemy.
- `workato-recipe-builder-datapill-mapping.png` — panel konfiguracji akcji + lewa szpalta **Recipe data**
  z **datapillami** („drag its datapill into a field"). To dosłownie nasz deklaratywny mapping pole→pole.
- `mulesoft-anypoint-studio-flow-dataweave.png` — Anypoint Studio: flow na kanwie + **Mule Palette**
  (Scheduler, HTTP, Error Handler / On Error Continue / On Error Propagate / Raise error) + panel
  **Transform Message** (DataWeave). Wzorzec warstwy transformacji i obsługi błędów.

`Boomi2` = **pusty (0 plików — potwierdzone)**. Boomi `help.boomi.com/img` zawiera wyłącznie SVG-ikony
(brak realnych zrzutów kanwy) — Boomi opisujemy z treści docs, nie ze zrzutu.

## 3. Reużywalny model: connector + trigger + action + mapping

To jest rdzeń, który kradniemy — potwierdzony w treści stron (cytaty z realnego scrape):

- **Connector** = nazwana integracja z jednym systemem zewn. Workato `developing-connectors/sdk.html`
  wprost: *„A connector enables Workato to engage with a single application through a sequence of triggers
  and actions"*. `connectors.html` rozkłada connector na **Authentication + Triggers + Actions**. Boomi
  `connectors_overview.html`: connectory dzielą się na **application / event-driven / technology**, plus
  **connector SDK** do własnych prywatnych. → Dla nas: `GoogleCalendarConnector`, `GoogleDriveConnector`
  jako pierwsze, wspólny interfejs `{ auth, obiekty/pola, triggery, akcje }`.
- **Trigger** = co uruchamia sync. Workato `recipes/building-recipes.html`: *„Every recipe starts with a
  trigger"* — dwa typy w docs: **Event-based** i **Scheduled**. W praktyce trzy wzorce:
  - **scheduled/poll** — Workato `features/scheduler.html` = natywna app uruchamiająca recipe co interwał
    (godzinowo/dziennie/co 2 tyg./tylko dni robocze) — nasz fallback dla Drive.
  - **webhook / real-time** — Boomi `event_driven_connectors`: connectory ED reprezentują *event
    consumers/producers*, wykrywają zdarzenia real-time → preferowane dla Calendar (Google push).
  - **new/updated record** — trigger śledzi kursor (timestamp/ID), dostaje tylko delty.
- **Action** = *„what the recipe does after it is triggered… interacts with an application to modify or
  retrieve data"* (Workato). Typowe: **create / update record + send notification**; recipe może mieć
  jedną lub wiele akcji + logikę IF-Else i loops. → Dla nas akcja = upsert do encji Consultify (notatka,
  plik, event).
- **Mapping / transformacja** = pole-źródłowe → pole-docelowe. Workato `data-pills-and-mapping.html`
  definiuje wprost: *„Fields mapping is the assignment of datapills (variables) or absolute values
  (constants) into action or trigger input fields"* — czyli **deklaratywne** przypisanie, nie kod. MuleSoft
  robi cięższą wersję przez **DataWeave** (`dataweave/latest/*` — formaty CSV/JSON/XML/Java/Avro/Excel/
  Fixed-Width/Flat-File). Boomi: **Map shape** z map functions. → Dla nas: deklaratywny mapping
  (JSON: `{target: sourcePath}`), nie pełny silnik transformacji per-integracja.

## 4. Wzorce krytyczne dla naszego sync (potwierdzone treścią)

- **Error handling / retry** — Workato `building-recipes.html` ma dedykowany blok **„Monitor the following
  actions for an error" → IF Error → RETRY N times → STOP/dalej** (patrz zrzut §2), oraz **on-error
  datapille** (Error type, Error message, Retry count, Error UUID, Errored step). MuleSoft: **On Error
  Continue / On Error Propagate / Raise error** w palecie Studio. Boomi: Try/Catch na step'ach.
  **Każdy nasz sync musi mieć**: retry z backoff, dead-letter (job failed → widoczny, re-runnable),
  idempotencję na kursorze. To czego brakuje naiwnym integracjom — i co zabija zaufanie przy sync kalendarza.
- **Lookup / data tables** — Workato `features/lookup-tables.html`: *„Lookup tables enable recipes to
  store, reference, and manage frequently used data… similar to a cross-reference table"* (limity: do 100
  tabel/workspace, 10 kolumn, 100 000 wierszy, 128 KB/wiersz). Osobno `data-tables.html`. **Potrzebujemy
  tego** dla mapowania external_id ↔ encja Consultify (de-dup, idempotentny upsert).
- **Conditional logic / loops** — Workato `building-recipes.html`: **IF-Else** + **loops** (przetwarzanie
  wielu rekordów w jednym przebiegu); Boomi branche/decision; MuleSoft choice-router. Dla v1 minimalne
  (filtr „tylko eventy z tego kalendarza").
- **Batch / pagination** — MuleSoft batch-processing, Boomi flow control. Sync Drive = paginowany listing
  → batch upsert.
- **Scheduler** — Workato `features/scheduler.html` (Scheduler by Workato = natywna app, cron-owe
  wyzwalanie). Nasz poll-sync.
- **Connector SDK** — Workato `developing-connectors/sdk.html`: custom connector = **deklaracja** (schemat
  z kluczami `connection`, `object_definitions`, `triggers`, `actions`, `methods`, `pick_lists`, obsługa
  `webhook`), prywatny scope domyślnie, z opcją open/closed-source. Plus **universal HTTP connector +
  custom actions** dla prostszych integracji bez pełnego connectora. Boomi `Building_connector_developer`,
  MuleSoft connector-builder — ten sam wzorzec: connector to deklaracja, nie hardkod → 3. i 4. integracja tanio.
- **Files & attachments** — Workato `features/workato-filestorage.html`: szyfrowany FileStorage +
  **Streaming** (*„transfer large files… in smaller parts called chunks"*; wszystkie file-adaptery i
  bulk-akcje wspierają streaming). Bezpośrednio relewantne dla Google Drive sync — nie ładuj plików do pamięci.
- **MCP (nowy wzorzec, u wszystkich 3! — potwierdzony treścią)** — to najsilniej zweryfikowana teza:
  - **Workato** `mcp/getting-started.html`: *„An MCP server is a collection of tools that enable LLMs to
    access data and perform actions in your systems… works with Agent Studio, Claude, ChatGPT, or any
    MCP-compatible client"*; recipe-collection generuje **unikalny, uwierzytelniony remote MCP URL**.
  - **MuleSoft** `mulesoft-mcp-server`: *„transform your APIs to agent-ready assets in minutes"* — MCP
    Support już GA.
  - **Boomi** `int-MCP_connector.html`: *„transforms your deployed Boomi processes into discoverable,
    callable tools that any MCP-compatible client can access"* — **ale status = Technology Preview**
    (nie do produkcji), wsparcie Claude/Gemini/Amazon Q.
  → Dla nas: connectory Consultify (Calendar/Drive) powinny być od startu wystawialne jako **tools dla
  Teresy**, nie tylko jako sync w tle. To strategiczny zwrot rynku — iPaaS-y konwergują na „connector = tool dla agenta".

## 5. Decyzje dla Consultify

- ✅ **Kradniemy** model `connector → trigger → action → mapping` jako wspólny szkielet — pierwsza
  integracja (Calendar) definiuje interfejs, kolejne (Drive, dane zewn.) tylko go implementują.
- ✅ **Kradniemy** trzy typy triggerów (webhook / poll / new-record-z-kursorem) — Calendar = webhook
  (Google push) z poll-fallbackiem, Drive = poll/changes-API.
- ✅ **Kradniemy** lookup/data-table do mapowania external_id ↔ encja Consultify (de-dup, idempotentny upsert).
- ✅ **Kradniemy** dyscyplinę error-handling: retry+backoff, dead-letter, re-runnable job, widoczny status sync.
- ✅ **Kradniemy** wzorzec MCP: connectory wystawiamy jako tools dla Teresy od dnia 1, nie tylko jako tło.
- ⚠️ **Adaptujemy** mapping deklaratywnie (`{target: sourcePath}` JSON), bez pełnego DataWeave/silnika
  transformacji — to za dużo na v1; tylko proste rename/przekształcenia pól.
- ⚠️ **Adaptujemy** „recipe" jako koncept wewnętrzny (definicja sync-flow), nie jako user-facing builder —
  na razie konfiguruje to dev/admin, nie klient.
- ❌ **Unikamy** budowy generycznego iPaaS / user-facing flow-buildera (Boomi canvas, Anypoint Studio) —
  to osobny produkt; my robimy kilka first-party syncs, nie platformę integracyjną.
- ❌ **Unikamy** ciężkiej warstwy runtime (Atom/Mule runtime, on-prem agents) — nasze syncy żyją w
  istniejącym backendzie Consultify.
- ❌ **Unikamy** sync bez kursora/idempotencji — to gwarantowane duplikaty i utrata zaufania.

## 6. Otwarte pytania
- Webhook ingest: własny endpoint + weryfikacja podpisu Google, czy gotowy provider?
- Gdzie żyje stan sync (kursor, mapping table) — nowa tabela w Postgres czy per-org config?
- Czy mapping jest user-edytowalny w v1, czy hardcoded per-connector (rekomendacja: hardcoded v1)?
- Kolejność: Calendar najpierw (najwięcej wartości dla Teresy/meetingów) przed Drive — potwierdzić.
- MCP: wystawiamy connectory jako tools przez nasz istniejący kanał Teresy, czy osobny MCP server?

## Załączniki
Surowe źródło (read-only, do usunięcia po akceptacji): `Softs/0 synchronizacja/{Workato,Workato 2,
Mustsoft,Mustsoft 2,Mustsoft 3,Boomi}`.
Zrzuty referencyjne (realne UI, 2026-06-10) w `assets/integrations/`: `workato-recipe-trigger-actions-retry.png`,
`workato-recipe-builder-datapill-mapping.png`, `mulesoft-anypoint-studio-flow-dataweave.png`.
Ten brief jest oparty na **pełnej treści stron** (odczyt przez `textutil` — dostęp do `Softs/` przywrócony):
Workato (building-recipes, data-pills-and-mapping, lookup-tables, scheduler, workato-filestorage, sdk,
mcp/*), MuleSoft (dataweave, mulesoft-mcp-server, Anypoint Studio), Boomi (connectors_overview,
event_driven_connectors, process-building, int-MCP_connector). `Boomi2` = pusty (0 plików — potwierdzone).
`Workato 2` / `Mustsoft 2-3` to głównie strony marketingowe (www/mktg) — uzupełniają, nie są rdzeniem dowodu.

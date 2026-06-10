---
brief: integrations
module: Integracje / sync platform
sources: [Workato docs (scrape 2026-06, docs.workato.com/en — pełny sitemap), MuleSoft / Anypoint docs (docs.mulesoft.com — connectors/studio/dataweave/mule-runtime), Boomi help (help.boomi.com/docs/Atomsphere)]
status: done
updated: 2026-06-10
---

# Benchmark: Integracje / sync platform

> Po co: zaprojektować nasz model integracji (sync kalendarza, Google Drive, dane zewnętrzne
> do Consultify) na sprawdzonym, reużywalnym modelu iPaaS — **connector → trigger → action →
> mapping** — zamiast pisać każdy konektor ad-hoc. Nie budujemy iPaaS; kradniemy jego abstrakcje.

## 1. Krajobraz konkurencji

| Narzędzie | Pozycjonowanie | Killer feature | Model mentalny |
|---|---|---|---|
| **Workato** | Recipe-driven automation / iPaaS dla biznesu+IT | **Recipe = trigger + steps**, ogromny katalog prebuilt connectorów, SDK do własnych | Niski próg wejścia, najbliżej naszych potrzeb |
| **MuleSoft (Anypoint)** | Enterprise API-led integration | **DataWeave** (transformacja) + Anypoint Studio (flow) + Exchange (katalog assetów) | Ciężki, deweloperski, API-first |
| **Boomi (Atomsphere)** | Wizualny iPaaS, low-code | **Process canvas** (shapes/branches) + Connectors + Atom runtime | Wizualny proces jako graf shape'ów |

Wniosek strategiczny: **Workato to nasz wzorzec modelu i UX** (recipe = trigger+akcje, connector jako
abstrakcja, data tables/lookup). MuleSoft to wzorzec **warstwy transformacji** (DataWeave → nasz
mapping). Boomi to wzorzec **wizualnego grafu procesu** (gdybyśmy dali userowi budować flowy).
Dla v1 Consultify potrzebujemy najmniejszego wycinka: kilka first-party connectorów (Calendar, Drive),
trigger (webhook/poll/schedule), action (upsert do naszej bazy), mapping (pole→pole).

## 2. Screenshoty
**Brak.** Scrapy zawierają wyłącznie HTML docs + CDN/fonty; ciężkie GIF-y marketingowe były już
usunięte, a w pakietach nie ma realnych zrzutów UI produktu (0 plików png/jpg w `docs.*`).
`Boomi2` = pusty (tylko assety, 0 plików treści). Nie skopiowano nic do `assets/integrations/`.
Najwartościowszym artefaktem jest **mapa sitemap** (§ poniżej) = feature-surface każdego vendora.

## 3. Reużywalny model: connector + trigger + action + mapping

To jest rdzeń, który kradniemy (najczytelniej u Workato — `recipes/triggers.html`, `recipes/steps.html`,
`connectors.html`, `developing-connectors/sdk.html`):

- **Connector** = nazwana integracja z systemem zewn. = `{ auth (OAuth2/API-key), metadata (jakie
  obiekty/pola), set triggerów, set akcji }`. Workato: `prebuilt-connectors` (setki) + **SDK** do własnych.
  → Dla nas: `GoogleCalendarConnector`, `GoogleDriveConnector` jako pierwsze, wspólny interfejs.
- **Trigger** = co uruchamia sync. Trzy wzorce (Workato `triggers.html`):
  - **poll/scheduled** — odpytuj co N min (Workato `features/scheduler.html`) — nasz fallback dla Drive.
  - **webhook / real-time** — system zewn. woła nas (Workato `connectors/workato-webhooks.html`,
    Boomi `event_driven_connectors`) — preferowane dla Calendar (Google push notifications).
  - **new/updated record** — trigger śledzi kursor (timestamp/ID), dostaje tylko delty.
- **Action** = co robimy z danymi: `create / update / upsert / search / delete` na obiekcie docelowym.
  Workato `steps.html` = sekwencja akcji; akcją może też być transformacja albo wywołanie sub-recipe.
  → Dla nas akcja = upsert do encji Consultify (notatka, plik, event).
- **Mapping / transformacja** = pole-źródłowe → pole-docelowe. MuleSoft robi to przez **DataWeave**
  (`dataweave/latest/*` — funkcje map/filter, formaty json/java/csv/xml). Workato: inline data-pills +
  `features/sql-transformations-*`, `features/handling-json|xml|csv`. Boomi: **Map shape** z profilami.
  → Dla nas: deklaratywny mapping (JSON: `{target: sourcePath}`), nie kod per-integracja.

## 4. Wzorce krytyczne dla naszego sync (z sitemap)

- **Error handling / retry** — MuleSoft `intro-error-handlers.html`, Boomi `Try/Catch` + retry na
  shape'ach, Workato `troubleshooting/*` + job retry. **Każdy sync musi mieć**: retry z backoff,
  dead-letter (job failed → widoczny, re-runnable), idempotencję na kursorze. To czego brakuje
  naiwnym integracjom — i co zabija zaufanie usera przy sync kalendarza.
- **Lookup / data tables** — Workato `features/lookup-tables.html`, `data-tables.html` =
  trwała tabela do mapowań (np. external_id ↔ consultify_id) i de-dup. **Potrzebujemy tego** dla
  mapowania zewn. ID na nasze encje (żeby update nie tworzył duplikatów).
- **Conditional logic / branching** — Workato `features/if-conditions.html`, Boomi branche/decision,
  MuleSoft `choice-router`. Dla v1 minimalne (filtr „tylko eventy z tego kalendarza").
- **Batch / pagination** — MuleSoft `batch-processing-concept`, Boomi flow control. Sync Drive =
  paginowany listing → batch upsert.
- **Scheduler** — Workato `features/scheduler.html` = cron-owe wyzwalanie. Nasz poll-sync.
- **Connector SDK / connector-builder** — Workato `developing-connectors/sdk.html`,
  Boomi `Building_connector_developer.html`, MuleSoft `connector-builder`. Wzorzec: connector to
  **deklaracja** (auth + obiekty + akcje), nie hardkod — to pozwala dodać 3. i 4. integrację tanio.
- **Files & attachments** — Workato `features/handling-files-and-attachments`, `workato-filestorage` —
  bezpośrednio relewantne dla Google Drive sync (streaming dużych plików, nie ładuj do pamięci).
- **MCP (nowy wzorzec, u wszystkich 3!)** — Workato `en/mcp/*`, MuleSoft `mulesoft-mcp-server`,
  Boomi `MCP_overview` / `Using_MCP_with_Agent_Designer`. Każdy iPaaS wystawia teraz konektory jako
  **narzędzia MCP dla agenta AI**. → Dla nas: connectory Consultify (Calendar/Drive) powinny być od
  startu wystawialne jako tools dla Teresy, nie tylko jako sync w tle. To jest strategiczny zwrot rynku.

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
**Uwaga dot. dostępu:** pliki w `Softs/` były w tej sesji niedostępne do odczytu treści (macOS TCC
blokuje `open()` na całym drzewie `Documents/` poza repo; działa tylko `stat`/`listdir`). Brief oparto na
pełnej **mapie sitemap** każdego vendora (odczytanej przez listing katalogów) + wiedzy domenowej o
Workato/MuleSoft/Boomi. Pełny tekst stron dociągnąć online przy implementacji (docs.workato.com/en,
docs.mulesoft.com, help.boomi.com). `Boomi2` = pusty. Brak realnych zrzutów UI w pakietach.

# Table Platform — Final Wiring Plan

## Cel: Podłączenie wszystkich zbudowanych komponentów do UI + integracja czatu z budowaniem tabel

Data: 2026-03-15  
Status: READY FOR EXECUTION  
Bazuje na: audyt kodu z 2026-03-15, wyniki eksploracji agentów

---

## Stan obecny — co jest zbudowane ale NIE podłączone

| Komponent | Backend | Frontend | Podłączony do UI? |
|-----------|---------|----------|-------------------|
| ChatToSchemaPanel | ✅ pełny pipeline | ✅ panel z approve/reject/refine/undo | ❌ brak przycisku, `showChatToSchema` nigdy nie ustawiane na `true` |
| useSchemaProposal | ✅ 6 endpointów | ✅ hook gotowy | ❌ hook nieużywany (bo panel nie renderowany) |
| UnifiedChatPanel → tabele | ❌ brak integracji | ❌ czat nie rozpoznaje intencji "stwórz tabelę" | ❌ |
| AITableAssistant | ✅ legacy API | ✅ działa | ⚠️ używa starego backendu, nie Table Platform |
| useTableRealtime | ✅ RealtimeService + Socket.IO | ✅ hook gotowy | ❌ hook nigdzie nie zaimportowany |
| PresenceIndicators | — | ✅ komponent gotowy | ❌ nie renderowany |
| ChartBlock + ChartConfigPanel | — | ✅ komponenty gotowe | ❌ nie w ViewRouter, nie w IdeaTableTool |
| InterfaceDesigner | ✅ 9 endpointów | ✅ komponent gotowy | ❌ nie renderowany |
| Governed Models | ❌ brak kodu | ❌ | ❌ |
| E2E testy | — | — | ❌ zero testów Playwright |

---

## Architektura agentów

```
                    ┌─────────────────────┐
                    │   KOORDYNATOR (Ja)   │
                    │  Nadzór, review,     │
                    │  merge, raport       │
                    └──────────┬──────────┘
                               │
        ┌──────────┬──────────┼──────────┬──────────┬──────────┐
        │          │          │          │          │          │
   ┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐
   │ AGENT 1 ││ AGENT 2 ││ AGENT 3 ││ AGENT 4 ││ AGENT 5 ││ AGENT 6 │
   │Chat-to- ││Unified  ││Legacy   ││Charts + ││Governed ││  E2E    │
   │Schema UI││Chat     ││Bridge + ││Interface││Models + ││  QA     │
   │         ││Integr.  ││Realtime ││Designer ││Connectors│         │
   └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

---

## AGENT 1: ChatToSchemaPanel → UI Wiring

**Cel:** Użytkownik może otworzyć ChatToSchemaPanel z toolbara tabeli i budować/modyfikować schemat tabeli przez NL.

### Zadania:

| # | Zadanie | Pliki |
|---|---------|-------|
| 1.1 | Dodać przycisk "AI Schema" w toolbarze (obok Import) z ikoną Sparkles | `IdeaTableTool.tsx` (linia ~1375) |
| 1.2 | Renderować `<ChatToSchemaPanel>` w JSX gdy `showChatToSchema === true` | `IdeaTableTool.tsx` (sekcja overlays, ~linia 2280) |
| 1.3 | Przekazać `workspaceId={ideaId}`, `existingSchema` z effectiveColumns, `onExecuted` callback | `IdeaTableTool.tsx` |
| 1.4 | W `onExecuted` callback: odświeżyć dane tabeli (wywołać `platformIntegration.reload()` lub `loadData()`) | `IdeaTableTool.tsx` |
| 1.5 | Dodać skrót klawiszowy `Ctrl+Shift+S` do otwarcia panelu | `IdeaTableTool.tsx` |

### Kryteria akceptacji:
- Przycisk "AI Schema" widoczny w toolbarze
- Kliknięcie otwiera ChatToSchemaPanel
- Wpisanie "stwórz tabelę CRM z polami: nazwa, email, status" generuje propozycję
- Approve propozycji tworzy tabelę/pola w Table Platform
- Dane odświeżają się po wykonaniu

---

## AGENT 2: UnifiedChatPanel → Table Platform Integration

**Cel:** Użytkownik może z głównego czatu powiedzieć "stwórz mi tabelę do śledzenia projektów" i dostać gotową tabelę.

### Zadania:

| # | Zadanie | Pliki |
|---|---------|-------|
| 2.1 | Dodać rozpoznawanie intencji "table" w `UnifiedChatPanel` — regex dla PL+EN: "stwórz tabelę", "create table", "zbuduj tabelę", "build a table" | `UnifiedChatPanel.tsx` |
| 2.2 | Gdy wykryta intencja "table": zamiast streamować do AI, wywołać `TablePlatformApi.generateSchemaProposal()` z treścią wiadomości | `UnifiedChatPanel.tsx` |
| 2.3 | Wyświetlić propozycję schematu jako specjalną wiadomość czatu z przyciskami Accept/Reject/Refine | `UnifiedChatPanel.tsx` lub nowy `ChatTableProposalMessage.tsx` |
| 2.4 | Accept → `executeSchemaProposal()` → wyświetlić link "Otwórz tabelę" prowadzący do workspace z nową tabelą | `UnifiedChatPanel.tsx` |
| 2.5 | Refine → pokazać input do doprecyzowania → `refineSchemaProposal()` → zaktualizować propozycję | `UnifiedChatPanel.tsx` |
| 2.6 | Dodać obsługę w `handleSendMessage` — przed `startStream()` sprawdzić czy to intencja tabelowa | `UnifiedChatPanel.tsx` |

### Kryteria akceptacji:
- Wpisanie "stwórz tabelę do śledzenia projektów" w głównym czacie generuje propozycję
- Propozycja wyświetla się jako karta z listą tabel/pól
- Accept tworzy tabelę i pokazuje link
- Refine pozwala doprecyzować

---

## AGENT 3: Legacy Bridge + Realtime + Presence

**Cel:** Przepiąć AITableAssistant na nowy backend + włączyć realtime collaboration.

### Zadania:

| # | Zadanie | Pliki |
|---|---------|-------|
| 3.1 | W `AITableAssistant.handleSubmit`: gdy `usePlatform === true`, zamiast `Api.getIdeaAITableAction` wywołać `TablePlatformApi.generateSchemaProposal` | `AITableAssistant.tsx` |
| 3.2 | Zmapować odpowiedź z nowego backendu na istniejące akcje (sort/filter/add_column/generate_table) | `AITableAssistant.tsx` |
| 3.3 | Zaimportować i wywołać `useTableRealtime` w `IdeaTableTool.tsx` | `IdeaTableTool.tsx` |
| 3.4 | Renderować `<PresenceIndicators>` w headerze tabeli, przekazując `presence` z hooka | `IdeaTableTool.tsx` |
| 3.5 | Podłączyć `emitCellFocus` do `onCellClick` i `emitCellUpdate` do `onCellChange` | `IdeaTableTool.tsx` |
| 3.6 | Dodać `<CellPresenceIndicator>` do renderowania komórek (gdy inny user edytuje) | `IdeaTableTool.tsx` lub `PlatformCellRenderer.tsx` |

### Kryteria akceptacji:
- AITableAssistant korzysta z nowego backendu gdy feature flag włączony
- Avatary obecnych użytkowników widoczne w headerze tabeli
- Kolorowe ramki na komórkach edytowanych przez innych

---

## AGENT 4: Charts + Interface Designer → UI

**Cel:** Podłączyć ChartBlock jako widok tabeli + udostępnić InterfaceDesigner.

### Zadania:

| # | Zadanie | Pliki |
|---|---------|-------|
| 4.1 | Dodać `'chart'` do listy typów widoków w `ViewConfigPanel.tsx` | `views/ViewConfigPanel.tsx` |
| 4.2 | Dodać case `'chart'` w `ViewRouter.tsx` renderujący `<ChartBlock>` + `<ChartConfigPanel>` | `views/ViewRouter.tsx` |
| 4.3 | Przekazać `records` i `fields` do ChartBlock z effectiveNodes/effectiveColumns | `views/ViewRouter.tsx` |
| 4.4 | Dodać przycisk "Interface Designer" w toolbarze tabeli (obok Summary) | `IdeaTableTool.tsx` |
| 4.5 | Renderować `<InterfaceDesigner>` w overlay/modal gdy `showInterfaceDesigner === true` | `IdeaTableTool.tsx` |
| 4.6 | Przekazać `baseId` i `workspaceId` do InterfaceDesigner | `IdeaTableTool.tsx` |

### Kryteria akceptacji:
- Użytkownik może przełączyć widok na "Chart" i zobaczyć wykres
- Chart konfigurowalny (typ, osie, agregacja)
- Interface Designer dostępny z toolbara
- Można dodawać bloki (table_grid, chart, text, summary)

---

## AGENT 5: Governed Models Foundation + Connector UI Polish

**Cel:** Stworzyć fundament Governed Models (KPI, trust flags) + upewnić się że connectors działają.

### Zadania:

| # | Zadanie | Pliki |
|---|---------|-------|
| 5.1 | Stworzyć `server/migrations/713_governed_models.sql` — tabele: `tp_governed_models`, `tp_kpi_definitions`, `tp_dimensions`, `tp_model_sources` | Nowa migracja |
| 5.2 | Stworzyć `server/src/services/tablePlatform/GovernedModelService.ts` — CRUD modeli, KPI definitions, trust flags | Nowy serwis |
| 5.3 | Dodać routes: `POST/GET /bases/:baseId/governed-models`, `POST /governed-models/:id/kpis`, `GET /governed-models/:id/kpis` | `table-platform.routes.ts` |
| 5.4 | Dodać `trust_flag` (boolean) do `tp_connectors` i `tp_record_provenance` | Migracja SQL |
| 5.5 | W `ConnectorWizard` — upewnić się że wizard działa end-to-end (test manualny via API) | `connectors/ConnectorWizard.tsx` |
| 5.6 | Dodać `ProvenanceBadge` do renderowania komórek z danymi z connectorów | `PlatformCellRenderer.tsx` |

### Kryteria akceptacji:
- Tabele governed models istnieją w DB
- API CRUD dla governed models działa
- Trust flag widoczny w provenance badge
- Connector wizard tworzy connector i uruchamia sync

---

## AGENT 6: E2E Tests + Smoke Tests + Final QA

**Cel:** Napisać testy Playwright dla kluczowych flow + smoke testy API.

### Zadania:

| # | Zadanie | Pliki |
|---|---------|-------|
| 6.1 | Stworzyć `tests/e2e/table-platform/chat-to-schema.spec.ts` — test: otwórz tabelę → kliknij AI Schema → wpisz komendę → approve → sprawdź że tabela ma nowe pola | Nowy plik |
| 6.2 | Stworzyć `tests/e2e/table-platform/views.spec.ts` — test: przełącz widok na kanban/calendar/chart → sprawdź renderowanie | Nowy plik |
| 6.3 | Stworzyć `tests/e2e/table-platform/crud.spec.ts` — test: dodaj rekord → edytuj → usuń → sprawdź | Nowy plik |
| 6.4 | Stworzyć `tests/api/table-platform-smoke.test.ts` — smoke test: create base → create table → create field → create record → list records → delete | Nowy plik |
| 6.5 | Uruchomić pełny test suite (vitest + playwright) i naprawić błędy | Istniejące pliki |
| 6.6 | Raport końcowy: lista wszystkich podłączonych komponentów + coverage | Raport |

### Kryteria akceptacji:
- Minimum 3 E2E testy przechodzą
- Smoke test API przechodzi
- Zero regresji w istniejących testach
- Raport z listą podłączonych komponentów

---

## Zależności między agentami

```
Agent 1 (ChatToSchema UI)  ──┐
Agent 2 (UnifiedChat)        ├── niezależne, mogą działać równolegle
Agent 3 (Legacy + Realtime)  │
Agent 4 (Charts + Interface) │
Agent 5 (Governed Models)   ──┘
                              │
                              ▼
                    Agent 6 (E2E QA) — po zakończeniu 1-5
```

Agenci 1-5 działają równolegle. Agent 6 startuje po zakończeniu wszystkich.

---

## Metryki sukcesu

| Metryka | Target |
|---------|--------|
| ChatToSchemaPanel dostępny z UI | ✅ |
| UnifiedChatPanel tworzy tabele | ✅ |
| AITableAssistant na nowym backendzie | ✅ |
| Realtime presence widoczny | ✅ |
| Chart view w ViewRouter | ✅ |
| InterfaceDesigner dostępny | ✅ |
| Governed Models API | ✅ |
| E2E testy | ≥3 passing |
| Smoke test API | passing |
| Zero regresji | ✅ |

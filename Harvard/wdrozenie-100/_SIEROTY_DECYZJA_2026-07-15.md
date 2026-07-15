# SIEROTY DECYZJA — 2026-07-15

Trzy komponenty oznaczone `// ORPHAN 2026-07-15` w commit `55f3561862` czekają na decyzję Piotra: remove vs wpięcie.

## Spis sierot

| Plik | Co robi | 0 importerów | Historia | Rekomendacja |
|---|---|---|---|---|
| `src/components/MyWork/mindmap/WebhookSettings.tsx` | Konfiguracja webhooków dla zdarzeń mindmapy (node_added/deleted/edited, ai_action, status_change, comment_added, map_exported); storage w localStorage; dispatch mm-webhook-trigger events. Gotowy komponent, pełna funkcjonalność (load/save/trigger webhooks). | ✓ Potwierdzone grep (0 importerów poza samym plikiem) | Commit `fb85ba9547` (i18n mindmap batch 4/6); ostatni mark `55f3561862` (oznaczenie orphan). Sierota powstała w ramach mechaniki webhooków, nigdy nie wpięta do UI. | **REMOVE** — mechanika gotowa, ale UI-callback nigdy nie wdrażano; zero popytu. |
| `src/components/MyWork/notebook/KnowledgePulse.tsx` | Komponent pulsu wiedzy do wstawienia referentów (Initiatives/Tasks/Decisions) w notatkach; obca `PulseItemPickerModal`; obsługa insert/open + event track. Gotowy kod, pełna implementacja. | ✓ Potwierdzone grep (0 importerów; komentarz w MyWorkHub.tsx:1232 tylko wzmianka, nie importu) | Commit `c5afe15169` (lint sweep); ostatni mark `55f3561862` (orphan). Komponenta powstała jako feature do knowledge-graphs, nigdy nie zaintegromana z notebookiem. | **REMOVE** — feature complete, ale bez integracji UI; pode decyzji Piotra jeśli pomysł wróci. |
| `src/components/MyWork/table/SnapshotManager.tsx` | Panel CRUD do snapshoty bazy: create, list, restore, delete snapshoty z confirmami, error-handling, loading states. Gotowy komponent, pełna logika. | ✓ Potwierdzone grep (0 importerów) | Commit `d141349b07` (i18n table cz.2: SnapshotManager); ostatni mark `55f3561862` (orphan). Sierota powstała jako feature snapshot-management, nigdy nie ekspozowana w bazie/tabeli. | **REMOVE** — mechanika gotowa, ale zero UI-callback; funkcja zaplanowana ale nie wdrażana. |

## Werdykt
Wszystkie 3 to **feature-complete komponenty, ale bez konsumenta UI**. Powstały w ramach sweep'ów i planów (webhook-events, knowledge-pulse, snapshot-restore), ale nigdy nie wdrażano integracji obsługowych.

**Rekomendacja ogólna:**
- Jeśli Piotr chce te feature'y (webhooks, pulse, snapshots) — wpięcie wymaga: (1) ekspozy UI, (2) consumer-routing, (3) scenariusz user-flow. **Aktualne priority = LOW** (nie na drodze do Vegas/beta).
- Jeśli nie — **czyste rm** (deduplikuje `chore(deadcode)` w każdej kolejnej przemianie).

Decyzja pozostawiona dla Piotra w sekcji D-24 KONSTYTUCJI (mechanika vs feature-flag).

---
doc_id: cross-module-final-consistency-audit
truth_type: verified-as-is-and-target
status: canonical
owner: codex
business_owner: piotr
last_reviewed: 2026-07-31
---

# Końcowy audyt spójności modułów

## Werdykt

Dokumentacja opisuje jeden spójny produkt, lecz kod nadal zawiera kilka historycznych światów. Największe ryzyko nie polega na braku ekranów, tylko na równoległych nazwach, modelach danych, lifecycle i właścicielach zapisu. Werdykt: `FIX BEFORE GOLDEN FLOW ACCEPTANCE`.

## Macierz rozstrzygnięć

| Obszar | Stan kodu | Kanon docelowy | Zasada migracji |
| --- | --- | --- | --- |
| Finance | `/finance` i kompatybilne `/economics`, `MODULE_ECONOMICS`, komponenty `Economics/*` | UI/domena: `Finance` | zachować aliasy i identyfikatory DB do czasu mapy zależności; nowe UI/API wyłącznie Finance |
| Results/KPI | `/benefits`, `/kpi-okr` redirect, `MODULE_BENEFITS`, komponenty Benefits i Results | menu: `Results`; KPI/OKR i benefit realization są jego funkcjami | jeden owner API; stare trasy jako redirect, nie drugi store |
| Materials | DocumentStudio, Reports, Presentations, table platform, Outputs i artifact registry | jeden Materials Library + wspólny Artifact envelope | adaptery formatów; Outputs oznacza immutable wynik metody, nie drugi magazyn materiałów |
| Tools | `DiscoveryTools`, known tools, tool stores i scaffolds | UI: `Tools`; pięć powierzchni Library/Processes/Outputs/Reports/Initiatives | jeden Tool Session lifecycle; SWOT flow jako referencja |
| Assessment | stare AppViews i osobne edytory DRD/SIRI/ADMA | wspólny Assessment engine + method packs | DRD jako pierwszy E2E; edytory jako adaptery metody |
| Initiatives | wiele generatorów, konwersji i statusów | Candidate Draft → review → approved/scheduled → execution → results/closed | jeden initiative write service i state machine; wszystkie moduły tworzą Candidate z lineage |
| Execution | ExecutionHub, FullExecutionView, implementation/rollout i lokalne modele | lista aktywnych inicjatyw jako wejście; wspólny management spine | wybrać jeden shell i jeden lifecycle plan/task/risk/change |
| Teresa | action manifest, chat registry/handler, lokalne AI buttons i modułowe generatory | jeden Tool/Action Registry z klasą read/draft/propose/approved-write | lokalne przyciski delegują do wspólnego action contract |
| Canvas | WorkCanvas, Kimi/Artifact runtime, Idea canvases i edytory | jeden Artifact Host; typowe adaptery i wspólny handoff | nie scalać silników na siłę; scalić envelope, host SDK, approval i persistence |
| role | globalne role, ProtectedRoute i lokalne warunki | app role + admin capability + project role + scope | backend egzekwuje; UI jest projekcją effective access |
| status | lokalne stringi/enums | state machine per owner domeny + mapowanie prezentacyjne | zakaz tłumaczenia etykiety na osobny status danych |

## Wspólny język danych

- `Artifact`: duży wynik pracy z rodziną, wersją, statusem, ownerem, visibility, source lineage i approval.
- `Output`: zatwierdzony, nieedytowalny rezultat sesji Tools/Assessment/Audit; może materializować Artifact.
- `Report`: narracyjny Artifact utworzony na podstawie Outputów/danych.
- `Candidate Initiative`: pierwszy draft zmiany z lineage; nie jest jeszcze Initiative widoczną szerokiemu zespołowi.
- `Initiative`: zatwierdzony obiekt zarządzania zmianą.
- `Execution`: realizacja zatwierdzonej Initiative; nie tworzy drugiej inicjatywy.
- `Result/KPI`: pomiar efektu; ukończenie tasków nie oznacza osiągnięcia wyniku.
- `Decision` i `Task`: wspólne obiekty operacyjne linkowane, a nie kopiowane w modułach.

## Spójny lifecycle

`evidence/input → session/work → quality review → immutable output → report/material → candidate initiative → initiative approval → execution → result/KPI → corrective loop`.

Finance może wejść przed decyzją Initiative oraz wrócić po realizacji jako post-investment review. Chat, My Work i Teresa są powierzchniami pracy nad obiektami właścicielskimi, nie ich alternatywnymi bazami.

## P0 niespójności

1. Finance/Economics i Results/Benefits — nazwa, route, module flag i API owner.
2. Jeden Artifact envelope oraz rozdział Output/Report/Material.
3. Jeden Initiative Candidate generator i write path.
4. Jeden initiative/execution/results golden thread z identyfikatorami, nie tekstowymi kopiami.
5. Jeden registry działań Teresy i approval class.
6. Effective access z project role/scope.
7. UI Gate 0 na każdej dotkniętej powierzchni.

## Zasada kompatybilności

Nie wykonujemy masowych rename ani kasowania historycznych tras. Najpierw kanoniczny owner i adapter/redirect, potem telemetria użycia starego toru, następnie migracja konsumentów, a dopiero na końcu archiwizacja.

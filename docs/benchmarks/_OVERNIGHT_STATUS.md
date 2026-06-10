# Benchmark — raport końcowy nocnej dystylacji (2026-06-09 → 06-10)

> TL;DR: **UKOŃCZONE.** 16 briefów zdystylowanych z realnej treści, 44 prawdziwe zrzuty,
> surowiec 35 GB w Koszu. SSOT statusu: [README.md](README.md).

## Co zrobione
1. **Audyt + sprzątanie Fazy 1:** −3,5 GB bezspornego balastu (kopie językowe PDF, ciężkie GIF-y, 156 katalogów trackerów). Log: `Softs/_AUDIT/08_DELETED_LOG.txt`.
2. **Dystylacja (2 tury):** tura 1 — szkielety wszystkich briefów; tura 2 (po przywróceniu Full Disk Access dla app Claude) — **upgrade każdego briefu z realnej treści scrapów** + 44 zrzuty do `assets/`. Każdy agent potwierdzał/korygował twierdzenia względem faktycznych docs.
3. **Agresywne sprzątanie:** cały surowiec (20 katalogów, 35 GB) → Kosz `~/.Trash/Softs_distilled_raw_2026-06-10/`. Manifest: `Softs/_AUDIT/09_TRASHED_MANIFEST.txt`. `Softs/` to teraz 140K (same logi `_AUDIT`).

## Odzysk dysku — 1 akcja dla Ciebie
**Opróżnij Kosz**, by odzyskać ~35 GB. (Albo zostaw — macOS sam wyczyści po 30 dniach.)
Cofnięcie: w Koszu zaznacz folder `Softs_distilled_raw_2026-06-10` → „Put Back" / przeciągnij.

## Jakość briefów (grounding)
Pełna tabela w README. W skrócie: **13 scrape-grounded**, 3 partial (`whiteboard` — tldraw JS-renderowany; `calendar-meeting` i `realtime-collab` — źródła to API-docs/artykuły, nie UI). Wszystkie 16 mają sekcję decyzji „✅ kradniemy / ❌ unikamy" i model danych.

## Najcenniejsze wnioski produktowe (wyciąg)
- **Ideas (whiteboard/process-flow/mind-map/tables):** jeden wspólny **rekordowy model z bindingami po id** (tldraw store + Lucid `BlockEndpoint`/`linkX/linkY` + Miro `parentId`) — drzewo Mind Map = podzbiór grafu Process Flow. Nie monolityczny JSON.
- **chat-and-ai:** Kimi = wzorzec split-view czat↔żywy artefakt + checklista + ślad narzędzi; Anthropic/OpenAI = wiadomość jako typowane bloki + tool-use JSON-Schema + Structured Outputs (koniec parsowania markdownu).
- **kpi-insights:** twardy rozdział **KPI (health/BAU) vs Key Result (change)** (Perdoo) + schemat karty KPI 1:1 z Quantive + semantyczna warstwa metryki (Looker LookML).
- **enterprise-aip:** Ontologia Palantir (Data·Logic·Action·Security) + „LLM proposes, system disposes" — framing dla Teresy nad typowanymi obiektami klienta (anty-halucynacja, write-back jako akcje).
- **realtime-collab:** Faza 1 Liveblocks (na modelu Yjs, by Faza 2 = self-host była migracją transportu); webhook `StorageUpdated` throttlowany 60 s → mirror do Postgres near-real-time.
- **presentations:** kontrakt Generate API + Create-from-Template Gammy jako kształt naszego Presentation Studio; krok outline przed generacją (anty-halucynacja).

## Następne kroki (gdy zechcesz)
- Wpiąć briefy w realny rozwój modułów (zacząć od aktywnych: Ideas + Canvas/chat).
- Rozważyć: `tables.md` → sformalizować jako `matrix-editor-standard.md` (obiecany w TABLE_AND_PREVIEW_CANON).
- Opróżnić Kosz (odzysk 35 GB).

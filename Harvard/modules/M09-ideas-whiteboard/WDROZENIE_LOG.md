# M09 — Ideas — Whiteboard — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | Faza-4-deep API: CLEAN — 0 bugów API | — | 22 trasy zweryfikowane live; bigint/jsonb/boolean wszystkie OK; adapter PG działa | ✅ |
| 2026-06-21 | Live-pass | **BUG: Loading-hang** — re-entrant `refresh()`/`hydrate()` zalewały backend ~1k pending GET /map → tablica wisiała na skeletonie | `49faf9ce9e` | in-flight guard w workspaceGraphRuntime + IdeaWhiteboardTool; live: 996 pending → 8 GET wszystkie 200, board ładuje | ✅ |
| 2026-06-21 | Live-pass | **BUG: Create dropdown clipped** — toolbar `overflow-x-auto`→`overflow-y:auto` przycinał menu „Create"; itemy (8 kolorów sticky, Circle/Diamond/Hexagon, Image, Link, Frame) NIEKLIKALNE; warianty kształtów osiągalne TYLKO z tego menu | `f19db45aff` | portal do `document.body` + `position:fixed`; live: wszystkie itemy `clickable:true`, Diamond tworzy shapeNode `{shape:'diamond'}` persist (v29) | ✅ |
| 2026-06-21 | Live-pass | **BUG: drawer edits 409-lost** — IdeaNodeDetailDrawer zapisywał przez graphRuntime (stały version-counter) → 409 vs nowsza wersja whiteboardu; semantic type/notes/context/goal/rationale/risk NIE zapisywały się (inspector wyglądał na działający) | `5eace79ff0` | save bezpośrednio przez `Api.syncMyIdeaMap` na autorytatywnej wersji + retry 1× na 409; live: Semantic=Risk persist (v44→45) | ✅ |
| 2026-06-21 | Live-pass | §2 Node types — sticky/text/shape(rect+diamond)/frame/image/link | (powyższe) | wszystkie 6 typów utworzone z UI **i** persist na serwerze (mapa v32, 7 węzłów, preferredTool=whiteboard) | ✅ |
| 2026-06-21 | Live-pass | §6 Edycja — label (dblclick), semantic type, resize | (powyższe) | label „Edited via dblclick" persist (v42); semantic Risk persist; NodeResizer (Shape/Text/Frame/Image, NIE sticky — by design) resize 160×80→40×40 min, persist po reload | ✅ |
| 2026-06-21 | Live-pass | §6 reszta — kolor istniejących węzłów | — | NIE przetestowane jeszcze (TODO) | ⏳ |
| 2026-06-21 | Live-pass | Tool-switch round-trip (whiteboard→mindmap→whiteboard) — bez utraty danych | `7` (conflict-recovery) | węzły przetrwały; toast „Change conflict detected. Refreshing map" self-heal (smell §C5 dual-ownership, ale bez data-loss) | ✅ |
| 2026-06-21 | Env | DB pool exhaustion od ciężkiego ruchu testowego (setki /map/sync + conflict loops) → getMe timeout, app wisi na spinnerze | — | restart backendu (`touch server/src/index.ts`) → health 0.84s→0.155s; NIE bug kodu, artefakt obciążenia dev DB ([[finding_staging_db_perf]]) | ✅ |

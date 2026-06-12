# M05 — Ideas — Zarządzanie — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | **FAZA 4-deep API (Fala 17)** | S1/S2/S3/S4 — pełne scenariusze API | `a26c119d7a` | **S1 lista PARTIAL→FIX**: 200 org-scoped, typy OK (priority=int, isFavorite=bool), ale filtr `?stage=`/`?area=` ignorowany → **BUG-M05-01 naprawiony** (params dodane do WHERE). **S2 detail+edit PARTIAL→FIX**: GET detail brakowało folderId/isFavorite/lastOpenedAt (rozbieżność vs lista) → **BUG-M05-02 naprawiony** (homeSelectDetail dodany). PUT trwałość OK, response niekompletny → **BUG-M05-03 naprawiony** (SELECT uzupełniony o stage/priority/area/branch/folderId/isFavorite/promoted_to/lineage). **S3 create PARTIAL→FIX**: 201 OK, response niekompletny → **BUG-M05-03 (POST)** naprawiony; folderId w body ignorowany → **BUG-M05-04 naprawiony** (INSERT dodany); DELETE 204 + GET 404 po usuniętiu PASS. **S4 foldery PARTIAL→FIX**: CRUD folderów i filter OK, POST `201` zamiast `200` → **BUG-M05-05 naprawiony**; brak `/my-ideas/tags` endpoint (observacja, nie naprawione). Brak bigint/jsonb bugs — typy liczb OK. tsc zielony. | ZROBIONE (API-deep, 5 bugów naprawionych) |

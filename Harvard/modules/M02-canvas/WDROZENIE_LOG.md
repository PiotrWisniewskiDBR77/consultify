# M02 — Canvas — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | Faza-4-deep API: PASS (14 scenariuszy) — brak bigint/jsonb/boolean bugów | — | Create 201, list 200, proposals 201/200, restore 200; IDOR guard działa | ✅ |
| 2026-06-12 | Fala-18 | BUG-M02-01: contentMd double-serialized dla 30/131 draftów (staging DB) | — | Wymaga DB backfill + guard w toDraft(); nie naprawione | ⚠️ backlog |
| 2026-06-12 | Fala-18 | BUG-M02-02/03/04: createDraft nie zapisuje content_md, duplikat content/contentMd, dirtyState | — | Zadokumentowane, nie naprawione | ⚠️ backlog |

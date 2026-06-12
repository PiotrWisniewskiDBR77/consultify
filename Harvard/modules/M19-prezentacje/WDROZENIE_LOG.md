# M19 — Prezentacje — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M19-03: analytics COUNT/AVG bigint/numeric string w presentations.routes.ts:5975 | `(pending commit)` | Number() wraps w analytics response | ✅ |
| 2026-06-12 | Fala-18 | BUG-M19-01: generacja zawieszona po restarcie serwera (runtimeState in-memory) | — | HIGH — wymaga recovery mechanizmu; nie naprawione | ⚠️ backlog |
| 2026-06-12 | Fala-18 | BUG-M19-02/04: błędy slajdów pochłaniane, lista draftów raw JSON strings | — | Zadokumentowane, nie naprawione | ⚠️ backlog |

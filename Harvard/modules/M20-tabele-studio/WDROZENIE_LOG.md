# M20 — Tabele Studio — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M20-02 IDOR: listBases bez org filter → cross-org enumeration | `a8c250ec72` | organizationId filter dodany do SQL + route; cross-org bases → 0 wyników | ✅ |
| 2026-06-12 | Fala-18 | BUG-M20-03: __created_by_name = UUID (brak kolumny name w users) | `a8c250ec72` | COALESCE(first_name‖last_name, email) → imię wyświetlane | ✅ |
| 2026-06-12 | Fala-18 | BUG-M20-01: /health wymaga tokena mimo komentarza no-auth | — | Zadokumentowane, nie naprawione | ⚠️ backlog |

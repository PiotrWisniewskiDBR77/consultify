# M18 — Dokumenty — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M18-01 P0: ensureSchema() 40+ DDL per request → crash pod load | `59a552651e` | `_schemaReady` singleton guard; DDL runs once per process | ✅ |
| 2026-06-12 | Fala-18 | BUG-M18-02/05: file_size_bytes null→0 + rate limiter dead code | — | Zadokumentowane, nie naprawione | ⚠️ backlog |
| 2026-06-12 | Fala-18 | BUG-M18-03/04: betaGate bez bypassu + highRiskSurfaceGuard klasyfikuje GET jako export | — | Zadokumentowane; TRIAL upload/download locked by design | ⚠️ backlog |

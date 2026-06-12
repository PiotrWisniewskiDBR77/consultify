# M15 — Rezultaty — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M15-02 CRITICAL: COALESCE(is_global,0) crash — 500 na /metrics-semantic-layer | `a8c250ec72` | COALESCE(is_global,FALSE) + is_active=TRUE; endpoint 200 | ✅ |
| 2026-06-12 | Fala-18 | BUG-M15-01: totalKpis/totalEntries/total bigint string w resultsROIService | `a8c250ec72` | Number() wraps; dashboard counts numeric | ✅ |
| 2026-06-12 | Fala-18 | BUG-M15-03/04/05/06/07: 5 medium bugs (HTTP 200→201, plan field, non-ISO dates, 500→400) | — | Zadokumentowane, nie naprawione | ⚠️ backlog |

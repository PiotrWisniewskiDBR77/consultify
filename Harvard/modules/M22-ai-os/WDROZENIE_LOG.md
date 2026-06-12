# M22 — AI OS / Internal Tools — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M22-01 P1: cost_usd nie istnieje w ai_usage_logs → 500 /costs | `a8c250ec72` | cost_usd→estimated_cost_usd wszędzie; /costs 200 | ✅ |
| 2026-06-12 | Fala-18 | BUG-M22-02/04: COUNT/SUM bigint string w analytics usage + performance | `a8c250ec72` | Number() wraps dla all COUNT/SUM fields | ✅ |
| 2026-06-12 | Fala-18 | BUG-M22-03: userUsage/dailyTrends puste przez cost_usd error | `a8c250ec72` | Naprawione razem z M22-01 | ✅ |
| 2026-06-12 | Fala-18 | BUG-M22-05: getUserCostHistory cost_usd w aiSettingsService | `a8c250ec72` | estimated_cost_usd; history nie pusta | ✅ |

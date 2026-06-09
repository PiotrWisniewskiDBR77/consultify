# Weryfikacja wdrożenia napraw po audycie — 2026-06-09 18:47Z

Metoda: empiryczna (logi prod + DB prod + endpointy + git), nie z pamięci.
Stan repo: branch `qa/remediation-2026-06-08` na origin (HEAD `d49bd61b43`), **NIEzmergowany do `Londyn`**, ale **zadeployowany na PROD** (`railway up`, deploy SUCCESS 2026-06-09 06:54 CEST). Zawiera moje 7 fixów + prace 2. agenta (#20 redakcja `/api/users`, backlog #5/#6/#10/#11/#17/#21/#23/#24, UI czatu).

## ✅ Zweryfikowane LIVE na PROD (twardy dowód)
| Fix | Dowód |
|-----|-------|
| Migracja schematu (token-accounting, ai_policies, ai_user_style_profiles, sso, user_status) | zero `does not exist` w logach; kolumny/tabele obecne |
| Token-accounting INSERT | `ai_usage_logs` rośnie (0→3 wiersze), `status=success` |
| FIX-3 ModelRouter `integer=boolean` | zero `integer = boolean` / `Failed to get models` w logach |
| BUG-21 web-vitals | PROD `POST /api/analytics/web-vitals` → **401** (było 404) |
| BUG-16 i18n mobile | PROD `en.sidebar.module3_1` = „Initiatives" |
| Stabilność | health 200; cały dzień ruchu (czat 13:15Z), zero crashy/5xx |

## ✅ Zadeployowane (kod w prod-buildzie), weryfikacja behawioralna PENDING
Wymagają konta **USER** (nie-admin) lub sesji w przeglądarce — kod potwierdzony obecny + deploy zaszedł:
| Fix | Jak domknąć |
|-----|-------------|
| BUG-18 PII gate (`/manager/*` RBAC) | USER→403, ADMIN→200 (mam tylko ADMIN: 201 na czacie potwierdza, że nie blokuje uprawnionych) |
| #20 (2. agent) redakcja email/last-login z `/api/users` dla nie-adminów | GET `/api/users` jako USER → brak email/last-login |
| BUG-02/15 voice 403-fallback | konto ze stale org → voice startuje (czat tekstowy jako admin: 201 ✓) |
| BUG-22 commandDock | My Work bez crasha (zweryfikowane na staging — ten sam kod) |
| BUG-14 breaker | normalna nawigacja bez kaskady 429 |
| 2. agent backlog #5/#6/#10/#11/#17/#21/#23/#24 | zakres Fazy 4 / 2. agenta |

## ⚠️ OTWARTE — nowy follow-up (NIE pozycja audytu, ale ważne)
**Liczniki tokenów = 0** w `ai_usage_logs` (wszystkie wiersze, też PO deployu FIX-3: `in=0 out=0`, `provider=deepseek`). Czyli: zapis działa, ale **wolumen tokenów nie jest liczony** → przy modelu AI Credits dla 131 userów śledzenie kosztów wciąż ślepe na zużycie. To osobny bug ekstrakcji usage (niezależny od schematu i ModelRoutera). **Rekomendacja: pilny follow-up przed skalowaniem.**

## 📌 Stan procesowy
- Branch **nie zmergowany do `Londyn`** — prod działa z brancha `qa/remediation` (deploy `railway up`). Do uporządkowania: merge → `Londyn` jako źródło prawdy.
- Faza 3 (hardening runnera migracji) — nadal otwarta (root cause driftu).

## Werdykt
**Naprawy po audycie SĄ wdrożone na produkcję** (deploy 06:54 CEST). Rdzeń potwierdzony live (schemat, ModelRouter, web-vitals, i18n, ewidencja-INSERT). Do pełnego „GREEN" brakuje: (1) weryfikacja behawioralna kontem USER (PII/redakcja/voice — Faza 4), (2) **fix liczników tokenów = 0**, (3) merge do Londyn + Faza 3.

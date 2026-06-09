# Faza 4 — Test plan: post-deploy GO-gate (prod) + rollout etapowy

Cel: po **skoordynowanym deployu kodu na prod** (remediation + #20 + rebuild 2. agenta) potwierdzić, że fixy działają i nic się nie zepsuło — ZANIM wpuścimy 131 osób VTS. Model jak dotąd: **agent w przeglądarce klika role, ja obserwuję backend (Railway logs + DB)**.

## Wymagane konta (krytyczne — bez nich część testów niewykonalna)
- **VTS USER** (zwykły, nie-admin) — do testów RBAC/PII.
- **VTS ADMIN/OWNER** — do potwierdzenia, że bramki nie blokują uprawnionych.
- (Opcjonalnie) konto z **nieaktualnym org context** (po opuszczeniu org) — do testu fallbacku #20.

## Brama: PRZED deployem (T-0)
- [ ] Backup prod zrobiony (pod rollback kodu).
- [ ] Integration branch (mój + 2. agenta) zmerge'owany, zreviewowany (szczególnie auth `#20`).
- [ ] Tag/snapshot poprzedniego deployu prod (instant rollback).

## Krok 1 — Smoke po deployu (T+0, 5 min)
| Check | Jak | GO |
|-------|-----|-----|
| Boot czysty | `railway logs` env=production | brak FATAL/uncaught przy starcie |
| Health | `GET /api/health` | 200, db+redis connected |
| Brak błędów schematu | logi | zero `does not exist` |
| ModelRouter | logi po 1. czacie | brak `integer = boolean` / `Failed to get models` |
| web-vitals | `POST /api/analytics/web-vitals` | 204 (nie 404) |
| i18n mobile (EN, 768px) | UI | „Initiatives"/„More", nie PL |

## Krok 2 — Macierz weryfikacji fixów (każdy fix DZIAŁA na prodzie)
| Fix | Test (rola) | GO / dowód |
|-----|-------------|-----------|
| **BUG-18 PII** | USER → Execution > Management/Action Queue | **403** (brak cudzych zadań/nazwisk) |
| **BUG-18 PII** | ADMIN → to samo | **200**, widzi dane (gate nie blokuje uprawnionych) |
| **#20 / BUG-02/15 voice** | USER świeże logowanie → „Talk to Teresa" | rozmowa startuje, **brak 403** |
| **#20 fallback** | konto ze stale org → czat | rozwiązuje aktywną org, 200 (nie ORG_MEMBERSHIP_REVOKED) |
| **BUG-14 breaker** | normalna nawigacja + kilka tabów 5 min | **brak kaskady 429** |
| **BUG-22 My Work** | 3 różni userzy → My Work | renderuje się, 0 błędów konsoli `commandDock` |
| **AI token-accounting** | po kilku czatach → DB | wiersze w `ai_usage_logs` (zużycie ewidencjonowane) |
| **AI policies** | ADMIN → ustawienia AI org | brak błędów `internet_enabled/ai_policies` |

## Krok 3 — Audyt data-scoping / RBAC (motyw PII, szerszy niż #18)
USER vs ADMIN, dla każdego: czy USER widzi dane spoza zakresu? Moduły: Execution, Inicjatywy, Interview, Finance, Portfolio, KPI/OKR, My Work.
- [ ] Eskalacja przez URL: USER ręcznie na `/admin/*`, `/superadmin/*`, `/settings/billing` → backend 403 (nie tylko UI).
- [ ] IDOR: podmiana ID w `/api/conversations/:id`, `/api/initiatives/:id`, `/api/v8/interview/sessions/:id` → 403/404, nie cudze dane.

## Krok 4 — Regresja po przebudowie (rebuild 2. agenta nie zepsuł rdzenia)
Happy-path + zapis: Chat (tekst + voice), Interview, Inicjatywy (Kanban + create), My Work (Notebook/Tasks/Decisions zapis), Assessment, Deliverables (Document/Table/Presentation). Szukać 4xx/5xx, błędów zapisu, białych ekranów.

## Krok 5 — Rollout etapowy + monitoring (pilot 5–10 → 131)
Podczas pilotażu 24–48h obserwuj:
- Error rate (5xx), liczba 403 (czy USERzy nie są nadmiernie blokowani — false positive bramki).
- **Koszty/zużycie AI** (teraz widoczne w `ai_usage_logs`) — czy w normie dla 131 userów.
- Perf: `title/generate` i inne wolne endpointy (N+1, #9) pod realnym obciążeniem.
- Kaskady 429 (breaker) pod realnym ruchem.

## Kryteria ABORT (przerwij rollout / rollback)
- Jakikolwiek 5xx na głównej ścieżce (czat/auth) > pojedyncze incydenty.
- USER widzi cudze PII w którymkolwiek module (BUG-18 nie domknięty).
- Wzrost 403 blokujący uprawnionych (bramka za szeroka).
- AI usage nie zapisuje się / koszty wymknięte.
- Boot/health niestabilny po deployu.

## Format zgłoszeń
Jak dotąd: BUG-xx, severity, URL, kroki, oczekiwane/rzeczywiste, dowód (screenshot + console + network status + correlationId). Korelacja FE↔BE po czasie/correlationId.

# Dedup Manifest — branch `qa/remediation-2026-06-08` (pushed to origin)

Cel: jedyne źródło prawdy o tym, co JUŻ zrobione na moim branchu, żeby drugi agent / MASTER-REPAIR-PROGRAM nie dublował i nie kolidował. Branch jest **7 commitów przed `Londyn`, zero rozjazdu** → merge fast-forward.

## Kod — 7 plików (NIE pisać od nowa; jeden właściciel = ten branch)
| Plik | Bug | Co zrobione | Uwaga dla 2. agenta |
|------|-----|-------------|---------------------|
| `server/src/middleware/auth.middleware.ts` | BUG-02/15 (= ich **#20?**) | Serwerowy fallback org: gdy resolved org nie jest ACTIVE membership → użyj realnej aktywnej org usera zamiast 403 `ORG_MEMBERSHIP_REVOKED`. Fail-open na błąd DB. | **TO JEST WRAŻLIWY AUTH.** Jeśli #20 == to → NIE implementować ponownie. Jeśli #20 inny → ustalić JEDNEGO właściciela pliku. |
| `server/src/routes/v8/execution-control.routes.ts` | BUG-18 (PII) | `router.use('/manager', requirePermission('manage_workstreams'))` — USER→403, manager/admin→200. | Security-critical. Nie ruszać `/manager/*` bez koordynacji. |
| `server/src/services/ai/modelRouter.ts` | AI routing | `mta.is_active = true` → `= 1` (koniec `integer=boolean`). | Trywialny SQL fix, zrobiony. |
| `server/src/routes/analytics.routes.ts` | BUG-21 | `POST /api/analytics/web-vitals` → 204. | Route dodany. |
| `src/components/MyWork/Home/useHomeData.ts` | BUG-22 | default block `commandDock` + odporna normalizacja (zły blok → pominięty, nie crash). | Zrobione, zweryfikowane na staging (0 błędów konsoli). |
| `src/contexts/OrgContext.tsx` | BUG-02/15 (front) | Guard czyszczący nieaktualny `consultify_current_org_id`. | Część frontowa auth-fix. |
| `src/services/api.ts` | BUG-14 | Circuit breaker 2/8s/5min → 6/20s/45s (koniec self-DoS 429). | Zrobione. |
| `public/locales/{en,pl}/translation.json` | **BUG-16** | Klucze `sidebar.module3_1` (Initiatives/Inicjatywy) + `common.more` (More/Więcej). | **JUŻ NAPRAWIONE** — ich lista trzyma #16 jako P3, to dedup. |

## Baza danych — JUŻ ZASTOSOWANE (nie powtarzać)
| Środowisko | Stan |
|------------|------|
| **PROD** | Migracja addytywna zastosowana+zweryfikowana (2026-06-09 ~03:33Z): `users.user_status`, `ai_usage_logs.error_message`, `ai_policies` +7 kolumn + name→nullable, `ai_user_style_profiles`. Snapshot: `PROD-schema-snapshot-pre-migration.txt`. Health 200 po. |
| **STAGING** | Migracja + `railway up` (deploy brancha) + re-test ✅. |

Plik migracji (uniwersalny, idempotentny, przetestowany na obu): `server/migrations/2026-06-08_qa_schema_drift_catchup.sql`.

## NIEzrobione na tym branchu (wolne dla 2. agenta, zero kolizji)
- Deploy KODU na prod (`railway up` na env=production) — wstrzymany do okna z człowiekiem.
- Hardening runnera migracji (Faza 3) — żeby drift nie wrócił (root cause: runner oznacza migracje „applied" bez tworzenia obiektów, połyka SQLite-izmy).
- N+1 `title/generate` (#9 perf).
- BUG-17 (sidebar @375px), BUG-13 (live-verify; wg kodu to gating pilotażowy, nie bug).
- Weryfikacja PII gate kontem USER na org z v8 ON.

## Pliki, których 2. agent NIE powinien dotykać bez koordynacji (jeden właściciel)
`auth.middleware.ts`, `execution-control.routes.ts`, `OrgContext.tsx`, `api.ts`, `useHomeData.ts`, `analytics.routes.ts`, `modelRouter.ts`, `public/locales/*`, `server/migrations/2026-06-08_qa_schema_drift_catchup.sql`.

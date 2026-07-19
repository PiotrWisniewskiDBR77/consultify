# AUTH-SWEEP (E-AUTH-A) — klasyfikacja montaży routerów

Detektor: `server/scripts/auth-sweep-detector.mjs` (powtarzalny; `node server/scripts/auth-sweep-detector.mjs [--json]`).
Zakres: WSZYSTKIE `app.use('/api...', ...)` w `server/src/index.ts` + `server/src/Gateway.ts`.
Baza: `origin/demo` @ 740617c89c. Precedens dziury: `transactionReadiness` bez auth (finding 07-15).

## Jak działa detektor
Dla każdego montażu routera sprawdza kolejno:
1. **auth inline w montażu** — handler należy do zbioru auth (`gatewayVerifyToken`, `verifyToken`,
   `...internalToolsGuard` = `[gatewayVerifyToken, requireInternalToolsAccess]`, `highRiskSurfaceGuard(...)`,
   `orgMembershipGuard`).
2. **auth wewnątrz pliku routera** — `<router>.use(verifyToken)` (blanket, dowolna nazwa zmiennej: `router`,
   `v8Router`…) lub verifyToken na KAŻDEJ trasie (per-route).
3. **stub 503/404/501** — pojedynczy catch-all `router.use((req,res)=>res.status(503…))`; nie ujawnia danych.
4. **re-export delegacja** — `router.use(otherRouter)` gdzie `otherRouter` to inny plik routera (auth dziedziczy).
5. **webhook / test-support / public** — po prefiksie/nazwie.
Reszta → `HOLE?` do ręcznej weryfikacji.

## Wynik zbiorczy (po naprawie)
| Klasa | Liczba |
|---|---|
| PROTECTED (internal) | 211 |
| PROTECTED (inline) | 29 |
| PUBLIC-BY-DESIGN | 21 |
| STUB (503/404, no data) | 8 |
| REVIEW (partial internal auth) | 16 |
| PUBLIC-BY-DESIGN (webhook/HMAC) | 4 |
| PUBLIC-BY-DESIGN (test-only, env-guarded) | 2 |
| HOLE? (po ręcznej weryfikacji — patrz niżej) | 6 |

## DZIURA znaleziona i NAPRAWIONA w tym zadaniu
| Endpoint | Plik | Problem | Fix |
|---|---|---|---|
| `/api/skills-gap` (Gateway.ts:757) | `routes/skills-gap.routes.ts` | 4 trasy czytają dane per-org (`req.organizationId`/`req.user`: skills-gap per inicjatywa i kompetencja + zapis snapshotu) BEZ `verifyToken`. Bez auth osiągalne nieuwierzytelnione z pustym orgId — ta sama klasa co `transactionReadiness`. | Dodano `router.use(verifyToken)` (blanket, wszystkie 4 trasy org-scoped). Test 401: `tests/integration/routes/skills-gap.auth.routes.test.ts` — 4/4 GREEN. |

## HOLE? pozostałe 6 — ręczna weryfikacja
### Fałszywe alarmy detektora (NIE dziury, udowodnione)
- **`/api/ai` `aiDomainRoutes` (Gateway.ts:472)** — agregator (`routes/ai/index.ts`) montuje ~30 pod-routerów;
  detektor nie rekursuje. Zweryfikowane per-dziecko: WSZYSTKIE dzieci mają własny `router.use(verifyToken)`
  (ai-analytics/budgets/drafts/feedback/memory/nudges/settings/operations/coach/…) albo są 503-stubami
  (ai-security). Jedyny nieauth endpoint to statyczne `GET /ai/ai-prompts/capabilities` (lista feature-names,
  ZERO danych) — pod-router `ai-prompts` deleguje resztę do kanonicznego `routes/ai-prompts.routes.ts`
  (ma verifyToken per-trasa). **Werdykt: PROTECTED (dzieci samo-chronione).**
- **`/api/referrals` `referralsRoutes` (Gateway.ts:1160)** — jedna trasa `GET /` → `res.status(503)
  {status:'stub', module:'A1 Affiliate/Ecosystem'}`. Stub, zero danych (detektor pominął bo `router.get`
  a nie `router.use`). **Werdykt: STUB (503).**
- **`/api/table-platform` `tablePlatformFormPublicRoutes` (Gateway.ts:1108)** — udokumentowana JWT-tokenizowana
  PUBLICZNA powierzchnia formularzy (`/public/forms/jwt/:token` [+ `/submit`]); rate-limit, token w ścieżce,
  komentarz w pliku „NO AUTH on ... public form" (analogicznie do publicznych linków raportów). Osobny mount
  od głównego `tablePlatformRoutes` (ma auth). **Werdykt: PUBLIC-BY-DESIGN.**

### DO #13 (E-AUTH-B) — REVIEW (wątpliwe, wymagają decyzji): obserwowalność infra
- **`/api/performance` + `/api/ai/performance` `performanceRoutes` (Gateway.ts:1075, 473)** — metryki Prometheus
  (latency p50/p95/p99, throughput, error-rate). Ujawnia wewnętrzne infra, NIE dane tenanta.
- **`/api/performance-metrics` `performanceMetricsRoutes` (Gateway.ts:1074)** — runtime dla deploy-gate:
  uptime, pid, platform/arch, loadavg, memory (rss/heap), status DB. Info-disclosure host-internals,
  NIE dane usera/org. Docstring: „for deploy-gate observability" → prawdopodobnie celowo skrapowalne bez JWT.
  **Rekomendacja CTO:** analogiczne do `/api/health`+`/api/system` (public-by-design). Decyzja Piotra/CTO:
  zamknąć za auth (info-disclosure) czy zostawić dla pipeline'u deployu. NIE naprawione (niejednoznaczne).

## DO #13 (E-AUTH-B) — REVIEW: routery z CZĘŚCIOWYM auth (16)
Routery gdzie NIEKTÓRE trasy mają verifyToken a inne nie. Zwykle celowe (public GET + auth POST/mutacje),
ale każda wymaga per-trasa audytu żeby wykluczyć ukrytą dziurę:
`/api` shareRoutes(1/7) · `/api/access-codes`(4/5) · `/api/access-control`(7/9) ·
`/api/admin/model-registry`(2/13) · `/api/analytics/journey`(4/5) · `/api/feature-flags`(2/9) ·
`/api/feedback`(4/24) · `/api/help`(8/9) · `/api/invitations`(11/12) · `/api/kb`(2/8) ·
`/api/legal`(4/7 — public GET dokumentów) · `/api/llm`(39/85) · `/api/metrics`(8/12) ·
`/api/scim/admin` + `/api/scim/v2`(13/23 — SCIM ma własny bearer/token) · `/api/sso`(10/14) ·
`/api/webhooks` webhookRoutes(2/4).
Priorytet audytu #13: `/api/llm` (39/85 — 46 tras bez widocznego verifyToken, największa powierzchnia),
`/api/feedback` (4/24), `/api/admin/model-registry` (2/13).

## PUBLIC-BY-DESIGN potwierdzone (nie ruszać)
- `/api/public/*` (partner, outreach, report, mini-assessment, booking, anna, artifacts, contact,
  partner-applications, kb-v8, v1) · `/api/auth*` · `/api/health` · `/api/system*` · `/api/errors`
  (client error reporting) · `/api/demo` · `/api/legal` (public GET).
- **Webhooki (HMAC zamiast JWT):** `/api/webhooks` sellix (x-sellix-signature) · `/api/webhooks/v8-sync`
  (HMAC-SHA256 per-registration secret) · `/api/slack` (Slack signing secret). Weryfikacja podpisu = auth.
- **Test-only (env-guarded):** `/api/test-support` — montowany tylko przy `NODE_ENV==='test' &&
  ENABLE_TEST_SUPPORT==='true'`; poza tym `res.status(404)`.

## Znane ograniczenia detektora (świadome — kompensowane ręcznie powyżej)
1. Nie rekursuje agregatorów pod-routerów (aiDomainRoutes) — flaguje jako HOLE, weryfikacja ręczna.
2. Stub wykrywa tylko wzorzec `router.use(catch-all 503)`, nie `router.get('/',…503)` (referrals).
3. Śledzi re-export delegację tylko 1 poziom.
4. Nie modeluje kolejności prefix-guardów Express poza jawnym `app.use('/prefix', guard)` bez routera.

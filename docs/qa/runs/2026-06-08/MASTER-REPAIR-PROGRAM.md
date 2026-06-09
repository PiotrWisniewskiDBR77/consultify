# MASTER REPAIR PROGRAM — droga do GO dla rolloutu VTS (konsolidacja 2 agentów)

> Single source of truth łączący pracę obu agentów. Stan: 2026-06-09 ~05:30.
> Zasada (z REPAIR-PLAN): rollout VTS = NO-GO dopóki Faza 1 nie zielona.

## 0. Stan prawdy (gdzie co jest)
| Warstwa | Branch / ref | Zawiera | Status |
|---|---|---|---|
| **PROD (live)** | `Londyn` = `origin/Londyn` = `5c5788022e` | Moje fixy: **#12 membership (open-invite), #2 user_status, #4 require/ESM, #14/#15 i18n+modal, system wspólnego linku `/vts` + voice runtime + invite-event-log non-fatal** | ✅ wdrożone + zweryfikowane na prodzie |
| **Remediation (staging)** | `qa/remediation-2026-06-08` = `8556653853` (= Londyn + 6 commitów) | Praca 2. agenta: **FIX-1 (PII RBAC na `/manager/*` Execution), verifyToken stale-org fallback (BUG-02/15), migracja schema-drift catch-up, breaker/ModelRouter/web-vitals/i18n, OrgContext/api.ts** | ✅ staging done; **PROD PENDING** |
| ⚠️ Ryzyko | `origin/qa/remediation-2026-06-08` = **PUSTE** | praca 2. agenta jest **tylko lokalnie** | **niepushowane = ryzyko utraty** |

`qa/remediation-2026-06-08` = **SUPERSET** (moje prod-fixy są jego przodkiem + jego 6 commitów). To naturalne **jedyne źródło prawdy**.

## 1. 🔴 KOORDYNACJA — zrobić NAJPIERW (największe ryzyko, nie kod)
1. **PUSH `qa/remediation-2026-06-08` na origin natychmiast** — praca 2. agenta jest tylko lokalna; jeden reset/checkout = utrata. (`git push origin qa/remediation-2026-06-08`)
2. **JEDEN właściciel merge+deployu na prod.** Dwóch agentów deployujących na ten sam prod z różnych branchy = regresja. Od teraz: zero niezależnych `railway up --environment production`.
3. **Single source = `qa/remediation-2026-06-08`** (ma już moje prod-fixy + ich staging-fixy). Ścieżka na prod = ten branch, po backupie.

## 2. Macierz bug → fix → status (deduplikacja obu list)
| Bug | Fix | Warstwa | Stan |
|---|---|---|---|
| #12 ORG_MEMBERSHIP_REVOKED (brak membership na open-invite) | mój: INSERT organization_members | server | ✅ PROD |
| BUG-02/15 ORG_MEMBERSHIP_REVOKED (stale token-org) | ich: verifyToken fallback do ACTIVE org | server | staging → prod-pending. **Komplementarny do #12 — oba zostają.** |
| **#20 PII katalog** (`/organizations/:id/members`, `/api/users`) | **BRAK — patrz §3** | server | 🔴 **OPEN — luka** |
| BUG-18 PII Execution (`/manager/*` cudze zadania+nazwiska) | ich: FIX-1 `requirePermission('manage_workstreams')` | server | staging → prod-pending |
| drift schematu (#1 invitation_events, #3 partner_organizations, #8 deck, #11 DDL) | ich: schema-drift catch-up migracja + root-cause runnera | DB | staging done → prod-pending (po backupie) |
| #2 user_status | mój: `status AS user_status` | server | ✅ PROD |
| #4 PresentationStudio require | mój: createRequire | server | ✅ PROD |
| #14/#15 i18n+PILOT_LOCKED | mój | front | ✅ PROD |
| #13/#18/#19 | symptomy #12 / gating roli (nie bug) | — | ✅ zamknięte |
| #5/#6/#7/#16/#17 (UI polish), #9 (N+1), #10 (decisions RBAC) | — | front/server | Faza 2 fast-follow / decyzja produktowa |

## 3. 🔴 LUKA, której program 2. agenta NIE pokrywa — #20 (do GO, Faza 1)
FIX-1 bramkuje **Execution `/manager/*`**. Mój audyt znalazł **OSOBNY** wyciek — **katalog org**:
- `GET /api/organizations/:id/members` → **200, 156 wierszy** (imię/nazwisko/email/rola) — handler: `server/src/routes/organization/organizations.routes.ts`.
- `GET /api/users` → **200, 157 wierszy** (firstName/lastName/email/role/lastLogin/title/isOwner) — mount `Gateway.ts:425 → userRoutes` (`server/src/routes/users.routes.ts`, handler ~:109).

**Każdy USER (respondent ankiety) może wyeksfiltrować całą książkę adresową 156 osób.** GDPR/PII — launch-critical.

**Fix (minimalny blast radius, wzór jak FIX-1):**
- Dodać `requireRole(ADMIN|OWNER)` (lub `requirePermission`) na obu LIST-endpointach → USER dostaje 403; **albo** dla roli USER zwracać listę **bez `email` i wrażliwych pól** (jeśli USER musi widzieć współpracowników do pickerów).
- ⚠️ To **wrażliwa zmiana auth** (jak verifyToken 2. agenta) → **wymaga przeglądu człowieka przed deployem.** Wpisana do bramki Faza 1.

## 4. Ścieżka do GO (konsolidacja)
- **Faza 0:** backup prod (pgvector+Postgres) — TWARDA BRAMKA, bez tego STOP.
- **Faza 1 (blockery):** deploy `qa/remediation-2026-06-08` na prod (zawiera FIX-1 PII + verifyToken + migracja drift) **+ domknięty #20** → re-test prod kontem **VTS USER** (czat/voice, Execution PII, **katalog #20**, Settings, mobile) → RBAC re-audit (IDOR ✅, eskalacja ✅ już potwierdzone; #20 do potwierdzenia po fixie).
- **Faza 2/3:** ich fast-follow (N+1, responsywność, web-vitals) + proces (root-cause runnera migracji: zatrzymywać deploy na błędzie + weryfikować obiekty + czyścić SQLite-izmy).
- **Rollout: ETAPOWO** — pilot 5–10 VTS na 24–48h z monitoringiem (DB errors, 403, koszty AI), potem pełne 131.

## 5. Macierz weryfikacji do GO (zielone = GO)
| Sprawdzenie | Oczekiwane |
|---|---|
| #12+BUG-02/15: świeże logowanie → chat/voice | 200, rozmowa startuje (✅ #12 już live) |
| BUG-18: USER na Execution/Manager | 403 / własne dane (po FIX-1) |
| **#20: USER na `/api/users` + `/organizations/:id/members`** | **403 lub bez PII** (po fixie #20) |
| Drift: AI token-accounting, ModelRouter | brak `... does not exist`, routing z DB |
| Eskalacja URL / IDOR | 403/404 (✅ już potwierdzone w audycie backend) |
| Breaker | brak kaskady 429 |

## 6. Rollback
Każdy fix = osobny commit → rewert pojedynczy. Migracja addytywna (kolumny/tabele) → bezpieczna do pozostawienia.

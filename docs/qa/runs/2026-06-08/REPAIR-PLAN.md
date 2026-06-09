# Plan naprawy — droga do GO dla rolloutu VTS

Status: w realizacji · Branch: `qa/remediation-2026-06-08` · Środowisko docelowe: PROD `consultify.ai`
Zasada: rollout VTS = **NO-GO** dopóki nie zamknięta Faza 1. Faza 2 = fast-follow po rolloucie.

---

## Ścieżka krytyczna (kolejność ma znaczenie)

### FAZA 0 — Bezpieczeństwo wdrożenia (zanim cokolwiek tkniemy na prodzie)
| # | Zadanie | Po co | Kto | Gate |
|---|---------|-------|-----|------|
| 0.1 | **Backup bazy prod** (pgvector + Postgres) | „no backup yet" = niedopuszczalne przed migracją/zmianami | Ty / DevOps | bez tego STOP |
| 0.2 | Snapshot/branch deployu prod (rollback point) | szybki powrót | Ty | — |

### FAZA 1 — Blokery rolloutu (twarda bramka GO/NO-GO)
| # | Zadanie | Bug | Warstwa | Stan |
|---|---------|-----|---------|------|
| 1.1 | **Migracja schematu** — STAGING ✅ ZROBIONE+ZWERYFIKOWANE (2026-06-09 ~02:55Z); PROD: czeka na backup | drift DB / token-accounting AI | DB | staging done; prod pending |
| 1.2 | **Deploy fixu PII** (RBAC na `/manager/*`) | BUG-18 | server | kod gotowy (FIX-1) |
| 1.3 | **Serwerowy fallback org** (przeciw 403) + deploy | BUG-02/15 | server | projekt niżej; implementacja w toku |
| 1.4 | **Deploy fixów** (breaker, ModelRouter, commandDock, web-vitals, i18n, 403-fallback) — STAGING ✅ ZROBIONE (railway up, deploy SUCCESS 03:07Z; health 200, web-vitals 401 nie 404, i18n keys live, boot czysty) | BUG-14/22/21/16/02-15, AI | front+server | staging done; prod pending |
| 1.5 | **Re-test prod kontem VTS USER** (nie demo): czat, voice, Execution (PII), Settings (BUG-13), mobile | weryfikacja | QA | po deployu |
| 1.6 | **Audyt RBAC/PII** z Test Charter Prio 1 (USER vs ADMIN, IDOR, eskalacja URL) | nowe ryzyka | QA | równolegle |

**Gate GO:** 1.1–1.5 zielone + brak nowych P0/P1 z 1.6.

### FAZA 2 — Fast-follow (dni po rolloucie, nie blokują)
- N+1 `title/generate` (164 zapytania) — refaktor + monitoring pod 131 userów (BE-S2-1).
- Responsywność: sidebar @375px (BUG-17).
- Storage web-vitals (dziś tylko 204 — bez utraty, ale bez metryk).
- Dosłowność komunikatów blokad + i18n PL/EN sweep (Session 1 motyw).
- BUG-13: jeśli to gating pilotażowy — doprecyzować komunikat „locked for pilot".

### FAZA 3 — Procesowe (tydzień–dwa, żeby się nie powtórzyło)
- **ROOT CAUSE driftu potwierdzony (2026-06-09):** runner „Table Platform migrations" przy boocie raportuje `0 applied, 245 already up to date` — czyli **oznacza migracje jako zaaplikowane, choć obiekty fizycznie nie powstały** (SQLite-izmy typu `TEXT DEFAULT CURRENT_TIMESTAMP` padają na PG, błędy są połykane, a tracker i tak zapisuje „applied"). Naprawa: (a) runner musi zatrzymywać deploy na błędzie migracji (nie połykać), (b) weryfikować istnienie obiektów po migracji, (c) wyczyścić SQLite-izmy w migracjach. To realne źródło, nie objaw.
- **Migracje uruchamiane automatycznie przy deployu** (i faktycznie aplikowane, nie tylko „oznaczane").
- **Polityka backupu prod** (automat przed każdą migracją).
- **Staging = lustro prod** (ten sam build + zmigrowany schemat) → QA testuje na staging, nie na żywym prodzie z danymi VTS.
- CI: `tsc --noCheck` maskuje 4644 błędów — wydzielić bramkę typów dla zmienianych plików.

---

## Rekomendacja rolloutu: ETAPOWO
Nawet po Fazie 1 — **pilot 5–10 osób VTS na 24–48h**, monitoring (błędy DB, 403, koszty AI), dopiero potem pełne 131. Przy świeżo zmigrowanym prodzie big-bang to niepotrzebne ryzyko.

---

## Projekt: serwerowy fallback org (zadanie 1.3, BUG-02/15)
Przyczyna: w `verifyToken` (`auth.middleware.ts:605-638`) gdy `x-org-context` jest pusty/nieaktywny, `req.organizationId` zostaje **starym `tokenOrganizationId`**, którego user może nie być już ACTIVE członkiem. Potem `validateOrgMembership` (`:1402-1407`) rzuca 403 `ORG_MEMBERSHIP_REVOKED` — mimo że user MA ważną org.

**Poprawka (minimalny blast radius, w `verifyToken` po bloku 619-638):**
1. Jeśli NIE demo i `resolvedOrganizationId` nie pochodzi z potwierdzonego ACTIVE membership →
2. sprawdź membership dla `resolvedOrganizationId`; jeśli nie ACTIVE →
3. `SELECT organization_id, role FROM organization_members WHERE user_id=? AND status='ACTIVE' ORDER BY is_current DESC NULLS LAST, joined_at DESC LIMIT 1`;
4. jeśli znaleziono → użyj tej org (+ jej roli); jeśli nie → zostaw (wtedy 403 jest słuszny — user realnie bez org).

Koszt: 1 dodatkowe zapytanie tylko gdy resolved-org nie był już potwierdzony (rzadko). Ryzyko: hot-path auth → wdrożyć z testem + obserwacją logów. **Deploy dopiero po Twoim przeglądzie diffu** (PR).

---

## Macierz weryfikacji po deployu (co musi być zielone do GO)
| Sprawdzenie | Jak | Oczekiwane |
|-------------|-----|-----------|
| AI token-accounting | log prod: brak `ai_usage_logs ... does not exist`; INSERT 200 | brak błędów |
| ModelRouter | log: brak „Failed to get models for tier"; routing z DB | OK |
| PII | USER na Execution/Management → 403 lub własne dane | brak cudzych nazwisk |
| Voice/chat | świeże logowanie → klik voice → 200 | rozmowa startuje |
| Breaker | normalna nawigacja 5 min | brak kaskady 429 |
| Mobile nav (EN) | 768px | „Initiatives"/„More", nie PL |
| My Work | wejście | brak crasha commandDock |

## Rollback
Każdy deploy = osobny PR/commit → rewert pojedynczego fixu. Migracja: addytywna (kolumny/tabele) → rollback = `DROP COLUMN/TABLE` tylko jeśli konieczne; w praktyce nieszkodliwa do pozostawienia.

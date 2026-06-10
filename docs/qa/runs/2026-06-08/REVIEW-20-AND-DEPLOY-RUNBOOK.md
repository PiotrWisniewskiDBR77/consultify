# #20 (auth fallback) — self-review + deploy runbook (turnkey dla ownera)

## A. Self-review #20 — `auth.middleware.ts:619-682` (BUG-02/15)
**Co robi:** gdy rozwiązany org (z tokenu lub nieważny `x-org-context`) NIE jest aktywnym członkostwem usera → fallback do realnej, najnowszej ACTIVE org usera, zamiast 403 `ORG_MEMBERSHIP_REVOKED`.

| Aspekt | Ocena |
|--------|-------|
| Eskalacja uprawnień | **BRAK** — fallback `SELECT ... WHERE user_id=? AND status='ACTIVE'` zwraca tylko org, których user jest członkiem; rola z tego samego wiersza. Nie da się trafić do cudzej org. |
| Demo / superadmin | Nietknięte (`!isDemoHeader`; superadmin i tak omija `validateOrgMembership`). |
| Brak aktywnych orgów | Fallback nic nie zwraca → `validateOrgMembership` 403 (słusznie — user realnie bez org). |
| Błąd DB | `catch` → fail-open, zostaje token org → guard decyduje. |
| Wydajność | Dla żądań z ważnym `x-org-context` blok się POMIJA (0 extra query). Koszt tylko bez ważnego kontekstu: +1 (czasem +2) zapytania. **Monitorować pod obciążeniem 131 userów.** |
| Cache membership (60s) | Klucz po nowym (fallback) org — poprawnie. |

**Werdykt: APPROVE do deployu.** Drobny follow-up (nie blokuje): rozważyć złączenie 2 zapytań w 1 i metrykę „ile żądań wchodzi w fallback".

## B. Deploy runbook (jeden owner, po koordynacji z 2. agentem)
**Wstęp:** schemat prod JUŻ zmigrowany (addytywnie, zweryfikowany live). Ten deploy to **tylko KOD**.

1. **Merge** `qa/remediation-2026-06-08` + branch 2. agenta → jeden integration branch. Mój jest FF-czysty od `Londyn` (zero konfliktów na moich plikach — patrz `DEDUP-MANIFEST.md`).
2. **Review** #20 (sekcja A) + reszty integracji.
3. **Backup prod** (pod rollback kodu).
4. **Tag** obecnego deployu prod (instant rollback point).
5. **Deploy**: `railway environment production && railway service consultify && railway up`. Blue-green: stary build trzyma się do healthchecku → nieudany deploy NIE kładzie prod.
6. **Weryfikacja natychmiast po** (z `PHASE-4-TEST-PLAN.md`, krok 1–2):
   - health 200, boot czysty, zero `does not exist`.
   - logi: brak `integer = boolean` / `Failed to get models` (FIX-3 działa).
   - czat → `ai_usage_logs` nowy wiersz z **niezerowymi tokenami** (potwierdza FIX-3 + token-counting).
   - PII: ADMIN → `/manager/lanes` 200; **USER → 403** (potrzeba konta USER).
   - web-vitals 204; My Work bez crasha.
7. **Rollback jeśli ABORT** (kryteria w `PHASE-4-TEST-PLAN.md`): redeploy poprzedniego taga (krok 4).
8. **Rollout etapowy**: pilot 5–10 VTS na 24–48h (monitoring 5xx/403/koszty AI/perf) → 131.

## C. Czego brakuje do pełnej weryfikacji (od Ciebie)
- **Konto USER w VTS** (nie-admin) — do `USER→403` na PII. Bez niego potwierdzimy tylko ADMIN→200 + kod.
- Decyzja kto jest **deploy-ownerem**.

---
doc_id: funkcje-odbior-197
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 197 — migracja E1 · KOD SCALONY · KARTA DECYZYJNA GOTOWA (po FIX-197 `cac843372b`) — przedstawiona właścicielowi jako bramka etapu 2

Ledger **9/10** (odtworzony od pustej bazy: 871/0, kształt A4 pełny, walidator bez
wzrostu długu, zakres 20261721 OK) · pomiary M1/M2 odtworzone co do liczby ·
higiena **10/10** (Z31 udowodnione zielenią na obcej bazie) · pilotaż: **STOP
zasadny** (łańcuch A4.0 nieprzechodni: registerInitiative przybija REGISTERED_DRAFT,
scheduleDecision żąda APPROVED_BACKLOG), test z mutacją w obie strony u audytora.

## ★★ NAJWAŻNIEJSZE ZNALEZISKO (z mutacji audytora — wchodzi do karty)
Koszt JEDNEGO domu kanonicznego = **≥16 poleceń materialnych + 3 PUBLISHED
scenariusze** (portfolio/plan/capacity powiązane wersjami), pełen łańcuch:
candidates→register→definition(req+dec)→analysis(start+req+dec)→portfolio(req+dec)
→3×scenario.mutate→schedule(req+dec)→handoff(req+dec)→task.create.
Karta twierdziła „≥5" — **decyzja właściciela byłaby zaniżona 3×**.

## Miny etapu 2 (do karty i planu)
1. Fingerprint bez actorId/organizationId/correlationId → `batch_id` NIE jest
   kluczem ponowienia (REPLAYED zamiast konfliktu).
2. `claimRelation` bez ON CONFLICT → ponowienie z nowym clientRequestId po
   częściowej awarii = kolizja PK `ie_aggregate_relations`.
3. Seed M2 ma DWA defekty (status-check + składnia SQLite `datetime('now')`,
   `sqlite_master` w Postgresie) — naprawa pierwszego nie odblokuje pomiaru.
4. Ledger = na razie tabela bez pisarza/czytelnika (uczciwie: rejestr NIE działa,
   dopóki etap 2 nie przyniesie runnera z twardym limitem `--write=1` w kodzie).
5. „lifecycle red contract" to zielony test charakteryzujący — nazwa do sprostowania.

## FIX-197 (wydany): przepisanie karty decyzyjnej liczbami audytora (pkt 3 i 4),
dopisanie min 1-3, sprostowanie nazwy kontraktu. Dopiero taka karta → właściciel
(bramka etapu 2).

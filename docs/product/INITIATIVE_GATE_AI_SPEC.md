# INITIATIVE GATE AI — Spec (M13 Depth · Fala 1)

> **Status:** DRAFT do akceptacji Piotra · **Data:** 2026-06-20 · **Właściciel:** Piotr (produkt) / Claude (CTO)
> **Kontekst:** Przeplanowanie M13 wg mapy myśli. Fala 1 = gałąź #4 „Proces zatwierdzania → Wsparcie AI (Merytorycznie + Na linii czasu)".
> **Powiązane SSOT:** [`INITIATIVE_STATUS_ROLE_CTA_MATRIX.md`](INITIATIVE_STATUS_ROLE_CTA_MATRIX.md) · [`INITIATIVE_GOVERNANCE_MODEL.md`](INITIATIVE_GOVERNANCE_MODEL.md) · [`../standards/CARD_CONTENT_FORMULA.md`](../standards/CARD_CONTENT_FORMULA.md) · [`../initiatives/INITIATIVE_FORMULA.md`](../initiatives/INITIATIVE_FORMULA.md)

## 0 · Decyzje zamknięte (2026-06-20)

| Decyzja | Wybór |
|---|---|
| **Tryb bramki** | **Miękka blokada ze świadomym override** — poniżej progu bramka pokazuje wynik + braki i wymaga override z obowiązkowym uzasadnieniem (logowane). Twarda blokada = możliwa Faza 2 po telemetrii. |
| **Zakres bramek** | **Wszystkie 9 bramek postępu** (lista §2). |
| **Pilot/rollout** | **Flaga `initiativeGateAiEnabled` per-org; ON tylko na demo/wewn.** VTS/Apator/Elkomtech = OFF do czasu telemetrii. |
| **Fallback** | **Fail-open** — gdy LLM niedostępne, bramka NIE blokuje (zachowanie = flaga OFF). Nigdy nie zamurować użytkownika padnięciem AI. |
| **Próg domyślny** | **75/100** (konfigurowalny per-org; per-gate override opcjonalny w Fazie 2). |

## 1 · Cel

AI ocenia **gotowość inicjatywy do przejścia każdej z 9 bramek postępu** w dwóch wymiarach:
- **Merytorycznie** — czy treść wymaganych dla danej bramki sekcji/kart jest wystarczająco dobra (wg `CARD_CONTENT_FORMULA`).
- **Na linii czasu** — czy harmonogram/zależności/zasoby pozwalają bezpiecznie przejść bramki planistyczne (SCHEDULE, START).

Wynik = miękka blokada: pokazujemy score + konkretne braki + ścieżkę naprawy; przejście „mimo to" wymaga świadomego override z uzasadnieniem (telemetria).

**Reuse (~70% klocków istnieje):** reviewer `POST /review-section` (§B4, score 0–100 + braki), `POST /readiness-analysis`, `GET /:id/gate-readiness-check` (mechaniczne `blockingItems`), tabela `initiative_dependencies`. Fala 1 = orkiestracja na poziomie bramki + analizator czasowy + UI + flaga/telemetria.

## 2 · Bramki postępu (kanon, z `initiativeStatuses.ts`)

| # | Gate | from → to | Role (GATE_PERMISSIONS) | Merytoryczny | Czasowy |
|--|--|--|--|:--:|:--:|
| 1 | SUBMIT_FOR_REVIEW | DRAFT → PENDING_REVIEW | CONSULTANT, INITIATIVE_OWNER | ✅ | — |
| 2 | APPROVE_TO_INITIATIVE | PENDING_REVIEW → REVIEW | PROJECT_MANAGER, PROJECT_LEAD, PMO | ✅ | — |
| 3 | ACCEPT | REVIEW → PROMOTED | PROJECT_SPONSOR, STEERING_COMMITTEE | ✅ | — |
| 4 | START_PLANNING | PROMOTED → PLANNING | PMO | ✅ | — |
| 5 | APPROVE | PLANNING → APPROVED | STEERING_COMMITTEE | ✅ | — |
| 6 | SCHEDULE | APPROVED → SCHEDULED | PMO | ✅ | ✅ |
| 7 | START | SCHEDULED → EXECUTING | PMO | ✅ | ✅ |
| 8 | COMPLETE | EXECUTING → DONE | INITIATIVE_OWNER, PMO | ✅ | — |
| 9 | START_TRACKING | DONE → TRACKING | BUSINESS_OWNER | ✅ | — |

> SEND_BACK / REJECT / BLOCK / UNBLOCK / CANCEL = przejścia regresywne/lateralne → **bez oceny AI**.

## 3 · Wymagane sekcje per bramka (merytoryczny rollup)

Każda bramka ma listę sekcji, które AI ocenia (reviewer per-sekcja → ważony rollup). Mapa do dopięcia w kodzie jako kanon (`GATE_REQUIRED_SECTIONS`). Propozycja startowa:

| Gate | Wymagane sekcje (do akceptacji Piotra) |
|--|--|
| SUBMIT_FOR_REVIEW | overview, problemDefinition |
| APPROVE_TO_INITIATIVE | overview, problemDefinition, targetState/scope |
| ACCEPT | + financialImpact, raid |
| START_PLANNING | + tasks/milestones, team |
| APPROVE | overview, problemDefinition, scope, financialImpact, raid, kpis, gates |
| SCHEDULE | + timeline, resources, dependencies |
| START | timeline, resources, team, dependencies (gotowe) |
| COMPLETE | tasks (zamknięte), kpis (baseline), deliverables |
| START_TRACKING | kpis (baseline+target), control |

**Rollup:** `score = średnia ważona reviewer-score wymaganych sekcji`; `gaps[] = sekcje < próg + konkretne braki z reviewera`. Cache per (initiativeId, gate, contentHash); inwalidacja przy edycji którejkolwiek wymaganej sekcji.

## 4 · Wymiar czasowy (SCHEDULE, START)

Analizator `gateTimelineService`:
- **Zależności** (`initiative_dependencies`): jeśli zależność (finish-to-start) nie jest co najmniej SCHEDULED → flaga „zależność X niegotowa (status Y)".
- **Konflikt dat**: start/end nakłada się z innymi SCHEDULED tego samego ownera/zespołu → ostrzeżenie.
- **Zasoby**: ten sam zasób przypisany w nakładającym się oknie → ostrzeżenie.

Wynik: `timelineFlags[] = { severity: 'block'|'warn', kind, message, refs[] }`. `block` liczy się do soft-block; `warn` tylko informuje.

## 5 · Kontrakt API

**Nowy (lazy, wołany przy próbie przejścia / na żądanie):**
```
POST /api/initiatives/:id/gate-ai-check   body: { gate: GateType }
→ 200 { aiReadiness: { score, threshold, verdict: 'ready'|'below', gaps[], fixes[] },
        timeline: { flags: TimelineFlag[] } | null,
        enabled: boolean }   // enabled=false gdy flaga OFF lub fail-open
```
> Osobny endpoint (nie w każdym `gate-readiness-check`) — AI jest wolne/drogie; wołamy leniwie + cache.

**Rozszerzenie transition (soft-block):** endpoint zmiany statusu przyjmuje `overrideReason?`. Gdy flaga ON i (`score < threshold` lub `timeline.block`) i brak `overrideReason` → **422** z payloadem `{ aiReadiness, timeline }`. Z `overrideReason` → przejście przechodzi + zapis do telemetrii. Flaga OFF / fail-open → zachowanie bez zmian.

## 6 · UI (pasek bramki)

- Przy CTA bramki: **pigułka gotowości AI** (score + kolor: ≥próg zielony / poniżej bursztyn). Klik → panel z `gaps[]` + `fixes[]` + `timelineFlags[]`.
- Próba przejścia poniżej progu → **modal override**: pokazuje braki + pole **obowiązkowego uzasadnienia** + przycisk „Przejdź mimo to (zapisz powód)".
- Flaga OFF / AI niedostępne → brak pigułki, zachowanie obecne.
- Kanon: §7 topbar, §27 — bez danger-fill na normalnych statusach; bursztyn = ostrzeżenie, nie błąd.

## 7 · Flaga + telemetria

- **Flaga:** `initiativeGateAiEnabled` (org-scoped, `pgFlags`/config). OFF = zero zmian zachowania.
- **Telemetria:** zdarzenia `initiative_gate_ai_events` { org_id, initiative_id, gate, score, timeline_block, blocked, overridden, override_reason, user_id, ts }.
- **Metryki sukcesu:** % bramek flagged · % override · korelacja niskiego score z późniejszym BLOCKED/rework · czas insight→APPROVE.

## 8 · Bezpieczeństwo / ryzyko żywych klientów

- Domyślnie OFF wszędzie → **zero zmian** dla VTS/Apator/Elkomtech do świadomego włączenia.
- Fail-open na padnięcie LLM.
- Org-scope wszędzie (initiative + dependencies + events).
- Brak zmian w istniejących `GATE_PERMISSIONS`/transition matrix — AI to **warstwa doradczo-blokująca NAD** istniejącymi regułami, nie ich modyfikacja.

## 9 · DoD Fali 1

1. Flaga `initiativeGateAiEnabled` per-org; OFF = zero zmian (test).
2. `gate-ai-check` zwraca merytoryczny rollup dla 9 bramek (test).
3. Wymiar czasowy działa na SCHEDULE+START (test).
4. Soft-block: 422 bez override / przejście+log z override (test).
5. Fail-open przy LLM down (test).
6. Telemetria zapisywana (test).
7. UI: pigułka + panel + modal override (live demo-org screenshot, dark+light).
8. Flaga ON na demo/wewn org; smoke telemetrii.

## 10 · Etapy build (sekwencja)

1. Flaga + config próg (`initiativeGateAiEnabled`, threshold).
2. Kanon `GATE_REQUIRED_SECTIONS` (§3, po akceptacji Piotra).
3. `gateAiReadinessService` — content rollup (reuse reviewer) + cache.
4. `gateTimelineService` — zależności/daty/zasoby (§4).
5. Endpoint `POST /:id/gate-ai-check` + rozszerzenie transition o override/422 (§5).
6. Telemetria (events + zapis).
7. UI: pigułka + panel + modal override (§6).
8. Testy (unit rollup/threshold/override-gate/fail-open; integration endpoint; e2e soft-block).
9. Flaga ON demo-org + smoke telemetrii.

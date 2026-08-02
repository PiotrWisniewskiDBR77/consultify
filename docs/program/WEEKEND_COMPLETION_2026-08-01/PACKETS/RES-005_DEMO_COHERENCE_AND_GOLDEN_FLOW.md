---
doc_id: RES-005
truth_type: operations
status: READY
owner: codex
product_owner: piotr
priority: P0
last_reviewed: 2026-08-01
---

# RES-005 — Results demo coherence i pierwszy golden flow

## Werdykt

Kanoniczna trasa i rdzeń V8 KPI są technicznie mocne: celowany zestaw route/client/service
ma `127/127 PASS`. Pełny moduł nie jest gotowy przez scorecard split-brain, brak quality
gate, niedomknięte recovery/escalation i brak visibility policy.

Staging `Demo Mode · Atelier Toys` pokazuje 27 KPI, ale znacząca część należy do
`DBR77 Industrial Intelligence Scale-Up`; ROI również miesza DBR77 i inne historyczne
inicjatywy. To blokuje biznesowy odbiór mimo działającego ekranu.

## Pierwszy odbierany flow

`KPI catalog → create → initiative link → measurement → RED deviation → acknowledge →
RCA → recovery action → resolve/close → KPI report snapshot`.

## Pakiety wykonawcze

1. usunąć fallback V8-empty → legacy `/benefits`, który ukrywa brak kanonicznych danych;
2. wykonać RES-001B inventory i decyzję o legacy Goals vs `kpi_scorecards`;
3. egzekwować owner/source/cadence/baseline/target i jakość definicji KPI/OKR;
4. dodać Recovery Card, clock-controlled escalation i effectiveness reopen E2E;
5. zdefiniować role/visibility/roll-up z testami negatywnymi;
6. zmaterializować wyłącznie Atelier Toys KPI/ROI dla demo fixture.

## Bramka

Jeden HTTP+UI flow na namespaced tenant, real SQL read-back, org isolation, audit i cleanup.


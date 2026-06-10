# G1 Check-Run Template - 18 Ustawienia (2026-05-28)

Module: `18 Ustawienia`

Gate: `G1 Technical Gate`

Owner: CTO / Delivery Owner

Status: `ready_to_execute`

---

## 1) Objective

Zweryfikowac techniczna gotowosc modulu Ustawienia przed przejsciem do G2.

---

## 2) Mandatory 3-step hard gate

## Step A - API Gate

Checklist:

- [ ] Krytyczne endpointy ustawien odpowiadaja bez `5xx`.
- [ ] Krytyczne write endpointy zwracaja poprawne statusy.
- [ ] Odpowiedzi endpointow sa spójne z kontraktem danych.

Evidence to capture:

- Request/response log
- Status codes
- Error payloads (if any)

Decision:

- [ ] PASS
- [ ] FAIL

## Step B - DB-Compat Gate

Checklist:

- [ ] Zapis ustawien jest zgodny ze schema.
- [ ] Brak bledow typu/nullability.
- [ ] Odczyt po zapisie zwraca ten sam stan.

Evidence to capture:

- Save payload
- Read-back payload
- DB/schema compatibility note

Decision:

- [ ] PASS
- [ ] FAIL

## Step C - UI Smoke Gate

Checklist:

- [ ] Wejscie do modulu dziala.
- [ ] Glowna akcja save dziala.
- [ ] Widoczny i uczciwy feedback (toast/banner).
- [ ] Refresh resistance: stan po F5 pozostaje poprawny.

Evidence to capture:

- UI steps
- Toast/banner text
- Refresh proof

Decision:

- [ ] PASS
- [ ] FAIL

---

## 3) Stop rule

- Jesli dowolny krok A/B/C = FAIL -> gate result = `BLOCKED_P1`.
- Nie przechodzic do G2 do czasu poprawki i retestu.

---

## 4) Final G1 decision

- [ ] G1_PASS
- [ ] G1_BLOCKED_P1

Critical finding summary:

`<fill>`

Next action:

`<fill>`

Owner:

`CTO / Delivery Owner`


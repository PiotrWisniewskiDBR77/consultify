---
uiux_doc_id: UIUX_PRINCIPLES
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX principles (enterprise invariants)

## Purpose

Utrzymać nadrzędne zasady UI/UX (trust-first), które obowiązują niezależnie od wyglądu i “ładności” UI.

## Applies To

Cała aplikacja (w tym: moduły klienckie, Admin, SuperAdmin, AI OS, narzędzia wewnętrzne).

## Must

- **MUST**: No Silent Execution — istotne mutacje realizują kontrakt: `proposal -> approval -> execution -> audit`.
- **MUST**: No Hidden Learning — brak trwałej pamięci/uczenia poza kontrolowanym przepływem; private mode ma realny skutek i komunikat.
- **MUST**: Honest Degraded UI — dozwolone degraded/unavailable; niedozwolone fake success, milczące awarie, infinite spinners.
- **MUST**: Traceability — decyzje biznesowe/AI pokazują źródła/założenia/confidence albo jawny brak danych.
- **MUST**: Tenant and ACL safety — zero cross-tenant leakage; backend egzekwuje ACL; UI nie reklamuje ukrytych modułów.
- **MUST**: No Raw Internals — użytkownik biznesowy nie widzi `[object Object]`, `NaN`, stack trace, surowych JSON “jako komunikatu”.
- **MUST**: Save State ≠ Lifecycle State — `Saved/Saving/Unsaved` nie miesza się z `Draft/Review/Approved/...`.
- **MUST**: Contextual AI actions w Menu 3 — kontekstowe akcje AI są po prawej w command row/Menu 3.

## Must Not

- **MUST NOT**: Maskować błędu etykietą “Saved” ani udawać sukcesu.
- **MUST NOT**: Traktować “ukrycia w UI” jako security boundary.

## Should

- **SHOULD**: Standardy komunikatów (toast + inline banners) są spójne i przewidywalne.

## Acceptance Criteria

- [ ] Zasady są spójne z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Każdy moduł ma w swoim kontrakcie (`04_UI_UX.md`) odniesienie do tych invariantów.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`


# PLAN DOMKNIĘCIA — per moduł (co zrobione / co zostało)
**Data:** 2026-06-18 | **Branch:** Londyn (czyste, wypchnięte) | **Stan:** 250/251 luk = 99,6% · 26/27 modułów na 100%

> Licznik luk nie kłamie, ale uczciwy plan pokazuje też 3 rzeczy poza licznikiem: (a) jedyną żywą lukę (M10 = klucz Piotra), (b) weryfikacje deploy-gated (kod gotowy, brak dowodu na staging), (c) świadome backlogi v1.1 (nie blokują 100% v1).

---

## 1. TABELA PER MODUŁ

| # | Moduł | Luki | Status | Co zostało |
|---|-------|------|--------|-----------|
| M01 | Czat (Teresa) | 10/10 | ✅ | i18n de/es/jp/ar (landing, v1.1) |
| M02 | Canvas / Deliverables | 15/15 | ✅ | — |
| M03 | Moja Praca | 11/11 | ✅ | — |
| M04 | Notatnik | 11/11 | ✅ | — |
| M05 | Ideas — Zarządzanie | 8/8 | ✅ | — |
| M06 | Ideas — Mind Map | 7/7 | ✅ | — |
| M07 | Ideas — Process Flow | 6/6 | ✅ | — |
| M08 | Ideas — Table | 5/5 | ✅ | — |
| M09 | Ideas — Whiteboard | 6/6 | ✅ | współdzielony trwały zapis (v1.1; realtime działa) |
| **M10** | **Wywiad** | **8/9** | 🔑 **ŻYWA** | **L-01: `OPENAI_API_KEY` na centerbeam (Piotr) → E2E test głosu gotowy** |
| M12 | Audyty | 10/10 | ✅ | §27-todo: listy assessment → FilterableTable (v1.1) |
| M13 | Inicjatywy | 14/14 | ✅ | — |
| M14 | Wdrożenie | 9/9 | ✅ | — |
| M15 | Rezultaty | 12/12 | ✅ | — |
| M16 | Finanse | 7/7 | ✅ | — |
| M17 | Outputs Library | 12/12 | ✅ | — |
| M18 | Dokumenty Studio | 12/12 | ✅ | cold-start proof na staging (deploy-gated; PG wired) |
| M19 | Prezentacje | 9/9 | ✅ | — |
| M20 | Tabele Studio | 11/11 | ✅ | — |
| M21 | Meeting | 9/9 | ✅ | — |
| M22 | AI OS | 9/9 | ✅ | — |
| M23 | Organizacja | 9/9 | ✅ | org-scope `ai-settings:622` (drobny hardening) |
| M24 | Admin | 9/9 | ✅ | — |
| M25 | Ustawienia | 10/10 | ✅ | — |
| M26 | Portal Partnerski | 10/10 | ✅ | schema drift prod = known-gap (migracja za zgodą Piotra) |
| M27 | SuperAdmin | 11/11 | ✅ | L-10 feedback live-verify (deploy); §27-todo: listy superadmin (v1.1) |

---

## 2. CO ZOSTAŁO — 4 KOSZYKI

### A. Żywa luka (1) — czeka na Piotra
- **M10 L-01 STT:** ustaw `OPENAI_API_KEY` na Railway centerbeam → agent odpala gotowy E2E test (commit `3bbd98e255`) → flip → **251/251**.

### B. Weryfikacje deploy-gated (kod gotowy, brak dowodu na staging)
- **M18 cold-start proof:** PG DAO podłączone (12 serwisów), trzeba potwierdzić trwałość po restarcie staging (caboose).
- **M27 L-10 live-verify:** feedback 500 naprawione w kodzie (`36ceb52c60`), potwierdzić po deploy.

### C. Backlog v1.1 (świadome, nie blokują 100% v1)
- **§27-todo:** ~70 list encji (głównie superadmin/M27, assessment/M12) → migracja na FilterableTable + Menu 1/2/3. Reszta tabel oznaczona §27-exempt.
- **M09 shared-write:** realtime collaboration działa; współdzielona trwała persystencja (per-resource zamiast per-user) → v1.1.
- **i18n de/es/jp/ar:** PL/EN kompletne; pozostałe locale = EN fallback → agent landingu.

### D. Cutover (Faza D — koordynator, gate na Piotrze)
- `db:verify:schema:staging` → 0 drift.
- Smoke staging: 27 modułów na demo.consultify.ai.
- Reconcyliacja teczek (już zrobione: 250/251).
- Checklista Londyn→prod (backup centerbeam, verify, smoke po) → **uruchomienie tylko za osobną zgodą Piotra**.

---

## 3. ŚCIEŻKA NA OSTATNI 0,4% + CUTOVER

```
[Piotr: klucz STT] → M10 E2E → 251/251
        ↓
[deploy staging] → M18 cold-start + M27 live-verify (potwierdzenie)
        ↓
[Faza D: schema verify + smoke 27 modułów + checklista]
        ↓
[Piotr: zgoda cutover] → backup centerbeam → Londyn→prod → smoke prod
```

**Definicja v1-DONE:** 251/251 luk + cold-start/live-verify potwierdzone na staging + smoke 27/27 + zgoda cutover. Backlog v1.1 (§27-todo, M09 shared-write, locale) jedzie po GA.

# Final Closeout Acceptance Requirements And Gates - 2026-05-28

Status: `execution_canonical_for_closeout`

Owner: CTO / Delivery Owner

Purpose: jeden twardy kontrakt odbioru dla wszystkich modulow.

---

## 1) Scope

Dokument obowiazuje wszystkie 19 modulow:

1. Czat
2. Moja Praca
3. Wywiad
4. Narzedzia
5. Inicjatywy
6. Realizacja
7. Rezultaty
8. Finanse
9. Outputs
10. Dokumenty
11. Tabele
12. Prezentacje
13. Meeting
14. MCP IRIS
15. MCP Marketplace
16. Organizacja
17. Panel Administratora
18. Ustawienia
19. Portal Partnerski

---

## 2) Acceptance model (obowiazkowy)

Kazdy modul musi przejsc 4 warstwy:

1. Functional Acceptance
2. UX Acceptance
3. Security/Tenant Acceptance
4. Evidence Acceptance

Brak zaliczenia dowolnej warstwy == brak odbioru modulu.

---

## 3) Minimalne wymagania odbioru (globalne)

## 3.1 Functional Acceptance

- Core workflow modulu dziala end-to-end.
- Glowna akcja modulu nie jest martwa.
- Brak blokujacego crash/perma-spinner.
- Save -> read-back -> refresh resistance jest potwierdzone.
- Integracje krytyczne dla modulu dzialaja albo maja uczciwy degraded state.

## 3.2 UX Acceptance

- Loading state jest czytelny.
- Success state jest czytelny.
- Error state jest czytelny.
- Empty state jest czytelny.
- Degraded state jest uczciwy.
- Toast/banner feedback nie klamie.
- Brak raw internals (`[object Object]`, stack trace, technical gibberish).
- Dla akcji AI: placement i zachowanie zgodne z Menu 3 governance.

## 3.3 Security/Tenant Acceptance

- Tenant boundaries sa egzekwowane backendowo.
- ACL jest deny-by-default przy niepewnym dostepie.
- Brak cross-tenant data leakage.
- Brak silent execution i hidden learning.
- Proposal -> approval -> execution -> audit dla krytycznych mutacji AI/governance.

## 3.4 Evidence Acceptance

- Jest evidence pack dla modulu.
- Evidence zawiera UI + API/Network + refresh proof.
- Werdykt jest jawny: `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `NO_GO`.
- Ryzyka residualne maja ownera i termin.

---

## 4) Gate definitions

## G0 - Contract Gate

### Wejscie
- Kompletny kontrakt modulu.

### Wyjscie
- Plan approved albo reject.

### Fail criteria
- Brak acceptance criteria, brak validation matrix, brak risk register.

## G1 - Technical Gate (3-step hard gate)

### Wejscie
- Plan approved.

### Wyjscie
- API Gate PASS
- DB-Compat Gate PASS
- UI Smoke Gate PASS

### Fail criteria
- Dowolny fail blokuje dalszy manual.

## G2 - Functional Gate

### Wejscie
- G1 PASS.

### Wyjscie
- Core workflow PASS.
- Krytyczne flow pomocnicze PASS lub jawny degraded.

### Fail criteria
- Brak end-to-end, utrata danych, dead action.

## G3 - UX Trust Gate

### Wejscie
- G2 PASS.

### Wyjscie
- Stany UI i feedback zgodne z kontraktem.

### Fail criteria
- Fake success, nieuczciwe stany, brak read-back.

## G4 - Security/Tenant Gate

### Wejscie
- G3 PASS.

### Wyjscie
- Tenant/ACL/security controls PASS.

### Fail criteria
- leakage, ACL bypass, hidden write/learning.

## G5 - Evidence And Decision Gate

### Wejscie
- G4 PASS.

### Wyjscie
- Final decision modułu.

### Fail criteria
- Brak dowodow, brak ownerow ryzyka, brak finalnego werdyktu.

---

## 5) Decision policy

- `PASS`: modul gotowy bez P0/P1, tylko drobne residuals.
- `PASS_WITH_P2`: modul gotowy, sa znane P2 nielamiace core kontraktu.
- `BLOCKED_P1`: blokada krytyczna, brak przejscia dalej.
- `NO_GO`: brak warunkow release dla modulu.

Regula programu:

- Brak przejscia do kolejnego sprintu/etapu przy `BLOCKED_P1` lub `NO_GO`.

---

## 6) Required evidence set per module

Kazdy modul musi miec:

1. Module gate report
2. API/Network evidence
3. UI state evidence
4. Refresh/read-back evidence
5. Security/tenant evidence
6. Final decision note

---

## 7) Acceptance Definition of Done (module)

Modul jest zamkniety tylko gdy:

1. G0-G5 maja wynik pozytywny zgodnie z polityka decyzji.
2. Brak otwartego P0/P1 bez planu i ownera.
3. Werdykt jest wpisany do boardu closeout.
4. Evidence jest traceable.


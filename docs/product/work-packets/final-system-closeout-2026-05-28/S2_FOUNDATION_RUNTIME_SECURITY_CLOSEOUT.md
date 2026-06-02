# S2 - Foundation Runtime Security Closeout

Stage id: `S2`

Stage goal: domknac fundamenty runtime/security/tenant/ACL oraz Setting/Admin.

Target duration: 2-4 dni

---

## 1) Definition of Ready (DoR)

- [ ] S1 ma wynik `GO`.
- [ ] Kontrakty modulow fundamentowych sa zatwierdzone.
- [ ] Security i tenancy acceptance criteria sa jawne.

---

## 2) Operational checklist

- [ ] Auth flow dziala dla wymaganych ról.
- [ ] Tenant boundaries sa backend-enforced.
- [ ] ACL denial jest poprawny i uczciwie komunikowany.
- [ ] Setting/Admin ma stabilny load/save/read-back.
- [ ] Error/degraded states nie ukrywaja awarii.
- [ ] Brak raw internals w UI.
- [ ] Brak silent execution.

---

## 3) Epics and tasks

## EPIC-S2-1 Tenant and ACL hardening

- T1: Przeglad endpointow krytycznych pod tenant scope.
- T2: Weryfikacja denied-by-default.
- T3: Naprawa ujawnionych luk ACL.

## EPIC-S2-2 Admin and settings runtime stabilization

- T1: Stabilizacja glownych workflow ustawien.
- T2: Save/read-back/refresh resistance.
- T3: Degraded and error posture cleanup.

## EPIC-S2-3 Security and trust hygiene

- T1: Eliminacja raw internals.
- T2: Spojnosc komunikatow bledow.
- T3: Audit trail dla mutacji governance.

---

## 4) Test checklist (S2)

### Technical gate (obowiazkowe)

- [ ] API Gate (auth/admin/acl krytyczne endpointy).
- [ ] DB-Compat Gate (schema zgodnosc mutacji).
- [ ] UI Smoke Gate (logowanie, role, denied states).

### Security and tenancy tests

- [ ] Cross-tenant isolation test.
- [ ] Unauthorized access denial test.
- [ ] Governance action audit trace test.

### UX trust tests

- [ ] Honest degraded state test.
- [ ] Save/read-back after refresh test.
- [ ] No fake success test.

---

## 5) Gate criteria

### GO

- Brak otwartego `BLOCKED_P1` security/tenant.
- Setting/Admin ma co najmniej `PASS_WITH_P2`.
- API/DB/UI gate przechodza.

### NO_GO

- Cross-tenant leakage.
- Krytyczny ACL bypass.
- Brak dowodow read-back lub audit.

---

## 6) Required output artifact

`S2_FOUNDATION_SECURITY_EVIDENCE_PACK.md`:

1. auth/tenant/acl findings
2. fixed vs open blockers
3. evidence links
4. gate decision

---

## 7) Sprint report template

1. Changes made
2. Validation performed
3. Gate result
4. Remaining risks
5. Next step
6. Security/tenant decision


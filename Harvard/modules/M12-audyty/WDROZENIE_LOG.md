# M12 — Audyty — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | Fala-18 | BUG-M12-01: COUNT(*) bigint string w AuditEventsService | `a8c250ec72` | total=Number() w response | ✅ |
| 2026-06-12 | Fala-18 | BUG-M12-02/03: total+actions COUNT bigint w auditLog.routes.ts | `a8c250ec72` | Number() wraps | ✅ |
| 2026-06-12 | Fala-18 | BUG-M12-04: COALESCE legacy schema cols (actor_id/action/resource_type) | `a8c250ec72` | Dual-schema SELECT; legacy dane widoczne | ✅ |
| 2026-06-12 | Fala-18 | BUG-M12-05: ISO timestamp w auditProgramService | `a8c250ec72` | .toISOString() zamiast String() | ✅ |

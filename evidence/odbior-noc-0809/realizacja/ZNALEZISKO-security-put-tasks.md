# ZNALEZISKO BEZPIECZENSTWA — PUT /api/tasks/:id bez realnej autoryzacji (shadow mode)

Zmierzone empirycznie 07/08.09.2026 na kopii bazy `consultify_odbior_real`.

## Dowod
Konto Anna Kowalska (MEMBER, id `e60062fb-cd33-41bf-bac2-f361aae2422a`) wyslala:

    PUT http://localhost:4165/api/tasks/seed_task_1788642392883_2_dec2053e-1e4e-4193-acdd-27e138e89053
    Cookie: access_token=<token Anny>
    Body: {"status":"review"}

Zadanie nalezalo do "Audyt Nocny" (OWNER, assignee_id=76015d70-9117-444f-97a6-4f5eda9d7ad5),
NIE do Anny. Serwer odpowiedzial **200 OK** i realnie zmienil status zadania.

## Przyczyna (plik:linia)
- `server/src/routes/pmo/tasks.routes.ts:1167-1173` — trasa
  `router.put('/:id', requireAudit, requireTaskCapability('task.update', { shadow: true }), ...)`
  woła bramkę uprawnień z opcją `{ shadow: true }`.
- `server/src/middleware/effectiveCapability.middleware.ts:41-46` — tryb domyslny to
  `shadow` (log-only, ZERO blokowania), chyba ze `CAPABILITY_ENFORCE=enforce` jest
  jawnie ustawione w środowisku. Na stanowisku nocnym (i najpewniej na demo/staging)
  ta zmienna NIE jest ustawiona -> bramka NIGDY nie zwraca 403, tylko loguje ostrzezenie.

## Skutek
KAZDY zalogowany uzytkownik (rowniez MEMBER) moze zmienic status/osobe/termin
DOWOLNEGO zadania w organizacji przez `PUT /api/tasks/:id`, niezaleznie od
`assignee_id`/`owner_id`. UI zakladki "Praca" nawet nie probuje tego ukrywac —
`ExecutionWorkSurface.tsx` uznaje kazdy wiersz z `origin==='tasks'` za edytowalny
bez sprawdzania, czy zalogowany user jest przypisany.

## Status
NIE NAPRAWIONO (zgodnie z instrukcja — zapisac stan faktyczny, nie naprawiac).
To NOWY STOP bezpieczenstwa, inny niz znane 403 na `/organizations/:id/members`
i `/execution-control/manager/lanes/*/problems` (te dzialaja poprawnie - blokuja Anne).

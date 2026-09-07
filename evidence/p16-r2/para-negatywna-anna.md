# Para negatywna — Anna Kowalska (MEMBER, bez ról projektowych)

Zmierzone 07.09 na własnym API `127.0.0.1:4155` (kopia bazy `consultify_p16r2`),
konto `anna.kowalska@dbr77.com` (`users.role = MEMBER`, `organization_members.role = MEMBER`),
zadanie `proba-r2-anna` PRZYPISANE DO KOGO INNEGO (`assignee_id` = Audyt Nocny).

| Żądanie | Odpowiedź | Skutek w bazie |
|---|---|---|
| `PUT /api/tasks/proba-r2-anna` `{"status":"in_progress"}` | **200** | status zmieniony (`todo` → `in_progress`) |
| `PUT /api/tasks/proba-r2-anna` `{"assigneeId":"<Anna>"}` | **200** | Anna PRZEJĘŁA cudze zadanie |
| `POST /api/tasks` `{"title":"…"}` | **201** | zadanie utworzone |
| `DELETE /api/tasks/proba-r2-anna` | **403** | brak zmiany |

Przyczyna: `server/src/routes/pmo/tasks.routes.ts` chroni zapis przez
`requireTaskCapability('task.update', { shadow: true })`, a bramka „shadow"
w `server/src/middleware/effectiveCapability.middleware.ts:44` jest **log-only**
dopóki `CAPABILITY_ENFORCE=enforce` (na stanowisku i w `server.env` NIE JEST
ustawione). Log potwierdza (`para-negatywna-anna-log.txt`):

    [capabilityShadow] {"mode":"shadow","capability":"task.update","method":"PUT",
      "userId":"<Anna>","status":"evaluated","wouldAllow":true,"projectRole":"TASK_ASSIGNEE"}

★ WAŻNE: samo włączenie `CAPABILITY_ENFORCE=enforce` TEGO NIE ZAMKNIE —
bramka policzyła `wouldAllow: true` dla cudzego zadania. `DELETE` odpowiedział
403 z INNEGO miejsca (shadow policzył `wouldAllow: false`, więc to nie ta bramka).

NIE NAPRAWIANE w R2 (poza zakresem kroku, dotyka modelu uprawnień całego
routera zadań) — zgłoszone jako STOP.

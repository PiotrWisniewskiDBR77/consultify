# E2 — członek organizacji edytuje CUDZE zadanie (10.09.2026)

Surowe logi i wyjścia (`*.txt`, `*.log`) są celowo poza repo (`evidence/.gitignore`
— zawierają tokeny i adresy bazy). Tu zostają liczby, które trzeba móc odtworzyć.

## Stanowisko

| Element | Wartość |
|---|---|
| Worktree / gałąź | `wt/e2-uprawnienia` / `mvp/e2-uprawnienia-20260910`, baza `b85398b174` |
| Baza | kopia `consultify_kopia_e2` z `consultify_staging_czysta` (kontener `consultify-pg18`, 54418) — **usunięta po pracy**, żadna żywa baza nietknięta |
| Organizacja | DBR77 `a3e05d4a-…` |
| Konta | `e2.member.a@` (MEMBER), `e2.member.b@` (MEMBER), `e2.admin@` (ADMIN) — tylko w kopii |
| API | `:4222` shadow, `:4232` `CAPABILITY_ENFORCE=enforce`, `:4242` `EFFECTIVE_ACCESS_ENFORCE=true` |
| Odtworzenie | `scripts/dev/e2-start-api.sh`, `scripts/dev/e2-pomiar.sh`, `scripts/dev/e2-pomiar-rodzina.sh` |

## K0 — pomiar PRZED (premisa POTWIERDZONA)

| Próba | shadow (:4222) | enforce (:4232) | Baza |
|---|---|---|---|
| MEMBER A → `PUT /api/tasks/<własne>` | 200 | 200 | tytuł zmieniony (poprawnie) |
| MEMBER A → `PUT /api/tasks/<cudze>` | **200** | **200** | **tytuł CUDZEGO zadania nadpisany** |
| ADMIN → `PUT /api/tasks/<cudze>` | 200 | 200 | zmieniony (poprawnie) |
| MEMBER A → `DELETE /api/tasks/<cudze>` | 403 | 403 | bez zmian |

Telemetria enforce dla włamania: `{"capability":"task.update","userId":"e2-member-a",
"wouldAllow":true,"projectRole":"TASK_ASSIGNEE"}`.

## K1 — rodzina

61 zdolności z sufiksem: 45 `.scoped`, 10 `.assigned`, 4 `.delegated`, 2 `.own`.
141 bramek `requireXxxCapability` w `server/src/routes` (wszystkie deklarują `shadow: true`).

Bramki, w których jakaś rola trzyma zdolność **wyłącznie** przez sufiks własności:

| Trasa | Zdolność | Sufiks | Rola | Czy przepuszczała cudzy obiekt (pomiar) |
|---|---|---|---|---|
| `tasks.routes` `PUT /:id` | `task.update` | `.assigned` | TASK_ASSIGNEE, CONSULTANT | **TAK — 200, baza nadpisana** |
| `tasks.routes` `POST /:id/block` | `task.status.update` | `.assigned` | TASK_ASSIGNEE, CONSULTANT | **TAK — 200, `status='blocked'`** |
| `tasks.routes` `POST /:id/unassign` | `task.unassign` | `.assigned` | TASK_ASSIGNEE | **TAK — 200, `assignee_id=NULL`** |
| `initiatives.routes` ×7 (`PUT /:id`, `PATCH /:id`, quick-update, merge/extend) | `initiative.update` | `.own` | INITIATIVE_OWNER | NIE z powodu sufiksu — patrz K4 |
| `decisions.routes` `PUT /:id`, `DELETE /:id` | `decision.update/.delete` | — | brak roli z sufiksem | NIE (403 z kontrolera i z bramki) |
| `tasks.routes` `DELETE /:id` | `task.delete` | — | brak roli z sufiksem | NIE (403, `wouldAllow:false`) |

## K2 — co zmienione

* `server/src/services/effectiveAccessService.ts:1015-1130` — rozdzielenie `SCOPE_SUFFIXES`
  (`.scoped`) od `OWNERSHIP_SUFFIXES` (`.own/.assigned/.delegated`);
  `matchEffectiveCapability`, `evaluateEffectiveCapability(access, cap, {requireOwnership,
  ownerPredicate})`. Brak predykatu przy sufiksie własności = odmowa; wyjątek predykatu = odmowa.
  `hasEffectiveCapability` zachowuje starą semantykę (żadna z pozostałych 137 bramek nie zmienia decyzji).
* `server/src/middleware/effectiveCapability.middleware.ts` — `CapabilityOptions.enforceMode`
  (tryb per bramka), `ownerPredicate`, `objectScoped`; kody odmowy
  `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED` / `CAPABILITY_OWNERSHIP_PREDICATE_MISSING` /
  `CAPABILITY_OWNERSHIP_CHECK_FAILED`; predykat `isTaskOwnedByCaller`
  (`assignee_id`/`owner_id`/`created_by`/`reporter_id`, kontrola organizacji, fail-closed);
  telemetria dostała pole `reason`.
* `server/src/routes/pmo/tasks.routes.ts` — `PUT /:id`, `DELETE /:id`, `POST /:id/block`,
  `POST /:id/unassign`: `{ shadow: true, enforceMode: 'enforce', objectScoped: true,
  ownerPredicate: isTaskOwnedByCaller }`. **Globalne `CAPABILITY_ENFORCE` nietknięte.**

## POMIAR PO

| Próba | shadow (:4222) | enforce (:4232) |
|---|---|---|
| MEMBER własne `PUT` | 200 | 200 |
| MEMBER cudze `PUT` | **403 `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED`** | **403 ten sam kod** |
| ADMIN cudze `PUT` | 200 | 200 |
| MEMBER cudze `DELETE` | 403 `CAPABILITY_REQUIRED` | 403 |
| MEMBER cudze `POST /block` | **403 `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED`** | — |
| MEMBER cudze `POST /unassign` | **403 `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED`** | — |
| decyzje / inicjatywy | bez zmian względem PRZED |

Telemetria po zmianie: 4 podpięte bramki logują `mode:"enforce"` z `reason`, pozostałe nadal
`mode:"shadow"` z `wouldAllow` — bez regresji.

## K3 — testy

`tests/security/task-object-ownership.mounted.pg.test.ts` — 7/7 zielone na realnym Postgresie
(`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`); każdy przypadek odmowy sprawdza **stan bazy**,
nie tylko kod HTTP (atrapa `Database.ts:686` zwraca `changes:1` dla każdego UPDATE).

Dowód mutacyjny (RED→GREEN):
* **M2** — przywrócenie starej semantyki sufiksu w serwisie → `expected 200 to be 403` (RED).
* **M1b** — skasowanie samego predykatu przy `objectScoped: true` → RED, odmowa dla **wszystkich**
  (fail-closed, w tym dla właściciela zadania). Dlatego `objectScoped` jest deklarowany osobno.

Bez regresji: `effectiveAccessService.test.ts` 5/5 i 54/54, `effectiveCapability.middleware.test.ts`
36/36, `effectiveCapability.shadow-faza-b.test.ts` 16/16 (atrapa serwisu dostała nowy eksport),
`commandCapabilityGuard` 15/15, `security-roles.l3` 9/9, `m13-cross-org-idor`, `m13-mass-assignment`,
`pmo-tasks.routes.org-guard`, `tasks.test.js`, `m02p04-tasks-idempotency.realdb` — wszystkie zielone.
`tsc -p server/tsconfig.json --noEmit` = 0.

## K4 — rodzeństwo do osobnego zlecenia

**Inicjatywy: 7 bramek `initiative.update` jest CAŁKOWICIE BEZCZYNNYCH.**
`requireGovernedInitiativeCapability` wymusza `shadow: false`, a ścieżka bez shadow przepuszcza
wszystko, dopóki `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` są nieustawione — a nie ma
ich ani w `server.env`, ani na środowiskach. Pomiar dowodowy: MEMBER `PUT /api/initiatives/<cudza>`
= **200** przy `CAPABILITY_ENFORCE=shadow` i `=enforce`, ale **403 `CAPABILITY_REQUIRED`** na
procesie z `EFFECTIVE_ACCESS_ENFORCE=true` (`:4242`). To NIE jest defekt sufiksu — to martwa
bramka. Naprawa = włączenie zmiennej, czyli **88 bramek naraz** (zakaz z reguły 9). Propozycja:
osobne zlecenie, przejście trasa po trasie na `enforceMode: 'enforce'` per bramka (mechanizm już
istnieje po tej zmianie), zaczynając od `PUT/PATCH /api/initiatives/:id`.

**Decyzje: dziury nie ma** — `PUT`/`DELETE /api/decisions/:id` odbijają 403 już dziś
(kontroler: „Permission denied", „Only requester, owner, or admin can delete"), a żadna rola nie ma
`decision.*` przez sufiks własności. Warto jednak przenieść tę logikę na ten sam mechanizm
(predykat + `enforceMode`), żeby ochrona nie zależała od ręcznego `if` w kontrolerze.

**`tasks.routes` `POST /:id/assign` i `/:id/reassign`** (`task.assign`, `task.reassign`) — te
zdolności ma tylko PROJECT_LEADER/PMO przez `.scoped`, więc MEMBER dostaje `missing`; nie mierzone
adwersaryjnie, do sprawdzenia przy okazji.

# E2b — K0: pomiar PRZED (10.09.2026)

Stanowisko: worktree `wt/e2b-inicjatywy`, gałąź `mvp/e2b-inicjatywy-uprawnienia-20260910`,
baza `0e8090e592`. Kopia bazy `consultify_kopia_e2b` z `consultify_staging_czysta`
(kontener `consultify-pg18`, 54418) — usuwana po pracy. Żadna żywa baza nietknięta.

Konta (tylko w kopii, org DBR77 `a3e05d4a-…`):
`e2b-member-a` MEMBER/TASK_ASSIGNEE · `e2b-member-b` MEMBER/TASK_ASSIGNEE ·
`e2b-ini-owner` MEMBER/INITIATIVE_OWNER · `e2b-admin` ADMIN/PROJECT_LEADER.
Odtworzenie: `scripts/dev/e2b-seed.sql`, `scripts/dev/e2b-start-api.sh`, `scripts/dev/e2b-pomiar.sh`.

API: `:4224` `CAPABILITY_ENFORCE=shadow`, `:4234` `CAPABILITY_ENFORCE=enforce`.
`EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` nieustawione (jak na staging/demo/produkcji).

## Tabela PRZED

| # | Trasa | Bramka (plik:linia) | MEMBER A → CUDZA | stan bazy | ADMIN/OWNER → CUDZA |
|---|---|---|---|---|---|
| 1 | `PUT /api/initiatives/:id` | `initiatives.routes.ts:3103` `initiative.update` | **200** | **`title` CUDZEJ nadpisany** | 200 |
| 2 | `PATCH /api/initiatives/:id` | `initiatives.routes.ts:3140` `initiative.update` | **200** | **`title` CUDZEJ nadpisany** | 200 |
| 3 | `PATCH /:id/quick-update` | `initiatives.routes.ts:3125` `initiative.update` | 403 (kontroler `topBarCaps`) | bez zmian | 200 |
| 4 | `POST /:id/move` | `initiatives.routes.ts:3270` `initiative.update` | 403 `CAPABILITY_REQUIRED` (kontroler) | bez zmian | 200 |
| 5 | `POST /bulk-assign` | `initiatives.routes.ts:3284` `initiative.update` | 200 z `failedCount:1` (kontroler odrzuca per rekord) | bez zmian | 200 |
| 6 | `POST /:id/merge-from-insight` | `initiatives.routes.ts:664` `initiative.update` | 400 (walidacja przed logiką) | bez zmian | — |
| 7 | `POST /:id/extend-from-insight` | `initiatives.routes.ts:672` `initiative.update` | 400 (walidacja przed logiką) | bez zmian | — |
| 8 | `PATCH /:id/status` | `initiatives.routes.ts:3114` `initiative.status.change` | 400 `INITIATIVE_CARD_INCOMPLETE` (walidacja karty, NIE uprawnienia) | bez zmian | 400 |
| 9 | `POST /:id/archive` | `initiatives.routes.ts:3294` `initiative.status.change` | 400 `INVALID_FLAG_OPERATION` | bez zmian | 400 |
| 10 | `POST /:id/lifecycle-flag` | `initiatives.routes.ts:3986` `initiative.status.change` | 400 `UNSUPPORTED_FLAG_OPERATION` | bez zmian | — |
| 11 | `DELETE /api/initiatives/:id` | `initiatives.routes.ts:3168` `initiative.delete` | 403 `INITIATIVE_PILOT_WRITE_FORBIDDEN` (`requireInitiativeWriteAccess`) | bez zmian | 200 |
| 12 | `PUT /:id` inicjatywa **bez projektu** | jw. | **200** | **nadpisany** | 200 |
| 13 | `PATCH /runtime-v1/initiatives/:id/metadata` | `initiativesExecutionRuntime.routes.ts:2165` `deps.authorize` | 403 `CAPABILITY_REQUIRED` | bez zmian | przechodzi bramkę |
| 14 | `POST /runtime-v1/initiatives/:id/cancel` | `initiativesExecutionRuntime.routes.ts:2213` `deps.authorize` | 403 `CAPABILITY_REQUIRED` | bez zmian | przechodzi bramkę |
| 15 | `PATCH /runtime-v1/.../metadata` **WŁAŚCICIEL INICJATYWY → CUDZA** | jw. | **przechodzi autoryzację** (500 dopiero w `resolvePolicy`, linia 2176 — za bramką) | — | — |

Kolumny 4 i 6 identyczne na `:4224` (shadow) i `:4234` (`CAPABILITY_ENFORCE=enforce`) —
zmienna nie zmienia ANI JEDNEGO wyniku, bo `requireGovernedInitiativeCapability`
wymusza `shadow: false`, a ścieżka bez shadow (`effectiveCapability.middleware.ts:604`)
przepuszcza wszystko, dopóki `EFFECTIVE_ACCESS_*` są nieustawione.

## Wniosek

Dziura realna i zapisująca do bazy jest w DWÓCH trasach: `PUT /:id` i `PATCH /:id`
(oba wchodzą w `InitiativeController.updateInitiative`, który nie pyta o właściciela
obiektu — pyta tylko o `topBarCaps` dla pól `owner`/`targetDate`/`priority`).
Pozostałe trasy rodziny są dziś bronione przez kontroler albo walidację, NIE przez bramkę.
W runtime-v1 dziura jest węższa: `deps.authorize` woła `hasEffectiveCapability`, więc
rola z sufiksem `.own` (INITIATIVE_OWNER) przechodzi na KAŻDEJ inicjatywie w projekcie.

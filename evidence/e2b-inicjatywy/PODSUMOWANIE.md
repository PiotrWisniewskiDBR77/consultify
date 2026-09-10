# E2b — bramki edycji INICJATYW były bezczynne (10.09.2026)

Surowe logi są celowo poza repo. Tu zostają liczby, które trzeba móc odtworzyć.

## Stanowisko

| Element | Wartość |
|---|---|
| Worktree / gałąź | `wt/e2b-inicjatywy` / `mvp/e2b-inicjatywy-uprawnienia-20260910`, baza `0e8090e592` (wierzch E2) |
| Baza | kopia `consultify_kopia_e2b` z `consultify_staging_czysta` (`consultify-pg18`, 54418) — **usunięta po pracy** |
| API | `:4224` `CAPABILITY_ENFORCE=shadow`, `:4234` `CAPABILITY_ENFORCE=enforce` |
| Odtworzenie | `scripts/dev/e2b-seed.sql`, `scripts/dev/e2b-start-api.sh`, `scripts/dev/e2b-pomiar.sh` |

## K0 — pomiar PRZED

Pełna tabela: `POMIAR_PRZED.md`. Skrót — dziura ZAPISUJĄCA DO BAZY:

| Trasa | MEMBER → cudza (PRZED) | stan bazy |
|---|---|---|
| `PUT /api/initiatives/:id` | **200** | **`title` cudzej nadpisany** |
| `PATCH /api/initiatives/:id` | **200** | **`title` cudzej nadpisany** |
| `PUT /:id` inicjatywy BEZ projektu | **200** | **nadpisany** |
| `PATCH /runtime-v1/initiatives/:id/metadata` (jako WŁAŚCICIEL innej inicjatywy) | przechodzi bramkę | — |

`CAPABILITY_ENFORCE=enforce` NIE zmieniał ani jednego wyniku: `shadow: false` kieruje
bramkę na starą ścieżkę, a ta wywołuje `next()` bez sprawdzenia, dopóki
`EFFECTIVE_ACCESS_*` są nieustawione.

## K1 — model własności inicjatywy

SSOT w kodzie: **DEC-453**, `evaluateInitiativeAuthorOnly`
(`server/src/services/initiative/initiativeTransitionConditions.ts` + test
`initiativeAuthorOnly.dec453.test.ts`): autor (`created_by`) LUB puste `created_by`
LUB ADMIN/OWNER organizacji. `docs/ssot/` nie zawiera osobnego rozdziału o edycji
inicjatywy — przyjęty i zapisany jawnie model (do potwierdzenia decyzją CTO):

* **edycja** = twórca (`created_by`) · właściciel wykonawczy (`owner_execution_id`)
  · właściciel biznesowy (`owner_business_id`) · sponsor (`sponsor_id`)
  · ADMIN/OWNER organizacji (przechodzą wcześniej, na zdolności);
* **zmiana statusu** = jak edycja (decydent bramki jest sprawdzany osobno, niżej,
  przez silnik przejść — bramka zdolności go nie zastępuje);
* `updated_by` świadomie **NIE** jest własnością (inaczej pierwszy udany włam
  nadawałby prawo do kolejnych);
* MEMBER przypisany do zadania w inicjatywie NIE jest właścicielem inicjatywy —
  potwierdzone pomiarem (rola projektowa TASK_ASSIGNEE nie ma żadnej zdolności
  `initiative.update*`).

W runtime-v1 własność niesie pole `initiativeOwnerId` agregatu `ie_aggregate_state`.

## K2 — co zmienione

* `server/src/middleware/effectiveCapability.middleware.ts`
  * `CapabilityOptions.ownerGrantsAccess` — **ścieżka właściciela**: gdy zdolności
    w szablonie roli brak, predykat własności może zgodę przyznać. Opt-in per bramka;
    nie odwraca decyzji `ownership_denied` (nie da się nią obejść kontroli z E2).
  * `isInitiativeOwnedByCaller` — predykat na kolumnach ZMIERZONYCH:
    `created_by`, `owner_execution_id`, `owner_business_id`, `sponsor_id`
    + kontrola organizacji, fail-closed.
* `server/src/routes/pmo/initiatives.routes.ts`
  * `requireGovernedInitiativeCapability`: trasa deklarująca `enforceMode` wchodzi na
    ścieżkę per-bramka (`shadow: true` + tryb z opcji); pozostałe ~80 bramek zostają na
    `shadow: false` — decyzja bez zmian (zmierzone, patrz „regresja" niżej).
  * `PUT /:id`, `PATCH /:id`, `PATCH /:id/status`, `DELETE /:id`:
    `{ enforceMode: 'enforce', objectScoped: true, ownerGrantsAccess: true,
       ownerPredicate: isInitiativeOwnedByCaller }`.
  * **K4**: skasowany nieprawdziwy komentarz „Initiative routes have completed their
    shadow period… never allow log-only authorization". W jego miejsce opis stanu
    faktycznego: bramka działa wyłącznie przez `enforceMode` per trasa albo przez
    globalną zmienną `EFFECTIVE_ACCESS_ENFORCE` (88 bramek naraz — zakaz z reguły 9).
* `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`
  * `RuntimeAuthorizeObject` + opcjonalna zależność `authorizeInitiativeObject`
    (domyślna implementacja: `evaluateEffectiveCapability` z `requireOwnership: true`
    nad `initiativeOwnerId` agregatu). Podpięta w `PATCH .../metadata` i `POST .../cancel`.
    Bez tej zależności (atrapy w testach) zachowanie identyczne jak dotąd.
  * `authorize` (30 pozostałych wywołań, w tym wszystkie odczyty) — **nietknięte**.

## POMIAR PO (ta sama tabela, oba porty identycznie)

| Próba | PRZED | PO |
|---|---|---|
| MEMBER → `PUT` WŁASNA (twórca) | 200 | **200** |
| MEMBER → `PUT` CUDZA | 200 + zapis | **403 `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED`**, baza nietknięta |
| MEMBER → `PATCH /:id` CUDZA | 200 + zapis | **403 ten sam kod**, baza nietknięta |
| WŁAŚCICIEL (nie twórca) → `PUT` swoja | 200 | **200** |
| ADMIN → `PUT` CUDZA | 200 | **200** |
| MEMBER → `PATCH /:id/status` CUDZA | 400 (walidacja karty) | **403 `initiative.status.change`** |
| MEMBER → `DELETE` CUDZA | 403 (pilot) | **403** (bramka odpala wcześniej) |
| MEMBER → `PUT` cudza BEZ projektu | 200 + zapis | **403** |
| ADMIN → `PUT` bez projektu | 200 | **200** |
| runtime-v1 metadata: WŁAŚCICIEL → CUDZA | przechodzi bramkę | **403 `CAPABILITY_REQUIRED`** |
| runtime-v1 metadata: WŁAŚCICIEL → WŁASNA | przechodzi | **przechodzi** |
| Regresja: quick-update · move · bulk-assign · merge/extend-insight · archive · lifecycle-flag · wizard · submit-review · approve · start-execution · complete · profile | — | **kod w kod identyczny PRZED i PO** |

## K3 — testy

`tests/security/initiative-object-ownership.mounted.pg.test.ts` — **10/10** zielone na
realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`). Każdy przypadek
odmowy sprawdza STAN BAZY, nie sam kod HTTP (atrapa `Database.ts:686` zwraca `changes:1`
dla każdego UPDATE).

Dowód mutacyjny (RED→GREEN):

| Mutacja | Wynik |
|---|---|
| M1 — usunięcie `ownerPredicate` (zostaje `objectScoped`) | **6/10 czerwone** — odmowa dla WSZYSTKICH, w tym twórcy i właściciela (fail-closed) |
| M2 — usunięcie `enforceMode: 'enforce'` | **5/10 czerwone** — powrót do bezczynnej bramki |
| M3 — usunięcie domyślnego `authorizeInitiativeObject` w runtime-v1 | **1/10 czerwone** — właściciel znowu edytuje cudzą inicjatywę |
| przywrócenie | **10/10 zielone** |

Regresja (per plik): `task-object-ownership.mounted.pg` **7/7** · `effectiveAccessService`
**5/5 i 54/54** · `effectiveCapability.middleware` **36/36** · `shadow-faza-b` **16/16** ·
`m13-cross-org-idor` **18/18** · `m13-mass-assignment` **5/5** · `initiatives-crud` **12/12** ·
`initiatives-additive.routes` **11/11** · `initiatives-error-disclosure` **1/1**.
`tsc -p server/tsconfig.json --noEmit` = 0.

Trzy pliki testowe z atrapą `vi.mock` middleware'u dostały brakujący eksport
`isInitiativeOwnedByCaller` (bez tego import routera wywracał cały plik).

## STOP-y (co ŚWIADOMIE nieobjęte)

1. **`PATCH /:id/quick-update`, `POST /:id/move`, `POST /bulk-assign`** — mają własną
   kontrolę w kontrolerze (`topBarCaps`, „Your role does not have edit capability")
   i już dziś odmawiają MEMBER-owi. Bramka nadal bezczynna; przeniesienie ich na ten
   sam mechanizm to osobny krok (dziś ochrona zależy od ręcznego `if` w kontrolerze).
2. **`POST /:id/merge-from-insight`, `/extend-from-insight`** — walidacja Zod odbija
   żądanie przed logiką; nie udało się dojechać do bramki bez realnego `sourceInsightId`.
   Nie zmierzone adwersaryjnie, więc nieobjęte.
3. **`POST /:id/archive`, `/lifecycle-flag`, `/submit-review`, `/approve`** — bronione
   przez silnik przejść (statusy/gate), nie przez bramkę zdolności. Osobny temat.
4. **`registrations` runtime-v1 (rejestracja NOWEJ inicjatywy)** — zgodnie ze zleceniem
   zostaje dostępna dla członków (tworzenie własnej), nietknięta.
5. **Front**: nowy kod odmowy `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED` nie ma jeszcze
   klucza w `KLUCZE_ODMOWY` (`src/services/initiativeWriteTruth.ts:168`) ani w
   `public/locales/*`. Zadanie było backend-only — do dorobienia osobno, inaczej
   użytkownik zobaczy surowy kod zamiast zdania po polsku.
6. **`tests/integration/routes/pmo.initiatives.fail-closed.contract.test.ts`** pada
   (`TypeError: argument handler must be a function`) — **sprawdzone: pada tak samo na
   `0e8090e592`**, dług istniejący, nie regresja tej zmiany.
7. **Znalezisko poboczne**: na czystej kopii `consultify_staging_czysta` brakuje wiersza
   bazowego `ie_governance_policies` (`organization_id='*'`, `PRODUCT`/`DEFAULT`), przez
   co KAŻDY zapis runtime-v1 kończy się 500 „Product baseline is missing". To ten sam
   wzorzec co skasowane wiersze `'*'` z czystki (lekcja „Sierota to nie to samo co
   wzorzec"). Osobne zgłoszenie.

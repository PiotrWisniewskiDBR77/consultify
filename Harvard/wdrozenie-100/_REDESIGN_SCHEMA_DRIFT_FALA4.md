# Schema-Drift Fala 4 — decyzje 🔵 (redesign / martwy kod)

Data: 2026-07-20 · gałąź `fix/schema-drift-features` (off `origin/demo`) · parity pg18 :5443

Kontekst: 5 żywych endpointów, w których INSERT pisze do kolumn NIEISTNIEJĄCYCH w realnym
schemacie (sweep NOT-NULL). Trzy naprawione mechanicznie (RED→GREEN na parity, patrz raport).
Poniżej pozostają dwie pozycje wymagające DECYZJI (redesign) + jedna martwa do usunięcia,
oraz zaległa reconciliacja dla `access_codes`.

---

## 🔵 A. `custom_roles` — kolizja TRZECH modeli na jednej tabeli (REDESIGN)

**Endpoint żywy:** `POST /api/pmo-roles` (`server/src/routes/pmo/pmoRoles.routes.ts:321`).
**FE żywy i używany:** `src/components/Projects/PMORoleSelector.tsx`,
`src/components/Projects/ProjectTeamBoard.tsx` (tworzenie ról zespołu projektowego).

**Co jest w bazie (kanon = `ensureRbacTables()` w `rbac.routes.ts:20`):**
```
custom_roles(id, name UNIQUE, display_name, description, color, icon,
             base_role, role_type, scope, priority, is_active, is_default,
             created_at, updated_at)
```
Model GLOBALNY (superadmin RBAC): `name` unikalne globalnie, BEZ organization_id, BEZ level/permissions.

**Czego chce pmoRoles (trzeci, nieudokumentowany model):**
```
custom_roles(..., organization_id, level, level_label, permissions, ...)  UNIQUE(organization_id, name)
```
Role ORG-SCOPED z poziomami i JSON-em uprawnień, unikalność per-organizacja.

**Czego chciała nigdy-nie-uruchomiona migracja `200_security_mvp_enterprise.sql.sql:447` (drugi model):**
org-scoped (`organization_id NOT NULL`, `UNIQUE(organization_id,name)`, `user_count`) —
ale też BEZ `level/level_label/permissions`. Żaden migrator ich nie definiuje.

**Dlaczego NIE naprawiam additywnie:** dodanie 4 kolumn nie wystarczy — twardy konflikt to
`UNIQUE(name)` (globalne, wymaga RBAC) vs `UNIQUE(organization_id, name)` (wymaga pmoRoles).
Nie da się ich pogodzić na jednej tabeli bez złamania jednej z funkcji (dwie orgs nie mogłyby
mieć roli o tej samej nazwie; luzowanie constraintu pozwala RBAC tworzyć duplikaty globalne).

**Rekomendacja:** oddzielna tabela `pmo_roles` (org-scoped: id, organization_id, name,
description, level, level_label, permissions JSON, color, created_at, updated_at,
UNIQUE(organization_id, name)) + przepięcie `pmoRoles.routes.ts` na nią. `custom_roles`
zostaje wyłącznie modelem globalnego RBAC. Wielkość: 1 migracja + ~1 plik routera (SELECT/INSERT/
UPDATE/DELETE) + ewentualny data-move (obecnie 0 wierszy pmo w `custom_roles`, bo INSERT-y i tak fail).

**Status obecny:** `POST /api/pmo-roles` (tworzenie roli) FALUJE cicho; odczyty ról też idą po
`WHERE organization_id = ?` na tabeli bez tej kolumny → puste listy. Funkcja team-board działa
tylko na rolach systemowych/seed, nie na własnych.

---

## 🔵 B. `access_codes` — reconciliacja dual-model (naprawa INSERT zrobiona, reszta = decyzja)

INSERT z `accessCodeService.ts` NAPRAWIONY additywną migracją `20260720_access_codes_hash_columns.sql`
(dodane kolumny hash-modelu + `created_by` DROP NOT NULL; RED→GREEN, legacy bez regresji).

Zostaje 🔵 do decyzji (NIE blokuje demo, ale to dług):
- **Dwa liczniki:** `uses_count` (hash-model) vs `current_uses` (legacy) — kod czyta różne.
- **Dwa stany:** `status` ('ACTIVE'/'REVOKED') vs `is_active` (0/1).
- **Interop:** kody legacy (SuperAdminController/adminP32/access-control.routes) mają `code_hash = NULL`
  → niewidoczne dla `accessCodeService.validatePublic()` (lookup po hashu). Odwrotnie kody hash-modelu
  mają domyślne `role='USER'`, `current_uses=0` — listy legacy je pokażą, ale bez sensu biznesowego.

**Rekomendacja:** wybrać JEDEN silnik kodów (hash-model z 018/019 jest bogatszy i bezpieczniejszy) i
zmigrować pozostałych 4 callerów na `AccessCodeService`, potem zdjąć legacy kolumny. Do czasu decyzji
oba modele współżyją bezpiecznie.

---

## ⬛ C. `generic-reports` (tabela `reports`) — MARTWY endpoint, do USUNIĘCIA (nie naprawiam)

**Route:** `server/src/routes/generic-reports.routes.ts`, mount `app.use('/api/generic-reports', …)`
przez `mountStub` — **wyłączony w produkcji** (log: „Stub route disabled in production:
/api/generic-reports").

**INSERT** (`:109`) pisze do `reports(name, type, format, config, created_by)` — 5 z 9 kolumn NIE
ISTNIEJE (schemat: `id, project_id, organization_id, title, status, created_at, updated_at`).

**FE:** ZERO callerów `/api/generic-reports` w całym `src/`. Komponent `GenericReportsWorkspace.tsx`
mimo nazwy woła `POST /api/report-builder/upload-chaos` (inny, żywy backend), nie ten route.

**Decyzja:** martwy caller (0 FE + wyłączony w prod) → **rekomendacja usunięcia** routera
`generic-reports.routes.ts` + jego mountu + walidatora `generic-reports.validators.ts`, zamiast
naprawiania nieistniejącego modelu. Do zatwierdzenia (kasacja = osobna partia destrukcyjna).

---

## ✅ Naprawione mechanicznie w tej gałęzi (dowód RED→GREEN na parity)

| # | Endpoint | Naprawa | Dowód |
|---|----------|---------|-------|
| 1 | `POST /api/user/goals` (user_goals) | przepisany router na schemat onboardingu (`goal_id, metadata, selected_at`); FE `GoalSelector` wysyła `{goalId}` | GREEN |
| 2 | `access_codes` (accessCodeService) | additywna migracja hash-modelu + `created_by` w INSERT | GREEN, legacy bez regresji |
| 3 | `report_builder_reports` (reportImportService.createReport) | INSERT przepięty na kolumny kanoniczne (name→title, intent/sections→config_json, generated→generation_metadata, +source_id/report_type) | GREEN |

Uwaga: #1 pokrywa się z osobnym taskiem `task_5e1c8afa` (GoalSelector) — koordynacja, by nie
commitować podwójnie tego samego pliku.

---
id: VLT-001
tytul: Vault — backend 3 poziomów przypisania (osoba/projekt/organizacja)
typ: zadanie
waga: wysoka
obszar: VLT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: [VLT-002, VLT-003]
zablokowane_przez: []
zrodlo: "Piotr 2026-07-22 (3 poziomy Vault) + audyt origin/demo + DEC-003; przepisane z placeholdera D10a przez Mastera"
stare_id: D10a
utworzone: 2026-07-21
ekran: vault-scope-selector
wysokosc: 700
klik: "Sprawdź 3 poziomy przypisania (osoba/projekt/organizacja)."
---

## 1. PROBLEM

Dokument w Vault można dziś przypisać tylko do całej organizacji. Piotr chce trzech poziomów: **prywatny** (tylko dla osoby), **projektowy** (dla zespołu projektu/engagementu), **organizacyjny**.

## 2. PRZYCZYNA

Zadanie budowlane, nie usterka — ale ze stwierdzonym stanem: `server/src/services/KnowledgeService.ts:655` (`getDocuments`) ignoruje `userId`/`role`, filtruje tylko `organization_id`. POST `/documents` wymusza `projectId=null` (`server/src/routes/knowledge.routes.ts:686`).
**★ Model danych udźwignie to BEZ migracji:** tabela `knowledge_docs` ma już fizycznie `owner_id` i `scope` (ALTER w `ContextDocumentService.ts:2392-2393`), `project_id`, `organization_id`; encja `projects` istnieje. Gotowa logika poziomów: `ContextDocumentService.listAccessibleDocuments` (`:3789`).

## 3. ROZWIĄZANIE

Podłączyć ścieżkę Vault do modelu scope — bez dublowania. Zapis `owner_id`+`scope` (dla `project` też `project_id`); odczyt filtrowany wg poziomu; zdjąć `projectId=null`; higiena kolumn w bazowym schemacie.

## 4. KRYTERIUM ODBIORU

Sonda HTTP na żywym demo, trzy sekwencje: upload `user` → widoczny właścicielowi, niewidoczny innemu userowi org; upload `project` → widoczny członkowi projektu, niewidoczny spoza; upload `organization` → widoczny całej org. (Test negatywny prywatności w RAG = VLT-002.)

## 5. DOWODY

Gałąź: `feat/vlt-001-vault-scope` (baza origin/demo), commit `42542f31c992660a658ccbb6d2fce03b1f19d74c`. Nie pushowana.
Pliki: `server/src/services/KnowledgeService.ts` (typy `VaultDocumentScope`; kolumny `owner_id`/`scope` addytywnie w bazowym `ensureKnowledgeSchema`; `addDocument` zapisuje owner+scope, wymusza `project_id=NULL` dla scope≠project; `getDocuments` filtruje user/project/organization + widok domyślny + legacy `scope IS NULL`→organization + guard braku userId nie ujawnia prywatnych), `server/src/routes/knowledge.routes.ts` (POST przyjmuje scope+project_id, walidacja `canAccessProject` 403 / brak project_id 400; GET `?scope=&project_id=`; `getMemberProjectIds` z `project_members`).
Weryfikacja offline: `esbuild --platform=node` zielone (routes wymaga `--format=esm` — pre-istniejący top-level await); `eslint` 0 nowych errorów (baseline routes 39 = identyczny, potwierdzone `git stash`). **Executable harness** (esbuild + mock `DbPromise`, realny zbudowany `KnowledgeService`): SQL potwierdzony dla scope=user/project/organization/default/legacy; `addDocument` INSERT potwierdzony (project_id=NULL wymuszony dla scope=user).
**Sonda HTTP live (3 poziomy na demo) — CZEKA NA DEPLOY (Master).** ⚠️ Retrieval RAG (`knowledgeIndexer`) NIE filtruje jeszcze po scope → pełna prywatność dopiero po VLT-002.

## 6. DZIENNIK

**2026-07-22 — przepisane przez Mastera z placeholdera D10a** (zakres z audytu origin/demo, SSOT `_SPEC_AGENT_VAULT_2026-07-22.md`).
**2026-07-22 — wykonane** (wykonawca, gałąź `feat/vlt-001-vault-scope`, commit `42542f31`). NIE reużyto fizycznie `ContextDocumentService` (jego `ContextDocumentScope` to tylko `'project'|'user'` — nie modeluje `organization`; `uploadAndIngest` to nieproporcjonalnie cięższy pipeline OCR/kolejka) — reużyto punktowo `canAccessProject`; odtworzono kształt WHERE z `listAccessibleDocuments` + poziom organizacyjny. Decyzja architektoniczna zaakceptowana przez Mastera (recenzja diffu: legacy bez regresji, guardy prywatności obecne).
**2026-07-22 — ruch rejestru wykonał Master (po stronie zwrotnej).** Wykonawca w izolowanym worktree z `origin/demo` NIE miał dostępu do `rejestr/` (żyje tylko na `oxford/oc2-merge`) — git-operacje poza worktree blokowane przez sandbox. Systemowe dla wykonawców w worktree → Master domyka ruch rejestru z raportu. Stan 1-OTWARTE→do-odbioru.

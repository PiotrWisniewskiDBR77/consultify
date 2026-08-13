# Artifact Studio — Package 1 preservation checkpoint (2026-08-13)

> Status: `PRESERVED_AND_FROZEN` — nie jest to integracja ani odbiór produktu.
> Ten dokument jest manifestem checkpointu, nie deklaracją `DONE`/`ACCEPTED`.

## 1. Moduł i właściciel

- Moduł: Artifact Studio (governance / four-eyes approval — Package 1 z szerszego
  planu odzyskiwania ownerless artifact-studio, zob. `12_BOUNDED_HANDOFF_AND_COMMIT_ALLOWLIST.md`).
- Właściciel tej sesji: agent Claude (recovery/checkpoint session), 2026-08-12/13.
- Centralny integrator: Codex (przejmuje decyzję o dalszej integracji).

## 2. Branch i SHA

- Branch: `codex/artifact-studio-recovery-20260812`
- Worktree: `/Users/piotrwisniewski/Developer/consultify-artifact-recovery-20260812`
- Baseline: `codex/artifact-studio-safety-20260809` @ `635fd2d48d5a396c45bcb43b7f363535403ecf93`
- Merge-base z baseline: `635fd2d48d5a396c45bcb43b7f363535403ecf93` (branch utworzony
  dokładnie z tego SHA, zero commitów przed checkpointem)
- Commit kodu (TESTED_CODE_SHA): `62c97bca264d3fb6e00913e3f4795e5edf020c4a`
- Ten manifest jest osobnym commitem NA WIERZCHU `62c97bca26...` (manifest nie może
  zawierać własnego SHA — testowany SHA to SHA rodzica tego commita).

## 3. Commity baseline..HEAD(kodu)

Baza `635fd2d48d` sama zawiera 18 commitów od wspólnego korzenia
`fca72583ea83acf728a7807c5e119318dc206416` (11 z nich pod prefiksem
`artifact-studio`, 7 to niepowiązany dług baseline: finance/excel/results/ui) —
żaden z nich nie jest mój, to dziedziczona historia bazy.

Mój własny commit na tej gałęzi:

```
62c97bca26 fix(artifact-studio): Package 1 — governance four-eyes approval (preservation checkpoint)
```

## 4. Zmienione pliki (Package 1, dokładnie 6 — zgodnie z zatwierdzoną allowlistą)

1. `server/migrations/20260812_artifact_approval_four_eyes.sql` (nowy)
2. `server/migrations/000_initdb_core_tables.sql`
3. `server/src/database/PostgresDatabase.ts`
4. `server/src/routes/presentations.routes.ts`
5. `server/src/services/artifactApprovalService.ts`
6. `tests/unit/backend/services/artifactApprovalService.test.ts`

Świadomie wykluczone z tego pakietu:

- `server/src/types/artifactRegistry.ts` — hunk usuwający `assessment_report`
  z `ArtifactOriginRuntimeValues` (regresja względem celowo zaimplementowanej
  na tej bazie obsługi `assessment_report`) — **DROP**, nie portowany.
- `deckDocument.meta?.customTemplate` w `presentations.routes.ts` — usunięty
  z portowanego hunka podczas weryfikacji typecheck (pole nie istnieje w typach
  na tej bazie; przeciek z nieujawnionej cechy na innej linii).
- `src/components/shared/CanvasContextMenu.tsx` + test — **DEFER**, poza
  zakresem tej rundy (decyzja właściciela z 2026-08-12).

## 5. Wspólne / kolizyjne pliki

| Plik | Powód | Ryzyko kolizji |
|---|---|---|
| `server/src/routes/presentations.routes.ts` | Duży, współdzielony plik routingu (6000+ linii) | Inne linie rozwoju też go modyfikują (potwierdzone wcześniej: WIP na linii `b79fc79554` dotyka innych fragmentów tego samego pliku) |
| `server/migrations/000_initdb_core_tables.sql` | Fundamentalny plik bootstrapu schematu | Każda inna gałąź dodająca kolumny do `approval_assignments` skolidowałaby tu |
| `server/src/database/PostgresDatabase.ts` | Runtime DDL bootstrap, współdzielony przez cały backend | Jak wyżej |

## 6. Testy wykonane (na `TESTED_CODE_SHA = 62c97bca26...`, wcześniej zweryfikowane
   identycznie na niescommitniętym patchu tego samego kodu)

| Test | Komenda | Wynik |
|---|---|---|
| Backend typecheck | `npm run typecheck` (server/) | 141/141 błędów pre-existing, **zero nowych** (A/B zweryfikowane przez tymczasowy `git apply -R` na czystym `635fd2d48d`) |
| Unit approval service | `npx vitest run tests/unit/backend/services/artifactApprovalService.test.ts` | **14/14 PASS** |
| Integration route caller | `npx vitest run tests/integration/routes/artifactApprovals.routes.test.ts` | **7/7 PASS** |
| Fresh-schema realDB | `node server/scripts/run-initdb.js` na dedykowanej, izolowanej bazie | **PASS** — `requested_by_user_id TEXT` obecna |
| Upgrade istniejącego schematu | Ręcznie zbudowana „stara" baza (oryginalny `000_initdb_core_tables.sql` sprzed patcha) + legacy wiersz + sama migracja | **PASS** — kolumna dodana, legacy wiersz zachowany z `NULL` |
| Migracja 2x | Uruchomiona dwukrotnie na fresh i upgrade DB | **PASS**, idempotentna (`NOTICE: already exists, skipping`) |
| `git diff --check` (baseline..commit kodu) | `git diff --check 635fd2d48d 62c97bca26` | **PASS**, exit 0 |

### Znane, potwierdzone pre-existing luki (NIE spowodowane przez Package 1)

- `tests/integration/routes/presentations.download-stale-pptx.route.test.ts` — FAIL
- `server/src/routes/__tests__/workbook-commands.routes.test.ts` — FAIL

Obie z tego samego powodu: `server/src/services/artifactExportPolicy.ts` **nie
istnieje w historii Gita bazy `635fd2d48d` w ogóle** — plik widoczny wyłącznie
jako nieśledzony w niepowiązanym, brudnym worktree głównej sesji. Potwierdzone
identycznym błędem na czystym baseline bez tego patcha (reverse-apply A/B test).

## 7. EVIDENCE_MISSING

- UI interaction / manualny test w przeglądarce dla `ensureCurrentPptxExport`
  (fail-closed export flow) — niewykonany w tej rundzie (backend-only checkpoint).
- Persistence/reopen dla exportu PPTX po zmianie `exported_version` — niewykonany.
- Pełny łańcuch `migrate.postgres.ts` (24 niepowiązane pliki failują na tej
  bazie niezależnie od Package 1) — nieudokumentowany wcześniej, wymaga osobnej
  interwencji właściciela bazy, poza zakresem tego checkpointu.

## 8. Rekomendowana metoda integracji

`HUNK PORT` (nie merge, nie cherry-pick) — ten branch jest już wynikiem ręcznego,
per-hunk portu z `73f13b2fe6` na czystą bazę `635fd2d48d`. Centralny integrator
powinien zweryfikować niezależnie i przenieść dalej wg tej samej metody, nie
poprzez scalenie całych gałęzi.

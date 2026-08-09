# Artifact Studio — bounded handoff i allowlista commita

> Status: `BOUNDED_IMPLEMENTATION_CANDIDATE / PROGRAM_NO_GO`
> Branch: `codex/sync-demo-20260729`
> Base przed commitem: `9c23e3d80ecec9b8e77f8cfdeb65e6838e61d611`
> Merge-base z `origin/demo`: `fca72583ea83acf728a7807c5e119318dc206416`
> Zakres: otwarte DOC, PPT i XLSX; szablony są `OUT`

## Granica pakietu

Dokładna, maszynowa allowlista znajduje się w `commit-allowlist.txt`. Commit może zawierać wyłącznie te ścieżki. Pakiet obejmuje specyfikację, wspólny shell i rejestr komend, adaptery DOC/PPT/XLSX, governance, globalny kontekst Teresy, migracje addytywne, testy i dowody E2E.

W pakiecie celowo znajduje się poprawka parity dla `assessment_report`:
- `src/services/api/artifactRuns.ts`
- `server/src/types/artifactRegistry.ts`
- `server/migrations/20260807_origin_runtime_assessment_report.sql`
- material-format consumer i testy kontraktowe.

## Wykluczone zmiany obce i historyczne

Root worktree zawiera równoległe zmiany innych właścicieli. Nie należą do tego commita, w szczególności:
- Idea workspace, Finance, Assessment oraz pozostałe moduły poza zależnościami wymienionymi w allowliście;
- `package.json` i `package-lock.json` (mieszane, obce hunki);
- artefakty robocze, logi, raporty i dokumentacja innych programów;
- wszystkie ścieżki nieujęte literalnie w `commit-allowlist.txt`.

Nie wykonano stash/reset/clean ani szerokiego stage. Nie wykonuje się push ani deploy.

## Bramki

Wymagane przed commitem:
1. `git diff --cached --check` — PASS.
2. Targeted TypeScript typecheck — PASS.
3. Testy Artifact Studio DOC/PPT/XLSX — PASS.
4. Test parity `assessment_report` i material formats — PASS.
5. Program gate — wynik zapisany bez podnoszenia `PARTIAL` do `PASS`.
6. Brak staged `package.json` / `package-lock.json`.
7. Każdy staged-owned plik z dodatkowym unstaged hunkiem ma jawnie rozdzielony zakres. W `src/services/api.ts` obce formatowanie `getInitiativeById` pozostaje poza indeksem; staged są wyłącznie API Teresy i skoroszytu.

## Pozostałe bramki programu

Po commicie nadal wymagane są current-SHA runtime/realDB, pełna macierz permissions/audit/recovery, viewporty 1920/1440/1280/1024, cross-format transfer, dostępność i obserwacja rolloutowa. Legacy nie może zostać usunięte przed spełnieniem bramek zapisanych w `program-gates.json` i `11_IMPLEMENTATION_EVIDENCE_AND_REMAINING_GAPS.md`.

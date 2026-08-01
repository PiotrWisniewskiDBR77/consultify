---
doc_id: RES-003A-completion-report
truth_type: verified-as-is
status: AWAITING_CODEX_REVIEW
owner: claude
product_owner: piotr
priority: P0
last_reviewed: 2026-08-01
---

# RES-003A — Raport końcowy (Linia B, KPI Deviation → Recovery Card canonical loop)

## 0. Metadane

- Repo: `consultify`. Branch: `feat/res-002-canonical-kpi-recovery-loop` (nazwa techniczna niezmieniona per decyzja Codex/Piotr pkt 4; wszystkie nowe artefakty używają identyfikatora `RES-003A`).
- Base SHA: `c522a861839f54d0f26baa918566589aab3f6f6b` (potwierdzony przed startem, nadal ancestor HEAD).
- HEAD końcowy: `b65633c015dd802ce8d71ddbb0362766bbe08bf8`.
- 14 commitów, 18 plików, +6758/−40 linii. `git status` czyste. `git diff --check` czyste (brak whitespace errors). Grep pod kątem sekretów w całym diffie — czyste.
- Worktree osobny, poza głównym brudnym drzewem. Zero push/merge/deploy. Zero mutacji Railway (jedyny kontakt z realną bazą to lokalny, jednorazowy kontener Docker `consultify-acceptance-pg:5442`, usunięty/pozostawiony bez wpływu na demo/prod).

## 1. Root causes (z Fazy 1 discovery)

Zlecenie zakładało 3 konkurencyjne modele KPI. Discovery ujawniło **co najmniej 8 żywych, wzajemnie nieświadomych systemów** (pełna mapa: `RES-002_DISCOVERY_GATE_2026-08-01.md`), w tym dwa niezależne systemy OKR (Results `okr_*` vs Initiatives `goals`) i legacy `/api/benefits` będący druga, ręcznie utrzymywaną implementacją tej samej logiki co kanoniczny `v8/results.routes.ts` — bez kontroli roli. **Recovery Card jako owner object nie istniał w żadnej formie** — ani leksykalnie, ani semantycznie; `kpi_deviation_actions` pokrywał tylko 2 z 8 wymaganych grup pól kontraktu. Zamknięcie deviation case wymagało wyłącznie tekstu, bez weryfikacji nowego pomiaru. To był rdzeń tej linii.

## 2. Wybór kanonicznego store'u

Zgodnie z decyzją Codex/Piotr: `initiative_kpis`/`kpi_time_series`/`kpi_deviation_cases` pozostają kanoniczne dla measurement/deviation (bez zmian). **Nowy kanon dla recovery**: `kpi_recovery_cards` (1:1 z `kpi_deviation_cases`), `kpi_recovery_actions`, `kpi_recovery_checkpoints` — migracja `20260801_res003a_kpi_recovery_card.sql`, wpięta w istniejący silnik przez `handleTimeSeriesRecorded` (jeden punkt integracji, zero zmian w 3 istniejących callerach).

## 3. Los goals/kpi_scorecards/OKR

**Nie ruszone, zgodnie z decyzją**: `goals`/`kpi_scorecards`/dwa systemy OKR pozostają `PRESERVE_AS_IS/READ_ONLY/INTEGRATION_DECISION_PENDING`. Recovery Card nowy flow nie ma żadnej zależności od żadnego z nich (potwierdzone przez frontend/backend writerów).

## 4. Mapa route → UI → API → service → table

```
/results (FE, canonical) → ResultsHub.tsx → KPITimeSeriesDrawer.tsx (zakładka "recovery", flaga OFF)
  → RecoveryCardPanel.tsx → src/services/api/v8/results.ts (V8ResultsApi.*RecoveryCard*)
    → GET/POST/PUT /api/v8/results/(deviation-cases/:caseId/recovery-card|recovery-cards/:id[/...])
      → server/src/routes/v8/results.routes.ts (p04AssertKpiPermission pierwsza linia, manage_deviation)
        → server/src/services/results/kpiRecoveryCardService.ts (owner service)
          → kpi_recovery_cards / kpi_recovery_actions / kpi_recovery_checkpoints (org-scoped, version-guard)
            → read-back: GET zwraca pełną kartę z osadzonymi actions[]/checkpoints[]
```
Wpięcie w istniejący silnik: `kpiDeviationService.ts::handleTimeSeriesRecorded` → `ensureRecoveryCardForCase` (non-fatal try/catch, re-derywuje `organization_id`/`kpi_id` z `kpi_deviation_cases`, nie ufa parametrom callera).

## 5. Zmienione pliki (18)

Pełna lista z `git diff --stat` w §0 powyżej: migracja SQL, integration contract dla Linii C, `kpiPermissions.ts` (nowy, współdzielony), `kpiRecoveryCardService.ts` (nowy, 1087 linii), `results.routes.ts` (+794), `benefits.routes.ts` (+22, RBAC parity), `kpiDeviationService.ts` (+33, wpięcie), `RecoveryCardPanel.tsx` (nowy, 1561 linii), `KPITimeSeriesDrawer.tsx` (+33), `kpiDomain.ts`/`resultsFeatureFlags.ts` (drobne), `src/services/api/v8/results.ts` (+245), 2× `translation.json` (+113 każdy), 2 pliki testowe (real-PG + komponentowe), discovery gate + completion report.

## 6. Commity (14, chronologicznie)

`0fc2ef2886` discovery gate → `b0f6801c83` schema+contract → `8f56be6dd0` RBAC extraction → `85b26ec657`+`8680166e0b` benefits RBAC+testy → `cf0bdd1f68` backend → `7238502d2e` frontend → `30c20ee997`+`643d4bc65b` reconciliation kontraktu → `847e37c609` component tests → `6720e2ee55` real-PG tests → `135b82fafb` fix strefy czasowej → `b65633c015` fix cross-tenant checkpoint. Każdy plik miał jednego writera na commit, zero równoległych edycji tego samego pliku.

## 7. Migracje

Jedna, addytywna: `server/migrations/20260801_res003a_kpi_recovery_card.sql`. Brak kolizji nazwy (zweryfikowane przed utworzeniem i ponownie w adversarial review). `IF NOT EXISTS` wszędzie, zero destructive/backfill, zero zmian w historycznych migracjach. Idempotencja potwierdzona: ponowne zastosowanie na żywym kontenerze bez błędów. Nie użyto numeru 932 (potwierdzone że nie dotyczy tej linii — inna sprawa, Decision workflow).

## 8. Wyniki testów

- **Real-PG** (`tests/acceptance/res003a-kpi-recovery-card.e2e.test.ts`, real Postgres, `RUN_DB_TESTS`-owy wzorzec harnessu acceptance): **20/20 PASS**, potwierdzone wielokrotnie (po naprawie buga strefy czasowej w dwóch strefach, po naprawie cross-tenant checkpoint). Fixture cleanup zweryfikowany — zero rezydualnych wierszy `TEST_RES003A_%`.
- **Component** (`tests/components/Results/RecoveryCardPanel.test.tsx`, real i18next instance zamiast globalnego mocka key-agnostic — świadoma poprawka metodologiczna): **16/16 PASS**.
- **RBAC regression** (`cross-org-idor.test.ts`, real router + mock DB): **102/102 PASS** (59 istniejących + 43 nowych).
- **Razem: 138/138 PASS** na trzech niezależnych warstwach (real-PG, komponent, RBAC-contract).
- **N/A / świadomie pominięte**: pełny `tsc`/`vitest` całego repo (zakaz per CLAUDE.md dla robotników — używano `esbuild` per-plik jako bramki składniowej, zawsze czyste na każdym z ~15 zmienianych plików `.ts(x)`); pełny `npm run build` (nie wymagany na tym etapie); typecheck cross-module (poza zakresem tej linii).

## 9. Negative controls

Wykonane i potwierdzone (real-PG + code review): brak roli → 403 (przed jakimkolwiek DB access, potwierdzone pierwszą-linią-handlera na wszystkich 10 mutujących endpointach v8 + 21 na `/api/benefits`); cross-org → 404 bez wycieku danych (wszystkie 11 endpointów recovery-card + 21 benefits); brak `version` → 400 (nie ciche pominięcie); close bez evidence → `MISSING_EVIDENCE` przed DB touch; close ze stale/breaching pomiarem → odrzucone, `continue`/`escalate` nadal dostępne; idempotency-key retry → jeden wiersz; `x-kpi-role` header self-escalation → zignorowany (W3-wzorzec). **Nowa, dodana w tej rundzie**: cross-tenant `kpiTimeSeriesId` na checkpoincie → `KPI_TIME_SERIES_NOT_FOUND`, zweryfikowane żywym atakiem ad-hoc (BLOCKED) + kontrolą pozytywną tej samej org (OK).

## 10. Concurrency

Real `Promise.all` na żywym Postgresie: dwa równoległe `POST .../recovery-card` dla tego samego case → dokładnie jeden wiersz (unique constraint + `ON CONFLICT DO NOTHING`). Dwa równoległe `close`+`continue` z tym samym `expectedVersion` → dokładnie jeden sukces, drugi `VERSION_CONFLICT`, `version` w DB = 2 nie 3 (przegrany nie zapisał się częściowo). Retry `link-task` → nie tworzy drugiego linku (ale TWORZY drugi, osierocony wiersz `tasks` — patrz §12, znane ograniczenie, nie luka bezpieczeństwa).

## 11. Adversarial findings — dwie niezależne rundy

**Security red-team** (10 wektorów ataku na realny kod): **zero wykorzystywalnych luk**. Wszystkie wymagania decyzji Codex/Piotr potwierdzone w kodzie, nie tylko udokumentowane.

**Świeży adversarial reviewer** (nieświadomy poprzednich raportów): potwierdził sole-writer, poprawny routing, niemożność zamknięcia samym tekstem, brak ścieżki ESCALATE→CLOSE, zero plików zakazanych, idempotencję migracji, brak `.skip`/osłabionych asercji w testach. **Znalazł i osobiście odtworzył na żywym Postgresie realną lukę** (cross-tenant `kpiTimeSeriesId` na checkpoincie) — **naprawione w tej samej rundzie, zweryfikowane** (§9).

## 12. Ryzyka i elementy niewpięte (świadome, nie przeoczone)

1. **Cross-org e2e nie obejmuje na żywo** `actions`(POST/PUT)/`link-task`/`checkpoints`(POST/PUT-resolve)/`escalate` — tylko GET/PUT-card/close/continue/create mają live cross-org test. Zweryfikowane wyłącznie code review (przez oba adversarial rundy, zgodnie). Rekomendacja: dopisać przed promocją na demo.
2. **Orphaned `tasks` na retry `link-task`**: każdy retry tworzy nowy wiersz `tasks`, tylko link jest idempotentny. Znane, udokumentowane w komentarzu testu, niska waga (higiena danych, nie bezpieczeństwo) — do naprawy w osobnym follow-upie.
3. **Stary, zepsuty endpoint `/workflow/kpi/:id/next-action`** (bug `execution_follow_up_ref` z discovery) **pozostaje nietknięty i nadal zepsuty** — celowo, zgodnie z instrukcją "nie dotykaj starego kodu". Zero callerów frontendowych (martwy w UI), ale wciąż osiągalny przez API. Komentarz nagłówka migracji mówi że to "naprawia root cause" tego buga — to jest lekkie nadinterpretowanie: naprawia przez DOSTARCZENIE nowej, poprawnej ścieżki (`/recovery-cards/:id/actions/:actionId/link-task`), nie przez naprawę/usunięcie starej. Rekomendacja: osobny mały ticket do zablokowania/usunięcia starego endpointu.
4. **Acceptance harness repo-wide jest zepsuty dla czystego checkoutu** (brakujące tabele spoza `never-ran/`, m.in. `ai_agent_plans` i in.) — pre-existing, niezwiązane z RES-003A, odtworzone i obejście udokumentowane przez test-agentów, ale wymaga ręcznej łatki DDL na kontenerze za każdym razem. Poza zakresem tej linii, warto zgłosić osobno.
5. **`updateRecoveryCard` (PUT card) świadomie nie pozwala ustawić `decision`** — to jest zamierzone (jedyna droga do CLOSE to dedykowany endpoint z pełną bramką), potwierdzone przez adversarial review jako brak luki, nie przeoczenie.
6. **`escalateTo`/mechanizm adresata eskalacji NIE zbudowany** — świadomie, `escalationForSignal` to martwy kod bez wywołań; budowa całego systemu eskalacji czasowej/notyfikacji jest poza zakresem tej rundy (frozen scope).
7. **Węższa capability dla close/escalate niż `manage_deviation`** — nierozstrzygnięte, `NEEDS_CODEX_DECISION` z Fazy 2, nadal otwarte.
8. **Integration contract dla Linii C** (`RES-003A_INTEGRATION_CONTRACT_FOR_LINE_C.md`) — gotowy, ale fizyczne wpięcie `initiativeKpiAssignmentService.ts` NIE wykonane w tej rundzie (poza zakresem/zakazany plik), pozostaje bramką dla przyszłego, kontrolowanego okna integracji B/C. Bez tego wpięcia: aktualizacje KPI z Execution/PMO nadal NIE tworzą Deviation Case ani Recovery Card (znany, udokumentowany, świadomy gap sprzed tej linii).

## 13. Rollback

Migracja jest czysto addytywna — rollback to `DROP TABLE IF EXISTS kpi_recovery_checkpoints, kpi_recovery_actions, kpi_recovery_cards CASCADE;` (w tej kolejności FK), zero wpływu na istniejące dane `kpi_deviation_cases`/`kpi_time_series`/`initiative_kpis`. Flaga frontendowa `recoveryCard` domyślnie **OFF** — całość jest niewidoczna w UI dopóki ktoś jawnie nie włączy flagi (zgodnie z regułą #7 CLAUDE.md, brak odbioru wizualnego Piotra jeszcze nie nastąpił). Backend endpoints są żywe niezależnie od flagi FE, ale wymagają `manage_deviation` (nie są publicznie odkrywalne bez wiedzy o istnieniu API). Bezpieczny punkt cofnięcia: dowolny commit sprzed `b0f6801c83` (pierwszy commit tej linii).

## 14. Clean-tree proof

`git status --short` → puste. `git diff --check` → puste (brak whitespace errors). HEAD `b65633c015` jest potomkiem base SHA `c522a86183`. Zero plików spoza dozwolonego obszaru (zweryfikowane dwukrotnie, przez security red-team i świeży adversarial reviewer, przeciwko pełnej liście zakazanych plików z mandatu — zero trafień).

## 15. Rozdział: wykonane testy / code-level proof / N/A / unresolved risks

- **Wykonane testy (real-PG + component + RBAC)**: §8, §9, §10 — 138/138 PASS, w tym testy negative-control i concurrency na żywym Postgresie.
- **Code-level proof (bez live-test)**: 5 z 11 endpointów recovery-card (actions/link-task/checkpoints/escalate) — zweryfikowane przez czytanie kodu przez oba adversarial rundy niezależnie, zgodne wnioski, ale bez dedykowanego cross-org e2e (§12.1).
- **N/A**: pełny tsc/build repo (poza higieną robotnika), fizyczne wpięcie Linii C (poza zakresem), mechanizm eskalacji-adresata (poza zakresem tej rundy).
- **Unresolved risks**: §12, punkty 1-3 i 7-8 wymagają decyzji lub follow-upu Codex; żaden nie blokuje bezpieczeństwa danych demo (flaga OFF, brak fizycznego wpięcia Linii C = brak nowego ruchu danych bez jawnej zgody).

---

## Status

**AWAITING_CODEX_REVIEW**

Wszystkie zadania w tej linii zatrzymane. Nie podejmuję kolejnej rundy bez odpowiedzi Codex, zgodnie z protokołem. Bez push, merge, deploy i mutacji Railway.

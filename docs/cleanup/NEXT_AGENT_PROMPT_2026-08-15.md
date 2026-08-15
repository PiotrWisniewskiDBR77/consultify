# Prompt dla następcy — Consultify canonical completion

Skopiuj cały tekst poniżej do nowego zadania.

---

Jesteś głównym CTO-integratorem Consultify. Pracuj do skutku nad istniejącym,
pełnym celem — nie redukuj go do zielonego podzbioru testów ani do samego
raportu.

## Cel

Doprowadź środowisko Consultify do jednego zabezpieczonego, czystego i
zrozumiałego drzewa kanonicznego, zintegruj całą wartościową pracę,
sklasyfikuj i domknij stan wszystkich modułów oraz przygotuj system do
systematycznych odbiorów i poniedziałkowego MVP.

## Zacznij tutaj

Jedyny kanon roboczy:

- checkout:
  `/Users/piotrwisniewski/Developer/consultify-canonical-full-20260814`
- branch: `codex/consultify-canonical-cleanup-20260814`
- oczekiwany HEAD handoffu:
  `3c5f8e2d739e4da2bb9f5a7e809d8327a70652fc`

Najpierw przeczytaj w całości:

1. `docs/cleanup/HANDOFF_2026-08-15_CANONICAL_COMPLETION.md`
2. `docs/SOURCE_OF_TRUTH.md`
3. `docs/FUNCTIONAL_DOCUMENTATION.md`
4. `docs/modules/APPLICATION_LOGICAL_MODEL.md`
5. `docs/modules/MODULE_HANDOFFS.md`
6. `docs/ssot/COMPLETE_DOCUMENTATION_STANDARD.md`
7. `docs/cleanup/ACCEPTANCE_CHECKPOINT_2026-08-15.md`
8. `docs/cleanup/MODULE_ACCEPTANCE_STATUS_2026-08-15.md`
9. `docs/cleanup/FAIL_TRIAGE_2026-08-15.md`

Następnie zweryfikuj, a nie zakładaj:

```bash
cd /Users/piotrwisniewski/Developer/consultify-canonical-full-20260814
git status --short
git branch --show-current
git rev-parse HEAD
git log -12 --oneline
```

Jeśli checkout nie jest clean albo HEAD został przesunięty, zatrzymaj
integrację, ustal właściciela zmian i sklasyfikuj różnicę. Nie wykonuj reset,
clean, stash ani checkout-overwrite.

Repozytorium iCloud
`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` jest kwarantanną i
źródłem recovery evidence, nie integration base. Niczego tam nie usuwaj.

## Potwierdzony stan

- Pełny historyczny standard gate `f6a005528...`: 4052/4052 pliki,
  38,798 PASS, 581 FAIL, 485 pending, 19 todo, 283 non-green. To baseline, nie
  aktualny wynik.
- Skoncentrowany P1 na obecnym ancestry: 357/357 plików PASS, 2,179 PASS,
  2 skipped, 0 FAIL, 0 errors.
- Build/typecheck/backend build były PASS przed ostatnią paczką; powtórz je na
  finalnym candidate SHA.
- 373 checkouty zostały zinwentaryzowane; 144 dirty zabezpieczono w
  `/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814`.
- Nadal istnieje delta co najmniej 3 untracked w iCloud po snapshotcie oraz
  460 `UNKNOWN_OBJECT` tip SHA.
- Dokumentacja modułów z 31 lipca, commit `20a03461e...`, jest już przodkiem
  kanonu.

## Zadania — wykonuj w tej kolejności

### 1. Domknij recovery authority

- dosnapshotuj tylko przyrost po poprzednim snapshotcie;
- utrwal ledger unikalnych clean-local SHA i `UNKNOWN_OBJECT` refs;
- nie usuwaj i nie integruj brudnych branchy w całości;
- każdą wartościową zmianę przenoś jako pojedynczy commit lub modułowy diff z
  testem i provenance.

### 2. Dokończ pełny audyt wszystkich 16 pozycji menu

Audyt 12 głównych obszarów już istnieje w handoffie. Dokończ obowiązkowo:

- Interview;
- Meeting;
- Organization;
- Admin Panel;
- Settings;
- Partner Portal.

Dla każdego modułu, bez wyjątku, przygotuj:

`purpose → input → output → must-not-own → route → UI → API → service → DB/migrations → flags → tests → demo → AS-IS → TO-BE → GAP → exact work → DoD`.

Każdy komponent sklasyfikuj jako mounted, unmounted, duplicate, fallback,
mock/stub, runtime-proven albo evidence-missing. Nie myl dokumentu docelowego z
dowodem wdrożenia.

### 3. Przygotuj decyzje integracyjne P0

- Jeden owner Case: `transformation_cases` vs `case_core` vs `ai_agent_plans`.
  Dla poniedziałkowego MVP rekomendacja handoffu to tymczasowo
  `transformation_cases`, Cases OFF, legacy Agent Plan poza normalnym flow.
- Results: `/results` nie może prowadzić do disabled shell. Przygotuj jawny
  cutover wszystkich KPI/ROI/OKR VNext albo świadomy rollback.
- Finance: pozostaje closed poza MVP; przygotuj bridge/backfill/unresolved
  report i plan legacy retirement.
- Assessment: MVP tylko DRD; usuń runtime DDL/fallback ambiguity i sprawdź
  report redirect.
- Tools: MVP tylko Dynamic SWOT; generic empty outputs nie są DONE.
- Audits: poza MVP albo uczciwy base CRUD beta; wybierz jeden UI/API owner.

### 4. Zamontuj i odbierz poniedziałkowe MVP

Zakres rekomendowany:

1. Chat core.
2. My Work: Inbox, Tasks, Decisions, Ideas, Notebook, Calendar.
3. Agent na jednym Case ownerze.
4. Assessment DRD.
5. Tools Dynamic SWOT.
6. Initiatives core.
7. Execution core.
8. Materials: jeden prawdziwy DOC, PPT i XLSX flow.
9. Results tylko po prawidłowym cutoverze KPI/ROI/OKR.

Finance, pełne Cases i pełne Audits pozostają później, o ile Product Owner nie
zmieni świadomie zakresu.

### 5. Dowody — nie deklaracje

Dla każdego odbieranego modułu wymagaj:

- ordinary route bez query/localStorage activation;
- real production UI;
- API mount i service;
- fresh oraz upgrade migration ledger;
- realDB write/readback i tenant/role negative;
- focused tests;
- pełny odpowiedni gate na jednym SHA;
- deployment dokładnie tego SHA;
- signed-in browser desktop/mobile;
- network/console review;
- visual acceptance względem Consultify UI canon;
- honest empty/error/blocked/retry states.

Nie nazywaj DONE funkcji tylko dlatego, że ma kod, route, flagę, mock, build,
lokalny test albo została wdrożona.

### 6. Raport końcowy

Zaktualizuj istniejące pliki cleanup i utwórz precyzyjny modułowy gap plan.
Raport ma rozdzielić:

- co zostało zabezpieczone;
- co jest w kanonie;
- co istnieje, ale nie jest podłączone;
- co jest duplikatem;
- co pozostaje w kwarantannie;
- co można później usunąć i jak to odzyskać;
- co wchodzi do MVP;
- co zostaje po MVP;
- jakie literalne dowody potwierdzają każdy status.

## Zasady bezpieczeństwa

- Żadnego `git reset --hard`, `git clean`, broad stash, broad staging ani
  repo-wide auto-fix.
- Żadnego usuwania worktree/branch/migracji/orphan candidates bez recovery
  proof, jawnej allowlisty i możliwości odtworzenia.
- Żadnego merge całego dirty brancha.
- Shared files integruj seryjnie i commituj dokładne ścieżki.
- Jeśli pracujesz równolegle, każdy agent dostaje rozłączny zakres i własny
  worktree albo ścisłą allowlistę.
- Pracuj do skutku. Co 30–60 minut podawaj krótki, liczbowy status: wykonane,
  bieżący gate, nowe ryzyko, następny krok.

Nie oznaczaj całości jako ukończonej, dopóki wszystkie wymagania z sekcji
Definition of Done w handoffie nie są potwierdzone aktualnym evidence.

---

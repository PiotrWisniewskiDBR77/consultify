---
doc_id: f2-f3-przebieg-wieczor
status: przygotowanie do jednego posiedzenia (nadzorca + właściciel)
zbudowane: 2026-09-06, na gałęzi próbnej `mvp/promocja-na-sucho` (worktree
  `/private/tmp/wt-promocja`, baza `codex/m03-admin-20260824` = `origin/staging`)
zakaz: NIC z tego dokumentu nie zostało wykonane na żywo — wszystkie pomiary
  poniżej to odczyt (`railway variables --json`, `railway deployment list`,
  `git ls-remote`, `gh run list`, `curl /api/health`) i próba na LOKALNEJ bazie
  `consultify_demo_proba` (utworzona i usunięta w tej samej sesji).
---

# F2+F3: przebieg jednego posiedzenia — promocja kodu i zmiennych staging → demo

## ⚠ USTALENIE KRYTYCZNE SPRZED STARTU (przeczytać przed krokiem 1)

Zlecenie zakładało prostą ścieżkę „merge origin/staging → push do demo”. Pomiar na
żywo (06.09, odczyt `gh run list` + `git ls-remote` + `curl /api/health`) pokazuje
**inny, węższy mechanizm niż założenie**, i jedną realną przeszkodę:

1. **Push na gałąź `demo` NIE URUCHAMIA ŻADNEGO WORKFLOW.**
   `.github/workflows/railway-deploy.yml` nie ma triggera `on.push` dla gałęzi
   `demo` — jedyny sposób wdrożenia na demo to ręczny
   `workflow_dispatch(environment=demo, confirm_demo=yes)`, który **ignoruje**
   gałąź `demo` i checkoutuje **detached HEAD na SHA wskazywanym przez tag
   `staging-deployed`** (`git checkout --detach $(git rev-parse refs/tags/staging-deployed)`).
   Aktualizacja gałęzi `demo` (merge/push) jest więc co najwyżej KSIĘGOWOŚCIĄ
   „co jest na żywo”, nigdy mechanizmem promocji — i sam plik
   `LISTA_KONTROLNA_PROMOCJI.md` już to mówi wprost („Push na gałąź `demo` **nie**
   wdraża niczego”), niezależnie od tego zlecenia.

2. **Tag `staging-deployed` jest DZIŚ NIEAKTUALNY o 835 commitów.**
   Zmierzone 06.09 09:xx UTC:
   - `git ls-remote origin refs/tags/staging-deployed` → `b852ade6164e...` (commit
     z 2026-09-04 21:23, „build(staging): przekaz 4 brakujące flagi VITE…”)
   - `origin/staging` (branch tip) → `dd321379bb1dab...` — **835 commitów DALEJ**
     niż tag (`git log --oneline b852ade6..origin/staging | wc -l` = 835)
   - `curl https://staging.consultify.ai/api/health` → `gitSha` =
     `dd321379bb1dab...` — **staging na żywo już serwuje ten nowszy commit**
   - `gh run list --workflow=railway-deploy.yml` (ostatnie 15 uruchomień):
     ostatni **SUKCES** zadania `Deploy Staging` = 2026-09-04 21:24 → `b852ade616`
     (to jest właśnie ten tag). Jedyna próba PO tym (2026-09-05 07:28,
     `workflow_dispatch`, SHA `5ffdabe05e`) **ZAKOŃCZYŁA SIĘ FAILURE** na kroku
     „Deploy app to staging” — obraz zbudował się i wypchnął poprawnie
     (`image push … status: complete` o 07:31:42), ale sam deployment Railway
     dostał status `FAILED` (id `3ba25599-...`, `deployment status: FAILED` o
     07:34:09) — najpewniej na `preDeployCommand: node
     dist/scripts/release-migration-gate.js` z `railway.json` (bramka migracji
     w Railway) albo na healthchecku uruchomieniowym; log workflow nie pokazuje
     wprost przyczyny FAILED poza samym statusem.
   - **Wniosek:** to, co serwuje `staging.consultify.ai` DZIŚ (`dd321379bb`),
     trafiło tam z pominięciem tego workflow (ręczny `railway up` z laptopa —
     wzorzec znany z pamięci „duży push nie wyzwala workflow”). Tag
     `staging-deployed`, na którym opiera się CAŁA ścieżka `promote-demo`, o tym
     nie wie.

   **SKUTEK: jeśli dziś wieczorem ktoś odpali `workflow_dispatch(environment=demo,
   confirm_demo=yes)` bez naprawy tagu, promocja wyśle na demo STARY commit
   `b852ade6` (sprzed 835 commitów), NIE bieżący stan stagingu.** To nie jest
   teoria — to zmierzony, aktualny stan tagu na GitHubie.

3. **Rozwiązanie (dodane do sekwencji poniżej jako KROK 3, przed właściwą
   promocją):** trzeba najpierw doprowadzić do NOWEGO zielonego przebiegu
   zadania `Deploy Staging`, które samo zapisze świeży tag `staging-deployed`
   na właściwym SHA. Najprostszy sposób bez ruszania gałęzi `develop`:
   `workflow_dispatch` z `environment=staging`, uruchomiony **na gałęzi
   `staging`** (warunek `if:` zadania `deploy-staging` akceptuje
   `github.ref == 'refs/heads/staging'` dla `workflow_dispatch`). To przebuduje
   i wdroży dokładnie to, co już jest żywe na stagingu — bezpieczne (nie zmienia
   treści), ale JEST WYMAGANE, żeby tag się zgadzał.
   **STOP, jeśli ten przebieg powtórzy FAILURE z 09-05** — wtedy przed dalszą
   promocją trzeba zdiagnozować `release-migration-gate.js` / healthcheck na
   stagingu (osobne zadanie, poza zakresem tego dokumentu — nie próbować obejść
   przez ręczny tag `git tag -f` bez zrozumienia przyczyny).

4. **Migracje: bramka na sucho WYKONANA w tej sesji, WYNIK POZYTYWNY (patrz
   `evidence/promocja-na-sucho/RAPORT_20260906.md` — raport tego samego
   zlecenia).** `git diff --name-status origin/demo HEAD -- server/migrations`
   po scaleniu próbnym `origin/demo` ← `origin/staging`: **216 nowych plików
   (dodane), 1 plik zmieniony (`server/migrations/README.md` — tekst, nie SQL),
   1 plik usunięty (`never-ran/017_consultant_mode.sql.sql` — nigdy
   nieuruchamiany, podwójne rozszerzenie)**. Zero zmodyfikowanych migracji SQL.
   Na świeżej bazie `consultify_demo_proba` (kontener `consultify-noc-pg`,
   port 54400) `migrate.postgres.ts` przeszedł **bez błędu** (904 wpisy w
   `schema_migrations`, **1806 tabel** po migracji). Baza próbna usunięta po
   pomiarze. **To NIE jest bramka na bazie `trolley`** (to jest zakazane —
   „na sucho” = tylko lokalny kontener) — jest to dowód, że łańcuch migracji
   jest spójny i addytywny; ostateczne potwierdzenie na `trolley` robi krok 8
   poniżej (`release-migration-gate.js` / `preDeployCommand`, uruchamiany przez
   samą infrastrukturę Railway przy realnym deployu).

---

## Kolejność wieczoru (kod PRZED zmiennymi — patrz uzasadnienie w kroku 7)

| # | Krok | Komenda | Oczekiwany wynik | STOP |
|---|---|---|---|---|
| 1 | Kopia bazy demo (`trolley`), punkt powrotu danych | `KATALOG_KOPII="$HOME/kopie-consultify" DATABASE_URL="<public URL demo, z Railway>" bash scripts/demo/kopia-bazy.sh --oczekiwany-host trolley --etykieta przed-f2f3-20260906` | ścieżka manifestu na stdout, plik `.dump` + `.manifest.json`, rozmiar > 0 | skrypt odmawia (zły host / cel = produkcja) |
| 2 | Punkt powrotu kodu i zmiennych | `railway deployment list --service consultify --environment demo --limit 1 --json --project a6d59e88-263d-45f3-96bc-861f66bf467b` **i** `railway variables --json --environment demo --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b > "$HOME/demo-vars-przed-$(date -u +%Y%m%dT%H%M%SZ).json"` | zapisany `commitHash`/SHA ostatniego `SUCCESS` (dziś: brak commitHash w metadanych bo ostatni SUCCESS to `railway up` bez GitHuba, 2026-08-26 — użyj `gitSha` z `/api/health` = `f3237e94230481d2bf4ad0a9c0dc10b1391191c9` jako punktu powrotu); plik zmiennych istnieje, kluczy = 184 (zmierzone dziś) | plik nie zapisał się / 0 kluczy |
| 3 | **NOWE — odświeżenie tagu `staging-deployed`** (patrz ustalenie #2 wyżej) | GitHub → Actions → **Railway Deploy** → Run workflow → branch: **`staging`**, `environment=staging` (zostaw `confirm_demo`/`confirm_production` na `no`) | zadanie `Deploy Staging` kończy się **SUCCESS**; krok „Record successful staging SHA (tag)” loguje `git push origin -f refs/tags/staging-deployed`; `git ls-remote origin refs/tags/staging-deployed` = SHA aktualnego `origin/staging` (dziś `dd321379bb1dab...`, ale sprawdź na żywo — staging mógł się ruszyć) | FAILURE na „Deploy app to staging” (jak 09-05) → STOP, diagnoza `release-migration-gate.js`/healthcheck PRZED dalszymi krokami, nie próbować ręcznego `git tag -f` |
| 4 | Sprawdzenie: tag = to, co ma pójść na demo | `git fetch --tags origin && git rev-parse refs/tags/staging-deployed^{commit}` | SHA = SHA ze zdrowia stagingu (`curl https://staging.consultify.ai/api/health` → `gitSha`) | rozjazd → wróć do kroku 3 |
| 5 | Bramka celu (lokalnie, przed realnym pushem — powtórka `validate-deploy-target.sh` z prawdziwymi sekretami, ale BEZ deployu) | `DEPLOY_ENVIRONMENT=demo GIT_REF=refs/tags/staging-deployed FRONTEND_URL=https://demo.consultify.ai TARGET_ENVIRONMENT=demo DEPLOY_TARGET_GUARD_ENFORCE=1 DEMO_DB_HOST_FINGERPRINT=trolley APP_DATABASE_URL="<z Railway, DEMO_APP_DATABASE_URL>" MIGRATION_DATABASE_URL="<z Railway, DEMO_MIGRATION_DATABASE_URL>" bash scripts/validate-deploy-target.sh` | `deploy-target: ok for demo (refs/tags/staging-deployed -> demo.consultify.ai, db identity verified: migration and application agree)` | `DEC-165 DIVERGENCE` lub `frontend host … not allowed` → STOP, nie promować |
| 6 | **Promocja kodu**: uruchom `promote-demo` | GitHub → Actions → **Railway Deploy** → Run workflow → `environment=demo`, `confirm_demo=yes` (branch dowolny — job i tak checkoutuje detached HEAD na tag) | krok „Resolve immutable promotion source” loguje `promoting staging-deployed = <SHA z kroku 4>`; zadanie `Promote staging-deployed to Demo` = SUCCESS; krok „Verify demo deployment” = zielony | `confirm_demo` inny niż dokładnie `yes` → zadanie w ogóle się nie odpali (warunek `if:`), nic się nie stanie — to jest bezpieczne, nie STOP |
| 7 | Health = SHA (PRZED zmianą zmiennych) | `curl -fsSL https://demo.consultify.ai/api/health` | `gitSha` = SHA z kroku 4/6 | rozjazd → NIE przechodzić do kroku 8, sprawdzić `railway deployment list --environment demo` |
| 8 | **Zmienne** — dopiero TERAZ, PO promocji kodu | `bash docs/program/demo-pilotaz/F2_ZMIENNE_DEMO.sh` — **PO JEDNEJ komendzie, wklejane ręcznie, z odczytem po każdej** (plik ma to opisane w nagłówku; wszystkie komendy mają `--skip-deploys`, więc żadna sama z siebie NIE odpala redeployu) | po każdej: `railway variables --json --environment demo --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b \| jq '.<KLUCZ>'` pokazuje nową wartość | dowolna komenda zwraca błąd `railway` (np. zła nazwa usługi) → STOP, nie kontynuować listy w ciemno |
| 9 | **Rebuild z nowymi zmiennymi** (VITE_\* są wbudowywane w BUILD, nie runtime — restart bez rebuildu ich nie podniesie) | Powtórz KROK 6 dokładnie: GitHub → Actions → Railway Deploy → Run workflow → `environment=demo`, `confirm_demo=yes` | znowu `promoting staging-deployed = <ten sam SHA co w kroku 6>` (tag się nie zmienił — to jest REBUILD tego samego SHA, teraz z nowymi zmiennymi w środowisku budowy), `Promote staging-deployed to Demo` = SUCCESS | SHA w logu RÓŻNI się od kroku 6 → ktoś w międzyczasie zmienił tag/staging — STOP, wyjaśnić przed dalej |
| 10 | Health = SHA (PO zmiennych i rebuildzie) | `curl -fsSL https://demo.consultify.ai/api/health` **i** `railway deployment list --service consultify --environment demo --limit 1 --json --project a6d59e88-263d-45f3-96bc-861f66bf467b` | `gitSha` z health = `commitHash`/SHA z deployment list = SHA z kroku 4 — **te trzy liczby muszą być tą samą liczbą** (pamięć: „duży push nie wyzwala workflow”, „health gitSha przybity zmienną”) | dowolna z trójki się różni → promocja NIE jest potwierdzona, nawet jeśli wszystko świeci zielono |
| 11 | Flagi po fakcie | `railway variables --json --environment demo --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b > /tmp/demo-po.json && railway variables --json --environment staging --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b > /tmp/staging-po.json && node scripts/demo/porownaj-flagi.mjs /tmp/staging-po.json /tmp/demo-po.json` | `OK flagi: demo ma wszystkie flagi obecne na stagingu`, `OK flagi: żadna wspólna flaga nie ma sprzecznej wartości`, `OK flagi: CSRF_MODE ustawione = „report"`, `OK flagi: AI_BUDGETS_ENABLED ustawione = „true"` | jakikolwiek `ŹLE` poza świadomym odstępstwem (patrz `VITE_I18N_DEBUG` w F2_ZMIENNE_DEMO.sh) → wróć do kroku 8 dla brakującej flagi |
| 12 | Smoke 3 ekranów (właściciel patrzy na ŻYWO, nie na deklarację) | otwórz `https://demo.consultify.ai` zalogowany jako administrator demo → **(a)** My Work (lista + jeden rekord), **(b)** Assessment (lista sesji + jeden wynik), **(c)** Initiatives (lista + jeden artefakt) — trzy zrzuty | właściciel: „Tak” na każdy z trzech, jednym zdaniem | „Nie” na dowolny → flaga OFF danego ekranu (`railway variables --set "VITE_X=false" --skip-deploys …` + krok 9 ponownie) lub rollback Railway (patrz niżej) |
| 13 | Zamrożenie | `git tag demo-safe-$(date -u +%Y%m%d) <SHA z kroku 4> && git push origin demo-safe-$(date -u +%Y%m%d)` | tag widoczny na `origin` | — |

---

## Cofnięcie (jeśli coś pójdzie źle w trakcie)

| Objaw | Ruch | Czas |
|---|---|---|
| Zła flaga / regres wizualny na jednym ekranie | `railway variables --set "VITE_X=false" --skip-deploys --environment demo --service consultify --project a6d59e88-263d-45f3-96bc-861f66bf467b` + krok 9 (rebuild) | ~5 min (rebuild) |
| Crash / regres funkcjonalny całej aplikacji | Railway dashboard → deployments → poprzedni `SUCCESS` (2026-08-26, `f3237e94...`) → **Rollback** | 30 s |
| Zła baza / utrata danych | `bash scripts/demo/przywroc-baze.sh --manifest <manifest z kroku 1> --oczekiwany-host trolley --tak-nadpisz` | 20–60 min |
| Wiele commitów do cofnięcia (kod) | restore-commit **do przodu**, `_RUNBOOK_COFANIA.md` warstwa 3 — NIGDY `git push --force`/`reset` na `demo` | ~10 min |

Po **każdym** cofnięciu powtórz krok 10 (trzy liczby = ta sama liczba) — redeploy
wywołany zmianą zmiennej po rollbacku bierze commit z tego, co Railway aktualnie
uważa za źródło, nie automatycznie to, co było przed awarią.

---

## Co NIE zostało dziś zrobione (świadomie, poza zakresem tego zlecenia)

- Krok „Deploy production” — nie dotyczy F2/F3, ma osobną bramkę
  (`scripts/deploy-gate.sh`) i wymaga `confirm_production=yes` na `refs/heads/main`.
- Diagnoza PRZYCZYNY źródłowej, dlaczego staging na żywo (`dd321379bb`) rozjechał
  się z ostatnim zielonym przebiegiem workflow (`b852ade6`) — czyli KTO i JAK
  wdrożył `dd321379bb` z pominięciem CI. Warto to ustalić osobno (bezpiecznik na
  przyszłość), ale nie blokuje dzisiejszej promocji, o ile krok 3 wykona się
  zielono.
- 13 zmiennych operacyjnych (nie-flag) obecnych na stagingu, brakujących na
  demo (`SMTP_*`, `ALERT_EMAIL_RECIPIENTS`, `DISABLE_RATE_LIMIT`,
  `INBOX_WEBHOOK_SECRET`, `TEST_SUPPORT_KEY`, `UNSPLASH_ACCESS_KEY`,
  `WHATSAPP_FROM`, `DB_MANAGED_SCHEMA`, `DEV`, `API_RATE_LIMIT_MAX`,
  `RATE_LIMIT_ALLOW_PROD_DISABLE`, `ALLOW_BRANDED_DEMO_ORG`,
  `PARTNER_SELF_CONNECT_ENABLED`) — wykryte przy porównaniu WSZYSTKICH kluczy,
  ale poza definicją „flaga” w `porownaj-flagi.mjs` i poza literą zlecenia
  (27 flag). Osobna decyzja właściciela, jeśli mają trafić na demo — dwie z nich
  (`INBOX_WEBHOOK_SECRET`, `TEST_SUPPORT_KEY`) wyglądają jak sekrety i NIE
  powinny nigdy trafić do pliku w repo.
- Kwota budżetu AI (50 USD/org/mies., DEC-402) — nie istnieje jako zmienna
  środowiskowa (`rg AI_BUDGET server/src` → tylko `AI_BUDGETS_ENABLED` i
  `AI_BUDGET_EXHAUSTED`); żyje w serwisie/tabeli `aiBudgetService`, konfiguracja
  kwoty to osobny krok poza `railway variables`.


## Uzupełnienie po diagnozie 06.09 11:10 (TAG-STAGING-DIAGNOZA)
- Padnięty run 05.09 = błąd typów naprawiony tego samego dnia (`b488d0a523`); wystarczy powtórzyć `gh workflow run railway-deploy.yml -f environment=staging -f confirm_demo=no -f confirm_production=no`, gdy gałąź `staging` jest cicha ≥2 min (auto-deploy z pusha ściga się z `railway up` z workflow).
- Workflow ustawia `APP_BUILD_SHA` na stagingu → po zielonym runie: `railway variable delete APP_BUILD_SHA --environment staging --service <app>` (inaczej health kłamie po następnym auto-deployu).
- Dopiero potem `-f environment=demo -f confirm_demo=yes`. Ręczne `git tag -f staging-deployed` = tylko incydentowo (bramka nie weryfikuje pochodzenia tagu, ale to łamie jej cel).

# LISTA KONTROLNA — promocja staging → demo (jedna strona)

Data ćwiczenia: `____________`  ·  Prowadzi: `____________`  ·  SHA promowany: `____________`

Ścieżka obowiązująca od 2026-08-31: demo dostaje **wyłącznie** SHA z taga
`staging-deployed`, przez workflow `Railway Deploy` (`.github/workflows/railway-deploy.yml`,
zadanie `promote-demo`). `scripts/deploy-demo.sh` jest wycofany i sam się blokuje.
Push na gałąź `demo` **nie** wdraża niczego.

---

## PRZED (5 kroków, żaden do pominięcia)

| ✓ | krok | komenda | oczekiwany wynik |
|---|---|---|---|
| ☐ | 1. Punkt powrotu kodu | `railway deployment list --service consultify --environment demo --limit 1 --json` | zapisany `commitHash` ostatniego `SUCCESS` |
| ☐ | 2. Kopia bazy demo | `KATALOG_KOPII="$HOME/kopie-consultify" DATABASE_URL="<public url demo>" bash scripts/demo/kopia-bazy.sh --oczekiwany-host <host> --etykieta przed-promocja` | ścieżka manifestu na stdout; `tabel w zrzucie` > 0 |
| ☐ | 3. Kopia daje się odczytać | `bash scripts/demo/przywroc-baze.sh --manifest <manifest> --oczekiwany-host <host>` (bez `--tak-nadpisz`) | `TRYB SPRAWDZENIA — nic nie zapisano`, kod 0 |
| ☐ | 4. Punkt powrotu zmiennych | `railway variables --environment demo --service consultify --json > "$HOME/demo-vars-przed-$(date -u +%Y%m%dT%H%M%SZ).json"` | plik istnieje, liczba kluczy > 150 |
| ☐ | 5. Bramka celu przechodzi | `DEPLOY_ENVIRONMENT=demo GIT_REF=refs/tags/staging-deployed FRONTEND_URL=https://demo.consultify.ai TARGET_ENVIRONMENT=demo DEPLOY_TARGET_GUARD_ENFORCE=1 DEMO_DB_HOST_FINGERPRINT=<host> APP_DATABASE_URL="$DB" MIGRATION_DATABASE_URL="$DB" bash scripts/validate-deploy-target.sh` | `deploy-target: ok for demo (… db identity verified …)` |

**Migracje:** tylko addytywne (`ADD COLUMN IF NOT EXISTS`) — wtedy cofnięcie kodu
nie wymaga cofania bazy. Sprawdzenie, że nikt nie ruszył historii:
`git diff --stat <baza>..HEAD -- server/migrations` → **żadnego zmodyfikowanego pliku**,
tylko nowe. Migracja destrukcyjna = osobna decyzja właściciela i osobna tabela kopii.

---

## PROMOCJA

| ✓ | krok | jak | oczekiwany wynik |
|---|---|---|---|
| ☐ | 6. Tag `staging-deployed` wskazuje właściwy SHA | `git fetch --tags origin && git rev-parse refs/tags/staging-deployed^{commit}` | ten sam SHA, który przeszedł zielono na stagingu |
| ☐ | 7. Uruchom workflow | GitHub → Actions → **Railway Deploy** → Run workflow → `environment=demo`, `confirm_demo=yes` | zadanie `promote-demo` startuje (bez tego wpisu `yes` warunek `if:` w ogóle go nie odpali) |
| ☐ | 8. Workflow zielony | log zadania | krok „Resolve immutable promotion source" wypisuje `promoting staging-deployed = <SHA>` |

**Merge, nie force.** Jeśli kiedykolwiek trzeba ruszyć gałąź `demo` (ścieżka
awaryjna, tylko incydent): `git merge <branch> --no-ff` w osobnym worktree i
`git push origin HEAD:demo`. **Nigdy `--force`, `reset` ani `rebase` na `demo`** —
to był krach nocy 3/4. Cofanie zawsze do przodu (`_RUNBOOK_COFANIA.md`, warstwa 3).

---

## PO (dowód, nie deklaracja)

| ✓ | krok | komenda | oczekiwany wynik |
|---|---|---|---|
| ☐ | 9. Health = SHA | `bash scripts/demo/sprawdz-demo.sh --tylko-zdrowie --oczekiwany-sha <SHA>` | `OK zdrowie: gitSha = wdrożony commit (<SHA>)`, `WERDYKT: zgodność` |
| ☐ | 10. Wdrożenie zgadza się z tagiem | `railway deployment list --service consultify --environment demo --limit 1 --json` | `commitHash` = SHA z kroku 6 **i** = `gitSha` z kroku 9 |
| ☐ | 11. Baza i flagi | `OCZ_KLUCZE=<N> DATABASE_URL=… bash scripts/demo/sprawdz-demo.sh --oczekiwany-host <host> --oczekiwany-sha <SHA> --flagi-staging /tmp/staging-vars.json --flagi-demo /tmp/demo-vars.json` | `WERDYKT: zgodność` |
| ☐ | 12. Właściciel klika żywe demo | jeden obraz, Tak/Nie, jedno zdanie | „Tak" właściciela |
| ☐ | 13. Zamrożenie | `git tag demo-safe-$(date -u +%Y%m%d) <SHA> && git push origin demo-safe-$(date -u +%Y%m%d)` | tag na origin |

**Trzy liczby muszą być tą samą liczbą:** SHA z taga `staging-deployed`,
`commitHash` z `railway deployment list`, `gitSha` z `/api/health`. Rozjazd
którejkolwiek pary = promocja **nie** jest potwierdzona, choćby wszystko świeciło
na zielono (pamięć: „health gitSha przybity zmienną", „duży push nie wyzwala workflow").

---

## COFNIĘCIE (jeśli coś pójdzie źle)

| objaw | ruch | czas |
|---|---|---|
| brzydki ekran / regres wizualny | wyłącz flagę `VITE_*` na demo (`railway variables --set "VITE_X=false" --environment demo --service consultify`) | 2 min |
| crash / regres funkcjonalny | Railway → deployments → poprzedni `SUCCESS` → Rollback | 30 s |
| zła baza / utrata danych | `bash scripts/demo/przywroc-baze.sh --manifest <manifest z kroku 2> --oczekiwany-host <host> --tak-nadpisz` | 20–60 min |
| wiele commitów do cofnięcia | restore-commit **do przodu** wg `_RUNBOOK_COFANIA.md` warstwa 3 | 10 min |

Po **każdym** cofnięciu powtórz kroki 9–11. Redeploy wywołany zmianą zmiennej
bierze ostatni commit z GitHuba, nie ten, który stał na usłudze — dlatego pomiar
po cofnięciu jest obowiązkowy, a nie kurtuazyjny.

---

## Dziennik ćwiczeń

| data | kto | SHA | wynik (kroki 9–11) | uwagi |
|---|---|---|---|---|
| | | | | |
| | | | | |

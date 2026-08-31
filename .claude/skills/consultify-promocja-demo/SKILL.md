---
name: consultify-promocja-demo
description: Bezpieczna promocja kodu na demo.consultify.ai (Railway) oraz migracje na bazie demo/staging. Wywołaj ZAWSZE gdy masz wypchnąć zmianę na demo, scalić gałąź do `demo`/`Londyn`, zrobić redeploy, ustawić zmienną env Railway, albo uruchomić migrację/zapytanie na żywej bazie. demo=święte → ta procedura zapobiega powtórce krachu 3/4 (regresja z force/reset/złej bazy).
---

# Consultify — bezpieczna promocja na demo + operacje na bazie

## ⚠️ Zmiana doktryny (od 2026-08-31, decyzja D-4)
Środowiska rozdzielone, każde z WŁASNĄ bazą: `staging.consultify.ai` = powierzchnia pracy i odbiorów
Piotra; `demo.consultify.ai` = witryna, dostaje WYŁĄCZNIE promocję niezmiennego SHA z taga
`staging-deployed` (workflow „Railway Deploy"). Baza gałęzi = `origin/develop` (nie `origin/Londyn`/
`origin/demo`). Procedura „merge w worktree → `git push origin HEAD:demo`" poniżej jest ŚCIEŻKĄ
AWARYJNĄ (tylko incydent) — patrz CLAUDE.md → ŚRODOWISKA.

## Kontekst (fakty)
- **NIEAKTUALNE od 2026-08-31:** `origin/demo` już NIE auto-deployuje na push — Railway serwis
  **`consultify`** (env `demo`) dostaje kod tylko przez promocję taga `staging-deployed`.
- Railway CLI zwykle zalogowany jako Piotr (`railway whoami`), env=demo. App-serwis = **`consultify`** (jeden serwis, buduje frontend — ma zmienne `VITE_*`).
- Baza demo/staging = **TROLLEY** (`trolley.proxy.rlwy.net`, WSPÓLNA z demo). PROD=centerbeam — **NIGDY** bez jawnej zgody.
- Autoryzacja: promocję na demo robi nadzorca sesji głównej (CTO). Zmiany WIZUALNE wymagają akceptacji Piotra (zrzuty); zmiany silnika = tryb „deploy → Piotr klika live".

## Promocja kodu — procedura (nie odpuszczaj żadnego kroku)
1. **Baza gałęzi:** świeża z `origin/develop` (od 2026-08-31; NIGDY `feat/tp-forms-polish` ani `tp-*`/`deliverables-w1`). Praca w worktree isolation, commit-per-krok.
2. **Pre-flight merge-tree (0 konfliktów):**
   ```
   git merge-tree $(git merge-base origin/demo <branch>) origin/demo <branch> | grep -E '^(<<<<<<<|CONFLICT|changed in both)'
   ```
   Pusto = 0 konfliktów. Coś jest → STOP, rozwiąż zanim ruszysz.
3. **Sanity ubytku:** `git diff --stat origin/demo..<branch>` pokaże dużo plików jako „ubytek" — to ASYMETRIA (twoja gałąź nie ma N commitów demo), NIE twoja zmiana. Nie panikuj.
4. **Merge w izolowanym worktree na `origin/demo`** (nie w drzewie głównym — współdzielone):
   ```
   git worktree add /private/tmp/promote-demo origin/demo
   cd /private/tmp/promote-demo && git merge <branch> --no-ff -m "..."
   ```
   **NIGDY reset/force/rebase na demo.** Merge zachowuje commity demo.
5. **TWARDA weryfikacja:** `git diff --stat <sha_demo_przed> HEAD` musi pokazać **DOKŁADNIE** oczekiwane pliki. Więcej = coś nie tak, STOP.
6. **esbuild zmienionych plików** na finalnym drzewie: `npx esbuild <plik.tsx> --loader:.tsx=tsx --bundle=false --format=esm --outfile=/dev/null`.
7. **Push (ŚCIEŻKA AWARYJNA, tylko incydent):** `git push origin HEAD:demo` (z worktree). Ścieżka
   docelowa = promocja taga `staging-deployed` przez workflow, nie ręczny push. Po użyciu ścieżki
   awaryjnej obowiązkowo naprawić tag `staging-deployed`.
8. **Monitor (z KATALOGU GŁÓWNEGO — worktree niezlinkowany z railway):** pętla `railway deployment list --service consultify` aż status ≠ BUILDING/DEPLOYING; potem health:
   ```
   curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0 AppleWebKit/537.36" https://demo.consultify.ai/
   curl ... https://demo.consultify.ai/api/health
   ```
   Uwaga zsh: `status` to zmienna read-only — użyj `st`.
9. **Rollback ready:** przed pushem zapisz `git rev-parse origin/demo` (punkt cofnięcia).

## Zmienna env Railway (build-time VITE_*)
```
railway variables --set "VITE_ENABLE_X=true" --service consultify   # env demo linked
```
`VITE_*` są wypalane w Docker build → ustawienie wyzwala redeploy. Potwierdź: `railway variables --service consultify | grep VITE_ENABLE_X`.

## Migracja / zapytanie na żywej bazie (TROLLEY) — z bramką prod
Użyj helpera z twardą bramką „tylko trolley" (odmawia połączenia jeśli host ≠ trolley):
```js
// mig-sql.cjs — require('<repo>/node_modules/pg'); Client({connectionString: DATABASE_URL})
// if (!/trolley/i.test(host)) { console.error('ABORT'); process.exit(1); }
```
Uruchom: `DATABASE_URL="$(grep ^DATABASE_URL= .env.staging.local|cut -d= -f2-|tr -d '\"')" node mig-sql.cjs "<SQL>"`.
Migracje danych: ZAWSZE dry-run najpierw → obejrzyj plan → `--execute`. Archiwizuj (snapshoty), nie kasuj — odwracalne. PROD (centerbeam) = osobna jawna zgoda.

## Czego NIGDY nie robić
- force-push / reset / rebase na `demo` lub `Londyn`.
- Promocja z gałęzi na skażonej linii (`tp-*`/`deliverables-w1`/`harvard-noc`) — cofa TRIADA/silnik.
- Checkout/commit w GŁÓWNYM worktree (współdzielony z innymi sesjami — klobrujesz cudze WIP). Zawsze osobny worktree z jawną ścieżką.
- Deploy zmiany wizualnej na demo bez akceptacji Piotra na zrzutach.
- Cokolwiek na centerbeam/PROD bez jawnego „tak".

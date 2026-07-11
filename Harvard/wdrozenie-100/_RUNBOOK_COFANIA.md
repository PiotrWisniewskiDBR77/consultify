# RUNBOOK COFANIA — „przycisk UNDO" gdy dramat (2026-07-11)
Ustalenie Piotra: „zrób tak, żebyśmy mogli cofnąć jeżeli będzie dramat". Trzy warstwy, od najszybszej. **Demo=święte → NIGDY force-push/reset na demo (to był krach nocy 3/4). Cofanie zawsze DO PRZODU (revert/restore-commit), nie do tyłu.**

## Bezpieczny punkt (zawsze = ostatni stan zaakceptowany przez Piotra)
- Tag: **`demo-safe-2026-07-11`** → `2cfc701abc` (na origin). Re-tagowany po KAŻDEJ partii, którą Piotr zaakceptuje.
- Railway zdrowy deploy: `f846b1f9` (10:40, SUCCESS).

## WARSTWA 1 — WIZUALNY dramat (brzydko/gwiazda) → NATYCHMIAST, bez deployu
Każda zmiana wizualna jest ZA FLAGĄ, default OFF. Cofnięcie = **wyłącz flagę** (usuń `?ff_*=1` z URL lub ustaw env OFF). Domyślny ekran to zawsze stary. Piotr nigdy nie utknie z brzydkim ekranem.

## WARSTWA 2 — ZŁY DEPLOY (crash/regres funkcjonalny) → 1 akcja
- **Railway rollback (najszybszy):** dashboard Railway → deployments → poprzedni SUCCESS (`f846b1f9`) → „Rollback"/redeploy. Zero gita, ~30s, wraca gotowy build.
- ALBO git-revert: `git revert <zły-sha>` + push (nie-destrukcyjne, tworzy commit cofający).

## WARSTWA 3 — NUKLEARNE (wiele commitów do cofnięcia) → restore-commit DO PRZODU
```
git fetch origin demo && git checkout -b restore-safe origin/demo
git checkout demo-safe-2026-07-11 -- .        # drzewo = bezpieczny punkt
git commit -m "restore: cofnij do demo-safe-2026-07-11 (dramat)"
git push origin restore-safe:demo             # forward-commit, NIE force
```
Efekt: demo wygląda jak bezpieczny punkt, historia zachowana, zero force-push.

## MIGRACJE — bez rollbacku (celowo)
Wszystkie migracje sesji (913-917) są ADDYTYWNE (`ADD COLUMN IF NOT EXISTS`) — nie psują starego kodu, więc restore kodu ich nie wymaga. (Destrukcyjne migracje = osobny backup-table jak przy z139.)

## ZASADA (do CLAUDE.md): nic wizualnego przed oczy Piotra bez mojego renderu+zrzutu
1. Prototyp → wstępny OK Piotra. 2. Mój render realnego ekranu + zrzut (dev-render/harness, bez logowania Piotra). 3. Zrzut czysty (zero gwiazdek/ozdób, tokeny c-*, zgodny z prototypem) → dopiero wtedy Piotr patrzy. 4. Akcept na zrzucie → flaga na domyślne + **re-tag bezpiecznego punktu**.

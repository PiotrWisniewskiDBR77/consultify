# Consultify — rejestr wykonania recovery

**Aktualizacja:** 2026-08-08
**Właściciel:** Codex / Piotr
**Gate:** `RECOVERY_WORKTREES_READY`
**Implementacja produktu:** `NO_GO`
**Deploy i baza:** `NO_GO`

## Co zostało zabezpieczone

- 14 brudnych worktree posiada osobne snapshoty.
- Każdy snapshot zawiera metadata, status, binarny patch zmian śledzonych oraz archiwum plików nieśledzonych.
- 14/14 archiwów ma zgodną liczbę plików.
- Wszystkie niepuste patche przeszły test odtworzenia na dokładnym HEAD.
- Finalny manifest globalny: 180/180 checksum SHA-256 jest poprawnych.
- Bundle Git zawiera kompletną historię i 1283 referencje.
- Łączny rozmiar zabezpieczenia: około 2,7 GiB.
- Cztery sesje Claude zapisujące z głównego checkoutu zostały odwracalnie wstrzymane przez `SIGSTOP` po wykonaniu dodatkowego snapshotu ich najnowszych zmian.
- Osiem procesów helper/worker pozostaje w stanie `T`; nie zostały zakończone i zachowują pamięć procesu.

Snapshot:

`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-snapshots/2026-08-08_three-rebuilds-recovery`

Najważniejsze pliki dowodowe:

- `SHA256SUMS`
- `global/WORKTREE_SNAPSHOT_INDEX.tsv`
- `global/RESTORE_VERIFICATION.tsv`
- `global/checksum-verification.txt`
- `global/consultify-all-refs-2026-08-08.bundle`
- `global/PAUSED_CLAUDE_PROCESSES.tsv`
- `global/RESUME_PAUSED_CLAUDE.txt`
- `ownership/FILE_OWNERSHIP_MATRIX.tsv`
- `paused-final/`

## Macierz ownership

| Owner | Liczba plików | Decyzja |
|---|---:|---|
| Agent V8 | 324 | odtworzyć w torze V8 |
| Documents | 255 | odtworzyć bez odziedziczonego V8 |
| Report B / UI | 400 | odtworzyć na aktualnym baseline |
| Shared-file integrator | 30 | wyłącznie ręczna integracja |
| Evidence | 2734 | zachować oddzielnie od kodu |
| Governance | 68 | osobny przegląd dokumentacyjny |

304 pliki obecne w Documents są odziedziczoną częścią V8. Nie wolno ich ponownie liczyć ani integrować jako własność Documents.

## Czyste recovery worktree

| Tor | Worktree | Branch | Baseline | Stan |
|---|---|---|---|---|
| Agent V8 | `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/agent-v8` | `codex/recovery-agent-v8-20260808` | `3b0c337ee472` | clean |
| Documents | `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/documents` | `codex/recovery-documents-20260808` | `3b0c337ee472` | clean |
| Report B / UI | `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-recovery/2026-08-08/report-b-ui` | `codex/recovery-report-b-ui-20260808` | `3b0c337ee472` | clean |

## Obowiązująca instrukcja dla wszystkich agentów

1. Nie zapisuj w głównym checkoutcie Consultify.
2. Nie używaj innego worktree niż jawnie przypisany.
3. Przed pracą podaj worktree, branch, HEAD i zakres.
4. Nie dotykaj plików oznaczonych `SHARED_FILE_INTEGRATOR`.
5. Nie wykonuj merge, push, deploy, restartu ani zmian bazy.
6. Nie przenoś całych historycznych branchy.
7. Odtwarzaj wyłącznie pliki przypisane w `FILE_OWNERSHIP_MATRIX.tsv`.
8. Zakończ statusem `READY_FOR_CODEX_REVIEW` albo `BLOCKED`.

## Gate'y

| Gate | Stan |
|---|---|
| Snapshot verified | `PASS` |
| Ownership matrix generated | `PASS` |
| Clean recovery worktree | `PASS` |
| Active writers frozen without termination | `PASS` |
| Recovery reconstruction | `PENDING` |
| Independent diff review | `PENDING` |
| Tests | `PENDING` |
| Integration | `NO_GO` |
| Staging | `BLOCKED_RUNTIME` |
| Demo | `NO_GO` |
| Production | `NO_GO` |

Następny gate: `RECOVERY_RECONSTRUCTED_AWAITING_CODEX_REVIEW`.

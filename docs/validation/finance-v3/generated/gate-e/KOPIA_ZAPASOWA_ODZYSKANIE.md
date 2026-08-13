# Finance v3 — kopia zapasowa i instrukcja odzyskania

Utworzono: **2026-08-13, 05:13** · Powód: zabezpieczenie przed finalnym mergem.

## Dlaczego ta kopia istnieje poza iCloud

Repozytorium robocze leży na iCloud Drive. W sesji 2026-08-12 iCloud **odciął dostęp do metadanych
Gita** („Operation not permitted"), co uniemożliwiło odczyt stanu gałęzi. Ta kopia leży w lokalnym
katalogu domowym, poza synchronizacją.

## Co jest zabezpieczone

| | |
|---|---|
| Plik | `fv3-checkpoint-20260813-051351.bundle` |
| Rozmiar | 2,1 GB |
| SHA-256 | `42e5176a609f55a0b1b310b686c19c2e93fc6dc10ba2e2f22ce2dd1808b4b2b3` |
| Referencji | **1589** (`git bundle create --all`) |
| Gałęzi `codex/fv3p-*` | **34** |
| Weryfikacja | `git bundle verify` → **exit 0**, „The bundle records a complete history" |
| Próba odtworzenia | **wykonana i zdana** — klon dał zgodny HEAD, tag, 114 commitów, wszystkie 34 gałęzie |

## Punkt kluczowy

| | |
|---|---|
| Gałąź | `codex/finance-v3-complete-product-integration` |
| **Kod** | `3fa1c8beafbb9e9aed582a1e5ae81708bf163234` |
| **Kod + handoff** | `1e2982e7e1f4dd71648b28bb7516e523b9cefc77` |
| Tag | `fv3-checkpoint-2026-08-12` → `edf1abb08d8ffab61f3c125cb745e5ee31fe7378` |
| Baseline sesji | `ee5736a5a62ebd19442ed63e897c0bf890102ab6` |
| Stan | NOT PUSHED · NOT DEPLOYED · drzewo CLEAN |

## Jak odzyskać

Sprawdź najpierw integralność:

```bash
shasum -a 256 /Users/piotrwisniewski/fv3-git-backup/fv3-checkpoint-20260813-051351.bundle
git bundle verify /Users/piotrwisniewski/fv3-git-backup/fv3-checkpoint-20260813-051351.bundle
```

Pełne odtworzenie do nowego katalogu:

```bash
git clone --branch codex/finance-v3-complete-product-integration \
  /Users/piotrwisniewski/fv3-git-backup/fv3-checkpoint-20260813-051351.bundle \
  /Users/piotrwisniewski/fv3-restored
```

Odzyskanie pojedynczej gałęzi do istniejącego repozytorium (bez ruszania bieżącego stanu):

```bash
git fetch /Users/piotrwisniewski/fv3-git-backup/fv3-checkpoint-20260813-051351.bundle \
  'refs/heads/codex/fv3p-*:refs/heads/odzyskane/fv3p-*'
```

## Czego NIE robić przy odzyskiwaniu

- Nie nadpisuj istniejących gałęzi — pobieraj pod prefiks `odzyskane/` i porównuj.
- Nie używaj `git reset --hard`, `git clean` ani `git stash`. **Stash jest współdzielony między
  worktree** i zniszczy pracę innych sesji.
- Nie force-pushuj. Wycofanie robi się commitem DO PRZODU, nie przepisaniem historii.

## Wcześniejsza kopia

`fv3-all-20260812.bundle` (2,0 GB) — stan sprzed 114 commitów tej sesji. Zachowana świadomie
jako drugi punkt cofnięcia.

## Czego ta kopia NIE zastępuje

Gałąź **nie istnieje na `origin`** — nigdy nie została opublikowana, bo push wymaga zgody
właściciela. Ta kopia chroni przed utratą lokalną (awaria iCloud, skasowany worktree, zły reset),
ale **nie przed utratą dysku**. Publikacja na remote pozostaje decyzją właściciela.

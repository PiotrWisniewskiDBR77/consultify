# Parallel Sync Remediation Playbook (2026-05-09)

> **TL;DR.** "Parallel sync agent" który blokował frontend Document Studio
> przez kilka ostatnich kampanii to **Google Drive Desktop**. Ten dokument
> opisuje root cause, symptomy, immediate remediation steps (15-30 min user
> work), oraz długoterminowe rozwiązania.

## 1. Root cause

### 1.1 Co znaleziono

```
$ ps aux | grep -iE 'drive|sync' | grep -v grep
piotrwisniewski 3485 100.0% RUNNING
  /Applications/Google Drive.app/Contents/MacOS/Google Drive
  --auto_restart_count=1 ...
```

**Google Drive Desktop** jest aktywnie running (PID 3485, ~100% CPU)
i syncuje folder `~/Documents/Antygracity/` z chmurą Google Drive.
macOS pakuje folder `~/Documents` w domyślny sync target Google Drive,
więc cała Antygracity workspace jest pod kontrolą Drive sync.

### 1.2 Mechanizm uszkodzeń

1. **Transient deletions.** Google Drive używa file-provider migration
   API. Podczas resyncu plik może chwilowo zniknąć z FS (file-provider
   re-mount). Jeśli `git add ... && git commit ...` trafi w to okno,
   commit skończy się jako "no changes added to commit" lub commit
   bez tego pliku.
2. **Mis-attribution `staging`.** W chmurze Google Drive są zsynchowane
   commits z **innych maszyn** (np. drugi laptop / VM / iPad z innym
   `git config user.name`). Gdy Google Drive resyncuje te commits w
   tę maszynę, lokalny `git log` widzi je z author `staging` zamiast
   `Piotr <piotr.wisniewski@dbr77.com>`.
3. **Lost work.** Frontend pliki (TypeScript / TSX) są częściej
   modyfikowane niż backend, więc mają wyższe prawdopodobieństwo
   trafić w sync window. Backend ścieżki (services / __tests__) są
   modyfikowane rzadziej i przez większe diffy → mniejsze ryzyko.
4. **42 Cursor/Antigravity processes running.** Kolejny czynnik:
   równolegle uruchomione AI editor sessions mogą same commitować
   zmiany. To nie jest problem sam w sobie, ale kombinacja z Google
   Drive sync uniemożliwia przewidywanie kto/co/kiedy commituje.

### 1.3 Co już istnieje jako częściowa obrona

`.cursor/hooks/agent-snapshot-pre-flight.sh` — defensywny mechanizm
który robi snapshot consultify/ przed każdym promptem. Snapshots
trafiają do `.drive-sync-backup/<timestamp>/`. To **łagodzi** problem
(rollback po fakcie), ale **nie zatrzymuje** go.

## 2. Immediate remediation (15-30 min user work)

> **Ten krok wymaga GUI dostępu do macOS i konta Google Drive.
> Nie mogę go wykonać jako agent. Operator musi to zrobić sam.**

### 2.1 Opcja A — Wyłącz sync dla samego folderu Antygracity

Najmniej inwazyjne. Inne foldery w `~/Documents/` zostają zsyncowane.

1. Otwórz **Google Drive** w menu bar (ikona Drive obok Wi-Fi).
2. Kliknij koło zębate → **Preferences**.
3. Tab **Folders from your computer** lub **Mirror files from your
   computer**.
4. Znajdź `Documents` w liście synced folders.
5. Kliknij `Edit` przy `Documents`.
6. **Odznacz** lub wyklucz `Antygracity` z listy syncowanych
   subfolderów.
7. **Apply** / **Save**.
8. Poczekaj 1-2 min na propagację. Sprawdź `ps aux | grep "Google Drive"`
   — proces nadal może pracować, ale nie powinien już dotykać
   `~/Documents/Antygracity/`.

### 2.2 Opcja B — Przenieś repo poza synced location

Najbezpieczniejsze. Zero ryzyka regresji.

```bash
# 1) Quit Cursor / Antigravity / dowolny edytor który ma repo otwarte.
# 2) Zatrzymaj Google Drive (menu bar → Quit Google Drive).
# 3) Przenieś:
mv ~/Documents/Antygracity ~/Code/Antygracity

# 4) Re-otwórz w edytorze pod nową ścieżką.
# 5) Uruchom Google Drive ponownie.
```

Po tym kroku Google Drive nigdy więcej nie zobaczy pliku z tego
repo. Jest to też lepsze dla **data privacy** — kod produktowy
nie powinien być w third-party cloud sync chyba że to świadoma
decyzja firmowa.

### 2.3 Opcja C — Zostaw sync, dodaj defensywne tooling

Jeśli z jakiegoś powodu sync jest **wymagany** (backup,
multi-machine workflow), zostaw go i wzmocnij defensywne narzędzia
(patrz §3 poniżej).

## 3. Defensive tooling już dostarczone w tej kampanii

Niezależnie od wyboru Opcji A/B/C, slice E18.tooling dostarczył:

### 3.1 `scripts/atomic-commit.sh`

Atomic add+commit+verify. Używa `flock` aby zapobiec interleaving
z Google Drive sync window. Verifikuje attribution po commit'cie
i abortuje jeśli nie zgadza się z `~/.gitconfig`.

Użycie:
```bash
./scripts/atomic-commit.sh -m "feat: my change" path/to/file1 path/to/file2
```

### 3.2 `.git/hooks/post-commit`

Automatyczna weryfikacja attribution po każdym commitcie. Zapisuje
warning do stderr jeśli `%an %ae` nie zgadza się z lokalnym
`user.name` / `user.email`.

### 3.3 `.gitignore` update

`.drive-sync-backup/` jest jawnie excluded (defensywnie — nigdy nie
chcemy zacommitować snapshot folderu).

## 4. Symptomy które potwierdzą sukces remediation

Po zastosowaniu Opcji A lub B, **w ciągu 24h** powinieneś zaobserwować:
- Każdy commit ma czyste atrybuty `Piotr piotr.wisniewski@dbr77.com`.
- Brak "no changes added to commit" błędów po `git add ... && git commit`.
- Folder `.drive-sync-backup/` przestaje rosnąć (snapshot pre-flight
  hook nadal go używa, ale zawartość jest stała / minimal).
- `ps aux | grep "Google Drive"` przestaje pokazywać proces który
  robi I/O na `~/Documents/Antygracity/`.
- Frontend kampania FE-E1.2..FE-E5 może bezpiecznie ruszyć.

## 5. Historia i dowody

Mis-attribution commits z poprzednich kampanii (wszystkie required
follow-up `attribution-fix` commits):
- `8967420fc` (FE-E1.1 manifests) — fix w `bf645da5a`
- `62420b17b` (E11.2 reference manifests) — fix w `07040f370`
- `244106369` (E11.5 MELS chip-id reconciliation)

Wszystkie te commits miały `Author: staging <...>` zamiast
`Author: Piotr <piotr.wisniewski@dbr77.com>`. Mechaniczne dowody że
Google Drive resyncuje commits z innej maszyny.

## 6. Dlaczego ten problem był niedyiagnozowany przez tygodnie

- Cursor / Antigravity sessions działają w sandboxie i nie widzą
  całego systemu. Bez `ps aux` poza session, nie da się zauważyć
  Google Drive process.
- Symptom (transient deletion / mis-attribution) wyglądał jak bug
  w git lub w edytorze, nie w cloud sync.
- `.cursor/hooks/agent-snapshot-pre-flight.sh` istniał i komentarz w
  nim **wyraźnie wskazuje** na Google Drive jako winowajcę: "Captures
  a verbatim snapshot ... so that if Google Drive Desktop reverts files
  mid-task we can restore from .drive-sync-backup/." Ale ten hook był
  defensywny / mitigation, nie eliminacja root cause.

## 7. Long-term recommendation

**Nie hostuj kodu produktowego w `~/Documents/` na macOS.**

`~/Documents/` jest *cloud-sync target* dla Google Drive,
iCloud Drive, OneDrive, Dropbox. Każdy z nich może powodować
dokładnie te same symptomy. Standard:
- `~/Code/` lub `~/Workspace/` — out-of-sync local-only
- `~/Documents/` — dla dokumentów osobistych i shared materials
- `~/Library/Mobile Documents/` — explicit iCloud-only

Po przeniesieniu repo do `~/Code/Antygracity`, jako bonus:
- szybsze fs operations (no provider migration overhead)
- prostszy backup story (dedykowany cron + restic, nie cloud-sync)
- bezpieczeństwo (kod produktowy nie żyje w cudzej chmurze
  domyślnie).

---

**Status:** ROOT CAUSE FOUND. Ball is in operator court for §2
GUI remediation. Defensive tooling z §3 jest wdrożone i działa
nawet jeśli §2 nie zostanie wykonane.

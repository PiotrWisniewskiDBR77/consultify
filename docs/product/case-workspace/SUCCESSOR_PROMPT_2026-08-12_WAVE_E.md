# PROMPT DLA NASTĘPCY — fala E domknięta w 8/9, zostały 3 pozycje

---

CASE WORKSPACE V1 — CONTINUE FROM `cb73de5e82` TO COMPLETE CANDIDATE
OPUS DYREKTOR / SONNETY PRODUKCJA / DO SKUTKU

Kontynuujesz istniejący program. Nie zaczynaj od nowa, nie twórz alternatywnego
Case Workspace, nie cofaj poprawnych zmian, nie re-diagnozuj rzeczy oznaczonych
niżej jako ROZWIĄZANE.

## Punkt startowy

```
worktree:   /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
branch:     claude/case-workspace-v1-20260809
BASE_SHA:   9d17cac11484a82f729a51044e30453e39fbcb02
HEAD:       cb73de5e82522e369933b4e181a8a6742d316752   (WIP, NIE kandydat)
```

Na wejściu potwierdź: `git rev-parse HEAD`, `git status --porcelain`,
`git branch --show-current`, `git diff --check 9d17cac114..HEAD`.
Nie zakładaj, że stan się nie zmienił.

**Czytaj:** `RESUME_HANDOFF_2026-08-12.md` (sekcja §6 „pułapki" jest najcenniejsza),
potem `00`–`15`, `AGENT_EXECUTION_V8_SSOT.md`, `docs/ui-standards/TRIADA_KANON.md`,
`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`, właściwy `CLAUDE.md`.

## Co jest ZAMKNIĘTE — nie ruszaj, nie re-diagnozuj

| pozycja | dowód |
|---|---|
| F2 (pliki e2e razem) | `a565ce454c`, 34/34, trzy przebiegi, zero wyciekających fixtures |
| Bootstrap capability | `cb96c748c1`, 8/8 + kontrola negatywna w OBU trybach porażki |
| Walidacja OpenAPI offline | `cb96c748c1`, ajv już w repo, dowód braku sieci przez proxy, 2 kontrole negatywne |
| `createNativeDeck` cichy sukces | `cb96c748c1`, kontrola negatywna na realnym CHECK |
| Rejestry: 39 + 18 wierszy | `cb96c748c1`, GAP wzrósł 1490→1516 (uczciwie) |
| Licznik niespójności rejestru | `778c2fb058`, 37→0, GAP NIEZMIENIONY, dowód że licznik nadal wykrywa |
| Ordering migracji w 5 mechanizmach | `906cc6b532`, wspólna funkcja + test parity, kontrole negatywne ×3 |
| `--safe` raportujący porażkę jako sukces | `906cc6b532` |
| **Run 30-minutowy** | `cb73de5e82`, `durationMs=1800041`, restart worker PID 40582→40754, 2 wiersze NodeRun |

## Co ZOSTAŁO — trzy pozycje, wszystkie w a11y

### 1. F2-a11y KRYTYCZNE — przycisk „wstecz" bez nazwy dostępnej
`src/components/shared/NModeLayout/NModeHeader.tsx:352-359`.
axe zgłasza `critical` na KAŻDEJ z 14 komórek ekranu szczegółów (7 szerokości ×
2 motywy), bo to niereagująca wspólna powłoka. To **blokuje bramkę**
„zero critical/serious axe".
Nadaj realną nazwę dostępną, PO POLSKU (UI produktu jest polskie). Przeczytaj
komponent i ustal, dokąd ten przycisk faktycznie wraca — generyczna etykieta,
która myli, nie jest naprawą.

### 2. F1-a11y POWAŻNE — kontrast dolnej nawigacji
`src/components/navigation/BottomNavigation.tsx:161`, `dark:text-slate-500`.
3,75:1 przy wymaganych 4,5:1, tylko motyw ciemny poniżej 768 px.
**Kontrast mierz na SKOMPONOWANYM tle**, nie na tokenie w izolacji — ten błąd
dał już w tym repo fałszywe P0. Nie sięgaj po `primary-*` (każdy numer = crimson,
hook zablokuje).

### 3. Dwa stany bez dowodu: `partial` i `skipped`
E5 domknął 28/28 komórek szerokość×motyw, ale tych dwóch stanów nie wyprodukował.
`skipped` zapisuje `runLifecycleService.recordUnselectedBranchesSkipped`
(wiersz `node_result_acceptances`, `nodeCompletionState: 'SKIPPED'`).
Doprowadź do nich realnym API i pokaż, jak UI je renderuje, jasny i ciemny.

Oba komponenty z pkt 1–2 są **współdzielone** — zmiana dotknie ekranów spoza
Case Workspace. Minimalnie i chirurgicznie; jeśli zmiana wpłynie na wygląd gdzie
indziej, powiedz to zanim ją zrobisz.

## Świadomie NIEZAMKNIĘTE (nie blokery, ale nie udawaj że są zrobione)

- **VoiceOver** — E5 odmówił świadomie: włączenie zmienia realne ustawienie
  systemowe hosta i przejmuje wejście/dźwięk, a to był nienadzorowany pakiet
  w tle. Zgodnie z istniejącą decyzją `N/A_WITH_CODEX_APPROVAL` dla etapu
  candidate. NVDA pozostaje wymaganiem przed produkcją.
- **Aktywacja Enter/Space z pierwszej ręki** — narzędzie przeglądarkowe tej sesji
  nie syntetyzuje natywnego kliknięcia na Enter (udowodnione testem kontrolnym na
  zwykłym `<button>`). Pakiet C4 ma niezależny dowód Playwrightem.
- **Luka `736`/`canonical_inbox_items`** w `DatabaseInitializer.ts` — świadomie
  nieruszona, zweryfikowane realnym bootem że runtime runner mimo to dochodzi do
  `Database ready`. Osobna, recenzowalna zmiana.
- **`run-migrations-staging.cjs`** — nigdy nie zweryfikowany przeciw realnemu
  stagingowi; wymagałoby to dotknięcia stagingu, czego zabrania `OD-CW-DEMO-20260812`.

## Decyzje właścicielskie ZAMROŻONE — nie pytaj ponownie

**`OD-CW-BOOTSTRAP-20260812`** — bootstrap używa dedykowanego **syntetycznego**
service principala w disposable organizacji testowej; minimalna rola ADMIN;
identyfikatory z `CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID` /
`CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID`; nic zahardkodowane; zero sekretów
w repo/logach/dowodach; brak lub błędna konfiguracja **failuje zamknięcie** i NIGDY
nie wybiera pierwszego ADMIN-a z bazy; revoked membership albo niezgodna
organizacja blokują; ponowny boot idempotentny; wiązanie w pamięci nie omija
trwałego registry ani RBAC.

**`OD-CW-DEMO-20260812`** — zakaz **mutujących** testów na demo/staging zostaje.
Wolno: disposable PostgreSQL, dane syntetyczne, lokalny realny backend,
**wyłącznie odczytowy** recon demo. Nie wolno na demo: tworzyć Case, uruchamiać
Run, rejestrować capability, tworzyć fixtures, pisać do inbox/outbox, zmieniać
członkostwa, testować retry/approval/migracji, `dev:staging`, `dev:railway`.

## Bramki — mierz w DWÓCH konfiguracjach

Nie istnieje jedna konfiguracja, w której wszystko przechodzi. e2e wymaga backendu
**włączonego**, test wydajnościowy **wyłączonego** (bo produkcyjny worker wypija
jego fixture). Pomiar w jednej kłamie o drugiej.

```bash
# backend DOWN — suita bez e2e
cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
npx vitest run src/services/caseWorkspace/ src/routes/caseWorkspace/__tests__/ \
  --exclude '**/e2e/**' --environment node

# backend UP — e2e, OBA pliki razem (nie osobno!)
bash scripts/dev/case-workspace-local-backend.sh    # :3001, koordynator jest właścicielem
... npx vitest run src/services/caseWorkspace/__tests__/e2e/ --environment node
```

Ostatnie zmierzone: suita bez e2e **603/603**, e2e razem **34/34**,
`server tsc` exit 0, `frontend tsc` exit 0, `diff --check` exit 0,
migracja fresh PASS (`Database ready`, `/api/ready` 200), replay idempotentny.
Po zmianach w a11y **przemierz oba typechecki** — ostatnie były przed falą E.

## Pułapki, które kosztowały czas (pełna lista w handoffie §6)

`timeout` nie istnieje na macOS (exit 127 + pusty log wyglądający na czysty) ·
`kill -9` na `npx`/`tsx` zostawia żywe dziecko, zabijaj PO PORCIE ·
EADDRINUSE oddaje bazę procesowi-widmo · nie wyciszaj błędów `DROP DATABASE` ·
inline timeout w `it()` bije `--testTimeout` z CLI · `tsc` OOM-uje i crash udaje
sukces, ufaj KODOWI WYJŚCIA · maszyna bywa dzielona z innymi sesjami (load 89!),
nie zabijaj cudzych procesów · backend dev na :3001 chodzi przeciw bazie testowej ·
`migrate.postgres.ts` uruchamiaj z KATALOGU GŁÓWNEGO repo ·
robotnicy mają zakaz pełnego `tsc`, więc regresja typów wychodzi dopiero na fan-inie.

## Zasady

Bez push, merge do demo, deployu, mutacji demo/staging, `git reset --hard`,
`git clean`, stashowania cudzych zmian, `git add -A`, kasowania cudzych worktree,
zabijania cudzych procesów.

Agenci wykonawczy: **Sonnet** (wyraźne polecenie właściciela — tokeny).
Koordynator: **Opus**, tylko orkiestracja, pliki integracyjne i najtrudniejszy kod.
Jeden agent = rozłączna allowlist. Pliki integracyjne (`adapters/index.ts`,
`server/src/index.ts`, `Gateway.ts`, `src/App.tsx`, współdzielone testy
kontraktowe) edytuje wyłącznie koordynator. Backend na :3001 należy do koordynatora
— żaden agent go nie restartuje.

Kontrola negatywna obowiązkowa przy każdej poprawce bezpieczeństwa i przy każdej
nowej bramce: zepsuj, potwierdź czerwień, przywróć, potwierdź zieleń, wklej OBIE
strony. Test, którego nikt nie widział na czerwono, niczego nie dowodzi.

Nie zmniejszaj GAP mechaniczną zmianą statusów. Każde wyłączenie z V1 wymaga
cytatu z kanonu albo numeru decyzji właściciela.

## Stan terminalny

Jedyna pozytywna formuła: **`READY_FOR_CODEX_REVIEW — CANDIDATE ONLY`**.
Przed nią: wygeneruj rejestry, uruchom generator drugi raz, potwierdź bajtową
identyczność, zacommituj, zapisz pełny SHA, NIE ruszaj już plików, uruchom finalne
bramki na TYM SHA, potwierdź czyste drzewo.

`FINAL PASS` należy do Codex i właściciela. Nie ogłaszaj go.

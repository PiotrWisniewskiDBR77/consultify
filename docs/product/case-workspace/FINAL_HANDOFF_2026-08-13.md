# Case Workspace V1 — HANDOFF FINALNY (poprawiony), 2026-08-13

> Poprzedni handoff został przyjęty jako mocny checkpoint pośredni, ale
> **odrzucony jako finalny**, ze statusem `BLOCKED / EVIDENCE_MISSING —
> CONTINUE WORK` i siedmioma korektami. Ten dokument odpowiada na wszystkie
> siedem. Praca została dokończona, nie zamrożona na checkpointcie.

## STATUS

**`READY_FOR_CODEX_REVIEW — CANDIDATE ONLY`**, z jednym jawnym blokerem
zewnętrznym (VoiceOver) i jawną listą tego, czego kandydat NIE obejmuje.

To nie jest zgoda na demo ani na merge. Żaden ekran nie był oglądany przez
właściciela, a odbiór wizualny (lista czekowania część B / DoD §18.1) nie
został wykonany.

---

## 1. Tożsamość

| co | wartość |
|---|---|
| worktree | `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` |
| branch | `claude/case-workspace-v1-20260809` |
| BASE_SHA | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| **SHA testowany** | `44f00d154c1157e2ddb25550211790eaec118ca1` |
| commity od BASE | **118** |
| drzewo w chwili pomiaru | **czyste** |
| push · merge · rebase · deploy · Railway | **żaden nie wykonany** |

### Korekta 1 — zdalne repo (poprzednio zaraportowane błędnie)

Napisałem wcześniej `REMOTE REACHABILITY: VERIFIED`. To zdanie mieszało dwa
różne fakty i słusznie zostało odrzucone. Rozdzielone — to samo polecenie
w dwóch wariantach, ta sama sesja:

```
git ls-remote --heads origin demo
  → f3e7df565e0da826ba110d85aad3c3c81a1087f1  refs/heads/demo        (1 wiersz)

git ls-remote --heads origin claude/case-workspace-v1-20260809
  → (0 wierszy, rc=0)
```

- **REMOTE REACHABILITY: `VERIFIED`** — `origin` odpowiada.
- **BRANCH ON REMOTE: `ABSENT`** — gałęzi tam nie ma.

Obecność obiektów w lokalnym `.git` nie dowodzi obecności gałęzi na zdalnym.
**Cała praca istnieje wyłącznie lokalnie.**

---

## 2. Bramki na SHA testowanym (korekta 5)

| bramka | kod wyjścia | liczby |
|---|---|---|
| `tsc -p server --noEmit` | **0** | — |
| `tsc --noEmit` (frontend) | **0** | log 0 bajtów, **0 markerów crasha** |
| suita Case Workspace (zakres kanoniczny) | **0** | **78/78 plików · 619/619 testów** |
| e2e — oba pliki w JEDNYM wywołaniu | **0** | **2/2 pliki · 34/34 testy** |
| świeża migracja od zera | **0** | **598 zastosowanych · 1371 tabel** |
| idempotentny replay | **0** | **0 zastosowanych** |
| `git diff --check BASE..HEAD` | **0** | — |
| `git status --porcelain` | — | pusty |

Zakres suity jest cytowany dosłownie, nie opisany — patrz §6, pułapka 1.
e2e celowo w jednym wywołaniu: rozdzielenie ukryłoby zdiagnozowaną wcześniej
interferencję międzyplikową.

### Bramka migracji — najpierw wyglądała na czerwoną, nie jest

Pierwszy odczyt dał `RUN1_EXIT=1` przy logu kończącym się `✅ Postgres
migrations complete`. Wyjście mówiło „sukces", kod wyjścia „porażka".
Powtórka ze stdout i stderr do **osobnych** plików pokazała przyczynę na
stderr:

```
❌ Postgres migrate failed: Selected DATABASE_URL points to local host 127.0.0.1.
   This project requires the external Postgres target outside tests.
```

To **zabezpieczenie** skryptu, nie defekt: odmawia lokalnego celu, dopóki nie
zostanie ustawione `NODE_ENV=test` (albo `CI=true` — druga dozwolona furtka
w `databaseTargetResolver.ts`). Po jego spełnieniu, na świeżej bazie: 598
migracji / exit 0 / stderr pusty, replay 0 / exit 0, 1371 tabel. Bazy robocze
skasowane z pokazanym prawdziwym wyjściem `DROP DATABASE`, `SELECT ... LIKE
'cw_gate%'` nie zwraca nic.

Bookkeeping przypisania plików logów do prób nie zgadza się między moim
odczytem a relacją pakietu i **nie został rozstrzygnięty**; nie zmienia to
wyniku bramki, bo odtworzyłem cały przebieg samodzielnie od `CREATE DATABASE`
do `DROP`.

---

## 3. Co ta faza zamknęła

### 3.1 Pętla PlanView → CaseDetailScreen (korekta 2)

Zarzut był słuszny: typecheck nie dowodzi, że zapis przestał zostawiać
nieaktualny bundle. Dowód runtime — commit `03c4dd8ab5`:

- **log sieciowy**: `PUT …/plan-versions` 200 → `GET /cases/:id/plan-versions`
  200 (refetch dodany przez naprawę — **widoczny**, nie wywnioskowany) →
  `POST …/propose` 200 → `POST …/publish` 200. **Zero 409** tam, gdzie przed
  naprawą powstawało 409;
- **odczyt z bazy**: `version` 1→4, `status=PUBLISHED`, zmieniona etykieta
  przetrwała cykl, reload i pełny unmount/remount;
- **kontrola negatywna (a)**: usunięcie wiringu odtwarza dokładnie
  przednaprawcze 409 z polskim komunikatem, bez korupcji danych;
- **kontrola negatywna (b)**: przy działającej naprawie mutacja tego samego
  wiersza **poza aplikacją** i zapis ze stanu nieaktualnego → **nadal 409**.
  Naprawa nie uciszyła realnej blokady optymistycznej. To było większe ryzyko
  niż sam defekt;
- **test regresji**: `tests/components/CaseWorkspace/PlanView.onDraftSaved.test.tsx`,
  2/2, zweryfikowany jako czerwony po usunięciu naprawianej linii.

Czego brak: **zrzutów ekranu** — rozszerzenie przeglądarki przestało
odpowiadać przy dodatkowych zrzutach archiwalnych, już po zakończeniu wszystkich
kroków dowodowych. Dowód stoi na logach sieciowych i odczytach z bazy, których
zrzut i tak by nie zastąpił.

### 3.2 Zamknięcie Zlecenia — było w kontrakcie, nie było w kliencie

Audyt wykazał, że zamknięcie **jest** w zakresie V1 (`00_CASE_WORKSPACE_CANON.md:84`,
`04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md` §4.1, `12_…_SSOT` §6.4, DoD-B) i że
**żadna decyzja właścicielska go nie zwalnia**. Serwer był kompletny
i przećwiczony e2e; `api.ts` miał **zero** funkcji zamknięcia. Podłączone
w `44f00d154c`.

Kształt narzucił serwer, nie projekt UI:

- oś zamknięcia (`delivery`/`decision`/`implementation`/`outcome`) — wolno
  wysyłać wielokrotnie;
- `recordClosure` — wolno **raz** (drugi raz → `CASE_CLOSURE_ALREADY_RECORDED`);
- `recordClosure` **nie** zmienia `case_status` — robi to osobne przejście,
  które odmawia, dopóki rekord nie istnieje.

Stąd **jedno okno z czterema osiami i jednym typem zamknięcia**, a nie cztery
przyciski „zamknij" — schemat bazy nie potrafiłby tego drugiego wyrazić.
Kanon mówi to samo: cztery poziomy śledzone niezależnie, `CLOSED` zapisuje
jeden zakontraktowany typ.

Przycisk **neutralny, nie crimson**: zamknięcie to zamierzone domknięcie
kontraktu, ta sama kategoria co „Zatwierdź i rozpocznij", a nie wycofanie jak
„Wycofaj plan", które słusznie zostaje czerwone.

Dowody: ścieżka szczęśliwa (`version` 2→3→5, `case_status=CLOSED`), odmowa
(oś niegotowa → 409, `version` bez zmian), konflikt (podwójny `recordClosure`;
`CLOSED→ACTIVE` → `CASE_STATUS_TRANSITION_NOT_ALLOWED`), `COMPLETED_PARTIAL`
z wymuszeniem dowodu — każda z odczytem SQL.

Zmiana w `CaseDetailScreen.tsx` jest **czysto addytywna (432 wstawienia,
0 usunięć)**, więc nie narusza wiringu przeładowania z §3.1 w tym samym pliku.

### 3.3 Trzy defekty rozstrzygnięte (korekta 3)

| wiersz | werdykt |
|---|---|
| `CW-03-009-M4` | etykiety statusu planu łamały kanon → naprawione w `enumLabels.ts`; potwierdzone **odczytem DOM na żywo**: `"Plan: Opublikowany (wersja 1)"`, `"Plan: Do przeglądu (wersja 1)"` |
| `CW-RT-031-M4b` | ten sam defekt na wierszu siostrzanym → zamknięty tą samą naprawą |
| `ARTIFACT-PANEL-SECTIONS-M4` | **nieaktualny FAIL**: OD-12 odracza `Komentarze` poza V1; carve-out objął tylko wiersz siostrzany, więc dopisano `ARTIFACT-PANEL-SECTIONS-M4b` → `DEFERRED_POST_V1` |

**Realny licznik FAIL: 2**, a nie 3 — oba to jeden defekt etykiet, naprawiony.

### 3.4 Macierz kryteriów (korekta 4)

`evidence/q2-scope-accounting-2026-08-12/CRITERIA_MATRIX_219.csv` — **225
wierszy danych**, każdy ostemplowany testowanym SHA (kolumna `final_sha`,
zero placeholderów):

| wynik | liczba |
|---|---|
| `UNVERIFIED` | **218** |
| `PASS` | 4 |
| `FAIL` | 3 (realnie **2**, oba zamknięte — §3.3) |

Każdy z 218 otwartych wierszy ma przypisaną grupę blokera i właściciela
brakującej zależności. **Weryfikacja 218 wierszy zgodności UI to program
pracy, nie pozycja checkpointu** — i tak jest zaraportowana, bez awansowania
czegokolwiek do „proven" bez dowodu.

---

## 4. Otwarte — jawnie

### 4.1 VoiceOver (korekta 6) — **pozostaje `BLOCKED`**

`BLOCKED_BY_HOST_PERMISSION`. Dwie próby automatyczne, oba systemowe okna
uprawnień odrzucone. Bez podglądu ekranu nie da się odczytać panelu napisów
ani potwierdzić przywrócenia ustawienia hosta. Trzeciej próby nie wykonano,
zabezpieczeń nie obchodzono.

**To nie jest `PASS` ani `N/A`.** Ścieżka ręczna: `VOICEOVER_MANUAL_RUNBOOK.md`
(zmierzony stan wyjściowy do przywrócenia + 15-punktowa ścieżka krytyczna).

### 4.2 Prawy panel nie istnieje poniżej 1024px

`NModeShell.tsx:232` renderuje panel jako `hidden lg:block`, a `grep` na
`lg:hidden` w całym `NModeLayout` nie zwraca **nic** — brak szuflady, arkusza
czy zakładki, które by go zastąpiły. Na telefonie nieosiągalne jest **każde**
działanie z sekcji „Akcje" (plan, approvale, linki artefaktów, zamknięcie),
na **sześciu** ekranach produktu:

```
CaseWorkspace/CaseDetailScreen.tsx:2267   standard/StandardArtifactShell.tsx:398
DiscoveryTools/KnownToolDetailView.tsx:2531   AIChat/KimiWorkspace/ExceleView.tsx:532
Interview/InterviewWorkspace.tsx:3254     Interview/InsightViewer.tsx:9189
```

`NModeShell.tsx` **nie jest tknięty przez żaden ze 118 commitów** — luka
wcześniejsza i wspólna, nie regresja tej gałęzi.

Dlaczego macierz axe 56/56 tego nie złapała i dlaczego to **nie jest**
sprzeczność: axe ocenia to, co **wyrenderowane**. Kontrolka nieobecna w DOM nie
generuje naruszenia kontrastu, etykiety ani fokusu — nie generuje węzła.
**Zielona macierz a11y nie jest dowodem kompletności mobile.**

### 4.3 Czego kandydat NIE obejmuje

- odbioru wizualnego właściciela (lista czekowania część B / DoD §18.1) — **zero
  ekranów oglądanych przez Piotra**;
- 218 wierszy kryteriów UI (§3.4);
- 14 z 18 ścieżek klienta oznaczonych `PARTIAL`, każda z nazwanym brakiem;
- `Komentarze` — odroczone decyzją OD-12;
- osieroconej karty czatu (`MessageRenderer.tsx` nie dokleja typu metadanych
  renderującego `CaseIntakeConfirmCard`) — poza plikami Case Workspace.

---

## 5. Zakazy dotrzymane

Nie wykonano: merge, rebase, cherry-picka, pusha, deployu, zmian Railway,
`stash`, `reset`, `clean`, `checkout` przywracającego pliki, `git add -A`,
usuwania worktree ani branchy, zmian w plikach innych modułów, „poprawiania"
wspólnych plików dla zielonych testów.

Testy mutujące na demo/staging: **żadnych**. Cały dowód runtime powstał na
lokalnej bazie jednorazowej.

---

## 6. Pułapki dopisane w tej fali

1. **Bramka opisana słowami to inna bramka niż bramka podana komendą.**
   Polecenie „uruchom pełną suitę" dało bare `npx vitest run` z korzenia repo:
   3866 plików / 38 882 testy, 481 plików czerwonych na niezwiązanej breakage
   całego monorepo, plus uderzenie w złą bazę. Kanoniczna bramka to 78 plików /
   619 testów, zawężona do `server/`, z jawnym env. **Zakres bramki cytuj
   dosłownie.**
2. **`RUN_DB_TESTS=1 MOCK_DB=false` decyduje, czy suita w ogóle dotyka bazy.**
   Bez nich `NODE_ENV=test` po cichu mockuje bazę i suita przechodzi
   przeciwko niczemu. Razem z pułapką 1: obie dają zieleń, która nic nie znaczy
   — jedna przez zbyt szeroki zakres, druga przez brak kontaktu z bazą.
3. **Przekierowanie samego stdout zamienia głośną odmowę w cichy kod wyjścia.**
   Guard migracji wypisał pełne wyjaśnienie na stderr; log stdout kończył się
   bannerem sukcesu. Zawsze `2>&1` albo stderr do osobnego pliku.
4. **CRLF, czwarty raz w jednej sesji.** `perl s/[ \t]+$//` nie zmienia nic;
   tylko widok bajtów pokazuje `0d0a`. `csv.writer` **domyślnie** pisze `\r\n`
   — każdy generator CSV musi jawnie ustawić `lineterminator='\n'`.
5. **zsh nie ma `/dev/tcp`.** Sprawdzenie portu tą metodą daje „CLOSED" dla
   działającej usługi. Baza testowa żyła jako kontener `case-workspace-test-pg`
   na 55432, mimo że test portu twierdził inaczej.
6. **Pusty log `tsc` to nie dowód sukcesu** — crash OOM drukuje dokładnie tyle
   samo. Liczy się kod wyjścia, zapisany na dysk, nie zaobserwowany w cudzej
   relacji.
7. **Zatrzymany pakiet potrafi się wznowić.** Unieważniony pakiet wystartował
   backend na porcie 3001, pod który wchodził jego następca — ryzyko
   health-checku cudzego procesu celującego w nieznaną bazę. Ubijaj po porcie,
   nie po nazwie.

---

## 7. Kolejność dla następcy

1. **VoiceOver ręcznie** wg runbooka albo zatwierdzenie okna uprawnień — to
   jedyny bloker zewnętrzny.
2. **Odbiór wizualny właściciela** na czystych zrzutach, ekran po ekranie.
   Nic nie wchodzi na demo bez tego.
3. **Prawy panel na mobile** (§4.2) — decyzja produktowa, bo dotyczy sześciu
   ekranów, nie tylko Case Workspace.
4. **218 wierszy kryteriów** — ewidencjonować albo wyłączyć z V1 z cytatem
   z kanonu / numerem decyzji właścicielskiej.

## 8. Czego następca NIE ma diagnozować od nowa

F2 (e2e), bootstrap capability, walidacja OpenAPI, `createNativeDeck`, ordering
migracji w pięciu mechanizmach, `--safe`, Run 30-minutowy, kolizja rejestru
capability (cztery rundy, dwa kształty naprawy), macierz axe 56/56, pętla
PlanView→CaseDetailScreen, zamknięcie Zlecenia. Wszystko ma dowód i kontrolę
negatywną.

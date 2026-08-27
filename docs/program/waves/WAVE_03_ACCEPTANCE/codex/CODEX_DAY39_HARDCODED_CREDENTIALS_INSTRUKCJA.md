# INSTRUKCJA DYŻURU nr 39 — Codex — „Usunięcie zaszytych poświadczeń z kodu — znalezisko bezpieczeństwa P0"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–38. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★ DLACZEGO TEN DYŻUR ISTNIEJE — dwa zdania, potem dowody

**Hasło do konta właściciela produktu, konta superadmina i dwóch kont
partnerskich jest wpisane literalnie w kodzie frontu, który Vite pakuje do
bundla wysyłanego do przeglądarki KAŻDEGO odwiedzającego.** Drugi egzemplarz
tego samego hasła leży w kilkudziesięciu skryptach seedujących, testach e2e
i dokumentach w repozytorium — część z nich celuje domyślnie w `demo.consultify.ai`.

Dowód, który zobaczysz sam w BLOKU 0 (`src/views/AuthView.tsx`, funkcja
`resolveQuickAccessCredentials`):

```
'7777': { email: 'piotr.wisniewski@dbr77.com', password: '<HASŁO>' },       // Admin
'7775': { email: 'pawel.mroczkowski@dbr77.com', password: '<HASŁO>' },      // Paweł (DBR77)
'1212': { email: 'pawel.mroczkowski@plastmetcentrum.pl', password: '<HASŁO>' },
'7776': { email: 'admin@dbr77.com', password: '<HASŁO>' },                  // SuperAdmin
'7778': { demo: true },
'1111': { email: 'anna.zielinska@ateliertoys-demo.com', password: '<HASŁO>' },
```

W tym dokumencie **nie ma i nie będzie** literalnej wartości hasła — piszę
`<HASŁO>`. Ty ją zobaczysz w kodzie i **nie przepisujesz jej do raportu**
(`Z18`).

Trzy zdania, które musisz przyjąć zanim zaczniesz:

1. **To nie jest dyżur „posprzątaj literki".** Produktem jest **stan, w którym
   zbudowany bundel produkcyjny nie zawiera ani jednego hasła i ani jednego
   adresu konta administracyjnego** — udowodniony `grep`-em po `dist/`, nie
   deklaracją.
2. **Mechanizm szybkiego dostępu (panel PIN) NIE jest wadą — wadą jest hasło
   w bundlu.** Właściciel używa tego panelu codziennie. Bezmyślne wycięcie
   funkcji jest **szkodą produktową**, nie „ostrożnością". Wariant do wykonania
   jest rozstrzygnięty w `§D.2` i jest **wiążący**.
3. **Nie zmieniasz żadnego hasła w żadnym środowisku i nie czyścisz historii
   gita.** Rotacja haseł i decyzja o historii należą do właściciela
   (`§1.5`). Twoje zadanie kończy się na drzewie roboczym.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Ten dyżur dotyka narzędzi, których właściciel i inne dyżury UŻYWAJĄ NA CO
DZIEŃ: skryptów seedujących, testów e2e i ekranu logowania. Domyślnym trybem
pracy jest „nie zepsuć tego, co działa", a nie „usunąć, bo brzydkie".**

1. **★ ZANIM ZMIENISZ JAKIKOLWIEK PLIK — INWENTARZ JEGO KONSUMENTÓW.**
   Dla każdego pliku, w którym coś zmieniasz, masz w raporcie wiersz:
   „kto ten plik woła" (`grep` po repo: `package.json` scripts, `Makefile`,
   `.github/workflows/**`, inne skrypty, dokumentacja instruktażowa). Zmiana
   pliku, którego konsumentów nie policzyłeś, **nie dostaje `ZROBIONE_WG_DoD`**.
2. **★ DLA KAŻDEGO ZMIENIONEGO SKRYPTU — DOWÓD RÓWNOWAŻNOŚCI.** Musisz pokazać,
   że **przy ustawionych zmiennych środowiskowych skrypt zachowuje się tak jak
   przed zmianą**. Jeżeli skrypt wymaga zdalnego środowiska (`demo`, `staging`,
   Railway) — **NIE URUCHAMIASZ GO** (`Z28`) i wpisujesz dosłownie:
   `NIE_URUCHOMIONE — wymaga zdalnego środowiska, Z28`, plus **dowód
   statyczny**: składnia (`python3 -m py_compile`, `bash -n`,
   `npx esbuild --outfile=/dev/null`) **oraz** dowód, że gałąź „brak zmiennej →
   odmowa" działa (uruchamiasz skrypt **bez** zmiennych i pokazujesz kod wyjścia
   ≠ 0 i komunikat — to jest bezpieczne, bo skrypt kończy się przed pierwszym
   połączeniem).
3. **★ NIE DOTYKASZ `scripts/seed-m16-demo.py`.** Ten plik jest własnością
   **dyżuru 38** i jest tam już naprawiany. **UWAGA — sprawdź to sam w BLOKU 0:
   na Twoim markerze ten plik NADAL ma zaszyte poświadczenia**, bo praca dnia 38
   nie jest scalona. To **nie jest** dla Ciebie sygnał „to jeszcze nie zrobione,
   więc zrobię". To jest kolizja. Plik idzie do inwentarza z adnotacją
   `KOLIZJA_38 — nie dotykam`.
4. **★ CAŁY `server/src/routes/auth.routes.ts` I CAŁY
   `server/src/middleware/auth.middleware.ts` SĄ POZA ZAKRESEM DO ZAPISU.**
   Wolno czytać. Dyżur 37 pracuje na uwierzytelnianiu; Ty pracujesz na **ekranie
   logowania i na poświadczeniach w plikach pomocniczych**. Rozdział plików
   w `§1.6` — przeczytaj go, zanim otworzysz cokolwiek w `server/src`.
5. **★ ZERO POŁĄCZEŃ ZDALNYCH (`Z28`).** Ani `curl` do demo, ani `railway`,
   ani `psql` do zdalnej bazy, ani uruchomienie testu e2e celującego w
   `demo.consultify.ai`. Jeżeli pozycja wymaga takiego dowodu — pozycja dostaje
   `CZĘŚCIOWO` z adnotacją `Z28`, nie STOP i nie improwizowany dowód.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: «MARKER_SHA»**

   > **★ RAMKA WARTOWNIKA — uwaga dla nadzorcy wystawiającego ten dokument
   > (usuń tę ramkę przy wiązaniu):** w miejsce **każdego** literalnego napisu
   > `«MARKER_SHA»` wpisujesz **rzeczywisty SHA tipa `codex/m03-admin-20260824`
   > z chwili wystawienia**, we **wszystkich** wystąpieniach w tym pliku
   > (sprawdź `grep -c '«MARKER_SHA»'` — wynik po podmianie musi być `0`).
   > W dokumencie **nie ma i nie może być przykładowego SHA**: dzień 29 dostał
   > instrukcję z konkretnym SHA wpisanym „na przykład" i wykonawca zawiązał się
   > do niego dosłownie, po czym pracował na martwej bazie. Dopóki ta ramka nie
   > jest usunięta, a `«MARKER_SHA»` nadal jest literalnym napisem, **dokument
   > NIE JEST ZWIĄZANY** i wykonawca ma obowiązek odrzucić go na pierwszej
   > komendzie dyżuru.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   Wynik obu komend wklejasz do raportu **dosłownie**.

3. **Jeśli marker nie jest przodkiem tipa, gałąź nie istnieje, albo `«MARKER_SHA»`
   jest nadal literalnym napisem `«MARKER_SHA»` — STOP.** Nie improwizuj bazy.
   Nie startuj z `origin/demo`, `main`, `Londyn`, `codex/preserve-*`,
   `codex/execution-*`, `codex/finance-*`, `codex/assessment-*`,
   `codex/meetings-*`, `codex/day3*` ani z żadnej gałęzi dni 17–38.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia.** Jeżeli marker JEST przodkiem, ale tip uciekł do przodu
   (nadzorca scalił coś po związaniu markera) — **to nie jest STOP**. Startujesz
   **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline «MARKER_SHA»..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest **obowiązkową** pozycją raportu. Każda komenda ma
   podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec instrukcji",
   **nie do improwizacji**:

   ```bash
   # (a) ★ SEDNO DYŻURU — mapa PIN→(e-mail,hasło) w kodzie frontu
   sed -n '139,170p' src/views/AuthView.tsx
   #   oczekiwane: type QuickAccessCredentials, funkcja resolveQuickAccessCredentials,
   #   gałąź isProdPublic z PIN-em '1111' oraz obiekt devStagingCodes z sześcioma PIN-ami

   grep -c "password: '" src/views/AuthView.tsx
   #   oczekiwane: 5 (cztery konta dev/staging + jedno prod-public)

   # (b) lista hostów, na których panel PIN w ogóle się pokazuje
   sed -n '114,137p' src/views/AuthView.tsx
   #   oczekiwane: isQuickAccessShortcutHost przepuszcza m.in. 'consultify.ai',
   #   'www.consultify.ai', każdy host zaczynający się od 'demo.'/'stage.'/'staging.',
   #   '*.consultify.com' oraz KAŻDY '*.railway.app'

   # (c) konsument mapy w komponencie
   grep -n "resolveQuickAccessCredentials\|handleQuickAccess\|Api.demoLogin" src/views/AuthView.tsx
   #   oczekiwane: :145 (definicja), :285 (wywołanie w handleQuickAccess), :293 (Api.demoLogin)

   # (d) dwa testy, które ZAKLEPUJĄ literalne hasło jako kontrakt
   ls src/views/__tests__/AuthView.quickAccess.test.ts
   ls tests/components/AuthView.quick-access-guard.test.tsx
   #   oczekiwane: oba pliki istnieją; oba asertują literalne hasło

   # (e) ★ KOLIZJA 38 — plik, którego NIE DOTYKASZ
   grep -n "BASE\|LOGIN" scripts/seed-m16-demo.py | head -5
   #   oczekiwane na markerze: BASE = "https://demo.consultify.ai" ORAZ literalne
   #   poświadczenia. To jest własność dyżuru 38 — patrz „KRYTYCZNE OGRANICZENIE" pkt 3.

   # (f) dwa skrypty M16, które SĄ Twoje
   grep -n "BASE\|password" scripts/test-m16-api-sweep.py scripts/test-m16-upload-fixtures.py
   #   oczekiwane: w obu BASE = "https://demo.consultify.ai" (twarda wartość domyślna)

   # (g) wzorzec, KTÓRY JUŻ JEST W REPO i który naśladujesz w testach
   sed -n '8,12p' tests/e2e/billing.spec.ts
   #   oczekiwane: process.env.TEST_USER_EMAIL || 'test@example.com'
   #                process.env.TEST_USER_PASSWORD || 'testpassword123'

   # (h) czy istnieje jakikolwiek strażnik regresji poświadczeń
   grep -rln "hardcoded credential\|zaszyte poświadczenia\|credential guard" tests scripts .github 2>/dev/null
   #   oczekiwane: PUSTO — takiego strażnika jeszcze nie ma, budujesz go w §D.7

   # (i) numeracja migracji — ten dyżur NIE POWINIEN mieć żadnej
   ls server/migrations | grep -E '^202612[89]'          # oczekiwane: PUSTE
   ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -3

   # (j) pliki dnia 38 — sprawdzasz, że ich NIE RUSZASZ
   ls scripts/validate-deploy-target.sh scripts/deploy-demo.sh
   LIT="$(printf '1234''56')"   # literalu hasla nie ma w tej instrukcji (Z18)
   grep -c "$LIT" scripts/validate-deploy-target.sh scripts/deploy-demo.sh
   #   oczekiwane: oba pliki istnieją, oba mają 0 trafień — czyli nie masz w nich
   #   nic do roboty i kolizja z 38 jest tylko formalna
   ```

5. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/credentials-day39-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-credentials-day39 codex/credentials-day39-<data>
   cd /private/tmp/consultify-credentials-day39
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # TYLKO ODCZYT
   ```

   **Katalog `/private/tmp/consultify-day39-instrukcja` istnieje i jest worktree,
   w którym powstał TEN dokument. NIE pracujesz w nim, nie kasujesz go, nie
   commitujesz do jego gałęzi.**

6. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w `§0.4a` oraz w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| - | ----- | -------- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/credentials-day39-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| `Z2` | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/*`, `fix/*`, `chore/*` | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak |
| `Z4` | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| `Z5` | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** | Chroniony, brudny worktree właściciela |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich **ponad 110**, w tym `consultify-day39-instrukcja`, `consultify-day38-*`, `consultify-day37-*`, `consultify-day33-*`, `consultify-day30-*` | Cudze worktree, część w aktywnym użyciu |
| `Z7` | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia **NASŁUCHUJĄ**: `5432`, `5474`, `5511`, `5597`, `5673`, `5674`, `5681`. Zarezerwowane przez wcześniejsze instrukcje i **ZAKAZANE**: `5432`, `5474`, `5498`, `5499`, `5511`, `5512`, `5521`, `5533`, `5544`, `5556`, `5563`, `5566`, `5567`, `5571`, `5573`, `5575`, `5577`, `5581`, `5588`, `5589`, `5591`, `5597`, `5602`, `5605`, `5613`, `5617`, `5629`, `5641`, `5648`, `5657`, `5661`, `5673`, `5674`, `5681`, `55291`, `55677`, `55941`, `59321`. **★ Twój kontener PG = `5689`** (jeżeli w ogóle go postawisz — patrz `§0.3`). Port zajęty → bierzesz pierwszy wolny **powyżej `5689`** i wpisujesz go do raportu | Cudze dyżury pracują równolegle |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów | Produkcja/demo poza zakresem |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **`Z9` przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** | „dane demo = twarz produktu" |
| `Z10` | **★★ Zero nowych flag funkcyjnych z wartością domyślną ON. Zero zmian wartości domyślnej istniejącej flagi.** Zmienna budowania, którą wprowadzasz w `§D.2`, jest **domyślnie NIEUSTAWIONA**, a jej brak oznacza **funkcja wyłączona** | `CLAUDE.md` reguła 9; flip flagi wymaga akceptu Piotra |
| `Z11` | **★★ NIE ZMIENIASZ ŻADNEGO HASŁA W ŻADNYM ŚRODOWISKU.** Nie wołasz endpointów zmiany hasła, nie piszesz skryptu rotacji, nie „ustawiasz bezpieczniejszego hasła" w seedzie. Rotacja = decyzja i czynność **właściciela**, po tym dyżurze | Zmiana hasła w seedzie rozjeżdża środowiska w sposób, którego nie widać do pierwszego nieudanego logowania |
| `Z12` | **★★ NIE CZYŚCISZ HISTORII GITA.** Zero `git filter-repo`, `filter-branch`, `BFG`, zero przepisywania commitów. Hasła **zostaną w historii** i to jest świadoma decyzja właściciela (rotacja załatwia problem taniej niż przepisanie 27 tys. plików) | Przepisanie historii unieważnia wszystkie markery wszystkich dyżurów w toku |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/CREDENTIALS_CLEANUP_DAY39_REPORT_20260828.md` | Repo tonie w dokumentach-duchach |
| `Z14` | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`.** Uważasz, że decyzja się myli → **errata w raporcie**, nie patch w rejestrze | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| `Z15` | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM** | Silnik AI = osobny moduł, ostatni w programie |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `UNKNOWN`.** Skrypt bez zmiennej ma **odmówić**, nie „poradzić sobie" | Uczciwa odmowa > ciche celowanie w produkcję |
| `Z17` | **★★ NIETYKALNE (wolno czytać, nie wolno zmieniać):** `server/src/routes/auth.routes.ts`, `server/src/middleware/auth.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/services/v8/featureFlagService.ts`, `server/src/services/legacyCutover/requireActiveMembership.ts` | Model uprawnień naprawiany in-house; **`auth.routes.ts` i `auth.middleware.ts` to dodatkowo terytorium dyżuru 37** (`§1.6`) |
| `Z18` | **★★ NIE PRZEPISUJESZ WARTOŚCI HASŁA DO RAPORTU ANI DO ŻADNEGO NOWEGO PLIKU.** W raporcie, w komentarzach, w komunikatach błędów, w nazwach zmiennych piszesz `<HASŁO>` albo `«hasło z env»`. Raport tego dyżuru jest **dokumentem, który zostaje w repo** — wpisanie do niego hasła cofa cały dyżur do punktu wyjścia | Dyżur o wycieku poświadczeń, który sam publikuje poświadczenie, jest anegdotą, nie pracą |
| `Z19` | **★★ ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `playwright*.config.ts`, `server/vitest.config*.ts`. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru.** Wyjątek: **żaden** — jeśli uznasz, że poświadczenia muszą wejść do konfiguracji Playwrighta, to jest **STOP**, nie edycja | Dyżur nr 2 wywalił tak 27 cudzych testów |
| `Z20` | **★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy** | Dzień 17 zmierzył stan wejściowy na cudzej bazie |
| `Z21` | **★ DoD wymaga DOWODU, nie deklaracji.** „Usunąłem hasło z pliku" nie jest dowodem. Dowodem jest `grep` po zbudowanym artefakcie i po drzewie, wklejony do raportu | Bez tego dyżur kończy się słowem „posprzątane" i niczym więcej |
| `Z22` | **★ Test, który wstrzykuje zależności, nie dowodzi ścieżki produkcyjnej.** Strażnik z `§D.7` ma skanować **drzewo źródeł**, nie zamockowany obiekt | Dzień 18: 8/8 zielonych, warstwa martwa |
| `Z23` | **★★ ZERO ATRAP.** Skrypt, który „udaje", że wziął hasło z env, a po cichu ma fallback na realne konto, jest **atrapą i regresją w jednym**. Fallback wolno mieć **wyłącznie** na wartości oczywiście lokalne i nieprodukcyjne (`test@localhost`, `test@example.com`) — nigdy na realny adres z domeny `dbr77.com`, `plastmetcentrum.pl` ani `ateliertoys-demo.com` | To jest cała różnica między „przeszło" a „bezpieczne" |
| `Z24` | **★ Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Podanie zawężonego wyboru albo przepisanie cudzej liczby zamiast własnego przebiegu = zawyżenie i podstawa odrzucenia | Baseline jest Twoim obowiązkiem, nie cytatem |
| `Z25` | **★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma fallback na `postgresql://iris:iris_test@localhost:5432/iris_test`, a port `5432` **NASŁUCHUJE i nie jest Twój** | Bez tego mierzysz — albo brudzisz — nie swoją bazę |
| `Z26` | **★ `RUN_DB_TESTS=1` i `MOCK_DB=false` obowiązkowe w tej samej linii, jeśli w ogóle uruchamiasz test DB.** `SKIPPED` **nie jest** `PASS` | Tak powstaje „137/137 PASS" na warstwie, która się nie uruchomiła |
| `Z27` | **★★ ZAKAZ `git stash` w tym dyżurze — w każdej postaci.** Odkładasz stan roboczy → **kopia przez `cp`** do `/private/tmp/consultify-credentials-day39-scratch/` i powrót `cp`-em. Niepusty `git stash list` na koniec = pozycja bez `ZROBIONE_WG_DoD` | `stash` w worktree z symlinkiem `node_modules` cicho gubi pliki nieśledzone |
| **`Z28`** | **★★ ZERO POŁĄCZEŃ SIECIOWYCH DO ŚRODOWISK PRODUKTU.** Zakazane: `curl`/`wget`/`httpx`/`requests` do `*.consultify.ai`, `*.consultify.com`, `*.railway.app`; `psql` do zdalnego hosta; uruchomienie `scripts/test-m16-*.py`, `tests/e2e/m16/**` ani żadnego testu z `VITE_API_TARGET` celującym poza `localhost`. **Dozwolone jest wyłącznie:** `git fetch` z `origin`/`github-backup`, `npm`/`npx` z lokalnego `node_modules`, oraz uruchomienie skryptu **bez zmiennych** w celu udowodnienia twardej odmowy (skrypt kończy się przed pierwszym połączeniem — sprawdź to w kodzie, zanim uruchomisz) | Dyżur o wycieku poświadczeń, który loguje się na demo „żeby sprawdzić", tworzy dokładnie ten ślad, który miał zlikwidować |

> **Ramka do `Z18`.** Zakaz obejmuje **także** raport pośredni, komentarz
> w kodzie i komunikat commitu. Jeżeli musisz odnieść się do konkretnej wartości
> — piszesz „literał hasła (6 znaków, identyczny we wszystkich trafieniach)".
> **Nie wklejasz `git diff` fragmentu, w którym hasło jest po stronie `-`**,
> jeżeli ten diff ma trafić do raportu; opisujesz zmianę słowami i podajesz SHA.

> **Ramka do `Z28`.** `Z28` **nie zwalnia** Cię z dowodu — zmienia jego postać.
> Dla skryptu wymagającego zdalnego środowiska dowodem jest: (1) `bash -n` /
> `py_compile`, (2) uruchomienie bez zmiennych → kod wyjścia ≠ 0 + komunikat,
> (3) **czytelny dowód, że gałąź odmowy leży PRZED pierwszym wywołaniem
> sieciowym** (numer linii `sys.exit`/`exit 1` vs numer linii pierwszego
> `requests.`/`curl`). Bez punktu (3) uruchomienie bez zmiennych jest zakazane.

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Siedem pozycji roboczych = **minimum
  siedem commitów** (plus jeden dokumentacyjny). Wrzucenie kilku pozycji do
  jednego commita jest **samodzielnym powodem, dla którego pozycja nie dostanie
  `ZROBIONE_WG_DoD`**. Conventional commits:

  ```
  docs(security): count every hardcoded credential in the tree (D.1)
  fix(security): stop shipping account passwords in the auth bundle (D.2)
  test(security): prove the production bundle carries no credential (D.3)
  fix(security): make operational scripts refuse to run without env credentials (D.4)
  fix(security): source e2e credentials from env with local-only fallbacks (D.5)
  docs(security): replace credential literals with variable names (D.6)
  test(security): guard the tree against credential literals coming back (D.7)
  docs(security): day 39 duty report (R.1)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach TS/TSX/JS tego
  commita: `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format`.
  Pliki `.py`, `.sh` i `.md` **zostawiasz bez formatera** — nie wprowadzasz
  `black`/`shfmt` do repo, które ich nie ma.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ `esbuild` TRANSPILUJE, nie typuje.** Dla `§D.2` to ma konkretne
  znaczenie: zmiana kształtu `QuickAccessCredentials` przejdzie `esbuild` nawet
  jeśli wywołanie w `handleQuickAccess` przestanie się typować. Dowodem jest
  **test jednostkowy `§D.2`**, nie `esbuild`.
- **★ POSTGRES JEST W TYM DYŻURZE OPCJONALNY.** Żadna pozycja nie wymaga bazy
  z definicji. Kontener na porcie `5689` stawiasz **tylko wtedy**, gdy pozycja
  `§D.4` doprowadzi Cię do seeda, który da się uczciwie uruchomić lokalnie.
  Jeśli go postawisz — obowiązuje `Z20`/`Z25`/`Z26` i **obowiązkowe sprzątanie
  `docker rm -fv`** (nigdy `docker volume prune` — zabija cudze kontenery).
- **★ MIGRACJE — dyżur 39 ma przydzielony przedział `20261280`–`20261289`
  i SPODZIEWAM SIĘ, ŻE NIE UŻYJESZ ANI JEDNEGO NUMERU.** Ten dyżur nie zmienia
  schematu. Jeżeli wyjdzie Ci, że migracja jest potrzebna — to jest **STOP**,
  nie plik. Numery spoza przedziału są zakazane, nawet jeśli `ls` pokazuje je
  jako wolne (`20261124`–`20261279` to pule dni 22–38, część niescalona).
  Obowiązkowy `ls` przed jakimkolwiek plikiem migracji:

  ```bash
  ls server/migrations | grep -E '^202612[89]'   # MUSI być PUSTE
  ```

- **★ NOWE pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
  przez lokalną konfigurację). Pliki `__tests__` obok kodu dodają się normalnie.
- **★ Dane demo = twarz produktu.** Nic, co zapisujesz, nie idzie do żadnej
  zdalnej bazy (`Z28`). Testy sprzątają po sobie.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Inwentarz konsumentów zrobiony PRZED zmianą** — dla każdego dotkniętego
   pliku wiersz „kto go woła" (`package.json`, `.github/workflows/**`, inne
   skrypty, dokumentacja). Brak inwentarza = brak `ZROBIONE_WG_DoD`.
2. **Zero literałów poświadczeń w zmienionym pliku** — udowodnione `grep`-em
   po pliku, wklejonym do raportu (wynik: `0`).
3. **Zero atrap (`Z23`)** — żadnego cichego fallbacku na realne konto. Fallback
   wyłącznie lokalny i nieprodukcyjny, **wypisany w raporcie z wartością**.
4. **Twarda odmowa przy braku zmiennej** — dla skryptów i narzędzi: brak
   zmiennej → kod wyjścia ≠ 0 → **czytelny komunikat po polsku lub angielsku,
   mówiący KTÓREJ zmiennej brakuje i jak ją ustawić**. Nigdy „silent default".
5. **Dowód równoważności zachowania** — patrz „KRYTYCZNE OGRANICZENIE" pkt 2.
   Albo uruchomienie z ustawionymi zmiennymi i identyczny wynik, albo dosłownie
   `NIE_URUCHOMIONE — wymaga zdalnego środowiska, Z28` + dowód statyczny.
6. **Adresy zdalne bez wartości domyślnej** — `BASE`/`API_URL`/`VITE_API_TARGET`
   i podobne **nie mają domyślnej wartości celującej w `demo`/`stage`/`prod`**.
   Dozwolone domyślne: `http://localhost:*`, `http://127.0.0.1:*` albo **brak
   domyślnej + odmowa**.
7. **Minimum 2 testy zachowania na pozycję kodową** (`§D.2`, `§D.5`, `§D.7`):
   ścieżka pozytywna (mechanizm działa przy poprawnej konfiguracji) i ścieżka
   negatywna (brak konfiguracji → mechanizm nieaktywny / odmowa). `§D.2` ma
   wyższe minimum podane we własnym paragrafie.
8. **Testy dotknięte zmianą uruchomione** — z rozbiciem **zastane / wprowadzone**
   wg `§0.4a`. Czerwony test zastany na markerze **nie jest** Twoją winą, ale
   **musi być wypisany**; czerwony wprowadzony = pozycja `CZĘŚCIOWO` albo STOP.
9. **`prettier` przed commitem** na plikach TS/TSX/JS.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód (grep/test) →
    konsumenci → równoważność`.
11. **`Z18` sprawdzone na własnym diffie** — po ostatnim commicie uruchamiasz
    i wklejasz wynik:

    ```bash
    git diff «MARKER_SHA»...HEAD -- docs/ | grep -c "$(printf '1234''56')" || true
    ```

    (Wynik ma być `0`. Konstrukcja `printf` jest celowa — żeby literał nie
    trafił do tej instrukcji.)
12. **Kontrola zakresu** — komenda bazowa nie pokazuje ani jednego pliku
    z listy `Z17`, ani `scripts/seed-m16-demo.py`, ani żadnego pliku
    konfiguracji testowej z `Z19`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (`Z24`)

1. **Zakres pomiaru** wyznaczasz z komendy bazowej, nie z własnego uznania:
   każdy plik testowy, który (a) zmieniłeś, (b) importuje zmieniony przez Ciebie
   moduł, (c) leży w tym samym katalogu `__tests__` co zmieniony moduł.
2. **Minimalny obowiązkowy zestaw** (uruchamiasz zawsze, nawet jeśli wydaje Ci
   się, że nie dotknąłeś):

   ```bash
   npx vitest run src/views/__tests__/AuthView.quickAccess.test.ts \
                  tests/components/AuthView.quick-access-guard.test.tsx \
                  --reporter=basic
   ```

3. **Baseline ZASTANY mierzysz PRZED pierwszym commitem**, na czystym markerze,
   tą samą komendą. Bez baseline'u nie masz prawa napisać „czerwone zastane".
4. **`SKIPPED` nie jest `PASS`.** Podajesz `X/Y PASS, S SKIPPED` i wyjaśniasz
   każdy `SKIPPED`.
5. **Testy e2e Playwrighta z `tests/e2e/**` są w tym dyżurze NIEURUCHAMIALNE**
   (`Z28` — celują w demo albo wymagają stojącego backendu). Dla nich dowodem
   jest **kompilacja** (`npx tsc --noEmit` na pojedynczym pliku jest zakazana —
   używasz `npx esbuild <plik> --loader:.ts=ts --outfile=/dev/null`) plus
   **`npx playwright test --list --config playwright.config.ts <plik>`**, która
   parsuje plik i wypisuje testy **bez uruchamiania przeglądarki i bez sieci**.
   Wynik `--list` wklejasz do raportu. Jeżeli `--list` próbuje wystartować
   webserver — przerywasz i wpisujesz `NIE_ZMIERZONE — Z28`.
6. **Testy osłabione / usunięte `describe`** — jeżeli zmieniasz asercję
   w istniejącym teście (a w `§D.2` **będziesz musiał**, bo dwa testy zaklepują
   literalne hasło jako kontrakt), wpisujesz do raportu tabelę
   `plik | asercja PRZED | asercja PO | dlaczego to nie jest osłabienie`.
7. **Deklaracja na koniec**: `ZASIĘG PEŁNY` albo `ZASIĘG CZĘŚCIOWY` + wyliczenie
   pominięć z powodem.

### 0.5. Reguła STOP

**STOP stawiasz, gdy brakuje decyzji, nie gdy jest trudno.** STOP jest tani,
zgadywanie jest drogie. W tym dyżurze STOP jest **obowiązkowy** w czterech
sytuacjach:

1. Marker niezwiązany albo nie jest przodkiem (`§0.1` pkt 3).
2. Okazuje się, że potrzebna jest **migracja bazy** (`§0.3`).
3. Okazuje się, że poświadczenia trzeba wpisać do **konfiguracji testowej
   objętej `Z19`** (`playwright*.config.ts`, `vitest*.config.ts`, `tests/setup.ts`).
4. Znajdujesz poświadczenie **innego rodzaju niż hasło do konta** — klucz API,
   token, sekret podpisujący, hasło do bazy w pliku śledzonym. **Nie naprawiasz
   go w tym dyżurze**; wpisujesz do „Znalezisk" i stawiasz STOP dla tej pozycji.

Format pozycji STOP w raporcie:

```
### STOP — <pozycja>
- Co miałem zrobić:
- Czego brakuje (decyzja / dostęp / informacja):
- Co sprawdziłem, zanim postawiłem STOP (komendy + wyniki):
- Dwa warianty rozwiązania z konsekwencjami:
- Moja rekomendacja i dlaczego:
```

**Czego STOP NIE oznacza:** nie oznacza „zostawiam plik z hasłem, bo nie wiem".
Jeżeli nie wiesz, jak dany plik naprawić, ale wiesz, że hasło ma z niego zniknąć
— **usuwasz hasło i zostawiasz odmowę**, a wątpliwość zgłaszasz w STOP-ie
dotyczącym *sposobu*, nie *faktu*.

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

Znalezisko powstało 27.08 przy przeglądzie ekranu logowania. Nikt go wcześniej
nie zgłosił, bo mechanizm szybkiego dostępu **działa i jest wygodny** —
właściciel loguje się nim codziennie czterema cyframi. Wada nie jest widoczna
w działaniu; jest widoczna dopiero wtedy, gdy się zapyta, **gdzie fizycznie
leży hasło, kiedy przeglądarka wykonuje `Api.login(...)`**. Odpowiedź: w pliku
JS pobranym przez każdego, kto otworzył stronę.

Do tego dochodzi drugi, cichszy problem: **to samo hasło rozlało się po repo**.
Skrypty seedujące, testy e2e i dokumenty instruktażowe kopiowały je od siebie
nawzajem przez kilka miesięcy. Część z tych skryptów ma **twardo wpisany adres
`https://demo.consultify.ai`** jako wartość domyślną — czyli uruchomienie ich
„na próbę" celuje w publiczne środowisko, a nie w localhost.

### 1.2. ★★ ERRATA — co zweryfikowałem w kodzie na markerze

Poniższe **sprawdziłem sam** przed wystawieniem tego dokumentu. Jeżeli u Ciebie
wyjdzie inaczej — to jest pozycja „Korekty wobec instrukcji", nie powód do
improwizacji.

1. **`resolveQuickAccessCredentials` żyje w `src/views/AuthView.tsx`** (ok. linii
   145–170) i zwraca **parę e-mail+hasło** albo `{ demo: true }`.
2. **Na `consultify.ai` / `www.consultify.ai` działa TYLKO PIN `1111`**
   (konto demo Anny). Kod administracyjny jest tam odfiltrowany. **To jest
   prawda i to jest za mało** — patrz punkt 4.
3. **Panel PIN pokazuje się także na `*.railway.app`, `demo.*`, `stage.*`,
   `staging.*` i `*.consultify.com`** (`isQuickAccessShortcutHost`). Środowiska
   staging są publiczne.
4. **★ NAJWAŻNIEJSZE — filtr hostowy NIE USUWA HASEŁ Z BUNDLA.** `isProdPublic`
   jest sprawdzeniem **czasu wykonania**, a mapa `devStagingCodes` jest **stałą
   w tym samym module**. Vite nie ma jak jej usunąć — trafia do artefaktu
   produkcyjnego w całości. Innymi słowy: **na `consultify.ai` PIN `7777` nie
   zaloguje, ale hasło do konta właściciela i tak jest w pobranym pliku.**
   To jest sedno P0 i to jest zdanie, którego nie wolno Ci pominąć w raporcie.
5. **`grep -c "password: '" src/views/AuthView.tsx` = 5.**
6. **Dwa testy zaklepują literalne hasło jako kontrakt:**
   `src/views/__tests__/AuthView.quickAccess.test.ts` i
   `tests/components/AuthView.quick-access-guard.test.tsx`. Oba **będziesz
   musiał zmienić** i oba trafiają do tabeli z `§0.4a` pkt 6.
7. **PIN `7778` (`{ demo: true }`) NIE wysyła żadnych poświadczeń** — woła
   `Api.demoLogin()` → `POST /api/auth/demo-login`. **Ale ten endpoint jest
   zamknięty poza `NODE_ENV=test`**: `isDemoLoginGatewayOpen()`
   (`server/src/routes/auth.routes.ts`, ok. `:1391`) wymaga **koniunkcji**
   `NODE_ENV==='test'` **i** `ENABLE_TEST_GATEWAY|E2E_MODE` **i**
   `TEST_SUPPORT_KEY` ≥ 12 znaków; inaczej `410 DEMO_LOGIN_DEPRECATED`.
   **Czyli `7778` na demo/prod jest dziś martwy** — to ważne dla `§D.2`.
8. **Istnieje żywa, bezpoświadczeniowa ścieżka demo:**
   `POST /api/auth/register-demo` (`auth.routes.ts` ok. `:1187`), wołana
   z frontu przez `Api.registerDemo(...)` w `src/components/Landing/DemoModeModal.tsx`.
   Ta ścieżka **nie wymaga żadnego hasła po stronie klienta**.
9. **★ LICZBA „145 PLIKÓW" JEST WSKAZÓWKĄ, NIE FAKTEM.** Policzyłem trzema
   metodami i dostałem **trzy różne wyniki**, wszystkie ≠ 145:

   | metoda | co liczy | wynik na markerze |
   | ------ | -------- | ----------------- |
   | M1 — surowy literał | pliki zawierające literał hasła gdziekolwiek | **193** |
   | M2 — literał po odfiltrowaniu oczywistych fałszywek (numery telefonu, klucze szyfrujące zbudowane z pełnej sekwencji cyfr, zestawy znaków w tłumaczeniach) | pliki z „gołym" literałem | **104** (274 linie) |
   | M3 — literał w kontekście poświadczenia (sąsiedztwo `password`/`hasło`) **∪** pliki z adresem realnego konta | realna powierzchnia | **207** |

   **Żadnej z tych liczb nie przepisujesz.** `§D.1` wymaga, żebyś policzył sam
   **i podał metodę**. Rozbieżność wobec „145" jest **oczekiwana** i sama w sobie
   nie jest błędem — błędem jest podanie liczby bez metody.
10. **★ Adres konta ≠ poświadczenie.** Adres `piotr.wisniewski@dbr77.com`
    występuje w ok. **127** plikach, w większości jako **autor dokumentu albo
    przykład**, bez hasła obok. **Tego nie ruszasz.** Celem jest **para**
    (adres + hasło) oraz **mapa PIN→konto w kodzie frontu**.
11. **`scripts/seed-m16-demo.py` NA MARKERZE MA ZASZYTE POŚWIADCZENIA I `BASE`
    CELUJĄCY W DEMO.** Naprawa dnia 38 nie jest scalona. **NIE DOTYKASZ.**
    Konsekwencja praktyczna: **wzorzec „naprawionego seeda" nie jest dostępny
    w drzewie** — wzorzec do naśladowania masz w `§D.4` w tym dokumencie,
    a wzorzec dla testów w `tests/e2e/billing.spec.ts` (ok. `:10-11`).
12. **`scripts/validate-deploy-target.sh` i `scripts/deploy-demo.sh` NIE
    ZAWIERAJĄ poświadczeń** (`grep -c` = 0 w obu). Kolizja z dyżurem 38 jest
    więc formalna — **i tak ich nie dotykasz**.
13. **Istniejący wzorzec env dla testów jest w repo:**
    `tests/e2e/billing.spec.ts:10-11` —
    `process.env.TEST_USER_EMAIL || 'test@example.com'`. To jest **konwencja
    zastana**, którą rozszerzasz, a nie wymyślasz nową.

### 1.3. ZAKRES — dokładnie siedem pozycji roboczych + jedna dokumentacyjna

| poz. | co | waga |
| ---- | -- | ---- |
| `D.1` | **Inwentarz policzony** — pełna lista miejsc, w pięciu kategoriach, z podaną metodą liczenia | fundament |
| `D.2` | **Front — mechanizm szybkiego dostępu bez haseł w bundlu** (wariant rozstrzygnięty poniżej) | **P0, sedno** |
| `D.3` | **Dowód na zbudowanym artefakcie** — `grep` po `dist/` | **P0, dowód** |
| `D.4` | **Skrypty operacyjne i seedy** — poświadczenia z env, twarda odmowa, `BASE` bez domyślnej produkcyjnej | P0 |
| `D.5` | **Testy e2e/integracyjne** — poświadczenia z env z fallbackiem wyłącznie lokalnym | P1 |
| `D.6` | **Dokumentacja** — literały → nazwy zmiennych | P1 |
| `D.7` | **Strażnik regresji** — test, który nie pozwala literałom wrócić | P1 |
| `R.1` | **Raport** | obowiązkowy |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **Rotacja haseł** w jakimkolwiek środowisku (`Z11`) — robi właściciel po tym dyżurze.
- **Czyszczenie historii gita** (`Z12`) — osobna decyzja właściciela.
- **`scripts/seed-m16-demo.py`** — dyżur 38.
- **`server/src/routes/auth.routes.ts`, `server/src/middleware/auth.middleware.ts`,
  `server/src/routes/assessment*`** — dyżur 37 (`§1.6`).
- **Jakakolwiek zmiana w polityce uwierzytelniania**: siła hasła, MFA,
  rate limiting, czas życia sesji, `isDemoLoginGatewayOpen`. Widzisz lukę →
  „Znaleziska".
- **Sekrety inne niż hasła do kont** — klucze API, tokeny, `ENCRYPTION_KEY`,
  hasła do baz w `docker-compose.yml`. STOP + „Znaleziska" (`§0.5` pkt 4).
- **Przenoszenie poświadczeń do menedżera sekretów / vaulta** — to jest projekt,
  nie dyżur.
- **Poprawianie stylu, refaktor `AuthView.tsx` poza obszarem szybkiego dostępu,
  kanon triady, powłoka SPEC-A.**
- **Katalogi generowane: `dist/`, `coverage/`, `out/`, `node_modules/`** — nie
  są plikami źródłowymi; do inwentarza wchodzą jako **osobna nota**, nie jako
  pozycje do naprawy. (`out/qa_*.json` to zrzuty przebiegów QA — zostają.)

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

- **DEC-A** — mechanizm szybkiego dostępu **zostaje jako funkcja**, znika jako
  nośnik haseł. Uzasadnienie w `§D.2`.
- **DEC-B** — hasła **nie są rotowane w ramach tego dyżuru**; historia gita
  **nie jest czyszczona**. Rotacja unieważnia wartość wycieku taniej niż
  przepisanie historii, która zabiłaby markery wszystkich dyżurów w toku.
- **DEC-C** — adres konta bez hasła obok **nie jest** poświadczeniem i **nie
  jest** przedmiotem masowego czyszczenia. Wyjątek: **mapa PIN→konto w kodzie
  frontu**, która jest listą kont uprzywilejowanych i znika w całości.
- **DEC-D** — fallback w testach jest dozwolony **wyłącznie** na adres
  oczywiście lokalny (`test@localhost`, `test@example.com`) i hasło oczywiście
  testowe. Nigdy na domenę realną.

### 1.6. ★ KOLIZJE Z DYŻURAMI W TOKU — rozdział plików, JAWNIE

Cztery dyżury pracują równolegle. **Dotknięcie cudzego pliku = STOP, nie merge.**

**Dyżur 38 (deploy/target):**

| plik | właściciel | Ty |
| ---- | ---------- | -- |
| `scripts/seed-m16-demo.py` | **38** | **NIE DOTYKASZ** — inwentarz z adnotacją `KOLIZJA_38` |
| `scripts/validate-deploy-target.sh` | **38** | NIE DOTYKASZ (i tak nie ma poświadczeń) |
| `scripts/deploy-demo.sh` | **38** | NIE DOTYKASZ (i tak nie ma poświadczeń) |
| `scripts/test-m16-api-sweep.py` | — | **TWÓJ** |
| `scripts/test-m16-upload-fixtures.py` | — | **TWÓJ** |

**Dyżur 37 (uwierzytelnianie / Assessment) — najważniejszy rozdział, bo obaj
jesteście „przy logowaniu":**

| obszar | dyżur 37 | dyżur 39 (Ty) |
| ------ | -------- | ------------- |
| `server/src/middleware/auth.middleware.ts` | **TAK** | **NIE** — `Z17` |
| `server/src/routes/auth.routes.ts` | **TAK** | **NIE** — `Z17`, wolno czytać |
| `server/src/routes/assessment*` | **TAK** | **NIE** |
| `src/views/AuthView.tsx` | **NIE** | **TAK** |
| `src/views/__tests__/AuthView.*` | **NIE** | **TAK** |
| `tests/components/AuthView.*` | **NIE** | **TAK** |
| `src/services/api.ts` | **NIE** | **TYLKO ODCZYT** — nie zmieniasz klienta API |

**Zdanie rozstrzygające:** dyżur 37 zmienia **to, jak serwer sprawdza tożsamość**;
dyżur 39 zmienia **to, skąd przeglądarka i skrypty biorą poświadczenia**.
Te dwa zbiory plików są rozłączne. Jeżeli Twoja zmiana wymaga tknięcia serwera
uwierzytelniania — **STOP**, nie „przecież to jedna linijka".

**Dyżur 33 (Realizacja / polityka progów)** — pliki `server/src/services/executionControl/**`,
`server/src/routes/pmo/**`, `src/components/Execution/**`. **Zero styku.**

**Dyżur 30 (finance-v2)** — `server/src/services/finance/**`, `src/components/Finance/**`.
**Styk jeden:** `tests/e2e/m16/**` i `scripts/test-m16-*.py` dotyczą Finansów,
ale dyżur 30 pracuje na kodzie produkcyjnym, nie na tych harnessach. **Są Twoje.**
Jeżeli komenda bazowa pokaże u Ciebie plik z `server/src/services/finance/**`
albo `src/components/Finance/**` — **cofasz zmianę**, to nie jest Twój teren.

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

**(a) Kod produkcyjny frontu — 1 plik, `P0`**

- `src/views/AuthView.tsx` — `isQuickAccessShortcutHost` (~`:120`),
  `isQuickAccessEnabledHost` (~`:135`), typ `QuickAccessCredentials` (~`:139`),
  `resolveQuickAccessCredentials` (~`:145-170`), `quickAccessEnabled` (~`:209`),
  `handleQuickAccess` (~`:283-317`).

**(b) Kod serwera — SPODZIEWANE ZERO.** Nie znalazłem pary adres+hasło
w `server/src/**` poza testami. Jeżeli znajdziesz — pozycja idzie do `D.4`,
**chyba że** plik jest na liście `Z17` (wtedy STOP).

**(c) Skrypty operacyjne i seedy — Twoje, ok. 16 plików**

- `scripts/test-m16-api-sweep.py`, `scripts/test-m16-upload-fixtures.py`
  (oba: literał + `BASE = "https://demo.consultify.ai"`)
- `server/scripts/dev-ensure-admin.ts`
- `server/scripts/fix-dbr77-credentials.sh`
- `server/scripts/seed-dbr77-restore-demo.ts`
- `server/scripts/seed-production-dbr77-users.ts`
- `server/scripts/seed_dbr77_postgres.js`
- `server/scripts/seed-interview-demo.ts`
- `server/scripts/seedLegolexDemoOrg.js`, `server/scripts/seedEnglishTestData.js`
- `server/scripts/test_login.cjs`
- `server/seed/seed_dbr77_complete.js`, `server/seed/seed_dbr77_users.js`
- `server/seeds/demoUser.js`, `server/seeds/demoUser_demo.js`
- `docs/qa/runs/2026-07-05-m06-audyt/_audit_script.mjs`
  (**uwaga: to skrypt leżący w `docs/` — kategoria (c), nie (e)**)

**(d) Testy — ok. 60–70 plików, w tym ok. 9–14 w `tests/e2e/**`**

- `tests/e2e/m16/_m16.ts` (**wspólny harness — napraw go PIERWSZY**, reszta
  `tests/e2e/m16/**` importuje z niego)
- `tests/e2e/uspojnienie/f1…f5-*.spec.ts` (pięć plików)
- `tests/e2e/m14-execution-cockpit.spec.ts`, `tests/e2e/m15-results-cockpit.spec.ts`,
  `tests/e2e/m15/m15-results-panels.spec.ts`
- `tests/e2e/decision-management.spec.ts`, `tests/e2e/auth.spec.ts`,
  `tests/e2e/critical-user-flow.spec.ts`, `tests/e2e/fullFlow.spec.ts`,
  `tests/e2e/navigation.spec.ts`, `tests/e2e/projects.spec.ts`,
  `tests/e2e/aiPlaybooks.spec.ts`, `tests/e2e/debug_login_error.spec.ts`,
  `tests/e2e/superadmin/*.spec.ts`
- `src/views/__tests__/AuthView.quickAccess.test.ts`,
  `tests/components/AuthView.quick-access-guard.test.tsx` (**te dwa należą
  do `D.2`, nie do `D.5`**)
- `tests/unit/backend/controllers/authController.test.js`
- **★ PUŁAPKA:** w `tests/e2e/` leżą pliki **bez rozszerzenia** —
  `analytics.spec`, `load.spec`, `portfolio-module.spec`, `security.spec`,
  `settings.spec`, `tasks.spec`, `trial.spec`, `onboarding.spec` i inne.
  **Playwright ich nie zbiera** (wzorzec `**/*.spec.ts`), więc są **martwe**.
  Traktujesz je jak kategorię (d), ale w raporcie oznaczasz `MARTWY_PLIK`
  i **nie tworzysz dla nich testów dowodowych**. Nie kasujesz ich —
  usunięcie martwych plików to osobna decyzja.

**(e) Dokumentacja — ok. 17 plików**

- `docs/testing/TESTING_OPERATING_SYSTEM_PRO_2026-05-06.md`
- `docs/testing/CHAT_P0_MANUAL_QA_CHECKLIST_2026-05-06.md`
- `docs/testing/PRESENTATION_GENERATOR_MANUAL_TEST_BACKLOG.md`
- `docs/testing/reports/IDEA_MIND_MAP_P0_P2_FINAL_GO_GATE_2026-05-17.md`
- `docs/product/work-packets/IMPLEMENTATION_CONTROL_BOARD.md`
- `docs/product/work-packets/V8_SINGLE_ORG_SHADOW_PILOT.md`
- `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/SEC-PUB-002_PUBLIC_SYSTEM_SURFACE.md`
- `Harvard/_HANDOFF_USPOJNIENIE_2026-06-25.md`
- pozostałe wg Twojego inwentarza z `D.1`

**(f) Poza zakresem naprawy, do noty w inwentarzu**

- `public/locales/*/translation.json` — trafienie to zestaw znaków
  `"AĄBCĆ… - <pełna sekwencja cyfr 0-9>"`, **nie hasło**.
- `docker-compose.yml`, `vitest.config.ts` — `ENCRYPTION_KEY` z ciągiem
  z ciągiem `<pełna sekwencja cyfr 0-9>abcdef…`, **nie hasło do konta**
  (`§0.5` pkt 4 → „Znaleziska").
- `.env.example`, `.env.production.example` — `WHATSAPP_TO` z przykładowym
  numerem `+48<cyfry>`, **numer telefonu**, nie hasło.
- `dev-render/**`, `out/**` — harnessy i zrzuty QA.

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **„Filtr hostowy załatwia sprawę"** — nie załatwia. Filtr działa w czasie
   wykonania, literał leży w artefakcie. To jest pułapka nr 1 tego dyżuru.
2. **„Zamieniłem hasło na zmienną, gotowe"** — dopóki zmienna ma fallback na
   realne konto, nic się nie zmieniło (`Z23`).
3. **„Usunąłem funkcję, jest bezpiecznie"** — i właściciel stracił codzienne
   narzędzie. Decyzja `DEC-A` mówi wprost: funkcja zostaje.
4. **„Testy przeszły"** — dwa testy w tym repo **asertują literalne hasło**.
   Jeśli po Twojej zmianie są zielone bez modyfikacji, to znaczy, że nic nie
   zmieniłeś w tym, co one sprawdzają.
5. **„Uruchomię seed na demo, żeby sprawdzić, czy działa"** — `Z28`.
   To jest dokładnie ta czynność, którą ten dyżur ma uczynić niemożliwą.
6. **Masowy `sed` po repo** — zamieni też numery telefonu, klucze szyfrujące
   i zestawy znaków w tłumaczeniach. **Każda zmiana jest przeglądana ręcznie.**
7. **Przepisanie liczby z instrukcji** — `§1.2` pkt 9 pokazuje, że nawet
   nadzorca dostał trzy różne wyniki. Policz sam, podaj metodę.

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. Marker (`§0.1` pkt 2–3). Wynik dosłownie do raportu.
2. Warunki wstępne (`§0.1` pkt 4, podpunkty a–j). Tabela do raportu.
3. Własna gałąź i worktree (`§0.1` pkt 5). Symlink `node_modules`.
4. **Oświadczenie o chronionym checkoutcie** — do raportu, dosłownie:
   „Nie dotykałem `/Users/piotrwisniewski/Developer/Consultify` poza symlinkiem
   `node_modules` (odczyt)."
5. **Oświadczenie `Z28`** — do raportu, dosłownie: „Nie wykonałem żadnego
   połączenia do `*.consultify.ai`, `*.consultify.com`, `*.railway.app` ani do
   zdalnej bazy." Dowód: `history | grep -E 'curl|wget|railway|psql'` (albo
   równoważny) wklejony na koniec dyżuru.
6. **Baseline testowy** (`§0.4a` pkt 3) — uruchamiasz obowiązkowy zestaw
   **na czystym markerze, przed pierwszym commitem**. Wynik do raportu jako
   „czerwone ZASTANE".
7. **Inwentarz `D.1`** — to jest pierwsza pozycja robocza, nie rozgrzewka.
8. **★ INWENTARZ KONSUMENTÓW** — dla każdego pliku, który zamierzasz zmienić:

   ```bash
   # kto woła ten skrypt?
   grep -rn "<nazwa-pliku>" package.json Makefile .github/ scripts/ docs/ server/package.json 2>/dev/null
   ```

   Wynik idzie do raportu **przed** commitem zmieniającym ten plik.
9. `git stash list` — musi być pusty i musi być pusty na koniec (`Z27`).
10. Kontener PG **tylko jeśli `§D.4` tego zażąda** — port `5689`, obraz
    `pgvector/pgvector:pg16` (`postgres:15` **nie przechodzi migracji** — brak
    rozszerzenia `vector`). Sprzątanie `docker rm -fv` obowiązkowe.

---

## §D.1 — INWENTARZ POLICZONY (produkt: sekcja raportu)

**Cel:** żeby nikt — łącznie z Tobą — nie musiał już nigdy zgadywać, ile tego
jest i gdzie.

### Co robisz

1. **Deklarujesz metodę liczenia.** Musisz podać **co najmniej trzy** przebiegi
   i pokazać, że dają różne wyniki (bo dają — `§1.2` pkt 9):

   ```bash
   EXCL="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=coverage"
   LIT="$(printf '1234''56')"

   # M1 — surowy literał
   grep -rl "$LIT" $EXCL . | wc -l

   # M2 — literał po odfiltrowaniu oczywistych fałszywek
   grep -rn "$LIT" $EXCL . \
     | grep -vE "0${LIT}789|${LIT}789|${LIT}[0-9]|[0-9]${LIT}|${LIT}[a-z-]" \
     > /tmp/d39_m2.txt
   cut -d: -f1 /tmp/d39_m2.txt | sort -u | wc -l

   # M3 — para (adres konta) ∪ (literał w kontekście hasła)
   grep -rlE "piotr\.wisniewski@dbr77\.com|pawel\.mroczkowski@(dbr77\.com|plastmetcentrum\.pl)|admin@dbr77\.com|anna\.zielinska@ateliertoys-demo\.com" $EXCL . | sort > /tmp/d39_mail.txt
   grep -rlE "(password|passwd|hasło|haslo|PASSWORD)[^a-zA-Z0-9]{0,10}[\"']?$LIT" $EXCL . | sort > /tmp/d39_pw.txt
   sort -u /tmp/d39_mail.txt /tmp/d39_pw.txt | wc -l
   ```

2. **Wybierasz JEDNĄ metodę jako wiążącą dla reszty dyżuru** i uzasadniasz
   wybór jednym zdaniem. Rekomendacja autora: **M2 rozszerzone o M3-hasłowe**
   (czyli: pliki z „gołym" literałem po odfiltrowaniu fałszywek), bo to jest
   dokładnie zbiór „gdzie leży hasło", a nie „gdzie leży e-mail".
3. **Kategoryzujesz** wynik na pięć kategorii i podajesz liczbę per kategoria:
   `(a) kod produkcyjny frontu`, `(b) kod serwera`, `(c) skrypty operacyjne
   i seedy`, `(d) testy e2e/integracyjne`, `(e) dokumentacja`.
   Plus **szósta nota**: `(f) trafienia fałszywe / poza zakresem` — z krótkim
   powodem per pozycja (`§1.7 (f)`).
4. **Dla kategorii (c) i (d) dopisujesz kolumnę `KONSUMENCI`** — z BLOKU 0 pkt 8.
5. **Oznaczasz kolizje:** `KOLIZJA_38`, `KOLIZJA_37`, `MARTWY_PLIK`.

### Definicja ukończenia `D.1`

- [ ] Trzy przebiegi liczenia z wynikami, wklejone dosłownie.
- [ ] Jedna metoda wskazana jako wiążąca + jednozdaniowe uzasadnienie.
- [ ] Tabela pięciu kategorii z liczbami; suma się zgadza z metodą wiążącą.
- [ ] Nota (f) z uzasadnieniem per pozycja.
- [ ] Kolumna `KONSUMENCI` dla (c) i (d).
- [ ] Wyraźne zdanie: „liczba 145 z briefu jest / nie jest zgodna z metodą X;
      moja liczba to N wg metody Y" (`§1.2` pkt 9).
- [ ] **Ani jednej wartości hasła w tekście inwentarza** (`Z18`).

---

## §D.2 — FRONT: MECHANIZM SZYBKIEGO DOSTĘPU BEZ HASEŁ W BUNDLU (P0, SEDNO)

### ★ ROZSTRZYGNIĘCIE WARIANTU — wiążące, z uzasadnieniem

Rozważane były trzy warianty:

**(A) Całkowite usunięcie funkcji szybkiego dostępu.**
Bezpieczne i najprostsze. **ODRZUCONE.** Powód: mechanizm nie jest wadą —
wadą jest nośnik. Właściciel loguje się nim codziennie; usunięcie zamienia
jedno wciśnięcie skrótu na dwa pola formularza przy każdym wejściu, na każdym
środowisku, przy każdym przełączeniu konta (a właściciel przełącza między
kontem właściciela, superadmina i dwoma kontami partnerskimi). To jest realna
strata w narzędziu pracy, poniesiona **bez zysku bezpieczeństwa ponad to, co
daje wariant B** — bo po B w bundlu i tak nie ma czego ukraść.

**(C) Zostawić same e-maile, hasło wpisuje użytkownik.**
Usuwa hasło, **ale zostawia w bundlu publicznym listę kont uprzywilejowanych**
(właściciel, superadmin, dwóch partnerów) razem z mapą PIN-ów. To jest gotowa
lista celów do ataku słownikowego i phishingu, wysyłana każdemu odwiedzającemu.
Jednocześnie **odbiera właścicielowi całą wygodę** — i tak musi wpisać hasło.
**ODRZUCONE:** połowa kosztu, ułamek korzyści, nowa powierzchnia enumeracji.

**★ (B+) WARIANT WIĄŻĄCY — mechanizm zostaje, ale cała jego zawartość pochodzi
ze zmiennej budowania, a produkcyjna ścieżka demo idzie przez serwer bez
poświadczeń.**

Trzy elementy, wszystkie obowiązkowe:

1. **Mapa PIN→konto znika z kodu w całości** i jest odczytywana z
   `import.meta.env.VITE_QUICK_ACCESS_MAP` — pojedynczy ciąg JSON, parsowany
   w bloku `try/catch`. **Brak zmiennej → pusta mapa → funkcja nieaktywna.**
   W repo **nie ma ani jednego adresu, ani jednego hasła, ani jednego PIN-u**.
2. **Produkcyjny skrót demo (`1111`) przestaje wysyłać hasło.** Zamiast
   `Api.login(email, password)` woła **bezpoświadczeniową ścieżkę serwerową**.
   **Wybór ścieżki jest Twoją decyzją do udowodnienia, nie do zgadnięcia** —
   patrz „Krok 4" niżej.
3. **Filtr hostowy zostaje jako druga, niezależna bramka** (obrona w głąb),
   ale przestaje być bramką jedyną.

**Dlaczego B+ a nie samo B:** samo B (mapa z env) usuwa literały ze źródła,
ale gdyby ktoś ustawił `VITE_QUICK_ACCESS_MAP` w buildzie produkcyjnym,
hasła wróciłyby do bundla — a produkcyjny skrót `1111` **wymagałby** takiego
ustawienia, żeby nadal działać. Element 2 zrywa tę zależność: **produkcja nie
potrzebuje mapy w ogóle**, więc zmienna może być tam trwale nieustawiona,
a to jest stan, który da się wymusić i sprawdzić (`§D.3`).

**Co właściciel zyskuje:** ten sam skrót, te same cztery cyfry, na localhost
i na własnym buildzie dev/staging — po jednorazowym wpisaniu mapy do
`.env.local` (plik **niewersjonowany**; sprawdź, że `.gitignore` go łapie,
a jeśli nie — **STOP**, bo to zmienia charakter zmiany).

**Co właściciel traci:** skrót administracyjny przestaje działać na publicznym
buildzie produkcyjnym — czyli dokładnie tam, gdzie i tak dziś nie działa
(`§1.2` pkt 2).

### Co budujesz — krok po kroku

**Krok 1 — nowy moduł konfiguracji, oddzielony od widoku.**
Zakładasz `src/config/quickAccess.ts` (nowy plik; **nie** rozdymasz `AuthView.tsx`):

- `type QuickAccessEntry = { email: string; password: string } | { demo: true }`
- `export function readQuickAccessMap(env = import.meta.env): Record<string, QuickAccessEntry>`
  — parsuje `env.VITE_QUICK_ACCESS_MAP`; **każdy błąd → `{}`**, nigdy wyjątek
  w górę, nigdy `console.log` z zawartością (`Z18`).
- Walidacja wejścia: klucz musi pasować do `/^\d{4}$/`; wpis musi mieć albo
  `email`+`password` (oba niepuste stringi), albo `demo: true`. Wpisy
  niepasujące są **po cichu odrzucane** — nie przerywają całej mapy.
- **Zero wartości domyślnych. Zero literałów. Zero adresów.**

**Krok 2 — `resolveQuickAccessCredentials` przestaje mieć własne dane.**
Sygnatura zostaje ta sama (żeby nie ruszać konsumentów), ciało czyta z mapy
z kroku 1. Zachowujesz istniejące zachowanie bramkowania hostem
(`isQuickAccessShortcutHost`) — **to jest druga bramka, nie usuwasz jej**.

**Krok 3 — gałąź produkcyjna nie sięga po mapę.**
Na hoście prod-publicznym (`consultify.ai` / `www.consultify.ai`) funkcja
**nie czyta mapy w ogóle** i obsługuje wyłącznie skrót demo z kroku 4.

**Krok 4 — ★ ścieżka demo bez poświadczeń (do UDOWODNIENIA, nie zgadnięcia).**
Sprawdzasz w kodzie, **która** bezpoświadczeniowa ścieżka jest żywa, i wybierasz
**dokładnie jedną**, wpisując dowód do raportu:

```bash
# kandydat 1 — anonimowy demo-login: sprawdź, czy bramka go nie zamyka na prod
sed -n '1388,1415p' server/src/routes/auth.routes.ts
grep -n "isDemoLoginGatewayOpen" server/src/routes/auth.routes.ts

# kandydat 2 — rejestracja demo (używana dziś przez landing)
sed -n '1185,1200p' server/src/routes/auth.routes.ts
grep -n "registerDemo" src/services/api.ts src/components/Landing/DemoModeModal.tsx
```

**Wynik, którego się spodziewam** (zweryfikowany na markerze): kandydat 1 jest
zamknięty poza `NODE_ENV=test` (`410 DEMO_LOGIN_DEPRECATED`), więc **jedyną
żywą ścieżką jest kandydat 2** — `Api.registerDemo(...)`. Jeżeli u Ciebie
wyjdzie inaczej — „Korekty wobec instrukcji".

**Jeżeli okaże się, że ŻADNA bezpoświadczeniowa ścieżka nie jest żywa na
produkcji — to jest STOP dla kroku 4** (nie dla całej pozycji): elementy 1 i 3
robisz mimo to, skrót `1111` na produkcji **wyłączasz** (właściciel ma na
landingu przycisk demo, który woła tę samą ścieżkę), a decyzję o docelowym
kształcie publicznego skrótu oddajesz właścicielowi w STOP-ie.

**★ Czego w kroku 4 NIE ROBISZ:** nie zmieniasz `isDemoLoginGatewayOpen`,
nie otwierasz `/demo-login` na produkcji, nie dotykasz `auth.routes.ts`
(`Z17`, dyżur 37). Krok 4 jest **wyłącznie zmianą po stronie klienta**:
który istniejący, już działający endpoint zostaje zawołany.

**Krok 5 — dwa testy, które zaklepują literalne hasło.**
`src/views/__tests__/AuthView.quickAccess.test.ts` i
`tests/components/AuthView.quick-access-guard.test.tsx` **przestają asertować
wartość hasła**. Po zmianie mają sprawdzać **zachowanie**, nie dane:

- przy braku `VITE_QUICK_ACCESS_MAP` → `resolveQuickAccessCredentials(...)`
  zwraca `null` **dla każdego PIN-u i każdego hosta**;
- przy podstawionej **syntetycznej** mapie (`{"9999":{"email":"test@localhost","password":"local-only"}}`)
  → poprawny PIN na hoście dev zwraca ten wpis, a na hoście prod-publicznym `null`;
- host spoza listy (`evil.consultify.ai`) → `null` **niezależnie od mapy**
  (regresja, którą te testy dziś chronią — **nie wolno jej zgubić**);
- mapa uszkodzona (nie-JSON, zły kształt, PIN 3-cyfrowy) → `{}`, bez wyjątku.

Tabela `asercja PRZED | asercja PO | dlaczego to nie jest osłabienie`
obowiązkowa (`§0.4a` pkt 6).

### Definicja ukończenia `D.2`

- [ ] `grep -c "password: '" src/views/AuthView.tsx` = **0**.
- [ ] `grep -rc "dbr77\|plastmetcentrum\|ateliertoys-demo" src/views/AuthView.tsx src/config/quickAccess.ts` = **0**.
- [ ] Brak `VITE_QUICK_ACCESS_MAP` → panel nieaktywny (test).
- [ ] Mapa syntetyczna → panel działa jak przed zmianą (test).
- [ ] Host spoza listy → `null` (test regresji zachowany).
- [ ] Mapa uszkodzona → `{}`, bez wyjątku (test).
- [ ] Krok 4 rozstrzygnięty **dowodem z kodu**, wynik w raporcie.
- [ ] `.env.example` uzupełniony o `VITE_QUICK_ACCESS_MAP=` **z pustą wartością
      i komentarzem**, co to jest i że **nigdy nie ustawia się jej w produkcji**.
      **Zero przykładowej zawartości z realnym kontem** (`Z18`).
- [ ] `.gitignore` łapie `.env.local` — sprawdzone `git check-ignore -v .env.local`.
- [ ] Tabela zmienionych asercji (`§0.4a` pkt 6).
- [ ] `prettier` + `esbuild` na zmienionych plikach.
- [ ] Inwentarz konsumentów `AuthView.tsx` (kto importuje eksporty tego modułu).

---

## §D.3 — DOWÓD NA ZBUDOWANYM ARTEFAKCIE (P0)

**To jest jedyny dowód, który liczy się w tym dyżurze.** `grep` po źródłach
mówi, co napisałeś; `grep` po `dist/` mówi, co dostaje przeglądarka.

### Co robisz

1. Budujesz front **lokalnie, bez żadnej zmiennej quick-access**:

   ```bash
   npx vite build --mode production
   ```

   **Jeżeli build wymaga sieci albo pada z powodu niezwiązanego z Twoją zmianą**
   — nie walczysz z nim. Wpisujesz `NIE_ZBUDOWANE — <dosłowny błąd>` i
   przechodzisz do punktu 4 (dowód zastępczy). **Nie instalujesz niczego
   nowego, nie zmieniasz `vite.config.ts`.**

2. Skanujesz artefakt:

   ```bash
   LIT="$(printf '1234''56')"
   grep -rl "$LIT" dist/ | head
   grep -rlE "dbr77\.com|plastmetcentrum\.pl|ateliertoys-demo\.com" dist/ | head
   grep -rl "7777\|7775\|7776\|7778" dist/assets/*.js | head
   ```

   **Oczekiwane: wszystkie trzy puste.** Trafienie na `7777` może być fałszywką
   (liczba w innym kontekście) — sprawdzasz kontekst i uzasadniasz.

3. **Kontrola pozytywna (żeby dowód nie był pusty z przypadku):** budujesz
   **drugi raz**, tym razem z podstawioną **syntetyczną** mapą:

   ```bash
   VITE_QUICK_ACCESS_MAP='{"9999":{"email":"test@localhost","password":"local-only"}}' npx vite build --mode production
   grep -rl "test@localhost" dist/ | head    # oczekiwane: TRAFIENIE
   ```

   Trafienie dowodzi, że Twój `grep` w ogóle umie znaleźć takie dane w bundlu —
   czyli że pustka z punktu 2 jest informacją, a nie artefaktem metody.
   **Po tym buildzie kasujesz `dist/` i budujesz jeszcze raz bez zmiennej**,
   żeby nie zostawić w drzewie artefaktu z danymi.

4. **Dowód zastępczy** (tylko gdy build niewykonalny): `grep` po **całym
   drzewie źródeł frontu**, które Vite pakuje:

   ```bash
   grep -rn "$LIT" src/ | grep -v "__tests__"     # oczekiwane: PUSTE
   grep -rnE "dbr77\.com|plastmetcentrum\.pl|ateliertoys-demo\.com" src/ | grep -v "__tests__"
   ```

   Wpisujesz jawnie: „dowód zastępczy, artefakt nie zbudowany, powód: …".

5. **`dist/` nie wchodzi do commitu.** Sprawdź `git status` i `.gitignore`.

### Definicja ukończenia `D.3`

- [ ] Wynik `grep` po `dist/` (albo dowód zastępczy) wklejony dosłownie.
- [ ] Kontrola pozytywna wykonana i opisana (albo jawnie: niewykonalna, powód).
- [ ] `dist/` nie jest w commicie; `git status` czysty poza zamierzonymi plikami.
- [ ] Zdanie w raporcie: „bundel produkcyjny **zawiera / nie zawiera** haseł
      i adresów kont administracyjnych" — jednoznacznie.

---

## §D.4 — SKRYPTY OPERACYJNE I SEEDY (P0)

**Zasada:** skrypt bierze poświadczenia **wyłącznie** ze zmiennych środowiskowych
i **odmawia startu**, gdy ich nie ma. Adres zdalny **nie ma wartości domyślnej
celującej w demo/produkcję**.

### Wzorzec — Python (ten dokument jest jedynym miejscem, gdzie go masz)

```python
import os, sys

def require_env(name: str, hint: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(
            f"[ODMOWA] Brak zmiennej {name}. {hint}\n"
            f"Przyklad: {name}=... python3 {sys.argv[0]}"
        )
    return value

BASE     = require_env("CONSULTIFY_API_BASE", "Adres API, np. http://localhost:3001")
EMAIL    = require_env("CONSULTIFY_EMAIL",    "Adres konta uzywanego przez skrypt")
PASSWORD = require_env("CONSULTIFY_PASSWORD", "Haslo tego konta")
```

**Trzy rzeczy, które w tym wzorcu są istotne i których nie wolno uprościć:**

1. `sys.exit(...)` **przed** jakimkolwiek importem sieciowym w ścieżce
   wykonania — dzięki temu uruchomienie bez zmiennych jest bezpieczne (`Z28`).
2. Komunikat mówi **którą** zmienną ustawić i **jak** — nie „missing config".
3. `BASE` też jest wymagane. **Nie `os.environ.get("BASE", "https://demo...")`.**
   Wartość domyślna celująca w demo jest osobnym defektem, nie wygodą.

### Wzorzec — Bash

```bash
set -euo pipefail
: "${CONSULTIFY_API_BASE:?[ODMOWA] Ustaw CONSULTIFY_API_BASE (np. http://localhost:3001)}"
: "${CONSULTIFY_EMAIL:?[ODMOWA] Ustaw CONSULTIFY_EMAIL}"
: "${CONSULTIFY_PASSWORD:?[ODMOWA] Ustaw CONSULTIFY_PASSWORD}"
```

### Wzorzec — Node / TypeScript (seedy `server/scripts/**`, `server/seed*/**`)

```ts
function requireEnv(name: string, hint: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    console.error(`[ODMOWA] Brak zmiennej ${name}. ${hint}`);
    process.exit(1);
  }
  return value;
}
```

**★ Uwaga dla seedów, które dziś tworzą konta z zaszytym hasłem** (np.
`seed_dbr77_*`, `demoUser*`, `seed-production-dbr77-users`): hasło **nowo
zakładanego** konta też pochodzi z env (`SEED_USER_PASSWORD`), bez domyślnej.
**Nie ustawiasz „bezpieczniejszego" hasła** (`Z11`) — usuwasz literał i
wymuszasz podanie.

### Kolejność pracy w `D.4`

1. **Najpierw inwentarz konsumentów** wszystkich plików kategorii (c)
   (BLOK 0 pkt 8). Skrypt, którego nikt nie woła i który jest oczywiście
   martwy, **oznaczasz `MARTWY_SKRYPT`** i mimo to naprawiasz — usunięcie
   martwego kodu to osobna decyzja, ale zostawienie w nim hasła nie.
2. **Potem `scripts/test-m16-api-sweep.py` i `scripts/test-m16-upload-fixtures.py`**
   — mają jednocześnie literał i `BASE` celujący w demo, więc są najlepszą
   ilustracją obu reguł.
3. **Potem `server/scripts/**`, `server/seed/**`, `server/seeds/**`.**
4. **Na końcu `docs/qa/runs/2026-07-05-m06-audyt/_audit_script.mjs`** —
   to skrypt, mimo że leży w `docs/`.

### Dowód równoważności — obowiązkowy per plik

Dla każdego zmienionego skryptu w raporcie wiersz:

| plik | konsumenci | uruchomiony? | dowód |
| ---- | ---------- | ------------ | ----- |
| … | `package.json:scripts.X` / brak | `TAK` (z env, wynik identyczny) / `NIE_URUCHOMIONE — Z28` | składnia OK + odmowa bez env (kod wyjścia, komunikat) + nr linii odmowy vs nr linii pierwszego wywołania sieciowego |

### Definicja ukończenia `D.4`

- [ ] Zero literałów poświadczeń w zmienionych plikach (`grep` = 0 per plik).
- [ ] Zero domyślnych `BASE`/URL celujących w `demo`/`stage`/`prod`
      (`grep -n "consultify\.ai\|consultify\.com\|railway\.app" <plik>` = 0
      poza komentarzem-przykładem, który **nie jest** wartością domyślną).
- [ ] Każdy skrypt bez zmiennych → kod wyjścia ≠ 0 + czytelny komunikat.
- [ ] Tabela równoważności wypełniona dla **każdego** pliku.
- [ ] Inwentarz konsumentów per plik.
- [ ] `scripts/seed-m16-demo.py` **nietknięty** — potwierdzone komendą bazową.
- [ ] Żadnej zmiany hasła w żadnym środowisku (`Z11`).

---

## §D.5 — TESTY E2E I INTEGRACYJNE (P1)

**Zasada:** poświadczenia z konfiguracji testowej / zmiennych, z fallbackiem
**wyłącznie** na wartości oczywiście lokalne i nieprodukcyjne.

### Wzorzec — jest już w repo, naśladujesz go

`tests/e2e/billing.spec.ts` (ok. `:10-11`):

```ts
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';
```

Dla tego dyżuru przyjmujesz **te same nazwy zmiennych** (`TEST_USER_EMAIL`,
`TEST_USER_PASSWORD`) — nie wymyślasz trzeciej konwencji. Fallback:
`'test@localhost'` / wartość oczywiście testowa. **Nigdy domena realna.**

### Kolejność

1. **`tests/e2e/m16/_m16.ts` PIERWSZY** — to wspólny harness, reszta
   `tests/e2e/m16/**` importuje `EMAIL`/`PASSWORD` z niego. Napraw go raz,
   a naprawisz cały kubełek. **Uwaga:** ten plik ma też w komentarzu
   `VITE_API_TARGET=https://demo.consultify.ai` jako instrukcję uruchomienia —
   **komentarz przerabiasz na `$VITE_API_TARGET` z opisem**, nie zostawiasz
   gotowej komendy celującej w demo (`§D.6` stosuje się także do komentarzy).
2. **`tests/e2e/uspojnienie/f1…f5`** — pięć plików, ta sama zmiana.
3. **Reszta `tests/e2e/**`** wg inwentarza.
4. **`tests/unit/**` i `src/**/__tests__/**`** — jeśli inwentarz je pokaże.
5. **Pliki bez rozszerzenia `.ts`** (`analytics.spec`, `load.spec`, …):
   naprawiasz literał, oznaczasz `MARTWY_PLIK`, **nie** piszesz do nich testów
   i **nie** próbujesz ich uruchamiać.

### ★ Czego w `D.5` NIE ROBISZ

- **Nie dotykasz `playwright*.config.ts` ani `vitest*.config.ts`** (`Z19`).
  Jeżeli uznasz, że zmienne muszą trafić do konfiguracji — **STOP**.
- **Nie uruchamiasz testów e2e** (`Z28`). Dowodem jest `--list` i `esbuild`
  (`§0.4a` pkt 5).
- **Nie „naprawiasz" testów, które są czerwone od markera.** Wypisujesz je.

### Definicja ukończenia `D.5`

- [ ] Zero literałów poświadczeń w zmienionych testach.
- [ ] Fallbacki wyłącznie lokalne — **wypisane w raporcie z wartościami**.
- [ ] `_m16.ts` naprawiony jako pierwszy; lista plików, które z niego korzystają.
- [ ] Dla każdego zmienionego pliku e2e: `esbuild` OK + `playwright --list` OK
      (albo `NIE_ZMIERZONE — Z28` z powodem).
- [ ] Testy jednostkowe dotknięte zmianą uruchomione, rozbicie zastane/wprowadzone.
- [ ] Żaden plik z `Z19` w komendzie bazowej.

---

## §D.6 — DOKUMENTACJA (P1)

**Zasada:** literał hasła → placeholder. Jeżeli dokument opisuje **procedurę
operacyjną**, ma wskazywać **nazwę zmiennej**, nie wartość.

### Co robisz

1. **Hasło → `<HASŁO>`** (albo `«hasło z env»`) wszędzie.
2. **Procedura operacyjna → zmienna.** Przykład przekształcenia:

   - **PRZED:** „zaloguj się jako `piotr.wisniewski@dbr77.com` / `<literał>`"
   - **PO:** „zaloguj się kontem z `$CONSULTIFY_EMAIL` / `$CONSULTIFY_PASSWORD`
     (ustaw je przed uruchomieniem procedury; skrypt odmówi startu bez nich)"

3. **Gotowe komendy celujące w demo/prod → komenda z zmienną.** Przykład:
   `python3 scripts/test-m16-api-sweep.py` z `BASE` zaszytym w skrypcie
   zamienia się na
   `CONSULTIFY_API_BASE=<adres> CONSULTIFY_EMAIL=… python3 scripts/test-m16-api-sweep.py`.
4. **Adres konta bez hasła obok — ZOSTAWIASZ** (`DEC-C`). Dokument, w którym
   napisano „właściciel: piotr.wisniewski@dbr77.com", jest w porządku.
5. **Dokumenty historyczne (raporty z przebiegów, `docs/qa/runs/**`,
   `docs/testing/reports/**`) — hasło usuwasz, reszty treści NIE przepisujesz.**
   To są zapisy tego, co się wydarzyło; nie poprawiasz historii, usuwasz z niej
   sekret.
6. **`Harvard/**` — obowiązuje ta sama reguła.** Nie „porządkujesz" tych
   dokumentów przy okazji.

### Definicja ukończenia `D.6`

- [ ] Zero literałów hasła w kategorii (e) — `grep` per plik.
- [ ] Każdy dokument proceduralny wskazuje zmienną, nie wartość — lista plików
      proceduralnych z krótką notą „co zmieniłem".
- [ ] Adresy kont bez hasła nietknięte — jawne zdanie w raporcie.
- [ ] Zero zmian merytorycznych poza usunięciem sekretu — potwierdzone
      przeglądem własnego diffu.

---

## §D.7 — STRAŻNIK REGRESJI (P1)

**Cel:** żeby literał nie wrócił za trzy tygodnie, gdy ktoś skopiuje stary
skrypt.

### Co budujesz

Test **skanujący drzewo źródeł** (`Z22` — skanuje pliki, nie zamockowany obiekt),
w `tests/security/no-hardcoded-credentials.test.ts` (**nowy plik w `tests/` →
`git add -f`**). Test:

1. Zbiera pliki źródłowe (`src/**`, `server/src/**`, `server/scripts/**`,
   `server/seed*/**`, `scripts/**`, `tests/e2e/**`) — **bez** `node_modules`,
   `dist`, `coverage`, `out`, `.git`.
2. Szuka **wzorców**, nie literału wpisanego wprost w plik testu.
   Wzorzec hasła składasz w kodzie (`['1234','56'].join('')`) — **plik testu
   nie może zawierać literału** (`Z18`).
3. Zgłasza błąd, gdy znajdzie: (a) literał hasła w sąsiedztwie słowa
   `password`/`hasło`, (b) parę adres-z-realnej-domeny + hasło w tym samym
   pliku, (c) `https://demo.consultify.ai` / `*.railway.app` jako **wartość
   domyślną** (`||`, `??`, `os.environ.get(..., "...")`, `:-`).
4. **Ma listę wyjątków (`ALLOWLIST`) z powodem per pozycja** — na start
   wpisujesz do niej **`scripts/seed-m16-demo.py` z powodem
   `KOLIZJA_38 — naprawiane w dyżurze 38`** i wszystko, czego nie zdążyłeś
   (każda pozycja z powodem i z datą). **Pusta allowlista jest podejrzana;
   allowlista bez powodów jest niedopuszczalna.**
5. Komunikat błędu mówi **co zrobić** („poświadczenia z env, wzorzec:
   `docs/…/CODEX_DAY39_HARDCODED_CREDENTIALS_INSTRUKCJA.md` §D.4"), a **nie
   pokazuje znalezionej wartości** (`Z18`) — tylko ścieżkę i numer linii.

### Testy samego strażnika (minimum 2)

- Na katalogu tymczasowym z podstawionym plikiem-atrapą → strażnik **znajduje**.
- Na katalogu z plikiem czystym → strażnik **milczy**.

### Definicja ukończenia `D.7`

- [ ] Strażnik uruchamia się i **przechodzi na Twojej gałęzi** — wynik wklejony.
- [ ] Strażnik **nie przechodzi** na podstawionym pliku-atrapie (dowód).
- [ ] `ALLOWLIST` ma powód i datę per pozycja; `seed-m16-demo.py` na liście.
- [ ] Plik testu **nie zawiera** literału hasła (`grep` = 0).
- [ ] Komunikat błędu nie ujawnia wartości.
- [ ] Plik dodany przez `git add -f` i widoczny w commicie.
- [ ] **`Z19` nienaruszone** — strażnik nie wymaga zmiany żadnej konfiguracji
      testowej. Jeżeli wymaga (bo nowy katalog `tests/security/` nie jest
      zbierany przez `vitest.config.ts`) — **STOP** i połóż plik tam, gdzie
      istniejąca konfiguracja go zbiera (sprawdź `include` w `vitest.config.ts`
      **czytając go**, nie zmieniając).

---

## §R.1 — RAPORT

Jeden plik, dokładnie ten:
`docs/program/waves/WAVE_03_ACCEPTANCE/CREDENTIALS_CLEANUP_DAY39_REPORT_20260828.md`

Szablon w `§9`. **`Z18` obowiązuje w raporcie najostrzej ze wszystkich miejsc.**

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~90 min, NIE pomijasz)
Marker → warunki wstępne → worktree → oświadczenia → **baseline testowy** →
`git stash list`.

### Blok 1 — inwentarz (`D.1`)
Trzy metody liczenia → wybór metody wiążącej → kategoryzacja → konsumenci →
kolizje. **Commit.** Bez tego nie zaczynasz `D.2`.

### Blok 2 — sedno (`D.2` → `D.3`)
Moduł konfiguracji → `resolveQuickAccessCredentials` → gałąź prod →
rozstrzygnięcie kroku 4 → dwa testy → **commit** → build → `grep` po `dist/` →
kontrola pozytywna → **commit**.

### Blok 3 — skrypty (`D.4`)
Konsumenci → M16 → `server/scripts` → `server/seed*` → `_audit_script.mjs`.
**Commit.**

### Blok 4 — testy (`D.5`)
`_m16.ts` → `uspojnienie/f1…f5` → reszta. **Commit.**

### Blok 5 — dokumentacja (`D.6`)
Literały → placeholdery; procedury → zmienne. **Commit.**

### Blok 6 — strażnik (`D.7`)
Test + allowlista + dwa testy strażnika. **Commit.**

### Blok 7 — domknięcie (obowiązkowo, ~60 min)

```bash
# 1. komenda bazowa — pełna lista zmian
git diff --name-only «MARKER_SHA»...HEAD

# 2. kontrola zakresu — te komendy MUSZĄ być puste
git diff --name-only «MARKER_SHA»...HEAD | grep -E "seed-m16-demo\.py|validate-deploy-target\.sh|deploy-demo\.sh"
git diff --name-only «MARKER_SHA»...HEAD | grep -E "auth\.routes\.ts|auth\.middleware\.ts|routes/assessment"
git diff --name-only «MARKER_SHA»...HEAD | grep -E "vitest.*\.config\.ts|playwright.*\.config\.ts|tests/setup\.ts|tests/helpers/|tests/__mocks__/"
git diff --name-only «MARKER_SHA»...HEAD | grep -E "server/src/services/finance/|src/components/Finance/|server/src/services/executionControl/"
git diff --name-only «MARKER_SHA»...HEAD | grep -E "^server/migrations/"

# 3. Z18 — hasło nie trafiło do raportu ani do żadnego nowego pliku
LIT="$(printf '1234''56')"
git diff «MARKER_SHA»...HEAD | grep -c "^+.*$LIT" || true      # oczekiwane: 0

# 4. Z27 — brak stasha
git stash list                                                  # oczekiwane: PUSTE

# 5. sprzątanie kontenera, jeśli był
docker rm -fv cx-day39-pg 2>/dev/null || true                   # NIGDY docker volume prune

# 6. dist/ nie jest w commicie
git status --porcelain | grep -E "^\?\? dist/|^A  dist/" || echo "dist czysty"

# 7. Z28 — brak połączeń zdalnych
history | grep -E "curl|wget|railway|psql .*-h " || echo "brak polaczen zdalnych"
```

### Zasada nadrzędna kolejności

**`D.1` przed wszystkim. `D.3` bezpośrednio po `D.2` — nigdy na końcu dyżuru**,
bo to jedyny dowód, który weryfikuje sedno, i musi być czas na reakcję, gdyby
wypadł źle. `D.7` na końcu, bo dopiero wtedy allowlista jest znana.

**Jeżeli zabraknie czasu:** porzucasz `D.6`, potem `D.5`, potem `D.7`.
**Nigdy nie porzucasz `D.1`, `D.2` ani `D.3`.** Porzucona pozycja dostaje
`NIE_ZACZĘTE` z powodem, nie milczenie.

---

## 9. RAPORT — jedyny dokument, który tworzysz

### 9.1. Szablon

```markdown
# Poświadczenia dzień 39 — usunięcie zaszytych haseł z kodu — raport dyżuru <data>

## Marker i baza
## Oświadczenie o chronionym checkoutcie (Z5)
## Oświadczenie Z28 — zero połączeń do demo/staging/produkcji (+ dowód)
## Oświadczenie Z18 — w tym raporcie nie występuje wartość żadnego hasła (+ wynik grepa)
## Oświadczenie o zakazie `git stash` (Z27) — wynik `git stash list`
## ★ WERYFIKACJA ERRATY §1.2 — trzynaście punktów, wynik per punkt
## Warunki wstępne — tabela (BLOK 0 pkt 2, podpunkty a-j)
## ★ INWENTARZ KONSUMENTÓW (BLOK 0 pkt 8) — per plik

## D.1 — INWENTARZ POLICZONY
### Trzy metody liczenia — komendy i wyniki dosłownie
### Metoda wiążąca + uzasadnienie (jedno zdanie)
### Tabela pięciu kategorii | kategoria | liczba plików | liczba linii | uwagi |
### (f) trafienia fałszywe / poza zakresem — powód per pozycja
### Kolizje: KOLIZJA_38 / KOLIZJA_37 / MARTWY_PLIK / MARTWY_SKRYPT
### Zdanie o liczbie 145 z briefu

## Pozycje — tabela zbiorcza
| poz. | status | commit SHA | dowód | konsumenci | równoważność |

## D.2 — front
### Wariant wybrany: B+ | uzasadnienie odrzucenia A i C (własnymi słowami)
### Krok 4 — dowód z kodu, która ścieżka demo jest żywa
### Tabela zmienionych asercji | plik | PRZED | PO | dlaczego to nie osłabienie |
### grep -c "password: '" src/views/AuthView.tsx = ?
### .gitignore łapie .env.local? (git check-ignore -v)

## D.3 — DOWÓD NA ARTEFAKCIE
### vite build: wykonany / NIE_ZBUDOWANE (powód)
### grep po dist/ — trzy komendy, wyniki dosłownie
### Kontrola pozytywna — wynik
### ZDANIE ROZSTRZYGAJĄCE: bundel produkcyjny zawiera / nie zawiera poświadczeń

## D.4 — skrypty
### Tabela | plik | konsumenci | uruchomiony? | dowód odmowy | nr linii odmowy vs pierwsze wywołanie sieciowe |
### grep BASE/URL domyślnych = 0 per plik

## D.5 — testy
### Tabela | plik | fallback (wartość) | esbuild | playwright --list |
### Lista plików importujących _m16.ts

## D.6 — dokumentacja
### Lista dokumentów proceduralnych + co zmieniłem
### Potwierdzenie: adresy kont bez hasła nietknięte

## D.7 — strażnik
### Wynik na mojej gałęzi | wynik na pliku-atrapie
### ALLOWLIST — pozycja | powód | data

## ★ POMIAR TESTÓW (Z24) — pełny zakres §0.4a
### Zakres: X/Y PASS, S SKIPPED
### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik
### Czerwone WPROWADZONE — per plik + SHA commitu
### SKIPPED — powód per pozycja
### NIE_ZMIERZONE (Z28) — per plik + powód
### Deklaracja: ZASIĘG PEŁNY / CZĘŚCIOWY + wyliczenie pominięć
### Zdanie: nie przepisałem żadnej cudzej liczby — zmierzyłem sam

## Bezpieczniki — dowody (siedem komend z §8 Blok 7)
## Migracje: SPODZIEWANE ZERO — potwierdzenie (przedział 20261280-89 nietknięty)
## Errata i korekty wobec instrukcji
## Znaleziska (NIE naprawiane przeze mnie) — w tym sekrety innej klasy (§0.5 pkt 4)
## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — <pozycja>
## Licznik (8 pozycji: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / NIE_ZACZĘTE)
## Kontrola zakresu i cleanup
## Czego NIE zrobiłem i dlaczego
## Gotowość
```

### 9.2. Zasady raportowania

- **Nie zawyżasz.** `CZĘŚCIOWO` z powodem jest wart więcej niż
  `ZROBIONE_WG_DoD` bez dowodu. Odbiorca sprawdza `grep`-em, nie na słowo.
- **Nie przepisujesz liczb** — ani z tego dokumentu, ani z cudzych raportów.
- **Nie wklejasz wartości hasła** — nigdzie, w żadnej postaci, także w diffie
  (`Z18`).
- **Każde „nie dało się" ma powód i komendę**, która to pokazuje.
- **Znaleziska ≠ naprawy.** Wszystko, co znajdziesz poza zakresem, idzie do
  „Znalezisk" z lokalizacją i jednym zdaniem, dlaczego to sprawa.

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# literał bez wpisywania go do pliku
LIT="$(printf '1234''56')"
EXCL="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=coverage"

# inwentarz — trzy metody (§D.1)
grep -rl "$LIT" $EXCL . | wc -l
grep -rn "$LIT" $EXCL . | grep -vE "0${LIT}789|${LIT}789|${LIT}[0-9]|[0-9]${LIT}|${LIT}[a-z-]" | wc -l

# formatowanie — PRZED KAŻDYM COMMITEM (tylko TS/TSX/JS)
npx prettier --write <pliki>

# typy punktowo (NIGDY pełny tsc)
npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null

# test celowany BEZ bazy
npx vitest run <plik> --reporter=basic

# e2e — TYLKO parsowanie, bez uruchamiania (Z28)
npx playwright test --list --config playwright.config.ts <plik>

# build frontu i skan artefaktu (§D.3)
npx vite build --mode production
grep -rl "$LIT" dist/ ; grep -rlE "dbr77\.com|plastmetcentrum\.pl|ateliertoys-demo\.com" dist/

# kontener PG — TYLKO jeśli §D.4 tego wymaga
docker run -d --name cx-day39-pg -p 5689:5432 \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day39 pgvector/pgvector:pg16

# test z bazą — SZEŚĆ zmiennych w tej samej linii (Z20/Z25/Z26)
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5689/cx_day39 \
npx vitest run <plik> --reporter=basic

# sprzątanie (obowiązkowe) — NIGDY docker volume prune
docker rm -fv cx-day39-pg

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only «MARKER_SHA»...HEAD

# odłożenie stanu roboczego — ZAMIAST git stash (Z27)
mkdir -p /private/tmp/consultify-credentials-day39-scratch
cp <plik> /private/tmp/consultify-credentials-day39-scratch/
# powrót:
cp /private/tmp/consultify-credentials-day39-scratch/<plik> <plik>
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. Uznanie, że filtr hostowy usuwa hasła z bundla. **Nie usuwa** (`§1.2` pkt 4).
2. Zostawienie fallbacku na realne konto „żeby nie zepsuć" (`Z23`).
3. Uruchomienie seeda albo testu e2e „żeby sprawdzić" (`Z28`).
4. Dotknięcie `scripts/seed-m16-demo.py` (dyżur 38).
5. Dotknięcie `auth.routes.ts` / `auth.middleware.ts` (dyżur 37, `Z17`).
6. Dopisanie zmiennych do `playwright.config.ts` (`Z19` — **odrzucenie dyżuru**).
7. Wpisanie wartości hasła do raportu (`Z18`).
8. Masowy `sed` po repo, który zamienia numery telefonu i klucze szyfrujące.
9. Przepisanie liczby „145" zamiast policzenia (`§1.2` pkt 9).
10. Zmiana hasła w seedzie „na bezpieczniejsze" (`Z11`).
11. Wykonanie `D.3` na końcu dyżuru, gdy nie ma już czasu na reakcję.
12. Zmiana asercji w dwóch testach `AuthView` bez tabeli PRZED/PO (`§0.4a` pkt 6).

### 10.3. Czego NIE robisz, choć „aż się prosi"

- **Nie czyścisz historii gita** (`Z12`) — nawet „tylko tego jednego pliku".
- **Nie usuwasz martwych plików** (`*.spec` bez rozszerzenia, martwe seedy) —
  usuwasz z nich sekret, resztę zgłaszasz w „Znaleziskach".
- **Nie przenosisz poświadczeń do menedżera sekretów** — to projekt, nie dyżur.
- **Nie poprawiasz siły hasła, MFA, rate limitingu** — `§1.4`.
- **Nie refaktorujesz `AuthView.tsx`** poza obszarem szybkiego dostępu.
- **Nie „domykasz" `isDemoLoginGatewayOpen`** — jest zamknięte i to jest dobrze.

---

## 11. NA KONIEC

Ten dyżur ma jedno zdanie, po którym odbiorca pozna, czy się udał:

> **„Zbudowany bundel produkcyjny nie zawiera ani jednego hasła i ani jednego
> adresu konta administracyjnego, a właściciel nadal loguje się czterema
> cyframi na swoim środowisku."**

Jeżeli po Twojej pracy oba człony tego zdania są prawdziwe i **udowodnione
`grep`-em, nie deklaracją** — dyżur jest zrobiony. Jeżeli prawdziwy jest tylko
pierwszy człon, zrobiłeś wariant A, który został odrzucony, i trzeba to naprawić.
Jeżeli tylko drugi — nic się nie zmieniło.

Reszta pozycji (`D.4`–`D.7`) domyka drugą połowę problemu: żeby to samo hasło
nie leżało w kilkudziesięciu skryptach, z których część domyślnie celuje
w publiczne środowisko.

**Rotację haseł robi właściciel po Twoim odbiorze. Historii gita nie ruszamy.
Twoja praca kończy się na drzewie roboczym i na raporcie.**

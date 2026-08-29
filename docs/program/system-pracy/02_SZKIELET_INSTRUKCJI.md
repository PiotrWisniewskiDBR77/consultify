# SZKIELET INSTRUKCJI DYŻURU — szablon wielokrotnego użytku

**Do czego to jest.** To jest **forma do wypełnienia**, nie esej do czytania.
Autor instrukcji dyżuru kopiuje CZĘŚĆ A do swojego dokumentu **bez zmian**,
podmienia wyłącznie pola `<<NAZWA_POLA>>`, potem wypełnia szablony tabel
z CZĘŚCI B, przechodzi listę kontrolną z CZĘŚCI C i sprawdza, czy nie powtarza
żadnego z błędów z CZĘŚCI D.

**Skąd to się wzięło.** Destylat czterech instrukcji wydanych 2026-08-28
(dyżury 55 Ustawienia · 56 Rdzeń uwierzytelniania · 57 Spotkania · 58 CI).
Wspólna, niezależna od modułu część stanowiła w nich ok. 60–70% objętości
i za każdym razem była pisana od nowa — z rozjazdami, które CZĘŚĆ D wylicza
imiennie.

**Trzy zasady użycia:**

1. **Nie skracasz CZĘŚCI A.** Każdy bezpiecznik ma za sobą incydent. Usunięcie
   zakazu, bo „w tym dyżurze nie dotyczy", jest tym samym, co jego złamanie
   w następnym dyżurze, który skopiuje Twoją instrukcję.
2. **Każde pole `<<…>>` musi zniknąć przed wydaniem.** Zostawione pole
   w wydanym dokumencie = błąd wydania. Kontrola: `grep -c '<<' <plik>` → `0`.
3. **Dokument ma być SAMODZIELNY.** Wykonawca dostaje **tylko ten plik**
   i repozytorium. Zero odwołań do rozmów, ustaleń, poprzednich dyżurów bez
   podania ścieżki w repo.

---
---

# CZĘŚĆ A — GOTOWY §0 DO SKOPIOWANIA

**Poniższy blok kopiujesz do instrukcji dyżuru DOSŁOWNIE.** Podmieniasz
wyłącznie pola `<<…>>`. Nie zmieniasz numeracji `Z`, nie usuwasz wierszy,
nie przestawiasz akapitów.

---

## A.0. NAGŁÓWEK, RAMKA ZAKAZU NR 1 I RAMKA MARKERA

```markdown
# INSTRUKCJA DYŻURU nr <<NR_DYZURU>> — Codex — „<<TYTUL_JEDNYM_ZDANIEM>>"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `<<WORKTREE>>`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `<<SHA_MARKERA>>`**
> **Gałąź bazowa: `<<REMOTE>>/<<GALAZ_BAZOWA>>`**
> **Stan dokumentu: <<WYDANY | PROJEKT — NIE ZACZYNAJ>>**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakikolwiek nawias `<<…>>` — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: <<DATA>>.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **<<MODUL_LUB_OBSZAR>>**.
Trasy front: `<<TRASY_FRONT>>`. Trasy tył: `<<TRASY_TYL>>`.
```

> **Uwaga do autora szkieletu (nie kopiuj tego akapitu).** Ramkę markera
> zapisujesz **jednym blokiem, z SHA wpisanym na twardo**. Nie zostawiaj
> zdania-zaślepki, którą podmienia skrypt wiążący marker — w czterech
> instrukcjach 28.08 właśnie taka podmiana rozerwała zdanie na pół
> (CZĘŚĆ D, błąd nr 4).

---

## A.1. `§0.1` — BAZA PRACY, MARKER, WORKTREE Z VAULTA (kopiuj dosłownie)

````markdown
### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=<<WORKTREE>>
MARKER=<<SHA_MARKERA>>

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/<<GALAZ_BAZOWA>>
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/<<GALAZ_BAZOWA>> \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b <<GALAZ_DYZURU>> "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/<<NAZWA_WORKTREE>>/config.worktree"
cat "$VAULT/worktrees/<<NAZWA_WORKTREE>>/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p <<SCRATCH>>
mkdir -p <<ARTEFAKTY>>

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline <<SHA_MARKERA>>..github-backup/<<GALAZ_BAZOWA>>
git -C "$VAULT" diff --name-only <<SHA_MARKERA>>..github-backup/<<GALAZ_BAZOWA>>
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup <<GALAZ_DYZURU>>
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only <<SHA_MARKERA>>..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `<<N_KOMEND>>` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

<<TU_WSTAWIASZ_KOMENDY_WERYFIKACJI_STANU_WEJSCIOWEGO — po jednej na każdą tezę
z sekcji „TEZY ZLECENIA", z komentarzem `#   oczekiwane: …`>>
````

---

## A.2. `§0.2` — KOMPLET BEZPIECZNIKÓW `Z1`–`Z40` (kopiuj dosłownie)

**Numeracja jest WSPÓLNA dla wszystkich dyżurów i NIE WOLNO jej przestawiać.**
Wykonawca, który wczoraj robił dyżur 57, a dziś robi 58, musi pod tym samym
numerem znaleźć ten sam zakaz. `Z1`–`Z34a` to rdzeń obowiązkowy w każdej
instrukcji. `Z35`–`Z39` włączasz, gdy dyżur dotyka danego obszaru;
**jeżeli nie dotyczą — zostawiasz wiersz i wpisujesz „nie dotyczy w tym
dyżurze", nie kasujesz numeru.**

```markdown
### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `<<GALAZ_DYZURU>>` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `<<GALAZ_BAZOWA>>` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `<<PORT_DB>>`. Twój JEDYNY port harnessu to `<<PORT_HARNESS>>`.** Nazwa kontenera musi nieść numer dyżuru: **`<<KONTENER>>`**. **ZAKAZANE:** `<<LISTA_PORTOW_ZAJETYCH>>`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `<<POZYCJE_Z_FLAGAMI>>`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `<<LISTA_BRAMEK>>`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `<<SCIEZKA_RAPORTU>>`. <<Jedyny inny dokument do zmiany: SCIEZKA_MODULE_ACCEPTANCE (§R.1) — albo: „Nie zmieniasz żadnego MODULE_ACCEPTANCE.md, bo ten dyżur jest przekrojowy">>. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `<<ARTEFAKTY>>`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `<<SCRATCH>>` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | <<ZAKAZ_WLASCIWY_TEMU_DYZUROWI — albo „brak">> | <<DLACZEGO>> |
```

---

## A.3. `§0.2b` — DOWÓD `Z30` (poczta jest atrapą) — kopiuj, gdy dyżur cokolwiek zapisuje

````markdown
### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ustawić `<<FLAGA_LIVE_WYSYLKI>>` na `true`;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd <<WORKTREE>>

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|<<FLAGA_LIVE_WYSYLKI>>)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec <<KONTENER>> psql -U postgres -d <<BAZA>> \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.
````

---

## A.4. `§0.2c` — KOMPLET ZMIENNYCH ŚRODOWISKOWYCH (kopiuj dosłownie)

````markdown
### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd <<WORKTREE>>

docker run -d --name <<KONTENER>> \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=<<BAZA>> \
  -p 127.0.0.1:<<PORT_DB>>:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec <<KONTENER>> pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:<<PORT_DB>>/<<BAZA>> \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:<<PORT_DB>>/<<BAZA>> \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd <<WORKTREE>> && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:<<PORT_DB>>/<<BAZA>> \
JWT_SECRET=<<JWT_SECRET>> \
npx vitest run <<SCIEZKI>> --retry=0 \
  --reporter=json --outputFile=<<ARTEFAKTY>>/<<NAZWA>>.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd <<WORKTREE>> && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run <<SCIEZKI>> --retry=0 \
  --reporter=json --outputFile=<<ARTEFAKTY>>/<<NAZWA>>.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |
````

---

## A.5. `§0.2d` — ZNANE PUŁAPKI ŚRODOWISKA (kopiuj dosłownie, komplet)

```markdown
### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/<<NAZWA_WORKTREE>>/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec <<KONTENER>> psql -U postgres -d <<BAZA>> -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv <<KONTENER>>`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.
```

---

## A.6. `§0.2e` — CZTERY PUŁAPKI `Z33` (kopiuj dosłownie)

```markdown
> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) <<PULAPKA_WLASCIWA_TEMU_MODULOWI — np. bramka bety odcinająca kodem
> `403 BETA_LOCKED` PRZED logiką izolacji; albo „nie dotyczy, dowód:
> <komenda pokazująca, że strażnik nie leży na ścieżce>">>**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**
```

---

## A.7. `§0.5` — REGUŁA STOP I TABELA „STOP PROCEDURALNY ZAKAZANY" (kopiuj dosłownie)

````markdown
### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec <<KONTENER>> psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `<<SCRATCH>>`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`<<POZYCJE_RDZENIA>>`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `<<PORT_DB>>` albo `<<PORT_HARNESS>>` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `<<PORT_DB>>` albo `<<PORT_HARNESS>>`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**
````

---

## A.8. SEKCJA KOŃCOWA — „JEŚLI COŚ JEST SPRZECZNE LUB NIEWYKONALNE" (kopiuj dosłownie)

```markdown
## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**
```

---
---

# CZĘŚĆ B — SZABLONY TABEL (puste, do wypełnienia)

## B.1. TABELA LICENCJI PLIKOWYCH

**Reguła nadrzędna, którą wpisujesz pod tabelą DOSŁOWNIE:**

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief wg wiersza 1, **nie zatrzymanie dyżuru**.

**★ Kolumna trzecia NIGDY nie brzmi samo „STOP".** Zawsze podaje produkt
zastępczy: czerwony kontrakt testowy · gotowy diff w bloku kodu · pomiar
· brief z promieniem rażenia · wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem
„czego mi zabrakło".

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `<<PLIK_PRZEKROJOWY_1>>` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Produktem pozycji staje się **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU <<NR>> — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`. Do tego **brief w raporcie**: plik:linia · dlaczego nie da się w module · promień rażenia (ile montaży, ile modułów) · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| `<<PLIK_PRZEKROJOWY_2>>` | **TYLKO ODCZYT** | jak wyżej |
| `<<PLIK_RDZENIA_DYZURU>>` | **★ PEŁNA LICENCJA** w zakresie `<<POZYCJE>>` | — |
| `<<PLIK_Z_WASKA_LICENCJA>>` | **★ WĄSKA LICENCJA:** wyłącznie `<<CO_DOKLADNIE>>` w zakresie `<<POZYCJA>>`. Zakaz `<<CZEGO>>` | Czerwony kontrakt + brief |
| `<<NOWY_PLIK>>` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości | — |
| `server/migrations/<<WZORZEC_ODPOWIADAJACY_PRZEDZIALOWI>>` | **★ PEŁNA LICENCJA** w przedziale **`<<OD>>`–`<<DO>>`**, wyłącznie addytywne | — |
| `tests/**` (NOWE pliki), `<<KATALOG>>/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Produktem jest **opis w raporcie**: co w konfiguracji blokuje pomiar, jaka byłaby zmiana i **jak obszedłeś to zmiennymi w linii komendy**. Pozycja jest zrobiona z takim opisem |
| `<<CUDZY_TEREN_DYZURU_N>>` | **TYLKO ODCZYT — teren dyżuru `<<N>>`** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja naprawy jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| `<<SCIEZKA_MODULE_ACCEPTANCE>>` | `§R.1`, z zastrzeżeniem `Z32` | — |
| `<<SCIEZKA_RAPORTU>>` | `§R.2` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt.**
Kolumna „DoD podniesione" wypełniana zawsze: albo liczbą, albo „bazowe".

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione (min. testów) | Definicja ukończenia — co dokładnie musi być prawdą | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `<<§A.1>>` | `<<…>>` | TAK/NIE | NIE — dowód: `<<komenda>>` | bazowe (4) | `<<…>>` | `<<…>>` | `<<typ(zakres): opis (A.1)>>` |
| `<<§A.2>>` | `<<…>>` | TAK/NIE | `<<…>>` | `<<8>>` | `<<…>>` | `<<…>>` | `<<…>>` |
| `<<§R.1>>` | podniesienie `MODULE_ACCEPTANCE.md` do stanu faktycznego | NIE | NIE | n/d | `<<…>>` | `<<…>>` | `<<…>>` |
| `<<§R.2>>` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `<<…>>` |

**Pod tabelą wpisujesz obowiązkowo:**

> **Kolumna „Wymaga plików przekrojowych?" musi być wypełniona dla KAŻDEJ
> pozycji, z dowodem przy odpowiedzi `NIE`.** Jeżeli którakolwiek pozycja
> odpowiada `TAK`, autor instrukcji ma obowiązek albo przenieść ją do innego
> dyżuru, albo z góry opisać produkt zastępczy (czerwony kontrakt + brief).
> **Wykonawca nie może odkryć niewykonalności pozycji w jej połowie.**

---

## B.3. TABELA MIANOWNIKÓW

**Każda liczba w instrukcji ma tu wiersz. Liczba bez komendy nie wchodzi do
dokumentu.** Wykonawca **mierzy każdą z nich sam** (`Z24`) i podaje swoją.

| # | Co liczę | Liczba autora instrukcji | Komenda, którą ją policzyłem (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | `<<np. pliki modułu osiągalne z punktu wejścia>>` | `<<46>>` | `<<node …/find-orphans.mjs \| grep -c "  LIVE  ">>` | TAK — `<<uzasadnienie>>` |
| 2 | `<<pliki modułu nieosiągalne>>` | `<<113>>` | `<<…>>` | TAK |
| 3 | `<<trasy zarejestrowane w routerze>>` | `<<122>>` | `<<…>>` | TAK |
| 4 | `<<wolne numery migracji w MOIM przedziale>>` | `<<0>>` | `<<ls server/migrations/ \| grep -cE "^<<PREFIKS_MOJEGO_PRZEDZIALU>>">>` | **TAK — sprawdź to osobno, to jest najczęstszy błąd (CZĘŚĆ D, błąd 2)** |
| … | `<<…>>` | `<<…>>` | `<<…>>` | `<<…>>` |

**Reguła kontrolna dla autora:** dla każdego wiersza wykonaj komendę i sprawdź,
czy **zwraca niepusty, sensowny wynik na markerze**. Komenda, której sam nie
uruchomiłeś, nie wchodzi do instrukcji.

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

**To jest kontrakt z dyżurami równoległymi. Plik spoza tej listy w diffie
wykonawcy = naruszenie, nie „drobiazg".**

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj (istniejący / NOWY) | Pozycja | Ryzyko kolizji + z kim |
| --- | --- | --- | --- | --- |
| 1 | `<<…>>` | `<<…>>` | `<<…>>` | `<<ZEROWE / ŚREDNIE / ★★ WYSOKIE — z dyżurem <<N>>>>` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| `<<…>>` | `<<…>>` | `<<…>>` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE — imiennie

```
<<lista ścieżek i katalogów, z adnotacją, do kogo należą>>
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone (komenda + wynik) |
| --- | --- | --- |
| Port PostgreSQL | `<<PORT_DB>>` | `<<lsof -nP -iTCP -sTCP:LISTEN \| grep …>>` |
| Port harnessu | `<<PORT_HARNESS>>` | `<<…>>` |
| Nazwa kontenera | `<<KONTENER>>` | `<<docker ps --format …>>` |
| Nazwa bazy | `<<BAZA>>` | `<<…>>` |
| **Przedział migracji** | **`<<OD>>`–`<<DO>>`** | `<<ls server/migrations/ \| grep -cE "^<<PREFIKS>>" → 0>>` |
| Gałąź | `<<GALAZ_DYZURU>>` | nie istnieje na `github-backup` |
| Worktree | `<<WORKTREE>>` | nie istnieje |
| Flagi funkcyjne | `<<lista, wszystkie default OFF>>` | `<<grep -rn … → 0 trafień>>` |

### B.4.5. Kontrola przed KAŻDYM commitem (wklej do instrukcji)

```bash
cd <<WORKTREE>>
git diff --name-only --cached | tee <<ARTEFAKTY>>/staged.txt
grep -iE '<<WZORZEC_CUDZYCH_TERENOW>>' <<ARTEFAKTY>>/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---
---

# CZĘŚĆ C — LISTA KONTROLNA AUTORA PRZED ODDANIEM INSTRUKCJI

**Dziesięć punktów. Instrukcja nie wychodzi, dopóki wszystkie nie są `TAK`.**
Wynik tej listy autor dokleja na końcu instrukcji jako sekcję
„AUDYT WYKONANY PRZEZ AUTORA".

| # | Punkt | Jak sprawdzam | Wynik |
| --- | --- | --- | --- |
| 1 | **Audyt sprzeczności.** Przeszedłem dokument od początku do końca w poszukiwaniu **par wymagań, które się wykluczają**, i każdą znalezioną **rozstrzygnąłem w treści**, nie zostawiłem wykonawcy | Wypisuję znalezione pary w tabeli „AUDYT SPRZECZNOŚCI" na końcu instrukcji: *para wymagań · gdzie rozstrzygnięta*. Typowe pary: zakaz wysyłki vs pozycja z przyciskiem wysyłki · „flaga domyślnie OFF w `.env`" vs „diff `.env*` pusty" · zakaz mockowania bramki vs potrzeba przejścia przez bramkę · zakaz nowych flag vs fixture wymagający zmiennej potwierdzającej | `<<TAK/NIE>>` |
| 2 | **Weryfikacja KAŻDEJ ścieżki pliku.** Każda ścieżka wymieniona w dokumencie **istnieje na markerze** albo jest jawnie oznaczona jako `NOWY PLIK` / `NIE ISTNIEJE` | `for p in <wszystkie ścieżki>; do [ -e "$p" ] \|\| echo "BRAK $p"; done` na worktree z markera. **Wynik `BRAK` bez adnotacji w tekście = instrukcja nie wychodzi** | `<<…>>` |
| 3 | **Każda liczba ma komendę.** Zero liczb bez odtwarzalnej komendy; każdą komendę **sam uruchomiłem na markerze** i wkleiłem oczekiwany wynik | Tabela mianowników `B.3` wypełniona w całości, kolumna „Czy komenda obejmuje badany obiekt?" — same `TAK` z uzasadnieniem | `<<…>>` |
| 4 | **Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP".** Każdy plik, który wykonawca może chcieć zmienić, ma wiersz; każdy wiersz „tylko odczyt" ma **produkt zastępczy** | Czytam trzecią kolumnę wiersz po wierszu i sprawdzam, czy w każdym jest **rzeczownik-produkt** (kontrakt / diff / brief / pomiar / wpis) | `<<…>>` |
| 5 | **Wykonalność per pozycja bez plików przekrojowych.** Dla KAŻDEJ pozycji rozstrzygnąłem i **udowodniłem komendą**, czy wymaga zmiany w pliku, którego wykonawca nie ma prawa dotknąć | Kolumna w tabeli `B.2`, dowód przy odpowiedzi `NIE`. Przy odpowiedzi `TAK` — z góry opisany produkt zastępczy | `<<…>>` |
| 6 | **Przydział zasobów wyłącznych sprawdzony wobec dyżurów równoległych.** Porty, nazwa kontenera, nazwa bazy, gałąź, worktree, **przedział migracji**, nazwy flag, ścieżki nowych plików testowych | Tabela `B.4.4` + **jawna lista, co zajęły dyżury równoległe**. Przedział migracji sprawdzam u **wszystkich** dyżurów tej serii, nie tylko u swojego | `<<…>>` |
| 7 | **Komendy paste-ready.** Każdy blok `bash` da się wkleić **bez edycji**: pełne ścieżki, komplet env w tej samej linii, `--retry=0`, oczekiwany wynik w komentarzu `#   oczekiwane: …` | Kopiuję każdy blok do terminala na worktree z markera i sprawdzam, że **nie rzuca składniowo**. Bloki destrukcyjne czytam ręcznie | `<<…>>` |
| 8 | **Pułapki środowiska wklejone w całości** (`A.5`), plus pułapki właściwe temu modułowi dopisane jako kolejne punkty | `grep -c "PUŁAPKI ŚRODOWISKA" <plik>` → co najmniej 1; lista ma co najmniej 18 punktów rdzenia | `<<…>>` |
| 9 | **Samodzielność dokumentu.** Zero odwołań do „ustaleń nadzorcy", „jak w poprzednim dyżurze", „wiadomo z rozmowy". Każdy kontekst albo jest w dokumencie, albo ma **ścieżkę w repo** | `grep -inE "ustalen(ia\|iu) nadzorcy\|jak w poprzednim\|z rozmowy\|wiadomo, że" <plik>` → pusto. Cytaty decyzji właściciela **zawsze z identyfikatorem `DEC-…` i ścieżką pliku** | `<<…>>` |
| 10 | **Klauzula sprzeczności obecna i pełna** (`A.8`), a `§0.5` zawiera **tabelę „STOP proceduralny zakazany"** z działaniem zastępczym w każdym wierszu | `grep -c "STOP PROCEDURALNY" <plik>` → co najmniej 1; `grep -c '<<' <plik>` → **`0`** (żadne pole szkieletu nie zostało w wydanym dokumencie) | `<<…>>` |

---
---

# CZĘŚĆ D — CZEGO NIE POWTARZAĆ

**Osiem błędów znalezionych w czterech instrukcjach wydanych 2026-08-28.**
Każdy: **co było źle · jaki był skutek (albo jaki był możliwy) · jak szkielet
temu zapobiega.**

---

### Błąd 1 — TEN SAM PRZEDZIAŁ MIGRACJI W TRZECH INSTRUKCJACH NARAZ

**Co było źle.** Dyżury 55, 56 i 57 dostały w pierwotnym zapisie **identyczny
przedział `20261560`–`20261579`**. Wykryte dopiero przy sprawdzaniu
rozłączności **przed wydaniem**; do wszystkich trzech dokumentów doklejono
ramkę „KOREKTA NADZORCY PRZY WYDANIU" z nowym podziałem
(55→`…60-69`, 56→`…70-79`, 57→`…80-89`, 58→`…90-99`).

**Skutek.** Gdyby korekty nie było, trzy dyżury utworzyłyby pliki migracji
o kolidujących numerach na trzech niescalonych gałęziach. Kolizja ujawniłaby
się dopiero przy scalaniu — czyli po całej wykonanej pracy, u nadzorcy.

**Jak szkielet zapobiega.** Punkt 6 listy kontrolnej (`CZĘŚĆ C`) każe sprawdzić
przydział zasobów wyłącznych **u wszystkich dyżurów serii, nie tylko u swojego**,
a tabela `B.4.4` wymaga wpisania przedziału razem z komendą i wynikiem.
Przedział jest wymieniony jako zasób wyłączny na równi z portem i nazwą bazy.

---

### Błąd 2 — KOMENDA SPRAWDZAJĄCA PRZEDZIAŁ MIGRACJI NIE OBEJMUJE WŁASNEGO PRZEDZIAŁU

**Co było źle.** Po korekcie przedziałów zmieniono **liczby w tekście**, ale
**nie zmieniono komendy kontrolnej**. Instrukcja 57 mówi: „PRZEDZIAŁ NUMERÓW
MIGRACJI: `20261580`–`20261589`. Sprawdzasz przed KAŻDYM nowym plikiem:
`ls server/migrations/ | grep -E "^2026156|^2026157"`". **Ta komenda nie patrzy
na `2026158` w ogóle.** Instrukcja 56 ma ten sam grep przy przedziale
`…70-79` — tam akurat trafia, ale przypadkiem, bo obejmuje też cudzy przedział.

**Skutek.** Klasyczny **mianownik wycinający badany obiekt**: wykonawca
uruchamia komendę, dostaje pustkę, uznaje przedział za wolny — i nie sprawdził
niczego. Kontrola daje fałszywe „OK".

**Jak szkielet zapobiega.** Tabela mianowników `B.3` ma **osobną kolumnę
„Czy komenda obejmuje badany obiekt?"** z wymogiem uzasadnienia, i **imiennie
wymienia przedział migracji jako wiersz obowiązkowy**. Punkt 3 listy kontrolnej
wymaga, żeby autor **sam uruchomił każdą komendę** i wkleił jej wynik.

---

### Błąd 3 — LICENCJA SZERSZA NIŻ WIĄŻĄCY PRZEDZIAŁ

**Co było źle.** Instrukcja 55 przyznaje licencję wzorcem
`server/migrations/202615[6-7]*.sql` przy przedziale wiążącym
`20261560`–`20261569`; instrukcja 56 — wzorcem `server/migrations/202615[67]*.sql`
przy przedziale `20261570`–`20261579`. **Wzorzec licencji obejmuje w obu
przypadkach także przedział sąsiada.**

**Skutek.** Wykonawca czytający tabelę licencji (a instrukcja mówi mu wprost:
„ta tabela **JEST** licencją") ma pisemne pozwolenie na numer należący do
dyżuru równoległego. Dwa źródła prawdy o tym samym zasobie.

**Jak szkielet zapobiega.** Wiersz migracji w tabeli licencji `B.1` ma pole
`<<WZORZEC_ODPOWIADAJACY_PRZEDZIALOWI>>` i **powtórzone granice `<<OD>>`–`<<DO>>`
w tym samym wierszu**, żeby rozjazd był widoczny gołym okiem. Punkt 6 listy
kontrolnej sprawdza spójność zasobów wyłącznych.

---

### Błąd 4 — MECHANIZM WIĄZANIA MARKERA ROZRYWA ZDANIA W DOKUMENCIE

**Co było źle.** We **wszystkich czterech** instrukcjach ramka
„★★ MARKER ZWIĄZANY — DOKUMENT WYDANY" jest uszkodzona: skrypt wiążący marker
podmienił linie z zaślepką **w środku zdania**, zostawiając tekst w rodzaju:

```
> Pole „SHA markera" w `§0.1` oraz **wszystkie** komendy zawierające
> **MARKER ZWIĄZANY przez nadzorcę w chwili wydania. Dokument JEST WYDANY…**
> wydania dyżuru.
> **Jeżeli czytasz ten dokument i widzisz dosłowny ciąg `b3179d0a…` —
> **MARKER ZWIĄZANY przez nadzorcę w chwili wydania. Dokument JEST WYDANY…**
```

W instrukcjach 55 i 56 to samo powtarza się w `§0.1`, dodatkowo z rozbitym
wcięciem listy (`>` w kolumnie 0 wewnątrz punktu numerowanego), przez co blok
cytowany renderuje się jako trzy niepowiązane fragmenty. W 55 zdanie urywa się
w połowie: „…dokument nie".

**Skutek.** Pierwsza rzecz, jaką wykonawca czyta, to niespójny bełkot
w miejscu, które ma rozstrzygać **stan wydania dokumentu**. Instrukcja 56
musiała dodać osobne zdanie ratunkowe („Objaśnienia wartownika w blokach
cytowanych **nie** są powodem do STOP-u") — czyli łatać skutek zamiast
przyczyny.

**Jak szkielet zapobiega.** `A.0` podaje ramkę markera jako **jeden zwarty
blok z SHA wpisanym na twardo** i trzema polami (`SHA`, `gałąź`, `stan`), bez
zdania-zaślepki do podmiany w środku akapitu. Punkt 10 listy kontrolnej wymaga
`grep -c '<<' <plik>` → `0`, czyli żadnego pola do automatycznej podmiany
w wydanym dokumencie.

---

### Błąd 5 — NIEISTNIEJĄCY PLIK WYMIENIONY JAKO „JEDEN Z TRZECH NIETYKALNYCH"

**Co było źle.** Instrukcja 55, „KRYTYCZNE OGRANICZENIA" pkt 1, wymienia trzy
pliki przekrojowe, w tym `server/src/middleware/organizationContextGuard.ts`.
**Ten plik nie istnieje na markerze** — co ta sama instrukcja stwierdza
**dwadzieścia akapitów dalej**, w tabeli licencji i w `§1.8` („Na tej gałęzi
taki plik NIE ISTNIEJE. Nie twórz pliku o tej nazwie"), podając inną trójkę
plików przekrojowych. Instrukcja 57 ma ten sam rozjazd między `§1.9.1`
a `§1.6`. Sprawdzone: `ls server/src/middleware/ | grep -i organizationContext`
→ pusto; realny odpowiednik to `orgContext.middleware.ts`.

**Skutek.** Wykonawca dostaje dwie różne listy „trzech plików nietykalnych"
w jednym dokumencie i uczy się szukać pliku, którego nie ma. Instrukcja 58
poradziła sobie z tym najlepiej — zakreśliła teren **całym katalogiem
`server/src/middleware/**`** i **jawnie napisała, że plik ze zlecenia nie
istnieje**.

**Jak szkielet zapobiega.** Punkt 2 listy kontrolnej wymaga przepuszczenia
**każdej** ścieżki przez `[ -e "$p" ]` na worktree z markera; ścieżka
nieistniejąca musi być jawnie oznaczona. Tabela licencji `B.1` ma pola
`<<PLIK_PRZEKROJOWY_1/2>>` wypełniane **raz** i cytowane z niej w pozostałych
miejscach — nie ma drugiej listy do rozjechania.

---

### Błąd 6 — TA SAMA ETYKIETA `Z` OZNACZA W CZWARTEJ INSTRUKCJI CO INNEGO

**Co było źle.** Instrukcje 55/56/57 mają numerację `Z1`–`Z34a` o zgodnym
znaczeniu. Instrukcja 58 ma własną, krótszą listę `Z1`–`Z19`, w której te same
numery znaczą co innego:

| Numer | 55/56/57 | 58 |
| --- | --- | --- |
| `Z9` | żadnej bazy poza lokalnym kontenerem | zakaz „naprawiania" przez wyciszanie |
| `Z10` | zero nowych flag funkcyjnych | zakaz `git stash` |
| `Z14` | nie zmieniasz rejestru decyzji właściciela | zakaz `eslint --fix` na repo |
| `Z15` | zero modelu językowego | push po pierwszym commicie |
| `Z17` | zakaz wszystkiego poza zakresem | porównania po nazwach, nie liczbach |

Dodatkowo 58 **w ogóle nie ma** `Z4`.

**Skutek.** Wykonawca, który wczoraj robił dyżur 57, a dziś 58, czyta w raporcie
„naruszenie `Z14`" i rozumie zupełnie inny zarzut. Odbiór porównujący dwa
raporty porównuje etykiety, które nie znaczą tego samego.

**Jak szkielet zapobiega.** `A.2` podaje **jedną, zamkniętą numerację
`Z1`–`Z40`** wspólną dla wszystkich dyżurów, z jawnym poleceniem: zakaz, który
w danym dyżurze nie ma zastosowania, **zostaje w tabeli z adnotacją „nie
dotyczy", a numer nigdy nie jest używany ponownie do czegoś innego**.

---

### Błąd 7 — LISTY ZAKAZANYCH PORTÓW NIE POKRYWAJĄ PORTÓW DYŻURÓW RÓWNOLEGŁYCH

**Co było źle.** Dyżur 55 zajmuje harness `3371` i zakazuje `3352`–`3370`.
Dyżur 57 zajmuje `3372` i zakazuje `3352`–`3371` (spójnie). **Dyżur 58 zajmuje
`3374`/`3375` i zakazuje tylko `3352`–`3364`** — czyli jego lista zakazów
**nie obejmuje portów `3371` i `3372` trzymanych przez dyżury 55 i 57**,
i zostawia nieprzypisaną dziurę `3365`–`3373`.

**Skutek.** Wykonawca 58, którego port okaże się zajęty, ma w instrukcji
napisane „nie bierzesz innego portu" — ale nie ma listy, która by mu powiedziała,
że `3371` należy do kogoś. Ryzyko zajęcia cudzego harnessu jest wpisane
w dokument.

**Jak szkielet zapobiega.** Tabela `B.4.4` wymaga wpisania **wszystkich**
zasobów wyłącznych razem z komendą sprawdzającą, a punkt 6 listy kontrolnej
każe autorowi zestawić przydział **wobec dyżurów równoległych**, nie tylko
wobec bieżącego stanu `lsof`. Pole `<<LISTA_PORTOW_ZAJETYCH>>` w `Z7` jest
jednym miejscem, które autor wypełnia z tego zestawienia.

---

### Błąd 8 — TA SAMA CZĘŚĆ WSPÓLNA PISANA CZTERY RAZY, ZA KAŻDYM RAZEM INACZEJ GŁĘBOKO

**Co było źle.** DoD per pozycja ma 15 punktów w instrukcji 55, 14 w 56,
15 w 57 i **10 w 58** — przy czym różnice nie wynikają z charakteru dyżuru,
tylko z tego, że każdy dokument wyprowadzał listę od nowa. Podobnie „kształty
fałszywego »gotowe«": pięć w 55, pięć w 56, **siedem** w 57, zero jako osobna
sekcja w 58. Pułapki środowiska: osiem w 55, dziesięć w 56, dziewięć w 57,
dziewięć w 58 — **każda lista ma punkty, których nie mają pozostałe**
(reporter `basic` tylko w 56, `NODE_PATH`/ESM tylko w 58, `| head` na sierotach
tylko w 57, `postgres:15` bez `vector` tylko w 55 i 57).

**Skutek.** Wykonawca dyżuru 58 nie został ostrzeżony o pułapce, którą
wykonawca 56 miał opisaną. Ostrzeżenia nie kumulują się — każda instrukcja
zaczyna od zera i gubi część dorobku poprzednich.

**Jak szkielet zapobiega.** `A.5` zbiera **wszystkie osiemnaście** pułapek
z czterech dokumentów w jedną listę do skopiowania; `A.2` scala wszystkie
zakazy; `A.4` scala komplet zmiennych środowiskowych z kolumną „co się stanie,
gdy jej zabraknie". Autor dyżuru **dopisuje** punkty właściwe swojemu modułowi
zamiast wyprowadzać listę od nowa — i tym samym każdy kolejny dyżur dziedziczy
dorobek wszystkich poprzednich.

---
---

# METRYKA SZKIELETU

| Pozycja | Wartość |
| --- | --- |
| Objętość szkieletu | **987 linii** (mierz: `wc -l docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`) |
| Objętość samej CZĘŚCI A (blok do skopiowania) | **585 linii**, z czego ok. **480** to tekst wklejany dosłownie do instrukcji |
| Typowa instrukcja dyżuru serii 55–58 | 1298–2578 linii, średnio **2066** |
| Część wspólna w tych instrukcjach (`§0` + reguła STOP + klauzula sprzeczności + szablony tabel) | **ok. 60–70% objętości** |
| **Pokrycie: ile typowej instrukcji CZĘŚĆ A wypełnia gotowym tekstem** | **ok. 23% objętości** (480 z 2066 linii) — **ale jest to ok. 90% tego, co w części wspólnej jest NIEZALEŻNE OD MODUŁU** |

**Skąd rozjazd między „60–70% wspólne" a „23% gotowe".** Część wspólna
czterech instrukcji jest wspólna **co do struktury**, nie co do treści: tabela
licencji, tabela pozycji, mianowniki i rozłączność są w każdej instrukcji, ale
wypełnione danymi modułu. Szkielet dostarcza je jako **puste szablony**
(CZĘŚĆ B) — autor wypełnia je danymi, nie projektuje od nowa.

**Rachunek dla autora instrukcji:**

| Warstwa | Skąd bierzesz | Ile linii typowo |
| --- | --- | --- |
| `§0` bezpieczniki, env, pułapki, STOP, klauzula sprzeczności | **CZĘŚĆ A — kopiujesz, podmieniasz pola** | ~480 |
| Tabele licencji / pozycji / mianowników / rozłączności | **CZĘŚĆ B — wypełniasz szablon** | ~250 |
| Errata tez zlecenia, ustalenia własne, kontekst modułu | piszesz sam | ~350 |
| Pozycje robocze `§A.1`…`§R.2` | piszesz sam | ~900 |
| Kolejność pracy, struktura raportu, audyt sprzeczności | **CZĘŚĆ C + wzorce z A** | ~120 |

**Czyli: ok. połowa objętości typowej instrukcji pochodzi ze szkieletu
(kopiowana albo wypełniana z szablonu), a autor pisze od zera wyłącznie
to, co naprawdę jest właściwe jego modułowi.**

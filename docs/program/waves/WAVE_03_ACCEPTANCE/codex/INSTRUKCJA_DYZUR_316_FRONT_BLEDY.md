# INSTRUKCJA DYŻURU nr 316 — Codex — „★★★ WZNOWIENIE DYZURU 300 — warunek startu jest dzis SPELNIONY (mapper `appErrorMapper` istnieje i wola go 73 pliki `server/src`), a 300 stal dobe po ustaniu blokady, bo sprawdzal warunek ponownie na STARYM markerze: ta instrukcja kaze Ci sprawdzic go NA BIEZACEJ LINII. Serwer przestal odsylac surowa tresc bledu, ale front w 642 miejscach nadal czyta `data.error` / `err.message` / `error.message` i wstawia to wprost w widok — wiec uzytkownik dalej widzi zdanie napisane dla programisty. Ten dyzur (1) mierzy mianownik SAM i podaje go z zakresem katalogow, (2) klasyfikuje wolacze na te, ktorych tekst TRAFIA NA EKRAN, i te, ktore tylko loguja, (3) buduje JEDNO zrodlo tekstow dla siedmiu kodow kanonicznych po polsku i angielsku (przestrzen `errors.app` we froncie DZIS NIE ISTNIEJE — tworzysz ja) plus prezentacje z `correlationId` do zglaszania bledu, (4) podmienia wolacze grupami z bezpiecznikiem „surowy komunikat nie trafia do JSX”, (5) ★ MIERZY WARUNEK BRZEGOWY, ktory decyduje o sensie calosci: konstruktor `AppError` ustawia `isOperational = true` ZAWSZE, a mapper dla bledow operacyjnych przepuszcza SUROWY komunikat — a te sa w kodzie PO ANGIELSKU (okolo 204 wywolan `new AppError(...)`); jesli planowany dyzur 321 tego nie zmieni, front dostanie angielski tekst niezaleznie od Twojej pracy. Zmierz to, nie zakladaj."

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
> **wyłącznie** `/private/tmp/cx-day316-front-bledy`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — FRONT: PREZENTACJA BLEDOW UZYTKOWNIKOWI. Wznowienie dyzuru 300.** Dyzur 296 dal serwerowi jednolita koperte bledu `{ error?, message?, errorCode, correlationId, debug? }` (`server/src/middleware/appErrorMapper.ts`, siedem kodow kanonicznych ze slownikiem `pl` i `en`). Dyzur 300 mial zrobic druga polowe — zeby front czytal `errorCode` i `correlationId` zamiast surowego `message` — i stanal na warunku startu: na markerze, ktory dostal, mapper mial ZERO trafien. ★ Warunek jest dzis SPELNIONY i sprawdzasz go NA BIEZACEJ LINII: `git grep -l 'appErrorMapper' -- server/src | wc -l` daje na markerze 73. Cel produktowy jednym zdaniem: **uzytkownik ma zobaczyc zdanie napisane dla niego, po polsku, plus identyfikator do zgloszenia — a nie zdanie napisane dla programisty.****.
Trasy front: `Mianownik (mój pomiar na markerze, komenda w weryfikacji wejściowej): **642** trafienia rodziny `data.error|err.message|error.message` w katalogach `src/services src/api src/hooks src/components`, oraz **790** w calym `src` — ★ mianownik ZALEZY OD ZAKRESU, podajesz oba i deklarujesz swoj. Czolo listy: `src/services/api.ts` (68), `src/components/ReportBuilder/useReportBuilder.ts` (27), `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` (23), `src/services/api/admin.api.ts` (13), `src/hooks/useReportSections.ts` (11), `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx` (10), `src/components/Presentations/PresentationTemplateArchitectView.tsx` (9) — pelna liste robisz sam w `R1`. Wzorzec do skopiowania (istnieje, jest zielony): `src/components/AIChat/aiProviderErrorCopy.ts` + `src/components/AIChat/AiProviderErrorNotice.tsx` + test `src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx`. Teksty: `public/locales/pl/translation.json` i `public/locales/en/translation.json` — ★ przestrzen `errors` NIE ISTNIEJE dzis w zadnym z nich (jest tylko `common.error`, `common.errorTitle`, `common.chatOpenError`), wiec tworzysz ja. Prezentacja: `src/components/shared/states/ErrorState.tsx` ORAZ `src/components/ui/primitives/ErrorState.tsx` — ★ DWA komponenty o tej samej nazwie; ustal, ktory jest realnie montowany, ZANIM dolozysz trzeci. Naglowek jezyka wysyla `src/services/api.ts` (z wlasnym komentarzem, ze przegladarka traktuje `Accept-Language` jako naglowek zabroniony).`. Trasy tył: `Bez zmian w `server/src`. ODCZYT (i tylko odczyt): `server/src/middleware/appErrorMapper.ts` — Twoj kontrakt wejsciowy: typ `AppErrorResponse { error?, message?, errorCode, correlationId, debug? }`, `AppErrorCode` = NOT_FOUND · VALIDATION · UNAUTHORIZED · FORBIDDEN · CONFLICT · DB_ERROR · INTERNAL, slownik `MESSAGES` z kompletem `pl` i `en`, wybor jezyka po naglowku `Accept-Language`. ODCZYT: `server/src/utils/ErrorHandler.ts` — klasa `AppError`, ktorej konstruktor ustawia `isOperational = true` ZAWSZE (to jest zrodlo warunku brzegowego `R6`). ODCZYT: `server/src/services/ai/providerErrorMapper.ts` — DRUGA, niezalezna rodzina siedmiu kodow (AI_*), ktorej NIE MYLISZ z siedmioma kodami aplikacyjnymi. Zmiane komunikatow serwera na polskie zamawia osobny, planowany dyzur 321 — Ty jej NIE robisz, ale Twoj raport ma powiedziec, czy bez niej cel produktowy jest osiagalny.`.

---

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
WT=/private/tmp/cx-day316-front-bledy
MARKER=bc18bc7acac2ec825ebb3db2f1309738ab034d58

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day316-front-bledy-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day316-front-bledy/config.worktree"
cat "$VAULT/worktrees/cx-day316-front-bledy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day316-front-bledy-scratch
mkdir -p /private/tmp/cx-day316-front-bledy-artefakty

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
git -C "$VAULT" log --oneline bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day316-front-bledy-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★ WARUNEK STARTU — SPRAWDZASZ GO NA BIEZACEJ LINII, NIE NA STARYM MARKERZE
git rev-parse HEAD
git grep -l 'appErrorMapper' -- server/src | wc -l
git grep -n 'mapAppErrorResponse' -- server/src/middleware/appErrorMapper.ts | head -3
#   oczekiwane autora: HEAD = bc18bc7acac2ec825ebb3db2f1309738ab034d58; 73 pliki `server/src`
#   wolaja mapper; funkcja `mapAppErrorResponse` istnieje.
#   ★ Dyzur 300 stanal na tym warunku, bo mierzyl go na markerze SPRZED dyzuru 296. Warunek jest
#   dzis SPELNIONY. Jesli Twoja liczba wyjdzie 0 — to jest STOP; jesli wyjdzie cokolwiek > 0 —
#   NIE jest to STOP i pracujesz dalej.

# (2) TEZA: mianownik frontu to 642 wolacze w ZADANYCH katalogach
git grep -nE 'data\.error|err\.message|error\.message' -- src/services src/api src/hooks src/components | wc -l
git grep -cE 'data\.error|err\.message|error\.message' -- src/services src/api src/hooks src/components | sort -t: -k2 -nr | head -8
git grep -nE 'data\.error|err\.message|error\.message' -- src | wc -l
#   oczekiwane autora: 642 w czterech katalogach (api.ts 68, useReportBuilder 27,
#   DocumentStudioDocumentPanel 23, admin.api.ts 13, useReportSections 11 …)
#   oraz 790 w calym `src` — ★ mianownik ZALEZY OD ZAKRESU KATALOGOW. Podaj OBIE liczby
#   i napisz, ktora jest Twoim mianownikiem i dlaczego. Mianownik nieodtwarzalny to nie mianownik.

# (3) TEZA: koperta ma piec pol, a kodow kanonicznych jest SIEDEM, z pl i en
sed -n '1,50p' server/src/middleware/appErrorMapper.ts
#   oczekiwane autora: `AppErrorResponse { error?, message?, errorCode, correlationId, debug? }`;
#   `AppErrorCode` = NOT_FOUND, VALIDATION, UNAUTHORIZED, FORBIDDEN, CONFLICT, DB_ERROR, INTERNAL;
#   slownik `MESSAGES` ma komplet `pl` i `en`.

# (4) ★★ TEZA NAJWAZNIEJSZA: polskie komunikaty mappera W OGOLE SIE NIE ODPALAJA dla AppError
grep -n 'const operational\|const message = operational\|isOperational' server/src/middleware/appErrorMapper.ts
grep -n 'this.isOperational' server/src/utils/ErrorHandler.ts
git grep -cE 'new AppError\(' -- server/src | awk -F: '{s+=$2} END {print "new AppError():", s}'
git grep -nE 'new AppError\(' -- server/src | head -8
#   oczekiwane autora: mapper ma `const message = operational ? raw : MESSAGES[language][mappedCode]`,
#   a konstruktor `AppError` USTAWIA `isOperational = true` ZAWSZE. W `server/src` jest okolo 204
#   wywolan `new AppError(...)`, a komunikaty w nich sa PO ANGIELSKU („Organization not found",
#   „Invalid plan", „Failed to fetch organizations").
#   ★ WNIOSEK, ktory masz POTWIERDZIC ALBO OBALIC WLASNYM POMIAREM: polskie zdania z `MESSAGES.pl`
#   trafiaja do klienta WYLACZNIE dla bledow NIE-AppError. Dla calej reszty front dostaje
#   angielski surowy tekst. To jest warunek brzegowy calego dyzuru — zmierz go, nie zakladaj.

# (5) TEZA: jezyk wybiera naglowek `Accept-Language`, ktory przegladarka moze zignorowac
grep -n 'Accept-Language' server/src/middleware/appErrorMapper.ts src/services/api.ts
#   oczekiwane autora: mapper czyta `req.get('Accept-Language')` i wybiera `pl` tylko dla wzorca
#   `^pl`; front USTAWIA ten naglowek w `src/services/api.ts`, ale w samym pliku stoi komentarz,
#   ze przegladarka traktuje `Accept-Language` jako naglowek zabroniony i ustawienie jest
#   „best-effort". ★ Zmierz, czy naglowek REALNIE dochodzi — inaczej caly polski slownik serwera
#   jest martwy niezaleznie od punktu (4).

# (6) TEZA: przestrzen i18n `errors.app` NIE ISTNIEJE we froncie
python3 -c "import json;[print(l, [k for k in json.load(open('public/locales/%s/translation.json'%l)) if 'error' in k.lower()]) for l in ('pl','en')]"
python3 -c "import json;print(json.load(open('public/locales/pl/translation.json'))['common'].get('errorTitle'))"
#   oczekiwane autora: brak klucza najwyzszego poziomu `errors`; istnieje tylko `common.error`,
#   `common.errorTitle`, `common.chatOpenError`. Przestrzen na teksty siedmiu kodow TWORZYSZ TY.
#   ★ Pulapka „klucz istnieje ≠ przetlumaczony": po dodaniu kluczy sprawdz, czy `pl` nie trzyma
#   angielskiego slowa.

# (7) TEZA: sa DWA komponenty `ErrorState` — ustal, ktory jest realnie montowany
ls src/components/shared/states/ErrorState.tsx src/components/ui/primitives/ErrorState.tsx
git grep -n "states/ErrorState" -- src | head
git grep -n "primitives/ErrorState" -- src | head
#   oczekiwane autora: oba pliki istnieja, ale rozklad importerow jest NIEROWNY —
#   `ui/primitives/ErrorState.tsx` ma DWOCH importerow (`MyWork/TaskInbox.tsx`,
#   `Reports/Management/ReportsHub.tsx`), a `shared/states/ErrorState.tsx` ma ZERO —
#   jedyne trafienie na jego sciezke to KOMENTARZ w `MyWork/IdeasTableContent.tsx`
#   („never interpolate the raw error"). ★ To jest kandydat na biblioteke bez wywolania.
#   USTAL, ktory komponent jest realnie RENDEROWANY na ekranie uzytkownika (nie: ma importera),
#   ZANIM dolozysz trzeci. Wolacz istnieje ≠ komponent sie renderuje; warstw jest cztery.

# (8) TEZA: istnieje gotowy WZORZEC komunikatu bledu do skopiowania
ls src/components/AIChat/aiProviderErrorCopy.ts src/components/AIChat/AiProviderErrorNotice.tsx
npx vitest run src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx --retry=0 2>&1 | tail -5
#   oczekiwane autora: oba pliki istnieja, pakiet zielony. To jest wzorzec „jedno zrodlo tekstu
#   + komponent prezentacji", ktory kopiujesz dla kodow aplikacyjnych — nie wymyslasz nowego.

# (9) TEZA: porty, kontener i dysk sa wolne
lsof -nP -iTCP:5472 -sTCP:LISTEN; lsof -nP -iTCP:6332 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day316 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow, powyzej 5 GB wolnego
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day316-front-bledy-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6332`. Twój JEDYNY port harnessu to `5472`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day316-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajete przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyzury 286-313 (bazy 6290-6329, harness 5250-5469). Cudze w TEJ SAMEJ partii: dyzur 314 (runtime 5470, baza 6330, kontener `cx-day314-pg`) i dyzur 315 (runtime 5471, baza 6331, kontener `cx-day315-pg`) — do nich nie zagladasz. Twoje wlasne i JEDYNE: baza 6332, runtime 5472, kontener `cx-day316-pg`. Sprawdzasz sam przed startem: `lsof -nP -iTCP:PORT -sTCP:LISTEN` oraz `docker ps`. Zajety port jest STOP-em calosci, a nie zaproszeniem do wziecia innego numeru`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `zadnej nowej flagi. Zmiana jest odwracalna commitem i nie zmienia ukladu ekranow, wiec nie chowa sie za przelacznikiem; jezeli w trakcie okaze sie, ze zmienia WYGLAD ekranu (nowy komponent bledu), to ta czesc idzie za flaga default OFF i konczy dyzur jako OFF — do akceptu wlasciciela na zrzutach`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/appErrorMapper.ts` (kontrakt wejsciowy — TYLKO ODCZYT) · `server/src/utils/ErrorHandler.ts` (klasa `AppError` — TYLKO ODCZYT) · `src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx` (wzorzec, zielony — nie psujesz) · `tests/unit/services/api-chat-stream-recovery.test.ts` · `scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` · `scripts/check-artefakt.sh` · nowe i obowiazkowe: `src/services/errors/__tests__/appErrorCopy.test.ts` oraz `tests/unit/frontend/noRawErrorInJsx.test.ts` (bezpiecznik „surowy komunikat nie trafia do JSX” — musi miec dowod mutacyjny celujacy w ZABEZPIECZENIE)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY316_FRONT_BLEDY_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` — ten dyzur jest przekrojowy przez caly front i nie domyka zadnego pojedynczego modulu. Dozwolony jest JEDEN dodatkowy plik rejestru: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_FRONT_BLEDY_20260904.md` (tabela `plik · linia · klasa · PRZED · PO · commit`), jesli tabela nie miesci sie w raporcie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day316-front-bledy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day316-front-bledy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ ZMIANY CZEGOKOLWIEK W `server/src`** — komunikaty serwera zamawia osobny, planowany dyzur 321; Twoja rola konczy sie na POMIARZE i zapisaniu wniosku. ★★ **ZAKAZ OGLOSZENIA STOP-U NA WARUNKU STARTU BEZ POMIARU NA MARKERZE WYDANYM W TEJ INSTRUKCJI** — dyzur 300 stal dobe po ustaniu blokady, bo sprawdzil warunek ponownie na starym markerze; jesli `git grep -l 'appErrorMapper' -- server/src` daje cokolwiek wiecej niz zero, warunek jest spelniony i pracujesz. ★★ **ZAKAZ PODMIANY WOLACZY HURTEM BEZ KLASYFIKACJI** — wolacz, ktory tylko loguje do konsoli, i wolacz, ktorego tekst laduje w JSX, to dwie rozne klasy i tylko druga jest defektem widocznym dla uzytkownika. ★★ **ZAKAZ WYCISZANIA ZAMIAST NAPRAWY**: `@ts-ignore`, `.skip`, poszerzanie `exclude`, kasowanie zastanego testu. Asercje wolno ZMIENIC z uzasadnieniem, nie skasowac. ★★ **ZAKAZ MELDOWANIA „przetlumaczone” PO SAMEJ OBECNOSCI KLUCZA i18n** — sprawdzasz WARTOSCI w `pl`, bo klucz potrafi trzymac angielskie slowo. ★★ **ZAKAZ DOKLADANIA TRZECIEGO KOMPONENTU `ErrorState`** przed ustaleniem, ktory z dwoch istniejacych jest realnie montowany | Dyzur 300 dostal warunek startu i sprawdzil go dwa razy na tym samym, starym markerze — przez to stal dobe po tym, jak blokada ustala. Rownolegle: front, ktory „czyta errorCode”, ale dostaje surowy angielski komunikat dla kazdego `AppError`, jest praca wykonana i bezwartosciowa dla uzytkownika — dlatego warunek brzegowy jezyka jest pozycja rdzenia, a nie przypisem |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
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
cd /private/tmp/cx-day316-front-bledy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day316-pg psql -U postgres -d cx316 \
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

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day316-front-bledy

docker run -d --name cx-day316-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx316 \
  -p 127.0.0.1:6332:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day316-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6332/cx316 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6332/cx316 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day316-front-bledy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6332/cx316 \
JWT_SECRET=cx316-test-secret-do-not-reuse \
npx vitest run src/services/errors/__tests__/ tests/unit/frontend/ src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day316-front-bledy-artefakty/day316-front-bledy.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day316-front-bledy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/services/errors/__tests__/ tests/unit/frontend/ src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day316-front-bledy-artefakty/day316-front-bledy.json
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

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day316-front-bledy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day316-pg psql -U postgres -d cx316 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day316-pg`.
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

---

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
> **(e) (e) ★★ WARUNEK STARTU SPRAWDZASZ NA BIEZACEJ LINII, NIE NA STARYM MARKERZE.
> Dyzur 300 zostal zablokowany warunkiem „mapper z dyzuru 296 musi istniec”
> i STAL DOBE PO USTANIU BLOKADY, bo sprawdzal warunek ponownie na TYM SAMYM,
> starym markerze, na ktorym mapper faktycznie nie istnial. Kiedy wznawiasz dyzur
> zablokowany warunkiem startu, warunek mierzysz na markerze WYDANYM CI TERAZ.
> Jesli marker jest przodkiem tipa, a warunek na nim jest spelniony — pracujesz.
>
> (f) ★★ MAPPER MOWI PO POLSKU TYLKO WTEDY, GDY NIKT GO NIE POPROSIL O NIC INNEGO.
> `mapAppErrorResponse` zwraca `operational ? raw : MESSAGES[language][code]`,
> a konstruktor `AppError` ustawia `isOperational = true` ZAWSZE. Skutek zmierzony
> na markerze: dla wszystkich okolo 204 wywolan `new AppError(...)` w `server/src`
> klient dostaje SUROWY, ANGIELSKI komunikat, a polski slownik mappera odpala sie
> wylacznie dla bledow, ktorych nikt nie opakowal. Jesli tego nie zmierzysz,
> zbudujesz front, ktory „czyta `errorCode`” i dalej pokazuje angielskie zdanie.
>
> (g) ★★ `Accept-Language` JEST NAGLOWKIEM ZABRONIONYM W PRZEGLADARCE.
> Front ustawia go w `src/services/api.ts`, ale komentarz w tym samym pliku mowi
> wprost, ze to jest „best-effort”. Jezeli naglowek nie dochodzi, serwer wybiera
> `en` niezaleznie od jezyka interfejsu. Zmierz to na realnym zadaniu, nie z kodu.
>
> (h) ★★ WOLACZ ISTNIEJE ≠ KOMPONENT SIE RENDERUJE. W `src/` sa DWA komponenty
> `ErrorState`. Zanim dolozysz trzeci sposob pokazywania bledu, ustal, ktory
> z istniejacych jest realnie montowany na ekranie uzytkownika — warstw jest
> cztery (wolacz, komponent, trasa, render), a `grep` widzi tylko pierwsza.
>
> (i) ★★ „KLUCZ ISTNIEJE” ≠ „PRZETLUMACZONY”. Audyt po obecnosci klucza i18n
> melduje „przetlumaczone” takze wtedy, gdy `pl` trzyma angielskie slowo.
> Po dodaniu tekstow siedmiu kodow sprawdzasz WARTOSCI, nie klucze.
>
> (j) ★★ `npx vitest run` W TYM REPO ZAPISUJE `junit.xml` DO KORZENIA WORKTREE.
> To jest zachowanie konfiguracji, nie Twoj blad — nie commituj tego pliku i nie
> „naprawiaj” go zmiana konfiguracji testow. Do artefaktow uzywasz
> `--reporter=json --outputFile=<plik POZA repo>`, jak w `§0.2c`.**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

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
| „`psql` nie istnieje na hoście" | `docker exec cx-day316-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day316-front-bledy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — mianownik zmierzony samodzielnie, z zakresem katalogow, plus klasyfikacja „trafia na ekran” / „tylko log”; R2 — jedno zrodlo tekstow siedmiu kodow po polsku i angielsku + prezentacja z `correlationId`; R3 — podmiana wolaczy grupami; R4 — bezpiecznik „surowy komunikat nie trafia do JSX” z dowodem mutacyjnym; R6 — POMIAR warunku brzegowego jezyka bledow operacyjnych`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6332` albo `5472` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6332` albo `5472`** (`Z7`).

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

---

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

---

## Po co ten dyżur istnieje

Dyżur 296 dał serwerowi jednolitą kopertę błędu. Dyżur 300 miał zrobić drugą połowę — żeby front
przestał wstawiać do widoku zdanie napisane dla programisty — i **stanął na warunku startu**:
na markerze, który dostał, `appErrorMapper` miał zero trafień.

**Warunek jest dziś spełniony.** Mapper istnieje w `server/src/middleware/appErrorMapper.ts`,
a na markerze woła go **73 pliki** `server/src`.

★★ **POPRAWKA METODYCZNA, KTÓRA JEST CZĘŚCIĄ TEGO ZLECENIA.** Dyżur 300 sprawdził warunek startu
**dwa razy na tym samym, starym markerze** — i przez to stał **dobę po tym, jak blokada ustała**.
Jego STOP był zasadny za pierwszym razem i **niezasadny za drugim**, bo mierzył przeszłość.

**Zasada, którą masz zastosować i zapisać w raporcie: przy wznowieniu dyżuru zablokowanego
warunkiem startu sprawdzasz warunek NA BIEŻĄCEJ LINII — na markerze wydanym w TEJ instrukcji —
a nie ponownie na markerze, na którym blokada powstała.** Komenda (1) weryfikacji wejściowej robi
dokładnie to.

## Cel produktowy jednym zdaniem

**Użytkownik ma zobaczyć zdanie napisane dla niego, po polsku, plus identyfikator do zgłoszenia —
a nie zdanie napisane dla programisty.**

Technicznie: front czyta `errorCode` i `correlationId` z koperty, dobiera tekst z **jednego
źródła**, i pokazuje `correlationId` w miejscu, z którego użytkownik może go przepisać do
zgłoszenia. Surowy `message` z serwera **nie trafia do JSX**.

## ★ Zmierz moje liczby sam

| # | Twierdzenie | Moja liczba | Komenda |
|---|---|---|---|
| 1 | plików `server/src` wołających mapper | **73** | (1) |
| 2 | wołaczy frontu w katalogach `src/services src/api src/hooks src/components` | **642** | (2) |
| 3 | wołaczy frontu w **całym** `src` | **790** w 319 plikach | (2) |
| 4 | kodów kanonicznych w kopercie, z `pl` i `en` | **7** | (3) |
| 5 | wywołań `new AppError(...)` w `server/src` | **≈204**, komunikaty po angielsku | (4) |
| 6 | kluczy i18n dla tych kodów we froncie | **0 — przestrzeń `errors` nie istnieje** | (6) |
| 7 | komponentów `ErrorState` w `src/` | **2** | (7) |

★ Twierdzenia 2 i 3 różnią się **tylko zakresem katalogów**. Podaj **obie** liczby i napisz, która
jest Twoim mianownikiem i dlaczego. **Mianownik, którego nie da się odtworzyć, nie jest
mianownikiem** — dokładnie ten błąd zamknął mianownik dyżuru 311 w sporze z dokumentem decyzji.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★★ Warunek brzegowy, od którego zależy sens całej pracy

`mapAppErrorResponse` zawiera linię o tej treści:

```ts
const message = operational ? raw : MESSAGES[language][mappedCode];
```

a konstruktor `AppError` (`server/src/utils/ErrorHandler.ts`) ustawia `this.isOperational = true`
**bezwarunkowo, dla każdego `new AppError(...)`**.

Wniosek, który masz **potwierdzić albo obalić własnym pomiarem** (pozycja `R6`): polskie zdania ze
słownika `MESSAGES.pl` docierają do klienta **wyłącznie dla błędów, których nikt nie opakował
w `AppError`**. Dla całej reszty — a to około **204 wywołania** w `server/src`, z komunikatami
takimi jak `Organization not found`, `Invalid plan`, `Failed to fetch organizations` — front dostaje
**surowy tekst po angielsku**.

Do tego dochodzi drugie dno: język wybiera nagłówek `Accept-Language`, a `src/services/api.ts`
ustawia go z własnym komentarzem, że przeglądarka traktuje ten nagłówek jako **zabroniony** i
ustawienie jest „best-effort”. Jeżeli nagłówek nie dochodzi, serwer wybiera `en` **niezależnie od
punktu wyżej**.

**To nie jest przypis. To jest pytanie, czy Twoja praca w ogóle zadziała dla użytkownika.**
Zmiana komunikatów serwera na polskie należy do planowanego dyżuru 321 — **Ty jej nie robisz** —
ale Twój raport ma odpowiedzieć jednym cytowalnym zdaniem: *czy bez dyżuru 321 użytkownik zobaczy
polski komunikat, czy nie, i w jakim odsetku przypadków.*

# TABELA LICENCJI PLIKOWYCH

Kolumna „Produkt zastępczy” mówi, co robisz, gdy pliku nie wolno Ci zmienić — **żaden wiersz nie
brzmi samo „STOP”**.

| Warstwa | Ścieżka | Prawo | Produkt zastępczy / uwaga |
|---|---|---|---|
| **walidator / kontrakt serwera** | `server/src/middleware/appErrorMapper.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Twój kontrakt wejściowy. Zmiana należy do planowanego dyżuru 321. Produkt zastępczy: **pomiar `R6` + gotowa rekomendacja jako diff w bloku kodu, nienałożony** |
| **klasa błędu serwera** | `server/src/utils/ErrorHandler.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Źródło warunku brzegowego (`isOperational = true` zawsze). Jak wyżej |
| **trasa / kontroler / serwis / repozytorium serwera** | całe `server/src/**`, `server/migrations/**` | **TYLKO ODCZYT** | Ten dyżur nie ma pozycji serwerowej ani migracyjnej. Każde znalezisko: plik, linia, problem, rekomendacja jako diff. Pozycja idzie dalej |
| **druga rodzina kodów** | `server/src/services/ai/providerErrorMapper.ts` | **TYLKO ODCZYT** | Siedem kodów `AI_*` — **inna rodzina** niż siedem kodów aplikacyjnych. Nie mieszasz ich w jednym słowniku; jeśli uznasz, że powinny być wspólne, to jest **rekomendacja**, nie zmiana |
| **klient HTTP frontu (rdzeń)** | `src/services/api.ts` | **★ WĄSKA LICENCJA:** wyłącznie odczyt koperty (`errorCode`, `correlationId`) i przekazanie jej dalej w typowanym obiekcie błędu, w zakresie `R2`–`R3` | Zakaz zmiany logiki autoryzacji, ponawiania i strumieniowania. 68 trafień rodziny — czoło listy |
| **klient HTTP frontu** | `src/services/apiUtils.ts`, `src/services/api/admin.api.ts` | **★ WĄSKA LICENCJA** w zakresie `R3` | — |
| **jedno źródło tekstów (NOWY)** | `src/services/errors/appErrorCopy.ts` (**NOWY**) | **★ PEŁNA LICENCJA** | Wzorzec do skopiowania: `src/components/AIChat/aiProviderErrorCopy.ts` — nie wymyślasz nowego kształtu |
| **prezentacja** | `src/components/shared/states/ErrorState.tsx` | **★ WĄSKA LICENCJA** — tylko jeżeli `R1` udowodni, że **ten** jest realnie montowany | Jeżeli montowany jest drugi — licencja przechodzi na niego, a ten zostaje tylko do odczytu. **Rozstrzygnięcie musi być w raporcie przed pierwszą zmianą** |
| **prezentacja** | `src/components/ui/primitives/ErrorState.tsx` | jak wyżej, warunkowo | ★ Dwa komponenty o tej samej nazwie. **Nie dokładasz trzeciego** |
| **wzorzec** | `src/components/AIChat/aiProviderErrorCopy.ts`, `src/components/AIChat/AiProviderErrorNotice.tsx` | **TYLKO ODCZYT — WZORZEC** | Kopiujesz kształt, nie zmieniasz oryginału |
| **konsumenci (grupa główna)** | `src/components/ReportBuilder/useReportBuilder.ts`, `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`, `src/hooks/useReportSections.ts`, `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx`, `src/components/Presentations/PresentationTemplateArchitectView.tsx` | **★ PEŁNA LICENCJA** w zakresie `R3`, wyłącznie w liniach wskazanych przez `R1` jako klasa **„trafia na ekran”** | Zakaz zmian poza wskazanymi liniami |
| **konsumenci (ogon)** | pozostałe pliki z listy `R1` w `src/services src/api src/hooks src/components` | **★ PEŁNA LICENCJA** w zakresie `R3`, tylko klasa „trafia na ekran” | Ogon robisz **po** rdzeniu i uczciwie opisujesz, ile go zostało |
| **teksty** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WĄSKA LICENCJA:** wyłącznie **NOWA** przestrzeń `errors.app.*` (7 kodów + tekst identyfikatora zgłoszenia) | Zakaz dotykania istniejących kluczy. **Sprawdzasz WARTOŚCI, nie obecność kluczy** |
| **test (NOWE pliki)** | `src/services/errors/__tests__/appErrorCopy.test.ts` (**NOWY PLIK**), `tests/unit/frontend/noRawErrorInJsx.test.ts` (**NOWY PLIK**) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | `git add -f`. Oba **obowiązkowe**, oba z dowodem mutacyjnym |
| **test (wzorzec)** | `src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx` | **TYLKO ODCZYT** | Zielony. Nie psujesz |
| **bramki platformowe** | `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | **TYLKO ODCZYT** | Nie dotyczą zakresu; **nie omijasz ich** |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY316_FRONT_BLEDY_REPORT.md` (**NOWY PLIK**) | **JEDYNY podstawowy nowy dokument** (`Z13`) | — |
| **rejestr (opcjonalny)** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_FRONT_BLEDY_20260904.md` (**NOWY PLIK**) | **★ PEŁNA LICENCJA**, jeżeli tabela nie mieści się w raporcie | Jedyny dozwolony drugi dokument |
| **cudzy teren** | `src/components/AIChat/**` (poza plikami wzorca, do odczytu) | **TYLKO ODCZYT — teren dyżuru 315** | Wpis do raportu + rekomendacja jako diff, nienałożony. Pozycja idzie dalej |
| **cudzy teren** | `src/components/Initiatives/**`, `src/components/MyWork/**`, `src/components/Interview/**`, `src/components/DiscoveryTools/**`, `src/components/shared/NModeLayout/**` | **TYLKO ODCZYT — teren dyżuru 314** | jak wyżej. ★ Jeżeli któryś z tych plików jest na Twojej liście `R1`, **zapisujesz to jako kolizję zasobową** i zostawiasz go dyżurowi 314 |

**Nietykalne imiennie:** całe `server/src` i `server/migrations`; `appErrorMapper.ts`;
`ErrorHandler.ts`; `providerErrorMapper.ts`; `aiProviderErrorCopy.ts` i `AiProviderErrorNotice.tsx`
(wzorzec); istniejące klucze w plikach lokalizacji; trzy bramki kanonu.

**Rozłączność z partią równoległą:** dyżur 314 pracuje w kontraktach kart, dyżur 315 w
`src/components/AIChat/**` i w ekranach dev-render Czatu. Twoja lista `R1` **prawdopodobnie
zahaczy o oba tereny** — wtedy te pliki **zostawiasz** i wypisujesz jako kolizję, a nie jako dług
nienaprawiony. Przed pierwszym commitem sprawdź `git log` gałęzi bazowej.

# POZYCJE

## R1 — MIANOWNIK I KLASYFIKACJA (rdzeń)

Mierzysz sam, obiema komendami (zakres czterech katalogów i całe `src`), i **deklarujesz swój
mianownik**. Potem **klasyfikujesz każde trafienie**:

| Klasa | Definicja | Co z tym robisz |
|---|---|---|
| `NA EKRAN` | tekst z serwera ląduje w JSX / `toast` / `alert` — widzi go użytkownik | podmiana w `R3` |
| `TYLKO LOG` | `console.error`, telemetria, `logger` | **nie ruszasz**, wpis do tabeli |
| `STEROWANIE` | tekst używany do porównania / `includes` / rozgałęzienia logiki | **nie ruszasz** bez osobnego uzasadnienia — podmiana zmieni zachowanie |
| `CUDZY TEREN` | plik należy do dyżuru 314 albo 315 | **zostawiasz**, wpis jako kolizja |

★ Klasa `NA EKRAN` jest jedynym defektem widocznym dla użytkownika. Podmiana hurtem, bez tej
klasyfikacji, zmieni też logowanie i sterowanie — i to jest sposób, w jaki „naprawa” staje się
regresją.

W tej samej pozycji rozstrzygasz **który `ErrorState` jest realnie montowany** — nie który ma
importera. Wołacz istnieje ≠ komponent się renderuje; warstw jest cztery (wołacz, komponent,
trasa, render), a `grep` widzi tylko pierwszą. Dowód: ścieżka od punktu wejścia aplikacji do
renderu, albo kadr.

**Commit po `R1`.**

## R2 — JEDNO ŹRÓDŁO TEKSTÓW (rdzeń)

Nowy `src/services/errors/appErrorCopy.ts`, wzorowany kształtem na `aiProviderErrorCopy.ts`:
funkcja, która z `errorCode` (siedem kodów kanonicznych + wariant nieznany) daje tekst dla
użytkownika, z i18n. Nowa przestrzeń `errors.app.*` w `pl` i `en`.

Wymagania twarde:

1. **Kod nieznany ma zdefiniowane zachowanie** — serwer może odesłać `errorCode` spoza siedmiu
   (mapper przepuszcza `codeOf(error)` dla błędów operacyjnych, a tam siedzą kody typu
   `FEATURE_UNAVAILABLE`). Twoja funkcja **nie może** pokazać wtedy pustki ani surowego kodu.
2. **`correlationId` jest widoczny dla użytkownika** — w formie, którą da się przepisać albo
   skopiować. Bez tego użytkownik nie ma jak zgłosić błędu, a `correlationId` w kopercie jest
   martwym polem.
3. **Test `appErrorCopy.test.ts`** sprawdza WARTOŚCI w `pl` — nie obecność kluczy. Dowód
   mutacyjny: usuń blok `errors.app` z `pl` → test **musi** paść.

**Commit po `R2`.**

## R3 — PODMIANA WOŁACZY (rdzeń)

Grupami, commit per grupa, `esbuild` każdego pliku. Rdzeń najpierw: `src/services/api.ts`
i pięć plików z czoła listy. Ogon — po rdzeniu, i uczciwie policzony w raporcie.

**Zakaz podmiany hurtem jednym codemodem bez przejścia klasyfikacji z `R1`.**

**Commit per grupa.**

## R4 — BEZPIECZNIK „SUROWY KOMUNIKAT NIE TRAFIA DO JSX” (rdzeń)

`tests/unit/frontend/noRawErrorInJsx.test.ts` — bezpiecznik z **linią bazową**, tak jak
`check-focus-canon.baseline.txt`: dziś przepuszcza zastany dług, ale **nie pozwala mu rosnąć**
w plikach, które już objął.

Dowód mutacyjny **musi celować w zabezpieczenie**: wstawiasz do objętego pliku jedno wyrażenie
wstawiające `err.message` do JSX → test **pada**. Cofasz → test wraca na zielono. Mutacja psująca
import albo składnię **nie jest dowodem** — w trzech na cztery dyżury jednego dnia testy
przechodziły po skasowaniu zabezpieczenia, bo mutacja celowała obok.

★ Jeżeli linia bazowa zaczyna od zera dla wszystkich plików — powiedz to wprost i pokaż, ile
plików obejmuje. **Bezpiecznik, który nic nie obejmuje, przechodzi zawsze i nie jest
bezpiecznikiem** („brak pomiaru nie jest wynikiem”).

**Commit po `R4`.**

## R5 — DOWÓD, ŻE UŻYTKOWNIK TO WIDZI

Kadr albo test renderujący, pokazujący **realny** komunikat dla co najmniej trzech kodów
(np. `NOT_FOUND`, `FORBIDDEN`, `INTERNAL`) — po polsku, z widocznym identyfikatorem zgłoszenia.

Jeżeli robisz to zrzutem: **wyłącznie kanonicznym `scripts/dev/grafika-zrzuty.mjs`**, sekcje
rozwinięte, i **zakaz pisania własnego skryptu zrzutów obok** — brakującą funkcję dokłada się
narzędziu jako opcję opt-in. Sprawdź przy okazji, czy rozwijanie nie zamyka podglądu: przelot
z `--rozwin-sekcje=1` i bez, porównanie **długości wydobytego tekstu**; jeśli wersja rozwinięta
ma tekstu mniej — `--cofnij-jesli-skraca=1` i wpis do raportu.

Jeżeli robisz to testem renderującym — asercja na **treści widocznej dla użytkownika**, nie na
obecności propsa.

**Commit po `R5`.**

## R6 — POMIAR WARUNKU BRZEGOWEGO JĘZYKA (rdzeń)

To jest pozycja rdzenia, nie przypis. Mierzysz **trzy rzeczy** i podajesz liczby:

1. **Ile wywołań `new AppError(...)` jest w `server/src`** i **jaki odsetek** ma komunikat po
   angielsku. Próbka to nie zbiór — jeżeli nie policzysz wszystkich, napisz, ile obejrzałeś
   i jak dobrałeś próbkę.
2. **Czy `Accept-Language` realnie dochodzi** do serwera z przeglądarki. Zmierz to na realnym
   żądaniu (harness na Twoim porcie `5472`, kontener `cx-day316-pg` na `6332`, jeżeli potrzebujesz
   działającego backendu), a nie z lektury kodu. Jeżeli nie da się tego zmierzyć w Twoim
   środowisku — **napisz to wprost i opisz, czego brakowało**; to jest uczciwy wynik.
3. **Jaki odsetek błędów, które użytkownik realnie zobaczy, będzie po polsku** po Twojej pracy,
   przy założeniu, że dyżur 321 **nie powstanie**.

Produkt pozycji: **jedno cytowalne zdanie** odpowiadające na pytanie „czy bez dyżuru 321
użytkownik zobaczy polski komunikat”, oraz **gotowa rekomendacja dla dyżuru 321 jako diff
w bloku kodu, nienałożony**.

**Zakaz rozwiązania tego problemu po stronie serwera. Zakaz przemilczenia go.**

**Commit po `R6`.**

## R7 — RAPORT

1. Zdanie o warunku startu: **na jakim SHA go sprawdziłeś i z jakim wynikiem** (poprawka metodyczna).
2. Mianownik — obie liczby, z komendami i zakresem katalogów; deklaracja, która jest Twoja.
3. Tabela klasyfikacji `R1` (klasa per trafienie) — w raporcie albo w rejestrze.
4. Rozstrzygnięcie, który `ErrorState` jest montowany, z dowodem.
5. Tabela `PRZED → PO` per grupa, z commitami; ogon policzony uczciwie.
6. Dowody mutacyjne `R2` i `R4` — **obie strony** (czerwono po mutacji, zielono po cofnięciu).
7. `§0.4a` — pełne nazwy testów przed i po, `diff`. `N passed` bez nazw nie jest pomiarem.
8. `R6`: trzy liczby + jedno cytowalne zdanie + rekomendacja dla dyżuru 321 jako diff.
9. Sekcję **TWIERDZENIA NIEZWERYFIKOWANE** — niepustą.

## Prawo zatrzymania

„Zmierzyłem mianownik i podałem go z zakresem, sklasyfikowałem 642 wołacze, podmieniłem rdzeń
i połowę ogona, bezpiecznik ma linię bazową i dowód mutacyjny w obie strony, a `R6` mówi, że bez
dyżuru 321 polski komunikat zobaczy tylko część użytkowników — oto liczba” **jest wynikiem**.

„Podmieniłem wszystkie 642 wołacze” bez `R6` **nie jest wynikiem** — to jest praca, po której
użytkownik dalej czyta po angielsku, tylko z ładniejszej ramki.

---

**★ Ostatnie zdanie tej instrukcji i najważniejsze: Jeśli Twój pomiar przeczy liczbie podanej
w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.** Obalenie którejkolwiek
mojej tezy jest **SUKCESEM** dyżuru, a nie porażką.

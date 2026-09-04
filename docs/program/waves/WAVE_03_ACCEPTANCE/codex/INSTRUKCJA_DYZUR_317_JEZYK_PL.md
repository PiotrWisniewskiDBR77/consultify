# INSTRUKCJA DYŻURU nr 317 — Codex — „Dyżur 308 dał skrypt i mianownik (631 identycznych PL/EN) i uczciwie stanął na heurystyce — ten dyżur kończy klasyfikację semantyczną: z 631 tylko ok. 119 (19%) to realni DEFEKT-PL (skrypt dziś zawyża do 578, ~5×), plus nowa, nieprzewidziana rodzina 13 DEFEKT-EN — polskie napisy w pliku angielskim"

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
> **wyłącznie** `/private/tmp/cx-day317-jezyk-pl`.

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
Zakres: **PRZEKROJOWE — JĘZYK POLSKI, dokończenie dyżuru 308: klasyfikacja semantyczna 631 identycznych wartości PL/EN (nie masowe tłumaczenie) i nowa rodzina DEFEKT-EN (polski tekst w pliku angielskim), której dyżur 308 nie mierzył**.
Trasy front: ``public/locales/pl/translation.json`, `public/locales/en/translation.json` (globalne słowniki, konsumowane przez `react-i18next` w całym `src/**`); `scripts/dev/i18n-pl-audyt.mjs` (skrypt klasyfikujący z dyżuru 308, do rozbudowy); ekrany do dowodu kadrem wybierasz z `scripts/dev/g06-macierz-ekrany.json`, po jednym z możliwie różnych modułów, dla realnych wołaczy zmienianych kluczy`. Trasy tył: `brak — dyżur nie zmienia `server/src/**`. Jeżeli w trakcie klasyfikacji natrafisz na klucz, którego wartość pochodzi z odpowiedzi serwera (nie ze słownika), to NIE jest w zakresie tego dyżuru — wypisz jako listę z liczbą i zostaw`.

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
WT=/private/tmp/cx-day317-jezyk-pl
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
git -C "$VAULT" worktree add "$WT" -b codex/day317-jezyk-pl-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day317-jezyk-pl/config.worktree"
cat "$VAULT/worktrees/cx-day317-jezyk-pl/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day317-jezyk-pl-scratch
mkdir -p /private/tmp/cx-day317-jezyk-pl-artefakty

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
git -C "$WT" push github-backup codex/day317-jezyk-pl-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `7` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# (1) TEZA: mianownik liści — ZMIERZ SAM, zlecenie podaje 35183 (pl) / 33050 (en), Twój wynik rozstrzyga
node -e "const fs=require('fs');function flat(o,p='',out=new Map()){if(o&&typeof o==='object'&&!Array.isArray(o)){for(const [k,v] of Object.entries(o)) flat(v,p?p+'.'+k:k,out);}else out.set(p,o);return out;}const pl=flat(JSON.parse(fs.readFileSync('public/locales/pl/translation.json','utf8')));const en=flat(JSON.parse(fs.readFileSync('public/locales/en/translation.json','utf8')));console.log(JSON.stringify({plLeaves:pl.size,enLeaves:en.size}));"
#   oczekiwane: rzędu 34-35 tys. obu stron; mój pomiar 04.09: plLeaves=34310, enLeaves=32321 — RÓŻNI SIĘ od 35183/33050 ze zlecenia. To nie jest sprzeczność, to wynik — treść pliku zmienia się codziennie.

# (2) TEZA: skrypt istnieje i dziś liczy 631 identycznych (>3 znaki)
node scripts/dev/i18n-pl-audyt.mjs
#   oczekiwane: JSON z polem "identical":631 (albo blisko — zapisz swój wynik), "defects": liczba WYSOKA (skrypt dziś NIE klasyfikuje semantycznie, tylko listą stop-słów) — to jest właśnie zawyżenie, które naprawiasz w R2

# (3) TEZA: "Status" jest największą pojedynczą rodziną UZASADNIONą wśród 631 (114 wystąpień)
node -e "const fs=require('fs');function flat(o,p='',out=new Map()){if(o&&typeof o==='object'&&!Array.isArray(o)){for(const [k,v] of Object.entries(o)) flat(v,p?p+'.'+k:k,out);}else out.set(p,o);return out;}const pl=flat(JSON.parse(fs.readFileSync('public/locales/pl/translation.json','utf8')));const en=flat(JSON.parse(fs.readFileSync('public/locales/en/translation.json','utf8')));let n=0;for(const [k,v] of pl){if(en.has(k)&&en.get(k)===v&&typeof v==='string'&&v.length>3&&v==='Status')n++;}console.log(n);"
#   oczekiwane: 114

# (4) TEZA: przykłady DEFEKT-PL z brief-u istnieją naprawdę jako klucze w PL i mają identyczną wartość w EN
for kw in Owner Workflow Assessment Insight Dashboard Baseline Framework Governance Inbox Attachments Reminders Interview Initiative; do
  node -e "const fs=require('fs');function flat(o,p='',out=new Map()){if(o&&typeof o==='object'&&!Array.isArray(o)){for(const [k,v] of Object.entries(o)) flat(v,p?p+'.'+k:k,out);}else out.set(p,o);return out;}const pl=flat(JSON.parse(fs.readFileSync('public/locales/pl/translation.json','utf8')));const en=flat(JSON.parse(fs.readFileSync('public/locales/en/translation.json','utf8')));const target=process.argv[1];let hit=null;for(const [k,v] of pl){if(v===target&&en.get(k)===v){hit=k;break;}}console.log(target,hit||'BRAK');" "$kw"
done
#   oczekiwane: dla większości słów kluczowych co najmniej jeden klucz PL=EN='<słowo>' — to są realne kandydaci DEFEKT-PL, nie fantomy

# (5) TEZA: rodzina DEFEKT-EN istnieje naprawdę — polski tekst wewnątrz pliku ANGIELSKIEGO (skrypt 308 tego NIE liczy w ogóle)
grep -n '"Zakres"' public/locales/en/translation.json
grep -n '"Prezentacje"' public/locales/en/translation.json
grep -n 'Nazwa szablonu jest wymagana' public/locales/en/translation.json
grep -n 'Zapytaj AI' public/locales/en/translation.json
#   oczekiwane: każda komenda zwraca co najmniej jedno trafienie w pliku EN — to jest defekt odwrotny, którego instrukcja 308 nie przewidziała

# (6) TEZA: dziesięć z dwunastu próbkowanych kluczy-defektów ma realnego wołacza w src/ — sprawdź na DOWOLNYM z powyższych trafień
grep -n "t('.*askAI'\|t(\"\.\{0,40\}askAI" src -r 2>/dev/null | head -5
#   oczekiwane: co najmniej jeden wołacz w komponencie React — jeśli zero, to jest osierocony klucz i idzie do innej kategorii (nie DEFEKT priorytetowy)

# (7) zasoby wolne
df -h /
lsof -nP -iTCP:5473 -sTCP:LISTEN; lsof -nP -iTCP:6333 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day317 || true
#   oczekiwane: powyżej 5 GB wolnego dysku; oba porty puste; 0 kontenerów
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day317-jezyk-pl-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6333`. Twój JEDYNY port harnessu to `5473`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day317-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-316 (bazy i harnessy tej numeracji) oraz rodzeństwo tej samej paczki wydanej 04.09: 318 (baza 6334, harness 5474), 322 (baza 6338, harness 5478), 323 (baza 6339, harness 5479); paczka 313-316 i 319-321 ma własny przydział spoza tej instrukcji — nie znasz go z tego dokumentu, sprawdź `docker ps`/`lsof` sam, nie zgaduj. Twoje własne: baza 6333, harness 5473. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`, `grafika-zrzuty` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak — ten dyżur nie tworzy ani nie przełącza żadnej flagi funkcyjnej. Jeżeli naprawa DEFEKT-PL zmienia DŁUGOŚĆ napisu tak, że łamie układ (przyciski, nagłówki tabel, chipy, menu), to jest zmiana wyglądu i idzie do raportu z kadrem PRZED/PO kanonicznym `scripts/dev/grafika-zrzuty.mjs`, nie po cichu, i nie wymaga to nowej flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` · `scripts/check-artefakt.sh` · wszystkie pliki serwera (`server/src/**`) — ten dyżur ich nie dotyka w ogóle; jeśli klasyfikacja odkryje klucz zasilany z odpowiedzi HTTP serwera zamiast słownika, wypisujesz go na liście i NIE naprawiasz tutaj`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY317_JEZYK_PL_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` (nadpisywany generowany rejestr dyżuru 308 — WOLNO Ci go regenerować skryptem rozbudowanym o klasyfikację; nie edytujesz go ręcznie) i nowy `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md` (nowy plik, WYŁĄCZNIE ta rodzina — 13 polskich napisów w pliku angielskim, z kolumną plik:linia · wartość znaleziona · wartość poprawiona · commit). Kadry PNG (jeśli naprawa zmienia długość napisu) do `evidence/grafika/jezyk-pl-20260904/` (`git add -f`). Kod: `scripts/dev/i18n-pl-audyt.mjs` (rozbudowa o klasyfikację semantyczną i detekcję DEFEKT-EN), poprawki wartości w `public/locales/*/translation.json`, ewentualny bezpiecznik regresji. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day317-jezyk-pl-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day317-jezyk-pl-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ tłumaczenia „na oko” bez odczytania kontekstu wołacza** — każda zmiana wartości wymaga NAJPIERW `grep -rn "t('<klucz>'" src/` i przeczytania komponentu, w którym klucz żyje (szerokość przycisku, czy to nagłówek tabeli, czy treść danych). **ZAKAZ traktowania 578 „defektów” ze skryptu jako gotowej listy roboczej** — to jest zawyżenie ~5×; klasyfikujesz każdy wiersz semantycznie, plik po pliku. **ZAKAZ zmniejszenia liczby liści w którymkolwiek pliku translation.json** — mierzysz PRZED i PO, liczba nie może spaść (dopisywanie brakujących kluczy jest dozwolone, kasowanie — nie). **ZAKAZ masowego tłumaczenia bez commitu per plik/rodzina** — każda ukończona rodzina kluczy to osobny commit. **ZAKAZ karania heurystyki STOP z dyżuru 308** — była uczciwa (kontrprzykład „Tempo”); Twoim zadaniem jest dokończyć klasyfikację, nie przepisywać jej od nowa | Skrypt dyżuru 308 klasyfikuje przez prostą listę stop-słów i dziś zawyża defekty ~5× (578 zamiast realnych ~106-119) — meldunek „578 kluczy do naprawy” byłby fałszywym alarmem, który zepsułby priorytetyzację następnych dyżurów, a masowa naprawa bez odczytu kontekstu ryzykuje wprowadzenie gorszych tłumaczeń niż oryginalny brak — dokładnie kształt osiemnasty fałszywego gotowe (`klucz istnieje ≠ przetłumaczony`) odwrócony: teraz `klucz zaklasyfikowany ≠ realny defekt` |

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
cd /private/tmp/cx-day317-jezyk-pl

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day317-pg psql -U postgres -d cx317 \
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
cd /private/tmp/cx-day317-jezyk-pl

docker run -d --name cx-day317-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx317 \
  -p 127.0.0.1:6333:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day317-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6333/cx317 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6333/cx317 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day317-jezyk-pl && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6333/cx317 \
JWT_SECRET=cx317-test-secret-do-not-reuse \
npx vitest run `node scripts/dev/i18n-pl-audyt.mjs` (bez DB, czysto plikowy) oraz punktowo testy komponentów, których napisy zmieniasz (uruchamiaj po ścieżce pliku, nigdy całe `tests/unit` na raz) — ten dyżur NIE dotyka bazy danych, bloki (B)/(C) `§0.2c` NIE MAJĄ zastosowania w praktyce (zero testów realdb w zakresie); jeśli w trakcie pracy natrafisz na test i18n wymagający realnej bazy, to jest poza zakresem — opisz i zostaw --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day317-jezyk-pl-artefakty/day317-jezyk-pl.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day317-jezyk-pl && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `node scripts/dev/i18n-pl-audyt.mjs` (bez DB, czysto plikowy) oraz punktowo testy komponentów, których napisy zmieniasz (uruchamiaj po ścieżce pliku, nigdy całe `tests/unit` na raz) — ten dyżur NIE dotyka bazy danych, bloki (B)/(C) `§0.2c` NIE MAJĄ zastosowania w praktyce (zero testów realdb w zakresie); jeśli w trakcie pracy natrafisz na test i18n wymagający realnej bazy, to jest poza zakresem — opisz i zostaw --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day317-jezyk-pl-artefakty/day317-jezyk-pl.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day317-jezyk-pl/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day317-pg psql -U postgres -d cx317 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day317-pg`.
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
> **(e) `tests/setup.ts` podmienia CAŁY `react-i18next` atrapą, w której `t(klucz, 'domyślne')` zwraca wartość domyślną zapisaną w KODZIE komponentu, nie wartość ze słownika — test „polskich napisów” bez `vi.mock('react-i18next', importActual)` przechodzi nawet przy PUSTYM `pl/translation.json`. Dotyczy KAŻDEGO testu, który asertuje treść PL w komponencie**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day317-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day317-jezyk-pl-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj REJESTR_JEZYK_PL_20260903.md i evidence/grafika/i18n-pl-en-20260903.md w całości) · R1 (rozbuduj `i18n-pl-audyt.mjs` o klasyfikację semantyczną 631 identycznych: UZASADNIONE vs DEFEKT-PL, z realną listą stop-słów, nie zgadywaniem) · R2 (napraw wszystkie DEFEKT-PL z odczytem kontekstu wołacza, commit per rodzina) · R3 (rozbuduj skrypt o detekcję DEFEKT-EN — polski tekst w pliku EN — i napraw znalezione 13, z parytetem odwrotnym: EN musi mieć angielską wartość) · R4 (bezpiecznik regresji: test, który czerwieni się, gdy liczba liści maleje ALBO liczba DEFEKT rośnie ponad nową linię bazową) · R5 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6333` albo `5473` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6333` albo `5473`** (`Z7`).

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

Dyżur 308 zbudował mianownik uczciwie: 631 kluczy, gdzie wartość polska jest znak w znak
angielska (powyżej 3 znaków), i skrypt `scripts/dev/i18n-pl-audyt.mjs`, który to liczy. Zamiast
zgadywać, które z nich są błędem, dyżur zatrzymał się na heurystyce listy stop-słów — decyzja
uczciwa, bo kontrprzykład „Tempo" (poprawny polski termin identyczny z angielskim) pokazuje, że
prosta reguła „różne znaczy defekt" by się myliła.

Klasyfikacja wykonana przy odbiorze 04.09 poszła dalej: z 631 identycznych **tylko ok. 119
(19%)** to realne defekty wymagające tłumaczenia. Rozkład:

- **512 UZASADNIONYCH** — identyczność poprawna z przyczyny: „Status" (114 kluczy — sama ta
  jedna rodzina to prawie jedna piąta całego mianownika), Format, System, Plan, Problem, Menu,
  Folder, marki (Slack, Excel, Jira), nazwy fontów, skróty branżowe (WACC, EBITDA, MoSCoW),
  placeholdery, strefy czasu, jednostki;
- **106 DEFEKT-PL** — ok. 62 różne napisy do przetłumaczenia: Owner, Workflow, Assessment,
  Insight, Dashboard, Baseline, Framework, Governance, Inbox, Attachments, Reminders, Interview,
  Initiative i dalsze z tej samej rodziny (rzeczowniki interfejsu, które ktoś zostawił po
  angielsku zamiast przetłumaczyć);
- ★ **13 DEFEKT-EN** — rodzina, której instrukcja 308 NIE PRZEWIDZIAŁA i której obecny skrypt
  w ogóle nie liczy: polskie napisy wewnątrz pliku ANGIELSKIEGO. Przykłady zweryfikowane osobiście
  na dzisiejszym markerze: `"scope": "Zakres"`, `"moduleLabel": "Prezentacje"`,
  `"templateNameRequired": "Nazwa szablonu jest wymagana"`, `"askAI": "Zapytaj AI"` — wszystkie
  cztery istnieją dziś w `public/locales/en/translation.json` pod wskazanymi kluczami.

10 z 12 próbkowanych kluczy-defektów ma realnego wołacza w `src/` — to jest dług widoczny
użytkownikowi na ekranie, nie martwy klucz.

**Skrypt dzisiaj policzyłby 578 defektów** (wszystko, co nie trafia w wąską listę 17 stop-słów
`exact` plus kilka wzorców regex) — to jest **zawyżenie ~5×** względem realnych 106. Twoim
zadaniem NIE jest przepisanie 578 wartości. Jest nim dokończenie klasyfikacji semantycznej,
plik po pliku, z odczytem kontekstu wołacza — i osobno, zmierzenie oraz naprawienie rodziny
DEFEKT-EN, która dotąd nie miała żadnego pomiaru.

## ★ Zmierz moje liczby sam

Twierdzę: liście `pl` ok. 34-35 tysięcy, `en` ok. 32-33 tysięcy (mój pomiar 04.09: PL=34310,
EN=32321 — zlecenie z innego pomiaru tego samego dnia podaje 35183/33050; **plik zmienia się
z każdym commitem równoległych dyżurów, licz na SWOIM markerze**); identycznych >3 znaki: 631;
„Status" wśród nich: 114; DEFEKT-PL: rzędu 106 (62 różne napisy); DEFEKT-EN: rzędu 13.
**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**,
> a Twoim produktem jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `public/locales/pl/translation.json` | **★ PEŁNA LICENCJA na WARTOŚCI istniejących kluczy zaklasyfikowanych DEFEKT-PL** + dopisywanie brakujących kluczy. **ZAKAZ kasowania kluczy i ZAKAZ zmiany kluczy zaklasyfikowanych UZASADNIONE** | — |
| `public/locales/en/translation.json` | **★ PEŁNA LICENCJA na WARTOŚCI kluczy zaklasyfikowanych DEFEKT-EN** + dopisywanie brakujących kluczy (parytet z PL w tym samym commicie). **ZAKAZ kasowania kluczy** | — |
| `scripts/dev/i18n-pl-audyt.mjs` | **★ PEŁNA LICENCJA** — rozbudowa o klasyfikację semantyczną i detekcję DEFEKT-EN. Zachowujesz istniejący eksport `flatten`/`justification`/`audit`/`render`/`run` (kompatybilność wsteczna dla ewentualnych importów) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` | **PEŁNA LICENCJA, ale WYŁĄCZNIE jako wyjście generatora** — nie edytujesz ręcznie, tylko regenerujesz uruchamiając rozbudowany skrypt | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| `src/**` (odczyt kontekstu wołacza) | **TYLKO ODCZYT** — czytasz komponent, w którym klucz żyje, żeby ocenić długość napisu i miejsce. **ZAKAZ zmian w `src/**` poza ewentualnym testem regresji z pozycji R4** | Jeśli naprawa wymagałaby zmiany komponentu (np. przycisk za wąski na dłuższy polski napis), wpisujesz to jako `DO DECYZJI WŁAŚCICIELA` z kadrem PRZED/PO i NIE zmieniasz layoutu w tym dyżurze |
| `tests/**` (NOWE pliki), `src/**/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` — dla bezpiecznika regresji z R4 | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: atrapa `react-i18next` w `tests/setup.ts` podmienia `t()` na wartości domyślne z kodu — to jest znana pułapka (patrz `§0.2d`), nie coś do naprawienia tutaj |
| `server/src/**` | **TYLKO ODCZYT — poza zakresem** | Jeśli klucz jest zasilany z odpowiedzi serwera, wypisujesz plik:linia na liście w raporcie i idziesz dalej |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY317_JEZYK_PL_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt rejestru 308 i evidence 03.09 w całości | TAK | NIE — czysty odczyt | bazowe | Przeczytane oba pliki, zanotowane w raporcie | `wc -l docs/…/REJESTR_JEZYK_PL_20260903.md evidence/grafika/i18n-pl-en-20260903.md` | brak (bez zmian) |
| R1 | Klasyfikacja semantyczna 631 (UZASADNIONE/DEFEKT-PL) w skrypcie | TAK | NIE — dowód: `git grep -n 'justification' scripts/dev/i18n-pl-audyt.mjs` | 1 nowy test jednostkowy skryptu | Skrypt klasyfikuje wszystkie 631 wierszy bez ręcznej listy „na twardo" per klucz — reguła generalna (rzeczownik interfejsu z zamkniętej listy ról/pojęć) | `node scripts/dev/i18n-pl-audyt.mjs` → policz DEFEKT w JSON-ie, porównaj z ręczną próbką 20 wierszy | `feat(i18n): klasyfikacja semantyczna 631 identycznych PL/EN (317 R1)` |
| R2 | Naprawa wszystkich DEFEKT-PL z kontekstem | NIE | NIE | n/d (dane, nie kod produkcyjny) | Każdy klucz zaklasyfikowany DEFEKT-PL ma nową wartość PL, przeczytany wołacz w `src/`, liczba liści PL nie spadła | `diff <(jq -S . public/locales/pl/translation.json) …` PRZED/PO — liczba kluczy identyczna lub większa | commit per rodzina tematyczna (np. `fix(i18n): tłumaczy rodzinę Owner/Workflow/Governance (317 R2)`) |
| R3 | Detekcja i naprawa DEFEKT-EN | TAK | NIE | 1 nowy test | Skrypt wykrywa polskie napisy w pliku EN (heurystyka słownikowa, nie tylko diakrytyki — patrz `§0.4` pułapka), wszystkie znalezione mają teraz angielską wartość | `node scripts/dev/i18n-pl-audyt.mjs` → nowe pole `defektEn` w JSON, lista pusta po naprawie | `fix(i18n): 13 polskich napisów w pliku EN (317 R3)` |
| R4 | Bezpiecznik regresji | NIE | NIE | 1 nowy test z podłogą/sufitem | Test czerwienieje, gdy liczba liści PL lub EN **maleje**, albo liczba DEFEKT-PL/DEFEKT-EN **rośnie** ponad nową linię bazową po R2/R3 | `npx vitest run tests/unit/config/i18nParity.test.ts --retry=0` (nowy plik) | `test(i18n): bezpiecznik parytetu liści i klasy DEFEKT (317 R4)` |
| R5 | Raport | NIE | NIE | n/d | Struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `docs(day317): raport jezyk PL` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi „NIE".** Żadna pozycja tego dyżuru nie odpowiada „TAK" — cały zakres mieści się
> w plikach z pełną licencją powyżej.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Liście `pl/translation.json` | 34310 (mój pomiar 04.09; zlecenie: 35183) | `node -e "…pl.size…"` z `§0.1` weryfikacji (1) | TAK — czyta cały plik rekurencyjnie |
| 2 | Liście `en/translation.json` | 32321 (mój pomiar 04.09; zlecenie: 33050) | jak wyżej, `en.size` | TAK |
| 3 | Identyczne PL=EN, >3 znaki | 631 | `node scripts/dev/i18n-pl-audyt.mjs` → pole `identical` | TAK — porównuje każdy klucz obecny w obu plikach |
| 4 | Z tego: rodzina „Status" | 114 | weryfikacja (3) w `§0.1` | TAK — filtruje dokładnie po wartości `Status` |
| 5 | DEFEKT-PL (realne) | ~106 (62 różne napisy) | ręczna klasyfikacja R1, potwierdzona próbką z weryfikacji (4) | TAK, po rozbudowie skryptu w R1 |
| 6 | DEFEKT-EN | ~13 | R3, potwierdzone czterema greppami z weryfikacji (5) | TAK dla próbki; pełna lista wymaga R3 |
| 7 | PL bez EN (osierocone w drugą stronę) | 2005 | `node scripts/dev/i18n-pl-audyt.mjs` → pole `plOnly` | TAK — poza zakresem naprawy tego dyżuru, tylko odnotuj |

**Reguła kontrolna:** każdy wiersz masz obowiązek uruchomić na swoim markerze przed wydaniem
raportu. Rozbieżność z liczbą w tej tabeli nie jest błędem — jest wynikiem; zapisujesz go.

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `public/locales/pl/translation.json` | istniejący | R2 | ★★ WYSOKIE — plik dzielony ze WSZYSTKIMI dyżurami tej paczki i wcześniejszych (293, 296 itd. też mogą dopisywać klucze); commituj często, małymi krokami, `git pull --rebase` jest zakazany (`Z3`) — zamiast tego rozwiązujesz konflikt merge ręcznie przy scaleniu przez nadzorcę |
| 2 | `public/locales/en/translation.json` | istniejący | R3 | ★★ WYSOKIE, jak wyżej |
| 3 | `scripts/dev/i18n-pl-audyt.mjs` | istniejący | R1, R3 | ŚREDNIE — plik własny dyżuru 308, mało prawdopodobne żeby ktoś inny go dziś dotykał |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` | istniejący (generowany) | R1, R3 | ZEROWE — regenerujesz z własnego skryptu |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md` | NOWY | R3 | ZEROWE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY317_JEZYK_PL_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `tests/unit/config/i18nParity.test.ts` (NOWY) | R4 | Tylko jeśli R1-R3 zakończone i masz nową linię bazową do zaszycia |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/** — cała rodzina backendu, poza zakresem
src/** poza tests/__tests__ nowych plików — żadnego komponentu nie przepisujesz
scripts/dev/testy-puste-skan.mjs, scripts/dev/reachability-from-root.mjs — dyżury 318/322
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6333 | `lsof -nP -iTCP:6333 -sTCP:LISTEN` → puste (nie jest używany — dyżur i tak nie odpala bazy) |
| Port harnessu | 5473 | `lsof -nP -iTCP:5473 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day317-pg` | `docker ps --format '{{.Names}}'` → brak (nieużywany w praktyce) |
| Nazwa bazy | `cx317` | n/d — dyżur nie tworzy bazy |
| Gałąź | `codex/day317-jezyk-pl-20260904` | nie istnieje na `github-backup` (sprawdź `git ls-remote`) |
| Worktree | `/private/tmp/cx-day317-jezyk-pl` | nie istnieje |
| Flagi funkcyjne | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day317-jezyk-pl
git diff --name-only --cached | tee /private/tmp/cx-day317-jezyk-pl-artefakty/staged.txt
grep -iE 'server/src/|scripts/dev/testy-puste-skan|scripts/dev/reachability-from-root' /private/tmp/cx-day317-jezyk-pl-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## §0.4 — pułapka DEFEKT-EN: diakrytyki NIE WYSTARCZĄ

Pierwszy odruch — szukać polskich znaków (ą,ć,ę,ł,ń,ó,ś,ź,ż) w pliku EN — łapie tylko 2 fałszywe
trafienia (nazwiska własne: „Dr. Piotr Wiśniewski", „Paweł Bochniarz") i **przepuszcza wszystkie
cztery przykłady z tytułu tej instrukcji** — „Zakres", „Prezentacje", „Nazwa szablonu jest
wymagana", „Zapytaj AI" nie mają ani jednej litery z ogonkiem. Heurystyka musi być **słownikowa**:
lista częstych polskich słów/końcówek („jest", „nie", „wymagana", "wymagane", "zakres", "zapytaj",
"proszę", "błąd", "ustawienia", odmiany przez przypadki charakterystyczne dla polskiego) plus
**ręczne potwierdzenie każdego trafienia** — heurystyka słownikowa też da fałszywe alarmy
(np. angielskie słowo przypadkiem zawierające polski rdzeń). Nie automatyzuj naprawy: każde
trafienie czytasz i albo tłumaczysz na EN, albo odrzucasz jako fałszywy alarm z uzasadnieniem
w rejestrze.

---

## R0 — ODCZYT

Przeczytaj `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_JEZYK_PL_20260903.md` i
`evidence/grafika/i18n-pl-en-20260903.md` w całości. Zmierz mianowniki z tabeli `B.3` na swoim
markerze.

Prawo zatrzymania po tej pozycji.

## R1 — KLASYFIKACJA SEMANTYCZNA 631

Rozbuduj `justification()` w `scripts/dev/i18n-pl-audyt.mjs` tak, żeby rozstrzygała **regułą
generalną**, nie listą 631 pojedynczych kluczy na twardo: rozpoznaj kategorie UZASADNIONE
(rzeczowniki-etykiety statusu/formatu/systemu, marki, skróty branżowe, jednostki, placeholdery,
strefy czasu — rozszerz istniejącą mapę `exact` i wzorce regex) i zostaw wszystko inne jako
kandydata DEFEKT-PL do ręcznego przeglądu. Wynik: nowe pole w JSON-ie wyjściowym rozróżniające
`UZASADNIONE`/`DEFEKT-PL`, z liczbami bliskimi 512/106 — **Twój pomiar rozstrzyga, nie te
liczby**. Dodaj test jednostkowy sprawdzający, że znane przykłady (Status→UZASADNIONE,
Owner→DEFEKT-PL, Tempo→UZASADNIONE) klasyfikują się poprawnie.

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA DEFEKT-PL

Dla każdego klucza zaklasyfikowanego DEFEKT-PL: `grep -rn "t('<klucz>'" src/` (albo
`t("<klucz>"`, zależnie od cudzysłowu), przeczytaj komponent, oceń długość dostępnego miejsca,
wpisz polskie tłumaczenie, które NIE jest kalką z angielskiego. Commit per rodzina tematyczna
(np. rodzina „Owner/Workflow/Governance" jednym commitem, rodzina „Insight/Dashboard/Baseline"
kolejnym) — nie jeden gigantyczny commit na 106 kluczy. Zmierz liczbę liści PL przed i po każdym
commicie — nie może spaść.

Jeśli klucz nie ma żadnego wołacza w `src/` (osierocony), wpisz go do raportu jako „defekt bez
wołacza" i przetłumacz mimo to (dane słownika mają być poprawne niezależnie od tego, czy dziś są
używane) — ale NIE licz go do „widocznego dla użytkownika długu".

Prawo zatrzymania po tej pozycji.

## R3 — DETEKCJA I NAPRAWA DEFEKT-EN

Dodaj do skryptu wykrywanie polskich napisów w `en/translation.json` metodą słownikową opisaną
w `§0.4` powyżej. Uruchom, przejrzyj KAŻDE trafienie ręcznie, przetłumacz prawdziwe defekty na
angielski, odrzuć fałszywe alarmy z uzasadnieniem. Zapisz kompletną listę (nawet jeśli finalnie
mniejszą lub większą niż 13) do nowego `REJESTR_JEZYK_PL_DEFEKT_EN_20260904.md`.

Prawo zatrzymania po tej pozycji.

## R4 — BEZPIECZNIK REGRESJI

Nowy test w `tests/unit/config/i18nParity.test.ts`: uruchamia rozbudowany
`scripts/dev/i18n-pl-audyt.mjs`, zapisuje linię bazową (liście PL, liście EN, liczba DEFEKT-PL,
liczba DEFEKT-EN) **po Twoich naprawach z R2/R3**, i czerwienieje, gdy w przyszłości liście PL
lub EN **zmaleją** poniżej tej linii, albo liczba DEFEKT-PL/DEFEKT-EN **wzrośnie** powyżej niej.
Wzoruj podłogę/sufit na `tests/unit/config/noEmptyAssertions.test.ts` (`toBeGreaterThanOrEqual`
dla liści, `toBeLessThanOrEqual` dla defektów) — to jest już sprawdzony wzorzec w tym repo, nie
projektujesz go od nowa.

Prawo zatrzymania po tej pozycji.

## R5 — RAPORT

Co domknięte, co nie, finalne liczby (liście PL/EN, DEFEKT-PL naprawione, DEFEKT-EN naprawione),
lista kluczy odrzuconych jako fałszywe alarmy z uzasadnieniem, TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 i R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte" jest
pełnowartościowym wynikiem, o ile liczba liści nie spadła i żaden commit nie jest niekompletny.

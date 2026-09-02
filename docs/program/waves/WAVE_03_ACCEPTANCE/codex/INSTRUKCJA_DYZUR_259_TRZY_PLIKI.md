# INSTRUKCJA DYŻURU nr 259 — Codex — „★★★ NAJWAŻNIEJSZY DYŻUR TEJ PACZKI. ★ Największa obawa właściciela w całym produkcie: nigdy nie powstał ani jeden naprawdę dobry dokument z szablonu. Pomiar 1.09 (`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`) przeprowadził pełny realny przebieg (Postgres od zera, realny `Gateway`, realna rejestracja, podpisany token, realne trasy) — ale **bez klucza do modelu językowego**: dokument (432 słowa, 0 zdań z konkretem, eksport zablokowany przez bramkę, wydany dopiero po świadomym obejściu) i prezentacja (12 slajdów, fałszywe „0 inicjatyw i 0 ryzyk” na slajdzie 10 mimo dwóch źródeł z realnymi danymi, mimo to 99/100 i eksport przepuszczony) **NIE BYŁY ocenione — oceniano ich awaryjne zastępniki po nieudanym wywołaniu LLM**. Arkusz (XLSX) DZIAŁAŁ już wtedy (100/100, silnik deterministyczny, bez zależności od modelu) — **to jest jedyny z trzech wyników, który już dziś jest wiążący**. **Dopóki nie powtórzymy przebiegu z kluczem, żadna ocena jakości dokumentu i prezentacji nie jest wiążąca — ani zła, ani przyszła dobra.** Ten dyżur wykonuje dokładnie tę powtórkę: trzy realne pliki pełną ścieżką produkcyjną z realnym, zasianym kontekstem organizacji i realnym kluczem, przeczytane jak przez człowieka (ile zdań niesie konkret, a ile jest wypełniaczem — obie liczby), z cytatami trzech najlepszych i trzech najgorszych fragmentów, i jednozdaniowym werdyktem „czy pokazałbym to klientowi” per plik. ★ Jeśli klucza do modelu nadal nie ma w środowisku wykonania — dyżur mówi to PIERWSZYM ZDANIEM raportu i ZATRZYMUJE SIĘ na `R0`, bez produkowania jakichkolwiek zastępników udających wynik."

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
> **wyłącznie** `/private/tmp/cx-day259-trzy-pliki`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — GENERATORY MATERIAŁÓW (moduł 10 w menu): dokument (`document-studio.routes.ts`), prezentacja (`presentations.routes.ts` + `presentationGeneratorService.ts`), arkusz (`workbook.routes.ts` + `WorkbookGeneratorService.ts`).** Powtórka pomiaru `DOWOD_TRZY_PLIKI_2026-09-01.md`, TYM RAZEM Z REALNYM KLUCZEM DO MODELU JĘZYKOWEGO — poprzedni pomiar (1.09) nie miał klucza, więc dokument i prezentacja NIE BYŁY ocenione, oceniano ich awaryjne zastępniki.**.
Trasy front: `brak w zakresie ZAPISU — dyżur woła trasy backendowe bezpośrednio przez HTTP (nie przez UI), ale ZANOTUJ w raporcie, którym ekranom frontu (jeśli istnieją) te trasy odpowiadają, żeby wynik dało się później odtworzyć z poziomu produktu, nie tylko skryptu`. Trasy tył: ``server/src/routes/document-studio.routes.ts` (`POST /generate`, linia 854; logika auto-groundingu 663-709) · `server/src/routes/presentations.routes.ts:105-106` (`generateDeck`, `generateOutline` z `presentationGeneratorService.ts`) · `server/src/services/presentationGeneratorService.ts` (w tym `deckConclusionSlide.ts:179-180,266,281-282,321-330` — znany defekt, patrz `Z40`) · `server/src/routes/workbook.routes.ts:1021-1077,1270-1281` (`WorkbookGeneratorService.generate`/`generateFromTemplate`) · `server/src/services/materialExportReceiptService.ts:109` (znany defekt trwałej blokady, patrz `Z40`) · `server/src/routes/document-studio.routes.ts:832` (znana kolizja klucza unikalnego, patrz `Z40`) · WSZYSTKO WYŁĄCZNIE DO WOŁANIA/ODCZYTU, zero zmian kodu`.

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
WT=/private/tmp/cx-day259-trzy-pliki
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day259-trzy-pliki-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day259-trzy-pliki/config.worktree"
cat "$VAULT/worktrees/cx-day259-trzy-pliki/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day259-trzy-pliki-scratch
mkdir -p /private/tmp/cx-day259-trzy-pliki-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day259-trzy-pliki-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ GATE — czy klucz do modelu jest DZIS dostepny w TWOIM srodowisku wykonania
# (nie w cudzej sesji, nie wczoraj — teraz, w tej powloce)
if [ -n "$ANTHROPIC_API_KEY" ]; then echo "ANTHROPIC_API_KEY: SET (dlugosc ${#ANTHROPIC_API_KEY})"; else echo "ANTHROPIC_API_KEY: BRAK"; fi
grep -n "ANTHROPIC_API_KEY\|OPENROUTER_API_KEY\|OPENAI_API_KEY" server/src/routes/ai.routes.ts | head -5
#   jesli BRAK i nie znajdziesz klucza w zadnej z trzech zmiennych powyzej —
#   STOP CALEGO DYZURU TUTAJ. Raport ma jedno zdanie: "Klucza do modelu jezykowego
#   nadal nie ma w srodowisku wykonania [data, host]." Nie idziesz dalej.

# (2) TEZA: tests/setup.ts globalnie podmienia fetch i mockuje SDK modeli —
#     dowod, ze NIE WOLNO uruchamiac generowania przez vitest
sed -n '858,900p' tests/setup.ts
grep -n "setupFiles" vitest.config.ts server/vitest.config.ts 2>/dev/null
#   oczekiwane: global.fetch jest nadpisany atrapa zwracajaca zawsze ok:true;
#   setupFiles wskazuje na tests/setup.ts dla (przynajmniej) frontowego configu

# (3) TEZA: trzy generatory maja realne, dzis istniejace trasy HTTP
sed -n '840,870p' server/src/routes/document-studio.routes.ts
sed -n '95,115p' server/src/routes/presentations.routes.ts
sed -n '1010,1030p' server/src/routes/workbook.routes.ts
#   oczekiwane: 'POST /generate' w document-studio, import generateDeck/generateOutline
#   w presentations, dynamiczny import WorkbookGeneratorService w workbook

# (4) TEZA: dokument generuje sie z auto-groundingiem z kontekstu wolajacego —
#     pusta organizacja da pusty/nieuczciwy dokument
sed -n '660,712p' server/src/routes/document-studio.routes.ts
#   przeczytaj i zanotuj: z jakich tabel/serwisow pochodzi "grounding" —
#   to determinuje, co musisz zasiac w R1

# (5) TEZA: trzy znane defekty z pomiaru 1.09 nadal sa w kodzie, niezmienione
sed -n '175,185p' server/src/services/presentationGeneratorService.ts 2>/dev/null || \
  find server/src/services -iname "deckConclusionSlide.ts" -exec sed -n '175,185p;260,285p;315,335p' {} \;
grep -n "materialExportReceiptService" server/src/services/materialExportReceiptService.ts | sed -n '1,5p'
sed -n '825,840p' server/src/routes/document-studio.routes.ts
#   oczekiwane: trzy defekty opisane w DOWOD_TRZY_PLIKI nadal widoczne w kodzie na
#   Twoim SHA — jesli ktorys zniknal, zanotuj w Korektach

# (6) TEZA: masz realna siec wychodzaca do dostawcy modelu z tego srodowiska
curl -s -o /dev/null -w "%{http_code}\n" --max-time 10 https://api.anthropic.com/v1/messages
#   oczekiwane: kod HTTP inny niz 000 (000 = brak polaczenia/DNS/firewall —
#   jesli 000, STOP i zapisz to jako blokujacy fakt srodowiska, nie probuj obejsc)

# (7) TEZA: rejestracja organizacji idzie przez realna trase, nie przez INSERT z pominieciem walidacji
grep -n "router.post('/register'" server/src/routes/auth.routes.ts
#   oczekiwane: trafienie — to jest Twoja jedyna dozwolona metoda zalozenia organizacji w R1

# (8) TEZA: istnieje juz wzorzec samodzielnego skryptu tsx omijajacego vitest
ls server/src/scripts/*RealDbProof.ts | head -5
sed -n '1,30p' server/src/scripts/a05ProposalGovernanceRealDbProof.ts
#   oczekiwane: co najmniej jeden istniejacy plik tego ksztaltu — Twoj nowy skrypt
#   R2 idzie obok, tym samym wzorcem (polaczenie z Pool bezposrednio, bez vitest)

# (9) TEZA: miejsce na dysku wystarcza (Postgres + trzy realne artefakty binarne)
df -h /
#   oczekiwane: powyzej 3 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day259-trzy-pliki-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6258`. Twój JEDYNY port harnessu to `5238 i 5239`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day259-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6220, 5010-5195, 6404-6411, 6600-6830. Twoje własne: baza 6258, harness 5238 i 5239. Cudze — siostrzane dyżury tej samej paczki, nie dotykasz: baza 6250 i harness 5230-5231 (dyżur 255), baza 6252 i harness 5232-5233 (dyżur 256), baza 6254 i harness 5234-5235 (dyżur 257), baza 6256 i harness 5236-5237 (dyżur 258). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje. Wyjątkowo dozwolone (bo już istniejące, nie nowe, i wymagane do pomiaru): dowolne flagi `default OFF` odsłaniające generatory w API, jeśli istnieją i są dziś wyłączone — wpisz je tu w raporcie po znalezieniu, włącz WYŁĄCZNIE query-param/nagłówkiem żądania, nigdy zmianą wartości domyślnej w kodzie.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY259_TRZY_PLIKI_REPORT.md`. Dozwolony dokładnie JEDEN nowy wpis (nie edycja istniejących wierszy) w `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` — nowa sekcja na końcu pliku „## Dzień 259 — powtórka z realnym kluczem”, ze zmierzonym wynikiem `R3` i pełnymi cytatami. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści (ta zostaje jako świadectwo pomiaru BEZ klucza — obie wersje mają wartość historyczną). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day259-trzy-pliki-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day259-trzy-pliki-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **JEDYNY, JAWNIE UDOKUMENTOWANY WYJĄTEK OD `Z15` W CAŁYM PROGRAMIE — patrz `§0.0` na początku ciała instrukcji, PRZECZYTAJ PRZED STARTEM.** Poza tym jednym, wąsko zakreślonym wyjątkiem (trzy wywołania generatorów w `R3`) `Z15` obowiązuje jak zawsze: żaden INNY pomiar, strażnik ani ekran w tym dyżurze nie woła modelu. **ZAKAZ produkowania „zastępników udających wynik”** — jeśli `R0` (klucz) albo `R1` (środowisko bez pułapki mocka, bez sieci do dostawcy) nie przejdzie, dyżur KOŃCZY SIĘ na tym kroku z jawnym STOP, nie próbuje dokończyć czegokolwiek namiastką. **ZAKAZ oceniania jakości szablonów rubryką** (poza zakresem — to krok 4 z „Co robimy dalej” w `DOWOD_TRZY_PLIKI_2026-09-01.md`, następny dyżur). **ZAKAZ naprawiania** czterech znanych defektów (synteza slajdu, trwała blokada eksportu, kolizja klucza, niespójność bramek) — zgłaszasz ponownie zmierzony stan, nie naprawiasz. | Pomiar 1.09 odkrył, że przyczyną źródłową słabej oceny dokumentu i prezentacji był brak klucza do modelu językowego w środowisku pomiaru — nie jakość silnika. To unieważnia część dotychczasowych wniosków o „słabych generatorach”: dwa z trzech generatorów nigdy nie zostały naprawdę ocenione, oceniano ich awaryjne zastępniki po nieudanym wywołaniu LLM. Jednocześnie ten sam pomiar jest dowodem, że kod jest prawdziwy, nie atrapą — atrapa by „zadziałała” bez klucza, tu poprawnie się wysypała. Właściciel nie może podjąć żadnej decyzji o jakości szablonów, bramkach jakości ani kolejności napraw (deckConclusionSlide, niespójność bramek między formatami), dopóki nie zobaczy WYNIKU Z REALNYM MODELEM. To jest największa, imiennie nazwana obawa właściciela w całym produkcie — stąd priorytet ★★★ i wymóg zatrzymania się na pierwszym zdaniu raportu, jeśli warunek wejścia (klucz) nie jest spełniony. |

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
cd /private/tmp/cx-day259-trzy-pliki

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day259-pg psql -U postgres -d cx259 \
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
cd /private/tmp/cx-day259-trzy-pliki

docker run -d --name cx-day259-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx259 \
  -p 127.0.0.1:6258:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day259-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6258/cx259 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6258/cx259 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day259-trzy-pliki && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6258/cx259 \
JWT_SECRET=cx259-test-secret-do-not-reuse \
npx vitest run brak — ten dyżur nie tworzy testów `vitest`; dowód idzie przez samodzielny skrypt `tsx`, NIGDY przez `npx vitest run` (patrz `PULAPKA`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day259-trzy-pliki-artefakty/day259-realny-klucz.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day259-trzy-pliki && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak — ten dyżur nie tworzy testów `vitest`; dowód idzie przez samodzielny skrypt `tsx`, NIGDY przez `npx vitest run` (patrz `PULAPKA`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day259-trzy-pliki-artefakty/day259-realny-klucz.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day259-trzy-pliki/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day259-pg psql -U postgres -d cx259 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day259-pg`.
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
> **(e) ★★★ `tests/setup.ts:858-892` globalnie mockuje `@google/generative-ai` i `openai`, a `tests/setup.ts:894-896` globalnie podmienia `global.fetch` tak, że KAŻDE żądanie sieciowe zwraca fałszywe `{ok:true, status:200, json:()=>({data:[]})}` — **niezależnie od tego, czy klucz jest prawdziwy**. Ten mock ładuje się dla KAŻDEGO uruchomienia przez `vitest` (plik jest w `setupFiles` configu). **Jeżeli uruchomisz generowanie trzech plików przez `vitest`, dostaniesz fałszywy „sukces” nawet z prawdziwym kluczem — rozmawiasz z atrapą, nie z modelem, i cały dyżur jest bez wartości.** Dlatego `R2`/`R3` tego dyżuru MUSZĄ używać samodzielnego skryptu `tsx` uruchamianego BEZPOŚREDNIO (`npx tsx server/src/scripts/day259-trzy-pliki-realny-klucz.ts`), NIGDY przez `npx vitest run` — wzorem istniejących `server/src/scripts/*RealDbProof.ts` (np. `a05ProposalGovernanceRealDbProof.ts`), rozszerzonym o pełne `ApiGateway.getInstance().initializeRoutes(app)` + `app.listen(TWOJ_PORT_HARNESSU)` (`Z22`) i realne żądania `fetch`/`http` do własnego, lokalnie nasłuchującego serwera — nie do `express()` z wstrzykniętymi zależnościami. Druga pułapka: pusta baza da pusty, nieuczciwy dokument — `R1` wymaga ZASIANIA realnej wiedzy organizacji (nie samej rejestracji pustej organizacji) przez legalne ścieżki produktowe, analogicznie do pomiaru 1.09, który miał „dwa dostarczone źródła z realnymi inicjatywami” (patrz znany defekt syntezy w `Z40`).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day259-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day259-trzy-pliki-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (gate: klucz LLM + pułapka mocka — warunek wejścia, STOP jeśli nie przejdzie) · R1 (środowisko: baza, migracje, org, zasiana wiedza) · R2 (skrypt dowodowy poza vitest, pozytywna kontrola sieci przed właściwym wywołaniem) · R3 (trzy realne pliki + odczyt jak człowiek: konkret vs wypełniacz, cytaty, werdykt) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6258` albo `5238 i 5239` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6258` albo `5238 i 5239`** (`Z7`).

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

# 0. ★★★ PRZECZYTAJ PRZED CZYMKOLWIEK INNYM — WYJĄTEK OD `Z15`

`Z15` w części A tej instrukcji (tabela reguł, obowiązuje w KAŻDYM dyżurze tego programu) mówi:
**„Zero modelu językowego w tym dyżurze. Żaden pomiar, strażnik ani ekran nie woła `llmService`,
`/api/ai/**` ani `GoogleGenerativeAI`.”** To jest słuszna, twarda reguła w 258 innych dyżurach —
chroni pomiary bezpieczeństwa i mechaniki przed zależnością od sieci i od modelu.

**Ten dyżur jest jedynym w całym programie, którego cel wymaga jej złamania — świadomie,
jawnie i wąsko.** Cel dyżuru 259 NIE JEST możliwy do osiągnięcia bez wywołania realnego modelu:
pomiar z 1.09 (`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`) ustalił, że bez klucza do
modelu dokument i prezentacja nie były w ogóle oceniane — oceniano ich awaryjne zastępniki.
Powtórka tego pomiaru jest sensowna tylko z realnym wywołaniem.

**Zakres wyjątku — dokładnie i wyłącznie to, nic więcej:**
- Trzy (a przy defektach z `§5` — cztery-pięć, patrz `R3`) wywołania generatorów treści
  (dokument, prezentacja, arkusz) w `R3`, przez realne trasy produkcyjne, z realnym kluczem.
- **Nic poza tym.** `R0`, `R1`, `R2` NIE wołają modelu. Żaden strażnik, żadna asercja
  bezpieczeństwa w tym dyżurze nie zależy od odpowiedzi modelu. Jeśli w trakcie pracy
  zauważysz, że jakikolwiek INNY fragment Twojej pracy zaczyna zależeć od LLM poza tymi
  trzema wywołaniami — to jest naruszenie `Z15` i STOP tego fragmentu, nie kontynuacja.

Jeżeli warunek wejścia z `R0` (realny klucz w Twoim środowisku wykonania) nie jest spełniony —
**wyjątek nie ma zastosowania, `Z15` obowiązuje w pełni, i cały dyżur kończy się na `R0`** z
jednozdaniowym raportem. Nie produkujesz żadnego zastępnika udającego wynik.

---

# 1. PO CO TEN DYŻUR ISTNIEJE

★ **Największa obawa właściciela w całym produkcie: nigdy nie powstał ani jeden naprawdę
dobry dokument z szablonu.** Do dziś mieliśmy o tym twierdzenia i jeden niewiążący pomiar.

Pomiar 1.09 (`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`) przeprowadził pełny,
realny przebieg: Postgres od zera, realny `Gateway`, realna rejestracja organizacji, podpisany
token, realne trasy produkcyjne. **Nie test — przebieg.** Wynik:

| Format | Wynik pomiaru 1.09 | Ocena własnej bramki | Zależność od LLM |
| --- | --- | --- | --- |
| Arkusz (XLSX) | **DZIAŁA** — formuły realne, przeliczone niezależnie (kapitał ≈ 53,7 mln, ≈ 107,47/akcję — zgodne) | 100/100, zero uwag | **BRAK** — silnik deterministyczny |
| Dokument (DOCX) | 432 słowa, zdań z konkretem: 0, wypełniaczy: 18, angielskie etykiety, wyciek znacznika systemowego do treści klienckiej | eksport **ZABLOKOWANY**, wydany dopiero po świadomym obejściu | zależny od LLM |
| Prezentacja (PPTX) | 12 slajdów, 533 słowa, ani jeden zaszczepiony fakt na slajdzie, slajd 10 twierdzi „portfel 0 inicjatyw i 0 ryzyk” mimo dwóch źródeł z realnymi inicjatywami | **99/100, eksport PRZEPUSZCZONY** mimo jawnie fałszywego zdania | zależny od LLM |

★★ **Przyczyna źródłowa, odkryta tym samym pomiarem: w środowisku pomiaru NIE BYŁO klucza do
żadnego modelu językowego.** Logi pokazują realne, nieudane wywołania: brak klucza → pięć
błędów → bezpiecznik się otwiera → „brak dostępnego modelu”. To jest jednocześnie dowód, że
pomiar rozmawiał z prawdziwym kodem, nie z atrapą — atrapa by „zadziałała”.

> **Wniosek do czytania dosłownie: dokument i prezentacja NIE BYŁY oceniane. Były oceniane ich
> awaryjne zastępniki. Dopóki nie powtórzymy przebiegu z kluczem, żadna ocena jakości nie jest
> wiążąca — ani ta zła z 1.09, ani przyszła dobra.**

Arkusz jest wyjątkiem: jego silnik jest deterministyczny i nie zależy od modelu, więc jego wynik
**już dziś jest wiążący** — i jest ważnym dowodem osobnym: produkt POTRAFI wyprodukować dobry
artefakt, kiedy nie zależy od LLM. Problem nie leży w składaniu plików.

## Cztery defekty zgłoszone 1.09, świadomie NIE naprawione — sprawdź, czy nadal żyją

1. `deckConclusionSlide.ts:179-180,266,281-282,321-330` — synteza slajdu podsumowania ignoruje
   źródła tekstowe, produkuje fałszywe „0 inicjatyw i 0 ryzyk”.
2. `materialExportReceiptService.ts:109` — eksport po pierwszym niepowodzeniu **trwale**
   blokuje ten sam artefakt; trzeba założyć nowy, żeby w ogóle dostać plik. **To ma bezpośrednie
   znaczenie operacyjne dla `R3` tego dyżuru** — jeśli pierwsza próba generacji padnie z
   dowolnego powodu (nawet niezwiązanego z modelem), NIE ponawiaj na tym samym artefakcie:
   załóż nowy, zanotuj że natrafiłeś na ten defekt.
3. `document-studio.routes.ts:832` — realna kolizja klucza unikalnego przy rejestracji
   artefaktu; ponowienie maskuje to w logu, pierwsza próba pada.
4. Niespójność bramek jakości między formatami (dokument zablokowany, prezentacja z fałszywym
   zdaniem przepuszczona 99/100) — dług architektoniczny, nie naprawiasz, tylko potwierdzasz
   czy nadal istnieje.

## Czego ten dyżur świadomie NIE robi

- **Nie ocenia jakości szablonów formalną rubryką.** To krok 4 z „Co robimy dalej” w
  `DOWOD_TRZY_PLIKI_2026-09-01.md` — następny dyżur, po tym pomiarze.
- **Nie naprawia żadnego z czterech znanych defektów.** Zgłaszasz ponownie zmierzony stan.
- **Nie próbuje obejść braku klucza żadnym zastępnikiem.** Jeśli klucza nie ma — `R0` zatrzymuje
  cały dyżur, punkt.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Realny klucz do modelu językowego jest dostępny w Twoim środowisku wykonania DZIŚ | komenda (1) |
| T2 | `tests/setup.ts` globalnie mockuje `fetch`/SDK modeli — generowania NIE WOLNO uruchamiać przez `vitest` | komenda (2) |
| T3 | Trzy generatory (dokument/prezentacja/arkusz) mają dziś realne, żywe trasy HTTP | komenda (3) |
| T4 | Dokument generuje się z auto-groundingiem z kontekstu wołającej organizacji — pusta organizacja da nieuczciwy pomiar | komenda (4) |
| T5 | Cztery znane defekty z pomiaru 1.09 nadal są w kodzie, niezmienione | komenda (5) |
| T6 | Środowisko wykonania ma realną sieć wychodzącą do dostawcy modelu | komenda (6) |
| T7 | Rejestracja organizacji idzie przez realną trasę produkcyjną, nie przez INSERT z pominięciem walidacji | komenda (7) |
| T8 | Istnieje już w repo wzorzec samodzielnego skryptu `tsx` omijającego `vitest` (`*RealDbProof.ts`) | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R0 — ★★★ GATE: KLUCZ + PUŁAPKA MOCKA (warunek wejścia, twardy STOP)

Wykonaj komendy (1), (2) i (6) z `§0.1` **jako pierwsze, przed jakąkolwiek inną pracą**.

- **Jeśli komenda (1) pokaże brak klucza** (`ANTHROPIC_API_KEY` puste, i brak
  `OPENROUTER_API_KEY`/`OPENAI_API_KEY` jako alternatywy — sprawdź oba w
  `server/src/routes/ai.routes.ts:357-381`) — **zatrzymujesz cały dyżur tutaj.** Raport ma
  dokładnie jedno zdanie jako pierwsze zdanie: *„Klucza do modelu językowego nadal nie ma w
  środowisku wykonania [data, host/worktree].”* Nie tworzysz worktree z bazą, nie migrujesz
  niczego, nie próbujesz żadnego zastępnika. `R1`-`R3` nie są wykonywane.
- **Jeśli komenda (6) pokaże brak sieci wychodzącej** (kod `000` albo timeout do
  `api.anthropic.com`, i analogicznie do pozostałych dostawców, jeśli używasz alternatywnego
  klucza) — to jest równoważny STOP, z tym samym traktowaniem: jedno zdanie w raporcie, zero
  dalszej pracy. Nie próbujesz proxy, VPN ani obejścia sandboksa wykonania.
- **Jeśli obie przechodzą** — kontynuujesz do `R1`, ale **dopiero po zapisaniu w raporcie
  dosłownie**: *„Klucz do modelu jest obecny (długość N znaków, zmienna X). Sieć wychodząca do
  dostawcy odpowiada kodem HTTP Y. Kontynuuję do R1.”*

Wykonaj też komendę (2) — to jest dowód, dlaczego `R2`/`R3` MUSZĄ ominąć `vitest` (patrz
`PULAPKA` w części A i `R2` poniżej). Zapisz w raporcie treść nadpisania `global.fetch` z
`tests/setup.ts` dosłownie, jako ostrzeżenie dla każdego, kto później spróbuje odtworzyć ten
pomiar przez test.

## R1 — ŚRODOWISKO: BAZA, MIGRACJE, ORGANIZACJA, ZASIANA WIEDZA (rdzeń)

1. Kontener Postgres + pełne migracje na `6258`/`cx259`, dwa przebiegi (idempotencja)
   — standardowy blok `§0.2c` (A).
2. **Zarejestruj JEDNĄ realną organizację przez `POST /api/auth/register`** (komenda (7) w
   `§0.1` daje Ci dokładną trasę) — nie przez bezpośredni `INSERT`. Podpisany JWT z realnego
   logowania, nie z ręcznie sklejonego tokenu.
3. **Zasiej realną wiedzę organizacji przez legalne ścieżki produktowe** — NIE pustą
   organizację (pusta baza da pusty, nieuczciwy dokument — to nie byłby uczciwy pomiar).
   Komenda (4) z `§0.1` pokazuje Ci, z jakich tabel/serwisów auto-grounding
   (`document-studio.routes.ts:663-709`) faktycznie czyta — podążaj za tym śladem (typowo:
   inicjatywy, ryzyka, decyzje albo wpisy bazy wiedzy powiązane z organizacją) i utwórz
   **co najmniej dwa źródła z realnymi, konkretnymi faktami** (nazwy, liczby, terminy,
   odpowiedzialni) — analogicznie do pomiaru 1.09, który miał „dwa dostarczone źródła z
   realnymi inicjatywami” (patrz defekt #1 w `§1` — to jest ten sam materiał wejściowy, który
   ujawnił błąd syntezy). Zapisz w raporcie DOKŁADNIE co zasiałeś: liczby, nazwy, przez którą
   trasę/serwis, z `plik:linia` handlera który przyjął zapis.
4. Zapisz w raporcie pełne dane wejściowe (nazwa organizacji, treść zasianych źródeł) — bez
   tego nikt nie odtworzy tego pomiaru ani nie oceni, czy 0/N zdań z konkretem w wyniku było
   fair wobec materiału wejściowego.

## R2 — SKRYPT DOWODOWY POZA `VITEST` + KONTROLA POZYTYWNA (rdzeń)

★★★ **Generowania NIE WOLNO uruchamiać przez `npx vitest run`** — `tests/setup.ts` globalnie
mockuje `fetch`, `@google/generative-ai` i `openai`; nawet z realnym kluczem dostałbyś fałszywy
„sukces” z atrapy. Napisz **nowy, samodzielny skrypt** `server/src/scripts/day259-trzy-pliki-realny-klucz.ts`,
uruchamiany bezpośrednio (`npx tsx server/src/scripts/day259-trzy-pliki-realny-klucz.ts`),
wzorem istniejących `server/src/scripts/*RealDbProof.ts` (komenda (8) w `§0.1` pokazuje Ci
istniejący przykład), rozszerzony o:

1. Połączenie do Twojego Postgresa (`Pool` z `pg`, jak w istniejącym wzorcu).
2. **Pełny `ApiGateway.getInstance().initializeRoutes(app)`** (`Z22` — nie goły `express()` z
   wstrzykniętymi zależnościami) + `app.listen(5238 i 5239)`.
3. Realne żądania `fetch`/`http` z tego samego procesu do `http://127.0.0.1:5238 i 5239`
   — logowanie, potem trzy wywołania generatorów.

**Kontrola pozytywna OBOWIĄZKOWA przed właściwym przebiegiem** (mutacyjny wzorzec `Z32`
zaadaptowany do łączności z modelem, nie do bezpieczeństwa): wykonaj JEDNO próbne wywołanie
generatora dokumentu z celowo **zepsutym** kluczem (np. `ANTHROPIC_API_KEY=sk-invalid-test`
tylko dla tego jednego procesu, nie zmieniając realnej zmiennej) i zapisz w raporcie dosłowną
treść odpowiedzi/błędu. Oczekiwany kształt: realne odrzucenie przez dostawcę (błąd
autoryzacji), NIE fałszywy sukces. Dopiero po zobaczeniu tego realnego odrzucenia przywróć
prawdziwy klucz i przejdź do `R3` — to jest dowód, że ścieżka faktycznie dociera do
prawdziwego dostawcy, nie do mocka.

## R3 — TRZY REALNE PLIKI + ODCZYT JAK CZŁOWIEK (rdzeń, produkt dyżuru)

1. **Wygeneruj trzy pliki przez realne trasy produkcyjne** z Twoim zasianym kontekstem z `R1`:
   dokument (`document-studio.routes.ts` `POST /generate`), prezentacja (`generateDeck`/
   `generateOutline` z `presentationGeneratorService.ts` przez `presentations.routes.ts`),
   arkusz (`WorkbookGeneratorService.generate`/`generateFromTemplate` przez `workbook.routes.ts`).
   **Jeśli którykolwiek pierwszy przebieg padnie** — nie ponawiaj na tym samym artefakcie
   (defekt #2 z `§1`: trwała blokada), załóż NOWY i zanotuj że natrafiłeś na defekt.
2. **Zapisz pliki w `/private/tmp/cx-day259-trzy-pliki-artefakty`** z pełnymi ścieżkami i `shasum -a 256` — właściciel je
   otworzy, ścieżki muszą być dokładne i działające.
3. **Przeczytaj każdy plik jak człowiek** (nie tylko zlicz słowa) i policz DWIE liczby dla
   dokumentu i prezentacji (dla arkusza — opisowo, bo miara „zdanie” nie ma zastosowania):
   - **zdania niosące KONKRET** — liczba, nazwa własna, termin, osoba/rola odpowiedzialna;
   - **zdania-wypełniacze** — „należy rozważyć”, „kluczowe znaczenie ma”, ogólniki bez treści
     możliwej do zweryfikowania.
   Podaj OBIE liczby razem, nigdy samą długość tekstu jako miarę jakości.
4. **Trzy najlepsze i trzy najgorsze dosłowne cytaty** z każdego pliku (dokument, prezentacja;
   dla arkusza — trzy najlepsze/najgorsze formuły albo sekcje, jeśli ma to zastosowanie).
5. **Jednozdaniowa ocena „czy pokazałbym to klientowi”** per plik, uczciwa — jeśli wynik z
   kluczem nadal jest słaby, napisz to wprost, nie łagodź.
6. **Sprawdź ponownie cztery znane defekty z `§1`** na wyprodukowanych dziś plikach — czy
   slajd podsumowania nadal pokazuje fałszywe „0 inicjatyw i 0 ryzyk” mimo zasianych w `R1`
   źródeł, czy bramka dokumentu nadal blokuje/przepuszcza spójnie z bramką prezentacji.
7. **Porównaj wynik z tabelą z `§1`** (pomiar bez klucza) — czy dokument/prezentacja z kluczem
   są jakościowo różne od zastępników z 1.09, czy arkusz pozostaje spójny z poprzednim wynikiem
   (kapitał ≈ 53,7 mln, ≈ 107,47/akcję — jeśli te same dane wejściowe, oczekuj tego samego
   wyniku deterministycznego; jeśli inne dane wejściowe, wyjaśnij różnicę).

## R4 — RAPORT DYŻURU (rdzeń)

★ **Pierwsze zdanie raportu MUSI stwierdzać wprost, czy klucz był dostępny** (nawet jeśli tak —
napisz to, nie tylko milcząco przejdź do wyników). Streszczenie, `R0`-`R3` z pełnymi dowodami
(w tym dosłowna treść błędu z kontroli pozytywnej `R2`), tabela dwóch liczb (konkret/wypełniacz)
per plik, sześć cytatów per plik tekstowy, trzy jednozdaniowe werdykty, porównanie z pomiarem
1.09, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” (obowiązkowa nawet pusta), sekcja „Korekty wobec
instrukcji” (obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWY, `R2`) | `server/src/scripts/day259-trzy-pliki-realny-klucz.ts` (nowy skrypt dowodowy, poza `vitest`) |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` — WYŁĄCZNIE nowa sekcja na końcu, zakaz kasowania/przepisywania istniejącej treści |
| Zapis | trzy realne pliki wynikowe + logi w `/private/tmp/cx-day259-trzy-pliki-artefakty` (poza repo) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY259_TRZY_PLIKI_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/document-studio.routes.ts` · `server/src/routes/presentations.routes.ts` · `server/src/services/presentationGeneratorService.ts` · `server/src/services/deckConclusionSlide.ts` · `server/src/routes/workbook.routes.ts` · `server/src/services/workbook/WorkbookGeneratorService.ts` · `server/src/services/materialExportReceiptService.ts` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/auth.routes.ts` · `server/src/routes/ai.routes.ts` (wyłącznie odczyt gdzie sprawdzany jest klucz) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/scripts/*RealDbProof.ts` — wzorzec, nie edytujesz istniejących |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★★ **`R0` JEST TWARDYM WARUNKIEM WEJŚCIA.** Brak klucza albo brak sieci do dostawcy = STOP
  całego dyżuru na `R0`, jedno zdanie w raporcie, zero produkcji zastępników.
- ★★★ **WYJĄTEK OD `Z15` JEST WĄSKI I JEDNORAZOWY** — wyłącznie trzy (do pięciu, jeśli
  defekty wymuszą nowe artefakty) wywołania generatorów w `R3`, poprzedzone kontrolą pozytywną
  w `R2`. Nic więcej w tym dyżurze nie wolno oprzeć o odpowiedź modelu.
- ★★★ **ZAKAZ URUCHAMIANIA GENEROWANIA PRZEZ `VITEST`.** `tests/setup.ts` globalnie mockuje
  `fetch` i SDK modeli — wynik z `vitest` byłby fałszywym sukcesem atrapy, nawet z realnym
  kluczem. Wyłącznie samodzielny skrypt `tsx` poza `vitest` (`R2`).
- ★★ **PUSTA ORGANIZACJA DA NIEUCZCIWY POMIAR.** `R1` wymaga realnie zasianej wiedzy
  organizacji przez legalne ścieżki produktowe, z zapisanymi w raporcie konkretami (nazwy,
  liczby) — bez tego 0 zdań z konkretem w wyniku nie dowodzi niczego o generatorze.
- ★★ **DEFEKT #2 (trwała blokada eksportu) MA KONSEKWENCJE OPERACYJNE.** Pierwsza nieudana
  próba na artefakcie = załóż nowy, nie ponawiaj na tym samym.
- ★ **PODAJ ZAWSZE DWIE LICZBY RAZEM** (zdania z konkretem / wypełniacze), nigdy samą długość
  tekstu jako dowód jakości.
- ★ **PEŁNE ŚCIEŻKI TRZECH PLIKÓW W RAPORCIE** — właściciel je otworzy, ścieżki muszą być
  dokładne i pliki muszą tam faktycznie leżeć w momencie oddania raportu.
- ★ **ZAKAZ NAPRAWY** czterech znanych defektów — zgłaszasz ponownie zmierzony stan.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” W RAPORCIE JEST OBOWIĄZKOWA.**

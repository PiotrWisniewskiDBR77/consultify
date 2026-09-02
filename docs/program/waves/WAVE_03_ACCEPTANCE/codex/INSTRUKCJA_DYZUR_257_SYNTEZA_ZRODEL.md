# INSTRUKCJA DYŻURU nr 257 — Codex — „★★ SYNTEZA SLAJDU „WNIOSKI” NIE WIDZI ŹRÓDŁA TEKSTOWEGO — zweryfikowane bezpośrednio w kodzie na SHA `df7f13056f`: `buildDeckConclusionFacts()` (`deckConclusionSlide.ts:99-186`) czyta liczbę inicjatyw i ryzyk WYŁĄCZNIE z `artifactData._initiatives`/`_risks` (tablice strukturalne, `:179-180`) — kiedy deck powstaje z materiału TEKSTOWEGO (np. wklejony brief, przesłany dokument bez ustrukturyzowanych rekordów inicjatyw w bazie), te tablice są puste, licznik wynosi `0`, a zdanie na slajdzie brzmi dosłownie „Diagnoza objęła portfel 0 inicjatyw i 0 ryzyk” (`k1Text`, `:266`) — PRAWDZIWE zero programistyczne, ale FAŁSZYWE zdanie biznesowe, bo źródło miało realne inicjatywy i ryzyka opisane słowami, nie rekordami. Dowód, że to nie jest nieuchronne: pole `keyFindings` w TYM SAMYM builderze (`:133-143`) MA już gotowy wzorzec fallbacku „gdy strukturalne puste, sięgnij po `contextPack.key_points`” (`:142`) — wzorzec istnieje, tylko nie jest powielony dla `initiativesCount`/`risksCount`."

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
> **wyłącznie** `/private/tmp/cx-day257-synteza-zrodel`.

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
Zakres: ****PREZENTACJE (GAMMA) — SLAJD-SYNTEZA „WNIOSKI” (K1→K4) LICZY WYŁĄCZNIE ZE ŹRÓDEŁ STRUKTURALNYCH, ŹRÓDŁO TEKSTOWE JEST DLA NIEJ NIEWIDOCZNE.** `server/src/services/deliverables/deckConclusionSlide.ts` (667 linii, Oxford O2.5, komentarz nagłówkowy `:1-24`). `buildDeckConclusionFacts()` (`:99-186`) liczy `initiativesCount`/`risksCount` WYŁĄCZNIE z `Array.isArray(a._initiatives) ? a._initiatives.length : 0` (`:179-180`, `a` = `artifactData`) — ZERO fallbacku do `contextPack.data_points`/`key_points` (źródło tekstowe). Kontrast dowodowy w TYM SAMYM pliku: `keyFindings` (linie `:133-143`) MA fallback — `if (keyFindings.length === 0 && Array.isArray(cp.key_points))` (`:142`) — czyli wzorzec fallbacku do tekstu JUŻ ISTNIEJE w pliku dla jednego pola i nie jest powielony dla dwóch pozostałych. Wyliczone liczby trafiają dosłownie do prozy: `k1Text` (`:266`) „Diagnoza objęła portfel ${facts.initiativesCount} inicjatyw i ${facts.risksCount} ryzyk” — to jest DOSŁOWNIE zdanie zmierzone w `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` jako „0 inicjatyw i 0 ryzyk” na slajdzie 10 przy dwóch dostarczonych źródłach. Te same dwa pola powracają w `k2Text` (`:281-282`, „Rozłożenie postępu na ${facts.initiativesCount} inicjatyw…”) i w warunkowej akcji K3 (`:317-330`, `if (facts.risksCount > 0) { k3Actions.push(...) }` — przy fałszywym zerze ta akcja mitygacji ryzyk W OGÓLE SIĘ NIE POJAWIA na slajdzie, mimo realnych ryzyk w źródle).**.
Trasy front: `Brak bezpośredniej trasy frontowej do TEGO builder'a — slajd wstawiany jest po stronie serwera podczas generacji decka (`presentationGeneratorService.ts:2007`, `buildDeckConclusionSlide`), zanim wynik dotrze do frontu jako gotowy `UnifiedSlide`. Front (`src/components/Presentations/DeckBuilder/`) renderuje slajd jak każdy inny `intent: 'key_messages'` — zweryfikuj sam w `R1`, czy front ma jakikolwiek sposób odróżnienia go od zwykłego slajdu kluczowych wniosków (pole `_conclusion`, komentarz `:14-18`)`. Trasy tył: ``server/src/services/presentationGeneratorService.ts:2003-2038` — wywołanie `buildDeckConclusionSlide({language, artifactData, contextPack, llm, logger})`, za flagą `ENABLE_DECK_CONCLUSION_SLIDE` (domyślnie WŁĄCZONA — `!== 'false'` uruchamia, `:2001-2003`) · `server/src/services/deliverables/deckConclusionSlide.ts` — `buildDeckConclusionFacts` `:99-186` (licznik `:179-180`), `factsPool`/`factRefs` `:187-213`, `buildDeterministicDeckConclusion` `:215-…` (`k1Text` `:264-270`, `k2Text` `:278-283`, `k3Actions` risksCount-warunek `:317-330`) · `server/src/services/conclusionValidators.ts` (392 linii — WALIDATOR liczb-w-prozie WZGLĘDEM `factsPool`, NIE walidator poprawności samego `factsPool` — sprawdź to rozróżnienie sam, `R1`) · ★ PUŁAPKA RODZINY: istnieje DRUGI plik o tej samej nazwie `src/services/report/conclusionValidators.ts` (front/inny katalog) — `deckConclusionSlide.ts` importuje `'../conclusionValidators.js'` czyli WZGLĘDNIE do `server/src/services/`, NIE ten drugi; potwierdź importera na swoim markerze, nie zgaduj`.

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
WT=/private/tmp/cx-day257-synteza-zrodel
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
git -C "$VAULT" worktree add "$WT" -b codex/day257-synteza-zrodel-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day257-synteza-zrodel/config.worktree"
cat "$VAULT/worktrees/cx-day257-synteza-zrodel/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day257-synteza-zrodel-scratch
mkdir -p /private/tmp/cx-day257-synteza-zrodel-artefakty

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
git -C "$WT" push github-backup codex/day257-synteza-zrodel-20260901
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

# (1) TEZA: initiativesCount/risksCount licz sie WYLACZNIE z artifactData._initiatives/_risks
sed -n '99,186p' server/src/services/deliverables/deckConclusionSlide.ts
#   oczekiwane: linie ok. 179-180 'Array.isArray(a._initiatives) ? a._initiatives.length : 0'
#   i analogicznie dla _risks, bez zadnego odwolania do 'cp.'/'contextPack' w tych dwoch liniach

# (2) KONTRAST: keyFindings W TYM SAMYM builderze MA fallback do contextPack.key_points
grep -n "keyFindings.length === 0\|cp.key_points\|cp.data_points" server/src/services/deliverables/deckConclusionSlide.ts
#   oczekiwane: co najmniej jedno trafienie w bloku keyFindings (~linia 142) — dowod ze
#   wzorzec fallbacku juz istnieje w pliku dla innego pola

# (3) TEZA: k1Text sklada doslowne zdanie z initiativesCount/risksCount
grep -n "Diagnoza obj\|diagnosis covered a portfolio" server/src/services/deliverables/deckConclusionSlide.ts
#   oczekiwane: 1 trafienie (PL) + 1 (EN), oba uzywaja facts.initiativesCount i facts.risksCount

# (4) TEZA: te same dwa pola powracaja w k2Text i w warunkowej akcji K3
sed -n '278,330p' server/src/services/deliverables/deckConclusionSlide.ts
#   oczekiwane: k2Text uzywa facts.initiativesCount (~281-282); blok
#   'if (facts.risksCount > 0)' opakowuje calkowicie akcje mitygacji ryzyk (~317-330)

# (5) TEZA: contextPack ma zdefiniowany ksztalt data_points/key_points w samym pliku
sed -n '68,80p' server/src/services/deliverables/deckConclusionSlide.ts
#   oczekiwane: interfejs parametrow z 'contextPack?: { key_points?: string[]; data_points?: ... }'

# (6) TEZA: wywolujacy przekazuje artifactData i contextPack BEZ modyfikacji miedzy nimi
sed -n '1995,2015p' server/src/services/presentationGeneratorService.ts
#   oczekiwane: 'buildDeckConclusionSlide({ language: setup.language, artifactData, contextPack, ... })'

# (7) TEZA: istnieje DRUGI plik conclusionValidators.ts (rodzina, mozliwy martwy)
find . -iname "conclusionValidators.ts" -not -path "*/node_modules/*"
grep -n "^import.*conclusionValidators" server/src/services/deliverables/deckConclusionSlide.ts
#   oczekiwane: dwa pliki znalezione; import w deckConclusionSlide.ts wskazuje na
#   '../conclusionValidators.js' wzgledem server/src/services/ (czyli SERWEROWY, nie ten w src/)

# (8) TEZA: ENABLE_DECK_CONCLUSION_SLIDE jest domyslnie WLACZONA (odwrotnie niz 255/256)
grep -n "ENABLE_DECK_CONCLUSION_SLIDE" server/src/services/presentationGeneratorService.ts server/src/config/FeatureFlags.ts
#   oczekiwane: warunek '!== \'false\'' w presentationGeneratorService.ts — domyslnie wykonuje sie

# (9) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day257-synteza-zrodel-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6254`. Twój JEDYNY port harnessu to `5234 i 5235`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day257-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6249, 5010-5229, 6404-6411, 6600-6830. Twoje własne: baza 6254, harness 5234 i 5235. Cudze — siostrzane dyżury TEJ SAMEJ paczki (255-259, Prezentacje i Dokumenty), nie dotykasz: baza 6250 i harness 5230-5231 (dyżur 255 Nazwy operacji agenta), baza 6252 i harness 5232-5233 (dyżur 256 Bramki jakości), baza 6256 i harness 5236-5237 (dyżur 258 Rodzina propozycji AI), baza 6258 i harness 5238-5239 (dyżur 259 Trzy pliki z realnym kluczem). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. `ENABLE_DECK_CONCLUSION_SLIDE` zostaje jak jest (domyślnie włączona) — nie zmieniasz tej wartości. Jeżeli naprawa wymaga rozróżnienia zachowania (stary/nowy sposób liczenia), użyj wewnętrznej gałęzi logiki w `buildDeckConclusionFacts`, nie nowej flagi środowiskowej.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/conclusionValidators.ts` (WZORZEC/zależność — tylko odczyt, chyba że R1 udowodni inaczej) · `src/services/report/conclusionValidators.ts` (TYLKO ODCZYT — pułapka rodziny, sprawdź, czy martwy) · `server/src/services/report/pptx/RulesEngine.ts` (TYLKO ODCZYT — teren dyżuru 256) · `server/src/services/presentationQualityGatesService.ts` (TYLKO ODCZYT — teren dyżuru 256) · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY257_SYNTEZA_ZRODEL_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — moduł Prezentacje/Dokumenty (Gamma) nie ma dziś takiego pliku w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/` (sprawdź `ls docs/program/waves/WAVE_03_ACCEPTANCE/modules/ | grep -i present` na swoim markerze — zero trafień), więc ten dyżur jest przekrojowy względem tej rejestracji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day257-synteza-zrodel-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day257-synteza-zrodel-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ dotykania bramek jakości** (`RulesEngine.ts`, `presentationQualityGatesService.ts`, `documentQaService.ts`) — to jest teren dyżuru 256 równoległego w tej samej paczce; Twoim zadaniem jest ŹRÓDŁO fałszu (synteza), nie MECHANIZM wykrywania fałszu. **ZAKAZ zgadywania liczby inicjatyw/ryzyk ze źródła tekstowego przez heurystykę tekstową** (np. liczenie wystąpień słowa „inicjatywa” w wolnym tekście) — to producowałoby NOWY rodzaj fałszu (zgadnięta liczba podana z pewnością prawdziwej). Dozwolony jest WYŁĄCZNIE odczyt liczby z ustrukturyzowanego pola, jeśli `R1` je znajdzie, albo uczciwy hedge, jeśli go nie znajdzie. **ZAKAZ zmiany `conclusionValidators.ts`** poza odczytem, chyba że `R1` udowodni, że walidator SAM jest przyczyną (mało prawdopodobne — patrz opis w `MODUL_LUB_OBSZAR`, ale sprawdź, nie zakładaj). | Slajd „Wnioski” (K1→K4) to Oxford O2.5 — warstwa, która ma domykać każdy deck zdaniem „co to znaczy i co robić dalej”, budowana WŁAŚNIE po to, żeby konsultant nie kończył prezentacji na kolażu sekcji. Kiedy ta warstwa kłamie liczbą widoczną na jednym z ostatnich slajdów — tym, który klient zapamiętuje najdłużej — psuje dokładnie tę rzecz, dla której powstała: zaufanie do wniosku. Gorzej, klient z materiałem TEKSTOWYM (najczęstszy realny przypadek na starcie współpracy, zanim dane trafią do bazy jako rekordy) jest strukturalnie najbardziej narażony, bo to dokładnie ten kanał, którego synteza dziś nie widzi. |

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
cd /private/tmp/cx-day257-synteza-zrodel

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day257-pg psql -U postgres -d cx257 \
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
cd /private/tmp/cx-day257-synteza-zrodel

docker run -d --name cx-day257-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx257 \
  -p 127.0.0.1:6254:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day257-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6254/cx257 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6254/cx257 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day257-synteza-zrodel && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6254/cx257 \
JWT_SECRET=cx257-test-secret-do-not-reuse \
npx vitest run server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day257-synteza-zrodel-artefakty/day257-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day257-synteza-zrodel && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day257-synteza-zrodel-artefakty/day257-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day257-synteza-zrodel/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day257-pg psql -U postgres -d cx257 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day257-pg`.
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
> **(e) ★★ NIE ZGADUJ STRUKTURY PAKIETU ŹRÓDEŁ TEKSTOWYCH — ROZKAZ POMIAROWY, nie teza: ustal w `R1`, ZANIM napiszesz jakikolwiek kod, (a) co dokładnie ląduje w `contextPack.data_points`/`key_points` kiedy deck powstaje z czatu/wklejonego tekstu bez rekordów inicjatyw w bazie — czy jest tam cokolwiek, z czego dałoby się policzyć LICZBĘ inicjatyw/ryzyk (np. `data_points` z etykietą zawierającą słowo „inicjatywa”/„ryzyko”), czy WYŁĄCZNIE luźne zdania bez struktury liczbowej; (b) prześledź WSTECZ od `presentationGeneratorService.ts:2007` skąd pochodzi `contextPack` przekazywany do `buildDeckConclusionSlide` — czy to ten sam obiekt, który zasila `key_points`, czy inny. Podaj `plik:linia` dla obu ustaleń w raporcie PRZED opisaniem naprawy. **Jeśli odpowiedź na (a) brzmi „nie da się policzyć liczby z tekstu” — naprawą NIE jest zgadywanie liczby, tylko UCZCIWY HEDGE** (np. pominięcie zdania z liczbą zamiast podstawienia zera, albo jawne „liczba inicjatyw nieustalona ze źródła tekstowego”) — rozstrzygnij i uzasadnij w raporcie, nie zakładaj z góry, że fallback do `cp.key_points` (wzorzec z `:142`) da się mechanicznie powielić na liczby.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day257-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day257-synteza-zrodel-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (ROZKAZ POMIAROWY — ustal strukturę pakietu źródeł tekstowych i ścieżkę `contextPack` do `buildDeckConclusionSlide`, warunek wejścia do R2) · R2 (napraw `initiativesCount`/`risksCount` — realny fallback do źródła tekstowego JEŚLI R1 znajdzie policzalne pole, inaczej uczciwy hedge) · R3 (para dowodowa: źródło tekstowe z faktami ⇒ slajd podaje PRAWDZIWE liczby, nie zera; dowód mutacyjny) · R4 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6254` albo `5234 i 5235` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6254` albo `5234 i 5235`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

Slajd „Wnioski” (K1→K4, Oxford O2.5, `server/src/services/deliverables/deckConclusionSlide.ts`)
ma domykać każdy deck zdaniem werdykt→dlaczego→co robić→jaki efekt, budowany po to, żeby
prezentacja nie kończyła się kolażem sekcji. `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md`
zmierzyło ten slajd w realnym przebiegu (prawdziwy Postgres, prawdziwy `Gateway`, dwa
dostarczone źródła z realnymi inicjatywami) i znalazło na slajdzie 10 zdanie: **„Diagnoza
objęła portfel 0 inicjatyw i 0 ryzyk”** — dosłowne zero, jawnie fałszywe.

Przyczyna jest w kodzie, nie w danych: `buildDeckConclusionFacts()` (`:99-186`) liczy
`initiativesCount`/`risksCount` WYŁĄCZNIE z tablic strukturalnych —
`Array.isArray(a._initiatives) ? a._initiatives.length : 0` (`:179-180`, `a` =
`artifactData`). Kiedy deck powstaje z materiału TEKSTOWEGO — wklejony brief, przesłany
dokument, transkrypt rozmowy, jeszcze bez rekordów inicjatyw wpisanych do bazy jako
struktura — ta tablica jest pusta, licznik wynosi zero, i zero trafia dosłownie do zdania
na slajdzie. Programistycznie liczba jest prawdziwa (tablica faktycznie ma zero
elementów). Biznesowo zdanie jest fałszywe (źródło miało inicjatywy — opisane słowami, nie
rekordami).

**Dowód, że to nie jest nieuchronne — wzorzec fallbacku już istnieje w TYM SAMYM pliku dla
INNEGO pola:**

```
keyFindings — jeśli tablica strukturalna pusta, sięga po contextPack.key_points (:142)
initiativesCount / risksCount — takiego fallbacku NIE MA (:179-180)
```

To jest dokładnie kształt „Krok 0: wypisz rodzinę” z `REGUŁY 1.09` — jedno pole w pliku ma
już naprawę, dwa sąsiednie pola z identycznym problemem jej nie mają.

## ★★ Rozkaz pomiarowy — NIE zgaduj struktury pakietu źródeł

**To jest KROK 0 tego dyżuru i warunek wejścia do jakiejkolwiek naprawy.** Zanim napiszesz
jeden wiersz kodu, ustal FAKTAMI (`plik:linia`), nie założeniami:

1. Co dokładnie ląduje w `contextPack.data_points`/`key_points` (kształt zdefiniowany w
   samym pliku, `:68-79`), kiedy deck powstaje z czatu / wklejonego tekstu BEZ rekordów
   inicjatyw w bazie. Czy jest tam COKOLWIEK, z czego dałoby się policzyć LICZBĘ inicjatyw
   / ryzyk (np. `data_points` z etykietą zawierającą „inicjatywa”/„ryzyko” i wartością
   liczbową), czy WYŁĄCZNIE luźne zdania bez struktury liczbowej.
2. Skąd faktycznie pochodzi `contextPack` przekazywany do `buildDeckConclusionSlide` —
   prześledź wstecz od wywołania w `presentationGeneratorService.ts:2007` (i wywołania
   funkcji dwie linijki niżej z `artifactData, contextPack`) do miejsca, gdzie oba obiekty
   są budowane. Czy to ten sam obiekt, który zasila `key_points` (czyli fallback z `:142`
   faktycznie ma dostęp do prawdziwych danych), czy inny/pusty w tym konkretnym torze
   generacji.

Zapisz odpowiedzi na oba pytania w raporcie, z `plik:linia`, PRZED opisaniem naprawy w R2.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `initiativesCount`/`risksCount` liczone wyłącznie z `artifactData._initiatives`/`_risks` | `R1`, komenda (1) |
| T2 | `keyFindings` w TYM SAMYM builderze MA fallback do `contextPack.key_points` | `R1`, komenda (2) |
| T3 | `k1Text` składa dosłowne zdanie „Diagnoza objęła portfel X inicjatyw i Y ryzyk” z tych liczników | `R1`, komenda (3) |
| T4 | Te same liczniki powracają w `k2Text` i w warunkowej akcji K3 (znika CAŁKOWICIE przy zerze) | `R1`, komenda (4) |
| T5 | Kształt `contextPack.data_points`/`key_points` jest zdefiniowany w pliku | `R1`, komenda (5) |
| T6 | Wywołujący przekazuje `artifactData`/`contextPack` bez modyfikacji między nimi | `R1`, komenda (6) |
| T7 | Istnieje DRUGI plik `conclusionValidators.ts` (rodzina) — ustal, który jest importowany | `R1`, komenda (7) |
| T8 | `ENABLE_DECK_CONCLUSION_SLIDE` jest domyślnie WŁĄCZONA (odwrotnie niż flagi w 255/256) | `R1`, komenda (8) |
| T9 | Miejsce na dysku wystarcza | `R1`, komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — ROZKAZ POMIAROWY: STRUKTURA ŹRÓDEŁ TEKSTOWYCH (rdzeń, warunek wejścia)

Wykonaj wszystkie 9 komend `§0.1`. Odpowiedz na oba pytania z sekcji 1 („Rozkaz pomiarowy”)
z dosłownymi cytatami `plik:linia`. **To jest twardy warunek wejścia do `R2` — nie piszesz
naprawy, dopóki nie wiesz, czy istnieje policzalne pole tekstowe do którego się odwołać.**

Zwróć szczególną uwagę na `T7` (pułapka rodziny — dwa pliki `conclusionValidators.ts`).
Potwierdź importem w `deckConclusionSlide.ts`, KTÓRY plik jest żywy na tej ścieżce
(`'../conclusionValidators.js'` względem `server/src/services/deliverables/` rozwiązuje się
do `server/src/services/conclusionValidators.ts` — potwierdź to sam, nie licz na moje
wyliczenie).

## R2 — NAPRAW `initiativesCount`/`risksCount` — WEDŁUG WYNIKU `R1` (rdzeń)

**Dwie gałęzie, w zależności od tego, co znalazłeś w `R1`:**

**Gałąź A — jeśli `R1` znalazł policzalne pole w `contextPack.data_points`** (np. wpis z
etykietą jednoznacznie identyfikującą liczbę inicjatyw/ryzyk, ustrukturyzowany, nie wolny
tekst): dodaj fallback ANALOGICZNY do istniejącego wzorca `keyFindings` (`:142`) — kiedy
`Array.isArray(a._initiatives)` jest pusta/nieobecna, spróbuj odczytać liczbę z
odpowiedniego `data_points` po etykiecie. **Reużyj dokładnie ten sam styl kodu co fallback
`keyFindings`** — nie wymyślaj nowego wzorca.

```ts
// szkic kierunku — WYŁĄCZNIE jeśli R1 potwierdzi istnienie policzalnego pola;
// dostosuj nazwę etykiety do tego, co realnie znalazłeś
const initiativesCount = Array.isArray(a._initiatives)
  ? a._initiatives.length
  : (num(cp.data_points?.find((dp) => /inicjatyw|initiatives/i.test(String(dp?.label)))?.value) ?? 0);
```

**Gałąź B — jeśli `R1` NIE znalazł żadnego policzalnego pola** (źródło tekstowe niesie
wyłącznie luźne zdania, bez struktury z której dałoby się wiarygodnie wyprowadzić liczbę):
**ZAKAZANE jest zgadywanie liczby heurystyką tekstową** (np. liczenie wystąpień słowa
„inicjatywa” w wolnym tekście — to produkowałoby NOWY rodzaj fałszu, liczbę zgadniętą,
podaną z pewnością liczby prawdziwej). Naprawa to UCZCIWY HEDGE: kiedy
`facts.initiativesCount === 0 && facts.risksCount === 0` ale `keyFindings.length > 0`
(dowód, że źródło NIE było puste, tylko tekstowe — sygnał niespójności), zmień `k1Text` tak,
żeby NIE twierdził liczby zero jako faktu. Przykład kierunku (dostosuj brzmienie do PL/EN
stylu reszty pliku):

```ts
// szkic kierunku dla Gałęzi B — dostosuj warunek do dokładnego kształtu, jaki
// R1 potwierdzi jako "źródło było tekstowe, nie puste"
const countsAreGrounded = facts.initiativesCount > 0 || facts.risksCount > 0 || facts.keyFindings.length === 0;
const k1Text = isPl
  ? countsAreGrounded
    ? `Diagnoza objęła portfel ${facts.initiativesCount} inicjatyw i ${facts.risksCount} ryzyk.${scorePart} ...`
    : `Diagnoza oparta na materiale źródłowym bez ustrukturyzowanej liczby inicjatyw i ryzyk.${scorePart} ...`
  : /* analogicznie EN */;
```

**Rozstrzygnij i uzasadnij w raporcie, którą gałąź zastosowałeś i dlaczego** — to jest
decyzja oparta na FAKCIE z `R1`, nie z góry założona. Zastosuj tę samą logikę do `k2Text`
(`:281-282`) i do warunku `facts.risksCount > 0` przy akcji K3 (`:317-330` — jeśli Gałąź B,
rozważ, czy akcja mitygacji ryzyk powinna pojawić się z hedge'owanym sformułowaniem zamiast
znikać całkowicie, kiedy źródło było tekstowe i niepuste).

## R3 — PARA DOWODOWA: ŹRÓDŁO TEKSTOWE Z FAKTAMI ⇒ SLAJD PODAJE PRAWDZIWE LICZBY (rdzeń)

Napisz `server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts`
z dwoma obowiązkowymi przypadkami (para, oba człony):

- **kontrola negatywna (źródło rzeczywiście puste ⇒ zero jest prawdziwe):**
  `artifactData` bez `_initiatives`/`_risks`, `contextPack` bez `key_points`/`data_points`
  → `buildDeterministicDeckConclusion` produkuje `k1Text` z zerem — **i to jest POPRAWNE
  zachowanie**, bo źródło faktycznie nie miało nic. Test dokumentuje, że ta ścieżka
  ZOSTAJE nietknięta.
- **kontrola pozytywna (źródło tekstowe z faktami ⇒ prawdziwe liczby, nie zera):** fixture
  odtwarzający realny scenariusz z `DOWOD_TRZY_PLIKI` — `artifactData._initiatives`/`_risks`
  puste, ale `contextPack.key_points`/`data_points` niepuste i niosące sygnał o realnych
  inicjatywach/ryzykach (kształt zgodny z tym, co `R1` ustalił jako faktycznie dostarczane) →
  `k1Text` **NIE zawiera fałszywego „0 inicjatyw i 0 ryzyk”** (Gałąź A: prawdziwa liczba;
  Gałąź B: hedge zamiast zera podanego jako fakt).

**Dowód mutacyjny (`Z32`):** cofnij naprawę `R2` → drugi test (kontrola pozytywna) czerwony,
pierwszy (kontrola negatywna) NADAL zielony (dowód, że test nie jest przypadkowo zawsze
czerwony/zielony niezależnie od kodu); przywróć przez `cp` (`Z27`) → oba zielone.

Uruchom RÓWNIEŻ istniejące testy `conclusionValidators`/`deckConclusionSlide` (znajdź je w
`R1`) i potwierdź w raporcie, że Twoja zmiana nie psuje istniejącego kontraktu grounding —
`validateConclusion` nadal musi przechodzić dla obu przypadków (liczby w prozie muszą
zgadzać się z `factsPool`, który teraz niesie poprawioną wartość).

## R4 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, odpowiedzi na oba pytania „Rozkazu pomiarowego” z `R1` w całości
(dosłowne cytaty `plik:linia`), `R2`-`R3` z pełnymi dowodami (w tym para dowodowa i dowód
mutacyjny), sekcja „TWIERDZENIA NIEZWERYFIKOWANE” (obowiązkowa nawet pusta), sekcja
„Korekty wobec instrukcji” (obowiązkowa nawet pusta — w szczególności: którą gałąź (A/B)
zastosowałeś i dlaczego; czy `T7` (pułapka rodziny `conclusionValidators.ts`) potwierdziła
się; czy `k3Actions` przy Gałęzi B dostał hedge czy pozostał bez zmian).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (PEŁNA, `R2`) | `server/src/services/deliverables/deckConclusionSlide.ts` — WYŁĄCZNIE `buildDeckConclusionFacts` i `buildDeterministicDeckConclusion` (liczniki + zdania K1/K2/K3 dotyczące inicjatyw/ryzyk); zakaz zmiany `factsPool`/`factRefs`/struktury `DeckConclusion` poza tym, co R2 wymaga |
| Zapis (PEŁNA, NOWY PLIK, `R3`) | `server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts` (`git add -f`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY257_SYNTEZA_ZRODEL_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/conclusionValidators.ts` (zależność — zmieniasz WYŁĄCZNIE jeśli `R1` udowodni, że jest przyczyną, co jest mało prawdopodobne) · `src/services/report/conclusionValidators.ts` (pułapka rodziny — potwierdź martwy, nie zmieniaj) · `server/src/services/presentationGeneratorService.ts` (odczyt WYŁĄCZNIE — do prześledzenia pochodzenia `contextPack`, `R1`) · `server/src/services/report/pptx/RulesEngine.ts` · `server/src/services/presentationQualityGatesService.ts` (TYLKO ODCZYT — teren dyżuru 256) |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` (kanoniczne, nie Twoje do zmiany) |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **`R1` (ROZKAZ POMIAROWY) JEST WARUNKIEM WEJŚCIA DO `R2`.** Nie piszesz naprawy, dopóki
  nie wiesz z FAKTU (nie z założenia), czy istnieje policzalne pole tekstowe.
- ★★ **ZAKAZ ZGADYWANIA LICZBY ZE ŹRÓDŁA TEKSTOWEGO HEURYSTYKĄ.** Liczenie słów w wolnym
  tekście produkuje nowy fałsz — liczbę zgadniętą podaną z pewnością prawdziwej. Dozwolony
  jest WYŁĄCZNIE odczyt z ustrukturyzowanego pola (Gałąź A) albo uczciwy hedge (Gałąź B).
- ★★ **ZAKAZ DOTYKANIA BRAMEK JAKOŚCI** (`RulesEngine.ts`, `presentationQualityGatesService.ts`,
  `documentQaService.ts`) — to teren dyżuru 256 równoległego w tej samej paczce. Ten dyżur
  naprawia ŹRÓDŁO fałszu, nie MECHANIZM jego wykrywania.
- ★ **Para dowodowa, oba człony (`R3`):** źródło rzeczywiście puste → zero zostaje
  (poprawne); źródło tekstowe niepuste → zero znika (naprawione). Sama jedna strona
  dałaby fałszywie zielony wynik.
- ★ **Dowód mutacyjny (`Z32`) obowiązkowy** — cofnij naprawę, pokaż czerwono (TYLKO test
  kontroli pozytywnej, kontrola negatywna zostaje zielona), przywróć przez `cp` (`Z27` —
  nigdy `git stash`), pokaż oba zielone, `git diff` czysty.
- ★ **`Z10`/`Z11`:** zero nowej flagi, `ENABLE_DECK_CONCLUSION_SLIDE` zostaje jak jest.
- ★ **Sprawdź istniejące testy grounding (`validateConclusion`) nie regresują** — zmiana
  liczników wpływa na `factsPool`, którego zgodność z prozą waliduje ten sam mechanizm.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy bez
  `RUN_DB_TESTS=1` · `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` ·
  `tests/setup.ts:896` podmienia `global.fetch` · `Z31` (strażnik realdb bez argumentów).
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.

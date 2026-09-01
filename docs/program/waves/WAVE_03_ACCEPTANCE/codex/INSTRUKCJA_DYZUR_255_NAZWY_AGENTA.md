# INSTRUKCJA DYŻURU nr 255 — Codex — „★★ NAZWY TRZECH OPERACJI AGENTA PREZENTACJI KŁAMIĄ — zweryfikowane bezpośrednio w kodzie na SHA `df7f13056f`: „przeredaguj” (`rewrite_slide`, `presentationAgentEditService.ts:512-513`) nic nie redaguje, tylko wkleja dosłownie tekst z polecenia użytkownika po pierwszym dwukropku (`String(prompt).split(':').slice(1).join(':').trim()`), zero wołania modelu językowego; „podziel slajd” (`split_slide`, `:524-547`) tnie treść w połowie liczby ZNAKÓW (`Math.ceil(text.length / 2)`, linia `534`), może przeciąć w środku wyrazu, a nowy `card_id` buduje ze znacznika czasu `Date.now()` (linia `540`) — kolizja przy dwóch podziałach w tej samej milisekundzie; „zmień archetyp” (`change_archetype`, `:549-557`) wyciąga nazwę z regexu w poleceniu i wpisuje ją do `cards[index].layout_id` **bez żadnej walidacji** (linia `554`) przeciw liście dozwolonych archetypów, mimo że walidator `isArchetypeId()` już istnieje w repo (`server/src/services/deliverables/slideArchetypes.ts:508`) i nie jest tu wołany. Cała ścieżka rozpoznawania intencji (`parsePresentationEditIntent`, `:62-105`) jest dziś czysto regexowa — zero wołania modelu w produkcji na tej gałęzi."

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
> **wyłącznie** `/private/tmp/cx-day255-nazwy-agenta`.

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
Zakres: ****PREZENTACJE (GAMMA) — TRZY OPERACJE AGENTA REDAGUJĄCEGO KŁAMIĄ NAZWĄ.** `server/src/services/presentationAgentEditService.ts`, funkcja `applyPresentationEditPlan` (od linii `469`), za flagą `ENABLE_TERESA_DECK_EDIT` (domyślnie `false`, `server/src/config/FeatureFlags.ts:38`). Trzy z pięciu operacji redakcyjnych (`rewrite_slide`, `split_slide`, `change_archetype`) robią coś innego, niż deklaruje ich nazwa — zmierzone czytaniem kodu na SHA `df7f13056f`, potwierdzone w `docs/functional/12_prezentacje/README.md` i `docs/program/funkcje/ODBIOR_230_232_FIX.md` (sekcja „Odnotowane, świadomie NIE naprawione”).**.
Trasy front: ``src/components/Presentations/DeckBuilder/AgentPanel.tsx` — zamontowany w produkcyjnym `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (nie w drugim, osobnym panelu; potwierdzone `docs/program/funkcje/GAMMA_00_PRZEWODNIK.md` i `CODEX_DAY232_GAMMA_AGENT_REPORT.md`). Panel jest wolnym polem tekstowym (czat), NIE ma twardo zakodowanych polskich etykiet operacji do zmiany — zweryfikuj to sam w `R1`, komenda (7)`. Trasy tył: ``server/src/routes/presentations.routes.ts:4179` (`POST /decks/:deckId/agent-edit`, tworzy propozycję) · `:4307` (`POST /decks/:deckId/agent-edit/:operationId/accept`) · `:4413` (`.../reject`) · `server/src/services/presentationAgentEditService.ts` — `parsePresentationEditIntent` (`:62-206`, rozpoznanie intencji z tekstu), `applyPresentationEditPlan` (`:469-…`, wykonanie trzech operacji: `:512-522` rewrite_slide, `:524-547` split_slide, `:549-557` change_archetype) · referencja walidatora do powielenia: `server/src/services/deliverables/slideArchetypes.ts:502-532` (`SLIDE_ARCHETYPES`, `isArchetypeId`, `getArchetype`)`.

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
WT=/private/tmp/cx-day255-nazwy-agenta
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
git -C "$VAULT" worktree add "$WT" -b codex/day255-nazwy-agenta-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day255-nazwy-agenta/config.worktree"
cat "$VAULT/worktrees/cx-day255-nazwy-agenta/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day255-nazwy-agenta-scratch
mkdir -p /private/tmp/cx-day255-nazwy-agenta-artefakty

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
git -C "$WT" push github-backup codex/day255-nazwy-agenta-20260901
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

# (1) TEZA: rewrite_slide wkleja dosłownie tekst po dwukropku, zero modelu
sed -n '505,522p' server/src/services/presentationAgentEditService.ts
#   oczekiwane: 'String(prompt).split(':').slice(1).join(':').trim()' — brak jakiegokolwiek
#   wołania llmService/fetch do modelu w tym bloku

# (2) TEZA: split_slide tnie w polowie liczby ZNAKOW (nie slow), moze przeciac wyraz
sed -n '524,547p' server/src/services/presentationAgentEditService.ts
#   oczekiwane: 'Math.ceil(text.length / 2)' (linia ~534) — cieciu na indeksie znaku,
#   bez szukania najblizszej spacji/granicy slowa

# (3) TEZA: split_slide buduje nowy card_id ze znacznika czasu Date.now()
grep -n "Date.now()" server/src/services/presentationAgentEditService.ts
#   oczekiwane: co najmniej jedno trafienie w bloku split_slide (~linia 540),
#   wzorzec '-split-${Date.now()}'

# (4) TEZA: change_archetype wpisuje layout_id BEZ walidacji przeciw liscie archetypow
sed -n '549,557p' server/src/services/presentationAgentEditService.ts
#   oczekiwane: 'cards[index].layout_id = layoutId' bez wywolania jakiegokolwiek
#   walidatora/rejestru miedzy wyciagnieciem regexu a przypisaniem

# (5) TEZA: walidator archetypow JUZ ISTNIEJE w repo i nie jest tu wolany
grep -n "export function isArchetypeId\|export const SLIDE_ARCHETYPES" server/src/services/deliverables/slideArchetypes.ts
grep -n "isArchetypeId\|slideArchetypes" server/src/services/presentationAgentEditService.ts
#   oczekiwane: pierwszy grep ma trafienia (walidator istnieje), drugi grep — ZERO
#   trafien (nie jest tu importowany ani wolany)

# (6) TEZA: cala sciezka intencji jest dzis regexowa, zero wolania modelu
sed -n '62,105p' server/src/services/presentationAgentEditService.ts
grep -n "llmService\|GoogleGenerativeAI\|fetch(\|require('ai" server/src/services/presentationAgentEditService.ts
#   oczekiwane: drugi grep — ZERO trafien w calym pliku

# (7) TEZA: front to wolne pole tekstowe (czat), bez twardo zakodowanych PL etykiet
#     'Przeredaguj'/'Podziel'/'Zmień archetyp' jako przyciskow do zmiany nazwy
grep -n "Przeredaguj\|Podziel slajd\|Zmień archetyp\|rewrite_slide\|split_slide\|change_archetype" src/components/Presentations/DeckBuilder/AgentPanel.tsx
#   oczekiwane: zero trafien (albo jawnie inny ksztalt niz zalozony) — zapisz wynik
#   do raportu jako fakt, nie zalozenie

# (8) TEZA: flaga ENABLE_TERESA_DECK_EDIT jest domyslnie false
grep -n "ENABLE_TERESA_DECK_EDIT" server/src/config/FeatureFlags.ts
#   oczekiwane: 'z.boolean().default(false)'

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day255-nazwy-agenta-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6250`. Twój JEDYNY port harnessu to `5230 i 5231`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day255-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6249, 5010-5229, 6404-6411, 6600-6830. Twoje własne: baza 6250, harness 5230 i 5231. Cudze — siostrzane dyżury TEJ SAMEJ paczki (255-259, Prezentacje i Dokumenty), nie dotykasz: baza 6252 i harness 5232-5233 (dyżur 256 Bramki jakości), baza 6254 i harness 5234-5235 (dyżur 257 Synteza slajdu), baza 6256 i harness 5236-5237 (dyżur 258 Rodzina propozycji AI), baza 6258 i harness 5238-5239 (dyżur 259 Trzy pliki z realnym kluczem). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. `ENABLE_TERESA_DECK_EDIT` zostaje `false` domyślnie — nie zmieniasz tej wartości nigdzie (`.env*`, `docker-compose*`, kod). Naprawiasz mechanikę POD flagą, nie odsłaniasz jej.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY255_NAZWY_AGENTA_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — moduł Prezentacje/Dokumenty (Gamma) nie ma dziś takiego pliku w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/` (sprawdź `ls docs/program/waves/WAVE_03_ACCEPTANCE/modules/ | grep -i present` na swoim markerze — zero trafień), więc ten dyżur jest przekrojowy względem tej rejestracji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day255-nazwy-agenta-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day255-nazwy-agenta-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ wołania modelu językowego w jakiejkolwiek formie** — `llmService`, `/api/ai/**`, `GoogleGenerativeAI`, `OPENAI`/`ANTHROPIC`/`GEMINI` SDK — w naprawie `rewrite_slide` (patrz PUŁAPKA wyżej; to jest to samo co `Z15`, wypisane tu po imieniu, bo pokusa dopisania „prawdziwego” AI jest w tym dyżurze największa). **ZAKAZ rozszerzania zakresu na `shorten_slide` i `add_source`** — te dwie operacje NIE są zgłoszone jako kłamiące nazwą (a `add_source` ma już świeżą naprawę FIX-232 A2, `ODBIOR_230_232_FIX.md`) i dotykanie ich jest poza `Z17`. **ZAKAZ zmiany schematu tabeli `presentation_ai_operations`** ani jakiejkolwiek migracji — to jest naprawa logiki, nie danych. **ZAKAZ zmiany zachowania `add_source`/`verifyKnowledgeSourceUrl`** (`:559-…`) poza odczytem. | Trzeci filar marzenia właściciela o Gammie to dosłownie „agent, któremu mówisz co zmienić, i to się zmienia” (`docs/functional/12_prezentacje/README.md`, cytat 1.09.2026). Dziś to zdanie jest prawdziwe dla dwóch z pięciu operacji **przez przypadek składniowy** (dopisywanie tekstu, wpisywanie identyfikatora), nie przez rozumienie polecenia — a dla dwóch pozostałych (`split_slide`, `change_archetype`) mechanika jest wręcz szkodliwa: może przeciąć zdanie w środku wyrazu, wygenerować kolidujący identyfikator karty, albo wpisać do renderera layout, którego renderer nie zna. Dopóki nazwy kłamią, każdy konsultant klikający „przeredaguj” dostaje fałszywe poczucie, że system rozumiał polecenie. To nie jest kosmetyka — to jest różnica między produktem, który dotrzymuje obietnicy, a produktem, który tylko wygląda, jakby ją dotrzymywał. |

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
cd /private/tmp/cx-day255-nazwy-agenta

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day255-pg psql -U postgres -d cx255 \
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
cd /private/tmp/cx-day255-nazwy-agenta

docker run -d --name cx-day255-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx255 \
  -p 127.0.0.1:6250:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day255-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6250/cx255 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6250/cx255 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day255-nazwy-agenta && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6250/cx255 \
JWT_SECRET=cx255-test-secret-do-not-reuse \
npx vitest run server/src/services/__tests__/day255-presentationAgentEditService.splitSlideWordBoundary.test.ts server/src/services/__tests__/day255-presentationAgentEditService.changeArchetypeValidation.test.ts server/src/services/__tests__/day255-presentationAgentEditService.rewriteSlideHonestName.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day255-nazwy-agenta-artefakty/day255-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day255-nazwy-agenta && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/__tests__/day255-presentationAgentEditService.splitSlideWordBoundary.test.ts server/src/services/__tests__/day255-presentationAgentEditService.changeArchetypeValidation.test.ts server/src/services/__tests__/day255-presentationAgentEditService.rewriteSlideHonestName.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day255-nazwy-agenta-artefakty/day255-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day255-nazwy-agenta/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day255-pg psql -U postgres -d cx255 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day255-pg`.
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
> **(e) ★★ NAPIĘCIE `Z15` (zero modelu językowego w tym dyżurze) KONTRA NAZWA „PRZEREDAGUJ”. Prawdziwe redagowanie treści przez model wymagałoby wołania `llmService` — a `Z15` jest częścią rdzenia bezpieczników wspólnych dla WSZYSTKICH dyżurów tej serii i NIE jest do wyłączenia przez pojedynczy dyżur bez decyzji właściciela. Rozstrzygnięcie dla `rewrite_slide` w TYM dyżurze: **NIE wolno Ci dopisać wołania modelu** — jedyna zgodna z `Z15` naprawa to **uczciwe przemianowanie operacji** (typ wewnętrzny, treść odpowiedzi agenta, ewentualne wyzwalacze regexowe w `parsePresentationEditIntent`) tak, żeby nazwa opisywała DOKŁADNIE to, co kod robi dziś („podmień treść slajdu po dwukropku”, nie „przeredaguj”), plus jawny wpis w raporcie: „prawdziwe redagowanie przez model to osobny dyżur z jawną zgodą właściciela na wyłączenie `Z15` dla tego zakresu”. `split_slide` i `change_archetype` NIE mają tego napięcia — obie naprawy są w 100% deterministyczne (podział po granicy słowa, walidacja przeciw znanej liście) i NIE wymagają modelu.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day255-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day255-nazwy-agenta-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (weryfikacja trzech zmierzonych linii + kontrola pułapki Z15) · R2 (naprawa `split_slide` — granica słowa + identyfikator bez kolizji) · R3 (naprawa `change_archetype` — walidacja przeciw `isArchetypeId`) · R4 (rozstrzygnięcie `rewrite_slide` — uczciwe przemianowanie, bez modelu) · R5 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6250` albo `5230 i 5231` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6250` albo `5230 i 5231`** (`Z7`).

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

Trzeci filar marzenia właściciela o Gammie (Prezentacje) to dosłownie „agent, któremu
mówisz co zmienić, i to się zmienia” (`docs/functional/12_prezentacje/README.md`, cytat
1.09.2026). `server/src/services/presentationAgentEditService.ts` implementuje pięć
operacji redakcyjnych za flagą `ENABLE_TERESA_DECK_EDIT` (domyślnie `false`). Trzy z nich
— `rewrite_slide` („przeredaguj”), `split_slide` („podziel slajd”), `change_archetype`
(„zmień archetyp”) — robią coś innego, niż deklaruje nazwa:

- `rewrite_slide` (`:512-522`) nic nie redaguje. Wkleja dosłownie tekst z polecenia
  użytkownika PO PIERWSZYM DWUKROPKU (`String(prompt).split(':').slice(1).join(':').trim()`).
  Zero wołania modelu językowego.
- `split_slide` (`:524-547`) tnie treść w połowie liczby ZNAKÓW
  (`Math.ceil(text.length / 2)`, `:534`), nie słów — może przeciąć zdanie w środku wyrazu.
  Nowy `card_id` buduje ze znacznika czasu `Date.now()` (`:540`) — kolizja gwarantowana
  przy dwóch podziałach w tej samej milisekundzie (np. dwa kliknięcia w pętli testowej
  albo dwóch równoległych requestach tego samego decka).
- `change_archetype` (`:549-557`) wyciąga nazwę archetypu z regexu w poleceniu użytkownika
  i wpisuje ją PROSTO do `cards[index].layout_id` (`:554`) **bez żadnej walidacji** przeciw
  liście dozwolonych archetypów.

**Gotowe znalezisko, nie trzeba go szukać:** walidator `isArchetypeId(id)` już istnieje w
`server/src/services/deliverables/slideArchetypes.ts:508`, obok `SLIDE_ARCHETYPES`
(`:502`) i `getArchetype()` (`:513`). Zero importerów tego walidatora w
`presentationAgentEditService.ts` (zweryfikuj `R1`, komenda 5). Nie trzeba go napisać —
trzeba go zacząć wołać.

Dopóki nazwy kłamią, każdy konsultant klikający „przeredaguj” dostaje fałszywe poczucie,
że system zrozumiał polecenie. To nie jest kosmetyka nazewnicza — dla `split_slide` i
`change_archetype` mechanika jest dziś wręcz szkodliwa (przecięte zdanie, kolidujący
identyfikator, layout, którego renderer nie zna).

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `rewrite_slide` wkleja dosłownie tekst po dwukropku, zero wołania modelu | `R1`, komenda (1) |
| T2 | `split_slide` tnie w połowie liczby ZNAKÓW, nie słów, może przeciąć wyraz | `R1`, komenda (2) |
| T3 | `split_slide` buduje `card_id` ze znacznika czasu `Date.now()` — możliwa kolizja | `R1`, komenda (3) |
| T4 | `change_archetype` wpisuje `layout_id` BEZ walidacji przeciw liście archetypów | `R1`, komenda (4) |
| T5 | Walidator `isArchetypeId()` już istnieje i NIE jest tu wołany | `R1`, komenda (5) |
| T6 | Cała ścieżka rozpoznawania intencji jest dziś czysto regexowa, zero modelu | `R1`, komenda (6) |
| T7 | Front (`AgentPanel.tsx`) to wolne pole tekstowe, bez twardo zakodowanych PL etykiet operacji | `R1`, komenda (7) |
| T8 | Flaga `ENABLE_TERESA_DECK_EDIT` jest domyślnie `false` | `R1`, komenda (8) |
| T9 | Miejsce na dysku wystarcza | `R1`, komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — WERYFIKACJA STANU NA WŁASNYM SHA (rdzeń, warunek wejścia)

Wykonaj wszystkie 9 komend `§0.1`. Zapisz w raporcie wynik KAŻDEJ z dziewięciu tez — TAK
potwierdzona / NIE obalona, z dosłownym wklejonym wynikiem komendy. **Jeżeli którakolwiek
teza jest obalona na Twoim SHA (np. numery linii się przesunęły, albo ktoś już naprawił
jedną z trzech operacji) — opisz to w „Korektach wobec instrukcji” i dostosuj zakres R2-R4,
NIE zatrzymuj dyżuru.** Linie cytowane w tej instrukcji pochodzą z pomiaru na SHA
`df7f13056f` — Twoim obowiązkiem jest powtórzyć pomiar na SWOIM markerze, nie przepisać
mój.

Zwróć też uwagę na `T7` — front dziś NIE ma (w mojej wstępnej weryfikacji) twardo
zakodowanych polskich etykiet operacji jako osobnych przycisków; panel jest wolnym polem
czatu. Jeżeli `R1` znajdzie inaczej (np. przyciski szybkich akcji z etykietami
„Przeredaguj”/„Podziel”/„Zmień archetyp”), dopisz do zakresu R4 zmianę tych etykiet w
`AgentPanel.tsx` w tym samym duchu (nazwa = to, co kod robi), i zapisz to jako korektę.

## R2 — NAPRAW `split_slide`: GRANICA SŁOWA + IDENTYFIKATOR BEZ KOLIZJI (rdzeń)

Dwie niezależne naprawy w tym samym bloku (`:524-547`):

**a) Cięcie na granicy słowa, nie na indeksie znaku.** Zamiast
`Math.ceil(text.length / 2)` (`:534`), znajdź najbliższy odstęp (spację/nową linię) do
środka tekstu — cięcie NIGDY nie może wypaść w środku wyrazu. Zachowaj istniejące
zachowanie brzegowe (tekst bez spacji — jedno słowo — pozostaje niepodzielony
sensownie; zdecyduj i opisz w raporcie, co się wtedy dzieje: fallback na stare cięcie
znakowe, czy operacja no-op z komunikatem).

```ts
// szkic kierunku — dostosuj do istniejących typów, sprawdź `firstBlocks[0].content.text`
function splitAtWordBoundary(text: string): { first: string; second: string } {
  const mid = Math.ceil(text.length / 2);
  // szukaj najbliższej spacji w obu kierunkach od `mid`
  let left = text.lastIndexOf(' ', mid);
  let right = text.indexOf(' ', mid);
  const splitAt =
    left === -1 && right === -1
      ? mid // brak spacji w ogóle — fallback na stare zachowanie, opisz w raporcie
      : right === -1 || (left !== -1 && mid - left <= right - mid)
        ? left
        : right;
  return { first: text.slice(0, splitAt).trim(), second: text.slice(splitAt).trim() };
}
```

**b) Identyfikator karty bez kolizji.** Zamiast `${card.card_id || 'card'}-split-${Date.now()}`
(`:540`), użyj generatora, który NIE koliduje przy dwóch podziałach w tej samej
milisekundzie — `randomUUID()` (już używany gdzie indziej w repo, sprawdź import wzorca w
`R1` przed pisaniem) albo licznik/`crypto.randomUUID().slice(0,8)` doklejony do
`Date.now()`. **Dowód: test, który wykonuje DWA `split_slide` w tej samej pętli
synchronicznej (bez `await` między nimi) i sprawdza, że wynikowe `card_id` są różne** —
to jest dokładnie scenariusz, w którym stary kod kolidował.

Napisz `server/src/services/__tests__/day255-presentationAgentEditService.splitSlideWordBoundary.test.ts`:
- przypadek z tekstem zawierającym spacje blisko środka → cięcie NIE przecina wyrazu
  (asercja: żadna z dwóch połówek nie kończy/zaczyna się w środku alfanumerycznego tokenu
  bez separatora)
- dwa `split_slide` wykonane bez `await` między nimi → dwa różne `card_id`
- **dowód mutacyjny (`Z32`):** cofnij naprawę (a) przez `cp` starej wersji funkcji →
  pierwszy test czerwony; przywróć → zielony. To samo dla (b).

## R3 — NAPRAW `change_archetype`: WALIDACJA PRZECIW `isArchetypeId` (rdzeń)

W bloku `:549-557`, PRZED przypisaniem `cards[index].layout_id = layoutId` (`:554`),
zaimportuj i wywołaj `isArchetypeId` z `server/src/services/deliverables/slideArchetypes.ts`.
Kiedy regex znajdzie nazwę, która NIE jest poprawnym archetypem — operacja MUSI się nie
wykonać dla tej karty (nie dopisywać `appliedActions`) i zwrócić czytelny komunikat
błędu do agenta (sprawdź `R1`, jak `PresentationEditResult`/`reply` niesie dziś komunikaty
o pominiętych kartach — reużyj ten kanał, nie twórz nowego).

```ts
// szkic kierunku — dostosuj sygnaturę do istniejącego importu w pliku
import { isArchetypeId } from './deliverables/slideArchetypes.js';
// ...
if (plan.editorialOperation === 'change_archetype') {
  const match = String(prompt).match(/(?:archetyp|archetype).*?(?:na|to)\s+([a-z0-9_-]+)/i);
  const layoutId = match?.[1];
  const invalidAttempts: string[] = [];
  for (const index of plan.targetSlides) {
    if (!cards[index] || isProtected(index) || !layoutId) continue;
    if (!isArchetypeId(layoutId)) {
      invalidAttempts.push(layoutId);
      continue;
    }
    cards[index].layout_id = layoutId;
    appliedActions.push(`change_archetype:${index + 1}:${layoutId}`);
  }
  // dopisz invalidAttempts do komunikatu zwrotnego, jeśli niepuste — sprawdź istniejący
  // kanał komunikatów w tej funkcji (np. `plan.noOpReason` albo osobne pole)
}
```

Napisz `server/src/services/__tests__/day255-presentationAgentEditService.changeArchetypeValidation.test.ts`:
- poprawny archetyp z listy `SLIDE_ARCHETYPES` → `layout_id` zmieniony, `appliedActions`
  zawiera wpis
- nazwa spoza listy (np. `"nieistniejacy_archetyp_xyz"`) → `layout_id` karty NIE zmieniony
  (porównaj wartość przed/po), operacja zwraca czytelny komunikat o odrzuceniu
- **dowód mutacyjny:** usuń wywołanie `isArchetypeId` → test drugi czerwony; przywróć →
  zielony.

## R4 — ROZSTRZYGNIĘCIE `rewrite_slide`: UCZCIWE PRZEMIANOWANIE, BEZ MODELU (rdzeń)

★★ Napięcie `Z15` (zero wołania modelu językowego w tym dyżurze) kontra nazwa
„przeredaguj”. Prawdziwe redagowanie wymagałoby `llmService` — **ZAKAZANE w tym dyżurze**
(patrz `ZAKAZ_WLASCIWY_TEMU_DYZUROWI` w części A). Jedyna zgodna z `Z15` naprawa: uczciwe
przemianowanie operacji tak, żeby nazwa opisywała DOKŁADNIE to, co kod robi dziś.

Zakres przemianowania (dostosuj do tego, co `R1` faktycznie znajdzie w każdym miejscu):
- typ wewnętrzny/identyfikator operacji `rewrite_slide` w kodzie serwera — **NIE
  zmieniaj**, jeśli zmiana wymagałaby migracji danych w `presentation_ai_operations`
  (zakazane, patrz ZAKAZ). Jeśli to tylko literał string w logice (nie w schemacie bazy),
  możesz rozważyć zmianę — rozstrzygnij i uzasadnij w raporcie.
- treść odpowiedzi agenta do użytkownika, kiedy ta operacja się wykonuje — PL i EN,
  zamiast sugerować „przeredagowałem”, napisz coś w duchu „podmieniłem treść slajdu na
  podany tekst” (dobierz brzmienie spójne z resztą UX, sprawdź istniejące komunikaty w
  `R1`)
- wszelkie wyzwalacze regexowe w `parsePresentationEditIntent` (`:62-206`), które dziś
  rozpoznają słowo „przeredaguj”/„rewrite” jako trigger tej operacji — zostają (to
  poprawne rozpoznanie INTENCJI użytkownika), zmienia się TYLKO to, co dzieje się PO
  rozpoznaniu i jak system o tym mówi

Dopisz w raporcie jawne zdanie: „prawdziwe redagowanie treści przez model językowy to
osobny dyżur, wymagający jawnej zgody właściciela na wyłączenie `Z15` dla tego zakresu —
NIE zrobione w tym dyżurze, świadomie”.

Napisz `server/src/services/__tests__/day255-presentationAgentEditService.rewriteSlideHonestName.test.ts`:
- wykonaj `rewrite_slide` i sprawdź, że komunikat zwrotny do użytkownika NIE sugeruje
  redagowania/zrozumienia treści przez model (np. nie zawiera słów typu „przeanalizowałem”/
  „poprawiłem styl” — dopasuj do faktycznie znalezionych sformułowań w `R1`)
- test dokumentacyjny/kontraktowy: zachowanie samej podmiany tekstu (wklejenie po
  dwukropku) pozostaje NIEZMIENIONE — to NIE jest regresja tego dyżuru, tylko uczciwe
  nazwanie istniejącego zachowania

## R5 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, tabela 9 tez z `R1` w całości z dosłownymi wynikami komend,
`R2`-`R4` z pełnymi dowodami (w tym oba dowody mutacyjne), sekcja „TWIERDZENIA
NIEZWERYFIKOWANE” (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji”
(obowiązkowa nawet pusta — w szczególności: czy `T7` (front bez twardych etykiet) się
potwierdziła; czy któraś z trzech operacji miała już częściową naprawę na Twoim SHA, której
nie przewidziałem; jak dokładnie rozstrzygnąłeś przemianowanie `rewrite_slide`).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (PEŁNA, `R2`-`R4`) | `server/src/services/presentationAgentEditService.ts` — WYŁĄCZNIE funkcja `applyPresentationEditPlan` i jej bezpośrednie zależności importowane w tym pliku; zakaz zmiany `parsePresentationEditIntent` poza tym, co `R4` jawnie dopuszcza (wyzwalacze regexowe zostają) |
| Zapis (PEŁNA, NOWE PLIKI, `R2`-`R4`) | `server/src/services/__tests__/day255-presentationAgentEditService.splitSlideWordBoundary.test.ts` · `server/src/services/__tests__/day255-presentationAgentEditService.changeArchetypeValidation.test.ts` · `server/src/services/__tests__/day255-presentationAgentEditService.rewriteSlideHonestName.test.ts` (`git add -f`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY255_NAZWY_AGENTA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/deliverables/slideArchetypes.ts` (walidator do POWIELENIA przez import, nie do zmiany) · `src/components/Presentations/DeckBuilder/AgentPanel.tsx` · `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` · `server/src/routes/presentations.routes.ts` (trasy `agent-edit`, tylko odczyt — nie zmieniasz kontraktu tras) · `server/src/config/FeatureFlags.ts` (odczyt WYŁĄCZNIE — potwierdzasz wartość domyślną, nie zmieniasz) |
| Odczyt (ZAKAZ ZAPISU) | `docs/functional/12_prezentacje/README.md` · `docs/program/funkcje/ODBIOR_230_232_FIX.md` (kanoniczne, nie Twoje do zmiany) |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **`R1` JEST WARUNKIEM WEJŚCIA DO `R2`-`R4`.** Nie naprawiasz żadnej z trzech operacji,
  dopóki wszystkie 9 tez nie są zweryfikowane na TWOIM markerze z dosłownym wynikiem.
- ★★ **ZAKAZ WOŁANIA MODELU JĘZYKOWEGO w naprawie `rewrite_slide` (`R4`).** To jest
  najostrzejszy zakaz tego dyżuru — pokusa dopisania „prawdziwego” AI jest tu największa.
  Naprawa to WYŁĄCZNIE uczciwe nazewnictwo.
- ★ **`split_slide` i `change_archetype` (`R2`, `R3`) są w 100% deterministyczne** — podział
  po granicy słowa, walidacja przeciw znanej liście. Nie potrzebują modelu i nie wolno im
  go dodawać.
- ★ **Dowód mutacyjny (`Z32`) obowiązkowy dla `R2` i `R3`** — cofnij naprawę, pokaż
  czerwono, przywróć przez `cp` (`Z27` — nigdy `git stash`), pokaż zielono, `git diff`
  czysty.
- ★ **`Z10`/`Z11`:** zero nowych flag, `ENABLE_TERESA_DECK_EDIT` zostaje `false`.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy bez
  `RUN_DB_TESTS=1` · `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` ·
  `tests/setup.ts:896` podmienia `global.fetch` · `Z31` (strażnik realdb bez argumentów).
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.

# INSTRUKCJA DYŻURU nr 332 — Codex — „★ SPROSTOWANIE PRZED STARTEM: dyżur 318 R1-R4 jest już SCALONY do HEAD (commit `6539f82a9a` i trzy kolejne) — detekcja podmiotu-zdefiniowanego-w-pliku-testu ISTNIEJE i działa, `api-extensions.test.ts` jest USUNIĘTY, próg bezpiecznika stoi na `candidates:17` (nie 21); ten dyżur NIE buduje detektora od zera, tylko (a) rozstrzyga mutacyjnie 8 pozostałych kandydatów `NOT_PROVEN` (nie 12 — 9 z 17 już rozstrzygnięte w rejestrze dowodów), (b) ręcznie przegląda i klasyfikuje 64 pliki (nie 13 — detektor już policzył realną liczbę), które detektor oznaczył jako niemające ŻADNEGO importu z `src/`/`server/src/` mimo lokalnie zdefiniowanego podmiotu testowego, (c) naprawia potwierdzony przykład `MessageBubble.test.tsx`, które renderuje własną atrapę zamiast realnego komponentu"

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
> **wyłącznie** `/private/tmp/cx-day332-testy-puste-reszta`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c3d3da844ae03c87985a8f5dc74846a073c0220`**
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
Zakres: **Bezpiecznik testów pustych — dokończenie po scaleniu dyżuru 318: 8 kandydatów NOT_PROVEN + triage 64 plików bez importu produktu + naprawa MessageBubble.test.tsx**.
Trasy front: ``tests/components/AIChat/MessageBubble.test.tsx` (★ POTWIERDZONY przykład — deklaruje `const MessageBubble = () => <div data-testid="message-bubble">...` linia 7 i renderuje TĘ atrapę, nigdy nie importuje `src/components/AIChat/Messages/MessageBubble.tsx`), pozostałe pliki z listy `selfDefinedSubjects` (64 bez importu — pełna lista w wyjściu JSON skanera, pole `selfDefinedSubjectsWithoutProductImports`)`. Trasy tył: ``scripts/dev/testy-puste-skan.mjs` (skaner, już rozbudowany o detekcję podmiotu — `Z18`-podobny plik narzędziowy, NIE test), `tests/unit/config/noEmptyAssertions.test.ts` (bezpiecznik podłogowy, `BASELINE.candidates=17`), pliki produkcyjne pod 8 pozostałymi kandydatami: `server/src/routes/__tests__/table-platform.routes.test.ts` (E0003), `tests/components/Initiatives/CandidatesTable.t28.test.tsx` (E0008), `tests/integration/ai/ollama.integration.test.ts` (E0009/E0010/E0011), `tests/integration/pmo-project-members.integration.test.ts` (E0013), `tests/integration/services/workbook.p23ext.test.ts` (E0014), `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx` (E0001)`.

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
WT=/private/tmp/cx-day332-testy-puste-reszta
MARKER=1c3d3da844ae03c87985a8f5dc74846a073c0220

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day332-testy-puste-reszta-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day332-testy-puste-reszta/config.worktree"
cat "$VAULT/worktrees/cx-day332-testy-puste-reszta/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day332-testy-puste-reszta-scratch
mkdir -p /private/tmp/cx-day332-testy-puste-reszta-artefakty

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
git -C "$VAULT" log --oneline 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day332-testy-puste-reszta-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# (1) TEZA: dyzur 318 R1-R4 jest JUZ SCALONY do HEAD — nie zaczynasz od zera
git log --oneline -5 -- scripts/dev/testy-puste-skan.mjs
#   oczekiwane: commit `6539f82a9a feat(testy-puste): detekcja podmiotu...` widoczny w historii tego pliku na Twoim markerze

# (2) TEZA: api-extensions.test.ts JUZ USUNIETY
ls tests/unit/services/api-extensions.test.ts
#   oczekiwane: "No such file or directory"

# (3) TEZA: podloga bezpiecznika stoi na candidates:17, NIE 21
grep -n "candidates:" tests/unit/config/noEmptyAssertions.test.ts
#   oczekiwane: `candidates: 17`

# (4) TEZA: skaner ZWRACA JUZ pole selfDefinedSubjects i selfDefinedSubjectsWithoutProductImports
node scripts/dev/testy-puste-skan.mjs > /tmp/day332-scan.json 2>&1
python3 -c "import json; d=json.load(open('/tmp/day332-scan.json')); print('files',d['files'],'blocks',d['blocks'],'candidates',d['candidates']); print('selfDefinedSubjects total', len(d['selfDefinedSubjects'])); print('bez importu', d['selfDefinedSubjectsWithoutProductImports'])"
#   oczekiwane: pole istnieje; "bez importu" rzedu 60-70 (NIE 13 — to jest zmierzona, wieksza liczba, zapisz swoja)

# (5) TEZA: MessageBubble.test.tsx jest w tej liscie, hasProductImport=False
python3 -c "import json; d=json.load(open('/tmp/day332-scan.json')); print([x for x in d['selfDefinedSubjects'] if 'MessageBubble' in x['file']])"
#   oczekiwane: jeden wpis, hasProductImport=False, subject 'MessageBubble'

# (6) TEZA: rejestr dowodow 04.09 ma JUZ 9 rozstrzygniec (2 PUSTY z 309-line + 2 PUSTY billingCron dnia 318 + 5 NIE PUSTY), 8 zostaje NOT_PROVEN
grep -c "PUSTY\|NIE PUSTY\|NOT_PROVEN" docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md
grep -c "NOT_PROVEN" docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md
#   oczekiwane: 8 wierszy NOT_PROVEN w tabeli "Dyzur 318 — dowody wlasne"

# (7) TEZA: REJESTR_TESTY_PUSTE_20260903.md jest GENEROWANY, nadpisuje sie przy kazdym uruchomieniu skanera
head -3 docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md
#   oczekiwane: brak nagłówka "pisany ręcznie" — to jest plik generatora, nie edytujesz go recznie

# (8) TEZA: plik i18n nie maleje (kontrola bazowa)
wc -l public/locales/pl/translation.json public/locales/en/translation.json
#   oczekiwane: co najmniej tyle, ile masz na wejsciu — zapisz swoja linie bazowa, nie liczbe z tej instrukcji

# (9) dysk, porty, kontener
df -h /
lsof -nP -iTCP:6358 -sTCP:LISTEN; lsof -nP -iTCP:5498 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day332 || true
#   oczekiwane: powyzej 5 GB wolnego dysku; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day332-testy-puste-reszta-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6358`. Twój JEDYNY port harnessu to `5498`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day332-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 5432, 5433, 6012, 6379. Rodzeństwo paczki 04.09: 330 (6356/5496), 331 (6357/5497), 333 (6359/5499) — nie dotykasz. ★ ZAKAZ `pkill`/`killall``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak. Ten dyżur nie dodaje żadnej flagi funkcyjnej produktu — cały zakres to naprawa/klasyfikacja testów i rozbudowa raportowania skanera`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY332_TESTY_PUSTE_RESZTA_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU`, dopisek do `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` pod istniejącą treścią (nowa sekcja "Dyżur 332 — triage 64 plików bez importu + rozstrzygnięcie 8 NOT_PROVEN"). **ZAKAZ ręcznej edycji `REJESTR_TESTY_PUSTE_20260903.md`** — to jest wyjście generatora, regenerujesz je uruchamiając skaner. Kod: `scripts/dev/testy-puste-skan.mjs` (rozbudowa raportowania triage, nie przepisanie detekcji), pliki testowe z tabeli triage, `MessageBubble.test.tsx`. Nowe pliki w `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day332-testy-puste-reszta-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day332-testy-puste-reszta-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ przepisywania detekcji podmiotu-w-pliku-testu od zera** — ona już istnieje i działa (`6539f82a9a`), wolno ją WYŁĄCZNIE rozszerzyć o pole raportujące klasyfikację triage. **ZAKAZ traktowania liczby 13 z historycznych dokumentów jako aktualnej** — Twój własny pomiar (rzędu 60-70) jest wiążący. **ZAKAZ automatycznego nadawania klasy `PUSTY`/`MARTWE` bez dowodu mutacyjnego lub bez faktycznego potwierdzenia (jak w `MessageBubble.test.tsx`), że plik renderuje WŁASNĄ atrapę pod nazwą realnego komponentu** — nazwany harness/mock (`Harness`, `Probe`, `TestHarness`) NIE jest automatycznie defektem, jeśli nie udaje nazwy realnego komponentu produktu. **ZAKAZ usuwania testu bez dowodu, że brak w nim jakiegokolwiek celu** (wzorem R3 dyżuru 318 dla `api-extensions.test.ts`, który już wykonano). **ZAKAZ obniżania `BASELINE.files` i podnoszenia `BASELINE.candidates`/`skipped` w `noEmptyAssertions.test.ts`** | Rejestr dowodów z 04.09 sam ostrzega: „Do następnego dyżuru: 1. Rozszerzyć skaner... 2. Rozstrzygnąć mutacją pozostałe... 3. Usunąć albo naprawić api-extensions.test.ts” — ale DWA z tych trzech punktów są już zrobione i scalone (`6539f82a9a` + usunięcie pliku), a trzeci (mutacja pozostałych kandydatów) jest częściowo zrobiony (9 z 17 rozstrzygniętych). Instrukcja, która każe budować to, co już istnieje, marnuje cały dyżur na odkrywanie tego faktu zamiast na realną robotę — stąd sprostowanie na samej górze tego dokumentu |

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
cd /private/tmp/cx-day332-testy-puste-reszta

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day332-pg psql -U postgres -d cx332 \
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
cd /private/tmp/cx-day332-testy-puste-reszta

docker run -d --name cx-day332-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx332 \
  -p 127.0.0.1:6358:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day332-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6358/cx332 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6358/cx332 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day332-testy-puste-reszta && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6358/cx332 \
JWT_SECRET=cx332-test-secret-do-not-reuse \
npx vitest run `node scripts/dev/testy-puste-skan.mjs` (z roota, bez env DB); testy pojedynczych kandydatów zawsze `--retry=0`; testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6358/cx332`; dowody mutacyjne obowiązkowe dla każdego z 8 kandydatów NOT_PROVEN, gdzie da się bezpiecznie zbudować zielony kierunek bez naruszenia `Z15`(zero LLM/sieci żywej)/`Z30`(zero wysyłki)/`Z31`(strażnik bez argumentów); tam gdzie się nie da (np. `ollama.integration.test.ts` wymaga żywego `localhost:11434`, `pmo-project-members.integration.test.ts` importuje `server/src/index.ts` wprost) — dokumentujesz uczciwą przyczynę i zostawiasz `NOT_PROVEN`, to jest dopuszczalny wynik --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day332-testy-puste-reszta-artefakty/day332-testy-puste-reszta.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day332-testy-puste-reszta && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `node scripts/dev/testy-puste-skan.mjs` (z roota, bez env DB); testy pojedynczych kandydatów zawsze `--retry=0`; testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6358/cx332`; dowody mutacyjne obowiązkowe dla każdego z 8 kandydatów NOT_PROVEN, gdzie da się bezpiecznie zbudować zielony kierunek bez naruszenia `Z15`(zero LLM/sieci żywej)/`Z30`(zero wysyłki)/`Z31`(strażnik bez argumentów); tam gdzie się nie da (np. `ollama.integration.test.ts` wymaga żywego `localhost:11434`, `pmo-project-members.integration.test.ts` importuje `server/src/index.ts` wprost) — dokumentujesz uczciwą przyczynę i zostawiasz `NOT_PROVEN`, to jest dopuszczalny wynik --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day332-testy-puste-reszta-artefakty/day332-testy-puste-reszta.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day332-testy-puste-reszta/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day332-pg psql -U postgres -d cx332 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day332-pg`.
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
> **(e) ★★ Detektor `selfDefinedSubjects` (już zbudowany) łapie WSZYSTKIE lokalnie zdefiniowane komponenty PascalCase użyte jako JSX/wywołanie bez pasującego importu z `src`/`server/src` — to obejmuje zarówno prawdziwe atrapy-podszywające-się-pod-produkt (`MessageBubble`) JAK I legalne wzorce testowe nazwane `Harness`/`Probe`/`TestHarness`/`MobileHarness`/`LocationProbe`, które nie udają żadnego realnego komponentu. **Nie każdy wpis na liście 64 jest defektem** — Twoim zadaniem w R1 jest odróżnić jedno od drugiego z uzasadnieniem per plik, nie oznaczyć wszystkie hurtem**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day332-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day332-testy-puste-reszta-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (odczyt `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` w całości, uruchomienie skanera, potwierdzenie że 318 R1-R4 jest scalone) · R1 = triage 64 plików `selfDefinedSubjectsWithoutProductImports`: klasyfikacja każdego jako REALNY DEFEKT (podmienia nazwę realnego komponentu) albo UZASADNIONY WZORZEC (harness/mock nienazwany jak produkt), z tabelą w rejestrze dowodów · R2 = naprawa `MessageBubble.test.tsx` (import realnego komponentu, usunięcie atrapy) + naprawa pozostałych REALNYCH DEFEKTÓW znalezionych w R1 · R3 = mutacja pozostałych 8 kandydatów `NOT_PROVEN` tam, gdzie to bezpieczne (E0001, E0003, E0008 — napraw baseline/import, potem mutuj; E0009-E0011, E0013, E0014 — dokumentuj uczciwą przyczynę jeśli faktycznie zablokowane przez Z15/Z30/Z31) · R4 (raport zbiorczy + regeneracja `REJESTR_TESTY_PUSTE_20260903.md` przez skaner)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6358` albo `5498` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6358` albo `5498`** (`Z7`).

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

Dyżur 309 postawił bezpiecznik `noEmptyAssertions.test.ts` i odmówił zgadywania klasy `PUSTY` bez
dowodu mutacyjnego. Odbiorca adwersaryjny (04.09) wykonał pięć mutacji i rozstrzygnął pierwsze
kandydaty, zostawiając w `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` listę „Do następnego dyżuru":
rozbudować skaner o wykrywanie podmiotu-w-pliku-testu, rozstrzygnąć mutacją resztę kandydatów,
usunąć albo naprawić `api-extensions.test.ts`.

★ **Zanim zaplanujesz jakąkolwiek pracę: dwa z tych trzech punktów są już wykonane i scalone do
HEAD.** Dyżur 318 (commit `6539f82a9a` i trzy kolejne) rozbudował skaner o dokładnie tę detekcję
— funkcja `findSelfDefinedSubjects` istnieje, wyjście JSON niesie pola `selfDefinedSubjects` i
`selfDefinedSubjectsWithoutProductImports`, ze zweryfikowanym self-testem na fikstury
`MessageBubble`. `api-extensions.test.ts` jest usunięty. Próg bezpiecznika stoi dziś na
`candidates: 17` (nie 21 — cztery bloki zniknęły razem z usuniętym plikiem). Rejestr dowodów ma
już 9 rozstrzygnięć z 17: 4 `PUSTY` (`scimService`, `contentService`, i DWIE pozycje
`billingCron` — dyżur 318 rozstrzygnął OBIE, nie tylko jedną), 5 `NIE PUSTY`. **Zostaje 8
`NOT_PROVEN`**, każdy z udokumentowaną, uczciwą przyczyną (baseline czerwony, zerwany import,
zależność od żywej sieci zabronionej przez `Z15`, wymóg importu `server/src/index.ts` zabroniony
przez `Z30`/`Z31`).

Realny, jeszcze niewykonany trzon tego dyżuru jest inny niż mógłby sugerować stary rejestr: sam
detektor teraz **realnie liczy** pliki bez importu produktu — wychodzi rzędu 60-70 (nie 13, to
była tylko robocza ekstrapolacja jednego przykładu sprzed zbudowania detektora). **Ta lista nie
jest automatycznym wyrokiem `PUSTY`** — obejmuje zarówno prawdziwe atrapy podszywające się pod
nazwę realnego komponentu (potwierdzony przykład: `tests/components/AIChat/MessageBubble.test.tsx`
deklaruje `const MessageBubble = () => <div data-testid="message-bubble">...</div>` i renderuje
TĘ atrapę, nigdy nie importując `src/components/AIChat/Messages/MessageBubble.tsx`), jak i
legalne wzorce testowe nazwane `Harness`/`Probe`/`TestHarness`, które niczego nie udają. Ktoś
musi tę listę przejrzeć i rozstrzygnąć per plik — to jest praca ręczna, którą detektor celowo
zostawia człowiekowi.

## ★ Zmierz moje liczby sam

Twierdzę: skaner na moim markerze daje `files≈5403-5414`, `blocks≈42513`, `candidates:17`,
`skipped:0`, `gatedFiles:37`; rejestr dowodów ma 9 rozstrzygnięć (4 `PUSTY`, 5 `NIE PUSTY`), 8
`NOT_PROVEN`; `selfDefinedSubjects` niesie rzędu 190 wpisów, z czego rzędu 60-70 bez żadnego
importu z `src`/`server/src`; `MessageBubble.test.tsx` jest w tej liście z
`hasProductImport: false`. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój — zapisz
rozbieżność wprost, w szczególności jeśli różni się od liczb `13`/`21`/`12 pozostałych` z
historycznych dokumentów tego wątku: te liczby są STARE, sprzed scalenia 318.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Licencja | Zastępczy produkt |
| --- | --- | --- |
| `scripts/dev/testy-puste-skan.mjs` | **★ WĄSKA LICENCJA: wyłącznie rozszerzenie raportowania** (np. pole klasyfikacji triage per plik w `selfDefinedSubjects`). **ZAKAZ** przepisywania funkcji `findSelfDefinedSubjects` — ona działa i ma własny self-test | Czerwony kontrakt + brief |
| `tests/unit/config/noEmptyAssertions.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie stała `BASELINE.candidates` — wolno WYŁĄCZNIE obniżyć po realnym usunięciu/naprawie kandydata. **ZAKAZ** obniżania `files`, podnoszenia `candidates`/`skipped` | Czerwony kontrakt + brief |
| `tests/components/AIChat/MessageBubble.test.tsx` | **★ PEŁNA LICENCJA** — import realnego `src/components/AIChat/Messages/MessageBubble.tsx`, usunięcie atrapy lokalnej | — |
| Pliki z listy triage `selfDefinedSubjectsWithoutProductImports`, sklasyfikowane w R1 jako REALNY DEFEKT | **★ WĄSKA LICENCJA: wyłącznie naprawa importu/atrapy tego jednego pliku** | — |
| `server/src/routes/__tests__/table-platform.routes.test.ts`, `tests/components/Initiatives/CandidatesTable.t28.test.tsx`, `tests/integration/ai/ollama.integration.test.ts`, `tests/integration/pmo-project-members.integration.test.ts`, `tests/integration/services/workbook.p23ext.test.ts`, `src/components/Meeting/__tests__/MeetingHub.smoke.test.tsx` | **★ WĄSKA LICENCJA: wyłącznie blok `it` z tabeli `B.2` per plik, z dowodem mutacyjnym gdzie to bezpieczne** | Dokumentacja `NOT_PROVEN` z przyczyną, jeśli niebezpieczne |
| Pliki produkcyjne pod ośmioma kandydatami (np. `server/src/routes/table-platform.routes.ts` i analogiczne) | **★ WYŁĄCZNIE JAKO CEL MUTACJI DOWODOWEJ, ZAWSZE COFNIĘTEJ** (`Z32`/`Z27`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md` | **ZAKAZ EDYCJI RĘCZNEJ — WYŁĄCZNIE wyjście generatora**, regenerujesz uruchamiając skaner | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | **★ PEŁNA LICENCJA na DOPISYWANIE** nowej sekcji pod istniejącą treścią. **ZAKAZ kasowania cudzych wierszy** | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, jak obszedłeś to zmiennymi w linii komendy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY332_TESTY_PUSTE_RESZTA_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt rejestru + potwierdzenie stanu scalenia 318 | TAK | NIE | bazowe | 9 komend `§0.1` zmierzone, teza scalenia 318 potwierdzona | `node scripts/dev/testy-puste-skan.mjs` | brak |
| R1 | Triage 64 plików bez importu | TAK | NIE — dowód: `Z12` nie chroni `tests/`/`src/**/__tests__` | 1 nowa tabela | Każdy plik z listy sklasyfikowany REALNY DEFEKT / UZASADNIONY WZORZEC z uzasadnieniem, zapisany w rejestrze dowodów | plik triage w `evidence/day332/triage.md` | `docs(day332): triage 64 plikow bez importu produktu (332 R1)` |
| R2 | Naprawa `MessageBubble.test.tsx` + inne REALNE DEFEKTY z R1 | TAK | NIE | N dowodów mutacyjnych (N = liczba defektów z R1) | Każdy naprawiony plik importuje i renderuje realny komponent; test nadal zielony z realnym komponentem, czerwony gdy realny komponent zepsuty (dowód mutacyjny) | `npx vitest run <plik> --retry=0` przed/po mutacji | `fix(tests): <plik> renderuje realny komponent zamiast atrapy (332 R2)` |
| R3 | Mutacja 8 kandydatów NOT_PROVEN | TAK | NIE, poza wyjątkiem wiersza `Z12` na pliki produkcyjne (mutacja dowodowa, zawsze cofnięta) | do 8 dowodów | Każdy z ośmiu ma albo dowód mutacyjny w obie strony i nową klasę, albo udokumentowaną uczciwą przyczynę `NOT_PROVEN` (Z15/Z30/Z31/brak baseline) | per plik: `npx vitest run <plik> --retry=0` | commit per plik albo grupami pokrewnymi |
| R4 | Raport + regeneracja rejestru generowanego | NIE | NIE | n/d | Struktura `§R.2`, `node scripts/dev/testy-puste-skan.mjs` uruchomiony na końcu (regeneruje `REJESTR_TESTY_PUSTE_20260903.md`), TWIERDZENIA NIEZWERYFIKOWANE niepuste | — | `docs(day332): raport` |

> Żadna pozycja nie wymaga zmiany pliku przekrojowego poza mutacją dowodową (zawsze cofniętą).

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Pliki testowe | ≈5403-5414 (rośnie naturalnie, `BASELINE` używa `toBeGreaterThanOrEqual`) | `node scripts/dev/testy-puste-skan.mjs` → `files` | TAK |
| 2 | Kandydaci sieć/baza | 17 (nie 21 — spadło po usunięciu `api-extensions.test.ts` w 318) | jw. → `candidates` | TAK |
| 3 | Już rozstrzygnięci | 9 (4 `PUSTY`, 5 `NIE PUSTY`) | `cat docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | TAK |
| 4 | Pozostali `NOT_PROVEN` | 8 | 17 − 9 | TAK |
| 5 | Pliki `selfDefinedSubjects` (wszystkie) | ≈190 | jw. → `len(selfDefinedSubjects)` | TAK |
| 6 | Pliki bez ŻADNEGO importu produktu (triage) | ≈60-70 (ZMIERZ SWOJĄ — to NIE jest „13" z historycznych dokumentów) | jw. → `selfDefinedSubjectsWithoutProductImports` | TAK — to jest GŁÓWNA pozycja tego dyżuru |
| 7 | Potwierdzony przykład defektu | 1 (`MessageBubble.test.tsx`) | `python3 -c "...filter file contains MessageBubble..."` (patrz `§0.1` komenda 5) | TAK |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `tests/components/AIChat/MessageBubble.test.tsx` | istniejący | R2 | ZEROWE |
| 2 | Pliki triage sklasyfikowane REALNY DEFEKT (liczba nieznana z góry) | istniejące | R2 | NISKIE |
| 3 | Do 8 plików kandydatów `NOT_PROVEN` z `B.2` | istniejące | R3 | NISKIE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_DOWODY_20260904.md` | istniejący | R1,R3 | ŚREDNIE — plik ręczny, dopisujesz, nie nadpisujesz |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY332_TESTY_PUSTE_RESZTA_REPORT.md` | NOWY | R4 | ZEROWE |
| 6 | `scripts/dev/testy-puste-skan.mjs` (wąsko, raportowanie) | istniejący | R1 | NISKIE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| Pliki produkcyjne pod 8 kandydatami (np. `server/src/routes/table-platform.routes.ts`) | R3 | WYŁĄCZNIE tymczasowo w trakcie mutacji dowodowej; `git diff` po cofnięciu MUSI być pusty przed commitem |
| `tests/unit/config/noEmptyAssertions.test.ts` | R3 | Tylko jeśli liczba kandydatów spadnie po R3 (nigdy nie podnosisz) |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/Interview/** — dyżur 330
src/components/MyWork/**, server/src/services/report/** — dyżur 331
server/migrations/**, server/scripts/migrationOrdering.ts, tests/unit/backend/schema/** — dyżur 333
docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_TESTY_PUSTE_20260903.md (edycja ręczna) — generowany
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6358 | `lsof -nP -iTCP:6358 -sTCP:LISTEN` → puste |
| Port harnessu | 5498 | `lsof -nP -iTCP:5498 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day332-pg` | `docker ps` → brak |
| Nazwa bazy | `cx332` | n/d |
| Gałąź | `codex/day332-testy-puste-reszta-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day332-testy-puste-reszta` | nie istnieje |
| Flagi | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day332-testy-puste-reszta
git diff --name-only --cached | tee /private/tmp/cx-day332-testy-puste-reszta-artefakty/staged.txt
grep -iE 'Interview/|MyWork/|services/report/|migrationOrdering|REJESTR_TESTY_PUSTE_20260903' /private/tmp/cx-day332-testy-puste-reszta-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- server/src/routes/table-platform.routes.ts \
  && echo "★★ SPRAWDZ: czy to mutacja niecofnieta? Jesli TAK — cofnij przed commitem" \
  || echo "produkcja nietknieta OK"
```

---

## R0 — ODCZYT I POTWIERDZENIE STANU SCALENIA

Przeczytaj `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` w całości. Uruchom skaner, zapisz JSON do
artefaktów jako `przed.json`. Potwierdź na SWOIM markerze: `6539f82a9a` jest w historii pliku
skanera, `api-extensions.test.ts` nie istnieje, `BASELINE.candidates=17`, 9 rozstrzygnięć w
rejestrze, 8 `NOT_PROVEN`.

Prawo zatrzymania po tej pozycji.

## R1 — TRIAGE 64 PLIKÓW BEZ IMPORTU PRODUKTU

Dla każdego wpisu w `selfDefinedSubjectsWithoutProductImports` (pełna lista w polu
`selfDefinedSubjects` wyjścia JSON, filtrowana po `hasProductImport === false`): sprawdź, czy
nazwa lokalnie zdefiniowanego podmiotu (np. `MessageBubble`) odpowiada nazwie REALNEGO komponentu
gdzieś w `src/`/`server/src/` (np. `grep -rl "export.*function <Nazwa>\|export const <Nazwa>"
src/ server/src/`). Jeśli TAK i plik renderuje/wywołuje SWOJĄ lokalną definicję zamiast
importować tę realną — klasyfikuj **REALNY DEFEKT** (kształt „biblioteka bez wywołania"
przeniesiony do testów). Jeśli podmiot nazywa się `Harness`/`Probe`/`TestHarness`/`Mock*`/`Stub*`
i nie ma realnego komponentu o tej samej nazwie w produkcie — klasyfikuj **UZASADNIONY WZORZEC**
(legalny test double, nie udaje niczego). Zapisz tabelę: plik · nazwa podmiotu · klasa ·
uzasadnienie, dopisz do `REJESTR_TESTY_PUSTE_DOWODY_20260904.md` pod nową sekcją.

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA REALNYCH DEFEKTÓW

Zacznij od potwierdzonego przykładu: w `MessageBubble.test.tsx` usuń lokalną definicję
`const MessageBubble = () => ...`, zaimportuj realny `src/components/AIChat/Messages/
MessageBubble.tsx`, dostosuj props/render do realnego kontraktu komponentu. Uruchom test — musi
przejść z realnym komponentem. Dowód mutacyjny: zepsuj coś istotnego w realnym `MessageBubble.tsx`
(np. usuń renderowanie treści wiadomości), uruchom test ponownie — musi się zaczerwienić; przywróć
przez `cp` (`Z27`). Powtórz analogicznie dla każdego innego pliku sklasyfikowanego **REALNY
DEFEKT** w R1.

Prawo zatrzymania po tej pozycji.

## R3 — MUTACJA 8 KANDYDATÓW NOT_PROVEN

Dla każdego z ośmiu (`E0001, E0003, E0008, E0009, E0010, E0011, E0013, E0014` — zweryfikuj
dokładne ID we własnym rejestrze, mogą się różnić): sprawdź, czy przyczyna `NOT_PROVEN`
udokumentowana 318 nadal stoi (baseline czerwony z powodu zerwanego importu — spróbuj naprawić
import i dopiero wtedy zmutować; zależność od żywej sieci — `ollama.integration.test.ts` łamie
`Z15`, zostaw `NOT_PROVEN` z tym uzasadnieniem; import `server/src/index.ts` — łamie `Z30`/`Z31`
w pełnym uruchomieniu, sprawdź czy da się wyizolować handler bez pełnego bootstrapu, jeśli nie —
zostaw `NOT_PROVEN`). Tam gdzie da się bezpiecznie odblokować zielony kierunek (np. naprawić
zerwaną ścieżkę importu w `CandidatesTable.t28.test.tsx` albo w `table-platform.routes.test.ts`),
zrób to, a potem wykonaj pełną mutację w obie strony i nadaj klasę `PUSTY`/`NIE PUSTY`. Każde
rozstrzygnięcie (albo utrzymanie `NOT_PROVEN` z przyczyną) dopisz do rejestru dowodów z komendami
i wynikami obu kierunków.

Commit per kandydat albo grupami pokrewnymi (np. cała rodzina `ollama.integration.test.ts` jednym
commitem, jeśli wszystkie trzy zostają `NOT_PROVEN` z tą samą przyczyną).

Prawo zatrzymania po tej pozycji.

## R4 — RAPORT I REGENERACJA REJESTRU GENEROWANEGO

Tabela: kandydat · plik:linia · klasa · dowód (komenda + wynik obu kierunków) · commit. Tabela
triage 64 plików z klasą i uzasadnieniem. Stan naprawy `MessageBubble.test.tsx` i innych realnych
defektów. Na końcu uruchom `node scripts/dev/testy-puste-skan.mjs` jeszcze raz, żeby
`REJESTR_TESTY_PUSTE_20260903.md` odzwierciedlał finalny stan (plik jest generowany — nie
edytujesz go ręcznie, tylko regenerujesz). TWIERDZENIA NIEZWERYFIKOWANE — w szczególności
wszystko, czego triage R1 nie zdążył w pełni pokryć.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobiony (triage kompletny), R2 częściowo (3 z N
defektów naprawione), R3 rozpoczęty (2 z 8 rozstrzygnięte)" jest pełnowartościowym wynikiem.
Przepisanie już istniejącej pracy 318 jako „nowej" jest podstawą odrzucenia raportu.

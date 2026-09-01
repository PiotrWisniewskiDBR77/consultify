# INSTRUKCJA DYŻURU nr 211 — Codex — „Przemiatanie pułapki `clearAllMocks`: globalny `beforeEach(() => vi.clearAllMocks())` w `tests/setup.ts:809-811` w tej wersji Vitest (`^4.1.8`, `package.json`) kasuje IMPLEMENTACJĘ ustawioną przez `vi.spyOn(...).mockResolvedValue(...)`/`.mockImplementation(...)` w lokalnym `beforeAll` innego pliku testowego, nie tylko historię wywołań — dowiedzione izolowaną sondą w FIX-209 (`server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts`, commit `b363d107d0`, 31.08.2026). Skutek: pierwszy test w pliku widzi mocka, każdy kolejny cicho idzie prawdziwą ścieżką i milczy o tym. Ten dyżur robi CZTERY rzeczy: (R0) ustala SONDĄ dokładny kształt buga (potwierdzony tylko dla jednego wzorca — `spyOn/vi.fn().mockX()` łańcuchowo, NIE potwierdzony dla `vi.fn(bezpośrednia_implementacja)`); (R1) buduje pełny, SONDOWANY inwentarz plików testowych z tym wzorcem, z podziałem (a) realnie zagrożone / (b) niegroźne — **★★ własny pomiar wykonany PRZY PISANIU TEJ INSTRUKCJI na SHA `fe33ce8036` znajduje 4-6 plików, NIE 87** jak twierdzi `docs/program/funkcje/LISTA_DYZUROW_211_222.md:20` (twierdzenie BEZ cytowanej komendy pomiarowej) — rozbieżność jest CENTRALNYM zadaniem pomiarowym tego dyżuru, nie szczegółem; (R2) naprawia pliki z grupy (a) wzorem już istniejącym w repo (`artifactKnowledgeIndexer.pg.test.ts:44-63`); (R3) dokłada bezpiecznik do ISTNIEJĄCEGO `.husky/pre-commit` (9 strażników już tam jest, wzorzec `scripts/check-*.sh` + baseline ratchet jak `scripts/check-focus-canon.sh`), nie buduje nowego mechanizmu; (R4) mierzy, ile testów zmieniło wynik po naprawie — najciekawsza liczba dyżuru: ile zieleni było fałszywej. **`tests/setup.ts` sam jest pod `Z18` (najostrzejszy zakaz w programie) — ten dyżur go NIE dotyka.**"

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
> **wyłącznie** `/private/tmp/cx-day211-atrapy`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `fe33ce8036`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-31.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Infrastruktura testowa (nie moduł produktowy — zero UI, zero tras HTTP, zero flag produktowych). Rdzeń: `tests/setup.ts` (globalny harness Vitest, `beforeAll` `:790-793` + `beforeEach` `:809-811`, oba wołają `vi.clearAllMocks()`). Zasięg: KAŻDY plik testowy w repo, który instaluje implementację mocka (`.mockResolvedValue`/`.mockImplementation`/`.mockReturnValue`/`.mockRejectedValue`, albo `vi.fn(bezpośrednia_implementacja)`) wewnątrz WŁASNEGO lokalnego `beforeAll`. Kontrakt: brak dedykowanego dokumentu architektury dla tego wzorca — jedyne źródło to (1) komentarz naprawczy `artifactKnowledgeIndexer.pg.test.ts:44-59` (FIX-209, `b363d107d0`), (2) karta odbioru `docs/program/funkcje/ODBIOR_209.md:6-17,34-37`, (3) pozycja `docs/program/funkcje/LISTA_DYZUROW_211_222.md:16-22` (opis dyżuru 211, liczba `87` BEZ cytowanej komendy — do zweryfikowania). Bezpiecznik do rozbudowy: `.husky/pre-commit` (138 linii, 9 istniejących bramek `scripts/check-*.sh`) — wzorzec `scripts/check-focus-canon.sh` (ratchet + baseline JSON + `--ci`).**.
Trasy front: `BRAK. Ten dyżur nie dotyka UI, nie renderuje żadnego ekranu i nie ma zrzutów do zrobienia — przedmiotem pracy jest wyłącznie infrastruktura testowa i sam kod testów. `CLAUDE.md` §7 (zakaz bycia pierwszym testerem wizualnym) i §9 (zakaz masowego włączania flag) NIE MAJĄ zastosowania — nie ma tu żadnej flagi wizualnej ani ekranu do akceptu. Jeśli w trakcie pracy okaże się, że którykolwiek naprawiony plik dotyka komponentu `.tsx` (np. `tests/components/DocumentStudio/DocumentStudioDocumentPanel.exportUx.test.tsx` — jeden z kandydatów z rozszerzonej sondy, patrz `POZYCJE_RDZENIA`) — to nadal jest PLIK TESTOWY, nie zmiana komponentu produktowego; `src/components/DocumentStudio/**` pozostaje nietknięty.`. Trasy tył: `BRAK nowych tras HTTP i BRAK zmian w istniejących. Jedyny 'backend' tego dyżuru to sam harness testowy. Dla orientacji — jedyne miejsce w produkcie, które ten dyżur CZYTA (nie zmienia): `tests/setup.ts:788-794` (globalny `beforeAll`, komentarz `:792` "Ensure call history is cleared but implementations remain" — to zdanie jest DZIŚ FAŁSZYWE dla wzorca `spyOn(...).mockResolvedValue()` w lokalnym `beforeAll`, dowiedzione FIX-209) i `tests/setup.ts:808-811` (globalny `beforeEach`, ten sam `vi.clearAllMocks()`, komentarz `:810` "Ensure call history is cleared" — krótszy, bez fałszywej obietnicy o implementacjach, ale efekt ten sam). `Z18` (SZKIELET §0.2) zakazuje ABSOLUTNIE modyfikacji tego pliku, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdego `vitest.*.config.ts` i `tests/integration/_helpers/assertRealPostgres.ts` — R2 (naprawa) działa WYŁĄCZNIE przez przenoszenie instalacji mocka do lokalnego `beforeEach` KAŻDEGO dotkniętego pliku z osobna (wzorzec: `artifactKnowledgeIndexer.pg.test.ts:60-63`), nigdy przez zmianę globalnego zachowania `clearAllMocks`.`.

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
WT=/private/tmp/cx-day211-atrapy
MARKER=fe33ce8036

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day211-atrapy-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day211-atrapy/config.worktree"
cat "$VAULT/worktrees/cx-day211-atrapy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day211-atrapy-scratch
mkdir -p /private/tmp/cx-day211-atrapy-artefakty

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
git -C "$VAULT" log --oneline fe33ce8036..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only fe33ce8036..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day211-atrapy-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only fe33ce8036..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `piętnaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day211-atrapy

# (W1) POTWIERDŹ DOKŁADNE LINIE globalnego harnessu — WSZYSTKO poniżej to ODCZYT, Z18 zakazuje edycji
grep -n "beforeAll(async\|vi.clearAllMocks\|beforeEach(\|Ensure call history\|Global Setup\|Reset LLM API" tests/setup.ts
#   oczekiwane: beforeAll:790, komentarz-fałszywa-premisa:792, clearAllMocks:793,
#   beforeEach:809, komentarz:810, clearAllMocks:811. Jeśli linie się przesunęły — u Ciebie
#   wiążący jest plik (Z24), rozbieżność wpisz do raportu.

# (W2) POTWIERDŹ wersję Vitest i istnienie komentarza z fałszywą premisą
grep -n '"vitest"' package.json
sed -n '788,794p' tests/setup.ts
#   oczekiwane: ^4.1.8 (albo nowsza — zapisz dokładną), i literalny komentarz "Ensure call
#   history is cleared but implementations remain" tuż nad drugim clearAllMocks.

# (W3) POTWIERDŹ wzorzec naprawy FIX-209 — kopiujesz KSZTAŁT w R2, nie wymyślasz nowego
git log --oneline -- server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts
sed -n '38,70p' server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts
#   oczekiwane: commit b363d107d0 w logu; w treści pliku beforeAll BEZ mocka (tylko DB pool),
#   beforeEach z vi.spyOn(...).mockResolvedValue(...) i komentarzem FIX-209 tłumaczącym
#   dlaczego lokalny beforeEach przeżywa globalny clearAllMocks a beforeAll nie.

# (W4) ★★ POLICZ SAM liczbę plików z wzorcem — NIE PRZYJMUJ '87' bez pomiaru
for f in $(grep -rl "beforeAll" --include="*.test.ts" --include="*.test.tsx" --include="*.test.js" --include="*.test.jsx" --include="*.spec.ts" --include="*.spec.tsx" . 2>/dev/null | grep -v node_modules); do
  if grep -qE "\.mock(ResolvedValue|Implementation|ReturnValue|RejectedValue)\(" "$f"; then echo "$f"; fi
done | wc -l
#   To jest LUŹNA górna granica (współwystępowanie w CAŁYM pliku, nie w bloku beforeAll) —
#   przy pisaniu tej instrukcji dała 130 na SHA fe33ce8036. Prawdziwa liczba (setter
#   WEWNĄTRZ beforeAll, nie reinstalowany w lokalnym beforeEach) jest DUŻO mniejsza — zbuduj
#   sondę z dopasowaniem klamer (block-matching), nie samo grep -c, i porównaj z 87.
#   oczekiwane: żadna z tych metod nie da dokładnie 87 bez dalszej, precyzyjnej filtracji —
#   zanotuj w raporcie KAŻDĄ metodę i jej liczbę, nie tylko finalną.

# (W5) SPRAWDŹ oba potwierdzone przypadki grupy (a) DOKŁADNIE — cytaty muszą się zgadzać
grep -n "beforeAll\|beforeEach\|mockResolvedValue\|mockImplementation\|mockReturnValue\|mockRejectedValue\|it(" server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts
grep -n "beforeAll\|beforeEach\|mockResolvedValue\|mockImplementation\|mockReturnValue\|it(" tests/unit/backend/ragService.test.js
#   oczekiwane: interviewDeliveryMountedAuth — beforeAll:49, setter mockLlmCall.mockResolvedValue na :83, ZERO beforeEach, 6× it(. ragService.test.js — beforeAll:24,
#   settery :46-51, beforeEach:58 z KOMENTARZEM 'default polymorphic implementations are
#   active' (fałszywa premisa, ta sama klasa co tests/setup.ts:792), 5× it(.

# (W6) SPRAWDŹ istniejący bezpiecznik pre-commit — R3 DOKŁADA, nie zastępuje
wc -l .husky/pre-commit
grep -n '^# [0-9])' .husky/pre-commit
ls scripts/check-focus-canon.sh scripts/check-actions.sh
grep -n 'test:node-native' package.json
#   oczekiwane: 138 linii, DZIEWIĘĆ numerowanych bramek 1)-9), oba pliki wzorcowe istnieją,
#   test:node-native ma listę plików node --test w jednej linii package.json.

# (W7) SPRAWDŹ inny, RÓŻNY bug mocków — Z9, żeby go NIE POMYLIĆ z tym dyżurem
grep -n "clearAllMocks" -B3 -A3 docs/program/waves/WAVE_03_ACCEPTANCE/CI_DAY58_REPORT_20260828.md | head -20
#   oczekiwane: 'vi.clearAllMocks() czyści historię, ale nie resetuje niewykorzystanych
#   mockResolvedValueOnce' — to jest wyciek KOLEJKI *Once między testami, mechanizm INNY niż
#   ten dyżur (kasowanie IMPLEMENTACJI ustawionej w beforeAll). Nie łącz napraw.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day211-atrapy-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6151`. Twój JEDYNY port harnessu to `5092 i 5093`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day211-pg`**. **ZAKAZANE:** `Zajęte: 6012, 5433, 6047, 6054-6150, 5010-5091, 6404-6411 (wcześniejsze dyżury i odbiory nadzorcy). Twój WYŁĄCZNY przydział: baza `6151`, harness `5092 i 5093`, kontener `cx-day211-pg` — nic poza tym. ★★ ZAREZERWOWANE NA PRZÓD, ZABRONIONE dla Ciebie: `6152-6157` oraz `5094-5105` (dyżury 212-217, mogą biec równolegle — jeśli zobaczysz je zajęte, to nie kolizja, tylko sąsiad). ★★ PORTY ZAKAZANE NA STAŁE, niezależnie od przydziału: `5000` (macOS Control Center — system go trzyma zawsze), `5037` (`adb`, serwer Androida), `5060-5061` (SIP — Chromium odmawia połączenia jako `ERR_UNSAFE_PORT`, więc jakikolwiek harness webowy na tych portach jest martwy z definicji, nie tylko zajęty). ★ Ta lista jest ROZKAZEM POMIAROWYM, nie gwarancją: przed startem uruchamiasz `lsof -i :6151 -i :5092 -i :5093` i `docker ps --filter name=cx-day211-pg`, i wpisujesz do raportu wynik w formie `X z 3 portów wolnych` / `kontener nieobecny — OK` (albo odwrotnie, jeśli coś jest zajęte — wtedy STOP i zgłoszenie kolizji, nie cichy inny port).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `NIE DOTYCZY. Ten dyżur nie tworzy, nie zmienia i nie czyta żadnej flagi produktowej (`server/src/config/FeatureFlags.ts` pozostaje nietknięty). `CLAUDE.md` §7/§9 (akcept właściciela na zrzutach przed włączeniem flagi) nie mają tu zastosowania — nic z tego dyżuru trafia na UI ani do runtime produktu. Jedyny "przełącznik" w całym zakresie to nowy bezpiecznik `scripts/check-mock-lifecycle.sh` z R3, i on nie jest flagą produktową — jest bramką pre-commit, wzorem `scripts/check-focus-canon.sh` (`--ci` vs tryb raportu, patrz R3).`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``.husky/pre-commit` (138 linii, 9 istniejących bramek numerowanych `1)`-`9)`, każda wywołuje `scripts/check-*.sh` gated na wzorzec staged files) — R3 DOKŁADA dziesiątą bramkę w TYM SAMYM stylu (numer, komentarz z uzasadnieniem, `git diff --cached --name-only` gating), NIE zastępuje żadnej z istniejących. `scripts/check-focus-canon.sh` — wzorzec do skopiowania: tryb domyślny = raport (zawsze `exit 0`), tryb `--ci` = porównanie z baseline JSON, fail TYLKO gdy dług rośnie (ratchet), `--update-baseline` do świadomej aktualizacji. `package.json` skrypt `test:node-native` (linia z listą plików `node --test scripts/**/__tests__/*.test.mjs ...`) — nowy test bezpiecznika `tests/unit/scripts/checkMockLifecycle.test.mjs` DOPISUJESZ do tej listy, wzorem `tests/unit/scripts/checkActionsStagedScope.test.mjs`. `tests/setup.ts:809-811` i `:790-793` — bramka CZYTANA (dowód przyczyny), NIGDY zapisywana (`Z18`). Strażnik `assertRealPostgresTestEnvironment()` w plikach `.pg.test.ts`/`.realdb.test.ts` dotkniętych naprawą — wołany BEZ argumentów (`Z31`), nie zmieniasz jego semantyki. Żadna bramka uprawnień/regulacyjna produktu nie jest w zakresie tego dyżuru — to jest różnica względem dyżurów modułowych typu 207.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY211_ATRAPY_REPORT.md`. Nie zmieniasz ŻADNEGO `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowy (infrastruktura testowa), nie dotyczy jednego modułu produktowego. ★ Jedyny inny dokument do zmiany: `docs/program/funkcje/LISTA_DYZUROW_211_222.md`, WYŁĄCZNIE wiersz pozycji `211` (linie `16-22`) — i WYŁĄCZNIE jedno zdanie dopisane na końcu tej pozycji, korygujące liczbę `87` Twoim ZMIERZONYM wynikiem z cytowaną komendą (np. "Zmierzone ponownie 2026-08-31, komenda `<Twoja komenda>`: `N` plików, z czego `M` w grupie (a) — nie 87"). Reszta pliku (pozycje 212-222 i wstęp) NIETYKALNA. Jeżeli Twój pomiar POTWIERDZI `87` — dopisujesz zdanie potwierdzające z komendą, nie milczysz.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day211-atrapy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day211-atrapy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **`Z18` OBOWIĄZUJE BEZ WYJĄTKU — `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` są POZA zasięgiem zapisu. NAJWIĘKSZA pokusa tego dyżuru to "skoro problem jest globalny, naprawmy go globalnie" — np. zamianę globalnego `vi.clearAllMocks()` na `vi.resetAllMocks()`/`vi.restoreAllMocks()` w `tests/setup.ts`, albo dodanie tam warunku. TEGO NIE WOLNO ZROBIĆ: jedna zmiana globalnego mocka fałszuje wynik CAŁEGO korpusu testów (setup.ts obsługuje tysiące plików), a Ty nie masz jak zweryfikować skutku dla plików spoza Twojego przydziału w budżecie tego dyżuru. Naprawa jest WYŁĄCZNIE per-plik, w lokalnym `beforeEach` KAŻDEGO dotkniętego pliku z osobna. ★★ **ZAKAZ zliczania na wiarę.** Liczba `87` z `LISTA_DYZUROW_211_222.md:20` NIE MA cytowanej komendy — nie wolno jej po prostu potwierdzić "bo tak było napisane" ani odrzucić "bo mój pierwszy grep dał inaczej". Wymagana jest PRECYZYJNA sonda (dopasowanie klamer bloku `beforeAll`, nie luźne współwystępowanie w pliku) z pokazanym kodem sondy w raporcie. ★★ **ZAKAZ naprawiania plików grupy (b).** Pliki z jednym testem albo z już istniejącą reinstalacją w `beforeEach` NIE są w zakresie R2 — dotknięcie ich to praca bez uzasadnienia i ryzyko przypadkowej regresji w plikach, które i tak działały poprawnie. ★★ **ZAKAZ mylenia tego buga z wyciekiem kolejki `mockResolvedValueOnce`** (`CI_DAY58_REPORT_20260828.md:212` — INNY mechanizm: `clearAllMocks()` nie resetuje niewykorzystanych `*Once`, ale TO nie jest przedmiotem tego dyżuru; jeśli natkniesz się na plik z tym drugim wzorcem, zapisz go do raportu jako ODRĘBNĄ obserwację, nie naprawiaj przy okazji). ★★ **ZAKAZ RETRY W TESTACH BEZPIECZEŃSTWA / DOWODOWYCH** — jeśli naprawiony test dotyczy izolacji danych albo uprawnień, dowód `przed`/`po` MUSI iść z `--retry=0`, inaczej ponowienie może ukryć realną różnicę (ten sam wektor co `Z29`). ★★ **`Z31` bez wyjątku** — jeśli naprawiasz plik `.pg.test.ts`/`.realdb.test.ts`, `assertRealPostgresTestEnvironment()` zostaje wołany BEZ argumentów; nie przypinasz go do `cx211`. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`). ★ **`Z27` — zakaz `git stash`** w każdej postaci; stan odkładasz przez `cp` do `/private/tmp/cx-day211-atrapy-scratch` i wracasz przez `cp`. ★ **Sprzątanie kontenera: `docker rm -f -v`.** ★ **`Z13`:** logi, sondy, JSON-y `--reporter=json` i dzienniki przebiegu NIE wchodzą do repo — leżą w `/private/tmp/cx-day211-atrapy-artefakty`, raport podaje ścieżki i `shasum -a 256`. ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`); przepisanie liczby `87` bez własnego pomiaru jest zawyżeniem i podstawą odrzucenia. ★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testów — jedyna dopuszczalna zmiana to PRZENIESIENIE instalacji mocka z `beforeAll` do `beforeEach`, z uzasadnieniem w komentarzu. ★ **NOWE pliki w `tests/` wymagają `git add -f`.** ★★ **Ten dyżur nie dotyka ŻADNEJ flagi produktowej** — jeśli podczas pracy odkryjesz, że naprawa ODSŁANIA realny błąd produktu (R4 — test zaczyna czerwienić po naprawie), NIE naprawiasz tego błędu produktu w tym dyżurze — zapisujesz go do raportu z pełnym `fullName` testu i zostawiasz jako czerwony, jednoznacznie nazwany dług, do osobnego dyżuru. | Cały program dyżurów opiera się na dowodzie z testów: `Z29`, `Z37`, każde `PASS` w raporcie zakłada, że zielony test oznacza sprawdzone zachowanie. `FIX-209` (`server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts`, commit `b363d107d0`, 31.08.2026) dowiódł IZOLOWANĄ SONDĄ, że globalny `tests/setup.ts:809-811` (`beforeEach(() => vi.clearAllMocks())`) w tej wersji Vitest (`^4.1.8`) kasuje IMPLEMENTACJĘ ustawioną przez `vi.spyOn(...).mockResolvedValue(...)` w lokalnym `beforeAll` — nie tylko historię wywołań, WBREW własnemu komentarzowi w kodzie (`tests/setup.ts:792`: "Ensure call history is cleared but implementations remain" — to zdanie jest DZIŚ FAŁSZYWE dla tego kształtu, i to samo repo je tam zostawiło). Objaw jest podstępny: pierwszy test w pliku widzi mocka, każdy kolejny cicho idzie prawdziwą ścieżką i o tym nie informuje — dokładnie ta klasa błędu, którą program już nazwał ("Harness kłamie czterema sposobami", "Maskowanie testów przez retry", "Hipoteza nadzorcy staje się faktem"). ★★ TA OSTATNIA JEST TU DOSŁOWNA: karta `docs/program/funkcje/LISTA_DYZUROW_211_222.md:20` twierdzi "Zmierzony zasięg: 87 plików" — ale w całym pliku i w raporcie FIX-209 NIE MA cytowanej komendy, którą tę liczbę uzyskano. Własny pomiar wykonany przy pisaniu tej instrukcji (patrz `POZYCJE_RDZENIA`, sonda `probe_clearallmocks_211b.py`, zwalidowana na znanym stanie SPRZED naprawy FIX-209 — poprawnie rozpoznaje stary `artifactKnowledgeIndexer.pg.test.ts` jako zagrożony) na tym samym SHA znajduje 4 pliki wąską definicją i 6 szeroką — nie 87. Dopóki ta rozbieżność nie jest ROZSTRZYGNIĘTA pomiarem, a nie przepisana z planu, KAŻDY zielony wynik w tym repozytorium jest hipotezą, nie dowodem — a to podważa wiarygodność WSZYSTKICH wcześniejszych odbiorów, które opierały się na testach z lokalnym `beforeAll`. To jest warunek wstępny dla reszty programu, nie kosmetyka. |

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
cd /private/tmp/cx-day211-atrapy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day211-pg psql -U postgres -d cx211 \
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
cd /private/tmp/cx-day211-atrapy

docker run -d --name cx-day211-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx211 \
  -p 127.0.0.1:6151:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day211-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6151/cx211 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6151/cx211 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day211-atrapy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6151/cx211 \
JWT_SECRET=cx211-test-secret-do-not-reuse \
npx vitest run tests/setup.ts (WYŁĄCZNIE ODCZYT — `Z18`) oraz KAŻDY plik pasujący do `**/*.test.ts`, `**/*.test.tsx`, `**/*.test.js`, `**/*.test.jsx`, `**/*.spec.ts`, `**/*.spec.tsx` w całym repo (poza `node_modules`) — to jest zasięg inwentarza R1 — oraz nowy `scripts/check-mock-lifecycle.sh` i jego test `tests/unit/scripts/checkMockLifecycle.test.mjs` (wzorem `scripts/check-actions.sh` / `tests/unit/scripts/checkActionsStagedScope.test.mjs`). --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day211-atrapy-artefakty/day211-clearallmocks-przemiatanie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day211-atrapy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/setup.ts (WYŁĄCZNIE ODCZYT — `Z18`) oraz KAŻDY plik pasujący do `**/*.test.ts`, `**/*.test.tsx`, `**/*.test.js`, `**/*.test.jsx`, `**/*.spec.ts`, `**/*.spec.tsx` w całym repo (poza `node_modules`) — to jest zasięg inwentarza R1 — oraz nowy `scripts/check-mock-lifecycle.sh` i jego test `tests/unit/scripts/checkMockLifecycle.test.mjs` (wzorem `scripts/check-actions.sh` / `tests/unit/scripts/checkActionsStagedScope.test.mjs`). --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day211-atrapy-artefakty/day211-clearallmocks-przemiatanie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day211-atrapy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day211-pg psql -U postgres -d cx211 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day211-pg`.
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
> **(e) ★★ **Pierwsza, najgroźniejsza: przepisanie liczby `87` zamiast jej zmierzenia.** Ten dyżur ISTNIEJE po to, żeby przemieść wzorzec, który sam jest przykładem "zmierzonej" liczby, która nigdy nie miała cytowanej komendy. Jeśli oddasz raport z "potwierdzam 87 plików" bez własnej, precyzyjnej sondy pokazanej w kodzie — powtarzasz DOKŁADNIE ten sam błąd metodyczny, który ten dyżur ma naprawić, tylko jeden poziom wyżej. ★★ **Druga: luźny `grep -c` jako dowód.** Współwystępowanie `beforeAll` i `.mockResolvedValue(` GDZIEKOLWIEK w pliku (bez sprawdzenia, że setter jest WEWNĄTRZ bloku beforeAll, a nie w osobnym `it()` czy `beforeEach`) daje przy tym repo ok. 130 "trafień" — z czego przytłaczająca większość to PRAWIDŁOWY wzorzec (mock ustawiany per-test w `it()`, już po globalnym `beforeEach` z `clearAllMocks`). Taki pomiar zawyża inwentarz o rząd wielkości i psuje R1 od startu. ★★ **Trzecia: zakładanie, że `vi.fn(bezpośrednia_implementacja)` jest tym samym bugiem co `spyOn().mockResolvedValue()`.** Nie jest to zmierzone — tylko JEDEN kształt (łańcuch na istniejącym mocku) ma dowód izolowaną sondą. Zaliczenie do inwentarza plików typu `DocumentStudioDocumentPanel.exportUx.test.tsx` (`URL.createObjectURL = vi.fn(() => 'blob:mock')` w `beforeAll:184-189`) BEZ wykonania R0 jest zgadywaniem, nawet jeśli wygląda podobnie. ★★ **Czwarta: naprawa przez dotknięcie `tests/setup.ts`.** Najkrótsza droga do "naprawienia wszystkiego naraz" to zmiana globalnego harnessu — i jest ZAKAZANA `Z18` z dobrego powodu: nie masz budżetu, żeby zweryfikować skutek dla tysięcy plików spoza Twojego przydziału, a jedna zła zmiana tam fałszuje CAŁY korpus testów jednocześnie, po cichu. ★★ **Piąta: mylenie tego buga z wyciekiem kolejki `mockResolvedValueOnce`** — `CI_DAY58_REPORT_20260828.md:212` opisuje inny, ale podobnie brzmiący problem (kolejka `*Once` nie jest czyszczona między testami przez `clearAllMocks`). To jest odwrotny kierunek błędu: tu WARTOŚĆ ZOSTAJE i zanieczyszcza KOLEJNY test, a w Twoim buggu wartość ZNIKA i KOLEJNY test dostaje prawdziwą (nie-mockowaną) ścieżkę. Pomieszanie tych dwóch da naprawę, która nie naprawia niczego, albo psuje coś innego. ★★ **Szósta: `ragService.test.js` ma WŁASNY komentarz z tą samą fałszywą premisą co `tests/setup.ts:792`.** `beforeEach:58-61` mówi "Ensure default polymorphic implementations are active (The initial definitions in mockDb handle polymorphism correctly)" — to zdanie zakłada dokładnie to, co FIX-209 obalił. Autor tego pliku najwyraźniej WIEDZIAŁ, że `clearAllMocks()` coś czyści, i uspokoił się błędnym założeniem, że reszta przeżyje. To jest dowód, że ten wzorzec pojawia się nie z niewiedzy, tylko z DOBRZE UDOKUMENTOWANEGO błędnego przekonania o semantyce Vitest — więc bezpiecznik z R3 ma być mechaniczny (grep/parser), nie "przypomnienie w dokumentacji", bo dokumentacja już raz nie wystarczyła. ★★ **Siódma: `interviewDeliveryMountedAuth.pg.test.ts` ma sześć testów i ZERO `beforeEach`** — to jest plik integracyjny z realną bazą Postgres (`Pool`, `INSERT INTO organizations/users/...`), więc naprawa MUSI zachować kolejność: dane w bazie tworzone RAZ w `beforeAll` (drogie, nie powtarzaj per-test), ale mock LLM instalowany PONOWNIE w `beforeEach` (tanie, musi przeżyć `clearAllMocks`). Nie przenoś całego `beforeAll` do `beforeEach` — to zduplikuje insercje SQL i pochłonie budżet czasu testu bez potrzeby; przenieś WYŁĄCZNIE linię `mockLlmCall.mockResolvedValue(...)`.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day211-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day211-atrapy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 — USTAL DOKŁADNY KSZTAŁT BUGA, ZANIM ZLICZYSZ CO KOLWIEK. Potwierdzone dziś TYLKO dla jednego kształtu: `vi.spyOn(X,'y').mockResolvedValue(...)` (albo `.mockImplementation`) WYWOŁANE ŁAŃCUCHOWO wewnątrz lokalnego `beforeAll` (dowód: `artifactKnowledgeIndexer.pg.test.ts` sprzed naprawy, commit `3331d27917`, `beforeAll:38` + `mockResolvedValue:45`, naprawione w `b363d107d0`). ★★ NIE potwierdzone: czy ten sam efekt dotyczy `vi.fn(impl)` z implementacją podaną BEZPOŚREDNIO przy tworzeniu (nie łańcuchowo na istniejącym mocku) — a w repo ISTNIEJĄ takie przypadki wewnątrz `beforeAll`, np. `tests/components/DocumentStudio/DocumentStudioDocumentPanel.exportUx.test.tsx:184-189` (`URL.createObjectURL = vi.fn(() => 'blob:mock')` i dwa sąsiednie) oraz `tests/integration/settings/day55.oauth-callback-boundary.realdb.test.ts:37-48` (`vi.stubGlobal('fetch', vi.fn(async () => new Response(...)))`). Wedle DOKUMENTACJI Vitest `clearAllMocks`/`mockClear` NIE powinno ruszać żadnej z tych dwóch postaci (czyści tylko `mock.calls`/`mock.results`) — a mimo to spyOn-łańcuch jest ZMIERZONY jako zepsuty. Zanim zliczysz cokolwiek w R1, napisz WŁASNĄ izolowaną sondę (ten sam rodzaj dowodu, którym FIX-209 to udowodnił — NIE przepisuj jego wniosku bez powtórzenia pomiaru) z DWOMA minimalnymi plikami *.test.ts obok siebie w jednym katalogu tymczasowym, ładującymi PRAWDZIWY `tests/setup.ts` przez `vitest.config.ts` (odczyt, nie edycja), z co najmniej 2 testami każdy: (i) plik A z `vi.spyOn(...).mockResolvedValue()` w `beforeAll` — oczekiwane: powtórzenie ustalenia FIX-209; (ii) plik B z `vi.fn(() => X)` przypisanym w `beforeAll` (bez spyOn) — WYNIK NIEZNANY, zmierz. Rezultat R0 rozstrzyga, czy R1 zlicza WYŁĄCZNIE wzorzec (i), czy też (ii) — i jest to fakt do zacytowania w raporcie, nie założenie.

R1 — INWENTARZ, SONDĄ NIE WZROKIEM. Punkt startowy (NIE ostateczny wynik — do zweryfikowania i rozszerzenia wg R0): własna sonda z pisania tej instrukcji, `probe_clearallmocks_211b.py` (brace-matching po usunięciu literałów stringowych/szablonowych i komentarzy liniowych, zwalidowana na `git show 3331d27917:...artifactKnowledgeIndexer.pg.test.ts` — poprawnie klasyfikuje go jako zagrożony), uruchomiona na WSZYSTKICH plikach `*.test.ts|.test.tsx|.test.js|.test.jsx|.spec.ts|.spec.tsx` poza `node_modules` (5915 plików na SHA `fe33ce8036`). Wynik WĄSKI (tylko łańcuch `.mockResolvedValue/.mockImplementation/.mockReturnValue/.mockRejectedValue`, BEZ wariantu `*Once`, wewnątrz `beforeAll`, NIE reinstalowany w lokalnym `beforeEach` tego samego pliku): 4 pliki mają w ogóle ten wzorzec w `beforeAll` — `server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts` (`beforeAll:49-96`, setter `mockLlmCall.mockResolvedValue(...)` na `:83`, 6 testów `it(`, ZERO `beforeEach` w pliku → GRUPA (a) zagrożony), `tests/unit/backend/ragService.test.js` (`beforeAll:24-54`, settery `.mockReturnValue`/`.mockResolvedValue` na `:46-51`, 5 testów, `beforeEach:58` robi TYLKO `vi.clearAllMocks()` z komentarzem "Ensure default polymorphic implementations are active" — DOKŁADNIE ta sama fałszywa premisa co `tests/setup.ts:792` → GRUPA (a) zagrożony), `server/src/services/ai/__tests__/day205.decisionWisdom.pg.test.ts` (`beforeAll:21`, setter `generateSectionSpy = vi.spyOn(...).mockImplementation(...)` — ale plik ma JEDEN opisany blok testowy → GRUPA (b) niegroźny, policz `it(` sam), `tests/integration/routes/v8Interview.contextDocuments.test.ts` (`beforeAll:47` ustawia `PermissionService.hasPermission: vi.fn().mockResolvedValue(true)`, ALE `beforeEach` istnieje i reinstaluje przed każdym testem → GRUPA (b) niegroźny). Wynik SZEROKI (dodatkowo `vi.fn(bezpośrednia_funkcja)` bez łańcucha) dodaje kandydatów `DocumentStudioDocumentPanel.exportUx.test.tsx:184-189` i `day55.oauth-callback-boundary.realdb.test.ts:37-48` (patrz R0 — status NIEROZSTRZYGNIĘTY, dopóki R0 nie ustali, czy ten kształt jest w ogóle dotknięty). ŻADNA z tych liczb (4 wąsko / 6 szeroko) nie jest `87` z `LISTA_DYZUROW_211_222.md:20`. ★★ TWOJE ZADANIE: zbuduj OSTATECZNĄ, sondowaną listę (rozszerz/popraw sondę wg wyniku R0, uruchom na PEŁNYM repo, zweryfikuj KAŻDY plik grupy (a) OCZAMI — sonda daje kandydatów, nie wyrok), z tabelą: plik | linia `beforeAll` | linia settera | liczba testów `it(`/`test(` | czy `beforeEach` reinstaluje | grupa (a)/(b) | powód. Dla MINIMUM TRZECH plików grupy (a) pokaż DOWÓD `przed`: uruchom plik w izolacji (`vitest run <plik> -t '<nazwa drugiego testu>'`) i w pełnym pliku (`vitest run <plik>`), porównaj — drugi test w izolacji korzysta z mocka, w pełnym pliku idzie prawdziwą ścieżką (log/asercja pokazująca to wprost, nie domysł). Rozstrzygnij pisemnie rozbieżność względem `87` — jeśli Twój ostateczny wynik też jest daleko od `87`, napisz to WPROST, z komendą, i skoryguj `LISTA_DYZUROW_211_222.md:16-22` (patrz pole dokumentu do zmiany).

R2 — NAPRAWA plików grupy (a). Wzorzec GOTOWY w repo, skopiuj kształt, nie wymyślaj nowego: `artifactKnowledgeIndexer.pg.test.ts:44-63` — komentarz `FIX-209` (`:44-59`) tłumaczący przyczynę, `beforeEach` (`:60-63`) instalujący `vi.spyOn(...).mockResolvedValue(...)` PO globalnym `beforeEach` z `tests/setup.ts` (rejestracja lokalna w pliku odpala się PO globalnej, więc PO `clearAllMocks()` — to jest CAŁA naprawa), plus `afterAll` z `vi.restoreAllMocks()` (`:69` w tym samym pliku, sprawdź dokładną linię u siebie). Dla KAŻDEGO pliku grupy (a): przenieś instalację mocka z `beforeAll` do `beforeEach` TEGO PLIKU (nie `tests/setup.ts` — `Z18`), z komentarzem cytującym ten dyżur i mechanizm (dlaczego lokalny `beforeEach` przeżywa `clearAllMocks()`, a `beforeAll` nie). ALTERNATYWA do rozważenia i ODRZUCENIA/PRZYJĘCIA z liczbą, nie opinią: `restoreMocks: true` per-plik w opcjach `describe`/config lokalnego pliku — koszt: `Z18` zakazuje ruszania `vitest.config.ts` globalnie, więc opcja globalna jest wykluczona z definicji; per-plik jest dozwolona, ale sprawdź, czy Vitest wspiera per-plik `restoreMocks` bez zmiany globalnego configu (zmierz, nie zakładaj) — jeśli nie, jedyna droga to wzorzec `beforeEach`-reinstalacji z `artifactKnowledgeIndexer`. Napraw WSZYSTKIE potwierdzone pliki grupy (a) (minimum: `interviewDeliveryMountedAuth.pg.test.ts`, `ragService.test.js`, plus wszystko, co R1 jeszcze znajdzie), z dowodem `po`: sam test w izolacji i w pełnym pliku dają TERAZ ten sam wynik.

R3 — BEZPIECZNIK, DOŁOŻONY DO ISTNIEJĄCEGO, NIE NOWY. `.husky/pre-commit` ma dziś 9 bramek numerowanych, każda `scripts/check-*.sh`, gated na `git diff --cached --name-only`. Napisz `scripts/check-mock-lifecycle.sh` wzorem `scripts/check-focus-canon.sh` (raport domyślny + `--ci` z baseline ratchet JSON, `--update-baseline` do świadomej aktualizacji) — reguła: wykryj w STAGED plikach testowych łańcuch `.mock(ResolvedValue|Implementation|ReturnValue|RejectedValue)\(` (bez `Once`) wewnątrz bloku `beforeAll(...)`, gdzie ten sam plik NIE ma odpowiadającego settera w `beforeEach`. Dopisz bramkę `10)` w `.husky/pre-commit`, gated na `git diff --cached --name-only --diff-filter=ACM | grep -E '\.(test|spec)\.(ts|tsx|js|jsx)$'` (tylko gdy commit dotyka plików testowych — tanio i zawsze aktualne, wzorem bramki `6)`). Dopisz `tests/unit/scripts/checkMockLifecycle.test.mjs` wzorem `tests/unit/scripts/checkActionsStagedScope.test.mjs` (izolowany worktree git, prawdziwe wywołanie skryptu, nie fixture udająca wynik) i dopisz go do listy w `package.json` skrypcie `test:node-native`. DOWÓD: dopisz TYMCZASOWY plik testowy łamiący regułę (kopia wzorca sprzed-naprawy `artifactKnowledgeIndexer.pg.test.ts` z commita `3331d27917`), pokaż że `check-mock-lifecycle.sh --ci` go łapie (exit≠0, komunikat nazywa plik i linię), USUŃ ten plik, pokaż że po usunięciu bramka znów przechodzi.

R4 — POMIAR SKUTKU. Dla KAŻDEGO plikU naprawionego w R2: uruchom PEŁNY plik przed naprawą (`vitest run <plik> --reporter=json --outputFile=<ARTEFAKTY>/<plik>.przed.json`) i po naprawie (analogicznie `.po.json`), porównaj PO NAZWACH (`fullName`, `Z37` — nigdy po liczbach), i wypisz w raporcie PEŁNĄ listę testów, które ZMIENIŁY wynik (były `PASS` fałszywie, teraz `FAIL` bo dotykają prawdziwego, nienaprawionego zachowania produktu, albo odwrotnie). To jest NAJWAŻNIEJSZA liczba tego dyżuru: ile zieleni było fałszywej. Jeśli lista jest pusta — napisz to WPROST i wyjaśnij DLACZEGO (np. "pierwszy test w pliku i tak testował tę samą ścieżkę co kolejne" — z dowodem, nie domysłem). Bez skracania, bez "i podobne".`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6151` albo `5092 i 5093` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6151` albo `5092 i 5093`** (`Z7`).

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

`FIX-209` (`server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts`,
commit `b363d107d0`, 31.08.2026) dowiódł IZOLOWANĄ SONDĄ przyczynę objawu „przechodzi w
izolacji, czerwienieje w pełnym pliku": globalny harness

> `tests/setup.ts:809-811` woła `beforeEach(() => vi.clearAllMocks())`, co w tej wersji
> Vitest **kasuje implementację** ustawioną przez `vi.spyOn(...).mockResolvedValue(...)` w
> lokalnym `beforeAll` — nie tylko historię wywołań.

(`docs/program/funkcje/ODBIOR_209.md:6-17`, cytat dosłowny). Skutek zmierzony: **pierwszy
test w pliku widzi mocka, każdy kolejny w tym samym pliku cicho odpala PRAWDZIWĄ ścieżkę i o
tym nie informuje.**

★★ **To jest wbrew własnemu komentarzowi w kodzie.** `tests/setup.ts:790-793`:

```
789: // Global Setup
790: beforeAll(async () => {
791:   mockLLMApi.reset();
792:   // Ensure call history is cleared but implementations remain
793:   vi.clearAllMocks();
794: });
```

Zdanie z linii `792` — „implementations remain" — jest **dziś fałszywe** dla kształtu
`vi.spyOn(X,'y').mockResolvedValue(...)` ustawionego w lokalnym `beforeAll` innego pliku.
Ten sam plik zostawił tę obietnicę w kodzie już PO tym, jak FIX-209 ją obalił — nikt jej nie
poprawił, bo dotyczy zachowania GLOBALNEGO harnessu, a `Z18` zakazuje jego edycji bez
osobnego, świadomego dyżuru. `tests/setup.ts:808-811` ma drugi, krótszy wariant komentarza:

```
808: // Reset LLM API mocks before each test
809: beforeEach(() => {
810:   // Ensure call history is cleared
811:   vi.clearAllMocks();
812: });
```

Ten drugi komentarz nie obiecuje nic o implementacjach — ale **efekt jest identyczny**: obie
instalacje `vi.clearAllMocks()` (linia `793` w `beforeAll` i `811` w `beforeEach`) czyszczą
mocki tym samym mechanizmem Vitest.

## Pomiar, który zmienia treść zamówienia — wykonany na SHA `fe33ce8036`

Karta zlecenia dla tego dyżuru (`docs/program/funkcje/LISTA_DYZUROW_211_222.md:16-22`) mówi
dosłownie:

> **Zmierzony zasięg: 87 plików testowych ustawia implementację w `beforeAll`.**

**W CAŁYM tym pliku, w `ODBIOR_209.md` i w raporcie `CODEX_DAY209_INDEKSACJA_REPORT.md` NIE
MA cytowanej komendy, którą tę liczbę uzyskano.** To jest dokładnie ta klasa błędu, którą
program już nazwał — `hipoteza nadzorcy staje się faktem`: teza w instrukcji wraca jako
„zmierzony fakt" w kolejnym dokumencie, bez powtórzenia pomiaru. **Ten dyżur nie ma prawa
powtórzyć tego błędu jeden poziom wyżej.**

**(K1) Własny pomiar, wykonany PRZY PISANIU TEJ INSTRUKCJI, daje 4 pliki wąską definicją, 6
szeroką — nie 87.** Metodyka (skrypt `probe_clearallmocks_211b.py`, dopasowanie klamer bloku
`beforeAll` po usunięciu literałów stringowych/szablonowych i komentarzy liniowych, żeby
klamry w treściach komunikatów błędów nie myliły licznika zagnieżdżenia) **zwalidowana na
znanym stanie SPRZED naprawy FIX-209**: uruchomiona na `git show
3331d27917:server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts`
(commit sprzed poprawki) poprawnie klasyfikuje ten plik jako `a_zagrozony` — dowód, że sonda
łapie prawdziwy przypadek, nie tylko teoretyczny kształt. Uruchomiona na **5915 plikach**
(`*.test.ts|.test.tsx|.test.js|.test.jsx|.spec.ts|.spec.tsx`, poza `node_modules`, SHA
`fe33ce8036`):

- **wąska definicja** (łańcuch `.mockResolvedValue(`/`.mockImplementation(`/
  `.mockReturnValue(`/`.mockRejectedValue(`, BEZ wariantu `*Once`, wewnątrz `beforeAll`, NIE
  reinstalowany w lokalnym `beforeEach` tego samego pliku): **4 pliki mają w ogóle ten wzorzec
  w `beforeAll`**, z czego **2 w grupie (a) — realnie zagrożone** (patrz `POZYCJE_RDZENIA`
  R1 za pełnym rozbiciem plik po pliku);
- **luźne współwystępowanie** (`beforeAll` GDZIEKOLWIEK w pliku ORAZ jeden z czterech
  setterów GDZIEKOLWIEK w pliku, bez sprawdzenia, że setter jest wewnątrz bloku `beforeAll`)
  — to jest górna granica bez znaczenia dowodowego: **130 plików**. Większość z nich ma
  setter poprawnie umieszczony w `it()`, PO globalnym `beforeEach` — czyli w bezpiecznym
  miejscu. To pokazuje, jak łatwo zawyżyć inwentarz o rząd wielkości, jeśli nie sprawdza się
  granic bloku.

**Żadna z tych liczb nie jest 87.** R1 wymaga od Ciebie zbudowania OSTATECZNEJ, precyzyjnej
sondy i rozstrzygnięcia tej rozbieżności pomiarem — nie przyjęcia którejkolwiek z podanych
tu liczb bez własnej weryfikacji.

**(K2) Dokładny KSZTAŁT buga nie jest ustalony poza jednym potwierdzonym przypadkiem.**
FIX-209 dowiódł efektu WYŁĄCZNIE dla `vi.spyOn(X,'y').mockResolvedValue(...)` — łańcuch
wywołany na już istniejącym mocku. Czy ten sam efekt dotyczy `vi.fn(bezpośrednia_funkcja)`
(implementacja podana PRZY TWORZENIU mocka, nie przez łańcuch na już istniejącym) — **NIE
jest zmierzone**. Wedle oficjalnej dokumentacji Vitest, `clearAllMocks()`/`mockClear()`
**nie powinno** ruszać implementacji w ogóle (czyści tylko `mock.calls`/`mock.results`) — a
mimo to kształt `spyOn().mockResolvedValue()` jest zmierzony jako zepsuty. To jest
zaskakujące zachowanie, potwierdzone tylko dla jednego kształtu. W repo ISTNIEJĄ pliki z
DRUGIM kształtem wewnątrz `beforeAll`, jeszcze nieprzetestowanym:

- `tests/components/DocumentStudio/DocumentStudioDocumentPanel.exportUx.test.tsx:184-189` —
  `URL.createObjectURL = vi.fn(() => 'blob:mock')`, `URL.revokeObjectURL = vi.fn()`,
  `HTMLAnchorElement.prototype.click = vi.fn()`, wszystkie w `beforeAll`;
- `tests/integration/settings/day55.oauth-callback-boundary.realdb.test.ts:37-48` —
  `vi.stubGlobal('fetch', vi.fn(async () => new Response(...)))` w `beforeAll`.

**R0 istnieje po to, żeby to rozstrzygnąć PRZED zliczeniem czegokolwiek w R1** — inaczej R1
albo pominie prawdziwe ofiary tego samego buga, albo naprawi pliki, które nigdy nie były
zepsute.

**(K3) Istnieje DRUGI, PODOBNIE BRZMIĄCY, ale INNY mechanizm zanieczyszczenia mocków —
nie mylić.** `docs/program/waves/WAVE_03_ACCEPTANCE/CI_DAY58_REPORT_20260828.md:212`:

> `vi.clearAllMocks()` czyści historię, ale nie resetuje niewykorzystanych
> `mockResolvedValueOnce`; dowód: test clone-on-write czerwony w pakiecie, a osobno `exit=0`.

To jest **odwrotny kierunek błędu**: tam wartość z kolejki `*Once` **zostaje** i zanieczyszcza
KOLEJNY test (fałszywy `PASS` staje się fałszywym `FAIL` gdzie indziej); tu wartość
**znika** i kolejny test dostaje prawdziwą, niemockowaną ścieżkę. Dwa różne mechanizmy, dwie
różne naprawy. Ten dyżur zajmuje się WYŁĄCZNIE drugim (kasowanie implementacji z
`beforeAll`). Jeśli natkniesz się na plik z pierwszym wzorcem — zapisz go do raportu jako
odrębną obserwację, nie naprawiaj przy okazji.

**(K4) `ragService.test.js` ma WŁASNY komentarz z tą samą fałszywą premisą co
`tests/setup.ts:792`.** `beforeEach:58-61`:

```
58: beforeEach(() => {
59:   vi.clearAllMocks();
60:   // Ensure default polymorphic implementations are active
61:   // (The initial definitions in mockDb handle polymorphism correctly)
62: });
```

Autor tego pliku najwyraźniej WIEDZIAŁ, że `clearAllMocks()` coś czyści (stąd komentarz w
ogóle) i uspokoił się błędnym założeniem, że reszta przeżyje. Mocki, których to dotyczy, są
ustawione WYŻEJ, w `beforeAll:46-52` (`uuidv4: vi.fn().mockReturnValue('mock-uuid')`,
`embeddingService.generateEmbedding: vi.fn().mockResolvedValue([])`, i dwa sąsiednie) — **nie**
w `beforeEach`, który tylko czyści. To jest dowód, że wzorzec pojawia się nie z niewiedzy o
`clearAllMocks` w ogóle, tylko z **udokumentowanego błędnego przekonania o jego dokładnej
semantyce** — dlatego bezpiecznik z R3 ma być mechaniczny (parser/grep w pre-commit), nie
kolejny komentarz w dokumentacji, bo dokumentacja już raz nie wystarczyła.

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy** na SHA `fe33ce8036`. Jeśli u Ciebie linie się różnią,
wiążący jest plik (`Z24`), rozbieżność wpisujesz do raportu.

- **T1.** `tests/setup.ts:790-793` (globalny `beforeAll`) i `tests/setup.ts:809-811`
  (globalny `beforeEach`) OBA wołają `vi.clearAllMocks()`. Komentarz na `:792` twierdzi, że
  implementacje przeżywają — **to jest fałszywe** dla kształtu potwierdzonego w FIX-209.
- **T2.** Wzorzec naprawy istnieje już w repo: `artifactKnowledgeIndexer.pg.test.ts:44-63`
  (komentarz FIX-209 + `beforeEach` reinstalujący `vi.spyOn(...).mockResolvedValue(...)` PO
  globalnym `beforeEach`). To jest szablon do skopiowania w R2, nie punkt wyjścia do
  wymyślenia od nowa.
- **T3.** Liczba `87` (`LISTA_DYZUROW_211_222.md:20`) **nie ma cytowanej komendy** w żadnym
  dostępnym dokumencie. Traktuj ją jako HIPOTEZĘ do zweryfikowania, nie fakt.
- **T4.** Własny pomiar z pisania tej instrukcji: **4 pliki** wąską definicją (setter
  łańcuchowy w `beforeAll`, bez reinstalacji w lokalnym `beforeEach`) na 5915 plikach
  testowych, z czego **2 w grupie (a)** — `interviewDeliveryMountedAuth.pg.test.ts` (6
  testów) i `ragService.test.js` (5 testów). **130 plików** luźnym współwystępowaniem
  (górna granica bez znaczenia dowodowego).
- **T5.** ★ Kształt buga potwierdzony TYLKO dla `spyOn(...).mockX()` łańcuchowo. Kształt
  `vi.fn(bezpośrednia_implementacja)` w `beforeAll` (2 konkretne przykłady w repo, patrz K2)
  ma NIEZNANY status — wymaga własnej izolowanej sondy w R0.
- **T6.** Istnieje ODRĘBNY, udokumentowany mechanizm zanieczyszczenia mocków —
  `mockResolvedValueOnce` niekasowane przez `clearAllMocks`
  (`CI_DAY58_REPORT_20260828.md:212`). Inny kierunek błędu, inna naprawa, poza zakresem tego
  dyżuru.
- **T7.** `.husky/pre-commit` ma dziś **9 bramek** numerowanych `1)`-`9)`, wzorzec
  `scripts/check-*.sh` gated na `git diff --cached --name-only`. `scripts/check-focus-canon.sh`
  ma kształt raport-domyślny + `--ci` z baseline JSON (ratchet). To jest wzorzec dla R3, nie
  nowy mechanizm.
- **T8.** `ragService.test.js:59-61` ma komentarz zakładający TĘ SAMĄ fałszywą premisę co
  `tests/setup.ts:792` — dowód, że problem jest znany intuicyjnie od dawna, ale nigdy nie
  zmierzony ani zablokowany mechanicznie.

# 3. POZYCJE DYŻURU

## R0 — ustal DOKŁADNY kształt buga, zanim zliczysz cokolwiek

**Cel:** rozstrzygnąć, czy `clearAllMocks()` w tej wersji Vitest kasuje WYŁĄCZNIE
implementacje ustawione łańcuchowo (`spyOn(...).mockX()` / `vi.fn().mockX()`), czy TAKŻE
implementacje podane bezpośrednio przy tworzeniu (`vi.fn(fn)`). Od odpowiedzi zależy zakres
R1.

**Metoda — ten sam rodzaj dowodu, którym FIX-209 to udowodnił, nie przepisanie jego
wniosku:**

1. W `/private/tmp/cx-day211-atrapy-scratch` stwórz DWA minimalne pliki `*.test.ts` obok siebie, ładowane przez
   PRAWDZIWY `tests/setup.ts` (przez `vitest.config.ts`, odczyt — `Z18` zakazuje edycji,
   nie odczytu ani uruchomienia).
2. **Plik A** (kształt potwierdzony): `beforeAll` z `vi.spyOn(obiekt, 'metoda')
   .mockResolvedValue(X)`, DWA testy. Oczekiwane: powtórzenie ustalenia FIX-209 (drugi test
   NIE widzi mocka).
3. **Plik B** (kształt NIEZNANY): `beforeAll` z `const spy = vi.fn(() => X)` (implementacja
   podana przy tworzeniu, bez łańcucha `.mockX`), DWA testy. Zmierz: czy drugi test widzi
   `X`, czy `undefined`.
4. Zapisz wynik OBU plików do `/private/tmp/cx-day211-atrapy-artefakty` (log przebiegu + `--reporter=json`), z
   `shasum -a 256`.

**Wynik R0 rozstrzyga zakres R1** — jeśli plik B pokazuje TEN SAM efekt co A, kandydaci z K2
(`DocumentStudioDocumentPanel.exportUx.test.tsx`, `day55.oauth-callback-boundary.realdb.test.ts`)
wchodzą do inwentarza; jeśli NIE — zostają wpisani do raportu jako „sprawdzone i wykluczone",
z dowodem.

**Ukończone, gdy:** oba pliki sondujące istnieją w artefaktach z wynikiem, zdanie
rozstrzygające jest w raporcie i jest cytowalne („kształt `vi.fn(impl)` w `beforeAll`
[jest/nie jest] dotknięty tym samym mechanizmem, dowód: …").

## R1 — Inwentarz, sondą nie wzrokiem

**Cel:** pełna, ostateczna lista plików testowych z tym wzorcem (zakres wg wyniku R0), z
podziałem (a) realnie zagrożone / (b) niegroźne.

### R1a — punkt startowy (do zweryfikowania, nie do przyjęcia na wiarę)

Skrypt `probe_clearallmocks_211b.py` (opisany w `POZYCJE_RDZENIA`) jest punktem WYJŚCIA, nie
ostatecznym wynikiem. Rozszerz go wg wyniku R0 (jeśli kształt B jest dotknięty — dodaj
wykrywanie `vi.fn(argument-będący-funkcją)` bez łańcucha), uruchom na PEŁNYM repo (nie na
próbce), i **zweryfikuj KAŻDY kandydat grupy (a) własnymi oczami** — sonda daje kandydatów,
wyrok wydaje pomiar per plik (uruchomienie testu).

### R1b — TABELA OBOWIĄZKOWA: pełen inwentarz

| # | Plik | Linia `beforeAll` | Linia settera | Liczba testów | `beforeEach` reinstaluje? | Grupa (a)/(b) | Powód |
|---|---|---|---|---|---|---|---|
| 1 | `server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts` | 49 | 83 | 6 | NIE | (a) | brak `beforeEach` w ogóle |
| 2 | `tests/unit/backend/ragService.test.js` | 24 | 46-51 | 5 | częściowo (tylko `clearAllMocks()`, K4) | (a) | `beforeEach` czyści, ale NIE reinstaluje implementacji |
| … | … (wszystkie pozostałe znalezione sondą) | … | … | … | … | … | … |

Bez tej tabeli KOMPLETNEJ (100% plików pasujących do ostatecznego wzorca z R0, zero
skrótów, zero „i podobne") pozycja jest nieukończona.

### R1c — dowód „przed" dla minimum trzech plików grupy (a)

Dla `interviewDeliveryMountedAuth.pg.test.ts`, `ragService.test.js` i co najmniej JEDNEGO
kolejnego pliku z tabeli R1b: uruchom DRUGI test pliku w izolacji
(`vitest run <plik> -t '<pełna nazwa drugiego testu>'`) i cały plik razem
(`vitest run <plik>`), porównaj zachowanie. Log albo asercja MUSI pokazywać wprost, że w
pełnym pliku drugi test idzie prawdziwą ścieżką (np. realne wywołanie sieciowe/bazowe zamiast
mocka) — nie domysł, nie „test przeszedł inaczej".

### R1d — rozstrzygnięcie liczby `87`

Napisz w raporcie: Twoją ostateczną liczbę, komendę którą ją uzyskałeś, i **jawne
porównanie** z `87`. Jeśli Twoja liczba też jest daleko od `87` — napisz to wprost, bez
łagodzenia, i skoryguj `LISTA_DYZUROW_211_222.md:16-22` (patrz pole dokumentu do zmiany w
części A tej instrukcji) dokładnie jednym zdaniem z cytowaną komendą.

**Ukończone, gdy:** tabela R1b kompletna i sondowana; trzy dowody „przed" istnieją w
artefaktach; rozstrzygnięcie `87` vs Twój pomiar jest w raporcie z komendą; dokument
`LISTA_DYZUROW_211_222.md` skorygowany dokładnie jednym zdaniem (albo potwierdzony, jeśli
Twój pomiar się zgadza).

## R2 — Naprawa plików grupy (a)

**Cel:** każdy plik z grupy (a) instaluje implementację mocka w SWOIM lokalnym
`beforeEach` (rejestrowanym PO globalnym `beforeEach` z `tests/setup.ts`, więc odpalającym
się PO `clearAllMocks()`), zamiast w `beforeAll`.

### R2a — wzorzec do skopiowania, nie do wymyślenia

`artifactKnowledgeIndexer.pg.test.ts:38-63`:

```ts
beforeAll(async () => {
  await assertRealPostgresTestEnvironment();
  expect(process.env.DB_TYPE).toBe('postgres');
  pool = new Pool({ connectionString: DATABASE_URL });
});

// ★ FIX-209 — [...] instalować spy od nowa w `beforeEach` TEGO pliku —
// rejestrowany PO globalnym `beforeEach` z setup.ts, więc odpala się PO
// `clearAllMocks()` i przeżywa do właściwego testu za każdym razem.
beforeEach(() => {
  vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(
    Array.from({ length: 1536 }, () => 0.01)
  );
});
```

`beforeAll` zostaje z DROGIM setupem (pula połączeń, dane bazowe — RAZ na plik); `beforeEach`
dostaje TANI setup mocka (rejestrowany PONOWNIE przed każdym testem).

### R2b — dla `interviewDeliveryMountedAuth.pg.test.ts` — UWAGA na kolejność

Ten plik ma DROGI `beforeAll` z insercjami SQL (`organizations`, `users`,
`organization_members`, `interview_sessions`, `interview_questions`,
`interview_assignments`) i DOPIERO na końcu ustawia `mockLlmCall.mockResolvedValue(...)`
(`:83`). **Nie przenoś całego `beforeAll` do `beforeEach`** — zduplikujesz insercje SQL przy
każdym z 6 testów, co jest marnotrawstwem i może naruszyć unikalne klucze. Przenieś
WYŁĄCZNIE linię `mockLlmCall.mockResolvedValue({...})` (`:83-85`) do NOWEGO `beforeEach`,
zostaw resztę `beforeAll` bez zmian.

### R2c — dla `ragService.test.js` — trzy mocki, jeden `beforeEach`

`beforeAll:24-54` robi `vi.doMock`, importuje moduł i woła `RagService.setDependencies({...})`
z trzema/czterema wewnętrznymi `vi.fn().mockX(...)` (`uuidv4`, `embeddingService.*`).
`vi.doMock`/import zostają w `beforeAll` (raz na plik — nie da się ponownie zaimportować
modułu tanio per test bez `vi.resetModules()`, co jest osobnym ryzykiem). **Przenieś
WYŁĄCZNIE wywołanie `RagService.setDependencies({...})`** (albo samo tworzenie obiektu
`embeddingService`/`uuidv4`) do `beforeEach`, PO obecnym `vi.clearAllMocks()` — i USUŃ albo
POPRAW komentarz `:60-61` („Ensure default polymorphic implementations are active"), bo jest
fałszywy.

### R2d — alternatywa rozważona i rozstrzygnięta liczbą

`restoreMocks: true`/`mockReset: true` per-plik (w opcjach lokalnego `describe` albo
metadanych pliku) jako alternatywa dla ręcznej reinstalacji: sprawdź, czy Vitest wspiera to
BEZ zmiany globalnego `vitest.config.ts` (`Z18` zakazuje globalnej zmiany). Jeśli wspiera —
policz koszt/zaletę względem wzorca `beforeEach`-reinstalacji (linie zmienione, ryzyko
efektów ubocznych na inne testy w pliku) i zapisz DECYZJĘ z liczbą. Jeśli NIE wspiera per
plik bez globalnej zmiany configu — jedyna droga to wzorzec R2a, napisz to wprost.

**Ukończone, gdy:** wszystkie potwierdzone pliki grupy (a) z R1b naprawione wzorcem R2a;
`interviewDeliveryMountedAuth.pg.test.ts` naprawiony BEZ duplikacji insercji SQL;
`ragService.test.js` naprawiony i fałszywy komentarz poprawiony; alternatywa `restoreMocks`
rozstrzygnięta liczbą, nie opinią; dowód „po" (R1c powtórzone po naprawie, wynik identyczny w
izolacji i w pełnym pliku) istnieje dla wszystkich naprawionych plików.

## R3 — Bezpiecznik na przyszłość, dołożony do istniejącego

**Cel:** nowy commit dopisujący ten sam wzorzec w `beforeAll` jest blokowany PRZED
commitem, nie odkrywany miesiące później przez kolejny FIX-2XX.

### R3a — kształt skryptu, wzorem `check-focus-canon.sh`

`scripts/check-mock-lifecycle.sh`:
- tryb domyślny = raport (zawsze `exit 0`, drukuje listę znalezionych naruszeń);
- tryb `--ci` = porównanie z baseline JSON (`scripts/check-mock-lifecycle.baseline.json`),
  fail TYLKO gdy liczba naruszeń ROŚNIE (ratchet — dług może maleć, nigdy rosnąć);
- `--update-baseline` do świadomej aktualizacji po legalnej zmianie zakresu;
- reguła wykrywania: w plikach podanych jako argumenty (staged diff w pre-commit, albo `git
  ls-files` w trybie pełnego skanu) znajdź blok `beforeAll(...)`, sprawdź czy zawiera
  łańcuch `.mock(ResolvedValue|Implementation|ReturnValue|RejectedValue)\(` BEZ wariantu
  `Once`, i czy TEN SAM plik ma odpowiadający setter w `beforeEach`. Brak `beforeEach`
  reinstalacji = naruszenie.

### R3b — wpięcie w `.husky/pre-commit`

Dopisz bramkę **`10)`** w tym samym stylu co istniejące 9 (numer, komentarz z uzasadnieniem
cytujący ten dyżur, `git diff --cached --name-only --diff-filter=ACM` gating). Gating: TYLKO
gdy staged diff dotyka plików `*.test.ts`/`*.test.tsx`/`*.test.js`/`*.test.jsx`/`*.spec.ts`/
`*.spec.tsx` (wzorem bramki `6)`, tania i zawsze aktualna).

### R3c — test bezpiecznika

`tests/unit/scripts/checkMockLifecycle.test.mjs`, wzorem
`tests/unit/scripts/checkActionsStagedScope.test.mjs` (izolowany worktree git, PRAWDZIWE
wywołanie skryptu na fixture'ach, nie zamockowany wynik). Dopisz plik do listy w
`package.json` skrypcie `test:node-native`.

### R3d — dowód, że bezpiecznik łapie i puszcza

1. Dopisz TYMCZASOWY plik testowy łamiący regułę (kopia kształtu sprzed naprawy —
   `git show 3331d27917:...artifactKnowledgeIndexer.pg.test.ts` jako fixture).
2. Uruchom `scripts/check-mock-lifecycle.sh --ci`, pokaż `exit≠0`, komunikat nazywający
   PLIK i LINIĘ.
3. Usuń plik tymczasowy.
4. Uruchom ponownie, pokaż `exit 0`.
5. Oba przebiegi (log + kod wyjścia) do `/private/tmp/cx-day211-atrapy-artefakty`.

**Ukończone, gdy:** skrypt istnieje i działa w obu trybach; bramka `10)` wpięta w
`.husky/pre-commit`; test skryptu istnieje i jest w `test:node-native`; dowód R3d kompletny
(złap → usuń → przepuść).

## R4 — Pomiar skutku: ile zieleni było fałszywej

**Cel:** dla każdego pliku naprawionego w R2, policzyć różnicę testów przed/po — to jest
NAJWAŻNIEJSZA liczba tego dyżuru.

### R4a — przebieg przed i po, per plik

Dla każdego pliku z R2: `vitest run <plik> --reporter=json
--outputFile=/private/tmp/cx-day211-atrapy-artefakty/<slug>.przed.json` (na kodzie SPRZED naprawy — `cp` do
`/private/tmp/cx-day211-atrapy-scratch` przed edycją, `Z27` zakazuje `git stash`) i analogicznie `.po.json` po naprawie.

### R4b — porównanie po `fullName`, nigdy po liczbach (`Z37`)

Dla każdej pary `przed`/`po`: lista testów, których **status** (`passed`/`failed`) się
zmienił, identyfikowanych PEŁNĄ nazwą (`fullName`), nie pozycją ani liczbą. „Było 6 PASS,
jest 6 PASS" NIE jest dowodem — jeden test mógł zgasnąć, a inny się zapalić.

### R4c — pełna lista w raporcie, bez skracania

Wypisz w raporcie WSZYSTKIE testy, które zmieniły wynik po naprawie — bez „i podobne", bez
próbki. Dla każdego: `fullName`, plik, `przed`→`po`, i jedno zdanie DLACZEGO (np. „mock LLM
teraz faktycznie kontroluje odpowiedź w teście 3-6, wcześniej szła prawdziwa ścieżka i test
przechodził przypadkiem" albo „test dotyka realnego, nienaprawionego zachowania produktu —
zostaje czerwony, dług do osobnego dyżuru, NIE naprawiasz go tutaj — patrz zakaz w części A").

Jeśli lista jest PUSTA — napisz to wprost i wyjaśnij dlaczego, z dowodem (np. „pierwszy test
w pliku i tak wykonuje dokładnie tę samą asercję co kolejne, więc kolejność nie miała
znaczenia dla wyniku — zweryfikowane przez ręczne porównanie asercji testów 2-6").

**Ukończone, gdy:** przebiegi przed/po istnieją dla wszystkich naprawionych plików, w
artefaktach z `shasum -a 256`; porównanie jest po `fullName`; pełna lista zmian (albo jej
świadomy brak z uzasadnieniem) jest w raporcie.

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje CAŁĄ ścieżkę: sonda → inwentarz → naprawa per plik → bezpiecznik →
pomiar skutku. Pominięcie ogniwa zmusiłoby Cię do złamania licencji albo do połowy roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis | Każdy plik testowy z grupy (a) w tabeli R1b — WYŁĄCZNIE przeniesienie instalacji mocka z `beforeAll` do `beforeEach` tego samego pliku, z komentarzem uzasadniającym. Minimum: `server/src/routes/interviewDelivery/__tests__/interviewDeliveryMountedAuth.pg.test.ts` (WYŁĄCZNIE linia `:83-85`), `tests/unit/backend/ragService.test.js` (WYŁĄCZNIE `setDependencies` + poprawka fałszywego komentarza `:60-61`) |
| Zapis | NOWY `scripts/check-mock-lifecycle.sh` + `scripts/check-mock-lifecycle.baseline.json` |
| Zapis | `.husky/pre-commit` — WYŁĄCZNIE dopisanie bramki `10)` na końcu, wzorem istniejących 9. **Zakaz zmiany bramek `1)`-`9)`** |
| Zapis | NOWY `tests/unit/scripts/checkMockLifecycle.test.mjs` + dopisanie go do listy plików w `package.json` skrypcie `test:node-native` (WYŁĄCZNIE dopisanie do istniejącej listy) |
| Zapis | NOWE pliki sondujące R0 w `/private/tmp/cx-day211-atrapy-scratch`/`/private/tmp/cx-day211-atrapy-artefakty` (poza repo — `Z13`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY211_ATRAPY_REPORT.md` |
| Zapis (ograniczony, dokładnie jedno zdanie) | `docs/program/funkcje/LISTA_DYZUROW_211_222.md` — WYŁĄCZNIE dopisanie jednego zdania na końcu pozycji `211` (linie `16-22`), korygującego/potwierdzającego liczbę `87` Twoim zmierzonym wynikiem z cytowaną komendą. **Zakaz zmiany reszty pliku** |
| Odczyt (ZAKAZ ZAPISU — `Z18`, bez wyjątku) | `tests/setup.ts` · `tests/helpers/**` · `tests/__mocks__/**` · `vitest.config.ts` · każdy `vitest.*.config.ts` · `server/vitest.config*.ts` · `tests/integration/_helpers/assertRealPostgres.ts` |
| Odczyt (ZAKAZ ZAPISU) | Wszystkie pliki testowe z grupy (b) w tabeli R1b — jeden test w pliku, albo już reinstalowane w `beforeEach` |
| Odczyt | `server/src/services/knowledge/__tests__/artifactKnowledgeIndexer.pg.test.ts` — wzorzec naprawy do skopiowania, NIE dotykasz go w tym dyżurze (już naprawiony) |
| Odczyt | `docs/program/funkcje/ODBIOR_209.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY209_INDEKSACJA_REPORT.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/CI_DAY58_REPORT_20260828.md` (T6, bug ODRĘBNY) · `scripts/check-focus-canon.sh` · `scripts/check-actions.sh` · `tests/unit/scripts/checkActionsStagedScope.test.mjs` — wzorce do naśladowania |
| Odczyt | `package.json` (wersja Vitest, `test:node-native`) |

**Nietykalne imiennie:** `tests/setup.ts` · `tests/helpers/**` · `tests/__mocks__/**` ·
`vitest.config.ts` · `vitest.*.config.ts` · `tests/integration/_helpers/assertRealPostgres.ts`
· `artifactKnowledgeIndexer.pg.test.ts` (już naprawiony, nie Twój zakres) · każdy plik grupy
(b) · `.husky/pre-commit` bramki `1)`-`9)` · `docs/program/funkcje/LISTA_DYZUROW_211_222.md`
poza jednym dozwolonym zdaniem.

**Rozłączność z partią równoległą:** dyżury `212`-`217` mogą biec równolegle (porty
zarezerwowane, patrz `LISTA_PORTOW_ZAJETYCH`). `212` dotyczy zabezpieczeń produktu (inny
zakres plikowy — testy bezpieczeństwa, nie harness mocków), ale MOŻE dotykać tych samych
plików testowych integracyjnych co Ty, jeśli któryś jest jednocześnie w grupie (a) tego
dyżuru i celem `212`. **Przed pierwszym commitem** sprawdź `git log` gałęzi bazowej pod kątem
równoległych dyżurów dotykających tych samych plików testowych i zgłoś kolizję ZANIM
zaczniesz pisać.

# 5. TWARDE ZASADY

- ★★ **`Z18` OBOWIĄZUJE BEZ WYJĄTKU.** Zero zmian w `tests/setup.ts` i sąsiadach. Naprawa
  jest WYŁĄCZNIE per-plik, w lokalnym `beforeEach`. Pokusa „napraw to raz, globalnie" jest tu
  najgroźniejsza i jest WPROST zakazana.
- ★★ **Liczba `87` jest hipotezą, nie faktem — traktuj ją jak każdą inną niezweryfikowaną
  tezę zamówienia** (`Z24`). Własny pomiar z cytowaną komendą jest obowiązkowy; przepisanie
  cudzej liczby jest podstawą odrzucenia dyżuru.
- ★★ **Nie myl tego buga z wyciekiem `mockResolvedValueOnce`** (`CI_DAY58_REPORT_20260828.md:212`)
  — inny mechanizm, inny kierunek błędu, poza zakresem.
- ★ **Zakaz naprawiania plików grupy (b).** Dotknięcie pliku z jednym testem albo już
  reinstalowanego w `beforeEach` to praca bez uzasadnienia.
- ★ **Zakaz retry w testach dowodowych `R1c`/`R4`** — `--retry=0` w każdej komendzie
  porównawczej, inaczej ponowienie może ukryć realną różnicę.
- ★ **Jeśli naprawa w R4 odsłania realny błąd produktu — zostawiasz go czerwonym, nazwanym
  pełnym `fullName`, i NIE naprawiasz go w tym dyżurze.** To jest osobny dług, nie porażka
  tej pozycji.
- ★ **Zrzuty: NIE DOTYCZY** — ten dyżur nie ma UI ani ekranów do zrzutu (patrz `TRASY_FRONT`
  w części A).
- ★ **`Z13`:** logi, sondy R0, JSON-y `--reporter=json` z R4 i wyjścia bramki R3 NIE wchodzą
  do repo — leżą w `/private/tmp/cx-day211-atrapy-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`). Zawężony
  wybór albo przepisanie cudzej liczby to zawyżenie i podstawa odrzucenia.

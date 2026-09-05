# INSTRUKCJA DYŻURU nr 368 — Codex — „★★ PRZEWODY CHAT — TRZY PROPSY, KTÓRYCH TRASA `/chat` NIE PRZEKAZUJE DO `UnifiedChatPanel`. **K2 (rdzeń):** przycisk „Akcje biznesowe” (Briefcase, `UnifiedChatPanel.tsx:6786`) renderuje się WYŁĄCZNIE gdy podany jest prop `onNavigateToActions` — a **żadne z 11 zmierzonych miejsc montowania** komponentu w całej aplikacji go nie przekazuje (audyt/`V1` liczą „10”, mój grep liczy **11** w **9 plikach** — rozbieżność do zapisania). **K6 (rdzeń):** Pomoc → „Zapytaj AI teraz” (`HelpSidePanel.tsx:307-341`) zapisuje `chatKickoffMessage` w globalnym store, ale `UnifiedChatPanel` czyta kickoff WYŁĄCZNIE z propa `kickoffMessage` (`:763,804-805,5006-5025`) — jedyny konsument store'u to `MainLayout.tsx:82-83,505-506`, montaż świadomie WYŁĄCZONY na widoku `AppView.AI_CHAT` (`MainLayout.tsx:102-134`). Trasy `/chat`/`/chat/:id` (`AppRoutes.tsx:1770-1782,1857-1869`) przekazują `UnifiedChatPanel` WYŁĄCZNIE `mode="full"` — kickoff ginie na obu. **C D-4 (mały):** etykieta/tooltip przycisku panelu roboczego to zawsze `aiChat.workPanel.open` (`UnifiedChatPanel.tsx:6851-6852`) niezależnie od stanu `showWorkPanel` — brakuje wariantu „zamknij”. ★ Dodatkowo (KROK 0, obowiązkowy w tej instrukcji): rodzina propsów warunkujących render przez `{prop && (...)}`, których `/chat` też nie przekazuje, obejmuje jeszcze `quickPrompts` (`:7419`) i `contextActions` (`:7399`) — wymagają WERDYKTU (celowe/defekt), nie automatycznej naprawy"

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
> **wyłącznie** `/private/tmp/cx-day368-przewody-chat`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-05.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****13_CHAT** — wyłącznie front-end. Ekran „Czat AI” (`/chat`, `/chat/:id`) i trzy propsy `UnifiedChatPanel`, których te trasy nie przekazują: `onNavigateToActions` (K2), `kickoffMessage`/`onKickoffConsumed` (K6), oraz statyczna etykieta przycisku panelu roboczego (C D-4). Produktem jest: (a) żywy cel nawigacji dla „Akcje biznesowe” za nową flagą `default OFF`; (b) fallback kickoffu ze store'u działający na KAŻDYM z 11 montaży komponentu, nie tylko na `/chat`; (c) etykieta zmienna ze stanem; (d) jawny werdykt dla pozostałych członków tej samej rodziny propsów (`quickPrompts`, `contextActions`). Zero zmian w `server/src/**` — to wyłącznie okablowanie propsów React, store Zustand i i18n**.
Trasy front: ``src/components/AIChat/UnifiedChatPanel.tsx` (cel naprawy — trzy pozycje) · `src/routes/AppRoutes.tsx` (WĄSKO: wydzielenie dwóch tras do nazwanych eksportowanych komponentów testowalności, zero zmiany JSX) · `src/hooks/useFeatureFlags.tsx` (jeden nowy wpis flagi) · `public/locales/{pl,en}/translation.json` (jeden nowy liść `aiChat.workPanel.close` w każdym) · nowe testy w `src/components/AIChat/__tests__/` i/lub `src/routes/__tests__/`. Reszta `src/**` — w tym `src/store/slices/uiSlice.ts`, `src/layouts/MainLayout.tsx`, `src/components/Help/HelpSidePanel.tsx` — **TYLKO ODCZYT**`. Trasy tył: `**BRAK.** Ten dyżur nie dotyka `server/src/**` w ogóle — K2/K6/D-4 to wyłącznie okablowanie front-endu (propsy React przekazywane przez trasy klienckie, store Zustand, i18n). Jeżeli w trakcie pracy okaże się, że naprawa wymaga zmiany po stronie serwera — to jest STOP i pytanie do właściciela w `R5`, nie improwizacja zakresu`.

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
WT=/private/tmp/cx-day368-przewody-chat
MARKER=9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day368-przewody-chat-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day368-przewody-chat/config.worktree"
cat "$VAULT/worktrees/cx-day368-przewody-chat/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day368-przewody-chat-scratch
mkdir -p /private/tmp/cx-day368-przewody-chat-artefakty

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
git -C "$VAULT" log --oneline 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day368-przewody-chat-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewięć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA K2: onNavigateToActions istnieje TYLKO wewnatrz UnifiedChatPanel.tsx
grep -rn "onNavigateToActions" src/
#   moje liczby: 4 wystapienia, wszystkie w src/components/AIChat/UnifiedChatPanel.tsx
#   (:745 typ, :798 destrukturyzacja, :6786 i :6793 render/klik). Zero wolaczy zewnetrznych.

# (2) TEZA: rodzina montazy <UnifiedChatPanel — policz SAM, audyt/V1 mowia "10"
bash -c "grep -rn '<UnifiedChatPanel' src/ | grep -v 'export const UnifiedChatPanel' | grep -v teresaEntityContext.ts"
#   moje liczby: 11 wierszy w 9 plikach (AIConsultantPanel.tsx x1, SplitLayout.tsx x2,
#   ChatOverlay.tsx x1, WorkCanvasShell.tsx x1, AIChatView.tsx x1, MainLayout.tsx x1,
#   FreeAssessmentView.tsx x1, Module1ContextView.tsx x1, AppRoutes.tsx x2).
#   ZERO z nich przekazuje onNavigateToActions. Jesli Twoja liczba rozni sie od 11 —
#   zapisz obie pelne listy plik:linia w raporcie.

# (3) TEZA K6: kickoff czytany WYLACZNIE z propa, nigdy ze store'u, wewnatrz komponentu
sed -n '5006,5025p' src/components/AIChat/UnifiedChatPanel.tsx
#   moje liczby: efekt czyta 'kickoffMessage' (parametr propa, linia 763/804) —
#   ZERO odwolania do useAppStore w tym efekcie na dzisiejszym markerze.

# (4) TEZA K6: jedyny konsument-czytelnik chatKickoffMessage ze store'u to MainLayout,
#     i jest swiadomie WYLACZONY na widoku AI_CHAT
grep -n "chatKickoffMessage\|clearChatKickoffMessage" src/layouts/MainLayout.tsx
sed -n '100,135p' src/layouts/MainLayout.tsx
#   moje liczby: uzycie w liniach 82-83 (odczyt) i 505-506 (przekazanie propa);
#   VIEWS_WITHOUT_CHAT_PANEL (:102-119) zawiera AppView.AI_CHAT — wiec na /chat
#   ten montaz (:485-511) NIGDY sie nie renderuje (shouldMountChatPanel=false).

# (5) TEZA K6: trasy /chat i /chat/:id przekazuja UnifiedChatPanel WYLACZNIE mode="full"
grep -n "ROUTES.AI_CHAT\b\|ROUTES.AI_CHAT_CONVERSATION\|<UnifiedChatPanel mode=" src/routes/AppRoutes.tsx
sed -n '1770,1783p;1857,1870p' src/routes/AppRoutes.tsx
#   moje liczby: dwa bloki (:1772-1782 i :1859-1869), oba <UnifiedChatPanel mode="full" />
#   BEZ zadnego innego propa. Zero 'kickoff' w calym pliku:
bash -c "grep -ni kickoff src/routes/AppRoutes.tsx" || echo "zero trafien — potwierdzone"

# (6) TEZA C D-4: etykieta panelu roboczego statyczna; sasiedni przycisk TTS poprawny
sed -n '6845,6900p' src/components/AIChat/UnifiedChatPanel.tsx
#   moje liczby: :6851-6852 zawsze t('aiChat.workPanel.open', ...); brak galezi po
#   showWorkPanel. Sasiedni przycisk TTS (:6881-6894) POPRAWNIE przelacza etykiete —
#   to jest wzorzec do skopiowania.

# (7) TEZA: klucz aiChat.workPanel.close NIE ISTNIEJE w zadnym slowniku
python3 -c "import json; d=json.load(open('public/locales/pl/translation.json')); print('close' in d['aiChat']['workPanel'], d['aiChat']['workPanel'])"
python3 -c "import json; d=json.load(open('public/locales/en/translation.json')); print('close' in d['aiChat']['workPanel'], d['aiChat']['workPanel'])"
#   moje liczby: False w obu, {'open': 'Otworz panel roboczy'} / {'open': 'Open work panel'}

# (8) TEZA: globalny mock useAppStore w tests/setup.ts NIE MA pol kickoffu ani getState()
sed -n '718,777p' tests/setup.ts
bash -c "grep -c 'chatKickoffMessage\|getState' tests/setup.ts"
#   moje liczby: 0 trafien pol kickoffu w bloku mocka; 'getState' nigdzie w tests/setup.ts —
#   kazdy test wolajacy useAppStore.getState() musi nadpisac mock LOKALNIE.

# (9) zasoby, leaf-count, bezpieczniki, dysk, porty
df -h /
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
lsof -nP -iTCP:6439 -sTCP:LISTEN; lsof -nP -iTCP:5579 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day368 || true
#   moje liczby: leaf pl 34331 / en 32342; focus=0 list=0 artefakt=0; reach=1 (ZASTANE,
#   patrz PULAPKA 5 — nie Twoja regresja); oba porty puste; 0 kontenerow; dysk >30 GB wolne.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day368-przewody-chat-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6439`. Twój JEDYNY port harnessu to `5579`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day368-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ paczki 05.09 — nie dotykasz: 367 (6438/5578), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584). Twoje własne wyłącznie: baza 6439, harness 5579. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `**JEDNA nowa flaga, jawnie zamówiona przez ten dyżur (wyjątek od `Z10`): `chatBusinessActionsNav`** w `DEFAULT_FLAGS` (`src/hooks/useFeatureFlags.tsx`), `defaultValue: false`, `allowLocalOverride: true`. Gates WYŁĄCZNIE fallback nawigacji przycisku „Akcje biznesowe” z `R1` — przycisk jest dziś niewidoczny wszędzie w produkcji, więc jego pierwsze pojawienie się na jakimkolwiek ekranie liczy się jako „nowe wizualium” (`CLAUDE.md` reguła 7, `Z11`) i wymaga akceptu właściciela na zrzucie PRZED zmianą wartości domyślnej na `true`. Naprawy K6 (kickoff) i C D-4 (etykieta) NIE są nowym wizualium — to przywrócenie/dokończenie już widzianej przez użytkownika funkcji — idą BEZ flagi, zgodnie z regułą dowodu tej serii`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs` (logika skryptu — jego WYJŚCIE `reachability.baseline.json` ma wąską licencję opisaną w tabeli licencji), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `src/layouts/MainLayout.tsx`, `src/store/slices/uiSlice.ts`, `public/locales/**` (nietykalne DO ZMNIEJSZENIA — dopisanie jednego liścia w `R3` jest jawnie zamówione osobno w tabeli licencji). Wszystkie **NIETYKALNE DO ZAPISU** poza jawnie opisanymi wąskimi wyjątkami w tabeli licencji`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (w chwili pisania tej instrukcji ostatnia użyta to `AF`, dyżur 365 — sprawdź komendą `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED commitem, bo równolegle piszą inni autorzy) · katalog dowodowy `evidence/przewody-chat/` (NIE ISTNIEJE na markerze — tworzysz) · WĄSKO: `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, WYŁĄCZNIE przez mechanizm `node scripts/dev/reachability-from-root.mjs --update-baseline`, WYŁĄCZNIE dla plików testowych, które SAM dodałeś. ★★★ MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE — żaden wiersz, żaden moduł. Plik postępu `/private/tmp/cx-day368-przewody-chat-postep.md` żyje POZA repo. Nowe pliki testowe w tym dyżurze leżą kolokowane w `src/components/AIChat/__tests__/`/`src/routes/__tests__/` (wzorzec istniejący w tym obszarze) — NIE pod `tests/`, więc `git add -f` zwykle niepotrzebny, ale sprawdź to SAM przed commitem. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day368-przewody-chat-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day368-przewody-chat-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
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
| `Z40` | ★★★ **ZAKAZ ODSŁANIANIA PRZYCISKU „AKCJE BIZNESOWE” DOMYŚLNIE.** Fallback nawigacji z `R1` idzie WYŁĄCZNIE za flagą `chatBusinessActionsNav` z `defaultValue: false`. Zmiana tej wartości na `true` w tym dyżurze = odrzucenie pozycji, niezależnie od tego, jak dobry jest wybrany cel nawigacji — przycisk nigdy w historii produktu nie był widoczny i pierwsze pokazanie go wymaga zrzutu i akceptu właściciela. ★★★ **ZAKAZ ASERCJI NA TEKŚCIE ŹRÓDŁA DLA TRZECH NAPRAW.** Każdy nowy test dowodzący K2/K6/D-4 wywołuje komponent i sprawdza wynik (nawigację, wysłaną wiadomość, zmienioną etykietę) — `readFileSync`+`toContain` na własnym kodzie naprawy jest zakazane jako jedyny dowód. ★★★ **ZAKAZ MODYFIKACJI `tests/setup.ts`.** Globalny mock `useAppStore` (`:718-777`) nie ma pól kickoffu i nie ma `getState()` — nadpisujesz go LOKALNIE we własnym pliku testowym, nigdy globalnie (`Z18`). ★★ **ZAKAZ ZMIANY ZACHOWANIA MONTAŻY, KTÓRE JUŻ DZIAŁAJĄ.** Fallback kickoffu w `R2` sprawdza WARTOŚĆ propa `kickoffMessage`, nie jego obecność — musisz dowieść testem, że `MainLayout.tsx:505-506` i `AIConsultantPanel.tsx:334` (oba już przekazują własny, sensowny `kickoffMessage`) nie zmieniają zachowania. ★★ **ZAKAZ TRAKTOWANIA `reachability --check-baseline` JAKO TWOJEJ REGRESJI.** Na samym markerze kończy się `exit 1` z powodu trzech plików niezwiązanych z czatem (już scommitowanych) — nie naprawiasz cudzego stanu, mierzysz PRZED i PO, i jedyna dopuszczalna zmiana logu to Twoje własne nowe pliki testowe zarejestrowane przez `--update-baseline`. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). ★ **ZAKAZ PORÓWNANIA MONTAŻY PO LICZBIE BEZ LISTY `plik:linia`** (analogia `Z37`) — audyt mówi „10”, Twój pomiar może dać inną liczbę; obowiązuje pełna lista, nie sama liczba | Bo trzy defekty tego ekranu mają jeden wspólny kształt: kod, który wygląda na kompletny, okablowany do propa, którego żadna trasa nie dostarcza. To NIE jest brakująca funkcja — to jest zerwany przewód między dwoma poprawnymi końcami. Naprawa jednego przewodu (K2) bez ostrożności odsłania funkcję, której użytkownik nigdy nie widział — stąd flaga. Naprawa drugiego (K6) musi działać wszędzie, bo store jest globalny, a nie tylko na trasie, która go dziś czyta — stąd wymóg fallbacku uogólnionego, nie łatki punktowej. I trzeci defekt (D-4) jest tak mały, że pokusa, by go pominąć, jest duża — ale to dokładnie taki mały, tani do naprawienia szczegół, który zostawiony bez adresu tygodniami wygląda jak niedbałość, gdy w końcu ktoś go zauważy |

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
cd /private/tmp/cx-day368-przewody-chat

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day368-pg psql -U postgres -d cx368 \
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
cd /private/tmp/cx-day368-przewody-chat

docker run -d --name cx-day368-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx368 \
  -p 127.0.0.1:6439:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day368-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6439/cx368 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6439/cx368 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day368-przewody-chat && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6439/cx368 \
JWT_SECRET=cx368-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy jednostkowe frontu z roota, `RUN_DB_TESTS=0 MOCK_DB=true` (ten dyżur nie dotyka bazy w ogóle — zero testów `.pg.test.ts`, zero serwera). Nowe pliki testowe kolokujesz w `src/components/AIChat/__tests__/` (dla `UnifiedChatPanel.tsx`) i/lub `src/routes/__tests__/` (jeśli wydzielasz nazwane komponenty tras z `AppRoutes.tsx`) — to jest ISTNIEJĄCY wzorzec tego obszaru (wszystkie testy `AIChat` dziś tam mieszkają), nie `tests/` root. Uruchamiaj per plik: `npx vitest run <plik> --retry=0 --reporter=json --outputFile=/private/tmp/cx-day368-przewody-chat-artefakty/<etykieta>.json`. Zakaz pełnego `vitest`/`tsc` bez filtra pliku --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day368-przewody-chat-artefakty/day368-przewody-chat.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day368-przewody-chat && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy jednostkowe frontu z roota, `RUN_DB_TESTS=0 MOCK_DB=true` (ten dyżur nie dotyka bazy w ogóle — zero testów `.pg.test.ts`, zero serwera). Nowe pliki testowe kolokujesz w `src/components/AIChat/__tests__/` (dla `UnifiedChatPanel.tsx`) i/lub `src/routes/__tests__/` (jeśli wydzielasz nazwane komponenty tras z `AppRoutes.tsx`) — to jest ISTNIEJĄCY wzorzec tego obszaru (wszystkie testy `AIChat` dziś tam mieszkają), nie `tests/` root. Uruchamiaj per plik: `npx vitest run <plik> --retry=0 --reporter=json --outputFile=/private/tmp/cx-day368-przewody-chat-artefakty/<etykieta>.json`. Zakaz pełnego `vitest`/`tsc` bez filtra pliku --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day368-przewody-chat-artefakty/day368-przewody-chat.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day368-przewody-chat/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day368-pg psql -U postgres -d cx368 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day368-pg`.
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
> **(e) ★★★ **PIĘĆ PUŁAPEK.** (1) **Zero precedensu renderowania realnego `UnifiedChatPanel`.** Każdy istniejący test w tym repo albo mockuje cały komponent, albo czyta jego źródło jako tekst (`grep` potwierdza: 0 wyjątków). Budżetuj czas na to, że Twój test może być pierwszym, który naprawdę go montuje. (2) **Globalny mock `useAppStore` w `tests/setup.ts:718-777` nie ma pól kickoffu i nie ma `getState()`.** `UnifiedChatPanel.tsx` woła oba warianty (`useAppStore((s) => …)` ORAZ `useAppStore.getState()`, np. `:3117`) — nadpisz mock LOKALNIE w swoim pliku testowym z pełnym kształtem, PRZED importem testowanego modułu. (3) **`MainLayout` nigdy nie był renderowany w teście w tym repo** — pełne mocnowanie prawdziwej trasy `/chat` (z `MainLayout`) jest kosztowne; dopuszczalny, jawnie opisany kompromis to render `UnifiedChatPanel` z propsami DOKŁADNIE takimi jak realnie przekazuje `AppRoutes.tsx:1778`/`:1865` (czyli sam `mode="full"`). (4) **Rozbieżność liczby montaży.** Audyt i `V1` liczą „10” miejsc montowania `<UnifiedChatPanel`; mój własny `grep` (po odfiltrowaniu definicji komponentu i komentarza w `teresaEntityContext.ts:15`, oba fałszywie pasują do wzorca `<UnifiedChatPanel`) daje **11** w **9 plikach**. Policz sam i zapisz obie listy, jeśli się różnią. (5) **`reachability --check-baseline` jest już czerwony na samym markerze** (`exit 1`), z przyczyny NIEZWIĄZANEJ z czatem (trzy pliki testowe już scommitowane, nieobecne w `reachability.baseline.json`) — nie próbuj tego naprawiać jako część tego dyżuru; zmierz PRZED i PO, dopuszczalna zmiana to WYŁĄCZNIE Twoje własne nowe pliki, zarejestrowane przez `--update-baseline`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day368-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day368-przewody-chat-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: asercja zachowania, dowód przez realny montaż, nowy widoczny element = flaga OFF, lokalne nadpisanie mocka `useAppStore`) · R1 (K2: żywy cel nawigacji „Akcje biznesowe” za nową flagą `chatBusinessActionsNav` default OFF, z dowodem mutacyjnym i zrzutem dev-render — RDZEŃ) · R2 (K6: fallback kickoffu ze store'u działający na każdym montażu, z KROK 0 pełnej rodziny propsów `{prop && (...)}` i werdyktem dla `quickPrompts`/`contextActions` — RDZEŃ) · R3 (C D-4: etykieta panelu roboczego zmienna ze stanem, dwa nowe liście słownika) · R4 (przemiar warunków wspólnych, domknięcie tabeli mianowników, evidence, rejestr znalezisk) · R5 (raport i pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6439` albo `5579` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6439` albo `5579`** (`Z7`).

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

Ekran „Czat AI" (`/chat`) wygląda kompletnie, ale trzy elementy jego nagłówka są
okablowane do propsów, których **żadna trasa `/chat` nie przekazuje**. Kod działa —
gdyby ktoś podał właściwy prop, przycisk by zadziałał — ale nikt go nie podaje.
To jest dokładnie kształt „wołacz istnieje, nie renderuje się": grep znajduje kod,
użytkownik nie widzi funkcji.

**K2 — przycisk „Akcje biznesowe" (Briefcase) nigdy się nie renderuje.**
`UnifiedChatPanel.tsx:6786`: `{onNavigateToActions && (...)}`. Prop
`onNavigateToActions` jest **zdefiniowany, destrukturyzowany i użyty wyłącznie
wewnątrz `UnifiedChatPanel.tsx` samego** (`:745`, `:798`, `:6786`, `:6793`) —
**żadne** z miejsc montowania komponentu w całej aplikacji go nie podaje.
Audyt `C_naglowek_historia.md` (D-1) to zgłosił jako defekt lokalny trasy `/chat`;
weryfikacja `V1_weryfikacja_P1.md` (pkt 3) poszła dalej i sprawdziła WSZYSTKIE
miejsca montowania — wniosek: **przycisk jest martwy w skali całego produktu**,
nie tylko na ekranie czatu.

**K6 — Pomoc → „Zapytaj AI teraz" gubi wiadomość na `/chat`.**
`HelpSidePanel.tsx:307-341` (`openAiNow`) zapisuje treść w globalnym store
(`setChatKickoffMessage(prompt)`, `:324`) i (na desktopie) liczy na to, że
istniejący, już otwarty panel czatu ją podejmie. Ale `UnifiedChatPanel` czyta
kickoff **wyłącznie z propa** `kickoffMessage` (`:763`, `:804-805`, efekt
`:5006-5025`), nigdy ze store'u. Jedyne miejsce w całym `src/`, które **czyta**
`chatKickoffMessage` ze store'u i przekazuje go dalej jako prop, to
`MainLayout.tsx:82-83,505-506` — **wewnętrzny, split-panelowy montaż Teresy**,
który `MainLayout` **świadomie wyłącza** dla widoku `AppView.AI_CHAT`
(`VIEVS_WITHOUT_CHAT_PANEL` zawiera `AppView.AI_CHAT`, `MainLayout.tsx:102-119`,
`132-134` — „Full-screen chat mode — no split panel"). Na `/chat` i `/chat/:id`
(`AppRoutes.tsx:1770-1782`, `1857-1869`) `UnifiedChatPanel mode="full"` jest
więc wołany **bez żadnego propa poza `mode`** — kickoff nie ma jak dotrzeć.
Audyt `F_rama_ekranu.md` (D-1) to zgłosił; weryfikacja `V2_weryfikacja_P1_i_probka.md`
(pkt 4) potwierdziła niezależnym dowodem dokładnie ten sam łańcuch.

**C D-4 — etykieta przycisku panelu roboczego nigdy nie mówi „zamknij".**
`UnifiedChatPanel.tsx:6845-6856`: `title`/`aria-label` to zawsze
`t('aiChat.workPanel.open', 'Open work panel')`, niezależnie od tego, czy panel
jest już otwarty (`showWorkPanel`, `:6499`). Sąsiedni przycisk wyciszenia
(`:6881-6894`) POPRAWNIE zmienia etykietę na podstawie stanu — to jest wzorzec
do skopiowania, nie do wymyślenia od nowa.

**Wspólny mianownik wszystkich trzech:** propsy, które istnieją w typie
(`UnifiedChatPanelProps`), są poprawnie obsłużone wewnątrz komponentu, ale
konkretna trasa `/chat` ich nie dostarcza. Dlatego `KROK 0` tego dyżuru każe
wypisać **całą rodzinę** takich propsów, nie tylko dwa zgłoszone (`R2`).

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| deklaracja/użycie `onNavigateToActions` w całym `src/` | **4 wystąpienia, wszystkie w `UnifiedChatPanel.tsx`** | `:745` (typ), `:798` (destrukturyzacja), `:6786`+`:6793` (render/klik) |
| montaże `<UnifiedChatPanel` (JSX, realne) w całym `src/` | **11**, w **9 plikach** (dwa pliki mają po 2 montaże) | patrz tabela mianowników #1 — **audyt/V1 mówią „10" — mój grep daje 11, zapisz rozbieżność** |
| montaże przekazujące `onNavigateToActions` | **0 z 11** | żaden |
| montaże przekazujące `kickoffMessage` | **1 z 11** (`MainLayout.tsx:505`) — ale ten montaż jest wyłączony na widoku `AI_CHAT` | `MainLayout.tsx:102-134` (`VIEWS_WITHOUT_CHAT_PANEL` zawiera `AppView.AI_CHAT`) |
| jedyny konsument-czytelnik `chatKickoffMessage` ze store'u | `MainLayout.tsx:82-83,505-506` | `useAppStore((s) => s.chatKickoffMessage)` / `clearChatKickoffMessage` jako `onKickoffConsumed` |
| zapis do `chatKickoffMessage` ze store'u | `HelpSidePanel.tsx:268,324` (`openAiNow`) **oraz** `UnifiedChatPanel.tsx` samo (`:3117,3504,3755,3960`, wewnętrzny redirect do innego narzędzia) | `useAppStore.getState().setChatKickoffMessage(...)` |
| trasy `/chat` / `/chat/:id` — propsy przekazane do `UnifiedChatPanel` | **wyłącznie `mode="full"`** | `AppRoutes.tsx:1778`, `:1865` |
| etykieta przycisku panelu roboczego | zawsze `aiChat.workPanel.open` | `UnifiedChatPanel.tsx:6851-6852` |
| klucz `aiChat.workPanel.close` w słownikach | **NIE ISTNIEJE** (pl i en mają wyłącznie `.open`) | `public/locales/pl/translation.json:18843-18845`, `public/locales/en/translation.json:17596-17598` |
| inne propy `UnifiedChatPanelProps`, które `/chat` pomija i które warunkują render elementu przez `{prop && (...)}` | **`quickPrompts`** (`:7419`), **`contextActions`** (`:7399`) — poza już zgłoszonymi `onNavigateToActions`/`kickoffMessage` | grep `{quickPrompts &&`, `{contextActions &&` w `UnifiedChatPanel.tsx` |
| `useAppStore` w globalnej infrastrukturze testowej | **zamockowany globalnie**, statyczny stan **BEZ** `chatKickoffMessage`/`setChatKickoffMessage`/`clearChatKickoffMessage` i **BEZ** `getState()` | `tests/setup.ts:718-777` (dwa bloki `vi.mock`, alias i ścieżka względna) |
| test renderujący realny `<UnifiedChatPanel>` (nie mock, nie `readFileSync`) gdziekolwiek w repo | **0** | `grep` po `__tests__` — każdy istniejący test albo mockuje komponent, albo czyta jego źródło jako tekst |
| `scripts/dev/reachability-from-root.mjs --check-baseline` na tym markerze | **exit 1** — ZASTANE, niezwiązane z czatem | 3 pliki testowe już scommitowane w markerze, nieobecne w `reachability.baseline.json` (`git log` potwierdza commit `e67e7565…`) |
| leaf-count słowników | **pl 34331**, **en 32342** | licznik rekurencyjny z `§0.2`/warunków wspólnych |
| ostatnia użyta litera w `REJESTR_ZNALEZISK_20260903.md` w chwili pisania tej instrukcji | **`AF`** (dyżur 365) | `grep -nE '^## [A-Z]+\.' … \| tail -5` — **sprawdź SAM tuż przed commitem, inni autorzy piszą równolegle** |

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **4** wystąpienia `onNavigateToActions` (wszystkie w
`UnifiedChatPanel.tsx`); **11** realnych montaży `<UnifiedChatPanel` w **9**
plikach (audyt mówi „10" — **Twój pomiar rozstrzyga**); **0** montaży
przekazujących `onNavigateToActions` lub działający `kickoffMessage` na `/chat`;
etykieta panelu roboczego niezmienna w **1** miejscu (`:6851-6852`); **2**
dodatkowe propy z rodziny (`quickPrompts`, `contextActions`) poza dwoma
zgłoszonymi; `useAppStore` zamockowany globalnie **bez** trzech pól kickoffu;
**0** istniejących testów renderujących realny `UnifiedChatPanel`; `reachability
--check-baseline` **already RED (exit 1)** na samym markerze, z przyczyną
niezwiązaną z czatem; leaf-count **pl 34331 / en 32342**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ
pomiar — zapisz rozbieżność wprost.** W szczególności: jeżeli Twoje 11 montaży
różni się od mojego — wklej pełną listę `plik:linia` obu przebiegów.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · TRASA (TYLKO REFAKTOR TESTOWALNOŚCI) · STORE · POMOC · FLAGI · SŁOWNIKI · TESTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast
zmiany brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem
jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Komponent — cel naprawy** | `src/components/AIChat/UnifiedChatPanel.tsx` | **PEŁNA LICENCJA** na: (a) fallback nawigacji „Akcje biznesowe" za nową flagą `R1`; (b) fallback kickoffu ze store'u `R2`; (c) etykieta zmienna panelu roboczego `R3`. **Zakaz** zmiany logiki niezwiązanej z tymi trzema pozycjami (np. V8, sygnałów, TTS) | — |
| **Trasa `/chat` — TYLKO refaktor testowalności** | `src/routes/AppRoutes.tsx`, bloki `ROUTES.AI_CHAT` (`:1770-1782`) i `ROUTES.AI_CHAT_CONVERSATION` (`:1857-1869`) | **★ WĄSKA LICENCJA**: wolno wydzielić te dwa bloki do nazwanych, eksportowanych komponentów (`AiChatRoute`, `AiChatConversationRoute`), **dokładnie wzorem** `AssessmentOutputReportRoute`/`AssessmentOutputPresentationRoute` (`:838-857`) — **identyczna treść JSX**, zero zmiany propsów przekazywanych do `UnifiedChatPanel` czy `MainLayout`. **Zakaz** dodawania jakiegokolwiek nowego propa w tym pliku (fix mieszka wyłącznie w `UnifiedChatPanel.tsx`) | Brief z `plik:linia` + diff **nienałożony**, jeśli refaktor okaże się niewykonalny bez zmiany zachowania |
| **Store kickoffu (odczyt + weryfikacja kompletności)** | `src/store/slices/uiSlice.ts` (`:45-47,176,231-232`) | **TYLKO ODCZYT** — `chatKickoffMessage`/`setChatKickoffMessage`/`clearChatKickoffMessage` już istnieją i są kompletne; fallback w `R2` ma z nich korzystać, nie duplikować | Brief |
| **Pomoc (nadawca kickoffu)** | `src/components/Help/HelpSidePanel.tsx` (`:307-341`) | **TYLKO ODCZYT** — to jest dowód, nie cel naprawy; `R2` naprawia stronę odbiorczą | Brief |
| **`MainLayout` (jedyny istniejący konsument kickoffu)** | `src/layouts/MainLayout.tsx` (`:82-83,102-134,505-506`) | **TYLKO ODCZYT** — pokazuje wzorzec (`kickoffMessage`/`onKickoffConsumed`) i dowodzi, że na widoku `AI_CHAT` jest świadomie wyłączony. **Zakaz** dopisywania tu drugiego montażu czy obchodzenia `VIEWS_WITHOUT_CHAT_PANEL` | Brief |
| **Rejestr flag** | `src/hooks/useFeatureFlags.tsx`, tablica `DEFAULT_FLAGS` | **★ WĄSKA LICENCJA**: wolno dopisać JEDEN nowy wpis (`id` wg `R1`), `defaultValue: false`, `allowLocalOverride: true`. **Zakaz** zmiany wartości domyślnej jakiejkolwiek istniejącej flagi | — |
| **Kandydaci nawigacji „Akcje biznesowe"** | `src/views/ActionProposalView.tsx`, `src/components/AIChat/ActionCenter.tsx`, `src/routes/routeConfig.ts` (stałe `AI_ACTIONS`, `AI_OS.ACTION_CENTER`), `src/utils/internalToolsAccess.ts` | **TYLKO ODCZYT** — służą do WYBORU celu nawigacji w `R1`, nie do zmiany | Brief z uzasadnieniem wyboru |
| **Słowniki** | `public/locales/pl/translation.json:18843-18845`, `public/locales/en/translation.json:17596-17598` | **★ WĄSKA LICENCJA**: wolno dopisać dokładnie JEDEN nowy liść `aiChat.workPanel.close` w KAŻDYM z dwóch plików, wartość PO POLSKU w `pl` i po angielsku w `en` (nie kalka). Reszta pliku **NIETYKALNA**, liście nie mogą zmaleć | — |
| **Testy — obszar czatu (kolokowane, wzorzec istniejący)** | `src/components/AIChat/__tests__/**`, `src/routes/__tests__/**` | **PEŁNA LICENCJA** na nowe pliki (wzorzec kolokacji tego katalogu — **NIE** `tests/` root, bo tu wszystkie istniejące testy `AIChat` mieszkają kolokowane z komponentem). Nowe pliki nie wymagają `git add -f` (nie leżą pod `tests/`), ale sprawdź to SAM przed commitem | — |
| **Infrastruktura testowa — NAJOSTRZEJSZE** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT, `Z18`.** Globalny mock `useAppStore` (`tests/setup.ts:718-777`) **NIE MA** pól kickoffu i **NIE MA** `getState()` — nadpisujesz go **lokalnie**, wewnątrz WŁASNEGO pliku testowego (`vi.mock(...)` na początku tego pliku), nigdy globalnie | Brief, jeśli lokalne nadpisanie okaże się niewystarczające |
| **Baseline osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA**: wolno zaktualizować WYŁĄCZNIE przez `node scripts/dev/reachability-from-root.mjs --update-baseline` (mechanizm skryptu, nie ręczna edycja), i tylko żeby zarejestrować pliki testowe, które SAM dodałeś w tym dyżurze. **Zakaz** rejestrowania cudzych 3 plików (ZASTANE, patrz `R4`) jako Twoich, chyba że `R4` każe to zrobić z uzasadnieniem | Brief |
| **Bezpieczniki kanonu i skrypt osiągalności (logika)** | `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs` | **NIETYKALNE DO ZAPISU** (`Z12`) — wolno wyłącznie URUCHAMIAĆ | Opis w raporcie |
| **Produkt poza zakresem (V8, sygnały, historia, foldery)** | `src/components/AIChat/**` poza `UnifiedChatPanel.tsx` | **TYLKO ODCZYT** | Opis w raporcie |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej tuż przed commitem | — |
| **Nowe dowody** | `evidence/przewody-chat/**` (**NIE ISTNIEJE — tworzysz**) | **PEŁNA LICENCJA**; commitujesz normalnie (nie pod `tests/`, `git add -f` niepotrzebny) | — |
| **Macierz odbioru, rejestry bramek G15/G19/G20** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, `REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **NIETYKALNE DO ZAPISU** — poza zakresem tego dyżuru | Rekomendacja w raporcie |
| **Cudze tereny** | wszystkie pliki audytu `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**` · pozostałe defekty D-2/D-3/D-5/D-6 z `C_naglowek_historia.md` (i18n bulk, martwy `ChatExportModal`) · V8/`myWorkSignalsV2`/private mode · rodzeństwo 367/369-373 | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff nienałożony |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (maja WZROSNAC o dokladnie 2: workPanel.close x pl/en)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 34331, en 32342 — PO: dokladnie +1 w kazdym

# (b) trzy bezpieczniki kanonu maja konczyc sie kodem 0 -- NIEZALEZNE od tego dyzuru
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0 na markerze

# (c) ★ osiagalnosc — JUZ NA MARKERZE konczy sie kodem 1, z przyczyny NIEZWIAZANEJ z czatem
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby: reach=1, log wskazuje 3 nowe pliki testowe (Initiatives/assessment/admin),
#   juz scommitowane na markerze, nieobecne w reachability.baseline.json.
#   NIE PRÓBUJESZ TEGO "NAPRAWIAĆ" — to nie jest Twoja regresja. Zmierz ten sam log
#   PO swoich zmianach: dopuszczalny wynik to TEN SAM log plus (opcjonalnie) Twoje wlasne
#   nowe pliki testowe zarejestrowane przez `--update-baseline`. Jakikolwiek INNY plik
#   znikający lub pojawiający się w tym logu jest STOP-em do wyjasnienia w raporcie.
```

**Jeżeli liczba słowników zmaleje, bramka `list-canon`/`focus-canon`/`artefakt` się
zaczerwieni od Twojej zmiany, albo log `reach` urośnie o coś INNEGO niż Twoje własne
nowe testy — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | montaże `<UnifiedChatPanel` (JSX realne, bez definicji i komentarzy) | `11` w `9` plikach | `bash -c "grep -rn '<UnifiedChatPanel' src/ \| grep -v 'export const UnifiedChatPanel' \| grep -v teresaEntityContext.ts"` | TAK — **audyt/V1 mówią „10"; wypisz pełną listę `plik:linia` i porównaj** |
| 2 | wystąpienia `onNavigateToActions` w `src/` | `4`, wszystkie w `UnifiedChatPanel.tsx` | `grep -rn "onNavigateToActions" src/` | TAK |
| 3 | montaże przekazujące `kickoffMessage` | `1` (`MainLayout.tsx:505`), świadomie wyłączony na `/chat` | `grep -rn "kickoffMessage=" src/` + `MainLayout.tsx:102-134` | TAK |
| 4 | dodatkowe propy rodziny `{prop && (...)}` pomijane przez `/chat` | `2` (`quickPrompts`, `contextActions`) poza dwoma zgłoszonymi | KROK 0 z `R2` — grep każdego propa z `UnifiedChatPanelProps` | TAK — **wypisz WSZYSTKIE, nie tylko te dwa; jeśli znajdziesz więcej, dopisz** |
| 5 | testy renderujące realny `UnifiedChatPanel` (nie mock, nie `readFileSync`) | `0` | `grep -rln "UnifiedChatPanel" src/**/__tests__/*.test.tsx` + inspekcja każdego wyniku | TAK — **to jest powód, dla którego `R1`/`R2` opisują dokładnie, jak nadpisać mocki** |
| 6 | pola kickoffu w globalnym mocku `useAppStore` | `0` z `3` (`chatKickoffMessage`, `setChatKickoffMessage`, `clearChatKickoffMessage`), brak `getState()` | `sed -n '718,777p' tests/setup.ts` | TAK |
| 7 | wynik `reachability --check-baseline` na markerze | `exit 1`, 3 pliki niezwiązane z czatem | komenda (c) z „WARUNKÓW WSPÓLNYCH" | TAK — **ZASTANE, nie Twoje** |
| 8 | leaf-count PL/EN | `34331` / `32342` | komenda (a) z „WARUNKÓW WSPÓLNYCH" | TAK |
| 9 | ostatnia litera w rejestrze znalezisk | `AF` w chwili pisania | `grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md \| tail -5` | TAK — **sprawdź PONOWNIE tuż przed commitem** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/AIChat/UnifiedChatPanel.tsx` (trzy naprawy: `R1`, `R2`, `R3`) ·
`public/locales/pl/translation.json` + `public/locales/en/translation.json` (jeden
nowy liść `aiChat.workPanel.close` w każdym) ·
`src/hooks/useFeatureFlags.tsx` (jeden nowy wpis w `DEFAULT_FLAGS`) ·
nowe pliki testowe w `src/components/AIChat/__tests__/` i/lub `src/routes/__tests__/` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md` ·
`evidence/przewody-chat/**`.

**Zapisujesz WARUNKOWO:**
`src/routes/AppRoutes.tsx` (WYŁĄCZNIE wydzielenie dwóch nazwanych eksportowanych
komponentów tras, zero zmiany treści JSX — patrz tabela licencji) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WYŁĄCZNIE przez
`--update-baseline`, WYŁĄCZNIE dla Twoich własnych nowych plików testowych) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/store/slices/uiSlice.ts`, `src/layouts/MainLayout.tsx`,
`src/components/Help/HelpSidePanel.tsx`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`,
`.github/workflows/**`, `server/**` (dyżur nie dotyka backendu wcale),
`scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh`,
`scripts/dev/reachability-from-root.mjs` (logika skryptu),
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`,
jakikolwiek plik `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day368-przewody-chat
git diff --name-only --cached | tee /private/tmp/cx-day368-przewody-chat-artefakty/staged.txt
bash -c "grep -iE '^src/store/slices/uiSlice|^src/layouts/MainLayout|^src/components/Help/HelpSidePanel|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/|MODULE_ACCEPTANCE|REJESTR_G15|G19_INWENTARZ|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day368-przewody-chat-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Każdy nowy test wywołuje
komponent/logikę i sprawdza WYNIK (wiadomość wysłana, etykieta zmieniona, nawigacja
wywołana). `readFileSync` + `toContain` na Twoim własnym kodzie naprawy jest
**zakazane** jako jedyny dowód. (Istniejące testy typu `chatHeaderControls…` czytające
źródło dla sprawdzenia KLAS CSS nie są Twoim wzorcem — Ty naprawiasz zachowanie, nie
stylistykę.)

**(2) Dowód idzie przez REALNY montaż, nie przez założenie o propsach.** Zero testów
w tym repo dzisiaj renderuje prawdziwy `UnifiedChatPanel` (wszystkie albo go mockują,
albo czytają jako tekst — zmierzone w tabeli mianowników #5). Twój test ma być
PIERWSZYM, który go naprawdę renderuje, z propsami DOKŁADNIE takimi, jakie realnie
przekazuje trasa `/chat` (czyli same `mode="full"` — nic więcej). Jeśli sięgasz po
refaktor testowalności `AppRoutes.tsx` (tabela licencji), renderuj przez NAZWANY
eksportowany komponent trasy, nie przez odtworzenie jej JSX z pamięci.

**(3) Nowy WIDOCZNY element = flaga `default OFF` do akceptu właściciela.** Przycisk
„Akcje biznesowe" nigdy w produkcji nie był widoczny — wyłączanie defektu, który go
ukrywał, oznacza pokazanie go PIERWSZY RAZ. To jest „nowe wizualium" w rozumieniu
`CLAUDE.md` reguły 7 i `Z11`, nawet jeśli kod istnieje od dawna. Naprawa K6 (kickoff)
i C D-4 (etykieta) NIE tworzą nowego widocznego elementu — to naprawa istniejącej,
już widzianej przez użytkownika funkcji — więc idą BEZ flagi.

**(4) `tests/setup.ts` jest `Z18`-nietykalny, ale jego mock `useAppStore` nie
wystarcza.** Nie zmieniasz globalnego mocka. Nadpisujesz go lokalnie w swoim pliku
testowym (`vi.mock('@/store/useAppStore', ...)` PRZED importem testowanego modułu),
z pełnym stanem zawierającym `chatKickoffMessage`/`setChatKickoffMessage`/
`clearChatKickoffMessage` ORAZ statyczną `getState()` (bo `UnifiedChatPanel.tsx`
w kilku miejscach woła `useAppStore.getState()` bezpośrednio, nie tylko przez hook).

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus
`git show --stat` każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — K2: PRZYCISK „AKCJE BIZNESOWE" DOSTAJE ŻYWY CEL, ZA FLAGĄ (rdzeń)

1. **KROK 0 — rodzina montaży.** `grep -rn "<UnifiedChatPanel" src/` (odfiltruj
   definicję i komentarz w `teresaEntityContext.ts:15`). Wypisz PEŁNĄ listę
   `plik:linia` — moja liczba to `11` w `9` plikach; jeśli Twoja się różni, wklej
   obie listy i napisz dlaczego.
2. **Wybierz cel nawigacji, z dowodem, nie założeniem.** Dwaj kandydaci istnieją
   już dziś w `routeConfig.ts`:
   - `ROUTES.AI_ACTIONS` = `/ai-actions` → `ActionProposalView`
     (`AppRoutes.tsx:2155-2165`), montowany **wprost pod `MainLayout`, BEZ
     `InternalToolsGate`** — więc a priori dostępny zwykłemu userowi;
   - `ROUTES.AI_OS.ACTION_CENTER` = `/ai/action-center` → `ActionCenter`
     (`AppRoutes.tsx:1804-1808`), montowany przez `renderInternalToolsShell`,
     czyli owinięty `InternalToolsGate` / `canUseInternalTools(currentUser)`
     (`internalToolsAccess.ts:41`) — a priori NIE dla zwykłego usera.

   Zweryfikuj to SAM (render/curl, nie tylko czytanie) i zdecyduj. Jeżeli Twój
   pomiar potwierdzi, że `/ai-actions` jest ogólnie dostępny — to jest cel. Jeżeli
   żaden z dwóch nie pasuje semantycznie do „Akcje biznesowe" (np. oba okazują się
   martwe/puste na realnych danych) — napisz to jako pytanie do właściciela w `R5`
   i **usuń przycisk oraz martwy prop** zamiast wiązać go z przypadkowym ekranem
   (druga opcja z briefu zlecenia).
3. **Dodaj JEDNĄ nową flagę** w `DEFAULT_FLAGS` (`useFeatureFlags.tsx`), np.
   `id: 'chatBusinessActionsNav'`, `defaultValue: false`, `category: 'beta'`,
   `allowLocalOverride: true`. To jest **jawnie zamówiony wyjątek od `Z10`** —
   nie potrzebujesz osobnej zgody, ale flaga MUSI być `false` domyślnie.
4. **Wewnątrz `UnifiedChatPanel.tsx`**, obok istniejącego `onNavigateToActions`,
   dodaj fallback: gdy prop nie jest podany ORAZ flaga jest ON, użyj
   `navigateToRoute(ROUTES.<wybrany>)` (import `ROUTES` z `../../routes/routeConfig`,
   styl relatywny jak reszta importów w tym pliku). Warunek renderu przycisku
   (`{onNavigateToActions && (...)}`) zamień na `{handleNavigateToActions && (...)}`,
   gdzie `handleNavigateToActions = onNavigateToActions ?? (flagOn ? () =>
   navigateToRoute(ROUTES.<wybrany>) : undefined)`. **Gdy flaga OFF (domyślnie) —
   zero zmiany widocznego zachowania na żadnym z 11 montaży: przycisk nadal się
   nie renderuje, dokładnie jak dziś.**
5. **Dowód mutacyjny:** z flagą włączoną lokalnie (`allowLocalOverride`), test
   renderujący realny `UnifiedChatPanel` (patrz `R0` pkt 2 i 4) klika przycisk
   i sprawdza, że `navigateToRoute`/`useNavigate` zostało wywołane z właściwą
   ścieżką. Cofnij fallback (`cp` ze `SCRATCH`) → test czerwony; przywróć →
   zielony; `git diff` po cofnięciu pusty.
6. **Dowód wizualny (rule 7):** dev-render zrzut (harness bez logowania, wzorem
   `dev-render/screens/chat-*.tsx`) pokazujący przycisk widoczny PO włączeniu
   flagi lokalnie — do przyszłego akceptu właściciela. Zrzut idzie do
   `evidence/przewody-chat/`, NIE na demo, NIE z flagą domyślną zmienioną.

**Wymagany dowód:** lista `plik:linia` 11 montaży · uzasadnienie wyboru celu
nawigacji z realną weryfikacją dostępności · diff nowej flagi · diff fallbacku ·
test renderujący realny komponent z klikiem i asercją nawigacji · mutacja w obie
strony · zrzut dev-render. **Commit po `R1`.**

## R2 — K6: KICKOFF ZE STORE'U JAKO FALLBACK NA KAŻDYM MONTAŻU (rdzeń)

1. **KROK 0 — cała rodzina propsów, nie tylko dwa zgłoszone.** Dla KAŻDEGO propa
   z `UnifiedChatPanelProps` (`UnifiedChatPanel.tsx:699-778`) sprawdź, czy warunkuje
   render widocznego elementu przez wzorzec `{prop && (...)}` lub podobny, i czy
   `/chat`/`/chat/:id` go przekazują. Moja lista poza `onNavigateToActions`
   (`R1`) i `kickoffMessage` (ten punkt): **`quickPrompts`** (`:7419`,
   `{quickPrompts && quickPrompts.length > 0 && …}`) i **`contextActions`**
   (`:7399`, `{contextActions && contextActions.length > 0 && …}`) — oba
   niepodawane przez `/chat`. Dla każdego z tych dwóch **zapisz w raporcie**
   werdykt: `CELOWE` (ekran pełnoekranowy nie ma kontekstu modułu, więc brak
   chipów/akcji kontekstowych jest zamierzony) albo `DEFEKT` (z uzasadnieniem).
   **Nie zmieniasz ich kodu** w tym dyżurze, chyba że werdykt `DEFEKT` jest
   trywialny do naprawy identycznym wzorcem co `kickoffMessage` — wtedy STOP
   i pytanie do właściciela w `R5`, nie cichy dopisek.
2. **Napraw `kickoffMessage`/`onKickoffConsumed` jednym uogólnieniem.** Wewnątrz
   `UnifiedChatPanel.tsx`, w efekcie kickoffu (`:5006-5025`), gdy prop
   `kickoffMessage` jest `undefined`, użyj `useAppStore((s) =>
   s.chatKickoffMessage)` jako wartości efektywnej; gdy konsumujesz wiadomość
   I `onKickoffConsumed` NIE jest podany (bo prop `kickoffMessage` też nie był
   podany), wywołaj `useAppStore.getState().clearChatKickoffMessage()`
   bezpośrednio zamiast (lub obok) `onKickoffConsumed?.()`. **To ma zadziałać na
   KAŻDYM z 11 montaży, nie tylko na `/chat`** — sprawdź, że montaż
   `AIConsultantPanel.tsx:334` (który PRZEKAZUJE własny, zawsze-zdefiniowany
   `kickoffMessage` lokalny) NIE zaczyna nagle dodatkowo czytać store'u (bo jego
   prop nigdy nie jest `undefined` — potwierdź to w dowodzie, nie załóż).
3. **Test przez REALNY montaż z propsami `/chat`.** Wydziel (tabela licencji)
   `AiChatRoute`/`AiChatConversationRoute` z `AppRoutes.tsx` ALBO — jeśli refaktor
   okaże się zbyt kosztowny w czasie — udokumentuj to jako STOP częściowy i
   zamiast tego renderuj `UnifiedChatPanel` bezpośrednio z DOKŁADNIE `mode="full"`
   i **żadnym innym propem** (co jest dziś realną, zmierzoną treścią wywołania
   `AppRoutes.tsx:1778`/`:1865` — zapisz w raporcie, że to świadomy kompromis, nie
   przeoczenie). W obu wariantach: nadpisz LOKALNIE mock `useAppStore` (`R0` pkt 4)
   tak, by `chatKickoffMessage` zwracał ustawioną wartość i `getState()` zwracał
   ten sam stan z działającym `clearChatKickoffMessage` (`vi.fn()` śledzący
   wywołanie). Ustaw kickoff, wyrenderuj, i sprawdź że wiadomość **faktycznie
   trafia do wysyłki** (np. przez asercję na wywołaniu zmockowanego `Api` użytego
   przez `handleSendMessage`, lub na obecności wiadomości w DOM) — **nie** przez
   sprawdzenie samego istnienia efektu w kodzie źródłowym.
4. **Dowód mutacyjny.** Cofnij fallback (`cp` ze `SCRATCH`) → test czerwony
   (wiadomość nie trafia); przywróć → zielony; `git diff` po cofnięciu pusty.
5. **Para „przed/po".** „Przed": test dowodzi, że z propsami identycznymi jak na
   `/chat` (tylko `mode="full"`) i kickoffem ustawionym w store, wiadomość
   **ginie** (to jest odtworzenie dzisiejszego defektu — możesz to zrobić jako
   pierwszy test, PRZED naprawą, i zapisać jego czerwony wynik). „Po": ten sam
   test, po naprawie, jest zielony.
6. **Nie psujesz `MainLayout`'owego montażu.** `MainLayout.tsx:505-506` nadal
   przekazuje `kickoffMessage`/`onKickoffConsumed` jawnie — Twój fallback tam
   nigdy się nie aktywuje (prop nie jest `undefined`, nawet gdy jego wartość to
   `undefined` z `chatKickoffMessage || undefined` — sprawdź SAM tę literę:
   `undefined` przekazane jawnie jako wartość propa to wciąż „prop podany" w
   Twoim kodzie, jeśli sprawdzasz `'kickoffMessage' in props`, ale NIE jeśli
   sprawdzasz samą wartość `kickoffMessage === undefined`. **Wybierz sprawdzanie
   po WARTOŚCI** — `MainLayout` i tak czyta z tego samego store'u, więc podwójne
   odczytanie tej samej wartości nie zmienia zachowania, ale musisz to
   udowodnić testem, nie założeniem).

**Wymagany dowód:** tabela werdyktów `CELOWE`/`DEFEKT` dla `quickPrompts` i
`contextActions` · diff uogólnienia fallbacku · test „przed" czerwony na
dzisiejszym kodzie · test „po" zielony · mutacja w obie strony · dowód, że
`AIConsultantPanel`/`MainLayout` nie zmieniły zachowania (dodatkowy test albo
jawny brief z `plik:linia`). **Commit po `R2`.**

## R3 — C D-4: ETYKIETA PANELU ROBOCZEGO ZMIENIA SIĘ ZE STANEM (mały)

1. Dodaj klucz `aiChat.workPanel.close` do OBU słowników: `public/locales/pl/…`
   (`"Zamknij panel roboczy"`, obok istniejącego `"open": "Otwórz panel
   roboczy"`, `:18843-18845`) i `public/locales/en/…` (`"Close work panel"`,
   `:17596-17598`).
2. W `UnifiedChatPanel.tsx:6851-6852` zamień statyczne `title`/`aria-label` na
   warunek po `showWorkPanel` (wzorzec **skopiowany** z sąsiedniego przycisku TTS,
   `:6881-6894`, które już poprawnie przełącza etykietę):
   `showWorkPanel ? t('aiChat.workPanel.close', 'Close work panel') :
   t('aiChat.workPanel.open', 'Open work panel')`.
3. **Test zachowania**, nie tekstu źródła: renderuj realny `UnifiedChatPanel`
   (ten sam montaż co `R2`), kliknij przycisk `data-testid="chat-work-panel-button"`,
   sprawdź `title`/`aria-label` PRZED i PO kliknięciu.
4. **Dowód mutacyjny:** cofnij warunek (`cp` ze `SCRATCH`) → test czerwony
   (etykieta nie zmienia się po kliknięciu); przywróć → zielony.

**Wymagany dowód:** diff dwóch słowników (leaf-count +1 w każdym, zmierzone w
„WARUNKACH WSPÓLNYCH") · diff komponentu · test klik+asercja w obie strony ·
mutacja. **Commit po `R3`.**

## R4 — RODZINA, WARUNKI WSPÓLNE, DOWODY

1. **Przemiar „WARUNKÓW WSPÓLNYCH"** PO wszystkich zmianach: leaf-count PL/EN
   (oczekiwane: `34331+1`/`32342+1`), trzy bezpieczniki kanonu (`0`/`0`/`0`),
   `reachability --check-baseline` — porównaj log PRZED/PO **po nazwach plików**,
   nie po samej liczbie; jeśli dodałeś nowe pliki testowe, zarejestruj je przez
   `--update-baseline` i wklej diff `reachability.baseline.json` do raportu.
2. **Domknij tabelę mianowników** #1-#9 z liczbami PO Twoich zmianach tam, gdzie
   się zmieniły (np. #5 „testy renderujące realny UnifiedChatPanel" powinno
   przejść z `0` na liczbę Twoich nowych testów).
3. **Evidence.** Zapisz do `evidence/przewody-chat/`: listę 11 (lub Twoich)
   montaży `plik:linia`, tabelę werdyktów rodziny propsów z `R2` pkt 1, zrzut
   dev-render z `R1` pkt 6, JSON-y `--reporter=json` Twoich nowych testów (przed
   i po naprawie, per pozycja `R1`/`R2`/`R3`).
4. **Rejestr znalezisk.** Sprawdź `bash -c "grep -nE '^## [A-Z]+\.'
   docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED commitem
   (moja litera przy pisaniu: `AF` → następna `AG`, ale inni autorzy piszą
   równolegle) i dopisz JEDNĄ sekcję zbierającą K2/K6/D-4 jednym akapitem.

**Wymagany dowód:** tabela „przed/po" warunków wspólnych · tabela mianowników
domknięta · pliki w `evidence/przewody-chat/` z realną treścią (nie puste) ·
sekcja w rejestrze znalezisk pod poprawną, świeżo sprawdzoną literą. **Commit
po `R4`.**

## R5 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md`)
zawiera: streszczenie K2/K6/D-4 z dowodem mutacyjnym każdej · listę 11 (lub Twoich)
montaży `<UnifiedChatPanel` z adnotacją które propsy każdy przekazuje · tabelę
werdyktów rodziny (`quickPrompts`/`contextActions` i wszystko, co jeszcze
znalazłeś) · uzasadnienie wyboru celu nawigacji `R1` (lub decyzję o usunięciu
przycisku, jeśli żaden cel nie pasował) · stan flagi `chatBusinessActionsNav`
(nazwa, `defaultValue: false`, gdzie zdefiniowana) · rozbieżności liczb wobec tej
instrukcji (w szczególności `10` vs `11` montaży) · **niepustą sekcję
„TWIERDZENIA NIEZWERYFIKOWANE"**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Musi zawierać co
najmniej: (1) czy `/ai-actions` (`ActionProposalView`) jest właściwym, docelowym
ekranem dla „Akcje biznesowe", czy właściciel widzi inny cel; (2) czy po zrzucie
dev-render właściciel akceptuje włączenie flagi `chatBusinessActionsNav`
domyślnie; (3) werdykt `quickPrompts`/`contextActions` z `R2` pkt 1, jeśli
wypadł `DEFEKT` i wymaga osobnej decyzji o zakresie naprawy.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest
GENEROWANY: `bash -c "grep -rl '<nazwa-pliku>' scripts/"`.

**Commit po `R5`.**

## Próg odbioru

**Trzy defekty domknięte: „Akcje biznesowe" ma żywy cel nawigacji za flagą
domyślnie WYŁĄCZONĄ (zero zmiany widocznego zachowania bez akceptu); kickoff ze
store'u działa jako fallback na KAŻDYM montażu `UnifiedChatPanel`, dowiedzione
testem przez realny komponent z propsami identycznymi jak na `/chat`, z parą
dowodów przed/po i mutacją; etykieta panelu roboczego zmienia się ze stanem, oba
słowniki mają nowy klucz. Rodzina propsów z `KROK 0` jest wypisana w całości
(minimum `quickPrompts`, `contextActions`), każdy z werdyktem.**

Odbiorca odrzuci dyżur, w którym: przycisk „Akcje biznesowe" stał się widoczny
DOMYŚLNIE (bez flagi OFF); nowy test kickoffu mockuje `UnifiedChatPanel` zamiast
go renderować, albo asercja sprawdza tekst źródła zamiast wyniku; fallback
zepsuł montaż `MainLayout`/`AIConsultantPanel` (podwójny kickoff albo cichy
regres); leaf-count słowników spadł albo urósł o więcej niż 2; którakolwiek z
trzech bezpieczników kanonu się zaczerwieniła od tej zmiany; `reachability`
urósł o coś innego niż własne nowe testy autora.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „K2 podpięty za
flagą OFF, K6 naprawiony i udowodniony mutacyjnie, D-4 naprawiony, rodzina
propsów wypisana, `R4`/`R5` niewykonane bo zabrakło czasu" — **jest
pełnowartościowym wynikiem**, jeśli każda zrobiona pozycja ma commit i dowód.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później:
**sprawdzasz warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na
zapamiętanym wyniku.** Wynik ponownego sprawdzenia wklejasz do raportu z datą
i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw K2 (podłącz nawigację)" vs „nie odsłaniaj nowego ekranu bez akceptu" | `R0` (3) i `R1` pkt 3-4: fallback istnieje w kodzie, ale za flagą `default false` — zero zmiany widocznego zachowania bez decyzji właściciela |
| „`tests/setup.ts` jest `Z18`-nietykalny" vs „test musi mieć kickoff w store'ze" | `R0` (4): nadpisanie LOKALNE w pliku testowym, nigdy w `tests/setup.ts` |
| „Dowód ma iść przez trasę `/chat`" vs „renderowanie `MainLayout` nigdy nie było testowane w tym repo" | `R2` pkt 3: preferowana ścieżka to refaktor testowalności `AppRoutes.tsx` (wzorzec `AssessmentOutputReportRoute`); dopuszczalny, jawnie opisany kompromis to render `UnifiedChatPanel` z propsami identycznymi jak `/chat` |
| „Napraw fallback na KAŻDYM montażu" vs „nie zmieniaj zachowania montaży, które już działają" | `R2` pkt 2 i 6: sprawdzanie po WARTOŚCI propa (nie po jego obecności), z dowodem że `AIConsultantPanel`/`MainLayout` się nie zmieniają |
| „Zaktualizuj baseline osiągalności dla nowych testów" vs „bramki są nietykalne" | Tabela licencji: WĄSKA licencja WYŁĄCZNIE przez `--update-baseline`, WYŁĄCZNIE dla własnych plików; cudze 3 pliki zostają jako ZASTANE |
| „`reach` ma kończyć się 0" vs „na markerze już jest 1, z przyczyny obcej" | „WARUNKI WSPÓLNE": próg to „nie pogarsza się o coś INNEGO niż Twoje testy", nie literalne 0 |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy" | `R4` pkt 4: literę sprawdzasz komendą TUŻ PRZED commitem |
| „11 montaży (mój pomiar)" vs „10 (audyt/V1)" | Tabela mianowników #1: Twój pomiar rozstrzyga, rozbieżność idzie do raportu wprost |
| „Napraw rodzinę propsów w całości" vs „zakres dyżuru to K2/K6/D-4" | `R2` pkt 1: pozostałe propy (`quickPrompts`/`contextActions`) dostają WERDYKT, nie automatyczną naprawę — kod zmieniasz tylko dla trzech zgłoszonych pozycji |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 9 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `UnifiedChatPanel.tsx:745,763,798,804-805,3117,5006-5025,6499,6786-6807,6845-6856,7399,7419`, `AppRoutes.tsx:1770-1782,1857-1869,838-857,2155-2165,1804-1808`, `MainLayout.tsx:82-83,102-134,505-506`, `HelpSidePanel.tsx:307-341`, `uiSlice.ts:45-47,176,231-232`, `tests/setup.ts:718-777`, słowniki `:18843-18845`/`:17596-17598` — wszystkie odczytane przez autora na markerze; `evidence/przewody-chat/` jawnie oznaczone jako nieistniejące |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 9 wierszy, wszystkie zmierzone przy wydaniu na markerze (w tym `reach=1` faktycznie uruchomione) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — komponent · trasa (refaktor) · store · Pomoc · MainLayout · flagi · kandydaci nawigacji · słowniki · testy kolokowane · infrastruktura testowa · baseline · bezpieczniki · produkt poza zakresem · raport · rejestr · dowody · macierz/rejestry bramek · cudze tereny · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka `UnifiedChatPanel.tsx`+`useFeatureFlags.tsx`, `R2` dotyka wyłącznie `UnifiedChatPanel.tsx` (+ opcjonalnie wąski refaktor `AppRoutes.tsx`), `R3` dotyka `UnifiedChatPanel.tsx`+2 słowniki |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6439/5579 własne, rodzeństwo 367/369-373 na innych portach (lista w `§0.2`), brak kontenera/gałęzi/worktree `day368` na dziś |
| 7 | Komendy paste-ready | TAK — bloki `§0.3`, „WARUNKI WSPÓLNE" i kontrola rozłączności uruchomione w całości na tym markerze |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — pułapki właściwe: globalny mock `useAppStore` bez pól kickoffu, zero precedensu renderowania realnego `UnifiedChatPanel`, `reachability` już czerwony na markerze z przyczyny obcej, rozbieżność 10 vs 11 montaży, „nowe wizualium" wymaga flagi mimo że kod istniał od dawna |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |

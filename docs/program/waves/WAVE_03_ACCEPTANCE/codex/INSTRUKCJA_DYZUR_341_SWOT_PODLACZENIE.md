# INSTRUKCJA DYŻURU nr 341 — Codex — „★★★ ZBUDOWANE, ALE NIEPODŁĄCZONE — dyżur 306 zbudował dwa brakujące etapy sesji SWOT (5 → 7) i ma na nie zielone testy, ale cały katalog `src/toolPacks/` to 31 plików osiągalnych WYŁĄCZNIE z testów: zero konsumentów w produkcie, więc flaga ON i OFF dają zrzuty identyczne co do bitu. TEN dyżur NIE PISZE FUNKCJI OD NOWA — on dokłada OSTATNI PRZEWÓD: (1) mierzy sam, gdzie sesja SWOT realnie żyje w produkcie (moja teza: `getStepDefinitions()` → `TOOL_STEP_DEFINITIONS` w `src/store/useToolStore.ts`, a NIE `src/method-core/`), (2) sprawdza osiągalność od korzenia dla KAŻDEGO pliku, który zamierza spiąć — podłączenie do martwego konsumenta niczego nie zmienia, (3) ★ rozstrzyga, że powierzchnie są DWIE: lewe drzewo sekcji idzie ze `stepDefs`, a kafle etapów SWOT idą z `computeDynamicSwotPhaseSummaries` (twardy union pięciu id) w siatce `xl:grid-cols-5` — podłączenie tylko jednej z nich to znowu zero zmiany dla użytkownika, (4) ★ rozwiązuje KOLIZJĘ: sekcja o id `review` JUŻ ISTNIEJE w `ToolDocumentView.tsx`, więc nowa faza `review` z paczki wchodzi w duplikat id, (5) dowodzi zrzutami OFF/ON, które NIE SĄ bajtowo identyczne, i liczbą etapów odczytaną z UCHWYTU DOM, nie z obrazka, (6) dowodzi wznawialności sesji na realnej bazie zimnym odczytem. Flaga kończy dyżur DOMYŚLNIE OFF; włączenie wyłącznie po akcepcie właściciela na zrzutach."

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
> **wyłącznie** `/private/tmp/cx-day341-swot-podlaczenie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `74c07919cea7ab55dc9fde5fbd911f7f955ed425`**
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
Zakres: **03_TOOLS — Dynamic SWOT: podłączenie siedmioetapowego kręgosłupa do realnego runtime sesji (R-20 / DEC-2026-09-03-383, kontynuacja dyżuru 306)**.
Trasy front: `/tools (Discovery Tools Hub) → otwarta sesja `dynamic-swot` → `ToolDocumentView`; harness: `?screen=tools-swot-session-workspace&theme=light|dark``. Trasy tył: `GET/PUT `/api/tool-sessions/:id` — odczyt i zapis `answers`/`wizardState` sesji narzędzia; TYLKO ODCZYT kodu trasy, chyba że tabela licencji mówi inaczej`.

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
WT=/private/tmp/cx-day341-swot-podlaczenie
MARKER=74c07919cea7ab55dc9fde5fbd911f7f955ed425

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day341-swot-podlaczenie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day341-swot-podlaczenie/config.worktree"
cat "$VAULT/worktrees/cx-day341-swot-podlaczenie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day341-swot-podlaczenie-scratch
mkdir -p /private/tmp/cx-day341-swot-podlaczenie-artefakty

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
git -C "$VAULT" log --oneline 74c07919cea7ab55dc9fde5fbd911f7f955ed425..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 74c07919cea7ab55dc9fde5fbd911f7f955ed425..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day341-swot-podlaczenie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 74c07919cea7ab55dc9fde5fbd911f7f955ed425..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

cd "$WT"

# (1) TEZA: `src/toolPacks/` ma ZERO wolaczy poza wlasnym katalogiem.
#     ZSH ZJADA `--include` — dlatego wszystko przez `bash -c` w cudzyslowach.
bash -c 'grep -rl "toolPacks" src server --include="*.ts" --include="*.tsx" 2>/dev/null' \
  | grep -v '^src/toolPacks/' | wc -l
#   oczekiwane: 0. Jezeli wynik > 0 — MOJA TEZA JEST OBALONA, przewod czesciowo istnieje;
#   wypisz te pliki, opisz co juz jest podlaczone i DOPIERO potem planuj R3.

# (2) TEZA: caly katalog jest osiagalny WYLACZNIE z testow (31 plikow, 31 test-only).
node scripts/dev/reachability-from-root.mjs \
  > /private/tmp/cx-day341-swot-podlaczenie-artefakty/reach-przed.json
node -e 'const d=require("/private/tmp/cx-day341-swot-podlaczenie-artefakty/reach-przed.json");const t=d.files.filter(f=>f.file.startsWith("src/toolPacks/"));const b={};for(const f of t)b[f.classification]=(b[f.classification]||0)+1;console.log(t.length,JSON.stringify(b));console.log(JSON.stringify(d.totals));'
#   oczekiwane: `31 {"test-only":31}` oraz totals app 3044 / harness-only 30 / test-only 1017 / unreachable 719

# (3) TEZA: realny szew runtime to `TOOL_STEP_DEFINITIONS` w store, a NIE `src/method-core/`.
bash -c 'grep -n "export const SWOT_STEPS\|export const TOOL_STEP_DEFINITIONS\|getStepDefinitions:" src/store/useToolStore.ts'
bash -c 'grep -rn "getStepDefinitions" src --include="*.tsx" | head'
#   oczekiwane: SWOT_STEPS:1363, TOOL_STEP_DEFINITIONS:2742, getStepDefinitions:5075;
#   konsument w `src/components/DiscoveryTools/ToolDocumentView.tsx:312`
#   (`const stepDefs = getStepDefinitions()`).

# (4) TEZA (★ najwazniejsza): POWIERZCHNIE SA DWIE i tylko jedna idzie ze `stepDefs`.
bash -c 'grep -n "dynamicSwotPhaseSummaries\|xl:grid-cols-5\|stepDefs.map" src/components/DiscoveryTools/ToolDocumentView.tsx'
sed -n '13,22p' src/components/DiscoveryTools/toolCompletion.ts
#   oczekiwane: kafle etapow SWOT rysuja sie z `dynamicSwotPhaseSummaries` (linia ~1183)
#   w siatce `xl:grid-cols-5` (linia ~1181), a lewe drzewo sekcji ze `stepDefs` (linia ~1868).
#   `DynamicSwotPhaseSummary.id` w `toolCompletion.ts:15` to TWARDY union pieciu id.
#   ★ Podlaczenie tylko jednej z tych powierzchni = znowu zero zmiany dla uzytkownika.

# (5) TEZA (★ kolizja): id `review` JUZ ISTNIEJE jako sekcja statyczna.
bash -c 'grep -n "id: .review." src/components/DiscoveryTools/ToolDocumentView.tsx'
sed -n '1683,1706p' src/components/DiscoveryTools/ToolDocumentView.tsx
#   oczekiwane: `id: 'review'` w linii ~1908 (sekcja statyczna) oraz `staticGroupIndexById.review = 1`
#   i `cSpanById.review = 2`; `phaseGroupIndex()` NIE zna ani `recommendations`, ani `review`
#   (obie wpadaja w `return 0`, czyli do zlej grupy). To sa DWA konkretne braki przewodu.

# (6) TEZA: paczka i flaga sa gotowe, fail-closed, i maja jedna uspiona kruchosc.
bash -c 'grep -n "getDynamicSwotPackForCurrentFlags\|slice(0, outputsIndex)\|WAVE_2_PHASES" src/toolPacks/packs/dynamicSwot.pack.ts'
cat src/utils/dynamicSwotSevenStagesFlag.ts
#   oczekiwane: przelacznik w linii ~337; sklejanie przez `slice(0, outputsIndex)` GUBI po cichu
#   kazda faze wystepujaca PO `outputs`; flaga czyta wylacznie liste dozwolonych ('1','true','on').

# (7) TEZA: harness montuje REALNY hub, nie atrape, a ekran jest w macierzy.
bash -c 'grep -n "DiscoveryToolsHub" dev-render/screens/tools-swot-session-workspace.tsx'
bash -c 'grep -c "tools-swot-session-workspace" scripts/dev/g06-macierz-ekrany.json'
#   oczekiwane: import i montaz `DiscoveryToolsHub`; 1 trafienie w macierzy (grupa 03_TOOLS).

# (8) TEZA: porty, kontenery i dysk wolne; liscie i18n na starcie.
lsof -nP -iTCP:6377 -sTCP:LISTEN
lsof -nP -iTCP:5517 -sTCP:LISTEN
docker ps --format '{{.Names}}'
df -h /
node -e 'const fs=require("fs");const f=o=>{let n=0;for(const k in o){const v=o[k];n+=(v&&typeof v==="object")?f(v):1}return n};for(const l of ["pl","en"])console.log(l,f(JSON.parse(fs.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
#   oczekiwane: puste `lsof`, brak kontenera `cx-day341-pg`, powyzej 3 GB wolnego,
#   `pl 35198` i `en 33065`.

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day341-swot-podlaczenie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6377`. Twój JEDYNY port harnessu to `5517`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day341-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5458 oraz 6311-6322 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-340 (bazy 6290-6376, harness 5250-5516); ten przedział jest ZAREZERWOWANY w całości, nawet jeżeli akurat nic w nim nie stoi. Dyżury równoległe tej serii: 341 (baza 6377, harness 5517, kontener cx-day341-pg), 342 (baza 6378, harness 5518, kontener cx-day342-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `R3 — wyłącznie ISTNIEJĄCA flaga `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` (`src/utils/dynamicSwotSevenStagesFlag.ts`, zbudowana przez dyżur 306, domyślnie OFF). NIE tworzysz nowej flagi i NIE zmieniasz jej wartości domyślnej — dyżur kończy się z flagą OFF`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-artefakt.sh`, `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh` (hooki — uruchamiasz, NIE edytujesz) · `scripts/dev/grafika-zrzuty.mjs` (kanoniczny harness zrzutów — wolno dołożyć WYŁĄCZNIE opcję opt-in, nigdy zmienić zachowanie domyślne) · `scripts/dev/g06-macierz-ekrany.json` (★ ZAKAZ usuwania jakiegokolwiek ekranu) · `scripts/dev/reachability-from-root.mjs` oraz `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (uruchamiasz `--check-baseline`, NIE aktualizujesz bazy odniesienia) · `server/scripts/migrate.postgres.ts` · `server/migrations/000_z_core_baseline.sql` i `000_initdb_*.sql` · `tests/unit/backend/security/**` · `.github/workflows/**` · `public/locales/pl/translation.json` i `public/locales/en/translation.json` (wolno WYŁĄCZNIE dopisywać klucze; liczba liści nie może zmaleć)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY341_SWOT_PODLACZENIE_REPORT.md`. Dozwolona AKTUALIZACJA (dopisanie wiersza, nigdy skasowanie) dokładnie jednego istniejącego dokumentu: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` (§R.1), wyłącznie w wierszu dotyczącym siedmioetapowej sesji SWOT.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day341-swot-podlaczenie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day341-swot-podlaczenie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ PISANIA FUNKCJI OD NOWA.** Dwa etapy (`recommendations`, `review`), ich bramy (`swot-recommendations-direction`, `swot-review-decision`) i flaga JUŻ ISTNIEJĄ — zbudował je dyżur 306. Twoim produktem jest PRZEWÓD, nie druga implementacja. Jeżeli zaczynasz pisać nowy deskryptor faz, nową flagę albo drugi rejestr etapów — instrukcja jest zła i masz STOP-pytanie, nie licencję. **ZAKAZ ruszania pozostałych 18 paczek** w `src/toolPacks/packs/`. **ZAKAZ zmiany wartości domyślnej flagi `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES`** — dyżur kończy się z OFF. **ZAKAZ tworzenia nowej flagi.** **ZAKAZ własnego skryptu zrzutów obok `scripts/dev/grafika-zrzuty.mjs`** — brakującą funkcję dokładasz TEMU narzędziu jako opcję opt-in, z parametrami zapisanymi na trwałe. **ZAKAZ usuwania ekranu z `scripts/dev/g06-macierz-ekrany.json`** na podstawie pomiaru, którego drugi pomiar nie potwierdza. **ZAKAZ liczenia etapów ze zrzutu** — liczysz z uchwytu DOM. **ZAKAZ meldowania „podłączone” na podstawie grepa wołacza** — grep dowodzi drugiej warstwy z czterech. **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`, `git fetch --all`.** **ZAKAZ dotykania demo, stagingu i produkcji.** **ZAKAZ zmian w `src/method-core/**`** — pomiar 04.09 mówi, że runtime SWOT tam nie mieszka; jeżeli Twój pomiar mówi inaczej, to jest korekta do raportu, a nie licencja na edycję. | Dyżur 306 zrobił robotę uczciwie i sam oznaczył ją jako CZĘŚCIOWĄ, a odbiór adwersaryjny 04.09 zmierzył, że jej efekt dla użytkownika wynosi ZERO: zrzuty z flagą ON i OFF są identyczne co do bitu, bo `src/toolPacks/` nie ma ani jednego konsumenta poza własnymi testami. To jest jedenasty kształt fałszywego „gotowe” — biblioteka bez wywołania. Program ma już zapisane, że warstw jest CZTERY (komponent istnieje ≠ jest importowany ≠ jest renderowany ≠ dociera do użytkownika) i że grep wołacza dowodzi drugiej. Bez tego dyżuru rejestr będzie niósł „siedem etapów zbudowane”, a właściciel dalej zobaczy pięć. |

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
cd /private/tmp/cx-day341-swot-podlaczenie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day341-pg psql -U postgres -d cx341 \
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
cd /private/tmp/cx-day341-swot-podlaczenie

docker run -d --name cx-day341-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx341 \
  -p 127.0.0.1:6377:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day341-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6377/cx341 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6377/cx341 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day341-swot-podlaczenie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6377/cx341 \
JWT_SECRET=cx341-jwt-secret-do-testow \
npx vitest run src/toolPacks/__tests__ src/store/__tests__/swotStepLocale.test.ts src/components/DiscoveryTools/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day341-swot-podlaczenie-artefakty/day341-testy.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day341-swot-podlaczenie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/toolPacks/__tests__ src/store/__tests__/swotStepLocale.test.ts src/components/DiscoveryTools/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day341-swot-podlaczenie-artefakty/day341-testy.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day341-swot-podlaczenie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day341-pg psql -U postgres -d cx341 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day341-pg`.
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
> **(e) **(e) ATRAPA BAZY POD `DbPromise` ORAZ PUSTY POMIAR.** `NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę bazy — `pg.Pool` widzi wiersz, a kod produkcyjny nie; do tego atrapa zwraca `changes: 1` dla KAŻDEGO `UPDATE` niezależnie od `WHERE`, więc dowód wznawialności sesji SWOT jest ważny WYŁĄCZNIE na realnym Postgresie z `§0.2c`. Osobno: `npx vitest run` na nieistniejącej ścieżce wypisuje `No test files found` i kończy się kodem 0 — to jest BŁĄD KOMENDY, nie PASS; `Transform failed` również. Akapit dowodowy dla każdego pakietu musi podać, która z pułapek (a)–(e) go dotyczy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day341-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day341-swot-podlaczenie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R2, R3, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6377` albo `5517` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6377` albo `5517`** (`Z7`).

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

Dyżur 306 zbudował dwa brakujące etapy sesji Dynamic SWOT — `recommendations` i `review` —
z bramą decyzyjną dla każdego, z flagą fail-closed i z zielonymi testami. Zrobił to uczciwie
i sam oznaczył wynik jako CZĘŚCIOWY.

Odbiór adwersaryjny 04.09 zmierzył, ile z tego dociera do użytkownika: **zero**. Zrzuty ekranu
warsztatu sesji z flagą ON i z flagą OFF były **identyczne co do bitu** w obu motywach, bo cały
katalog `src/toolPacks/` nie ma ani jednego konsumenta poza własnymi testami. Właściwa rzecz
jest w kodzie. Brakuje **ostatniego przewodu**.

Ten dyżur jest dyżurem od przewodu. **Nie od pisania funkcji.** Jeżeli w połowie pracy piszesz
nowy deskryptor faz, drugą flagę albo drugi rejestr etapów — to znaczy, że ta instrukcja jest
zła, i masz STOP-pytanie do właściciela, a nie licencję na drugą implementację.

## ★ Cztery warstwy — i której dowodzi grep

Program ma to zapisane jako osobny kształt fałszywego „gotowe”. Warstw jest **cztery**:

1. komponent/deskryptor **istnieje** w repo,
2. jest **importowany** przez coś innego,
3. jest **renderowany** na realnym ekranie,
4. **dociera do użytkownika** — widać go i zmienia jego przebieg pracy.

`grep` wołacza dowodzi **warstwy 2**. Zielony test jednostkowy paczki dowodzi **warstwy 1**.
Dyżur 306 ma obie i nie ma trzeciej ani czwartej. **Twoim dowodem końcowym jest warstwa 4**:
para zrzutów OFF/ON, która **nie jest bajtowo identyczna**, plus liczba etapów odczytana
z uchwytu DOM.

## ★ Zmierz moje liczby sam

Twierdzę: `src/toolPacks/` to 31 plików, wszystkie 31 sklasyfikowane jako `test-only` przez
`scripts/dev/reachability-from-root.mjs`; wołaczy poza własnym katalogiem jest **0**; realny
runtime sesji to `SWOT_STEPS` (`src/store/useToolStore.ts:1363`) → `TOOL_STEP_DEFINITIONS`
(:2742) → `getStepDefinitions()` (:5075) → `stepDefs` (`ToolDocumentView.tsx:312`); powierzchnie
prezentujące etapy są **dwie**, nie jedna; id `review` już zajęte przez sekcję statyczną
(`ToolDocumentView.tsx:1908`); liście i18n to `pl 35198` / `en 33065`.

**Jeżeli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.** Obalenie mojej tezy jest sukcesem dyżuru, nie porażką.

## ★ Właściciel nigdy nie jest pierwszym testerem wizualnym

Zasada nienaruszalna (`CLAUDE.md` §7). Zanim właściciel zobaczy JAKIKOLWIEK ekran: renderujesz
go sam w harnessie, robisz zrzut sam, oglądasz go sam (`Read`), i dopiero taki zrzut idzie do
akceptu. Zrzut ma być czysty — zero ozdób, tokeny `c-*`, zgodny z tym, co realnie robi produkt.
**Zakaz „włącz flagę i zobacz” jako pierwszego sprawdzenia.** Wygląd zostaje za flagą domyślnie
OFF do momentu akceptu.

---

# TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

Licencja obejmuje **całą ścieżkę**: deskryptor · flaga · szew store · powłoka · powierzchnia
prezentacji · harness · test. Pominięcie jednego ogniwa zmusza wykonawcę albo do złamania
licencji, albo do zrobienia połowy roboty — i jedno, i drugie jest błędem autora instrukcji.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/scripts/migrate.postgres.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Produktem pozycji staje się **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 341 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`. Do tego **brief w raporcie**: plik:linia · dlaczego nie da się w module · promień rażenia (ile montaży, ile modułów) · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| `src/components/Discovery/DiscoveryToolsHub.tsx` | **TYLKO ODCZYT** — plik przekrojowy dla wszystkich 31 narzędzi | jak wyżej |
| **DESKRYPTOR** · `src/toolPacks/packs/dynamicSwot.pack.ts` | **★ PEŁNA LICENCJA** w zakresie `R3`, `R4` — wyłącznie tyle, ile potrzeba do podłączenia (m.in. domknięcie kruchości `slice(0, outputsIndex)`) | — |
| **DESKRYPTOR** · `src/toolPacks/registry.ts`, `src/toolPacks/contract.ts`, `src/toolPacks/runtimeReadiness.ts` | **★ WĄSKA LICENCJA:** wyłącznie wystawienie/oczyszczenie punktu wejścia dla konsumenta w zakresie `R3`. Zakaz zmiany kształtu kontraktu paczek i zakaz dopisywania nowych paczek | Czerwony kontrakt + brief |
| **FLAGA** · `src/utils/dynamicSwotSevenStagesFlag.ts` | **★ WĄSKA LICENCJA:** wyłącznie odczyt i ewentualne udostępnienie tej samej flagi warstwie store w zakresie `R3`. **Zakaz zmiany wartości domyślnej** i zakaz rozszerzenia listy dozwolonych wartości | Czerwony kontrakt + brief |
| **SZEW STORE** · `src/store/useToolStore.ts` | **★ WĄSKA LICENCJA:** wyłącznie `getStepDefinitions()` oraz rozstrzygnięcie źródła `TOOL_STEP_DEFINITIONS['dynamic-swot']` w zakresie `R3`. **Zakaz zmiany definicji kroków pozostałych 30 narzędzi**, zakaz zmiany kształtu `StepDefinition`, zakaz ruszania hydratacji sesji poza tym, czego wymaga `R4` | Czerwony kontrakt + brief |
| **POWIERZCHNIA 1 (drzewo sekcji)** · `src/components/DiscoveryTools/ToolDocumentView.tsx` | **★ WĄSKA LICENCJA:** wyłącznie (a) `phaseGroupIndex()` — rozpoznanie `recommendations` i `review`, (b) rozwiązanie kolizji id `review` z sekcją statyczną (linia ~1908), (c) `renderPhaseCanvas()` dla nowych faz, (d) dołożenie **uchwytu DOM** do liczenia etapów, w zakresie `R3`/`R5`. **Zakaz zmiany wyglądu istniejących pięciu etapów przy fladze OFF** | Czerwony kontrakt + brief |
| **POWIERZCHNIA 2 (kafle etapów)** · `src/components/DiscoveryTools/toolCompletion.ts` | **★ WĄSKA LICENCJA:** wyłącznie rozszerzenie unionu `DynamicSwotPhaseSummary['id']` i listy `summaries` o dwa nowe etapy, sterowane TĄ SAMĄ flagą, w zakresie `R3`. Zakaz zmiany kryteriów gotowości istniejących pięciu etapów | Czerwony kontrakt + brief |
| `src/toolPacks/__tests__/**`, `src/store/__tests__/**`, `src/components/DiscoveryTools/__tests__/**` (NOWE pliki i rozszerzenia) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | — |
| `tests/e2e/tools/swot-real-pg-resume.spec.ts` | **★ WĄSKA LICENCJA:** wyłącznie rozszerzenie o przypadek siedmiu etapów i wznawiania, w zakresie `R4`. Zakaz kasowania istniejących przypadków | Czerwony kontrakt + brief |
| `dev-render/screens/tools-swot-session-workspace.tsx`, `dev-render/main.tsx` | **★ WĄSKA LICENCJA:** wyłącznie tyle, ile potrzeba, żeby harness pokazał REALNY przebieg z flagą ON i OFF, w zakresie `R5`. **Zakaz podmiany realnego `DiscoveryToolsHub` na atrapę** — to była właśnie naprawiana usterka tego harnessu | Brief w raporcie |
| `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA:** wyłącznie **dołożenie opcji opt-in** (np. przekazanie zmiennej środowiskowej do procesu harnessu), z wartością domyślną zachowującą dzisiejsze zachowanie co do bitu. **Zakaz pisania własnego skryptu zrzutów obok** | Brief w raporcie |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. Zakaz zmiany istniejących wartości | — |
| `server/migrations/20261270_day341_*.sql` | **★ PEŁNA LICENCJA** w przedziale **`20261270`–`20261279`**, wyłącznie addytywne. **Domyślnie ten dyżur migracji NIE dodaje** — dodajesz tylko wtedy, gdy `R4` udowodni, że wznawianie siedmiu etapów wymaga kolumny, której nie ma | — |
| `scripts/dev/g06-macierz-ekrany.json` | **TYLKO ODCZYT** | Ekranu nie usuwa się z macierzy na podstawie pomiaru, którego drugi pomiar nie potwierdza. Rozbieżność → wpis w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **TYLKO ODCZYT** | Uruchamiasz `--check-baseline`; jeżeli czerwienieje, to jest wynik pomiaru do raportu, nie powód do aktualizacji bazy odniesienia |
| `src/toolPacks/packs/*.pack.ts` **poza** `dynamicSwot.pack.ts` (18 plików) | **TYLKO ODCZYT — teren przyszłej decyzji właściciela** | Wpis do raportu: co byłoby potrzebne, ile plików, ile linii — liczbą, nie przymiotnikiem |
| `src/method-core/**` | **TYLKO ODCZYT** | Jeżeli Twój pomiar pokaże, że runtime SWOT jednak tam mieszka — to jest KOREKTA WOBEC INSTRUKCJI z dowodem `plik:linia`, i wtedy STOP-pytanie o zmianę licencji, nie samodzielna edycja |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Produktem jest **opis w raporcie**: co w konfiguracji blokuje pomiar, jaka byłaby zmiana i **jak obszedłeś to zmiennymi w linii komendy**. Pozycja jest zrobiona z takim opisem |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` | `§R.1`, z zastrzeżeniem `Z32` | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY341_SWOT_PODLACZENIE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem `plik:linia` i idziesz dalej |

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief wg wiersza 1, **nie zatrzymanie dyżuru**.

---

# POZYCJE R1–R6

## R1 — POMIAR: GDZIE SESJA SWOT REALNIE ŻYJE (rdzeń pomiarowy)

Nie zaczynasz od kodu. Zaczynasz od odpowiedzi na jedno pytanie: **do czego właściwie
podłączasz?**

Wymagane produkty:

1. **Tabela osiągalności** dla każdego pliku, który zamierzasz spiąć — z kolumną
   `plik · klasyfikacja przed · klasyfikacja po (przewidywana) · czy konsument jest żywy`.
   Źródło: `node scripts/dev/reachability-from-root.mjs`. ★ Podłączenie do konsumenta
   sklasyfikowanego jako `unreachable`, `test-only` albo `harness-only` **niczego nie zmienia** —
   dziś usunęliśmy całe martwe poddrzewo czatu dokładnie dlatego, że „importowane” nie znaczy
   „renderowane”.
2. **Łańcuch od korzenia do etapu**, wypisany `plik:linia` po `plik:linia`, od `src/index.tsx`
   do miejsca, w którym powstaje lista etapów widziana przez użytkownika. Moja teza:
   `src/index.tsx` → routing → `DiscoveryToolsHub` → `ToolDocumentView:312` `getStepDefinitions()`
   → `useToolStore:5075` → `TOOL_STEP_DEFINITIONS:2742` → `SWOT_STEPS:1363`.
3. **Tabela DWÓCH POWIERZCHNI.** Dla każdej: co ją zasila, w której linii, i co się stanie,
   gdy podłączysz tylko drugą. Moja teza: lewe drzewo sekcji zasila `stepDefs`
   (`ToolDocumentView` ~1868), kafle etapów zasila `computeDynamicSwotPhaseSummaries`
   (`toolCompletion.ts:82`, twardy union pięciu id z linii 15) w siatce `xl:grid-cols-5`
   (~1181), a licznik `krok X/Y` idzie ze `stepDefs.length` (~1300, ~1832).
4. **Lista kolizji i braków przewodu**, imiennie. Znane mi trzy: (a) id `review` zajęte przez
   sekcję statyczną (~1908), (b) `phaseGroupIndex()` nie zna `recommendations` ani `review`
   i wrzuca je do grupy 0, (c) `getDynamicSwotPackForCurrentFlags()` skleja fazy przez
   `slice(0, outputsIndex)` i **po cichu gubi** każdą fazę występującą po `outputs`.
   Jeżeli znajdziesz czwartą — dopisz.

Commit po `R1`.

## R2 — ROZSTRZYGNIĘCIE SZWU (rdzeń)

Jedno zdanie, poparte pomiarem: **w którym dokładnie miejscu paczka wchodzi do runtime.**
Możliwości, między którymi rozstrzygasz:

- (A) `getStepDefinitions()` konsultuje paczkę, gdy flaga ON — jeden szew, całe drzewo i licznik
  jadą za nim;
- (B) `TOOL_STEP_DEFINITIONS['dynamic-swot']` powstaje z paczki — szew wcześniejszy, ale dotyka
  stałej modułowej i wchodzi w ryzyko kolejności inicjalizacji;
- (C) coś, czego nie przewidziałem — wtedy opisujesz to i uzasadniasz pomiarem.

Rozstrzygnięcie ma podać: **co się dzieje przy fladze OFF** (musi być identyczna referencja
obiektu, jak dziś dowodzi test 306), **co przy ON**, i **czy pozostałe 30 narzędzi są nietknięte**
— to ostatnie udowadniasz testem, nie zapewnieniem.

Osobno rozstrzygasz **kolizję id `review`**. Dopuszczalne są dwa wyjścia i wybierasz jedno,
z uzasadnieniem: zmiana id nowej fazy w paczce, albo zmiana id sekcji statycznej. **Nie
dopuszczam trzeciego wyjścia „obie zostają”** — duplikat id w jednej liście sekcji to defekt,
także wtedy, gdy React akurat go wybaczy.

Commit po `R2`.

## R3 — PRZEWÓD (rdzeń)

Podłączenie, zgodnie z rozstrzygnięciem z `R2`, **na obu powierzchniach naraz**. Zakres minimalny:

- szew store (wg `R2`),
- rozszerzenie źródła kafli (`toolCompletion.ts`) o dwa etapy, sterowane **tą samą** flagą,
- `phaseGroupIndex()` rozpoznaje `recommendations` i `review`,
- siatka kafli przestaje być twardo pięciokolumnowa,
- `renderPhaseCanvas()` dla nowych faz — albo realna zawartość, albo **uczciwy stan pusty**
  z komunikatem; ★ pusty ekran bez komunikatu jest regresem, nie etapem,
- **uchwyt DOM** do mechanicznego liczenia etapów: stabilny atrybut na każdym kaflu/pozycji
  drzewa (np. `data-testid` + `data-phase-id`), żeby liczba etapów była **odczytywalna
  programem, nie okiem**,
- napisy nowych etapów: dziś żyją inline w paczce, poza `public/locales`. Rozstrzygasz to i albo
  dopisujesz klucze z parytetem PL+EN, albo zapisujesz w raporcie, dlaczego zostają inline i co
  z tego wynika dla bramek i18n. **Liczba liści `pl` i `en` nie może zmaleć.**

Testy jednostkowe: OFF zwraca dokładnie dzisiejszy kształt; ON daje siedem etapów w kolejności
`mission · input · swot · insights · recommendations · outputs · review`; pozostałe 30 narzędzi
mają niezmienione definicje kroków.

**Dowód mutacyjny — celuje w ZABEZPIECZENIE, nie w mechanizm.** Usuń jeden etap z paczki
(przez `cp` do katalogu odkładczego, **nigdy `git stash`**) → test ma **zaczerwienić się
dokładnie na asercji liczby/kolejności etapów**, a nie „gdzieś”. Cofnij przez `cp`, pokaż
`git status` czysty. Drugi dowód mutacyjny: zamień wartość domyślną flagi na `true` → mają paść
dokładnie te testy, które bronią OFF.

Commit po `R3`.

## R4 — DOWÓD NA REALNEJ BAZIE: SIEDEM ETAPÓW I WZNAWIALNOŚĆ (rdzeń)

Sesja przechodzi siedem etapów i **jest wznawialna po ponownym wejściu**. Siedem etapów,
których nie da się wznowić, to regres wobec pięciu.

- Realny Postgres z `§0.2c` (kontener `cx-day341-pg`, baza `cx341`, port `6377`), pełny łańcuch
  migracji strict od zera + drugi przebieg dla idempotencji.
- Zapis stanu sesji na etapie 6 lub 7, **odczyt na zimno osobnym klientem**. Atrapa bazy melduje
  sukces każdego zapisu niezależnie od warunku — dlatego dowód jest ważny wyłącznie na realnej
  bazie i wyłącznie z `RUN_DB_TESTS=1`.
- Osobno: **sesja zapisana przy fladze ON, otwarta przy fladze OFF, nie może wywrócić widoku
  ani zgubić danych.** To jest realny scenariusz wycofania i musi być przetestowany, bo flaga
  ma zostać wyłączona po dyżurze.
- Wzorzec: `tests/e2e/tools/swot-real-pg-resume.spec.ts`.

Commit po `R4`.

## R5 — KADRY, KTÓRE POKAŻĄ RÓŻNICĘ (rdzeń dowodowy)

Kanoniczny `scripts/dev/grafika-zrzuty.mjs`, ekran `tools-swot-session-workspace`, port `5517`.
Cztery kadry: light i dark × flaga OFF i ON, wszystkie PL; jeżeli budżet czasu pozwoli, dołóż
parę EN.

Wymagane wprost:

- **para OFF/ON NIE MOŻE być bajtowo identyczna** — podajesz `shasum -a 256` każdego pliku;
  identyczne sumy oznaczają, że przewód nie działa, i to jest wynik negatywny do zapisania,
  a nie do przemilczenia;
- **para light/dark też nie może być tym samym obrazem pod dwiema nazwami** — podajesz średnią
  jasność każdego kadru; para, w której obie mają `mean_luma > 150`, jest podejrzana;
- **liczba etapów liczona z uchwytu DOM**, nie ze zrzutu, i podana obok każdego kadru;
- sekcje **rozwinięte** (`--rozwin-sekcje=1`) — zwinięta sekcja nie jest dowodem; jednocześnie
  sprawdź, czy rozwijanie nie zamyka podglądu i czy skan nie leci w trakcie animacji;
- **każdy kadr obejrzany przez `Read`** i opisany z nazwy: co widać, ile etapów, jak nazwane;
- lista czekowania część B w zakresie dotyczącym powłoki sesji, literalnie, z „n/d + powód”.

Bramki wizualne: `bash scripts/check-artefakt.sh`, `bash scripts/check-list-canon.sh`,
`bash scripts/check-focus-canon.sh --ci` — wszystkie zielone, liczby porównane z bazą odniesienia.
★ Uwaga: kafle etapów używają dziś `border-primary-300` / `bg-primary-500/10` /
`text-primary-700`, a `primary-*` **każdy numer** to crimson `#85182F`. To jest stan zastany
i **nie masz go naprawiać w tym dyżurze** — masz go **nie powiększyć**. Jeżeli Twoja zmiana
dokłada choćby jedno nowe `primary-*`, to jest naruszenie; nowe stany aktywne rób neutralnie,
fokus przez `c-focus`.

Commit po `R5`.

## R6 — RAPORT

Struktura z `§R.2`, a ponadto obowiązkowo:

- **tabela czterech warstw** dla stanu PO dyżurze: co dowodzi warstwy 1, 2, 3 i 4, z komendą;
- **tabela osiągalności przed/po** z liczbami z `reachability-from-root.mjs` (moja liczba
  wejściowa: 31 plików `src/toolPacks/`, wszystkie `test-only`) plus wynik `--check-baseline`;
- **koszt rozwiezienia na pozostałe 18 paczek** — liczbą (ile plików, ile linii, ile powierzchni),
  nie przymiotnikiem; ★ tego **nie robisz**, tylko wyceniasz;
- **rozstrzygnięcie kolizji `review`** z uzasadnieniem;
- **rozstrzygnięcie napisów** nowych etapów wobec `public/locales`;
- sekcja **KOREKTY WOBEC INSTRUKCJI** — każda moja liczba, której Twój pomiar nie potwierdził;
- sekcja **TWIERDZENIA NIEZWERYFIKOWANE**, niepusta;
- zdanie wprost, czy flaga kończy dyżur **OFF** (ma kończyć) i co dokładnie właściciel ma
  zobaczyć na zrzutach, żeby móc powiedzieć „włączamy”.

---

# TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione (min. testów) | Definicja ukończenia — co dokładnie musi być prawdą | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R1` | pomiar: gdzie sesja SWOT realnie żyje, dwie powierzchnie, lista kolizji | TAK (pomiarowy) | NIE — dowód: `git diff --name-only` po `R1` pokazuje wyłącznie raport | bazowe | Łańcuch od `src/index.tsx` do listy etapów wypisany `plik:linia`; tabela osiągalności; tabela dwóch powierzchni; lista kolizji | `node scripts/dev/reachability-from-root.mjs` + grepy z `§0.3` | `docs(day341): pomiar szwu i dwoch powierzchni (R1)` |
| `R2` | rozstrzygnięcie szwu i kolizji id `review` | TAK | NIE — dowód: zmiana mieści się w plikach z licencją WĄSKĄ | bazowe | Jedno zdanie „szew jest tutaj”, poparte pomiarem; kolizja `review` rozstrzygnięta jednym z dwóch wyjść, z uzasadnieniem | `bash -c "grep -n 'id: .review.' src/components/DiscoveryTools/ToolDocumentView.tsx"` | `docs(day341): rozstrzygniecie szwu i kolizji review (R2)` |
| `R3` | przewód: paczka dociera do OBU powierzchni za istniejącą flagą | **TAK — rdzeń** | NIE — dowód: `git diff --name-only` zawiera wyłącznie pliki z tabeli licencji | **+6** (OFF identyczny kształt; ON siedem etapów; kolejność; 30 narzędzi nietkniętych; grupa nowych faz; uchwyt DOM) | Przy ON siedem etapów na obu powierzchniach; przy OFF kształt identyczny z dzisiejszym; dwa dowody mutacyjne celujące w zabezpieczenie; liście i18n nie maleją | `npx vitest run src/toolPacks/__tests__ src/store/__tests__/swotStepLocale.test.ts src/components/DiscoveryTools/__tests__ --retry=0` | `feat(day341): podlaczenie siedmiu etapow SWOT za flaga OFF (R3)` |
| `R4` | siedem etapów przechodzi i wznawia się na realnej bazie | **TAK — rdzeń** | NIE — dowód: test e2e nie zmienia plików przekrojowych | **+2** (przejście 7 etapów; wznowienie po zimnym odczycie) | Sesja przechodzi 7 etapów, jest wznawialna, a sesja zapisana przy ON otwiera się przy OFF bez utraty danych; łańcuch migracji strict od zera + idempotencja | `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6377/cx341 RUN_DB_TESTS=1 npx playwright test tests/e2e/tools/swot-real-pg-resume.spec.ts` | `test(day341): siedem etapow i wznawialnosc na realnej bazie (R4)` |
| `R5` | kadry OFF/ON, które POKAZUJĄ różnicę | **TAK — rdzeń dowodowy** | NIE — dowód: harness i skrypt zrzutów mają WĄSKĄ licencję | bazowe + 3 bramki wizualne | 4 kadry, `shasum` pary OFF/ON **różne**, `mean_luma` pary light/dark **różne**, liczba etapów z uchwytu DOM, każdy kadr obejrzany przez `Read`, trzy bramki zielone | `node scripts/dev/grafika-zrzuty.mjs …` + `shasum -a 256` + `bash scripts/check-artefakt.sh` | `test(day341): kadry OFF/ON z uchwytem DOM (R5)` |
| `R6` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta, sekcja „KOREKTY WOBEC INSTRUKCJI" wypełniona | — | `docs(day341): raport dyzuru (R6)` |
| `§R.1` | podniesienie `MODULE_ACCEPTANCE.md` do stanu faktycznego | NIE | NIE | n/d | Wiersz siedmioetapowej sesji SWOT w `03_TOOLS/MODULE_ACCEPTANCE.md` opisuje stan PO dyżurze, z jawnym „za flagą OFF” | — | `docs(day341): MODULE_ACCEPTANCE 03_TOOLS (R.1)` |

> **Kolumna „Wymaga plików przekrojowych?" musi być wypełniona dla KAŻDEJ
> pozycji, z dowodem przy odpowiedzi `NIE`.** Jeżeli którakolwiek pozycja
> odpowiada `TAK`, autor instrukcji ma obowiązek albo przenieść ją do innego
> dyżuru, albo z góry opisać produkt zastępczy (czerwony kontrakt + brief).
> **Wykonawca nie może odkryć niewykonalności pozycji w jej połowie.**

**★ Commit po KAŻDEJ pozycji R** i `git push github-backup codex/day341-swot-podlaczenie-20260904`
po każdym commicie (`Z34a`). Pozycja bez commitu jest pozycją niewykonaną, choćby kod leżał
w katalogu roboczym.

---

# TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda, którą ją policzyłem (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pliki `src`/`server` wołające `toolPacks` spoza własnego katalogu | `0` | `bash -c 'grep -rl "toolPacks" src server --include="*.ts" --include="*.tsx"' \| grep -v '^src/toolPacks/' \| wc -l` | TAK — to jest dokładnie definicja „biblioteki bez wywołania” dla tego katalogu |
| 2 | pliki w `src/toolPacks/` ogółem | `31` | `find src/toolPacks -type f \| wc -l` | TAK |
| 3 | z tego sklasyfikowane jako `test-only` | `31` | `node scripts/dev/reachability-from-root.mjs` + filtr po prefiksie `src/toolPacks/` | TAK — osiągalność liczona od korzenia `src/index.tsx`, nie po imporcie sąsiada |
| 4 | totals osiągalności na markerze (app / harness-only / test-only / unreachable) | `3044 / 30 / 1017 / 719` | `node scripts/dev/reachability-from-root.mjs` → pole `totals` | TAK |
| 5 | linia definicji `SWOT_STEPS` | `1363` | `bash -c 'grep -n "export const SWOT_STEPS" src/store/useToolStore.ts'` | TAK |
| 6 | linia `TOOL_STEP_DEFINITIONS` | `2742` | `bash -c 'grep -n "export const TOOL_STEP_DEFINITIONS" src/store/useToolStore.ts'` | TAK |
| 7 | linia `getStepDefinitions()` w store | `5075` | `bash -c 'grep -n "getStepDefinitions:" src/store/useToolStore.ts'` | TAK |
| 8 | linia sekcji statycznej o id `review` (kolizja) | `1908` | `bash -c "grep -n \"id: 'review'\" src/components/DiscoveryTools/ToolDocumentView.tsx"` | TAK — to jest dokładnie id, które nowa faza chce zająć |
| 9 | liczba kolumn siatki kafli etapów SWOT | `5` (twarde `xl:grid-cols-5`) | `bash -c 'grep -n "xl:grid-cols-5" src/components/DiscoveryTools/ToolDocumentView.tsx'` | TAK |
| 10 | id w unionie `DynamicSwotPhaseSummary` | `5` | `sed -n '14,16p' src/components/DiscoveryTools/toolCompletion.ts` | TAK |
| 11 | paczki narzędzi, których NIE ruszasz | `18` | `ls src/toolPacks/packs/*.pack.ts \| wc -l` → 19, minus `dynamicSwot.pack.ts` | TAK |
| 12 | liście i18n `pl` / `en` na markerze | `35198` / `33065` | `node -e '…'` z `§0.3` komenda (8) | TAK — liczy liście, nie klucze najwyższego poziomu |
| 13 | wolne numery migracji w MOIM przedziale `20261270`–`20261279` | `0 zajętych` | `bash -c 'ls server/migrations/ \| grep -cE "^2026127"'` | **TAK — sprawdź to osobno, to jest najczęstszy błąd (CZĘŚĆ D, błąd 2)** |

**Jeżeli Twój pomiar przeczy którejkolwiek z tych liczb — obowiązuje TWÓJ pomiar.
Zapisz rozbieżność wprost w sekcji „KOREKTY WOBEC INSTRUKCJI”.**

---

# TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

## Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji + z kim |
| --- | --- | --- | --- | --- |
| 1 | `src/store/useToolStore.ts` | istniejący | `R3` | ★★ ŚREDNIE — plik duży i wspólny dla 31 narzędzi; ograniczasz się do `getStepDefinitions()` i źródła `TOOL_STEP_DEFINITIONS['dynamic-swot']` |
| 2 | `src/components/DiscoveryTools/toolCompletion.ts` | istniejący | `R3` | ZEROWE |
| 3 | `src/components/DiscoveryTools/ToolDocumentView.tsx` | istniejący | `R3`, `R5` | ŚREDNIE — powłoka dokumentu narzędzia; ograniczasz się do czterech miejsc z licencji |
| 4 | `src/toolPacks/packs/dynamicSwot.pack.ts` | istniejący | `R3` | ZEROWE |
| 5 | `src/toolPacks/__tests__/**` (rozszerzenia + NOWE) | istniejący/NOWE | `R3` | ZEROWE |
| 6 | `tests/e2e/tools/swot-real-pg-resume.spec.ts` | istniejący | `R4` | ZEROWE |
| 7 | `dev-render/screens/tools-swot-session-workspace.tsx` | istniejący | `R5` | ZEROWE |
| 8 | `docs/…/CODEX_DAY341_SWOT_PODLACZENIE_REPORT.md` | NOWY | `R6` | ZEROWE |

## Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| `public/locales/{pl,en}/translation.json` | `R3` | Tylko jeżeli `R3` rozstrzygnie, że napisy nowych etapów wychodzą z paczki do słownika. Wyłącznie dopisanie kluczy, parytet PL+EN w jednym commicie, liczba liści rośnie albo zostaje |
| `src/utils/dynamicSwotSevenStagesFlag.ts` | `R3` | Tylko jeżeli szew wymaga udostępnienia tej samej flagi warstwie store. **Wartość domyślna zostaje OFF** |
| `scripts/dev/grafika-zrzuty.mjs` | `R5` | Tylko jeżeli przekazanie flagi do procesu harnessu wymaga NOWEJ opcji opt-in; domyślne zachowanie musi zostać identyczne co do bitu |
| `server/migrations/20261270_day341_*.sql` | `R4` | Tylko jeżeli `R4` udowodni brak kolumny potrzebnej do wznawiania siedmiu etapów. Wyłącznie addytywna |
| `dev-render/main.tsx` | `R5` | Tylko jeżeli harness nie da się przełączyć bez zmiany w tym pliku |
| `docs/…/modules/03_TOOLS/MODULE_ACCEPTANCE.md` | `§R.1` | Zawsze na końcu, wyłącznie wiersz siedmioetapowej sesji SWOT |

## Pliki, których ten dyżur JAWNIE NIE ZAPISZE — imiennie

```
src/toolPacks/packs/*.pack.ts               — 18 paczek poza dynamicSwot (decyzja właściciela)
src/method-core/**                          — runtime SWOT tam nie mieszka (pomiar 04.09)
src/components/Discovery/DiscoveryToolsHub.tsx — plik przekrojowy 31 narzędzi
src/components/MyWork/**                    — teren dyżuru 342
src/components/MyWork/prototypes/**         — teren dyżuru 342
src/utils/ideaNotebookRightPanelPrototypeFlag.ts — teren dyżuru 342
scripts/dev/g06-macierz-ekrany.json         — macierz ekranów, tylko odczyt
docs/.../reachability.baseline.json         — baza odniesienia osiągalności, tylko odczyt
server/scripts/migrate.postgres.ts          — bramka platformowa
tests/setup.ts, tests/helpers/**, vitest*.config.ts — Z18
.github/workflows/**                        — bramki CI
```

## Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone (komenda + wynik) |
| --- | --- | --- |
| Port PostgreSQL | `6377` | `lsof -nP -iTCP:6377 -sTCP:LISTEN` → pusto |
| Port harnessu | `5517` | `lsof -nP -iTCP:5517 -sTCP:LISTEN` → pusto |
| Nazwa kontenera | `cx-day341-pg` | `docker ps --format '{{.Names}}' \| grep -c cx-day341-pg` → 0 |
| Nazwa bazy | `cx341` | tworzona przez `docker run` z `§0.2c` |
| **Przedział migracji** | **`20261270`–`20261279`** | `bash -c 'ls server/migrations/ \| grep -cE "^2026127"'` → 0 |
| Gałąź | `codex/day341-swot-podlaczenie-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day341-swot-podlaczenie` | nie istnieje |
| Flagi funkcyjne | `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` — ISTNIEJĄCA, default **OFF**, nie zmieniasz wartości domyślnej; **zero nowych flag** | `bash -c 'grep -rn "VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES" src \| wc -l'` → 8 trafień, wszystkie w paczce, fladze i jej teście |

## Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day341-swot-podlaczenie
git diff --name-only --cached | tee /private/tmp/cx-day341-swot-podlaczenie-artefakty/staged.txt
grep -iE 'src/components/MyWork|prototypes/IdeaNotebook|ideaNotebookRightPanel|method-core|toolPacks/packs/(?!dynamicSwot)|g06-macierz-ekrany|reachability.baseline' \
  /private/tmp/cx-day341-swot-podlaczenie-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## Prawo zatrzymania

„`R1` i `R2` wykonane, szew zmierzony, kolizja `review` opisana, oto jedno pytanie do
właściciela” **jest wynikiem** — i lepszym niż przewód poprowadzony na własnej interpretacji.

Natomiast **nie jest** uprawnionym zatrzymaniem: „nie ma harnessu” (jest, i montuje realny hub),
„nie wolno mi ruszyć pliku” (tabela licencji jest licencją), „nie da się zmierzyć” (jest
`reachability-from-root.mjs`), „testy przechodzą, więc działa” (to warstwa 1 z czterech).

Zmiana pozostałych osiemnastu paczek nie jest nadwykonaniem — jest podstawą odrzucenia gałęzi.

**★ Ostatnie zdanie i najważniejsze: obalenie którejkolwiek mojej tezy jest SUKCESEM dyżuru,
a nie porażką. Jeżeli zmierzysz, że przewód już istnieje i ta instrukcja opisuje zrobioną
pracę — napisz to wprost w pierwszym commicie i zatrzymaj się. Jeżeli Twój pomiar przeczy
liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**

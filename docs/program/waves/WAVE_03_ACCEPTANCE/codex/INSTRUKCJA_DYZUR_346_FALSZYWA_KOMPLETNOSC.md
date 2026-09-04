# INSTRUKCJA DYŻURU nr 346 — Codex — „P0 — FAŁSZYWE ŚWIADECTWO KOMPLETNOŚCI: raport Oceny drukuje klientowi Kompletność 100% i Obszary ocenione 39/39 przy siedmiu odpowiedziach, bo licznik uznaje CEL za odpowiedź; do tego etykieta prototypowej prozy silnika 298 i powtórzenie porównania trzech silników na sesji 39/39"

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
> **wyłącznie** `/private/tmp/cx-day346-falszywa-kompletnosc`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6a4919f72d`**
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
Zakres: **Ocena (DRD) — wiarygodność raportu klientowskiego: licznik kompletności, etykieta prozy silnika 298, porównanie trzech silników na pełnej sesji**.
Trasy front: ``src/components/.../DRDAuditReportView.tsx` przez `AppRoutes.tsx:1702` (za zastaną flagą `isDrdReportEnabled`, domyślnie OFF) oraz `AssessmentReportContractView.tsx` (za zastaną flagą `drdHttpSourceOfTruthV1`, domyślnie OFF) — obie TYLKO DO ODCZYTU w tym dyżurze`. Trasy tył: ``GET /api/assessment-reports/:reportId/drd-report` (`server/src/routes/assessment-reports.routes.ts:1065`, zamontowana przez 12-liniowy re-eksport `server/src/routes/assessment/assessment-reports.routes.ts` w `Gateway.ts:76`) · `GET /api/method/sessions/:sessionId/assessment-report-contract` i `…/assessment-report.docx` (`server/src/routes/method-core.routes.ts:535` i `:553`) · model raportu `server/src/services/report/drdReportModel.ts` i jego bliźniak `src/services/report/drdReportModel.ts``.

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
WT=/private/tmp/cx-day346-falszywa-kompletnosc
MARKER=6a4919f72d

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day346-falszywa-kompletnosc-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day346-falszywa-kompletnosc/config.worktree"
cat "$VAULT/worktrees/cx-day346-falszywa-kompletnosc/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day346-falszywa-kompletnosc-scratch
mkdir -p /private/tmp/cx-day346-falszywa-kompletnosc-artefakty

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
git -C "$VAULT" log --oneline 6a4919f72d..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 6a4919f72d..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day346-falszywa-kompletnosc-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6a4919f72d..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day346-falszywa-kompletnosc

# (0) ★ PIERWSZA KOMENDA MERYTORYCZNA: czy dowody dyzuru 339 jeszcze istnieja?
ls -la /private/tmp/cx-day339-silnik-raportu-wybor-artefakty/ 2>/dev/null || echo 'BRAK — odtwarzasz sesje sam'
#   oczekiwane przy pisaniu instrukcji: 18 plikow, w tym `day339-session.json` (1407 bajtow).
#   To katalog TYMCZASOWY cudzego dyzuru — jego brak NIE jest STOP-em.

# (1) ★ TEZA-PRZYCZYNA: licznik kompletnosci uznaje CEL za odpowiedz
sed -n '355,362p' server/src/services/report/drdReportModel.ts
#   oczekiwane: `(s) => s && (Number(s.actual) > 0 || Number(s.target) > 0)`.
#   Warunek jest alternatywa. Cel jest wpisany przez paczke metodyki dla KAZDEGO z 39 obszarow,
#   wiec licznik zawsze zwroci 39 — niezaleznie od liczby odpowiedzi.

# (2) ★ TEZA: defekt jest w DWOCH plikach, nie w jednym
bash -c "grep -rn 'actual) > 0 || Number' server/src/ src/"
#   oczekiwane: DWA trafienia — server/src/services/report/drdReportModel.ts ok. 358
#   oraz src/services/report/drdReportModel.ts ok. 393. Naprawa jednego zostawia klamstwo w drugim.

# (3) ★ TEZA: dane sesji z pomiaru 339 potwierdzaja arytmetyke klamstwa
node -e 'const m=require("./evidence/silniki-raportu-oceny-20260904/day339-engine-manifest.json");const a=m.input.areaScores;const k=Object.keys(a);console.log("obszarow:",k.length,"z actual>0:",k.filter(x=>a[x].actual>0).length,"z target>0:",k.filter(x=>a[x].target>0).length)'
#   oczekiwane: obszarow 39, z actual>0 SIEDEM, z target>0 TRZYDZIESCI DZIEWIEC.
#   Stad „Kompletnosc 100%" i „39/39" przy siedmiu odpowiedziach.

# (4) ★ TEZA: prog wiarygodnosci „Wysoka" zaczyna sie od 90%
grep -n 'Wysoka\|confidenceLabel' server/src/services/report/drdReportModel.ts | head
#   oczekiwane: `if (completionPercent >= 90) return isPL ? 'Wysoka' : 'High';` ok. 222-226

# (5) ★★ TEZA: falszywa liczba jest PODAWANA MODELOWI JEZYKOWEMU jako kontekst
grep -rn 'completionPercent' server/src/ --include=*.ts | grep -v __tests__
#   oczekiwane: cztery konsumenci poza samym modelem, w tym
#   server/src/services/conclusions/reportConclusionBridge.ts ok. 94, ktory sklada zdanie
#   „… (100% assessed, narrative: …)" i podaje je narratorowi. Klamstwo sie WZMACNIA.

# (6) ★ TEZA-SPROSTOWANIE: proza prototypu NIE jest wpisana w silnik 298
grep -rn 'TechProd' server/src/services/report/ || echo 'ZERO trafien w silniku'
grep -n 'raport-oceny-tresc' scripts/dev/day339-porownanie-silnikow.mjs
#   oczekiwane: zero trafien w `server/src/services/report/`; skrypt porownawczy ok. 165
#   importuje `scripts/prototypes/raport-oceny-tresc.mjs` i PODAJE proze na wejsciu.
#   `buildAcceptedDrdReportModel` niczego nie wymysla — dostal statyczna tresc od PRZYRZADU.

# (7) ★ TEZA: silnik 298 nie ma ANI JEDNEGO wolacza produkcyjnego
bash -c "grep -rn 'buildAcceptedDrdReportModel' server/src src tests scripts | grep -v __tests__"
#   oczekiwane: definicja `acceptedDrdReportModel.ts:94` + trzy linie w skrypcie porownawczym. Nic wiecej.

# (8) ★ TEZA: trasa silnika HTML jest zamontowana przez 12-liniowy re-eksport
wc -l server/src/routes/assessment/assessment-reports.routes.ts
grep -n 'assessment-reports.routes' server/src/Gateway.ts
#   oczekiwane: 12 linii; Gateway.ts ok. 76 montuje `./routes/assessment/assessment-reports.routes.js`,
#   ktory reeksportuje router z `server/src/routes/assessment-reports.routes.ts` (2898 linii).
#   Silnik HTML JEST zywy — nie daj sie zwiesc temu, ze Gateway nie wskazuje duzego pliku wprost.

# (9) TEZA: dostep przez UI jest za zastana flaga domyslnie OFF
grep -rn 'isDrdReportEnabled' src/utils/drdReportFlag.ts src/routes/ src/AppRoutes.tsx 2>/dev/null | head
#   oczekiwane: flaga istnieje i domyslnie OFF. To NIE zmniejsza wagi defektu — zmienia jego opis
#   z „klient to widzi dzis" na „klient zobaczy to w dniu wlaczenia flagi". Napisz to uczciwie.

# (10) TEZA: liscie i18n
node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'
#   oczekiwane: 35198 33065 — te liczby NIE MOGA zmalec

# (11) zasoby wolne
df -h /
lsof -nP -iTCP:6393 -sTCP:LISTEN; lsof -nP -iTCP:5533 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep cx-day346 || echo 'brak kontenera'
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; brak kontenera
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day346-falszywa-kompletnosc-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6393`. Twój JEDYNY port harnessu to `5533`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day346-pg`**. **ZAKAZANE:** `5530, 5531, 5532 (runtime dyżurów 343, 344 i 345), 6390, 6391, 6392 (bazy dyżurów 343, 344 i 345), 5432 (cudzy nasłuch na hoście), a także wszystkie porty dyżurów 347-350, które inny autor wydaje równolegle w tej samej serii`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNA — dyżur nie zakłada ani jednej flagi i nie zmienia wartości domyślnej żadnej zastanej. W szczególności NIE dokłada flagi narratora LLM i go NIE wyłącza: DEC-390 mówi, że narrator ZOSTAJE włączony`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/resultsInternalBetaVisibility.middleware.ts`, `server/src/middleware/appErrorMapper.ts`, `src/services/api.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY346_FALSZYWA_KOMPLETNOSC_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md` (istnieje na markerze; dopisujesz nową sekcję „Dyżur 346", niczego nie kasujesz i niczego nie przeredagowujesz — w szczególności zostawiasz nietkniętą sekcję `R7` dyżuru 339, bo Twoje `R5` ma ją ZASTĄPIĆ nową rekomendacją, a nie wymazać starą). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day346-falszywa-kompletnosc-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day346-falszywa-kompletnosc-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ ZAKAZ PODŁĄCZANIA I ZAKAZ WYGASZANIA JAKIEGOKOLWIEK SILNIKA RAPORTU. Nie dopisujesz wołacza do `buildAcceptedDrdReportModel` ani do `methodSessionReportMetadataService`, nie odmontowujesz żadnej z trzech tras, nie zmieniasz wartości domyślnej `isDrdReportEnabled` ani `drdHttpSourceOfTruthV1`. ★★ ZAKAZ DODAWANIA FLAGI NARRATORA LLM I ZAKAZ JEGO WYŁĄCZENIA (DEC-390). ★★ ZAKAZ ZMIANY STRUKTURY ZAAKCEPTOWANEGO PROTOTYPU 21 STRON — jest punktem odniesienia pomiaru, nie materiałem do poprawiania. ★★ ZAKAZ „NAPRAWY" KOMPLETNOŚCI PRZEZ UKRYCIE METRYKI: karta wiarygodności zostaje na okładce, zmienia się wyłącznie to, CO liczy jej licznik. ★★ ZAKAZ KLUCZY DOSTAWCÓW MODELI w środowisku, w plikach i w komendach. | DEC-389 („Zdecyduj sam po pomiarze") i DEC-390 („narrator LLM ZOSTAJE włączony"), `docs/program/REJESTR_ZNALEZISK_20260903.md` sekcja N, wiersze N2 i N3. Dyżur 339 miał DOSTARCZYĆ POMIAR, nie zdecydować za nadzorcę — i ten podział obowiązuje dalej. Podłączenie albo wygaszenie silnika przed decyzją zamienia pomiar w fakt dokonany i odbiera nadzorcy przedmiot wyboru. Kontekst prototypu: właściciel ocenił gotowy plik 21 stron słowami „Ten raport jest po prostu fantastyczny" (DEC-385) — to jest wzorzec, do którego się mierzymy. |

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
cd /private/tmp/cx-day346-falszywa-kompletnosc

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day346-pg psql -U postgres -d cx346 \
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
cd /private/tmp/cx-day346-falszywa-kompletnosc

docker run -d --name cx-day346-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx346 \
  -p 127.0.0.1:6393:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day346-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6393/cx346 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6393/cx346 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day346-falszywa-kompletnosc && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6393/cx346 \
JWT_SECRET=cx346-test-secret-do-not-reuse \
npx vitest run server/src/services/report/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day346-falszywa-kompletnosc-artefakty/day346-raport-oceny.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day346-falszywa-kompletnosc && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/report/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day346-falszywa-kompletnosc-artefakty/day346-raport-oceny.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day346-falszywa-kompletnosc/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day346-pg psql -U postgres -d cx346 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day346-pg`.
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
> **(e) DOWODY DYŻURU 339 LEŻĄ POZA REPOZYTORIUM I MOGĄ ZNIKNĄĆ. Skrypt porównawczy `scripts/dev/day339-porownanie-silnikow.mjs` ma ZASZYTE NA SZTYWNO ścieżki `/private/tmp/cx-day339-silnik-raportu-wybor-artefakty` i `evidence/silniki-raportu-oceny-20260904`, a wejściem jest plik `day339-session.json` w tym pierwszym katalogu. Przy pisaniu tej instrukcji katalog istniał, ale to jest katalog tymczasowy cudzego dyżuru: `ls` na nim jest PIERWSZĄ komendą, którą wykonujesz, zanim cokolwiek zaplanujesz. Jeżeli go nie ma — odtwarzasz sesję u siebie, na swojej bazie i swoim porcie, i mówisz to wprost. Druga pułapka: sam skrypt zapisuje do KATALOGU DOWODÓW DYŻURU 339 — uruchomienie go bez parametryzacji NADPISZE cudze dowody w repo. Musisz go sparametryzować (opt-in) albo uruchomić jego kopię w swoim katalogu scratch, i napisać w raporcie, co wybrałeś. Trzecia: PDF-y kontrolne dyżuru 339 powstały przez LibreOffice (`soffice`) i `pdfinfo`, a nie natywnie przez produkt — nie są dowodem na to, co produkt wysyła klientowi, i tak samo będzie z Twoimi**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day346-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day346-falszywa-kompletnosc-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6393` albo `5533` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6393` albo `5533`** (`Z7`).

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

Właściciel ocenił prototyp raportu Oceny (21 stron, plik, nie kod) słowami **„Ten raport jest po
prostu fantastyczny”** (`DEC-385`, `docs/program/REJESTR_ZNALEZISK_20260903.md`, wiersz H6). Potem
oddał wybór silnika CTO: **„Zdecyduj sam po pomiarze”** (`DEC-389`, wiersz N2). Dyżur 339 ten
pomiar dostarczył — wyprodukował raporty **trzema silnikami dla tej samej sesji** i zapisał je
w `evidence/silniki-raportu-oceny-20260904/`.

**Odbiór tego pomiaru znalazł rzecz, której dyżur 339 nie nazwał, a która jest defektem produktu,
nie pomiaru.**

### ★ FAŁSZYWE ŚWIADECTWO KOMPLETNOŚCI — P0

Sesja użyta do porównania miała **7 odpowiedzi na 39 obszarów**. Silnik HTML wydrukował na
okładce:

> **Kompletność `100%` · Obszary ocenione `39/39` · Wskaźnik wiarygodności oceny `Wysoka`**

(strona 24 zestawienia `evidence/silniki-raportu-oceny-20260904/04-zestawienie-obok-prototypu.pdf`).

**To jest dokument, który klient dostaje do ręki, i twierdzi, że ocena jest kompletna, gdy
odpowiedzi jest jedna piąta.** W kategoriach tego programu to nie jest defekt kosmetyczny — to
jest **oświadczenie nieprawdy w produkcie doradczym**.

**Przyczyna, zmierzona i nazwana** (`server/src/services/report/drdReportModel.ts` ok. 356-360):

```
const totalAreas = getTotalAreaCount();
const assessedAreas = Object.values(areaScores).filter(
  (s) => s && (Number(s.actual) > 0 || Number(s.target) > 0)
).length;
const completionPercent = totalAreas > 0 ? Math.round((assessedAreas / totalAreas) * 100) : 0;
```

Warunek jest **alternatywą**. `target` to **cel wpisany przez paczkę metodyki dla każdego z 39
obszarów**, niezależnie od tego, czy ktokolwiek odpowiedział. W manifeście pomiaru 339 widać to
wprost: **7 obszarów ma `actual > 0`, a `target > 0` mają wszystkie 39.** Licznik liczy więc
zawsze 39 z 39, zawsze 100%, a `confidenceLabel` przy progu `>= 90` zawsze zwraca **„Wysoka”**.

**Trzy rzeczy, które to pogarszają:**

1. **Defekt jest w DWÓCH plikach.** Ten sam warunek stoi w
   `server/src/services/report/drdReportModel.ts` ok. 358 **i** w bliźniaku frontowym
   `src/services/report/drdReportModel.ts` ok. 393. Naprawa jednego zostawia kłamstwo w drugim.
2. **★ Fałszywa liczba jest PODAWANA MODELOWI JĘZYKOWEMU jako kontekst.**
   `server/src/services/conclusions/reportConclusionBridge.ts` ok. 94 składa zdanie
   `„… (100% assessed, narrative: …)”` i podaje je narratorowi. Narrator dostaje więc informację,
   że ocena jest kompletna, i pisze prozę zgodną z tym założeniem. **Kłamstwo się wzmacnia,
   zamiast zostać w jednej metryce na okładce.**
3. **Trzeci konsument** to `server/src/services/evidence/drdReportEvidenceBridge.ts` ok. 109 —
   `completionPct` idzie do mostka dowodowego. **Policz wszystkich konsumentów sam** (`B.3`
   wiersz 5) i wypisz ich imiennie.

### ★ Druga rzecz: `03-silnik-298.pdf` jest wewnętrznie sprzeczny

Plik ma prozę i metadane prototypu (klient **„TechProd Manufacturing”**, werdykt o zintegrowanym
ERP), a liczby przeliczone z realnej sesji — **6,6% ogółem, oś 1 = 0,22/7**. Dokument mówi
o jednej firmie i pokazuje wyniki innej. **Nie wolno go pokazać nikomu bez etykiety
„demo układu”.**

**Ale przyczyna jest inna, niż mówiło zlecenie — zmierzyłem to i sprostowuję poniżej.**

### ★ Trzecia rzecz: porównanie na sesji 7/39 systematycznie fałszuje wynik

- **Silnik kontraktu/DOCX** jest uczciwy: wypisuje **148 jawnych braków**, bo ich rzeczywiście
  brakuje — i za tę uczciwość dostaje w porównaniu najgorszą notę.
- **Silnik 298** ma **0 braków**, bo jego proza nie zależy od sesji: dostał statyczną treść
  prototypu. Wygrywa porównanie za to, że nie czytał danych.
- **Rekomendacja „298 najbliżej prototypu” jest w tym pomiarze artefaktem rzadkości danych**,
  a nie własnością silnika.

**Dlatego porównanie trzeba powtórzyć na sesji `39/39` i dopiero na tym oprzeć rekomendację dla
właściciela.**

## ★ Sprostowanie zlecenia — co mój pomiar na markerze skorygował

**Zapisuję to wprost, żebyś nie szukał nieistniejącego defektu i nie naprawiał produktu tam, gdzie
zawinił przyrząd.**

1. **„Oznaczyć albo usunąć prototypową prozę z silnika 298”.**
   **Prototypowej prozy NIE MA w silniku 298.** `grep -rn 'TechProd' server/src/services/report/`
   daje **zero trafień**. `buildAcceptedDrdReportModel` przyjmuje `META`, `OSIE` i `WNIOSKI` **na
   wejściu** i — zgodnie z własnym komentarzem — „never invents them”; przelicza wyłącznie liczby.
   **Prozę podał mu PRZYRZĄD**: `scripts/dev/day339-porownanie-silnikow.mjs` ok. 165 importuje
   `scripts/prototypes/raport-oceny-tresc.mjs` (klient „TechProd Manufacturing”) i wstrzykuje ją
   jako źródło. **Wewnętrzna sprzeczność `03-silnik-298.pdf` jest własnością skryptu
   porównawczego, nie silnika.** Twoje zadanie w `R3` zmienia się z „usuń prozę z silnika” na
   „oznacz artefakt i napraw przyrząd, żeby nie produkował dokumentów-hybryd”.
2. **„Fałszywe świadectwo w produkcie — dokument, który klient dostaje do ręki”.**
   **Defekt jest realny i kod jest żywy**, ale ścieżka do klienta biegnie dziś **za zastaną flagą
   `isDrdReportEnabled`, domyślnie OFF** (rejestr dyżuru 339, sekcja `R1`: „Osiągalny wyłącznie po
   zastanej fladze, domyślnie OFF”). To **nie zmniejsza wagi naprawy** — zmienia jej opis
   z „klient to widzi dziś” na „klient zobaczy to w dniu włączenia flagi, a flaga ma być włączona”.
   **Napisz to w raporcie uczciwie w tej właśnie formie.** Zawyżenie w drugą stronę też jest
   zawyżeniem.
3. **Trasa silnika HTML wygląda na niezamontowaną, a jest zamontowana.** `Gateway.ts` ok. 76
   importuje `./routes/assessment/assessment-reports.routes.js` — plik **12-liniowy**, który
   reeksportuje router z `server/src/routes/assessment-reports.routes.ts` (2898 linii, trasa
   ok. 1065). **Nie ogłoś martwym silnika, który żyje przez re-eksport.**
4. **`AssessmentReportDocxDownload` nie istnieje jako komponent.** Rejestr dyżuru 339 zawiera już
   to sprostowanie: nazwa występuje wyłącznie w nazwie pliku testowego, a realnym konsumentem
   pobrania DOCX jest `AssessmentReportContractView.tsx` ok. 360. **Nie odsyłaj do nieistniejącego
   komponentu.**

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Zmierz moje liczby sam

Twierdzę: obszarów w metodyce DRD jest **39**; w sesji pomiaru 339 `actual > 0` ma **7** obszarów,
a `target > 0` — **39**; warunek `actual > 0 || target > 0` stoi w **2** plikach; konsumentów
`completionPercent` poza samym modelem jest **co najmniej 3** (mostek dowodowy, mostek wniosków
podający liczbę narratorowi, skład HTML); próg etykiety „Wysoka” to **90%**; `TechProd` ma
w `server/src/services/report/` **0** trafień; `buildAcceptedDrdReportModel` ma **0** wołaczy
produkcyjnych; re-eksport trasy ma **12** linii, a plik docelowy **2898**; PDF-y silników mają
kolejno **18**, **9** i **21** stron; liście `public/locales/pl/translation.json` = **35198**,
`en` = **33065**.

**Każdą z tych liczb policz sam, u siebie, na swojej bazie. Przepisanie mojej liczby jest
zawyżeniem i podstawą odrzucenia raportu (`Z24`).**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA” — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **model raportu — serwer (rdzeń dyżuru)** | `server/src/services/report/drdReportModel.ts` | **★ PEŁNA LICENCJA — WYŁĄCZNIE w zakresie liczenia `assessedAreas`, `completionPercent` i `confidenceLabel`** oraz dopisania pól opisujących, co dokładnie policzono. **ZAKAZ zmiany struktury modelu, sekcji raportu i skal osi** | Gotowy diff w bloku kodu, **nienałożony**, + brief: promień rażenia, co widzi klient przed i po |
| **model raportu — front (rdzeń dyżuru)** | `src/services/report/drdReportModel.ts` | **★ PEŁNA LICENCJA — WYŁĄCZNIE ten sam, identyczny zakres co wyżej.** ★ To jest bliźniak, nie kopia zapasowa: naprawa jednego pliku bez drugiego zostawia kłamstwo na żywej ścieżce | Gotowy diff nienałożony + brief |
| **skład HTML** | `server/src/services/report/drdReportHtml.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE etykiety i sposób prezentacji karty wiarygodności** (ok. 408-411), jeżeli poprawny licznik wymaga innego napisu (np. rozdzielenia „obszarów z odpowiedzią” od „obszarów z celem”). **ZAKAZ usunięcia karty wiarygodności z okładki** — ukrycie metryki nie jest naprawą | Gotowy diff nienałożony + brief |
| **mostki konsumujące liczbę** | `server/src/services/conclusions/reportConclusionBridge.ts`, `server/src/services/evidence/drdReportEvidenceBridge.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dostosowanie do poprawionego znaczenia liczby.** ★ Pierwszy z nich **podaje liczbę modelowi językowemu** — jeżeli zostawisz tam 100%, narrator dalej będzie pisał o kompletnej ocenie, choćby okładka mówiła prawdę | Gotowy diff nienałożony + brief z promieniem rażenia |
| **silnik 298** | `server/src/services/report/acceptedDrdReportModel.ts` | **TYLKO ODCZYT.** Silnik nie wymyśla prozy — dostaje ją na wejściu. **ZAKAZ dopisywania mu wołacza produkcyjnego** (`Z40`) | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **przyrząd porównawczy** | `scripts/dev/day339-porownanie-silnikow.mjs` | **★ WĄSKA LICENCJA — WYŁĄCZNIE zmiany ADDYTYWNE i OPT-IN**: parametryzacja katalogów wyjściowych, parametryzacja źródła treści dla silnika 298 i **jawna etykieta „DEMO UKŁADU — treść prototypowa, liczby z sesji”** na każdym artefakcie, który miesza dwa źródła. **★ ZAKAZ uruchomienia go bez parametryzacji: ma ZASZYTĄ ścieżkę do katalogu dowodów dyżuru 339 w repo i NADPISZE cudze dowody.** Zachowanie domyślne pozostaje takie jak dziś | — |
| **treść prototypu** | `scripts/prototypes/raport-oceny-tresc.mjs`, `scripts/prototypes/build-raport-oceny-prototyp.mjs`, `data/sample-reports/**`, `src/services/report/drdReportSampleData.ts` | **TYLKO ODCZYT.** To jest **zaakceptowany przez właściciela** prototyp 21 stron (`DEC-385`) i punkt odniesienia pomiaru, nie materiał do poprawiania (`Z40`) | Errata w raporcie |
| **narrator LLM** | `server/src/services/report/drdLlmNarrator.ts`, `drdReportGenerator.ts`, `drdReportService.ts`, `drdReportGrounding.ts`, `drdConclusionContract.ts` | **TYLKO ODCZYT. ZAKAZ dodania flagi narratora i zakaz jego wyłączenia** (`DEC-390`, `Z40`) | Opis w raporcie z dowodem plik:linia + gotowy diff nienałożony |
| **trasy** | `server/src/routes/assessment-reports.routes.ts`, `server/src/routes/assessment/assessment-reports.routes.ts`, `server/src/routes/method-core.routes.ts` | **TYLKO ODCZYT — PLIKI PRZEKROJOWE.** Pierwszy ma 2898 linii i 27 tras; ten dyżur nie montuje, nie odmontowuje i nie zmienia żadnej | **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT DLA DYŻURU 346 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, + brief: plik:linia · promień rażenia · jak wyglądałby dowód mutacyjny. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **flagi ujawniania** | `src/utils/drdReportFlag.ts`, bramka `drdHttpSourceOfTruthV1` w `useFeatureFlags.ts` | **TYLKO ODCZYT. ZAKAZ zmiany wartości domyślnej** (`Z10`, `Z11`) | Errata w raporcie |
| **struktura metodyki** | `server/src/data/drdStructure.ts`, `src/services/drdStructure.ts` | **TYLKO ODCZYT** — `getTotalAreaCount()` jest poprawne; problem jest w liczniku, nie w mianowniku | Errata w raporcie |
| **walidator (NOWE pliki)** | `server/src/services/report/__tests__/**`, `tests/unit/report/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31`. **★ NOWE PLIKI TESTOWE dla warstwy frontowej kładziesz w `tests/`, NIGDY pod `src/`** — plik testowy pod `src/` czerwieni bezpiecznik osiągalności (zdarzyło się 04.09 trzy razy). Katalog `server/src/services/report/__tests__/` jest **zastany i dopuszczony** dla testów serwerowych. `git add -f` obowiązkowo | — |
| **walidator (ZASTANE)** | `server/src/services/report/__tests__/day339.reportEngines.gateway.pg.test.ts`, `acceptedDrdReportModel.test.ts`, `day331.methodSessionReportMetadataTenant.pg.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisywanie NOWYCH przypadków `it(...)`.** Zakaz zmiany i osłabiania istniejących asercji (`Z40`) | Nowy plik testowy obok, z nagłówkiem `// KONTRAKT DYŻURU 346` |
| **dowody dyżuru 339** | `evidence/silniki-raportu-oceny-20260904/**` | **TYLKO ODCZYT — CUDZE DOWODY.** ★ Skrypt porównawczy zapisuje **do tego katalogu**; uruchomienie go bez parametryzacji je NADPISZE | Twoje artefakty idą do `evidence/raport-oceny-kompletnosc-20260904/` |
| **dowody** | `evidence/raport-oceny-kompletnosc-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie sekcji „Dyżur 346”.** Zakaz kasowania i przeredagowywania zastanych sekcji, w szczególności `R7` dyżuru 339 — Twoja rekomendacja **zastępuje ją nową sekcją**, nie wymazuje starej | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY346_FALSZYWA_KOMPLETNOSC_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nie jest mu przydzielony | Uznasz migrację za potrzebną → **STOP MERYTORYCZNY z briefem**, przechodzisz do następnej pozycji |
| **decyzje** | `docs/program/REJESTR_ZNALEZISK_20260903.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest **ZROBIONA** z takim opisem |
| **cudzy teren** | `src/components/Initiatives/**` — **teren dyżuru 343**; `src/components/DiscoveryTools/**` — **teren dyżuru 344**; `src/components/MyWork/**`, `src/components/standard/ArtifactRight*` — **teren dyżuru 345**; wszystko dotknięte przez dyżury 347-350 tej serii | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, treść problemu, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar wejściowy: fałszywe świadectwo odtworzone własną ręką + inwentarz konsumentów liczby | TAK | NIE — dowód: `grep -rn 'completionPercent' server/src/` pokazuje, że pomiar jest odczytem, a model buduje się bez trasy | bazowe | Na sesji **7/39**: `assessedAreas`, `completionPercent`, `confidenceLabel` odczytane **z modelu**, nie z PDF; imienna lista wszystkich konsumentów `completionPercent`; **dosłowne zdanie, które trafia do narratora** | `npx tsx`/`vitest` budujący model z `areaScores` z manifestu + `grep -rn 'completionPercent' server/src/ src/` | `docs(day346): pomiar wejsciowy — 100% przy 7 z 39 odpowiedzi (346 R1)` |
| R2 | **RDZEŃ: licznik kompletności nigdy nie twierdzi więcej, niż wie** | TAK | NIE — dowód: `B.1` daje pełną licencję na oba pliki modelu w wąskim zakresie | +1 test broniący ZACHOWANIA | Na sesji **7/39**: kompletność **18%**, obszary **7/39**, wiarygodność **nie „Wysoka”**. Na sesji **39/39**: **100%**, **39/39**, „Wysoka”. Naprawione **OBA** pliki modelu i **wszyscy** konsumenci z `R1` | `npx vitest run server/src/services/report/__tests__ --config server/vitest.config.ts --retry=0 --reporter=json --outputFile=…` | `fix(report): kompletnosc liczona z odpowiedzi, nie z celow paczki (346 R2)` |
| R3 | Silnik 298 — etykieta „demo układu” i przyrząd, który przestaje produkować hybrydy | NIE | NIE | +1 test | Każdy artefakt mieszający prozę prototypu z liczbami realnej sesji ma **widoczną etykietę na pierwszej stronie**; skrypt porównawczy sparametryzowany i **nie nadpisuje cudzych dowodów**; w raporcie sprostowanie, że proza nie pochodzi z silnika | `grep -rn 'TechProd' server/src/services/report/` → 0 + wygenerowany artefakt z etykietą | `fix(scripts): etykieta demo ukladu i parametryzacja porownania silnikow (346 R3)` |
| R4 | **RDZEŃ: porównanie trzech silników POWTÓRZONE na sesji 39/39** | TAK | NIE | n/d | Sesja z odpowiedziami na **wszystkie 39 obszarów** na własnej bazie i własnym porcie; trzy raporty; tabela: silnik · stron · jawnych braków · kompletność · czas · zgodność z prototypem 21 stron; artefakty w **swoim** katalogu dowodów z `shasum -a 256` | własny przelot sparametryzowanego skryptu z `R3` + `pdfinfo` | `docs(day346): porownanie trzech silnikow na sesji 39/39 (346 R4)` |
| R5 | Rekomendacja dla właściciela oparta na `R4`, nie na sesji 7/39 | NIE | NIE | n/d | Nowa sekcja rejestru: który silnik, dlaczego, czego brakuje, jaki jest następny krok. **Jawnie napisane, czy i jak zmienia się rekomendacja `R7` dyżuru 339** i dlaczego. Wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie” | — | `docs(day346): rekomendacja silnika na pomiarze 39/39 (346 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE” **niepusta** | — | `docs(day346): raport` |

> **Kolumna „Wymaga plików przekrojowych?” jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Pliki przekrojowe w promieniu tego dyżuru to trzy pliki tras — **żadna
> pozycja ich nie zmienia**, bo model raportu buduje się bez wchodzenia w trasę. Jeśli uznasz,
> że musi — produktem jest czerwony kontrakt + brief, a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh` — `grep --include` w `zsh` zwraca pustkę zamiast wyniku, a pustka nie jest
wynikiem, dopóki nie sprawdzisz, że polecenie się wykonało.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Obszary metodyki DRD | 39 | `node -e "…getTotalAreaCount…"` albo zliczenie `areaScores` w manifeście | TAK — to jest mianownik kompletności |
| 2 | Obszary z `actual > 0` w sesji pomiaru 339 | 7 | `node -e '…manifest.input.areaScores…filter(actual>0).length'` | TAK — to jest realna liczba odpowiedzi |
| 3 | Obszary z `target > 0` w tej samej sesji | 39 | jw., dla `target` | TAK — **to jest cała przyczyna „100%”** |
| 4 | Pliki z warunkiem `actual > 0 \|\| target > 0` | 2 | `bash -c "grep -rn 'actual) > 0 \|\| Number' server/src/ src/"` | TAK — serwer ok. 358 i front ok. 393 |
| 5 | Konsumenci `completionPercent` poza modelem | co najmniej 3 | `grep -rn 'completionPercent' server/src/ src/ --include=*.ts --include=*.tsx \| grep -v __tests__` | TAK — **podaj pełną, imienną listę**; jeden z nich podaje liczbę modelowi językowemu |
| 6 | Próg etykiety „Wysoka” | 90% | `grep -n 'Wysoka' server/src/services/report/drdReportModel.ts` | TAK — dlatego 100% daje „Wysoka” |
| 7 | Trafienia `TechProd` w silniku 298 | 0 | `grep -rn 'TechProd' server/src/services/report/` | TAK — **proza pochodzi z przyrządu, nie z silnika** |
| 8 | Wołacze produkcyjne `buildAcceptedDrdReportModel` | 0 | `bash -c "grep -rn 'buildAcceptedDrdReportModel' server/src src tests scripts \| grep -v __tests__"` | TAK — definicja + skrypt porównawczy, nic więcej |
| 9 | Linie re-eksportu trasy vs plik docelowy | 12 / 2898 | `wc -l server/src/routes/assessment/assessment-reports.routes.ts server/src/routes/assessment-reports.routes.ts` | TAK — silnik HTML **jest** zamontowany |
| 10 | Strony PDF trzech silników (pomiar 339) | 18 / 9 / 21 | `pdfinfo evidence/silniki-raportu-oceny-20260904/0*-silnik-*.pdf` albo pole `pages` w manifeście | TAK — punkt odniesienia dla `R4`; ★ PDF-y powstały przez LibreOffice, nie natywnie |
| 11 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY346_FALSZYWA_KOMPLETNOSC_REPORT.md` | NOWY | R6 | ZEROWE |
| 2 | `evidence/raport-oceny-kompletnosc-20260904/**` | NOWY | R1/R4 | ZEROWE — **twoje** dowody, osobny katalog od dyżuru 339 |
| 3 | `server/src/services/report/drdReportModel.ts` | ZASTANY | R2 | ŚREDNIE — model konsumowany przez trzy silniki; **zmieniasz wyłącznie licznik i etykietę wiarygodności** |
| 4 | `src/services/report/drdReportModel.ts` | ZASTANY | R2 | ŚREDNIE — bliźniak frontowy; **ta sama zmiana, ten sam commit** |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_SILNIK_RAPORTU_OCENY_20260903.md` | ZASTANY — dopisanie sekcji | R1/R3/R4/R5 | ŚREDNIE — plik dyżuru 298 i 339; **dopisujesz sekcję, nie przepisujesz dokumentu** |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/services/report/drdReportHtml.ts` | R2 | Wyłącznie etykiety karty wiarygodności, jeżeli poprawny licznik wymaga innego napisu; karta zostaje na okładce |
| `server/src/services/conclusions/reportConclusionBridge.ts` | R2 | Wyłącznie dostosowanie zdania podawanego narratorowi do poprawionego znaczenia liczby; **zakaz wyłączania narratora** (`DEC-390`) |
| `server/src/services/evidence/drdReportEvidenceBridge.ts` | R2 | Jak wyżej, dla mostka dowodowego |
| `scripts/dev/day339-porownanie-silnikow.mjs` | R3/R4 | Tylko addytywnie i opt-in; **musi przestać domyślnie pisać do katalogu dowodów dyżuru 339** albo być uruchamiany z kopii w katalogu scratch |
| `server/src/services/report/__tests__/**`, `tests/unit/report/**` (NOWE) | R2/R3 | `git add -f`; test musi czerwienić się od mutacji ZABEZPIECZENIA, nie mechanizmu |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/services/report/acceptedDrdReportModel.ts     — silnik 298, zero wolaczy, zakaz podlaczania
server/src/services/report/drdLlmNarrator.ts             — DEC-390: narrator zostaje wlaczony
server/src/services/report/drdReportGenerator.ts         — jw.
server/src/services/report/drdReportService.ts           — jw.
server/src/services/report/drdReportGrounding.ts         — jw.
server/src/services/report/drdConclusionContract.ts      — jw.
server/src/routes/assessment-reports.routes.ts           — plik przekrojowy, 27 tras
server/src/routes/assessment/assessment-reports.routes.ts— re-eksport montujacy trase
server/src/routes/method-core.routes.ts                  — plik przekrojowy
server/src/data/drdStructure.ts                          — mianownik jest poprawny
src/services/drdStructure.ts                             — jw.
src/utils/drdReportFlag.ts                               — flaga ujawniania, default OFF
scripts/prototypes/**                                    — zaakceptowany prototyp (DEC-385)
data/sample-reports/**                                   — jw.
evidence/silniki-raportu-oceny-20260904/**               — CUDZE dowody, tylko odczyt
src/components/Initiatives/**                            — teren dyzuru 343
src/components/DiscoveryTools/**                         — teren dyzuru 344
src/components/MyWork/**                                 — teren dyzuru 345
server/migrations/**                                     — przedzial nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6393 | `lsof -nP -iTCP:6393 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji, marker `6a4919f72d`) |
| Port harnessu | 5533 | `lsof -nP -iTCP:5533 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day346-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day346` → brak |
| Nazwa bazy | `cx346` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Gałąź | `codex/day346-falszywa-kompletnosc-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day346-falszywa-kompletnosc` | nie istnieje |
| Flagi funkcyjne | **ŻADNA NOWA.** Zastane w promieniu: `isDrdReportEnabled` (OFF), `drdHttpSourceOfTruthV1` (OFF) — **nie zmieniasz ich wartości domyślnych**; narrator LLM **bez flagi i bez wyłączania** (`DEC-390`) | `grep -rn 'VITE_.*DRD' .env* docker-compose* railway* 2>/dev/null` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day346-falszywa-kompletnosc
git diff --name-only --cached | tee /private/tmp/cx-day346-falszywa-kompletnosc-artefakty/staged.txt
grep -iE 'acceptedDrdReportModel|drdLlmNarrator|drdReportGenerator|drdReportService|drdReportGrounding|drdConclusionContract|routes/assessment-reports\.routes|routes/assessment/|method-core\.routes|data/drdStructure|services/drdStructure|utils/drdReportFlag|scripts/prototypes/|data/sample-reports/|evidence/silniki-raportu-oceny-20260904/|components/Initiatives/|components/DiscoveryTools/|components/MyWork/|server/migrations/' \
  /private/tmp/cx-day346-falszywa-kompletnosc-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ oba pliki modelu maja isc RAZEM — naprawa jednego zostawia klamstwo w drugim:
git diff --name-only --cached | grep -c 'report/drdReportModel.ts'
#   oczekiwane przy commicie R2: 2

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"
```

---

## R1 — POMIAR WEJŚCIOWY: FAŁSZYWE ŚWIADECTWO ODTWORZONE WŁASNĄ RĘKĄ

**Ta pozycja nie naprawia niczego.** Ma zamienić cudzy zrzut strony PDF na Twoje własne liczby
odczytane **z modelu**, oraz dać pełną listę miejsc, do których ta liczba wypływa.

**(a) Trzy wartości z modelu, na sesji 7/39.** Zbuduj model raportu z `areaScores` z manifestu
(`evidence/silniki-raportu-oceny-20260904/day339-engine-manifest.json`, pole
`input.areaScores`) i odczytaj `credibility.assessedAreas`, `credibility.completionPercent`
i `credibility.confidenceLabel`.

```
oczekiwane: assessedAreas 39 · completionPercent 100 · confidenceLabel „Wysoka”
przy siedmiu obszarach z odpowiedzią
```

**Liczbę bierzesz Z MODELU, nigdy z PDF-a ani ze zrzutu strony.** PDF jest ilustracją, model jest
dowodem. (PDF-y dyżuru 339 powstały dodatkowo przez LibreOffice, a nie natywnie przez produkt —
to kolejny powód, żeby nie traktować ich jako źródła liczby.)

**(b) Imienna lista konsumentów `completionPercent`.** Wypisz każdy plik i linię. Dla tego, który
podaje liczbę modelowi językowemu, **wklej do raportu dosłowne zdanie kontekstu**, jakie dostaje
narrator na tej sesji.

**(c) Arytmetyka kłamstwa, pokazana wprost.** Ile obszarów ma `actual > 0`, ile `target > 0`, i
dlaczego alternatywa w warunku daje zawsze mianownik równy licznikowi.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: RAPORT NIGDY NIE TWIERDZI WIĘCEJ, NIŻ WIE

**To jest powód, dla którego ten dyżur ma etykietę P0.** Dokument doradczy, który sam o sobie
mówi, że jest kompletny w 100%, gdy ma jedną piątą odpowiedzi, jest **nieprawdą oddaną klientowi
na piśmie**.

Wymagania, w kolejności rozstrzygającej:

1. **Kompletność liczy OBSZARY Z ODPOWIEDZIĄ.** Cel wpisany przez paczkę metodyki nie jest
   odpowiedzią i nie może podnosić licznika. Jeżeli uznasz, że „obszar z celem” też warto pokazać
   — pokazujesz go **jako osobną liczbę z własną etykietą**, nigdy jako kompletność.
2. **Naprawiasz OBA pliki modelu w tym samym commicie** — serwerowy i frontowy. Sprawdzasz to
   komendą z `B.4.5`.
3. **Naprawiasz wszystkich konsumentów z `R1`.** Jeżeli zostawisz `100%` w zdaniu podawanym
   narratorowi, proza dalej będzie opisywać ocenę jako kompletną, choćby okładka mówiła prawdę.
4. **Karta wiarygodności zostaje na okładce.** Ukrycie metryki nie jest naprawą (`Z40`).
5. **Etykieta wiarygodności ma odpowiadać nowej liczbie** — przy 18% nie może brzmieć „Wysoka”.

**Dowód wymagany, w tej kolejności:**

- **na sesji 7/39**: kompletność **18%** (7 z 39, zaokrąglone), obszary **7/39**, wiarygodność
  **„Niska”** wg zastanych progów — podaj swoje wartości, nie moje;
- **na sesji 39/39**: kompletność **100%**, obszary **39/39**, wiarygodność **„Wysoka”** —
  czyli poprawiony licznik **nie psuje przypadku pełnej sesji**;
- **dowód mutacyjny wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`), w obie strony:
  przywróć alternatywę `actual > 0 || target > 0` → test **CZERWONY**; cofnij przez `cp`
  z kopii w katalogu scratch (`Z27`, **nigdy `git stash`**) → **ZIELONY**; `git diff` po
  cofnięciu **pusty**;
- **druga mutacja, kontrolna:** zostaw poprawiony licznik, ale przywróć `100%` w zdaniu podawanym
  narratorowi → test ma **CZERWIENIĆ**. Jeżeli przechodzi, Twój test broni okładki, a nie
  dokumentu, i pozycja jest **NIEZROBIONA**.

Prawo zatrzymania po tej pozycji.

## R3 — SILNIK 298: ETYKIETA „DEMO UKŁADU” I PRZYRZĄD, KTÓRY PRZESTAJE PRODUKOWAĆ HYBRYDY

**Zacznij od sprostowania, nie od kodu.** Proza „TechProd Manufacturing” **nie jest w silniku** —
`buildAcceptedDrdReportModel` dostaje `META`/`OSIE`/`WNIOSKI` na wejściu i przelicza wyłącznie
liczby. Wstrzyknął ją **skrypt porównawczy**. Zweryfikuj to sam (`B.3`, wiersz 7) i zapisz wynik.

Produkty pozycji:

1. **Etykieta.** Każdy artefakt mieszający prozę prototypu z liczbami realnej sesji dostaje
   **widoczną etykietę na pierwszej stronie**: „DEMO UKŁADU — treść prototypowa, liczby z sesji
   `<id>`”. Nie jako komentarz w manifeście — **na stronie**, bo to strona trafia do człowieka.
2. **Parametryzacja przyrządu.** Skrypt przestaje domyślnie pisać do katalogu artefaktów
   i dowodów **dyżuru 339**. ★ Uruchomienie go dziś bez zmian **nadpisze cudze dowody w repo** —
   sprawdź to, zanim go uruchomisz, i napisz w raporcie, którą drogą poszedłeś (parametryzacja
   opt-in czy kopia w katalogu scratch).
3. **Sprostowanie w rejestrze.** Jedno zdanie: skąd naprawdę pochodzi proza w `03-silnik-298.pdf`.

**Czego NIE robisz:** nie dopisujesz silnikowi 298 wołacza produkcyjnego (`Z40`), nie zmieniasz
zaakceptowanego prototypu, nie kasujesz artefaktów dyżuru 339.

Prawo zatrzymania po tej pozycji.

## R4 — RDZEŃ: PORÓWNANIE TRZECH SILNIKÓW POWTÓRZONE NA SESJI 39/39

**Dlaczego to jest rdzeń, a nie dodatek.** Porównanie na sesji 7/39 **systematycznie karze silnik
uczciwy** (148 jawnych braków, bo braki są prawdziwe) i **nagradza silnik 298** (0 braków, bo jego
proza nie zależy od sesji). Rekomendacja „298 najbliżej prototypu” jest w tym pomiarze
**artefaktem rzadkości danych**. Decyzja właściciela o silniku raportu nie może stać na takim
pomiarze.

Wymagania:

1. **Sesja z odpowiedziami na wszystkie 39 obszarów**, założona **na Twojej bazie i Twoim porcie**
   (`cx346`, `6393`), nigdy na cudzej. Dane demo są twarzą produktu — sprzątasz po sobie
   (`docker rm -fv`), a w raporcie podajesz identyfikator sesji i sposób jej utworzenia.
2. **Trzy raporty tymi samymi trzema silnikami**, z Twojego sparametryzowanego przelotu, do
   **Twojego** katalogu dowodów.
3. **Tabela porównawcza**: silnik · stron · jawnych braków · kompletność · czas generowania ·
   zgodność z zaakceptowanym prototypem 21 stron. **Każda liczba z komendą.**
4. **Jawne wskazanie, które różnice z pomiaru 7/39 zniknęły po dosypaniu danych, a które zostały.**
   To jest właściwa treść tej pozycji: **co było własnością silnika, a co własnością rzadkości
   danych**.
5. Nie podłączasz i nie wygaszasz żadnego silnika (`Z40`).

**Jeżeli nie zdołasz założyć sesji 39/39** — to jest **STOP MERYTORYCZNY z briefem**, pełnowartościowy
wynik pozycji: opisujesz, czego zabrakło, i podajesz, ile pracy potrzeba. **Nie zastępujesz tego
pomiarem na sesji 7/39 z adnotacją „przybliżenie”.**

Prawo zatrzymania po tej pozycji.

## R5 — REKOMENDACJA DLA WŁAŚCICIELA, OPARTA NA `R4`

Nowa sekcja rejestru z rekomendacją: **który silnik, dlaczego, czego brakuje, jaki jest następny
krok**. Obowiązkowo:

- **jawnie napisane, czy i jak Twoja rekomendacja zmienia rekomendację `R7` dyżuru 339** („wybrać
  model 298 jako docelowy kontrakt układu, ale nie podłączać go w obecnej postaci”) — i dlaczego;
- **zastanej sekcji `R7` nie kasujesz i nie przeredagowujesz** (`Z14`, `Z32`); Twoja sekcja stoi
  obok i mówi, co ją zastępuje;
- wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
  samodzielnie”**. Wpis bez tego zdania liczy się jako nierozstrzygnięty.

**Nie podejmujesz decyzji o podłączeniu silnika.** `DEC-389` oddał wybór nadzorcy **po pomiarze**;
Twoim produktem jest pomiar i rekomendacja, nie fakt dokonany.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: trzy wartości z modelu przed naprawą i po (`R1`, `R2`); imienna
lista konsumentów `completionPercent` z dosłownym zdaniem podawanym narratorowi; **oba dowody
mutacyjne z `R2` dosłownie, z komendami i wynikami**; sprostowanie pochodzenia prozy silnika 298
z `R3`; tabela porównawcza z `R4` z identyfikatorem sesji i sumami `shasum -a 256` artefaktów;
rekomendacja z `R5`; sekcja **TWIERDZENIA NIEZWERYFIKOWANE** niepusta.

**W sekcji „TWIERDZENIA NIEZWERYFIKOWANE” wymień co najmniej:** zachowanie narratora z realnie
skonfigurowanym kluczem dostawcy (klucza nie wolno Ci mieć), zachowanie produkcyjnej trasy HTML po
włączeniu flagi ujawniania, oraz to, czy PDF generowany natywnie przez produkt wygląda tak samo
jak Twój kontrolny z LibreOffice.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione, R3 rozpoczęte, R4-R5 nietknięte”
jest pełnowartościowym wynikiem — o ile R1 stoi na liczbach z modelu, a R2 na **obu** dowodach
mutacyjnych i na **obu** plikach modelu.

**Odwrotna kolejność — porównanie silników (R4) zrobione, a licznik kompletności dalej kłamie —
jest podstawą odrzucenia.** Porównywanie silników, z których każdy drukuje klientowi nieprawdę
o kompletności, mierzy nie to, co trzeba.

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `6a4919f72d`; zero `BRAK`. Katalog tymczasowy dyżuru 339 opisany jako mogący zniknąć, z działaniem zastępczym |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — każdy wiersz „tylko odczyt” ma rzeczownik-produkt (diff · brief · kontrakt · errata · opis) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; model raportu buduje się bez wchodzenia w trasę |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (343, 344, 345 oraz 347-350) | TAK — `B.4.4`; porty 5533/6393 zmierzone jako wolne, kontener i gałąź nie istnieją |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (trzy) | TAK — `§0.2e` punkt (e) |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru” bez ścieżki | TAK; cytaty decyzji z identyfikatorem `DEC-…` i ścieżką pliku |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z15` „zero modelu językowego” **vs** `DEC-390` „narrator ZOSTAJE włączony” i `R2` dotyka zdania podawanego narratorowi | `R2` punkt 3 — **nie wołasz modelu**; zmieniasz wyłącznie TEKST KONTEKSTU składany deterministycznie przed wywołaniem. Żaden pomiar tego dyżuru nie przechodzi przez `llmService` ani `/api/ai/**`, a klucza dostawcy nie wolno Ci mieć |
| `DEC-390` „nie wyłączaj narratora” **vs** „narrator dostaje fałszywą liczbę” | `R2` punkt 3 — naprawą jest **prawdziwa liczba w kontekście**, nie wyłączenie narratora |
| Zakaz `Z10` „zero nowych flag” **vs** naprawa dotyka ścieżki za flagą ujawniania | `Z10` (pole wyjątku) — **żadnej nowej flagi**; `isDrdReportEnabled` i `drdHttpSourceOfTruthV1` zostają z wartościami domyślnymi OFF |
| Zakaz `Z40` „nie podłączaj i nie wygaszaj silnika” **vs** `R4` uruchamia trzy silniki | `R4` punkt 5 — uruchamiasz je **w przyrządzie pomiarowym**, nie dopisując wołacza produkcyjnego ani nie zmieniając montażu tras |
| Zakaz `Z40` „nie zmieniaj struktury zaakceptowanego prototypu” **vs** `R3` dokłada etykietę | `R3` punkt 1 — etykietę dostaje **artefakt porównawczy** produkowany przez przyrząd, nie zaakceptowany prototyp 21 stron, który jest tylko do odczytu |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument” **vs** `R1`/`R3`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument”) — raport + jeden imiennie wskazany, **zastany** rejestr, do którego wyłącznie dopisujesz sekcję |
| Zakaz `Z14` „nie ruszasz cudzych zapisów decyzyjnych” **vs** `R5` zmienia rekomendację `R7` dyżuru 339 | `R5` — Twoja sekcja **stoi obok** i mówi, co zastępuje; zastana sekcja `R7` zostaje nietknięta |
| Zakaz `Z26`/`Z30` „zero wysyłki i zero danych testowych w produkcie” **vs** `R4` zakłada sesję z 39 odpowiedziami | `R4` punkt 1 — sesję zakładasz **na własnej bazie `cx346` na porcie `6393`**, nigdy na demo, staging ani produkcji; po pomiarze `docker rm -fv` |
| Zakaz `Z18` „infra testowa tylko do odczytu” **vs** testy serwerowe wymagają własnego configu | `B.1`, wiersz „infra testowa” — używasz `--config server/vitest.config.ts` i kompletu zmiennych **w linii komendy**; pliku nie zmieniasz. `No test files found` to **błąd komendy, nie PASS** |
| „Dowody dyżuru 339 są punktem odniesienia” **vs** leżą w katalogu tymczasowym i skrypt je nadpisuje | `§0.2e` i `R3` punkt 2 — `ls` na katalogu jest pierwszą komendą; przyrząd parametryzujesz albo kopiujesz do scratcha; Twoje artefakty idą do osobnego katalogu dowodów |

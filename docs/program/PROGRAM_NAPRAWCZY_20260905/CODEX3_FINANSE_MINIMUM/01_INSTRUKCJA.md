# INSTRUKCJA — Codex — „FINANSE MINIMUM DO MVP (F‑M2/M3/M4/M6/M7)"

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
> **wyłącznie** `/Users/piotrwisniewski/Developer/codex-wt/codex3-finanse`.
>
> **★★ DRUGI ZAKAZ MIEJSCA (08.09, incydent realny): NIE PRACUJESZ W `/private/tmp`.**
> Restart maszyny 08.09 wyczyścił `/private/tmp` i skasował worktree, sekrety
> i zrzuty sześciu wykonawców naraz. Twój worktree i wszystkie katalogi
> pomocnicze mają leżeć pod `/Users/piotrwisniewski/Developer/`, nie w `/private/tmp`.
>
> **★★ TRZECI ZAKAZ MIEJSCA (właściwy temu blokowi): wklejki w dokumencie F1
> każą zakładać worktree w `/private/tmp/f-m2`, `/private/tmp/f-m3` itd.
> TE WKLEJKI SĄ NIEAKTUALNE.** F1 powstał 05.09, przed incydentem z 08.09.
> Obowiązuje `§0.1` tego dokumentu, nie wklejki `§11` z F1.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `<<MARKER_SHA>>`**
> **Gałąź bazowa: `origin/integracja/20260911`** (w vaulcie; to jest linia
> integracyjna na dzień 2026-09-11). **NIE `origin/staging`, NIE `origin/demo`,
> NIE `Londyn`.** Wklejki w F1 mówią `origin/staging` — **są nieaktualne**,
> obowiązuje ta ramka.
> **Stan dokumentu: PROJEKT — czeka na wpisanie markera i podpis CTO**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo napis `MARKER_SHA` w nawiasach kątowych —
> **dokument nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-10.
Autor zlecenia: nadzorca sesji głównej (CTO), w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**. Język kodu, identyfikatorów, komentarzy
w kodzie i napisów w interfejsie: **angielski** (`DEC-461`); polskie napisy
wchodzą wyłącznie przez `public/locales/pl/translation.json`.
Zakres: **`10_FINANCE` — MINIMUM MVP wg `F1`, paczki `F‑M2`, `F‑M3`, `F‑M4`,
`F‑M6`, `F‑M7`, warstwa MECHANIKI TYLNEJ.**
Pozycja programu: pojemnik 2, pozycja **2.6 „Finanse wg decyzji"**
(`docs/program/TRZY_POJEMNIKI_PRACY_20260906.md:101`), kryterium gotowości
nr 6 (`:88`): *„Finanse: jeśli decyzja «MINIMUM do MVP» → F‑M2/M3/M4/M6/M7
wykonane (F1); jeśli «poza» → moduł ukryty za jawnym «wkrótce», nie za flagą
w ciszy."*
Decyzja właściciela: **`DEC-399`, 06.09 ~08:00**
(`docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md:54`).
Źródło zakresu: `docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md`
(1420 linii; paczki `F‑M2` `:202`, `F‑M3` `:300`, `F‑M4` `:413`, `F‑M6` `:639`,
`F‑M7` `:724`). **Czytasz F1 z repo, nie z tego dokumentu — tu jest tylko
wyciąg i korekty.**
Trasy front: `/finance` (`src/components/Economics/FinanceHub.tsx`), karta
sprawozdania (`src/components/Finance/statementPackWorkspaceV2/**`).
Trasy tył: `/api/v8/finance-v2/**`
(`server/src/routes/v8/finance-v2/{versions,models,crosscutting,statements}.routes.ts`).

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/Users/piotrwisniewski/Developer/codex-wt/codex3-finanse
MARKER=<<MARKER_SHA>>

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego bloku
df -h /

# (1) fetch WYLACZNIE z `origin` (ODCZYT). NIGDY `--all` (remote `icloud-source`
#     jest martwy), NIGDY `git push origin` (Z1). Baza tego bloku zyje na
#     `origin/integracja/20260911`.
git -C "$VAULT" fetch origin --prune

# (2) marker — warunek rodowodu
git -C "$VAULT" log --oneline -25 origin/integracja/20260911
git -C "$VAULT" merge-base --is-ancestor "$MARKER" origin/integracja/20260911 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZYSZ GO SAM, Z VAULTA, w ~/Developer/codex-wt
mkdir -p /Users/piotrwisniewski/Developer/codex-wt
git -C "$VAULT" worktree add "$WT" -b codex/finanse-minimum-20260911 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/codex3-finanse/config.worktree"
cat "$VAULT/worktrees/codex3-finanse/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13) — i POZA /private/tmp
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex3-scratch
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `origin` (żywy — **stąd fetch, ale NIGDY push**),
> `github-backup` (żywy, kopia zapasowa) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ KONTROLA BAZY PO WŁASNYCH COMMITACH (poprawka z dyżuru 133).**
„`git log -1` ma pokazać marker" jest prawdziwe **tylko przy pierwszym
uruchomieniu**. Po Twoim pierwszym commicie poprawna kontrola brzmi:

```bash
git -C "$WT" merge-base --is-ancestor "$MARKER" HEAD \
  && echo "BAZA OK — marker jest przodkiem HEAD" \
  || echo "MARKER BRAK — STOP"
```

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całości**. Nie improwizujesz bazy: nie startujesz z `origin/demo`, `Londyn`,
`origin/staging`, `main` ani z gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline <<MARKER_SHA>>..origin/integracja/20260911
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie pracy: ZAKAZANY** (`Z3`).

**★★ ROZSTRZYGNIĘCIE `Z34a` KONTRA „NIE PUSHUJESZ" (wymagane przez szkielet
`docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`):**
**w TYM bloku NIE PUSHUJESZ NIC I NIGDZIE.** Twoja gałąź żyje we wspólnym
vaulcie, więc nadzorca ma do niej dostęp bez pushu. Commitujesz po każdym
etapie (`E1`…`E7`), a push i scalenie wykonuje wyłącznie nadzorca po odbiorze.
Wiersz `Z34a` w tabeli zakazów zostaje w dokumencie dla ciągłości numeracji,
ale **w tym bloku jest wyłączony tym akapitem**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only <<MARKER_SHA>>..HEAD
```

---

### 0.1a. ★★ WERYFIKACJA STANU WEJŚCIOWEGO — DWANAŚCIE KOMEND, WSZYSTKIE OBOWIĄZKOWE

Każda ma podany **wynik autora instrukcji**; rozbieżność idzie do „Korekt wobec
instrukcji", **nie do improwizacji**. **Twój pomiar jest wiążący, nie mój.**

```bash
cd "$WT"

# (1) ★★★ F-M2 RDZEN: ile klas crimson w Finansach.
grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" \
  | grep -v __tests__ | grep -vE "^\S+:[0-9]+:\s*(\*|//)" | wc -l
#   moj wynik na markerze: 34. Rozklad po plikach:
#   ExportToOutputDialog 12, AIRecommendationsPanel 7, VersionHistoryPanel 5,
#   FinanceLanePanel 3, ExportButton 2, EvidencePanel 2,
#   StatementExplainPanel 1, FinancialModelWorkspace 1, FinanceVersionTimeline 1.

# (2) ★★★ F-M2 RDZEN: ile nieoznaczonych <table>.
grep -rn "<table" src/components/Finance src/components/Economics --include="*.tsx" \
  | grep -v __tests__ | grep -v "§27-exempt" | wc -l
#   moj wynik: 14. ★ UWAGA: F1 §2 pisze „13", ale WYLICZA 14 pozycji —
#   to blad arytmetyczny w F1, nie rozjazd Twojego pomiaru. Wiazacy jest Twoj.

# (3) F-M1 (zaleznosc F-M3/F-M4) — czy slownik enumow ISTNIEJE
ls -l src/components/Finance/labels/financeEnums.ts
#   moj wynik: plik istnieje. F-M1 = SCALONE (01_INDEKS_I_HARMONOGRAM.md:19).

# (4) F-M5 (zaleznosc F-M6) — czy producent kalendarza i okresow ISTNIEJE
grep -rn "INSERT INTO finance_stmt_periods\|INSERT INTO finance_stmt_calendars" server/src \
  | grep -v __tests__ | grep -v "/scripts/"
#   moj wynik: DWA trafienia, oba w
#   server/src/services/finance/canonical/financeCalendarService.ts (:221, :344).
#   F-M5 = ZROBIONE. ★ To OBALA zdanie z F1 §F-M5 §3 („zero INSERT-ow") —
#   ono opisywalo stan z 05.09, nie dzisiejszy.

# (5) ★★★ F-M6 RDZEN: czy akcja `approve` w ogole przechodzi przez `/transitions`
grep -n "ROUTABLE_ACTIONS" -A 12 server/src/routes/v8/finance-v2/versions.routes.ts | head -20
#   moj wynik: lista NIE zawiera `approve` ani `reopen` (:33-42); komunikat bledu
#   mowi wprost „approve/reopen use POST /models/:modelId/{approve,reopen}".
#   ★ To PRECYZUJE F1 §F-M6 §3: endpoint istnieje, ale POD INNA SCIEZKA.

# (6) F-M6: czy karta pakietu ma podpiete akcje cyklu zycia
grep -n "approveFinanceModel\|reopenFinanceModel\|transitionFinanceVersion" \
  src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx
#   moj wynik: fetchers SA podpiete (:167 submit_for_review, :196 approveModel,
#   :198 reopenModel). Czy renderuje sie PRZYCISK — NIE ZMIERZYLEM. To E2 krok 1.
grep -n "submit_for_review\|approve" src/components/Finance/shared/FinanceWorkspaceBar.tsx
#   moj wynik: ZERO akcji cyklu zycia w pasku (jedyne trafienie to tekst bledu :319).

# (7) ★★★ F-M3 RDZEN: czy rodowod ma odczyt ZBIORCZY (wielu bv naraz)
grep -n "router\.\(get\|post\)" server/src/routes/v8/finance-v2/crosscutting.routes.ts
#   moj wynik: `GET /versions/:businessVersionId/lineage` (:39) — POJEDYNCZY.
#   ZERO odczytu zbiorczego. To jest praca backendowa, ktorej F1 §F-M3 §8 kazal
#   sie domagac STOP-em. W TYM BLOKU JA WYKONUJESZ (E3).

# (8) ★★★ F-M4 RDZEN: czy karta sprawozdania stoi na powloce artefaktu
grep -c "ArtifactRightPanel\|<aside" src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx
#   moj wynik: 0. Powloki NIE MA.
grep -rn "StatementPackWorkspaceV2\|FinanceV3StatementPackWorkspace" \
  src/components/Economics/FinanceHub.tsx | head
#   moj wynik: lazy :212, RENDER :322 i :3581 (za `financeV3StatementPackFlag.enabled`,
#   domyslnie ON). Czyli to JEST zywy ekran, nie martwy kod.

# (9) F-M7: czy dane pokazowe Finansow to CD PROJEKT czy DBR77
grep -rn "CD PROJEKT" docs/program/TRZY_POJEMNIKI_PRACY_20260906.md | head -3
ls -l server/scripts/finance-seed-cdprojekt.ts server/scripts/data/cdprojekt-2025.json
#   moj wynik: pliki istnieja; `TRZY_POJEMNIKI_PRACY_20260906.md:31` i `:114` mowia
#   „dane pokazowe = DBR77 (Wyniki) + CD PROJEKT (Finanse)".
#   ★ To ZASTEPUJE F1 §F-M7, ktory kaze budowac komplet na DBR77 — patrz KOREKTA K-7.

# (10) ciche polkniecia bledow w Finansach (Z45)
grep -rn "catch(() => {})" src/components/Finance src/components/Economics \
  server/src/services/finance server/src/routes/v8/finance-v2 | grep -v __tests__ | wc -l
#   moj wynik: 7. NIE MASZ ZADANIA ich sprzatac — masz ZAKAZ dodawania nowych
#   i OBOWIAZEK wypisania tych 7 w raporcie (plik:linia).

# (11) czy Finanse sa modulem ZAMROZONYM
bash scripts/mvp-final/check-freeze.sh --pliki src/components/Economics/FinanceHub.tsx \
  src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx \
  --komunikat="proba" ; echo "EXIT=$?"
#   moj wynik: EXIT=0, zero komunikatow. W `docs/program/MVP_FINAL_ZAMROZONE.json`
#   NIE MA klucza `10_FINANCE`. ★ Wniosek: znaczniki [ODMROZENIE ...] NIE SA
#   wymagane. Sprawdz to SAM przed pierwszym commitem — jesli EXIT != 0,
#   przeczytaj §0.6 i dopisz znacznik, ktory wskaze skrypt.

# (12) zasoby wylaczne: porty, kontener, przedzial migracji
lsof -nP -iTCP -sTCP:LISTEN | grep -E ":6453|:5593" || echo "PORTY WOLNE"
docker ps -a --format '{{.Names}}' | grep cx-codex3 || echo "BRAK KONTENERA"
ls server/migrations | grep -cE "^2026215[0-9]"
#   moj wynik: PORTY WOLNE; BRAK KONTENERA; 0 zajetych w 20262150-20262159.
#   Najwyzszy zajety numer migracji w repo: 20262107.
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` i zapisz do artefaktów plik `przed-nazwy.txt` — po jednej
   PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (Twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (`Z37`).
4. Przepisanie liczby z tej instrukcji, cudzego raportu albo rejestru =
   zawyżenie i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

**★ Uwaga właściwa temu blokowi.** Na markerze w `src/components/Finance`
i `src/components/Economics` istnieją **testy zastane, które padają** (pomiar
z 05.09 przy `F‑M1`: **27 failed**, `01_INDEKS_I_HARMONOGRAM.md:19`).
**Nie naprawiasz ich i nie liczysz jako swojej regresji** — masz je zmierzyć
w `przed-nazwy.txt` i wypisać imiennie w raporcie, żeby nikt nie policzył
cudzego długu na Twoje konto. **`Z43`: nie wolno Ci też ich „przybić" testem
akceptującym dzisiejszy zły stan.**

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z46`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push`** — na żaden remote, na żadną gałąź. `git fetch origin` (ODCZYT) jest dozwolony i wymagany w `§0.1` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz** `origin/demo`, `Londyn`, `origin/staging`, `origin/integracja/20260911` ani żadnej cudzej gałęzi `codex/*`, `mvp/*`, `fix/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i jawnie zamówiony** | Cudze tory w toku — 10/11.09 biegło równolegle kilkanaście stanowisk |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie pracy | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/Users/piotrwisniewski/Developer/wt/**`, `/Users/piotrwisniewski/Developer/codex-wt/**` (poza swoim) ani `/private/tmp/**`. **Wyjątek: katalogi, które SAM zakładasz w `§0.1`** | 10.09 żyło 26 równoległych worktree; 09.09 skasowano stanowisko ŻYWEGO robotnika |
| `Z7` | **★★ Twój JEDYNY port bazy to `6453`. Twój JEDYNY port harnessu to `5593`.** Nazwa kontenera: **`cx-codex3-pg`**. **ZAKAZANE porty (zajęte, zmierzone 10.09): `5432`, `5433`, `6012`, `6451`, `6472`, `54418`, `55441`, `55461`.** Sprawdzasz sam przed startem (`§0.1a` komenda 12) | Trzy incydenty zapisu do cudzej bazy |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego bloku** — nigdy demo, staging, produkcja ani cudza retained-DB. **W tym bloku ma to ostrze: `consultify-pg18` na porcie `54418` trzyma KOPIĘ stagingu i NIE JEST TWÓJ** | Demo i staging mają dziś OSOBNE bazy, obie żywe, obie poza Twoim zasięgiem |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi**, poza JEDNĄ jawnie zamówioną: **`VITE_FINANCE_MINIMUM`, default OFF** (`E3`/`E4`/`E5`) | Krach 07-12: masowe włączenie flag wizualnych na żywo (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Ten blok **nie tworzy żadnego nowego ekranu**. Każdy przewód do istniejącego ekranu idzie za `VITE_FINANCE_MINIMUM` = OFF. **Zrzuty, prototyp i akcept właściciela robią robotnicy wewnętrzni PO Tobie — nie Ty** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym; załamanie 07-11 |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `src/utils/betaMenuStatus.ts`, `server/src/sharedRuntime/utils/betaMenuStatus.ts` | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/98_RAPORT.md`. **Zrzuty, logi, manifesty i pliki wynikowe NIE wchodzą do repo** — leżą w `/Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym bloku.** Żaden pomiar, strażnik, migracja ani test nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`.** **W tym bloku wprost: pusta tabela sprawozdania przed zmapowaniem linii jest stanem POPRAWNYM — masz ją opisać, nie wypełnić zerami** (`F1 §F‑M4 §5`) | Uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego bloku** — z imiennymi licencjami z tabeli licencji | Rozłączność ze stanowiskami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `playwright.config.ts`, `playwright.smoke.config.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO bloku, W TEJ SAMEJ LINII komendy.** Kolejność wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. **W tym bloku szczególnie: odczyt zbiorczy rodowodu (`E3`) NIE MOŻE zwracać pustej listy, gdy zapytanie padło — ma zwrócić błąd** | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie | Liczby autora instrukcji krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener** na porcie `6453` | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` **cały `/api/v8/finance-v2/**` daje `404` PRZED uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci.** Stan odkładasz przez `cp` do `codex3-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do kontenera innego niż **Twój** `cx-codex3-pg`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY blok.** „Przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it` | Test „403 dla obcej roli" leczy się skutkiem własnego ataku i raportuje `PASS` |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie** protokół `§0.2b` | Wysłany e-mail jest **nieodwracalny** |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW** | Dyżur 43 przypiął strażnik do swojej bazy: 30 przypadków stało się trwałym `SKIP` |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`) | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2e` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 zmierzono kompletny łańcuch, a każdy realny `POST` zwracał `500` |
| `Z34a` | **WYŁĄCZONY W TYM BLOKU** — patrz `§0.1`: nie pushujesz nic i nigdzie | Numeracja `Z` jest wspólna dla wszystkich instrukcji |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów, `--max-warnings`, `continue-on-error: true`. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem** | To choroba, którą program leczy |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu** | Autofix skasowałby pracę **wszystkich** równoległych stanowisk |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | **★★ ZAKAZ WŁAŚCIWY TEMU BLOKOWI: NIE KASUJESZ ANI NIE PRZEMIANOWUJESZ ŻADNEJ TABELI `finance_*`, `financial_*` ANI ICH WIERSZY.** Migracje są **wyłącznie addytywne**: zero `DROP`, zero `RENAME`, zero `DELETE` na danych, zero `TRUNCATE`, zero modyfikacji **istniejących** plików w `server/migrations/**` | 09.09 czystka „sierot" skasowała 319 wierszy konfiguracji produktu — po niej **każde tworzenie inicjatywy zwracało `500`**. Krawędzie `finance_lineage_edges` są **append-only** i nie da się ich odtworzyć (`F1 §F‑M7 §3`) |
| `Z41` | **★★ NAZWA BAZY I HOST ZAWSZE PARAMETREM, NIGDY NA SZTYWNO W KODZIE.** Każdy skrypt danych, migracja pomocnicza i test, który dotyka bazy, przyjmuje `DATABASE_URL` (albo `--baza=`) z linii komendy i **odmawia startu, gdy go nie dostanie**. Zakaz literału `consultify_staging_1009`, `trolley`, `thomas`, `postgres` jako domyślnej bazy w jakimkolwiek pliku, który commitujesz | Skrypt z przybitą nazwą bazy trafia potem na cudze środowisko; `health gitSha` przez dwa miesiące pokazywał wartość z ręcznej zmiennej, bo była wpisana na sztywno |
| `Z42` | **★★ MANIFEST POWSTAJE WYŁĄCZNIE W TRYBIE `--apply`, NIGDY W `--dry-run`.** Tryb suchy nie zapisuje żadnego pliku manifestu, nie tworzy katalogu i nie nadpisuje starego manifestu. **Manifest bez odpowiadającego mu zapisu w bazie jest fałszywym dowodem cofnięcia** | Manifest z suchego przebiegu wyglądał jak dowód wykonanej migracji; „dowód poza repo wyparował" — bramka trzymała PASS na manifeście, którego już nie było |
| `Z43` | **★★ ZAKAZ PISANIA TESTU, KTÓRY PRZYBIJA STAN ZASTANY JAKO POPRAWNY.** Test charakteryzujący dzisiejszy zły stan pisze się jako **CZERWONY z założenia** (`it.fails` albo jawny nagłówek `// CZERWONY Z ZAŁOŻENIA`), nigdy jako zielona asercja `expect(x).toBe(<dzisiejsza zła wartość>)`. Dotyczy zwłaszcza 27 zastanych `failed` w Finansach i 14 nieoznaczonych `<table>` | Zielony test na złym stanie zamienia dług w „kontrakt" i blokuje naprawę na zawsze |
| `Z44` | **★★ AKAPIT `§0.2e` JEST OBOWIĄZKOWY DLA KAŻDEGO PAKIETU TESTÓW UŻYTEGO JAKO DOWÓD.** Pomiar bez tego akapitu **nie liczy się jako dowód** i etap wraca do poprawki | Zielona suita bez wskazania omijanej pułapki to najczęstszy kształt fałszywego „gotowe" |
| `Z45` | **★★ ZERO NOWYCH `.catch(() => {})`, `.catch(() => null)`, `try {} catch {}` bez treści i `void promise` bez obsługi błędu.** Na markerze w Finansach jest ich **7** — **nie sprzątasz ich**, ale **wypisujesz w raporcie z plik:linia**, a każdy nowy jest podstawą odrzucenia etapu | Ciche połknięcie błędu było przyczyną „podgląd wywala się na ErrorBoundary przy zielonym tsc" (`J9`, 09.09) |
| `Z46` | **★★ KAŻDY NOWY KLUCZ i18n POWSTAJE W PARZE EN+PL, W TYM SAMYM COMMICIE.** Klucz obecny w `pl` z angielską wartością **nie jest przetłumaczony**; klucz obecny tylko w `en` renderuje się jako surowy klucz. Zakaz literałów po polsku w `.tsx`/`.ts` — polski wchodzi wyłącznie przez `public/locales/pl/translation.json` (`DEC-461`) | 18. kształt fałszywego „gotowe": klucz istnieje ≠ przetłumaczony; 33 klucze EN widoczne jako surowy klucz (`J-DOG-B`, 09.09) |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **NIE SZUKAJ flagi `ENABLE_LIVE_EMAIL`. Ona NIE ISTNIEJE** — to fantom
  powielany w starych instrukcjach. Realny warunek wysyłki: `emailService.ts`
  (ok. `:202`) tworzy transporter dopiero, gdy zobaczy **jednocześnie**
  `smtpConfig.host` i `smtpConfig.auth.user`, sklejone **najpierw z tabeli
  `settings`**, dopiero potem ze zmiennych środowiskowych;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM` gdziekolwiek;
- wstawić wiersza konfiguracji SMTP do tabeli `settings` w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` — tam startują drenaże outboxów;
- wywołać ręcznie `drain*` / `startNotificationOutboxDrainCron` / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek zapisującego:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex3-finanse

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY.
docker exec cx-codex3-pg psql -U postgres -d cx_codex3_finanse \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad.

# (c) zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" \
  server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) ★★ DODATKOWY DOWÓD WŁAŚCIWY TEMU BLOKOWI.** Zatwierdzenie wersji
biznesowej (`E2`) produkuje zdarzenia świeżości i potrafi dopisać wiersze do
outboxu. **Po `E2` i po `E6` raport ma zawierać wynik:**

```bash
docker exec cx-codex3-pg psql -U postgres -d cx_codex3_finanse -Atc \
  "SELECT count(*) FROM ie_outbox_delivery_receipts;"
#   oczekiwane: 0 — zdarzenia moga LEZEC w outboxie, ale NIC nie zostalo doreczone.
```

**(4) Deklaracja obowiązkowa w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego bloku nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. `ie_outbox_delivery_receipts` po przebiegach ma 0
wierszy. Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie nie zostało
wysłane."**

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex3-finanse

docker run -d --name cx-codex3-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_codex3_finanse \
  -p 127.0.0.1:6453:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-codex3-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6453/cx_codex3_finanse \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6453/cx_codex3_finanse \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK.
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**★ PUŁAPKA WŁAŚCIWA TEMU BLOKOWI (`migracja-przyrostowa-nie-jest-dowodem`):**
Twoje nowe migracje w przedziale `20262150`–`20262159` uruchamiają się
**alfabetycznie po** wszystkich istniejących. Jeżeli Twoja migracja czyta
kolumnę, którą dodaje inna migracja o **wyższym** numerze — łańcuch wywróci się
na świeżej bazie, choć na Twojej „przyrostowej" przejdzie. **Dlatego oba
przebiegi robisz na ŚWIEŻYM kontenerze, nie na dosypanej bazie.**

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex3-finanse && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6453/cx_codex3_finanse \
JWT_SECRET=codex3-finanse-lokalny-sekret-testowy \
npx vitest run --config server/vitest.config.ts <ŚCIEŻKI> --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty/<NAZWA>.json
```

**Uruchomienie `vitest` z roota bez właściwego configu daje `No test files found`
— a to NIE jest `PASS`.** Sprawdź, którego configu wymaga dana ścieżka,
i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (front, mockują `fetch`, nigdy nie otwierają
połączenia — np. `deriveStatementTable`, kontrakty kolumn):

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex3-finanse && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run <ŚCIEŻKI> --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty/<NAZWA>.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`.**
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy. **Atrapa `Database.ts:686` zwraca `changes:1` dla KAŻDEGO `UPDATE`, niezależnie od `WHERE` — Twój test „status zmienił się na APPROVED" przeszedłby na niej zawsze** |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | **CAŁY `/api/v8/finance-v2/**` daje fałszywe `404` PRZED uwierzytelnieniem.** To jest pułapka numer jeden tego bloku |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — Twój dowód roli (`E2`) staje się bezwartościowy |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „obca rola nie może zatwierdzić" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE OGÓLNYCH + SIEDEM WŁASNYCH

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/codex3-finanse/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
2. **Remote `icloud-source` w vaulcie jest MARTWY.** Nie wołaj `git fetch --all`.
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`.** Każde zapytanie:
   `docker exec cx-codex3-pg psql -U postgres -d cx_codex3_finanse -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.**
5. **`vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** `DB_TYPE=postgres`
   musi stać **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że
   nadpisało** (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym
   `it` każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt.
   **W tym bloku dotyczy wprost kolumn `*_json` w `finance_*`** — nie parsuj drugi raz.
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** „CI zielone" nie jest w tym
   repo żadnym dowodem. Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest.** Używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów.**
    Liczby i nazwy czytasz z JSON-a, nie z kodu wyjścia.
11. **Nowe pliki w `tests/` wymagają `git add -f`.** Sprawdzasz `git status --short`
    po każdym commicie.
12. **`| head` na grepie produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy czytelnik"
    wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__` i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj przez `createRequire(REPO + '/package.json')`.
14. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
15. **`prettier` na wielkich plikach potrafi przepisać cały plik.** Wołasz
    `npx prettier --write <pliki>` wprost, tylko na plikach, które i tak zmieniasz.
    Reformat większy niż ~3× Twoje linie merytoryczne — **cofasz** (`cp`, nie `stash`).
16. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które asertują
    **dosłowne linie kodu**. Zapalony po Twoim reformacie = regresja reformatu.
17. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.
18. **`grep -rn … --include='*.ts'` w `zsh` potrafi zwrócić PUSTKĘ** zamiast wyników
    (`no matches found`). **Pustka nie jest wynikiem.** Albo cytuj wzorzec
    w apostrofach, albo używaj `grep -rn … server/src` bez `--include` i filtruj potokiem.

**SIEDEM PUŁAPEK WŁASNYCH TEGO BLOKU (zmierzone, nie założone):**

19. **`src/components/Finance` i `src/components/Economics` to DWA katalogi
    jednego modułu.** Pliki Finansów leżą w obu i **F1 podaje część ścieżek
    błędnie**: `InitiativeBusinessCaseCard.tsx`, `BenefitsTrackingDashboard.tsx`,
    `ModelVersionHistory.tsx`, `FinancePreviewPanel.tsx`, `FinanceModelDocumentView.tsx`,
    `ValueLedgerPanel.tsx`, `ValueCapturePipelinePanel.tsx` leżą w **`Economics/`**
    (dwa ostatnie w `Economics/panels/`), nie w `Finance/`. **Każdy grep w tym
    bloku obejmuje OBA katalogi.**
20. **Numery linii w F1 są przesunięte o 1–3.** Zmierzone: `InitiativeBusinessCaseCard`
    F1 mówi `:227`, jest `:228`; `BenefitsTrackingDashboard` F1 `:377`, jest `:375`;
    `FinancePreviewPanel` F1 `:285,834`, jest `:298,877`; `ModelVersionHistory`
    F1 `:98,222`, jest `:99,223`. **Szukasz po wzorcu, nie po numerze linii.**
21. **Słownik stanów cyklu życia w F1 NIE ZGADZA SIĘ z kodem.** F1 §F‑M6 §6 pisze
    `DRAFT → READY_FOR_REVIEW → APPROVED`. Kod używa **`IN_REVIEW`**, nie
    `READY_FOR_REVIEW` (`models.routes.ts` szuka wersji w stanie `IN_REVIEW`
    przed zatwierdzeniem). **Zmierz sam listę dopuszczalnych stanów i wpisz do raportu.**
22. **`approve` NIE PRZECHODZI przez `/versions/:bv/transitions`.**
    `ROUTABLE_ACTIONS` (`versions.routes.ts:33-42`) zawiera
    `submit_for_review, withdraw, start_review, request_changes, resume_editing,
    archive, invalidate` — **bez `approve` i `reopen`**. Te dwa idą przez
    `POST /models/:modelId/approve` (`models.routes.ts:105`), które mimo nazwy
    przyjmuje **dowolny `artifactId`** (woła `getArtifact`, nie „getModel").
    **Nie dodawaj nowego endpointu — użyj istniejącego i opisz to w raporcie.**
23. **Bramka roli przy zatwierdzeniu jest DWUWARSTWOWA.**
    `models.routes.ts` odrzuca `403` na poziomie trasy (`APPROVE_ALLOWED_ROLES`),
    a `approveVersion()` sprawdza rolę **drugi raz** w serwisie. **Dowód „obcy nie
    może" jest bezwartościowy bez pary: (a) obcy dostaje `403`, (b) uprawniony
    dostaje `200` i wiersz w bazie ma `APPROVED`.** Sam dowód (a) to „zamknięte
    przez wygaszenie" i nie wystarcza.
24. **W kopii stagingu **wszystkie 18** wersji biznesowych ma status `DRAFT`.**
    Zero `IN_REVIEW`, zero `APPROVED`. Twój test musi więc **sam przeprowadzić
    pakiet przez `submit_for_review` → `start_review`** zanim spróbuje zatwierdzić;
    inaczej dostaniesz `409 STATE_PRECONDITION_FAILED` i uznasz to za defekt,
    którym nie jest.
25. **`finance_lineage_edges` jest APPEND-ONLY.** Nie ma ścieżki cofnięcia
    krawędzi rodowodu. **Twój skrypt danych (`E6`) nie może zakładać, że da się
    „posprzątać po sobie" krawędzie** — może kasować wyłącznie to, co wypisze
    w manifeście, i **nigdy** krawędzi. Jeżeli rollback wymagałby usunięcia
    krawędzi — **rekord zostaje i idzie do manifestu jako „nieodwracalny"**.

---

> ### ★★ RAMKA DO `Z33`/`Z44` (`§0.2e`) — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija. Akapit z tej ramki jest OBOWIĄZKOWY dla KAŻDEGO pakietu
> użytego jako dowód (`Z44`) — pomiar bez niego wraca do poprawki.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. **W tym bloku dotyczy CAŁEJ
> powierzchni `/api/v8/finance-v2/**` — czyli każdego dowodu `E2` i `E3`.**
>
> **(b) `BetaGate MODULE_ECONOMICS` ma dziś status `closed`**
> (`src/utils/betaMenuStatus.ts:51`), a `BETA_ADMINS_EXEMPT = true` (`:33`).
> To znaczy: moduł jest niewidoczny dla zwykłego użytkownika, ale **widoczny dla
> OWNER/ADMIN**. Twój dowód roli musi rozróżniać `403` z bramki bety od `403`
> z bramki roli finansowej. **Pliku `betaMenuStatus.ts` NIE ZMIENIASZ** (`Z12`) —
> ma on wygenerowane lustro po stronie serwera i zmiana tam wywraca build.
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.**
> `MOCK_DB=false DB_TYPE=postgres` w tej samej linii to jedyne wyjście (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) PUŁAPKA WŁAŚCIWA TEMU BLOKOWI: `FinanceLegacyBridgeGate` podmienia
> tożsamość rekordu.** Karta sprawozdania montuje się przez most legacy→kanon
> (`FinanceHub.tsx:3561`), który tłumaczy `financial_statement_packs.id` na
> `{artifactId, businessVersionId}` przez tabelę `finance_artifact_aliases`
> (13 wierszy w kopii stagingu). **Twój test, który poda „id z listy" wprost do
> API kanonicznego, dostanie `404` i będzie wyglądał na defekt backendu, którym
> nie jest.** Każdy dowód `E2`/`E3`/`E4` musi jawnie powiedzieć, którego
> identyfikatora użył i skąd go wziął.
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce.

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tego ETAPU i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane.**

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnego etapu.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego.**

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / `betaMenuStatus.ts`)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Etap jest wtedy **ZROBIONY**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Etap **ZROBIONY** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe etapy** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „F1 podaje inną liczbę / inny katalog / inny numer linii niż mój pomiar" | Podajesz **swoją** liczbę z komendą (`Z24`). **F1 powstał 05.09 i częściowo się zestarzał — patrz `§0.2d` pkt 19–25.** To **nie jest** powód do STOP-u |
| „F1 każe założyć worktree w `/private/tmp`" | Obowiązuje `§0.1`. Wklejki `§11` z F1 są **nieaktualne**. Idziesz dalej |
| „F1 każe robić zrzuty ekranu" | **Zrzuty NIE SĄ Twoim zadaniem** — patrz `Z11` i sekcja „POZA ZAKRESEM". Dostarczasz mechanikę i testy; obraz robi robotnik wewnętrzny. Idziesz dalej |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-codex3-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit / commit-msg blokuje commit" | **Naprawiasz komunikatem albo kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em. Mechanizm znaczników opisany w `§0.6` |
| „Musiałbym odłożyć stan roboczy" | `cp` do `codex3-scratch`. `git stash` jest zakazem (`Z27`) |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie etapu |
| „Zastane testy Finansów są czerwone" | To **cudzy dług** (27 failed, pomiar 05.09). Mierzysz go w `przed-nazwy.txt`, wypisujesz imiennie i **nie naprawiasz** (`Z43`) |
| „Nie zdążę zrobić wszystkich etapów" | Robisz **rdzeń** (`E1`, `E2`, `E3`, `E7`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarz zrobiony, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6453` albo `5593` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO bloku jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji** (`Z28`);
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6453` albo `5593`** (`Z7`).

Format wpisu STOP:

```
### STOP — <etap>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe etapy: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

**★★ JEDEN STOP JEST W TYM BLOKU OBOWIĄZKOWY I Z GÓRY ZAPLANOWANY.**
**Pozycja modułu Finanse w menu głównym to DECYZJA WŁAŚCICIELA, nie Twoja praca.**
Nie zmieniasz `BETA_MENU_STATUS.MODULE_ECONOMICS` z `closed` na `open`, nie
odkomentowujesz nic w `menuConfig.ts`, nie dodajesz plakietki „wkrótce".
**Wpisujesz STOP MERYTORYCZNY z pomiarem** (jaki jest dziś stan bramki, kto
dziś widzi moduł, co dokładnie trzeba zmienić w jednym miejscu, żeby stał się
widoczny) **i idziesz dalej.** Decyzję podejmuje właściciel na podstawie
kryterium 6 pojemnika 2.

---

### 0.6. ★★ MECHANIZM ZAMROŻENIA I ZNACZNIKI ODMROŻENIA — CZYTAJ PRZED PIERWSZYM COMMITEM

Właściciel odbierał MVP moduł po module i po swoim „tak" moduł został
**zamrożony**. Rejestr zamrożeń: `docs/program/MVP_FINAL_ZAMROZONE.json`
(**nie edytujesz go ręcznie**, `Z13`). Procedura: `docs/program/MVP_FINAL_PROCEDURA.md`.

**Gdzie to blokuje (zmierzone, nie założone):**

- `.husky/pre-commit` — **TYLKO OSTRZEGA** (`--tylko-ostrzez || true`).
- `.husky/commit-msg` — **TU BLOKUJE.** Woła
  `bash scripts/mvp-final/check-freeze.sh --commit-msg="$1"` i przy braku
  znacznika kończy `exit 1`.

**★★ POMIAR AUTORA: MODUŁ FINANSE NIE JEST ZAMROŻONY.**
W rejestrze jest 15 kluczy (`13_CHAT`, `01_ORGANIZATION`, `02_INTERVIEW`,
`03_TOOLS`, `04_ASSESSMENT`, `05_INITIATIVES`, `06_EXECUTION`,
`07_MY_WORK_AGENT`, `08_MEETINGS`, `09_RESULTS`, `11_MATERIALS`, `12_AUDITS`,
`14_ADMIN`, `15_SETTINGS`, `16_PARTNER`) — **klucza `10_FINANCE` NIE MA**.
Kontrola z `§0.1a` komenda (11) dała u mnie `EXIT=0` i zero komunikatów, czyli
**znaczniki `[ODMROZENIE …]` nie są wymagane**.

**★ ALE SPRAWDZASZ TO SAM PRZED KAŻDYM COMMITEM**, bo Twoje pliki mogą wejść
w cudzy moduł (np. `Economics/InitiativeBusinessCaseCard.tsx` bywa liczony do
`05_INITIATIVES`):

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex3-finanse
bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) \
  --komunikat="proba" ; echo "EXIT=$?"
```

Jeżeli `EXIT != 0` — skrypt wypisze, **którego modułu** brakuje. Dopisujesz
wtedy znacznik w formacie `[ODMROZENIE <MODUL> DEC-399]` i **wpisujesz do
raportu, który plik go wymusił**. To jest wynik, nie porażka.

**★ `--no-verify` jest ZAKAZEM (`§0.5`), nie obejściem.**

---

## ★ PO CO TEN BLOK ISTNIEJE

Właściciel powiedział 06.09 rano: *„wyrzuć finanse do pojemnika 2"* i zaraz
potem: *„zgoda, zróbmy to i wypijmy szampana"* (`DEC-399`,
`01_INDEKS_I_HARMONOGRAM.md:54`). Finanse **nie wypadły z MVP** — dostały
zakres MINIMUM: pięć paczek z F1, `F‑M2/M3/M4/M6/M7`.

**Obietnica MINIMUM, słowami F1 (`:19`):**
> „CFO importuje sprawozdanie z porównawczym rokiem, otwiera je jako **pełny
> dokument** (RZiS · Bilans · CF), zatwierdza, i wszystko jest po polsku, bez
> czerwieni i bez uciętych kolumn."

**Dziś ta obietnica jest przerwana w trzech miejscach — zmierzonych, nie
zgadniętych:**

1. **„zatwierdza"** — w kopii bazy stagingu **wszystkie 18** wersji biznesowych
   Finansów ma status `DRAFT`. Ani jedna nie jest `APPROVED`. Chip
   „Zatwierdzone" na każdej liście pokazuje `0`, bo naprawdę jest `0`.
2. **„pełny dokument RZiS · Bilans · CF"** — karta sprawozdania
   (`StatementPackWorkspaceV2.tsx`, 776 linii) **nie ma ani jednego `<aside>`,
   ani `ArtifactRightPanel`, ani Menu 3**, a audyt kontraktów kart N z 06.09
   zapisał wprost: *„#45 `CanonicalStatementTableV2` renderuje 0 tabel"*
   (`01_INDEKS_I_HARMONOGRAM.md:295`).
3. **„bez czerwieni i bez uciętych kolumn"** — **34** klasy `primary-*`
   (= crimson `#85182F`) i **14** nieoznaczonych `<table>` w module.

**Czego ten blok NIE robi:** nie robi zrzutów, nie pokazuje niczego
właścicielowi i nie włącza żadnego ekranu. **Budujesz mechanikę tylną i przewody
za flagą OFF.** Prototyp, zrzuty i akcept właściciela to osobna praca
robotników wewnętrznych, wykonywana **po** Tobie (`CLAUDE.md` reguła 7:
*„Piotr nigdy nie jest pierwszym testerem wizualnym"*).

---

## ★ STAN ZMIERZONY — 2026-09-10, na kopii bazy stagingu i na kodzie markera

> **Wszystko poniżej to ROZKAZ POMIAROWY, nie prawda objawiona.**
> Obalenie którejkolwiek z tych tez jest SUKCESEM tego bloku (`Z24`).

### (a) Które paczki MINIMUM są już zrobione, a które nie

| Paczka | Co miała dać | Stan zmierzony | Dowód |
| --- | --- | --- | --- |
| `F‑M1` | słownik enumów, zero EN | **ZROBIONE, scalone 05.09** | `src/components/Finance/labels/financeEnums.ts` istnieje; `01_INDEKS_I_HARMONOGRAM.md:19` |
| `F‑M2` | zero crimsona, kanon tabel | **NIE ZROBIONE** | 34 × `primary-*`, 14 × nieoznaczony `<table>` |
| `F‑M3` | kolumna „Source statement", brak ucinania | **NIE ZROBIONE + brakuje ogniwa w tyle** | zero trafień „Sprawozdanie źródłowe"/`sourceStatement` w definicjach kolumn; `GET /lineage` tylko per jedno `businessVersionId` |
| `F‑M4` | karta N na powłoce artefaktu | **NIE ZROBIONE** | `grep -c "ArtifactRightPanel\|<aside" StatementPackWorkspaceV2.tsx` → `0` |
| `F‑M5` | producent kalendarza i okresów | **ZROBIONE** | `financeCalendarService.ts:221` i `:344` mają realne `INSERT`; w bazie 1 kalendarz i 4 okresy |
| `F‑M6` | zatwierdzenie pakietu do `APPROVED` | **NIE ZROBIONE** | `SELECT status, count(*) FROM finance_business_versions` → `DRAFT 18`, zero `APPROVED` |
| `F‑M7` | dane pokazowe + odbiór | **CZĘŚCIOWO — i na innej firmie niż mówi F1** | seed CD PROJEKT wykonany 06.09 (238 linii, 2 okresy); F1 mówi o DBR77 — patrz `K‑7` |

### (b) Dwa magazyny Finansów — czyja to praca

W bazie żyją **dwa równoległe magazyny sprawozdań**:

| Magazyn | Tabele | Liczby w kopii stagingu |
| --- | --- | --- |
| **ZASTANY (legacy)** | `financial_statement_packs`, `financial_statements`, `financial_statement_versions` | 10 pakietów (`ready 2`, `recoverable 3`, `pending 5`), 54 sprawozdania |
| **KANONICZNY (v3)** | `finance_artifacts`, `finance_business_versions`, `finance_stmt_*`, `finance_lineage_edges` | 18 artefaktów / 18 wersji (wszystkie `DRAFT`), 238 linii, 4 okresy, 1 kalendarz, 2 krawędzie rodowodu |
| **MOST** | `finance_artifact_aliases` + `FinanceLegacyBridgeGate` | 13 aliasów |

**★★ TO NIE JEST TWOJA PRACA.** Zlikwidowanie albo trwałe spięcie dwóch
magazynów (w tym „analiz finansowych") to **kryterium 5 pojemnika 2, pozycja
2.3**, prowadzone w **osobnym bloku Codexa nr 2**
(`TRZY_POJEMNIKI_PRACY_20260906.md:87` i `:101`).

**GRANICA, dosłownie:**
- **KANON, którego używasz**: warstwa `finance-v2` / `finance_*` (kanoniczna).
  Wszystkie Twoje odczyty i zapisy idą tędy.
- **CZEGO NIE DOTYKASZ**: projekcji, adapterów, aliasów i migracji danych między
  magazynami. **Nie kasujesz, nie migrujesz i nie „naprawiasz" rekordów
  zastanych.** Jeżeli Twój etap wymagałby zmiany w moście — **STOP MERYTORYCZNY
  z briefem dla bloku Codex 2**, nie własna naprawa.
- **Jeżeli zmierzysz, że most jest zepsuty** — wpisujesz to do raportu jako
  znalezisko dla Codexa 2, z plik:linia. To jest wartość, nie przekroczenie zakresu.

### (c) Pozycja w menu — dlaczego „Finansów nie ma"

Pomiar z 09.09 mówił: *„Finanse bez pozycji Menu 1 (poza MVP)"*
(`01_INDEKS_I_HARMONOGRAM.md:429`). **Mój pomiar to precyzuje i częściowo obala:**

- Pozycja **ISTNIEJE** w `src/components/Navigation/Sidebar/menuConfig.ts:152`
  (`id: 'MODULE_ECONOMICS'`, `badge: 'beta'`) — nie jest zakomentowana, jak
  `MODULE_CONCLUSIONS` obok.
- Niewidoczność bierze się z **jednej wartości**:
  `src/utils/betaMenuStatus.ts:51` → `MODULE_ECONOMICS: 'closed'`.
- Ale `BETA_ADMINS_EXEMPT = true` (`:33`), więc **ADMIN/OWNER/SUPERADMIN moduł
  widzą**. Zwykły użytkownik — nie.
- Trasy front są dodatkowo opakowane w `<BetaGate moduleId="MODULE_ECONOMICS">`
  (`src/routes/AppRoutes.tsx`, 5 wystąpień od `:2464`).
- Plik ma **wygenerowane lustro serwerowe**
  (`server/src/sharedRuntime/utils/betaMenuStatus.ts`, sync przez
  `scripts/cleanup/sync-server-runtime-mirrors.mjs`) — ręczna zmiana jednego bez
  drugiego **wywraca build serwera**.

**Wniosek dla Ciebie: to jest przełącznik jednej wartości, a nie brak funkcji —
i jest to DECYZJA WŁAŚCICIELA. `§0.5` nakazuje tu STOP MERYTORYCZNY z pomiarem.**

### (d) Dane pokazowe — CD PROJEKT, nie DBR77

- W bazie jest **jedna** organizacja z danymi finansowymi: **DBR77**
  (`a3e05d4a-5397-419d-b486-8e44366c0063`), 18 artefaktów.
- Pakiet pokazowy nazywa się
  **„Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025 (z 2024)"**
  (`artifact_id 67f0e754-ef65-49ab-90da-af9d55994b26`), `natural_key`
  `seed:finance-cdprojekt-2025:…:GRUPA_KAPITALOWA_CD_PROJEKT`.
- Okresy: `FY 2024`, `FY 2025`, `MONTH 2024-12`, `MONTH 2025-12` (4 wiersze).
  Rok 2025 ma poprawne `previous_period_id`, rok 2024 nie ma poprzednika —
  **to jest oczekiwane, bo 2023 nie został zaimportowany**.
- Legacy DBR77 2023–2025 jest **niespójne** (bilans 2024 się nie domyka,
  pozycje RZiS w bilansie 2023) — dlatego właściciel pokazuje Finanse
  **na CD PROJEKT** (`PRZEKAZANIE_20260906_RANO.md:45`).
- **Nazwa pakietu jest dziś PO POLSKU.** `DEC-461` mówi: kod i napisy EN.
  **Twój seed (`E6`) tworzy komplet z nazwami EN** i nie rusza istniejącego wiersza.

### (e) Co powiedział audyt kontraktów kart N (06.09, `01_INDEKS_I_HARMONOGRAM.md:295`)

Cytat pomiaru, który jest dla Ciebie punktem wyjścia:
> „Tylko `finance-statement-pack` (#45) w MINIMUM pojemnika 2 (F‑M4); 6
> pozostałych = Fala 2. […] #45 `CanonicalStatementTableV2` renderuje 0 tabel
> (F‑M4 wymaga RZiS/Bilans/CF), brak `ArtifactRightPanel`, 2 osobne przyciski
> AI (K21), lista »Zatwierdzone« vs API DRAFT; […] #50 crimson przez
> `ExportButton.tsx:62,71`, dwa równoległe systemy pod »Modele«; #51 Lineage = stub."

Do tego `DEC-440` z 06.09 21:31: *„Finanse: do rejestru i AI tylko sprawozdanie
+ analiza; stary `FinancialModelWorkspace` wygaszony."*
**Konsekwencja dla Ciebie: `FinancialModelWorkspace.tsx` jest modułem
WYGASZANYM — dotykasz go wyłącznie w `E5` (zamiana klasy crimson i oznaczenie
tabel), nigdy nie rozbudowujesz.**

---

## ★ WERDYKT O PREMISIE ZLECENIA

Premisa („F‑M2/M3/M4/M6/M7 do zrobienia") **potwierdzona co do czterech paczek
i zniuansowana co do jednej**:

- `F‑M2`, `F‑M3`, `F‑M4`, `F‑M6` — **niezrobione**, potwierdzone pomiarem.
- `F‑M7` — **częściowo zrobione i na innej firmie**, niż zakłada F1 (CD PROJEKT
  zamiast DBR77, decyzja z 06.09 nowsza niż F1 z 05.09).
- **Dwie zależności, których zakres `M2/M3/M4/M6/M7` nie wymienia, SĄ SPEŁNIONE:**
  `F‑M1` (słownik enumów) i `F‑M5` (producent okresów). Dlatego zakres bez nich
  jest wykonalny — to nie jest dziura w decyzji właściciela.
- **Jedno zdanie F1 jest dziś FAŁSZYWE i masz je obalić w raporcie:**
  F1 §F‑M5 §3 twierdzi, że `finance_stmt_calendars` i `finance_stmt_periods`
  „mają zero `INSERT`-ów w kodzie produkcyjnym". **Mają dwa**, oba
  w `financeCalendarService.ts`.

---

## ★ ZAKRES

1. **`F‑M6` (rdzeń, tył):** ścieżka zatwierdzenia **pakietu sprawozdań** —
   `DRAFT → IN_REVIEW → APPROVED` — działa przez realny `ApiGateway`, z parą
   dowodów ról, z blokadą optymistyczną i komunikatem konfliktu w EN+PL.
2. **`F‑M3` (rdzeń, tył):** **odczyt zbiorczy rodowodu** dla wielu wersji
   biznesowych naraz — ogniwo, którego dziś nie ma i którego brak F1 kazał
   zgłaszać STOP-em. Plus kontrakt kolumny „Source statement" ze stanem uczciwym
   przy braku krawędzi.
3. **`F‑M4` (tył + czysta funkcja):** `deriveStatementTable.ts` produkuje **trzy**
   struktury tabel (P&L · Balance sheet · Cash flow) z hierarchią pozycji
   i roll-upem sum, okres + porównawczy; stan uczciwy przy zerze zmapowanych linii.
   Osadzenie w powłoce artefaktu — **za flagą `VITE_FINANCE_MINIMUM` OFF**.
4. **`F‑M2` (mechaniczne):** 34 zamiany `primary-*` → tokeny `c-*`;
   klasyfikacja 14 nieoznaczonych `<table>` na „arkusz" (znacznik `§27-exempt`
   z uzasadnieniem) albo „lista rekordów" (przepisanie na `StandardTable`).
5. **`F‑M7` (dane, tył):** skrypt seedu **EN** dla CD PROJEKT z trybami
   `--dry-run` / `--apply` / `--verify` / `--rollback=<manifest>`, na **Twojej**
   bazie, z manifestem **wyłącznie przy `--apply`** (`Z42`) i nazwą bazy
   **wyłącznie z parametru** (`Z41`).
6. **Raport** w narzuconym układzie (`E7`).

**Front dotykasz WYŁĄCZNIE tam, gdzie paczka `F‑M` wymaga PRZEWODU do
istniejącego ekranu — i wyłącznie za flagą `VITE_FINANCE_MINIMUM` = OFF.**
Wyjątek: `F‑M2` to zamiana klas i znaczników w istniejących plikach, nie nowy
ekran — idzie bez flagi, ale **bez zmiany układu, kolejności i treści**.

## ★ POZA ZAKRESEM — imiennie

- **Baseline v3, prognoza, scenariusze, wycena** — to `F‑P1`…`F‑P11`, fala 2,
  pozycja 3.5 pojemnika 3. **Nie dotykasz** `BaselineWorkspace.tsx`,
  `Valuation/**`, `finance_baseline_*`, `finance_prediction_*`.
  Znany `409` na `configureBaselineWorkspaceContext` **zostaje niezmieniony**.
- **Likwidacja/spięcie dwóch magazynów** — blok Codex 2, pozycja 2.3. Patrz
  granica w „STAN ZMIERZONY (b)".
- **Pozycja modułu w menu głównym** — decyzja właściciela, **obowiązkowy STOP
  MERYTORYCZNY z pomiarem** (`§0.5`). Zero zmian w `betaMenuStatus.ts`,
  `menuConfig.ts`, `AppRoutes.tsx`.
- **Zmiany wyglądu poza `F‑M2`.** Zero zmian układu, odstępów, ikon, kolejności
  kolumn, tekstów widocznych na ekranie poza kluczami i18n dodanymi wprost
  przez `E2`/`E3`/`E4`. **Zero zmian w `src/components/standard/**`** — kanon
  wspólny jest ZAMROŻONY.
- **Zrzuty ekranu, prototyp, akcept właściciela** — praca robotników
  wewnętrznych po Tobie (`Z11`). Nie uruchamiasz `scripts/dev/odbior-zywo/zrzut.mjs`,
  nie stawiasz Vite, nie logujesz się na żadne konto.
- **Rozbudowa `FinancialModelWorkspace.tsx`** — moduł wygaszany (`DEC-440`).
- **Produkcja, demo, staging** — nietykalne (`Z8`, `Z9`, `Z28`).
- **Zero migracji modyfikujących istniejące pliki** w `server/migrations/**`.
  Wyłącznie NOWE pliki w przedziale `20262150`–`20262159`, wyłącznie addytywne (`Z40`).
- **Zero zmian globalnej infrastruktury testowej** (`Z18`).
- **Nie sprzątasz 27 zastanych czerwonych testów** ani 7 zastanych
  `.catch(() => {})` — mierzysz je i wypisujesz (`Z43`, `Z45`).

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · TRASA · KONTROLER · SERWIS · REPOZYTORIUM

> **★★ ZASTRZEŻENIE.** Ta tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief wg wiersza 1, **nie zatrzymanie bloku**.

| Plik / wzorzec | Licencja | Co robisz, gdy etap wymagałby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/effectiveAccessService.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z12`) | Produktem etapu staje się **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT CODEX3 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego bloku`. Do tego **brief w raporcie**: plik:linia · dlaczego nie da się w module · promień rażenia · jak wyglądałby dowód mutacyjny. **Etap z takim produktem jest ZROBIONY, nie STOP** |
| `src/utils/betaMenuStatus.ts`, `server/src/sharedRuntime/utils/betaMenuStatus.ts`, `src/components/Navigation/Sidebar/menuConfig.ts`, `src/routes/AppRoutes.tsx` | **TYLKO ODCZYT — DECYZJA WŁAŚCICIELA** | **Obowiązkowy STOP MERYTORYCZNY** z pomiarem wg `§0.5`. Podajesz: dzisiejszą wartość, kto dziś widzi moduł, jedno miejsce zmiany, konieczność re-syncu lustra serwerowego |
| **`server/src/routes/v8/finance-v2/crosscutting.routes.ts`** | **★ WĄSKA LICENCJA:** wyłącznie **DODANIE** trasy odczytu zbiorczego rodowodu (`E3`). **Zakaz zmiany istniejącej trasy `GET /versions/:businessVersionId/lineage`, jej kształtu odpowiedzi i kodów błędów** | Czerwony kontrakt + brief |
| **`server/src/services/finance/canonical/lineageService.ts`** | **★ WĄSKA LICENCJA:** wyłącznie **DODANIE** funkcji odczytu dla wielu `businessVersionId` naraz. **Zakaz zmiany `getAncestors`/`getDescendants` i ich sygnatur** | Czerwony kontrakt + brief |
| `server/src/routes/v8/finance-v2/versions.routes.ts` | **★ WĄSKA LICENCJA** w zakresie `E2`: wyłącznie komunikaty błędów i ich klucze i18n. **Zakaz poszerzania `ROUTABLE_ACTIONS` o `approve`/`reopen`** — te mają własną trasę (`§0.2d` pkt 22) | Czerwony kontrakt + brief |
| `server/src/routes/v8/finance-v2/models.routes.ts` | **★ WĄSKA LICENCJA** w zakresie `E2`: wyłącznie komunikat i kod błędu przy konflikcie wersji oraz — jeśli pomiar to uzasadni — **alias trasy** `POST /statements/:artifactId/approve` delegujący do tej samej logiki. **Zakaz zmiany `APPROVE_ALLOWED_ROLES` i logiki `approveVersion`** | Czerwony kontrakt + brief |
| `server/src/services/finance/canonical/artifactVersionService.ts` (i pokrewne serwisy cyklu życia) | **★ WĄSKA LICENCJA:** wyłącznie to, co `E2` udowodni pomiarem jako brakujące ogniwo. **Zakaz zmiany reguł przejść i słownika stanów** | Czerwony kontrakt + brief |
| **`server/src/services/finance/canonical/__tests__/*.pg.test.ts` (NOWE)**, **`server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts` (NOWE)** | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z31`, `Z43` | — |
| `src/services/api/financeV2.api.ts` | **★ WĄSKA LICENCJA:** wyłącznie DODANIE klienta odczytu zbiorczego rodowodu (`E3`) i obsługi nowego kodu konfliktu (`E2`). **Zakaz zmiany istniejących funkcji** | Czerwony kontrakt + brief |
| `src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts` | **★ PEŁNA LICENCJA** — rdzeń `E4` (czysta funkcja, testowalna bez ekranu) | — |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx`, `CanonicalStatementTableV2.tsx` | **★ WĄSKA LICENCJA** w zakresie `E4`: osadzenie `ArtifactRightPanel` i Menu 3 **za flagą `VITE_FINANCE_MINIMUM` = OFF**. **Gałąź OFF ma renderować DOKŁADNIE dzisiejsze drzewo** — diff musi to pokazywać | Czerwony kontrakt + brief |
| `src/components/standard/ArtifactRightPanel.tsx`, cały `src/components/standard/**` | **TYLKO ODCZYT — KANON WSPÓLNY ZAMROŻONY** | **Osadzasz istniejący komponent, nie budujesz własnego.** Jeżeli komponent nie przyjmuje tego, czego potrzebujesz — czerwony kontrakt + brief, **nigdy własna kopia powłoki** |
| `src/components/Economics/FinanceHub.tsx` | **★ WĄSKA LICENCJA** w zakresie `E3`: wyłącznie definicja kolumny „Source statement" i jej źródło danych, **za flagą**. **Zakaz zmiany kolejności istniejących kolumn, JSX poza dodaną kolumną i gałęzi montażu `:3561`** | Czerwony kontrakt + brief |
| `src/components/Economics/FinancePreviewPanel.tsx` | **★ WĄSKA LICENCJA** w zakresie `E3` (stan pakietu przez resolver `financeEnums`) i `E5` (crimson/tabele) | Czerwony kontrakt + brief |
| 9 plików z `primary-*` i 14 miejsc `<table>` (lista w tabeli mianowników) | **★ WĄSKA LICENCJA** w zakresie `E5`: wyłącznie zamiana klas i dodanie znacznika `§27-exempt` z uzasadnieniem, albo przepisanie listy rekordów na `StandardTable`. **Zakaz jakiejkolwiek innej zmiany** — diff ma pokazywać wyłącznie te linie | Czerwony kontrakt + brief |
| `src/components/Finance/FinancialModelWorkspace.tsx` | **★ NAJWĘŻSZA LICENCJA:** wyłącznie 1 klasa `primary-*` i 2 tabele (`E5`). Moduł WYGASZANY (`DEC-440`) — **zero rozbudowy** | Czerwony kontrakt + brief |
| **`server/scripts/finance-seed-cdprojekt-en.ts` (NOWY)** albo równoważny — nazwa wg Twojego pomiaru | **★ PEŁNA LICENCJA** — rdzeń `E6`, z bezwzględnym `Z41` i `Z42` | — |
| `server/scripts/finance-seed-cdprojekt.ts`, `server/scripts/data/cdprojekt-2025.json` | **TYLKO ODCZYT — WZORZEC** | Kopiujesz kształt i dane, **nie zmieniasz ani litery** w istniejącym skrypcie |
| `scripts/dane/usun-organizacje.ts` | **TYLKO ODCZYT — WZORZEC TRYBÓW** | Kopiujesz z niego kształt: `--dry-run` / `--apply` / `--rollback=<manifest.json>` / `--verify`, dwa klucze do trybu zapisującego, `--oczekiwany-host 127.0.0.1`. **Nie zmieniasz w nim ani litery** |
| `server/migrations/20262150_*.sql` … `20262159_*.sql` (**NOWE**) | **★ PEŁNA LICENCJA** w przedziale **`20262150`–`20262159`**, wyłącznie addytywne (`Z40`) | — |
| `server/migrations/**` (wszystkie istniejące pliki) | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Nowy plik w Twoim przedziale, nigdy edycja cudzego |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie (`Z46`). Zakaz zmiany istniejących wartości | — |
| `tests/**` (NOWE pliki), `server/src/**/__tests__/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z31`, `Z43`. **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `playwright*.config.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Produktem jest **opis w raporcie**: co w konfiguracji blokuje pomiar i **jak obszedłeś to zmiennymi w linii komendy** |
| `docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md` | **TYLKO ODCZYT — ŹRÓDŁO ZAKRESU** | Rozbieżność z pomiarem → „Korekty wobec instrukcji", nigdy edycja F1 |
| `docs/program/MVP_FINAL_ZAMROZONE.json`, `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z13`, `Z14`) | Errata w raporcie |
| `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/98_RAPORT.md` | **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `server/src/_backup/**`, warianty `PRESERVED_PRODUCT_WIP` | **NIETYKALNE** (`Z4`) | Nie liczysz i nie zmieniasz |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

**★ Uwaga do wierszy „WĄSKA LICENCJA".** Zanim zmienisz sygnaturę czegokolwiek
wspólnego, sprawdź, czy **typ** przez ten plik przepływa:

```bash
grep -rln "lineageService\|getAncestors\|getDescendants" server/src | grep -v __tests__
```

Każdy znaleziony konsument albo wchodzi do licencji, albo zmiana typu jest
niewykonalna i trzeba ją zaprojektować inaczej (**dodanie funkcji obok, nie
zmiana istniejącej**).

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | klasy crimson w Finansach | **34** | `grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" \| grep -v __tests__ \| grep -vE "^\S+:[0-9]+:\s*(\*\|//)" \| wc -l` | TAK — oba katalogi modułu (`§0.2d` pkt 19) |
| 2 | pliki z klasami crimson | **9** | ta sama komenda + `\| cut -d: -f1 \| sort -u \| wc -l` | TAK |
| 3 | nieoznaczone `<table>` | **14** | `grep -rn "<table" src/components/Finance src/components/Economics --include="*.tsx" \| grep -v __tests__ \| grep -v "§27-exempt" \| wc -l` | TAK — **F1 pisze „13", ale wylicza 14** |
| 4 | wszystkie `<table>` w module | **22** | ta sama komenda bez filtra `§27-exempt` | TAK |
| 5 | wersje biznesowe wg statusu | **`DRAFT 18`, `APPROVED 0`** | `docker exec … -Atc "SELECT status, count(*) FROM finance_business_versions GROUP BY 1"` | TAK — **to jest miara `F‑M6`** |
| 6 | artefakty finansowe wg typu | **`STATEMENT_PACK 7`, `VALUATION_CASE 4`, `HISTORICAL_ANALYSIS 3`, `BASELINE_MODEL 2`, `PREDICTION_SCENARIO 2`** | `docker exec … -Atc "SELECT artifact_type, count(*) FROM finance_artifacts GROUP BY 1"` | TAK |
| 7 | linie sprawozdań / okresy / kalendarze | **238 / 4 / 1** | trzy `SELECT count(*)` na `finance_stmt_lines`, `finance_stmt_periods`, `finance_stmt_calendars` | TAK — **to jest miara, czy `F‑M5` naprawdę działa** |
| 8 | krawędzie rodowodu | **2** (`STATEMENT_TO_ANALYSIS`) | `docker exec … -Atc "SELECT edge_type, count(*) FROM finance_lineage_edges GROUP BY 1"` | TAK — **to jest miara `F‑M3`: 7 pakietów, 2 krawędzie → większość wierszy NIE MA źródła** |
| 9 | pakiety zastane wg gotowości | **`ready 2`, `recoverable 3`, `pending 5`** | `docker exec … -Atc "SELECT pack_readiness_status, count(*) FROM financial_statement_packs GROUP BY 1"` | TAK — magazyn ZASTANY, nie Twój |
| 10 | aliasy mostu legacy→kanon | **13** | `docker exec … -Atc "SELECT count(*) FROM finance_artifact_aliases"` | TAK — pułapka `§0.2e (e)` |
| 11 | trasy odczytu rodowodu | **1 (pojedyncza)** | `grep -n "router.get\|router.post" server/src/routes/v8/finance-v2/crosscutting.routes.ts` | TAK — **brak zbiorczej to zadanie `E3`** |
| 12 | akcje dopuszczone przez `/transitions` | **7, bez `approve`/`reopen`** | `grep -n "ROUTABLE_ACTIONS" -A 12 server/src/routes/v8/finance-v2/versions.routes.ts` | TAK |
| 13 | `<aside>` / `ArtifactRightPanel` w karcie pakietu | **0** | `grep -c "ArtifactRightPanel\|<aside" src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | TAK — **to jest miara `F‑M4`** |
| 14 | ciche połknięcia błędu w Finansach | **7** | `grep -rn "catch(() => {})" src/components/Finance src/components/Economics server/src/services/finance server/src/routes/v8/finance-v2 \| grep -v __tests__` | TAK — `Z45`: wypisujesz, nie sprzątasz |
| 15 | wolne numery migracji w MOIM przedziale | **10** (`20262150`–`20262159`) | `ls server/migrations \| grep -cE "^2026215[0-9]"` → oczekiwane `0` zajętych | **TAK — sprawdź to osobno, to najczęstszy błąd wydania instrukcji** |
| 16 | najwyższy zajęty numer migracji | **20262107** | `ls server/migrations \| grep -oE "^[0-9]{8}" \| sort -u \| tail -1` | TAK |
| 17 | zastane czerwone testy w module | **27** (pomiar 05.09, nie mój) | `§0.4a` `przed-nazwy.txt` | **NIE — to liczba CUDZA, masz ją zmierzyć u siebie i podać SWOJĄ** |

**Reguła kontrolna:** komenda, której sam nie uruchomiłeś, nie wchodzi do raportu.
Rozbieżność z moją liczbą **nie jest sprzecznością — jest WYNIKIEM**.

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego bloku

### Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Etap | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts` | **NOWE** | `E1`, `E2`, `E3` | ZEROWE |
| 2 | `server/src/services/finance/canonical/lineageService.ts` | istniejący | `E3` | **ŚREDNIE** — dotyka go tor rodowodu; commituj małymi krokami |
| 3 | `server/src/routes/v8/finance-v2/crosscutting.routes.ts` | istniejący | `E3` | ŚREDNIE |
| 4 | `src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts` | istniejący | `E4` | NISKIE |
| 5 | 9 plików z `primary-*` + do 14 plików z `<table>` | istniejące | `E5` | **WYSOKIE** — to te same pliki, które dotyka każdy tor językowy i graficzny; **commituj per plik** |
| 6 | `server/scripts/finance-seed-cdprojekt-en.ts` | **NOWY** | `E6` | ZEROWE |
| 7 | `server/migrations/20262150_*.sql` | **NOWY, warunkowo** | `E3`/`E6` | ZEROWE (przedział wyłączny) |
| 8 | `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/98_RAPORT.md` | **NOWY** | `E7` | ZEROWE |

### Pliki zapisywane WARUNKOWO

| Plik | Etap | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| `src/services/api/financeV2.api.ts` | `E2`, `E3` | **dopiero po** zielonym dowodzie HTTP nowej trasy zbiorczej na realnym Postgresie |
| `src/components/Economics/FinanceHub.tsx` | `E3` | **dopiero po** tym, jak odczyt zbiorczy zwróci komplet krawędzi — udowodnione HTTP-em, nie grepem; i **wyłącznie** za flagą OFF |
| `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx` | `E4` | tylko jeżeli gałąź OFF renderuje **dokładnie dzisiejsze drzewo**; jeżeli nie potrafisz tego udowodnić — **nie dotykasz** i piszesz STOP |
| `server/src/routes/v8/finance-v2/models.routes.ts` | `E2` | tylko jeżeli pomiar z `E1` wykaże, że nazwa trasy `models` realnie blokuje zatwierdzenie pakietu; inaczej **nie dotykasz** |
| `public/locales/{pl,en}/translation.json` | `E2`, `E3`, `E4` | tylko dla NOWYCH kluczy; parytet PL+EN w tym samym commicie (`Z46`) |
| `server/migrations/20262150_*.sql` | `E3`, `E6` | tylko jeżeli udowodnisz, że bez indeksu odczyt zbiorczy jest wolniejszy niż N pojedynczych; migracja **wyłącznie addytywna** |

### Pliki, których ten blok JAWNIE NIE ZAPISZE — imiennie

```
server/src/middleware/auth.middleware.ts
server/src/Gateway.ts
server/src/middleware/v8FeatureGate.middleware.ts
server/src/middleware/betaGate.middleware.ts
server/src/services/effectiveAccessService.ts
src/utils/betaMenuStatus.ts
server/src/sharedRuntime/utils/betaMenuStatus.ts
src/components/Navigation/Sidebar/menuConfig.ts
src/routes/AppRoutes.tsx
src/components/standard/**                      (kanon wspólny — ZAMROŻONY)
src/components/Finance/BaselineWorkspace.tsx
src/components/Finance/Valuation/**
server/scripts/finance-seed-cdprojekt.ts        (wzorzec, nie ruszasz)
scripts/dane/usun-organizacje.ts                (wzorzec, nie ruszasz)
server/src/_backup/**
tests/setup.ts, tests/helpers/**, tests/__mocks__/**
vitest*.config.ts, server/vitest.config*.ts, playwright*.config.ts
docs/program/MVP_FINAL_ZAMROZONE.json
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md
```

### Zasoby wyłączne tego bloku

| Zasób | Wartość | Sprawdzone (komenda) |
| --- | --- | --- |
| Port PostgreSQL | `6453` | `lsof -nP -iTCP -sTCP:LISTEN \| grep :6453` → pusto |
| Port harnessu | `5593` | `lsof -nP -iTCP -sTCP:LISTEN \| grep :5593` → pusto |
| Nazwa kontenera | `cx-codex3-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-codex3` → pusto |
| Nazwa bazy | `cx_codex3_finanse` | **zawsze z parametru, nigdy na sztywno w kodzie (`Z41`)** |
| **Przedział migracji** | **`20262150`–`20262159`** | `ls server/migrations \| grep -cE "^2026215[0-9]"` → `0` |
| Gałąź | `codex/finanse-minimum-20260911` | nie istnieje w vaulcie |
| Worktree | `/Users/piotrwisniewski/Developer/codex-wt/codex3-finanse` | nie istnieje |
| Flaga funkcyjna | `VITE_FINANCE_MINIMUM` — **default OFF** | `grep -rn "VITE_FINANCE_MINIMUM" src server` → 0 trafień |

### Kontrola przed KAŻDYM commitem

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex3-finanse
git diff --name-only --cached | tee /Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty/staged.txt
grep -iE 'auth\.middleware|Gateway\.ts|betaMenuStatus|menuConfig|AppRoutes|components/standard/|BaselineWorkspace|Finance/Valuation/|vitest.*config|playwright.*config|tests/setup|_backup/|MVP_FINAL_ZAMROZONE|OWNER_DECISION_LEDGER|F1_FINANSE' \
  /Users/piotrwisniewski/Developer/codex-wt/codex3-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) --komunikat="proba" ; echo "FREEZE_EXIT=$?"
```

---

# ETAPY

**Jeden etap = jeden commit = jeden werdykt.** Rdzeń to `E1`, `E2`, `E3`, `E7` —
jeżeli zabraknie czasu, `E4`, `E5` i `E6` opisujesz uczciwie jako niezrobione,
**nigdy odwrotnie**.

| Etap | Paczka F1 | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Komunikat commita |
| --- | --- | --- | --- | --- | --- | --- |
| `E1` | wszystkie | inwentarz + testy charakteryzujące dzisiejszy stan (CZERWONE) | **TAK** | NIE — dowód: cała praca w `__tests__` | min. 8 nowych testów | `test(finanse): testy charakteryzujace stan MINIMUM (E1)` |
| `E2` | `F‑M6` | zatwierdzenie pakietu sprawozdań do `APPROVED` | **TAK** | NIE — dowód: `git diff --name-only` bez plików przekrojowych | min. 8 | `feat(finanse): zatwierdzanie pakietu sprawozdan na realnym PG (E2)` |
| `E3` | `F‑M3` | odczyt zbiorczy rodowodu + kontrakt kolumny źródła | **TAK** | NIE | min. 8 | `feat(finanse): zbiorczy odczyt rodowodu dla listy sprawozdan (E3)` |
| `E4` | `F‑M4` | trzy tabele RZiS/Bilans/CF + powłoka artefaktu za flagą | NIE | NIE | min. 8 | `feat(finanse): trzy tabele sprawozdania i powloka artefaktu za flaga (E4)` |
| `E5` | `F‑M2` | crimson → tokeny `c-*`, klasyfikacja 14 tabel | NIE | NIE | min. 4 | `fix(finanse): koniec crimsona i kanon tabel (E5)` |
| `E6` | `F‑M7` | skrypt seedu EN CD PROJEKT z trybami i manifestem | NIE | NIE | min. 6 | `feat(dane): seed EN CD PROJEKT z trybem suchym i przywracaniem (E6)` |
| `E7` | — | raport | **TAK** | NIE | n/d | `docs(codex3): raport bloku Finanse MINIMUM (E7)` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEGO etapu,
> z dowodem przy odpowiedzi `NIE`. Żaden etap nie odpowiada `TAK` — to warunek
> wydania tej instrukcji. Jeżeli w trakcie odkryjesz, że etap jednak wymaga
> pliku przekrojowego, dostarczasz czerwony kontrakt + brief i etap jest
> ZROBIONY (`§0.5`).**
>
> **★ Jeżeli pomiar z `§0.6` pokaże, że któryś plik jest zamrożony — dopisujesz
> znacznik `[ODMROZENIE <MODUL> DEC-399]` do komunikatu i notujesz to w raporcie.**

---

## E1 — INWENTARZ I TESTY CHARAKTERYZUJĄCE DZISIEJSZY STAN (rdzeń)

**Cel:** zamienić opis z sekcji „STAN ZMIERZONY" w **wykonywalne, czerwone
testy**, żeby każdy następny etap miał czym udowodnić, że coś naprawił.

**Kroki:**

1. **Postaw kontener i migracje** wg `§0.2c (A)`. Oba przebiegi do raportu.
2. **Zasiej minimum danych** potrzebne do testów. **Nie kopiujesz bazy stagingu**
   (`Z28`) — budujesz fikstury w teście albo używasz wzorca z
   `server/scripts/finance-seed-cdprojekt.ts` (odczyt) na **swojej** bazie.
3. **Zmierz wszystkie 17 wierszy tabeli mianowników** u siebie. Każda liczba
   z komendą, obok liczby autora.
4. **Napisz testy charakteryzujące — CZERWONE Z ZAŁOŻENIA (`Z43`):**
   - `F‑M6`: „pakiet sprawozdań da się doprowadzić do `APPROVED` przez realny
     `ApiGateway`" → dziś **PADA**;
   - `F‑M3`: „istnieje odczyt rodowodu dla listy wersji biznesowych w jednym
     żądaniu" → dziś **PADA** (`404`);
   - `F‑M4`: „`deriveStatementTable` zwraca trzy struktury tabel" → dziś **PADA**;
   - `F‑M2`: bezpiecznik `grep`-owy jako test (`readFileSync` po katalogach
     modułu) — „zero `primary-*`, zero nieoznaczonych `<table>`" → dziś **PADA**
     z liczbami 34 i 14.
   Każdy test ma nagłówek `// CZERWONY Z ZAŁOŻENIA — E1, nie regresja tego bloku`
   i nazwę `it('KONTRAKT CODEX3 — …')`.
5. **Wypisz do raportu 7 zastanych `.catch(() => {})`** z plik:linia (`Z45`)
   i **swoją** liczbę zastanych czerwonych testów (`Z43`, `§0.4a`).

**Definicja ukończenia:** kontener stoi, migracje idempotentne, 17 liczb
zmierzonych, minimum 8 czerwonych kontraktów w repo, `przed-nazwy.txt`
w artefaktach, akapit `§0.2e` dla każdego uruchomionego pakietu (`Z44`).

**STOP MERYTORYCZNY, jeśli:** którakolwiek z liczb autora rozjedzie się z Twoją
o więcej niż 10 % — **to nie zatrzymuje etapu**, ale wchodzi do „Korekt"
z komendą i wynikiem.

---

## E2 — `F‑M6`: ZATWIERDZENIE PAKIETU SPRAWOZDAŃ DO `APPROVED` (rdzeń)

**Cel z F1 §F‑M6 §1:** *„Właściciel klika »Skieruj do przeglądu«, potem
»Zatwierdź«, i plakietka Zatwierdzony przeżywa odświeżenie strony."*
**Twoja część: żeby to było możliwe od strony API i danych.**

**Kroki:**

1. **ZMIERZ PRZYCZYNĘ, NIE ZGADUJ.** F1 §F‑M6 §3 stawia hipotezę „bramka
   autor ≠ recenzent". **Moje pomiary jej nie potwierdzają i wskazują dwa inne
   tropy** — sprawdź oba i wypisz, który jest prawdziwy:
   - `ROUTABLE_ACTIONS` nie zawiera `approve`; zatwierdzenie idzie przez
     `POST /models/:modelId/approve` (`§0.2d` pkt 22);
   - `FinanceWorkspaceBar.tsx` **nie ma ani jednej akcji cyklu życia**
     (`§0.1a` komenda 6) — fetchery w `StatementPackWorkspaceV2` są, ale nie
     wiadomo, czy renderuje się przycisk.
   **Jeżeli prawdziwa przyczyna jest jeszcze inna — to jest najcenniejszy wynik
   tego etapu.**
2. **Udowodnij pełny łańcuch na realnym Postgresie:**
   `DRAFT` → `submit_for_review` → `start_review` → `approve` → odczyt **na
   zimno osobnym klientem `pg`**:
   `SELECT status FROM finance_business_versions WHERE business_version_id = $1`
   → `APPROVED`.
3. **PARA DOWODÓW RÓL (obowiązkowa, `§0.2d` pkt 23):**
   (a) rola spoza `APPROVE_ALLOWED_ROLES` dostaje `403`;
   (b) rola uprawniona dostaje `200` **i wiersz w bazie się zmienia**.
   **Sam dowód (a) to „zamknięte przez wygaszenie" i nie wystarcza.**
4. **Blokada optymistyczna:** dwa równoległe `approve` z tym samym
   `expectedVersion` — dokładnie jeden wygrywa, drugi dostaje konflikt.
   Komunikat konfliktu **przez klucz i18n, EN+PL w jednym commicie** (`Z46`).
5. **Jeżeli okaże się, że pakiet sprawozdań naprawdę nie ma ścieżki
   zatwierdzenia** — dodajesz **alias trasy** `POST /statements/:artifactId/approve`
   delegujący do istniejącej logiki (**wąska licencja**), nie nową implementację.

**Testy (realny PG, obowiązkowo):** nowy plik
`server/src/routes/v8/finance-v2/__tests__/statementPackApproval.pg.test.ts`
(min. 8 przypadków). **Kontrola negatywna obowiązkowa:** ta sama suita bez
`RUN_DB_TESTS=1` musi zaraportować `skipped`, **nigdy `passed`**.

**Dowód mutacyjny (`Z32`):** usuń sprawdzenie `expectedVersion` → test wyścigu
musi wykryć podwójne przejście; cofnij przez `cp`, `git diff` pusty.

**Definicja ukończenia:** przyczyna nazwana z plik:linia; łańcuch zielony;
para dowodów ról; wyścig wykryty; klucze EN+PL dopisane; akapit `§0.2e`.

**RYZYKO DO ZAPAMIĘTANIA (F1 §F‑M6 §8):** **zatwierdzenie jest NIEZMIENNE.**
Zły pakiet zostaje na zawsze. Pracujesz **wyłącznie na swojej bazie** i na
rekordach, które sam utworzyłeś.

---

## E3 — `F‑M3`: ZBIORCZY ODCZYT RODOWODU I KONTRAKT KOLUMNY ŹRÓDŁA (rdzeń)

**Cel z F1 §F‑M3 §1:** *„Na liście Sprawozdań właściciel widzi, z jakiego
dokumentu powstał każdy wiersz."*
**F1 §F‑M3 §8 mówi wprost: jeżeli serwer nie ma odczytu zbiorczego, wykonawca
ma się ZATRZYMAĆ, bo »to jest praca backendowa, nie obejście pętlą w kliencie«.
Serwer go nie ma. TY JESTEŚ TĄ PRACĄ BACKENDOWĄ.**

**Kroki:**

1. **Dodaj odczyt zbiorczy** — jedna z dwóch form, wybierz i uzasadnij:
   - `POST /versions/lineage-edges` z ciałem `{ businessVersionIds: string[] }`
     (semantyka odczytu, ciało bo lista bywa długa), albo
   - pole w odpowiedzi listy sprawozdań.
   **Twarde wymagania:** zawężenie do `organizationId` z kontekstu; limit
   długości listy z jawnym `400` po przekroczeniu; **przy błędzie źródła —
   błąd, nigdy pusta lista** (`Z23`).
2. **Odpowiedź niesie NAZWY, nie hashe.** Istniejąca trasa pojedyncza już
   zwraca `sourceDisplayName` / `sourceNaturalKey`
   (`crosscutting.routes.ts`, komentarz „audyt FIN 2026-09-06 defekt #12").
   **Zachowaj ten sam kształt DTO** — jedno źródło decyzji o nazwie to
   `financeArtifactDisplayTitle`.
3. **Stan uczciwy przy braku krawędzi.** Kontrakt: brak krawędzi → klucz i18n
   `finance.statements.noSourceStatement` (EN: „no source statement", PL: „bez
   sprawozdania źródłowego"). **NIGDY pusty string, NIGDY `—`** — to wymóg
   właściciela (`FINANSE_ZALOZENIA_CTO_20260905.md` §6 pkt 5).
   **Uwaga na skalę: 7 pakietów, 2 krawędzie — większość wierszy trafi w ten
   stan. Ma być czytelny, nie awaryjny.**
4. **Przewód do listy — ZA FLAGĄ `VITE_FINANCE_MINIMUM` = OFF.** Kolumna
   „Source statement" w `FinanceHub.tsx` renderuje się **tylko przy fladze ON**.
   Przy OFF lista wygląda **dokładnie jak dziś** — udowodnij to testem
   porównującym zestaw kolumn.
5. **Wydajność:** test, że dla N wierszy leci **jedno** żądanie, nie N.
   Mutacja: przywróć pętlę per wiersz → test musi spaść.

**Testy:** `server/src/routes/v8/finance-v2/__tests__/lineageBulk.pg.test.ts`
(realny PG, min. 6) + `src/components/Economics/__tests__/FinanceHub.sourceColumn.test.tsx`
(jednostkowy, min. 2: kolumna renderuje nazwę; przy braku krawędzi renderuje
klucz stanu uczciwego).

**Dowód mutacyjny (`Z32`):** zamień fallback braku źródła na pusty string →
test spada; cofnij.

**Definicja ukończenia:** trasa zbiorcza zielona na realnym PG; jedno żądanie
zamiast N udowodnione; flaga OFF nie zmienia listy; klucze EN+PL; akapit `§0.2e`.

---

## E4 — `F‑M4`: TRZY TABELE SPRAWOZDANIA I POWŁOKA ARTEFAKTU ZA FLAGĄ

**Cel z F1 §F‑M4 §1:** *„Sprawozdanie otwiera się jako dokument podstawowy: trzy
pełne tabele RZiS · Bilans · CF (okres + porównawczy), z rodowodem i historią
w jednym prawym panelu."*

**Kroki:**

1. **`deriveStatementTable.ts` — rdzeń i czysta funkcja.** Z płaskiej listy
   linii kanonicznych zbuduj **trzy** struktury: `profitAndLoss`, `balanceSheet`,
   `cashFlow`. Każda: hierarchia pozycji, roll-up sum, okresy w kolumnach
   (okres + porównawczy), znacznik „suma" na wierszu sumarycznym, waluta
   i jednostka w nagłówku. **To jest funkcja bez Reacta — testujesz ją bez ekranu.**
2. **Stan uczciwy (`Z16`).** Gdy brak zmapowanych linii — struktura niesie
   `emptyReason`, a nie tabelę wypełnioną zerami. Klucz i18n EN+PL:
   „This statement has no mapped lines yet — map them in the Data step."
3. **Powłoka artefaktu — ZA FLAGĄ `VITE_FINANCE_MINIMUM` = OFF.** Osadzasz
   **istniejący** `ArtifactRightPanel` z `src/components/standard/` (sekcje:
   Properties · Lineage · Sources · Comments · History · Teresa) i Menu 3
   (Data · Validation · Reports). **Zakaz własnej powłoki, własnego prawego
   panelu i drugiego `<aside>`** — kanon `ARTIFACT_ANATOMY_STANDARD.md` §10.2,
   §11.2, archetyp D (Matryca) §13.4.
   **Przy fladze OFF komponent renderuje DOKŁADNIE dzisiejsze drzewo.**
4. **Trzy `<table>` w centrum** dostają komentarz `§27-exempt` z uzasadnieniem
   „archetyp Excel: komórki-liczby, kolumny to okresy, zero kebaba i preview".
5. **Sekcja Lineage** czyta trasę z `E3` (pojedynczą albo zbiorczą — uzasadnij).

**Testy:** `deriveStatementTable.test.ts` (jednostkowy, min. 6: trzy tabele,
hierarchia, roll-up, okres porównawczy, `emptyReason`, brak zer przy braku linii)
+ `StatementPackWorkspaceV2.artifactShell.test.tsx` (min. 2: przy fladze ON
dokładnie **jeden** `aside` i trzy tabele; przy fladze OFF drzewo bez `aside`).

**Dowód mutacyjny (`Z32`):** usuń `ArtifactRightPanel` z gałęzi ON → test spada
na liczbie `aside`; cofnij.

**Definicja ukończenia:** trzy struktury tabel z testami; gałąź OFF udowodniona
jako identyczna z dzisiejszą; zero własnych komponentów powłoki; klucze EN+PL.

**★ Puste tabele na tym etapie są OCZEKIWANE**, jeżeli w Twojej bazie nie ma
zmapowanych linii (`F1 §F‑M4 §8`). To stan uczciwy, nie defekt.

---

## E5 — `F‑M2`: KONIEC CRIMSONA I KANON TABEL

**Cel z F1 §F‑M2 §1:** *„W Finansach czerwień pojawia się wyłącznie przy błędzie
spójności (bilans się nie domyka) lub odrzuceniu — nigdzie indziej; żadna lista
rekordów nie ma własnej tabeli."*

**TŁO KANONU (musisz to wiedzieć przed pierwszą zamianą):** klasa `primary-*`
w tailwindzie tego repo to **crimson `#85182F`** — semantyka krytyczna
(`CLAUDE.md` §3). Stan aktywny i CTA = neutralne tokeny `c-*`, fokus = `c-focus`,
błąd = `c-danger`. **Każdy numer po `primary-` jest crimsonem** — `primary-50`
tak samo jak `primary-900`.

**Kroki:**

1. **34 zamiany `primary-*` → `c-*`** w 9 plikach. **Commituj per plik**
   (`ryzyko kolizji WYSOKIE`). Rozkład w `§0.1a` komenda (1).
2. **Sklasyfikuj 14 nieoznaczonych `<table>`** (lista w `§0.1a` komenda 2,
   ścieżki poprawione w `§0.2d` pkt 19–20):
   - **arkusz (Excel)** — komórki-liczby, kolumny to okresy albo pola jednej
     edycji, zero kebaba, zero preview → **znacznik `§27-exempt` + jedno zdanie
     uzasadnienia w komentarzu na otwierającym tagu**;
   - **lista rekordów** — kolumny to encje, jest kebab albo preview →
     **przepisanie na `StandardTable`**. F1 typuje 2–3 takie pliki
     (`ModelVersionHistory`, `BenefitsTrackingDashboard`). **Zweryfikuj sam.**
3. **ZAKAZ tworzenia nowego komponentu tabeli.** Jeżeli `StandardTable` nie
   przyjmuje tego, czego potrzebujesz — **czerwony kontrakt + brief**, nie własna
   tabela (to złamało zamrożony kanon 07-12, `CLAUDE.md` §9).
4. **Dowód mutacyjny na bezpieczniku (`Z32`):** przywróć jedną klasę
   `primary-500` → `bash scripts/check-list-canon.sh` albo
   `bash scripts/check-artefakt.sh` **musi to złapać**. Jeżeli nie łapie —
   **dopisz regułę do bezpiecznika**, nie obchodź go.

**Samokontrola (obie komendy do raportu):**

```bash
grep -rn "primary-" src/components/Finance src/components/Economics --include="*.tsx" \
  | grep -v __tests__ | grep -vE "^\S+:[0-9]+:\s*(\*|//)"     # 0 linii
grep -rn "<table" src/components/Finance src/components/Economics --include="*.tsx" \
  | grep -v __tests__ | grep -v "§27-exempt"                   # 0 linii
bash scripts/check-list-canon.sh     # exit 0, dlug nie rosnie (dopuszczalny SPADEK)
bash scripts/check-artefakt.sh       # exit 0
```

**Definicja ukończenia:** obie komendy dają `0`; oba bezpieczniki `exit 0`;
dowód mutacyjny w obie strony; klasyfikacja 14 tabel wypisana w raporcie
z jednym zdaniem uzasadnienia na tabelę.

**★ ZRZUTÓW NIE ROBISZ** (`Z11`). F1 §F‑M2 §6 każe zrobić 4 zrzuty jasny+ciemny
— **to praca robotnika wewnętrznego po Tobie.** Wpisz do raportu, że gałąź jest
gotowa do przeglądu wizualnego i którymi ekranami trzeba go objąć.

---

## E6 — `F‑M7`: SEED **EN** DLA CD PROJEKT Z TRYBAMI I MANIFESTEM

**Cel z F1 §F‑M7 §1** (skorygowany decyzją z 06.09 — patrz `K‑7`):
komplet danych pokazowych, na których widać przepływ
**import → pakiet Gotowy → Zatwierdzony**, po angielsku, na **CD PROJEKT**.

**★★ KOREKTA `K‑7` — CZYTAJ, ZANIM ZACZNIESZ.** F1 §F‑M7 mówi o **DBR77**
i o klikaniu w UI na stagingu. **Oba te zdania są dziś nieaktualne:**
- dane pokazowe Finansów to **CD PROJEKT** (`TRZY_POJEMNIKI_PRACY_20260906.md:31`,
  `:114`; przyczyna: legacy DBR77 2023–2025 jest niespójne —
  `PRZEKAZANIE_20260906_RANO.md:45`);
- **nie masz dostępu do stagingu** (`Z28`) i **nie logujesz się na żadne konto**.
  Twój produkt to **skrypt**, który da się uruchomić na dowolnej bazie
  z parametru, nie wyklikany stan.

**Kroki:**

1. **Nowy skrypt** (nazwa wg Twojego pomiaru, np.
   `server/scripts/finance-seed-cdprojekt-en.ts`), wzorowany kształtem na
   `scripts/dane/usun-organizacje.ts` (tryby) i treścią na
   `server/scripts/finance-seed-cdprojekt.ts` (dane). **Żadnego z nich nie
   zmieniasz.**
2. **Cztery tryby, dosłownie:**
   `--dry-run` (domyślny) · `--apply` · `--verify` · `--rollback=<manifest.json>`.
   Tryb zapisujący wymaga **dwóch kluczy** (np. `--apply` + `--potwierdzam`)
   i `--oczekiwany-host 127.0.0.1`.
3. **`Z41` — BEZWZGLĘDNIE:** nazwa bazy i host **wyłącznie z `DATABASE_URL`
   albo `--baza=`**. Skrypt **odmawia startu** bez nich. **Zero literału**
   `consultify_staging_1009`, `trolley`, `thomas`, `postgres` w commitowanym kodzie.
4. **`Z42` — BEZWZGLĘDNIE:** manifest powstaje **wyłącznie w `--apply`**.
   `--dry-run` nie tworzy pliku, nie tworzy katalogu, nie nadpisuje starego
   manifestu. Manifest leży **poza repo**
   (`~/Developer/codex-wt/codex3-artefakty/`), a w raporcie jest jego ścieżka
   i `shasum -a 256` (`Z13`).
5. **Wszystkie nazwy po angielsku** (`DEC-461`): `display_name` w stylu
   „CD PROJEKT Group — consolidated financial statements 2025 (comp. 2024)".
   **Zero rekordów testowych, zero nazw typu „test"** — dane demo są twarzą
   produktu.
6. **Idempotencja:** drugi `--apply` z tym samym kluczem **nie tworzy drugiego
   kompletu**. Test to sprawdza.
7. **`Z40` + `§0.2d` pkt 25:** `--rollback` kasuje **wyłącznie to, co wypisane
   w manifeście**, i **nigdy krawędzi `finance_lineage_edges`** (append-only).
   Rekord, którego nie da się cofnąć, zostaje w manifeście jako „nieodwracalny",
   z powodem.
8. **`--verify`** czyta stan **osobnym klientem `pg`**, nie przez warstwę
   aplikacji (`dwa-dostepy-jedna-baza-rozne-odpowiedzi`).

**Testy:** `server/src/__tests__/financeSeedCdprojektEn.pg.test.ts` (min. 6:
dry-run niczego nie zapisuje **i nie tworzy manifestu**; apply tworzy komplet;
apply drugi raz nic nie dodaje; verify zielone; rollback przywraca stan co do
wiersza; **brak `DATABASE_URL` = odmowa startu**).

**Dowód mutacyjny (`Z32`):** usuń warunek „manifest tylko przy apply" → test
`Z42` musi spaść; cofnij.

**Definicja ukończenia:** cztery tryby działają na **Twojej** bazie; manifest
tylko przy `--apply`; nazwa bazy tylko z parametru; idempotencja udowodniona;
zero polskich nazw w danych; `ie_outbox_delivery_receipts` = 0 (`§0.2b` pkt 3).

---

## E7 — RAPORT (rdzeń)

**Jedyny nowy dokument w repo** (`Z13`):
`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/98_RAPORT.md`

**Układ narzucony — nie zmieniasz kolejności ani nagłówków:**

```markdown
# RAPORT — CODEX3 — Finanse MINIMUM (F-M2/M3/M4/M6/M7)

## 0. Metryka
Marker: <SHA> · gałąź: codex/finanse-minimum-20260911
SHA po każdym etapie: E1 <sha> · E2 <sha> · E3 <sha> · E4 <sha> · E5 <sha> · E6 <sha> · E7 <sha>
Wynik `git merge-base --is-ancestor <MARKER> HEAD`: <wynik>
Wynik `git rev-parse HEAD` i `git status --short` z §0.1 krok (7): <dosłownie>
Kontener/baza/porty: cx-codex3-pg / cx_codex3_finanse / 6453, 5593
Migracje: liczba zastosowanych w przebiegu 1 i 2, wynik idempotencji
Wynik `check-freeze.sh` przed pierwszym commitem: <EXIT + komunikat>

## 1. K-PUNKTY — PRZED i PO
| K | Co mierzę | PRZED (mój pomiar) | PO (mój pomiar) | Komenda |
| K1 | klasy crimson w module | | | |
| K2 | nieoznaczone `<table>` | | | |
| K3 | wersje biznesowe wg statusu (DRAFT / IN_REVIEW / APPROVED) | | | |
| K4 | trasy odczytu rodowodu (pojedyncze / zbiorcze) | | | |
| K5 | `<aside>` w karcie pakietu | | | |
| K6 | struktury tabel z `deriveStatementTable` (0 / 3) | | | |
| K7 | wiersze listy bez sprawozdania źródłowego | | | |
| K8 | zastane czerwone testy modułu (cudzy dług) | | | |
Obok każdej mojej liczby wpisz liczbę autora instrukcji i zaznacz rozbieżność.

## 2. Stan wejściowy — 12 komend z §0.1a
Wynik każdej dosłownie, obok wyniku autora instrukcji.

## 3. Etapy — po jednej sekcji na etap
Dla każdego: co zrobiłem · definicja ukończenia i czy spełniona · komendy
dowodowe z wynikami · akapit §0.2e (która pułapka, jak wyłączona — Z44) · SHA commita.

## 4. Dowody mutacyjne (Z32)
Dla każdego: komenda psująca · wynik CZERWONY · komenda cofająca (cp) ·
wynik ZIELONY · `git diff` pusty.

## 5. Pomiar zasięgu testów (§0.4a, Z24)
`diff przed-nazwy.txt po-nazwy.txt`: nazwy DODANE, nazwy ZNIKNIĘTE.
Każda zniknięta = wyjaśnienie. Osobno: lista 27 (albo ilu naprawdę) zastanych
czerwonych testów, które NIE są moją regresją.

## 6. Deklaracja Z30
Dosłowny akapit z §0.2b (4) + wynik `ie_outbox_delivery_receipts`.

## 7. Dane pokazowe — manifest (E6)
Ścieżka manifestu · `ls -l` · `shasum -a 256` · liczby przed/po ·
wynik `--verify` po rollbacku · dowód, że `--dry-run` NIE utworzył manifestu (Z42) ·
dowód, że skrypt odmawia startu bez `DATABASE_URL` (Z41).

## 8. Korekty wobec instrukcji i wobec F1
Każda rozbieżność mojego pomiaru z liczbą autora — jako WYNIK, nie sprzeczność.
Minimum: czy F1 §F-M5 §3 („zero INSERT-ów") jest dziś fałszywe; czy tabel jest
13 czy 14; czy stan pośredni to `READY_FOR_REVIEW` czy `IN_REVIEW`; czy ścieżki
plików z F1 wskazują `Finance/` czy `Economics/`.

## 9. STOP-y
Format z §0.5, każdy z wypełnionymi polami „Licencja" i „Co dostarczyłem ZAMIAST".
**Sekcja NIEPUSTA — obowiązkowy STOP o pozycji modułu w menu głównym.**

## 10. TWIERDZENIA NIEZWERYFIKOWANE
Sekcja NIEPUSTA. Wszystko, co napisałem, a czego nie zmierzyłem u siebie.

## 11. DO DECYZJI WŁAŚCICIELA
Każdy wiersz ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć
samodzielnie". Minimum: pozycja Finansów w menu głównym (kryterium 6 pojemnika 2);
co zrobić z 3 pakietami `recoverable` i 5 `pending` w magazynie zastanym;
czy nazwa istniejącego pakietu pokazowego ma zostać po polsku.

## 12. ZNALEZISKA POBOCZNE
Minimum: 7 zastanych `.catch(() => {})` z plik:linia (Z45); znaleziska dla bloku
Codex 2 (most legacy→kanon); wszystko, co zmierzyłem w Baseline/Wycenie, a czego
nie wolno mi było ruszyć.

## 13. CO ZOSTAJE DLA ROBOTNIKA WEWNĘTRZNEGO
Lista ekranów do przeglądu wizualnego, flaga do włączenia lokalnie
(`VITE_FINANCE_MINIMUM`), i jedno zdanie „co ma się na tym ekranie pojawić".
**To jest przekazanie, nie prośba o zrzut.**

## 14. Artefakty
Ścieżki poza repo + `shasum -a 256` każdego pliku.
```

**Definicja ukończenia `E7`:** wszystkie 15 sekcji obecne, sekcje 9, 10, 11, 12
i 13 niepuste, każda liczba z komendą.

---

## Próg odbioru

Nadzorca przyjmuje blok, gdy **wszystkie** poniższe są prawdziwe:

1. `E1`, `E2`, `E3`, `E7` zrobione; `E4`, `E5`, `E6` zrobione **albo** uczciwie
   opisane jako niezrobione z powodem.
2. **`F‑M6` udowodnione łańcuchem:** realne żądanie HTTP przez `ApiGateway` →
   `SELECT status …` odczytany **na zimno** → `APPROVED`. Plus para dowodów ról.
3. **`F‑M3` udowodnione:** jedno żądanie zamiast N, zawężenie do organizacji,
   stan uczciwy przy braku krawędzi.
4. Przy fladze `VITE_FINANCE_MINIMUM` **OFF zero regresji**: pomiar `§0.4a` nie
   pokazuje ani jednej nazwy testu, która ZNIKNĘŁA, a zestaw kolumn listy
   i drzewo karty są identyczne z dzisiejszymi.
5. **Minimum trzy dowody mutacyjne w obie strony**, z komendami i wynikami.
6. `git diff --name-only <MARKER>..HEAD` **nie zawiera ani jednego pliku**
   z listy „JAWNIE NIE ZAPISZE".
7. **Poza `E5` — zero zmian wyglądu.** Dowód:
   `git diff <MARKER>..HEAD -- src/ | grep -cE "^\+.*className|^-.*className"`
   — każda linia spoza plików `E5` wyjaśniona imiennie w raporcie.
8. **`E5`, jeśli zrobione:** obie komendy `grep` dają `0`, oba bezpieczniki
   `exit 0`, żaden nowy komponent tabeli nie powstał.
9. **`E6`, jeśli zrobione:** `--dry-run` nie zostawił manifestu (`Z42`), skrypt
   odmawia startu bez `DATABASE_URL` (`Z41`), rollback przywraca stan co do wiersza.
10. **Każdy klucz i18n w parze EN+PL w tym samym commicie** (`Z46`).
11. **Akapit `§0.2e` przy każdym pakiecie użytym jako dowód** (`Z44`).
12. Raport ma wszystkie 15 sekcji, sekcje 9–13 niepuste.

## Prawo zatrzymania

Masz prawo **zatrzymać dowolny etap** i oddać zamiast niego pomiar, czerwony
kontrakt albo brief. **Nie masz prawa** zatrzymać całego bloku z innego powodu
niż pięć wymienionych w `§0.5`.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie pracy.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające, w kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie zmieniasz;
   - **nie przybijaj złego stanu** — gdy kusi Cię zielony test na dzisiejszej
     wartości, pisz `it.fails` (`Z43`);
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie"**;
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF` (`Z10`/`Z11`);
   - **nie pokazuj** — gdy nie wiesz, czy ekran jest gotowy, **nie robisz zrzutu
     i nie zapraszasz nikogo do oglądania** (`Z11`, `CLAUDE.md` reguła 7);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`, nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **nie migruj danych** — gdy nie wiesz, jaką wartość wpisać, rekord **odpada
     i idzie do manifestu**, nie dostaje wartości wymyślonej;
   - **mierz zamiast zgadywać** — gdy instrukcja albo F1 podaje liczbę, a Twój
     pomiar daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE ETAPY.**
4. **Zatrzymanie CAŁEGO bloku** — wyłącznie z pięciu powodów z `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona. **Dotyczy to również F1** — dokument
   z 05.09, którego część tez już się zestarzała (`§0.2d` pkt 19–25).

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „STAN ZMIERZONY" jest SUKCESEM tego bloku, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

## AUDYT SPRZECZNOŚCI (wykonany przez autora przed wydaniem)

| Para wymagań, które mogłyby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| `Z34a` „push po pierwszym commicie" **kontra** „NIE pushuj" ze zlecenia | `§0.1`, akapit „ROZSTRZYGNIĘCIE `Z34a`" — push wyłączony, wiersz `Z34a` oznaczony jako wyłączony |
| Wklejki F1 „`git worktree add /private/tmp/f-m2 … origin/staging`" **kontra** `§0.1` (vault, `origin/integracja/20260911`, `~/Developer`) | Ramka „ZAKAZ NR 1", trzeci akapit + ramka markera — wklejki F1 jawnie unieważnione |
| `Z10` „zero nowych flag" **kontra** `E3`/`E4` wymagające flagi | `Z10` wymienia wyjątek imiennie: `VITE_FINANCE_MINIMUM`, default OFF |
| `Z11` „nie odsłaniasz ekranu" **kontra** F1 §F‑M2/M3/M4 §6 żądające zrzutów | „POZA ZAKRESEM" + tabela `§0.5` (wiersz „F1 każe robić zrzuty") + `E7` sekcja 13 — zrzuty przechodzą do robotnika wewnętrznego |
| `Z40` „nie kasujesz danych" **kontra** `E6` tryb `--rollback` | `E6` krok 7 — rollback kasuje **wyłącznie wiersze wypisane w manifeście**, nigdy krawędzi rodowodu |
| `Z42` „manifest tylko przy apply" **kontra** „dowód z suchego przebiegu" | `E6` krok 4 + `E7` sekcja 7 — dowodem suchego przebiegu jest **log na stdout**, nie plik manifestu |
| „zakres = `F‑M2/M3/M4/M6/M7`" **kontra** zależności `F‑M3←F‑M1`, `F‑M6←F‑M5` | „WERDYKT O PREMISIE" — obie zależności zmierzone jako **spełnione**, zakres jest wykonalny |
| F1 §F‑M7 „dane DBR77" **kontra** `DEC-399` / decyzje 06.09 „Finanse na CD PROJEKT" | `E6` korekta `K‑7` — obowiązuje decyzja nowsza (06.09), F1 jest z 05.09 |
| F1 §F‑M6 „`READY_FOR_REVIEW`" **kontra** kod używający `IN_REVIEW` | `§0.2d` pkt 21 — wiążący jest pomiar wykonawcy, F1 opisuje stan sprzed pomiaru |
| „`F‑M2` to zmiana wyglądu" **kontra** „zero zmian wyglądu" | „ZAKRES" pkt 4 + „POZA ZAKRESEM" — `F‑M2` to zamiana klas i znaczników w istniejących plikach, bez zmiany układu, kolejności i treści; nie jest nowym ekranem, więc nie podlega `Z11` |
| `Z13` „jeden plik raportu" **kontra** manifest danych z `E6` | `Z13` + `E6` krok 4 — manifest leży **poza repo**, w raporcie jest ścieżka i suma kontrolna |
| `Z18` „nie ruszasz konfiguracji testów" **kontra** potrzeba `DB_TYPE=postgres` | `§0.2c` + `§0.2d` pkt 5 — obejście zmiennymi w linii komendy, plik nietknięty |
| `Z12` „nie ruszasz bramek platformowych" **kontra** kryterium 6 pojemnika 2 („moduł ukryty za jawnym «wkrótce»") | `§0.5`, akapit o obowiązkowym STOP-ie — pozycja w menu to decyzja właściciela, wykonawca dostarcza pomiar |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wypisane i rozstrzygnięte w treści | **TAK** (tabela wyżej, 13 par) |
| 2 | Weryfikacja każdej ścieżki pliku na markerze; nieistniejące oznaczone jako `NOWY PLIK` | **TAK** — wszystkie ścieżki sprawdzone na worktree z linii `origin/integracja/20260911`. ★ Sprostowania wobec F1: siedem plików leży w `src/components/Economics/`, nie `src/components/Finance/`; numery linii przesunięte o 1–3 (`§0.2d` pkt 19–20) |
| 3 | Każda liczba ma komendę, uruchomioną przez autora na markerze | **TAK** — tabela mianowników, 17 wierszy; wiersz 17 jawnie oznaczony jako liczba CUDZA do przemierzenia |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | **TAK** — w każdym wierszu jest rzeczownik-produkt |
| 5 | Wykonalność per etap bez plików przekrojowych, udowodniona komendą | **TAK** — kolumna w tabeli etapów, wszystkie `NIE` |
| 6 | Zasoby wyłączne sprawdzone wobec stanowisk równoległych | **TAK** — porty `6453`/`5593` wolne, kontener `cx-codex3-pg` nie istnieje, przedział migracji `20262150`–`20262159` pusty (najwyższy zajęty w repo: `20262107`), gałąź i worktree nie istnieją, flaga `VITE_FINANCE_MINIMUM` = 0 trafień |
| 7 | Komendy paste-ready, pełne ścieżki, komplet env w jednej linii, `--retry=0` | **TAK** |
| 8 | Pułapki środowiska wklejone w całości + pułapki własne modułu | **TAK** — 18 ogólnych + 7 własnych (`§0.2d` pkt 19–25) |
| 9 | Samodzielność dokumentu — zero odwołań do rozmów, każdy kontekst ze ścieżką w repo | **TAK** — F1 leży w repo (`docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md`), nie trzeba załącznika |
| 10 | Klauzula sprzeczności pełna, `§0.5` z tabelą „STOP proceduralny zakazany" | **TAK**. `grep -o '<<MARKER_SHA>>' 01_INSTRUKCJA.md \| wc -l` → **4** (linie 37, 91, 157, 174) — to jedyne pola szablonu, które zostały; SHA markera wpisuje CTO przed wydaniem. `grep -c 'MARKER_SHA'` daje **6**, bo dwa dodatkowe wiersze to PROZA o tym polu (ramka markera i ten wiersz), nie pola do wypełnienia |
| 11 | Nowe bezpieczniki z 10.09 (`Z41`–`Z46`) obecne i podparte incydentem | **TAK** — tabela zakazów, wiersze `Z41`–`Z46`; każdy ma kolumnę „Dlaczego (incydent)" |
| 12 | Granica wobec bloku równoległego (Codex 2, „dwa magazyny") wypisana imiennie | **TAK** — „STAN ZMIERZONY (b)" + „POZA ZAKRESEM" |

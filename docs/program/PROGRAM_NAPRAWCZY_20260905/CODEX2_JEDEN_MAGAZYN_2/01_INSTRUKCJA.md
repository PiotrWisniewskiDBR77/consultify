# INSTRUKCJA — Codex — „JEDEN MAGAZYN, CZĘŚĆ 2: reszta projekcji + część zapisowa inicjatyw"

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
> **wyłącznie** `/Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2`.
>
> **★★ DRUGI ZAKAZ MIEJSCA (08.09, incydent realny): NIE PRACUJESZ W `/private/tmp`.**
> Restart maszyny 08.09 wyczyścił `/private/tmp` i skasował worktree, sekrety
> i zrzuty sześciu wykonawców naraz. Twój worktree i wszystkie katalogi
> pomocnicze mają leżeć pod `/Users/piotrwisniewski/Developer/`, nie w `/private/tmp`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `19440011e9`**
> **Gałąź bazowa: `origin/integracja/20260911`** (w vaulcie; to jest linia
> integracyjna na dzień 2026-09-11 — niesie blok Codexa nr 1 `E1`–`E6`
> oraz naprawy `C1-FIX` i `C2-FIX`). **NIE `origin/staging`** — `origin/staging`
> jest starszy i nie ma tych napraw; start z niego to natychmiastowy konflikt
> przy scaleniu.
> **Stan dokumentu: WYDANY — 2026-09-11 01:50, CTO (Fable), marker `19440011e9` = tip `origin/integracja/20260911` (blok Codexa 1 + FIX-y); Codex 3 pracuje równolegle na tej samej bazie — nie dotykaj `finance_*`**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo napis `MARKER_SHA` w nawiasach kątowych —
> **dokument nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-11.
Autor zlecenia: nadzorca sesji głównej (CTO), w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**. Kod, identyfikatory, nazwy plików,
komunikaty w kodzie i klucze i18n: **angielski** (`DEC-461`).
Zakres: **`05_INITIATIVES` (część ZAPISOWA) + `04_ASSESSMENT` + FINANSE +
ARTEFAKTY — warstwa DANYCH, zero zmian wyglądu.**
Pozycja programu: pojemnik 2, **kryterium 5** —
*„dwa magazyny zlikwidowane albo spięte projekcją: inicjatywy, oceny (jądro vs
zastane), analizy finansowe, artefakty (aliasy) — z testem, że nowy rekord z UI
trafia do obu odczytów"* (`docs/program/TRZY_POJEMNIKI_PRACY_20260906.md`).
Poprzednik: blok **CODEX1** („Inicjatywy: jeden magazyn danych"),
`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/01_INSTRUKCJA.md`
— dowiózł **czytnik** (`initiativeUnifiedReader`) i **migrację**; **NIE** dowiózł
części zapisowej ani pozostałych trzech domen. Ten blok domyka resztę.

Trasy front: karta inicjatywy (`InitiativeDocumentView`), `/inicjatywy`,
`/ocena` (`AssessmentHub`, `AssessmentOutputsTab`), `/finanse` (`FinanceHub`),
Materiały/artefakty. **Front dotykasz WYŁĄCZNIE tam, gdzie przepinasz wołacza —
żadnej zmiany układu, kolorów, komponentów ani tekstów widocznych na ekranie.**
Trasy tył: `PUT/PATCH/POST/DELETE /api/initiatives/**` (zastane) oraz
`/api/initiatives/runtime-v1/**` (kanoniczne), `/api/v8/assessment/**`
i `/api/method/**`, `/api/v8/finance/**`, `/api/artifacts/**`.

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
WT=/Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2
MARKER=19440011e9

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego bloku
df -h /

# (1) fetch WYLACZNIE z `origin` (ODCZYT). NIGDY `--all` (remote `icloud-source`
#     jest martwy), NIGDY `git push origin` (Z1). Baza tego bloku zyje na
#     `origin/integracja/20260911`, NIE na `origin/staging`.
git -C "$VAULT" fetch origin --prune

# (2) marker — warunek rodowodu
git -C "$VAULT" log --oneline -25 origin/integracja/20260911
git -C "$VAULT" merge-base --is-ancestor "$MARKER" origin/integracja/20260911 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZYSZ GO SAM, Z VAULTA, w ~/Developer/codex-wt
mkdir -p /Users/piotrwisniewski/Developer/codex-wt
git -C "$VAULT" worktree add "$WT" -b codex/jeden-magazyn-czesc-2-20260911 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/codex2-jeden-magazyn-2/config.worktree"
cat "$VAULT/worktrees/codex2-jeden-magazyn-2/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13) — i POZA /private/tmp
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex2-scratch
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty

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
całości**. Nie improwizujesz bazy: nie startujesz z `origin/staging`,
`origin/demo`, `Londyn`, `main` ani z gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline 19440011e9..origin/integracja/20260911
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie pracy: ZAKAZANY** (`Z3`).

**★★ ROZSTRZYGNIĘCIE `Z34a` KONTRA „NIE PUSHUJESZ" (wymagane przez szkielet
`docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`, blok A.1-BIS punkt 2):**
**w TYM bloku NIE PUSHUJESZ NIC I NIGDZIE.** Twoja gałąź żyje we wspólnym
vaulcie, więc nadzorca ma do niej dostęp bez pushu. Commitujesz po każdym
etapie (`E1`…`E9`), a push i scalenie wykonuje wyłącznie nadzorca po odbiorze.
Wiersz `Z34a` w tabeli zakazów zostaje w dokumencie dla ciągłości numeracji,
ale **w tym bloku jest wyłączony tym akapitem**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 19440011e9..HEAD
```

---

### 0.1a. ★★ WERYFIKACJA STANU WEJŚCIOWEGO — CZTERNAŚCIE KOMEND, WSZYSTKIE OBOWIĄZKOWE

Każda ma podany **wynik autora instrukcji** (zmierzony 2026-09-11 na markerze
i na kopii bazy `consultify_staging_1009`); rozbieżność idzie do „Korekt wobec
instrukcji", **nie do improwizacji**. **Twój pomiar jest wiążący, nie mój.**

```bash
cd "$WT"

# (1) ★★★ RDZEN CZESCI ODCZYTOWEJ: ile bramek istnienia inicjatywy pyta
#     WYLACZNIE tabele zastana.
grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ | wc -l
#   moj wynik: 50 trafien w 19 plikach.

# (2) ile z tych 50 ma juz fallback do rejestru kanonicznego (czytnik z CODEX1)
for f in $(grep -rl "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__); do \
  for ln in $(grep -n "SELECT id FROM initiatives WHERE id" "$f" | cut -d: -f1); do \
    s=$((ln-12)); e=$((ln+12)); \
    if sed -n "${s},${e}p" "$f" | grep -q "initiativeExists\|readInitiativeHeader\|isInitiativeUnifiedReadEnabled"; \
      then echo "FALLBACK: $f:$ln"; fi; done; done
#   moj wynik: 3 trafienia —
#     server/src/controllers/InitiativeController.ts:3275
#     server/src/routes/initiatives-additive.routes.ts:60
#     server/src/services/initiative/initiativeKpiAssignmentService.ts:262
#   Czyli DO PRZELACZENIA ZOSTAJE 47.

# (3) ★★★ RDZEN CZESCI ZAPISOWEJ: bramka, ktora blokuje zapis karty rekordu
#     kanonicznego. Wypisz WSZYSTKIE cztery i nazwij funkcje, w ktorej siedza.
grep -n "SELECT \* FROM initiatives WHERE id" server/src/controllers/InitiativeController.ts
#   moj wynik: :850 :1400 :2252 :6168
#   :850 lezy w `static updateInitiative` (:838) — to jest bramka `PUT /api/initiatives/:id`,
#   ktora dla rekordu istniejacego WYLACZNIE w kanonie zwraca 404.

# (4) kanoniczne komendy runtime-v1 — pelna lista sciezek zapisu
awk '/router\.(post|put|patch|delete)\(/{m=$0; getline nxt; print (NR-1)": "nxt}' \
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts | sed 's/  */ /g'
#   moj wynik: 87 komend. Kluczowe dla tego bloku:
#     :2198 PATCH /initiatives/:initiativeId/metadata
#     :5755 POST   /initiatives/:initiativeId/raid-items/:raidItemId
#     :5835 PATCH  /initiatives/:initiativeId/raid-items/:raidItemId
#     :5792 DELETE /initiatives/:initiativeId/raid-items/:raidItemId
#     :5663 POST   /initiatives/:initiativeId/budget-entries/:entryId
#     :4977 POST   /execution-cases/:executionCaseId/milestones/:milestoneId
#     :4483 POST   /resource-commitments/:commitmentId
#     :7404 POST   /initiatives/:initiativeId/gate-signoffs

# (5) ★ KTORE POLA przyjmuje jedyna kanoniczna komenda metadanych
sed -n '284,300p' server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
#   moj wynik: AmendInitiativeMetadataSchema przyjmuje DOKLADNIE cztery pola
#   merytoryczne: `title`, `problem`, `proposedOutcome`, `initiativeOwnerId`
#   (+ `expectedVersion`, `clientRequestId`). PRIORYTET, DATY, ZAKRES, BUDZET,
#   TAGI, SPONSOR — NIE MAJA kanonicznego pisarza.

# (6) co dzisiaj wysyla karta dla rekordu kanonicznego (naprawa E1a)
grep -n "handleSaveRuntimeOnlyMetadata" -A 20 src/components/Initiatives/InitiativeDocumentView.tsx | head -40
#   moj wynik: wysyla `title`, `summary`, `description`. **NIE wysyla `initiativeOwnerId`,
#   mimo ze kanon go przyjmuje** — to jest luka do zamkniecia w E1.

# (7) szesciu pisarzy zastanych bez nastepcy — czy ktos ich wola z `src/`
for p in milestones resources staffing-plans budget-items gate-roles move; do \
  echo "--- $p ---"; grep -rn "initiatives/.*/$p" src | grep -v __tests__ | head -3; done
#   moj wynik: WSZYSTKIE SZESC maja realnych wolaczy w `src/`. Odpowiedz na
#   pytanie 1 z procedury E2 brzmi TAK dla kazdej z nich.

# (8) ★ OCENY: ile bramek istnienia oceny pyta magazyn zastany
grep -rn "FROM assessments WHERE id" server/src | grep -v __tests__ | grep -v "_backup/" | wc -l
#   moj wynik: 37 (AssessmentController.ts 9, v8/assessment.routes.ts 5,
#   AssessmentWorkbenchService.ts 4, assessmentInitiativeService.ts 3,
#   assessment/assessment-workflow.routes.ts 3, assessment-workflow-v2.routes.ts 2, reszta po 1)

# (9) ★ OCENY: gdzie mieszka dzisiejsza projekcja
grep -rn "assessmentOutputProjection" src | grep -v __tests__ | head
find server/src -iname "*assessmentUnifiedReader*" -o -iname "*assessmentsUnifiedReader*"
#   moj wynik: projekcja zyje WYLACZNIE W PRZEGLADARCE
#   (src/components/assessment/assessmentOutputProjection.ts, wolana z
#   AssessmentOutputsTab.tsx:62 i AssessmentHub.tsx:108).
#   Serwerowego czytnika tozsamosci NIE MA — `find` daje zero.

# (10) ★ FINANSE: czy most legacy->kanon istnieje i kto go czyta
ls -l server/src/services/finance/canonical/legacyIdBridgeService.ts \
      server/src/services/finance/canonical/legacyIdentityMaterializationService.ts \
      server/src/services/financeCanonicalRegistrySyncService.ts
grep -rn "legacyIdBridgeService" server/src | grep -v __tests__ | cut -d: -f1 | sort -u
#   moj wynik: wszystkie trzy pliki ISTNIEJA (258 / 466 / 208 linii).
#   Most nazywa sie `finance_artifact_aliases` i JEST czytany — problem jest
#   w POKRYCIU, nie w istnieniu (patrz STAN ZMIERZONY (c)).

# (11) ★ ARTEFAKTY: dwa magazyny
grep -rn "FROM v8_output_artifacts\|INTO v8_output_artifacts" server/src | grep -v __tests__ | grep -v "_backup/" | cut -d: -f1 | sort | uniq -c | sort -rn | head -5
grep -rn "FROM wave5_artifacts\|INTO wave5_artifacts" server/src | grep -v __tests__ | grep -v "_backup/" | cut -d: -f1 | sort | uniq -c | sort -rn | head -5
#   moj wynik: `v8_output_artifacts` (rejestr metadanych) i `wave5_artifacts`
#   (tresc) to DWA ROZNE magazyny o wspolnej kolumnie `artifact_id`.

# (12) ★ SIODMY PISARZ ZASTANY — seed demo
grep -n "INSERT INTO initiatives" server/src/services/demo/demoSeedService.ts
grep -c "ie_aggregate_state" server/src/services/demo/demoSeedService.ts
#   moj wynik: `INSERT INTO initiatives` na :2295 (z `ON CONFLICT(id) DO UPDATE`),
#   `ie_aggregate_state` — **0 trafien**. Kazda sesja demo powieksza rozjazd.

# (13) czy w Inicjatywach/Ocenie/Finansach zostaly ciche polkniecia bledow
grep -rn "catch(() => {})" src/components/Initiatives src/components/Execution \
  src/components/assessment src/components/Finance | grep -v __tests__
#   moj wynik: 0 realnych wystapien (zostaja same KOMENTARZE o zakazie).
#   W tym bloku masz ZAKAZ DODAWANIA nowych (Z45), a nie zadanie sprzatania starych.

# (14) zasoby wylaczne: porty, kontener, przedzial migracji, flaga
lsof -nP -iTCP -sTCP:LISTEN | grep -E ":(6452|5592)\b" || echo "PORTY WOLNE"
docker ps -a --format '{{.Names}}' | grep -c "cx-codex2" || true
ls server/migrations | grep -cE "^2026214[0-9]"
grep -rn "ENABLE_INITIATIVE_UNIFIED_WRITE" src server scripts | wc -l
#   moj wynik: PORTY WOLNE; 0 kontenerow; 0 zajetych numerow w 20262140-20262149;
#   0 trafien flagi (najwyzszy zajety numer migracji: 20262107).
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

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z46`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push`** — na żaden remote, na żadną gałąź. `git fetch origin` (ODCZYT) jest dozwolony i wymagany w `§0.1` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz** `origin/demo`, `Londyn`, `origin/staging`, `origin/integracja/20260911` ani żadnej cudzej gałęzi `codex/*`, `mvp/*`, `fix/*`, `chore/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i jawnie zamówiony** | Cudze tory w toku — 10.09 biegło równolegle kilkanaście stanowisk |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie pracy | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS. **W tym bloku ma to konkretny skutek: `server/src/_backup/**` ma trafienia `FROM initiatives` i `FROM assessments` — NIE liczysz ich i NIE ruszasz** |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/Users/piotrwisniewski/Developer/wt/**`, `/Users/piotrwisniewski/Developer/codex-wt/codex1-*` ani `/private/tmp/**`. **Wyjątek: katalogi, które SAM zakładasz w `§0.1`, są Twoje** | 10.09 żyło 26 równoległych worktree; **kontener i artefakty CODEX1 są cudze — tylko odczyt** |
| `Z7` | **★★ Twój JEDYNY port bazy to `6452`. Twój JEDYNY port harnessu to `5592`.** Nazwa kontenera: **`cx-codex2-pg`**. **ZAKAZANE porty (zajęte, zmierzone 11.09): `5432`, `5433`, `6012`, `6451`, `54418`, `55441`, `55461`.** Sprawdzasz sam przed startem (`§0.1a` komenda 14) | Trzy incydenty zapisu do cudzej bazy; `6451` należy do CODEX1 |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego bloku** — nigdy demo, staging, produkcja ani cudza retained-DB. **Baza `consultify_staging_1009` w kontenerze `consultify-pg18` jest ŹRÓDŁEM SZABLONU — czytasz z niej `TEMPLATE`, nie piszesz do niej** | Demo i staging mają dziś OSOBNE bazy, obie żywe, obie poza Twoim zasięgiem |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi**, poza JEDNĄ jawnie zamówioną w `E1` (`ENABLE_INITIATIVE_UNIFIED_WRITE`, **default OFF**). **`ENABLE_INITIATIVE_UNIFIED_READ` istnieje z CODEX1 i jej domyślnej też NIE ZMIENIASZ** | Krach 07-12: masowe włączenie flag wizualnych na żywo (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Ten blok **nie tworzy żadnego nowego ekranu** — jeżeli w trakcie uznasz, że musisz coś narysować, to jest STOP MERYTORYCZNY, nie zadanie | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `server/src/services/assessmentPermissionService.ts` | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md`. **Zrzuty, logi, manifesty i pliki wynikowe NIE wchodzą do repo** — leżą w `/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym bloku.** Żaden pomiar, strażnik, migracja ani test nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; migracja danych nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | Uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego bloku** — z imiennymi licencjami z tabeli licencji | Rozłączność ze stanowiskami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `playwright.config.ts`, `playwright.smoke.config.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO bloku, W TEJ SAMEJ LINII komendy.** Kolejność wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. **W tym bloku szczególnie: (a) projekcja NIE MOŻE ukrywać rekordu, którego nie umie zmapować — ma go policzyć i wypisać; (b) `200` bez identyfikatora i bez tytułu w treści NIE JEST zaliczeniem powierzchni** (odbiór C2 nazwał to „kryterium słabym" i odrzucił) | `DEC-2026-08-25-21/22`, `DEC-51`, `FIX-E5-3` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie | Liczby autora instrukcji krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener** na porcie `6452` | **Port `5432` NASŁUCHUJE i nie jest Twój; `6451` należy do CODEX1** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci.** Stan odkładasz przez `cp` do `codex2-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY blok.** „Przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it` | Test „409 dla pisarza zastanego" leczy się skutkiem własnego ataku i raportuje `PASS` |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie** protokół `§0.2b` | Wysłany e-mail jest **nieodwracalny**. **W tym bloku ma to ostrze: każda komenda kanoniczna produkuje `ie_outbox_events`** |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW** | Dyżur 43 przypiął strażnik do swojej bazy: 30 przypadków stało się trwałym `SKIP`, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`) | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała**. **CODEX1 oddał `E5` BEZ dowodów mutacyjnych — odbiór C2 uznał definicję ukończenia za niespełnioną. Nie powtarzasz tego** |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2e` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 zmierzono kompletny łańcuch, a każdy realny `POST` zwracał `500` |
| `Z34a` | **WYŁĄCZONY W TYM BLOKU** — patrz rozstrzygnięcie w `§0.1`: nie pushujesz nic i nigdzie | Numeracja `Z` jest wspólna dla wszystkich instrukcji i nie wolno jej przestawiać |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, poszerzanie `exclude`/`testIgnore`, obniżanie progów, `--max-warnings`, `continue-on-error: true`. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**. **`it.todo` jest dopuszczalny WYŁĄCZNIE w kształcie opisanym w `Z43` i NIGDY w `E8`** | To choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu** | Autofix skasowałby pracę **wszystkich** równoległych stanowisk |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | **★★ ZAKAZ WŁAŚCIWY TEMU BLOKOWI: NIE KASUJESZ ANI NIE PRZEMIANOWUJESZ ŻADNEJ TABELI ZASTANEJ.** Dotyczy: `initiatives`, każdej `initiative_*`, `assessments`, każdej `assessment_*`, `financial_*`, `v8_output_artifacts`, `wave5_artifacts`, `knowledge_docs`, `tool_outputs`. Migracje są **wyłącznie addytywne**: zero `DROP`, zero `RENAME`, zero `DELETE` na danych zastanych, zero `TRUNCATE`, zero modyfikacji **istniejących** plików w `server/migrations/**` | 09.09 czystka „sierot" skasowała 319 wierszy konfiguracji produktu — po niej **każde tworzenie inicjatywy zwracało `500`** |
| `Z41` | **★★ NOWY (11.09): NAZWA BAZY JEST PARAMETREM, NIGDY STAŁĄ W KODZIE.** Każdy skrypt danych, harness i test, który dostarczasz, przyjmuje nazwę bazy **jawnym argumentem** (`--baza=<nazwa>` / zmienną środowiskową) i **odmawia bez niego**. **Zakaz `if (database !== '<moja-nazwa>') throw`.** Bezpieczeństwo zapewnia **czarna lista hostów** (skopiuj `FORBIDDEN_DB_HOSTS` z `tests/integration/_helpers/assertRealPostgres.ts`) plus `--oczekiwany-host 127.0.0.1`, nie przybita nazwa | **FIX-E3-1 z odbioru C2:** `scripts/dane/migruj-inicjatywy-do-kanonu.ts:68` przybił `codex1_staging_1009` twardym `throw`. Skrypt jest przez to bezużyteczny poza kontenerem CODEX1 — nie da się nim zmigrować kopii demo ani stagingu |
| `Z42` | **★★ NOWY (11.09): MANIFEST I PLIKI Z DANYMI KLIENTA POWSTAJĄ WYŁĄCZNIE W TRYBIE ZAPISUJĄCYM.** Tryb suchy (`--dry-run`) **nie zapisuje na dysk ani jednego wiersza danych klienta**; żeby coś zapisał, potrzebuje jawnego `--zapisz-manifest`. Manifest zapisujesz z trybem `0600` | **FIX-E3-2 z odbioru C2:** `--dry-run` wyprodukował plik 920 KB z **105 pełnymi wierszami klienta × 106 kolumn**. Tryb suchy nie ma prawa robić kopii danych osobowych |
| `Z43` | **★★ NOWY (11.09): TEST NIE PRZYBIJA STANU ZASTANEGO.** Asercja celu ma kształt `expect(widoczne).toEqual(expect.arrayContaining([...]))` — rośnie razem z postępem. Snapshot dzisiejszego, złego stanu wolno zapisać **wyłącznie osobno**, jawnie nazwany (`it('SNAPSHOT STANU ZASTANEGO — …')`) i z komentarzem, kiedy ma zniknąć. **Powierzchnia jeszcze niepodłączona = `it.todo('…')` z nazwą, nie `toEqual([])`.** **W `E8` `it.todo` jest ZAKAZANY — tam wszystkie 7 ma być zielone** | **FIX-E5-1 z odbioru C2:** `expect(visible).toEqual(ON ? ['lista','karta','KPI'] : [])` zrobiłby się CZERWONY dokładnie wtedy, gdy ktoś podłączy powierzchnię 4/5/6/7 — test **karał za postęp** i siedział w domyślnej suicie CI |
| `Z44` | **★★ NOWY (11.09): AKAPIT `§0.2e` JEST OBOWIĄZKOWY I MIESZKA W PLIKU TESTU, NIE TYLKO W RAPORCIE.** Każdy nowy pakiet dowodowy ma (a) komentarz nagłówkowy rozstrzygający pułapki (a)–(f) i (b) **twarde asercje w `beforeAll`**: `expect(process.env.DB_TYPE).toBe('postgres')`, `expect(process.env.ENABLE_V8_GLOBAL).toBe('true')`, `expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce')`, `expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true')`. **Pomiar bez tego akapitu nie liczy się jako dowód** | **FIX-E5-2 i FIX-8 z obu odbiorów:** akapitu zabrakło w pakiecie i w raporcie; odbierający musiał zrobić dowód za wykonawcę |
| `Z45` | **★★ NOWY (11.09): ZERO `.catch(() => {})` I ZERO CICHEGO POŁKNIĘCIA W KAŻDEJ ŚCIEŻCE, KTÓREJ DOTYKASZ.** Dotyczy też `try { … } catch {}` bez logu i bez komunikatu. Każda ścieżka zapisu, którą przepinasz, ma kończyć się albo sukcesem, albo **widocznym dla człowieka** komunikatem. Pomiar wejściowy: **0 realnych wystąpień** (`§0.1a` komenda 13) — więc to jest zakaz dodawania, nie zadanie sprzątania | Cisza po nieudanym zapisie to dokładnie ten kształt, który 07.09 kosztował odbiór dwóch modułów |
| `Z46` | **★★ NOWY (11.09): KLUCZE I18N W PARYTECIE PL + EN, W TYM SAMYM COMMICIE, WARTOŚĆ TŁUMACZONA.** Nowy klucz komunikatu wchodzi jednocześnie do `public/locales/pl/translation.json` i `public/locales/en/translation.json`. **Klucz obecny w `pl` z angielską wartością NIE jest tłumaczeniem** — bramka to zliczy jako brak. Zakaz zmiany wartości istniejących kluczy | Kształt „klucz istnieje ≠ przetłumaczony"; audyt po istnieniu klucza dawał fałszywą zieleń |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **NIE SZUKAJ flagi `ENABLE_LIVE_EMAIL`. Ona NIE ISTNIEJE** — `grep` po całym
  `server/src` i `src` daje zero trafień. To fantom powielany w starych
  instrukcjach. Realny warunek wysyłki: `emailService.ts` (ok. `:202`) tworzy
  transporter dopiero, gdy zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero
  potem ze zmiennych środowiskowych;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  gdziekolwiek;
- **★ zrobić `source ~/Developer/consultify-secrets/server.env`.** Ten plik
  niesie **ŻYWE poświadczenia SMTP** (`SMTP_HOST/PORT/USER/PASS/FROM`,
  `EMAIL_FROM`) — zmierzone w odbiorze C2, sekcja 5 pkt 4. Jeżeli z jakiegoś
  powodu go użyjesz, **natychmiast** po tym wołasz
  `unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM EMAIL_FROM`
  i wklejasz do raportu wynik `env | grep -iE "^(SMTP_|EMAIL_FROM)"`;
- wstawić wiersza konfiguracji SMTP do tabeli `settings` w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` — tam startują drenaże outboxów;
- wywołać ręcznie `drain*` / `startNotificationOutboxDrainCron` / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek zapisującego:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|EMAIL_FROM)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY.
docker exec cx-codex2-pg psql -U postgres -d cx_codex2 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad.

# (c) zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" \
  server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) ★★ DODATKOWY DOWÓD WŁAŚCIWY TEMU BLOKOWI.** Każda komenda kanoniczna,
którą wywołasz w `E1`, `E2` i `E8`, dopisuje wiersze do `ie_outbox_events`.
**Po KAŻDYM etapie zapisującym raport ma zawierać wynik:**

```bash
docker exec cx-codex2-pg psql -U postgres -d cx_codex2 -Atc \
  "SELECT count(*) FROM ie_outbox_delivery_receipts;"
#   oczekiwane: 0 — zdarzenia moga LEZEC w outboxie, ale NIC nie zostalo doreczone.
```

**(4) Deklaracja obowiązkowa w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie wczytałem
`server.env`. Baza tego bloku nie zawiera wierszy konfiguracji SMTP. Nie
uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu.
`ie_outbox_delivery_receipts` po wszystkich etapach ma 0 wierszy. Żaden e-mail,
zaproszenie kalendarzowe ani powiadomienie nie zostało wysłane."**

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2

docker run -d --name cx-codex2-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_codex2 \
  -p 127.0.0.1:6452:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-codex2-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6452/cx_codex2 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6452/cx_codex2 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK.
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(A2) KOPIA DANYCH DO POMIARU ROZJAZDU — z lokalnego szablonu, bez sieci.**
Na hoście działa kontener `consultify-pg18` (port `54418`) z bazą
`consultify_staging_1009` — to **lokalna kopia** stagingu z 10.09, **nie**
połączenie zdalne, więc `Z28` nie jest naruszone. Kopiujesz ją do **swojego**
kontenera przez zrzut, nazwę bazy podajesz **parametrem** (`Z41`):

```bash
BAZA_ZRODLO=consultify_staging_1009
BAZA_MOJA=codex2_kopia_1009
mkdir -p /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty

docker exec consultify-pg18 pg_dump -U postgres -Fc "$BAZA_ZRODLO" \
  > /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/zrodlo.dump
shasum -a 256 /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/zrodlo.dump

docker exec cx-codex2-pg psql -U postgres -c "CREATE DATABASE $BAZA_MOJA;"
docker exec -i cx-codex2-pg pg_restore --no-owner --no-privileges \
  -U postgres -d "$BAZA_MOJA" \
  < /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/zrodlo.dump 2>&1 | tail -5
```

**Do bazy `consultify_staging_1009` piszesz ZERO razy** — wyłącznie `pg_dump`
i `SELECT`. To jest warunek `Z9`.

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6452/cx_codex2 \
JWT_SECRET=codex2-jeden-magazyn-lokalny-sekret-testowy \
npx vitest run <ŚCIEŻKI> --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/<NAZWA>.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje `No test files found`
— a to NIE jest `PASS`.** Sprawdź, którego configu wymaga dana ścieżka,
i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają połączenia):

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run <ŚCIEŻKI> --retry=0 \
  --reporter=json --outputFile=/Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/<NAZWA>.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`.**
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują. **Atrapa `Database.ts:686` zwraca `changes:1` dla KAŻDEGO `UPDATE`, niezależnie od `WHERE` — Twój test „zapis karty się udał" przeszedłby na niej zawsze** |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik Wyników przepuszcza wszystko przy `NODE_ENV=test`. **W `E8` to krytyczne — dowodzisz widoczności rekordu w module Wyniki** |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „legacy zapis odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE OGÓLNYCH + SIEDEM WŁASNYCH

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add` **musisz** utworzyć `<vault>/worktrees/codex2-jeden-magazyn-2/config.worktree` z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
2. **Remote `icloud-source` w vaulcie jest MARTWY.** Nie wołaj `git fetch --all`. Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`.** Każde zapytanie: `docker exec cx-codex2-pg psql -U postgres -d <baza> -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.**
5. **`vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** `DB_TYPE=postgres` musi stać **w tej samej linii komendy**, a Ty **udowadniasz asercją, że nadpisało** (`Z44`). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. **Dotyczy wprost `ie_aggregate_state.payload_json` i `assessments.answers_json`.**
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** „CI zielone" nie jest dowodem. Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest.** Używasz `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów.** Liczby i nazwy czytasz z JSON-a, nie z kodu wyjścia.
11. **Nowe pliki w `tests/` wymagają `git add -f`.** Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy czytelnik" wymaga grepu **bez obcięcia**.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` spoza repo nie znajdzie pakietów — `createRequire(REPO + '/package.json')`.
14. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`. Obraz obowiązkowy: `pgvector/pgvector:pg16`.
15. **`prettier` na wielkich plikach przepisuje cały plik.** **`InitiativeDocumentView.tsx` ma 12 339 linii** — reformat tego pliku jest katastrofą przeglądową. Reformat większy niż ~3× Twoje linie merytoryczne — **cofasz** (`cp`, nie `stash`).
16. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** asertujące **dosłowne linie kodu**. Zapalony po Twoim reformacie = regresja reformatu.
17. **`npx vitest` z roota bez właściwego configu daje `No test files found`.** To **nie jest `PASS`** — to jest brak pomiaru.
18. **`grep -rn … --include='*.ts'` w `zsh` potrafi zwrócić PUSTKĘ** zamiast wyników. **Pustka nie jest wynikiem.** Cytuj wzorzec albo filtruj potokiem.

**SIEDEM PUŁAPEK WŁASNYCH TEGO BLOKU (zmierzone 11.09, nie założone):**

19. **`information_schema` w tej bazie zwraca kolumny Z DWÓCH SCHEMATÓW.**
    Obok `public` żyje schemat `fala5_backup` z własną tabelą `initiatives`.
    Zapytanie bez `table_schema='public'` **liczy podwójnie i niewidocznie**.
    Każde Twoje zapytanie do `information_schema` ma mieć jawny `table_schema`.
20. **Identyfikator inicjatywy ma DWA KSZTAŁTY.** Kanon nadaje
    `initiative-<uuid>` (`stableCommandId('initiative', …)`), tabela zastana
    trzyma dowolny `TEXT`. **Nie zakładaj wspólnego formatu.**
21. **Słowniki stanów są RÓŻNE i już się przeciekły** (opis i tabela rozjazdu:
    `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/97_ODBIOR_W1_W2.md`
    sekcja 1a). Serwerowy słownik z CODEX1 (`initiativeUnifiedReader.ts`) był
    **niezgodny z klientowym SSOT w dwóch stanach obecnych w danych**
    (`REJECTED` ×16, `PROPOSED` ×1) — `C1-FIX-3` to naprawił. **Sprawdź sam,
    czy naprawa jest w Twojej bazie kodu, zanim się na niej oprzesz.**
22. **Atrapa bazy kłamie o zapisie warunkowym.** `Database.ts:686` zwraca
    `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`. Każdy test zapisu
    uruchomiony bez `MOCK_DB=false` przechodzi zawsze.
23. **★ `409` z tras zastanych WYCHODZI Z MIDDLEWARE, PRZED handlerem.**
    `requireCanonicalInitiativeExecutionWriter` jest zamontowany w
    `server/src/routes/pmo/initiatives.routes.ts:161`, a lista wzorców siedzi
    w `executionSpineLegacyReadOnly.middleware.ts`. Twój test „POST do trasy
    zastanej daje 409" **przejdzie także wtedy, gdy handler w ogóle nie istnieje**.
    Dowód musi rozróżniać `409` z middleware (pola `code:
    'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'` **oraz** `canonicalWriter`) od `409`
    z Twojej logiki.
24. **★ `PUT /api/initiatives/:id` dla rekordu kanonicznego zwraca `404`, nie `409`.**
    Powód: bramka `InitiativeController.ts:850` pyta `SELECT * FROM initiatives
    WHERE id = ? AND organization_id = ?` i nie znajduje wiersza. **To nie jest
    odmowa — to jest „nie ma takiego rekordu".** Naprawa `E1a` (już w bazie kodu)
    ugasiła pętlę po stronie klienta; przyczyna na serwerze **stoi**.
25. **★ Nie ma taniego, `Z30`-bezpiecznego hosta dla przeglądarki.**
    `playwright.config.ts:9` czyta `E2E_USE_WEB_SERVER`, domyślnie **wyłączone**,
    więc config **nie** startuje `index.ts` — ale bez backendu Playwright i tak
    nie ma czego odpytać. Minimalny nasłuch `ApiGateway.initializeRoutes` **nie
    montuje `/api/csrf-token`** (`index.ts:1251`) ani nagłówka CORS `x-csrf-token`
    (`index.ts:1130`), więc realny frontend dostaje `401 No token provided`.
    **To jest zmierzone (odbiór C2, sekcja 1.6) — nie odkrywaj tego drugi raz.**
    W `E8` warstwę przeglądarki wolno pominąć z adnotacją; warstwy HTTP+SQL — nie.

---

> ### ★★ RAMKA DO `Z33` (`§0.2e`) — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija. `Z44` czyni tę ramkę OBOWIĄZKOWĄ — ma być w pliku testu, nie
> tylko w raporcie.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. **Dotyczy wprost
> `server/src/routes/v8/results.routes.ts` (11 z 50 bramek istnienia)
> i `server/src/routes/v8/assessment.routes.ts` (5 z 37 bramek oceny).**
> ★ Odbiór C2 zmierzył, że po ustawieniu `=true` powierzchnie 4 i 6 **dalej**
> dają `404` z treścią `INITIATIVE_NOT_FOUND` — czyli bramka **domenowa**,
> nie platformowa. **Rozróżnienie po treści odpowiedzi jest obowiązkowe.**
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.**
> `MOCK_DB=false DB_TYPE=postgres` w tej samej linii to jedyne wyjście (`Z18`).
> Config używa `process.env.DB_TYPE || 'sqlite'`, więc nadpisanie działa —
> ale **udowadniasz je asercją**, nie założeniem.
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) `requireCanonicalInitiativeExecutionWriter` odpowiada `409` PRZED handlerem**
> (`§0.2d` pkt 23). Test „trasa zastana odmawia" przechodzi także przy braku handlera.
>
> **(f) ★ WŁAŚCIWA TEMU BLOKOWI: `ENABLE_INITIATIVE_UNIFIED_READ` z CODEX1
> zmienia wynik KAŻDEGO pomiaru odczytu.** Flaga jest domyślnie `OFF`.
> Każdy pakiet, który mierzy widoczność rekordu, musi być uruchomiony
> **w OBU ustawieniach** i raport ma podać oba wyniki. Pomiar tylko przy `ON`
> zawyża; pomiar tylko przy `OFF` mierzy stan sprzed CODEX1.
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(f) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

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
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Etap jest wtedy **ZROBIONY**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Etap **ZROBIONY** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe etapy** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje inną liczbę niż mój pomiar" | Podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-codex2-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit / commit-msg blokuje commit" | **Naprawiasz komunikatem albo kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em. Mechanizm znaczników odmrożenia opisany w `§0.6` — **w tym bloku znaczników jest CZTERY** |
| „Musiałbym odłożyć stan roboczy" | `cp` do `codex2-scratch`. `git stash` jest zakazem (`Z27`) |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie etapu |
| „Playwright nie wstaje / frontend nie ładuje danych" | `§0.2d` pkt 25 — to jest **zmierzone i znane**. Robisz warstwę HTTP+SQL, adnotujesz brak warstwy przeglądarki i **etap jest ZROBIONY** |
| „Nie zdążę zrobić wszystkich etapów" | Robisz **rdzeń** (`E1`, `E2`, `E3`, `E8`, `E9`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (projekcje domen zrobione, część zapisowa „częściowo") jest podstawą odrzucenia |
| „Port `6452` albo `5592` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO bloku jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji** (`Z28`);
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6452` albo `5592`** (`Z7`).

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

---

### 0.6. ★★ MECHANIZM ZAMROŻENIA I ZNACZNIKI ODMROŻENIA — CZYTAJ PRZED PIERWSZYM COMMITEM

Właściciel odbierał MVP moduł po module i po swoim „tak" moduł został
**zamrożony**. Rejestr zamrożeń: `docs/program/MVP_FINAL_ZAMROZONE.json`
(**nie edytujesz go ręcznie**, `Z13`). Procedura: `docs/program/MVP_FINAL_PROCEDURA.md`.

**Gdzie to blokuje (zmierzone, nie założone):**

- `.husky/pre-commit` — **TYLKO OSTRZEGA** (`--tylko-ostrzez || true`). Powód
  w kodzie hooka: w `pre-commit` plik `.git/COMMIT_EDITMSG` trzyma jeszcze
  komunikat **POPRZEDNIEGO** commita.
- `.husky/commit-msg` — **TU BLOKUJE.** Woła
  `bash scripts/mvp-final/check-freeze.sh --commit-msg="$1"`; przy braku
  znacznika kończy `exit 1`. Wzorzec sprawdzany dosłownie
  (`check-freeze.sh:135`): `\[ODMROZENIE[[:space:]]+$M[[:space:]]+DEC-[0-9]+\]`.

**★★ TEN BLOK WYMAGA CZTERECH ZNACZNIKÓW — to jest zmiana wobec CODEX1.**
CODEX1 miał dwa. **10.09 zamrożono dodatkowo moduł `WSPOLNE`** (kanon
i komponenty wspólne: `standard/`, `shared/`, `ui/`, `store/`, `services/api`,
i18n — 661 plików), a ten blok dotyka Oceny. Dlatego **do KAŻDEGO commita
dopisujesz dosłownie:**

```
[ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453] [ODMROZENIE 04_ASSESSMENT DEC-453] [ODMROZENIE WSPOLNE DEC-453]
```

**Które z Twoich plików są zamrożone i gdzie (zmierzone 11.09 na markerze —
zweryfikuj sam skryptem poniżej):**

| Plik | Moduł w rejestrze |
| --- | --- |
| `src/services/initiativeWriteTruth.ts` | **`WSPOLNE`** (★ NOWE od 10.09 — CODEX1 miał go jako niezamrożony) |
| `src/services/initiatives-execution/runtimeApi.ts` | **`WSPOLNE`** (★ NOWE od 10.09) |
| `src/contracts/initiatives-execution/statusMapping.ts` | **`WSPOLNE`** (★ NOWE od 10.09) |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | `05_INITIATIVES` |
| `src/components/Initiatives/InitiativesHub.tsx` | `05_INITIATIVES` |
| `src/components/Initiatives/initiativeRegisterProjection.ts` | `05_INITIATIVES` |
| `src/components/Initiatives/initiativeDocumentSource.ts` | `05_INITIATIVES` |
| `src/components/Execution/ExecutionHub.tsx` | `06_EXECUTION` |
| `src/components/assessment/assessmentOutputProjection.ts` | `04_ASSESSMENT` |
| `src/components/assessment/AssessmentOutputsTab.tsx`, `AssessmentHub.tsx` | `04_ASSESSMENT` |
| `public/locales/{pl,en}/translation.json` | **NIEZAMROŻONE** (sprawdzone) |
| `src/components/Finance/**` | **NIEZAMROŻONE** — Finanse są poza MVP |
| `server/src/**` (wszystkie pliki serwera z tego bloku) | **NIEZAMROŻONE** |

Sprawdzenie własne przed commitem — **obowiązkowe**, bo lista zamrożeń mogła
się zmienić po dacie wydania tej instrukcji:

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2
bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) \
  --komunikat="proba"
```

**Jeżeli skrypt wymieni moduł, którego nie ma na liście czterech — dopisujesz
piąty znacznik i wpisujesz to do „Korekt wobec instrukcji".** Nadmiarowy
znacznik niczego nie psuje; brakujący blokuje commit.

**★ `--no-verify` jest ZAKAZEM (`§0.5`), nie obejściem.**

---

## ★ PO CO TEN BLOK ISTNIEJE

Właściciel produktu **cofnął odbiór dwóch modułów** 07.09 (`DEC-453`),
słowami: *„Niestety, ani jedno, ani drugie nie działa. Także cofamy. Inicjatywy
i execution, funkcje związane z zarządzaniem nimi nie działają."*

Blok **CODEX1** (10.09) postawił nad Inicjatywami **projekcję ODCZYTU**
(`initiativeUnifiedReader`, flaga `ENABLE_INITIATIVE_UNIFIED_READ`, domyślnie
`OFF`) i skrypt migracji. Dwa odbiory trójwarstwowe
(`97_ODBIOR_W1_W2.md`, `96_ODBIOR_C2_E3_E5.md`) potwierdziły każdą liczbę
dostawy — i **nazwały dokładnie to, czego w niej nie ma**:

1. **Karta rekordu kanonicznego NADAL NIE ZAPISUJE.** `FIX-9` z odbioru W1/W2,
   dosłownie: *„Zapis karty rekordu kanonicznego (`PUT`) dalej 404. To osobna
   robota (ścieżka zapisu, nie odczytu) — do bloku »jeden magazyn, część
   zapisowa«."* **Ten blok jest tym blokiem.**
2. **47 z 50 bramek istnienia** dalej pyta wyłącznie magazyn zastany.
3. **Sześciu pisarzy zastanych** (`milestones`, `resources`, `staffing-plans`,
   `budget-items`, `gate-roles`, `move`) nadal nie ma następcy kanonicznego —
   decyzją CTO zostały świadomie poza CODEX1.
4. **Siódmy pisarz** — seed demo (`demoSeedService.ts:2295`) — **nie był
   w ogóle policzony** i przy każdej sesji demo powiększa rozjazd.
5. **Trzy pozostałe domeny z kryterium 5 pojemnika 2 — oceny, analizy
   finansowe, artefakty — nie zostały nawet zmierzone.**

**Ten blok ma domknąć kryterium 5: cztery domeny, jeden magazyn albo jedna
projekcja SERWEROWA, i test, że nowy rekord z UI widać w obu odczytach.**
Nie ma zmieniać wyglądu **ani jednego piksela**.

---

## ★ STAN ZMIERZONY — 2026-09-11, na kodzie markera i na kopii bazy `consultify_staging_1009`

**To jest rozkaz pomiarowy, nie prawda objawiona.** Każdą liczbę mierzysz sam
(`Z24`). Obalenie którejkolwiek tezy poniżej jest **sukcesem** tego bloku.

### (a) INICJATYWY — część ZAPISOWA: kto pisze z karty i czy ma następcę

**Bramka, która blokuje:** `server/src/controllers/InitiativeController.ts:850`
w `static updateInitiative` (`:838`) —
`SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`, a przy braku
wiersza `res.status(404)`. Dla rekordu istniejącego **wyłącznie w kanonie**
(15–17 rekordów w kopii) `PUT /api/initiatives/:id` **zawsze** daje `404`.
Naprawa `E1a` (już w bazie kodu, `InitiativeDocumentView.tsx:3372-3437`) ugasiła
pętlę autozapisu po stronie klienta i przepięła **trzy pola** na komendę
kanoniczną. **Przyczyna na serwerze stoi nietknięta.**

**Wszystkie pisarze karty inicjatywy — pełna tabela wejściowa. Zweryfikuj
i uzupełnij ją sam; kolumna „następca" to Twój pomiar, nie mój werdykt.**

| # | Co zapisuje karta | Wołacz w `src/` | Trasa zastana | Kanoniczny następca runtime-v1 | Jest? |
| --- | --- | --- | --- | --- | --- |
| 1 | `title` | `handleSave` → `saveInitiativeWriteTruth` (`initiativeWriteTruth.ts:360`) | `PUT /api/initiatives/:id` | `PATCH /initiatives/:id/metadata` pole `title` (`initiativesExecutionRuntime.routes.ts:2198`, schemat `:284`) | **TAK** |
| 2 | `summary` | jw. | jw. | `metadata.problem` | **TAK** |
| 3 | `description` | jw. | jw. | `metadata.proposedOutcome` | **TAK** |
| 4 | **`ownerId`** | jw. (`InitiativeDocumentView.tsx` ok. `:3508`, pod `canEditOwner`) | jw. | **`metadata.initiativeOwnerId`** | **TAK — ale karta go NIE WYSYŁA dla rekordu kanonicznego.** `handleSaveRuntimeOnlyMetadata` (`:3379`) wysyła wyłącznie `title/summary/description`. **To jest luka do zamknięcia w `E1`, nie brak w kanonie** |
| 5 | `sponsorId` | jw. | jw. | **BRAK** | NIE |
| 6 | `priority` | jw. (pod `canEditPriority`) | jw. | **BRAK** — `AmendInitiativeMetadataSchema` nie ma tego pola | NIE |
| 7 | `plannedStartDate` / `plannedEndDate` | jw. (pod `canEditTargetDate`) | jw. | **do zmierzenia** — kandydat `POST /planning/initiatives/:id/register` (`:3645`) | ? |
| 8 | `problemStatement`, `marketContext`, `deliverables`, `deliverablesDone`, `successCriteria`, `scopeIn`, `scopeOut`, `killCriteria`, `estimatedBudget`, `resourceTools`, `tags`, `targetState` | jw. | jw. | **BRAK** | NIE |
| 9 | `status` | `updateInitiativeStatusWriteTruth` (`initiativeWriteTruth.ts:322`), wołane z `InitiativeDocumentView.tsx:3313` | `PATCH /api/initiatives/:id/status` | **CZĘŚCIOWO** — komendy bram (`gates/definition|analysis|portfolio|schedule/decisions`) + `POST /initiatives/:id/cancel` (`:2246`). Mapowanie 1:1 **nie istnieje** | CZĘŚCIOWO |
| 10 | KPI (dodaj/edytuj/usuń) | `InitiativeDocumentView.tsx:1917`, `:1982`, `:2054`, `:2104` | `POST/PUT/DELETE /api/initiatives/:id/kpis` | **do zmierzenia** | ? |
| 11 | RAID | `RaidSection.tsx` | `POST/PATCH/DELETE /api/initiatives/:id/raid*` — **JUŻ WYCOFANE (`409`)** | `POST/PATCH/DELETE /initiatives/:id/raid-items/:raidItemId` (`:5755`, `:5835`, `:5792`) — pisze do tej samej tabeli `raid_items` | **TAK** |
| 12–17 | kamienie milowe · zasoby · plany obsady · pozycje budżetu · role bram · przeniesienie | patrz `§0.1a` komenda 7 — **wszystkie sześć mają realnych wołaczy w `src/`** | trasy zastane, dziś PRZYWRÓCONE (nie odmawiają) | **kandydaci zmierzeni w tabeli `E2`** | ★ rozstrzyga `E2` |
| 18 | obserwujący, komentarze, powiązania, narzędzia, aktywa niematerialne, archiwizacja, usunięcie | `InitiativeDocumentView.tsx:3353/3357/4192/4239/4260/4103/4143/5180/5202/6447` | trasy zastane | **BRAK** | NIE |

**Bramki istnienia — stan po CODEX1:**

```
grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ | wc -l
```

**Mój wynik: 50 w 19 plikach** — rozkład per plik masz w `§0.1a` komenda (1).

**Z fallbackiem kanonicznym: 3** (`InitiativeController.ts:3275`,
`initiatives-additive.routes.ts:60`,
`initiative/initiativeKpiAssignmentService.ts:262`).
**DO PRZEŁĄCZENIA ZOSTAJE 47.**

**★ FIX-6 (97_ODBIOR_W1_W2.md §8, wykonane 2026-09-11) — K1 PRZEDEFINIOWANE.**
Powód: licznik oparty na literale SQL `SELECT id FROM initiatives WHERE id`
spadł 50→48 wyłącznie dlatego, że E1 Codexa przepisał tekst zapytania na
`SELECT 1 AS found FROM initiatives WHERE id` w dwóch bramkach, które
realnie przełączył (`results.routes.ts:544`, `execution-control.routes.ts:604`)
— sama zmiana literału, bez żadnego przełączenia, też obniżałaby ten licznik.
**Miarą musi być obecność wywołania `initiativeExists(`/`readInitiativeHeader(`/
`isInitiativeUnifiedReadEnabled(` w tej samej bramce, nie kształt literału SQL.**

Nowa komenda (kandydat = OBIE postacie literału, żeby przepisanie tekstu nie
zmieniało mianownika; „przełączona" = wywołanie funkcji przełączającej w oknie
±20 linii wokół zapytania — wymaga nawiasu `(` zaraz po nazwie, żeby NIE
łapać podobnie nazwanych lokalnych funkcji jak `initiativeExistsInOrg`):

```bash
git grep -nE "SELECT (id|1 AS found) FROM initiatives WHERE id" <SHA> -- server/src \
  | grep -v __tests__ | sed -E "s#^<SHA>:##" \
  | while IFS=: read -r f ln _; do
      s=$((ln-20)); e=$((ln+20))
      git show "<SHA>:${f}" | sed -n "${s},${e}p" \
        | grep -qE "initiativeExists\(|readInitiativeHeader\(|isInitiativeUnifiedReadEnabled\(" \
        || echo "ZASTANA: ${f}:${ln}"
    done | wc -l
```

**Zmierzone przeze mnie (Sonnet, worktree `c6-fix-codex2`, 2026-09-11):**

| SHA | Kandydatów (oba literały) | Przełączonych (wywołanie w oknie) | ZASTANA (K1 nowe) |
| --- | --- | --- | --- |
| marker `19440011e9` | 50 | 2 | **48** |
| tip `a954495c2e` (merge C6, przed FIX-ami) | 50 | 4 | **46** |

**Rozbieżność z „spodziewane 47/50" z 97_ODBIOR_W1_W2.md §8 — wyjaśniona,
nie wymuszona na siłę (zasada „zmierz sam, nie ufaj premisie"):** liczba „47"
w tym dokumencie (linia wyżej) sama pochodzi z komendy `§0.1a (2)`, która
liczy dopasowania substringu `initiativeExists` BEZ wymogu nawiasu zaraz po
nazwie — a to łapie też `initiativeExistsInOrg(` w
`initiatives-additive.routes.ts:60` (funkcja lokalna, pyta WYŁĄCZNIE tabelę
zastaną, zero świadomości flagi/czytnika kanonicznego) jako fałszywy
pozytyw „ma fallback". Realnie na markerze są **2** bramki z genuinym
przełączeniem (`InitiativeController.ts:3275`,
`initiativeKpiAssignmentService.ts:262`), nie 3 — więc **48**, nie 47,
zostaje do przełączenia na starcie. Na tipie E1 Codexa dodał 2 kolejne
(`results.routes.ts:552`, `execution-control.routes.ts:612`) → **46**.
**Dla kolejnego bloku: użyj liczb z tej tabeli (48/46), nie „47/50".**

**Liczby z bazy (kopia `consultify_staging_1009`, 11.09):**

| Co | Mój wynik |
| --- | --- |
| `initiatives` | **121** |
| `ie_aggregate_state` gdzie `aggregate_type='initiative'` | **31** |
| wiersz zastany BEZ agregatu | **107** |
| agregat BEZ wiersza zastanego | **17** |
| część wspólna | **14** |
| organizacje w `initiatives` / w kanonie | **3 / 2** |

### (b) OCENY — jądro (Method Core) vs zastane SQL

**Dwa magazyny, dwie przestrzenie identyfikatorów, ZERO kolumny łączącej.**

| Magazyn | Tabele | Wiersze (kopia) |
| --- | --- | --- |
| **KANON (jądro method-core)** | `method_sessions`, `method_findings`, `method_outputs`, `method_snapshots`, `method_packs`, `method_report_snapshots`, `method_evidence` | **6 · 39 · 2 · 2 · 2 · 1 · 0** |
| **ZASTANY (SQL)** | `assessments` (kolumna `answers_json`, kształt `answers.drd.areas`), `assessment_sessions`, `assessment_reports`, `assessment_definitions` | **12 · 9 · 2 · 4** |

**Kolumny łączącej NIE MA.** `method_sessions` ma
`id, organization_id, project_id, module, method_pack_id, method_pack_version,
state, domain_stage, mode, owner_user_id, version, frozen_snapshot_id,
revision_of_session_id, created_at, updated_at, demo_bypass_active` — **żadnego
`assessment_id`**. `assessments` nie ma `method_session_id`.
**To jest twardsze niż w Inicjatywach: tam wspólnym kluczem był `id`, tu nie ma
żadnego. Dopasowanie musi powstać jawnie i być policzone, nie zgadnięte.**

**Bramki istnienia oceny pytające magazyn zastany:**

```
grep -rn "FROM assessments WHERE id" server/src | grep -v __tests__ | grep -v "_backup/" | wc -l
```

**Mój wynik: 37**, rozkład: `AssessmentController.ts` 9 ·
`v8/assessment.routes.ts` 5 · `assessment/AssessmentWorkbenchService.ts` 4 ·
`assessmentInitiativeService.ts` 3 · `assessment/assessment-workflow.routes.ts` 3 ·
`assessment-workflow-v2.routes.ts` 2 · po jednym: `sponsorReportService.ts`,
`caseWorkspace/adapters/assessmentAdapter.ts`, `assessmentPermissionService.ts`,
`assessmentInitiativeGenerationRunService.ts` i pozostałe.

**★ Dzisiejsza projekcja ocen ŻYJE W PRZEGLĄDARCE — to ten sam błąd warstwy,
który CODEX1 naprawił w Inicjatywach.**
`src/components/assessment/assessmentOutputProjection.ts` — nagłówek pliku
opisuje to wprost i podaje własny pomiar z 06.09: *„10 z 11 realnych ocen
właściciela leży w magazynie ZASTANYM, a lista Outputów i trasa raportu czytały
wyłącznie magazyn KANONICZNY. Skutek widoczny dla właściciela: pusta lista
i »Nie znaleziono zamrożonego Outputu« zamiast raportu z jego własnej oceny."*
Wołacze: `AssessmentOutputsTab.tsx:62` i `:212`, `AssessmentHub.tsx:108`.

**Serwerowego czytnika tożsamości NIE MA** —
`find server/src -iname "*assessmentUnifiedReader*"` daje **zero**.

**Co JEST po stronie serwera (i jest dobrym wzorcem):** raport oceny ma już
**wspólny silnik dla obu magazynów** —
`assessment/assessmentReportContractComposer.ts` (czysta kompozycja, bez I/O)
obsługiwany przez dwa serwisy: `assessmentReportContractService.ts` (jądro,
`:122` czyta `FROM method_sessions`) i `assessmentLegacyReportContractService.ts`
(zastany). **To pokrywa RAPORT, nie pokrywa LISTY ani TOŻSAMOŚCI rekordu.**

### (c) ANALIZY FINANSOWE — dwa magazyny i most, który istnieje, ale ma dziurawe pokrycie

**Odpowiedź na pytanie „dwa magazyny?": TAK, i most też już jest.**
Nazwy nie są `finance_*` kontra `financial_*` w sensie prostego podziału —
zmierz to sam, bo prefiks myli.

| Warstwa | Tabele | Wiersze (kopia) |
| --- | --- | --- |
| **ZASTANA** (lista `FinanceHub`) | `financial_analyses` · `financial_models` · `financial_statement_packs` · `valuations` | **6 · 17 · 10 · 16** |
| **KANONICZNA** (cztery warsztaty v3) | `finance_artifacts` · `finance_business_versions` · `finance_analysis_definitions` · `finance_stmt_lines` | **18 · 18 · 1 · 238** |
| **MOST** | `finance_artifact_aliases` | **13** |

**Pokrycie mostu — najostrzejsza liczba tej domeny:**

| Tabela zastana | Wierszy | Ma alias | **BEZ aliasu** |
| --- | --- | --- | --- |
| `financial_analyses` | 6 | 1 | **5** |
| `financial_models` | 17 | 3 | **14** |
| `financial_statement_packs` | 10 | 4 | **6** |
| `valuations` | 16 | 3 | **13** |
| **Razem** | **49** | **11** | **38 (77,6 %)** |

**Kod mostu ISTNIEJE i JEST CZYTANY.**
`server/src/services/finance/canonical/legacyIdBridgeService.ts` (258 linii) —
jego nagłówek mówi dosłownie: *„until this module, nothing in the running server
ever READ it … This is the »powiązanie ISTNIEJE, ale nikt go nie czyta« case,
not a new migration"*, i wprost odsyła do przyczyny braku pokrycia:
*„Whether any given (organization, legacy_table, legacy_id) row actually HAS an
alias depends on whether the WP-C03 backfill has been run for that organization"*.
Obok: `legacyIdentityMaterializationService.ts` (466),
`financeCanonicalRegistrySyncService.ts` (208),
`finance_legacy_usage_events` (**949 wierszy** telemetrii użycia tras zastanych).

**Wniosek wejściowy (obal go, jeżeli zmierzysz inaczej): w Finansach problemem
NIE jest brak projekcji, tylko BRAK POKRYCIA istniejącego mostu i brak testu,
który to pokrycie mierzy.**

### (d) ARTEFAKTY — aliasy i tożsamość

| Magazyn | Rola | Wiersze (kopia) |
| --- | --- | --- |
| `v8_output_artifacts` | rejestr metadanych (typ, stan dostarczenia, właściciel, `canonical_home`) | **872** |
| `wave5_artifacts` | **treść** artefaktu (`content`, `content_md`, `content_json_native`, cytowania, proweniencja) | **237** |
| `v8_artifact_origin_links` | pochodzenie / alias źródła | **801** |
| `knowledge_docs` | Materiały / skarbiec — **osobny magazyn, osobna rola** | **270** |
| `tool_outputs` | migawki narzędzi | **0** |
| `method_outputs` | wyjścia jądra Oceny | **2** |
| `knowledge_documents`, `audit_outputs` | **0 / 1** | |

**Rozjazd tożsamości, zmierzony po `artifact_id`:**

| Pomiar | Wynik |
| --- | --- |
| `wave5_artifacts` ∩ `v8_output_artifacts` | **102** |
| `wave5_artifacts` BEZ `v8_output_artifacts` | **135** |
| `v8_output_artifacts` BEZ `wave5_artifacts` | **770** |
| `v8_output_artifacts` BEZ `v8_artifact_origin_links` | **136** |
| `v8_artifact_origin_links` BEZ artefaktu | **65** |

**Czytelnicy/pisarze:** `v8_output_artifacts` — `v8/reportsPresModelService.ts` 12,
`v8/artifactRegistryService.ts` 11, `v8/finance.routes.ts` 4,
`artifacts.routes.ts` 4, `v8/outputsTransactionalRegistry.ts` 3, …;
`knowledge_docs` — `organizationContext/ContextDocumentService.ts` 26,
`ai/knowledgeIndexer.ts` 11, `KnowledgeService.ts` 11, …;
`tool_outputs` — `tools/toolOutputSnapshotService.ts` 8,
`ToolOutputsController.ts` 7.

**Teza wejściowa (zweryfikuj):** `tool_outputs` (0 wierszy) i `knowledge_docs`
(inny produkt: Materiały) **nie są drugim magazynem tych samych artefaktów**.
Realny rozjazd tożsamości jest między **`v8_output_artifacts` a `wave5_artifacts`**
(65 osieroconych linków, 136 artefaktów bez linku, 135 treści bez rejestru).
Jeżeli zmierzysz inaczej — **Twój pomiar jest wiążący**.

### (e) SIÓDMY PISARZ ZASTANY — seed demo

`server/src/services/demo/demoSeedService.ts:2295`:
`INSERT INTO initiatives (…) VALUES (…) ON CONFLICT(id) DO UPDATE SET …`.
`grep -c "ie_aggregate_state" server/src/services/demo/demoSeedService.ts` → **0**.
Komentarz w kodzie (`:2287`) nazywa to świadomym wyjątkiem od reguły „jeden
lejek", uzasadnionym idempotencją seedu.

**Pomiar z odbioru C2 (do powtórzenia u siebie):** samo otwarcie aplikacji
w przeglądarce zasiało **2 sesje demo po 22 inicjatywy = 44 nowe wiersze
w `initiatives`, z czego 0 w kanonie**. **Każda sesja demo powiększa rozjazd
o 22 rekordy** — czyli magazyny rozjeżdżają się szybciej, niż je scalamy.
Inwentarz CODEX1 (oparty na wzorcach middleware) tego pisarza **nie widział**.

### (f) 105 REKORDÓW BEZ `project_id` / `owner_business_id` — PYTANIE DO WŁAŚCICIELA NADAL OTWARTE

Kanon **wymaga jednocześnie** `projectId` i `initiativeOwnerId`
(`src/services/initiativeWriteTruth.ts:186`: *„Canonical initiative creation
requires projectId and initiativeOwnerId"*). W danych tych pól po prostu nie ma.

**Zbiór migracji (107 wierszy zastanych bez agregatu), mój pomiar 11.09:**

| Co | Wynik |
| --- | --- |
| bez `project_id` | **77** |
| bez `owner_business_id` | **98** |
| bez obu | **70** |
| **unia pominiętych** | **105** |
| **kwalifikowalnych** | **2** |

Cała tabela (121 wierszy): bez `project_id` **78**, bez `owner_business_id` **104**.

**Odbiór C2 ustalił i sprawdził trzy rzeczy, których nie powtarzasz:**
- **Opcja A (wyprowadzić właściciela z `coalesce(owner_execution_id, created_by)`)
  daje wartość dla 40 z 98, ale tylko 5 wskazuje na użytkownika istniejącego
  w tej samej organizacji** — reszta to wiszące referencje. **ODRZUCONA.**
- **Opcja B (wyprowadzić projekt) jest NIEMOŻLIWA z danych**: ze 77 rekordów bez
  `project_id` **0** ma `program_id`, **0** `report_id`, **0**
  `source_assessment_id`, **0** `workstream_id`.
- Obie kwalifikowalne inicjatywy to **śmieć testowy** w organizacji „TT22TT";
  **DBR77 dostaje 0 migrowanych rekordów ze 106**.

**★★ DLATEGO TA INSTRUKCJA MA DWA WARIANTY `E1`/`E3`, ZALEŻNE OD ODPOWIEDZI
WŁAŚCICIELA — patrz `E1` sekcja „WARIANT P / WARIANT N".** Jeżeli w chwili,
gdy zaczynasz, nadzorca **nie dopisał** rozstrzygnięcia do tej instrukcji ani
do `02_DECYZJA_NADZORCY.txt` w tym katalogu — **realizujesz WARIANT N
(bezpieczniejszy, nic nie zgaduje) i wpisujesz to do „Korekt".**

### ★ WERDYKT O PREMISIE ZLECENIA

Premisa („zostały cztery domeny do spięcia") jest **prawdziwa i w dwóch
miejscach przesunięta**:

- **Finanse nie potrzebują nowej projekcji — potrzebują POKRYCIA istniejącego
  mostu.** 38 z 49 rekordów zastanych nie ma aliasu, a kod mostu jest gotowy
  i czytany. Budowanie tam drugiej projekcji byłoby trzecim magazynem.
- **Oceny są TRUDNIEJSZE niż Inicjatywy, nie łatwiejsze.** W Inicjatywach oba
  magazyny dzieliły klucz `id`; w Ocenach **nie ma żadnej kolumny łączącej**,
  więc dopasowanie trzeba wymyślić i **każdy niedopasowany rekord policzyć**,
  a nie ukryć (`Z23`).

---

## ★ ZAKRES

1. **Część ZAPISOWA inicjatyw**: karta rekordu kanonicznego zapisuje przez
   komendy runtime-v1 (tytuł/streszczenie/opis/**właściciel** oraz status tam,
   gdzie kanon na to pozwala); trasa zastana `PUT /api/initiatives/:id` przy
   rekordzie kanonicznym **przekierowuje do komendy albo odpowiada `409`**
   z komunikatem dla człowieka — **zero pętli, zero ciszy**.
2. **Projekt kanonicznych następców dla sześciu pisarzy legacy** — z testem
   „zapis komendą → odczyt tym samym czytnikiem, którym czyta ekran".
3. **Przełączenie 47 bramek istnienia** na `initiativeUnifiedReader`,
   powierzchnia po powierzchni, każda z testem.
4. **Projekcja SERWEROWA dla Ocen** — jeden kształt nad jądrem i magazynem
   zastanym, z jawnym licznikiem rekordów niedopasowanych.
5. **Finanse: pokrycie mostu** — pomiar, uzupełnienie aliasów przez istniejący
   mechanizm (addytywnie, z manifestem) i test pokrycia.
6. **Artefakty: tożsamość** — jeden odczyt nad `v8_output_artifacts`
   i `wave5_artifacts`, z policzeniem 65 osieroconych linków i 136 artefaktów
   bez linku.
7. **Seed demo pisze do kanonu** (albo do obu) — koniec powiększania rozjazdu
   przy każdym otwarciu aplikacji.
8. **Test „nowy rekord z UI widać wszędzie" — 7 z 7, bez `it.todo`.**
9. **Raport** w narzuconym układzie.

## ★ POZA ZAKRESEM — imiennie

- **Żadnych zmian wyglądu.** Zero zmian układu, kolorów, odstępów, ikon, tekstów
  widocznych na ekranie, komponentów `src/components/standard/**`, tokenów `c-*`.
  Front dotykasz **wyłącznie** tam, gdzie przepinasz wołacza, i diff ma to pokazywać.
- **Zero nowych ekranów** i zero nowych elementów interfejsu (`Z11`).
- **Produkcja nietykalna** (`Z8`, `Z28`).
- **Zero migracji modyfikujących istniejące pliki** w `server/migrations/**`.
  Wyłącznie NOWE pliki w przedziale `20262140`–`20262149`, wyłącznie addytywne (`Z40`).
- **Zero zmian globalnej infrastruktury testowej** (`Z18`).
- **Zero zmian modelu uprawnień i granicy tenanta** (`Z12`) — w tym **NIE
  naprawiasz** `pmoValidation.middleware.ts` (bramka bez `organization_id`),
  tylko ją zgłaszasz; to samo dotyczy `assessmentPermissionService.ts`.
- **Nie kasujesz żadnej tabeli zastanej** (`Z40`).
- **Nie ruszasz `server/src/validators/initiative.validators.ts`** — dług
  `status .default('DRAFT')` opisany, nie naprawiany.
- **Nie budujesz nowego magazynu „trzeciego"** — żadnej tabeli cache, żadnej
  materializowanej kopii wierszy. **Dotyczy szczególnie Finansów: most już jest,
  masz go POKRYĆ, nie zastąpić.**
- **Nie zmieniasz skryptu `scripts/dane/migruj-inicjatywy-do-kanonu.ts` poza
  `FIX-E3-1`…`FIX-E3-6`** wymienionymi w `E3`.
- **Nie ruszasz `Wyników` ani `Realizacji` poza podmianą bramek istnienia.**

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · TRASA · KONTROLER · SERWIS · REPOZYTORIUM

> **★★ ZASTRZEŻENIE.** Ta tabela **JEST** licencją. Jeżeli plik, którego
> potrzebujesz, jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie
> i STOP z tytułu »nie wolno mi« jest NIEZASADNY**. Jeżeli pliku nie ma
> w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief wg wiersza 1, **nie zatrzymanie bloku**.

| Plik / wzorzec | Licencja | Co robisz, gdy etap wymagałby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/betaGate.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `server/src/services/assessmentPermissionService.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z12`) | Produktem etapu staje się **CZERWONY KONTRAKT TESTOWY**: nowy plik testu, który **dziś PADA** i opisuje żądane zachowanie, oznaczony `it('KONTRAKT CODEX2 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego bloku`. Do tego **brief w raporcie**: plik:linia · dlaczego nie da się w module · promień rażenia · jak wyglądałby dowód mutacyjny. **Etap z takim produktem jest ZROBIONY, nie STOP** |
| `server/src/middleware/pmoValidation.middleware.ts` | **TYLKO ODCZYT** (granica tenanta, poza zakresem) | Wpis do raportu z plik:linia i gotowym diffem, **nienałożonym** |
| `server/src/controllers/InitiativeController.ts` | **★ PEŁNA LICENCJA** w zakresie `E1`/`E3` — bramka zapisu `:850` i podmiana bramek istnienia | — |
| `server/src/routes/pmo/initiatives.routes.ts` | **★ PEŁNA LICENCJA** w zakresie `E1`/`E2` | — |
| `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | **★ WĄSKA LICENCJA:** wyłącznie lista `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` i komentarz przy niej. **Zakaz zmiany kodu odpowiedzi, kodu błędu i sygnatur funkcji** | Czerwony kontrakt + brief |
| `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie **DODANIE** brakujących komend kanonicznych wymaganych przez `E2` oraz **rozszerzenie `AmendInitiativeMetadataSchema` o pola, dla których `E1` udowodni istnienie pisarza w agregacie**. **Zakaz zmiany istniejących komend, ich kształtu odpowiedzi i kodów błędów** | Czerwony kontrakt + brief |
| `server/src/domain/initiatives-execution/initiativeUnifiedReader.ts` | **★ WĄSKA LICENCJA:** dodawanie metod potrzebnych `E3`. **Zakaz zmiany semantyki `readInitiativeHeader`/`listInitiativeHeaders` uzgodnionej w `C1-FIX-1`** (przy kolizji `id` **status z magazynu klasycznego**, reszta z kanonu) | Czerwony kontrakt + brief |
| `server/src/domain/initiatives-execution/**` (NOWE pliki) | **★ PEŁNA LICENCJA** | — |
| **`server/src/domain/assessment/assessmentUnifiedReader.ts` (NOWY PLIK)** | **★ PEŁNA LICENCJA** — rdzeń `E4` | — |
| `server/src/services/assessment/assessmentReportContractComposer.ts`, `assessmentReportContractService.ts`, `assessmentLegacyReportContractService.ts` | **TYLKO ODCZYT — WZORZEC.** Kopiujesz z nich kształt „jeden silnik, dwa źródła" | Nowy plik obok, nie zmiana tych |
| `server/src/controllers/AssessmentController.ts`, `server/src/routes/v8/assessment.routes.ts`, `server/src/services/assessment/AssessmentWorkbenchService.ts`, `server/src/services/assessmentInitiativeService.ts`, `server/src/routes/assessment/assessment-workflow.routes.ts`, `server/src/routes/assessment-workflow-v2.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie **podmiana bramki istnienia** `FROM assessments WHERE id = …` na wywołanie projekcji z `E4`. **Zakaz jakiejkolwiek innej zmiany** — diff ma pokazywać wyłącznie linie bramki | Czerwony kontrakt + brief |
| `server/src/services/finance/canonical/legacyIdBridgeService.ts`, `legacyIdentityMaterializationService.ts`, `server/src/services/financeCanonicalRegistrySyncService.ts` | **★ WĄSKA LICENCJA:** wyłącznie to, co `E5` udowodni jako konieczne do POKRYCIA. **Zakaz zmiany kształtu aliasu i semantyki `mapping_confidence`/`mapping_reason`** | Czerwony kontrakt + brief |
| `server/scripts/finance-v3-backfill-dry-run.ts` | **TYLKO ODCZYT — WZORZEC dla `E5`** | Piszesz własny skrypt obok |
| `server/src/services/v8/artifactRegistryService.ts`, `server/src/routes/artifacts.routes.ts` | **★ WĄSKA LICENCJA** w zakresie `E6` — wyłącznie odczyt tożsamości | Czerwony kontrakt + brief |
| `server/src/services/demo/demoSeedService.ts` | **★ WĄSKA LICENCJA** w zakresie `E7` — wyłącznie dopisanie zapisu kanonicznego obok istniejącego `INSERT`. **Zakaz zmiany idempotencji (`ON CONFLICT(id) DO UPDATE`) i deterministycznych `makeId`** | Czerwony kontrakt + brief |
| `server/src/controllers/DecisionController.ts`, `server/src/routes/v8/results.routes.ts`, `server/src/routes/v8/execution-control.routes.ts`, `server/src/routes/v8/execution.routes.ts`, `server/src/routes/benefits.routes.ts`, `server/src/routes/my-work.routes.ts`, `server/src/services/initiativeGovernanceService.ts`, `server/src/services/initiative/initiativeKpiAssignmentService.ts`, `server/src/services/initiative/initiativeClosureService.ts`, `server/src/services/workCanvasService.ts`, `server/src/services/interviewEnterpriseService.ts`, `server/src/services/financialModelingService.ts`, `server/src/services/v8/planningPortfolioReadService.ts`, `server/src/routes/v8/interview-insights.routes.ts`, `server/src/routes/v8/finance-value.routes.ts`, `server/src/routes/pmo/initiativeClosure.routes.ts`, `server/src/routes/initiatives-additive.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie **podmiana bramki istnienia** na wywołanie `initiativeUnifiedReader`. **Zakaz jakiejkolwiek innej zmiany** | Czerwony kontrakt + brief |
| `src/services/initiativeWriteTruth.ts`, `src/services/initiatives-execution/runtimeApi.ts` | **★ WĄSKA LICENCJA + ZAMROŻONE `WSPOLNE` (`§0.6`, znacznik obowiązkowy):** wyłącznie przepięcie wołacza i obsługa nowego kodu odmowy. **Zakaz zmiany tekstów widocznych dla użytkownika poza plikami tłumaczeń** | Czerwony kontrakt + brief |
| `src/components/Initiatives/InitiativeDocumentView.tsx`, `initiativeDocumentSource.ts` | **★ WĄSKA LICENCJA + ZAMROŻONE `05_INITIATIVES`:** wyłącznie warstwa wysyłania danych (`handleSaveRuntimeOnlyMetadata`, `handleSave`) i obsługa odmowy. **Zakaz zmiany JSX, klas, kolejności sekcji, etykiet** — diff ma dotyczyć wyłącznie warstwy zapisu | Czerwony kontrakt + brief; jeżeli zmiana ruszyłaby ekran — **STOP MERYTORYCZNY** |
| `src/components/Initiatives/InitiativesHub.tsx`, `initiativeRegisterProjection.ts`, `src/components/Execution/ExecutionHub.tsx` | **★ WĄSKA LICENCJA + ZAMROŻONE:** wyłącznie **usunięcie klienckiego mostu**, i tylko po dowodzie HTTP z `E3` | jw. |
| `src/components/assessment/assessmentOutputProjection.ts`, `AssessmentOutputsTab.tsx`, `AssessmentHub.tsx` | **★ WĄSKA LICENCJA + ZAMROŻONE `04_ASSESSMENT`:** wyłącznie przepięcie na projekcję serwerową z `E4`, po dowodzie HTTP. **Jeżeli zdjęcie mostu klienckiego zmieniłoby cokolwiek na ekranie — zostawiasz most i piszesz STOP** | jw. |
| `src/contracts/initiatives-execution/statusMapping.ts` | **TYLKO ODCZYT — ŹRÓDŁO SŁOWNIKA + ZAMROŻONE `WSPOLNE`** | Jeżeli serwer potrzebuje zmiany słownika, robisz to po stronie serwera i **jawnie piszesz w raporcie, że egzemplarze się rozjeżdżają** |
| **`scripts/dane/migruj-oceny-do-projekcji.ts`, `scripts/dane/pokryj-aliasy-finansowe.ts`, `scripts/dane/zwiaz-tozsamosc-artefaktow.ts` (NOWE)** | **★ PEŁNA LICENCJA** — rdzeń `E4`/`E5`/`E6`. **Obowiązkowo wg `Z41` i `Z42`** | — |
| `scripts/dane/migruj-inicjatywy-do-kanonu.ts` | **★ WĄSKA LICENCJA:** wyłącznie `FIX-E3-1`…`FIX-E3-6` z `E3`. **Zakaz zmiany algorytmu kwalifikacji** | Czerwony kontrakt + brief |
| `scripts/dane/usun-organizacje.ts` | **TYLKO ODCZYT — WZORZEC** | Kopiujesz kształt: `--dry-run`/`--apply`/`--rollback=<manifest>`/`--verify`, dwa klucze do trybu zapisującego, `--oczekiwany-host 127.0.0.1`. **Nie zmieniasz w nim ani litery** |
| `server/migrations/20262140_*.sql` … `20262149_*.sql` (**NOWE**) | **★ PEŁNA LICENCJA** w przedziale **`20262140`–`20262149`**, wyłącznie addytywne (`Z40`) | — |
| `server/migrations/**` (wszystkie istniejące pliki) | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Nowy plik w Twoim przedziale, nigdy edycja cudzego |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie, **wartość realnie przetłumaczona** (`Z46`). Zakaz zmiany istniejących wartości | — |
| `tests/**` (NOWE pliki), `server/src/**/__tests__/**` (NOWE pliki), `tests/e2e/**` (NOWE pliki) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z31`, `Z43`, `Z44`. **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| `server/src/domain/initiatives-execution/__tests__/nowyRekordSiedemPowierzchni.pg.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie `FIX-E5-1`…`FIX-E5-4` z `E8`. **Zakaz zmiany listy siedmiu tras bez wpisu w raporcie** | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `playwright*.config.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Produktem jest **opis w raporcie**: co blokuje pomiar, jaka byłaby zmiana i **jak obszedłeś to zmiennymi w linii komendy** |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, `docs/program/MVP_FINAL_ZAMROZONE.json` | **TYLKO ODCZYT** (`Z13`, `Z14`) | Errata w raporcie |
| `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md` | **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/**` | **TYLKO ODCZYT — TWÓJ DŁUG WEJŚCIOWY.** Czytasz `96_ODBIOR_C2_E3_E5.md` i `97_ODBIOR_W1_W2.md` w całości przed `E1` | Nie zmieniasz ani litery |
| `server/src/_backup/**`, warianty `PRESERVED_PRODUCT_WIP` | **NIETYKALNE** (`Z4`) | Nie liczysz i nie zmieniasz |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

**★ Uwaga do wierszy „WĄSKA LICENCJA na podmianę bramek".** Zanim zmienisz
sygnaturę czegokolwiek wspólnego, sprawdź, czy **typ** przez ten plik przepływa:

```bash
grep -rln "initiativeUnifiedReader" server/src | grep -v __tests__
grep -rln "assessmentUnifiedReader" server/src | grep -v __tests__
```

Każdy znaleziony konsument albo wchodzi do licencji, albo zmiana typu jest
niewykonalna i trzeba ją zaprojektować inaczej.

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda (odtwarzalna, jedna linia) | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | bramki istnienia inicjatywy pytające tylko magazyn zastany | **50** | `grep -rn "SELECT id FROM initiatives WHERE id" server/src \| grep -v __tests__ \| wc -l` | TAK — wzorzec dosłowny |
| 2 | z tego z fallbackiem kanonicznym | **3** | pętla z `§0.1a` komenda (2) | TAK |
| 3 | **do przełączenia** | **47** | `1` minus `2` | TAK |
| 4 | pliki z bramkami inicjatyw | **19** | `… \| cut -d: -f1 \| sort -u \| wc -l` | TAK |
| 5 | bramki istnienia oceny | **37** | `grep -rn "FROM assessments WHERE id" server/src \| grep -v __tests__ \| grep -v "_backup/" \| wc -l` | TAK — **pamiętaj o `Z4`** |
| 6 | `initiatives` / kanon inicjatyw | **121 / 31** | `docker exec … -Atc "SELECT count(*) FROM initiatives"` i to samo na `ie_aggregate_state WHERE aggregate_type='initiative'` | TAK |
| 7 | legacy bez kanonu / kanon bez legacy / wspólne | **107 / 17 / 14** | zapytanie z `E3` | TAK |
| 8 | zbiór migracji: bez `project_id` / bez `owner_business_id` / bez obu | **77 / 98 / 70** | zapytanie z `(f)` | TAK |
| 9 | unia pominiętych / kwalifikowalnych | **105 / 2** | jw. | TAK — **to jest 98,1 % zbioru, patrz `E3`** |
| 10 | `method_sessions` / `method_findings` / `method_outputs` | **6 / 39 / 2** | `docker exec … -Atc "SELECT count(*) FROM method_sessions"` itd. | TAK |
| 11 | `assessments` / `assessment_sessions` / `assessment_reports` | **12 / 9 / 2** | jw. | TAK |
| 12 | finanse zastane: `financial_analyses`/`financial_models`/`financial_statement_packs`/`valuations` | **6 / 17 / 10 / 16** | jw. | TAK |
| 13 | `finance_artifact_aliases` / rekordów BEZ aliasu | **13 / 38** | zapytanie z `(c)` | TAK — **to jest miara całego `E5`** |
| 14 | `v8_output_artifacts` / `wave5_artifacts` / `v8_artifact_origin_links` | **872 / 237 / 801** | jw. | TAK |
| 15 | artefakty bez linku / linki bez artefaktu / część wspólna wave5∩v8 | **136 / 65 / 102** | zapytanie z `(d)` | TAK |
| 16 | wolne numery migracji w MOIM przedziale | **10** (`20262140`–`20262149`) | `ls server/migrations \| grep -cE "^2026214[0-9]"` → oczekiwane `0` zajętych | **TAK — sprawdź osobno, to najczęstszy błąd wydania** |
| 17 | najwyższy zajęty numer migracji | **20262107** | `ls server/migrations \| grep -oE "^[0-9]{8}" \| sort -u \| tail -1` | TAK |
| 18 | realne `.catch(() => {})` w czterech domenach | **0** | komenda z `§0.1a` (13) | TAK |
| 19 | pisarze zastani inicjatyw poza kartą (seed demo) | **1** (`demoSeedService.ts:2295`) | `grep -n "INSERT INTO initiatives" server/src/services/demo/demoSeedService.ts` | TAK |

**Reguła kontrolna:** komenda, której sam nie uruchomiłeś, nie wchodzi do raportu.
Rozbieżność z moją liczbą **nie jest sprzecznością — jest WYNIKIEM**.

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego bloku

### Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Etap | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/controllers/InitiativeController.ts` | istniejący | `E1`, `E3` | **★★ WYSOKIE** — plik zmieniany 10.09 przez kilka napraw; commituj małymi krokami |
| 2 | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | istniejący | `E1`, `E2` | ŚREDNIE |
| 3 | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` | istniejący | `E2` | ŚREDNIE |
| 4 | `server/src/domain/assessment/assessmentUnifiedReader.ts` | **NOWY** | `E4` | ZEROWE |
| 5 | `scripts/dane/pokryj-aliasy-finansowe.ts` | **NOWY** | `E5` | ZEROWE |
| 6 | `scripts/dane/zwiaz-tozsamosc-artefaktow.ts` | **NOWY** | `E6` | ZEROWE |
| 7 | `server/src/services/demo/demoSeedService.ts` | istniejący | `E7` | ŚREDNIE |
| 8 | `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md` | **NOWY** | `E9` | ZEROWE |
| 9 | nowe pliki testowe (`__tests__`, `tests/e2e`) | **NOWE** | `E1`…`E8` | ZEROWE |

### Pliki zapisywane WARUNKOWO

| Plik | Etap | Warunek, po którego spełnieniu wolno zapisać |
| --- | --- | --- |
| 17 plików z bramkami inicjatyw | `E3` | **dopiero po** zielonym dowodzie mutacyjnym `E1` na realnym Postgresie |
| 6 plików z bramkami ocen | `E4` | **dopiero po** dowodzie HTTP, że projekcja ocen zwraca komplet |
| `src/components/Initiatives/InitiativeDocumentView.tsx` | `E1` | tylko warstwa wysyłania danych; jeżeli diff dotyka JSX — cofasz |
| `src/services/initiativeWriteTruth.ts`, `runtimeApi.ts` | `E1` | tylko przepięcie wołacza; znacznik `[ODMROZENIE WSPOLNE …]` obowiązkowy |
| `src/components/assessment/**` | `E4` | tylko po dowodzie HTTP z `E4`; jeżeli ruszyłoby ekran — STOP |
| `server/migrations/2026214*.sql` | `E5`, `E6` | tylko jeżeli udowodnisz, że nie da się w serwisie |
| `public/locales/{pl,en}/translation.json` | `E1` | tylko dla NOWYCH kluczy komunikatu odmowy; parytet PL+EN w tym samym commicie (`Z46`) |
| `scripts/dane/migruj-inicjatywy-do-kanonu.ts` | `E3` | wyłącznie `FIX-E3-1`…`FIX-E3-6` |

### Pliki, których ten blok JAWNIE NIE ZAPISZE — imiennie

```
server/src/middleware/auth.middleware.ts
server/src/Gateway.ts
server/src/middleware/v8FeatureGate.middleware.ts
server/src/middleware/betaGate.middleware.ts
server/src/middleware/pmoValidation.middleware.ts
server/src/services/effectiveAccessService.ts
server/src/services/assessmentPermissionService.ts
server/src/validators/initiative.validators.ts
server/src/services/assessment/assessmentReportContractComposer.ts
server/src/_backup/**
scripts/dane/usun-organizacje.ts
server/scripts/finance-v3-backfill-dry-run.ts
tests/setup.ts, tests/helpers/**, tests/__mocks__/**
vitest*.config.ts, server/vitest.config*.ts, playwright*.config.ts
docs/program/MVP_FINAL_ZAMROZONE.json
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/**
src/components/standard/**   (kanon UI list — ten blok nie dotyka wyglądu)
```

### Zasoby wyłączne tego bloku

| Zasób | Wartość | Sprawdzone (komenda) |
| --- | --- | --- |
| Port PostgreSQL | **`6452`** | `lsof -nP -iTCP -sTCP:LISTEN \| grep :6452` → pusto |
| Port harnessu | **`5592`** | `lsof -nP -iTCP -sTCP:LISTEN \| grep :5592` → pusto |
| Nazwa kontenera | **`cx-codex2-pg`** | `docker ps -a --format '{{.Names}}' \| grep cx-codex2` → pusto |
| Nazwa bazy roboczej | `cx_codex2` | — |
| Nazwa kopii danych | `codex2_kopia_1009` (**parametrem, nie stałą — `Z41`**) | — |
| **Przedział migracji** | **`20262140`–`20262149`** | `ls server/migrations \| grep -cE "^2026214[0-9]"` → `0` |
| Gałąź | `codex/jeden-magazyn-czesc-2-20260911` | nie istnieje w vaulcie |
| Worktree | `/Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2` | nie istnieje |
| Flaga funkcyjna | **`ENABLE_INITIATIVE_UNIFIED_WRITE` — default OFF** | `grep -rn "ENABLE_INITIATIVE_UNIFIED_WRITE" src server scripts` → 0 trafień |
| **Cudze, NIETYKALNE** | kontener `cx-codex1-inicjatywy-pg` (port `6451`), katalog `~/Developer/codex-wt/codex1-*`, kontener `consultify-pg18` (port `54418`) — **z tego ostatniego wolno wyłącznie `pg_dump` i `SELECT`** | `Z6`, `Z9` |

### Kontrola przed KAŻDYM commitem

```bash
cd /Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2
git diff --name-only --cached | tee /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/staged.txt
grep -iE 'auth\.middleware|Gateway\.ts|pmoValidation|betaGate|effectiveAccess|assessmentPermissionService|initiative\.validators|vitest.*config|playwright.*config|tests/setup|_backup/|MVP_FINAL_ZAMROZONE|OWNER_DECISION_LEDGER|components/standard/|CODEX1_INICJATYWY/' \
  /Users/piotrwisniewski/Developer/codex-wt/codex2-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
bash scripts/mvp-final/check-freeze.sh --pliki $(git diff --cached --name-only) --komunikat="proba"
```

---

# ETAPY

**Jeden etap = jeden commit = jeden werdykt.** Każdy commit niesie **cztery**
znaczniki odmrożenia (`§0.6`). Rdzeń to `E1`, `E2`, `E3`, `E8`, `E9` — jeżeli
zabraknie czasu, `E4`–`E7` opisujesz uczciwie jako niezrobione, **nigdy odwrotnie**.

| Etap | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Komunikat commita (dopisz cztery znaczniki) |
| --- | --- | --- | --- | --- | --- |
| `E1` | część ZAPISOWA inicjatyw: karta zapisuje kanonem, legacy odmawia po ludzku | **TAK** | NIE — dowód: `grep -rn "initiativeUnifiedWrite\|ENABLE_INITIATIVE_UNIFIED_WRITE" server/src/middleware server/src/Gateway.ts` → 0 | min. 10 nowych testów | `feat(initiatives): canonical write path for the initiative record (E1)` |
| `E2` | sześciu pisarzy legacy — projekt następców kanonicznych | **TAK** | NIE | min. 8 | `feat(initiatives): canonical successors for six legacy writers (E2)` |
| `E3` | przełączenie 47 bramek istnienia na `initiativeUnifiedReader` | **TAK** | NIE | min. 8 | `refactor(initiatives): route existence gates through the unified reader (E3)` |
| `E4` | OCENY — projekcja serwerowa nad jądrem i magazynem zastanym | NIE | NIE | min. 8 | `feat(assessment): server-side projection over core and legacy stores (E4)` |
| `E5` | FINANSE — pokrycie mostu aliasów | NIE | NIE | min. 6 | `feat(finance): legacy alias coverage measurement and backfill (E5)` |
| `E6` | ARTEFAKTY — jedna tożsamość nad dwoma magazynami | NIE | NIE | min. 6 | `feat(artifacts): single identity read over registry and content stores (E6)` |
| `E7` | seed demo pisze do kanonu | NIE | NIE | min. 4 | `fix(demo-seed): write initiatives to the canonical registry as well (E7)` |
| `E8` | test „nowy rekord z UI widać wszędzie" — 7/7, bez `it.todo` | **TAK** | NIE | min. 7 | `test(initiatives): new record visible on all seven surfaces (E8)` |
| `E9` | raport | **TAK** | NIE | n/d | `docs(codex2): report for the one-store part two block (E9)` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEGO etapu,
> z dowodem przy odpowiedzi `NIE`. Żaden etap nie odpowiada `TAK` — to warunek
> wydania tej instrukcji. Jeżeli w trakcie odkryjesz, że etap jednak wymaga
> pliku przekrojowego, dostarczasz czerwony kontrakt + brief i etap jest
> ZROBIONY (`§0.5`).**

**★ Przypomnienie `DEC-461`:** komunikaty commitów, nazwy plików, nazwy funkcji,
identyfikatory, kody błędów i klucze i18n — **po angielsku**. Komentarze
merytoryczne w kodzie i CAŁY raport — **po polsku**.

---

## E1 — CZĘŚĆ ZAPISOWA INICJATYW (rdzeń)

**Cel:** karta inicjatywy zapisuje rekord kanoniczny. Dziś nie zapisuje —
`PUT /api/initiatives/:id` odpowiada `404`, bo bramka
`InitiativeController.ts:850` pyta wyłącznie tabelę zastaną.

**★ NAJPIERW PRZECZYTAJ DŁUG WEJŚCIOWY.** Zanim napiszesz linijkę kodu,
przeczytaj w całości `FIX-9` i sekcję 2.2 z
`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/97_ODBIOR_W1_W2.md`.
Tam jest zmierzony obraz: **6 × `404 PUT` przy fladze ON i 7 × przy OFF, po
jednym znaku wpisanym w pole tekstowe**. To jest defekt, który naprawiasz.

### E1a — karta wysyła WSZYSTKO, co kanon przyjmuje

**Pomiar wejściowy (potwierdź u siebie):** `AmendInitiativeMetadataSchema`
(`initiativesExecutionRuntime.routes.ts:284-300`) przyjmuje **cztery** pola
merytoryczne: `title`, `problem`, `proposedOutcome`, `initiativeOwnerId`.
`handleSaveRuntimeOnlyMetadata` (`InitiativeDocumentView.tsx:3379`) wysyła
**trzy** — brakuje `initiativeOwnerId`, mimo że komenda go obsługuje i ma
własną walidację uprawnień (`:2213` `isEligibleInitiativeOwner` → `422
INITIATIVE_OWNER_INELIGIBLE`).

**Co robisz:** dokładasz `ownerId → initiativeOwnerId` do ładunku wysyłanego
przez kartę, **pod tym samym warunkiem `canEditOwner`, którym rządzi się
ścieżka zastana**. Obsługujesz `422 INITIATIVE_OWNER_INELIGIBLE` w lejku
tłumaczącym kody (`opiszOdmoweTworzeniaInicjatywy`, `initiativeWriteTruth.ts:193`)
— **dopisujesz kod, nie budujesz drugiego lejka**.

**Zakaz:** nie dopisujesz do schematu pól, dla których **nie udowodnisz**
istnienia pisarza w agregacie. Chęć zapisania `priority` nie jest dowodem, że
agregat kanoniczny ma gdzie ten priorytet trzymać. Jeżeli pole ma trafić do
kanonu — najpierw pokaż `plik:linia` w domenie, gdzie agregat je przechowuje.

### E1b — `PUT /api/initiatives/:id` przy rekordzie kanonicznym: odmowa dla człowieka, nigdy `404` i nigdy cisza

**Reguła rozstrzygająca (wiążąca, nie do wyboru):**

| Sytuacja | Odpowiedź |
| --- | --- |
| Rekord jest w tabeli zastanej | **bez zmian** — dzisiejsza ścieżka, bit w bit |
| Rekord jest **wyłącznie w kanonie**, a ładunek zawiera **wyłącznie** pola z kanonicznym pisarzem | **przekierowanie do komendy kanonicznej** po stronie serwera, `200` z tym samym kształtem odpowiedzi, co dziś |
| Rekord jest **wyłącznie w kanonie**, a ładunek zawiera **choć jedno** pole bez pisarza | **`409`** z `code: 'INITIATIVE_CANONICAL_WRITE_REQUIRED'`, listą pól nieobsłużonych w polu `unsupportedFields`, oraz `canonicalWriter: '/api/initiatives/runtime-v1'` |
| Rekordu nie ma w żadnym magazynie | **`404`** — dziś i po zmianie |

**Twarde reguły `E1b`:**

1. **Zero pętli.** Test obowiązkowy: po odmowie klient **nie ponawia**.
   Asercja liczy żądania w oknie 12 s — dokładnie tak, jak zmierzył to odbiór
   W1/W2. **Więcej niż 1 żądanie na jedną edycję = etap NIEZALICZONY.**
2. **Zero ciszy** (`Z45`). Odmowa dociera do człowieka **po polsku i po angielsku**
   (`Z46`), przez istniejący lejek. Serwer niesie **wyłącznie kod i status**;
   tekst siedzi w `public/locales`.
3. **Flaga `ENABLE_INITIATIVE_UNIFIED_WRITE`, domyślnie `OFF`** (`Z10`).
   Przy `OFF` `PUT` zachowuje się **dokładnie jak dziś** (`404`). Przy `ON`
   działa tabela wyżej. **Domyślnej nie zmieniasz** — włączy ją nadzorca.
   Flagę czytasz **bez `??` i bez wczesnego `return true`** — porównanie
   `=== 'true'`, dokładnie jak `isInitiativeUnifiedReadEnabled()`.
4. **Granica tenanta bez zmian.** Każde zapytanie ma `organization_id` w `WHERE`.
   Cudza inicjatywa dalej daje `404` — **asercja testowa, nie deklaracja**.
5. **Rozróżnienie źródła `409`** (`§0.2e` pułapka (e)): Twoje `409` ma
   `code: 'INITIATIVE_CANONICAL_WRITE_REQUIRED'`, a middleware ma
   `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`. Test asertuje **kod, nie sam status**.

### E1c — naprawa skryptu migracji (dług z odbioru C2)

`scripts/dane/migruj-inicjatywy-do-kanonu.ts` — **wąska licencja, wyłącznie
sześć napraw**. Numeracja i treść pochodzą z
`96_ODBIOR_C2_E3_E5.md` sekcja „FIX-y dla Sonneta":

| FIX | Miejsce | Co zrobić |
| --- | --- | --- |
| `FIX-E3-1` | `:68` | Nazwa bazy przybita `if (database !== 'codex1_staging_1009') throw`. **Zastąp: wymagany jawny `--baza=<nazwa>` + czarna lista hostów skopiowana z `tests/integration/_helpers/assertRealPostgres.ts` (`FORBIDDEN_DB_HOSTS`) + `--oczekiwany-host 127.0.0.1`** (`Z41`) |
| `FIX-E3-2` | `:192-203` | `--dry-run` zapisuje na dysk manifest i plik „do decyzji właściciela" (**920 KB, 105 pełnych wierszy klienta × 106 kolumn**). **Tryb suchy pisze wyłącznie przy jawnym `--zapisz-manifest`** (`Z42`) |
| `FIX-E3-3` | `:197-201` | Manifest główny nie zawiera ścieżki do pliku „do decyzji właściciela" ani `md5` `initiatives` przed/po. **Dodaj pola `ownerDecisionManifestPath`, `initiativesMd5Before`, `initiativesMd5After`** |
| `FIX-E3-4` | `:140` | Rollback kasuje po `aggregate_id` **bez `organization_id`**, choć klucz główny jest trójkolumnowy. **Zapisuj w manifeście pary `{organizationId, aggregateId}` i kasuj po parze** |
| `FIX-E3-5` | `:91` | Gdy `row.status` nie ma w mapie `STATUS`, do kanonu wchodzi **surowa** wartość jako `lifecycleState`. **Brak w mapie ⇒ wiersz POMINIĘTY z powodem `UNKNOWN_STATUS`** (fail-closed, `Z23`) |
| `FIX-E3-6` | `:162-163` | `--verify` na manifeście z pustą listą `createdAggregateIds` zwraca `ok=true` niezależnie od stanu bazy. **Dla `mode==='apply' && created===0` porównuj rozjazd z `missingBefore`, nie tylko z `missingAfter`** |

**★★ WARIANTY ZALEŻNE OD DECYZJI WŁAŚCICIELA — 105 rekordów bez `project_id`
albo `owner_business_id`.**

Sprawdź **najpierw**, czy w katalogu tej instrukcji leży plik
`02_DECYZJA_NADZORCY.txt` z rozstrzygnięciem. Jeżeli **nie** — realizujesz
**WARIANT N** i wpisujesz to do „Korekt wobec instrukcji".

**WARIANT P — „projekt-skrzynka per organizacja" (właściciel powiedział TAK).**
- Skrypt zyskuje tryb `--projekt-skrzynka=<id-projektu>` **per organizacja**,
  podawany **jawnie z linii komend albo z pliku mapy** — nigdy zgadywany.
- Wiersze bez `project_id`, ale **z** `owner_business_id`, migrują do skrzynki
  danej organizacji. Pomiar: **7 rekordów** (77 bez projektu minus 70 bez obu).
- Wiersze bez `owner_business_id` **dalej nie migrują** — właściciela nie da się
  wyprowadzić (Opcja A obalona pomiarem: 5 trafnych na 98).
- Manifest **musi** oznaczyć każdy taki rekord `PROJECT_INBOX_ASSIGNED` z id
  skrzynki, żeby dało się to cofnąć jednym `--rollback`.
- Sam **NIE ZAKŁADASZ** projektu-skrzynki. Jeżeli id nie zostało podane — STOP
  MERYTORYCZNY z listą organizacji, dla których go brakuje.

**WARIANT N — „`projectId = null` dozwolony w kanonie" (właściciel powiedział TAK
na rozluźnienie reguły) ALBO brak decyzji.**
- **Przy braku decyzji: NIC NIE MIGRUJESZ ponad dzisiejsze 2 rekordy.**
  Wykonujesz `FIX-E3-1`…`FIX-E3-6`, uruchamiasz pełny cykl
  (`dry-run` → `apply` ×2 → `verify` → `rollback` → `verify`) i **na tym koniec**.
  Do raportu wchodzą liczby i pytanie do właściciela.
- **Przy decyzji o rozluźnieniu**: zmiana reguły dotyczy
  `src/services/initiativeWriteTruth.ts:186` — **plik ZAMROŻONY `WSPOLNE`**,
  więc: znacznik odmrożenia obowiązkowy, diff wyłącznie w linii reguły, test
  mutacyjny w obie strony, i **jawne zdanie w raporcie, że kanon przestał
  gwarantować przynależność inicjatywy do projektu**. To jest zmiana kontraktu
  produktu, nie refaktor.

**Definicja ukończenia `E1` (mierzalna):**
- test na realnym Postgresie: utworzenie rekordu ścieżką kanoniczną →
  `PUT /api/initiatives/:id` z ładunkiem samych pól wspieranych → **`200`**
  i **readback pokazuje nową wartość w `ie_aggregate_state`**;
- ten sam `PUT` z polem niewspieranym → **`409`** z `code:
  'INITIATIVE_CANONICAL_WRITE_REQUIRED'` i niepustą listą `unsupportedFields`;
- **licznik żądań: 1** — test dowodzi, że po odmowie klient nie ponawia
  (okno 12 s, `--retry=0`);
- przy fladze `OFF` zachowanie **identyczne z markerem** — pomiar `§0.4a`
  nie pokazuje ani jednej nazwy testu, która ZNIKNĘŁA;
- **klucz odmowy w `pl` i `en` z realnym tłumaczeniem** (`Z46`), oba w tym samym commicie;
- **dowód mutacyjny (`Z32`)**: psujesz gałąź kanoniczną w handlerze `PUT` →
  test CZERWONY; cofasz przez `cp` → ZIELONY; `git diff` pusty. Obie komendy
  i oba wyniki w raporcie;
- skrypt migracji: pełny cykl z sześcioma naprawami, `md5` tabeli `initiatives`
  identyczne przed `--apply` i po `--rollback`, `ie_outbox_delivery_receipts` = 0.

**Możliwe STOP-y w `E1`:**
- **przekierowanie `PUT` → komenda wymagałoby `expectedVersion`, którego klient
  nie zna** — STOP MERYTORYCZNY z propozycją: albo serwer dociąga wersję sam
  (i wtedy tracimy ochronę przed nadpisaniem — opisz ryzyko), albo klient ją
  wysyła (i wtedy trzeba ruszyć kartę — opisz zakres);
- **`initiativeOwnerId` przechodzi walidację uprawnień inaczej niż ścieżka
  zastana** — STOP z tabelą „kto może zmienić właściciela w zastanym / w kanonie";
- **rollback skryptu nie odtwarza stanu co do wiersza** — **STOP CAŁEGO
  ETAPU `E1c` i NIE COMMITUJESZ trybu `--apply`.**

---

## E2 — SZEŚCIU PISARZY LEGACY: PROJEKT KANONICZNYCH NASTĘPCÓW (rdzeń)

**★★ REGUŁA, KTÓRA JEST WAŻNIEJSZA NIŻ SAM CEL** (wpisana krwią 07.09,
komentarz w `executionSpineLegacyReadOnly.middleware.ts`, sekcja „ZAWEZENIE
07.09 (DEC-453)"):

> **Ścieżkę wolno wycofać WYŁĄCZNIE wtedy, gdy istnieje kanoniczna komenda
> runtime-v1 pisząca do TEGO SAMEGO modelu odczytu, który czyta ekran — albo
> gdy nikt tej ścieżki nie woła.**

Poprzednim razem wycofano ścieżki bez następcy. Skutek: „Dodaj element"
w RAID, kamieniach milowych, zasobach, planach obsady, pozycjach budżetu
i rolach bram odpowiadało `409`, **nic się nie działo**, a właściciel cofnął
odbiór dwóch modułów. **Nie powtarzasz tego.**

**Twoja lista robocza — sześć ścieżek przywróconych 07.09:**
`milestones` · `resources` · `staffing-plans` · `budget-items` · `gate-roles` · `move`.

**Pomiar wejściowy: WSZYSTKIE SZEŚĆ mają realnych wołaczy w `src/`**
(`§0.1a` komenda 7). Czyli odpowiedź na pytanie 1 brzmi **TAK** dla każdej —
i to jest różnica wobec `start-execution|block|unblock|lifecycle-*|apply-*`,
które wycofano, bo były martwe.

**Procedura na KAŻDĄ ze ścieżek — cztery pytania, wszystkie z dowodem:**

| # | Pytanie | Dowód |
| --- | --- | --- |
| 1 | Czy ktoś ją woła z `src/`? | `grep -rn "<fragment ścieżki>" src/ \| grep -v __tests__` — **bez `\| head`** |
| 2 | Czy istnieje komenda kanoniczna robiąca to samo? | `plik:linia` w `initiativesExecutionRuntime.routes.ts` |
| 3 | Czy ta komenda pisze do **tego samego** modelu odczytu, który czyta ekran? | test na realnym Postgresie: zapis komendą kanoniczną → odczyt **trasą, którą woła ekran** → **rekord widoczny, z identyfikatorem i treścią** (`Z23`) |
| 4 | Czy odmowa dociera do człowieka po polsku i po angielsku? | żądanie HTTP + wpis w `public/locales/{pl,en}` (`Z46`) |

**Rozstrzygnięcie zależnie od odpowiedzi:**

- **1=NIE** → ścieżka martwa, wolno wycofać. Wpisz do raportu, że jest martwa.
- **1=TAK, 2=NIE** → **NIE WYCOFUJESZ.** Wpisujesz jako „brakujący następca
  kanoniczny" **z projektem kształtu komendy** (ścieżka, ładunek, kody błędów,
  do którego agregatu pisze, który czytnik ma to zobaczyć).
- **1=TAK, 2=TAK, 3=NIE** → **NIE WYCOFUJESZ.** To jest dokładnie pułapka
  z 07.09. Wpisujesz, **czym różni się model odczytu**, z dwoma zapytaniami SQL.
- **1=TAK, 2=TAK, 3=TAK** → **wycofujesz**: dopisujesz wzorzec do
  `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` i dodajesz test.

**Kandydaci zmierzeni przeze mnie — zweryfikuj, nie przepisuj:**

| Ścieżka zastana | Kandydat kanoniczny | Co trzeba udowodnić w pytaniu 3 |
| --- | --- | --- |
| `milestones` | `POST /execution-cases/:caseId/milestones/:milestoneId` (`:4977`) | ekran czyta `GET /api/initiatives/:id/milestones` → tabela `initiative_milestones` (**1070 wierszy**); komenda pisze do agregatu `execution_milestone` (**6**). **To prawie na pewno INNY model — udowodnij którykolwiek werdykt zapytaniem** |
| `resources` | `POST /resource-commitments/:id` (`:4483`) | agregat `resource_commitment` ma **1** wiersz |
| `staffing-plans` | brak oczywistego; sprawdź `capacity-scenarios` (`:4220`, `:4321`) | — |
| `budget-items` | `POST /initiatives/:id/budget-entries/:entryId` (`:5663`), `…/void` (`:5631`) | **ten sam agregat `initiative`** — najbardziej obiecujący kandydat. Sprawdź, czy `GET /api/initiatives/:id/budget-items` zobaczy zapis komendy |
| `gate-roles` | `POST /initiatives/:id/gate-signoffs` (`:7404`), agregaty `gate_signoff` (9) / `gate_quorum` (9) | ekran czyta `GET /api/initiatives/:id/gate-roles` |
| `move` | brak | — |

**Wzorzec, który już zadziałał** (kopiuj kształt, nie treść): `raid`.
Komentarz w middleware mówi wprost, dlaczego RAID wolno było wycofać:
*„pisze do tej samej tabeli `raid_items`, ktora czyta `GET .../raid`; dowod:
`zapisyInicjatyw.raidCanonical.pg.test.ts`"*. **Twój dowód dla każdej
wycofanej ścieżki ma mieć dokładnie ten kształt: nazwa pliku testu + nazwa
wspólnej tabeli/agregatu.**

**Definicja ukończenia (mierzalna):**
- tabela w raporcie: **sześć ścieżek × cztery odpowiedzi × werdykt**
  (wycofana / zostaje / brak następcy), każda odpowiedź z dowodem;
- dla każdej **wycofanej** ścieżki test na realnym Postgresie:
  `409` z `code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED'` **oraz** dowód
  osiągalności (`Z21`): zapis komendą kanoniczną → odczyt trasą ekranu →
  **rekord z identyfikatorem i treścią**;
- **rozróżnienie źródła `409`** (`§0.2e` (e)): asercja na `code`
  **i** na `canonicalWriter`;
- dla każdej **niewycofanej** ścieżki: projekt komendy w raporcie
  (ścieżka · ładunek · agregat · czytnik · szacowany rozmiar);
- `--retry=0` w każdej komendzie testowej (`Z29`);
- **zero nowych wzorców w `LEGACY_INITIATIVE_EXECUTION_WRITE_PATHS` bez testu.**

**Możliwe STOP-y w `E2`:**
- **komenda kanoniczna istnieje, ale ma inny kształt danych niż trasa zastana** —
  STOP MERYTORYCZNY z tabelą pól i propozycją;
- **ekran woła trasę zastaną z pliku, którego licencja nie obejmuje** —
  czerwony kontrakt + brief;
- **wycofanie ścieżki zmieniłoby zachowanie widoczne dla użytkownika** —
  nie wycofujesz, piszesz STOP.

---

## E3 — PRZEŁĄCZENIE 47 BRAMEK ISTNIENIA (rdzeń)

**Cel:** żaden ekran nie odpowiada „nie ma takiej inicjatywy" tylko dlatego,
że rekord mieszka w drugim magazynie.

**Kolejność wiążąca (od największego skupiska do najmniejszego):**

1. `server/src/routes/v8/results.routes.ts` — **11 bramek**
   (`§0.2e` pułapki (a) i (b) dotyczą tego pliku wprost);
2. `server/src/controllers/InitiativeController.ts` — **10** (3 już z fallbackiem);
3. `server/src/routes/v8/execution-control.routes.ts` — **5**;
4. `server/src/services/initiativeGovernanceService.ts` — **4**;
5. `server/src/routes/pmo/initiatives.routes.ts` — **3**;
6. `server/src/routes/benefits.routes.ts` — **3**;
7. `server/src/routes/v8/execution.routes.ts` — **2**;
8. pozostałe pliki po jednej.

**Po każdym pliku: commit + przebieg testów.** Diff w plikach z wąską licencją
ma dotykać **WYŁĄCZNIE linii bramki**.

**Twarde reguły `E3`:**

1. **Za flagą `ENABLE_INITIATIVE_UNIFIED_READ`** (istniejącą z CODEX1, default
   `OFF`). Przy `OFF` każda podmieniona bramka zachowuje się **dokładnie jak
   dziś**. **Domyślnej nie zmieniasz** (`Z10`).
2. **`pmoValidation.middleware.ts` ZOSTAJE NIETKNIĘTY** — to jedyna bramka bez
   zawężenia do organizacji, ale jej naprawa to zmiana granicy tenanta (`Z12`).
   **Zgłaszasz ją w raporcie z plik:linia i gotowym, nienałożonym diffem.**
3. **★ `FIX-6` z odbioru W1/W2 — BLOKUJE WŁĄCZENIE FLAGI, sprawdź, czy jest
   już zrobiony na Twoim markerze.** Blok czytnika w `InitiativeController.ts`
   (ok. `:446-467`) był doklejany **po** `ORDER BY`, `LIMIT/OFFSET` i po
   wszystkich `WHERE`, przez co przy `ON` psuł: `?limit=10` → **121** zamiast 10,
   `?source=assessment` → **121** zamiast 3, `?priority=high` → **121** zamiast 13,
   `?projectId=unassigned` → **121** zamiast 73. **Zmierz te cztery zapytania
   u siebie, przy `ON` i przy `OFF`, i wpisz wyniki do raportu.** Jeżeli
   regresja wróciła — masz **wąską licencję** na `InitiativeController.ts`,
   żeby ją naprawić w tym etapie.
4. **Zero duplikowania tabel.** Zakaz tabeli cache, tabeli mostu, kolumny-kopii
   i widoku materializowanego.
5. **Zdejmujesz kliencki most** (`mergeLegacyInitiativesIntoRegister`,
   `initiativeRegisterProjection.ts:498`) **dopiero wtedy**, gdy
   `GET /api/initiatives` przy fladze `ON` zwraca komplet **z poprawnymi
   filtrami** — udowodnione żądaniem HTTP, nie gerpem (`Z34`).
   **Jeżeli zdjęcie mostu zmieniłoby cokolwiek na ekranie — zostawiasz most
   i piszesz STOP MERYTORYCZNY.**
6. **Nie łamiesz uzgodnienia `C1-FIX-1`**: przy kolizji `id` **status pochodzi
   z magazynu klasycznego**, reszta pól z kanonu. To jest wynik odbioru
   (sekcja 1b `97_ODBIOR_W1_W2.md`), nie preferencja.

**Definicja ukończenia (mierzalna):**
- `grep -rn "SELECT id FROM initiatives WHERE id" server/src | grep -v __tests__ | wc -l`
  spada z **50** do liczby, którą wypisujesz imiennie, **z listą pozostałych
  i powodem, dlaczego zostały** (`pmoValidation.middleware.ts` jest jednym z nich);
- **cztery zapytania filtrujące z reguły 3** dają przy `ON` te same liczby, co
  przy `OFF`, **plus rekordy kanoniczne** — i ani jednej więcej;
- **dowód izolacji tenanta**: żądanie tokenem organizacji B o inicjatywę
  organizacji A → `404` przy `ON` i przy `OFF`, `--retry=0`;
- **dowód mutacyjny (`Z32`)**: usuwasz `organization_id` z jednego zapytania
  projekcji → test izolacji CZERWONY; cofasz przez `cp` → ZIELONY; `git diff` pusty;
- **hałas w logach**: `GET /api/initiatives` emituje **≤ 1 linię ostrzeżenia
  na żądanie** (`C1-FIX-5` — przed naprawą było **106 linii na jedno żądanie**,
  4 770 w 25 minut pracy). Zmierz i wpisz liczbę.

**Możliwe STOP-y w `E3`:**
- **projekcja wywraca wydajność** — jeżeli `listInitiativeHeaders` na 121
  wierszach przekracza 300 ms, STOP z pomiarem i propozycją indeksu jako NOWA
  migracja (pomiar wejściowy z odbioru: **ON mediana 26 ms, OFF 24,5 ms**,
  narzut ok. +1,5 ms — więc przekroczenie byłoby regresją, nie normą);
- **konsument, którego licencja nie obejmuje** — czerwony kontrakt + brief.

---

## E4 — OCENY: PROJEKCJA SERWEROWA

**Cel:** jedna projekcja po stronie **serwera**, przez którą lista i karta oceny
widzą **oba** magazyny — jądro method-core i tabelę zastaną `assessments`.

**★ To jest ten sam ruch, który CODEX1 zrobił dla Inicjatyw — i ta sama
przyczyna: projekcja istnieje, ale w złej warstwie.** Dziś scalanie robi
przeglądarka (`src/components/assessment/assessmentOutputProjection.ts`,
wołana z `AssessmentOutputsTab.tsx:62`, `AssessmentHub.tsx:108`), więc widzi ją
**jeden ekran**, a 37 bramek serwerowych — żaden.

**Co budujesz — jeden nowy plik, jedna odpowiedzialność:**

`server/src/domain/assessment/assessmentUnifiedReader.ts`

Minimalny kontrakt (nazwy dobierz sam, kształt jest wiążący; **kod i nazwy po
angielsku**, `DEC-461`):

| Funkcja | Co zwraca | Reguła |
| --- | --- | --- |
| `assessmentExists(orgId, assessmentId)` | `boolean` | `true`, jeżeli rekord jest **w którymkolwiek** magazynie, zawsze zawężone do `organization_id` |
| `readAssessmentHeader(orgId, assessmentId)` | wspólny, wąski kształt: `{ id, title, state, projectId, ownerId, source: 'CORE' \| 'LEGACY' }` albo `null` | Przy kolizji `id` **wygrywa jądro**; pole `source` idzie do logów, **nigdy do pola plakietki źródła na ekranie** (`C1-FIX-2` — CODEX1 wpisał `CANONICAL` do `sourceType`, czyli do pola, które niesie pochodzenie biznesowe) |
| `listAssessmentHeaders(orgId, filtry)` | lista powyższych | Suma obu magazynów, deduplikacja, **rekord niemapowalny NIE ZNIKA — jest liczony i wypisany** (`Z23`) |

**★★ NAJTRUDNIEJSZA CZĘŚĆ TEGO ETAPU — TOŻSAMOŚĆ.**
**W Ocenach NIE MA wspólnego klucza.** `method_sessions` nie ma `assessment_id`,
`assessments` nie ma `method_session_id` (zmierzone, `§0.1a` — sprawdź sam).
Dlatego:

1. **Najpierw ZMIERZ, czy jakakolwiek para da się połączyć.** Kandydaci do
   sprawdzenia: `(organization_id, project_id, created_at)`,
   `assessments.assessment_definition_id` ↔ `method_sessions.method_pack_id`,
   `method_session_report_metadata`, `assessment_skip_reasons` (serwis
   `assessmentSkipReasonService.ts` pyta `SELECT id FROM method_sessions` —
   sprawdź, czym jest jego `id`). **Wynik wpisz jako tabelę, nawet jeśli brzmi
   „zero par".**
2. **Jeżeli pary nie ma — NIE WYMYŚLASZ JEJ.** Projekcja zwraca wtedy **sumę
   rozłączną** obu magazynów z jawnym `source` i licznikiem, a raport mówi
   wprost: „tożsamość między jądrem a magazynem zastanym nie istnieje w danych;
   dopóki jej nie ma, ten sam warsztat oceniony dwa razy pojawi się na liście
   dwa razy". **To jest uczciwy wynik, nie porażka etapu.**
3. **Zakaz dopisywania kolumny łączącej „na oko".** Jeżeli uznasz, że
   potrzebna jest nowa kolumna — to **migracja addytywna w Twoim przedziale**
   plus **jawne pytanie do właściciela**, kto ma tę kolumnę wypełnić.

**Podmiana bramek — 37 sztuk, kolejność:** `AssessmentController.ts` (9) →
`v8/assessment.routes.ts` (5) → `AssessmentWorkbenchService.ts` (4) →
`assessmentInitiativeService.ts` (3) → `assessment/assessment-workflow.routes.ts` (3) →
`assessment-workflow-v2.routes.ts` (2) → reszta.
**`assessmentPermissionService.ts` ZOSTAJE NIETKNIĘTY** (`Z12`) — zgłaszasz
w raporcie.

**Definicja ukończenia (mierzalna):**
- test na realnym Postgresie: ocena istniejąca **wyłącznie w magazynie
  zastanym** jest widoczna przez trasę, która dziś czyta jądro — i odwrotnie;
- **liczba rekordów niedopasowanych jest RAPORTOWANA, nie ukryta** (`Z23`);
- **dowód izolacji tenanta** dla obu magazynów, `--retry=0`;
- **dowód mutacyjny** w obie strony;
- zdjęcie mostu klienckiego **tylko** po dowodzie HTTP; brak dowodu = most zostaje;
- akapit `§0.2e` w pliku testu (`Z44`).

**Możliwe STOP-y w `E4`:**
- **kształty rekordu są nieuzgadnialne** — STOP z tabelą „pole zastane → pole
  jądra → czy da się wyliczyć";
- **`assessments.answers_json` ma w danych więcej niż jeden kształt** (kolumna
  jest `json`, `§0.2d` pkt 6 — nie parsuj drugi raz) — STOP z rozkładem kształtów.

---

## E5 — FINANSE: POKRYCIE MOSTU ALIASÓW

**Cel:** most `finance_artifact_aliases` istnieje i jest czytany. **Problem jest
w pokryciu: 38 z 49 rekordów zastanych (77,6 %) nie ma aliasu.**

**★ CZEGO NIE ROBISZ:** nie budujesz drugiej projekcji, nie tworzysz trzeciego
magazynu, nie zmieniasz kształtu aliasu. Czytasz nagłówek
`server/src/services/finance/canonical/legacyIdBridgeService.ts` — on sam mówi,
że pokrycie zależy od tego, **czy uruchomiono backfill `WP-C03` dla danej
organizacji**, i że to jest decyzja programowa poza tamtym modułem.
**W tym bloku tę decyzję wykonujesz — lokalnie, na kopii, addytywnie.**

**Co robisz:**

1. **Pomiar pokrycia — obowiązkowo per organizacja, nie zbiorczo.**
   Tabela: organizacja × tabela zastana × wierszy × ma alias × bez aliasu.
   Moje liczby zbiorcze: `financial_analyses` 6/1/**5**, `financial_models`
   17/3/**14**, `financial_statement_packs` 10/4/**6**, `valuations` 16/3/**13**.
2. **Skrypt `scripts/dane/pokryj-aliasy-finansowe.ts`** — kształt jak
   `scripts/dane/usun-organizacje.ts` (tylko odczyt, wzorzec): `--dry-run`
   (domyślny), `--apply` (dwa klucze + `--oczekiwany-host 127.0.0.1`),
   `--rollback=<manifest>`, `--verify`, `--baza=<nazwa>` (`Z41`),
   manifest tylko przy zapisie (`Z42`).
   **Algorytm bierzesz z `server/scripts/finance-v3-backfill-dry-run.ts`
   (TYLKO ODCZYT, wzorzec) — nie wymyślasz własnego dopasowania.**
3. **`mapping_confidence` i `mapping_reason` są OBOWIĄZKOWE dla każdego
   dopisanego aliasu.** Alias o niskiej pewności ma być **oznaczony**, a nie
   pominięty ani udawany jako pewny (`Z23`).
4. **Rekord, którego nie da się dopasować, NIE dostaje aliasu wymyślonego** —
   trafia do manifestu „do decyzji właściciela" z powodem.
5. **`finance_legacy_usage_events` (949 wierszy) to Twój licznik postępu.**
   Zmierz, ile z tych zdarzeń dotyczy `legacy_id`, który ma dziś alias, a ile
   takich, które go nie mają — to jest realna miara, ilu użytkowników
   uderza dziś w ślepy zaułek.

**Definicja ukończenia (mierzalna):**
- tabela pokrycia PRZED i PO, per organizacja i per tabela;
- `--apply` uruchomiony dwa razy: pierwszy tworzy N aliasów, drugi **0**;
- `--rollback` przywraca stan **co do wiersza**, `--verify` to potwierdza;
- **żaden wiersz w tabelach zastanych się nie zmienił** — dowód `md5` przed i po;
- liczba rekordów, których nie dało się dopasować, **z powodami**;
- test na realnym Postgresie: rekord zastany **z aliasem** otwiera się we
  właściwym warsztacie v3 (`Z21` — pełna ścieżka, kod odpowiedzi w raporcie).

**Możliwe STOP-y w `E5`:**
- **algorytm backfillu daje więcej niż jeden kandydat na rekord** — STOP
  z rozkładem i propozycją reguły rozstrzygającej;
- **liczba niedopasowanych przekracza 30 %** — to nie jest backfill, tylko
  decyzja produktowa. STOP MERYTORYCZNY, manifest jako załącznik.

---

## E6 — ARTEFAKTY: JEDNA TOŻSAMOŚĆ NAD DWOMA MAGAZYNAMI

**Cel:** jeden odczyt, który dla danego `artifact_id` widzi **i** rejestr
metadanych (`v8_output_artifacts`), **i** treść (`wave5_artifacts`), i który
**liczy** rekordy niepełne, zamiast je gubić.

**Stan wejściowy (mój pomiar — obal go, jeśli zmierzysz inaczej):**

| Pomiar | Wynik |
| --- | --- |
| `v8_output_artifacts` | 872 |
| `wave5_artifacts` | 237 |
| część wspólna po `artifact_id` | **102** |
| treść bez rejestru | **135** |
| rejestr bez treści | **770** |
| rejestr bez `v8_artifact_origin_links` | **136** |
| link bez rejestru (**osierocony**) | **65** |

**Teza wejściowa:** `tool_outputs` (**0 wierszy**) i `knowledge_docs` (**270**,
ale to Materiały/skarbiec — inny produkt, 26 wywołań z
`organizationContext/ContextDocumentService.ts`) **nie są** drugim magazynem
tych samych artefaktów. **Jeżeli zmierzysz inaczej — Twój pomiar jest wiążący,
a obalenie tej tezy wpisujesz jako sukces.**

**Co robisz:**

1. **Inwentarz tożsamości** — skrypt `scripts/dane/zwiaz-tozsamosc-artefaktow.ts`
   (`Z41`, `Z42`), tryb suchy domyślny. Wypisuje trzy zbiory: pełne, bez treści,
   bez rejestru — **z organizacją i typem**, żeby dało się ocenić skalę.
2. **65 osieroconych linków** — to najprawdopodobniej pozostałość po skasowanych
   artefaktach. **NIE KASUJESZ ich** (`Z40`). Liczysz, klasyfikujesz i pytasz.
3. **Odczyt tożsamości** — funkcja, która dla `artifact_id` zwraca
   `{ id, family, hasRegistry, hasContent, originRuntime, source }`.
   **`hasContent: false` jest poprawną, uczciwą odpowiedzią** — nie zastępujesz
   jej pustym stringiem (`Z16`, `Z23`).
4. **Zero nowego magazynu.** Żadnej tabeli scalającej.

**Definicja ukończenia (mierzalna):**
- trzy zbiory policzone i zapisane w manifeście z `shasum -a 256`;
- test na realnym Postgresie: artefakt z treścią i bez treści dają **różne,
  jawnie rozróżnialne** odpowiedzi, a nie oba `200` z pustką;
- **dowód izolacji tenanta** (`v8_output_artifacts` ma 4 organizacje w kopii);
- akapit `§0.2e` w pliku testu.

**Możliwe STOP-y w `E6`:**
- **`artifact_id` w obu tabelach ma różny format** — STOP z rozkładem;
- **konsument oczekuje, że brak treści to pusty string** — STOP, bo to zmiana
  kontraktu widoczna na ekranie; opisujesz i nie zmieniasz.

---

## E7 — SEED DEMO PISZE DO KANONU

**Cel:** przestać powiększać rozjazd przy każdym otwarciu aplikacji.

**Pomiar wejściowy:** `server/src/services/demo/demoSeedService.ts:2295` robi
`INSERT INTO initiatives … ON CONFLICT(id) DO UPDATE`; `ie_aggregate_state`
w tym pliku ma **0 trafień**. Odbiór C2 zmierzył: **2 sesje demo × 22
inicjatywy = 44 wiersze zastane, 0 kanonicznych**.

**Co robisz:** dopisujesz **obok** istniejącego `INSERT` zapis kanoniczny —
albo przez komendę runtime-v1, albo przez tę samą drogę, którą wybrałeś
w `E1c`. **Nie ruszasz idempotencji**: deterministyczne `makeId` i
`ON CONFLICT(id) DO UPDATE` zostają, bo bez nich re-seed przestaje działać
(komentarz „USPOJNIENIE A3" w `:2287` tłumaczy dlaczego).

**Twarde reguły:**

1. **Zapis kanoniczny musi być tak samo idempotentny** — drugi seed dopisuje
   **zero** agregatów. To jest osobna asercja.
2. **Zero drenaży outboxu** (`Z30`). Po seedzie `ie_outbox_delivery_receipts` = 0.
3. **Jeżeli 22 inicjatywy seedu nie mają `project_id` albo właściciela** —
   obowiązuje ten sam wybór `WARIANT P` / `WARIANT N` co w `E1c`.
   **Seed ma dane wymyślone przez nas, więc tu wolno je uzupełnić** — ale
   **jawnie**, w definicji seedu, nie przez zgadywanie w kodzie migracji.
4. **Dane demo są twarzą produktu** (`CLAUDE.md`): sonda sprząta po sobie,
   zero rekordów testowych zostawionych w kopii.

**Definicja ukończenia:**
- seed uruchomiony dwa razy: pierwszy tworzy N agregatów, drugi **0**;
- po seedzie: `SELECT count(*) FROM initiatives i WHERE NOT EXISTS (…)`
  dla organizacji demo = **0** (albo liczba wypisana z powodem);
- `ie_outbox_delivery_receipts` = 0;
- dowód mutacyjny w obie strony.

**Możliwy STOP w `E7`:** komenda kanoniczna odrzuca agregat z powodu reguły
domenowej, której definicja seedu nie spełnia — STOP z nazwą reguły
i przykładem.

---

## E8 — TEST „NOWY REKORD Z UI WIDAĆ WSZĘDZIE" — 7/7, BEZ `it.todo`

**Cel:** jeden przebieg, który przechodzi przez **siedem** powierzchni i nie da
się go oszukać. **CODEX1 oddał 3/7 i przybił ten wynik asercją. To jest dług,
który zamykasz.**

**Plik do naprawy (wąska licencja):**
`server/src/domain/initiatives-execution/__tests__/nowyRekordSiedemPowierzchni.pg.test.ts`

**Cztery naprawy z odbioru C2 — obowiązkowe:**

| FIX | Miejsce | Co zrobić |
| --- | --- | --- |
| `FIX-E5-1` (**blokujący dla CI**) | `:105` | `expect(visible).toEqual(ON ? ['lista','karta','KPI'] : [])` **przybija stan zastany** i zrobi się CZERWONY, gdy ktoś podłączy powierzchnię 4/5/6/7 — **karze za postęp**. Rozdziel na (a) asercję celu `expect(visible).toEqual(expect.arrayContaining([...]))` i (b) osobny, jawnie nazwany snapshot stanu zastanego z komentarzem, kiedy ma zniknąć (`Z43`) |
| `FIX-E5-2` | nagłówek + `beforeAll` `:29-42` | Brak akapitu `§0.2e`. Dodaj komentarz nagłówkowy z rozstrzygnięciem pułapek (a)–(f) **oraz twarde asercje env** (`Z44`). Treść merytoryczną weź z sekcji 1.5 `96_ODBIOR_C2_E3_E5.md` — jest zmierzona |
| `FIX-E5-3` | `:92-94` | Powierzchnia „KPI" zaliczana kryterium słabym (`200` i brak `INITIATIVE_NOT_FOUND`), a odpowiedź to `{"kpis":[]}` — bez id i bez tytułu. Dodaj do wiersza macierzy pole `criterion: 'content' \| 'no-404'` i raportuj rozdzielnie (`Z23`) |
| `FIX-E5-4` | `:29-55` | `beforeAll` bez `try/finally` — przerwany setup zostawia organizację, użytkownika i projekt w bazie. Sprzątanie w `afterAll` **bezwarunkowo** po `organizationId` |

**Scenariusz — kolejność wiążąca:**

1. Rekord powstaje **tą samą drogą, którą idzie właściciel**:
   `POST /api/initiatives/runtime-v1/source-proposals` →
   `POST /api/initiatives/runtime-v1/registrations`.
   **Warstwę przeglądarki wolno pominąć** — powód jest zmierzony (`§0.2d` pkt 25)
   i wolno go zacytować, ale **musisz to jawnie adnotować**, a nie liczyć
   pominiętej warstwy jako którejkolwiek z siedmiu.
2. Zapamiętujesz `id`.
3. **Siedem sprawdzeń, każde osobną asercją, każde po TREŚCI** (`Z23`):

| # | Powierzchnia | Trasa (zmierzona przez CODEX1 — potwierdź) | Kryterium |
| --- | --- | --- | --- |
| 1 | Rejestr / lista | `GET /api/initiatives` | `200` + id **i** tytuł w kopercie |
| 2 | Karta | `GET /api/initiatives/:id` | `200` + tytuł |
| 3 | KPI | `GET /api/initiatives/:id/kpis` | `200` + **id w treści** (dziś `{"kpis":[]}` — kryterium słabe, `FIX-E5-3`) |
| 4 | Kokpit Realizacji | `GET /api/v8/execution-control/capacity/timeline?initiativeId=` | `200` + id (dziś `404 INITIATIVE_NOT_FOUND`) |
| 5 | Moja Praca | `GET /api/my-work/executive-analytics` | rekord obecny w treści (dziś `200` bez rekordu) |
| 6 | Wyniki | `GET /api/v8/results/dashboard?initiativeId=` | `200` + id, **z `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`** (dziś `404`) |
| 7 | Raporty | `GET /api/report-builder/backlinks/initiative/:id` | `200` + id **i tytuł** (dziś echo id bez tytułu — nie zalicza) |

4. **Przebieg w OBU ustawieniach flagi odczytu** (`§0.2e` (f)) **i obu
   ustawieniach flagi zapisu z `E1`** — cztery macierze, wszystkie w raporcie.
5. **Warstwa SQL — obowiązkowa, bo HTTP potrafi kłamać kopertą:**

```sql
SELECT
  (SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id = :id) AS kanon,
  (SELECT count(*) FROM initiatives WHERE id = :id) AS zastany;
```

   Wynik wpisujesz do raportu. **Nie zakładasz, jaki ma być** — ważne, żeby był
   ZMIERZONY i OPISANY.

6. **Zapis też ma być sprawdzony, nie tylko odczyt** (to jest różnica wobec
   CODEX1): po siedmiu odczytach robisz `PUT /api/initiatives/:id` z polem
   wspieranym → `200` → **ponowny odczyt powierzchni 1 i 2 pokazuje NOWĄ
   wartość**. Bez tego „widać wszędzie" nie znaczy „da się tym zarządzać",
   a właściciel cofnął odbiór właśnie za zarządzanie (`DEC-453`).

**Testy mutacyjne bezpieczników (`Z32`) — TRZY, każdy w obie strony.
CODEX1 ich NIE zrobił i odbiór uznał `E5` za niedokończone:**

| Mutacja | Oczekiwanie |
| --- | --- |
| usuwasz gałąź kanoniczną w `initiativeUnifiedReader` | sprawdzenia 1, 2, 3 CZERWONE |
| usuwasz `organization_id` z jednego zapytania projekcji | test izolacji tenanta CZERWONY |
| usuwasz gałąź kanoniczną w handlerze `PUT` z `E1` | sprawdzenie 6 (zapis) CZERWONE |

Po każdej: cofasz przez `cp` (`Z27`), test ZIELONY, `git diff` **pusty**.
**Obie komendy i oba wyniki dosłownie w raporcie.**

**Definicja ukończenia:**
- **siedem sprawdzeń zielonych w jednym przebiegu, `--retry=0`, bez `it.todo`**;
- każde sprawdzenie z jawnie zapisanym kryterium (`content` / `no-404`),
  a raport podaje rozbicie („N/7 po treści + M/7 po kryterium słabym");
- zapytanie SQL wykonane i wynik w raporcie;
- **sprawdzenie zapisu (punkt 6) zielone**;
- trzy dowody mutacyjne w obie strony, z komendami;
- akapit `§0.2e` w pliku testu (`Z44`);
- `§0.4a`: `diff przed-nazwy.txt po-nazwy.txt` z listą nazw DODANYCH i ZNIKNIĘTYCH.

**Możliwe STOP-y w `E8`:**
- **któraś powierzchnia wymaga danych, których nie da się zasiać bez modelu
  językowego** (`Z15`) — opisujesz i pomijasz **tę jedną**, reszta idzie;
- **powierzchnia 5 (Moja Praca) nie listuje inicjatyw w ogóle** — odbiór W1/W2
  zmierzył, że ekran ich nie czyta. Wtedy **zmieniasz trasę na taką, która je
  czyta, i wpisujesz to do „Korekt"** — nie zaliczasz `200` bez rekordu.

---

## E9 — RAPORT (rdzeń)

**Jedyny nowy dokument w repo** (`Z13`):
`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md`

**Układ narzucony — nie zmieniasz kolejności ani nagłówków. Raport po polsku.**

```markdown
# RAPORT — CODEX2 — Jeden magazyn, część 2

## 0. Metryka
Marker: <SHA> · gałąź: codex/jeden-magazyn-czesc-2-20260911
SHA po każdym etapie: E1 <sha> · E2 <sha> · … · E9 <sha>
Wynik `git merge-base --is-ancestor <MARKER> HEAD`: <wynik>
Wynik `git rev-parse HEAD` i `git status --short` z §0.1 krok (7): <dosłownie>
Kontener/bazy/porty: cx-codex2-pg / cx_codex2 + codex2_kopia_1009 / 6452, 5592
Migracje: liczba zastosowanych w przebiegu 1 i 2, wynik idempotencji
Znaczniki odmrożenia użyte w commitach: <lista> + wynik check-freeze.sh

## 1. K-PUNKTY — PRZED i PO
| K | Co mierzę | PRZED (mój pomiar) | PO (mój pomiar) | Komenda |
| K1 | bramki istnienia inicjatywy pytające tylko magazyn zastany | | | |
| K2 | z tego z fallbackiem kanonicznym | | | |
| K3 | bramki istnienia oceny | | | |
| K4 | pola karty inicjatywy z kanonicznym pisarzem / bez | | | |
| K5 | ścieżki zapisu zastane: wycofane / zostają / bez następcy | | | |
| K6 | powierzchnie widzące nowy rekord (z 7), po treści / po kryterium słabym | | | |
| K7 | rekordy zastane finansów bez aliasu (per tabela) | | | |
| K8 | artefakty: rejestr bez treści / treść bez rejestru / osierocone linki | | | |
| K9 | inicjatywy zasiane przez demo bez agregatu | | | |
| K10 | wiersze pominięte przez migrację + powód | | | |
Obok każdej mojej liczby wpisz liczbę autora instrukcji i zaznacz rozbieżność.

## 2. Stan wejściowy — 14 komend z §0.1a
Wynik każdej dosłownie, obok wyniku autora instrukcji.

## 3. Etapy — po jednej sekcji na etap (E1…E9)
Dla każdego: co zrobiłem · definicja ukończenia i czy spełniona · komendy
dowodowe z wynikami · akapit §0.2e (która pułapka, jak wyłączona) · SHA commita.

## 4. Dowody mutacyjne (Z32)
Dla każdego: komenda psująca · wynik CZERWONY · komenda cofająca (cp) ·
wynik ZIELONY · `git diff` pusty. Minimum trzy z E8 plus po jednym z E1, E3, E4.

## 5. Pomiar zasięgu testów (§0.4a, Z24)
`diff przed-nazwy.txt po-nazwy.txt`: nazwy DODANE, nazwy ZNIKNIĘTE.
Każda zniknięta = wyjaśnienie.

## 6. Deklaracja Z30
Dosłowny akapit z §0.2b (4) + wynik `ie_outbox_delivery_receipts` po każdym
etapie zapisującym.

## 7. Migracje i manifesty
Dla każdego skryptu: ścieżka manifestu · `ls -l` · `shasum -a 256` · liczby
przed/po · wynik `--verify` po rollbacku · dowód `md5`, że tabela zastana
się nie zmieniła. Osobno dla E1c, E5, E6.

## 8. Korekty wobec instrukcji
Każda rozbieżność mojego pomiaru z liczbą autora — jako WYNIK, nie sprzeczność.
Cytat obu zdań przy sprzecznościach wewnętrznych + którą interpretację wybrałem.
Obowiązkowo: który WARIANT (P / N) zrealizowałem i na jakiej podstawie.

## 9. STOP-y
Format z §0.5, każdy z wypełnionymi polami „Licencja" i „Co dostarczyłem ZAMIAST".

## 10. TWIERDZENIA NIEZWERYFIKOWANE
Sekcja NIEPUSTA. Wszystko, co napisałem, a czego nie zmierzyłem u siebie.

## 11. DO DECYZJI WŁAŚCICIELA
Każdy wiersz ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć
samodzielnie". Minimum: (a) 105 rekordów bez `project_id`/`owner_business_id`;
(b) czy tożsamość jądro↔zastane w Ocenach ma powstać i kto ją wypełni;
(c) co zrobić z 65 osieroconymi linkami artefaktów; (d) czy backfill aliasów
finansowych ma pójść na demo.

## 12. ZNALEZISKA POBOCZNE
Minimum: `pmoValidation.middleware.ts` (bramka bez `organization_id`),
`initiative.validators.ts:70` (`status .default('DRAFT')`), rozjazd dwóch
egzemplarzy słownika stanów, `server.env` z żywymi poświadczeniami SMTP,
`initiativeOwnerEligibility.swiezyProjekt.realdb.test.ts:59` (padał na schemacie
zrzutu stagingu — sprawdź, czy dalej pada).

## 13. Artefakty
Ścieżki poza repo + `shasum -a 256` każdego pliku.
```

**Definicja ukończenia `E9`:** wszystkie 14 sekcji obecne, sekcja 10 niepusta,
sekcja 11 niepusta, każda liczba z komendą.

---

## Próg odbioru

Nadzorca przyjmuje blok, gdy **wszystkie** poniższe są prawdziwe:

1. `E1`, `E2`, `E3`, `E8`, `E9` zrobione; `E4`–`E7` zrobione **albo** uczciwie
   opisane jako niezrobione z powodem.
2. **Karta rekordu kanonicznego ZAPISUJE** — test `E1` zielony, licznik żądań
   po odmowie = **1**, komunikat po polsku i po angielsku.
3. Test „nowy rekord widać wszędzie" pokazuje **co najmniej 6 z 7** powierzchni
   zielonych **po treści** przy fladze `ON`, a każda niezielona ma nazwane
   wyjaśnienie. **Zero `it.todo` w tym pliku.**
4. Przy obu flagach `OFF` **zero regresji**: pomiar `§0.4a` nie pokazuje ani
   jednej nazwy testu, która ZNIKNĘŁA.
5. **Co najmniej pięć dowodów mutacyjnych** w obie strony, z komendami i wynikami.
6. `git diff --name-only <MARKER>..HEAD` **nie zawiera ani jednego pliku**
   z listy „JAWNIE NIE ZAPISZE".
7. **Zero zmian wyglądu** — dowód:
   `git diff <MARKER>..HEAD -- src/ | grep -cE "^\+.*className|^-.*className"` → `0`
   (a jeżeli nie `0`, każda taka linia wyjaśniona imiennie w raporcie).
8. Każdy manifest istnieje, `--rollback` przywraca stan co do wiersza, a `md5`
   tabel zastanych przed i po jest identyczne.
9. **Żaden nowy test nie przybija stanu zastanego** (`Z43`) — sprawdzenie:
   `grep -rn "toEqual(\[\])" <nowe pliki testów>` z wyjaśnieniem każdego trafienia.
10. **Parytet i18n**: każdy nowy klucz jest w `pl` i `en`, z realnym
    tłumaczeniem, w tym samym commicie (`Z46`).
11. Raport ma wszystkie 14 sekcji, sekcje 10 i 11 niepuste.

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
   - **nie przybijaj stanu zastanego** — gdy nie wiesz, jak zapisać asercję,
     wybierasz `arrayContaining`, nie `toEqual` (`Z43`);
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie"**;
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF` (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`, nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **nie migruj** — gdy nie wiesz, jaką wartość wpisać w polu wymaganym przez
     kanon, rekord **odpada z migracji i idzie do manifestu**, nie dostaje
     wartości wymyślonej;
   - **nie połykaj po cichu** — gdy nie wiesz, co zrobić z błędem, **pokazujesz
     go człowiekowi** (`Z45`);
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE ETAPY.**
4. **Zatrzymanie CAŁEGO bloku** — wyłącznie z pięciu powodów z `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „STAN ZMIERZONY" jest SUKCESEM tego bloku, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

## AUDYT SPRZECZNOŚCI (wykonany przez autora przed wydaniem)

| Para wymagań, które mogłyby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| `Z34a` „push po pierwszym commicie" **kontra** „NIE pushuj" ze zlecenia | `§0.1`, akapit „ROZSTRZYGNIĘCIE `Z34a`" — push wyłączony, wiersz `Z34a` oznaczony jako wyłączony |
| „baza tego bloku na `origin/integracja/20260911`" **kontra** szkielet mówiący o `origin/staging` | Ramka markera + `§0.1` krok (1)(2) — `origin/staging` jest starszy i **nie ma napraw C1-FIX/C2-FIX**; start z niego jest błędem, nie alternatywą |
| `Z10` „zero nowych flag" **kontra** `E1` wymagający flagi | `Z10` wymienia wyjątek imiennie: `ENABLE_INITIATIVE_UNIFIED_WRITE`, default OFF |
| `Z40` „nie kasujesz danych" **kontra** tryby `--rollback` w `E1c`/`E5`/`E6` | `E1c` + tabela trybów: rollback kasuje **wyłącznie rekordy wypisane w manifeście**, nigdy wiersze zastane |
| `Z41` „nazwa bazy parametrem" **kontra** `Z25` „jawny `DATABASE_URL` na Twój kontener" | `Z41` dotyczy **skryptów danych** (mają przyjmować nazwę z zewnątrz), `Z25` dotyczy **uruchomień testów** (mają wskazywać Twój port). Bezpieczeństwo w obu przypadkach daje czarna lista hostów + `--oczekiwany-host`, nie przybita nazwa |
| `Z42` „manifest tylko przy apply" **kontra** `E5`/`E6` „inwentarz w trybie suchym" | `Z42` — tryb suchy **liczy i wypisuje na ekran**; na dysk pisze wyłącznie przy `--zapisz-manifest`. Inwentarz bez danych osobowych (same liczby) wolno zapisać zawsze |
| `Z43` „test nie przybija stanu zastanego" **kontra** `Z35` „zakaz `.todo`" | `Z43` dopuszcza `it.todo` **wyłącznie** dla powierzchni jeszcze niepodłączonej i **wyłącznie poza `E8`**; `Z35` zakazuje `.todo` jako sposobu wyciszania testu, który mógłby przejść. `E8` wymaga 7/7 bez `it.todo` |
| `Z13` „jeden plik raportu" **kontra** manifesty trzech skryptów | `Z13` + `E9` sekcja 7 — manifesty leżą **poza repo**, w raporcie są ścieżki i sumy kontrolne |
| `Z18` „nie ruszasz konfiguracji testów" **kontra** potrzeba `DB_TYPE=postgres` | `§0.2c` + `§0.2d` pkt 5 — obejście zmiennymi w linii komendy, plik nietknięty |
| `Z9` „żadnej bazy poza własnym kontenerem" **kontra** `§0.2c (A2)` czytające `consultify_staging_1009` | `Z9` — z tamtej bazy wolno **wyłącznie `pg_dump` i `SELECT`**, na `127.0.0.1`; zapis idzie tylko do `cx-codex2-pg`. To nie jest połączenie zdalne, więc `Z28` nie jest naruszone |
| „front tylko przepięcie wołaczy" **kontra** pliki frontu zamrożone w trzech modułach + `WSPOLNE` | tabela licencji + `§0.6` cztery znaczniki + warunek „jeżeli zmieniłoby ekran — STOP" |
| `Z30` „zero wysyłki" **kontra** komendy kanoniczne tworzące zdarzenia w outboxie | `§0.2b` pkt 3 — dodatkowy dowód `ie_outbox_delivery_receipts` = 0 po każdym etapie zapisującym |
| `E1` „karta ma zapisywać" **kontra** `Z11` „nie odsłaniasz nowego ekranu" | `E1` nie dodaje ani jednej kontrolki — zmienia wyłącznie to, dokąd leci istniejący zapis, i dokłada komunikat w istniejącym miejscu statusu zapisu |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wypisane i rozstrzygnięte w treści | **TAK** (tabela wyżej, 13 par) |
| 2 | Weryfikacja każdej ścieżki pliku na markerze; nieistniejące oznaczone jako `NOWY PLIK` | **TAK** — wszystkie ścieżki sprawdzone na worktree z linii `origin/integracja/20260911` (`19440011e9`); pliki `assessmentUnifiedReader.ts`, `pokryj-aliasy-finansowe.ts`, `zwiaz-tozsamosc-artefaktow.ts`, `98_RAPORT.md`, nowe testy i migracje oznaczone jako **NOWE** |
| 3 | Każda liczba ma komendę, uruchomioną przez autora na markerze i na kopii bazy | **TAK** — tabela mianowników, 19 wierszy |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | **TAK** — w każdym wierszu jest rzeczownik-produkt |
| 5 | Wykonalność per etap bez plików przekrojowych, udowodniona komendą | **TAK** — kolumna w tabeli etapów, wszystkie `NIE` |
| 6 | Zasoby wyłączne sprawdzone wobec stanowisk równoległych | **TAK** — porty `6452`/`5592` wolne, kontener `cx-codex2-pg` nie istnieje, przedział migracji `20262140`–`20262149` pusty (najwyższy zajęty: `20262107`), gałąź i worktree nie istnieją, flaga `ENABLE_INITIATIVE_UNIFIED_WRITE` = 0 trafień. **Cudze zasoby wymienione imiennie: `cx-codex1-inicjatywy-pg`/`6451`, `consultify-pg18`/`54418`** |
| 7 | Komendy paste-ready, pełne ścieżki, komplet env w jednej linii, `--retry=0` | **TAK** |
| 8 | Pułapki środowiska wklejone w całości + pułapki własne modułu | **TAK** — 18 ogólnych + 7 własnych (`§0.2d` pkt 19–25) |
| 9 | Samodzielność dokumentu — zero odwołań do rozmów, każdy kontekst ze ścieżką w repo | **TAK** — dług wejściowy wskazany dwiema ścieżkami odbiorów w repo |
| 10 | Klauzula sprzeczności pełna, `§0.5` z tabelą „STOP proceduralny zakazany" | **TAK**. `grep -c 'MARKER_SHA' 01_INSTRUKCJA.md` → **4** — to jedyne pola szablonu, które zostały; SHA markera wpisuje CTO przed wydaniem |
| 11 | Znaczniki odmrożenia policzone wobec AKTUALNEGO rejestru zamrożeń | **TAK** — **cztery** (`05_INITIATIVES`, `06_EXECUTION`, `04_ASSESSMENT`, `WSPOLNE`); `WSPOLNE` doszło 10.09 i **nie było w instrukcji CODEX1** |
| 12 | Dług wejściowy z odbiorów rozliczony imiennie | **TAK** — `FIX-9` → `E1`; `FIX-E3-1…6` → `E1c`; `FIX-E5-1…4` → `E8`; `FIX-6`/`FIX-1`/`FIX-5` → `E3`; `FIX-2` → `E4`; siódmy pisarz → `E7` |

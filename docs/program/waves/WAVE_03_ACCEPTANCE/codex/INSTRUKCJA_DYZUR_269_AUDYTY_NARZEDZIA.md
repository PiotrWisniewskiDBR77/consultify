# INSTRUKCJA DYŻURU nr 269 — Codex — „★★ KOMPLET ZRZUTÓW AUDYTÓW I NARZĘDZI POD WERDYKT WŁAŚCICIELA — z otwartym podglądem, i z żywym testem na kształt atrapy `KSZTALT_21` na WŁASNYM, już raz naprawionym przykładzie. `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` (1.09) opisuje dokładnie kolumnę „Postęp” w zakładce Sesje Audytów: serwer zwraca `criteriaTotal`/`criteriaConcluded`/`findingsOpen`, ekran czyta `row.concludedCriteria`/`row.applicableCriteria`/`row.openFindings` — żadna z tych nazw nie istnieje w odpowiedzi, więc React renderuje `undefined` jako nic i kolumna pokazuje literalny ukośnik. Właściciel ten ekran oglądał DWUKROTNIE i przyjął, bo starsza atrapa w `dev-render/screens/audyty-piec-powierzchni.tsx` miała TE SAME błędne nazwy pól co front — `NAPRAWA (2026-09-01, ROZJAZD_NAZW_POL)` w tym samym pliku pokazuje, że atrapa została już skorygowana do kształtu serwera. Ten dyżur musi to zmierzyć na żywo: zrzut z DZISIEJSZEGO harnessu powinien pokazać ten sam „/”, co produkcja — jeśli pokaże wiarygodne liczby, atrapa się cofnęła i to jest odkrycie blokujące cały komplet."

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
> **wyłącznie** `/private/tmp/cx-day269-audyty-narzedzia-zrzuty`.

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
Zakres: ****DWA MODUŁY W JEDNYM DYŻURZE: AUDYTY (`AuditsMethodHub.tsx`, route `/audit-programs`) i NARZĘDZIA (`DiscoveryToolsHub.tsx`, route `/discovery-tools`).** Bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we wszystkich 16 kartach modułów (pomiar 1.09). Ten dyżur produkuje MATERIAŁ DO WERDYKTU dla obu modułów naraz — jasny/ciemny, stan pusty/pełny, menu, kebab, **podgląd otwarty PO kliknięciu w wiersz**. Audyty mają ŻYWY, NIENAPRAWIONY defekt kolumny „Postęp” (literalny „/”) — fotografuj go uczciwie, to jest dokładnie przypadek `KSZTALT_21` z odwrotnym znakiem: atrapa TEGO KONKRETNEGO ekranu została już 1.09 naprawiona do kształtu serwera, więc poprawny zrzut MUSI pokazać ten sam „/”, jaki widać w produkcji — jeśli zrzut pokaże wiarygodne liczby, to ZNACZY, że atrapa się cofnęła do kształtu frontu. Zero naprawiania.**.
Trasy front: `AUDYTY: `src/components/Audit/AuditsHub.tsx` → `AuditsMethodHub.tsx` (route `/audit-programs`, 6 zakładek: `library`/`processes`/`outputs`/`reports`/`findings`/`initiatives` — `AuditLibraryTab.tsx`, `AuditProcessesTab.tsx`, `AuditOutputsTab.tsx`, `AuditReportsTab.tsx`, `AuditFindingsTab.tsx`, `AuditInitiativesTab.tsx`, wszystkie w `src/components/Audit/method/tabs/`) · harness ISTNIEJE: `dev-render/screens/audyty-piec-powierzchni.tsx` (klucz `audyty-piec-powierzchni`, montuje REALNY `<AuditsMethodHub>`) — **etykieta w `dev-render/main.tsx` wymienia `&tab=library|processes|outputs|reports|initiatives` — BEZ `findings` — `R1` MUSI mechanicznie sprawdzić, czy szósta zakładka w ogóle da się otworzyć tym harnessem, nie zakładać z etykiety**. NARZĘDZIA: `src/components/Discovery/DiscoveryToolsHub.tsx` (route `/discovery-tools`, 5 zakładek: `library`/`sessions`/`outputs`/`reports`/`initiatives`) · podgląd przez `TableWithPreviewLayout`+`PreviewDetailsSection` z `src/components/shared/PreviewPane/` — **NIE `StandardPreview.tsx` bezpośrednio** — sprawdź pozycjonowanie TEGO komponentu osobno (`R1`, `TableWithPreviewLayout.tsx:479,518` ma `fixed inset-0` w gałęzi mobile, desktop domyślnie `contents` przy `desktopPreviewOverlay=false` bez nadpisania w `DiscoveryToolsHub.tsx`) · harness istnieje TYLKO dla 2 z 5 zakładek: `dev-render/screens/tools-sesja-wyjscie.tsx` (`initialTab="sessions"`), `dev-render/screens/tools-outputs-insights-tab.tsx` (`initialTab="outputs"`), `dev-render/screens/tools-swot-session-workspace.tsx` (`initialTab="sessions"`) — **`library`/`reports`/`initiatives` (3 z 5) NIE MAJĄ żadnego istniejącego harnessu**`. Trasy tył: `brak w zakresie zapisu — dyżur nie zmienia backendu; do zasilenia ekranów danymi używasz istniejących atrap dev-render (odczyt, ewentualna rozbudowa wg `R2`/`R4`), nigdy nowego endpointu`.

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
WT=/private/tmp/cx-day269-audyty-narzedzia-zrzuty
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
git -C "$VAULT" worktree add "$WT" -b codex/day269-audyty-narzedzia-zrzuty-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day269-audyty-narzedzia-zrzuty/config.worktree"
cat "$VAULT/worktrees/cx-day269-audyty-narzedzia-zrzuty/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day269-audyty-narzedzia-zrzuty-scratch
mkdir -p /private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty

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
git -C "$WT" push github-backup codex/day269-audyty-narzedzia-zrzuty-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: AuditsMethodHub ma dokladnie 6 zakladek
grep -n "AuditLibraryTab\|AuditProcessesTab\|AuditOutputsTab\|AuditReportsTab\|AuditFindingsTab\|AuditInitiativesTab" src/components/Audit/AuditsMethodHub.tsx | head -10
#   oczekiwane: 6 komponentow-zakladek obecne

# (2) TEZA: defekt kolumny Postep jest ZYWY i NIENAPRAWIONY w kodzie produkcyjnym
sed -n '245,252p' src/components/Audit/method/tabs/AuditProcessesTab.tsx
#   oczekiwane: odczyt row.concludedCriteria/applicableCriteria/openFindings — nazwy NIE pasujace do odpowiedzi serwera

# (3) TEZA: atrapa w dev-render/screens/audyty-piec-powierzchni.tsx zostala JUZ naprawiona 1.09 do ksztaltu serwera
grep -n "NAPRAWA (2026-09-01\|criteriaTotal: applicableCriteria" dev-render/screens/audyty-piec-powierzchni.tsx
#   oczekiwane: komentarz naprawy obecny, mapowanie na ksztalt serwera potwierdzone

# (4) TEZA: etykieta harnessu audyty-piec-powierzchni NIE wymienia zakladki findings wsrod obslugiwanych
grep -n "'audyty-piec-powierzchni'" -A3 dev-render/main.tsx
#   oczekiwane: etykieta z &tab=library|processes|outputs|reports|initiatives — bez findings

# (5) TEZA: mock w audyty-piec-powierzchni.tsx MIMO TO przechwytuje trasy /audits/findings/*
grep -n "/audits/findings" dev-render/screens/audyty-piec-powierzchni.tsx
#   oczekiwane: co najmniej jedno trafienie — sprzecznosc z etykieta, do rozstrzygniecia mechanicznie w R1

# (6) TEZA: DiscoveryToolsHub ma dokladnie 5 zakladek
grep -n "id: 'library' as ModuleTab\|id: 'sessions' as ModuleTab\|id: 'outputs' as ModuleTab\|id: 'reports' as ModuleTab\|id: 'initiatives' as ModuleTab" src/components/Discovery/DiscoveryToolsHub.tsx
#   oczekiwane: 5 trafien

# (7) TEZA: DiscoveryToolsHub NIE uzywa StandardPreview.tsx, tylko TableWithPreviewLayout/PreviewDetailsSection
grep -n "StandardPreview\|TableWithPreviewLayout\|PreviewDetailsSection" src/components/Discovery/DiscoveryToolsHub.tsx
#   oczekiwane: zero StandardPreview, obecne TableWithPreviewLayout i PreviewDetailsSection

# (8) TEZA: TableWithPreviewLayout ma nakladke TYLKO w galezi mobile (fixed inset-0), desktop domyslnie panel boczny
grep -n "desktopPreviewOverlay = false\|fixed inset-0" src/components/shared/TableWithPreviewLayout.tsx
#   oczekiwane: default false obecny + co najmniej dwa wystapienia fixed inset-0 w galezi mobile

# (9) TEZA: tylko 2 z 5 zakladek Narzedzi maja dzis jakikolwiek harness (sessions, outputs) — library/reports/initiatives NIE MAJA
grep -rn "initialTab=\"library\"\|initialTab=\"reports\"\|initialTab=\"initiatives\"" dev-render/screens/*.tsx | grep -i discoverytools
grep -rln "DiscoveryToolsHub" dev-render/screens/*.tsx
#   oczekiwane: pierwszy grep — zero trafien (potwierdza luke); drugi — 3 pliki, wszystkie z initialTab sessions/outputs

# (10) TEZA: miejsce na dysku wystarcza
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day269-audyty-narzedzia-zrzuty-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6278`. Twój JEDYNY port harnessu to `5258 i 5259`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day269-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6269, 5010-5249, 6404-6411, 6600-6830. Twoje własne: baza 6278, harness 5258 i 5259. Cudze — siostrzane dyżury TEJ SAMEJ paczki (komplety zrzutów pod werdykt), nie dotykasz: baza 6270 harness 5250-5251 (dyżur 265 Finanse), baza 6272 harness 5252-5253 (dyżur 266 Wyniki), baza 6274 harness 5254-5255 (dyżur 267 Materiały), baza 6276 harness 5256-5257 (dyżur 268 Czat+Moja Praca). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `ENABLE_AUDITS_WORKSHOP` zostaje OFF — Warsztat D-5 fotografujesz WYŁĄCZNIE przez istniejący dev-render prototyp, nigdy przez włączenie flagi w produkcie. `Z10` obowiązuje bez wyjątku.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY269_AUDYTY_NARZEDZIA_ZRZUTY_REPORT.md`. Brak innych dokumentów do modyfikacji. Jedyny plik zapisu w repo to raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY269_AUDYTY_NARZEDZIA_ZRZUTY_REPORT.md` plus (jeśli `R1`/`R3` potwierdzą potrzebę) rozszerzenie ISTNIEJĄCEGO `dev-render/screens/audyty-piec-powierzchni.tsx` o `tab=findings` i nowy plik `dev-render/screens/day269-narzedzia-brakujace-zakladki.tsx` dla `library`/`reports`/`initiatives`, plus dwa nowe skrypty `scripts/dev/day269-audyty-zrzuty-werdykt.mjs` / `scripts/dev/day269-narzedzia-zrzuty-werdykt.mjs` — zero nowych dokumentów rejestrowych. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day269-audyty-narzedzia-zrzuty-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK** — literalny „/”, brak harnessu dla `findings`/`library`/`reports`/`initiatives`: opisujesz, nie łatasz. **ZAKAZ mylenia prototypu Warsztatu D-5 z produktem** — jeśli fotografujesz, jawna adnotacja PROTOTYP. **ZAKAZ włączania `ENABLE_AUDITS_WORKSHOP`.** **ZAKAZ fotografowania Assessment** (`TOOLS_ASSESSMENT`/`AppView.ASSESSMENT_OVERVIEW`) pod pretekstem, że dzieli komponent z Narzędziami — to osobny moduł menu, poza zakresem. **ZAKAZ fotografowania spoza tych dwóch modułów.** | Zmierzone 1.09: bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we WSZYSTKICH 16 kartach modułów. Ten dyżur (jeden z pięciu — 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+Moja Praca, 269 Audyty+Narzędzia) produkuje materiał do werdyktu. Audyty mają NAJOSTRZEJSZY dziś znany przypadek fałszywej wiarygodności zrzutu w całym programie (`KSZTALT_21`) — właściciel oglądał zepsuty ekran dwukrotnie i przyjął go, bo atrapa dowodowa miała ten sam błąd co produkt. Atrapa została naprawiona 1.09, ale NIKT jeszcze nie zrobił zrzutu NOWĄ, poprawioną atrapą, żeby potwierdzić, że dowód od teraz jest uczciwy. To jest dokładnie praca tego dyżuru. |

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
cd /private/tmp/cx-day269-audyty-narzedzia-zrzuty

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day269-pg psql -U postgres -d cx269 \
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
cd /private/tmp/cx-day269-audyty-narzedzia-zrzuty

docker run -d --name cx-day269-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx269 \
  -p 127.0.0.1:6278:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day269-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6278/cx269 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6278/cx269 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day269-audyty-narzedzia-zrzuty && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6278/cx269 \
JWT_SECRET=cx269-test-secret-do-not-reuse \
npx vitest run scripts/dev/__tests__/day269-audyty-narzedzia-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty/day269-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day269-audyty-narzedzia-zrzuty && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/day269-audyty-narzedzia-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty/day269-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day269-audyty-narzedzia-zrzuty/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day269-pg psql -U postgres -d cx269 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day269-pg`.
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
> **(e) ★★ KOLUMNA „POSTĘP” W ZAKŁADCE SESJE MUSI POKAZAĆ LITERALNY „/” NA TWOIM ZRZUCIE — jeśli pokazuje wiarygodną liczbę typu `1/1` albo `12/42`, to jest SYGNAŁ, że atrapa cofnęła się do kształtu frontu (albo Twój harness woła inną wersję pliku niż ta z naprawą 1.09) — **to jest blokujące dla całego kompletu, zgłoś PRZED kontynuowaniem R3**, nie chowaj tego w jednym wierszu tabeli. Defekt PRODUKCYJNY (`AuditProcessesTab.tsx:249` czyta `row.concludedCriteria`/`row.applicableCriteria`/`row.openFindings`, serwer zwraca `criteriaTotal`/`criteriaConcluded`/`findingsOpen`) NIE JEST naprawiony i **nie wolno Ci go naprawić** (`Z16`/zakaz naprawiania) — fotografujesz go uczciwie, z adnotacją `AUD-OR-20260829-005`. **Druga pułapka — Narzędzia NIE używają `StandardPreview.tsx`, tylko `TableWithPreviewLayout`+`PreviewDetailsSection`** (inny plik z tej samej rodziny, `ZNALEZISKO_PODGLAD` §e ostrzega dokładnie przed tym: „zanim napiszesz że ekran X ma podgląd boczny, sprawdź KTÓRY komponent renderuje ten ekran”) — na desktopie to panel boczny (domyślnie), na MOBILE to nakładka (`fixed inset-0`, linie 479/518) — jeśli fotografujesz warianty mobilne, potrzebujesz CZTERECH zrzutów tam, nie dwóch. **Trzecia pułapka — Warsztat D-5 Audytów (`dev-render/screens/day221-audyty-warsztat.tsx`) jest PROTOTYPEM, nie ekranem produkcyjnym** (flaga `ENABLE_AUDITS_WORKSHOP` OFF, zero wołaczy, nie zamontowany pod `/audit-programs`) — jeśli go fotografujesz, oznacz jawnie „PROTOTYP, nie w produkcie” i NIE wliczaj do inwentarza sześciu zakładek huba.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day269-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day269-audyty-narzedzia-zrzuty-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (inwentarz Audytów: 6 zakładek + mechaniczna weryfikacja czy harness obsługuje `findings` + potwierdzenie kształtu atrapy po naprawie 1.09) · R2 (wykonanie zrzutów Audytów z uczciwym „/” + Warsztat D-5 jako oznaczony prototyp) · R3 (inwentarz Narzędzi: 5 zakładek + klasyfikacja `TableWithPreviewLayout` panel/nakładka + potwierdzenie braku harnessu dla 3 z 5 zakładek) · R4 (harness brakujących zakładek + wykonanie zrzutów Narzędzi) · R5 (raport wspólny + katalog zrzutów + dwie tabele + lista niefotografowalnych)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6278` albo `5258 i 5259` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6278` albo `5258 i 5259`** (`Z7`).

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

Zmierzone 1.09: bramka „moduł zaakceptowany i zaczekpointowany” ma status
**NIEROZPOCZĘTY we wszystkich 16 kartach modułów**. Ten dyżur (jeden z pięciu
— 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+Moja Praca, 269 Audyty+
Narzędzia) produkuje **MATERIAŁ DO WERDYKTU** dla DWÓCH modułów naraz: Audyty
i Narzędzia. **Nic więcej. Zero naprawiania.**

**Reguła nienaruszalna** (`CLAUDE.md` p.7): właściciel NIGDY nie jest
pierwszym testerem wizualnym.

## Audyty — najostrzejszy dziś znany przypadek fałszywej wiarygodności zrzutu

`docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` (1.09) opisuje
ekran Audytów, zakładka „Sesje”: w realnym produkcie kolumna „Postęp” pokazuje
**literalny ukośnik** na każdym wierszu. Trasa `GET /api/audits/programs`
zwraca `criteriaTotal`/`criteriaConcluded`/`findingsOpen`
(`programService.ts`). Ekran czyta (`AuditProcessesTab.tsx:249`)
`row.concludedCriteria`/`row.applicableCriteria`/`row.openFindings` —
**żadna z tych trzech nazw nie istnieje w odpowiedzi**. React renderuje
`undefined` jako nic → kolumna „Postęp” pokazuje „/”, „Ustalenia otwarte” jest
pusta. Rejestr: `AUD-OR-20260829-005`, **status `OPEN` — nienaprawiony**.

**Właściciel ten ekran oglądał DWUKROTNIE i przyjął** — bo atrapa dowodowa w
`dev-render/screens/audyty-piec-powierzchni.tsx` miała **te same błędne
nazwy pól co front**, więc zrzut pokazywał wiarygodne liczby (`0/42`,
`12/42`, `27/27`) zamiast prawdziwego „/”. Zrzut nie był pusty — zrzut był
**przekonujący**, co jest gorsze niż brak dowodu.

**Naprawa atrapy już zaszła** — komentarz `NAPRAWA (2026-09-01,
ROZJAZD_NAZW_POL)` w tym samym pliku pokazuje, że mock teraz serializuje w
kształcie SERWERA (`criteriaTotal`/`criteriaConcluded`/`findingsOpen`), a
`listPrograms()` po stronie klienta mapuje z powrotem — dokładnie jak
produkcja. **Nikt jeszcze nie zrobił zrzutu tym poprawionym harnessem, żeby
potwierdzić, że dowód od teraz jest uczciwy — to jest praca tego dyżuru.**

> ★★ **Twój zrzut zakładki Sesje MUSI pokazać ten sam literalny „/”, co
> produkcja.** Jeśli pokazuje wiarygodną liczbę — to jest sygnał, że atrapa
> się cofnęła (albo Twój harness woła inną wersję pliku) i jest to
> **blokujące dla całego kompletu**, zgłoś to PRZED kontynuowaniem, nie
> chowaj w jednym wierszu tabeli.

**Nie naprawiasz defektu produkcyjnego** — fotografujesz go uczciwie, z
adnotacją `AUD-OR-20260829-005`.

## Audyty — druga, nieoczywista luka: czy zakładka „Ustalenia” w ogóle się otwiera w harnessie

Etykieta klucza `audyty-piec-powierzchni` w `dev-render/main.tsx` wymienia
`&tab=library|processes|outputs|reports|initiatives` — **bez `findings`**
(szósta zakładka, „Ustalenia”). Ale sam mock w tym samym pliku **przechwytuje
trasy `/audits/findings/statistics`, `/audits/findings/systemic`,
`/audits/findings`** — sprzeczność między dokumentacją etykiety a
implementacją. `R1` ma to rozstrzygnąć MECHANICZNIE (otworzyć `tab=findings`
i sprawdzić, czy hub faktycznie renderuje szóstą zakładkę), nie na podstawie
samej etykiety.

## Audyty — Warsztat D-5 jest prototypem, NIE ekranem produkcyjnym

`dev-render/screens/day221-audyty-warsztat.tsx` istnieje i jest gotowy do
akceptu wizualnego, ale **NIE jest zamontowany pod `/audit-programs`**, flaga
`ENABLE_AUDITS_WORKSHOP` ma `default(false)` i **zero wołaczy produktowych**.
Jeśli go fotografujesz (opcjonalnie, dla kompletności materiału) — jawna
adnotacja **„PROTOTYP, nie w produkcie”**, nigdy nie wliczaj go do inwentarza
sześciu zakładek realnego huba.

## Narzędzia — podgląd NIE jest `StandardPreview.tsx`, tylko inny plik tej samej rodziny

`ZNALEZISKO_PODGLAD` ostrzega wprost: „zanim napiszesz, że ekran X ma
podgląd boczny, sprawdź KTÓRY komponent renderuje ten konkretny ekran, nie
zakładaj z nazwy modułu”. `DiscoveryToolsHub.tsx` **nie importuje
`StandardPreview`** — używa `TableWithPreviewLayout` + `PreviewDetailsSection`
z `src/components/shared/PreviewPane/`. Zmierzone:

- **Desktop**: `overlayMode = desktopPreviewOverlay && !isMobile`,
  `desktopPreviewOverlay` domyślnie `false`, `DiscoveryToolsHub.tsx` NIE
  nadpisuje tego propsa → domyślnie **panel boczny** (`'contents'`, inline
  flex sibling) — reguła „dwa zrzuty” ma zastosowanie.
- **Mobile**: gałąź `isMobile && isPreviewOpen` renderuje
  `className="fixed inset-0 z-[70]"` (`TableWithPreviewLayout.tsx:479,518`)
  — to jest **prawdziwa nakładka**. Jeśli fotografujesz warianty mobilne
  Narzędzi, potrzebujesz **czterech zrzutów**, nie dwóch.

## Narzędzia — 3 z 5 zakładek nie mają dziś ŻADNEGO harnessu

Trzy istniejące dev-render pliki montujące realny `<DiscoveryToolsHub>`
(`tools-sesja-wyjscie.tsx`, `tools-outputs-insights-tab.tsx`,
`tools-swot-session-workspace.tsx`) używają WYŁĄCZNIE `initialTab="sessions"`
albo `initialTab="outputs"` — **`library`, `reports`, `initiatives` (3 z 5
zakładek) nie mają dziś żadnego harnessu**. `R3`/`R4` mają to potwierdzić i
zbudować brakujące.

## Co ten dyżur świadomie NIE robi

- **Nie naprawia** kolumny „Postęp”, ani żadnego innego defektu.
- **Nie włącza** `ENABLE_AUDITS_WORKSHOP`.
- **Nie fotografuje Assessment** (`TOOLS_ASSESSMENT`) mimo że część kodu
  dzieli się z Narzędziami — to osobny moduł menu.
- **Nie fotografuje innych modułów** tej paczki.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `AuditsMethodHub` ma dokładnie 6 zakładek | komenda (1) |
| T2 | Defekt kolumny „Postęp” jest żywy i nienaprawiony w kodzie produkcyjnym | komenda (2) |
| T3 | Atrapa w `audyty-piec-powierzchni.tsx` została już naprawiona 1.09 do kształtu serwera | komenda (3) |
| T4 | Etykieta harnessu NIE wymienia zakładki `findings` wśród obsługiwanych | komenda (4) |
| T5 | Mock MIMO TO przechwytuje trasy `/audits/findings/*` — sprzeczność do rozstrzygnięcia | komenda (5) |
| T6 | `DiscoveryToolsHub` ma dokładnie 5 zakładek | komenda (6) |
| T7 | `DiscoveryToolsHub` NIE używa `StandardPreview.tsx`, tylko `TableWithPreviewLayout`/`PreviewDetailsSection` | komenda (7) |
| T8 | `TableWithPreviewLayout` ma nakładkę tylko w gałęzi mobile, desktop domyślnie panel boczny | komenda (8) |
| T9 | Tylko 2 z 5 zakładek Narzędzi mają dziś jakikolwiek harness | komenda (9) |
| T10 | Miejsce na dysku wystarcza | komenda (10) |

---

# 3. POZYCJE DYŻURU

## R1 — INWENTARZ AUDYTÓW + ROZSTRZYGNIĘCIE SPRZECZNOŚCI `findings` (rdzeń, pomiarowy)

1. Dla każdej z 6 zakładek: `plik:linia` komponentu, klasyfikacja kanon
   (wszystkie sześć per pomiar 1.09 to `StandardTable`+`StandardPreview`).
2. **Otwórz mechanicznie** `?screen=audyty-piec-powierzchni&tab=findings` w
   harnessie — zapisz WYNIK (renderuje się poprawnie / błąd / pusty ekran).
   Jeśli się renderuje mimo braku w etykiecie — popraw TYLKO etykietę (opis,
   nie logikę) w ramach `R2`, licencja pozwala na to jako część `J`.
3. Potwierdź kształt atrapy `/audits/programs` (komenda 3) i porównaj z
   realnym kontraktem serwera (`programService.ts` — zlokalizuj dokładne
   `plik:linia`).
4. Zbuduj tabelę **zakładka × harness działa (tak/nie) × kształt atrapy
   zgodny z serwerem (tak/nie) × podgląd w kadrze**.

## R2 — WYKONANIE ZRZUTÓW AUDYTÓW (rdzeń, dowodowy)

1. Klik→zrzut dla wszystkich 6 zakładek (albo 5, jeśli `R1.2` potwierdzi, że
   `findings` jest dziś nieosiągalna tym harnessem — wtedy wchodzi do listy
   niefotografowalnych z dokładnym powodem, nie pomijasz jej milczeniem).
2. **Zakładka Sesje — zrzut MUSI pokazać literalny „/” w kolumnie „Postęp”.**
   Jeśli nie pokazuje — STOP, zgłoś w raporcie jako ustalenie blokujące,
   zanim przejdziesz dalej (patrz sekcja 1 wyżej).
3. Stan pusty i pełny, jasny/ciemny, dwa selektory wyniku dla operacji
   asynchronicznych, `checkScreenshotPairState` z wymogiem obecności wyniku.
4. Warsztat D-5 (opcjonalnie): zrzut z jawną adnotacją „PROTOTYP, nie w
   produkcie” — osobna sekcja w tabeli `R5`, nie zmieszana z sześcioma
   zakładkami produkcyjnymi.
5. Dowód realności: mutacja widocznego elementu w jednej z sześciu zakładek
   (na kopii), zrzut, cofnięcie.
6. Zapisz do `/private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty` z `shasum -a 256`.

## R3 — INWENTARZ NARZĘDZI + KLASYFIKACJA PODGLĄDU (rdzeń, pomiarowy)

1. Dla każdej z 5 zakładek: `plik:linia`, potwierdzenie że renderuje
   `TableWithPreviewLayout` (nie `StandardPreview` bezpośrednio).
2. Potwierdź komendą (8) klasyfikację panel-boczny (desktop) / nakładka
   (mobile) — to jest POZYTYWNA KONTROLA (przykład realnej nakładki w
   produkcie), zachowaj `plik:linia` do raportu jako precedens dla innych
   dyżurów listowych.
3. Potwierdź komendą (9), że `library`/`reports`/`initiatives` nie mają
   dziś żadnego harnessu.
4. Zbuduj tabelę **zakładka × harness istnieje (tak/nie) × panel/nakładka
   (desktop/mobile) × podgląd w kadrze**.

## R4 — HARNESS BRAKUJĄCYCH ZAKŁADEK + WYKONANIE ZRZUTÓW NARZĘDZI (rdzeń, dowodowy)

1. Napisz `dev-render/screens/day269-narzedzia-brakujace-zakladki.tsx`
   montujący REALNY `<DiscoveryToolsHub>` z `&tab=library|reports|initiatives`
   (rozszerzenie wzorca `tools-outputs-insights-tab.tsx`), `&state=ready|empty|loading|error`.
   Zarejestruj go w `dev-render/main.tsx` — **wyłącznie DOPISANIEM** jednego
   lazy importu i jednego wpisu klucza na końcu listy. Jeśli `R1.2`
   dodatkowo wymaga poprawki etykiety klucza `audyty-piec-powierzchni`
   (dopisanie `findings` do opisu `&tab=`) — to jest DRUGA, osobna zmiana w
   TYM SAMYM pliku, też wyłącznie tekstowa, zero ruszania cudzych wpisów.
   **Po KAŻDEJ z tych zmian uruchom `scripts/dev/check-devrender-main.sh` i
   wklej pełny wynik do raportu** — zielony wynik jest warunkiem przejścia
   dalej.
2. **Kontrola kształtu atrapy** (`KSZTALT_21`) dla nowego harnessu — porównaj
   pola z realnym kontraktem backendu tras Discovery Tools.
3. Klik→zrzut dla wszystkich 5 zakładek (2 istniejące + 3 nowe) — dwa zrzuty
   standardowo na desktopie; jeśli fotografujesz wariant mobilny — cztery
   (potwierdzone `R3.2` jako nakładka).
4. Stan pusty/pełny, jasny/ciemny, każda zakładka osobno, dwa selektory
   wyniku dla sesji asynchronicznych (np. SWOT live).
5. Dowód realności: mutacja + cofnięcie na jednej zakładce.
6. Zapisz do `/private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty` z `shasum -a 256`.

## R5 — RAPORT WSPÓLNY + KATALOG ZRZUTÓW + DWIE TABELE (rdzeń)

Jeden raport, dwie sekcje (Audyty / Narzędzia). Audyty: tabela zakładka/stan/
jasność×2/opis/podgląd-w-kadrze/kształt-atrapy-zgodny, z osobnym wierszem dla
Warsztatu D-5 oznaczonym PROTOTYP. Narzędzia: tabela zakładka/stan/jasność×2/
opis/podgląd-w-kadrze/panel-czy-nakładka. Lista niefotografowalnych z
powodem (w tym ewentualnie `findings`, jeśli `R1.2` da wynik negatywny).
„Twierdzenia niezweryfikowane” (obowiązkowa nawet pusta), „Korekty wobec
instrukcji” (obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO) | `dev-render/screens/audyty-piec-powierzchni.tsx` — WYŁĄCZNIE aktualizacja etykiety opisu (`&tab=`), zero zmiany logiki mocka poza tym, co `R1.2` uzna za konieczne do udostępnienia `tab=findings`, jeśli już działa i tylko brakuje wzmianki |
| Zapis (NOWE) | `dev-render/screens/day269-narzedzia-brakujace-zakladki.tsx` (nowy) · `scripts/dev/day269-audyty-zrzuty-werdykt.mjs` (nowy) · `scripts/dev/day269-narzedzia-zrzuty-werdykt.mjs` (nowy) · `scripts/dev/__tests__/day269-audyty-narzedzia-zrzuty-werdykt.test.mjs` (nowy) |
| Zapis (WĄSKO) | `dev-render/main.tsx` — WYŁĄCZNIE dopisanie jednego lazy importu + jednego wpisu klucza na końcu listy, zero zmiany/usunięcia istniejących wpisów; `scripts/dev/check-devrender-main.sh` obowiązkowy po zmianie |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY269_AUDYTY_NARZEDZIA_ZRZUTY_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/Audit/**` · `src/components/Discovery/DiscoveryToolsHub.tsx` · `src/components/shared/TableWithPreviewLayout.tsx` · `src/components/shared/PreviewPane/**` · `src/components/standard/StandardPreview.tsx` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` · `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` · `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` · `docs/program/funkcje/ZNALEZISKO_POSTEP_SESJI_AUDYTOW.md` · `docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md` · `scripts/dev/lib/checkScreenshotPairState.mjs` · `scripts/dev/lib/meanLuma.mjs` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/03_TOOLS/MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK** — w tym kolumny „Postęp”.
- ★★ **ZRZUT ZAKŁADKI SESJE MUSI POKAZAĆ LITERALNY „/”** — jeśli pokazuje
  wiarygodną liczbę, to jest ustalenie BLOKUJĄCE, zgłoś przed kontynuacją.
- ★★ **NIE MYL WARSZTATU D-5 Z PRODUKTEM** — jawna adnotacja PROTOTYP, jeśli
  w ogóle fotografujesz.
- ★★ **NARZĘDZIA NIE UŻYWAJĄ `StandardPreview.tsx`** — sprawdź KONKRETNY
  komponent (`TableWithPreviewLayout`), nie zakładaj z nazwy modułu.
- ★★ **MOBILE NARZĘDZI TO NAKŁADKA — CZTERY ZRZUTY, NIE DWA**, jeśli
  fotografujesz ten wariant.
- ★★ **PARA JASNY/CIEMNY MUSI POKAZYWAĆ TEN SAM STAN** (`KSZTALT_19`).
- ★★ **ATRAPA MA MIEĆ KSZTAŁT SERWERA, NIE FRONTU** (`KSZTALT_21`) — dla
  Narzędzi to nowy test do wykonania; dla Audytów to już potwierdzona
  naprawa do zweryfikowania.
- ★ **ROZSTRZYGNIJ SPRZECZNOŚĆ `findings` MECHANICZNIE**, nie z etykiety.
- ★ **KAŻDA ZAKŁADKA OSOBNO, OBA MODUŁY.**
- ★ **DOWÓD REALNOŚCI OBOWIĄZKOWY DLA OBU MODUŁÓW.**
- ★ **`scripts/dev/check-devrender-main.sh` OBOWIĄZKOWY PO KAŻDEJ ZMIANIE
  `dev-render/main.tsx`.**
- ★ **`Z13`:** zrzuty i logi w `/private/tmp/cx-day269-audyty-narzedzia-zrzuty-artefakty`, nie w repo.
- ★ **PUSZ WYŁĄCZNIE NA `github-backup`.**
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” OBOWIĄZKOWA.**

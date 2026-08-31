# INSTRUKCJA DYŻURU nr 186 — Codex — „Materiały GEN-4 — trasa szablonowa PPT dostaje ogniwo AI: brief trafia do mappera, slajdy przestają być „Key point 2”/„Signal:…”"

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
> **wyłącznie** `/private/tmp/cx-day186-gen4-tresc`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `18661cc6a0`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-30.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **11_MATERIALS — GEN-4 (szablony prezentacji PPT), trasa `POST /presentations/decks/from-template`**.
Trasy front: ``src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx:451-475` (efekt auto-triggera, woła `Api.post('/presentations/decks/from-template', { templateArtifactId })` BEZ pola brief) — dotykasz WYŁĄCZNIE jeśli decydujesz się domknąć ogniwo od strony frontu (patrz R2 i pułapka o `templatePrompt`); kontekst do odczytu: `templatePrompt` z `useSearchParams()` (linia 154) — istniejący, działający mechanizm brief-w-URL używany przez TĘ SAMĄ ścieżkę nie-szablonową w TYM SAMYM pliku (linie 231-236, `startRef.current(templatePrompt)`), ale NIGDY nie przekazywany do wywołania `from-template`; `src/services/chatActionHandler.ts:312-330` (`USE_TEMPLATE`) i `src/components/ReportsAndPresentations/artifactNavigation.ts:70-107` (`resolveTemplateUsePath`) — WSZYSTKIE wejścia do `/prezentacje?templateArtifactId=...` w repo, żadne nie ustawia `templatePrompt` — czytaj, nie zakładaj z góry że musisz je zmieniać, uzasadnij decyzję w raporcie`. Trasy tył: ``POST /presentations/decks/from-template` (`server/src/routes/presentations.routes.ts:2283-2318`) → `resolvePresentationTemplateForCreation` (rewalidacja) → `mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint)` (`:2318`, WOŁANA BEZ drugiego argumentu `brief`) → `presentationTemplateRuntimeService.ts` `mapOutlineBlueprintToDeckSlides` (`:1008-1030`, przyjmuje opcjonalny `brief?: string` — `:1010`) → `briefLinesForOutlineItem` (`:936`) → `blocksForTemplateIntent` (`:678-908`, domyślny `intent` bez rozpoznanego typu → gałąź `default` `:894-908` z etykietami `['Signal','Implication','Action']` — źródło obserwowanego `Signal:…`); `Key point N` pochodzi z INNEGO pliku, fallback renderera przy braku treści bloku: `presentationDeckDocumentService.ts:1103-1113``.

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
WT=/private/tmp/cx-day186-gen4-tresc
MARKER=18661cc6a0

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day186-gen4-tresc-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day186-gen4-tresc/config.worktree"
cat "$VAULT/worktrees/cx-day186-gen4-tresc/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day186-gen4-tresc-scratch
mkdir -p /private/tmp/cx-day186-gen4-tresc-artefakty

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
git -C "$VAULT" log --oneline 18661cc6a0..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 18661cc6a0..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day186-gen4-tresc-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18661cc6a0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `sześć` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day186-gen4-tresc

# (T1) TRASA ŚWIADOMIE OMIJA AI I WOŁA MAPPER BEZ BRIEFU
sed -n '2260,2320p' server/src/routes/presentations.routes.ts
#   oczekiwane: komentarz "This route skips the AI pipeline entirely for the template case"
#   (linia ok. 2264); wywołanie `mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint)`
#   (linia ok. 2318) z JEDNYM argumentem — brak `brief`. `req.body` czytany wyżej w trasie
#   ma tylko `templateArtifactId` i `title` — brak odczytu jakiegokolwiek pola brief/description.

# (T2) MAPPER JUŻ WSPIERA BRIEF — TO NIE JEST NOWA FUNKCJONALNOŚĆ
sed -n '1008,1030p' server/src/services/presentationTemplateRuntimeService.ts
grep -n "function blocksForTemplateIntent\|briefLines\[0\]\|headline = compactSlideText" server/src/services/presentationTemplateRuntimeService.ts
#   oczekiwane: `mapOutlineBlueprintToDeckSlides(outlineBlueprint, brief?: string)`; `briefLines`
#   budowane z `brief` (split po zdaniach/liniach); `blocksForTemplateIntent` preferuje
#   `briefLines[0] || keyMessage || hints[0] || title` dla nagłówka.

# (T3) ŹRÓDŁO OBSERWOWANYCH PLACEHOLDERÓW "Signal:" I "Key point N"
grep -n "'Signal'\|'Implication'\|'Action'" server/src/services/presentationTemplateRuntimeService.ts
grep -n "Key point" server/src/services/presentationDeckDocumentService.ts
#   oczekiwane: gałąź `default` (nierozpoznany `intent`) w `blocksForTemplateIntent` używa
#   `['Signal','Implication','Action']` jako etykiet bez treści z briefu, gdy briefLines/hints
#   mają ≤1 element; `presentationDeckDocumentService.ts:1113` `semanticFallbacks[block.type]
#   || 'Key point ${index+1}'` jako fallback renderera przy pustym bloku.

# (T4) ŹRÓDŁO BRIEFU PO STRONIE FRONTU — DZIŚ NIE ISTNIEJE DLA TEJ TRASY
grep -n "templatePrompt\|templateArtifactId" src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx | head -20
grep -rn "templateArtifactId=" src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v __tests__
#   oczekiwane: `templatePrompt` istnieje jako URL param i JEST używany w TEJ SAMEJ ścieżce dla
#   generacji NIE-szablonowej (linia ok. 231-236, `startRef.current(templatePrompt)`), ale
#   wywołanie `from-template` (linia ok. 468) go nie czyta. WSZYSTKIE nawigacje do
#   `/prezentacje?templateArtifactId=...` w repo (artifactNavigation.ts, chatActionHandler.ts,
#   presentationWizardRedirect.ts) nie ustawiają `templatePrompt` — potwierdź, że to zero, nie
#   przeoczenie z Twojej strony.

# (T5) JAK ŚCIEŻKA NIE-SZABLONOWA BUDUJE TREŚĆ — WZORZEC DO REUŻYCIA, NIE WYMYŚLANIA
grep -n "export async function generateDeck\|buildContextPack\|buildPresentationNarrativePlan" server/src/services/presentationGeneratorService.ts | head -10
#   oczekiwane: `generateDeck` (linia ok. 1678) buduje ContextPack + narrativePlan + artifactData
#   z briefu/źródeł PRZED wygenerowaniem slajdów — to jest PEŁNY silnik AI, znacznie cięższy niż
#   potrzeba tu; oceń, czy minimalne ogniwo to WYŁĄCZNIE przekazanie briefu do
#   `mapOutlineBlueprintToDeckSlides` (deterministyczne, już gotowe), czy dodatkowo osobny,
#   lekki krok LLM per slajd — day90 i wzorzec `documentBlockProseGenerator` (cytowany w
#   komentarzu `presentationGeneratorService.ts` ok. linii 1750) to referencyjny, lżejszy
#   kształt takiego kroku dla ścieżki BEZ źródeł.

# (T6) STAN WEJŚCIOWY BRAMKI
grep -n 'GEN-4' docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day186-gen4-tresc-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6095`. Twój JEDYNY port harnessu to `5042 i 5043`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day186-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6068-6079/5010-5029 (dyżury 170-179), 6080-6093/5030-5039 (dyżury 180-184 — NIEUDOKUMENTOWANE w tym checkoucie repo; zweryfikuj sam `lsof -i` / `docker ps` przed startem), oraz wzajemnie porty tej trójki równoległej: 6094/5040-5041 (185), 6096/5044-5045 (187). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi wizualnej — to jest zmiana ogniwa danych (brief → mapper → blocksForTemplateIntent), nie nowy ekran. `mapOutlineBlueprintToDeckSlides` już DZIŚ produkuje inną treść w zależności od tego, czy `brief` jest niepusty (kod istnieje i jest przetestowany dla ścieżki, która go przekazuje — sprawdź testy `presentationTemplateRuntimeService.test.ts`) — włączenie przekazywania briefu nie odsłania nowego komponentu React, tylko poprawia dane wpływające do już istniejącej powłoki Deck Buildera. Jeśli Twoja realizacja R2 (front) dodaje jakikolwiek NOWY widoczny element UI (np. pole "opisz do czego użyjesz szablonu"), TO wymaga zatrzymania się i rozstrzygnięcia, czy to już jest nowa powierzchnia wizualna pod CLAUDE.md #7 — rozstrzygnij i uzasadnij w raporcie, nie milcz`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY186_GEN4_TRESC_REPORT.md`. Dopisujesz nowy wpis wyniku dyżuru 186 do wiersza `GEN-4` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` (ok. linii 151) — NIE nadpisujesz opisu wyniku dyżuru 83 (eksport/promocja cyklu życia), dopisujesz osobno wynik TEJ pozycji (treść). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day186-gen4-tresc-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day186-gen4-tresc-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE RUSZASZ promocji cyklu życia ani eksportu PPTX** — dyżury 77→80→83 domknęły tę pętlę (`+13/-2` w `presentations.routes.ts`, test 162 linii); Twoja zmiana dotyczy WYŁĄCZNIE treści slajdów (co trafia do `content.blocks`), nie tego, jak deck jest zapisywany (`deck_json`), promowany, czy eksportowany do `.pptx`. Jeśli test dnia 83 (`presentations.templatePptx.day83.pg.test.ts`) się wywróci od Twojej zmiany, to znak, że zakres jest za szeroki — zawęź. ★★ **NIE ZASTĘPUJESZ deterministycznej ścieżki `from-template` pełnym pipeline'em AI (`generateDeck`).** Komentarz w kodzie (`:2264`) tłumaczy świadomą decyzję: struktura szablonu jest już znana, AI nie jest potrzebne DO STRUKTURY. Twoje zadanie to nakarmić istniejący deterministyczny mapper prawdziwym briefem, opcjonalnie dodać LEKKI krok treści per slajd — NIE przepisywać trasy na wywołanie `generateDeck`/`buildContextPack`. ★★ **NIE ZMIENIASZ sygnatury `mapOutlineBlueprintToDeckSlides`** poza tym, że trasa zaczyna przekazywać już istniejący, opcjonalny drugi argument — funkcja ma być wywoływana z testu tak samo jak dziś dla wywołań bez brief (`presentationTemplateRuntimeService.test.ts`). ★★ **DOWÓD PLIKIEM JEST OBOWIĄZKOWY.** PPTX wygenerowany z realnego szablonu, z realnym briefem, eksport `HTTP 200`, plik niepusty, treść slajdów NIE zawiera `Key point` ani gołych `Signal:`/`Implication:`/`Action:` bez podstawionej treści — plik zostaje w artefaktach. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Bramka `GEN-4` (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md:151`) mówi wprost, zweryfikowane dziś jako wciąż prawdziwe: „★ PĘTLA DOMKNIĘTA 2026-08-29 (…) ale generator w trybie szablonowym wypełnia PLACEHOLDERAMI, nie treścią: na slajdzie widnieje angielskie `Key point 2` oraz `Signal: … · Implication: … · Action: …` (…) To samo zastrzeżenie co GEN-2 — forma się przenosi, treści nie ma.” Przyczyna zweryfikowana w kodzie: trasa `POST /presentations/decks/from-template` (`presentations.routes.ts:2264` — komentarz "This route skips the AI pipeline entirely for the template case", świadoma decyzja architektoniczna z dyżuru R11 26.07 — deterministyczne kopiowanie `outline_json→cards`, bez AI, bo struktura już znana) woła `mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint)` (`:2318`) BEZ drugiego argumentu. Mapper już WSPIERA `brief?: string` (`presentationTemplateRuntimeService.ts:1008,1010`) — kiedy `briefLines` jest niepuste, `blocksForTemplateIntent` (`:678-908`) buduje treść z realnych zdań briefu (`headline = compactSlideText(briefLines[0] || keyMessage || hints[0] || title, 120)`, `:691`); kiedy `briefLines` jest puste (dzisiejszy stan), gałęzie fallback wchodzą w grę — dla nierozpoznanego `intent` domyślna gałąź (`:894-908`) wypełnia trzy pozycje etykietami `['Signal','Implication','Action']` bez treści z briefu, dokładnie ten wzorzec, który MODULE_ACCEPTANCE nazwał defektem. `Key point N` to osobny fallback — renderer decka (`presentationDeckDocumentService.ts:1113`) podstawia `"Key point ${index+1}"`, gdy blok w ogóle nie ma treści do wyświetlenia. Decyzja D-3 tego samego pakietu wieczornego (`DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`) nie dotyczy GEN-4 wprost (dotyczy audytów), ale rekonesans zamknięcia (`REKONESANS_ZAMKNIECIA_16_MODULOW.md:83`) klasyfikuje GEN-2+GEN-4 razem jako jedną pozycję do zamknięcia Materiałów tej rundy. |

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
cd /private/tmp/cx-day186-gen4-tresc

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day186-pg psql -U postgres -d cx186 \
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
cd /private/tmp/cx-day186-gen4-tresc

docker run -d --name cx-day186-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx186 \
  -p 127.0.0.1:6095:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day186-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6095/cx186 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6095/cx186 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day186-gen4-tresc && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6095/cx186 \
JWT_SECRET=cx186-test-secret-do-not-reuse \
npx vitest run server/src/services/__tests__/presentationTemplateRuntimeService.test.ts oraz server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day186-gen4-tresc-artefakty/day186-presentations-template-content.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day186-gen4-tresc && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/__tests__/presentationTemplateRuntimeService.test.ts oraz server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day186-gen4-tresc-artefakty/day186-presentations-template-content.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day186-gen4-tresc/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day186-pg psql -U postgres -d cx186 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day186-pg`.
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
> **(e) ★★ **Pierwsza, i to jest sedno tego dyżuru: nawet jeśli naprawisz backend w 100%, DZIŚ NIE MA ŻADNEGO ŹRÓDŁA BRIEFU po stronie frontu dla tej trasy.** Zweryfikowane grepem: `PrezentacjeView.tsx:468` woła `Api.post('/presentations/decks/from-template', { templateArtifactId })` wewnątrz efektu, który odpala się AUTOMATYCZNIE, gdy tylko `templateArtifactId` pojawi się w URL (linia ok. 425-450) — nie ma żadnego kroku pośredniego, w którym użytkownik wpisuje choćby jedno zdanie. `templatePrompt` (URL param) ISTNIEJE i jest DOKŁADNIE tym mechanizmem („brief w URL”) używanym w TYM SAMYM pliku dla ścieżki nie-szablonowej — ale WSZYSTKIE trzy miejsca w repo, które nawigują do `/prezentacje?templateArtifactId=...` (`artifactNavigation.ts:107`, `chatActionHandler.ts:326-328`, `presentationWizardRedirect.ts:46`), nigdy nie ustawiają `templatePrompt` obok `templateArtifactId`. Zanim zaczniesz kodować R1, zdecyduj i uzasadnij w raporcie: (a) minimalny fix to WYŁĄCZNIE backend + `brief` opcjonalny w body żądania, a dowód plikiem robisz przez bezpośrednie wywołanie HTTP z briefem (jak dzień 90 zrobił dla dokumentów) — front zostaje bez zmian, ale wtedy realny użytkownik klikający w UI nadal dostanie placeholdery, bo nic nie wyśle briefu; (b) minimalny fix obejmuje też 2-3 linie we froncie: `PrezentacjeView.tsx` zaczyna przekazywać `templatePrompt` (jeśli obecny) jako `brief` w wywołaniu `from-template` — to domyka ogniwo end-to-end, ale wymaga też ustalenia, SKĄD `templatePrompt` miałby się wziąć dla tej konkretnej ścieżki (żadna nawigacja go dziś nie ustawia — czy to zadanie tego dyżuru, czy osobne zgłoszenie). Nie milcz na ten temat w raporcie — to jest najważniejsze znalezisko tego dyżuru, ważniejsze niż literalna treść briefu z brief dyżuru. ★★ **Druga: `blocksForTemplateIntent` ma osobną gałąź per `intent`** (`cover`, `executive_summary`, `performance_overview`, `comparison`, `roadmap`, `risk_management`, `recommendation_single/portfolio`, `next_steps`, `default`) — przekazanie samego `brief` NIE gwarantuje identycznej poprawy dla wszystkich intencji; niektóre gałęzie (np. `roadmap`, `risk_management`) mają WŁASNE fallbacki tekstowe niezależne od `headline`/`briefLines[0]`, zaprojektowane tak, by nigdy nie wyglądać pusto nawet bez briefu. Zmierz per-intent, czy `Signal:`/`Key point` faktycznie znika po Twojej zmianie dla KAŻDEJ intencji obecnej w szablonie dowodowym, nie tylko dla pierwszego slajdu. ★★ **Trzecia: `groundedValueForLabel` (`:624-645`) wymaga wartości ZAWIERAJĄCEJ liczbę/walutę/procent** (`/(?:\d|€|\$|£|%)/`) dopasowanej do etykiety — jeśli brief nie ma takiej frazy dla danej etykiety (np. „Investment”), funkcja zwraca literalnie `'Data required'`. To NIE jest błąd Twojej zmiany, to zastany, celowy anty-fabrykacyjny fallback (komentarz w kodzie: "deliberately express a decision framework and evidence slots without inventing numerical results") — nie "napraw" go wymyślając liczby, ale nazwij w raporcie, jeśli dowodowy PPTX pokazuje `Data required` na jakimś slajdzie, żeby nie zostało to pomylone z regresją. ★★ **Czwarta: `mapOutlineBlueprintToDeckSlides` jest eksportowana i ma istniejący test jednostkowy w `presentationTemplateRuntimeService.test.ts`** — sprawdź go PRZED zmianą, żeby nie duplikować przypadków i żeby zobaczyć, czy test już pokrywa wywołanie z `brief` (a tylko trasa go nie używa) — jeśli tak, to R1 jest jeszcze bardziej precyzyjnie ograniczone niż wygląda: dosłownie jedna linia w trasie.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day186-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day186-gen4-tresc-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — trasa `from-template` przekazuje brief do mappera; pozycja R2 — źródło briefu (front) domknięte albo świadomie odłożone z uzasadnieniem; pozycja R3 — dowód plikiem (realny PPTX z treścią)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6095` albo `5042 i 5043` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6095` albo `5042 i 5043`** (`Z7`).

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

Bramka `GEN-4` (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md:151`)
zapisuje stan, zweryfikowany dziś jako wciąż prawdziwy:

> ★ **PĘTLA DOMKNIĘTA 2026-08-29.** (…) Po poprawce (`+13/-2` w `presentations.routes.ts` plus
> nowy test `162` linii) eksport zwraca `200` i niepusty PPTX. (…) ★ `PARTIAL` — **pętla działa
> mechanicznie, ale generator w trybie szablonowym wypełnia PLACEHOLDERAMI, nie treścią**: na
> slajdzie widnieje angielskie `Key point 2` oraz `Signal: … · Implication: … · Action: …` (…)
> **To samo zastrzeżenie co `GEN-2`** — forma się przenosi, treści nie ma.

Mechanika (zapis/odczyt decka, promocja cyklu życia, eksport PPTX) jest domknięta przez dyżury
77→80→83. Ten dyżur adresuje wyłącznie brakujące ogniwo TREŚCI.

**Przyczyna, zweryfikowana dziś w kodzie (SHA `18661cc6a0`).** Trasa
`POST /presentations/decks/from-template` (`server/src/routes/presentations.routes.ts:2283-2318`)
ma w komentarzu jawne, świadome uzasadnienie architektoniczne (`:2264`):

> This route skips the AI pipeline entirely for the template case (…) — no AI needed when the
> structure is already fully known.

Woła:

```ts
// :2318
const slides = mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint);
```

Jeden argument. `mapOutlineBlueprintToDeckSlides` w `presentationTemplateRuntimeService.ts`
(`:1008-1030`) ma sygnaturę:

```ts
export function mapOutlineBlueprintToDeckSlides(
  outlineBlueprint: unknown[],
  brief?: string
): DeckSlideFromOutline[] {
```

Drugi argument już istnieje, jest przetestowany i **zmienia treść** wewnątrz
`blocksForTemplateIntent` (`:678-908`) — preferuje `briefLines[0] || keyMessage || hints[0] ||
title` (`:691`) zamiast szablonowego, ogólnego frameworku. Kiedy `brief` jest pusty (dzisiejszy
stan produkcji), gałęzie fallback wchodzą w grę. Dla nierozpoznanego `intent` gałąź `default`
(`:894-908`) buduje trzy pozycje z etykietami `['Signal', 'Implication', 'Action']` — dokładnie
zaobserwowany defekt. `Key point N` to osobny mechanizm: fallback w renderze decka
(`presentationDeckDocumentService.ts:1113`), który podstawia `"Key point ${index+1}"`, gdy blok w
ogóle nie ma treści.

**To jest ten sam kształt defektu co GEN-2 (dyżur 185), z innym mechanizmem tej samej przyczyny
źródłowej: strukturę mamy, treści z briefu do niej nie doprowadzamy.**

# 2. TEZY ZLECENIA

- **T1.** Naprawa deterministyczna (przekazać `brief` do już-istniejącego parametru mappera) jest
  wystarczająca dla WIĘKSZOŚCI intencji slajdów — zmierz to per-intent, nie zakładaj jednorodności.
- **T2.** Ścieżka nie-szablonowa (`generateDeck`, `presentationGeneratorService.ts:1678`) buduje
  treść przez pełny pipeline AI (ContextPack, narrativePlan, artifactData) — zbadaj go jako
  WZORZEC, nie jako coś do skopiowania w całości; oceń, czy minimalne ogniwo to WYŁĄCZNIE
  przekazanie briefu, czy dodatkowo lekki krok LLM per slajd.
- **T3.** ★ Nawet po naprawieniu backendu, front dziś NIE MA źródła briefu dla tej konkretnej
  trasy — zweryfikuj to jako fakt, nie zakładaj, i zdecyduj świadomie, czy wchodzi w zakres tego
  dyżuru.
- **T4.** `groundedValueForLabel` ma świadomy anty-fabrykacyjny fallback (`'Data required'`, gdy
  brief nie zawiera dopasowanej liczby) — to NIE jest błąd do naprawienia, tylko zachowanie do
  odróżnienia od regresji w dowodzie plikiem.

# 3. POZYCJE DYŻURU

## R1 — trasa przekazuje brief do mappera

Zmień `server/src/routes/presentations.routes.ts` tak, by `POST /decks/from-template`:
1. czytał opcjonalne pole `brief` (lub `description`/`templatePrompt` — wybierz i uzasadnij
   nazwę kontraktu, sprawdzając czym dziś operuje front w `templatePrompt`) z `req.body`,
   analogicznie do `templateArtifactId`/`title` (`:2290-2292`);
2. przekazywał je jako drugi argument do `mapOutlineBlueprintToDeckSlides(resolved.outlineBlueprint,
   brief)` (`:2318`).

Zero zmian w `mapOutlineBlueprintToDeckSlides`/`blocksForTemplateIntent` — funkcja już wspiera
brief; to jest ogniwo WOŁANIA, nie logiki mapowania. Jeśli test dnia 83
(`presentations.templatePptx.day83.pg.test.ts`) albo test `presentationTemplateRuntimeService.test.ts`
wywróci się od tej zmiany, to sygnał regresji w cyklu życia/eksporcie — zatrzymaj się, to jest
poza zakresem tego dyżuru.

**Ukończone, gdy:** wywołanie `POST /decks/from-template` z niepustym `brief` produkuje deck,
którego karty (`presentation_cards`) zawierają treść zbudowaną z tego briefu (nie z gołych
etykiet `Signal`/`Implication`/`Action` ani `Key point N`) — test integracyjny na realnym
PostgreSQL potwierdza to dla co najmniej dwóch różnych `intent` obecnych w szablonie dowodowym.

## R2 — źródło briefu (front) — domknij albo świadomie odłóż

Zweryfikuj grepem (komenda T4 w §0 poniżej) fakt: `templatePrompt` (URL param) jest DZIŚ
ustawiany i czytany w `PrezentacjeView.tsx` dla ścieżki generacji nie-szablonowej (linie ok.
231-236), ale wywołanie `from-template` (linia ok. 468) go nie czyta, i ŻADNA z trzech tras
nawigacyjnych do `/prezentacje?templateArtifactId=...` w repo
(`artifactNavigation.ts:107`, `chatActionHandler.ts:326-328`, `presentationWizardRedirect.ts:46`)
nigdy nie ustawia `templatePrompt` obok `templateArtifactId`.

Na tej podstawie wybierz i uzasadnij w raporcie JEDNO z dwóch:
- **(a) Minimalne domknięcie samego wołania:** `PrezentacjeView.tsx` zaczyna przekazywać
  `templatePrompt` (gdy obecny w URL) jako `brief` w wywołaniu `from-template` — 2-3 linie,
  zero nowego UI. To NIE domyka ścieżki end-to-end (bo dziś nic nie ustawia `templatePrompt` dla
  tego wejścia), ale usuwa martwy kod i przygotowuje grunt.
- **(b) Zostawiasz front nietknięty i zgłaszasz brak źródła briefu jako osobne, imiennie
  nazwane znalezisko** dla właściciela/kolejnego dyżuru — z dokładnym wskazaniem trzech miejsc
  nawigacyjnych, które musiałyby zacząć nieść brief, i pytaniem, skąd realnie miałby pochodzić
  (czat? modal przy wyborze szablonu w Bibliotece?).

Nie milcz na ten temat — to jest ważniejsze znalezisko niż literalna treść R1.

**Ukończone, gdy:** raport jawnie rozstrzyga (a) czy (b), z uzasadnieniem opartym na
zweryfikowanym stanie kodu, nie na domysłach.

## R3 — dowód plikiem: realny PPTX z treścią

Wygeneruj deck przez `POST /decks/from-template` z realnym `templateArtifactId` (szablon z
biblioteki, z co najmniej trzema różnymi `intent` w outline) i niepustym briefem, wyeksportuj do
`.pptx` przez istniejącą, nietkniętą ścieżkę eksportu (dyżur 83), i sprawdź plik:

- eksport `HTTP 200`, plik niepusty;
- treść slajdów NIE zawiera `Key point` ani gołych `Signal:`/`Implication:`/`Action:` bez
  podstawionej treści z briefu (dopuszczalne: `Data required` tam, gdzie brief faktycznie nie ma
  dopasowanej liczby dla etykiety — T4, nazwij to jawnie, nie chowaj);
- znacznik tego dyżuru w nagłówku lub stopce, wzorem dyżuru 83 (`ZNACZNIK-DAY83-…`);
- plik ZOSTAJE w katalogu artefaktów, z SHA-256 i ścieżką w raporcie.

**Ukończone, gdy:** plik istnieje, otwiera się bez błędu, i tabela per-slajd w raporcie
(slajd → intencja → treść przed → treść po) pokazuje realną poprawę dla każdej intencji obecnej w
szablonie dowodowym.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/routes/presentations.routes.ts` — wyłącznie handler `POST /decks/from-template` (ok. linii 2283-2330): odczyt nowego pola z `req.body`, przekazanie go do `mapOutlineBlueprintToDeckSlides` |
| Zapis (warunkowo, R2 wariant a) | `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` — wyłącznie wywołanie `Api.post('/presentations/decks/from-template', ...)` (ok. linii 465-470): dodanie pola brief z `templatePrompt`; zakaz zmian w reszcie efektu/pliku |
| Zapis | testy `day186.*` w `server/src/routes/__tests__/` (wzorem `presentations.templatePptx.day83.pg.test.ts`) i/lub `server/src/services/__tests__/presentationTemplateRuntimeService.test.ts` (jeśli dopisujesz przypadek na poziomie mappera) |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` — wyłącznie wiersz `GEN-4` (ok. linii 151): wynik dyżuru 186, bez nadpisywania opisu wyniku dyżuru 83 |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY186_GEN4_TRESC_REPORT.md` |
| Odczyt | `server/src/services/presentationTemplateRuntimeService.ts` (`mapOutlineBlueprintToDeckSlides`, `blocksForTemplateIntent`, `groundedValueForLabel`, `briefLinesForOutlineItem`) — NIE zmieniasz, funkcja już wspiera to, co potrzebne |
| Odczyt | `server/src/services/presentationDeckDocumentService.ts:1103-1113` — źródło fallbacku `Key point N`; NIE zmieniasz |
| Odczyt | `server/src/services/presentationGeneratorService.ts` (`generateDeck`, `:1678` i dalej) — wzorzec ścieżki nie-szablonowej, wyłącznie do inspiracji przy R1; NIE zmieniasz |
| Odczyt | `src/services/chatActionHandler.ts`, `src/components/ReportsAndPresentations/artifactNavigation.ts`, `src/routes/presentationWizardRedirect.ts` — wszystkie wejścia nawigacyjne do trasy szablonowej; NIE zmieniasz, chyba że R2(a) jawnie uzasadnia inaczej w raporcie PRZED zmianą |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY83_PPTX_EXPORT_REPORT.md`, `INSTRUKCJA_DYZUR_78_PPT_RUBRYKA.md` — kontekst poprzednich dyżurów tego łańcucha; NIE zmieniasz |

**Nietykalne imiennie:** cały mechanizm eksportu PPTX i promocji cyklu życia (dyżury 77-83) —
zero zmian w plikach odpowiedzialnych za `deck_json`, promocję, `.pptx` binarkę; whitelist
`isAssessmentModuleInitiative`-owej klasy (nie dotyczy tego modułu, ale zasada: nie rozszerzaj
żadnej białej listy jako obejścia); żaden `MODULE_ACCEPTANCE.md` poza wierszem `GEN-4` w
11_MATERIALS.

★ **Rozłączność z dyżurem 185 (ten sam moduł 11_MATERIALS, GEN-2, dokumenty Word):** 185 dotyka
WYŁĄCZNIE `documentBlockContentGenerator.ts`/`documentContentGenerator.ts` (ścieżka dokumentów).
Ten dyżur dotyka WYŁĄCZNIE `presentations.routes.ts`/`presentationTemplateRuntimeService.ts`
(ścieżka prezentacji). Zero pokrycia plików. Zero pokrycia też z dyżurem 187 (Audyty).

# 5. TWARDE ZASADY

- ★ **NIE ruszasz promocji cyklu życia ani eksportu PPTX** — dyżury 77→80→83 to domknęły. Jeśli
  test dnia 83 się wywróci od Twojej zmiany, zawęź zakres.
- **Nie zastępujesz deterministycznej ścieżki `from-template` pełnym pipeline'em AI.** Struktura
  szablonu jest już znana — to była świadoma decyzja architektoniczna (komentarz w kodzie,
  `:2264`). Karm istniejący mapper prawdziwym briefem; nie przepisuj trasy na `generateDeck`.
- **Nie zmieniasz sygnatury `mapOutlineBlueprintToDeckSlides`** — drugi argument już istnieje.
- **Dowód plikiem jest obowiązkowy** — PPTX realny, z treścią, w artefaktach.
- **Nie chowasz `Data required`** w dowodzie jako defekt — to świadomy, anty-fabrykacyjny
  fallback (T4); nazwij go, jeśli występuje, nie próbuj go "naprawić" wymyślaniem liczb.
- Pułapka ogólna programu: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB — dowód R1/R3
  MUSI być na realnym PostgreSQL.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, na
  `cx-day186-pg`.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie końcowym — wypisz w niej wprost, jeśli
  R2 pozostał nierozstrzygnięty (a)/(b), albo jeśli nie zdążyłeś zmierzyć wszystkich intencji
  slajdów obecnych w szablonie dowodowym.

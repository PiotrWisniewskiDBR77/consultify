# INSTRUKCJA DYŻURU nr 190 — Codex — „Materiały GEN-2 — DRUGI kasownik treści: heurystyka `obviousEnglish` przestaje kasować polskie zdania i nagłówki za polskie słowa, z dowodem plikiem przez REALNĄ ścieżkę z LLM (Z15 zniesione dla R2)"

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
> **wyłącznie** `/private/tmp/cx-day190-drugi-kasownik`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `b4651675f6`**
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
Zakres: **11_MATERIALS — GEN-2 (Studio Dokumentów), granica ostateczna groundingu `enforceDocumentSchemaGrounding` w `server/src/services/documentStudio/documentContentGenerator.ts`**.
Trasy front: `brak zmian frontu wymaganych w tym dyżurze. Mechanizm oznaczania (`isAssumption` → znacznik `[Assumption — needs source]`) jest już wpięty end-to-end i został potwierdzony w odbiorze 185 niezależnym renderem. Kontekst do odczytu, NIE zmieniasz: `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:221-273`, `src/components/DocumentStudio/publicReader/ReaderBlockRenderer.tsx:62`, `src/components/DocumentStudio/editor/schemaToTipTap.ts:74`, `src/components/DocumentStudio/editor/nodes/payloadAttrs.ts:44-48`. ★ Front R2 to NIE React: dowód idzie przez HTTP (`POST /api/document-studio/generate`, `GET /api/document-studio/:artifactId/export/docx`), nie przez klikanie w UI`. Trasy tył: `Generacja: `POST /api/document-studio/generate` (`server/src/routes/document-studio.routes.ts:853`, kontrakt w nagłówku pliku `:5-14`, body `{ intake, outline?, sourceRefs?, projectId?, useLlm?, templateId? }`) → `documentStudioService.materialize…` → przy `useLlm: true` warstwa prozy `generateBlockProse` (`documentStudioService.ts:1014-1019` → `documentBlockContentGenerator.ts` `fillViaLlm:693-730`, JEDNO wywołanie LLM NA SEKCJĘ, `CONCURRENCY = 3`) → ★ GRANICA OSTATECZNA `enforceDocumentSchemaGrounding` (`documentContentGenerator.ts:102`, wołana z `documentStudioService.ts:1024`, komentarz w kodzie: „FINAL grounding boundary. Must remain after every content/prose LLM layer”) → zapis `sections[].blocks[].isAssumption` do PostgreSQL. TU JEST DEFEKT: `obviousEnglish` (`:135-136`) + `localizePolishValue` (`:138-171`) + cztery przypisania `= removed` (`:148` wartość, `:182` tytuł dokumentu, `:194` tytuł sekcji, `:198` cel sekcji), a `:217-218` przypina blok `heading` do skasowanego `section.title`. Eksport: `GET /api/document-studio/:artifactId/export/docx` → `documentDocxRenderer.ts` (`buildAssumptionMarker:502-510`, `renderParagraphBlock:536-556`) — kod znacznika NIE wymaga zmian`.

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
WT=/private/tmp/cx-day190-drugi-kasownik
MARKER=b4651675f6

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day190-drugi-kasownik-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day190-drugi-kasownik/config.worktree"
cat "$VAULT/worktrees/cx-day190-drugi-kasownik/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day190-drugi-kasownik-scratch
mkdir -p /private/tmp/cx-day190-drugi-kasownik-artefakty

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
git -C "$VAULT" log --oneline b4651675f6..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only b4651675f6..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day190-drugi-kasownik-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only b4651675f6..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day190-drugi-kasownik

# (T1) HEURYSTYKA — zobacz listę tokenów na własne oczy; policz alternatywy SAM
sed -n '135,136p' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: `const obviousEnglish =` i regex z flagą `i`, alternatywy rozdzielone `|`,
#   wśród nich `portfolio`, `total`, `plan`, `medium`. NIE przepisuj liczby 37 z instrukcji —
#   policz alternatywy sam (Z24) i wpisz swoją liczbę z mianownikiem do raportu.

# (T2) CZTERY PRZYPISANIA KASUJĄCE — potwierdź każdą linię osobno
sed -n '112,115p;146,149p;181,182p;193,199p' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: :112-115 definicja `removed` (PL: 'Treść usunięta — niepoparte twierdzenie
#   (założenie do weryfikacji).'); :148 `if (obviousEnglish.test(value)) return { value: removed,
#   changed: true };`; :182 `if (guardedTitle.changed) next.title = removed;`; :194
#   `if (title.changed) section.title = removed;`; :198 `if (purpose.changed) section.purpose = removed;`

# (T3) ★ ŁAŃCUCH DO NAGŁÓWKA — dlaczego kasownik trafia do Heading1
sed -n '184,192p;211,219p' server/src/services/documentStudio/documentContentGenerator.ts
#   oczekiwane: :185 `if (language === 'pl') {` → :186 `localizePolishValue(section.title)` →
#   :187 `section.title = String(localizedTitle.value)` — tytuł idzie pod heurystykę ZANIM
#   ktokolwiek sprawdzi grounding; a potem :217 `if (block.type === 'heading') {` → :218
#   `block.content = { text: section.title };` — nagłówek dziedziczy skasowany tytuł.

# (T4) ★ POKAŻ KASOWANIE NA WŁASNYM PRZYKŁADZIE (bez LLM, bez bazy — czysty regex)
node -e "const re=/\\b(the|and|for|with|without|required|information|portfolio|financial|constraints?|optimized|resource|allocation|executive|summary|decisions?|risks?|next|steps?|budget|overrun|severity|likelihood|impact|owner|mitigation|total|plan|realization|milestones?|completed|high|medium|low|scope|timing)\\b/i; for (const t of ['Plan wdrozenia obejmuje trzy fale.','Plan dzialania','Portfolio inicjatyw obejmuje osiem projektow.','Medium jest przekaznikiem informacji.','Planujemy wdrozenie w trzech falach.','Realizacja planu wynosi 72%.']) { const m=t.match(re); console.log((m?'KASUJE ['+m[0]+']':'zostaje       ')+'  '+t); }"
#   oczekiwane: cztery pierwsze KASUJE, dwa ostatnie zostaja. Skopiuj regex z T1, NIE z tej
#   komendy — jesli sie roznia, wiazacy jest plik (Z24) i wpisujesz rozbieznosc do raportu.

# (T5) GRANICA JEST OSTATECZNA I DZIALA PO KAZDEJ GENERACJI — potwierdz wolacza
sed -n '1009,1032p' server/src/services/documentStudio/documentStudioService.ts
grep -rn 'enforceDocumentSchemaGrounding' server/src --include=*.ts | grep -v __tests__
#   oczekiwane: komentarz 'FINAL grounding boundary. Must remain after every content/prose
#   LLM layer' i wywolanie w linii 1024; grep ma dac definicje (:102), import (:70) i ten
#   jeden wolacz — potwierdz, ze nie ma drugiej sciezki, ktora go omija.

# (T6) ZASTANE TESTY, KTORE ZMIENIA SENS PO R1 — przeczytaj je ZANIM cokolwiek zmienisz
sed -n '135,236p' server/src/services/documentStudio/__tests__/documentPremiumGroundingNormalization.test.ts
#   oczekiwane: test EPSILON (asercje 'Laczny budzet', 'Realizacja planu', 'Wysokie') i test
#   SIGMA (asercja not.toMatch na 'initiative|progress|Assumed|...'). Ustal dla KAZDEJ asercji,
#   czy jej zielony kolor pochodzi z `plCanonical`, z `POLISH_HEADER_TRANSLATIONS`
#   (documentBlockContentGenerator.ts:403-421), czy z kasowania przez `obviousEnglish` — bo
#   tylko ta trzecia grupa zmieni sie po R1. Testy ZMIENIASZ, nie USUWASZ.

# (T7) PIERWSZY KASOWNIK JEST JUZ NAPRAWIONY — potwierdz, ze NIE masz go dotykac
sed -n '488,504p' server/src/services/documentStudio/documentBlockContentGenerator.ts
#   oczekiwane: `const unsupportedClaim = unsupportedClaimInString(...)`, dla `'number'`
#   `changed = true; return value;` (TRESC ZOSTAJE — naprawa 185), dla `'acronym'` placeholder.
#   Ten plik jest w tym dyzurze TYLKO DO ODCZYTU.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day190-drugi-kasownik-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6110`. Twój JEDYNY port harnessu to `5052 i 5053`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day190-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6107, 5010-5051, 6404-6411 (zajęte przez wcześniejsze dyżury i odbiory nadzorcy), oraz wzajemnie porty partii równoległej: 6108-6109/5048-5051 i 6111-6113/5054-5059. ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 ZAJĘTY przez `adb` (serwer Androida). ★ Ta lista jest rozkazem pomiarowym, nie gwarancją — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi wizualnej i brak potrzeby jej wprowadzenia. Uzasadnienie do potwierdzenia lub obalenia przez Ciebie w raporcie: (a) to jest zmiana logiki granicy backendowej (który string przeżywa `enforceDocumentSchemaGrounding`), nie nowy ekran ani komponent React — `CLAUDE.md` §7 dotyczy powierzchni wizualnych; (b) wszystkie mechanizmy prezentacji (`isAssumption`, znacznik DOCX/PDF, atrybut TipTap) już działają produkcyjnie i nie są w tym dyżurze zmieniane; (c) kierunek jest jawną decyzją właściciela D-8 z 2026-08-30 („poluzować + rubryka”), więc nie wymaga dodatkowego bramkowania flagą. ★ Wyjątek do rozważenia: gdyby Twoje R1 zmieniło KONTRAKT dla angielszczyzny w polskim dokumencie (R3b) w sposób widoczny dla użytkownika, nazwij to w raporcie jako zmianę kontraktu do świadomej akceptacji właściciela — nie chowaj tego pod „naprawa defektu”`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY190_DRUGI_KASOWNIK_REPORT.md`. Dopisujesz wynik dyżuru 190 do wiersza `GEN-2` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` (ok. linii 149) — w szczególności koryguj zdanie o `NOT_PROVEN` z powodu `Z15`, bo ta instrukcja `Z15` dla R2 znosi. Podnosisz status `GEN-2` z `PARTIAL` TYLKO jeśli masz dowód PLIKIEM (`Z32`: zakaz `PASS` bez dowodu) i tylko w zakresie, który dowód faktycznie pokrywa; próg rubryki `15/18` z D-8 jest osobnym kryterium i jeśli go nie mierzysz, napisz to. NIE zmieniasz `GEN-1`, `GEN-3`, `GEN-4` ani `GEN-5` w tej samej tabeli. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day190-drugi-kasownik-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day190-drugi-kasownik-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **`Z15` NIE OBOWIĄZUJE W POZYCJI R2 — realne wywołanie LLM jest WYMOGIEM, nie naruszeniem.** To jest jawne zniesienie, wpisane do części merytorycznej, i powstało dlatego, że sprzeczność `Z15` vs R2 zatrzymała dyżur 185 (jego STOP był zasadny; błąd był autorski). Licencja na klucz: plik `~/.consultify-openrouter` (jedna linia `OPENROUTER_API_KEY=<wartość>`), **jedyna dozwolona komenda źródłowa: `set -a; . ~/.consultify-openrouter; set +a`** — nie ma innej dozwolonej drogi; nie kopiujesz tego pliku, nie przenosisz go do repozytorium, nie wpisujesz jego treści do `.env`, `docker-compose*` ani do żadnej komendy. W pozycjach R1 i R3 modelu NIE wołasz w ogóle. ★★ **`Z40` bez wyjątku: zakaz wypisania WARTOŚCI klucza gdziekolwiek** — nie w raporcie, nie w logu, nie w komendzie, nie w komunikacie błędu, nie w `env`; pokazujesz wyłącznie `obecny`/`nieobecny` albo długość (`env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY'`). **Maksymalnie DWA realne wywołania modelu w CAŁYM dyżurze** (`DEC-2026-08-29-317`), zakaz pętli, zakaz ponawiania — a `fillViaLlm` robi JEDNO wywołanie NA SEKCJĘ (`documentBlockContentGenerator.ts:693-730`), więc outline ma mieć najwyżej dwie sekcje, `wantCitations` ma być `0`, a `POST /plan` z `useLlm: true` jest zakazany (przekazujesz gotowy outline). Plik „PRZED” NIE powstaje przez drugą generację — mutację robisz na granicy, na tym samym schemacie. ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTÓW, w szczególności bez `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powód: dyżur 43 przypiął strażnika do swojej bazy i po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`** przy `exit 0`; w programie odnotowano **sześć takich incydentów**, a dyżur 193 został zamówiony wyłącznie po to, żeby zbiorczo je odpiąć (patrz `97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres`). Nie dokładaj siódmego. ★★ **NIE DOTYKASZ `documentBlockContentGenerator.ts`** — poza odczytem. To naprawa dyżuru 185, scalona po `FIX-185`; `unsupportedClaimInString`, `enforceBlockGrounding`, `GROUNDING_ACRONYM_RULE`, `SAFE_BUSINESS_ACRONYMS`, `POLISH_HEADER_TRANSLATIONS` i `POLISH_INTENT_RE` są nietykalne. ★★ **NIE ZMIENIASZ reguły akronimów ani kontraktu D-8** — liczby-założenia mają dalej być zachowywane i oznaczane; jeśli Twoja zmiana wyłączy `isAssumption` dla liczb, to jest regresja anty-fabrykacyjna (EPSILON), nie naprawa. ★★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje na dysku. ★★ **Fixture NIE JEST dowodem.** Ręcznie zbudowany schemat z zaszytym `isAssumption`, omijający naprawiany kod, dostał w odbiorze 185 ocenę `D` („atrapa”) i nie został pokazany właścicielowi. Dowód R2 musi przejść przez `enforceDocumentSchemaGrounding` w realnym przebiegu. ★★ **Nie udajesz realnego wywołania modelu przez fallback** — `documentStudioService.ts:1009-1013` woła model best-effort i **każda awaria zwraca deterministyczny schemat bez błędu i bez ostrzeżenia**; dowodem jest log `LLM call success` z realnym `tokens`/`durationMs`, nie `HTTP 200`. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`) i zakaz usuwania zastanych testów — asercję wolno ZMIENIĆ z uzasadnieniem, nie skasować. | Odbiór dyżuru 185 (`docs/program/funkcje/ODBIOR_185_GEN2_STRAZNIK.md`) zmierzył przez realną granicę produkcyjną DRUGIE, niezależne źródło komunikatu „Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).” i oznaczył je jako priorytet NAJWYŻSZY w kolejce treści całego programu. Dyżur 185 naprawił pierwszy kasownik (liczby, w `documentBlockContentGenerator.ts`) i został scalony po `FIX-185`. Drugi kasownik żyje dalej i działa PO KAŻDEJ generacji, bo siedzi w granicy ostatecznej: `enforceDocumentSchemaGrounding` (`documentContentGenerator.ts:102`, wołana z `documentStudioService.ts:1024`, opisana w kodzie jako „FINAL grounding boundary … after every content/prose LLM layer”). Mechanizm, zweryfikowany linia po linii na SHA `b4651675f6`: heurystyka `obviousEnglish` (`:135-136`) to regex 37 alternatyw z `\b…\b` i flagą `i`, a wśród nich są POLSKIE słowa — `plan`, `portfolio`, `medium`, `total`. `localizePolishValue` (`:138-171`) sprawdza najpierw słownik `plCanonical` (`:116-134`, 17 kanonicznych etykiet), a jeśli wartości tam nie ma, to `:148` zastępuje CAŁĄ wartość komunikatem `removed`. Pomiar empiryczny wykonany przy pisaniu tej instrukcji: „Plan wdrożenia obejmuje trzy fale.” → KASUJE (token `Plan`); „Plan działania” → KASUJE; „Portfolio inicjatyw obejmuje osiem projektów.” → KASUJE; „Medium jest przekaźnikiem informacji.” → KASUJE. Gorzej: kasownik trafia do NAGŁÓWKA. W pętli po sekcjach `:185-187` `localizePolishValue` przerabia `section.title` ZANIM cokolwiek sprawdzi grounding, `:194` dokłada drugie przypisanie `= removed`, a `:217-218` przypina blok `heading` do tak zniszczonego tytułu (`if (block.type === 'heading') { block.content = { text: section.title }; }`). ★ To wyjaśnia wynik dyżuru 90: jego jedyna sekcja nazywała się dosłownie „Plan działania”, model napisał 359 tokenów prozy (log `LLM call success for openrouter {"tokens":1122,"completionTokens":359}`), a plik z modelem i bez modelu wyszły identyczne — `61 z 61` słów, `3 z 3` pustych gniazd. Filozofia naprawy jest już rozstrzygnięta decyzją właściciela D-8 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:29`, „POLUZOWAĆ + rubryka; liczby-założenia dopuszczone i oznaczone; jakość pilnowana rubryką 15/18 przy odbiorze pliku”) i wykonana dla liczb w dyżurze 185 (`unsupportedClaimInString` zwraca dziś `'number' | 'acronym' | false`; dla `'number'` treść ZOSTAJE). Dyżur 190 robi to samo dla JĘZYKA. ★★ Druga, równie ważna przyczyna istnienia tego dyżuru: dyżur 185 NIE MÓGŁ zamknąć dowodu plikiem, bo wydana mu instrukcja jednocześnie zakazywała modelu (`Z15`) i wymagała go (R2). Jego STOP był ZASADNY, błąd był autorski po stronie nadzorcy, a skutkiem był plik-atrapa (ręczny fixture z zaszytym `isAssumption`, omijający naprawiany kod, ~50 słów) oceniony w odbiorze na `D` i NIEPOKAZANY właścicielowi. Wiersz `GEN-2` w `MODULE_ACCEPTANCE.md:149` mówi to dziś wprost: „realny DOCX … pozostaje `NOT_PROVEN`, ponieważ wydane Z15 zakazuje modelu, a R2 go wymaga”. Ta instrukcja znosi `Z15` dla R2 jawnie i wpisuje licencję na klucz. |

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
cd /private/tmp/cx-day190-drugi-kasownik

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day190-pg psql -U postgres -d cx190 \
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
cd /private/tmp/cx-day190-drugi-kasownik

docker run -d --name cx-day190-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx190 \
  -p 127.0.0.1:6110:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day190-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6110/cx190 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6110/cx190 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day190-drugi-kasownik && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6110/cx190 \
JWT_SECRET=cx190-test-secret-do-not-reuse \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day190-drugi-kasownik-artefakty/day190-documentstudio-jezyk.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day190-drugi-kasownik && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day190-drugi-kasownik-artefakty/day190-documentstudio-jezyk.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day190-drugi-kasownik/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day190-pg psql -U postgres -d cx190 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day190-pg`.
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
> **(e) ★★ **Pierwsza: `obviousEnglish` NIGDY nie dotyka dokumentów angielskich — więc naturalne brzmienie R3 („EN nadal działa”) jest testem trywialnie zielonym.** `localizePolishValue` ma dokładnie trzy wywołania (`:186`, `:189`, `:212`) i wszystkie trzy leżą pod `if (language === 'pl')` (`:185`, `:211`). Zweryfikuj to sam. Jeśli się potwierdzi, to heurystyka nigdy nie chroniła dokumentów EN — chroniła **polskie dokumenty przed wyciekiem angielszczyzny z modelu** (`Executive Summary`, `Budget overrun` w dokumencie `language: 'pl'`). To jest wartość, której nie wolno stracić, i to ona ma być przedmiotem testu regresyjnego, a nie dokument EN. Napisz w raporcie wprost, czy Twój test EN jest dowodem braku regresji, czy tylko potwierdzeniem rozłączności ścieżek — mylenie tych dwóch rzeczy to gotowy „fałszywy zielony”. ★★ **Druga: nagłówka nie da się naprawić osobno.** Blok `heading` nie ma własnej treści — `:217-218` nadpisuje ją `section.title` w każdej iteracji (`block.content = { text: section.title }`). Jeżeli naprawisz tylko gałąź akapitową `localizePolishValue`, a `section.title` zostawisz, nagłówek dalej będzie niósł „Treść usunięta”. Odwrotnie też: jeśli naprawisz tytuł, ale nie ruszysz `:194`, `guardText` skasuje go sekundę później. Naprawa musi objąć CAŁY łańcuch `:186 → :187 → :194 → :218` i musisz to pokazać jednym testem, który sprawdza treść bloku `heading`, nie tylko `section.title`. ★★ **Trzecia: `plCanonical` maskuje skalę defektu na testowych fixture'ach.** 17 kanonicznych etykiet (`:116-134` — „executive summary”, „next steps”, „risks”, „scope”, „timing”…) jest sprawdzanych PRZED heurystyką (`:146-147`), więc każdy fixture zbudowany z kanonicznych tytułów przejdzie bez szwanku i wyjdzie Ci, że „defekt jest mały”. Defekt uderza dokładnie w to, czego w fixture'ach nie ma: **tytuły wymyślone przez użytkownika i przez model**. Zbuduj przypadki testowe z tytułami spoza `plCanonical` (np. „Plan działania”, „Portfolio inicjatyw”), inaczej zmierzysz nie ten zbiór (pułapka „próbka zamiast zbioru”). ★★ **Czwarta: część pracy, którą przypisujesz `obviousEnglish`, wykonuje już wcześniej inny kod.** `enforceBlockGrounding` z `documentBlockContentGenerator.ts` biegnie PRZED `localizePolishValue` (kolejność w pętli: `:112-118` guard bloku, potem `:212` lokalizacja) i ma własną mapę `POLISH_HEADER_TRANSLATIONS` (`:403-421`: `Risk→Ryzyko`, `High→Wysokie`, `Total Budget→Łączny budżet`, `Budget overrun→Przekroczenie budżetu`). Zanim uznasz, że usunięcie tokena z listy „psuje tłumaczenie nagłówków tabel”, sprawdź, czy to tłumaczenie nie zostało już wykonane piętro niżej. Bez tego pomiaru przeszacujesz ryzyko R1 i zrobisz zmianę mniejszą, niż trzeba. ★★ **Piąta: limit dwóch wywołań modelu jest realnym ograniczeniem projektowym R2, nie formalnością.** `fillViaLlm` (`:693-730`) robi `batch.map(...)` po sekcjach — dokument o pięciu sekcjach to pięć wywołań i natychmiastowe złamanie `DEC-317`. Zaprojektuj wejście PRZED uruchomieniem czegokolwiek: jedna albo dwie sekcje, `wantCitations = 0`, outline przekazany wprost (bez `POST /plan` z `useLlm`). I pamiętaj o napięciu, które sam musisz rozstrzygnąć uczciwie: cel „rząd wielkości więcej niż 61 słów” przy jednej sekcji jest ambitny — jeśli nie wyjdzie, podajesz liczbę jaka wyszła i piszesz dlaczego, zamiast dokładać sekcje ponad budżet albo zaokrąglać w górę. ★★ **Szósta: rubryka K1-K6 to TWOJA odpowiedzialność zaprojektowania — w repo nie ma gotowego dokumentu o tej nazwie.** Wzorzec KSZTAŁTU (nie treści): tabela `Kryterium | Wynik` w `CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md` (sekcja „Kryteria K1–K7”) oraz tabela `# | Kryterium | Dowód` w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_78_PPT_RUBRYKA.md` (§C). Nazwij ją w raporcie jawnie jako zaprojektowaną w tym dyżurze — nie cytuj jej jako istniejący dokument. Próg `15/18` z D-8 to OSOBNE kryterium jakości graficznej; jeśli go nie mierzysz, napisz to, zamiast sugerować, że rubryka K1-K6 go zastępuje. ★★ **Siódma: może istnieć TRZECI kasownik.** Dyżur 185 naprawił pierwszy, ten dyżur naprawia drugi — oba znalezione dopiero wtedy, gdy ktoś przeszedł realną ścieżką i otworzył plik. Jeżeli po Twojej naprawie w wygenerowanym DOCX nadal będzie brakowało treści, NIE zamykaj dyżuru zdaniem „naprawione”: policz gniazda, wskaż palcem miejsce w kodzie i zgłoś je jako trzeci defekt do kolejki. Uczciwie opisany wynik częściowy jest tu wart więcej niż okrągła deklaracja.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day190-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day190-drugi-kasownik-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — naprawa heurystyki `obviousEnglish`: polskie zdanie nigdy nie jest kasowane za polskie słowo, nagłówki NIGDY nie dostają placeholdera kasującego; obowiązkowa TABELA wszystkich tokenów listy (token → czy polski → dowód → decyzja). R2 — ★ dowód plikiem przez REALNĄ ścieżkę z LLM (Z15 ZNIESIONE dla tej pozycji, licencja na klucz wzorem dnia 90): brief jednozdaniowy PO POLSKU → DOCX w artefaktach bez `Treść usunięta` i bez `awaiting content`, pełna polska proza, liczby-założenia oznaczone, znacznik dyżuru, policzone słowa (cel: rząd wielkości więcej niż 61 z dnia 90), rubryka K1-K6, mutacja NA GRANICY (stara heurystyka → kasowanie wraca). R3 — regresja: dokumenty angielskie bez zmian ORAZ realny cel heurystyki, czyli angielszczyzna wyciekająca do polskiego dokumentu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6110` albo `5052 i 5053` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6110` albo `5052 i 5053`** (`Z7`).

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

Dyżur 185 naprawił JEDEN z dwóch kasowników treści w Studiu Dokumentów. Odbiór 185
(`docs/program/funkcje/ODBIOR_185_GEN2_STRAZNIK.md`) znalazł DRUGI — i nazwał go
„żywym powodem pustych dokumentów”, priorytet najwyższy w kolejce treści:

> **★★ ODKRYCIE: DRUGIE źródło „Treść usunięta” — żywy powód pustych dokumentów.**
> `documentContentGenerator.ts:135-136,148,182,194,198` — heurystyka `obviousEnglish`
> kasuje POLSKIE zdania za słowo „plan” i wstawia „Treść usunięta” nawet do NAGŁÓWKA
> sekcji (pomiar odbioru przez realną granicę produkcyjną). **→ DYŻUR 190.**

**Mechanizm, zweryfikowany linia po linii na SHA `b4651675f6`** —
`server/src/services/documentStudio/documentContentGenerator.ts`:

```ts
// :112-115 — komunikat zastępczy
const removed =
  language === 'pl'
    ? 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).'
    : 'Content removed — unsupported claim (assumption to verify).';

// :135-136 — heurystyka: 37 tokenów, wśród nich POLSKIE słowa
const obviousEnglish =
  /\b(the|and|for|with|without|required|information|portfolio|financial|constraints?|optimized|resource|allocation|executive|summary|decisions?|risks?|next|steps?|budget|overrun|severity|likelihood|impact|owner|mitigation|total|plan|realization|milestones?|completed|high|medium|low|scope|timing)\b/i;

// :148 — wewnątrz localizePolishValue: JEDEN token = CAŁA wartość zastąpiona
if (obviousEnglish.test(value)) return { value: removed, changed: true };
```

Trzy pozostałe przypisania kasujące, wszystkie w `enforceDocumentSchemaGrounding` (`:102`):

```ts
// :182  if (guardedTitle.changed) next.title = removed;          // TYTUŁ DOKUMENTU
// :194  if (title.changed) section.title = removed;               // TYTUŁ SEKCJI
// :198  if (purpose.changed) section.purpose = removed;           // CEL SEKCJI
```

**Łańcuch do NAGŁÓWKA — to jest sedno, zmierzone i policzone.** W pętli po sekcjach
(`:184`) kolejność jest taka:

```
:185  if (language === 'pl') {
:186      const localizedTitle = localizePolishValue(section.title);   // ← obviousEnglish
:187      section.title = String(localizedTitle.value);                // ← już „Treść usunięta”
:193  const title = guardText(section.title);
:194  if (title.changed) section.title = removed;
...
:211  if (language === 'pl') {
:212      const localized = localizePolishValue(block.content);
:217      if (block.type === 'heading') {
:218          block.content = { text: section.title };                 // ← nagłówek = kasownik
```

Tytuł sekcji przechodzi przez `obviousEnglish` **zanim** ktokolwiek sprawdzi grounding,
a blok `heading` jest do niego przypinany w `:217-218`. Dlatego „Treść usunięta —
niepoparte twierdzenie (założenie do weryfikacji).” trafia do `Heading1`.

**To NIE jest ścieżka premium — to jest granica ostateczna, po KAŻDEJ generacji.**
`enforceDocumentSchemaGrounding` jest wołana z `documentStudioService.ts:1024`, w komentarzu
opisana wprost jako „FINAL grounding boundary. Must remain after every content/prose LLM layer”.
Biegnie zarówno dla `useLlm: true`, jak i dla generacji deterministycznej.

**Pomiar empiryczny heurystyki (wykonany przy pisaniu tej instrukcji, do obalenia przez Ciebie):**

| Zdanie polskie | Wynik `obviousEnglish` |
|---|---|
| `Plan wdrożenia obejmuje trzy fale.` | **KASUJE** — token `Plan` |
| `Plan działania` (tytuł sekcji dnia 90!) | **KASUJE** — token `Plan` |
| `Portfolio inicjatyw obejmuje osiem projektów.` | **KASUJE** — token `Portfolio` |
| `Medium jest przekaźnikiem informacji.` | **KASUJE** — token `Medium` |
| `Nasz plan-B zakłada opóźnienie.` | **KASUJE** — token `plan` |
| `Planujemy wdrożenie w trzech falach.` | zostaje (`\b` nie łapie odmiany) |
| `Realizacja planu wynosi 72%.` | zostaje |
| `Terminowość wdrożeń spadła do 68% w ostatnim kwartale.` | zostaje |

★ **To wyjaśnia wynik dyżuru 90.** Jego jedyna sekcja nazywała się dosłownie
**„Plan działania”** (`CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`, §B.3, wejście dosłowne).
Model napisał `359` tokenów prozy (`LLM call success for openrouter {"tokens":1122,
"completionTokens":359}`), a mimo to plik `A` (z modelem) i `B` (bez modelu) wyszły
identyczne: `61 z 61` słów, `3 z 3` pustych gniazd. **Jeżeli Twój pomiar potwierdzi, że
to `obviousEnglish` skasował tę sekcję, dyżur 190 domyka pytanie zadawane przez
właściciela od miesięcy — „dlaczego nigdy nie powstał ani jeden dobry dokument z szablonu”.**
Zmierz to sam, nie przepisuj tego zdania jako faktu.

**Filozofia naprawy jest już rozstrzygnięta i nie podlega negocjacji.** Decyzja właściciela
D-8 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:29`): „Materiały:
strażnik groundingu → **POLUZOWAĆ + rubryka**; liczby-założenia dopuszczone i **oznaczone**;
jakość pilnowana rubryką `15/18` przy odbiorze pliku.” Dyżur 185 wykonał to dla LICZB
(`unsupportedClaimInString` zwraca dziś `'number' | 'acronym' | false`; dla `'number'`
treść **zostaje**, ustawia się tylko `changed`). Dyżur 190 robi to samo dla JĘZYKA:
polskie zdanie nie może zginąć za polskie słowo.

# 2. TEZY ZLECENIA

Wszystkie poniższe to **rozkaz pomiarowy, nie prawda objawiona**. Obalenie którejkolwiek
jest sukcesem dyżuru i wchodzi do „Korekt wobec instrukcji”.

- **T1.** `obviousEnglish` (`:135-136`) zawiera co najmniej cztery tokeny, które są
  poprawnymi słowami polskimi: `plan`, `portfolio`, `medium`, `total`. Każde polskie
  zdanie zawierające którekolwiek z nich jest kasowane w całości, niezależnie od
  groundingu. Zweryfikuj listę **token po tokenie**, nie na próbce (pułapka „próbka
  zamiast zbioru”).
- **T2.** `localizePolishValue` (a więc i `obviousEnglish`) **NIE URUCHAMIA SIĘ WCALE dla
  dokumentów angielskich** — jedyne trzy wywołania (`:186`, `:189`, `:212`) leżą wewnątrz
  bloków `if (language === 'pl')` (`:185`, `:211`). Jeżeli to prawda, heurystyka nigdy nie
  chroniła dokumentów EN; chroniła **polskie dokumenty przed wyciekiem angielszczyzny
  z modelu**. To zmienia sens R3 — patrz opis pozycji.
- **T3.** Blok `heading` nie ma własnej treści: `:217-218` przypina go do `section.title`.
  Nagłówek nie może więc zostać naprawiony osobno — naprawa musi objąć `section.title`.
- **T4.** `plCanonical` (`:116-134`) tłumaczy 17 kanonicznych etykiet i jest sprawdzane
  PRZED `obviousEnglish` (`:146-147`). Etykiety spoza tej listy — czyli każdy tytuł sekcji
  wymyślony przez użytkownika lub model — idą wprost pod heurystykę.
- **T5.** `enforceBlockGrounding` (z `documentBlockContentGenerator.ts`, po naprawie 185)
  ma WŁASNĄ mapę `POLISH_HEADER_TRANSLATIONS` (`:403-421`) i tłumaczy `Risk→Ryzyko`,
  `High→Wysokie`, `Total Budget→Łączny budżet`. Działa na `block.content` **przed**
  `localizePolishValue` (kolejność: `:212` po `:112-118`). Ustal, ile realnej pracy
  `obviousEnglish` jeszcze wykonuje po tej mapie — być może mniej, niż się wydaje.

# 3. POZYCJE DYŻURU

## R1 — polskie zdanie nigdy nie jest kasowane za polskie słowo

**Cel, dosłownie:** po tej zmianie żadne poprawne zdanie polskie nie może zostać zastąpione
przez `removed` wyłącznie dlatego, że zawiera token z listy `obviousEnglish`. Nagłówki
(`section.title` i blok `heading`) **nigdy** nie dostają placeholdera kasującego — jeśli
uznasz, że tytuł wymaga sygnału, to ma być OZNACZENIE (jak `isAssumption` w D-8), nie
kasowanie.

**Podejście rozstrzygasz Ty, z pomiarem.** Instrukcja NIE narzuca rozwiązania. Trzy
kandydatury, każda z osobnym kosztem — wybierz jedną albo zaproponuj czwartą, ale
uzasadnij wybór liczbą, nie opinią:

1. **Usunięcie polskich tokenów z listy.** Najmniejsza zmiana. Ryzyko: lista jest długa i
   niepełna, jutro dojdzie kolejne słowo (dokładnie wzorzec „naprawa per-wywołanie odrasta”
   z metodyki programu).
2. **Wykrywanie języka CAŁEGO zdania zamiast pojedynczych tokenów** (np. udział tokenów
   angielskich, obecność polskich diakrytyków/końcówek — w repo istnieje już precedens
   kształtu: `POLISH_INTENT_RE` w `documentBlockContentGenerator.ts:401-402`). Większa
   zmiana, ale zamyka klasę defektu, nie egzemplarz.
3. **Rezygnacja z kasowania na rzecz oznaczania** (spójnie z D-8 i z naprawą 185): wartość
   zostaje, ustawiany jest sygnał `changed`/`isAssumption`. Najbliższe filozofii programu,
   ale zmienia kontrakt „polski dokument nie zawiera angielszczyzny”.

**TABELA OBOWIĄZKOWA — bez niej pozycja jest nieukończona.** Każdy z 37 tokenów listy
`obviousEnglish`, w osobnym wierszu, bez skrótów i bez „…”:

| Token | Czy jest słowem polskim? | Dowód (przykład użycia albo wskazanie słownikowe) | Decyzja |
|---|---|---|---|
| `the` | … | … | zostaje / wypada |
| `and` | … | … | … |
| … (wszystkie 37) | … | … | … |

★ Tabela ma mieć tyle wierszy, ile alternatyw w regexie — policz je sam, nie przepisuj
liczby `37` z tej instrukcji (`Z24`). Warianty `constraints?`, `decisions?`, `risks?`,
`steps?`, `milestones?` policz jako jeden token każdy i zaznacz obie formy.

**Rozstrzygnij dodatkowo i zapisz w raporcie:**
- co dzieje się z `:182` (tytuł CAŁEGO dokumentu) i `:198` (cel sekcji) — czy obejmuje je
  ta sama zasada „nagłówek nie ginie”, czy tylko `:194`; uzasadnij granicę;
- czy `changed: true` ma nadal płynąć do `block.isAssumption` (`:214`), gdy zdanie zostaje
  — jeśli wybierzesz wariant 3, TAK jest jedyną odpowiedzią zgodną z D-8;
- czy `removed` (`:112-115`) pozostaje osiągalny w domyślnej konfiguracji; jeśli nie,
  nazwij to wprost, żeby nikt później nie szukał „czemu placeholder nigdy się nie pojawia”.

**Ukończone, gdy:** wywołanie `enforceDocumentSchemaGrounding` na schemacie z `language: 'pl'`,
sekcją o tytule `Plan działania` i akapitem `Plan wdrożenia obejmuje trzy fale: pilotaż,
skalowanie i utrwalenie.` zwraca **oryginalny tytuł i oryginalne zdanie** (nie `removed`),
blok `heading` niesie oryginalny tytuł, tabela 37 tokenów jest w raporcie kompletna, a
`documentPremiumGroundingNormalization.test.ts` jest zielony albo zaktualizowany ze
świadomym uzasadnieniem każdej zmienionej asercji.

## R2 — ★★ DOWÓD PLIKIEM PRZEZ REALNĄ ŚCIEŻKĘ Z LLM

★★ **`Z15` NIE OBOWIĄZUJE W POZYCJI R2. REALNE WYWOŁANIE MODELU JEST WYMOGIEM TEJ
POZYCJI, A NIE NARUSZENIEM. LICENCJA NA KLUCZ — PONIŻEJ.**

To zdanie jest tu, ponieważ dyżur 185 **zatrzymał się właśnie na tym** i miał rację:
wydana mu instrukcja jednocześnie zakazywała modelu (`Z15`) i wymagała go (R2). Jego STOP
był zasadny, błąd był autorski po stronie nadzorcy (`ODBIOR_185_GEN2_STRAZNIK.md`, sekcja
„Plik dowodowy: ocena D — atrapa”). Skutkiem był plik-atrapa: ręczny fixture z zaszytym
`isAssumption`, który omijał naprawiany kod. **Nie powtarzaj tego. Nie buduj fixture'a.**

### Licencja na klucz dostawcy — mechanizm dnia 90, przeniesiony dosłownie

Właściciel udostępnił klucz **OpenRouter**. Leży w pliku poza repozytorium:

```
~/.consultify-openrouter
```

Plik ma jedną linię w postaci `OPENROUTER_API_KEY=<wartość>`.

**Wczytujesz go do środowiska tak i tylko tak — to jest jedyna dozwolona komenda źródłowa:**

```bash
set -a; . ~/.consultify-openrouter; set +a
```

★★ **Nie ma innej dozwolonej drogi.** Nie kopiujesz tego pliku, nie przenosisz go do
repozytorium, nie wpisujesz jego treści do `.env`, `docker-compose*` ani do żadnej komendy.

**`Z40` obowiązuje bez wyjątku:** zakaz wypisania WARTOŚCI klucza gdziekolwiek — w raporcie,
w logu, w komendzie, w komunikacie błędu, w `env`. Każdy pomiar dotykający klucza pokazuje
wyłącznie `obecny`/`nieobecny` albo długość. Komenda nieujawniająca wartości:

```bash
env | sed 's/=.*//' | grep -x 'OPENROUTER_API_KEY' && echo "DOSTAWCA OBECNY" \
  || echo "BRAK ZMIENNEJ DOSTAWCY"
```

**Zmierz dostawcę w OBU miejscach, w tej kolejności** (dyżur 88 stanął, bo mierzył tylko
jedno): (1) **baza** — czy w `llm_providers` Twojej lokalnej bazy jest wiersz z niepustym
`api_key`; zapytanie zwraca WYŁĄCZNIE nazwę dostawcy i `TAK`/`NIE`, nigdy wartość;
(2) **środowisko** — komendą wyżej. Produkt rozwiązuje dostawcę **najpierw z bazy, ze
zmiennych dopiero awaryjnie**. Wiersz w bazie powstaje przez produkcyjną synchronizację
`llmConfigService.initialize() → syncDatabaseWithEnv()` (`llmConfigService.ts:438,445`), nie
przez ręczny `INSERT`.

**Dlaczego akurat OpenRouter:** `llmConfigService.ts:277-311` trzyma platformę domyślnie w
trybie „tylko OpenRouter” — bez `LLM_ENV_SYNC_ALLOWLIST` / `LLM_MULTI_PROVIDER` lista
synchronizowanych dostawców jest jednoelementowa. Klucz Google albo OpenAI zostałby po
cichu pominięty. **Zweryfikuj to sam.**

### ★ TWARDY LIMIT WYWOŁAŃ — i jak się w nim zmieścić

`DEC-2026-08-29-317`: **maksymalnie DWA realne wywołania modelu w całym dyżurze**, zakaz
pętli, zakaz ponawiania. Klucz jest płatny i należy do właściciela.

To nie jest formalność — `fillViaLlm` (`documentBlockContentGenerator.ts:693-730`) robi
**jedno wywołanie NA SEKCJĘ** (`batch.map(...)`, `CONCURRENCY = 3`), plus opcjonalnie
osobne `generateCitations`. Zaplanuj wejście tak, by się zmieścić:

- outline o **jednej lub dwóch** sekcjach (dzień 90 miał jedną — dowód będzie porównywalny);
- **nie** wołasz `POST /api/document-studio/plan` z `useLlm: true` (to zżarłoby budżet) —
  przekazujesz gotowy `outline` do `/generate`;
- `wantCitations` ma być `0`;
- **plik „PRZED” NIE powstaje przez drugą generację.** Bierzesz TEN SAM schemat (ten, który
  model wypełnił) i przepuszczasz go przez STARĄ wersję granicy — patrz mutacja niżej.
  Zero dodatkowych wywołań.

### Wejście

Brief **jednozdaniowy, PO POLSKU**, zapisany w raporcie dosłownie. Ma zawierać słowo, które
dziś kasuje (`plan` / `portfolio` / `medium`) — inaczej dowód nie dotyka naprawianego kodu.
Nie wzbogacaj briefu ponad jedno zdanie: porównywalność z dniem 90 jest częścią dowodu.
W treści umieść **znacznik tego dyżuru** (wzorem `ZNACZNIK-DAY83-…` z dyżuru 83), żeby
w wygenerowanym pliku dało się odróżnić Twój przebieg od cudzego.

### Ścieżka

Pełna, produkcyjna, ta sama co dyżur 90:
`HTTP → ApiGateway → verifyToken → POST /api/document-studio/generate (useLlm: true) →
documentStudioService → enforceDocumentSchemaGrounding → PostgreSQL →
GET /api/document-studio/:artifactId/export/docx`. Trasy: `document-studio.routes.ts:853`
(`/generate`), nagłówek pliku `:5-14`.

Pułapki środowiskowe z dnia 90 stosują się identycznie: `ENABLE_V8_GLOBAL=true`,
`MOCK_DB=false`, `DB_TYPE=postgres`, `ENABLE_TEST_AUTH_BYPASS=false` z podpisanym JWT.
`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'` — jeśli
robisz to z poziomu testu, sprawdź `process.env.DB_TYPE` asercją w pierwszym `it`.

### Co ma zawierać plik

- **ZERO** wystąpień `Treść usunięta` i `Content removed`;
- **ZERO** `This section is awaiting content`, `Key point`, `Signal / Implication / Action`;
- pełna polska proza w każdej sekcji — nie szkielet;
- liczby-założenia oznaczone (mechanizm 185 już scalony: znacznik
  `[Assumption — needs source]`, styl `AssumptionBody`, `documentDocxRenderer.ts:502-510,536-556`);
- nagłówek sekcji z ORYGINALNYM tytułem, nie z komunikatem zastępczym;
- znacznik dyżuru obecny;
- plik ZOSTAJE w katalogu artefaktów, ze ścieżką i `shasum -a 256` w raporcie — to jest
  materiał **do akceptu właściciela**, nie dowód zamknięty w logu.

**Policz słowa.** Dzień 90 dał `61`. Cel: **rząd wielkości więcej**. Podaj liczbę z
mianownikiem i metodę liczenia. Jeżeli wyjdzie mniej — piszesz to wprost i szukasz
trzeciego kasownika; wynik negatywny uczciwie opisany jest wart więcej niż okrągła liczba.

### Rubryka K1-K6

Oceń plik rubryką sześciu kryteriów — **zaprojektuj ją sam**, w kształcie użytym już w
programie (tabela `Kryterium | Wynik` w `CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`;
tabela `# | Kryterium | Dowód` w `INSTRUKCJA_DYZUR_78_PPT_RUBRYKA.md` §C). Sugerowane, nie
narzucone wymiary: K1 każda sekcja ma pełną prozę; K2 zero fraz kasujących i zero
angielskich fraz-widmo; K3 nagłówki poprawne; K4 liczby-założenia widocznie oznaczone;
K5 długość/gęstość treści adekwatna do briefu (z liczbą słów); K6 plik otwiera się bez
błędu w LibreOffice/Word. Żaden wymiar nie może być pominięty milczeniem.

### ★ Mutacja — NA GRANICY, NIE NA PLIKU

Nie generujesz drugiego dokumentu. Bierzesz schemat, który powstał w przebiegu wyżej,
przywracasz starą heurystykę (`obviousEnglish` w kształcie sprzed R1) i przepuszczasz
przez `enforceDocumentSchemaGrounding` **ten sam schemat**. Oczekiwane: kasowanie wraca —
policzalna liczba wystąpień `Treść usunięta` w wynikowym schemacie rośnie z `0` do `N > 0`,
w tym co najmniej jedno w tytule sekcji. Podaj obie liczby z mianownikiem. Po pomiarze
przywracasz naprawioną wersję. **Zero dodatkowych wywołań modelu.**

**Ukończone, gdy:** plik istnieje w artefaktach z SHA-256, otwiera się, zawiera realną polską
prozę bez fraz kasujących, rubryka K1-K6 wypełniona w całości, liczba słów podana, mutacja
na granicy udokumentowana w obie strony.

## R3 — regresja: heurystyka miała swój sens, nie wylewaj dziecka

★ **Uwaga metodyczna, która zmienia kształt tej pozycji.** Zanim napiszesz test EN,
zweryfikuj T2: `localizePolishValue` jest wołane wyłącznie w `:186`, `:189` i `:212`, a
wszystkie trzy leżą pod `if (language === 'pl')` (`:185`, `:211`). **Jeżeli to potwierdzisz,
to `obviousEnglish` NIGDY nie dotykało dokumentów angielskich** — a więc naturalne brzmienie
„EN nadal działa” jest testem trywialnie zielonym, który niczego nie broni.

Prawdziwym celem heurystyki był **wyciek angielszczyzny do polskiego dokumentu** (model
zwraca `Executive Summary` / `Budget overrun` w dokumencie `language: 'pl'`). To jest ta
wartość, której nie wolno stracić. Wykonaj oba testy:

- **R3a — EN bez regresji:** dokument `language: 'en'` przechodzi granicę bez zmian treści.
  Jeśli T2 się potwierdzi, opisz ten test uczciwie jako **potwierdzenie rozłączności**, a nie
  jako dowód braku regresji, którego nie było jak spowodować.
- **R3b — ★ realny cel:** angielskie zdanie w polskim dokumencie nadal jest obsłużone.
  Rozstrzygnij i uzasadnij, co „obsłużone” znaczy po Twojej zmianie: nadal kasowane?
  tłumaczone przez `plCanonical`? oznaczane jak w D-8? Cokolwiek wybierzesz, ma być
  udowodnione testem i nazwane w raporcie jako **świadoma zmiana kontraktu**, nie efekt
  uboczny. Sprawdź przy okazji, ile z tej pracy wykonuje już wcześniej
  `POLISH_HEADER_TRANSLATIONS` (T5).

**Ukończone, gdy:** oba testy istnieją i są zielone; raport nazywa wprost, czy R3a jest
dowodem braku regresji, czy potwierdzeniem rozłączności ścieżek; kontrakt dla angielszczyzny
w polskim dokumencie jest opisany jednym zdaniem, które da się zacytować.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/documentStudio/documentContentGenerator.ts` — WYŁĄCZNIE `obviousEnglish` (`:135-136`), `localizePolishValue` (`:138-171`) i cztery przypisania `= removed` (`:148`, `:182`, `:194`, `:198`) wraz z ich warunkami; oraz `:217-218`, jeśli naprawa nagłówka tego wymaga. Zakaz zmian w `plCanonical` (`:116-134`), w filtrze pustych tabel (`:226-262`) i w bloku `SIGMA-2` (`:265` i dalej) |
| Zapis | `server/src/services/documentStudio/__tests__/documentPremiumGroundingNormalization.test.ts` — aktualizacja asercji, które zmienią sens po R1 (m.in. testy `EPSILON` `:135-207` i `SIGMA` `:209-236`); **zmieniasz oczekiwanie, nie usuwasz testu**, każdą zmianę uzasadniasz w raporcie |
| Zapis | NOWE pliki testowe `day190.*` w `server/src/services/documentStudio/__tests__/` — pełna licencja, z zastrzeżeniem `Z18` i `Z31` |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `GEN-2` (`:149`): dopisujesz wynik dyżuru 190 i korygujesz opis, który dziś mówi „realny DOCX … pozostaje `NOT_PROVEN`, ponieważ wydane `Z15` zakazuje modelu, a R2 go wymaga”. Nie dotykasz `GEN-1`, `GEN-3`, `GEN-4`, `GEN-5` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY190_DRUGI_KASOWNIK_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/documentStudio/documentBlockContentGenerator.ts` — naprawiony i scalony w dyżurze 185 (`unsupportedClaimInString`, `enforceBlockGrounding` `:477-533`, `POLISH_HEADER_TRANSLATIONS` `:403-421`, `GROUNDING_ACRONYM_RULE` `:442`, `POLISH_INTENT_RE` `:401-402`, `fillViaLlm` `:693-730`) |
| Odczyt | `server/src/services/documentStudio/documentStudioService.ts:1013-1035` — wołacz granicy; `server/src/routes/document-studio.routes.ts:853` (`/generate`) i eksport DOCX |
| Odczyt | `server/src/services/documentStudio/documentDocxRenderer.ts` (`buildAssumptionMarker` `:502-510`, `renderParagraphBlock` `:536-556`), `documentPdfRenderer.ts` — mechanizm znacznika; NIE zmieniasz |
| Odczyt | `server/src/services/ai/llmConfigService.ts` (`:277-311` allowlist, `:438,445` sync) — rozwiązywanie dostawcy; NIE zmieniasz |
| Odczyt | `docs/program/funkcje/ODBIOR_185_GEN2_STRAZNIK.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`, `docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` (D-8), `OWNER_DECISION_LEDGER_2026-08-24.md` (`DEC-2026-08-29-327`, `DEC-2026-08-29-317`) |
| Odczyt | `~/.consultify-openrouter` — WYŁĄCZNIE przez `set -a; . ~/.consultify-openrouter; set +a`; nigdy nie wypisujesz zawartości |

**Nietykalne imiennie:** cały `documentBlockContentGenerator.ts` (naprawa 185, scalona);
`GROUNDING_ACRONYM_RULE` i reguła akronimów; kontrakt D-8 i mechanizm `isAssumption` w
rendererach DOCX/PDF oraz w `src/components/DocumentStudio/**`; każdy `MODULE_ACCEPTANCE.md`
poza wierszem `GEN-2` w `11_MATERIALS`.

**Rozłączność z partią równoległą:** ten dyżur dotyka WYŁĄCZNIE granicy językowej w
`documentContentGenerator.ts` i jej testów. Przed pierwszym commitem sprawdź `git log`
gałęzi bazowej, czy któryś z równolegle biegnących dyżurów nie wszedł w ten sam plik — jeśli
tak, zgłoś to jako kolizję zasobową ZANIM zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

- ★★ **`Z15` NIE OBOWIĄZUJE W R2.** Realne wywołanie modelu jest wymogiem tej pozycji.
  Licencja na klucz i jedyna dozwolona komenda źródłowa — w opisie R2. W pozostałych
  pozycjach (R1, R3) modelu nie wołasz w ogóle: tam wystarczą testy na granicy.
- ★★ **`Z40` bez wyjątku:** wartość klucza nie pojawia się nigdzie. `obecny`/`nieobecny`
  albo długość. **Maksymalnie DWA realne wywołania modelu w całym dyżurze**
  (`DEC-2026-08-29-317`), zakaz pętli, zakaz ponawiania. Zaplanuj outline pod ten limit.
- ★★ **`Z31` — ZAKAZ PINOWANIA BAZY W TESTACH.** Wołasz
  `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez
  `expectedDatabase`, bez pinowania hosta, portu ani `DATABASE_URL`. Powód, dosłownie:
  dyżur 43 przypiął strażnika do swojej bazy — po usunięciu kontenera **30 przypadków
  dowodowych stało się trwałym `SKIP`**, a pakiet nadal raportował `exit 0`. To nie był
  odosobniony wypadek: w programie odnotowano **sześć takich incydentów**, a dyżur 193 został
  zamówiony wyłącznie po to, żeby zbiorczo je odpiąć (patrz `97187267a0 fix(day164): unpin
  Z31 DATABASE_URL assertion to any local Postgres`). **Nie dokładaj siódmego.**
- ★ **NIE DOTYKASZ `documentBlockContentGenerator.ts`** poza odczytem. To naprawa dyżuru 185,
  scalona po `FIX-185`. Zmiana „przy okazji” jest dokładnie wzorcem, przed którym ostrzega
  metodyka programu.
- ★ **NIE ZMIENIASZ reguły akronimów** (`GROUNDING_ACRONYM_RULE`) **ani kontraktu D-8**
  (liczby-założenia zachowywane i oznaczane). Jeśli Twoja zmiana wyłączy `isAssumption` dla
  liczb — to jest regresja anty-fabrykacyjna, nie naprawa.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z `-v`. Bez tego wolumen zostaje na dysku
  i po kilku dyżurach kończy się miejsce.
- **Dowód plikiem jest obowiązkowy i nie jest opcjonalny.** Zielony `vitest` nie zamyka R2.
  Fixture z ręcznie zaszytym `isAssumption` **nie jest plikiem dowodowym** — to była ocena
  `D` w odbiorze 185 i drugi raz nie przejdzie.
- **Nie udajesz realnego wywołania przez fallback.** `documentStudioService.ts:1009-1013`
  woła model w trybie best-effort: **każda awaria zwraca deterministyczny schemat bez błędu
  i bez ostrzeżenia**. Dokument powstanie także wtedy, gdy model nie odpowie. Dowodem jest
  log `LLM call success` z realnym `tokens`/`durationMs`, nie `HTTP 200`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie.
- Pułapka: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka:
  `No test files found` **nie jest** `PASS` — sprawdź `numTotalTests > 0`. Pułapka:
  `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów — liczby i **nazwy**
  czytasz z JSON-a (`Z37`: porównania po `fullName`, nigdy po liczbach).
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; port **5037** zajęty przez
  `adb` (serwer Androida) — nie używaj żadnego z nich.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie jest obowiązkowa.** Wypisz w niej wprost:
  czy tabela 37 tokenów jest kompletna czy skrócona; czy T2 (EN nigdy nie przechodził przez
  heurystykę) zmierzyłeś czy założyłeś; czy liczba słów pochodzi z pomiaru czy z oszacowania;
  czy istnieje TRZECI kasownik, którego nie zdążyłeś poszukać. Każde zdanie, którego nie
  zmierzyłeś, ma tu być — brak takiej sekcji jest podstawą odrzucenia dyżuru.

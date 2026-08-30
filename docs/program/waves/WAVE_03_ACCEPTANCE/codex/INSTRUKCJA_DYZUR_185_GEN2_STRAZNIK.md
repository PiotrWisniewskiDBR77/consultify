# INSTRUKCJA DYŻURU nr 185 — Codex — „Materiały GEN-2 — strażnik groundingu przestaje kasować zdania z liczbą-założeniem, zaczyna je oznaczać (D-8), dowód realnym DOCX"

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
> **wyłącznie** `/private/tmp/cx-day185-gen2-straznik`.

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
Zakres: **11_MATERIALS — GEN-2 (silnik treści Document Studio), strażnik groundingu liczb w `documentBlockContentGenerator.ts`**.
Trasy front: `brak zmian frontu wymaganych do tej pozycji — mechanizm oznaczania założeń (`isAssumption` → znacznik `[Assumption — needs source]`) jest JUŻ wpięty end-to-end i działa. Kontekst do odczytu, NIE zmieniasz: `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:221-273` (renderuje `isAssumption`, liczy bloki-założenia), `src/components/DocumentStudio/publicReader/ReaderBlockRenderer.tsx:62` (`<AssumptionTag/>`), `src/components/DocumentStudio/editor/schemaToTipTap.ts:74` i `src/components/DocumentStudio/editor/nodes/payloadAttrs.ts:44-48` (atrybut TipTap `data-is-assumption`)`. Trasy tył: `Generacja: wywołanie generujące PREMIUM sekcje → `documentBlockContentGenerator.ts` `fillViaLlm` (wywołanie LLM) → `normalizeBlockContent` → `enforceBlockGrounding` (`:476-524`) → `unsupportedClaimInString` (`:444-467`) — TU jest zmiana R1. Wynik zapisuje się jako `sections[].blocks[].isAssumption` (`:804`, `documentContentGenerator.ts:209-214` dla ścieżki nie-premium) przez `documentStudioService.ts` do PostgreSQL. Eksport: `exportDocumentArtifact` (`document-studio.routes.ts:4918`) → `documentDocxRenderer.ts` `renderParagraphBlock` (`:536-556`) → `buildAssumptionMarker` (`:502-510`) — TU renderuje się znacznik, już działający kod, nie zmieniasz renderera`.

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
WT=/private/tmp/cx-day185-gen2-straznik
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
git -C "$VAULT" worktree add "$WT" -b codex/day185-gen2-straznik-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day185-gen2-straznik/config.worktree"
cat "$VAULT/worktrees/cx-day185-gen2-straznik/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day185-gen2-straznik-scratch
mkdir -p /private/tmp/cx-day185-gen2-straznik-artefakty

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
git -C "$WT" push github-backup codex/day185-gen2-straznik-20260830
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
cd /private/tmp/cx-day185-gen2-straznik

# (T1) STAN DZISIEJSZY — string z niepopartą liczbą jest KASOWANY, nie oznaczany
sed -n '476,524p' server/src/services/documentStudio/documentBlockContentGenerator.ts
#   oczekiwane: linia 495 `if (unsupportedClaimInString(...))`, linia 497
#   `return groundingPlaceholder(language)` — CAŁY string zastępowany, oryginalna
#   treść znika bezpowrotnie. `changed = true` (linia 496) i tak już płynie do
#   `isAssumption` (linia 804) — ALE treść jest wtedy pusta (placeholder), nie oryginalna.

# (T2) LICZBY-TYPU-NUMBER (nie string) GINĄ BEZ ŻADNEGO ŚLADU
sed -n '487,492p' server/src/services/documentStudio/documentBlockContentGenerator.ts
#   oczekiwane: `if (typeof value === 'number') { if (allowedNumbers.has(...)) return value;
#   changed = true; return undefined; }` — klucz znika z obiektu całkowicie (filter na
#   `undefined` w gałęzi array/object), nawet placeholder go nie zastępuje. Potwierdź, czy
#   ta gałąź w praktyce dotyka realnych bloków (np. wartości KPI) — jeśli tak, R1 musi ją
#   też objąć, nie tylko gałąź string.

# (T3) PRECEDENS — analogiczna kalibracja dla akronimów już poluzowana i przetestowana
sed -n '429,443p' server/src/services/documentStudio/documentBlockContentGenerator.ts
cat server/src/services/documentStudio/__tests__/documentBlockGroundingAcronymRelaxation.test.ts
#   oczekiwane: `GROUNDING_ACRONYM_RULE: GroundingAcronymRule = 'allowed'` z komentarzem
#   "Owner decision 2026-08-29"; test pliku potwierdza PRZEPUSZCZANIE bez zmiany treści.
#   ★ UWAGA: DWA testy w TYM pliku (ok. linii 34-42 i 44-52) dziś asercjują STARE
#   zachowanie liczb (`expect(result.content.text).toBe(PLACEHOLDER)`) — te testy
#   BĘDĄ musiały się zmienić jako część R1 (przestają oczekiwać kasowania, zaczynają
#   oczekiwać oryginalnego tekstu + `changed: true`). Nie jest to regresja telefonu
#   testowego — to jest CEL zmiany.

# (T4) MECHANIZM OZNACZENIA JUŻ ISTNIEJE I DZIAŁA W DOCX — nie projektujesz go od zera
sed -n '502,510p' server/src/services/documentStudio/documentDocxRenderer.ts
sed -n '536,557p' server/src/services/documentStudio/documentDocxRenderer.ts
#   oczekiwane: `buildAssumptionMarker` zwraca TextRun `'  [Assumption — needs source]'`,
#   kursywa, kolor `DOCX_PALETTE.amberInk`; `renderParagraphBlock` dokleja go, gdy
#   `block.isAssumption` jest prawdziwe, i przełącza styl akapitu na
#   `DOCX_STYLE_IDS.ASSUMPTION_BODY`. Ten kod NIE wymaga zmian w tym dyżurze.

# (T5) BRAMKA GEN-2 OPISUJE DZIŚ STARĄ, NIEAKTUALNĄ PRZYCZYNĘ
grep -n 'GEN-2' docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md
#   oczekiwane: opis "awaiting content" — porównaj z realną przyczyną z DEC-2026-08-29-327
#   (`OWNER_DECISION_LEDGER_2026-08-24.md:379`) i dowodem dnia 90; zapisz rozbieżność w raporcie.

# (T6) DECYZJA WŁAŚCICIELA — cytat dosłowny D-8
grep -n 'D-8' docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day185-gen2-straznik-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6094`. Twój JEDYNY port harnessu to `5040 i 5041`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day185-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6068-6079/5010-5029 (dyżury 170-179), 6080-6093/5030-5039 (dyżury 180-184 — NIEUDOKUMENTOWANE w tym checkoucie repo; nie zakładaj, że są wolne, zweryfikuj sam `lsof -i` / `docker ps` przed startem), oraz wzajemnie porty tej trójki równoległej: 6095/5042-5043 (186), 6096/5044-5045 (187). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi wizualnej i brak potrzeby jej wprowadzenia — rozstrzygnięcie i uzasadnienie: (a) to jest zmiana logiki generacji backendowej (który token trafia do `isAssumption`), nie nowy ekran/komponent React; (b) sam znacznik `[Assumption — needs source]` w DOCX (`buildAssumptionMarker`, `documentDocxRenderer.ts:502-510`) już dziś renderuje się produkcyjnie dla bloków bez podpiętego źródła (`documentContentGenerator.ts:490,570` `isAssumption: !hasSources`) — nie jest to nowa powierzchnia wizualna wymagająca prototypu i akceptu wg CLAUDE.md #7, tylko zmiana WARUNKU, który dziś już działający znacznik ustawia; (c) decyzja D-8 („poluzować + rubryka”) jest już jawną decyzją właściciela z 2026-08-30, nie wymaga dodatkowego bramkowania. Potwierdź lub obal to rozumowanie sam w raporcie, nie kopiuj bezkrytycznie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY185_GEN2_STRAZNIK_REPORT.md`. Dopisujesz nowy wpis wyniku dyżuru 185 do wiersza `GEN-2` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` (ok. linii 149) — koryguj OPIS PRZYCZYNY na aktualny (nie "awaiting content", tylko strażnik groundingu liczb) i wynik tego dyżuru; NIE zmieniasz PASS/FAIL innych bramek `GEN-1`/`GEN-3`/`GEN-4`/`GEN-5` w tej samej tabeli. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day185-gen2-straznik-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day185-gen2-straznik-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE PRZEPUSZCZASZ liczb bez śladu — to nie jest ta sama kalibracja co akronimy.** Reguła B (akronimy) 29.08 zaczęła przepuszczać token BEZ oznaczenia (`return false` — `changed` zostaje `false`). D-8 mówi wprost: liczby-założenia mają być "dopuszczone I OZNACZONE" — `changed` MUSI zostać `true` dla zdania z niepopartą liczbą, tak jak dziś, zmienia się WYŁĄCZNIE to, co dzieje się z TREŚCIĄ (zostaje oryginalna, nie placeholder). Jeśli Twoja zmiana sprawi, że `isAssumption` przestanie się ustawiać dla liczb — to jest regresja EPSILON (anty-fabrykacja), nie naprawa. ★★ **NIE DOTYKASZ reguły B (`GROUNDING_ACRONYM_RULE`) ani kodu akronimów** (`:387-441`) — to zamknięta, przetestowana kalibracja z innej decyzji właściciela (29.08); zmiana przy okazji jest dokładnie ryzykiem "naprawa per-wywołanie", przed którym ostrzega metodyka programu. ★★ **NIE ZMIENIASZ kontraktu `enforceBlockGrounding` (nazwa, sygnatura, eksport)** — wywoływany z `documentBlockContentGenerator.ts:799` i pośrednio przez `documentContentGenerator.ts` (inny plik, inna ścieżka nie-premium, ma WŁASNĄ, analogiczną logikę `isAssumption` — NIE zakładaj, że to ten sam kod; sprawdź, czy `documentContentGenerator.ts` ma taki sam defekt kasowania liczb, zanim zdecydujesz, czy jest w zakresie R1). ★★ **DOWÓD PLIKIEM JEST OBOWIĄZKOWY I NIE JEST OPCJONALNY.** Sam zielony test jednostkowy (`vitest`) NIE wystarcza — musisz przejść realną ścieżkę `HTTP → ApiGateway → verifyToken → document-studio → PostgreSQL → DOCX`, dokładnie jak dyżur 90, z prawdziwym wywołaniem LLM (licznik realnych wywołań w logu, nie mock) i zachować plik w katalogu artefaktów. ★★ **NIE UDAJESZ realnego wywołania modelu przez fallback.** Dyżur 90 opisał pułapkę: `STANDARD` bez zsynchronizowanego dostawcy cicho spada na inny tier — potwierdź w logu `LLM call success` z realnym `tokens`/`durationMs`, nie tylko `HTTP 200`. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Bramka `GEN-2` (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md:149`) jest dziś opisana STARĄ, nieaktualną przyczyną („treść sekcji to «This section is awaiting content» po angielsku”) — to NIE jest już prawdziwy powód. Dyżur 90 (`CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`) wykonał uczciwy pomiar: dokument z modelem (A) i bez modelu (B), z tego samego wejścia, wyszły BAJTOWO identyczne po normalizacji — `61 z 61` słów, `3 z 3` pustych gniazd — i wykonawca wywnioskował, że włączenie modelu niczego nie zmienia. Nadzorca obalił ten wniosek w `DEC-2026-08-29-327` (`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:379`): log potwierdza `LLM call success ... tokens:1122, completionTokens:359` — MODEL NAPISAŁ 359 tokenów realnej prozy. Ale `word/document.xml` obu plików zawiera wielokrotnie zdanie „Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).” Źródło zweryfikowane dziś w kodzie (SHA `18661cc6a0`): `documentBlockContentGenerator.ts`, funkcja `enforceBlockGrounding` (`:476`), warunek `unsupportedClaimInString` (`:444-467`) — `QUANT_TOKEN_RE` (`:386`) łapie KAŻDY token liczbowy (`/\d+(?:[.,]\d+)?/g`), a jeśli nie występuje dosłownie w `sourceText` (dla generacji z jednozdaniowego briefu — czyli prawie zawsze), CAŁE zdanie ginie (`visit()`, string branch, `:495-498`) i zostaje zastąpione placeholderem. Dokument doradczy z definicji wprowadza liczby (cele, progi, terminy), których nie ma w briefie użytkownika — każde takie zdanie znika. Właściciel zdecydował dziś (D-8, `DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`): „POLUZOWAĆ + rubryka — dyżur GEN-2: liczby-założenia dopuszczone i oznaczone; jakość pilnowana rubryką 15/18 przy odbiorze pliku”. Precedens tej samej kalibracji już istnieje i DZIAŁA: reguła B (akronimy) została poluzowana 2026-08-29 (`GROUNDING_ACRONYM_RULE = 'allowed'`, `:442`, z pełnym testem `documentBlockGroundingAcronymRelaxation.test.ts`) z dokładnie tym samym uzasadnieniem — strażnik kasował normalną prozę konsultingową (OTD, SLA, WIP, ERP, RCA). Reguła A (liczby) pozostała twarda. Ten dyżur robi dla liczb to, co 29.08 zrobiono dla akronimów — ale zamiast PRZEPUSZCZAĆ bez śladu, OZNACZA jako założenie, bo liczby (w przeciwieństwie do nazw branżowych) są dokładnie tym, co odbiorca raportu doradczego musi móc odróżnić od faktu. |

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
cd /private/tmp/cx-day185-gen2-straznik

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day185-pg psql -U postgres -d cx185 \
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
cd /private/tmp/cx-day185-gen2-straznik

docker run -d --name cx-day185-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx185 \
  -p 127.0.0.1:6094:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day185-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6094/cx185 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6094/cx185 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day185-gen2-straznik && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6094/cx185 \
JWT_SECRET=cx185-test-secret-do-not-reuse \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day185-gen2-straznik-artefakty/day185-documentstudio-grounding.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day185-gen2-straznik && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day185-gen2-straznik-artefakty/day185-documentstudio-grounding.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day185-gen2-straznik/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day185-pg psql -U postgres -d cx185 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day185-pg`.
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
> **(e) ★★ **Pierwsza: dwie różne gałęzie kodu obsługują `isAssumption` i mogą mieć DWA różne defekty, nie jeden.** `documentBlockContentGenerator.ts` (`enforceBlockGrounding`, ścieżka PREMIUM/LLM, `:476-524`) to ten kod, który day90 zmierzył. Ale `documentContentGenerator.ts` ma WŁASNĄ, osobną implementację groundingu (linie `~200-570`, np. `block.isAssumption = block.isAssumption === true || guarded.changed || ...` w `:209-210`) dla innej ścieżki generacji (nie-premium/deterministyczna, z `hasSources`). Zanim napiszesz naprawę, ustal grepem `unsupportedClaimInString\|QUANT_TOKEN_RE` w OBU plikach, czy druga ścieżka ma identyczny defekt kasowania liczb, czy inny mechanizm (np. `isAssumption: !hasSources` bez kasowania treści w ogóle). Naprawa tylko jednej ścieżki, gdy user faktycznie trafia na drugą (np. tryb STANDARD bez LLM), zostawi ten sam objaw. ★★ **Druga: `changed` z `enforceBlockGrounding` dziś miesza DWA różne powody w jednym bicie.** `unsupportedClaimInString` zwraca `true` zarówno dla niepopartej liczby (reguła A, żywa), jak i (gdy `GROUNDING_ACRONYM_RULE === 'enforced'`) dla niepopartego akronimu (reguła B, dziś wyłączona przez stałą, ale KOD wciąż istnieje). Jeśli ktoś kiedyś przywróci `'enforced'`, Twoja naprawa MUSI nadal poprawnie odróżniać "to była liczba" od "to był akronim" — bo D-8 dotyczy WYŁĄCZNIE liczb, nie akronimów (te już są całkowicie przepuszczane, nie oznaczane). Rozważ, czy `unsupportedClaimInString` powinien zwracać więcej niż `boolean` (np. powód), zamiast zgadywać post-hoc w `visit()`. ★★ **Trzecia: placeholder może stać się praktycznie nieosiągalny w domyślnej konfiguracji — to nie jest błąd, ale zasługuje na zdanie w raporcie.** Dziś, przy `GROUNDING_ACRONYM_RULE = 'allowed'`, JEDYNYM powodem `unsupportedClaimInString → true` jest niepoparta liczba. Jeśli R1 sprawi, że liczby też przestają być kasowane (tylko oznaczane), to `groundingPlaceholder()` (`:423-427`) przestaje być kiedykolwiek zwracany w domyślnej konfiguracji — funkcja zostaje jako martwy kod defensywny (żywy tylko przy ręcznym powrocie do `'enforced'`). Nie musisz go usuwać — ale nazwij to wprost w raporcie, żeby ktoś później nie szukał "dlaczego placeholder nigdy się nie pojawia". ★★ **Czwarta: `sourceText` dla generacji z jednozdaniowego briefu jest ekstremalnie ubogi — prawie KAŻDA liczba w wygenerowanej prozie będzie "niepoparta".** To oznacza, że po naprawie R1 zobaczysz DUŻO bloków z `isAssumption: true` w dowodowym pliku — to jest oczekiwany, prawidłowy wynik (odzwierciedla realny brak źródeł w briefie), nie sygnał, że coś jest nie tak. Nie "popraw" tego sztucznie wzbogacając briefa w dowodzie ponad to, co brief metodycznie wymaga (jedno zdanie, jak w dyżurze 90) — inaczej dowód nie jest porównywalny z poprzednim. ★★ **Piąta: rubryka K1-K6 to TWOJA odpowiedzialność zaprojektowania w tym dyżurze — w repo nie ma gotowej, formalnej rubryki jakości pliku Word o tej nazwie.** Wzorzec kształtu (nie treści) do naśladowania: tabela `Kryterium | Wynik` w `CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md` (sekcja "Kryteria K1–K7") oraz tabela `# | Kryterium | Dowód` w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_78_PPT_RUBRYKA.md` (§C, "TWARDE KRYTERIA"). Zbuduj WŁASNĄ rubrykę K1-K6 oceniającą JAKOŚĆ TREŚCI wygenerowanego DOCX (np.: K1 sekcje mają pełną prozę, nie placeholder; K2 liczby-założenia widocznie oznaczone; K3 zero angielskich fraz-widmo w dokumencie PL; K4 znacznik dyżuru obecny; K5 długość/gęstość treści adekwatna do briefu; K6 dokument otwiera się bez błędu w LibreOffice/Word) — użyj jej w raporcie, nazwij ją jawnie jako zaprojektowaną w tym dyżurze, nie jako cytat z nieistniejącego dokumentu.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day185-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day185-gen2-straznik-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — liczba-założenie spoza briefu przestaje kasować całe zdanie, zamiast tego zdanie zostaje z `isAssumption: true`; pozycja R2 — dowód plikiem (realny DOCX z pełną treścią sekcji); pozycja R3 — rubryka jakości pliku K1-K6 w raporcie`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6094` albo `5040 i 5041` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6094` albo `5040 i 5041`** (`Z7`).

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

Silnik prozy Materiałów DZIAŁA — to zmierzony fakt, nie hipoteza. Dyżur 90
(`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`)
przeszedł realną ścieżkę `HTTP → ApiGateway → verifyToken → document-studio → PostgreSQL →
DOCX`, z prawdziwym wywołaniem OpenRouter potwierdzonym licznikiem: `1 z 2` dopuszczonych
wywołań, log `LLM call success for openrouter {"durationMs":4398,"tokens":1122,"completionTokens":359}`.
Model odpowiedział 359 tokenami realnej prozy. Mimo to wynikowy DOCX z modelem (A) i bez modelu
(B), z tego samego wejścia, wyszły **bajtowo identyczne** po normalizacji: `61 z 61` słów, `3 z 3`
pustych gniazd. Wykonawca dyżuru 90 uczciwie zawyrokował: „włączenie modelu niczego nie zmienia”.

**Ten wniosek był błędny — i nadzorca to obalił tego samego dnia.** `DEC-2026-08-29-327`
(`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:379`) odczytał
`word/document.xml` obu plików: zamiast prozy stoi w nim, wielokrotnie, zdanie **„Treść usunięta —
niepoparte twierdzenie (założenie do weryfikacji).”** To nie jest fraza zastępcza generatora ani
„awaiting content” — to jest **strażnik groundingu, który kasuje to, co model napisał**.

Źródło, zweryfikowane dziś w kodzie (SHA `18661cc6a0`) —
`server/src/services/documentStudio/documentBlockContentGenerator.ts`:

```ts
// :386
const QUANT_TOKEN_RE = /\d+(?:[.,]\d+)?/g;

// :444-451 (unsupportedClaimInString)
const numericTokens: string[] = text.match(QUANT_TOKEN_RE) ?? [];
if (numericTokens.some((token) => !allowedNumbers.has(token.replace(',', '.')))) return true;

// :495-498 (visit(), gałąź string, wewnątrz enforceBlockGrounding :476)
if (unsupportedClaimInString(value, allowedNumbers, sourceTextUpper)) {
  changed = true;
  return groundingPlaceholder(language);
}
```

Reguła kasowania: zdanie znika w CAŁOŚCI, jeśli zawiera **jakikolwiek token liczbowy nieobecny
dosłownie w tekście źródłowym** (`sourceText` = intake, dla generacji z jednozdaniowego briefu
to prawie zawsze). Dokument doradczy z definicji wprowadza liczby (cele, progi, terminy), których
nie ma w briefie użytkownika. Każde takie zdanie ginie. Materiał źródłowy przebiegu dyżuru 90 to
`1 z 1` źródło — `intake#explicit-user-brief`. **Model napisał, strażnik wykasował, użytkownik
dostał 61 słów obudowy.** To jest, dosłownie, odpowiedź na zdanie powtarzane przez właściciela od
miesięcy: „nigdy nie powstał ani jeden naprawdę dobry dokument z szablonu”.

**Precedens tej samej kalibracji już istnieje i działa.** Reguła B (akronimy wielkimi literami)
miała identyczny defekt — kasowała normalną prozę konsultingową („OTD”, „SLA”, „WIP”, „ERP”,
„RCA”). Decyzja właściciela 2026-08-29 poluzowała ją do `GROUNDING_ACRONYM_RULE = 'allowed'`
(`:442`), z komentarzem w kodzie wprost cytującym powód, i pełnym testem
(`server/src/services/documentStudio/__tests__/documentBlockGroundingAcronymRelaxation.test.ts`).
Reguła A (liczby) pozostała twarda — **do dziś, do decyzji D-8**.

Właściciel zdecydował (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`, D-8):

> **Materiały: strażnik groundingu → POLUZOWAĆ + rubryka.** Dyżur GEN-2: liczby-założenia
> dopuszczone i oznaczone; jakość pilnowana rubryką 15/18 przy odbiorze pliku.

Różnica wobec reguły B jest istotna: akronimy zaczęły przechodzić **bez śladu**. D-8 mówi
„dopuszczone I OZNACZONE” — liczby mają zostać w tekście, ale z jawnym znacznikiem, że to
założenie do weryfikacji, nie fakt z briefu.

# 2. TEZY ZLECENIA

- **T1.** Mechanizm oznaczenia NIE wymaga projektowania od zera. Kanoniczny atrybut
  `isAssumption` na bloku już istnieje w schemacie (`documentStudioTypes.ts:151`) i już płynie
  end-to-end: DOCX (`documentDocxRenderer.ts:502-510,547,553,574` — `buildAssumptionMarker`,
  tekst `[Assumption — needs source]`, kursywa, kolor bursztynowy), PDF
  (`documentPdfRenderer.ts:572,601`), edytor TipTap (`schemaToTipTap.ts:74`,
  `payloadAttrs.ts:44-48`), czytnik publiczny (`ReaderBlockRenderer.tsx:62`), panel edycji
  (`DocumentStudioDocumentPanel.tsx:221-273`, liczy bloki-założenia). Zmierz to sam przed
  projektowaniem czegokolwiek nowego — jeśli okaże się nieprawdą w którymś miejscu, napisz to
  wprost.
- **T2.** `enforceBlockGrounding` (`documentBlockContentGenerator.ts:476`) już dziś ustawia
  `changed = true` dla niepopartej liczby, i to już płynie do `isAssumption` (`:804`). Jedyne, co
  trzeba zmienić, to CO dzieje się z TREŚCIĄ przy `changed = true` — dziś ginie (placeholder),
  ma zostać oryginalna.
- **T3.** Istnieje druga, osobna implementacja groundingu w `documentContentGenerator.ts`
  (ścieżka nie-premium/deterministyczna) — może mieć inny kształt tego samego defektu, może go
  nie mieć wcale. Zmierz, nie zakładaj identyczności z `documentBlockContentGenerator.ts`.
- **T4.** Wartości liczbowe zapisane jako `typeof value === 'number'` (nie string) giną DZIŚ bez
  ŻADNEGO śladu — nawet bez placeholdera (`:488-491`, `return undefined`). Ustal, czy ta gałąź
  dotyka realnych bloków (np. `kpi.items[].value`, jeśli bywa liczbą a nie stringiem) i czy R1
  musi ją objąć.

# 3. POZYCJE DYŻURU

## R1 — liczba-założenie przestaje kasować zdanie, zaczyna je oznaczać

Zmień zachowanie `enforceBlockGrounding`/`unsupportedClaimInString`
(`documentBlockContentGenerator.ts:444-524`) tak, żeby zdanie zawierające WYŁĄCZNIE niepopartą
liczbę (nie niepoparty akronim — reguła B zostaje jak jest, wyłączona) **zachowało oryginalny
tekst** i ustawiło `isAssumption: true` na bloku, zamiast być zastąpione przez
`groundingPlaceholder()`. Rozstrzygnij i uzasadnij w raporcie:

- czy oznaczasz na poziomie CAŁEGO bloku (jak dziś robi to `changed`/`isAssumption`) czy chcesz
  precyzyjniej wskazać KTÓRĄ liczbę w zdaniu — DOCX/PDF renderer dziś umie oznaczyć tylko cały
  blok (dopisuje znacznik na końcu akapitu), więc oznaczenie per-liczba wymagałoby zmiany
  renderera, co jest POZA zakresem tego dyżuru (zakaz niżej); jeśli wybierzesz oznaczenie
  per-blok, uzasadnij to jako świadomy, minimalny wybór, nie przeoczenie;
- co robisz z gałęzią `typeof value === 'number'` (T4) — czy ten sam mechanizm oznaczenia ma
  tam zastosowanie, czy inny (np. liczba zostaje jako `0`/`null` z jawnym polem obok) — nie
  zostawiaj cichego usuwania klucza bez decyzji zapisanej w raporcie;
- czy `documentContentGenerator.ts` (T3) ma analogiczny defekt i czy wchodzi w zakres tej
  pozycji, czy jest osobnym, świadomie odłożonym zgłoszeniem.

**Ukończone, gdy:** `enforceBlockGrounding({text: 'Terminowość wdrożeń spadła do 68% w ostatnim
kwartale.'}, BRIEF)` (BRIEF bez „68”) zwraca `content.text` RÓWNE oryginalnemu zdaniu (nie
placeholderowi) i `changed: true`; testy w
`documentBlockGroundingAcronymRelaxation.test.ts` zaktualizowane zgodnie z nowym zachowaniem
(dwa testy dziś asercjonujące `PLACEHOLDER` dla liczb — zmień oczekiwanie, nie usuwaj testu);
`GROUNDING_ACRONYM_RULE` i cała reguła B pozostają nietknięte.

## R2 — dowód plikiem: realny DOCX z pełną treścią

Wygeneruj realny DOCX przez tę samą pełną ścieżkę produkcyjną co dyżur 90
(`HTTP → ApiGateway → verifyToken → document-studio → PostgreSQL → DOCX`), z jednozdaniowym
briefem analogicznym do dnia 90 (żeby dowód był porównywalny — nie wzbogacaj briefu ponad to, co
metodycznie wymagane), z REALNYM wywołaniem LLM potwierdzonym licznikiem w logu (nie mockiem, nie
cichym fallbackiem — pułapki Z33 z dnia 90 stosują się identycznie tutaj: `ENABLE_V8_GLOBAL=true`,
`MOCK_DB=false`, `DB_TYPE=postgres`, `ENABLE_TEST_AUTH_BYPASS=false` z podpisanym JWT).

Wymagania pliku:
- pełna treść sekcji (proza modelu), NIE „Treść usunięta…”, NIE „awaiting content”;
- co najmniej jedno zdanie z liczbą-założeniem widocznie OZNACZONE (znacznik
  `[Assumption — needs source]` widoczny w otwartym pliku);
- znacznik tego dyżuru w treści (wzorem `ZNACZNIK-DAY83-…` z dyżuru 83);
- plik ZOSTAJE w katalogu artefaktów (`ARTEFAKTY`), z SHA-256 i ścieżką w raporcie — to jest
  materiał DO AKCEPTU właściciela, nie dowód zamknięty w logu.

Porównaj (tabela w raporcie, wzorem B.3 z dnia 90) plik PRZED (na tej samej gałęzi, przed Twoją
zmianą R1) i PO — liczba słów, liczba pustych gniazd, liczba zdań oznaczonych jako założenie.

**Ukończone, gdy:** plik istnieje w artefaktach, otwiera się bez błędu, zawiera realną prozę i
co najmniej jedno widoczne oznaczenie założenia; tabela porównawcza przed/po w raporcie.

## R3 — rubryka jakości pliku K1-K6

W repo nie ma gotowej, formalnej rubryki jakości pliku Word o nazwie „K1-K6” — zaprojektuj ją
sam, w kształcie analogicznym do precedensów już użytych w programie (tabela `Kryterium | Wynik`
z `CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md` §„Kryteria K1–K7”; tabela `# | Kryterium | Dowód` z
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_78_PPT_RUBRYKA.md` §C). Oceń nią
plik z R2. Sugerowany, nie narzucony, zestaw wymiarów — dostosuj do tego, co faktycznie da się
zmierzyć w pliku:

| # | Kryterium |
|---|---|
| K1 | Każda sekcja ma pełną prozę (nie placeholder, nie pustkę) |
| K2 | Liczby-założenia widocznie oznaczone, nie zniknęły |
| K3 | Zero angielskich fraz-widmo w dokumencie polskojęzycznym |
| K4 | Znacznik dyżuru obecny w pliku |
| K5 | Długość/gęstość treści adekwatna do briefu (nie szkieletowa) |
| K6 | Plik otwiera się bez błędu (LibreOffice/Word) |

Nazwij w raporcie tę rubrykę jawnie jako zaprojektowaną w tym dyżurze, na podstawie wzorców
programu — nie cytuj jej jako istniejący dokument.

**Ukończone, gdy:** wszystkie sześć wymiarów ocenione z uzasadnieniem, żaden nie jest pominięty
milczeniem.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/services/documentStudio/documentBlockContentGenerator.ts` — wyłącznie `unsupportedClaimInString`/`enforceBlockGrounding`/`groundingPlaceholder` (ok. linii 386-524); zakaz zmian w `GROUNDING_ACRONYM_RULE`, `SAFE_BUSINESS_ACRONYMS`, logice akronimów |
| Zapis (warunkowo, ze zgłoszeniem) | `server/src/services/documentStudio/documentContentGenerator.ts` — WYŁĄCZNIE jeśli T3 potwierdzi identyczny defekt w tej samej funkcji odpowiedzialnej za grounding liczb; zgłoś w raporcie PRZED zmianą |
| Zapis | `server/src/services/documentStudio/__tests__/documentBlockGroundingAcronymRelaxation.test.ts` — aktualizacja dwóch testów liczbowych do nowego zachowania (linie ok. 34-42, 44-52); dodanie nowych testów `day185.*` w tym samym katalogu |
| Zapis | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` — wyłącznie wiersz `GEN-2` (ok. linii 149): korekta opisu przyczyny + wynik dyżuru 185 |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY185_GEN2_STRAZNIK_REPORT.md` |
| Odczyt | `server/src/services/documentStudio/documentDocxRenderer.ts` (`buildAssumptionMarker` :502-510, `renderParagraphBlock` :536-556, `DOCX_STYLE_IDS.ASSUMPTION_BODY`) — mechanizm renderowania znacznika; NIE zmieniasz |
| Odczyt | `server/src/services/documentStudio/documentPdfRenderer.ts` (:572,601) — analogiczny mechanizm PDF; NIE zmieniasz |
| Odczyt | `server/src/services/documentStudio/documentStudioTypes.ts:151,757` — kontrakt `isAssumption` w schemacie; NIE zmieniasz |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY90_LLM_DOWOD_PLIKIEM_REPORT.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` (`DEC-2026-08-29-327`), `docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` (D-8) — dowody i decyzja źródłowa; NIE zmieniasz |

**Nietykalne imiennie:** `GROUNDING_ACRONYM_RULE` i cała ścieżka reguły B (akronimy) —
`documentBlockContentGenerator.ts:387-441`; wszystkie pliki renderujące `isAssumption`
(`documentDocxRenderer.ts`, `documentPdfRenderer.ts`, cały `src/components/DocumentStudio/`);
żaden `MODULE_ACCEPTANCE.md` poza wierszem `GEN-2` w 11_MATERIALS.

★ **Rozłączność z dyżurem 186 (ten sam moduł 11_MATERIALS, GEN-4, prezentacje szablonowe):** 186
dotyka WYŁĄCZNIE `server/src/routes/presentations.routes.ts` i
`server/src/services/presentationTemplateRuntimeService.ts` — zero pokrycia z plikami tego
dyżuru. Ten dyżur dotyka WYŁĄCZNIE ścieżki dokumentów Word (`documentBlockContentGenerator.ts`,
`documentContentGenerator.ts`), zero pokrycia z prezentacjami. Zero pokrycia też z dyżurem 187
(Audyty — czyta `documentPdfRenderer.ts`, ale tylko do odczytu, nie zapisu).

# 5. TWARDE ZASADY

- ★ **Liczby-założenia mają być OZNACZONE, nie tylko przepuszczone.** To różni tę kalibrację od
  reguły B (akronimy), która przechodzi bez śladu. `isAssumption: true` musi zostać ustawione dla
  każdego zdania z niepopartą liczbą — jeśli Twoja zmiana przypadkiem wyłączy to oznaczenie, to
  jest regresja anty-fabrykacyjna (EPSILON), nie naprawa.
- **Nie dotykasz reguły B (akronimy)** — zamknięta, przetestowana kalibracja z innej decyzji
  właściciela (29.08). Zmiana przy okazji jest ryzykiem „naprawy per-wywołanie” — jeden fix w
  jednym miejscu psuje inny, niezwiązany kontrakt.
- **Dowód plikiem jest obowiązkowy.** Sam zielony `vitest` nie wystarcza. Musisz przejść realną
  ścieżkę produkcyjną z realnym wywołaniem LLM (licznik w logu) i zostawić plik w artefaktach.
- **Nie udajesz realnego wywołania modelu przez fallback.** Potwierdź w logu `LLM call success`
  z realnym `tokens`/`durationMs`, nie tylko `HTTP 200` na endpoint generacji.
- Pułapka ogólna programu: bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB — dowód R2 MUSI
  być na realnym PostgreSQL.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do żadnego
  serwera pomocniczego.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, na
  `cx-day185-pg`.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE” w raporcie końcowym — wypisz w niej wprost, jeśli
  nie zdążyłeś zmierzyć `documentContentGenerator.ts` (T3), gałęzi liczb-typu-`number` (T4), albo
  jeśli rubryka K1-K6 (R3) nie objęła któregoś wymiaru z braku czasu.

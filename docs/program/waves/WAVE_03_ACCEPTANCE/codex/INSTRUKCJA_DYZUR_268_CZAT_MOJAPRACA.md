# INSTRUKCJA DYŻURU nr 268 — Codex — „★★ KOMPLET ZRZUTÓW CZATU I MOJEJ PRACY POD WERDYKT WŁAŚCICIELA — Czat NIE JEST ekranem listowym (kanon `StandardTable`+`StandardPreview` z `ZNALEZISKO_PODGLAD` nie ma tu bezpośredniego zastosowania — realny render governed proposal potwierdzony na produkcyjnej ścieżce dyżurem 223, ale 8 z 14 zadeklarowanych typów `ChatActionType` jest nieosiągalnych dla użytkownika brakiem producenta w UI, Canvas pozostaje `NO_GO`), Moja Praca JEST hubem z zakładkami i MA ekrany kanoniczne z podglądem nigdy niesfotografowanym jak reszta programu. Oba moduły mają dziś znane, świeżo zmierzone (1.09) przypadki wzorca „zbudowane, ale niepodłączone”: Moja Praca — Form Builder w `IdeaTableTool.tsx:5061-5103` pokazuje „Formularz zapisany” bez wywołania zaplecza i wyrzuca całą konfigurację (dziewiąty potwierdzony przypadek tego wzorca w programie) — sfotografuj TEN STAN uczciwie, nie omijaj go jako „defekt więc nie fotografuję”."

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
> **wyłącznie** `/private/tmp/cx-day268-czat-praca-zrzuty`.

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
Zakres: ****DWA MODUŁY W JEDNYM DYŻURZE: CZAT (`/chat`, `AIChatView`+`UnifiedChatPanel`) i MOJA PRACA (`MyWorkHub.tsx`, route `/my-work`).** Bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we wszystkich 16 kartach modułów (pomiar 1.09). Ten dyżur produkuje MATERIAŁ DO WERDYKTU dla obu modułów naraz: komplet zrzutów, jasny/ciemny, stan pusty/pełny, menu, kebab, **podgląd otwarty PO kliknięciu w wiersz WSZĘDZIE, gdzie kanon `StandardTable`+`StandardPreview` w ogóle występuje** — Czat go NIE UŻYWA jako głównego ekranu (konwersacja, nie tabela), Moja Praca UŻYWA w kilku z 6 zakładek. Zero naprawiania.**.
Trasy front: `CZAT: `src/routes/routeConfig.ts` (`AI_CHAT: '/chat'`, `AI_CHAT_CONVERSATION: '/chat/:conversationId'`) · `src/components/AIChat/UnifiedChatPanel.tsx` · `src/components/AIChat/MessageRenderer.tsx` · `src/components/AIChat/ConversationList.tsx` (sidebar konwersacji — sprawdź w `R1`, czy to kanon `StandardTable`/`StandardPreview` czy bespoke nawigacja) — **UWAGA: `src/components/AIChat/AgentHubShell.tsx` (Run Agent, StandardTable+StandardPreview) JEST POZA ZAKRESEM tego dyżuru — świadomie przeniesiony do modułu 17 wg `DEC-2026-08-25-23`, nie liczy się do żadnego z dwóch modułów tutaj**. MOJA PRACA: `src/components/MyWork/MyWorkHub.tsx` (hub, 6 zakładek: `ideas`/`notebook`/`inbox`/`calendar`/`tasks`/`decisions`, route `/my-work`, plus `?tab=vault`) · `src/components/MyWork/IdeaTableTool.tsx` (Form Builder, defekt zbudowane-niepodłączone, l. 5061-5103) · **ŻADEN dev-render nie montuje pełnego `<MyWorkHub>` — zweryfikowane brakiem trafienia `grep -n "MyWorkHub" dev-render/main.tsx` poza komentarzami etykiet**`. Trasy tył: `brak w zakresie zapisu — dyżur nie zmienia backendu; zasilanie danymi przez istniejące atrapy dev-render lub seed bez modelu językowego (`Z15` — Czat nie woła realnego LLM), nigdy nowy endpoint`.

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
WT=/private/tmp/cx-day268-czat-praca-zrzuty
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
git -C "$VAULT" worktree add "$WT" -b codex/day268-czat-praca-zrzuty-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day268-czat-praca-zrzuty/config.worktree"
cat "$VAULT/worktrees/cx-day268-czat-praca-zrzuty/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day268-czat-praca-zrzuty-scratch
mkdir -p /private/tmp/cx-day268-czat-praca-zrzuty-artefakty

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
git -C "$WT" push github-backup codex/day268-czat-praca-zrzuty-20260901
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

# (1) TEZA: trasy Czatu sa dokladnie dwie: /chat i /chat/:conversationId
grep -n "AI_CHAT:\|AI_CHAT_CONVERSATION:" src/routes/routeConfig.ts
#   oczekiwane: 2 trafienia

# (2) TEZA: governed execution_proposal renderuje sie na realnej sciezce (dyzur 223, potwierdzone)
grep -n "execution_proposal\|Governed execution proposal" docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md
#   oczekiwane: cytat obecny doslownie

# (3) TEZA: 8 z 14 typow ChatActionType jest nieosiagalnych dla uzytkownika (brak producenta w UI)
grep -n "8 z 14\|START_TOOL\|OPEN_PREVIEW" docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md
#   oczekiwane: cytat + lista typow obecne

# (4) TEZA: Canvas pozostaje NO_GO, bez zmiany dzisiaj
grep -n "NO_GO" docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md
#   oczekiwane: co najmniej jedno trafienie w sekcji Czat

# (5) TEZA: AgentHubShell (Run Agent) uzywa PRAWDZIWEGO StandardTable+StandardPreview, ale jest POZA zakresem (modul 17)
grep -n "StandardTable\|StandardPreview" src/components/AIChat/AgentHubShell.tsx | head -5
#   oczekiwane: trafienia obecne — potwierdza pulapke nazwana w PULAPKA_WLASCIWA

# (6) TEZA: MyWorkHub ma dokladnie 6 zakladek
grep -n "id: 'ideas' as ModuleTab\|id: 'notebook' as ModuleTab\|id: 'inbox' as ModuleTab\|id: 'calendar' as ModuleTab\|id: 'tasks' as ModuleTab\|id: 'decisions' as ModuleTab" src/components/MyWork/MyWorkHub.tsx
#   oczekiwane: 6 trafien

# (7) TEZA: zaden dev-render nie montuje pelnego MyWorkHub
grep -n "<MyWorkHub" dev-render/main.tsx
#   oczekiwane: zero trafien

# (8) TEZA (POMIAR 1.09): Form Builder w IdeaTableTool.tsx pokazuje falszywy sukces zapisu bez wolania zaplecza
grep -n "5061-5103\|Form saved\|Formularz zapisany" docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md
#   oczekiwane: cytat obecny doslownie z numerami linii

# (9) TEZA: StandardPreview.tsx nie ma zadnego pozycjonowania nakladkowego
grep -n "fixed\|absolute\|inset-0\|z-50\|z-\[" src/components/standard/StandardPreview.tsx
#   oczekiwane: zero trafien

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day268-czat-praca-zrzuty-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6276`. Twój JEDYNY port harnessu to `5256 i 5257`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day268-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6269, 5010-5249, 6404-6411, 6600-6830. Twoje własne: baza 6276, harness 5256 i 5257. Cudze — siostrzane dyżury TEJ SAMEJ paczki (komplety zrzutów pod werdykt), nie dotykasz: baza 6270 harness 5250-5251 (dyżur 265 Finanse), baza 6272 harness 5252-5253 (dyżur 266 Wyniki), baza 6274 harness 5254-5255 (dyżur 267 Materiały), baza 6278 harness 5258-5259 (dyżur 269 Audyty+Narzędzia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Nadpisania (np. `VITE_ENABLE_LEGACY_C_MODE` dla RACI legacy C-mode, `ENABLE_NOTEBOOK_SPEC_A_SHELL`, `ff_ideaDetailsInPanel`) WYŁĄCZNIE przez env/query na czas zrzutu konkretnego wariantu, nigdy w `.env*` produktu. `ENABLE_TERESA_TOOL_LOOP_WRITE` i wszystko dot. wysyłki/AI zostaje wyłączone (`Z15`, `Z30`) — Czat fotografujesz z SEEDOWANYMI wiadomościami, nie z realnym wywołaniem modelu. `Z10` obowiązuje bez wyjątku poza jawnie nazwanymi wariantami zrzutu.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY268_CZAT_PRACA_ZRZUTY_REPORT.md`. Brak innych dokumentów do modyfikacji. Jedyny plik zapisu w repo to raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY268_CZAT_PRACA_ZRZUTY_REPORT.md` plus nowy plik `dev-render/screens/day268-mywork-hub-zrzuty.tsx` (jeśli `R3` potwierdzi brak) i dwa nowe skrypty `scripts/dev/day268-czat-zrzuty-werdykt.mjs` / `scripts/dev/day268-mojapraca-zrzuty-werdykt.mjs` — zero nowych dokumentów rejestrowych. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day268-czat-praca-zrzuty-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day268-czat-praca-zrzuty-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK** — Form Builder, 8 nieosiągalnych typów akcji czatu, Canvas NO_GO: opisujesz, nie łatasz. **ZAKAZ wołania modelu językowego** (`Z15`) — Czat fotografujesz WYŁĄCZNIE z seedowanymi `conversation_messages`, jak w dyżurze 223. **ZAKAZ prób „odblokowania” Canvas albo tool-loop write** — pozostają `NO_GO`/nieosiągalne, fotografujesz to jako fakt (ekran niedostępny + powód), nie próbujesz obejść. **ZAKAZ fotografowania `AgentHubShell`/Run Agent** — poza zakresem obu modułów (`DEC-2026-08-25-23`). **ZAKAZ fotografowania spoza tych dwóch modułów.** | Zmierzone 1.09: bramka „moduł zaakceptowany i zaczekpointowany” ma status NIEROZPOCZĘTY we WSZYSTKICH 16 kartach modułów. Ten dyżur (jeden z pięciu — 265 Finanse, 266 Wyniki, 267 Materiały, 268 Czat+Moja Praca, 269 Audyty+Narzędzia) produkuje materiał do werdyktu. Reguła nienaruszalna z `CLAUDE.md` p.7: właściciel NIGDY nie jest pierwszym testerem wizualnym. Dodatkowa pilność: oba moduły mają dziś świeżo zmierzone (1.09, `docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md`) przypadki wzorca „zbudowane, ale niepodłączone” — Moja Praca dostała dziewiąty potwierdzony przypadek tego wzorca w CAŁYM programie (Form Builder), a Czat ma udokumentowaną listę 8 z 14 typów akcji nieosiągalnych dla użytkownika. Komplet zrzutów bez uczciwego pokazania TYCH stanów byłby niepełnym dowodem — właściciel musi zobaczyć „Formularz zapisany” obok utraconej konfiguracji, nie tylko ekrany, które wyglądają dobrze. |

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
cd /private/tmp/cx-day268-czat-praca-zrzuty

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day268-pg psql -U postgres -d cx268 \
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
cd /private/tmp/cx-day268-czat-praca-zrzuty

docker run -d --name cx-day268-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx268 \
  -p 127.0.0.1:6276:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day268-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6276/cx268 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6276/cx268 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day268-czat-praca-zrzuty && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6276/cx268 \
JWT_SECRET=cx268-test-secret-do-not-reuse \
npx vitest run scripts/dev/__tests__/day268-czat-praca-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day268-czat-praca-zrzuty-artefakty/day268-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day268-czat-praca-zrzuty && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run scripts/dev/__tests__/day268-czat-praca-zrzuty-werdykt.test.mjs --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day268-czat-praca-zrzuty-artefakty/day268-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day268-czat-praca-zrzuty/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day268-pg psql -U postgres -d cx268 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day268-pg`.
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
> **(e) ★★ CZAT NIE JEST EKRANEM LISTOWYM — reguła `ZNALEZISKO_PODGLAD` (klik→dwa zrzuty, cztery przy nakładce) dotyczy KANONU LIST (`StandardTable`+`StandardPreview`), a Czat jest widokiem konwersacji. Nie próbuj na siłę „znaleźć podglądu” w Czacie tam, gdzie go strukturalnie nie ma — zamiast tego zastosuj analogiczną zasadę do tego, co Czat FAKTYCZNIE ma: listę konwersacji (sidebar) → klik → wątek. Rozstrzygnij mechanicznie w `R1`, czym jest `ConversationList.tsx` (kanon czy bespoke), zanim napiszesz, że reguła go dotyczy lub nie. **Druga pułapka — Run Agent (`AgentHubShell.tsx`) używa PRAWDZIWEGO StandardTable+StandardPreview i ŁATWO pomylić go z Czatem (mieszka w `src/components/AIChat/`), ale jest ŚWIADOMIE poza zakresem obu modułów tego dyżuru** (`DEC-2026-08-25-23`, moduł 17) — nie fotografuj go tutaj, nawet jeśli harness go pokaże przy okazji. **Trzecia pułapka — Moja Praca ma DZIEWIĘĆ potwierdzonych przypadków wzorca „zbudowane, ale niepodłączone” w programie, ósmy i dziewiąty zmierzone DZISIAJ** (Inicjatywy — załączniki; Moja Praca — Form Builder). Fotografując Form Builder w stanie „po Zapisz”, zrzut MUSI pokazać zarówno toast „Formularz zapisany” JAK I fakt, że po ponownym otwarciu formularz jest znowu pusty — jeden zrzut tego nie udowodni, potrzebujesz PARY (przed zamknięciem / po ponownym otwarciu), zaznaczonej w tabeli `R4` jako dowód defektu, nie jako zwykły stan „pełny”.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day268-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day268-czat-praca-zrzuty-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (inwentarz Czatu: trasy, ConversationList, governed proposal, 8/14 typów akcji, Canvas/tool-loop status) · R2 (wykonanie zrzutów Czatu, seed bez LLM, dowód realności) · R3 (inwentarz Mojej Pracy: 6 zakładek + Ideas×4 narzędzia + Vault, harness pełnego huba, kontrola kształtu atrapy, para dowodowa Form Builder) · R4 (wykonanie zrzutów Mojej Pracy) · R5 (raport wspólny + katalog zrzutów + dwie tabele + lista niefotografowalnych)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6276` albo `5256 i 5257` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6276` albo `5256 i 5257`** (`Z7`).

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
Narzędzia) produkuje **MATERIAŁ DO WERDYKTU** dla DWÓCH modułów naraz: Czat i
Moja Praca. **Nic więcej. Zero naprawiania.**

**Reguła nienaruszalna** (`CLAUDE.md` p.7): właściciel NIGDY nie jest
pierwszym testerem wizualnym.

## Czat nie jest ekranem listowym — nie stosuj reguły podglądu mechanicznie

`docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` mówi o
KANONIE LIST (`StandardTable`+`StandardPreview`). **Czat jest widokiem
konwersacji**, nie listą — reguła „klik w wiersz → dwa/cztery zrzuty” nie ma
tu bezpośredniego, mechanicznego zastosowania. Zamiast improwizować, `R1`
każe rozstrzygnąć MECHANICZNIE, czym jest `ConversationList.tsx` (sidebar
konwersacji) — jeśli to kanoniczny komponent listy, reguła stosuje się wprost;
jeśli bespoke nawigacja, dokumentujesz to jako odrębny przypadek z własnym
uzasadnieniem, nie „nie dotyczy” z pamięci.

**Co Czat MA i co jest już zmierzone dziś (1.09,
`docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md` §2):**

- Governed proposal (`execution_proposal`) renderuje się na REALNEJ ścieżce
  produkcyjnej — potwierdzone dyżurem 223 (seed `conversation_messages`, bez
  modelu językowego, realne logowanie, `/chat/:conversationId`, zrzuty
  light/dark z różnicą jasności 224,9). **Nie klikano** `Approve`/`Reject`/
  `View run` w tamtym dyżurze — dowodzi renderu karty, nie cyklu życia.
- **11 „widm” akcji czatu** (typy zadeklarowane w `ChatActionType` bez
  producenta) po wygaszeniu trzech (`CREATE_TASK`/`CREATE_DECISION`/
  `CREATE_INITIATIVE`, dziś realnie produkowane przez governed warianty)
  zostało **8 z 14 typów akcji nieosiągalnych dla użytkownika** — nigdy się
  nie pojawią, bo nic ich nie tworzy. Fotografuj to jako fakt: te 8 typów
  **NIE WCHODZI** do kompletu zrzutów jako „ekran do sfotografowania” — wchodzi
  do listy niefotografowalnych z powodem „brak producenta w UI”.
- **Canvas pozostaje `NO_GO`** — nie próbuj go odblokować ani sfotografować
  pełnej ścieżki, której nie ma. Fotografuj punkt wejścia (jeśli widoczny w
  UI) jako „nieosiągalny, powód: NO_GO, DoD 5/16 dyżur 110”.
- **Tool-loop write Teresy nieosiągalny domyślnie** — flaga OFF i tak nie
  dociera do serwera przez `childEnv(...)` nawet gdy przekazana. Nie próbuj
  tego obejść (`Z15`/`Z30`).
- **Feed Sygnałów pusty z definicji** — `KNOWN_DECISION`, nie defekt.

**Run Agent (`AgentHubShell.tsx`) jest POZA ZAKRESEM** mimo że mieszka w
`src/components/AIChat/` i używa PRAWDZIWEGO `StandardTable`+`StandardPreview`
— świadomie przeniesiony do modułu 17 (`DEC-2026-08-25-23`). Sprawdź komendą
(5), że to jest realny kanon — ale **nie fotografujesz go w tym dyżurze.**

## Moja Praca — dziewiąty potwierdzony przypadek „zbudowane, ale niepodłączone”

`docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md` §3.4-5.1:
Form Builder w `IdeaTableTool.tsx:5061-5103` (narzędzie Tabel Idei) pokazuje
`toast.success('Form saved')` **bezwarunkowo**, nie woła zaplecza mimo że
realne API formularzy istnieje i jest gotowe (`tablePlatform.api.ts:796-834`).
Skutek: użytkownik konfiguruje formularz, klika Zapisz, widzi „Formularz
zapisany” — **cała konfiguracja jest wyrzucana**, po ponownym otwarciu widzi
znowu pusty formularz domyślny.

**To jest DZIEWIĄTY potwierdzony przypadek tego wzorca w całym programie**
(ósmy — Inicjatywy, załączniki, `AttachmentsSection.tsx:25-33`). Ten dyżur ma
obowiązek **sfotografować ten stan uczciwie** — PARĄ zrzutów (po kliknięciu
Zapisz z widocznym toastem / po ponownym otwarciu z pustym formularzem), nie
jako zwykły „stan pełny”, tylko jako jawnie oznaczony dowód defektu w tabeli
`R5`. **Nie naprawiasz go** — opisujesz.

## Braki harnessu — zmierzone, nie założone

`grep -n "<MyWorkHub" dev-render/main.tsx` daje **zero trafień** — żaden
istniejący fragment montuje pełny hub z 6 zakładkami naraz. Fragmenty
istniejące (`mywork-idea-inspector-lekki`, `mywork-notebook-rail-speca`,
`mywork-inbox`, `mywork-calendar`, `mywork-idea-topbar`,
`crimson-mywork-wave2` i in.) pokrywają POJEDYNCZE powierzchnie. `R3` ma to
potwierdzić i albo zbudować jeden nowy harness huba, albo uzasadnić
fotografowanie fragment-po-fragmencie zamiast jednego wspólnego ekranu.

## Co ten dyżur świadomie NIE robi

- **Nie naprawia** Form Buildera, brakującej konwersji Idea→Note, AI Advice
  (nie istnieje w kodzie — nie próbuj go sfotografować, to nie „ukryty
  ekran”, to nieistniejąca funkcja).
- **Nie odblokowuje** Canvas ani tool-loop write.
- **Nie fotografuje Run Agent/`AgentHubShell`** — poza zakresem.
- **Nie wywołuje modelu językowego** (`Z15`).
- **Nie fotografuje innych modułów.**

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Trasy Czatu to dokładnie `/chat` i `/chat/:conversationId` | komenda (1) |
| T2 | Governed `execution_proposal` renderuje się na realnej ścieżce (potwierdzone dyżurem 223) | komenda (2) |
| T3 | 8 z 14 typów `ChatActionType` jest nieosiągalnych dla użytkownika | komenda (3) |
| T4 | Canvas pozostaje `NO_GO` | komenda (4) |
| T5 | `AgentHubShell` (Run Agent) używa prawdziwego StandardTable+StandardPreview, ale jest poza zakresem tego dyżuru | komenda (5) |
| T6 | `MyWorkHub.tsx` ma dokładnie 6 zakładek | komenda (6) |
| T7 | Żaden dev-render nie montuje pełnego `MyWorkHub` | komenda (7) |
| T8 | Form Builder w `IdeaTableTool.tsx:5061-5103` pokazuje fałszywy sukces zapisu | komenda (8) |
| T9 | `StandardPreview.tsx` nie ma pozycjonowania nakładkowego | komenda (9) |
| T10 | Miejsce na dysku wystarcza | komenda (10) |

---

# 3. POZYCJE DYŻURU

## R1 — INWENTARZ CZATU (rdzeń, pomiarowy)

1. Rozstrzygnij mechanicznie: `ConversationList.tsx` — kanon czy bespoke
   (pozycjonowanie, `StandardTable` import czy nie).
2. Wypisz WSZYSTKIE zadeklarowane typy `ChatActionType` (14) z kolumną
   producent tak/nie, cytując `docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md`
   §2.2 i weryfikując samodzielnie grepem po `aiActionExecutor.ts`.
3. Zlokalizuj punkt wejścia do Canvas w UI (jeśli widoczny) — sfotografuj
   TYLKO ten punkt wejścia, nie próbuj przejść dalej.
4. Zbuduj tabelę **ekran/stan Czatu × osiągalny (tak/nie) × powód**.

## R2 — WYKONANIE ZRZUTÓW CZATU (rdzeń, dowodowy)

1. Seed `conversation_messages` bez modelu językowego (wzorem dyżuru 223) —
   pusta konwersacja, konwersacja z wiadomościami zwykłymi, konwersacja z
   governed `execution_proposal`.
2. Klik→zrzut dla listy konwersacji → wątku, jeśli `R1.1` potwierdza kanon
   listy; w przeciwnym razie zwykłe dwa zrzuty (jasny/ciemny) stanu otwartego
   wątku, z uzasadnieniem w raporcie dlaczego reguła klik→zrzut nie miała tu
   zastosowania.
3. Stan pusty (brak konwersacji) i pełny (co najmniej jedna z każdego typu
   wiadomości) osobno.
4. Zrzut Feedu Sygnałów w stanie pustym z adnotacją „pusty z definicji,
   `CHAT-OR-20260829-003`, nie defekt”.
5. Dwa selektory obecności karty `execution_proposal` w DOM przed zrzutem
   (nie stały czas).
6. Dowód realności: mutacja widocznego elementu `MessageRenderer.tsx` (na
   kopii), zrzut, cofnięcie, zrzut.
7. Zapisz do `/private/tmp/cx-day268-czat-praca-zrzuty-artefakty` z `shasum -a 256`.

## R3 — INWENTARZ MOJEJ PRACY + HARNESS + KONTROLA ATRAPY (rdzeń, pomiarowy i dowodowy)

1. Dla każdej z 6 zakładek (`ideas`, `notebook`, `inbox`, `calendar`, `tasks`,
   `decisions`) + `?tab=vault`: kanon czy bespoke, `plik:linia`. Ideas
   rozbija się na **4 narzędzia** (per pomiar 1.09) — wypisz je imiennie.
2. Jeśli `R1`(sic, czytaj: potwierdzenie z sekcji 1 wyżej) potwierdza brak
   pełnego huba — napisz `dev-render/screens/day268-mywork-hub-zrzuty.tsx`
   montujący REALNY `<MyWorkHub>`, `&tab=` dla wszystkich 6 zakładek +
   `vault`, `&state=ready|empty|loading|error`. Zarejestruj go w
   `dev-render/main.tsx` — **wyłącznie DOPISANIEM** jednego lazy importu i
   jednego wpisu klucza na końcu listy, zero zmiany istniejących wpisów.
   **Uruchom `scripts/dev/check-devrender-main.sh` i wklej pełny wynik do
   raportu** — zielony wynik jest warunkiem przejścia do `R4`.
3. Kontrola kształtu atrapy (`KSZTALT_21`) dla każdej zakładki — porównaj
   pola atrapy z realnym kontraktem backendu, `plik:linia` obu stron.
4. Dowód mutacyjny narzędzia: mutacja widocznego elementu huba, zrzut,
   cofnięcie.

## R4 — WYKONANIE ZRZUTÓW MOJEJ PRACY (rdzeń, dowodowy)

1. Klik→zrzut dla wszystkich zakładek kanonicznych — dwa zrzuty standardowo,
   cztery przy mechanicznie potwierdzonej nakładce.
2. **Para dowodowa Form Buildera** (`R1` sekcja 1 wyżej): zrzut zaraz po
   kliknięciu „Zapisz” z widocznym toastem sukcesu + zrzut po ponownym
   otwarciu tego samego formularza pokazujący pustą konfigurację. Oznacz
   jawnie w tabeli `R5` jako „dowód defektu MYW-FORM-BUILDER, nie stan pełny”.
3. Stan pusty/pełny dla każdej zakładki, każda osobno.
4. Dwa selektory wyniku dla operacji asynchronicznych.
5. `checkScreenshotPairState` z wymogiem obecności wyniku gdzie dotyczy.
6. Zapisz do `/private/tmp/cx-day268-czat-praca-zrzuty-artefakty` z `shasum -a 256`.

## R5 — RAPORT WSPÓLNY + KATALOG ZRZUTÓW + DWIE TABELE (rdzeń)

Jeden raport, dwie sekcje (Czat / Moja Praca), każda z: katalogiem zrzutów,
tabelą ekran/stan/jasność×2/opis/podgląd-w-kadrze, listą niefotografowalnych
z powodem (w tym 8 typów akcji czatu i Canvas). Dodatkowo: wiersz dowodowy
Form Buildera oznaczony osobno od zwykłych stanów. „Twierdzenia
niezweryfikowane” (obowiązkowa nawet pusta), „Korekty wobec instrukcji”
(obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWE) | `dev-render/screens/day268-mywork-hub-zrzuty.tsx` (nowy, jeśli `R3.2` potwierdzi potrzebę) · `scripts/dev/day268-czat-zrzuty-werdykt.mjs` (nowy) · `scripts/dev/day268-mojapraca-zrzuty-werdykt.mjs` (nowy) · `scripts/dev/__tests__/day268-czat-praca-zrzuty-werdykt.test.mjs` (nowy) |
| Zapis (WĄSKO) | `dev-render/main.tsx` — WYŁĄCZNIE dopisanie jednego lazy importu + jednego wpisu klucza na końcu listy, zero zmiany/usunięcia istniejących wpisów; `scripts/dev/check-devrender-main.sh` obowiązkowy po zmianie |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY268_CZAT_PRACA_ZRZUTY_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `src/components/AIChat/**` · `src/components/Chat/**` · `src/components/MyWork/**` · `src/components/standard/StandardPreview.tsx` · `src/routes/routeConfig.ts` · `src/routes/AppRoutes.tsx` |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/ZNALEZISKO_PODGLAD_NIGDY_NIE_FOTOGRAFOWANY.md` · `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md` · `docs/program/funkcje/KSZTALT_21_ATRAPA_UWIARYGODNIA_DEFEKT.md` · `docs/functional/POMIAR_2026-09-01_AUDYTY_CZAT_PRACA_PARTNER.md` · `docs/program/funkcje/ODBIOR_ZALACZNIKI_INICJATYW.md` · `scripts/dev/lib/checkScreenshotPairState.mjs` · `scripts/dev/lib/meanLuma.mjs` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK** — w tym Form Buildera.
- ★★ **ZAKAZ WOŁANIA MODELU JĘZYKOWEGO** (`Z15`) — Czat wyłącznie z seedem.
- ★★ **RUN AGENT (`AgentHubShell`) JEST POZA ZAKRESEM** mimo że mieszka w tym
  samym katalogu co Czat — nie fotografuj go tutaj.
- ★★ **FORM BUILDER FOTOGRAFUJESZ JAKO PARĘ DOWODOWĄ, JAWNIE OZNACZONĄ**, nie
  jako zwykły stan pełny — inaczej zrzut fałszywie uwiarygodni defekt
  (dokładnie kształt `KSZTALT_21`, tylko bez atrapy — tu defekt jest w
  realnym kodzie produkcyjnym).
- ★★ **PARA JASNY/CIEMNY MUSI POKAZYWAĆ TEN SAM STAN** (`KSZTALT_19`).
- ★★ **ATRAPA MA MIEĆ KSZTAŁT SERWERA, NIE FRONTU** (`KSZTALT_21`) — dla
  Mojej Pracy, wszystkie zakładki kanoniczne.
- ★ **8 TYPÓW AKCJI CZATU I CANVAS NIE SĄ „NIE ZDĄŻYŁEM” — SĄ NIEOSIĄGALNE Z
  DEFINICJI.** Wpisz je do listy niefotografowalnych z konkretnym powodem,
  nie próbuj ich obejść.
- ★ **KAŻDA ZAKŁADKA MOJEJ PRACY OSOBNO.**
- ★ **DOWÓD REALNOŚCI OBOWIĄZKOWY DLA OBU MODUŁÓW.**
- ★ **`scripts/dev/check-devrender-main.sh` OBOWIĄZKOWY PO KAŻDEJ ZMIANIE
  `dev-render/main.tsx`.**
- ★ **`Z13`:** zrzuty i logi w `/private/tmp/cx-day268-czat-praca-zrzuty-artefakty`, nie w repo.
- ★ **PUSZ WYŁĄCZNIE NA `github-backup`.**
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” OBOWIĄZKOWA.**

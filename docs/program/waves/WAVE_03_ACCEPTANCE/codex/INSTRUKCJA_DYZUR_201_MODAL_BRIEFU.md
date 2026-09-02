# INSTRUKCJA DYŻURU nr 201 — Codex — „Modal briefu prezentacji — domknięcie GEN-4 R2: dwa żywe wejścia UI wyboru szablonu dostają pytanie „O czym ma być ta prezentacja?” zamiast cicho lecieć na placeholdery"

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
> **wyłącznie** `/private/tmp/cx-day201-modal-briefu`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `60581ed6b5`**
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
Zakres: **11_MATERIALS — GEN-4, domknięcie pozycji R2 (front-end źródło briefu), kontynuacja dyżuru 186 (backend SCALONO, mapper już przyjmuje `brief`); decyzja właściciela D-10 (`DECYZJE_WLASCICIELA…`): modal TERAZ, ścieżka Teresa/czat = osobny dyżur 203, POZA zakresem**.
Trasy front: ``src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` (`handleTemplateClick`, linie 148-154 — gałąź `else` bez `promptOverride` to jedyna gałąź w zakresie; gałąź `if (promptOverride)`, linie 149-150, to ODRĘBNY mechanizm kart wbudowanych, NIE dotykasz), plus nowy render modala w drzewie JSX komponentu (zwrot `ArtifactModuleHome`, ok. linii 166-254); `src/components/ReportsAndPresentations/TemplatesTabContent.tsx` (sześć miejsc, WSZYSTKIE identyczny wzorzec `const usePath = resolveUsePath(x); if (usePath) navigate(usePath);` — linie 391-406 `buildRowMenu` akcja `use`, 500-503 `previewActions` akcja `use`, 685-688 `GridView.onItemAction('open')`, 716-720 `StandardTable.onRowDoubleClick`, 745-748 `TemplatesGalleryView.onUse`, 758-761 `StandardPreview.onOpenFull` — scalasz w JEDNĄ funkcję `handleUseTemplate`, gałąź modala TYLKO gdy `row.type === 'presentation'`); nowy plik `src/components/shared/PresentationBriefModal.tsx` (wzorzec klas: `src/components/DocumentStudio/editor/useManualPrompt.tsx`, CAŁY plik — ZERO nowego designu, kopiujesz klasy 1:1); `public/locales/en/translation.json` i `public/locales/pl/translation.json` (nowe klucze WYŁĄCZNIE pod istniejącym węzłem `kimi.artifactHome` — en ok. linii 25444, pl ok. linii 26939, potwierdź grepem przed edycją, bo numer linii dryfuje)`. Trasy tył: `brak — dyżur 186 (SCALONO, `ODBIOR_186_GEN4_TRESC.md`) już domknął `POST /presentations/decks/from-template` → `brief` → mapper; ten dyżur NIE dotyka `server/**`, wyłącznie dostarcza `templatePrompt` do istniejącego, działającego mechanizmu URL→`brief` w `PrezentacjeView.tsx:469-470` (odczyt, nie zapis)`.

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
WT=/private/tmp/cx-day201-modal-briefu
MARKER=60581ed6b5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day201-modal-briefu-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day201-modal-briefu/config.worktree"
cat "$VAULT/worktrees/cx-day201-modal-briefu/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day201-modal-briefu-scratch
mkdir -p /private/tmp/cx-day201-modal-briefu-artefakty

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
git -C "$VAULT" log --oneline 60581ed6b5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 60581ed6b5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day201-modal-briefu-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 60581ed6b5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day201-modal-briefu

# (T1) PUNKT WEJŚCIA 1 — ArtifactModuleHome, gałąź BEZ promptu (jedyna w zakresie)
sed -n '144,158p' src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx
#   oczekiwane: `handleTemplateClick`; `if (promptOverride) {...} else { navigate(`${meta.route}?templateArtifactId=...`) }`
#   linia 152 = gałąź `else` (BEZ promptu) — TA jest w zakresie. Gałąź `if (promptOverride)`
#   (linie 149-150, karty wbudowane z generycznym promptem "Stwórz: X. Y.") NIE jest w zakresie.

# (T2) PUNKT WEJŚCIA 2 — TemplatesTabContent, sześć identycznych triggerów jednej funkcji
grep -n 'const usePath = resolveUsePath\|if (usePath) navigate(usePath)\|onOpenFull:\|onUse:\|onRowDoubleClick' src/components/ReportsAndPresentations/TemplatesTabContent.tsx
#   oczekiwane: 6 miejsc (buildRowMenu 'use', previewActions 'use', GridView onItemAction 'open',
#   StandardTable onRowDoubleClick, TemplatesGalleryView onUse, StandardPreview onOpenFull) —
#   wszystkie wywołują `resolveUsePath` + `navigate`, zero logiki pośredniej dziś.

# (T3) MECHANIZM ODBIORU — templatePrompt→brief, NIE dotykasz, tylko potwierdzasz że działa
sed -n '150,155p;454,492p' src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx
#   oczekiwane: `templatePrompt = searchParams.get('templatePrompt')` (linia ok. 154);
#   `brief: templatePrompt || undefined` (linia ok. 470) wewnątrz efektu auto-triggera na
#   `templateArtifactId` (warunek `if (!templateArtifactId || templateTriggered.current...)`).
#   ★ Efekt jest AUTOMATYCZNY — odpala się w chwili montowania z `templateArtifactId` w URL,
#   ZANIM zdążysz cokolwiek pokazać. Modal MUSI wystąpić PRZED `navigate()`, nie po wylądowaniu
#   na `/prezentacje` — inaczej strzeli za późno.

# (T4) TRZECIE WEJŚCIE Z ODBIORU 186 JEST OSIEROCONE — potwierdź zero żywych linków
grep -n 'orphaned from navigation' src/routes/presentationWizardRedirect.ts
grep -rln "'/presentations/wizard'\|\"/presentations/wizard\"" src/ --include='*.tsx' --include='*.ts' | grep -v __tests__ | grep -v routes/presentationWizardRedirect
#   oczekiwane: komentarz własny pliku potwierdza "zero UI links"; drugi grep nie zwraca ŻADNEGO
#   pliku UI (poza samą definicją trasy) — to jest powód, dla którego to wejście zostaje bez modala.

# (T5) WZORZEC KLAS DO KOPIOWANIA — canon-safe — kontra PUŁAPKA crimson w bliźniaczym pliku
cat src/components/DocumentStudio/editor/useManualPrompt.tsx
grep -n 'focus:ring-c-focus\|focus-visible:ring-c-focus\|border-c-border\|bg-c-surface' src/components/DocumentStudio/editor/useManualPrompt.tsx
grep -n 'focus:ring-primary' src/components/shared/AICardDraftModal.tsx
#   oczekiwane: useManualPrompt.tsx używa WYŁĄCZNIE tokenów `c-*` (canon-safe, kopiuj TEN wzorzec);
#   AICardDraftModal.tsx (drugi, pozornie bliższy koncepcyjnie "brief→AI" wzorzec) ma
#   `focus:ring-primary-500/30` — `primary-500` w tailwind.config.js to odcień crimson
#   (`#A82D49`, CENTRAL RECOLOR LEVER) — NIE kopiuj klas z tego pliku, tylko z useManualPrompt.tsx.

# (T6) ORPHANED RED TEST — istnieje, opisuje INNY mechanizm, nie Twój, nie naprawiasz
git log --oneline --follow -- tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx
node_modules/.bin/vitest run tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx 2>&1 | tail -20
#   oczekiwane: jeden commit `0f9f98cfc3` ("fix(documents): reconstruct document and presentation
#   completion", 2026-08-08) dodał WYŁĄCZNIE ten plik testu (140 linii), zero zmian w
#   PrezentacjeView.tsx w tym samym commicie — test od zawsze czerwony, opisuje bogatszy,
#   NIGDY niezaimplementowany mechanizm (formularz brief+zmienne WEWNĄTRZ PrezentacjeView,
#   nagłówek "Uzupełnij brief prezentacji") — inny niż modal-przy-wyborze z tego dyżuru.
#   Uruchom vitest SAM w swoim świeżym worktree, nie ufaj poprzedniemu pomiarowi z brudnego drzewa.

# (T7) MIEJSCE NA NOWE KLUCZE I18N — pod istniejącym węzłem, nie osobny top-level
grep -n '"artifactHome": {' public/locales/en/translation.json public/locales/pl/translation.json
grep -n 'GEN-4' docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md
#   oczekiwane: dokładnie jedno trafienie na plik dla artifactHome; jedno trafienie dla GEN-4
#   (potwierdź aktualny numer linii przed edycją — w tej instrukcji podany jako "ok.").
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day201-modal-briefu-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6133`. Twój JEDYNY port harnessu to `5076 i 5077`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day201-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6132, 5010-5075, 6404-6411 (odbiory i dyżury poprzednich rund — zweryfikuj sam `lsof -i`/`docker ps` przed startem, ta lista nie jest gwarancją, tylko punktem startowym). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 oznaczony jako zajęty w przekazanej liście — źródło/właściciel rezerwacji NIEZWERYFIKOWANY przeze mnie, traktuj jak 5000: nie używaj, nie zakładaj powodu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi — modal renderuje się bezwarunkowo w dwóch punktach wyboru szablonu prezentacji (Materiały/Biblioteka i ArtifactModuleHome lane=prezentacje); to JEST nowa powierzchnia wizualna pod CLAUDE.md #7, ale D-10 (decyzja właściciela) już przesądziła "modal TERAZ" po wcześniejszym prototypie/akcepcie — nie cofasz tej decyzji, nie dodajesz własnej flagi ukrywającej modal. Jeśli w Twoim odczycie D-10 nie obejmuje jeszcze zrzutów akceptacyjnych TEGO konkretnego modala (nie ogólnej decyzji), zatrzymaj się i zapisz to w raporcie zamiast domyślnie zakładać zgodę.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY201_MODAL_BRIEFU_REPORT.md`. Dopisujesz nowy wpis wyniku dyżuru 201 do KOŃCA istniejącej komórki `GEN-4` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` (ok. linii 151, potwierdź grepem — NIE nadpisujesz treści dyżurów 77/80/83/186, dopisujesz swój wynik na końcu tej samej komórki, tym samym stylem `★ DYŻUR 201 (data): …`); NIE zmieniasz werdyktu bez uzasadnienia — jeśli po Twojej zmianie żywy użytkownik klikający w UI faktycznie dostaje brief w PPTX, uzasadnij w raporcie, czy to podnosi `PARTIAL`, i o ile (pamiętaj o zastanym zastrzeżeniu `content/default → smart_layout nadal eksportuje Key point N` — to NIE jest Twoja regresja, to znany, nienaprawiony w tym dyżurze defekt mappera z dyżuru 186). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day201-modal-briefu-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day201-modal-briefu-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **`chatActionHandler.ts` NIETYKALNY.** Wejście z czatu Teresy (`USE_TEMPLATE`, linie 313-335, konkretnie `deps.navigate` na linii 326-328) to dyżur 203 — nawet analiza/komentarz w Twoim kodzie sugerujący "tu też trzeba" zostaje w raporcie jako odnotowanie, nie jako zmiana pliku. ★★ **NIE DOTYKASZ mappera ani eksportu PPTX** (`presentationTemplateRuntimeService.ts`, `presentationDeckDocumentService.ts`, `presentations.routes.ts`) — dyżur 186 je scalił i zamroził; jeśli test dnia 186 (`presentations.templatePptx.day83.pg.test.ts` lub testy `presentationTemplateRuntimeService.test.ts`) się wywróci od Twojej zmiany, zakres jest za szeroki — zawęź, nie napraw backendu. ★★ **NIE PRÓBUJESZ naprawić `tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx`.** To osierocony test z 2026-08-08 (patrz T6) opisujący INNY, nigdy niezbudowany mechanizm (formularz brief+katalog zmiennych wewnątrz `PrezentacjeView`, nie modal-przy-wyborze-szablonu) — zostaje czerwony, odnotuj go w raporcie jako inwentarz (wzorem `SidebarUsage.tsx` z dyżuru 176), NIE mieszaj jego nazwy/lokalizacji z Twoimi nowymi testami R2. ★★ **NIE DODAJESZ modala do `presentationWizardRedirect.ts`** — to czysta funkcja przekierowania bez punktu kliknięcia (patrz T4); pozostaje bez zmian, luka dla starych zakładek zostaje udokumentowana jako świadomie nierozwiązana w tym dyżurze. ★★ **NIE ZMIENIASZ gałęzi kart wbudowanych** (`ArtifactModuleHome.tsx`, `if (promptOverride)`, linie 149-150) — to ODRĘBNY mechanizm (generyczny prompt z tytułu/opisu karty, ścieżka AI-generation, zero `templateArtifactId`), modal w tym dyżurze dotyczy WYŁĄCZNIE gałęzi bez promptu. ★★ **Zero innych modali w repo** — jeden nowy plik `PresentationBriefModal.tsx`, reużywany w dwóch miejscach, zero zmian w `AICardDraftModal.tsx`, `useManualPrompt.tsx` czy jakimkolwiek innym istniejącym modalu (czytasz je wyłącznie jako wzorzec klas). ★★ **DOWÓD PLIKIEM JEST OBOWIĄZKOWY** (R3) — realny PPTX z realnego wejścia HTTP (Gateway→mapper→PG→eksport, wzorem dyżuru 186, NIE fixture) z treścią wpisaną w modalu, plus dwa zrzuty modala (jasny/ciemny) w `ARTEFAKTY`. ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | `MODULE_ACCEPTANCE.md` (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md:151`, wiersz `GEN-4`) po dyżurze 186 mówi wprost, zweryfikowane dziś jako wciąż prawdziwe (git show na markerze): „★ DYŻUR 186 (…) trasa przyjmuje brief i przekazuje go do istniejącego mappera; front przekazuje obecny templatePrompt bez nowego UI. (…) PARTIAL — ogniwo body→mapper działa, ale żadne z czterech wejść nawigacyjnych nie produkuje dziś templatePrompt”. `ODBIOR_186_GEN4_TRESC.md` (ustalony na markerze tego dyżuru, `established: 2026-08-31`) precyzuje te cztery wejścia z numerami linii: `ArtifactModuleHome:152, artifactNavigation:107, presentationWizardRedirect:46, chatActionHandler:327` — zweryfikowane dziś jako wciąż dokładne co do linii. Z tych czterech: `chatActionHandler.ts:326-328` to wejście z czatu Teresy — właściciel (D-10) świadomie zostawia je NA PÓŹNIEJ, osobny dyżur 203. `artifactNavigation.ts:107` (`resolveTemplateUsePath`) to funkcja czysta, wywoływana z SZEŚCIU miejsc w JEDNYM pliku (`TemplatesTabContent.tsx` — biblioteka wzorców "Materiały"), więc to jest JEDNO żywe wejście UI z sześcioma triggerami, nie sześć osobnych wejść. `presentationWizardRedirect.ts:46` NIE jest punktem kliknięcia — to czysta funkcja przekierowania starych zakładek (`/presentations/wizard`), komentarz w samym pliku (linie 9-10) mówi wprost "orphaned from navigation (zero UI links)" — zweryfikowane dziś: brak jakiegokolwiek działającego linku w UI do tej trasy, więc nie ma tam momentu interakcji, w którym mógłby wyskoczyć modal. Zostają dwa żywe wejścia z realnym kliknięciem użytkownika: `ArtifactModuleHome.tsx:152` (karta szablonu w ekranie startowym Prezentacji) i sześć triggerów w `TemplatesTabContent.tsx` (biblioteka wzorców). Mechanizm odbioru istnieje i jest zweryfikowany mutacyjnie na markerze tego dyżuru: `PrezentacjeView.tsx:469-470` (`brief: templatePrompt || undefined`) wewnątrz efektu auto-triggera na `templateArtifactId` (linie 454-492) — modal ma WYŁĄCZNIE dostarczyć `templatePrompt` do URL przed nawigacją, nic więcej. |

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
cd /private/tmp/cx-day201-modal-briefu

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day201-pg psql -U postgres -d cx201 \
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
cd /private/tmp/cx-day201-modal-briefu

docker run -d --name cx-day201-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx201 \
  -p 127.0.0.1:6133:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day201-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6133/cx201 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6133/cx201 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day201-modal-briefu && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6133/cx201 \
JWT_SECRET=cx201-test-secret-do-not-reuse \
npx vitest run tests/components/AIChat/KimiWorkspace, tests/components/ReportsAndPresentations --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day201-modal-briefu-artefakty/day201-modal-briefu-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day201-modal-briefu && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/components/AIChat/KimiWorkspace, tests/components/ReportsAndPresentations --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day201-modal-briefu-artefakty/day201-modal-briefu-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day201-modal-briefu/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day201-pg psql -U postgres -d cx201 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day201-pg`.
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
> **(e) ★★ **Pierwsza, i najważniejsza: efekt auto-triggera w `PrezentacjeView.tsx` (linie 454-492) strzela NATYCHMIAST po zamontowaniu, gdy `templateArtifactId` jest w URL — zanim zdążysz cokolwiek pokazać na tym ekranie.** To znaczy: modal NIE MOŻE żyć wewnątrz `PrezentacjeView` po nawigacji (za późno, zapytanie do backendu już poleciało) — musi wystąpić PRZED `navigate()`, w miejscu kliknięcia (`ArtifactModuleHome.handleTemplateClick`, `TemplatesTabContent` sześć triggerów). Nie projektuj tego jako "pokaż modal na ekranie docelowym" — to jest architektura orphaned-testu z T6 (formularz WEWNĄTRZ PrezentacjeView) i nie zadziała z dzisiejszym auto-triggerem bez dodatkowej zmiany w PrezentacjeView, która jest POZA licencją tego dyżuru. **Druga: `AICardDraftModal.tsx` (`src/components/shared/`) wygląda jak najbliższy koncepcyjnie wzorzec ("brief textarea → AI"), ale ma `focus:ring-primary-500/30` — realne naruszenie kanonu (CLAUDE.md #3, `primary-500` = crimson `#A82D49` w `tailwind.config.js`, CENTRAL RECOLOR LEVER).** Nie kopiuj z niego klas. Wzorcem canon-safe jest `useManualPrompt.tsx` (`src/components/DocumentStudio/editor/`) — `focus:ring-c-focus`, `border-c-border`, `bg-c-surface`, `Button` primitive z `variant="primary"` (który w komponencie `Button.tsx` jest NEUTRALNY navy/white, nie crimson — crimson to `variant="brand"`, patrz `Button.tsx` komentarz VISUAL_STANDARD.md §5.1). Guzik "Dalej" = `variant="primary"`, guzik "Pomiń" = `variant="ghost"` lub `"secondary"` — zero `variant="brand"` w tym modalu, to nie jest moment marki. **Trzecia: `TemplatesTabContent.tsx` obsługuje TRZY typy wzorców (`report`/`sheet`/`presentation`) w JEDNEJ tabeli/bibliotece.** Modal ma się pojawić WYŁĄCZNIE dla `row.type === 'presentation'` — dla `report`/`sheet` zachowanie musi zostać bajt-identyczne (bez modala, bezpośrednia nawigacja jak dziś); dodatkowo `resolveTemplateUsePath` dla `presentation` może w teorii (edge case, `originRuntime==='sheet_template'`) zwrócić ścieżkę NIE zaczynającą się od `/prezentacje` — dopisuj `&templatePrompt=` do `usePath` TYLKO gdy `usePath.startsWith('/prezentacje?')`, żeby nie doczepić nierozpoznanego parametru do innej trasy. **Czwarta: przycisk "Pomiń" i Esc/klik w tło MUSZĄ prowadzić do TEGO SAMEGO zachowania — dzisiejszej nawigacji bez `templatePrompt`.** Nie zostawiaj trzeciej ścieżki (np. zamknięcie bez żadnej nawigacji) — użytkownik zawsze musi gdzieś wylądować, tak jak dziś. "Dalej" z pustym polem tekstowym = traktuj identycznie jak "Pomiń" (nie doczepiaj pustego `templatePrompt=`). **Piąta: `MODULE_ACCEPTANCE.md` GEN-4 (linia ok. 151) ma już zapisany DRUGI, nienaprawiony w dyżurze 186 defekt — `content/default → smart_layout nadal eksportuje tytuł Key point N`, niezależny od tego, czy brief istnieje.** Jeśli Twój dowodowy PPTX (R3) pokaże `Key point N` na którymś slajdzie mimo wpisanego briefu, to NIE jest regresja Twojej zmiany — to znany, zastany defekt mappera z dyżuru 186. Nazwij to w raporcie zamiast próbować naprawić (poza licencją) albo cicho pominąć dowód. **Szósta: nowe klucze i18n idą do ISTNIEJĄCEGO węzła `kimi.artifactHome` w OBU plikach lokalizacji** (`public/locales/en/translation.json`, `public/locales/pl/translation.json`) — nie tylko fallback tekstowy w wywołaniu `t(klucz, fallback)` w kodzie (ten wzorzec w repo bywa mylący — część ekranów ma realne wpisy w JSON, część poniewiera się na samym fallbacku; ten konkretny węzeł MA realne wpisy dla sąsiednich kluczy `kimi.artifactHome.*`, więc Twoje nowe klucze też mają je dostać, inaczej `i18next-parser`/audyt i18n złapie brakujące klucze jako dług). Nie dotykaj `dist/locales/**` (artefakt builda, generowany, nie źródło).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day201-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day201-modal-briefu-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — modal briefu wpięty w dwa żywe wejścia UI (ArtifactModuleHome, TemplatesTabContent), wartość płynie jako `templatePrompt` do istniejącego mechanizmu; pozycja R2 — testy render+flow (modal się pokazuje, Dalej niesie brief, Pomiń = zachowanie dzisiejsze, mutacja czerwona/zielona); pozycja R3 — dowód plikiem przez realny Gateway (PPTX z treścią z briefu wpisanego w modalu, nie z fixture) plus zrzuty modala w obu motywach`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6133` albo `5076 i 5077` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6133` albo `5076 i 5077`** (`Z7`).

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

Jedna sprawa, zmierzona dwa razy — najpierw w dyżurze 186, potem w odbiorze tego dyżuru
(`ODBIOR_186_GEN4_TRESC.md`, `established: 2026-08-31`, ustalony na markerze tego dyżuru) —
i rozstrzygnięta decyzją właściciela D-10 ("modal TERAZ").

**Backend już działa.** Dyżur 186 domknął ogniwo danych: `POST /presentations/decks/from-template`
przyjmuje pole `brief`, przekazuje je do `mapOutlineBlueprintToDeckSlides`, a mapper buduje z niego
realną treść slajdów zamiast placeholderów (`Signal:`/`Key point N`). Odbiór 186 to potwierdził
mutacyjnie i przez realny roundtrip HTTP→Gateway→mapper→PG→eksport (plik PPTX 88 945 B, znacznik
w stopce każdego slajdu, treść z briefu — `EUR 2.2m`, `15 August` — zero `Key point`).

**Ale nikt dziś nie dostarcza tego briefu z ekranu.** Front czyta `templatePrompt` z URL-a
(`PrezentacjeView.tsx:154`) i przekazuje go jako `brief` do wywołania `from-template`
(`PrezentacjeView.tsx:469-470`) — mechanizm gotowy, przetestowany, zamrożony. Problem: **żadne z
wejść, które nawigują do `/prezentacje?templateArtifactId=...`, nie ustawia `templatePrompt`**.
Odbiór 186 wymienił cztery takie miejsca z numerami linii — zweryfikowane dziś jako wciąż
dokładne:

```
ArtifactModuleHome:152, artifactNavigation:107, presentationWizardRedirect:46, chatActionHandler:327
```

Z tych czterech **dwa są żywymi punktami kliknięcia użytkownika**, jedno jest **czatem Teresy**
(poza zakresem — dyżur 203), a jedno jest **osieroconą funkcją przekierowania bez żadnego
działającego linku w UI** (`presentationWizardRedirect.ts`, komentarz własny pliku: "orphaned
from navigation (zero UI links)" — zweryfikowane dziś grepem, zero trafień poza definicją trasy).
Szczegóły w sekcji 3.

**Ten dyżur wpina modal briefu w dwa żywe punkty kliknięcia.** Wartość, którą użytkownik wpisze,
płynie do URL-a jako `templatePrompt` — do mechanizmu, który już istnieje i działa. Zero zmian
backendu, zero zmian mappera, zero nowego kanału transportu danych.

# 2. TEZY ZLECENIA

- **T1.** Mechanizm `templatePrompt` (URL) → `brief` (body żądania) → treść slajdów istnieje,
  działa i jest zamrożony (dyżur 186) — ten dyżur go WYŁĄCZNIE karmi, nie zmienia.
- **T2.** Z czterech wejść nawigacyjnych z odbioru 186, tylko DWA mają realny punkt kliknięcia w
  UI: karta szablonu w `ArtifactModuleHome` (ekran startowy Prezentacji) i sześć triggerów w
  `TemplatesTabContent` (biblioteka wzorców Materiałów) — to jest JEDNO żywe wejście z sześcioma
  identycznymi triggerami tego samego wzorca `resolveUsePath`+`navigate`, nie sześć osobnych
  miejsc do projektowania osobno.
- **T3.** Trzecie wejście z listy odbioru 186 (`presentationWizardRedirect.ts:46`) jest czystą
  funkcją przekierowania starych zakładek, bez momentu interakcji — modal tam NIE wchodzi, luka
  zostaje udokumentowana jako świadomie nierozwiązana.
- **T4.** Czwarte wejście (`chatActionHandler.ts:327`, czat Teresy) jest POZA zakresem — osobny
  dyżur 203.
- **T5.** Modal ma dwa wyjścia: "Dalej" (niesie wpisany tekst jako `templatePrompt`) i "Pomiń"
  (dokładnie dzisiejsze zachowanie, bez `templatePrompt` — deck strukturalny z samego szablonu).
  Zero trzeciej ścieżki.

# 3. POZYCJE DYŻURU

## R1 — modal briefu w dwóch żywych punktach kliknięcia

### R1.1 — nowy współdzielony komponent

Utwórz `src/components/shared/PresentationBriefModal.tsx`. Wzorzec klas do skopiowania 1:1:
`src/components/DocumentStudio/editor/useManualPrompt.tsx` (CAŁY plik — powłoka
`fixed inset-0 z-[...] flex items-center justify-center bg-black/40 p-4`, karta
`rounded-xl border border-c-border bg-c-surface p-4 shadow-xl`, `role="dialog"`
`aria-modal="true"` `aria-labelledby`). Zamień pojedynczy `<input>` na `<textarea>` (pole ma
przyjąć kilka zdań, nie jedną frazę), zamień etykiety guzików: `variant="ghost"` = "Pomiń",
`variant="primary"` = "Dalej" (Button primitive — `primary` w `Button.tsx` to NEUTRALNY
navy/white, nie crimson; crimson to `variant="brand"`, którego tu NIE używasz — to nie jest
moment marki). Focus ring i obramowania WYŁĄCZNIE tokenami `c-*`
(`focus-visible:ring-c-focus`, `border-c-border`, `bg-c-surface`) — NIE kopiuj klas z
`src/components/shared/AICardDraftModal.tsx`, mimo że koncepcyjnie jest bliższy (też
"brief textarea → dalsza generacja"): ten plik ma `focus:ring-primary-500/30`, a `primary-500`
w `tailwind.config.js` to odcień crimson (`#A82D49`, komentarz w configu: "CENTRAL RECOLOR
LEVER") — realne naruszenie kanonu (CLAUDE.md #3), nie wzorzec do naśladowania.

Interfejs (kontrolowany przez rodzica, bez własnego stanu otwarcia):

```ts
interface PresentationBriefModalProps {
  open: boolean;
  onSubmit: (brief: string) => void; // "Dalej"
  onSkip: () => void;                // "Pomiń" I Esc I klik w tło — TA SAMA funkcja
}
```

Treść pól przez `t()` z fallbackiem angielskim, nowe klucze pod ISTNIEJĄCYM węzłem
`kimi.artifactHome` w `public/locales/en/translation.json` (ok. linii 25444) i
`public/locales/pl/translation.json` (ok. linii 26939) — potwierdź grepem aktualny numer linii
przed edycją. Sugerowana struktura kluczy (dopasuj brzmienie do sąsiednich wpisów w tym samym
węźle, nie kopiuj mechanicznie):

```
kimi.artifactHome.briefModal.title       "What should this presentation be about?" / "O czym ma być ta prezentacja?"
kimi.artifactHome.briefModal.placeholder (krótka podpowiedź, np. przykładowe dane liczbowe/kontekst)
kimi.artifactHome.briefModal.next        "Next" / "Dalej"
kimi.artifactHome.briefModal.skip        "Skip" / "Pomiń"
```

"Dalej" z pustym/białoznakowym polem = zachowuj się DOKŁADNIE jak "Pomiń" (nie doczepiaj pustego
`templatePrompt=` do URL-a) — to decyzja logiki wywołującej (R1.2/R1.3), nie samego modala; modal
tylko oddaje surowy tekst przez `onSubmit`.

### R1.2 — `ArtifactModuleHome.tsx`

Dotyczy WYŁĄCZNIE gałęzi `else` w `handleTemplateClick` (linia 152, wywoływana gdy
`promptOverride` jest puste — czyli klik w kartę szablonu POBRANEGO z API, nie kartę wbudowaną).
Gałąź `if (promptOverride)` (linie 149-150, karty wbudowane typu "Steering Committee Deck" z
wygenerowanym z tytułu/opisu promptem, ścieżka AI-generation bez `templateArtifactId`) to
ODRĘBNY, już działający mechanizm — NIE dotykasz.

Modal ma się pojawić TYLKO gdy `lane === 'prezentacje'` (komponent obsługuje trzy lane:
excele/prezentacje/tabele — dla pozostałych dwóch zachowanie zostaje bajt-identyczne, bez
modala, bezpośrednia nawigacja jak dziś).

Kształt zmiany (dopasuj do konwencji reszty pliku, nie kopiuj mechanicznie):

```tsx
const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

const handleTemplateClick = (templateId: string, promptOverride?: string) => {
  if (promptOverride) {
    navigate(`${meta.route}?view=new&templatePrompt=${encodeURIComponent(promptOverride)}`);
    return;
  }
  if (lane === 'prezentacje') {
    setPendingTemplateId(templateId);
    return;
  }
  navigate(`${meta.route}?templateArtifactId=${encodeURIComponent(templateId)}`);
};

const navigateToTemplate = (templateId: string, brief?: string) => {
  const trimmed = (brief || '').trim();
  navigate(
    trimmed
      ? `${meta.route}?templateArtifactId=${encodeURIComponent(templateId)}&templatePrompt=${encodeURIComponent(trimmed)}`
      : `${meta.route}?templateArtifactId=${encodeURIComponent(templateId)}`
  );
};
```

`onSubmit` woła `navigateToTemplate(pendingTemplateId, brief)`, `onSkip` woła
`navigateToTemplate(pendingTemplateId)` (bez drugiego argumentu) — oba czyszczą
`pendingTemplateId` na `null`. Render `<PresentationBriefModal open={pendingTemplateId !== null} .../>`
gdziekolwiek w drzewie zwracanym przez `ArtifactModuleHome` (poza warunkowymi blokami tabów, żeby
modal nie znikał przy przełączeniu taba pod spodem — zdecyduj i uzasadnij w raporcie, jeśli
umieścisz inaczej).

### R1.3 — `TemplatesTabContent.tsx`

Sześć miejsc z identycznym wzorcem `const usePath = resolveUsePath(x); if (usePath) navigate(usePath);`
(linie 391-406 `buildRowMenu` akcja `use`, 500-503 `previewActions` informational `use`, 685-688
`GridView.onItemAction('open')`, 716-720 `StandardTable.onRowDoubleClick`, 745-748
`TemplatesGalleryView.onUse`, 758-761 `StandardPreview.onOpenFull`). Scal w JEDNĄ funkcję:

```tsx
const [pendingBriefRow, setPendingBriefRow] = useState<TemplateItem | null>(null);

const handleUseTemplate = useCallback(
  (row: TemplateItem) => {
    const usePath = resolveUsePath(row);
    if (!usePath) return;
    if (row.type === 'presentation' && usePath.startsWith('/prezentacje?')) {
      setPendingBriefRow(row);
      return;
    }
    navigate(usePath);
  },
  [resolveUsePath, navigate]
);
```

Warunek `usePath.startsWith('/prezentacje?')` obok `row.type === 'presentation'` jest celowy:
`resolveTemplateUsePath` (`artifactNavigation.ts`) ma gałąź `originRuntime === 'sheet_template'`
która może w teorii zwrócić ścieżkę inną niż `/prezentacje` nawet dla typu prezentacyjnego —
modal i dopisanie `templatePrompt` mają sens WYŁĄCZNIE dla trasy, którą faktycznie czyta
`PrezentacjeView`.

Zamień WSZYSTKIE sześć call-site'ów na `handleUseTemplate(row)` / `handleUseTemplate(item)` /
`handleUseTemplate(tpl)` (nazwa zmiennej per miejsce, patrz kod). `onSubmit`/`onSkip` modala:
identyczna logika jak w R1.2, ale przez `resolveUsePath(pendingBriefRow)` żeby odtworzyć `usePath`
(nie cache'uj samego stringa — `resolveUsePath` jest tania, czysta funkcja).

Dla `row.type !== 'presentation'` (`report`, `sheet`) zachowanie musi zostać bajt-identyczne z
dzisiejszym — bez modala, natychmiastowa nawigacja. To jest regresyjny warunek R2 (patrz niżej).

## R2 — testy render + flow

Nowe pliki, konwencja nazewnicza sąsiadów (`.deeplink.test.tsx`, `.galleryFlag.test.tsx`,
`.scope.test.tsx`):

- `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.presentationBriefModal.test.tsx`
  — wzorzec mocków: `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx`
  (`navigateMock` przez `vi.mock('react-router-dom', ...)`, `useModuleTemplates`,
  `useModuleRecentArtifacts`). Sprawdź: (a) klik w kartę szablonu API (lane=prezentacje,
  `promptOverride` puste) pokazuje modal, NIE nawiguje od razu; (b) wpisanie tekstu + "Dalej"
  woła `navigateMock` z `templateArtifactId` ORAZ `templatePrompt` zakodowanym w URL; (c) "Pomiń"
  woła `navigateMock` z SAMYM `templateArtifactId`, bez `templatePrompt` — bajt-identyczne z
  dzisiejszym zachowaniem (mutacja: podmień `handleTemplateClick` z powrotem na bezpośrednią
  nawigację, ten test musi zostać czerwony na kroku (a)); (d) regresja: lane=`excele`/`tabele`
  NIE pokazuje modala, klik w kartę nawiguje od razu jak dziś.

- `tests/components/ReportsAndPresentations/TemplatesTabContent.presentationBriefModal.test.tsx`
  — wzorzec mocków: `TemplatesTabContent.deeplink.test.tsx` (mock `react-router-dom`,
  `useOpenChatWithContext`, `ModuleHub` FilterableTable/GridView, `TableWithPreviewLayout`).
  Sprawdź: (a) klik "Użyj wzorca" na wierszu `type: 'presentation'` pokazuje modal; (b) klik
  "Użyj wzorca" na wierszu `type: 'report'` LUB `type: 'sheet'` nawiguje OD RAZU, bez modala —
  regresyjny dowód, że pozostałe dwa typy szablonów są nietknięte; (c) "Dalej"/"Pomiń" jak wyżej.

Mutacja obowiązkowa dla obu plików: odetnij przepływ (np. zawsze wołaj `navigate(usePath)`
pomijając stan `pending*`) → test (a) musi się wywrócić na czerwono, potem przywróć zieleń.

## R3 — dowód plikiem

Realny roundtrip HTTP (Gateway→backend→PG→eksport, wzorem dyżuru 186 — NIE fixture, NIE mock
backendu): symuluj wpisanie briefu w modalu (albo bezpośrednio zbuduj URL z `templateArtifactId`
+ `templatePrompt` tak, jak zrobiłby to modal po "Dalej") i przejdź przez faktyczne
`POST /presentations/decks/from-template` → eksport PPTX. Potwierdź: plik niepusty, treść
slajdów zawiera frazy z wpisanego briefu (nie z fixture'a dyżuru 186 — świeży, własny brief tego
dyżuru, np. z inną kwotą/datą niż `EUR 2.2m`/`15 August`, żeby dowód był odróżnialny od
poprzedniego). Jeśli któryś slajd nadal pokazuje `Key point N` mimo briefu — to ZASTANY,
nienaprawiony w dyżurze 186 defekt gałęzi `content/default → smart_layout`
(`MODULE_ACCEPTANCE.md:151`), NIE Twoja regresja; nazwij go w raporcie, nie chowaj dowodu i nie
próbuj naprawiać (poza licencją).

Zrzuty modala ×2 (jasny/ciemny motyw) w `ARTEFAKTY` — modal w spoczynku (pole puste, "Dalej" i
"Pomiń" widoczne), zgodnie z listą czekowania część B (CLAUDE.md #4).

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (nowy) | `src/components/shared/PresentationBriefModal.tsx` |
| Zapis | `src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` — wyłącznie `handleTemplateClick` (gałąź `else`, linia 152) i nowy render modala; gałąź `if (promptOverride)` (149-150) nietknięta |
| Zapis | `src/components/ReportsAndPresentations/TemplatesTabContent.tsx` — wyłącznie sześć call-site'ów `resolveUsePath`+`navigate` scalonych w `handleUseTemplate`, plus render modala |
| Zapis | `public/locales/en/translation.json`, `public/locales/pl/translation.json` — wyłącznie nowe klucze pod istniejącym węzłem `kimi.artifactHome` |
| Zapis | nowe testy `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.presentationBriefModal.test.tsx`, `tests/components/ReportsAndPresentations/TemplatesTabContent.presentationBriefModal.test.tsx` |
| Zapis | dopisek do komórki `GEN-4` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/11_MATERIALS/MODULE_ACCEPTANCE.md` (ok. linii 151) — dopisujesz, nie nadpisujesz |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY201_MODAL_BRIEFU_REPORT.md` |
| Odczyt | `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` — mechanizm `templatePrompt`→`brief` (linie 154, 454-492, 469-470); **nie zmieniasz** |
| Odczyt | `src/components/ReportsAndPresentations/artifactNavigation.ts` — `resolveTemplateUsePath`; **nie zmieniasz** |
| Odczyt | `src/routes/presentationWizardRedirect.ts` — trzecie wejście z odbioru 186, osierocone, bez punktu kliknięcia; **nie zmieniasz** |
| Odczyt | `src/components/DocumentStudio/editor/useManualPrompt.tsx` — wzorzec klas modala (canon-safe) |
| Odczyt | `src/components/shared/AICardDraftModal.tsx` — WYŁĄCZNIE jako przykład PUŁAPKI (crimson focus-ring), nie wzorzec do kopiowania |
| Odczyt | `docs/program/funkcje/ODBIOR_186_GEN4_TRESC.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY186_GEN4_TRESC_REPORT.md` — dowód kontekstu; **nie zmieniasz** |

**Nietykalne imiennie:** `src/services/chatActionHandler.ts` (czwarte wejście, czat Teresy —
dyżur 203); `server/**` w całości (backend zamrożony po dyżurze 186); testy
`presentationTemplateRuntimeService.test.ts`, `presentations.templatePptx.day83.pg.test.ts`
(nie mogą się wywrócić — jeśli się wywrócą, zakres jest za szeroki); orphaned test
`tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx` (osobny,
niezaimplementowany mechanizm — patrz sekcja 5); `dist/locales/**` (artefakt builda).

# 5. TWARDE ZASADY

- ★ **`chatActionHandler.ts` NIETYKALNY.** Wejście z czatu Teresy (`USE_TEMPLATE`, linie
  313-335) to dyżur 203 — zero zmian pliku, nawet jeśli w kodzie widać, że "tu też by się
  przydało". Odnotuj w raporcie, nie implementuj.
- **Modal wyłącznie dla `row.type === 'presentation'` / `lane === 'prezentacje'`.** Szablony
  raportów i arkuszy (`report`, `sheet`) oraz laney `excele`/`tabele` zostają bajt-identyczne z
  dzisiejszym zachowaniem — bez modala, natychmiastowa nawigacja. To jest twardy warunek
  regresyjny testów R2.
- **Nie dodajesz modala do `presentationWizardRedirect.ts`.** To czysta funkcja przekierowania
  bez punktu kliknięcia (zero działających linków w UI, potwierdzone grepem) — luka dla starych
  zakładek zostaje udokumentowana jako świadomie nierozwiązana.
- **Nie próbujesz naprawić orphaned testu**
  `PrezentacjeView.templateBrief.test.tsx` — dodany w commicie `0f9f98cfc3` (2026-08-08,
  WYŁĄCZNIE plik testu, zero zmian implementacji w tym samym commicie), czerwony od zawsze,
  opisuje INNY mechanizm (formularz brief+katalog zmiennych WEWNĄTRZ `PrezentacjeView`, z
  nagłówkiem "Uzupełnij brief prezentacji" i polami "Brief i dane do slajdów"/"Tytuł
  prezentacji" — nie modal-przy-wyborze-szablonu z tego dyżuru). Zostaw czerwony, wpisz do
  raportu jako inwentarz (wzorem `SidebarUsage.tsx` z dyżuru 176 — istnieje, nie jest w zakresie,
  osobna decyzja właściciela: dokończyć czy skasować), i NIE nazywaj swoich nowych plików
  testowych podobnie (żeby nie było dwuznaczności przy grepie/raportowaniu).
- **Nie zmieniasz mappera, eksportu ani trasy `from-template`** — dyżur 186 je zamroził. Jeśli
  test dnia 186 się wywróci, zawęź zakres, nie napraw backendu.
- **Zero innych modali w repo.** Jeden nowy plik `PresentationBriefModal.tsx`, reużywany w dwóch
  miejscach; zero zmian w `AICardDraftModal.tsx`, `useManualPrompt.tsx` czy jakimkolwiek innym
  istniejącym modalu — czytasz je wyłącznie jako wzorzec/antywzorzec klas.
- Pułapka crimson: `primary-500` w `tailwind.config.js` to odcień crimson (`#A82D49`) —
  `focus:ring-primary-*` w NOWYM kodzie jest naruszeniem CLAUDE.md #3. Focus WYŁĄCZNIE
  `c-focus`. `Button variant="primary"` (Button.tsx) jest bezpieczny — to osobna, neutralna
  abstrakcja, nie ta sama pułapka co surowa klasa tailwind.
- Pułapka `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym wyniku,
  który przywołujesz jako dowód (dotyczy też Twojego własnego uruchomienia orphaned testu w T6 —
  ten akurat MA testy i są czerwone, to nie to samo co pusty zbiór).
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; port **5037** oznaczony jako
  zajęty w przekazanej liście bez zweryfikowanego przeze mnie powodu — traktuj identycznie, nie
  używaj.
- Wymóg sekcji "TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz wprost, jeśli nie
  zdążyłeś: (a) zweryfikować w SWOIM świeżym worktree, że orphaned test z T6 jest wciąż czerwony
  (mój pomiar w tej instrukcji pochodzi z BRUDNEGO, zdywergowanego lokalnego drzewa `/private/tmp/m03`,
  nie z czystego checkoutu markera — potwierdź sam); (b) sprawdzić oba motywy modala w obu
  punktach wejścia (ArtifactModuleHome i TemplatesTabContent renderują go z tego samego
  komponentu, ale w różnym kontekście layoutu — upewnij się, że nic z otaczającego drzewa nie
  psuje z-indexu/overlayu w drugim miejscu); (c) potwierdzić, że dopisek do `MODULE_ACCEPTANCE.md`
  GEN-4 nie koliduje z równoległą pracą innego dyżuru nad tym samym wierszem.

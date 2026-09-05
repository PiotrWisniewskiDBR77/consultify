# INSTRUKCJA DYŻURU nr 370 — Codex — „★★ DWA GUZIKI CZATU OKŁAMUJĄ UŻYTKOWNIKA CO DO TEGO, JAKI REKORD POWSTAJE. **(1) K4 — „Konwertuj na inicjatywę” nie tworzy inicjatywy.** Przycisk z etykietą `deepThinking.convertInitiative` (`src/components/AIChat/MessageRenderer.tsx:2422`) woła DOKŁADNIE ten sam handler co „Zapisz jako decyzję” (`:2412`, `handleSaveAsDecision`, `UnifiedChatPanel.tsx:5627-5645`), a serwer `server/src/routes/ai/deep-thinking.routes.ts:57-142` (★ UWAGA: brief źródłowy cytował `server/src/routes/deep-thinking.routes.ts` bez segmentu `/ai/` — zweryfikuj sam, `ls` potwierdza realną ścieżkę) zawsze wstawia jeden wiersz do `ai_decision_outcomes`, niezależnie od pola `type`/`saveType` — tabela `initiatives` nie jest tam w ogóle dotykana. Naprawa: rozgałęzienie po `type` w handlerze serwera, z gałęzią `initiative` wołającą ISTNIEJĄCY kanoniczny lejek tworzenia inicjatyw `server/src/services/initiative/createInitiativeService.ts` (`createInitiative(orgId, input, options)` — dokumentacja w pliku twierdzi, że zastępuje ~23 rozproszone `INSERT INTO initiatives`; TWÓJ pomiar ma to zweryfikować, bo ~20 plików produkcyjnych nadal robi to bezpośrednio, patrz `§0.3` komenda (9)). Lejek ma WBUDOWANY ślad audytu przez pola `sourceType`/`sourceId`/`sourcePack` → kolumny `source_type`/`source_id`/`source_pack_json`, dokładnie tak, jak dziś woła go `server/src/services/aiActionExecutor.ts:1266-1317` (`_executeCreateInitiative` — WZORZEC do skopiowania kształtem, nie plikiem). **(2) K8 — „Zapisz jako pomysł” nie zapisuje niczego z poziomu czatu.** Domyślna gałąź `saveMessageAsIdea` (`UnifiedChatPanel.tsx:1462-1565`, `navigateToMyWork` prawdziwe przy kliknięciu z `MessageRenderer.tsx:2196`) ustawia tylko `useAppStore.setMyWorkIntent` z fałszywym `id:'new-idea-${Date.now()}'` i przełącza widok — rekord powstaje DOPIERO w `IdeaMapWorkspace.hydrate()` (`src/components/MyWork/IdeaMapWorkspace.tsx:1632-1651`, wołanie `Api.createMyIdea`), czyli zależnie od tego, czy użytkownik w ogóle domontuje ten komponent. Bliźniacza funkcja `saveMessageAsNote` (`:1567-1631`, w TYM SAMYM PLIKU) robi to poprawnie: woła `Api.post('/my-work/notebook/pages', …)` SYNCHRONICZNIE, przed nawigacją. Naprawa: `saveMessageAsIdea` ma wołać `Api.createIdeaFromChat` (JUŻ ISTNIEJE, już jest wołane w tym samym pliku w gałęzi `navigateToMyWork:false`, `:1540-1547`) PRZED nawigacją i przekazać PRAWDZIWE `ideaId` z odpowiedzi zamiast `new-idea-${Date.now()}` — dokładnie ten wzorzec, który W TYM SAMYM PLIKU już działa poprawnie gdzie indziej (`:2226-2266`, zmienna `isRealIdeaId`), bo `IdeaMapWorkspace.hydrate()` tworzy drugi rekord WYŁĄCZNIE wtedy, gdy `ideaId.startsWith('new-idea-')` (`:353`)."

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
> **wyłącznie** `/private/tmp/cx-day370-akcje-wiadomosci`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-05.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **`13_CHAT` — akcje na wiadomości Teresy, które mają tworzyć rekordy w innych modułach. Dwa defekty potwierdzone przez audyt i sceptyka (K4, K8 w `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`): (1) „Konwertuj na inicjatywę” zawsze zapisuje decyzję, zero inicjatywy — naprawa to rozgałęzienie serwera po `type` + użycie istniejącego kanonicznego lejka tworzenia inicjatyw; (2) „Zapisz jako pomysł” nie zapisuje niczego z poziomu czatu, rekord (jeśli w ogóle) powstaje dopiero przy domontowaniu innego komponentu — naprawa to zapis synchroniczny przed nawigacją, wzorem bliźniaczej funkcji `saveMessageAsNote` w tym samym pliku. Przy okazji (`R3`, nie-rdzeń): inwentarz WSZYSTKICH akcji czatu obiecujących utworzenie rekordu (zadanie/decyzja/inicjatywa/pomysł/notatka/materiał), z tabelą endpoint/tabela docelowa/zapis przed czy po nawigacji — naprawiasz TYLKO K4 i K8, resztę raportujesz. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, plik postępu `/private/tmp/cx-day370-postep.md` (POZA repo).**.
Trasy front: ``src/components/AIChat/MessageRenderer.tsx:319` (typ propa `handleSaveAsDecision`, do rozszerzenia o opcjonalny trzeci parametr `type`), `:2412` i `:2422` (dwa przyciski CTA Deep Thinking, K4 — dziś identyczny `onClick`). `src/components/AIChat/UnifiedChatPanel.tsx:1462-1565` (`saveMessageAsIdea`, K8 — RDZEŃ), `:1567-1631` (`saveMessageAsNote`, WZORZEC POPRAWNY, TYLKO ODCZYT — kopiujesz kształt, nie plik), `:2150-2266` (drugi wołacz `setMyWorkIntent` typu `idea`, WZORZEC POPRAWNY z prawdziwym id, TYLKO ODCZYT — dowód, że kontrakt „prawdziwe id → brak duplikatu” już działa gdzie indziej w tym samym pliku), `:5627-5645` (`handleSaveAsDecision`, K4 — RDZEŃ), `:6418` (montaż propa — sprawdź, czy sygnatura się zgadza po zmianie). `src/services/api.ts:2212-2229` (`saveDeepThinkingDecision` — CZYTAJ; sygnatura TS już ma opcjonalne `type`, prawdopodobnie ZERO zmian), `:5757-5779` (`createIdeaFromChat` — CZYTAJ; już istnieje i jest już wołane w tym samym pliku, prawdopodobnie ZERO zmian). `src/components/MyWork/IdeaMapWorkspace.tsx:353` (`isNewInitial = ideaId.startsWith('new-idea-')` — JEDYNY strażnik przed duplikatem), `:1632-1721` (`hydrate()`, gałąź `Api.createMyIdea` kontra gałąź `Api.getMyIdea` — TYLKO ODCZYT, chyba że `R2` udowodni realną lukę wymagającą zmiany). `src/components/MyWork/ideaWorkspaceState.ts:20-25` (DRUGI, kosmetyczny licznik „isNew” dla panelu narzędzi — TYLKO ODCZYT, opisz w raporcie, czy wymaga dotknięcia). `src/services/chatActionRegistry.ts`, `src/services/chatActionHandler.ts`, `src/types/domain/chatActions.ts` (inwentarz `R3` — prawdopodobnie TYLKO ODCZYT: żadna z 14 akcji tego rejestru nie tworzy zadania/decyzji/inicjatywy/pomysłu/notatki/materiału wprost; komentarz w `chatActions.ts:11-12` odsyła do `aiActionExecutor.ts:911-920` — policz to jako osobny mianownik w `R3`). Reszta `src/**` pozostaje `TYLKO ODCZYT`.`. Trasy tył: `★★ SEDNO K4. `server/src/routes/ai/deep-thinking.routes.ts:57-142`, handler `POST /save-decision` — RDZEŃ, WĄSKA LICENCJA: rozgałęzienie po `saveType` (`type` z body, już odbierane w linii 69, dziś używane WYŁĄCZNIE jako tag w kolumnie JSON `tags`, linia 124). Gałąź `saveType === 'initiative'` ma wołać `server/src/services/initiative/createInitiativeService.ts` (`export async function createInitiative(orgId, input, options)`, CZYTAJ CAŁOŚĆ — WBUDOWANY ślad audytu przez `sourceType`/`sourceId`/`sourcePack` → kolumny `source_type`/`source_id`/`source_pack_json`, automatyczne zakotwiczenie `projectId` gdy brak, `title` wymagany, walidacja `CreateInitiativeSchema`). Wzorzec wołania: `server/src/services/aiActionExecutor.ts:1266-1317` (`_executeCreateInitiative`, woła DOKŁADNIE ten sam lejek jako `funnelCreateInitiative` — CZYTAJ jako wzorzec kształtu wywołania, NIE kopiuj plik i nie dotykaj `aiActionExecutor.ts`, to cudzy, znacznie szerszy mechanizm `CREATE_DRAFT_*` z własnym cyklem propozycja→akceptacja→wykonanie). Gałąź `saveType !== 'initiative'` (domyślnie `'decision'`) zostaje BEZ ZMIAN — `INSERT INTO ai_decision_outcomes` jak dziś, bit-do-bitu. ★★ SEDNO K8. Brak zmian po stronie `server/` — `POST /my-work/my-ideas/from-chat` (`server/src/routes/my-work.routes.ts:6889-6978`) już istnieje, już generuje prawdziwe `ideaId` w kształcie `idea-<timestamp>-<losowe>` (linia 6913) i już zapisuje ślad `source_conversation_id`/`source_message_id` (linia 6926-6936) — TYLKO ODCZYT, Twoim dowodem jest pokazanie, że nic tu nie trzeba zmieniać. `server/src/services/aiActionExecutor.ts` poza wskazanymi liniami referencyjnymi — TYLKO ODCZYT, nie dotykasz.`.

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
WT=/private/tmp/cx-day370-akcje-wiadomosci
MARKER=9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day370-akcje-wiadomosci-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day370-akcje-wiadomosci/config.worktree"
cat "$VAULT/worktrees/cx-day370-akcje-wiadomosci/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day370-akcje-wiadomosci-scratch
mkdir -p /private/tmp/cx-day370-akcje-wiadomosci-artefakty

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
git -C "$VAULT" log --oneline 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day370-akcje-wiadomosci-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dwanaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) K4 - oba przyciski CTA maja IDENTYCZNY onClick
sed -n '2405,2430p' src/components/AIChat/MessageRenderer.tsx
#   moje liczby: linia 2412 (Save as Decision) i linia 2422 (Convert to Initiative)
#   maja DOSLOWNIE ten sam onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}

# (2) K4 - handler serwerowy ignoruje typ
sed -n '5627,5645p' src/components/AIChat/UnifiedChatPanel.tsx
bash -c "grep -n \"'/save-decision'\" server/src/routes/ai/deep-thinking.routes.ts"
sed -n '57,142p' server/src/routes/ai/deep-thinking.routes.ts
#   moje liczby: handleSaveAsDecision (front) NIE przyjmuje parametru type;
#   serwer odbiera `type` w linii 69, ale uzywa go WYLACZNIE jako tag w JSON (linia 124);
#   jedyny zapis to `INSERT INTO ai_decision_outcomes` (linie 105-126), zero odwolania do `initiatives`
#   ★ UWAGA SCIEZKI: plik jest w server/src/routes/ai/deep-thinking.routes.ts (z segmentem /ai/),
#   nie server/src/routes/deep-thinking.routes.ts jak w brifie zrodlowym - sprawdz `ls` sam

# (3) K4 - zero istniejacych testow broniacych rozroznienia decyzja/inicjatywa
bash -c "grep -rln 'handleSaveAsDecision\|saveDeepThinkingDecision\|convertInitiative' tests/ src/ --include='*.test.ts' --include='*.test.tsx'"
bash -c "grep -n 'convertInitiative\|type:.initiative' tests/components/AIChat/MessageRenderer.context-save.test.tsx tests/components/AIChat/UnifiedChatPanel.test.tsx"
#   moje liczby: 6 plikow testowych wspominaja handleSaveAsDecision/saveDeepThinkingDecision,
#   ZERO z nich rozroznia typ 'decision' od 'initiative' - kontrakt K4 dzisiaj nie ma zadnej obrony

# (4) K8 - galaz navigateToMyWork nie woła API przed nawigacja
sed -n '1462,1565p' src/components/AIChat/UnifiedChatPanel.tsx
#   moje liczby: galaz `if (navigateToMyWork) {...}` (linie 1485-1538) konczy sie `return`
#   PRZED jedynym wywolaniem `Api.createIdeaFromChat` (linia 1540) - klik z czatu (navigateToMyWork
#   domyslnie true, patrz MessageRenderer.tsx:2196) NIE zapisuje niczego

# (5) K8 - blizniaczy, POPRAWNY wzorzec w tym samym pliku
sed -n '1567,1631p' src/components/AIChat/UnifiedChatPanel.tsx
#   moje liczby: saveMessageAsNote woła `Api.post('/my-work/notebook/pages', ...)` (linia 1590)
#   BEZWARUNKOWO, przed jakimkolwiek sprawdzeniem `navigateToMyWork` - to jest wzorzec do skopiowania

# (6) K8 - DRUGI, tez poprawny wzorzec (real id) w tym samym pliku
sed -n '2226,2266p' src/components/AIChat/UnifiedChatPanel.tsx
#   moje liczby: zmienna `isRealIdeaId` (linia 2234) i komentarz nad nia (linie 2226-2233)
#   opisuja DOKLADNIE kontrakt: prawdziwe id (nie zaczynajace sie od 'new-idea-') => hydrate()
#   idzie galezia Api.getMyIdea, nigdy Api.createMyIdea

# (7) K8 - jedyny straznik przed duplikatem w IdeaMapWorkspace
sed -n '350,356p' src/components/MyWork/IdeaMapWorkspace.tsx
sed -n '1632,1722p' src/components/MyWork/IdeaMapWorkspace.tsx
#   moje liczby: `isNewInitial = ideaId.startsWith('new-idea-')` (linia 353) jest JEDYNYM warunkiem
#   ktory decyduje miedzy galezia `Api.createMyIdea` (linia 1638) a `Api.getMyIdea` (linia 1722)

# (8) K4 - kanoniczny lejek inicjatyw istnieje i jest juz uzywany analogicznie
bash -c "grep -n 'export async function createInitiative' server/src/services/initiative/createInitiativeService.ts"
sed -n '1266,1293p' server/src/services/aiActionExecutor.ts
#   moje liczby: funkcja istnieje (linia 217 pliku), aiActionExecutor.ts:1273 juz ja woła
#   jako `funnelCreateInitiative` z {title, description, projectId, ownerBusinessId, priority}

# (9) K4 - mianownik: ile miejsc OMIJA dzis kanoniczny lejek (kontekst do decyzji, nie do naprawy)
bash -c "grep -rl 'INSERT INTO initiatives' server/src --include='*.ts' | grep -v __tests__ | grep -v '/scripts/' | wc -l"
bash -c "grep -rl 'INSERT INTO initiatives' server/src --include='*.ts' | grep -v __tests__ | grep -v '/scripts/'"
#   moje liczby: 20 plikow produkcyjnych zawiera bezposredni `INSERT INTO initiatives`
#   (w tym sam createInitiativeService.ts, ktory JEST lejkiem) - dokumentacja pliku twierdzi
#   ze lejek "zastepuje ~23 rozproszone INSERT" (audyt 2026-06-24), ale ten dlug nie jest
#   zamkniety w calosci. TO JEST KONTEKST, nie Twoje zadanie - uzywasz lejka dla NOWEGO
#   wolania z deep-thinking.routes.ts, nie naprawiasz pozostalych 19 miejsc.

# (10) K8 - server juz ma gotowa trase i realne id (TYLKO ODCZYT, dowod ze nic tu nie trzeba zmieniac)
sed -n '6889,6942p' server/src/routes/my-work.routes.ts
#   moje liczby: `ideaId = 'idea-' + Date.now() + '-' + losowy sufiks` (linia 6913),
#   kolumny source_conversation_id/source_message_id zapisywane w tym samym INSERT (linie 6926-6936)

# (11) R3 - inwentarz chatActionRegistry/chatActionHandler (14 typow akcji, zero tworzy rekord wprost)
bash -c "grep -n \"^  | '\" src/types/domain/chatActions.ts"
bash -c "grep -n 'CREATE_DRAFT_TASK\|CREATE_DRAFT_INITIATIVE\|CREATE_DRAFT_DECISION' server/src/services/aiActionExecutor.ts | head -10"
#   moje liczby: 14 wartosci ChatActionType; zero z nich woła bezposrednio create-task/decision/
#   initiative/idea/note/material - komentarz w chatActions.ts:11-12 odsyla do INNEGO mechanizmu
#   (aiActionExecutor.ts CREATE_DRAFT_*, wlasny cykl propozycja-akceptacja-wykonanie)

# (12) Warunki wspolne serii: liscie slownikow + 4 bezpieczniki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
df -h /
lsof -nP -iTCP:6441 -sTCP:LISTEN; lsof -nP -iTCP:5581 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day370 || true
#   moje liczby: pl 35204, en 33071; focus=0, list=0, artefakt=0
#   ★★ reach=1 (NIE 0!) - "New test-only files (3)": initiativeKartaRealnyRekord.test.ts,
#   macierz-sedno-20260905.test.tsx, AdminSettingsModule.healthSectionI18n.test.ts.
#   Te 3 pliki SA juz zacommitowane na markerze (dyzury 359-361, przodkowie HEAD) - baseline
#   docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json po prostu nie zostal
#   zaktualizowany o nie. TO JEST STAN ZASTANY, nie Twoj defekt - NIE wolno Ci uruchomic
#   --update-baseline (poza licencja). Warunek dla Ciebie: reach ma pozostac DOKLADNIE
#   przy tych samych 3 nazwach (zero NOWYCH dodatkow) PRZED i PO Twoich zmianach.
#   oczekiwane przy wydaniu: >=20 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day370-akcje-wiadomosci-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6441`. Twój JEDYNY port harnessu to `5581`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day370-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ paczki 05.09 (dyżury 367-373) — nie dotykasz: 367 (baza 6438 / harness 5578), 368 (6439/5579), 369 (6440/5580), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584). Twoje własne wyłącznie: baza **6441**, harness **5581**. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur naprawia potwierdzony defekt (K4, K8), nie wprowadza nowego elementu UI — reguła CLAUDE.md „zmiana zachowania widocznego przez właściciela = flaga? NIE dla naprawy defektu potwierdzonego” ma tu wprost zastosowanie. Nie dodajesz ani jednej flagi i nie zmieniasz wartości domyślnej żadnej istniejącej — w tym `INITIATIVE_FUNNEL_ENABLED` (przełącznik operacyjny kanonicznego lejka inicjatyw, dziś domyślnie włączony przez brak wartości `'false'`; WOLNO Ci go odczytać i uszanować jego stan w kodzie, tak jak robi to `aiActionExecutor.ts:1272`, ale NIE WOLNO Ci zmienić jego wartości domyślnej ani go usunąć). ★★ UWAGA SZCZEGÓLNA: `RUN_DB_TESTS`, `MOCK_DB`, `DB_TYPE`, `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` **nie są flagami funkcyjnymi produktu** — to przełączniki trybu pomiaru. Wolno Ci nimi sterować w komendzie i **musisz zapisać, którą wartość miała każda z nich w każdym przebiegu**. **Nie wolno Ci zmieniać ich wartości domyślnych w kodzie ani w konfiguracji testów**.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/services/aiActionExecutor.ts` (cudzy, szerszy mechanizm `CREATE_DRAFT_*` — czytasz jako wzorzec, nie zmieniasz), `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać/czytać w pomiarze.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY370_AKCJE_WIADOMOSCI_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — mój pomiar na markerze pokazuje, że sekcje doszły do `AF` (dyżur 365), więc następna wolna to `AG` (★ brief źródłowy mówił `AC` — to jest NIEAKTUALNE, zmierz sam komendą tuż przed commitem, bo równolegle piszą dyżury 367-369, 371-373) — oraz nowe pliki dowodowe pod `evidence/akcje-wiadomosci-20260905/` (katalog NIE ISTNIEJE na markerze — tworzysz go; ★ UWAGA: `evidence/370-v81-broader-results-kpi-roi-roi-realized-entry-v8-write-seam.md` to CUDZY plik z zupełnie innej numeracji, nie Twój, nie dotykasz). Plik postępu `/private/tmp/cx-day370-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day370-akcje-wiadomosci-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day370-akcje-wiadomosci-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
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
| `Z40` | ★★★ **ZAKAZ NOWEJ TABELI DLA INICJATYW.** `initiatives` ma dziś kanoniczny lejek tworzenia (`server/src/services/initiative/createInitiativeService.ts`); gałąź `saveType==='initiative'` w `deep-thinking.routes.ts` MUSI przez niego przejść, nie wolno Ci pisać własnego `INSERT INTO initiatives` ani nowej tabeli. ★★★ **ZAKAZ ASERCJI NA TEKŚCIE ŹRÓDŁA.** Nowy test nie może sprawdzać, że plik zawiera napis (`readFileSync`+`toContain` — zakaz). Ma wywołać handler/wyrenderować komponent i sprawdzić WYNIK: który wiersz w której tabeli powstał, jaki `ideaId` doszedł do nawigacji. ★★★ **ZAKAZ ZALICZENIA K8 BEZ DOWODU „PRZED NAWIGACJĄ”.** Sam fakt, że `Api.createIdeaFromChat` zostanie kiedyś wywołane, nie wystarcza — dowód musi pokazać KOLEJNOŚĆ wywołań: `Api.createIdeaFromChat` PRZED `setMyWorkIntent`/nawigacją, nie tylko efekt końcowy. ★★ **ZAKAZ DUPLIKATU PRZY DOMONTOWANIU `IdeaMapWorkspace`.** Po naprawie K8 otwarcie utworzonego pomysłu w workspace NIE MOŻE wywołać drugiego `Api.createMyIdea` — dowód mutacyjny: cofnij naprawę (przywróć prefiks `new-idea-`), test ma pokazać DWA wiersze `my_ideas` dla jednego kliknięcia; napraw z powrotem, ma zostać JEDEN. ★★ **ZAKAZ ZMIANY GAŁĘZI `saveType!=='initiative'` (decyzja).** Zachowanie „Zapisz jako decyzję” musi zostać BIT-DO-BITU takie samo — dowód: te same pola w `INSERT INTO ai_decision_outcomes`, ten sam kod odpowiedzi. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). **ZAKAZ porównania po liczbach zamiast po nazwach** (`Z37`). ★ **ZAKAZ NAPRAWY POZOSTAŁYCH DEFEKTÓW Z `00_ZESTAWIENIE.md` (K1, K2, K3, K5, K6, K7, K9, rodziny P2).** Ten dyżur naprawia WYŁĄCZNIE K4 i K8 — resztę wypisujesz w `R3`/raporcie z `plik:linia`, nie naprawiasz jej. | Bo oba defekty to ten sam kształt: przycisk obiecuje jeden rekord, a system cicho tworzy inny (K4) albo żaden (K8) — użytkownik wierzy, że jego decyzja/pomysł jest zapisany, a odkrywa brak dopiero później, w innym module, kiedy szuka rekordu, którego nie ma. Audyt z 2026-09-05 (`00_ZESTAWIENIE.md`) i sceptyk (`V1_weryfikacja_P1.md` pkt 5, `V2_weryfikacja_P1_i_probka.md` pkt 1) potwierdzili oba do końca łańcucha, aż do bazy danych. Naprawa jest tania — oba istniejące, żywe serwisy (kanoniczny lejek inicjatyw, `createIdeaFromChat`) już są w repo i już są używane gdzie indziej poprawnie; brakuje tylko okablowania. |

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
cd /private/tmp/cx-day370-akcje-wiadomosci

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day370-pg psql -U postgres -d cx370 \
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
cd /private/tmp/cx-day370-akcje-wiadomosci

docker run -d --name cx-day370-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx370 \
  -p 127.0.0.1:6441:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day370-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6441/cx370 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6441/cx370 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day370-akcje-wiadomosci && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6441/cx370 \
JWT_SECRET=cx370-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy jednostkowe frontu z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, np. `tests/components/AIChat/MessageRenderer.*.test.tsx`, `tests/components/AIChat/UnifiedChatPanel.test.tsx` (istniejące — sprawdź, że Twoja zmiana sygnatury `handleSaveAsDecision` ich nie wywraca) i NOWE pliki, które dodajesz. Testy serwerowe z cwd `server/`, `--config server/vitest.config.ts`, na realnym PostgreSQL z pełnym kompletem env `§0.2c` (B) — `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6441/cx370`. Dowód K4 wymaga DWÓCH realnych żądań HTTP `POST /api/ai/deep-thinking/save-decision` przez realny `ApiGateway`, z podpisanym JWT: jedno z `type:'decision'`, jedno z `type:'initiative'`, i policzenia wierszy w OBU tabelach (`ai_decision_outcomes`, `initiatives`) po każdym, oraz sprawdzenia izolacji organizacji (drugi org nie widzi utworzonej inicjatywy). Dowód K8 wymaga renderu `MessageRenderer`/wywołania `saveMessageAsIdea` z zamockowanym `Api.createIdeaFromChat`, z dowodem KOLEJNOŚCI wywołań (`createIdeaFromChat` przed `setMyWorkIntent`/nawigacją), plus osobnego testu na realnym Postgresie liczącego wiersze `my_ideas` przed/po. Wszystko z `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day370-akcje-wiadomosci-artefakty/<etykieta>.json`. --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day370-akcje-wiadomosci-artefakty/day370-akcje-wiadomosci.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day370-akcje-wiadomosci && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy jednostkowe frontu z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, np. `tests/components/AIChat/MessageRenderer.*.test.tsx`, `tests/components/AIChat/UnifiedChatPanel.test.tsx` (istniejące — sprawdź, że Twoja zmiana sygnatury `handleSaveAsDecision` ich nie wywraca) i NOWE pliki, które dodajesz. Testy serwerowe z cwd `server/`, `--config server/vitest.config.ts`, na realnym PostgreSQL z pełnym kompletem env `§0.2c` (B) — `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6441/cx370`. Dowód K4 wymaga DWÓCH realnych żądań HTTP `POST /api/ai/deep-thinking/save-decision` przez realny `ApiGateway`, z podpisanym JWT: jedno z `type:'decision'`, jedno z `type:'initiative'`, i policzenia wierszy w OBU tabelach (`ai_decision_outcomes`, `initiatives`) po każdym, oraz sprawdzenia izolacji organizacji (drugi org nie widzi utworzonej inicjatywy). Dowód K8 wymaga renderu `MessageRenderer`/wywołania `saveMessageAsIdea` z zamockowanym `Api.createIdeaFromChat`, z dowodem KOLEJNOŚCI wywołań (`createIdeaFromChat` przed `setMyWorkIntent`/nawigacją), plus osobnego testu na realnym Postgresie liczącego wiersze `my_ideas` przed/po. Wszystko z `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day370-akcje-wiadomosci-artefakty/<etykieta>.json`. --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day370-akcje-wiadomosci-artefakty/day370-akcje-wiadomosci.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day370-akcje-wiadomosci/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day370-pg psql -U postgres -d cx370 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day370-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Ścieżka pliku w briefie źródłowym jest nieaktualna.** Brief cytuje `server/src/routes/deep-thinking.routes.ts`; realna ścieżka na markerze to `server/src/routes/ai/deep-thinking.routes.ts` — zweryfikowane `ls`. (2) **`type`/`saveType` już dociera do serwera, ale ginie.** `deep-thinking.routes.ts:69` już odbiera pole `type` z body i `Api.saveDeepThinkingDecision` (front) już ma je w sygnaturze TS (`src/services/api.ts:2215`) — łańcuch API jest gotowy, brakuje TYLKO wywołania z dwoma różnymi wartościami i rozgałęzienia po stronie serwera. Nie buduj nowego pola. (3) **Wzorzec poprawny już istnieje W TYM SAMYM PLIKU.** `saveMessageAsNote` (bliźniak K8) i drugi wołacz `setMyWorkIntent` typu idea (`UnifiedChatPanel.tsx:2226-2266`, zmienna `isRealIdeaId`) pokazują dokładnie kontrakt, który masz odtworzyć — skopiuj KSZTAŁT, nie dopisuj równoległej trzeciej wersji. (4) **Kanoniczny lejek inicjatyw ma własną bramę jakości** (`assertCardMeetsFormula`, `CARD_CONTENT_HARD_GATE`) — blokuje TYLKO brak tytułu/placeholder, ale sprawdź to w kodzie i pokaż w dowodzie, że treść z Deep Thinking przez nią przechodzi. (5) **Strażnik przed duplikatem w `IdeaMapWorkspace` jest JEDNYM porównaniem stringów** (`ideaId.startsWith('new-idea-')`, linia 353) — jeżeli Twój `ideaId` po naprawie przez przypadek zacznie się od tego prefiksu, naprawa wygląda na zrobioną, a duplikat wraca; test mutacyjny musi to złapać. (6) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE`/`INSERT` niezależnie od treści. Dowód zapisu WYŁĄCZNIE na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false`). (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day370-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day370-akcje-wiadomosci-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: asercja zachowania, zakaz nowej tabeli, kolejnosc zapis-przed-nawigacja, zakaz duplikatu, zakaz zmiany galezi decyzji) · R1 (K4: rozgalezienie serwera po `type` + wywolanie kanonicznego lejka inicjatyw + slad audytu + dowod mutacyjny w obie strony — RDZEŃ) · R2 (K8: zapis synchroniczny `Api.createIdeaFromChat` PRZED nawigacja z prawdziwym `ideaId` + dowod braku duplikatu przy domontowaniu `IdeaMapWorkspace` — RDZEŃ) · R3 (KROK 0 rodzina: inwentarz WSZYSTKICH akcji czatu obiecujacych rekord — endpoint/tabela/przed czy po nawigacji, nie-rdzeń) · R4 (raport + jawna lista pozostalych defektow z `00_ZESTAWIENIE.md` + pytania do wlasciciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6441` albo `5581` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6441` albo `5581`** (`Z7`).

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

Audyt ekranu „Czat AI” z 2026-09-05 (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`)
znalazł 449 klikalnych elementów. Dwa z nich okłamują użytkownika co do tego, JAKI rekord
powstaje po kliknięciu — i oba sceptyk potwierdził do końca łańcucha, aż do bazy danych.

**Defekt K4 — „Konwertuj na inicjatywę” nie tworzy inicjatywy.** Przycisk z etykietą
`deepThinking.convertInitiative` pod wynikiem Deep Thinking woła **dokładnie ten sam handler**
co przycisk „Zapisz jako decyzję”:

```text
src/components/AIChat/MessageRenderer.tsx:2412 i :2422
  onClick={() => handleSaveAsDecision(msg.id, userVisibleContent)}   ← IDENTYCZNE, oba przyciski
```

Serwer (`server/src/routes/ai/deep-thinking.routes.ts:57-142`, endpoint `POST /save-decision`)
odbiera pole `type` z body (linia 69), ale używa go **wyłącznie jako tag w kolumnie JSON**
(`tags`, linia 124) — jedyny zapis to `INSERT INTO ai_decision_outcomes`. Tabela `initiatives`
nie jest tam w ogóle dotykana, niezależnie od tego, co front wyśle. **Cała funkcja „Konwertuj na
inicjatywę” jest fasadą od przycisku aż po tabelę bazy danych** (cytat z `V1_weryfikacja_P1.md`
pkt 5, werdykt POTWIERDZONY).

**Defekt K8 — „Zapisz jako pomysł” nie zapisuje niczego z poziomu czatu.** Domyślna ścieżka
(`navigateToMyWork:true`, jedyna używana przez przycisk realnie klikany w
`MessageRenderer.tsx:2196`) **nie wywołuje** `Api.createIdeaFromChat`; ustawia tylko
`useAppStore.setMyWorkIntent({...isNew:true, id:'new-idea-${Date.now()}'...})` i przełącza widok
na My Work:

```text
src/components/AIChat/UnifiedChatPanel.tsx:1462-1565 (saveMessageAsIdea)
  if (navigateToMyWork) { ...; return; }         ← wraca TUTAJ, PRZED linią 1540
  const created = await Api.createIdeaFromChat({...});   ← linia 1540, nigdy nieosiągana z czatu
```

Realne utworzenie rekordu zależy od tego, czy użytkownik w ogóle domontuje
`IdeaMapWorkspace` i czy jej `hydrate()` zdąży wywołać `Api.createMyIdea` — zależność od ekranu
docelowego, nie zapis (werdykt sceptyka w `V2_weryfikacja_P1_i_probka.md` pkt 1: „zły wzorzec, nie
brak zapisu”, P2 po weryfikacji — **ale wciąż realny defekt: klik w czacie sam z siebie niczego
nie zapisuje**).

**Oba defekty mają tanią naprawę, bo poprawny wzorzec już istnieje w tym samym pliku.**
`saveMessageAsNote` (`UnifiedChatPanel.tsx:1567-1631`) zapisuje **synchronicznie, przed**
jakąkolwiek nawigacją — to jest wzorzec do skopiowania dla K8. Dla K4 — inicjatywy mają dziś
jeden kanoniczny lejek tworzenia (`server/src/services/initiative/createInitiativeService.ts`),
który już jest wołany z analogicznego kontekstu „AI tworzy inicjatywę” przez
`server/src/services/aiActionExecutor.ts:1266-1317` (`_executeCreateInitiative`).

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| przyciski K4 z identycznym `onClick` | **2** (`:2412`, `:2422`) | `MessageRenderer.tsx` |
| co robi serwer z polem `type` | **tag w JSON, zero rozgałęzienia** | `deep-thinking.routes.ts:69,124` |
| ścieżka pliku serwera | **`server/src/routes/ai/deep-thinking.routes.ts`** | brief źródłowy cytował bez `/ai/` — NIEAKTUALNE |
| testy broniące rozróżnienia K4 | **0** | 6 plików wspominają handler, żaden nie rozróżnia typu |
| galąź `saveMessageAsIdea` z czatu | **`return` przed `Api.createIdeaFromChat`** | `UnifiedChatPanel.tsx:1485-1538` |
| wzorzec poprawny (K8, notatka) | zapis **przed** nawigacją | `UnifiedChatPanel.tsx:1590` |
| wzorzec poprawny (K8, realne id) | `isRealIdeaId`, komentarz kontraktu | `UnifiedChatPanel.tsx:2226-2266` |
| strażnik przed duplikatem `IdeaMapWorkspace` | `ideaId.startsWith('new-idea-')`, linia **353** | `IdeaMapWorkspace.tsx` |
| kanoniczny lejek inicjatyw | istnieje, wywoływany analogicznie | `createInitiativeService.ts` + `aiActionExecutor.ts:1273` |
| miejsca omijające dziś ten lejek | **20 plików produkcyjnych** (kontekst, nie Twoje zadanie) | `grep INSERT INTO initiatives` |
| trasa `/my-work/my-ideas/from-chat` | już generuje realne `ideaId` + ślad audytu | `my-work.routes.ts:6889-6942`, TYLKO ODCZYT |
| akcje `chatActionRegistry` tworzące rekord wprost | **0 z 14** | `chatActions.ts` — odsyła do INNEGO mechanizmu |
| liście słowników | **pl 35204 / en 33071** | `public/locales/**` |
| bezpieczniki kanonu | `focus=0 list=0 artefakt=0` | trzy z czterech — **czwarty patrz niżej** |
| `reachability --check-baseline` | **`reach=1`** (NIE 0!) | 3 pliki test-only już zacommitowane na markerze, baseline ich nie ma |

**★★ Kontekst dla dyżurów 367-369, 371-373 — NIE POWTARZASZ, NIE DOTYKASZ:** to jest osobna
paczka równoległa 05.09, każdy dyżur ma własny obszar, własne porty i własną gałąź — patrz
`§0.2` `Z7` i lista portów.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** identyczne `onClick` dla K4; **0** testów broniących rozróżnienia
decyzja/inicjatywa; galąź `navigateToMyWork` w `saveMessageAsIdea` kończy się `return` **przed**
jedynym wywołaniem `Api.createIdeaFromChat`; strażnik przed duplikatem w `IdeaMapWorkspace` to
**jedno** porównanie stringów (`ideaId.startsWith('new-idea-')`, linia **353**); kanoniczny lejek
inicjatyw **istnieje** i jest już wołany analogicznie z `aiActionExecutor.ts:1273`; **20** plików
produkcyjnych dziś omija ten lejek (kontekst); trasa `from-chat` już generuje realne id i ślad
audytu (TYLKO ODCZYT); **0 z 14** akcji `chatActionRegistry` tworzy rekord wprost; liście
słowników **pl 35204**, **en 33071**; trzy bezpieczniki kanonu kończą się kodem **0**, czwarty
(`reachability --check-baseline`) kończy się kodem **1** z powodu 3 już-zacommitowanych plików
test-only spoza baseline (stan zastany, nie Twój defekt).

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: PRZYCISK · HANDLER FRONTU · TRASA · SERWIS · REPOZYTORIUM · TESTY · SŁOWNIKI

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Przycisk K4 (front)** | `src/components/AIChat/MessageRenderer.tsx:319` (typ propa), `:2412`, `:2422` (dwa `onClick`) | **★ WĄSKA LICENCJA:** dodać parametr rozróżniający typ do drugiego przycisku i do sygnatury propa. **Zakaz zmiany etykiet, ikon i reszty komponentu** | Brief z `plik:linia` |
| **Handler K4 (front)** | `src/components/AIChat/UnifiedChatPanel.tsx:5627-5645` (`handleSaveAsDecision`), `:6418` (montaż propa) | **★ WĄSKA LICENCJA:** rozszerzyć sygnaturę o opcjonalny `type` i przekazać go do `Api.saveDeepThinkingDecision`. **Zakaz zmiany zachowania dla `type` nieobecnego/`'decision'`** | Brief |
| **Handler K8 (front, RDZEŃ)** | `src/components/AIChat/UnifiedChatPanel.tsx:1462-1565` (`saveMessageAsIdea`) | **★ PEŁNA LICENCJA w zakresie `R2`:** zapis synchroniczny przed nawigacją, przekazanie realnego `ideaId`. **Zakaz zmiany sygnatury funkcji widocznej dla wywołujących** (`handleSaveAsIdea` wywołuje ją z tymi samymi argumentami) | — |
| **Wzorce referencyjne K8 (front)** | `UnifiedChatPanel.tsx:1567-1631` (`saveMessageAsNote`), `:2150-2266` (drugi wołacz `setMyWorkIntent`) | **TYLKO ODCZYT — kopiujesz KSZTAŁT, nie plik.** Zmiana tu jest naruszeniem rozłączności | Opis w raporcie |
| **Klient API (front)** | `src/services/api.ts:2212-2229` (`saveDeepThinkingDecision`), `:5757-5779` (`createIdeaFromChat`) | **TYLKO ODCZYT — prawdopodobnie ZERO zmian**, obie funkcje już mają potrzebne pola w sygnaturze TS. Jeżeli `R1`/`R2` udowodni brakujące pole — wąska licencja na jego dodanie, opisana w raporcie | Brief z dowodem, czego brakuje |
| **Guard przeciw duplikatowi (front)** | `src/components/MyWork/IdeaMapWorkspace.tsx:353` (`isNewInitial`), `:1632-1721` (`hydrate()`) | **TYLKO ODCZYT, chyba że `R2` udowodni realną lukę** — wtedy wąska licencja na minimalną poprawkę guardu, z dowodem mutacyjnym pokazującym dziurę PRZED zmianą | Brief z dowodem |
| **Typy pomocnicze idei (front)** | `src/components/MyWork/ideaEntryTypes.ts`, `src/components/MyWork/ideaWorkspaceState.ts` | **TYLKO ODCZYT** | Opis w raporcie, czy wymagają dotknięcia |
| **Rejestr akcji czatu (front, inwentarz `R3`)** | `src/services/chatActionRegistry.ts`, `src/services/chatActionHandler.ts`, `src/types/domain/chatActions.ts` | **TYLKO ODCZYT** — produktem `R3` jest tabela w raporcie, nie zmiana kodu | Tabela w raporcie |
| **Trasa serwerowa K4 (RDZEŃ)** | `server/src/routes/ai/deep-thinking.routes.ts:57-142` (`POST /save-decision`) | **★ WĄSKA LICENCJA:** rozgałęzienie po `saveType`; gałąź `'initiative'` woła kanoniczny lejek; gałąź inna (domyślnie `'decision'`) zostaje **bit-do-bitu identyczna**. **Zakaz zmiany URL, metody, middleware `verifyToken`** | — |
| **Kanoniczny lejek inicjatyw** | `server/src/services/initiative/createInitiativeService.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Funkcja `createInitiative(orgId, input, options)` już robi wszystko (walidacja, zakotwiczenie projektu, ślad audytu). Jeżeli okaże się niewystarczająca — brief z `plik:linia` i pytanie do właściciela, **nie modyfikujesz jej** | Brief |
| **Wzorzec wołania (referencja)** | `server/src/services/aiActionExecutor.ts:1266-1317` (`_executeCreateInitiative`) | **TYLKO ODCZYT — cudzy, szerszy mechanizm `CREATE_DRAFT_*`.** Kopiujesz KSZTAŁT wywołania lejka, nie dotykasz pliku i nie wołasz z niego niczego innego | Opis w raporcie |
| **Trasa serwerowa K8** | `server/src/routes/my-work.routes.ts:6889-6978` (`POST /my-ideas/from-chat`) | **TYLKO ODCZYT — już generuje realne `ideaId` i ślad audytu.** Twoim dowodem jest pokazanie, że nic tu nie trzeba zmieniać | Brief potwierdzający brak potrzeby zmiany |
| **Pozostałe middleware / bramy platformowe** | `server/src/middleware/**` (w tym `auth.middleware.ts`), `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA.** Kładziesz WYŁĄCZNIE w `tests/`, nigdy pod `src/`/`server/src/` | — |
| **Testy istniejące dotykające handlerów K4** | `tests/components/AIChat/UnifiedChatPanel.test.tsx`, `tests/components/AIChat/MessageRenderer.context-save.test.tsx`, `MessageRenderer.direction.test.tsx`, `MessageRenderer.policy.test.tsx`, `MessageRenderer.messageActions.test.tsx`, `tests/components/MyWork/UnifiedNodeDetailDrawer.test.tsx` | **★ WĄSKA LICENCJA:** wolno zaktualizować mocki/wywołania, które Twoja zmiana sygnatury wywraca. **Zakaz osłabienia istniejących asercji** | — |
| **Produkt UI poza wskazanym zakresem** | `src/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Słowniki** | `public/locales/**` | **NIETYKALNE DO ZAPISU, chyba że `R1`/`R2` wymaga nowego klucza i18n** — wtedy wyłącznie dopisywanie, parytet PL+EN, liście nie mogą zmaleć | Opis w raporcie |
| **Dowody audytu 05.09** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**` | **TYLKO ODCZYT** | — |
| **Nowe dowody** | `evidence/akcje-wiadomosci-20260905/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **NIETYKALNE DO ZAPISU — żaden wiersz, żaden moduł** | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY370_AKCJE_WIADOMOSCI_REPORT.md` (**NOWY**) | `R4` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Cudze tereny (paczka 367-373)** | pozostałe obszary dyżurów 367, 368, 369, 371, 372, 373 (porty i pliki rozłączne, patrz `§0.2` `Z7`) | **TYLKO ODCZYT** | Opis w raporcie |
| **Reszta defektów `00_ZESTAWIENIE.md`** | K1, K2, K3, K5, K6, K7, K9, wszystkie rodziny P2 | **TYLKO ODCZYT — poza zakresem tego dyżuru** | Wpis w `R3`/raporcie: `plik:linia`, opis, rekomendacja |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35204, en 33071

# (b) cztery bezpieczniki - TRZY maja konczyc sie kodem 0, CZWARTY ma stan zastany 1
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: focus=0, list=0, artefakt=0
#   ★★ reach=1 na MARKERZE, PRZED Twoja praca — 3 pliki test-only juz zacommitowane
#   (dyzury wczesniejsze), baseline nie zaktualizowany. NIE naprawiasz tego (poza licencja,
#   --update-baseline nie jest Twoim narzedziem). Warunek: PO Twoich zmianach `reach` ma
#   nadal zglaszac DOKLADNIE te same 3 nazwy, zero nowych dodatkow. Jezeli Twoje nowe pliki
#   testowe (R1/R2) trafia w klasyfikacje "test-only" i podbija reach o wiecej niz te 3 -
#   to jest STOP MERYTORYCZNY do opisania, nie cichy update baseline.
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | przyciski K4 z identycznym `onClick` | `2` | komenda (1) z `§0.3` | TAK — czyta plik komponentu |
| 2 | co serwer robi z `type` | tag JSON, zero rozgałęzienia | komenda (2) | TAK — czyta trasę |
| 3 | testy broniące K4 dziś | `0` | komenda (3) | TAK |
| 4 | linia `return` przed zapisem K8 | `1485-1538` | komenda (4) | TAK |
| 5 | wzorzec poprawny K8 (notatka) | linia `1590` | komenda (5) | TAK |
| 6 | wzorzec poprawny K8 (realne id) | linie `2226-2266` | komenda (6) | TAK |
| 7 | linia strażnika duplikatu | `353` | komenda (7) | TAK |
| 8 | kanoniczny lejek — istnieje i wołany analogicznie | tak, `aiActionExecutor.ts:1273` | komenda (8) | TAK |
| 9 | pliki omijające lejek dziś | `20` | komenda (9) | TAK — kontekst, nie zadanie |
| 10 | trasa `from-chat` — realne id + ślad | tak, linia `6913`, `6926-6936` | komenda (10) | TAK |
| 11 | akcje `chatActionRegistry` tworzące rekord | `0 z 14` | komenda (11) | TAK |
| 12 | liście słowników PL/EN | `35204` / `33071` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |
| 13 | `reach --check-baseline` na markerze | `1` (3 pliki test-only) | blok (b) | TAK — stan zastany, nie Twój defekt |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY370_AKCJE_WIADOMOSCI_REPORT.md` ·
`evidence/akcje-wiadomosci-20260905/**` (nowe) ·
`src/components/AIChat/MessageRenderer.tsx` (drugi `onClick` + typ propa) ·
`src/components/AIChat/UnifiedChatPanel.tsx` (`handleSaveAsDecision`, `saveMessageAsIdea`) ·
`server/src/routes/ai/deep-thinking.routes.ts` (rozgałęzienie `saveType`).

**Zapisujesz WARUNKOWO:**
`src/services/api.ts` (wyłącznie jeśli `R1`/`R2` udowodni brakujące pole w sygnaturze) ·
`src/components/MyWork/IdeaMapWorkspace.tsx` (wyłącznie z dowodem realnej luki w `R2`) ·
istniejące pliki testowe wypisane w tabeli licencji (mocki po zmianie sygnatury) ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`public/locales/**` (wyłącznie dopisywanie, jeśli potrzebny nowy klucz) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**` (bez dowodu potrzeby) ·
`server/src/services/initiative/createInitiativeService.ts` ·
`server/src/services/aiActionExecutor.ts` ·
`server/src/routes/my-work.routes.ts` ·
`src/components/AIChat/UnifiedChatPanel.tsx` funkcje `saveMessageAsNote` (`:1567-1631`) i drugi
wołacz `setMyWorkIntent` (`:2150-2266`) — TYLKO ODCZYT, wzorce referencyjne ·
`server/src/middleware/**`, `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts` ·
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` ·
`src/services/chatActionRegistry.ts`, `src/services/chatActionHandler.ts` (inwentarz `R3` jest
tylko do odczytu, produktem jest tabela w raporcie).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day370-akcje-wiadomosci
git diff --name-only --cached | tee /private/tmp/cx-day370-akcje-wiadomosci-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|createInitiativeService|aiActionExecutor|my-work\.routes|^server/src/middleware/|ApiGateway|^server/src/Gateway|saveMessageAsNote|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|MODULE_ACCEPTANCE|reachability\.baseline|chatActionRegistry|chatActionHandler' /private/tmp/cx-day370-akcje-wiadomosci-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — PIĘĆ TWARDYCH ZASAD TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Nowy test wywołuje handler albo
renderuje komponent i sprawdza WYNIK: który wiersz w której tabeli powstał, jaki `ideaId` doszedł
do nawigacji, co zwrócił endpoint. `readFileSync` + `toContain` nie jest dowodem.

**(2) Zakaz nowej tabeli dla inicjatyw.** `initiatives` ma dziś kanoniczny lejek tworzenia
(`createInitiativeService.ts`). Gałąź `saveType==='initiative'` MUSI przez niego przejść.

**(3) Kolejność ma znaczenie dla K8.** Dowód nie może pokazywać tylko „rekord w końcu powstał” —
musi pokazywać, że `Api.createIdeaFromChat` wykonało się **przed** `setMyWorkIntent`/nawigacją.
Sam efekt końcowy bez dowodu kolejności jest niewystarczający.

**(4) Zakaz duplikatu.** Po naprawie K8, otwarcie utworzonego pomysłu w `IdeaMapWorkspace` NIE
MOŻE wywołać drugiego zapisu. Dowód mutacyjny: cofnij naprawę (przywróć prefiks `new-idea-`) —
test ma pokazać DWA wiersze `my_ideas` dla jednego kliknięcia; napraw z powrotem — ma zostać
JEDEN.

**(5) Zakaz zmiany zachowania gałęzi „decyzja”.** „Zapisz jako decyzję” musi zostać
bit-do-bitu takie samo po naprawie K4 — te same pola w `INSERT INTO ai_decision_outcomes`, ten
sam kod odpowiedzi, ten sam kształt `tags`.

**Wymagany dowód:** pięć zdań w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — K4: ROZGAŁĘZIENIE „DECYZJA” / „INICJATYWA” (rdzeń)

1. **Pokaż defekt na dziś, dosłownie.** Wykonaj DWA realne żądania HTTP
   `POST /api/ai/deep-thinking/save-decision` przez realny `ApiGateway`, z podpisanym JWT — jedno
   z `{ type: 'decision', ... }`, jedno z `{ type: 'initiative', ... }` — i policz wiersze w
   `ai_decision_outcomes` oraz `initiatives` PRZED i PO każdym. **Oczekiwany wynik na dziś:** oba
   żądania wstawiają wiersz WYŁĄCZNIE do `ai_decision_outcomes`, zero wierszy w `initiatives`
   niezależnie od `type`. To jest Twój dowód wyjściowy.
2. **Rozgałęzienie w `server/src/routes/ai/deep-thinking.routes.ts`.** Gałąź `saveType ===
   'initiative'` (po normalizacji, uwzględnij wielkość liter i puste wartości) woła
   `createInitiative(orgId, input, options)` z `server/src/services/initiative/
   createInitiativeService.ts`, z tytułem wyprowadzonym z tej samej logiki `extractSection`, co
   dziś buduje `executiveSummary`/`recommendation` dla decyzji, oraz z audytowym `sourceType`
   (np. `'ai_chat_deep_thinking'`) i `sourceId` (`conversationId` albo `sessionId` — uzasadnij
   wybór) tak, żeby ślad prowadził z powrotem do wiadomości źródłowej (decyzja właściciela
   02.09: **Inicjatywy = ślad audytu, wariant B**). Gałąź inna (domyślnie `'decision'`) zostaje
   **bez zmian**.
3. **Front.** Rozszerz sygnaturę `handleSaveAsDecision` (`UnifiedChatPanel.tsx:5627-5645`) o
   opcjonalny trzeci parametr typu (`'decision' | 'initiative'`, domyślnie `'decision'`),
   przekaż go do `Api.saveDeepThinkingDecision`. W `MessageRenderer.tsx` przycisk „Convert to
   Initiative” (`:2422`) woła `handleSaveAsDecision(msg.id, userVisibleContent, 'initiative')`,
   przycisk „Save as Decision” (`:2412`) zostaje bez zmian (albo jawnie `'decision'` —
   równoważne). Zaktualizuj typ propa w interfejsie `MessageRendererProps` (`:319`).
4. **KROK 0 dla rodziny.** Zanim uznasz `R1` za zamknięte, zmierz komendą (9) z `§0.3`, ile
   plików produkcyjnych dziś omija kanoniczny lejek (`grep INSERT INTO initiatives`) i napisz w
   raporcie, czy Twoja nowa gałąź jest jedynym NOWYM konsumentem, czy dołącza do istniejącej
   listy — to jest kontekst do pytania dla właściciela, nie zadanie do naprawy w tym dyżurze.
5. **Powtórz dowód z punktu 1 PO naprawie.** Te same dwa żądania, te same JWT, ten sam org.
   Oczekiwany wynik: `type:'decision'` → wiersz WYŁĄCZNIE w `ai_decision_outcomes`, ZERO nowych w
   `initiatives`; `type:'initiative'` → wiersz WYŁĄCZNIE w `initiatives` (z `organization_id`
   wołającego, `source_type`/`source_id` wypełnione), ZERO nowych w `ai_decision_outcomes`.
6. **Izolacja organizacji.** Zapytaj `GET` listy inicjatyw jako użytkownik INNEJ organizacji —
   utworzona inicjatywa nie może się tam pojawić.
7. **Dowód mutacyjny.** Cofnij rozgałęzienie (`cp` ze `SCRATCH`) — powtórzone żądanie
   `type:'initiative'` ma z powrotem wstawić wiersz do `ai_decision_outcomes` (czerwony test);
   przywróć naprawę — ma wrócić do zielonego. `git diff` po cofnięciu **pusty**.
8. **Nie osłabiasz istniejących testów.** Zaktualizuj mocki w plikach z tabeli licencji, jeżeli
   zmiana sygnatury `handleSaveAsDecision` je wywala — bez usuwania asercji.

**Wymagany dowód:** dwa żądania PRZED (liczniki obu tabel) · diff rozgałęzienia serwera i
sygnatury frontu · dwa żądania PO (liczniki obu tabel, izolacja org) · mutacja w obie strony ·
lista testów istniejących zaktualizowanych, z diffem. **Commit po `R1`.**

## R2 — K8: ZAPIS SYNCHRONICZNY PRZED NAWIGACJĄ (rdzeń)

1. **Pokaż defekt na dziś, dosłownie.** Wyrenderuj/wywołaj `saveMessageAsIdea` z
   `navigateToMyWork: true` (domyślna ścieżka realnego kliknięcia) z zamockowanym
   `Api.createIdeaFromChat` — dowód: mock **nie został wywołany ani razu**, mimo że
   `setMyWorkIntent` i nawigacja się wykonały.
2. **Napraw `saveMessageAsIdea` (`UnifiedChatPanel.tsx:1462-1565`).** Zamiast wczesnego
   `return` w gałęzi `navigateToMyWork`, wywołaj `Api.createIdeaFromChat({...})` (te same
   argumenty, co dziś w gałęzi `navigateToMyWork:false`, `:1540-1547`) **PRZED**
   `setMyWorkIntent`/nawigacją, i użyj `created.ideaId` zamiast `` `new-idea-${Date.now()}` ``
   jako `id` w intencji. Zachowaj `creationPayload`/`seedIntent` tak, żeby
   `IdeaMapWorkspace.hydrate()` miał czym zasilić mapę początkową (sprawdź, czy realne `ideaId` z
   `from-chat` wymaga innej gałęzi hydratacji niż dziś zakładana — patrz punkt 4).
3. **Dowód kolejności.** Test musi jawnie sprawdzić, że `Api.createIdeaFromChat` zostało
   wywołane PRZED `setMyWorkIntent`/`setCurrentView` (kolejność wywołań mocków w asercji), nie
   tylko że oba się wykonały.
4. **KROK 0 — rodzina wejść do `IdeaMapWorkspace` z intencją.** Sprawdź WSZYSTKIE miejsca, które
   ustawiają `myWorkIntent.open.type==='idea'` z `data.isNew` z poziomu czatu — dziś są dokładnie
   dwa w `UnifiedChatPanel.tsx` (`:1462-1565`, ten naprawiany, i `:2150-2266`, już poprawny wzorzec
   z realnym `ideaId`). Upewnij się, że Twoja naprawa produkuje `ideaId` w kształcie, który
   `IdeaMapWorkspace.tsx:353` (`isNewInitial = ideaId.startsWith('new-idea-')`) rozpozna jako
   NIE-nowy (czyli NIE zaczyna się od `new-idea-` — realne id z `from-chat` ma postać
   `idea-<timestamp>-<losowe>`, sprawdź to explicite w teście, nie zakładaj).
5. **Dowód braku duplikatu.** Zamontuj `IdeaMapWorkspace` z `ideaId` zwróconym przez naprawę —
   `hydrate()` ma pójść gałęzią `Api.getMyIdea` (istniejący rekord), **NIE** gałęzią
   `Api.createMyIdea`. Policz wywołania `Api.createMyIdea` — mają wynosić `0`.
6. **Dowód mutacyjny.** Cofnij naprawę (`cp` ze `SCRATCH`, przywracając wczesny `return`) —
   test z punktu 1 ma z powrotem zaczerwienić się (mock niewywołany); przywróć naprawę — ma
   zzielenieć. Osobno: podmień realne `ideaId` z powrotem na prefiks `new-idea-` — test z punktu
   5 ma pokazać wywołanie `Api.createMyIdea` (duplikat); przywróć — ma wrócić do `0`. `git diff`
   po każdym cofnięciu **pusty**.
7. **Dowód na realnym PostgreSQL.** Osobny test integracyjny: klik → policz wiersze `my_ideas`
   dla danego `sourceConversationId`/`sourceMessageId` PRZED i PO — ma przybyć dokładnie jeden;
   odśwież/zamontuj workspace ponownie z tym samym `ideaId` — licznik ma zostać ten sam (zero
   duplikatu po powtórnym wejściu).
8. **Toast i UX.** Sprawdź, czy istniejący toast (`myWork.ideas.sentToWorkspaceToast`,
   „Opened in Ideas workspace”) jest nadal uczciwy po naprawie (teraz rekord JUŻ istnieje w
   momencie jego wyświetlenia) — jeśli tekst sugerował wcześniej co innego, zanotuj to jako
   drobną poprawkę tekstu w raporcie (nie zmieniaj klucza i18n bez potrzeby).

**Wymagany dowód:** test „mock niewywołany” PRZED naprawą · diff naprawy `saveMessageAsIdea` ·
test kolejności wywołań · test „brak duplikatu” przy domontowaniu `IdeaMapWorkspace` · mutacja w
obie strony (dwa niezależne cofnięcia) · dowód na realnym PostgreSQL (licznik `my_ideas` przed/po
+ powtórne wejście). **Commit po `R2`.**

## R3 — KROK 0 RODZINA: INWENTARZ WSZYSTKICH AKCJI CZATU TWORZĄCYCH REKORD (nie-rdzeń)

**Nie naprawiasz nic w tej pozycji poza K4 i K8 — wyłącznie inwentaryzujesz i raportujesz.**

1. Wypisz WSZYSTKIE miejsca w `src/components/AIChat/**` i `src/services/chatAction*.ts`, które
   obiecują (etykietą, komentarzem albo nazwą funkcji) utworzenie: zadania, decyzji, inicjatywy,
   pomysłu, notatki lub materiału. Punkt startowy: `saveMessageAsIdea` (K8, naprawiony w `R2`),
   `saveMessageAsNote` (`:1567-1631`), `handleSaveAsDecision` (K4, naprawiony w `R1`), oraz — jeśli
   istnieją — analogiczne handlery dla zadania i materiału (sprawdź `grep -n "handleSaveAs\|
   saveMessageAs"` w całym `UnifiedChatPanel.tsx`, nie tylko miejsca już wymienione w tej
   instrukcji).
2. Osobno zbadaj `chatActionRegistry.ts`/`chatActionHandler.ts`/`chatActions.ts` — moje
   pomiar (komenda 11 z `§0.3`) pokazuje **14 typów akcji, zero z nich tworzy rekord wprost**;
   `ASSIGN_INTERVIEW` jest najbliższy (tworzy przypisanie wywiadu synchronicznie, przed
   jakąkolwiek nawigacją — dobry wzorzec, zanotuj go jako TAKI w tabeli). Komentarz w
   `chatActions.ts:11-12` odsyła do `server/src/services/aiActionExecutor.ts:911-920`
   (`CREATE_DRAFT_TASK`/`CREATE_DRAFT_INITIATIVE`/`CREATE_DRAFT_DECISION`) — to jest INNY,
   znacznie szerszy mechanizm z własnym cyklem propozycja→akceptacja→wykonanie (`ai_actions`),
   nie wołany bezpośrednio z przycisków w `MessageRenderer`. Opisz w raporcie, jak te dwa
   mechanizmy (bezpośrednie `handleSaveAs*` kontra `ai_actions`/`aiActionExecutor`) się mają do
   siebie — czy to zamierzona dwutorowość, czy dług.
3. **Tabela obowiązkowa w raporcie**, jeden wiersz na każde znalezione miejsce: nazwa
   akcji/handlera · plik:linia · endpoint HTTP (jeśli jest) · tabela docelowa w bazie · zapis
   PRZED czy PO nawigacji (albo „brak zapisu” jeśli defekt jak K8 przed naprawą) · czy naprawiony
   w tym dyżurze (TAK dla K4/K8, NIE dla reszty) · rekomendacja jednym zdaniem dla pozycji NIE.
4. Dołącz do tej samej tabeli — jednym zdaniem, z `plik:linia` — pozostałe defekty z
   `00_ZESTAWIENIE.md`, które NIE są K4/K8 (K1, K2, K3, K5, K6, K7, K9 i rodziny P2 istotne dla
   akcji na wiadomościach), bez naprawiania ich.

**Wymagany dowód:** tabela inwentarza (min. 6 wierszy: idea, notatka, decyzja, inicjatywa,
`ASSIGN_INTERVIEW`, jedno miejsce z `aiActionExecutor.ts` CREATE_DRAFT_*) · komenda i wynik grepu
użytego do jej zbudowania · akapit o relacji `handleSaveAs*` kontra `ai_actions`. **Commit po
`R3`.**

## R4 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: dowód defektu K4 na dziś i dowód naprawy (dwa żądania PRZED/PO, izolacja org,
mutacja w obie strony) · dowód defektu K8 na dziś i dowód naprawy (kolejność wywołań, brak
duplikatu, dowód na realnym Postgresie, mutacja w obie strony) · tabelę inwentarza z `R3` ·
listę rozbieżności wobec liczb tej instrukcji (w tym `reach=1` na markerze i ścieżka
`server/src/routes/ai/deep-thinking.routes.ts` różna od brifu źródłowego) · **niepustą sekcję
„TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA”.** Każdy defekt z
`00_ZESTAWIENIE.md` inny niż K4/K8 (K1, K2, K3, K5, K6, K7, K9, rodziny P2), z `plik:linia` i
jednozdaniowym opisem — bez naprawiania. Dołącz tu też **20 plików** zmierzonych w `R1` punkt 4,
które dziś omijają kanoniczny lejek inicjatyw (kontekst dla przyszłego porządkowania, nie
zadanie tego dyżuru).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Pierwsze: czy `sourceType`/
`sourceId` wybrane w `R1` (np. `'ai_chat_deep_thinking'` + `conversationId`) to właściwy kształt
śladu audytu dla inicjatyw tworzonych z czatu, czy właściciel woli inny identyfikator (np.
`messageId`) — **tak/nie/inny**. Drugie: czy toast K8 wymaga zmiany treści po naprawie (rekord
istnieje wcześniej niż wcześniej sugerował tekst) — **tak/nie**. Sekcja **nie może być pusta**.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md` dopisujesz
o **pierwszej wolnej literze** — mój pomiar na markerze pokazuje `AF` jako ostatnią użytą (dyżur
365), więc `AG` jest kandydatem, ale sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą dyżury 367-369 i 371-373.

**Commit po `R4`.**

## Próg odbioru

**Oba defekty domknięte: „Konwertuj na inicjatywę” tworzy wyłącznie wiersz w `initiatives`
(przez kanoniczny lejek, z izolacją organizacji i śladem audytu do wiadomości źródłowej), zero
wierszy w `ai_decision_outcomes`; „Zapisz jako decyzję” zostaje bit-do-bitu bez zmian; „Zapisz
jako pomysł” zapisuje rekord SYNCHRONICZNIE, przed nawigacją, bez duplikatu przy późniejszym
otwarciu workspace — wszystko z dowodem mutacyjnym w obie strony i na realnym PostgreSQL.
Inwentarz `R3` kompletny, tabelaryczny, z jasnym rozróżnieniem naprawione/zgłoszone.**

Odbiorca odrzuci dyżur, w którym: „Convert to Initiative” nadal woła ten sam handler co „Save as
Decision”; naprawa K4 pisze bezpośredni `INSERT INTO initiatives` zamiast wołać kanoniczny lejek;
dowód K8 pokazuje tylko efekt końcowy bez dowodu kolejności wywołań; po naprawie K8 domontowanie
`IdeaMapWorkspace` tworzy drugi rekord; zachowanie gałęzi „decyzja” się zmieniło; naprawiono
choćby jeden z K1/K2/K3/K5/K6/K7/K9 zamiast go zaraportować; albo zmienił się stan choćby jednego
wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „K4 naprawiony i udowodniony
mutacyjnie, K8 zatrzymany na kroku 4, bo realny kształt `ideaId` z `from-chat` wymaga decyzji
właściciela o polu lineage” — **jest pełnowartościowym wynikiem**, nawet jeżeli żaden z
pozostałych defektów audytu nie zostanie ruszony.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.** Wynik
ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw K4 przez rozgałęzienie” vs „nie zmieniaj zachowania decyzji” | `R0` (5) i `R1` punkt 2: gałąź `'decision'` zostaje bez zmian, dowód to identyczne pola `INSERT` przed/po |
| „Użyj kanonicznego lejka inicjatyw” vs „lejek jest tylko do odczytu” | Tabela licencji: WOŁASZ funkcję, nie modyfikujesz jej pliku; jeśli niewystarczająca — brief + pytanie, nie edycja |
| „20 miejsc omija lejek” vs „napraw to” | `R1` punkt 4 i `R4`: to jest KONTEKST zmierzony, nie zadanie tego dyżuru — idzie do sekcji „CO NADAL WYMAGA OSOBNEGO ZLECENIA” |
| „Zapisz przed nawigacją” vs „nie zmieniaj sygnatury `saveMessageAsIdea`” | `R2` punkt 2: sygnatura funkcji (parametry wejściowe) zostaje, zmienia się WYŁĄCZNIE ciało (kolejność operacji wewnątrz) |
| „Realne `ideaId` unika duplikatu” vs „strażnik to jeden `startsWith`” | `R2` punkt 4: dowód musi jawnie sprawdzić kształt `ideaId` wobec strażnika, nie zakładać zgodności |
| „Inwentaryzuj WSZYSTKO w `R3`” vs „napraw TYLKO K4/K8” | `R3` nagłówek i `Z17`: produktem jest tabela, nie kod; naprawa poza K4/K8 jest zakazana explicite w `ZAKAZ_WLASCIWY_TEMU_DYZUROWI` |
| „`reach` bezpiecznik ma dawać 0” vs „na markerze daje 1” | `§0.3` komenda (12) i „WARUNKI WSPÓLNE”: stan zastany, nie Twój defekt; warunkiem jest brak NOWYCH dodatków, nie zejście do zera |
| „Brief źródłowy podaje ścieżkę serwera” vs „realna ścieżka ma segment `/ai/`” | Zmierzone `§0.3` komenda (2); Twój pomiar jest wiążący (`Z24`), rozbieżność zapisujesz wprost |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy (367-373)” | `R4`: literę sprawdzasz komendą tuż przed commitem; mój pomiar `AF`→`AG` może być już nieaktualny w chwili Twojego commita |
| „Kopiuj wzorzec z `saveMessageAsNote`” vs „ten plik jest tylko do odczytu” | Tabela licencji: CZYTASZ kształt, nie edytujesz linii 1567-1631; zmiana tam jest naruszeniem rozłączności |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `MessageRenderer.tsx:319,2412,2422`, `UnifiedChatPanel.tsx:1462-1565,1567-1631,2150-2266,5627-5645,6418`, `api.ts:2212-2229,5757-5779`, `IdeaMapWorkspace.tsx:353,1632-1721`, `deep-thinking.routes.ts:57-142` (ścieżka z segmentem `/ai/` zweryfikowana `ls`), `createInitiativeService.ts:217`, `aiActionExecutor.ts:1266-1317`, `my-work.routes.ts:6889-6978` — wszystkie sprawdzone bezpośrednio na markerze; `evidence/akcje-wiadomosci-20260905/` **jawnie oznaczone jako nieistniejące** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 13 wierszy, wszystkie zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — przycisk · handler frontu K4 · handler frontu K8 (rdzeń) · wzorce referencyjne · klient API · guard duplikatu · typy pomocnicze · rejestr akcji czatu · trasa serwerowa K4 · lejek inicjatyw · wzorzec wołania · trasa serwerowa K8 · middleware · nowe testy · testy istniejące · UI poza zakresem · infrastruktura testów · słowniki · dowody audytu · nowe dowody · macierz · rejestr znalezisk · raport · cudze tereny paczki 367-373 · reszta defektów audytu |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka trasy + dwóch plików frontu, `R2` dotyka jednej funkcji, `R3` tylko czyta i raportuje, `R4` składa raport |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6441/5581 wolne (`lsof` przy wydaniu), brak kontenera `cx-day370-pg`, brak gałęzi `codex/day370-*` i worktree; 367-369, 371-373 mają rozłączne porty (6438-6440, 6442-6444) i rozłączny obszar (`13_CHAT` inne przyciski/moduły) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: ścieżka pliku serwera nieaktualna w brifie, `type` już dociera ale ginie, wzorzec poprawny już istnieje w tym samym pliku (dwa miejsca), brama jakości kanonicznego lejka, strażnik duplikatu to jedno porównanie stringów, atrapa bazy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |

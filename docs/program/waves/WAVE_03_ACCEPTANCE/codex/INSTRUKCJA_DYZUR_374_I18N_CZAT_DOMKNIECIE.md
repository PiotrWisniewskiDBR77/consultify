# INSTRUKCJA DYŻURU nr 374 — Codex — „★★ DOMKNIĘCIE mianownika 250 z dyżuru 372 — **237 pozostałych pozycji** z pełną listą `plik:linia` w `evidence/i18n-czat/` (skan powtórzony i potwierdzony przeze mnie na markerze `8f60ab9987`, liczby NIE ruszyły się od 372: R2 **43** literałów bez `t()` — `canvasActionAvailability.ts:27-47` (14) + `WorkCanvasDocumentPanel.tsx` pending-op `:5158/5166/5173` (3) + `datasetArtifactActions` `:461-490` (7) + `CanvasArtifactBlockRenderer.tsx` `:240,310,379-500,808-844` (17) + `ToolsMenu.tsx:625` (1) + `window.confirm` na sztywno `ChatHistorySidebar.tsx:641` (1); R3 **194** kluczy `t(klucz, fallback)` bez wartości PL — `UnifiedChatPanel.tsx` 36, `ChatHistorySidebar.tsx` 7, `ConversationActions.tsx` 5, `MoveToProjectModal.tsx` 7, `SystemHealth.tsx` 3 (RAZEM 58) + `MessageRenderer.tsx` 48 i 9 kart (RAZEM 136) — w tym decyzja nadzorcy z dnia dzisiejszego: `myWork.ideas.sentToWorkspaceToast` ("Opened in Ideas workspace", toast po zmianie K8 z dyżuru 370) dostaje polskie brzmienie **„Pomysł zapisany, otwieram Moją Pracę”**. **(4) NOWE — klasa (c), pełny sweep**: zmierzone przeze mnie na markerze 25 kandydatów `canvas.*`/`aiChat.*`/`chat.*`/`system.*` z wartością PL identyczną EN — **0 potwierdzonych defektów w rodzinie tego ekranu** (wszystkie 25 to nazwy własne/skróty/zapożyczenia uzasadnione już w `evidence/i18n-czat/klasa-c-podejrzani.txt` z dyżuru 372), ORAZ 2 klucze `aiChat.homeCards.finance.m16.{monteCarlo,sensitivity}.addDriver` = "+ driver", które **zweryfikowałem dodatkowo dziś**: są martwe (`grep -rn` w całym `src/` nie znajduje ŻADNEGO konsumenta tej dokładnej ścieżki) — prawdziwy konsument (`src/components/Economics/panels/WhatIfSensitivityPanel.tsx:230`, `MonteCarloNpvPanel.tsx:231`) woła INNĄ ścieżkę (`finance.m16.sensitivity.addDriver`/`finance.m16.monteCarlo.addDriver`, BEZ prefiksu `aiChat.homeCards.`), która jest **poza modułem Czat AI** (moduł Finance) — więc NIE dotykasz żadnego z tych 4 kluczy w tym dyżurze, zapisujesz jako dwie osobne obserwacje w raporcie (klucze martwe w rodzinie tego ekranu; defekt realny, ale w innym module). **(5) R5 — przeniesienie klucza `canvas.aiMenu.tooLong`**: dyżur 367 (albo wcześniejszy autor) wpisał tłumaczenie w BŁĘDNE miejsce słownika (`initiatives.suggestedChangesPanel.tooLong`, zweryfikowane — ZERO konsumentów tej dokładnej ścieżki w `src/`), podczas gdy kod (`CanvasRichEditor.tsx:79`, wewnątrz `requestCanvasQuickAI`) woła `t('canvas.aiMenu.tooLong', 'The selected text is too long...')`, klucza pod TĄ ścieżką NIE MA w żadnym słowniku — użytkownik dziś widzi angielski fallback zawsze. **(6) R6 — bezpiecznik etykiet**: 372 odkrył dodatkowy dług `TransformationCasesPanel.tsx:114` (ternary `isPolish ? 'Rebaseline' : 'Rebaseline'`, identyczne, NIEUZASADNIONE wg `justification()`) i WYCOFAŁ rozszerzenie zasięgu zamiast złamać ratchet — **dziś licencja OBEJMUJE naprawę tego jednego długu**, żeby bezpiecznik mógł objąć `AIChat`+`canvas` bez naruszenia progu (zmierzone przeze mnie: po naprawie tego jednego wpisu, zasięg połączony `DiscoveryTools+toolPacks+AIChat+canvas` daje `pliki=448, ternary=789, nieuzasadnione=4` — DOKŁADNIE tyle, ile już jest w `baseline.maxUnjustifiedIdentical` dziś, zero potrzeby zmiany progu góra/dół, tylko `minFiles`/`minTernaries` w górę). **(7) R7 — zrzuty** PL/EN każdej naprawionej powierzchni przez dev-render, sekcje rozwinięte, bez logowania Piotra, raport końcowy"

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
> **wyłącznie** `/private/tmp/cx-day374-i18n-czat-domkniecie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `8f60ab998734adcdf61a080f4e1270c3dbdffceb`**
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
Zakres: **`13_CHAT` — WYŁĄCZNIE tekst (i18n) na ekranie „Czat AI” (`/chat`) i jego panelu kanwy. To jest DOMKNIĘCIE dyżuru 372 (marker wtedy `9715bab7ea`, dziś `8f60ab9987` — treść rodziny NIE zmieniła się, zweryfikowane niżej): kończysz R2 (literały bez `t()`, 43 pozycje), R3 (klucze `t(klucz,fallback)` bez wartości PL, 194 pozycje), dodatkowo wykonujesz R4 (pełny sweep klasy (c) — klucz istnieje, wartość PL=EN, orzeczenie per pozycja), R5 (przeniesienie `canvas.aiMenu.tooLong` na właściwą ścieżkę), R6 (naprawa `TransformationCasesPanel.tsx:114` + rozszerzenie bezpiecznika etykiet o `AIChat`/`canvas`), R7 (zrzuty PL/EN + raport). Zero zmian logiki, zero zmian tras, zero dotknięcia serwera**.
Trasy front: `**CAŁY zakres tego dyżuru jest frontowy.** Pliki z pełną licencją opisane w `R2`-`R6` (tabela licencji poniżej). Poza nimi `src/**` jest TYLKO DO ODCZYTU — logika liczenia, handlery `onClick`, zapytania `Api.*`, store'y zustand NIE są dotykane; zmieniasz wyłącznie: (a) treść w `public/locales/{pl,en}/translation.json`, (b) zamianę literału na `t('nowyKlucz', 'ten sam literał EN jako fallback')` w JSX/module TS, (c) jeden literał ternary w `TransformationCasesPanel.tsx:114`, (d) `scripts/dev/check-etykiety-dwujezyczne.mjs`+`.baseline.json` (wąska licencja, `R6`), (e) nowe/rozszerzone pliki testowe`. Trasy tył: `**BRAK.** Ten dyżur nie dotyka `server/src/**` w ogóle — żadnej trasy, żadnego kontrolera, żadnej migracji. Jeżeli w trakcie pracy okaże się, że którykolwiek z 237 literałów pochodzi z odpowiedzi serwera (nie z kodu klienta) — to jest STOP MERYTORYCZNY dla TEJ pozycji, nie całego dyżuru: zapisujesz `plik:linia` po stronie serwera i przechodzisz dalej`.

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
WT=/private/tmp/cx-day374-i18n-czat-domkniecie
MARKER=8f60ab998734adcdf61a080f4e1270c3dbdffceb

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day374-i18n-czat-domkniecie-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day374-i18n-czat-domkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day374-i18n-czat-domkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day374-i18n-czat-domkniecie-scratch
mkdir -p /private/tmp/cx-day374-i18n-czat-domkniecie-artefakty

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
git -C "$VAULT" log --oneline 8f60ab998734adcdf61a080f4e1270c3dbdffceb..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day374-i18n-czat-domkniecie-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 8f60ab998734adcdf61a080f4e1270c3dbdffceb..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `szesnaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: marker zgadza sie, evidence/i18n-czat/** juz istnieje (dziedziczone z 372)
git rev-parse HEAD
ls evidence/i18n-czat/
#   oczekiwane: HEAD = 8f60ab998734adcdf61a080f4e1270c3dbdffceb; 7 plikow:
#   skan-przed.txt, mianownik-przed.json, header-historia-lista.txt,
#   messagerenderer-karty-lista.txt, klasa-c-podejrzani.txt, skan-r4.py, skan-r5.py

# (2) TEZA: R2 nie ruszyl sie — 42 literaly + 1 window.confirm = 43, WCIAZ obecne
sed -n '27,47p' src/utils/canvas/canvasActionAvailability.ts
sed -n '461,490p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
sed -n '5155,5175p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
sed -n '638,644p' src/components/AIChat/ChatHistorySidebar.tsx
#   moje liczby: wszystkie literaly z raportu 372 WCIAZ obecne bez zmian,
#   window.confirm(`Delete ${{ids.length}} conversation(s)?`) na linii 641 bez t()

# (3) TEZA: R3 nie ruszyl sie — pelny mianownik 58+136=194 wciaz aktualny
python3 evidence/i18n-czat/skan-r4.py
python3 evidence/i18n-czat/skan-r5.py
#   moje liczby: skan-r4.py RAZEM 58 (UnifiedChatPanel.tsx 36, ChatHistorySidebar.tsx 7,
#   ConversationActions.tsx 5, MoveToProjectModal.tsx 7, SystemHealth.tsx 3);
#   skan-r5.py RAZEM 136 (10 plikow z trafieniami) — identyczne z raportem 372,
#   ZERO ruchu. Rozszerz oba skrypty tak, by drukowaly KAZDA pozycje
#   (plik:linia:klucz:fallback), nie tylko sume — jesli 372 juz to zrobil w
#   evidence/*-lista.txt, zweryfikuj ze listy sa nadal aktualne (diff przeciw
#   ponownemu uruchomieniu).

# (4) TEZA: K8 toast 'Opened in Ideas workspace' jest w R3 (dwa wolania, ten sam klucz)
bash -c "grep -n 'sentToWorkspaceToast' src/components/AIChat/UnifiedChatPanel.tsx"
python3 -c "import json; d=json.load(open('public/locales/pl/translation.json')); print(d.get('myWork',{}).get('ideas',{}).get('sentToWorkspaceToast'))"
#   oczekiwane: 2 wolania (linie 1531, 2272), klucz PL = None (brakujacy) —
#   TWOJA wartosc PL dla tego klucza ma byc DOSLOWNIE
#   'Pomysl zapisany, otwieram Moja Prace' (decyzja nadzorcy, nie wymyslasz wlasnej)

# (5) TEZA: R4 — klasa (c), 25 kandydatow, JUZ osadzone w klasa-c-podejrzani.txt z 372
cat evidence/i18n-czat/klasa-c-podejrzani.txt
#   moje liczby: 25 kandydatow, WSZYSTKIE uzasadnione (0 defektow potwierdzonych
#   w rodzinie), 2 dodatkowe niepewne 'addDriver' — TY dokonczasz ich rozstrzygniecie
#   komenda (6)

# (6) TEZA: oba klucze 'addDriver' pod prefiksem aiChat.homeCards sa MARTWE
#     (realny konsument wola INNA sciezke, w INNYM module)
bash -c "grep -rn 'aiChat.homeCards.finance.m16' src/ --include='*.tsx' --include='*.ts'"
bash -c "grep -rn \"'finance.m16.monteCarlo.addDriver'\|'finance.m16.sensitivity.addDriver'\" src/"
#   moje liczby: PIERWSZY grep = 0 trafien (nikt nie wola sciezki z prefiksem
#   aiChat.homeCards w kodzie source) — klucze w slowniku sa OSIEROCONE.
#   DRUGI grep = 2 trafienia, OBA w src/components/Economics/panels/
#   (WhatIfSensitivityPanel.tsx:230, MonteCarloNpvPanel.tsx:231) — INNY modul
#   (Finance/Economics), NIE Czat AI. NIE DOTYKASZ zadnego z 4 kluczy
#   (2 martwe aiChat.homeCards.* + 2 zywe finance.m16.* poza zakresem).

# (7) TEZA: R5 — canvas.aiMenu.tooLong nie istnieje, kod go wola, tlumaczenie
#     siedzi pod zla sciezka bez konsumenta
bash -c "grep -n \"aiMenu.tooLong\" src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx"
python3 -c "
import json
pl=json.load(open('public/locales/pl/translation.json'))
en=json.load(open('public/locales/en/translation.json'))
print('canvas.aiMenu.tooLong PL:', pl.get('canvas',{}).get('aiMenu',{}).get('tooLong'))
print('canvas.aiMenu.tooLong EN:', en.get('canvas',{}).get('aiMenu',{}).get('tooLong'))
print('initiatives.suggestedChangesPanel.tooLong PL:', pl.get('initiatives',{}).get('suggestedChangesPanel',{}).get('tooLong'))
print('initiatives.suggestedChangesPanel.tooLong EN:', en.get('initiatives',{}).get('suggestedChangesPanel',{}).get('tooLong'))
"
bash -c "grep -rn 'suggestedChangesPanel.tooLong' src/"
#   moje liczby: canvas.aiMenu.tooLong = None/None (nie istnieje); wartosc PL
#   poprawna ('Zaznaczony tekst jest za dlugi dla tej akcji AI. Skroc zaznaczenie
#   i sprobuj ponownie.') siedzi pod initiatives.suggestedChangesPanel.tooLong;
#   grep konsumenta tej sciezki = 0 trafien (osierocona, tylko title/toReview/
#   empty/accept/reject z tego wezla sa faktycznie uzywane w
#   SuggestedChangesPanel.tsx)

# (8) TEZA: R6 — TransformationCasesPanel.tsx:114 ma identyczny PL/EN 'Rebaseline'
sed -n '108,120p' src/components/AIChat/TransformationCasesPanel.tsx
#   moje liczby: linia 114, `isPolish ? 'Rebaseline' : 'Rebaseline'` — identyczne,
#   justification('Rebaseline') zwraca None (sprawdzone: nie pasuje do zadnego
#   wzorca regex w scripts/dev/i18n-pl-audyt.mjs) — REALNY DEFEKT, nie skrot

# (9) TEZA: domyslny zakres bezpiecznika etykiet ma dzis 4 nieuzasadnione,
#     WSZYSTKIE poza Twoja rodzina
node scripts/dev/check-etykiety-dwujezyczne.mjs
#   moje liczby: zbadane pliki=166, ternary=353, nieuzasadnione=4, baseline=4,
#   wszystkie 4 w src/components/DiscoveryTools/tools/DynamicSWOT/
#   SWOTCorrelationsStep.tsx (Attack/Repair/Defend/Protect) — ZERO w Twojej
#   rodzinie (bo AIChat/canvas nie sa dzis w zasiegu domyslnym)

# (10) TEZA: po rozszerzeniu zasiegu o AIChat+canvas I naprawie pozycji (8),
#      wynik POWINIEN byc 4 nieuzasadnione (te same 4 SWOT, Rebaseline zniknal)
#      — symulacja BEZ modyfikacji kodu, zapisz do pliku i uruchom:
python3 -c "print('patrz blok Python w R6 tej instrukcji — symulacja roots')"
#   (pelny skrypt symulacyjny podany w R6, uruchamiasz PO naprawie pozycji 8,
#   PRZED zmiana roots w kodzie, zeby potwierdzic liczby zanim zacommitujesz)
#   moje liczby (zmierzone przeze mnie DZIS z symulacja): pliki=448, ternary=789,
#   nieuzasadnione=5 PRZED naprawa Rebaseline (4 SWOT + 1 Rebaseline), 4 PO

# (11) liscie slownikow PRZED (nie moga zmalec)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35294, en 33154 (WYZSZE niz w raporcie 372 — pl 35213/en 33080
#   PO 372 — bo rownolegle inne dyzury paczki 367-373 tez dopisywaly klucze do
#   tych samych 2 plikow; TY mierzysz SWOJ PRZED na TYM markerze, nie porownujesz
#   do liczb z raportu 372)

# (12) 3 bezpieczniki + reachability (WYJATEK, nie prog 0/0)
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0

# (13) reachability — 49 pliki PRE-ISTNIEJACE, NIEZWIAZANE z Czatem AI
node scripts/dev/reachability-from-root.mjs --check-baseline
#   moje liczby: exit=1, 'New test-only files (49)' — pelna lista w wyjsciu
#   komendy, w tym 3 pliki W src/components/AIChat/__tests__/ (z INNYCH dyzurow
#   paczki 367-371, NIE Twoje): UnifiedChatPanel.przewodyChat.test.tsx,
#   canvasSplitTeresaRight.iconParity.test.ts, day371.proposalFamily.remount.test.tsx
#   — NIE DOTYKASZ zadnego z 49, dopisujesz TYLKO swoje wlasne nowe pliki

# (14) litera rejestru — sprawdz TUZ PRZED commitem, nie tylko teraz
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
#   moje liczby: ostatnia = AM (dyzur 373), wolna = AN — ale rownolegle moga
#   pisac inni autorzy tej samej paczki, sprawdz SAM tuz przed commitem

# (15) porty wolne
lsof -iTCP -sTCP:LISTEN -P | grep -E ':(6438|6439|6440|6441|6442|6443|6444|6445|6446|6447|6448|5578|5579|5580|5581|5582|5583|5584|5585|5586|5587|5588)\b'
#   moje liczby: BRAK WYNIKU (wszystkie wolne) — jesli cokolwiek sie pojawi,
#   STOP i zglos, nie zabijaj cudzego procesu

# (16) wzorce testowe istnieja
ls -la src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx
ls -la src/components/AIChat/__tests__/day372-canvasAiMenu.i18n.test.tsx
#   oczekiwane: oba pliki istnieja, oba zielone dzis (uruchom
#   'npx vitest run <sciezka> --retry=0' na obu, zanim zaczniesz pisac wlasne)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day374-i18n-czat-domkniecie-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6445`. Twój JEDYNY port harnessu to `5585`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day374-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP), 6000, 6665-6669. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ PACZKI (367-373, wydane 05.09, worktree'y części nadal na dysku) — nie dotykasz: 367 (6438/5578), 368 (6439/5579), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584). Rodzeństwo NASTĘPNEJ paczki (375-377, mogą jeszcze nie istnieć w chwili Twojej pracy, ale porty są im zarezerwowane — NIE UŻYWAJ): 375 (6446/5586), 376 (6447/5587), 377 (6448/5588). Twoje własne wyłącznie: baza **6445**, harness **5585**. Sprawdź `lsof -iTCP -sTCP:LISTEN -P` przed startem — w chwili pisania tej instrukcji WSZYSTKIE porty tej i sąsiednich paczek są wolne (zero listenerów). ★★ UWAGA: ten dyżur w praktyce NIE POWINIEN potrzebować kontenera PostgreSQL wcale — patrz `§0.2c`: zero tras serwerowych, zero zapisu do bazy. Jeżeli mimo to uruchamiasz kontener, rezerwujesz port **6445/5585** i NIKT INNY ich nie używa. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (`$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur naprawia teksty w istniejących, już-widocznych elementach UI (paski, menu, historia, karty wiadomości, komunikat błędu "tekst za długi") — to jest naprawa potwierdzonego defektu i18n, NIE nowy element wizualny, więc reguła "nowy ekran = flaga OFF" (`Z11`) **nie ma zastosowania** (patrz `AUDYT SPRZECZNOŚCI`, ta sama decyzja co w 372). ★ ROZSTRZYGNIĘCIE NADZORCY (nie pytanie — wykonaj tak, jak napisano): panel "workflow ledger" w kebabie kanwy (`WorkCanvasDocumentPanel.tsx` ok. `:4692-4906`, za `isCanvasDevDiagnosticsEnabled()`/`VITE_DEV_DIAGNOSTICS`, default OFF) **zostaje PO ANGIELSKU na stałe** — to jest diagnostyka deweloperska, nie funkcja produktowa widoczna klientowi, wyłączona z mianownika tego dyżuru z tą adnotacją. NIE tłumaczysz jej, NIE pytasz właściciela ponownie (372 zadał to pytanie, nadzorca już rozstrzygnął)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/check-etykiety-dwujezyczne.mjs` (PEŁNA LICENCJA w `R6` — rozszerzenie `roots`), `scripts/dev/check-etykiety-dwujezyczne.baseline.json` (PEŁNA LICENCJA w `R6` — podniesienie `minFiles`/`minTernaries`, WYŁĄCZNIE w górę), `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WĄSKA LICENCJA — dopisanie WYŁĄCZNIE własnych nowych plików testowych, patrz `R2`-`R6`), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU poza jawnie wymienionymi wąskimi/pełnymi wyjątkami`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sprawdzone przy pisaniu tej instrukcji: sekcje doszły do `AM` (dyżur 373), więc następna wolna to `AN` — **ale to jest MÓJ pomiar sprzed wydania; sprawdzasz TY, komendą, tuż przed commitem, bo równolegle mogą pisać inni autorzy tej samej paczki** — oraz katalog dowodowy `evidence/i18n-czat/**`, który JUŻ ISTNIEJE (dziedziczony z dyżuru 372, scalony na tym markerze) — DOPISUJESZ do niego, nie tworzysz od zera, i NIE kasujesz istniejących plików (`skan-przed.txt`, `mianownik-przed.json`, `header-historia-lista.txt`, `messagerenderer-karty-lista.txt`, `klasa-c-podejrzani.txt`, `skan-r4.py`, `skan-r5.py` — wszystkie już w repo). ★ `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` — WĄSKA LICENCJA (`R2`-`R6`), nie pełna — WYŁĄCZNIE dopisanie Twoich własnych nowych plików testowych. Plik postępu `/private/tmp/cx-day374-i18n-czat-domkniecie-postep.md` żyje POZA repo. Nowe pliki w `tests/` i w `src/**/__tests__/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day374-i18n-czat-domkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day374-i18n-czat-domkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ TŁUMACZENIA-ATRAPY.** Wartość PL nie może być kopią wartości EN (chyba że to nazwa własna — np. "Teresa", skrót techniczny jak "CSV", "KPI" — i wtedy piszesz uzasadnienie w raporcie, wzorem `justification()` z `scripts/dev/i18n-pl-audyt.mjs`). Klucz "dodany", którego polska wartość to przepisany angielski string, NIE JEST naprawą. ★★★ **ZAKAZ TESTU NA TEKŚCIE ŹRÓDŁA.** `readFileSync` + `toContain` na pliku `.tsx`/`.ts` jest zakazany jako JEDYNY dowód. Wzorzec obowiązkowy: prawdziwa instancja `i18next` (`fallbackLng:false`) + `testI18n.t(klucz, fallback)`, PLUS co najmniej jeden test renderujący realny komponent na PLIK dotknięty w tej pozycji — wzorce gotowe w repo: `src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx` (oryginalny) i `src/components/AIChat/__tests__/day372-canvasAiMenu.i18n.test.tsx` (z tej samej rodziny, już zielony) — kopiujesz KSZTAŁT, nie wynik. ★★★ **ZAKAZ ROZSZERZANIA ZAKRESU POZA RODZINĘ Z TABELI LICENCJI.** Jeżeli mechaniczny skan (`R1`) znajdzie ten sam wzorzec POZA tą rodziną (w innych narzędziach niż Czat AI, np. Finance/Economics — patrz odkrycie `addDriver` wyżej) — NIE naprawiasz tam, zapisujesz `plik:linia` do "CO NADAL WYMAGA OSOBNEGO ZLECENIA". ★★ **ZAKAZ ZMIANY LOGIKI.** Wolno zamienić literał na `t('klucz', 'literał')` — NIE wolno zmienić WARUNKU renderu, handlera, ani kolejności grup. ★★ **ZAKAZ "NAPRAWY" reachability spoza rodziny.** Marker ma dziś 49 PRE-ISTNIEJĄCYCH plików `test-only` niezwiązanych z Czatem AI (measured `R1`) — to NIE jest Twój dług, NIE dodajesz ich do baseline, NIE próbujesz "posprzątać" cudzych testów; jedyne pliki, które dopisujesz do `reachability.baseline.json`, to TWOJE WŁASNE nowe testy z tego dyżuru. ★ **ZAKAZ tłumaczenia panelu "workflow ledger"** — rozstrzygnięte przez nadzorcę wyżej, zostaje po angielsku na stałe, to NIE jest już pytanie otwarte | Bo dyżur 372 uczciwie zameldował PARTIAL: zmierzył całą rodzinę (250 pozycji) i naprawił tylko 13 (menu AI edytora), zostawiając 237 z pełną listą `plik:linia` w `evidence/i18n-czat/`. Ten dyżur jest ich domknięciem, plus trzy rzeczy, których 372 nie mógł zrobić w licencji: (a) pełny sweep klasy (c) — czy którykolwiek z 25 kluczy "podejrzanych" jest realnym, nienazwanym defektem (odpowiedź, zmierzona: nie, ale 2 sąsiednie klucze `addDriver` są martwe i poza modułem); (b) przeniesienie źle umieszczonego klucza `canvas.aiMenu.tooLong`, sierotą od dyżuru 367 (nikt tego nie zauważył, bo `t(klucz, fallback)` cicho pokazuje fallback, zero błędu); (c) naprawa `TransformationCasesPanel.tsx:114`, którą 372 odkrył ale świadomie NIE naprawił (poza własną licencją), żeby bezpiecznik etykiet mógł wreszcie objąć `AIChat`/`canvas` bez łamania ratchetu |

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
cd /private/tmp/cx-day374-i18n-czat-domkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day374-pg psql -U postgres -d cx374 \
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
cd /private/tmp/cx-day374-i18n-czat-domkniecie

docker run -d --name cx-day374-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx374 \
  -p 127.0.0.1:6445:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day374-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6445/cx374 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6445/cx374 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day374-i18n-czat-domkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6445/cx374 \
JWT_SECRET=cx374-test-secret-do-not-reuse-min-32-znaki \
npx vitest run ★★ TEN DYŻUR JEST CZYSTO JEDNOSTKOWY — wariant **(C)** z `§0.2c`, `RUN_DB_TESTS=0 MOCK_DB=true`, ZERO Postgresa, ZERO migracji. Testy frontu z roota repo (`npx vitest run <ścieżka> --retry=0`), config domyślny (`vitest.config.ts`) — NIE dodajesz `--config server/vitest.config.ts` do niczego, bo nic nie dotyka `server/`. Każdy nowy/rozszerzony plik testowy montuje realną instancję `i18next` z realnym JSON-em obu słowników (import bezpośredni `public/locales/{pl,en}/translation.json`), NIGDY `vi.mock('react-i18next', ...)` — sprawdź czy `tests/setup.ts` globalnie mockuje `react-i18next`, i jeśli tak, dodaj `vi.unmock('react-i18next')` (wzorzec z `GovernedChatHandoffCard.day179.i18n.test.tsx:11` i `day372-canvasAiMenu.i18n.test.tsx`). Pliki kładziesz w `src/components/AIChat/__tests__/` (KONWENCJA TEGO KATALOGU, UDOKUMENTOWANY WYJĄTEK — patrz `R6` reachability dla konsekwencji) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day374-i18n-czat-domkniecie-artefakty/day374-i18n-czat-domkniecie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day374-i18n-czat-domkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run ★★ TEN DYŻUR JEST CZYSTO JEDNOSTKOWY — wariant **(C)** z `§0.2c`, `RUN_DB_TESTS=0 MOCK_DB=true`, ZERO Postgresa, ZERO migracji. Testy frontu z roota repo (`npx vitest run <ścieżka> --retry=0`), config domyślny (`vitest.config.ts`) — NIE dodajesz `--config server/vitest.config.ts` do niczego, bo nic nie dotyka `server/`. Każdy nowy/rozszerzony plik testowy montuje realną instancję `i18next` z realnym JSON-em obu słowników (import bezpośredni `public/locales/{pl,en}/translation.json`), NIGDY `vi.mock('react-i18next', ...)` — sprawdź czy `tests/setup.ts` globalnie mockuje `react-i18next`, i jeśli tak, dodaj `vi.unmock('react-i18next')` (wzorzec z `GovernedChatHandoffCard.day179.i18n.test.tsx:11` i `day372-canvasAiMenu.i18n.test.tsx`). Pliki kładziesz w `src/components/AIChat/__tests__/` (KONWENCJA TEGO KATALOGU, UDOKUMENTOWANY WYJĄTEK — patrz `R6` reachability dla konsekwencji) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day374-i18n-czat-domkniecie-artefakty/day374-i18n-czat-domkniecie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day374-i18n-czat-domkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day374-pg psql -U postgres -d cx374 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day374-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Liczby z 372 NIE ruszyły się** — zweryfikowane mechanicznie na dzisiejszym markerze tymi samymi skryptami (`skan-r4.py`, `skan-r5.py`), 43+194=237 to wciąż aktualny mianownik, żaden równoległy dyżur (367/368/369/370/371/373) nie dotknął żadnego z tych plików produktu mimo formalnie nakładającej się licencji na słowniki (372 sam to potwierdził w sekcji "Kolizja z dyżurem 373"). (2) **`t(klucz, fallback)` z brakującym kluczem cicho pokazuje `fallback`** — zero błędu, zero czerwieni w konsoli; jedyny sposób wykrycia to `fallbackLng:false` w realnej instancji `i18next`. (3) **`canvas.aiMenu.tooLong` jest DOKŁADNIE tym samym kształtem defektu jak "klucz istnieje ale w złym miejscu"** — kod woła ścieżkę A, słownik ma wartość pod ścieżką B; `grep` po samej wartości tekstu znajdzie PL tłumaczenie i zmyli audytora w myśleniu "to już jest przetłumaczone" (dokładnie to się stało w dyżurze 367/audycie 05.09). (4) **`BlockHeader` w `CanvasArtifactBlockRenderer.tsx` wołany 6×** (linie 231/340/344/361/400/434/566/688) — naprawiasz JEDNĄ funkcję (`:808-844`), nie sześć miejsc wywołania. (5) **`datasetArtifactActions` renderowany DWA RAZY** (`:3767` i `:4264`) — jedno źródło danych, oba miejsca dostają tłumaczenie za darmo. (6) **Reachability ma dziś 49 PRE-ISTNIEJĄCYCH `test-only` plików niezwiązanych z tym dyżurem** (nie 1, nie 3 jak twierdziły wcześniejsze instrukcje tej paczki — realny pomiar na dzisiejszym markerze, patrz `§0.3` komenda 15) — to NIE jest regresja Twojej pracy, ale MUSISZ zmierzyć tę samą listę PRZED i PO, żeby udowodnić, że Twoje własne nowe testy nie dokładają się do niej (bo je dopiszesz do baseline). (7) **Rozszerzenie bezpiecznika etykiet zmienia WYNIK domyślnego zapytania** — dziś domyślny skan (`DiscoveryTools`+`toolPacks`) ma 4 nieuzasadnione (4× w `SWOTCorrelationsStep.tsx`, NIE dotyczy Twojej rodziny); po rozszerzeniu o `AIChat`+`canvas` I naprawieniu `TransformationCasesPanel.tsx:114`, wynik to DALEJ 4 nieuzasadnione (te same 4 SWOT, `Rebaseline` zniknął) — jeżeli Twoja naprawa jest inna niż literalne dopisanie polskiej wartości, przelicz ponownie, nie zakładaj, że wyjdzie 4**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day374-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day374-i18n-czat-domkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — przemiar mianownika 237 na dzisiejszym markerze tą samą metodą co 372, potwierdzenie lub obalenie liczb, bez zmian kodu) · R2 (klasa b — 43 literały bez `t()`: `canvasActionAvailability.ts` 14 + pending-op 3 + `datasetArtifactActions` 7 + `CanvasArtifactBlockRenderer.tsx` 17 + `ToolsMenu.tsx` 1 + `window.confirm` 1 — RDZEŃ, cel: 0) · R3 (klasa a — 194 klucze `t(klucz,fallback)` bez wartości PL w `UnifiedChatPanel.tsx`/`ChatHistorySidebar.tsx`/`ConversationActions.tsx`/`MoveToProjectModal.tsx`/`SystemHealth.tsx`/`MessageRenderer.tsx`+9 kart, w tym decyzja nadzorcy dla `myWork.ideas.sentToWorkspaceToast` = "Pomysł zapisany, otwieram Moją Pracę" — RDZEŃ, cel: 0) · R4 (klasa c — pełny sweep 25 kandydatów `canvas.*`/`aiChat.*`/`chat.*`/`system.*` z PL=EN, orzeczenie pozycja po pozycji + rozstrzygnięcie dwóch kluczy `addDriver` jako martwe/poza modułem) · R5 (przeniesienie `canvas.aiMenu.tooLong` z błędnego miejsca `initiatives.suggestedChangesPanel.tooLong`, test asertujący POLSKI tekst w renderze) · R6 (naprawa `TransformationCasesPanel.tsx:114` "Rebaseline" + rozszerzenie `check-etykiety-dwujezyczne.mjs` o `AIChat`/`utils/canvas` + podniesienie `minFiles`/`minTernaries`) · R7 (zrzuty PL/EN każdej naprawionej powierzchni przez dev-render bez logowania, warunki wspólne serii PO, raport, rejestr znalezisk)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6445` albo `5585` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6445` albo `5585`** (`Z7`).

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

Dyżur 372 (marker `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`) zmierzył mechanicznie całą rodzinę
„angielski w polskim UI” na ekranie „Czat AI” — **250 miejsc**, nie ~40 jak szacował audyt 05.09 —
i uczciwie zameldował **PARTIAL**: naprawił 13 (menu AI edytora, `R3` tamtej instrukcji), zostawił
**237** z pełną, odtwarzalną listą `plik:linia` w `evidence/i18n-czat/`. Ten dyżur jest
**domknięciem** tych 237 pozycji, zmierzonym ponownie na dzisiejszym markerze
`8f60ab998734adcdf61a080f4e1270c3dbdffceb` (który zawiera scalone dyżury 367–373).

**Zmierzone przeze mnie dziś: liczby z 372 się NIE zmieniły.** Żaden z sześciu równoległych dyżurów
tej paczki (367–371, 373) nie dotknął żadnego z plików produktu tej rodziny — 372 sam to
odnotował w swoim „Kolizja z dyżurem 373”, a mój niezależny skan `skan-r4.py`/`skan-r5.py` na
dzisiejszym markerze potwierdza te same sumy: **58** (nagłówek/historia/SystemHealth) i **136**
(`MessageRenderer`+karty). Mianownik do domknięcia: **43** (klasa b) + **194** (klasa a, 58+136) =
**237**.

**Cztery rzeczy, których 372 nie mógł zrobić w swojej licencji, wchodzą dziś do zakresu:**

1. **Pełny sweep klasy (c)** — klucz istnieje w obu słownikach, wartość PL identyczna z EN.
   372 zmierzył 25 kandydatów w `evidence/i18n-czat/klasa-c-podejrzani.txt` i uznał wszystkie za
   uzasadnione (nazwy własne/skróty), plus zostawił 2 niepewne (`aiChat.homeCards.finance.m16.
   {monteCarlo,sensitivity}.addDriver` = „+ driver”) bez potwierdzonego konsumenta. **Ja
   zweryfikowałem dziś dodatkowo**: te 2 klucze są **martwe** (zero konsumentów tej dokładnej
   ścieżki w `src/`) — prawdziwy konsument (`WhatIfSensitivityPanel.tsx:230`,
   `MonteCarloNpvPanel.tsx:231`) woła INNĄ ścieżkę (`finance.m16.*.addDriver`, bez prefiksu
   `aiChat.homeCards.`) w module **Finance/Economics**, poza Czatem AI. **Nie dotykasz żadnego z
   4 kluczy** — dokumentujesz jako dwie osobne obserwacje.
2. **Przeniesienie `canvas.aiMenu.tooLong`.** Kod (`CanvasRichEditor.tsx:79`, wewnątrz
   `requestCanvasQuickAI`) woła `t('canvas.aiMenu.tooLong', '...too long...')`. Tego klucza NIE MA
   w żadnym słowniku. Poprawne polskie tłumaczenie już istnieje — pod BŁĘDNĄ ścieżką
   `initiatives.suggestedChangesPanel.tooLong` (zero konsumentów tej ścieżki — sprawdzone
   `grep`em), gdzie ktoś (najprawdopodobniej autor dyżuru 367, wg śladu w
   `docs/program/waves/WAVE_03_ACCEPTANCE/ODBIOR_367...`) wpisał je omyłkowo. Dziś użytkownik
   zawsze widzi angielski fallback dla tego komunikatu błędu.
3. **Naprawa `TransformationCasesPanel.tsx:114`.** 372 rozszerzył zasięg bezpiecznika etykiet
   (`check-etykiety-dwujezyczne.mjs`) o `AIChat`/`canvas`, odkrył nowy, nieuzasadniony dług
   (ternary `isPolish ? 'Rebaseline' : 'Rebaseline'`), i **wycofał rozszerzenie**, żeby nie złamać
   ratchetu `maxUnjustifiedIdentical` bez licencji na naprawę. Dziś licencja tę naprawę obejmuje.
4. **Zrzuty PL/EN** każdej naprawionej powierzchni przez dev-render (bez logowania Piotra,
   zgodnie z regułą 7 z `CLAUDE.md`), sekcje rozwinięte.

**Decyzja nadzorcy, rozstrzygnięta, nie do przedyskutowania w tym dyżurze:** panel „workflow
ledger” (`WorkCanvasDocumentPanel.tsx:4692-4906`, za `VITE_DEV_DIAGNOSTICS`, default OFF) **zostaje
po angielsku na stałe** — diagnostyka deweloperska, nie funkcja produktowa. 372 zadał to pytanie
właścicielowi; odpowiedź jest „nie tłumaczyć”. Nie pytasz ponownie.

**Decyzja nadzorcy dla jednego konkretnego klucza w R3:** toast `myWork.ideas.sentToWorkspaceToast`
(„Opened in Ideas workspace”, pojawia się po akcji „wyślij do Pomysłów” — zmiana K8 z dyżuru 370)
dostaje polskie brzmienie **dosłownie „Pomysł zapisany, otwieram Moją Pracę”**. Nie wymyślasz
własnego tłumaczenia dla tej jednej pozycji — użyj tego zdania.

## ★ Stan zastany, zmierzony przeze mnie na markerze `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| R2 (klasa b) — literały bez `t()` + `window.confirm` | **43** (42+1), BEZ ZMIAN od 372 | `canvasActionAvailability.ts:27-47` (14), `WorkCanvasDocumentPanel.tsx` pending-op `:5158/5166/5173` (3) + dataset `:461-490` (7), `CanvasArtifactBlockRenderer.tsx:240,310,379-500,808-844` (17), `ToolsMenu.tsx:625` (1), `ChatHistorySidebar.tsx:641` `window.confirm` (1) |
| R3 (klasa a) — `t(klucz,fallback)` bez wartości PL | **194** (58+136), BEZ ZMIAN od 372 | `UnifiedChatPanel.tsx` 36, `ChatHistorySidebar.tsx` 7, `ConversationActions.tsx` 5, `MoveToProjectModal.tsx` 7, `SystemHealth.tsx` 3 (=58); `MessageRenderer.tsx` 48 + 9 kart (=136) — `evidence/i18n-czat/skan-r4.py`, `skan-r5.py` |
| R4 (klasa c) — klucz istnieje, PL=EN | **0 potwierdzonych defektów** w rodzinie (25 kandydatów, wszystkie uzasadnione) + **2 klucze martwe** poza rodziną (`addDriver`, konsument w innym module) | `evidence/i18n-czat/klasa-c-podejrzani.txt` (372) + moja dzisiejsza weryfikacja konsumenta |
| R5 — `canvas.aiMenu.tooLong` | **NIE ISTNIEJE** pod właściwą ścieżką; poprawna wartość PL siedzi osierocona pod `initiatives.suggestedChangesPanel.tooLong` (0 konsumentów tej ścieżki) | `CanvasRichEditor.tsx:79` woła; oba słowniki, węzeł `initiatives.suggestedChangesPanel` |
| R6 — `TransformationCasesPanel.tsx:114` | **1 defekt nieuzasadniony**, ternary `'Rebaseline'`/`'Rebaseline'` | odkryty przez 372, nienaprawiony |
| R6 — bezpiecznik etykiet, zasięg domyślny | **4** nieuzasadnione, WSZYSTKIE poza rodziną Czatu AI (SWOT) | `check-etykiety-dwujezyczne.mjs` bez `--zakres`, `roots` = `DiscoveryTools`+`toolPacks` |
| R6 — symulacja zasięgu połączonego (`DiscoveryTools+toolPacks+AIChat+canvas`) | `pliki=448, ternary=789, nieuzasadnione=5` PRZED naprawą pozycji wyżej, **4** PO | moja symulacja dzisiaj, `§0.3` komenda 10 |
| `reachability --check-baseline` | **exit 1, 49 plików PRE-ISTNIEJĄCYCH**, NIEZWIĄZANYCH z Czatem AI (w tym 3 z `AIChat/__tests__/` ale z INNYCH dyżurów) | `§0.3` komenda 13 — **NIE 1 ani 3, jak twierdziły wcześniejsze instrukcje tej paczki** |
| liście słowników PRZED | **pl 35294, en 33154** | `§0.3` komenda 11 — wyższe niż PO-372 (`35213/33080`), bo równoległe dyżury paczki też dopisywały klucze |
| 3 bezpieczniki kanonu | `focus=0, list=0, artefakt=0` | `§0.3` komenda 12 |
| ostatnia litera rejestru | `AM` (dyżur 373) → wolna `AN` | `§0.3` komenda 14, sprawdź SAM tuż przed commitem |

**RAZEM mianownik do naprawy w tym dyżurze: 43 (R2) + 194 (R3) = 237, plus R4 (orzeczenie, nie
naprawa kodu), R5 (1 przeniesienie), R6 (1 naprawa + rozszerzenie bezpiecznika).**

## ★ Zmierz moje liczby sam

Twierdzę, na dzisiejszym markerze: R2 **43** pozycji BEZ ZMIAN od 372; R3 **194** pozycji BEZ ZMIAN
od 372; R4 **0** potwierdzonych defektów w rodzinie + **2** klucze martwe poza rodziną
(`addDriver`); R5 klucz `canvas.aiMenu.tooLong` **nie istnieje**, poprawna wartość PL osierocona pod
`initiatives.suggestedChangesPanel.tooLong`; R6 **1** defekt (`Rebaseline`) + zasięg domyślny
bezpiecznika **4** nieuzasadnione (SWOT, poza rodziną) → po rozszerzeniu i naprawie: **4**
(niezmieniona liczba, inny skład); `reachability` **49** plików PRE-ISTNIEJĄCYCH; liście słowników
**pl 35294 / en 33154**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost w „Korektach wobec instrukcji”.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · SŁOWNIK · TEST · BEZPIECZNIK

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief
z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Słownik PL** | `public/locales/pl/translation.json` | **★ DOPISYWANIE nowych kluczy** (`R2`-`R3`, `R5`) wartość polska nie kopia EN + **USUNIĘCIE** WYŁĄCZNIE węzła `initiatives.suggestedChangesPanel.tooLong` (`R5`, ma zero konsumentów). Zakaz zmiany innych istniejących wartości | — |
| **Słownik EN** | `public/locales/en/translation.json` | **★ DOPISYWANIE** tych samych kluczy, wartość = literał angielski już obecny w kodzie jako fallback, + **USUNIĘCIE** analogicznego węzła `tooLong` (`R5`). Zakaz zmiany innych wartości | — |
| **Klasa (b) — pasek kanwy** | `src/utils/canvas/canvasActionAvailability.ts` | **★ WĄSKA LICENCJA:** zamiana 14 wpisów `actionLabels` na `t('canvas.actions.<id>', '<literał>')`; jeśli `t` niedostępne w tym module, funkcja przyjmuje `t` jako parametr wołany z `WorkCanvasDocumentPanel.tsx:3232` — jedyna dopuszczalna zmiana kształtu. Zakaz zmiany `actionGroups`/`availability()` | Brief |
| **Klasa (b) — panel kanwy** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` | **★ WĄSKA LICENCJA:** 3 literały pending-operation (`:5158,5166,5173`) + 7 `datasetArtifactActions` (`:461-490`) → `t(klucz, literał)`. Naprawiasz JEDNO źródło (renderuje się 2×, `:3767`/`:4264`). Zakaz zmiany handlerów/`outputTargets`/logiki draftów | Brief |
| **Klasa (b) — bloki artefaktów** | `src/components/AIChat/CanvasArtifactBlockRenderer.tsx` | **★ WĄSKA LICENCJA:** 12 `title="..."` w `EvidenceList` (`:379-383,413-416,498-500`), 2 `aria-label={\`...\`}` z interpolacją (`:240,310` — zachowaj zmienną przez `{{placeholder}}`), `BlockHeader` (`:808-844`, wołana z 6 miejsc, naprawiasz raz). Zakaz zmiany `onCopy`/`onExport` | Brief |
| **Klasa (b) — narzędzia** | `src/components/AIChat/ToolsMenu.tsx` | **★ WĄSKA LICENCJA:** linia 625, `>Reset<` → `{t('common.reset', 'Reset')}`. Zakaz zmiany handlera | Brief |
| **Klasa (b) — `window.confirm`** | `src/components/AIChat/ChatHistorySidebar.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE linia 641:** `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)` → klucz `aiChat.confirmDeleteBulk` z `{{count}}`, polska odmiana liczebnika spójna z resztą pliku. Zakaz zmiany logiki usuwania | Brief |
| **Klasa (a) — nagłówek/historia** | `src/components/AIChat/UnifiedChatPanel.tsx`, `ChatHistorySidebar.tsx` (poza linią 641, już opisaną wyżej), `ConversationActions.tsx`, `MoveToProjectModal.tsx` | **★ WĄSKA LICENCJA:** dodanie WSZYSTKICH 55 pozostałych kluczy z `evidence/i18n-czat/header-historia-lista.txt` (58 minus `system.dataAccess`, patrz niżej), w tym `myWork.ideas.sentToWorkspaceToast` = „Pomysł zapisany, otwieram Moją Pracę” (decyzja nadzorcy, dosłownie). Zakaz zmiany logiki usuwania/przenoszenia/RODO-zgody | Brief |
| **Klasa (a) — SystemHealth** | `src/components/SystemHealth.tsx` | **★ WĄSKA LICENCJA:** 3 klucze (`system.demoDataTitle`, `system.demoData`, `system.dataAccess`, linie 118/122/191). Zakaz zmiany reszty komponentu | Brief |
| **Klasa (a) — MessageRenderer + karty** | `src/components/AIChat/MessageRenderer.tsx`, `ArtifactBadge.tsx`, `ExecutionProposalMessage.tsx`, `GovernedInitiativeHandoffCard.tsx`, `ResearchProgress.tsx`, `CitationList.tsx`, `TeresaProposalCard.tsx`, `InlineResponseFeedback.tsx`, `GovernedChatHandoffCard.tsx`, `TrustBadge.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE dopisanie brakującego klucza do obu słowników** dla każdego `t(klucz,fallback)` z `evidence/i18n-czat/messagerenderer-karty-lista.txt` (136 pozycji). Zakaz zmiany JSX poza samym wywołaniem `t()` — klucz już istnieje w kodzie | Brief |
| **Klasa (c) — orzeczenie** | (odczyt wyłącznie: pliki nośniki 25 kandydatów z `klasa-c-podejrzani.txt`) | **TYLKO ODCZYT** — 372 już zmierzył i uzasadnił, Ty POTWIERDZASZ ponownie i dopisujesz orzeczenie dla 2 kluczy `addDriver` (martwe, poza modułem — NIE naprawiasz) | Errata w raporcie |
| **R5 — przeniesienie `tooLong`** | oba słowniki, węzły `canvas.aiMenu` i `initiatives.suggestedChangesPanel` | **★ PEŁNA LICENCJA:** dodaj `canvas.aiMenu.tooLong` (PL = wartość już istniejąca pod złą ścieżką, EN = fallback z kodu), usuń `tooLong` z `initiatives.suggestedChangesPanel` (0 konsumentów, zweryfikowane). `CanvasRichEditor.tsx` **NIE WYMAGA zmiany kodu** — już woła właściwy klucz | Brief |
| **R6 — dług etykiet** | `src/components/AIChat/TransformationCasesPanel.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE linia 114:** `isPolish ? 'Rebaseline' : 'Rebaseline'` → realna polska wartość (np. „Ustal nowy punkt odniesienia” albo zachowany termin z uzasadnieniem w raporcie, wzorem `justification()`) — **NIE** kopia EN. Zakaz zmiany reszty komponentu (przycisk `disabled`, `mutationUnavailable` zostają) | Brief |
| **Bezpiecznik etykiet** | `scripts/dev/check-etykiety-dwujezyczne.mjs` | **★ PEŁNA LICENCJA, `R6`:** rozszerz `roots` (linia 51) o `path.join(repoRoot, 'src/components/AIChat')` i `path.join(repoRoot, 'src/utils/canvas')`. Zakaz zmiany regexów `languageCondition`/`ternaryPattern` | Brief |
| **Baseline etykiet** | `scripts/dev/check-etykiety-dwujezyczne.baseline.json` | **★ PEŁNA LICENCJA:** podniesienie `minFiles`/`minTernaries` do realnie zmierzonych wartości PO rozszerzeniu `roots` (nigdy w dół). `maxUnjustifiedIdentical` zostaje na `4`, chyba że Twój pomiar PO naprawie da inną liczbę — wtedy dopasuj zgodnie z Twoim pomiarem, z komendą w raporcie | — |
| **Baseline osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA:** dopisanie WYŁĄCZNIE ścieżek TWOICH własnych nowych plików testowych do `testOnlyFiles`. Zakaz `--update-baseline`, zakaz usuwania istniejących wpisów (w tym 49 pre-istniejących niezwiązanych), zakaz dotykania `files` | — |
| **Nowe testy** | `src/components/AIChat/__tests__/day374-*.i18n.test.tsx` (NOWE, konwencja katalogu) | **★ PEŁNA LICENCJA.** Wzorce: `GovernedChatHandoffCard.day179.i18n.test.tsx`, `day372-canvasAiMenu.i18n.test.tsx`. `git add -f` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja, litera sprawdzona komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md` (**NOWY**) | Jedyny nowy dokument rejestrowy | — |
| **`evidence/i18n-czat/**`** | katalog dziedziczony z 372 | **DOPISYWANIE** (nowe pliki tego dyżuru), zakaz kasowania istniejących plików 372 | — |
| **NIETYKALNE — workflow ledger** | `WorkCanvasDocumentPanel.tsx:4692-4906` | **TYLKO ODCZYT.** Rozstrzygnięte przez nadzorcę — zostaje po angielsku | Errata w raporcie |
| **NIETYKALNE — `CanvasAIFloatingMenu.tsx`, `canvas.versionHistory.*`** | odpowiednio | **TYLKO ODCZYT** — 372 już naprawił/potwierdził, brak nowego dowodu defektu | Errata w raporcie |
| **NIETYKALNE — `finance.m16.*`, `Economics/panels/**`** | odpowiednio | **TYLKO ODCZYT** — realny defekt (`+ driver`), ale w innym module, poza tym dyżurem | Brief w „CO NADAL WYMAGA OSOBNEGO ZLECENIA” |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **`server/src/**`** | wszystko | **TYLKO ODCZYT — CAŁA WARSTWA** | Brief, STOP merytoryczny jeśli potrzebne |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU** | Rekomendacja w raporcie |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow — R2/R3/R5 rosna, R5 jest NETTO ZERO (usuwasz 1, dodajesz 1)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35294, en 33154. PO: PRZED + (liczba kluczy faktycznie
#   dodanych w R2-R3) + 0 netto z R5 (usun 1 + dodaj 1) — ta sama liczba PL i EN,
#   symetrycznie

# (b) trzy bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby PRZED: wszystkie 0. Jezeli PO Twojej zmiany ktorykolwiek sie
#   zaczerwieni — naprawiasz KODEM, nigdy progiem (Z35)

# (c) ★★ reachability — 49 plikow PRE-ISTNIEJACYCH, wyjatek udokumentowany
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: exit 1, "New test-only files (49)" — pelna lista w Stanie
#   zastanym, ZERO zwiazanych z rodzina tego dyzuru poza 3 plikami cudzych
#   dyzurow AIChat (367-371). PO Twojej zmianie (wlasne nowe pliki dopisane do
#   reachability.baseline.json): oczekiwany wynik to DALEJ exit 1, z DOKLADNIE
#   TYMI SAMYMI 49 nazwami — Twoje wlasne nowe pliki NIE MAJA sie pojawic na tej
#   liscie. Jesli lista ma 50+ pozycji — to Twoja regresja, napraw wpis w R2-R6

# (d) bezpiecznik etykiet — PRZED domyslny, PO rozszerzony
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety-domyslny-przed=$?"
#   moje liczby PRZED: zbadane pliki=166, ternary=353, nieuzasadnione=4, wszystkie
#   4 w DiscoveryTools/SWOTCorrelationsStep.tsx — ZERO w rodzinie tego dyzuru
#   (uruchamiasz PONOWNIE PO zmianie R6 — patrz R6 dla oczekiwanego wyniku)
```

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | R2 — literałów klasy (b) + `window.confirm` | `43` | `§0.3` komenda 2 | TAK — czyta kod źródłowy wprost, BEZ ZMIAN od 372 |
| 2 | R3 — kluczy klasy (a), pełny mianownik | `194` (58+136) | `§0.3` komenda 3, skrypty `skan-r4.py`/`skan-r5.py` | TAK — BEZ ZMIAN od 372 |
| 3 | R4 — klasa (c), defekty potwierdzone w rodzinie | `0` | `klasa-c-podejrzani.txt` + `§0.3` komenda 5 | TAK — 372 zmierzył, ja potwierdzam ponownie |
| 4 | R4 — klucze martwe/poza modułem, rozstrzygnięte dziś | `2` (`addDriver`) | `§0.3` komenda 6 | TAK — nowy pomiar konsumenta, poza licencją tego dyżuru |
| 5 | R5 — `canvas.aiMenu.tooLong` istnieje pod właściwą ścieżką | `0` → cel `1` | `§0.3` komenda 7 | TAK |
| 6 | R6 — defektów nieuzasadnionych w `TransformationCasesPanel.tsx` | `1` → cel `0` | `§0.3` komenda 8 | TAK |
| 7 | R6 — zasięg domyślny bezpiecznika etykiet PRZED | `4` nieuzasadnione, 0 w rodzinie | `§0.3` komenda 9 | TAK |
| 8 | R6 — zasięg połączony (symulacja) PRZED/PO naprawy | `5` → `4` | `§0.3` komenda 10 | TAK — potwierdź PONOWNIE po realnej zmianie kodu, nie tylko symulacji |
| 9 | `reachability` PRZED | `exit 1`, 49 plików | `§0.3` komenda 13 | TAK — pełny komunikat, nie tylko kod wyjścia |
| 10 | liście słowników PRZED | `pl 35294 / en 33154` | `§0.3` komenda 11 | TAK |
| 11 | RAZEM mianownik dyżuru do naprawy | `237` (R2+R3) | suma wierszy 1+2 = 43+194 | TAK — potwierdź w `R1` własnym sumowaniem |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`public/locales/pl/translation.json` · `public/locales/en/translation.json` ·
`src/utils/canvas/canvasActionAvailability.ts` ·
`src/components/AIChat/WorkCanvasDocumentPanel.tsx` ·
`src/components/AIChat/CanvasArtifactBlockRenderer.tsx` ·
`src/components/AIChat/ToolsMenu.tsx` ·
`src/components/AIChat/ChatHistorySidebar.tsx` ·
`src/components/AIChat/UnifiedChatPanel.tsx` ·
`src/components/AIChat/ConversationActions.tsx` ·
`src/components/AIChat/MoveToProjectModal.tsx` ·
`src/components/SystemHealth.tsx` ·
`src/components/AIChat/MessageRenderer.tsx` i komponenty-karty z trafieniami (do 9) ·
`src/components/AIChat/TransformationCasesPanel.tsx` (WYŁĄCZNIE linia 114) ·
`scripts/dev/check-etykiety-dwujezyczne.mjs` (linia `roots`) ·
`scripts/dev/check-etykiety-dwujezyczne.baseline.json` (progi w górę) ·
nowe pliki `src/components/AIChat/__tests__/day374-*.i18n.test.tsx` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md` ·
`evidence/i18n-czat/**` (dopisanie do istniejącego katalogu).

**Zapisujesz WARUNKOWO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (tylko dopisanie własnych nowych
plików testowych) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/src/**` (CAŁOŚĆ) ·
`src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` (kod już woła właściwy klucz, zmieniasz
WYŁĄCZNIE słowniki) · `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` (naprawione
w 372) · `src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` (rodzina już naprawiona) ·
`WorkCanvasDocumentPanel.tsx` linie `4692-4906` (workflow ledger) ·
`src/components/Economics/panels/WhatIfSensitivityPanel.tsx`, `MonteCarloNpvPanel.tsx` (inny
moduł) · `TransformationCasesPanel.tsx` poza linią 114 ·
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) ·
handlery `onClick`/`onCopy`/`onExport`/logika zapisu draftów/proposals/`Api.*` w KAŻDYM dotkniętym
pliku (zmieniasz WYŁĄCZNIE literał → `t()`) · pliki `evidence/i18n-czat/` z 372 (nie kasujesz).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day374-i18n-czat-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day374-i18n-czat-domkniecie-artefakty/staged.txt
bash -c "grep -iE '^server/src/|CanvasVersionHistory\.tsx|CanvasAIFloatingMenu\.tsx|CanvasRichEditor\.tsx|Economics/panels|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE' /private/tmp/cx-day374-i18n-czat-domkniecie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- src/ | grep -c '^[+-]'
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Test broni ZACHOWANIA prawdziwego resolvera i18next, nigdy tekstu źródła.**
`readFileSync` + `toContain` na pliku `.tsx`/`.ts` jest **zakazany** jako dowód. Wzorzec
obowiązkowy: prawdziwa instancja `i18next` z `fallbackLng:false`, PLUS co najmniej jeden test
renderujący realny komponent. Gotowe wzorce w repo: `GovernedChatHandoffCard.day179.i18n.test.tsx`
(oryginalny) i `day372-canvasAiMenu.i18n.test.tsx` — **kopiujesz KSZTAŁT, nie wynik** (drugi plik
NALEŻY DO TEJ SAMEJ RODZINY, jest już zielony, uruchom go PRZED rozpoczęciem pracy jako dowód, że
środowisko jest sprawne).

**(2) Wartość PL nie może być kopią wartości EN.** Klucz „dodany”, którego polska wartość to
przepisany angielski string, nie jest naprawą. Wyjątek: nazwy własne i skróty techniczne — piszesz
uzasadnienie w raporcie, wzorem `justification()` w `scripts/dev/i18n-pl-audyt.mjs`. Dotyczy też
`TransformationCasesPanel.tsx:114` — „Rebaseline” skopiowane po obu stronach BEZ uzasadnienia jest
dokładnie tym defektem.

**(3) Zakaz rozszerzania zakresu poza rodzinę z tabeli licencji.** Mechaniczny skan `R1` może
znaleźć ten sam wzorzec POZA plikami tego ekranu (np. `finance.m16.sensitivity.addDriver` w
Economics — już potwierdzone jako realny defekt, ale poza modułem). To NIE jest Twoje do naprawy —
zapisujesz `plik:linia` do „CO NADAL WYMAGA OSOBNEGO ZLECENIA”.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: PRZEMIAR MIANOWNIKA NA DZISIEJSZYM MARKERZE (bez naprawy)

**To jest pomiar. Nie naprawiasz w tej pozycji.**

1. Uruchom **dosłownie** wszystkie 16 komend z `§0.3` na swoim worktree z dzisiejszego markera.
   Zapisz wynik do `evidence/i18n-czat/skan-374-przed.txt` (NOWY plik — nie nadpisujesz plików
   372, `git add -f`).
2. **Potwierdź lub obal moje twierdzenie: liczby 372 (43+194=237) się nie ruszyły.** Jeżeli Twój
   pomiar się różni — to jest WYNIK (`Z24`), zapisz swoją tabelę od zera, z komendami.
3. **Potwierdź rozstrzygnięcie kluczy `addDriver`** (martwe, konsument w innym module) — komenda 6.
   Jeśli Twój `grep` znajdzie konsumenta ścieżki `aiChat.homeCards.finance.m16.*` w rodzinie tego
   ekranu, którego ja nie znalazłem — to JEST realny defekt tego dyżuru, dopisz do R3.
4. **Zapisz mianownik ostateczny PRZED** w `evidence/i18n-czat/mianownik-374-przed.json`:
   `{"r2": N, "r3": N, "r4_martwe_poza_modulem": N, "r5_brakuje": true/false, "r6_defekt": N, "razem_do_naprawy": N}`.

**Wymagany dowód:** `skan-374-przed.txt`, `mianownik-374-przed.json` w `evidence/i18n-czat/`.
**Commit po `R1`.**

## R2 — KLASA (b): LITERAŁY BEZ `t()` + `window.confirm` — CEL 0 (rdzeń)

1. **`canvasActionAvailability.ts:27-47`** — 14 wpisów `actionLabels` → `t('canvas.actions.<id>',
   '<literał>')`, patrz tabela licencji dla zmiany kształtu funkcji jeśli `t` niedostępne w module.
2. **`WorkCanvasDocumentPanel.tsx`** — 3 literały pending-operation (`:5158,5166,5173`) i 7 etykiet
   `datasetArtifactActions` (`:461-490`) → `t(klucz, literał)`. Jeden obiekt renderuje się 2×
   (`:3767`, `:4264`) — naprawiasz raz.
3. **`CanvasArtifactBlockRenderer.tsx`** — 12 `title="..."` (`:379-383,413-416,498-500`), 2
   `aria-label={\`...\`}` z interpolacją (`:240,310`), `BlockHeader` (`:808-844`, wołana z 6 miejsc).
4. **`ToolsMenu.tsx:625`** — `>Reset<` → `{t('common.reset', 'Reset')}`.
5. **`ChatHistorySidebar.tsx:641`** — `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)`
   → klucz `aiChat.confirmDeleteBulk` z interpolacją `{{count}}`, polska odmiana liczebnika.
6. **KROK 0 rodziny wewnątrz tej pozycji:** po zmianie uruchom
   `bash -c "grep -rn 'aria-label=\"[A-Z]\|title=\"[A-Z]' src/utils/canvas/ src/components/AIChat/WorkCanvasDocumentPanel.tsx src/components/AIChat/CanvasArtifactBlockRenderer.tsx"` —
   oczekiwany wynik: **0 trafień** poza `t(...)`-owanymi (odsiej fałszywe pozytywy w klasach CSS,
   zapisz co odsiałeś).
7. **Test:** `src/components/AIChat/__tests__/day374-canvasLiterals.i18n.test.tsx` — instancja
   `i18next` (`fallbackLng:false`) w pętli po wszystkich 14+3+7+1 kluczach `canvas.actions.*`/
   `canvas.panel.pendingOperation.*`/`canvas.panel.dataset.*`/`common.reset`, PLUS render
   `WorkCanvasDocumentPanel` (albo najmniejszy wycinek z opisanymi mockami) z asercją, że
   `aria-label` przycisku „Utwórz prezentację” jest POLSKI, nie „Create presentation”. Osobny
   `describe` dla `CanvasArtifactBlockRenderer` (render bloku `research`, `container.textContent`
   zawiera polskie nagłówki `EvidenceList`) i `ChatHistorySidebar` (`vi.spyOn(window, 'confirm')`,
   asercja na PRZEKAZANY string, nie tylko wywołanie).

**Wymagany dowód:** diff pięciu plików produktu (43 pozycje) · wynik grep-u „0 trafień” z pkt 6 ·
test zielony · para „przed: `container.textContent`/`window.confirm` zawiera angielski string” /
„po: zawiera polski”. **Commit po `R2`.**

## R3 — KLASA (a): PEŁNY SWEEP `t(klucz,fallback)` BEZ WARTOŚCI PL — CEL 0, 194 KLUCZE (rdzeń, największa pozycja)

1. Uruchom `evidence/i18n-czat/skan-r4.py` i `skan-r5.py` (dziedziczone z 372), zapisz PEŁNĄ listę
   `plik:linia:klucz:fallback` (jeśli skrypty jeszcze nie drukują każdej pozycji, rozszerz je o
   `print(f'{{rel}}:{{line}}\t{{key}}\t{{fallback}}')` w pętli) do
   `evidence/i18n-czat/skan-374-r3-pelna-lista.txt`.
2. Dodaj **wszystkie 58** brakujące klucze nagłówka/historii/SystemHealth (`UnifiedChatPanel.tsx`,
   `ChatHistorySidebar.tsx`, `ConversationActions.tsx`, `MoveToProjectModal.tsx`,
   `SystemHealth.tsx`) do obu słowników. **`myWork.ideas.sentToWorkspaceToast`** dostaje wartość PL
   dosłownie: **„Pomysł zapisany, otwieram Moją Pracę”** (decyzja nadzorcy — nie parafrazujesz).
   Pozostałe 57 kluczy tłumaczysz naturalnie, spójnie z sąsiednimi kluczami tej samej gałęzi
   słownika (sprawdź rejestr językowy sąsiadów przed wpisaniem).
3. Dodaj **wszystkie 136** brakujące klucze `MessageRenderer.tsx` + 9 kart (`TrustBadge.tsx`,
   `ExecutionProposalMessage.tsx`, `GovernedInitiativeHandoffCard.tsx`, `ResearchProgress.tsx`,
   `CitationList.tsx`, `TeresaProposalCard.tsx`, `InlineResponseFeedback.tsx`, `ArtifactBadge.tsx`,
   `GovernedChatHandoffCard.tsx`) — **nie zmieniasz JSX**, klucz już jest wołany w kodzie, dopisujesz
   WYŁĄCZNIE do słowników.
4. Jeśli w trakcie odkryjesz klucz użyty z RÓŻNYMI fallbackami w różnych miejscach (kolizja nazw) —
   STOP MERYTORYCZNY dla TEGO klucza: zapisz oba miejsca, zaproponuj rozdzielenie jako diff
   nienałożony, idź dalej z resztą.
5. **Kontrola mianownika:** po zakończeniu uruchom PONOWNIE `skan-r4.py` i `skan-r5.py` —
   oczekiwany wynik: **0** dla obu. Częściowe wykonanie z jawną listą braków jest wynikiem
   pełnowartościowym (`Prawo zatrzymania`), pod warunkiem że lista jest kompletna i żaden dodany
   klucz nie ma wartości-kopii EN.
6. **Test — jeden plik per komponent, wzorcem `day179`/`day372`:** dla każdego z 5+10=15 plików
   dotkniętych: instancja `i18next` (`fallbackLng:false`) + pętla po kluczach TEGO pliku, asercja
   `t(klucz) !== klucz`; PLUS render komponentu (minimalnymi, opisanymi mockami) sprawdzający, że
   `container.textContent`/`aria-label` nie zawiera angielskiego fallbacku tego pliku. Jeśli pełny
   render niemożliwy — dozwolone wywołanie samej funkcji/hooka zwracającego etykiety, **opisane w
   raporcie dlaczego**. Dla toastu K8: test renderujący akcję „wyślij do Pomysłów”, asercja że
   wyświetlony toast to „Pomysł zapisany, otwieram Moją Pracę”, NIE „Opened in Ideas workspace”.

**Wymagany dowód:** `skan-374-r3-pelna-lista.txt` (194 wiersze na starcie) · diff 15 plików
produktu (0 linii logiki) · diff dwóch słowników (do 194 nowych par kluczy) · 15 (lub mniej, jeśli
STOP częściowy) plików testowych zielonych · wynik obu skryptów PO (docelowo `0` każdy) · lista
pozostałych, jeśli STOP częściowy. **Commit po `R3`** (dopuszczalne commity cząstkowe co kilka
plików, każdy z działającymi testami dla TYCH plików).

## R4 — KLASA (c): ORZECZENIE POZYCJA PO POZYCJI (bez naprawy kodu poza R6)

1. Otwórz `evidence/i18n-czat/klasa-c-podejrzani.txt` (372). **Potwierdź ponownie** każdą z 25
   pozycji — uruchom skrypt z `R1` dyżuru 372 (patrz `§0.3` komenda z tamtej instrukcji, wzorzec w
   `evidence/i18n-czat/skan-przed.txt`) na dzisiejszym markerze i porównaj listę. Jeżeli lista się
   zmieniła (nowy kandydat, zniknięty kandydat) — zapisz różnicę.
2. **Rozstrzygnij ostatecznie 2 klucze `addDriver`** (`§0.3` komenda 6): zapisz w raporcie sekcję
   „Klucze martwe w rodzinie” — `aiChat.homeCards.finance.m16.monteCarlo.addDriver` i
   `...sensitivity.addDriver`, zero konsumentów w `src/`, **NIE naprawiasz, NIE usuwasz** (usuwanie
   nieużywanych kluczy to inny dyżur — porządki słownika, poza tym zakresem). Zapisz osobno
   „Defekt realny poza modułem”: `finance.m16.sensitivity.addDriver` = „+ driver” w
   `WhatIfSensitivityPanel.tsx:230`, moduł Finance/Economics, do „CO NADAL WYMAGA OSOBNEGO
   ZLECENIA”.
3. Jeżeli mechaniczny skan (rozszerzony na WIĘCEJ prefiksów niż `canvas.`/`aiChat.`/`chat.`/
   `system.`, np. `myWork.`, jeśli Twoje nowe klucze z `R3` wprowadzą jakiś przez pomyłkę) znajdzie
   nowego kandydata klasy (c) w plikach dotkniętych `R2`/`R3` — orzekasz go tu, nie zostawiasz.

**Wymagany dowód:** `evidence/i18n-czat/klasa-c-374-potwierdzenie.txt` (25 pozycji + werdykt +
2 klucze martwe rozstrzygnięte + różnica względem 372 jeśli jest). **Commit po `R4`.**

## R5 — PRZENIESIENIE `canvas.aiMenu.tooLong` (rdzeń)

1. W obu słownikach dodaj węzeł `canvas.aiMenu.tooLong`:
   **PL** = wartość już istniejąca pod `initiatives.suggestedChangesPanel.tooLong`
   („Zaznaczony tekst jest za długi dla tej akcji AI. Skróć zaznaczenie i spróbuj ponownie.” —
   skopiuj 1:1, jest już poprawna po polsku), **EN** = fallback już obecny w kodzie
   (`CanvasRichEditor.tsx:79`, „The selected text is too long for this AI action. Shorten the
   selection and try again.”).
2. **Usuń** węzeł `tooLong` z `initiatives.suggestedChangesPanel` w OBU słownikach (zero
   konsumentów tej ścieżki, zweryfikowane `§0.3` komenda 7) — zachowaj pozostałe klucze tego węzła
   (`title`, `toReview`, `empty`, `accept`, `reject`), one SĄ używane w `SuggestedChangesPanel.tsx`.
3. **`CanvasRichEditor.tsx` NIE WYMAGA zmiany** — już woła `t('canvas.aiMenu.tooLong', ...)` pod
   właściwą ścieżką, brakowało tylko wpisu w słowniku.
4. **Test:** `src/components/AIChat/__tests__/day374-canvasTooLong.i18n.test.tsx` — (a) instancja
   `i18next` (`fallbackLng:false`), `testI18n.t('canvas.aiMenu.tooLong', fallback)` zwraca POLSKI
   tekst, nie klucz i nie fallback EN; (b) wywołaj `requestCanvasQuickAI` (albo funkcję eksportowaną
   z `CanvasRichEditor.tsx`, sprawdź dokładną nazwę eksportu) z tekstem dłuższym niż
   `CANVAS_AI_MESSAGE_MAX_LENGTH`, asercja że zwrócone `errorLine` to POLSKI tekst; (c) render
   `CanvasAIFloatingMenu` z `errorLine` ustawionym na tę dokładną wartość, `requestErrorVisible`
   prawda, asercja że `container.textContent` zawiera polski tekst, NIE „too long for this AI
   action”. To jest DOKŁADNIE wzorzec z `R0` punkt 1 — test asertuje POLSKI tekst w renderze, nigdy
   fallback.
5. Sprawdź `initiatives.suggestedChangesPanel.tooLong` zniknął, a `SuggestedChangesPanel.tsx`
   dalej renderuje się bez błędu (uruchom istniejące testy tego komponentu, jeśli są — `find
   -iname '*SuggestedChangesPanel*test*'`).

**Wymagany dowód:** diff dwóch słowników (1 węzeł dodany, 1 usunięty) · test zielony z trzema
częściami (a)/(b)/(c) powyżej · para „przed: `errorLine` = angielski fallback” / „po: `errorLine` =
polski tekst” · potwierdzenie że `SuggestedChangesPanel.tsx` nie regresuje. **Commit po `R5`.**

## R6 — NAPRAWA DŁUGU + ROZSZERZENIE BEZPIECZNIKA ETYKIET (rdzeń)

1. **Napraw `TransformationCasesPanel.tsx:114` NAJPIERW**, przed zmianą `roots`:
   `isPolish ? 'Rebaseline' : 'Rebaseline'` → realna polska wartość. To jest przycisk `disabled`
   (`mutationUnavailable`) obok „Zatwierdź zakres”/„Poproś o korektę”/„Utwórz rewizję” — dobierz
   tłumaczenie spójne z tym rejestrem (np. „Ustal nowy punkt odniesienia” — Ty decydujesz o
   dokładnym brzmieniu, ale **nie kopiujesz EN** bez uzasadnienia w stylu `justification()`).
2. **Zmierz PO naprawie**, PRZED zmianą `roots`: `node scripts/dev/check-etykiety-dwujezyczne.mjs
   --zakres=src/components/AIChat` — oczekiwany wynik: **0** nieuzasadnionych (był 1). Jeśli nie —
   Twoje tłumaczenie nadal wygląda po angielsku lub trafia w inny wzorzec regexu, popraw.
3. **Rozszerz `roots`** (linia 51) o `path.join(repoRoot, 'src/components/AIChat')` i
   `path.join(repoRoot, 'src/utils/canvas')`. Uruchom bez argumentów:
   `node scripts/dev/check-etykiety-dwujezyczne.mjs`. Zmierz `zbadane pliki=`/`ternary=`/
   `nieuzasadnione=`.
4. **Podnieś `minFiles`/`minTernaries`** w `check-etykiety-dwujezyczne.baseline.json` do realnie
   zmierzonej wartości z pkt 3 (nigdy w dół). Jeżeli `nieuzasadnione-identyczne` z pkt 3 różni się
   od `4` (mój pomiar symulacyjny) — dopasuj `maxUnjustifiedIdentical` do TWOJEGO zmierzonego
   wyniku z komendą w raporcie (nie zgaduj, nie kopiuj mojej liczby bez sprawdzenia).
5. Jeżeli krok 3 ujawni NOWE nieuzasadnione pozycje spoza `TransformationCasesPanel.tsx:114` (np.
   inny plik z bare-variable ternary, którego regex dziś nie łapie poprawnie) — to jest osobny
   defekt do opisania w raporcie, **NIE naprawiasz kodu produktu** w tej pozycji poza tym, co już
   zrobiłeś w `R2`-`R5`+krok 1 tej pozycji.

**Wymagany dowód:** diff `TransformationCasesPanel.tsx` (1 linia) · wynik `--zakres=src/components/
AIChat` PRZED/PO (1→0) · diff `check-etykiety-dwujezyczne.mjs` (`roots`) · diff `.baseline.json`
z uzasadnieniem liczb · wynik domyślnego uruchomienia PO rozszerzeniu. **Commit po `R6`.**

## R7 — ZRZUTY PL/EN, WARUNKI KOŃCOWE, RAPORT

1. **Zrzuty bez logowania Piotra** (zasada 7 z `CLAUDE.md`), przez `dev-render` (wzorzec:
   `dev-render/screens/chat-*.tsx` już istniejące w repo — użyj mocków, nie realnego backendu).
   Dla KAŻDEJ z siedmiu naprawionych powierzchni (pasek kanwy, panel datasetu/pending-operation,
   bloki artefaktów, `ToolsMenu`, nagłówek/historia/`SystemHealth`, `MessageRenderer`+karty,
   komunikat „tekst za długi”) zrób **PL i EN**, z rozwiniętymi sekcjami (nie zwiniętymi — zasada
   „zwinięta sekcja nie jest dowodem”), zapisz do `evidence/i18n-czat/zrzuty-374/<powierzchnia>-
   {pl,en}.png`. Jeśli harness dla którejś powierzchni nie istnieje i zbudowanie go w tym dyżurze
   jest nieproporcjonalne do zadania — opisz to jawnie w raporcie zamiast fabrykować zrzut.
2. Powtórz bloki (a)-(d) z „WARUNKI WSPÓLNE SERII” PO ostatnim commicie, wklej wynik obok PRZED.
3. **Reachability, kontrola końcowa:** `node scripts/dev/reachability-from-root.mjs
   --check-baseline` — oczekiwany wynik: DALEJ `exit 1`, z DOKŁADNIE tymi samymi 49 nazwami z `R1`
   (Twoje własne nowe pliki dopisane do `testOnlyFiles` w baseline, więc znikają z listy „nowych”).
4. **Raport** (`CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md`) zawiera: tabelę mianowników PRZED/PO
   (237 → docelowo 0, lub mniej z jawną listą braków) · listę wszystkich nowych kluczy per plik ·
   dowód mutacyjny dla co najmniej JEDNEGO przykładu z każdej pozycji `R2`,`R3`,`R5`,`R6` ·
   sekcję „KOREKTY WOBEC INSTRUKCJI I AUDYTU 372” · **niepustą sekcję „TWIERDZENIA
   NIEZWERYFIKOWANE”**.
5. ★★ **Sekcja „CO NADAL WYMAGA OSOBNEGO ZLECENIA”:** `finance.m16.sensitivity.addDriver` = „+
   driver” w module Finance/Economics (poza zakresem) · dowolny nowy wzorzec znaleziony przez
   Twój skan POZA tą rodziną.
6. ★★ **Sekcja „DECYZJE WYKONANE” (nie pytania — nadzorca już rozstrzygnął):** panel „workflow
   ledger” zostaje po angielsku na stałe · toast K8 = „Pomysł zapisany, otwieram Moją Pracę”.
7. Zanim dopiszesz sekcję do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę komendą
   `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
   **tuż przed commitem** (mój pomiar: ostatnia = `AM`, wolna = `AN` — sprawdź sam).

**Wymagany dowód:** katalog `evidence/i18n-czat/zrzuty-374/` z parami PL/EN · warunki wspólne
PRZED/PO obok siebie · raport kompletny wg listy wyżej. **Commit po `R7`.**

## Próg odbioru

**Mianownik 237 (lub Twój zmierzony) potwierdzony w `R1` z odtwarzalnym skanem; R2 (43 pozycje) i
R5 (przeniesienie `tooLong`) naprawione w 100%, z testem renderującym prawdziwy komponent w `pl` i
dowodem mutacyjnym przed/po; R3 (194 klucze) wykonane w całości ALBO zatrzymane z jawną, kompletną
listą braków; R4 (klasa c) ma orzeczenie pozycja po pozycji, w tym rozstrzygnięcie 2 kluczy
`addDriver`; R6 naprawił `TransformationCasesPanel.tsx:114` i rozszerzył bezpiecznik etykiet o
`AIChat`/`canvas` bez naruszenia ratchetu; zero nowego klucza z wartością PL identyczną z EN bez
uzasadnienia; `reachability` nie pogorszony ponad pre-istniejące 49 pozycji; liście słowników
wzrosły dokładnie o liczbę faktycznie dodanych kluczy (R2+R3) plus netto zero z R5, symetrycznie w
obu językach; R7 dostarczył zrzuty PL/EN z rozwiniętymi sekcjami dla każdej naprawionej
powierzchni.**

Odbiorca odrzuci dyżur, w którym: jakikolwiek nowy test czyta plik źródłowy przez `readFileSync`
zamiast wywołać resolver/renderować komponent; którakolwiek nowa wartość PL jest kopią EN bez
uzasadnienia; naprawiono próbkę zamiast całej zmierzonej rodziny bez jawnego STOP-u i listy braków;
zmieniono logikę handlera/warunku poza samą zamianą literału na `t()`; dotknięto plik spoza tabeli
licencji (`Economics/panels/**`, `CanvasAIFloatingMenu.tsx`, workflow ledger); `reachability`/
`check-etykiety` pogorszone bez odnotowania; toast K8 przetłumaczony inaczej niż zdaniem nadzorcy.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R2 i R5 naprawione w 100% z
testami; R3 zrobione dla 12 z 15 plików z trafieniami (167 ze 194 kluczy), reszta opisana z
`plik:linia`” — **jest pełnowartościowym wynikiem**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na dzisiejszym markerze. Wynik ponownego sprawdzenia wklejasz do
raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nowy tekst widoczny dla użytkownika = flaga OFF” (`Z11`) vs „napraw i18n bez flagi” | `POZYCJE_Z_FLAGAMI`: naprawa potwierdzonego defektu, nie nowy element wizualny — ta sama decyzja co w 372 |
| „Dodaj klucz do słownika” vs „nie zmieniaj wartości istniejących” | Tabela licencji: WYŁĄCZNIE dopisywanie + jedno jawnie licencjonowane USUNIĘCIE w `R5` (0 konsumentów, zweryfikowane) |
| „237 pozycji z 372 się nie ruszyły” vs „mierz sam, nie przepisuj” | `Z24`: podane liczby są MOIM pomiarem na dzisiejszym markerze z komendami — Twój pomiar rozstrzyga, jeśli się różni |
| „Napraw całą rodzinę 194 kluczy (`R3`)” vs „realistyczny czas jednego dyżuru” | `R3` punkt 5: dopuszczalne zatrzymanie częściowe z jawną, kompletną listą braków |
| „Rozszerz zasięg bezpiecznika etykiet” vs „bezpiecznik nietykalny (`Z12`/`Z18`)” | Tabela licencji: PEŁNA licencja na `roots`+`baseline.json`, jawnie przyznana w `R6`, inny plik niż `Z18`-owe `tests/setup.ts` |
| „Napraw `TransformationCasesPanel.tsx:114`” vs „zakaz rozszerzania zakresu poza rodzinę” | `R6` punkt 1: ten JEDEN plik/linia jest w tabeli licencji WYŁĄCZNIE dlatego, że blokuje `R6`, nie jako precedens do dalszego rozszerzania |
| „`addDriver` wygląda po angielsku” vs „nie dotykaj plików poza rodziną” | `R4`: klucze osierocone w rodzinie NIE są naprawiane (brak konsumenta = brak widocznego defektu); realny konsument jest w innym module, poza zakresem |
| „`reachability` ma kończyć się 0” (ogólna zasada) vs „PRZED tym dyżurem już jest 49” | Warunki wspólne serii, blok (c): wyjątek udokumentowany — mierzysz NIE POGORSZENIE (te same 49 nazwy PRZED i PO), nie zero |
| „Przetłumacz kebab kanwy w całości” (sugestia audytu) vs „workflow ledger to diagnostyka dev” | Tabela licencji: workflow ledger NIETYKALNE, ROZSTRZYGNIĘTE przez nadzorcę (nie pytanie) |
| „Toast K8 = decyzja nadzorcy” vs „Ty tłumaczysz naturalnie resztę R3” | `R3` punkt 2: TA JEDNA pozycja ma odgórnie zadane brzmienie, reszta 57 kluczy jest Twoim tłumaczeniem |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie pliki produktu sprawdzone bezpośrednio na `8f60ab9987`, w tym `evidence/i18n-czat/**` dziedziczone (istnieje), `TransformationCasesPanel.tsx:114` (istnieje, zweryfikowany), `canvas.aiMenu.tooLong` (potwierdzone: nie istnieje), nowe pliki jawnie oznaczone jako NOWE |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy, wszystkie 16 komend `§0.3` uruchomione osobiście na dzisiejszym markerze, w tym symulacja zasięgu połączonego bezpiecznika etykiet |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — słownik PL/EN · pliki klasy (b)/(a) · klasa (c) odczyt · R5 przeniesienie · R6 naprawa+bezpiecznik+baseline · testy · rejestr · raport · infrastruktura testów (odczyt) · `server/src/**` (odczyt) · Economics (odczyt, inny moduł) · macierz (odczyt) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` tylko mierzy, `R2`/`R5`/`R6` dotykają wyłącznie własnych plików, `R3` mechaniczny (dodawanie kluczy), `R4` orzeczenie bez kodu, `R7` administracyjny+zrzuty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6445/5585 wolne (`lsof` przy wydaniu), zero kontenera `cx-day374-*`, zero gałęzi/worktree; rodzeństwo 367-373 i zarezerwowane 375-377 mają rozłączne porty |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z dzisiejszego markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: 7 wymienionych w `PULAPKA_WLASCIWA_TEMU_MODULOWI`, w tym nowa skala reachability (49, nie 1/3) i zły klucz `tooLong` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |

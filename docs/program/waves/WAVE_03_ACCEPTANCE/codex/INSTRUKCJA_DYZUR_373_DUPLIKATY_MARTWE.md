# INSTRUKCJA DYŻURU nr 373 — Codex — „★★★ DWIE RODZINY DEFEKTÓW W KATALOGU CZATU — DUPLIKATY/MYLĄCE ETYKIETY (CZĘŚĆ A) I MARTWE PLIKI (CZĘŚĆ B), ŹRÓDŁO `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/` (pliki `00_ZESTAWIENIE.md`, `A2`, `C`, `F`). **Część A, pięć pozycji.** **(1)** Panel „Dataset ready” (7 przycisków analiz + Odrzuć) renderuje się DWA RAZY NARAZ w `WorkCanvasDocumentPanel.tsx` — raz na stałe poza kebabem (`:3737-3773`, `data-testid="canvas-dataset-actions"`), raz wewnątrz sekcji „Plik, eksport i workspace” kebaba (`:4237-4272`) — użytkownik z otwartym kebabem i wgranym CSV widzi dwa identyczne zestawy przycisków naraz (`A2` D-2). **(2)** Karta „Dodaj nowy element do canvas” w „Najczęstszych działaniach” (`:3846-3851`, `onClick: () => setQuickAddElement('text')`) NIE rozwija sekcji `<details>` „Dodaj element” (`:3918-3966`, brak atrybutu `open`), do której rzekomo prowadzi — klik nie robi nic widocznego (`A2` D-3). **(3)** `TaskDropdown.tsx` (`:100-104` handler, `:213-219` przycisk) — „Create new task” (klucz `taskDropdown.createNew`, PL „Utwórz nowe zadanie”) tylko nawiguje do `/my-work`, nic nie tworzy; zmierzone: `myWorkIntent` (`src/store/slices/uiSlice.ts:76-84`) NIE MA pola do otwarcia formularza tworzenia — tylko `tab` i `open:{type:'notification'|'task'|'idea'|'decision', id}` (otwarcie ISTNIEJĄCEGO obiektu, nie kreator) — etykieta idzie na uczciwą (`F` D-2). **(4)** `NotificationDropdown.tsx` (`:373-394`) — „Skrzynka” i „Centrum” mają DOSŁOWNIE identyczny handler (`setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)`) — `myWorkIntent.tab` nie ma wartości „center”/„notifications”, więc drugi przycisk donikąd nie prowadzi osobno — scalić w jeden (`F` D-5). **(5)** `ChatHistorySidebar.tsx:1060` — fallback `t('aiChat.newChat','Nowy czat')`, a sam klucz w obu słownikach zwraca „Nowa rozmowa”/„New conversation” — ujednolicić fallback (`C` D-2). **Część B, szesnaście plików-kandydatów zmierzonych `node scripts/dev/reachability-from-root.mjs`** — metoda OBOWIĄZKOWA to osiągalność OD KORZENIA (`src/index.tsx` dla apki, `dev-render/main.tsx` dla harnessu), NIGDY „plik bez importera”: **jedenaście** plików `unreachable` (zero importerów, zero testów) — `ChatExportModal.tsx`, `ImageAttachment.tsx`, `ChatLanguageSelector.tsx`, `SmartSuggestions.tsx` (żywy jest INNY plik — `Chat/ChatSmartSuggestions.tsx`, `app:true`, NIE MYLIĆ, NIE RUSZAĆ), `ResponseActions.tsx`, `ResponseQualityIndicator.tsx`, `DiagramArtifact.tsx`, `ChatToggleButton.tsx`, `ChatOverlay.tsx`, `layout/DemoTopbarStatus.tsx`, `ui/HelpButton.tsx`, `layout/HelpPanel.tsx`, `ActiveModeStrip.tsx`, `OrganizationMemoryPanel.tsx`; **trzy** to `test-only` (zero importera w apce/harnessie, żywy WYŁĄCZNIE własny test — usuwasz plik I test razem) — `InputHintStrip.tsx` + `__tests__/InputHintStrip.test.tsx`, `PendingActionsIndicator.tsx` + `tests/components/AIChat/PendingActionsIndicator.test.tsx`, `WorkCanvas/WorkCanvasShell.tsx` + `tests/components/AIChat/WorkCanvasShell.test.tsx` (razem z barrelem `WorkCanvas/index.ts` — sam też `unreachable`, a jego JEDYNY nie-typowy eksport to właśnie `WorkCanvasShell`, więc zostawienie go po usunięciu pliku ZEPSUJE build). ★★ **DWIE KOREKTY WOBEC BRIEFU/AUDYTU — moim pomiarem, nie audytora**: `ActionCenter.tsx` (na liście briefu jako „martwy”) jest w rzeczywistości `app:true` — importują go `Execution/ExecutionHub.tsx` i `routes/AppRoutes.tsx`; to jest ŻYWY komponent Execution, który tylko mieszka w katalogu `AIChat/` — NIE RUSZAĆ. Katalog `AIChat/Artifacts/**` jest `app:true` w CAŁOŚCI (komponenty i renderery), bo `SplitLayout` — jego jedyny dostawca — jest osiągalny z jedenastu tras poza `/chat` (`RolloutTab`, `StudioView`, `StudioUnavailableView`, `MyWorkView`, `ExecutiveView`, `LeadershipDashboardView`, `ProjectIntelligenceView`, `FullROIView`, `FullRoadmapView`, `InterviewView`, `UserDashboardView`) — ZOSTAJE w CAŁOŚCI, poza trzema martwymi BARRELAMI (`Artifacts/index.ts`, `Artifacts/renderers/index.ts`, `Artifacts/renderers/index2.ts`), które SĄ `unreachable`, ale leżą POZA listą kandydatów tego dyżuru — NIE USUWAĆ, zgłoś jako osobne znalezisko w raporcie."

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
> **wyłącznie** `/private/tmp/cx-day373-duplikaty-martwe`.

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
Zakres: ****MODUŁ `13_CHAT`** — dwie rodziny z zestawienia audytu przycisków Czatu AI (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`, sekcja P2 „Duplikaty i mylące etykiety” oraz „Martwe pliki w katalogu czatu”), rodziny 2 i 3 z tego zestawienia. **Część A** — pięć duplikatów/mylących etykiet w `WorkCanvasDocumentPanel.tsx`, `TaskDropdown.tsx`, `NotificationDropdown.tsx`, `ChatHistorySidebar.tsx`. **Część B** — szesnaście plików-kandydatów na martwy kod w `src/components/AIChat/**` (plus po jednym w `src/components/layout/**` i `src/components/ui/**`), zmierzonych metodą osiągalności od korzenia. Produktem jest: pięć naprawionych zachowań/etykiet z dowodem behawioralnym i mutacyjnym, oraz jawna tabela usuniętych plików z dowodem nieosiągalności (komenda + wynik + rozmiar) — TYLKO tych, które Twój pomiar potwierdzi jako martwe. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, plik postępu `/private/tmp/cx-day373-duplikaty-martwe-scratch/postep.md` (POZA repo).**.
Trasy front: `Część A (naprawiasz): `src/components/AIChat/WorkCanvasDocumentPanel.tsx` — panel „Dataset ready” poza kebabem `:3737-3773` (testid `canvas-dataset-actions`); wewnątrz kebaba `:4230-4275`; karta „Dodaj element” w Najczęstszych działaniach `:3846-3851`; sekcja `<details>` „Dodaj element” `:3918-3966`; pole `quickAddPrompt` (textarea) `:3953-3961`; klaster `useRef` do rozszerzenia `:1037-1134` · `src/components/TaskDropdown.tsx` (`handleNavigateToTasks` `:100-104`, przycisk „Create new task” `:213-219`, klucz `taskDropdown.createNew`) · `src/components/layout/NotificationDropdown.tsx` (`:373-394`, klucze `notificationDropdown.inbox`/`.center`/`.openInbox`/`.openCenter`) · `src/components/AIChat/ChatHistorySidebar.tsx` (`:1055-1061`, klucz `aiChat.newChat`). TYLKO ODCZYT, jako dowód: `src/store/slices/uiSlice.ts:76-90` (kształt `myWorkIntent`/`myWorkEvent`). Część B (usuwasz warunkowo, patrz TABELA LICENCJI): pliki wymienione tam w `src/components/AIChat/**`, `src/components/layout/DemoTopbarStatus.tsx`, `src/components/layout/HelpPanel.tsx`, `src/components/ui/HelpButton.tsx`, ich testy w `__tests__/**` i `tests/components/AIChat/**`, oraz dokładnie dwie linie martwych `vi.mock`/`vi.doMock` w cudzych testach (patrz `Z40`).`. Trasy tył: `BRAK. Ten dyżur jest czysto frontendowy — żadna trasa `server/src/**` nie jest dotykana, tworzona ani mierzona (sprawdzone: żaden z szesnastu kandydatów Części B nie jest montowany w `server/src/Gateway.ts` ani `server/src/services/ApiGateway.ts` — to komponenty front-end bez własnych tras HTTP). Wszystkie pięć defektów Części A dotyczą wyłącznie stanu klienta (`myWorkIntent`, `pendingDataset`, `<details open>`, fokus DOM) i statycznych fallbacków i18n. **Kontener PostgreSQL i harness runtime NIE SĄ wymagane do wykonania tego dyżuru** — porty `6444`/`5584` zostają zarezerwowane wyłącznie na wypadek, gdyby wykonawca zdecydował się na dodatkowy dowód e2e (opcjonalnie, NIE wymagany do odbioru).`.

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
WT=/private/tmp/cx-day373-duplikaty-martwe
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
git -C "$VAULT" worktree add "$WT" -b codex/day373-duplikaty-martwe-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day373-duplikaty-martwe/config.worktree"
cat "$VAULT/worktrees/cx-day373-duplikaty-martwe/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day373-duplikaty-martwe-scratch
mkdir -p /private/tmp/cx-day373-duplikaty-martwe-artefakty

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
git -C "$WT" push github-backup codex/day373-duplikaty-martwe-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `trzynaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) A2 D-2: panel "Dataset ready" zdublowany w WorkCanvasDocumentPanel.tsx
bash -c "grep -n 'canvas-dataset-actions\|pendingDataset ?' src/components/AIChat/WorkCanvasDocumentPanel.tsx | head -10"
sed -n '3735,3775p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
sed -n '4230,4275p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
#   moje liczby: blok poza kebabem :3737-3773 (testid canvas-dataset-actions, zawsze widoczny gdy
#   pendingDataset ustawiony); blok wewnatrz kebaba (sekcja "Plik, eksport i workspace") :4237-4272 —
#   IDENTYCZNY zestaw 7 przyciskow datasetArtifactActions + Dismiss, bez wlasnego testid.

# (2) A2 D-3: karta "Dodaj element" w Najczestszych nie rozwija sekcji formularza
bash -c "grep -n \"setQuickAddElement('text')\" src/components/AIChat/WorkCanvasDocumentPanel.tsx"
sed -n '3915,3922p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
#   moje liczby: karta w tablicy commonActions wola setQuickAddElement('text') w linii 3849 (jedna
#   z szesciu pozycji tablicy .map, render okolo :3846-3851); <details> "Dodaj element" w linii 3918
#   NIE MA atrybutu `open` (dla porownania: sekcja "Edycja i AI" ma `open` explicite w linii 3973) —
#   klik karty nie rozwija sekcji nizej.

# (3) F D-2: TaskDropdown "Create new task" tylko nawiguje + brak intencji tworzenia w store
sed -n '98,105p;213,220p' src/components/TaskDropdown.tsx
bash -c "grep -n 'myWorkIntent' src/store/slices/uiSlice.ts"
sed -n '75,90p' src/store/slices/uiSlice.ts
python3 -c "
import json
for l in ['pl','en']:
    d = json.load(open(f'public/locales/{l}/translation.json'))
    print(l, 'taskDropdown.createNew =', d.get('taskDropdown',{}).get('createNew'))
"
#   moje liczby: handleNavigateToTasks (:100-104) = setIsOpen(false)+setMyWorkIntent({tab:'tasks'})+
#   setCurrentView(MY_WORK) — ZERO tworzenia. Przycisk "Create new task" (:213-219, klucz
#   taskDropdown.createNew) wola DOKLADNIE ten sam handler. myWorkIntent (uiSlice.ts:76-84) ma pola
#   `tab` i `open:{type:'notification'|'task'|'idea'|'decision', id, name?, data?}` — `open` otwiera
#   ISTNIEJACY obiekt po id, nie ma wariantu "utworz nowy". pl createNew = "Utworz nowe zadanie" (klucz
#   przetlumaczony, ale WARTOSC klamie o zachowaniu).

# (4) F D-5: NotificationDropdown "Skrzynka"/"Centrum" identyczny handler
sed -n '370,396p' src/components/layout/NotificationDropdown.tsx
#   moje liczby: dwa przyciski, :373-383 ("Skrzynka"/Inbox) i :384-394 ("Centrum"/Center) — OBA wolaja
#   `setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)`, roznia sie tylko etykieta/tytul.

# (5) C D-2: ChatHistorySidebar fallback "Nowy czat" vs realna wartosc klucza
sed -n '1055,1061p' src/components/AIChat/ChatHistorySidebar.tsx
python3 -c "
import json
for l,v in [('pl','Nowa rozmowa'),('en','New conversation')]:
    d = json.load(open(f'public/locales/{l}/translation.json'))
    print(l, 'aiChat.newChat =', d.get('aiChat',{}).get('newChat'), '| oczekiwane:', v)
"
#   moje liczby: fallback w kodzie (linia 1060) = 'Nowy czat'; klucz w obu slownikach = 'Nowa rozmowa'/
#   'New conversation' (klucz WYGRYWA nad fallbackiem, wiec user i tak widzi poprawny tekst — to
#   niespojnosc w kodzie zrodlowym, nie widoczny defekt UI, ale ma zostac ujednolicona).

# (6) CZESC B: pomiar osiagalnosci od korzenia — pelna lista sciezek
node scripts/dev/reachability-from-root.mjs > /tmp/reach373.json
python3 -c "
import json
names = ['ChatExportModal','ImageAttachment','InputHintStrip','ChatLanguageSelector','SmartSuggestions',
         'ResponseActions','ResponseQualityIndicator','DiagramArtifact','ChatToggleButton','ChatOverlay',
         'ChatSlidingPanel','DemoTopbarStatus','HelpButton','HelpPanel','ActiveModeStrip',
         'OrganizationMemoryPanel','PendingActionsIndicator','ActionCenter','WorkCanvasShell',
         'WorkCanvas/index','Artifacts/']
d = json.load(open('/tmp/reach373.json'))
for row in d['files']:
    if any(n in row['file'] for n in names):
        print(row['classification'].ljust(12), row['file'])
"
#   moje liczby: 11 plikow 'unreachable' (ChatExportModal, ImageAttachment, ChatLanguageSelector,
#   SmartSuggestions.tsx [AIChat], ResponseActions, ResponseQualityIndicator, DiagramArtifact,
#   ChatToggleButton, ChatOverlay, layout/DemoTopbarStatus, ui/HelpButton, layout/HelpPanel,
#   ActiveModeStrip, OrganizationMemoryPanel — to trzynascie, patrz uwaga nizej*); 3 pliki 'test-only'
#   (InputHintStrip, PendingActionsIndicator, WorkCanvas/WorkCanvasShell) + ich dedykowane testy;
#   WorkCanvas/index.ts sam rowniez 'unreachable'; Chat/ChatSmartSuggestions.tsx = 'app' (ZYWY, nie
#   mylic z AIChat/SmartSuggestions.tsx); ActionCenter.tsx = 'app' (ZYWY — audyt sie mylil, NIE USUWAC);
#   caly katalog Artifacts/** (poza trzema plikami index*.ts) = 'app' (ZYWY przez SplitLayout).
#   [* policz sam - lista wyzej ma 14 pozycji tekstowych, dwie z nich (SmartSuggestions bez prefiksu,
#   ActionCenter) moga zlapac substringi z innych katalogow (SmartSuggestionsBar, ChatSmartSuggestions) —
#   filtruj po PELNEJ sciezce `src/components/AIChat/<Nazwa>.tsx` zanim cokolwiek usuniesz]

# (7) korekta ActionCenter — kto naprawde go importuje
bash -c "grep -rln 'ActionCenter' src/ | grep -v __tests__"
#   moje liczby: src/components/AIChat/ActionCenter.tsx (definicja), src/components/Execution/
#   ExecutionHub.tsx, src/routes/AppRoutes.tsx, src/services/api.ts — ZYWY, uzywany przez modul
#   Execution. NIE JEST na liscie do usuniecia mimo ze audyt go tam wpisal.

# (8) korekta Artifacts/** — SplitLayout osiagalny z ilu tras poza /chat
bash -c "grep -rln 'SplitLayout' src/"
#   moje liczby: 11 importerow poza definicja SplitLayout.tsx: RolloutTab.tsx, StudioUnavailableView.tsx,
#   StudioView.tsx, LeadershipDashboardView.tsx, ProjectIntelligenceView.tsx, MyWorkView.tsx,
#   FullROIView.tsx, ExecutiveView.tsx, FullRoadmapView.tsx, InterviewView.tsx, UserDashboardView.tsx
#   (+ AppRoutes.tsx montuje te widoki) — SplitLayout jest osiagalny z korzenia, wiec caly
#   Artifacts/** (komponenty i renderery) ZOSTAJE.

# (9) barrel WorkCanvas/index.ts — jedyny nie-typowy eksport
cat src/components/AIChat/WorkCanvas/index.ts
bash -c "grep -rln \"from '\\.\\./WorkCanvas'\\|from '\\./WorkCanvas'\\|WorkCanvas/index\" src/ | grep -v 'WorkCanvas/'"
#   moje liczby: index.ts eksportuje 11 typow z './types' + `WorkCanvasShell` (default i named) z
#   './WorkCanvasShell'; ZERO plikow importuje ten barrel (typy sa importowane bezposrednio z
#   './WorkCanvas/types' przez WorkCanvasDocumentPanel.tsx i services/api/workCanvas.ts) — barrel sam
#   jest unreachable, i stanie sie dziurawy, jesli usuniesz WorkCanvasShell.tsx bez usuniecia/naprawy
#   tego pliku w tym samym commicie.

# (10) martwe vi.mock/vi.doMock wskazujace pliki do usuniecia (KROK 0 rodziny — caly grep, nie probka)
bash -c "grep -n \"InputHintStrip\" src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx"
bash -c "grep -n \"PendingActionsIndicator\" tests/components/AIChat/UnifiedChatPanel.test.tsx"
bash -c "grep -n \"PendingActionsIndicator\" tests/unit/backend/wave6ContextLearningService.test.ts"
#   moje liczby: EnhancedChatInput.teresaVoice.test.tsx:98 = `vi.mock('../../../components/AIChat/
#   InputHintStrip', () => ({ InputHintStrip: () => null }));` — usun TA JEDNA linie.
#   UnifiedChatPanel.test.tsx:266-268 = `vi.doMock('../../../src/components/AIChat/
#   PendingActionsIndicator', () => ({...}))` — usun TEN JEDEN blok.
#   wave6ContextLearningService.test.ts:529 = `expect(chat).not.toContain('<PendingActionsIndicator')`
#   — asercja NIEOBECNOSCI (guard), nie import; NIE dotykac, zostaje trywialnie zielona.

# (11) i18n na markerze — liscie NIE MOGA ZMALEC (poza dwoma punktami imiennymi z tabeli licencji)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 34327, en 32338 (na markerze — sprawdzone przez `git show <marker>:public/locales/
#   <lang>/translation.json`, bo lokalny checkout uzyty do reszty pomiarow mial juz 31 commitow nad
#   markerem, WYLACZNIE w tych dwoch plikach — nic innego z zakresu tego dyzuru sie nie zmienilo
#   miedzy markerem a moim checkoutem, sprawdzone `git diff --name-only <marker>..HEAD`).

# (12) cztery bezpieczniki + reachability baseline
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby (zmierzone na checkoucie 31 commitow NAD markerem, bo worktree-przy-markerze nie
#   istnial w chwili pisania instrukcji): focus=0, list=0, artefakt=0, reach=1 — reach=1 TYLKO dlatego
#   ze piec plikow spoza zakresu tego dyzuru (Portfolio/InitiativeGridCard.tsx + 4 pliki testowe) trafilo
#   do repo MIEDZY markerem a moim checkoutem i nie sa jeszcze w baseline. Na TWOIM worktree, zbudowanym
#   DOKLADNIE z markera, reach POWINNO dac 0. Jesli nie da — to Twoj prawdziwy stan wejsciowy, piszesz go
#   wprost, nie improwizujesz naprawy spoza zakresu.

# (13) baseline reachability — rozmiar, zeby wiedziec ile juz jest zaakceptowane
python3 -c "
import json
d = json.load(open('docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json'))
print('schemaVersion', d.get('schemaVersion'), '| unreachable', len(d.get('files',[])), '| testOnly', len(d.get('testOnlyFiles',[])))
"
#   moje liczby: schemaVersion 2, unreachable 719, testOnly 1017 (na markerze) — Twoi 16 kandydatow
#   PRAWDOPODOBNIE juz sa w tym zbiorze (baseline TOLERUJE je jako znany dlug), wiec `--check-baseline`
#   przejdzie NAWET BEZ usuwania. To NIE zwalnia Cie z usuwania — usuwasz bo to jest CEL dyzuru, nie bo
#   bramka tego wymaga. Po usunieciu URUCHOM `--update-baseline` (skrypt sam odmowi, gdyby zbior UROSL —
#   Ty go tylko zmniejszasz, wiec przejdzie) zeby baseline przestal tolerowac pliki, ktorych juz nie ma.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day373-duplikaty-martwe-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6444`. Twój JEDYNY port harnessu to `5584`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day373-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ paczki (367-373, dyżury równoległe pisane TEGO SAMEGO dnia — NIE dotykasz ich plików ani portów): 367 (baza 6438 / harness 5578), 368 (6439/5579), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583 — i18n, patrz `Z40` rozłączność). Twoje własne wyłącznie: baza 6444, harness 5584. Starsze rodzeństwo z 04-05.09 (mogą wciąż żyć — sprawdź `docker ps -a` przed startem): 351 (6410/5550), 355 (6414/5554), 363-366 (6434-6437/5574-5577). ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Wszystkie pięć napraw Części A to poprawki DEFEKTU POTWIERDZONEGO (etykieta kłamie, panel się duplikuje, formularz się nie rozwija) — reguła korpusu: zmiana zachowania widocznego przez właściciela wymaga flagi TYLKO gdy wprowadza NOWY element UI, nie gdy naprawia potwierdzony defekt. Żadna z pięciu pozycji nie wprowadza nowego elementu UI — R1 USUWA duplikat (mniej UI, nie więcej), R2 dodaje wyłącznie programowe rozwinięcie JUŻ ISTNIEJĄCEJ sekcji i fokus (zero nowego DOM), R3/R4/R5 zmieniają wyłącznie tekst etykiety albo scalają dwa już wdrożone przyciski w jeden. Link „Pokaż analizy” z R1 zastępuje jeden z dwóch identycznych, już wdrożonych zestawów kontrolek — to redukcja duplikatu, nie nowa funkcja, więc też BEZ FLAGI. Część B usuwa pliki nieużywane — zero UI, zero flag.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs` (WOŁASZ z opcjami — NIE edytujesz), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `src/store/slices/uiSlice.ts` (model `myWorkIntent`/`myWorkEvent` — WOLNO CZYTAĆ, NIE zmieniać), `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16, w tym `13_CHAT`). Wszystkie NIETYKALNE DO ZAPISU (wyjątki dla `public/locales/**` i `reachability.baseline.json` są imiennie wypisane w TABELI LICENCJI, wąsko).`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY373_DUPLIKATY_MARTWE_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — moim pomiarem 05.09 ostatnia użyta sekcja to `AF` (dyżur 365), więc następna wolna to `AG`, ale **sprawdź komendą TUŻ PRZED COMMITEM** (`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`), bo równolegle piszą autorzy dyżurów 367-372 — oraz nowy katalog dowodowy `evidence/duplikaty-martwe-20260905/` (NIE ISTNIEJE na markerze — Ty go tworzysz). ★★★ MACIERZ ODBIORU JEST NIETYKALNA — żaden wiersz, żaden moduł, w tym `13_CHAT` (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md`). Plik postępu `/private/tmp/cx-day373-duplikaty-martwe-scratch/postep.md` żyje POZA repo. Testy USUWASZ (nie dodajesz nowych plików w `tests/` poza nowymi testami behawioralnymi R1-R5, które WYMAGAJĄ `git add -f`).. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day373-duplikaty-martwe-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day373-duplikaty-martwe-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ METODY „PLIK BEZ IMPORTERA”.** Jedyna dopuszczalna metoda martwości to osiągalność OD KORZENIA (`node scripts/dev/reachability-from-root.mjs`) z korzeniami `src/index.tsx` (apka) i `dev-render/main.tsx` (harness) — NIGDY samodzielny `grep -rl NazwaPliku src/` bez odjęcia trafień będących komentarzem, importem wewnątrz TEGO SAMEGO martwego poddrzewa, albo re-eksportem z barrela, który sam jest martwy. Dowód z tego dyżuru: `ActionCenter.tsx` mieszka w `AIChat/`, ale JEST żywy (importują go `Execution/ExecutionHub.tsx`, `routes/AppRoutes.tsx`) — audyt źródłowy pomylił się co do tego pliku; Twój pomiar ma to potwierdzić i ZATRZYMAĆ jego usunięcie. ★★★ **ZAKAZ USUWANIA CAŁEGO KATALOGU `AIChat/Artifacts/**` BEZ POMIARU `SplitLayout`.** Usuwasz WYŁĄCZNIE plik, jeśli TWÓJ pomiar (nie audyt, nie ta instrukcja) potwierdza `unreachable`/`test-only`. ★★ **ZAKAZ POZOSTAWIENIA DZIURAWEGO BARRELA.** Jeśli usuwasz plik re-eksportowany przez `index.ts` w tym samym katalogu (`WorkCanvas/index.ts` → `WorkCanvasShell`), usuwasz LUB naprawiasz ten barrel W TYM SAMYM COMMICIE — dziurawy import w nietkniętym pliku łamie build, nawet jeśli sam barrel jest `unreachable`. ★★ **ZAKAZ POZOSTAWIENIA MARTWEGO `vi.mock`/`vi.doMock`.** Jeśli usuwasz plik, na który wskazuje `vi.mock(ŚCIEŻKA, ...)` lub `vi.doMock(ŚCIEŻKA, ...)` w cudzym, ŻYWYM teście (`src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx:98` → `InputHintStrip`; `tests/components/AIChat/UnifiedChatPanel.test.tsx:266-268` → `PendingActionsIndicator`) — usuwasz TĘ JEDNĄ linię/blok mocka i dowodzisz `npx vitest run <plik>` PRZED i PO, oba zielone, tym samym mianownikiem nazw testów w pliku. Nic więcej w tych dwóch plikach testowych nie zmieniasz. ★★ **ZAKAZ ROZSZERZANIA NAPRAWY POZA WSKAZANE BLOKI** w `WorkCanvasDocumentPanel.tsx` (5278 linii) — dotykasz WYŁĄCZNIE linii wypisanych w TABELI LICENCJI, reszta pliku to TYLKO ODCZYT, mimo że mieszka w tym samym pliku co Twoja naprawa. ★★ **ZAKAZ USUWANIA KLUCZA I18N Z LISTY DYŻURU 372.** Jeżeli w trakcie Części B okaże się, że jakiś klucz i18n jest osierocony WYŁĄCZNIE przez usuwany plik, a klucz ten figuruje na liście dyżuru 372 (sprawdź `ls docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_372_*.md*` — jeśli istnieje w repo, przeczytaj go) — zostawiasz klucz i piszesz to w raporcie jako „zostawione celowo, na liście 372”. W razie wątpliwości klucz ZOSTAJE. ★ **ZAKAZ ZMIANY WARTOŚCI KLUCZA `aiChat.newChat` W SŁOWNIKACH.** `R5` zmienia WYŁĄCZNIE literał-fallback w kodzie JS (drugi argument `t(...)`), nigdy `public/locales/**`. ★ **ZAKAZ EDYCJI SŁOWNIKÓW POZA DWOMA PUNKTAMI IMIENNYMI Z TABELI LICENCJI** (wartość `taskDropdown.createNew` w `R3`; DOKŁADNIE jedna nowa para kluczy dla linku „Pokaż analizy” w `R1`) — wszystko inne w `public/locales/**`, w tym cała lista dyżuru 372, NIETYKALNE. | Bo dwie rodziny defektów zostały ZMIERZONE (nie odgadnięte) 05.09 na żywej gałęzi i obie są tanie do domknięcia: pięć duplikatów/mylących etykiet myli użytkownika bez żadnego ryzyka bezpieczeństwa, a szesnaście plików-kandydatów na martwy kod myli KOLEJNE audyty — dokładnie to przydarzyło się już raz z `ActionCenter.tsx` w tym samym brifie właściciela (audyt policzył go jako martwy, a jest żywym komponentem modułu Execution). Koszt zwłoki rośnie z każdym audytem, który je ponownie zliczy błędnie — a koszt naprawy jest dziś niski, bo obie rodziny mają już gotowy, imienny dowód linia po linii. |

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
cd /private/tmp/cx-day373-duplikaty-martwe

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day373-pg psql -U postgres -d cx373 \
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
cd /private/tmp/cx-day373-duplikaty-martwe

docker run -d --name cx-day373-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx373 \
  -p 127.0.0.1:6444:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day373-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6444/cx373 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6444/cx373 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day373-duplikaty-martwe && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6444/cx373 \
JWT_SECRET=cx373-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Wszystkie testy tego dyżuru to testy FRONTU — uruchamiasz z ROOTA repo, `RUN_DB_TESTS=0 MOCK_DB=true` (żadna baza nie jest potrzebna), silnikiem `vitest` PER PLIK (nigdy pełny `npx vitest run` bez ścieżki — `Z-zero pełnego vitest u robotników`), z `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day373-duplikaty-martwe-artefakty/<etykieta>.json`. Component testy (`@testing-library/react`) idą przez `jsdom` — sprawdź `vitest.config.ts` dla `environment` per katalog (TYLKO ODCZYT). Nowe testy behawioralne R1-R5 kładziesz w `tests/` (np. `tests/components/AIChat/day373-*.test.tsx`), NIGDY pod `src/` (`git add -f` obowiązkowe). Weryfikuj PRZED i PO KAŻDĄ pozycją `numTotalTests` i listę pełnych nazw pliku, którego dotykasz — `Z37`, porównania po nazwach, nigdy po liczbach. `esbuild` per plik na każdym pliku, który dotykasz w Części A, i na każdym pliku, który (wg Twojego `grep`) importował którykolwiek plik usunięty w Części B — ten drugi zbiór POWINIEN wyjść PUSTY; jeśli nie jest pusty, STOP i piszesz dlaczego. --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day373-duplikaty-martwe-artefakty/day373-duplikaty-martwe.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day373-duplikaty-martwe && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Wszystkie testy tego dyżuru to testy FRONTU — uruchamiasz z ROOTA repo, `RUN_DB_TESTS=0 MOCK_DB=true` (żadna baza nie jest potrzebna), silnikiem `vitest` PER PLIK (nigdy pełny `npx vitest run` bez ścieżki — `Z-zero pełnego vitest u robotników`), z `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day373-duplikaty-martwe-artefakty/<etykieta>.json`. Component testy (`@testing-library/react`) idą przez `jsdom` — sprawdź `vitest.config.ts` dla `environment` per katalog (TYLKO ODCZYT). Nowe testy behawioralne R1-R5 kładziesz w `tests/` (np. `tests/components/AIChat/day373-*.test.tsx`), NIGDY pod `src/` (`git add -f` obowiązkowe). Weryfikuj PRZED i PO KAŻDĄ pozycją `numTotalTests` i listę pełnych nazw pliku, którego dotykasz — `Z37`, porównania po nazwach, nigdy po liczbach. `esbuild` per plik na każdym pliku, który dotykasz w Części A, i na każdym pliku, który (wg Twojego `grep`) importował którykolwiek plik usunięty w Części B — ten drugi zbiór POWINIEN wyjść PUSTY; jeśli nie jest pusty, STOP i piszesz dlaczego. --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day373-duplikaty-martwe-artefakty/day373-duplikaty-martwe.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day373-duplikaty-martwe/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day373-pg psql -U postgres -d cx373 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day373-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **„Plik bez importera” zamiast osiągalności od korzenia** — `ActionCenter.tsx` dowodzi, że sama nazwa katalogu (`AIChat/`) nie mówi nic o tym, kto naprawdę importuje plik; musisz zmierzyć `reachability-from-root.mjs`, nie zgadywać po lokalizacji. (2) **Martwe poddrzewo liczy importy WEWNĄTRZ siebie jako żywe** — `WorkCanvas/index.ts` re-eksportuje `WorkCanvasShell`, ale sam barrel jest `unreachable`; para plików trzyma się nawzajem, oboje martwi. (3) **Plik importowany tylko w komentarzu jest martwy** — `ChatToggleButton.tsx:39` wspomina `ChatOverlay` w komentarzu, `UnifiedChatPanel.tsx:1061` wspomina `ChatLanguageSelector` w komentarzu, `api.ts:16968` wspomina `ResponseActions` w komentarzu dokumentacyjnym — żadne z tych trzech nie jest importem; AST-owy pomiar `reachability-from-root.mjs` poprawnie je ignoruje, ale ręczny `grep` bez sprawdzenia kontekstu by skłamał w drugą stronę (pokazał trafienie i sugerowałby „żywe”). (4) **Barrel re-eksportujący martwy plik psuje build, jeśli zostanie** — usuwasz plik i zapominasz o jego re-eksporterze, `tsc`/Vite widzi import wskazujący donikąd. (5) **`vi.mock`/`vi.doMock` na string-ścieżce to nie import w sensie AST, ale JEST realnym ryzykiem** — dwa cudze testy (`EnhancedChatInput.teresaVoice.test.tsx`, `UnifiedChatPanel.test.tsx`) mockują moduły, które zamierzasz usunąć; jeśli nie posprzątasz tych dwóch linii, testy te mogą przestać się kompilować/rozwiązywać moduł. (6) **Dwa pliki o podobnej nazwie w tej samej rodzinie — nie myl ich**: `SmartSuggestions.tsx` (martwy, do usunięcia) vs `Chat/ChatSmartSuggestions.tsx` (żywy, importowany w `UnifiedChatPanel.tsx:110`) vs `MyWork/table/SmartSuggestionsBar.tsx` (martwy, ale POZA zakresem tego dyżuru — inny moduł, zostaw go, zgłoś jako osobne znalezisko). (7) **Klucz i18n istnieje i jest przetłumaczony, ale WARTOŚĆ kłamie o zachowaniu** — `taskDropdown.createNew` ma realną polską wartość „Utwórz nowe zadanie” w obu słownikach, więc żaden audytor kluczy by tego nie złapał; złapał to dopiero pomiar zachowania handlera (`handleNavigateToTasks` — sama nawigacja, zero tworzenia).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day373-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day373-duplikaty-martwe-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: osiagalnosc od korzenia nie plik-bez-importera, dowod mutacyjny na kazda naprawe, KROK 0 rodziny przed kazdym usunieciem, para przed/po z artefaktem) · R1 (A2 D-2: duplikat panelu Dataset ready — jeden zostaje, w kebabie link Pokaz analizy — RDZEN) · R2 (A2 D-3: karta Dodaj element ma rozwijac sekcje i ustawiac fokus — RDZEN) · R3 (F D-2: TaskDropdown Create new task -> etykieta uczciwa Przejdz do zadan — RDZEN) · R4 (F D-5: NotificationDropdown Skrzynka/Centrum -> jeden przycisk — RDZEN) · R5 (C D-2: ChatHistorySidebar fallback ujednolicony do Nowa rozmowa) · R6 (Czesc B: pomiar + usuniecie plikow martwych, barrel WorkCanvas/index.ts, sprzatniecie dwoch martwych vi.mock/vi.doMock, aktualizacja baseline — RDZEN) · R7 (raport, rejestr znalezisk, pytania do wlasciciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6444` albo `5584` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6444` albo `5584`** (`Z7`).

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

Dwie rodziny z zestawienia audytu przycisków Czatu AI (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/
00_ZESTAWIENIE.md`, rodziny 2 „Duplikaty i mylące etykiety” i 3 „Martwe pliki w katalogu czatu”).
Żadna nie jest ryzykiem bezpieczeństwa. Obie są tanie do domknięcia, bo mają już gotowy, imienny
dowód `plik:linia` z trzech audytów cząstkowych (`A2`, `C`, `F`).

**Część A — pięć duplikatów/mylących etykiet.**

**(1) `A2` D-2 — panel „Dataset ready” zdublowany.** Ten sam blok (7 przycisków analiz + „Dismiss”)
renderuje się DWA RAZY NARAZ w `WorkCanvasDocumentPanel.tsx`: raz na stałe poza kebabem
(`:3737-3773`, `data-testid="canvas-dataset-actions"`, widoczny zawsze gdy `pendingDataset`
ustawiony), raz wewnątrz sekcji „Plik, eksport i workspace” kebaba (`:4237-4272`, bez własnego
testid). Odtworzenie: wgraj `.csv` → otwórz kebab „⋮” → rozwiń „Plik, eksport i workspace” →
widać drugi, identyczny zestaw przycisków obok już widocznego na zewnątrz.

**(2) `A2` D-3 — karta „Dodaj element” nie rozwija formularza.** Karta „Dodaj nowy element do
canvas” w „Najczęstszych działaniach” (`:3846-3851`, `onClick: () => setQuickAddElement('text')`)
tylko ustawia typ elementu — sekcja `<details>` „Dodaj element” (`:3918-3966`) nie ma atrybutu
`open` i pozostaje zwinięta. Klik nie pokazuje niczego. Odtworzenie: kebab → Najczęstsze działania
→ „Dodaj element” → nic się nie rozwija, trzeba ręcznie kliknąć osobny nagłówek niżej.

**(3) `F` D-2 — `TaskDropdown` „Create new task” tylko nawiguje.** Przycisk stanu pustego
(`:213-219`, klucz `taskDropdown.createNew`, PL „Utwórz nowe zadanie”) woła DOKŁADNIE ten sam
`handleNavigateToTasks` (`:100-104`) co „View all” — `setIsOpen(false)` +
`setMyWorkIntent({tab:'tasks'})` + `setCurrentView(MY_WORK)`. Zero tworzenia. Sprawdzone w
`src/store/slices/uiSlice.ts:76-84`: `myWorkIntent` ma pola `tab` i
`open:{type:'notification'|'task'|'idea'|'decision', id, name?, data?}` — `open` służy do
otwarcia ISTNIEJĄCEGO obiektu po `id`, nie istnieje wariant „otwórz kreator nowego zadania”.
Etykieta obiecuje tworzenie, kod tylko nawiguje.

**(4) `F` D-5 — `NotificationDropdown` „Skrzynka”/„Centrum” identyczny handler.** Dwa przyciski w
nagłówku dropdownu (`:373-383` „Skrzynka”/Inbox, `:384-394` „Centrum”/Center) mają DOSŁOWNIE
identyczny `onClick`: `setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)`. `myWorkIntent.
tab` nie ma wartości „center” ani „notifications” — drugi przycisk nigdzie osobno nie prowadzi.
Odtworzenie: otwórz dzwonek → kliknij „Skrzynka”, potem osobno „Centrum” — oba lądują na
identycznym `/my-work?tab=inbox`.

**(5) `C` D-2 — `ChatHistorySidebar` fallback niespójny z kluczem.** Linia `:1060` woła
`t('aiChat.newChat', 'Nowy czat')`, ale sam klucz `aiChat.newChat` w obu słownikach zwraca
„Nowa rozmowa”/„New conversation” (klucz wygrywa nad fallbackiem — user i tak widzi poprawny
tekst). To niespójność w kodzie źródłowym, myląca dla następnego programisty, nie widoczny defekt
UI. Ujednolicić fallback do wartości klucza.

**Część B — szesnaście plików-kandydatów na martwy kod**, zmierzonych metodą osiągalności OD
KORZENIA (`node scripts/dev/reachability-from-root.mjs`), NIE metodą „plik bez importera” — patrz
Pułapka (1)/(2)/(3) niżej. **Dwie korekty wobec briefu, moim pomiarem**: `ActionCenter.tsx` jest w
rzeczywistości ŻYWY (audyt się mylił), a katalog `AIChat/Artifacts/**` jest ŻYWY w całości przez
`SplitLayout`, osiągalny z jedenastu tras poza `/chat`.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| duplikat panelu „Dataset ready” | 2 instancje | `WorkCanvasDocumentPanel.tsx:3737-3773` (poza kebabem) i `:4237-4272` (w kebabie) |
| karta „Dodaj element” bez rozwinięcia | brak atrybutu `open` | `<details>` w linii `:3918` (dla porównania: „Edycja i AI” ma `open` w `:3973`) |
| `TaskDropdown` handler duplikowany | ten sam handler w 4 miejscach | `:100-104` definicja, wołany z `:172`, `:215`, `:230`, `:291` |
| `myWorkIntent` bez intencji „utwórz” | pola `tab`/`open` (typ istniejącego obiektu) | `src/store/slices/uiSlice.ts:76-84` |
| `NotificationDropdown` duplikat handlera | 2 przyciski, 1 handler | `:373-383` („Skrzynka”), `:384-394` („Centrum”) |
| `ChatHistorySidebar` fallback vs klucz | fallback `'Nowy czat'` ≠ klucz `'Nowa rozmowa'` | `:1060` kod; `public/locales/{pl,en}/translation.json` klucz `aiChat.newChat` |
| kandydaci Części B, `unreachable` | **11** plików | lista w `TYTUL`/komenda (6) `§0.1` |
| kandydaci Części B, `test-only` | **3** pliki + 3 dedykowane testy | `InputHintStrip`, `PendingActionsIndicator`, `WorkCanvas/WorkCanvasShell` |
| barrel dziurawy po usunięciu | `WorkCanvas/index.ts` | sam `unreachable`, re-eksportuje `WorkCanvasShell` |
| korekta 1: `ActionCenter.tsx` | `app:true` — ŻYWY | importerzy: `Execution/ExecutionHub.tsx`, `routes/AppRoutes.tsx` |
| korekta 2: `Artifacts/**` | `app:true` — ŻYWY (poza 3 barrelami index*.ts) | dostawca `SplitLayout`, 11 importerów poza `/chat` |
| martwe `vi.mock`/`vi.doMock` do posprzątania | 2 linie w 2 cudzych testach | `EnhancedChatInput.teresaVoice.test.tsx:98`, `UnifiedChatPanel.test.tsx:266-268` |
| i18n liście (na markerze) | pl **34327**, en **32338** | `public/locales/{pl,en}/translation.json` |
| baseline reachability (na markerze) | `unreachable` **719**, `testOnly` **1017** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` |
| 4 bezpieczniki (zmierzone na checkoucie 31 commitów NAD markerem — patrz uwaga niżej) | focus=0, list=0, artefakt=0, **reach=1** | komenda (12) `§0.1` |

**★ Uwaga o pomiarze bezpieczników.** W chwili pisania tej instrukcji nie miałem jeszcze worktree
zbudowanego DOKŁADNIE z markera — zmierzyłem na checkoucie repo 31 commitów NAD markerem
(`git diff --name-only <marker>..HEAD` pokazuje, że w zakresie tego dyżuru zmieniły się WYŁĄCZNIE
`public/locales/{pl,en}/translation.json` — nic z `WorkCanvasDocumentPanel.tsx`, `TaskDropdown.tsx`,
`NotificationDropdown.tsx`, `ChatHistorySidebar.tsx`, żadnego z szesnastu kandydatów Części B ani
`scripts/dev/reachability-from-root.mjs`). `reach=1` na tym checkoucie wynika WYŁĄCZNIE z pięciu
plików spoza zakresu tego dyżuru, które wpadły do repo między markerem a moim checkoutem
(`Portfolio/InitiativeGridCard.tsx` + 4 pliki testowe, żaden w `AIChat/`). **Na Twoim worktree,
zbudowanym dokładnie z markera, `reach` powinno dać `0`.** Jeśli nie da — to Twój prawdziwy stan
wejściowy, piszesz go wprost w „Korektach wobec instrukcji” i NIE naprawiasz niczego spoza zakresu
tego dyżuru.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** instancje panelu „Dataset ready”; karta „Dodaj element” bez `open`;
`TaskDropdown` i `NotificationDropdown` mają duplikat handlera w dokładnie tych liniach; fallback
`ChatHistorySidebar` niespójny z kluczem; **11** plików Części B `unreachable`, **3** `test-only`;
`ActionCenter.tsx` i `Artifacts/**` ŻYWE wbrew briefowi; **2** martwe `vi.mock`/`vi.doMock` do
posprzątania; liście słowników **pl 34327**, **en 32338**; baseline reachability **719**
`unreachable` / **1017** `test-only`.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief z
`plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Panel kanwy (Część A, R1+R2)** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` (5278 linii) | **★ WĄSKA LICENCJA NA DOKŁADNIE CZTERY BLOKI**: `:3737-3773` (panel poza kebabem — dozwolone dodanie `id`/`ref` dla fokusa/scrolla, bez zmiany logiki analiz), `:4230-4275` (blok w kebabie — zastąpienie linkiem „Pokaż analizy”), `:3846-3966` (karta „Dodaj element” + `<details>` + textarea — dodanie ref/handler rozwijania i fokusa), `:1037-1134` (klaster `useRef` — dodanie DWÓCH nowych refów). **Reszta pliku (5000+ linii) TYLKO ODCZYT** mimo wspólnego pliku | Brief z `plik:linia` + diff nienałożony |
| **`TaskDropdown` (Część A, R3)** | `src/components/TaskDropdown.tsx` | **★ WĄSKA LICENCJA**: WYŁĄCZNIE tekst/klucz etykiety przycisku `:213-219` (`taskDropdown.createNew`). **Zakaz zmiany `handleNavigateToTasks` (`:100-104`) i jakiejkolwiek logiki nawigacji** — zachowanie zostaje identyczne, zmienia się TYLKO obietnica w etykiecie | — |
| **`NotificationDropdown` (Część A, R4)** | `src/components/layout/NotificationDropdown.tsx` | **★ WĄSKA LICENCJA**: WYŁĄCZNIE blok `:373-394` — usunięcie DUPLIKATU (`:384-394` „Centrum”), zachowanie `:373-383` („Skrzynka”) bez zmian logiki | — |
| **`ChatHistorySidebar` (Część A, R5)** | `src/components/AIChat/ChatHistorySidebar.tsx` | **★ WĄSKA LICENCJA**: WYŁĄCZNIE literał-fallback w linii `:1060` (drugi argument `t(...)`) | — |
| **Model intencji cross-modułowych** | `src/store/slices/uiSlice.ts` | **TYLKO ODCZYT** — dowód, że `myWorkIntent` nie ma wariantu „utwórz nowe” | Cytat `:76-84` w raporcie |
| **Słowniki — WYJĄTEK 1 (R3)** | `public/locales/{pl,en}/translation.json`, klucz `taskDropdown.createNew` | **★ WĄSKA LICENCJA NA WARTOŚĆ TEGO JEDNEGO KLUCZA** — zmiana na uczciwą etykietę („Przejdź do zadań” / „Go to tasks” albo równoważną, w obu językach). **Zakaz zmiany klucza, zakaz usunięcia, zakaz dotykania jakiegokolwiek innego klucza** | — |
| **Słowniki — WYJĄTEK 2 (R1)** | `public/locales/{pl,en}/translation.json`, DOKŁADNIE JEDNA nowa para kluczy | **★ WĄSKA LICENCJA NA DODANIE** jednej pary kluczy dla linku „Pokaż analizy” (np. `canvas.panel.dataset.showAnalyses`), z realną polską wartością — **NIE automatyczne tłumaczenie**. **Zakaz dodania jakiegokolwiek innego klucza** | — |
| **Słowniki — reszta** | `public/locales/**` poza dwoma wyjątkami wyżej | **NIETYKALNE DO ZAPISU.** W tym CAŁA lista kluczy dyżuru 372 — jeśli klucz jest osierocony wyłącznie przez plik usuwany w Części B i figuruje na liście 372, zostaje | Opis w raporcie |
| **Kandydaci Części B — `unreachable`** | `src/components/AIChat/{ChatExportModal,ImageAttachment,ChatLanguageSelector,SmartSuggestions,ResponseActions,ResponseQualityIndicator,DiagramArtifact,ChatToggleButton,ChatOverlay,ActiveModeStrip,OrganizationMemoryPanel}.tsx`, `src/components/layout/DemoTopbarStatus.tsx`, `src/components/ui/HelpButton.tsx`, `src/components/layout/HelpPanel.tsx` | **★ LICENCJA NA USUNIĘCIE WARUNKOWA** — TYLKO jeśli Twój pomiar `reachability-from-root.mjs` na TWOIM worktree potwierdza `unreachable` I dodatkowy `grep` (patrz `R6`) nie znajduje żadnej realnej referencji (import/re-export/`vi.mock`) poza komentarzami | Jeśli pomiar NIE potwierdzi: brief + zostawiasz plik |
| **Kandydaci Części B — `test-only`** | `src/components/AIChat/InputHintStrip.tsx` + `src/components/AIChat/__tests__/InputHintStrip.test.tsx`; `src/components/AIChat/PendingActionsIndicator.tsx` + `tests/components/AIChat/PendingActionsIndicator.test.tsx`; `src/components/AIChat/WorkCanvas/WorkCanvasShell.tsx` + `tests/components/AIChat/WorkCanvasShell.test.tsx` | **★ LICENCJA NA USUNIĘCIE WARUNKOWA, PLIK + JEGO DEDYKOWANY TEST RAZEM** — sama komponenta jest `test-only` (żywy WYŁĄCZNIE własny test, zero konsumenta w apce/harnessie) | jw. |
| **Barrel zależny (Część B)** | `src/components/AIChat/WorkCanvas/index.ts` | **★ LICENCJA NA USUNIĘCIE, WARUNKOWO RAZEM Z `WorkCanvasShell.tsx`** — sam plik jest `unreachable`; jeśli usuwasz `WorkCanvasShell.tsx`, usuwasz LUB naprawiasz (usuwasz linię re-eksportu, zostawiasz typy) ten barrel W TYM SAMYM COMMICIE | — |
| **Martwe mocki w cudzych testach** | `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` (linia `:98`), `tests/components/AIChat/UnifiedChatPanel.test.tsx` (linie `:266-268`) | **★ WĄSKA LICENCJA NA USUNIĘCIE DOKŁADNIE JEDNEJ LINII/BLOKU** wskazującego usuwany plik (`vi.mock`/`vi.doMock`). **Zakaz jakiejkolwiek innej zmiany w tych dwóch plikach** | — |
| **Guard bez importu (Część B)** | `tests/unit/backend/wave6ContextLearningService.test.ts` (linia `:529`) | **TYLKO ODCZYT** — asercja nieobecności `<PendingActionsIndicator` w renderze, nie import; zostaje trywialnie zielona po usunięciu pliku, NIE dotykasz | — |
| **Cudze rodziny o podobnej nazwie** | `src/components/Chat/ChatSmartSuggestions.tsx`, `src/components/MyWork/table/SmartSuggestionsBar.tsx`, `src/components/AIChat/ActionCenter.tsx`, `src/components/AIChat/Artifacts/**` (poza trzema barrelami niżej) | **NIETYKALNE — ŻYWE.** Nie usuwasz, nie zmieniasz | — |
| **Martwe barrele Artifacts (poza zakresem)** | `src/components/AIChat/Artifacts/index.ts`, `src/components/AIChat/Artifacts/renderers/index.ts`, `src/components/AIChat/Artifacts/renderers/index2.ts` | **TYLKO ODCZYT — POZA ZAKRESEM TEGO DYŻURU.** Mimo że Twój pomiar może pokazać `unreachable`, NIE są na liście kandydatów tego dyżuru — zgłoś jako osobne znalezisko w raporcie, nie usuwaj | Wpis do raportu z `plik` + `unreachable` |
| **Baseline reachability** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA: WYŁĄCZNIE przez `node scripts/dev/reachability-from-root.mjs --update-baseline`** (skrypt sam odmówi, gdyby zbiór urósł) — PO usunięciu plików Części B, żeby baseline przestał tolerować pliki, których już nie ma. **Zakaz edycji ręcznej** | — |
| **Nowe testy behawioralne R1-R5** | `tests/components/AIChat/day373-*.test.tsx` (nowe, `git add -f`) | **★ PEŁNA LICENCJA.** Asercja ZACHOWANIA (render + interakcja + wynik DOM/stanu), NIGDY `readFileSync`+`toContain` na źródle | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — żaden wiersz, żaden moduł**, w tym `13_CHAT` | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY373_DUPLIKATY_MARTWE_REPORT.md` (**NOWY**) | `R7` — JEDYNY nowy dokument rejestrowy (`Z13`) | — |
| **`server/src/**` — cały serwer** | — | **TYLKO ODCZYT.** Ten dyżur nie dotyka żadnej trasy serwerowej (patrz `TRASY_TYL`) | Brief, jeśli coś znajdziesz przypadkiem |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (poza dwoma wyjatkami z tabeli licencji, ktore ZMIENIAJA
#     wartosc/DODAJA jedna pare, nigdy nie kasuja)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby na markerze: pl 34327, en 32338. Po R1 (nowa para kluczy) obie liczby rosna o
#   DOKLADNIE 1 kazda (chyba ze klucz zagniezdza sie w nowym obiekcie — wtedy policz recznie ile
#   lisci przybywa i zapisz to w raporcie). R3 NIE zmienia liczby lisci (edytujesz wartosc istniejacego
#   klucza, nie dodajesz/usuwasz).

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby na TWOIM worktree przy markerze: oczekiwane wszystkie 0 (patrz uwaga w "Stan zastany"
#   o reach=1 zmierzonym na moim checkoucie 31 commitow do przodu — to NIE jest stan Twojego markera).
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany — naprawiasz
KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | instancji panelu „Dataset ready” | `2` | komenda (1) `§0.3` | TAK — czyta plik komponentu |
| 2 | atrybutu `open` na `<details>` „Dodaj element” | `0` (brak) | komenda (2) | TAK |
| 3 | wywołań `handleNavigateToTasks` w `TaskDropdown.tsx` | `4` (`:172,215,230,291`) | komenda (3) | TAK — dowód, że „Create new task” to ten sam handler co reszta |
| 4 | wariantów `myWorkIntent.open.type` | `4` (`notification,task,idea,decision`), zero „create” | komenda (3) | TAK — dowód braku intencji tworzenia |
| 5 | przycisków z identycznym handlerem w `NotificationDropdown` | `2` | komenda (4) | TAK |
| 6 | plików Części B `unreachable` | `11` | komenda (6) | TAK — pełna ścieżka, nie tylko nazwa |
| 7 | plików Części B `test-only` (+ dedykowany test) | `3` (+3 testy) | komenda (6) | TAK |
| 8 | korekt wobec briefu | `2` (`ActionCenter`, `Artifacts/**`) | komendy (7), (8) | TAK — dowód importerów |
| 9 | martwych `vi.mock`/`vi.doMock` do usunięcia | `2` | komenda (10) | TAK |
| 10 | liście słowników PL/EN na markerze | `34327` / `32338` | komenda (11) | TAK |
| 11 | rekord baseline reachability na markerze | `719` unreachable / `1017` test-only | komenda (13) | TAK |
| 12 | plików, które importowały cokolwiek usuniętego (PO usunięciu) | oczekiwane `0` | `R6` punkt 6 | TAK — jeśli >0, STOP |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY373_DUPLIKATY_MARTWE_REPORT.md` ·
`evidence/duplikaty-martwe-20260905/**` (nowy) ·
bloki wskazane w tabeli licencji w `WorkCanvasDocumentPanel.tsx`, `TaskDropdown.tsx`,
`NotificationDropdown.tsx`, `ChatHistorySidebar.tsx` · szesnaście plików Części B (usunięcie,
warunkowo po pomiarze) + ich dedykowane testy · `WorkCanvas/index.ts` (warunkowo) ·
dwie linie w `EnhancedChatInput.teresaVoice.test.tsx` i `UnifiedChatPanel.test.tsx` (warunkowo) ·
nowe testy behawioralne w `tests/components/AIChat/day373-*.test.tsx` (`git add -f`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (wyłącznie przez
`--update-baseline`).

**Zapisujesz WARUNKOWO (dwa wyjątki imienne):**
`public/locales/{pl,en}/translation.json` — WYŁĄCZNIE wartość `taskDropdown.createNew` (R3) i
DOKŁADNIE jedna nowa para kluczy dla „Pokaż analizy” (R1).

**JAWNIE NIE ZAPISZESZ:** `server/src/**` (cały), `src/store/slices/uiSlice.ts`,
`public/locales/**` poza dwoma wyjątkami wyżej (w tym CAŁA lista kluczy dyżuru 372),
`src/components/AIChat/ActionCenter.tsx`, `src/components/Chat/ChatSmartSuggestions.tsx`,
`src/components/MyWork/table/SmartSuggestionsBar.tsx`, `src/components/AIChat/Artifacts/**`
(w tym trzy martwe barrele — zgłaszasz, nie usuwasz), `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
`tests/unit/backend/wave6ContextLearningService.test.ts`, jakikolwiek plik poza dokładnie dwiema
liniami w `EnhancedChatInput.teresaVoice.test.tsx` / `UnifiedChatPanel.test.tsx`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day373-duplikaty-martwe
git diff --name-only --cached | tee /private/tmp/cx-day373-duplikaty-martwe-artefakty/staged.txt
bash -c "grep -iE '^server/src/|uiSlice\.ts|^public/locales/.*translation\.json$|ActionCenter\.tsx|ChatSmartSuggestions\.tsx|SmartSuggestionsBar\.tsx|AIChat/Artifacts/(index|renderers/index)|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|wave6ContextLearningService' /private/tmp/cx-day373-duplikaty-martwe-artefakty/staged.txt" \
  && echo "★★ SPRAWDZ RECZNIE — plik na liscie ryzyka jest staged (public/locales/*/translation.json MOZE byc legalny, patrz dwa wyjatki w licencji; reszta to NARUSZENIE, COFNIJ przez git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Martwość dowodzisz osiągalnością OD KORZENIA, nigdy „plikiem bez importera”.**
`node scripts/dev/reachability-from-root.mjs` liczy od `src/index.tsx` (apka) i
`dev-render/main.tsx` (harness). Samodzielny `grep -rl NazwaPliku src/` bez odrzucenia trafień w
komentarzach, w barrelach martwych razem z plikiem, i w `vi.mock`/`vi.doMock` **kłamie w obie
strony** — pokazuje trafienie tam, gdzie nie ma importu (fałszywe „żywe”), i wywala prawdziwych
konsumentów, którzy siedzą za dwoma poziomami re-eksportu (fałszywe „martwe”). Dowód z tego
dyżuru: `ActionCenter.tsx` mieszka w `AIChat/`, jest ŻYWY.

**(2) KROK 0 — RODZINA, przed KAŻDYM usunięciem.** Zanim usuniesz plik, wypisz WSZYSTKIE miejsca,
które o nim wspominają (`grep -rn <Nazwa> src/ tests/ dev-render/`), i rozstrzygnij każde trafienie:
realny import (blokuje usunięcie albo wymaga naprawy razem), barrel re-eksportujący (usuń/napraw
razem), `vi.mock`/`vi.doMock` (usuń tę linię razem), komentarz albo nazwa i18n-klucza (nie blokuje,
nie wymaga akcji).

**(3) Dowód mutacyjny na KAŻDĄ naprawę zachowania (R1-R5).** Cofnij naprawę przez `cp` ze
`SCRATCH` → nowy test ma **zaczerwienić się** → przywróć → **zzielenieć**; `git diff` po
przywróceniu **pusty**. Test broni ZACHOWANIA (render + interakcja + wynik), nigdy
`readFileSync`+`toContain` na źródle.

**(4) Po usunięciu Części B: ZERO importerów pozostałych.** `grep` po każdym usuniętym pliku w
`src/`, `tests/`, `dev-render/` ma dać **zero** trafień poza samym faktem, że pliku już nie ma
(czyli zero w ogóle) — jeśli cokolwiek zostało, to albo zapomniałeś naprawić barrel/mock (patrz
`Z40`), albo plik NIE BYŁ martwy i musisz cofnąć usunięcie.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DUPLIKAT PANELU „DATASET READY” (`A2` D-2, rdzeń)

1. **Zdecyduj, który zostaje.** Sprawdź `evidence/grafika/crimson-czat-20260903/
   canvas-kebab-restructure__{PRZED,PO}__pl__1440__{light,dark}.png` i
   `docs/program/AUDYT_16_MODULOW_20260905/01_Czat.md` (wpis `canvas-kebab-restructure`) — jeśli
   znajdziesz jednoznaczną akceptację właściciela WSKAZUJĄCĄ, który z dwóch wariantów (poza
   kebabem / w kebabie) ma zostać, zacytuj ją dosłownie i zastosuj. **Moim pomiarem: dostępne
   zrzuty i wpisy dotyczą CAŁEJ restrukturyzacji kebaba (nagie słowa → osiem grup) i kończą się
   słowem właściciela „zobaczmy” — NIE rozstrzygają wprost tego konkretnego duplikatu.** Stosujesz
   więc regułę awaryjną z briefu: **zostaje wariant POZA kebabem** (`:3737-3773`, zawsze widoczny
   gdy `pendingDataset` ustawiony), a wariant W KEBABIE (`:4230-4275`) zastępujesz JEDNYM linkiem
   „Pokaż analizy” (nowy klucz i18n, patrz TABELA LICENCJI wyjątek R1).
2. **Link „Pokaż analizy”** ma, po kliknięciu: zamknąć dropdown kebaba (ten sam mechanizm co
   `setIsDiagnosticsOpen(false)`, użyty już w pliku), tak żeby panel poza kebabem (zawsze
   renderowany, gdy jest `pendingDataset`) stał się w pełni widoczny/nieprzesłonięty. Jeśli uznasz
   za potrzebne dodatkowe przewinięcie/fokus do tego panelu — dodaj `id`/`ref` w licencjonowanym
   bloku `:3737-3773` i udokumentuj w raporcie, dlaczego.
3. **Dowód, że duplikat zniknął.** Zamontuj `WorkCanvasDocumentPanel` (albo najmniejsze
   drzewo, które je zawiera) z `pendingDataset` ustawionym i kebabem otwartym; policz w DOM
   elementy pasujące do przycisków `datasetArtifactActions` (np. po `data-testid` które dodasz,
   albo po zliczeniu przycisków w kontenerze `data-testid="canvas-dataset-actions"`) — ma wyjść
   **7+1 RAZY JEDEN**, nie razy dwa. Osobno: kebab otwarty ma pokazywać dokładnie JEDEN element
   „Pokaż analizy”, zero duplikatów przycisków analiz.
4. **Dowód mutacyjny.** Cofnij zmianę (`cp` ze `SCRATCH`, przywracasz stary blok w kebabie) → test
   z punktu 3 ma **zaczerwienić się** (znowu liczy 7+1 dwa razy) → przywróć → **zzielenieć**.
5. **Nie ruszasz treści analiz.** `datasetArtifactActions` (etykiety, `onClick`,
   `createArtifactFromDataset`) zostają identyczne — zmieniasz WYŁĄCZNIE to, GDZIE i ILE RAZY się
   renderują.

**Wymagany dowód:** cytat z evidence/audytu 16 modułów (albo jawne zdanie „nie rozstrzyga, stosuję
regułę awaryjną”) · diff bloku `:4230-4275` · test render+count 7+1×1 · mutacja w obie strony ·
`git diff` po cofnięciu pusty. **Commit po `R1`.**

## R2 — KARTA „DODAJ ELEMENT” MA ROZWIJAĆ FORMULARZ I USTAWIAĆ FOKUS (`A2` D-3, rdzeń)

1. **Dodaj dwa `useRef`** w klastrze `:1037-1134` — jeden na element `<details>` „Dodaj element”
   (`:3918`), jeden na `textarea` pola `quickAddPrompt` (`:3953-3961`). Przypnij je do JSX (`ref={...}`)
   bez zmiany reszty znaczników.
2. **Zmień `onClick` karty** (`:3849`, dziś `() => setQuickAddElement('text')`) tak, żeby OPRÓCZ
   ustawienia typu elementu: (a) ustawił `details.open = true` na ref z kroku 1, (b) przeniósł fokus
   klawiatury na `textarea` z kroku 1 (np. przez `requestAnimationFrame` albo mikrotask, żeby DOM
   zdążył się przemalować — `<details>` niewidoczne wciąż trzyma węzły w drzewie, więc `.focus()`
   powinno zadziałać od razu, ale zmierz to empirycznie i zapisz, czy `requestAnimationFrame` było
   potrzebne).
3. **Dowód behawioralny.** Zamontuj panel, sprawdź że `<details>` startuje ZAMKNIĘTE (`.open ===
   false` / brak atrybutu w renderze), kliknij kartę „Dodaj element” z Najczęstszych działań,
   sprawdź: `.open === true` ORAZ `document.activeElement` wskazuje na `textarea` z kroku 1.
4. **Dowód mutacyjny.** Cofnij zmianę `onClick` (przywróć wyłącznie `setQuickAddElement('text')`) →
   test ma **zaczerwienić się** (details zostaje zamknięte, fokus nie przechodzi) → przywróć →
   **zzielenieć**; `git diff` po cofnięciu **pusty**.
5. **Nie zmieniasz** typów elementu (`text/heading/table/diagram/list/summary`), treści `hint.title`/
   `hint.detail`, ani logiki `insertQuickAddElement`.

**Wymagany dowód:** diff dwóch nowych `useRef` + zmienionego `onClick` · test render + klik +
asercja `open`/`activeElement` · mutacja w obie strony · `git diff` po cofnięciu pusty.
**Commit po `R2`.**

## R3 — `TaskDropdown` „CREATE NEW TASK”: ETYKIETA UCZCIWA (`F` D-2, rdzeń)

1. **Potwierdź brak intencji tworzenia** (już zmierzone w `§0.1`, potwierdź sam): `myWorkIntent`
   (`src/store/slices/uiSlice.ts:76-84`) nie ma wariantu do otwarcia formularza „nowe zadanie” —
   tylko `tab` i `open` (otwarcie ISTNIEJĄCEGO obiektu po `id`). Jeśli Twój pomiar znajdzie inny,
   dotąd nieopisany mechanizm (np. `myWorkEvent` z typem `item:created` wywoływanym z zewnątrz PRZED
   nawigacją) — **opisz go i rozważ, czy da się go użyć zamiast zmiany etykiety**; jeśli tak, to
   jest droga (A) zamiast (B) niżej, i wymaga własnego dowodu HTTP/UI, że rzeczywiście otwiera
   kreator. **Domyślnie (jeśli nie znajdziesz) — droga (B).**
2. **(A) Jeśli intencja istnieje:** podłącz ją tak, żeby klik faktycznie otwierał formularz
   tworzenia zadania (nie tylko listę), z dowodem: render → klik → formularz/modal tworzenia
   widoczny w DOM.
3. **(B) Jeśli intencja NIE istnieje (oczekiwane):** zmień wartość klucza `taskDropdown.createNew`
   w OBU słownikach na uczciwą etykietę nawigacyjną — **„Przejdź do zadań”** (PL) / **„Go to
   tasks”** (EN) albo równoważną, uzgodnioną semantycznie z tym, co przycisk NAPRAWDĘ robi
   (nawiguje do `/my-work`, zakładka `tasks`). **Zakaz zmiany nazwy klucza i zakaz dotykania
   jakiegokolwiek innego klucza.**
4. **Dowód behawioralny.** Zamontuj `TaskDropdown` z pustą listą zadań, otwórz dropdown, sprawdź że
   widoczny tekst przycisku stanu pustego równa się NOWEJ etykiecie (nie starej „Create new task”/
   „Utwórz nowe zadanie”), i że klik nadal wywołuje `setMyWorkIntent({tab:'tasks'})` +
   `setCurrentView(MY_WORK)` (zachowanie nawigacji NIE ZMIENIA SIĘ — zmienia się tylko obietnica w
   etykiecie).
5. **Dowód mutacyjny.** Cofnij zmianę klucza (`cp` ze `SCRATCH`) → test z punktu 4 (część
   sprawdzająca tekst) **czerwony** → przywróć → **zielony**.

**Wymagany dowód:** ustalenie drogi (A) czy (B) z uzasadnieniem · diff wartości klucza w obu
słownikach (droga B) albo diff podłączenia realnego kreatora (droga A) · test render+tekst+klik ·
mutacja w obie strony. **Commit po `R3`.**

## R4 — `NotificationDropdown` „SKRZYNKA”/„CENTRUM”: JEDEN PRZYCISK (`F` D-5, rdzeń)

1. **Usuń duplikat.** Zostaw blok `:373-383` („Skrzynka” / `notificationDropdown.inbox`), usuń
   blok `:384-394` („Centrum” / `notificationDropdown.center`, `.openCenter`) w całości — sam
   przycisk, nie klucze i18n (klucze zostają w słowniku nietknięte, mogą się przydać gdzie indziej
   albo są na liście dyżuru 372 — sprawdź przed usunięciem, `Z40`).
2. **Dowód behawioralny.** Zamontuj `NotificationDropdown`, otwórz nagłówek, policz przyciski
   wywołujące `setMyWorkIntent({tab:'inbox'})` + `setCurrentView(MY_WORK)` — ma wyjść **dokładnie
   1**, nie 2. Sprawdź też, że pozostały przycisk ma dostępną nazwę/`title` odpowiadającą
   `notificationDropdown.inbox`/`.openInbox`.
3. **Dowód mutacyjny.** Przywróć usunięty blok (`cp` ze `SCRATCH`) → licznik z punktu 2 wraca do 2,
   test **czerwony** → usuń ponownie → **zielony**; `git diff` po ostatecznym stanie zgodny z
   zamierzoną zmianą (blok trwale usunięty w commicie).
4. **Nie zmieniasz** reszty nagłówka (`Mark all read`, `Close`) ani logiki `handleMarkAllRead`.

**Wymagany dowód:** diff usuniętego bloku · test render+count(1) · mutacja w obie strony.
**Commit po `R4`.**

## R5 — `ChatHistorySidebar` FALLBACK UJEDNOLICONY (`C` D-2)

1. **Zmień fallback** w linii `:1060` z `t('aiChat.newChat', 'Nowy czat')` na
   `t('aiChat.newChat', 'Nowa rozmowa')` — dokładnie wartość, jaką dziś zwraca klucz w
   `public/locales/pl/translation.json`. **Zakaz dotykania słownika** — to WYŁĄCZNIE literał w
   kodzie JS.
2. **Dowód behawioralny (fallback jest niewidoczny w normalnym renderze, bo klucz istnieje —
   trzeba wymusić jego brak).** Zamontuj `ChatHistorySidebar` z instancją i18n, w której klucz
   `aiChat.newChat` jest CELOWO usunięty/nadpisany na `undefined` (np. `i18n.addResourceBundle` z
   pominiętym kluczem, albo lokalny mock `useTranslation` zwracający realny fallback drugiego
   argumentu przy braku klucza — wybierz metodę zgodną z tym, jak reszta pakietu testuje i18n w
   tym repo, opisz wybór w raporcie). Sprawdź, że widoczny tekst przycisku „Nowy czat” (duży
   przycisk w panelu historii) równa się **„Nowa rozmowa”**, nie „Nowy czat”.
3. **Dowód mutacyjny.** Cofnij zmianę fallbacku → test **czerwony** (pokazuje „Nowy czat”) →
   przywróć → **zielony**.

**Wymagany dowód:** diff jednej linii · test render z wymuszonym brakiem klucza + asercja tekstu ·
mutacja w obie strony. **Commit po `R5`.**

## R6 — CZĘŚĆ B: POMIAR I USUNIĘCIE MARTWYCH PLIKÓW (rdzeń)

1. **Zmierz od zera na SWOIM worktree** (nie kopiuj moich liczb): `node scripts/dev/
   reachability-from-root.mjs > $ARTEFAKTY/reach-before.json`, wyfiltruj szesnastu kandydatów po
   PEŁNEJ ścieżce (nie substring — patrz Pułapka (6)). Zapisz klasyfikację każdego: `unreachable`
   albo `test-only`. **Jeżeli którykolwiek wyjdzie `app`/`harness-only` — ZATRZYMUJESZ się na TYM
   pliku, nie usuwasz go, piszesz dlaczego w raporcie** (to dokładnie to, co stało się z
   `ActionCenter.tsx` w tej instrukcji).
2. **KROK 0 — rodzina, dla KAŻDEGO kandydata z osobna** (`R0` punkt 2): `grep -rn <Nazwa> src/
   tests/ dev-render/`, rozstrzygnij każde trafienie (realny import / barrel / mock / komentarz).
   Zapisz tabelę: plik kandydata → lista trafień → klasyfikacja każdego → decyzja.
3. **Usuń plik + jego dedykowany test** (dla trójki `test-only`) w JEDNYM commicie na plik (albo
   w jednym commicie dla logicznej pary plik+test+barrel+mock, jeśli są powiązane — np.
   `WorkCanvasShell.tsx` + `tests/components/AIChat/WorkCanvasShell.test.tsx` +
   `WorkCanvas/index.ts` w jednym commicie).
4. **Napraw barrel `WorkCanvas/index.ts`** w tym samym commicie co `WorkCanvasShell.tsx` — usuń
   CAŁY plik (skoro sam jest `unreachable` i jego jedyny nie-typowy eksport znika) ALBO usuń
   wyłącznie linię re-eksportu `WorkCanvasShell`, zostawiając re-eksport typów, JEŚLI Twój pomiar
   pokaże, że coś jednak importuje ten barrel dla typów (`R0` punkt 1 wymaga to sprawdzić —
   moim pomiarem na markerze: nic go nie importuje, typy idą bezpośrednio z `./types`, więc
   REKOMENDUJĘ usunięcie całego barrela, ale zweryfikuj sam).
5. **Posprzątaj dwa martwe mocki** w tym samym commicie co plik, na który wskazują: usuń linię
   `:98` w `EnhancedChatInput.teresaVoice.test.tsx` (mock `InputHintStrip`) razem z commitem
   usuwającym `InputHintStrip.tsx`; usuń blok `:266-268` w `UnifiedChatPanel.test.tsx` (mock
   `PendingActionsIndicator`) razem z commitem usuwającym `PendingActionsIndicator.tsx`. Po każdym
   z tych dwóch commitów: `npx vitest run <plik testowy>` PRZED (na kopii ze `SCRATCH`, z plikiem
   źródłowym jeszcze obecnym) i PO (plik źródłowy usunięty, mock usunięty) — oba zielone, ta sama
   lista pełnych nazw testów w pliku (poza usuniętym mockiem, który nie jest testem tylko
   deklaracją).
6. **Dowód „zero importerów pozostałych”, PO wszystkich usunięciach.** Dla KAŻDEGO usuniętego
   pliku: `grep -rn <Nazwa> src/ tests/ dev-render/` ma dać **zero** wyników. Jeśli cokolwiek
   zostało — **STOP**, nie kończysz `R6`, naprawiasz brakujący krok (barrel/mock) albo cofasz
   usunięcie tego jednego pliku.
7. **`esbuild` per plik** na każdym pliku, który wg kroku 2 miał realny import/barrel wskazujący
   na usuwany plik — oczekiwane: PO naprawie w krokach 3-5, esbuild przechodzi bez błędu importu.
8. **Zaktualizuj i sprawdź baseline**: `--update-baseline` (skrypt sam odmówi, gdyby zbiór
   UROSŁ — Ty go tylko zmniejszasz), zapisz `unreachable`/`test-only` przed i po w raporcie, potem
   `--check-baseline` końcowe, kod `0`. Cztery bezpieczniki (`check-list-canon.sh`,
   `check-focus-canon.sh --ci`, `check-artefakt.sh`, plus `--check-baseline` już policzone) —
   wszystkie kod `0`.
9. **Tabela raportu, jeden wiersz na usunięty plik**: ścieżka, dowód nieosiągalności (komenda +
   wynik dosłowny), rozmiar, czy miał dedykowany test (i jego los), czy wymagał naprawy
   barrela/mocka. Osobno zmierz i zapisz jako znalezisko (NIE usuwaj) dwa martwe barrele
   `Artifacts/index.ts`/`renderers/index.ts`/`renderers/index2.ts` — `unreachable`, ale poza
   listą kandydatów TEGO dyżuru.

**Wymagany dowód:** `reach-before.json`/`reach-after.json` · tabela KROK 0 dla każdego kandydata ·
commity per plik/grupa · dwa dowody `vitest run` przed/po dla plików z mockami · dowód „zero
importerów” per plik usunięty · `esbuild` per plik naprawiony · `--update-baseline` +
`--check-baseline` zielony · cztery bezpieczniki zielone · tabela raportu z rozmiarami.
**Commit(y) po `R6`** (jeden na plik/grupę, zgodnie z krokiem 3).

## R7 — RAPORT, REJESTR ZNALEZISK, PYTANIA DO WŁAŚCICIELA

Raport zawiera: pięć napraw Części A z dowodem behawioralnym i mutacyjnym każda · tabelę usuniętych
plików Części B (ścieżka, dowód, rozmiar, los testu/barrela/mocka) · dwie korekty wobec briefu
(`ActionCenter.tsx`, `Artifacts/**`) z dowodem importerów · dowód „zero importerów pozostałych” ·
stan baseline reachability przed/po · listę rozbieżności wobec liczb tej instrukcji · niepustą
sekcję „TWIERDZENIA NIEZWERYFIKOWANE”.

★★ **Osobna, obowiązkowa sekcja: „ZNALEZISKA POZA ZAKRESEM”.** Dwa martwe barrele `Artifacts/
index.ts`/`renderers/index.ts`/`renderers/index2.ts` · `MyWork/table/SmartSuggestionsBar.tsx`
(martwy, ale inny moduł) · wszystko inne, co pomiar wykaże jako martwe, a nie jest na liście
kandydatów tego dyżuru.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Jeśli `R1` nie znalazł jednoznacznej
akceptacji, które z dwóch miejsc duplikatu „Dataset ready” miało zostać — zapisz to jako pytanie
(nawet jeśli zastosowałeś regułę awaryjną i już wdrożyłeś rozwiązanie: właściciel może zażądać
odwrotnej kolejności przy następnym przeglądzie ekranu). Sekcja **nie może być pusta**.

★ Zanim dopiszesz cokolwiek do `REJESTR_ZNALEZISK_20260903.md`, sprawdź pierwszą wolną literę TUŻ
PRZED COMMITEM: `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md |
tail -3"` — moim pomiarem 05.09 to `AG` (po `AF`), ale równolegle piszą autorzy 367-372.

**Commit po `R7`.**

## Próg odbioru

**Pięć duplikatów/mylących etykiet Części A naprawionych z dowodem behawioralnym i mutacyjnym,
zachowanie nawigacyjne tam, gdzie nie miało się zmienić, NIETKNIĘTE; szesnaście kandydatów Części
B zmierzonych na TWOIM worktree metodą osiągalności od korzenia, usunięte TYLKO te potwierdzone
martwe, z zerem importerów pozostałych po usunięciu, z naprawionymi barrelami/mockami w tym samym
commicie, i z baseline reachability zaktualizowanym.**

Odbiorca odrzuci dyżur, w którym: jakikolwiek nowy test sprawdza tekst źródła zamiast zachowania;
usunięto plik, który okazał się żywy (np. `ActionCenter.tsx`); pozostał dziurawy barrel albo martwy
`vi.mock`/`vi.doMock` wskazujący usunięty plik; zmieniono zachowanie nawigacji `TaskDropdown`/
`NotificationDropdown` zamiast wyłącznie etykiety; usunięto lub zmieniono klucz i18n z listy
dyżuru 372; zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „`R1`-`R5` naprawione i
udowodnione mutacyjnie, `R6` zatrzymany po ośmiu z szesnastu plików, bo pozostałe osiem wymaga
dodatkowej naprawy barrela, którą wykonam w kolejnym kroku” — **jest pełnowartościowym wynikiem**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku. Wynik ponownego
sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Usuń martwe pliki” vs „nie zmieniaj `public/locales/**`” | Tabela licencji: usuwanie PLIKÓW komponentów nie usuwa KLUCZY i18n — klucze osierocone WYŁĄCZNIE przez usuwany plik zostają, chyba że nie figurują na liście 372 (wtedy i tak zostają, bo ten dyżur nie ma licencji na usuwanie kluczy w ogóle — tylko na 2 wyjątki imienne w R1/R3) |
| „Etykieta ma być uczciwa” vs „nie zmieniasz logiki nawigacji” | `R3` punkt 3: zmieniasz WYŁĄCZNIE tekst klucza, `handleNavigateToTasks` zostaje identyczny |
| „Panel ma zostać jeden” vs „nie wiadomo, który właściciel zaakceptował” | `R1` punkt 1: reguła awaryjna z briefu (zostaje poza kebabem), z jawnym pytaniem do właściciela w `R7` |
| „Dodaj nowy przycisk (Pokaż analizy)” vs „BRAK NOWYCH FLAG / brak nowego UI” | `POZYCJE_Z_FLAGAMI`: to redukcja duplikatu (jeden z dwóch już wdrożonych zestawów znika), nie nowa funkcja — bez flagi |
| „Usuń `WorkCanvasShell.tsx`” vs „`WorkCanvas/index.ts` nietykalny jako martwy plik spoza listy” | `R6` punkt 4: barrel JEST powiązany z kandydatem z listy (re-eksportuje go), więc naprawa w tym samym commicie jest WYMAGANA, nie opcjonalna — różni się od dwóch martwych barreli `Artifacts/*`, które nie re-eksportują żadnego kandydata tego dyżuru |
| „Usuń pliki testowe kandydatów” vs „nie dotykaj `tests/setup.ts`/`__mocks__`” | Rozróżnienie: usuwasz DEDYKOWANE testy komponentu (`__tests__/InputHintStrip.test.tsx` itd.), nigdy globalną infrastrukturę testową |
| „`ActionCenter.tsx` jest na liście briefu” vs „Twój pomiar mówi że jest żywy” | `R0` punkt 1 i `Z40`: Twój pomiar wygrywa, audyt źródłowy się mylił, dowód importerów idzie do raportu |
| „Zmierz baseline” vs „baseline nietykalny” | Tabela licencji: nietykalny RĘCZNIE, aktualizacja WYŁĄCZNIE przez własny skrypt z `--update-baseline`, który sam broni się przed wzrostem |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki Części A i B sprawdzone `git show <marker>:<ścieżka>`; `evidence/duplikaty-martwe-20260905/` jawnie oznaczony jako nieistniejący |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy, wszystkie zmierzone na markerze albo na bliskim checkoucie z jawnie opisaną rozbieżnością (`reach=1`) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — panel kanwy (4 bloki) · TaskDropdown · NotificationDropdown · ChatHistorySidebar · model intencji · 2 wyjątki słownikowe · reszta słowników · kandydaci unreachable · kandydaci test-only · barrel zależny · martwe mocki · guard bez importu · cudze żywe rodziny · martwe barrele poza zakresem · baseline · nowe testy · infrastruktura testowa · macierz · rejestr · raport · serwer · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`/`R2` dotykają precyzyjnie wskazanych bloków jednego pliku (nie całych 5278 linii), `R3`-`R5` po jednym pliku, `R6` iteruje plik po pliku z jawnym stopem na nietrafionym |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6444/5584 nieużywane przez rodzeństwo 367-372; ten dyżur w ogóle nie wymaga kontenera DB |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na checkoucie bliskim markerowi, z jawnym opisem jedynej rozbieżności |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — siedem pułapek własnych (plik-bez-importera, martwe poddrzewo, komentarz-nie-import, barrel dziurawy, mock-nie-AST-import, rodziny o podobnej nazwie, klucz-przetłumaczony-ale-kłamie) |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, zero pól szablonu | TAK — kontrola generatora przy wydaniu |

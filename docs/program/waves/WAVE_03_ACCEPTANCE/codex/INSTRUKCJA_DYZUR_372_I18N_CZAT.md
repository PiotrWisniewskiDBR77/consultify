# INSTRUKCJA DYŻURU nr 372 — Codex — „★★ RODZINA "ANGIELSKI W POLSKIM UI" NA EKRANIE CZAT AI — nie ~40, tylko **co najmniej 250 miejsc**, zmierzone mechanicznie po TREŚCI (wartość PL brakująca), nie po samej obecności klucza. **(1)** 43 literały BEZ ŻADNEGO wywołania `t()` — stringi wpisane na sztywno (`src/utils/canvas/canvasActionAvailability.ts:27-47` (14), `WorkCanvasDocumentPanel.tsx` pending-operation `:5158/5166/5173` (3) + `datasetArtifactActions` `:461-490` (7), `CanvasArtifactBlockRenderer.tsx` `EvidenceList`/aria-label/`BlockHeader` `:240,310,379-500,808-844` (17), `ToolsMenu.tsx:625` "Reset" (1), `window.confirm` na sztywno w `ChatHistorySidebar.tsx:641` (1)). **(2)** 13 kluczy `canvas.aiMenu.quickAction.*`/`tone.*` NIE ISTNIEJĄ w żadnym słowniku (`CanvasAIFloatingMenu.tsx:313,329` — komponent MA gotowe polskie `labelPl` w tej samej tablicy i GO NIE UŻYWA jako fallbacku). **(3)** `UnifiedChatPanel.tsx`+`ChatHistorySidebar.tsx`+`ConversationActions.tsx`+`MoveToProjectModal.tsx`+`SystemHealth.tsx` mają RAZEM **58 wywołań** `t(klucz, fallback)` z kluczem BEZ polskiej wartości — 14 z nich mam już zweryfikowane imiennie z `plik:linia` (audyt nazwał tę pod-rodzinę "7 kluczy", moja liczba to inna definicja mianownika), pozostałe 44 wychodzą z mechanicznego skanu `R1`. **(4)** `MessageRenderer.tsx` + 9 innych komponentów-kart mają RAZEM **136 wywołań** `t(klucz, fallback)` z kluczem bez polskiej wartości — audytor 05.09 nazwał pełny sweep tej rodziny wprost "poza zakresem czasowym" i TEN dyżur jest tym sweep. ★ KOREKTA: `canvas.versionHistory.confirmRestore/confirmYes/cancel`, zgłoszone w audycie jako brakujące (`A2` D-6), są JUŻ w obu słownikach z poprawną polską wartością — nie dotykasz tej rodziny, to fałszywy alarm sprzed naprawy równoległego dyżuru"

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
> **wyłącznie** `/private/tmp/cx-day372-i18n-czat`.

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
Zakres: **`13_CHAT` — WYŁĄCZNIE tekst (i18n) na ekranie „Czat AI” (`/chat`) i jego panelu kanwy. Zero zmian logiki, zero zmian tras, zero dotknięcia serwera — to jest dyżur czysto frontendowy/słownikowy. Rodzina 1 z `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`: angielskie napisy widoczne w polskim UI. Cztery pod-rodziny: (A) literały bez ŻADNEGO `t()` w pasku kanwy, blokach datasetu i `ToolsMenu.tsx` — `R2`; (B) brakujące klucze menu AI edytora — `R3`; (C) pełny sweep nagłówka/historii/SystemHealth + jeden `window.confirm` na sztywno — `R4`; (D) pełny sweep `MessageRenderer.tsx` + kart wiadomości — `R5`, największa pozycja**.
Trasy front: `**CAŁY zakres tego dyżuru jest frontowy.** Pliki z pełną licencją opisane w `R2`-`R5` (tabela licencji poniżej). Poza nimi `src/**` jest TYLKO DO ODCZYTU — w szczególności logika liczenia, handlery `onClick`, zapytania `Api.*`, store'y zustand NIE są dotykane; zmieniasz wyłącznie: (a) treść w `public/locales/{pl,en}/translation.json`, (b) zamianę literału na `t('nowyKlucz', 'ten sam literał EN jako fallback')` w JSX, (c) nowe/rozszerzone pliki testowe`. Trasy tył: `**BRAK.** Ten dyżur nie dotyka `server/src/**` w ogóle — żadnej trasy, żadnego kontrolera, żadnej migracji. Jeżeli w trakcie pracy okaże się, że którykolwiek z ~250 literałów pochodzi z odpowiedzi serwera (nie z kodu klienta) — to jest STOP MERYTORYCZNY dla TEJ pozycji, nie całego dyżuru: zapisujesz `plik:linia` po stronie serwera i przechodzisz dalej`.

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
WT=/private/tmp/cx-day372-i18n-czat
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
git -C "$VAULT" worktree add "$WT" -b codex/day372-i18n-czat-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day372-i18n-czat/config.worktree"
cat "$VAULT/worktrees/cx-day372-i18n-czat/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day372-i18n-czat-scratch
mkdir -p /private/tmp/cx-day372-i18n-czat-artefakty

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
git -C "$WT" push github-backup codex/day372-i18n-czat-20260905
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `czternaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: canvasActionAvailability.ts ma 14 etykiet BEZ t(), linie 27-47
sed -n '27,47p' src/utils/canvas/canvasActionAvailability.ts
bash -c "grep -c \"': '\" src/utils/canvas/canvasActionAvailability.ts\""
#   moje liczby: DOKLADNIE 14 wpisow (copy/share/save/close/view-document/view-md/
#   create-presentation/create-table/create-report/send-to-idea/save-as-note/
#   create-initiative/create-decision/create-task), zero t(). Uzywane jako
#   aria-label ORAZ title w WorkCanvasDocumentPanel.tsx:3232-3260 (renderCommandButton).

# (2) TEZA: pending-operation (3) + datasetArtifactActions (7) tez zero t()
sed -n '461,490p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
bash -c "grep -n 'applyLabel\|Revise edit\|Reject\b' src/components/AIChat/WorkCanvasDocumentPanel.tsx"
#   moje liczby: 7 pozycji w datasetArtifactActions (linie 466-486), uzyte w
#   renderze na liniach 3767 i 4264 (DWA miejsca renderujace TO SAMO zrodlo —
#   patrz pulapka 5); pending-operation: 'Revise edit' (:5158), applyLabel (:5166),
#   'Reject' (:5173) — zero t() na wszystkich trzech.

# (3) TEZA: CanvasArtifactBlockRenderer.tsx — EvidenceList (12) + aria-label (2) + BlockHeader (3)
bash -c "grep -n 'title=\"[A-Z]' src/components/AIChat/CanvasArtifactBlockRenderer.tsx"
bash -c "grep -n 'aria-label={\`' src/components/AIChat/CanvasArtifactBlockRenderer.tsx"
sed -n '808,844p' src/components/AIChat/CanvasArtifactBlockRenderer.tsx
#   moje liczby: 12 EvidenceList title="..." po angielsku (linie 379-383,413-416,
#   498-500), 2 aria-label z template-literalem zaczynajacym sie po angielsku
#   ('Filter '/'Select row ', linie 240,310), BlockHeader (:808-844) ma 3 literaly
#   ('block' w linii ~820, 'Copy' ~833, 'CSV' ~843) wolane z 6 miejsc (linie
#   231/340/344/361/400/434/566/688 wg grep 'BlockHeader'). RAZEM klasa (b) w tym
#   pliku: 17 (12+2+3).

# (4) TEZA: ToolsMenu.tsx — 'Reset' na sztywno, linia 625
sed -n '614,638p' src/components/AIChat/ToolsMenu.tsx
#   moje liczby: linia 625 = '>Reset<' (JSX text node, zero t()); linia 636 tuz obok
#   POPRAWNIE uzywa t('common.save','Save') — bezposrednie porownanie w tym samym
#   bloku. common.reset NIE ISTNIEJE w zadnym slowniku (sprawdzone komenda 9).
#   ★ RAZEM KLASA (b) na cala rodzine: 14+3+7+17+1 = 42.

# (5) TEZA: CanvasAIFloatingMenu.tsx — 13 kluczy quickAction/tone BRAKUJACYCH,
#     a polskie etykiety JUZ ISTNIEJA w tablicy zrodlowej (martwe labelPl)
sed -n '40,145p' src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx
bash -c "grep -n 'quickAction\|tone\.' src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx"
#   moje liczby: QUICK_ACTIONS ma 11 wpisow (expand/shorten/rewrite/final_polish/
#   length_concise/length_detailed/level_exec/level_expert/level_beginner/
#   translate_en/translate_pl), KAZDY ma labelPl WYPELNIONE; TONE_OPTIONS ma 2
#   (tone_formal/tone_simple), tez z labelPl. Renderowanie (:313,329) uzywa
#   `t(klucz, action.labelEn)` — labelPl kompletnie zignorowane w fallbacku.

# (6) TEZA: 13 kluczy z (5) NIE ISTNIEJA w zadnym slowniku
python3 -c "
import json
pl=json.load(open('public/locales/pl/translation.json'))
en=json.load(open('public/locales/en/translation.json'))
def get(d,p):
    c=d
    for x in p.split('.'):
        if not isinstance(c,dict) or x not in c: return None
        c=c[x]
    return c
ids=['expand','shorten','rewrite','final_polish','length_concise','length_detailed','level_exec','level_expert','level_beginner','translate_en','translate_pl']
for i in ids: print('canvas.aiMenu.quickAction.'+i, get(pl,'canvas.aiMenu.quickAction.'+i), get(en,'canvas.aiMenu.quickAction.'+i))
for i in ['tone_formal','tone_simple']: print('canvas.aiMenu.tone.'+i, get(pl,'canvas.aiMenu.tone.'+i), get(en,'canvas.aiMenu.tone.'+i))
"
#   oczekiwane: wszystkie None/None (13 wierszy)

# (7) TEZA: UnifiedChatPanel.tsx — workPanel.title/resizeDivider/business/muteNow BRAKUJACE
#     (to sa TYLKO 4 imiennie sprawdzone przeze mnie pozycje z WIEKSZEJ rodziny —
#     patrz komenda 8b dla pelnego mianownika tego pliku)
bash -c "grep -n \"workPanel\.title\|workPanel\.resizeDivider\|aiChat\.business\|aiChat\.muteNow\" src/components/AIChat/UnifiedChatPanel.tsx"
#   moje liczby: linie 6797/6798 (business), 6883/6890 (muteNow), 7490 (workPanel.title),
#   7495 (workPanel.resizeDivider) — 4 miejsca uzycia, 4 klucze rozne, WSZYSTKIE
#   potwierdzone brakujace w obu slownikach.

# (8) TEZA: ChatHistorySidebar/ConversationActions/MoveToProjectModal — 9 dalszych
#     kluczy aiChat.* imiennie sprawdzonych BRAKUJACYCH + window.confirm na sztywno
bash -c "grep -n 'window.confirm' src/components/AIChat/ChatHistorySidebar.tsx"
bash -c "grep -rn \"aiChat\.actions\.export\|aiChat\.actions\.purge\|aiChat\.confirmDeleteDestructive\|aiChat\.confirmPurge\|aiChat\.confirmDeleteFolder\|aiChat\.deleteFolderFailed\|aiChat\.confirmMovePrivateToOrganization\|aiChat\.visibilityConsentRecorded\" src/components/AIChat/ --include='*.tsx'"
#   moje liczby: window.confirm linia 641 (string szablonowy, zero t()); 9 kluczy
#   uzyte w ConversationActions.tsx(:356,368,392,407), MoveToProjectModal.tsx(:153,168),
#   ChatHistorySidebar.tsx(:899,902,910,943,956) — razem z (7) daje 13 kluczy
#   IMIENNIE ZWERYFIKOWANYCH + 1 string class-b w tej pod-rodzinie. Audyt nazwal to
#   "7 kluczy" — moja definicja mianownika daje 13, ZAPISZ ROZBIEZNOSC. ★★ ALE to
#   NIE JEST caly mianownik tych piecu plikow — patrz komenda (8b), mechaniczny
#   skan znajduje WIECEJ.

# (8b) ★★ PELNY mianownik R4: mechaniczny skan 5 plikow (nie tylko 13 imiennie
#      wymienionych wyzej) — ZAPISZ TEN SKRYPT DO PLIKU (nie przez heredoc,
#      uzyj swojego edytora/Write) jako np. evidence/i18n-czat/skan-r4.py,
#      tresc ponizej w osobnym bloku ```python```, potem uruchom:
python3 evidence/i18n-czat/skan-r4.py
#   moje liczby: RAZEM 58 (UnifiedChatPanel.tsx 36, ChatHistorySidebar.tsx 7,
#   ConversationActions.tsx 5, MoveToProjectModal.tsx 7, SystemHealth.tsx 3) —
#   to jest PELNY mianownik R4, nie 14. Twoje 13+1 imiennie sprawdzone sa
#   PODZBIOREM tych 58 (SystemHealth.tsx wchodzi tu jako 3, w tym system.dataAccess
#   z komendy 9 — nie licz go podwojnie).

# (9) TEZA: SystemHealth.tsx — system.dataAccess BRAKUJACY (1 z 3 w tym pliku, patrz 8b)
bash -c "grep -n 'system.dataAccess' src/components/SystemHealth.tsx"
python3 -c "import json; d=json.load(open('public/locales/pl/translation.json')); print('dataAccess' in d.get('system',{}))"
#   oczekiwane: linia 191, i False (klucza nie ma w drzewie 'system')

# (10) ★ KOREKTA: canvas.versionHistory.* — audyt (A2 D-6) mowi 'brakujace', TY sprawdz
python3 -c "
import json
pl=json.load(open('public/locales/pl/translation.json'))
en=json.load(open('public/locales/en/translation.json'))
for k in ['confirmRestore','confirmYes','cancel','title','justNow']:
    print('canvas.versionHistory.'+k, pl.get('canvas',{}).get('versionHistory',{}).get(k), en.get('canvas',{}).get('versionHistory',{}).get(k))
"
#   moje liczby: WSZYSTKIE PIEC obecne i po polsku w pl, po angielsku w en —
#   audyt A2 D-6 byl NIEAKTUALNY w chwili pisania tej instrukcji (naprawione przez
#   rownolegly dyzur). NIE TLUMACZ TEJ RODZINY PONOWNIE.

# (11) ★★ TEZA: MessageRenderer.tsx + 9 innych kart (z 19 sprawdzonych plikow)
#      maja RAZEM 136 wywolan t(klucz,fallback) z kluczem BEZ POLSKIEJ WARTOSCI
#      (klasa 'a', pelny sweep tej rodziny) — ZAPISZ SKRYPT DO PLIKU (nie przez
#      heredoc), np. evidence/i18n-czat/skan-r5.py, tresc w osobnym bloku
#      ```python``` ponizej, potem uruchom:
python3 evidence/i18n-czat/skan-r5.py
#   moje liczby: MessageRenderer.tsx 48, TrustBadge.tsx 19, ExecutionProposalMessage.tsx 18,
#   GovernedInitiativeHandoffCard.tsx 17, ResearchProgress.tsx 11, CitationList.tsx 9,
#   TeresaProposalCard.tsx 8, InlineResponseFeedback.tsx 3, ArtifactBadge.tsx 2,
#   GovernedChatHandoffCard.tsx 1 — RAZEM 136. Pozostale 9 z 19 sprawdzonych plikow
#   (ArtifactChip, CaseIntakeConfirmCard, ChatTableProposalCard, Messages/InlineThinkingStream,
#   Messages/ReasoningTrace, SourcesStrip, StructuredOutputBlock, ToolStepList, TrustPanel,
#   ChatCodeBlock) maja 0 trafien klasy (a) — zostaja w rodzinie (KROK 0 = caly plik,
#   nie prozka), ale nie wnosza nic do mianownika.
#   ★ UWAGA METODOLOGICZNA: filtr to WYLACZNIE brak wartosci PL (nie "PL LUB EN
#   brakuje") — bo to jest miara DEFEKTU WIDOCZNEGO (angielski w polskim UI), nie
#   miara parytetu slownikow. Klucze z PL obecnym a EN brakujacym (istnieja, np.
#   w GovernedChatHandoffCard.tsx) NIE WCHODZA do tych 136 — to osobna, nizszego
#   priorytetu usterka parytetu, opisz ja w raporcie jesli ja zauwazysz, nie
#   naprawiaj w tym dyzurze jako rdzen.

# (12) liscie slownikow (nie moga zmalec) + 4 bezpieczniki kanonu
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35204, en 33071; focus=0, list=0, artefakt=0,
#   ★★ reach=1 — NIE od tego dyzuru, patrz komenda (13)

# (13) ★★ TEZA: reach=1 juz NA MARKERZE, z powodu NIEZWIAZANEGO z tym dyzurem
node scripts/dev/reachability-from-root.mjs --check-baseline
#   moje liczby: 'New test-only files (3)' — initiativeKartaRealnyRekord.test.ts,
#   macierz-sedno-20260905.test.tsx, AdminSettingsModule.healthSectionI18n.test.ts.
#   Te trzy pliki NIE naleza do rodziny AIChat/canvas i NIE zostaly dodane przez
#   ten dyzur — to jest PRZEDISTNIEJACA czerwien bramki na markerze. Twoj wlasny
#   nowy plik testowy w src/components/AIChat/__tests__/ DOLOZY czwarta pozycje —
#   patrz R6 jak to obsluzyc (dopisanie do reachability.baseline.json).

# (14) TEZA: check-etykiety-dwujezyczne.mjs NIE OBEJMUJE AIChat/canvas domyslnie
bash -c "grep -n 'roots = ' scripts/dev/check-etykiety-dwujezyczne.mjs"
bash -c "grep -n 'check-etykiety-dwujezyczne' .husky/pre-commit"
#   moje liczby: domyslne roots = ['src/components/DiscoveryTools','src/toolPacks']
#   (linia 51); pre-commit (linia 29) wola SKRYPT BEZ ARGUMENTOW → domyslny zakres.
#   AIChat i utils/canvas NIE SA objete zadnym bezpiecznikiem etykiet dzis.
```

Treść skryptu dla komendy (8b) — zapisz DOSŁOWNIE jako `evidence/i18n-czat/skan-r4.py` (nowy plik, `git add -f`, nie uruchamiaj przez heredoc bash):

```python
import re, json, os
ROOT = os.getcwd()
pl = json.load(open(ROOT + '/public/locales/pl/translation.json'))
en = json.load(open(ROOT + '/public/locales/en/translation.json'))
def get(d, path):
    cur = d
    for p in path.split('.'):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur
files = [
    'src/components/AIChat/UnifiedChatPanel.tsx',
    'src/components/AIChat/ChatHistorySidebar.tsx',
    'src/components/AIChat/ConversationActions.tsx',
    'src/components/AIChat/MoveToProjectModal.tsx',
    'src/components/SystemHealth.tsx',
]
t_re = re.compile(r"\bt\(\s*(['\"`])([a-zA-Z0-9_.]+)\1\s*,\s*(['\"`])((?:\\.|(?!\3).)*)\3")
missing = 0
for f in files:
    p = os.path.join(ROOT, f)
    text = open(p, encoding='utf-8').read()
    cnt = 0
    for m in t_re.finditer(text):
        key = m.group(2)
        if get(pl, key) is None:
            missing += 1
            cnt += 1
    print(cnt, f)
print('RAZEM:', missing)
```

Treść skryptu dla komendy (11) — zapisz DOSŁOWNIE jako `evidence/i18n-czat/skan-r5.py` (nowy plik, `git add -f`, nie uruchamiaj przez heredoc bash):

```python
import re, json, os
ROOT = os.getcwd()
pl = json.load(open(ROOT + '/public/locales/pl/translation.json'))
en = json.load(open(ROOT + '/public/locales/en/translation.json'))
def get(d, path):
    cur = d
    for p in path.split('.'):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur
files = [
    'src/components/AIChat/MessageRenderer.tsx',
    'src/components/AIChat/ArtifactBadge.tsx',
    'src/components/AIChat/ArtifactChip.tsx',
    'src/components/AIChat/CaseIntakeConfirmCard.tsx',
    'src/components/AIChat/ChatTableProposalCard.tsx',
    'src/components/AIChat/CitationList.tsx',
    'src/components/AIChat/ExecutionProposalMessage.tsx',
    'src/components/AIChat/GovernedChatHandoffCard.tsx',
    'src/components/AIChat/GovernedInitiativeHandoffCard.tsx',
    'src/components/AIChat/InlineResponseFeedback.tsx',
    'src/components/AIChat/Messages/InlineThinkingStream.tsx',
    'src/components/AIChat/Messages/ReasoningTrace.tsx',
    'src/components/AIChat/ResearchProgress.tsx',
    'src/components/AIChat/SourcesStrip.tsx',
    'src/components/AIChat/StructuredOutputBlock.tsx',
    'src/components/AIChat/TeresaProposalCard.tsx',
    'src/components/AIChat/ToolStepList.tsx',
    'src/components/AIChat/TrustBadge.tsx',
    'src/components/AIChat/TrustPanel.tsx',
    'src/components/AIChat/ChatCodeBlock.tsx',
]
t_re = re.compile(r"\bt\(\s*(['\"`])([a-zA-Z0-9_.]+)\1\s*,\s*(['\"`])((?:\\.|(?!\3).)*)\3")
missing = 0
for f in files:
    p = os.path.join(ROOT, f)
    if not os.path.exists(p):
        print('BRAK PLIKU', f)
        continue
    text = open(p, encoding='utf-8').read()
    cnt = 0
    for m in t_re.finditer(text):
        key = m.group(2)
        if get(pl, key) is None:
            missing += 1
            cnt += 1
    if cnt:
        print(cnt, f)
print('RAZEM:', missing)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day372-i18n-czat-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6443`. Twój JEDYNY port harnessu to `5583`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day372-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP), 6000, 6665-6669. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ paczki 05.09 (367-373) — nie dotykasz: 367 (6438/5578), 368 (6439/5579), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 373 (6444/5584). Twoje własne wyłącznie: baza 6443, harness 5583. ★★ UWAGA: ten dyżur w praktyce NIE POWINIEN potrzebować kontenera PostgreSQL wcale — patrz `§0.2c` w treści: zero tras serwerowych, zero zapisu do bazy. Jeżeli mimo to uruchamiasz kontener (np. bo pakiet testowy importuje coś, co pośrednio dotyka `tests/setup.ts`), rezerwujesz port **6443/5583** i **NIKT INNY** ich nie używa. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (`$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur naprawia teksty w istniejących, już-widocznych elementach UI (paski, menu, historia, karty wiadomości) — to jest naprawa potwierdzonego defektu i18n, NIE nowy element wizualny, więc reguła "nowy ekran = flaga OFF" (`Z11`) **nie ma zastosowania** (patrz `AUDYT SPRZECZNOŚCI`). Jedyny wyjątek do rozstrzygnięcia: panel "workflow ledger" w kebabie kanwy (`WorkCanvasDocumentPanel.tsx` ok. `:4692-4906`) jest już dziś za `isCanvasDevDiagnosticsEnabled()` (`VITE_DEV_DIAGNOSTICS`, default OFF, diagnostyka deweloperska, NIE feature produktowy) — ten dyżur GO NIE TŁUMACZY (poza zakresem, nieklientowy), patrz `R2` i `PYTANIA DO WŁAŚCICIELA``, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/check-etykiety-dwujezyczne.mjs` (WĄSKA LICENCJA — patrz `R6`), `scripts/dev/check-etykiety-dwujezyczne.baseline.json` (WĄSKA LICENCJA — patrz `R6`), `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WĄSKA LICENCJA — dopisanie WYŁĄCZNIE własnych nowych plików testowych, patrz `R6`), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU poza jawnie wymienionymi wąskimi wyjątkami`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY372_I18N_CZAT_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sprawdzone przy pisaniu tej instrukcji: sekcje doszły do `AF` (dyżur 365), więc następna wolna to `AG` — **ale to jest MÓJ pomiar sprzed wydania; sprawdzasz TY, komendą, tuż przed commitem, bo równolegle piszą inni autorzy paczki 367-373** — oraz nowy katalog dowodowy `evidence/i18n-czat/**` (NIE ISTNIEJE na markerze — tworzysz). ★ `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` — WĄSKA LICENCJA (`R6`), nie pełna. Plik postępu `/private/tmp/cx-day372-i18n-czat-postep.md` żyje POZA repo. Nowe pliki w `tests/` i w `src/**/__tests__/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day372-i18n-czat-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day372-i18n-czat-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ TŁUMACZENIA-ATRAPY.** Wartość PL nie może być kopią wartości EN (chyba że to nazwa własna — np. "Teresa", skrót techniczny jak "CSV", "KPI" — i wtedy piszesz uzasadnienie w raporcie, wzorem `justification()` z `scripts/dev/i18n-pl-audyt.mjs`). Klucz "dodany", którego polska wartość to przepisany angielski string, NIE JEST naprawą — jest tym samym defektem z ptaszkiem. ★★★ **ZAKAZ TESTU NA TEKŚCIE ŹRÓDŁA.** `readFileSync` + `toContain` na pliku `.tsx`/`.ts` jest zakazany jako JEDYNY dowód. Wzorzec obowiązkowy: prawdziwa instancja `i18next` (`i18next.createInstance().use(initReactI18next).init({lng:'pl', fallbackLng:false, resources:{pl:{translation: plTranslation}}})`) i wywołanie `testI18n.t(klucz, fallback)` — `fallbackLng:false` gwarantuje, że brakujący klucz zwróci sam `klucz`, nie fallback, więc asercja `expect(translated).not.toBe(klucz)` I `expect(translated).not.toBe(fallback)` naprawdę coś sprawdza; PLUS co najmniej jeden test renderujący realny komponent (`render()` + `screen`/`container.textContent`) na PLIK dotknięty w tej pozycji — wzorzec gotowy w repo: `src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx`, kopiujesz kształt, nie wynik. ★★★ **ZAKAZ ROZSZERZANIA ZAKRESU POZA 30-PLIKOWĄ RODZINĘ** wymienioną w tabeli licencji — jeżeli mechaniczny skan (`R1`) znajdzie ten sam wzorzec POZA tymi 30 plikami, zapisujesz `plik:linia` do sekcji "CO NADAL WYMAGA OSOBNEGO ZLECENIA", NIE naprawiasz tam. ★★ **ZAKAZ ZMIANY LOGIKI.** Wolno zamienić `'Create presentation'` na `t('canvas.actions.createPresentation', 'Create presentation')` — NIE wolno zmienić WARUNKU, w którym przycisk się pokazuje, jego handlera, ani kolejności grup. ★ **ZAKAZ tłumaczenia panelu "workflow ledger"** (dev-diagnostics, `R2` uwaga) — to jest pytanie do właściciela, nie decyzja wykonawcy | Bo audyt 05.09 dał liczbę "~40 miejsc" jako SZACUNEK jednej powierzchni (paska kanwy) i sam przyznał w trzech miejscach, że pełny sweep jest "poza zakresem czasowym" — a to jest dokładnie ten sweep. Klucz i18n, który istnieje ale ma angielską wartość PL, jest ÓSMYM znanym kształtem fałszywego "gotowe" w tym programie (`docs/program/.../klucz-istnieje-nie-znaczy-przetlumaczony...`) — dlatego ten dyżur mierzy WARTOŚĆ, nie tylko OBECNOŚĆ klucza, i dlaczego `canvas.versionHistory.*` (audyt zgłosił jako brakujące) okazało się już naprawione: ktoś zmierzył obecność klucza, nie treść, i to poszło do rejestru jako defekt, którym już nie jest |

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
cd /private/tmp/cx-day372-i18n-czat

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day372-pg psql -U postgres -d cx372 \
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
cd /private/tmp/cx-day372-i18n-czat

docker run -d --name cx-day372-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx372 \
  -p 127.0.0.1:6443:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day372-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6443/cx372 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6443/cx372 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day372-i18n-czat && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6443/cx372 \
JWT_SECRET=cx372-test-secret-do-not-reuse-min-32-znaki \
npx vitest run ★★ TEN DYŻUR JEST CZYSTO JEDNOSTKOWY — wariant **(C)** z `§0.2c`, `RUN_DB_TESTS=0 MOCK_DB=true`, ZERO Postgresa, ZERO migracji. Testy frontu z roota repo (`npx vitest run <ścieżka> --retry=0`), config domyślny (`vitest.config.ts`) — NIE dodajesz `--config server/vitest.config.ts` do niczego w tym dyżurze, bo nic nie dotyka `server/`. Każdy nowy/rozszerzony plik testowy montuje realną instancję `i18next` z realnym JSON-em obu słowników (import bezpośredni `public/locales/{pl,en}/translation.json`), NIGDY `vi.mock('react-i18next', ...)` (to zamaskowałoby dokładnie ten defekt, który mierzysz) — sprawdź na początku pliku, czy `tests/setup.ts` globalnie mockuje `react-i18next`, i jeśli tak, dodaj `vi.unmock('react-i18next')` (wzorzec z `GovernedChatHandoffCard.day179.i18n.test.tsx:11`). Pliki kładziesz w `src/components/AIChat/__tests__/` (KONWENCJA TEGO KATALOGU — 74 istniejące pliki testowe w `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` są już tak skolokowane, w tym dokładnie ten wzorzec dnia 179) — to NIE jest naruszenie ogólnej doktryny "nowe testy do `tests/`", to jest UDOKUMENTOWANY WYJĄTEK tego katalogu, patrz `R6` dla konsekwencji w `reachability-from-root.mjs` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day372-i18n-czat-artefakty/day372-i18n-czat.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day372-i18n-czat && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run ★★ TEN DYŻUR JEST CZYSTO JEDNOSTKOWY — wariant **(C)** z `§0.2c`, `RUN_DB_TESTS=0 MOCK_DB=true`, ZERO Postgresa, ZERO migracji. Testy frontu z roota repo (`npx vitest run <ścieżka> --retry=0`), config domyślny (`vitest.config.ts`) — NIE dodajesz `--config server/vitest.config.ts` do niczego w tym dyżurze, bo nic nie dotyka `server/`. Każdy nowy/rozszerzony plik testowy montuje realną instancję `i18next` z realnym JSON-em obu słowników (import bezpośredni `public/locales/{pl,en}/translation.json`), NIGDY `vi.mock('react-i18next', ...)` (to zamaskowałoby dokładnie ten defekt, który mierzysz) — sprawdź na początku pliku, czy `tests/setup.ts` globalnie mockuje `react-i18next`, i jeśli tak, dodaj `vi.unmock('react-i18next')` (wzorzec z `GovernedChatHandoffCard.day179.i18n.test.tsx:11`). Pliki kładziesz w `src/components/AIChat/__tests__/` (KONWENCJA TEGO KATALOGU — 74 istniejące pliki testowe w `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` są już tak skolokowane, w tym dokładnie ten wzorzec dnia 179) — to NIE jest naruszenie ogólnej doktryny "nowe testy do `tests/`", to jest UDOKUMENTOWANY WYJĄTEK tego katalogu, patrz `R6` dla konsekwencji w `reachability-from-root.mjs` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day372-i18n-czat-artefakty/day372-i18n-czat.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day372-i18n-czat/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day372-pg psql -U postgres -d cx372 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day372-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK.** (1) **`t(klucz, fallback)` z brakującym kluczem cicho pokazuje `fallback` — zero błędu, zero czerwieni w konsoli.** Jedyny sposób wykrycia to `fallbackLng:false` w realnej instancji `i18next` w teście (patrz `Z40`). (2) **`CanvasAIFloatingMenu.tsx` ma gotowe polskie etykiety w `QUICK_ACTIONS[].labelPl`/`TONE_OPTIONS[].labelPl`, a linia renderująca (`:313,329`) ich NIE UŻYWA jako fallbacku** — użyj `action.labelPl` jako wartości PL w słowniku (nie wymyślaj nowego tłumaczenia, ono już tam jest, tylko martwe). (3) **Klucz istnieje ≠ przetłumaczony** — `canvas.versionHistory.*` audyt zgłosił jako brakujące, a na markerze jest kompletne i poprawne w obu słownikach; zmierz WARTOŚĆ przed uznaniem czegokolwiek za defekt. (4) **`BlockHeader` w `CanvasArtifactBlockRenderer.tsx` jest wołany 6×** (linie 231/340/344/361/400/434/566/688) — naprawiasz JEDNĄ funkcję (`:808-844`), nie sześć miejsc wywołania. (5) **`datasetArtifactActions` (`WorkCanvasDocumentPanel.tsx:461-490`) jest renderowany DWA RAZY na ekranie naraz** (`A2` D-2, duplikat panelu "Dataset ready") — naprawiasz jedno źródło danych, obie renderowane kopie dostają tłumaczenie za darmo; nie traktuj duplikatu jako dwóch osobnych pozycji. (6) **Panel "workflow ledger" jest za `isCanvasDevDiagnosticsEnabled()`, default OFF, diagnostyka deweloperska** — nie feature produktowy widoczny klientowi; zostawiasz PO ANGIELSKU i pytasz właściciela, nie tłumaczysz na spekulację**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day372-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day372-i18n-czat-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — skan mechaniczny obu klas defektu w 30-plikowej rodzinie, produkuje mianownik PRZED — bez zmian kodu) · R2 (klasa b — literały BEZ ŻADNEGO `t()`: `canvasActionAvailability.ts` 14 + pending-operation 3 + `datasetArtifactActions` 7 + `CanvasArtifactBlockRenderer.tsx` 17 + `ToolsMenu.tsx` 1 „Reset” = 42 — RDZEŃ) · R3 (klasa a — `CanvasAIFloatingMenu.tsx`, 13 kluczy `quickAction`/`tone`, użyj `labelPl` już obecnego w tablicy źródłowej — RDZEŃ) · R4 (klasa a — `UnifiedChatPanel.tsx`/`ChatHistorySidebar.tsx`/`ConversationActions.tsx`/`MoveToProjectModal.tsx`/`SystemHealth.tsx`, PEŁNY sweep = 58 kluczy zmierzonych w R1 (14 już zidentyfikowane imiennie, 44 z mechanicznego skanu) + 1 `window.confirm` na sztywno — RDZEŃ) · R5 (klasa a — pełny sweep `MessageRenderer.tsx` + 9 kart z realnymi trafieniami (z 19 sprawdzonych), 136 kluczy zmierzone w R1 — RDZEŃ, największa pozycja) · R6 (bezpiecznik etykiet: sprawdzić zakres i rozszerzyć jeśli nie obejmuje; `reachability.baseline.json` — dopisać własne nowe pliki testowe; warunki wspólne serii PO; raport; rejestr znalezisk; pytania do właściciela o panel workflow ledger)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6443` albo `5583` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6443` albo `5583`** (`Z7`).

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

Audyt ekranu „Czat AI” z 05.09 (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`)
znalazł 449 przycisków/elementów na siedmiu powierzchniach ekranu i policzył jedną rodzinę
defektów P2 zbiorczo: **„Angielski w polskim UI (największa rodzina, ~40 miejsc)”.** To był
szacunek jednej powierzchni (paska kanwy), napisany w jednym zdaniu zbiorczym. Trzy z siedmiu
plików audytu (`A1`, `E`) przyznają wprost, że pełny sweep jest **„poza zakresem czasowym tego
przebiegu — wymaga osobnego sweep”.** Ten dyżur JEST tym sweep, zmierzonym mechanicznie, nie
oszacowanym.

**Wynik mojego pomiaru na markerze: nie ~40, tylko co najmniej 250 miejsc**, w dwóch klasach:

- **Klasa (b) — literał BEZ ŻADNEGO wywołania `t()`.** Etykieta jest zwykłym stringiem JS
  użytym wprost jako `aria-label`/`title`/tekst przycisku. Zero szans na tłumaczenie, bo kod
  nigdy nie pyta słownika. **42 miejsca** w pasku kanwy/blokach datasetu/`ToolsMenu.tsx` +
  **1** `window.confirm` na sztywno w `ChatHistorySidebar.tsx` = **43**.
- **Klasa (a) — `t(klucz, fallback)` z kluczem, którego wartość PL NIE ISTNIEJE w słowniku.**
  Kod pyta słownik, słownik milczy po polsku, użytkownik dostaje angielski `fallback` — **cicho,
  bez błędu**. **13** kluczy w menu AI edytora + **58** kluczy w
  `UnifiedChatPanel.tsx`/`ChatHistorySidebar.tsx`/`ConversationActions.tsx`/
  `MoveToProjectModal.tsx`/`SystemHealth.tsx` (14 z nich zweryfikowane przeze mnie imiennie,
  reszta z mechanicznego skanu) + **136** kluczy w `MessageRenderer.tsx` i 9 innych
  komponentach-kartach (z 19 sprawdzonych — pozostałe 9 mają zero trafień tej klasy).
  **RAZEM klasa (a): 13+58+136 = 207.**

**★ Korekta wobec audytu, zmierzona przeze mnie:** `A2` D-6 zgłosił jako brakujące
`canvas.versionHistory.confirmRestore/confirmYes/cancel`. Na markerze tej instrukcji **wszystkie
pięć kluczy tej rodziny są kompletne i poprawnie polskie w obu słownikach** — ktoś to już naprawił
równolegle, a rejestr audytu tego nie odnotował. To jest dokładnie ósmy znany kształt fałszywego
„gotowe” w tym programie w odwrotną stronę: **klucz nieobecny w rejestrze ≠ defekt nadal
istniejący.** Nie dotykasz tej rodziny.

**★ Druga korekta:** `C_naglowek_historia.md` D-3 nazwał jedną pod-rodzinę (nagłówek/historia)
„7 kluczy”. Mój pomiar komendami (7)-(8) w `§0.3` (imiennie zweryfikowane) daje **13** — a pełny
mechaniczny skan tych samych PIĘCIU plików (komenda 8b) daje **58**, bo audytor patrzył tylko na
punkty własnej listy, nie na wszystkie wywołania `t()` w tych plikach. Podaję obie liczby z
komendami, jak każe `Z24` — mianownik dyżuru to **58**, nie 7 ani 13.

**★ Trzecia korekta — metodologia:** licznik NIE jest „klucz nieobecny w PL LUB EN” (to dałoby
zawyżoną liczbę, bo część kluczy ma poprawną wartość PL, a brakuje jej dopiero w EN — to inny,
niższego priorytetu defekt parytetu słowników, nie „angielski w polskim UI”). Licznik tej rodziny
to WYŁĄCZNIE „wartość PL nieobecna” — to jest jedyna definicja zgodna z nazwą dyżuru.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| klasa (b) — pasek kanwy + bloki datasetu + `ToolsMenu` | **42** literałów bez `t()` | `canvasActionAvailability.ts:27-47` (14), `WorkCanvasDocumentPanel.tsx` pending-op `:5158/5166/5173` (3) + dataset `:461-490` (7), `CanvasArtifactBlockRenderer.tsx` `EvidenceList`/aria-label/`BlockHeader` `:240,310,379-500,808-844` (17), `ToolsMenu.tsx:625` „Reset” (1) |
| klasa (b) — `window.confirm` na sztywno | **1** | `ChatHistorySidebar.tsx:641` |
| klasa (a) — `CanvasAIFloatingMenu.tsx` | **13** kluczy (`quickAction`×11, `tone`×2) | `:313,329`; **`labelPl` już istnieje w tablicy źródłowej i jest ignorowane** |
| klasa (a) — nagłówek/historia/SystemHealth, PEŁNY mianownik | **58** kluczy (14 imiennie + 44 ze skanu; audyt mówił „7”) | `UnifiedChatPanel.tsx` 36, `ChatHistorySidebar.tsx` 7, `ConversationActions.tsx` 5, `MoveToProjectModal.tsx` 7, `SystemHealth.tsx` 3 — skan `§0.3` komenda (8b) |
| klasa (a) — `MessageRenderer.tsx` + 9 kart (z 19 sprawdzonych) | **136** kluczy | skan `§0.3` komenda (11); filtr = wyłącznie `pl` brakujące |
| korekta — `canvas.versionHistory.*` | **JUŻ NAPRAWIONE** | audyt `A2` D-6 nieaktualny — 5/5 kluczy kompletne i polskie |
| bezpiecznik etykiet | **NIE OBEJMUJE** `AIChat`/`canvas` | `check-etykiety-dwujezyczne.mjs:51`, domyślny zakres = `DiscoveryTools`+`toolPacks` |
| `reachability-from-root.mjs --check-baseline` | **exit 1, PRZED tym dyżurem** | 3 nowe pliki test-only, NIEZWIĄZANE z rodziną AIChat/canvas — patrz `R6` |
| liście słowników | **pl 35204, en 33071** | komenda (12) |

**RAZEM (mianownik wstępny, do potwierdzenia w `R1`): 42+1+13+58+136 = 250 miejsc.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **42** literałów klasy (b) w pasku kanwy/blokach datasetu/`ToolsMenu`;
**1** `window.confirm` na sztywno; **13** kluczy klasy (a) w `CanvasAIFloatingMenu.tsx` (z gotowym,
niewykorzystanym `labelPl`); **58** kluczy klasy (a) w nagłówku/historii/SystemHealth — PEŁNY
mianownik ze skanu, nie 7 i nie tylko 13 imiennie sprawdzone; **136** kluczy klasy (a) w
`MessageRenderer.tsx` + 9 kartach; `canvas.versionHistory.*` **JUŻ naprawione** (nie dotykasz);
bezpiecznik etykiet **nie obejmuje** tej rodziny; `reachability` **czerwony PRZED** Twoją zmianą
z powodu trzech cudzych plików; liście słowników **pl 35204 / en 33071**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost w „Korektach wobec instrukcji”.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · SŁOWNIK · TEST · BEZPIECZNIK

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief
z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Słownik PL** | `public/locales/pl/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE nowych kluczy** wymienionych w `R2`-`R5`, wartość musi być polska, nie kopią EN (chyba że nazwa własna/skrót — uzasadnij). Zakaz zmiany istniejących wartości poza sekcjami dodawanymi | — |
| **Słownik EN** | `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE tych samych kluczy**, wartość = literał angielski już obecny w kodzie jako fallback. Zakaz zmiany istniejących wartości | — |
| **Klasa (b) — pasek kanwy** | `src/utils/canvas/canvasActionAvailability.ts` | **★ WĄSKA LICENCJA:** zamiana 14 literałów `actionLabels` na `t('canvas.actions.<id>', '<oryginalny literał EN>')`. Zakaz zmiany `actionGroups`, `availability()`, sygnatur eksportowanych | Brief |
| **Klasa (b) — panel kanwy** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE `R2`:** zamiana 3 literałów pending-operation (`:5158,5166,5173`) i 7 etykiet `datasetArtifactActions` (`:461-490`) na `t(klucz, literał)`. **Zakaz** dotykania handlerów, warunków renderu, `outputTargets`, logiki draftów, save/share/proposals | Brief |
| **Klasa (b) — bloki artefaktów** | `src/components/AIChat/CanvasArtifactBlockRenderer.tsx` | **★ WĄSKA LICENCJA:** 12 `title="..."` w `EvidenceList` (`:379-383,413-416,498-500`), 2 `aria-label={\`...\`}` (`:240,310` — zachowaj interpolację zmiennej), `BlockHeader` (`:808-844`, 3 literały: „block”, „Copy”, „CSV”). Zakaz zmiany `onCopy`/`onExport`/logiki eksportu CSV | Brief |
| **Klasa (b) — narzędzia** | `src/components/AIChat/ToolsMenu.tsx` | **★ WĄSKA LICENCJA:** linia 625, `>Reset<` → `{t('common.reset', 'Reset')}`. Zakaz zmiany handlera `onClick` (reset stanu) | Brief |
| **Klasa (a) — menu AI edytora** | `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` | **★ WĄSKA LICENCJA:** dodanie 13 kluczy do obu słowników z wartością PL = `action.labelPl`/`option.labelPl` JUŻ obecne w `QUICK_ACTIONS`/`TONE_OPTIONS` (`:41-144`). **Zakaz** zmiany `prompt`, `id`, kolejności tablic, logiki `onAIRequest` | Brief |
| **Klasa (a) — nagłówek/historia** | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/components/AIChat/ChatHistorySidebar.tsx`, `src/components/AIChat/ConversationActions.tsx`, `src/components/AIChat/MoveToProjectModal.tsx` | **★ WĄSKA LICENCJA:** dodanie WSZYSTKICH 58 kluczy zmierzonych w `R1`/`R4` (14 zidentyfikowanych imiennie, reszta ze skanu) + zamiana `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)` (`ChatHistorySidebar.tsx:641`) na `window.confirm(t('aiChat.confirmDeleteBulk', ...))`. **Zakaz** zmiany logiki usuwania/przenoszenia/RODO-zgody | Brief |
| **Klasa (a) — SystemHealth** | `src/components/SystemHealth.tsx` | **★ WĄSKA LICENCJA:** linia 191, dodanie klucza `system.dataAccess`. Zakaz zmiany reszty komponentu | Brief |
| **Klasa (a) — MessageRenderer + karty** | `src/components/AIChat/MessageRenderer.tsx`, `ArtifactBadge.tsx`, `ArtifactChip.tsx`, `CaseIntakeConfirmCard.tsx`, `ChatTableProposalCard.tsx`, `CitationList.tsx`, `ExecutionProposalMessage.tsx`, `GovernedChatHandoffCard.tsx`, `GovernedInitiativeHandoffCard.tsx`, `InlineResponseFeedback.tsx`, `Messages/InlineThinkingStream.tsx`, `Messages/ReasoningTrace.tsx`, `ResearchProgress.tsx`, `SourcesStrip.tsx`, `StructuredOutputBlock.tsx`, `TeresaProposalCard.tsx`, `ToolStepList.tsx`, `TrustBadge.tsx`, `TrustPanel.tsx`, `ChatCodeBlock.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE dopisanie brakującego klucza do obu słowników** dla każdego `t(klucz, fallback)` znalezionego w `R1`. **Zakaz** zmiany JSX poza samym wywołaniem `t()` (klucz już istnieje w kodzie — nie trzeba go dopisywać w komponencie), zakaz zmiany propsów/handlerów/warunków renderu | Brief |
| **NIETYKALNE — `canvas.versionHistory.*`** | `src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` | **TYLKO ODCZYT.** Rodzina już naprawiona (patrz korekta wyżej) — dotknięcie tego pliku bez nowego dowodu defektu jest poza zakresem | Errata w raporcie, nie zmiana |
| **NIETYKALNE — workflow ledger** | `WorkCanvasDocumentPanel.tsx:4692-4906` | **TYLKO ODCZYT.** Za `isCanvasDevDiagnosticsEnabled()`, default OFF, diagnostyka deweloperska — pytanie do właściciela, nie decyzja wykonawcy | Pytanie w raporcie |
| **Nowe testy** | `src/components/AIChat/__tests__/*.i18n.test.tsx` (NOWE, konwencja katalogu — patrz `SCIEZKI`) | **★ PEŁNA LICENCJA.** Wzorzec: `GovernedChatHandoffCard.day179.i18n.test.tsx`. `git add -f` | — |
| **Bezpiecznik etykiet** | `scripts/dev/check-etykiety-dwujezyczne.mjs` | **★ WĄSKA LICENCJA, WYŁĄCZNIE `R6`:** rozszerzenie tablicy `roots` (linia 51) o `src/components/AIChat` i `src/utils/canvas`, **JEŻELI** pomiar `R6` pokaże, że dziś ich nie obejmuje (już zmierzone: nie obejmuje). Zakaz zmiany regexów `languageCondition`/`ternaryPattern` | Brief |
| **Baseline etykiet** | `scripts/dev/check-etykiety-dwujezyczne.baseline.json` | **★ WĄSKA LICENCJA:** podniesienie `minFiles`/`minTernaries` WYŁĄCZNIE w górę, o realnie zmierzoną różnicę, nigdy w dół | — |
| **Baseline osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA:** ręczne dopisanie WYŁĄCZNIE ścieżek własnych nowych plików testowych do `testOnlyFiles`. **Zakaz** użycia `--update-baseline` (odmawia przy jakimkolwiek wzroście — patrz `§0.3` komenda 13), zakaz usuwania istniejących wpisów, zakaz dotykania `files` (unreachable) | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY372_I18N_CZAT_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **`server/src/**`** | wszystko | **TYLKO ODCZYT — CAŁA WARSTWA.** Ten dyżur nie ma tras tył (patrz nagłówek) | Brief, jeśli okaże się potrzebne — to jest STOP merytoryczny dla tej pozycji |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `13_CHAT` | Rekomendacja w raporcie |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (musza URODNAC o dokladnie tyle, ile dodales)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35204, en 33071. PO: PRZED + (liczba kluczy faktycznie
#   dodanych w R2-R5, ta sama liczba w obu jezykach — słownik nie jest symetryczny
#   dzis, ale KAZDY nowy klucz tego dyzuru wchodzi do OBU rownoczesnie)

# (b) cztery bezpieczniki maja konczyc sie kodem 0 — Z WYJATKIEM reach, patrz (c)
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby PRZED: wszystkie 0. Jezeli PO Twojej zmiany ktorykolwiek sie
#   zaczerwieni — naprawiasz KODEM, nigdy progiem (Z35).

# (c) ★★ reachability — WYJATEK udokumentowany, nie zwykly bezpiecznik 0/0
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: exit 1, "New test-only files (3)" — pliki NIEZWIAZANE z
#   tym dyzurem (patrz Stan zastany). PO Twojej zmianie (dodanie wlasnych plikow
#   testowych do src/components/AIChat/__tests__/ + reczny wpis do
#   reachability.baseline.json, patrz R6): oczekiwany wynik to DALEJ exit 1,
#   z DOKLADNIE TYMI SAMYMI TRZEMA nazwami w komunikacie "New test-only files" —
#   Twoje wlasne nowe pliki NIE MAJA sie pojawic na tej liscie (bo je dopisales
#   do baseline). Jesli po Twojej zmianie lista ma 4+ pozycje zamiast 3 —
#   to JEST Twoja regresja tego bezpiecznika, napraw wpis w R6.

# (d) bezpiecznik etykiet — zakres, nie tylko kod wyjscia
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety-domyslny=$?"
node scripts/dev/check-etykiety-dwujezyczne.mjs --zakres=src/components/AIChat; echo "etykiety-aichat=$?"
#   moje liczby PRZED: domyslny=0 (bo AIChat poza zasiegiem, patrz Stan zastany),
#   etykiety-aichat zalezny od tego, ile ternary pattern (isPolish?'x':'y') jest
#   w AIChat — zmierz i zapisz. PO R6 (jesli rozszerzasz roots): domyslny MUSI
#   nadal konczyc sie 0 (zero nieuzasadnionych identycznych), bo teraz obejmuje
#   wiecej plikow.
```

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | literałów klasy (b), pasek kanwy + dataset + `ToolsMenu` | `42` | komenda (1)-(4) z `§0.3` | TAK — czyta kod źródłowy wprost |
| 2 | `window.confirm` na sztywno | `1` | komenda (8) | TAK |
| 3 | kluczy klasy (a), `CanvasAIFloatingMenu.tsx` | `13` | komenda (5)-(6) | TAK — i potwierdza `labelPl` już obecne |
| 4 | kluczy klasy (a), nagłówek/historia/SystemHealth, PEŁNY mianownik | `58` | komenda (8b), skrypt `skan-r4.py` w `§0.3` | TAK — **audyt mówił „7”, imienna weryfikacja daje 13-14, pełny skan wiąże na 58** |
| 5 | kluczy klasy (a), `MessageRenderer`+9 kart | `136` | komenda (11), skrypt `skan-r5.py` w `§0.3` | TAK — pełny sweep 19 plików, filtr = wyłącznie `pl` brakujące |
| 6 | rodzina `canvas.versionHistory.*` | `0` (już naprawione) | komenda (10) | TAK — **korekta wobec audytu** |
| 7 | zakres bezpiecznika etykiet | „nie obejmuje” | komenda (14) | TAK — `roots` w linii 51 + wywołanie w pre-commit |
| 8 | `reachability` PRZED | `exit 1`, 3 pliki | komenda (13) | TAK — pełny komunikat, nie tylko kod wyjścia |
| 9 | liście słowników PRZED | `pl 35204 / en 33071` | komenda (12) | TAK |
| 10 | RAZEM mianownik dyżuru | `250` | suma wierszy 1+2+3+4+5 = 42+1+13+58+136 | TAK — **potwierdź w `R1` własnym sumowaniem, nie przepisuj** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`public/locales/pl/translation.json` · `public/locales/en/translation.json` ·
`src/utils/canvas/canvasActionAvailability.ts` ·
`src/components/AIChat/WorkCanvasDocumentPanel.tsx` ·
`src/components/AIChat/CanvasArtifactBlockRenderer.tsx` ·
`src/components/AIChat/ToolsMenu.tsx` ·
`src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` ·
`src/components/AIChat/UnifiedChatPanel.tsx` ·
`src/components/AIChat/ChatHistorySidebar.tsx` ·
`src/components/AIChat/ConversationActions.tsx` ·
`src/components/AIChat/MoveToProjectModal.tsx` ·
`src/components/SystemHealth.tsx` ·
`src/components/AIChat/MessageRenderer.tsx` i komponenty-karty z trafieniami (do 9, wymienione w tabeli licencji i zmierzone w `R1`) ·
nowe pliki `src/components/AIChat/__tests__/day372-*.i18n.test.tsx` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY372_I18N_CZAT_REPORT.md` ·
`evidence/i18n-czat/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`scripts/dev/check-etykiety-dwujezyczne.mjs` (tylko jeśli `R6` potwierdzi brak zasięgu — już
potwierdzone, więc TAK) · `scripts/dev/check-etykiety-dwujezyczne.baseline.json` (tylko podniesienie
progów w górę) · `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (tylko dopisanie
własnych nowych plików testowych) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/src/**` (CAŁOŚĆ — brak tras tył) ·
`src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` (rodzina już naprawiona) ·
`WorkCanvasDocumentPanel.tsx` linie `4692-4906` (workflow ledger, dev-diagnostics) ·
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) ·
handlery `onClick`/`onCopy`/`onExport`/logika zapisu draftów/proposals/`Api.*` w KAŻDYM dotkniętym
pliku (zmieniasz WYŁĄCZNIE literał → `t()`) · kolejność/`id`/`prompt` w `QUICK_ACTIONS`/`TONE_OPTIONS`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day372-i18n-czat
git diff --name-only --cached | tee /private/tmp/cx-day372-i18n-czat-artefakty/staged.txt
bash -c "grep -iE '^server/src/|CanvasVersionHistory\.tsx|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE' /private/tmp/cx-day372-i18n-czat-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# osobno: zmiana w kazdym dotknietym pliku PRODUKTU ma dotyczyc TYLKO literalu/t(), nie logiki —
# przeglad reczny kazdego diffa < 20 linii per plik jest oczekiwany; diff > 20 linii w jednym
# pliku produktu = STOP i przeczytaj wlasny diff zanim scommitujesz
git diff --cached -- src/ | grep -c '^[+-]' 
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Test broni ZACHOWANIA prawdziwego resolvera i18next, nigdy tekstu źródła.**
`readFileSync` + `toContain` na pliku `.tsx`/`.ts` jest **zakazany** jako dowód. Wzorzec
obowiązkowy: prawdziwa instancja `i18next` z `fallbackLng:false` (klucz brakujący zwraca sam
klucz, nie fallback — to jedyny sposób odróżnić „przetłumaczone” od „fallback po angielsku”),
PLUS co najmniej jeden test renderujący realny komponent. Gotowy wzorzec w repo:
`src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx` — kopiujesz
KSZTAŁT (instancja + `t()` + render + `container.textContent`), nie wynik.

**(2) Wartość PL nie może być kopią wartości EN.** Klucz „dodany”, którego polska wartość to
przepisany angielski string, nie jest naprawą — jest tym samym defektem z ptaszkiem (`Z32`
analogicznie: dowód mutacyjny wymaga realnej różnicy). Wyjątek: nazwy własne i skróty techniczne
(„Teresa”, „CSV”, „KPI”) — piszesz uzasadnienie w raporcie, wzorem `justification()` w
`scripts/dev/i18n-pl-audyt.mjs`.

**(3) Zakaz rozszerzania zakresu poza 30-plikową rodzinę** z tabeli licencji. Mechaniczny skan
`R1` prawie na pewno znajdzie ten sam wzorzec (`t(klucz, fallback)` z brakującym kluczem) POZA
tymi plikami, w innych narzędziach niż Czat AI. To NIE jest Twoje do naprawy — zapisujesz
`plik:linia` do „CO NADAL WYMAGA OSOBNEGO ZLECENIA” i idziesz dalej.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: SKAN MECHANICZNY, MIANOWNIK PRZED (bez zmian kodu)

**To jest pomiar. Nie naprawiasz w tej pozycji.**

1. Uruchom **dosłownie** wszystkie 14 komend z `§0.3` na swoim worktree z markera. Zapisz każdy
   wynik do `evidence/i18n-czat/skan-przed.txt` (nowy plik, `git add -f`).
2. **Potwierdź lub obal moje sumowanie: 42+1+13+58+136 = 250.** Jeżeli Twoje liczby się różnią —
   to jest WYNIK, nie sprzeczność (`Z24`) — zapisz swoją tabelę mianowników od zera, z komendami.
3. **Sprawdź klasę (c)** z definicji tego dyżuru: klucz istnieje w OBU słownikach, ale wartość PL
   jest identyczna z EN i wygląda na angielską. Skrypt pomocniczy (nie nowy plik trwały — uruchom
   ad hoc):
   ```bash
   python3 -c "
   import json, re
   pl = json.load(open('public/locales/pl/translation.json'))
   en = json.load(open('public/locales/en/translation.json'))
   def flatten(d, prefix=''):
       for k, v in d.items():
           p = f'{prefix}.{k}' if prefix else k
           if isinstance(v, dict): yield from flatten(v, p)
           else: yield p, v
   plf = dict(flatten(pl))
   enf = dict(flatten(en))
   suspects = [(k, v) for k, v in plf.items() if k in enf and v == enf[k] and re.search('[a-zA-Z]', v) and not re.search('[ąćęłńóśźż]', v.lower()) and k.startswith(('canvas.', 'aiChat.', 'chat.', 'system.'))]
   print(len(suspects), 'podejrzanych (klucz w obu, wartosc identyczna, wyglada na angielska)')
   for k, v in suspects[:40]: print(k, '=', repr(v))
   "
   ```
   Zapisz wynik do `evidence/i18n-czat/klasa-c-podejrzani.txt`. Każdą pozycję orzekasz z osobna:
   uzasadniona (nazwa własna/skrót — wpisz dlaczego) albo REALNY DEFEKT (dopisz do mianownika
   swojej pozycji `R2`-`R5`, w zależności od pliku).
4. **Zapisz mianownik ostateczny PRZED** w `evidence/i18n-czat/mianownik-przed.json`:
   `{"klasa_b": N, "klasa_a": N, "klasa_c_defekt": N, "razem": N}`.

**Wymagany dowód:** `skan-przed.txt`, `klasa-c-podejrzani.txt`, `mianownik-przed.json`, wszystkie
w `evidence/i18n-czat/`. **Commit po `R1`.**

## R2 — KLASA (b): PASEK KANWY, BLOKI DATASETU, TOOLSMENU (rdzeń)

1. **`canvasActionAvailability.ts:27-47`** — zamień 14 wpisów `actionLabels` z literału na
   `t('canvas.actions.<id>', '<oryginalny literał>')` (np. `copy: t('canvas.actions.copy', 'Copy Markdown')`
   — **uwaga**: ten plik nie jest komponentem React, sprawdź czy `t` jest dostępne w tym module;
   jeżeli nie — funkcja `actionLabels` musi stać się funkcją przyjmującą `t` jako parametr, wołaną
   z komponentu, który go ma (`renderCommandButton` w `WorkCanvasDocumentPanel.tsx:3232`). **To
   jest jedyna dopuszczalna zmiana kształtu kodu w tej pozycji** — sygnatura funkcji, nie logika.
2. **`WorkCanvasDocumentPanel.tsx`** — 3 literały pending-operation (`:5158,5166,5173`) i 7 etykiet
   `datasetArtifactActions` (`:461-490`) → `t(klucz, literał)`. Pamiętaj: ten sam obiekt
   `datasetArtifactActions` renderuje się w DWÓCH miejscach (`:3767` i `:4264`, pułapka 5) —
   naprawiasz JEDNO źródło, oba miejsca dostają tłumaczenie automatycznie.
3. **`CanvasArtifactBlockRenderer.tsx`** — 12 `title="..."` w `EvidenceList` (`:379-383,413-416,
   498-500`), 2 `aria-label={\`...\`}` z interpolacją (`:240,310` — zachowaj `${block.title}`/
   `${entry.index + 1}` wewnątrz tłumaczonego stringa przez `t(klucz, fallback, {title: block.title})`
   ze wzorcem `{{title}}` w słowniku), `BlockHeader` (`:808-844`, 3 literały: „block”, „Copy”,
   „CSV” — funkcja wołana z 6 miejsc, naprawiasz raz, pułapka 4).
4. **`ToolsMenu.tsx:625`** — `>Reset<` → `{t('common.reset', 'Reset')}`.
5. **KROK 0 rodziny wewnątrz tej pozycji:** po zmianie uruchom
   `bash -c "grep -rn 'aria-label=\"[A-Z]\|title=\"[A-Z]' src/utils/canvas/ src/components/AIChat/WorkCanvasDocumentPanel.tsx src/components/AIChat/CanvasArtifactBlockRenderer.tsx"` —
   oczekiwany wynik: **0 trafień** poza `t(...)`-owanymi (regex może złapać fałszywe pozytywy w
   klasach CSS zaczynających się wielką literą — odsiej ręcznie i zapisz co odsiałeś).
6. **Test:** rozszerz/utwórz `src/components/AIChat/__tests__/day372-canvasToolbar.i18n.test.tsx` —
   instancja `i18next` z `lng:'pl'`, `fallbackLng:false`; pętla po wszystkich 14+3+7 kluczach
   `canvas.actions.*`/`canvas.panel.pendingOperation.*`/`canvas.panel.dataset.*` sprawdzająca
   `testI18n.t(klucz)` ≠ klucz; PLUS jeden render `WorkCanvasDocumentPanel` (albo najmniejszy
   wycinek, jeśli pełny montaż wymaga zbyt wielu propsów/mocków — opisz co zmockowałeś) z
   asercją, że `aria-label` przycisku „Utwórz prezentację” to POLSKI tekst, nie „Create
   presentation”. Osobny test/`describe` dla `CanvasArtifactBlockRenderer` (render bloku typu
   `research`, sprawdź `container.textContent` zawiera polskie nagłówki `EvidenceList`) i dla
   `ToolsMenu` (render, `screen.getByText` polskiego „Resetuj”/odpowiednika, NIE „Reset”).

**Wymagany dowód:** diff czterech plików produktu (42 literały klasy b) · wynik grep-u
„0 trafień” z pkt 5 · nowy plik testowy zielony · `git diff` par PRZED/PO tekstu (np. zrzut
`container.textContent` przed i po dla jednego bloku) pokazujący zniknięcie angielskiego
stringa. **Commit po `R2`.**

## R3 — KLASA (a): MENU AI EDYTORA — 13 KLUCZY Z JUŻ GOTOWYM `labelPl` (rdzeń)

1. Dla każdego z 11 `QUICK_ACTIONS` i 2 `TONE_OPTIONS` w `CanvasAIFloatingMenu.tsx:41-144` dodaj
   klucz `canvas.aiMenu.quickAction.<id>` / `canvas.aiMenu.tone.<id>` do obu słowników:
   **PL = `action.labelPl` skopiowane 1:1** (już poprawne, np. „Rozwiń”, „Skróć”, „Doszlifuj”),
   **EN = `action.labelEn`**.
2. **Nie zmieniaj linii renderującej** (`:313,329`, `t(klucz, action.labelEn)`) — fallback zostaje
   jako siatka bezpieczeństwa, klucz teraz istnieje i wygrywa.
3. **Zweryfikuj**, że żaden z 13 kluczy nie koliduje z istniejącą sekcją `canvas.aiMenu.*` (już są
   tam klucze jak `explain`, `condense`, `expand`, `askTeresa` — sprawdź, że Twoje nowe nie
   nadpisują istniejących: `python3 -c "import json; d=json.load(open('public/locales/pl/translation.json')); print(list(d.get('canvas',{}).get('aiMenu',{}).keys()))"`).

**Wymagany dowód:** diff dwóch słowników (13 nowych kluczy × 2 pliki) · test
`day372-canvasAiMenu.i18n.test.tsx`: pętla resolvera (13 kluczy, `fallbackLng:false`,
`expect(t(klucz)).toBe(action.labelPl)`) + render `CanvasAIFloatingMenu` z zaznaczonym tekstem,
otwarcie flyoutu „Akcje”/„Ton”, `container.textContent` zawiera „Rozwiń”/„Formalny” i NIE zawiera
„Expand”/„Formal”. **Commit po `R3`.**

## R4 — KLASA (a): NAGŁÓWEK, HISTORIA, SYSTEMHEALTH — PEŁNY SWEEP, 58 KLUCZY + 1 `window.confirm` (rdzeń)

1. **KROK 0 rodziny — nie ogranicz się do imiennie znanych.** Uruchom `evidence/i18n-czat/skan-r4.py`
   (zapisany w `R1`, wzorzec skryptu w `§0.3` komenda 8b), rozszerzony tak, by drukował
   `plik:linia:klucz:fallback` dla KAŻDEGO trafienia (nie tylko sumę), i zapisz pełną listę do
   `evidence/i18n-czat/header-historia-lista.txt`. **14 z 58 pozycji mam już zweryfikowane
   imiennie** (poniżej, z `plik:linia`) — reszta (44) wychodzi z tej listy:
   `aiChat.business` (`UnifiedChatPanel.tsx:6797`) · `aiChat.muteNow` (:6883) ·
   `aiChat.workPanel.title` (:7490) · `aiChat.workPanel.resizeDivider` (:7495) ·
   `aiChat.actions.export` (`ConversationActions.tsx:356`) · `aiChat.actions.purge` (:407) ·
   `aiChat.confirmDeleteDestructive` (:368) · `aiChat.confirmPurge` (:392) ·
   `aiChat.confirmDeleteFolder` (`ChatHistorySidebar.tsx:902`) ·
   `aiChat.confirmDeleteFolderWithConvs` (:899) · `aiChat.deleteFolderFailed` (:910) ·
   `aiChat.confirmMovePrivateToOrganization` (:943, też `MoveToProjectModal.tsx:153`) ·
   `aiChat.visibilityConsentRecorded` (:956, też `MoveToProjectModal.tsx:168`) ·
   `system.dataAccess` (`SystemHealth.tsx:191`).
2. Dodaj do obu słowników **wszystkie 58** klucze z listy z kroku 1 (wartość EN = fallback już
   w kodzie, wartość PL — Twoje tłumaczenie, naturalne, nie dosłowna kalka).
3. **`ChatHistorySidebar.tsx:641`** — `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)`
   → dodaj klucz `aiChat.confirmDeleteBulk` z interpolacją `{{count}}`
   (`t('aiChat.confirmDeleteBulk', 'Delete {{count}} conversation(s)?', {count: ids.length})`),
   wartość PL z poprawną polską odmianą liczebnika (i18next `_plural`/`_one` albo prosty zapis
   „Usunąć {{count}} rozmów(y)?” — wybierz kształt spójny z resztą pliku, sprawdź czy repo już
   ma wzorzec liczby mnogiej w `aiChat.*` i skopiuj go).
4. **Uwaga do `aiChat.newChat`** z audytu `C` D-2: klucz `aiChat.newChat` ma dziś fallback
   `'Nowy czat'` w kodzie, ale sama wartość klucza w słowniku to `'Nowa rozmowa'` (klucz wygrywa
   nad fallbackiem — użytkownik i tak widzi poprawny polski tekst). To NIE jest defekt widoczny
   dla użytkownika — **nie dotykaj**, zapisz w raporcie jako obserwację (fallback mylący dla
   przyszłego programisty, poza zakresem tego dyżuru — który naprawia to, co WIDAĆ, nie kod
   źródłowy jako taki).
5. **Kontrola mianownika:** po zakończeniu uruchom PONOWNIE `skan-r4.py` — oczekiwany wynik **0**.
   Częściowe wykonanie z jawną listą braków jest wynikiem pełnowartościowym (`§0.5`).

**Wymagany dowód:** `header-historia-lista.txt` (pełna, 58 wierszy na starcie) · diff pięciu plików
produktu + dwóch słowników (do 58 nowych par kluczy) · para „przed: `window.confirm` pokazuje
angielski tekst (zrzut/opis) / po: pokazuje polski” · test
`day372-headerHistorySystemHealth.i18n.test.tsx`: resolver w pętli po wszystkich 58 kluczach
(`fallbackLng:false`, `t(klucz) !== klucz`) + render `ChatHistorySidebar` (przycisk usuwania,
sprawdź wywołanie `window.confirm` przez `vi.spyOn(window, 'confirm')` i asercję na PRZEKAZANY
string, nie tylko że został wywołany) + render `SystemHealth` (rozwinięta pigułka „Dane”, nagłówek
po polsku) + wynik `skan-r4.py` PO (docelowo `0`). **Commit po `R4`.**

## R5 — KLASA (a): PEŁNY SWEEP `MessageRenderer.tsx` + KARTY — 136 KLUCZY (rdzeń, największa pozycja)

**To jest sweep, który audyt 05.09 nazwał wprost „poza zakresem czasowym”. Robisz go tutaj,
mechanicznie, plik po pliku.**

1. Uruchom `evidence/i18n-czat/skan-r5.py` (zapisany w `R1`, wzorzec skryptu w `§0.3` komenda 11)
   i zapisz **pełną** listę `plik:linia:klucz:fallback` do
   `evidence/i18n-czat/messagerenderer-karty-lista.txt` (rozszerz skrypt, by drukował każdą
   pozycję, nie tylko sumę — dodaj `print(f'{rel}:{line}\t{key}\t{fallback}')` w pętli). Zmierzone
   przeze mnie: **136**, w 10 z 19 plików (`MessageRenderer.tsx` 48, `TrustBadge.tsx` 19,
   `ExecutionProposalMessage.tsx` 18, `GovernedInitiativeHandoffCard.tsx` 17, `ResearchProgress.tsx`
   11, `CitationList.tsx` 9, `TeresaProposalCard.tsx` 8, `InlineResponseFeedback.tsx` 3,
   `ArtifactBadge.tsx` 2, `GovernedChatHandoffCard.tsx` 1); pozostałe 9 plików (`ArtifactChip`,
   `CaseIntakeConfirmCard`, `ChatTableProposalCard`, `Messages/InlineThinkingStream`,
   `Messages/ReasoningTrace`, `SourcesStrip`, `StructuredOutputBlock`, `ToolStepList`,
   `TrustPanel`, `ChatCodeBlock`) mają dziś **0** trafień tej klasy — zostają w licencji (KROK 0
   = cały plik sprawdzony, nie próbka), ale nie wymagają zmiany, chyba że Twój pomiar pokaże inaczej.
2. **Dla plików z co najmniej jednym trafieniem** (patrz lista wyżej): dodaj brakujące
   klucze do obu słowników. PL = tłumaczenie fallbacku EN, naturalne, spójne z resztą sekcji tego
   klucza w słowniku (sprawdź sąsiednie klucze tej samej gałęzi — np. `chat.report.*` już ma
   4 poprawne wpisy obok Twoich nowych w tej samej rodzinie, trzymaj ten sam rejestr językowy).
3. **Nie zmieniaj JSX.** Każdy `t(klucz, fallback)` w kodzie zostaje identyczny — dodajesz
   WYŁĄCZNIE brakujący `klucz` do słowników. Jeśli w trakcie pracy odkryjesz, że jakiś klucz jest
   używany z RÓŻNYMI fallbackami w różnych miejscach (kolizja nazw) — to jest STOP MERYTORYCZNY dla
   TEGO klucza: zapisz oba miejsca, zaproponuj rozdzielenie na dwa klucze jako diff nienałożony,
   idź dalej z resztą.
4. **Test — jeden plik per komponent, wzorcem `day179`:** dla KAŻDEGO z 10 plików z trafieniami: instancja
   `i18next` (`fallbackLng:false`) + pętla po wszystkich kluczach TEGO pliku znalezionych w kroku 1,
   asercja `t(klucz) !== klucz`; PLUS jeden render tego komponentu (z minimalnymi, opisanymi w
   komentarzu mockami propsów) sprawdzający, że renderowany `container.textContent`/konkretny
   `aria-label` nie zawiera ŻADNEGO z angielskich fallbacków tego pliku. Jeżeli komponent jest
   zbyt głęboko zagnieżdżony, by wyrenderować go w izolacji (np. wymaga kontekstu, którego nie ma
   w testowym drzewie) — dopuszczalne jest wywołanie samej funkcji/hooka zwracającego etykiety,
   **opisane w raporcie dlaczego pełny render nie był możliwy** (to jest dozwolony wyjątek z `R1`
   punkt 2 wzorca 366, nie automat).
5. **Kontrola mianownika:** po zakończeniu uruchom PONOWNIE `skan-r5.py`
   — oczekiwany wynik: **0** (klasa a zniknęła z tej rodziny). Jeżeli zostało N > 0 — albo
   dokończ, albo zatrzymaj się z listą pozostałych `plik:linia` i uczciwym „N z 136 zrobione,
   reszta opisana”. **Częściowe wykonanie tej pozycji z jawną listą braków JEST wynikiem
   pełnowartościowym** (`§0.5`), pod warunkiem że lista jest kompletna i żaden dodany klucz nie
   ma wartości-kopii EN.

**Wymagany dowód:** `messagerenderer-karty-lista.txt` (pełna, 136 wierszy na starcie) · diff
10 plików komponentów (0 linii logiki, tylko import słownika jeśli w ogóle) · diff dwóch
słowników (do 136 nowych par kluczy) · 10 (lub mniej, jeśli STOP częściowy) plików testowych,
każdy zielony · wynik skryptu PO (docelowo `0`) · lista pozostałych, jeśli STOP częściowy.
**Commit po `R5`** (dopuszczalne commity cząstkowe co kilka plików, każdy z działającymi testami
dla TYCH plików — nie jeden gigantyczny commit na końcu).

## R6 — BEZPIECZNIK ETYKIET, BASELINE OSIĄGALNOŚCI, WARUNKI KOŃCOWE, RAPORT

1. **Bezpiecznik etykiet.** Już zmierzone w `R1`/`§0.3` (14): domyślny zakres
   `check-etykiety-dwujezyczne.mjs` (`DiscoveryTools`+`toolPacks`) NIE obejmuje `AIChat`/`canvas`.
   Rozszerz `roots` (linia 51) o `path.join(repoRoot, 'src/components/AIChat')` i
   `path.join(repoRoot, 'src/utils/canvas')`. Uruchom bez argumentów i zmierz nowe
   `zbadane pliki=`/`ternary=` — jeżeli wzrosły ponad `baseline.minFiles`/`minTernaries`, PODNIEŚ
   te progi w `check-etykiety-dwujezyczne.baseline.json` do realnie zmierzonej wartości (nigdy w
   dół). Jeżeli `nieuzasadnione-identyczne` > 0 po rozszerzeniu (np. `CanvasArtifactSwitcher.tsx`
   ma bare-variable ternary `pl ? 'x' : 'y'`, który MOŻE nie pasować do dzisiejszego regexu —
   sprawdź komendą, nie zgaduj) — to jest osobny defekt do opisania, NIE naprawiasz kodu produktu
   w tej pozycji poza tym, co już zrobiłeś w `R2`-`R5`.
2. **Baseline osiągalności.** Policz swoje własne nowe pliki testowe (z `R2`-`R5`, ścieżka
   `src/components/AIChat/__tests__/day372-*.i18n.test.tsx`). Otwórz
   `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, dopisz RĘCZNIE (edytorem,
   nie przez `--update-baseline`, które odmówi — patrz `§0.3` komenda 13) każdą nową ścieżkę do
   tablicy `testOnlyFiles`. Uruchom `node scripts/dev/reachability-from-root.mjs --check-baseline`
   — oczekiwany wynik: DALEJ `exit 1`, z DOKŁADNIE tymi samymi 3 nazwami sprzed dyżuru w komunikacie
   (Twoje własne pliki mają zniknąć z listy „nowych”, bo są już w baseline). Jeżeli lista ma więcej
   niż 3 pozycje — brakuje wpisu, dopisz.
3. **Warunki wspólne serii, pomiar PO** — powtórz bloki (a)-(d) z sekcji „WARUNKI WSPÓLNE SERII”
   i wklej wynik obok PRZED.
4. **Raport** (`CODEX_DAY372_I18N_CZAT_REPORT.md`) zawiera: tabelę mianowników PRZED/PO (250 →
   docelowo 0, lub mniej z jawną listą braków) · listę wszystkich nowych kluczy per plik (link do
   `evidence/i18n-czat/`) · dowód mutacyjny dla co najmniej JEDNEGO przykładu z każdej z pozycji
   `R2`-`R5` (przed: `container.textContent` zawiera angielski string; po: nie zawiera) · sekcję
   „KOREKTY WOBEC AUDYTU” (canvas.versionHistory już naprawione; „7 kluczy” → 58 pełnego mianownika;
   „~40” → 250) · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”**.
5. ★★ **Osobna, obowiązkowa sekcja „CO NADAL WYMAGA OSOBNEGO ZLECENIA”:** każde wystąpienie tego
   samego wzorca (`t(klucz, fallback)` z brakującym kluczem, LUB literał bez `t()`) znalezione
   PRZEZ TWÓJ skan POZA 30-plikową rodziną tego dyżuru — z `plik:linia`, bez naprawy.
6. ★★ **Osobna, obowiązkowa sekcja „PYTANIA DO WŁAŚCICIELA”:** czy panel „workflow ledger”
   (`WorkCanvasDocumentPanel.tsx:4692-4906`, za `VITE_DEV_DIAGNOSTICS` OFF) ma być kiedykolwiek
   przetłumaczony, czy zostaje diagnostyką wyłącznie po angielsku na stałe — **tak/nie**. Sekcja
   nie może być pusta.
7. Zanim dopiszesz sekcję do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę komendą
   `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
   **tuż przed commitem** (mój pomiar przy pisaniu tej instrukcji: ostatnia = `AF`, więc wolna =
   `AG` — ale sprawdź sam, równolegle piszą inni autorzy paczki 367-373).

**Wymagany dowód:** diff `check-etykiety-dwujezyczne.mjs` + `.baseline.json` z uzasadnieniem liczb ·
diff `reachability.baseline.json` (tylko dodane linie) + wynik `--check-baseline` PO ·
warunki wspólne PRZED/PO obok siebie · raport kompletny wg listy wyżej. **Commit po `R6`.**

## Próg odbioru

**Mianownik 250 (lub Twój zmierzony) potwierdzony w `R1` z odtwarzalnym skanem; klasa (b) (43
miejsca: pasek kanwy + `ToolsMenu` + `window.confirm`) i klasa (a) menu AI (13 kluczy) naprawione
w 100%, z testem renderującym prawdziwy komponent w `pl` i dowodem mutacyjnym przed/po; klasa (a)
nagłówka/historii/SystemHealth (58 kluczy, `R4`) i sweep `MessageRenderer`+karty (136, `R5`)
wykonane w całości ALBO zatrzymane z jawną, kompletną listą braków; zero nowego klucza z wartością
PL identyczną z EN bez uzasadnienia; bezpiecznik etykiet objął `AIChat`/`canvas` LUB zmierzone
i opisane dlaczego nie; `reachability` nie pogorszony ponad pre-istniejące 3 pozycje; liście
słowników wzrosły dokładnie o liczbę faktycznie dodanych kluczy, symetrycznie w obu językach.**

Odbiorca odrzuci dyżur, w którym: jakikolwiek nowy test czyta plik źródłowy przez `readFileSync`
zamiast wywołać resolver/renderować komponent; którakolwiek nowa wartość PL jest kopią EN bez
uzasadnienia; naprawiono próbkę zamiast całej zmierzonej rodziny bez jawnego STOP-u i listy braków;
zmieniono logikę handlera/warunku poza samą zamianą literału na `t()`; dotknięto
`canvas.versionHistory.*` mimo że była już naprawiona; `reachability`/`check-etykiety` pogorszone
bez odnotowania.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „klasa (b) i mniejsza klasa (a)
naprawione w 100% z testami; `MessageRenderer`+karty zrobione dla 6 z 10 plików z trafieniami
(98 z 136 kluczy), reszta opisana z `plik:linia`” — **jest pełnowartościowym wynikiem**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na starym markerze. Wynik ponownego sprawdzenia wklejasz do raportu
z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nowy tekst widoczny dla użytkownika = flaga OFF” (`Z11`) vs „napraw i18n bez flagi” | `POZYCJE_Z_FLAGAMI`: to jest naprawa potwierdzonego defektu (angielski tam, gdzie miał być polski), nie nowy element wizualny — `Z11` dotyczy NOWYCH ekranów/komponentów, nie poprawki tekstu istniejącego |
| „Dodaj klucz do słownika” vs „nie zmieniaj wartości istniejących” | Tabela licencji: WYŁĄCZNIE dopisywanie nowych kluczy; istniejące klucze (np. `aiChat.newChat`, `canvas.versionHistory.*`) zostają nietknięte |
| „Nowe testy do `tests/`” (doktryna ogólna) vs „kładziesz w `src/components/AIChat/__tests__/`” | `SCIEZKI`: udokumentowany wyjątek TEGO katalogu — 74 istniejące pliki już tam są, w tym dokładnie ten wzorzec (`day179`); potwierdzone w `reachability.baseline.json` |
| „`reachability` ma kończyć się 0” (ogólna zasada) vs „PRZED tym dyżurem już jest 1” | Warunki wspólne serii, blok (c): wyjątek udokumentowany — mierzysz NIE POGORSZENIE (te same 3 nazwy PRZED i PO), nie zero |
| „Napraw całą rodzinę 136 kluczy (`R5`) / 58 kluczy (`R4`)” vs „realistyczny czas jednego dyżuru” | `R4` punkt 5 i `R5` punkt 5: dopuszczalne zatrzymanie częściowe z jawną, kompletną listą braków — to jest wynik, nie porażka |
| „`labelPl` już istnieje, użyj go” vs „nie zmieniaj logiki” | `R3`: kopiujesz WARTOŚĆ `labelPl` do słownika, nie zmieniasz kodu, który go definiuje ani linii renderującej |
| „Popraw `window.confirm`” vs „nie zmieniaj logiki usuwania” | `R4` punkt 2: zmieniasz WYŁĄCZNIE argument `window.confirm` (tekst), nie warunek/efekt po potwierdzeniu |
| „Przetłumacz kebab kanwy w całości” (sugestia audytu) vs „workflow ledger to diagnostyka dev” | Tabela licencji + `R6`: workflow ledger NIETYKALNE, pytanie do właściciela zamiast tłumaczenia na spekulację |
| „Rozszerz zasięg bezpiecznika etykiet” vs „bezpiecznik nietykalny (`Z12`/`Z18`)” | Tabela licencji: WĄSKA licencja na dopisanie do `roots`, jawnie przyznana w `R6`, bo to inny plik niż `Z18`-owe `tests/setup.ts`/`vitest.config.ts` |
| „`--update-baseline` naprawi reachability” vs „skrypt odmawia przy wzroście” | `R6` punkt 2 + `§0.3` komenda 13: ręczna edycja JSON, nie automat |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkich 10 plików produktu (4 w `R2`, 1 w `R3`, 5 w `R4`) + 19 sprawdzonych w `R5` (10 z trafieniami), `GovernedChatHandoffCard.day179.i18n.test.tsx` (wzorzec, istnieje), `reachability.baseline.json`, `check-etykiety-dwujezyczne.mjs`+`.baseline.json` sprawdzone bezpośrednio; nowe pliki (`evidence/i18n-czat/**`, `src/components/AIChat/__tests__/day372-*.i18n.test.tsx`, raport) jawnie oznaczone jako NOWE |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy, wszystkie 14 komend `§0.3` uruchomione osobiście na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — słownik PL/EN · 5 grup plików klasy (b)/(a) · testy · bezpiecznik etykiet + baseline · baseline osiągalności · rejestr · raport · infrastruktura testów (odczyt) · `server/src/**` (odczyt, brak tras tył) · macierz (odczyt) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` tylko mierzy, `R2`-`R4` dotykają wyłącznie własnych plików, `R5` mechaniczny (dodawanie kluczy, zero logiki), `R6` administracyjny |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6443/5583 wolne (`lsof` przy wydaniu), zero kontenera `cx-day372-*`, zero gałęzi/worktree; rodzeństwo 367-371/373 ma rozłączne porty i tematy (inne moduły) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, w tym skrypt Pythona zapisany do pliku tymczasowego |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: `t()` cichy fallback, `labelPl` martwy, klucz-istnieje-nie-znaczy-przetłumaczony, `BlockHeader` 6×, dataset-actions 2×, workflow ledger dev-only |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |

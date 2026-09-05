# INSTRUKCJA DYŻURU nr 367 — Codex — „★★ KEBAB KANWY OBIECUJE AI, SERWER ROBI STRING-REPLACE (K1) + MENU PŁYWAJĄCE MILCZY PRZY BŁĘDZIE (K7). **(K1)** W kebabie `⋮` panelu kanwy (`WorkCanvasDocumentPanel.tsx`) etykiety „Rozwiń myśl/Skróć/Przeredaguj/Zaproponuj” i „Dodaj element” (6 typów + pole opisu) obiecują, że Teresa napisze treść — realnie `applySelectionMenuAction` (:2407-2420) wkleja gotowy szablon zdania do pola, `previewSelectionEdit` (:2531-2584) wysyła ten dosłowny tekst jako `replacementMd` do `POST /api/work-canvas/drafts/:id/operations`, a serwer (`work-canvas.routes.ts:1710-1763`, `applyEditOperation`) robi wyłącznie `contentMd.replace(selectedText, replacementMd)` — **zero importu serwisu AI w całym pliku**. `insertQuickAddElement`/`buildQuickAddMarkdown` (:2397-2404, :2378-2394) robią to samo dla „Dodaj element” — statyczny szkielet markdown. Prawdziwe AI istnieje w TYM SAMYM module: menu pływające edytora (`CanvasRichEditor.tsx handleAIRequest`, `POST /api/ai/chat/quick`) i `useCanvasAIStream.ts` (`canvas-stream-request`, dispatchowany WYŁĄCZNIE z `UnifiedChatPanel.tsx:4125` — kebab nigdy tego eventu nie odpala, zmierzone grepem). Zadanie: kebab ma wołać TEN SAM łańcuch AI co menu pływające — jedna funkcja żądania, dwa wejścia — z deterministycznym szablonem zachowanym WYŁĄCZNIE jako jawny fallback przy niedostępności dostawcy, z widocznym komunikatem że to fallback. **(K7)** `handleAIRequest` (`CanvasRichEditor.tsx:242-343`, gałąź `!response.ok` w linii 282-285 i `catch` w 337-340) i `handleAIExplain` (:349-388, gałęzie 375 i 381-385) zwracają cicho `null` przy błędzie (sieć, HTTP nie-2xx, limit 8000 znaków `ChatQuickRequestSchema.message.max(8000)` przekroczony po stronie serwera); wołający w `CanvasAIFloatingMenu.tsx` — `handleQuickAction` (:228-236, 10 pozycji „Akcje” + 2 „Ton” + Rozwiń/Skróć) i `handleCustomPrompt` (:252-256) — **ignorują wartość zwracaną** (`await onAIRequest(...)` bez `if`). Jedyny wyjątek to „Wyjaśnij” (`handleExplain` :242-250, render błędu :359-363) — to jest WZORZEC do naśladowania. ★ Wspólny mechanizm i18n dla komunikatu błędu **już istnieje i jest nieużywany tutaj**: `src/components/AIChat/aiProviderErrorCopy.ts` (`getAiErrorCopy`/`getAiErrorLine`), z kluczami `aiChat.providerError.*` już obecnymi w PL i EN, już używany przez `useCanvasAIStream.ts` — `CanvasRichEditor.tsx`/`CanvasAIFloatingMenu.tsx` go NIE importują (zmierzone grepem, zero trafień). Zadanie: podłączyć ten sam mechanizm do WSZYSTKICH akcji AI menu pływającego + dodać walidację długości po stronie klienta PRZED wysyłką (zwierciadło serwerowego limitu 8000 znaków dla pola `message`, które jest konkatenacją `prompt` + zaznaczonego tekstu)"

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
> **wyłącznie** `/private/tmp/cx-day367-kanwa-ai`.

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
Zakres: ****`13_CHAT`, panel kanwy dokumentu w Czacie** (`/chat` → `UnifiedChatPanel.tsx:7509` → `WorkCanvasDocumentPanel.tsx` → `CanvasRichEditor.tsx` gdy `mode==='rich'`). DWA defekty, oba w tej samej powierzchni: **K1 (rdzeń)** — kebab `⋮` obiecuje AI na czterech akcjach zaznaczenia i na „Dodaj element”, a realnie robi deterministyczną podmianę tekstu; naprawa ma podłączyć te pozycje do TEGO SAMEGO łańcucha AI co menu pływające edytora, z deterministycznym szablonem jako jawnym fallbackiem. **K7 (rdzeń)** — menu pływające edytora (poza „Wyjaśnij”) milczy przy błędzie AI; naprawa podłącza istniejący, gotowy mechanizm i18n błędu (`aiProviderErrorCopy.ts`, już używany przez `useCanvasAIStream.ts`, dziś nieużywany tutaj) i dodaje walidację długości po stronie klienta. Manualny, uczciwy panel „Edit selected text” (`data-testid="canvas-selection-edit-panel"`, przyciski `applySelectionEditShortcut`, pole „Write the replacement Markdown here”) współdzieli funkcję `previewSelectionEdit` z kebabem, ale NIE obiecuje AI (to świadomie manualne narzędzie) — MUSI zostać behawioralnie nietknięty. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, plik postępu `/private/tmp/cx-day367-postep.md` (POZA repo)**.
Trasy front: `★ Naprawa (K1): `src/components/AIChat/WorkCanvasDocumentPanel.tsx` — `applySelectionMenuAction` (:2407-2420), `previewSelectionMenuPrompt` (:2424-2435), `previewSelectionEdit` (:2531-2584, **współdzielona z manualnym panelem :3374 — patrz Z40**), `insertQuickAddElement` (:2397-2404), `buildQuickAddMarkdown` (:2378-2394). ★ Naprawa (K7): `src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` — `handleAIRequest` (:242-343), `handleAIExplain` (:349-388); `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` — `handleQuickAction` (:228-236), `handleCustomPrompt` (:252-256), wzorzec do naśladowania `handleExplain`+render błędu (:242-250, :359-363). ★ Wzorzec/zależność (TYLKO ODCZYT, chyba że `R1` udowodni inaczej): `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` (`streamToCanvas`, `onError`+`getAiErrorLine` :326-330,374-380,459-465 — gotowy przykład integracji), `src/components/AIChat/aiProviderErrorCopy.ts` (gotowy mechanizm, TYLKO ODCZYT — importujesz, nie przepisujesz). Dopisanie kluczy: `public/locales/{pl,en}/translation.json`. Reszta `src/**` — TYLKO ODCZYT`. Trasy tył: ``server/src/routes/ai.routes.ts` — **TYLKO ODCZYT**. Trasa `POST /api/ai/chat/quick` (montaż :6621, `ensureAiProviderAndAccess` :414-462) już istnieje, już działa (dowód: `B_edytor.md`, curl 401), i to jest trasa, którą kebab ma zacząć wołać — nie tworzysz nowej. `server/src/validators/ai.validators.ts` — TYLKO ODCZYT, `ChatQuickRequestSchema.message.max(8000)` w linii 567 to kontrakt, który klient musi zwierciadlić. `server/src/routes/work-canvas.routes.ts` — **WARUNKOWO**, TYLKO jeśli `R1` udowodni, że fallback deterministyczny wymaga zmiany kontraktu `applyEditOperation` (:1710-1763); domyślnie ZOSTAJE bez zmian (AI dzieje się po stronie klienta, dokładnie jak dziś robi to `CanvasRichEditor.tsx`, zanim operacja trafi do serwera)`.

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
WT=/private/tmp/cx-day367-kanwa-ai
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
git -C "$VAULT" worktree add "$WT" -b codex/day367-kanwa-ai-20260905 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day367-kanwa-ai/config.worktree"
cat "$VAULT/worktrees/cx-day367-kanwa-ai/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day367-kanwa-ai-scratch
mkdir -p /private/tmp/cx-day367-kanwa-ai-artefakty

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
git -C "$WT" push github-backup codex/day367-kanwa-ai-20260905
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

# (1) ★★★ TEZA K1a: kebab "AI on selection" — applySelectionMenuAction wkleja SZABLON, nie wola AI
sed -n '2407,2436p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
#   moje liczby: funkcja buduje `prefix` (stala tresc PL/EN wg akcji) + zaznaczony tekst,
#   `setSelectionAiPrompt(...)` — ZERO fetch/HTTP. `previewSelectionMenuPrompt` tylko kopiuje
#   ten napis do `selectionEditDraft` i wola `previewSelectionEdit()`.

# (2) ★★★ TEZA K1b: previewSelectionEdit wysyla DOSLOWNY tekst jako replacementMd
sed -n '2531,2545p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
bash -c "grep -n 'previewSelectionEdit\|previewSelectionMenuPrompt\|applySelectionMenuAction' src/components/AIChat/WorkCanvasDocumentPanel.tsx"
#   moje liczby: applySelectionMenuAction wolane z 6 miejsc (:3826,:3839,:3997,:4004,:4011,:4018);
#   previewSelectionMenuPrompt z 1 miejsca (:4038, kebab "Podglad zmiany AI");
#   previewSelectionEdit ma DRUGIE, NIEZALEZNE wejscie z :3374 (manualny panel, patrz teza 6).

# (3) ★★★ TEZA K1c: serwer applyEditOperation — ZERO importu AI w calym pliku
sed -n '1710,1763p' server/src/routes/work-canvas.routes.ts
bash -c "grep -n 'aiService\|llmService\|openai\|anthropic\|modelRouter' server/src/routes/work-canvas.routes.ts"
#   moje liczby: 0 trafien w calym pliku (3900+ linii) — string-replace/konkatenacja, zero AI.

# (4) ★★★ TEZA K1d: Dodaj element — buildQuickAddMarkdown to statyczny szablon markdown
sed -n '2378,2404p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
#   moje liczby: 6 galezi switch (heading/table/diagram/list/summary/text), kazda wstawia
#   staly markdown + `cleanedPrompt` dokladnie tam gdzie kod go umiesci — zero AI.

# (5) ★★★ TEZA K1e: prawdziwe AI istnieje W TYM SAMYM MODULE, kebab go nie uzywa
bash -c "grep -rn \"canvas-stream-request\" src/ | grep -v __tests__"
#   moje liczby: 3 trafienia — 1 DISPATCH w UnifiedChatPanel.tsx:4125, 1 LISTENER w
#   WorkCanvasDocumentPanel.tsx:2374, 1 komentarz. Kebab (funkcje z tezy 1-4) nigdy nie
#   dispatchuje tego eventu — potwierdzone, zero polaczenia z prawdziwym AI.

# (6) ★★★ TEZA K1f: manualny, UCZCIWY panel wspoldzieli previewSelectionEdit — NIE dotykac
sed -n '3300,3390p' src/components/AIChat/WorkCanvasDocumentPanel.tsx
#   moje liczby: `data-testid=\"canvas-selection-edit-panel\"`, przyciski `applySelectionEditShortcut`
#   (Use selection/Action list/Bullet summary — DETERMINISTYCZNE, ale etykieta NIE obiecuje AI),
#   textarea \"Write the replacement Markdown here...\", przycisk \"Preview edit\" na :3374
#   wola TA SAMA previewSelectionEdit() co kebab. To jest HONEST, nie D-1 — nie zmieniac zachowania.

# (7) ★★★ TEZA K7a: handleAIRequest/handleAIExplain milcza przy bledzie
sed -n '242,343p' src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx | sed -n '1,15p;95,102p'
bash -c "grep -n 'if (!response.ok)\|} catch {' src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx"
#   moje liczby: `if (!response.ok)` w liniach 282 i 375; `} catch {` w liniach 337 i 381.
#   Wszystkie cztery galezie: brak stanu bledu, brak komunikatu, funkcja zwraca `null` po cichu.

# (8) ★★★ TEZA K7b: wolajacy w CanvasAIFloatingMenu IGNORUJA zwracana wartosc
sed -n '228,257p' src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx
#   moje liczby: `handleQuickAction` (:228-236) i `handleCustomPrompt` (:252-256) robia
#   `await onAIRequest(...)` BEZ `if` na wyniku — 12 pozycji menu (Rozwin/Skroc/10x Akcje/2x Ton
#   + custom prompt) nie ma zadnej reakcji na `null`.

# (9) ★★★ TEZA K7c: WZORZEC do naslodowania juz istnieje w tym samym pliku — "Wyjasnij"
sed -n '242,250p;359,364p' src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx
#   moje liczby: `handleExplain` ustawia `explainState({status:'error'})` gdy `text` jest pusty,
#   render pokazuje `t('canvas.aiMenu.explainError', ...)` w czerwonym tekscie. To DZIALA.

# (10) ★★★ TEZA K7d: gotowy wspolny mechanizm i18n bledu JUZ ISTNIEJE, nieuzywany tutaj
bash -c "grep -rln 'aiProviderErrorCopy' src/"
bash -c "grep -n 'aiProviderErrorCopy\|getAiErrorLine' src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx"
bash -c "grep -c 'providerError' public/locales/pl/translation.json public/locales/en/translation.json"
#   moje liczby: 7 plikow importuje aiProviderErrorCopy (useCanvasAIStream.ts, teresaRuntimeCopy.ts,
#   test wlasny, AiProviderErrorNotice.tsx, UnifiedChatPanel.tsx, WorkCanvasDocumentPanel.tsx, api.ts)
#   — CanvasRichEditor.tsx i CanvasAIFloatingMenu.tsx: ZERO trafien. Klucze `providerError`
#   obecne w OBU slownikach (>=1 trafienie kazdy, dokladna sekcja `aiChat.providerError` na
#   pl:19528 i en:18281).

# (11) TEZA: limit dlugosci po stronie serwera, ktory front ma zwierciadlic
sed -n '563,576p' server/src/validators/ai.validators.ts
#   moje liczby: `message: z.string().min(1).max(8000, 'Message too long')`,
#   `context.selectedText` max 16000 — `message` w handleAIRequest to KONKATENACJA
#   `${prompt}\n\nText to modify:\n${effectiveText}` (CanvasRichEditor.tsx:271), wiec
#   walidacja klienta musi liczyc DLUGOSC TEJ KONKATENACJI, nie samego prompta.

# (12) TEZA: istniejacy w tym katalogu wzorzec testu-na-tekscie (NIE nasladowac)
bash -c "grep -c 'readFileSync' src/components/AIChat/__tests__/WorkCanvasDocumentPanel.ownerFeedback.test.ts"
#   moje liczby: 1 (caly plik to asercje na napisie zrodlowym) — istnieje w repo, ale NIE jest
#   wzorcem dla nowych testow tego dyzuru (Z40).

# (13) ★★ TEZA: reachability-from-root.mjs jest JUZ czerwony na markerze, niezwiazane z K1/K7
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby: reach=1, trzy pliki "New test-only": 
#   src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts,
#   src/components/assessment/drd/__tests__/macierz-sedno-20260905.test.tsx,
#   src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts — ZERO zwiazku z
#   Czatem/Kanwa. Pozostale trzy bramki: focus=0, list=0, artefakt=0.

# (14) TEZA: liscie slownikow i pierwsza wolna litera rejestru
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"
#   moje liczby: pl 35204, en 33071. Ostatnia litera rejestru: AF (linia 379) -> nastepna AG
#   (brief nadzorcy mowil \"AC\" — NIEAKTUALNE, sprawdz ponownie sam tuz przed commitem).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day367-kanwa-ai-20260905` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6438`. Twój JEDYNY port harnessu to `5578`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day367-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 3000, 3020-3030, 5432, 5433, 6379. Rodzeństwo TEJ paczki (367-373, ta sama powierzchnia „Czat AI”) ma WYŁĄCZNE, rozłączne przedziały — nie dotykasz: 368 (DB 6439/harness 5579), 369 (6440/5580), 370 (6441/5581), 371 (6442/5582), 372 (6443/5583), 373 (6444/5584). Twoje własne wyłącznie: baza 6438, harness 5578. Starsze rodzeństwo 04.09 (359-366) miało przedział 6410-6437/5550-5577 — również nie dotykasz. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`). ★ Zmierzone przy wydaniu: oba porty 6438/5578 wolne, zero kontenerów `cx-day36*`/`cx-day37*`, zero gałęzi `codex/day367-*` ani `codex/day36[8-9]*`/`codex/day37[0-3]*``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. To jest naprawa defektu potwierdzonego przez audyt i sceptyka (K1, K7), nie nowy wygląd — zgodnie z regułą serii „zmiana zachowania widocznego przez właściciela = flaga? NIE dla naprawy defektu potwierdzonego”. Nie dodajesz żadnej flagi `VITE_*`/`ENABLE_*` i nie zmieniasz wartości domyślnej żadnej istniejącej. Nowy element wizualny, jaki naprawa wprowadza (widoczny komunikat błędu AI, widoczny komunikat fallbacku), jest NAPRAWĄ ISTNIEJĄCEGO EKRANU (kebab i menu pływające już są na żywo, bez flagi), nie nowym ekranem — nie podlega więc procedurze „Piotr nigdy nie jest pierwszym testerem” (ta dotyczy NOWYCH ekranów). Jeśli w trakcie pracy uznasz, że zakres rośnie do czegoś, co wygląda jak nowy komponent UI (np. osobny banner globalny) — STOP merytoryczny i pytanie do właściciela, nie improwizacja`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/services/accessPolicyService.ts`, `server/src/routes/ai.routes.ts`. Wszystkie NIETYKALNE DO ZAPISU (wolno je wołać/czytać w pomiarze). ★ UWAGA: `public/locales/**` NIE jest tu wymienione — TEN dyżur ma pełną, wąską licencję na DOPISANIE kluczy (patrz tabela licencji), bo K7 wymaga nowych kluczy błędu/fallbacku. Liście nie mogą zmaleć, treść PL musi być polska`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY367_KANWA_AI_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — zmierzone przeze mnie przy wydaniu: ostatnia użyta to **AF** (`## AF. Dyżur 365 — przyrząd i dublet Relations`, linia 379), więc następna to **AG** — **★ literę sprawdzasz PONOWNIE komendą tuż przed commitem, bo równolegle piszą inni autorzy paczki 368-373** — oraz nowe pliki dowodowe pod `evidence/day367-kanwa-ai/` (katalog NIE ISTNIEJE na markerze — tworzysz). ★★★ MACIERZ ODBIORU (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`) JEST NIETYKALNA. Plik postępu `/private/tmp/cx-day367-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f` (choć ten dyżur licencjonuje testy głównie pod `src/**/__tests__/` — patrz tabela licencji i pułapka reachability). **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day367-kanwa-ai-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day367-kanwa-ai-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ZOSTAWIENIA DETERMINISTYCZNEJO SZABLONU JAKO JEDYNEJ ŚCIEŻKI POD ETYKIETĄ „AI”.** Po naprawie `R1`, gdy dostawca AI jest dostępny, użytkownik ma dostać treść WYGENEROWANĄ przez model (ten sam kontrakt co `handleAIRequest`), nie własną instrukcję odbitą z powrotem. Jeżeli mierzysz i wychodzi, że dziś nie da się tego zrobić bez zmiany kontraktu serwera — to jest STOP merytoryczny z briefem, nie cichy commit zostawiający status quo. ★★★ **ZAKAZ CICHEGO FALLBACKU.** Gdy dostawca AI jest niedostępny (503/403/sieć), deterministyczny szablon WOLNO wstawić, ale WYŁĄCZNIE z widocznym komunikatem że to fallback, nie odpowiedź modelu — cichy fallback jest tym samym defektem, tylko lepiej ukrytym. ★★★ **ZAKAZ ZEPSUCIA MANUALNEGO PANELU „Edit selected text”.** `previewSelectionEdit` jest współdzielona między kebabem (D-1, ma dostać AI) a uczciwym manualnym panelem `data-testid="canvas-selection-edit-panel"` (:3300-3390, przycisk „Preview edit” na WŁASNYM tekście użytkownika, NIE obiecuje AI). Zmiana, która wymusza wywołanie AI na manualnym panelu, jest regresją, nie naprawą — wymagany osobny dowód, że ten panel nadal robi dosłowną podmianę. ★★ **ZAKAZ „NAPRAWY” K7 PRZEZ WŁASNY, NOWY MECHANIZM BŁĘDU.** Istnieje gotowy `getAiErrorCopy`/`getAiErrorLine` (`aiProviderErrorCopy.ts`) z kompletem kluczy PL/EN, używany dziś przez `useCanvasAIStream.ts` — MASZ go podłączyć, NIE wolno pisać równoległego drugiego mechanizmu komunikatów błędu dla tej samej rodziny (dwa mechanizmy = dwa miejsca do utrzymania i pewność rozjazdu). ★★ **ZAKAZ TRAKTOWANIA `readFileSync`+`toContain` JAKO DOWODU** (patrz `WorkCanvasDocumentPanel.ownerFeedback.test.ts` w tym samym katalogu — to ISTNIEJĄCY wzorzec w kodzie, ale NIE jest wzorcem do naśladowania dla nowych testów tego dyżuru; nowy test wywołuje/renderuje i sprawdza wynik). ★ **ZAKAZ PRÓBY NAPRAWY BRAMKI `reachability-from-root.mjs`** poza zakresem tego dyżuru — jest ona już czerwona na markerze z powodu 3 plików niezwiązanych (patrz Stan zastany); Twoim obowiązkiem jest udokumentować DELTĘ PO NAZWACH spowodowaną Twoimi własnymi nowymi plikami testowymi, nie naprawiać cudzego stanu (`Z17`). ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`) | Bo oba defekty to ten sam wzorzec z innej strony: **etykieta obiecuje AI, kod cichnie albo kłamie**. K1 — użytkownik czyta „Podgląd zmiany AI” i dostaje z powrotem własne słowa, bo serwer robi string-replace; to jest gorsze niż brak funkcji, bo wygląda jak działanie. K7 — użytkownik klika „Rozwiń” na zbyt długim fragmencie, spinner znika i nic się nie dzieje; jedyny w tej rodzinie przycisk, który się nie psuje („Wyjaśnij”), dowodzi że naprawa jest tania — wzorzec i gotowy mechanizm i18n błędu już istnieją w repo, tylko nie są podłączone tam, gdzie potrzeba. Oba defekty zostały POTWIERDZONE przez niezależnego sceptyka (`V1_weryfikacja_P1.md`, punkty 1 i 2) na tym samym markerze |

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
cd /private/tmp/cx-day367-kanwa-ai

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day367-pg psql -U postgres -d cx367 \
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
cd /private/tmp/cx-day367-kanwa-ai

docker run -d --name cx-day367-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx367 \
  -p 127.0.0.1:6438:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day367-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6438/cx367 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6438/cx367 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day367-kanwa-ai && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6438/cx367 \
JWT_SECRET=cx367-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Wszystkie testy tego dyżuru są **jednostkowe/komponentowe (jsdom), zero Postgresa wymaganego dla rdzenia `R1`/`R2`** — naprawa jest po stronie klienta (fetch mockowany) i słowników i18n; serwer NIE jest modyfikowany w ścieżce domyślnej. Uruchamiasz z roota, wariant (C) `§0.2c`: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run <pliki> --retry=0 --reporter=json --outputFile=/private/tmp/cx-day367-kanwa-ai-artefakty/<etykieta>.json`. Jeśli (i tylko jeśli) zdecydujesz się DODATKOWO o realny dowód HTTP przez `ApiGateway` (nie jest to warunkiem `R1`/`R2`, ale wolno) — wtedy pełny wariant (A)+(B) `§0.2c` z kontenerem na porcie 6438, bazą `cx367`. Pakiety: `src/components/AIChat/CanvasEditor/__tests__/*.test.tsx` (nowe/istniejące), `src/components/AIChat/__tests__/*.test.ts(x)` (nowe/istniejące) — oba katalogi używają domyślnego `vitest.config.ts` z roota, BEZ `--config server/vitest.config.ts` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day367-kanwa-ai-artefakty/day367-kanwa-ai.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day367-kanwa-ai && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Wszystkie testy tego dyżuru są **jednostkowe/komponentowe (jsdom), zero Postgresa wymaganego dla rdzenia `R1`/`R2`** — naprawa jest po stronie klienta (fetch mockowany) i słowników i18n; serwer NIE jest modyfikowany w ścieżce domyślnej. Uruchamiasz z roota, wariant (C) `§0.2c`: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run <pliki> --retry=0 --reporter=json --outputFile=/private/tmp/cx-day367-kanwa-ai-artefakty/<etykieta>.json`. Jeśli (i tylko jeśli) zdecydujesz się DODATKOWO o realny dowód HTTP przez `ApiGateway` (nie jest to warunkiem `R1`/`R2`, ale wolno) — wtedy pełny wariant (A)+(B) `§0.2c` z kontenerem na porcie 6438, bazą `cx367`. Pakiety: `src/components/AIChat/CanvasEditor/__tests__/*.test.tsx` (nowe/istniejące), `src/components/AIChat/__tests__/*.test.ts(x)` (nowe/istniejące) — oba katalogi używają domyślnego `vitest.config.ts` z roota, BEZ `--config server/vitest.config.ts` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day367-kanwa-ai-artefakty/day367-kanwa-ai.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day367-kanwa-ai/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day367-pg psql -U postgres -d cx367 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day367-pg`.
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
> **(e) ★★★ **PIĘĆ PUŁAPEK.** (1) **`ensureAiProviderAndAccess` (`ai.routes.ts:414-462`) może zwrócić DWA różne kody na stanowisku bez klucza dostawcy**: `503 AI_CONFIG` gdy brak `OPENROUTER_API_KEY`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` i brak wiersza w `llm_providers` (`providerErrorMapper.ts:56`, `NO_LLM_PROVIDER→AI_CONFIG→503`), ALBO `403 ACCESS_BLOCKED` z `AccessPolicyService.checkAccess(orgId,'ai_call')` niezależnie od klucza. **Zmierz na SWOIM harnessie, KTÓRY z dwóch dostajesz, zanim orzekniesz że fallback działa poprawnie** — fallback musi reagować na „AI niedostępne” niezależnie od tego, czy przyczyna to 503 czy 403. (2) **`previewSelectionEdit` jest współdzielona z uczciwym manualnym panelem** (`data-testid="canvas-selection-edit-panel"`, :3300-3390) — naprawa MUSI rozróżnić wejście z kebaba (ma dostać AI) od wejścia z manualnego panelu (ma zostać dosłowne), inaczej albo zepsujesz manualne narzędzie, albo AI nigdy nie odpali z kebaba. (3) **i18n klucz istnieje ≠ przetłumaczony** — `aiChat.providerError.*` ISTNIEJE w PL i EN (zmierzone), ale każdy NOWY klucz (fallback notice, walidacja długości) musisz sam sprawdzić że ma realną polską treść, nie kopię angielskiej. (4) **Test menu pływającego w jsdom** — `CanvasAIFloatingMenu` renderuje się warunkowo na `position`/`selection`, liczonych z `getBoundingClientRect` na realnej selekcji DOM; jsdom zwraca zera dla layoutu. Punkt wyjścia: `CanvasEditor/__tests__/CanvasRichEditor.externalSync.test.tsx` (istniejący, działający wzorzec montowania `CanvasRichEditor` w tym repo) — użyj go jako bazy, nie wymyślaj montażu od zera. (5) **`reachability-from-root.mjs --check-baseline` jest CZERWONY na markerze PRZED Twoją pracą** (kod wyjścia `1`, trzy pliki niezwiązane z tym dyżurem — patrz Stan zastany) i Twoje własne nowe testy pod `src/**/__tests__/` DOŁOŻĄ kolejne wpisy `test-only`, bo tak działa ten skrypt (klasyfikuje KAŻDY plik pod `src/` osiągalny tylko z testów). To NIE jest regresja tego dyżuru — dokumentujesz deltę po nazwach, nie naprawiasz cudzego stanu i nie próbujesz `--update-baseline` (skrypt sam odmówi, bo odrzuca aktualizację gdy zbiór `test-only` urósł o cokolwiek spoza poprzedniego stanu — sprawdź to zdanie w kodzie linia ~113, nie na słowo). ★ Klasyczne pułapki wspólne serii: `grep --include` w zsh zwraca pustkę — uruchamiaj przez `bash -c '…'`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day367-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day367-kanwa-ai-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: prawdziwe AI zamiast szablonu gdy dostawca dostepny, fallback WYLACZNIE jawny, manualny panel nietkniety, jeden mechanizm bledu, dowod mutacyjny) · R1 (K1 — KROK 0 rodzina + routing kebaba "AI on selection"+"Dodaj element" do realnego lancucha AI z jawnym fallbackiem — RDZEN) · R2 (K7 — podlaczenie `aiProviderErrorCopy`/`getAiErrorLine` do wszystkich akcji AI menu plywajacego + walidacja dlugosci po stronie klienta — RDZEN) · R3 (dowod niezepsucia manualnego panelu "Edit selected text" + przemiar wspolny slownikow/bramek + delta reachability po nazwach) · R4 (raport, pytania do wlasciciela, sekcja TWIERDZENIA NIEZWERYFIKOWANE)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6438` albo `5578` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6438` albo `5578`** (`Z7`).

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

Dwa defekty z audytu ekranu „Czat AI” (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/`), oba
potwierdzone przez niezależnego sceptyka (`V1_weryfikacja_P1.md`, punkty 1 i 2), oba w tej samej
powierzchni: **panel kanwy dokumentu w Czacie** (`/chat` → `WorkCanvasDocumentPanel.tsx` →
`CanvasRichEditor.tsx`). I oba mają jedną wspólną cechę: **etykieta obiecuje AI, kod robi coś
inne — albo podmienia tekst deterministycznie, albo cichnie.**

**K1 — kebab kanwy (`⋮`) obiecuje AI, serwer robi string-replace.** W menu kebaba, sekcja
„Edycja i AI”, cztery przyciski (Rozwiń myśl / Skróć / Przeredaguj / Zaproponuj) i przycisk
„Podgląd zmiany AI” sugerują, że Teresa napisze albo przerobi treść. Realnie:

```text
WorkCanvasDocumentPanel.tsx:2407-2420  applySelectionMenuAction
  buduje STAŁY prefiks tekstowy ("Expand this thought with more detail...") i wkleja go
  razem z zaznaczonym tekstem do pola instrukcji — zero wywołania sieciowego.

WorkCanvasDocumentPanel.tsx:2531-2584  previewSelectionEdit
  wysyła DOSŁOWNĄ treść tego pola jako `replacementMd` do
  POST /api/work-canvas/drafts/:id/operations (type: 'replace_selection').

server/src/routes/work-canvas.routes.ts:1710-1763  applyEditOperation
  draft.contentMd.replace(selectedText, replacementMd) — zwykły string-replace.
  ZERO importu jakiegokolwiek serwisu AI w CAŁYM pliku (zmierzone grepem po `aiService|
  llmService|openai|anthropic|modelRouter` — 0 trafień w 3900+ liniach).
```

Ten sam wzorzec dotyczy „Dodaj element” (6 typów + pole opisu): `insertQuickAddElement`
(:2397-2404) woła `buildQuickAddMarkdown` (:2378-2394) — statyczny szablon markdown per typ,
ignorujący treść opisu poza wstawieniem go dosłownie jako nagłówka/akapitu.

**Prawdziwe AI istnieje w TYM SAMYM module** — menu pływające edytora
(`CanvasRichEditor.tsx handleAIRequest`, `POST /api/ai/chat/quick`) — ale kebab nigdy go nie
woła. Dowód rozłączności: event `canvas-stream-request` (jedyny most do prawdziwego,
strumieniowego AI przez `useCanvasAIStream.ts`) jest dispatchowany z **jednego jedynego miejsca**
w całym `src/` — `UnifiedChatPanel.tsx:4125` — nigdy z kebaba.

**Cel naprawy: kebab ma wołać TEN SAM łańcuch AI co menu pływające** — jedna funkcja żądania,
dwa wejścia — z deterministycznym szablonem zachowanym **wyłącznie jako jawny fallback** przy
niedostępności dostawcy AI, z widocznym komunikatem, że to fallback, nie odpowiedź modelu.

**K7 — menu pływające edytora milczy przy błędzie.** `handleAIRequest`
(`CanvasRichEditor.tsx:242-343`) i `handleAIExplain` (:349-388) łapią błąd i **po cichu
zwracają `null`**:

```text
CanvasRichEditor.tsx:282-285   if (!response.ok) { setAiProcessing(false); return null; }
CanvasRichEditor.tsx:337-340   } catch { setAiProcessing(false); return null; }
CanvasRichEditor.tsx:375       if (!response.ok) return null;
CanvasRichEditor.tsx:381-385   } catch { return null; } finally { setAiProcessing(false); }
```

A wołający w `CanvasAIFloatingMenu.tsx` — `handleQuickAction` (:228-236, obsługuje Rozwiń/Skróć/
Ton/10 pozycji „Akcje”) i `handleCustomPrompt` (:252-256) — **ignorują wartość zwracaną**:
`await onAIRequest(...)` bez jakiegokolwiek `if`. Efekt: użytkownik klika, spinner znika, nic
się nie dzieje, brak jakiegokolwiek komunikatu.

**Jeden przycisk w tym samym pliku robi to poprawnie** — „Wyjaśnij” (`handleExplain`, :242-250)
ustawia `explainState({status:'error'})`, a render (:359-363) pokazuje czerwony komunikat
`t('canvas.aiMenu.explainError', ...)`. To jest **wzorzec do naśladowania**, nie coś do
wymyślenia od nowa.

**I najważniejsze odkrycie tego dyżuru: mechanizm, którego brakuje w K7, JUŻ ISTNIEJE gdzie
indziej i JUŻ MA komplet kluczy i18n w PL i EN** — `src/components/AIChat/aiProviderErrorCopy.ts`
(`getAiErrorCopy`/`getAiErrorLine`), z kluczami `aiChat.providerError.*` obecnymi w obu
słownikach, używany dziś przez `useCanvasAIStream.ts` (linie 326-330, 374-380, 459-465).
`CanvasRichEditor.tsx` i `CanvasAIFloatingMenu.tsx` go **nie importują** (zmierzone — zero
trafień). Naprawa K7 to w dużej mierze **podłączenie gotowego przewodu**, nie budowa nowego.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| wywołań `applySelectionMenuAction` (kebab, prefill) | **6 miejsc** | `:3826,:3839,:3997,:4004,:4011,:4018` |
| wywołań `previewSelectionMenuPrompt` (kebab, submit) | **1 miejsce** | `:4038` |
| wywołań `previewSelectionEdit` POZA kebabem | **1 miejsce, HONEST** | `:3374`, panel manualny `data-testid="canvas-selection-edit-panel"` |
| wywołań `insertQuickAddElement` (kebab, submit) | **1 miejsce** | `:3964` |
| import serwisu AI w `work-canvas.routes.ts` | **0 trafień** w całym pliku | `applyEditOperation` :1710-1763 |
| dispatch `canvas-stream-request` w `src/` | **1 miejsce, NIE kebab** | `UnifiedChatPanel.tsx:4125` |
| gałęzie ciche `!response.ok`/`catch` w `CanvasRichEditor.tsx` | **4 gałęzie** | `:282,:337,:375,:381` |
| wołania `onAIRequest` ignorujące wynik w `CanvasAIFloatingMenu.tsx` | **2 funkcje** (`handleQuickAction`, `handleCustomPrompt`) | `:228-236`, `:252-256` |
| wzorzec działający w tym samym pliku | „Wyjaśnij” | `handleExplain` :242-250, render :359-363 |
| pliki importujące `aiProviderErrorCopy` dziś | **7**, BEZ `CanvasRichEditor.tsx`/`CanvasAIFloatingMenu.tsx` | `useCanvasAIStream.ts`, `teresaRuntimeCopy.ts`, `AiProviderErrorNotice.tsx`, `UnifiedChatPanel.tsx`, `WorkCanvasDocumentPanel.tsx`, `api.ts`, test własny |
| klucze `aiChat.providerError.*` | **obecne w PL i EN** | `public/locales/pl/translation.json:19528`, `.../en/translation.json:18281` |
| limit serwerowy pola `message` | **8000 znaków** | `server/src/validators/ai.validators.ts:567`, `ChatQuickRequestSchema` |
| bramka `ensureAiProviderAndAccess` | **503 (brak dostawcy) LUB 403 (AccessPolicyService)** — zmierz na swoim harnessie | `server/src/routes/ai.routes.ts:414-462`, `server/src/services/ai/providerErrorMapper.ts:56` |
| słownik `pl` / `en`, liście | **35204 / 33071** | `public/locales/{pl,en}/translation.json` |
| bramki kanonu: focus / list / artefakt | **0 / 0 / 0** | `scripts/check-{focus,list,artefakt}-canon*.sh` |
| bramka `reachability-from-root.mjs --check-baseline` | **CZERWONA (exit 1) JUŻ NA MARKERZE, PRZED tym dyżurem** | 3 pliki „New test-only”, **zero związku z Czatem/Kanwą**: `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`, `src/components/assessment/drd/__tests__/macierz-sedno-20260905.test.tsx`, `src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts` |
| ostatnia litera `REJESTR_ZNALEZISK_20260903.md` | **AF** (linia 379) → następna **AG** | brief nadzorcy mówił „AC” — **nieaktualne, sprawdź sam ponownie tuż przed commitem** |

**★ WAŻNE dla `§0.2c`/warunków wspólnych serii: bramka `reach` jest już czerwona na wejściu,
z przyczyn NIEZWIĄZANYCH z tym dyżurem.** Nie jest to Twój warunek „musi być 0 po” — jest to
Twój warunek „delta po nazwach musi być wyjaśniona” (patrz `R3`). Pozostałe trzy bramki
(`focus`, `list`, `artefakt`) MAJĄ być `0` przed i po, jak zwykle.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: kebab ma **6** miejsc prefill + **1** submit selekcji + **1** submit
„Dodaj element” idących deterministyczną ścieżką; serwer `applyEditOperation` ma **0** importów
AI; prawdziwe AI (`canvas-stream-request`) ma **1** dispatcher w całym `src/`, i to nie kebab;
`CanvasRichEditor.tsx` ma **4** ciche gałęzie błędu; `CanvasAIFloatingMenu.tsx` ma **2** funkcje
ignorujące wynik `onAIRequest`; gotowy mechanizm i18n błędu (`aiProviderErrorCopy.ts`) ma klucze
w **obu** słownikach i **7** konsumentów, ale nie te dwa pliki; limit serwerowy to **8000**
znaków; liście słowników **pl 35204**, **en 33071**; trzy bramki kanonu **0/0/0**; bramka
`reach` **już czerwona (exit 1)** z **3** plikami niezwiązanymi; ostatnia litera rejestru **AF**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · SERWIS BŁĘDU · SERWER (WARUNKOWO) · SŁOWNIKI · TESTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Kebab kanwy (K1)** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` — funkcje `applySelectionMenuAction` (:2407-2420), `previewSelectionMenuPrompt` (:2424-2435), `previewSelectionEdit` (:2531-2584), `insertQuickAddElement` (:2397-2404), `buildQuickAddMarkdown` (:2378-2394) | **PEŁNA LICENCJA na te funkcje.** Reszta pliku (5278 linii) — TYLKO ODCZYT, chyba że zmiana jest mechanicznym skutkiem routingu AI (np. nowy stan lokalny `aiSelectionError`) — uzasadnij w raporcie | Brief z `plik:linia` |
| **Manualny panel (NIETYKALNE ZACHOWANIE)** | `WorkCanvasDocumentPanel.tsx:3300-3390` (`data-testid="canvas-selection-edit-panel"`, `applySelectionEditShortcut`) | **ZAKAZ ZMIANY ZACHOWANIA.** Wolno dotknąć KOD wyłącznie jeśli to konieczne, by odróżnić wejście kebaba od wejścia manualnego w `previewSelectionEdit` — ale wynik dla użytkownika manualnego panelu musi zostać identyczny (dosłowna podmiana, zero AI) | Test regresyjny zamiast zmiany |
| **Menu pływające edytora (K7)** | `src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` — `handleAIRequest` (:242-343), `handleAIExplain` (:349-388) | **PEŁNA LICENCJA na te funkcje** (+ nowy stan błędu, jeśli potrzebny) | Brief z `plik:linia` |
| **Menu pływające — UI (K7)** | `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` — `handleQuickAction` (:228-236), `handleCustomPrompt` (:252-256), render błędu (wzorzec :359-363) | **PEŁNA LICENCJA.** `handleExplain`/render błędu (:242-250,:359-363) — TYLKO ODCZYT jako wzorzec, nie przepisujesz działającego kodu bez powodu | Brief |
| **Gotowy mechanizm błędu (wzorzec, TYLKO ODCZYT)** | `src/components/AIChat/aiProviderErrorCopy.ts` | **TYLKO ODCZYT — IMPORTUJESZ, NIE PRZEPISUJESZ.** Jeśli uznasz, że potrzebuje rozszerzenia (np. nowy kod błędu), to WĄSKA LICENCJA na dodanie, nie na przepisanie istniejących eksportów | Brief z uzasadnieniem |
| **Wzorzec integracji AI-strumień (TYLKO ODCZYT)** | `src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` | **TYLKO ODCZYT jako wzorzec**, chyba że `R1` udowodni, że najlepsza droga integracji AI w kebabie to reużycie `streamToCanvas` — wtedy WĄSKA LICENCJA na wywołanie istniejącego hooka z nowego miejsca, **zakaz zmiany logiki wewnątrz hooka** | Brief |
| **Trasa AI (TYLKO ODCZYT)** | `server/src/routes/ai.routes.ts` | **TYLKO ODCZYT.** Trasa `POST /api/ai/chat/quick` (:6621) i `ensureAiProviderAndAccess` (:414-462) już działają — wołasz, nie zmieniasz | Brief |
| **Walidator (TYLKO ODCZYT)** | `server/src/validators/ai.validators.ts` | **TYLKO ODCZYT.** `ChatQuickRequestSchema.message.max(8000)` (:567) jest kontraktem do zwierciadlenia po stronie klienta | Brief |
| **Trasa kanwy (WARUNKOWO)** | `server/src/routes/work-canvas.routes.ts`, `applyEditOperation` (:1710-1763) | **★ TYLKO ODCZYT domyślnie.** WĄSKA LICENCJA na zmianę WYŁĄCZNIE jeśli `R1` udowodni (dowodem, nie przypuszczeniem), że deterministyczny fallback wymaga innego kontraktu operacji niż dzisiejszy `replace_selection`/`update_document` | Brief z `plik:linia` + diff **nienałożony** + pytanie do właściciela |
| **Pozostałe middleware / trasy AI** | `server/src/middleware/**`, `server/src/services/ApiGateway.ts`, `server/src/services/accessPolicyService.ts` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Słowniki** | `public/locales/{pl,en}/translation.json` | **★ WĄSKA, PEŁNA LICENCJA NA DOPISANIE.** Nowe klucze dla: (a) komunikatu błędu AI menu pływającego (jeśli `aiProviderErrorCopy.ts` wymaga rozszerzenia), (b) widocznego komunikatu fallbacku w kebabie („to jest szablon, nie odpowiedź AI”), (c) walidacji długości po stronie klienta. **Liście nie mogą zmaleć. Zakaz usuwania/zmiany istniejących kluczy. Treść PL musi być polska, nie kopią EN** | — |
| **Nowe testy** | `src/components/AIChat/__tests__/**`, `src/components/AIChat/CanvasEditor/__tests__/**` (nowe pliki), ewentualnie `tests/**` | **PEŁNA LICENCJA.** Preferowana lokalizacja to katalogi `__tests__` obok komponentów (zgodnie z istniejącym wzorcem `CanvasRichEditor.externalSync.test.tsx`) — patrz pułapka `reach` w `R3` dla konsekwencji tego wyboru. Nowe pliki pod `tests/` wymagają `git add -f` | — |
| **Istniejący test wzorca-złego** | `src/components/AIChat/__tests__/WorkCanvasDocumentPanel.ownerFeedback.test.ts` | **TYLKO ODCZYT.** Istnieje, używa `readFileSync`+`toContain` — NIE jest w zakresie tego dyżuru do naprawy i NIE jest wzorcem dla Twoich nowych testów | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Bramka reachability (dane, nie skrypt)** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **TYLKO ODCZYT.** Nie aktualizujesz — skrypt sam odmówi, dopóki 3 pliki niezwiązane nie zostaną rozliczone przez kogoś innego (`Z17`) | Opis delty w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł** | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze (dziś **AG**, sprawdź ponownie tuż przed commitem) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY367_KANWA_AI_REPORT.md` (**NOWY**) | `R4` — jedyny nowy dokument rejestrowy (`Z13`) | — |
| **Cudze tereny** | K2-K9 i rodziny P2 z `00_ZESTAWIENIE.md` (Akcje biznesowe, źródła w chmurze, konwersja na inicjatywę, karta potwierdzenia sprawy, pomoc „Zapytaj AI teraz”, i18n `quickAction`/`tone`, duplikat panelu dataset, workflow ledger EN) — prawdopodobnie inne dyżury paczki 368-373 | **TYLKO ODCZYT** | Wpis do raportu z `plik:linia`, **nie naprawiasz** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

**★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**.

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35204, en 33071 — PO musi być >= (rosnie, bo dopisujesz klucze)

# (b) trzy bezpieczniki MAJA konczyc sie kodem 0 (jak dzis)
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby PRZED: wszystkie 0 — MUSZA zostac 0 PO

# (c) reachability — JUZ CZERWONA na wejsciu (patrz Stan zastany). Mierzysz PRZED i PO,
#     ale kryterium to DELTA PO NAZWACH, nie kod wyjscia 0
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: reach=1, 3 pliki niezwiazane (patrz Stan zastany).
#   PO: dopuszczalne nowe wpisy "test-only" to WYLACZNIE Twoje wlasne nowe pliki testowe
#   pod src/**/__tests__/ — nazwij je jawnie w raporcie. Zaden z 3 plikow PRZED nie moze
#   zniknac ani zmienic sie (to nie Twoj zakres, Z17). Zaden NIEZWIAZANY plik nie moze
#   sie pojawic.
```

**Jeżeli którakolwiek liczba (a)/(b) się pogorszy albo bramka zaczerwieni się od Twojej
zmiany — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). Dla (c) —
naprawiasz TYLKO jeśli delta zawiera coś poza Twoimi własnymi nowymi plikami testowymi.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wywołań `applySelectionMenuAction` | `6` | komenda (2) z `§0.3` | TAK |
| 2 | wywołań `previewSelectionMenuPrompt` | `1` | komenda (2) | TAK |
| 3 | wywołań `previewSelectionEdit` POZA kebabem (honest) | `1` | komenda (2), (6) | TAK — to jest granica, którą `R1` nie może przesunąć |
| 4 | wywołań `insertQuickAddElement` | `1` | komenda (2) | TAK |
| 5 | importów AI w `work-canvas.routes.ts` | `0` | komenda (3) | TAK — cały plik, nie tylko cytowane linie |
| 6 | dispatcherów `canvas-stream-request` w `src/` | `1`, nie-kebab | komenda (5) | TAK |
| 7 | cichych gałęzi błędu w `CanvasRichEditor.tsx` | `4` | komenda (7) | TAK |
| 8 | funkcji ignorujących `onAIRequest` w `CanvasAIFloatingMenu.tsx` | `2` | komenda (8) | TAK |
| 9 | konsumentów `aiProviderErrorCopy` dziś | `7`, bez tych 2 plików | komenda (10) | TAK — **to jest dowód, że naprawa to podłączenie, nie budowa** |
| 10 | limit `message` serwera | `8000` | komenda (11) | TAK |
| 11 | liście słowników PL/EN | `35204`/`33071` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |
| 12 | bramki focus/list/artefakt | `0/0/0` | blok (b) | TAK |
| 13 | bramka `reach`, stan wejściowy | `1` (czerwona), 3 pliki | komenda (13)/(c) | TAK — **i to jest cudzy dług, nie Twój** |
| 14 | ostatnia litera rejestru znalezisk | `AF`→`AG` | komenda (14) | TAK — sprawdź PONOWNIE tuż przed commitem |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY367_KANWA_AI_REPORT.md` ·
`evidence/day367-kanwa-ai/**` (nowy) ·
`src/components/AIChat/WorkCanvasDocumentPanel.tsx` (funkcje z tabeli licencji, `R1`) ·
`src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` (`R2`) ·
`src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` (`R2`) ·
`public/locales/{pl,en}/translation.json` (dopisanie kluczy) ·
nowe pliki testowe pod `__tests__/`.

**Zapisujesz WARUNKOWO:**
`server/src/routes/work-canvas.routes.ts` (wyłącznie z dowodem `R1` że fallback wymaga zmiany
kontraktu) ·
`src/components/AIChat/aiProviderErrorCopy.ts` (wyłącznie dodanie, nie przepisanie) ·
`src/components/AIChat/CanvasEditor/useCanvasAIStream.ts` (wyłącznie jeśli `R1` wybierze reużycie
`streamToCanvas`, i wyłącznie wywołanie z nowego miejsca, nie zmiana wnętrza) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:**
`server/src/routes/ai.routes.ts`, `server/src/validators/ai.validators.ts`,
`server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`server/src/services/accessPolicyService.ts`,
`WorkCanvasDocumentPanel.tsx:3300-3390` w sposób zmieniający zachowanie manualnego panelu,
`src/components/AIChat/__tests__/WorkCanvasDocumentPanel.ownerFeedback.test.ts`,
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16),
pliki dowodowe innych dyżurów (`evidence/g15/**`, `evidence/licznik-kompletnosci-*/**`,
`evidence/odbior-zywo-*/**`).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day367-kanwa-ai
git diff --name-only --cached | tee /private/tmp/cx-day367-kanwa-ai-artefakty/staged.txt
bash -c "grep -iE '^server/src/routes/ai\.routes|^server/src/validators/ai\.validators|^server/src/middleware/|ApiGateway|accessPolicyService|ownerFeedback\.test|reachability\.baseline|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|MODULE_ACCEPTANCE|^evidence/g15/|^evidence/licznik-kompletnosci|^evidence/odbior-zywo' /private/tmp/cx-day367-kanwa-ai-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Prawdziwe AI, nie szablon, gdy dostawca jest dostępny.** Po naprawie `R1`, kliknięcie
„Podgląd zmiany AI” albo „Dodaj do canvas” w kebabie ma, gdy `ensureAiProviderAndAccess`
przepuszcza żądanie, dać treść WYGENEROWANĄ przez model (ten sam kontrakt `POST /api/ai/chat/quick`
co menu pływające), nie własną instrukcję odbitą z powrotem. Jeżeli okaże się, że kontrakt
serwera na to nie pozwala bez zmiany — to jest STOP merytoryczny z briefem, nie cichy commit
zostawiający dzisiejsze zachowanie.

**(2) Fallback wyłącznie jawny.** Gdy dostawca AI jest niedostępny (403/503/sieć/timeout),
deterministyczny szablon WOLNO wstawić jako ratunek — ale WYŁĄCZNIE z widocznym komunikatem,
że to szablon, nie odpowiedź modelu. Cichy fallback jest tym samym defektem (D-1), tylko lepiej
ukrytym.

**(3) Jeden mechanizm błędu, manualny panel nietknięty.** K7 podłącza ISTNIEJĄCY
`getAiErrorCopy`/`getAiErrorLine` (`aiProviderErrorCopy.ts`) do wszystkich akcji AI menu
pływającego — nie tworzysz drugiego, równoległego mechanizmu. Manualny panel „Edit selected
text” (`data-testid="canvas-selection-edit-panel"`) NIE obiecuje AI i musi zachować dokładnie
dzisiejsze zachowanie (dosłowna podmiana tekstu użytkownika) po zmianach w `R1`.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — K1: KEBAB MA WOŁAĆ REALNY ŁAŃCUCH AI, SZABLON TYLKO JAKO JAWNY FALLBACK (rdzeń)

1. **KROK 0 — rodzina.** Zanim cokolwiek zmienisz, wypisz WSZYSTKIE miejsca w kebabie, które
   dziś obiecują AI i robią deterministyczną podmianę: 6 wywołań `applySelectionMenuAction`
   (prefill), 1 `previewSelectionMenuPrompt`→`previewSelectionEdit` (submit selekcji), 1
   `insertQuickAddElement` (submit „Dodaj element”). Potwierdź moje liczby albo popraw je
   z dowodem.
2. **Zaprojektuj i zaimplementuj jedną funkcję żądania AI, dwa wejścia.** Menu pływające
   (`CanvasRichEditor.handleAIRequest`) już woła `POST /api/ai/chat/quick` z kontraktem
   `{message: "${prompt}\n\nText to modify:\n${text}", context: {source, selectedText}}`.
   Kebab (`previewSelectionEdit`, wywołane z `previewSelectionMenuPrompt`) ma wołać **ten sam
   kontrakt** zamiast wysyłać literalną treść pola jako `replacementMd` — zanim operacja
   `replace_selection` trafi do serwera, `replacementMd` ma być ODPOWIEDZIĄ MODELU, nie
   instrukcją użytkownika. Podobnie `insertQuickAddElement` ma poprosić model o treść wg
   `quickAddPrompt`+`quickAddElement`, zanim złoży markdown. Wybierz i uzasadnij jedną z dróg:
   - **(A)** ten sam `fetch('/api/ai/chat/quick', ...)` co `handleAIRequest`, wywołany wprost
     z `WorkCanvasDocumentPanel.tsx` (najbliżej dzisiejszego kodu);
   - **(B)** reużycie `useCanvasAIStream.streamToCanvas` (event `canvas-stream-request` już
     ma gotową obsługę błędu przez `onError`/`getAiErrorLine`) — ale zwróć uwagę, że tryb
     `patch`/`replace` w tym hooku pisze WPROST do edytora TipTap, więc podgląd „preview przed
     zaakceptowaniem” (dzisiejszy `pendingOperation`) trzeba pogodzić z tym mechanizmem albo
     świadomie zmienić UX (opisz to w raporcie, nie milcz);
   - **(C)** inna droga, uzasadniona pomiarem.
   **Zakaz duplikacji**: po naprawie ma istnieć JEDNA funkcja/hook realizująca żądanie do
   modelu dla tej rodziny (grep na finalny kod ma pokazać jedno miejsce budujące ten kontrakt
   fetch, używane z obu wejść — menu pływające i kebab — nie dwa niezależne wywołania
   `fetch('/api/ai/chat/quick', ...)` skopiowane osobno).
3. **Fallback jawny.** Gdy wywołanie AI zawiedzie (non-2xx, sieć, `ensureAiProviderAndAccess`
   zwraca 403 lub 503 — zmierz na SWOIM harnessie które dostajesz, patrz pułapka (1)), kebab MA
   PRAWO wstawić dzisiejszy deterministyczny szablon (`buildQuickAddMarkdown` / literalna
   instrukcja) — ale z widocznym komunikatem w UI (nowy klucz i18n PL+EN, np.
   `canvas.panel.selection.aiFallbackNotice`/`canvas.panel.addElement.aiFallbackNotice`),
   jednoznacznie mówiącym, że to szablon, nie odpowiedź modelu.
4. **Manualny panel nietknięty.** Jeżeli zmiana w `previewSelectionEdit` wymaga rozróżnienia
   wejścia (kebab vs. manualny panel `:3374`), zrób to jawnym parametrem/flagą wywołania, NIE
   zmianą domyślnego zachowania funkcji. Dowód: test regresyjny pokazujący, że kliknięcie
   „Preview edit” w manualnym panelu nadal daje dosłowną podmianę tekstu użytkownika, zero
   wywołania AI (zero `fetch` do `/api/ai/chat/quick` z tej ścieżki).
5. **Dowód, że wołanie DOCIERA do trasy AI.** Test jednostkowy z zamockowanym `global.fetch`:
   klik akcji kebaba → asercja, że `fetch` został wywołany z URL `/api/ai/chat/quick` i ciałem
   zawierającym `selectedText`/`prompt` (nie asercja na tekście źródłowym pliku — asercja na
   ZACHOWANIU: co faktycznie poleciało do sieci). To jest wymagana **para** z punktem 6.
6. **Dowód fallbacku.** Ten sam test (albo siostrzany), z `fetch` zamockowanym na odrzucenie/
   `response.ok=false` — asercja, że (a) deterministyczny szablon nadal się pojawia (funkcja
   nie failuje w ciszy), ORAZ (b) widoczny komunikat fallbacku jest w DOM/stanie.
7. **Dowód mutacyjny.** Cofnij naprawę punktu 2 (przez `cp` ze `SCRATCH`, `Z27`) — test z
   punktu 5 MA zaczerwienić się (bo `fetch` przestaje być wywoływany, kebab wraca do czystego
   literału); przywróć — MA zzielenieć; `git diff` po cofnięciu **pusty**.

**Wymagany dowód:** tabela rodziny (KROK 0) z Twoimi liczbami · opis wybranej drogi (A/B/C)
z uzasadnieniem odrzucenia pozostałych · diff routingu AI · test „żądanie dociera do AI” +
test „fallback jawny” (para) · dowód mutacyjny w obie strony · test regresyjny manualnego
panelu · nowe klucze i18n w PL i EN z realną polską treścią. **Commit po `R1`.**

## R2 — K7: WSPÓLNY KOMUNIKAT BŁĘDU + WALIDACJA DŁUGOŚCI PO STRONIE KLIENTA (rdzeń)

1. **Podłącz `getAiErrorCopy`/`getAiErrorLine`** (`aiProviderErrorCopy.ts`, TYLKO ODCZYT jako
   moduł) do `handleAIRequest` i `handleAIExplain` (`CanvasRichEditor.tsx`) — gałęzie `!response.ok`
   (:282,:375) i `catch` (:337,:381) mają, zamiast cichego `return null`, przekazać do wywołującego
   informację wystarczającą do zbudowania komunikatu (np. zwrócić `{ok:false, errorLine}` zamiast
   gołego `null`, albo wywołać nowy prop `onAIError(errorLine)` — wybierz i uzasadnij, zachowując
   istniejący kontrakt `Promise<string|null>` tam, gdzie to możliwe, żeby nie złamać wołających
   poza zakresem tego dyżuru).
2. **Wyświetl komunikat we WSZYSTKICH pozycjach menu pływającego**, nie tylko w „Wyjaśnij”:
   `handleQuickAction` (Rozwiń/Skróć/Ton/10× Akcje) i `handleCustomPrompt` (custom prompt) mają,
   po `await onAIRequest(...)` zwracającym błąd, ustawić widoczny stan błędu — wzorując się na
   `explainState`/render :359-363, ale jako WSPÓLNY mechanizm (jeden stan, jeden render), nie
   kopia-wklej dla każdej z 12 pozycji.
3. **Walidacja długości PRZED wysyłką.** Zanim `handleAIRequest`/`handleCustomPrompt` zrobi
   `fetch`, policz długość finalnego `message` (`${prompt}\n\nText to modify:\n${text}` — DOKŁADNIE
   ta konkatenacja, nie sam `prompt`) i porównaj z limitem serwera (`8000`, zwierciadlone z
   `ChatQuickRequestSchema.message.max(8000)`, `server/src/validators/ai.validators.ts:567` —
   TYLKO ODCZYT, kopiujesz liczbę, nie importujesz zoda z serwera do klienta). Gdy przekroczone —
   pokaż komunikat PRZED wysyłką, `fetch` NIE MA być wywołany.
4. **i18n.** Nowe/rozszerzone klucze błędu — jeśli `aiChat.providerError.*` już pokrywa
   wszystkie potrzebne przypadki, NIE dodawaj duplikatów, tylko zaimportuj. Jeśli brakuje kodu
   błędu dla „za długi tekst” — dodaj WĄSKO nowy klucz (np. `aiChat.providerError.tooLong` albo
   analogiczny w namespace `canvas.aiMenu`), z realną treścią PL i EN.
5. **Dowód.** Test renderujący `CanvasAIFloatingMenu`+`CanvasRichEditor` (punkt wyjścia:
   `CanvasEditor/__tests__/CanvasRichEditor.externalSync.test.tsx`, wzorzec montażu) z
   zamockowanym `global.fetch` zwracającym `500` — klik dowolnej pozycji z zakresu #19-21/23-24/
   27-37 (nie „Wyjaśnij”, ten już działa) → asercja, że komunikat błędu jest widoczny w DOM.
   Osobny test: tekst dłuższy niż limit → asercja, że komunikat pojawia się PRZED próbą `fetch`
   (fetch NIE wywołany).
6. **Dowód mutacyjny.** Cofnij podłączenie z punktu 1-2 (przez `cp`) — test z punktu 5 (błąd
   500) MA zaczerwienić się; przywróć — MA zzielenieć; `git diff` po cofnięciu **pusty**.
7. **Nie psujesz „Wyjaśnij”.** Test regresyjny: `handleExplain` nadal pokazuje swój istniejący
   komunikat błędu identycznie jak dziś (ten kod jest wzorcem, nie zmieniasz go bez powodu).

**Wymagany dowód:** diff podłączenia mechanizmu błędu · diff walidacji długości · test „błąd
500 → komunikat widoczny” + dowód mutacyjny (para) · test „za długi tekst → fetch nie wywołany”
· test regresyjny „Wyjaśnij” nietknięty · nowe/rozszerzone klucze i18n w PL i EN. **Commit po
`R2`.**

## R3 — REGRESJA MANUALNEGO PANELU, PRZEMIAR WSPÓLNY, DELTA REACHABILITY PO NAZWACH

1. **Regresja manualnego panelu** (jeśli nie zrobiona już w `R1` punkt 4): test potwierdzający,
   że `data-testid="canvas-selection-edit-panel"` → „Preview edit” nadal robi dosłowną podmianę
   tekstu, zero wywołania `/api/ai/chat/quick` z tej ścieżki.
2. **Przemiar wspólny serii** (blok „WARUNKI WSPÓLNE SERII”): słowniki PL/EN PRZED i PO (rosną,
   nie maleją), trzy bramki `focus`/`list`/`artefakt` PRZED i PO (`0/0/0` w obu przebiegach).
3. **Delta `reachability-from-root.mjs --check-baseline` po nazwach.** Uruchom PRZED (już
   zmierzone: `reach=1`, 3 pliki niezwiązane) i PO Twoich zmianach. Zapisz PEŁNĄ listę „New
   test-only files” z obu przebiegów. Kryterium: różnica między PRZED a PO to WYŁĄCZNIE nazwy
   Twoich własnych nowych plików testowych pod `src/**/__tests__/` (nazwij je jawnie) — te same
   3 nazwy sprzed Twojej pracy MUSZĄ pozostać identyczne (nie znikają, nie mnożą się, nie
   zmieniają nazwy). Jeśli pojawi się COKOLWIEK inne — STOP merytoryczny, opisujesz przyczynę.
4. **Zero pełnego `tsc`/`vitest`.** Weryfikacja kompilowalności zmienionych plików przez
   `npx esbuild <plik> --bundle --outfile=/dev/null` (per plik, nie cały projekt).

**Wymagany dowód:** test regresyjny manualnego panelu · liczby słowników i bramek przed/po ·
dwie pełne listy „New test-only files” (przed/po) z jawnym uzasadnieniem delty · wynik esbuild
per zmieniony plik. **Commit po `R3`.**

## R4 — RAPORT, PYTANIA DO WŁAŚCICIELA, TWIERDZENIA NIEZWERYFIKOWANE

Raport zawiera: KROK 0 rodziny `R1` z Twoimi liczbami · opis wybranej drogi integracji AI
(A/B/C) z uzasadnieniem · dowód „żądanie dociera do AI” + dowód fallbacku (para) z `R1` ·
dowód mutacyjny `R1` w obie strony · dowód regresji manualnego panelu · diff podłączenia
mechanizmu błędu i walidacji długości z `R2` · dowód „błąd 500 → komunikat” + dowód mutacyjny
`R2` · dowód „Wyjaśnij” nietknięty · przemiar wspólny słowników/bramek `R3` · dwie listy
`reachability` (przed/po) z uzasadnieniem delty · listę rozbieżności wobec liczb tej instrukcji
· **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Co najmniej: (a) czy fallback
deterministyczny ma zostać na stałe jako jawna opcja „szybki szablon bez AI” (przydatna np. przy
przekroczonym budżecie), czy ma zniknąć zupełnie, gdy dostawca wraca do życia — dziś jest to
wyłącznie awaryjne; (b) czy `ensureAiProviderAndAccess` zwracający 403 (nie tylko 503) na
stanowisku bez klucza dostawcy jest zamierzony, czy to osobny defekt do zgłoszenia. Sekcja
**nie może być pusta**.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — dziś **AG** — sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy paczki 368-373.

**Commit po `R4`.**

## Próg odbioru

**Kebab kanwy woła realny łańcuch AI (ten sam kontrakt co menu pływające), z deterministycznym
szablonem WYŁĄCZNIE jako jawny fallback, udowodniony parą dowodów (żądanie dociera do AI / fallback
jawny) i dowodem mutacyjnym. Menu pływające edytora pokazuje widoczny komunikat błędu na
wszystkich swoich akcjach AI, używając istniejącego mechanizmu i18n, z walidacją długości przed
wysyłką. Manualny panel „Edit selected text” zachowuje dzisiejsze, uczciwe zachowanie. Delta
bramki `reachability` jest wyjaśniona po nazwach.**

Odbiorca odrzuci dyżur, w którym: kebab nadal odbija literalną instrukcję jako „AI” gdy dostawca
jest dostępny; fallback jest cichy (bez widocznego komunikatu); nowy test asertuje tekst źródłowy
zamiast zachowania (`readFileSync`+`toContain`); manualny panel zaczął wołać AI albo przestał
działać; „Wyjaśnij” przestał pokazywać swój komunikat; delta `reachability` zawiera cokolwiek
poza własnymi nowymi plikami testowymi bez wyjaśnienia; albo zmienił się stan choćby jednego
wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „kebab podłączony do realnego
AI z jawnym fallbackiem, menu pływające pokazuje błąd na wszystkich pozycjach, manualny panel
niezmieniony — R3 zatrzymany, bo delta reachability wymaga decyzji właściciela” — **jest
pełnowartościowym wynikiem**, nawet jeżeli raport `R4` nie jest jeszcze złożony.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Kebab ma wołać prawdziwe AI” vs „serwer `work-canvas.routes.ts` jest tylko do odczytu” | Tabela licencji + `R1` pkt 2: AI woła się PO STRONIE KLIENTA (jak dziś robi `CanvasRichEditor`), zanim operacja trafi do serwera — serwer dostaje już gotowy `replacementMd`, dokładnie jak dziś |
| „Napraw `previewSelectionEdit`” vs „manualny panel musi zostać nietknięty” | `R1` pkt 4: rozróżnienie wejścia jawnym parametrem, nie zmianą domyślnego zachowania; dowód regresyjny obowiązkowy |
| „Jeden mechanizm błędu” vs „`aiProviderErrorCopy.ts` jest tylko do odczytu” | Tabela licencji: importujesz gotowy moduł, wąska licencja tylko na DODANIE brakującego kodu błędu, nie przepisanie istniejących eksportów |
| „Fallback ma działać” vs „zakaz cichego fallbacku” | `R0` (2) i `R1` pkt 3/6: fallback wolno wstawić, ale zawsze z widocznym komunikatem — dowód to PARA (żądanie dociera do AI / fallback jawny), nie jeden z dwóch |
| „Napraw bramkę reachability” vs „nie naprawiasz cudzego stanu” | `R3` pkt 3: mierzysz i dokumentujesz DELTĘ PO NAZWACH, nie naprawiasz 3 plików niezwiązanych (`Z17`) — to jest cudzy dług |
| „Dodaj testy w `src/**/__tests__/`” vs „nie pogarszaj bramek” | Pułapka (5): dodanie testu w tej lokalizacji MECHANICZNIE dokłada wpis `test-only` do `reachability` — to jest oczekiwany, udokumentowany efekt uboczny, nie regresja do naprawienia |
| „Zwierciedl limit serwera 8000 znaków” vs „walidator serwera jest tylko do odczytu” | `R2` pkt 3: kopiujesz LICZBĘ do stałej po stronie klienta, nie importujesz kodu z `server/` do `src/` (odrębne runtime) |
| „Ustal, który kod błędu (403 czy 503) dostajesz” vs „nie zmieniasz `ensureAiProviderAndAccess`” | Pułapka (1) i `R4`: mierzysz na swoim harnessie, fallback ma reagować na oba identycznie; pytanie o zamierzoność 403 idzie do właściciela, nie do zmiany kodu bramki |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie linie `WorkCanvasDocumentPanel.tsx`, `CanvasRichEditor.tsx`, `CanvasAIFloatingMenu.tsx`, `work-canvas.routes.ts`, `ai.routes.ts`, `ai.validators.ts`, `aiProviderErrorCopy.ts` zweryfikowane osobiście na markerze `9715bab7ea`; `evidence/day367-kanwa-ai/` jawnie oznaczone jako nieistniejące (tworzysz) |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 14 wierszy, wszystkie zmierzone przy wydaniu |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — kebab · manualny panel · menu pływające ×2 pliki · mechanizm błędu · wzorzec streamu · trasa AI · walidator · trasa kanwy warunkowo · middleware · słowniki · testy · test-wzorca-złego · infrastruktura testów · baseline reachability · macierz · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`/`R2` dotykają wyłącznie 3 plików klienckich + słowniki, `R3` tylko mierzy i testuje regresję |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6438/5578 wolne (`lsof` przy wydaniu), zero kontenerów `cx-day36*`/`cx-day37*`, zero gałęzi `codex/day367-*`; rodzeństwo 368-373 ma rozłączne porty 6439-6444/5579-5584, temat rozłączny (K2-K9 zamiast K1/K7) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: dwa kody błędu bramki AI, współdzielona `previewSelectionEdit`, i18n klucz≠tłumaczenie, jsdom+`getBoundingClientRect`, `reachability` już czerwona na wejściu |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |

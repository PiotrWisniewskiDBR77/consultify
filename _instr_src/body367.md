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

## Po co ten dyżur istnieje

Dyżur 371 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`,
TYLKO ODCZYT) zmierzył precyzyjnie, że karta `CaseIntakeConfirmCard.tsx` nigdy się nie
renderuje — w całym `src/`+`server/src/` dokładnie **2** wystąpienia stringa
`case_intake_proposal` (odczyt w `MessageRenderer.tsx`, komentarz w nagłówku samej karty),
**zero producentów** — mimo że backend (`caseIntakeService`) jest realny i curl-potwierdzony.
371 poprawnie ODMÓWIŁ budowy producenta bez decyzji właściciela i bez licencji, która
obejmowałaby plik składający odpowiedź asystenta (`CaseIntakeConfirmCard.tsx:22-29` przyznaje
to wprost we własnym nagłówku). Zamiast budować połowicznie, 371 zostawił kartę DOKŁADNIE
w takim stanie, w jakim była przed dyżurem (diff netto zerowy, potwierdzone w
`ODBIOR_371.md`), i zadał właścicielowi wprost pytanie 2: „czy osobny dyżur może objąć
producenta wiadomości oraz `src/components/CaseWorkspace/apiIntake.ts`, aby wariant A lub
pełne usunięcie B nie łamały granic i reachability?”

Właściciel odpowiedział **DEC-2026-09-05-396** („tak”, 05.09 popołudnie, ostatni wiersz
`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`, TYLKO ODCZYT):
Teresa ma SAMA rozpoznawać w rozmowie nową sprawę i proponować jej założenie. Wykonanie
zapisane w tym samym wierszu ledgera: „dyżur 378 `case-intake-producer` — producent w
orkiestracji czatu przez istniejący `caseIntakeService`, za flagą domyślnie OFF, zrzut przez
dev-render do akceptu właściciela, dopiero potem flaga ON”.

**Ten dyżur jest tą odpowiedzią.** W przeciwieństwie do 371 (który miał ZMIERZYĆ i
ODMÓWIĆ/USUNĄĆ bez decyzji), ten dyżur ma ZBUDOWAĆ — bo decyzja już zapadła. Ale „zgoda
właściciela” nie zwalnia z tej samej dyscypliny pomiaru: poniżej są DWA realne znaleziska,
zmierzone dzisiaj (05.09, na marker `c7f8b53660`, PO scaleniu 367-373), których 371 nie
miał, bo powstały/zostały udokumentowane później:

**Znalezisko 1 — `classifyIntent` przestał być stubem.** `caseIntakeService.ts` (pytanie
otwarte #4 w jego własnym nagłówku) cytuje `chatExecutionService.classifyIntent` jako
„self-declared heuristic stub (LLM call placeholder)” pod linią ok. 132. To było prawdą
PRZED 2026-08-11. Od CW-T-B (Stream B) `classifyIntent` (`chatExecutionService.ts:178-261`,
zweryfikuj dokładne linie sam) jest REALNYM, deterministycznym klasyfikatorem PL/EN opartym
na wzorcach regex — zwraca `intentType: 'governed_work'|'conversational'|'ambiguous'` z
`confidence`/`reasoning`. To NIE jest LLM i NIE potrafi wyciągnąć z rozmowy `goal`/`scope`/
`expectedOutcome` — to zostaje prawdziwą luką (patrz Znalezisko 2 poniżej i R2). Ale
cytowanie komentarza `caseIntakeService.ts` jako aktualnego opisu stanu `classifyIntent`
byłoby dokładnie tym błędem, przed którym ostrzega CLAUDE.md („audyty starzeją się w ~3 dni”)
— zweryfikuj to sam, nie przepisuj cudzego komentarza.

**Znalezisko 2 — jedyna trasa, która dziś woła `classifyIntent` (`/case-intake/turn` w
`server/src/routes/v8/chat.routes.ts`), stoi za bramą modułu domyślnie ZAMKNIĘTĄ dla
zwykłego usera.** `router.use('/case-intake', caseIntakeModuleGate)` (`chat.routes.ts`, ok.
l.339), gdzie `caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE')`
(`server/src/middleware/betaGate.middleware.ts`). `createModuleGate` przepuszcza requesta
TYLKO gdy `BETA_MENU_STATUS['MODULE_CASE_WORKSPACE'] === 'open'` ALBO rola requestera to
OWNER/ADMIN/ADMINISTRATOR/SUPERADMIN — a komentarz w samym pliku middleware wymienia
`MODULE_CASE_WORKSPACE` wprost jako jeden z modułów, które SĄ dziś zamknięte. Producent
zbudowany na v8 wyglądałby na demie z kontem admina jak gotowa funkcja, a byłby martwy dla
każdego realnego, nie-adminowego usera — dokładnie kształt fałszywego „gotowe”, jaki ta
metodyka pracy uczy się wyłapywać. **Router v10** (`server/src/routes/v10/teresa.routes.ts`)
NIE MA tej bramy — jego własny nagłówek mówi wprost: „mounted unconditionally in
`Gateway.ts:1246` — the ONLY Teresa router `Gateway.ts` imports”. Dlatego cała nowa logika
tego dyżuru idzie na v10, nie na v8. `R1` wymaga, żebyś to zweryfikował samodzielnie, zanim
napiszesz jedną linię kodu — status bramy mógł się zmienić między napisaniem tej instrukcji
a Twoją pracą.

**Co dokładnie brakuje (i tylko to buduje ten dyżur).** Cały łańcuch backendu jest realny i
NIETKNIĘTY w tym dyżurze: `caseIntakeService.proposeConversationWorkOrder` /
`confirmConversationWorkOrder` / `getCurrentConversationWorkOrder` / `findCaseForConversation`
— wszystko już istnieje, jest curl-potwierdzone i zamontowane DWA razy (v10 bezwarunkowo, v8
za bramą). Karta `CaseIntakeConfirmCard.tsx` już poprawnie renderuje się na
`metadata.type === 'case_intake_proposal'` i już poprawnie woła `confirmConversationWorkOrder`
z `apiIntake.ts` po kliknięciu „Potwierdź”. **Brakuje WYŁĄCZNIE producenta**: kroku w
orkiestracji czatu, który po realnej turze Teresy na `/chat` (1) tanim, deterministycznym
filtrem (`classifyIntent`, już istniejący) decyduje, czy w ogóle warto pytać model o więcej;
(2) jeśli tak, jednym dodatkowym, strukturalnym wywołaniem LLM (wzorzec z `ai.routes.ts`
`/chat/confirm`, już istniejący) próbuje wyciągnąć `goal`/`scope`/`expectedOutcome`; (3) jeśli
dostanie pewny wynik, woła ISTNIEJĄCE `proposeConversationWorkOrder` i doczepia
`metadata.type='case_intake_proposal'` do wiadomości asystenta — dokładnie tak, jak dziś
robi to ręcznie ekran Case Workspace (formularz), tylko automatycznie, z treści rozmowy.

## ★ Stan zastany, zmierzony przeze mnie na markerze `c7f8b53660d227ab79797ec0f64ea9e187b50006`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| Wystąpienia `case_intake_proposal` w `src`+`server/src` | **2** (odczyt + komentarz), **0 producentów** | `MessageRenderer.tsx:884`, `CaseIntakeConfirmCard.tsx:26` |
| `CaseIntakeConfirmCard`: akcje dostępne na karcie | WYŁĄCZNIE „Potwierdź” (`handleConfirm`) — **brak** „Odrzuć” | `CaseIntakeConfirmCard.tsx` |
| Backend case-intake, router v10 (bezwarunkowy) | 5 tras: `summary`/`work-order`/`confirm`/`case`/`conversation` | `teresa.routes.ts` ok. l.277-380 |
| Backend case-intake, router v8 (za bramą) | 5 tras + `/turn` (jedyna wołająca `classifyIntent`) | `chat.routes.ts` ok. l.408-565 |
| Brama modułu na v8 | `caseIntakeModuleGate = createModuleGate('MODULE_CASE_WORKSPACE')`, DOMYŚLNIE ZAMKNIĘTA dla zwykłego usera | `chat.routes.ts:337-339`, `betaGate.middleware.ts` |
| `classifyIntent` — realny stan | regex PL/EN, deterministyczny, OD 2026-08-11 (CW-T-B) — NIE stub, NIE LLM, NIE drafuje work order | `chatExecutionService.ts:178-261` |
| `caseIntakeService.ts` — zakaz LLM wewnątrz | jawny, w nagłówku (pyt. otwarte #4): ekstrakcja to „the caller's job” | `caseIntakeService.ts` ok. l.166-169 |
| Wzorzec strukturalnego LLM już w repo, inna trasa | `ConfirmSchema` + `llmService.callStructured({...})` | `ai.routes.ts` ok. l.1490-1600, trasa `/chat/confirm` |
| Punkt składania metadanych dla realnej tury `/chat` | `onStreamDone`, DWA zapisy: `addMessageToConversation(...)` (trwały) i `addChatMessage(...)` (lokalny/legacy) | `UnifiedChatPanel.tsx` ok. l.1698, l.1733, l.1797 |
| Klient wywołujący `/chat/stream` | `UnifiedChatPanel` → `useAIStream.startStream` → `Api.chatWithAIStream` → `POST ${API_URL}/ai/chat/stream` | `useAIStream.ts:1363`, `api.ts` ok. l.2609+2708 |
| Klient apiIntake.ts — eksporty istniejące | `proposeConversationWorkOrder`, `getCurrentConversationWorkOrder`, `confirmConversationWorkOrder`, `getCaseForConversation`, `getConversationForCase` — **brak** wrappera dla `/turn`/nowej trasy | `apiIntake.ts` |
| Flaga klienta, wzorzec podwójny (klient+serwer) już działający | `ENABLE_TERESA_MINDMAP` | `useFeatureFlags.tsx:354-361`, `FeatureFlags.ts:39,190` |
| Słowniki PL/EN | pl **35312**, en **33172** (gałąź współdzielona z 374-377, RUCHOMA) | `public/locales/**` |
| Cztery bramki kanonu | `focus=0`, `list=0`, `artefakt=0`, `reach=1` (czerwona z przyczyn niezwiązanych — pliki test-only innych, równoległych dyżurów tej rundy) | patrz `§0.3` |
| Rejestr znalezisk, ostatnia sekcja | `AM` (Dyżur 373) | `docs/program/REJESTR_ZNALEZISK_20260903.md` |

**★★ Rodzeństwo równoległe tej samej rundy.** Dyżury 374, 375, 376, 377 pracują NA TYM SAMYM
markerze `c7f8b53660`, w OSOBNYCH worktree, RÓWNOCZEŚNIE z Tobą (potwierdzone: przy pisaniu
tej instrukcji porty 6446 i 6448 były ZAJĘTE — sesje 375 i 377 aktywne). Sprawdziłem
rozłączność plików: 375 ma `CaseIntakeConfirmCard.tsx`, `MessageRenderer.tsx` i
`UnifiedChatPanel.tsx` jawnie jako „cudze tereny”/TYLKO ODCZYT w swojej własnej instrukcji —
nie koliduje z Twoim zapisem. 376 ma `UnifiedChatPanel.tsx` i `useFeatureFlags.tsx` jako
TYLKO ODCZYT (cel: zrzut, nie zmiana). 374 pracuje na kluczach i18n INNYCH niż
`aiChat.caseIntake.*`. Żaden z nich nie wspomina `chatExecutionService.ts`, `teresa.routes.ts`
ani `apiIntake.ts` — te trzy pliki są Twoje wyłącznie w tej rundzie. Mimo to: gałąź `m03` jest
WSPÓLNA i w ruchu — liczby słowników i lista reachability BĘDĄ się zmieniać niezależnie od
Ciebie, dokładnie jak w dyżurze 371.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** wystąpienia `case_intake_proposal` w całym repo, **0**
producentów; `CaseIntakeConfirmCard` ma wyłącznie akcję Potwierdź, zero „Odrzuć”; router v10
ma 5 tras case-intake, router v8 ma te same 5 + `/turn`; `MODULE_CASE_WORKSPACE` jest dziś
zamknięty w `BETA_MENU_STATUS`; `classifyIntent` jest realnym regexem PL/EN od 2026-08-11, nie
stubem; wzorzec `llmService.callStructured` istnieje w `ai.routes.ts` przy trasie
`/chat/confirm`; `onStreamDone` zapisuje metadane w dwóch miejscach w `UnifiedChatPanel.tsx`;
słowniki pl **35312**/en **33172**; bramki `focus`/`list`/`artefakt` = 0, `reach` = 1.

**Jeśli Twój pomiar przeczy którejkolwiek z tych liczb — obowiązuje TWÓJ pomiar. Status bramy
modułu w szczególności może się zmienić bez ostrzeżenia (to jest przełącznik cross-cutting,
poza Twoją licencją) — jeśli okaże się `open`, zapisz to jako WYNIK, nie sprzeczność, i
zdecyduj, czy budowa na v10 nadal ma sens (odpowiedź: TAK, bo router v10 jest i tak
prostszy/bez zależności od stanu bramy — ale zapisz fakt).**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KLIENT · TRASA · SERWIS · FLAGI · TESTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Klient, nowy wrapper API** | `src/components/CaseWorkspace/apiIntake.ts` | **★ PEŁNA LICENCJA na DOPISANIE** nowej eksportowanej funkcji (np. `autoDetectCaseFromConversation`), wzorem istniejących 5 eksportów w tym samym pliku. Zakaz zmiany istniejących 5 eksportów | Brief |
| **Klient, producent** | `src/components/AIChat/UnifiedChatPanel.tsx` (**~7600 linii**) | **★ WĄSKA LICENCJA:** wyłącznie wewnątrz `onStreamDone` (ok. l.1698-1830, zweryfikuj) — wywołanie nowego wrappera gdy flaga klienta ON, i spread wyniku do `metadata` w OBU miejscach zapisu (`addMessageToConversation` i `addChatMessage`). Zero zmian gdziekolwiek indziej w tym pliku | Brief z `plik:linia` |
| **Klient, flaga** | `src/hooks/useFeatureFlags.tsx` | **★ WĄSKA LICENCJA:** jeden nowy wpis w `DEFAULT_FLAGS`, `defaultValue: false`, wzorem `ENABLE_TERESA_MINDMAP`. Zakaz zmiany istniejących wpisów | — |
| **Klient, metadane (reużywasz, nie zmieniasz)** | `src/utils/chatPersistence.ts` (`buildPersistedAiResponseMetadata`) | **TYLKO ODCZYT** — merge robisz spreadem w miejscu wywołania w `UnifiedChatPanel.tsx`, nie zmieniasz tej funkcji | — |
| **Klient, render karty (reużywasz, nie zmieniasz)** | `src/components/AIChat/MessageRenderer.tsx` | **TYLKO ODCZYT domyślnie.** Gałąź `case_intake_proposal` (ok. l.884-897) już poprawnie renderuje kartę z właściwymi properami. **WĄSKA LICENCJA WARUNKOWA:** wolno naprawić WYŁĄCZNIE jeśli `R1` udowodni w niej realny, konkretny defekt (np. zły prop) — z dowodem w raporcie | Brief |
| **Klient, sama karta (reużywasz, nie zmieniasz)** | `src/components/AIChat/CaseIntakeConfirmCard.tsx` | **TYLKO ODCZYT** — jej kontrakt (Potwierdź, brak Odrzuć) jest DANY, nie zmieniasz go w tym dyżurze bez wpisania jako pytania w R7 | Brief |
| **Serwer, nowa trasa** | `server/src/routes/v10/teresa.routes.ts` (**380 linii**) | **★ WĄSKA LICENCJA:** wyłącznie DOPISANIE jednego nowego bloku `router.post('/case-intake/conversations/:conversationId/auto-detect', ...)`, tym samym middleware/kształtem co istniejące 5 tras obok. Zakaz zmiany istniejących 5 tras | Brief z `plik:linia` |
| **Serwer, nowa funkcja (RDZEŃ)** | `server/src/services/v8/chatExecutionService.ts` (**481 linii**) | **★ PEŁNA LICENCJA na DOPISANIE** `draftCaseWorkOrderFromConversation` (nowa funkcja, siostra `classifyIntent`, nie modyfikacja). Zakaz zmiany ciała `classifyIntent` (l.178-261) | Brief |
| **Serwer, `caseIntakeService.ts`** | `server/src/services/caseWorkspace/caseIntakeService.ts` | **★★★ TYLKO ODCZYT — BEZWZGLĘDNIE.** Plik sam dokumentuje zakaz LLM wewnątrz (musi zostać deterministyczny). Żadna litera się nie zmienia | Brief z `plik:linia`, cytat pyt. otwartego #4 |
| **Serwer, wzorzec LLM (reużywasz, nie zmieniasz)** | `server/src/routes/ai.routes.ts` (trasa `/chat/confirm`, ok. l.1386-1624) | **TYLKO ODCZYT** — `ConfirmSchema`+`llmService.callStructured` już wystarczają jako wzorzec | — |
| **Serwer, flaga** | `server/src/config/FeatureFlags.ts` | **★ WĄSKA LICENCJA:** jeden nowy wpis w `FeatureFlagsSchema` + jeden wpis w runtime-flags object, wzorem `ENABLE_TERESA_MINDMAP_SEARCH`, default OFF | — |
| **Serwer, brama modułu (reużywasz, nie zmieniasz)** | `server/src/middleware/betaGate.middleware.ts`, `Gateway.ts`, `server/src/routes/v8/chat.routes.ts` | **TYLKO ODCZYT** — świadoma decyzja: buduj na v10, omiń bramę. Zero zmian tutaj | Brief |
| **Nowe testy** | `server/src/routes/__tests__/day378.*.pg.test.ts`, `src/components/AIChat/__tests__/day378.*.test.tsx` (NOWE, `git add -f`) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`/`Z31` | — |
| **Dev-render** | `dev-render/screens/chat-case-intake-proposal.tsx` (**NOWY**) | **★ PEŁNA LICENCJA**, wzorzec `chat-split-teresa-right.tsx` (TYLKO ODCZYT jako wzorzec) | — |
| **Nowe dowody** | `evidence/day378-case-intake-producer/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; `git add -f` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja, litera sprawdzona TUŻ PRZED COMMITEM | — |
| **Słowniki, WYŁĄCZNIE nowe klucze** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **WĄSKA LICENCJA:** wyłącznie NOWE klucze pod prefiksem `aiChat.caseIntake.*` (sprawdź grepem, że prefiks nie istnieje, przed dodaniem). Zakaz zmiany istniejących kluczy | Brief |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY378_CASE_INTAKE_PRODUCER_REPORT.md` (**NOWY**) | `R7` — jedyny nowy dokument rejestrowy (`Z13`) | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł** | Rekomendacja w raporcie |
| **Materiał źródłowy** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`, `CODEX_DAY371_KARTY_PROPOZYCJI_REPORT.md`, `ODBIOR_371.md`, ledger `OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** — wejście, nie dokument do edycji | — |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia`, idziesz dalej |

**★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Plik opisany jako „PEŁNA/WĄSKA
LICENCJA” — masz pozwolenie, STOP z tytułu „nie wolno mi” jest NIEZASADNY. Plik nieopisany w
ogóle — domyślnie TYLKO DO ODCZYTU.

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (ale MOGA rosnac niezaleznie od Ciebie -- galaz wspoldzielona z 374-377)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby (chwiejne): pl 35312+, en 33172+ (rosnace, bo rownolegle pracuja 374-377)

# (b) trzy bezpieczniki MAJA konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0

# (c) reach JEST JUZ CZERWONY na markerze -- notujesz liste PO NAZWACH, nie naprawiasz
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   oczekiwane: exit 1, lista "New test-only files" rosnaca niezaleznie od Ciebie (pliki
#   rownoleglych dyzurow 374-377) -- PO Twoich zmianach lista ma zawierac DODATKOWO Twoje
#   wlasne nowe pliki testowe, nazwane jawnie w raporcie, i ZERO plikow zniknietych sprzed
#   Twojej pracy
```

**Jeżeli `focus-canon`/`list-canon`/`artefakt` zaczerwienią się OD TWOJEJ zmiany — naprawiasz
KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). **`reach` zostaje czerwony niezależnie od
Ciebie — nie jest to Twoja bramka do gaszenia w tym dyżurze.**

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | producenci `case_intake_proposal` w repo | `0` | komenda (1) z `§0.3` | TAK — `grep -rn` bez wycinania |
| 2 | akcje na `CaseIntakeConfirmCard` (przyciski/handlery) | `1` (tylko Potwierdź) | komenda (2) | TAK — czyta plik komponentu wprost |
| 3 | trasy case-intake na v10 vs v8 | `5` / `5+1` | komenda (3) | TAK |
| 4 | status bramy `MODULE_CASE_WORKSPACE` | `closed` (na dzień pisania) | komenda (4), ręczna lektura | TAK — **zweryfikuj, to jest cross-cutting i może się zmienić bez ostrzeżenia** |
| 5 | linie realnego ciała `classifyIntent` | `178`-`261` (regex PL/EN, nie stub) | komenda (5) | TAK |
| 6 | linie wzorca `llmService.callStructured` w `ai.routes.ts` | ok. `1490`-`1600` | komenda (6) | TAK — dowód, że wzorzec istnieje i jest używany gdzie indziej |
| 7 | miejsca zapisu metadanych w `onStreamDone` | `2` (`addMessageToConversation`, `addChatMessage`) | komenda (7) | TAK — **to jest `R3`, oba miejsca muszą dostać spread, inaczej karta zniknie po F5 (kształt D-3 z 371, w NOWYM kodzie)** |
| 8 | liście słowników PL/EN | rosnące, patrz wyżej | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK, wartość CHWIEJNA — licz PRZED i PO |
| 9 | `reach` exit code i lista nazw | `1`, rosnąca niezależnie od Ciebie | blok (c) | TAK — mianownik już zepsuty PRZED Tobą |
| 10 | wywołania `llmService`/mock przy fladze serwera OFF | `0` (Ty tworzysz dowód) | Twój nowy test/licznik | TAK — **to jest `R4`, dowód że OFF = zero kosztu** |
| 11 | wierszy `case_core` po nie-potwierdzeniu propozycji | `0`, nawet po refresh/drugiej turze | Twój nowy pg-test | TAK — **to jest `R5`** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/CaseWorkspace/apiIntake.ts` (nowa funkcja, dopisana) ·
`server/src/routes/v10/teresa.routes.ts` (nowa trasa, dopisana) ·
`server/src/services/v8/chatExecutionService.ts` (nowa funkcja, dopisana) ·
`src/hooks/useFeatureFlags.tsx` (nowy wpis) ·
`server/src/config/FeatureFlags.ts` (nowy wpis) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY378_CASE_INTAKE_PRODUCER_REPORT.md` (NOWY) ·
`evidence/day378-case-intake-producer/**` (NOWY) ·
`dev-render/screens/chat-case-intake-proposal.tsx` (NOWY) ·
nowe pliki testowe front i serwer.

**Zapisujesz WARUNKOWO:**
`src/components/AIChat/UnifiedChatPanel.tsx` (WYŁĄCZNIE wewnątrz `onStreamDone`) ·
`public/locales/{pl,en}/translation.json` (WYŁĄCZNIE nowe klucze `aiChat.caseIntake.*`) ·
`src/components/AIChat/MessageRenderer.tsx` (TYLKO jeśli `R1` udowodni konkretny defekt w
gałęzi `case_intake_proposal`, z dowodem) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/src/services/caseWorkspace/caseIntakeService.ts`,
`server/src/routes/v8/chat.routes.ts`, `server/src/middleware/betaGate.middleware.ts`,
`server/src/Gateway.ts`, `server/src/services/ApiGateway.ts`,
`src/components/AIChat/CaseIntakeConfirmCard.tsx`,
`src/utils/chatPersistence.ts`, `src/services/api/baseClient.ts`,
istniejące 5 eksportów `apiIntake.ts`, istniejące ciało `classifyIntent`
(`chatExecutionService.ts:178-261`), `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`
(wszystkie 16), `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**` (ten dyżur nie
tworzy migracji — schemat `case_core`/outbox jest niezmieniony), `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day378-case-intake-producer
git diff --name-only --cached | tee /private/tmp/cx-day378-case-intake-producer-artefakty/staged.txt
bash -c "grep -iE 'caseIntakeService\.ts|chat\.routes\.ts|betaGate\.middleware|Gateway\.ts|ApiGateway\.ts|CaseIntakeConfirmCard\.tsx|chatPersistence\.ts|baseClient\.ts|MODULE_ACCEPTANCE|reachability\.baseline|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day378-case-intake-producer-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- src/components/AIChat/UnifiedChatPanel.tsx | grep -c "^[+-]"
#   oczekiwane: male (jeden blok w onStreamDone) -- duzy diff = naruszenie waskiej licencji
git diff --cached -- server/src/services/v8/chatExecutionService.ts | grep -c "^[+-]"
#   oczekiwane: wylacznie DODANE linie nowej funkcji, ZERO usunietych/zmienionych linii classifyIntent
```

---

## R0 — TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Producent idzie WYŁĄCZNIE na router v10, nigdy na v8.** `caseIntakeModuleGate` na v8
jest domyślnie zamknięta dla zwykłego usera — flaga funkcyjna ON na trasie zamkniętej bramą
to flaga-fantom drugiego stopnia. Zweryfikuj status bramy SAM przed budową (komenda 4).

**(2) Zero LLM w `caseIntakeService.ts`, zawsze i bezwzględnie.** Ten plik musi zostać
deterministyczny (ten sam `workOrder` → ten sam digest, zawsze). Cała nowa logika
klasyfikacji/ekstrakcji żyje w `chatExecutionService.ts` (caller), nigdy tam.

**(3) `classifyIntent` (regex, tani) jest filtrem PRZED strukturalnym LLM, nie zamiennikiem.**
Wołaj drogi krok (LLM) tylko dla `governed_work`/`ambiguous`, nigdy dla `conversational` — to
jest jednocześnie oszczędność kosztu i bezpiecznik zgodny z filozofią samego `classifyIntent`
(cytat w jego nagłówku: „ambiguous” jest bezpieczne, bo może tylko PROPONOWAĆ, nigdy
POTWIERDZAĆ).

**(4) Metadane muszą przetrwać F5 — spread w OBU miejscach zapisu `onStreamDone`.** Jeżeli
dopiszesz `metadata.type='case_intake_proposal'` tylko do `addChatMessage` (lokalny store) a
nie do `addMessageToConversation` (trwały zapis) — albo odwrotnie — karta zniknie po
odświeżeniu strony. To jest DOKŁADNIE kształt defektu D-3 z dyżuru 371, tym razem w kodzie,
który sam piszesz. Dowód: (re)załaduj konwersację z serwera po propozycji, karta MUSI się
nadal renderować.

**(5) Awaria wywołania auto-detect NIGDY nie wywala normalnej tury czatu.** Sieć/timeout/
serwer OFF/model niedostępny = cichy `console.error`, kontynuacja bez metadanych case-intake.
Test na to jest obowiązkowy.

**(6) Dwie flagi, obie domyślnie OFF, obie realne (nie fantomy).** Dowód: flaga klienta ON +
flaga serwera OFF = zero wywołań `draftCaseWorkOrderFromConversation` (klient próbuje wywołać
trasę, serwer odmawia/zwraca `informational` bez LLM). Flaga serwera ON + flaga klienta OFF =
klient nigdy nie woła trasy. Obie ON = pełny przepływ.

**Wymagany dowód:** sześć zdań w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: POMIAR ARCHITEKTURY (rdzeń pomiarowy, obowiązkowy przed R2/R3)

Zanim napiszesz jedną linię produkcyjnego kodu, zmierz i zapisz z dowodem `plik:linia`:

1. Świeży `grep -rn 'case_intake_proposal' src server` — potwierdź **2** trafienia, zero
   producentów (albo zapisz swój wynik, jeśli inny).
2. Realny kontrakt akcji `CaseIntakeConfirmCard.tsx` — czy jest WYŁĄCZNIE „Potwierdź”, czy
   coś się zmieniło. To determinuje kształt dowodu w `R5` (brak wiersza = brak akcji, nie
   osobny stan „odrzucono”, chyba że znajdziesz inaczej).
3. Aktualny status `BETA_MENU_STATUS['MODULE_CASE_WORKSPACE']` — `open` czy `closed`. Jeśli
   `open`, zapisz to jako WYNIK (nie zmienia decyzji budować na v10 — v10 jest i tak prostszy
   i nie zależy od stanu tej bramy — ale zapisz fakt uczciwie).
4. Dokładne linie realnego ciała `classifyIntent` na TWOIM markerze — potwierdź, że to
   regex PL/EN, nie LLM, nie stub. Zacytuj 2-3 zdania z jego własnego komentarza o zamianie
   z 2026-08-11.
5. Dokładne linie `onStreamDone` w `UnifiedChatPanel.tsx` i OBU miejsc zapisu metadanych
   (`addMessageToConversation`, `addChatMessage`) — to jest punkt wpięcia dla `R3`.
6. Dokładne linie wzorca `llmService.callStructured` w `ai.routes.ts` (trasa `/chat/confirm`)
   — `modelRouter.select`, `ConfirmSchema`, wywołanie, obsługa błędu.
7. Potwierdź nazwę nowej flagi jest wolna (`grep -rn '<TWOJA_NAZWA>' server/src src` = 0
   trafień) w OBU plikach flag.

**Wymagany dowód:** tabela siedmiu wierszy (pomiar · wynik · zgodność z instrukcją TAK/NIE ·
`plik:linia`). **Commit po `R1`** (dopuszczalny commit tylko-dokumentacyjny, np. notatka w
`evidence/`, jeśli nie ma jeszcze kodu do zacommitowania).

## R2 — SERWER: `draftCaseWorkOrderFromConversation` + nowa trasa v10 (rdzeń)

1. **Nowa funkcja w `chatExecutionService.ts`** (siostra `classifyIntent`, NIE modyfikacja):
   `draftCaseWorkOrderFromConversation(message, organizationId, contextSnapshotId)` —
   wywołuje NAJPIERW `classifyIntent` (tani filtr); jeśli wynik to `conversational`, zwraca
   natychmiast `{ looksLikeNewCase: false }` BEZ żadnego wywołania LLM. W przeciwnym razie
   (`governed_work`/`ambiguous`) woła `llmService.callStructured` (wzorzec z `ai.routes.ts`
   `/chat/confirm`: `modelRouter.select`, zod schema, `systemPrompt`+`messages`) z schematem
   zwracającym `{ looksLikeNewCase: boolean, confidence: number, goal?, scope?: string[],
   expectedOutcome?, caseName? }`. Cała funkcja jest osłonięta serwerową flagą (patrz `R4`) —
   flaga OFF = funkcja zwraca `{ looksLikeNewCase: false }` NATYCHMIAST, przed jakimkolwiek
   wywołaniem `classifyIntent` czy LLM.
2. **Nowa trasa `POST /case-intake/conversations/:conversationId/auto-detect`** w
   `teresa.routes.ts`, TEN SAM kształt middleware co istniejące trasy obok (`verifyToken,
   attachV8Context, caseWorkspaceHandler(...)`). Ciało: `{ message: string, contextSnapshotId?:
   string }`. Woła `draftCaseWorkOrderFromConversation`; jeśli `looksLikeNewCase === true` i
   pola work orderu są kompletne (goal/scope/expectedOutcome niepuste), woła ISTNIEJĄCE
   `caseIntakeService.proposeConversationWorkOrder` (identyczne wywołanie jak w `/summary`) i
   zwraca `{ mode: 'work_order_proposed', workOrder, workOrderId, workOrderDigest,
   alreadyProposed, caseCreated: false }`. W przeciwnym razie zwraca `{ mode: 'informational'
   | 'work_order_required', ... }` (ZERO zapisu do `caseIntakeService` w tej gałęzi).
3. **Dowód idempotencji.** Ta sama treść rozmowy wywołana dwa razy → drugie wywołanie dostaje
   `alreadyProposed: true` z TYM SAMYM digestem (własność już wbudowana w
   `proposeConversationWorkOrder`, Ty tylko dowodzisz, że Twoja nowa trasa jej nie psuje).
4. **Dowód roli.** Test z JWT zwykłego membera (NIE OWNER/ADMIN) przechodzi przez nową trasę
   v10 bez 403 — kontrastowo, ten sam JWT na `/api/v8/chat/.../case-intake/turn` dostaje 403
   (dowód, że decyzja „buduj na v10” była słuszna, nie tylko deklaratywna).

**Wymagany dowód:** diff nowej funkcji + nowej trasy · trzy przebiegi (conversational→zero
LLM, governed_work z pewnym draftem→proposal, governed_work z niepewnym draftem→
work_order_required) z dosłownymi odpowiedziami · dowód idempotencji · dowód roli (membera
vs 403 na v8). **Commit po `R2`.**

## R3 — KLIENT: producent w `UnifiedChatPanel.tsx` (rdzeń)

1. **Nowy wrapper w `apiIntake.ts`**: `autoDetectCaseFromConversation(conversationId, message,
   contextSnapshotId)` wołający nową trasę v10, wzorem istniejących pięciu funkcji (ten sam
   `fetchWithRetry`/`getHeaders`/`handleResponse`/`toCommandFailure`).
2. **Wpięcie w `onStreamDone`**: PO obliczeniu `safeText`/`persistConversationId`, PRZED
   oboma wywołaniami zapisu, GDY flaga klienta ON: wywołaj wrapper (best-effort, `try/catch`,
   błąd = cichy `console.error` + kontynuacja). Jeśli `mode === 'work_order_proposed'`,
   zbuduj `caseIntakeMeta = { type: 'case_intake_proposal', proposal: { conversationId:
   persistConversationId, workOrder, workOrderDigest } }`.
3. **Spread w OBU miejscach zapisu**: `metadata: { ...buildPersistedAiResponseMetadata({...}),
   ...(caseIntakeMeta || {}) }` w wywołaniu `addMessageToConversation`, ORAZ analogiczny
   spread w obiekcie `metadata` przekazywanym do `addChatMessage`. Zero zmian w
   `buildPersistedAiResponseMetadata` samej (`chatPersistence.ts` zostaje TYLKO ODCZYT).
4. **Dowód przetrwania F5.** Po propozycji: (re)załaduj konwersację z serwera (symulacja
   odświeżenia — test RTL montujący `MessageRenderer`/`UnifiedChatPanel` z wiadomością
   pobraną PONOWNIE, nie z tej samej instancji) — karta `CaseIntakeConfirmCard` nadal się
   renderuje.
5. **Dowód niezawodności.** Symuluj błąd sieci/500 z nowej trasy — normalna odpowiedź Teresy
   nadal się zapisuje i wyświetla, bez wyjątku nieobsłużonego, bez utraty wiadomości.
6. **Dowód mutacyjny.** Cofnij `R3` (usuń wywołanie wrappera) — test z punktu 4 ma
   ZACZERWIENIĆ SIĘ; przywróć — ma ZZIELENIEĆ; `git diff` po cofnięciu pusty.

**Wymagany dowód:** diff wrappera + wpięcia · test przetrwania F5 (RED→GREEN) · test
niezawodności na błędzie sieci · dowód mutacyjny. **Commit po `R3`.**

## R4 — DWIE FLAGI, DOMYŚLNIE OFF, REALNE

1. Klient: nowy wpis w `DEFAULT_FLAGS` (`useFeatureFlags.tsx`), `defaultValue: false`.
2. Serwer: nowy wpis w `FeatureFlagsSchema` + runtime-flags object (`FeatureFlags.ts`),
   default `false`, czytany PER-CALL (nie cache'owany na starcie procesu) wewnątrz
   `draftCaseWorkOrderFromConversation` — wzorem `isTeresaMindmapSearchEnabled()`
   (`orgRetrievalShared.ts`, TYLKO ODCZYT jako przykład stylu, nie kopiujesz 1:1 jeśli kształt
   nie pasuje).
3. **Dowód „OFF = zero kosztu”**: z flagą serwera OFF, wywołaj nową trasę v10 z treścią
   ewidentnie opisującą nową sprawę (np. „Chcę zlecić przygotowanie planu restrukturyzacji
   działu X”) — zero wywołań `llmService`/mocka (licznik w teście), odpowiedź
   `mode: 'informational'` lub `'work_order_required'`, zero nowych wierszy w tabeli
   zdarzeń `caseIntakeService` używa (outbox/`case_intake_*` — zweryfikuj nazwę w `R1`).
4. **Dowód „obie ON = pełny przepływ”**: z obiema flagami ON, ta sama treść → `mode:
   'work_order_proposed'`, karta renderuje się w kliencie (test RTL z flagą wymuszoną ON przez
   `FeatureFlagsProvider`/kontekst testowy).

**Wymagany dowód:** cztery kombinacje flag (OFF/OFF, ON/OFF, OFF/ON, ON/ON) z dosłownym
zachowaniem każdej, w tym licznik wywołań LLM dla przypadku serwer-OFF. **Commit po `R4`.**

## R5 — PARA DOWODÓW NA REALNYM POSTGRESIE (rdzeń)

**Rola aktora we WSZYSTKICH testach tej pozycji: zwykły member organizacji, NIGDY
OWNER/ADMIN** — bo to jest dokładnie scenariusz, w którym brama modułu na v8 (gdyby ktoś
przez pomyłkę budował tam) by ukryła defekt.

1. **Fikstura minimalna**: org + zwykły member + konwersacja realna (wzorem
   `teresaProductionIntake.pg.test.ts`/`chatIntake.pg.test.ts`, TYLKO ODCZYT jako przykład).
2. **Ścieżka potwierdzenia (para dowodów)**: (a) auto-detect proponuje pracę → wiadomość z
   `metadata.type='case_intake_proposal'` → kliknięcie/wywołanie `confirmConversationWorkOrder`
   (ISTNIEJĄCE, nietknięte) → `201`, wiersz w `case_core` → (re)odczyt konwersacji z serwera →
   karta nadal pokazuje stan „utworzono”/otwiera Case (via `getCaseForConversation`,
   ISTNIEJĄCE); (b) BRAK potwierdzenia (user nie klika) → nawet po kolejnej turze rozmowy i
   odświeżeniu, ZERO wierszy `case_core` dla tej konwersacji, a druga próba auto-detect na
   TEJ SAMEJ treści zwraca `alreadyProposed: true` z TYM SAMYM digestem (nie tworzy DRUGIEJ
   propozycji).
3. **Izolacja organizacji**: aktor z organizacji B nie widzi/nie może potwierdzić propozycji
   z organizacji A (ISTNIEJĄCE `requireOrgMember`/`requireCaseAccess` w `caseIntakeService.ts`
   — dowodzisz, że Twoja nowa trasa v10 ich NIE omija, nie budujesz nowej logiki izolacji).
4. **Mutacja odwrotna**: cofnij `R2`/`R3` przez `cp` ze `SCRATCH` — nowy pg-test ma
   ZACZERWIENIĆ SIĘ; przywróć — ma ZZIELENIEĆ; `git diff` po cofnięciu pusty.

**Wymagany dowód:** dosłowne komendy i odpowiedzi obu ścieżek · odczyt `case_core` z bazy
potwierdzający (a) dokładnie jeden wiersz, (b) zero wierszy · dowód izolacji organizacji ·
dowód mutacyjny. **Commit po `R5`.**

## R6 — ZRZUTY DEV-RENDER (bez logowania Piotra, flaga OFF w produkcie)

Wzorem `dev-render/screens/chat-split-teresa-right.tsx` (montuje realny `UnifiedChatPanel`,
TYLKO ODCZYT jako wzorzec): nowy plik `dev-render/screens/chat-case-intake-proposal.tsx`
montujący realny `UnifiedChatPanel` z flagą klienta wymuszoną ON WYŁĄCZNIE w tym harnessie
(nigdy w configu produktu) i z wiadomością mockującą propozycję Case (albo realnym
wywołaniem przeciw lokalnemu serwerowi z flagą serwera ON — wybierz taniej). Zrzuty: PL i EN,
light i dark, stan „do potwierdzenia” i stan „zatwierdzono/otwórz zlecenie” — CZTERY zrzuty
minimum, zgodnie z 40-punktową listą czekowania triady jeśli dotyczy (to jest karta w
strumieniu czatu, nie ekran listowy — jeśli triada nie ma zastosowania, zapisz to w raporcie
jednym zdaniem z uzasadnieniem). Flaga zostaje `OFF` w domyślnym configu produktu — akcept
Piotra to osobny krok nadzorcy, NIE część tego dyżuru.

**Wymagany dowód:** cztery zrzuty w `evidence/day378-case-intake-producer/dev-render/`,
ścieżka pliku dev-render, potwierdzenie że flaga w produkcyjnym configu (`useFeatureFlags.tsx`
`DEFAULT_FLAGS`) zostaje `false`. **Commit po `R6`.**

## R7 — RAPORT, REJESTR ZNALEZISK, PYTANIA DO WŁAŚCICIELA

Raport zawiera: pomiar `R1` w całości · diff i dowody `R2`/`R3` · cztery kombinacje flag z
`R4` · parę dowodów `R5` (potwierdzenie/brak potwierdzenia, izolacja, mutacja) · cztery
zrzuty `R6` · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e`
dla każdego uruchomionego pakietu testów.

★★ **Osobna, obowiązkowa sekcja: „DLACZEGO v10, NIE v8”.** Cytat statusu bramy modułu
zmierzony w `R1` + dowód roli z `R2` punkt 4 (member przechodzi v10, dostaje 403 na v8).

★★ **Osobna, obowiązkowa sekcja: „KOSZT I CZĘSTOŚĆ LLM”.** Jaki odsetek próbki testowych
wiadomości trafia w `governed_work`/`ambiguous` (czyli wywołuje drogi krok) — nawet zgrubny
pomiar na testowych fikstury wystarczy, ale MUSI być zmierzony, nie zgadnięty.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** NIE MOŻE być pusta. Obowiązkowo
zawiera: (1) „Karta `CaseIntakeConfirmCard` ma dziś WYŁĄCZNIE przycisk «Potwierdź» — czy
brak jawnego «Odrzuć» jest zamierzony (user po prostu nie klika, propozycja wisi bez
skutku), czy potrzebny jest jawny stan «odrzucono», żeby karta nie wracała/nie mieszała się
w kolejnych turach rozmowy?”; (2) „Ilu-krotnie w jednej rozmowie auto-detect ma próbować
proponować Case, jeśli user zignoruje pierwszą propozycję i kontynuuje rozmowę o tym samym
temacie — raz na konwersację, czy przy każdej turze klasyfikowanej jako `governed_work`?”
(ten dyżur implementuje najprostszy bezpieczny wariant — `alreadyProposed` chroni przed
duplikatem TEJ SAMEJ treści, ale NIE chroni przed nową propozycją dla ZMIENIONEJ treści tej
samej rozmowy — opisz to wprost jako granicę tego, co zbudowałeś).

★ Zanim dopiszesz cokolwiek do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę TUŻ PRZED
COMMITEM: `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
— piszą równolegle inni autorzy tej samej rundy (374-377).

**Commit po `R7`.**

## Próg odbioru

**Producent działa end-to-end za dwiema fladami domyślnie OFF:** rozmowa opisująca nową
sprawę, po realnej turze Teresy na `/chat`, z obiema flagami ON, produkuje wiadomość z
`metadata.type='case_intake_proposal'`, która PRZETRWA odświeżenie strony. Kliknięcie
„Potwierdź” tworzy DOKŁADNIE jeden wiersz `case_core`, trwały po odświeżeniu. Brak kliknięcia
= zero wierszy, nawet po kolejnej turze. Zwykły member (nie admin) ma pełny dostęp — dowód
kontrastowy z 403 na v8. `caseIntakeService.ts` pozostaje bajtowo identyczny z markerem.
Obie flagi domyślnie OFF w kodzie wydanym. Cztery zrzuty dev-render dostarczone. Sekcja
„PYTANIA DO WŁAŚCICIELA” niepusta.

Odbiorca odrzuci dyżur, w którym: producent zbudowany na trasie v8 za bramą modułu (dowód
403 dla zwykłego usera z fladze ON); `caseIntakeService.ts` zmieniony w jakikolwiek sposób;
metadana dopisana tylko do jednego z dwóch miejsc zapisu w `onStreamDone` (karta znika po
F5); flaga serwera ON generuje wywołania LLM nawet dla wiadomości `conversational`; flaga
którejkolwiek strony domyślnie ON w wydanym kodzie; brak dowodu na realnym PostgreSQL z rolą
zwykłego membera; sekcja pytań pusta.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R1 zmierzony w całości (brama
modułu: closed, classifyIntent: realny regex, punkt wpięcia: onStreamDone dwa miejsca), R2/R3
zbudowane i połączone, R4 obie flagi OFF z dowodem zero-kosztu, R5 para dowodów na realnym PG
z rolą membera, R6 cztery zrzuty dostarczone” — **jest pełnowartościowym wynikiem**, nawet
jeśli zatrzymasz się po R5 z R6/R7 do dokończenia w kolejnej sesji (zapisz to jawnie w pliku
postępu).

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek
NA BIEŻĄCEJ LINII, nie ponownie na starym markerze. Status bramy `MODULE_CASE_WORKSPACE` w
szczególności — sprawdź go na nowo, mógł się zmienić. Liczby słowników i lista reachability —
ta gałąź jest w ruchu (374-377 równolegle), licz na nowo.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Zbuduj producenta na istniejącym `caseIntakeService`” vs „zero LLM w `caseIntakeService.ts`” | `R2`: nowa funkcja ekstrakcji żyje w `chatExecutionService.ts` (caller), `caseIntakeService.ts` woła się identycznie jak dziś, z gotowym `workOrder` |
| „Teresa ma rozpoznawać z treści rozmowy” vs „minimalizuj koszt LLM” | `R2` punkt 1: `classifyIntent` (regex, darmowy) jako filtr PRZED strukturalnym LLM; LLM tylko dla `governed_work`/`ambiguous` |
| „Producent ma działać dla realnego usera” vs „istniejąca trasa `/case-intake/turn` już woła `classifyIntent`” | `R1`/`R0.1`: `/turn` stoi za bramą domyślnie zamkniętą — nowa trasa idzie na v10 (bezwarunkowy), nie rozszerza v8 |
| „Metadana ma przetrwać F5” vs „dwa niezależne miejsca zapisu w `onStreamDone`” | `R3` punkt 3: spread w OBU miejscach, dowód (re)odczytu z serwera w punkcie 4 |
| „Nowy ekran wymaga flagi” vs „backend ma działać dla dowodów R5 na realnym PG” | `R4`/`R5`: testy PG wołają trasę bezpośrednio z flagą serwera wymuszoną ON w env testu — produkt wydany ma obie flagi OFF, to się nie wyklucza |
| „Karta ma stan „odrzucono”” (założenie z brief nadzorcy) vs „karta ma dziś wyłącznie Potwierdź” | `R1` pkt 2 + `R7`: zmierzony realny kontrakt karty, „odrzucenie” = brak wiersza po nieskończonym czasie, NIE osobny stan UI; pytanie do właściciela wpisane wprost |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą 374-377” | `R7`: literę sprawdzasz komendą tuż przed commitem |
| „Zmierz liczby z instrukcji” vs „gałąź współdzielona z czterema równoległymi dyżurami” | „Zmierz moje liczby sam”: dla słowników/reach liczy się WŁASNY świeży pomiar |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki `plik:linia` sprawdzone `grep -n`/`sed -n` na worktree z markera `c7f8b53660`; nowa trasa/funkcja/plik dev-render/pliki testowe jawnie oznaczone NIE ISTNIEJĄ |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy, wszystkie zmierzone przy wydaniu poza wierszami 10-11 (jawnie oznaczone „Ty tworzysz dowód”) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — klient (wrapper/producent/flaga/metadane/render/karta) · serwer (trasa/funkcja/serwis-zakaz/wzorzec-odczyt/flaga/brama-odczyt) · testy · dev-render · dowody · rejestr · słowniki · raport · macierz · materiał źródłowy · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R2` dotyka wyłącznie `chatExecutionService.ts` (nowa funkcja) + `teresa.routes.ts` (nowy blok); `R3` wyłącznie `apiIntake.ts` (nowa funkcja) + `UnifiedChatPanel.tsx` (`onStreamDone`); `R4` dwa pliki flag; `R5`/`R6` tylko nowe pliki |
| 6 | Przydział zasobów wyłącznych sprawdzony wobec dyżurów równoległych | TAK — 6449/5589 wolne (`lsof` przy wydaniu, 6446/6448 zajęte przez 375/377 potwierdzone), brak kontenera/worktree `cx-day378`/`codex/day378-*`; sprawdzone grepem że 374-377 NIE deklarują zapisu do `chatExecutionService.ts`/`teresa.routes.ts`/`apiIntake.ts` |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — cztery pułapki w `PULAPKA_WLASCIWA_TEMU_MODULOWI`: brama modułu cichym blokerem, stary komentarz `caseIntakeService.ts` nieaktualny, dwa miejsca zapisu metadanych, częstość `ambiguous` a koszt LLM |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów spoza repo; każdy kontekst ma ścieżkę albo komendę |
| 10 | Klauzula sprzeczności obecna, zero pól szablonu | TAK — kontrola generatora przy wydaniu: zero pozostałych niewypełnionych pól szablonu |

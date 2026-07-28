# HANDOFF — Program „Materiały" R0→R1, 2026-07-24

> Piotr odracza testy do **niedzieli wieczorem** (wraca z kajaków). To jest
> PEŁNE przekazanie sesji — czytaj od góry, nic nie zakładaj z pamięci.

## 0. TL;DR (30 sekund)

Moduł Materiały (dokumenty/prezentacje/arkusze) miał rozjazd między tym co
widać a tym co realnie działa. Zrobiłem: (1) **audyt R0** całej prawdy kodu,
(2) **R1 = naprawa** zawężona przez architekta do JEDNEGO wycinka — format
DOKUMENT — „Z szablonu" wreszcie przekazuje prawdziwy blueprint zamiast go
gubić. **Wdrożone na demo**, 63/63 testów, self-audit zgodności zrobiony
dwukrotnie. **Piotr jeszcze NIE klikał na żywo** — testy w niedzielę wieczorem.
Deck/arkusz/menu/flagi = świadomie poza zakresem, następna fala.

## 1. Chronologia dnia (3 fale pracy)

### Fala 1 (rano) — wejście do Materiałów, format→tryb
Piotr nie mógł wejść testować module Materiały w ogóle. Zbudowałem wspólny
launcher „Dodaj": KROK1 format (Dokument/Prezentacja/Arkusz) → KROK2 tryb
(Czysto/Z AI/Z szablonu), analogiczny do istniejącego wzorca w ID. Plus most
`document_studio_templates`→Biblioteka i endpointy klonowania Word/Excel.
**Wdrożone na demo `876ca16679`.** ★Później R0 wykazał, że ten most karmił
martwą ścieżkę (`deliverableTemplateService`/`OutputsLauncherModal`, odpięty
komponent) — realną naprawę widoczności zrobiła dopiero Fala 3 (backfill do
`v8_artifact_origin_links`). Sam launcher (Czysto/Z AI) działa i jest żywy.

### Fala 2 — audyt R0 (read-only, zero zmian kodu)
Na żądanie Piotra: „daj mi wejście, ale najpierw prawda, nie kolejny
generator". Metoda: 5 równoległych czytelników kodu (worktree = HEAD demo)
+ SELECT-only sondy do żywej bazy demo (trolley, NIE prod centerbeam).
Wynik = pełny raport (6 przepływów × 11 kolumn + audyt Template Library),
**NIE zapisany jako plik w repo** — istnieje tylko w transkrypcie tej sesji.
Kluczowe ustalenia (zapamiętaj, bo dokument źródłowy zniknie z kontekstu):

- **Dokument**: rdzeń działa (`wave5_artifacts`, `generate/stream`, eksport
  docx realny). `blank` = obejście przez `generate` z `useLlm:false`, nie
  osobny handler. `from_template` REALNIE działał już przed R1 — ale tylko
  przez własne wejście `/document-studio?entry=template`, NIE przez KIMI/czat.
- **Prezentacja**: `blank` = prawdziwie pusty `POST /decks`. `from_template`
  NIE kopiuje `outline_json` do kart — tylko seeduje AI promptem. Osobny,
  równoległy silnik `/presentations/wizard` (split-brain ryzyko).
- **Arkusz**: 7 modeli parametrycznych to KOD (`WORKBOOK_TEMPLATES`), nie
  rekordy DB — szablonów użytkownika dla Excela NIE MA. Zero edycji komórek
  w apce (tylko podgląd). Cichy fallback reopen→Table Studio przy 404.
- **★★★ NAJWAŻNIEJSZE ustalenie R0.2 (Template Library)**: widoczna zakładka
  Biblioteka czyta z `v8_artifact_origin_links` przez
  `GET /api/artifacts?artifactFamily=template` (hook `useTemplates()` w
  `useRapData.ts`) — **NIE** z `deliverableTemplateService`/
  `/api/deliverables/templates`, ta ścieżka karmi wyłącznie martwy, odpięty
  `OutputsLauncherModal`. Backfill do widocznego indeksu pokrywał TYLKO
  report+presentation — `document_studio_templates` (44 zatwierdzone
  szablony) i sheet były niewidoczne mimo istnienia. Bug główny: `templateId`
  wybrany w Bibliotece był **po cichu porzucany** w
  `POST /api/artifact-runs/from-chat` (serwer w ogóle nie czytał tego pola z
  body) — generator dostawał tylko opis tekstowy, nie strukturę.

### Fala 3 — R1.0 propozycja → odbiór architekta → implementacja → P1 fix → samoaudyt
Architekt (Codex, osobna sesja) przeczytał R0 i wydał
`docs/product/MATERIALS_R0_ARCHITECT_DECISIONS_2026-07-24.md`: decyzje D1-D6
+ (po mojej propozycji kontraktu) **§6 „Odbiór propozycji R1.0"** z 7
obowiązkowymi korektami i 6 punktami DoD — **to jest dokument, którym mierz
każdą przyszłą zmianę w tym programie, przeczytaj go w całości, nie tylko ten
handoff.** Zaimplementowałem, architekt odrzucił pierwszą wersję (P1: martwy
kod), naprawiłem, zrobiłem samoaudyt tą samą metodą i znalazłem drugi taki
przypadek u siebie, naprawiłem, wdrożyłem na demo. Szczegóły w sekcji 3 niżej.

## 2. Dokumenty źródłowe — kolejność czytania

1. `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md` —
   kanon docelowy (Menu 2 = 5 pozycji, kontrakt `{entity,format,start,
   templateId}`, szablon = blueprint bloków nie skórka).
2. `docs/product/MATERIALS_RESUSCITATION_PROGRAM_2026-07-24.md` — plan R0→R4,
   role: architekt=Codex, wykonawca=Claude.
3. `docs/product/MATERIALS_R0_ARCHITECT_DECISIONS_2026-07-24.md` —
   **NAJWAŻNIEJSZY.** §2 = D1-D6. §6 = 7 korekt + 6 DoD (patrz sekcja 3).
4. Ten plik — chronologia + stan + prompt dla następcy.
5. Raport R0 pełny — TYLKO w transkrypcie tej sesji konwersacji Claude, nie w
   repo. Jeśli potrzebny w pełni (nie tylko streszczenie z §1 wyżej), trzeba
   go odtworzyć z historii sesji albo powtórzyć audyt.

## 3. Co jest ZROBIONE i NA DEMO (Fala 3 — R1 slice „dokument")

**Stan pushu:** `origin/demo` ← **`3cd6075ee6`** (mój ostatni push tej fali;
demo poszło dalej pod innymi sesjami PO tym punkcie — normalne, sprawdź
`git log --oneline -1 origin/demo` na starcie następnej sesji, nie ufaj temu
hashowi jako "aktualnemu"). Rollback point sprzed mojego pushu: **`206f5677fd`**.
Gałąź robocza: `materialy/r11-doc-slice`, worktree `/private/tmp/r11-doc-slice`
(może już nie istnieć w nowej sesji — odtwórz: `git worktree add ... -b
materialy/r1x-... origin/demo`, ZAWSZE świeża gałąź od `origin/demo`, nigdy
force).

### 14 non-merge commitów slice'u (chronologicznie)
```
19b8111629 origin_runtime 'document_template' — migracja CHECK + enum TS
21f1a34a50 adapter document_studio_templates do indeksu + pomiar osieroconych
46967fe8ef serwerowy resolver blueprintu dokumentu (creationIntent)
3929422088 SSOT typów szablonów (src/types/materials.ts) + kanon scope/status
6fea2c6501 mapper indeksu rozdziela id indeksu od kanonicznego id szablonu
ba2e84bda0 "Użyj wzorca" dla DOKUMENTU trafia w Document Studio Mode 3
7be8592ad2 Biblioteka wzorców — jawne "Legacy" i uczciwy stan osieroconego
7166f7df9d odbiór ?templateId= — realna preselekcja Mode 3
21a53da311 harness Biblioteki wzorców (dev-render)
cd66e26db1 test(materials): kontrakt Biblioteki — rozdział tożsamości
4554d37010 fix gate SYSTEM org w Mode 3 + dowód DoD sectionBlueprint→draft
d9dce52817 ★ P1 (odbiór architekta): resolver dostaje produkcyjnego callera
d991f042dc ★ samoaudyt: pomiar osieroconych też był martwym kodem — naprawiony
32baf8fe9b polskie komunikaty stanu blokującego + harness zrzutu
```

### Kontrakt (zablokowany przez architekta — nie zmieniaj pól bez nowej decyzji)
```ts
type TemplateScope = 'system'|'organization'|'personal'|'unknown';   // ZAKAZ 'application'
type TemplateStatus = 'approved'|'published'|'draft'|'deprecated'|'unknown';
type TemplateOriginRuntime = 'document_template'|'report_template'|'presentation_template'|'sheet_template';
type TemplateSource = 'canonical'|'legacy';
type TemplateRef =                                    // SUMA ROZŁĄCZNA, nie luźny obiekt
  | { kind:'library'; templateArtifactId: string }
  | { kind:'internal'; canonicalTemplateId: string; originRuntime: TemplateOriginRuntime };
```
Pliki: `server/src/services/materials/templateContract.ts` (BE, słownik +
normalizatory), `src/types/materials.ts` (FE SSOT). Resolver:
`server/src/services/materials/creationIntent.ts` →
`resolveDocumentTemplateForCreation` (reużywa istniejący
`getRegisteredTemplate` z Document Studio, NIE nowy parser blueprintu).
Endpoint: `POST /api/document-studio/templates/resolve`
(`server/src/routes/document-studio.routes.ts`).

### Przepływ „Użyj wzorca" (dokument) — jak działa DZIŚ
```
Klik w Bibliotece (kebab wiersza, format=document, origin=document_template)
  → URL: /document-studio?entry=template&templateArtifactId=<ID INDEKSU>
    (★ NIGDY canonical id w URL — to był błąd P1, patrz niżej)
  → DocumentStudioView wysyła POST /document-studio/templates/resolve
    {templateArtifactId} (org z auth, NIE z body)
  → serwer: rozwiązuje origin_runtime + canonical record + org/scope/status/orphan
  → zwraca WYŁĄCZNIE {canonicalTemplateId,...} — blueprint zostaje na serwerze
  → Mode 3 preselekcjonuje tym id → generacja czyta sectionBlueprint ŚWIEŻO
    z rejestru document_studio_templates w momencie generowania
```
Odrzucenie (orphaned/forbidden/deprecated/not_indexed) = stan BLOKUJĄCY po
polsku, przycisk powrotu do Biblioteki. Zero cichego fallbacku do pickera
albo do AI — to był twardy wymóg architekta (korekta #4 w §6).

### ★★★ DWIE LEKCJE METODYCZNE (zapamiętaj na cały dalszy ciąg programu)

**1. Martwy kod przechodzi testy jednostkowe.** Pierwsza wersja: zbudowałem
`resolveDocumentTemplateForCreation` z pełnym testem jednostkowym — ale
architekt sprawdził realny przepływ i znalazł, że **żaden produkcyjny kod go
nie wołał**. URL niósł `canonicalTemplateId` bezpośrednio jako parametr od
klienta (niezweryfikowany wskaźnik prosto do generatora — problem
bezpieczeństwa, nie tylko martwy kod). Naprawiłem (`d9dce52817`), a potem
**tą samą metodą** (grep każdego nowego eksportu → czy ma callera w
`server/src/routes/` lub `src/`) znalazłem SAM u siebie drugi przypadek:
`countOrphanedTemplateLinks` — wyeksportowany, przetestowany, **zero
wywołań** (`d991f042dc`). **Reguła na resztę programu: każdy nowy eksport
musi mieć callera w ścieżce PRODUKCYJNEJ (route/entry point). Dowód = test
uderzający w to wejście, NIE test samej funkcji w izolacji.**

**2. Strażniki (`check-triada.sh` itp.) bywają fałszywie zielone.** W tej
samej sesji inna równoległa praca naprawiła bug: strażnik zwracał „OK" przy
**zero sprawdzonych plików** na czystym drzewie (commit `5b34b9dcde`) —
czyli moje wcześniejsze „check-triada: OK" w tej sesji było puste, nie
prawdziwym przejściem. **Zawsze patrz na LICZBĘ sprawdzonych plików w
wyjściu strażnika. Jeśli jej nie ma albo wynosi 0 — nie ufaj, zrób
bezpośredni `grep` sam.**

### Pre-existing blocker naprawiony po drodze (nie był w oryginalnym zakresie)
`isTemplateUsableForGeneration` (`documentTemplateService.ts`) wymagał
ścisłej równości `organizationId`, mimo że `getTemplate` **celowo**
udostępnia katalog SYSTEM każdemu najemcy (komentarz w kodzie to
potwierdzał) — efekt: **44 z 45 szablonów dokumentu na demo (systemowe)
padały na `template_not_usable`** w Mode 3, czyli dokładnie te rekordy,
które Biblioteka pokazuje. Bez tej poprawki DoD architekta (draft ma sekcje
z `sectionBlueprint`) byłby nieosiągalny dla realnych danych demo. Poprawione
minimalnie (dopuszczona też org SYSTEM, cross-tenant nadal niemożliwy —
pilnuje istniejący test regresyjny).

### Weryfikacja (zrobiona DWA razy niezależnie — przy buildzie i w osobnym samoaudycie)
- **63/63 testów** zielonych, 6 plików, świeży przebieg na aktualnym HEAD demo
  w momencie kończenia tej fali.
- Wszystkie **7 obowiązkowych korekt** + **6 punktów DoD** z §6 architekta
  sprawdzone z dowodem plik:linia (metoda: dokładna lista 14 non-merge
  commitów wyizolowana `git log --no-merges --first-parent`, NIE przez diff
  baz branchy — pierwsza próba tą drugą metodą dała fałszywą kontaminację
  cudzymi zmianami z merge'y demo).
- Bezpośredni grep crimson/`primary-*` na wszystkich 18 plikach produkcyjnych
  slice'u — zero naruszeń (strażnik `check-artefakt`/`check-triada` NIE był
  użyty do tego wniosku, patrz lekcja #2 wyżej).
- Render-verify mój (reguła CLAUDE.md #7): harness
  `dev-render/screens/document-studio-template-resolve-error.tsx`, montuje
  REALNY `DocumentStudioView` z podstawioną tylko warstwą sieciową. Zrzuty
  light+dark stanu blokującego zrobione i obejrzane PRZEZE MNIE, PRZED
  Piotrem — zgodnie z regułą.
- **Piotr NIE klikał jeszcze na żywo na demo.** To jest jedyna warstwa
  weryfikacji, która nie została zrobiona. Testy przełożone na niedzielę
  wieczorem 2026-07-27 (albo najbliższa niedziela od daty czytania tego
  pliku — sprawdź datę).

## 4. Co jest ŚWIADOMIE ODŁOŻONE (decyzje architekta, nie luki)

| Odłożone | Kiedy/gdzie wraca |
|---|---|
| Adapter decka do „Z szablonu" (analogiczny wzorzec co dokument) | R1, kolejna iteracja |
| Prawdziwy workbook template registry (szablony Excela tworzone przez usera) | Osobny pakiet po R1, przed pełnym R3 arkusza |
| `artifact-runs/from-chat` (KIMI ścieżka Word/Sheet, gdzie `templateArtifactId` nadal ginie) | Adapter deckowy, świadomie NIE zaimplementowany w tej fali |
| Menu 2 → 5 typów, `deckArchitectFlag` default OFF, zdjęcie „Excel" z sidebara | R2 (D6 architekta — zmiana UX, nie w R1) |
| Kasowanie osieroconych linków `v8_artifact_origin_links` | Osobna decyzja po okresie obserwacji — dziś TYLKO wykrywanie+pomiar, zero DELETE |
| `tp_base_templates` jako źródło szablonów Excela w Bibliotece | NIGDY (D5 architekta — to dane Table Studio, nie katalog Excela) |
| Nazewnictwo 7 modeli Excela jako „Workbook models" (nie „szablony") w UI | R1.3, nieimplementowane |

## 5. Stan odbioru

**Testy Piotra na żywo: ODROCZONE do niedzieli wieczorem** (wraca z kajaków).
Do tego momentu jedyna weryfikacja to moja własna (sekcja 3, „Weryfikacja").
**Następca: gdy Piotr wróci z feedbackiem, zacznij od przetworzenia go —
rozdziel na (a) prawdziwe bugi w TYM slice [dokument] do naprawy od razu, vs
(b) rzeczy poza zakresem R1 [deck/menu/flagi] które idą do kolejki R1.1/R2 —
i zgłoś mu które jest które PRZED napisaniem kodu.**

## 6. Prompt dla następcy (wklej na start nowej sesji)

```
Kontynuuję program "Materiały" w Consultify (dokumenty/prezentacje/arkusze +
ich szablony). To NIE jest nowy temat — jest już zaawansowana implementacja
na demo, czekająca na testy Piotra. Przeczytaj w tej kolejności, w całości,
zanim cokolwiek zrobisz:

1. Harvard/wdrozenie-100/_HANDOFF_MATERIALY_R1_2026-07-24.md — TEN plik.
   Zawiera pełną chronologię (3 fale pracy tego dnia), stan na demo, dokładny
   kontrakt, dwie lekcje metodyczne którymi mierzysz swoją własną robotę,
   i sekcję 5 z ewentualnym feedbackiem Piotra jeśli już przetestował.
2. docs/product/MATERIALS_R0_ARCHITECT_DECISIONS_2026-07-24.md — CAŁY plik,
   zwłaszcza §6 "Odbiór propozycji R1.0" (7 obowiązkowych korekt + 6 DoD).
   To jest kontrakt jakości dla KAŻDEJ zmiany w tym programie, nie tylko dla
   fali którą opisuje ten handoff.
3. docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md —
   kanon docelowy, żebyś rozumiał DOKĄD to zmierza, nie tylko co już jest.

Stan faktyczny: gałąź "materialy/r11-doc-slice" (albo jej następczyni) była
wypchnięta na origin/demo w punkcie 3cd6075ee6 (rollback: 206f5677fd) — ALE
demo jest ruchomym celem, inne sesje pchają równolegle. Zrób
`git fetch origin demo && git log --oneline -1 origin/demo` na starcie i
NIE zakładaj że handoff opisuje aktualny stan hash-po-hash — opisuje TREŚĆ,
którą powinieneś tam znaleźć.

Jeśli sekcja 5 handoffu ("Stan odbioru") ma już wypełniony feedback Piotra —
zacznij od jego przetworzenia: co jest realnym bugiem w slice'u DOKUMENTU
(napraw od razu, mały krok, świeża gałąź od origin/demo) vs co jest spoza
zakresu R1 (deck/arkusz/menu/flagi — nie ruszaj, zanotuj do kolejki R1.1/R2 i
zapytaj o priorytet zamiast zgadywać). Jeśli sekcja 5 jest PUSTA — Piotr
jeszcze nie testował, zapytaj go czy chce żebyś czekał, czy żebyś ruszył
dalej z kolejną świadomie-odłożoną częścią (sekcja 4 handoffu) pod jego
nadzorem.

Twarde zasady tego konkretnego programu (dodatkowe ponad CLAUDE.md, nie łam
bez nowej pisemnej decyzji architekta w docs/product/):
- TemplateRef = suma rozłączna {kind:'library',templateArtifactId} |
  {kind:'internal',canonicalTemplateId,originRuntime} — NIGDY luźny obiekt z
  dwoma opcjonalnymi polami identyfikatora.
- scope: 'system'|'organization'|'personal'|'unknown' — ZAKAZ 'application'
  jako wartości WYJŚCIOWEJ (jako wejście do normalizacji OK, musi mapować na
  'system').
- Indeks Template Library (v8_artifact_origin_links, czytany przez
  GET /api/artifacts?artifactFamily=template) NIGDY nie niesie blueprintu
  jako źródła generacji — to tylko metadane do WIDOKU. Resolver zawsze czyta
  świeżo z rejestru kanonicznego formatu w momencie generowania.
- Zero kasowania osieroconych linków bez osobnej, nowej decyzji architekta —
  tylko wykrywanie i pomiar (SELECT-only).
- ★ KAŻDY nowy eksport musi mieć realnego callera w ścieżce PRODUKCYJNEJ
  (route albo komponent-wejście), nie tylko w teście. Udowodnij to testem
  który uderza w to wejście (np. supertest na route), NIE testem samej
  funkcji w izolacji. Dwa razy w tej samej fali martwy kod przeszedł testy
  jednostkowe zanim to złapano — raz przez architekta, raz przeze mnie w
  samoaudycie tą samą metodą.
- Świeża gałąź per krok z origin/demo (fetch+merge, NIGDY force-push, NIGDY
  rebase na demo). Pre-flight (git fetch + merge-base --is-ancestor) TUŻ
  PRZED każdym pushem, bo demo rusza się pod innymi sesjami w trakcie twojej
  pracy — złapałem to dwa razy w tej fali (76 i potem jeszcze 1 cudzy commit
  doszły MIĘDZY moimi krokami weryfikacji a pushem).
- Render-verify (zrzut z dev-render harness, realny komponent + podstawiona
  tylko sieć) PRZED pokazaniem czegokolwiek Piotrowi, zawsze — reguła #7
  CLAUDE.md. Wzorzec harnessu: dev-render/screens/document-studio-template-
  resolve-error.tsx.
- Nie ufaj strażnikom (check-triada.sh itp.) jeśli output nie pokazuje liczby
  sprawdzonych plików > 0. Były przypadki fałszywej zieleni w tym repo. Gdy
  w wątpliwości — bezpośredni grep na plikach które faktycznie zmieniłeś.

Zacznij od: (1) fetch aktualnego stanu demo, (2) przeczytania sekcji 5 tego
handoffu, (3) jeśli jest feedback Piotra — sklasyfikowania go i zapytania o
priorytet PRZED napisaniem jakiegokolwiek kodu. Jeśli feedbacku brak — zapytaj
Piotra co robić dalej zamiast zgadywać zakres.
```

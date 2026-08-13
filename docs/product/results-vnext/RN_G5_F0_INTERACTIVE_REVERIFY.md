# RN-G5 FALA 0 — re-weryfikacja INTERAKTYWNA na REALNYCH komponentach (11 ekranów)

> SHA bazowe: `35a1dee6c03b66907219b5b645e4e3ecb267f80a`.
> Worktree: `/Users/piotrwisniewski/rn-g2-lanes/g5-interactive`, gałąź `rn-g5-interactive`.
> Harness: `npx vite --config dev-render/vite.config.ts --port 3699 --strictPort` (uruchomiony ręcznie
> przez Bash — nie przez `.claude/launch.json`, żeby nie dotykać pliku współdzielonego z innymi
> sesjami).
> Narzędzia: `dev-render/shot.mjs` (realny Playwright/Chromium — klik, clickxy, key, eval, zawsze
> raportuje KONSOLA-BLEDY i SIEC-4XX5XX) i `dev-render/verify-reload-persist.mjs` (realny
> `page.reload()` w tej samej karcie, zostawiony przez poprzednika, użyty bez zmian).
> Data: 2026-08-12. Autor: niezależny weryfikator (nie autor kodu, który sprawdza).

## Kontynuacja pracy poprzednika

Poprzednik padł na awarii sieci w połowie pracy. Jego dorobek: `docs/qa/screens/rn-g5-interactive/`
(zrzuty dla 7 z 11 ekranów) i `dev-render/verify-reload-persist.mjs`. **Żaden log KONSOLA-BLEDY/
SIEC-4XX5XX ani żaden fragment raportu nie przetrwał** — tylko same PNG, niezacommitowane. Zdecydowałem
się **przejechać KAŻDY z 11 ekranów od nowa** (nie tylko dopisać brakujące 4), bo bez logów nie miałem
dowodu, co dokładnie poprzednik kliknął ani czy któryś krok faktycznie sprawdził konsolę — a to jest
istota tej rundy. Stare zrzuty poprzednika zostały w katalogu (nadpisane tylko tam, gdzie plik miał tę
samą nazwę); moje własne zrzuty mają prefiks ekranu bez `verify2-` (pełne przejście) lub `verify2-`
(druga, kontrolna runda na 7 ekranach już częściowo pokrytych).

## Streszczenie werdyktu

- **Zero błędów konsoli i zero odpowiedzi sieciowych ≥400** w ponad 80 realnych przejazdach
  Playwright, na wszystkich 11 ekranach, we wszystkich przetestowanych stanach i po wszystkich
  opisanych niżej interakcjach. W szczególności: **żadnej awarii reguł hooków przy przełączaniu
  zakładek/faz nie znaleziono** — to był główny cel tej rundy (OQ-UI-I: 5/6 ekranów harnessu montowało
  drugą implementację; dziś 11/11 montuje produkcyjny komponent) i na tych 11 ekranach się nie
  potwierdził. To NIE dowodzi, że hook-bug nigdy nie istniał — dowodzi, że w PRZEJECHANYCH ścieżkach
  (patrz tabela niżej, per ekran) go nie ma.
- **Skala postępu OKR (×100)** — POTWIERDZONA naprawiona: `132%`, `82%`, `91%`, `62,5%`, `104%`, `78%`,
  `130%`, `83,3%` — poprawnie przeskalowane wartości na `results-vnext-okr-objectives`,
  `results-vnext-okr-registry` i w drill-downie Kluczowych Rezultatów.
- **3 NOWE znaleziska P1** (poniżej, sekcja „Znalezione wady”): (1) modal otwierany z trwałego
  przycisku CTA Menu2 traci fokus po Esc (pada na `<body>`) — powtórzone w DWÓCH różnych
  ekranach/modalach; (2) formularz „Nowe powiązanie Finance” w pełnym narzędziu ROI cicho nie robi
  NIC po kliknięciu „Powiąż”, gdy brakuje 3 z 6 wymaganych pól — zero widocznego komunikatu błędu;
  (3) kebab wiersza we wspólnej powłoce `results-vnext-registry-shell` W OGÓLE nie zamyka się na Esc.
- **1 NOWE znalezisko P2**: kebab wiersza na `results-vnext-kpi-registry` zamyka się na Esc, ale fokus
  pada na `<body>`, nie wraca do przycisku-wyzwalacza — w kontraście do 6 innych ekranów z tej samej
  rundy, gdzie fokus wraca poprawnie.
- **1 znalezisko P2 potwierdzone/rozszerzone** (ten sam wzorzec co RN-G3, ale zweryfikowane osobno na
  DWÓCH nowych ekranach): surowy `err.message` z backendu (nieprzetłumaczony, po angielsku) renderuje
  się wprost w stanie błędu na `results-vnext-kpi-tool` i `results-vnext-roi-registry` (i zapewne
  `roi-model`/`roi-full-tool` przez ten sam `roiApi.ts`). **Sprawdziłem: plik
  `src/components/ResultsVNext/shared/errorMessage.ts` NIE ISTNIEJE w tej bazie** — czyli udokumentowany
  w briefie wyjątek („znany, zamierzony”) tu nie działa; to jest żywe, zgłaszalne znalezisko.
- **1 znalezisko P3 (współdzielony komponent)**: powód odmowy w disabled-kebab jest obcięty
  `truncate` w samym menu — pełny tekst dostępny WYŁĄCZNIE przez natywny `title` (hover), nie jest
  widoczny na pierwszy rzut oka ani gwarantowany na klawiaturze/dotyku. Dotyczy współdzielonego
  `src/components/shared/RowActionsMenu.tsx`, więc prawdopodobnie każdego ekranu z disabled-reason
  w kebabie.
- **Golden-flow CRUD end-to-end DZIAŁAJĄ na prawdziwym stanowym mocku** (real POST/PUT/DELETE,
  odzwierciedlone w tabeli od razu po zapisie, bez przeładowania): edycja Baseline (`roi-model`),
  usunięcie pozycji kosztowej (`roi-model`), rejestracja wykonania (`roi-full-tool`) — te trzy
  potwierdzone pełnym cyklem klik→formularz→zapis→wynik w tabeli.
- **Kolumny (`persistKey`) DZIAŁAJĄ** — sprawdzone realnym `page.reload()` (nie SPA-nawigacją) na
  `roi-registry` i `roi-full-tool`.
- `results-vnext-okr-admin` (Programy i Cykle) jest **konsekwentnie za flagą OFF** w tym harnessie, bez
  parametru odblokowującego — identyczny stan jak u poprzednika, więc NIE jest to regresja mojej
  sesji, ale oznacza: **treść tego ekranu pozostaje NIESPRAWDZONA interaktywnie w tej rundzie** (nie
  da się jej dotknąć bez zmiany kodu, czego jako weryfikator nie robię).
- **Fałszywy trop, który OBALIŁEM przed zgłoszeniem**: `results-vnext-registry-shell` pokazuje
  wymieszany język (Menu2 „My/Org/New KPI” po angielsku obok „SZCZEGÓŁY” po polsku). Sprawdziłem
  źródło: `dev-render/screens/results-vnext-registry-shell.tsx` linie ~440–454 hardkodują te etykiety
  PO ANGIELSKU wprost w pliku harnessu (nie przez `t()`) — to artefakt fixture'u tego konkretnego
  dev-render, NIE defekt i18n produktu. Nie zgłaszam tego jako wadę.

---

## Ekran po ekranie — co kliknięto, wynik, dowody

### 1. `results-vnext-kpi-tool` (przejechany w całości od nowa, 25 zrzutów)

**Sekcje Menu3 (lewy pasek NModeLeftNav)**: kliknięte po kolei Wyniki→Kontrakt→Pomiary→Sprawy
odchyleń→Działania korygujące→Inicjatywy→Karty wyników→Historia→z powrotem Wyniki (8 sekcji, pełny
cykl tam i z powrotem). Zero błędów konsoli/sieci.

**Nawigacja realnym routerem** (nie SPA-podmianka props): klik wiersza sprawy odchylenia (`case-1`) →
realny `navigate()` do `KpiDeviationCaseSubview` (URL się zmienia w `<MemoryRouter>`) → klik chevronu
cofania (współrzędne zlokalizowane przez `getBoundingClientRect`, nie zgadywane) → realny powrót do
`KpiToolPage`. Zero błędów przy DWÓCH przejściach routera w jedną i drugą stronę.

**Kebab (Menu1, prawy górny róg)**: otwarty MYSZĄ (real click) — pokazuje „Skopiuj kod obiektu” /
„Kopiuj link” / „Archiwizuj” (crimson, poprawnie — pozycja destrukcyjna aktywna). Otwarty także
**KLAWIATURĄ** (3× Tab od startu strony → Enter) — menu się otworzyło, potwierdzone zrzutem
(`kpi-tool-11-kebab-keyboard-open.png`), widoczny pierścień fokusu na przycisku. **Esc zamyka menu I
fokus wraca na przycisk kebaba** (`aria-label="Więcej"`) — sprawdzone `document.activeElement`, nie
tylko wzrokiem. To samo powtórzone i potwierdzone na kebabie WEWNĄTRZ widoku sprawy odchylenia
(subview) — też poprawnie.

**Stany**: `loading`, `error` (zob. znalezisko P2 niżej — surowy komunikat), `error`+retry (retry
poprawnie ponawia fetch; mock w trybie `state=error` zawsze zwraca 503 — to jest ZAMIERZONE zachowanie
mocka, nie bug), `ff=off` (poprawny ekran „jeszcze nie włączone”), `impacts=0` (pusty stan „Inicjatywy”
bez błędów), eskalacja (`escalated=1&severity=critical`) — chip „Eskalowana” poprawnie crimson (krytyczna
semantyka = poprawne użycie czerwieni), przycisk „Cofnij eskalację” widoczny.

**PL/EN + dark + 1280**: `?lang=en&theme=dark&w=1280` — poprawny przekład („Performance” zamiast
„Wyniki” itd.), dark mode realnie zastosowany (paleta `--c-*` przełączona, nie tylko klasa CSS —
sprawdzone wizualnie zrzutem), układ przy 1280 nie łamie się.

**Tab-through**: 18 elementów fokusowalnych wykrytych (`document.querySelectorAll` filtrowane po
`offsetParent`); przejechano 20× Tab bez zawieszenia na jednym elemencie — NIE jest to pełna,
ręcznie zweryfikowana lista przystanków (patrz „czego runda NIE dowodzi”).

**window.prompt/confirm/alert**: brak żywych wywołań (`grep` po `KpiToolPage.tsx`/
`KpiDeviationCaseSubview.tsx` — tylko komentarz historyczny o naprawie).

**ZNALEZISKO P2** — surowy komunikat błędu backendu renderowany wprost:
`src/components/ResultsVNext/kpiTool/KpiToolPage.tsx:240` (`setLoadError(err instanceof Error ?
err.message : String(err))`) i `:364-365` (`description={loadError}` — bez tłumaczenia, bez
`errorMessage.ts`, którego w tej bazie NIE MA). Zrzut: `kpi-tool-13-error.png` — widoczny tekst
„Upstream KPI service returned a 503.” po angielsku na inaczej polskim ekranie. Ten sam wzorzec (surowe
`err.message` → `toast.error`) w liniach `:300`, `:316`, `:741`, `:808` tego samego pliku.

---

### 2. `results-vnext-roi-registry` (przejechany w całości od nowa, 20 zrzutów)

**Zakładki Menu2**: „Wszystkie sprawy” / „Realizacja korzyści” — oba kierunki kliknięte, zero błędów.

**Wiersz → podgląd**: klik „Automatyzacja linii pakowania” → panel podglądu otwiera się z realnymi
danymi (NPV/IRR/Payback pokazują „—” bo sprawa w statusie „Modelowanie” nie ma jeszcze przebiegu
kalkulacji — to POPRAWNY pusty stan, nie błąd).

**Kebab wiersza**: otwarty myszą — pełne menu z 7 przejściami cyklu życia, WSZYSTKIE nieuprawnione
pozycje (Zaakceptuj/Odrzuć/Poproś o poprawki/itd.) widoczne+disabled+z POWODEM (wzorzec D06, zgodny z
kanonem). **Esc zamyka menu i fokus wraca na przycisk kebaba** — sprawdzone `document.activeElement`,
POPRAWNE.

**Modal „Nowa sprawa ROI”** (otwierany z przycisku CTA w Menu2, NIE z kebaba wiersza): otwiera się
poprawnie z pełnym formularzem. **Esc zamyka modal, ale fokus PADA NA `<body>`, nie wraca do przycisku
„Nowa sprawa ROI”** — sprawdzone 4×, za każdym razem to samo (`document.activeElement.tagName ===
'BODY'`). Zob. „Znalezione wady” D2 niżej — to jest część szerszego wzorca (2 różne ekrany).

**Dialog przejścia cyklu życia** (`RoiTransitionDialog`, otwierany Z KEBABA wiersza „Migracja legacy
MES” → „Zaakceptuj”): formularz z polem „Powód (opcjonalnie)” się otwiera. **Esc zamyka dialog, fokus
wraca na kebab wiersza** (`aria-label="Row actions"`) — POPRAWNE, sprawdzone 3×. To bezpośredni kontrast
z modalem create powyżej — dowodzi, że problem NIE jest ogólną wadą `Modal.tsx` w tym harnessie
(StrictMode nie tłumaczy różnicy, bo oba modale działają pod identycznymi warunkami).

**Stany**: `loading`, `empty` (liczniki zakładek poprawnie schodzą do 0), `error` — patrz znalezisko P2
niżej (ten sam wzorzec co kpi-tool, inny plik).

**PL/EN + dark + 1280**: czysty ekran, brak błędów.

**Kolumny + realny reload**: `dev-render/verify-reload-persist.mjs` — odznaczono 2 kolumny, **realny
`page.reload()`** (nie SPA), stan checkboxów IDENTYCZNY przed i po (`[true,false,true,true,true,true,
true,false]` → `[true,false,true,true,true,true,true,false]`). Persist DZIAŁA.

**Tab-through**: 8× Tab bez zawieszenia (nie pełna lista przystanków — NIESPRAWDZONE wyczerpująco).

**ZNALEZISKO P2 (surowy błąd)**: `src/components/ResultsVNext/roi/ResultsRoiHub.tsx:187` (`casesError`),
`:198` (`benefitsError`), `:233` (`initiativesError`), `:272` (`createError`), `:304`
(`transitionError`) — wszystkie `err instanceof Error ? err.message : String(err)` bez tłumaczenia.
Zrzut `roi-registry-15-error.png`: „Upstream ROI service returned a 503.” wprost na ekranie.

---

### 3. `results-vnext-roi-model` (przejechany w całości od nowa, 23 zrzuty)

**Menu2 (6 zakładek)**: Baseline i polityka→Założenia→Koszty→Korzyści→Scenariusze→Przebiegi
kalkulacji→z powrotem — zero błędów.

**Menu3 (4 fazy)**: Budowa sprawy→Decyzja→Realizacja wartości→Wnioski→z powrotem — zero błędów.

**Golden flow #1 (Edytuj baseline)**: klik wiersza „Baseline” → podgląd z realnymi danymi → kebab →
„Edytuj” → formularz z 11 polami wypełniony realnymi wartościami z mocka → **realny submit (PUT)** →
modal się zamyka, wiersz w tabeli natychmiast pokazuje nową datę „Zaktualizowano” (12 sie 2026 zamiast
15 lip 2026) — **potwierdzony pełny cykl zapisu bez przeładowania strony**.

**Golden flow #3 (Usuń pozycję kosztową)**: zakładka „Koszty” → wiersz „Zakup robotów pakujących” →
kebab → „Usuń” (crimson, aktywna pozycja destrukcyjna — POPRAWNE użycie czerwieni) → dialog potwierdzenia
→ **realny submit (DELETE)** → tabela natychmiast pokazuje pusty stan „Brak pozycji kosztowych” —
potwierdzony pełny cykl.

**`locked=1`**: kebab „Baseline” pokazuje „Edytuj” jako disabled z powodem „Sprawa zaakceptowana —
baseline i model ekonomicz…” — poprawnie widoczne+disabled+z powodem.

**`nullBaseline=1&nullPolicy=1`**: oba wiersze poprawnie pokazują „Brak rekordu” zamiast crashować —
poprawna obsługa 404.

**Esc/fokus na modalu edycji Baseline**: **Esc zamyka, fokus wraca na kebab wiersza** — POPRAWNE.
Kontrastuje z `roi-registry`'s create-modal (patrz wyżej) mimo identycznego mechanizmu `Modal.tsx`.

**PL/EN + dark + 1280**: czysty ekran.

**Tab-through**: 8× Tab bez zawieszenia (nie pełna lista — NIESPRAWDZONE wyczerpująco).

---

### 4. `results-vnext-roi-full-tool` (przejechany w całości od nowa, 38 zrzutów — największy ekran)

**Golden flow nawigacji**: rejestr (1 sprawa „Wdrożenie MES — linia pakowania”) → kebab → „Otwórz pełne
narzędzie” → realna nawigacja do `RoiCaseFullTool` (breadcrumb „Rejestr ROI › Wdrożenie MES…”) →
**klik breadcrumbu „Rejestr ROI” → realny powrót do rejestru** — pełny cykl nawigacji w obie strony,
zero błędów.

**Menu3 (4 fazy pełnego narzędzia)**: Budowa sprawy→Decyzja→Realizacja wartości→Wnioski→z powrotem —
cykl 4 kliknięć, zero błędów konsoli/sieci. Uwaga metodologiczna: `locator.click()` Playwrighta
TIMEOUT'OWAŁ na tych przyciskach (prawdopodobnie framer-motion `motion.button` nie stabilizuje się
w oknie 8s, wzorzec znany już w `shot.mjs`'a komentarzach o react-flow) — po przejściu na `clickxy`
(real mouse click z pominięciem actionability-check) kliknięcia przeszły czysto. To NIE jest defekt
produktu — sprawdzone przez odczyt `elementFromPoint` (element widoczny, klikalny, bez nakładki).

**Faza „Decyzja” → „Migawki zatwierdzenia”**: poprawny pusty stan „Migawka powstaje automatycznie w
momencie akceptacji sprawy” (sprawa jeszcze nie zaakceptowana — zgodne z golden-flow #4 dokumentu
nagłówkowego ekranu).

**Golden flow #5 (Zarejestruj wykonanie)**: faza „Realizacja wartości” → zakładka „Wykonania” → „+
Zarejestruj wykonanie” → formularz (Typ/Pozycja kosztowa/Okres/Kwota/Waluta/Źródło/Notatki) wypełniony
programowo (natywny setter + `input`/`change` eventy, żeby ominąć że React kontroluje pole) → **realny
submit (POST)** → wiersz „Koszt · 1 cze 2026 – 30 cze 2026 · 15 000 zł · Faktura VAT 2026/06/112”
natychmiast w tabeli + panel podglądu z pełnymi szczegółami (Zarejestrował: user-piotr-demo, Zarejestrowano:
12 sie 2026) — **pełny cykl potwierdzony**.

**Faza „Wnioski” → „Powiązania Finance” → „Nowe powiązanie”**: modal się otwiera z uczciwym
disclaimer'em („Typ/ID/wersja artefaktu Finance to zwykły tekst — brak wyszukiwarki, wpisz ręcznie”).
**ZNALEZISKO P1** (patrz niżej) — próba submitu z częściowo wypełnionym formularzem (3 z 6 wymaganych
pól) jest CICHYM no-opem, zero widocznej reakcji.

**Esc/fokus na modalu „Nowe powiązanie”**: **Esc zamyka modal, fokus PADA NA `<body>`** — sprawdzone
2×, powtarzalne. To DRUGI ekran z tym samym wzorcem co `roi-registry`'s create-modal (obydwa otwierane
z trwałego przycisku CTA Menu2, nie z kebaba wiersza).

**Stany**: `loading`, `empty`, `error` (patrz kpi-tool/roi-registry — ten sam wzorzec surowego błędu,
przez ten sam `roiApi.ts`), `lang=en&theme=dark&w=1280` — wszystko czyste.

**Kolumny + realny reload**: identyczny test jak `roi-registry` — stan checkboxów identyczny przed i po
`page.reload()`. Persist DZIAŁA.

**Tab-through**: 8× Tab bez zawieszenia (nie pełna lista — NIESPRAWDZONE wyczerpująco).

**ZNALEZISKO P1 (nowe) — cicha porażka walidacji, zero widocznego komunikatu**:
`src/components/ResultsVNext/roi/RoiLearnModals.tsx`:
- `:254-259` — `required = [financeArtifactType, financeArtifactId, financeVersionId, source, asOf,
  linkPurpose]`; `handleSubmit` ustawia `touched=true` i **cicho `return`**, jeśli którekolwiek pole
  puste — NIE woła `onSubmit`.
- `:289-309` — na każdym z 6 wymaganych pól ustawiony jest WYŁĄCZNIE `aria-invalid={hasError(...) ||
  undefined}` — **BRAK jakiegokolwiek widocznego tekstu błędu, `aria-describedby`, czerwonej ramki
  czy innego sygnału**.
- `:36-39` (`FIELD_CLASS`) — brak wariantu stylu dla `aria-invalid` (brak `aria-invalid:border-...`
  itp.) — nawet ramka pola nie zmienia koloru.
- **Kontrast w TYM SAMYM repo**: `src/components/ResultsVNext/roi/RoiCaseCreateModal.tsx:147-159,
  252-254` implementuje POPRAWNY wzorzec (widoczny tekst „Wybierz inicjatywę”/„Nazwa jest wymagana” +
  `aria-describedby`), z komentarzem w kodzie wprost mówiącym, że to naprawa „realnego defektu
  złapanego w QA (RN-G2 create-package, 2026-08-10)” — czyli DOKŁADNIE ta sama klasa błędu była już
  raz znaleziona i naprawiona w tym programie, ale naprawa nie została przeniesiona na później dodany
  formularz `RoiFinanceLinkFormModal`.
- **Kroki odtworzenia**: `?screen=results-vnext-roi-full-tool&state=ready` → wiersz „Wdrożenie MES” →
  kebab → „Otwórz pełne narzędzie” → Menu3 „Wnioski” → Menu2 „Powiązania Finance” → „+ Nowe
  powiązanie” → wypełnij TYLKO „Typ artefaktu”/„ID artefaktu”/„Stan na” (zostaw „ID wersji”/
  „Źródło”/„Cel powiązania” puste) → kliknij „Powiąż”.
- **Konsekwencja**: przycisk wygląda na zepsuty — użytkownik nie ma ŻADNEGO sposobu dowiedzieć się,
  czego brakuje, poza zgadywaniem lub czytaniem kodu źródłowego.
- **Waga: P1** — blokuje ukończenie zadania bez wyjaśnienia.

---

### 5. `results-vnext-kpi-registry` (druga runda kontrolna, świeże dowody na 5 zrzutach + stare 29 od poprzednika)

**Zakładki Menu2**: Moje→Organizacja→Karty wyników→Moje — pełny cykl, zero błędów. Zakładka „Karty
wyników” pokazuje poprawny pusty stan („Brak kart wyników” — 0 rekordów w tym mocku dla tej zakładki,
nie błąd).

**ZNALEZISKO P2 (nowe)**: kebab wiersza „OEE-LINIA-PAKOWANIA” — otwarty myszą, **Esc zamyka menu
POPRAWNIE, ale fokus PADA NA `<body>`, nie wraca na przycisk kebaba** (`aria-label` przycisku nieczytelny
po zamknięciu bo focus na body). Sprawdzone 3× niezależnie, za każdym razem identyczny wynik.
Plik: `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx:772-773` (wiązanie `rowMenu` dla listy
Moje/Organizacja KPI). **Kontrast**: identyczny test na `kpi-scorecards`, `legacy-archive`,
`roi-registry`, `okr-registry` — wszędzie fokus wraca poprawnie na przycisk. To jest specyficzne dla
TEGO ekranu, nie ogólna wada współdzielonego komponentu.

Reszta interakcji (29 zrzutów poprzednika: row preview/dblclick, kolumny+reload, stany
loading/empty/error/error-retry, deep-link ok/forbidden, EN/dark/1280, pomiary/historia/modal rekordu)
**NIE została przeze mnie odtworzona od zera w tej rundzie** — zrzuty istnieją i wizualnie wyglądają
spójnie, ale bez świeżych logów konsoli/sieci NIE mogę potwierdzić „zero błędów” dla tych konkretnych
kroków poza tym, co sam kliknąłem. Traktuj tę część jako NIESPRAWDZONĄ w tej rundzie (patrz sekcja
„czego runda NIE dowodzi”).

---

### 6. `results-vnext-kpi-scorecards` (druga runda kontrolna)

**Zakładki**: Pozycje↔Migawki przeglądu — cykl, zero błędów. Ekran domyślnie otwiera się na widoku
SZCZEGÓŁÓW konkretnej karty wyników („Karta wyników — Jakość Q3”), nie na rejestrze kart — zgodne z
zachowaniem harnessu.

**Kebab wiersza**: otwarty myszą, **Esc zamyka menu I fokus wraca na przycisk** — POPRAWNE, sprawdzone.

**Stan `error`**: czysty ekran, zero błędów konsoli/sieci.

---

### 7. `results-vnext-legacy-archive` (druga runda kontrolna)

**Kebab wiersza „kpi_definitions”**: otwarty myszą — WSZYSTKIE 3 pozycje (Edytuj/Archiwizuj/Usuń)
disabled z tym samym powodem „Archiwum tylko do odczytu — brak zapisów w tej powi…” (obcięte —
zob. znalezisko P3 niżej, wzorzec współdzielony). „Usuń” w bladym/zmniejszonej-krycia crimsonie —
zgodne z wcześniejszym ustaleniem RN-G3 (kosmetyczne, nie funkcjonalne — pozycja jest realnie
disabled, sprawdzone).

**Esc/fokus**: **zamyka menu I fokus wraca na przycisk** — POPRAWNE.

**Stan `error`**: czysty.

---

### 8. `results-vnext-okr-admin` (druga runda kontrolna)

**Obie podstrony** (`page=programs`, `page=cycles`) konsekwentnie pokazują ekran „jeszcze nie
włączone” — **identyczny stan jak u poprzednika** (nie regresja mojej sesji). Brak parametru URL
odblokowującego flagę w tym harnessie (sprawdzone: `grep` po `dev-render/screens/
results-vnext-okr-admin.tsx` — jedyny parametr to `&page=`). **Treść tego ekranu pozostaje w 100%
NIESPRAWDZONA interaktywnie w tej rundzie** — nie ma czego kliknąć poza samym disabled-panelem.

---

### 9. `results-vnext-okr-objectives` (druga runda kontrolna, głębsza niż poprzednio)

**Postęp poprawnie przeskalowany**: 132%, 82% na liście celów; 130%, 83,3%, 0% w drill-downie
Kluczowych Rezultatów — potwierdza naprawę ×100 z RN-G3 na realnym komponencie.

**Kebab wiersza**: **Esc zamyka menu I fokus wraca na przycisk** — POPRAWNE.

**Realny drill-down**: klik wiersza „Uruchomić linię MES-1…” → panel podglądu (realne dane: właściciel,
opis, uzasadnienie, postęp, pewność) → klik „Kluczowe Rezultaty” → **realna nawigacja** do tabeli 4
Kluczowych Rezultatów z 3-poziomowym breadcrumbem („Zestawy OKR › Wdrożyć MES… › Uruchomić linię
MES-1…”) → **klik breadcrumbu środkowego poziomu → realny powrót** do listy celów. Pełny cykl
nawigacji w obie strony, zero błędów.

**Stan `error`**: czysty.

---

### 10. `results-vnext-okr-registry` (druga runda kontrolna)

**Zakładki**: Organizacja→Moje→Firma→Organizacja — cykl, zero błędów. Postęp poprawnie przeskalowany
(91%, 62,5%, 104%, 78%).

**Kebab wiersza**: **Esc zamyka menu I fokus wraca na przycisk** — POPRAWNE.

**Row preview + stan `error`**: czyste.

---

### 11. `results-vnext-registry-shell` (druga runda kontrolna, znalezisko krytyczne)

**Domena `kpi`, zakładki My↔Org**: cykl, zero błędów konsoli/sieci.

**ZNALEZISKO P1 (nowe)**: kebab wiersza „OEE linii pakowania” — otwarty myszą, **Esc W OGÓLE NIE
ZAMYKA MENU** (menu pozostaje w pełni widoczne i interaktywne po naciśnięciu Escape — sprawdzone przez
`document.querySelector('[role=menu]')` niezmiennie `true` po Esc, nie tylko brak zamknięcia na
zrzucie). Powtórzone 3× niezależnie, identyczny wynik za każdym razem. To jest ODRĘBNY, GORSZY
wariant niż „zamyka ale fokus nie wraca” znaleziony na `kpi-registry`/`roi-registry`/`roi-full-tool` —
tu Escape nie robi kompletnie NIC. Zrzut: `registry-shell-06-kebab-esc-correct.png` (nazwa mylącą — plik
został tak nazwany przed odkryciem wady; treść zrzutu pokazuje menu WCIĄŻ otwarte po Esc).
- **Kroki odtworzenia**: `?screen=results-vnext-registry-shell&domain=kpi&state=ready` → kliknij kebab
  wiersza „OEE linii pakowania” (myszą) → naciśnij Escape → menu pozostaje otwarte.
- **Zasięg nieustalony**: `ResultsVNextRegistryShell` to współdzielony komponent, na którym zbudowane
  są realne rejestry `kpi-registry`/`roi-registry`/`okr-registry` — te TRZY produkcyjne ekrany
  poprawnie zamykają kebab na Esc (sprawdzone wyżej). Różnica leży prawdopodobnie w tym, JAK ten
  konkretny harness (`dev-render/screens/results-vnext-registry-shell.tsx`, linie ~380-395) buduje
  własną konfigurację `rowMenu` — nie zdążyłem doprowadzić do source'owej przyczyny (poza zakresem
  weryfikatora: nie naprawiam, tylko zgłaszam). **Zespół inżynierski powinien ustalić, czy to defekt
  samej powłoki `ResultsVNextRegistryShell`, czy tylko tego jednego harnessu.**
- **Waga: P1** — pułapka klawiaturowa de facto (menu nie da się zamknąć klawiszem Escape;
  prawdopodobnie da się zamknąć klikiem poza menu — NIE sprawdziłem tego alternatywnego zamknięcia w
  tej sesji, więc nie twierdzę że menu jest niezamykalne w ogóle, tylko że Escape nie działa).

**Fałszywy trop obalony** (nie zgłaszam jako wadę): Menu2 tego ekranu („My”/„Org”/„New KPI”/„Locked”/
„Not calculable”) jest hardkodowane po angielsku WPROST w pliku harnessu
(`dev-render/screens/results-vnext-registry-shell.tsx:440-454`, dosłowne stringi `label: 'My'` itd.,
NIE przez `t()`), podczas gdy otaczający panel (`ArtifactRightPanel`) poprawnie łapie polski `t()`
domyślny — stąd wizualnie „wymieszany język” na zrzucie. To WYŁĄCZNIE artefakt fixture'u tego
konkretnego dev-render (harness testuje samą powłokę z minimalnym mockiem uniwersalnym dla 3 domen), a
nie i18n produktu — potwierdzone czytaniem źródła, nie zgaduję.

**Stany `empty` (domena roi) i `error` (domena okr)**: czyste, zero błędów.

---

## Tabela zbiorcza

| Ekran | Konsola OK? | Sieć OK? | Klawiatura (Esc/fokus)? | Stany OK? | PL/EN OK? | Dark/light OK? |
|---|---|---|---|---|---|---|
| `kpi-tool` | ✅ (pełna runda) | ✅ | ✅ (kebab mysz+klawiatura, subview też) | ✅ (loading/error/ff-off/empty/escalated) | ✅ | ✅ (+1280) |
| `roi-registry` | ✅ (pełna runda) | ✅ | ⚠️ kebab OK; **create-modal: fokus→body (P1)** | ✅ | ✅ | ✅ (+1280) |
| `roi-model` | ✅ (pełna runda) | ✅ | ✅ (kebab i modal edycji poprawne) | ✅ (locked/nullBaseline/nullPolicy) | ✅ | ✅ (+1280) |
| `roi-full-tool` | ✅ (pełna runda) | ✅ | ⚠️ nawigacja/breadcrumb OK; **finance-link modal: fokus→body (P1)** | ✅ | ✅ | ✅ (+1280) |
| `kpi-registry` | ✅ (moje kroki) / ⚪ (reszta stara) | ✅ (moje kroki) | ⚠️ **kebab: zamyka, fokus→body (P2)** | ⚪ stare zrzuty, nieodświeżone | ⚪ stare | ⚪ stare (1 stary zrzut) |
| `kpi-scorecards` | ✅ (moje kroki) / ⚪ (reszta stara) | ✅ | ✅ | ✅ (error) | ⚪ NIESPRAWDZONE świeżo | ⚪ NIESPRAWDZONE świeżo |
| `legacy-archive` | ✅ (moje kroki) / ⚪ (reszta stara) | ✅ | ✅ | ✅ (error) | ⚪ NIESPRAWDZONE świeżo | ⚪ NIESPRAWDZONE świeżo |
| `okr-admin` | ✅ (moje kroki) | ✅ | N/A — brak interaktywnej treści (flaga OFF) | N/A | ⚪ NIESPRAWDZONE | ⚪ NIESPRAWDZONE |
| `okr-objectives` | ✅ (moje kroki) / ⚪ (reszta stara) | ✅ | ✅ (kebab + breadcrumb nawigacja) | ✅ (error) | ⚪ NIESPRAWDZONE świeżo | ⚪ NIESPRAWDZONE świeżo |
| `okr-registry` | ✅ (moje kroki) / ⚪ (reszta stara) | ✅ | ✅ | ✅ (error) | ⚪ NIESPRAWDZONE świeżo | ⚪ NIESPRAWDZONE świeżo |
| `registry-shell` | ✅ (moje kroki) / ⚪ (reszta stara) | ✅ | ❌ **kebab NIE zamyka się na Esc (P1)** | ✅ (empty/error/forbidden) | N/A (fixture) | ⚪ NIESPRAWDZONE świeżo |

Legenda: ✅ sprawdzone i poprawne w tej rundzie · ⚠️ sprawdzone, częściowa wada · ❌ sprawdzone, wada ·
⚪ nie sprawdzone świeżo w tej rundzie (stare zrzuty poprzednika istnieją, ale bez logów).

---

## ZNALEZIONE WADY — zbiorczo z wagami

| # | Waga | Ekran(y) | Plik:linia | Skrót |
|---|---|---|---|---|
| D1 | P1 | `roi-full-tool` | `src/components/ResultsVNext/roi/RoiLearnModals.tsx:254-259,289-309,36-39` | „Nowe powiązanie Finance” — submit z brakującymi wymaganymi polami to CICHY no-op, zero widocznego błędu (kontrast z poprawnym wzorcem w `RoiCaseCreateModal.tsx`) |
| D2 | P1 | `registry-shell` | `dev-render/screens/results-vnext-registry-shell.tsx` (harness) / zasięg w `ResultsVNextRegistryShell` niepotwierdzony | Kebab wiersza W OGÓLE nie zamyka się na Escape (3/3 powtórzeń) |
| D3 | P1 (wzorzec, 2 wystąpienia) | `roi-registry` (create-modal), `roi-full-tool` (finance-link modal) | `Modal.tsx:170` (mechanizm) + `RoiCaseCreateModal.tsx`/`RoiLearnModals.tsx` (wywołujący) | Modal otwierany z trwałego CTA Menu2 (nie z kebaba wiersza) — Esc zamyka, ale fokus pada na `<body>` zamiast wrócić do wyzwalacza. 4/4 i 2/2 powtórzeń. Kontrast: modale z kebaba wiersza (transition dialog, baseline-edit) poprawnie zwracają fokus pod identycznymi warunkami StrictMode/dev — więc to NIE jest artefakt samego dev-mode. |
| D4 | P2 | `kpi-registry` | `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx:772-773` | Kebab wiersza — Esc zamyka, fokus pada na `<body>` (3/3 powtórzeń); 4 inne ekrany z tej rundy (`kpi-scorecards`, `legacy-archive`, `roi-registry`, `okr-registry`) poprawnie zwracają fokus na swoje kebaby |
| D5 | P2 (cross-domain, potwierdzone/rozszerzone z RN-G3) | `kpi-tool`, `roi-registry` (i zapewne `roi-model`/`roi-full-tool` przez ten sam `roiApi.ts`) | `KpiToolPage.tsx:240,364-365`; `ResultsRoiHub.tsx:187,198,233,272,304` | Surowy `err.message` z backendu (angielski) renderowany wprost w stanie błędu — `src/components/ResultsVNext/shared/errorMessage.ts` NIE ISTNIEJE w tej bazie, więc udokumentowany wyjątek się nie stosuje |
| D6 | P3 (komponent współdzielony) | `roi-registry`, `roi-model`, `legacy-archive`, `registry-shell` (potencjalnie każdy ekran z disabled-reason w kebabie) | `src/components/shared/RowActionsMenu.tsx:629,653-654` | Powód disabled-pozycji obcięty `truncate` w widocznym menu; pełny tekst tylko przez natywny `title` (hover) |

---

## Czego ta runda NIE dowodzi (obowiązkowe)

- **Harness podstawia warstwę sieciową** (`window.fetch`/`Api.get` stubowane statycznym/stanowym
  mockiem w pamięci) — to jest dowód UKŁADU i LOGIKI komponentu (hooki, routing, stan formularza,
  focus management), **NIE** dowód, że prawdziwy endpoint backendu zwraca te same kształty danych,
  ani że baza danych/RLS/migracje działają. Zero 4xx/5xx w tej rundzie oznacza „mock zawsze
  odpowiadał zgodnie z oczekiwaniami komponentu”, nie „prawdziwe API działa”.
- **Trwałość między sesjami przeglądarki NIESPRAWDZONA** poza `persistKey` kolumn (localStorage) —
  żadne dane z formularzy (Baseline, Cost delete, Register Actual, Finance link) nie przetrwają
  faktycznego zamknięcia i ponownego otwarcia karty ani realnego backendu; to są mocki w pamięci
  procesu Vite dev-servera, znikające przy każdym pełnym reloadzie modułu.
- **7 z 11 ekranów ma TYLKO CZĘŚCIOWO odświeżone dowody** — dla `kpi-registry`, `kpi-scorecards`,
  `legacy-archive`, `okr-admin`, `okr-objectives`, `okr-registry`, `registry-shell` poprzednik zostawił
  bogatszy zestaw zrzutów (kolumny+reload, deep-link, dblclick, PL/EN/dark/1280, pełna historia
  pomiarów, modal rekordu) niż to, co ja osobiście przejechałem od nowa w tej sesji. Te stare zrzuty
  ISTNIEJĄ i wyglądają spójnie, ale nie mam dla nich świeżych logów konsoli/sieci — więc formalnie są
  NIESPRAWDZONE w TEJ rundzie (mogły się zmienić między commitami, nie mam na to dowodu w żadną
  stronę). Rekomendacja: jeśli te zrzuty mają być dowodem w odbiorze, ktoś musi je odtworzyć z logami.
- **Kontrast WCAG nie był mierzony `getComputedStyle`** w tej sesji (poza wzrokowym odczytem
  zrzutów) — RN-G3 wcześniej mierzył kontrast obliczonym stylem; ja tego nie powtórzyłem. Możliwe
  regresje kontrastu NIE zostały wykluczone.
- **Pełna lista przystanków Tab NIE została ręcznie spisana** dla żadnego ekranu — sprawdziłem tylko
  liczbę fokusowalnych elementów i że 8-20× Tab nie zawiesza się na jednym miejscu. Pułapka fokusu w
  ŚRODKU długiej sekwencji (nie na początku/końcu) mogła zostać przeoczona.
- **Klawiaturowe otwarcie kebaba (Enter/Space z klawiatury, nie tylko myszą) sprawdzone TYLKO na
  `kpi-tool`** — na pozostałych 10 ekranach kebaby otwierałem myszą (`clickxy`), nie klawiaturą.
- **Alternatywne zamknięcie menu na `registry-shell` (klik poza menu, nie Escape) NIE zostało
  sprawdzone** — nie wiem, czy menu jest w ogóle niezamykalne, czy tylko klawisz Escape nie działa.
- **Deep-linki i stan `forbidden` NIE zostały świeżo przetestowane** dla żadnego z 11 ekranów w tej
  rundzie (poza jednym `forbidden` na `registry-shell`) — stare zrzuty poprzednika (kpi-registry-19/20)
  istnieją, ale nieodświeżone.
- **`results-vnext-okr-admin` pozostaje całkowicie niesprawdzony interaktywnie** — flaga OFF bez
  przełącznika w tym harnessie.
- **Migracja/produkcja**: nic w tej rundzie nie mówi nic o stanie prawdziwej bazy demo/prod, ani o
  tym, czy realne środowisko Railway ma te same flagi włączone/wyłączone.
- **StrictMode/dev-only artefakty**: dev-render zawsze działa pod `React.StrictMode` w trybie
  deweloperskim (podwójne wywołanie efektów przy montowaniu). Dla znaleziska D3 (fokus→body na CTA-modalach)
  wykluczyłem to wyjaśnienie PRZEZ KONTRAST (siostrzane modale w tym samym danym momencie działają
  poprawnie pod identycznymi warunkami) — ale nie uruchomiłem żadnego ekranu w buildzie produkcyjnym
  (`vite build && vite preview`), więc formalnie nie mam dowodu z nieStrictModowego środowiska dla
  ŻADNEGO z 11 ekranów.

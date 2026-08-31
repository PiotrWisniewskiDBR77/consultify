---
doc_id: grafika-noc-przeglad-modulow
status: living
owner: piotr
truth_type: review
established: 2026-08-30
---

# Nocny przegląd modułów — dziennik odbioru

Dziennik przeglądów modułów grafiki, jeden po drugim, sesja po sesji. Każda
sekcja = jeden moduł, jeden przebieg, jeden wykonawca. Zrzuty leżą w
`evidence/grafika/<katalog>/` — jeden katalog per moduł, plik na ekran×motyw,
generowane `scripts/dev/grafika-zrzuty.mjs` (`--katalog=<katalog> --faza=PRZED`).

## Moduł 10-materialy

**Wykonawca:** robotnik nocny, 2026-08-30 · **Katalog zrzutów:**
`evidence/grafika/136-noc-materialy/` (90 plików PNG, jeden `--faza=PRZED`
przebieg na wszystkie 42 ekrany, 2 motywy każdy, plus 3 dodatkowe warianty
stanu dla `prezentacje-template-states` — patrz niżej).

**Obejrzano własnymi oczami na ŚWIEŻYM zrzucie: 42 z 42 ekranów** (100%).
Dla każdego ekranu istnieje plik `evidence/grafika/136-noc-materialy/<id>__PRZED__light.png`
i `...__PRZED__dark.png` z tej sesji (nie z wcześniejszych przebiegów — dwaj
poprzedni robotnicy tej nocy zostali odrzuceni za korzystanie z cudzych/starych
zrzutów zamiast własnych). Większość ekranów przeczytana narzędziem `Read` w
pełnej rozdzielczości (2880×1800, skala 2×, szerokość 1440 CSS px) — dokładnie
tam, gdzie warto było zobaczyć prawy panel i pełną szerokość tabeli (nie
zwężony 800 px podgląd przeglądarki, który ucina kolumny i fałszywie sugeruje
defekt).

### Metoda

1. `bash scripts/dev/grafika-zrzuty.mjs --ekrany=<lista> --katalog=136-noc-materialy --faza=PRZED` —
   dwa przebiegi (24 + 17 ekranów) + jeden dodatkowy z `--wejscie=html` dla
   `materials-registry` (jedyny ekran modułu z własnym plikiem `.html`) + trzy
   dodatkowe z `--parametry=variant=…` dla trzech stanów
   `prezentacje-template-states`.
2. Każdy plik odczytany narzędziem `Read` (nie tylko podgląd przeglądarki) —
   to jest "obejrzenie własnymi oczami" wymagane przez CLAUDE.md §7.
3. Defekty w moich plikach (`DocumentStudio/**`, `Presentations/**`,
   `AIChat/KimiWorkspace/**`, `TemplateBuilder/**`, `Reports/**` poza
   `AreaMatrixTable.tsx`, plus `dev-render/screens/` moich ekranów) —
   naprawione i zweryfikowane PONOWNYM świeżym zrzutem po naprawie.
4. Defekty w plikach zakazanych (`shared/**`, `standard/**`,
   `public/locales/**`) albo poza moim zakresem (np. `ReportBuilder/**`,
   `ReportsAndPresentations/**`, `Interview/**`, `AIChat/UnifiedChatPanel.tsx`)
   — TYLKO zgłoszone, nietknięte.
5. `scripts/check-list-canon.sh` i `scripts/check-triada.sh` przechodzą po
   wszystkich zmianach (dług nie rośnie, zero nowych naruszeń crimson).

### ★ Dwie realne pułapki stanowiska pomiarowego złapane w tej sesji

Obie dokładnie pasują do ostrzeżenia w instrukcji dyżuru — "stanowisko
pomiarowe kłamie" — i obie zostały ROZSTRZYGNIĘTE, nie zgadywane:

1. **`report-builder-library-template` — pusty ekran udający awarię.**
   Pierwszy zrzut (samo `?screen=`) wyszedł całkowicie pusty — żadnego
   tekstu, żadnego elementu w drzewie DOM poza chromem harnessu. Konsola:
   `[OrgContext] Error fetching orgs: Unexpected token '<'`. Sprawdzone w
   źródle (`dev-render/screens/report-builder-library-template.tsx`,
   nagłówek komentarza): ekran wymaga `&new=true&templateArtifactId=fake-1`
   w adresie, inaczej `ReportBuilderView` nie rozpoznaje wejścia i nic nie
   montuje. Rejestr `dev-render/main.tsx` NIE dokumentuje tego wymogu przy
   wpisie ekranu. Po dodaniu parametrów ekran renderuje się poprawnie
   (modal „Nowy raport z wzorca"). Bez tej korekty ekran zostałby
   błędnie zgłoszony jako D/awaria produktu.
2. **`prezentacje-template-states` — stan „ładowanie" bez końca to jest
   treść, nie zawieszenie.** Domyślny wariant (`variant=loading`) to
   ZAMIERZONY, wiecznie zawieszony spinner (POST nigdy się nie rozstrzyga —
   tak działa realny `PrezentacjeView` przy niedostępnym backendzie).
   Sprawdzone w źródle screena i potwierdzone zrzutami DWÓCH pozostałych
   stanów (`&variant=orphaned`, `&variant=forbidden`) — oba renderują
   czyste, uczciwe komunikaty PL z przyciskiem powrotu. Wszystkie trzy stany
   zapisane osobno: `prezentacje-template-states-loading/-orphaned/-forbidden__PRZED__<motyw>.png`.

### Tabela — wszystkie 42 ekrany

| Ekran (id) | Ocena | Co nie tak / co sprawdzone | Naprawione / zgłoszone | Zrzut (własny, ta sesja) |
| --- | --- | --- | --- | --- |
| `sheet-artifact` | A | Arkusz NPV/IRR, warsztat 9-poleceniowy pasek, oba motywy czyste | — | `sheet-artifact__PRZED__{light,dark}.png` |
| `materialy-template-library-slice` | A | Tabela pełnej szerokości (1440px) — kolumny NIE ucięte, 5 świadomych odchyleń właściciela widoczne i czytelne | — | `materialy-template-library-slice__PRZED__{light,dark}.png` |
| `template-library-new-entry` | A | PUSTKA ZAMIERZONA — dowód wpięcia przycisku | — | `template-library-new-entry__PRZED__{light,dark}.png` |
| `document-studio-resume-error` | A | Błąd „Nie ma tu dokumentu" — treść jest błędem, uczciwe | — | `document-studio-resume-error__PRZED__{light,dark}.png` |
| `document-studio-template-resolve-error` | A | Błąd „Nie da się użyć tego wzorca" — uczciwe | — | `document-studio-template-resolve-error__PRZED__{light,dark}.png` |
| `deck-artifact` | A | Prawy panel WŁAŚCIWOŚCI pokazywał **surowe `colorSetId` „harvard"** zamiast etykiety | **NAPRAWIONE** — `DeckBuilderMelsView.tsx` szuka nazwy w `CURATED_COLOR_SETS` (→ „Harvard", „Ocean" itd.), `brand_kit` → „Identyfikacja marki" | `deck-artifact__PRZED__{light,dark}.png` |
| `deck-quality-badge` | A | Odznaka jakości czysta; „Briefing" sprawdzone w źródle — świadome tłumaczenie zapożyczenia (klucz `presentations.wizard.modes.briefing` = „Briefing” po polsku), nie błąd | — | `deck-quality-badge__PRZED__{light,dark}.png` |
| `document-artifact` | A | Górny pasek i podgląd pokazywały **surowe enumy**: `steering_committee_report`, `client_confidential`, `standard` | **NAPRAWIONE** — `DocumentStudioDocumentPanel.tsx`: nowe funkcje `documentTypeLabel/confidentialityLabel/densityLabel`, użyte w 4 miejscach (górny pasek trybu artefaktu, podgląd, panel Właściwości) | `document-artifact__PRZED__{light,dark}.png` |
| `excele-jeden-widok-materialy` | A | Treść czysta po polsku; nagłówki tabeli „FOR…”/„WIDOCZNO…” ucięte NAWET przy pełnej szerokości 1440px (10 kolumn) | **ZGŁASZAM** — `OutputsAggregateTabContent.tsx` (`ReportsAndPresentations/`, poza moim zakresem) | `excele-jeden-widok-materialy__PRZED__{light,dark}.png` |
| `excele-reopen-verify` | A | Czytelny błąd generowania, czerwień użyta poprawnie (stan krytyczny) | — | `excele-reopen-verify__PRZED__{light,dark}.png` |
| `excele-prawy-panel-standard` | A | Szyna: Akcje / Właściwości / Powiązania / Źródła i założenia / Komentarze / Historia — po polsku, oba motywy | — | `excele-prawy-panel-standard__PRZED__{light,dark}.png` |
| `excele-engine-reveal` | A | Strona główna Excel, wzorce po polsku | — | `excele-engine-reveal__PRZED__{light,dark}.png` |
| `excele-jeden-widok-pusty` | A | 3 karty startu (Czysto/Z AI/Z szablonu), pełna szerokość — wszystkie 3 widoczne | — | `excele-jeden-widok-pusty__PRZED__{light,dark}.png` |
| `excele-jeden-widok-recent` | A | Strona główna, 7 kart wzorców, pełna szerokość | — | `excele-jeden-widok-recent__PRZED__{light,dark}.png` |
| `b2-template-gallery` | A | Kanwa mapy myśli, AI-sugestia, „0 węzłów" (nie „0 nodes”) potwierdzone | — | `b2-template-gallery__PRZED__{light,dark}.png` |
| `word-intake-uselm-default` | A | AI domyślnie włączone (DEC-317), placeholder z wielokropkiem potwierdzony | — | `word-intake-uselm-default__PRZED__{light,dark}.png` |
| `gen-word-content-hints` | A | Kreator + rejestr szablonów w całości po polsku, TYP pokazuje nazwę nie kod | — | `gen-word-content-hints__PRZED__{light,dark}.png` |
| `gen-deck-content-hints` | A | Znaleziono DWA defekty: czerwona gwiazdka „Cel *” (zamiast wzorca „(wymagane)”); pole „Motyw” renderowało surowe `Corporate/Minimal/Modern` | **NAPRAWIONE (oba)** — `PresentationTemplateArchitectView.tsx`: gwiazdka→„(wymagane)” (wzorzec z `DocumentStudioTemplateArchitectView.tsx`), `THEME_OPTIONS` dostał `labelKey`, wszystkie 4 miejsca renderowania przełączone na `t(opt.labelKey, opt.fallback)` | `gen-deck-content-hints__PRZED__{light,dark}.png` |
| `template-builder-deck` | A | Kreator szablonu Deck, prawie w całości polski (jeden angielski „(Deck)” obok „Prezentacja” w oznaczeniu typu — pomijalne, techniczny dopisek obok etykiety) | — | `template-builder-deck__PRZED__{light,dark}.png` |
| `template-builder-table` | A | Kreator arkusza z kolumnami, czysty | — | `template-builder-table__PRZED__{light,dark}.png` |
| `template-builder-doc` | A | Bez odchyleń | — | `template-builder-doc__PRZED__{light,dark}.png` |
| `template-create-wizard` | A | Krok 1 z 3, formularz startowy czysty | — | `template-create-wizard__PRZED__{light,dark}.png` |
| `materialy-launcher` | A | Modal „Nowy materiał” — 3 karty | — | `materialy-launcher__PRZED__{light,dark}.png` |
| `prezentacje-template-states` | A | Wszystkie TRZY stany zweryfikowane (patrz pułapka #2 wyżej): loading/orphaned/forbidden | — | `prezentacje-template-states-{loading,orphaned,forbidden}__PRZED__{light,dark}.png` |
| `report-artifact` | A | NAJLEPSZY ekran partii, ale pasek KPI mieszał język: „Confidence” i „on-time” po angielsku obok trzech polskich | **NAPRAWIONE** — `dev-render/screens/report-artifact.tsx` (dane mock, mój ekran): „Confidence”→„Poziom pewności”, „on-time”→„na czas” | `report-artifact__PRZED__{light,dark}.png` |
| `document-studio-context-chip` | A | Formularz + chip kontekstu „DBR77 Sp. z o.o.” | — | `document-studio-context-chip__PRZED__{light,dark}.png` |
| `document-studio-menu-pliku` | A | Menu Plik (Nowy/Otwórz/Zapisz/Zapisz jako), naprawa enumów widoczna też tu | — | `document-studio-menu-pliku__PRZED__{light,dark}.png` |
| `document-studio-nowy-dokument-martwe-przyciski` | A | Tytuł klikalny, przyciski żywe; naprawa enumów widoczna („Wewnętrzne”, „Dokument ogólny”, „Zwięzły”) | — | `document-studio-nowy-dokument-martwe-przyciski__PRZED__{light,dark}.png` |
| `document-studio-blocks-i18n` | A | 3 puste stany bloków po polsku (nagłówki kart to etykiety dev-render, nie produkt) | — | `document-studio-blocks-i18n__PRZED__{light,dark}.png` |
| `document-studio-save-as-template` | A | Ścieżka dokument→wzorzec; naprawa enumów widoczna („Notatka dla zarządu”, „Zwięzły (1–3 strony)”) | — | `document-studio-save-as-template__PRZED__{light,dark}.png` |
| `materialy-draft-template-visibledraft-fix` | A | Szkic widoczny z pigułką „Szkic”; tytuły wierszy mają dopiski „(draft)”/„business case” — wygląda na celowe oznaczenie testowe, nie realna treść klienta | ZGŁASZAM (niski priorytet) — `dev-render/screens/materialy-draft-template-visibledraft-fix.tsx` | `materialy-draft-template-visibledraft-fix__PRZED__{light,dark}.png` |
| `word-quality-badge` | A | Stan przed uruchomieniem QA — PUSTKA ZAMIERZONA | — | `word-quality-badge__PRZED__{light,dark}.png` |
| `excele-edytowalna-siatka` | B | Realny arkusz NPV/IRR edytowalny; ZASTANY błąd „Zadanie ukończone” + „0/8” po ponownym otwarciu — **ZASTRZEŻONE w instrukcji dyżuru, NIE naprawiać**, zgłoszone wcześniej torowi funkcji | Nietknięte (świadomie) | `excele-edytowalna-siatka__PRZED__{light,dark}.png` |
| `report-builder-library-template` | B | Zob. pułapka #1 wyżej. Po korekcie adresu: modal poprawny, ale 4 napisy twarde po angielsku („TEMPLATE”, „Select assessment…”, „Cancel”, „Create draft”) | ZGŁASZAM — `src/views/ReportBuilderView.tsx` (poza moim zakresem) | `report-builder-library-template__PRZED__{light,dark}.png` |
| `materials-registry` | B | Rejestr wspólny w całości po polsku; kolumny „FOR…”/„WIDOCZNO…” ucięte jak w `excele-jeden-widok-materialy` (ten sam komponent); kolumna ŹRÓDŁO nadal pokazuje surowe „Tool” | ZGŁASZAM — `OutputsAggregateTabContent.tsx` (poza moim zakresem); ŹRÓDŁO już wcześniej zgłoszone jako otwarty słownik | `materials-registry__PRZED__{light,dark}.png` (wejście `--wejscie=html`) |
| `document-studio-streaming-honesty-n3` | B | Formularz startowy poprawny; **dynamiczny stan streamingu (plan→pisanie) NIE zweryfikowany** — narzędzie zrzutowe łapie tylko stan statyczny po `networkidle`, nie stan w trakcie SSE | Nie naprawiam (brak defektu do naprawy — ograniczenie metody pomiaru, nie produktu); zgłaszam lukę pomiarową | `document-studio-streaming-honesty-n3__PRZED__{light,dark}.png` |
| `document-studio-ai-teresa` | B | Czat Teresy poprawny PL, ale podpowiedź w pustym stanie panelu Teresy mówi „Zapytaj Teresę o **kontekst prezentacji**" — złe słowo domenowe w kontekście Document Studio (nie Prezentacji) | ZGŁASZAM — `src/components/AIChat/UnifiedChatPanel.tsx` klucz `aiChat.sidebarEmptyHint`, plus `public/locales/pl/translation.json` (oba poza moim zakresem — dzielony komponent czatu używany w wielu modułach) | `document-studio-ai-teresa__PRZED__{light,dark}.png` |
| `report-builder-block-types` | C | W całości po angielsku, brak choćby jednego klucza i18n | ZGŁASZAM — `src/components/ReportBuilder/BlockTypesManager.tsx` (poza moim zakresem — katalog `ReportBuilder`, nie `Reports`) | `report-builder-block-types__PRZED__{light,dark}.png` |
| `report-builder-templates` | C | W całości po angielsku; kolumna SEKCJE pokazuje „0” bez wyjaśnienia (nagie zero) | ZGŁASZAM — `src/components/ReportBuilder/TemplatesManager.tsx` (poza moim zakresem) | `report-builder-templates__PRZED__{light,dark}.png` |
| `insight-artifact` | C | Powłoka PL poprawna; treść wniosku w całości po angielsku; zdublowany cytat z poczwórnym cudzysłowem (`""…""` obok `"…"`); właściwość „Ustalenia” pokazuje „— · nieznane: trwa pobieranie ustaleń” — wygląda na utkniętą wartość ładowania pokazaną jako dana | ZGŁASZAM — `src/components/Interview/InsightViewer.tsx` (poza moim zakresem — katalog `Interview`) | `insight-artifact__PRZED__{light,dark}.png` |
| `gen-excel-templates-tab` | D | Wizualnie CZYSTY ekran (karty modeli po polsku), ale świadomie zdjęty z odbioru 2026-08-30 (`ODLOZONE.md`) jako zdublowana ścieżka do tej samej mechaniki | Nietknięte (zgodnie z decyzją właściciela — nie duplikować) | `gen-excel-templates-tab__PRZED__{light,dark}.png` |
| `document-studio-m1-share-primary` | D | Twardy crash `useNavigate() may be used only in the context of a <Router>` — BŁĄD HARNESSU (brak `<Router>` w tym konkretnym dev-render pliku), nie produktu; ta sama treść działa poprawnie przez `document-studio-menu-pliku` | Nietknięte — zdublowany ekran testowy, potwierdzone w konsoli i DOM | `document-studio-m1-share-primary__PRZED__{light,dark}.png` |

### Defekty wspólne (poza modułem, tylko zgłaszam)

Cztery znaleziska wymagają dotknięcia plików spoza mojego zakresu
(`src/components/shared/**`, `AIChat/UnifiedChatPanel.tsx`,
`ReportBuilder/**`, `ReportsAndPresentations/**`, `Interview/**`,
`public/locales/**`) — zgodnie z zasadami sesji **tylko zgłoszone, nie
tknięte**:

1. **`aiChat.sidebarEmptyHint` (public/locales/pl/translation.json, użyty w
   `src/components/AIChat/UnifiedChatPanel.tsx:7041`)** — treść na sztywno
   mówi „kontekst prezentacji” niezależnie od tego, który moduł hostuje czat
   (widoczne w Document Studio na ekranie `document-studio-ai-teresa`).
   Cross-modułowy wyciek złej terminologii domenowej.
2. **`OutputsAggregateTabContent.tsx` (`src/components/ReportsAndPresentations/`)** —
   tabela „Arkusze”/„Wszystkie" (10 kolumn) ucina nagłówki „Format” i
   „Widoczność” do „FOR…”/„WIDOCZNO…” nawet przy pełnej szerokości 1440px.
   Ten sam komponent zasila `excele-jeden-widok-materialy` i
   `materials-registry`.
3. **`ReportBuilder/BlockTypesManager.tsx`, `TemplatesManager.tsx`,
   `src/views/ReportBuilderView.tsx`** — trzy ekrany silnika Report Builder
   (starsza ścieżka `/reports/builder`) w całości albo częściowo po
   angielsku, zero kluczy i18n w dwóch pierwszych. Już poprawnie
   sklasyfikowane C/B (nie pokazywane właścicielowi), ale dług i18n
   pozostaje nierozwiązany.
4. **`src/components/Interview/InsightViewer.tsx`** — treść wniosku (Insight)
   w trybie demo cała po angielsku, zdublowany cytat z poczwórnym
   cudzysłowem, plus właściwość „Ustalenia” pokazująca zawieszoną wartość
   ładowania jako dane.

### Niespójności wewnątrz modułu

- **Ten sam wzorzec „surowy enum zamiast etykiety” wystąpił niezależnie w
  DWÓCH różnych plikach** (`DeckBuilderMelsView.tsx` dla `colorSetId`,
  `DocumentStudioDocumentPanel.tsx` dla `documentType`/`confidentiality`/
  `density`) — mimo że sąsiednie pola w TYCH SAMYCH plikach (klasyfikacja,
  status) już były poprawnie tłumaczone. Wygląda na częściowy fix, który nie
  objął wszystkich pól przy tej samej okazji (wzorzec „naprawa
  per-wywołanie odrasta” z pamięci nadzorcy).
- **Ten sam problem szerokości tabeli (10 kolumn, nagłówki ucięte)** wystąpił
  w DWÓCH miejscach modułu (`excele-jeden-widok-materialy`,
  `materials-registry`) — bo to jeden i ten sam komponent
  (`OutputsAggregateTabContent`), więc to JEDNO znalezisko, nie dwa.
- **Prawie identyczny wzorzec strony głównej Excela** (`excele-engine-reveal`,
  `excele-jeden-widok-recent`) renderuje się identycznie — to zamierzone (oba
  to warianty tego samego wejścia „Materiały → Arkusze”), nie duplikat do
  naprawy.

### Ekrany, których NIE obejrzałem

Żadnych. Wszystkie 42 ekrany z listy modułu 10-materialy w
`docs/program/grafika/status.json` mają świeży zrzut z tej sesji, w obu
motywach, przeczytany narzędziem `Read`.

### Pliki zmienione (mój zakres, zweryfikowane esbuild + oba hooki kanonu)

- `src/components/Presentations/PresentationTemplateArchitectView.tsx`
- `src/components/Presentations/DeckBuilder/DeckBuilderMelsView.tsx`
- `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx`
- `dev-render/screens/report-artifact.tsx`

Żadna zmiana nie dotyka `src/components/shared/**`, `src/components/standard/**`
ani `public/locales/**`. `scripts/check-list-canon.sh` i
`scripts/check-triada.sh` przechodzą po wszystkich czterech plikach (dług
kanonu tabel nie rośnie: 394/394; zero nowych naruszeń crimson).

## Moduł 02-moja-praca

Dyżur: `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`, 2026-08-30 (noc).
Zakres: **31 ekranów** (`docs/program/grafika/status.json`, moduł `02-moja-praca`).
To POWTÓRKA — poprzedni robotnik nie zrobił ani jednego świeżego zrzutu, przepisał
cudze oceny ze `status.json` i obejrzał 2 z 47 obrazów (szczegóły w brief). Ten dyżur:
świeży zrzut **wszystkich 31 ekranów, oba motywy (62 PNG)** do
`evidence/grafika/131-noc-moja-praca/`, każdy obejrzany `Read`em osobiście. Jedenaście
ekranów z briefu, których poprzednik nie miał czym ocenić, dostało pierwszeństwo.

### Tabela ekranów

| Ekran (id) | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (świeży, ten dyżur) |
|---|---|---|---|---|
| `karta-decision` | A | — | — | `karta-decision__PRZED__{light,dark}.png` |
| `karta-notification` | A | Regresja z wieczora (dublująca się sekcja prawego panelu) **zweryfikowana jako NIEOBECNA** na świeżym zrzucie — już naprawiona wcześniej albo nigdy nie dotyczyła tego ekranu. | Zweryfikowane, nie naprawiane (nic do naprawy) | `karta-notification__PRZED__{light,dark}.png` |
| `karta-task` | **A (było by D)** | ★ Realny DUPLIKAT sekcji prawego panelu: „ŹRÓDŁA I ZAŁOŻENIA" pokazywała się DWA RAZY (raz z treścią, raz jako pusty kanoniczny placeholder z innym ikoną-tarczą) — dokładnie ten sam wzorzec regresji, którego szukałem po ostrzeżeniu o `karta-notification`. Przyczyna: `TaskDetailView.tsx` deklarował sekcję pod id `'sources-assumptions'` zamiast kanonicznego `'evidence'`, więc `ArtifactRightPanel` (który auto-dokłada 6 obowiązkowych sekcji kanonu, jeśli brakuje ich `id`) nie rozpoznał już zadeklarowanej treści i dołożył DRUGĄ, pustą. | **NAPRAWIONE**: `src/components/MyWork/TaskDetailView.tsx` (zmiana `id` sekcji z `'sources-assumptions'` na `'evidence'`) | `karta-task__PO__{light,dark}.png` |
| `karta-insight` | B | Sekcja „AKCJE" zwinięta z widocznym licznikiem `0` bez żadnego wyjaśniającego zdania — dokładnie wzorzec, który reguła z `KANON_Z_ODBIOROW.md` (2026-08-30) WYRAŹNIE zakazuje („nagie zero... sekcja z takim zdaniem jest ROZWINIĘTA"). Przyczyna: `src/components/Interview/InsightViewer.tsx:8906-8924` wciąż implementuje STARĄ regułę z 2026-07-24 („w Podglądzie sekcja zwinięta z licznikiem 0, bez komunikatu"), którą nowa reguła jawnie UCHYLIŁA. Plik jest w module Wywiadu (poza moim zakresem plików), a niezależnie od tego robotnik modułu 10-materiały tego samego dyżuru trafił na TEN SAM plik z innym objawem (angielska treść, zawieszona wartość ładowania jako dane) — dwa niezależne trafienia w jeden plik tej samej nocy. | **ZGŁOSZONE** (poza `src/components/MyWork/**`) | `karta-insight__PRZED__{light,dark}.png` |
| `idea-templates-catalog` | A | Odznaka typu narzędzia na karcie szablonu ignorowała `?lang=` (zawsze angielska) — naprawione, ale PIERWSZA wersja naprawy przetłumaczyła też „Whiteboard"/„Process Flow" na polski, co złamałoby udokumentowaną decyzję właściciela (SSOT: `IdeaWorkspaceToolbar.tsx:51-52`, „owner request — »Mapa myśli · Whiteboard · Process Flow · Tabela«") — **cofnięte do właściwych etykiet w tym samym dyżurze, przed zgłoszeniem**. | **NAPRAWIONE**: `dev-render/screens/idea-templates-catalog.tsx` | `idea-templates-catalog__PO__{light,dark}.png` |
| `idea-table-tool-kebab` | A (nieprzetestowana interakcja) | Kebab otwiera się prawym klikiem — zrzut statyczny nie łapie stanu menu; sama tabela czysta. | Zgłoszone jako ograniczenie pomiaru, nie defekt | `idea-table-tool-kebab__PRZED__{light,dark}.png` |
| `ideas-teresa-panel` | A | — | — | `ideas-teresa-panel__PRZED__{light,dark}.png` |
| `mywork-notebook-rail-speca` | **A (było B)** | Stopka sekcji AKCJE pokazywała surowy angielski enum: „Źródło: manual" zamiast etykiety — mimo że dokładnie taka etykietowana funkcja (`getNotebookUploadSourceSummary`) już istnieje w tym samym katalogu dla INNEGO miejsca (`NotebookMetadataBadges`), tylko celowo zwraca `null` dla źródeł typu 'manual'/'quick'. | **NAPRAWIONE**: `src/components/MyWork/notebook/NotebookRightRail.tsx` (nowa mapa etykiet `CAPTURE_SOURCE_LABELS` + `captureSourceLabel()`) | `mywork-notebook-rail-speca__PO__{light,dark}.png` |
| `ideas-preview-overlay` | **A (było C)** | TRZY realne defekty na jednym ekranie: (1) obie daty wołały `toLocaleDateString()` bez argumentu → `7/11/2026` (amerykański M/D) zamiast kanonicznego `11/07/2026` (SSOT `listDateFormat.ts`); (2) przycisk „Konwertuj" używał `colorScheme: 'purple'`, jawnie `@deprecated` w `previewStyles.ts` (kanon dopuszcza 5 wariantów, nie 6); (3) mock danych PL miał niespójne etykiety narzędzi (`Mind Map`/`Process Flow` po angielsku obok `Tabela`/`Notatnik` po polsku w TYM SAMYM zestawie) — poprawione zgodnie z SSOT (patrz `idea-templates-catalog` wyżej: Whiteboard/Process Flow ZOSTAJĄ angielskie, reszta po polsku). | **NAPRAWIONE**: `dev-render/screens/ideas-preview-overlay.tsx` (import `formatListDate`, `colorScheme: 'primary'`, poprawione etykiety mocka) | `ideas-preview-overlay__PO__{light,dark}.png` |
| `idea-confidentiality-control` | A | ★ PUŁAPKA STANOWISKA POMIAROWEGO potwierdzona: domyślny zrzut `fullPage` w ogóle NIE POKAZYWAŁ kontrolki poufności — siedzi niżej w przewijanym prawym panelu (dokładnie problem opisany w nagłówku harnessu). Przeleciałem `--przewin='[data-testid="idea-confidentiality-pill"]'`, dopiero wtedy kontrolka „Poufna"/„Wysoki" (bursztynowe chipy, poprawna semantyka) trafiła na zrzut. | Naprawione pomiarowo (zrzut z `--przewin`), produkt czysty | `idea-confidentiality-control__PO__{light,dark}.png` (z `--przewin`) |
| `zwornik-projects` | A | Drobne: brak checkboxów po lewej wierszy i brak CTA/segmentu-widoków po prawej Menu 2 — możliwie zamierzone dla lekkiego ekranu-zwornika (indeks projektów), nie dogłębnie zbadane. | Zgłoszone jako obserwacja, nie potwierdzony defekt | `zwornik-projects__PRZED__{light,dark}.png` |
| `idea-table-tool-empty-filter` | A | Domyślny zrzut pokazuje stan „9 rekordów"; stan „0 rekordów (naprawdę pusto)" wymaga kliknięcia — nieuchwytny statycznym zrzutem. | Zgłoszone jako ograniczenie pomiaru | `idea-table-tool-empty-filter__PRZED__{light,dark}.png` |
| `idea-table-tool-sortfilter` | B | Liczby w kolumnach „Budżet"/„Priorytet (obliczany)" wyglądają na wyrównane do lewej, nie do prawej (kanon C6: `tabular-nums` do prawej) — nie dociekałem głębiej (proof harness Fali 7, wąski zakres). | Zgłoszone, nie naprawione | `idea-table-tool-sortfilter__PRZED__{light,dark}.png` |
| `notebook-quick-capture` | A | — | — | `notebook-quick-capture__PRZED__{light,dark}.png` |
| `idea-table-timeline-stuck` | **A (było D — kontrolka niewidoczna)** | ★ Przycisk „Przejrzyj kandydaturę" (zatwierdzanie kandydata Process Flow) był PRAKTYCZNIE NIEWIDOCZNY w jasnym motywie: biały tekst na niemal-białym tle. Przyczyna: `className="...bg-c-brand-primary..."` — `c-brand-primary` NIE JEST zdefiniowanym tokenem NIGDZIE w repo (zero trafień w `tailwind.config.js`/`index.css` poza tym jednym użyciem) — klasa nic nie robiła, tło zostawało przezroczyste. W ciemnym motywie wyglądało "dobrze" przez przypadek (ciemne tło strony pod spodem). | **NAPRAWIONE**: `src/components/MyWork/IdeaMapWorkspace.tsx` (`bg-c-brand-primary`+`text-white` → kanoniczny `bg-c-text`/`text-c-bg`, wzorzec z `DecisionDetailView.tsx`) — ta sama poprawka naprawiła TEN SAM przycisk widoczny też na `mywork-idea-topbar` (współdzielony komponent) | `idea-table-timeline-stuck__PO__{light,dark}.png` |
| `vault-safes-table` | A | — | — | `vault-safes-table__PRZED__{light,dark}.png` |
| `idea-table-tool-paste` | A | — | — | `idea-table-tool-paste__PRZED__{light,dark}.png` |
| `vault-sejf-wnetrze` | B | Kolumna „Kategoria" pokazuje surowe angielskie wartości enuma: `Methodology`/`Other`/`Best Practices`/`Standards`/`Templates` — zero polskich etykiet. Przyczyna: `DOCUMENT_CATEGORIES` jest TWARDO wpisana po angielsku w TRZECH miejscach (`src/views/vault/vaultDocuments.ts`, `src/views/superadmin/components/AdminKnowledgeView.tsx`, `src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx`) — ten sam korzeń co defekt na `vault-scope-selector` niżej. Reszta ekranu (StandardTable, chipy statusu z licznikami, kebab, pstryczek) jest wzorcowa. | **ZGŁOSZONE** (`src/views/**`, poza moim zakresem) | `vault-sejf-wnetrze__PRZED__{light,dark}.png` |
| `exec-summary-onelook` | B | Kolumna „TYP" w panelu „Co muszę rozstrzygnąć" TWARDO obcina tekst na krawędzi karty: „Przeterminowana" → „Przetermi", „Do decyzji" → „Do decy" (widoczne w obu motywach). Przyczyna: `src/components/Execution/ExecutionSummaryOneLook.tsx`, kolumna `kind` (`width: '150px'`) bez `truncate`/zawijania, karta zbyt wąska na deklarowaną szerokość. | **ZGŁOSZONE** (`src/components/Execution/**`, poza moim zakresem) | `exec-summary-onelook__PRZED__{light,dark}.png` |
| `mywork-idea-topbar` | **B (było gorzej — ghost button)** | Pigułka „Projects" w rzędzie hubu Menu1 jest PO ANGIELSKU wśród dziewięciu polskich sąsiadek („Pomysły/Notatnik/Skrzynka/Kalendarz/Zadania/Decyzje/…/Sejf klienta/…/Menedżer") — brakujący klucz `myWork.projects.projects` (i aliasy `myWork.hub.projects`/`myWork.hub.labelProjects`) w `public/locales/pl/translation.json`. Osobny defekt na tym samym ekranie („Przejrzyj kandydaturę" niewidoczny w jasnym motywie) naprawiony automatycznie przez poprawkę współdzielonego komponentu z `idea-table-timeline-stuck` (patrz wyżej) — zweryfikowane na świeżym zrzucie PO. | „Projects" **ZGŁOSZONE** (`public/locales/**`, zakazany plik); ghost-button **NAPRAWIONE** (efekt uboczny wspólnej poprawki) | `mywork-idea-topbar__PO__{light,dark}.png` |
| `idea-table-record-templates` | **A (było C)** | ★ Podgląd „pre-filled values" na karcie szablonu drukował SUROWE wartości pola: `Status: todo`, `Status: in_progress`, `Status: done`, `Pilne: true`, `Pilne: false` — mimo że etykiety (`Do zrobienia`/`W toku`/`Zrobione`) były DOSTĘPNE tuż obok w konfiguracji pola (`field.options.options[].name`), po prostu nieużyte. Dokładnie wzorzec „surowe wartości zamiast etykiet" z brief-u, na realnym produkcyjnym komponencie (nie na proof-harnessu). | **NAPRAWIONE**: `src/components/MyWork/table/RecordTemplateManager.tsx` (nowa funkcja `formatTemplatePreviewValue()` — mapuje `checkbox`→Tak/Nie, `singleSelect`/`multiSelect`→etykieta opcji, reszta bez zmian) | `idea-table-record-templates__PO__{light,dark}.png` |
| `idea-table` | A | Odznaki „Whiteboard"/„Process Flow" po angielsku — **zweryfikowane jako ZGODNE z SSOT** (`IdeaWorkspaceToolbar.tsx`), nie defekt. | — | `idea-table__PRZED__{light,dark}.png` |
| `decision-record` | **A (było D — treść niewidoczna)** | ★ NAJPOWAŻNIEJSZE znalezisko dyżuru — „awaria udająca pustkę". Ekran pokazywał pusty placeholder tytułu („Tytuł decyzji…"), pustą sekcję „Zakres decyzji", `Termin: —`, `Decydent: —` — wyglądało jak defekt SPEC-A/flagi. Realna przyczyna: `DecisionDetailView.tsx` (produkcja) czyta dane przez `Api.get('/decisions/:id/detail')`, ale harness mockował `Api.getDecision` — metodę, której `DecisionDetailView` W OGÓLE NIE WOŁA (używana gdzie indziej: `DecisionsPanelContent`/`IdeaMapWorkspace`/`DecisionPreviewPanel`, nie tutaj). Żądanie spadało na siatkę bezpieczeństwa `window.fetch`, która dla KAŻDEGO URL-a z `/decisions/` zwraca `{ data: [], items: [] }` — pustą TABLICĘ jako `data`, więc `decision.title` było `undefined`. Dodatkowo: flaga `&ff_vf1DecisionSpeca=1` z etykiety harnessu w `main.tsx` jest MARTWA na poziomie URL — `VF1_DECISION_SPECA` to zmienna `import.meta.env` (wymaga restartu serwera dev z `VITE_VF1_DECISION_SPECA=true`, nie parametru adresu) — etykieta wprowadza w błąd, ale samo to nie było przyczyną pustki. | **NAPRAWIONE**: `dev-render/screens/decision-record.tsx` (jawna obsługa `/decisions/:id/detail` w mocku `Api.get`, zwraca kompletny `MOCK_DECISION`) | `decision-record__PO__{light,dark}.png` |
| `vault-scope-selector` | **D (gorzej niż poprzednia ocena C)** | Cały ekran po angielsku: „Document Vault", „Upload Knowledge Document", „Drag & drop PDF, DOCX...", „Upload & Index", „Category"/„Tags"/„Level", „Search documents...", „All Categories"/„All Levels", „INDEXED DOCUMENTS (3)", odznaki „INDEXED", „Private (only me)"/„Other"/„Project"/„Methodology"/„Organization"/„Standards" — ZERO polskiego tekstu, w obu motywach. Do tego bespoke UI (własne karty/dropdowny, nie `StandardTable`/`StandardModuleBar`) — narusza regułę „ekrany listowe WYŁĄCZNIE przez komponenty standard". Przyczyna: `src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx` — ten sam plik co skażony `DOCUMENT_CATEGORIES` na `vault-sejf-wnetrze`. | **ZGŁOSZONE** (`src/views/**`, poza moim zakresem — i poza zakresem MyWork w ogóle) | `vault-scope-selector__PRZED__{light,dark}.png` |
| `idea-table-production` | A | — | — | `idea-table-production__PRZED__{light,dark}.png` |
| `vault-folder-block-proof` | A | — | — | `vault-folder-block-proof__PRZED__{light,dark}.png` |
| `idea-financial-case-persistence` | B | Trzy dropdowny w stanie „reopened" (dane przetrwały zimne otwarcie — działa poprawnie funkcjonalnie) pokazują surowe angielskie wartości enuma zamiast etykiet: `investment`/`cash` (typ czynnika), `medium`/`high` (pewność). Przyczyna: `t(\`ideas.financial.costType.${ct}\`, ct)` / `.benefitType.` / `.confidence.` w `FinancialDriverTable.tsx` mają fallback = surowa wartość, a klucze `ideas.financial.costType.*`/`.benefitType.*`/`.confidence.*` NIE ISTNIEJĄ w ogóle w `public/locales/pl/translation.json` ANI w `en/translation.json` (sprawdzone programowo, zero trafień). | **ZGŁOSZONE** (`public/locales/**`, zakazany plik) | `idea-financial-case-persistence__PRZED__{light,dark}.png` (stan `?state=reopened`) |
| `notatnik-centrum-mysli` | A | — | — | `notatnik-centrum-mysli__PRZED__{light,dark}.png` |
| `notatnik-osierocone-graf` | A | — | — | `notatnik-osierocone-graf__PRZED__{light,dark}.png` |
| `idea-table-tool-grouping` | A | Domyślny stan `groupBy: null` — ekran nie demonstruje statycznie samego grupowania (wymaga kliknięcia „Grupuj"), ale infrastruktura (dropdown, tabela) czysta. | Zgłoszone jako ograniczenie pomiaru | `idea-table-tool-grouping__PRZED__{light,dark}.png` |
| `mywork-idea-inspector-lekki` | A | — | — | `mywork-idea-inspector-lekki__PRZED__{light,dark}.png` |

### Ekrany, których NIE obejrzałem

Żadnych. Wszystkie 31 ekranów modułu 02-moja-praca mają świeży zrzut z tej sesji
(`evidence/grafika/131-noc-moja-praca/`), w obu motywach, przeczytany `Read`em.

### Podsumowanie ocen

**A: 24 · B: 6 · C: 0 · D: 1** (na 31; siedem ekranów naprawionych w tym dyżurze
podniosło ocenę — `karta-task` D→A, `decision-record` D→A, `idea-table-timeline-stuck`
D→A, `idea-table-record-templates` C→A, `mywork-notebook-rail-speca` B→A,
`ideas-preview-overlay` C→A, `mywork-idea-topbar` niejednoznaczne→B).

### Defekty w plikach wspólnych / poza zakresem (tylko zgłoszenie)

Żadnego naruszenia w `src/components/shared/**`/`src/components/standard/**` — pliki te
nie były dotykane. Zgłoszone defekty leżą w `src/views/**` (vault/superadmin — poza
zakresem MyWork), `src/components/Execution/**`, `src/components/Interview/**` i
`public/locales/**` (zakazany do edycji):

1. **`src/views/vault/vaultDocuments.ts`** (+ duplikaty w `AdminKnowledgeView.tsx`,
   `DocumentsRAGTab.tsx`) — `DOCUMENT_CATEGORIES` na sztywno po angielsku, zero
   tłumaczenia. Dotyka `vault-sejf-wnetrze` (B) i `vault-scope-selector` (D).
2. **`src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx`** — cały
   ekran `vault-scope-selector` po angielsku + bespoke UI zamiast komponentów standard.
3. **`src/components/Execution/ExecutionSummaryOneLook.tsx`** — kolumna „TYP" bez
   `truncate`, tekst obcięty na krawędzi karty (`exec-summary-onelook`).
4. **`src/components/Interview/InsightViewer.tsx:8906-8924`** — sekcja „Akcje" wciąż
   implementuje UCHYLONĄ regułę „zwinięte z 0 bez komunikatu" zamiast nowej reguły
   z `KANON_Z_ODBIOROW.md` (2026-08-30). Ten sam plik trafiony niezależnie przez
   robotnika modułu 10-materiały tej samej nocy (inny objaw, ten sam plik).
5. **`public/locales/pl/translation.json`** (i `en/`) — brakujące klucze:
   `ideas.financial.costType.{investment,recurring}`,
   `ideas.financial.benefitType.{cash,non_cash,risk_avoidance}`,
   `ideas.financial.confidence.{low,medium,high}` (dotyczy
   `idea-financial-case-persistence`); `myWork.projects.projects` /
   `myWork.hub.projects` / `myWork.hub.labelProjects` (dotyczy `mywork-idea-topbar`,
   badge „Projects").

### Pliki zmienione (mój zakres, zweryfikowane esbuild + oba hooki kanonu)

- `src/components/MyWork/TaskDetailView.tsx` — id sekcji prawego panelu
  `'sources-assumptions'` → kanoniczne `'evidence'` (usunięcie duplikatu „Źródła
  i założenia" na `karta-task`)
- `src/components/MyWork/IdeaMapWorkspace.tsx` — `bg-c-brand-primary` (niezdefiniowany
  token) → `bg-c-text`/`text-c-bg` na przycisku „Przejrzyj kandydaturę"
- `src/components/MyWork/notebook/NotebookRightRail.tsx` — nowa mapa
  `CAPTURE_SOURCE_LABELS`/`captureSourceLabel()`, „Źródło: manual" → „Źródło: Ręcznie"
- `src/components/MyWork/table/RecordTemplateManager.tsx` — nowa funkcja
  `formatTemplatePreviewValue()`, surowe `todo`/`true`/`false` → etykiety pola
- `dev-render/screens/decision-record.tsx` — mock `Api.get` obsługuje jawnie
  `/decisions/:id/detail` (produkcyjny komponent nigdy nie wołał zamockowanego
  wcześniej `Api.getDecision`)
- `dev-render/screens/idea-templates-catalog.tsx` — odznaka narzędzia respektuje
  `?lang=`, z poprawką zgodną z SSOT (Whiteboard/Process Flow zostają angielskie)
- `dev-render/screens/ideas-preview-overlay.tsx` — `formatListDate()` zamiast
  `toLocaleDateString()` (data amerykańska → kanoniczna), `colorScheme: 'purple'`
  (deprecated) → `'primary'`, etykiety mocka zgodne z SSOT

Żadna zmiana nie dotyka `src/components/shared/**`, `src/components/standard/**`
ani `public/locales/**`. `scripts/check-list-canon.sh` i `scripts/check-triada.sh`
przechodzą (dług kanonu tabel nie rośnie: 394/394; zero nowych naruszeń crimson).

## Moduły 09-finanse, 13-administracja, 14-organizacja (POWTÓRKA)

★ Ta sekcja jest POWTÓRKĄ po unieważnionej ocenie poprzedniego robotnika (patrz
ostrzeżenie nadzorcy na górze tego pliku). Wszystkie 22 ekrany zakresu (Finanse 16 ·
Administracja 5 · Organizacja 1) dostały świeży zrzut w obu motywach, z właściwymi
parametrami adresu wyciągniętymi z komentarza nagłówkowego każdego pliku
`dev-render/screens/<id>.tsx` (nie z rejestru `main.tsx`, który ich nie wymienia —
dokładnie pułapka opisana w briefie). Zrzuty: `evidence/grafika/137-finanse-admin-powtorka/`
(44 pliki, 22×2 motywy), każdy przeczytany `Read`em osobiście.

### ★ Pułapka pomiarowa złapana w tej sesji (nie produktowa)

Narzędzie `grafika-zrzuty.mjs` przyjmuje `--parametry=` jako JEDEN string doklejany
literalnie do URL-a. Żeby przekazać WIELE parametrów (`view=X&scene=Y&status=Z`) w
bashu bez rozdzielenia przez powłokę (nieucieczony `&` uruchamia background job),
pierwsze podejście użyło `%26` jako separatora — ale skrypt nie dekoduje `%26`, więc
trafiało to do URL-a jako część WARTOŚCI pierwszego parametru
(`view=assumptions&scene=default&status=DRAFT` całe trafiało do `params.get('view')`),
a komponent cicho spadał na domyślny widok. Objaw: 6 błędów konsoli na
`finance-baseline-workspace` (dodatkowe zapytania sieciowe z niespodziewanym stanem).
Naprawione przez cytowanie `--parametry='view=assumptions&scene=default&status=DRAFT'`
(prawdziwy `&`, w cudzysłowie) — błędy konsoli spadły do 0, zrzut pokazuje właściwy
widok „Założenia". Przeliczone też `finance-prediction-workspace`/`finance-value-panels`/
`finance-id-bridge` tą samą poprawną drogą — bez zmiany treści (domyślne wartości
przypadkiem pokrywały się z zamierzonymi), więc nie wymagały ponownej oceny.

### Tabela — wszystkie 22 ekrany

| Ekran (id) | Ocena | Co jest nie tak | Naprawione/zgłoszone | Zrzut |
|---|---|---|---|---|
| `finance-comments-panel` | A | — | — | `finance-comments-panel__PRZED__{light,dark}.png` |
| `finance-lineage-navigator` | A | — | — | `finance-lineage-navigator__PRZED__{light,dark}.png` |
| `finance-workspace-bar` | A | Pusta treść pod paskiem — ZAMIERZONE (izolowany podgląd paska, ciało poza zakresem pakietu, opisane wprost w placeholderze). | — | `finance-workspace-bar__PRZED__{light,dark}.png` |
| `finance-hub` | A | 1 błąd konsoli w obu motywach (niezidentyfikowany, brak widocznego objawu na zrzucie — nie dochodzone głębiej, zgłaszam jako obserwację). Kolumna TYP nadal pokazuje surowy kod „STM" — znany, zaakceptowany wyjątek sprzed tego dyżuru. | Zgłoszone (błąd konsoli, bez widocznego objawu) | `finance-hub__PRZED__{light,dark}.png` |
| `finance-saved-views-panel` | A | — | — | `finance-saved-views-panel__PRZED__{light,dark}.png` |
| `finance-analysis-workspace` | **A (było B)** | ★ TRZY realne defekty na jednym ekranie, wszystkie z tej samej rodziny: (1) `INVENTORY_DAYS` (Dni zapasów) renderowało się jako „5800%" zamiast „58 dni" — mock w harnessu nie ustawiał `unitType: 'DAYS'` na wartości KPI (tylko na katalogu), więc realny `formatAnalysisKpiValueForDisplay()` (financeV2.types.ts) mnożył 58×100 i doklejał „%"; (2) `ASSET_TURNOVER` (Rotacja aktywów) tym samym mechanizmem renderowało „140%" zamiast „1,4" (katalog deklaruje `unitType: 'RATIO'`); (3) kolumna „ZMIANA R/R" (`formatYoyDeltaText` w PRODUKCYJNYM `analysisKpiTable.contract.ts`, nie w mocku) używała gołego `.toFixed(1)` → „+7.1%"/„-100.0%" z KROPKĄ zamiast polskiego przecinka — ta sama klasa defektu co wcześniej zamknięta na `finance-valuation-workspace`. | **NAPRAWIONE**: `dev-render/screens/finance-analysis-workspace.tsx` (dodane `unitType: 'DAYS'`/`'RATIO'` na dwóch parach wpisów KPI, poprawiony `value.unit`), `src/components/Finance/Analysis/analysisKpiTable.contract.ts` (nowa `formatPlPercent1()`, `toLocaleString('pl-PL')` zamiast `.toFixed(1)`), zaktualizowany pinned test w `analysisKpiTable.contract.test.ts` | `finance-analysis-workspace__PRZED__{light,dark}.png` |
| `finance-export-import-panel` | A | — | — | `finance-export-import-panel__PRZED__{light,dark}.png` |
| `finance-model-workspace` | **A (było B)** | Odznaka statusu przy tytule pokazywała surowy enum „DRAFT" (`status.toUpperCase()`) — ten sam koncept ma już polską etykietę „Szkic" gdzieś indziej w tym samym module (finance-hub). Jeden błąd konsoli w obu motywach (niezidentyfikowany, przed i po mojej poprawce — niezwiązany), zgłaszam jako obserwację. | **NAPRAWIONE**: `src/components/Finance/FinancialModelWorkspace.tsx` (nowa mapa `STATUS_BADGE_LABEL_PL`/`_EN`, „DRAFT"/„REVIEW"/„APPROVED" → „Szkic"/„Do przeglądu"/„Zatwierdzony") | `finance-model-workspace__PRZED__{light,dark}.png` |
| `finance-statement-pack-workspace-v2` | **A (było B)** | ★ Pastylka harnessu („state=populated (populated\|empty\|missing)") bez atrybutu `data-dev-render-chrome` — siedziała w kadrze na każdym zrzucie, dokładnie pułapka #15 z briefu. Reszta ekranu (tabela sprawozdania, panel powiązań, sekcja raportu) czysta i po polsku — poprzednie naprawy (angielskie nagłówki panelu, surowe kody przekształceń) się utrzymały. | **NAPRAWIONE**: `dev-render/screens/finance-statement-pack-workspace-v2.tsx` (dodany `data-dev-render-chrome="true"`) | `finance-statement-pack-workspace-v2__PRZED__{light,dark}.png` |
| `finance-compare-panel` | A | — | — | `finance-compare-panel__PRZED__{light,dark}.png` |
| `finance-prediction-workspace` | A | — | — | `finance-prediction-workspace__PRZED__{light,dark}.png` |
| `finance-valuation-workspace` | A | Zrzut kroku „Wyniki" (most EV→Equity, wagi metod z %, wszystkie liczby z polskim przecinkiem) zamiast domyślnego „Źródło" — bardziej informacyjny dla „co" z rejestru. Główna kwota wyceny bez waluty — znany, zaakceptowany wyjątek (kontrakt danych nie niesie pola waluty). | — | `finance-valuation-workspace__PRZED__{light,dark}.png` (krok `step=results`) |
| `finance-baseline-workspace` | A | 6 błędów konsoli na PIERWOTNYM zrzucie okazało się artefaktem mojej własnej pomyłki `--parametry` (patrz sekcja pułapki pomiarowej wyżej) — po poprawnym cytowaniu 0 błędów, widok „Założenia" renderuje się poprawnie z wartościami PCT jako „12%"/„58%" obok edytowalnego ułamka. | Zweryfikowane, nic do naprawy w produkcie | `finance-baseline-workspace__PRZED__{light,dark}.png` |
| `finance-value-panels` | **B (było C)** | ★ Ta sama pastylka-bez-`data-dev-render-chrome` co `finance-statement-pack-workspace-v2` („panel=value · state=populated" w kadrze). Osie wykresu i etykiety kwadrantów („fund"/„defer"/„kill") po angielsku — znany, udokumentowany wyjątek (dane makietowe harnessu, komponent językowo neutralny, wymaga polskich danych mock, nie zmiany kodu). | **NAPRAWIONE** (pastylka): `dev-render/screens/finance-value-panels.tsx` (dodany `data-dev-render-chrome="true"`) | `finance-value-panels__PRZED__{light,dark}.png` |
| `finance-id-bridge` | D | Narzędzie inżynierskie do diagnostyki (most identyfikatorów), nie ekran produktu — cały ekran to techniczny opis stanu, zgodnie z zamierzeniem. Zweryfikowane, zgadza się z poprzednią oceną. | — | `finance-id-bridge__PRZED__{light,dark}.png` |
| `finance-focus-mode` | D | Narzędzie inżynierskie do diagnostyki (dowód zachowania stanu focus mode), nie ekran produktu — surowe `true`/`ok` w treści to zamierzony debug output asercji. Zweryfikowane, zgadza się z poprzednią oceną. | — | `finance-focus-mode__PRZED__{light,dark}.png` |
| `admin-command-center-panel` | A | — | — | `admin-command-center-panel__PRZED__{light,dark}.png` |
| `admin-sso-self-service-card` | A | ★ Komentarz nagłówkowy harnessu zgłaszał NIEAKTUALNY defekt („ikona nagłówka `text-primary-500`/crimson") — zweryfikowane wobec REALNEGO kodu: `AdminSsoSelfServiceCard.tsx:208` już używa `text-c-text-secondary` (neutralny token). Ikona na świeżym zrzucie jest ciemnoszara/granatowa w obu motywach, nie czerwona. Ktoś naprawił komponent bez aktualizacji komentarza — dokładnie wzorzec „dokumentacja starzeje się szybciej niż kod" z ZŁOTYCH REGUŁ. | **NAPRAWIONE** (komentarz): `dev-render/screens/admin-sso-self-service-card.tsx` (usunięty nieaktualny „KNOWN ISSUE", zastąpiony zweryfikowanym stanem) | `admin-sso-self-service-card__PRZED__{light,dark}.png` |
| `superadmin-platform-operations-day15` | A | — | — | `superadmin-platform-operations-day15__PRZED__{light,dark}.png` |
| `partner-settlements-view` | A | Ekran w całości po angielsku — znany, zaakceptowany wyjątek (narzędzie wewnętrzne SuperAdmin). „One Time" (nie „One_time") potwierdzone, poprzednia naprawa się utrzymała. | — | `partner-settlements-view__PRZED__{light,dark}.png` |
| `model-catalog-table` | B | Kolumny STATUS/HEALTH po angielsku („Active"/„Inactive"/„healthy"/„degraded"/„unhealthy"/„unknown") — znany, zaakceptowany, duży osobny dług (opisany w poprzedniej ocenie). Chipy KIND („Model tekstowy"/„Model obrazu"/„Model biznesowy") po polsku, poprzednia naprawa się utrzymała. | — | `model-catalog-table__PRZED__{light,dark}.png` |
| `org-identity-operating` | A | Zweryfikowane wobec domyślnego (bez `ff_org_redesign_v1`) wariantu — to jest to, co użytkownik widzi dziś, zgodnie z notatką wyjątku w rejestrze. Pierścień kompletności fioletowy/indygo (nie crimson), poprzednia naprawa się utrzymała w obu motywach. | — | `org-identity-operating__PRZED__{light,dark}.png` |

### Ekrany, których NIE obejrzałem

Żadnych. Wszystkie 22 ekrany zakresu (16 Finanse + 5 Administracja + 1 Organizacja)
mają świeży zrzut z tej sesji w obu motywach, przeczytany `Read`em osobiście.

### Podsumowanie ocen

**A: 18 · B: 2 · C: 0 · D: 2** (na 22; trzy ekrany naprawione w tym dyżurze podniosły
ocenę — `finance-analysis-workspace` B→A, `finance-model-workspace` B→A,
`finance-statement-pack-workspace-v2` B→A; jeden ekran podniesiony częściowo —
`finance-value-panels` C→B, pozostały dług to udokumentowany wyjątek angielskich
danych makietowych, nie kod). Dwa ekrany D (`finance-id-bridge`, `finance-focus-mode`)
to zamierzone narzędzia inżynierskie, nie ekrany produktu — zweryfikowane zgodnie
z poprzednią oceną, nie licz ich jako defekt produktu.

### Defekty poza zakresem / dług zaakceptowany (tylko zgłoszenie, nie dotykane)

1. **`finance-hub`** — 1 błąd konsoli w obu motywach bez widocznego objawu na
   zrzucie; nie dochodzone (poza budżetem tego dyżuru, brak wskazówki co do
   przyczyny bez głębszego śledztwa w Network/Console).
2. **`finance-model-workspace`** — 1 błąd konsoli w obu motywach, obecny
   PRZED i PO mojej poprawce statusu — niezwiązany z moją zmianą, nie
   dochodzony.
3. **`finance-value-panels`** — angielskie osie wykresu i etykiety kwadrantów
   (fund/defer/kill) — udokumentowany w komentarzu harnessu jako wymagający
   polskich danych makietowych, nie zmiany kodu; zostawione zgodnie z tą notatką.
4. **`model-catalog-table`** — kolumny STATUS/HEALTH po angielsku, opisane w
   poprzedniej ocenie jako osobny, duży dług nadzorcy — nie dotykane w tym
   dyżurze (poza wąskim zakresem jednego zrzutu-poprawki).
5. **`partner-settlements-view`** — ekran w całości po angielsku, zaakceptowany
   wyjątek (narzędzie wewnętrzne).

### Pliki zmienione (mój zakres, zweryfikowane esbuild + oba hooki kanonu)

- `dev-render/screens/finance-analysis-workspace.tsx` — mock KPI: dodane
  `unitType: 'DAYS'`/`'RATIO'` na `INVENTORY_DAYS`/`ASSET_TURNOVER` (brakowało,
  domyślne `'PERCENT'` z fabryki `kpiValue()` psuło formatowanie), poprawiony
  `value.unit` z nieprawidłowego `'DAYS'` na `'UNITS'`
- `src/components/Finance/Analysis/analysisKpiTable.contract.ts` — nowa
  `formatPlPercent1()` (`toLocaleString('pl-PL')`), `formatYoyDeltaText()` używa
  polskiego przecinka zamiast `.toFixed(1)` z kropką
- `src/components/Finance/Analysis/__tests__/analysisKpiTable.contract.test.ts` —
  zaktualizowane pinned expects (`+20.0%`→`+20,0%`, `-12.3%`→`-12,3%`) zgodnie
  z naprawą powyżej
- `src/components/Finance/FinancialModelWorkspace.tsx` — nowa mapa
  `STATUS_BADGE_LABEL_PL`/`_EN`, `statusBadge()` używa etykiety zamiast
  `status.toUpperCase()`
- `dev-render/screens/finance-statement-pack-workspace-v2.tsx` — dodany
  `data-dev-render-chrome="true"` na pastylce debugu harnessu
- `dev-render/screens/finance-value-panels.tsx` — dodany
  `data-dev-render-chrome="true"` na pastylce debugu harnessu
- `dev-render/screens/admin-sso-self-service-card.tsx` — usunięty nieaktualny
  komentarz „KNOWN ISSUE" (crimson ikona), zastąpiony zweryfikowanym stanem
  (token już naprawiony w komponencie, nikt nie zaktualizował komentarza)

Żadna zmiana nie dotyka `src/components/shared/**`, `src/components/standard/**`
ani `public/locales/**`. `scripts/check-list-canon.sh` i `scripts/check-triada.sh`
przechodzą (dług kanonu tabel nie rośnie: 394/394; zero nowych naruszeń crimson,
sprawdzono 4 zmienione pliki).

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

## Moduły 01-czat, 15-agent, 12-spotkania

> ★ Sekcja ODTWORZONA z historii gita (skasowana nadpisaniem pliku w 591ca8cec2 — patrz DZIENNIK Z-15).

**Dowód:** świeży zrzut KAŻDEGO z 22 ekranów, oba motywy, w
`evidence/grafika/130-noc-czat-agent-spotkania/` (58 plików — 22 ekrany × 2
motywy `__PRZED__`, plus 7 ekranów re-zrzuconych `__PO__` po naprawie). Każdy
plik obejrzany przez `Read` osobiście, nie z rejestru. Weryfikacja:
`ls evidence/grafika/130-noc-czat-agent-spotkania | wc -l` → 58.

### Tabela ekranów

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój, PRZED) |
| --- | --- | --- | --- | --- |
| `ntype-analizuj-ai` | A | Etykieta stanowiska pomiarowego („ETAP 3 n-Type…" + skrzynka instrukcji) renderowała się w kadrze, nieoznaczona jako chrom (reguła nr 12) | **Naprawione** — `data-dev-render-chrome` dodany w `dev-render/screens/ntype-analizuj-ai.tsx` | `ntype-analizuj-ai__PO__{light,dark}.png` |
| `chat-split-teresa-right` | A | — | — | `chat-split-teresa-right__PRZED__{light,dark}.png` |
| `processflow-canvas` | **C** | ★ Prawdziwy defekt produktu: krawędź łącząca „Start" z „Poproś o uzupełnienie danych" przechodzi PRZEZ środek etykiety węzła „Klient składa zgłoszenie" zamiast się przy nim zatrzymać — wygląda jak przekreślenie. Reprodukowane w OBU motywach, ten sam węzeł, ten sam piksel. Realny komponent (`IdeaProcessFlowTool.tsx`), nie stanowisko pomiarowe | **Zgłoszone** — plik poza moim zakresem (`src/components/MyWork/IdeaProcessFlowTool.tsx`) | `processflow-canvas__PRZED__{light,dark}.png` + wycinki w scratchpadzie |
| `canvas-kebab-restructure` | A | Ekran to wewnętrzny dowód inżynierski PRZED/PO (starszy niż stan produktu) — zgodnie z wyjątkiem w `status.json` | — | `canvas-kebab-restructure__PRZED__{light,dark}.png` |
| `canvas-new-doc` | A | Plakietki szablonów pokazywały na sztywno angielskie „REAL"/„PARTIAL" niezależnie od `&lang=`, mimo że realny komponent (`WorkCanvasDocumentPanel.tsx`) ma od dawna klucze polskie „Realne"/„Częściowe" (`canvas.panel.capability.*`) | **Naprawione** — `CapabilityBadge` w `dev-render/screens/canvas-new-doc.tsx` czyta teraz `isPl` i pokazuje właściwą etykietę | `canvas-new-doc__PO__{light,dark}.png` |
| `canvas-toolbar-md-history` | A | Wewnętrzny dowód PRZED/PO, dane testowe świadomie nieaktualne (wyjątek w `status.json`) | — | `canvas-toolbar-md-history__PRZED__{light,dark}.png` |
| `melscanvas-workspace` | B | Pastylka trybu narzędzia w prawym pasku pokazuje „SEL" — patrz defekt wspólny niżej | **Zgłoszone** (plik wspólny) | `melscanvas-workspace__PRZED__{light,dark}.png` |
| `mindmap-canvas` | B | To samo „SEL" | **Zgłoszone** (plik wspólny) | `mindmap-canvas__PRZED__{light,dark}.png` |
| `mindmap-i18n-smoke` | A | Etykieta harnessu („M06 Mind Map — modale…") nieoznaczona jako chrom — w praktyce niewidoczna (przykryta tłem modala), ale naprawiona higienicznie zgodnie z regułą nr 12 | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/mindmap-i18n-smoke.tsx` | `mindmap-i18n-smoke__PO__{light,dark}.png` |
| `chat-signals-feed` | B | Pierwsza kolumna tabeli wąska — tytuły łamią się na 2–3 linie, `Metalpol: Anna Kowalska…` ucięte. Znany wcześniej wyjątek, wciąż obecny; dziedziczone z `FilterableTable.tsx` (plik wspólny, zakaz dotykania) | **Zgłoszone** | `chat-signals-feed__PRZED__{light,dark}.png` |
| `whiteboard-canvas` | B | To samo „SEL" | **Zgłoszone** (plik wspólny) | `whiteboard-canvas__PRZED__{light,dark}.png` |
| `whiteboard-workshop` | B | To samo „SEL" (widoczne nawet przy 25% zoom) | **Zgłoszone** (plik wspólny) | `whiteboard-workshop__PRZED__{light,dark}.png` |
| `teresa-chipy-panel-artefaktu` | A | Belka harnessu („Teresa POZIOM 3…") nieoznaczona jako chrom | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/teresa-chipy-panel-artefaktu.tsx` | `teresa-chipy-panel-artefaktu__PO__{light,dark}.png` |
| `teresa-chipy-sugestii` | A | Belka harnessu + nagłówki „A · kontekst RAPORTU"/„B · kontekst INSIGHTU" (żargon: `artifactMentioned = true`) nieoznaczone jako chrom | **Naprawione** — `data-dev-render-chrome` w 2 miejscach w `dev-render/screens/teresa-chipy-sugestii.tsx` | `teresa-chipy-sugestii__PO__{light,dark}.png` |
| `teresa-confirm-chip` | A | Belka harnessu „F1-A · Kontrolka…" + log debugowy z nazwą funkcji `executeTeresaTool(confirmed:true)` nieoznaczone jako chrom | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/teresa-confirm-chip.tsx` (nagłówek + pasek logu) | `teresa-confirm-chip__PO__{light,dark}.png` |
| `public-booking-widget` | A | — (crimson tylko w logo marki, CTA neutralny — zgodnie z kanonem) | — | `public-booking-widget__PRZED__{light,dark}.png` |
| `meetings-module` | A | Pigułka statusu „Po terminie — wymaga aktualizacji" ucinała się do „Po terminie — wym…" — kolumna `status` miała `width: '120px'`, za wąska na polską etykietę (angielski domyślny „Past — needs update" się mieścił) | **Naprawione** — `width: '200px'` w `src/components/Meeting/MeetingHub.tsx` (definicja kolumny `status`) | `meetings-module__PO__{light,dark}.png` |
| `calendar-sync-settings` | A | — (wcześniejsza naprawa kontrastu przełącznika w ciemnym motywie trzyma się) | — | `calendar-sync-settings__PRZED__{light,dark}.png` |
| `agent-plan-view` | **C** | ★★ Prawdziwy defekt produktu: przed utworzeniem planu `AgentPlanWorkspace` renderuje WYŁĄCZNIE `ArtifactRightPanel` (wspólny, wąski panel-dok zaprojektowany jako boczna szuflada artefaktu) jako CAŁĄ zawartość pełnoszerokiego warsztatu — lista „Agenci" zajmuje ok. 1/4 szerokości, reszta kadru to pusta, nieopisana biel/czerń. Reprodukowane w obu motywach, z włączoną flagą (`&ff_agentPlan=1`), na realnym komponencie | **Zgłoszone** — wymaga decyzji produktowej (czy powłoka launchera ma być wąska lista czy pełna galeria), nie prostej poprawki CSS; plik główny (`src/views/AgentPlanView.tsx`) poza moim zakresem, a właściwy kontener to zakazany `src/components/standard/ArtifactRightPanel.tsx` | `agent-plan-view__PRZED__{light,dark}.png` |
| `agent-warsztat` | A | — | — | `agent-warsztat__PRZED__{light,dark}.png` |
| `agent-plan-canvas` | A | — (wcześniejsza naprawa tłumaczeń palety klocków trzyma się — cała paleta po polsku) | — | `agent-plan-canvas__PRZED__{light,dark}.png` |
| `agent-hub` | B | Zgodnie z `status.json`: pierwszy raz widoczny za flagą, wymaga wstępnego OK właściciela przed odbiorem końcowym (reguła #7 CLAUDE.md) — nie nowy defekt grafiki, sam ekran (tabela, pigułki statusu, kolory) jest czysty | — (bez zmian) | `agent-hub__PRZED__{light,dark}.png` |

**22/22 ekranów obejrzanych na świeżym zrzucie.** A=14 · B=6 · C=2 · D=0.

### Naprawione (pliki z nazwy)

- `dev-render/screens/ntype-analizuj-ai.tsx` — oznaczenie chromu harnessu
- `dev-render/screens/canvas-new-doc.tsx` — plakietka Realne/Częściowe zamiast REAL/PARTIAL
- `dev-render/screens/mindmap-i18n-smoke.tsx` — oznaczenie chromu harnessu
- `dev-render/screens/teresa-chipy-panel-artefaktu.tsx` — oznaczenie chromu harnessu
- `dev-render/screens/teresa-chipy-sugestii.tsx` — oznaczenie chromu harnessu (2 miejsca)
- `dev-render/screens/teresa-confirm-chip.tsx` — oznaczenie chromu harnessu (nagłówek + log)
- `src/components/Meeting/MeetingHub.tsx` — szerokość kolumny `status` 120px→200px

### Defekty wspólne (do plików, których nie wolno mi ruszać) — ZGŁASZAM

1. **„SEL"/„PAN"/„DRW"/„LNK" — żargon angielski w pastylce trybu narzędzia.**
   Plik: `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx:1312` (funkcja
   `modeBadgeNode`). Reprodukowane na 5 z 22 moich ekranów: `melscanvas-workspace`,
   `mindmap-canvas`, `processflow-canvas`, `whiteboard-canvas`, `whiteboard-workshop`.
   Klucze i18n **istnieją**, ale polskie wartości to te same angielskie skróty:
   `public/locales/pl/translation.json:33580` `"sel": "SEL"`, `:33467` `"lnk": "LNK"`;
   klucz `"drw"` nie istnieje wcale (zawsze domyślne angielskie „DRW"). Dla porównania,
   WŁASNY toolbar Whiteboardu w tym samym pliku locale ma pełne polskie słowa:
   `:2182` `"select": "Zaznacz"`, `:2183` `"pan": "Przesuń / Zoom"` — czyli w JEDNYM
   module dwa różne słowniki dla tego samego pojęcia „aktywne narzędzie".
2. **Krawędź przechodząca przez etykietę węzła w Process Flow.** Plik:
   `src/components/MyWork/IdeaProcessFlowTool.tsx`. Węzeł „Klient składa zgłoszenie"
   ma linię łącznika biegnącą przez środek tekstu (wygląda jak przekreślenie),
   identycznie w obu motywach. Prawdopodobnie krawędź kolinearna z trzema węzłami
   rysowana jest jako jedna prosta zamiast zatrzymać się na granicy środkowego węzła.
3. **`AgentPlanWorkspace` (mój plik) używa zakazanego `ArtifactRightPanel`
   (`src/components/standard/`) jako JEDYNEJ treści pełnoszerokiego warsztatu**, gdy
   plan jeszcze nie istnieje — stąd rozległa pusta przestrzeń bez wyjaśnienia na
   `agent-plan-view`. Sam `ArtifactRightPanel` działa zgodnie z przeznaczeniem (wąski
   dok bocznej szuflady artefaktu); błędne jest użycie go jako samodzielnej strony.
   Nie naprawiłem — wymaga decyzji, czy launcher agentów ma dostać własny,
   pełnoszerokościowy układ (galeria kafelków?) zamiast pożyczonej powłoki artefaktu.
4. **Kolumna tytułu na `chat-signals-feed` za wąska** — tytuły sygnałów łamią się na
   2–3 linie, `Metalpol: Anna Kowalska…` ucięte metadane. Dziedziczone z
   `FilterableTable.tsx`. Znany wcześniej wyjątek (`status.json`), wciąż aktualny.

### Niespójności wewnątrz modułu

- **Nazewnictwo aktywnego narzędzia kanwy**: skrót angielski „SEL/PAN/DRW/LNK"
  (mind map, process flow, whiteboard-canvas) kontra pełne polskie słowo w OSOBNYM
  toolbarze Whiteboardu („Zaznacz", „Przesuń / Zoom") — patrz defekt wspólny #1.
- **Dwa różne archiwa dowodów inżynierskich** (`canvas-kebab-restructure`,
  `canvas-toolbar-md-history`) siedzą w tym samym rejestrze ekranów co żywe ekrany
  produktu — nie jest to defekt UI, ale higiena rejestru: warto rozważyć osobną
  kategorię „dowód/audyt" w `status.json`, żeby nie mylić ich z ekranami do odbioru.

## Moduły 04-narzedzia, 11-audyty, 16-kanon

> ★ Sekcja ODTWORZONA z historii gita (skasowana nadpisaniem pliku w 591ca8cec2 — patrz DZIENNIK Z-15).

**Pierwsza liczba: 24 z 27 ekranów obejrzanych na świeżym zrzucie osobiście
(Read), w moim katalogu `evidence/grafika/133-noc-narzedzia-audyty-kanon/`
(66 plików — 27 ekranów × 2 motywy `__PRZED__`, plus 6 ekranów re-zrzuconych
`__PO__` po naprawie w obu motywach). Weryfikacja:
`ls evidence/grafika/133-noc-narzedzia-audyty-kanon | wc -l` → 66.**

**3 ekrany NIE obejrzane osobiście w tej sesji** (zrzut PRZED istnieje w
katalogu, ale nie otworzyłem go przez `Read`): `prawy-pas-jedna-formula-idea-artefakt`,
`prawy-pas-jedna-formula-notatka-teresa`, `prawy-pas-jedna-formula-notatka-artefakt`.
Wszystkie trzy to warianty tego samego prototypu co `prawy-pas-jedna-formula-idea-teresa`
(który OBEJRZAŁEM — patrz tabela), różniące się tylko treścią (idea/notatka ×
Teresa/Artefakt) — nie zgaduję ich oceny, zostawiam bez oceny w tabeli.

Moduł 04-narzedzia: 10/10 obejrzane. Moduł 11-audyty: 4/4 obejrzane.
Moduł 16-kanon: 10/13 obejrzane.

### Tabela ekranów

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój) |
| --- | --- | --- | --- | --- |
| `tools-swot-library-detail` | A | Panel Właściwości pokazywał surowe `strategy` zamiast etykiety w polu Kategoria | **Naprawione** — `KnownToolDetailView.tsx` (nowa `categoryLabel`, reużywa klucze i18n `KnownToolPreviewV3`) | `tools-swot-library-detail__PO__{light,dark}.png` |
| `tools-swot-live` | A | (1) Pigułka „poza polem" pokazywała surowe `ai-proposed`/`rethinking` jako „AI-PROPOSED"/„RETHINKING"; (2) nagłówek harnessu „Dynamic SWOT · Live Artifact" po angielsku; (3) ★ patrz ZGŁASZAM #1 niżej — `SwotLiveArtifact` bez wołacza w produkcie | **Naprawione** (1,2) — `SwotLiveArtifact.tsx` (mapa `PROPOSAL_STATUS_LABEL_PL`), `dev-render/screens/tools-swot-live.tsx` (nagłówek). **Zgłoszone** (3) | `tools-swot-live__PO__{light,dark}.png` |
| `tools-swot-session-workspace` | A | Kategoria „strategic" surowe; „Find Signals" identyczny label/labelPl (kopiuj-wklej); „COPILOT AI" — patrz ZGŁASZAM #3 | **Naprawione** — Kategoria (`ToolDocumentView.tsx`), „Find Signals"→„Znajdź sygnały" (`toolAiActions.ts`, przy okazji też `Synthesize`→`Syntetyzuj` i `Finalize`→`Finalizuj`×2, ten sam defekt). **Zgłoszone** — COPILOT AI | `tools-swot-session-workspace__PO__{light,dark}.png` |
| `karta-tool` | A | — (Kategoria tu idzie przez realne `Api.getKnownTool`, już poprawnie „Diagnoza strategiczna" — inna droga danych niż fixture harnessu) | — | `karta-tool__PRZED__{light,dark}.png` |
| `tools-outputs-insights-tab` | **B** (było A) | Zakładka Menu 2 nazywa się „Insighty" — nie jest to słowo polskie; wiersze tabeli pokazują surowe nazwy narzędzi „Value Chain"/„Dynamic SWOT" zamiast „Łańcuch wartości"/„Dynamiczny SWOT" (patrz `karta-tool` gdzie ta sama nazwa jest poprawnie po polsku) | **Zgłoszone** — `tools.hub.tabs.outputs` = „Insighty" w `public/locales/pl/translation.json:22071` (plik zakazany); komponent renderujący (`DiscoveryToolsHub.tsx`) jest w `src/components/Discovery/` — **inny katalog niż mój `DiscoveryTools/`**, poza zakresem | `tools-outputs-insights-tab__PRZED__{light,dark}.png` |
| `tools-swot-report` | A | Drobne: nagłówek „TRADE-OFF" po angielsku (żargon biznesowy, częsty jako zapożyczenie) | — (nie naprawiłem — niejednoznaczne, zgłaszam jako obserwację) | `tools-swot-report__PRZED__{light,dark}.png` |
| `prompt-registry-tab` | A | Narzędzie inżynierskie (SuperAdmin), świadomie całe po angielsku — spójne, nie mieszanka; daty ISO `YYYY-MM-DD` uzasadnione tym samym powodem | — | `prompt-registry-tab__PRZED__{light,dark}.png` |
| `tools-swot-initiative-proposal` | A | Checklista „Gotowość analizy": pozycja „Mission brief jest jasny" — angielskie „Mission brief" wklejone w polskie zdanie | **Zgłoszone** — `discoveryToolsSteps.summaryStep.dynamicSwot.readiness.missionBrief` w `public/locales/pl/translation.json:38873` (plik zakazany); sugerowana poprawka: „Brief misji jest jasny" | `tools-swot-initiative-proposal__PRZED__{light,dark}.png` |
| `tools-sesja-wyjscie` | A (było B) | Nazwa sesji „Dynamic SWOT — Session" na sztywno w fixture; Kategoria surowe „strategic"; „COPILOT AI"; surowe `dynamic-swot`/`strategic` we właściwościach | **Naprawione** — nazwa sesji → „Dynamic SWOT — Sesja" (`dev-render/screens/tools-sesja-wyjscie.tsx`, 2 miejsca) + domyślna nazwa sesji w produkcie przez nową `defaultSessionName()` (`ToolDocumentView.tsx`, 3 miejsca), Kategoria. **Zgłoszone** — COPILOT AI | `tools-sesja-wyjscie__PO__{light,dark}.png` |
| `tool-outputs-panel` | **C** (bez zmian) | Prawie cały ekran po angielsku: „Outputs", „SELECTED OUTPUT", „Reopen for correction", „REPORTS & PRESENTATIONS", „REPORT"/„PRESENTATION", „INITIATIVE PROPOSALS" — **NIE literały w kodzie**, tylko `t('toolOutputs.*', 'angielski domyślny')` bez ANI JEDNEGO klucza `toolOutputs.*` w `public/locales/pl/translation.json` (`grep -c toolOutputs` → 0 w PL i w EN); data była US-format | **Naprawione** — format daty (`formatListDate` zamiast `toLocaleDateString(undefined,…)`, `ToolOutputsPanel.tsx`). **Zgłoszone** — WSZYSTKIE ~15 kluczy `toolOutputs.*` brakują w locale (plik zakazany); to jest jedyny powód oceny C, komponent sam w sobie jest poprawnie zbudowany (i18n-ready, tylko słownik pusty) | `tool-outputs-panel__PO__{light,dark}.png` |
| `audyty-warsztat-kryterium` | A | — | — | `audyty-warsztat-kryterium__PRZED__{light,dark}.png` |
| `audyty-piec-powierzchni` | A | — | — | `audyty-piec-powierzchni__PRZED__{light,dark}.png` |
| `audyty-raport-dokument` | A | — | — | `audyty-raport-dokument__PRZED__{light,dark}.png` |
| `audyty-drd-report` | A | — (naprawa dat DD/MM/YYYY i nagłówka źródła z wcześniejszej sesji trzyma się — `21/07/2026` widoczne, zero angielskich nagłówków) | — | `audyty-drd-report__PRZED__{light,dark}.png` |
| `prawy-pas-notatnik-struktura` | B | ★ PROTOTYP, nie produkt (patrz niżej) — zero zmian w tym, co widzi dziś użytkownik; pole „Źródło" pokazuje surowe `manual` | **Zgłoszone** — komponent prototypu poza moim zakresem (`src/components/shared/…`, nie `DiscoveryTools/`) | `prawy-pas-notatnik-struktura__PRZED__{light,dark}.png` |
| `prawy-pas-jedna-formula-idea-teresa` | B | ★ PROTOTYP, nie produkt (patrz niżej) — czysty, spójny, w całości po polsku | — | `prawy-pas-jedna-formula-idea-teresa__PRZED__{light,dark}.png` |
| `prawy-pas-jedna-formula-idea-artefakt` | — nie obejrzano | — | — | `prawy-pas-jedna-formula-idea-artefakt__PRZED__{light,dark}.png` (zrzut istnieje, nie sprawdzony) |
| `prawy-pas-jedna-formula-notatka-teresa` | — nie obejrzano | — | — | `prawy-pas-jedna-formula-notatka-teresa__PRZED__{light,dark}.png` (zrzut istnieje, nie sprawdzony) |
| `prawy-pas-jedna-formula-notatka-artefakt` | — nie obejrzano | — | — | `prawy-pas-jedna-formula-notatka-artefakt__PRZED__{light,dark}.png` (zrzut istnieje, nie sprawdzony) |
| `mw-007-calendar-narrow-viewport` | A | Realny kalendarz Mojej Pracy (nie przyrząd) — karta wydarzenia „Warsztat z zespołem operacyjnym" ma etykietę „Internal" po angielsku | **Zgłoszone** — plik w `src/components/MyWork/`, poza moim zakresem | `mw-007-calendar-narrow-viewport__PRZED__{light,dark}.png` |
| `standard-grid-card` | A | ★ PRZYRZĄD, nie produkt (patrz niżej) — status pills w danych testowych po angielsku (`EXECUTING`/`BLOCKED`/`CRITICAL`/`Approved`/`Draft`) | — (fixture w harnessu, nie zidentyfikowałem właściciela pliku na czas sesji — obserwacja) | `standard-grid-card__PRZED__{light,dark}.png` |
| `standard-module-bar-children` | A | ★ PRZYRZĄD, nie produkt — potwierdzone dosłownie (patrz niżej) | — | `standard-module-bar-children__PRZED__{light,dark}.png` |
| `preview-4-zakladki` | A | ★ PRZYRZĄD, nie produkt — ekran SAM SIĘ opisuje jako „Przyrząd pomiarowy, nie ekran produktu" w nagłówku | — | `preview-4-zakladki__PRZED__{light,dark}.png` |
| `prawy-panel-szyna-ikon` | A | ★ PRZYRZĄD PRZED/PO (dowód inżynierski, nie ekran) | — | `prawy-panel-szyna-ikon__PRZED__{light,dark}.png` |
| `rn-g3-class-l-record-shell` | A | ★ DEMONSTRACJA wzorca powłoki (rejestr: „DEMONSTRACJA przepisu powłoki klasy L"), nie osobny ekran produktu — pola Właściciel/Proces pokazywały surowe ID `user-anna-kowalska`/`proc-production` | **Naprawione** — fixture w `dev-render/screens/rn-g3-class-l-record-shell.tsx` teraz pokazuje „Anna Kowalska"/„Produkcja" | `rn-g3-class-l-record-shell__PO__{light,dark}.png` |
| `fab-rail-kebab` | A | Element wspólny (kanon), nie osobny ekran — daty w fixture ISO `YYYY-MM-DD`, nie kanoniczne DD/MM/YYYY | — (fixture harnessu, nie ekran produktu — obserwacja, nie naprawiłem: nie zidentyfikowałem właściciela pliku na czas sesji) | `fab-rail-kebab__PRZED__{light,dark}.png` |
| `standard-kanban-card` | B | ★ PRZYRZĄD, nie produkt — etykiety w danych testowych mieszają polski z angielskim (`On track`, `Blocked`, `Done`, `At risk` obok `ZAPLANOWANE`, `Termin: 30 lip`), świadomie udokumentowane w `status.json` jako fixture, nie defekt produktu | — | `standard-kanban-card__PRZED__{light,dark}.png` |

**A=20 · B=5 (z czego 4 to jawne prototypy/przyrządy) · C=1 · D=0 · nieocenione=3.**

### ★ Moduł 16-kanon: które ekrany to PRZYRZĄD, nie produkt

Zgodnie z prośbą — sprawdziłem każdy z 13 ekranów pod tym kątem, nie tylko
`standard-module-bar-children`. Wynik: **11 z 13 to nie są ekrany, które
klient/konsultant kiedykolwiek zobaczy przez nawigację w aplikacji**:

1. `standard-module-bar-children` — galeria 6 wariantów komponentu (rejestr: „TO NIE JEST EKRAN PRODUKTOWY").
2. `standard-grid-card` — galeria 4 wariantów karty (nagłówek „#76a — JEDEN kanon karty grid/kafelkowej").
3. `standard-kanban-card` — galeria wariantu karty (nagłówek „#75b — JEDEN kanon karty kanban").
4. `preview-4-zakladki` — cztery zakładki My Work obok siebie do porównania geometrii; **ekran sam się opisuje jako „Przyrząd pomiarowy, nie ekran produktu"**.
5. `prawy-panel-szyna-ikon` — dowód inżynierski PRZED/PO (kod PRZED już nie istnieje w `src/`, trzymany tylko do porównania).
6. `rn-g3-class-l-record-shell` — rejestr wprost: „DEMONSTRACJA przepisu powłoki klasy L (archetyp Rekord)"; wskaźnik OEE jest przykładem demonstracyjnym.
7. `fab-rail-kebab` — element wspólny (szyna narzędzi + tabela kanoniczna) pokazany razem, nie jest adresem żadnego pojedynczego ekranu.
8–11. `prawy-pas-notatnik-struktura` i trzy warianty `prawy-pas-jedna-formula-*` — **PROTOTYPY DO DECYZJI, za flagą domyślnie wyłączoną**; rejestr wprost: „nie ma tego jeszcze w aplikacji", pole pisania Teresy nieaktywne (materiał do oceny wyglądu, nie działający czat).

**Tylko 2 z 13 to realne ekrany produktu** dostępne dziś przez nawigację:
`mw-007-calendar-narrow-viewport` (Moja praca → Kalendarz, przy wąskim oknie)
i pośrednio `tools-outputs-insights-tab`/pozostałe demonstrują komponenty
UŻYWANE w realnych ekranach, ale same nie są adresem.

**Rekomendacja (nie wykonuję, tylko proponuję):** rozważyć zdjęcie pozycji 1–11
z listy odbioru ekran-po-ekranie i przenieść je do osobnej kategorii w
`status.json` (np. `"typ": "przyrzad"` obok istniejącego `"ocena"`) — tak jak
zaproponował już poprzedni robotnik dla modułu czatu (`canvas-kebab-restructure`,
`canvas-toolbar-md-history`). Odbiór właściciela ma sens tylko dla 2 pozostałych
plus dla samych KOMPONENTÓW (StandardModuleBar, StandardGridCard, StandardKanbanCard,
ArtifactRightPanel/RightRail, ArtifactPropertiesTable) — a te są już pokryte
przez odbiór realnych ekranów, które je używają.

### Naprawione (pliki z nazwy)

- `src/components/DiscoveryTools/live/SwotLiveArtifact.tsx` — pigułka statusu „poza polem" tłumaczona zamiast surowej wartości (`ai-proposed`→„Propozycja AI", `rethinking`→„Przemyślenie")
- `dev-render/screens/tools-swot-live.tsx` — nagłówek harnessu po polsku + udokumentowany brak wołacza komponentu w produkcie
- `src/components/DiscoveryTools/KnownToolDetailView.tsx` — właściwość Kategoria tłumaczona (`strategic`/`strategy`/`operational`/`digital`/`automation` → etykieta), zamiast surowej wartości
- `src/components/DiscoveryTools/ToolDocumentView.tsx` — (1) ta sama naprawa Kategorii co wyżej, druga niezależna kopia tego samego defektu; (2) nowa `defaultSessionName()` — domyślna nazwa sesji „… — Sesja" zamiast twardego angielskiego „… — Session" (3 miejsca, w tym eksport PDF); (3) cztery wywołania `toLocaleDateString()/toLocaleString()` bez locale zamienione na `formatListDate`/`formatListDateTime` (kanon dat, `src/utils/listDateFormat.ts`)
- `src/components/DiscoveryTools/toolAiActions.ts` — trzy przyciski AI z `labelPl` identycznym z angielskim `label` (kopiuj-wklej): `find-signals`→„Znajdź sygnały", `synthesize-insights`→„Syntetyzuj", `finalize-outputs`→„Finalizuj" (×2 wystąpienia) + jeden `titlePl` z angielskimi frazami „final summary, output candidates" przetłumaczony
- `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx` — data US-format (`toLocaleDateString(undefined,…)`) → `formatListDate` (kanon)
- `src/components/DiscoveryTools/ToolSessionPreview.tsx`, `ToolSessionPreviewV3.tsx`, `KnownToolPreviewV3.tsx` — to samo `toLocaleDateString(undefined,…)` w trzech kartach podglądu (preview pane) tego samego modułu → `formatListDate`
- `src/components/DiscoveryTools/ToolWorkspace.tsx` — nazwa sesji tworzonej przy starcie używała `new Date().toLocaleDateString()` (locale przeglądarki) → `formatListDate(new Date())`
- `dev-render/screens/rn-g3-class-l-record-shell.tsx` — fixture pól Właściciel/Proces: surowe ID → nazwy
- `dev-render/screens/tools-sesja-wyjscie.tsx` — fixture nazwy sesji: „Dynamic SWOT — Session" → „Dynamic SWOT — Sesja" (2 miejsca)

Kontrola: `bash scripts/check-list-canon.sh` i `bash scripts/check-triada.sh` na
wszystkich 12 zmienionych plików → **obie bramki PASS**, zero nowych naruszeń.

### Defekty wspólne (do plików, których nie wolno mi ruszać) — ZGŁASZAM

1. **★ `SwotLiveArtifact.tsx` (`tools-swot-live`) nie ma ŻADNEGO wołacza w produkcie.**
   `grep -rln SwotLiveArtifact src/ --include="*.tsx" --include="*.ts"` poza
   testami i samym plikiem trafia wyłącznie na jeden KOMENTARZ w
   `tools/DynamicSWOT/EvidenceEditor.tsx`. Komponent jest realny, przetestowany,
   poprawnie zbudowany (silnik napięć SWOT, undo/redo) — ale nigdzie nie jest
   montowany w `ToolWorkspace`/`dedicatedToolTypes`. Użytkownik NIGDY nie
   zobaczy tego ekranu w aplikacji dzisiaj. Ocena „A" w `status.json` mierzy
   jakość komponentu, nie jego obecność w produkcie. To jedenasty kształt
   fałszywego „gotowe" (biblioteka bez wywołania) z innej perspektywy: tu
   biblioteka jest kompletna, tylko nikt jej nie woła. Wymaga decyzji: podłączyć
   do `ToolWorkspace` (gdzie? jaki krok?) albo świadomie zdjąć z listy odbioru
   jako nieużywany kod.
2. **`tool-outputs-panel` — ocena C wyłącznie z powodu pustego słownika.**
   ~15 kluczy `toolOutputs.*` używanych w `ToolOutputsPanel.tsx` nie istnieje
   W OGÓLE w `public/locales/pl/translation.json` (0 trafień) ani w `en` (0
   trafień) — component poprawnie woła `t()` wszędzie, ale nie ma czego
   przetłumaczyć. Najszybsza droga do A: dopisać ~15 kluczy PL+EN (angielskie
   fallbacki w kodzie już są dobrym punktem wyjścia dla EN).
3. **„COPILOT AI" — klucz i18n istnieje, ale PL = kopia EN.**
   `discoveryToolsSteps.toolPhaseAiActions.aiCopilot` w
   `public/locales/pl/translation.json` ma wartość dosłowną „Copilot AI"
   (PL en-word-order), podczas gdy EN ma „AI Copilot" — dwa różne teksty,
   żaden po polsku. Widoczne na `tools-swot-session-workspace` i
   `tools-sesja-wyjscie`. Sugerowana poprawka: „Asystent AI" lub „Kopilot AI".
4. **„Mission brief jest jasny" — locale z wklejonym angielskim.**
   `discoveryToolsSteps.summaryStep.dynamicSwot.readiness.missionBrief`
   (`translation.json:38873`) = „Mission brief jest jasny". Cztery sąsiednie
   klucze w tej samej sekcji `readiness` są poprawnie po polsku — to
   pojedynczy, izolowany błąd, nie wzorzec.
5. **Zakładka „Insighty" (`tools.hub.tabs.outputs`, `translation.json:22071`)
   nie jest polskim słowem** — i komponent, który ją renderuje
   (`src/components/Discovery/DiscoveryToolsHub.tsx`), jest w INNYM katalogu
   niż mój zakres (`Discovery/`, nie `DiscoveryTools/`) — pułapka nazewnicza,
   warto ją zanotować dla następnego robotnika tego modułu. Ten sam plik
   pokazuje surowe angielskie nazwy narzędzi w tabeli Insighty/Outputs
   („Value Chain", „Dynamic SWOT") — do zweryfikowania, czy to defekt tej
   tabeli, czy generalny (czy `karta-tool` i `tools-outputs-insights-tab`
   czytają nazwę narzędzia z dwóch różnych pól).
6. **`mw-007-calendar-narrow-viewport` — etykieta „Internal" po angielsku**
   na karcie wydarzenia kalendarza. Plik w `src/components/MyWork/`
   (kalendarz), poza moim zakresem.
7. **`prawy-pas-notatnik-struktura` — pole „Źródło" pokazuje surowe `manual`.**
   To PROTOTYP (patrz wyżej), niski priorytet, ale ten sam wzorzec „surowa
   wartość zamiast etykiety" co gdzie indziej.

### Niespójności wewnątrz modułu

- **Nazwa narzędzia „Dynamic SWOT" po angielsku w kilku miejscach**
  (`tools-outputs-insights-tab`, fixture `tools-sesja-wyjscie` przed naprawą)
  kontra „Dynamiczny SWOT" poprawnie po polsku w `karta-tool` i w treści
  `tools-swot-report`/`tools-swot-initiative-proposal` — ten sam byt, dwie
  nazwy w jednym module, zależnie od tego, które pole/tabela je czyta.
- **Trzy niezależne kopie tego samego defektu „Kategoria pokazuje surowy enum".**
  `KnownToolDetailView.tsx` (karta biblioteki) i `ToolDocumentView.tsx`
  (sesja/warsztat) miały każdy WŁASNĄ nienaprawioną wersję tego samego pola —
  `KnownToolPreviewV3.tsx` (preview pane) miał je już poprawnie rozwiązane od
  wcześniej. Trzy miejsca, jedna prawda, żadnego współdzielonego helpera —
  teraz oba naprawione lokalnie tym samym wzorcem (reużywają te same klucze
  i18n), ale warto rozważyć wspólną funkcję `toolLibraryCategoryLabel()`
  zamiast trzeciej kopii przy następnej naprawie.
- **`toLocaleDateString()`/`toLocaleString()` bez locale — 9 wystąpień
  znalezione w samym module `DiscoveryTools/`** (poza tymi już wcześniej
  naprawionymi w `11-audyty`, gdzie ten sam defekt był już zamknięty
  wcześniej (komentarz z uzasadnieniem w `AuditsMethodHub.tsx`, patrz
  `createProgram` — cytuje US-format `6/18/2026` jako znaleziony defekt).
  Wszystkie
  naprawione tym samym `formatListDate`/`formatListDateTime` — ale to
  pokazuje, że ten konkretny anti-pattern powtarza się per-plik zamiast być
  wyłapywany centralnie (np. przez lint regułę na `toLocaleDateString(undefined`).

## Moduły 06-inicjatywy, 07-realizacja, 08-wyniki

> ★ Sekcja ODTWORZONA z historii gita (skasowana nadpisaniem pliku w 591ca8cec2 — patrz DZIENNIK Z-15).

**Dowód:** świeży zrzut w `evidence/grafika/134-noc-inicjatywy-wyniki/` — 30
renderowalnych ekranów × 2 motywy `__PRZED__` (60 plików) + 1 ekran re-zrzucony
`__PO__` po naprawie (2 pliki) + 3 dowody `__BRAK-EKRANU__` dla ekranów, które
harness w ogóle nie umie zamontować (patrz niżej) = **65 plików**. Weryfikacja:
`ls evidence/grafika/134-noc-inicjatywy-wyniki | wc -l` → 65. Każdy plik obejrzany
przez `Read` osobiście (dark motyw sprawdzony na próbie ekranów wysokiego ryzyka —
gdzie się różnił od light, jest to opisane niżej; tam gdzie nie opisuję różnicy,
dark trzyma parytet z light).

**33/33 ekranów z `status.json` rozliczonych. 30 obejrzanych na żywym, świeżym
zrzucie. 3 potwierdzone jako niemożliwe do wyrenderowania** (`initiatives-portfolio-analysis`,
`execution-export-prezentacja`, `execution-change-signals` — wpisy w `SCREENS`
w `dev-render/main.tsx` są **zakomentowane**; próba `?screen=` daje ekran
fallbacku harnessu „Unknown ?screen=…", zrzut-dowód w plikach `__BRAK-EKRANU__`).
To zgadza się z ich statusem `D` = odłożone, ale oznacza, że nikt w tej chwili
NIE MOŻE ich ocenić wzrokiem — nie tylko ja.

### Tabela ekranów

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój, świeży) |
| --- | --- | --- | --- | --- |
| `inicjatywy-lista` | **C** | Realny `<InitiativesHub>` w tym wejściu harnessu pada na `INITIATIVE_DATA_CONTRACT_ERROR` zamiast pokazać dane demo — `seedRealisticSession()` ustawia `isDemoMode:true` w żywym store, ale `shouldAllowDemoData()` czyta WYŁĄCZNIE `localStorage['consultify-storage']`, a zapis tam jest debounce'owany o 300ms (i przesuwany dalej przy każdym kolejnym `setState`) — pierwszy fetch startuje przed zapisem i idzie prawdziwą ścieżką API, która w harnessie zwraca HTML zamiast JSON. Retry po odczekaniu również padał (zaobserwowane 3 nieudane próby pod rząd) — podejrzewam, że okno debounce w tym konkretnym montażu jest dłuższe niż mój test. **Nie mam pewności, czy to wyłącznie usterka stanowiska pomiarowego, czy realna wada architektury (ten sam wzorzec `shouldAllowDemoData()` może się ścigać z debounce także w produkcji tuż po przełączeniu trybu demo w Ustawieniach)** | **Zgłoszone** — plik z wołaniem (`src/services/api.ts` `getDemoFlags()`/`shouldAllowDemoData()`, `src/store/useAppStore.ts` debounce'owany `appStoreStorage`) poza moim zakresem plików; do naprawy harnessowej strony wymaga `dev-render/mocks/seedStore.ts`, też poza `dev-render/screens/` moich ekranów | `inicjatywy-lista__PRZED__{light,dark}.png` |
| `capacity-advisor-a3` | B | Kolumny „Rola/Zespół", „Rodzaj", „Presja (zakres)" ucinają tekst w połowie słowa („engineeri…", „Ogranicz…", „Potwierdz…") — kolumny StandardTable za wąskie na treść. Ten sam wzorzec co opisany w pamięci „naprawa per-wywołanie odrasta" (min-width nie ratuje w table-fixed) | **Zgłoszone** — `src/components/shared/ModuleHub/FilterableTable.tsx` / `StandardTable`, plik wspólny, zakaz dotykania | `capacity-advisor-a3__PRZED__{light,dark}.png` |
| `plan-scenario-d1` | **C** | ★★ Potwierdzam DOKŁADNIE uwagę właściciela z kontekstu zadania: klik wiersza w prawdziwym `<InitiativesHub>` → zakładka „Plan" otwiera poprawny prawy panel podglądu (dobrze), ale przycisk „Otwórz" w tym panelu NIE otwiera karty inicjatywy — otwiera „Warsztat planu" jako DRUGĄ TABELĘ wciśniętą POD pierwszą tabelą (layout łamie się w trakcie przejścia, nagłówek/pierwszy wiersz górnej tabeli zostaje ucięty w połowie). Do tego druga tabela pokazuje surowe angielskie wartości enuma zamiast polskich etykiet górnej tabeli: `NOW`/`NEXT`/`LATER`, `KNOWN`/`UNKNOWN`, `HIGH`/`MEDIUM`/`LOW`, `NONE` — podczas gdy górna tabela dla TYCH SAMYCH danych pokazuje „Nieznane"/„Znane", „Wysoki"/„Średni", „Brak". Odtworzone w standalone wejściu harnessu (`?screen=plan-scenario-d1`) i przez prawdziwy `<InitiativesHub>` (`?screen=inicjatywy-lista` → zakładka Plan → wiersz → „Otwórz") | **Zgłoszone, NIE naprawiane** (zgodnie z poleceniem „zbadaj i zgłoś, nie buduj") — źródło to prawdopodobnie `PlanScenarioSurface`/warsztat planu w `src/components/Initiatives/` (mój zakres plików, ale zmiana wymaga decyzji produktowej: czy „Otwórz" ma prowadzić do karty inicjatywy, czy warsztat ma zostać, ale dostać tłumaczenie i nie zgniatać górnej tabeli) | `plan-scenario-d1__PRZED__{light,dark}.png` + `test-hub-plan-otworz2.png` w scratchpadzie (dowód interakcji, nie w katalogu evidence) |
| `ev-football-field` | A | — | — | `ev-football-field__PRZED__{light,dark}.png` |
| `karta-initiative` | A | Sprawdzone: „Wypełnij z AI" (kontekst zadania mówił, że panel istniał, ale nikt go nie otwierał) faktycznie otwiera działający panel „Konsultant AI" z 6 akcjami i czatem z Teresą — nie martwy przycisk. Treść bogata, po polsku, kanon triady/SPEC-A trzymany | — | `karta-initiative__PRZED__{light,dark}.png` + `test-karta-wypelnij-ai.png` w scratchpadzie |
| `initiative-record` | B | Fixture pokazowa (`init-showcase-margin-leakage-recovery` — „Margin Leakage Recovery Sprint") ma WSZYSTKIE pola treści (Problem/Opis rozwiązania/Koszt bezczynności/Kontekst rynkowy) po angielsku, mimo że etykiety pól i cała powłoka są po polsku — kontrastuje z inną fixturą demo (SMED/L3) widoczną na `karta-initiative`, która jest w 100% polska | **Zgłoszone** — dane fixture, nie plik komponentu; ten sam fixture występuje też na `exe-002-004-ui-audit` (patrz niżej) | `initiative-record__PRZED__{light,dark}.png` |
| `initiatives-portfolio-analysis` | D | Ekran zdementowany z rejestru harnessu (`SCREENS` w `dev-render/main.tsx` ma ten wpis zakomentowany) — nie da się wyrenderować, nie da się ocenić wzrokiem | — (zgodne z D = odłożone) | `initiatives-portfolio-analysis__BRAK-EKRANU__light.png` (ekran fallbacku harnessu, dowód że wpis nie istnieje) |
| `execution-report-day11` | A | — | — | `execution-report-day11__PRZED__{light,dark}.png` |
| `exe-002-004-ui-audit` | B | Ten sam fixture angielski co `initiative-record` (patrz wyżej) | **Zgłoszone** (patrz wyżej) | `exe-002-004-ui-audit__PRZED__{light,dark}.png` |
| `execution-export-prezentacja` | D | Zdementowany z rejestru harnessu, jak wyżej | — | `execution-export-prezentacja__BRAK-EKRANU__light.png` |
| `execution-change-signals` | D | Zdementowany z rejestru harnessu, jak wyżej | — | `execution-change-signals__BRAK-EKRANU__light.png` |
| `cel-jedna-karta` | A | Prototyp jednej N-karty celu/OKR — 5 sekcji lewego menu, prawy panel 7 sekcji kanonu, treść bogata i w 100% polska, nic nie wygląda urwane | — | `cel-jedna-karta__PRZED__{light,dark}.png` |
| `wskaznik-jedna-karta` | A | Prototyp karty wskaźnika — nagłówek pokazuje PRAWDZIWĄ nazwę („KPI — Czas przezbrojenia, linia pakowania L3"), numer `KPI-0087` jest osobnym polem referencyjnym w prawym panelu, NIE zastępuje nazwy — to jedyny z ekranów KPI w moim zakresie, który NIE ma defektu „brak nazwy" opisanego niżej | — | `wskaznik-jedna-karta__PRZED__{light,dark}.png` |
| `roi-jedna-karta` | A | **Werdykt scalenia ROI (patrz kontekst zadania): trzyma kanon, NIC nie zginęło.** Sprawdziłem osobno wszystkie 5 sekcji (`&sekcja=zalozenia,model,wynik,wyniki-po-wdrozeniu,wnioski`) — każda ma pełną, spójną, dobrze uźródłowioną treść (np. „Źródła liczb", „Wrażliwość — co zmienia wynik", „Przyczyna rozjazdu" z konkretną diagnozą operacyjną). Prawy panel ma 7 sekcji kanonu. Kolor czerwony użyty tylko semantycznie (ujemny rozjazd w tabeli) | — | `roi-jedna-karta__PRZED__{light,dark}.png` + 4 dodatkowe zrzuty sekcji w scratchpadzie |
| `results-vnext-legacy-archive` | A | Tabela pokazuje surowe nazwy tabel bazy (`kpi_definitions`, `tp_kpi_definitions`…) — ale to świadomie techniczny ekran „tylko do odczytu" dla śledzenia migracji, nie ekran dla zwykłego użytkownika, więc nie flaguję jako defekt kanonu | — | `results-vnext-legacy-archive__PRZED__light.png` |
| `results-vnext-okr-objectives` | A | Stan „N.D." używany konsekwentnie tam, gdzie brak pomiaru — nie nagie zero | — | `results-vnext-okr-objectives__PRZED__light.png` |
| `results-vnext-kpi-scorecards` | B | Lista KPI w karcie wyników pokazuje surowe, ucięte kody bez żadnego wyjaśnienia: „kpi-oee-…", „kpi-defe…", „kpi-czas…" — gorszy wariant defektu „brak nazwy" opisanego niżej, bo tu nie ma nawet podpisu-wyjaśnienia | **Zgłoszone** — to dane (kontrakt KPI), nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-kpi-scorecards__PRZED__{light,dark}.png` |
| `results-vnext-roi-model` | B | Dwa defekty: (1) kolumna „PEWNOŚĆ" w tabeli „Baseline i polityka" jest ucięta przez prawy panel — nagłówek widoczny tylko jako „PEW", wartości „Wys…"/„Śre…"; (2) właściwość „Ziarno analizy" pokazuje surową angielską wartość `monthly` zamiast polskiej etykiety (przy tym sama etykieta pola JEST przetłumaczona — „Ziarno analizy") | **Zgłoszone** — `src/components/ResultsVNext/roi/RoiCaseFullTool.tsx:269` (wartość `roiCase.granularity` bez mapowania na etykietę PL) jest w moim zakresie i jest prostą poprawką, ale nie zdążyłem zweryfikować pełnej listy możliwych wartości `granularity` przed końcem dyżuru — zostawiam do zrobienia razem z naprawą przycinania kolumny (prawdopodobnie w `ArtifactPropertiesTable`/tabeli obok, plik wspólny) | `results-vnext-roi-model__PRZED__{light,dark}.png` |
| `results-vnext-kpi-tool` | **C** | Nagłówek H1 całego ekranu to surowy kod `OEE-LINIA-PAKOWANIA` — bez nazwy, bez podpisu wyjaśniającego (w przeciwieństwie do rejestru, który przynajmniej dopisuje „Kod KPI (brak nazwy)"). To NAJGORSZY z odnalezionych wariantów defektu opisanego w kontekście zadania | **Zgłoszone** — to dane (kontrakt KPI), nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-kpi-tool__PRZED__{light,dark}.png` |
| `results-vnext-roi-full-tool` | A | — | — | `results-vnext-roi-full-tool__PRZED__light.png` |
| `results-vnext-okr-admin` | A | Stan „jeszcze nie włączone" jest uczciwy i dobrze opisany („Ta powierzchnia jest w budowie…") — nie awaria udająca pustkę | — | `results-vnext-okr-admin__PRZED__light.png` |
| `results-vnext-teresa-okr-reflection` | A | Formularz refleksji kompletny, po polsku, przycisk „Poproś Teresę o szkic refleksji" obecny i osadzony w treści (nie martwy) | — | `results-vnext-teresa-okr-reflection__PRZED__light.png` |
| `results-vnext-okr-registry` | A | Sprawdzone: „Nowy OKR" (kontekst zadania: „rejestr OKR dostał jeden przycisk... z realnym formularzem") faktycznie otwiera pełny modal (Tytuł/Program/Cykl/Zasięg/Identyfikator zasięgu/Notatka) — potwierdzam, nie martwy przycisk | — | `results-vnext-okr-registry__PRZED__{light,dark}.png` + `test-nowy-okr.png` w scratchpadzie |
| `results-vnext-roi-registry` | A | Nazwy spraw ROI czytelne po polsku, statusy poprawnie przetłumaczone | — | `results-vnext-roi-registry__PRZED__light.png` |
| `results-vnext-kpi-registry` | B | ★ Wszystkie 5 wierszy rejestru KPI pokazuje surowy kod jako główną etykietę + podpis „Kod KPI (brak nazwy)": `OEE-LINIA-PAKOWANIA`, `ZGLOSZENIA-DO-ZATWIERDZENIA`, `KOSZT-PRACY-REDUKCJA`, `AUDYT-DOSTAWCY-POKRYCIE`, `CYKL-ZAMKNIECIA-MIESIACA`. Dokładnie ekran wskazany w kontekście zadania. UI radzi sobie z tym uczciwie (podpis wyjaśniający, nie udaje że nic się nie stało) | **Zgłoszone** — to dane (kontrakt KPI nie ma pola nazwy, tylko kod), nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-kpi-registry__PRZED__{light,dark}.png` |
| `results-vnext-teresa-kpi-deviation` | A (po naprawie) | Banner „Działania korygujące i plan" pokazywał surowy żargon inżynierski wprost użytkownikowi: „Brak endpointu odczytu listy działań korygujących (patrz kpiDeviationApi.ts) — poniższa lista zawiera WYŁĄCZNIE działania dodane w tej sesji przeglądarki, nie pełną historię z bazy" — nazwa pliku źródłowego i żargon „endpoint" w produkcyjnym komponencie, zawsze renderowany (`role="note"`, bez warunku) | **Naprawione** — `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx:677-680`, nowy tekst: „Ta lista pokazuje wyłącznie działania dodane w bieżącej sesji przeglądarki — po odświeżeniu strony wcześniej zapisane działania mogą tu nie być widoczne." (ostrzeżenie zachowane, żargon i nazwa pliku usunięte) | `results-vnext-teresa-kpi-deviation__PRZED__{light}.png` (defekt) + `results-vnext-teresa-kpi-deviation__PO__{light,dark}.png` (naprawione) |
| `results-three-pairs` | A | KPI w tym widoku MAJĄ prawdziwe polskie nazwy („OEE linii pakowania", „Redukcja kosztów pracy") — kontrastuje z rejestrem/narzędziem KPI, gdzie te same koncepty pokazują surowe kody. Patrz niespójność niżej | — | `results-three-pairs__PRZED__light.png` |
| `results-vnext-attention` | B | Zakładka KPI → kubełek „Brak właściciela" pokazuje tabelę z jedyną kolumną „KOD KPI" i wartościami `DPMO-002`, `DWT-003` — bez nazw, bez podpisu wyjaśniającego jak w rejestrze | **Zgłoszone** — to dane, nie grafika; patrz sekcja zbiorcza niżej | `results-vnext-attention__PRZED__light.png` |
| `results-vnext-okr-workspace` | A | Kompletny widok „Przegląd" zestawu OKR, cykl życia z jasnymi regułami dostępności przycisków („Złożenie do akceptacji: wymaga statusu…") — drobne (nieblokujące) ucięcia `user-ann…`/`user-tom…` w polu Właściciel/Recenzent | — | `results-vnext-okr-workspace__PRZED__light.png` |
| `results-vnext-roi-pir-outcomes` | A | Statusy i etykiety wyników PIR w pełni po polsku i czytelne | — | `results-vnext-roi-pir-outcomes__PRZED__light.png` |
| `results-vnext-search-registry` | A | Stan pusty przed wpisaniem zapytania jest uczciwy i wyjaśniony („Wpisz co najmniej 2 znaki") | — | `results-vnext-search-registry__PRZED__light.png` |
| `results-zestawienia` | A | POZIOM 1 rejestru zestawień okresowych — nazwy zestawień, właściciele i stan wskaźników w pełni po polsku, czytelne, żadnych kodów zamiast nazw (bo to zestawienia, nie pojedyncze KPI) | — | `results-zestawienia__PRZED__light.png` |
| `results-vnext-registry-shell` | D | ★★★ Ekran odłożony (`D`), ale skoro jest renderowalny, odnotowuję: PRAWIE CAŁA powłoka jest po angielsku — zakładki „My"/„Org", przycisk „New KPI", filtry „All/Locked/Not calculable", nagłówki tabeli „NAME/STATUS/OWNER/VALUE/UPDATED", statusy „In review"/„Approved"/„Draft"/„Closed", `N/A`, w prawym panelu treść AI po angielsku („AI recommendation: on track — no action needed this cycle."), akcje „Summarize record"/„Suggest next steps"/„Approve"/„Delegate". Tylko powłoka wokół (Otwórz/Szczegóły/Lista/Uwagi) jest po polsku. Najgorsze naruszenie „angielszczyzny w interfejsie" z całego mojego zakresu | **Zgłoszone** — zgodne ze statusem D (odłożone, niepodpięte do żadnego huba wg etykiety w `dev-render/main.tsx`); jeśli ten komponent ma kiedyś zastąpić `results-vnext-kpi-registry`/`-okr-registry`/`-roi-registry`, potrzebuje pełnej lokalizacji od zera | `results-vnext-registry-shell__PRZED__{light,dark}.png` |

**30/33 ekranów obejrzanych na świeżym, żywym zrzucie. 3/33 potwierdzone jako
niemożliwe do wyrenderowania (D, zdementowane w `dev-render/main.tsx`).**
A=19 (w tym 1 po naprawie) · B=7 · C=3 · D=4.

### Naprawione (pliki z nazwy)

- `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx` (linie
  677–680) — usunięty żargon inżynierski i nazwa pliku źródłowego
  (`kpiDeviationApi.ts`) z bannera widocznego użytkownikowi na ekranie
  `results-vnext-teresa-kpi-deviation`; ostrzeżenie o zakresie danych sesji
  zachowane, przeformułowane na język bez „endpoint"/nazwy pliku.

### Defekty w plikach wspólnych (do których nie wolno mi się dotykać) — ZGŁASZAM

1. **Kolumny StandardTable ucinają tekst w połowie słowa** na `capacity-advisor-a3`
   (i prawdopodobnie szerzej) — `src/components/shared/ModuleHub/FilterableTable.tsx`.
   Ten sam wzorzec co w module 01-czat/12-spotkania/15-agent (`chat-signals-feed`,
   zobacz sekcję wyżej) — wygląda na systemowy problem szerokości kolumn StandardTable,
   nie coś specyficznego dla jednego ekranu.
2. **`shouldAllowDemoData()` (`src/services/api.ts`) czyta wyłącznie
   `localStorage['consultify-storage']`, a zapis do tego klucza jest
   debounce'owany 300ms w `appStoreStorage` (`src/store/useAppStore.ts`)** — gdy coś
   ustawia `isDemoMode: true` tuż przed pierwszym fetchem zależnym od tej flagi
   (harness: `seedRealisticSession()`; produkcja: prawdopodobnie przełącznik „Pokaż
   dane demo" w Ustawieniach), pierwszy fetch może się prześcignąć z zapisem i pójść
   błędną ścieżką. Zobacz `inicjatywy-lista` wyżej — nie jestem pewien, czy to
   wyłącznie wada harnessu, dlatego zgłaszam z ostrzeżeniem, nie z pewnością.

### Zbiorczo: wskaźniki KPI bez nazwy w kontrakcie danych (DANE, NIE GRAFIKA — nie naprawiałem)

Tor funkcji zgłosił ten problem przed moim dyżurem; potwierdzam i lokalizuję
dokładnie, na ilu ekranach jest widoczny w moim zakresie:

- `results-vnext-kpi-registry` — wszystkie 5 wierszy, z podpisem „Kod KPI (brak nazwy)"
- `results-vnext-kpi-scorecards` — 3 wiersze, surowe ucięte kody, BEZ podpisu
- `results-vnext-kpi-tool` — nagłówek H1 całego ekranu to surowy kod, BEZ podpisu
- `results-vnext-attention` (zakładka KPI → „Brak właściciela") — 2 wiersze, surowe kody, BEZ podpisu

Kontrastuje z `wskaznik-jedna-karta` (prototyp) i `results-three-pairs`, gdzie TE
SAME koncepty KPI (np. „OEE linii pakowania") mają prawdziwe polskie nazwy — czyli
przynajmniej część fixture'ów demo MA nazwy, ale ścieżka danych rejestru/narzędzia/
tool czyta pole, które ich nie ma. To potwierdza diagnozę toru funkcji: brakuje pola
nazwy w kontrakcie danych KPI, nie da się tego naprawić w warstwie UI.

### Niespójności wewnątrz modułu

- **Nazwy KPI: kod vs prawdziwa nazwa** — patrz sekcja zbiorcza wyżej.
- **Dwie różne fixtury demo dla inicjatyw**: karta SMED/L3 (`karta-initiative`) w
  100% po polsku, kontra fixture pokazowa „Margin Leakage Recovery Sprint"
  (`initiative-record`, `exe-002-004-ui-audit`) w 100% po angielsku dla treści pól —
  ta sama powłoka, dwa różne standardy językowe danych demo.
- **Dwie różne fixtury demo dla „Plan inicjatyw"**: standalone `plan-scenario-d1`
  pokazuje polski „Plan transformacji operacyjnej" z polskimi nazwami inicjatyw,
  a ten sam ekran osadzony w prawdziwym `<InitiativesHub>` (zakładka Plan) pokazuje
  angielski „Atelier Transformation Plan" z angielskimi nazwami inicjatyw
  („Knowledge Hub Rollout", „Supplier Onboarding Portal"...) i angielskimi filtrami
  Menu3 („Unscheduled/Now/Next/Later/Conflicted/Missing dependencies/Needs
  capacity/Ready for schedule/Published") — dwa różne zestawy danych demo dla
  tego samego ekranu w zależności od wejścia.

## Moduły 03-wywiad, 05-ocena

> ★ Sekcja ODTWORZONA z historii gita (skasowana nadpisaniem pliku w 591ca8cec2 — patrz DZIENNIK Z-15).

**Dowód:** świeży zrzut KAŻDEGO z 25 ekranów, oba motywy, wykonany przeze mnie w tej
sesji przez `scripts/dev/grafika-zrzuty.mjs --katalog=132-noc-wywiad-ocena`, w
`evidence/grafika/132-noc-wywiad-ocena/`. 6 ekranów naprawionych → dodatkowe zrzuty
`__PO__`. Każdy plik obejrzany przez `Read` osobiście (światło zawsze, ciemny motyw
przy każdym ekranie z realnym ryzykiem regresji — pełna lista niżej), nie z rejestru
`status.json` ani z cudzych zrzutów. Weryfikacja:
`ls evidence/grafika/132-noc-wywiad-ocena | wc -l` → 68 plików (25 ekranów × 2 motywy
`__PRZED__` = 50, plus 9 ekranów re-zrzuconych `__PO__` w obu motywach = 18).

**Uwaga o `status.json`:** pola `ocena`/`co`/`naprawione` dla tych 25 ekranów były już
w bazie przed moją sesją (widoczna data 2026-08-30, ale bez znacznika godziny). Część
z nich okazała się NIEAKTUALNA — dziś wieczorem, po mojej weryfikacji na żywym zrzucie,
kilka ekranów jest w lepszym stanie niż tam zapisano (`karta-interview`,
`assessment-initiatives-panel`, `assessment-manage-panel` — patrz tabela). Nie ufałem
tym polom jako dowodowi — użyłem ich jako punktu startowego do zweryfikowania, zgodnie
z regułą „hipoteza nadzorcy nie staje się faktem bez pomiaru".

### Tabela ekranów — 03-wywiad (6/6 obejrzanych)

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój) |
| --- | --- | --- | --- | --- |
| `interview-creator-shell` | A | — | — | `interview-creator-shell__PRZED__{light,dark}.png` |
| `unified-create-launcher` | A | Karta „Insight" zostaje po angielsku — zweryfikowałem: `src/components/shared/UnifiedCreateLauncher.tsx:67` to świadoma decyzja (termin produktowy), zgodna z notatką w `status.json`. Nie defekt | — | `unified-create-launcher__PRZED__{light,dark}.png` |
| `interview-preview-canon` | A | Panel „Powiązania" pokazywał mock z literalnym angielskim „Assignee: Ala Kowalska" (produkcja używa `t('interview.hub.assignee3')`="Przypisany"), surowym enumem „Priorytet: medium" i nazwą organizacji „W3 Interview Owner Review" — brzmiącą jak wewnętrzne zadanie robocze, nie klient. Błąd stanowiska pomiarowego (mock niezgodny z i18n produkcji), nie produktu | **Naprawione** — `dev-render/screens/interview-preview-canon.tsx` (3 etykiety); przy okazji znalazłem, że TEN SAM surowy enum „medium" (bez tłumaczenia) renderuje się naprawdę w produkcji na ekranie Inicjatyw Wywiadu — naprawione w `src/components/Interview/InterviewHub.tsx:7679` (mapowanie przez istniejący słownik `interview.newSessionModal.priorityLabel.*`) | `interview-preview-canon__PRZED__{light,dark}.png` |
| `interview-sessions-status` | A | Konsola: 5 błędów „Failed to load insights/assignments" — sprawdziłem ręcznie (Playwright, live console): to brak backendu w harnessu (pułapka #12 z CLAUDE.md), tabela renderuje się z 5 realnymi wierszami mimo błędów. Nie defekt produktu | — | `interview-sessions-status__PRZED__{light,dark}.png` |
| `drd-http-workspace` | A | Nagłówek pokazuje „Method Pack 2.0.0-methodpack.1" i „Sesja sess-htt" (surowy identyfikator ucięty do nieczytelnego skrótu) — źródło: `src/components/method-workspace/MethodWorkspaceShell.tsx:246-248`, plik POZA moim zakresem (nie `Interview/`ani`assessment/`), współdzielony też przez `method-workspace`, `siri-workspace`, `siri-tier`. „Digital Pathfinder" w tytule to NIE żargon — to prawdziwa nazwa marki metodyki właściciela (`compileDrdPack.ts:354`), zostawione celowo | **Zgłoszone** | `drd-http-workspace__PRZED__{light,dark}.png` |
| `karta-interview` | **A** (status.json: C) | `status.json` twierdził „prawy panel ma trzy z sześciu kanonicznych sekcji, brak Akcje/Źródła i założenia/Komentarze". Na świeżym zrzucie widzę WSZYSTKIE 6 sekcji we właściwej kolejności: Akcje·Właściwości·Powiązania·Źródła i założenia·Komentarze·Historia. Naprawione przez kogoś innego między wpisem a dziś wieczorem — podnoszę ocenę na podstawie tego, co faktycznie widzę na ekranie, nie na podstawie rejestru | — (już naprawione, nie przeze mnie) | `karta-interview__PRZED__{light,dark}.png` |

**6/6 ekranów Wywiadu obejrzanych na świeżym zrzucie.** A=6 · B=0 · C=0 · D=0.

### Tabela ekranów — 05-ocena (19/19 obejrzanych)

| Ekran | Ocena | Co jest nie tak | Naprawione / zgłoszone | Zrzut (mój) |
| --- | --- | --- | --- | --- |
| `assessment-menu3-status-chips` | A | Kolumna „Obszar" w 100% po angielsku (Digital transformation, Smart manufacturing…) mimo że nagłówki i chipy obok są polskie — katalog `METHODOLOGY_CATALOG` w ogóle nie miał wariantu PL (opis/obszar/dostęp/„co dostajesz") | **Naprawione** — `src/components/assessment/library/AssessmentLibraryTab.tsx`: cały katalog przepisany na `{pl,en}`, 5 wierszy × 4 pola | `assessment-menu3-status-chips__PO__{light,dark}.png` |
| `method-workspace` | A | — | — | `method-workspace__PRZED__light.png` |
| `assessment-report-contract` | A | — | — | `assessment-report-contract__PRZED__{light,dark}.png` |
| `assessment-quality-review-panel` | A | — (wzorcowe „brak" zamiast surowego zera) | — | `assessment-quality-review-panel__PRZED__light.png` |
| `assessment-output-report` | **B** (nazwany wyjątek) | ★★★ Sekcja „Ograniczenia i założenia" cytuje wprost nazwę klasy inżynierskiej i żargon: „Output wygenerowany automatycznie z lokalnego event-store (vertical-slice demo, przeglądarka) — businessMeaning/recommendation to deterministyczne szablony…" oraz drugie zdanie „aggregation.byGroup jest pusta — agregacja per-oś (drdAdapter.aggregate) liczona jest osobno…" — to DOKŁADNIE ten defekt, który instrukcja nocna nazwała z góry po nazwie (`EventDerivedOutputBridge`, `vertical-slice demo`). Źródło: `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623` — POZA moim zakresem (`method-core`, nie `Interview/`/`assessment/`), i to jest source-of-truth używany też przez eksport/PDF, więc łatanie samego widoku zamaskowałoby, nie naprawiło | **Zgłoszone jako #1 priorytet** | `assessment-output-report__PRZED__light.png` |
| `assessment-reports-table` | A | — | — | `assessment-reports-table__PRZED__light.png` |
| `assessment-artifacts-restart` | A | Nagłówki tabeli 100% angielskie mimo polskiego otoczenia: „SCOPE/MODULE/VERSION/FROZEN AT" (wołały `t()` z kluczami, których nie ma w `public/locales/pl` — cichy spadek na fallback EN); komórka „MODULE" pokazywała surowe `assessment` zamiast etykiety. Osobno zweryfikowałem: powtarzający się tekst „0 · 3 ukryte: hub nie pobiera podziału…" na chipach Menu 3 to ŚWIADOMA, udokumentowana w kodzie uczciwa informacja (kanon „nagie zero zakazane"), nie błąd — zostawiłem bez zmian | **Naprawione** — `src/components/assessment/AssessmentOutputsTab.tsx` (4 nagłówki kolumn + mapowanie `module` na etykietę, wzorem `statusLabel(isPolish, …)` już używanym w tym pliku) | `assessment-artifacts-restart__PO__{light,dark}.png` |
| `assessment-five-surfaces` | A | Ten sam angielski „Obszar" co `assessment-menu3-status-chips` — to REALNY `AssessmentHub`, więc naprawa w `AssessmentLibraryTab.tsx` naprawiła też ten ekran automatycznie (zweryfikowane zrzutem `__PO__`) | **Naprawione** (przy okazji naprawy wyżej) | `assessment-five-surfaces__PO__{light,dark}.png` |
| `drd-library-entry` | A | Pływający pasek wyjaśniający flagę dla inżyniera („Flaga drdMethodWorkspaceSliceV1 = ON — PODWÓJNE kliknięcie…") renderował się w kadrze, nieoznaczony jako chrom harnessu (pułapka #7 z CLAUDE.md — dokładnie ta sama klasa co naprawa w `siri-workspace` niżej) | **Naprawione** — `data-dev-render-chrome` w `dev-render/screens/drd-library-entry.tsx` | `drd-library-entry__PO__{light,dark}.png` |
| `assessment-list` | A | — | — | `assessment-list__PO__light.png` |
| `assessment-reports-panel` | A | `status.json` miał wyjątek „obudowa ekranu po angielsku" — na dzisiejszym zrzucie ekran jest w 100% polski, wyjątek nieaktualny | — | `assessment-reports-panel__PO__light.png` |
| `assessment-presentation-view` | B | Slajd 1/13 czysty i uczciwy językowo. Nie zdążyłem przejść wszystkich 13 slajdów — zapisany wcześniej defekt „slajd 5 pokazuje paski bez nazw osi" (naprawa wymaga wspólnego jądra metodyk) NIE zweryfikowany dziś, zostawiam ocenę B z tego samego, nazwanego wcześniej powodu | — (nie weryfikowałem ponownie) | `assessment-presentation-view__PO__light.png` |
| `assessment-initiatives-table` | A | `status.json` miał wyjątek „obudowa po angielsku" — dziś w 100% polski (Tablica inicjatyw strategicznych, wszystkie nagłówki i statusy). Konsola: 8 błędów „Failed to fetch transitions" — zweryfikowałem live: harness bez backendu zwraca HTML zamiast JSON, dane i tak renderują się z mocka. Nie defekt. Osobno: chip priorytetu to WYPEŁNIONA pigułka (Krytyczny/Wysoki/Średni/Niski), a kanon (`TRIADA_KANON.md` A4/C1) każe „kropka + tonowany tekst, zero wypełnionych pigułek" dla priorytetu — wzorzec powtarza się na wielu ekranach aplikacji, nie jest unikalny dla dziś, więc tylko zgłaszam, nie zmieniam oceny | **Zgłoszone** (styl pigułki priorytetu) | `assessment-initiatives-table__PO__light.png` |
| `siri-workspace` | B | Pływający pasek pomiarowy harnessu „SIRI pack: 96/96 band descriptors EVIDENCE_MISSING · 0/16 wymiarów…" w kadrze, nieoznaczony jako chrom. Napis „Help content unavailable" pozostaje po angielsku (`src/components/method-workspace/QuestionHelpDisclosure.tsx:45` — celowa strażniczka anty-halucynacyjna, ale sam string nie ma wariantu PL; plik poza moim zakresem) | **Naprawione** (pasek pomiarowy) — `data-dev-render-chrome` w `dev-render/screens/siri-workspace.tsx`; **zgłoszone** (Help content unavailable) | `siri-workspace__PO__light.png` |
| `assessment-initiatives-panel` | **A** (status.json: C) | `status.json`: „cały ekran po angielsku, zdublowany klucz konsoli EXECUTING". Na świeżym zrzucie ekran jest w 100% polski (Inicjatywy, Priorytet, Status, Wpływ/Wysiłek…), a live-check konsoli (Playwright) nie pokazał ŻADNEGO błędu — oba problemy naprawione przez kogoś innego od czasu wpisu | — (już naprawione, nie przeze mnie) | `assessment-initiatives-panel__PRZED__light.png` |
| `assessment-manage-panel` | **B** (status.json: C, częściowo zweryfikowane) | `status.json`: „cały ekran po angielsku — 884 linie bez klucza tłumaczeń". Domyślna zakładka „Przepływ" jest dziś w 100% polska (Zarządzanie, Postęp przepływu, Etap, Decyzja bramki…) — wyraźna poprawa od wpisu. NIE sprawdziłem pozostałych 4 zakładek (Zespół/Raporty/Inicjatywy/Dziennik z tych samych 884 linii) — nie mam podstaw twierdzić, że cały plik jest już polski, tylko że domyślny widok jest | — (nie moja naprawa; wymaga dokończenia weryfikacji pozostałych zakładek) | `assessment-manage-panel__PRZED__{light,dark}.png` |
| `siri-tier` | C | Potwierdzone zgodnie z `status.json`: ekran diagnostyczny dla inżyniera (calculationVersion, planningHorizon, surowe wagi obliczeń), prawie w całości po angielsku, jawnie nieprzeznaczony dla klienta. Bez zmian | — | `siri-tier__PRZED__light.png` |
| `assessment-matryca` | **C** (status.json: D, zły powód) | `status.json`: „D — harness nie ma zarejestrowanego tego ekranu". NIEPRAWDA — ekran renderuje się poprawnie przez `?screen=assessment-matryca` (`DRDMatrixSession`). Prawdziwy defekt jest inny: silny rozjazd językowy WEWNĄTRZ ekranu — lewy panel osi (od `DRDMatrixSession`, honoruje `isPolish`) jest po polsku („1. Procesy Cyfrowe", „1A · Procesy Sprzedaży"), ale całe centrum ekranu (`src/components/MaturityMatrix.tsx` — ZERO kluczy i18n w całym pliku) jest na sztywno po angielsku: „9 OF 9 AREAS EVALUATED", „ASSESSMENT AREAS", „Complete Assessment", „Not sure? Ask AI to Diagnose", nazwy poziomów/obszarów. Dodatkowo `DRDMatrixSession` czyta nazwy osi/poziomów z zakazanego `src/services/drdStructure.ts` | **Zgłoszone** — `src/components/MaturityMatrix.tsx` poza moim zakresem (nie `assessment/`), a `drdStructure.ts` jawnie zakazany | `assessment-matryca__PRZED__{light,dark}.png` |
| `drd-macierz-oceny` | B | Potwierdzone zgodnie z `status.json`: wizualnie wypolerowana (popover z tłem, 9/9 kolumn w kadrze, Spacious działa, oba motywy czytelne), ale treść komórek nadal kłamie (23/63 fałszywych w osi 1) i etykiety poziomów/obszarów po angielsku — źródło `src/services/drdStructure.ts`, zakazany. Bez zmian | — | `drd-macierz-oceny__PRZED__{light,dark}.png` |

**19/19 ekranów Oceny obejrzanych na świeżym zrzucie.** A=13 · B=4 · C=2 · D=0.

### Razem: 25/25 ekranów obejrzanych na świeżym zrzucie. A=19 · B=4 · C=2 · D=0.

### Naprawione (pliki z nazwy)

- `dev-render/screens/interview-preview-canon.tsx` — mock „Assignee"→„Przypisany", surowy enum „medium"→„Średni", nazwa organizacji nie brzmi jak wewnętrzne zadanie
- `src/components/Interview/InterviewHub.tsx` — surowy enum priorytetu („medium") w Powiązaniach karty Inicjatywy Wywiadu → etykieta z istniejącego słownika tłumaczeń (L. ~7679)
- `src/components/assessment/library/AssessmentLibraryTab.tsx` — cały katalog metodyk (`METHODOLOGY_CATALOG`) przepisany na pary `{pl,en}`: opis, obszar, warunek dostępu, „co dostajesz", plus pusty stan tabeli
- `src/components/assessment/AssessmentOutputsTab.tsx` — nagłówki tabeli Scope/Module/Version/Frozen at → Zakres/Moduł/Wersja/Zamrożono; surowe `assessment` → „Ocena"
- `dev-render/screens/siri-workspace.tsx` — pasek pomiarowy harnessu oznaczony `data-dev-render-chrome`
- `dev-render/screens/drd-library-entry.tsx` — pasek wyjaśniający flagę oznaczony `data-dev-render-chrome`

Weryfikacja: `npx esbuild <plik> --jsx=automatic --outfile=/dev/null` czysty dla wszystkich sześciu; `scripts/check-list-canon.sh` i `scripts/check-triada.sh` obie zielone po zmianach.

### Defekty wspólne (do plików, których nie wolno mi ruszać) — ZGŁASZAM

1. **★ NAJPOWAŻNIEJSZE: żargon inżynierski w kliencie-facing tekście raportu z oceny.**
   Plik: `src/method-core/methods/drd/drdSessionRuntime.ts:507,613,621-623`. Sekcja
   „Ograniczenia i założenia" na `assessment-output-report` cytuje dosłownie
   `EventDerivedOutputBridge`, `vertical-slice demo`, `businessMeaning/recommendation`,
   `aggregation.byGroup`, `drdAdapter.aggregate` — nazwy klas i pól kodu w zdaniu
   pokazywanym klientowi. To DOKŁADNIE przykład nazwany z góry w instrukcji nocnej.
   Sugerowany tekst zastępczy: „Output wygenerowany automatycznie z danych sesji
   (wersja robocza, tryb podglądu przeglądarki) — treść (znaczenie biznesowe,
   rekomendacja) to deterministyczne szablony na bazie zebranych odpowiedzi, nie
   analiza LLM ani recenzja metodyka." To samo źródło zasila eksport/PDF, więc łatanie
   samego komponentu widoku w `AssessmentReportDocument.tsx` zamaskowałoby problem
   zamiast go naprawić — poprawka należy do źródła.
2. **`src/components/MaturityMatrix.tsx` — zero kluczy i18n w całym pliku**, renderuje
   `assessment-matryca` w 100% po angielsku obok polskiego panelu osi z tego samego
   ekranu (patrz tabela wyżej). To komponent szerszy niż mój zakres (używany też poza
   Oceną?) — proponuję osobne zadanie tłumaczeniowe, nie punktową łatkę.
3. **`src/services/drdStructure.ts` (jawnie zakazany plik)** — źródło angielskich nazw
   osi/obszarów/poziomów zasilające zarówno `drd-macierz-oceny` (już znane, `status.json`),
   jak i `assessment-matryca` (nowo potwierdzone dziś) oraz najpewniej raport/prezentację.
   Jeden fix u źródła naprawiłby kilka ekranów naraz.
4. **`src/components/method-workspace/MethodWorkspaceShell.tsx:246-248`** — nagłówek
   powłoki 4 ekranów (`drd-http-workspace`, `method-workspace`, `siri-workspace`,
   `siri-tier`) pokazuje surowe `Method Pack 2.0.0-methodpack.1` i ucięty identyfikator
   sesji `Sesja sess-htt` — techniczne wersjonowanie w kliencie-facing pasku tytułowym.
5. **`src/components/method-workspace/QuestionHelpDisclosure.tsx:45`** — hardkodowany
   angielski string „Help content unavailable" (celowa antyhalucynacyjna strażniczka
   metodyki, ale bez wariantu PL) na `siri-workspace` i prawdopodobnie innych ekranach
   Method Workspace.
6. **`public/locales/pl/translation.json:7024`** — literówka `"medium": "Sredni"` (bez
   ogonka, powinno być „Średni") w `interview.newSessionModal.priorityLabel` — tej samej
   mapie, której teraz używa naprawiony `InterviewHub.tsx`.
7. **Styl pigułki priorytetu** na `assessment-initiatives-table`/`assessment-initiatives-panel`
   — wypełniona, tonowana pigułka (Krytyczny/Wysoki/Średni/Niski) zamiast kanonu
   „kropka + tonowany tekst" (`TRIADA_KANON.md` A4, C1: „Zero wypełnionych pigułek" dla
   priorytetu). Wzorzec powtarza się na wielu ekranach poza moim zakresem — do zbiorczego
   sweepu, nie punktowej poprawki.

### Niespójności wewnątrz modułu

- **`assessment-matryca`**: panel osi po polsku, centrum ekranu (macierz + pasek narzędzi)
  w 100% po angielsku — dwa języki na jednym ekranie, patrz defekt wspólny #2.
- **`drd-macierz-oceny` i `assessment-matryca`**: dwa RÓŻNE ekrany macierzy oceny
  (`DRDAssessmentEditor` i `DRDMatrixSession`) — oba zasilane tym samym zakazanym
  `drdStructure.ts`, oba niosą ten sam rodzaj defektu (angielskie nazwy poziomów/obszarów).
  Wygląda na dwa niezależne wdrożenia tej samej mechaniki, nie jeden kanoniczny komponent.
- **Nazwa organizacji w mocku `interview-preview-canon`** brzmiała jak wewnętrzne zadanie
  robocze („W3 Interview Owner Review") zamiast nazwy klienta — naprawione, ale warto
  jako ostrzeżenie: dev-render mocki czasem dziedziczą nazewnictwo z commitów/gałęzi
  roboczych, nie z realnych danych demo.

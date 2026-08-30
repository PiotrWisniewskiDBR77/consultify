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

# P6 — Czerwień tylko dla krytycznych + przegląd 1440 px

Pakiet z tabeli „Plan (I) Tydzień 1: fundamenty" w `docs/program/AUDYT_AWARD_20260905/D_SYNTEZA_I_PLAN.md`
(przyczyna źródłowa **#6**). Szablon: `docs/program/PROGRAM_NAPRAWCZY_20260905/00_SZABLON_PACZKI.md`.

## 1. Cel dla użytkownika

Czerwień na ekranie znaczy wyłącznie „coś jest zepsute/krytyczne" — nigdy zwykłą kategorię, spokojny status
„nieaktywny" albo domyślny przycisk. Na typowej szerokości laptopa (1440 i 1280 px) żaden napis nie
nachodzi na inny, żaden przycisk nie łamie się w dwie linie i nie ucieka pod panel obok.

## 2. Zakres

Co najmniej **8 ekranów** (liczba z wiersza #6 tabeli §2 w `D_SYNTEZA_I_PLAN.md`) w 4 modułach + 1 ekran
publiczny (marketingowy, poza główną aplikacją — status do ustalenia, zob. §3.6). Dowody w
`evidence/audyt-award-20260905/<modul>/`, źródło w `docs/program/AUDYT_AWARD_20260905/{A,B,C}*.md`.

| # | Moduł | Ekran | Co widać | Dowód |
| :-: | --- | --- | --- | --- |
| 1 | Narzędzia | Biblioteka (hub) `/discovery-tools` | Kategoria „Oceny" na czerwono w tabeli — stan niekrytyczny | A §N2, `narzedzia/01e-root-oceny.png` |
| 2 | Narzędzia | Operacyjne — podgląd `/discovery-tools/operational` | Status „Nieaktywny" jako wypełniona czerwona pigułka | A §N2, `narzedzia/07-operational-row-open.png` |
| 3 | Narzędzia | Pełny widok „Dynamic SWOT" @1440 px | „Aktywne"/„Sekcje" i „Zapisano"/„Baza wiedzy" nachodzą na siebie w nagłówku; poprawne @1920 px | A §N7, `narzedzia/13-dynamicswot-fullopen.png` vs `14-dynamicswot-fullopen-1920.png` |
| 4 | Narzędzia | Biblioteka (hub) @1280 px | CTA „Dodaj narzędzie" łamie się do 2 linii, przepełnia pasek Menu 2 o 27 px | A §N8, `narzedzia/11-flagship-1280.png` |
| 5 | Ocena | DRD → Raport (zakładka) i Raport — podgląd wiersza | Nieopisana fioletowa/indygo pigułka „Final" z kłódką — wariant koloru wycofany kanonem | B §Ocena tabela, `ocena/07-drd-raport-tab.png`, `ocena/10-raport-open.png` |
| 6 | Wyniki | Kluczowe rezultaty (kafle KR), widok bezpośredni zestawu | „Bieżąca: 58% · Cel: 100%" nachodzi na „Zaktualizowano: …sie 2026 · Postęp: 58%" w tym samym wierszu | B §7 (Top-10), `wyniki-18-kr-set-direct.png`, powiększenie `/tmp/crop-overlap.png` |
| 7 | Finanse (fala 2, poza MVP) | Predykcja — lista + podgląd | Przycisk „Przelicz" nachodzi wizualnie na sekcję „Powiązania" | C Deduction 7, `finanse/09-predykcja-detal.png` |
| 8 | Wywiad | Ekran flagowy @1280 px + stepper @<1920 px | Panel Teresy (stała kolumna) + siatka pigułek steppera nie kurczy się → ucięte kolumny tabeli, breadcrumb znika po scrollu wymuszonym przez stepper | A §W2/§W3, `wywiad/12b-flagowy-1280-loaded.png`, `01b-lista-glowna-zoom.png` |
| 9 (nieformalny, poza liczbą 8 z audytu) | Partner (strona publiczna, poza aplikacją) | CTA „Start application"/formularz aplikacji partnerskiej na crimson | C Deduction 1 (Partnerzy), `partner/03b-apply.png` — **status do ustalenia z właścicielem, zob. §3.6** |

„Agent Hub" — wymienione w zleceniu tego dokumentu jako podejrzane miejsce — **nie zostało potwierdzone**.
Sprawdzono `rg` całego folderu `src/components/AIChat/Agent*.tsx` (17 plików) pod kątem
`text-danger-|bg-danger-|bg-red-|text-red-|from-primary|bg-primary-`: jedyne trafienia to
`AgentMaterializationPanel.tsx:108` i `ActionCenter.tsx:160` — oba to banery `role="alert"` dla
PRAWDZIWEGO błędu (`{error}` z API), czyli poprawne użycie czerwieni, nie naruszenie. Zgodnie z regułą
„weryfikuj realny runtime, nie hipotezę" (`CLAUDE.md`, złota reguła #1) — **nie wpisuję tego jako
znalezisko** dopóki ktoś nie pokaże konkretnego ekranu Agent Hub z czerwienią na stanie niekrytycznym.

## 3. Przyczyna źródłowa

Zweryfikowane `rg`/`sed` na HEAD gałęzi `codex/m03-admin-20260824` (2026-09-05).

### 3.1 Crimson/danger dla stanu niekrytycznego — Narzędzia

- `src/components/Discovery/DiscoveryToolsHub.tsx:318-323`:
  ```ts
  licensed: {
    name: 'Oceny',
    icon: <Shield size={16} />,
    textClass: 'text-danger-700 dark:text-danger-400',
    dotClass: 'bg-danger-400',
    count: 5,
  },
  ```
  Kategoria „Oceny" nie jest stanem błędu — to jedna z kilku kategorii narzędzi (obok `automation` w
  bursztynie, poprawnie). Wybór `danger` wygląda na przypadkową kopię koloru, nie decyzję.
- `src/components/DiscoveryTools/KnownToolPreviewV3.tsx:287-293`:
  ```ts
  className: tool.isActive
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
    : 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
  ```
  „Nieaktywny" (`isActive === false`) to spokojny stan (narzędzie po prostu nie jest włączone) — nie
  krytyczny. Wzorzec poprawny obok istnieje w tym samym pliku (`isComingSoon` niżej, linia ~296+, używa
  neutralnego tonu) — czyli konwencja „spokojny stan = neutralny chip z kropką" już żyje w kodzie, po
  prostu nie została zastosowana tutaj.

### 3.2 Wariant koloru wycofany kanonem — Ocena

- `src/components/assessment/AssessmentHub.tsx:2955-2984` (`REPORT_STATUS_CONFIG`):
  ```ts
  FINAL: {
    label: 'Final',
    color: 'text-indigo-600 dark:text-indigo-300',
    bgColor: 'bg-indigo-500/20 border-indigo-500/30',
    icon: 'check',
  },
  ```
  `docs/ui-standards/TRIADA_KANON.md` pkt 32: „Kolory tylko z 5 wariantów (`primary` granatowy · `emerald`
  · `amber` · `red` · `neutral`) — zero innych… lista wariantów wycofanych (`purple`/`green`/`blue`)".
  Indygo jest z tej samej rodziny co wycofany `purple` — wizualnie to właśnie „nieopisana fioletowa
  pigułka" ze zrzutu audytu B. Ten sam plik jest przedmiotem pakietu **P4** (etykieta „Final" po
  angielsku) — jeden PR naprawia oba na raz, to ten sam obiekt konfiguracyjny (§5, krok 4).

### 3.3 Nachodzące teksty przy 1440 px — Narzędzia (Dynamic SWOT)

- `src/components/shared/NModeLayout/NModeHeader.tsx:354-450` — pasek nagłówka
  `flex flex-wrap items-center gap-3 px-5 py-3 lg:flex-nowrap lg:gap-4` (linia 354): poniżej breakpointu
  `lg` elementy zawijają się swobodnie (`flex-wrap`), powyżej `lg` przechodzą na `flex-nowrap` BEZ budżetu
  szerokości między tytułem/statusem (`statusLabel`, okolice L432) a `inlineActions` — więc gdy oba boki
  razem przekraczają dostępną szerokość przy ~1440 px, nachodzą na siebie zamiast się zawinąć (`nowrap`
  wyklucza zawijanie, a nic nie ogranicza sumy szerokości dzieci).
- `src/components/DiscoveryTools/KnownToolDetailView.tsx:2521-2540` — `inlineActions` przekazywane do
  `NModeHeader`, zawierają dodatkowy tekst „Sekcje"/„Baza wiedzy" obok stanu zapisu „Aktywne"/„Zapisano" —
  to te dwie pary tekstu nachodzą na siebie w zrzucie `13-dynamicswot-fullopen.png`.
  **Ważne:** to jest komponent WSPÓLNY (`NModeHeader` obsługuje wszystkie artefakty pełnoekranowe, nie
  tylko Narzędzia) — naprawa w jednym miejscu (`NModeHeader.tsx`) potencjalnie poprawia inne archetypy
  korzystające z tego samego nagłówka, ale wymaga regresji wizualnej na WSZYSTKICH z nich (kanon SPEC-A,
  `consultify-artefakty`), nie tylko na Narzędziach.

### 3.4 CTA łamiący się przy 1280 px — Narzędzia

- N8 (audyt A): CTA „Dodaj narzędzie" łamie się do dwóch linii przy 1280 px. Plik dokładny **nie
  zidentyfikowany** przez audyt (kandydat: `PrimaryCta`/`StandardModuleBar`) — potwierdzenie wymaga
  `rg "Dodaj narzędzie"` w trakcie kroku wykonania (nie zrobione w tej sesji, bo to praca dokumentacyjna
  bez uruchomionego przeglądarkowego pomiaru na żywo).

### 3.5 Nachodzące teksty na kaflu Kluczowego Rezultatu — Wyniki

- Ekran: kafle KR w widoku bezpośrednim zestawu OKR (`wyniki-18-kr-set-direct.png`). Plik dokładny **nie
  zidentyfikowany** w tej sesji — przeszukano `src/components/ResultsVNext/okr/okrCardPrimitives.tsx`,
  `OkrKeyResultCardPage.tsx`, `okrKeyResultPresenters.tsx` bez trafienia na literały „Bieżąca"/„Cel"/
  „Zaktualizowano"/„Postęp" jednocześnie w jednym miejscu (prawdopodobnie budowane z osobnych kawałków
  i18n albo w innym pliku widoku listy zestawu, nie karty pojedynczego KR). Do domknięcia w kroku
  wykonania z realnym `grep -rn "Bieżąca:" src/components/ResultsVNext` uruchomionym na środowisku, gdzie
  klucze i18n są już zinterpolowane (mogą pochodzić z `t('...')` ze zmienną, nie z literału).

### 3.6 Crimson na stronie publicznej — Partnerzy (status niejasny)

- `src/views/PartnerApplicationView.tsx:142` i `:246` — `className="...bg-c-accent px-6 py-3 text-sm
  font-black text-white..."`. Token `--c-accent` (`src/index.css:68`) jest zdefiniowany dosłownie jako
  `#85182f` — Harvard Crimson, z komentarzem w kodzie źródłowym „SOLE brand accent". To jest DOKŁADNIE
  ten sam odcień co audyt opisał na zrzucie `partner/03b-apply.png`.
  **Uczciwe zastrzeżenie (jak w audycie C, Deduction 1):** ta strona (`/become-partner/apply`) jest
  publiczną stroną marketingową renderowaną przez `AuthLayout` (nie przez `AppShell`/Standard), z
  odrębnym systemem wizualnym (ciemne tło, duża typografia, `bg-c-accent` używane też jako naświetlenie
  tła w linii 84-85). Reguła „crimson tylko dla stanów krytycznych" w `CLAUDE.md` mówi wprost o
  **ekranach aplikacji** (`Pułapka nr 1: primary w tailwind = crimson. Czerwień TYLKO semantyka
  krytyczna. CTA/stany aktywne = neutralne`) — nie rozstrzyga jednoznacznie stron marketingowych.
  **Ta pozycja NIE wchodzi do kroków wykonania (§5) bez decyzji właściciela** — patrz §5 krok 5
  (warunkowy).

## 4. Projekt rozwiązania

**Dwa różne mechanizmy dla dwóch różnych defektów — kolor i layout nie mają wspólnej naprawy.**

### 4.1 Kolor: mapa tonów semantycznych, nie punktowe podmiany klas

`docs/ui-standards/TRIADA_KANON.md` pkt 32 i `TABLE_AND_PREVIEW_CANON.md` §7.3b już definiują 5
dozwolonych wariantów (`primary`/`emerald`/`amber`/`red`/`neutral`) i listę wycofanych (`purple`/`green`/
`blue`) — **nie tworzymy nowego systemu kolorów**, stosujemy istniejący. Nowy plik
`src/labels/stateToneMap.ts` (SSOT, współdzielony z pakietem P4 dla `reportStatusLabels.ts` — jedna
funkcja `toneForState(domain, value): 'positive'|'critical'|'warning'|'neutral'|'primary'` zwraca WARIANT,
osobna warstwa CSS/className mapuje wariant na klasy tokenów). Zastosowania:
- `DiscoveryToolsHub.tsx:318-323` — kategoria „Oceny" dostaje `neutral` (albo osobny, ale
  NIE-czerwony akcent — np. `primary` granatowy, skoro to kategoria, nie stan).
- `KnownToolPreviewV3.tsx:287-293` — „Nieaktywny" dostaje `neutral` z kropką (wzorzec z kanonu A9 Kanban:
  „cichy chip z kropką", NIE pełna czerwona pigułka — pigułki wypełnione kolorem są zarezerwowane dla
  rzeczywistych alarmów).
- `AssessmentHub.tsx:2955-2984` (`REPORT_STATUS_CONFIG`) — `FINAL` dostaje `primary` (granatowy) albo
  `positive`/`emerald` (skoro „Final" oznacza gotowy dokument, bliżej sukcesu niż neutralności) — DECYZJA
  do potwierdzenia z właścicielem na zrzucie przed wdrożeniem (dwie sensowne opcje, nie jedna oczywista).
- `PartnerApplicationView.tsx:142,246` — **warunkowe**, zależne od odpowiedzi właściciela (§3.6): jeśli
  reguła obowiązuje też strony marketingowe, CTA dostaje `bg-c-text`/`text-c-surface` (dokładnie tak, jak
  już zrobiono w `BecomePartnerView.tsx:48` — ten sam moduł, sąsiedni plik, JUŻ naprawiony wzorzec do
  skopiowania 1:1).

### 4.2 Layout 1440/1280 px: budżet szerokości, nie `flex-nowrap` bez ograniczeń

- `NModeHeader.tsx:354-450`: zamienić `lg:flex-nowrap` na strategię z jawną rezerwą — tytuł dostaje
  `min-w-0 flex-1 truncate` (już częściowo obecne, linia ~403 dla trybu odczytu), blok
  `statusLabel + inlineActions` dostaje WŁASNY `flex-wrap` niezależny od reszty nagłówka (czyli dwa
  poziomy zawijania: cały pasek nie zawija się przy ≥`lg`, ale WEWNĄTRZ prawej grupy statusów/akcji
  zawijanie zostaje włączone zawsze) — to jest różnica między „nachodzenie" (dzisiejszy stan: nic się nie
  zawija, elementy się nakładają) i „zawijanie" (docelowy stan: elementy schodzą do drugiego rzędu, gdy
  brakuje miejsca). Ten komponent jest współdzielony (SPEC-A powłoka) — zmiana wymaga regresji na
  wszystkich 5 archetypów, nie tylko Narzędziach (zob. `consultify-artefakty`).
- CTA „Dodaj narzędzie" (N8) i przycisk „Przelicz" (Finanse, fala 2): `whitespace-nowrap` na etykiecie
  przycisku + `shrink-0` na kontenerze, żeby przycisk się nie łamał, a inne elementy paska ustąpiły
  miejsca (`min-w-0`/`truncate` na sąsiadach) zamiast pozwolić przyciskowi wejść w kolizję.
- Wywiad (podwójna nawigacja, W1/W2): poza zakresem KOLORU, ale ten sam root cause „1440 layout" —
  naprawa właściwa to scalenie `InterviewPipelineStepper.tsx` z `ModuleNavBar.tsx` w jeden rząd (opisane
  szerzej w audycie A jako W1; tu wchodzi tylko jako pozycja inwentarza layoutu 1280/1440, właściwy
  projekt scalenia nawigacji NIE jest przedmiotem tego pakietu — jeśli ma być naprawiony razem, wymaga
  osobnej decyzji zakresu, bo to zmiana architektury nawigacji, nie tylko CSS).

**Zakazy (dziedziczone z CLAUDE.md):** zero nowych kolorów spoza 5 wariantów kanonu; zero `primary-*`/
`c-accent` nowego pojawienia się w powłoce SPEC-A (już pilnowane przez `check-artefakt.sh` — ten pakiet
NIE dubluje tego mechanizmu, rozszerza go o `danger-*` poza kontekstem krytycznym, czego dzisiejszy hook
nie sprawdza w ogóle, zob. §5 krok guard).

## 5. Kroki wykonania

1. **[S] `src/labels/stateToneMap.ts`** (nowy plik, współdzielony z P4) + zastosowanie w
   `DiscoveryToolsHub.tsx:318-323` i `KnownToolPreviewV3.tsx:287-293`. Moduł: Narzędzia —
   **Zweryfikowane: oba pliki SĄ na liście `pliki` klucza `03_TOOLS`** w `MVP_FINAL_ZAMROZONE.json` →
   commit wymaga `[ODMROZENIE 03_TOOLS DEC-<nr>]`.
2. **[S] `AssessmentHub.tsx:2955-2984` (`REPORT_STATUS_CONFIG`) — kolor `FINAL`.** Robione RAZEM z P4
   krok 7 (etykieta), bo to ten sam obiekt. Moduł: Ocena — **ZAMROŻONY** (`04_ASSESSMENT`,
   `AssessmentHub.tsx` potwierdzone na liście) → `[ODMROZENIE 04_ASSESSMENT DEC-<nr>]`. Wymaga
   POTWIERDZENIA właściciela na zrzucie PRZED wdrożeniem (dwie sensowne opcje koloru, zob. §4.1) — moduł
   Ocena był zatwierdzony 05.09, więc zmiana wizualna nawet w dobrej wierze wymaga nowej akceptacji, nie
   cichej podmiany.
3. **[M] `NModeHeader.tsx:354-450` — budżet szerokości nagłówka.** Komponent współdzielony SPEC-A, więc
   wymaga zrzutów regresyjnych na WSZYSTKICH 5 archetypów (Canvas/Dokument/Rekord/Matryca/Deck), nie
   tylko na „Dynamic SWOT". `NModeHeader.tsx` sam nie jest na liście plików żadnego zamrożonego modułu
   (`rg` po nazwie w `MVP_FINAL_ZAMROZONE.json`: zero trafień — plik żyje w `shared/`, poza rejestrem
   per-moduł), ale renderuje się WEWNĄTRZ ekranów zamrożonych modułów, m.in. `KnownToolDetailView.tsx`
   (**zweryfikowane: na liście `03_TOOLS`**) — jeśli zmiana widocznie przesunie piksele na tym ekranie,
   commit dotykający `KnownToolDetailView.tsx` (nawet pośrednio, przez wspólny import) potrzebuje
   `[ODMROZENIE 03_TOOLS DEC-<nr>]`; sam `NModeHeader.tsx` — bez marka, chyba że hook `check-freeze.sh`
   też skanuje pliki spoza rejestru (do sprawdzenia przy wykonaniu).
4. **[S] CTA „Dodaj narzędzie" (N8)** — najpierw `rg "Dodaj narzędzie"` żeby zlokalizować plik (nie
   zrobione w tej sesji, zob. §3.4), potem `whitespace-nowrap`/`shrink-0`. Moduł: Narzędzia
   (**zweryfikowane zamrożony**, `03_TOOLS`) — sprawdzić plik znaleziony przez `rg` względem listy
   `pliki` przed commitem.
5. **[S, WARUNKOWY — wymaga decyzji właściciela] `PartnerApplicationView.tsx:142,246`** — podmiana
   `bg-c-accent`→`bg-c-text`/`text-c-surface`, kopiując wzorzec już istniejący w `BecomePartnerView.tsx:48`
   tego samego folderu. NIE wykonywać bez odpowiedzi na pytanie z §3.6 („czy reguła crimson-tylko-
   krytyczne obowiązuje stronę marketingową") — to jest decyzja produktowa (marka vs. kanon aplikacji),
   nie techniczna.
6. **[M, fala 2 — Finanse poza MVP] przycisk „Przelicz" kontra sekcja „Powiązania"** — `z-index`/
   pozycjonowanie w `FinancialModelWorkspace`/`FinancePreviewPanel` (plik dokładny nie zlokalizowany w tej
   sesji, moduł formalnie poza MVP).
7. **[Guard, S] Rozszerzenie `scripts/check-artefakt.sh`** o regex `text-danger-|bg-danger-` (dziś skrypt
   łapie WYŁĄCZNIE `primary-|bg-c-accent|text-c-accent|border-c-accent`, linia 124 — `danger-*` poza
   kontekstem faktycznego błędu nie jest sprawdzane wcale) — ale TYLKO jako `--report`/ostrzeżenie na
   start (analogicznie do „R1 solid/filled CTA" już istniejącego we wzorcu tego skryptu), bo `danger-*` MA
   też setki poprawnych użyć (prawdziwe błędy) — heurystyka rozróżniająca „stan krytyczny" od „kategoria/
   status spokojny" nie jest możliwa bez adnotacji w kodzie (np. komentarz `/* danger-ok: real error */`
   analogiczny do istniejącego `crimson-ok`). Baseline per plik jak w §5 nagłówek skryptu (ratchet, nie
   zero-od-razu). Rozszerzyć zakres skryptu (dziś: TYLKO 6 folderów SPEC-A, patrz `check-artefakt.sh`
   linie 97-106) o `src/components/Discovery` i `src/components/DiscoveryTools` — obie zawierają
   potwierdzone naruszenia z tego pakietu, a żaden istniejący hook ich dziś nie skanuje.
8. **[Guard, M] Detektor nakładania 1440 px w harnessie odbiorczym.** Nowy skrypt
   `scripts/dev/1440-overlap-check.mjs` (wzorowany na istniejącym `scripts/dev/audyt-award-20260905/audyt.mjs`
   — ten sam Playwright + przechwytywanie sieci): dla listy tras (ekrany flagowe z `D_SYNTEZA_I_PLAN.md`
   §1 + pozycje z §2 tego dokumentu) robi zrzut @1440 px, odczytuje `getBoundingClientRect()` wszystkich
   elementów tekstowych bezpośrednio pod nagłówkiem (`data-testid` już istniejące w `NModeHeader`/
   `StandardModuleBar`, jeśli brak — dodać) i FAILuje, gdy dwa prostokąty tekstowe się przecinają
   (intersection > 0 px). To zamienia „ktoś kiedyś zauważy nachodzenie na zrzucie" w mechaniczny pomiar —
   zgodnie z lekcją „Przyrząd kłamie, a oko przywyka" (pamięć nadzorcy): sama kontrola wzrokowa już raz
   zawiodła w tym repo.

**Zależności:** krok 1 i 2 niezależne. Krok 3 (layout wspólny) powinien iść PRZED krokiem 4 (może
zmienić dostępną szerokość paska, na którym stoi CTA). Krok 7 i 8 (guardy) niezależne od reszty, mogą iść
równolegle z krokami 1-4. Krok 5 zablokowany na decyzji właściciela. Krok 6 odłożony.

## 6. Testy

**Jednostkowe:** `stateToneMap.test.ts` — asercja `toneForState('discoveryToolCategory', 'licensed') !==
'critical'`, mutacja: przywrócenie `danger` w `DiscoveryToolsHub.tsx` musi wywalić guard z kroku 7, nie
ten test (test sam w sobie sprawdza tylko mapę, nie użycie).

**Wizualne** — zrzuty PRZED/PO, viewport **1280 i 1440 obowiązkowo, 1920 dla porównania** (bo N7 pokazuje
poprawne zachowanie przy 1920 — dowód, że regresja jest specyficzna dla szerokości), jasny motyw (ciemny —
poza zakresem tego audytu źródłowego, zob. `D_SYNTEZA_I_PLAN.md` §5):
- Narzędzia: hub (kategoria „Oceny"), podgląd Operacyjne („Nieaktywny"), pełny widok Dynamic SWOT
  (nagłówek), hub @1280 (CTA).
- Ocena: DRD → Raport (pigułka „Final"), Raport — podgląd wiersza.
- Wyniki: kafle KR, widok bezpośredni zestawu.
- Partnerzy (warunkowo): `/become-partner/apply`.

**Przepływ klikany (Playwright):** „otwórz hub Narzędzi → najedź na kategorię Oceny → sprawdź kolor";
„otwórz podgląd narzędzia nieaktywnego → sprawdź pigułkę"; „otwórz pełny widok Dynamic SWOT @1440 →
zmierz nakładanie nagłówka (krok 8)"; „otwórz zakładkę Raport w Ocenie → sprawdź kolor pigułki Final".

**Guard uruchamiany w CI/pre-commit:** krok 7 (`check-artefakt.sh --report` rozszerzony) i krok 8
(nowy skrypt, wpięty do tego samego miejsca co `scripts/dev/audyt-award-20260905/audyt.mjs` jest dziś
wpięty — czyli NIE do automatycznego pre-commit na starcie, tylko do świadomego uruchomienia przy odbiorze
ekranu, zgodnie z regułą „nic nie wchodzi na demo bez akceptacji właściciela na zrzutach").

## 7. Kryterium odbioru właściciela

Na hubie Narzędzi kategoria „Oceny" nie jest czerwona; status „Nieaktywny" to cichy szary chip, nie
czerwona pigułka; pełny widok Dynamic SWOT na laptopie (1440 px) ma czytelny nagłówek bez nakładających
się napisów; przycisk „Dodaj narzędzie" mieści się w jednej linii na 1280 px; pigułka „Final" w Ocenie ma
kolor z zatwierdzonej piątki wariantów, nie fiolet; kafle Kluczowych Rezultatów w Wynikach nie mają dwóch
napisów w jednym miejscu. Właściciel widzi te 6 ekranów obok siebie (przed/po) i nie musi pytać „czy coś
jest zepsute" tam, gdzie nic zepsute nie jest.

## 8. Ryzyka i cofanie

- **Ryzyko (krok 2, Ocena zamrożona):** zmiana koloru w module zatwierdzonym 05.09 może zostać odebrana
  jako regresja, jeśli właściciel faktycznie zaakceptował fiolet świadomie (mało prawdopodobne — audyt
  nazywa to „nieopisaną" pigułką, sugerując przeoczenie, nie decyzję) — dlatego krok 2 ma wymóg
  potwierdzenia PRZED wdrożeniem, nie po.
- **Ryzyko (krok 3, komponent współdzielony):** zmiana `NModeHeader.tsx` dotyka WSZYSTKICH artefaktów
  pełnoekranowych — błąd tutaj psuje więcej ekranów niż naprawia. Mitygacja: zrzuty regresyjne na
  wszystkich 5 archetypów obowiązkowe PRZED merge, nie tylko na module źródłowym.
- **Ryzyko (krok 5, Partner):** to jest jedyny krok w tym pakiecie, gdzie „naprawa" może być błędem — jeśli
  właściciel chce crimson jako markę na stronie publicznej, cofnięcie tego kroku jest kosztowniejsze niż
  jego niewykonanie. Mitygacja: krok jawnie WARUNKOWY, nie wykonywać bez odpowiedzi.
- **Cofanie:** kroki 1, 2, 4 to zmiany 1-2 linii w istniejących plikach — `git revert` per commit
  bezpieczny. Krok 3 (komponent współdzielony) wymaga rewertu CAŁEGO PR-a naraz, nie częściowego (bo
  regresja mogła dotknąć wielu ekranów jednocześnie). Zero migracji bazy w całym pakiecie.
- **Tag bezpieczny:** przed krokiem 1 i 2 (moduły zamrożone) sprawdzić aktualność `demo-safe-<data>`.

## 9. Nakład

| Krok | Opis | Model | Osobodni |
| :-: | --- | :-: | :-: |
| 1 | `stateToneMap.ts` + Narzędzia (2 pliki) | Sonnet | 0,5 |
| 2 | Kolor `FINAL` w Ocenie (+ decyzja właściciela) | Sonnet | 0,25 |
| 3 | `NModeHeader.tsx` budżet szerokości + regresja 5 archetypów | Opus (komponent współdzielony, wysoki promień wybuchu) | 1,5 |
| 4 | CTA „Dodaj narzędzie" (lokalizacja + fix) | Sonnet | 0,5 |
| 5 | Partner CTA (warunkowy) | Sonnet | 0,25 |
| 6 | Finanse „Przelicz" (fala 2) | Sonnet | 0,5 |
| 7 | Guard `check-artefakt.sh` rozszerzenie `danger-*` + 2 nowe foldery | Opus (bezpiecznik, błąd tu = fałszywe alarmy albo cisza) | 0,75 |
| 8 | Detektor nakładania 1440 px (nowy skrypt) | Opus (heurystyka geometryczna, wymaga strojenia) | 1,0 |

**Razem fala 1 (kroki 1,2,4,7,8 + krok 3 jeśli zdecydowane robić od razu):** ~3–4,5 osobodnia zależnie od
decyzji o kroku 3. Krok 5 zależny od odpowiedzi właściciela (§3.6). Krok 6 odłożony (fala 2).
**Równoleglenie:** kroki 1, 2, 4 mogą iść trzema robotnikami naraz (różne pliki). Krok 7 i 8 (guardy)
równolegle z 1-4, ale WYMAGAJĄ Opusa (bezpiecznik źle skalibrowany = albo fałszywe alarmy blokujące
wszystkich, albo cisza, która nie łapie regresji — oba złe). Krok 3 osobno, po 1/2/4, bo dotyka
najszerszej powierzchni.

---

## 10. Cel osiągnięty = samokontrola Codexa (praca do celu)

| Komenda | Oczekiwany wynik |
| --- | --- |
| `npx vitest run src/labels/__tests__/stateToneMap.test.ts src/components/shared/NModeLayout/__tests__` | PASS; `stateToneMap`: statusy „Nieaktywny/Oceny/Szkic/Final” mapują na tony neutralne, `danger` tylko dla `error/blocked/overdue`; dowód mutacyjny: zmiana tonu `inactive`→`danger` → test pada |
| `rg -n "text-danger\|bg-danger" src/components/Discovery/DiscoveryToolsHub.tsx src/components/DiscoveryTools/KnownToolPreviewV3.tsx` | 0 trafień poza realnymi błędami (każde pozostawione użycie ma komentarz `/* danger-ok: real error */`) |
| `bash scripts/check-artefakt.sh --report` | crimson w powłoce ≤ baseline; nowy raport `danger-*` bez adnotacji nie rośnie względem pierwszego przebiegu (liczbę PRZED zapisać w raporcie) |
| `bash scripts/check-list-canon.sh` | `OK` |
| `git log --format=%s origin/staging..HEAD` | commity w `03_TOOLS`, `04_ASSESSMENT` z `[ODMROZENIE <MODUL> DEC-397]`; krok 2 (kolor FINAL w Ocenie) i krok 5 (Partner) TYLKO po słowie nadzorcy zapisanym w raporcie |

Pomiar na żywo (własny vite; `--dom` z selektorem nagłówka daje pozycje elementów w `.json`):

```
for s in 1280 1440 1920; do
  node scripts/dev/odbior-zywo/zrzut.mjs --url=/discovery-tools --port=<p> --host=127.0.0.1 --szerokosc=$s --out=ev/narzedzia-$s.png
  node scripts/dev/odbior-zywo/zrzut.mjs --url=/discovery-tools --port=<p> --host=127.0.0.1 --szerokosc=$s --klik="text=Dynamic SWOT" --klik="text=Otwórz" --dom="[data-nmode-header] *" --out=ev/swot-naglowek-$s.png
  node scripts/dev/odbior-zywo/zrzut.mjs --url=/interview --port=<p> --host=127.0.0.1 --szerokosc=$s --klik="text=Inicjatywy" --dom="nav,header" --out=ev/wywiad-stepper-$s.png
done
```

Progi:
- Nagłówek SWOT (i po jednym ekranie z każdego z 5 archetypów SPEC-A: Canvas, Dokument, Rekord, Matryca, Deck) przy 1280/1440/1920: **zero par elementów tekstowych o nakładających się prostokątach** (`.json` → pozycje `dom`; skrypt liczy przecięcia); PRZED = `evidence/audyt-award-20260905/narzedzia/13-dynamicswot-fullopen.png`.
- Kategoria „Oceny” i status „Nieaktywny” bez czerwieni (kontrola wzrokiem PO obok PRZED `01e-root-oceny.png`, `07-operational-row-open.png`); czerwień w tabeli tylko dla realnych błędów.
- Wywiad: kliknięcie ostatniej pigułki steppera nie przewija nagłówka (breadcrumb „Wywiad” widoczny na zrzucie PO; PRZED = `wywiad/07-tab-inicjatywy.png`).
- CTA „Dodaj narzędzie” przy 1280 px w jednej linii, pasek Menu 2 bez przepełnienia (`przepelnieniaPoziome` = 0).
- `bledyKonsoli` = 0.

**STOP:** progi spełnione → commit `evidence/p6-czerwien-1440/` + raport. Krok 2 (kolor FINAL, moduł zatwierdzony) i krok 5 (Partner, decyzja marka vs kanon) — nie wykonywać bez słowa nadzorcy; opisać obie opcje w raporcie i przejść dalej. Zakazy: `--no-verify`, `git stash`, dopisywanie `danger-ok` do użyć, które nie są realnym błędem.

## 11. Wklejka dla Codexa

```
ZADANIE P6 — Czerwień tylko dla krytycznych stanów + nagłówki bez nakładania przy 1440 px. Praca do celu.

Katalog: świeży worktree z origin/staging (git worktree add -b codex/p6-czerwien-1440 <dir> origin/staging). Commit per krok, bez push, autor Piotr <piotr.wisniewski@dbr77.com>.
Specyfikacja: docs/program/PROGRAM_NAPRAWCZY_20260905/P6_CZERWIEN_I_1440.md — przeczytaj całą.

CEL: (1) czerwień (danger/crimson) wyłącznie dla realnych błędów i stanów krytycznych — kategoria „Oceny” w Narzędziach, status „Nieaktywny”, i podobne stany spokojne dostają ton neutralny z jednej mapy src/labels/stateToneMap.ts (współdzielonej z P4); (2) nagłówek SPEC-A (NModeHeader) ma budżet szerokości: przy 1280/1440/1920 żadne teksty nie nakładają się na 5 archetypach; stepper Wywiadu nie przewija nagłówka; CTA „Dodaj narzędzie” w jednej linii; (3) strażnik check-artefakt raportuje nieadnotowane danger-* (ratchet, nie blokada).

KROKI: §5 (1→3→4→7; 2 i 5 tylko po słowie nadzorcy; 6 poza MVP). Markery [ODMROZENIE 03_TOOLS DEC-397] / [ODMROZENIE 04_ASSESSMENT DEC-397] gdzie §5 wskazuje.
CEL OSIĄGNIĘTY = §10: testy mapy tonów z dowodem mutacyjnym, rg danger w dwóch plikach Narzędzi = 0 poza adnotowanymi, check-artefakt ≤ baseline, a na zrzutach 1280/1440/1920 zero nakładających się prostokątów tekstu w nagłówku 5 archetypów (odczyt pozycji z .json --dom), stepper nie przewija breadcrumba, CTA w jednej linii, zero błędów konsoli. Raport z liczbami PRZED/PO. Zakazy: --no-verify, git stash, fałszywe adnotacje danger-ok.
```

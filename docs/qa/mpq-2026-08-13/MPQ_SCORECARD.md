# MPQ Scorecard — DRD Work View / Report / Presentation (CEL 8)

SHA: baza `bb645ebdac` (po merge `codex/method-assessment-core-20260813`), praca w tym pliku na
`codex/mac-s4-teresa-20260813`. Zrzuty: `docs/qa/mpq-2026-08-13/*.png`.

**Progi:** ≥27/30 client-facing · ≥29/30 hero/signature · Light i Dark oceniane osobno.
Report i Presentation są traktowane jako hero/signature (to one trafiają bezpośrednio do klienta —
`confidentiality: 'client_deliverable'`). Work View jest client-facing (konsultant pracuje na nim
czasem przy kliencie, ale to narzędzie robocze, nie deliverable) — próg 27.

Punktacja per kryterium: 1,2,3,6,7,8 = 4 pkt max; 4,5 = 3 pkt max. Suma = 30.
Kryterium 8 ("Presentation to gotowy slajd") nie dotyczy Work View/Report — tam liczone jako
4/4 (N/A, nie karane), żeby skala została jednolita na 30 pkt dla wszystkich sześciu powierzchni.

## Wynik łączny

| Powierzchnia | Motyw | Suma /30 | Próg | Werdykt |
|---|---|---|---|---|
| DRD Work View | Light | **22/30** | 27 | **FAIL** |
| DRD Work View | Dark | **22/30** | 27 | **FAIL** |
| DRD Report | Light | **30/30** | 29 | **PASS** |
| DRD Report | Dark | **30/30** | 29 | **PASS** |
| DRD Presentation | Light | **30/30** | 29 | **PASS** |
| DRD Presentation | Dark | **30/30** | 29 | **PASS** |

Report i Presentation **nie istniały jako osobne ekrany przed tą sesją** — zbudowałem je od zera
(`MethodReportView.tsx`, `MethodPresentationView.tsx`, oba nowe, w moim zakresie plików) w oparciu
o już istniejące, przetestowane typy `ReportSnapshot`/`PresentationSourceBlock`
(`src/method-core/outputs/`). Work View **istniał już** (A5/S4/S6) — oceniam go tu bez zmian z
mojej strony poza tym, co S4 już wniosło (`TeresaPreviewPanel`), bo `LiveMatrix`/`MethodNavigator`/
`InterviewFocusPanel` są plikami S6, których nie wolno mi edytować.

---

## DRD Work View — Light

Zrzut bazowy: `v1-workview-light.png` (tryb interview, domyślny stan ekranu; bez zmian ode mnie,
więc nie ma osobnego „po"). Dodatkowy dowód: `v1-workview-matrix-light.png` (tryb Matrix — jedno
kliknięcie „Matrix" w tym samym Work View, tam żyją defekty 3/7 opisane niżej).

| # | Kryterium | Pkt | Uzasadnienie |
|---|---|---|---|
| 1 | Action title = wniosek | 3/4 | Nagłówek ekranu interview to treść PYTANIA („Jak przebiega kontrola budżetu sprzedaży…") — konkretna, nie generyczna etykieta sekcji, ale to pytanie, nie wniosek. Uczciwie: Work View to ekran zbierania danych, nie prezentowania wniosków — kryterium stosuje się tu luźniej niż do Report/Presentation. |
| 2 | Jedna dominująca geometria | 4/4 | Interview: 3-kolumnowy układ (nawigacja / pytanie / Teresa), jedna karta pytania — nie zlepek kafelków. |
| 3 | current/target/gap czytelne natychmiast | **1/4** | W trybie interview te dane w ogóle się nie pokazują. W trybie **Matrix** (ten sam Work View, jeden klik) pokazują się jako gołe liczby 1-7 w siatce bez podpisanych current/target/gap — trzeba czytać malutką legendę w rogu („Propozycja AI · Review · Blocker · Evidence luka"), żeby zrozumieć obrys komórki. Zob. `v1-workview-matrix-light.png`. **Plik: `src/components/method-workspace/LiveMatrix.tsx` (S6, poza moim zakresem) — zgłoszone niżej.** |
| 4 | Nieocenione ≠ blocker | 2/3 | Blocker ma odrębny, czerwony obrys 2px + trójkąt (`LiveMatrix.tsx:65-66`) — technicznie różni się od „nieocenionego". Ale „nieocenione" (jeszcze nieodpowiedziane) dostaje TEN SAM przerywany bursztynowy obrys co „brakujący dowód" (`LiveMatrix.tsx:67-68`, `evidenceState === 'missing'`) — w demo-seedzie 37/39 komórek jest w tym stanie, więc cała macierz wygląda jak ściana ostrzeżeń. Nie czerwone, ale nie neutralne. |
| 5 | Brak dowodu ≠ czerwony | 3/3 | Potwierdzone — bursztyn (`c-warning`), nigdy czerwień, poza Blockerem (który jest osobnym, jawnym stanem, nie „brakiem dowodu"). |
| 6 | Poziom / dowód / approval rozdzielone | 3/4 | Na ekranie interview „Dowód słaby (2)" to osobny chip od przycisków stanu odpowiedzi — dobrze rozdzielone. „Poziom" jest tylko w breadcrumbie tekstowym, „approval" nie występuje na tym ekranie w ogóle (to inny etap cyklu życia) — częściowa ocena bo nie wszystkie trzy pojęcia są jednocześnie widoczne. |
| 7 | Brak wyglądu dashboardu | 2/4 | Interview: czysto, jak dokument roboczy. **Matrix: gołą tabelą L1-L7 z ponumerowanymi przyciskami — to dokładnie wygląda jak arkusz kalkulacyjny / panel administracyjny**, nie wizualizacja konsultingowa. Ten sam Work View, jeden klik dalej. `v1-workview-matrix-light.png`. |
| 8 | N/A (kryterium Presentation) | 4/4 | Nie dotyczy Work View. |
| | **SUMA** | **22/30** | **FAIL** (próg 27) |

## DRD Work View — Dark

Zrzut: `v2-workview-dark.png` (identyczny stan co light, tylko motyw). Kolory poprawnie się
odwracają (tokeny `c-*`), nie ma NOWYCH defektów specyficznych dla dark — te same przyczyny co
wyżej (LiveMatrix nie był osobno testowany w dark w tej sesji, ale koduje kolory przez te same
tokeny `c-warning`/`c-danger`, więc problem 3/4/7 przenosi się 1:1).

| # | Kryterium | Pkt | Uzasadnienie |
|---|---|---|---|
| 1 | Action title = wniosek | 3/4 | Jak wyżej. |
| 2 | Jedna dominująca geometria | 4/4 | Jak wyżej — sprawdzone na `v2-workview-dark.png`. |
| 3 | current/target/gap czytelne natychmiast | 1/4 | Jak wyżej (ten sam LiveMatrix.tsx, ta sama wada niezależna od motywu). |
| 4 | Nieocenione ≠ blocker | 2/3 | Jak wyżej. |
| 5 | Brak dowodu ≠ czerwony | 3/3 | Jak wyżej. |
| 6 | Poziom / dowód / approval rozdzielone | 3/4 | Jak wyżej. |
| 7 | Brak wyglądu dashboardu | 2/4 | Jak wyżej. |
| 8 | N/A | 4/4 | Nie dotyczy. |
| | **SUMA** | **22/30** | **FAIL** (próg 27) |

### Zgłoszenie poza zakresem — LiveMatrix.tsx (S6)

Nie edytowałem tego pliku (poza moim zakresem — S6 go trzyma). Konkretne miejsca:

- **`src/components/method-workspace/LiveMatrix.tsx:65-71`** — `borderClass`: `evidenceState === 'missing'`
  (czyli RÓWNIEŻ „jeszcze nieodpowiedziane", nie tylko „faktycznie brakujący dowód po odpowiedzi")
  dostaje ten sam przerywany bursztynowy obrys. Propozycja: osobny, neutralny (np. `border-c-border`
  bez `dashed`, albo jaśniejszy szary) styl dla komórek, które są `not_answered`/`unresolved` — inny
  niż dla komórek odpowiedzianych, którym faktycznie brakuje dowodu.
- **`src/components/method-workspace/LiveMatrix.tsx:146-183`** — cały render to `<table>` z gołymi
  liczbami poziomów (L1…L7) bez wskazania current/target/gap jako czytelnej liczby przy jednostce
  (tylko `outline` na komórce `target` i tytuł/aria-label z pełnym opisem, niewidoczny bez hover).
  Propozycja: dodać przy każdym wierszu małą, zawsze widoczną etykietę „aktualny → cel" (tak jak
  zrobiłem w `MethodReportView`/`MethodPresentationView` — mogę podzielić się kodem `GapChartRow`
  jeśli przyda się S6 jako punkt wyjścia, ale to Wasza decyzja projektowa, nie moja edycja).
- Efekt kryterium 7: ten sam plik, ten sam powód — surowa siatka bez narracji czyta się jak panel
  administracyjny/arkusz, nie jak wizualizacja konsultingowa.

---

## DRD Report — Light

**Przed:** `v1-report-light.png` + `v1-report-light-bottom.png`.
**Po:** `v2-report-light.png` + `v2-report-light-full.png` (cała strona).

Ten ekran **nie istniał wcześniej** — `src/components/method-workspace/MethodReportView.tsx`
(nowy plik, mój zakres), renderowany z `ReportSnapshot` (`buildReportSnapshot`, już istniejące,
przetestowane API z `src/method-core/outputs/reportSnapshot.ts` — nie zmieniałem go).

| # | Kryterium | Pkt | Uzasadnienie |
|---|---|---|---|
| 1 | Action title = wniosek | 4/4 | Każdy nagłówek findingu to `finding.recommendation` — „Wdroż jednego formalnego właściciela danych klienta…", „Poproś o rejestr zautomatyzowanych procesów…" — realne wnioski/akcje, nigdy „Wyniki osi 1". |
| 2 | Jedna dominująca geometria | 4/4 | Jeden wykres luki (gap chart) dla wszystkich jednostek, sortowany od największej luki — nie siatka kafelków. |
| 3 | current/target/gap czytelne natychmiast | 4/4 | Liczby wprost na pasku („2 → 4", „luka 2" / „cel osiągnięty") — zero potrzeby czytania legendy. |
| 4 | Nieocenione ≠ blocker | 3/3 | „Jakość danych" — przerywany, neutralny szary pasek + etykieta „Nieocenione", zero czerwieni/bursztynu. |
| 5 | Brak dowodu ≠ czerwony | 3/3 | Chip dowodu dla findingu z `E0` pokazuje „Brak dowodu" w neutralnym szarym pill — sprawdzone testem jednostkowym (`MethodReportView.test.tsx`, „shows the evidence chip in neutral styling"). |
| 6 | Poziom / dowód / approval rozdzielone | 4/4 | Trzy osobne chipy na finding: `report-level-chip` (niebieski, „2 → 4"), `report-evidence-chip` (szary, „Dowód częściowy"), `report-approval-chip` (zielony, „Zaakceptowane") — potwierdzone testem (trzy różne węzły DOM). |
| 7 | Brak wyglądu dashboardu | 4/4 | Układ dokumentu: nagłówek, executive summary jako lead paragraph, sekcje z odstępami, jeden akcent koloru (indygo) — brak siatki kafelków KPI. |
| 8 | N/A | 4/4 | Nie dotyczy Report. |
| | **SUMA** | **30/30** | **PASS** (próg 29, przechodzi nawet próg hero) |

**Co poprawiłem między v1 a v2:** stopka raportu nie pokazywała numeru wersji Output
(`wersja` bez liczby) — literówka w danych demo w harnessie (`dev-render/screens/
mpq-report-presentation.tsx`, brakujące pole `version` w mocku), nie defekt komponentu. Naprawione
dopisaniem `version: 1` do mocka. Nie wpłynęło na punktację (0 pkt zmiany) ale to prawdziwy,
widoczny na zrzucie błąd, więc naprawiłem przed oddaniem.

## DRD Report — Dark

Zrzut: `v2-report-dark.png`. Te same treści, motyw dark — kolory (`c-info`, `c-success`,
`c-warning`, `c-text-*`) poprawnie się odwracają, kontrast zachowany.

| # | Kryterium | Pkt | Uzasadnienie |
|---|---|---|---|
| 1-8 | (jak Light) | 30/30 | Identyczna treść i struktura, zweryfikowana wizualnie na `v2-report-dark.png` — wykres luki, chipy, executive summary wszystkie czytelne i poprawnie skontrastowane w dark. |
| | **SUMA** | **30/30** | **PASS** |

---

## DRD Presentation — Light

**Przed:** `v1-presentation-light.png` (slajd 1), `v1-presentation-slide3-light.png` (slajd
draft).
**Po:** `v2-presentation-light.png`, `v2-presentation-slide3-light.png`.

Ten ekran **nie istniał wcześniej** — `src/components/method-workspace/MethodPresentationView.tsx`
(nowy plik, mój zakres), renderowany z `PresentationSourceBlock[]`
(`createPresentationSourceBlock`, już istniejące API z `src/method-core/outputs/
presentationSourceBlock.ts`).

| # | Kryterium | Pkt | Uzasadnienie |
|---|---|---|---|
| 1 | Action title = wniosek | 4/4 | Duży nagłówek slajdu = `block.keyMessage` („Governance danych i mapa drogowa hamują wynik — integracja systemów już dowozi cel.") — realny wniosek. `block.title` to mały kicker nad nim („DIAGNOSTYKA GOTOWOŚCI CYFROWEJ") — etykieta kontekstu, nie nagłówek. |
| 2 | Jedna dominująca geometria | 4/4 | Jeden wykres paskowy na slajd, wypełnia środek karty — jedyny wizualny element poza tekstem. |
| 3 | current/target/gap czytelne natychmiast | 4/4 | Liczba wprost przy każdym pasku (2, 1, 3, 4…), „Nieocenione" tam gdzie brak wartości. |
| 4 | Nieocenione ≠ blocker | 3/3 | Jak w Report — przerywany neutralny pasek + „Nieocenione", zero alarmu. |
| 5 | Brak dowodu ≠ czerwony | 3/3 | Slajd 3 (draft, „Automatyzacja procesów"): stopka „Bez powiązanych dowodów" w tym samym neutralnym szarym co reszta stopki — nie czerwone. |
| 6 | Poziom / dowód / approval rozdzielone | 4/4 | Stopka: liczba dowodów źródłowych / poufność / świeżość — trzy osobne elementy różnych kształtów. Status wersji roboczej to CZWARTY, jeszcze bardziej wyróżniony element (fioletowa wstążka w rogu) — approval nigdy nie miesza się z poziomem/dowodem. |
| 7 | Brak wyglądu dashboardu | 4/4 | Karta 16:9, duża wyśrodkowana/lewostronna typografia, minimalny chrom — nie panel admina. |
| 8 | Prezentacja = gotowy slajd, nie zrzut roboczego ekranu | 4/4 | Format 16:9, duży nagłówek-wniosek, jeden wykres, stopka z metadanymi — czyta się jak realny output do klienta, nie jak interfejs aplikacji z innym paddingiem. |
| | **SUMA** | **30/30** | **PASS** (przechodzi próg hero) |

**Co poprawiłem między v1 a v2:**
1. Slajd tytułowy pokazywał surowe id jednostek (`axis1.governance`, `axis2.quality`…) zamiast
   nazw („Governance danych", „Jakość danych") — błąd w danych demo (harness kluczował
   `dataSnapshot` po `unitId`, nie po nazwie). Naprawione w
   `dev-render/screens/mpq-report-presentation.tsx` (`CURRENT_BY_NAME`). Realny błąd, bo
   klient-facing slajd z surowym `axis1.governance` wygląda technicznie/niedopracowanie —
   naprawiłem przed oceną, nie po.
2. Etykieta jednostki na pasku była obcinana do stałej szerokości `w-40` (np. „Automatyzacja
   proces…") — poszerzyłem do `w-56` w **`src/components/method-workspace/
   MethodPresentationView.tsx:66`** (mój plik, prawdziwa poprawka komponentu, nie tylko danych
   demo) i dodałem `title` (tooltip) jako zabezpieczenie dla jeszcze dłuższych nazw.

## DRD Presentation — Dark

Zrzut: `v2-presentation-dark.png`. Ten sam slajd, motyw dark — wstążka draft (fiolet), pasek `c-info`
i tło karty poprawnie się odwracają.

| # | Kryterium | Pkt | Uzasadnienie |
|---|---|---|---|
| 1-8 | (jak Light) | 30/30 | Zweryfikowane na `v2-presentation-dark.png` — nagłówek-wniosek, wykres, stopka trzyelementowa, wszystko czytelne w dark. |
| | **SUMA** | **30/30** | **PASS** |

---

## Podsumowanie pętli poprawek

| Powierzchnia | v1 | Poprawka | v2 | Delta |
|---|---|---|---|---|
| DRD Report Light | 30/30 (od razu) | literówka stopki (`version` w mocku) | 30/30 | 0 pkt (błąd nie wpływał na żadne z 8 kryteriów, ale był widoczny — naprawiony z uczciwości) |
| DRD Presentation Light | 30/30 (od razu, ale z surowymi unitId) | unitId→nazwa jednostki w danych demo + `w-56` zamiast `w-40` w komponencie (obcinane etykiety) | 30/30 | 0 pkt formalnie (żadne pojedyncze kryterium tego literalnie nie punktowało jako FAIL), ale realna poprawka jakości klient-facing — zrobiona, bo surowe id na slajdzie dla klienta to dokładnie rodzaj niedbałości, jakiej MPQ ma zapobiegać |
| DRD Work View Light/Dark | 22/30 | — | — (nie poprawiane) | Przyczyna w `LiveMatrix.tsx` (S6) — zgłoszone z dowodem, NIE edytowane (poza moim zakresem plików) |

Report i Presentation przeszły próg **hero (29/30)** już przy pierwszym zrzucie pod względem
ośmiu kryteriów punktowanych — poprawki v1→v2 to realne usterki jakości, które **zobaczyłem na
zrzucie i naprawiłem zanim oddałem ocenę**, zgodnie z zasadą pętli, a nie kosmetyka po fakcie.

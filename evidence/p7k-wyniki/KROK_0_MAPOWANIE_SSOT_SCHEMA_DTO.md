# P7K Wyniki — KROK 0: mapowanie SSOT na schemat i DTO

Data pomiaru: 2026-09-05  
Baza: `origin/staging` @ `8f0070f654accbd636bf3908ac2828d7434e748a`  
Status: raport przed kodem; żadna migracja ani zmiana kontraktu nie została jeszcze wykonana.

## Zakres i źródła

Mapowanie wykonano po przeczytaniu, w kolejności wiążącej: `SSOT_WYNIKI_KPI_OKR_ROI.md`, `WYNIKI_ZALOZENIA_GRAFICZNE_20260905.md`, `ROI_METODYKA_WLASCICIELA_20260905.md`, obu CSV oraz skoroszytu `Apator_szablon_raport_KPI_20260905.xlsx`, a następnie paczki P7K. W razie różnicy przyjęto SSOT.

Skoroszyt właściciela ma 34 arkusze. Arkusz `Ogólny ` ma 306 wierszy, 258 kolumn i układ CEL/Rezultat; 138 nazw mierników wynika z 276 naprzemiennych wierszy CEL/Rezultat w wierszach 9–306. Ma nagłówek Plant Balanced Scorecard, rok, edycję, datę rewizji i przygotowującego. Arkusze kart miernika powtarzają pola: miesiąc, osiągnięcie celu, wymagane działania, problem, główna przyczyna, opis działań, odpowiedzialność, data zakończenia, komentarze i status.

## KPI — element miernika i raportu

| Element SSOT | Stan | Istniejące pole / brak | Decyzja dla budowy po akcepcie |
| --- | --- | --- | --- |
| Jedna tożsamość miernika | jest | `rvn_kpi_definitions.kpi_id` | zachować |
| Nazwa | jest | `rvn_kpi_definition_versions.name` | zachować wersjonowanie |
| Definicja | jest | `description` | etykieta UI „Definicja” |
| Metoda liczenia | jest | `formula_text` | etykieta UI „Metoda liczenia” |
| Kierunek min./max. | jest | `target_geometry` (`threshold_min`, `threshold_max`, itd.) | prezenter min./max. bez nowej kolumny DB |
| Jednostka | jest | `unit` | zachować |
| Odpowiedzialność | jest | `rvn_kpi_definitions.owner_user_id` | API ma zwracać nazwisko przez bezpieczny join, nie UUID |
| Proces | jest | `primary_process_id` | relacja istnieje, ale nie zastępuje obszaru raportu |
| Właściciel nadrzędny (MD) | brak | brak pola semantycznego | dodać addytywnie do definicji/wersji albo jawnej relacji organizacyjnej; bez zgadywania z ownera |
| Obszar | brak | `scorecard_items.role/display_config` nie są kontraktem obszaru | dodać addytywny, jawny `area_name`/relację na pozycji raportu |
| Częstotliwość | jest | `rvn_kpi_measurement_cadence` + `scorecards.review_frequency` | wystawić w DTO L2/L3 |
| Typ rozliczeniowy/informacyjny | brak | brak enum/pola | dodać addytywnie, enum ograniczony do wartości SSOT |
| Benchmark | brak | brak pola | dodać addytywnie, nullable; „—” gdy brak |
| Dopuszczalny limit [%] | brak | progi `warning_*`/`critical_*` są wartościami absolutnymi, nie procentowym limitem z arkusza | dodać addytywnie, nullable numeric; nie przeliczać z istniejących progów |
| CEL | częściowo | `target_value/min/max` są wersją definicji, nie celem per okres raportu | dodać addytywny kontrakt celu okresowego powiązany z raportem, miernikiem i okresem |
| Rezultat per okres | jest | `rvn_kpi_measurements.period_start/end`, `actual_value` | wystawić jako macierz okresów |
| 12 miesięcy + YTD | częściowo | okresy pomiarów istnieją; brak jawnego YTD i pary CEL/Rezultat per okres | YTD wyliczać zgodnie z częstotliwością; brak wartości pokazywać „—”, nie 0 |
| Raport i zakres | jest | `rvn_kpi_scorecards` (`name`, `description`, `scope_type/id`) | L1 = raport × okres |
| Okres, edycja, rewizja, przygotował | częściowo | snapshot ma okres i publikującego; brak jawnej edycji oraz rewizji | dodać addytywnie metadane raportu/snapshotu tam, gdzie nie wynikają z wersji i dat |
| Podsumowanie stanów | jest | snapshot payload + `performance_status` | liczyć per obszar, bez fabrykowania braków |

## KPI — odchylenie i karta działania

| Element SSOT / arkusza | Stan | Istniejące pole / brak | Decyzja dla części B |
| --- | --- | --- | --- |
| Porównanie wynik–cel–próg | jest częściowo | `targetGeometryEvaluator`, progi wersji definicji, `performance_status` | rozszerzyć o procentowy limit i cel okresowy |
| Jedna sprawa na odchylenie | jest | `rvn_kpi_deviation_cases`, `trigger_measurement_id` | wymusić idempotencję per miernik/okres |
| Czy osiągnięto cel? | dodać jako projekcję | wynika z wyniku ewaluatora | nie utrwalać drugiej prawdy |
| Czy działania wymagane? | dodać jako projekcję | wynika z warning/critical i stanu sprawy | w normie brak skutków ubocznych |
| Opis problemu | brak jawnego pola | `root_cause_summary` nie jest opisem problemu | dodać addytywnie do sprawy |
| Główna przyczyna | jest | `root_cause_summary` + `root_cause_category` | zachować |
| Opis działań | jest | `rvn_kpi_corrective_actions.description` | zachować |
| Odpowiedzialność | jest | owner sprawy i działania | prezentować nazwisko |
| Data zakończenia | jest | `due_date` / `expected_recovery_date` | ujednolicić prezentację bez zmiany znaczenia |
| Komentarze | brak jako pole karty | istnieją notatki/uzasadnienia w kilku zdarzeniach | dodać jawne komentarze albo wykorzystać kanoniczny wątek komentarzy, po wyborze istniejącego mechanizmu |
| OTWARTY/ZAMKNIĘTY | jest | wielostanowy lifecycle sprawy; `closed` jest zamknięciem | mapować do prostego statusu arkusza w L2/L3 |
| Powiadomienie + Skrzynka | brak w atomowym zapisie pomiaru | istnieją obligations/attention, ale brak dowodu pełnego fan-out po zapisie rezultatu | część B: transakcja/outbox i dowód readback odbiorcy |

## OKR — raport, cel i rezultat

| Element SSOT | Stan | Istniejące pole / brak | Decyzja dla części A/B |
| --- | --- | --- | --- |
| Raport zakres × cykl | jest | `okr_vnext_sets.scope_type/id`, `cycle_id`, `title` | L1 tabela raportów |
| Opis i cel raportu | brak | zestaw nie ma `description` ani `goal` | dodać addytywnie do `okr_vnext_sets` i DTO |
| Temat | brak | brak pola na celu/KR | dodać addytywnie na celu; grupowanie L2 temat → cel |
| Cel, ambicja, właściciel | jest | objective `title`, `ambition_type`, `owner_user_id` | wystawić nazwisko |
| Rezultat | jest | `okr_vnext_key_results.title/description` | pozostaje sekcją karty celu, nie osobną stroną |
| Właściciel rezultatu | jest | `owner_user_id` | kolumna i filtr domyślny; nazwisko z joinu |
| Zespół | brak | brak `team_id/name` na KR | dodać addytywną relację/pole; nie wyprowadzać ze scope zestawu |
| START/CEL/BIEŻĄCA | jest | `start_value`, `target_value`, `current_value` | zachować wartości null jako „—” |
| Postęp | jest | `progress` + powód obliczenia | zachować |
| Pewność | jest | `confidence`, `confidence_numeric_value` | zachować, niezależnie od postępu |
| Termin per rezultat | brak | koniec cyklu nie jest terminem konkretnego KR | dodać addytywne `deadline` na KR |
| Ostatni check-in | jest | check-iny + `sets.last_checkin_at` | dla wiersza KR pobierać ostatni check-in |
| Stan | jest | status właściciela/systemu i status KR | zachować obie prawdy, opisać źródło |
| Check-in | jest | `okr_vnext_checkins` | część B musi uruchamiać analogiczną mechanikę odchylenia |
| Karta działania po odchyleniu OKR | brak | KPI ma sprawy, OKR ma support requests, ale brak kontraktu karty działania zgodnego z arkuszem | dodać addytywną relację OKR do wspólnego lub rozszerzonego przypadku odchylenia; nie udawać support request jako tej karty |

## ROI — analiza i trzy części karty

| Element SSOT | Stan | Istniejące pole / brak | Decyzja dla części C |
| --- | --- | --- | --- |
| Tożsamość, tytuł, właściciel, waluta, faza | jest | `rvn_roi_cases` | mapować fazę z lifecycle, nazwisko z joinu |
| Przedmiot, cel, problem, zakres | częściowo | tytuł + baseline notes nie tworzą pełnego kontraktu | dodać jawne nullable pola założeń przypadku |
| Horyzont | jest | `analysis_start/end`, `granularity` | prezentować 3Y/5Y itd. |
| Wariant bazowy BAU | jest częściowo | `rvn_roi_baselines.bau_*` | dodać nazwę/opis Option 0, jeśli brak w payloadzie |
| Warianty 0/1/2/3 | częściowo | `rvn_roi_scenarios` ma conservative/base/upside, nie warianty inwestycyjne | dodać osobny typ wariantu inwestycyjnego; nie mieszać ze scenariuszem ryzyka |
| CAPEX, contingency, ΔNWC, incremental OPEX | częściowo | `cost_lines.category` jest ogólne | dodać/ograniczyć kategorie semantyczne wymagane przez SSOT; contingency i ΔNWC nie mogą być zgadywane z etykiety |
| Korzyści kategoriami | jest częściowo | `benefit_lines.category`, `is_financial`, powiązanie KPI | rozszerzyć enum kategorii wg SSOT |
| Klasa Hard/Avoided/Soft/Strategic | brak | `is_financial` nie rozróżnia czterech klas | dodać addytywne pole klasy korzyści |
| Zakaz podwójnego liczenia | jest | `double_counting_group`, resolution note, flagi runu | zachować |
| Cash flow i podstawowe wyliczenia | jest | calculation runs/forecast: ROI, NPV, IRR, PP, DPP, BCR, series | zachować i przetestować przykładami metodyki |
| Annual Net Benefit | brak jawnego wyniku | możliwy do policzenia z serii, ale brak kontraktu | dodać do wyniku silnika/DTO |
| ARR, PI, Break-even, Margin of Safety | brak | brak pól wyniku | rozszerzyć silnik i DTO; nie podstawiać 0 |
| Wrażliwość ±20% | częściowo | assumption downside/upside i sensitivity rank, scenariusz overrides | dodać jawny wynik macierzy ±20% per driver |
| Conservative/Base/Upside | jest | `rvn_roi_scenarios` | zachować |
| Scoring wielokryterialny | brak | brak modelu i wyniku | dodać addytywny kontrakt wag i wyniku zgodny z metodyką |
| Rekomendacja GO/CONDITIONAL GO/NO-GO | brak dla decyzji inwestycyjnej | `PIR.recommendation` dotyczy przeglądu po inwestycji | dodać enum/pole rekomendacji na zatwierdzonym wyniku/decyzji |
| Expected vs Actual i wariancja | jest | forecast, actual snapshots, variances | złożyć w tabelę Realizacji |
| PIR 3/6/12 mies. | częściowo | PIR ma sekwencję i snapshot, ale brak jawnego kamienia 3/6/12 | dodać typ/termin przeglądu |
| Prawdziwość założeń per założenie | brak | PIR ma outcome/lessons, nie ocenę każdego założenia | dodać addytywną tabelę oceny: confirmed/partial/refuted + opis + dowód |
| ROI po realizacji | jest częściowo | actual snapshot ma actual ROI/NPV | wystawić pełny zestaw dostępnych actual metrics; brakujące „—” z powodem |

## Granica KROKU 0

Nie ma niejasności koncepcyjnej wymagającej STOP: SSOT rozstrzyga poziomy, treść i kolejność. Są braki implementacyjne opisane wyżej. Migracje muszą być addytywne i powstaną dopiero po akcepcie prototypu. Nazwy techniczne nowych tabel/kolumn pozostają propozycją wykonawczą, nie są decyzją produktową.

## Twierdzenia niezweryfikowane

- Nie wykonano zapytań do żywej bazy; raport mapuje migracje i DTO w drzewie `origin/staging`, nie stan wdrożonej produkcji.
- Nie potwierdzono jeszcze, który istniejący mechanizm komentarzy ma być kanoniczny dla karty działania.
- Nie potwierdzono jeszcze atomowej ścieżki powiadomienie + Skrzynka po zapisie wyniku; kod ma elementy obligations/attention, ale pełny wymagany przepływ będzie dowodem części B.
- Prototyp nie jest dowodem migracji, API, obliczeń ani działania end-to-end.

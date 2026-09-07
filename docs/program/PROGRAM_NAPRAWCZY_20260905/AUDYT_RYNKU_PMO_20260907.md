---
doc_id: audyt-rynku-pmo-20260907
truth_type: audyt-rynkowy
status: do-decyzji-wlasciciela
established: 2026-09-07
author: analityk rynku PPM/PMO (zlecenie „audyt rynku pod moduł Realizacja")
zakres: 4 funkcje zarządzania realizacją (Praca i poślizg · Zasoby i obłożenie · Decyzje/RAID/eskalacja · Raporty na poziomach)
metoda: dokumentacja producentów, strony pomocy, komunikaty o pozycjach w rankingach; wszystkie twierdzenia z URL
data_dostepu: 2026-09-07
---

# Audyt rynku PPM/PMO — jak liderzy realizują cztery funkcje zarządzania realizacją

**Do czego to służy.** Właściciel Consultify ma zdecydować, jak mają działać cztery
zakładki modułu Realizacja (Praca · Zasoby · Decyzje i ryzyka · Raporty). Ten dokument
pokazuje, co robi rynek, z odwołaniem do źródeł, i wskazuje, gdzie metodyka spisana
w `1_12_REALIZACJA_PLAN.md` (część A) zgadza się z rynkiem, a gdzie rynek robi **inaczej**.

**Uczciwość pomiaru — przeczytaj najpierw.** Każde twierdzenie w tym dokumencie pochodzi
z **otwartej strony producenta**, nie ze streszczenia wyników wyszukiwania — bo streszczenie
kilka razy podało twierdzenie, którego w źródle nie było. Tam, gdzie nie dotarłem do
dokumentacji, piszę wprost **„nie zmierzyłem"**, zamiast zgadywać (pełna lista w §6.19).

**Trzy tezy padły w trakcie tego audytu** — dwie moje własne i jedna z naszej metodyki.
Zostawiam je opisane w tekście zamiast poprawiać po cichu, bo każda brzmiała wiarygodnie
i każda była fałszywa (zestawienie: §6.20). Najważniejsza:

> **853 % obłożenia to nie jest nasz wyłączny błąd. Planview AdaptiveWork — Lider Gartnera —
> ma dokładnie to samo zachowanie opisane w dokumentacji jako projektowe:** „All work items
> already past the due date that still have remaining effort **will be reflected on Today**".

**Zasięg:** 18 produktów z dokumentacją producenta, 1 tylko z rankingu.

---

# 1. Tabela rankingowa

## 1.1 Kto jest liderem — pozycje potwierdzone źródłem

### Gartner MQ *Adaptive Project Management and Reporting* (APMR)

| Produkt | Klasa | Pozycja | Źródło | Dla kogo |
| --- | --- | --- | --- | --- |
| **Planview (AdaptiveWork)** | Enterprise PPM | **Lider MQ APMR 2026** (piąty rok z rzędu; edycja z sierpnia 2026, **11 producentów**) | [newsroom.planview.com](https://newsroom.planview.com/planview-recognized-by-gartner-as-a-leader-in-adaptive-project-management-and-reporting-2/) | Enterprise PMO |
| **Planisware (Orchestra)** | Enterprise PPM | **Lider MQ APMR 2026** (piąty rok) | [planisware.com](https://planisware.com/planisware-named-leader-2026-gartner%C2%AE-magic-quadrant%E2%84%A2-adaptive-project-management-reporting) | Portfele B+R, farmacja, przemysł |
| **Wrike** | Work management | **Wizjoner MQ APMR 2026 — jedyny** (czwarty rok) | [wrike.com](https://www.wrike.com/gartner-report-adaptive-project-management-and-reporting/) | Zespoły z roadmapą agentowej AI |
| **Prism PPM** | PPM | **Niszowy** MQ APMR 2026 | [globalprojectleader.co.uk](https://www.globalprojectleader.co.uk/2026/08/prism-ppm-named-niche-player-in-2026-gartner-magic-quadrant-for-adaptive-project-management) | nie zmierzyłem |
| **Triskell** | PPM | Pierwszy raz w MQ APMR 2026; **kwadrantu nie podano** w komunikacie | [prnewswire.com](https://www.prnewswire.com/news-releases/triskell-software-positioned-for-the-first-time-in-the-2026-gartner-magic-quadrant-for-adaptive-project-management-and-reporting-302867687.html) | nie zmierzyłem |
| **monday.com** | Work management | **Lider MQ APMR 2025** (czwarty rok; najdalej na „Completeness of Vision", najwyżej na „Ability to Execute"). **Pozycji w edycji 2026 nie potwierdziłem** | [ir.monday.com](https://ir.monday.com/news-and-events/news-releases/news-details/2025/monday-com-Named-a-Leader-in-the-2025-Gartner-Magic-Quadrant-for-Adaptive-Project-Management-and-Reporting-for-the-Fourth-Consecutive-Year/default.aspx) | Zespoły biznesowe, PMO „lekkie" |
| **Planview Sciforma** | PPM | **Wizjoner MQ APMR 2025** | [newsroom.planview.com](https://newsroom.planview.com/planview-recognized-by-gartner-as-a-leader-in-adaptive-project-management-and-reporting/) | Średnie PMO |

### Gartner MQ *Strategic Portfolio Management* (SPM)

| Produkt | Pozycja | Źródło | Dla kogo |
| --- | --- | --- | --- |
| **Planview** | **Lider MQ SPM 2026** (czerwiec 2026, **9 producentów**), „highest and furthest… in both Completeness of Vision and Ability to Execute", piąty rok | [newsroom.planview.com](https://newsroom.planview.com/planview-again-named-by-gartner-as-a-leader-in-strategic-portfolio-management-2/) | Enterprise PMO, strategia + finanse |
| **Broadcom Clarity** | **Lider MQ SPM 2025**, drugi rok z rzędu | [valueops.broadcom.com](https://valueops.broadcom.com/blog/broadcom-named-a-leader-in-the-2025-gartner-magic-quadrant-for-spm) | Enterprise, mostek finanse↔operacje |

### Forrester Wave

| Produkt | Pozycja | Źródło |
| --- | --- | --- |
| **Planview** | **Lider** Forrester Wave™ *SPM Tools* **Q2 2026** (czerwiec 2026, **13 producentów, 22 kryteria**) | [planview.com — analyst recognition](https://www.planview.com/analyst-recognition/) |
| **Bizzdesign** | **Lider** Wave SPM Q2 2026 (wyróżniki: strategia, modelowanie, planowanie zdolności) | [bizzdesign.com](https://bizzdesign.com/analyst-report/spm-tool-forrester-wave-q2-2026) |
| **ServiceNow** | **Lider** Wave SPM Q2 2026 (najwyższy wynik w kategorii Strategy) oraz Q2 2024 | [servicenow.com](https://www.servicenow.com/lpayr/forrester-wave-spm.html) |
| **Atlassian** (Strategy Collection: Focus + Jira Align) | **Strong Performer** Wave SPM Q2 2026 (Current Offering 3,10 / Strategy 3,80) | [atlassian.com](https://www.atlassian.com/blog/company-news/forrester-strategic-portfolio-management-2026) |
| **IBM Apptio / Targetprocess** | Oceniany w Wave SPM Q2 2026 (5/5 m.in. w bezpieczeństwie i ekosystemie partnerów) | [apptio.com](https://www.apptio.com/resources/analyst-reports/the-forrester-wave-strategic-portfolio-management-tools/) |
| **Asana**, **Adobe Workfront** | **Liderzy** Forrester Wave™ *Collaborative Work Management Tools* **Q2 2025** (to inny rynek — nie mylić z SPM) | [investors.asana.com](https://investors.asana.com/news-releases/news-release-details/asana-named-leader-collaborative-work-management-tools-q2-2025) · [business.adobe.com](https://business.adobe.com/resources/reports/forrester-wave-collaborative-work-management-tools-2025.html) |

**Uwaga:** Forrester Wave dla „Adaptive Project Management" **nie istnieje** — najbliższy jest
Wave *Collaborative Work Management Tools*. Mylenie tych dwóch rynków jest częstym błędem.

### G2 i Capterra

- **G2 PPM, zima 2026** (dziesiątka najwyżej ocenionych, redakcja G2, **bez** podziału na
  Liderów): Smartsheet, monday, ClickUp, Hive, Quickbase, Octave Sequence Enterprise (EcoSys),
  Bordio, Oracle Primavera, Celoxis, ServiceNow SPM —
  [learn.g2.com](https://learn.g2.com/best-project-and-portfolio-management-software).
  Same siatki G2 zwracają 403 — kwadrantów nie zmierzyłem.
- **Kantata** — Lider siatek G2 wiosna 2025 dla *Professional Services Automation* i *Resource
  Management*, #1 w EMEA/Europie/UK
  ([businesswire.com](https://www.businesswire.com/news/home/20250430822577/en/)).
- **Capterra Shortlist PPM 2025** (23 produkty): Jira 96/100, Asana 95, ClickUp 92, Miro 92,
  Smartsheet 92, monday 91 — [capterra.com](https://www.capterra.com/project-portfolio-management-software/shortlist/).
- **Capterra Shortlist Resource Management 2026**: Asana 98, monday 92, Smartsheet 92, Wrike 88,
  Hive 82, Adobe Workfront 80, BigTime 79, Teamwork 78, Float 77, Kantata 74, Celoxis 72,
  Forecast 70 — [capterra.com](https://www.capterra.com/resource-management-software/shortlist/).

**Czego NIE potwierdziłem:** pełnych list kwadrantów MQ APMR 2026 i MQ SPM 2026 (raporty za
formularzem); pozycji ServiceNow w MQ SPM; pozycji monday.com, Smartsheet i Asany w edycji
APMR 2026.

## 1.2 Klasy produktów w tym audycie i po co je porównuję

| Klasa | Produkty | Co ta klasa rozwiązuje najlepiej | Czego w niej brakuje dla Consultify |
| --- | --- | --- | --- |
| **Enterprise PPM / SPM** | Planview, Planisware, Broadcom Clarity, ServiceNow SPM | Baseline, wariancja, popyt vs podaż na rolach, bramki | Ciężar wdrożenia; nie ma języka konsultanta („inicjatywa", „efekt") |
| **Agile @ scale** | Jira Align, Jira Plans (Advanced Roadmaps) | Zależności, przewidywalność, program board | Brak rejestru decyzji z terminem; zasoby = pojemność zespołu, nie osoby |
| **Work management** | monday.com, Smartsheet, Asana, Wrike, ClickUp | Tabela + edycja w wierszu, kolorowy status | Brak baseline'u w większości; obłożenie liczone naiwnie |
| **Professional services / resource** | Kantata, Runn, Float, Forecast, Teamwork, Productive, Resource Guru, Hub Planner, Smartsheet RM | **Model zasobów** — alokacja na dni/tygodnie, placeholdery, rezerwacje wstępne, wzór na obłożenie | Brak rejestru decyzji i RAID; brak raportów SteerCo |
| **Klasyka** | MS Project / Planner Premium, Celoxis, Meisterplan | Baseline i wariancja jako wzorzec branżowy; mapa cieplna | Brak warstwy „inicjatywa transformacyjna" |
| **Transformacja / TMO (klasa najbliższa Consultify)** | **Shibumi**, **Nordantech Falcon** | Inicjatywa → bramki → efekt; raport do PowerPointa jednym kliknięciem; podwójny pstryczek świateł | Brak zarządzania osobami/godzinami |

**Ważne dla właściciela.** Najbliżej tego, co opisał („zarządzać realizacją inicjatyw tak
jak firmy konsultingowe"), **nie leżą** Planview ani Asana, tylko dwie firmy z ostatniego
wiersza: **Shibumi** (używany przez biura transformacji do prowadzenia inicjatyw przez
bramki i do liczenia zrealizowanej wartości — [shibumi.com/product](https://shibumi.com/product/),
[shibumi.com/critical-capabilities](https://shibumi.com/critical-capabilities/)) oraz
**Nordantech Falcon** (drzewo Program → Projekt → Pakiet działań → **Działanie**, podwójne
światło „efekty | działania", raport PowerPoint jednym kliknięciem —
[support.nordantech.com](https://support.nordantech.com/en/articles/4219372-falcon-explained),
[nordantech.com](https://www.nordantech.com/en)). To są właściwi konkurenci referencyjni.

## 1.3 Zasięg pomiaru — co naprawdę sprawdziłem (czytaj przed tabelami)

Nie każdy produkt udało się zmierzyć równie głęboko. Poniżej jawnie, żeby nikt nie wziął
luki za fakt.

| Produkt | Mechanika z **dokumentacji producenta** | Tylko źródło **wtórne** | Tylko **pozycja w rankingu** |
| --- | --- | --- | --- |
| **Microsoft Project** (desktop / Online) | **tak — wzorzec słownika** (pola bazowe, wariancje, jednostki zasobu, status date, wyrównywanie, ryzyka, raporty) | — | — |
| **Broadcom Clarity** | **tak — najgłębiej po stronie zasobów** (alokacje vs przypisania, baseline, RIC, raport statusu) | — | — |
| **Celoxis** | tak (6 baseline'ów, kolumny wariancji, reguły RAG liczone, raporty wysyłane mailem) | — | — |
| **Meisterplan** | tak (FTE, role, mapa cieplna z progami, linia odcięcia, Plan of Record) | — | — |
| **Smartsheet** (+ Smartsheet RM) | tak (baseline i Variance w dniach, trzy typy alokacji, utylizacja historyczna vs prognozowana) | — | — |
| **Wrike** | tak (baseline due variance, trzy tryby efortu, rezerwacje vs efort zadań, Project Health) | — | — |
| **monday.com** | tak (baseline z auto-formułą dni, widget obłożenia, resource planner Enterprise) | — | tak |
| **Asana** | tak (baseline wizualny, rozkład efortu, aktualizacje statusu zamrożone, eksport PPT) | — | — |
| **ClickUp** | tak (baseline bez liczby, miary obłożenia, pojemność per dzień tygodnia) | — | — |
| **Float** | tak (wzór obłożenia, dni i godziny robocze) | — | — |
| **Runn** | tak (pojemność, workload pewny vs wstępny, wzory) | — | — |
| **Nordantech Falcon** | tak (drzewo działań, podwójne światło, raport PPT) | — | — |
| **Shibumi** | tak (hierarchia, bramki, ryzyka, ślad audytu) | — | — |
| **Forecast** | tak (7 wartości minutowych, trzy tryby zarządzania zasobami, progi 92/107 %) | — | — |
| **Teamwork.com** | tak (dwa silniki obłożenia, wzory utylizacji, natywny rejestr ryzyk) | — | — |
| **ServiceNow SPM** | tak (baseline variance, plany zasobów, **RIDAC**, raport statusu) | — | tak |
| **Jira Align** | tak (pojemność zespołu, ROAM, eskalacje, Program Board) | — | tak |
| **Jira Plans (Advanced Roadmaps)** | tak (ostrzeżenia zamiast wariancji, pojemność zespół × iteracja) | — | tak |
| **Planview AdaptiveWork** | tak (Scheduling Status, ładowanie zasobów, Cases, Decyzje ze spotkań) | — | tak |
| **Planview Portfolios** | częściowo — **duża część pomocy jest za logowaniem**; opieram się na stronach dostępnych, glosariuszu, raportach FastTrack i **wątkach forum producenta** (oznaczam je jako źródło słabsze) | — | tak |
| Productive, Resource Guru, Hub Planner | — | tak (jedno porównanie branżowe) | — |
| **Planisware** | **nie** (mechanika) | — | tak |

**Zasięg:** **18 produktów z dokumentacją producenta**, 1 tylko z rankingu (Planisware).
Wzorce w §3 opieram wyłącznie na pierwszej grupie.

**Zastrzeżenie do Planview Portfolios:** znaczna część artykułów pomocy zwraca „Sign in to
access this product help article". Część twierdzeń o tym produkcie pochodzi z **wątków forum
producenta**, a nie z dokumentacji — zaznaczam to przy każdym takim twierdzeniu. Forum jest
źródłem słabszym, ale w kilku miejscach jedynym istniejącym.

**Trzy założenia z mojego własnego zlecenia, które pomiar obalił** — zapisuję, bo to jest
dokładnie ten typ błędu, który kosztuje tygodnie:

1. Wrike **nie ma** trybów efortu „automatic / flexible / manual / full-time". Ma **Basic /
   Daily / Flexible**; „full-time equivalent" to jednostka wyświetlania wykresu, nie tryb
   rozkładu ([help.wrike.com — Types of Task Effort](https://help.wrike.com/hc/en-us/articles/1500005128261-Types-of-Task-Effort)).
2. Wrike **nie ma** statusów projektu zielony/żółty/czerwony. Ma statusy `New, In Progress,
   Completed, On Hold, Cancelled` (ręczne) **i osobno** liczony Project Health
   ([help.wrike.com — Project Status](https://help.wrike.com/hc/en-us/articles/1500005217622-Project-Status) ·
   [Project Health](https://help.wrike.com/hc/en-us/articles/1500005217682-Project-Health)).
3. Asana **ma** baseline, ale wyłącznie wizualny, bez liczby dni. Za to **monday.com** przy
   ustawieniu baseline'u **sam tworzy kolumnę formuły liczącą różnicę w dniach** — czego się
   nie spodziewałem ([support.monday.com — The Gantt Baseline](https://support.monday.com/hc/en-us/articles/360020978159-The-Gantt-Baseline)).

---

# 2. Cztery tabele porównawcze

## 2.1 Pytanie 1 — Praca i poślizg

| Produkt | Jak to robi | Źródło | Co warto skopiować | Czego unikać |
| --- | --- | --- | --- | --- |
| **Broadcom Clarity** | Siatka **Tasks** jest przekrojowa przez wszystkie inwestycje. Kolumny własne zadania to „Name, % Complete, ETC", do tego atrybuty wspólne inwestycji („Corporate Priority and Manager") i atrybuty konkretnych projektów. Edycja **w siatce** — „Edit Data in the grid by using the right-click option" albo w dwukolumnowym panelu Szczegółów. Kamienie na osi czasu: „If the diamond associated with a milestone is filled, it means the milestone status is complete". | [techdocs.broadcom.com — Track Tasks Across Investments](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-track-tasks-and-to-do-items.html) | **Jedna siatka zadań ponad wszystkimi inicjatywami** + kolumny z inicjatywy dołożone do zadania; edycja w wierszu i w panelu, nie na osobnym ekranie. | Kolumna „% Complete" jako miara zdrowia — to deklaracja, nie pomiar; sama nie pokazuje poślizgu. |
| **Broadcom Clarity — baseline** | „Project baselines are **snapshots** of the total actual and planned effort and total actual and planned cost estimates for a project at the moment of capture. **Baselines are static**." Wiele wersji; „By default, the baseline you create last becomes the current project baseline". Zapisuje daty start/koniec, `Usage = Total of Actuals + ETC` oraz BCWP. | [techdocs — Create and Manage Project Baselines](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/Create-and-Manage-Project-Baselines.html) | **Baseline = statyczna migawka z wersjami**, ostatnia jest „bieżąca". Dokładnie to, czego wymaga „zarządzanie przesunięciami". | Nie robić baseline'u „w locie" przy każdej zmianie daty — wtedy wariancja zawsze wynosi 0 i poślizg znika. |
| **Nordantech Falcon** | Drzewo Program → Projekt → Pakiet działań → **Działanie** („In Falcon, it is primarily at the deepest level — the measure — that people 'work'"), wyżej tylko agregacja. Ocena postępu **w dwóch wymiarach**: harmonogram (plan vs faktyczne daty start/koniec) i efekty. „The delta or a deviation between the entered plan value… and the actual value is calculated and displayed." | [support.nordantech.com](https://support.nordantech.com/en/articles/4219372-falcon-explained) | **Praca dzieje się na najniższym poziomie, wyżej wyłącznie agregacja** — czysty model dla „inicjatywa → działanie → zadanie". | Nie mieszać poziomów wprowadzania danych: gdy postęp da się wpisać i na projekcie, i na działaniu, agregat kłamie. |
| **Shibumi** | Nieograniczona hierarchia z relacjami „Parent > Child"; „dependencies can be defined between work items at any level". Postęp mierzony przez porównanie metryki faktycznej do celu w okresach „monthly, quarterly, or custom cadences". | [shibumi.com/critical-capabilities](https://shibumi.com/critical-capabilities/) · [shibumi.com/blog — stage gates](https://shibumi.com/blog/managing-stage-gates-for-your-strategic-program-shibumi-can-do-that/) | **Zależności na dowolnym poziomie** oraz porównanie „faktyczne vs cel w okresie" zamiast jednego „% postępu". | Nieograniczona hierarchia bez dyscypliny = las poziomów, w którym nikt nie wie, gdzie raportować. |
| **Microsoft Project — słownik branżowy** | Wariancja jest **arytmetyką, nie oceną**: „**Start Variance = Start - Baseline Start**", „**Finish Variance = Finish - Baseline Finish**", „**Work Variance = Work - Baseline Work**". Pole `Baseline Start` „contains 'NA' until you set a baseline"; `Baseline Work` „contains 0 hours until you set a baseline". Do **11 linii bazowych** (Baseline + Baseline1–10). Tracking Gantt: „the lower bar shows baseline start and finish dates, and the upper bar shows scheduled start and finish dates". Raport **Slipping Tasks** = zadania kończące się po dacie bazowej; **Late Tasks** = przekraczające zaplanowane daty. Edycja w arkuszu: „Enter, edit, and review task information in a spreadsheet format". Kamień to atrybut zadania: `Task.Milestone` — „True if the task is a milestone. Read/write." | [support.microsoft.com — Start Variance](https://support.microsoft.com/en-us/office/start-variance-fields-0d8ac113-d0d6-4577-892b-893acb66a028) · [Finish Variance](https://support.microsoft.com/en-us/office/finish-variance-fields-2b630199-4211-4b5a-b5f2-d1efc24ec4e7) · [Work Variance](https://support.microsoft.com/en-us/office/work-variance-fields-1bb45242-e32e-4c7f-a694-81bc2a9e9a74) · [Baseline Start](https://support.microsoft.com/en-us/office/baseline-start-fields-5661a129-3d08-4567-860b-24ba304f526f) · [Review progress](https://support.microsoft.com/en-us/office/review-the-progress-of-your-schedule-0d24c633-f572-44b9-8fdb-56e1f5095237) · [Pick the right report](https://support.microsoft.com/en-us/office/pick-the-right-report-in-project-61324235-aaec-4eef-acab-4c5245fedaeb) | **Odchylenie to odejmowanie dwóch dat, nie opinia.** Nazwa kolumny mówi wzór. „Kamień milowy" to pstryczek na zadaniu, nie osobny byt. | Jedenaście linii bazowych — nikt tego nie użyje. Dla nas jedna bieżąca + historia wersji wystarczy. |
| **Celoxis — druga szkoła: projekcja zamiast różnicy** | Sześć baseline'ów zapisujących Planned Start/Finish/Effort/Cost/Budget; kolumny **Baseline Start/Finish/Effort Variance**. Ale zdrowie liczy się z **prognozy**, nie z różnicy: **S.Health** (harmonogram) — czerwony „The planned finish date is in the past", bursztyn „The projected finish date is after the planned finish date", zielony „on or before". **B.Health** analogicznie dla kosztu. „Celoxis calculates projections **once a day** on a best effort basis" + ręczny Reforecast. Trzy tryby % ukończenia, w tym automat `% Done = Actual Effort ÷ Planned Effort`. Edycja: raport tabelaryczny „supports direct **inline editing** and bulk operations on line items". | [celoxis.com — RAG indicators](https://www.celoxis.com/kb/15.0/projects/concepts/rag-indicators) · [project baseline](https://www.celoxis.com/kb/latest/projects/how-to/project-baseline) · [atrybuty zadań](https://www.celoxis.com/kb/latest/tasks/concepts/attributes) · [postęp](https://www.celoxis.com/kb/latest/tasks/concepts/progress) · [wyjście raportu](https://www.celoxis.com/kb/15.1/reports/concepts/output) | **Rozróżnienie „termin już minął" (czerwony) od „prognoza mówi, że nie zdążymy" (bursztyn)** — to jest dokładnie różnica, której potrzebuje SteerCo. | Furtka w konfiguracji: „Always assume this project is on time and budget". Jedno pole, które kasuje cały nadzór. Nie budować takiej opcji. |
| **Smartsheet** | Kolumny systemowe `Baseline Start`, `Baseline Finish` i **`Variance`** = „The difference between the actual end date and the baseline end date", liczona „in decimal days according to the working schedule defined for your project", pokazuje „days behind, days ahead, or on schedule". | [help.smartsheet.com — Baselines](https://help.smartsheet.com/articles/2482093-baselines) | **Wariancja w dniach roboczych wg kalendarza projektu**, nie w dniach kalendarzowych. | **„You can only add one baseline to a project sheet"** — brak re-baseline'u i historii. Do tego paski baseline „don't show in either reports or dashboard widget reports". Poślizg portfelowy trzeba budować z liczby, nie z obrazka. |
| **Wrike** | Baseline Tracking zapisuje 4 pola, w tym **`baseline due variance`** = „the difference between the current due date and the baseline due date". Na Gantcie baseline to „a dark line on task bars", a po przesunięciu „a dotted line" pokazuje pierwotne położenie. Zaległość: „**Overdue task warnings** to have all overdue tasks color-coded red". Domyślne kolumny tabeli to sześć: „Name, Start date, Due date, Duration, Status, and Assignee". Edycja: „**Double-click any field to edit its data**". | [help.wrike.com — Baseline Tracking](https://help.wrike.com/hc/en-us/articles/36424453240594-Baseline-Tracking) · [Gantt Chart](https://help.wrike.com/hc/en-us/articles/210323585-Gantt-Chart-in-Wrike) · [kolumny](https://help.wrike.com/hc/en-us/articles/1500005224982-Rearranging-Columns-in-Table-View) · [edycja](https://help.wrike.com/hc/en-us/articles/1500005126681-Editing-Data-From-Table-View) | **Sześć kolumn domyślnych** — dowód, że kanoniczna tabela pracy jest wąska: nazwa, start, termin, czas trwania, status, osoba. | Zależności **nie zmieniają statusu**: „Dependencies do not affect task statuses" — nikt nie jest oznaczony jako zablokowany ([źródło](https://help.wrike.com/hc/en-us/articles/209604229-Task-Dependencies-on-the-Gantt-Chart)). |
| **monday.com** | Baseline: „items are turned into a **gray snapshot** that remains **locked in position** no matter what happens to the timeline… afterwards"; „When a project is on track, items are shown in **green**… when a project is delayed… items turn **red**". I mechanika, której nie ma nikt inny: **„The Formula Column is automatically created to calculate the difference in days between the dates in these two columns!"** Bez baseline'u spóźnienie wymaga **Deadline Mode** (spięcie kolumny daty ze statusem). | [support.monday.com — Gantt Baseline](https://support.monday.com/hc/en-us/articles/360020978159-The-Gantt-Baseline) · [Deadline Mode](https://support.monday.com/hc/en-us/articles/360002646059-Deadline-Mode) | **Poślizg jako policzalna kolumna powstająca automatycznie razem z baseline'em** — użytkownik nie musi wiedzieć, że to formuła. | Baseline po cichu dokłada dwie kolumny do tablicy użytkownika; skasowanie którejkolwiek niszczy baseline. Efekt uboczny na cudzych danych to zły wzorzec. |
| **ClickUp** | „Baselines capture the start and end dates of the tasks… **at a point in time**"; „Add a baseline at any time… to show how tasks have accelerated or been delayed". Baseline na liście, folderze i przestrzeni („detailed baselines for each project and high-level baselines for your portfolio"). **Ale liczby wariancji nie ma** — tylko nakładka wizualna. | [help.clickup.com — baselines on Gantt](https://help.clickup.com/hc/en-us/articles/34358881283863-Use-baselines-on-Gantt-view) | Baseline na trzech poziomach naraz (zadanie / projekt / portfel). | Nakładka bez liczby: nie da się posortować „kto ma największy poślizg". Nie kopiować. |
| **Asana** | Baseline istnieje, ale: „Baseline captures a snapshot of the project… at a point in time. It can be used for a **visual comparison**"; „The rectangles with the **diagonal hash pattern** show the original plan… compare against the current project shown via solid rectangles". Twarde ograniczenie: **„Each project can only have 1 baseline. Creating additional snapshots override the current snapshot."** Zadanie wymaga dat: „You can't have a duration without a date"; „Durations can currently only be set in days". Jedyna z czwórki work-management z jawnymi polami **`Blocked by` / `Blocking`**. | [help.asana.com — Gantt view](https://help.asana.com/s/article/gantt-view) · [Gantt FAQ](https://help.asana.com/s/article/gantt-view-faq) · [task dependencies](https://help.asana.com/s/article/task-dependencies) | **`Blocked by` / `Blocking` jako osobne kolumny listy** — blokada jest widoczna w tabeli, nie ukryta w szczegółach. | Jeden baseline, nadpisywany bez ostrzeżenia, i **zero liczby wariancji**. Najpopularniejszy produkt w tej klasie nie umie odpowiedzieć „o ile dni". |
| **ServiceNow SPM** | Kolumny konsoli planowania (tabela `pm_project_task`): Name, State, Status, Short description, Predecessor, Constraint type/date, **Baseline start/end**, **Baseline variance**, Dependency, % complete, Planned start/end, WBS. Poślizg = **Baseline variance** (baseline end − planned end); wartość ujemna, np. „-5 days", oznacza opóźnienie; baseline rysowany **szarą linią pod paskiem Gantta**. Można trzymać **wiele baseline'ów i je porównywać**. Kolumna `Status` (zielony/żółty/czerwony) liczona z bliskości planowanej daty końca i **ręcznie nadpisywalna**. Edycja: **w siatce, podwójnym klikiem**. | [Planning Console Tasks](https://www.servicenow.com/docs/bundle/washingtondc-it-business-management/page/product/project-management/reference/r_PlanningConsoleTasks.html) · [Compare schedule baselines](https://www.servicenow.com/docs/bundle/zurich-it-business-management/page/product/project-management/task/compare-schedule-baselines-prj.html) · [Create a project baseline](https://www.servicenow.com/docs/bundle/washingtondc-it-business-management/page/product/project-management/task/t_CreateAProjectBaseline.html) | **Jedna kolumna „Baseline variance" wprost w tabeli zadań** — nie w osobnym raporcie, nie na wykresie. Plus **status liczony, ale nadpisywalny** — dokładnie model, który rekomenduję. | Typ kalkulacji projektu (automatic/manual) ustawiany **raz i tylko do odczytu** — projekt z zadaniami nie da się przełączyć. Nie budować nieodwracalnych przełączników. |
| **Jira Align** | **Brak klasycznej wariancji w dniach.** Zamiast tego trzy daty (Portfolio Ask / Start / Target Completion), pole `Days remaining` oraz **progi alertów postępu** („% zrobione po X % czasu → late/warning"). Program Board deklaruje wprost: „**No additional calculations**… All status pulled from work item fields". Miara przewidywalności: „Predictability = (delivered value critical path + stretch) / planned value critical path × 100" — **może przekroczyć 100 %**. Edycja: **panel boczny**, nie w wierszu — „Inline editing… is **under consideration**". Siatki ograniczone do **8 kolumn na stronę** (12 dla features). | [Configure progress bars](https://help.jiraalign.com/hc/en-us/articles/360016458173-Configure-progress-bars) · [Program board](https://help.jiraalign.com/hc/en-us/articles/115005049268-Program-board) · [Program predictability](https://help.jiraalign.com/hc/en-us/articles/115004689448-Program-predictability) · [Column selection](https://help.jiraalign.com/hc/en-us/articles/360015260653-Column-selection) | **Próg postępu zamiast daty**: „po 50 % czasu zrobione <30 % → ostrzeżenie". Działa tam, gdzie nie ma baseline'u. | Miara, która „może przekroczyć 100 %" — sponsor zobaczy 118 % przewidywalności i przestanie wierzyć w cały raport. |
| **Jira Plans (Advanced Roadmaps)** | **Brak baseline'u i wariancji w ogóle.** Poślizg zastąpiony **ostrzeżeniami**: „Open work item has passed its inferred/assigned end date", „Work item starts or ends after its due date", „Child starts before parent". Symbole: żółty trójkąt = ostrzeżenie, paski w paski = daty rolowane z dzieci, czerwony release = po terminie. Edycja w **piaskownicy**: zmiany są robocze aż do „Save changes". | [Troubleshoot warnings](https://support.atlassian.com/jira-software-cloud/docs/troubleshoot-warnings-on-your-timeline-in-advanced-roadmaps/) · [Symbols](https://support.atlassian.com/jira-software-cloud/docs/what-do-the-symbols-in-advanced-roadmaps-mean/) · [Review and save changes](https://support.atlassian.com/jira-software-cloud/docs/review-and-save-changes-in-advanced-roadmaps/) | **Piaskownica**: przesuwasz terminy, widzisz skutki, dopiero potem zapisujesz. Dla scenariuszy przesunięć to lepsze niż zapis przy każdym kliknięciu. | Ostrzeżenie zamiast liczby — nie da się posortować portfela po wielkości poślizgu. |
| **★ Planview AdaptiveWork — najlepsza zmierzona reguła RAG** | **Scheduling Status** liczony automatycznie: **On Track** = faktyczne % ukończenia jest mniej niż 10 punktów poniżej oczekiwanego (albo wyżej); **At Risk** = ≥10 punktów poniżej oczekiwanego; **Off Track** = **termin minął, a ukończenie < 100 %**. Osobno „Board Highlights" z twardymi progami <60 zielony / 60–90 bursztyn / ≥90 czerwony. Pola wariancji: `StartDateVariance`, `DueDateVariance`, `DurationVariance`, `CostVariance`. Edycja: **w wierszu siatki + prawy panel szczegółów**. | [Work Item Module](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Work_Item_Module) · [Highlights](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Hybrid_Work/Highlights/00_Highlights_for_projects_%E2%80%93_overview) · [Standard reports](https://success.planview.com/Planview_AdaptiveWork/Reporting/Reports%2C_Functions%2C_and_Relation_Tables/AdaptiveWork_Reports) | **Porównuje faktyczne % ukończenia z OCZEKIWANYM NA DZIŚ, a nie datę z datą.** Działa nawet bez baseline'u — a to jest nasza sytuacja na starcie. Do skopiowania wprost. | **Baseline nadpisywany przy każdym zapisie** (historia tylko przez dodatkową aplikację) oraz **wariancja liczona odwrotnym znakiem niż w MS Project** — gwarantowana pomyłka przy integracji lub migracji. |
| **Planview Portfolios** | Poślizg przez raporty, nie przez kolumnę w tabeli. Raport wariancji ma **niekonfigurowalne pasma** 0 / 0–5 / 5–10 / 10–25 / >25 %; ≥0 % zielony, <−10 % czerwony. Kamień jest „**Late** if the date is later than the current active baseline date… **There is no tolerance setting**". Daty planowane „driven by either **Time Now** or the Requested Start date, **whichever is later**". | [WRK05 — Schedule and Effort Variance](https://success.planview.com/Planview_Portfolios/Analytics_and_Reporting/FastTrack_Analytics/Work_and_Project_Analytics/WRK05_-_Schedule_and_Effort_Variance) · [Glosariusz](https://success.planview.com/Planview_Portfolios/Planview_Portfolios_Glossary) | Kamień spóźniony **wobec aktywnego baseline'u, bez tolerancji** — reguła prosta i nie do podważenia. | **Projekt bez baseline'u ląduje w paśmie „0 %", czyli świeci na zielono.** To jest fałszywa zieleń wpisana w raport — dokładnie błąd, przed którym chroni zasada „brak baseline'u = puste pole, nigdy zero". Dodatkowo brak natywnych CPI/SPI. |
| **Broadcom Clarity — poślizg przez wartość wypracowaną** | Clarity nie ma kolumny „dni spóźnienia" — liczy **SPI = BCWP/BCWS**, **SV = BCWP − BCWS**, CPI, CV, EAC, VAC. Warunek twardy: „**The project must have a baseline** for the following to display or calculate: … CPI, SPI, CV, SV". Trzy metody % ukończenia: ręczna, z czasu trwania, z pracochłonności. | [Project Earned Value](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-4-2/advanced-reporting-with-jaspersoft/pmo-accelerator-advanced-reporting-content/project-management-reports/project-earned-value.html) · [% Complete calculation methods](https://knowledge.broadcom.com/external/article/125361/complete-calculation-methods-behavior.html) | **Bez baseline'u wskaźniki się NIE POKAZUJĄ** — producent woli puste pole niż fałszywą liczbę. To jest właściwa postawa. | Wartość wypracowana jako jedyna miara poślizgu — dla komitetu sterującego w firmie doradczej „SPI = 0,87" nic nie znaczy. Potrzebne są dni. |
| **Planisware** | **Nie zmierzyłem.** | — | — | — |

**Wniosek dla Consultify (pytanie 1).** Rynek zna **dwie różne obietnice**, i trzeba wybrać
świadomie:

- **Różnica wobec zamrożonego planu** (MS Project, Clarity, Smartsheet, Wrike, monday) —
  retrospektywna, arytmetyczna, nie do podważenia: `odchylenie = data aktualna − data bazowa`.
- **Prognoza** (Celoxis) — „projected finish" liczony z tempa postępu raz dziennie; bursztyn
  znaczy „jeszcze nie minęło, ale nie zdążymy".

Metodyka z 1_12 (A1 pkt 6, A2 wiersz „Baseline + wariancja") wybiera pierwszą szkołę i to
**zgadza się z większością rynku**. Rekomendacja: pierwsza szkoła w MVP, druga (prognoza)
jako Fala 2 — bo prognoza wymaga wiarygodnego tempa postępu, którego dziś nie mamy.

Drugi wniosek, mniej oczywisty: **wąska tabela wygrywa**. Wrike, najbardziej „PMO-wy" z klasy
work management, ma domyślnie **sześć** kolumn (nazwa · start · termin · czas trwania · status ·
osoba). Plan C2 dla zakładki „Praca" przewiduje sześć (Zadanie · Inicjatywa · Osoba · Termin ·
Status · Poślizg) — to jest właściwa szerokość.

## 2.2 Pytanie 2 — Zasoby i obłożenie (najlepiej udokumentowana część audytu)

| Produkt | Jak to robi | Źródło | Co warto skopiować | Czego unikać |
| --- | --- | --- | --- | --- |
| **Broadcom Clarity — cztery pojęcia** | Rozdziela cztery rzeczy: **Availability** — „The amount of time a resource is available for work"; **Allocation** — „The percentage of time a resource is assigned to an investment"; **Assignments** — „The various tasks a resource is assigned to within an investment"; **Actuals** — „The hours entered by a resource in a timesheet against a specific task". Rezerwacja **miękka i twarda**: soft = „tentatively scheduled", hard = „committed"; domyślnie soft. | [techdocs — Staff a Project](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/project-staffing.html) | **Te cztery pojęcia to gotowy słownik dla zakładki Zasoby.** Popyt planowany (Allocation) to **inna liczba** niż suma zadań (Assignments) i niż godziny z kart pracy (Actuals). | Liczenie obłożenia z przypisań zadań i nazywanie go alokacją — to jest źródło absurdalnych procentów. |
| **Broadcom Clarity — dwa modele obok siebie** | Alokacje: oś czasu z paskami Gantta, jednostki **FTE, godziny, dni oraz „% Availability"**, okresy „Weeks, Months, Quarters, Years". Histogram zasobu pokazuje „the total availability and total allocation for each resource". Przeciążenie: „A **red** color cell with increased height depicts **over-allocation**", „A **green** color cell with regular height depicts under allocation or appropriate allocation", „The **red dot** indicates that the resource is overallocated". Edycja: „double-click a single Allocation or Hard Allocation value to edit it", zbiorczo przez prawy klik, oraz **przeciągnięcie** z histogramu na oś inwestycji. | [techdocs — Allocations Timeline](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/Analyze-Resource-Allocation-and-Staffing-home/Analyze-Allocations-by-Using-Allocations-Timeline.html) | **Podaż i popyt na jednym histogramie**, kolor + wysokość słupka, edycja podwójnym klikiem, rozwiązanie konfliktu przeciągnięciem. | Nie dawać czterech jednostek naraz (FTE/h/dni/%) w MVP — jedna jednostka, reszta w Fali 2. |
| **Broadcom Clarity — przypisania** | Osobny widok: „Many organizations manage staffing through **Task Assignment Estimates rather than using Allocations**". Metryki do wyboru: „Select **Actuals, ETC, or Usage**". Ostrzeżenie: „The red dot indicates that the resource is **over assigned**, and you should review the Resource Availability view". | [techdocs — Analyze Staffing by Using Assignments](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/Analyze-Resource-Allocation-and-Staffing-home/analyze-staffing-by-using-assignments.html) | Świadomy wybór: **albo** planujesz alokacjami, **albo** szacunkami zadań — i mówisz użytkownikowi który tryb ma włączony. | Sumowanie obu naraz. To liczy tę samą pracę dwa razy. |
| **Float** | Wzór wprost: „**Utilization rate = (Total number of scheduled work hours / Total number of available work hours in the same date range) x 100**". Pojemność z domyślnych dni i godzin roboczych, z możliwością nadpisania per osoba: „You can also set custom workdays and hours for individual team members without affecting the rest of your team". Zmiana dnia z 8 na 4 h „will add **overtime** to any person with more than 4 hours of allocations scheduled each Friday". Dzień nierobocze nie może nieść alokacji: „Unchecking a work day and selecting Update will **delete all scheduled allocations** on that day". | [float.com — resource utilization](https://www.float.com/resources/resource-utilization) · [support.float.com — default work days and hours](https://support.float.com/en/articles/28942-default-work-days-and-hours) | **„w tym samym zakresie dat"** — to jest cała odpowiedź na 853 %. Alokacja siedzi na konkretnych dniach; tydzień liczy tylko to, co na niego zaplanowano. Nadwyżka nazywa się **nadgodzinami**, nie 853 %. | Trzymanie „pojemności 40 h" jako stałej globalnej — Float pozwala nadpisać per osoba i per dzień, i to jest minimum. |
| **Runn** | Pojemność: „That's the sum of all of your resources' hours **minus** the sum of all their **time off**". Popyt rozbity na pewny i niepewny: **Confirmed Workload** = „the sum of assignment hours in **confirmed** projects", **Tentative Workload** = „…in **tentative** projects". Wzory: „(Total Registered Hours / Total Hours Available) x 100" i wersja billable. Kolory: „Navy bars show when a resource is **over capacity**", „**Red** bars represent times when you can't take on more work". | [runn.io — capacity report](https://www.runn.io/blog/capacity-report) · [runn.io — resource utilization](https://www.runn.io/blog/resource-utilization) | **Rozdzielenie popytu pewnego od wstępnego** — w doradztwie to codzienność („inicjatywa jeszcze niezatwierdzona"). Pojemność = godziny minus nieobecności. | Jedna liczba „obłożenie" bez podziału pewne/wstępne — sponsor pyta „czy mamy ludzi", a odpowiedź zależy od tego podziału. |
| **Meisterplan** | Mapa cieplna: zasoby (osoby, działy, **role**, zespoły) × okresy. Jednostka konfigurowalna: „days, hours, FTE and even cost", albo „the percent of a resource's capacity that has been allocated to projects". Kolory: „the heatmap will show **underallocated** resources in **blue** and **overallocated** resources in **red**", progi domyślnie **75 %** i **100 %**, konfigurowalne. Istota: „matching the 'capacity supply' … with the 'capacity demands' … of an organization". | [meisterplan.com — allocation heatmaps](https://meisterplan.com/blog/resource-management/allocation-heatmaps-for-capacity-planning/) | **Progi jako ustawienie, nie jako kod**: 75 % niedociążenie, 100 % przeciążenie. Rola jako pełnoprawny wymiar obok osoby. | Sztywne progi wpisane w komponent — każda firma doradcza ma inny próg (u niektórych 80 % to już przeciążenie). |
| **Smartsheet Resource Management** | „Smartsheet supports the use of **placeholders** in resource management, allowing for flexible planning and forecasting of future resource needs". Raporty obłożenia „highlighting areas of over or under-utilization"; „heatmaps … quickly see who's under or over utilized at the department or division level". Planowanie **udziałem czasu, nie godzinami**: „Percentage-based planning by share of time rather than exact hours". | [smartsheet.com — resource management](https://www.smartsheet.com/platform/resource-management) · (udział %) [productive.io — capacity planning software](https://productio.io) → poprawnie: [productive.io](https://productive.io/blog/capacity-planning-software/) | **Placeholder = rola bez nazwiska.** W doradztwie plan powstaje, zanim wiadomo kto poleci do klienta. | Planowanie wyłącznie procentem udziału — bez godzin nie da się potem porównać z kartami pracy. |
| **Kantata, Productive, Resource Guru, Hub Planner, ClickUp** (źródło wtórne) | Kantata: „**Hard and soft allocations** across project portfolio management views". Productive: „**Tentative bookings** … hold unconfirmed projects on the schedule **without blocking confirmed work**. **Placeholders** stand in for roles you have not hired or assigned yet". Resource Guru: „Tentative bookings that **do not count as committed time**". ClickUp: „Showing **assigned hours against weekly capacity**" — ale bez planowania pracy niepotwierdzonej. | [productive.io — capacity planning software](https://productive.io/blog/capacity-planning-software/) | Rezerwacja wstępna **nie blokuje** pracy potwierdzonej — to jest reguła, nie ozdoba. | ClickUp jako wzór: godziny przypisane vs pojemność tygodnia, bez rozróżnienia pewne/wstępne — dokładnie ten model produkuje absurdy. |
| **Asana** | Jednostki: liczba zadań, godziny lub punkty z pola liczbowego. Pojemność ustawiana per osoba: „set a maximum capacity for each team member. If team members go over that capacity, you'll see a **red line** in Workload". | [asana.com/resources/asana-tips-workload](https://asana.com/resources/asana-tips-workload) | Prostota: jedna liczba pojemności na osobę, jedna czerwona linia. | Dokumentacja **nie mówi**, co się dzieje z zadaniami po terminie — i to jest cisza, która kosztuje. Patrz §5.1. |

### 2.2.1 Jak rynek NAPRAWDĘ przechowuje alokację (i dlaczego siatka osoba × tydzień to zła odpowiedź)

**Żaden z poważnych graczy nie trzyma „osoba × tydzień" jako bytu podstawowego.** Wszędzie
jest **zakres dat + intensywność**; siatka tygodniowa jest **wyliczana do prezentacji**.

| Produkt | Co leży w bazie | Źródło |
| --- | --- | --- |
| **Float** | `people_id, project_id, start_date, end_date, hours` (godziny **na dzień**), `status` (1 = wstępna, 2 = potwierdzona), `billable` | [developer.float.com](http://developer.float.com/tutorial_assigning_tasks_to_your_team.html) |
| **Forecast** | zakres dat + **siedem wartości minutowych per dzień tygodnia**: `monday`…`sunday` = „Integer, allocation hours in minutes", plus `is_soft` | [API allocations](https://raw.githubusercontent.com/Forecast-it/API/master/sections/allocations.md) |
| **Runn** | zakres dat + effort (godzin na dzień), `Total Effort = Effort in Hours per day × Work Days`, precyzja „to the nearest **minute per day**" | [help.runn.io — managing assignments](https://help.runn.io/en/articles/3386862-managing-assignments) |
| **Kantata** | **dwie warstwy**: `WorkspaceAllocation` (interwał: `minutes` na cały zakres + `percentage` „compared to their capacity") oraz `StoryAllocationDay` (siatka dzienna na zadaniu) | [developer.kantata.com](https://developer.kantata.com/kantata/specification/workspace-allocations) |
| **Teamwork** | **dwa silniki**: Workload wylicza z estymat zadań ÷ dni; Schedule trzyma rezerwację, gdzie „Total hours are spread evenly across the date range. **Adjusting one field updates the other**" | [Workload Planner](https://support.teamwork.com/projects/workload/workload-planner-overview) · [Allocate resources](https://support.teamwork.com/projects/schedule/allocate-and-manage-resources) |
| **Clarity** | alokacja na inwestycji (FTE / godziny / dni / % dostępności) + przypisania na zadaniach (ETC / Actuals / Usage) | [Allocations Timeline](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/Analyze-Resource-Allocation-and-Staffing-home/Analyze-Allocations-by-Using-Allocations-Timeline.html) |
| **Meisterplan** | „1 FTE equals 40 hours"; „Person Day in Hours" domyślnie 8; pule: osoby → zespoły → **role** | [help.meisterplan.com](https://help.meisterplan.com/hc/en-us/articles/360021369100-3-Configure-Capacity-Planning-Basics) |

**Najtańszy pojemny wzorzec to Forecast:** `start_date + end_date + 7 liczb minutowych`
obsługuje naraz trzy sposoby wprowadzania („suma godzin", „% dnia", ręczna dystrybucja) bez
trzech osobnych bytów w bazie.

### 2.2.2 Wzory obłożenia — mianownik jest wszędzie taki sam

Wszystkie zmierzone produkty liczą tak samo w mianowniku: **godziny kontraktowe minus
nieobecności i święta**. Różnią się wyłącznie licznikiem.

| Produkt | Mianownik (dosłownie) | Licznik |
| --- | --- | --- |
| **Runn** | „Contracted capacity" − „Time off" = „**Effective capacity**" | wykresy: **tylko plan** („Actual hours on the timesheet are **not used**"); dashboard: fakty gdy są ([źródło](https://help.runn.io/en/articles/6565020-calculations-for-utilization-chart)) |
| **Float** | „daily work hours and the number of workdays", minus urlopy i święta | zaplanowane; **jedyny z przełącznikiem mianownika**: „the billable percentage of **Capacity** or… of the **Scheduled** hours" ([źródło](https://support.float.com/en/articles/4385599-people-report)) |
| **Kantata** | „the total potential time for a period…, **excluding time off and holidays**" | „the total number of **tracked time**"; osobno Actual / Allocated / Scheduled Utilization ([źródło](https://knowledge.kantata.com/hc/en-us/articles/203814824-Analytics-Utilization)) |
| **Forecast** | „Available time is **Working hours − Time off**" | „Actual Total Time (past time registrations) + Remaining Total Time (future allocations)" ([źródło](https://support.forecast.app/hc/en-us/articles/5286588674065-Overview-of-Utilization-Report)) |
| **Teamwork** | „**available time = total working hours − unavailable time**" | trzy warianty: `estimated / logged / billable ÷ available × 100` ([źródło](https://support.teamwork.com/projects/reports/utilization-report)) |

**Twarde progi** ma tylko dwóch: **Forecast** — niedociążony ≤ 92 %, w pełni obłożony
93–106 %, przeciążony ≥ 107 % ([źródło](https://support.forecast.app/hc/en-us/articles/4775562212753-Overview-of-People-Schedule));
**Runn** — 0–80 % niebieski, 80–100 % zielony, 100–160 %+ czerwony
([źródło](https://help.runn.io/en/articles/11517169-utilization-dashboard)). Meisterplan
domyślnie 75 % / 100 %, konfigurowalne.

### 2.2.3 ★ Praca po terminie a obłożenie — odpowiedź rynku jest jednogłośna i ODWROTNA do naszej pułapki

**★ SPROSTOWANIE (drugie w tym audycie).** Pisałem wyżej w tej sekcji, że „żaden produkt nie
przenosi niedokończonej pracy do przodu". **Pomiar Planview to obalił.** Jeden z Liderów
Gartnera robi dokładnie to, co nasze 853 % — i ma to opisane w dokumentacji słowo w słowo.
Zostawiam obie wersje, żeby było widać, że twierdzenie zostało obalone pomiarem, a nie
poprawione po cichu.

**Planview AdaptiveWork — mechanizm 853 % w dokumentacji producenta:**

> „When selecting **Remaining Effort**, it will show the load based on the remaining work.
> **All work items already past the due date that still have remaining effort will be
> reflected on Today.**"
> — [success.planview.com — Managing Resource Loads](https://success.planview.com/Planview_AdaptiveWork/Capacity_Planning_and_Resource_Management/Getting_Started_-_Preparing_Your_Environment/Managing_Resource_Loads)

To jest **ta sama choroba, jeden do jednego**: cała zaległość kumuluje się na dniu dzisiejszym.
Widok „Planned Work" w tym samym produkcie tego **nie robi** — czyli producent trzyma oba
zachowania obok siebie i pozwala wybrać widok. Naprawa nazywa się **Update Forecast** (trzy
opcje przeplanowania), ale ma udokumentowaną wadę: „Update Forecast **does not override Fixed
Duration or Due Date constraints**"
([źródło](https://success.planview.com/Planview_AdaptiveWork/Capacity_Planning_and_Resource_Management/Update_Forecast/ZAdditional_Update_Forecast_Behavior_and_Considerations/When_Tasks_Cannot_Be_Replanned)),
a **domyślna polityka pracy nowej organizacji to właśnie Fixed Duration**
([źródło](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Understanding_Work_Policy_Logic)).
Czyli na ustawieniach fabrycznych zaległość piętrzy się na „dziś", a automat naprawczy
odmawia działania.

**Planview Portfolios — ten sam problem rozwiązany inaczej, przez cztery jawne polityki.**
Produkt ma **Progressing Engine**: „system process that **progresses unfinished work forward**
in the project schedule", z pojęciem `Time Now` = „earliest date any work can be scheduled".
Praca nierozpoczęta ze startem w przeszłości ma „Schedule Start Date… moved to the next week's
start date". Dla alokacji są cztery opcje, a **domyślna to `Expire Effort and Respect Finish
Dates`** — czyli niewykazany wysiłek **wygasa**, zamiast rolować się na dziś:

> „if somebody doesn't report time… their effort for that particular week will be **expired**"
> — [success.planview.com — Understanding the Progressing Engine](https://success.planview.com/Planview_Portfolios/Projects_and_Work/Execute_and_Track_Progress/300_Work_Progress_and_Status/003_Understanding_the_Progressing_Engine)

Przy opcji `Respect Durations and Profiles` zachowanie jest odwrotne i producent sam ostrzega,
że „could cause a task to **slip**… move that resource's entire assignment forward and extend
the overall duration". Na forum producenta leży zgłoszenie użytkownika, że przy tej opcji
„the effort is just **piling up** against the date" i „**% utilization going over 300 %**"
mimo ustawionego limitu — **bez odpowiedzi**
([wątek](https://community.planview.com/ask-the-community-67/issues-with-respect-durations-not-shifting-work-allocations-forward-utilization-exceeding-limits-1130)).

**Wniosek: 853 % to znany, nierozwiązany problem branżowy, a nie nasza wyłączna wpadka.**
Różnica jest taka, że liderzy dają na to **jawny przełącznik polityki**, a my mamy jedno
zachowanie wpisane w kod.

**Pozostałe produkty — praca zaległa zostaje tam, gdzie ją zaplanowano:**

| Produkt | Mechanika | Dowód z dokumentacji |
| --- | --- | --- |
| **★ Planview AdaptiveWork** | **PRZENOSI na dziś** w widoku Remaining Effort (patrz wyżej) | „will be **reflected on Today**" |
| **★ Planview Portfolios** | konfigurowalne: domyślnie **wygasa**; przy `Respect Durations` **roluje się i piętrzy** | „their effort… will be **expired**" / zgłoszenie „&gt;300 %" |
| **Broadcom Clarity** | ETC **zamrożone w przeszłości**, nie rusza się samo; jedyny automat to job `Post Timesheets`, który „**Advances ETC** past the time period for the posted timesheets" — i tylko dla osób z zaksięgowaną kartą pracy. Przeciążenia **nie da się zablokować**: „There's **no supported option**… that could prevent this" | [Jobs reference](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-2-2/reference/clarity-ppm-jobs-reference.html) · [Over-allocation prevention](https://knowledge.broadcom.com/external/article/201632/over-allocation-can-this-be-prevented.html) |
| **Runn** | plan zostaje w przeszłości, dosłownie | „the Availability Summary… is based on **Scheduled Hours (Assignments), even in the past**" ([źródło](https://help.runn.io/en/articles/4293043-people-planner-overview)) |
| **Float** | nie ma pojęcia „niedokończone" (zadanie bez statusu), więc nic się nie może przelać; przesunięcie chroni przeszłość | „**Completed work and all logged time will remain as they are**" ([źródło](https://support.float.com/en/articles/28927-move-multiple-allocations-milestones-and-phases-together)) |
| **Kantata** | przeszłe godziny **wypadają z prognozy** | „`ETC = Future Scheduled Hours × Bill Rates`", liczone „**from yesterday… forward**" ([źródło](https://knowledge.kantata.com/hc/en-us/articles/360004619334-Project-Completion-Estimates)) |
| **Forecast** | przeszła, niezużyta alokacja wypada z `Remaining` | „Sum of allocations in the remainder of the period **starting from today**" ([źródło](https://support.forecast.app/hc/en-us/articles/5286588674065-Overview-of-Utilization-Report)) |
| **Smartsheet** | ikona przeciążenia **gaśnie** na przeszłości; status zadania w ogóle nie dociera do modułu zasobów | „The icon won't appear for rows with **past end dates**" ([źródło](https://help.smartsheet.com/articles/1346969-legacy-resource-management-allocation)); „The work item's status **isn't currently synced**" ([źródło](https://help.smartsheet.com/articles/2482380-sync-resource-management-assignments-with-Smartsheet)) |
| **ServiceNow SPM** | dostępność liczona **per dzień**; przeciążenie **nie roluje się na kolejny dzień** (osoba z 41 h przy 40 h może pokazywać 10 h dostępności). Przesunięcie jest **ręczne**: „shift allocation", „move plan forward". Skrócenie planu przy zapisanych godzinach faktycznych zwalnia **tylko przyszłe** niezużyte godziny | [Manage resources — allocation workbench](https://www.servicenow.com/docs/bundle/yokohama-it-business-management/page/product/resource-management/task/manage-resources-allocation-workbench.html) · [dlaczego alokacja tak wygląda (community)](https://www.servicenow.com/community/spm-articles/why-does-my-resource-report-allocation-workbench-show/ta-p/2302122) |
| **Jira Align** | brak automatycznego przeniesienia; proces **ręczny**: raport porządkowy PI → „split… or move to next PI"; „If there is leftover work, the object **should be split**". **Ale jest tu pułapka zawyżania:** obciążenie faktyczne PI liczy punkty „**regardless of sprint assignment**", więc zaległa historia w tym samym PI **zawyża obciążenie tego PI** | [PI cleanup report](https://help.jiraalign.com/hc/en-us/articles/115004903548-Program-increment-cleanup-report) · [PI inheritance rule](https://help.jiraalign.com/hc/en-us/articles/360001423113-PI-inheritance-rule-for-work-items) · [Manage PI planning](https://help.jiraalign.com/hc/en-us/articles/115000169933-Manage-PI-planning-in-the-program-room) |
| **Jira Plans** | brak carry-over; jedyny sygnał to ostrzeżenie „Open work item has **passed its** inferred/assigned end date" | [troubleshoot warnings](https://support.atlassian.com/jira-software-cloud/docs/troubleshoot-warnings-on-your-timeline-in-advanced-roadmaps/) |
| **Asana, monday, Wrike, ClickUp, Teamwork** | **dokumentacja milczy**; z udokumentowanej mechaniki wynika, że efort jest przypięty do własnych dat zadania, więc zaległość zostaje w przeszłości | wniosek z reguły widoczności, **nie cytat** — zaznaczam to uczciwie |

**Rynek ma więc DWA błędy, przeciwstawne, i żaden go nie rozwiązuje dobrze:**

- **Błąd zawyżania** (Planview AdaptiveWork domyślnie, Planview Portfolios przy jednej
  z polityk): zaległość ląduje na „dziś" i produkuje 300 %, 853 %, dowolną liczbę.
- **Błąd zaniżania** (Runn, Float, Kantata, Forecast, Smartsheet, ServiceNow, Clarity):
  zaległość zostaje w przeszłości i **znika z obrazu** — nie widać jej ani wczoraj (bo
  minęło), ani dziś (bo się nie przeniosła). Kantata musi to sprzątać **zewnętrzną
  automatyzacją na planie Enterprise**: „the **remaining scheduled hours must be removed**…
  **to avoid impacting reports**"
  ([źródło](https://knowledge.kantata.com/hc/en-us/articles/37258853457691-Recipe-Catalog-Tasks-Remove-Future-Scheduled-Hours)).
  Runn wręcz **blokuje** przesunięcie projektu, jeśli są zapisane godziny faktyczne
  ([źródło](https://help.runn.io/en/articles/4721837-rescheduling-a-project)).

**Trzecia droga — i to jest miejsce dla Consultify:** zaległość jako **osobna, widoczna
liczba obok popytu**, nie wliczana do obłożenia tygodnia, z jawną decyzją człowieka co z nią
zrobić. Nikt tego nie robi. Planview ma politykę (wygaś / przesuń / zignoruj), ale ukrytą
w konfiguracji projektu; my możemy ją pokazać jako kolumnę i trzy przyciski.

**Wniosek dla Consultify (pytanie 2) — trzy zdania, które zmieniają plan.**

1. Rynek dzieli się na **szkołę alokacji** (Clarity, Float, Runn, Meisterplan, Smartsheet RM,
   Kantata, Forecast w trybie A) i **szkołę zadań** (Asana, ClickUp, monday, Teamwork
   Workload, Forecast w trybie B). Metodyka 1_12 (A1 pkt 7) wybiera szkołę alokacji —
   **zgodnie z rynkiem** — ale plan C2 dla zakładki Zasoby liczy popyt z zadań. To jest
   **cicha zmiana szkoły w połowie dokumentu** i trzeba ją rozstrzygnąć jawnie.
2. Jeśli oba silniki mają istnieć obok siebie, rynek ma **jedną sprawdzoną regułę
   rozstrzygania** — Forecast Combined Mode: „Resource utilization and demand are represented
   by **whichever is greater** for the resource for the project in that period of time"
   ([źródło](https://support.forecast.app/hc/en-us/articles/24238241585681-About-Combined-Mode)).
   Wrike ma identyczną: „the chart will compare the values and **use the one that's bigger**"
   ([źródło](https://help.wrike.com/hc/en-us/articles/1500000614522-Resources-View)).
   **Nigdy nie sumować** obu — to liczy tę samą pracę dwa razy.
3. **853 % jest znanym problemem branżowym, nie naszą wyłączną wpadką.** Planview
   AdaptiveWork ma to zachowanie **udokumentowane jako projektowe** („reflected on Today"),
   a użytkownicy Planview Portfolios zgłaszają „&gt;300 %" na forum producenta. Różnica: liderzy
   dają **przełącznik polityki** (wygaś / przesuń / zignoruj), my mamy jedno zachowanie wpisane
   w kod. To jest dokładnie luka, którą właściciel opisał słowami „zarządzać opóźnieniami
   i przesunięciami": **zaległość jako osobna, widoczna kolumna, plus jawna decyzja człowieka
   co z nią zrobić.**

## 2.3 Pytanie 3 — Decyzje, ryzyka, RAID, eskalacja

| Produkt | Jak to robi | Źródło | Co warto skopiować | Czego unikać |
| --- | --- | --- | --- | --- |
| **Broadcom Clarity** | Jeden moduł **Risks, Issues, and Changes (RIC)**. Kluczowa mechanika to **konwersja z zachowaniem śladu**: z ryzyka można utworzyć problem lub wniosek o zmianę, z problemu — ryzyko lub zmianę, z wniosku — ryzyko lub problem, a nowy rekord ma „a link back to the originating Risk". Ryzyka i problemy wiążą się z zadaniami („tasks that are associated with Risks or Issues…"). Pola są konfigurowalne przez administratora (wymagane oznaczone gwiazdką). | [techdocs — Manage Risks, Issues, and Changes](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/new-user-experience-manage-risks-issues-and-changes.html) | **Eskalacja jako konwersja typu z linkiem do źródła** — „ryzyko się ziściło → problem", „problem wymaga zmiany planu → wniosek o zmianę". To jest mechanizm, którego szuka właściciel dla przesunięć terminu. | Konfigurowalność pól do zera — jeśli wszystko jest opcjonalne, „termin decyzji" nigdy nie zostanie wypełniony (u nas: 16 pozycji RAID, 0 z terminem). |
| **Shibumi** | „Risks can be entered at **any level** in Shibumi, including at the initiative level" i „can be reported on at a program level". Bramki: „review/approvals must occur before moving between stages", „Gate 1 reviewers are automatically notified and provided with a **tailored view of key data**". Ślad: „records every single page view, change, time, date, old/new value, and who has made the change… stored in perpetuity" — „immutable audit trail". | [shibumi.com/critical-capabilities](https://shibumi.com/critical-capabilities/) · [shibumi.com/blog — stage gates](https://shibumi.com/blog/managing-stage-gates-for-your-strategic-program-shibumi-can-do-that/) | **Bramka = decyzja z powiadomieniem i własnym widokiem danych dla zatwierdzającego.** Plus niezmienny ślad kto i kiedy zmienił wartość. | „Ryzyko na dowolnym poziomie" bez reguły agregacji — sponsor dostaje 200 ryzyk zamiast trzech. |
| **Standard rynkowy RAID (Asana)** | Definicja: „A RAID log is a project management tool used to track **R**isks, **A**ssumptions (or Actions), **I**ssues, and **D**ependencies (or Decisions)". Zalecane pola: numer, opis, kategoria, **data zidentyfikowania**, właściciel, priorytet (High/Medium/Low), status (Open / In Progress / Closed), plan działania. | [asana.com/resources/raid-log](https://asana.com/resources/raid-log) | Minimalny, uczciwy zestaw pól — bez pseudonaukowej macierzy prawdopodobieństwo × wpływ na starcie. | **Uwaga: w tym standardzie NIE MA terminu ani ścieżki eskalacji.** Dlatego rynek nie umie odpowiedzieć „które decyzje nie zapadły na czas". |
| **Standard rynkowy rejestru decyzji** | Szablon Techno-PM: numer, „Decision Details", „Impact", „Proposed on and Proposed By", „Status — **Approved, Pending, Declined**. **Abandoned** can be used when the decision is not required anymore", „Approved by and Date", „Resulting Action/Comments". Szablon ProjectManager: opis, status, uzasadnienie, wpływ, „Decision Maker", „Stakeholders Impacted", „Stakeholders Consulted". | [techno-pm.com](https://www.techno-pm.com/blogs/raid/decision-register-excel-template-free) · [projectmanager.com](https://www.projectmanager.com/templates/decision-log-template) | Status **Abandoned** („decyzja przestała być potrzebna") — brakujące ogniwo, bez którego rejestr puchnie. Rozdział „decydent / dotknięci / konsultowani". | **Żaden z obu szablonów nie ma pola „decyzja potrzebna do dnia".** Jest tylko data zaproponowania i data zatwierdzenia. To jest **luka całego rynku**. |
| **Praktyka eskalacji** | Rekomendowany format: temat wiadomości „**ESCALATION Tier X – ‹Issue Summary› – ‹DD-MMM›**" plus kanał „#escalations", w którym PMO publikuje zmiany statusu na żywo. Rejestr decyzji ma być przeglądany „monthly in status meetings… and surface any decisions that need clarification or escalation". | [apmic.org — szablony 2026](https://apmic.org/blogs/best-project-management-templates-amp-resources-2026-edition) · [projinsights.com — decision log](https://www.projinsights.com/what-is-decision-log-in-project-management-and-template/) | **Poziom eskalacji jako liczba w temacie**, nie jako opowieść. Przegląd rejestru wpisany w rytm. | Eskalacja realizowana wyłącznie mailem poza narzędziem — ginie ślad, kto i kiedy eskalował. |
| **Microsoft Project Online** | Jedyny z pełnym, gotowym rejestrem ryzyk. Pola: Title, Owner, Assigned To, Status, Category, **Due Date**, **Probability**, **Impact**, **Exposure**, Cost, Description, **Mitigation Plan** („what you need to do to try to avoid the risk occurring"), **Contingency Plan** („what you're going to do if the risk actually does occur"), **Trigger**. Wynik: „Exposure (the product of your Probability by Impact factors)". Wiązanie z zadaniem: ryzyko → **Add Related Item** → Tasks → wskazanie wiersza (można wiele zadań). | [support.microsoft.com — Add a risk](https://support.microsoft.com/en-us/office/add-a-risk-to-a-project-in-project-online-7aa1acc9-50cf-4f15-ac3b-fedf41b31c83) · [best practices for managing risks](https://support.microsoft.com/en-us/office/project-online-best-practices-for-managing-risks-0523899d-1d3a-4561-8d42-acb0951602ba) | **Rozdzielenie planu zaradczego (żeby nie wystąpiło) od planu awaryjnego (gdy wystąpi) i wyzwalacza.** Ryzyko **ma termin**. Twardy link ryzyko→zadanie. | Formalnej ścieżki eskalacji dokumentacja **nie opisuje** — ryzyko ma termin, ale nie ma poziomu eskalacji. |
| **Teamwork.com** | Jedyny natywny rejestr ryzyk w klasie PSA. Pola dosłownie: **Risk source**; **Impact areas** („cost, schedule, or performance"); **Probability** („Low is 1-3, medium is 4-6, and high is 7-9"); **Impact** (ta sama skala); **Status** („open, pending, or closed"); **Mitigation/Response plan**. Widok przekrojowy `Everything > Risks`, eksport PDF/Excel, kopiowanie rejestru między projektami. | [support.teamwork.com — Risks explained](https://support.teamwork.com/projects/risks/risks-explained) | **Skala 1–9 z nazwanymi pasmami** (nisko 1–3 / średnio 4–6 / wysoko 7–9) — konkretna, a nie „wysokie/średnie/niskie" bez definicji. **Obszary wpływu: koszt / harmonogram / wykonanie.** | Dziennika decyzji nie ma — z RAID pokryte tylko „R". |
| **Kantata** | Brak rejestru decyzji. Najbliżej: **Health Report** — kolor zielony/żółty/czerwony na Overall plus kategorie **Scope, Budget, Schedule, Client**, „side-by-side comparison of your ten most recent health reports", z regułą **append-only**: „**Only one New Health Report can be created per day… you can only edit a report on the day that it was created**". Oraz **Change Order**: „you can require approval for **budget and due date changes**. Change orders allow you to **leave an audit trail**". | [Project Side Panel](https://knowledge.kantata.com/hc/en-us/articles/360000695314-Project-Side-Panel) · [Budget Tab](https://knowledge.kantata.com/hc/en-us/articles/6618654476827-Project-Admin-Box-Budget-Tab) | **Change Order = zatwierdzenie zmiany budżetu I TERMINU ze śladem audytu.** To jest gotowy wzorzec dla „przesunięcie wymaga decyzji" z metodyki A2. Oraz **jeden wpis dziennie, nieedytowalny po dniu** — uczciwa historia bez retuszu. | Ocena zdrowia w czterech osiach bez reguły agregacji — Overall bywa ustawiany niezależnie od czterech kategorii. |
| **Forecast** | Brak rejestru decyzji. Najbliżej: **Project Status jako RAG z niekasowalną historią** — „It is **not possible to delete** a project status entry from the history. If you have logged a status incorrectly, resolve by **adding a new entry**". Zatwierdzenia wąskie i przypięte do bytu: czasu, urlopu, **alokacji** (osobne uprawnienie `Approve allocations` do konwersji rezerwacji wstępnej w twardą). | [support.forecast.app — Using Project Status](https://support.forecast.app/hc/en-us/articles/13578415306129-Using-Project-Status) · [Soft vs Hard](https://support.forecast.app/hc/en-us/articles/36512262486545-Soft-vs-Hard-Project-Allocations) | **Korekta przez dopisanie, nie przez skasowanie.** To jest właściwy model dla rejestru decyzji w audytowalnym produkcie doradczym. | Change requestów brak; dokumentacja radzi proces **poza systemem** („we strongly recommend exporting your baseline"). To jest kapitulacja, nie wzorzec. |
| **Zatwierdzenia — kto jak** | **Asana**: natywny typ zadania, trzy wyniki **Approved / Changes requested / Rejected**, „Incomplete tasks are 'pending' approval". **Wrike**: zatwierdzenia na zadaniach, folderach i projektach, **recenzent zewnętrzny bez konta** („a guest user receives an email invitation to review and can comment on and approve files without having to join an account"), ale decyzja **dwuwartościowa** — „Approve or Changes required". **Smartsheet**: krok automatyzacji — „Approval requests **pause the workflow** until the request is approved or declined", ścieżki „If Approved"/„If Declined". **Teamwork Proofs**: „A proof's approval status only changes to Approved once **all** its approvers give their individual approval". | [Asana approvals](https://help.asana.com/s/article/approvals) · [Wrike approvals](https://help.wrike.com/hc/en-us/articles/360023006313-Approvals-in-Wrike) · [Wrike guest review](https://help.wrike.com/hc/en-us/articles/360009722693-Reviewing-and-Approving-Files-for-Guest-Users) · [Smartsheet approvals](https://help.smartsheet.com/articles/2479276-request-approval-from-stakeholders) | **Trójstan Asany (zatwierdzone / poprawki / odrzucone)** i **wstrzymanie przepływu do czasu decyzji** (Smartsheet) — razem dają „decyzja blokuje zadanie". **Recenzent zewnętrzny bez konta** to funkcja krytyczna dla komitetu po stronie klienta. | Dwuwartościowość Wrike (brak „odrzucone") — w rejestrze decyzji „odrzucona" i „do poprawy" to dwa różne wyniki. |
| **Eskalacja czasowa — jedyny gotowy przepis** | monday.com: `Every day, if {due date} has passed and only if {status} is {something}, {notify} {someone}`. Dwa ostrzeżenia w dokumentacji: „This template **cannot be built with the custom automation builder**" oraz „the automation will run at **midnight after the date has passed**, the template **will not work retroactively**". Powiadomienia nie umieją odwoływać się do kolumn Formula/Progress/Dependency. Celoxis: **timeout policies** w aplikacjach własnych (np. powiadomienie, gdy krok nie wykonany w 72 h). | [support.monday.com — Alerts and Reminders](https://support.monday.com/hc/en-us/articles/360000227739-Alerts-and-Reminders-with-Automations) · [celoxis.com — Custom Apps](https://www.celoxis.com/kb/latest/custom-apps/concepts/introduction) | **Codzienny przebieg o północy: „termin minął i status nadal X → powiadom Y".** To jest cała mechanika „decyzji po terminie" — prosta i wystarczająca. | „Nie działa wstecznie" — przy uruchomieniu na istniejących danych 12 decyzji po terminie **nie wygeneruje ani jednego powiadomienia**. U nas to już się stało (32 sygnały, zero powiadomień). |
| **Asana / ClickUp / Smartsheet / monday / Runn / Float** | **Nie mają** rejestru decyzji ani RAID jako typu obiektu. Smartsheet opisuje RAID **wyłącznie koncepcyjnie**, w wersji Risks/**Actions**/Issues/**Decisions**. monday ma **Portfolio Risk Insights** — „automatically analyzes data from each of your project boards and generates a **daily list of potential risks**", czyli listę generowaną, **nie** audytowalny rejestr prowadzony przez człowieka. Runn i Float: brak nawet haseł „risk" i „decision" w słowniku. | [help.smartsheet.com — RAID Logs](https://help.smartsheet.com/articles/2483374-raid-logs) · [support.monday.com — Risk Insights](https://support.monday.com/hc/en-us/articles/22551628427666-The-portfolio-Risk-Insights) | Nic. | Nie kopiować tej klasy. Dla PMO transformacyjnego rejestr decyzji **musi** być typem obiektu. |
| **★ ServiceNow SPM — JEDYNY z rejestrem decyzji na rynku** | Model **RIDAC**: **R**isk, **I**ssue, **D**ecision, **A**ction, **C**hange — **Decision jest pełnoprawnym typem rekordu**, nie polem własnym. Konwersja **tylko w kolejności RIDAC i jednokierunkowo**: z ryzyka można zrobić problem, decyzję, działanie lub zmianę; **nigdy w drugą stronę** (problem → ryzyko jest niemożliwe). Jeden rekord może zrodzić wiele. Eskalacja ryzyka projektowego do korporacyjnego rejestru ryzyk z powiadomieniem oceniających. | [servicenow.com — RIDAC entries](https://www.servicenow.com/docs/bundle/xanadu-it-business-management/page/product/project-management/concept/ridac-entries-for-project.html) · [Add decisions for project](https://www.servicenow.com/docs/bundle/washingtondc-it-business-management/page/product/project-management/task/add-decisions-for-project.html) · [Workflow of PPM risk](https://www.servicenow.com/docs/bundle/washingtondc-governance-risk-compliance/page/product/grc-risk/concept/workflow-of-ppm-risk.html) | **★ Decyzja jako typ rekordu w jednym rejestrze obok ryzyka i problemu, z konwersją jednokierunkową.** Kolejność R→I→D→A→C jest sama w sobie metodyką: ryzyko się ziściło → problem → wymaga decyzji → działanie → zmiana planu. **To jest wzorzec do skopiowania wprost.** | Pełnej listy pól rekordu Decision **nie zmierzyłem** — dokumentacja odsyła do „RIDAC form fields", strony nie udało się pobrać. Znany defekt: w nowym Project Workspace pole `State` dla Risks i Decisions się nie wyświetla. |
| **Jira Align** | **Nie ma jednego rejestru RAID** — cztery osobne obiekty: Risks, Dependencies, Impediments, **Escalations**. Najbliżej decyzji jest **Escalation** („solicit a decision"): powiadomienie wszystkich w sprincie, przepływ Take Action → Guidance → Resolved. Ryzyko ma **ROAM** (Resolved/Owned/Accepted/Mitigated), **Target Resolution Date** i pole **Notify** — powiadomienie po przekroczeniu terminu. Zależności mają **negocjację zobowiązania**: Commit / zaproponuj datę / Reject, przy czym „once rejected, **life cycle is over**". | [help.jiraalign.com — Create risks](https://help.jiraalign.com/hc/en-us/articles/115001074487-Create-risks) · [Portfolio escalations](https://help.jiraalign.com/hc/en-us/articles/115000124254-Portfolio-escalations) · [Dependency overview](https://help.jiraalign.com/hc/en-us/articles/115002700947-Dependency-overview-and-dependency-types) | **Ryzyko z terminem rozstrzygnięcia i automatycznym powiadomieniem po jego przekroczeniu** — to jest dokładnie mechanika „po terminie", której szukamy, tylko zastosowana do ryzyk. Plus **negocjacja zależności** jako mini-decyzja z dwoma stronami. | Automatycznych poziomów eskalacji (L1/L2/SLA) **nie ma** — są tylko powiadomienia. Blokowanie: „flaga i kolor", nigdy twarda blokada przejścia stanu. |
| **Jira Plans (Advanced Roadmaps)** | Natywnego rejestru RAID ani decyzji **nie ma**. Zależności to linki „blocks / is blocked by", a konflikt dat daje **ostrzeżenie, nie blokadę**. | [support.atlassian.com — dependencies](https://support.atlassian.com/jira-software-cloud/docs/view-and-manage-dependencies-in-advanced-roadmaps/) | — | — |

**Wniosek dla Consultify (pytanie 3) — najważniejszy w całym audycie, ze sprostowaniem.**

**★ SPROSTOWANIE mojej własnej tezy — dwukrotne.** W trakcie audytu napisałem, że „rejestr
decyzji to biała plama całej kategorii — nie ma go nikt". **Pomiar obalił to dwa razy:**
najpierw ServiceNow (model RIDAC, Decision jako typ rekordu), potem Planview AdaptiveWork
(Meeting Notes → Decisions). Zapisuję zamiast poprawiać po cichu, bo różnica jest istotna:
nie jesteśmy pionierami, tylko dołączamy do dwóch producentów — i mamy od kogo wziąć wzorzec.

**Planview AdaptiveWork — drugi natywny rejestr decyzji:**
notatka ze spotkania rodzi **wiele Decyzji i Działań, każde z własnym właścicielem**;
publikacja **blokuje edycję** („locked for editing"), cofnięcie publikacji odblokowuje;
Decyzje i Działania można tworzyć **także bez notatki**, bezpośrednio na portfelu, programie,
projekcie lub sprawie; Działania mają osobny moduł z właścicielem i terminem
([źródło](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Meeting_Notes%2C_Action_items_and_Decisions)).
Ten sam produkt ma też **policzoną ocenę ryzyka**: `RiskRate = Impact × %Probability`
(pole tylko do odczytu), obok `TriggerDate`, `MitigationPlan`, `ContingencyPlan`
([źródło](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Cases/Case_Types)).

Stan faktyczny na **18 zmierzonych produktów**:

| Co | Ile produktów | Kto |
| --- | --- | --- |
| **Rejestr decyzji jako typ rekordu** | **2 z 18** | ServiceNow (RIDAC), Planview AdaptiveWork (Meeting Notes → Decisions) |
| Namiastka decyzji | 3 | Jira Align (Escalation), Forecast (historia statusu nieusuwalna), Planview Portfolios (Logbook) |
| **Rejestr ryzyk z oceną i terminem** | **5 z 18** | MS Project Online, Teamwork, ServiceNow, Jira Align, Planview AdaptiveWork |
| Rejestr ryzyk bez terminu / konfigurowalny | 3 | Clarity (RIC), Planview Portfolios (CRI), Kantata (typ `issue`) |
| **Nic** | 8 | Asana, monday, Smartsheet, ClickUp, Wrike, Runn, Float, Meisterplan |

**Dwa wzorce warte skopiowania wprost:**

1. **Decyzja rodzi się ze spotkania i jest blokowana przy publikacji** (AdaptiveWork). To jest
   naturalny przepływ konsultanta: komitet się spotyka → padają decyzje → publikacja zamyka
   je do edycji. U nas moduł Spotkań już istnieje.
2. **Jeden rejestr, konwersja jednokierunkowa R→I→D→A→C** (ServiceNow). Kolejność jest sama
   w sobie metodyką: ryzyko → problem → decyzja → działanie → zmiana planu.

**Czego nadal nie ma nikt:** pola „**decyzja potrzebna do dnia**" i licznika „ile decyzji nie
zapadło na czas". Standardowe szablony branżowe (Asana RAID, Techno-PM, ProjectManager) mają
datę zgłoszenia i datę zatwierdzenia, **nie mają terminu**. Nie zmierzyłem też, czy rekord
Decision w ServiceNow ma termin — dokumentacja odsyła do strony, której nie pobrałem.
Metodyka z 1_12 (A2, „Rejestr decyzji z terminem") pozostaje więc **przed rynkiem**, ale
mamy teraz dwa konkretne wzorce struktury, a nie pustkę.

Cztery mechanizmy, które da się złożyć z rzeczy już istniejących na rynku:

1. **Termin i wynik** — od MS Project (ryzyko ma `Due Date`) + Asana (trójstan zatwierdzenia).
2. **Eskalacja czasowa** — od monday (przebieg o północy: termin minął + status nadal otwarty
   → powiadom), z poprawką: **musi działać wstecznie** przy pierwszym uruchomieniu.
3. **Blokowanie** — od Smartsheet („approval requests **pause the workflow**") + Asany (pola
   `Blocked by` / `Blocking` widoczne w tabeli).
4. **Ślad i przesunięcie terminu** — od Kantata Change Order („approval for budget **and due
   date** changes… leave an audit trail") + Forecast (historia nieusuwalna, korekta przez
   dopisanie) + Clarity (konwersja ryzyko → problem → wniosek o zmianę z linkiem do źródła).

## 2.4 Pytanie 4 — Raporty na poziomach

| Produkt | Jak to robi | Źródło | Co warto skopiować | Czego unikać |
| --- | --- | --- | --- | --- |
| **Broadcom Clarity** | Raport statusu jest **osobnym rekordem** z polem „Report Status": wartości **Draft, Final**, plus atrybut **Latest** = „the most recent record, where 'Report Status' has been set to 'Final'". Publikacja PDF przestawia stan: „When you publish a PDF status report from Canvas… A new status report instance appears. The value in the Report Status field changes from **Draft to Final**". Cel: „share the investment reports with the entire PMO team and other stakeholders in a **PDF** format". Widoczne są „current and prior status reports". | [techdocs — Manage Status Reports](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/clarity--manage-status-reports.html) · [techdocs — Measure Progress and Publish](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/new-user-experience-measure-progress-and-publish-project-status-reports.html) | **Raport = instancja z cyklem Draft → Final, plus wskaźnik „Latest".** Publikacja PDF jest zdarzeniem, które zamraża rekord. Archiwum „current and prior" dostępne z jednego miejsca. | Raport jako widok generowany na żądanie z bieżących danych — po dwóch tygodniach nie odtworzysz, co widział komitet. |
| **WORKSPACE.PM** (mały producent, ale opisuje wzorzec najdosłowniej) | „The report shows the state **as of the reporting date** — even after the live value in the project drifts on." Cykl: „Three stages: **draft → submitted → approved**. Once 'approved', report values are **locked** against later edits." Ocena: „**Traffic-light rating for schedule, cost and performance** in every report" (On track / Watch / Critical). Agregacja: „Approved project and container reports **roll into the portfolio cockpit**". EVM: „Capture planned value, earned value and actual cost **as of a date**". | [workspace.pm — status](https://workspace.pm/en/features/project-management/status) | **Trzy stany + blokada po zatwierdzeniu + wpięcie zatwierdzonych raportów do kokpitu portfela.** Światło osobno dla harmonogramu, kosztu i wykonania — nie jedno „zdrowie". | Nie wpuszczać do kokpitu portfela raportów w stanie roboczym — kokpit zaczyna migotać. |
| **Nordantech Falcon** | „**Report live or in fixed cycles** to your key stakeholders" — jawnie oba tryby. „Create filterable **PowerPoint reports in your CI** at the touch of a button" oraz „use Falcon's **PowerBI interface** for interactive dashboards". Podwójne światło na każdym poziomie: lewe = efekty, prawe = działania; „Red = severe deviation, Yellow = slight deviation, Green = on schedule". | [nordantech.com](https://www.nordantech.com/en) · [support.nordantech.com](https://support.nordantech.com/en/articles/4219372-falcon-explained) | **PowerPoint w identyfikacji wizualnej jednym kliknięciem** — to jest waluta firmy doradczej. Oraz **dwa światła zamiast jednego**: „idzie zgodnie z planem" ≠ „przynosi efekt". | Jedno światło zbiorcze — zieleń na harmonogramie ukrywa zero efektu. |
| **Shibumi** | „customizable dashboards that display the status, risks, and performance of the initiatives"; użytkownicy widzą „**different levels of detail from different perspectives**" (strategiczny, inicjatywy, projektu). Automatyczna kaskada: „any changes made to data within Shibumi will automatically update linked elements such as dashboards/reports/**presentations**". | [shibumi.com/critical-capabilities](https://shibumi.com/critical-capabilities/) | **Te same dane, różny poziom szczegółu wg roli** — dokładnie A1 pkt 8 z metodyki. Prezentacja jako obiekt podłączony do danych. | Automatyczna aktualizacja **wszystkiego**, łącznie z prezentacją pokazaną tydzień temu — sponsor traci punkt odniesienia. |
| **Smartsheet** | Gotowe raporty obłożenia: „Utilization Reports: Measure how effectively resources are being used, highlighting areas of over or under-utilization"; mapy cieplne „at the department or division level". | [smartsheet.com — resource management](https://www.smartsheet.com/platform/resource-management) | Raport obłożenia na poziomie działu, nie tylko osoby. | — |
| **Reguły RAG (nie produkt, standard)** | Progi jako liczby: harmonogram — zielony „Forecast finish within **2 weeks of baseline**", bursztyn „**2 to 6 weeks** late, recovery plan exists", czerwony „More than **6 weeks** late, or no credible recovery". Koszt — zielony „within **5 %** of budget", bursztyn „**5 % to 10 %** over, mitigation identified", czerwony „More than **10 %** over". Definicje: zielony „On track… the project manager can handle them", bursztyn „At risk. A commitment **will be missed unless something changes**, but there is a credible recovery plan", czerwony „Off track… the project **cannot recover on its own**". | [portfoliohub.io — RAG status](https://portfoliohub.io/blog/rag-status) | **Bursztyn = „nie damy rady bez zmiany, ale mamy plan naprawczy"; czerwony = „sami nie wyjdziemy".** To jest definicja operacyjna, nie estetyczna — od razu mówi, czego oczekuje się od SteerCo. | Definiowanie RAG jako „trochę źle / bardzo źle" — nic z tego nie wynika. |
| **RAG — kto ustala i czy to liczy się samo** | „it is important for the PMO to set up RAG status definitions. When you have parameters like 'the budget is forecasted to be more than **15 %** overspent' or '**more than 3 milestones** are forecasted to be **2 weeks** late or more' then project managers have adequate guidance." Ocena jest **sądem człowieka**: „RAG reporting is only as good as the project manager's assessment", z ostrzeżeniem o „optimism bias… natural tendency to report everything as green". Kolory rozszerzone: „Blue: Project closed". | [rebelsguidetopm.com](https://rebelsguidetopm.com/understanding-rag-in-project-management/) | **RAG = sąd człowieka w ramach progów ustalonych przez PMO**, nie automat. Ale progi muszą być zapisane i widoczne. | Automat wyliczający RAG bez możliwości nadpisania przez właściciela inicjatywy (i odwrotnie: nadpisanie bez uzasadnienia). |
| **Asana — jedyny z prawdziwym rytuałem statusowym** | Cytat rozstrzygający: „Status updates are intended to be a snapshot of a project's status at a moment in time. **As such the data is frozen at the time of publishing.** This includes things like project name, custom fields, task names, due dates, and assignees" — „if a task name or due date changes after publishing, the appearance of the task in the update will **stay the same**". Kolory: „on track, at risk, off track, on hold, complete, or dropped", wybierane **ręcznie**. Rytm wymuszony systemowo: „Each project's owner will receive a **weekly task each Thursday** to update the status of their project **due Friday**". Portfele: te same kolory + licznik projektów, z wymogiem „at least one block of text". Eksport **PowerPoint** (Enterprise): „automatically creates slides containing your portfolio lists, status updates, and milestones". | [help.asana.com — project status updates](https://help.asana.com/s/article/project-progress-and-status-updates) · [portfolio reporting](https://help.asana.com/s/article/portfolio-progress-and-reporting) · [PowerPoint export](https://help.asana.com/s/article/portfolio-powerpoint-export) | **Zamrożenie dosłowne: nazwy zadań i terminy w raporcie zostają takie, jakie były w dniu publikacji.** Plus **rytm jako zadanie w systemie** (czwartek przypomnienie, piątek termin) — to jest kadencja z metodyki A1 pkt 2, zaimplementowana. | Pułapka prywatności wprost z dokumentacji: „Anyone who is added as a collaborator on a status update will be able to see **the entire contents of the report, even if they don't have access to the underlying project**". |
| **Wrike — status ręczny i zdrowie liczone to dwie różne rzeczy** | Status projektu (ręczny): `New, In Progress, Completed, On Hold, Cancelled`. **Project Health** (liczony) miał jawne reguły: zielony „isn't overdue and has zero risks", bursztyn „isn't overdue but has **at least one** risk", czerwony „**is overdue or has all risks**", **szary** dla Cancelled/Completed/On Hold **lub braku dat**. Ryzyka: zadanie przeterminowane, zadanie z terminem po dacie końca projektu, „The project has a **deviation of over 25 %**". Ale: „**AI estimations have replaced the previous system of Project Health calculations**". Raporty żywe („Each time you open or refresh your report, it automatically updates"), migawka osobno: „**Snapshots are static; they don't automatically update**". | [Project Status](https://help.wrike.com/hc/en-us/articles/1500005217622-Project-Status) · [Project Health](https://help.wrike.com/hc/en-us/articles/1500005217682-Project-Health) · [AI Risk Prediction](https://help.wrike.com/hc/en-us/articles/360055046934-AI-Project-Risk-Prediction) · [Reports](https://help.wrike.com/hc/en-us/articles/209604449-Reports-in-Wrike) | **★ Szary = brak dat.** To jedyne zmierzone potwierdzenie, że czwarty kolor oznacza „nie da się ocenić" — dokładnie to, o co chodzi w metodyce A1 pkt 8. I reguła progu: **odchylenie > 25 %**. | Podmiana jawnych reguł na model uczenia maszynowego — sponsor pyta „dlaczego czerwone", a odpowiedź brzmi „bo model tak uznał". Dla doradztwa to nie do obrony. |
| **Kantata** | Dwa silniki: Analytics „**real-time** reporting data", ale „**Insights dashboards refresh on a half-hour basis. Every 30 minutes, the system takes a snapshot of your data**", historia 48 odświeżeń. Prawdziwe zamrożenie: **Project Snapshots** — pierwszy zrzut zostaje baseline'em, zapisuje per zadanie Start date, Due date, Status, % Done, Scheduled hours i **godziny per zasób**; do 50 na projekt; „**Snapshots cannot be deleted**". Wysyłka cykliczna: „The dashboard is sent as a **PDF attachment**", raporty jako „CSV or XLSX attachment", plus **KPI alerts** i zabezpieczenie: „If you add a recipient that does **not** have access… the user will **not** receive an email". | [Snapshots & Baselines](https://knowledge.kantata.com/hc/en-us/articles/20367538592667-Project-Snapshots-and-Baselines-Overview) · [Insights Overview](https://knowledge.kantata.com/hc/en-us/articles/16358764478619-Insights-Overview) · [Scheduled emails](https://knowledge.kantata.com/hc/en-us/articles/12008793655195-Schedule-Dynamic-Dashboard-Emails-Report-Exports-and-KPI-Alerts) | **Migawka nieusuwalna** + **kontrola uprawnień przy wysyłce** („nie ma dostępu → nie dostanie maila"). To drugie jest bezpiecznikiem, o którym łatwo zapomnieć. | „Half-hour refresh" nazywane dashboardem — użytkownik myśli, że patrzy na żywe dane, a patrzy na dane sprzed 29 minut. Jeśli nie na żywo, trzeba napisać „stan na godz. X". |
| **Teamwork** | Najczystsze rozróżnienie w całym audycie: ekran = bieżące, wysyłka = migawka — „Scheduled reports send a **report snapshot** by email", a zakresy dat są względne i przeliczane: „the report **recalculates the actual dates each time it's sent**". Harmonogram „day, week, month, or custom interval", formaty „**CSV, Excel, PDF**". RAG ręczny: „The current health status of the project will be shown **if set**", a „Site administrators can **customize the corresponding text labels**". Wskaźniki obiektywne (liczba spóźnionych zadań, % budżetu, % ukończenia) stoją **obok** kolorka, nie napędzają go. | [Reports FAQ](https://support.teamwork.com/projects/reports/reports-faq) · [Scheduling reports](https://support.teamwork.com/projects/reports/scheduling-reports) · [Setting project health](https://support.teamwork.com/projects/project-options/setting-project-health) | **„Ekran żywy, mail zamrożony" jako jedna zasada produktu** — użytkownik nigdy nie musi pytać, na co patrzy. | Kolor ręczny stojący obok twardych liczb, które mu przeczą. Trzeba albo policzyć, albo zażądać uzasadnienia przy rozjeździe. |
| **Celoxis** | Jedyny z jawnym snapshotem wysyłanym cyklicznie: „Administrators can **schedule reports to be emailed** to specific users at regular intervals", „the resulting **PDF** will be emailed". Ale ograniczenia twarde: „**Only administrators** can schedule reports", „There is a limit of **10 scheduled reports per organization**". | [celoxis.com — scheduling](https://www.celoxis.com/kb/15.1/reports/concepts/scheduling) | Harmonogram wysyłki jako funkcja pierwszej klasy. | Limit 10 na całą organizację i tylko administrator — dla PMO z 30 inicjatywami to za mało. |
| **monday.com** | RAG **i ręczny, i liczony jednocześnie**: health ustawiany w „three categories: Off Track, At Risk, and On Track", ale jest też „Automatic project status integration… **if more than 50 % of tasks are marked as stuck, the project's health will automatically change to At Risk**". Dystrybucja: **zaplanowany eksport PDF** dziennie/tygodniowo/miesięcznie do 50 odbiorców (limity harmonogramów: Standard 1 / Pro 5 / Enterprise 100), z twardym ograniczeniem: „Dashboards can only be shared with users who have a monday.com account. To share with external stakeholders, **use the PDF export option**". | [Project boards](https://support.monday.com/hc/en-us/articles/22598441769746-Project-boards-on-monday-com) · [Share and present your Dashboard](https://support.monday.com/hc/en-us/articles/26237863849490-Share-and-present-your-Dashboard) | **Jawny próg automatu: „ponad 50 % zadań zablokowanych → At Risk".** Konkretna liczba, którą da się zakwestionować i zmienić. | Ostrzeżenie bezpieczeństwa wprost z ich dokumentacji przy publicznych widokach: „**filtered data (items and columns) can still be accessed** through the shared views by technical savvy users although it is hidden". Ukrycie kolumny to nie jest kontrola dostępu. |
| **Microsoft Project (desktop)** | Raporty są **żywe, nie migawkowe**: „As you work on the project, the reports change to reflect the latest info — **no manual updates required**"; dystrybucja przez „Copy Report" i wklejenie. Katalog: Project Overview, Cost Overview, **Burndown**, Work Overview, Overallocated Resources, Cash Flow, **Earned Value Report**, Critical Tasks, **Late Tasks**, Milestone Report, **Slipping Tasks**. | [support.microsoft.com — create a project report](https://support.microsoft.com/en-us/office/create-a-project-report-6e74dc79-0e2d-480b-b600-3a466bf289a3) · [pick the right report](https://support.microsoft.com/en-us/office/pick-the-right-report-in-project-61324235-aaec-4eef-acab-4c5245fedaeb) | **Katalog raportów nazwany pytaniami, nie modułami**: „Late Tasks", „Slipping Tasks", „Overallocated Resources". Nasze 11 definicji ma tę samą własność — dobrze. | Brak migawki w desktopie. Uwaga rynkowa: „**Microsoft Project Online will be retired on September 30, 2026**" ([źródło](https://learn.microsoft.com/en-us/projectonline/project-features-descriptions)) — to zwalnia miejsce na rynku. |
| **Smartsheet** | Wszystko żywe: opublikowany dashboard „automatically refreshes **once every 10 minutes**". **Obiektu „raport statusu" jako datowanego wpisu nie ma w ogóle.** Jedyne zamrożenie to zaplanowany e-mail z PDF/Excel albo ten jedyny baseline. | [publishing items](https://help.smartsheet.com/articles/522078-publishing-smartsheet-items) · [sending sheets via email](https://help.smartsheet.com/articles/504773-sending-sheets-rows-via-email) | — | **Jedyna automatycznie liczona liczba zdrowia harmonogramu w całym produkcie to `Variance` z baseline'u.** Symbole RYG są ręczne. Nie budować kokpitu na ręcznych symbolach. |
| **ServiceNow SPM — dwa modele obok siebie** | Klasyczny raport statusu jest **zamrożony**: „preserves the status… **for the date and time when generated**"; zawiera kolorowe wskaźniki **overall / schedule / cost / resources / scope**, pozycje RIDAC, kamienie, koszty plan vs faktyczne, godziny przydzielone vs faktyczne. **Historia maksymalnie 9 wpisów.** Nowy raport w Project Workspace jest **hybrydą**: „snapshot in time", ale „**dynamic content gets updated automatically**"; stany Draft/Published, domyślnie tylko do odczytu, **eksport do PDF**. | [Project status report](https://www.servicenow.com/docs/bundle/zurich-it-business-management/page/product/project-management/task/project-status-report.html) · [Create a status report in Project Workspace](https://www.servicenow.com/docs/r/it-business-management/project-workspace/create-a-status-report-in-project-workspace.html) | **Pięć osobnych świateł: całość, harmonogram, koszt, zasoby, zakres.** To jest najbogatszy zmierzony zestaw — i pokazuje, że jedno światło to za mało. | **Hybryda „migawka, ale treść się aktualizuje" to najgorszy z możliwych wyborów** — nikt nie wie, na co patrzy. Oraz limit 9 wpisów historii: po dziewięciu przeglądach komitetu tracisz najstarszy. |
| **Jira Align** | Pokoje wg audytorium: **Portfolio Room** (finanse/zasoby/wykonanie), **Program Room** (obciążenie zespołów, prognoza vs pojemność, checklista PI), **Team Room**, **Strategy Room**. Zasadniczo **żywe**, nie migawki. RAG jest **jawnie subiektywny** — status i „health" to „**opinion of the epic owner**"; stoplight zlicza ręczne oceny, a **niebieski oznacza brak oceny**. Eksport: Excel, CSV, roadmapa jako PNG/CSV (**tylko poziom najwyższy**); **PDF natywnie — nie znalazłem**. | [Portfolio room](https://help.jiraalign.com/hc/en-us/articles/115000095234-Portfolio-room) · [Status report — status view](https://help.jiraalign.com/hc/en-us/articles/115004662507-Status-report-status-view) · [Download roadmaps](https://help.jiraalign.com/hc/en-us/articles/231223907-Download-roadmaps-as-image-or-CSV-files) | **„Pokój" per audytorium** zamiast jednego kokpitu z filtrami — to jest ten sam pomysł, co nasze cztery poziomy raportów. Oraz **niebieski = brak oceny** (drugie potwierdzenie czwartego koloru na „nie wiem"). | Brak eksportu do PDF w produkcie dla dużych organizacji — komitet dostaje zrzut ekranu. |
| **Jira Plans** | Dashboardy **żywe**, bez migawek. Eksport: **CSV** (tylko z osi czasu), **PNG**, osadzenie w Confluence; **PDF i PPT — brak**. Warstwa dla zarządu jest **osobnym produktem** (Atlassian Focus). | [Share and export your plan](https://support.atlassian.com/jira-software-cloud/docs/share-and-export-your-advanced-roadmaps-plan/) | — | Brak jakiejkolwiek migawki — nie odtworzysz, co widziano. |
| **Broadcom Clarity — cztery różne mechaniki obok siebie** | (1) **Raport statusu = zamrożony obiekt**: Report Date, Report Status Draft/Final, Overall Status On Track / Needs Help / At Risk, publikacja PDF, kopiowanie wartości z poprzedniego raportu. (2) **Portfel = migawka odświeżana zadaniem** „Synchronize Portfolio Investments" (ręcznie, tygodniowo lub miesięcznie). (3) **Raportowanie zaawansowane = hurtownia D-1** („Load Data Warehouse job **only once every day**"). (4) **Canvas = kokpit na żywo** (maks. 7 tabel / 10 widżetów). RAG mieszany: „Overall Status **computed field, derived from** Schedule/Scope/Cost and Effort Status", **ale składowe wpisuje kierownik**, a **szary oznacza brak raportu statusu**. | [Portfolio management](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-4-2/Using-Classic-Clarity-PPM/portfolio-management.html) · [Advanced reporting](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-2-1/advanced-reporting-with-jaspersoft.html) · [Project Status Summary](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-4-2/advanced-reporting-with-jaspersoft/pmo-accelerator-advanced-reporting-content/project-management-reports/project-status-summary.html) | **★ „Overall wyprowadzany z trzech semaforów, które wpisuje człowiek"** — kompromis między automatem a sądem. Plus **szary = brak raportu**, czyli czwarty kolor na „nie wiem". | **Cztery mechaniki świeżości danych w jednym produkcie** (na żywo / migawka / D-1 / kokpit) bez jednolitego oznaczenia „stan na". Użytkownik nie ma szans zorientować się, na co patrzy. |
| **Planview Portfolios** | Raport statusu **WRK16** to jedna strona na projekt: streszczenie dla zarządu + strona per projekt, historia atrybutu (do 4 trendów RAG), do 9 wskaźników RAG, tabela harmonogramu z wariancją do baseline'u, pole „Reporting Period"; **działa na danych bieżących** („real-time" z bazy transakcyjnej), eksport **PDF/Word**, limit 100 projektów. Migawka jest osobno — przez historię atrybutów albo **płatną usługę „Snapshotter"** (wątek forum). RAG: **ręczny atrybut oceny** plus raporty liczone. | [WRK16 — Project (and Portfolio) Status Report](https://success.planview.com/Planview_Portfolios/Analytics_and_Reporting/FastTrack_Analytics/Work_and_Project_Analytics/WRK16_-_Project_(and_Portfolio)_Status_Report) · [wątek o migawkach (forum, źródło słabsze)](https://community.planview.com/ask-the-community-67/creating-a-point-in-time-snapshot-of-project-assessment-in-portfolios-678) | **Historia atrybutu RAG jako trend na raporcie** (widać, czy było zielone trzy przeglądy temu). Oraz „jedna strona na projekt" jako format dla komitetu. | **Migawka punktu w czasie jest płatną usługą, nie funkcją.** Produkt za setki tysięcy nie odpowiada na pytanie „co wiedzieliśmy trzy tygodnie temu" bez dokupienia usługi. |
| **Planview AdaptiveWork** | **Obiektu „raport statusu" z okresem nie ma.** Raportowanie statusu robi się dodatkami: **Slide Publisher** (PowerPoint; limity 100 slajdów i 25 wierszy tabeli), **Periodic Project Report** (Word/PDF), **Project Highlight Report**, Document Publisher. Raporty domyślnie **na żywo**, migawka opcjonalna („save a report's output every time the report is generated"). Osobno **Project Version Snapshots** (retencja 2 lata, **bez WBS i zależności**, brak migawki programu i portfela). **Licencja Professional = zero harmonogramowania raportów.** | [Slide Publisher](https://success.planview.com/Planview_AdaptiveWork/Integrations/Add-ins%2F%2FApps/Slide_Publisher/01._Slide_Publisher_Introduction) · [Project Version Snapshots](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Project_Version_Snapshots) · [Reports and dashboards overview](https://success.planview.com/Planview_AdaptiveWork/Reporting/Reports_and_Dashboards/Reports_and_Dashboards_Overview) | Migawka jako **opcja przy generowaniu raportu** („zapisz wynik za każdym razem") — tania w implementacji. | Raport statusu rozproszony po czterech dodatkach zamiast jednego obiektu. To jest dokładnie to, czego nie chcemy powtórzyć — u nas 11 definicji ma być **jednym** mechanizmem. |
| **Planisware** | **Nie zmierzyłem.** | — | — | — |

**Wniosek dla Consultify (pytanie 4).** Rynek jednoznacznie traktuje **raport statusu jako
zamrożony rekord z cyklem życia** (Clarity: Draft → Final → Latest; WORKSPACE.PM: draft →
submitted → approved → zablokowany; Asana: „frozen at the time of publishing"; Kantata:
snapshoty nieusuwalne), a **kokpit jako rzecz żywą**. Falcon i Teamwork mówią to wprost:
„report **live or in fixed cycles**" / „ekran bieżący, wysyłka = snapshot". Metodyka z 1_12
(A2, wiersz „Migawka raportu") **zgadza się z rynkiem**.

Dwa ustalenia, które korygują metodykę:

- **★ Czwarty kolor na „nie da się ocenić" ma TRZY potwierdzenia rynkowe, a jedno jest
  dosłowne.** **Broadcom Clarity**: `Green/Yellow/Red/**Gray**`, gdzie szary oznacza **brak
  raportu statusu**, a dokumentacja mówi wprost: „**At least one status report must be
  completed… for the indicators to calculate**"
  ([źródło](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-4-2/advanced-reporting-with-jaspersoft/pmo-accelerator-advanced-reporting-content/project-management-reports/project-status-summary.html)).
  **Wrike**: szary dla projektów bez dat lub zamkniętych. **Jira Align**: niebieski
  w stopliczcie = brak oceny. Popularne kompendia opisują szary inaczej, jako „nierozpoczęty"
  ([portfoliohub](https://portfoliohub.io/blog/rag-status)) — ale trzej producenci
  enterprise'owi mówią to samo co metodyka. **Metodyka 1_12 A1 pkt 8 jest więc zgodna
  z rynkiem enterprise**, tylko nie z popularnymi poradnikami. Nadal trzeba to nazwać
  w interfejsie etykietą „czego brakuje" — sam kolor nie wystarczy.
- **Kolor prawie zawsze wybiera człowiek.** Liczone RAG mają tylko: Celoxis (reguły
  prognozy), ServiceNow (status zadania z bliskości terminu, nadpisywalny), Wrike (do czasu
  podmiany na model uczenia maszynowego), monday (próg 50 % zablokowanych), Kantata
  (Pace / Execution / Resource Health), Jira Align (progi postępu, kolory Program Board).
  Wszędzie indziej to sąd właściciela projektu — Jira Align mówi wprost, że health to
  „**opinion of the epic owner**". Rekomendacja: **licz i pokazuj propozycję, ale pozwól
  nadpisać z obowiązkowym uzasadnieniem** — bo „optimism bias" jest udokumentowany
  ([rebelsguidetopm](https://rebelsguidetopm.com/understanding-rag-in-project-management/)),
  a wzorzec „liczone + nadpisywalne" ma gotową realizację w ServiceNow.

---

# 3. Wzorce wspólne — „tak robi 80 % rynku"

Piętnaście wzorców, każdy z przykładami. Przy każdym zaznaczam, czy metodyka z 1_12 część A
się **zgadza**, czy rynek robi **inaczej**.

| # | Wzorzec | Kto tak robi | Zgodność z metodyką 1_12 |
| --- | --- | --- | --- |
| 1 | **Odchylenie liczy się wyłącznie wobec zamrożonego planu, a wzór jest odejmowaniem dat.** `Finish Variance = Finish − Baseline Finish`. | MS Project (wzór dosłowny), Clarity („baselines are static"), Celoxis (Baseline Finish Variance), Smartsheet (`Variance` w dniach roboczych), Wrike (`baseline due variance`), monday (auto-kolumna formuły), Kantata (snapshoty), Teamwork (original vs current due date) | **Zgodne** (A1 pkt 6, A2 „Baseline + wariancja") |
| 2 | **Baseline jest wersjonowany, a „bieżący" to jeden konkretny.** Clarity: „the baseline you create last becomes the current". MS Project: 11 linii. Celoxis: 6. Kantata: do 50, **nieusuwalne**. | Clarity, MS Project, Celoxis, Kantata, Wrike, monday | **Zgodne**, ale metodyka mówi o `baselineVersion` bez reguły „który jest bieżący" — trzeba dopisać |
| 3 | **Alokacja to zakres dat + intensywność, NIE siatka osoba × tydzień.** Siatka jest wyliczana do prezentacji. | Float (`start_date, end_date, hours/dzień`), Forecast (7 wartości minutowych), Runn (effort/dzień), Kantata (`minutes` na zakres + `percentage`), Teamwork Schedule | **Rynek robi INACZEJ** niż sugeruje plan C2 („osoba × tydzień" jako kolumny tabeli) — to ma być widok, nie model danych |
| 4 | **Popyt planowany (alokacja) i przypisania zadań to dwa różne byty; nigdy się ich nie sumuje.** Reguła rozstrzygania: **większa z dwóch liczb**. | Clarity (Allocations vs Assignments, „many organizations manage staffing through Task Assignment Estimates **rather than** using Allocations"), Kantata („allocated hours are a precursor to scheduled hours"), Forecast Combined Mode („**whichever is greater**"), Wrike („**use the one that's bigger**") | **Metodyka milczy** — to jest luka do domknięcia decyzją |
| 5 | **Podaż = godziny kontraktowe minus urlopy i święta.** Nigdy „40 h na sztywno". | Runn („Contracted capacity − Time off = Effective capacity"), Float („daily work hours × workdays" minus urlopy), Kantata („excluding time off and holidays"), Forecast („Working hours − Time off"), Teamwork („total working hours − unavailable time"), Meisterplan („1 FTE equals 40 hours" jako **domyślna**, nie jedyna) | **Zgodne** (A2 „Zasoby"), ale trzeba dopisać nieobecności |
| 6 | **Pojemność jest definiowana per dzień tygodnia, nie per tydzień.** Ktoś pracujący 4 dni po 8 h ma 32 h, nie 40. | ClickUp („Weekly capacity is the total of a person's working days, **not a fixed five-day week**"), Float (godziny per dzień + nadpisanie per osoba), Forecast (`monday`…`sunday` w minutach), Teamwork („8 hours on Monday, 6 hours on Tuesday"), Kantata (`Workweek` z siedmioma polami) | **Rynek jest DALEJ** niż metodyka (która mówi „etat × dostępność %") |
| 7 | **Rola/placeholder jako pełnoprawny nośnik popytu, zanim znane jest nazwisko.** | Meisterplan („Consultant - Junior with 5 FTE"), Kantata (unnamed resource → Resource Request → zatwierdzenie → „the named resource **replaces** the unnamed resource"), Runn („Placeholders represent demand… **their hours stay as planned**"), Float, Smartsheet RM, Teamwork, monday Enterprise | **Metodyka wspomina role, ale nie placeholdery** — dla doradztwa to jest podstawa |
| 8 | **Popyt pewny i wstępny to dwie osobne liczby, a wstępny NIE blokuje pewnego.** | Runn (Confirmed vs Tentative Workload), Float (`status` 1/2, „Draft, Tentative, Confirmed, Completed, Canceled"), Forecast (soft/hard + **ważenie szansą wygranej**: „40 h × 50 % = 20 h adjusted demand"), Kantata (hard = „solid bar", soft = „striped bar"), Teamwork (tentative projects), Clarity (soft = „tentatively scheduled", hard = „committed") | **Metodyka milczy** — a dla portfela inicjatyw niezatwierdzonych to krytyczne |
| 9 | **Przeciążenie pokazywane kolorem i wysokością, z progiem jako ustawieniem.** | Meisterplan (75 % / 100 %, konfigurowalne, niebieski/czerwony), Forecast (≤92 / 93–106 / ≥107 %), Runn (0–80 / 80–100 / 100–160 %+), Clarity („red color cell with **increased height**", „red dot"), Kantata (różowy + nasycenie), Float (czerwone tło = nadgodziny), Wrike, Asana (czerwona linia), monday, Teamwork | **Zgodne** (A2 „mapa cieplna"), dopisać: progi konfigurowalne |
| 10 | **Zaległa praca nie ma dobrego rozwiązania nigdzie — są trzy złe.** (a) ląduje na „dziś" i produkuje absurdy; (b) wygasa bez śladu; (c) zostaje w przeszłości i znika z obrazu. Przesunięcie jest wszędzie jawną operacją człowieka. | (a) **Planview AdaptiveWork** („reflected on Today"), Planview Portfolios przy `Respect Durations`; (b) **Planview Portfolios** domyślnie („effort… will be expired"); (c) Runn, Float, Kantata, Forecast, Smartsheet, ServiceNow, Clarity. Operacje przesunięcia: MS Project `pjReschedule`, Planview Update Forecast, Float „Shift timeline" | **Metodyka milczy** — a to jest źródło naszego 853 % **i jednocześnie największa luka rynku** |
| 11 | **Rejestr ryzyk ma ocenę złożoną i dwa plany.** Prawdopodobieństwo × wpływ = ekspozycja; osobno plan zaradczy i awaryjny. | MS Project Online (Probability, Impact, **Exposure**, Mitigation Plan, Contingency Plan, Trigger, **Due Date**), Planview AdaptiveWork (`RiskRate = Impact × %Probability`, pole liczone, plus TriggerDate, MitigationPlan, ContingencyPlan), Teamwork (skala 1–9, obszary koszt/harmonogram/wykonanie) | **Zgodne** (A2 „RAID: typ · tytuł · właściciel · termin · ocena") |
| 12 | **Rejestr decyzji jako typ obiektu ma 2 z 18 produktów.** Żaden nie ma pola „decyzja potrzebna do dnia". | ServiceNow (RIDAC), Planview AdaptiveWork (Meeting Notes → Decisions, publikacja blokuje edycję). Namiastki: Jira Align (Escalation), Forecast (nieusuwalna historia statusu), Planview Portfolios (Logbook). Szablony branżowe: brak terminu | **Metodyka jest PRZED rynkiem** co do terminu; co do struktury mamy dwa wzorce do skopiowania |
| 13 | **Raport statusu = zamrożony rekord z cyklem życia; kokpit = rzecz żywa.** | Clarity (Draft → Final → **Latest**), WORKSPACE.PM (draft → submitted → approved → **zablokowany**), Asana („**frozen at the time of publishing**"), Kantata (snapshoty **nieusuwalne**), Teamwork („ekran bieżący, wysyłka = snapshot"), Falcon („live **or** in fixed cycles"), Celoxis (harmonogram PDF na maila) | **Zgodne** (A2 „Migawka raportu") |
| 14 | **Kolor RAG wybiera człowiek, w ramach progów ustalonych przez PMO.** Automat jest wyjątkiem. | Ręczny: Asana, Teamwork, Kantata, Forecast, Smartsheet, Clarity. Liczony: Celoxis (prognoza), Wrike (do podmiany na model), monday (>50 % zablokowanych), Kantata Insights. Progi jako liczby: „within 2 weeks of baseline" / „2 to 6 weeks" / „>6 weeks"; koszt 5 % / 5–10 % / >10 % | **Zgodne** z zastrzeżeniem: metodyka nie mówi, kto ustala progi |
| 15 | **Rytm jest wpisany w narzędzie jako zadanie, nie jako zalecenie.** | Asana („weekly task **each Thursday**… **due Friday**"), Kantata („only **one** New Health Report can be created per day"), Celoxis (harmonogram wysyłki), Meisterplan (Plan of Record vs scenariusze) | **Zgodne** (A1 pkt 2, A2 „Rytm"), ale metodyka mówi tylko o dacie „stan na" — brakuje **zadania przypominającego** |

**Trzy wzorce, w których rynek robi INACZEJ niż nasz plan C2** (do rozstrzygnięcia przez
właściciela): #3 (model danych alokacji), #4 (dwa źródła popytu i reguła większej liczby),
#10 (co się dzieje z zaległością).

---

# 4. Minimalna forma dla Consultify — per zakładka

Zasada nadrzędna, wyprowadzona z audytu: **wąska tabela + jedna liczba, która się liczy sama
+ jedna akcja w wierszu.** Wrike, najbardziej PMO-wy produkt klasy work management, ma
domyślnie sześć kolumn. Nie budujemy szerszych.

## 4.1 Zakładka „Praca"

| Element | MVP | Fala 2 | Wzorzec rynkowy |
| --- | --- | --- | --- |
| **Kolumny** | Zadanie · Inicjatywa · Osoba · Termin · Status · **Poślizg (dni)** | + Kamień · Pracochłonność (h) · Zablokowane przez | Wrike: 6 kolumn domyślnych; Clarity: „Name, % Complete, ETC" + atrybuty inwestycji |
| **Poślizg — definicja** | `poślizg = data_aktualna_końca − data_bazowa_końca`, w **dniach roboczych kalendarza inicjatywy**. Gdy brak baseline'u: puste, nie zero. | + wariant prognozy (Celoxis) | MS Project: `Finish Variance = Finish − Baseline Finish`; Smartsheet: „in **decimal days** according to the **working schedule** defined for your project" |
| **Po terminie** | osobna kolumna/chip `dni po terminie = dziś − termin` (tylko dla niezakończonych); **nie mylić z poślizgiem** | | Teamwork: „If the task status is **incomplete**, the variance is the difference between the original due date and current due date. If **complete** — the difference between the original due date and **the date it was completed**" |
| **★ Gdy baseline'u NIE MA** (nasza sytuacja na starcie) | **nie pokazuj zera** — pokaż stan wyliczony z tempa: zielony gdy faktyczne % ukończenia jest mniej niż 10 punktów poniżej oczekiwanego na dziś; bursztyn gdy ≥10 punktów poniżej; **czerwony gdy termin minął, a ukończenie < 100 %** | zamiana na wariancję dat po pierwszym baseline'ie | **Planview AdaptiveWork Scheduling Status** — reguła działa bez baseline'u. Kontrprzykład: **Planview Portfolios** wrzuca projekt bez baseline'u do pasma „0 %", czyli **na zielono** — fałszywa zieleń. **Clarity** robi to najuczciwiej: bez baseline'u wskaźniki **w ogóle się nie pokazują** |
| **Akcje w wierszu** | zmiana osoby, terminu i statusu **w wierszu** (podwójny klik) + panel podglądu | + przeciąganie na osi | Clarity: „Edit Data in the grid by using the right-click option"; Wrike: „**Double-click any field to edit its data**" |
| **Menu 3 (chipy)** | Wszystkie · Po terminie · Zablokowane | + Moje | kanon Consultify ≤3 |
| **Czego NIE robić** | kolumny „SLA" (zawsze pusta) · kolumny „% ukończenia" jako miary zdrowia · 11 presetów | | Celoxis pokazuje, że `% Done` bywa liczone na trzy różne sposoby — jako miara zdrowia jest bezwartościowe |

**Zgodność z 1_12 C2:** plan przewiduje dokładnie te sześć kolumn. **Zgadza się z rynkiem.**
Jedyna poprawka: rozdzielić „Poślizg" (wobec baseline'u) od „Dni po terminie" (wobec dziś) —
to są dwie różne liczby i mylenie ich jest najczęstszym błędem.

## 4.2 Zakładka „Zasoby"

**Decyzja architektoniczna do podjęcia przez właściciela — bez niej nie da się tego zbudować:**

> **Skąd bierze się popyt: z alokacji (osobny obiekt) czy z zadań?**
> Rekomendacja CTO: **z alokacji**, bo tak robi cała klasa produktów dla firm doradczych
> (Clarity, Kantata, Runn, Float, Forecast, Meisterplan). Zadania zostają miarą wykonania,
> nie planu. Gdyby jednak oba miały istnieć — reguła rynkowa brzmi **„większa z dwóch"**,
> nigdy suma.

| Element | MVP | Fala 2 | Wzorzec rynkowy |
| --- | --- | --- | --- |
| **Model danych** | alokacja = `osoba_lub_rola · inicjatywa · data_od · data_do · godzin_na_dzień · pewna/wstępna` | + siedem wartości per dzień tygodnia; + placeholder roli | Float (`start_date, end_date, hours, status`); Forecast (`monday`…`sunday` w minutach) |
| **Kolumny tabeli** | Osoba/Rola · Tydzień · **Podaż (h)** · **Popyt (h)** · **Obłożenie %** · **Zaległość (h)** | + Luka (h) · Pewne/wstępne rozbite | Meisterplan: zasób × okres, jednostka konfigurowalna |
| **Obłożenie — definicja** | `obłożenie % = popyt planowany w tygodniu ÷ podaż tygodnia × 100`, gdzie `podaż = godziny robocze wg profilu osoby − urlopy i święta w tym tygodniu` | + przełącznik mianownika (pojemność vs zaplanowane) | Float: „(Total number of scheduled work hours / Total number of available work hours **in the same date range**) × 100"; Runn: „Contracted capacity − Time off = Effective capacity"; Teamwork: „available time = total working hours − unavailable time" |
| **★ Zaległość** | **osobna kolumna**: suma godzin z zadań/alokacji, których okno już minęło, a praca nie została zamknięta. **NIE wchodzi do popytu bieżącego tygodnia.** Klik w liczbę → lista pozycji → trzy akcje: **przenieś na wskazany tydzień · uznaj za zamknięte · zmniejsz zakres** | + automatyczna propozycja przeniesienia | **Nikt na rynku tego nie ma.** Kantata musi to sprzątać automatyzacją Enterprise, Forecast tylko ręcznym zamknięciem sprintu. Wzorzec operacji: MS Project „Update Project → reschedule uncompleted work to start after ‹data›" |
| **Podaż — źródło** | jedna liczba na osobę: **godziny per dzień tygodnia** (domyślnie 8×5 = 40), edytowalna; minus nieobecności | + kalendarz świąt, niepełny etat jako profil | ClickUp: „Weekly capacity is the total of a person's **working days**, not a fixed five-day week"; Float: „set custom workdays and hours for individual team members" |
| **Progi** | konfigurowalne, domyślnie: <75 % niedociążenie (niebieski), 75–100 % w normie (zielony), >100 % przeciążenie (czerwony) | + pasmo „ostrzegawcze" 93–106 % | Meisterplan 75/100; Forecast 92/106; Runn 80/100 |
| **Rozwiązanie konfliktu** | zmiana terminu, zmiana osoby, zmniejszenie alokacji — **w wierszu** | + przeciąganie z histogramu | Clarity: „drag-and-drop reallocation from the Resource Histogram to the Investment Timeline" |
| **Czego NIE robić** | doliczać zaległości do bieżącego tygodnia · trzymać „40 h" jako stałą globalną · sumować alokacji i zadań · dawać czterech jednostek naraz | | patrz §5 |

**Zgodność z 1_12 C2:** plan przewiduje kolumny „Osoba/rola · Tydzień · Popyt (h) · Podaż (h)
· Obłożenie % · Luka" — **prawie dobrze**. Trzy poprawki: (a) dołożyć **Zaległość** jako
siódmą kolumnę; (b) rozstrzygnąć, że popyt bierze się z alokacji, nie z zadań; (c) podaż
liczyć per dzień tygodnia, nie „etat × dostępność %".

Odpowiedź na **pytanie 2 z C5** („skąd podaż godzin"): rekomendacja CTO potwierdzona rynkiem —
**godziny per dzień tygodnia w profilu osoby, minus nieobecności**. To jest dokładnie to, co
robią Float, ClickUp, Teamwork, Kantata i Forecast. „Etat 40 h × dostępność %" to uproszczenie,
które przy pierwszym niepełnym etacie lub urlopie da fałsz.

## 4.3 Zakładka „Decyzje i ryzyka"

**To jest zakładka, w której możemy być lepsi od rynku** — bo tylko 2 z 18 produktów mają
rejestr decyzji, a **żaden nie ma terminu decyzji**. Strukturę bierzemy od nich, termin
i licznik „nie zapadło na czas" dokładamy sami.

| Element | MVP | Fala 2 | Wzorzec rynkowy |
| --- | --- | --- | --- |
| **Kolumny (decyzje)** | Tytuł · **Potrzebna do dnia** · Decydent · Status · **Dni po terminie** · Poziom eskalacji | + Co blokuje · Wariantów rozważanych | pole „potrzebna do dnia" — **brak na rynku**; reszta z MS Project (`Due Date` na ryzyku) i Techno-PM |
| **Status decyzji** | Oczekuje · **Rozstrzygnięta** · **Odrzucona** · **Nieaktualna** | + Do poprawy | Asana: „Approved / Changes requested / Rejected"; Techno-PM: „Approved, Pending, Declined, **Abandoned** — can be used when the decision is not required anymore" |
| **Rozstrzygnięcie w UI** | jedno kliknięcie w wierszu → trzy przyciski (Rozstrzygnij / Odrzuć / Nieaktualna) → **obowiązkowe pole uzasadnienia** → wpis nieusuwalny | + powiadomienie do wnioskodawcy | Forecast: „It is **not possible to delete** a status entry… resolve by **adding a new entry**"; Kantata: jeden wpis dziennie, nieedytowalny po dniu |
| **Eskalacja** | trzy poziomy (właściciel inicjatywy → PMO → komitet), automat: **codziennie o północy** — termin minął i status nadal „Oczekuje" → podnieś poziom i powiadom | + progi czasowe per poziom | monday: `Every day, if {due date} has passed and only if {status} is {something}, {notify} {someone}`. **Poprawka wobec rynku: nasz automat MUSI zadziałać wstecznie przy pierwszym uruchomieniu** — monday tego nie robi i dlatego istniejące zaległości nie generują nic |
| **Blokowanie** | decyzja może wskazywać zadanie/kamień, który blokuje; zadanie pokazuje chip „czeka na decyzję" | + wstrzymanie przepływu | Smartsheet: „Approval requests **pause the workflow**"; Asana: pola `Blocked by` / `Blocking` jako kolumny |
| **Kolumny (RAID)** | Tytuł · Typ (ryzyko / problem / zależność / założenie) · Właściciel · **Termin** · Prawdopodobieństwo (1–9) · Wpływ (1–9) · **Ekspozycja** · Status | + plan zaradczy i awaryjny, wyzwalacz | MS Project: Probability, Impact, **Exposure** = „the product of your Probability by Impact factors", Mitigation Plan, Contingency Plan, Trigger; Teamwork: skala 1–9 z pasmami |
| **Eskalacja RAID** | **konwersja typu z linkiem do źródła**: ryzyko → problem → wniosek o przesunięcie | + automatyczna przy przekroczeniu progu | Clarity: z ryzyka utwórz problem lub zmianę, nowy rekord ma „a **link back to the originating Risk**" |
| **Przesunięcie terminu** | wniosek o przesunięcie = **decyzja typu „re-baseline"** z zatwierdzającym, uzasadnieniem i śladem | + drugie i kolejne przesunięcie wymaga wyższego poziomu | Kantata Change Order: „require approval for **budget and due date changes**… leave an **audit trail**" |
| **Skąd bierze się decyzja** | **z modułu Spotkań**: notatka ze spotkania komitetu rodzi wiele decyzji i działań, każde z właścicielem; **publikacja notatki blokuje je do edycji** | + tworzenie decyzji bezpośrednio na inicjatywie, bez spotkania | **Planview AdaptiveWork**: Meeting Notes → wiele Decisions i Action Items, „Publish" → „**locked for editing**", Unpublish odblokowuje; decyzje można też tworzyć bez notatki na portfelu/programie/projekcie ([źródło](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Meeting_Notes%2C_Action_items_and_Decisions)) |
| **Ocena ryzyka** | `ekspozycja = wpływ × prawdopodobieństwo`, **pole liczone, tylko do odczytu** | + macierz w Fali 2 | Planview AdaptiveWork: „`RiskRate` = Impact × %Probability (**read-only, calculated**)" ([źródło](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Cases/Case_Types)); MS Project: „Exposure (the product of your Probability by Impact factors)" |

**Zgodność z 1_12:** metodyka A2 („Rejestr decyzji z terminem", „Wniosek o przesunięcie")
jest **zgodna i wyprzedza rynek**. Plan C2 utrzymuje jedną zakładkę z przełącznikiem
(DEC-426) — to jest w porządku dla MVP, ale trzeba wiedzieć, że **kolumny są różne**:
decyzja ma „potrzebna do dnia" i „decydenta", RAID ma „ekspozycję" i „właściciela".
Przełącznik zmienia zestaw kolumn, nie tylko filtr.

Odpowiedź na **pytanie 3 z C5** („czy przesunięcie ma wymagać decyzji"): rekomendacja CTO
potwierdzona — **tak**, i istnieje gotowy wzorzec (Kantata Change Order). Kompromis
„pierwsze przesunięcie swobodne" też ma oparcie: Clarity pozwala tworzyć kolejne baseline'y
bez zatwierdzenia, ale każdy zostaje w historii.

## 4.4 Zakładka „Raporty"

| Element | MVP | Fala 2 | Wzorzec rynkowy |
| --- | --- | --- | --- |
| **Model obiektu** | raport = **instancja** z polami: definicja · poziom · **stan na (data)** · autor · status | + wersje | Clarity: Report Status **Draft → Final**, atrybut **Latest** = „the most recent record where Report Status has been set to Final" |
| **Cykl życia** | Roboczy → **Opublikowany (zamrożony)**; po publikacji treść nie zmienia się nigdy | + Zatwierdzony przez sponsora | Asana: „**the data is frozen at the time of publishing**… if a task name or due date changes after publishing, the appearance… will stay the same"; WORKSPACE.PM: „Once 'approved', report values are **locked**" |
| **Cztery poziomy w MVP** | (1) Karta realizacji — właściciel inicjatywy; (2) Tygodniowy pakiet — PMO; (3) Zdrowie programu — komitet; (4) Jedna strona — zarząd | pozostałe 7 z 11 definicji | Shibumi: „different levels of detail from **different perspectives**" |
| **Formaty** | ekran + **PDF**; dla poziomu 4 dodatkowo **DOCX/PPTX** | + wysyłka cykliczna na maila | Clarity (PDF), Celoxis (harmonogram → PDF), Kantata (PDF dashboardu + CSV/XLSX), Asana (**PowerPoint** dla portfela), Falcon („PowerPoint reports **in your CI** at the touch of a button") |
| **RAG** | cztery kolory + **szary z etykietą czego brakuje**; wartość **liczona jako propozycja**, nadpisanie możliwe z obowiązkowym uzasadnieniem | + progi konfigurowalne per organizacja | Wrike: szary „for Cancelled/Completed/On Hold **or no dates**"; progi z portfoliohub (2 tyg. / 2–6 tyg. / >6 tyg.); ostrzeżenie o „optimism bias" |
| **Dwa światła zamiast jednego** | osobno **harmonogram** i osobno **efekt/wartość** | + trzecie: budżet | Falcon: lewe światło = efekty, prawe = działania; WORKSPACE.PM: „traffic-light rating for **schedule, cost and performance**"; Celoxis: S.Health i B.Health |
| **Bezpieczniki** | odbiorca bez dostępu do inicjatywy **nie dostaje** raportu; „stan na" zawsze widoczne w nagłówku | + kontrola, kto widzi szczegóły | Kantata: „If you add a recipient that does **not** have access… the user will **not** receive an email"; Asana pokazuje **odwrotną** pułapkę: współpracownik widzi całość raportu bez dostępu do projektu |
| **Czego NIE robić** | raport generowany na żądanie z bieżących danych (nie odtworzysz przeszłości) · jedno światło zbiorcze · ukrywanie kolumn zamiast kontroli dostępu | | monday ostrzega wprost: „filtered data… **can still be accessed** by technical savvy users although it is hidden" |

**Zgodność z 1_12 C3:** plan przewiduje 11 definicji, 4 w MVP, migawkę `asOf`, eksport
DOCX/PDF. **Zgadza się z rynkiem w całości.** Jedno uzupełnienie: dodać **PPTX** dla poziomu
zarządu — Falcon i Asana pokazują, że w tej klasie to jest waluta, a nasz generator z 1.6
już to potrafi.

Odpowiedź na **pytanie 4 z C5** („4 raporty czy 11"): rekomendacja CTO potwierdzona —
**cztery**. Kantata ma pięć pulpitów, Forecast cztery raporty standardowe, MS Project grupuje
kilkanaście, ale wszystkie nazwane pytaniem („Late Tasks", „Slipping Tasks", „Overallocated
Resources"). Lepiej cztery działające niż jedenaście pustych.

---

# 5. Pułapki liczbowe — co widać u liderów i jak tego uniknąć

## 5.1 „853 % obłożenia" — dwa sprostowania i wynik końcowy

**Ta sekcja przeszła w trakcie audytu dwie zmiany zdania. Zapisuję obie, bo droga do wniosku
jest tu równie ważna jak wniosek.**

**Hipoteza wyjściowa:** rynek zna pułapkę przelewania zaległości na bieżący tydzień i ma na
nią lekarstwo. → **Obalona.**

**Teza pośrednia (po zmierzeniu 9 produktów klasy PSA i work management):** nikt nie przelewa
zaległości do przodu, więc 853 % to nasz własny błąd, a rynek ma pułapkę odwrotną (zaniżanie).
→ **Też obalona**, gdy dotarłem do Planview.

**Wynik końcowy — trzy zachowania, wszystkie zmierzone:**

| Zachowanie | Kto tak robi | Skutek |
| --- | --- | --- |
| **Zaległość ląduje na „dziś"** | **Planview AdaptiveWork** (widok Remaining Effort, domyślnie): „All work items already past the due date that still have remaining effort **will be reflected on Today**". **Planview Portfolios** przy polityce `Respect Durations`: zgłoszenie użytkownika „effort is just **piling up**… **% utilization going over 300 %**" | **To jest dokładnie 853 %** — u lidera Gartnera, udokumentowane |
| **Zaległy wysiłek wygasa** | **Planview Portfolios** domyślnie (`Expire Effort and Respect Finish Dates`): „if somebody doesn't report time… their effort for that particular week **will be expired**" | Liczba jest uczciwa dla bieżącego tygodnia, ale **praca znika bez śladu** |
| **Zaległość zostaje w przeszłości** | Runn („even in the past"), Float, Kantata („from yesterday… forward"), Forecast („starting from today"), Smartsheet (ikona gaśnie na przeszłych datach), ServiceNow (dostępność per dzień, bez rolowania), Clarity (ETC zamrożone) | Bieżący tydzień **zaniżony**; zaległość niewidoczna nigdzie |

**Wniosek dla właściciela w jednym zdaniu:** 853 % to **znana, nierozwiązana choroba branży**,
a nie nasza wyłączna wpadka — z tą różnicą, że liderzy dają na nią **jawny przełącznik
polityki** ukryty w konfiguracji projektu, a my mamy jedno zachowanie wpisane w kod.

**Lekarstwo dla Consultify (i jednocześnie wyróżnik):** trzecia droga, której nie ma nikt —
**zaległość jako osobna, widoczna liczba obok popytu, nie wliczana do obłożenia tygodnia**,
z trzema jawnymi akcjami człowieka (przenieś na tydzień X / uznaj za zamknięte / zmniejsz
zakres). Składniki są gotowe na rynku, tylko nikt ich nie połączył:

- **polityka do wyboru** — Planview Portfolios (wygaś / przesuń / respektuj daty końca);
- **operacja przeplanowania** — MS Project („reschedule uncompleted work to start after ‹data›")
  i Planview „Update Forecast";
- **czego nie kopiować** — Planview AdaptiveWork: naprawa nie działa przy domyślnej polityce
  `Fixed Duration`, więc na ustawieniach fabrycznych problem jest nierozwiązywalny z interfejsu.

## 5.2 Pozostałe pułapki liczbowe, zmierzone u konkretnych producentów

| # | Pułapka | Gdzie zmierzona | Jak jej uniknąć u nas |
| --- | --- | --- | --- |
| 1 | **Podaż 40 h na sztywno.** Osoba na 4-dniowym tygodniu ma 32 h, nie 40; osoba na 3/5 etatu nie ma 40 h dostępnych. | ClickUp mówi wprost, że tak **nie** liczy: „Weekly capacity is the total of a person's **working days**, not a fixed five-day week". Teamwork o utylizacji: „A person on a three-day week doesn't have 40 available hours, and **counting them as if they do quietly deflates their rate**". | Podaż per dzień tygodnia w profilu, minus nieobecności. **Nigdy stała globalna.** |
| 2 | **Ta sama liczba różna w wierszu grupy i w wierszu osoby.** monday: FTE grupowe „is calculated using 8 hours per day and 40 hours per week… **This calculation does not account for holidays or time off**. At the individual resource level, **time off is taken into consideration**". Wiersz sumaryczny legalnie nie zgadza się z wierszami pod nim. | monday.com Enterprise resource management | Jedna definicja pojemności dla wszystkich poziomów agregacji. Suma wierszy = wiersz sumy, zawsze. |
| 3 | **Zmiana kubełka czasu psuje pojemność.** monday ostrzega: pojemność tygodniowa 5 oglądana miesięcznie staje się 20 — „**This may or may not reflect your intentions**". | monday.com Workload | Pojemność liczona z kalendarza w wybranym zakresie, nie mnożona przez liczbę kubełków. |
| 4 | **Urlop konsumujący pojemność jako praca.** Smartsheet: „**Hours scheduled as leave are treated the same as work hours**" — urlop podnosi obłożenie zamiast obniżać podaż. | Smartsheet Resource Management | Nieobecność **zmniejsza mianownik**, nie zwiększa licznika. |
| 5 | **Urlop częściowy nie działa.** Forecast: „**Partial day time-off does not reduce project allocations**, and may result in a user appearing as **overallocated**". | Forecast | Jeśli nie umiemy obsłużyć pół dnia — nie oferujmy pół dnia. Lepiej brak funkcji niż fałszywa czerwień. |
| 6 | **Placeholder bez pojemności rozwala raport.** Float: „Placeholders **do not display capacity or overtime hours in reports** — It always defaults to zero". Runn: placeholdery „**do not affect the capacity** of your business". Kantata: raport utylizacji „**does not include allocated hours**". | Float, Runn, Kantata | Popyt roli bez nazwiska pokazywać w **osobnym wierszu „nieobsadzone"**, nigdy nie mieszać z obłożeniem osób. |
| 7 | **Podwójne liczenie: alokacja + zadania.** | Clarity, Kantata, Wrike, Forecast — wszyscy rozwiązują to **regułą większej z dwóch**, nigdy sumą | Jeśli oba źródła, to `popyt = max(alokacja, suma zadań)` w danym okresie. |
| 8 | **Poślizg +210 dni z nieprzeliczonego baseline'u.** Gdy baseline nie istnieje, a kod podstawia zero lub datę utworzenia rekordu, wychodzą liczby absurdalne. Smartsheet chroni się dosłownie: `Baseline Start` „contains **'NA'** until you set a baseline"; MS Project: `Baseline Work` „contains **0 hours** until you set a baseline". | MS Project, Smartsheet | **Brak baseline'u = puste pole, nigdy zero i nigdy „dziś".** Poślizg pokazywany tylko tam, gdzie jest co odjąć. |
| 9 | **Poślizg mylony z „po terminie".** To dwie różne liczby: poślizg = wobec planu bazowego; po terminie = wobec dziś. Teamwork rozdziela je regułą zależną od statusu zadania. | Teamwork Planned vs Actual | Dwie kolumny, dwie nazwy, nigdy jedna. |
| 10 | **Dni kalendarzowe zamiast roboczych.** Smartsheet liczy `Variance` „in decimal days according to the **working schedule** defined for your project". | Smartsheet | Poślizg w dniach roboczych kalendarza inicjatywy. |
| 11 | **Prognoza liczona raz dziennie, pokazywana jako „na żywo".** Celoxis: „calculates projections **once a day** on a best effort basis". Kantata: „Insights dashboards refresh on a **half-hour** basis". | Celoxis, Kantata | Jeśli liczba nie jest świeża — napisać „stan na godz. X" przy liczbie, nie w stopce. |
| 12 | **Furtka kasująca nadzór.** Celoxis ma pole „**Always assume this project is on time and budget**". Jedno zaznaczenie i inicjatywa znika z każdego raportu ryzyka. | Celoxis | Nie budować takiej opcji. Jeśli ktoś chce wyłączyć nadzór, niech to będzie decyzja z autorem w rejestrze. |
| 13 | **Automat, który nie działa wstecznie.** monday: „the automation will run at midnight after the date has passed, the template **will not work retroactively**". Przy włączeniu na istniejących danych 12 decyzji po terminie nie wygeneruje **ani jednego** powiadomienia. | monday.com | Pierwszy przebieg musi objąć **stan zastany**, nie tylko zmiany od momentu włączenia. To jest dokładnie nasza sytuacja: 32 sygnały opóźnień, zero powiadomień. |
| 14 | **Ukrycie kolumny mylone z kontrolą dostępu.** monday ostrzega przy publicznych widokach: „**filtered data (items and columns) can still be accessed** through the shared views by technical savvy users although it is hidden". Asana: „Anyone… added as a collaborator on a status update will be able to see **the entire contents of the report, even if they don't have access to the underlying project**". | monday.com, Asana | Raport dla komitetu to **osobny, wygenerowany dokument**, a nie przefiltrowany widok danych źródłowych. |
| 15 | **Jedno światło ukrywa brak efektu.** Zielony harmonogram przy zerowej wartości zrealizowanej. | Falcon rozwiązuje to dwoma światłami (efekty | działania); WORKSPACE.PM trzema (schedule, cost, performance); Celoxis dwoma (S.Health, B.Health) | Minimum **dwa** światła: „idzie zgodnie z planem" i „przynosi efekt". |

---

# 6. Źródła

Wszystkie sprawdzone **07.09.2026**. Pogrupowane wg roli.

## 6.1 Rankingi i pozycje rynkowe

**Gartner MQ APMR**
- [Planview — Lider MQ APMR 2026 (5. rok, 11 producentów)](https://newsroom.planview.com/planview-recognized-by-gartner-as-a-leader-in-adaptive-project-management-and-reporting-2/)
- [Planisware — Lider MQ APMR 2026](https://planisware.com/planisware-named-leader-2026-gartner%C2%AE-magic-quadrant%E2%84%A2-adaptive-project-management-reporting)
- [Wrike — jedyny Wizjoner MQ APMR 2026](https://www.wrike.com/gartner-report-adaptive-project-management-and-reporting/)
- [Prism PPM — Niszowy MQ APMR 2026](https://www.globalprojectleader.co.uk/2026/08/prism-ppm-named-niche-player-in-2026-gartner-magic-quadrant-for-adaptive-project-management)
- [Triskell — pierwszy raz w MQ APMR 2026](https://www.prnewswire.com/news-releases/triskell-software-positioned-for-the-first-time-in-the-2026-gartner-magic-quadrant-for-adaptive-project-management-and-reporting-302867687.html)
- [monday.com — Lider MQ APMR 2025 (10 producentów)](https://ir.monday.com/news-and-events/news-releases/news-details/2025/monday-com-Named-a-Leader-in-the-2025-Gartner-Magic-Quadrant-for-Adaptive-Project-Management-and-Reporting-for-the-Fourth-Consecutive-Year/default.aspx)
- [Planisware — Lider MQ APMR 2025](https://planisware.com/planisware-named-leader-2025-gartner-magic-quadrant-adaptive-project-management-reporting)
- [Planview — Lider MQ APMR 2025, Sciforma Wizjoner](https://newsroom.planview.com/planview-recognized-by-gartner-as-a-leader-in-adaptive-project-management-and-reporting/)

**Gartner MQ SPM**
- [Planview — Lider MQ SPM 2026 (9 producentów)](https://newsroom.planview.com/planview-again-named-by-gartner-as-a-leader-in-strategic-portfolio-management-2/)
- [Planview — Lider MQ SPM 2025](https://newsroom.planview.com/planview-again-named-by-gartner-as-a-leader-in-strategic-portfolio-management/)
- [Broadcom Clarity — Lider MQ SPM 2025](https://valueops.broadcom.com/blog/broadcom-named-a-leader-in-the-2025-gartner-magic-quadrant-for-spm)

**Forrester Wave**
- [Planview — pełna lista wyróżnień analityków (Wave SPM Q2 2026 i wcześniejsze)](https://www.planview.com/analyst-recognition/)
- [Bizzdesign — Lider Wave SPM Q2 2026, 13 producentów, 22 kryteria](https://bizzdesign.com/analyst-report/spm-tool-forrester-wave-q2-2026)
- [ServiceNow — Lider Wave SPM](https://www.servicenow.com/lpayr/forrester-wave-spm.html)
- [Atlassian — Strong Performer Wave SPM Q2 2026](https://www.atlassian.com/blog/company-news/forrester-strategic-portfolio-management-2026)
- [Apptio (IBM) — Wave SPM Q2 2026](https://www.apptio.com/resources/analyst-reports/the-forrester-wave-strategic-portfolio-management-tools/)
- [Asana — Lider Wave Collaborative Work Management Q2 2025](https://investors.asana.com/news-releases/news-release-details/asana-named-leader-collaborative-work-management-tools-q2-2025)
- [Adobe Workfront — Lider Wave Collaborative Work Management Q2 2025](https://business.adobe.com/resources/reports/forrester-wave-collaborative-work-management-tools-2025.html)
- [Atlassian — Lider Wave Value Stream Management Q2 2025 (inny rynek)](https://www.atlassian.com/blog/announcements/forrester-value-stream-management-2025)
- [Miro — Forrester SPM Tools Landscape (krajobraz, nie Wave)](https://miro.com/blog/forrester-strategic-portfolio-management-tools-landscape-miro/)

**G2 i Capterra**
- [G2 — najwyżej oceniane PPM, zima 2026](https://learn.g2.com/best-project-and-portfolio-management-software)
- [Kantata — Lider G2 PSA i Resource Management, wiosna 2025](https://www.businesswire.com/news/home/20250430822577/en/)
- [Capterra Shortlist — PPM 2025](https://www.capterra.com/project-portfolio-management-software/shortlist/)
- [Capterra Shortlist — Resource Management 2026](https://www.capterra.com/resource-management-software/shortlist/)

## 6.2 Microsoft Project

- [Baseline Start fields](https://support.microsoft.com/en-us/office/baseline-start-fields-5661a129-3d08-4567-860b-24ba304f526f) · [Baseline Work fields](https://support.microsoft.com/en-us/office/baseline-work-fields-a3142410-6b5c-40b5-8e71-d871fd7df2d1) · [Baseline1-10 Start fields](https://support.microsoft.com/en-us/office/baseline1-10-start-fields-6cd8e7c2-6964-4b05-a35c-4abeb2d10f8e)
- [Start Variance fields](https://support.microsoft.com/en-us/office/start-variance-fields-0d8ac113-d0d6-4577-892b-893acb66a028) · [Finish Variance fields](https://support.microsoft.com/en-us/office/finish-variance-fields-2b630199-4211-4b5a-b5f2-d1efc24ec4e7) · [Work Variance fields](https://support.microsoft.com/en-us/office/work-variance-fields-1bb45242-e32e-4c7f-a694-81bc2a9e9a74)
- [Review the progress of your schedule](https://support.microsoft.com/en-us/office/review-the-progress-of-your-schedule-0d24c633-f572-44b9-8fdb-56e1f5095237) · [Pick the right report](https://support.microsoft.com/en-us/office/pick-the-right-report-in-project-61324235-aaec-4eef-acab-4c5245fedaeb) · [Create a project report](https://support.microsoft.com/en-us/office/create-a-project-report-6e74dc79-0e2d-480b-b600-3a466bf289a3)
- [Overview of Project views](https://support.microsoft.com/en-us/office/overview-of-project-views-6cb1dbcd-5cd5-4cc2-a878-aa365564266d) · [Task.Milestone (VBA)](https://learn.microsoft.com/en-us/office/vba/api/project.task.milestone)
- [Learn more about resource units](https://support.microsoft.com/en-us/office/learn-more-about-resource-units-505fe97b-9265-43e4-9b23-8800fd716c58) · [Max Units field](https://support.microsoft.com/en-us/office/max-units-resource-field-e8ad719d-0d04-4369-91e7-9284dd819765) · [Assignment Units](https://support.microsoft.com/en-us/office/assignment-units-fields-1826d47c-b0d5-440c-bc41-712c11311737) · [Unit Availability](https://support.microsoft.com/en-us/project/unit-availability-resource-timephased-field) · [Work Contour](https://support.microsoft.com/en-us/office/work-contour-fields-bd974887-9d48-4d94-b0a6-ae781ba01ced)
- [View resource workloads and availability](https://support.microsoft.com/en-us/office/view-resource-workloads-and-availability-in-project-desktop-3ee16869-68ad-4e63-bcb3-278ae34f7459) · [Team Planner](https://support.microsoft.com/en-us/project/view-your-team-s-work-with-team-planner) · [Level resource assignments](https://support.microsoft.com/en-us/project/distribute-project-work-evenly-level-resource-assignments)
- [Set the status date](https://support.microsoft.com/en-us/office/set-the-status-date-for-project-reporting-ef4ad175-b219-456a-8f62-2eef97a3c8ce) · [Application.UpdateProject (pjReschedule)](https://learn.microsoft.com/en-us/office/vba/api/project.application.updateproject)
- [Add a risk to a project in Project Online](https://support.microsoft.com/en-us/office/add-a-risk-to-a-project-in-project-online-7aa1acc9-50cf-4f15-ac3b-fedf41b31c83) · [Best practices for managing risks](https://support.microsoft.com/en-us/office/project-online-best-practices-for-managing-risks-0523899d-1d3a-4561-8d42-acb0951602ba)
- [Project features descriptions (w tym data wycofania Project Online: 30.09.2026)](https://learn.microsoft.com/en-us/projectonline/project-features-descriptions) · [Planner Basic vs Premium](https://support.microsoft.com/en-us/planner/compare-microsoft-planner-basic-vs-premium-plans)

## 6.3 Broadcom Clarity

- [Track Tasks Across Investments](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-track-tasks-and-to-do-items.html)
- [Create and Manage Project Baselines](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/Create-and-Manage-Project-Baselines.html)
- [Staff a Project](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/project-staffing.html)
- [Allocations Timeline](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/Analyze-Resource-Allocation-and-Staffing-home/Analyze-Allocations-by-Using-Allocations-Timeline.html) · [Analyze Staffing by Using Assignments](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/Analyze-Resource-Allocation-and-Staffing-home/analyze-staffing-by-using-assignments.html)
- [Manage Risks, Issues, and Changes](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/new-user-experience-manage-risks-issues-and-changes.html)
- [Manage Status Reports](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/clarity--manage-status-reports.html) · [Measure Progress and Publish Project Status Reports](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-3-0/using/new-user-experience-create-open-and-view-projects/new-user-experience-measure-progress-and-publish-project-status-reports.html)

## 6.4 Celoxis

- [RAG indicators](https://www.celoxis.com/kb/15.0/projects/concepts/rag-indicators) · [Project baseline](https://www.celoxis.com/kb/latest/projects/how-to/project-baseline) · [Atrybuty zadań](https://www.celoxis.com/kb/latest/tasks/concepts/attributes) · [Atrybuty projektów](https://www.celoxis.com/kb/latest/projects/concepts/attributes) · [Postęp](https://www.celoxis.com/kb/latest/tasks/concepts/progress)
- [Atrybuty użytkowników](https://www.celoxis.com/kb/latest/users/concepts/attributes) · [Hours Allocation (BETA)](https://www.celoxis.com/kb/15.1/hours-allocation/concepts/allocate-task-resources-in-hours)
- [Typy raportów](https://www.celoxis.com/kb/15.1/reports/concepts/types) · [Wyjście raportu](https://www.celoxis.com/kb/15.1/reports/concepts/output) · [Dashboardy](https://www.celoxis.com/kb/15.1/reports/concepts/dashboards) · [Harmonogram wysyłki](https://www.celoxis.com/kb/15.1/reports/concepts/scheduling) · [Custom Apps](https://www.celoxis.com/kb/latest/custom-apps/concepts/introduction)

## 6.5 Meisterplan

- [Allocation heatmaps for capacity planning](https://meisterplan.com/blog/resource-management/allocation-heatmaps-for-capacity-planning/) · [Configure Capacity Planning Basics](https://help.meisterplan.com/hc/en-us/articles/360021369100-3-Configure-Capacity-Planning-Basics) · [Raporty pivot](https://help.meisterplan.com/hc/en-us/articles/360021417912-Pivot-Reports-in-Meisterplan-Overview) · [Konfiguracja heatmapy](https://help.meisterplan.com/hc/en-us/articles/360022504612)
- [Must-Have Line and Cut-Off Line](https://help.meisterplan.com/hc/en-us/articles/360015748331-Must-Have-Line-and-Cut-Off-Line) · [Plan of Record](https://help.meisterplan.com/hc/en-us/articles/115004382433-Plan-of-Record) · [Scenariusze](https://help.meisterplan.com/hc/en-us/articles/115003795153-Scenarios-in-Meisterplan-Overview) · [Porównanie scenariuszy](https://help.meisterplan.com/hc/en-us/articles/115004412913-Scenario-Comparison) · [Dodawanie/edycja scenariuszy](https://help.meisterplan.com/hc/en-us/articles/115004412993-Adding-Editing-and-Deleting-Scenarios)

## 6.6 Smartsheet

- [Baselines](https://help.smartsheet.com/articles/2482093-baselines) · [Kolumny arkusza projektu](https://help.smartsheet.com/articles/765737-project-sheet-columns-start-date-end-date-duration-complete-and-predecessors) · [Formatowanie warunkowe](https://help.smartsheet.com/articles/516359-conditional-formatting) · [Symbole](https://help.smartsheet.com/articles/2480316-available-symbols-in-symbols-column)
- [Raporty z wielu arkuszy](https://help.smartsheet.com/articles/2482077-report-on-data-from-multiple-sheets) · [Praca w widoku tabeli](https://help.smartsheet.com/articles/2483462-work-your-data-table-view) · [Zależności](https://help.smartsheet.com/articles/765727-enabling-dependencies-using-predecessors)
- [Integracja z Resource Management](https://help.smartsheet.com/articles/2481881-overview-integration-for-resource-management) · [Synchronizacja przypisań](https://help.smartsheet.com/articles/2482380-sync-resource-management-assignments-with-Smartsheet) · [Legacy allocation](https://help.smartsheet.com/articles/1346969-legacy-resource-management-allocation) · [Workload tracking FAQ](https://help.smartsheet.com/articles/2483178-workload-tracking-faq) · [Dostępność zasobów](https://help.smartsheet.com/learning-track/resource-management-project-management/resource-availability) · [Nawigacja po harmonogramie](https://help.smartsheet.com/learning-track/resource-management-project-management/navigating-schedule) · [Raport utylizacji](https://help.smartsheet.com/articles/2481226-create-a-utilization-report)
- [RAID Logs](https://help.smartsheet.com/articles/2483374-raid-logs) · [Approval requests](https://help.smartsheet.com/articles/2479276-request-approval-from-stakeholders) · [Update requests](https://help.smartsheet.com/articles/2479266-automatically-request-updates-on-tasks)
- [Publikowanie](https://help.smartsheet.com/articles/522078-publishing-smartsheet-items) · [Wysyłka mailem](https://help.smartsheet.com/articles/504773-sending-sheets-rows-via-email) · [Eksport](https://help.smartsheet.com/articles/770623-exporting-sheets-reports-from-smartsheet) · [Control Center — raportowanie portfelowe](https://help.smartsheet.com/learning-track/control-center/portfolio-reporting) · [Resource Management (produkt)](https://www.smartsheet.com/platform/resource-management)

## 6.7 Wrike

- [Baseline Tracking](https://help.wrike.com/hc/en-us/articles/36424453240594-Baseline-Tracking) · [Gantt Chart](https://help.wrike.com/hc/en-us/articles/210323585-Gantt-Chart-in-Wrike) · [Gantt Chart Snapshots](https://help.wrike.com/hc/en-us/articles/210323545-Gantt-Chart-Snapshots) · [Kolumny w Table view](https://help.wrike.com/hc/en-us/articles/1500005224982-Rearranging-Columns-in-Table-View) · [Edycja w Table view](https://help.wrike.com/hc/en-us/articles/1500005126681-Editing-Data-From-Table-View) · [Kamienie milowe](https://help.wrike.com/hc/en-us/articles/209603689-Milestones) · [Zależności a statusy](https://help.wrike.com/hc/en-us/articles/209604229-Task-Dependencies-on-the-Gantt-Chart)
- [Types of Task Effort](https://help.wrike.com/hc/en-us/articles/1500005128261-Types-of-Task-Effort) · [Bookings](https://help.wrike.com/hc/en-us/articles/1500000601601-Bookings) · [Resources View](https://help.wrike.com/hc/en-us/articles/1500000614522-Resources-View) · [Workload Charts](https://help.wrike.com/hc/en-us/articles/360010835433-Workload-Charts-in-Wrike) · [Customizing Workload Charts](https://help.wrike.com/hc/en-us/articles/1500005226342-Customizing-Workload-Charts) · [Troubleshoot Workload Chart](https://help.wrike.com/hc/en-us/articles/24589101749655-Troubleshoot-Wrike-Workload-Chart) · [Daily Capacity in Work Schedules](https://help.wrike.com/hc/en-us/articles/4699841221527-Managing-Daily-Capacity-in-Work-Schedules) · [Backlog Box](https://help.wrike.com/hc/en-us/articles/360045420254-Backlog-Box-in-Workload-Charts)
- [Project Status](https://help.wrike.com/hc/en-us/articles/1500005217622-Project-Status) · [Project Health](https://help.wrike.com/hc/en-us/articles/1500005217682-Project-Health) · [AI Project Risk Prediction](https://help.wrike.com/hc/en-us/articles/360055046934-AI-Project-Risk-Prediction) · [Reports](https://help.wrike.com/hc/en-us/articles/209604449-Reports-in-Wrike) · [Report Snapshots](https://help.wrike.com/hc/en-us/articles/210323665-Report-Snapshots) · [Approvals](https://help.wrike.com/hc/en-us/articles/360023006313-Approvals-in-Wrike) · [Guest approvals](https://help.wrike.com/hc/en-us/articles/360009722693-Reviewing-and-Approving-Files-for-Guest-Users) · [Custom Item Types](https://help.wrike.com/hc/en-us/articles/4409188763031-Custom-Item-Types-in-Wrike) · [Automation](https://help.wrike.com/hc/en-us/articles/360057941793-Automation-in-Wrike)

## 6.8 monday.com

- [The Gantt Baseline](https://support.monday.com/hc/en-us/articles/360020978159-The-Gantt-Baseline) · [Deadline Mode](https://support.monday.com/hc/en-us/articles/360002646059-Deadline-Mode) · [Project boards](https://support.monday.com/hc/en-us/articles/22598441769746-Project-boards-on-monday-com) · [Zależności](https://support.monday.com/hc/en-us/articles/360007402599-Dependencies-on-monday-com) · [Connect Boards](https://support.monday.com/hc/en-us/articles/360000635139-The-Connect-Boards-Column) · [Item pop-up view](https://support.monday.com/hc/en-us/articles/360001568919-What-is-the-item-pop-up-view-)
- [The Workload Widget](https://support.monday.com/hc/en-us/articles/360010699760-The-Workload-Widget) · [Resource management for Enterprise](https://support.monday.com/hc/en-us/articles/24114492777618-Resource-management-for-Enterprise)
- [Alerts and Reminders with Automations](https://support.monday.com/hc/en-us/articles/360000227739-Alerts-and-Reminders-with-Automations) · [Portfolio Risk Insights](https://support.monday.com/hc/en-us/articles/22551628427666-The-portfolio-Risk-Insights) · [The portfolio solution](https://support.monday.com/hc/en-us/articles/13337066797202-The-portfolio-solution) · [Dashboards](https://support.monday.com/hc/en-us/articles/360002187819-The-Dashboards) · [Share and present your Dashboard](https://support.monday.com/hc/en-us/articles/26237863849490-Share-and-present-your-Dashboard) · [Publiczne udostępnianie widoku](https://support.monday.com/hc/en-us/articles/360009695080-How-to-share-a-board-view-publicly)

## 6.9 Asana

- [Gantt view](https://help.asana.com/s/article/gantt-view) · [Gantt view FAQ](https://help.asana.com/s/article/gantt-view-faq) · [Task dependencies](https://help.asana.com/s/article/task-dependencies) · [Approvals](https://help.asana.com/s/article/approvals) · [Rules](https://help.asana.com/s/article/rules)
- [Portfolio workload and universal workload](https://help.asana.com/s/article/portfolio-workload-and-universal-workload) · [Reporting with workload](https://help.asana.com/s/article/reporting-with-workload) · [Capacity planning](https://help.asana.com/s/article/capacity-planning) · [Workload — poradnik](https://asana.com/resources/asana-tips-workload)
- [Project progress and status updates](https://help.asana.com/s/article/project-progress-and-status-updates) · [Portfolio progress and reporting](https://help.asana.com/s/article/portfolio-progress-and-reporting) · [Goals — progress and status](https://help.asana.com/s/article/progress-status-and-connecting-work-to-goals) · [Portfolio PowerPoint export](https://help.asana.com/s/article/portfolio-powerpoint-export) · [RAID log (poradnik)](https://asana.com/resources/raid-log)

## 6.10 ClickUp

- [Use baselines on Gantt view](https://help.clickup.com/hc/en-us/articles/34358881283863-Use-baselines-on-Gantt-view) · [Critical Path and Slack Time](https://help.clickup.com/hc/en-us/articles/6310440099479-Critical-Path-and-Slack-Time) · [Milestones](https://help.clickup.com/hc/en-us/articles/6304458574615-Milestones) · [Limity widoków](https://help.clickup.com/hc/en-us/articles/32274881672599-Views-feature-availability-and-limits)
- [Measure your workload](https://help.clickup.com/hc/en-us/articles/30799712357271-Measure-your-workload) · [Use Workload view](https://help.clickup.com/hc/en-us/articles/6310449699735-Use-Workload-view) · [Set capacity limits](https://help.clickup.com/hc/en-us/articles/30799771936279-Set-capacity-limits-in-Workload-view)
- [Manage task statuses](https://help.clickup.com/hc/en-us/articles/6309452618647-Manage-task-statuses) · [Intro to Automations](https://help.clickup.com/hc/en-us/articles/6312102752791-Intro-to-Automations) · [Portfolio cards](https://help.clickup.com/hc/en-us/articles/6312200675991-Portfolio-cards)

## 6.11 Kantata

- [Global Tasks Tracker](https://knowledge.kantata.com/hc/en-us/articles/216424897-Global-Tasks-Tracker) · [Task Tracker Columns](https://knowledge.kantata.com/hc/en-us/articles/13632628443547-Task-Tracker-Columns) · [Project Task Tracker](https://knowledge.kantata.com/hc/en-us/articles/202490134-Project-Task-Tracker) · [Snapshots and Baselines](https://knowledge.kantata.com/hc/en-us/articles/20367538592667-Project-Snapshots-and-Baselines-Overview) · [Mapping UI → API](https://knowledge.kantata.com/hc/en-us/articles/32797230727323-Mapping-of-User-Interface-Names-to-API-Object-Names) · [Stories (API)](https://developer.kantata.com/kantata/specification/stories)
- [Hour Types](https://knowledge.kantata.com/hc/en-us/articles/360059325413-Hour-Types-in-Kantata-OX) · [Workspace Allocations (API)](https://developer.kantata.com/kantata/specification/workspace-allocations) · [Managing Allocations](https://knowledge.kantata.com/hc/en-us/articles/115004722914-Managing-Allocations-in-Resourcing) · [Resource Scheduling Overview](https://knowledge.kantata.com/hc/en-us/articles/202492364-Resource-Scheduling-Overview) · [Resource Requests](https://knowledge.kantata.com/hc/en-us/articles/4581548561179-Resource-Requests-Overview) · [Glossary](https://knowledge.kantata.com/hc/en-us/articles/37158751310875-Glossary-of-Kantata-OX-Terms) · [Analytics: Utilization](https://knowledge.kantata.com/hc/en-us/articles/203814824-Analytics-Utilization) · [Resourcing Timeline](https://knowledge.kantata.com/hc/en-us/articles/360011903494-Resourcing-Timeline) · [Project Completion Estimates](https://knowledge.kantata.com/hc/en-us/articles/360004619334-Project-Completion-Estimates) · [Managing Scheduled Hours](https://knowledge.kantata.com/hc/en-us/articles/6921469169819-Managing-Scheduled-Hours-in-Resourcing) · [Recipe: Remove Future Scheduled Hours](https://knowledge.kantata.com/hc/en-us/articles/37258853457691-Recipe-Catalog-Tasks-Remove-Future-Scheduled-Hours)
- [Project Side Panel (Health Reports)](https://knowledge.kantata.com/hc/en-us/articles/360000695314-Project-Side-Panel) · [Budget Tab (Change Orders)](https://knowledge.kantata.com/hc/en-us/articles/6618654476827-Project-Admin-Box-Budget-Tab) · [Insights Overview](https://knowledge.kantata.com/hc/en-us/articles/16358764478619-Insights-Overview) · [Project Health Dashboard](https://knowledge.kantata.com/hc/en-us/articles/360035090374-Insights-Classic-Project-Health-Dashboard) · [Scheduled emails](https://knowledge.kantata.com/hc/en-us/articles/12008793655195-Schedule-Dynamic-Dashboard-Emails-Report-Exports-and-KPI-Alerts)

## 6.12 Runn

- [Managing assignments](https://help.runn.io/en/articles/3386862-managing-assignments) · [Contracts](https://help.runn.io/en/articles/1625881-contracts) · [Placeholders & Resource Requests](https://help.runn.io/en/articles/4177851-overview-placeholders-drafting-resource-requests) · [Placeholder metrics](https://help.runn.io/en/articles/12099255-placeholder-metrics-calculations-workload-financials-utilization) · [Tentative projects](https://help.runn.io/en/articles/3780190-tentative-projects) · [Project milestones](https://help.runn.io/en/articles/3623715-project-milestones) · [Project phases](https://help.runn.io/en/articles/3623810-project-phases)
- [Calculations for Utilization Chart](https://help.runn.io/en/articles/6565020-calculations-for-utilization-chart) · [Utilization Dashboard](https://help.runn.io/en/articles/11517169-utilization-dashboard) · [Group utilization charts](https://help.runn.io/en/articles/5521224-group-utilization-charts) · [People Planner](https://help.runn.io/en/articles/4293043-people-planner-overview) · [Rescheduling a project](https://help.runn.io/en/articles/4721837-rescheduling-a-project) · [Reports Center](https://help.runn.io/en/articles/10505585-reports-center-how-to-use-reports) · [Project dashboard](https://help.runn.io/en/articles/2826857-project-insights-project-dashboard) · [Capacity report (blog)](https://www.runn.io/blog/capacity-report) · [Resource utilization (blog)](https://www.runn.io/blog/resource-utilization)

## 6.13 Float

- [Allocate time](https://support.float.com/en/articles/4188692-allocate-time) · [Default work days and hours](https://support.float.com/en/articles/28942-default-work-days-and-hours) · [Individual custom hours](https://support.float.com/en/articles/28934-individual-custom-hours-and-work-days) · [Project statuses and stages](https://support.float.com/en/articles/12042863-project-statuses-and-stages) · [Placeholders](https://support.float.com/en/articles/2059673-placeholders) · [Roles](https://support.float.com/en/articles/8278926-roles) · [Glossary](https://support.float.com/en/articles/8820706-the-float-glossary) · [Move allocations, milestones and phases](https://support.float.com/en/articles/28927-move-multiple-allocations-milestones-and-phases-together) · [People Report](https://support.float.com/en/articles/4385599-people-report) · [Projects Report](https://support.float.com/en/articles/4385602-projects-report) · [Project view](https://support.float.com/en/articles/11405498-project-view) · [Project budgets](https://support.float.com/en/articles/2732830-project-budgets) · [Resource utilization (wzór)](https://www.float.com/resources/resource-utilization) · [API](http://developer.float.com/tutorial_assigning_tasks_to_your_team.html)

## 6.14 Forecast

- [API: allocations](https://raw.githubusercontent.com/Forecast-it/API/master/sections/allocations.md) · [API: tasks](https://raw.githubusercontent.com/Forecast-it/API/master/sections/tasks.md) · [API: persons](https://raw.githubusercontent.com/Forecast-it/API/master/sections/persons.md)
- [Resource Management Strategy](https://support.forecast.app/hc/en-us/articles/4457143432081-Identifying-your-Resource-Management-Strategy) · [Combined Mode](https://support.forecast.app/hc/en-us/articles/24238241585681-About-Combined-Mode) · [Changing company resource settings](https://support.forecast.app/hc/en-us/articles/38740136603793-Changing-Company-Resource-Management-Settings) · [Soft vs Hard Allocations](https://support.forecast.app/hc/en-us/articles/36512262486545-Soft-vs-Hard-Project-Allocations) · [Placeholders](https://support.forecast.app/hc/en-us/articles/12134108360337-Working-with-Placeholders) · [Capacity Overview (win probability)](https://support.forecast.app/hc/en-us/articles/36626677949585-Capacity-Overview) · [Partial day time-off](https://support.forecast.app/hc/en-us/articles/33176960882321-Partial-day-time-off-is-not-reducing-project-allocated-hours-why)
- [Utilization Report](https://support.forecast.app/hc/en-us/articles/5286588674065-Overview-of-Utilization-Report) · [People Schedule](https://support.forecast.app/hc/en-us/articles/4775562212753-Overview-of-People-Schedule) · [Using People Schedule](https://support.forecast.app/hc/en-us/articles/36268778057233-Using-People-Schedule) · [Using Project Status](https://support.forecast.app/hc/en-us/articles/13578415306129-Using-Project-Status) · [Standard Reporting](https://support.forecast.app/hc/en-us/articles/4462949811089-Getting-Started-with-Forecast-s-Standard-Reporting) · [Shared reports](https://support.forecast.app/hc/en-us/articles/33622256258961-Are-shared-reports-editable-when-viewed-by-users-outside-of-Forecast) · [Baseline](https://support.forecast.app/hc/en-us/articles/4977167479185-Setting-and-reviewing-project-Baseline)

## 6.15 Teamwork.com

- [My Work table view](https://support.teamwork.com/projects/home/using-the-my-work-table-view) · [Table view](https://support.teamwork.com/projects/table-view/using-table-view-for-tasks) · [Editing in table view](https://support.teamwork.com/projects/table-view/editing-tasks-in-table-view) · [Planned vs Actual Tasks](https://support.teamwork.com/projects/reports/planned-vs-actual-tasks)
- [Workload Planner](https://support.teamwork.com/projects/workload/workload-planner-overview) · [Using the Workload Planner](https://support.teamwork.com/projects/workload/using-the-workload-planner) · [Managing Capacity](https://support.teamwork.com/projects/workload/managing-capacity-in-the-workload) · [Allocate and Manage Resources](https://support.teamwork.com/projects/schedule/allocate-and-manage-resources) · [Schedule Introduction](https://support.teamwork.com/projects/schedule/schedule-introduction) · [Navigate the Schedule](https://support.teamwork.com/projects/schedule/navigate-the-schedule) · [Tentative Projects](https://support.teamwork.com/projects/schedule/tentative-resources) · [Placeholders](https://support.teamwork.com/projects/schedule/placeholders) · [Unavailable Time](https://support.teamwork.com/projects/schedule/unavailable-time) · [Working Hours](https://support.teamwork.com/projects/your-profile/updating-your-working-hours) · [Utilization Report](https://support.teamwork.com/projects/reports/utilization-report) · [Reports FAQ — utilization](https://support.teamwork.com/projects/reports/reports-faq-utilization-report-and-time-report)
- [Risks explained](https://support.teamwork.com/projects/risks/risks-explained) · [Reports FAQ](https://support.teamwork.com/projects/reports/reports-faq) · [Scheduling reports](https://support.teamwork.com/projects/reports/scheduling-reports) · [Setting Project Health](https://support.teamwork.com/projects/project-options/setting-project-health) · [Insights panel](https://support.teamwork.com/projects/reports/insights-panel) · [Resource utilization (blog, wzory)](https://www.teamwork.com/blog/resource-utilization/)

## 6.16 ServiceNow, Jira Align, Jira Plans

- ServiceNow: [Planning Console Tasks](https://www.servicenow.com/docs/bundle/washingtondc-it-business-management/page/product/project-management/reference/r_PlanningConsoleTasks.html) · [Compare schedule baselines](https://www.servicenow.com/docs/bundle/zurich-it-business-management/page/product/project-management/task/compare-schedule-baselines-prj.html) · [Create a project baseline](https://www.servicenow.com/docs/bundle/washingtondc-it-business-management/page/product/project-management/task/t_CreateAProjectBaseline.html) · [Resource plans](https://www.servicenow.com/docs/bundle/xanadu-it-business-management/page/product/resource-management/concept/c_ResourcePlans.html) · [Resource Management Workspace](https://www.servicenow.com/docs/bundle/yokohama-it-business-management/page/product/resource-management-workspace/concept/using-rmw.html) · [Allocations heatmap](https://www.servicenow.com/docs/bundle/zurich-it-business-management/page/product/pw-resource-management/task/view-allocations-heatmap-prj-wksp.html) · [Allocation workbench](https://www.servicenow.com/docs/bundle/yokohama-it-business-management/page/product/resource-management/task/manage-resources-allocation-workbench.html) · [RIDAC entries](https://www.servicenow.com/docs/bundle/xanadu-it-business-management/page/product/project-management/concept/ridac-entries-for-project.html) · [Add decisions](https://www.servicenow.com/docs/bundle/washingtondc-it-business-management/page/product/project-management/task/add-decisions-for-project.html) · [Project status report](https://www.servicenow.com/docs/bundle/zurich-it-business-management/page/product/project-management/task/project-status-report.html) · [Status report in Project Workspace](https://www.servicenow.com/docs/r/it-business-management/project-workspace/create-a-status-report-in-project-workspace.html)
- Jira Align: [Create risks](https://help.jiraalign.com/hc/en-us/articles/115001074487-Create-risks) · [Portfolio escalations](https://help.jiraalign.com/hc/en-us/articles/115000124254-Portfolio-escalations) · [Dependency overview](https://help.jiraalign.com/hc/en-us/articles/115002700947-Dependency-overview-and-dependency-types) · [Program board](https://help.jiraalign.com/hc/en-us/articles/115005049268-Program-board) · [Program predictability](https://help.jiraalign.com/hc/en-us/articles/115004689448-Program-predictability) · [Configure progress bars](https://help.jiraalign.com/hc/en-us/articles/360016458173-Configure-progress-bars) · [Capacity page](https://help.jiraalign.com/hc/en-us/articles/20106337580052-Understand-the-capacity-page) · [Sprint capacity](https://help.jiraalign.com/hc/en-us/articles/115003641568-Sprint-capacity) · [PI cleanup report](https://help.jiraalign.com/hc/en-us/articles/115004903548-Program-increment-cleanup-report) · [Portfolio room](https://help.jiraalign.com/hc/en-us/articles/115000095234-Portfolio-room) · [Status report — status view](https://help.jiraalign.com/hc/en-us/articles/115004662507-Status-report-status-view)
- Jira Plans: [Troubleshoot warnings](https://support.atlassian.com/jira-software-cloud/docs/troubleshoot-warnings-on-your-timeline-in-advanced-roadmaps/) · [Symbols](https://support.atlassian.com/jira-software-cloud/docs/what-do-the-symbols-in-advanced-roadmaps-mean/) · [Capacity and velocity](https://support.atlassian.com/jira-software-cloud/docs/what-are-capacity-and-velocity-in-advanced-roadmaps/) · [Monitor capacity](https://support.atlassian.com/jira-software-cloud/docs/monitor-capacity-on-your-advanced-roadmaps-timeline/) · [Review and save changes](https://support.atlassian.com/jira-software-cloud/docs/review-and-save-changes-in-advanced-roadmaps/) · [Share and export](https://support.atlassian.com/jira-software-cloud/docs/share-and-export-your-advanced-roadmaps-plan/)

## 6.17 Planview (Portfolios i AdaptiveWork)

- AdaptiveWork: [Work Item Module (Scheduling Status)](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Work_Item_Module) · [★ Managing Resource Loads — „reflected on Today"](https://success.planview.com/Planview_AdaptiveWork/Capacity_Planning_and_Resource_Management/Getting_Started_-_Preparing_Your_Environment/Managing_Resource_Loads) · [Update Forecast](https://success.planview.com/Planview_AdaptiveWork/Capacity_Planning_and_Resource_Management/Update_Forecast) · [When Tasks Cannot Be Replanned](https://success.planview.com/Planview_AdaptiveWork/Capacity_Planning_and_Resource_Management/Update_Forecast/ZAdditional_Update_Forecast_Behavior_and_Considerations/When_Tasks_Cannot_Be_Replanned) · [Work Policy Logic](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Understanding_Work_Policy_Logic) · [What is Capacity Planning](https://success.planview.com/Planview_AdaptiveWork/Capacity_Planning_and_Resource_Management/What_is_Capacity_Planning%3F_An_Introduction) · [Cases Overview](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Cases/Cases_Overview) · [Case Types (RiskRate)](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Cases/Case_Types) · [★ Meeting Notes, Action Items and Decisions](https://success.planview.com/Planview_AdaptiveWork/More_on_AW_modules/Meeting_Notes%2C_Action_items_and_Decisions) · [Highlights](https://success.planview.com/Planview_AdaptiveWork/Work_Item_Management/Hybrid_Work/Highlights/00_Highlights_for_projects_%E2%80%93_overview) · [Standard reports list](https://success.planview.com/Planview_AdaptiveWork/Reporting/Reports_and_Dashboards/Standard_Reports_List) · [Slide Publisher](https://success.planview.com/Planview_AdaptiveWork/Integrations/Add-ins%2F%2FApps/Slide_Publisher/01._Slide_Publisher_Introduction)
- Portfolios: [★ Understanding the Progressing Engine](https://success.planview.com/Planview_Portfolios/Projects_and_Work/Execute_and_Track_Progress/300_Work_Progress_and_Status/003_Understanding_the_Progressing_Engine) · [WRK05 — Schedule and Effort Variance](https://success.planview.com/Planview_Portfolios/Analytics_and_Reporting/FastTrack_Analytics/Work_and_Project_Analytics/WRK05_-_Schedule_and_Effort_Variance) · [Glosariusz](https://success.planview.com/Planview_Portfolios/Planview_Portfolios_Glossary) · [analyst recognition](https://www.planview.com/analyst-recognition/) · forum producenta (źródło słabsze): [zgłoszenie „&gt;300 % utilization"](https://community.planview.com/ask-the-community-67/issues-with-respect-durations-not-shifting-work-allocations-forward-utilization-exceeding-limits-1130)
- Clarity (uzupełnienie): [Project Earned Value](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-4-2/advanced-reporting-with-jaspersoft/pmo-accelerator-advanced-reporting-content/project-management-reports/project-earned-value.html) · [Project Status Summary (szary = brak raportu)](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-4-2/advanced-reporting-with-jaspersoft/pmo-accelerator-advanced-reporting-content/project-management-reports/project-status-summary.html) · [Jobs reference (Post Timesheets)](https://techdocs.broadcom.com/us/en/ca-enterprise-software/business-management/clarity-project-and-portfolio-management-ppm-on-premise/16-2-2/reference/clarity-ppm-jobs-reference.html) · [Over-allocation prevention](https://knowledge.broadcom.com/external/article/201632/over-allocation-can-this-be-prevented.html) · [% Complete methods](https://knowledge.broadcom.com/external/article/125361/complete-calculation-methods-behavior.html) · [MQ SPM 2025](https://valueops.broadcom.com/blog/broadcom-named-a-leader-in-the-2025-gartner-magic-quadrant-for-spm)

## 6.18 Klasa transformacyjna i metodyka

- [Shibumi — Critical Capabilities](https://shibumi.com/critical-capabilities/) · [Shibumi — stage gates](https://shibumi.com/blog/managing-stage-gates-for-your-strategic-program-shibumi-can-do-that/) · [Shibumi — produkt](https://shibumi.com/product/)
- [Nordantech Falcon — Falcon explained](https://support.nordantech.com/en/articles/4219372-falcon-explained) · [Nordantech — strona produktu](https://www.nordantech.com/en)
- [WORKSPACE.PM — status reports](https://workspace.pm/en/features/project-management/status)
- [Portfolio Hub — RAG status (progi liczbowe)](https://portfoliohub.io/blog/rag-status) · [Rebel's Guide to PM — RAG i BRAG](https://rebelsguidetopm.com/understanding-rag-in-project-management/)
- [Techno-PM — Decision Register](https://www.techno-pm.com/blogs/raid/decision-register-excel-template-free) · [ProjectManager — Decision Log Template](https://www.projectmanager.com/templates/decision-log-template) · [ProjInsights — Decision Log](https://www.projinsights.com/what-is-decision-log-in-project-management-and-template/) · [APMIC — szablony 2026 (format eskalacji)](https://apmic.org/blogs/best-project-management-templates-amp-resources-2026-edition)
- [ProSymmetry — how to measure resource utilization](https://www.prosymmetry.com/blog/how-to-measure-resource-utilization) · [Productive — capacity planning software (porównanie)](https://productive.io/blog/capacity-planning-software/)

## 6.19 Czego NIE zmierzyłem (uczciwie)

1. **Planisware** — mam wyłącznie pozycję w rankingu (Lider MQ APMR 2026), zero mechaniki.
2. **Planview Portfolios** — znaczna część dokumentacji jest **za logowaniem**. Kilka
   twierdzeń opiera się na **wątkach forum producenta**, nie na dokumentacji; zaznaczam to
   przy każdym z nich. Nie zmierzyłem, gdzie dokładnie ląduje zaległy wysiłek przy każdej
   z czterech polityk silnika przesuwania.
3. **Pełne listy kwadrantów MQ APMR 2026 i MQ SPM 2026** — raporty za formularzem; mam
   potwierdzone pozycje pojedynczych producentów i liczby ocenianych (11 i 9).
   Nie potwierdziłem pozycji monday.com, Smartsheet ani Asany w edycji APMR 2026.
4. **Siatki G2** — wszystkie strony kwadrantów zwracają 403. Mam tylko redakcyjną dziesiątkę
   i komunikaty producentów.
5. **Traktowanie pracy po terminie u Asany, monday, Wrike, ClickUp i Teamwork** — ich
   dokumentacja o tym **milczy**. Wniosek („zostaje na swoich datach") wyprowadziłem
   z udokumentowanej mechaniki widoczności, **nie z cytatu**. Przy Planview, Float, Runn,
   Kantacie, Forecast, Smartsheecie, ServiceNow i Clarity mam cytaty.
6. **Czy rekord `Decision` w ServiceNow ma termin** — dokumentacja odsyła do strony „RIDAC
   form fields", której nie pobrałem. To jest luka istotna, bo to jedyny konkurent
   z rejestrem decyzji, a termin jest sednem wymagania właściciela.
7. **Pełna lista pól ryzyka w Clarity i Planview Portfolios** (prawdopodobieństwo, wpływ,
   wynik) — nie znalazłem źródła.
8. **Dokładny wzór „risk result" w Teamwork** (czy to iloczyn prawdopodobieństwa i wpływu) —
   nie znalazłem źródła.
9. **Czy próg 10 punktów w Planview AdaptiveWork Scheduling Status jest konfigurowalny** —
   nie znalazłem źródła. To ma znaczenie, bo rekomenduję skopiowanie tej reguły.
10. **Cykliczna wysyłka raportów w Wrike, Runn, Float i Forecast** — nie znalazłem źródła;
    mam potwierdzoną u Kantata, Teamwork, Celoxis, monday i Clarity.
11. **Natywne blokowanie kamienia przez ryzyko lub decyzję** — nie znalazłem tego u żadnego
    producenta. Wszędzie jest flaga i kolor, nigdy twarda blokada przejścia stanu.

## 6.20 Trzy tezy, które pomiar obalił w trakcie tego audytu

Zapisuję je jawnie, zamiast poprawiać po cichu — bo każda z nich brzmiała wiarygodnie
i każda była fałszywa.

| Teza | Co ją obaliło |
| --- | --- |
| „Szary RAG = luka danych to standard rynkowy" (z metodyki) | Sprawdziłem dwa kompendia, na które wskazywała wyszukiwarka — **żadne tego nie mówiło**. Dopiero pomiar Clarity, Wrike i Jira Align dał trzy realne potwierdzenia u producentów enterprise. Streszczenie wyszukiwarki podało twierdzenie, którego nie było w źródle. |
| „Rejestr decyzji to biała plama — nie ma go nikt" (moja) | ServiceNow (RIDAC) i Planview AdaptiveWork (Decyzje ze spotkań) — **dwa produkty mają go natywnie**. |
| „Nikt nie przelewa zaległości na dziś, więc 853 % to nasz własny błąd" (moja) | Planview AdaptiveWork ma to **udokumentowane jako zachowanie projektowe**: „will be **reflected on Today**". Użytkownicy Planview Portfolios zgłaszają „&gt;300 %". |

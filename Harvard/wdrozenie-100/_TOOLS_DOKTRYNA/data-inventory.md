# Data Inventory — doktryna narzędzia

> Inwentaryzacja aktywów danych organizacji i ocena ich jakości, governance oraz gotowości pod AI. Metodyka: **DAMA-DMBOK 2.0** (11 obszarów wiedzy, 8 wymiarów jakości danych), **Gartner Data Governance Maturity Model** (5 poziomów), **Data Readiness for AI** (Deloitte/Gartner — dostępność, jakość, struktura, governance, dopasowanie do przypadku użycia).

---

## 1. Cel

Zbudować **pełny obraz aktywów danych organizacji** — co mamy, gdzie leży, kto jest właścicielem, w jakiej jest kondycji — i ocenić trzy rzeczy naraz: **jakość danych** (czy można im ufać), **dojrzałość governance** (czy ktoś nimi zarządza) oraz **gotowość pod AI** (czy da się na nich bezpiecznie zbudować model/agenta bez katastrofy typu „mądra odpowiedź na podstawie złych danych").

Narzędzie nie jest projektem informatycznym „zróbmy hurtownię danych". Jest diagnozą: które domeny danych są krytyczne dla strategii firmy (w tym dla AI) i jaka jest realna przepaść między „dane, które mamy" a „dane, których potrzebujemy, żeby im ufać i żeby AI działało na nich bezpiecznie". Efektem jest **mapa aktywów + ocena dojrzałości + roadmapa governance**, nie sama lista tabel i systemów.

Fundamentalne założenie metodyczne: **jakość danych i governance danych to nie to samo, i jedno bez drugiego nie działa długoterminowo.** Można mieć chwilowo dobre dane bez governance (ktoś je wyczyścił ręcznie) — degradują się w miesiące. Można mieć świetny governance bez wysokiej jakości — polityki są, ale nikt ich nie egzekwuje na starych zbiorach. Diagnoza musi rozdzielić te dwa wymiary, bo naprawia się je różnymi interwencjami.

## 2. Kiedy używać

- Firma planuje wdrożenie AI/analityki zaawansowanej i pyta „czy nasze dane w ogóle się do tego nadają" — zanim padnie budżet na model, który i tak dostanie śmieci na wejściu.
- Rozpoczyna się program data governance albo zarząd pyta „kto jest właścicielem tych danych" i nikt nie ma pewnej odpowiedzi.
- Wymóg zgodności (RODO, branżowe regulacje, audyt bezpieczeństwa) wymaga wiedzieć, jakie dane osobowe/wrażliwe firma przechowuje, gdzie i kto ma do nich dostęp — a obecnie nikt tego nie wie z pewnością.
- Powtarzający się sygnał nieufności do danych: różne działy pokazują sprzeczne liczby na tym samym spotkaniu (dwa raporty sprzedaży, dwie wersje „prawdy" o tym samym kliencie) — objaw braku master data i wspólnego źródła prawdy.
- Fuzja/przejęcie — trzeba zintegrować dwa zbiory danych i nikt nie wie, ile duplikatów, sprzeczności i luk to wygeneruje.
- Po incydencie danych (wyciek, błędna decyzja oparta na złych danych, publiczna wpadka z raportem) — moment gotowości organizacji sfinansować porządek, który wcześniej odkładano.
- Roczny przegląd aktywów danych jako część audytu IT/ryzyka — dane traktowane jako aktywo firmy, nie tylko techniczny szczegół.

## 3. Inputy

- **Rejestr źródeł danych**: systemy transakcyjne (ERP, CRM, systemy produkcyjne), hurtownie/jeziora danych, arkusze Excel „żyjące" poza systemami, aplikacje SaaS, dane w chmurze plikowej (SharePoint/Drive), logi, dane zewnętrzne (dostawcy, rynek).
- **Domeny danych**: podział tematyczny — klient, produkt, finanse, pracownik, operacje, dostawca — każda domena ma inny profil krytyczności i inny właściwy właściciel biznesowy.
- **Właściciele i stewardzi**: kto formalnie odpowiada za domenę danych (właściciel biznesowy) i kto operacyjnie dba o jakość (data steward) — albo jawny brak odpowiedzi, co samo w sobie jest sygnałem.
- **Wymiary jakości per zbiór** (ocena wg DAMA): kompletność, dokładność, spójność, aktualność, unikalność (duplikaty), poprawność formalna (validity), integralność referencyjna, rozsądność (reasonableness — czy wartości mają sens w kontekście biznesowym).
- **Dostępność i wykorzystanie**: kto i jak często korzysta ze zbioru; zbiór, którego nikt nie używa od miesięcy, to kandydat na dark data.
- **Zgodność (compliance)**: klasyfikacja wrażliwości (dane osobowe, finansowe, tajemnica handlowa), podstawa prawna przetwarzania, retencja, dostęp — szczególnie istotne dla RODO i regulacji branżowych.
- **Kontekst strategiczny**: plany AI/analityczne firmy na 12-24 miesiące — bo krytyczność domeny danych ocenia się względem tego, co firma chce z nimi zrobić, nie tylko względem dzisiejszego użycia.

## 4. Metoda

### 4.1 Data inventory / catalog — zbuduj mapę, zanim ocenisz

Inwentaryzacja to fundament, na którym stoi cała reszta — nie da się ocenić jakości ani governance zbioru, o którego istnieniu organizacja nie wie. Dwa poziomy:

- **Data inventory** — surowa lista: co mamy, gdzie leży, kto (podobno) jest właścicielem. Punkt startowy, często robiony ręcznie (wywiady z działami, przegląd systemów, audyt licencji SaaS).
- **Data catalog** — inwentarz wzbogacony o metadane: znaczenie pola, pochodzenie (lineage), jakość, powiązania z innymi zbiorami, historia zmian. Dojrzalsza forma, zwykle wspierana narzędziem (nie arkuszem).

Dla każdego zidentyfikowanego zbioru danych: nazwa/system, domena, właściciel biznesowy (imiennie, nie „dział"), steward operacyjny, liczba użytkowników/konsumentów, częstotliwość aktualizacji, klasyfikacja wrażliwości, czy istnieje dokumentacja/słownik pojęć.

**Sygnał krytyczny na tym etapie**: zbiór danych bez przypisanego właściciela biznesowego = **sierocy zbiór (orphan dataset)**. To pierwszy i najtańszy do wykrycia sygnał złego governance — samo pytanie „kto jest właścicielem X" i brak jednoznacznej odpowiedzi już jest wynikiem audytu.

### 4.2 Ocena jakości danych — 8 wymiarów DAMA-DMBOK

Dla każdego kluczowego zbioru/domeny, ocena 1-5 (lub %) na każdym z wymiarów:

1. **Kompletność (Completeness)** — czy brakuje wartości tam, gdzie powinny być; % pól wypełnionych względem wymaganych.
2. **Dokładność (Accuracy)** — czy dane odzwierciedlają rzeczywistość; weryfikacja względem źródła autorytatywnego.
3. **Spójność (Consistency)** — czy to samo pojęcie (np. „klient X") wygląda tak samo we wszystkich systemach, czy rozjeżdża się między CRM a ERP.
4. **Aktualność (Timeliness)** — czy dane są na tyle świeże, żeby decyzja oparta na nich była trafna; dane sprzed 2 lat w polu „aktualny status klienta" to zero wartości decyzyjnej.
5. **Unikalność (Uniqueness / Deduplication)** — ile jest duplikatów tego samego bytu (ten sam klient wprowadzony 3 razy różnymi nazwami).
6. **Integralność (Integrity)** — czy relacje między danymi są zachowane (zamówienie bez istniejącego klienta = złamana integralność referencyjna).
7. **Poprawność formalna (Validity)** — czy dane spełniają zdefiniowany format/zakres (data urodzenia w przyszłości, e-mail bez „@" — błąd walidacji, nie tylko „brzydkie dane").
8. **Rozsądność (Reasonableness)** — czy wartość ma sens biznesowy w kontekście (przychód klienta 3 zł miesięcznie w segmencie enterprise — technicznie poprawne pole, biznesowo podejrzane).

Wynik nie jest jedną liczbą „jakość = 72%" — to profil po wymiarach, bo różne słabości wymagają różnych napraw (brak duplikatów ≠ brak luk w kompletności; różne przyczyny, różne interwencje).

### 4.3 Ocena dojrzałości governance — model 5 poziomów (wzorowany na Gartner EIM)

Governance ocenia się osobno od jakości — to odpowiedź na pytanie „czy istnieje system, który UTRZYMA jakość w czasie", nie migawka stanu obecnego:

| Poziom | Nazwa | Charakterystyka |
|---|---|---|
| **1 — Świadomość (Aware)** | Dane uznane za aktywo „na papierze", brak systematycznego zarządzania. | Nikt formalnie nie odpowiada; jakość zależy od przypadku i dobrej woli pojedynczych osób. |
| **2 — Reaktywność (Reactive)** | Governance istnieje wyspowo — pojedyncze działy mają swoje zasady, brak wspólnego standardu. | Problemy jakości gaszone po fakcie (ktoś zauważył błąd w raporcie), nie zapobiegane systemowo. |
| **3 — Proaktywność (Proactive)** | Zdefiniowane polityki, powołani właściciele/stewardzi dla kluczowych domen, współpraca międzydziałowa. | Jest plan, są role — ale egzekucja wciąż nierówna między domenami. |
| **4 — Zarządzanie (Managed)** | Governance obejmuje całą organizację, metryki jakości mierzone regularnie, kontrole częściowo zautomatyzowane. | Jakość danych jest monitorowana jak KPI, nie tylko odczuwana anegdotycznie. |
| **5 — Efektywność (Effective)** | Ciągłe doskonalenie w oparciu o dane ilościowe; governance dostosowuje się do zmieniających się celów biznesowych. | Rzadko spotykany poziom poza dużymi, dojrzałymi organizacjami; punkt odniesienia, nie oczekiwanie domyślne. |

Ocena poziomu robiona jest per organizacja całościowo, ale często **rozjeżdża się między domenami** — dane finansowe (audytowane, regulowane) bywają na poziomie 4, dane sprzedażowe na poziomie 2, dane operacyjne produkcji na poziomie 1. Ten rozjazd sam w sobie jest ważnym wynikiem diagnozy.

### 4.4 Data readiness dla AI — dodatkowa warstwa oceny

Gotowość pod AI to nie to samo co ogólna jakość danych — dokłada specyficzne kryteria (za Deloitte/Gartner, pięć wymiarów):

1. **Dostępność (Availability)** — czy dane są w ogóle dostępne cyfrowo, w formacie, do którego model ma dostęp (nie zamknięte w PDF-ach czy pamięci pracowników).
2. **Jakość (Quality)** — patrz 4.2; AI amplifikuje błędy szybciej i z większą pewnością siebie niż człowiek czytający raport — GIGO (garbage in, garbage out) działa tu z większą siłą, nie mniejszą.
3. **Struktura (Structure)** — czy dane są ustrukturyzowane/oznaczone w sposób, który model może interpretować (metadane, schemat, spójne słownictwo) czy to nieoznaczony „dark data".
4. **Governance** — patrz 4.3; bez governance nawet dobre dziś dane zdegradują się, zanim projekt AI się skończy.
5. **Dopasowanie do przypadku użycia (Use-case alignment)** — czy dane, które mamy, faktycznie odpowiadają na pytanie, które chcemy zadać AI (dane transakcyjne świetne pod prognozę popytu, bezużyteczne pod ocenę satysfakcji klienta bez danych jakościowych/feedbacku).

### 4.5 Dark data i sierocy zbiór — osobna kategoria ryzyka

**Dark data** — dane zbierane i przechowywane (logi, e-maile, nagrania obsługi klienta, stare pliki projektowe), ale nigdy nieanalizowane i niewykorzystywane. To nie są dane „złe" — są nieznane. Ryzyko podwójne: koszt przechowywania bez zwrotu wartości ORAZ ryzyko compliance (nikt nie wie, czy w tym zbiorze są dane osobowe podlegające RODO, bo nikt go nigdy nie przejrzał).

**Sierocy zbiór (orphan dataset)** — z sekcji 4.1: zbiór danych bez właściciela biznesowego. Różni się od dark data tym, że może być aktywnie używany (raporty na nim powstają), ale nikt formalnie nie odpowiada za jego jakość — degraduje się cicho, dopóki błąd nie wybuchnie w decyzji zarządu.

### 4.6 Roadmapa — od diagnozy do inicjatyw governance

Wynik oceny (4.2-4.5) przekłada się na priorytetyzację: **krytyczność domeny dla strategii/AI × luka jakości/governance = pilność interwencji**. Domena o wysokiej krytyczności i niskiej jakości to pierwsza inicjatywa; domena o niskiej krytyczności, nawet przy słabej jakości, czeka.

## 5. Jak się WNIOSKUJE

- **Brak właściciela = sierocy zbiór = ukryte ryzyko, nie neutralny fakt.** Za każdym razem, gdy inwentaryzacja trafia na zbiór danych bez jednoznacznego, imiennego właściciela biznesowego, to nie jest luka administracyjna do uzupełnienia później — to czynne ryzyko: nikt nie zauważy degradacji jakości, nikt nie zdecyduje o retencji/usunięciu, nikt nie odpowie za zgodność. Im więcej sierocych zbiorów, tym bardziej organizacja operuje na „danych, w które nikt nie wierzy, ale nikt też formalnie nie podważa".
- **Dark data rośnie proporcjonalnie do braku governance, nie do wielkości firmy.** Duża firma z dojrzałym governance ma mniej dark data niż mała firma bez żadnej polityki retencji/klasyfikacji — to nie kwestia skali, tylko dyscypliny. Wysoki % danych nieużywanych/nieklasyfikowanych to sygnał governance, nie sygnał „mamy dużo danych" (co bywa mylone z dojrzałością).
- **Wysoka jakość bez governance jest tymczasowa — traktuj jako stan przejściowy, nie osiągnięcie.** Zbiór danych oceniony dziś jako wysokiej jakości, ale bez przypisanego stewarda i procesu utrzymania, zdegraduje się w miesiące (nowe rekordy wchodzą bez tej samej dyscypliny, co historyczne). Ocena jakości musi być czytana razem z oceną governance tej samej domeny — wysoka jakość + niski governance = ostrzeżenie o trajektorii, nie powód do spokoju.
- **Pułapka „AI na złych danych" — amplifikacja, nie tylko powielenie błędu.** Człowiek czytający zły raport ma szansę zauważyć anomalię i zapytać. Model podający odpowiedź na podstawie tych samych złych danych robi to płynnie, pewnie i szybko — błąd nie jest widoczny jako błąd, tylko jako wiarygodna rekomendacja. To podnosi próg akceptowalnej jakości danych dla projektów AI wyżej niż próg wystarczający dla raportowania „dla ludzi" — dana domena może być „wystarczająco dobra" do dashboardu BI, a wciąż za słaba do bezpiecznego zasilenia agenta AI podejmującego rekomendacje.
- **Rozjazd governance między domenami ujawnia priorytety historyczne firmy, nie przypadek.** Domeny audytowane/regulowane (finanse, HR/płace) niemal zawsze mają wyższy poziom dojrzałości niż domeny operacyjne/sprzedażowe — bo presja zewnętrzna (audytor, regulator) wymusiła dyscyplinę, której nikt nie wymusił wewnętrznie gdzie indziej. Ten wzorzec, gdy się powtarza, jest sam w sobie insightem: „governance idzie tam, gdzie jest kara za jego brak, nie tam, gdzie jest wartość z jego posiadania".
- **Sprzeczne raporty na tym samym spotkaniu = brak master data, nie błąd pojedynczej osoby.** Gdy dwa działy przynoszą różne liczby dla „tego samego" wskaźnika (przychód, liczba klientów), pierwszy odruch to szukanie winnego („kto się pomylił") — właściwa diagnoza to sprawdzenie, czy istnieje jedno autorytatywne źródło prawdy (single source of truth) dla tej domeny, czy każdy system ma własną, rozjeżdżającą się kopię. Objaw pojedynczy = zdarzenie; objaw powtarzalny na różnych spotkaniach = brak governance master data.
- **Krytyczność dla AI zmienia priorytetyzację względem krytyczności operacyjnej.** Domena danych może być nisko priorytetowa operacyjnie (mało osób jej dziś używa) i jednocześnie wysoko priorytetowa dla planowanego wdrożenia AI (bo to na niej ma stanąć nowy model/agent) — inwentaryzacja musi oceniać krytyczność względem PLANOWANEGO użycia, nie tylko dzisiejszego, inaczej roadmapa naprawy trafia w złe domeny.

## 6. INSIGHTY (rdzeń narzędzia)

To jest **główny produkt narzędzia** — nie lista zbiorów danych, tylko zdania, które prowadzą wprost do decyzji i inicjatyw governance:

- *„Domena »dane klienta« jest krytyczna dla planowanego wdrożenia agenta AI obsługi klienta, ale jakość = 40% (kompletność 55%, spójność 30% między CRM a systemem fakturowania) → blokada projektu AI do czasu naprawy master data klienta, nie problem do zignorowania przy starcie pilota."*
- *„60% zidentyfikowanych zbiorów danych (głównie arkusze Excel poza systemami i archiwa e-mail) nie ma przypisanego właściciela biznesowego — to dark data/sierocy zbiór w skali, która przekłada się na nieznane ryzyko compliance RODO, nie tylko na nieporządek."*
- *„Brak master data klienta powoduje, że dział sprzedaży i dział finansów przynoszą sprzeczne liczby przychodu na każdym miesięcznym przeglądzie — to nie błąd ludzki, to brak jednego źródła prawdy; inicjatywa: konsolidacja do jednego systemu referencyjnego klienta (MDM), nie kolejne uzgadnianie ręczne."*
- *„Dane finansowe: poziom dojrzałości governance 4 (Managed, wymuszony audytem). Dane operacyjne produkcji: poziom 1 (Aware, zero formalnego właściciela) — mimo że dane operacyjne są kluczowe dla planowanego projektu optymalizacji AI. Rozjazd priorytetów historycznych trzeba świadomie odwrócić, bo dziś governance idzie tam, gdzie jest kara za jego brak (audyt), nie tam, gdzie jest wartość strategiczna (AI)."*
- *„Zbiór danych X ma wysoką jakość dziś (94% kompletności), ale zero przypisanego stewarda i brak procesu walidacji nowych rekordów — to stan tymczasowy: bez interwencji governance jakość spadnie w ciągu 6-12 miesięcy wraz z napływem nieaudytowanych nowych danych."*
- *„35% pól w kluczowej tabeli produktowej ma duplikaty tego samego bytu pod różnymi nazwami (deduplikacja = 65%) — każda analiza/model AI oparty na tej tabeli bez wcześniejszego czyszczenia duplikatów będzie systematycznie zawyżał/zaniżał metryki zależne od liczby unikalnych produktów."*
- *„Dane HR/płacowe: wysoka jakość i governance (regulacja wymusza), ale zero integracji z resztą organizacji — »wyspa jakości« nie tworzy wartości dla reszty firmy, bo nikt poza HR nie ma do niej dostępu ani wglądu w strukturę; potencjał do współdzielonych insightów (np. korelacja rotacji z wynikami zespołów) leży niewykorzystany."*
- *„Inwentaryzacja ujawniła 12 systemów SaaS z aktywnymi subskrypcjami, z których 5 nie ma żadnego zidentyfikowanego właściciela biznesowego i nikt nie potrafi powiedzieć, jakie dane tam wpływają — pierwszy krok przed jakąkolwiek strategią AI to domknięcie tej listy, bo część z nich może zawierać dane osobowe klientów bez podstawy prawnej przetwarzania."*
- Każdy taki insight → **inicjatywa governance** z właścicielem, zakresem (która domena, które systemy), miarą sukcesu (docelowy poziom dojrzałości/jakości) i sekwencją — bo naprawa master data zwykle musi poprzedzać jakikolwiek projekt AI budowany na tej domenie, nie biec równolegle.

## 7. Worked example

**Kontekst**: firma dystrybucyjna średniej wielkości (B2B), rozważa wdrożenie agenta AI do prognozowania popytu i automatyzacji obsługi zamówień. Zarząd pyta: „czy nasze dane są gotowe?".

**Krok 1 — inwentaryzacja** (wycinek):
| Zbiór/domena | System | Właściciel | Ostatnia aktualizacja procesu |
|---|---|---|---|
| Dane klienta (kontakt, historia zamówień) | CRM + osobny arkusz „VIP klienci" u handlowca | Brak formalnego (CRM „należy do sprzedaży" ogólnie) | Arkusz aktualizowany ręcznie, nieregularnie |
| Dane produktowe (SKU, kategorie, ceny) | ERP | Kierownik ds. produktu (imiennie) | Aktualizowane przy wprowadzeniu nowego produktu |
| Historia zamówień/transakcji | ERP + hurtownia danych | Dział IT (techniczny, nie biznesowy) | Automatyczna, ale bez walidacji jakości |
| Dane magazynowe (stany, lokalizacje) | WMS | Kierownik magazynu | Aktualizowane na bieżąco, wysoka dyscyplina (audyt logistyczny) |
| Logi obsługi klienta (e-maile, zgłoszenia) | Skrzynka pocztowa współdzielona | Brak | Nigdy nieanalizowane — dark data |

**Krok 2 — ocena jakości (DAMA, wycinek dla „dane klienta")**:
- Kompletność: 60% (brakuje segmentacji, danych kontaktowych częściowo nieaktualnych).
- Spójność: 35% — ten sam klient figuruje inaczej w CRM i w arkuszu „VIP klienci"; brak wspólnego identyfikatora.
- Unikalność: 70% — część klientów zdublowana (różne oddziały wprowadzały ręcznie).
- Aktualność: 50% — status „aktywny/nieaktywny" nieaktualizowany od miesięcy.

**Krok 3 — ocena governance**: domena „dane klienta" = poziom **2 (Reactive)** — istnieją doraźne zasady u pojedynczych handlowców, brak wspólnego standardu, brak formalnego właściciela biznesowego. Domena „dane magazynowe" = poziom **4 (Managed)** — wymuszona audytem logistycznym, metryki mierzone regularnie.

**Krok 4 — data readiness dla AI**: projekt (prognozowanie popytu + automatyzacja zamówień) wymaga **wysokiej jakości danych klienta i historii transakcji jednocześnie** — a to właśnie najsłabsze ogniwo (dane klienta = jakość ~55% średnio, governance poziom 2). Dane magazynowe, mimo wysokiej własnej jakości, nie ratują readiness całego projektu, bo model potrzebuje wszystkich trzech domen naraz.

**Insighty → inicjatywy**:
1. *„Dane klienta: jakość 55%, governance poziom 2 — to jest twarda blokada dla projektu prognozowania popytu, nie szczegół do poprawienia w locie. Inicjatywa: konsolidacja CRM + arkusz VIP do jednego źródła, przypisanie formalnego właściciela biznesowego (Dyrektor Sprzedaży), wdrożenie wspólnego identyfikatora klienta — przed startem pilota AI, nie równolegle."*
2. *„Logi obsługi klienta: dark data, zero analizy — a to potencjalnie najbogatsze źródło sygnału o niezadowoleniu/churn dla modelu prognostycznego. Inicjatywa druga fala: pilotażowa analiza (NLP) tego zbioru po domknięciu fazy 1, nie na starcie — priorytet niższy niż twarda blokada master data klienta."*
3. *„Dane magazynowe: wzorzec do powielenia (governance poziom 4 dzięki regularnemu audytowi) — replikacja tej samej dyscypliny (regularny przegląd, jasny właściciel, metryki jakości) na domenę klienta to najszybsza droga do podniesienia poziomu 2→3 w ciągu 2 kwartałów."*
4. *„12 systemów SaaS, 5 bez właściciela — przed rozpoczęciem jakiegokolwiek projektu AI, domknięcie rejestru systemów i klasyfikacji danych (szczególnie pod RODO) jako przedwarunek, nie zadanie równoległe — ryzyko compliance nieznanego zakresu nie powinno czekać na priorytetyzację projektu AI."*
5. *„Rekomendacja sekwencji: Faza 0 (1-2 kwartały) = naprawa master data klienta + domknięcie rejestru systemów. Faza 1 = pilot prognozowania popytu na już oczyszczonych danych klienta + historii transakcji + danych magazynowych. Start pilota AI na dzisiejszych danych klienta bez fazy 0 kończy się modelem, który ładnie prognozuje na złym gruncie — wynik wygląda wiarygodnie, ale jest tak dobry, jak najsłabsze wejściowe źródło."*

## 8. Antywzorce przy stosowaniu narzędzia

- **Inwentaryzacja jako projekt jednorazowy, nie proces.** Katalog danych zrobiony raz i odłożony na półkę jest nieaktualny w kilka miesięcy — nowe systemy SaaS, nowe arkusze, rotacja właścicieli. Inwentaryzacja bez rytmu przeglądu (kwartalnie/rocznie) degraduje się tak samo jak dane, które miała opisać.
- **Ocena jakości bez rozmowy z biznesem.** Sama jakość techniczna (czy pole jest wypełnione, czy format poprawny) bez pytania biznesowego „czy ta wartość ma sens" (wymiar reasonableness) przepuszcza błędy, które technicznie są poprawne, ale bezsensowne kontekstowo.
- **Mylenie ilości danych z dojrzałością.** Duży wolumen danych (petabajty logów) nie oznacza dobrego governance — często oznacza odwrotnie: nikt nie ma odwagi/mandatu, żeby to sprzątnąć albo się tym zająć. Rozmiar zbioru i jego jakość/governance to niezależne osie.
- **Budowa projektu AI równolegle z naprawą master data zamiast sekwencyjnie.** Presja czasowa („zarząd chce AI w tym kwartale") prowadzi do uruchamiania pilotów na wiadomo złych danych „tymczasowo" — tymczasowość ma tendencję do trwania, a wynik pilota (słaby, bo dane słabe) bywa mylnie odczytany jako „model nie działa", zamiast „dane nie były gotowe".
- **Traktowanie governance jako projektu IT.** Governance danych to decyzja biznesowa o odpowiedzialności i priorytetach (kto jest właścicielem, co jest krytyczne) — oddanie całości działowi IT bez zaangażowania właścicieli biznesowych odtwarza dokładnie ten sam problem (sierocy zbiór), tylko z ładniejszym katalogiem technicznym na wierzchu.

## 9. Źródła

- DAMA International — DAMA-DMBOK 2.0 (11 obszarów wiedzy, 8 wymiarów jakości danych): [DAMA DMBOK — About](https://www.damadmbok.org/copy-of-about-dama-dmbok), [DMBOK 2.0 Revision](https://www.damadmbok.org/dmbok2-revisions), [Atlan — DAMA DMBOK Framework Guide](https://atlan.com/dama-dmbok-framework/), [OvalEdge — What Is DAMA-DMBOK?](https://www.ovaledge.com/blog/dama-dmbok-data-governance-framework)
- Wymiary jakości danych: [DAMA-NL — Dimensions of Data Quality Research Paper](https://dama-nl.org/wp-content/uploads/2020/09/DDQ-Dimensions-of-Data-Quality-Research-Paper-version-1.2-d.d.-3-Sept-2020.pdf), [Estuary — What Is Data Quality? 8 Dimensions](https://estuary.dev/blog/data-quality/), [Clever Republic — Six most used Data Quality dimensions](https://www.cleverrepublic.com/resources/blog/the-six-most-used-data-quality-dimensions/)
- Gartner Data Governance / Enterprise Information Management Maturity Model (5 poziomów: Aware/Reactive/Proactive/Managed/Effective): [Atlan — Gartner Data Governance Maturity Model](https://atlan.com/know/gartner/data-governance-maturity-model/), [LightsOnData — Gartner data governance maturity model](https://www.lightsondata.com/data-governance-maturity-models-gartner/), [Sprinto — Data Governance Maturity Model](https://sprinto.com/blog/data-governance-maturity-model/), [Profisee — Data Governance Maturity Models](https://profisee.com/blog/data-governance-maturity-model/)
- Data Readiness for AI: [Gartner — AI-Ready Data Essentials to Capture AI Value](https://www.gartner.com/en/articles/ai-ready-data), [Impact Analytics — Data Readiness for AI: Assessment & Framework Guide](https://www.impactanalytics.ai/blog/data-readiness-for-ai), [Agility at Scale — Data Readiness Assessment for AI](https://agility-at-scale.com/ai/data/data-readiness-assessment-for-ai/), [Atlan — AI Readiness Assessment 2026 Guide](https://atlan.com/know/ai-readiness/ai-ready-data/)
- Koszt złej jakości danych i GIGO w kontekście AI: [Gartner via ORM News — $1.5 Trillion AI Spend Faces Data Quality Barriers (60% projektów AI porzuconych bez AI-ready data)](https://orm-tech.com/news/20260501-gartner-1-5-trillion-ai-spend-in-2025-faces-data-quality-bar/), [V2 Solutions — Garbage In, Garbage Out: Why Data Quality Defines AI](https://www.v2solutions.com/blogs/garbage-in-garbage-out-gigo-data-quality-ai/), [Pythian — Garbage In, Intelligence Accelerated in the Wrong Direction](https://www.pythian.com/blog/business-insights/garbage-in-intelligence-accelerated-in-the-wrong-direction-why-data-quality-is-the-bedrock-of-ai-success)
- Data inventory / catalog / stewardship / dark data / orphan datasets: [Murdio — Data Inventory vs Data Catalog](https://murdio.com/insights/data-inventory-vs-data-catalog/), [OvalEdge — Data Inventory Guide for Compliance and Security](https://www.ovaledge.com/blog/what-is-data-inventory-guide), [EWSolutions — What Is a Data Catalog?](https://www.ewsolutions.com/what-is-a-data-catalog/), [Hurix — AI Readiness Assessment: Using Dark Data](https://www.hurix.com/blogs/predictive-analytics-2-0-using-dark-data-to-forecast-skill-gaps-before-they-impact-your-business/)

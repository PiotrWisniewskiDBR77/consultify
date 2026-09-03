/**
 * PROTOTYP B1 — treść raportu końcowego Oceny (DRD).
 *
 * Dane liczbowe pochodzą z `src/services/report/drdReportSampleData.ts`
 * (SAMPLE_DRD_SCORES) i ze struktury `src/services/drdStructure.ts`
 * (39 obszarów, skale 7/5/5/7/6/6/5). Narracja jest PROTOTYPOWA — napisana
 * ręcznie, żeby właściciel ocenił DOCELOWY poziom dokumentu przed budową
 * silnika. Silnik ma odtwarzać te sekcje z danych sesji, nie ten tekst.
 */

export const META = {
  klient: 'TechProd Manufacturing Sp. z o.o.',
  klientOpis:
    'producent podzespołów elektronicznych (EMS) dla motoryzacji i automatyki przemysłowej · 468 osób · 3 zakłady (Wrocław, Mielec, Ostrawa) · przychód 312 mln PLN (2025)',
  tytul: 'Raport z Oceny Dojrzałości Cyfrowej',
  metodyka: 'Digital Readiness Diagnosis (DRD) — 7 osi, 39 obszarów',
  wersja: 'Wersja 1.0 · dokument zatwierdzony przez partnera prowadzącego',
  dataRaportu: '3 września 2026',
  okresBadania: '11–27 sierpnia 2026',
  zespolDoradczy: [
    ['dr Piotr Wiśniewski', 'partner prowadzący, autor metodyki DRD'],
    ['Anna Kowal', 'konsultant wiodący, prowadzenie wywiadów'],
    ['Marek Lis', 'analityk danych, weryfikacja dowodów systemowych'],
  ],
  zespolKlienta: [
    ['Jacek Andrzejewski', 'Prezes Zarządu'],
    ['Ewa Roman', 'Dyrektor Operacyjny'],
    ['Tomasz Bielak', 'Dyrektor Finansowy'],
    ['Rafał Nowicki', 'Dyrektor IT'],
    ['Grzegorz Sowa', 'Dyrektor Produkcji'],
    ['Katarzyna Wilk', 'Dyrektor Sprzedaży'],
    ['Michał Duda', 'Dyrektor Logistyki'],
    ['Iwona Lech', 'Dyrektor HR'],
  ],
  kalendarz: [
    ['11–22.08.2026', '18 wywiadów strukturyzowanych (kadra zarządzająca, kierownicy, specjaliści)'],
    ['14.08.2026', 'wizyta w zakładzie Wrocław — linie SMT, montaż końcowy, magazyny'],
    ['19.08.2026', 'przegląd systemów: ERP, MES, WMS, CRM, narzędzia HR, infrastruktura sieciowa'],
    ['21.08.2026', 'przegląd dokumentacji: polityki SZBI, certyfikat ISO 27001, raporty KPI'],
    ['27.08.2026', 'warsztat walidacyjny — potwierdzenie poziomów AS-IS i uzgodnienie TO-BE'],
    ['03.09.2026', 'wydanie raportu'],
  ],
  benchmark: 'Benchmark branżowy (produkcja, Polska): 46% skali',
};

// Wynik ogólny liczony jako średnia z procentów skali osi (wszystkie osie mają
// równą wagę; skale są różne, więc porównanie idzie po procencie skali).
export const WYNIK_OGOLNY = { procent: 54.6, benchmark: 46 };

export const OSIE = [
  {
    nr: 1,
    nazwa: 'Procesy Cyfrowe',
    skala: 7,
    obszary: 9,
    asIs: 4.22,
    toBe: 5.67,
    procent: 60.3,
    werdykt:
      'Produkcja i finanse pracują na zintegrowanym ERP, ale logistyka i HR pozostały poza obiegiem danych i hamują cały łańcuch.',
    zakres:
      'Oś ocenia stopień ucyfrowienia dziewięciu procesów podstawowych: sprzedaży, marketingu, technologii i R&D, zakupów, logistyki, produkcji, jakości, finansów oraz HR. Skala 1–7 prowadzi od rejestracji danych, przez kontrolę i automatyzację, po MES, ERP i wsparcie algorytmiczne.',
    pytania: [
      'Pokażcie ostatnie 10 zamówień w systemie — jak szybko od podpisania umowy trafił do niego wpis: tego samego dnia, kilka dni później, czy na koniec miesiąca?',
      'Jak przebiega kontrola budżetu: system ostrzega o przekroczeniu planu w czasie rzeczywistym, czy dowiadujecie się po miesiącu z raportu?',
      'Które linie raportują wykonanie automatycznie, a gdzie ktoś przepisuje wynik do arkusza? Pokażcie oba przypadki na danych z sierpnia.',
      'Gdzie zapisana jest informacja o kompetencjach pracownika i kto ją aktualizuje?',
    ],
    odpowiedzi: [
      'Zamówienia trafiają do ERP tego samego dnia — eksport dziesięciu ostatnich zleceń potwierdził 10/10 wpisów w ciągu 24 godzin.',
      'Budżet sprzedaży jest prowadzony w ERP z alertem przekroczenia; plan zakupowy nadal powstaje w arkuszu kontrolera i jest wprowadzany do systemu raz w miesiącu.',
      'Dwie z trzech linii SMT raportują OEE do MES co zmianę. Montaż końcowy raportuje ręcznie — kierownik przepisuje wynik do arkusza następnego dnia rano.',
      'Magazyn wyrobów gotowych obsługuje WMS; magazyn komponentów prowadzony jest na etykietach papierowych i inwentaryzacji kwartalnej.',
      'Kompetencje pracowników nie są zapisane w żadnym systemie. Rekrutacja i ewidencja czasu pracy działają w dwóch niepowiązanych narzędziach.',
    ],
    dowody: [
      ['Eksport 10 zleceń sprzedaży z ERP (12.08.2026): 10/10 wpisanych ≤ 24 h', 'ERP, dział sprzedaży', 'Potwierdzony'],
      ['Zrzut pulpitu OEE linii SMT-1 i SMT-2 z 14.08.2026, dane co zmianę', 'MES', 'Potwierdzony'],
      ['Arkusz raportowania montażu końcowego, sierpień 2026 (wpisy ręczne, opóźnienie 1 dzień)', 'Kierownik produkcji', 'Potwierdzony'],
      ['Obieg zamówień zakupowych i miejsce planu zakupowego', 'Wywiad — Dyrektor Logistyki', 'Deklarowany'],
      ['Kartoteka kompetencji pracowników', '—', 'Brak dowodu'],
    ],
    tabelaObszarow: [
      ['1A', 'Procesy Sprzedaży', 5, 6, 'Potwierdzony'],
      ['1B', 'Procesy Marketingowe', 4, 6, 'Potwierdzony'],
      ['1C', 'Technologia Procesowa i R&D', 5, 6, 'Potwierdzony'],
      ['1D', 'Procesy Zakupowe', 4, 5, 'Deklarowany'],
      ['1E', 'Procesy Logistyczne', 3, 6, 'Potwierdzony'],
      ['1F', 'Procesy Produkcyjne', 5, 6, 'Potwierdzony'],
      ['1G', 'Procesy Jakości', 4, 5, 'Potwierdzony'],
      ['1H', 'Zarządzanie Finansami', 5, 6, 'Potwierdzony'],
      ['1I', 'Procesy HR', 3, 5, 'Niepełny'],
    ],
    wnioski: [
      'Oś 1 jest najmocniejszym filarem organizacji i jednocześnie mieści jej najgłębszą pojedynczą lukę. Rdzeń wytwórczy — produkcja, jakość, finanse, sprzedaż — pracuje na poziomie 4–5, czyli na realnie zintegrowanych systemach, a nie na deklaracjach: dane z linii SMT i z ERP dały się okazać na miejscu, w bieżących datach.',
      'Poza tym rdzeniem organizacja pracuje tak, jak przed wdrożeniem ERP. Logistyka komponentów (1E, poziom 3 przy celu 6) i HR (1I, poziom 3) nie zasilają wspólnego obiegu danych. To nie jest kwestia wygody: brak stanów magazynowych w czasie rzeczywistym jest dziś pierwszym powodem przestojów planistycznych zgłaszanych przez produkcję, a brak kartoteki kompetencji uniemożliwia zaplanowanie jakiegokolwiek programu rozwoju z osi 5.',
      'Montaż końcowy poza MES tworzy jednodniowe opóźnienie w obrazie wykonania. Przy dwóch liniach raportujących automatycznie koszt domknięcia trzeciej jest niski, a efekt — spójny obraz produkcji — natychmiastowy.',
    ],
    rekomendacje: [
      ['Objąć magazyn komponentów tym samym WMS co wyroby gotowe (kody kreskowe, terminale, inwentaryzacja ciągła)', 'Wysoki', '2 kwartały', 'Dyrektor Logistyki'],
      ['Wpiąć montaż końcowy do MES na tych samych wskaźnikach co linie SMT', 'Wysoki', '1 kwartał', 'Dyrektor Produkcji'],
      ['Uruchomić jedną ewidencję kompetencji w systemie HR — warunek wstępny dla osi 5 i 7', 'Średni', '2 kwartały', 'Dyrektor HR'],
    ],
    sufit:
      'Poziom 7 (wsparcie algorytmiczne) nie jest rekomendowany dla żadnego obszaru osi 1 w horyzoncie 24 miesięcy. Warunkiem wejścia jest kompletność danych procesowych, której dziś nie ma w logistyce i w HR — algorytm na niekompletnych danych pogłębi błąd, zamiast go usunąć.',
    liniaDecyzyjna: [
      'Domknięcie obiegu danych procesowych poza rdzeniem wytwórczym',
      'Priorytet 2 z 7',
      '12 miesięcy',
      'Jeden właściciel danych magazynowych po stronie operacji',
    ],
  },
  {
    nr: 2,
    nazwa: 'Produkty Cyfrowe',
    skala: 5,
    obszary: 5,
    asIs: 3.0,
    toBe: 4.4,
    procent: 60.0,
    werdykt:
      'Sterowniki z łącznością są realną przewagą, ale klient nie ma żadnego kanału cyfrowego, w którym mógłby z niej skorzystać.',
    zakres:
      'Oś ocenia, ile wartości produktu powstaje cyfrowo: funkcje dostępne wyłącznie w warstwie software, społeczność wokół produktu, komponent ICT, dopasowanie do oczekiwań klienta i skalowalność. Skala 1–5, od produktu wyłącznie fizycznego po produkt, którego rozwój jest sterowany danymi z eksploatacji.',
    pytania: [
      'Który z Waszych produktów ma funkcję dostępną wyłącznie cyfrowo? Pokażcie ją na żywo.',
      'Ilu klientów korzystało z tej funkcji w ostatnim miesiącu i skąd znacie tę liczbę?',
      'Kiedy ostatnio zmieniliście produkt na podstawie danych z jego użytkowania, a nie z rozmowy z klientem?',
    ],
    odpowiedzi: [
      'Moduły sterujące serii TP-40 mają łączność i raportują telemetrię — ale do chmury odbiorcy OEM, nie do TechProd. Firma nie widzi, jak jej produkt pracuje u klienta.',
      'Nie istnieje portal klienta. Zgłoszenia serwisowe wpływają mailem i telefonicznie, rejestrowane są w CRM ręcznie.',
      'Zmiany konstrukcyjne wynikają z reklamacji i rozmów handlowych. Nie ma pętli danych z eksploatacji.',
      'Konfigurator produktu istnieje, ale wyłącznie w wersji wewnętrznej dla handlowców.',
    ],
    dowody: [
      ['Demonstracja telemetrii modułu TP-40 na stanowisku testowym (14.08.2026)', 'Dział R&D', 'Potwierdzony'],
      ['Brak portalu klienta — sprawdzone na stronie i w CRM', 'Inspekcja własna', 'Potwierdzony'],
      ['Liczba aktywnych użytkowników funkcji cyfrowych', '—', 'Brak pomiaru'],
      ['Konfigurator wewnętrzny — pokaz na koncie handlowca', 'Dział Sprzedaży', 'Potwierdzony'],
    ],
    tabelaObszarow: [
      ['2A', 'Produkty Cyfrowe', 3, 4, 'Potwierdzony'],
      ['2B', 'Produkty Społecznościowe', 2, 4, 'Potwierdzony'],
      ['2C', 'Produkty ICT', 4, 5, 'Potwierdzony'],
      ['2D', 'Dopasowanie Produktu do Oczekiwań Klienta', 3, 4, 'Deklarowany'],
      ['2E', 'Skalowalność Produktu', 3, 5, 'Deklarowany'],
    ],
    wnioski: [
      'Komponent ICT produktu jest mocny (2C, poziom 4) i to jest realny kapitał: elektronika TechProd już dziś generuje dane. Problem polega na tym, że cała ta wartość wypływa do odbiorcy OEM, a producent nie zatrzymuje z niej niczego — ani wiedzy o awaryjności, ani podstawy do usługi.',
      'Brak kanału cyfrowego do klienta końcowego (2A/2B) blokuje jednocześnie oś 3: nie da się uruchomić modelu usługowego bez miejsca, w którym klient tę usługę odbiera. To zależność, nie osobne zadanie.',
      'Dopasowanie produktu (2D) i skalowalność (2E) oparte są dziś na deklaracjach — nie ma pomiaru, który by je potwierdził. Do czasu uruchomienia zbierania telemetrii po stronie TechProd oceny 3 w tych obszarach należy traktować jako ostrożne, nie jako ustalone.',
    ],
    rekomendacje: [
      ['Zapewnić własny odbiór telemetrii TP-40 (kanał równoległy do OEM, zgoda kontraktowa)', 'Wysoki', '2 kwartały', 'Dyrektor R&D'],
      ['Uruchomić portal klienta: dokumentacja, zgłoszenia serwisowe, historia urządzenia', 'Średni', '3 kwartały', 'Dyrektor Sprzedaży'],
      ['Wprowadzić jeden mierzalny wskaźnik użycia funkcji cyfrowych i raportować go miesięcznie', 'Średni', '1 kwartał', 'Dyrektor R&D'],
    ],
    sufit:
      'Poziom 5 (produkt sterowany danymi, ekspercki) nie jest rekomendowany. Przy modelu B2B z ograniczoną liczbą odbiorców OEM koszt budowy pełnej platformy produktowej nie zwraca się w horyzoncie 24 miesięcy. Rekomendowany sufit dla tej osi to poziom 4.',
    liniaDecyzyjna: [
      'Odzyskanie danych z eksploatacji własnego produktu',
      'Priorytet 4 z 7',
      '18 miesięcy',
      'Zgoda kontraktowa odbiorców OEM na równoległy kanał telemetrii',
    ],
  },
  {
    nr: 3,
    nazwa: 'Cyfrowe Modele Biznesowe',
    skala: 5,
    obszary: 5,
    asIs: 2.4,
    toBe: 4.2,
    procent: 48.0,
    werdykt:
      'Firma sprzedaje wyłącznie sztuki i godziny. Żaden przychód nie pochodzi z modelu cyfrowego, choć dane do tego już istnieją.',
    zakres:
      'Oś ocenia, czy organizacja zarabia w sposób umożliwiony przez cyfryzację: e-commerce, rozwiązania platformowe, model usługowy (as-a-service), współdzielenie zasobów i monetyzacja danych. Skala 1–5.',
    pytania: [
      'Jaka część przychodu 2025 pochodzi ze źródła, które nie istniałoby bez cyfryzacji? Pokażcie tę pozycję w rachunku.',
      'Czy jakikolwiek klient płaci Wam cyklicznie za dostępność, a nie za sztukę?',
      'Kto w firmie odpowiada za rozwój nowych modeli przychodowych i ile czasu na to poświęca?',
    ],
    odpowiedzi: [
      'Cały przychód 2025 pochodzi ze sprzedaży wyrobu i usług inżynierskich rozliczanych roboczogodzinowo. Pozycji cyfrowej w rachunku nie ma.',
      'Nie ma żadnej umowy abonamentowej ani rozliczanej za dostępność. Serwis rozliczany jest za zdarzenie.',
      'Nikt nie ma tego w zakresie obowiązków. Temat pojawia się na zarządzie raz na kwartał jako punkt informacyjny.',
      'Sklep internetowy dla części zamiennych istnieje, ale realizuje mniej niż 2% wartości sprzedaży części.',
    ],
    dowody: [
      ['Struktura przychodu 2025 — zestawienie z systemu finansowo-księgowego', 'Dyrektor Finansowy', 'Potwierdzony'],
      ['Sklep części zamiennych — raport sprzedaży 01–07/2026 (1,8% wartości)', 'Dział Sprzedaży', 'Potwierdzony'],
      ['Brak umów abonamentowych — przegląd rejestru umów', 'Dział Prawny', 'Potwierdzony'],
      ['Rozmowy z dwoma odbiorcami o modelu dostępnościowym', 'Wywiad — Dyrektor Sprzedaży', 'Deklarowany'],
    ],
    tabelaObszarow: [
      ['3A', 'Modele E-commerce', 3, 4, 'Potwierdzony'],
      ['3B', 'Rozwiązania Platformowe', 2, 4, 'Potwierdzony'],
      ['3C', 'Model As-a-Service', 2, 4, 'Potwierdzony'],
      ['3D', 'Modele Współdzielenia Zasobów', 2, 4, 'Deklarowany'],
      ['3E', 'Modele Monetyzacji Danych', 3, 5, 'Niepełny'],
    ],
    wnioski: [
      'To druga najniższa oś w badaniu i jedyna, w której niska ocena nie wynika z braku technologii. Firma ma czujniki w produkcie, ma MES na liniach i ma dane serwisowe — brakuje wyłącznie decyzji, że ktoś ma za te modele odpowiadać i za nie rozliczać.',
      'Ocena 3 w obszarze monetyzacji danych (3E) opiera się na materiale niepełnym: rozmowy z odbiorcami o odpłatnym dostępie do danych jakościowych toczyły się, ale nie zakończyły ofertą. Traktujemy to jako sygnał gotowości rynku, nie jako zdolność organizacji.',
      'Kolejność ma znaczenie: model usługowy (3C) wymaga wcześniej portalu klienta z osi 2 i danych telemetrycznych po stronie TechProd. Uruchamianie 3C przed tymi dwoma warunkami skończy się usługą obsługiwaną ręcznie, czyli droższą od sprzedaży wyrobu.',
    ],
    rekomendacje: [
      ['Wskazać właściciela nowych modeli przychodowych na poziomie zarządu (rola, nie projekt)', 'Wysoki', '1 kwartał', 'Prezes Zarządu'],
      ['Przygotować studium wykonalności Equipment-as-a-Service dla jednego odbiorcy pilotażowego', 'Średni', '3 kwartały', 'Dyrektor Sprzedaży'],
      ['Rozszerzyć sklep części zamiennych o zamówienia B2B z rabatem kontraktowym', 'Średni', '2 kwartały', 'Dyrektor Sprzedaży'],
    ],
    sufit:
      'Poziom 5 (model ekspercki, platformowy) nie jest rekomendowany dla żadnego obszaru tej osi. Skala firmy i struktura odbiorców nie uzasadniają ekonomicznie roli operatora platformy. Wartość leży w poziomie 4 — powtarzalnym przychodzie usługowym przy istniejącej bazie klientów.',
    liniaDecyzyjna: [
      'Jedno powtarzalne źródło przychodu obok sprzedaży wyrobu',
      'Priorytet 5 z 7',
      '24 miesiące',
      'Właściciel tematu z mandatem zarządu; start dopiero po osi 2',
    ],
  },
  {
    nr: 4,
    nazwa: 'Zarządzanie Danymi',
    skala: 7,
    obszary: 5,
    asIs: 4.0,
    toBe: 5.8,
    procent: 57.1,
    werdykt:
      'Dane są zbierane szeroko i przechowywane porządnie, ale analiza kończy się na raporcie opisowym — nikt w firmie nie przewiduje.',
    zakres:
      'Oś ocenia cały cykl życia danych: zbieranie, metodologię przechowywania, komunikację między systemami, analizę wielkich zbiorów i moc obliczeniową. Skala 1–7 prowadzi od zbierania ręcznego po pełną kontrolę optyczną i przetwarzanie na brzegu sieci.',
    pytania: [
      'Skąd pochodzą dane, na podstawie których zarząd podejmuje decyzje operacyjne, i jak są aktualne w momencie decyzji?',
      'Kiedy ostatnio ktoś użył danych historycznych do prognozy, a nie do opisu przeszłości? Pokażcie ten materiał.',
      'Ile ręcznych scaleń danych trzeba wykonać, żeby powstał miesięczny raport zarządczy?',
    ],
    odpowiedzi: [
      'Dane produkcyjne płyną z MES automatycznie; dane magazynowe i HR wprowadzane są ręcznie. Raport zarządczy powstaje z czterech eksportów scalanych w arkuszu przez kontrolera.',
      'Nie ma prognozy opartej o dane historyczne. Planowanie produkcji opiera się na zamówieniach potwierdzonych i doświadczeniu planisty.',
      'Hurtownia danych nie istnieje. Dane historyczne z MES są dostępne 18 miesięcy wstecz, potem są archiwizowane bez indeksu.',
      'Środowisko hybrydowe (serwerownia zakładowa + chmura publiczna) działa stabilnie; retencja i kopie zapasowe są udokumentowane.',
    ],
    dowody: [
      ['Instrukcja przygotowania raportu zarządczego (4 eksporty, scalanie w arkuszu)', 'Kontroling', 'Potwierdzony'],
      ['Polityka retencji i harmonogram kopii zapasowych, przegląd z 19.08.2026', 'Dyrektor IT', 'Potwierdzony'],
      ['Brak hurtowni danych i katalogu danych — sprawdzone w inwentarzu systemów', 'Inspekcja własna', 'Potwierdzony'],
      ['Dostępność danych MES 18 miesięcy wstecz', 'Wywiad — administrator MES', 'Deklarowany'],
    ],
    tabelaObszarow: [
      ['4A', 'Zbieranie Danych', 5, 6, 'Potwierdzony'],
      ['4B', 'Metodologia Przechowywania Danych', 4, 6, 'Potwierdzony'],
      ['4C', 'Komunikacja Danych', 4, 6, 'Potwierdzony'],
      ['4D', 'Analiza Big Data', 3, 6, 'Potwierdzony'],
      ['4E', 'Przetwarzanie Danych', 4, 5, 'Deklarowany'],
    ],
    wnioski: [
      'Fundament jest zbudowany prawidłowo: dane są zbierane z maszyn (4A, poziom 5), przechowywane według opisanej metodyki i wymieniane między systemami. To rzadkie w firmach tej wielkości i stanowi realny kapitał.',
      'Kapitał ten nie pracuje. Analiza (4D, poziom 3 przy celu 6) to najgłębsza luka w całej ocenie, obok logistyki i governance AI. Organizacja opisuje przeszłość i nie prognozuje przyszłości — mimo że ma osiemnaście miesięcy danych produkcyjnych o jakości wystarczającej do modelu predykcyjnego.',
      'Cztery ręczne scalenia w miesięcznym raporcie zarządczym to nie tylko koszt pracy kontrolera. To także punkt, w którym liczba przestaje mieć jednoznaczne źródło — a od tego zaczyna się nieufność do danych na poziomie zarządu.',
      'Oś 4 jest warunkiem wstępnym osi 7. Bez hurtowni i katalogu danych żaden model AI nie wyjdzie poza pilotaż na kopii pliku.',
    ],
    rekomendacje: [
      ['Zbudować hurtownię danych obejmującą MES, ERP i WMS, z katalogiem i jednoznacznym właścicielem każdego zbioru', 'Wysoki', '3 kwartały', 'Dyrektor IT'],
      ['Zautomatyzować miesięczny raport zarządczy — zero ręcznych scaleń', 'Wysoki', '2 kwartały', 'Kontroling'],
      ['Uruchomić pierwszy model prognostyczny na danych MES (predykcja awarii lub wydajności linii)', 'Średni', '4 kwartały', 'Dyrektor IT'],
    ],
    sufit:
      'Poziom 7 (kontrola optyczna) rekomendujemy wyłącznie dla obszaru zbierania danych i dopiero po domknięciu 4D. W obszarze przetwarzania (4E) cel 5 jest wystarczający: przetwarzanie brzegowe ma sens przy zastosowaniach czasu rzeczywistego, których TechProd dziś nie ma.',
    liniaDecyzyjna: [
      'Od opisu przeszłości do prognozy',
      'Priorytet 3 z 7',
      '18 miesięcy',
      'Hurtownia danych z właścicielem biznesowym, nie tylko technicznym',
    ],
  },
  {
    nr: 5,
    nazwa: 'Kultura Transformacji',
    skala: 6,
    obszary: 5,
    asIs: 3.6,
    toBe: 4.8,
    procent: 60.0,
    werdykt:
      'Zarząd realnie sponsoruje zmianę, ale organizacja nie ma czasu ani ludzi, żeby unieść ją poza pilotażami.',
    zakres:
      'Oś ocenia zdolność organizacji do przeprowadzenia zmiany: postawy przywódcze, gotowość na zmianę, ciągły rozwój kompetencji, kulturę innowacji i dostępność zasobów. Skala 1–6, od postawy pasywnej po przywództwo transformacyjne.',
    pytania: [
      'Kiedy ostatnio zarząd odwołał decyzję operacyjną, bo dane pokazały coś innego niż intuicja? Opiszcie ten przypadek.',
      'Ile godzin w miesiącu ma osoba odpowiedzialna za projekt cyfrowy na ten projekt, poza swoimi obowiązkami liniowymi?',
      'Ile pomysłów pracowniczych z ostatniego roku zostało wdrożonych i gdzie jest ich rejestr?',
    ],
    odpowiedzi: [
      'Zarząd wycofał się z planu rozbudowy linii SMT-3 po analizie OEE, która pokazała rezerwę na istniejących liniach. Decyzja udokumentowana w protokole z marca 2026.',
      'Żaden projekt cyfrowy nie ma dedykowanego etatu. Kierownicy prowadzą je obok pracy liniowej, średnio 4–6 godzin miesięcznie.',
      'Rejestr pomysłów pracowniczych istnieje w formie skrzynki mailowej. W 2025 wpłynęło 31 zgłoszeń, wdrożono 4, informacja zwrotna trafiła do 9.',
      'Szkolenia cyfrowe odbywają się przy wdrożeniach, nie w ramach planu rozwoju. Nie ma mapy kompetencji.',
    ],
    dowody: [
      ['Protokół zarządu z 11.03.2026 — decyzja o rezygnacji z SMT-3 na podstawie analizy OEE', 'Sekretariat Zarządu', 'Potwierdzony'],
      ['Skrzynka pomysłów pracowniczych, 31 zgłoszeń / 4 wdrożenia w 2025', 'Dział HR', 'Potwierdzony'],
      ['Brak etatów dedykowanych projektom cyfrowym — struktura organizacyjna 08/2026', 'Dział HR', 'Potwierdzony'],
      ['Deklarowany czas kierowników na projekty (4–6 h/mies.)', 'Wywiady — 5 kierowników', 'Deklarowany'],
    ],
    tabelaObszarow: [
      ['5A', 'Postawy przywódcze', 4, 5, 'Potwierdzony'],
      ['5B', 'Gotowość na zmianę', 4, 5, 'Potwierdzony'],
      ['5C', 'Ciągły rozwój kompetencji', 3, 4, 'Potwierdzony'],
      ['5D', 'Kultura innowacji', 3, 5, 'Potwierdzony'],
      ['5E', 'Dostępność zasobów', 4, 5, 'Deklarowany'],
    ],
    wnioski: [
      'Przywództwo jest mocną stroną i jest udokumentowane, nie deklarowane: zarząd odwołał własną decyzję inwestycyjną, bo dane pokazały co innego. To zachowanie poziomu 4–5 i najlepszy pojedynczy sygnał w całej ocenie.',
      'Sponsorowanie zmiany nie przekłada się jednak na zdolność wykonawczą. Cztery do sześciu godzin miesięcznie na projekt cyfrowy oznacza, że każde przedsięwzięcie z map drogowych tego raportu będzie konkurować z bieżącą produkcją i przegra. To jest przyczyna, dla której poprzednie inicjatywy kończyły się na pilotażu.',
      'Rejestr pomysłów, który odpowiada na 9 z 31 zgłoszeń, po dwóch latach przestanie dostawać zgłoszenia. Kultura innowacji (5D, poziom 3) nie wymaga tu nowego narzędzia, tylko zobowiązania do odpowiedzi.',
      'Bez kartoteki kompetencji (obszar 1I z osi 1) rozwój kompetencji nie ma od czego zacząć. To zależność między osiami, nie osobne opóźnienie.',
    ],
    rekomendacje: [
      ['Wydzielić 0,5 etatu na koordynację portfela cyfrowego (rola, nie dodatek do obowiązków)', 'Wysoki', '1 kwartał', 'Dyrektor Operacyjny'],
      ['Wprowadzić zobowiązanie do odpowiedzi na każde zgłoszenie pracownicze w 14 dni', 'Średni', '1 kwartał', 'Dyrektor HR'],
      ['Zbudować mapę kompetencji cyfrowych na bazie ewidencji z osi 1 i zaplanować rozwój na 12 miesięcy', 'Średni', '3 kwartały', 'Dyrektor HR'],
    ],
    sufit:
      'Poziom 6 (przywództwo transformacyjne) nie jest celem na najbliższe dwa lata. Poziom 5 przy pełnej dostępności zasobów da organizacji więcej niż formalne dojście do szczytu skali przy tych samych czterech godzinach miesięcznie.',
    liniaDecyzyjna: [
      'Od sponsorowania zmiany do zdolności jej wykonania',
      'Priorytet 6 z 7',
      '12 miesięcy',
      'Realne godziny ludzi w strukturze — warunek powodzenia pozostałych osi',
    ],
  },
  {
    nr: 6,
    nazwa: 'Cyberbezpieczeństwo',
    skala: 6,
    obszary: 5,
    asIs: 3.4,
    toBe: 4.6,
    procent: 56.7,
    ryzyko:
      'Certyfikat ISO 27001 obejmuje 100% infrastruktury biurowej i 0% sieci produkcyjnej (OT). Linie SMT pracują na poziomie 5 dojrzałości procesowej w sieci, która nie jest objęta monitoringiem ani planem reagowania.',
    werdykt:
      'ISO 27001 pokrywa IT biurowe. Sieć produkcyjna pozostaje poza zakresem certyfikacji i poza jakimkolwiek monitoringiem.',
    zakres:
      'Oś ocenia strategię i zarządzanie ryzykiem, ochronę sieci i systemów, ochronę danych, edukację i jakość systemów oraz plany awaryjne. Skala 1–6, od braku strategii po ciągły monitoring i ocenę skuteczności.',
    pytania: [
      'Jaki jest zakres certyfikacji ISO 27001 — pokażcie deklarację stosowania i granicę systemu.',
      'Kiedy ostatnio przeprowadziliście test odtworzenia z kopii zapasowej i ile trwało odtworzenie?',
      'Kto zostaje powiadomiony w pierwszej godzinie po wykryciu incydentu w sieci produkcyjnej i skąd to wiadomo?',
    ],
    odpowiedzi: [
      'Zakres certyfikacji obejmuje siedzibę i infrastrukturę biurową. Sieć produkcyjna została z zakresu wyłączona przy pierwszej certyfikacji w 2023 i nigdy nie została do niego włączona.',
      'Ostatni test odtworzenia z kopii wykonano w listopadzie 2025 dla systemów biurowych; odtworzenie MES nigdy nie było testowane.',
      'Plan reagowania na incydenty opisuje ścieżkę dla IT. Dla OT nie ma wskazanej osoby ani ścieżki powiadomienia.',
      'Szkolenia z bezpieczeństwa objęły 92% pracowników biurowych i 11% pracowników produkcji.',
    ],
    dowody: [
      ['Deklaracja stosowania ISO 27001 — granica systemu wyklucza sieć OT', 'Pełnomocnik SZBI', 'Potwierdzony'],
      ['Protokół testu odtworzenia z 18.11.2025 (wyłącznie systemy biurowe)', 'Dyrektor IT', 'Potwierdzony'],
      ['Plan reagowania na incydenty — brak ścieżki dla OT', 'Pełnomocnik SZBI', 'Potwierdzony'],
      ['Rejestr szkoleń: 92% biuro / 11% produkcja', 'Dział HR', 'Potwierdzony'],
    ],
    tabelaObszarow: [
      ['6A', 'Strategia i zarządzanie ryzykiem', 3, 4, 'Potwierdzony'],
      ['6B', 'Ochrona sieci i systemów', 4, 5, 'Potwierdzony'],
      ['6C', 'Ochrona danych', 4, 5, 'Potwierdzony'],
      ['6D', 'Edukacja i jakość systemów', 3, 4, 'Potwierdzony'],
      ['6E', 'Plany awaryjne', 3, 5, 'Potwierdzony'],
    ],
    wnioski: [
      'Cyberbezpieczeństwo jest jedyną osią w tym badaniu, w której brak działania oznacza ryzyko, a nie utraconą korzyść. Pozostałe sześć osi opisuje wartość, której firma nie zbiera. Ta opisuje stratę, którą może ponieść.',
      'Certyfikat ISO 27001 działa i jest utrzymywany rzetelnie — ale jego zakres został ustalony w 2023 dla organizacji, która nie miała jeszcze MES na liniach. Od tego czasu dojrzałość procesowa produkcji wzrosła do poziomu 5, a granica systemu bezpieczeństwa nie przesunęła się o metr.',
      'Nieprzetestowane odtworzenie MES jest osobnym, mierzalnym zagrożeniem: organizacja nie zna czasu powrotu do produkcji po awarii systemu, od którego zależy raportowanie dwóch z trzech linii.',
      'Jedenaście procent przeszkolonej produkcji przy 92% w biurze pokazuje, gdzie faktycznie przebiega granica uwagi — i pokrywa się dokładnie z granicą certyfikacji.',
    ],
    rekomendacje: [
      ['Rozszerzyć zakres SZBI na sieć OT: inwentaryzacja, segmentacja, monitoring, ścieżka reagowania', 'Krytyczny', '2 kwartały', 'Pełnomocnik SZBI / Dyrektor IT'],
      ['Przeprowadzić i udokumentować test odtworzenia MES z kopii zapasowej', 'Krytyczny', '1 kwartał', 'Dyrektor IT'],
      ['Objąć produkcję tym samym programem szkoleń co biuro (cel: 90% w 12 miesięcy)', 'Wysoki', '3 kwartały', 'Dyrektor HR'],
    ],
    sufit:
      'Poziom 6 (ciągły monitoring i ocena skuteczności) jest uzasadniony wyłącznie dla ochrony sieci i systemów po objęciu OT. W pozostałych obszarach poziom 4–5 odpowiada profilowi ryzyka firmy tej wielkości i nie wymaga budowy własnego centrum operacji bezpieczeństwa.',
    liniaDecyzyjna: [
      'Przesunięcie granicy bezpieczeństwa na halę produkcyjną',
      'Priorytet 1 z 7',
      '6 miesięcy',
      'Decyzja zarządu o rozszerzeniu zakresu certyfikacji przed kolejnym audytem',
    ],
  },
  {
    nr: 7,
    nazwa: 'Dojrzałość AI',
    skala: 5,
    obszary: 5,
    asIs: 2.0,
    toBe: 4.0,
    procent: 40.0,
    werdykt:
      'Dwa pilotaże AI działają na danych kopiowanych ręcznie. Nie ma ani właściciela, ani zasad, ani ścieżki na produkcję.',
    zakres:
      'Oś ocenia fundamenty danych pod AI, procesy wspierane przez AI, AI w produktach i usługach, governance wraz z bezpieczeństwem i etyką oraz kompetencje i kulturę AI. Skala 1–5, od danych rozproszonych po autonomiczną inteligencję danych.',
    pytania: [
      'Które rozwiązanie AI pracuje dziś na danych produkcyjnych bez udziału człowieka w kopiowaniu danych?',
      'Kto zatwierdza użycie modelu językowego na danych firmy i na jakiej podstawie?',
      'Ile osób w firmie potrafi samodzielnie ocenić wynik modelu i odrzucić go, gdy jest błędny?',
    ],
    odpowiedzi: [
      'Dwa pilotaże: predykcja zużycia narzędzi na linii SMT-1 i klasyfikacja zdjęć z kontroli jakości. Oba pracują na plikach eksportowanych ręcznie raz w tygodniu.',
      'Nie ma polityki użycia AI. Pracownicy korzystają z ogólnodostępnych narzędzi bez zasad dotyczących danych firmowych.',
      'Kompetencje analityczne skupione są w jednej osobie w dziale IT. Poza nią nie ma osoby zdolnej ocenić wynik modelu.',
      'Zarząd deklaruje AI jako priorytet 2027, bez przypisanego budżetu i właściciela.',
    ],
    dowody: [
      ['Pilotaż predykcji zużycia narzędzi — notatnik analityczny, dane z eksportu 09.08.2026', 'Dział IT', 'Potwierdzony'],
      ['Pilotaż klasyfikacji zdjęć kontroli jakości — zbiór testowy 1 200 zdjęć', 'Dział Jakości', 'Potwierdzony'],
      ['Brak polityki użycia AI — sprawdzone w rejestrze polityk', 'Pełnomocnik SZBI', 'Potwierdzony'],
      ['Deklaracja zarządu o priorytecie AI na 2027', 'Wywiad — Prezes Zarządu', 'Deklarowany'],
    ],
    tabelaObszarow: [
      ['7A', 'Dane i Fundamenty AI', 2, 4, 'Potwierdzony'],
      ['7B', 'Procesy Wspierane przez AI', 2, 4, 'Potwierdzony'],
      ['7C', 'AI w Produktach i Usługach', 2, 4, 'Potwierdzony'],
      ['7D', 'Governance, Bezpieczeństwo i Etyka', 1, 4, 'Potwierdzony'],
      ['7E', 'Kompetencje i Kultura AI', 3, 4, 'Deklarowany'],
    ],
    wnioski: [
      'To najniższa oś w badaniu — 40% skali — i jedyna, w której jeden obszar stoi na poziomie 1. Governance AI (7D) nie istnieje: nie ma polityki, właściciela ani zasad postępowania z danymi firmowymi w narzędziach zewnętrznych. Przy 468 pracownikach oznacza to niekontrolowane użycie, którego skali firma nie zna.',
      'Dwa pilotaże są dobrą wiadomością i złą jednocześnie. Dobrą, bo pokazują, że w organizacji są ludzie zdolni zbudować działający model. Złą, bo po roku obydwa nadal pracują na plikach kopiowanych ręcznie — nie z powodu modelu, tylko z powodu braku hurtowni z osi 4.',
      'Nie da się podnieść tej osi bez osi 4. Fundamenty danych (7A, poziom 2) są funkcją analizy danych (4D, poziom 3), a nie osobnym projektem. Kolejność jest wymuszona metodyką i potwierdzona stanem faktycznym.',
      'Kompetencje AI (7E) oceniamy na 3 na podstawie deklaracji i obserwacji jednej osoby. To ocena ostrożna: koncentracja wiedzy w jednym człowieku jest ryzykiem ciągłości, nie kapitałem.',
    ],
    rekomendacje: [
      ['Przyjąć politykę użycia AI: dozwolone narzędzia, klasy danych, zasady weryfikacji wyniku, właściciel', 'Krytyczny', '1 kwartał', 'Prezes Zarządu / Pełnomocnik SZBI'],
      ['Wpiąć oba pilotaże do hurtowni danych z osi 4 — koniec z kopiowaniem plików', 'Wysoki', '3 kwartały', 'Dyrektor IT'],
      ['Rozszerzyć kompetencje analityczne poza jedną osobę (2 osoby przeszkolone, jedna rezerwowa)', 'Wysoki', '2 kwartały', 'Dyrektor IT / HR'],
    ],
    sufit:
      'Poziom 5 (autonomiczna inteligencja danych) nie jest celem tej firmy w horyzoncie tej mapy drogowej i nie powinien być komunikowany jako ambicja. Poziom 4 — dane gotowe pod AI i modele w produkcji z nadzorem człowieka — wyczerpuje realną wartość dostępną przy obecnej skali i strukturze danych.',
    liniaDecyzyjna: [
      'Od pilotaży na plikach do modeli na danych produkcyjnych',
      'Priorytet startu 7 z 7',
      '24 miesiące',
      'Hurtownia danych z osi 4 oddana przed startem prac modelowych; największa luka w badaniu',
    ],
  },
];

export const WNIOSKI_PRZEKROJOWE = [
  {
    id: 'W1',
    tytul: 'Firma jest dojrzała tam, gdzie pracuje maszyna, i niedojrzała tam, gdzie pracuje człowiek',
    tresc:
      'Procesy produkcyjne stoją na poziomie 5 z 7, a procesy HR na 3 z 7. Zbieranie danych z maszyn — 5 z 7, ewidencja kompetencji ludzi — nie istnieje. Ta sama linia podziału wraca w cyberbezpieczeństwie (92% przeszkolonego biura wobec 11% produkcji) i w kulturze (zarząd sponsoruje, wykonawcy nie mają godzin). Wniosek dla zarządu: kolejna inwestycja w technologię przyniesie mniej niż inwestycja w to, kto i kiedy ma czas jej użyć.',
  },
  {
    id: 'W2',
    tytul: 'Luka AI nie jest luką technologiczną, tylko luką danych i zarządzania',
    tresc:
      'Oś 7 stoi na 40% skali, ale żaden z jej obszarów nie jest zablokowany brakiem technologii. Fundamenty danych AI (7A = 2 z 5) są bezpośrednią pochodną analizy danych (4D = 3 z 7), a governance (7D = 1 z 5) to kwestia jednej decyzji zarządu, nie budżetu. Domknięcie osi 4 podniesie oś 7 bez ani jednego dodatkowego modelu.',
  },
  {
    id: 'W3',
    tytul: 'Trzy najgłębsze luki punktowe leżą poza produkcją',
    tresc:
      'Największe różnice między stanem obecnym a uzgodnionym celem to logistyka (1E: 3 → 6), analiza wielkich zbiorów (4D: 3 → 6) i governance AI (7D: 1 → 4). Żadna nie dotyczy hali produkcyjnej, w którą firma inwestowała przez ostatnie trzy lata. To najważniejsza pojedyncza korekta kierunku wynikająca z tej oceny.',
  },
  {
    id: 'W4',
    tytul: 'Jedna oś opisuje ryzyko, sześć opisuje utraconą korzyść',
    tresc:
      'Cyberbezpieczeństwo jest jedyną osią, w której zaniechanie kosztuje, a nie tylko nie zarabia. Granica certyfikacji ISO 27001 przebiega dokładnie tam, gdzie kończy się biuro, podczas gdy dojrzałość procesowa produkcji wzrosła od czasu certyfikacji o dwa poziomy. Ta oś powinna wystartować pierwsza niezależnie od decyzji budżetowych dotyczących pozostałych.',
  },
  {
    id: 'W5',
    tytul: 'Wyższy poziom nie jest automatycznie lepszy — w trzech osiach rekomendujemy sufit poniżej maksimum',
    tresc:
      'Dla osi 2 (Produkty Cyfrowe) i 3 (Cyfrowe Modele Biznesowe) rekomendowany sufit to poziom 4 z 5: model platformowy wymaga skali i struktury odbiorców, których firma nie ma i nie zamierza budować. Dla osi 5 (Kultura) poziom 5 z 6 wyczerpuje realną wartość. Uzgodnione cele TO-BE w tabeli zbiorczej odzwierciedlają te sufity — nie są to poziomy maksymalne i nie powinny być tak komunikowane w organizacji.',
  },
];

export const MAPA_DROGOWA = [
  {
    fala: 'Fala 1 — fundamenty i ryzyko',
    horyzont: '0–6 miesięcy',
    opis: 'Uruchamiane niezależnie od decyzji o pozostałych falach. Dwie pierwsze pozycje dotyczą ryzyka, dwie kolejne odblokowują wszystko, co przychodzi później.',
    pozycje: [
      ['1', 'Rozszerzenie zakresu SZBI na sieć produkcyjną (OT)', '6', 'Krytyczny', 'Wysoki', 'Średni', 'Pełnomocnik SZBI'],
      ['2', 'Test odtworzenia MES z kopii zapasowej + plan reagowania dla OT', '6', 'Krytyczny', 'Wysoki', 'Niski', 'Dyrektor IT'],
      ['3', 'Polityka użycia AI i wskazanie właściciela tematu', '7', 'Krytyczny', 'Średni', 'Niski', 'Prezes Zarządu'],
      ['4', 'Wpięcie montażu końcowego do MES', '1', 'Wysoki', 'Średni', 'Niski', 'Dyrektor Produkcji'],
      ['5', 'Wydzielenie 0,5 etatu na koordynację portfela cyfrowego', '5', 'Wysoki', 'Wysoki', 'Niski', 'Dyrektor Operacyjny'],
    ],
  },
  {
    fala: 'Fala 2 — dane i obieg informacji',
    horyzont: '6–18 miesięcy',
    opis: 'Warunkiem startu jest pozycja 5 z fali 1 — bez koordynatora te przedsięwzięcia przegrają z bieżącą produkcją, tak jak przegrały poprzednie.',
    pozycje: [
      ['6', 'WMS na magazynie komponentów (kody kreskowe, inwentaryzacja ciągła)', '1', 'Wysoki', 'Wysoki', 'Średni', 'Dyrektor Logistyki'],
      ['7', 'Hurtownia danych MES + ERP + WMS z katalogiem i właścicielami zbiorów', '4', 'Wysoki', 'Wysoki', 'Wysoki', 'Dyrektor IT'],
      ['8', 'Automatyzacja miesięcznego raportu zarządczego (zero ręcznych scaleń)', '4', 'Wysoki', 'Średni', 'Niski', 'Kontroling'],
      ['9', 'Własny odbiór telemetrii TP-40 i portal klienta', '2', 'Średni', 'Wysoki', 'Średni', 'Dyrektor R&D'],
      ['10', 'Ewidencja kompetencji i mapa rozwoju na 12 miesięcy', '1 / 5', 'Średni', 'Średni', 'Niski', 'Dyrektor HR'],
    ],
  },
  {
    fala: 'Fala 3 — wartość z danych',
    horyzont: '18–30 miesięcy',
    opis: 'Start dopiero po odbiorze hurtowni danych (pozycja 7). Uruchomienie wcześniej powtórzy dzisiejszy stan pilotaży na plikach.',
    pozycje: [
      ['11', 'Model prognostyczny na danych MES (predykcja awarii / wydajności)', '4 / 7', 'Wysoki', 'Wysoki', 'Średni', 'Dyrektor IT'],
      ['12', 'Wpięcie obu pilotaży AI do hurtowni i przeniesienie na produkcję', '7', 'Wysoki', 'Średni', 'Średni', 'Dyrektor IT'],
      ['13', 'Studium wykonalności Equipment-as-a-Service dla odbiorcy pilotażowego', '3', 'Średni', 'Wysoki', 'Wysoki', 'Dyrektor Sprzedaży'],
      ['14', 'Rozszerzenie sklepu części zamiennych o zamówienia kontraktowe B2B', '3', 'Średni', 'Średni', 'Niski', 'Dyrektor Sprzedaży'],
    ],
  },
];

export const KOLEJNY_KROK = [
  ['do 17 września 2026', 'Zarząd wskazuje właścicieli pozycji 1–3 z fali 1 oraz zatwierdza rozszerzenie zakresu SZBI o sieć OT.'],
  ['do 30 września 2026', 'Warsztat zakresu SZBI dla OT z pełnomocnikiem i Dyrektorem IT — inwentaryzacja urządzeń i granica systemu.'],
  ['do 15 października 2026', 'Decyzja budżetowa dla fali 1 (szacunek nakładu: 2,6 mln PLN) i harmonogram fali 2.'],
  ['do 30 listopada 2026', 'Przegląd kontrolny z zespołem doradczym — weryfikacja pozycji 1–5 i korekta celów TO-BE, jeśli zmienił się kontekst.'],
];

export const GRANICE = [
  'Raport opiera się na 18 wywiadach, jednej wizycie w zakładzie Wrocław, przeglądzie systemów i dokumentacji oraz warsztacie walidacyjnym z 27.08.2026. Zakłady w Mielcu i Ostrawie nie były przedmiotem wizyty — ich stan przyjęto na podstawie deklaracji kadry zarządzającej i jest to najważniejsze ograniczenie tej oceny.',
  'Każda ocena obszaru ma w tabelach przypisany stan dowodu: „Potwierdzony" (okazany artefakt lub dane systemowe), „Deklarowany" (wyłącznie wypowiedź, bez artefaktu), „Niepełny" (materiał częściowy), „Brak dowodu". Osiem z 39 obszarów opiera się na deklaracji — ich ocena może się zmienić po okazaniu dowodu.',
  'Raport nie jest audytem bezpieczeństwa informacji ani testem penetracyjnym. Ustalenia z osi 6 opisują dojrzałość zarządzania, nie stan techniczny zabezpieczeń.',
  'Raport nie zawiera wyceny inwestycji. Kwota podana w kroku „do 15 października" jest szacunkiem rzędu wielkości opartym na zakresie fali 1, nie ofertą ani budżetem.',
  'Poziomy TO-BE zostały uzgodnione z zarządem na warsztacie 27.08.2026 i w trzech osiach są świadomie niższe od maksimum skali (patrz wniosek W5).',
];

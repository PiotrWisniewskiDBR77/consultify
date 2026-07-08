# Integration Diagnostic — doktryna narzędzia

> Diagnostyka dojrzałości integracji systemów i danych: gdzie firma ma spaghetti zamiast architektury, ile kosztuje ręczne "sklejanie" systemów taśmą klejącą (rekeying, eksporty CSV, kopiuj-wklej), i jaka jest droga od point-to-point do architektury hub/API-first. Metodyka: **Gartner Integration Maturity Model**, **MuleSoft API-led connectivity** (System/Process/Experience API), topologia **point-to-point vs hub-and-spoke/ESB vs iPaaS**, koszt jakości danych **1-10-100**.

---

## 1. Cel

Ocenić, **jak systemy firmy faktycznie ze sobą rozmawiają** — nie na poziomie "mamy integrację X" zaznaczonej w Excelu, tylko na poziomie topologii: ile jest połączeń, czy idą przez wspólny hub czy każde z każdym, ile z nich to prawdziwe API a ile to człowiek klikający "eksportuj" i "importuj" o 17:00 w piątek. Znaleźć **silosy danych** (systemy, które powinny się widzieć i nie widzą), **ręczne mostki** (rekeying — to samo dane wpisywane po raz drugi/trzeci przez człowieka) i **pojedyncze punkty awarii** (jeden system-hub, od którego zależy wszystko, bez redundancji i bez właściciela). Wynik to nie audyt techniczny "ile mamy API" — to mapa ryzyka i kosztu ukrytego w tym, jak dane się (nie) przemieszczają, przełożona na konkretne inicjatywy integracyjne z policzonym zwrotem.

Narzędzie nie projektuje docelowej architektury IT w pełnym detalu (to robota architekta integracji). Ono **diagnozuje dojrzałość i wskazuje, gdzie inwestycja w integrację zwraca się najszybciej** — żeby transformacja cyfrowa nie utknęła na tym, że nowy system "pięknie działa", ale nikt nie może z niego wyciągnąć danych bez ręcznego eksportu.

## 2. Kiedy używać

- Transformacja cyfrowa lub wdrożenie nowego systemu core (ERP, CRM) — trzeba wiedzieć, z czym system musi się zintegrować i jak, zanim się go kupi/wdroży.
- Fuzja lub przejęcie (M&A) — dwie firmy, dwa stosy systemów, presja żeby "połączyć dane" szybko; bez diagnostyki integracja kończy się nowym spaghetti zamiast konsolidacji.
- Silosy danych są widoczne gołym okiem: sprzedaż nie widzi statusu produkcji, finanse dostają dane z 3-dniowym opóźnieniem, każdy dział ma "swoją prawdę" o tym samym kliencie.
- Ręczne re-keying jest normą, nie wyjątkiem: ktoś codziennie/co tydzień przepisuje dane z systemu A do B (Excel jako "integracja", eksport-import, kopiuj-wklej między zakładkami).
- Rosnąca liczba systemów (SaaS sprawia, że każdy dział kupuje własne narzędzie) bez planu integracji — moment, w którym liczba potencjalnych połączeń zaczyna rosnąć szybciej niż zdolność IT do ich obsługi.
- Incydent lub awaria pokazała pojedynczy punkt awarii — jeden system/serwer/skrypt, którego padnięcie zatrzymuje kilka procesów naraz, a nikt wcześniej nie zmapował tej zależności.
- Presja na czas rynkowy (time-to-market) dla nowych produktów/kanałów blokowana przez to, że "podłączenie nowego systemu do reszty zajmuje pół roku" — sygnał braku architektury API-first.
- Roczne planowanie budżetu IT, gdy trzeba uzasadnić inwestycję w platformę integracyjną (iPaaS/ESB) zamiast kolejnego punktowego "sklejenia" dwóch systemów.

## 3. Inputy

- **Mapa systemów** (application landscape): pełna lista aktywnych systemów (core + satelitarne, SaaS + on-prem), właściciel biznesowy i techniczny każdego.
- **Inwentarz integracji**: dla każdej pary połączonych systemów — kierunek przepływu, typ (API/plik/baza współdzielona/ręcznie), częstotliwość (real-time/batch/na żądanie), właściciel utrzymania, czy jest udokumentowana.
- **Ręczne mostki danych**: gdzie i jak często człowiek przenosi dane między systemami ręcznie (eksport-import, kopiuj-wklej, podwójne wpisywanie), ile osób/godzin to kosztuje miesięcznie, jaka jest szacowana stopa błędu.
- **Krytyczne przepływy biznesowe**: kluczowe procesy end-to-end (np. zamówienie → produkcja → faktura → księgowość) i przez ile systemów/integracji przechodzą, gdzie łańcuch się rwie.
- **Architektura techniczna obecna**: czy istnieje warstwa pośrednia (ESB/iPaaS/middleware) czy wyłącznie połączenia point-to-point; jakie protokoły/standardy (REST, SOAP, pliki płaskie, EDI); czy jest rejestr/katalog API.
- **Dane o awariach i incydentach integracyjnych**: historia awarii spowodowanych integracją (ile razy w roku, jaki był wpływ biznesowy, czas naprawy — MTTR).
- **Wolumen i skala danych**: liczba transakcji/rekordów przepływających przez kluczowe integracje, szczyty obciążenia, trend wzrostu.
- **Kontekst strategiczny**: plany na nowe kanały/produkty/rynki/przejęcia w najbliższych 1-3 latach — bo to determinuje, ile nowych integracji będzie potrzebnych i czy obecna architektura to udźwignie.
- **Governance**: czy istnieje właściciel strategii integracji (Integration Competency Center / platform team), standardy nazewnictwa i bezpieczeństwa API, proces zatwierdzania nowych integracji.

## 4. Metoda

**4.1 Inwentarz integracji** — dla każdej pary systemów, które wymieniają dane, spisać: kierunek, typ mechanizmu, częstotliwość, właściciela, dokumentację (tak/nie). To surowy materiał — bez tego kroku reszta diagnozy jest zgadywaniem. W praktyce inwentarz ujawnia więcej integracji "nieoficjalnych" (skrypt na czyimś laptopie, harmonogram w Excelu z makrem), niż formalnie znanych IT.

**4.2 Mapa topologii — point-to-point vs hub** — narysować graf: węzły to systemy, krawędzie to integracje. Dwa skrajne wzorce:
- **Point-to-point ("spaghetti")** — każdy system łączy się bezpośrednio z każdym, z którym musi wymieniać dane. Liczba potencjalnych połączeń rośnie według wzoru **n(n-1)/2**: 10 systemów = do 45 połączeń, 20 systemów = do 190. Każde połączenie to osobny kawałek kodu/konfiguracji do utrzymania, osobny punkt awarii, osobna logika transformacji danych.
- **Hub-and-spoke / ESB / iPaaS** — każdy system łączy się raz z centralnym hubem (szyną integracyjną), hub routuje, transformuje i orkiestruje. Liczba połączeń rośnie liniowo (n), nie kwadratowo. Koszt: hub staje się krytyczną infrastrukturą (musi być niezawodny, musi mieć właściciela) i pojedynczym punktem, przez który przechodzi cały ruch.
- **API-led connectivity (wzorzec MuleSoft, obecny standard branżowy)** — trójwarstwowa architektura zamiast jednego monolitycznego huba: **System API** (bezpośrednio przy systemie źródłowym — ERP, CRM, baza — ukrywa jego specyfikę techniczną), **Process API** (logika biznesowa, orkiestracja, łączenie danych z kilku System API), **Experience API** (dostosowanie danych do konkretnego kanału/odbiorcy — appka mobilna, portal, dashboard). Zaleta względem klasycznego ESB: każda warstwa jest wielokrotnego użytku (nowy kanał konsumuje istniejące Process API zamiast budować nową integrację od zera), a zmiana w systemie źródłowym izolowana jest w jednej warstwie (System API) i nie rozlewa się na resztę.

**4.3 Ocena dojrzałości integracji** (wzorowana na Gartner Integration Maturity Model, 4-5 poziomów) — gdzie organizacja jest dziś:
1. **Ad hoc** — integracje robione punktowo, projekt po projekcie, bez standardu; nikt nie ma pełnej mapy; dużo ręcznych mostków.
2. **Reaktywna/oświecona (Enlightened)** — organizacja rozumie problem, ale integracja zarządzana wciąż per-projekt, nie na poziomie przedsiębiorstwa; brak centralnego zespołu/standardu.
3. **Scentralizowana** — istnieje centralny zespół (Integration Competency Center) i wybrana platforma (iPaaS/ESB); nowe integracje przechodzą przez wspólny standard; zaczyna się katalog API.
4. **Zbalansowana/API-first** — integracja jako produkt: reużywalne API, samoobsługowe podłączanie nowych konsumentów, governance, monitoring end-to-end, SLA na integracje.
5. **Zaawansowana (augmented)** — automatyzacja odkrywania i utrzymania integracji, wykorzystanie metadanych/AI do proaktywnego wykrywania anomalii i sugerowania reużycia istniejących API zamiast budowy nowych.

Większość firm spoza sektora tech ląduje na poziomie 1-2. Skok do poziomu 3 (scentralizowany zespół + platforma) to zwykle pierwszy realny kamień milowy transformacji integracyjnej — nie skok od razu do poziomu 5.

**4.4 Kwantyfikacja kosztu ręcznych mostków** — dla każdego zidentyfikowanego ręcznego mostka policzyć: liczba osób × godziny/tydzień × stawka = koszt FTE rocznie, plus szacowany koszt błędów (stopa błędu × koszt naprawy pojedynczego błędu, zgodnie z regułą **1-10-100**: zapobieżenie błędowi u źródła kosztuje ~1 jednostkę, korekta po fakcie ~10, naprawa skutków błędu który dotarł do klienta/raportu zarządczego ~100).

**4.5 Ocena krytyczności i ryzyka per integracja** — dla integracji na kluczowych przepływach biznesowych ocenić: co się stanie, jeśli ta integracja padnie na godzinę/dzień (wpływ biznesowy), czy jest pojedynczym punktem awarii (SPOF) bez alternatywnej ścieżki, jaki jest MTTR (średni czas naprawy) przy awarii, czy jest monitorowana (czy ktoś się dowie o awarii zanim zgłosi to zdenerwowany użytkownik).

**4.6 Benchmark zewnętrzny** — porównanie z danymi branżowymi nadaje wynikom kontekst: MuleSoft Connectivity Benchmark (2024-2026) pokazuje, że przeciętne duże przedsiębiorstwo ma **~900 aplikacji, z czego zintegrowanych jest tylko 27-29%** — to znaczy, że nawet dojrzałe organizacje żyją z większością systemów niezintegrowanych, a pytanie nie brzmi "zintegrować wszystko", tylko "które 10-15% integracji niesie 80% wartości biznesowej".

**4.7 Docelowa architektura i roadmapa** — na podstawie 4.1-4.6 zaprojektować kierunek (nie pełny projekt techniczny): które punkt-do-punkt zastąpić przejściem przez hub/platformę, gdzie wprowadzić warstwę System/Process/Experience API, które ręczne mostki zautomatyzować w pierwszej kolejności (największy koszt/najmniejsza złożoność), jaki model governance (kto zatwierdza nowe integracje, kto je monitoruje). Roadmapa sekwencjonowana wg zależności (nie da się zbudować Process API zanim istnieje System API pod spodem) i wg zwrotu (quick wins vs strategiczne platformy).

## 5. Jak się WNIOSKUJE

- **Ręczne przepisywanie danych = brakująca integracja, nie "tak to zawsze robiliśmy".** Jeśli człowiek regularnie kopiuje dane z systemu A do B, to jest dowód — nie hipoteza — że integracja powinna istnieć i nie istnieje. Im wyższa częstotliwość i liczba osób zaangażowanych, tym pilniejszy sygnał.
- **Sygnał spaghetti-integration**: liczba połączeń point-to-point rośnie szybciej niż liczba systemów (bo każdy nowy system dopina się bezpośrednio do kilku istniejących zamiast przez wspólną warstwę) — to oznacza, że koszt utrzymania integracji rośnie kwadratowo, podczas gdy budżet IT rośnie co najwyżej liniowo. Ten rozjazd jest niewidoczny rok do roku, ale eksploduje przy którymś kolejnym systemie.
- **Pojedynczy punkt awarii (SPOF) bez właściciela to cichy najwyższy priorytet** — nawet jeśli nigdy dotąd nie zawiódł. Brak historii awarii nie oznacza braku ryzyka (analogicznie do bus factor w Legacy Analyzer): system-hub, przez który przechodzi 6 integracji, a którym opiekuje się jedna osoba na pół etatu, jest bombą z opóźnionym zapłonem niezależnie od tego, jak długo "działał bez problemu".
- **Pułapka "zintegruj wszystko"**: presja żeby połączyć każdy system z każdym (zwłaszcza po M&A albo pod hasłem "jedna wersja prawdy") prowadzi do przewymiarowanych, drogich projektów integracyjnych o niskim zwrocie. Właściwe pytanie nie brzmi "co da się zintegrować", tylko "które integracje odblokowują konkretny przepływ biznesowy o wysokiej wartości" — 10-15% integracji zwykle niesie większość wartości (analogicznie do reguły Pareto stosowanej w innych narzędziach portfelowych).
- **Integracja "działająca" plikiem/eksportem batch ukrywa opóźnienie jako "brak problemu".** Zespół może nie zgłaszać integracji jako problemu, bo dane "w końcu docierają" — ale jeśli docierają raz dziennie zamiast w czasie rzeczywistym, decyzje biznesowe (np. dostępność magazynowa, limit kredytowy klienta) są podejmowane na nieaktualnych danych. Opóźnienie danych to ukryty koszt, który nie pojawia się w żadnym raporcie awarii, bo formalnie nic się nie "psuje".
- **Nowy system bez API-first blokuje przyszłość, nie tylko teraźniejszość.** System wdrożony bez otwartych, dobrze udokumentowanych API (albo z API, ale bez nikogo kto go utrzymuje/dokumentuje) staje się przyszłym kandydatem do point-to-point spaghetti, bo każdy kolejny konsument będzie musiał budować integrację od zera zamiast reużyć istniejącej warstwy Process/Experience API.
- **Reużycie jako miernik dojrzałości.** Liczba nowych integracji, które reużywają istniejące System/Process API zamiast budować nowe połączenie od zera, jest twardszym wskaźnikiem dojrzałości niż liczba samych API — organizacja może mieć dużo API i wciąż każdy projekt buduje nowe zamiast konsumować istniejące (fasada API-led bez realnej dyscypliny reużycia).
- **Rekeying jako wskaźnik wyprzedzający jakości danych, nie tylko kosztu pracy.** Zgodnie z regułą 1-10-100, każdy ręczny mostek to nie tylko koszt FTE — to źródło błędów, które są tanie do złapania u źródła i drogie do naprawy po tym, jak trafią do raportu zarządczego albo do klienta. Wysoka liczba ręcznych mostków na krytycznym przepływie (np. zamówienie → faktura) koreluje z wyższym ryzykiem błędów finansowych, nie tylko z niewygodą operacyjną.
- **Integracja punktowa "na już" bez platformy pod spodem to dług, nie rozwiązanie.** Szybkie połączenie dwóch systemów pod presją terminu (typowe przy M&A albo wdrożeniu nowego kanału) rozwiązuje dzisiejszy problem i dokłada się do jutrzejszego spaghetti — decyzja "zróbmy to szybko punkt-do-punkt" powinna być świadomym kompromisem z jawnym zapisem "do refaktoryzacji", nie cichym domyślnym wyborem.

## 6. INSIGHTY (rdzeń narzędzia)

To jest **główny produkt narzędzia** — nie diagram topologii, tylko zdania, które prowadzą wprost do decyzji i inicjatyw:

- *„Dział sprzedaży ręcznie przepisuje dane zamówień z CRM do systemu produkcyjnego 40x/tydzień, ~3 min/wpis = 2h/dzień jednego FTE (~250h/rok) + szacowana stopa błędu 4% → przy regule 1-10-100 koszt korekt i skutków błędów to dodatkowe X PLN/rok. Automatyzacja tej integracji (REST API, oba systemy je już mają) zwraca się w <4 miesiące."*
- *„System ERP jest hubem dla 12 integracji point-to-point (magazyn, CRM, e-commerce, księgowość, 8 innych) — każda zmiana w ERP ryzykuje złamanie kilku integracji naraz, a nikt formalnie nie jest właścicielem tej roli huba. To jest pojedynczy punkt awarii bez planu ciągłości — pilna inicjatywa: właściciel + warstwa System API izolująca ERP od reszty."*
- *„23 z 31 zmapowanych integracji to bezpośrednie połączenia point-to-point (74%) — liczba możliwych połączeń rośnie kwadratowo z każdym nowym systemem; przy planowanym wdrożeniu 3 nowych narzędzi w tym roku koszt utrzymania integracji wzrośnie nieproporcjonalnie bez przejścia na warstwę pośrednią."*
- *„Tylko 28% zmapowanych systemów firmy jest realnie zintegrowanych (zgodnie z benchmarkiem branżowym MuleSoft: ~27-29%) — firma jest w normie branżowej, ale to nie jest komplement: oznacza, że większość danych organizacji wciąż żyje w silosach, a pytanie strategiczne to które 10-15% brakujących integracji odblokuje największą wartość, nie 'zintegrujmy wszystko'."*
- *„Przepływ zamówienie→faktura przechodzi przez 4 systemy i 2 ręczne mostki — czas cyklu realnie wynosi 3 dni, z czego 2 dni to oczekiwanie na batch-eksport raz dziennie, nie praca. Zamiana batch na integrację czasu rzeczywistego skraca cykl o ~60% bez zmiany żadnego procesu biznesowego."*
- *„Integracja magazyn↔e-commerce ma MTTR 6 godzin przy awarii (ostatnie 3 awarie w tym roku) i zero monitoringu — sklep przez 6h pokazuje nieaktualną dostępność, ryzyko nadsprzedaży. Inicjatywa: alerting + fallback (blokada sprzedaży przy utracie sygnału) zamiast czekania aż klient zgłosi błąd."*
- *„Po fuzji: firma A i firma B mają each osobny CRM i ERP, zero integracji między nimi — sprzedaż połączonej firmy nie widzi pełnej historii klienta. To jest priorytet #1 integracyjny fuzji, bo blokuje cross-sell, który był częścią uzasadnienia biznesowego transakcji."*
- *„3 nowe integracje w ostatnim roku zostały zbudowane od zera point-to-point, mimo że wymagany System API do ERP już istniał (zbudowany dla innego projektu) — brak katalogu API i governance powoduje, że zespoły nie wiedzą, co już istnieje do reużycia; efekt: podwójny koszt budowy tego, co mogło kosztować ułamek."*
- Każdy taki insight → **inicjatywa integracyjna** z właścicielem, szacowanym kosztem/oszczędnością, poziomem pilności (SPOF/compliance/deadline vs optymalizacja) i miejscem w sekwencji (co musi powstać najpierw, żeby reszta się nie rozjechała).

## 7. Worked example

**Kontekst**: firma dystrybucyjna średniej wielkości, 18 aktywnych systemów (ERP, WMS magazynowy, e-commerce B2B, CRM, księgowość, płatności, 4 systemy działowe SaaS, reszta narzędzia pomocnicze), roczny przychód ~120 mln PLN, dział IT = 6 osób.

**Krok 1 — inwentarz integracji** (wycinek z 22 zmapowanych połączeń):
| Integracja | Typ | Częstotliwość | Właściciel | Udokumentowana |
|---|---|---|---|---|
| ERP ↔ WMS | Plik płaski (eksport/import), 2x/dzień | Batch | Brak formalnego | Nie |
| ERP ↔ Księgowość | API własne | Real-time | IT | Częściowo |
| CRM ↔ E-commerce | Ręczne (Excel, raz/tydzień) | Ręczna | Dział sprzedaży | Nie |
| E-commerce ↔ WMS (dostępność) | Brak integracji — telefon/Slack | Ad hoc | Nikt | Nie |
| ERP ↔ Płatności | API dostawcy płatności | Real-time | IT | Tak |

**Krok 2 — topologia**: 22 integracje, 18 systemów, z czego 17 to bezpośrednie połączenia point-to-point (77%), zero centralnej warstwy integracyjnej. Graf pokazuje ERP jako de facto hub (9 z 22 integracji dotyka ERP), ale bez formalnej roli właściciela integracji ani warstwy izolującej.

**Krok 3 — dojrzałość**: poziom **1-2 (Ad hoc / Enlightened)** wg skali Gartner — integracje budowane projekt po projekcie, brak centralnego zespołu, brak katalogu, 3 kluczowe integracje nieudokumentowane w ogóle (wiedza tylko w głowie jednej osoby).

**Krok 4 — kwantyfikacja ręcznych mostków**:
- CRM↔E-commerce (ręczny Excel, raz/tydzień, 1 osoba × 3h) = 156h/rok ≈ 0,08 FTE, szacowana stopa błędu ~8% (rozjazd cen/dostępności widoczny w reklamacjach klientów).
- E-commerce↔WMS (telefon/Slack zamiast integracji) = brak twardej liczby godzin, ale 5 zgłoszonych przypadków nadsprzedaży w ostatnim kwartale, każdy kosztujący ~2-4h pracy obsługi klienta + ryzyko reputacyjne.

**Krok 5 — krytyczność i SPOF**: ERP jako nieformalny hub 9 integracji, utrzymywany przez 1,5 osoby (bus factor krytyczny analogicznie do ryzyka legacy) — każda zmiana w ERP wymaga ręcznej weryfikacji 9 zależnych integracji, bo nie ma testów regresyjnych ani warstwy izolującej.

**Insighty → inicjatywy**:
1. *„E-commerce↔WMS: brak integracji dostępności magazynowej powoduje nadsprzedaż — 5 przypadków/kwartał, koszt obsługi + reputacja. Priorytet #1, bo dotyka bezpośrednio klienta końcowego; zbuduj System API na WMS (nie istnieje) + Experience API dla e-commerce. Szacowany zwrot: <3 miesiące."*
2. *„CRM↔E-commerce: ręczny Excel raz/tydzień, 8% stopa błędu w cenach/dostępności → przy regule 1-10-100 koszt korekt/reklamacji przewyższa koszt budowy prostej integracji REST. Quick win, oba systemy mają gotowe API."*
3. *„ERP jako nieformalny hub 9 integracji, bus factor 1,5 osoby, brak warstwy izolującej — każda zmiana w ERP ryzykuje kaskadową awarię. Inicjatywa strategiczna: wprowadzenie System API przed ERP + formalny właściciel roli integracyjnej. Warunek wstępny dla bezpiecznego wdrożenia jakiegokolwiek nowego systemu w przyszłości."*
4. *„77% integracji to point-to-point, poziom dojrzałości 1-2 wg Gartner — przy planowanych 2 nowych systemach w przyszłym roku koszt utrzymania integracji wzrośnie nieproporcjonalnie. Rekomendacja: wybór lekkiej platformy iPaaS zamiast kolejnych połączeń punktowych, start od migracji 3 najbardziej krytycznych integracji (ERP-centric)."*
5. *„3 integracje nieudokumentowane, wiedza tylko u 1 osoby każda — ryzyko operacyjne niezależne od budżetu na nowe projekty; zabezpiecz dokumentacją i przeglądem w tym kwartale jako działanie zerokosztowe."*

**Krok 6 — sekwencjonowanie roadmapy**:
| Kwartał | Inicjatywa | Warunek wejścia |
|---|---|---|
| Q1 | Dokumentacja 3 integracji krytycznych + CRM↔E-commerce REST | Brak zależności, może ruszyć od razu |
| Q1-Q2 | E-commerce↔WMS System+Experience API | Wymaga zbudowania System API na WMS (nie istniał) |
| Q2-Q3 | Wybór i wdrożenie lekkiego iPaaS | Musi poprzedzać migrację integracji ERP-centric |
| Q3-Q4 | Migracja 3 najkrytyczniejszych integracji ERP na platformę | Wymaga gotowej platformy iPaaS z Q2-Q3 |
| Q4+ | Formalizacja governance (katalog API, właściciel integracji) | Równolegle z migracją, warunkuje trwałość efektu |

**Kontrast branżowy — firma po fuzji (M&A) z presją czasową.** W kontekście integracji poakwizycyjnej priorytet odwraca się względem powyższego przykładu: zamiast zaczynać od najtańszych quick winów, pierwszą inicjatywą jest zwykle integracja CRM obu firm (widoczność klienta), nawet jeśli technicznie droższa, bo to bezpośrednio warunkuje realizację synergii przychodowej (cross-sell), która była częścią uzasadnienia biznesowego transakcji — przy fuzji koszt opóźnienia integracji mierzy się utraconą synergią z case'u inwestycyjnego, nie tylko kosztem FTE rekeyingu.

## 8. Antywzorce przy stosowaniu narzędzia

- **Diagnostyka bez udziału ludzi, którzy klikają "eksportuj".** Ręczne mostki rzadko są widoczne w dokumentacji IT — żyją w wiedzy operacyjnej działów (sprzedaż, magazyn, księgowość). Inwentarz integracji zrobiony wyłącznie z perspektywy IT systematycznie pomija najdroższe silosy, bo to nie IT je "obsługuje", tylko ludzie ręcznie.
- **Traktowanie "zintegruj wszystko" jako celu.** Presja żeby połączyć każdy system z każdym prowadzi do przewymiarowanych projektów o niskim zwrocie; właściwe pytanie to które integracje odblokowują wartość biznesową, nie ile procent systemów jest "połączonych" jako metryka sama w sobie.
- **Wybór platformy (iPaaS/ESB) przed zrozumieniem topologii.** Kupno narzędzia integracyjnego bez wcześniejszego inwentarza i mapy zależności to najczęstsza przyczyna drogich wdrożeń platform, które i tak kończą się nowym point-to-point wewnątrz samej platformy — narzędzie nie zastępuje decyzji architektonicznej.
- **Ignorowanie integracji "działających batch/plikiem" jako niebędących problemem.** Brak zgłoszonej awarii nie oznacza braku kosztu — opóźnienie danych (raz dziennie zamiast real-time) jest kosztem ukrytym, niewidocznym w rejestrze incydentów, bo formalnie nic się "nie psuje".
- **Migracja wszystkiego na nowy hub naraz.** Big-bang migracja wszystkich integracji point-to-point na nową platformę jednocześnie multiplikuje ryzyko — właściwe sekwencjonowanie zaczyna od integracji o najwyższym zwrocie/najniższym ryzyku (quick win dowodzący wartość platformy), potem przechodzi do integracji krytycznych z pełnym planem przejściowym.
- **Pomijanie kosztu zaniechania w uzasadnieniu inwestycji.** Koszt "róbmy to ręcznie jak dotychczas" (FTE-godziny, stopa błędu, opóźnienie decyzji biznesowych, ryzyko SPOF) rzadko jest liczony explicite obok kosztu budowy integracji — bez tego porównania każda inicjatywa integracyjna wygląda jak koszt, nie jak oszczędność.

## 9. Źródła

- Gartner — Integration Maturity Model: [Gartner — Integration Maturity Model](https://www.gartner.com/en/documents/4265899), [Gartner — Integration Maturity Model (2)](https://www.gartner.com/en/documents/6060063), [Quinnox — Gartner's Integration Maturity Model for Identifying Gaps](https://www.quinnox.com/gartners-integration-maturity-model/), [Frends iPaaS — Four Levels of Integration Maturity](https://frends.com/insights/article/check-list-four-levels-of-integration-maturity)
- Gartner — API Strategy Maturity Model: [Gartner's API Strategy Maturity Model](https://www.gartner.com/en/documents/3970520), [Summary Translation](https://www.gartner.com/en/documents/4002376)
- MuleSoft — API-led connectivity (System/Process/Experience API): [MuleSoft — Types of APIs](https://www.mulesoft.com/api/types-of-apis), [DZone — MuleSoft API Led Connectivity Patterns](https://dzone.com/articles/mulesoft-api-led-connectivity-architectural-and-de), [Salesforce — What Is API-led Connectivity?](https://www.salesforce.com/blog/api-led-connectivity/), [Trailhead — API-Led Connectivity Essentials](https://trailhead.salesforce.com/content/learn/modules/application-networks-and-api-led-connectivity-in-mulesoft/explore-api-led-connectivity)
- MuleSoft Connectivity Benchmark Report (2024-2026) — % zintegrowanych aplikacji w przedsiębiorstwie: [2026 Connectivity Benchmark Report](https://www.mulesoft.com/lp/reports/connectivity-benchmark), [Agentic Transformation — 2026 Insights](https://blogs.mulesoft.com/agentic-perspectives/connectivity-benchmark-report/), [2025 Connectivity Benchmark Report Insights](https://www.salesforce.com/blog/mulesoft-connectivity-benchmark-2025/), [Key Findings from 2025 Report](https://blogs.mulesoft.com/news/connectivity-benchmark-report/)
- Point-to-point vs hub topologia, koszt spaghetti: [Exalate — Point-to-Point Integration: Strengths and Pitfalls](https://exalate.com/blog/point-to-point-integration/), [Unito — What Is Enterprise Application Integration?](https://unito.io/blog/enterprise-application-integration/), [Workato — Enterprise Application Integration: Complete Guide](https://www.workato.com/the-connector/enterprise-application-integration/), [IBM — What Is Enterprise Application Integration?](https://www.ibm.com/think/topics/enterprise-application-integration), [MuleSoft — EAI and ESB](https://www.mulesoft.com/integration/enterprise-application-integration-and-esb)
- Koszt rekeyingu i reguła 1-10-100 (jakość danych): [Simply Connected Systems — Eliminate Manual Data Re-Entry](https://help.simplyconnectedsystems.com/how-to/rekeying/fiber-telecom-installation), [Loqate — The 1-10-100 Rule: Real Impact of Poor Data](https://www.loqate.com/en-us/blog/the-1-10-100-rule-the-real-impact-of-poor-data/), [Matillion — The 1:10:100 Rule of Data Quality: A Critical Review](https://www.matillion.com/blog/the-1-10-100-rule-of-data-quality-a-critical-review-for-data-professionals), [Konsolidator — The 1-10-100 Rule: Impact of Poor Data in Finance](https://konsolidator.com/blog/the-1-10-100-rule-the-real-impact-of-poor-data-in-finance-and-the-key-to-avoiding-errors-in-future-reporting/)

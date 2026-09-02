# Rejestr uwag właściciela z odbioru grafiki — 2026-09-02

Ten plik istnieje po to, żeby zamknięcie modułów **nie połknęło** uwag, które właściciel
zostawił przy kartach rozstrzygniętych jako „ok". Każda uwaga ma tu własny wiersz i własny
identyfikator. Zamknięcie modułu w G17 powołuje się na ten rejestr — nie kasuje uwagi.

## Podstawa

Właściciel 2026-09-02 potwierdził zatwierdzenie warstwy ekranowej („zatwierdziłem całą grafikę,
wszystkie ekrany"). Na tej podstawie uwaga przy decyzji „ok" **nie blokuje** zamknięcia modułu,
ale **pozostaje otwarta jako pozycja produktowa** do rozliczenia po MVP.

**To NIE dotyczy czterech ekranów, przy których właściciel wydał rozstrzygnięcie inne niż „ok".**
Te cztery blokują swoje moduły i są wypisane na końcu.

## Pomiar

- decyzji w eksporcie: 265 (ok 262 · nie 2 · poprawka 2)
- ekranów z treścią przy decyzji, w obrębie 16 modułów: 93
- z tego czysta pochwała („ok", „SUPER", „Love it"): 12 — nie są pozycjami backlogu
- z tego rozstrzygnięcia inne niż „ok": 4 — **blokują moduły**, patrz sekcja na końcu
- **merytorycznych uwag przy decyzji „ok": 77** — treść tego rejestru

Źródło: `docs/program/grafika/ODBIOR_DECYZJE.json` (eksport 2026-09-02T14:15:19).
Mapowanie ekran→moduł: `waves/WAVE_03_ACCEPTANCE/MAPA_GRAFIKA_MODULY_20260902.md`.

Sprostowanie wobec `ZAMKNIECIE_MODULOW_20260902.md`: tamten dokument mówi o **trzech**
rozstrzygnięciach poza „ok" i liczy 78 uwag. Rozstrzygnięcia są **cztery** — pominięty został
`execution-tab-resources` („poprawka", Realizacja), zaliczony tam do zwykłych uwag.
Po jego odjęciu uwag merytorycznych jest 77.

## 02_INTERVIEW — Wywiad (3)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-02-01` | `karta-insight` | Tutaj problemem jest to. W oknie centralnym mamy trzy kolumny; jest to zaciągnięte. Zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do dołu. |
| `UW-02-02` | `interview-creator-shell` | To jest do poprawy wielkość ścianek, też już to zgłaszałem. Wilka z czcionek, obrazków – to nie wygląda jak sekcja tech, nie? Wszystkie elementy są w porządku, jest to w miarę czytelne, ale nie wygląda ładnie. |
| `UW-02-03` | `interview-preview-canon` | Nie umiem ocenić, czy szerokość tego jest wystarczająca, ale pamiętaj, że mamy opisane, jak ma to wyglądać. Wszystkie przewidywania muszą być opisane zgodnie ze standardem. To jest komponent. |

## 03_TOOLS — Narzędzia (3)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-03-01` | `karta-tool` | Zobacz tutaj w karcie ostatniej w przykładzie. Mieliśmy usunąć dwa przykłady, bo mieliśmy trzy. Został jeden, ale w postaci jednej kolumny. To wygląda bez sensu. No i w tym narzędziu nie mam, jak przeklikać samego wypełniania dokumentu. |
| `UW-03-02` | `tools-swot-report` | Oczywiście wygląda to dobrze, jakby treść była w porządku, z tym że żaden słod nie będzie tylko tak małą analizą, nie? Ale generalnie wygląda ok. |
| `UW-03-03` | `tools-swot-session-workspace` | Jest jakaś prehistoryczna karta jeszcze za tym, zanim przerobiliśmy to. |

## 04_ASSESSMENT — Ocena (9)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-04-01` | `assessment-five-surfaces` | Niestety, tutaj tabela preview nie trzyma się opisanego standardu. |
| `UW-04-02` | `assessment-output-report` | No dobra, i teraz tak: jeśli chodzi o raporty z oceny, trochę to pomieszaliśmy, nie? Audyt i oceny to dwie różne historie. Oceny mają swój framework i raporty. Jeżeli chodzi o DRD, mamy konkretną formułę, w której znajdują się wszystkie poszczególne osie. Dla każdej osi określony jest obszar analityczny, więc musimy zbudować raport o dosyć sformalizowanej strukturze: 1. Wstęp z opisem, jak było prowadzone badanie. 2. Siedem osi – dla każdej z nich opisujemy najpierw samą oś, a następnie obszar. 3. Opisujemy odpowiedzi oraz wstępną paletę wniosków. 4. Na koniec podsumowanie. Tak więc raport jest znacznie bardziej sformalizowany. Podobnie w przypadku Siri – istnieje dokument opisujący, jak ma wyglądać raport. W audytach jest nieco większa dowolność, ale również trzeba przejść przez wnioski audytowe w kolejności, w jakiej audyt jest realizowany. |
| `UW-04-03` | `assessment-quality-review-panel` | Znowu taki wniosek: taka tabela jest możliwa, tylko pamiętaj, że w asesmencie mamy macierz odpowiedzi i ona jest ważna, bo jest narzędziem. To nie jest tylko prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję. Nie wiem, czy to, co mi tu pokazujesz, ma zastąpić macierz. Jeśli tak, to nie działa w ten sposób. Jeśli chcesz mieć oddzielną taką tabelę, to super, tylko to nie jest macierz. Dobrze, przejrzałem wszystkie karty. Nigdzie nie znalazłem macierzy. Macierz jest przedstawieniem graficznym na wszystkich osiach ze zmiennymi osiami. Poszukaj tego dokładnie. To w kodzie istnieje. To jest super ważne, bo ta macierz później wchodzi do raportu i wizualizuje poziomy oraz następne kroki. To jest jakby wizualizacja z głównym narzędziem tutaj. |
| `UW-04-04` | `assessment-list` | To samo rozumiem, że to ma być tabela na całą szerokość ekranu, a nie jakaś fragmentaryczna. |
| `UW-04-05` | `assessment-presentation-view` | Ciagle nie wiem dlaczego nie uzywsz mojej maciezy DRD - nie mam juz siły serio !! moja maciez jest serio ładna - juz ja znalazłęśc przeciez (zobacz mam to na ekranie Macierz oceny DRD — obszary x poziomy) |
| `UW-04-06` | `assessment-reports-panel` | No, to jest normalna tabela na pełną szerokość, jak rozumiem. |
| `UW-04-07` | `assessment-initiatives-table` | No, już to jest po prostu pełna tabela na pełną szerokość, a to wygląda, jakby to był jakiś raport w raporcie albo nie wiem co, nie? To ma być normalna tabela inicjatyw. Na koniec inicjatywy, na koniec każdej oceny, czy na koniec assessmentu, to są po prostu drafty inicjatywy, a normalnie w tabeli inicjatyw. |
| `UW-04-08` | `siri-workspace` | Ty, nie wiesz, co rozumiem, że okej, więc zobaczymy, jak to będzie, jak to wyjdzie. Ja nie znam Sir, więc trudno mi to ocenić. |
| `UW-04-09` | `drd-library-entry` | Znowu dałeś mi coś bez analizy własnej. Tutaj nie ma żadnego podglądu; z całą pewnością kolumny nie są wystarczające. To nie jest dobra statystyka tego, co powinno być w tej tabeli. Do powtórki. |

## 05_INITIATIVES — Inicjatywy (5)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-05-01` | `plan-scenario-d1` | Tabela niestety dalej nie wygląda jak kompletna tabela. Tu jest większy problem. Problem polega na tym, że narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę. W ogóle nie rozumiem, jak to działa. |
| `UW-05-02` | `capacity-advisor-a3` | Dobrze, to jeszcze raz, bo już to opisywałem wiele razy. Słuchaj, jest tak: tutaj powinna być tabela, w której mamy na dany moment stworzony raport, czyli przycisk „Tworzy raport”. Raport jest generowany na bieżąco, na konkretną chwilę. Obecnie, albo po jego wygenerowaniu, w tym momencie tworzono jest zestawienie, ile osób jest w danym projekcie albo ile osób jest we wszystkich projektach, oraz ich analiza obciążenia zgodnie z planem. A teraz nie wiadomo, czemu otwiera się to w ramach tej karty. Nic tu nie zostało zmienione w ramach tej naprawy. |
| `UW-05-03` | `exe-002-004-ui-audit` | Trzeci raz dajesz mi tę kartę do akceptacji. |
| `UW-05-04` | `initiative-record` | Inicjatywę oceniałem już wcześniej, raz. Nie wiem, czemu to jest inna tabela inicjatyw. Czy to pomyłka, czy celowo – powinniśmy mieć jedną tabelę inicjatyw. |
| `UW-05-05` | `karta-initiative` | Tutaj będę robił jeszcze więcej przeglądów, jak załadujesz je danymi. Natomiast na ten moment widzę, że nie ma przycisku AI w górnym pasku, który będzie odpowiadał za wypełnienie karty. Poza tym wygląda zajebiście. |

## 06_EXECUTION — Realizacja (3)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-06-01` | `execution-tab-work` | Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno |
| `UW-06-02` | `execution-tab-control` | Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno |
| `UW-06-03` | `execution-tab-rollout` | tutaj wcale te słowa pomiędzy tabelą a menu 3 nie sa potrzebne |

## 07_MY_WORK_AGENT — Moja praca / Agent (18)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-07-01` | `karta-decision` | Tutaj ważne jest to, że mamy w górnym pasku przycisk „AI”, a później w pasku dalszego arkusza mamy „Analizuj z AI”. Pamiętaj, że to są dwie różne funkcjonalności. Górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty. |
| `UW-07-02` | `decision-record` | Tam jest jakiś komentarz – zobacz na tym screenie, że informacje przekazane nie są wysyłane do serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd, nie? Tak, weźmy to pod uwagę, aby oczywiście ta karta była połączona z całym systemem. |
| `UW-07-03` | `idea-table-tool-empty-filter` | Wiedziałem, że mamy taką tabelę w ogóle. |
| `UW-07-04` | `idea-templates-catalog` | to jest moje marzenie aby to wszytko działało dobrze |
| `UW-07-05` | `notatnik-centrum-mysli` | To byłoby zajebiste, żeby to tak działało. |
| `UW-07-06` | `notatnik-osierocone-graf` | Jak robimy takie nody notatek to moze zrob ja na całym ekranie jedną bo kilka na jedym eraknie nie daje komortu pracy. |
| `UW-07-07` | `vault-safes-table` | Ja mam takie wrażenie, że tabela tego SEF‑u jest dziwnie wąska. Nie rozciąga się na całą szerokość tabeli. Pracuj nad tym, żeby wiersze mieściły się w jednej linii, a nie rozkładały się na cztery wiersze – żeby każdy wiersz był jedną linią, jak w tabeli. Układ jest okej, nie? Tylko mogę uznać to za wąskie. |
| `UW-07-08` | `vault-folder-block-proof` | I tutaj co do zasady jestem ok z grafiką ale cała funcjonalność agenta powinna być duzo bardziej rozwinieta niz nasz obecny stan tego okna. ale te komponetny nodów są ok |
| `UW-07-09` | `whiteboard-canvas` | tutaj jest tylko problem taki ze jak zanaczam element otweira sie pasek poziomy funkcji i on sie nie mieści w pasu - sa ikony które wygladają poza okno. tutaj opisy trzeba skrócić albo wywalić. |
| `UW-07-10` | `processflow-canvas` | Generalnie okno jest ok. Tutaj wielkim wyzwaniem jest ten panel boczny. na tym obrazie jak go nie mogę ocnić |
| `UW-07-11` | `agent-plan-canvas` | To jest wielka praca do zrobienia - ten ekran ktory mi pokazujesz niestety nie pokazuje wiele zobac jak jest zrobiony. - tutaj trzeba bardziej wypracować mozliwość pracy jak komponentami klockami które przekładamy i układamy jak flow w N8N - oczywicie to musi być lekko bardziej poważne ale przesuwalnosc klocków bardzo by pomogała. i oczywiści AI buduje sam klocki tez |
| `UW-07-12` | `agent-warsztat` | Słuchaj, prokuruję tutaj narzędzia, jak na przykład dodanie, zrównoleglenie procesów. Merytorycznie ten agent jest jeszcze do wypracowania. Na tym poziomie myślę, że graficznie nam to pasuje – naprawdę za małe są te elementy. |
| `UW-07-13` | `idea-financial-case-persistence` | Tak, to nawet nie wiem, co to jest i do czego to przypiąć. |
| `UW-07-14` | `idea-table-timeline-stuck` | Tutaj, tak samo jak we wszystkich innych IDEach, wraca kwestia prawego menu. |
| `UW-07-15` | `zwornik-projects` | Słuchaj, wiesz co, znowu nie wiem, gdzie to się uruchamia. Natomiast, jeśli mamy przyciski „dodaj i projekt” oraz coś tam drugiego, nie ma pełnej, dobrej nawigacji. |
| `UW-07-16` | `mywork-idea-inspector-lekki` | Nie wiem, nie mam pojęcia, gdzie ten plik, gdzie ten ekran jest, szczerze mówiąc. Domyślam się, że może tak wyglądać, bo jest techniczny, ale nie wiem, do czego służy. |
| `UW-07-17` | `ideas-teresa-panel` | Dobra, przeanalizowałem i teraz tak: cały ten prawy panel jest ewidentnie do przepracowania. Zarówno w ujęciu graficznym, kolejności myśli, jak i merytorsnym, co się tutaj musi wydarzyć. Koniecznie trzeba wrzucić to do backlogu, aby przeanalizować, jak ten panel powinien być zorganizowany, żeby był w pełni pomocny i użyteczny. Jednocześnie grafiki, które tutaj mamy, rozwiązania graficzne, też nie są przeanalizowane przez Ciebie i nie są zgodne ze standardem grafik, tylko tak, jak zostały przekonane przeze mnie dawno temu automatycznie. To jest słabe. |
| `UW-07-18` | `mywork-notebook-rail-speca` | Teraz tak: on jest generalnie dużo lepszy niż to, co jest w Idea. Natomiast te dra‑meni, moim zdaniem, powinny wyglądać tak samo, mieć te same elementy albo prawie zbliżone, ale na pewno rządzić się tymi samymi zasadami. Więc jeśli tam zrobiliśmy informację, że idzie to do backlogu i trzeba to koniecznie przerobić gruntownie, myślę, że tutaj ta informacja powinna być powiązana z tym, co jest tam. |

## 09_RESULTS — Wyniki (10)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-09-01` | `results-vnext-roi-full-tool` | Wiesz co, wydaje mi się, że mamy do poprawki, bo ROI to jedna analiza i powinna mieć formułę N‑karty. Tak jak teraz, gdy tworzysz to w menu poziomym, nie mamy możliwości ułożenia tego w strukturze dokumentu. To musi być n‑karta, gdzie będziemy mieli z nowej strony te zakładki, które teraz masz w menu, bo to menu, które teraz masz, już się nie wciśnie – byłoby to czwarte menu, a to byłoby zupełnie niepotrzebne. Dlatego musi być n‑karta. Każda jedna analiza RI, łącznie z modelem, to jest po prostu jedna karta. |
| `UW-09-02` | `results-vnext-roi-model` | Tutaj muszę to odrzucić, bo wniosek jest dokładnie taki, jak wcześniej opisałem. Musimy przenieść to do jednej n‑karty. |
| `UW-09-03` | `results-vnext-roi-pir-outcomes` | I to jest, jak rozumiem, konsekwencja poprzednich, czyli to jest kolejna N‑karta w jednym ROI‑u. |
| `UW-09-04` | `results-vnext-okr-registry` | Dobrze, tutaj zgłaszałem, ja już to się zapisało. W prawym, głównym rogu powinien być przycisk „Nowe dodawanie OKR”, a teraz są jakieś inne niepotrzebne przyciski. |
| `UW-09-05` | `results-vnext-teresa-okr-reflection` | Grafika tego jest fatalna, po prostu stara. |
| `UW-09-06` | `results-vnext-okr-admin` | Brak przycisków w dolnym pasku Preview - no chyba ze ich nie ma tutaj |
| `UW-09-07` | `results-vnext-teresa-kpi-deviation` | Tutaj zrobiłęś grafikę jak z przez 5 lat. zoabcz to nie jest spójne z naszyą formą UI/UX |
| `UW-09-08` | `results-vnext-attention` | tu sa tylko dwa przyciski w menu 2 |
| `UW-09-09` | `results-vnext-okr-workspace` | To miało być w N-type karcie |
| `UW-09-10` | `results-vnext-search-registry` | generalnie układ menu i tabele sa ok ale tutaj wiele nie ma do akcpetacji |

## 10_FINANCE — Finanse (3)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-10-01` | `finance-analysis-workspace` | Nie mam jak tego zatwierdzić, nic tu nie widać, nic z tego nie można wyciągnąć. |
| `UW-10-02` | `finance-valuation-workspace` | Dobrze, słuchaj, to jak merytorycznie pewnie wygląda, to dobrze. Popracuj trochę nad grafiką. Zobacz, przyciski u góry są po prostu słowami, nie przyciskami okrągłymi. Popraw je graficznie, żeby wyglądały tak jak reszta naszego dokumentu. Układ merytoryczny i przepływ informacji są super. |
| `UW-10-03` | `finance-compare-panel` | A moze całą szerokość dostpenego ekranu wykrzystajmy |

## 11_MATERIALS — Materiały (14)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-11-01` | `template-builder-doc` | To jest super!!!!!!! proste i czytelne - brawo |
| `UW-11-02` | `template-library-new-entry` | No, tak jak rozumiem, to jest normalna tabela, bo przecież to jest po prostu tabela, w której mamy w menu funkcję pod tytułem „wzorzec”, czyli template. To jest normalna tabela, ale już przyciski – przycisk dodawania, … |
| `UW-11-03` | `materialy-launcher` | Magicznie jest w porządku, tylko mogłoby być trochę bardziej seksowne. |
| `UW-11-04` | `excele-jeden-widok-recent` | Nie rozumiem, po co to ma być tutaj w ogóle, nie? Jak otwieramy arkusz, to pierwsze – nowy – to pierwsze, co on nas pyta, czy chcemy otworzyć go z szablonów, czy otworzyć go jako czysty, czy otworzyć go z teresą. To omawialiśmy. I teraz, jeśli wybierzemy któryś z tych przycisków, uruchamia się odpowiedni wątek. Nie potrzebny w ogóle ten narkusz. Z pozostałością w ogóle pierwszych jakichś prób. |
| `UW-11-05` | `prezentacje-template-states` | nie otwiera mi sie nic :( |
| `UW-11-06` | `gen-word-content-hints` | Wiem, do czego ten ekran miałby służyć. Znowu, gdy mamy generator do wyboru, wybieramy „generuj tabelę template”, otwiera się generator szablonów, a potem mamy je w liście szablonów. Widzimy, po co jest ten ekran. |
| `UW-11-07` | `gen-deck-content-hints` | Samo, nie wiem, po co on w ogóle jest. |
| `UW-11-08` | `excele-edytowalna-siatka` | Znacznie lepiej jest - zamienmy teraz słowa na typowe dla excela ikony - kazdy chyba juz na swiecie je zna. i bedziemy blisko |
| `UW-11-09` | `document-studio-resume-error` | Napisz to ładniej, wyśrodkuj na ekranie. |
| `UW-11-10` | `document-studio-template-resolve-error` | Napisz to jakoś ładniej na środku ekranu, z ładniejszą grafiką. |
| `UW-11-11` | `word-intake-uselm-default` | Też można poprawić grafiki, nie? W wielu miejscach można poprawić je na ładniejszy styl, troszeczkę. Przyciski, żeby były zgodne ze standardem. Wiem, że to nie jest super ważne, ale nic tu nie poprawiłeś. |
| `UW-11-12` | `sheet-artifact` | Tutaj mamy niestety trochę do poprawy. Słuchaj, tak jak tabela w Excelu, sama tabela powinna zaczynać się od samej góry, więc powinniśmy mieć małe menu potencjalnych funkcjonalności. Poniżej powinniśmy mieć już tylko nazwę kolumn i samą tabelę. Teraz, jedna trzecia ekranu jest zużyta zupełnie niepotrzebnie na informacje albo funkcje, które mogłyby być w panelu bocznym rozwijanym. Mamy, rzeczywiście, upodobnić się tutaj do narzędzi tabelarycznych, takich jak Excel. |
| `UW-11-13` | `deck-artifact` | Dobrze, jeśli chodzi o układ graficzny – pełna zgoda, ekran jest super. Do przepracowania mamy prawy panel. Nie, i nie widzę nigdzie, gdzie mogę edytować, nie? Czyli narzędzia do edycji ręcznej też nie widzę. Podobnie, zresztą, jak w Excelu. |
| `UW-11-14` | `excele-prawy-panel-standard` | To już zgłaszałem, tak? Tutaj musimy usunąć więcej niepotrzebnego panelu, aby tabela zajmowała całą centralną część ekranu. No i wielki problem polega na tym, że nie mam tutaj w ogóle narzędzia Excelowego. Zmiany, jakbym chciał zmienić coś w tych tabelach, jak w Excelu, jakbym chciał nim pracować, to nie mogę. W Wordzie mogę, w PowerPoincie też nie mogę – to trzeba dorobić. |

## 12_AUDITS — Audyty (1)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-12-01` | `audyty-drd-report` | Znowu nie wiem, gdzie to jest, ale to nie wygląda jak pełna tabela. To muszą być raporty, które są po prostu pełną tabelą na pełną szerokość. |

## 13_CHAT — Czat (4)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-13-01` | `teresa-confirm-chip` | A zaproponujmy może trochę bardziej delikatną formułę graficzną tego okna, bo ono teraz jest takie duże i trochę toporne, a dzisiaj standardy tego typu konwersacji są już bardziej delikatne. Jak na przykład to robi właśnie Claude. |
| `UW-13-02` | `teresa-chipy-sugestii` | A możemy gdzieś jakoś kontekstowo to włączać, wyłączać, bo ja generalnie jestem przeciwnikiem, ale pewnie są tacy, którzy dzięki temu rozumieją, co mają zrobić. Także wyrzucenie tego całkiem nie jest okej, ale w sobie tego nie lubię. Może tam, gdzie mamy plus, w nie wiem, zaproponuj coś – wiemy coś fajnego. |
| `UW-13-03` | `canvas-kebab-restructure` | Wiesz nie wiem czy to docelowo będzie ok. Tutaj nagle wielkie funkcje sa pod pojedynczymi słowami. Nie wiem co to efektywnie zorbi. Moze warto byłoby zrobić z nich przyciski w delikatnych ramkach i połokrągłe. Zobaczmy co z tego będzie. To bardzo ważna zmiana bo dotyczy ona wszsytkich idea. |
| `UW-13-04` | `chat-signals-feed` | Nie wiem, gdzie to jest, ale to jest w ogóle super mądre. |

## 14_ADMIN — Administracja (3)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-14-01` | `prompt-registry-tab` | Znowuż nie mam pojęcia, gdzie to jest, tak szczerze powiedziawszy, i do czego to ma służyć. |
| `UW-14-02` | `admin-command-center-panel` | Znowu nie mam pojęcia, co to jest. |
| `UW-14-03` | `admin-command-attention-queue` | to ni jest szerokoś strony :( |

## 15_SETTINGS — Ustawienia (1)

| ID | Ekran | Uwaga właściciela |
| --- | --- | --- |
| `UW-15-01` | `calendar-sync-settings` | Dodaj tutaj Outlooka i zmień to jabłuszko na jakieś normalne, a nie takie jabłko. |

## ★ Cztery rozstrzygnięcia poza „ok" — BLOKUJĄ swoje moduły

Tych czterech zatwierdzenie z 2026-09-02 **nie obejmuje**. Właściciel wydał przy nich inne
rozstrzygnięcie i dopóki nie ma decyzji retestowej, moduł nie może dostać `PASS` w G17.

| Moduł | Ekran | Decyzja | Uwaga |
| --- | --- | --- | --- |
| Materiały | `gen-excel-templates-tab` | **nie** | To samo nie wiem, po co on jest. |
| Realizacja | `execution-tab-resources` | **poprawka** | Zobacz, karta podglądu w tym momencie nie zajmuje całej wysokości, jaką mogłaby mieć. Karta podglądu powinna być tak wysoka, jak tabela. Tabela, prawda, powinna być nieco bliżej trzeciego menu, ponieważ ta przestrzeń nie jest regulaminowa, nie jest kanonicznie wysoka. Generalnie karta podglądu musi mieć wysokość od góry do dołu – od trzeciego menu do dolnej części ekranu. |
| Wyniki | `results-three-pairs` | **nie** | To jest jakis hisotryczny ekran. chyba juz tem dawno nie wyglada. - mam nadzieje |
| Finanse | `finance-baseline-workspace` | **poprawka** | dalej nie mam przycisku dodawania założeń i mozlwosći usuwania lini |

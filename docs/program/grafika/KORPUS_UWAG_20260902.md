---
doc_id: grafika-korpus-uwag-20260902
status: canonical
truth_type: worklist
established: 2026-09-02
zrodlo: docs/program/grafika/odbior.sqlite (tabele `decyzje` i `historia`, odczyt tylko-do-odczytu) + status.json + evidence/grafika/
poprzednicy: MAPA_UWAG_WLASCICIELA.md (63 uwagi, 30.08) i UWAGI_ODBIOR_20260901.md (85 uwag, 01.09) — ten plik ich NIE zastepuje, tylko domyka calosc korpusu i rozlicza go per uwaga
---

# Korpus uwag wlasciciela — rozliczenie co do jednej

## Po co ten plik

Wlasciciel przeklikal **265 kart odbioru**. Przy **100 z nich kliknal `ok`, ale zostawil
uwage merytoryczna** — i tych uwag nikt nie rozliczyl pozycja po pozycji. Do tego dochodza
**3 uwagi spoza `ok`** (dwa `nie`, jedna `poprawka`). Razem **103 wiersze**.
Ten plik jest rejestrem tych 103 wierszy: dokladny cytat, data, modul, klasyfikacja
i — dla kazdej pozycji `DO_NAPRAWY` — jednozdaniowy warunek odbioru sprawdzalny okiem na zrzucie.

**To jest dyzur rozliczeniowy. Nic tu nie naprawiono.** Naprawy ida osobnymi zleceniami z tego rejestru.

## Jak zmierzono (nie z pamieci)

1. `select ekran,decyzja,uwaga,kiedy from decyzje where coalesce(trim(uwaga),'')<>''` → 103 wiersze (100 `ok` + 2 `nie` + 1 `poprawka`).
2. Modul, ocena i lista `naprawione` per ekran — z `status.json` (319 ekranow, wszystkie 103 sie w nim znajduja, zero sierot).
3. **Prawdziwa data uwagi** — z tabeli `historia`, nie z `decyzje`. Pole `decyzje.kiedy` klamie: 253 z 265 wierszy nosi znacznik `2026-09-02T10:44:57–58`, bo baza byla wtedy przepisana hurtem. W `historia` z 1952 wierszy **1268 to piec zapisow hurtem** (sekundy z >=5 wpisami: 01.09 09:50, 02.09 09:14, 09:22, 10:02, 10:44). Po ich odsianiu zostaje **684 realnych zapisow** — i to z nich pochodzi data w tabeli ponizej.
4. Weryfikacja `ZROBIONE` — para: wpis w `naprawione` **plus** katalog zrzutow w `evidence/grafika/`, z porownaniem znacznikow czasu (czy naprawa byla przed, czy po ostatnim kliknieciu wlasciciela).

## ★ Ustalenie, ktore zmienia obraz calosci: 52 uwagi to zamrozone `poprawka`/`nie`

**52 ze 103 uwag zostaly napisane w chwili, gdy wlasciciel klikal `poprawka` albo `nie`.**
Dzis te same ekrany stoja jako `ok` — z **niezmienionym, co do znaku, tekstem uwagi**.
Przelaczenie nastapilo niemal w calosci 01.09 miedzy 04:19 a 10:06.

To znaczy, ze zdanie „wlasciciel kliknal ok, ale zostawil uwage" jest w 52 przypadkach
nieprecyzyjne: on nie zostawil uwagi **przy** akcepcie — jego **odrzucenie zostalo przepisane
na akcept, a tresc zarzutu pojechala razem z nim**. Dlatego przy klasyfikacji zadna z tych 52 pozycji
nie dostala ulgi z tytulu stojacego dzis `ok`.

Piec przykladow (data napisania uwagi -> data przelaczenia na `ok`):

| ekran | uwaga napisana przy | przelaczone na `ok` |
| --- | --- | --- |
| `drd-library-entry` | 2026-08-30 11:24 — `poprawka` | 2026-09-01 05:03 — `ok` |
| `assessment-five-surfaces` | 2026-08-30 10:30 — `poprawka` | 2026-09-01 05:02 — `ok` |
| `interview-creator-shell` | 2026-08-30 11:32 — `poprawka` | 2026-09-01 04:59 — `ok` |
| `excele-prawy-panel-standard` | 2026-08-30 11:41 — `poprawka` | 2026-09-01 10:00 — `ok` |
| `results-vnext-teresa-okr-reflection` | 2026-08-30 11:47 — `poprawka` | 2026-09-01 05:12 — `ok` |

## Klasyfikacja — wynik

| kategoria | ile | udzial |
| --- | ---: | ---: |
| `ZROBIONE` | **24** | 23% |
| `DO_NAPRAWY` | **45** | 44% |
| `BACKLOG` | **34** | 33% |
| razem | **103** | 100% |

Wewnatrz `BACKLOG` (34) siedza dwa rozne byty i trzeba je rozdzielic, zeby liczba nie klamala:
* **23 pozycji bez tresci do rozliczenia** — sam akcept („ok", „OK"), pochwala („Love it", „To jest super!!!!!!!"), zdanie urwane w polowie, albo przypis operatora (piec ekranow logowania objetych akceptem zbiorowym 02.09 — to nie sa slowa wlasciciela).
* **11 realnych zyczen rozwojowych** — sa tresciwe, ale nie da sie z nich wyprowadzic warunku odbioru bez wczesniejszego prototypu albo decyzji produktowej.

## Rejestr — wszystkie 103 pozycje

Cytaty **doslowne z bazy**, bez poprawiania literowek i skladni wlasciciela. Kolumna `decyzja
pierwotna` mowi, co wlasciciel kliknal, **piszac te slowa** — nie co stoi w bazie dzisiaj.

### Czat — 15 uwag (`DO_NAPRAWY` 2 · `ZROBIONE` 1 · `BACKLOG` 12)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `processflow-canvas` | „Generalnie okno jest ok. Tutaj wielkim wyzwaniem jest ten panel boczny. na tym obrazie jak go nie mogę ocnić" | 2026-09-01 04:00 | `ok` | `DO_NAPRAWY` | Wlasciciel wprost mowi, ze na tym obrazie nie moze ocenic panelu bocznego — kadr nie pokazuje ekranu, wiec odbior jest niemozliwy. |
| `whiteboard-canvas` | „tutaj jest tylko problem taki ze jak zanaczam element otweira sie pasek poziomy funkcji i on sie nie mieści w pasu - sa ikony które wygladają poza okno. tutaj opisy trzeba skrócić albo wywalić." | 2026-09-01 04:17 | `ok` | `DO_NAPRAWY` | Po zaznaczeniu elementu ikony paska funkcji wychodza poza okno — to widac okiem na zrzucie. |
| `chat-signals-feed` | „Nie wiem, gdzie to jest, ale to jest w ogóle super mądre." | 2026-08-30 11:49 | — | `ZROBIONE` | Karta odbioru podaje dzis droge wejscia (Czat - panel sygnalow w oknie Teresy); mechanizm dopisany commitem 84ced6ce7a o 13:21 dnia 30.08, czyli po tej uwadze. |
| `canvas-kebab-restructure` | „Wiesz nie wiem czy to docelowo będzie ok. Tutaj nagle wielkie funkcje sa pod pojedynczymi słowami. Nie wiem co to efektywnie zorbi. Moze warto byłoby zrobić z nich przyciski w delikatnych ramkach i połokrągłe. Zobaczmy co z tego będzie. To bardzo ważna zmiana bo dotyczy ona wszsytkich idea." | 2026-09-01 04:10 | `ok` | `BACKLOG` | Wlasciciel zglasza watpliwosc i wlasna propozycje formy, ale konczy slowem 'zobaczmy' — to prototyp do akceptu, nie warunek odbioru. |
| `canvas-new-doc` | „ok" | 2026-09-01 04:11 | `ok` | `BACKLOG` | Sam akcept. |
| `canvas-toolbar-md-history` | „ok" | 2026-09-01 04:12 | `ok` | `BACKLOG` | Sam akcept. |
| `chat-split-teresa-right` | „ok" | 2026-09-01 03:57 | `ok` | `BACKLOG` | Sam wyraz zgody, zero tresci do rozliczenia. |
| `melscanvas-workspace` | „OK" | 2026-09-01 04:15 | `ok` | `BACKLOG` | Sam akcept. |
| `mindmap-canvas` | „OK" | 2026-09-01 04:15 | `ok` | `BACKLOG` | Sam akcept. |
| `mindmap-i18n-smoke` | „OK" | 2026-09-01 04:15 | `ok` | `BACKLOG` | Sam akcept. |
| `ntype-analizuj-ai` | „Potwierdziam ok. Będe wpisywał dalej tylko ok jako ponowne potwierdznie" | 2026-09-01 03:56 | `ok` | `BACKLOG` | To potwierdzenie akceptu, nie uwaga merytoryczna. |
| `teresa-chipy-panel-artefaktu` | „Love it" | 2026-09-01 04:18 | `ok` | `BACKLOG` | Pochwala bez zadania. |
| `teresa-chipy-sugestii` | „A możemy gdzieś jakoś kontekstowo to włączać, wyłączać, bo ja generalnie jestem przeciwnikiem, ale pewnie są tacy, którzy dzięki temu rozumieją, co mają zrobić. Także wyrzucenie tego całkiem nie jest okej, ale w sobie tego nie lubię. Może tam, gdzie mamy plus, w nie wiem, zaproponuj coś – wiemy coś fajnego." | 2026-08-30 10:49 | `poprawka` | `BACKLOG` | Prosba o kontekstowy wlacznik chipow to nowa funkcja, nie naprawa istniejacego ekranu. |
| `teresa-confirm-chip` | „A zaproponujmy może trochę bardziej delikatną formułę graficzną tego okna, bo ono teraz jest takie duże i trochę toporne, a dzisiaj standardy tego typu konwersacji są już bardziej delikatne. Jak na przykład to robi właśnie Claude." | 2026-08-30 10:47 | `poprawka` | `BACKLOG` | Wlasciciel prosi o 'delikatniejsza formule' bez wskazania wzorca w naszym kanonie — to wymaga prototypu przed warunkiem odbioru. |
| `whiteboard-workshop` | „ok" | 2026-09-01 04:18 | `ok` | `BACKLOG` | Sam akcept. |

### Moja praca — 17 uwag (`DO_NAPRAWY` 5 · `ZROBIONE` 6 · `BACKLOG` 6)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `decision-record` | „Tam jest jakiś komentarz – zobacz na tym screenie, że informacje przekazane nie są wysyłane do serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd, nie? Tak, weźmy to pod uwagę, aby oczywiście ta karta była połączona z całym systemem." | 2026-08-30 08:46 | `ok` | `DO_NAPRAWY` | Ekran informuje, ze dane zostaja w pamieci przegladarki zamiast trafiac na serwer — to widac na zrzucie i przesadza o uzytecznosci karty. |
| `idea-table` | „Tutaj ciagle zobacz Preview nie jest zgodny z wzorem" | 2026-09-01 10:02 | `poprawka` | `DO_NAPRAWY` | Uwaga z 02.09, najswiezsza w calym korpusie; status.json sam przyznaje, ze zostaje otwarta ('NIE TWIERDZE, ze to juz caly wzorzec'). |
| `idea-table-timeline-stuck` | „Tutaj, tak samo jak we wszystkich innych IDEach, wraca kwestia prawego menu." | 2026-08-30 11:23 | `ok` | `DO_NAPRAWY` | To samo zastrzezenie do prawego menu co w pozostalych ekranach Idei — wlasciciel wprost mowi, ze 'wraca kwestia prawego menu'. |
| `ideas-teresa-panel` | „Dobra, przeanalizowałem i teraz tak: cały ten prawy panel jest ewidentnie do przepracowania. Zarówno w ujęciu graficznym, kolejności myśli, jak i merytorsnym, co się tutaj musi wydarzyć. Koniecznie trzeba wrzucić to do backlogu, aby przeanalizować, jak ten panel powinien być zorganizowany, żeby był w pełni pomocny i użyteczny. Jednocześnie grafiki, które tutaj mamy, rozwiązania graficzne, też nie są przeanalizowane przez Ciebie i nie są zgodne ze standardem grafik, tylko tak, jak zostały przekonane przeze mnie dawno temu automatycznie. To jest słabe." | 2026-08-30 09:52 | `poprawka` | `DO_NAPRAWY` | Wlasciciel odrzuca caly prawy panel Idei — graficznie, kolejnosciowo i merytorycznie — i wskazuje, ze grafiki nie sa zgodne ze standardem. |
| `mywork-notebook-rail-speca` | „Teraz tak: on jest generalnie dużo lepszy niż to, co jest w Idea. Natomiast te dra‑meni, moim zdaniem, powinny wyglądać tak samo, mieć te same elementy albo prawie zbliżone, ale na pewno rządzić się tymi samymi zasadami. Więc jeśli tam zrobiliśmy informację, że idzie to do backlogu i trzeba to koniecznie przerobić gruntownie, myślę, że tutaj ta informacja powinna być powiązana z tym, co jest tam." | 2026-08-30 09:55 | `poprawka` | `DO_NAPRAWY` | Wlasciciel zada, by prawy pas Notatnika i prawy pas Idei rzadzily sie tymi samymi zasadami — to porownywalne okiem na dwoch zrzutach. |
| `idea-financial-case-persistence` | „Tak, to nawet nie wiem, co to jest i do czego to przypiąć." | 2026-08-30 11:23 | — | `ZROBIONE` | Karta podaje dzis droge (Moja praca - Idee - tabela pomyslu - Case finansowy); pole GDZIE uzupelnione dla wszystkich 319 ekranow commitem 76996ee069 o 15:27 dnia 30.08. |
| `karta-insight` | „Tutaj problemem jest to. W oknie centralnym mamy trzy kolumny; jest to zaciągnięte. Zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do dołu." | 2026-08-30 08:21 | `poprawka` | `ZROBIONE` | Trzy kolumny zamienione na trzy duze wiersze z trzema kolorami, dokladnie wedlug tej uwagi (odbior 30.08). |
| `mywork-idea-inspector-lekki` | „Nie wiem, nie mam pojęcia, gdzie ten plik, gdzie ten ekran jest, szczerze mówiąc. Domyślam się, że może tak wyglądać, bo jest techniczny, ale nie wiem, do czego służy." | 2026-08-30 09:53 | — | `ZROBIONE` | Karta podaje dzis droge wejscia i przeznaczenie ekranu; uzupelnione 30.08 po tej uwadze. |
| `notatnik-osierocone-graf` | „Jak robimy takie nody notatek to moze zrob ja na całym ekranie jedną bo kilka na jedym eraknie nie daje komortu pracy." | 2026-09-01 04:44 | `poprawka` | `ZROBIONE` | Graf polaczen dostal tryb pelnoekranowy dokladnie wedlug tej prosby (evidence/grafika/171-pojedyncze/), 01.09. |
| `vault-safes-table` | „Ja mam takie wrażenie, że tabela tego SEF‑u jest dziwnie wąska. Nie rozciąga się na całą szerokość tabeli. Pracuj nad tym, żeby wiersze mieściły się w jednej linii, a nie rozkładały się na cztery wiersze – żeby każdy wiersz był jedną linią, jak w tabeli. Układ jest okej, nie? Tylko mogę uznać to za wąskie." | 2026-08-30 10:01 | `poprawka` | `ZROBIONE` | Zmierzone zrzutem 30.08 (evidence/grafika/90-szerokosc-tabel/): pelna szerokosc i kazdy wiersz w jednej linii — dokladnie to, o co prosil; waskosc pochodzila z maxWidth przyrzadu, nie z produktu. |
| `zwornik-projects` | „Słuchaj, wiesz co, znowu nie wiem, gdzie to się uruchamia. Natomiast, jeśli mamy przyciski „dodaj i projekt” oraz coś tam drugiego, nie ma pełnej, dobrej nawigacji." | 2026-08-30 11:25 | `poprawka` | `ZROBIONE` | Zakladka Projekty stoi w glownym menu Mojej pracy (commit e98f82bfcc, bez flagi), a karta podaje droge wejscia. |
| `idea-table-tool-empty-filter` | „Wiedziałem, że mamy taką tabelę w ogóle." | 2026-08-30 09:45 | `ok` | `BACKLOG` | Komentarz o istnieniu tabeli, bez zadania. |
| `idea-templates-catalog` | „to jest moje marzenie aby to wszytko działało dobrze" | 2026-09-01 04:46 | `ok` | `BACKLOG` | Deklaracja oczekiwan, nie uwaga o ekranie. |
| `karta-decision` | „Tutaj ważne jest to, że mamy w górnym pasku przycisk „AI”, a później w pasku dalszego arkusza mamy „Analizuj z AI”. Pamiętaj, że to są dwie różne funkcjonalności. Górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty." | 2026-08-30 08:21 | `ok` | `BACKLOG` | Wlasciciel rozstrzyga roznice miedzy AI w pasku gornym a 'Analizuj z AI' w karcie — to regula do KANON_Z_ODBIOROW, nie defekt tego ekranu. |
| `karta-task` | „OK" | 2026-09-01 04:46 | `ok` | `BACKLOG` | Sam akcept. |
| `notatnik-centrum-mysli` | „To byłoby zajebiste, żeby to tak działało." | 2026-08-30 09:58 | `ok` | `BACKLOG` | Pochwala kierunku, bez zadania. |
| `vault-folder-block-proof` | „I tutaj co do zasady jestem ok z grafiką ale cała funcjonalność agenta powinna być duzo bardziej rozwinieta niz nasz obecny stan tego okna. ale te komponetny nodów są ok" | 2026-09-01 04:41 | `ok` | `BACKLOG` | Zastrzezenie dotyczy glebokosci funkcji agenta, nie wygladu ekranu ('komponenty nodow sa ok'). |

### Wywiad — 2 uwag (`DO_NAPRAWY` 2 · `ZROBIONE` 0 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `interview-creator-shell` | „To jest do poprawy wielkość ścianek, też już to zgłaszałem. Wilka z czcionek, obrazków – to nie wygląda jak sekcja tech, nie? Wszystkie elementy są w porządku, jest to w miarę czytelne, ale nie wygląda ładnie." | 2026-08-30 11:32 | `poprawka` | `DO_NAPRAWY` | Wlasciciel zglasza wielkosc scianek po raz kolejny ('tez juz to zglaszalem') i mowi wprost, ze ekran nie wyglada ladnie. |
| `interview-preview-canon` | „Nie umiem ocenić, czy szerokość tego jest wystarczająca, ale pamiętaj, że mamy opisane, jak ma to wyglądać. Wszystkie przewidywania muszą być opisane zgodnie ze standardem. To jest komponent." | 2026-08-30 11:32 | `poprawka` | `DO_NAPRAWY` | Wlasciciel odsyla do opisanego standardu podgladu i nie potrafi ocenic szerokosci — warunek jest w kanonie, wiec sprawdzalny. |

### Narzędzia — 4 uwag (`DO_NAPRAWY` 2 · `ZROBIONE` 1 · `BACKLOG` 1)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `karta-tool` | „Zobacz tutaj w karcie ostatniej w przykładzie. Mieliśmy usunąć dwa przykłady, bo mieliśmy trzy. Został jeden, ale w postaci jednej kolumny. To wygląda bez sensu. No i w tym narzędziu nie mam, jak przeklikać samego wypełniania dokumentu." | 2026-08-30 08:45 | `ok` | `DO_NAPRAWY` | Zostal jeden przyklad ulozony w jedna kolumne zamiast w uklad reszty karty, a wypelniania dokumentu nie da sie przekliknac. |
| `tools-swot-session-workspace` | „Jest jakaś prehistoryczna karta jeszcze za tym, zanim przerobiliśmy to." | 2026-08-30 11:49 | `nie` | `DO_NAPRAWY` | Wlasciciel widzi za biezacym ekranem karte sprzed przebudowy — to widac okiem w kadrze. |
| `prompt-registry-tab` | „Znowuż nie mam pojęcia, gdzie to jest, tak szczerze powiedziawszy, i do czego to ma służyć." | 2026-08-30 11:26 | — | `ZROBIONE` | Karta podaje dzis droge (SuperAdmin - AI Platform - Development) i mowi wprost, ze to narzedzie inzynierskie, nie ekran klienta. |
| `tools-swot-report` | „Oczywiście wygląda to dobrze, jakby treść była w porządku, z tym że żaden słod nie będzie tylko tak małą analizą, nie? Ale generalnie wygląda ok." | 2026-08-30 11:25 | `poprawka` | `BACKLOG` | Uwaga dotyczy glebokosci analizy SWOT, nie wygladu ('generalnie wyglada ok'). |

### Ocena — 9 uwag (`DO_NAPRAWY` 6 · `ZROBIONE` 1 · `BACKLOG` 2)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `assessment-five-surfaces` | „Niestety, tutaj tabela preview nie trzyma się opisanego standardu." | 2026-08-30 10:30 | `poprawka` | `DO_NAPRAWY` | Wprost: tabela podgladu nie trzyma sie opisanego standardu, a standard istnieje — warunek jest gotowy. |
| `assessment-initiatives-table` | „No, już to jest po prostu pełna tabela na pełną szerokość, a to wygląda, jakby to był jakiś raport w raporcie albo nie wiem co, nie? To ma być normalna tabela inicjatyw. Na koniec inicjatywy, na koniec każdej oceny, czy na koniec assessmentu, to są po prostu drafty inicjatywy, a normalnie w tabeli inicjatyw." | 2026-08-30 10:37 | `poprawka` | `DO_NAPRAWY` | Wlasciciel zada, by wynik Oceny konczyl sie draftami w normalnej tabeli Inicjatyw, a nie raportem w raporcie. |
| `assessment-output-report` | „No dobra, i teraz tak: jeśli chodzi o raporty z oceny, trochę to pomieszaliśmy, nie? Audyt i oceny to dwie różne historie. Oceny mają swój framework i raporty. Jeżeli chodzi o DRD, mamy konkretną formułę, w której znajdują się wszystkie poszczególne osie. Dla każdej osi określony jest obszar analityczny, więc musimy zbudować raport o dosyć sformalizowanej strukturze: 1. Wstęp z opisem, jak było prowadzone badanie. 2. Siedem osi – dla każdej z nich opisujemy najpierw samą oś, a następnie obszar. 3. Opisujemy odpowiedzi oraz wstępną paletę wniosków. 4. Na koniec podsumowanie. Tak więc raport jest znacznie bardziej sformalizowany. Podobnie w przypadku Siri – istnieje dokument opisujący, jak ma wyglądać raport. W audytach jest nieco większa dowolność, ale również trzeba przejść przez wnioski audytowe w kolejności, w jakiej audyt jest realizowany." | 2026-08-30 10:32 | `poprawka` | `DO_NAPRAWY` | Wlasciciel podaje strukture raportu z Oceny punkt po punkcie — to najostrzejszy z mozliwych warunkow odbioru. |
| `assessment-presentation-view` | „Ciagle nie wiem dlaczego nie uzywsz mojej maciezy DRD - nie mam juz siły serio !! moja maciez jest serio ładna - juz ja znalazłęśc przeciez (zobacz mam to na ekranie Macierz oceny DRD — obszary x poziomy)" | 2026-09-01 05:07 | `nie` | `DO_NAPRAWY` | Wlasciciel po raz kolejny i z emocja ('nie mam juz sily serio') zada macierzy DRD, ktora sam wskazal na ekranie — a naprawy dotyczyly wylacznie etykiet slajdu 5. |
| `assessment-quality-review-panel` | „Znowu taki wniosek: taka tabela jest możliwa, tylko pamiętaj, że w asesmencie mamy macierz odpowiedzi i ona jest ważna, bo jest narzędziem. To nie jest tylko prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję. Nie wiem, czy to, co mi tu pokazujesz, ma zastąpić macierz. Jeśli tak, to nie działa w ten sposób. Jeśli chcesz mieć oddzielną taką tabelę, to super, tylko to nie jest macierz. Dobrze, przejrzałem wszystkie karty. Nigdzie nie znalazłem macierzy. Macierz jest przedstawieniem graficznym na wszystkich osiach ze zmiennymi osiami. Poszukaj tego dokładnie. To w kodzie istnieje. To jest super ważne, bo ta macierz później wchodzi do raportu i wizualizuje poziomy oraz następne kroki. To jest jakby wizualizacja z głównym narzędziem tutaj." | 2026-08-30 10:39 | `poprawka` | `DO_NAPRAWY` | Wlasciciel mowi, ze tabela nie moze zastapic macierzy odpowiedzi, ktora jest narzedziem interakcji i istnieje w kodzie. |
| `drd-library-entry` | „Znowu dałeś mi coś bez analizy własnej. Tutaj nie ma żadnego podglądu; z całą pewnością kolumny nie są wystarczające. To nie jest dobra statystyka tego, co powinno być w tej tabeli. Do powtórki." | 2026-08-30 11:24 | `poprawka` | `DO_NAPRAWY` | Wprost: brak podgladu i niewystarczajace kolumny, plus zarzut o brak analizy wlasnej ('znowu') — naprawy dotyczyly tylko sciezki i podpiecia do przyrzadu. |
| `assessment-list` | „To samo rozumiem, że to ma być tabela na całą szerokość ekranu, a nie jakaś fragmentaryczna." | 2026-08-30 10:36 | `poprawka` | `ZROBIONE` | Pytanie potwierdzajace o pelna szerokosc; szerokosc zmierzona zrzutem 30.08 (evidence/grafika/90-szerokosc-tabel/assessment-list__PO__dark.png) — brakuje tylko zrzutu w motywie jasnym. |
| `assessment-reports-panel` | „No, to jest normalna tabela na pełną szerokość, jak rozumiem." | 2026-08-30 10:39 | `poprawka` | `BACKLOG` | Pytanie potwierdzajace ('jak rozumiem'), nie zarzut; szerokosc zmierzona zrzutem 30.08. |
| `siri-workspace` | „Ty, nie wiesz, co rozumiem, że okej, więc zobaczymy, jak to będzie, jak to wyjdzie. Ja nie znam Sir, więc trudno mi to ocenić." | 2026-08-30 10:38 | — | `BACKLOG` | Wlasciciel wprost mowi, ze nie zna metodyki i nie umie tego ocenic. |

### Inicjatywy — 4 uwag (`DO_NAPRAWY` 3 · `ZROBIONE` 1 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `capacity-advisor-a3` | „Dobrze, to jeszcze raz, bo już to opisywałem wiele razy. Słuchaj, jest tak: tutaj powinna być tabela, w której mamy na dany moment stworzony raport, czyli przycisk „Tworzy raport”. Raport jest generowany na bieżąco, na konkretną chwilę. Obecnie, albo po jego wygenerowaniu, w tym momencie tworzono jest zestawienie, ile osób jest w danym projekcie albo ile osób jest we wszystkich projektach, oraz ich analiza obciążenia zgodnie z planem. A teraz nie wiadomo, czemu otwiera się to w ramach tej karty. Nic tu nie zostało zmienione w ramach tej naprawy." | 2026-08-30 11:30 | `nie` | `DO_NAPRAWY` | Wlasciciel opisuje mechanike po raz kolejny ('juz to opisywalem wiele razy') i stwierdza, ze nic nie zostalo zmienione. |
| `initiative-record` | „Inicjatywę oceniałem już wcześniej, raz. Nie wiem, czemu to jest inna tabela inicjatyw. Czy to pomyłka, czy celowo – powinniśmy mieć jedną tabelę inicjatyw." | 2026-08-30 11:24 | `ok` | `DO_NAPRAWY` | Wlasciciel widzi dwie rozne tabele inicjatyw i pyta, czy to pomylka — porownanie dwoch zrzutow rozstrzyga. |
| `karta-initiative` | „Tutaj będę robił jeszcze więcej przeglądów, jak załadujesz je danymi. Natomiast na ten moment widzę, że nie ma przycisku AI w górnym pasku, który będzie odpowiadał za wypełnienie karty. Poza tym wygląda zajebiście." | 2026-08-30 08:48 | `poprawka` | `DO_NAPRAWY` | Brak przycisku AI w gornym pasku karty jest widoczny okiem, a wlasciciel oddziela go od 'Analizuj z AI' w sekcji. |
| `plan-scenario-d1` | „Tabela niestety dalej nie wygląda jak kompletna tabela. Tu jest większy problem. Problem polega na tym, że narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę. W ogóle nie rozumiem, jak to działa." | 2026-08-30 11:28 | `poprawka` | `ZROBIONE` | Kebab otwiera dzis karte inicjatywy, a Warsztat planu nie wciska sie juz jako druga tabela pod pierwsza (evidence/grafika/174-domkniecie/1-plan/, 01.09 — po ostatnim kliknieciu wlasciciela o 10:00, wiec on tego jeszcze nie widzial). |

### Realizacja — 5 uwag (`DO_NAPRAWY` 1 · `ZROBIONE` 4 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `exe-002-004-ui-audit` | „Trzeci raz dajesz mi tę kartę do akceptacji." | 2026-08-30 11:31 | `ok` | `DO_NAPRAWY` | 'Trzeci raz dajesz mi te karte do akceptacji' — to defekt strony odbioru, sprawdzalny licznikiem. |
| `execution-tab-control` | „Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno" | 2026-09-01 05:47 | `poprawka` | `ZROBIONE` | Pasek usuniety, przyciski przeniesione na prawo od Menu 2 (evidence/grafika/165-menu3-pasek/). |
| `execution-tab-resources` | „Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno" | 2026-09-01 05:47 | — | `ZROBIONE` | Ten sam pasek usuniety, filtr przeniesiony na prawo od Menu 2 (evidence/grafika/165-menu3-pasek/). |
| `execution-tab-rollout` | „tutaj wcale te słowa pomiędzy tabelą a menu 3 nie sa potrzebne" | 2026-09-01 05:48 | — | `ZROBIONE` | Zdanie opisowe miedzy naglowkiem a tabela usuniete (evidence/grafika/165-menu3-pasek/). |
| `execution-tab-work` | „Zobacz pomiedzy menu 3 a tabelą dołozyłeś dodatkowy element on moze spokojnie być z prawej strony menu 2. W całej aplikacji mamy standard ze tabela zaczyna się pod menu 3. I dzieki temu tez preview będie wygladało tak jak powinno" | 2026-09-01 05:46 | `poprawka` | `ZROBIONE` | Pasek miedzy Menu 3 a tabela usuniety, filtr przeniesiony na prawo od Menu 2 (evidence/grafika/165-menu3-pasek/, 01.09 08:54 — przed potwierdzeniem wlasciciela o 10:03). |

### Wyniki — 10 uwag (`DO_NAPRAWY` 9 · `ZROBIONE` 0 · `BACKLOG` 1)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `results-three-pairs` | „To jest jakis hisotryczny ekran. chyba juz tem dawno nie wyglada. - mam nadzieje" | 2026-09-01 05:54 | `nie` | `DO_NAPRAWY` | Wlasciciel twierdzi, ze ekran w rejestrze nie odpowiada dzisiejszemu produktowi — to sprawdzalne przez porownanie kadru z aplikacja. ZMIERZONE 2026-09-02: nie odpowiada KADR, nie ekran. Komponent jest domyslnym widokiem ladowania Wynikow w produkcie; harness montowal go bez powloki `ResultsHub`, wiec bez Menu 2/3. |
| `results-vnext-attention` | „tu sa tylko dwa przyciski w menu 2" | 2026-09-01 05:54 | — | `DO_NAPRAWY` | Dwa przyciski w Menu 2 to policzalny brak wobec reszty rejestrow Wynikow. |
| `results-vnext-okr-registry` | „Dobrze, tutaj zgłaszałem, ja już to się zapisało. W prawym, głównym rogu powinien być przycisk „Nowe dodawanie OKR”, a teraz są jakieś inne niepotrzebne przyciski." | 2026-08-30 09:08 | `poprawka` | `DO_NAPRAWY` | Wlasciciel wskazuje konkretne miejsce i konkretny przycisk, a naprawa dotyczyla tylko ucinanej pigulki. |
| `results-vnext-okr-workspace` | „To miało być w N-type karcie" | 2026-09-01 05:55 | — | `DO_NAPRAWY` | Jedno zdanie, ale jednoznaczne: to mial byc ekran w formie N-karty. |
| `results-vnext-roi-full-tool` | „Wiesz co, wydaje mi się, że mamy do poprawki, bo ROI to jedna analiza i powinna mieć formułę N‑karty. Tak jak teraz, gdy tworzysz to w menu poziomym, nie mamy możliwości ułożenia tego w strukturze dokumentu. To musi być n‑karta, gdzie będziemy mieli z nowej strony te zakładki, które teraz masz w menu, bo to menu, które teraz masz, już się nie wciśnie – byłoby to czwarte menu, a to byłoby zupełnie niepotrzebne. Dlatego musi być n‑karta. Każda jedna analiza RI, łącznie z modelem, to jest po prostu jedna karta." | 2026-08-30 09:04 | `nie` | `DO_NAPRAWY` | Wlasciciel opisuje wprost docelowa forme (N-karta z zakladkami po lewej) i uzasadnia, ze czwarte menu poziome sie nie zmiesci. |
| `results-vnext-roi-model` | „Tutaj muszę to odrzucić, bo wniosek jest dokładnie taki, jak wcześniej opisałem. Musimy przenieść to do jednej n‑karty." | 2026-08-30 09:04 | — | `DO_NAPRAWY` | Wlasciciel odrzuca ekran i powtarza wniosek, ktory juz wczesniej opisal: ROI ma byc jedna N-karta. |
| `results-vnext-roi-pir-outcomes` | „I to jest, jak rozumiem, konsekwencja poprzednich, czyli to jest kolejna N‑karta w jednym ROI‑u." | 2026-08-30 09:04 | — | `DO_NAPRAWY` | Konsekwencja tej samej decyzji o N-karcie ROI, potwierdzona przez wlasciciela. |
| `results-vnext-teresa-kpi-deviation` | „Tutaj zrobiłęś grafikę jak z przez 5 lat. zoabcz to nie jest spójne z naszyą formą UI/UX" | 2026-09-01 05:53 | `poprawka` | `DO_NAPRAWY` | 'grafika jak sprzed 5 lat, niespojna z nasza forma UI/UX' — porownanie z karta N rozstrzyga okiem. |
| `results-vnext-teresa-okr-reflection` | „Grafika tego jest fatalna, po prostu stara." | 2026-08-30 11:47 | `poprawka` | `DO_NAPRAWY` | 'Grafika tego jest fatalna, po prostu stara' — porownanie z karta N rozstrzyga okiem; naprawy 02.09 dotyczyly tylko jezyka. |
| `results-vnext-search-registry` | „generalnie układ menu i tabele sa ok ale tutaj wiele nie ma do akcpetacji" | 2026-09-01 05:56 | `ok` | `BACKLOG` | Wlasciciel akceptuje uklad i sam mowi, ze nie ma tu wiele do akceptacji; ekran stoi za flaga domyslnie wylaczona. |

### Finanse — 4 uwag (`DO_NAPRAWY` 2 · `ZROBIONE` 2 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `finance-baseline-workspace` | „dalej nie mam przycisku dodawania założeń i mozlwosći usuwania lini" | 2026-09-01 10:04 | `poprawka` | `DO_NAPRAWY` | 'Dalej nie mam przycisku' — jedyny ekran, ktory do dzis stoi z decyzja 'poprawka'. |
| `finance-valuation-workspace` | „Dobrze, słuchaj, to jak merytorycznie pewnie wygląda, to dobrze. Popracuj trochę nad grafiką. Zobacz, przyciski u góry są po prostu słowami, nie przyciskami okrągłymi. Popraw je graficznie, żeby wyglądały tak jak reszta naszego dokumentu. Układ merytoryczny i przepływ informacji są super." | 2026-08-30 09:26 | — | `DO_NAPRAWY` | Wlasciciel chwali merytoryke i wskazuje jeden konkretny defekt graficzny: przyciski sa golymi slowami. |
| `finance-analysis-workspace` | „Nie mam jak tego zatwierdzić, nic tu nie widać, nic z tego nie można wyciągnąć." | 2026-08-30 09:25 | — | `ZROBIONE` | Przyczyna 'nic tu nie widac' byla ucieta: 11 naglowkow kolumn i wartosci w komorkach ucinanych w polowie slowa — naprawione i potwierdzone zrzutem (evidence/grafika/154-finanse-naprawa/, 31.08, przed potwierdzeniem wlasciciela 01.09). |
| `finance-compare-panel` | „A moze całą szerokość dostpenego ekranu wykrzystajmy" | 2026-09-01 05:16 | `poprawka` | `ZROBIONE` | Tabela porownania rozszerzona z ~740 px do ~1364 px dokladnie wedlug tej prosby (evidence/grafika/166-tabela-szerokosc/, 01.09 08:56 — przed potwierdzeniem wlasciciela o 10:03). |

### Materiały — 15 uwag (`DO_NAPRAWY` 7 · `ZROBIONE` 4 · `BACKLOG` 4)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `deck-artifact` | „Dobrze, jeśli chodzi o układ graficzny – pełna zgoda, ekran jest super. Do przepracowania mamy prawy panel. Nie, i nie widzę nigdzie, gdzie mogę edytować, nie? Czyli narzędzia do edycji ręcznej też nie widzę. Podobnie, zresztą, jak w Excelu." | 2026-08-30 10:25 | `poprawka` | `DO_NAPRAWY` | Wlasciciel chwali uklad, ale wskazuje dwa braki widoczne okiem: prawy panel do przepracowania i brak narzedzi recznej edycji. |
| `document-studio-resume-error` | „Napisz to ładniej, wyśrodkuj na ekranie." | 2026-08-30 11:46 | `poprawka` | `DO_NAPRAWY` | 'Napisz to ladniej, wysrodkuj na ekranie' — wysrodkowanie sprawdza sie okiem na zrzucie; naprawa 02.09 usunela przyczyne awarii, ale nie dotknela wygladu samego stanu. |
| `document-studio-template-resolve-error` | „Napisz to jakoś ładniej na środku ekranu, z ładniejszą grafiką." | 2026-08-30 11:46 | `poprawka` | `DO_NAPRAWY` | Ta sama prosba co wyzej, dotyczy blizniaczego stanu bledu. |
| `excele-jeden-widok-recent` | „Nie rozumiem, po co to ma być tutaj w ogóle, nie? Jak otwieramy arkusz, to pierwsze – nowy – to pierwsze, co on nas pyta, czy chcemy otworzyć go z szablonów, czy otworzyć go jako czysty, czy otworzyć go z teresą. To omawialiśmy. I teraz, jeśli wybierzemy któryś z tych przycisków, uruchamia się odpowiedni wątek. Nie potrzebny w ogóle ten narkusz. Z pozostałością w ogóle pierwszych jakichś prób." | 2026-08-30 11:35 | `nie` | `DO_NAPRAWY` | Wlasciciel odsyla do ustalonej wczesniej mechaniki ('to omawialismy') i nazywa ekran pozostaloscia po pierwszych probach. |
| `excele-prawy-panel-standard` | „To już zgłaszałem, tak? Tutaj musimy usunąć więcej niepotrzebnego panelu, aby tabela zajmowała całą centralną część ekranu. No i wielki problem polega na tym, że nie mam tutaj w ogóle narzędzia Excelowego. Zmiany, jakbym chciał zmienić coś w tych tabelach, jak w Excelu, jakbym chciał nim pracować, to nie mogę. W Wordzie mogę, w PowerPoincie też nie mogę – to trzeba dorobić." | 2026-08-30 11:41 | `poprawka` | `DO_NAPRAWY` | 'To juz zglaszalem' — panel wciaz odbiera miejsce tabeli, a narzedzia excelowego nadal nie ma; naprawa dotyczyla jednego naglowka kolumny. |
| `sheet-artifact` | „Tutaj mamy niestety trochę do poprawy. Słuchaj, tak jak tabela w Excelu, sama tabela powinna zaczynać się od samej góry, więc powinniśmy mieć małe menu potencjalnych funkcjonalności. Poniżej powinniśmy mieć już tylko nazwę kolumn i samą tabelę. Teraz, jedna trzecia ekranu jest zużyta zupełnie niepotrzebnie na informacje albo funkcje, które mogłyby być w panelu bocznym rozwijanym. Mamy, rzeczywiście, upodobnić się tutaj do narzędzi tabelarycznych, takich jak Excel." | 2026-08-30 10:23 | `poprawka` | `DO_NAPRAWY` | Wlasciciel opisuje docelowy uklad arkusza wprost (maly pasek funkcji, pod nim naglowki i tabela) i wskazuje, ze jedna trzecia ekranu jest zmarnowana. |
| `word-intake-uselm-default` | „Też można poprawić grafiki, nie? W wielu miejscach można poprawić je na ładniejszy styl, troszeczkę. Przyciski, żeby były zgodne ze standardem. Wiem, że to nie jest super ważne, ale nic tu nie poprawiłeś." | 2026-08-30 11:47 | — | `DO_NAPRAWY` | Obok ogolnego zyczenia stoi konkret sprawdzalny okiem — przyciski maja byc zgodne ze standardem — a wlasciciel dodaje, ze nic tu nie poprawiono. |
| `excele-edytowalna-siatka` | „Znacznie lepiej jest - zamienmy teraz słowa na typowe dla excela ikony - kazdy chyba juz na swiecie je zna. i bedziemy blisko" | 2026-09-01 05:33 | `poprawka` | `ZROBIONE` | Pasek narzedzi zmieniony ze slow na ikony ($, %, B, ikony wiersza i kolumny, #) dokladnie wedlug tej prosby (evidence/grafika/171-pojedyncze/, 01.09). |
| `gen-deck-content-hints` | „Samo, nie wiem, po co on w ogóle jest." | 2026-08-30 11:43 | `nie` | `ZROBIONE` | Karta podaje dzis droge (Materialy - Nowy - Prezentacja - kreator szablonow), uzupelnione 30.08 po tej uwadze. |
| `gen-word-content-hints` | „Wiem, do czego ten ekran miałby służyć. Znowu, gdy mamy generator do wyboru, wybieramy „generuj tabelę template”, otwiera się generator szablonów, a potem mamy je w liście szablonów. Widzimy, po co jest ten ekran." | 2026-08-30 11:42 | `nie` | `ZROBIONE` | Wlasciciel sam odtwarza sciezke i konczy 'widzimy, po co jest ten ekran' — droga wejscia stoi na karcie. |
| `prezentacje-template-states` | „nie otwiera mi sie nic :(" | 2026-09-01 05:31 | `poprawka` | `ZROBIONE` | Domyslny wariant pokazuje dzis realna tresc, a stan ladowania odrzuca sie do czytelnego komunikatu (evidence/grafika/174-domkniecie/5-prezentacje/, 01.09 11:28 — juz po ostatnim kliknieciu wlasciciela o 10:04). |
| `gen-excel-templates-tab` | „To samo nie wiem, po co on jest." | 2026-08-30 11:43 | `nie` | `BACKLOG` | Wlasciciel nie kwestionuje grafiki, tylko sens istnienia zakladki — to rozstrzygniecie produktowe, nie defekt. |
| `materialy-launcher` | „Magicznie jest w porządku, tylko mogłoby być trochę bardziej seksowne." | 2026-08-30 10:17 | `poprawka` | `BACKLOG` | 'Moglaby byc bardziej seksowne' bez wskazania konkretu — nie da sie z tego wyprowadzic warunku odbioru. |
| `template-builder-doc` | „To jest super!!!!!!! proste i czytelne - brawo" | 2026-08-30 10:11 | `ok` | `BACKLOG` | Pochwala bez zadania. |
| `template-library-new-entry` | „No, tak jak rozumiem, to jest normalna tabela, bo przecież to jest po prostu tabela, w której mamy w menu funkcję pod tytułem „wzorzec”, czyli template. To jest normalna tabela, ale już przyciski – przycisk dodawania, …" | 2026-08-30 10:17 | `poprawka` | `BACKLOG` | Zdanie urywa sie w polowie ('ale juz przyciski - przycisk dodawania, ...'), wiec warunku odbioru nie da sie z niego wyprowadzic bez dopytania. |

### Audyty — 1 uwag (`DO_NAPRAWY` 0 · `ZROBIONE` 1 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `audyty-drd-report` | „Znowu nie wiem, gdzie to jest, ale to nie wygląda jak pełna tabela. To muszą być raporty, które są po prostu pełną tabelą na pełną szerokość." | 2026-08-30 10:35 | `poprawka` | `ZROBIONE` | Karta podaje droge i uprzedza, ze zakladka stoi za flaga domyslnie wylaczona; pelna szerokosc zmierzona zrzutem 30.08 (evidence/grafika/90-szerokosc-tabel/) — zostaje otwarta osobna decyzja o wlaczeniu flagi. |

### Spotkania — 1 uwag (`DO_NAPRAWY` 1 · `ZROBIONE` 0 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `calendar-sync-settings` | „Dodaj tutaj Outlooka i zmień to jabłuszko na jakieś normalne, a nie takie jabłko." | 2026-08-30 11:33 | `poprawka` | `DO_NAPRAWY` | Dwa policzalne zadania: dodac Outlooka i zmienic ikone; naprawy dotyczyly jezyka i przelacznika w ciemnym motywie. |

### Administracja — 2 uwag (`DO_NAPRAWY` 1 · `ZROBIONE` 1 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `admin-command-attention-queue` | „to ni jest szerokoś strony :(" | 2026-09-01 10:05 | `poprawka` | `DO_NAPRAWY` | Uwaga z 02.09: mimo zamiany kart na tabele w poprzedniej fali kolejka nadal nie zajmuje szerokosci strony. |
| `admin-command-center-panel` | „Znowu nie mam pojęcia, co to jest." | 2026-08-30 11:27 | `poprawka` | `ZROBIONE` | Karta podaje dzis pelna droge (Panel Administratora - grupa Centrum administracyjne - zakladki), uzupelnione 30.08 po tej uwadze. |

### Agent — 2 uwag (`DO_NAPRAWY` 0 · `ZROBIONE` 0 · `BACKLOG` 2)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `agent-plan-canvas` | „To jest wielka praca do zrobienia - ten ekran ktory mi pokazujesz niestety nie pokazuje wiele zobac jak jest zrobiony. - tutaj trzeba bardziej wypracować mozliwość pracy jak komponentami klockami które przekładamy i układamy jak flow w N8N - oczywicie to musi być lekko bardziej poważne ale przesuwalnosc klocków bardzo by pomogała. i oczywiści AI buduje sam klocki tez" | 2026-09-01 05:39 | `poprawka` | `BACKLOG` | Wlasciciel opisuje docelowa mechanike kanwy agenta (przesuwalne klocki jak w n8n) — to program rozwojowy, nie naprawa tego ekranu. |
| `agent-warsztat` | „Słuchaj, prokuruję tutaj narzędzia, jak na przykład dodanie, zrównoleglenie procesów. Merytorycznie ten agent jest jeszcze do wypracowania. Na tym poziomie myślę, że graficznie nam to pasuje – naprawdę za małe są te elementy." | 2026-08-30 10:54 | `poprawka` | `BACKLOG` | Zastrzezenie dotyczy merytoryki agenta ('jeszcze do wypracowania'), a zdanie o wielkosci elementow jest w zapisie sprzeczne z akceptem graficznym — wymaga dopytania. |

### Kanon i elementy wspólne — 6 uwag (`DO_NAPRAWY` 4 · `ZROBIONE` 1 · `BACKLOG` 1)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `prawy-panel-szyna-ikon` | „Nie wiem, czy to jest naprawdę jakaś poprawa, szczerze powiedział." | 2026-08-30 11:45 | — | `DO_NAPRAWY` | Wlasciciel watpi, czy szyna ikon cokolwiek poprawia — dopoki nie zobaczy porownania, wariant nie moze zostac uznany za przyjety. |
| `prawy-pas-jedna-formula-idea-teresa` | „Dobra tego nie rozumiem - tutaj zobacz jest okno teresy w panelu tego okna ale przecież teresa ma okno swoje." | 2026-09-01 06:38 | `poprawka` | `DO_NAPRAWY` | Wlasciciel wprost kwestionuje obecnosc okna Teresy w panelu narzedzia, skoro Teresa ma wlasne okno — sprzecznosc widac na jednym zrzucie. |
| `prawy-pas-jedna-formula-notatka-teresa` | „ta sama mysl - nie wiem dlaczego teresa jet w oknie narezia soro jest osobna teresa" | 2026-09-01 06:39 | `poprawka` | `DO_NAPRAWY` | Ta sama mysl powtorzona przy blizniaczym ekranie Notatki. |
| `preview-4-zakladki` | „Zobacz, to jest wartościowy obrazek, bo pokazuje, jak nieporównywalne są podglądy, które powinny być takie same. Nie wiem, czy to przyda się w aplikacji – chyba nie – ale widać, że podglądy wymagają poprawy." | 2026-08-30 11:45 | — | `DO_NAPRAWY` | Cztery podglady w jednym kadrze roznia sie szkieletem, a kanon podgladu wymaga jednego szkieletu dla wszystkich modulow. |
| `standard-module-bar-children` | „Nie mam pojęcia, co to w ogóle jest." | 2026-08-30 11:44 | — | `ZROBIONE` | Karta mowi dzis wprost, ze to galeria wariantow komponentu w przyrzadzie, a nie ekran produktowy. |
| `standard-kanban-card` | „Super, wybierzmy ten standard jeden. To jest dobry pomysł." | 2026-08-30 11:48 | — | `BACKLOG` | Rozstrzygniecie wlasciciela ('wybierzmy ten standard jeden') — regula do KANON_Z_ODBIOROW, nie defekt. |

### Internal Tools / AI OS — 1 uwag (`DO_NAPRAWY` 0 · `ZROBIONE` 1 · `BACKLOG` 0)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `aios-connectors` | „Dodaj tutaj także wersję w liście. Bo jak będzie dużo pozycji do dołączenia, to może być trudniej zarządzać, czyli zmiany widoków." | 2026-09-01 06:40 | `poprawka` | `ZROBIONE` | Dodany przelacznik Kafle/Lista, a widok Lista renderuje sie jako realna tabela — dokladnie o to prosil (evidence/grafika/171-pojedyncze/, 01.09). |

### Logowanie i ekrany przed zalogowaniem — 5 uwag (`DO_NAPRAWY` 0 · `ZROBIONE` 0 · `BACKLOG` 5)

| ekran | cytat doslowny | data | decyzja pierwotna | klasyfikacja | uzasadnienie |
| --- | --- | --- | :-: | :-: | --- |
| `auth-code-entry` | „AKCEPT ZBIOROWY wlasciciela 02.09: "wszystkie sa ok". Ekrany sprzed zalogowania powstaly dzis (naprawa jezyka i czerwieni); wlasciciel widzial zrzut ekranu logowania, pozostale cztery objal akceptem zbiorczym, nie ogladal ich pojedynczo." | 2026-09-02 14:15 | — | `BACKLOG` | To nie jest uwaga wlasciciela, tylko przypis operatora o akcepcie zbiorowym — wylaczone z korpusu. |
| `auth-forgot-password` | „AKCEPT ZBIOROWY wlasciciela 02.09: "wszystkie sa ok". Ekrany sprzed zalogowania powstaly dzis (naprawa jezyka i czerwieni); wlasciciel widzial zrzut ekranu logowania, pozostale cztery objal akceptem zbiorczym, nie ogladal ich pojedynczo." | 2026-09-02 14:15 | — | `BACKLOG` | Przypis operatora o akcepcie zbiorowym — wylaczone z korpusu. |
| `auth-login` | „AKCEPT ZBIOROWY wlasciciela 02.09: "wszystkie sa ok". Ekrany sprzed zalogowania powstaly dzis (naprawa jezyka i czerwieni); wlasciciel widzial zrzut ekranu logowania, pozostale cztery objal akceptem zbiorczym, nie ogladal ich pojedynczo." | 2026-09-02 14:15 | — | `BACKLOG` | Przypis operatora o akcepcie zbiorowym — wylaczone z korpusu. |
| `auth-register` | „AKCEPT ZBIOROWY wlasciciela 02.09: "wszystkie sa ok". Ekrany sprzed zalogowania powstaly dzis (naprawa jezyka i czerwieni); wlasciciel widzial zrzut ekranu logowania, pozostale cztery objal akceptem zbiorczym, nie ogladal ich pojedynczo." | 2026-09-02 14:15 | — | `BACKLOG` | Przypis operatora o akcepcie zbiorowym — wylaczone z korpusu. |
| `auth-reset-password` | „AKCEPT ZBIOROWY wlasciciela 02.09: "wszystkie sa ok". Ekrany sprzed zalogowania powstaly dzis (naprawa jezyka i czerwieni); wlasciciel widzial zrzut ekranu logowania, pozostale cztery objal akceptem zbiorczym, nie ogladal ich pojedynczo." | 2026-09-02 14:15 | — | `BACKLOG` | Przypis operatora o akcepcie zbiorowym — wylaczone z korpusu. |

## Warunki odbioru dla pozycji `DO_NAPRAWY` — tresc bramki G17

Kazdy warunek jest jednym zdaniem sprawdzalnym **okiem na zrzucie**. Jesli warunku nie da sie
rozstrzygnac patrzac na obrazek, warunek jest zly i nalezy go przepisac, a nie obejsc.

| # | ekran | modul | rodzina | warunek odbioru |
| ---: | --- | --- | --- | --- |
| 1 | `finance-valuation-workspace` | Finanse | R10 przyciski-slowa | Przyciski u gory warsztatu wyceny sa pastylkami w ramkach o tych samych wysokosciach i promieniach co reszta dokumentu, nie golymi slowami. |
| 2 | `word-intake-uselm-default` | Materiały | R10 przyciski-slowa | Przyciski na ekranie wejscia Word sa pastylkami wedlug kanonu (te same wysokosci i promienie co StandardModuleBar), nie golymi slowami. |
| 3 | `processflow-canvas` | Czat | R11 kadr przyrzadu | Zrzut Process Flow pokazuje panel boczny kanwy rozwiniety w calosci, w obu motywach. |
| 4 | `results-three-pairs` | Wyniki | R11 kadr przyrzadu | Ekran w rejestrze montuje sie w powloce `ResultsHub`, wiec w kadrze stoi Menu 2 i Menu 3 nad widokiem — tak jak w produkcie. SPROSTOWANIE 2026-09-02: pierwotny warunek dopuszczal ZDJECIE ekranu z rejestru i opieral sie na blednym zalozeniu, ze to ekran historyczny. Pomiar pokazal odwrotnie: `ResultsThreePairsView` jest DOMYSLNYM widokiem ladowania Wynikow w produkcie (`ResultsHub.tsx:1975`, flaga `threePairs` domyslnie ON na demo/stage/dev). Wlasciciel opisal KADR, nie ekran — harness montowal ten widok goly, bez powloki. Zdjecie z rejestru schowaloby to, co klient widzi w Wynikach jako pierwsze. |
| 5 | `tools-swot-session-workspace` | Narzędzia | R11 kadr przyrzadu | W kadrze sesji SWOT nie widac zadnej karty sprzed przebudowy; ekran pokazuje wylacznie obecna powloke. |
| 6 | `assessment-presentation-view` | Ocena | R12 macierz DRD | Prezentacja z Oceny zawiera slajd z macierza DRD (obszary x poziomy) w formie z ekranu 'Macierz oceny DRD', a nie same paski z liczbami. |
| 7 | `assessment-quality-review-panel` | Ocena | R12 macierz DRD | Ekran pokazuje macierz oceny (obszary x poziomy) jako narzedzie, w ktore da sie kliknac, a nie zastepcza tabele; jesli tabela ma zostac, stoi obok macierzy, nie zamiast niej. |
| 8 | `whiteboard-canvas` | Czat | R15 element nie miesci sie w kadrze | Po zaznaczeniu elementu poziomy pasek funkcji miesci sie w szerokosci kanwy: zadna ikona ani etykieta nie wychodzi poza okno, w obu motywach. |
| 9 | `karta-tool` | Narzędzia | R17 uklad | W karcie narzedzia pozostaly przyklad ma taki sam uklad jak pozostale sekcje karty (nie pojedyncza waska kolumne), a przeplyw wypelniania dokumentu da sie przejsc na zrzutach. |
| 10 | `decision-record` | Moja praca | R18 dane | Karta decyzji zapisuje zmiany na serwer: na ekranie nie ma komunikatu o zapisie wylacznie w pamieci przegladarki. |
| 11 | `interview-creator-shell` | Wywiad | R19 scianki i skala | Kreator wywiadu ma te same marginesy, odstepy i skale czcionek co wzorzec SPEC-A (porownanie obok karty-initiative), a nie gestsza siatke deweloperska. |
| 12 | `admin-command-attention-queue` | Administracja | R2 szerokosc tabeli | Kolejka uwagi zajmuje pelna szerokosc strony (bez wlasnego maxWidth), w obu motywach. |
| 13 | `assessment-output-report` | Ocena | R20 struktura raportu | Raport z Oceny DRD ma strukture: (1) wstep o sposobie prowadzenia badania, (2) siedem osi, przy kazdej najpierw os, potem obszar analityczny, (3) odpowiedzi i wstepna paleta wnioskow, (4) podsumowanie; raport audytu idzie osobna kolejnoscia wnioskow audytowych. |
| 14 | `assessment-initiatives-table` | Ocena | R21 jedna tabela inicjatyw | Inicjatywy z Oceny pokazuja sie w tej samej tabeli Inicjatyw co modul Inicjatywy (ta sama kolumnistyka i ten sam kebab), na pelna szerokosc. |
| 15 | `initiative-record` | Inicjatywy | R21 jedna tabela inicjatyw | Ekran initiative-record i tabela w module Inicjatywy pokazuja te sama tabele (te same kolumny, ten sam kebab). |
| 16 | `capacity-advisor-a3` | Inicjatywy | R22 raport na zadanie | Doradca zdolnosci ma przycisk tworzenia raportu, a wygenerowany raport otwiera sie jako osobna karta z obsada i obciazeniem wzgledem planu, nie wewnatrz biezacej karty. |
| 17 | `karta-initiative` | Inicjatywy | R23 przycisk AI w pasku | W gornym pasku karty inicjatywy stoi przycisk AI wypelniajacy cala karte, odrebny od 'Analizuj z AI' w sekcji. |
| 18 | `exe-002-004-ui-audit` | Realizacja | R25 przyrzad marnuje czas wlasciciela | Strona odbioru nie pokazuje ponownie ekranu, przy ktorym od poprzedniego klikniecia wlasciciela nie zaszla zadna zmiana. |
| 19 | `results-vnext-okr-registry` | Wyniki | R26 przycisk dodawania | W prawym gornym rogu rejestru OKR stoi jeden przycisk dodania OKR; przyciski niezwiazane z dodawaniem znikaja z tego miejsca. |
| 20 | `results-vnext-attention` | Wyniki | R27 niepelne Menu 2 | Menu 2 ekranu Uwaga ma komplet pozycji rejestrow Wynikow, taki sam jak pozostale ekrany modulu. |
| 21 | `finance-baseline-workspace` | Finanse | R29 brak akcji | Warsztat bazowy ma na ekranie przycisk dodania zalozenia i akcje usuniecia wiersza. |
| 22 | `document-studio-resume-error` | Materiały | R30 ekran bledu | Komunikat o przerwanej sesji jest wysrodkowany w kadrze i zlozony jak reszta stanow pustych (ikona, jedno zdanie, akcja powrotu). |
| 23 | `document-studio-template-resolve-error` | Materiały | R30 ekran bledu | Komunikat o nierozwiazanym szablonie jest wysrodkowany w kadrze i zlozony jak reszta stanow pustych. |
| 24 | `excele-jeden-widok-recent` | Materiały | R31 droga startu | Otwarcie nowego arkusza zaczyna sie od pytania o droge startu (szablon / czysty / Teresa); ekran 'ostatnie' znika z tej sciezki. |
| 25 | `calendar-sync-settings` | Spotkania | R34 brak integracji | Lista integracji kalendarza zawiera Outlooka, a ikona Apple pochodzi z zestawu znakow firmowych, nie jest rysunkiem jablka. |
| 26 | `assessment-five-surfaces` | Ocena | R4 podglad | Tabela podgladu w Ocenie ma szesc blokow kanonu podgladu i te same szerokosci kolumn co wzorzec. |
| 27 | `drd-library-entry` | Ocena | R4 podglad | Wpis biblioteki DRD ma panel podgladu z szescioma blokami kanonu, a tabela komplet kolumn opisany dla tej biblioteki. |
| 28 | `idea-table` | Moja praca | R4 podglad | Podglad w tabeli Idei ma szesc blokow kanonu podgladu w tej samej kolejnosci i o tej samej szerokosci co wzorzec. |
| 29 | `interview-preview-canon` | Wywiad | R4 podglad | Podglad wywiadu ma szesc blokow kanonu podgladu i te sama szerokosc panelu co wzorzec. |
| 30 | `preview-4-zakladki` | Kanon i elementy wspólne | R4 podglad | Wszystkie cztery podglady w kadrze maja te same szesc blokow kanonu (naglowek - meta - tresc - Co dalej - pastylki akcji - kebab), w tej samej kolejnosci i o tej samej szerokosci. |
| 31 | `idea-table-timeline-stuck` | Moja praca | R5 prawy panel | Prawy panel tego ekranu ma te sama kolejnosc sekcji i te same tokeny co wzorzec SPEC-A — identycznie jak w ideas-teresa-panel. |
| 32 | `ideas-teresa-panel` | Moja praca | R5 prawy panel | Prawy panel Idei ma kolejnosc sekcji z kanonu SPEC-A (Akcje - Wlasciwosci - Powiazania - Zrodla i zalozenia - Komentarze - Historia) i wylacznie tokeny c-*; zero grafik spoza standardu. |
| 33 | `mywork-notebook-rail-speca` | Moja praca | R5 prawy panel | Prawy pas Notatnika i prawy pas Idei maja te same sekcje w tej samej kolejnosci; informacja o backlogu wystepuje w obu albo w zadnym. |
| 34 | `prawy-panel-szyna-ikon` | Kanon i elementy wspólne | R5 prawy panel | Jeden kadr PRZED/PO pokazuje, co szyna ikon dodaje wzgledem wariantu bez szyny; jesli nie dodaje nic, wraca wariant poprzedni. |
| 35 | `prawy-pas-jedna-formula-idea-teresa` | Kanon i elementy wspólne | R6 dwie Teresy | W panelu narzedzia nie ma osobnego okna Teresy; rozmowa z Teresa odbywa sie wylacznie w jej wlasnym oknie. |
| 36 | `prawy-pas-jedna-formula-notatka-teresa` | Kanon i elementy wspólne | R6 dwie Teresy | W panelu Notatki nie ma osobnego okna Teresy; rozmowa z Teresa odbywa sie wylacznie w jej wlasnym oknie. |
| 37 | `results-vnext-okr-workspace` | Wyniki | R7 N-karta | Warsztat OKR jest N-karta z zakladkami po lewej, nie ekranem z menu poziomym. |
| 38 | `results-vnext-roi-full-tool` | Wyniki | R7 N-karta | Cale ROI (analiza, model, PIR) miesci sie w jednej N-karcie z zakladkami po lewej; w module Wyniki nie ma czwartego poziomu menu. |
| 39 | `results-vnext-roi-model` | Wyniki | R7 N-karta | Model ROI jest zakladka wewnatrz jednej N-karty ROI, nie osobnym ekranem z wlasnym menu poziomym. |
| 40 | `results-vnext-roi-pir-outcomes` | Wyniki | R7 N-karta | PIR jest kolejna zakladka tej samej N-karty ROI, nie osobnym ekranem. |
| 41 | `deck-artifact` | Materiały | R8 narzedzie edycji | W prezentacji widac pasek recznej edycji slajdu, a prawy panel ma kolejnosc sekcji z kanonu SPEC-A. |
| 42 | `excele-prawy-panel-standard` | Materiały | R8 narzedzie tabelaryczne | Tabela arkusza zajmuje cala centralna czesc ekranu, a nad nia stoi pasek narzedzi arkusza pozwalajacy edytowac komorki. |
| 43 | `sheet-artifact` | Materiały | R8 narzedzie tabelaryczne | Arkusz zaczyna sie od malego paska funkcji, bezposrednio pod nim stoja naglowki kolumn i siatka; zaden blok informacyjny nie zajmuje gornej jednej trzeciej ekranu. |
| 44 | `results-vnext-teresa-kpi-deviation` | Wyniki | R9 grafika przestarzala | Ekran odchylenia KPI uzywa tej samej siatki i tokenow c-* co karty N; zadnych wlasnych ramek, cieni ani kolorow spoza palety. |
| 45 | `results-vnext-teresa-okr-reflection` | Wyniki | R9 grafika przestarzala | Ekran refleksji OKR uzywa tej samej siatki i tokenow c-* co karty N (naglowek, pastylki, StandardTable) — zero komponentow sprzed kanonu. |

## Zasieg per modul — co blokuje zamkniecie

| modul | uwag | `DO_NAPRAWY` | `ZROBIONE` | `BACKLOG` | co sie stanie po przeniesieniu `BACKLOG` do backlogu |
| --- | ---: | ---: | ---: | ---: | --- |
| Czat | 15 | **2** | 1 | 12 | zostaje **2** do naprawy (R11, R15) — modul **zablokowany**. |
| Moja praca | 17 | **5** | 6 | 6 | zostaje **5** do naprawy (R18, R4, R5) — modul **zablokowany**. |
| Wywiad | 2 | **2** | 0 | 0 | zostaje **2** do naprawy (R19, R4) — modul **zablokowany**. |
| Narzędzia | 4 | **2** | 1 | 1 | zostaje **2** do naprawy (R11, R17) — modul **zablokowany**. |
| Ocena | 9 | **6** | 1 | 2 | zostaje **6** do naprawy (R12, R20, R21, R4) — modul **zablokowany**. |
| Inicjatywy | 4 | **3** | 1 | 0 | zostaje **3** do naprawy (R21, R22, R23) — modul **zablokowany**. |
| Realizacja | 5 | **1** | 4 | 0 | zostaje **1** do naprawy (R25) — modul **zablokowany**. |
| Wyniki | 10 | **9** | 0 | 1 | zostaje **9** do naprawy (R11, R26, R27, R7, R9) — modul **zablokowany**. |
| Finanse | 4 | **2** | 2 | 0 | zostaje **2** do naprawy (R10, R29) — modul **zablokowany**. |
| Materiały | 15 | **7** | 4 | 4 | zostaje **7** do naprawy (R10, R30, R31, R8) — modul **zablokowany**. |
| Audyty | 1 | **0** | 1 | 0 | **MODUL SIE DOMYKA** — zero realnych defektów w korpusie uwag. |
| Spotkania | 1 | **1** | 0 | 0 | zostaje **1** do naprawy (R34) — modul **zablokowany**. |
| Administracja | 2 | **1** | 1 | 0 | zostaje **1** do naprawy (R2) — modul **zablokowany**. |
| Agent | 2 | **0** | 0 | 2 | **MODUL SIE DOMYKA** — zero realnych defektów w korpusie uwag. |
| Kanon i elementy wspólne | 6 | **4** | 1 | 1 | zostaje **4** do naprawy (R4, R5, R6) — modul **zablokowany**. |
| Internal Tools / AI OS | 1 | **0** | 1 | 0 | **MODUL SIE DOMYKA** — zero realnych defektów w korpusie uwag. |
| Logowanie i ekrany przed zalogowaniem | 5 | **0** | 0 | 5 | **MODUL SIE DOMYKA** — zero realnych defektów w korpusie uwag. |

**Domyka sie samym przeniesieniem `BACKLOG` do backlogu (4 modulow):** Audyty, Agent, Internal Tools / AI OS, Logowanie i ekrany przed zalogowaniem.

**Wymaga realnej naprawy (13 modulow):** Czat, Moja praca, Wywiad, Narzędzia, Ocena, Inicjatywy, Realizacja, Wyniki, Finanse, Materiały, Spotkania, Administracja, Kanon i elementy wspólne.

## ★ Uwagi zgloszone wiecej niz raz — najostrzejszy sygnal w tym programie

Dwa sformulowania wlasciciela otwieraja te sekcje: **„tez juz to zglaszalem"**
(`interview-creator-shell`) i **„znowu dales mi cos bez analizy wlasnej"** (`drd-library-entry`).
Policzylem, ile razy to samo wracalo.

### A. Wlasciciel sam nazywa powtorzenie — 24 ze 103 uwag

Wyszukane po zwrotach odsylajacych do wczesniejszego zgloszenia. To nie jest interpretacja
tonu — to jego wlasne slowa o tym, ze cos juz mowil.

| ekran | cytat, ktory nazywa powtorzenie |
| --- | --- |
| `interview-creator-shell` | „tez **juz to zglaszalem**" |
| `excele-prawy-panel-standard` | „**To juz zglaszalem, tak?**" |
| `results-vnext-okr-registry` | „tutaj **zglaszalem**, ja juz to sie zapisalo" |
| `capacity-advisor-a3` | „**juz to opisywalem wiele razy**" + „**Nic tu nie zostalo zmienione** w ramach tej naprawy" |
| `exe-002-004-ui-audit` | „**Trzeci raz** dajesz mi te karte do akceptacji" |
| `assessment-presentation-view` | „**Ciagle** nie wiem dlaczego nie uzywasz mojej macierzy DRD — **nie mam juz sily serio !!**" |
| `idea-table` | „Tutaj **ciagle** zobacz Preview nie jest zgodny z wzorem" |
| `results-vnext-roi-model` | „wniosek jest dokladnie taki, jak **wczesniej opisalem**" |
| `word-intake-uselm-default` | „**nic tu nie poprawiles**" |
| `finance-baseline-workspace` | „**dalej nie mam** przycisku dodawania zalozen" |
| `plan-scenario-d1` | „Tabela niestety **dalej** nie wyglada jak kompletna tabela" |
| `excele-jeden-widok-recent` | „**To omawialismy.**" |
| `karta-tool` | „**Mielismy** usunac dwa przyklady" |
| `initiative-record` | „Inicjatywe oceniałem **juz wczesniej**, raz" |
| `idea-table-timeline-stuck` | „tak samo jak we wszystkich innych IDEach, **wraca kwestia** prawego menu" |
| `drd-library-entry` | „**Znowu** dales mi cos bez analizy wlasnej" |
| `assessment-quality-review-panel` | „**Znowu** taki wniosek" |
| `audyty-drd-report` | „**Znowu** nie wiem, gdzie to jest" |
| `admin-command-center-panel` | „**Znowu** nie mam pojecia, co to jest" |
| `prompt-registry-tab` | „**Znowuz** nie mam pojecia, gdzie to jest" |
| `zwornik-projects` | „**znowu** nie wiem, gdzie to sie uruchamia" |
| `gen-word-content-hints` | „**Znowu**, gdy mamy generator do wyboru…" |
| `gen-excel-templates-tab` | „**To samo** nie wiem, po co on jest" |
| `assessment-list` | „**To samo** rozumiem, ze to ma byc tabela na cala szerokosc" |

**24 na 103 uwagi — prawie co czwarta — wlasciciel poprzedza informacja, ze juz to mowil.**

### B. Ten sam zarzut w trzech kolejnych rejestrach — liczba nawrotow

Zestawienie trzech rejestrow: `MAPA_UWAG_WLASCICIELA.md` (klastry K, 30.08),
`UWAGI_ODBIOR_20260901.md` (rodziny R, 01.09) i ten korpus (02.09). Liczba w nawiasie
to liczba ekranow, na ktorych zarzut wystapil w danym rejestrze.

| zarzut | 30.08 | 01.09 | 02.09 (ten rejestr) | nawrotow | stan |
| --- | --- | --- | --- | :-: | --- |
| Podglad nie trzyma sie kanonu podgladu | K10 (4) | R1 (6) — **juz wtedy oznaczone „ZGLOSZONE DWA RAZY"** | 5 | **3×** | `DO_NAPRAWY` — najswiezszy cytat jest z 02.09 („ciagle… nie jest zgodny z wzorem") |
| Tabela nie na pelna szerokosc / kolumna ucieta | K1 (8) | R3 (9) | 5 | **3×** | 4 z 5 `ZROBIONE`; wraca 02.09 na `admin-command-attention-queue` |
| Arkusz i prezentacja bez narzedzi do pracy | K6 (6) | R4 (6) | 3 | **3×** | `DO_NAPRAWY` — nietkniete od 30.08 |
| Nie uzywasz mojej macierzy DRD | K5 (2) | R8 (3) — **„ESKALACJA, DECYZJA JUZ PODJETA"** | 2 | **3×** | `DO_NAPRAWY` — przy trzecim nawrocie wlasciciel pisze „nie mam juz sily serio !!" |
| ROI to jedna karta N | K7 (3) | R9 (3) | 4 | **3×** | `DO_NAPRAWY` — liczba ekranow **rosnie**, nie maleje |
| Generatory szablonow — po co one sa | K8 (4) | R10 (5) | 1 | **3×** | `BACKLOG` — decyzja produktowa nierozstrzygnieta trzeci dzien |
| Prawy panel do przepracowania | — | R2 (6) | 4 | **2×** | `DO_NAPRAWY` |
| Akcje wygladaja jak gole slowa, nie przyciski | — | R7 (5) | 3 | **2×** | `DO_NAPRAWY` |
| Stara grafika, nizszy standard niz reszta | — | R6 (7) | 3 | **2×** | `DO_NAPRAWY` |
| Jedna tabela inicjatyw, nie kilka | — | R12 (3) | 2 | **2×** | `DO_NAPRAWY` |
| Przycisk AI w gornym pasku karty | — | R13 (2) | 1 | **2×** | `DO_NAPRAWY` |
| Pasek/panel nie miesci tresci | — | R11 (4) | 2 | **2×** | `DO_NAPRAWY` |
| Nie wiem, gdzie to jest / co to jest | K9 (4) | R5 (10) | 9 | **3×** | **`ZROBIONE`** — patrz nizej, to jedyny nawrot z czysta przyczyna |

### C. Dlaczego zarzuty wracaja — jedna zmierzona przyczyna, nie domysl

Rodzina **„nie wiem, gdzie to jest"** (9 uwag w tym korpusie) ma date rozstrzygajaca.
Wszystkie 9 uwag powstalo **30.08 miedzy 09:52 a 11:45**. Mechanizm, ktory je zdejmuje —
zdanie „GDZIE ten ekran jest w aplikacji" na karcie odbioru — wszedl commitem `84ced6ce7a`
o **13:21**, a pole `gdzie` dla wszystkich ekranow commitem `76996ee069` o **15:27** tego
samego dnia. Dzis wypelnione jest dla **319 z 319** ekranow.

**Naprawa byla gotowa 1,5–4 godziny po zgloszeniu i wlasciciel nigdy nie zobaczyl, ze jest gotowa.**
Ten sam wzorzec MAPA_UWAG opisala juz przy klastrze K1 (szerokosc tabel: naprawa o 14:15,
uwagi z 10:01–11:44, „nikt mu nie pokazal nowych zrzutow, wiec dla niego sprawa wyglada na otwarta").

To jest przyczyna nawrotow numer jeden i nie jest to przyczyna kodowa: **naprawiamy szybciej,
niz pokazujemy**. Do tego dochodzi drugi mechanizm, zmierzony w tym dyzurze — 52 uwagi
zostaly przelaczone z `poprawka`/`nie` na `ok` z niezmienionym tekstem zarzutu, wiec zaden
licznik nie pokazywal juz, ze cos jest otwarte.

**Piec** pozycji `ZROBIONE` w tym rejestrze naprawiono **po** ostatnim kliknieciu wlasciciela,
wiec on ich do dzis nie widzial: `plan-scenario-d1` i `prezentacje-template-states`
(zrzuty `evidence/grafika/174-domkniecie/` z 01.09 11:28, przy kliknieciach o 10:00 i 10:04)
oraz `notatnik-osierocone-graf`, `excele-edytowalna-siatka` i `aios-connectors`
(zrzuty `evidence/grafika/171-pojedyncze/` z 01.09 10:36, przy kliknieciach o 10:01–10:06).

## Co z tego wynika dla planu

1. **45 pozycji `DO_NAPRAWY`** ma gotowe warunki odbioru — to jest tresc bramki G17 dla 13 modulow.
2. **Naprawa idzie rodzinami, nie ekranami.** Piec rodzin zdejmuje 21 z 45 pozycji:
   podglad (5), szerokosc/uklad tabeli (5), N-karta ROI (4), prawy panel (4), przyciski-slowa (3).
3. **Cztery moduly domykaja sie bez linijki kodu** — Audyty, Agent, Internal Tools / AI OS,
   Logowanie: wystarczy przeniesc ich `BACKLOG` do backlogu.
4. **Przed kazda kolejna partia odbioru** trzeba pokazac wlascicielowi zrzuty PO dla pozycji
   `ZROBIONE`, ktorych nie widzial — inaczej te same zarzuty wroca po raz czwarty.
5. **Bezpiecznik do wprowadzenia:** przelaczenie decyzji z `poprawka`/`nie` na `ok`
   bez zmiany tresci uwagi powinno byc blokowane albo oznaczane — dzis znika bez sladu
   i to wlasnie ono ukrylo 52 z 103 pozycji tego korpusu.

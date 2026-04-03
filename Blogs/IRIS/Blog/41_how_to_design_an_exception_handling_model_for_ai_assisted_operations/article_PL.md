# Jak zaprojektowac model obslugi wyjatkow dla operacji wspieranych przez AI

Target persona: Architekt operacji / Lider inzynierii zakladowej / Wlasciciel systemow jakosci  
Funnel stage: Consideration  
Core problem: asysta AI zwieksza wolumen zdarzen, ale zaklady nadal routuja wyjatki przez nieformalne czaty, wiec odpowiedzialnosc za reakcje i petle domkniecia pozostaja niejasne  
Main promise: zwarty model wyjatkow ze sciezkami typu progi, akceptacje i pola audytu, ktore nadzor moze prowadzic pod obciazeniem

Zaprojektuj obsluge wyjatkow dla operacji wspieranych przez AI klasyfikujac kazdy wynik asysty do jednej z czterech sciezek: auto-zadanie w polityce, tylko doradztwo z przejeciem przez czlowieka, eskalacja z obowiazkowym wlascicielem i SLA, lub twardy stop do czasu akceptacji. Dla kazdej sciezki okresl wyzwalacze, kto moze nadpisac, jakie pola rekordu sa obowiazkowe i jak dowodzisz domkniecia. Opublikuj model obok map workflow, zeby zmiany nie improwizowaly. Model bez nazwanych wlascicieli i ramek czasowych to tylko diagram. Wspierane operacje nie padaja, bo model jest zly pierwszego dnia. Padaja, bo wyjatki staja sie drugim cieniem procesu.

## Dlaczego wyjatki rosna, gdy asysta startuje

Asysta wydobywa przypadki brzegowe, ktore ludzie wczesniej pochlaniali cicho.

Zobaczysz: wiecej kandydatow na zadania z niepelnym kontekstem; wiecej sygnalow blisko progow, ktore roznia sie miedzy funkcjami; wiecej tras "prawie auto", ktore potrzebuja stempla czlowieka.

Jesli nie zaprojektujesz warstwy wyjatkow, hala zaprojektuje ja telefonami.

## Framework: cztery sciezki wyjatkow (jedna na typ zdarzenia)

| Sciezka | Kiedy | Wymagany rekord | Dowod domkniecia |
|---|---|---|---|
| Auto-zadanie | w publikowanych progach i polityce | ID zadania, wersja reguly, znacznik czasu | zamkniete zlecenie lub zweryfikowany stan |
| Tylko doradztwo | pozyteczny sygnal, czlowiek musi przejac | ID sugestii, wlasciciel przejecia, powod odrzucenia | jawne odrzucenie lub konwersja na zadanie |
| Eskalacja | ryzyko SLA, bezpieczenstwo, blokada jakosci, konflikt miedzy funkcjami | poziom eskalacji, wlasciciel, termin | notatka rozwiazania powiazana ze zrodlem |
| Twardy stop | regulacja, blokada klienta lub niedojrzale dane | rola akceptacji, link dowodu, kryteria zwolnienia | podpisane zwolnienie lub zmiana reguly z wersja |

Jesli w praktyce pojawia sie piata sciezka ("po prostu zapytaj inzyniera"), model jest niepelny.

## Checklist: minimalne definicje przed startem

1. taksonomia wyjatkow: falszywy alarm, brak danych, konflikt polityki, bezpieczenstwo, klient, dostawca  
2. macierz odpowiedzialnosci: kto pierwszy reaguje na typ na kazdej zmianie  
3. drabina eskalacji: kroki czasowe, nie oparte na osobowosci  
4. reguly akceptacji: ktora sciezka wymaga ktorej roli, lacznie z zastepstwami  
5. pola przekazania: co nastepna zmiana musi widziec w systemie, nie na papierze  
6. hak rollbacku: jak wstrzymac wspierany routing bez utraty sladu audytu  
7. petla po incydencie: kiedy wyjatki wymuszaja zmiane progu lub szkolenia

## Porownanie: kultura zgloszen kontra kultura domkniecia

| Sygnal | Kultura zgloszen | Kultura domkniecia |
|---|---|---|
| intencja | rejestrowac aktywnosc | domknac stan operacyjny |
| metryka | glebokosc backlogu | czas-do-wlasciciela i czas-do-domkniecia |
| sukces | "przypisalismy" | "linia jest bezpieczna, posortowana i udokumentowana" |

Asysta AI wzmacnia kulture zgloszen, jesli nie zwiazujesz zadan z wynikami operacyjnymi.

## Reality check: modele wyjatkow zwykle padaja, gdy hala wynajduje piata sciezke

Wiekszosc zespolow potrafi opisac oficjalne sciezki na warsztacie.

Prawdziwy test przychodzi pozniej, gdy zaklad zaczyna uzywac nieoficjalnych obejsc, takich jak:

- "najpierw zadzwon do utrzymania, a zaloguj pozniej"
- "zostaw to w advise do czasu dziennej zmiany"
- "zapytaj inzynierie nieformalnie, bo nikt nie jest wlascicielem tej sciezki"

W momencie, gdy ukryta piata sciezka staje sie norma, model nie kontroluje juz wspieranego wolumenu. Kontroluje go hala.

## Sekwencja krokow: wdrozenie modelu bez dramatu

Tryb cienia: taguj potencjalne wyjatki bez auto-routingu; przeglad tygodniowy: kategoryzuj top 20 motywow i przypisz wlascicieli; publikuj sciezki v1 dla tylko trzech workflow; mierz: mediana czasu-do-wlasciciela, powtarzajace eskalacje, powody override; wersjonuj ksiege regol, gdy progi sie przesuwaja.

## Kiedy ten model dziala

Nadzor juz respektuje SLA dla pracy recznej; mozesz utrzymac jeden changelog progow i trybow; jakosc i utrzymanie zgadzaja sie co do regul blokady.

## Kiedy ten model nie dziala

ERP lub MES pozostaje jedynym systemem prawdy, a warstwy typu IRIS sa opcjonalne; inzynieria edytuje reguly bez akceptacji operacji; nocna zmiana nie ma zastepcow akceptujacych.

## Dlaczego IRIS pasuje do warstwy wyjatkow

DBR77 IRIS to AI-native plant operating system z ujednolicona warstwa wykonania dla produkcji, magazynu, jakosci, utrzymania i zlecania.

Gdy asysta, zadania, akceptacje i wyjatki dziela jeden rekord wykonania, przestajesz odtwarzac historie po kazdym incydencie.

## Podsumowanie

Projektowanie wyjatkow to projektowanie odpowiedzialnosci.

Jesli kazda sciezka nazywa respondenta, ramke czasu i pole domkniecia, zaklad zniesie wyzszy wolumen asysty bez utraty kontroli.

---

*Chcesz zobaczyć, jak to działa w praktyce? [Uruchom interaktywne demo](https://dbr77.com/iris) lub [Rozpocznij 14-dniowy trial](https://dbr77.com/demo).*

# Kiedy AI powinna obserwowac, doradzac lub dzialac w zakladzie

Target persona: Dyrektor operacji / Architekt IT-OT / Lider jakosci i BHP  
Funnel stage: Decision  
Core problem: zaklady przelaczaja sie miedzy "AI nic nie robi" a "AI robi za duzo", bo nigdy nie publikuja trybow operacyjnych powiazanych z progami i odpowiedzialnoscia  
Main promise: trojtrybowa ramka (obserwuj, doradzaj, dzialaj) zmapowana na sygnaly, cofalnosc i sciezki akceptacji, oddzielnie od ogolnych debat o autonomii

AI powinna obserwowac, gdy potrzebujesz spojnego wykrywania i logowania bez zmiany stanu workflow. Powinna doradzac, gdy czlowiek musi potwierdzic, zanim zadania, routing lub wiadomosci wyjda ze szkicu. Powinna dzialac tylko w waskich, opublikowanych regulach ze sladem audytu, sciezkami wycofania i jawnymi wlascicielami wyjatkow. To nie filozofia. To projekt progow plus dopasowanie odpowiedzialnosci. To uzupelnia klasy ryzyka dla praw decyzji. Odpowiada na tryb wdrozenia, nie tylko na to, kto podpisuje.

## Tryb 1: obserwuj

**Definicja** AI monitoruje strumienie, taguje anomalie i zapisuje zdarzenia strukturalnie. Nie tworzy zobowiazan dla innych bez czlowieka lub reguly.

**Uzyj, gdy** - definicje sie jeszcze stabilizuja - potrzebujesz bazy dla falszywych alarmow - zaufanie kulturowe jest niskie, ale pomiar pilny

**Dowod, ze robisz dobrze** - katalog zdarzen jest przegladany co tydzien - nadzor moze ignorowac alarmy bez psucia integralnosci metryk - halas spada wraz z dyscyplina kodow przyczyn

## Tryb 2: doradzaj

**Definicja** AI proponuje ranking dzialan, szuje zadania i sugeruje routing. Nic nie jest wiazace, dopoki czlowiek nie potwierdzi lub druga bramka regul nie przejdzie.

**Uzyj, gdy** - kompromisy miedzyfunkcyjne wymagaja osadu - podobne przypadki z przeszlosci pomagaja, ale nie sa prawem - chcesz predkosci bez cichych zobowiazan

**Dowod, ze robisz dobrze** - mierzysz medianowy czas od sugestii do akceptacji lub odrzucenia - override sa kategoryzowane, nie traktowane jako wstydliwy szum - szkice skracaja pisanie bez pomijania wymaganych pol

## Tryb 3: dzialaj

**Definicja** System wykonuje dozwolone operacje automatycznie: kolejkuje prace, powiadamia role, eskaluje po timerach lub stosuje nieniszczacy routing w obrebie limitow.

**Uzyj, gdy** - reguly sa nudne, czeste i dobrze ograniczone - cofalnosc jest szybka i tania - tryby awarii sa zamkniete i widoczne

**Dowod, ze robisz dobrze** - kazda auto-akcja ma cytowana wersje reguly - kolejki wyjatkow maja wlascicieli i SLA - sa wylaczniki pauzy na okna serwisowe i incydenty

## Macierz decyzji: startowy tryb

| Sytuacja | Zacznij od | Wyzszy tryb, gdy | |---|---|---| | nowa linia lub nowy strumien danych | obserwuj | stabilne definicje i zmierzony szum | | spory miedzy zespolami o priorytet | doradzaj | wysoka akceptacja, wyjasnialne override | | powtarzalny routing biurowy przy czystych regulach | dzialaj | audyty czyste przez dwa cykle przegladowe

## Przekazania miedzy trybami

Zaklady padaja, gdy skacza z obserwacji do dzialania, bo demo dostawcy wygladalo dobrze.

Zdrowa sekwencja: obserwuj, az definicje trzymaja sie przez zmiany; doradzaj, az wzorce akceptacji i override sa zrozumiale; dzialaj tylko na najwezszym plasterku z limitami.

## Reality check: dryf trybu to zwykle problem operacyjny, nie techniczny

Wiele zespolow mowi, ze nadal jest w trybie doradzaj. Ale w codziennej pracy zaklad zaczyna juz traktowac sugestie jako wiazace, bo:

- zespoly sa przeciazone i przestaja uwaznie recenzowac
- kolejki wyjatkow nie maja widocznego wlasciciela
- nikt nie zauwaza, ze szkicowany routing zaczyna zachowywac sie jak auto-routing

Dlatego dyscyplina trybow musi byc opublikowana w regulach workflow, a nie zostawiona dobrym intencjom.

## Dlaczego IRIS wspiera dyscypline trybow

DBR77 IRIS to AI-native plant operating system z ujednolicona warstwa wykonania dla produkcji, magazynu, jakosci, utrzymania i zlecania.

Tryby maja znaczenie, gdy asysta laczy sie z realnymi zadaniami i akceptacjami, a nie z wiszacymi sugestiami w osobnym oknie.

## Podsumowanie

Obserwuj mierzy, doradzaj potwierdza, dzialaj w ramach regul. Opublikuj tryb per workflow, nie per komunikat prasowy.

---

*Chcesz zobaczyć, jak to działa w praktyce? [Rozpocznij 14-dniowy trial](https://dbr77.com/iris) lub [Uruchom interaktywne demo](https://dbr77.com/demo).*

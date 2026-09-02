---
doc_id: funkcje-odbior-230-232-fix
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Odbiór FIX-230 i FIX-232 — obie oceny C/B podniesione, scalone `795fed6625`

## FIX-230 — detektor przepełnienia slajdu

Wejście: ocena **C**. Audyt wykazał **stuprocentowy fałszywy alarm** — ostrzeżenie
zapalało się na każdym poprawnym slajdzie, więc było bezużyteczne.

Trzy przyczyny, wszystkie usunięte:
1. **Metadane liczone jako tekst.** Detektor chodził po całym bloku, więc
   identyfikatory, adresy i kolory podbijały licznik znaków. Teraz czyta wyłącznie
   treść, a w niej pomija klucze pasujące do wzorca „to nie jest tekst do pokazania" —
   **tego samego wzorca, którego używa już oczyszczanie tekstu**, żeby dwa miejsca
   nie mogły się rozjechać.
2. **Zwarcie warunku.** `a || b` zamiast `a + b`: gdy pierwsza część miała jakąkolwiek
   długość, druga nigdy nie była liczona — cichy fałszywy negatyw.
3. **Slajdy wyłączone** były audytowane razem z włączonymi.

**Bramka fałszywego alarmu — para, nie pojedyncze twierdzenie:**
- **cisza na poprawnym**: 5 slajdów w realnym kształcie + 1 wyłączony przeciążony ⇒ **zero ostrzeżeń**
- **alarm na przeciążonym**: ten sam zestaw + 1 włączony przeciążony ⇒ **dokładnie jedno ostrzeżenie**

Zweryfikowane mutacyjnie **w obie strony**: przywrócenie starego kodu wywraca oba nowe
testy na czerwono, **zostawiając stare dwa zielone** — czyli dokładnie ta ślepa plama,
którą wskazał audyt. To jest wzorcowy dowód: pokazuje nie tylko, że nowy test działa,
ale że **stary zestaw nie mógł tego złapać**.

**Rozstrzygnięcie duplikatu — nie przepinamy.** Dwa audyty czytają różne kształty
w różnych momentach: jeden ogląda zarys **przed** generacją (gołe napisy), drugi
ogląda **zapisaną, edytowaną przez użytkownika** talię w chwili eksportu. Przepięcie
wymagałoby warstwy tłumaczącej, która robiłaby dokładnie to samo, co naprawa nr 1 —
przeniosłoby problem, nie usunęło. Współdzielenie zostało tam, gdzie było realne.

**Rozprzężenie flag.** Jedna flaga sterowała dwiema niepowiązanymi rzeczami:
ostrzeżeniem i zmniejszaniem czcionki. Rozdzielone na dwie niezależne, obie
domyślnie wyłączone, żadna wartość domyślna nie zmieniona.

**Uczciwość komunikatu.** Pewność detektora była wyliczana i **wyrzucana** — ekran
mówił tak samo stanowczo przy domysłach, jak przy pewności. Teraz „nie mieści się"
kontra „może się nie zmieścić". Eksport do PDF **przestał dostawać ostrzeżenie
policzone dla PowerPointa** — inny silnik, budżety nic o nim nie mówią.

**Nazwane, nie zmienione:** progi znaków to **cel projektowy**, nie zmierzone
załamanie (realne jest wyższe). Komentarz w kodzie mówi to wprost, zamiast udawać pomiar.

## FIX-232 — agent talii

Wejście: ocena **B**, trzy punkty blokujące.

**A1 — wyścig.** Dwa równoległe polecenia mogły nadpisać się nawzajem.
Wyjścia bramki: kod produkcyjny ⇒ `[200, 409]`, wersja 1→2. Po usunięciu
zabezpieczenia ⇒ `[200, 200]`, **zgubiona aktualizacja**. Mutacja celuje
w **zabezpieczenie**, nie w mechanizm — zgodnie z regułą programu.

**A2 — cytowania fabrykowane.** Operacja „dodaj źródło" przyjmowała **dowolny adres
wklejony w czacie** i zapisywała go jako cytowanie. To jest dokładnie to, czym
Consultify **nie ma być** — generatorem bez powiązania ze źródłami.
Teraz adres musi trafić na realny dokument wiedzy w tej organizacji.

**Para dowodowa, obowiązkowa:**
- adres z czatu ⇒ **odrzucony**, lista cytowań w bazie zostaje **pusta**
- adres realnego dokumentu ⇒ **przyjęty**, a cytowanie ma **identyfikator i tytuł
  z bazy**, nie z tekstu polecenia

Drugi człon jest tu istotniejszy niż pierwszy: **pięć razy w tym programie
zabezpieczenie było zielone dlatego, że funkcja nie działała nikomu.**

**A3 — uczciwość makiety.** Ekran dowodowy udawał więcej, niż istnieje. Nagłówek
mówi teraz, że to **propozycja**; wynik liczony **tą samą logiką co produkcja**;
dwa fikcyjne „następne ruchy" wyłączone; cała karta oznaczona jako **makieta ekranu
docelowego, nie dowód działającego komponentu** — bo odpowiednika w kodzie aplikacji
nie ma. Jasność: 246,9 kontra 25,8.

## Odnotowane, świadomie NIE naprawione (poza licencją)
Nazwy trzech operacji agenta **kłamią o tym, co robią**: „przeredaguj" wkleja tekst
po dwukropku i nic nie redaguje; „podziel slajd" tnie w **połowie liczby znaków,
w środku wyrazu**, a nowy identyfikator bierze ze **znacznika czasu** (kolizje przy
dwóch podziałach w tej samej milisekundzie); „zmień archetyp" wpisuje **niewalidowany**
układ. To jest osobny dyżur, nie poprawka.

**Szósta niezależna kopia mechanizmu propozycji AI** w produkcie — zero wspólnego
kodu z mechanizmem z dyżuru 207. Do rozstrzygnięcia jako dług architektoniczny.

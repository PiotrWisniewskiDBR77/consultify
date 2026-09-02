---
doc_id: funkcje-gamma-g1-napiecie
status: canonical
owner: piotr
truth_type: plan
established: 2026-09-01
---

# G-1: pomiar Gammy kontra świadectwo właściciela — jedno napięcie do rozstrzygnięcia

Dwa źródła, oba wiarygodne, jedna rozbieżność. **Nie uśredniam ich — nazywam.**

## Źródło A: właściciel (użytkownik Gammy, 1.09)
Trzy elementy, „przez które ludzie szaleją, a konkurencja tego nie ma":
1. **Generowane obrazy** w stylu wybieranym przez użytkownika (**~6 typów**: fotografia,
   rysunek i dalsze); obraz pasuje do treści **tym, co pokazuje, ORAZ kolorem**.
2. **Układ graficzny** — kolor i kształty. Zastrzeżenie właściciela: *„formatów układów
   nie mają dużo i często się powtarzają, ale pierwsze wrażenie jest super"*.
3. **Treść generowana ZANIM ruszy produkcja slajdów** — dlatego prezentacja *„wie, co
   opowiada"*. Bonus: **agent, któremu mówisz, co zmienić, i się zmienia**.

## Źródło B: pomiar (29 slajdów, 3 motywy, odczyt z DOM)
- **14 z 29 slajdów (48%) nie ma żadnego obrazu rastrowego** — i wygląda tak samo
  „gammowo". Są to dokładnie slajdy rdzeniowe decku doradczego: rekomendacje, liczby,
  wykresy, kroki.
- **Każdy zmierzony obraz to abstrakcyjna tekstura**, nie fotografia rzeczy. Obraz
  pełni rolę **materiału**, nie treści.

## Rozstrzygnięcie CTO — obie rzeczy są prawdziwe i nie kolidują
Pomiar objął **szablony**, właściciel mówi o **deckach generowanych z promptu**. To
dwa różne tryby tego samego produktu. Wniosek dla nas:

> **Obraz robi PIERWSZE WRAŻENIE (okładka, przekładki), a nie niesie treści.
> Rdzeń decku doradczego broni się bez ani jednego zdjęcia.**

To jest dobra wiadomość, bo znosi zależność od modelu fotograficznego na 48%
powierzchni — a jednocześnie potwierdza, że **na okładce obraz musi być**, i tam
właściciel ma rację, że to element numer jeden.

**Kolejność budowy z tego wynikająca:** najpierw **treść przed produkcją** (element 3
właściciela — i jedyny, który już częściowo mamy), potem **kolor i kształt** na
rdzeniu, potem **obrazy na okładce i przekładkach**, na końcu **agent redagujący**
(mamy pod niego pętlę narzędziową i propozycje zapisu, zamknięte 31.08).

## Piętnaście cech mierzalnych — pełna specyfikacja
`docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md`. Najmocniejsze pomiary:
- **interlinia nagłówka = 1,00 w 100% przypadków**, wszystkie trzy motywy, bez wyjątku;
- **dokładnie 2 kroje**, 3/3 motywy; **1 powierzchnia + 2 stopnie tuszu + 1 akcent**,
  akcent ≤8% powierzchni;
- **odwrócona waga**: duże jest lekkie (400-500), małe jest mocne (600-700);
- **zero cieni** — `box-shadow: none` na wszystkich kartach;
- **zero list zagnieżdżonych na 29 slajdach**;
- gęstość **60-110 słów** na slajd, okładka ≤14;
- **7 archetypów wystarczy** — zgodne ze świadectwem właściciela, że układów jest mało.

## Dwie decyzje dla właściciela PRZED prototypem
1. **Krój to największe ryzyko.** Cztery z piętnastu cech to typografia, a osadzenia
   kroju w PPTX **nie da się zagwarantować** (zmierzone: `pptxgenjs` tego nie oferuje).
   Podmiana kroju u odbiorcy **zmienia złamania wierszy**. Rekomendacja analityka:
   **PDF jako format dystrybucji, PPTX dla edytujących.**
2. **Nie da się mieć naraz skali Gammy i czytelności z sali.** Gamma pisze treść
   **10-13,5 pt** — pod laptop z 50 cm, nie pod rzutnik. Podbicie do 15 pt i tytułu do
   34 pt kosztuje **limit ≤110 słów na slajd**. Trzeba to powiedzieć, **zanim
   właściciel zobaczy prototyp i zapyta, gdzie reszta treści**.

## Uczciwość źródła
Analityk sam wypisał, czego nie zmierzył: Pitch obejrzany powierzchownie, Tome
i Beautiful.ai wcale; karta Gammy **nie jest 16:9** (zmierzone proporcje 1,95 i 1,48),
więc przeliczenia na format slajdu są normalizowane i oznaczone; **najważniejsza
reguła — centrowanie bloku treści w pionie — zweryfikowana na 3 z 29 slajdów**
i zasługuje na potwierdzenie przed budową.

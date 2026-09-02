---
doc_id: funkcje-znalezisko-bramki-bez-testu
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Trzy bramki dostępu, zero testów regresyjnych. Dziś poprawne, jutro mogą się cicho rozjechać

Znalezione przy odbiorze dyżurów 236/237/238. **To nie jest defekt — to brak bezpiecznika**,
i dlatego jest groźniejsze niż defekt: defekt widać, brak bezpiecznika nie.

## Trzy niezależne mechanizmy decydujące, kto co widzi

| Mechanizm | Co robi | Test regresyjny |
| --- | --- | --- |
| Filtr sekcji Ustawień | **Usuwa** 33 z 37 sekcji dla zwykłego użytkownika | **JEST** (od 1.09) |
| Pozycja Spotkań w menu | **Dekoruje kłódką** (nie usuwa) | **JEST** (od 1.09) |
| Przekierowanie z niedozwolonej trasy | Przenosi **po cichu**, bez komunikatu | **JEST** (od 1.09) |

Sprawdzone przeszukaniem katalogów testowych — **zero trafień**.

## Dlaczego to jest ryzyko tej samej klasy, o której mówi cały program
Reguła programu brzmi: *zabezpieczenie bez testu, który czerwienieje po jego usunięciu,
jest nieudowodnione.* Tutaj zabezpieczenia **są i działają** — audytor to potwierdził
własnym pomiarem. Ale **nic nie pilnuje, żeby dalej działały.**

Ktoś usunie filtr przy zupełnie innej zmianie, wszystkie testy pozostaną zielone,
i **zwykły użytkownik zobaczy rozliczenia firmy.** Nie dowiemy się o tym z kodu —
dowiemy się od klienta.

**Audytor napisał taką sondę na czas odbioru, udowodnił nią mutację i ją skasował.**
Usunięcie było zgodne z zasadami (odbiór niczego nie commituje), ale **wiedza zginęła
razem z plikiem**. To trzeba odwrócić.

## Trzy niespójności warte nazwania, obok braku testów
1. **Ustawienia usuwają, Spotkania dekorują.** Dwa różne zachowania dla tej samej sprawy
   („nie masz dostępu") w jednym produkcie. Użytkownik widzi raz kłódkę, raz nic.
2. **Menu odmawia, adres wpuszcza** (Spotkania). Pozycja w menu jest zamknięta, ale wpisanie
   adresu wprost przechodzi — bo trasa jest na liście dozwolonych. Naprawa z sierpnia
   otworzyła **dwie z trzech bramek** tej samej funkcji.
3. **Przekierowanie jest ciche** — w kodzie jest wyłącznie wpis do dziennika, zero komunikatu
   dla człowieka. Z perspektywy użytkownika produkt **wygląda na zepsuty**, a nie na chroniony.

## Ograniczenie dowodu w dyżurze 237 — nazwane, nie ukryte
Zrzut mający pokazać, że zwykły użytkownik wchodzi na Spotkania, jest **bitowo identyczny**
ze zrzutem zwykłej listy. **To nie jest oszustwo** — obie ścieżki renderują ten sam ekran,
a zaplecze jest podstawione i **nie rozróżnia roli**. Ale wniosek trzeba zapisać uczciwie:
ten zrzut dowodzi **wyłącznie**, że router przednie nie blokuje. **O uprawnieniach
po stronie zaplecza nie mówi nic.**

## Zadania
1. **Wprowadzić na stałe testy regresyjne dla wszystkich trzech bramek** — sonda audytora
   jest gotowym wzorcem, wystarczy ją odtworzyć i utrwalić.
2. **Ujednolicić zachowanie** przy braku dostępu — decyzja produktowa właściciela:
   kłódka czy zniknięcie, i **zawsze komunikat zamiast ciszy**.
3. **Domknąć trzecią bramkę Spotkań** albo świadomie ją zostawić i to zapisać.
4. Poprawić opis dowodu w karcie modułu Spotkań zgodnie z ograniczeniem powyżej.


---

# DOMKNIĘTE 1.09 — trzy testy założone, każdy udowodniony mutacyjnie

Wszystkie trzy bramki mają teraz test, który **czerwienieje po usunięciu zabezpieczenia**.
Nie „test istnieje" — **test, który udowodniono, psując kod produkcyjny i przywracając go.**

| Bramka | Mutacja | Dosłowny wynik czerwony |
| --- | --- | --- |
| Filtr Ustawień | usunięto filtrowanie pozycji | `expected [...] to have a length of 4 but got 37` |
| Menu Spotkań | dodano Spotkania do listy widocznych | `Expected the element to have attribute: aria-disabled="true" / Received: null` |
| Przekierowanie | usunięto warunek roli | `expected "vi.fn()" to not be called at all, but actually been called 1 times` |

**Para dowodowa spełniona w każdej z trzech** — „obcy nie widzi" **oraz** „właściciel widzi".
Przy bramce przekierowania mutacja wywróciła właśnie **drugi** człon: po jej wprowadzeniu
**administrator też był przekierowywany**. Dokładnie ten scenariusz, przed którym się
zabezpieczamy — funkcja przestaje działać **wszystkim**, i bez drugiego członu wyglądałoby
to na sukces.

## ★ Dwie korekty do treści powyżej — obie od wykonawcy, obie na plus
1. **Numery linii przekierowania: `330-344`, nie `329-341`.** Poprzedni pomiar podał
   sąsiedztwo, nie blok.
2. **Twierdzenie „w bloku jest wyłącznie wpis do dziennika" było BŁĘDNE.**
   W tym bloku **nie ma żadnego wpisu do dziennika** — jest wyłącznie przekierowanie.
   Wpis do dziennika i powiadomienie o odmowie dostępu ma **sąsiedni** blok, czyli inny.

   **Czyli to przekierowanie jest jeszcze bardziej ciche, niż zapisaliśmy: nie zostawia
   śladu ani dla użytkownika, ani dla nas.** Gdyby użytkownik zgłosił „klikam i nic się
   nie dzieje", **nie znaleźlibyśmy tego w dzienniku.**

Obie korekty pochodzą z **własnego odczytu wykonawcy**, nie z przepisania zlecenia.

# Kiedy IoT powinno wywolywac eskalacje do supervisora, a kiedy nie

Docelowa persona: Supervisor produkcji / Kierownik obszaru / Lider operacji zakladu  
Etap lejka: Consideration  

Glowny problem: supervisory sa ciagniete w kazdy zolty blip, wiec eskalacja staje sie szumem, a hala przestaje traktowac alarmy powaznie Glowna obietnica: polityka eskalacji do supervisora: ktore warunki z maszyna przerywaja leadership, ktore zostaja na linii, jak override zmienia regule Supervisor nie powinien byc ludzkim routerem alarmow.

Jesli IoT wysyla im ten sam strumien co operatorom, dodales tylko druga skrzynke.

Eskalacja to decyzja governance, a nie domyslne ustawienie w stosie czujnikow.

## Bezposrednia odpowiedz

Wywoluj **eskalacje do supervisora**, gdy warunek zmienia, kto moze zdecydowac o kolejnym bezpiecznym kroku, albo gdy linia wyczerpala zapisany playbook w zdefiniowanym oknie czasu.

**Nie** wywoluj eskalacji do supervisora dla sygnalow uczenia, pojedynczych skokow bez potwierdzenia albo warunkow, ktore zmiana moze zamknac istniejaca sciezka zlecenia. Widocznosc moze zostac na ekranie. Eskalacja powinna byc na tyle rzadka, by pozostac wiarygodna.

## Oddziel powiadomienie operatora od przerwania supervisora

Zaprojektuj dwa kanaly: **Kanal operatora**: szybki kontekst, lokalna weryfikacja, standardowe reakcje; **Kanal supervisora**: zmiana wladzy, ryzyko miedzy zmianami, ekspozycja klienta albo safety, konflikt zasobow.

Jesli oba kanaly dostaja te same zdarzenia, supervisory naucza sie ignorowac IoT.

## Macierz eskalacji

| Warunek | Eskaluj do supervisora gdy |
|---|---|
| Nieplanowany stop | nieznana przyczyna po uzgodnionej sekwencji checkow albo powtorzony wzor w tym samym tygodniu |
| Sygnal degradacji | trend przekracza limit zakladu AND backlog maintenance blokuje reakcje |
| Proxy jakosci | ryzyko scrapu przekracza prog uzgodniony z quality lead |
| Override | override blisko wygasniecia bez planu zamkniecia |
| Safety lub compliance | jakiekolwiek naruszenie standardu niepodlegajacego negocjacji |

| Warunek | Zwykle nie eskaluj do supervisora |
|---|---|
| Pierwsze uderzenie progu na nowym baseline | loguj, weryfikuj, stroj |
| Pojedynczy skok czujnika | najpierw potwierdz |
| Mala wariancja cyklu | monitoruj do wzorca |
| Alarm demo vendora | wylacz albo zmien klase |

## Sekwencja krokow: zdefiniuj kontrakt eskalacji

Wypisz piec scenariuszy stop, ktore zaklad juz traktuje powaznie bez IoT; Mapuj kazdy na: tylko operator, zlecenie maintenance, przerwanie supervisora; Dodaj time boxy: jak dlugo linia posiada problem przed eskalacja; Opublikuj reguly override: kto moze przedluzyc time boxy i na jak dlugo; Przegladaj miesiecznie z probkami jakosci sygnalu, nie tylko licznikami alarmow.

## Checklista: utrzymuj eskalacje wiarygodnymi

- [ ] alerty supervisora sa podzbiorem alertow operatora, nie duplikatem feedu
- [ ] kazdy alert supervisora ma nazwana nastepna akcje wladzy
- [ ] powody eskalacji sa kodowane pod przeglad planowania, nie tylko heatmapy
- [ ] falszywe eskalacje dostaja RCA jak przeglady near-miss safety
- [ ] odwolania do standardow: safety, jakosc, dostawa, regulacje

## Kiedy widocznosc w czasie rzeczywistym nie powinna zmieniac sciezki eskalacji

Widocznosc w czasie rzeczywistym pomaga zobaczyc wczesniej. Nie podnosi automatycznie ciezaru.

Jesli sama widocznosc eskaluje, przeciazysz supervisory w tygodniach normalnej wariancji.

## Co to znaczy dla DBR77 IoT

DBR77 IoT to **widocznosc maszyny w czasie rzeczywistym** z **wsparciem decyzji edge-first**, a nie dashboard pingujacy wszystkich rowno.

Lacznosc retrofit-ready pozwala zestawic reguly eskalacji na aktywach brownfield bez pelnego rewrite sterowania.

Szybki pilot testuje obciazenie supervisora na jednym obszarze przed standaryzacja.

## Bottom line

Eskalacja do supervisora powinna byc **rzadka, zakodowana i zwiazana z wladza**.

IoT zyskuje zaufanie, gdy hala widzi, ze leadership przerywa tylko tam, gdzie naprawde zmienia sie kolejna bezpieczna decyzja.

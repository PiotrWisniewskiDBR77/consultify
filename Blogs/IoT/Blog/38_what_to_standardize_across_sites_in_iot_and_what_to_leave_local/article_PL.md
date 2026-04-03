# Co standaryzowac miedzy zakladami w IoT, a co zostawic lokalnie

Docelowa persona: Dyrektor grupy produkcyjnej / Lider digital operations / Enterprise architect  
Etap lejka: Decision  

Glowny problem: zespoly centralne wciskaja jednolite dashboardy, podczas gdy zaklady potrzebuja uczciwej wariancji aktywow, staffing i sciezek integracji, wiec standardy wydaja sie pozorne albo blokujace Glowna obietnica: czysty podzial: niepodlegajace negocjacji standardy grupy dla security, dowodu i logiki eskalacji plus jawna lokalna wolnosc dla map czujnikow, planow pracy i rytmu szkolen Jednolite piksele to nie to samo co jednolite safety. Standardy IoT grupy powinny chronic zaufanie i porownywalnosc. Lokalna praca IoT powinna chronic wykonalnosc na liniach brownfield.

## Bezposrednia odpowiedz

**Standaryzuj miedzy zakladami:**

Tozsamosc, dostep, patchowanie i minimum segmentacji sieci; kategorie dowodu dla miesiecznych przegladow i narracji executive; filozofie eskalacji: widocznosc versus przerwanie, reguly supervisora; retencje danych i oczekiwania audytu powiazane ze standardami. **Zostaw lokalnie:**

Dokladne umiejscowienie czujnikow i mapy klas maszyn; okna strojenia progow powiazane z uczciwym baseline; ksztalt workflow CMMS i kadencje planisty; tempo szkolen operatorow i jezyk.

Jesli centrala spiera sie o rzeczy lokalne, pojawiaja sie ukryte obejscia.

## Framework: regula dwoch drzwi

Jesli wybor wplywa na **ryzyko miedzy zakladami albo porownywalnosc dowodu**, to drzwi grupowe.

Jesli wybor wplywa na **jak konkretny aktyw pracuje w tym tygodniu**, to drzwi lokalne. W razie watpliwosci, zapytaj:

- czy zly wybor tu stworzy incydent security albo compliance, ktory podrozuje
- czy zly wybor tu zlamie uczenie portfolio na przegladzie grupy

Tak na ktorekolwiek pcha decyzje w strone standardu grupy.

## Porownanie: standaryzacja kosmetyczna versus operacyjna

| Kosmetyczna | Operacyjna |
|---|---|
| identyczne layouty ekranu | identyczne kategorie dowodu |
| wymuszone liczby czujnikow na linie | wymuszone baseline security |
| kopiuj-wklej nazwy KPI | wyrownane definicje eskalacji |
| teatr szablonu | porownywalne okna pilotow |

## Checklista: opublikuj podzial na pismie

- [ ] standard security grupy to jedna strona, podpisana przez IT-OT i security zakladu
- [ ] istnieje log lokalnych wyjatkow z wlascicielem i wygasaniem
- [ ] miesieczny rollup uzywa wspolnych kubelkow dowodu, nie tylko naglowkow OEE
- [ ] checki zaufania operatorow moga roznic sie kultura zakladu, nie sa kasowane
- [ ] cele integracji skategoryzowane: teraz, nastepny, nigdy per zaklad

## Planowanie i governance

Widocznosc w czasie rzeczywistym powinna informowac **przeglady planowania** dopiero po uczciwej jakosci sygnalu. Do tego czasu standaryzuj pytania przegladu, nie matematyke prognozy.

## Co to znaczy dla DBR77 IoT

DBR77 IoT to **nie kolejny dashboard**.

To **widocznosc maszyny w czasie rzeczywistym**, **lacznosc retrofit-ready**, **szybki pilot** i **wsparcie decyzji edge-first**, ktore moze wyrownac sie do standardow grupy bez udawania identycznych linii.

## Bottom line

Standaryzuj **ryzyko, dowod i security**. Lokalizuj **mapy, progi i rytmy**. Ten podzial utrzymuje multi-site IoT uczciwym.

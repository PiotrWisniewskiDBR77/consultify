# Jak wyglada dobry model stanu maszyny zanim skalujesz IoT

Docelowa persona: Inzynier produkcji / Lider systemow OT / Inzynier niezawodnosci  
Etap lejka: Evaluation  
Glowny problem: zespoly skaluja czujniki zanim uzgodnia, co znaczy "dobrze dziala" w jezyku maszyny, wiec kazdy zaklad wymysla wlasne etykiety pod presja  
Glowna obietnica: minimalny model stanu pod governance: stabilne stany, dozwolone przejscia, dowod na kazde przejscie i jawne nieznane

Skalowanie IoT bez modelu stanu jest jak rozbudowa zakladu bez danych balansu linii.

Pojedziesz szybciej i konflikty odkryjesz pozniej.

Model stanu to nie lista feature vendora.

To uzgodnienie zakladu, jak rzeczywistosc maszyny mapuje sie na kolejna decyzje operacyjna.

## Bezposrednia odpowiedz

Dobry **model stanu maszyny** przed skala ma:

- maly zestaw **nazwanych stanow**, ktorych operatorzy i maintenance juz uzywaja w rozmowie
- **jasne przejscia** zwiazane z sygnalami albo checkami fizycznymi, nie z wrazeniem
- **jednego wlasciciela na przejscie**, gdy stan implikuje inna nastepna akcje
- kubelek **nieznane** dozwolony tymczasowo z follow-up ograniczonym czasem

Jesli nie narysujesz tego na jednej stronie, nie jest gotowe do skali.

## Stany versus tagi

Tagi to etykiety bez sztywnej formy.

Stany to zobowiazania operacyjne.

| Tagi | Stany |
|---|---|
| wiele, nachodzace na siebie | malo, wzajemnie wykluczajace sie w danym momencie aktywa |
| fajne do analytiki pozniej | prowadza playbooki teraz |
| latwe dodac w oprogramowaniu | trudne do zgodzenia miedzy zmianami |

Trzymaj tagi na glebie inzynierska.

Trzymaj stany na tyle nudne, ze hala je zniesie.

## Framework: zestaw startowy szesciu stanow

Dostosuj nazwy do zakladu, zachowaj logike:

1. **Praca zgodnie z planem**  
   W uzgodnionych pasmach wariancji dla cyklu, proxy jakosci i ograniczen

2. **Praca ograniczona**  
   Praca, ale limit materialu, narzedzia, staffing albo przeplywu upstream

3. **Degradacja**  
   Trend od baseline bez jeszcze stopu; priorytet maintenance rosnie

4. **Stop znany**  
   Kod przyczyny pasuje do znanego wzoru usterki albo potwierdzonego warunku

5. **Stop nieznany**  
   Stop bez wiarygodnej przyczyny; stan dochodzenia

6. **Wylaczona z eksploatacji**  
   Planowa praca, przezbrojenie albo lockout; to nie stan usterki

Ten zestaw wystarczy do zestawienia IoT, CMMS i jezyka zmiany, zanim pomnozysz zaklady.

## Checklista: waliduj model przed skala

- [ ] operatorzy przypisuja stany bez otwierania instrukcji
- [ ] kazdy stan mapuje na domyslna nastepna role: operator, maintenance, engineering
- [ ] przejscia loguja, kto potwierdzil fizyczna rzeczywistosc, gdy czujniki sie rozjezdzaja
- [ ] standardy sa przywolywane dla bramek safety i jakosci miedzy stanami
- [ ] nieznane stopy maja maksymalny wiek przed eskalacja

## Porownanie: skalowanie najpierw czujniki versus najpierw stany

| Najpierw czujniki | Najpierw stany |
|---|---|
| wiecej punktow, niejasne znaczenie | mniej punktow, uzgodnione znaczenie |
| spory o progi na kazdym spotkaniu | spor raz, potem governance |
| rozlew dashboardow | wspolny jezyk planowania |

## Kiedy to nie dziala

**Nie dziala**, gdy leadership traktuje model jak dokumentacje IT zamiast zywego kontraktu operacyjnego.

**Nie dziala**, gdy vendor definiuje stany, ktore nie pasuja do triage maintenance na aktywie.

## Co to znaczy dla DBR77 IoT

DBR77 IoT wspiera **widocznosc maszyny w czasie rzeczywistym** i **wsparcie decyzji edge-first**, zeby przejscia stanow oceniac blisko aktywa.

Lacznosc retrofit-ready pomaga maszynom brownfield wejsc w to samo slownictwo stanow bez rip-and-replace.

Szybki pilot twardzi model na jednej klasie linii, zanim poszerzysz rollout.

## Bottom line

Uzgodnij **model stanu zanim pomnozysz czujniki**.

Male, nudne, rzadzone stany bija duza chmure sprytnych tagow, ktorym nikt nie ufa na nocnej zmianie.

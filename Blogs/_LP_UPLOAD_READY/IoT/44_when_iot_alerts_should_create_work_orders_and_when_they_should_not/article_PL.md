# Kiedy alerty IoT powinny tworzyc work order, a kiedy nie

Docelowa persona: Planner maintenance / Inzynier niezawodnosci / Owner CMMS we wspolnocie z operacjami  
Etap lejka: Trial  
Glowny problem: CMMS zalewa auto-generowanymi ticketami, ktore technicy ignoruja, podczas gdy prawdziwe awarie wciaz przychodza jako werbalne eskalacje  
Glowna obietnica: macierz routingu: ktore alerty staja sie work order, ktore sa watch item, a ktore tylko wzbogacaja istniejace prace

Work order to obietnica pracy i czesci.

Alerty IoT to obserwacje.

Pomylenie dwoch rzeczy pali zaufanie szybciej niz jakikolwiek kolor na dashboardzie.

## Bezposrednia odpowiedz

Tworz work order z alertu IoT tylko wtedy, gdy **praca jest naprawde wymagana**, **istnieje job plan albo tryb awarii** oraz **sygnal przekroczyl prog zakladowy z korelatem**.

Nie tworz work order, gdy alert to **szum baseline**, **znany transient przy starcie**, **sytuacja szkoleniowa albo override** albo **lepiej najpierw obsluzyc jako eskalacja supervisora**.

## Sekwencja krokow: alert do decyzji routingu

1. **Sklasyfikuj sygnal** wobec modelu stanu i slownika sygnalow  
2. **Sprawdz korelat** z drugiego sygnalu, powtorzenia albo potwierdzenia operatora  
3. **Dopasuj klase maintenance** z drabiny priorytetow  
4. **Jesli ryzyko interrupt jest wysokie**, otworz sciezke interrupt wg regul zakladu  
5. **Jesli celem jest uczenie**, loguj do widocznosci inzynierskiej bez obciazenia CMMS  
6. **Co tydzien przegladaj** falszywa rate tworzenia work order i koryguj progi

## Porownanie: spam CMMS versus zdyscyplinowany routing

| Spam CMMS | Zdyscyplinowany routing |
|---|---|
| kazde przekroczenie progu to ticket | tickety zwiazane z job planami |
| technicy wyciszaja powiadomienia | alerty mapuja sie na klasy |
| planner staje sie data janitor | planner posiada reguly routingu z ops |
| brak petli zwrotnej dla zlych regul | mierzona falszywa rate ticketow |

## Eskalacja bez automatycznych work order

Niektore warunki wymagaja **widocznosci supervisora** albo **strukturalnego problem solving** zanim ktos zobowiaze czas na klucz.

To nie slabosc.

To szacunek dla brownfield constraints i skonczonej zdolnosci rzemieslniczej.

## Co to znaczy dla DBR77 IoT

DBR77 IoT to **nie kolejny dashboard**.

To **widocznosc maszyny w czasie rzeczywistym**, **lacznosc retrofit-ready**, **szybki pilot** i **wsparcie decyzji edge-first**, ktore moze zasilac CMMS, gdy reguly routingu sa jawne, a nie gdy kazdy pixel krzyczy.

## Bottom line

Work order powinny byc rzadkie i powazne.

IoT powinno te dyscypline pokazywac, a nie automatyzowac chaos w backlogu.

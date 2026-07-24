---
id: IDE-022
tytul: FUNDAMENT — rejestr akcji: Menu 3 renderuje się z niego, Teresa może przezeń sterować (za flagą)
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — rozdz. 02 (rejestr akcji), Z1/Z3/Z4"
utworzone: 2026-07-24
ekran: processflow-canvas
wysokosc: 900
klik: "W każdej z czterech reprezentacji sprawdź drugi pasek (Menu 3): nazwa „Dodaj…" pasuje do narzędzia i faktycznie coś dodaje, „Szablony" otwierają galerię. „AI rozwiń" tylko w Mapie. „Utwórz z mapy" ma już nie być."
---

## 1. PO CO TO ISTNIEJE

Naprawa martwych kliknięć z poprzedniej sesji była punktowa. Bez jednego miejsca, które wie, jakie akcje istnieją, następna akcja dopisana do wspólnego paska znów byłaby martwa — nie miał tego kto pilnować.

To jest brakująca część systemowa: rejestr akcji (deklaracja raz, w jednym miejscu) + strażnik, który przy każdej zmianie sprawdza, że żadna akcja nie jest bez obsługi. Wprowadzenie martwego kliknięcia staje się **niemożliwe**, a nie „naprawione raz".

## 2. CO DZIAŁA PO ODEBRANIU

- **Menu 3 (drugi pasek) renderuje się z rejestru** — to pierwsza powierzchnia przepięta. Zestaw pozycji per reprezentacja jest teraz konsekwencją deklaracji, nie ręcznie utrzymywanej listy. Host stracił własną listę pozycji.
- **Strażnik w commicie**: akcja bez obsługi nie wejdzie do repozytorium.
- **Teresa może wywołać akcje Idei rozmową** — za flagą, domyślnie wyłączoną. Manifest narzędzi generuje się z tego samego rejestru, więc nowa akcja jest automatycznie dostępna i dla paska, i dla Teresy.

## 3. JAK ODEBRAĆ

Ścieżka w nagłówku. Zestaw pozycji Menu 3 nie zmienił się względem tego, co odbierałeś wczoraj — bo to był kontrakt, którego pilnowałem. Zmieniło się to, **skąd** te pozycje pochodzą.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- Zestaw pozycji Menu 3 zgodny 1:1 z kontraktem dla wszystkich czterech reprezentacji (zmierzone renderem). „Utwórz z mapy" — martwa etykieta — usunięte.
- Pozycje realnie działają nową ścieżką: „Dodaj kształt" dodał krok, „Szablony" otworzyły galerię. Obiekt testowy przywrócony do czystego stanu.
- Strażnik zielony (16 akcji). Kontrola typów całego projektu zielona.
- ★ Przy budowie strażnika złapałem, że jego pierwsza wersja przepuściła mój wstrzyknięty błąd — utwardziłem go, zanim cokolwiek uznałem za gotowe.

## 5. CO CZEKA (jawnie)

- Transport Teresy zweryfikowany logiką i składnią, ale **nie żywą rundą z modelem** (brak środowiska). Flagi zostają wyłączone do żywego testu na produkcji — dopiero on pozwoli wyciąć stare regexowe wykrywanie intencji.
- Pozostałe powierzchnie (lewy pasek, prawy panel, menu kontekstowe) nadal budują się ręcznie — to następne fale.

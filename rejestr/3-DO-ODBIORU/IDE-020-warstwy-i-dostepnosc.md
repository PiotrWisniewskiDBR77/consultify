---
id: IDE-020
tytul: NAPRAWA — pasek zasłaniał okno Eksportu; zero błędów krytycznych dostępności
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Bramki odbioru — docs/standards/idea-workspace/12_BACKLOG_I_ODBIOR.md"
utworzone: 2026-07-23
ekran: processflow-canvas
wysokosc: 900
klik: "Otwórz „Eksport” w Przepływie — okno ma być widoczne w CAŁOŚCI, nieprzecięte przez pasek nad płótnem. Potem zamknij i sprawdź, że pasek dalej działa."
---

## 1. PROBLEM

**Warstwy.** Okno Eksport/Import w Przepływie było przecięte w połowie — pasek trybu i kształtów rysował się nad nim. Połowy listy eksportu po prostu nie było widać.

**Dostępność.** Skan wykazał 62 błędy krytyczne na czterech ekranach — pola i przyciski bez żadnej nazwy dla czytnika ekranu, w tym 49 samych pól w Tabeli.

## 2. ROZWIĄZANIE

**Warstwy.** Pasek miał zaszytą na sztywno wartość warstwy równą poziomowi okien dialogowych, więc z nimi wygrywał. Było to obejście z czerwca, mające trzymać pasek nad kartką odkrywania — a ten komponent od dawna nie jest nigdzie renderowany. Obejście zostało i zaczęło szkodzić. Pasek wraca na warstwę pasków chrome.

**Dostępność.** Nazwy są konkretne, nie generyczne: komórka to „{kolumna} — {wiersz}", checkbox to „Zaznacz wiersz: {nazwa}". Wszystkie naruszenia typu „przycisk bez nazwy" okazały się jednym komponentem — przyciskiem zamykania karty w pasku Moja Praca, powtórzonym tyle razy, ile otwartych kart.

Zero zmian wizualnych w części dostępnościowej — wyłącznie atrybuty dla czytnika ekranu.

## 3. JAK ODEBRAĆ

Otwórz „Eksport" w Przepływie — okno ma być widoczne w całości. Zamknij i sprawdź, że pasek nad płótnem dalej działa.

Reszty nie da się odebrać wzrokiem — to warstwa dla czytnika ekranu. Odbiór = przyjęcie liczby: 62 błędy krytyczne → 0.

## 4. BRAMKA DOSTĘPNOŚCI PRZECHODZI

Zero naruszeń krytycznych **i** poważnych na wszystkich czterech ekranach. Dwa ostatnie wyglądały na wybór mniejszego zła, a nim nie były:

- **Logo „77"** nie musiało przestać być crimsonowe. Problemem był stały odcień z tailwinda, który nie rozjaśnia się w trybie ciemnym. Token marki rozjaśnia się sam, a pogrubienie napisu przenosi go do kategorii tekstu dużego, gdzie próg jest niższy. Marka zostaje.
- **Ramki Tablicy** nie wymagały wyboru „dostępność albo klawiatura". Ramka jest kontenerem, nie elementem operowanym — po zdjęciu z niej fokusu pozostałe węzły nadal chodzą z klawiatury, przycisk „Zwiń sekcję" też, a zaznaczanie i przeciąganie ramki zachowuje się **identycznie** jak przed zmianą. Sprawdziłem różnicowo: przed i po.

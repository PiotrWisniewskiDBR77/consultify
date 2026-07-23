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

## 4. CZEGO TA NAPRAWA NIE ZAŁATWIA

Bramka dostępności wymaga zera błędów krytycznych **i** poważnych. Krytyczne są na zerze, poważne zostają — dwa rodzaje, oba wymagają Twojej decyzji, nie kodu:

1. **Kontrast w powłoce globalnej** (logo, breadcrumb, odznaka licznika). Poprawka logo dotyka crimsona zarezerwowanego dla semantyki krytycznej i dotknęłaby całego produktu.
2. **Węzły Tablicy** — biblioteka oznacza każdy węzeł jako przycisk, a ramka słusznie zawiera przycisk zwijania. Jedyne obejście to odebranie węzłom obsługi klawiaturą, czyli wymiana jednego naruszenia na drugie. Nie zrobiłem tego po cichu.

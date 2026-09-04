# R3 — naprawa rodziny

- Naprawiono 20 etykiet w toolCompletion.ts: 2 kształtu A oraz 18 kształtu B.
- Kształt A: Portfolio mission -> Misja portfela i kontekst; Risk mission -> Misja i kontekst.
- Kształt B: nazwy misji, elementów portfela oraz stanów final source summary zastąpiono nazwami wyprowadzonymi z title.pl odpowiednich paczek. Hybrydy w badanym pliku spadły z 34 do 17; osiemnasta zmiana nadal zawiera uzasadnione `Trade-offy`, więc licznik kształtu B nadal ją widzi.
- Ratchet: 6 przed partią A -> 4 po partii A -> 4 po partii B; baseline obniżony z 6 do 4.
- Cztery nieuzasadnione identyczności Attack, Repair, Defend, Protect pozostają propozycjami, ponieważ żadna paczka nie dostarcza odpowiadającego title.pl.
- Brak pomiaru baseline i Brak re-estymacji target pozostają propozycjami zgodnie z instrukcją; nie zostały cicho przetłumaczone.
- Esbuild obu zmienionych plików zakończony bez błędu.
- Pakiet celowany: 8/8 PASS; pakiet pełnych katalogów wykazał dwa zastane błędy brakujących kluczy Idea Workspace w pl/en, poza licencją dyżuru.

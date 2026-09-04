# Dyżur 349 — R4/R5: granica dowodu

## R4 — wynik

Pierwszy wspólny przebieg na świeżej bazie dał `18/12/6`; cztery czerwone pliki osobno i pełny blok sekwencyjnie dały `18/18`. Kandydat przyczyny brzmiał: równoległe inicjalizacje pełnego `ApiGateway` otwierają osobne pule (`server/src/database/PostgresDatabase.ts:453-489`, domyślny limit puli 10 w `server/src/config/DatabaseConfig.ts:161`) i w pierwszym zimnym przebiegu powodują błędy 403/500.

Kandydacka naprawa — advisory lock serializujący pięć suit RealPG — dała dziesięć zielonych przebiegów, ale została **odrzucona**: po jej usunięciu następne dziesięć kolejnych przebiegów bez zmian kodu również dało `18/18`, także jeden po restarcie własnego kontenera. Mutacja nie zaczerwieniła pakietu, więc lock nie ma dowodu przyczynowego i nie został zacommitowany.

Werdykt R4: **STOP MERYTORYCZNY / NOT PROVEN**. Objaw i wpływ współbieżności pierwszego przebiegu są zmierzone, lecz konkretna przyczyna `plik:linia` nie została udowodniona. Brak danych: telemetryczny komunikat źródłowy odpowiedzi 403/500 z tego pierwszego, niepowtarzalnego przebiegu oraz powtarzalny wyzwalacz zimnego stanu. Nie stosuję ponowień, pomijania testów, obniżenia progu ani placebo-locka.

## Dziesięć kolejnych przebiegów bez zmiany kodu

Wszystkie na tej samej bazie `cx349`, sekwencyjnie między przebiegami, wewnątrz z domyślną współbieżnością plików, `--retry=0`; każdy `18/18/0`, 18 tych samych pełnych nazw, `statusDrift=0`.

| Run | SHA-256 |
|---|---|
| 01 | `6ed9396a5b559d26f548b71e8cbe1a60c736fb9e738084de6a62fdc40bfadc5a` |
| 02 | `933ac54f11c64533199508605775ce533e169dd90ffa0ab8463b7b67597d2981` |
| 03 | `cc4e58bed0e7a8eb381c0ee6cf729762341f00e0f96c02560230ae424e833403` |
| 04 | `51167d48bdabf6f38bedf3a68c6a82c43a369d3794f597d98dd094f879918bad` |
| 05 | `84cfe18d7da61b6fb7af1baa2a17806a613a39f8b57be6cce9ffc100205dd2cd` |
| 06 | `5e4ea206a851aeb899e976fec7b802107ced859ffc0ac7315111c2ddaf1854d9` |
| 07 | `d257c90d43099f653277b40ee4a039491735dccb25e4f453df63d397cefb90d6` |
| 08 | `b94f55bb5e7ba9481caf208cfe03cf098e8f717333445b066c4190d78800caf8` |
| 09 | `3a69bec4f0e0f3d99e6a7a29dc83da00f99da2b396b148761c51cc5c47fab14a` |
| 10 | `1dac3cb3775992d3b3a31661cc1ee3f611313c165dede9cfbc4451166f008c48` |

## R5 — bezpiecznik

Bezpiecznik jest obecnie niemożliwy: brak udowodnionej przyczyny oznacza, że test advisory-locka byłby atrapą, a test „10 razy zielono” nie zaczerwieni się przy znanej mutacji. Nie dodano nowego testu.

## Sprzątanie

Przed i po `docker rm -fv cx-day349-pg`: `8.7 GiB` wolnego. Kontener i jego wolumen zostały usunięte.

# Dyżur 308 — język polski

Marker: `416432abafe31a390a909cf7e460a4bad7bef191` (`MARKER OK`)  
Gałąź: `codex/day308-klucz-istnieje-nie-przetlumaczony-20260903`

## R1 — mianownik

Deterministyczny `scripts/dev/i18n-pl-audyt.mjs` zmierzył: 34 303 liście PL, 32 314 liście EN, 631 wspólnych kluczy z identyczną wartością dłuższą niż 3 znaki oraz 2 005 kluczy obecnych tylko w PL. Wszystkie liczby wejściowe autora zostały potwierdzone poza liczbą PL-only, której instrukcja nie przewidywała liczbowo.

Skrypt zawiera jawną, uzasadnioną listę nazw produktów, skrótów, jednostek, adresów i placeholderów. Pierwszy przebieg automatyczny oddzielił 52 przypadki uzasadnione od 579 kandydatów wymagających czytania kontekstu. Artefakt: `/private/tmp/cx-day308-jezyk-pl-artefakty/r1-audit.txt`.

## STOP — R2 klasyfikacja semantyczna

Rodzaj: MERYTORYCZNY  
Powód: reguły stop-słów nie wystarczają do prawdziwej klasyfikacji 631 wartości; np. `Tempo` jest poprawnym polskim słowem mimo identyczności, więc automatyczne nazwanie pozostałych 579 `DEFEKT` byłoby fałszem.  
Licencja, którą sprawdziłem: Z40 — „ZAKAZ tłumaczenia maszynowego bez przeczytania kontekstu użycia”; wynik: każda pozycja wymaga odczytu konsumenta i ograniczeń układu.  
Dowód: wygenerowany roboczo rejestr klasyfikuje `transformationScenarios.metricLabels.tempo` jako DEFEKT, co jest kontrprzykładem obalającym samą heurystykę.  
Co dostarczyłem ZAMIAST zmiany: działający mianownik, jawne reguły bezpiecznych wyjątków oraz pełną listę kandydatów generowaną lokalnie; roboczego rejestru nie commituję jako prawdy.  
Co zrobiłbym, gdyby zapadła decyzja X: przegląd klucz po kluczu z wyszukaniem każdego konsumenta, zatwierdzenie DEFEKT/UZASADNIONE, dopiero potem grupowe tłumaczenia i kadry.  
Rekomendacja dla nadzorcy: podzielić 631 kluczy modułami na dyżury; promień obejmuje 579 kandydatów i 2 005 asymetrycznych kluczy PL-only.  
Stan: zacommitowano częściowo skrypt R1 w `5cb238c0c3`.  
Czy kontynuowałem pozostałe pozycje: TAK pomiarem zależności; R3–R6 pozostają otwarte, ponieważ zależą od prawdziwej klasyfikacji R2.

## R3–R6 — stan

Nie zmieniono tłumaczeń ani `src/`; nie utworzono bezpiecznika z fałszywą linią bazową i nie wykonano 20 kadrów. Napisy poza `t()`, dług `AssessmentReportDocument`, dowód ekranowy PL/EN i pełne nazwy testów pozostają **NIEZWERYFIKOWANE**. Roboczy `REJESTR_JEZYK_PL_20260903.md` jest niecommitowany i nie jest wynikiem R2.

Stan dyżuru: **CZĘŚCIOWE**.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane. Bazy dyżuru nie utworzono.

# Dyżur 300 — prezentacja błędów na froncie

Marker: `416432abafe31a390a909cf7e460a4bad7bef191` (`MARKER OK`)  
Gałąź: `codex/day300-front-prezentacja-bledow-20260903`

## STOP — warunek startu: dyżur 296

Rodzaj: MERYTORYCZNY  
Powód: na dokładnym markerze nie istnieje żaden konsument ani plik `appErrorMapper` w `server/src`, więc wymagany kontrakt wejściowy dyżuru 296 nie jest scalony.  
Licencja, którą sprawdziłem: Z40 — „ZAKAZ startu bez scalonego 296 (bez `appErrorMapper` w `server/src` piszesz STOP)”; wynik `FILES_WITH_APP_ERROR_MAPPER=0`.  
Dowód: `git grep -c appErrorMapper -- server/src` nie zwrócił żadnego pliku; `git grep -ln appErrorMapper -- server/src` zwrócił zero trafień.  
Co dostarczyłem ZAMIAST zmiany: potwierdzenie mianownika frontu — dokładnie 642 wystąpienia `data.error|err.message|error.message` w zadanych katalogach — oraz czysty raport blokady.  
Co zrobiłbym, gdyby zapadła decyzja X: po scaleniu 296 odczytałbym rzeczywisty kształt koperty i dopiero względem niego zbudował `appErrorCopy`, widok, codemod i strażnik.  
Rekomendacja dla nadzorcy: najpierw zintegrować i zweryfikować wynik 296 na linii bazowej 300, następnie wznowić 300 z nowego jawnego markera.  
Stan: STOP przed R1; nie zmieniono `src/`, `server/src`, tłumaczeń ani testów.  
Czy kontynuowałem pozostałe pozycje: NIE — instrukcja nazywa brak mappera twardym warunkiem startu i zakazuje budowania na domniemanej kopercie.

## Twierdzenia niezweryfikowane

Klasyfikacja 642 wołaczy, wybór realnego `ErrorState`, teksty kodów, codemod, linia bazowa zero, mutacje i 20 kadrów pozostają **NIEZWERYFIKOWANE**.

Nie uruchomiono bazy, runtime'u ani portów. Nie ustawiono zmiennych poczty i niczego nie wysłano.

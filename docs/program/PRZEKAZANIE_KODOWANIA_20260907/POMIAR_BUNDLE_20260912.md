# E3 — pomiar bundle i regresji, 2026-09-12

Status: **PARTIAL**. Wspólny boot spełnia próg 2 000 000 B, lecz pełny pierwszy zalogowany ekran pobiera 5 788 473 B znanego decoded JS. Nie wykazano przyspieszenia gotowości. Dwa istniejące automatyczne PUT403 przy odczycie CLOSED initiative pozostają defektem produktu. To lokalny dowód, bez odbioru staging, demo, produkcji lub całego MVP.

## Zakres i identyfikacja

Baseline: E2 `934e08de86f23d8f48438a69e9dde1522136c04c`, zbudowany w scratch/e3-marker i serwowany jako e3-before-dist. After: `375660f7d1b8bd171bf52a9f271eefdd2b986c1e`, WT/dist z manifestem.

Kroki zapisane osobno: `8ff9565b7f` odkłada trzy trasy drugorzędne oraz Help do pierwszego otwarcia; `ff2caf56a5` ładuje SDK głosowe po rozpoczęciu voice i anuluje porzucony start; `375660f7d1` odkłada MainLayout na wejście zalogowane. Stan Help po pierwszym montowaniu pozostaje przy zamknięciu. Buildy zakończone powodzeniem, końcowy z --manifest; wcześniejszy default heap 4GB OOM wymagał NODE_OPTIONS=--max-old-space-size=8192. To warunek lokalnego builda, nie poprawa produktu.

## Dwa różne mianowniki

| Miara | Before | After |
|---|---:|---:|
| Wspólny boot, domknięcie statycznych importów manifestu (B) | 5 615 909 | 1 911 610 |
| Pełny cold My Work, znany decoded JS (B) | 7 010 816 | 5 788 473 |
| Cold encoded response body (B) | 1 858 454 | 1 704 016 |
| Cold transferSize (B) | 1 874 354 | 1 782 616 |
| Zakończone script entries | 54 | 263 |
| Gotowość cold od triggera (ms) | 2455 | 2462 |

Skrypt scripts/dev/measure-boot-bundle.mjs uwzględnia HTML roots i zawsze importowany App mimo dynamicznej etykiety Rollupa. Nie uwzględnia zależnych od trasy lazy importów, dlatego jego próg nie dowodzi pierwszego ekranu poniżej 2MB. Listy wszystkich chunków >200KB są w e3-before-chunks.json i e3-step3-chunks.json. Pierwszy ekran ma około 17,4% mniej decoded JS, ale jedna para czasu nie daje dowodu poprawy. Wzrost liczby requestów wynika z wielu małych chunków: lokalnych <10KB jest 38→232, <50KB 48→251; overhead żądań ogranicza oszczędność transferu.

## Metoda i kompletność

Świeży Chromium/context na każdą fazę, localhost preview5214, real API4214/JWT/izolowany PG, viewport1440×900, light. Jeden context na kolejne nawigacje, więc późniejsze ekrany używają cache. 15 rzeczywistych pozycji sidebaru + cold My Work + 3 karty = **19/19 w każdej fazie**, 38 PNG. Nie dopisano fikcyjnego szesnastego modułu.

readyFromTriggerMs kończy się po zmianie treści i trzech stabilnych próbkach co400ms. Następuje jawne okno obserwacji2000ms dla debounce, błędów i zasobów, potem screenshot z kursorem poza sidebar. totalCaptureMs zawiera screenshot i nie jest czasem renderu. Ta heurystyka nie jest pomiarem TTI ani akceptacją wszystkich funkcji modułów.

ResourceTiming sumuje zakończone skrypty na koniec okna: decodedBodySize, encodedBodySize i transferSize. Jeden opaque zewnętrzny gtag w obu fazach ma zerowe dostępne rozmiary; sumy nie kwantyfikują tego payloadu. Zero transfer może oznaczać cache/niedostępny timing, nie brak wykonania JS. Nie jest to cała późniejsza sesja.

After powtórzono z buforem ResourceTiming10000 po wykryciu utraty wpisów przy limicie domyślnym. Before miał54/54 wpisów cold i zero brakujących zakończonych URL w każdym z19ekranów; capacity-only korekta nie wymagała powtórzenia before. Hashe instrumentu i superseded próby opisano w E3_BROWSER_HANDOFF.md; stare próby są poza evidence. Końcowe źródło after to e3-browser-after-final.log, a nie przerwany e3-browser-after-observed.log. Instrument oraz bezpieczne sidecary zachowano w evidence/bundle-chunks; sesje/hasła pozostają prywatne poza repo.

## Gotowość ekranów (ms)

| Ekran | Before | After |
|---|---:|---:|
| Cold My Work | 2455 | 2462 |
| Chat | 2191 | 2179 |
| My Work | 1370 | 1365 |
| Interview | 1759 | 1773 |
| Tools | 1742 | 1758 |
| Assessment | 1374 | 1378 |
| Audits | 1744 | 1749 |
| Initiatives | 1344 | 1344 |
| Execution | 1777 | 1744 |
| Results | 1345 | 1342 |
| Finance | 1347 | 1346 |
| Materials | 1346 | 1340 |
| Organization | 1340 | 1340 |
| Admin | 1346 | 1350 |
| Settings | 1353 | 1359 |
| Partners | 1348 | 1345 |
| Initiative card | 1312 | 1317 |
| Task card | 1314 | 1318 |
| Action card | 1307 | 1309 |

## Błędy, wygląd i zachowanie

W obu fazach: zero pageerror, zero instrumentError. Jedyny ekran z błędami: Initiative card, dwa **PUT403** do /api/initiatives/e33b0b36-f9c9-5cc9-b516-ae04f7311de2 i dwa console errors. Karta CLOSED automatycznie próbuje zapisu po otwarciu i pokazuje Unsaved. Nie zmieniono statusu ani uprawnień dla uzyskania zielonego pomiaru. Hipoteza autosave/normalizacji wymaga osobnego badania; przyczyna nie jest tu udowodniona.

Niezależny scope_audit obejrzał38PNG: PASS braku nowej regresji renderu w light1440; raport E3_VISUAL_REVIEW.md. Zachowane shell, tabele i karty; istniejące ucięcia kolumn/tooltipy nie są nową regresją. To nie dowodzi funkcjonalności pustych modułów, wszystkich uprawnień ani dark/mobile.

Root wykonał Help: idle bez chunku Help, pierwsze otwarcie ładuje panel, search project pozostaje po close/reopen, deep link FAQ otwiera zakładkę i konsumuje parametry; zero pageerror. **Odczyt konkretnego artykułu NOT_TESTED**. Public /auth: pole hasła widoczne, zero MainLayout/Help chunków i pageerror. JSON+PNG są w evidence.

Voice: dwa nowe pliki testów pending start (Teresa4, Anna3) na baseline RED4FAIL/3PASS, po poprawce GREEN7/7; istniejące Teresa13/13 i capability/bargein7/7. Testy wstrzymują rzeczywiste await AudioContext.close lub fetch context, następnie unmount/STOP i sprawdzają brak późniejszego mic/session; obejmują normalny start i odmowę mikrofonu. Nie udają opóźnionego synchronicznego SDK. Nie stanowią dowodu prawdziwej rozmowy z dostawcą voice. Logi w codex4-artefakty/e3-voice-*.log, źródła w commicie kroku2.

## Pozostałe bramki

Pełny pierwszy ekran≤2MB: NIE. Przyspieszenie gotowości: NIE WYKAZANO. Zero błędów produktu: NIE. Help article retrieval, dark/mobile i live voice: NOT_TESTED. Wszystkie działania lokalne; brak push/deploy. API4214 i baza przekazane E4; nie uruchamiać ponownie pomiaru bez uzgodnienia własności.

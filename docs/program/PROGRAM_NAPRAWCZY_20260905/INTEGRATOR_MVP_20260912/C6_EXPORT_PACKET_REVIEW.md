# C6 export packet — review integratora

Przeczytano cały C6_EXPORT_FIX_PACKET.md. Kierunek namespace-qualified public/v8, zgodność public keys, owner vs counterparty i pochodny manifest jest właściwy. Status REVISE dwóch prób/cleanup przed wydaniem, nie zgoda na trzeci blok kodowania.

1. Test export-lock-first nie odtwarza źródłowego race. Obowiązkowy także writer-first dla absent/existing policy: writer ma lock i uncommittedhold, eksport obserwowany jako waiter, writerCOMMIT, eksport423bezpliku. Mutant BEGIN-before-lock musi przegrać ten sam test, nie tylko source-order assertion.
2. locked=false po błędzie otrzymania ACK z SELECTpg_advisory_lock nie jest dowodem braku locka. Niepewne nabycie wymaga cleanup/discard, nigdy zwrotu client do pool. Dołożyć kontrolowany lostACK acquisition i brak reuse zablokowanegoclient.

Pierwszy v8 pion jest etapem, nie zastępczym celem pełnegoE4. Cały katalog ma pozostać w mianowniku, a kompletność pełnego eksportu musi wynikać z pokrycia i zachowania. Nie wymagamy ręcznie nowej decyzji właściciela dla każdej technicznej tabeli: grupowanie według udowodnionego kontraktu jest dopuszczalne, nie samej podobnej nazwy. Nieznane treatment retencji nie jest tym samym co uprawnienie do eksportu danych organizacji.

Uwagi przekazane C6 do poprawy packetu. IE00 i W05 nadal implementowane; C6 kodowanie nie wystartowało.

Korekta odebrana: packet dcdbc20b25736968f4c60a3209c6cef2ced357852d5fadfd8d828b27099b2378 zawiera writer-first absent/existing i acquireACKlost discard. Root doczytał zmieniony paragraf. READY_FOR_ASSIGNMENT po zwolnieniu slotu, bez runtimePASS.

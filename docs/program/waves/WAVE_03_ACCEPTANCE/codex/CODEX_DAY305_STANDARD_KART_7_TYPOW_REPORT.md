# CODEX DAY 305 — standard kart 7 typów

Marker: `416432abaf`  
Gałąź: `codex/day305-standard-kart-7-typow-20260903`  
Stan: **CZĘŚCIOWE**

## Wynik

- R1: GOTOWE — macierz siedmiu typów i pomiary są w dokumencie projektu.
- R2: GOTOWE — zapisano wspólny kontrakt oraz wybrano Initiative jako jedyny prototyp.
- R3: STOP — nie wprowadzono zmiany wizualnej bez bezpiecznego, lokalnego harnessu pokazującego rzeczywisty `InitiativeDocumentView`; sześć pozostałych typów pozostało nietkniętych.
- R4: STOP — brak uczciwej pary PRZED/PO, więc nie ma podstawy do oceny właściciela.
- R5: CZĘŚCIOWE — test bazowy kontraktu Initiative przeszedł; kontrole artefaktu zostaną zapisane niżej po wykonaniu.
- R6: GOTOWE — plan migracji etapowej zapisano bez włączania flag i bez scalania.

## Dowody

- pełne migracje lokalnego PostgreSQL: pierwsze przejście wykonane, drugie `Applying migrations: 0`;
- bazowy `initiativeRecordCanon.test.ts`: raport `evidence/prototypy/karty-7-typow-20260903/przed.json`;
- 7 wpisów typu w rejestrze; 8 ekranów `karta-*` w dev-render (jawny rozjazd pomiarowy);
- zero zmian serwera, migracji i zachowania produktu.

R3 stop-loss: istniejący dev-render ma nadmiarowy ósmy ekran, a dostępny harness nie dowodzi montażu rzeczywistej Initiative. Zgodnie z zasadą pomiaru nie dodano atrapy produktu ani flagi bez konsumenta.

R4 stop-loss: nie zapisano zrzutów, ponieważ identyczny stan PRZED/PO albo ekran zastępczy byłby fałszywym dowodem przemalowania.

R5 kontrole: test bazowy i końcowy `initiativeRecordCanon.test.ts` po 8/8; `check-artefakt-struktura` bez nowego długu (baseline 9, aktualnie 9); `check-list-canon` 368/368; `check-focus-canon` raportuje istniejące 208 wystąpień w 104 plikach. Ponieważ nie ma zmiany produktu, lista pełnych nazw testów przed i po jest identyczna.

## Uczciwa granica

Nie powstał prototyp wizualny ani cztery zrzuty. W szczególności nie uznaję dokumentu, testu jednostkowego ani istniejącego ekranu dev-render za dowód PRZED/PO. Flaga nie została utworzona, więc nic nie zostało przypadkiem włączone.

# CODEX DAY 306 — Dynamic SWOT, dwa etapy

Marker: `416432abafe31a390a909cf7e460a4bad7bef191`  
Gałąź: `codex/day306-swot-dwa-brakujace-etapy-20260903`  
Stan: **W TOKU**

## R1–R2

Pomiar i tabela są w `docs/program/prototypy/SWOT_SIEDEM_ETAPOW_20260903.md`. Kontrakt wewnętrznie używa dwóch znaczeń „ostatni”: §6.16 nazywa tak Results & Readiness, a §6.B umieszcza po nim Review. Bezpieczny model siedmiu etapów dodaje Recommendations i Review, pozostawiając `outputs` jako kompatybilny odpowiednik Results & Readiness. Pytanie do właściciela pozostaje jawne.

Korekta tezy instrukcji: spośród 19 paczek 14 ma pięć faz, jedna osiem, cztery po cztery; wszystkie pięć klocków SWOT ma konsumentów.

## R3 — CZĘŚCIOWE

Jedna flaga `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` jest fail-closed i domyślnie OFF. OFF zwraca ten sam obiekt pięciofazowy; ON układa `recommendations` przed `outputs` i `review` po nim oraz dodaje po jednej bramie. Testy flagi 3/3. Zmiana dotyczy packa/rejestru; realny store sesji nadal ma pięć kroków, więc nie ogłaszam pełnej budowy runtime.

## STOP — R4

Rodzaj: MERYTORYCZNY  
Powód: pack ma siedem faz przy ON, ale produkcyjny store sesji nadal ma pięć kroków, więc realny dowód siedmioetapowego przejścia i wznowienia byłby fałszywy.  
Licencja, którą sprawdziłem: R4 wymaga realnej bazy 6310, zimnego odczytu i wznawialności; `tests/e2e/tools/swot-real-pg-resume.spec.ts` jest tylko do odczytu.  
Dowód: test flagi dowodzi wyłącznie deskryptora; komentarz i test rejestru wskazują runtime IDs `mission,input,swot,insights,outputs`.  
Co dostarczyłem ZAMIAST zmiany: lokalny PostgreSQL po pełnych migracjach (drugi przebieg 0), prototyp deskryptora i precyzyjna granica brakującej integracji store.  
Co zrobiłbym, gdyby zapadła decyzja X: rozszerzył model stanu sesji addytywnie, następnie dopisał osobny test RealPG przez ApiGateway i zimny klient.  
Rekomendacja dla nadzorcy: osobno licencjonować zmianę runtime/store; nie uznawać tej gałęzi za dowód wznawialności siedmiu kroków.  
Stan: zacommitowano częściowo w `b65776b7e1`.  
Czy kontynuowałem pozostałe pozycje: TAK.

## R6 — raport końcowy

Stan dyżuru: **CZĘŚCIOWE**. R1–R2 gotowe, R3 dostarcza bezpieczny prototyp packa za flagą OFF, R4–R5 zatrzymane z dowodem braku runtime siedmiu kroków.

Testy przed/po porównano pełnymi nazwami. Dodano dokładnie trzy przypadki: brak zmiennej = OFF, jawne OFF i ON = siedem faz z dwiema bramami. Nie zniknęła żadna nazwa. Artefakty poza repo:

- `przed.json` SHA-256 `2a2afd765209f2ac915b4945ab0509f8baa4bacae68390dc5bdd987332c4a341`;
- `po.json` SHA-256 `c3cd5142eeb70d85f9f065ad4bd9fee7ea30e3a56d559e7256a4e3ae7b579ed2`;
- `przed-nazwy.txt` SHA-256 `9f3106e3e88d87d102da7061e11c83515dfbefeb0666f395abfd68c5834f36fa`;
- `po-nazwy.txt` SHA-256 `f94f8d9726628a480f320923c0379c5b9bd5e86790ef1e9eb4435f8870930f44`.

Pułapki: pakiet flagi jest czysto jednostkowy, nie otwiera bazy i nie przechodzi przez V8/auth/results middleware; uruchomiono go z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`. Nie jest dowodem HTTP, zapisu ani wznawialności.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

### Twierdzenia niezweryfikowane

- siedmioetapowa sesja zapisuje i wznawia oba nowe kroki;
- ekran produkcyjny pokazuje nowe kroki w którymkolwiek motywie lub języku;
- model dwóch dodatkowych etapów pasuje bez zmian do pozostałych 18 paczek;
- określenie §6.16 „ostatni” miało znaczyć „ostatni przed Review”.

## STOP — R5

Rodzaj: MERYTORYCZNY  
Powód: kanoniczny ekran montuje pięcioetapowy runtime, więc cztery kadry nie pokazałyby prototypu siedmiu etapów.  
Licencja, którą sprawdziłem: R5 wymaga realnej powłoki `tools-swot-session-workspace`, czterech kadr light/dark × pl/en i oględzin każdego.  
Dowód: R4 wykazał brak konsumenta nowych faz w store sesji.  
Co dostarczyłem ZAMIAST zmiany: brak atrap i brak mylących PNG; flaga pozostaje OFF.  
Co zrobiłbym, gdyby zapadła decyzja X: po integracji store uruchomiłbym wyłącznie kanoniczny runtime na 5290/5291 i wykonał cztery inspekcjonowane kadry.  
Rekomendacja dla nadzorcy: nie prosić właściciela o akceptację wizualną przed rzeczywistym montażem.  
Stan: zacommitowano częściowo w `b65776b7e1`.  
Czy kontynuowałem pozostałe pozycje: TAK.

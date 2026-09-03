# CODEX DAY 306 — Dynamic SWOT, dwa etapy

Marker: `416432abafe31a390a909cf7e460a4bad7bef191`  
Gałąź: `codex/day306-swot-dwa-brakujace-etapy-20260903`  
Stan: **W TOKU**

## R1–R2

Pomiar i tabela są w `docs/program/prototypy/SWOT_SIEDEM_ETAPOW_20260903.md`. Kontrakt wewnętrznie używa dwóch znaczeń „ostatni”: §6.16 nazywa tak Results & Readiness, a §6.B umieszcza po nim Review. Bezpieczny model siedmiu etapów dodaje Recommendations i Review, pozostawiając `outputs` jako kompatybilny odpowiednik Results & Readiness. Pytanie do właściciela pozostaje jawne.

Korekta tezy instrukcji: spośród 19 paczek 14 ma pięć faz, jedna osiem, cztery po cztery; wszystkie pięć klocków SWOT ma konsumentów.

## R3 — CZĘŚCIOWE

Jedna flaga `VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES` jest fail-closed i domyślnie OFF. OFF zwraca ten sam obiekt pięciofazowy; ON układa `recommendations` przed `outputs` i `review` po nim oraz dodaje po jednej bramie. Testy flagi 3/3. Zmiana dotyczy packa/rejestru; realny store sesji nadal ma pięć kroków, więc nie ogłaszam pełnej budowy runtime.

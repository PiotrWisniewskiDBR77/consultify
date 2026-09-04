# Dyżur 353 — R4: orzeczenie per wiersz G19

| Moduł | Kubełek po R3 | Co zostało udowodnione | Czego dokładnie brakuje do podniesienia wiersza | Kto |
| --- | --- | --- | --- | --- |
| 01_ORGANIZATION | A → luka | `day307` przez ApiGateway/JWT/PG: workload obcy 404 (64 B), właściciel 200 (243 B), mutacja filtra → RED; `r2-day307-orzeczenie.md` | Rozliczenia pozostałego, rosnącego mianownika G19; jedna trasa workload nie pokrywa 106 plików/90 bez testów. Potrzebna reguła kotwicy i kontrakty dla pozostałych zmian. | osobne zlecenie + właściciel reguły |
| 02_INTERVIEW | C | Dzisiejsze wspólne Bloki 1–3: 131/131, 218/218, 18/18; `r3-piec-modulow-i-bloki.md` | Oczy właściciela na realnym rekordzie rozmowy: PL/EN, NModeLeftNav i formularze, po ustaleniu SHA kotwicy. | właściciel |
| 03_TOOLS | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym narzędziu: PL/EN, formularze współdzielone i ErrorState, z zapisanym rekordem i SHA. | właściciel |
| 04_ASSESSMENT | A → luka | Day274 2/2 i day275 1/1 na ApiGateway/PG | Mutacyjna obrona cross-org odczytu istniejącej oceny na `/api/v8/assessment/:id`; czerwony brief: `tests/unit/day353-g19-04-assessment.contract.test.ts`. | osobne zlecenie maszynowe |
| 05_INITIATIVES | A → luka | Day277 2/2: właściciel zapis/readback, obcy 404 | GREEN→RED→GREEN po usunięciu filtra organizacji z decision enhancements; czerwony brief: `tests/unit/day353-g19-05-initiatives.contract.test.ts`. | osobne zlecenie maszynowe |
| 06_EXECUTION | A → luka | Dropdown Execution 2/2 na jawnym PG | Para obcy/właściciel dla istniejącego execution case przez ApiGateway i mutacja filtra organizacji; czerwony brief: `tests/unit/day353-g19-06-execution.contract.test.ts`. | osobne zlecenie maszynowe |
| 07_MY_WORK_AGENT | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym rekordzie My Work: PL/EN i warunkowe renderowanie wspólnej powłoki, z zapisanym SHA. | właściciel |
| 08_MEETINGS | A → luka | Tylko wspólne bloki; R2 wykazał, że day307 nie wykonuje trasy Meetings | Para na `GET /api/meetings/:id` dla istniejącego spotkania: obcy 404, uprawniony właściciel niepuste 200; mutacja filtra `getMeeting`/`canAccessMeeting`. | osobne zlecenie maszynowe |
| 09_RESULTS | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym raporcie: HelpButton, ErrorState i PL/EN, z rekordem i SHA. | właściciel |
| 10_FINANCE | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym rekordzie finansowym: treść i stany warunkowe PL/EN, z zapisanym SHA. | właściciel |
| 11_MATERIALS | A → luka | Day276 deck 2/2, workbook 2/2; workbook odmawia obcemu | Mutacja filtra organizacji komendy workbook; dla deck także para obcy/właściciel; czerwony brief: `tests/unit/day353-g19-11-materials.contract.test.ts`. | osobne zlecenie maszynowe |
| 12_AUDITS | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym audycie: PL/EN, formularze i stany błędów/pustki, z zapisanym SHA. | właściciel |
| 13_CHAT | A → luka | Agent Hub limiter 9/9, ale wyłącznie kontrakt tekstowy | Realna para ApiGateway/JWT/PG dla istniejącej rozmowy lub agent planu i mutacja strażnika; czerwony brief: `tests/unit/day353-g19-13-chat.contract.test.ts`. | osobne zlecenie maszynowe |
| 14_ADMIN | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym koncie admin: PL/EN, HelpButton/ErrorState i dane warunkowe, z zapisanym SHA. | właściciel |
| 15_SETTINGS | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnych ustawieniach: PL/EN i formularze współdzielone, z zapisanym SHA. | właściciel |
| 16_PARTNER | C | Wspólne Bloki 1–3 zielone na markerze | Oczy właściciela na realnym rekordzie partnera w PL/EN; fikstura techniczna nie zastępuje rekordu odbiorowego. | właściciel |

## Liczby zbiorcze

- Wiersze domknięte maszynowo w rozumieniu całego G19: **0**.
- Wiersze, którym według hipotezy C brakuje wyłącznie wskazanego przelotu właściciela po zamrożeniu kotwicy: **9** (`02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16`).
- Wiersze z realną, nazwaną luką dowodową: **7** (`01`, `04`, `05`, `06`, `08`, `11`, `13`).

Klasyfikacja „wyłącznie właściciel” jest warunkowa względem decyzji o kotwicy: bez niej nawet poprawny przelot nie ma trwałego zakresu obowiązywania.

# RUNDA 3 — 02-moja-praca (05.09.2026, po naprawach)

Staging `GET /api/health` → **gitSha `b852ade6164e0dec755ea3ae0c59ec2f7ca3dc04`** — czyli **starszy** niz `5ffdabe05e`: naprawy SERWEROWE z 05.09 NIE dzialaja jeszcze na stagingu. Frontend localhost:3000 stoi na m03 @ `03c47ab29a` i ma komplet napraw frontendowych.

Sprawdzono ponownie **17** pozycji, ktore rano mialy werdykt `ROZNI_SIE` (plus `notebook-quick-capture`, gdzie obraz odniesienia okazal sie strona bledu przyrzadu). Kazda ma swiezy jasny zrzut 1440 (nadpisany `<id>.png`).

## Tabela

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| `notatnik-centrum-mysli` | ROZNI_SIE | **NOWY_WZORZEC** | Obraz = bitowy duplikat prototypu; realny panel ma naprawiona glowke „NOTEBOOK / Szczegoly notatki". |
| `idea-table-tool-grouping` | ROZNI_SIE | **DECYZJA** | Grupowanie dziala; brak wiersza filtrow per kolumna i gestosci — decyzja o silniku tabeli Pomyslow. |
| `mywork-idea-inspector-lekki` | ROZNI_SIE | **NOWY_WZORZEC** | Obraz = bitowy duplikat; realny lekki inspektor dziala i ma sekcje z licznikami. |
| `karta-decision` | ROZNI_SIE | **CZEKA_NA_SERWER** | Uklad zgodny; GET /api/decisions/:id/history nadal 404 — trasa dopisana dzis, staging na b852ade6. |
| `idea-templates-catalog` | ROZNI_SIE | **DECYZJA** | Kategorie, plakietki i licznik seeda dodane; zostaje pytanie, czy galeria ma pokazywac wszystkie 40 niezaleznie od kanwy. |
| `idea-table-tool-kebab` | ROZNI_SIE | **DECYZJA** | Menu komorki zamiast kebaba wiersza — ta sama decyzja o silniku tabeli. |
| `ideas-teresa-panel` | ROZNI_SIE | **NOWY_WZORZEC** | Obraz = bitowy duplikat; martwy IdeaRightPanel naprawiony — Menu 1 „Sugestie AI" montuje kanoniczny panel z Teresa. |
| `mywork-notebook-rail-speca` | ROZNI_SIE | **DECYZJA** | Glowka naprawiona; AKCJE i WLASCIWOSCI zostaja w fali 2 (DEC-354). |
| `idea-confidentiality-control` | ROZNI_SIE | **ZGODNY** | Prawy panel znow sie montuje i jest 1:1 z obrazem; pigulka poufnosci dziala (Standardowa/Poufna/Zastrzezona). |
| `idea-table-tool-empty-filter` | ROZNI_SIE | **ZGODNY** | Dwa stany pustki rozroznione — „Brak wynikow filtra" z liczba ukrytych wierszy i „Wyczysc filtr". |
| `idea-table-tool-sortfilter` | ROZNI_SIE | **DECYZJA** | Sortowanie i globalny filtr sa; wiersz filtrow per kolumna — decyzja o silniku tabeli. |
| `notebook-quick-capture` | ZGODNY | **NOWY_WZORZEC** | Obraz zatwierdzony to strona bledu przyrzadu — realny pasek „Wrzuc" trzeba pokazac od nowa. |
| `idea-table-tool-paste` | ROZNI_SIE | **DECYZJA** | Wklejanie nadal do jednej komorki — decyzja o silniku tabeli. |
| `exec-summary-onelook` | ROZNI_SIE | **NOWY_WZORZEC** | Zakladka „Kokpit" istnieje i deep-link dziala; obraz zatwierdzony to strona bledu przyrzadu. |
| `idea-table-record-templates` | ROZNI_SIE | **DECYZJA** | Kolizja nazw naprawiona („Szablony tabeli" vs wyszarzone „Szablony rekordow" z powodem); menedzer wymaga tabeli platformowej. |
| `idea-table` | ROZNI_SIE | **NOWY_WZORZEC** | Obraz to nieistniejacy juz przyrzad (TopBar + ArtifactRightPanel usuniete 01.09); realny podglad naprawiony dzis. |
| `decision-record` | ROZNI_SIE | **CZEKA_NA_SERWER** | To samo co karta-decision — 404 na historii decyzji, naprawa nie jest jeszcze na stagingu. |

## Bilans calego pakietu po rundzie 3

| Werdykt | Liczba |
|---|---|
| ZGODNY | 16 |
| DECYZJA | 7 |
| NOWY_WZORZEC | 6 |
| CZEKA_NA_SERWER | 2 |
| **Razem** | **31** |

## Pozostale `ROZNI_SIE` — specyfikacja dla robotnika

Brak.

## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| karta-decision | CZEKA_NA_SERWER | **ZGODNY** | GET /api/decisions/:id/history zwraca teraz 200 (0 błędów konsoli, wcześniej 2x404) — świeży zrzut karty decyzji zgodny z obrazem zatwierdzonym. |
| decision-record | CZEKA_NA_SERWER | **ZGODNY** | Ten sam komponent i ten sam rekord co karta-decision — history endpoint naprawiony, 0 błędów konsoli, zrzut zgodny z obrazem. |

# P10 — raport rundy 2 (DEC-411)

## Werdykt

**PARTIAL / NOT PROVEN.** Runda 2 usunęła błąd przyrządu z rundy 1 dla wielu kart: przy `--czekaj=6000` realnie otwarto 9 różnych typów kart/rekordów. Nie osiągnięto jednak bramki 22/22 ani kompletu rozwiniętych sekcji dla każdej karty, więc S1.13 pozostaje niespełnione.

## Mianownik po scaleniu

Test i rejestr po `c163c90a29` definiują **22**, nie 21 kart: 13 wpisów `REJESTR_KART_N` + 9 jawnych wyjątków. To 19 kart rundy 1 + nowa `roi_case` + `plan` + `capacity_analysis`. Nie usunięto ROI z mianownika tylko po to, by uzyskać 21/21.

## Przed → po

| miara | runda 1 | runda 2, stan tego raportu |
|---|---:|---:|
| pozycje inwentarza | 19 | 22 |
| realne typy kart otwarte z listy, URL ≠ `/login` | 1/19 | 9/22 |
| z błędami konsoli na końcowym bezpośrednim otwarciu | niepełny pomiar | 0 dla zaliczonych 9 |
| notification: sekcje poza zatwierdzonym kontraktem | 5 | 0 |
| task: puste warunkowe Pomysły/Ryzyko/RACI | 3 | 0 na realnym pustym rekordzie |
| kontrakty K1 wciągnięte do tabel P10 | 0/2 | 2/2 |
| test rejestru po merge | — | 3/3 PASS, 0 skipped |

Otwarte realnie: `notification`, `task`, `decision`, `note`, `idea`, `interview`, `insight`, `initiative`, `metric`. Dla `initiative` 24 sekcje kliknięto w czterech deterministycznych partiach; każdy JSON ma 0 błędów. Dla `task` kliknięto każdą pozostałą widoczną sekcję po naprawie. `metric` ma końcowy bezpośredni zrzut bez błędów, lecz próba przejścia wszystkich sekcji omyłkowo trafiła w globalne „Raporty”, więc komplet sekcji nie jest zaliczony.

## Naprawy Fazy B

- `notification`: widoczny prawy panel ograniczony do Akcji i Historii; Właściwości, Powiązania, Źródła i założenia, Rezultaty i Komentarze są odfiltrowane, ale kod nie został skasowany.
- `task`: Pomysły realizacji, Ryzyko i alternatywy oraz RACI i eskalacja pozostają w kontrakcie, ale nie renderują się bez danych; sekcja wraca, gdy odpowiednia kolekcja ma treść.
- K1: `insight.md` i `initiative.md` uzupełniono addytywnie o fakty z raportu K1.
- Inwentarz i tabele rozszerzono o `roi_case`, `plan`, `capacity_analysis`.

## Mutacje i testy

- notification: GREEN 2/2 → mutacja dodająca `properties` do widocznego zbioru → RED → final GREEN 5/5 razem z testem zakazu autosave.
- task: GREEN 7/7 → mutacja bezwarunkowo pokazująca `implementation` → RED → final GREEN razem z testem zapisu ryzyk.
- esbuild obu dotkniętych komponentów/helpera: exit 0.
- `check-list-canon`, `check-artefakt`, `check-teresa-kontrakty`: exit 0; ratchet długu bez wzrostu.
- pełny baseline 1/16 nadal OOM przy limicie 2 GB; wynik nie jest PASS. Ponowiony podział 1/64 z jednym workerem i limitem 1,5 GB nie został jeszcze domknięty; stan: `EVIDENCE_MISSING`.

## Sekcje bez writera — imiennie

- tool: Cel, Proces, Rezultat, Przykład — frontendowa treść statyczna; nowa decyzja o serwerowym katalogu w `99_DECYZJE`.
- vault-document: Streszczenie — placeholder bez potwierdzonego writera; zaakceptowany warunek CTO nie został jeszcze wdrożony.
- insight: pytanie przewodnie i notatka konsultanta mają writer i wpływają na prompt, ale karta ich nie czyta.
- initiative: Wymagania kompetencyjne i Luka kompetencyjna mają backend oraz komponent, ale brak podłączenia do realnej karty.

## Dowody rundy 2

Wszystkie nowe PNG mają szerokość 1440, motyw light i odpowiadający JSON. Najważniejsze komplety: `evidence/p10-karty-n/notification/runda-2-po.png`, `task/runda-2-po.png`, `decision/runda-2-komplet.png`, `idea/runda-2-open.png`, `interview/runda-2-open.png`, `insight/runda-2-open.png`, `initiative/runda-2-sekcje-{1..4}.png`, `metric/runda-2-direct.png`.

## Niezamknięte

Nie ma jeszcze poprawnego kompletu live dla: `action`, `tool`, `objective`, `roi_case`, `audit-criterion`, `audit-report`, `assessment-report`, `tool-document`, `presentation`, `meeting`, `vault-document`, `plan`, `capacity_analysis`; część otwartych kart wymaga też ponownego kliknięcia każdej sekcji osobno. Brakujące rekordy wolno utworzyć wyłącznie przez kontrakt produktu, zapisać ID, usunąć na końcu i potwierdzić licznik 0 — ta sekwencja nie została wykonana, więc nie ma deklaracji sprzątnięcia.

## Commity rundy 2

- `58ee98083c` — panel powiadomienia zgodny z decyzją DEC-411.
- `6bbb03e1a3` — puste sekcje warunkowe zadania ukrywane zgodnie z DEC-411.

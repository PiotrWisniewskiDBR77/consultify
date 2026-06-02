# Antygravity Chat Manual Session Playbook (2026-05-06)

Cel: przejsc z testerem manualnym Antygravity caly niedzialajacy test Chat i wygenerowac jednoznaczny wynik PASS/BLOCKED z dowodami.

Zakres: test 1:1 wedlug 8 obszarow z ostatniego raportu testera (chat podstawowy, deep thinking, kroki pracy, web research, historia, pytania produktowe, follow-up, jakosc i zaufanie).

Statusy:
- `PASS`
- `BLOCKED_P1`
- `BLOCKED_P0` (fake success, utrata historii, bledne zrodla krytyczne, petla deep thinking)
- `INCONCLUSIVE`

## 0) Setup sesji (10 min)

1. Wejdz na `https://demo.consultify.ai`.
2. Zaloguj konto testowe.
3. Otworz narzedzia developerskie (zakladki: Network, Console).
4. Przed testem wyczysc tylko cache przegladarki (bez resetu danych aplikacji), zeby nie maskowac bledow historii.
5. Ustal folder dowodow: `evidence/manual-chat-antygravity-2026-05-06/`.

Minimalny zestaw dowodow dla kazdego case:
- 1 screenshot UI.
- 1 screenshot panelu Sources (jesli wystepuje).
- 1 screenshot Network dla requestu AI/conversation (status + payload summary).

## 1) Podstawowy chat (DBR77/Consultify)

Prompty:
- `Opowiedz mi o DBR77`
- `Podsumuj czym jest Consultify`
- `Wyjasnij roznice miedzy DBR77 a Consultify`

Sprawdz:
- Czas odpowiedzi (target: pierwsze sensowne tokeny do 5-8s; calosc <= 12s).
- Brak surowych linii technicznych w odpowiedzi:
  - `Source ledger`
  - `Blocked scopes`
  - `rag_1` / `rag_*`
  - `artifact:comparison`
- Brak komunikatu `No cited sources` przy odpowiedzi bez cytowan.
- Jezeli sa cytowania: sa czytelne i klikalne, nie-smieciowe (`Source 1`, `rag_1`, `"[1]"` to fail).
- Odpowiedz merytoryczna i produktowa (DBR77-first, bez losowych stron zewn.).

Kryterium:
- `PASS` tylko gdy wszystkie 3 odpowiedzi przejda bez ww. artefaktow i bez nieadekwatnych zrodel.

## 2) Zwykly chat vs Deep Thinking / Show reasoning

Prompt porownawczy:
- `Porownaj mozliwe kierunki rozwoju marketplace DBR77`

Scenariusz:
1. Uruchom w trybie zwyklym.
2. Uruchom w Deep Thinking.
3. Uruchom w Show Reasoning.

Sprawdz:
- Deep Thinking nie wchodzi w petle pytan potwierdzajacych.
- Deep Thinking konczy realna analiza.
- Show Reasoning nie pokazuje surowego `artifact:comparison:{...}`.
- Roznica miedzy trybami jest czytelna (zwykly: krocej/szybciej; deep: glebiej/strukturalnie).

Kryterium:
- Jakakolwiek petla lub raw artifact = `BLOCKED_P0`.

## 3) Realne kroki pracy systemu

Prompty:
- `Wskaz obecnie najwieksza konkurencje dla DBR77 na rynku polskim i USA`
- (z zalacznikiem) `Przeanalizuj zalaczony plik i wyciagnij najwazniejsze wnioski`
- `Jak dziala [modul X] w systemie`

Sprawdz:
- Czy widoczne kroki sa realistyczne, nie fake-statusy.
- Czy przy niepewnosci system komunikuje ja uczciwie i rzeczowo.
- Czy odpowiedz nie halucynuje przy niedostepnym/uszkodzonym pliku.

Kryterium:
- Fake progress + brak realnej pracy na pliku = `BLOCKED_P1` lub `P0` (gdy udaje sukces).

## 4) Web / internet / research

Prompty:
- `Znajdz informacje o konkurencji DBR77`
- `Sprawdz biezace trendy w consultingu`
- `Powiedz cos wiecej o marketplace DBR77`

Sprawdz:
- Czy system odroznia wiedze modelu od danych z wyszukiwania.
- Czy zrodla sa relewantne do pytania i kontekstu DBR77.
- Czy brak wynikow jest komunikowany uczciwie (bez tekstow maskujacych prawdziwy blad).

Kryterium:
- Nietrafione, przypadkowe zrodla literalnie po slowach promptu = `BLOCKED_P1`.

## 5) Historia chatu i foldery

Scenariusz:
1. Zaloz nowa rozmowe.
2. Dodaj 2-3 wiadomosci.
3. Przejdz do innej rozmowy i wroc.
4. Odswiez strone.
5. Zmien nazwe rozmowy.
6. Przenies rozmowe do folderu.
7. Zaloz rozmowe od razu w aktywnym folderze.

Sprawdz:
- Czy historia i nazwa utrzymuja sie po refresh.
- Czy nie ma zawieszki `Ladowanie rozmowy...`.
- Czy rozmowy nie znikaja.
- Czy folder docelowy jest stabilny.

Kryterium:
- Utrata historii / brak otwierania rozmow = `BLOCKED_P0`.

## 6) Pytania produktowe / dokumentacyjne

Prompty:
- `Jak dziala modul feedbacku?`
- `Gdzie w systemie znajde marketplace?`
- `Jak dodac nowy element w tym obszarze?`

Sprawdz:
- Asystent odpowiada jak asystent produktu, nie jak ogolny chatbot.
- Odpowiedzi praktyczne, konkretne, z odniesieniem do realnych funkcji.

Kryterium:
- Odpowiedzi ogolne i nieuzyteczne bez kontekstu produktu = `BLOCKED_P1`.

## 7) Follow-up w jednym watku

Sekwencja:
- `Opowiedz mi o DBR77`
- `A powiedz wiecej o marketplace`
- `Jakie widzisz ryzyka tego kierunku?`

Sprawdz:
- Trzymanie kontekstu miedzy krokami.
- Brak resetu rozmowy "od zera".
- Zrodla adekwatne do poprzedniego kontekstu.

Kryterium:
- Cytowania niezwiązane z kontekstem (np. przypadkowe strony od "opowiedz mi") = `BLOCKED_P1`.

## 8) Jakosc odpowiedzi i zaufanie

Ocena 1-5:
- Wiarygodnosc
- Uzytecznosc
- Profesjonalny ton
- Stabilnosc funkcji
- Zaufanie do narzedzia

Pytania zamykajace sesje:
- Czy to narzedzie produkcyjne czy demo?
- Czy deep modes maja sensowna przewage?
- Czy historia jest intuicyjna i stabilna?
- Czy research jest wiarygodny?

Kryterium:
- Dla `GO` wymagane:
  - brak `BLOCKED_P0`,
  - max 1 `BLOCKED_P1`,
  - srednia jakosci >= 4.0/5.

## Tabela raportowa (do wypelnienia podczas sesji)

| Obszar | Status | Glowny wynik | Dowod (plik/link) | Priorytet |
| --- | --- | --- | --- | --- |
| 1. Podstawowy chat |  |  |  |  |
| 2. Deep Thinking / Reasoning |  |  |  |  |
| 3. Realne kroki pracy |  |  |  |  |
| 4. Web research |  |  |  |  |
| 5. Historia i foldery |  |  |  |  |
| 6. Produkt / dokumentacja |  |  |  |  |
| 7. Follow-up context |  |  |  |  |
| 8. Jakosc i zaufanie |  |  |  |  |

## Regula decyzji po sesji

- `NO-GO`: dowolny `BLOCKED_P0`.
- `NO-GO`: dwa lub wiecej `BLOCKED_P1`.
- `GO_WITH_RISK`: jeden `BLOCKED_P1` i zaakceptowany plan naprawczy.
- `GO`: brak `P0/P1`.


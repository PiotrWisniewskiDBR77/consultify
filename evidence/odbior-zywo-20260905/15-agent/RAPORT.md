# Odbiór na żywo 05.09 — pakiet 15 „Agent” (3 ekrany)

## Liczby
- ZGODNY: **3**
- ROZNI_SIE: **0**
- NIE_DOTARLEM: **0**

Wyniki: `evidence/odbior-zywo-20260905/15-agent/wyniki.json`. Zrzuty w tym samym katalogu.

## Różnice
Brak różnic dyskwalifikujących. Uwagi zapisane przy ekranach:
- **agent-hub** — tabela z obrazu (NAZWA/STATUS/POSTĘP/ZAPLANOWANY NA/OSTATNIE URUCHOMIENIE/CZAS WYKONANIA/DATA + pstryczek + kebab) jest w trybie „Archiwum procesów”, a wejściem domyślnym modułu jest tryb „Sprawy, akceptacje i wyniki” z inną, uboższą tabelą (MANDAT TRANSFORMACJI/STATUS/WERSJA/ETAPY, bez pstryczka i kebaba). Brakuje też linii „Sprawa: nie wybrano · Przebieg: nie wybrano”. Zapisany wyjątek o przyciętych nagłówkach kolumn i wartościach statusu potwierdza się co do joty.
- **agent-warsztat / agent-plan-canvas** — paleta klocków ma dokładnie te same sześć kategorii i te same liczniki co obraz (MODUŁY 11, AI/TERESA 3, DANE I VAULT 3, AUTOMATY 6, KONTROLA PRZEBIEGU 5, INTEGRACJE 8). Zapisane zgłoszenie właściciela o przesuwalnych klockach jak w N8N pozostaje niezrealizowane — kolejność zmienia się strzałkami góra/dół, nie przeciąganiem.
- Drobiazg językowy: w palecie klocek nazywa się „Vault — wybrany sejf”, a po wstawieniu na schemat jego nagłówek jest po angielsku „Vault — selected safe”.

## Nie dotarłem
Brak.

## Ile czasu i co było trudne
Około 25 minut. Trudność: tabela z zatwierdzonego obrazu nie jest domyślnym widokiem modułu — trzeba było przejść przez sześć trybów Menu 1, żeby ją znaleźć. Dowód działania klocka sejfu wymagał wstawienia klocka na schemat i wybrania sejfu; zrobiłem to wyłącznie lokalnie (schemat zapisuje się dopiero przyciskiem „Uruchom proces”, którego nie dotykałem), więc nic nie zostało zapisane w danych właściciela.

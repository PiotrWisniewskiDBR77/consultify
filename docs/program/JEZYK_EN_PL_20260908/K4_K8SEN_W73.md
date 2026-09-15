# K4 — K8sen W73: przesiew i realne ujścia

**Werdykt E1: READY FOR INDEPENDENT REVIEW.** Wszystkie 3183 pozycje wejściowego raportu mają deterministyczną klasę `(a)` albo `(b)`; nie ma pozycji bez klasy. Miernik K8sen spadł z 3183 do 0, a ratchet został zamrożony na 0.

## Pomiar i klasyfikacja

| Grupa | Liczba wystąpień | Klasa | Uzasadnienie |
|---|---:|---|---|
| zwykłe `throw new Error(...)` | 1627 | a | granica produkcyjna nie zwraca surowego tekstu |
| machine codes | 661 | a | identyfikator techniczny, nie proza |
| `config/` i `database/` | 27 | a | bootstrap/diagnostyka, bez ujścia HTTP/e-mail/PDF |
| sklejenia regexu przez newline | 12 | a | niemożliwy literał JS; regresja detektora dodana |
| diagnostyka strukturalna workerów | 6 | a | log/kod techniczny, bez prezentacji użytkownikowi |
| API/result `error` | 331 | b | pole odpowiedzi lub operacyjny `ValidationError` |
| API/result `message` | 506 | b | pole odpowiedzi/wyniku konsumowane przez UI |
| tematy e-mail | 8 | b | bezpośrednie ujście SMTP |
| tekst PPTX/PDF | 5 | b | bezpośredni tekst generowanego artefaktu |

Suma: `(a)=2333`, `(b)=850`, bez klasy `0`. Pełna lista `plik:linia`, tekst, klasa, ujście i powód znajduje się w `K4_K8SEN_W73_CLASSIFICATION.json`.

## Zachowanie

- 758 unikalnych komunikatów klasy `(b)` ma słownik EN/PL podzielony na 13 partii, każda zawiera najwyżej 60 literałów.
- Middleware JSON tłumaczy wyłącznie stringowe pola `message` i `error`. Nie zmienia `status`, `code`, pozostałych pól ani obiektów o specjalnym prototypie.
- Locale jest rozstrzygane jako: profil uwierzytelnionego użytkownika, potem `Accept-Language`, potem EN.
- Szablony zachowują wartości interpolowane. Matcher bilansuje zagnieżdżone `${...}` i ponownie wstawia wartości do polskiej wersji.
- Tematy e-mail są tłumaczone według `users.language` adresata; brak konta oznacza EN zgodnie z DEC-461.
- Wykryte teksty raportów PPTX/PDF używają języka raportu/użytkownika.
- Sześć komunikatów body-parser/multipart korzysta ze wspólnego słownika błędów i zachowuje dotychczasowe kody/statusy.

## Pomiar przed/po

| Miernik | Przed | Po | Delta |
|---|---:|---:|---:|
| K8sen | 3183 | 0 | -3183 |
| K8spl | 95 | 85 | -10 |

Spadek K8spl wynika z wyłączenia diagnostycznych `throw new Error(...)`; nie usunięto polskich wersji komunikatów użytkownika. Słowniki dwujęzyczne są świadomie maskowane przez miernik.

## Dowody

- focused detector/API/error tests: 87/87 PASS, `--retry=0`;
- e-mail recipient-locale behavior: 1/1 PASS, `--retry=0`;
- pełny plik e-mail ma dwa istniejące czerwone testy formatowania pola `from` (`"Consultify" <...>` vs stara asercja surowego adresu); nowy test locale przechodzi;
- server TypeScript: 0 błędów;
- frontend TypeScript: 177 istniejących błędów, 0 w plikach paczki; `--listFilesOnly`: 7427, RC 0;
- `check:jezyk:ci`: PASS, K8sen baseline 0;
- `check:list-canon`: 349/349;
- `check:artefakt`: crimson 8/8, R2+R3 0/0, danger 117/117;
- build produkcyjny: PASS, 10754 moduły;
- nowe `as any`: 0.

## Ograniczenie jakościowe

Próbka 30 równomiernie rozłożonych tłumaczeń została przeczytana ręcznie; osiem niezręcznych tłumaczeń poprawiono przed freeze. Pełny katalog pozostaje przedmiotem niezależnego sceptycznego review. Nie wykonano deployu ani migracji.

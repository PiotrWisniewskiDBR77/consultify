# P10 — nowe decyzje właściciela po rundzie 2

19 pytań z rundy 1 rozstrzygnięto zgodnie z rekomendacjami i nie są tu powtarzane. Poniżej wyłącznie nowe pytania ujawnione przez scalony raport K1 i nowe karty DEC-421/422.

| karta | rozjazd | rekomendacja | co się stanie po „Tak” |
|---|---|---|---|
| tool | Jaki trwały kontrakt ma zasilać statyczne sekcje Cel, Proces, Rezultat i Przykład? | Tak dla serwerowego katalogu treści; nie zmieniać definicji writera tak, by statyczny literał frontendu udawał zapis produktu. | Powstanie wersjonowany, serwerowy katalog i cztery sekcje przestaną być martwą treścią frontendową. |
| insight | Czy karta wyniku ma pokazywać pytanie przewodnie i notatkę konsultanta, które sterowały AI? | Tak, jako jawny odczyt źródłowej instrukcji, bez pomylenia jej z wygenerowanym wynikiem. | Dwa już utrwalane pola staną się widoczne na karcie wniosku. |
| insight | Czy usunąć z realnego ekranu Memo zarządcze i Rekomendacje, których kontrakt po deduplikacji już nie zawiera? | Tak; nie wskrzeszać duplikatów w kontrakcie. | `INSIGHT_SECTIONS` przestanie renderować dwie sekcje spoza kontraktu. |
| initiative | Czy podłączyć Wymagania kompetencyjne i Lukę kompetencyjną do karty inicjatywy? | Tak; backend, prompt i komponent już istnieją, brakuje realnego renderu. | Dwie sekcje kontraktu staną się osiągalne z karty realnego rekordu. |
| initiative | Czy zmienić etykietę scalonej sekcji „Kryteria sukcesu”, aby obejmowała Stan docelowy i Zakres? | Tak — „Stan docelowy i zakres”; nie rozdzielać danych bez potrzeby. | Etykieta realnego ekranu przestanie przeczyć dwóm kartom kontraktu. |

# P10 — decyzje właściciela

Każdy wiersz zawiera jedno pytanie. Brak odpowiedzi nie zatrzymuje pozostałej pracy; oznacza, że wskazanej zmiany treści nie wolno wdrożyć w ciszy.

| karta | rozjazd | rekomendacja | co się stanie po „Tak” |
|---|---|---|---|
| action | Czy zatwierdzić proponowany kontrakt jednej zwartej karty działania? | Tak — opis, źródło, właściciel/termin i akcje. | Kontrakt zostanie zapisany i dopiero wtedy ekran będzie można egzekwować. |
| notification | Czy usunąć z karty sekcje spoza kontraktu: Właściwości, Powiązania i Komentarze? | Tak, o ile nie rozszerzamy kontraktu. | Sekcje przestaną być widoczne; ich kod nie zostanie skasowany. |
| notification | Czy „Źródła i założenia” oraz „Rezultaty” mają wejść do kontraktu? | Nie; rekomenduję ukrycie ich bez treści i osobną decyzję o rozszerzeniu kontraktu. | Po Tak kontrakt dostanie obie sekcje i wymagane writery. |
| notification | Czy sekcja Analiza AI ma być obowiązkowa dla powiadomień bez kontekstu AI? | Nie — pozostawić warunkową i niewidoczną bez danych. | Po Tak każdy typ powiadomienia będzie musiał dostać writer analizy AI. |
| note | Czy zatwierdzić kontrakt: Dokument notatki → Powiązania → Historia wersji? | Tak. | Trzy zastane sekcje staną się wiążącym kontraktem. |
| idea | Czy zatwierdzić kontrakt: Płótno → Szczegóły elementu → Teresa? | Tak. | Warsztat pomysłu i inspector będą objęte jednym kontraktem. |
| metric | Czy zatwierdzić kontrakt: Definicja KPI → Wartości i okresy → Odchylenia/karty działania? | Tak. | Karta miernika wejdzie do egzekwowanego katalogu. |
| objective | Czy zatwierdzić kontrakt: Cel i właściciel → Kluczowe rezultaty → Postęp i historia? | Tak. | Karta celu OKR wejdzie do egzekwowanego katalogu. |
| audit-criterion | Czy zatwierdzić kontrakt: Kryterium → Ocena → Dowody → Ustalenia? | Tak. | CriterionWorkspaceV2 dostanie jawny porządek sekcji. |
| audit-report | Czy zatwierdzić kontrakt: Podsumowanie → Ustalenia i ryzyka → Rekomendacje? | Tak. | Raport audytu dostanie wiążący kontrakt treści. |
| tool-document | Czy zatwierdzić kontrakt: Nagłówek/status → Treść → Źródła/lineage? | Tak. | ToolDocumentView zostanie objęty kontraktem karty N. |
| presentation | Czy zatwierdzić kontrakt: Slajdy → Narracja/źródła → Motyw/eksport? | Tak. | DeckBuilder dostanie jawny kontrakt sekcji. |
| meeting | Czy zatwierdzić kontrakt: Informacje → Agenda/notatki → Decyzje/działania? | Tak. | MeetingObjectPage dostanie wiążący kontrakt. |
| vault-document | Czy zatwierdzić kontrakt: Treść/podgląd → Metadane → Streszczenie? | Tak, ale tylko po dodaniu writera streszczenia. | Pusty placeholder streszczenia nie będzie legalnym stanem. |
| tool | Czy dopuścić cztery sekcje statyczne bez writera `server/src` jako jawny wyjątek? | Nie; rekomenduję serwerowy katalog treści lub zmianę definicji writera. | Po Tak kontrakt zapisze wyjątek i przestanie wymagać serwerowego writera dla treści referencyjnej. |
| task | Czy sekcje Pomysły realizacji, Ryzyko i alternatywy oraz RACI mają pozostać mimo niepełnego kontraktu writerów? | Tak, pod warunkiem wskazania trwałych pól i writerów. | Sekcje dostaną egzekwowalne źródła danych; bez danych będą ukrywane. |
| wszystkie poza powiadomieniem | Czy zaakceptować odbiór bez zrzutu otwartego realnego rekordu, gdy hub/lista pozostaje na „Ładowanie…” albo nie ma seeda? | Nie. | Po Tak byłby to wyjątek od bramki wizualnej; rekomendacja pozostaje: naprawić stanowisko/dane i powtórzyć pomiar. |
| insight i initiative | Czy zaakceptować zagregowane wiersze sekcji bez raportu K1? | Nie. | Po Tak odstąpilibyśmy od wymogu „wiersz per sekcja”; rekomendacja: wciągnąć K1 albo rozpisać każdą sekcję osobno po działającym runtime. |


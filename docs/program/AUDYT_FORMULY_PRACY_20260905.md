---
doc_id: audyt-formuly-pracy-20260905
status: report
truth_type: program-status
established: 2026-09-05 (wieczór)
author: CTO (Fable)
---

# Audyt „pełnej formuły pracy” w 16 narzędziach — czego jeszcze brakuje

**Co znaczy „pełna formuła pracy” narzędzia** (miara użyta w audycie, wywiedziona z Wyników, gdzie formułę domknęliśmy dziś):
1. **Cel i podmiot** — po co narzędzie istnieje i dla kogo (proces / człowiek / inwestycja / klient).
2. **Konstrukcja poziomów** — tabela (rejestr) → raport/zbiór → karta N; ile poziomów i dlaczego.
3. **Definicja karty N** — sekcje, kolejność, co jest w prawym panelu.
4. **Mechanika** — co się dzieje samo: wyzwalacz → sygnał → osoba → karta działania (albo odpowiednik: zatwierdzenie, konwersja, publikacja).
5. **Wzorzec danych** — elementy obiektu wymienione z nazwy, źródła, rodowód, co jest wersjonowane.
6. **Kanon graficzny potwierdzony** przez właściciela na zrzucie (nie tylko opis).
7. **Przepływ klikany** zdefiniowany krokami (scenariusz konsultanta) i mierzalny.
8. **Jedno źródło prawdy** — jeden plik, do którego się wraca, zamiast piętnastu rozmów.

Legenda: **✓** jest · **◐** częściowo · **✗** brak.

## Tabela per narzędzie

| Moduł | 1 Cel | 2 Poziomy | 3 Karta N | 4 Mechanika | 5 Dane | 6 Kanon | 7 Przepływ | 8 SSOT | Czego brakuje (jednym zdaniem każde) |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| Czat | ✓ | ✓ | n/d | ✓ | ✓ | ✓ (zamrożony) | ◐ | ✓ `01_czat/SSOT.md` | Przepływ „Teresa rozpoznaje sprawę → proponuje założenie” (DEC-396) niewykonany — fala 2; dane testowe w historii do sprzątnięcia (P8). |
| Moja Praca | ✓ | ✓ (lista → rekord → płótno) | ✓ (jeden panel, dziś) | ◐ | ◐ | ✓ (zamrożony) | ◐ | ◐ `02_moja-praca/SSOT.md` + blueprint idei | Brak zapisanej **mechaniki Skrzynki** (co i kiedy do niej trafia — musi przyjąć zgłoszenia z Wyników); brak formuły **cyklu decyzji** (karta decyzji: propozycja → rozstrzygnięcie → skutek); konwersja pomysł → inicjatywa opisana, ale bez mierzalnego przepływu; elementy notatki/pomysłu nie są spisane z nazwy jak elementy miernika. |
| Wywiad | ✓ | ✓ (6-etapowy potok) | ✓ | ◐ | ✓ | ✓ (zamrożony) | ◐ | ✓ `03_wywiad/SSOT.md` | Dwie nawigacje tego samego potoku (Menu 2 + stepper) bez decyzji, która rządzi; brak zapisanego **warunku zamknięcia wywiadu** (co musi być, by wnioski poszły dalej); przepływ wniosek → inicjatywa opisany w kanonie inicjatyw, nie klikany. |
| Narzędzia | ✓ | ✓ (biblioteka → sesja → artefakt) | ◐ | ◐ | ◐ | ✓ (zamrożony) | ✗ | ◐ `04_narzedzia/SSOT.md` | Brak listy, **które narzędzia są w MVP** (dziś aktywny tylko Dynamic SWOT, Megatrendy martwe); brak jednolitej formuły „sesja narzędzia → artefakt → co dalej” dla każdego narzędzia; licencjonowanie (bramka na zapisie efektów, 31.08) opisane, niezaimplementowane jako funkcja. |
| Ocena | ✓ | ✓ | ✓ (macierz = sedno) | ◐ | ✓ | ✓ (zamrożony) | ◐ | ✓ kontrakt + kanon macierzy | Brak mechaniki **ocena → inicjatywy** (co z luki DRD staje się propozycją, kto zatwierdza); treść komórek macierzy do korekty wg kanonu (dane); warsztat SIRI = fala 2. |
| Inicjatywy | ✓ | ✓ | ✓ (24 sekcje) | ✓ (bramki cyklu) | ✓ | ✓ (zamrożony) | ◐ | ✓ `initiatives-execution-canon/` (12 plików) | Po zdjęciu Projektów brak decyzji, **co grupuje inicjatywy** (program? portfel? nic?); powiązania z KPI Wyników i business case Finansów opisane, nieklikane; karta w 100 % po angielsku (P3). |
| Realizacja | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ (zamrożony) | ◐ | ✓ (ten sam kanon) | Brak mechaniki **odchylenia wykonania** (opóźnienie/przeciążenie → sygnał → osoba → działanie) analogicznej do Wyników; historia KPI w Rollout bez danych; Kokpit zatwierdzony „bo nie chcę tracić czasu” — formuła kokpitu (pięć pytań) bez potwierdzenia treści. |
| Wyniki | ✓ | ✓ (3/3/2) | ✓ | ✓ | ✓ (z arkusza) | ◐ (do prototypu) | ✓ (opisany) | ✓ `SSOT_WYNIKI_KPI_OKR_ROI.md` | Tylko wykonanie (P7K A/B/C) + prototyp do akceptu; e-mail w zgłoszeniu do potwierdzenia. **Wzorzec domknięcia formuły dla reszty.** |
| Finanse | ✓ | ✓ (tabela → karta) | ◐ | ◐ | ✓ (sprawozdanie = dokument bazowy, rodowód) | ✗ | ✓ (przepływ CFO) | ◐ `FINANSE_ZALOZENIA_CTO_20260905.md` (projekt, nie SSOT) | Założenia czekają na słowo właściciela → SSOT; łańcuch 6 ogniw niezbudowany (program F); brak zatwierdzonego wyglądu tabeli finansowej (prototyp); rozliczenie korzyści = target. |
| Materiały (Dokumenty · Tabele · Prezentacje · Biblioteka) | ✓ | ✓ (biblioteka → artefakt) | ✓ (SPEC-A, 5 archetypów) | ◐ | ◐ | ✓ (zamrożony) | ◐ | ◐ 4 katalogi `09–12` + SPEC-A | **Największa luka jakościowa programu**: brak standardu „dobry dokument/prezentacja z szablonu” zaakceptowanego na realnym pliku (największa obawa właściciela z pamięci: nigdy nie powstał naprawdę dobry dokument z szablonu, PPT nigdy); brak formuły **publikacji** (kto, kiedy, wersja, odbiorca); wizja Gamma (trzy filary) nie ma SSOT. |
| Audyty | ✓ | ✓ (5 powierzchni) | ✓ | ◐ | ✓ | ✓ (zamrożony) | ◐ | ✓ kontrakt | Brak mechaniki **niezgodność → działanie** (audyt znajduje niezgodność kryterium → kto, co, termin — ta sama karta działania co w Wynikach); raporty DRD dopiero podłączone. |
| Spotkania | ✓ | ✓ (lista → spotkanie) | ◐ | ◐ | ◐ | ✓ (zamrożony) | ✗ | ✓ kontrakt | Brak formuły **spotkanie → decyzje/zadania → Moja Praca** (co powstaje po spotkaniu i gdzie ląduje); źródło transkrypcji/nagrania niezdecydowane; blok AI po angielsku. |
| Organizacja | ✓ | ✓ (redesign 11 ekranów) | ✓ | ◐ | ✓ | ✓ (zamrożony) | ◐ | ✓ kontrakt | Brak zapisanego **użycia kontekstu organizacji** przez Teresę i narzędzia (co z profilu wpływa na oceny, inicjatywy, finanse); miernik kompletności („0/2 pola”) bez definicji, co znaczy „gotowość decyzyjna”. |
| Panel Administratora | ✓ | ✓ | n/d | ✓ | ✓ | ✓ (zamrożony) | ◐ | ✓ kontrakt | 4 ekrany platformy nieodebrane (konto superadmina); brak formuły onboardingu nowej organizacji krok po kroku. |
| Ustawienia | ✓ | ✓ | n/d | ✓ | ✓ | ✓ (zamrożony) | ✓ | ✓ | — (MFA bez konta z MFA: naprawione wcześniej? do potwierdzenia w przepływie). |
| Partnerzy | ◐ | ✓ | ◐ | ◐ | ◐ | ✓ (zamrożony) | ✗ | ◐ kontrakt | Brak decyzji o **modelu komercyjnym** (marketplace, rozliczenia, RaaS) — bez niej portal jest powłoką; poza rdzeniem doradczym, kandydat do fali 2. |
| Agent (poza MVP) | ✓ | ✓ (plan → etapy) | ◐ | ✗ | ◐ | ◐ | ✗ | ◐ `AGENT_RUNTIME.md` | 0/15 etapów z wykonawcą, worker wyłączony, producent rozpoznawania sprawy niezbudowany — fala 2 (decyzja właściciela). |

## Luki przekrojowe (dotyczą kilku narzędzi naraz — to one blokują „pełną formułę” bardziej niż braki w pojedynczym module)

1. **Kręgosłup wartości nie ma jednego dokumentu.** Wywiad → Ocena → Pomysł → Inicjatywa → Realizacja → Wyniki → Finanse → Materiały: każdy moduł opisuje swoje wejście i wyjście osobno; nie ma jednej strony „jak obiekt przechodzi przez system i co się przy tym zapisuje” (konwersje, rodowód między modułami, kto zatwierdza przejście). Bez tego przepływy klikane (paczka III) będą testować moduły, nie doradztwo.
2. **Jedna mechanika „coś jest źle → ktoś ma działać”** jest zdefiniowana tylko dla Wyników. Realizacja (opóźnienie), Audyty (niezgodność), Finanse (niespójność bilansu, odchylenie od planu), Wywiad (wniosek wymaga decyzji) potrzebują tej samej karty działania i tej samej Skrzynki. Decyzja CTO: **karta działania z Wyników staje się komponentem wspólnym**, Skrzynka Mojej Pracy jest jedynym miejscem zgłoszeń.
3. **Elementy obiektu spisane z nazwy** istnieją dla miernika (arkusz), celu (tabela OKR), analizy ROI (metodyka). Brakuje ich dla: pomysłu, notatki, decyzji, inicjatywy (kanon ma 24 sekcje, ale nie „elementy”), spotkania, dokumentu. Bez listy elementów nie ma pełnej karty ani tabeli.
4. **Standard treści generowanej** (dokument, prezentacja, raport z oceny, raport zarządczy) nie ma ani jednego zaakceptowanego wzorca „tak ma wyglądać skończony plik”. To jest luka, którą właściciel nazwał swoim największym strachem.
5. **Rola Teresy per narzędzie** — zasada „jedna Teresa jako zakładka” jest, ale nie ma listy, co Teresa robi w każdym narzędziu (objaśnia / proponuje / wykonuje / nigdy nie fabrykuje) — bez tego każdy moduł wymyśla ją inaczej.
6. **Pomiar ciemnego motywu, klawiatury i superadmina** = 0 (paczka IV).

## Co z tego wynika — kolejność domykania formuł (propozycja CTO, bez pytań do właściciela poza jednym)

| Krok | Co | Dlaczego teraz | Nakład |
| :-: | --- | --- | :-: |
| 1 | **Kręgosłup wartości** — jedna strona SSOT: obiekty, konwersje, rodowód, zatwierdzenia między modułami | odblokowuje przepływy III i porządkuje 5 luk modułowych naraz | 1 dzień CTO + zatwierdzenie zrzutu schematu |
| 2 | **Karta działania jako komponent wspólny + Skrzynka jako jedyny odbiornik** (formuła z Wyników) | domyka mechanikę w Wynikach, Realizacji, Audytach, Finansach | w P7K część B jako komponent współdzielony (+1 dzień) |
| 3 | **Finanse: założenia → SSOT** po słowie właściciela; prototyp tabeli finansowej | drugi moduł z pełną formułą; program F czeka | 0,5 dnia + „jedziemy” |
| 4 | **Elementy obiektu** dla pomysłu, decyzji, inicjatywy, spotkania, dokumentu — po jednej tabeli jak dla miernika | bez tego karty N są nieskończone | 2 dni, z kanonu i kontraktów, do korekty właściciela jednym zdaniem per obiekt |
| 5 | **Materiały: jeden dokument i jedna prezentacja jako wzorzec „tak ma wyglądać”** z realnych danych DBR77, zaakceptowane jako plik | największa obawa właściciela | prototyp 2 dni + akcept |
| 6 | Narzędzia: lista MVP + formuła „sesja → artefakt → dalej” per narzędzie; Spotkania: formuła po spotkaniu; Organizacja: użycie kontekstu | mniejsze, ale bez nich moduły są powłokami | 0,5 dnia każdy |

**Jedyne pytanie do właściciela w tym audycie (kierunek produktu):** po zdjęciu Projektów — czy inicjatywy grupujemy w cokolwiek (program / portfel), czy MVP działa na płaskiej liście inicjatyw. Reszta jest do rozstrzygnięcia przez CTO z dokumentów.

---
document_id: ASSESSMENT-QUESTION-HELP-CONVERSATION-STANDARD
module: Assessment
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
reference_runtime: original DRD MaturityMatrix / LevelDetailCard
---

# Assessment — help do pytań i rozmowa z Teresą

## 1. Cel

Użytkownik nie musi znać metodyki ani umieć odpowiedzieć na każde pytanie.
Workbench ma pomóc mu zrozumieć pytanie, rozpoznać potrzebną wiedzę, znaleźć
właściwy dowód lub osobę oraz przeprowadzić rozmowę bez wymuszania odpowiedzi.

Help nie jest dodatkiem do pustego formularza. Jest częścią kontraktu każdego
pytania i poziomu w Method Pack.

## 2. Wnioski z najstarszego edytora DRD

Najstarszy `MaturityMatrix` i pierwsza wersja `DRDAssessmentEditor` zawierały
wartościowy wzorzec, który zachowujemy:

- stały progress i agenda obszarów;
- skupienie na jednym wybranym obszarze;
- pełny opis każdego poziomu zamiast samego numeru;
- trzy pytania walidacyjne per poziom;
- przykład i sugerowane technologie;
- komentarz/rationale per poziom;
- załączniki per poziom;
- Actual, Target i N/A jako oddzielne decyzje;
- AI Assist w kontekście aktualnego obszaru;
- możliwość powrotu do wcześniej ocenionego obszaru;
- graficzne sygnały ukończenia i postępu.

Nie przenosimy bez zmian:

- automatycznego wpisywania przez AI notatki po samym kliknięciu score;
- wolnego pola AI, które zwraca level bez formalnego evidence mapping;
- uznania trzech pytań yes/no za pełny scoring;
- jednego `Yes (in place)` bez stanu częściowego, braku wiedzy i dowodu;
- osobnego framework-specific shellu.

## 3. Cztery poziomy pomocy

### 3.1 Inline help — zawsze dostępny

Bez opuszczania pytania użytkownik widzi:

- krótkie `Co to znaczy?`;
- `Dlaczego o to pytamy?`;
- definicje pojęć i glossary tooltip;
- zakres: czego pytanie dotyczy i czego nie dotyczy;
- przykład odpowiedzi potwierdzającej i niepotwierdzającej;
- typowe artefakty dowodowe;
- typowy błąd interpretacyjny.

### 3.2 Level help — przy porównywaniu poziomów

Pokazuje pełny descriptor, wymagane atrybuty, różnicę L-1/L/L+1, przykłady,
expected evidence, coverage/prerequisites oraz wspólne pułapki scoringowe.

### 3.3 Method help — instrukcja pracy

Zawiera cel metody, sposób udzielania odpowiedzi, zasady evidence, skalę,
przykład kompletnej jednostki, legal/licence notice i link do pomocy/video.

### 3.4 Teresa — pomoc konwersacyjna

Użytkownik może powiedzieć własnymi słowami:

- „nie rozumiem pytania”;
- „nie wiem, czy to u nas istnieje”;
- „kto powinien na to odpowiedzieć?”;
- „mamy system X, czy to wystarczy?”;
- „pokaż różnicę między poziomem 2 i 3”;
- „jaki dowód będzie wiarygodny?”;
- „zadaj mi łatwiejsze pytanie”;
- „podsumuj, co już wiemy”.

Teresa odpowiada w kontekście aktualnej metody, jednostki, poziomu i
zaakceptowanych odpowiedzi. Następnie może zadać jedno pytanie doprecyzowujące,
utworzyć evidence request albo zaproponować rozmówcę. Nie opuszcza Method Pack.

## 4. Uczciwe „nie wiem”

Każde pytanie oferuje:

- `Potwierdzone`;
- `Częściowo`;
- `Nie`;
- `Nie wiem / potrzebuję pomocy`;
- `Nie mam dowodu`;
- `Nie dotyczy` z uzasadnieniem.

`Nie wiem` nie jest błędem użytkownika i nie daje zera. Otwiera Resolution Card:

1. czego dokładnie nie wiemy;
2. kto prawdopodobnie posiada wiedzę;
3. jaki artefakt może rozstrzygnąć;
4. możliwość `Assign question`, `Request evidence`, `Ask Teresa`, `Return later`;
5. termin i wpływ na możliwość freeze.

Assignment trafia do My Work/Notifications i prowadzi deep linkiem dokładnie do
pytania. Workbench nie tworzy osobnego lokalnego systemu zadań.

## 5. Kontrakt treści help w Method Pack

Każde pytanie musi posiadać:

- `question_id`, intent i canonical wording;
- plain-language explanation;
- why-it-matters;
- terms/glossary refs;
- positive, partial i negative answer examples;
- expected evidence;
- likely respondent roles;
- follow-up routes;
- level/attribute mapping;
- common misunderstanding;
- allowed Teresa capabilities;
- source refs i licence rule.

Jeżeli treści brakuje, UI pokazuje jawne `Help content unavailable`; Teresa nie
uzupełnia luki własną metodologią.

## 6. UX pytania

Primary card pokazuje tylko to, co potrzebne do odpowiedzi. Help otwiera się
progresywnie:

1. krótkie wyjaśnienie inline;
2. expandable `Przykład i dowody`;
3. compare levels drawer;
4. rozmowa z Teresą w prawym panelu.

Powrót z help nie resetuje odpowiedzi. Otwarty kontekst Teresy pozostaje
przypięty do question id. Na macierzy ikona help/evidence gap pozwala wejść
bezpośrednio do nierozstrzygniętego pytania.

## 7. Zasady rozmowy

- Teresa najpierw odpowiada na wątpliwość, potem zadaje następne pytanie;
- tłumaczy prostym językiem, ale nie spłaszcza definicji metody;
- przykład oznacza jako przykład, nie stan organizacji;
- rozpoznaje niepewność i nie przekłada jej na pewny score;
- może zaproponować likely respondent, ale użytkownik/owner przypisuje osobę;
- wskazuje, które informacje są deklaracją, a które dowodem;
- zachowuje conversation summary jako proposal do notatki, wymagający akceptacji;
- nie przesłuchuje serią długich pytań ani nie pokazuje całego QBank naraz.

## 8. Kryteria odbioru

1. Każde pytanie ma inline explanation oraz źródło.
2. Użytkownik może bez kary wybrać `Nie wiem`.
3. Teresa potrafi wyjaśnić, porównać poziomy i wskazać evidence.
4. Help jest kontekstowy dla question/unit/level.
5. Odpowiedź z rozmowy jest proposalem, nie cichym zapisem.
6. Missing knowledge/evidence tworzy kontrolowany follow-up.
7. Macierz prowadzi do dokładnego pytania wymagającego pomocy.
8. Najstarszy DRD flow ma test regresyjny: area → level descriptor → helper
   questions → comment → attachment → matrix → reopen/edit.

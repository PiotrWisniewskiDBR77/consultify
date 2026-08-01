---
document_id: CANVAS-COMPLETE-PRODUCT-CONTRACT
surface: Canvas
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Canvas — kompletny kontrakt produktu

## 1. Definicja

Canvas jest trwałym obszarem pracy otwieranym obok rozmowy z Teresą. Rozmowa
jest miejscem ustalania intencji, pytań i kierunku; Canvas jest miejscem, w
którym powstaje, dojrzewa i zostaje zatwierdzony rezultat pracy.

```text
rozmowa -> myślenie -> roboczy artefakt -> review -> zatwierdzony output
         -> decyzja / inicjatywa / task / materiał / dalsza praca w module
```

Canvas nie jest osobnym modułem głównego menu, drugim chatem, tylko podglądem,
uniwersalnym whiteboardem ani technicznym edytorem JSON. Jest wspólnym
artefaktem całej aplikacji.

## 2. Rozstrzygnięcie nazewnicze

W Consultify istnieją dwa różne pojęcia, których nie wolno mieszać:

- **Business Work Canvas** — prawy obszar pracy przy Chacie, opisany tutaj;
- **canvas-based tools** — przestrzenne płótna Mind Map, Whiteboard i Process
  Flow w Ideas oraz wizualizacje narzędziowe.

Business Work Canvas może osadzić lub otworzyć natywny artefakt wizualny, ale
nie przejmuje jego silnika edycji. Typ `table` używa semantyki danych, a nie
metafor pan/zoom płótna.

## 3. Obietnica dla użytkownika

Użytkownik może:

1. zacząć od pustego artefaktu, template, rozmowy, zaznaczenia lub obiektu z
   aplikacji;
2. pracować ręcznie albo wspólnie z Teresą;
3. zobaczyć źródła, założenia i status jakości;
4. poprawiać fragment bez regenerowania całego rezultatu;
5. porównać propozycję AI z wersją obecną;
6. wrócić do wcześniejszej wersji;
7. przekazać wynik do właściwego modułu bez utraty lineage;
8. pobrać, pokazać lub udostępnić wynik zgodnie z ACL.

## 4. Typy artefaktów

| Rodzina | Przykłady | Kanoniczny format | Docelowy edytor |
| --- | --- | --- | --- |
| writing | notatka, brief, memo, plan, raport | Markdown | rich document editor |
| decision | decision memo, options, recommendation | Markdown + typed metadata | document + decision blocks |
| research | research brief/report, sources, claims | Markdown + evidence graph | research workspace |
| data | tabela, model, dashboard, analiza | JSON/native + Markdown projection | table/sheet runtime |
| visual | diagram, mapa, proces, whiteboard | JSON/native + Markdown projection | właściwy visual runtime |
| presentation | outline, deck, slajdy | JSON/native + Markdown projection | presentation runtime |
| workflow | wieloetapowa praca z approval i outputami | typed workflow state | workflow ledger |

Zasada zapisu: `Markdown-first, JSON-when-native, always Markdown projection`.
Markdown obsługuje chat, search, RAG, review i prosty eksport. JSON jest prawdą
struktur, których Markdown nie potrafi wiernie reprezentować.

## 5. Sposoby rozpoczęcia

### 5.1 Z rozmowy

Teresa rozpoznaje, że odpowiedź jest wystarczająco duża lub wymaga dalszej
edycji, proponuje „Otwórz w Canvasie” i wyjaśnia proponowany typ. Nie może
otworzyć pustego artefaktu udającego gotowy rezultat.

### 5.2 Z template

Użytkownik wybiera cel biznesowy, nie technologię. Minimum template MVP:

- zbierz myśli;
- dokument/brief;
- research;
- decision memo;
- plan wykonania;
- prezentacja;
- analiza tabelaryczna.

Template ma ownera, wersję, język, opis zastosowania, wymagane wejścia i
capability status.

### 5.3 Z obiektu aplikacji

Canvas może otworzyć kontrolowaną kopię roboczą albo widok powiązany z:
Interview, Tools, Assessment, Audit, Initiatives, Execution, Results/KPI,
Finance, Materials, Notes, Meeting, Client Vault, Tasks i Decisions. Ekran
zawsze pokazuje, czy treść jest snapshotem, projection czy live-linked data.

### 5.4 Z pliku lub integracji

Import przechodzi przez skan bezpieczeństwa, klasyfikację, ekstrakcję,
provenance i preview. Podłączenie przez wspólną platformę connectorów działa w
zakresie nadanym danemu połączeniu; Canvas nie otrzymuje domyślnie całego dysku,
maila ani repozytorium.

## 6. Pełny lifecycle

```text
empty/seeded -> draft -> ready_for_review -> in_review -> changes_requested
             -> approved -> published/materialized -> superseded/archived
```

- `draft`: edytowalna praca bez deklaracji kompletności;
- `ready_for_review`: autor zakończył własną kontrolę jakości;
- `in_review`: wskazany reviewer ocenia konkretną wersję;
- `changes_requested`: uwagi blokują zatwierdzenie;
- `approved`: zatwierdzona wersja i zamrożony evidence snapshot;
- `published/materialized`: powstał output lub kanoniczny obiekt modułu;
- `superseded`: późniejsza wersja zastąpiła tę wersję;
- `archived`: nieaktywny, zachowany w historii.

Obecny runtime `draft/in_review/approved` jest poprawnym minimum, ale nie opisuje
jeszcze całego docelowego cyklu.

## 7. Edycja ręczna

Ręczna praca jest pełnoprawna, nie awaryjna. Użytkownik może:

- pisać i formatować, dodawać nagłówki, listy, cytaty, linki oraz komentarze;
- dodawać, usuwać, przestawiać i duplikować bloki;
- edytować komórki tabeli i właściwości natywnych bloków;
- zaznaczyć fragment i wykonać operację tylko na tym zakresie;
- cofnąć/ponowić, zapisać, zamknąć i wrócić bez utraty miejsca;
- porównać wersje, przywrócić wersję i utworzyć odgałęzienie;
- zmienić tytuł, ownera, reviewerów i lifecycle, jeżeli ma uprawnienie;
- dodać lub odpiąć źródło bez usuwania historycznego lineage;
- wyeksportować lub przekazać wynik do dozwolonego celu.

Autosave pokazuje `saving/saved/failed`. Zamknięcie z niezapisanymi zmianami
nie może nastąpić bez ostrzeżenia albo pewnego lokalnego recovery.

## 8. Output i materializacja

Canvas zachowuje swoją roboczą historię. Przekazanie nie przenosi po cichu
własności oryginału. Powstaje jawna relacja:

```text
canvas draft/version -> conversion proposal -> target object -> read-back
```

Dozwolone cele obejmują: Note, Idea, Decision, Initiative Candidate, Task,
project brief, research report, client deliverable, document, sheet, deck oraz
Outputs. Każdy handoff zapisuje source ID, source version, target ID, autora,
czas, zastosowaną transformację i wynik read-back.

## 9. Udostępnianie

Tryby dostępu: owner, editor, commenter, reviewer, viewer oraz link publiczny,
jeżeli polityka organizacji na to pozwala. Link ma expiry, możliwość odwołania,
watermark/branding według polityki oraz nie może rozszerzać praw do osadzonych
źródeł. Odbiorca bez prawa do źródła widzi dozwolony snapshot, nie ukryty dostęp
do Client Vault.

## 10. Standard jakości

Artefakt nie jest gotowy tylko dlatego, że ma dużo tekstu. Quality gate ocenia:

- zgodność z celem i odbiorcą;
- kompletność wymaganych sekcji;
- poprawność i spójność danych;
- pokrycie źródłami twierdzeń wymagających dowodu;
- jawność założeń, ograniczeń i niepewności;
- czytelność struktury i prezentacji;
- brak sprzeczności z danymi organizacji;
- wykonalny następny krok;
- zgodność z template, brandem i polityką bezpieczeństwa.

## 11. Granica MVP

MVP wymaga: utworzenia/otwarcia, ręcznej edycji, autosave, bezpiecznego
zamknięcia i powrotu, selection AI z diffem, wersji/restore, sources/provenance,
review/approval, eksportu podstawowych formatów, share policy, przekazania do
kluczowych obiektów oraz read-back. Pełna współedycja czasu rzeczywistego,
rozbudowane branchowanie i wszystkie natywne edytory mogą wejść później, jeżeli
uczciwie pokazujemy capability status.

## 12. Pytania do odbioru

1. Czy nazwą widoczną dla użytkownika pozostaje „Canvas”, czy „Workspace”?
2. Które cele materializacji muszą znaleźć się w weekendowym MVP?
3. Czy public share jest domyślnie wyłączony dla każdego nowego tenantu?
4. Czy zatwierdzony artefakt można edytować bez utworzenia nowej wersji roboczej?
5. Kto może zatwierdzać client deliverable: autor, manager czy jawny reviewer?

## 13. Benchmark i architektura elastyczności

Sposób pracy ma łączyć precyzyjną współedycję OpenAI Canvas z wielotypowym,
interaktywnym modelem Claude Artifacts, zachowując governance Consultify.
Szczegółowe rozstrzygnięcia:

- [`CANVAS_CLAUDE_OPENAI_BENCHMARK_AND_PRODUCT_ADAPTATION.md`](CANVAS_CLAUDE_OPENAI_BENCHMARK_AND_PRODUCT_ADAPTATION.md);
- [`CANVAS_FLEXIBLE_ARTIFACT_RUNTIME_TECHNICAL_BLUEPRINT.md`](CANVAS_FLEXIBLE_ARTIFACT_RUNTIME_TECHNICAL_BLUEPRINT.md).

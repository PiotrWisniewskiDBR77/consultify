# 08 — Standard AI

## Poziomy AI

AI występuje na pięciu poziomach:

1. Teresa — cała Idea.
2. AI w Menu 3 — aktualny widok.
3. AI w lewym railu — zaznaczenie albo aktualne narzędzie.
4. AI w floating toolbarze / Inspektorze — pojedynczy element lub zaznaczenie.
5. AI w tabeli — dane, pola, wiersze, komórki.

Każde wejście AI musi jawnie przekazywać scope.

## Nazewnictwo

Nie wolno używać ogólnego `AI expand` wszędzie.

Dozwolone wzorce:

- `Ask Teresa`
- `Analyze view with AI`
- `Expand selected node`
- `Suggest missing steps`
- `Find themes`
- `Rewrite selected item`
- `Fill selected cells`
- `Generate proposal`

Etykieta musi odpowiadać rzeczywistemu działaniu.

## Preview / proposal

Każda operacja AI, która zmienia dane, musi iść przez preview/proposal.

Minimalny flow:

1. User klika AI.
2. System pokazuje scope: co zostanie przeanalizowane.
3. AI generuje propozycję.
4. User widzi diff albo listę zmian.
5. User wybiera: Apply, Modify, Reject.
6. Po Apply zmiana trafia do historii.
7. Undo jest dostępne.

Auto-apply jest dozwolone tylko dla operacji czysto opisowych, które nie zmieniają danych.

## AI całego workspace

Wejście: Teresa w Menu 1.

Może:

- odpowiedzieć na pytania o Idea,
- wyjaśnić strukturę,
- wskazać braki,
- zaproponować działania,
- przygotować draft konwersji.

Nie może bez preview:

- zmienić danych,
- stworzyć artefaktu,
- usunąć elementów,
- nadpisać tabeli.

## AI aktualnego widoku

Wejście: AI w Menu 3.

Mind Map:

- suggest nodes,
- find missing branches,
- improve structure,
- summarize map.

Whiteboard:

- find themes,
- name clusters,
- extract actions,
- identify gaps,
- prepare workshop handoff.

Process Flow:

- validate process quality,
- suggest missing steps,
- detect bottlenecks,
- generate process summary,
- propose automation candidates.

Table:

- suggest fields,
- categorize rows,
- score ideas,
- fill empty cells,
- detect duplicates,
- generate saved views.

## AI zaznaczenia

Wejście: left rail AI albo floating toolbar.

Musi pokazać, na czym działa:

- selected node,
- selected branch,
- selected cards,
- selected steps,
- selected rows,
- selected cells.

Jeżeli nic nie zaznaczono, AI nie może udawać, że działa na zaznaczeniu. Musi zapytać albo przełączyć scope na current view z jasnym komunikatem.

## AI edge

Docelowo:

- suggest relation label,
- detect relation type,
- explain dependency,
- suggest missing connections,
- validate edge direction.

## AI tabeli

Operacje tabeli muszą być szczególnie ostrożne.

Wymagane preview:

- AI Fill,
- AI Categorize,
- AI Scoring,
- AI Refresh,
- AI Generate fields,
- AI Generate rows.

AI nie może natychmiast nadpisywać komórek bez możliwości odrzucenia.

## Historia AI

Każda akcja AI zapisuje:

- kto uruchomił,
- kiedy,
- jaki scope,
- jaki prompt/action id,
- jaki model/provider, jeśli dostępne,
- co zaproponowano,
- co zastosowano,
- co odrzucono.

Historia AI jest filtrem w zakładce Historia, nie osobną zakładką `Historia / AI`.

## Kryteria akceptacji

- Każde AI ma scope.
- Każde AI mutujące dane ma preview.
- Nie ma AI bez LLM nazwanych jako AI.
- Nie ma `mm_ai_*` poza Mind Map.
- Table AI nie wykonuje auto-apply bez review.
- AI zapisuje historię.


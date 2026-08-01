---
document_id: CLIENT-VAULT-UI-UX-AI-STANDARD
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — standard UI/UX i współpracy z AI

## 1. Zasada doświadczenia

Użytkownik ma w każdej chwili rozumieć: gdzie jest, czyje dokumenty widzi, czy
AI może ich używać, co jest gotowe, z jakich źródeł powstał wynik i kto uzyska
dostęp po następnej akcji. Minimalizm oznacza ograniczenie decyzji na ekranie,
nie ukrywanie bezpieczeństwa.

## 2. Nawigacja

Poziomy:

1. My Work → Client Vault;
2. lista sejfów;
3. sejf → Documents/Collections/Reviews/Knowledge/Activity;
4. folder/kolekcja/tabela/KB;
5. document preview lub analysis workspace.

Breadcrumb zachowuje pełną drogę. Back wraca z zachowaniem filtrów, scrolla i
selection. Deep link otwiera właściwy resource po permission check. Nie tworzymy
drugiego paska modułu: hub renderuje jeden Menu 2/3; filtry tabeli należą do
obszaru tabeli, zgodnie z przyjętym standardem.

## 3. Lista sejfów

Główny ekran odpowiada tylko na trzy pytania: który sejf, czy jego wiedza jest
gotowa i czy wymaga interwencji. Typ sejfu rozpoznajemy ikoną i nazwą, nie
agresywnym kolorem. `W wiedzy AI 4/6` ma tooltip rozróżniający processing,
blocked, failed i excluded. Error count jest linkiem do filtrowanej listy.

Row click otwiera. Menu wiersza ma tylko akcje dostępne dla resource type/role.
Systemowe sejfy nie pokazują delete. Empty project safe wyjaśnia, kto ma dostęp
i proponuje upload lub connector, bez sugerowania nieistniejących dokumentów.

## 4. Documents workspace

Górna hierarchia:

- title/breadcrumb + scope badge + access summary;
- command row: search, `Add`, `Ask/Analyze`, opcjonalnie Share;
- lokalne chips/filter controls;
- folder rail lub folder filter zależnie od szerokości;
- StandardTable;
- selection bulk bar przy zaznaczeniu;
- prawy panel preview/details.

Primary CTA `Add` rozwija: Upload files, Upload folder, Connect source, Create
folder. `Ask/Analyze` rozwija: Ask across selection, Compare, Review Table,
Deep analysis. Akcje niedostępne są wyjaśnione, nie renderowane jako martwe.

## 5. Upload experience

Upload jest trzyetapowy:

1. `Choose`: pliki/folder/source;
2. `Destination & protection`: sejf, folder, projekt, sensitivity, AI use;
3. `Review`: pliki, duplikaty, unsupported, szacowany rozmiar i potwierdzenie.

Po starcie drawer pokazuje postęp paczki i per-file. Użytkownik może zamknąć
drawer; status pozostaje w Activity/Inbox. Processing labels są konkretne:
Scanning, Extracting text, OCR, Indexing, Ready. `Partial` mówi, czego brakuje.

## 6. Preview

Centralny viewer zachowuje oryginalny układ. Citation click podświetla fragment
i otwiera panel `Used in answer`. Dla XLSX pokazuje sheet/range, dla PPTX slajd,
dla e-maila headers/thread, dla audio transcript timecode. Widok tekstowy/OCR
jest pomocniczy i pokazuje confidence.

Prawy rail ma maksymalnie pięć wejść: Details, AI, Relations, Versions, Activity.
Najczęstsze action buttons są kontekstowe. Nie pokazujemy jednocześnie formularza
metadanych, AI i pełnego audytu.

## 7. Ask/Deep Analysis workspace

Ekran przed uruchomieniem pokazuje source pills i corpus summary. Teresa pyta o
cel tylko, gdy wynik istotnie zmieni workflow. Plan długiej analizy jest
edytowalny. W trakcie pokazujemy etapy, nie tokenowy „łańcuch myśli”. Wynik ma:
executive answer, key findings, conflicts, missing evidence, recommended next
actions oraz sources. Każdy finding może zostać zaznaczony i przekazany dalej.

## 8. Review Table UX

Pierwsza kolumna jest zamrożonym dokumentem z preview. Nagłówki kolumn pokazują
typ, status runu i menu prompt/version. Cell ma wynik, verification status,
confidence i citation indicator. Hover nie może być jedynym sposobem dostępu.

Right panel po wyborze komórki: answer, sources, prompt/instructions, activity,
comment i actions verify/edit/flag/rerun. Status panel pokazuje progress,
assigned rows, verified, flagged i errors. Tabela dziedziczy kanon Tables 2026,
keyboard navigation, resize, freeze, virtualization i eksport.

## 9. AI microinteractions

- AI button nazywa konkretny rezultat: `Zaproponuj tagi`, nie „AI”;
- przed zapisem pokazuje diff i źródła;
- confidence bez evidence nie daje zielonego statusu;
- `not found` jest poprawnym wynikiem;
- użytkownik może zgłosić zły cytat/ekstrakcję;
- rerun nie niszczy ręcznie zweryfikowanej wartości;
- Teresa nie używa dokumentów niewidocznych w source pills;
- zmiana scope/sensitivity nigdy nie jest sugestią one-click bez impact preview.

## 10. Mobile i accessibility

Mobile priorytet: skan/upload, wyszukiwanie, preview, Ask, approval i obsługa
błędów. Zaawansowany Review Table może mieć responsywny row review zamiast
pełnego arkusza. Wszystkie operacje mają keyboard equivalent, focus management,
aria labels i nie polegają wyłącznie na kolorze. Preview respektuje zoom/reflow,
a duże tabele utrzymują czytelny focus przy virtualizacji.

## 11. Pytania do wspólnego odbioru

1. Czy na liście sejfów pokazujemy trzy stałe wiersze/typy, czy tylko te dostępne?
2. Czy folder tree jest stałym lewym panelem na desktopie, czy filtrem nad tabelą?
3. Czy Ask jest głównym CTA równym Add, czy uruchamia się dopiero po wyborze źródeł?
4. Czy mobile ma obsługiwać tworzenie Review Tables, czy wyłącznie review komórek?
5. Czy użytkownik widzi szacowany koszt/czas deep analysis przed uruchomieniem?

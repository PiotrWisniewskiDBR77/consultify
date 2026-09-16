# TEMPLATE-1b — czystka 96

Status: **HOLD / EVIDENCE_MISSING**. Kod migracji jest przygotowany i fail-closed, ale nie wolno go promować ani wykonywać na współdzielonej bazie bez aktualnego odczytu wszystkich 96 pozycji.

## Zakres

- Źródło decyzji: `INWENTARZ.csv`, SHA-256 `8a4d9b78879b2a6f3817c937fa14c3ba0a0bdd31f722ffc32697370300a8def1`.
- Mianownik zachowany jako `fullName=96`: 20 `KEEP`, 16 `REBUILD`, 60 `DEPRECATE`.
- Rodziny docelowe: 78 `DOC-BASE`, 16 `DECK-BASE`, 2 `SHEET-BASE`.
- Runtime: 46 document, 33 report, 15 presentation, 2 sheet.
- Migracja `20262272_template_library_cleanup_96.sql` nie tworzy brakujących źródeł #1–2 ani #93–96.

## Zachowanie migracji

Przed pierwszym trwałym zapisem migracja wymaga:

1. dokładnie 96 unikalnych pozycji i podziału 20/16/60;
2. jednego istniejącego źródła dla #1–92;
3. jednego istniejącego artefaktu, właściwego origin linku i istniejącego źródła dla każdej pozycji #93–96;
4. unikalnej pary runtime/source dla każdej z 96 pozycji;
5. istniejącej migawki z linkiem dla każdej pozycji;
6. trzech zatwierdzonych baz z migracji `20262271`;
7. nadal aktywnych źródeł wszystkich pozycji `KEEP`.

Po przejściu preflight migracja:

- wycofuje 60 źródeł i ich migawki bez kasowania payloadów;
- pozostawia 20 pozycji `KEEP` aktywnych;
- pozostawia sprawdzone bazy #15 i #81 aktywne, a pozostałe profile `REBUILD` ustawia jako draft;
- tworzy addytywny draft DECK-BASE dla #53, zachowując stary raport aktywny do testu równoważności;
- zachowuje `organization_id` i `visibility` istniejących kart #93–96;
- egzekwuje dokładnie jeden aktywny default tylko dla `RESULTS_KPI_REPORT`;
- kończy się readbackiem 60 wycofanych, 22 aktywnych/proven i 13 przebudowanych draftów.

Całość jest jedną transakcją. Każdy błąd preflight lub readback cofa wszystkie zmiany.

## Dowody

- `evidence/inventory-mapping.json`: PASS, 96/96 zgodnych numerów, decyzji, ID i runtime/replacement runtime.
- `evidence/sql-parse.txt`: PASS, parser PostgreSQL odczytał 26 instrukcji.
- Zrzut 11.09, SHA-256 `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`, kończy migrację kodem 3 na brakujących źródłach #1–2.
- Ten sam zrzut nie ma artefaktów ani linków #93–96. Nie utworzono ich na potrzeby testu.
- `evidence/hashes-before.txt` i `evidence/hashes-after.txt` są identyczne dla sześciu tabel objętych migracją, co dowodzi pełnego rollbacku.
- Backend TSC: 0 diagnostyk, exit 0. Root/frontend TSC: 169 zastanych diagnostyk, exit 2; brak zmienionych plików TS/TSX/JS/JSX, delta B = 0.
- Brak ekranów w tym kroku mechaniki; screenshot nie jest dowodem dla migracji i nie został sztucznie utworzony.

## Bramka do zdjęcia HOLD

Na aktualnym, autoryzowanym źródle danych trzeba wykonać read-only preflight i potwierdzić wszystkie 96 źródeł oraz migawek. Jeżeli #1–2 lub #93–96 nadal nie mają źródła, migracja ma pozostać zatrzymana, a replacement path trzeba zatwierdzić bez tworzenia fikcyjnego rekordu. Dopiero potem dopuszczalny jest lokalny RealPG apply → readback → drugi apply/idempotency. Ten raport nie autoryzuje staging write, deployu ani Railway.

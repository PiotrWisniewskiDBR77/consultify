# CODEX DAY 77 — PĘTLA SZABLON → DOKUMENT

Data pomiaru: 2026-08-29  
Marker: `30db1565756300a0819509227642e53fd68327ee`  
Gałąź: `codex/day77-template-loop-20260829`

## Werdykt binarny

**NIE — pełna pętla generator szablonów → generator dokumentu nie działa dla wszystkich dwóch objętych dyżurem formatów.**

Mianownik: **1 z 2** badanych generatorów pliku kończy pętlę z szablonem utworzonym przez TemplateBuilder:

1. Word / Document Studio — **DZIAŁA**. Zapis `201`, generacja `200`, eksport DOCX `200`; znacznik z szablonu występuje w wynikowym `word/document.xml`.
2. Prezentacja / Presentation Studio — **NIE DZIAŁA**. Zapis szablonu `201`, rejestracja w bibliotece istnieje, ale generator zwraca `403 TEMPLATE_FORBIDDEN`; PPTX nie powstaje.

Krok urwania prezentacji: szablon jest zapisany w `presentation_templates` i widoczny jako artefakt `presentation_template`, ale pozostaje `provenance_status=unknown`, `lifecycle_state=draft`; resolver generatora odrzuca go przed skopiowaniem `outline_json` do kart prezentacji.

## §0.1 — baza, marker i sanity (wynik dosłowny)

`df -h /`:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    89Gi    12%    459k  936M    0%   /
```

Komenda (2):

```text
37c6963032 docs(instrukcje): dyzur 77 (petla szablon->dokument) i 78 (pomiar rubryki PPT)
30db156575 docs(ledger): DEC-294..298 — EV UJEMNE dla CD Projekt, 4 seedery, Materialy 8/8 defektow, klasa A 418/418
c638b3dba4 merge: dyzur 76 — Materialy 20/20, 8/8 defektow nadal wystepuje
f926fa4455 merge: dyzur 75 — 4/4 seedery, max 2 linie na plik
fb0ad6c6f5 merge: dyzur 74 — DOWOD MERYTORYCZNY: liczby z wnetrz, EV ujemne
d502af3094 merge: dyzur 69 checkpoint — klasa A 418/418, klasa F 57/57
3d2cb04d79 docs(day76): record Materials owner evidence matrix
98bf02b2aa docs(day75): report migration counter repair
019a68a00d fix(i18n): domknij klucze obszarow C1
cdf73ad82e fix(assessment): retain migration floor
4bad64f3cd fix(initiatives): retain migration floor
a155dcc732 docs(finance): add day74 material proof
1e73b81a8f fix(my-work): accept current migration ledger
d222a05e68 fix(assessment): report current migration ledger
c89ef169cf fix(initiatives): report current migration ledger
56329a32ca fix(organization): accept current migration ledger
d0d08b3e5a docs(instrukcje): dyzur 76 Materialy — macierz 20/20 + rozstrzygniecie 8 znanych defektow
8d254e6bae docs(instrukcje): dyzur 74 (Finanse — dowod merytoryczny) i 75 (naprawa licznikow migracji)
b4c883b9ec docs(ledger): DEC-292/293 odbior dyzuru 73 — uczciwe 16/20, modul pokazuje realna wartosc
48fe3a11c7 merge: dyzur 73 Wykonanie — uczciwe 16/20, cztery warianty nieosiagalne
e53d85f642 docs(day73): resume execution owner evidence after correction
53f22ac43c docs: DEC-288..291 uwaga wlasciciela o tabeli zewnetrznej, silnik POLICZYL CD Projekt, odbior 72, naprawa 0.4a
b9036590db merge: dyzur 72 Wyniki — 20/20 zrzutow, modul mial zero dowodow
558a3437e2 docs(ledger): DEC-287 checkpoint 69 — 3/3 formattery, mianowniki w raporcie
094f021c1a merge: dyzur 69 checkpoint — 3/3 formattery pl-PL, finance 207->131
MARKER OK
```

Krok (4):

```text
[core]
	bare = false
```

Komenda (7):

```text
30db1565756300a0819509227642e53fd68327ee
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip uciekł do przodu o commit `37c6963032`; różnica obejmuje wyłącznie instrukcje dyżurów 77 i 78. Praca rozpoczęta dokładnie z markera.

## W1–W4

- W1: zero trafień w `assessmentDeckService.ts` i `PptxExportService.ts`; cztery trafienia `templateId` tylko w `managementReportsService.ts:1401-1417`.
- W2: konsumenci nazwy usługi/fasady obejmują m.in. `deliverableTemplateService.ts`, `documentStudio/documentTemplateService.ts`, `deliverableTemplates.routes.ts` i `artifacts.routes.ts`.
- W3: `52 deck`, `44 slide`, brak `pptx`, `docx`, `xlsx` w zadanym grepie. To nie oznacza braku typu `doc`: model TemplateBuildera serializuje `doc|deck|table` w `templateBuilderModel.ts:204-255`.
- W4: flaga ma kolejność URL → localStorage → env → default i klucz URL `ff_templateBuilder`; zgodnie z instrukcją użycie `?ff_templateBuilder=1` jest dozwolone.

## Inwentarz obu stron mostu

### Zapis

- Front TemplateBuildera: `src/components/TemplateBuilder/templateBuilderApi.ts:49-57` wysyła `POST /api/deliverables/templates`.
- Kontrakt struktur: `src/components/TemplateBuilder/templateBuilderModel.ts:204-255` rozróżnia `doc|deck|table` i buduje `meta`.
- Montaż w realnym Gateway: `server/src/Gateway.ts:1201-1206`.
- Doc: `server/src/services/deliverableTemplateService.ts:952-993` wykonuje draft → rewizję sekcji → approve → trwały zapis do `document_studio_templates`.
- Deck: `server/src/services/deliverableTemplateService.ts:996-1020` zapisuje `outline_json` do `presentation_templates` i rejestruje artefakt biblioteki.

### Odczyt przez generator pliku

- Word: `server/src/routes/document-studio.routes.ts:853-899` przekazuje `templateId` do `materializeDocumentArtifact`; `server/src/services/documentStudio/documentStudioService.ts:873-887` wybiera `mode_3` i pobiera zatwierdzony szablon.
- Prezentacja: `server/src/routes/presentations.routes.ts:2251-2335` przyjmuje `templateArtifactId`, rozwiązuje rekord kanoniczny i dopiero po powodzeniu kopiuje outline do kart.
- Legacy eksportery Report Builder (`server/src/routes/report-builder.routes.ts:4128-4148`) przyjmują nazwę wariantu `template` (`corporate|minimal|modern`), nie identyfikator szablonu TemplateBuildera. Nie są mostem dla badanego rekordu.

Mianownik badania zgodny z B.2+B.3: **2 generatory pliku (Presentation Studio, Document Studio); 2 mają kod odczytu szablonu, lecz tylko 1 z 2 przyjmuje świeżo utworzony szablon i kończy eksport.**

## Realny przebieg end-to-end

Każdy przebieg montował `ApiGateway.getInstance().initializeRoutes(app)`, wysyłał realne żądania HTTP przez `supertest`, używał podpisanego JWT i `ENABLE_TEST_AUTH_BYPASS=false`, a bazą był wyłącznie `postgresql://postgres:cx@127.0.0.1:5949/cx_day77` po dwóch pełnych przebiegach migratora. `DB_IDENTITY` w logu: `127.0.0.1:5949/cx_day77`.

### Word — wynik dodatni

Znacznik: `ZNACZNIK-DAY77-c6ef4024-771e-46af-baeb-6e569a2330b3`.

```text
CREATE_STATUS 201
GENERATE_STATUS 200
SCHEMA_HAS_MARKER true
EXPORT_STATUS 200
DOCX_BYTES 10832
```

Artefakt: `/private/tmp/cx-day77-tmpl-loop-artefakty/day77-template-loop.docx`  
SHA-256: `9219c5c4f02e8c844ac0524522952fee26d41a29b5a5f5ba5a467ca10d2947c5`  
Miejsce znacznika: `word/document.xml` (potwierdzone przez `unzip -p ... | grep`).

### Prezentacja — wynik ujemny

Znacznik: `ZNACZNIK-DECK-DAY77-e9c89099-1b5e-4911-8eab-1deb36b7691b`.

```text
DECK_TEMPLATE_CREATE_STATUS 201
DECK_TEMPLATE_ARTIFACT_ID ae48de5a-f814-4d41-9090-5c567543e2c0
DECK_GENERATE_STATUS 403
DECK_GENERATE_BODY {"error":"TEMPLATE_FORBIDDEN"}
```

Niezależny readback lokalnego PG:

```text
id                                   provenance_status  lifecycle_state  is_active
0453b666-3e2c-40aa-a26b-0ee3e20feec0 unknown            draft            t
```

Artefakt biblioteki istnieje i wskazuje rekord kanoniczny:

```text
ae48de5a-f814-4d41-9090-5c567543e2c0 presentation_template 0453b666-3e2c-40aa-a26b-0ee3e20feec0
```

PPTX nie powstał; nie budowałem ani nie obchodziłem brakującego przejścia lifecycle/provenance.

## Pułapki Z33 i środowisko

- (a) `ENABLE_V8_GLOBAL=true` — ustawione w tej samej linii każdego przebiegu.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` — ustawione.
- (c) `MOCK_DB=false DB_TYPE=postgres`; log potwierdza `DB_TYPE: postgres` oraz `DB_IDENTITY ... 127.0.0.1:5949/cx_day77`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; JWT był podpisany, a oba zapisy doszły do realnego PG.
- (e) TemplateBuilder: flaga została zweryfikowana W4; kontrakt UI odtworzono 1:1 przez ten sam endpoint i ten sam `draftToPostBody` shape. Nie zmieniono wartości domyślnej.
- `useLlm=false`; nie wywołano żadnego modelu językowego.
- Pierwszy test eksportu Word na organizacji bez `organization_type=PAID` uczciwie zwrócił `403 TRIAL_EXPORT_DISABLED`. Drugi przebieg użył lokalnej organizacji testowej typu `PAID` i nie obchodził middleware.
- W logach pobocznych wystąpił zastany, nieblokujący duplikat rejestracji `idx_v81_origin_unique` w asynchronicznym X6; podstawowy artefakt i eksport Word zakończyły się poprawnie.

## Z30 — deklaracja obowiązkowa

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `(0 rows)`; grep drenów w `server/src/Gateway.ts` zwrócił 0 trafień.

## Korekty wobec instrukcji

1. Teza autora W3 „dominuje deck/slide, brak docx” jest prawdziwa dla literalnego grepu nazw formatów, ale nie dowodzi braku Worda: TemplateBuilder ma typ `doc`, który zapisuje kanoniczny szablon Document Studio i przeszedł realny eksport DOCX.
2. Teza nadzorcy, że brak `templateId` w dwóch legacy eksporterach PPT oznacza brak mostu prezentacji, jest niepełna: jawny most istnieje w `presentations.routes.ts:2251-2335`. Stan faktyczny jest gorszy w innym miejscu — świeży Deck z TemplateBuildera jest `unknown/draft` i resolver zwraca `TEMPLATE_FORBIDDEN`.
3. Instrukcja nie zawiera osobnej sekcji „BLOK 0” ani tabeli licencji, mimo odwołań w Z7/§0.5. Zastosowałem bezpieczniejszą interpretację: §0.2c jako blok startu bazy; zero zmian w kodzie; jedynym plikiem repo jest ten raport.

## K5 i stan zmian

Kod produktu: **0 zmian**. Testy/infrastruktura testowa: **0 zmian**. Jedyną zmianą repozytorium jest `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY77_TEMPLATE_LOOP_REPORT.md`.

Log pełnego trzeciego przebiegu: `/private/tmp/cx-day77-tmpl-loop-artefakty/day77-e2e-deck.log`, SHA-256 `d767028d083cbc3633889392ab57b377c0ded5d2b90b862efb3863e47fc5964b`.

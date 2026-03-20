# Notatka v8 - SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Kanoniczna definicja celu, zakresu, modelu domenowego i warunkow kompletności dla rozwoju `Notebook` w serii `v8`.
> Zakres: `My Work > Notebook`, bez tworzenia osobnego top-level modulu.

---

## 0. Canonical anchors

Dokumenty:
- `docs/modules/LIVING_NOTEBOOK_MODULE.md`
- `docs/product/NOTEBOOK_V3.md`
- `docs/flows/core/NOTEBOOK_UX_SPEC.md`
- `docs/product/V4_GAP_ANALYSIS.md`
- `docs/ui-standards/README.md`
- `docs/ui-standards/FROZEN_LAYOUTS.md`

Kod:
- `src/components/MyWork/MyWorkHub.tsx`
- `src/components/MyWork/NotebookContent.tsx`
- `src/components/MyWork/notebook/`
- `src/services/api.ts`
- `server/src/routes/my-work.routes.ts`
- `server/src/routes/notebook.routes.ts`
- `server/src/services/notebookService.ts`

Benchmark inputs:
- `Softs/Notatki/Notion dev.zip`
- `Softs/Notatki/Notion help.zip`
- `Softs/Notatki/evernote dev.zip`
- `Softs/Notatki/evernote help.zip`

---

## 1. Co oznacza `Notatka v8`

`Notatka v8` to seria zmian i dokumentow opartych o benchmarki z `Softs`, ale wdrazanych jako rozwoj istniejacego `Notebook`.

Znaczenie `v8`:
- wspolny prefix dla wszystkich dokumentow i pakietow prac z tej serii,
- rozwoj w kierunku pelnego AI-native knowledge system,
- nacisk na doskonalosc i kompletność, nie na najtansze MVP,
- zachowanie zgodnosci z istniejacym shell, nav i UI canonem.

---

## 2. Mission

Zbudowac w `consultify` notatke, ktora nie jest martwym dokumentem, lecz operacyjnym artefaktem wiedzy:
- lapie sygnaly szybko,
- pomaga porzadkowac myslenie,
- laczy sie z innymi artefaktami pracy,
- wraca z trafnym kontekstem,
- umozliwia przejscie od mysli do dzialania,
- wykorzystuje AI w sposob kontrolowany i audytowalny.

---

## 3. Scope produktu

### 3.1 In scope

- quick capture i capture connectors,
- edycja i struktura blokowa notatki,
- metadata, status, visibility, maturity, ownership,
- templates i formula pracy,
- search, semantic search, RAG context,
- backlinks, linked artifacts, used-in context,
- comments/review/governance sygnaly,
- AI extraction, summarization, suggestions, propose/review/accept,
- conversion flows do innych artefaktow.

### 3.2 Out of scope for v8 baseline

- budowa pelnego `Notion databases` equivalent,
- nowy top-level module poza `My Work`,
- zmiana frozen layouts,
- realtime CRDT collaboration jako warunek wejscia do `v8` baseline,
- AI silent writing lub autopublishing zmian.

---

## 4. Product principles

### 4.1 Notebook remains "in work"

Notebook nie jest odseparowana aplikacja do notowania.
To warstwa wiedzy osadzona w aktywnej pracy konsultingowej.

### 4.2 Capture first, structure second

Pierwszy zapis ma byc lekki.
Strukturyzacja ma przychodzic po capture, nie blokowac wejscia.

### 4.3 Every note must gain context

Docelowo kazda wartosciowa notatka powinna miec:
- pochodzenie,
- relacje,
- status dojrzalosci,
- mozliwosc odzyskania w odpowiednim momencie.

### 4.4 AI is assistant, not ghost author

AI moze:
- proponowac,
- porzadkowac,
- laczyc,
- wydobywac,
- przypominac.

AI nie moze:
- nadpisywac po cichu,
- tworzyc obiektow bez jawnej decyzji usera,
- dzialac poza widocznym kontraktem review.

### 4.5 Notes are not a dead archive

Kryterium wartosci notatki to nie samo zapisanie.
Kryterium wartosci jest to, czy notatka wraca do pracy i wplywa na dzialania, decyzje, initiative i outputs.

---

## 5. Model domenowy

### 5.1 Encja `NotebookPage`

Kanonicznie notatka w `v8` jest artefaktem, ktory ma:
- `id`
- `title`
- `contentJson`
- `contentText`
- `tags`
- `status`
- `visibility`
- `maturity`
- `owner`
- `projectId` lub inny aktywny kontekst
- `captureSource`
- `captureMetadata`
- `linkedArtifacts`
- `reviewCadence`
- `verificationStatus`
- `createdAt`
- `updatedAt`

### 5.2 Typy notatek

Kanoniczne typy robocze dla `v8`:
- `quick_note`
- `meeting_note`
- `research_note`
- `discovery_note`
- `strategic_note`
- `decision_draft`
- `initiative_seed`
- `client_brief`
- `risk_note`
- `general_note`

Typ moze byc:
- ustawiony przez template,
- zasugerowany przez AI,
- zmieniony przez usera.

### 5.3 Lifecycle

Kanoniczny lifecycle:
- `captured`
- `active`
- `growing`
- `mature`
- `actionable`
- `converted`
- `archived`

Uwaga:
- `maturity` i `status` nie sa tym samym.
- `status` opisuje faze operacyjna.
- `maturity` opisuje dojrzalosc tresci.

### 5.4 Relacje

Notatka moze byc powiazana z:
- initiative,
- task,
- decision,
- report,
- presentation,
- assessment,
- inna notatka,
- idea workspace,
- interview artefact,
- AI conversation context.

Relacje musza wspierac:
- backlinks,
- preview,
- used-in traceability,
- contextual recall.

---

## 6. Warstwy kompletności `v8`

### 6.1 Capture completeness

Musi istniec:
- quick create,
- source-aware creation,
- upload/import/email/web capture,
- autosave,
- inbox dla wiedzy przychodzacej z zewnatrz.

### 6.2 Content completeness

Musi istniec:
- blokowa struktura,
- outline,
- embeddings i linked refs,
- checklisty, callouty, tabele,
- AI blocks jako osobne propozycje.

### 6.3 Context completeness

Musi istniec:
- status,
- maturity,
- visibility,
- owner,
- tags,
- linked context,
- review/verification sygnaly.

### 6.4 Discovery completeness

Musi istniec:
- search keyword,
- search semantyczny,
- snippets i cytaty,
- related notes,
- backlinks,
- recommendation surfaces.

### 6.5 Conversion completeness

Musi istniec:
- create from note,
- AI extraction,
- outline-first conversion tam, gdzie ma to sens,
- source traceability pomiedzy note a outputem.

### 6.6 Governance completeness

Musi istniec:
- propose/review/accept,
- audit trail dla AI,
- locked/read-only contract,
- permission-safe retrieval,
- czytelne rozdzielenie tresci usera od propozycji AI.

---

## 7. AI contract

### 7.1 Zasada glowna

Kazda operacja AI w notatce działa w modelu:

`observe -> propose -> review -> accept/reject`

### 7.2 Dozwolone klasy operacji AI

- summarize
- extract actions
- suggest topics
- classify note type
- suggest tags
- suggest linked artifacts
- suggest missing questions
- create structured draft blocks
- build RAG context

### 7.3 Niedozwolone klasy operacji

- silent overwrite,
- silent delete,
- silent publish,
- niejawne tworzenie obiektow domenowych bez potwierdzenia,
- pobieranie kontekstu poza policy boundary.

### 7.4 Audit minimum

Kazda operacja AI powinna miec co najmniej:
- actor,
- note id,
- operation type,
- input reference,
- generated proposal,
- resolution status,
- timestamp.

---

## 8. Formula pracy z template

Template w `v8` nie jest tylko szkieletem tekstu.
To operacyjny pakiet startowy zawierajacy:
- typ notatki,
- domyslna strukture sekcji,
- sugerowane metadata,
- AI prompts do pracy na tej notatce,
- sugerowane convert targets,
- ewentualny review cadence.

Priorytetowe template:
- meeting note
- discovery note
- research note
- strategic hypothesis
- decision draft
- initiative seed
- risk note
- client brief

---

## 9. UI and shell constraints

`Notatka v8` musi pozostac zgodna z:
- frozen sidebar order,
- frozen `My Work` tab order,
- workspace 3-tools strip,
- reuse shared sections/blocks tam, gdzie istnieje wzorzec,
- i18n PL + EN,
- locked state contract.

Wnioski:
- `Notebook` zostaje w `My Work`,
- nie tworzymy nowego topbara ani nowego paska miedzy topbarem a trescia,
- nie tworzymy nowego layout standardu dla serii `v8`.

---

## 10. As-is anchors

Obecny stan potwierdzony w kodzie:
- `NotebookContent` ma TipTap, slash menu, AI inline responses, templates, action extraction i context panels.
- `my-work.routes.ts` trzyma bazowy CRUD stron notebooka.
- `notebook.routes.ts` rozszerza capture, semantic search, RAG context, AI proposals i embed chip resolution.
- `notebookService.ts` ma capture connectors, ingest, FTS update, embedding storage, semantic search i AI proposal audit model.

To oznacza, ze `v8` jest rozwojem istniejacego toru, nie greenfieldem.

---

## 11. Definition of done for `Notatka v8`

Seria `v8` jest domknieta dopiero wtedy, gdy:
- istnieje kompletna dokumentacja serii `v8`,
- benchmark jest przelozony na decyzje produktowe,
- as-is i target sa zmapowane bez luk SSOT,
- AI contract jest jawny i zgodny z kodem,
- istnieje implementation plan z epikami i weryfikacja,
- nie ma sprzecznosci z `My Work` shell ani UI canonem.

---

## 12. Non-goals

`Notatka v8` nie ma:
- zamienic notebooka w ogolny no-code database builder,
- kopiowac calego Notion,
- przepychac wszystkich workflowow do jednego typu notatki,
- zastapic Knowledge Base lub inne wyspecjalizowane artefakty,
- wymuszac AI tam, gdzie user chce pisac samodzielnie.

---

## 13. Success metrics

Produktowo:
- user wraca do notatek i korzysta z nich w kolejnych modulach,
- notatki realnie prowadza do decyzji, initiative i taskow,
- search i AI recall zwracaja trafne wyniki,
- notatki nie zalegaja jako martwe archiwum.

Systemowo:
- retrieval jest permission-safe,
- AI actions sa audytowalne,
- source traceability jest zachowana,
- UX pozostaje zgodny z frozen layouts.

---

## 14. One-sentence summary

`Notatka v8` to kompletna, AI-native warstwa pracy z wiedza w `consultify`, rozwijana na bazie istniejacego `Notebook`, inspirowana funkcjonalnie przez Notion i Evernote, ale podporzadkowana domenie konsultingowej, traceability i zasadzie pełnej kontroli usera nad trescia.

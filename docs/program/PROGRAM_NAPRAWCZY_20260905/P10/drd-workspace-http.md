# Warsztat metody DRD (`drd-workspace-http`) — kontrakt karty N

> Partia P10-B4, pozycje **#22 (kanoniczna)** i **#23 (alias/martwa)** inwentarza.
> Pomiar na żywo 06.09.2026, vite 3111 → API 4100, zrzuty `evidence/p10b4/`.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Warsztat metody (sesja DRD) |
| moduł | 04_ASSESSMENT |
| archetyp | **D — Matryca** |
| trasa | `/assessment/drd/:assessmentId` — nie ma własnej trasy, jest centrum karty #21 |
| jak otworzyć | Ocena → „Procesy" → wiersz DRD → „Otwórz" (`evidence/p10b4/03-sesja-drd.png`) |
| komponent | `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:414` (1799 linii) |
| powłoka dziś | własna `MethodWorkspaceShell` (`src/components/method-workspace/MethodWorkspaceShell.tsx:145`, 530 linii) — nie powłoka standardu |

### §0.1 ROZSTRZYGNIĘCIE DUBLETU #22 / #23 (wymagane przed pisaniem)

**Kanoniczny: #22 `DrdHttpMethodWorkspaceScreen`. #23 `DrdMethodWorkspaceScreenLegacy`
jest MARTWY w produkcie.** Dowód (nie flaga, tylko wołacz):

1. `AssessmentSessionEditorView.tsx:1751-1759` montuje `<DrdMethodWorkspaceScreen …
   forceHttpSourceOfTruth />` — prop podany bez wartości, czyli `true`.
2. `DrdMethodWorkspaceScreen.tsx:946-957`: `httpSourceOfTruth = forceHttpSourceOfTruth ??
   isEnabled('drdHttpSourceOfTruthV1')` → `??` nigdy nie sięga po flagę, bo lewa strona
   nie jest `null`. Gałąź legacy (`DrdMethodWorkspaceScreenLegacy`, `:199`) jest nieosiągalna.
3. Flaga `drdHttpSourceOfTruthV1` ma `defaultValue: false` (`useFeatureFlags.tsx:269-291`)
   i nie ma wpisu w `server.env` — mimo to na żywo renderuje się wariant HTTP
   (zrzut `03-sesja-drd.png`: nagłówek „Pracuj z AI" istnieje TYLKO w wariancie HTTP).
   To jest kształt „flaga OFF w kodzie ≠ wyłączona".
4. `shouldMountDrdMethodWorkspace` (`AssessmentSessionEditorView.tsx:115-127`) ignoruje
   swój argument flagi i zwraca `framework === 'drd'` — komentarz w kodzie mówi to wprost.

**Wniosek:** `DrdMethodWorkspaceScreen` zostaje jako cienki **alias montażowy** (14 linii
bramki), `DrdMethodWorkspaceScreenLegacy` (740 linii) idzie do usunięcia razem z martwą
gałęzią DRD w `AssessmentSessionEditorView.tsx:1822-1900` (`DRDForm`, `DRDMatrixSession`,
`DRDAssessmentEditor` jako KOMPONENTY nie mają innego wołacza w `src/`; eksporty typów
i `DRDMatrixGrid` z tego samego pliku żyją — plik zostaje, komponent odchodzi).
Jeden kontrakt, jeden ekran; jego treść obowiązuje przez alias także #23.

## §1. Sekcje

| sekcja | po co użytkownikowi | źródło danych → writer | reguła pustki | kolej. | S/L |
|---|---|---|---|---|---|
| Nagłówek metody (Wyjdź · metoda · pakiet · Pracuj z AI · Ustawienia · kebab) | tożsamość i wyjście | `GET /sessions/:id` → `method-core.routes.ts:839` | zawsze | 1 | L |
| Pasek gotowości `x/y jednostek · z bez dowodu` | ile do zamrożenia | `MethodReadiness` z eventów → `POST /sessions/:id/events:1065` | zawsze | 2 | L |
| Drzewo jednostek z kropką stanu | nawigacja + stan kolorem (DEC-415) | eventy `ANSWER_STATE` → jw. | zawsze | 3 | L |
| Wywiad: pytanie · „Dlaczego pytamy" · „Przykład i dowody" | rdzeń pracy | `pack.questions` → `GET /packs:599` | zawsze | 4 | L |
| Pole „Twoja odpowiedź" + Podyktuj | wprowadzenie treści | `draftAnswerText` → `POST …/events` | zawsze | 5 | L |
| Sześć przycisków stanu (Potwierdzone/Częściowo/Nie/Nie wiem/Brak dowodu/Nie dotyczy) | deklaracja jakości odpowiedzi | `answerState` → jw. | zawsze | 6 | L |
| Pominięcie z uzasadnieniem | ślad audytu | `POST /sessions/:id/assessment-skip-reasons:466` | brak pominięć → znika ✓ | 7 | L |
| Macierz właściciela (obszary × poziomy) | obraz dojrzałości | projekcja `drdWorkspaceViewModel.ts`, render `DrdOwnerMatrixPanel` | zawsze | 8 | L |
| Raport (zakładka) | dokument bez opuszczania sesji | `GET …/assessment-report-contract:535` → karta `assessment-report` | zawsze | 9 | L |
| Wynik zamrożony (Output · Report Snapshot · Inicjatywa) | co powstało z sesji | `POST /sessions/:id/freeze:1505`, `/outputs/:id/report:1789` | tylko `frozen`/`closed` (`:1151`) | 10 | L |
| Szuflada „Ustawienia" (informacje · zespół · akceptacje · licencja) | metadane i akcje cyklu życia | `session`/`readiness` | zawsze | 11 | L |

## §2. Prawy panel

**Dziś zero paneli** (`--dom` na `03-sesja-drd.png` nie znajduje `ArtifactRightPanel`).
Docelowo — jeden `ArtifactRightPanel` po prawej, a szuflada „Ustawienia" znika:

| sekcja | status | co ma nieść |
|---|---|---|
| Akcje | obowiązkowa | „Wyślij do przeglądu" · „Odeślij do pracy" · „Zamroź" (dziś `MethodWorkspaceShell.tsx:386-388`) + kebab: Duplikuj · Historia wersji · Udostępnij · Archiwizuj (`:300-330`) |
| Właściwości (tabela) | obowiązkowa | Status sesji → Właściciel → Metoda i wersja pakietu → Wersja sesji → Źródło (SERWER/SZKIC) → Utworzono → Zaktualizowano |
| Powiązania | obowiązkowa | Output · raport · inicjatywa · projekt (`GET /sessions/:id/lineage:2086`) |
| Źródła i założenia | **obowiązkowa** (karta ma AI) | z czego „Pracuj z AI" wziął propozycję: pytania jednostki, dotychczasowe odpowiedzi, dowody |
| Komentarze | pominięta z powodem | dyskusja idzie do doku Teresy (Menu 1, DEC-404); powód zapisany w kontrakcie |
| Historia | obowiązkowa | `GET /sessions/:id/events:1049` — dziennik istnieje, nie jest pokazany |

## §3. Menu 5 i nawigacja

* Dziś: „Pracuj z AI" w Menu 4 (`MethodWorkspaceShell.tsx:274`), tryby Wywiad/Macierz/Raport
  w osobnym pasku (`:468-490`), „Sekcje ▾" i „Edycja/Podgląd" nie istnieją.
* Docelowo: pasek Menu 5 pod Menu 4 — Sekcje ▾ · Edycja/Podgląd · Pracuj z AI ▾; tryby
  Wywiad/Macierz/Raport zostają jako trzy ujęcia centrum (archetyp D), nie jako sekcje.
* Edycja/Podgląd: prawo = `canWrite` (rola procesowa z zapisem); brak → przełącznik znika,
  powód tekstem (literał gotowy: `DrdHttpMethodWorkspaceScreen.tsx:1294`).
* Sticky ✓ (nagłówek + pasek trybów). Klasa **L**.
* „Otwórz" z podglądu ✓ (2 kliknięcia z listy).

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Pole odpowiedzi (bieżące pytanie) | gotowość sesji + 6 pytań Teresy (`:981-995`) | `generujTrescPola` → `POST /ai/refine-text` dla bieżącego pytania (`zrodloSekcjaAI:1052`) | to samo dla wszystkich pytań bieżącej jednostki (`zrodloDokumentAI:1064`) | — |
| Stan odpowiedzi | czyta | ✗ | ✗ | ✓ świadomie: AI nie przestawia pigułki za człowieka (`:1023-1029`) |
| Dowody / pominięcia | czyta | ✗ | ✗ | ✓ |
| Macierz, poziomy, gotowość | czyta | ✗ | ✗ | ✓ wyliczenia |

Propozycja → „Zatwierdź" ✓ (`zastosujPropozycje:1042`, wpisuje do pola tak jak człowiek,
świadomie NIE woła `recordAnswer`). Teresa wyłącznie z Menu 1 ✓ (`handleAskTeresa:725`
→ `useOpenChatWithContext:723`). **Obalona teza:** `POST /sessions/:id/teresa/preview`
(`method-core.routes.ts:1338`) nie generuje treści — zapisuje to, co klient przyśle
(komentarz pomiarowy `:1013-1021`); nie jest silnikiem pisania.

## §5. Czytelność

* `primary-[0-9]` = **0** ✓ K17; fokus wyłącznie `ring-c-focus` ✓ K18.
* Angielskie literały: `DrdSourceIndicator.tsx:24-26` (`SERVER`, `RECOVERY_DRAFT`,
  `DEMO_LOCAL` — nazwy enuma, widoczne na `03-sesja-drd.png` jako plakietka „SERVER"),
  `MethodWorkspaceShell.tsx:380` („human led"/„AI assisted").
* Etykiety drzewa ucinane: „Technologia Proceso…" (`03-sesja-drd.png`) — K13.
* K28: tytuł „Sesja 2d1fc7a8"; pełny UUID poprawnie schowany w `<details> Szczegóły
  techniczne` (`MethodWorkspaceShell.tsx:370-375`) — wzór do powtórzenia gdzie indziej.
* 1440 ✓, `bledyKonsoli = 0` ✓. 1280 niemierzone.

## §6. Stan zastany vs kontrakt

✓: K15, K16, K17, K18, K21, K22, K23, K26, K27, K29, K30 (**11**).
~: K3 (writer jest, spis nie), K4, K13 (drzewo jednostek ≠ spis sekcji + ucięcia),
K14 (`canWrite` jest, przełącznika nie), K20, K28 (**6**).
✗: K1, K2, K5, K6, K7, K8, K9, K10, K11, K12, K19, K24, K25 (**13**).

Dowody: `evidence/p10b4/03-sesja-drd.png` (ekran), `04-sesja-drd-ai.png` (K21/K30 — trzy
pozycje), `11-sesja-ustawienia.png` (K7/K6 — właściwości i akcje w szufladzie zamiast panelu).

## §7. Luki → naprawa

| # | luka | rozmiar | MVP / Fala 2 | decyzja właściciela? |
|---|---|---|---|---|
| L1 | prawy panel wg K6–K11 (Akcje z szuflady, tabela Właściwości, Powiązania z `lineage`, Źródła i założenia, Historia z eventów) | L | **Fala 2** (poz. 3.13) | nie |
| L2 | Menu 5 jako pasek | M | **Fala 2** | nie |
| L3 | pasek modułu + pigułka otwartej karty (K19) | M | **Fala 2** | nie |
| L4 | katalog sekcji sterujący renderem (K1+K2) | L | Fala 2 | nie |
| L5 | usunąć martwe #23 (`DrdMethodWorkspaceScreenLegacy`, 740 linii) i martwą gałąź `AssessmentSessionEditorView.tsx:1822-1900` | M | MVP (sprzątanie, bez zmiany obrazu) | nie |
| L6 | `SERVER`/`human led` → polski (K25) | S | **MVP** | nie |
| L7 | etykiety drzewa bez ucinania (K13) | S | **MVP** | nie |
| L8 | wpis `drd-workspace` do `REJESTR_KART_N` + wiersz w `cardAnalysisRubric.ts` (K24) | S | MVP | nie |

**Granica MVP / Fala 2 (DEC-415, TRZY_POJEMNIKI_PRACY_20260906.md poz. 3.13).**
Właściciel 06.09: „bardzo nawala tego tekstu; poprawimy cały układ graficzny na etapie
fali drugiej". W MVP tylko: kolory stanu odpowiedzi (zrobione, DEC-415), „Zapytaj Teresę"
→ Menu 1 (zrobione), „Podyktuj" (zrobione) oraz L6/L7 wyżej. Cała powłoka kanonu
(L1–L4) jest **poza MVP** — ten kontrakt opisuje stan docelowy, nie zakres pojemnika 1.

**Pytań do właściciela: 0** (układ graficzny już rozstrzygnięty jako Fala 2).

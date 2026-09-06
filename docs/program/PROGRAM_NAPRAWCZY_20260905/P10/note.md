# Notatka — kontrakt karty N (P10-B6, DEC-429)

> Runda 2. Runda 1 (tabela na końcu, §8) zostaje jako zapis pierwszego pomiaru — nie kasuję jej,
> uzupełniam. Pomiar r2: 06.09.2026, własny vite 3141 z worktree `mvp/p10b6-moja-praca`,
> API `127.0.0.1:4100`, organizacja DBR77, użytkownik `audyt@dbr77.local`.
> Dowody: `evidence/p10b6/04-note-panel.png`, `04-note-wlasciwosci.png`, `04-note-deeplink.png`.

## §0. Tożsamość

| pole | wartość |
|---|---|
| nazwa PL | Notatka (strona notatnika) |
| moduł | `07_MY_WORK_AGENT` (Moja praca → Notatnik) |
| archetyp | **B — Dokument** |
| trasa tożsamości | `/my-work/notebook/<pageId>` (`MyWorkHub.tsx:651-653`) — **działa** (`04-note-deeplink.png`) |
| jak otworzyć z listy | Moja praca → Notatnik → notatnik → wiersz strony w lewej kolumnie. **URL się NIE zmienia** — wybór strony nie zapisuje tożsamości w adresie (`04-note-panel.png.json`: `url` = `/my-work?notebook=…`) |
| komponent | `src/components/MyWork/NotebookContent.tsx:732` (4399 linii) |
| prawy panel | `src/components/MyWork/notebook/NotebookRightRail.tsx:499-535` → `ArtifactRightPanel` |
| powłoka | brak powłoki karty N (`StandardArtifactShell`/`NModeShell`); własny układ trzykolumnowy w `NotebookContent` |
| klasa S/L | **L** (6 sekcji panelu, pełna strona) — do wpisania przy wejściu do rejestru |
| rejestr | **poza** — jawny wyjątek: „NotebookContent ma własny dokumentowy model poza rejestrem" (`registry.kompletnosc.test.ts:31`) |

## §1. SEKCJE (centrum dokumentu)

Kontrakt sekcji **nie istnieje** (K1 ✗): brak katalogu `KanonicznaKarta` i brak tablicy
`StandardSekcjaDef`. Poniższa tabela to kontrakt **do zbudowania** — dziś sekcje są wpisane
inline w JSX `NotebookContent`.

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Okładka i ikona | rozpoznanie notatki na liście i w dokumencie | `cover`/`icon` → `PUT /my-work/notebook/pages/:id` (`notebook.routes.ts:1258`) | brak okładki → sam pasek „Dodaj okładkę" | 1 | L |
| Tytuł | tożsamość rekordu | `title` → `notebook.routes.ts:1155` (handler PUT) | pusty → „Bez tytułu" | 2 | S+L |
| Dokument notatki | treść, po którą użytkownik przyszedł | `contentJson`/`contentText` → `notebook.routes.ts:1248-1257` (+ atomowy `UPDATE` `:1383`) | pusty → podpowiedź „Zacznij pisać… Wpisz / aby wstawić blok" | 3 | S+L |
| Wspomniane w (backlinki) | gdzie ta notatka jest cytowana | backlinki notatki → `NotebookBacklinksBar.tsx` (API backlinków) | zero → sekcja znika | 4 | L |
| Załączniki | dowody i pliki źródłowe | `attachments` → `POST/DELETE /notebook/pages/:id/attachments` (`notebook.routes.ts:941`, `:1064`) | zero → nagłówek zwinięty, bez pustej ramki | 5 | L |
| Historia wersji | powrót do poprzedniej treści | wersje → `POST /notebook/pages/:id/versions` (`v8/notebookVersions.routes.ts:190`), przywrócenie `:231` | brak wersji → „Brak zapisanej historii" | 6 | L |

Uwaga do K3: **backend ma własny kontrakt** (`GET /api/v8/notebook/contract`,
`v8/notebook.routes.ts:224` → `P07_NOTEBOOK_CANON_CONTRACT`). To kontrakt zachowania serwera,
nie katalog sekcji ekranu — nie zastępuje K1.

## §2. PRAWY PANEL (zmierzony, `04-note-panel.png`)

Panel **istnieje i jest kanoniczny** — to korekta matrycy r1 (wiersz 04 mówił „✗ brak panelu”;
panel jest domyślnie **zamknięty** na żądanie właściciela, DEC-397, `NotebookRightRail.tsx:441-461`,
i trzeba go otworzyć przyciskiem `NotebookContent.tsx:3257-3276`).

| sekcja | stan | uwaga |
|---|---|---|
| Akcje | ✓ obowiązkowa, pierwsza (`NotebookRightRail.tsx:570`) | zawiera formatowanie, przepływ, „Wstaw blok" — zdjęte ze środka 05.09 |
| Właściwości | **✗ nie jest tabelą** (`:652-655`) | wiersze bez nagłówka „Właściwość \| Wartość", kolejność własna: Status zapisu · Właściciel · Widoczność · Weryfikacja · Przegląd · Tagi i status, potem luźne linie „Zmodyfikowano/Liczba słów/Ostatnio sprawdzono" (`04-note-wlasciwosci.png`). Brak wiersza „Utworzono". „Status zapisu" to stan przyrządu, nie właściwość rekordu |
| Powiązania | ✓ (`:1042`) | |
| Źródła i założenia | ✓ (`:1063`) | karta ma AI → sekcja obowiązkowa (K9) |
| Komentarze | ✓ (`:1086`), licznik 0 | |
| Historia | ✓ (`:1096`) | |
| jeden panel | ✓ | dokładnie jedna kolumna panelu na ekranie |

Kontrakt: Właściwości mają renderować `ArtifactPropertiesTable` w kolejności K7
(Status → Właściciel → Priorytet/Waga → Termin/Okres → Źródło/Kontekst → Utworzono → Zaktualizowano);
„Status zapisu" schodzi z tabeli do paska stanu edytora.

## §3. MENU 5 I NAWIGACJA

Menu 5 **nie istnieje** (K12 ✗). Kontrakt:

* **Sekcje ▾** — wybór widocznych sekcji z §1; dziś zastępuje je lewa lista stron notatnika (to lista rekordów, nie spis sekcji).
* **Edycja / Podgląd** — prawo edycji = `owner_user_id === userId` (serwer wymusza to twardo: `notebook.routes.ts:1175` zwraca 403 „Owner-only”). Cudza notatka ma nie pokazywać przełącznika i podać powód „Tylko do odczytu: notatka innego użytkownika".
* **Pracuj z AI ▾** — patrz §4.
* Nagłówki przyklejone (K15) i pigułka rekordu w pasku modułu (K19 ✗ dziś — pasek Menu 2 pokazuje „Notatnik", bez pigułki `Notatka · <tytuł>`).
* K26: klik z listy ma zmieniać adres na `/my-work/notebook/<pageId>` (trasa istnieje, lista jej nie używa).

## §4. AI

Karta **nie ma** `PracujZAI` (K21 ✗). Zamiast tego pięć osobnych powierzchni AI:
`notebook/AICommandPrompt.tsx`, `AIInlineResponse.tsx`, `AIChatInlinePanel.tsx`, `AITopicsPanel.tsx`,
`NotebookInlineAIMenu.tsx` + chip przepływu „Utwórz propozycję AI" (`NotebookProgressChip.tsx:78-79`).
Notatka jest też **poza** `CardAnalysisArtifactType`, więc `cardAnalysisRubric.ts` nie ma dla niej
kryteriów — to trzeba dopisać razem z wejściem do rejestru.

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Dokument notatki | ocena kompletności i spójności notatki wobec załączników i backlinków | dopisz brakujący akapit sekcji wskazanej kursorem, z załączników i tematów | szkic całej notatki z tematów + załączników + wątku źródłowego | — |
| Załączniki | czy dowody pokrywają twierdzenia notatki | — | — | pliki, metadane wgrania |
| Wspomniane w | — | — | — | backlinki (wyliczane) |
| Historia wersji | — | — | — | wersje, autorzy, znaczniki czasu |

Zawsze propozycja → „Zatwierdź" (K22). Teresa **tylko** Menu 1 (K27) — dziś spełnione na żywej
ścieżce (`NotebookRightRail.tsx:180-186`: trzy wejścia do Teresy usunięte, DEC-419).
**Uśpione naruszenie:** ścieżka `ArtifactRightRail` (`NotebookRightRail.tsx:1129-1200`) ma pas
„Teresa" z komendami; żyje tylko za flagą `ff_artifact_right_rail` (default OFF,
`src/utils/artifactRightRailFlag.ts:47`). Kontrakt: ta gałąź ma zostać usunięta, nie tylko wyłączona.

## §5. CZYTELNOŚĆ

* Tokeny: `grep -c "primary-[0-9]" NotebookContent.tsx NotebookRightRail.tsx` = **0** ✓.
* i18n: `notebook.rightRail.eyebrow` = **„Notebook"** w `public/locales/pl/translation.json` — na
  ekranie polski panel ma angielski nadtytuł (`NotebookRightRail.tsx:1258`, widoczne na
  `04-note-panel.png`). Do zmiany na „Notatnik".
* i18n: `notebook.progressChip.label2` = **„Masz propozycje do review"** — półsłowo angielskie
  (`NotebookProgressChip.tsx:78`).
* 1440: **tytuł notatki jest ucinany krawędzią kolumny**, bez zawijania i bez wielokropka —
  „Q2 Strategy — Market expansion playboo|" (`04-note-panel.png`), „Risk register — Transformation
  program |" (`04-note-deeplink.png`). K20 ✗.
* Tagi pokazują surowe wartości `active`, `seed` (`04-note-wlasciwosci.png`) — K28 ~, wymagają etykiet.
* Przycisk otwarcia panelu jest samą ikoną z `title`, bez `aria-label` (`NotebookContent.tsx:3257`).
* **Nie liczę jako defektów karty**: plakietki „LOCAL" i „3 V9 overrides" w prawym dolnym rogu —
  to nakładki dev (`ChatV9FlagsIndicator.tsx`, `EnvironmentBadge.tsx` za `shouldShowDebugOverlays()`),
  przyrząd, nie produkt.

## §6. STAN ZASTANY vs KONTRAKT (K1–K30)

| K | stan | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu; sekcje inline w `NotebookContent.tsx` |
| K2 kontrakt steruje renderem | ✗ | nie ma czym sterować |
| K3 źródło danych per sekcja | ~ | writery wskazane w §1; backlinki bez jednego writera |
| K4 reguła pustki | ~ | „Załączniki" renderują nagłówek przy zerze (`04-note-panel.png`) |
| K5 etykiety/kolejność | ✗ | brak kontraktu do porównania |
| K6 Akcje pierwsza | ✓ | `NotebookRightRail.tsx:570` |
| K7 Właściwości = tabela | **✗** | `04-note-wlasciwosci.png` — brak nagłówka i innej kolejności |
| K8 Powiązania | ✓ | `:1042` |
| K9 Źródła i założenia | ✓ | `:1063` |
| K10 Komentarze + Historia | ✓ | `:1086`, `:1096` |
| K11 jeden panel | ✓ | jedna kolumna |
| K12 Menu 5 | **✗** | brak paska |
| K13 lewy spis sekcji | ✗ | lewa kolumna to lista stron, nie spis sekcji |
| K14 Edycja/Podgląd wg prawa | ✗ | brak przełącznika; prawo egzekwuje dopiero serwer (403) |
| K15 sticky | ~ | tytuł w kolumnie dokumentu, przewija się z treścią |
| K16 drabina S/L | ✗ | klik z listy otwiera pełny dokument, bez podglądu bocznego |
| K17 zero `primary-*` | ✓ | grep = 0 |
| K18 fokus `c-focus` | ✓ | `NotebookRightRail`/`NotebookContent` używają `ring-c-focus` |
| K19 pigułka w pasku modułu | ✗ | `04-note-panel.png` |
| K20 1440 bez ucięć | **✗** | tytuł ucięty (2 rekordy) |
| K21 „Pracuj z AI" | **✗** | 5 osobnych powierzchni AI |
| K22 propozycja → Zatwierdź | ~ | propozycje AI mają przegląd, ale poza wspólnym komponentem |
| K23 po polsku / wg praw | ~ | patrz §5 |
| K24 deklaracja AI per typ | ✗ | notatka poza `CardAnalysisArtifactType` |
| K25 i18n bez angielskiego | **✗** | „Notebook", „…do review" |
| K26 podgląd → „Otwórz" | ✗ | adres nie zmienia się przy wyborze strony |
| K27 Teresa tylko Menu 1 | ✓ (na żywej ścieżce) | `NotebookRightRail.tsx:180-186`; uśpiona gałąź za flagą OFF |
| K28 brak identyfikatorów | ~ | tagi `active`/`seed` |
| K29 zero błędów konsoli | ✓ | `04-note-panel.png.json` → `bledyKonsoli` 0 |
| K30 odbiór na zrzucie | — | zrzut jest; brak „Pracuj z AI" do otwarcia |

**Wynik: ✓ 9 · ~ 7 · ✗ 14 z 30.**

## §7. LUKI → NAPRAWA

| # | luka | rozmiar | decyzja właściciela? |
|---|---|---|---|
| 1 | katalog sekcji `noteCardContract.ts` + sterowanie renderem (K1/K2/K5) | L | nie |
| 2 | Menu 5 (Sekcje · Edycja/Podgląd wg `owner_user_id` · Pracuj z AI) | L | nie |
| 3 | `PracujZAI` zamiast 5 powierzchni AI + wpis `note` do `KartaNKey` i `cardAnalysisRubric.ts` | L | nie |
| 4 | Właściwości → `ArtifactPropertiesTable` w kolejności K7; „Status zapisu" na pasek edytora | M | nie |
| 5 | pigułka rekordu w pasku modułu + zmiana adresu na `/my-work/notebook/<pageId>` przy wyborze strony | M | nie |
| 6 | tytuł: zawijanie/wielokropek zamiast ucięcia krawędzią (1440 i 1280) | S | nie |
| 7 | i18n: `notebook.rightRail.eyebrow` → „Notatnik"; `notebook.progressChip.label2` → „…do przeglądu" | S | nie |
| 8 | usunięcie gałęzi `ArtifactRightRail` z pasem Teresy (uśpiony K27) | S | nie |

**Pytanie do właściciela (1):** notatka jest dziś jawnym wyjątkiem rejestru („własny model
dokumentowy"). Wejście do `KartaNKey` jest warunkiem, żeby mogła wołać silnik „Analizuj z AI"
(`CardAnalysisArtifactType = KartaNKey`). **Rekomendacja: wpisać `note` do rejestru jako kartę
klasy L** — bez tego K21/K24 są nie do spełnienia, a właściciel prosi o AI we wszystkich typach kart.

## §8. Zapis rundy 1 (zachowany)

Zrzut listy: `evidence/p10-karty-n/note/note.png`; szczegół nie został otwarty.

| sekcja | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Dokument notatki | brak kontraktu | `NotebookContent.tsx`; zrzut tylko listy | `contentJson` → `server/src/routes/v8/my-work.routes.ts:335-358` | sekcja poza kontraktem | blokuje MVP |
| Powiązania | brak kontraktu | `NotebookRightRail.tsx` | API linków → writer rozproszony | sekcja poza kontraktem | blokuje MVP |
| Historia wersji | brak kontraktu | `NotebookContent.tsx` | API historii notatnika | sekcja poza kontraktem | blokuje MVP |

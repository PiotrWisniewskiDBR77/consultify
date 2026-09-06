# Kontrakt karty N — `objective` (Cel OKR)

## §0. Tożsamość

- **Nazwa PL:** Cel OKR · **moduł:** Wyniki (P7K).
- **Archetyp:** C (Rekord) · **klasa:** L (`registry.ts:209-217`: pięć sekcji, ponad limit 4 klasy S).
- **Trasa:** `/results/okr/:setId/objectives/:objectiveId` (poziom 3, w kontekście raportu) i
  `/results/okr/objectives/:objectiveId` (bez kontekstu — link z wyrównania innego zestawu),
  `src/routes/routeConfig.ts:222,224`.
- **Jak otworzyć:** Wyniki → OKR → raport zestawu → wiersz celu → klik. Zmierzone na żywo 06.09.2026,
  zrzut `evidence/p10-matryca/13-objective.png` (rekord „Uruchomić zrobotyzowane gniazdo spawalnicze").
- **Komponent:** `src/components/ResultsVNext/okr/OkrObjectiveCardPage.tsx:205` (1532 linii).
- **Kontrakt sekcji w osobnym pliku:** `src/components/ResultsVNext/okr/OkrObjectiveCardSections.ts`
  (97 linii) — pięć sekcji 1:1 z zatwierdzonym przez właściciela zrzutem
  `evidence/grafika/26-wyniki-karty-n/cel-jedna-karta__PO__light__*.png` (l.4-9).
- **Powłoka dziś:** `NModeShell` + `ArtifactRightPanel` przez `KartaWynikowChrome`
  (`OkrObjectiveCardPage.tsx:1425`, `kartaWynikow.tsx:88`).
- **Rejestr:** `objective` w `KartaNKey` (`registry.ts:49`), `statusMigracji: 'przed'`.

## §1. Sekcje

Pięć sekcji z `OKR_OBJECTIVE_CARD_SECTIONS` (`OkrObjectiveCardSections.ts:39-70`):

| sekcja | po co użytkownikowi | źródło danych → writer | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Cel (`cel`) | co i dlaczego chcemy osiągnąć | pola celu → `okrObjectiveApi.ts`, zapis `PATCH .../objectives/:id` (`okr.routes.ts`, trasa niezmierzona co do linii w tej rundzie) | — | 1 | L |
| Kluczowe rezultaty (`kluczowe-rezultaty`) | start/cel/wartość bieżąca per KR | `key results` z `okrObjectiveApi.ts` | pusta lista = brak KR | 2 | L |
| Check-iny (`check-iny`) | oś czasu pomiarów i postępu | `okrCheckInApi.ts`/`okrCheckInMappers.ts` | „Dla tego celu nie zapisano jeszcze ani jednego check-inu…" (`OkrObjectiveCardPage.tsx:1040`) | 3 | L |
| Powiązania (`powiazania`) | wyrównania (alignments) z innymi celami/zestawem | agregat `alignmentList` | pusta = „Brak wyrównań" (prawy panel, patrz §2) | 4 | L |
| Refleksja (`refleksja`) | przeglądy zestawu dotyczące celu | `okrReviewApi`/`OkrReviewReflectionView` (poziom zestawu, filtrowany po celu) | niezmierzone w tej rundzie | 5 | L |

Kontrakt renderuje `zbudujSpecSekcji(OKR_OBJECTIVE_CARD_SECTIONS.map(...))`
(`OkrObjectiveCardPage.tsx:620-636`) → `SectionsManagerMenu` (K1 ✓, K2 ✓ — brak flagi blokującej,
tak samo jak metric).

## §2. Prawy panel — LUKA

`ArtifactRightPanel` renderuje się (`OkrObjectiveCardPage.tsx:1489`), ale **TYLKO TRZY sekcje**,
nie sześć:

| sekcja | obecna? | plik:linia |
|---|---|---|
| Akcje | ✓ | `:1336-1360` („Kluczowe rezultaty i check-in", „Otwórz raport OKR") |
| Właściwości (tabela) | ✓ | `:1362-1373` |
| Powiązania | ✓ | `:1375-1390` (wyrównania) |
| **Źródła i założenia** | **✗ BRAK** | grep zero trafień `id: 'evidence'`/„Źródła i założenia" w tym pliku |
| **Komentarze** | **✗ BRAK** | grep zero trafień `id: 'comments'` |
| **Historia** | **✗ BRAK** | grep zero trafień `id: 'history'` |

**Sprzeczność w kodzie:** komentarz nagłówkowy `OkrObjectiveCardSections.ts:19-22` twierdzi:
„SPEC-A §2.1: `comments`/`history`/`activity-log` NIE MOGĄ być sekcją lewej nawigacji — u nas nie
są, mieszkają w prawym panelu accordionu (`ArtifactRightPanel`)" — ale w rzeczywistym
`rightPanelSections` (`OkrObjectiveCardPage.tsx:1336-1390`) tych sekcji **nie ma wcale**, ani jako
widocznych, ani jako `isEmpty`+powód. To nie jest „pominięcie z jawnym powodem" (K10 dopuszcza to),
tylko rozjazd między komentarzem projektowym a stanem faktycznym kodu — **naruszenie K10**
(Historia jest obowiązkowa ZAWSZE, milczenie jest błędem wg brzmienia kontraktu).

## §3. Menu 5 i nawigacja

- Menu 5: `sectionsMenu` + `PracujZAI` (`:1451-1488`).
- **Edycja/Podgląd:** nieobecne, ZGODNIE z K14 (rekord tylko do odczytu w tym miejscu, matryca #13
  „✓ ZGODNIE z K14").
- **K16 klasa:** L, 5 sekcji > limit 4.
- Trzy poziomy okruszka: Raporty OKR → raport → cel (`breadcrumbItems`, `:1397-1404`) — zgodnie
  z P7K (trzy poziomy, nie cztery).

## §4. AI

| sekcja | Analizuj | Uzupełnij tę sekcję | Uzupełnij cały dokument | tylko do odczytu |
|---|---|---|---|---|
| Cel | rubryka `cardAnalysisRubric.ts:667-692` (4 kryteria: cel jako rezultat, mierzalność KR, ambicja, uczciwość refleksji) | pola z `okrPolaSekcji(id)` przez `SEKCJE_Z_POLAMI_TEKSTOWYMI` (`:604-617`) | j.w. | kluczowe rezultaty, check-iny, postęp (deklaracja rubryki) |

Zapis przez `useZapisPolAI` (ten sam kolejkowany mechanizm co metric, `kartaWynikow.tsx`),
docelowo `PATCH .../objectives/:id` — propozycja→Zatwierdź, brak auto-zapisu. Zmierzone na żywo:
„✓ (read-only)" (matryca #13).

## §5. Czytelność

Niezmierzone osobno w tej rundzie (brak nowego zrzutu 1280/scroll/grep `primary-*` na tym pliku);
zrzut 1440 istniejący (`13-objective.png`) czysty wg matrycy (K25 ✓, brak angielskiego).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✓ | `OkrObjectiveCardSections.ts` — plik dedykowany |
| K2 kontrakt steruje renderem | ✓ | brak flagi blokującej, `zbudujSpecSekcji` czyta wprost z tablicy |
| K3 źródło danych per sekcja | ~ | 4/5 sekcji ma wskazane API; Refleksja niezmierzona co do writera w tej rundzie |
| K4 reguła pustki | ✓ | check-iny mają jawny pusty komunikat (`:1040`) |
| **K6–K11 prawy panel** | **✗ 3/6** | Akcje+Właściwości+Powiązania obecne; Źródła/Komentarze/Historia **brakują całkowicie**, wbrew własnemu komentarzowi kodu |
| K12 Menu 5 trzy elementy | ~ | Sekcje ▾ + Pracuj z AI ▾; Edycja/Podgląd nieobecne ZGODNIE z K14 |
| K13–K15, K17, K18, K20 | n/d | brak nowego zrzutu/scrolla/grep w tej rundzie |
| K14 Edycja/Podgląd wg prawa | ✓ | matryca #13 |
| K16 klasa S/L zgodna | ✓ | L, 5 sekcji |
| K19 pigułka pasku modułu | ✓ | `KartaWynikowChrome` (współdzielony z metric) |
| K21 „Pracuj z AI" 3 pozycje | ✓ | `PracujZAI` |
| K22 propozycja→Zatwierdź | ✓ | wspólny mechanizm `kartaWynikow.tsx` |
| K23 po polsku, wg uprawnień | ✓ | |
| K24 deklaracja per typ | ✓ | tabela K24 SSOT wypełniona dla `objective` |
| K25 i18n bez angielskiego | ✓ (zmierzone) | matryca #13 |
| K26 podgląd/Otwórz | ✓ | |
| K27 Teresa tylko Menu 1 | ✓ | grep zero trafień „Teresa" w pliku |
| K28 zero identyfikatorów technicznych | n/d | niezmierzone w tej rundzie |
| K29 zero błędów konsoli | n/d | brak nowego zrzutu w tej rundzie (zrzut R1 był czysty) |
| K30 odbiór 1 zrzut 1440 | ✓ | `13-objective.png` |

**Wynik: 12 ✓, 1 ✗ realny (K6–K11, prawy panel niekompletny), 7 n/d/częściowe.**

## §7. Luki → naprawa

1. **PRAWY PANEL — trzy sekcje SPEC-A brakują (Źródła i założenia, Komentarze, Historia).**
   Rozmiar M: dopisać trzy bloki do `rightPanelSections` w `OkrObjectiveCardPage.tsx:1336-1390`,
   wzorem `KpiToolPage.tsx:1127-1198` (ta sama rodzina komponentów, ten sam wzorzec kodu do
   skopiowania: Źródła — metoda/definicja/źródło ostatniego check-inu; Komentarze — jawnie pominięte
   z powodem, jeśli model nie ma wątku; Historia — log zdarzeń celu, jeśli istnieje agregat, inaczej
   jawny powód braku). NIE wymaga decyzji właściciela — to jest domknięcie własnego komentarza
   kodu (`OkrObjectiveCardSections.ts:19-22`), nie nowa treść.
2. **K3 Refleksja — writer niezweryfikowany.** Rozmiar S: potwierdzić, czy `OkrReviewReflectionView`
   naprawdę filtruje przeglądy po `objectiveId`, czy sekcja pokazuje treść całego zestawu.
3. **Pomiary K13/K15/K17/K18/K20/K28/K29 — brak w tej rundzie.** Rozmiar S: dogrywka zrzutu.

**Rekomendacja:** kluczowa luka (prawy panel) jest tania do naprawienia (M) i nie wymaga pytania
właściciela — kod już deklaruje, że te trzy sekcje powinny tam być.

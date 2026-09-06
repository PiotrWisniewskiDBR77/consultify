# Artefakt czatu (`chat-artifact`)

**Status:** PROPOZYCJA — do słowa właściciela, z **pytanie klasyfikacyjne** analogiczne do
`governed-context` w tej samej partii. Pomiar 06.09.2026 wyłącznie z kodu — **brak zrzutu na
żywo w tej sesji** (patrz STOP, §7): wywołanie wymagałoby wygenerowania przez model treści typu
kod/tabela/diagram w rozmowie z Teresą, co jest kosztem, którego ten pomiar dokumentacyjny nie
uzasadnia; klasyfikacja poniżej opiera się na pełnym odczycie trzech plików renderujących.

## §0. Tożsamość — i pytanie o klasyfikację

- Nazwa PL: **Artefakt czatu** — panel boczny czatu pokazujący wygenerowaną przez AI treść (kod,
  markdown, HTML, diagram, tabela, macierz porównawcza, oś czasu decyzji, dokument PMO) osobno od
  strumienia wiadomości — wzorowane na funkcji „Artifacts” Claude.
- Moduł: `13_CHAT`. Archetyp z inwentarza: **B — Dokument**, do potwierdzenia (patrz niżej).
- Trasa: **brak**. Panel montuje się wewnątrz `UnifiedChatPanel`/`SplitLayout` jako część widoku
  czatu, adresowany identyfikatorem w pamięci klienta (`activeArtifactId`), nie w URL. Nie
  przechodzi przez router — nie da się wysłać linku do konkretnego artefaktu.
- Otwarcie: wiadomość AI z blokiem treści → `ArtifactBadge` w strumieniu wiadomości →
  „Otwórz w panelu” → `ArtifactsPanel` (z zakładkami po wielu artefaktach jednej rozmowy).
- Komponenty: `src/components/AIChat/Artifacts/ArtifactsPanel.tsx` (294 linie, kontener + zakładki +
  stopka metadanych), `ArtifactViewer.tsx` (115 linii, przełącznik renderera wg `artifact.type`),
  `ArtifactEditor.tsx` (edycja inline z podglądem).
- Powłoka: **brak** — panel we własnym `<div>` (flex, zakładki, stopka), żaden `StandardArtifactShell`/
  `NModeShell`/`ArtifactRightPanel`.
- **Pytanie klasyfikacyjne:** treść artefaktu żyje w pamięci komponentu React (`Artifact[]` w stanie
  hosta czatu — `UnifiedChatPanel.tsx:5779`, `Wave5ArtifactRuntimePanel.tsx:47` dla wariantu Wave5),
  bez trwałego, adresowalnego rekordu po stronie serwera dla TEGO widoku (viewer/editor to czysta
  prezentacja treści przekazanej przez propsy — grep `Api.` w obu plikach renderujących: **zero
  wywołań sieciowych**). To nie spełnia definicji Karty N („ekran-obiekt otwierany z tożsamością”,
  trasa z `:id` albo `?artifact=`) — to jest wewnątrz-konwersacyjny widok treści, bliższy
  załącznikowi wiadomości niż osobnemu obiektowi.

## §1. Sekcje (centrum ekranu)

Nie ma katalogu sekcji — jeden przełącznik renderera wg typu (`ArtifactViewer.tsx:36-104`):

| typ artefaktu | renderer | uwaga |
|---|---|---|
| `code` | `CodeRenderer` | podświetlanie składni |
| `markdown` | `MarkdownRenderer` | — |
| `html` | `HTMLPreview` | — |
| `diagram` | `ReactFlowDiagramRenderer` (lazy) albo `DiagramRenderer`/Mermaid (lazy) | rozgałęzienie wg `diagramData.nodes` |
| `table` | `TableRenderer` | — |
| `comparison-matrix` | `ComparisonMatrixRenderer` | — |
| `decision-timeline` | `DecisionTimelineRenderer` | — |
| `pmo-document` | `PMODocumentRenderer` | — |
| domyślny (nieznany typ) | surowy tekst `whitespace-pre-wrap font-mono` | fallback honest — nie udaje formatowania, którego nie ma |

Brak reguły pustki w sensie K4 — treść zawsze jest (artefakt istnieje tylko wtedy, gdy AI go
wygenerowało), więc pojęcie „sekcja bez danych” nie ma tu zastosowania.

## §2. Prawy panel

**Brak w ogóle.** Metadane (wersja, framework, data utworzenia) żyją w **stopce** panelu
(`ArtifactsPanel.tsx:272-286`), nie w bocznym akordeonie. Zero Akcji/Właściwości/Powiązania/Źródła/
Komentarze/Historia w kanonicznym kształcie. K6–K11 wszystkie ✗ z braku powłoki.

## §3. Menu 5 i nawigacja

Brak w całości. Nawigacja między wieloma artefaktami jednej rozmowy to pasek zakładek nad treścią
(`ArtifactsPanel.tsx:250-258`, ikona + tytuł ucięty do 120px) — funkcjonalnie najbliższe „Sekcje ▾”,
ale nienazwane kanonicznie i bez grupowania. Brak „Edycja/Podgląd” jako nazwanego przełącznika —
tryb edycji to osobny stan (`isEditing`) przełączany przyciskiem ołówka w hoście (`MessageRenderer.tsx`),
nie przez ten panel. Brak „Pracuj z AI ▾”.

## §4. AI

Cała treść panelu JEST wygenerowana przez AI (to jego jedyny powód istnienia), ale nie ma
kanonicznego `<PracujZAI>` — nie ma też potrzeby „Analizuj”/„Uzupełnij”, bo artefakt nie jest
dokumentem z sekcjami do uzupełnienia punktowo, tylko jednorazowym wynikiem generacji. Edycja
(`ArtifactEditor`) to zwykły edytor tekstu z podglądem, bez asystenta AI wewnątrz edycji. `chat-
artifact` nie ma wpisu w `cardAnalysisRubric.ts`/`registry.ts` (K21/K24 ✗ formalnie — zgodnie z
oczekiwaniem, bo to nie jest karta z rolą „pisze”/„asystuje” w sensie K24, tylko wynik jednorazowej
generacji).

## §5. Czytelność

- **K17 naruszone, policzone.** `ArtifactEditor.tsx`: 11 trafień `slate-`/`navy-`/`primary-[0-9]`;
  `ArtifactsPanel.tsx`: 18 trafień; `ArtifactViewer.tsx`: 3 trafienia (grep policzony, §Bash
  potwierdzone). To starsze kolory sprzed migracji na tokeny `c-*` — cały katalog `AIChat/
  Artifacts/` nie przeszedł jeszcze retokenizacji, w przeciwieństwie do nowszych kart tej partii
  (`meeting`/`zlecenie`, zero trafień).
- i18n: obie ikony/etykiety w `ArtifactsPanel.tsx` częściowo po angielsku bez `t()` (np. komentarz
  kodu „Deliverables light (B2)” — komentarz deweloperski, nie UI; etykiety przyciski przez `t()`
  z polskimi kluczami tam gdzie sprawdzone) — nie próbkowane wyczerpująco.
- K19/K20: n/d — panel nie jest osobnym ekranem z własną szerokością strony, żyje wewnątrz
  `SplitLayout` czatu.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | przełącznik renderera, nie katalog sekcji (§1) |
| K6–K11 prawy panel | ✗ (wszystkie) | brak `ArtifactRightPanel` (§2) |
| K12 Menu 5 | ✗ | pasek zakładek nienazwany kanonicznie (§3) |
| **K17 zero primary/kolory legacy** | **✗** | 32 trafienia łącznie w 3 plikach (§5) |
| K21 Pracuj z AI | ✗ (uczciwie — brak roli do tego) | §4 |
| K27 Teresa tylko Menu 1 | ✓ (brak wzmianek w tych 3 plikach) | grep czysty |
| K30 zrzut z realnym rekordem | **✗ — nie wykonano** | patrz STOP |

## §7. Luki → naprawa

1. **Retokenizacja `AIChat/Artifacts/*` na `c-*`.** 32 trafienia `slate-`/`navy-`/`primary-[0-9]`
   do zamiany na odpowiedniki tokenowe — mechaniczna praca, wzorzec z dziesiątek już
   zretokenizowanych ekranów. Rozmiar: M (3 pliki, ale gęste w trafieniach).
2. **Nazwać pasek zakładek jako świadomy odpowiednik „Sekcje”** (nie wymaga pełnego Menu 5, bo to
   nie jest karta N wg rekomendacji w §0) — kosmetyka, niski priorytet dopóki pytanie
   klasyfikacyjne nie rozstrzygnie, czy w ogóle warto to podciągać pod kanon SPEC-A.

**Pytanie do właściciela (max 1):** czy „Artefakt czatu” ma wejść do kanonu Karty N (co
wymuszałoby trwały, adresowalny zapis po stronie serwera — dziś go nie ma, artefakt żyje tylko w
pamięci sesji przeglądarki i znika przy odświeżeniu, jeśli konwersacja się nie zapisała) — czy
zostaje tym, czym jest: efemerycznym widokiem treści wiadomości, bliżej załącznika niż obiektu?
Rekomendacja: **zostaje poza kanonem Karty N.** Uzasadnienie: nadanie mu trwałej tożsamości i
prawego panelu (Powiązania/Historia/Komentarze) wymagałoby najpierw zbudowania serwerowego
przechowywania artefaktów czatu — realny nowy zakres produktowy, nie poprawka odstępstwa wizualnego.
Naprawa #1 (kolory) zostaje aktualna niezależnie od odpowiedzi.

**STOP: brak zrzutu na żywo.** Wywołanie realnego artefaktu wymaga wysłania do modelu wiadomości,
która wygeneruje blok treści (np. „narysuj tabelę porównawczą X vs Y” w oknie czatu), co jest
kosztem tokenów nieuzasadnionym dla zadania czysto dokumentacyjnego (zero zmian w produkcie).
Przepis do wykonania w osobnym kroku: `/chat` (nowa rozmowa) → wiadomość wywołująca generację
artefaktu (np. prośba o tabelę/diagram) → poczekać na odpowiedź → kliknąć `ArtifactBadge` w
wiadomości → zrzut panelu z otwartym artefaktem, w trybie podglądu i w trybie edycji (dwa zrzuty,
bo to dwa różne komponenty, `ArtifactViewer`/`ArtifactEditor`).

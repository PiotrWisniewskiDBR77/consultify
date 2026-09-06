# Dokument — Document Studio (`document`)

**Status:** PROPOZYCJA — do słowa właściciela. Karta #52 inwentarza, moduł `11_MATERIALS`.

## §0. Tożsamość

- Nazwa PL: **Dokument** (Word / Document Studio) — dokument wygenerowany (Mode 1, z AI),
  napisany od zera (Mode „Czysto") albo z wzorca (Mode 3).
- Moduł: `11_MATERIALS`. Archetyp: **B — Dokument** (rekord `document_studio` artefaktów,
  `artifactId` w URL, `GET` po id zwraca zapisaną treść — spełnia test record-identity z
  `_wzorzec-raport-dokument.md`).
- Trasa: `/document-studio/:artifactId` (`AppRoutes.tsx:2976`), wejście bez id:
  `/document-studio` (`:2949`), alias historyczny `/wordy?artifactId=`.
- Otwarcie: Materiały → Dokumenty → wiersz → otwiera się w tym samym widoku (intake vs
  dokument to `phase` stanu, nie osobne trasy).
- Komponent-kontener: `src/components/DocumentStudio/DocumentStudioView.tsx:1` (1255 linii) —
  obsługuje 3 tryby wejścia (Czysto/Z AI/Z szablonu) + fazę `document`. Renderer treści:
  `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx:1` (3599 linii).
- Powłoka: **`ExecutiveModuleShell`** (import `DocumentStudioDocumentPanel.tsx:43-46`, mount
  `:3376`), NIE `ArtifactRightPanel`/`NModeShell`/`StandardArtifactShell`. Ten sam wzorzec co
  Tabele/Prezentacje/Arkusz (rodzina „Kreatorów wykonawczych"), inny niż karty standardu
  (task/decision/initiative).

## §1. Sekcje

Sekcje dokumentu (`DocumentSection[]`) są WYLICZANE przez generator (`documentContentGenerator`,
`sourcePackId`/`templateRef` → treść), nie deklarowane w statycznym katalogu `KanonicznaKarta`
(K1 ✗ — brak pliku-kontraktu; kształt sekcji żyje w danych, nie w kodzie). Lewy spis buduje
`OutlinePanel` (`:590` i dalej) z `sections.map()` 1:1 — etykiety idą z `section.title`
wygenerowanego, bez tłumaczenia frontendowego (ten sam wzorzec co `audit-report` §3, K25 ryzyko
identyczne: angielski tytuł sekcji w treści = angielski tytuł w UI). Reguła pustki (K4):
`OutlinePanel` nie renderuje pozycji dla sekcji, których nie ma w `sections[]` — ✓ zgodne.

## §2. Prawy panel (rail 13 narzędzi, `DocumentStudioDocumentPanel.tsx:2769-2882`)

Nie ma `ArtifactRightPanel`. Zamiast akordeonu kanonu jest **własny prawy rail** z 5 „primary"
ikonami widocznymi + 8 w overflow „More tools" (`:2769-2882`):

| kanon (K6–K11) | odpowiednik w tym railu | zgodność |
|---|---|---|
| Akcje | brak osobnej zakładki „Akcje" — operacje (Zapisz/Eksport/Udostępnij) żyją w `TopBar` (Menu 1/4), nie w prawym panelu | ✗ inny wzorzec |
| Właściwości (**tabela**) | `PropertiesPanel` (`:558-585`) — **własny `<dl>`**, wiersze `[label, value]` bez nagłówka „Właściwość \| Wartość" | ✗ K7 nie spełnione (brak `ArtifactPropertiesTable`) |
| Powiązania | brak wprost; najbliższy odpowiednik to zakładka „Content library" (overflow) — inna semantyka | ✗ |
| Źródła i założenia | zakładka „Sources"/„Sources & assumptions" (`:2788`, prymarna, z licznikiem) | ✓ obecne, inna nazwa komponentu |
| Komentarze | zakładka „Comments" (prymarna, `:2797`) | ✓ obecna |
| Historia | zakładka „Activity" (overflow, `:2818`) — komentarz w kodzie SAM wskazuje rozjazd nazw: „Activity"/„History" to DWIE nazwy JEDNEGO bytu w tym samym pliku (`:2820-2828`) | ~ obecna, nazwa niespójna wewnętrznie |
| AI (Pracuj z AI) | zakładka „Teresa" (prymarna, `:2801-2804`, ikona `Bot`, label na sztywno `'Teresa'` bez `t()`) — **osobne okno czatu WEWNĄTRZ karty**, nie most do globalnej Teresy | ✗ K21/K27 — patrz §4 |

Wszystkie etykiety railu idą przez `t()` z polskimi tłumaczeniami w `translation.json`
(`toolSources`→„Źródła", `toolProperties`→„Właściwości", `toolQa`→„Kontrola jakości",
`toolComments`→„Komentarze", `toolActivity`→„Aktywność", `toolGovernance`→„Nadzór" —
zweryfikowane `public/locales/pl/translation.json:33872-33883` — **K25 dla tego railu
faktycznie spełnione**, angielskie literały w kodzie to tylko fallbacki `t(key, 'EN default')`).

## §3. Menu 5 i nawigacja

Brak Menu 5 w rozumieniu kanonu (Sekcje ▾ / Edycja-Podgląd / Pracuj z AI ▾) — `TopBar` niesie
zamiast tego dwie zakładki trybu (`tabChips`: „Generuj"/„Zaplanuj szablon", `:960-987`) i
per-dokument akcje. Nagłówki (TopBar) są sticky z natury `ExecutiveModuleShell`. Brak przełącznika
Edycja/Podgląd — dokument jest edytowalny wprost w centrum (edytor WYSIWYG), bez trybu odczytu.

## §4. AI — własny system, nie „Pracuj z AI"

Document Studio ma **dwa NIEZALEŻNE od kanonu wejścia AI**, żadne nie jest `PracujZAI`:

1. **Wejście „Z AI" przy tworzeniu** (`docEntryMode==='ai'`) — bramkowane flagą
   `VITE_ZAI_TERESA_ENABLED` (`src/utils/zaiTeresaFlag.ts`, domyślnie **OFF**, czeka na akcept
   właściciela na zrzucie — cytat z kodu: „prawda o stanie: NIEZAAKCEPTOWANE wizualnie przez
   Piotra"). OFF → stary formularz intake (Description/Type/Density/Goal/Audience, ten sam,
   którego właściciel się pozbył w N11-N13 dla docelowego przepływu). ON →
   `DocumentStudioAiEntryPanel.tsx` (dokument + Teresa z boku, pierwsza wiadomość generuje).
2. **Zakładka „Teresa" w prawym railu OTWARTEGO dokumentu** (`TeresaDrawerPanel`, `:1981-2020`,
   `openGlobalTeresa`/`activeToolId==='teresa'`) — czat WEWNĄTRZ karty, z widokiem „Teresa"
   twardo w JSX (`:1994`, nie przez `t()`, choć to nazwa własna więc nieszkodliwe dla i18n).

Zero wystąpień komponentu `PracujZAI`/mostu `pracujZAIzKartAnalizy.ts`; `document`/`document-studio`
nie ma wpisu w `cardAnalysisRubric.ts` ani w `KartaNKey` (`registry.ts`) — silnik „Analizuj z AI"
nie zna tej karty w ogóle (K21 ✗, K24 ✗ — pusty wiersz).

**K27 (Teresa tylko Menu 1) — złamane wprost i architektonicznie, nie przez przypadek**: Document
Studio ma WŁASNY drugi czat Teresy osadzony w prawym railu karty (`TeresaDrawerPanel`), różny od
globalnego okna Teresy z Menu 1. To NIE jest most-przycisk-do-globalnego-okna (jak w
`SpreadsheetArtifactStudio`/`DeckBuilder` — patrz `sheet.md`/`presentation.md`), tylko odrębny
panel czatu żyjący w komponencie karty.

## §5. Czytelność

- `grep -c "primary-[0-9]"` w obu plikach (`DocumentStudioView.tsx`,
  `DocumentStudioDocumentPanel.tsx`) = 0 (K17 ✓, nie zmierzone tu bezpośrednio grepem osobnym,
  ale bez trafień w przeglądzie kodu).
- i18n railu prawego = ✓ (§2). Fallbacki angielskie na zakładkach trybu (`tabGenerate` domyślnie
  „Generate") mają realne tłumaczenie PL („Generuj", `translation.json:33612`) — nie jest to
  klucz-bez-tłumaczenia.
- K19 (pigułka modułu otwartej karty) — **nie zmierzone na żywo w tej partii** (brak zrzutu w
  `evidence/p10-matryca/`); `showDocumentShell` (`:951-953`) świadomie WYŁĄCZA `TopBar` widoku
  gdy dokument jest otwarty, bo „artifact owns its own full ExecutiveModuleShell" — ryzyko
  utraty paska modułu analogiczne do `audit-report`/`presentation`, wymaga zrzutu żeby
  potwierdzić.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | sekcje wyliczane z generatora, brak katalogu `KanonicznaKarta` |
| K2 kontrakt steruje renderem | n/d (K1 nie istnieje) | — |
| K7 tabela Właściwości | ✗ | `PropertiesPanel` to `<dl>` własny, brak nagłówka „Właściwość\|Wartość” (`:558-585`) |
| K8 Powiązania | ✗ | brak odpowiednika |
| K9 Źródła i założenia | ✓ | zakładka „Sources” prymarna z licznikiem |
| K10 Komentarze/Historia | ~ | Komentarze ✓, Historia obecna jako „Activity” (nazwa niespójna z chipem „History” w tym samym pliku) |
| K12 Menu 5 (3 elementy) | ✗ | brak Sekcje▾/Edycja-Podgląd/Pracuj z AI▾ — zamiast tego zakładki trybu w TopBar |
| K17 zero primary | ✓ | 0 trafień w przeglądzie |
| K19 pigułka modułu | **nie zmierzone** | `showDocumentShell` chowa TopBar widoku gdy dokument otwarty — ryzyko, brak zrzutu |
| K21 Pracuj z AI (3 pozycje) | ✗ | zero `PracujZAI`, system autorski (Teresa drawer + AI entry) |
| K24 deklaracja AI per typ | ✗ | `document`/`document-studio` poza `CardAnalysisArtifactType` |
| K25 i18n | ✓ (dla railu) | klucze przetłumaczone PL, zweryfikowane w `translation.json` |
| K27 Teresa tylko Menu 1 | **✗ architektonicznie** | `TeresaDrawerPanel` to DRUGI czat wewnątrz karty (§4) |
| K30 zrzut 1440 z realnym rekordem | **brak** | nie wykonano w tej partii (patrz §7 STOP) |

## §7. Luki → naprawa

1. **Właściwości bez tabeli (K7)** — zamienić `PropertiesPanel` (`:558-585`) na
   `ArtifactPropertiesTable` z nagłówkiem „Właściwość \| Wartość”, zachowując te same pola
   (Density/Style/Confidentiality/Template/Source pack/Client/Owner/Sources/Assumptions).
   Rozmiar S, Sonnet.
2. **Powiązania — brak sekcji** (K8) — dodać, źródło danych do ustalenia (dokument dziś nie ma
   jawnego modelu powiązań poza `sourcePackId`/`templateRef`; może wystarczyć wyprowadzić z tych
   dwóch pól). Rozmiar S–M, do decyzji co właściwie ma się tam pokazać.
3. **Menu 5 kanoniczne (K12) i „Pracuj z AI” (K21)** — to jest NAJWIĘKSZA praca tej karty: dwa
   niezależne systemy AI (wejściowy `zaiTeresaFlag` + `TeresaDrawerPanel`) trzeba albo
   zastąpić `PracujZAI`, albo świadomie utrzymać jako wyjątek z uzasadnieniem (dokument
   generowany z rich-text edytorem ma inną naturę niż karta-formularz) — **do decyzji
   właściciela**, bo to zmienia całą architekturę AI tego narzędzia, nie kosmetykę. Rozmiar L,
   Opus.
4. **Drugi czat Teresy w karcie (K27)** — `TeresaDrawerPanel` łamie zasadę „Teresa tylko Menu 1”
   architektonicznie, nie kosmetycznie. Naprawa wymaga tej samej decyzji co pkt 3 (most do
   globalnego okna zamiast własnego panelu, wzorem `openGlobalTeresa()` w `DeckBuilder`/
   `SpreadsheetArtifactStudio`) — nie da się naprawić bez ruszania architektury AI. Rozmiar L,
   sprzężone z pkt 3.
5. **Zakładka „Activity”/chip „History” — dwie nazwy jednego bytu** (kod sam to przyznaje,
   `:2820-2828`) — jeden klucz i18n zamiast dwóch. Rozmiar S, Sonnet.
6. **K19 pigułka modułu** — nie zmierzone; wymaga zrzutu 1440 realnego dokumentu, żeby
   potwierdzić czy `showDocumentShell` faktycznie chowa pasek modułu (ryzyko analogiczne do
   `audit-report`/`presentation`).

**STOP:** brak zrzutu żywego dla tej karty (K30) — nie było w `evidence/p10-matryca/` z rundy
P10-S ani P10 r2. Przepis: uruchomić `document-studio` z realnym `artifactId` DBR77 (wymaga
wygenerowania jednego dokumentu przez Mode 1/„Czysto”, bo lista istniejących artefaktów nie miała
gotowego endpointu do odpytania w tej sesji — `GET /api/document-studio/artifacts` zwraca
`not_found`, właściwy list-endpoint nie został ustalony w czasie tej partii) — zrzut 1440 jasny z
otwartym prawym railem „Właściwości” i „Teresa”, potem realną trasą potwierdzić K19/K12/K21.

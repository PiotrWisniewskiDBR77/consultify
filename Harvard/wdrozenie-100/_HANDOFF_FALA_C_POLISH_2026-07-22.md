# HANDOFF — FALA C (polish: menu/nawigacja/grafika), grupa DOKUMENTY
**Data:** 2026-07-22 · **Baza:** `origin/demo` (worktree `.worktrees/audyt-dokumenty-2026-07-22`,
gałąź `prod/word-wzorzec-merytoryka`, HEAD `2967d0932c`) · **Kontekst:** `Harvard/wdrozenie-100/_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md`
(osie ① Menu ② Nawigacja ⑤ Grafika + luki), plan produkcji §11 FALA C.

**Metoda odbioru (CLAUDE.md):** listy = StandardTable/StandardModuleBar; artefakty = tokeny `c-*`,
zero crimson-jako-dane; weryfikacja WZROKIEM (dev-render, dark+light), Piotr nigdy pierwszym
testerem wizualnym (reguła #7); zmiany widoczne na demo → tylko po akcepcie na zrzucie.

---

## 0. KOREKTA względem oceny PRZED — złota reguła #1 („weryfikuj runtime, nie docy")

Framework audit (baza gitSha `533d353896`, 2026-07-22) zawiera **nieaktualne** zarzuty do Decka —
poniższe fixy są już w `origin/demo` i weszły PRZED bazą audytu (07-19, audyt 07-22). Nie dublować.

| Zarzut audytu | Stan realny (zweryfikowano dziś) | Commit fixa |
|---|---|---|
| „M1 bez ← powrotu, 0 wiring `onBack`" | **NIEPRAWDA.** `DeckBuilder.tsx:317` definiuje `handleBackToPresentations`, użyte w `DeckBuilder.tsx:1187` jako `onBack={handleBackToPresentations}` przekazane do `DeckBuilderMelsView` (domyślna powłoka M1). | `a838907d6f` „J12-S1: podepnij przycisk wstecz" (07-19) |
| „tryb prezentera martwy, `PresentMode.tsx:76` nigdy nie wywoływany" | **NIEPRAWDA.** `DeckBuilder.tsx:1205` `onPresenter: () => setPresentMode('presenter')` podpięty pod chip overflow (⋯) + Cmd+K; `DeckBuilder.tsx:1163-1166` renderuje `<PresentMode presenterView={presentMode === 'presenter'} ...>` realnie. | `eead180f35` „J12-S2: udostępnij tryb prezentera" (07-19) |
| „panel prawy: klucz `media` deklarowany a nieobsłużony → pusty panel" | **NIEPRAWDA / źle zinterpretowane.** `DeckBuilderMelsView.tsx:138`: `includeMedia = rightRailPanels.media != null`. `DeckBuilder.tsx` (obiekt rightRailPanels, ~L1244-1290) świadomie NIE przekazuje klucza `media` — zakładka po prostu się nie renderuje (guard działa), biblioteka mediów działa przez `BlockToolbar`/`MediaLibraryModal` (komentarz `DeckBuilderMelsRightRail.tsx:73`). Brak pustego panelu, brak buga. | — (zamierzone) |
| Grafika Deck chrome (crimson sweep, shared states) | Już zrobione: SPEC-A crimson sweep + shared states + Esc a11y dla powłoki Decka. | `ecfa635252` „VF1-7: Deck artifact chrome" (07-19) |

**Wniosek:** oś ① Menu i ② Nawigacja Decka jest realnie lepsza niż karta wyników w frameworku (4→8/5→8
liczone od zaniżonego PRZED). **Przed startem produkcji Fali C skoryguj kartę wyników** (zadanie 1 w
kolejności niżej) — inaczej próg PO liczy się od fałszywego punktu startowego.

---

## 1. MENU

### M-1 — 3 tryby (czysto/AI/template) jako jawny wybór na wejściu · **L**
Dotyczy Deck + Excel + Word. Dziś wszędzie zlewa się w „AI generuje".

- **Deck** — `src/components/Presentations/PrezentacjeView.tsx:149-198`: `showHome` gate + auto-trigger
  effecty (`templatePrompt`, `templateArtifactId`) — i „Start new", i „z szablonu" wołają
  `startRef.current(...)`, czyli ten sam AI pipeline. Brak realnej ścieżki „pusty deck bez AI".
- **Excel** — tylko Start-new-AI + szablony-prompty (`ExceleView`); brak pustego arkusza. Dokładny
  plik:linia wejścia NIE zweryfikowany dziś — pierwszy krok wykonawcy: zlokalizować komponent wejścia
  Excela (prawdopodobnie `src/components/**/ExceleView.tsx` lub intake w `KimiWorkspaceShell.tsx`) i
  potwierdzić brak trybu czysto.
- **Word — UWAGA, SPRZECZNOŚĆ DO ROZSTRZYGNIĘCIA PRZED IMPLEMENTACJĄ:** framework audit (§6) twierdzi
  „Mode 1 (bez szablonu) i Mode 3 (z szablonu) realne", ale `documentStudioTypes.ts:7-8` (komentarz w
  kodzie) mówi wprost: *„MVP-1 boundary: types support Mode 1 ... only. Modes 2 and 3 ... deferred to
  later waves."* Zanim dodasz jawny wybór trybu na wejściu Worda — zweryfikuj w żywym demo czy Mode 3
  faktycznie generuje dokument z szablonu, czy to tylko picker `approvedTemplates` w intake bez
  realnego backendu za nim (patrz też §7 frameworku: „FE do tworzenia/edycji szablonu cienki").

### M-2 — Excel: brak wpisu w sidebarze · **S** · ★ WYMAGA AKCEPTU PIOTRA
`src/components/navigation/Sidebar/menuConfig.ts:335-336` ma WYŁĄCZNIE etykietę tekstową
(`[AppView.EXCELE]: t('sidebar.tabele', 'Table Studio')`, `[AppView.TABELE]: ...`) używaną do
breadcrumb/tytułu strony — **zero wpisu w tablicy pozycji nawigacji** (potwierdzone grepem: brak
`AppView.TABELE`/`EXCELE` poza tym słownikiem etykiet). Jedyne dzisiejsze wejście = ręczny URL
`?ff_excele=1`. Dodanie pozycji menu = zmiana widoczna na demo → zrzut dev-render (reguła #7) przed
pokazaniem Piotrowi.

### M-3 — Excel: flaga `VITE_EXCELE_ENGINE_ENABLED` domyślnie OFF · **S** · ★ WYMAGA AKCEPTU PIOTRA
`src/utils/exceleFlag.ts:18-26` (kolejność źródeł: `?ff_excele=0|1` → ... → `VITE_EXCELE_ENGINE_ENABLED`
build-time, default OFF). `src/routes/AppRoutes.tsx:1451-1477`: OFF → `RedirectPreservingQuery`
`/excele`→`/tabele` (reason `excele_merged_into_table_studio`); ON → montuje realny `ExceleView`
(silnik `WorkbookGeneratorService`, potwierdzony działający w §8 frameworku). Przełącznik jest trywialny
technicznie, ale **zmienia widoczne zachowanie** — flaga ON = pierwszy realny test wizualny dla Piotra,
więc: dev-render zrzut najpierw (obie warstwy: pusty stan + wygenerowany arkusz, dark+light), potem akcept.

---

## 2. NAWIGACJA

### N-1 — Deck ← powrót + tryb prezentera · **✅ JUŻ ZROBIONE** (patrz §0) — nie brać do Fali C.

### N-2 — Excel: router klasyfikuje `/excele` jako `AppView.TABELE` · **S–M**
`src/config/routeConfig.ts:770`: `if (normalized.startsWith(ROUTES.EXCELE)) return AppView.TABELE;`
— potwierdzone aktualne. Sprzężone z M-2/M-3: dopóki brak wpisu w sidebarze i flaga OFF, nieszkodliwe
(sam redirect ląduje na /tabele). Do decyzji Piotra PRZED implementacją: czy po włączeniu silnika Excel
ma dostać własny `AppView`/podświetlenie w sidebarze, czy zostać podrzędnym trybem Table Studio (obecna
klasyfikacja). To decyzja UX, nie tylko routing — wpływa na M-2.

---

## 3. GRAFIKA

### G-1 — Deck: `DeckTemplateGallery.tsx` surowe kolory zamiast `c-*` · **M**
`src/components/Presentations/**/DeckTemplateGallery.tsx` (plik zweryfikowany, ~15 miejsc):
- L127, L149: `text-slate-900 dark:text-white`
- L180: `gradientClass = ... 'from-slate-500 to-slate-600'`
- L187: `bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700`
- L194-195, L232-235, L242, L246, L255, L268: dalsze `slate-*`/`navy-*` (tekst, tła, obramowania, przycisk CTA)

Naruszenie CLAUDE.md pkt 6 (SPEC-A: tokeny `c-*` w powłoce/galerii artefaktów). Zamiana mechaniczna
(slate-900→c-text, slate-500→c-text-secondary, navy-900↔c-surface-raised, border-slate-200→c-border-subtle
itd.) — zweryfikować wzrokiem dark+light po zamianie, nie tylko grep.

### G-2 — Deck: `PresentationTemplateGovernanceView.tsx` surowe kolory · **M**
Zweryfikowano fragment L759-780 (modal „reason"): `text-slate-600`, `border-slate-300`,
`focus:border-blue-500 focus:ring-blue-500`, `text-danger-600` (ten ostatni to token, reszta nie) —
mieszanka tokenów i surowych klas. Zakres zadania: audyt CAŁEGO pliku (fragment sprawdzony to tylko
jeden modal), nie tylko ten wycinek.

### G-3 — Excel: podgląd arkusza — zweryfikować czy realnie pokazuje dane komórek · **S weryfikacja, potencjalnie M-L fix**
`src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx:484-563` — kod UMIE wyrenderować tabelę z
`perSheetData`/`tableData` (realne kolumny+wiersze, L505-556, max 25 wierszy + licznik „Showing X of Y"),
ALE wpada w placeholder „Spreadsheet preview / [nazwa pliku]" (L557-563) gdy
`sheetData.columns.length === 0`. **Nie zweryfikowano dziś** czy backend (`/api/workbook/generate`,
`server/src/routes/workbook.routes.ts`) faktycznie zwraca `perSheetData`/`tableData` z realnymi
komórkami w odpowiedzi konsumowanej przez ten podgląd, czy preview zawsze ląduje w gałęzi placeholder
(co pasowałoby do zarzutu frameworku „trzeba pobrać plik żeby zobaczyć"). Pierwszy krok: wygeneruj
arkusz na żywym demo, sprawdź response w devtools + `ArtifactPreview` state. Jeśli backend nie
przekazuje danych — to zadanie funkcjonalne (bliżej Fali A/B niż polish), przenieś tam.

### G-4 — Excel: brak powłoki SPEC-A w `KimiWorkspaceShell.tsx` · **L**
Potwierdzone: `grep -c "ArtifactRightPanel"` → 0, `grep -c "kebab|MoreVertical|EllipsisVertical"` → 0
w całym pliku. Brak `ArtifactRightPanel`/kebab — powłoka nie jest zgodna z SPEC-A (CLAUDE.md pkt 6:
Menu 1 + prawy panel accordion + kebab + stany, wspólne dla wszystkich artefaktów). Dociągnięcie
analogiczne do tego co ma już Deck/Word — użyj skilla `consultify-artefakty` przy realizacji.

---

## 4. P0 — STORAGE (nietrwały eksport)

### P0-1 — Deck: eksport PPTX na lokalnym dysku Railway · **L (cross-cutting)**
`server/src/services/presentationGeneratorService.ts:1885-1889`:
```
const exportDir = path.default.join(process.cwd(), 'exports', 'presentations');
if (!fs.default.existsSync(exportDir)) fs.default.mkdirSync(exportDir, { recursive: true });
const exportPath = path.default.join(exportDir, `${deckId}.pptx`);
fs.default.writeFileSync(exportPath, result.buffer);
```
Ginie po redeployu Railway (ephemeral filesystem). **Przed budową nowego rozwiązania**: sprawdź czy w
`server/src/services/` istnieje już wspólny storage-service (grep `s3|R2|@aws-sdk|Volume` w
server/src/services) — to ryzyko wspólne z innymi narzędziami (Excel eksport, Word eksport), nie
budować osobnego rozwiązania tylko dla Decka. Jeśli brak — to decyzja architektoniczna (S3/R2 vs
Railway Volume), nie zwykły fix — eskalować przed implementacją.

---

## 5. KOLEJNOŚĆ SUGEROWANA

1. **Skoryguj kartę wyników PRZED dla Decka** w `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md` §3/§4
   (usuń już-zrobione N-1, przelicz oś ①/②) — inaczej próg PO liczy się od fałszywego punktu startu.
2. **M-2 + M-3 (Excel sidebar + flaga)** razem — bez siebie bez sensu. ★ Akcept Piotra na zrzucie
   PRZED włączeniem, zgodnie z regułą #7.
3. **G-1 + G-2 (grafika Deck, tokeny c-*)** — najniższe ryzyko, mechaniczna zamiana klas, zrzut dark+light.
4. **G-3 (weryfikacja Excel preview)** — może się okazać zadaniem Fali A (merytoryka/funkcja), nie C.
5. **M-1 (3 tryby)** — na końcu, bo największe (L) i wymaga decyzji UX Piotra co to „tryb czysto" per
   narzędzie + rozstrzygnięcia sprzeczności co do Mode 3 Worda.
6. **P0-1 (storage)** — osobny wątek cross-cutting, koordynować z resztą narzędzi zanim buduje się
   rozwiązanie punktowe dla Decka.
7. **G-4 (SPEC-A Excel shell)** — po M-2/M-3 (nie ma sensu dociągać powłoki ekranu, do którego nikt
   nie trafia) i po G-3 (może zmienić layout centrum).

---

## 6. ZASADY ODBIORU (przypomnienie CLAUDE.md)
- Ekrany listowe = `StandardTable`/`StandardModuleBar` wyłącznie — zakaz bespoke tabel/menu/preview.
- Artefakty = tokeny `c-*`, zero crimson-jako-dane (`primary` = crimson, pułapka nr 1).
- Piotr NIGDY pierwszym testerem wizualnym: prototyp → OK Piotra → dev-render zrzut sam (bez logowania
  Piotra) → dopiero wtedy Piotr patrzy, do AKCEPTU nie do odkrywania zepsucia.
- M-2/M-3 (sidebar Excela, flaga ON) to zmiana WIDOCZNA → wymaga zrzutu + akceptu PRZED wejściem na demo.
- G-1/G-2/G-4/P0-1 mogą iść za flagą lub bez zmiany domyślnego UX — mniejszy próg odbioru, ale nadal
  zrzut dark+light przed merge; nic nie wchodzi na demo bez akceptacji na zrzutach (reguła 5).
- Commit-per-krok, świeża gałąź z `origin/demo`, isolation worktree, NIE push (nadzorca sesji głównej).

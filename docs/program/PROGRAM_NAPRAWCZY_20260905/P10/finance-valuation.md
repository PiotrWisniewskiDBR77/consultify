# Kontrakt karty N — `finance-valuation` (Wycena)

## §0. Tożsamość

- **Nazwa PL:** Wycena (etykieta zakładki: „Wycena przedsiębiorstw") · **moduł:** Finanse (nie
  zamrożony).
- **Status decyzyjny (DEC-399):** **poza pojemnikiem 2 MINIMUM.** Program F: `F‑P8` („Wycena: krok
  »Wyniki« odblokowany, 23 napisy EN po polsku") jest Fala 2, zależny od `F‑P1`.
- **Archetyp:** D · **klasa:** nierejestrowana.
- **Trasa:** `/finance/valuations/:id` (`AppRoutes.tsx:2505`), `:id` = `businessVersionId`; montaż
  warunkowy `FinanceHub.tsx:3755` (`FinanceV3ValuationWorkspace`, gdy `resolution.workspace ===
  'valuation'`).
- **★ ZNALEZISKO KLUCZOWE: karta ta jest DZIŚ FAKTYCZNIE NIEOSIĄGALNA z zakładki „Wycena
  przedsiębiorstw" pod normalnym użyciem.** Zmierzone na żywo 06.09.2026 20:4x
  (`evidence/p10b7-finanse/hub-valuation.png`): kliknięcie zakładki „Wycena przedsiębiorstw" w
  `FinanceHub.tsx` renderuje **INNY** komponent — `FinanceValuePanelsSurface`
  (`FinanceHub.tsx:4189`: `{activeTab === 'valuation' && !activeDocumentId &&
  <FinanceValuePanelsSurface />}`) — stary „warsztat" z 20+ narzędziami (Wartość bankowa, Prognoza
  gotówkowa, Planer czynników, Drzewo czynników, Symulacja Monte Carlo NPV, Opcje rzeczywiste,
  Granica efektywna, Analiza wrażliwości…), NIE kartę `ValuationWorkspace.tsx` (#49 z inwentarza).
  Ta ostatnia mountuje się TYLKO gdy `activeDocumentId` wskazuje istniejący rekord
  `VALUATION_CASE` — a lokalna baza ma **zero** takich rekordów
  (`GET /api/v8/finance-v2/artifacts?artifactType=VALUATION_CASE` → `count:0`, zweryfikowane
  bezpośrednio). Przycisk „+ Nowa wycena" (`FinanceHub.tsx:2081,2093-2096`) teoretycznie tworzy
  nowy rekord i powinien doprowadzić do tej karty — **NIE wykonano tej ścieżki w tej rundzie**
  (utworzyłoby to nowy rekord na współdzielonym stanowisku, poza zakresem „zero zmian w kodzie
  produktu / zero rekordów testowych" tego zlecenia).
- **Komponent samego siebie przyznaje ten sam fakt w nagłówku:** `ValuationWorkspace.tsx:12-14`
  (`src/components/Finance/Valuation/`) — „★ NOT wired into any production route/hub — mounting is
  gated by `useFinanceValuationWorkspaceFlag`… The only consumer today is `dev-render/screens/
  finance-valuation-workspace.tsx` for screenshot evidence." **Ten komentarz jest CZĘŚCIOWO
  nieaktualny**: istnieje realna trasa+resolver (`AppRoutes.tsx:2505`, `FinanceHub.tsx:3755`), więc
  „NOT wired into any… route" nie jest ścisłe — ściślej: podłączona, ale nieosiągalna bez rekordu,
  a rekord nie istnieje i normalna zakładka renderuje inny, starszy komponent. Wzorzec „zbudowane,
  ale niepodłączone" z pamięci operacyjnej.
- **Kolizja nazw (inwentarz #49, potwierdzona kodem):** `FinanceHub.tsx:174-175` importuje STARY
  `ValuationWorkspace` z `../Benefits/ValuationWorkspace` pod tą samą nazwą zmiennej co
  `FinanceV3ValuationWorkspace` (alias `:207-208` dla `../Finance/Valuation/ValuationWorkspace`) —
  DWA różne komponenty o tej samej bazowej nazwie klasy, rozróżnione tylko aliasem importu.
- **Komponent (karta #49 z inwentarza):**
  `src/components/Finance/Valuation/ValuationWorkspace.tsx:218` (837 linii, siedem kroków:
  Source→Assumptions→Methods→Results→Sensitivity→Advisor→Export, `:93-99`).
- **Powłoka:** `FinanceWorkspaceBar`. Flaga `financeValuationWorkspaceV1`
  (`useFinanceValuationWorkspaceFlag.ts:38`, `defaultValue: true`, ON od `AMD-FIN-VALUATION-V3-001`
  2026-08-18) — flaga ON nie pomaga, skoro trasa do niej nie jest osiągalna bez rekordu i normalna
  zakładka renderuje coś innego.
- **Rejestr:** BRAK (jak pozostałe 6 kart Finansów).

## §1. Sekcje (z kodu — karta nieotwierana na żywo, patrz §0)

| krok | po co użytkownikowi | uwaga z F‑P8 |
|---|---|---|
| Source | wskazanie źródła wyceny (pakiet/model zatwierdzony) | „chooser źródła musi być NIEPUSTY" — wymaga zatwierdzonego modelu z `F‑P1`, którego dziś nie ma |
| Assumptions | WACC i założenia | `AssumptionsStep` (`:699`) |
| Methods | metody i wagi (DCF/FCFF itp.) | — |
| Results | wyniki wyceny | **DZIŚ ZABLOKOWANY** — F‑P8 tytuł wprost: „krok »Wyniki« odblokowany" jako zadanie DO ZROBIENIA, czyli dziś jest ZABLOKOWANY (`NO_VALUATION_SOURCE_EDGE`) |
| Sensitivity | analiza wrażliwości | — |
| Advisor | rekomendacja | `AdvisorStep` (`:370`) |
| Export | eksport wyniku | `:513` „Eksportuj"/„Export" |

## §2-§3. Prawy panel / Menu 5

Nie zmierzone na żywo (karta nieosiągalna, §0). Z kodu: brak importu `ArtifactRightPanel`
(`grep -n "ArtifactRightPanel" ValuationWorkspace.tsx` = 0). Nawigacja siedmiu kroków żyje w
`FinanceWorkspaceBar`/wewnętrznym stepperze, nie w Menu 5 kanonicznym. K6-K12 = 0.

## §4. AI

Brak importu `PracujZAI`/`useCardAIAnalysis`. Karta poza `CardAnalysisArtifactType`.

## §5. Czytelność

- `grep -c "primary-[0-9]" ValuationWorkspace.tsx` = **0**. K17 ✓ w TEJ karcie. **UWAGA:** karta
  faktycznie renderowana pod zakładką „Wycena" dziś (`FinanceValuePanelsSurface.tsx`) NIE była
  częścią tego grepu — to inny plik z udokumentowanym w `F1_..._20260905.md` §F‑M1 problemem 21
  angielskich nazw narzędzi na twardo (`LABELS` mapa, `:79-101`, plus `aria-label="Valuation
  analysis panels"` `:116`, „Loading panel…" `:131`) — TA angielszczyzna jest realnie widoczna
  użytkownikowi DZIŚ pod tą samą zakładką, mimo że nie dotyczy pliku #49.
- `grep -in teresa ValuationWorkspace.tsx` = 0. K27 ✓ dla samego pliku #49.
- F‑P8 dokumentuje **23 dodatkowe napisy EN po polsku** wewnątrz `ValuationWorkspace.tsx` samego
  — nie zmierzone przeze mnie bezpośrednio (karta nieotwierana), ale już policzone i nazwane w
  programie F z konkretnym zadaniem naprawczym.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta` |
| K3 źródło danych per sekcja | ✗ (krok Wyniki zablokowany brakiem edge z modelu, §1) | `F1_..._20260905.md` wiersz F‑P8 |
| K6-K12 | ✗ 0 | §2-3 |
| K17 zero primary-* (plik #49) | ✓ | §5 |
| K21-K24 AI | ✗ / n/d | §4 |
| K25 i18n | ✗ (23 napisy EN udokumentowane w F‑P8; zakładka faktycznie widoczna dziś ma 21 dalszych w `FinanceValuePanelsSurface`) | §5 |
| K26 podgląd/Otwórz | n/d — nie da się dojść do karty w ogóle normalną ścieżką (§0) | — |
| K27 Teresa tylko Menu 1 | ✓ w pliku #49 (niezmierzone w `FinanceValuePanelsSurface`) | §5 |
| K29 zero błędów konsoli | n/d (karta nieotwierana) | — |
| K30 odbiór na 1 zrzucie | ✗ nie wykonano (§0 STOP) | — |

**Wynik: karta #49 jest dziś martwym kodem z perspektywy zwykłego użytkownika** — istnieje, jest
poprawnie zaimplementowana wg własnych testów (`__tests__/ValuationWorkspace.test.tsx` wg
komentarza nagłówkowego), ale zakładka, która POWINNA do niej prowadzić, renderuje inny, starszy
komponent, i żaden rekord `VALUATION_CASE` nie istnieje, by w ogóle wywołać właściwą gałąź.

## §7. Luki → naprawa

1. **BLOKUJĄCA: zakładka „Wycena przedsiębiorstw" renderuje `FinanceValuePanelsSurface` (stary
   warsztat), nie kartę #49, dopóki nie istnieje `activeDocumentId`.** Rozmiar M: sprawdzić
   ścieżkę „+ Nowa wycena" → `showValuationCreateModal` → czy realnie tworzy `VALUATION_CASE` i
   ustawia `activeDocumentId` prowadzący do `/finance/valuations/:id`. NIE zmierzone w tej rundzie
   (patrz §0, unikanie tworzenia rekordu na współdzielonej bazie) — **rekomendacja dla następnej
   rundy pomiaru: utworzyć JEDEN rekord przez UI, zmierzyć, usunąć, policzyć 0**, zgodnie z regułą
   wspólną. Nie wymaga decyzji właściciela — to pomiar, nie zmiana produktu.
2. **F‑P8 — krok Wyniki zablokowany + 23 napisy EN.** Rozmiar M (Sonnet), już zaprojektowane w
   Fali 2, zależne od `F‑P1`. Nie wymaga nowej decyzji właściciela.
3. **21 angielskich nazw narzędzi w `FinanceValuePanelsSurface.tsx` (§5) — to jest ekran, który
   użytkownik REALNIE widzi dziś pod zakładką „Wycena", więc ma wyższy priorytet praktyczny niż
   K25 samej karty #49.** Rozmiar S (F‑M1, już zaprojektowane, Sonnet, 1 sesja — ale to
   MINIMUM/ogólne, nie specyficzne dla tej karty).
4. **K1/K6-K12/K21-K24 — brak kontraktu/panelu/Menu 5/AI.** Wspólna decyzja właściciela z
   pozostałymi kartami Finansów.

**STOP tej rundy:** nie utworzono rekordu `VALUATION_CASE` przez UI (uniknięcie zaśmiecenia
współdzielonej bazy stanowiska); cały opis §0-§6 oparty o (a) bezpośredni pomiar API (zero
rekordów), (b) bezpośredni pomiar zrzutu zakładki, (c) czytanie kodu (trasy, resolver, komentarze
nagłówkowe autorów).

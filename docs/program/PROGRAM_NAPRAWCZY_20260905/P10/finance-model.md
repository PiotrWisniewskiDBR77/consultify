# Kontrakt karty N — `finance-model` (Model finansowy)

## §0. Tożsamość

- **Nazwa PL:** Model finansowy (zakładka: „Modele") · **moduł:** Finanse (nie zamrożony).
- **Status decyzyjny (DEC-399):** **poza pojemnikiem 2 MINIMUM.** Nie ma dedykowanego pakietu
  `F‑M*`/`F‑P*` o tej dokładnej nazwie w programie F — `FinancialModelWorkspace.tsx` jest STARYM,
  przed-programowym systemem („T054" w komentarzu nagłówkowym), osobnym od kanonicznego
  `finance-v2`. Program F traktuje analogiczną funkcję jako `BASELINE_MODEL` (karta #46, `F‑P1`);
  ten stary system (#50) współistnieje równolegle — patrz kolizja niżej.
- **Archetyp:** D · **klasa:** nierejestrowana.
- **Trasa:** `/finance/models/:id` (`AppRoutes.tsx:2454`).
- **Jak otworzyć z listy:** Finanse → Modele. **Zmierzone na żywo 06.09.2026 20:4x**
  (`evidence/p10b7-finanse/hub-models.png`): zakładka pokazuje pusty stan „Zbuduj swój pierwszy
  model finansowy" z CTA „Utwórz model finansowy" i „Poproś Teresę o start" (deep-link do Menu 1,
  zgodny z K27 — patrz `finance-baseline.md` §4 dla identycznego wzorca). Zero rekordów w OBU
  źródłach danych, które ten ekran może czytać: `GET /api/v8/finance/models` →
  `{"models":[],"count":0}` i legacy `GET /api/financial-modeling/models` → `[]` (oba
  zweryfikowane bezpośrednio na stanowisku 4100).
- **★ Dwa równoległe systemy pod jedną zakładką „Modele" (kolizja, zmierzona w kodzie):**
  `FinanceHub.tsx:676`: `openV3Baseline = kind === 'models' && flags.baseline && permits
  ('baseline')` — czyli gdy rekord rozwiązuje się jako `BASELINE_MODEL` (nowy system, karta #46),
  zakładka „Modele" otwiera `BaselineWorkspace`, NIE `FinancialModelWorkspace`. Sam
  `FinancialModelWorkspace` (#50, ten kontrakt) montuje się jako STARA, równoległa gałąź (`:3620,
  3660,3689`) — prawdopodobnie dla rekordów starego systemu `/api/financial-modeling/*`, które dziś
  nie istnieją wcale (0 rekordów, oba systemy puste). Który system faktycznie widzi użytkownik po
  utworzeniu nowego modelu przez „Utwórz model finansowy" — **niezmierzone w tej rundzie** (STOP,
  wymagałoby utworzenia rekordu).
- **Komponent:** `src/components/Finance/FinancialModelWorkspace.tsx:412` (2152 linie — **największy
  z siedmiu plików Finansów**, split layout: lista modeli w sidebarze + cztery zakładki: Dane
  wejściowe i założenia / Oś czasu zdarzeń / Wyniki (RZiS/Bilans/CF) / Walidacja, `:900-912`,
  `activeTab` state `:424`). Etykiety w kodzie mają angielskie fallbacki w wywołaniach `t(klucz,
  'Inputs & Assumptions')` itd., ale `public/locales/pl/translation.json` MA te klucze wypełnione
  poprawną polszczyzną (`finance.model.inputs = "Dane wejściowe i założenia"`, `.events = "Oś
  czasu zdarzeń"`, `.outputs = "Wyniki (RZiS / Bilans / CF)"`, `.validation = "Walidacja"` —
  zweryfikowane odczytem pliku, NIE jest to naruszenie K25, mimo że kod źródłowy WYGLĄDA podejrzanie
  przy samym `grep`).
- **Powłoka dziś:** WŁASNA, nie `FinanceWorkspaceBar` — ten plik jest starszy niż Pakiet C i ma
  swój własny chrome (do zweryfikowania w kolejnej rundzie, czy dzieli jakiekolwiek komponenty
  z resztą Finansów). Brak flagi feature-flag w ogóle (`grep -n "useFeatureFlag" 
  FinancialModelWorkspace.tsx` = 0) — ekran mountuje się bezwarunkowo, gdy zakładka „Modele" nie
  rozwiąże się jako `baseline`.
- **Rejestr:** BRAK (jak pozostałe 6 kart Finansów).

## §1. Sekcje (z kodu — brak rekordu do otwarcia na żywo)

| zakładka | po co użytkownikowi | źródło danych |
|---|---|---|
| Dane wejściowe i założenia | edycja założeń modelu | `Api.get('/api/financial-modeling/models/:id/assumptions-status')` (`:158`) |
| Oś czasu zdarzeń | zdarzenia wpływające na prognozę | `addModelEvent`/`deleteModelEvent` (`:237-253`) |
| Wyniki (RZiS/Bilans/CF) | wynik modelu | `getModelOutputsWithFallback` (`:172-179`, V8 API z fallbackiem na legacy) |
| Walidacja | kontrole spójności | `getModelValidations`/legacy fallback (`:163-179`) |

Każda zakładka ma DWA źródła (V8 kanoniczne + legacy `/api/financial-modeling/*` jako fallback) —
wzorzec „ID_BRIDGE" widoczny też w innych kartach Finansów (np. Prediction), ale tu jest
najbardziej rozbudowany (osiem par wołań, `:135-277`).

## §2-§3. Prawy panel / Menu 5

Brak `ArtifactRightPanel` (`grep -n "ArtifactRightPanel" FinancialModelWorkspace.tsx` = 0). Zamiast
Menu 5, plik ma własny `ExportButton` osadzony w treści (`:50,1008`) — patrz §5, jedyne miejsce
w siedmiu kartach Finansów, gdzie K17 (zero primary-*) **realnie pęka** poprzez zależność.

## §4. AI

Brak `PracujZAI`/`useCardAIAnalysis`. Karta poza `CardAnalysisArtifactType`. Empty state ma
„Poproś Teresę o start" — deep-link do Menu 1 (zgodny z K27, patrz `finance-baseline.md` §4).

## §5. Czytelność

- `grep -c "primary-[0-9]" FinancialModelWorkspace.tsx` = **0** w SAMYM pliku, ALE plik importuje
  `ExportButton` (`:50`, użyty `:1008`) z `src/components/Finance/ExportButton.tsx`, który MA
  `text-primary-500`/`hover:text-primary-400` w DWÓCH miejscach (`ExportButton.tsx:62,71`).
  **K17 NARUSZONE przez zależność** — to jedyna z siedmiu kart Finansów, gdzie crimson jest
  realnie osiągalny (pozostałe sześć kart nie importują `ExportButton`/`ExportToOutputDialog`/
  `StatementExplainPanel`, jedyne trzy pliki w module z tym naruszeniem).
- `grep -in teresa FinancialModelWorkspace.tsx` (poza CTA w hubie, które jest osobnym plikiem) —
  niezmierzone bezpośrednio w tym pliku w tej rundzie (plik 2152 linii, priorytet dano
  krytyczniejszym pomiarom); CTA „Poproś Teresę o start" w hubie jest zgodny z K27 (§4).
- Zrzut zakładki pustej w 100% polski, zero błędów konsoli (`bledyKonsoli: []`,
  `evidence/p10b7-finanse/hub-models.png.json`).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta` |
| K6-K12 | ✗ 0 | §2-3 |
| K17 zero primary-* | **✗ (przez `ExportButton.tsx:62,71`)** | §5 — jedyna karta z realnym naruszeniem w tej siódemce |
| K21-K24 AI | ✗ / n/d | §4 |
| K25 i18n | ✓ (klucze `t()` wypełnione poprawną polszczyzną w `translation.json`, zweryfikowane wprost — angielskie fallbacki w kodzie NIE renderują się) | §0 |
| K27 Teresa tylko Menu 1 | ✓ (CTA w hubie, deep-link) | §4 |
| K29 zero błędów konsoli | ✓ na zakładce pustej (karta pełna nieotwierana) | zrzut hub-models |
| K30 odbiór na 1 zrzucie | ✗ nie wykonano (brak rekordu, §0) | — |

## §7. Luki → naprawa

1. **K17 — crimson realny przez `ExportButton.tsx:62,71` (`text-primary-500`/`hover:text-primary-
   400`).** Rozmiar S: podmienić na tokeny `c-*` (np. `text-c-text-secondary`/`hover:text-c-text`).
   Dotyczy też każdej innej karty, która kiedyś zaimportuje `ExportButton`. Nie wymaga decyzji
   właściciela — to jest dokładnie ten typ naruszenia, który `check-artefakt.sh`/kanon zakazuje
   wprost (CLAUDE.md pułapka nr 1).
2. **Kolizja dwóch systemów pod jedną zakładką „Modele" (§0).** Rozmiar M: ustalić, który
   system faktycznie renderuje się po utworzeniu nowego modelu przez „Utwórz model finansowy" —
   `BaselineWorkspace` (nowy, `F‑P1`) czy `FinancialModelWorkspace` (stary, ten kontrakt). Jeśli
   oba współistnieją z osobnymi danymi, to jest realne ryzyko rozjazdu (użytkownik tworzy „model",
   ale trafia w losowy z dwóch systemów zależnie od typu artefaktu). **Wymaga decyzji
   właściciela**: czy stary `FinancialModelWorkspace`/`/api/financial-modeling/*` jest kandydatem
   do wygaszenia na rzecz `BASELINE_MODEL` (Fala 2), czy oba mają żyć równolegle z jasnym
   rozróżnieniem dla użytkownika.
3. **K1/K6-K12/K21-K24 — brak kontraktu/panelu/Menu 5/AI.** Wspólna decyzja właściciela z
   pozostałymi kartami Finansów.

**STOP tej rundy:** nie utworzono rekordu (żaden system, stary ani nowy, nie ma dziś ani jednego
modelu w lokalnej bazie) — nie da się zmierzyć która z dwóch gałęzi faktycznie się otwiera bez
naruszenia zakazu tworzenia rekordów testowych. Rekomendacja dla kolejnej rundy: utworzyć jeden
model przez UI, zmierzyć który komponent się montuje, usunąć rekord, policzyć 0.

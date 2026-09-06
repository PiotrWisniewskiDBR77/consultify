# Kontrakt karty N — `finance-prediction` (Prognoza)

## §0. Tożsamość

- **Nazwa PL:** Prognoza (etykieta zakładki: „Predykcja") · **moduł:** Finanse (nie zamrożony).
- **Status decyzyjny (DEC-399):** **poza pojemnikiem 2 MINIMUM.** Program F: `F‑P2` (generator
  okresów prognozy) i `F‑P7` („Prognoza/scenariusze: flaga ON + rozstrzygnięcie białego ekranu")
  są w Fali 2, zależne od `F‑M5`/`F‑P6`.
- **Archetyp:** D · **klasa:** nierejestrowana.
- **Trasa:** `/finance/predictions/:id` (`src/routes/AppRoutes.tsx:2488`); montaż warunkowy w
  `FinanceHub.tsx` (`openV3Prediction = kind === 'prediction' && predictionType === 'model' &&
  flags.prediction && …`, `:687-690`).
- **Jak otworzyć z listy:** Finanse → Predykcja. **Zmierzone na żywo 06.09.2026 20:4x**
  (`evidence/p10b7-finanse/hub-prediction.png`): zakładka pokazuje pustą tabelę z nagłówkiem
  (TYP/PODTYP/NAZWA/SCENARIUSZ/HORYZONT/STATUS/AKTUALIZACJA) i komunikat **uczciwy** „Brak danych
  do predykcji. Najpierw utwórz model." — zero rekordów `PREDICTION_SCENARIO` w lokalnej bazie
  (`GET /api/v8/finance-v2/artifacts?artifactType=PREDICTION_SCENARIO` → `count:0`, zweryfikowane
  bezpośrednio). Karta pełna **nieotwierana** — nie ma z czego (żaden model bazowy nie istnieje,
  a Prediction wymaga modelu, zgodnie z komunikatem pustki).
- **Komponent:** `src/components/Finance/Prediction/PredictionWorkspace.tsx:98` (561 linii, dwa
  widoki `assumptions`/`results` — `predictionWorkspaceBarConfig.ts:20`; „trzy tryby budowy" z
  nazwy karty w inwentarzu odnoszą się do logiki WEWNĄTRZ widoku Założeń, nie do trzech osobnych
  ekranów).
- **Powłoka dziś:** `FinanceWorkspaceBar` (bespoke). Flaga `financePredictionWorkspaceV1`
  (`useFinancePredictionWorkspaceFlag.ts:24`, **`defaultValue: false` — jedyna z siedmiu kart
  Finansów wciąż domyślnie OFF**, opis wprost: „Domyślnie OFF do akceptu Piotra na CZYSTYM zrzucie
  (CLAUDE.md #7)"). Mimo flagi OFF domyślnie, zakładka „Predykcja" jest WIDOCZNA w pasku modułu na
  zrzucie (`FinanceHub.tsx` renderuje nawigację zakładek niezależnie od stanu flagi konkretnego
  workspace'u wewnątrz zakładki) — otwarcie zakładki nie zależy od tej flagi, TYLKO montowanie
  pełnej karty PredictionWorkspace po kliknięciu rekordu zależy.
- **Rejestr:** BRAK (jak pozostałe 6 kart Finansów).

## §1. Sekcje (z kodu — karta nie otwarta na żywo, brak rekordu)

| widok | po co użytkownikowi | źródło danych | uwaga |
|---|---|---|---|
| Budowa założeń (`assumptions`) | trzy tryby: standardowy Base/Bull/Bear, wskaźnikowy driver override, fundamentalny initiative→driver→linia→prognoza | `getFinanceBusinessVersion` (potwierdza istnienie wersji), BRAK GET-u treści scenariusza | komentarz nagłówkowy przyznaje wprost: „nawet gdy wersja POTWIERDZONA istnieje, ekran mówi wprost, że to nowy szkic bez pobranych założeń" — bo `finance-v2/prediction` nie ma GET-u treści (`:31-33`) |
| Modele/Wyniki (`results`) | wynik przeliczenia scenariusza | `POST .../calculate` (`:361`) | wymaga zapisanego `businessVersionId`; bez niego pokazuje „Brak realnego scenariusza na serwerze — nie można wywołać /calculate bez zapisanego businessVersionId" (`:361`) — **honest error**, nie cichy pusty ekran |

Autor komponentu udokumentował świadomie TRZY różne, jawne komunikaty błędu (brak
`businessVersionId` / 404 / błąd sieci) zamiast jednego cichego pustego formularza (nagłówek
`:26-28`) — to jest lepsza higiena uczciwości niż karta #46 (Baseline), która ma jeden generyczny
komunikat.

## §2. Prawy panel

Brak `ArtifactRightPanel` (`grep -n "ArtifactRightPanel" PredictionWorkspace.tsx` = 0). K6-K11 = 0/6,
ten sam wzorzec architektoniczny co Baseline (§2 finance-baseline.md).

## §3. Menu 5 i nawigacja

Brak. Dwa widoki nawigowane przez `FinanceWorkspaceBar` (jak Baseline). K12 = 0/3.

## §4. AI

Brak. Zero `PracujZAI`/`useCardAIAnalysis` w pliku. Karta poza `CardAnalysisArtifactType`
(§0 finance-statement-pack — ten sam typ-level wyjątek dla wszystkich 7 kart Finansów).

## §5. Czytelność

- `grep -c "primary-[0-9]" PredictionWorkspace.tsx` = **0**. K17 ✓.
- `grep -in teresa PredictionWorkspace.tsx` = 0. K27 ✓ (brak, nie tylko brak naruszenia).
- Zrzut zakładki listy w 100% polski (`evidence/p10b7-finanse/hub-prediction.png.json`), zero
  błędów konsoli (`bledyKonsoli: []`, zweryfikowane w tej rundzie).
- „Trzy różne, jawne komunikaty błędu" to WZORCOWA praktyka wobec K4 (reguła pustki) — warta
  powielenia w kartach #46/#49/#50, które dziś mają gorszą higienę (generyczne „Spróbuj ponownie").

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta` |
| K3 źródło danych per sekcja | ~ | jawnie brak GET-u treści scenariusza, przyznane w kodzie (§1) |
| K4 reguła pustki | ✓ (mocniejsze niż inne karty Finansów) | trzy jawne komunikaty, §1/§5 |
| K6-K11 prawy panel | ✗ 0/6 | §2 |
| K12 Menu 5 | ✗ 0/3 | §3 |
| K17 zero primary-* | ✓ | §5 |
| K21-K24 AI | ✗ / n/d (poza silnikiem) | §4 |
| K25 i18n | ✓ (zrzut zakładki 100% polski) | — |
| K27 Teresa tylko Menu 1 | ✓ (zero wzmianek) | — |
| K28 zero identyfikatorów technicznych | ✓ (brak UUID w tekście zrzutu) | — |
| K29 zero błędów konsoli | ✓ na zakładce pustej listy (nie zmierzone na karcie pełnej — nie istnieje żaden rekord do otwarcia) | zrzut `hub-prediction.png.json` |
| K30 odbiór na 1 zrzucie z „Pracuj z AI" | ✗ (karta pełna nieosiągalna bez rekordu; „Pracuj z AI" nie istnieje) | — |

## §7. Luki → naprawa

1. **Zero rekordów `PREDICTION_SCENARIO` w bazie i flaga domyślnie OFF — karta jest dziś
   praktycznie niewidzialna z dwóch niezależnych powodów naraz.** Rozmiar L: `F‑P2`/`F‑P7`
   (generator okresów + rozstrzygnięcie białego ekranu) to Fala 2, zaprojektowane, nie wymaga
   nowej decyzji właściciela — czeka na wykonanie i na akcept wizualny (flaga OFF do CZYSTEGO
   zrzutu, zgodnie z CLAUDE.md #7 — to jest PRAWIDŁOWY stan tymczasowy, nie błąd).
2. **K1/K6-K11/K12 — brak kontraktu/panelu/Menu 5.** Ten sam wzorzec co pozostałe 6 kart; wspólna
   decyzja właściciela (patrz finance-statement-pack.md §7 pkt 1).
3. **Brak GET-u treści scenariusza w `finance-v2/prediction`.** Rozmiar L, backend — poza zakresem
   tego kontraktu dokumentacyjnego, ale warto zanotować jako zależność blokującą realny odbiór
   (dziś nawet zapisany scenariusz otwiera się jako „nowy szkic").

**STOP tej rundy:** karta pełna nieotwierana — brak rekordu w bazie, a tworzenie nowego scenariusza
wymaga najpierw modelu bazowego (który sam ma znany 409, patrz finance-baseline.md). Nie tworzono
żadnego rekordu testowego. Pomiar oparty o (a) zakładkę pustej listy zmierzoną na żywo, (b) kod
źródłowy i jego własne, uczciwe komentarze diagnostyczne.

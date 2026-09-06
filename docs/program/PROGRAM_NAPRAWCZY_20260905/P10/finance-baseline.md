# Kontrakt karty N — `finance-baseline` (Baza finansowa / Model bazowy)

## §0. Tożsamość

- **Nazwa PL:** Baza finansowa (etykieta ekranu: „Model bazowy") · **moduł:** Finanse (poza
  `MVP_FINAL_ZAMROZONE.json`, nie zamrożony).
- **Status decyzyjny (DEC-399):** **poza pojemnikiem 2 MINIMUM.** Program F umieszcza tę kartę
  w Fali 2 (`F‑P1` — rejestr `finance_baseline_models` + trzy krawędzie tworzenia, `F‑P3` —
  `PUT` kontekstu + honest errors). Ścieżka krytyczna MINIMUM (`F‑M1→F‑M3→F‑M4→F‑M7`) **nie
  dotyka tej karty w ogóle**.
- **Archetyp:** D · **klasa:** nierejestrowana.
- **Trasa:** otwiera się z zakładki „Modele" w `FinanceHub.tsx` gdy `resolution.workspace ===
  'baseline'` (`FinanceHub.tsx:676` `openV3Baseline = kind === 'models' && flags.baseline &&
  permits('baseline')`; komponent zamontowany w `:337` i `:3633`).
- **Jak otworzyć z listy:** Finanse → Modele → (wymaga istniejącego rekordu `BASELINE_MODEL`) →
  wiersz → karta. **NIE ZMIERZONE NA ŻYWO w tej rundzie** — lokalna baza (stanowisko 4100,
  06.09.2026 ~20:4x) ma **zero** artefaktów `BASELINE_MODEL`
  (`GET /api/v8/finance-v2/artifacts?artifactType=BASELINE_MODEL` → `{"artifacts":[],"count":0}`,
  zweryfikowane bezpośrednio przed pisaniem tego kontraktu). Zakładka „Modele" pokazuje wyłącznie
  pusty stan „Zbuduj swój pierwszy model finansowy" (zrzut `evidence/p10b7-finanse/hub-models.png`).
  Zlecenie B7 wprost zakazuje klikania w tworzenie Baseline („znany 409") — patrz §7.
- **Komponent:** `src/components/Finance/BaselineWorkspace.tsx:120` (650 linii, dwa widoki
  `assumptions`/`wyliczenia`, `:369-375`).
- **Powłoka dziś:** `FinanceWorkspaceBar` (bespoke, jak #45). Flaga `financeBaselineWorkspaceV1`
  (`useFinanceBaselineWorkspaceFlag.ts:38`, `defaultValue: true` — **domyślnie ON od dyżuru 279**,
  `allowLocalOverride: true`). **Sprzeczność w komentarzu pliku:** nagłówek `BaselineWorkspace.tsx:
  19-23` twierdzi „Ten komponent NIE jest dziś wpięty w żaden routing produkcyjny… dostępny
  wyłącznie przez `dev-render/`" — to jest STARE i NIEPRAWDZIWE: `FinanceHub.tsx:69,201-202,337,
  3633` go montuje. Ten sam kształt co „heurystyka domyślnej flagi kłamie" — komentarz w kodzie
  nie został zaktualizowany po wpięciu do huba.
- **Rejestr:** BRAK, jak wszystkie 7 kart Finansów (`registry.ts:32-52`, `cardAnalysisTypes.ts:36`).

## §1. Sekcje (z kodu — nieotwierane na żywo w tej rundzie, patrz §0 STOP)

| widok | po co użytkownikowi | źródło danych | reguła pustki |
|---|---|---|---|
| Założenia (`assumptions`) | edycja wierszy założeń (REVENUE/COGS/EBITDA…) wg `assumptionRowOrder` | `GET .../baseline/context` (`getBaselineWorkspaceContext`, plik:linia w `financeV2.api.ts`, wołane `BaselineWorkspace.tsx:163`) | **DZIŚ: cały widok nie ładuje się** — patrz §7, błąd 409 |
| Wyliczenia (`wyliczenia`) | wynikowe RZiS/Bilans/CF modelu bazowego | pochodna założeń, przelicznik `:386 „Przelicz"` | j.w. — niedostępne, bo poprzedzający krok pada |

Dwa widoki, ZERO trzeciego (świadomie usunięta „Oś czasu zdarzeń" — komentarz nagłówkowy V-1,
`:9-11`: „Baseline jest z definicji no-decision, zdarzenia/decyzje żyją w Prediction"). To jest
udokumentowana, celowa decyzja produktowa, nie luka.

## §2. Prawy panel

Nie zmierzone na żywo. Z kodu: brak importu `ArtifactRightPanel` w `BaselineWorkspace.tsx`
(`grep -n "ArtifactRightPanel" BaselineWorkspace.tsx` = 0). Komentarz nagłówkowy V-6 (`:22-25`)
mówi wprost: „historia wersji żyje w menu lifecycle paska (`FinanceWorkspaceBar`), źródło w Context
popover (i)" — czyli architektura ŚWIADOMIE nie przewiduje osobnego prawego panelu SPEC-A. K6-K11 =
**0/6 z założenia projektowego**, nie tylko z zaniedbania.

## §3. Menu 5 i nawigacja

Brak Menu 5 kanonicznego. Nawigacja dwóch widoków żyje w `FinanceWorkspaceBar` jako
`viewNavigation.views` (`:369-379`, środkowa strefa paska, „TYLKO gdy ≤2 widoki" per kontrakt paska).
K12 = 0/3 (SPEC-A elementy nie istnieją pod tą nazwą — pasek ma odpowiedniki funkcjonalne, inny
kontrakt wizualny).

## §4. AI

Brak. `useFinanceBaselineWorkspaceFlag`/`BaselineWorkspace.tsx` nie importują `PracujZAI` ani
`useCardAIAnalysis` (`grep -n "PracujZAI|useCardAIAnalysis" BaselineWorkspace.tsx` = 0). Karta poza
`CardAnalysisArtifactType` (jak wszystkie 7 — §0 finance-statement-pack ma pełne uzasadnienie).
Empty state zakładki „Modele" ma jednak CTA „Poproś Teresę o start" (`FinanceHub.tsx:4053-4066`,
klucz `finance.model.emptyAskTeresa`) — woła `openChatWithContext({...})`, czyli **otwiera Menu 1**
z kontekstem, NIE osobny czat w module. To jest zgodne z K27 (Teresa tylko Menu 1), NIE narusza
kanonu — to jest deep-link do jedynego czatu, wzorzec spotykany też w innych modułach.

## §5. Czytelność

- `grep -c "primary-[0-9]" BaselineWorkspace.tsx` = **0**. K17 ✓.
- Teresa: zero wzmianek WEWNĄTRZ komponentu (`grep -in teresa BaselineWorkspace.tsx` = 0) — jedyna
  wzmianka jest w hubie jako CTA do Menu 1 (§4), zgodnie z K27.
- i18n: etykiety widoków niosą OBA języki w jednym obiekcie (`{key, pl, en}` — `:106-110,369-403`)
  zamiast przez `t()`/`translation.json`; to inny wzorzec niż reszta aplikacji (własny słownik
  dwujęzyczny), niezmierzone czy powoduje literalne EN gdzieś w UI — plik sam deklaruje „Jednolity
  polski w całej powłoce" jako wymóg V-4 (`:14-15`).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak `KanonicznaKarta` |
| K2 kontrakt steruje renderem | n/d | — |
| K3 źródło danych per sekcja | ✗ (dziś: żaden widok nie ładuje danych, patrz §7) | `getBaselineWorkspaceContext` 409 |
| K4 reguła pustki | n/d — ekran nie dochodzi do stanu z danymi | — |
| K6-K11 prawy panel | ✗ 0/6 (z założenia architektonicznego, §2) | — |
| K12 Menu 5 | ✗ 0/3 | §3 |
| K13-K20 czytelność/nawigacja | n/d większość (nie otwarte na żywo), K17 ✓ (§5) | — |
| K21-K24 AI | ✗ (brak AI na karcie) / n/d (poza silnikiem) | §4 |
| K25 i18n | ~ (własny dwujęzyczny wzorzec, niezmierzony na żywo) | §5 |
| K27 Teresa tylko Menu 1 | ✓ (deep-link do Menu 1, §4) | — |
| K29 zero błędów konsoli | ✗ **spodziewane** — GET kontekstu zwraca 409 przy każdym otwarciu bez skonfigurowanego kontekstu (F1 audyt, nie zmierzone tym zrzutem, bo zrzutu nie wykonano — patrz STOP) | `F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md:984,1034` |
| K30 odbiór na 1 zrzucie | ✗ nie wykonano (STOP §7) | — |

**Wynik: karta NIE OTWIERA SIĘ z realnym rekordem w obecnym stanie repo/bazy** — to jest
najważniejszy, jeden fakt tej karty; reszta kontraktu jest drugorzędna, dopóki ten nie jest
naprawiony.

## §7. Luki → naprawa

1. **BLOKUJĄCA: `GET .../baseline/context` kończy się 409 dla świeżo utworzonego modelu, ekran
   pokazuje generyczne „Spróbuj ponownie" które powtarza to samo żądanie w nieskończoność.**
   Zmierzone i opisane już wcześniej (`F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md` §F‑P3, §3:
   „`BaselineWorkspace` dostaje 409, nie sprawdza kodu błędu i renderuje jedną generyczną kartę
   z akcją »Spróbuj ponownie«, która powtarza to samo żądanie"). Przyczyna udokumentowana:
   `configureBaselineWorkspaceContext` (`financeV2.api.ts:860`) **ma zero wołaczy** w `src/**/*.tsx`
   — klient istnieje, nikt go nie woła po utworzeniu modelu, więc kontekst nigdy nie zostaje
   skonfigurowany i GET zawsze 409-uje. Rozmiar L (Opus), już zaprojektowane jako `F‑P3` — NIE
   wymaga nowej decyzji właściciela, czeka na wykonanie w Fali 2.
2. **K1/K2/K6-K11/K12 — zero kontraktu, zero prawego panelu, zero Menu 5.** Ten sam wzorzec co
   pozostałe 6 kart Finansów. Rozmiar L, wymaga decyzji właściciela (wspólnej dla wszystkich 7 kart
   — patrz finance-statement-pack.md §7 pkt 1).
3. **Komentarz nagłówkowy nieaktualny (§0).** Rozmiar S: zaktualizować `BaselineWorkspace.tsx:19-23`,
   żeby nie wprowadzał w błąd przy kolejnej diagnozie (ten sam kształt co „heurystyka domyślnej
   flagi kłamie" z pamięci operacyjnej). Nie wymaga decyzji właściciela.

**STOP tej rundy (wykonanie zlecenia wprost):** NIE kliknięto w tworzenie/otwarcie Baseline na
żywym stanowisku — zlecenie B7 nazywa to „znany 409" i zabrania tej ścieżki. Cały §0/§7 tej karty
oparty jest o (a) potwierdzenie na żywo, że w bazie jest zero rekordów `BASELINE_MODEL`, i (b) już
istniejący, dokładny audyt kodu w `F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md`, nie o nowe klikanie.
Nie tworzono żadnego rekordu testowego.

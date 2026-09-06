# Wniosek (`conclusion`)

**Status:** PROPOZYCJA — do słowa właściciela. Pomiar 06.09.2026 z żywego stanowiska, zrzuty
`evidence/p10b8/01-conclusions-hub.png` (lista, 11 wniosków realnych) i
`02-conclusion-readout.png` (szczegół „SWOT — ekspansja DACH 2026”, `bledyKonsoli: []`, `url` =
`/conclusions?id=2e5d09c3-...`).

## §0. Tożsamość

- Nazwa PL: **Wniosek** — ugruntowany werdykt z jednego źródła (narzędzie, ocena, wywiad, audyt),
  z uzasadnieniem, dowodami, ograniczeniami i śladem, dokąd trafił dalej.
- Moduł: poza menu 16 modułów (inwentarz „Poza menu 16 modułów”), realnie osadzony jako warstwa
  ponad-modułowa (`CONCLUSION_LAYER`, komentarz backendu `:37`) zasilana z Narzędzi/Oceny/Wywiadu/
  Audytu.
- Archetyp: **B — Dokument**.
- Trasa: `/conclusions?id=<id>` (identyfikator w query, nie w segmencie ścieżki — ale to wciąż
  realna tożsamość adresowalna i linkowalna, `ConclusionsHub.tsx:127-131`, `setSearchParams`).
- Otwarcie: `/conclusions` → kafelek (`ConclusionCard`) → `openDetail` → ten sam komponent hosta z
  `?id=` ustawionym w adresie.
- Komponent: `src/components/Conclusions/ConclusionReadout.tsx:40` (189 linii).
- Backend: `GET /api/conclusions/:id` (`server/src/routes/conclusions.routes.ts:196-210`) — zwraca
  `conclusion` + `conversions` (dokąd wniosek został przekonwertowany, np. do raportu) + `sourcePack`
  (kontekst źródłowy). Warstwa jest **realna i dojrzała**: `ConclusionService`,
  `ConclusionReadoutService`, mostki z narzędzi/ocen/audytów (`toolConclusionBridge.ts`,
  `auditReportConclusionBridge.ts`), generowanie raportu z wniosku (`POST /readouts/:id/generate-
  report`) i kontekst do czatu (`POST /readouts/:id/chat-context`) — to NIE jest szkic, to działająca
  infrastruktura z wieloma konsumentami.
- Powłoka: **brak** — własny `<div className="mx-auto max-w-3xl">` z sekcjami `<div>` na sztywno,
  żaden `StandardArtifactShell`/`NModeShell`/`ArtifactRightPanel`. **Tokeny `c-*` konsekwentnie**
  (deklarowane w komentarzu pliku: „Tokens: var(--c-*) only. No crimson / primary in the readout
  chrome.” — potwierdzone, K17 ✓).

## §1. Sekcje (centrum ekranu) — potwierdzone na żywo

| sekcja | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Werdykt (nagłówek, `:57-75`) | tytuł + treść werdyktu + chipy źródło/pewność/status | `conclusion.title/statement/sourceModule/confidenceLevel/status` → `ConclusionService.getConclusion` | zawsze widoczna (obowiązkowa) | L |
| Rekomendowane następne działanie (`:79-87`) | co zrobić dalej | `conclusion.recommendedNextAction` | sekcja znika przy `null` — potwierdzone kodem `{conclusion.recommendedNextAction && (...)}`, **K4 ✓** | L |
| Dowody (`:90-105`) | na czym oparty werdykt | `conclusion.evidenceRefs[]` (typ + wycinek) | „No evidence attached…” gdy pusto | L |
| Ograniczenia i zastrzeżenia (`:108-113`) | czego werdykt NIE gwarantuje | `conclusion.limits` | zawsze renderowana (nawet gdy pusty string — brak warunku `&&`, drobna niespójność z K4) | L |
| Źródła (`:116-140`) | linki do materiału źródłowego (np. sesja narzędzia) | `conclusion.sourceArtifactRefs[]` | znika przy pustej tablicy — **K4 ✓** | L |
| Zapisany kontekst (`:143-150`) | podsumowanie `sourcePack` w momencie generacji wniosku | `sourcePack.contextSummary` | znika przy braku — **K4 ✓** | L |
| Wygenerowane z tego wniosku (`:153-170`) | rodowód w drugą stronę: co powstało z tego wniosku (np. raport) | `conversions[]` (`ArtifactConversionService`) | znika przy pustej tablicy — **K4 ✓** | L |

To jest **dokładnie sekcja „rodowód”**, o którą prosi zadanie tej partii — realizowana dziś jako
dwie połówki: „Źródła” (skąd wniosek powstał) + „Wygenerowane z tego wniosku” (dokąd poszedł dalej).
Kontrakt jest już faktycznie **wspólny niezależnie od źródła** (ten sam komponent dla wniosków z
`tool`/`assessment`/`interview`/`audit` — potwierdzone listą na `01-conclusions-hub.png`: SWOT z
narzędzia, DRD/SIRI/ADMA z oceny, raport poaudytowy z audytu, wszystkie w jednym widoku) — to
faktycznie odpowiada na życzenie zadania, tylko bez formalnego katalogu sekcji w kodzie (K1 ✗
formalnie, mimo że w duchu sekcje są stałe i przewidywalne).

## §2. Prawy panel

**Brak w ogóle.** Wszystkie „właściwości” (źródło/pewność/status) są chipami w nagłówku sekcji
Werdykt, nie tabelą w bocznym panelu. K6–K11 wszystkie ✗ z braku powłoki.

## §3. Menu 5 i nawigacja

Brak w całości. Nawigacja to jeden przycisk „Wszystkie wnioski” (powrót do listy, `:47-54`) —
brak spisu sekcji, brak Edycja/Podgląd (wniosek jest z natury tylko-do-odczytu — nie ma tu edycji
do ukrycia), brak „Pracuj z AI”.

## §4. AI

Zero przycisków AI w tym widoku — wniosek jest **wynikiem** procesu AI (analiza narzędzia/oceny),
nie miejscem do dalszej generacji. To spójne z resztą warstwy: akcja „wygeneruj raport z wniosku”
istnieje (`POST /readouts/:id/generate-report`), ale żyje poza tym komponentem (prawdopodobnie w
liście albo osobnym przepływie — nie znaleziono przycisku w `ConclusionReadout.tsx`). `conclusion`
nie ma wpisu w `cardAnalysisRubric.ts`/`registry.ts` (K21/K24 ✗ formalnie).

## §5. Czytelność

- `grep -c "primary-[0-9]"` = 0 (K17 ✓, zgodnie z deklaracją w komentarzu pliku).
- **K25 naruszone, potwierdzone na żywo z plik:linia dokładnym.** Zrzut szczegółu
  (`02-conclusion-readout.png.json`) pokazuje sekcję „OGRANICZENIA I ZASTRZEŻENIA” (etykieta
  polska) z treścią **w całości po angielsku**: „Tool-derived conclusion; validate assumptions and
  source inputs before converting to execution.” Źródło: **`server/src/services/conclusions/
  ConclusionService.ts:742`** (string statyczny wpisywany przy tworzeniu wniosku z narzędzia) —
  ten sam wzorzec powtórzony w **`toolConclusionBridge.ts:243-244`** (dwie wersje angielskiego
  tekstu, zależnie od tego, czy jest trade-off). To nie jest literał UI z brakującym tłumaczeniem
  (`t()`) — to angielski string **zapisany do bazy przy tworzeniu rekordu**, więc żadna zmiana
  frontu go nie naprawi bez zmiany serwisu generującego wniosek.
- K19/K20: n/d w sensie modułu (poza menu 16), ale zrzut 1440 bez poziomego przewijania.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ (formalnie); sekcje w duchu stałe i przewidywalne | §1 |
| K3 sekcja→writer | ✓ | każda sekcja ma jawne pole API (§1) |
| K4 reguła pustki | ✓ (5/6 sekcji warunkowe), ~ (Ograniczenia renderowana bez warunku `&&`) | §1 |
| K6–K11 prawy panel | ✗ (wszystkie) | brak `ArtifactRightPanel` (§2) |
| K12 Menu 5 | ✗ | brak w całości (§3) |
| K16 klasa S/L | n/d | brak wpisu w rejestrze |
| K17 zero primary | ✓ | 0 trafień, zadeklarowane i potwierdzone |
| **K25 i18n bez angielskiego** | **✗, potwierdzone na żywo** | „Tool-derived conclusion…” w treści, `ConclusionService.ts:742` |
| K21 Pracuj z AI | ✗ (uczciwie — to wynik, nie miejsce generacji) | §4 |
| K27 Teresa tylko Menu 1 | ✓ | zero wzmianek w pliku |
| K28 zero UUID w DOM | ✓ (próbka tego zrzutu) | tekst zrzutu bez surowych identyfikatorów w tym widoku (inaczej niż `governed-context`) |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []` |
| K30 zrzut z realnym rekordem | ✓ | `02-conclusion-readout.png`, wniosek realny z narzędzia |

## §7. Luki → naprawa

1. **K25 — przetłumaczyć string generowany przy tworzeniu wniosku z narzędzia.**
   `ConclusionService.ts:742` i `toolConclusionBridge.ts:243-244` — zamienić statyczny angielski
   tekst na `t()`-owalny klucz (backend musi albo zwracać klucz do przetłumaczenia po stronie
   klienta, albo generować tekst w języku organizacji — do rozstrzygnięcia, bo dziś to string
   zapisywany raz, przy tworzeniu). Rozmiar: M (dotyka serwisu generującego dane, nie tylko
   widoku — więc wymaga też decyzji, czy istniejące już zapisane wnioski dostają migrację treści
   czy zostają po angielsku jako artefakt historyczny).
2. **Osadzić w kanonicznej powłoce (`StandardArtifactShell` albo lżejszy wariant tylko-do-odczytu).**
   Sekcje są już w duchu kontraktem (§1) — to ułatwia migrację względem `interview-template`, gdzie
   sekcje trzeba dopiero wydzielić. Rozmiar: M.
3. **Poprawić warunek pustki sekcji „Ograniczenia i zastrzeżenia”** (dziś renderuje się nawet przy
   pustym stringu) — spójność z resztą sekcji. Rozmiar: S.

**STOP:** brak — dowód kompletny na żywym rekordzie, kierunek naprawy jasny dla wszystkich trzech
pozycji.

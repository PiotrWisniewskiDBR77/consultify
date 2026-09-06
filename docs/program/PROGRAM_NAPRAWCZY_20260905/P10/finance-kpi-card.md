# Kontrakt karty N — `finance-kpi-card` (Karta KPI analizy finansowej)

## §0. Tożsamość

- **Nazwa PL:** Karta KPI analizy finansowej · **moduł:** Finanse (nie zamrożony).
- **Status decyzyjny (DEC-399):** **poza pojemnikiem 2 MINIMUM** (poddrzewo `finance-analysis`
  #48, dzieli jej status: Fala 2, `F‑P4`/`F‑P5`).
- **Archetyp:** C (Rekord) — slide-over drill-down z tabeli wskaźników, NIE pełnoekranowy artefakt.
  **Klasa:** nierejestrowana; jedyna karta Finansów, która wg samego komentarza autora „dotyka
  standardu" (inwentarz #51), ale **NIE reużywa** `ArtifactRightPanel` — patrz cytat niżej.
- **Otwarcie:** z `finance-analysis` (#48) → tabela 18 wskaźników → klik na wiersz wskaźnika (np.
  „Marża EBITDA") → `<aside>` wysuwa się z prawej. `AnalysisWorkspace.tsx:569` woła
  `AnalysisKpiDetailCard`.
- **Zmierzone na żywo 06.09.2026 20:4x**: klik „Marża EBITDA" w tabeli analizy CD PROJEKT →
  `dom.aside.liczba = 1` (jeden, dokładnie jeden panel boczny — zrzut
  `evidence/p10b7-finanse/51-kpi-detail.png.json`), zawartość zgodna 1:1 z siedmioma sekcjami
  kodu (§1).
- **Komponent:** `src/components/Finance/Analysis/AnalysisKpiDetailCard.tsx:78` (199 linii).
  Cytat z nagłówka pliku (`:1-8`): „Slide-over z prawej, w tokenach `c-*` (kanon), NIE reużywa
  `ArtifactRightPanel` (SPEC-A, ekrany-obiekty pełnoekranowe) — to jest panel WEWNĄTRZ workspace'u
  Analysis, wzorowany na istniejącym Table+Preview layoutcie (`TableWithPreviewLayout`), nie osobny
  artefakt." — **świadoma, udokumentowana decyzja architektoniczna**, nie przeoczenie: autor
  jawnie odróżnił ten panel od SPEC-A.
- **Powłoka:** własny `<aside>` (`:83-89`, `w-full max-w-md`, `border-c-border-subtle`,
  `bg-c-surface`) — poprawne tokeny `c-*` już na pierwszy rzut oka.
- **Rejestr:** BRAK (jak pozostałe 6 kart Finansów).

## §1. Sekcje (zmierzone na żywo — zgadzają się z kodem 1:1)

| sekcja (nagłówek na ekranie) | źródło danych | reguła pustki | plik:linia |
|---|---|---|---|
| WARTOŚĆ BIEŻĄCA | `formatAnalysisKpiValueForDisplay(kpiValue)` + `financeValueDisplayReasonLabel` | pokazuje glif „—"-podobny z `isMissingLikeGlyph`, nie pustą ramkę | `:100-118` |
| WYKRES — okresy historyczne i prognozowane | `periodSeries` (prop, z tabeli nadrzędnej) | „Brak wystarczających danych do wykresu" gdy `present.length===0` (`SparklineChart`, `:42`) | `:120-129` |
| FORMUŁA I SKŁADNIKI | `formulaInfo?.formulaDisplay` | „Brak zdefiniowanej formuły wyświetlanej" | `:131-137` |
| BENCHMARK BRANŻOWY | `kpiValue.benchmark` | „Benchmark niedostępny dla tego wskaźnika" — **zmierzone na żywo: WSZYSTKIE 18 wskaźników CD PROJEKT mają ten stan pusty**, zero benchmarków w seedzie | `:139-147` |
| INTERPRETACJA TEGO WYNIKU | `kpiValue.interpretationText` | „Brak zapisanej interpretacji dla tego wyniku" | `:149-155` |
| LINEAGE — źródło danych | `sourceLineageLabel` (prop) | **ZMIERZONE: tekst jest STUB, nie realne dane** — „Pakiet sprawozdań źródłowych (lineage) — szczegóły dostępne po dodaniu endpointu listującego." Ten string jest hardcoded placeholder przekazywany z `AnalysisWorkspace.tsx`, nie prawdziwy rodowód | `:157-159` |
| HISTORIA | `history` (prop) | „Brak wcześniejszych wersji tego wskaźnika" | `:161-172` |

Siedem sekcji, wszystkie renderują się ZAWSZE (żadna nie znika przy braku danych — **narusza K4
dosłownie**: kanon każe „sekcja bez treści znika", tu każda sekcja zawsze jest widoczna, tylko jej
WNĘTRZE zamienia się w komunikat pustki. To jest inny, słabszy wzorzec niż K4 wymaga, choć nie jest
to „pusta ramka na wyrost" w najgorszym sensie — komunikaty są uczciwe i konkretne).

## §2. Prawy panel (SPEC-A)

**Świadomie nie dotyczy** — to NIE jest `ArtifactRightPanel`, więc K6-K11 nie mają tu zastosowania
w sensie „naruszenia"; to jest inny typ elementu UI (drill-down wewnątrz tabeli), słusznie
odróżniony przez autora. Oceniam go osobno wg §1 (siedem sekcji, nie sześć SPEC-A).

## §3. Menu 5 i nawigacja

Nie dotyczy — brak Menu 5, panel zamyka się przyciskiem X (`:96-104`,
`aria-label="Zamknij kartę szczegółową"`, `min-h-11 min-w-11`, `focus-visible:ring-c-focus` —
**a11y i fokus poprawne**).

## §4. AI

Brak. Zero `PracujZAI`/`useCardAIAnalysis` w pliku. Poza `CardAnalysisArtifactType`.

## §5. Czytelność

- `grep -c "primary-[0-9]" AnalysisKpiDetailCard.tsx` = **0**. K17 ✓.
- `grep -in teresa` = 0. K27 ✓.
- Fokus: `focus-visible:ring-2 focus-visible:ring-c-focus` na przycisku zamknięcia (`:99`) —
  **K18 ✓, jedyna karta Finansów z bezpośrednio zweryfikowanym poprawnym fokusem w tej rundzie.**
- **Bug formatu liczby (zmierzony, patrz `finance-analysis.md` §5/§7):** „Zmiana r/r:
  +2.1%" — `toFixed(1)` bez formatowania locale, kropka zamiast przecinka. Ten sam plik, ten sam
  bug — powtórzony tu dla kompletności kontraktu tej konkretnej karty.
- Zero angielskiego w zrzucie (100% polski tekst, `evidence/p10b7-finanse/51-kpi-detail.png.json`),
  `bledyKonsoli: []`.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ formalnie (siedem sekcji hardcoded w JSX, nie w tablicy deklaratywnej) | plik |
| K3 źródło danych per sekcja | ~ (pięć z siedmiu mają realne pole/prop; Lineage jest STUB hardcoded, §1) | §1 |
| K4 reguła pustki | ✗ (sekcje NIE znikają, pokazują komunikat zamiast się chować, §1) | §1 |
| K6-K11 (SPEC-A panel) | n/d — świadomie inny typ elementu (§2) | — |
| K17 zero primary-* | ✓ | §5 |
| K18 fokus c-focus | ✓ (jedyna karta z bezpośrednio zweryfikowanym poprawnym fokusem) | §5 |
| K21-K24 AI | ✗ / n/d | §4 |
| K25 i18n | ✓ tekst, ✗ formatowanie liczby (bug §5) | §5 |
| K27 Teresa tylko Menu 1 | ✓ | — |
| K28 zero identyfikatorów technicznych | ✓ (brak UUID w tekście zrzutu) | — |
| K29 zero błędów konsoli | ✓ | zrzut 51-kpi-detail |
| K30 odbiór na 1 zrzucie | ✓ (zrzut istnieje, choć bez „Pracuj z AI" bo ten nie istnieje na tej karcie) | evidence/p10b7-finanse/51-kpi-detail.png |

**Wynik: najlepiej zachowująca się karta Finansów pod względem a11y/tokenów (K17/K18 ✓), ale z
realnym K4 i K3(Lineage-stub) do naprawy oraz tym samym bugiem formatu liczby co #48.**

## §7. Luki → naprawa

1. **Lineage to hardcoded stub, nie prawdziwy rodowód (§1).** Komentarz kodu sam przyznaje
   „szczegóły dostępne po dodaniu endpointu listującego" — czyli endpoint nie istnieje. Rozmiar M:
   backend (endpoint listujący lineage per KPI) + frontend (podłączenie zamiast stałego stringa).
   Nie wymaga decyzji właściciela — to jest znana, przyznana luka, nie spór produktowy.
2. **Bug formatu liczby „+2.1%"/„+2,1%" — wspólny z #48.** Patrz `finance-analysis.md` §7 pkt 1,
   ten sam plik, jedna naprawa naprawia oba miejsca (ta sama funkcja renderu).
3. **K4 — sekcje nie znikają, tylko pokazują komunikat pustki.** Rozmiar S/M zależnie od decyzji:
   czy to ma być zgodne z K4 dosłownie (sekcja znika z nagłówkiem wyszarzonym w spisie), czy ten
   wzorzec „zawsze widoczna sekcja + honest empty message" zostaje jako WYJĄTEK udokumentowany
   (jest bardziej czytelny dla drill-down małego panelu niż znikające nagłówki). **Rekomendacja:
   zostawić jako udokumentowany wyjątek** — to jest lepsze UX dla panelu tej wielkości niż ukrywanie
   nagłówków, ale wymaga jednego zdania decyzji właściciela, żeby nie było to liczone jako dług
   przy każdym kolejnym audycie.

**STOP-y tej rundy:** brak. Karta w pełni otwieralna i zmierzona na realnym rekordzie CD PROJEKT.

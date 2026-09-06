# Kontrakt karty N — `kpi-deviation` (Karta odchylenia KPI)

## §0. Tożsamość

- **Nazwa PL:** Karta odchylenia · **moduł:** Wyniki (P7K), podekran miernika KPI.
- **Archetyp:** C (Rekord) wg inwentarza · **klasa:** nieprzypisana (poza rejestrem).
- **Trasa:** `/results/kpi/:kpiId/deviation-cases/:caseId` (`routeConfig.ts:167`, klucz
  `RESULTS_KPI.DEVIATION_CASE`) — jawnie D05 „subview of the tool, never a top-level registry"
  (nagłówek pliku `:1-3`).
- **Jak otworzyć:** karta miernika (#37 `metric`) → sekcja „Odchylenia" → wiersz sprawy.
- **STOP — brak rekordu na stanowisku.** Zweryfikowane na żywo TERAZ (06.09.2026, ta partia):
  `GET /vnext/results/kpi/deviation-cases?organizationId=cc9db573-260f-4a19-927f-f3cc1fbaea38` →
  `{"cases":[]}` — **ZERO spraw odchylenia w organizacji DBR77**. To POTWIERDZA (nie powtarza —
  zweryfikowane osobnym wywołaniem API, nie przepisane z P10-S) ustalenie z
  `MATRYCA_21_KART.md` §3: „Otwarte działania 0 we wszystkich trzech raportach KPI […] karta
  działania powstaje z odchylenia KPI […] Nie tworzyłem — to byłby rekord testowy w danych
  pokazowych." Zgodnie z zasadą „brak rekordu = STOP z przepisem, nie zgaduj" — **NIE zrobiłem
  zrzutu tej karty**, kontrakt niżej jest oparty WYŁĄCZNIE na czytaniu kodu.
- **Komponent:** `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx` (1284 linii).
- **Powłoka dziś:** `NModeShell` + `ArtifactRightPanel` bezpośrednio (`:1219-1227`), **BEZ**
  `KartaWynikowChrome` — otwarcie ZDEJMUJE pasek modułu (ten sam wzorzec braku co
  `roi-case-tool`, `okr-set-tool`).
- **Rejestr:** BRAK — nie jest kluczem `KartaNKey`. AI strukturalnie niewołowalne.

## §1. Sekcje — JEDNA, workflow fazowy, nie kontrakt sekcji

`sections={[workflowSection]}` (`:1219`) — dokładnie JEDEN element `NModeSection` o id `workflow`
(`:559-604`), renderujący DZIEWIĘĆ faz cyklu życia sprawy jako pionowy stos `PhaseCard`
(wykrycie→potwierdzenie→analiza→plan→zatwierdzenie→wykonanie→obserwacja→weryfikacja→zamknięcie,
zgodnie z maszyną stanów w nagłówku pliku `:7-9`). To NIE jest kontrakt sekcji w rozumieniu K1
(spis, między którymi można się przełączać) — jest to JEDEN długi scroll przez fazy.

| „sekcja" | po co użytkownikowi | źródło danych → writer | reguła pustki | S/L |
|---|---|---|---|---|
| Przebieg sprawy (`workflow`, jedyna) | cała historia sprawy odchylenia, akcja per faza | `kpiDeviationApi.ts` (9 komend: acknowledge/submitRootCause/plan submit-approve/execute/…/close, każda cytowana z plik:linia w nagłówku pliku `:9-14`) | brak — zawsze renderuje aktualną fazę | 1 | L |

## §2. Prawy panel — TRZY sekcje, trzy brakują

| sekcja | obecna? | plik:linia |
|---|---|---|
| Akcje | ✓ | `:466-497` (eskalacja/deeskalacja/wznowienie) |
| Właściwości (tabela) | ✓ | `:525-537` |
| Powiązania | ✓ | `:538-556` (poprzednia zamknięta sprawa, jeśli wznowiona) |
| **Źródła i założenia** | **✗ BRAK** | grep zero trafień |
| **Komentarze** | **✗ BRAK** | grep zero trafień |
| **Historia** | **✗ BRAK** | grep zero trafień |

**K6–K11: 3/6.** Brak Historii jest tu SZCZEGÓLNIE dotkliwy: karta MA dziewięć faz z datami i
akcjami (idealny materiał na log), a mimo to nie ma sekcji „Historia" w prawym panelu — treść,
która powinna tam być, jest rozmyta w centrum karty (workflow), nie w panelu.

## §3. Menu 5 i nawigacja — BRAK, plus WYCIEK TERESY (K27)

- Zero `SectionsManagerMenu`/„Sekcje ▾" (jedna sekcja, nie ma czego zarządzać).
- Zero `PracujZAI`/„Pracuj z AI ▾".
- **K27 NARUSZENIE ZMIERZONE W KODZIE:** przycisk „Poproś Teresę o zapis przez pipeline"
  (`:741-752`) otwiera `TeresaProposalPanel` (import `:85`, render `:1229-1246`) **wewnątrz tej
  karty** — drugie wejście do Teresy poza Menu 1, dokładnie wzorzec naruszenia, który K27 zakazuje
  (ten sam kształt co `idea`/`audit-criterion`/`presentation`/`tool-document`/`notification` w
  matrycy P10-S, ale NIEZMIERZONY tam, bo ta karta nie miała zrzutu). Mechanizm: pole formularza
  „Analiza przyczyny źródłowej" ma DWIE ścieżki zapisu — ręczny przycisk „Zapisz analizę" (pierwotny,
  zawsze dostępny) ORAZ „Poproś Teresę o zapis przez pipeline" (`reflection_rca` advisor mode,
  `kpiTeresaRcaDraft.ts`), która otwiera panel Teresy w miejscu karty. Nagłówek pliku (`:44-51`)
  tłumaczy to jako „alternatywę, nie zamiennik" — ale K27 nie robi wyjątku dla alternatyw: „w
  karcie nie ma DRUGIEGO czatu" jest bezwarunkowe.

## §4. AI — BRAK (silnika standardu), ale JEST Teresa poza kanonem

Zero `useCardAIAnalysis`/`PracujZAI`/wpisu w rubryce. Jedyne AI w tej karcie to opisany wyżej wyciek
Teresy (§3) — czyli karta ma AI, ale NIEZGODNE z kontraktem (powinno być `PracujZAI` z trzema
pozycjami, jest przycisk niestandardowy prowadzący do czatu).

## §5. Czytelność

Niezmierzone zrzutem (brak rekordu, §0). Z czytania kodu: brak jawnych naruszeń `primary-*`
zauważonych, ale nie sprawdzone grepem w tej rundzie.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji istnieje | ✗ | jedna sekcja workflow, nie spis sekcji |
| K2 kontrakt steruje renderem | n/d | nie dotyczy |
| K3 źródło danych per sekcja | ✓ | 9 komend API cytowane w nagłówku pliku |
| K4 reguła pustki | n/d | sekcja zawsze ma treść (workflow), nie testowano pustych podpól |
| **K6–K11 prawy panel** | **✗ 3/6** | brak Źródeł/Komentarzy/Historii, patrz §2 |
| **K12 Menu 5 trzy elementy** | **✗** | zero elementów Menu 5 |
| K13–K18, K20 | n/d | brak zrzutu (STOP §0) |
| K16 klasa S/L zgodna | n/d | brak wpisu rejestru |
| **K19 pigułka pasku modułu** | **✗** | brak `KartaWynikowChrome`, otwarcie zdejmuje pasek modułu |
| **K21 „Pracuj z AI" 3 pozycje** | **✗** | brak, zamiast tego przycisk niestandardowy do Teresy |
| K22 propozycja→Zatwierdź | n/d | nie dotyczy standardu; ścieżka Teresy ma WŁASNY propose→approve→execute→audit (P08), inny mechanizm niż `PracujZAI` |
| K23 po polsku, wg uprawnień | ~ | niezmierzone zrzutem, ale UI PL widoczny w kodzie (etykiety `t(...)`) |
| **K24 deklaracja per typ** | **✗** | brak wiersza w tabeli K24 SSOT |
| K25 i18n bez angielskiego | n/d | brak zrzutu |
| K26 podgląd/Otwórz | ✓ | wejście z sekcji „Odchylenia" karty miernika, klik na wiersz |
| **K27 Teresa tylko Menu 1** | **✗ (zmierzone w kodzie)** | `TeresaProposalPanel` w karcie, `:741-752`, `:1229-1246` |
| K28 zero identyfikatorów technicznych | ~ | `shortId(kase.reopenedFromCaseId)` używany poprawnie (`:546`) — dobry wzorzec, ale niezmierzone całościowo |
| K29 zero błędów konsoli | n/d | brak zrzutu |
| **K30 odbiór 1 zrzut 1440** | **STOP** | brak rekordu do otwarcia na stanowisku, patrz §0 |

**Wynik: 3 ✓, 5 ✗ realne (K1, K6–K11, K12, K19, K21, K24, K27 — siedem, licząc wszystkie), 1 STOP
(K30), reszta n/d z powodu braku rekordu.** Najgorszy wynik partii B1 razem z `okr-set-tool`.

## §7. Luki → naprawa

1. **STOP — brak rekordu na stanowisku.** Aby zmierzyć wizualnie (K13–K18, K20, K23, K25, K28, K29,
   K30), potrzebny jest JEDEN seed sprawy odchylenia na mierniku „ŚREDNI CZAS ODPOWIEDZI NA
   REKLAMACJE" (dziś status „Ostrzeżenie", ale bez otwartej sprawy — patrz P10-S §3). **Rekomendacja
   właścicielowi**: albo (a) zaakceptować utworzenie jednej TESTOWEJ sprawy odchylenia w danych
   pokazowych z jawnym oznaczeniem i późniejszym usunięciem (jak sugerował P10-S), albo (b)
   poczekać na naturalny pomiar, który przekroczy próg. **1 pytanie do właściciela** — nie zgaduję.
2. **K27 — wyciek Teresy.** Rozmiar M: albo usunąć przycisk „Poproś Teresę o zapis przez pipeline"
   z karty i przenieść tę ścieżkę do Menu 1 (zgodnie z DEC-404/DEC-419, tak jak zrobiono dla
   metric/objective/roi_case), albo — jeśli właściciel chce zachować pipeline P08 — opakować go
   inaczej niż `TeresaProposalPanel` (np. jako zwykły formularz zatwierdzenia bez marki „Teresa"
   w UI). **Pytanie do właściciela**, bo usunięcie ścieżki P08 może być stratą funkcjonalną, nie
   tylko kosmetyczną.
3. **K6–K11 — prawy panel niekompletny.** Rozmiar M: dopisać Źródła/Komentarze/Historia, wzorem
   `KpiToolPage.tsx:1127-1198`. Historia jest tu SZCZEGÓLNIE tania do wypełnienia: 9 faz z datami
   już istnieją w centrum karty, log to w zasadzie przepisanie tych samych danych do panelu.
4. **K12/K19/K21/K24 — brak Menu 5, paska modułu, AI.** Rozmiar L: wymaga dodania klucza rejestru
   (jak `roi-case-tool.md` §7 pkt 2) — ten sam koszt strukturalny powtarza się w kilku kartach
   partii B1, warto rozstrzygnąć RAZ dla wszystkich pięciu naraz, nie osobno per karta.

**Rekomendacja:** (2) jest najpilniejsze z punktu widzenia kontraktu (realne naruszenie zasady
„jedna Teresa"), ale wymaga decyzji właściciela o losie ścieżki P08. (1) blokuje jakikolwiek
pomiar wizualny tej karty.

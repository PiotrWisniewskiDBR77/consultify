# Wniosek z wywiadu (insight) — kontrakt karty N, AUDYT ZGODNOŚCI (P10-B0, DEC-429)

> Runda 2 (Codexa) już scaliła K1 z rundą 1 — tabele §6a i „Uzupełnienie K1” zachowane bez
> zmian. Ten plik dokłada §0/§2–§5 wg formatu wspólnego oraz pomiar NA ŻYWO flagi (§6b),
> który **koryguje** zlecenie: flaga NIE jest twardym `return false` — patrz §6b.

## §0. Tożsamość

- **Nazwa PL:** Wniosek z wywiadu · **moduł:** 02_INTERVIEW (Wywiad) · **archetyp:** B (Dokument)
- **Trasa:** `/interview?tab=insights` (bez id w URL)
- **Jak otworzyć z listy:** Wywiad → Wnioski → wiersz → „Otwórz”
- **Komponent:** `src/components/Interview/InsightViewer.tsx:1224` (9993 linii)
- **Powłoka dziś:** `NModeShell`; kontrakt: `src/components/Interview/insightCardContract.ts`
  (import `:152`), **30 kart** `KanonicznaKarta` w `INSIGHT_CARDS` (po dedup Fazy 0 — patrz §6b)
- **Rejestr:** `registry.ts` → `insight`

## §1. Sekcje (katalog kanoniczny, grupy — 30 kart, zbyt liczne na jedną tabelę wiersz-po-wierszu
w limicie tego pliku; grupowanie jak w rundzie 1, uzupełnione o writer)

| grupa | sekcje (liczba) | źródło danych | reguła pustki | S/L |
|---|---|---|---|---|
| WGLĄD | Podsumowanie, Odczyt konsultingowy, Kluczowe wnioski, Rekomendacje* (4) | content JSON → `InterviewInsightService.ts:2223-2700` | brak | L |
| MIĘDZY WIERSZAMI | Porównanie cytatów, Dynamika władzy, Napięcia, Wzorce, Modele myślowe (5) | jw. | brak | L |
| DOWODY | Źródła, Momenty, Bank cytatów, Mapa interesariuszy, Wiarygodność źródeł (5) | jw. | brak | L |
| DOSTARCZANE | Pakiet raportu, Narracja konsultingowa, Memo zarządcze* (3) | jw. | brak | L |
| AUDYT | Jakość i zaufanie (18 pod-sekcji wg SSOT) | jw. | brak | L |
| RDZEŃ (nieusuwalne) | `artifact-actions`(Rezultaty), `executive-summary`(Podsumowanie) | akcje artefaktu / content | brak | — |

`*` = `recommendations`/`executive-memo` **USUNIĘTE z `INSIGHT_CARDS`** w Fazie 0 DEDUP
(`insightCardContract.ts:545-547,693-695`) — scalone z rdzeniem (`artifact-actions`/`executive-summary`).
Kod komentuje wprost: „nadal renderowane przez `InsightViewer.tsx:671`” jako zaślepki
„Rekomendacje (Phase-D)” / „Memo zarządcze (Phase-D)”. **Potwierdzone żywo w §6b: to prawda —
znikają z managera „Sekcje ▾”, ale content nadal się renderuje w centrum.**

## §2. Prawy panel

| sekcja | obowiązkowość | stan na zrzucie (`10-insight.png`) |
|---|---|---|
| Akcje | obowiązkowa (K6) | ✓ „Szkic/Generowanie/Ukończone/W recenzji/Opublikowano” — cykl życia |
| Właściwości (tabela) | obowiązkowa (K7) | ✓ Status→Źródło→Data→Pewność→Ustalenia→Etykieta |
| Powiązania | obowiązkowa (K8) | ✓ obecna |
| Źródła i założenia | obowiązkowa dla AI (K9) | ✓ obecna |
| Rezultaty | dodatkowa (kafelki „Rozpocznij decyzję/inicjatywę…”, patrz `InsightViewer.tsx:775-784`) | ✓ przeniesione tu świadomie z centrum (decyzja właściciela: „nie dubluj”) |
| Komentarze | warunkowa | ✓ obecna |
| Historia | obowiązkowa (K10) | ✓ obecna |

## §3. Menu 5 i nawigacja

Komplet: „Sekcje ▾” / „Edycja/Podgląd” / „Pracuj z AI ▾” (K12 ✓). Manager „Sekcje ▾”:
- **baseline:** 32 sekcje widoczne (w tym `recommendations`/`executive-memo` jako zaślepki Phase-D)
- **z kontraktem:** 30 sekcji — `recommendations`/`executive-memo` znikają z LISTY MANAGERA
  (`InsightViewer.tsx:9454-9459`, filtr `catalogIds`), zestawy nazwane „Kompletny wniosek/Rdzeń
  wniosku/Pełny” zamiast domyślnych bez nazwy

„Uzupełnij cały dokument” bywa wyszarzone bez prawa edycji (matryca `10-insight.png`, K23 ✓ —
powód wypisany).

## §4. AI

`PracujZAI` obecny (K21 ✓). Regeneracja per-sekcja: „Zapisz sekcję” dla treści redagowanej ręcznie
(Podsumowanie — „Tekst redagowany ręcznie. Zapisuje się osobno od treści z AI”).

| sekcja | rubryka (`cardAnalysisRubric.ts:245`) | AI może uzupełnić | tylko do odczytu |
|---|---|---|---|
| insight (cały typ, 30 kart) | `INSIGHT_CARDS` | podsumowanie, odczyt konsultingowy, kluczowe wnioski, rekomendacje | źródła, cytaty, momenty, próbka materiału |

Teresa: brak wzmianek na zrzucie (K27 ✓).

## §5. Czytelność graficzna

Zrzut 1440 jasny (`10-insight.png`) czysty. Tytuł rekordu testowego „Example: failed insight (for UI
states)” po angielsku — to DANE (nazwa testowego rekordu seed), nie literał UI — nie liczę jako K25
naruszenie (przyjęte z matrycy: „tytuł rekordu EN (dane)”).

## §6a. Stan zastany vs kontrakt — tabela Codexa (runda 1, zachowana)

| sekcja | kontrakt mówi (plik:linia) | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Rezultaty | `insightCardContract.ts:110-128` | `InsightViewer.tsx`; brak dowodu runtime | artifact actions → writer handoffów | brak | kosmetyka |
| Podsumowanie | `insightCardContract.ts:129-146` | jw. | content/materialization → `InterviewInsightService.ts:2223-2700` | brak | kosmetyka |
| Odczyt konsultingowy | `insightCardContract.ts:147-164` | jw. | content → `InterviewInsightService.ts` | brak | kosmetyka |
| Tematy–Jakość i zaufanie (18 sekcji) | `insightCardContract.ts:165-515` | jw.; brak rekordu | content JSON → `InterviewInsightService.ts:2223-2700` | brak | kosmetyka |
| Kluczowe wnioski–Narracja konsultingowa (10 sekcji) | `insightCardContract.ts:529-700` | jw.; brak rekordu | content JSON → `InterviewInsightService.ts` | brak | kosmetyka |

### Uzupełnienie K1 po scaleniu (runda 2, zachowane)

| sekcja / pole | kontrakt mówi | ekran pokazuje | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Rezultaty (`artifact-actions`) | rdzeń lewej kolumny | przeniesione do prawego panelu „Rezultaty” | akcje artefaktu w `InsightViewer.tsx` | sekcja poza kontraktem | kosmetyka |
| Executive memo | usunięte z `INSIGHT_CARDS` po deduplikacji | nadal renderowane przez `INSIGHT_SECTIONS` | content JSON → `InterviewInsightService.ts` | sekcja poza kontraktem | kosmetyka |
| Rekomendacje | usunięte z `INSIGHT_CARDS` po deduplikacji | nadal renderowane przez `INSIGHT_SECTIONS` | content JSON → `InterviewInsightService.ts` | sekcja poza kontraktem | kosmetyka |
| Pytanie przewodnie | brak sekcji wyniku | nieobecne na karcie | `leading_question` zapisuje i podaje do promptu `InterviewInsightService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |
| Notatka konsultanta | brak sekcji wyniku | nieobecna na karcie | `consultant_note` zapisuje i podaje do promptu `InterviewInsightService.ts` | sekcja z kontraktu nieobecna | blokuje MVP |

## §6b. POMIAR NA ŻYWO flagi `VITE_VF1_INSIGHT_CARD_CONTRACT` (P10-B0, 06.09.2026)

**Zlecenie zakładało „twardy `return false`” na `InsightViewer.tsx:182-186`. NIEŚCISŁE** — te linie
to komentarz opisujący kolejność (URL→localStorage→env→OFF), a sam `return false` (`:232`) jest
ostatni fallback. **Da się włączyć jednym linkiem `?cardContract=1`**, bez zmiany kodu/env.

**Metoda:** vite port 3111, sesja `stanowisko-noc/auth.json`, rekord „Example: failed insight (for UI
states)”, klik „Sekcje” bez/z `?cardContract=1`.
Dowody: `evidence/p10b0-kontrakty/insight-sekcje-{bez,z}.png(.json)`.

**Co się zmienia (potwierdzone `difflib` na pełnym tekście strony, nie tylko wizualnie):**
manager „Sekcje ▾” traci dwie pozycje — „Rekomendacje” (z grupy „Kluczowe wnioski”) i „Memo
zarządcze” (z grupy „DOSTARCZANE”) — dokładnie zgodnie z kodem `InsightViewer.tsx:9448-9459`
(`catalogIds` filtruje picker po `INSIGHT_CARD_SPEC.catalog`, z którego te dwie karty zniknęły w
Fazie 0 DEDUP). To POTWIERDZA literalnie ustalenie rundy 2 w §6a: „nadal renderowane przez
INSIGHT_SECTIONS” — bo **treść w centrum („Narracja konsultingowa” / „Memo zarządcze” z tekstem
zaślepki) pozostaje IDENTYCZNA bez/z flagą** (zmierzone: końcówka tekstu strony identyczna w obu
wariantach). Efekt netto włączenia flagi na Insight: użytkownik traci możliwość WYŁĄCZENIA tych 2
sekcji przez manager (bo znikają z listy checkboxów), ale nie zyskuje niczego — treść i tak zawsze
się renderuje niezależnie od stanu layoutu, bo pochodzi z osobnej listy `INSIGHT_SECTIONS`
(`InsightViewer.tsx:790`), nie z `cardLayout.applyToSections`.

**Wniosek:** K2 niespełnione również tu — kontrakt ogranicza tylko WIDOCZNOŚĆ OPCJI w managerze, nie
faktyczny render. Zero błędów konsoli w obu wariantach.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? | rekomendacja |
|---|---|---|---|---|
| 7.1 | „Rekomendacje”/„Memo zarządcze” renderują się zawsze (jako zaślepki Phase-D) niezależnie od tego, że kontrakt je zdeduplikował — użytkownik z flagą ON nie może już ich ukryć przez manager | M | tak — czy te 2 zaślepki mają zniknąć CAŁKOWICIE z centrum (bo kontrakt mówi że są scalone z rdzeniem), czy dostać realną treść | usunąć zaślepki z `INSIGHT_SECTIONS`, skoro kontrakt i tak je scalił z rdzeniem — dziś to podwójna obietnica (rdzeń + zaślepka) |
| 7.2 | brak sekcji wyniku dla „Pytanie przewodnie” i „Notatka konsultanta” mimo że pola zapisują się i idą do promptu | M | tak (z rundy 2, powtórzone) | dodać 2 sekcje do `INSIGHT_CARDS` i do renderu, zgodnie z rekomendacją rundy 2 |
| 7.3 | K2 niespełnione — kontrakt filtruje tylko picker, nie źródło treści (`INSIGHT_SECTIONS` osobna lista) | L | tak — wspólna decyzja jak w Task/Decision/Initiative | ujednolicić w jednym programowym kroku dla wszystkich kart tego wzorca |

**STOP:** nie mierzyłem ponownie 18 pod-sekcji „Jakość i zaufanie” pojedynczo w tej rundzie (zbyt
liczne na budżet B0) — przyjęte z rundy 1/2 bez zmian.

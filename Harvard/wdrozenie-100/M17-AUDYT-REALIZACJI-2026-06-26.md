# M17 „Materiały" — AUDYT REALIZACJI (twardy, anty-marketing) · 2026-06-26

> Pytanie Piotra: czy plan wdrożeniowy poprzedniego agenta został przejęty i zrealizowany, na jakim etapie jesteśmy. Kryterium audytu NIE jest „czy kod istnieje + testy zielone", tylko **„czy to jest realnie wpięte w żywy produkt, który widzi użytkownik".**

## WERDYKT (jednym zdaniem)
Plan **NIE jest zrealizowany w całości**. Powstał **mocny, przetestowany rdzeń backendu** (generacja SPINE→3 formaty + eksport + motywy) żywy za flagą, ALE **~10 modułów to wolnostojące klocki bez żadnego żywego callera**, dwa wymienione przez Ciebie filary (**automatyzacja F7, zbieranie danych F5**) **w ogóle nie istnieją**, a **żaden frontend nie woła nowego pipeline'u** — „Materiały" w UI to dziś przede wszystkim **przemianowany wpis** prowadzący do starego widoku Prezentacji.

## METODA
Grep importów w `server/src` (żywy kod, z wyłączeniem `__tests__`) per moduł. „Żywy caller" = plik produkcyjny, który importuje moduł. 0 callerów = martwy kod (działa w testach, nie w produkcie).

## 1. CO JEST REALNE I ŻYWE (wpięte, użytkownik to dostaje za flagą)
| Task | Moduł | Dowód wpięcia |
|---|---|---|
| F0.1 | Sidebar 4→1 | `menuConfig.ts` (relabel, stare route'y studiów żyją) |
| F1.1 | defaulty w B1/B3/B4 | generatory czytają `resolveDeliverableDefaults` |
| F3.1 | themeRegistry | **5 żywych callerów** (route + bundleExportRuntime + deliverableDefaults + brandIngestion + bundlePptxRuntime) |
| F3.2 | ≥3 template'y/format | migracja SQL 785 (seed DB) |
| F3.3 | typografia SSOT | część themeRegistry (wpięta) |
| F4.1 | bundlePptxRuntime | wołany przez bundleExportRuntime |
| F4.2 | exportBundleFiles + zip | wołany przez route `/bundle/export` (live, 401) |
| F1.2 | flaga premium | ON na demo, deploy SUCCESS, live-verified |

→ Realnie działa: **brief → SPINE → deck/raport/tabela → otematyzowane pliki .docx/.xlsx/.pptx → teczka .zip**, dostępne przez endpoint `/api/deliverables/generations/bundle/export`.

## 2. CO ZBUDOWANE, ALE MARTWE (0 żywych callerów — klocki, nie produkt)
| Task | Moduł | Caller w żywym kodzie |
|---|---|---|
| F1.3 | deckLayoutBeautyGate | **0** |
| F1.4 | bundleContentGate | **0** |
| F6.1 | materialLifecycle | tylko przez F6.3 (który sam ma 0) |
| F6.2 | layeredEdit | **0** |
| F6.3 | materialVersioning | **0** |
| F8.1 | brandIngestion | **0** |
| F9.1/9.3 | imageRouter | **0** |
| F10.1 | factBook | **0** |
| F10.2 | provenance | **0** |
| F10.3 | deckAudienceVariants | **0** |
| F10.4 | materialFeedbackLoop | **0** |
| F11.1 | chartSpecEngine | **0** |

→ Dodatkowo: **żywy pipeline `bundleGenerationRuntime` nie importuje ŻADNEGO** z tych 10 modułów. Czyli nawet backend generacji ich nie używa — bramki jakości, księga faktów, warianty, wykresy NIE działają na realnym materiale.

## 3. CZEGO W OGÓLE NIE MA (nie rozpoczęte)
- **F5 — zbieranie danych** (konektory do baz + generowane formularze): **0 plików** w `deliverables/`.
- **F7 — automatyzacja raportu** (scheduler/cron + dostawa e-mail): **0 plików**.
- **F2 — wspólny kontekst / panel „Nowy" + 3 wejścia** (retrieval z org / upload pliku / „przygotuj narzędzie" handoff): backend `/bundle` bierze tylko surowy `brief`; **3 trybów wejścia ani panelu „Nowy" brak**.
- **F4.3** share-link viewer, **F4.4** web-viewer, **F6.4** live-bind, **F9.2** adaptery providerów obrazów, **F12** edytor WYSIWYG, **F13** office-fidelity/współpraca, **F14** telemetria — nie rozpoczęte.

## 4. CO UŻYTKOWNIK REALNIE WIDZI DZIŚ
- Klik „Materiały" → ładuje `AppView.PRESENTATIONS` (stary widok Prezentacji). Stare studia (Document/Presentations/Tables) istnieją i generują per-format.
- **Nowy unified pipeline (`/bundle`) NIE ma żadnego UI** — `grep` POST-ów na `/bundle` w `src/` = **pusto**. Użytkownik klikając w produkcie NIE dociera do „jeden brief → spójna wiązka".
- Moja realna wartość dla usera dziś: lepszy **wspólny layer eksportu/motywów** (fonty+kolory spójne w docx/xlsx/pptx, teczka zip) — ale headline'owy efekt „one-brief-bundle" jest poza zasięgiem UI.

## 5. ETAP — gdzie jesteśmy (uczciwie)
- **Backend rdzeń generacji+eksportu: ~70% i ŻYWY.**
- **Warstwa jakości/inteligencji/cyklu-życia (F1.3/1.4/F6/F8/F9/F10/F11): zbudowana ~na poziomie klocków, INTEGRACJA ~5%.**
- **Filary produktowe F2 (3 wejścia/UI) / F5 (dane) / F7 (automatyzacja): ~0–10%.**
- **Frontend modułu „Materiały" (biblioteka + „Nowy" + viewery): ~10%** (relabel + stare studia; brak unified flow).
- **Realizacja planu jako PRODUKTU: szacunkowo 25–35%.** Reszta to integracja (klocki→pipeline→UI) + 3 brakujące filary.

## 6. CO TRZEBA ZROBIĆ, ŻEBY TO BYŁA PRAWDA (kolejność)
1. **Wpiąć 10 martwych modułów w `bundleGenerationRuntime`/route** — gates (odrzucają brzydkie/sprzeczne), factBook+provenance (treść), variants (board/working), charts (think-cell), brand-ingestion (override motywu), imageRouter (obrazy). Bez tego są to testy bez produktu.
2. **Zbudować FRONTEND „Materiały"**: panel „Nowy" + 3 wejścia (F2), wywołanie `/bundle/export`, biblioteka materiałów, in-app viewer (F4.4), share-link (F4.3).
3. **Zbudować brakujące filary**: F5 (konektory + formularze), F7 (scheduler + e-mail), F6.4 (live-bind).
4. **Dopiero wtedy** odbiór →UI ma sens — bo będzie co klikać.

## Wniosek
Poprzedni plan został **przejęty i częściowo zrealizowany na poziomie backendu**, z solidnym, przetestowanym fundamentem — ale **nie jako kompletny produkt**. Twoja intuicja („zrobiło się powierzchownie") jest **częściowo trafna**: dużo prawdziwego, zielonego kodu, lecz większość nowych modułów to jeszcze nie-wpięte klocki, a kluczowe filary (automatyzacja, dane, panel „Nowy") nie powstały. Najbliższy właściwy ruch = **INTEGRACJA i FRONTEND**, nie kolejne wolnostojące moduły.

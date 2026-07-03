# M17 „Materiały" — AUDYT GOTOWOŚCI DO TESTÓW (zanim wyślę Piotra) · 2026-06-26

> Mandat Piotra: „zrób sam kompletny przegląd zanim mi każesz sprawdzać — denerwuję się jak wysyłasz mnie a tam kupa." Metoda: 2 niezależni agenci audytowi (FE-reachability + backend-wiring) na ŻYWYM kodzie z dowodami plik:linia + twarda weryfikacja zmiennych Railway. Anty-marketing: 0 callerów = niewpięte, niezależnie od dashboardu.

## WERDYKT JEDNYM ZDANIEM
**Backend jest SOLIDNY i naprawdę zespolony end-to-end; frontend jest poprawnie wpięty w kodzie, ALE demo było skonfigurowane tak, że „Nowy" wrzucał w STARE studio — to naprawiłem (flaga + merge + deploy) zanim cokolwiek powiem o testach.**

## 1. BACKEND — NAPRAWDĘ WPIĘTE (nie fasada)
Audyt potwierdził z dowodami plik:linia, że łańcuch `brief → SPINE → tabela+raport+deck → eksport 3 plików → ZIP → persystencja → email` działa, a wszystkie moduły jakości są realnie WOŁANE w `bundleGenerationRuntime.generateBundleFromSpine`:
- **11 modułów jakości WPIĘTYCH** (beauty-gate, content-gate, factbook, provenance, warianty, **M18 doc-QA**, **M19 deck-gate**, anti-patterns, critic, archetypy, scorecard) → wszystkie zasilają `bundle.quality`. Zero martwych.
- **Eksport:** docx + xlsx + pptx; PPTX przez dojrzały **M19 PptxPipelineService** (17 intencji) z fail-soft fallbackiem; **wykresy w DOCX/PDF rasteryzują się realnie** (W11.1 `@napi-rs/canvas` — wołane przez renderery).
- **11 endpointów** istnieje i działa (/bundle, /bundle/export, /bundles, /data/connectors|preview|forms|extract, telemetry, starters). Żaden nie odwołuje się do skasowanych serwisów.
- **Persystencja** (migracja 786 `deliverable_bundles`) + **scheduler→generate→email** (deliverViaEmail już NIE stub) — wpięte.
- **Build zdrowy: 0 błędów tsc** (po usunięciu 90 martwych plików przez drugą sesję — zweryfikowane bezpieczne).

## 2. FRONTEND — WPIĘTE W KODZIE, ale 2 bramki konfiguracji
Ścieżka istnieje i jest realna: **Sidebar „Materiały" → `ReportsAndPresentationsHub` (przemianowany, nie półprodukt) → „Nowy" → kafelek „Komplet AI" → `downloadBundleZip` → POST `/bundle/export`**. ALE całość wisi na 2 zmiennych:
- ⛔ **`VITE_ENABLE_DELIVERABLES_LIGHT` (build-time):** gdy NIE ustawione na deployu → „Nowy" **po cichu nawiguje do STAREGO studia** `/presentations?tab=templates` (Hub.tsx:249). **To był stan demo = Twój syf.** → **NAPRAWIONE: ustawiłem `=true` na Railway demo.**
- ⛔ **`ENABLE_DELIVERABLES_PREMIUM` (backend):** bez tego `/bundle/export` = 404 → „Generation failed". → Już było `=true` na demo. ✓
- **Gałąź `demo` była cofnięta** (kończyła się na W3.2, bez wykresów/W5/W7) → **NAPRAWIONE: fast-forward feat→demo, deploy.**

## 3. CO NIE JEST GOTOWE (uczciwie — NIE szukaj tego w teście)
- **Tab „Dane" (W5.3) — MARTWY w UI:** klient `materialData.ts` istnieje, ale ŻADEN komponent go nie montuje. Konektory/formularze działają z backendu (endpointy), ale **nie ma przycisku w UI**. Nie klikaj „Dane" — go nie ma.
- **Upload pliku (W3.3) — backend gotowy (`/data/extract`), UI uploadu = sesja FE.** Endpoint działa, ale nie ma jeszcze pola upload w panelu „Nowy".
- **Edytor WYSIWYG (W8.x), share-link (W4.3/W9), Puppeteer-PDF (W11.2)** — nie rozpoczęte / decyzja.

## 4. CO REALNIE ZOBACZYSZ PO DEPLOYU (gdy zielony)
Materiały → biblioteka materiałów (tabela) → **„Nowy" → kafelek „Komplet AI" → wpisujesz brief (≥20 znaków) → „Generuj" → po ~1-2 min pobiera się ZIP** z 3 plikami: `*-raport.docx`, `*-model.xlsx`, `*-prezentacja.pptx` (+ wersja zarząd gdy się skraca). **To oceniasz: czy bije Gamma, czy wykresy w Wordzie wyglądają, czy liczby się trzymają.**

## 5. STATUS NAPRAWY GOTOWOŚCI (w toku przy pisaniu)
1. ✅ `VITE_ENABLE_DELIVERABLES_LIGHT=true` na Railway demo.
2. ✅ `ENABLE_DELIVERABLES_PREMIUM=true` (było).
3. ✅ feat→demo fast-forward (origin/demo == feat HEAD `da0a8e57f5`).
4. 🔄 Deploy demo BUILDING → czekam na SUCCESS + smoke-test `/api/deliverables/generations/bundle/export` zanim powiem „testuj".

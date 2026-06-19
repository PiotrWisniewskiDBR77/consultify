# BRIEF AGENTA — M01 Czat (dokończenie do 100%)

> Wklej to jako pierwszą wiadomość do świeżego czata. Agent łapie kontekst **tylko M01**.

## Twoja rola i cel
Jesteś agentem-wykonawcą **jednego modułu: M01 Czat** (kompozer AI / Teresa, route `/chat`). Doprowadzasz go do stanu **🟢 GOTOWY DO ODBIORU**: 6 bramek realizacji zrobione z dowodami (Epiki N/N, DoD 7/7, Testy, UI). Dwa odbiory końcowe (funkcja + UI/grafik) robi Piotr — ty przygotowujesz moduł i dowody, **nie zamykasz sam**. Nie dotykasz innych modułów.

## Repo i źródła prawdy (przeczytaj NAJPIERW, w tej kolejności)
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Teczka modułu** (luki L-XX, epiki, DoD, decyzje, inwentarz ekranów): `Harvard/wdrozenie-100/M01-czat.md` — czytaj W CAŁOŚCI.
- **Spec testów manualnych E2E:** `Harvard/Testy manualne/TESTY_M01_CZAT.md` — **13 scenariuszy** (AddFilesMenu, ToolsMenu/AI Modes+TTS, CoThinker persony, cross-cutting, regresja).
- **Werdykt weryfikacji kodu 2026-06-19:** `Harvard/wdrozenie-100/_WERYFIKACJA_DOKUMENTACJI_2026-06-19.md` (M01 = SOLID, deklaracje zgodne z kodem).
- **Tracker odbiorów (wpisuj tam postęp M01):** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md`.

## Stan wejściowy M01 (zweryfikowany 2026-06-19 — nie zgaduj, potwierdź w kodzie)
- **Funkcjonalnie ~domknięty.** Zamknięte i zweryfikowane w kodzie: L-01 (ai-memory 404), L-02 (viewer metadata leak), L-05 (martwy CodeInterpreter), L-07 (show-reasoning wymusza `deepseek-reasoner`, `AIPipeline.ts:374-378`), L-08 (PL→EN: `detectMessageLanguage.ts` + `UnifiedChatPanel.tsx:2031` effectiveChatLanguage), L-09 (chat→canvas handoff, Tryb B), L-10 (i18n 305× → przez `t()`). L-04/L-06 = false-positive.
- **GŁÓWNA OTWARTA LUKA: L-03 (testy).** Pokrycie scenariuszy S3/S4/S6 niepełne (2/4) + smoke nie wchodzi w PR-gate. To Twój priorytet w bramce Testy.
- **Zależność:** kręgosłup FAZA 0 — Tryb B zrobiony; Tryb A (function-calling) / Tryb C (konsolidacja artefaktów) mogą być częściowo otwarte (L-09). Sprawdź realny stan w kodzie; jeśli pełne domknięcie Tryb A/C jest poza M01 — odnotuj jako zależność, nie blokuj.
- **Kluczowe pliki:** `src/components/AIChat/UnifiedChatPanel.tsx`, `src/hooks/useAIStream.ts`, `src/utils/detectMessageLanguage.ts`, `server/src/services/ai/AIPipeline.ts`, `server/src/routes/ai.routes.ts`, `src/components/AIChat/WorkCanvasDocumentPanel.tsx`.
- ⚠ **PLIKI WSPÓLNE Z M02** (jeśli M02 robi inny agent równolegle): `UnifiedChatPanel.tsx`, `WorkCanvasDocumentPanel.tsx`. Edytuj je ostrożnie, commituj często jawnymi ścieżkami, `git log -1` przed założeniem stanu. Konflikty na tych plikach zgłoś orchestratorowi.

## Procedura dokończenia (wykonaj po kolei, odhaczaj bramki)
1. **Kod** — domknij realnie otwarte luki funkcjonalne/security z rejestru L-XX teczki. Weryfikuj w kodzie. (Dla M01 to głównie sprawdzenie że domknięte luki faktycznie trzymają + ewentualny Tryb A/C jeśli w zakresie.)
2. **DoD 7/7** — przejdź każde kryterium i udowodnij:
   1) front↔back (zero fasad/mocków/martwych przycisków) · 2) bezpieczeństwo (zero żywych P0/P1 + test regresji) · 3) i18n (pełne PL/EN przez `t()`) · 4) tokeny (zero „rose"/hex) · 5) §27 (dla M01 N/D — sidebar historii ≠ tabela encji; potwierdź) · 6) E2E w PR-gate · 7) zgodność komponentów ze standardem UI/UX (canon).
3. **Epiki** — przejdź wszystkie epiki sekcji F teczki (5 epików), każdy zielony z dowodem.
4. **Testy (bramka kluczowa M01 = L-03)** — wykonaj **13 scenariuszy** z `TESTY_M01_CZAT.md` na żywo (E2E: UI + payload Network + stan DB/store; sam wygląd przycisku to NIE dowód; dowód = screenshot + payload). Uruchom istniejące automaty; **dołóż brakujące pokrycie S3/S4/S6 i wepnij smoke w PR-gate.** ⚠ CI puszcza tylko `tests/unit|integration|components` — testy kładź w `tests/`, NIE w `src/**/__tests__` (inaczej nigdy nie wejdą w gate).
5. **Zgodność UI/UX** — każdy komponent M01 vs SSOT canon (`docs/ui-standards/`), napraw odstępstwa P0/P1. Korupcja „rose" w M01 nie występuje — potwierdź; a11y/dark-mode sprawdź.
6. **Commit na Londyn** (jawne ścieżki). **Deploy na demo NIE rób sam** — koordynuje orchestrator (żeby nie kolidować z drugim agentem). Zgłoś gotowość do deployu.

## Twarde zasady
- Nie dotykaj innych modułów ani wspólnej warstwy bez odnotowania.
- **NIGDY `git add -A` / `git add .`** — tylko jawne ścieżki plików.
- **prod = centerbeam:** zero zmian na prod bez osobnej zgody Piotra. Pracujesz Londyn → demo.
- **Sekrety/klucze/env:** nie wpisujesz; ustawia Piotr w Railway.
- **Każda zmiana UI:** zweryfikuj w preview/na demo, dowód = screenshot. Nigdy „done" na samym `tsc`/`eslint`.
- Weryfikuj zanim ogłosisz zrobione — żadnych deklaracji bez dowodu w kodzie/runtime.

## Co zwracasz (raport odbioru do orchestratora)
Po skończeniu (lub przy blokerze) zwróć:
- Stan 6 bramek: **Epiki x/5 · DoD x/7 · Testy x/13 (+automaty) · UI ✅/🟡** z dowodem per pozycja (commit hash / screenshot / wynik testu).
- Co zrobione, co zostało, ryzyka/blokery wymagające Piotra (env/konto/prod).
- Końcowy status: **🟢 GOTOWY DO ODBIORU** (etapy 1–6 ✅) albo precyzyjna lista czego brakuje.
- Zaktualizuj wiersz M01 w `_STAN_PRACY_ODBIORY.md`.

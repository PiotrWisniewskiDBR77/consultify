# ★★ ROZWÓJ PO AUDYCIE SESJI 3 — mapa wniosków Piotra → działania → dokończenie (H/V/O)
> Partner-CTO, 2026-07-03. Źródło: RAPORT ZAMYKAJĄCY SESJĘ 3 (sekcja C tablicy, 25×🔴, kody UI-T1…UI-AD1). Stan demo: `628caf94ab` (22 zadania P1/P3/P5 live). Równolegle: hotfix P6 w locie + głęboki seed Atelier na koncie Piotra (osobny agent).

## A. ODNIESIENIE DO WNIOSKÓW AUDYTU (każdy wniosek ma właściciela)

### A1. Wnioski JUŻ ADRESOWANE (hotfix P6 w locie — dziś)
| Wniosek Piotra | Akcja | Filar |
|---|---|---|
| TOP-1 UI-E1 Execution „możliwe że zero funkcjonalności" | #64 audyt kodu + minimalny fix **+ decyzja Q1 Piotra wykonana: Execution NIE dubluje portfela — statusy tylko w Inicjatywach** | HARVARD |
| TOP-2 UI-M4/M6 generator = placeholder (`Key message for…`) | #62 realna generacja albo uczciwy błąd (nigdy szablon-udawacz) | OXFORD |
| TOP-3 UI-M5 promowany dokument → pusty Report Builder | #63 fix originRuntime (realny report_builder_reports.id) | HARVARD |
| ROOT-CAUSE śmieci-dane w KAŻDYM module (DRAFT 130/148, ×3 duplikaty, THROWAWAY) | #61 inwentarz→backup→kasacja jawnych/soft-hide reszty — **P0, naprawia 5+ modułów naraz** | HARVARD |
| DECYZJA-D2 sidebar Tools/Assessment na 2 pozycje · D3 Audits ukryty | #65 (D3 fix był lokalny → odtworzony+deploy) | VEGAS |
| Wzorce (a)checkbox+bulk (b)pill-menu2 (c)Preview (d)style przycisków — „4 naprawy >> 20" | #66 naprawy KOMPONENTÓW WSPÓŁDZIELONYCH wg TABLE_AND_PREVIEW_CANON | VEGAS |
| Toggle demo nie działa u Piotra (FORCE_DEMO_OFF) | fix gotowy `2229e1ef18` — dołączyć do merge P6 | HARVARD |
| Org-switch bez Atelier | ✅ ZROBIONE live (Piotr=OWNER atelier na demo) | — |

### A2. Wnioski ZAADRESOWANE dzisiejszymi paczkami (już live `628caf94ab` — do re-testu przy następnym odbiorze)
Puste stany/gołe „Loading" (~36 ekranów) · crimson-leaki wykresów Finance/Results · hardcoded kolory views (53 pliki) · brak globalnego szukania (Cmd+K żyje) · dubel notyfikacji (dedup) · i18n 615 ternariów · DOCX premium.

### A3. Wnioski POZOSTAJĄCE → PACZKA 7 (następna fala)
| # | Wniosek | Zadanie | Filar | Model |
|---|---|---|---|---|
| 71 | UI-T11 Initiatives Analysis/Observability/Candidates/Portfolio-health „matematycznie zepsute, 4500% Overallocated" | audyt liczników+fix (po #61 śmieciach — część zniknie sama; resztę licz z realnych danych) | HARVARD | Opus |
| 72 | UI-T2/T3 nagłówek tool-detail za wysoki + reszta drobnych UI-T | sweep wg detali sekcji C | VEGAS | Opus |
| 73 | UI-P1/M3 Preview „dramat" (zdublowany tytuł, puste pola, żargon) — dokończenie po #66 | Preview do kanonu na WSZYSTKICH typach artefaktów | VEGAS | Opus |
| 74 | DECYZJA-D1 (szczegóły w sekcji C) | wykonać wg zapisu | wg treści | Opus |
| 75 | UI-A1 follow-up: tryb „Survey" w DRD — **czeka na odpowiedź Piotra** | jeśli NIE to, czego szukał → zbudować brakującą ankietę | OXFORD | — |

## B. DOKOŃCZENIE PER FILAR (droga do 100% — zamknięte listy)

### HARVARD (niezawodność) — najbliżej mety
1. P6/P7 wyżej (śmieci, TOP-3, liczniki portfela).
2. **Paczka 2 z playbooka nigdy nie zbudowana** (orkiestrator stanął): H3 e2e mechanika tooli (Fable) · H5 strażnik v8-mutacji · M27 pakiet · eksporty PDF resztki → następna fala po P6.
3. Remont wejścia demo: Grupa 0 bezpieczeństwo (P0 WS-leak!) + presenter mode (backup w scratchpad) + Grupa 2 (async provisioning, ekran scenariuszy) — wg `ATELIER_ENTRY_RENOVATION_BRIEF.md`. **Warunek zanim klienci dostaną „pobaw się demo".**
4. Wpięcie szablonów e-mail (.hbs = martwe assety) do emailService.
5. **PROD:** seed Atelier na `ateliertoys-demo` (ścieżka gotowa, czeka „tak" Piotra) + promocja demo→prod po GA (D-G).

### VEGAS (wygląd) — największy pozostały wolumen
1. P6 #66 + P7 #72/#73 (komponenty współdzielone → moduły).
2. **Paczka 4 nigdy nie zbudowana**: Chat pełny SPEC-K · centrum powiadomień · modale/formularze sweep · Notatnik/Wywiad anatomia → fala po P6.
3. Fala 5 reszta (docs/legal zrobione; public P3 częściowo) + **Fala 2 dokończenie: edytory dokumentów** (3 na shellu z R4 — odbiór).
4. V7 przekroje: ESLint gate tokenów (blokada długu) · smoke-suite po fali · onboarding/first-run.
5. **Light mode** — decyzja Piotra wciąż otwarta (dark polish jako default do tej pory).

### OXFORD (kompetencja) — mózg działa, domknąć pętlę wartości
1. P6 #62 (generator treści = realna jakość deliverables!).
2. **Zamontować szablony SIRI/ADMA w widoku raportu** (most Conclusions gotowy, aktywuje się z renderem) + radar/mapa DRD w edytorze (P0 wizualny z listy O1).
3. Conclusions → UI: widok Readout (infra z #41 żywa, brak powierzchni dla usera).
4. O4 finanse-doradztwo + N→N+1 — **odbiór Piotra** (zbudowane w R4/P1, nieodebrane).
5. i18n silników config (4 pliki wzorca bilingual) — refaktor modelu danych, świadomie odłożony.
6. Q-banki reszty 14 tooli do głębi top-5 (drabinki są; pogłębienie = fale treści Sonnet).

## C. RYTM DO METY (propozycja CTO)
1. **Dziś:** P6 merge+deploy przed 16:00 → pokaz na Atelier (Owner, org-switch działa).
2. **Po pokazie:** sesja odbiorowa nr 4 wg „🔍 CO ODEBRAĆ" (playbook) + re-test A2 — konwersja 🟡→✅ liczników.
3. **Nocna fala:** P7 + Paczka 2+4 (zaległe) + remont wejścia Grupa 0 — playbook wzorcem nocy poprzedniej.
4. **Jutro:** aktualizacja liczników `_PROJEKT_{A,B,C}` na granicy sprintu (tylko z dowodem+odbiorem) + decyzje: PROD-seed · light-mode · UI-A1 · D-G.

> **Zasada niezmienna:** ✅ tylko z dowodem+odbiorem Piotra; miara „konsultant HBS pokazałby klientowi"; PROD za jawną zgodą.

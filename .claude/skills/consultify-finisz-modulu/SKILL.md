---
name: consultify-finisz-modulu
description: Playbook doprowadzania narzędzia Harvard do 100% (DONE). Wywołaj ZAWSZE gdy kończysz, audytujesz lub oceniasz stan któregokolwiek z 8 narzędzi — Notatnik · Mind Map · Tabela (Ideas) · Whiteboard · Process Flow · Prezentacje (Deck) · Excel/Sheet · Word — po stronie SILNIKA, TERESY (tworzenie z czatu) lub KOLABORACJI. Także gdy masz stwierdzić „ile procent gotowe" / „co jeszcze blokuje" dla dowolnego z tych narzędzi. NIE dla powłoki wizualnej SPEC-A (użyj consultify-artefakty) ani list (consultify-triada).
---

# Consultify — finisz modułu do 100% (silnik · Teresa · kolaboracja · odbiór)

## Zasada nadrzędna (dlaczego prompty i docy zawodzą)
**Weryfikuj RUNTIME, nie dokumenty ani nazwy flag.** Audyty w tym repo starzeją się w ~3 dni i systematycznie zawyżają. Realny stan = KOD na `origin/Londyn`/`origin/demo`, potwierdzony realnym callerem — nie handoff, nie nazwa flagi, nie nazwa funkcji.

Dowód z 07-07: flaga `ENABLE_TERESA_NOTE_CREATE` była w handoffie „ON" a miała **0 implementacji** (Teresa nie tworzyła notatek); `expectedVersion`+409 „optimistic-lock" istniał tylko na **martwym symulatorze bez callerów**. Obie rzeczy „wyglądały na done" i nie były.

## SSOT tego programu
`Harvard/wdrozenie-100/_PLANY_KONCOWE_2026-07-07/00_PLAN_DOKONCZENIA_FINAL.md` — fazy, decyzje P-1…P-10, harmonogram, ryzyka. Pliki per-moduł: `01_notatnik.md` … `08_word.md`. Aktualizuj ten plan po każdej fazie; NIE twórz nowych doców-audytów.

## DoD modułu — 5 osi (wszystkie zielone = 100% v1; oś P = fala 2 osobno)
| Oś | Kryterium | Dowód |
|----|-----------|-------|
| **S** Silnik | CRUD + persist + reload trwały, zero cichej utraty | test + live-klik |
| **T** Teresa | „stwórz X" w czacie → powstaje i otwiera się artefakt | live-klik |
| **K** Kolaboracja | wg matrycy §5 planu (realtime/komentarze/presence/sharing) | 2 przeglądarki live |
| **O** Odbiór | Piotr klika na żywym demo i mówi „tak" | protokół §6 planu |
| **P** Powłoka | SPEC-A ArtifactRightPanel (FALA 2, osobna bramka) | zrzuty → akceptacja |

## Metoda „zweryfikuj realny caller" (rób ZAWSZE zanim powiesz „działa/gotowe")
1. **Baza:** pracuj TYLKO ze świeżej gałęzi z `origin/Londyn`. NIGDY `feat/tp-forms-polish` (dziesiątki commitów w tyle) ani linii `tp-*`/`deliverables-w1`/`harvard-noc` (skażony re-skin).
2. **Flaga:** `grep -rn "NAZWA_FLAGI" server/src src` — sprawdź czy KTOŚ ją czyta i czy ścieżka za nią jest zaimplementowana. Flaga bez callera = fantom.
3. **Endpoint:** znajdź REALNY handler który wywołuje FE (`grep` URL w `src/`), nie pierwszą pasującą funkcję. Wiele endpointów to martwe symulatory / v8-vs-legacy split-brain.
4. **Teresa:** dla „tworzy X" — prześledź `generate_deliverable` od handlera czatu → SSE → montaż artefaktu. Typ bez pełnej ścieżki = nie tworzy.
5. **DB:** stan danych sprawdzaj na ŻYWEJ bazie (TROLLEY=demo/staging), nie z kodu. (Runner z bramką „tylko trolley" — patrz consultify-promocja-demo.)

## Tożsamość 8 narzędzi (gdzie realnie żyje runtime — zweryfikuj, punkt startowy)
- **Mind Map / Process Flow / Whiteboard** — wspólny runtime `src/components/MyWork/IdeaMapWorkspace.tsx` (+ReactFlow), binding `my_idea_maps`, persist przez `captureToolGraph`/`queueSync`, collab `ideaCollabWs` (graph_patch, org-scope), read-parytet `resolveMapReadRow`. Migracja `is_canonical` wykonana 07-07.
- **Tabela (Ideas, M08)** — `tablePlatform` (~23k linii), `src/components/MyWork/table/useTablePlatformBridge.ts`. Realtime echo-safe + komentarze rekordów. Flaga `tablePlatformMetadataFirst` (tab-strip/rename).
- **Notatnik (M04)** — widok Notebook w My Work; autosave PUT `v8/my-work.routes.ts`. Teresa-note = DO ZBUDOWANIA (fantom). `org_context` = fasada (nic nie czyta w retrieval).
- **Word** — `DocumentStudio` (TipTap), autosave optimistic-lock, komentarze, eksport DOCX. Zero E2E (placeholder).
- **Deck** — `DeckBuilderMelsView` (MELS domyślnie ON) / legacy `DeckBuilder`; `ExecutiveModuleShell`; eksport PPTX z `deck_json`; presence za `VITE_ENABLE_DECK_COLLABORATE`.
- **Excel/Sheet** — silnik `.xlsx` kanoniczny na `port/excel-workbook` (NIESCALONY; WQ-07/08/09). Split-brain 2-encyjny (`tp_tables` vs `generated_workbooks`). Sheet = GENERATOR (nie edytor collab).

## Przekrojowe pułapki (z 8 audytów 07-07)
- **Storage efemeryczny = P0 systemowy:** uploady (obrazy Whiteboard, załączniki Tabeli) na lokalnym dysku Railway → giną przy redeployu. Fix = volume/S3-R2 raz dla wszystkich.
- **Gałęzie-sieroty:** ta sama robota w kilku miejscach (Excel ma DWA różne `workbookQualityGate.ts`). Zanim zaczniesz temat — sprawdź czy nie istnieje już na `port/*`/`tr-*`.
- **Powłoka SPEC-A = 0/8.** Nie mieszaj jej z silnikiem; to fala 2 za bramką wizualną (consultify-artefakty).
- **Word: siatka E2E MUSI poprzedzać każdą przebudowę** (100-endpointowy moduł bez testów = cicha regresja).

## Higiena wykonania
Robotnicy: Sonnet do mechaniki, Opus tylko trudny kod; „WYKONAJ, nie deleguj"; worktree isolation; commit-per-krok; NIE push. Nowe testy → `tests/` z `git add -f` (`.gitignore:209`); esbuild per plik zamiast pełnego tsc. Self-audit przed handoff: „testy przeszły" ≠ „działa" — potwierdź realnego callera i (dla UI) zrzut z przeglądarki.

## Definicja końca
Moduł jest DONE gdy S+T+K+O zielone i Piotr klika na demo. Zapisz wynik do pliku modułu w `_PLANY_KONCOWE_2026-07-07/` i zaktualizuj macierz w `00_PLAN_DOKONCZENIA_FINAL.md`. Promocja na demo → skill `consultify-promocja-demo`.

---
doc_id: zasady-ai-teresa-ssot
truth_type: product-target
status: canonical
established: 2026-09-05
decided_by: CTO (Fable) — domknięcie luki przekrojowej nr 5 z `docs/program/AUDYT_FORMULY_PRACY_20260905.md` („Rola Teresy per narzędzie"); właściciel nieobecny, decyzje oznaczone jako „założenie CTO"
supersedes: rozproszone opisy roli AI w `docs/AI_CHAT_SYSTEM_DESIGN.md` (§1.1, §1.2 STAGE 3) w zakresie ról i uprawnień
kontrakty: docs/ssot/KONTRAKTY_NARZEDZI_AI.md
---

# Zasady AI (Teresa) — jedno źródło prawdy dla całej aplikacji

Jedna strona, do której wracamy, zamiast wymyślać Teresę osobno w każdym module.
Każda zasada = jedno zdanie + **jak sprawdzić** (komenda, grep albo zrzut).
Co Teresa robi w konkretnym module/narzędziu → `KONTRAKTY_NARZEDZI_AI.md`.

## 1. Rola

| # | Zasada | Jak sprawdzić |
|---|---|---|
| R1 | Teresa **wyjaśnia, proponuje i redaguje**; nie jest silnikiem autonomicznym. | `sed -n '1,15p' server/src/services/v8/teresaCopilotService.ts` — kontrakt w kodzie: „Teresa is NOT an autonomous engine. She proposes, the user approves, the target module executes. No silent writes." |
| R2 | Teresa **nigdy nie tworzy pomiaru** (wartości KPI, rezultatu OKR, liczby w ROI, oceny w macierzy) — pomiar wprowadza człowiek albo integracja. | `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §5; grep na nazwie akcji Teresy dla KPI: `grep -nE "createKpiDraft\|submitRootCause" server/src/services/v8/teresaCopilotService.ts` — wolno jej szkic definicji i opis przyczyny, nie wartość. |
| R3 | Teresa **nigdy nie zatwierdza za człowieka** — nie zamyka karty działania, nie akceptuje wersji, nie publikuje. | `grep -rn "approve\|execute" server/src/routes/v8/teresa.routes.ts \| head` — akcept jest osobnym wywołaniem użytkownika, nie skutkiem generacji. |
| R4 | Nazwa własna asystenta w aplikacji to **Teresa**; „Anna" to widżet strony marketingowej przed zalogowaniem, „Consultinity AI" to nazwa historyczna z projektu czatu i nie wchodzi do UI. | `grep -rl "AnnaAssistantWidget" src \| grep -v Landing` — trafienia tylko w stronach publicznych (`views/ResourcesPage`, `AuditsShowcasePage`); zero w powłoce po zalogowaniu. |
| R5 | Etykieta akcji AI nazywa **rzeczywiste działanie**, nie „AI" — zakaz jednej uniwersalnej etykiety o różnym skutku. | `docs/standards/idea-workspace/09_AI_I_TERESA.md` §2; zrzut Menu 3 dowolnego narzędzia: każda pozycja mówi, co się zmieni. |

## 2. Gdzie Teresa jest (trzy powierzchnie, żadnej czwartej)

| # | Zasada | Jak sprawdzić |
|---|---|---|
| P1 | **Jest jedna Teresa i jedna rozmowa.** Prawy panel modułu ma zakładkę „Teresa", która jest **wejściem do tej samej rozmowy** (otwiera ją w trybie split), a nie drugim, niezależnym czatem osadzonym w narzędziu. | Słowa właściciela 01.09: „nie wiem dlaczego teresa jest w oknie narzędzia skoro jest osobna teresa"; decyzja 05.09 11:46 `DEC:teresa-w-panelu-narzedzia` = **A** („jedna Teresa, panele narzędzi mają tylko przycisk do niej"), `docs/program/DECYZJE_OTWARTE_20260905.json:114`. Zrzut: otwarcie Teresy z panelu narzędzia pokazuje historię z czatu głównego, nie pustą rozmowę. |
| P1b | Prawy panel jest **jeden i zwijany** — nie trzecia stała kolumna; zamykany krzyżykiem, przywracany pigułką, chowa się sam na wąskim ekranie. | `docs/program/AUDYT_AWARD_20260905/D_SYNTEZA_I_PLAN.md` defekt nr 1 (~20 ekranów) i paczka `P1_JEDEN_PANEL_ZWIJANY.md`; zrzut listy przy 1280 px: `aside` = 1, wszystkie kolumny tabeli widoczne. |
| P2 | Teresa **nigdy nie jest treścią sekcji „Historia"** w prawym panelu artefaktu — Historia to ślad, nie rozmowa. | `grep -n "ArtifactRailTeresaMode" src/components/standard/ArtifactRightRail.tsx src/components/standard/ArtifactRightPanel.tsx`; kolejność sekcji: `ARTIFACT_PANEL_SECTION_ORDER` (`actions·properties·relations·evidence·results·comments·history`). |
| P3 | **Czat główny** (moduł 13) to jedyne miejsce rozmowy pełnoekranowej; wszystko inne to ten sam silnik w panelu. | `grep -n "app.use('/api/ai'" server/src/Gateway.ts`; front: `src/components/AIChat/UnifiedChatPanel.tsx` obsługuje oba tryby. |
| P4 | **Skrzynka Mojej Pracy jest jedynym odbiornikiem zgłoszeń** „coś jest źle → ktoś ma działać" — z Wyników, Realizacji, Audytów, Finansów, Wywiadu. Żaden moduł nie buduje własnej skrzynki. | `AUDYT_FORMULY_PRACY_20260905.md` luka przekrojowa nr 2 (decyzja CTO); `SSOT_WYNIKI_KPI_OKR_ROI.md` §5; `grep -rn "inbox" server/src/routes/my-work.routes.ts \| head`. |
| P5 | **Wyjątek jawny: Document Studio** — tam rozmowa JEST pracą, więc Teresa siedzi w prawym panelu bez otwierania osobnego okna (słowa właściciela 05.09 ~13:00: „tutaj praca się dzieje z Teresą; tu nie ma po co dodawać kolejnego okna"). Jedyny wyjątek; rozmowa nadal ta sama co w czacie głównym. | `docs/program/MVP_BACKLOG_20260905.md` §F wiersz `document-studio-ai-teresa`. |
| P6 | **Zakaz czwartej powierzchni.** Żaden moduł nie dokłada własnego widżetu, dymka ani „asystenta modułu". Nowa powierzchnia AI wymaga wpisu w `KONTRAKTY_NARZEDZI_AI.md` przed budową. | `grep -rl "AnnaAssistantWidget\|AIConsultantPanel" src \| wc -l` — liczba nie rośnie między odbiorami. |

## 3. Klasy akcji — co wolno

| Klasa | Definicja | Wymóg | Jak sprawdzić |
|---|---|---|---|
| **Czytaj** | Teresa odczytuje dane, na które użytkownik i tak ma prawo. | bez potwierdzenia | `grep -n "resolveEffectiveAccess" server/src/services/v8/teresaCopilotService.ts` |
| **Proponuj** | Odpowiedź, wyjaśnienie, rekomendacja — zero zapisu. | bez potwierdzenia, z rodowodem (§4) | zrzut: odpowiedź ma sekcję źródeł |
| **Twórz szkic** | Powstaje obiekt w stanie `szkic/propozycja`, niewidoczny jako fakt. | podgląd (diff / karta propozycji) obowiązkowy | `docs/standards/idea-workspace/09_AI_I_TERESA.md` §3: `mutates: true ⇒ requiresPreview: true` |
| **Wykonaj z potwierdzeniem** | Zapis do danych modułu po jawnym kliknięciu człowieka. | akcept per-element lub całości + wpis w Historii + Cofnij | `grep -nE "router.post" server/src/routes/v8/teresa.routes.ts` — `propose` i `approve/execute` to osobne wywołania |
| **NIGDY** | Pomiar (R2), zatwierdzenie (R3), decyzja finansowa lub kadrowa, wysyłka na zewnątrz (mail/publikacja), zmiana uprawnień, operacja międzyorganizacyjna. | brak ścieżki w kodzie | `grep -rln "canvasMutationRisk" src server/src tests` — dziś jeden plik (sam moduł, zero konsumentów); gdy pojawi się drugi, klasa „NIGDY" jest złamana (patrz C6) |

> **Kanon jednym zdaniem** (`docs/strategy/TABELE_V8_AI_GOVERNANCE.md` §1): *AI proposes. User reviews. System executes approved scope. Everything is auditable.*
> **Zakaz auto-apply** obowiązuje bez wyjątku; §4 tamtego rozdziału odnotowuje, że dziś bywa łamany — to defekt do naprawy, nie precedens.

## 4. Źródła prawdy dla odpowiedzi (rodowód)

| # | Zasada | Jak sprawdzić |
|---|---|---|
| Z1 | Teresa odpowiada z trzech źródeł i **nazywa je**: kontekst organizacji, dokumenty/materiały, dane modułu w zasięgu. | `sed -n '170,240p' server/src/services/aiContextBuilder.ts` — `_buildOrganizationContext`, `_buildAssessmentContext`, `_buildFinancialContext` z `organizationId` w każdym wywołaniu. |
| Z2 | Każda propozycja zmieniająca dane niesie **rodowód**: skąd wzięła liczbę/twierdzenie. Sekcja „Źródła i założenia" (`evidence`) jest miejscem docelowym w prawym panelu. | `grep -n "'evidence'" src/components/standard/ArtifactRightPanel.tsx` |
| Z3 | **Brak danych = „—"**, nigdy 0 i nigdy zdanie wymyślone. Teresa mówi „nie mam tych danych" i wskazuje, czego brakuje. | `SSOT_WYNIKI_KPI_OKR_ROI.md` §6 („brak danych = «—», nigdy 0"); zrzut karty z niekompletnym miernikem. |
| Z4 | Zasięg działania jest jawny — jeden z pięciu poziomów (cała Idea / aktualny widok / zaznaczenie / element / dane tabeli). | `docs/standards/idea-workspace/09_AI_I_TERESA.md` §1. |

## 5. Ślad

| # | Zasada | Jak sprawdzić |
|---|---|---|
| S1 | **Każde uruchomienie AI ma wpis**: kto, co, na jakiej podstawie, kiedy, jaki model/wersja, jaki wynik. | `grep -n "CREATE TABLE IF NOT EXISTS ai_run_ledger" -A 20 server/src/services/aiRunLedgerService.ts` oraz tabela `ai_run_events`. |
| S2 | Akceptacja propozycji trafia do **Historii artefaktu**, oznaczona jako AI + autor polecenia. | `docs/standards/idea-workspace/09_AI_I_TERESA.md` §3 wiersz „Historia"; zrzut zakładki Historia po akcepcie. |
| S3 | Każda akcja `mutates: true` ma **Cofnij** (`UndoDescriptor` w rejestrze akcji). | `grep -rn "UndoDescriptor" src \| head` |
| S4 | Odrzucenie propozycji = **zero zmian w danych** (nie „zapisz i cofnij"). | test mutacyjny: usuń warunek akceptu w handlerze → test odrzucenia musi paść. |

## 6. Uprawnienia i granice organizacji

| # | Zasada | Jak sprawdzić |
|---|---|---|
| U1 | **Teresa nie widzi więcej niż użytkownik** — ten sam wyznacznik dostępu, nie osobna ścieżka „AI ma wszystko". | `grep -c "resolveEffectiveAccess" server/src/services/v8/teresaCopilotService.ts` = 8 (pomiar 05.09). **Uwaga:** w `server/src/routes/v8/teresa.routes.ts` = 0 — kontrola żyje wyłącznie w serwisie, więc każda nowa trasa Teresy z pominięciem serwisu obchodzi U1. |
| U2 | **Cross-org zakazane bezwarunkowo**: każde zapytanie kontekstu ma `organizationId` i nie ma gałęzi bez niego. | `grep -c "organizationId" server/src/services/aiContextBuilder.ts` > 0 **i** brak zapytania bez filtra: `grep -nE "FROM [a-z_]+ WHERE" server/src/services/aiContextBuilder.ts \| grep -v organization` |
| U3 | Dowód izolacji = **para** „obcy nie widzi" + „właściciel widzi realny wiersz". Sama pusta lista nie jest dowodem. | test PG na realnej bazie, dwa konta, dwie organizacje; `data: []` bez pary = brak pomiaru. |
| U4 | Produkcja `consultify.ai` ma **oddzielną bazę z danymi klientów** i nie jest polem eksperymentu AI. | `docs/program/` — granica ochrony danych; zmiany AI odbierane na stagingu/demo. |

## 7. Koszt, limity, dostępność

| # | Zasada | Jak sprawdzić |
|---|---|---|
| K1 | Ruch AI przechodzi przez **limiter** (`aiRateLimiter`, 30/min w produkcji) i **budżet organizacji**. | `grep -n "aiRateLimiter = createLimiter" -A 8 server/src/middleware/rateLimiting.middleware.ts`; `server/src/services/aiBudgetService.ts`. |
| K2 | Przekroczenie limitu/budżetu daje **czytelny komunikat po polsku**, nie ciszę i nie pustą odpowiedź. | `src/components/AIChat/AiProviderErrorNotice.tsx`, `src/components/ResultsVNext/teresa/TeresaUnavailableBanner.tsx`; zrzut przy wyczerpanym budżecie. |
| K3 | Niedostępność modelu = **stan jawny** („Teresa niedostępna"), nigdy odpowiedź zmyślona z pamięci. | j.w. — `TeresaUnavailableBanner` renderowany w module Wyniki. |
| K4 | Limiter i budżet są **przełącznikiem operacyjnym, nie funkcją produktu** — wyłączenie ich na czas pomiaru wymaga wpisu w rejestrze i przywrócenia. | `grep -rn "DEMO_AI_CALLS_PER_DAY" .env.example`; stan na środowisku sprawdzać na żywo, nie z kodu. |

## 8. Język

| # | Zasada | Jak sprawdzić |
|---|---|---|
| J1 | **Polski jest domyślny** dla całego UI Teresy i dla treści generowanych; angielski tylko na jawne żądanie użytkownika. | `grep -n "String(options?.language \|\| 'pl')" server/src/services/initiativeGenerationService.ts` |
| J2 | Klucz i18n istnieje ≠ przetłumaczony — kontrola sprawdza **treść**, nie obecność klucza. | `node scripts/…/stop-lista-en.mjs` albo zrzut ekranu z rozwiniętymi wszystkimi sekcjami; zwinięta sekcja nie jest dowodem. |

## 9. Tryb pracy „coś jest źle → ktoś działa"

| # | Zasada | Jak sprawdzić |
|---|---|---|
| D1 | Łańcuch jest jeden dla całej aplikacji: **wyzwalacz → sygnał kolorem → zgłoszenie do osoby odpowiedzialnej → karta działania → zamknięcie**. | `SSOT_WYNIKI_KPI_OKR_ROI.md` §5. |
| D2 | **Karta działania jest komponentem wspólnym** (pola: problem, główna przyczyna, działania, odpowiedzialny, termin, komentarz, status OTWARTY/ZAMKNIĘTY) — Wyniki, Realizacja, Audyty, Finanse, Wywiad używają tej samej. | decyzja CTO, `AUDYT_FORMULY_PRACY_20260905.md` luka nr 2; po budowie: jeden komponent, `grep -rl` na jego nazwie w 5 modułach. |
| D3 | Rola Teresy w tym łańcuchu: **proponuje treść karty** (opis problemu, hipoteza przyczyny, projekt działań) — nie wyznacza odpowiedzialnego, nie ustala terminu, nie zamyka karty. | założenie CTO 05.09; sprawdzenie: pola „odpowiedzialny" i „termin" nieedytowalne przez ścieżkę AI. |
| D4 | W normie **nic się nie dzieje** — brak zgłoszenia jest wynikiem, nie awarią. | `SSOT_WYNIKI_KPI_OKR_ROI.md` §5, zdanie ostatnie. |

## 10. Granice twarde (lista zamknięta)

1. Nie fabrykuje danych — brak danych to „—" i zdanie o braku (Z3).
2. Nie tworzy pomiarów (R2) i nie zatwierdza za człowieka (R3).
3. Nie podejmuje decyzji finansowych ani kadrowych — proponuje, człowiek rozstrzyga.
4. Nie wysyła niczego na zewnątrz (mail, publikacja, udostępnienie) bez kliknięcia człowieka.
5. Nie zmienia uprawnień, ról ani ustawień bezpieczeństwa.
6. Nie przekracza granicy organizacji (U2) ani uprawnień użytkownika (U1).
7. Nie działa autonomicznie w tle — **Agent (0/15 etapów z wykonawcą, worker wyłączony) jest poza MVP** decyzją właściciela 05.09.

**Jak sprawdzić punkt 7:** `docs/program/MVP_BACKLOG_20260905.md` §H; `grep -rn "ENABLE_AI_TASKS_WORKER" server/src/workers` — worker istnieje, ale wejście „Uruchom agenta" usunięte z Menu 2, trasa `/my-work/agent*` przekierowuje.

## 11. Sprzeczności rozstrzygnięte

| # | Sprzeczność w źródłach | Decyzja CTO | Uzasadnienie (jedno zdanie) |
|---|---|---|---|
| **C0** | **Największa.** Decyzja właściciela 01.09 + 05.09 11:46 (opcja A): „jedna Teresa, panele narzędzi mają **tylko przycisk** do niej" ⟷ `SSOT_WYNIKI_KPI_OKR_ROI.md` §6 i paczka `P1_JEDEN_PANEL_ZWIJANY.md`: „prawy panel z Teresą jako **zakładką** / zakładki Element·Teresa" ⟷ 05.09 ~13:00 właściciel odrzuca `document-studio-ai-teresa` słowami „tu nie ma po co dodawać kolejnego okna" (czyli chce Teresy **w** panelu). | **Rozstrzygnięcie: zakładka „Teresa" w prawym panelu jest dozwolona, ale jest WEJŚCIEM do tej samej, jednej rozmowy — nigdy drugim, niezależnym czatem.** Document Studio (P5) prowadzi tę rozmowę na miejscu, bez otwierania okna. | Właściciel nie sprzeciwiał się zakładce, tylko **drugiej Teresie** („przecież teresa ma okno swoje") — jedna rozmowa z dwoma wejściami spełnia obie jego wypowiedzi naraz, a dwie niezależne rozmowy nie spełniają żadnej. |
| C1 | `AI_CHAT_SYSTEM_DESIGN.md` §1.2 STAGE 3 „AUTONOMY — tworzy i **wykonuje** działania" ⟷ `teresaCopilotService.ts` „Teresa is NOT an autonomous engine" ⟷ decyzja właściciela 05.09 „Agent poza MVP". | **Kod i decyzja właściciela wygrywają**: na MVP nie ma autonomii; STAGE 3 zostaje wizją post-MVP. | Dokument projektowy z 2026-01 opisuje kierunek, a nie stan, i został wyprzedzony decyzją właściciela z 05.09. |
| C2 | Reguła z 01.09 „jedna Teresa jako zakładka" ⟷ słowa właściciela 05.09 o Document Studio („tu nie ma po co dodawać kolejnego okna"). | **Reguła stoi, Document Studio jest jedynym jawnym wyjątkiem** (P5) i musi być wypisane w kontraktach. | Właściciel nie uchylił reguły, tylko wskazał ekran, na którym rozmowa JEST pracą — wyjątek nazwany jest tańszy niż reguła z dziurą. |
| C3 | `docs/strategy/TABELE_V8_AI_GOVERNANCE.md` §1 „zero silent automation" ⟷ `09_AI_I_TERESA.md` §4 „Zakaz auto-apply — **dziś łamany**". | **Zakaz obowiązuje**; każde dzisiejsze auto-apply to defekt do naprawy z terminem, nie stan dozwolony. | Standard opisuje stan docelowy, audyt opisuje stan bieżący — z rozbieżności powstaje zadanie, nie zwolnienie z zasady. |
| C4 | Nazwa asystenta: „Consultinity AI" (`AI_CHAT_SYSTEM_DESIGN.md`), „Anna" (`AnnaAssistantWidget`), „Teresa" (kontrakt redakcyjny, kod v8/v10). | **Teresa w aplikacji, Anna wyłącznie na stronach publicznych przed zalogowaniem, „Consultinity AI" wycofane z UI.** | Dwie nazwy w jednym produkcie myliłyby użytkownika; podział „przed / po zalogowaniu" jest jedyny obronny. |
| C5 | `09_AI_I_TERESA.md` §3 wymaga **jednego** widgetu podglądu propozycji ⟷ w kodzie są 2–3 kopie (Mind Map, Whiteboard, Process Flow `AIProposalPanel`). | **Konsolidacja do jednego `IdeaProposalReview`** jest wymogiem, nie usprawnieniem. | Trzy kopie oznaczają trzy różne zachowania akceptu i trzy różne ślady — to wprost łamie §5 (ślad). |
| C6 | Zakaz auto-apply (§3, C3) ⟷ `src/utils/canvas/canvasMutationRisk.ts:86` — `const canAutoApply = actor === 'teresa' && risk === 'low'` przyznaje Teresie ciche zapisy niskiego ryzyka. | **Zakaz stoi; plik ma zero konsumentów** (`grep -rln "canvasMutationRisk" src server/src tests` → 1 plik, on sam) i albo znika, albo dostaje jawny akcept przed użyciem. | Reguła obowiązująca w kodzie martwym nie jest wyjątkiem od zasady, tylko miną — pierwszy konsument wprowadziłby cichy zapis bez śladu i bez decyzji. |
| C7 | Kanon mówi „jedno wspólne wejście do Teresy z panelu" ⟷ pomiar: `TeresaEntryButton` żyje w **2 modułach**, wspólny mechanizm wstrzykiwania (`ArtifactRightRail`) jest **wyłączony i porzucony** (`artifactRightRailFlag.ts:57`, komentarz „nowe powierzchnie NIE powinny go włączać"), a kanoniczny slot Menu 3 `AIActionSlot` ma **0 użyć**. | **Kanon obowiązuje, mechanizm wymaga następcy**: wejście do Teresy wchodzi do `ArtifactRightPanel` jako element sekcji „Akcje", a `AIActionSlot`/`AIConsultantPanel` albo dostają konsumenta, albo znikają. | Kanon bez działającego nośnika produkuje N implementacji per moduł — dokładnie to, czego decyzja z 01.09 miała zakazać. |

## 12. Kryteria odbioru tej strony

- [ ] Każdy moduł z `KONTRAKTY_NARZEDZI_AI.md` daje się odczytać przez pryzmat §3 (klasa akcji) bez dopisywania nowej klasy.
- [ ] Żaden ekran nie ma drugiego okna Teresy poza wyjątkiem P5.
- [ ] Każda akcja AI zmieniająca dane ma podgląd, akcept, wpis w Historii i Cofnij.
- [ ] Pomiar z `KONTRAKTY_NARZEDZI_AI.md` §Sumy nie zawiera wiersza „w kontrakcie, a nie działa" bez pozycji w paczce `P8_TERESA_KONTRAKTY.md`.

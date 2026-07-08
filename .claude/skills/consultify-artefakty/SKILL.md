---
name: consultify-artefakty
description: Kanon UI artefaktów Consultify (SPEC-A). Wywołaj ZAWSZE gdy tworzysz lub zmieniasz jakikolwiek EKRAN-ARTEFAKT (obiekt pracy otwierany z tożsamością/linkiem, nie lista): Initiative/Task/Decision/KPI/Insight/RAID (Rekord), Document/Wordy/Report/Notatka/Assessment Report/Audit Report (Dokument), Mind Map/Process Flow/Whiteboard/Discovery Tool/Studio (Canvas), Assessment Session/Table/Idea Table/Megatrend (Matryca), Presentation/Deck (Deck). Także przy audycie/odbiorze takiego ekranu, przy pracy nad powłoką artefaktu (NModeShell/IdeaMapWorkspace/ExecutiveModuleShell/ArtifactRightPanel) lub prawym panelem/Menu1 artefaktu. NIE dla list — do list użyj consultify-triada.
---

# Consultify — Artefakt (powłoka wspólna + 5 archetypów)

## Zasada nadrzędna (dlaczego to działa, a prompty nie)
Standard jest KODEM, nie prozą. **Napisz powłokę raz — dostajesz ją za darmo w każdym artefakcie; archetyp zmienia TYLKO centrum.** Lista i Artefakt to TA SAMA powłoka, różni je wyłącznie centrum (§10). Moduł DEKLARUJE treść, komponent NARZUCA wygląd — nie buduj własnego Menu1/prawego-panelu/kebaba per ekran.

**Powłoka wspólna** = Menu 1 tożsamości + Menu 3 nawigacja wewn. + **prawy panel accordion** (`ArtifactRightPanel`: Akcje·Właściwości·Powiązania·Komentarze·Historia/AI) + kebab + stany. To dla ARTEFAKTU tym, czym StandardTable/StandardPreview dla LISTY.

## Decyzja architektoniczna (Piotr 2026-07-05): WYRÓWNAĆ, nie scalać
W kodzie są 3 dojrzałe powłoki — NIE scalamy ich w jedną, doprowadzamy do jednego KONTRAKTU (wspólny ArtifactRightPanel + tokeny + kolejność sekcji + zero crimson):
- **NModeShell** (`src/components/shared/NModeLayout/`) — archetyp C Rekord (Task/Decision). Docelowy wzorzec.
- **IdeaMapWorkspace** (`src/components/MyWork/IdeaMapWorkspace.tsx`) — archetyp A Canvas (~100%, referencja).
- **ExecutiveModuleShell** — archetypy B/D/E (Document/Tabele/Deck).

## Zanim zmienisz cokolwiek
1. Przeczytaj `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`: §10.2 + §11.2 (SPEC-A powłoka build-ready) · §13 (instancjacja per archetyp — Menu1 primary, zakładki, sekcje panelu) · §18.1 (DoD Artefaktu — 8 MUST) · §5 (menu per archetyp) · §12 (otwieranie: klasa L=pełna strona, S=drawer).
2. Ustal archetyp (A/B/C/D/E) + klasę (S drawer / L pełna) danego artefaktu — patrz mapa §4B. To wszystko czego trzeba, by wiedzieć jak wygląda.
3. Wzorzec jakości = **Task na NModeShell** (docelowo) + `ArtifactRightPanel` (`src/components/standard/ArtifactRightPanel.tsx`). Reużywaj prymitywów `src/components/shared/PreviewPane/*` do treści sekcji.
4. Reguła centrum: archetyp zmienia TYLKO centrum + Menu 2 + lewy rail. Menu1/panel/kebab/stany = identyczne.

## Twarde zakazy (primary = crimson #85182F — KAŻDY numer!)
- **`primary-*` w KAŻDYM wariancie (50–950, dowolna opacity)** = odcień crimson. Zero `bg/text/border-primary-*` na: fokus, status, badge domyślny, selection, akcent AI/info, dane. (Nauczka crimson-leak: `text-primary-400/50` w PreviewPane dawał czerwony poblask u wszystkich adopterów.) Akcent AI/info = `c-info` (`text-c-info`, `border-c-info/NN` zwykłą notacją; tło przez `bg-[color-mix(in_srgb,var(--c-info)_NN%,transparent)]`).
- `focus:ring-primary` → fokus zawsze niebieski `c-focus`.
- `navy-*` / `slate-*` / surowy hex `#RRGGBB` → tylko tokeny `c-*` (c-text/-muted/-secondary, c-surface/-raised, c-border/-subtle, c-bg). Jedyny dozwolony crimson = brand CTA świadomie wybrany (nie jako dana/stan).
- Kolorowe czcionki jako dane → cały tekst wyłącznie `c-text`/`-secondary`/`-muted`. Serie/kategorie danych = `c-tag-*` (nie crimson).

## Powłoka — czego pilnować
- **Menu 1 `⑫`:** back/breadcrumb · ikona-typ · tytuł inline · status lifecycle · wskaźnik zapisu (OSOBNO od lifecycle) · [indeks] · JEDEN primary (przejście stanu/udostępnij/generuj).
- **Prawy panel** = `ArtifactRightPanel` accordion, sekcje w STAŁEJ kolejności: Akcje · Właściwości · Powiązania · Komentarze · Historia/AI. Powiązania klikalne first-class. Slot AI (`sparkles`) w stałym miejscu.
- **Otwieranie:** klasa L = pełna strona; klasa S = drawer nad kontekstem; quick-create = modal. Guard niezapisanych zmian (§12.4).
- **Centrum per archetyp:** A canvas+rail-narzędzi · B rich-text+Menu2-formatowanie · C sekcje-pól · D grid+toolbar · E slajdy+nawigator.

## Wzorzec N (rekordy-karty) — keystone `NModeCardState` (od 2026-07-07)
Przeramowanie Piotra: są DWA wzorce — **N (karty, AI pisze treść)**: Insight·Initiative·Task·Decision (+dziedziczące KPI/RAID/Milestone/Change Request/Stage Gate) — i **W (workspace, 8 narzędzi roboczych)**. SSOT wzorca N: `Harvard/wdrozenie-100/_WZORZEC_N_KARTY_DOKUMENTACJA_2026-07-07.md` (§13=stan-po-fali) · treść promptów: `_ARTEFAKTY_TRESC_KART_BCG_2026-07-06.md` · **DoD twardy: `_DOD_ARTEFAKTY_N_CHECKLIST_2026-07-07.md`**.

**Afordancję AI-draft NIE buduj od zera — użyj `src/components/shared/NModeLayout/NModeCardState.tsx`:**
- `NModeCardState({ state, sectionName, aiGenerated?, onRegenerate?, onEdit?, onAccept?, onGenerate?, onRetry?, confirmOverwrite?, isPolish?, hideActions?, children })` — nagłówek karty + badge + pasek `✨Regeneruj·✎Edytuj·✓Zaakceptuj` + stany empty/generating/error.
- `NModeCardBadge({ status, isPolish? })` — sam badge (dla sekcji z bespoke nagłówkiem, np. Insight). **UWAGA: prop `status`, NIE `state`** (rozjazd nazw — łatwa pomyłka).
- `NModeCardStatus = 'empty'|'generating'|'ai-draft'|'edited'|'done'|'error'`. Badge AI-draft=`c-info`, done=`c-success`, error=`c-danger`, akcent AI/✨=`teal-*`, fokus=`c-focus`. Stan trzymasz per sekcja; regen na `edited` pyta o nadpisanie (`confirmOverwrite`).
- N = **jakość promptów** (nie narzędzi): doktryna BCG §0 w system-prompt; ⚠ prompty zmieniają output → **Piotr zatwierdza treść PRZED live** (persona.ts jest GLOBALNA — dotyka każdej odpowiedzi Teresy). Decision/Task nie mają tabel `*_section_types` — prompty jako stałe w serwisie.

## Lekcje fali N (twarde — nie powtarzaj)
- **`tsc` per-plik NIE łapie błędów runtime.** Fala N: agent wstawił `useCallback` z tablicą deps odwołującą się do `const`-ów zadeklarowanych NIŻEJ → temporal-dead-zone `ReferenceError` → cały viewer w error-boundary. Przeszło esbuild+tsc, wywaliło się w przeglądarce. **Zawsze OTWÓRZ artefakt w przeglądarce** — potwierdź brak „Coś poszło nie tak" + widoczny badge + brak `ReferenceError` w konsoli.
- **Pełny `tsc --noEmit` OOM-uje** na tym repo — typecheckuj tylko dotknięte pliki (`--skipLibCheck`), przy szumie importów waliduj esbuildem.
- **Gałąź TYLKO od czystego `origin/demo`** — NIGDY od `feat/tp-forms-polish`/`deliverables-w1` (zabetonowany re-skin nocy 3/4).
- **Hook `check-artefakt.sh` wymusza tokeny `c-*`** w NOWYM kodzie powłoki (blokuje slate/navy/crimson) — grandfathered pliki kitu mają dług, ale Twój nowy kod musi być na `c-*`.
- Kod bywa DALEJ niż dokumentacja — przed przebudową sprawdź CO JUŻ ISTNIEJE (fala N: Task/Decision już miały N-mode; „przebuduj modal" było nieaktualne).

## Odbiór — OBOWIĄZKOWY DoD §18.1 (8 czerwonych MUST)
Po każdej zmianie przejdź literalnie listę z `ARTIFACT_ANATOMY_STANDARD.md §18.1`:
Menu1 komplet · powłoka wg archetypu (tylko centrum różne) · prawy panel accordion w kolejności · powiązania klikalne first-class · slot AI stały · otwieranie wg §12.2 + guard · stany empty/loading/error uczciwe · light+dark tokeny c.* (zero navy/slate/hex) · **zero crimson na fokus/status/badge/selection**.
Weryfikacja WZROKIEM (zrzuty z przeglądarki: artefakt + otwarty prawy panel + kebab + stan dark I light), nie „esbuild przeszedł". NIE deployować bez akceptacji właściciela na zrzutach.

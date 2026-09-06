# POMIAR NIEZALEŻNY — gałąź `mvp/i18n-dlug-1` (drugi robotnik)

Katalog pomiaru: `/private/tmp/wt-i18n-dlug-1`, HEAD zmierzony: `675826addb`.
Wszystkie mutacje wykonane w trakcie pomiaru zostały cofnięte (`git checkout --`);
`git status --short` na końcu pokazuje wyłącznie ten raport.

## Tabela werdyktów 1–8

| # | Punkt | Werdykt | Liczby |
|---|-------|---------|--------|
| 1 | Baseline ratchetu 484→261, chat/aiChat/admin=0 | **PASS** | zmierzone samodzielnie: base (codex/m03-admin-20260824) = 484 wpisy, HEAD = 261 wpisów. Prefiksy w HEAD: `chat.`=0, `aiChat.`=0, `admin.`=0. Diff: 223 usunięte, 0 dodanych (zero regresji do baseline). |
| 2 | 78 wpisów białej listy | **PASS z 1 zastrzeżeniem** | 77/78 uzasadnione (marki/skróty branżowe/nazwy własne/jednostki/placeholdery/terminy identyczne po polsku). 1 FAIL: **„Partner Slack"** — patrz niżej. |
| 3 | Jakość tłumaczeń (40 losowych kluczy) | **PASS z zastrzeżeniami** | 23/40 realnie przetłumaczone (naturalna polszczyzna, kontekst zweryfikowany dla 10/40 przez odczyt komponentu). 17/40 pl==en — 16 uzasadnionych (marka/skrót/jednostka/placeholder), 1 ten sam FAIL „Partner Slack". Brak placeholderów {{}} w tej próbce (nie dotyczy). Zastrzeżenie terminologiczne: `myWork.dependencies.lag`="Zwłoka" vs `myWork.dependencies.lagLead`="Opóźnienie / Wyprzedzenie" — dwa różne polskie słowa na "Lag" w tej samej funkcji. |
| 4 | 119 kluczy Czatu (dyżur 374, lista R3) | **FAIL częściowy** | Lista R3 (`chat-r3-missing.tsv`) = 124 unikalne klucze, nie 119/141. Z tych 124: **119 zastosowanych** poprawnie w obu plikach (en=angielski, pl=polski, kierunek i placeholdery zweryfikowane na próbce 15 — wszystkie OK), **5 kluczy CAŁKOWICIE BRAKUJE** w en I pl mimo realnych wołaczy w kodzie: `research.searchingRound` (ResearchProgress.tsx:274), `research.round` (ResearchProgress.tsx:391), `aiChat.citationFragmentOpenLabel` (CitationList.tsx:314), `myWork.tasks.createdFromChatToast` (UnifiedChatPanel.tsx:2312), `aiChat.citationFragmentBadge` (CitationList.tsx:264). Te 5 pokażą angielski fallback tekstu w polskim UI. |
| 5 | Dowód mutacyjny ratchetu | **PASS + 1 ZNALEZISKO** | (a) cofnięcie `chat.actions.openPanel` pl→"Open in panel" bez whitelisty → test RED (`1 NOWYCH naruszeń: chat.actions.openPanel [identical]`); przywrócone → GREEN. (b) dodanie zwykłego słowa `'Model'` do `IDENTITY_WHITELIST` + ustawienie pl==en="Model" dla `admin.aiControlCenter.modelsProviders.columns.model` → test **GREEN** (2/2 pass) — **ZNALEZISKO, nie FAIL robotnika**: mechanizm białej listy nie ma żadnego automatycznego strażnika przeciw wpisaniu pospolitego słowa; polega wyłącznie na czujności recenzenta na zawsze. Oba stany cofnięte, zweryfikowane diff-em. |
| 6 | Komendy testowe | **PASS z zastrzeżeniem** | `npx vitest run tests/unit/i18n/i18nTrescPolska.test.ts` → 2/2 PASS. Cały `tests/unit/i18n` → 70 total, 68 PASS, **2 FAIL** w `idea-workspace-required-keys.test.ts` (5 brakujących kluczy `ideas.table.*`/`ideas.financial.*`) — **zweryfikowane jako PRE-EXISTING** na `codex/m03-admin-20260824` (te same 5 kluczy brakuje tam identycznie, plik testowy i komponenty niezmienione) — nie regresja tej gałęzi. `JSON.parse` obu słowników → OK. Duplikaty kluczy (własny skrypt Python z `object_pairs_hook`, nie skrypt robotnika) → **0 w obu plikach**. 8 plików testów z mockiem react-router (zmiana = wyłącznie dodanie `useLocation`, zero `.skip`/`.only`, zero rozluźnionych asercji — potwierdzone diff-em): **BASE (przed naprawą, wyekstrahowane z `codex/m03-admin-20260824`) = 0/44 PASS** (wszystkie padają na `useLocation is not a function`); **HEAD (po naprawie) = 29/44 PASS, 15 FAIL** — żadna z 15 nie wspomina `useLocation` (realna, spora poprawa 0→29, ale ZLECENIE żądało „PASS, zero skip" dla tych plików i tego nie osiągnięto ani nie zgłoszono). Dodatkowo zmierzono 90 innych plików z `vi.mock('react-router-dom'...)` bez literalnego tekstu `useLocation` (naiwna hipoteza „16"): **0 z 365 testów w tych 90 plikach faktycznie referuje błąd useLocation** — czyli dobór dokładnie tych 8 plików przez robotnika był trafny, nie zaniżony. |
| 7 | Zakres zmian | **PASS (po korekcie bazy porównania)** | `git diff codex/m03-admin-20260824..HEAD` pokazuje ~10 dodatkowych plików spoza zakresu (`docs/program/TRZY_POJEMNIKI...`, `plan-pojemniki/*`, `check-freeze.*`) — **ale to artefakt dryfu gałęzi**: `codex/m03-admin-20260824` przesunęła się do przodu (merge-base=`6367b952`, tip=`0b0af6befa`) po utworzeniu tego worktree, więc pokazuje różnice względem commitów, których ta gałąź nigdy nie dotknęła. Diff względem prawdziwego punktu rozwidlenia (`git diff 6367b952..HEAD`) jest czysty: wyłącznie `public/locales/*/translation.json`, `tests/unit/i18n/*`, 8 plików testów react-router, `evidence/i18n-dlug-1/*`, `scripts/i18n-sweep/_bare_missing.json`. Brak `server/`, brak migracji, brak modułów zamrożonych. |
| 8 | Zrzuty evidence | **PASS z zastrzeżeniem** | `02-admin-1440.png` i `03-settings-1440.png` obejrzane wizualnie — czyste, w pełni polskie ekrany, zero angielskich słów poza legalnymi (LOCAL=plakietka środowiska dev, DBR77=nazwa firmy, Model/Dane=whitelistowane). `bledyKonsoli: []` potwierdzone niezależnie w obu `.json`. Stop-lista P3 (`Approve|Cancel|Overview|Tasks|Definition|Economics|Team|History|Not assigned|No tasks|Start Date|End Date|Business Owner|Drop initiatives|New conversation|sources|Unknown|Initiatives|Organization|Audits|Product|Triage|Summarize|Build an initial`) sprawdzona programowo na polu `tekst` wszystkich 3(4) zrzutów → **0 trafień** wszędzie. **Zastrzeżenie**: `01-czat-1440-PRZED.png` i `01-czat-1440-PO.png` mają **identyczny tekst** (`tekst` w `.json` bajt w bajt ten sam) — ekran startowy Czatu nie renderuje żadnego z faktycznie poprawionych kluczy `chat.*`/`aiChat.*`, więc ta para dowodowa nie pokazuje realnej różnicy PRZED/PO dla wykonanej pracy (nie jest to dowód fałszu, ale jest to słaby/niewystarczający dowód wizualny na zmianę). |

## Whitelist — FAIL

| Wpis | Kategoria | Werdykt |
|------|-----------|---------|
| `Partner Slack` | rzekoma nazwa własna kanału | **FAIL** — w tym samym obiekcie (`partner.footer.community`) siostrzane klucze konsekwentnie tłumaczą "Partner": `playbook`="Podręcznik partnera", `forum`="Forum partnerów", ale `slack` zostaje w pełni nieprzetłumaczone "Partner Slack"="Partner Slack". Powinno być np. "Slack Partnera" (zachowując markę Slack, tłumacząc "Partner" jak w kluczach siostrzanych). Whitelistowanie tego wpisu jest obejściem niedokończonego tłumaczenia, nie uzasadnioną nazwą własną. |

Pozostałe 77/78 pozycji ocenione jako uzasadnione (marki: Outlook/WhatsApp/ClickUp/Trello/Sublime Text/Vim/VS Code/fonty; skróty branżowe: WACC/SLA/DPA/CEO-CFO-CMO-COO-CTO; terminy medyczne: Deuteranopia/Protanopia/Tritanopia; placeholdery URL/e-mail; tokeny liczba+jednostka; nazwy firm/osób w cytatach klienckich: Nordic Digital Solutions/TransformACE Consulting/Bartosz Sotomski; "Menu"/"Program"/"Push"/"Pop"/"Premium"/"Enterprise" — zweryfikowane w kontekście użycia w kodzie jako spójne z konwencją polskiej lokalizacji oprogramowania).

## Zastrzeżenia do tłumaczeń (klucze)

1. `myWork.dependencies.lag` = "Zwłoka" vs `myWork.dependencies.lagLead` = "Opóźnienie / Wyprzedzenie" — niespójna terminologia dla tego samego pojęcia "Lag" w jednej funkcji (Dependencies section).
2. `partner.footer.community.slack` = "Partner Slack" (patrz FAIL wyżej — pl==en, niespójne z sąsiednimi kluczami).
3. 5 brakujących kluczy z listy R3 dyżuru 374 (patrz punkt 4) — realny angielski fallback w polskim UI, niezgłoszony w evidence robotnika jako otwarty.

## Wynik mutacji

- **(a) Cofnięcie tłumaczenia bez whitelisty → RED.** Potwierdzone: `chat.actions.openPanel` pl tymczasowo ustawione na "Open in panel" (identyczne z en, bez dodania do baseline) → `npx vitest run tests/unit/i18n/i18nTrescPolska.test.ts` dał `1 NOWYCH naruszeń`. Przywrócone `git checkout --`, zweryfikowane diff-em.
- **(b) Dodanie zwykłego słowa do białej listy + pl==en → GREEN → ZNALEZISKO.** `'Model'` dopisane tymczasowo do `IDENTITY_WHITELIST` w `tests/unit/i18n/i18nTrescPolska.test.ts`, `admin.aiControlCenter.modelsProviders.columns.model` pl tymczasowo ustawione na "Model" (=en) → test **PASS 2/2**. To pokazuje, że mechanizm ratchetu **ufa bezwarunkowo** zawartości `IDENTITY_WHITELIST` — nie ma krzyżowej walidacji przeciw liście pospolitych słów (jak istniejący `ENGLISH_UI_WORDS_SET`, który NIE zawiera "Model"/"Status"/"Plan"/"Format"/"Link"/"Start"/"System"/"Total"/"Insights"/"Dashboard"). To dług architektoniczny testu, do rejestru — nie wina konkretnych 78 wpisów tego dyżuru (żaden z 78 nie jest tak trywialnym słowem jak "Model"/"Status" — jedyny słaby wpis to "Partner Slack" z innego powodu). Oba pliki (`translation.json` pl, `i18nTrescPolska.test.ts`) cofnięte, `git status --short` czysty po cofnięciu.

## Rekomendacja końcowa

**SCALIĆ PO POPRAWCE**, lista:

1. Dodać 5 brakujących kluczy z listy R3 dyżuru 374 do `en`+`pl` (`research.searchingRound`, `research.round`, `aiChat.citationFragmentOpenLabel`, `myWork.tasks.createdFromChatToast`, `aiChat.citationFragmentBadge`) — dziś pokazują angielski fallback w produkcji.
2. Naprawić lub jawnie uzasadnić `partner.footer.community.slack` ("Partner Slack") — dziś niespójne z siostrzanymi kluczami w tym samym obiekcie.
3. Doprowadzić 8 naprawionych plików testów react-router do faktycznego PASS (dziś 29/44, 15 FAIL na niezwiązanych z i18n usterkach ujawnionych po usunięciu awarii `useLocation`) — albo jawnie zgłosić w raporcie robotnika, że CEL „PASS, zero skip" z ZLECENIA nie został osiągnięty i dlaczego (te usterki są przedmiotem odrębnym, nie i18n).
4. Zapisać do rejestru długu ZNALEZISKO z mutacji (b): `IDENTITY_WHITELIST` w `i18nTrescPolska.test.ts` nie ma automatycznego strażnika przeciw dopisaniu pospolitego słowa — rozważyć rozszerzenie `ENGLISH_UI_WORDS_SET` lub dodanie kontrolki długości/słownikowej.

Żadne z powyższych nie jest krytyczne bezpieczeństwo/utrata danych — to kwestie kompletności i uczciwości raportu. Baseline ratchetu, jego dowód mutacyjny (a), duplikaty kluczy, JSON-parsowalność, zakres zmian (po korekcie bazy porównania) i zrzuty admin/settings są solidnie PASS.

## Uwagi metodyczne dla następnego pomiaru

- **Dryf gałęzi bazowej**: `codex/m03-admin-20260824` przesunęła się po utworzeniu tego worktree (merge-base `6367b952` ≠ tip `0b0af6befa`). Zawsze liczyć zakres względem `git merge-base HEAD <baza>`, nie bezpośrednio względem ruchomej referencji — inaczej `git diff` pokazuje fałszywe „dotknięcia" plików spoza zakresu.
- Baseline test JSON report (`--reporter=json`) nie zwraca `numPendingTests` osobno od `numTotalTests-numPassedTests-numFailedTests` w tej wersji vitest — liczby jawnie zweryfikowane przez odjęcie, zero rozbieżności znalezione.

SHA raportu: patrz commit poniżej (do uzupełnienia po `git commit`).

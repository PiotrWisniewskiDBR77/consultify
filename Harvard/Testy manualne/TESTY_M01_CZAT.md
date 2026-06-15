# TESTY — M01 Czat (kompozer AI Chat / Teresa)

> **Moduł:** M01 Czat (`/chat`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** trzy przyciski paska kompozera czatu — **+** (załączniki), **✎** (tryby AI / styl / projekt), **👥** (Co-Thinker / persony).
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować tworzenie i zmienianie konfiguracji rozmowy oraz całą obsługę załączników — z weryfikacją end-to-end (UI + stan + payload sieciowy).
> **Data:** 2026-06-14

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

Trzy przyciski po lewej stronie pola wpisywania to trzy osobne komponenty:

| Przycisk | Komponent | Plik | Stan, na który działa |
|---|---|---|---|
| **+** (Plus) | `AddFilesMenu` | `src/components/AIChat/AddFilesMenu.tsx` | załączniki, `localStorage` (recent), nawigacja |
| **✎** (ołówek) | `ToolsMenu` | `src/components/AIChat/ToolsMenu.tsx` | `aiConfig` (tryby AI, styl, TTS), `/api/ai-memory` |
| **👥** (ludzie) | `CoThinkerMenu` | `src/components/AIChat/CoThinkerMenu.tsx` | `aiConfig.coThinkerMode`, `aiConfig.marketResearch` |

**Kluczowa zasada weryfikacji E2E:** wszystkie wybory z menu ołówka i ludzi zapisują się do globalnego store (`useAppStore` → `aiConfig`) i są **wysyłane w payloadzie wiadomości**. W `UnifiedChatPanel.tsx` (linie ~4004-4011, ~3621-3628, ~4620-4627) do backendu lecą pola: `deepResearch`, `showReasoning`, `multiAgent` (pośrednio), `marketResearch`, `coThinkerMode`, `privateMode`, `responseStyle`. **Każdy test trybu MUSI być potwierdzony w zakładce Network** — sama zmiana wyglądu przycisku to nie dowód, że tryb działa.

**Setup środowiska testowego:**
1. Uruchom dev server (preview), zaloguj się jako użytkownik z aktywną organizacją (np. owner DBR77).
2. Wejdź na ekran Chat (Teresa).
3. Otwórz DevTools → Network (filtr na wywołania `/api/...chat`/stream) oraz Console (zero błędów to wymóg).
4. Miej pod ręką: plik testowy (PDF/DOCX/PNG), plik nieobsługiwany (np. `.exe`), działający URL publiczny, błędny URL (`example`), URL z innym protokołem (`ftp://...`).

---

## 1. Przycisk **+** (AddFilesMenu) — załączniki

### 1.1 Otwieranie / zamykanie
- Klik w **+** otwiera dropdown nad przyciskiem (`bottom-full`).
- Klik poza menu → zamyka (listener `mousedown`).
- Gdy `disabled=true` (np. w trakcie streamingu odpowiedzi) → przycisk wyszarzony, `cursor-not-allowed`, nie otwiera menu.
- **Asercja:** menu pojawia się z animacją, nie zasłania pola tekstowego, nie wychodzi poza ekran.

### 1.2 „Upload file"
- Klik → otwiera natywny dialog plików (ukryty `<input type=file multiple>`).
- `accept` = `SUPPORTED_CHAT_ATTACHMENT_ACCEPT` — sprawdź plik z `chatAttachmentSupport.ts`, które rozszerzenia są dozwolone.
- Po wyborze: toast „dodano plik/pliki" (1 vs wiele — różne komunikaty), menu się zamyka, plik trafia do composera (`onFileSelect`).
- **Recent natychmiast:** nazwa pliku pojawia się w submenu „Recent" od razu (jeszcze przed zakończeniem uploadu, bez `docId`).
- **Po zakończeniu uploadu:** ten sam wpis w „Recent" zostaje „uzupełniony" o `docId` (sprawdź w `localStorage` przez `chatRecentAttachments`).
- **Test wielu plików naraz** — wszystkie powinny się załączyć i pojawić w Recent.
- **Edge:** anulowanie dialogu (brak plików) → nic się nie dzieje, brak błędu.

### 1.3 „Add link" (pojawia się tylko gdy `onUrlAdd` jest przekazane)
- Klik → zamyka dropdown, otwiera modal „Add link".
- Pole URL z autofocus, podpowiedź o tylko http(s).
- **Walidacja (krytyczne, regresja feedback #acc27ab3):**
  - `example.com` → ma zadziałać (auto-dopisanie `https://`).
  - `www.example.com/path` → ma zadziałać.
  - `https://example.com` → bez zmian, działa.
  - `ftp://...`, `mailto:...`, `javascript:...` → odrzucone z toastem „Only http(s) links".
  - pusty / same spacje → przycisk „Add" disabled, Enter nic nie robi.
  - całkowity śmieć → toast „Invalid link".
- Enter w polu = klik „Add". Po sukcesie: toast „Link added", modal i menu zamknięte, link w załącznikach.
- „Cancel" / klik w tło → czyści pole i zamyka.

### 1.4 „Manage cloud sources" / providerzy chmury
- Domyślnie (`isCloudImplemented=false` lub brak połączonych providerów): pozycja **„Manage cloud sources"** → SPA-nawigacja do `/settings/integrations` (BEZ twardego reloadu — draft czatu i scroll muszą przetrwać).
- Gdy `isCloudImplemented=true` i są połączeni providerzy (`connectedProviders`): zamiast tego lista Google Drive / OneDrive / Dropbox z ikonami marek; klik → `onCloudFileSelect(provider,'','')`, menu zamknięte.
- Połączony provider ma zieloną ikonkę `ExternalLink` (widoczną stale); niepołączony — szara, pojawia się na hover.
- **Asercja nawigacji:** po kliknięciu „Manage cloud sources" URL = `/settings/integrations`, treść czatu nieutracona.

### 1.5 „Recent" (flyout)
- Najechanie na „Recent" → submenu wysuwa się **w prawo** (`left-full`).
- Opóźnienie zamknięcia 200 ms (najedź, zjedź na chwilę i wróć — nie powinno migać). Sprawdź brak wycieku timera przy odmontowaniu.
- **Pusty stan:** „No recent attachments".
- **Wpis z `docId`:** klik → `onRecentSelect({name, docId})`, toast „reattached", BEZ ponownego uploadu (wektory RAG już istnieją). Menu zamknięte.
- **Wpis bez `docId`** (legacy): wyszarzony/disabled; klik → otwiera dialog uploadu (re-upload). Tooltip mówi „re-upload to attach".
- **Kosz (Trash2):** widoczny na hover tylko dla wpisów z `docId`; klik → `Api.deleteKnowledgeDocument(docId)`, usunięcie z listy + `localStorage`, toast „Deleted: {name}". Błąd API → toast „Could not delete". `stopPropagation` — klik w kosz NIE reattachuje pliku.
- **Persistencja:** odśwież stronę → Recent dalej zawiera wpisy (z `localStorage`).

---

## 2. Przycisk **✎** (ToolsMenu) — AI Modes / styl / projekt

### 2.1 Trigger i licznik
- Ikona; gdy ≥1 tryb aktywny → przycisk w kolorze primary + **czerwony badge z liczbą** aktywnych trybów (`activeModeCount` liczy: deepResearch, showReasoning, textToSpeech, privateMode — **uwaga: multiAgent NIE jest liczony w badge**, zweryfikuj czy to celowe).
- Menu liczy dostępną wysokość nad triggerem i ustawia `maxHeight` (min 240px) — przy małym oknie ma się scrollować, nie wychodzić poza ekran.
- Outside-click zamyka.

### 2.2 Tryby AI (sekcja „AI MODES") — każdy to toggle
Dla **każdego** z 5 trybów przetestuj cykl: włącz → sprawdź → wyłącz.

| Pozycja w UI | id w kodzie | flaga `aiConfig` |
|---|---|---|
| Deep analysis | `deepResearch` | `deepResearch` |
| Show reasoning | `showReasoning` | `showReasoning` |
| Multi-agent analysis | `multiAgent` | `multiAgent` |
| Private mode | `privateMode` | `privateMode` |
| Read responses | `textToSpeech` | `textToSpeech` |

Dla każdego:
- Klik → checkmark + podświetlenie primary, toast „enabled" (dla TTS ikona 🔊, reszta ✓), `setAIConfig({[id]: true})`, wywołanie `onToolSelect('toggle:<id>')`.
- Ponowny klik → toast „disabled", checkmark znika.
- Badge na triggerze aktualizuje liczbę.
- **Persistencja:** zamknij i otwórz menu — stan trybu zachowany; sprawdź czy przeżywa reload (zależnie od tego, czy `aiConfig` jest persystowane — odnotuj zachowanie).

**Weryfikacja E2E (obowiązkowa):** włącz tryb, wyślij wiadomość, w Network sprawdź, że payload zawiera odpowiednią flagę = `true`:
- **Deep analysis** → `deepResearch:true`; obserwuj odpowiednie zachowanie deep-research (progres/dłuższa analiza, patrz `ResearchProgress`).
- **Show reasoning** → `showReasoning:true`; w odpowiedzi ma się pojawić sekcja rozumowania.
- **Multi-agent** → potwierdź jak flaga `multiAgent` jest konsumowana (czy leci w payloadzie / zmienia tryb).
- **Private mode** → `privateMode:true`; sprawdź `isPrivateMode` w `UnifiedChatPanel` (linia 1036), komponenty `PrivateModeDetails` / `TrustBadge` (są dla nich testy jednostkowe — uruchom je), oraz że rozmowa NIE jest zapisywana/inaczej traktowana zgodnie z założeniem private.
- **Read responses (TTS)** → synchronizuje `autoReadEnabled` (linie 803-961); po włączeniu odpowiedzi Teresy są automatycznie czytane głosem; pojawia się podsekcja „Voice settings".

### 2.3 Podsekcja TTS (widoczna tylko gdy „Read responses" włączone)
- „Voice settings" rozwija się/zwija (chevron rotuje).
- **Speed:** suwak 0.5–2.0 (krok 0.1), wartość zapisywana do `ttsRate`, label pokazuje aktualną wartość.
- **Voice:** dropdown z głosami filtrowanymi do `pl*`/`en*` + „Auto"; zmiana → `ttsVoice`, toast „Voice changed". (Jeśli przeglądarka nie ma głosów — lista pusta poza „Auto", odnotuj.)
- **Voice style** (Formal/Normal/Cheerful/Calm): ustawia `ttsRate`+`ttsPitch`, podświetla aktywny wg `ttsRate`.
- **Test voice:** odtwarza próbkę przez `speechSynthesis` z aktualnymi ustawieniami. Sprawdź realne odtworzenie dźwięku.

### 2.4 „Response style" → modal personalizacji
- Klik → zamyka menu, otwiera modal „Personalize AI responses".
- **8 stylów** w siatce 2-kol (`normal, concise, executive, analyst, formal, coach, professional, friendly`):
  - Klik stylu → `setAIConfig({responseStyle: id})`, checkmark na karcie, toast, `onToolSelect('style:<id>')`, oraz **wstawienie presetu** do pola Custom instructions (`presetKey`).
  - Aktywny styl jest podświetlony przy ponownym otwarciu.
- **Custom instructions:**
  - Ładowane z `GET /api/ai-memory` (klucz `custom_instructions`) przy pierwszym otwarciu menu lub modala.
  - Limit **1000 znaków** (twardy `slice`), licznik „n/1000".
  - „Save" → `PUT /api/ai-memory/custom_instructions` z `value/source/context`, toast „Instrukcje zapisane" (lub błąd), modal zamyka się po zapisie; przycisk pokazuje stan ładowania.
  - „Reset" → czyści textarea + ustawia `responseStyle:'normal'` (NIE zapisuje na serwerze — zweryfikuj, że reset bez Save nie kasuje danych na backendzie).
  - Zamknięcie: X, klik w tło.
- **E2E:** ustaw styl „analyst" + custom instructions, wyślij wiadomość → w payloadzie `responseStyle:'analyst'`; odpowiedź ma odzwierciedlać styl. Po reloadzie custom instructions powinny się wczytać z serwera.

### 2.5 „Add to project"
- **Bez aktywnej rozmowy** (`hasActiveConversation=false`): klik → toast błędu „Najpierw wyślij pierwszą wiadomość...", `onToolSelect('addToProject')` nadal wołane, menu zamknięte. Pozycja ma `aria-disabled`.
- **Z aktywną rozmową:** klik → `onToolSelect('addToProject')`, toast „Add to project" 📁, menu zamknięte. Sprawdź dalszy flow (otwarcie `MoveToProjectModal` / przypisanie) w `UnifiedChatPanel`.

---

## 3. Przycisk **👥** (CoThinkerMenu) — persony

### 3.1 Persony (6, wzajemnie wykluczające się)

| Pozycja UI | id | `coThinkerMode` | efekt dodatkowy |
|---|---|---|---|
| Consultant | `consultant` | `multi_consultant` | — |
| Idea Creator | `idea_creator` | `idea_maker` | — |
| Analyst | `analyst` | `competitive_analyst` | — |
| Auditor | `auditor` | `risk_challenger` | — |
| Editor | `editor` | `executive_editor` | — |
| Market Researcher | `market_researcher` | `market_researcher` | **`marketResearch:true` + `webSearch:true`** |

Dla każdej persony:
- Klik → `setAIConfig({coThinkerMode: <mode>, marketResearch:false})` (poza Market Researcher), checkmark + podświetlenie, menu zamknięte.
- **Trigger po wyborze:** przycisk zmienia się w pill z kolorem primary i etykietą aktywnej persony (`max-w-[140px]`, truncate).
- **Wzajemne wykluczanie:** wybór persony B gdy aktywna A → A znika, B aktywna (tylko jedna na raz).
- **Toggle off:** ponowny klik w aktywną personę → czyści (`coThinkerMode:null, marketResearch:false`), pill znika.
- **„Clear"** (na dole menu, widoczny tylko gdy coś aktywne) → czyści, menu zamknięte.
- **`CoThinkerActivePill`** (osobny komponent, `data-testid=cothinker-active-pill`): jeśli renderowany w layoucie, pokazuje „Co-Thinker Active: {persona}" z przyciskiem X.

### 3.2 Market Researcher — przypadek szczególny
- Klik → ustawia **trzy** flagi: `coThinkerMode:'market_researcher'`, `marketResearch:true`, `webSearch:true`.
- **E2E:** wyślij wiadomość wymagającą danych rynkowych → w payloadzie `coThinkerMode:'market_researcher'` + `marketResearch:true`; odpowiedź powinna być podparta wyszukiwaniem w sieci (sprawdź `SourcesStrip`/cytowania). Po przełączeniu na inną personę `marketResearch` ma wrócić do `false`.

### 3.3 E2E dla pozostałych person
- Dla każdej: ustaw personę, wyślij to samo neutralne pytanie, potwierdź w Network `coThinkerMode` = właściwa wartość, i zaobserwuj różnicę w charakterze odpowiedzi (audytor kwestionuje ryzyka, editor poprawia strukturę itd. — jakościowo, na poziomie „czy persona w ogóle wpływa na output").

---

## 4. Testy przekrojowe (cross-cutting)

1. **Kombinacje flag:** włącz jednocześnie Deep analysis + persona Analyst + styl Executive + Private mode → wyślij → potwierdź, że WSZYSTKIE flagi lecą razem w jednym payloadzie i się nie kasują nawzajem.
2. **Persistencja między rozmowami:** ustaw tryby → przełącz/utwórz nową rozmowę → sprawdź, czy stan trybów jest zachowany czy resetowany (odnotuj zachowanie; powinno być spójne).
3. **Disabled podczas streamingu:** w trakcie generowania odpowiedzi sprawdź, które przyciski są zablokowane (`disabled`), żeby nie zmieniać konfiguracji w locie.
4. **Z-index / nakładanie:** żadne z trzech menu nie może być zasłonięte przez sąsiednie ani wychodzić poza viewport (test na małym oknie i przy klawiaturze ekranowej).
5. **Outside-click izolacja:** otwarcie jednego menu i klik w trigger drugiego — pierwsze ma się zamknąć (sprawdź, czy nie zostają dwa otwarte naraz).
6. **i18n:** przełącz język PL/EN — wszystkie etykiety, opisy, toasty i tooltipy mają być przetłumaczone (każda pozycja używa `t(key, fallback)`; brak gołych fallbacków po przełączeniu na PL).
7. **Dark mode:** sprawdź czytelność wszystkich menu, modala stylu i flyoutu Recent w trybie ciemnym.
8. **A11y:** `role="menu"/"menuitem"`, `aria-label`, focus, obsługa klawiatury (Tab/Enter/Esc do zamknięcia modali).
9. **Console:** podczas całej sesji testowej zero błędów/warningów w konsoli.

---

## 5. Testy regresji / jednostkowe
- Uruchom istniejące testy: `src/components/AIChat/__tests__/TrustBadge.test.tsx`, `PrivateModeDetails.test.tsx`.
- Sprawdź `chatRecentAttachments.ts` (logika `push/read/remove` recent) i `chatAttachmentSupport.ts` (lista akceptowanych typów) — czy mają pokrycie testowe; jeśli nie, dopisz testy jednostkowe.

---

## 6. Format raportu (dla każdego punktu)
Dla każdego przycisku/pozycji podaj: **kroki → oczekiwane → faktyczne → status (PASS/FAIL) → dowód** (screenshot UI + zrzut payloadu z Network + ewentualny stan `localStorage`/`aiConfig`). Dla FAIL: `plik:linia`, opis przyczyny, propozycja fixu.

**Definition of Done:** wszystkie pozycje PASS, E2E flag potwierdzone w Network, zero błędów w konsoli, PL i EN, light i dark.

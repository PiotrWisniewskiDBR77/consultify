# MERYTORYKA — paczka akcept-ready (synteza 3 audytów, 2026-07-23)

> **Status: DOKUMENT DO DECYZJI. Zero zmian w kodzie live.** Synteza trzech audytów:
> `_MERYTORYKA_INSIGHT_2026-07-22.md` · `_MERYTORYKA_INTERVIEW_2026-07-22.md` ·
> `_MERYTORYKA_NOTIFICATION_2026-07-22.md`. Ten dokument nic nie dodaje merytorycznie ponad nie —
> tylko porządkuje pod jedną decyzję rano: **co i w jakiej kolejności wdrażamy**.

---

## 1. TL;DR

We wszystkich trzech artefaktach (Insight, Interview, Notification) wzorzec jest ten sam: **doktryna
BCG (Pyramid Principle, MECE, kwantyfikacja z jawnym założeniem, falsyfikowalność, uczciwa
niepewność) już istnieje i działa** w rdzeniowych miejscach (Insight: executive-summary/themes/
issues/opportunities/signals/evidence-map; Interview: rubryka oceny; Task/Decision — wzorzec
referencyjny dla całego programu). Problem nie jest brakiem doktryny — to **rozjazd między tym, co
system obiecuje (kontrakt/prompt), a tym, co faktycznie się generuje i renderuje**. Największe luki:
Insight ma 8 promptów BCG-grade piszących do pól, których nie ma w schemacie (kod-widmo); Interview
ma kartę „Podsumowanie" bez ŻADNEGO wywołania AI (czysta konkatenacja stringów); Notification ma
dobry prompt AI, ale tylko gdy user go kliknie — domyślny widok to szablony-frazesy bez liczb.

**Skok jakości jest udokumentowany na realnych przykładach przed/po** (§3) — to nie jest
hipotetyczna poprawa, w Insighcie treść PO to dosłownie to, co dzisiejszy prompt JUŻ każe modelowi
napisać, tylko dziś ląduje donikąd. **14 dźwigni** zidentyfikowanych łącznie, z czego **4 są
deterministyczne i bezkosztowe** (redakcja stałych/kontraktu, zero LLM, zero ryzyka) — można je
wdrożyć od razu po akcepcie kierunku, bez czekania na decyzję o promptach.

---

## 2. Tabela dźwigni (14, uszeregowane wg dźwignia/koszt)

| # | Karta | Dźwignia | Co robi | Koszt/ryzyko | Efekt na Merytorykę |
|---|---|---|---|---|---|
| 1 | Insight | **P4** — zawęź `buildInsightTypeGuidanceBlock()` z 13→6 typów | Usuwa z promptu instrukcje pisania treści, dla której nie ma pola w schemacie | **Deterministyczne.** 1 linijka, zero LLM-ryzyka, zero zmiany kontraktu zapisu | Kończy marnotrawstwo promptu, zapobiega ryzyku „rozmycia" 6 realnych pól |
| 2 | Notification | **B5** — przeredaguj stałe w `notificationContent.ts` | Zamienia frazesy-wypełniacze („cost of inaction is rising") na wzorce z liczbą, którą kod już liczy (`daysOverdue`, `usagePercent`) | **Deterministyczne.** Redakcja stringów, zero AI, zero architektury | Dotyka **domyślnego widoku bez klikania AI** — to co user widzi ZAWSZE |
| 3 | Interview | **D1** — kontrakt karty `prog: 'do-decyzji-piotra'` → `'doradczy'` | Deklaracja w `interviewCardContract.ts` dla 8 kart | **Deterministyczne.** Typ już wspiera wariant, brak konsumenta w runtime dziś | Uczciwość kontraktu — ale **nie zmienia realnego zachowania** (patrz §4, D2 to osobna dźwignia) |
| 4 | Insight | **§6 dedup** — scal `executive-memo`↔`executive-summary`, `recommendations`↔`artifact-actions` | Redakcja w `insightCardContract.ts`, katalog 32→30 kart | **Deterministyczne.** Zero zmiany silnika generacji | Porządkuje katalog, usuwa duplikaty-widma |
| 5 | Insight | **P3** — podnieś `insightMaterializationService` do parytetu z `BCG_P10_PROMPT_DOCTRINE` | Zamiana jednozdaniowego system promptu na wspólną stałą (import + konkatenacja) | **Prompt LLM, tani.** Jeden import, zero nowej logiki | Insight z Tools/Assessment dziś gorszy niż Insight z wywiadu (ten sam UI, różna jakość — niewidoczne dla klienta) |
| 6 | Notification | **B1+B2** — nowy `NOTIFICATION_DOCTRINE_SYSTEM_PROMPT` + doprecyzowanie per-pole | 10 twardych reguł BCG (kwantyfikacja+założenie, MECE, falsyfikowalność, łańcuch wpływu do inicjatywy/decyzji) | **Prompt LLM, średni.** Zmienia output ścieżki „Analyze with AI" | Największy pojedynczy skok jakości ścieżki AI Notification (patrz przykład §3.3) |
| 7 | Interview | **C1** — `aiSuggestQuestion` + doktryna BCG + fix języka | Dodaje kwantyfikację-z-założeniem, anty-halucynację, **naprawia realny bug** (brak `{{language}}` — draft może wyjść po angielsku w PL sesji) | **Prompt LLM + drobny bugfix.** | AI piszące realną treść odpowiedzi respondenta — dziś najsłabszy ogniwo w tej ścieżce |
| 8 | Interview | **C2** — `aiParseSessionAnswers` + doktryna | Zachowanie precyzji liczb/dat z transkryptu, stan „częściowo — do potwierdzenia" zamiast cichego gubienia | **Prompt LLM, tani.** Ekstrakcja, nie generacja — niższe ryzyko halucynacji | Materiał wejściowy do rubryki z trybu czatowego bywa dziś gorzej wydestylowany |
| 9 | Insight | **P1** — „Consulting Readout" jako realne pole `consulting_readout: string` | Drugi call LLM po V6, syntetyzujący z już wygenerowanych themes/issues/opportunities/signals (tańsze niż surowy re-read materiału) | **Prompt LLM + 1 kolumna DB + 1 dodatkowy call.** Walidator (`readoutHasSections`) JUŻ ISTNIEJE i czeka | **Największa pojedyncza dźwignia jakości w całym pakiecie** — najważniejsza karta narracyjna dziś to bucket-dump bez syntezy (patrz §3.1) |
| 10 | Notification | **B3** — bramka jakości w `cardContentValidator.ts` | 3 nowe klucze advisory (`minWords`, `listFields`) dla pól Notification, logowanie `qualityFlags` (nigdy nie blokuje) | **Tanie, czysto obronne.** Nie zmienia promptu, tylko wykrywa regresję | Bez tego regresja (np. model zaczyna zwracać checklisty 1-elementowe) jest niewidoczna bez ręcznego przeglądu |
| 11 | Interview | **D2** — backend hard-gate `submitAssignment` 422 → ostrzeżenie niewiążące | AI hard-floor przestaje blokować submit; required-missing (puste pola) NADAL blokuje (inna kategoria) | **Mechanika backendu, nie tylko prompt.** Realna zmiana zachowania dla respondentów — osobny ticket wg CLAUDE.md „mechanika najpierw" | To jest MIEJSCE, które faktycznie dziś blokuje ludzi — bez tej zmiany D1 (kontrakt) jest kosmetyką bez efektu |
| 12 | Interview | **C3** — `generateSummary` dostaje `executiveSummary` z LLM | NOWE wywołanie AI tam, gdzie dziś jest zero (dziś: czysta konkatenacja `pytanie: odpowiedź`) | **Prompt LLM + nowa mechanika (pierwsze wywołanie AI w tym miejscu).** Największa zmiana w Interview | Najbardziej widoczny artefakt dla managera — dziś zerowa synteza (patrz §3.2) |
| 13 | Insight | **P2** — `key-findings`/`recommendations`/`tensions`/... jako realne derywacje backendowe z wymogiem cytatu/mierzalności | 7 potencjalnych nowych pól/wywołań LLM, część treści (Power Dynamics, Tensions) jest RZADKA w realnym materiale — decyzja o zakresie | **Największy koszt w pakiecie.** Rób PO P1/§6 dedup, żeby nie inwestować w karty czekające na dedup | Domyka pozostałe martwe walidatory z §2 audytu Insight — ale niższy priorytet niż P1 |
| 14 | Notification | **B4** — przenieś generację z `/ai/chat` (front) do `notificationContentGenerationService.ts` (server, wzorem Task/Decision) | Kontrolowany `temperature`/`maxTokens`/cache, ekstrakcja JSON z fence zamiast regex, dopięcie walidatora | **Architektoniczne, osobna decyzja.** Nowy endpoint + zmiana wywołania z frontu | Nie blokuje 1–3 (B1/B2/B3), rób jako osobny krok po akcepcie kierunku |

---

## 3. Przykłady treści PRZED/PO (3 najmocniejsze z audytów)

### 3.1 Insight → „Consulting Readout" (dziś: BRAK treści, nie „słaba treść")

To najbardziej dotkliwy przypadek w całym pakiecie: prompt BCG-grade już istnieje i instruuje model
dokładnie tak jak w kolumnie PO — po prostu nie ma pola, do którego miałby to zapisać, więc UI
sklejamy z surowych list.

| | Treść |
|---|---|
| **PRZED** (realne zachowanie `InsightViewer.tsx:3582`) | „**Oficjalne odpowiedzi:** »Harmonogram tworzy planista lokalnie« · »SAP dostaje dane po fakcie«" *(kopie zdań z `themes[].description`)* — trzy kolumny list, **zero zdania łączącego, zero „dlaczego", zero sekwencji rekomendacji.** |
| **PO** (P1 wdrożone, ten sam materiał źródłowy) | „**Obserwacja.** Nordwind ma dojrzały stack (SAP, MES w 2/3 zakładów), a mimo to OTIF waha się 78–91% — problem nie jest technologiczny. **Mechanizm.** Warstwa decyzyjna żyje poza systemem: reguły priorytetyzacji w głowach planistów. **Dowody.** 7/7 respondentów niezależnie opisało prywatne arkusze. **Wpływ.** Lead-time 34 dni, ~5–8% utraconej sprzedaży na terminach. **Rozjazdy.** IT: brak dyscypliny; operacje: brak reguł w systemie. **Rekomendacja.** Najpierw reguły w SAP, potem triage S/M/L, dopiero potem zakupy IT." |

### 3.2 Interview → „Podsumowanie sesji" (dziś: zero AI, sklejanie stringów)

| | Treść |
|---|---|
| **PRZED** (realny output `generateSummary`, `InterviewController.ts:8242`) | `facts: ["Opisz proces planowania...: Robi to głównie Kasia, aktualizuje raz w tygodniu... (kolejne 24 wpisy w tym samym formacie pytanie:odpowiedź, bez syntezy)"], gaps: [...]` — **żadne wywołanie LLM nie następuje.** |
| **PO** (C3 wdrożone, Pyramid Principle) | „Planowanie produkcji opiera się dziś na jednej osobie i arkuszu Excel, bez systemu ani udokumentowanego procesu — to pojedynczy punkt awarii (key-person risk). Proces aktualizowany co tydzień, z ad-hoc korektami przy zmianach priorytetów (częstotliwość: do potwierdzenia). Trzy istotne luki: brak informacji o systemach IT, brak danych o liczbie SKU, brak wskazania zastępstwa dla właściciela procesu." |

### 3.3 Notification → `whyImportant` + `checklist` (dziś: konkretne, ale filler bez liczb)

| | Treść |
|---|---|
| **PRZED** (realistyczny dzisiejszy output) | *whyImportant:* „Brak danych o przestojach blokuje dalszą analizę i opóźnia całą inicjatywę. **Im dłużej to trwa, tym trudniej będzie dotrzymać terminu** *(filler — brak liczby)*." *checklist:* „1. Napisz do Anny 2. Sprawdź ERP 3. Zaktualizuj termin 4. Poinformuj sponsora" *(pkt 1/2 nakładają się — nie wiadomo co robić PO sprawdzeniu ERP)*. |
| **PO** (B1+B2 wdrożone) | *whyImportant:* „Opóźnienie blokuje start modelowania kosztów (krok 2/4), planowany na 22.07. Przy tempie 5 dni poślizgu, cały model opóźni się o **szacunkowo 15–20 dni** [założenie: liniowa ekstrapolacja], co przesuwa rekomendację **Decyzji #142** poza sesję Zarządu **05.08**." *checklist (MECE-rozgałęzienie):* „1. Ustal przyczynę — do 16:00 2. **Jeśli dane SĄ w ERP** → wyeksportuj do 21.07 3. **Jeśli dane NIE SĄ dostępne** → alternatywne źródło do 22.07 4. Zaktualizuj deadline 5. Jeśli przesuwa krok 2/4 → eskaluj (ryzyko dla Decyzji #142)." |

---

## 4. Rozjazdy kontrakt↔runtime do naprawy (kontrakt wygrywa — decyzja Piotra)

| Rozjazd | Kontrakt mówi | Runtime robi | Decyzja potrzebna |
|---|---|---|---|
| **Interview `generateSummary`** | `interviewCardContract.ts`: karta `interview-summary` ma `rolaAI: 'pisze'` z `aiPrompt.szablon` — obiecuje generację AI | `InterviewController.ts:8242` — **zero wywołania LLM**, czysta konkatenacja `pytanie: odpowiedź` | Albo dodać AI (dźwignia C3, §2#12) — kontrakt zaczyna mówić prawdę, albo zmienić kontrakt, by nie kłamał (nie polecane — to najbardziej widoczna karta dla managera) |
| **Interview hard-gate 422** | `interviewCardContract.ts`: `prog: { rodzaj: 'do-decyzji-piotra' }` — **martwy placeholder**, brak konsumenta w runtime (`grep ProgKompletnosci` = tylko plik typu) | `InterviewController.ts:4071-4120` `submitAssignment` — **realnie blokuje** respondenta kodem 422, gdy AI-werdykt = insufficient/empty | Decyzja Piotra „próg = porada" musi ruszyć **oba miejsca**: D1 (kontrakt, kosmetyka) I D2 (backend, realna zmiana zachowania) — samo D1 nic nie zmienia dla użytkownika |

*(Dodatkowo, szerzej w tle: Insight ma analogiczny wzorzec rozjazdu — 8 z 13 promptów ★ priorytetowych
piszą do pól, których żaden walidator nigdy nie widzi, bo pole nie istnieje w zapisie. To nie jest
pojedynczy rozjazd do decyzji, tylko strukturalny wzorzec zaadresowany dźwigniami P1/P2/P4 w §2.)*

---

## 5. Rekomendowana kolejność wdrożenia (po akcepcie)

**Krok 0 — deterministyczne, bez ryzyka, można od razu (nie zmieniają Teresy globalnie):**
P4 (Insight) → B5 (Notification) → D1 (Interview, kontrakt) → §6 dedup (Insight). Zero wywołań LLM,
zero zmiany zachowania modelu — czysta redakcja stringów/kontraktu.

**Krok 1 — prompty LLM tanie (zmieniają output, wymagają uwagi, ale niski koszt wdrożenia):**
P3 (Insight) → C1+C2 (Interview) → B1+B2+B3 (Notification, razem).

**Krok 2 — największa pojedyncza dźwignia jakości:**
P1 (Insight, Consulting Readout) — kod walidatora już czeka, głównie prompt + 1 call + 1 kolumna DB.

**Krok 3 — zmiany mechaniki (osobne tickety, „mechanika najpierw" wg CLAUDE.md):**
D2 (Interview, backend hard-gate → advisory) i C3 (Interview, `generateSummary` dostaje pierwsze
wywołanie AI) — to nie są tylko prompty, to zmiana zachowania backendu. Rób po Kroku 1-2, nie razem.

**Krok 4 — większy zakres/koszt, do decyzji Piotra o zakresie:**
P2 (Insight, 7 potencjalnych nowych pól) i B4 (Notification, architektura server-side) — ostatnie,
nie blokują nic wcześniejszego.

**Weryfikacja po każdym kroku (złota reguła CLAUDE.md):** wygenerować 1 realny artefakt na
demo/staging, zrobić zrzut PRZED/PO, sprawdzić że walidatory faktycznie PASS na żywych danych —
„testy przeszły" ≠ „działa".

---

## 6. ★ Nic nie jest wdrożone live

Wszystkie prompty w tym dokumencie i w trzech audytach źródłowych są **draftami do akceptu treści**,
nie kodem. Persona/doktryna, którą zmieniają, jest **globalna dla Teresy** — jedna zmiana promptu
wpływa na wszystkie przyszłe generacje danego typu treści, dla wszystkich klientów. Dlatego:

- Zero zmian w `server/src/services/*` ani w `*CardContract.ts` nastąpiło w ramach tych trzech audytów.
- Wdrożenie każdego kroku z §5 to **osobna partia pracy** po wyraźnym „tak" Piotra na tym dokumencie
  (lub na wybranych dźwigniach z §2, jeśli akceptacja jest częściowa/etapowa).
- Kroki deterministyczne (§5 Krok 0) można ewentualnie wdrożyć jako pierwszą, najniższego ryzyka
  partię — ale i one czekają na jawne potwierdzenie kierunku, nie tylko przeczytanie dokumentu.

---

*Źródła: `_MERYTORYKA_INSIGHT_2026-07-22.md` (32 karty, 5 luk F1-F5, 5 propozycji P1-P5) ·
`_MERYTORYKA_INTERVIEW_2026-07-22.md` (7 miejsc promptów, 9 luk L1-L9, propozycje C1-C3+D1-D2) ·
`_MERYTORYKA_NOTIFICATION_2026-07-22.md` (2 ścieżki treści, propozycje B1-B5).*

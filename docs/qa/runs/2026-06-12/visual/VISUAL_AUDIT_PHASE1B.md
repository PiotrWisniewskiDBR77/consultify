# Wizualny Audyt Consultify — Faza 1b: Component Sweep

**Data:** 2026-06-12  
**Środowisko:** staging (https://demo.consultify.ai)  
**Rola:** OWNER — DBR77  
**Viewport bazowy:** 1440×900 (ciemny motyw)  
**Uzupełnienia do Fazy 1:** Tak (1a–1e)  
**Screenshotów wykonanych w Fazie 1b:** ~35

---

## CZĘŚĆ 1 — Uzupełnienia z Fazy 1

### 1a — Sidebar — Stany i tryby

#### COMP-N01 — Sidebar — Stan domyślny (ikony tylko)

**Screenshot ID:** ss_1284rxbmk  
**URL:** https://demo.consultify.ai/chat  
**Element:** Sidebar w stanie domyślnym

**Wartości CSS (z DOM):**
- Szerokość sidebarze: ~40px (widoczne same ikony)
- Aktywna ikona: `background: rgba(255,255,255,0.08)` / `border-radius: 8px` / `padding: 7px 0px` / `width: 48px` / `height: 32px` / `color: rgb(241,245,249)` / `font-weight: 500`
- Nieaktywne ikony: `background: rgba(0,0,0,0)` / `color: rgb(203,213,225)` / `font-weight: 400`
- Ikona "Expand": `background: rgba(0,0,0,0)` / `color: rgb(100,116,139)` / `border-radius: 8px`

**Opis wizualny:**  
Sidebar zawiera ~14 ikon modułów (górna grupa) + 4 ikony administracyjne (dolna grupa, oddzielone spacją). Brak etykiet tekstowych. Aktywna pozycja (Chat) ma jasne tło-pill z białym/blado-niebieskim teksem. Nieaktywne ikony są szare. Na dole tekst "DEMO @1b0ead22ff1f" w mini-capsule.

**Ikony (biblioteka Lucide):**  
lucide-message-square-text (Chat), lucide-briefcase (My Work), lucide-clipboard-list (Interview), lucide-wrench (Tools), lucide-lightbulb (Initiatives), lucide-rocket (Execution), lucide-trending-up (Results), lucide-calculator (Finance), lucide-clipboard-check (Audits), lucide-folder-output (Documents), lucide-file-text (Document Studio), lucide-presentation (Presentation Studio), lucide-table (Table Studio), lucide-users (Meeting)

**Czy tooltips są zaimplementowane?** TAK — przy hover wyświetla się tekst etykiety modułu w prostokątnym tooltip po prawej stronie (np. "MY WORK").

---

#### COMP-N02 — Sidebar — Stan rozwinięty (ikony + etykiety)

**Screenshot ID:** ss_8491q31rr  
**URL:** https://demo.consultify.ai/chat (po kliknięciu ">|" toggle)  
**Element:** Sidebar w stanie rozszerzonym (~200px)

**Wartości CSS (z DOM):**
- Aktywna pozycja "Chat": `background: rgba(255,255,255,0.08)` / `color: rgb(241,245,249)` / `font-size: 14px` / `font-weight: 500` / `padding: 7px 10px` / `border-radius: 8px`
- Nieaktywna pozycja (np. My Work): `background: rgba(0,0,0,0)` / `color: rgb(203,213,225)` / `font-size: 14px` / `font-weight: 400` / `padding: 7px 10px`
- Badge "beta": `background: rgba(232,125,30,0.1)` / `color: rgb(234,155,32)` / `font-size: 10px` / `border-radius: 4px` / `padding: 1px 6px`

**Opis wizualny:**  
Rozwinięty sidebar pokazuje ikony + etykiety tekstowe + badge "beta" + kłódkę dla zablokowanych modułów. Moduły beta: Results, Finance, Audits, Documents, Document Studio, Presentation Studio, Table Studio, Meeting. Chat/My Work/Interview/Tools/Initiatives/Execution — bez beta. Dolna sekcja: Organization, Admin Panel, Settings, Partner Portal.

**Sidebar można:**  
1. Zwinąć do ikona-only (domyślny stan)
2. Rozwinąć do ikony+etykiety (>| toggle)  
3. Zwinąć do ukrytego (całkowita niewidoczność, następne kliknięcie >|)

**Trzy stany sidebarze potwierdzone.** Brak czerwonego indicator line przy aktywnej pozycji.

---

#### COMP-N03 — Sidebar — Hover state

**Screenshot ID:** ss_7241rnjeo  
**URL:** https://demo.consultify.ai/chat  
**Element:** Hover na nieaktywnej pozycji "My Work" (sidebar zwinięty)

**Opis wizualny:**  
Przy hover nad nieaktywną ikoną pojawia się tooltip z etykietą "MY WORK" po prawej stronie. Sam element ikony nie zmienia tła wizualnie (brak hover bg — tylko tooltip).

---

### 1b — Viewport 1280px

#### COMP-V01 — 1280px — Chat  
**Screenshot ID:** ss_9418gvw2e → chat wygląda identycznie jak 1440px. Brak overflow.

#### COMP-V02 — 1280px — Interview Inbox  
**Screenshot ID:** ss_9418gvw2e → tabela mieści się, kolumna DAYS TO DUE widoczna. OK.

#### COMP-V03 — 1280px — Document Studio  
**Screenshot ID:** ss_1656jkbcx → formularz mieści się w pełni. Brak overflow. Dwie kolumny (Document type / Language, Density / Goal) nadal dwukolumnowe. OK.

#### COMP-V04 — 1280px — My Work Inbox  
**Screenshot ID:** ss_99780365m → tabela mieści się. OK.

**Uwaga:** Nie testowano 1280px na Kanban Initiatives (znane problemy z VIS-028 Fazy 1).

---

### 1c — Document Studio — Flow generowania

#### COMP-D01 — Document Studio — Formularz (stan focus textarea)

**Screenshot ID:** ss_5627q1qk3  
**URL:** https://demo.consultify.ai/document-studio  

**Wartości CSS (focus state textarea):**
- `outline: rgb(200,50,74) solid 2px`
- `box-shadow: rgb(255,255,255) 0px 0px 0px 0px, rgba(168,45,73,0.2) 0px 0px 0px 2px`
- `background: rgb(15,23,42)` (ciemna navy)
- `border: 1px solid rgb(42,54,85)` (nie zmienia się przy focus)
- `border-radius: 8px`
- `font-size: 14px`
- `padding: 8px 12px`

**Opis wizualny:**  
Textarea z wpisanym tekstem "Digital transformation strategy" — focus ring w kolorze czerwono-różowym `rgb(200,50,74)`. Na screenshocie wygląda jak error state.

---

#### COMP-D02 — Document Studio — Plan outline

**Screenshot ID:** ss_84166173l  
**URL:** https://demo.consultify.ai/document-studio (po kliknięciu "Plan document")

**Opis wizualny:**  
Widok outline z 5 sekcjami (Executive Summary, Context, Findings, Recommendations, Next Steps). Każda sekcja jest kartą z tytułem i opisem oraz etykietą gęstości (SHORT/MEDIUM/LONG) po prawej. Przycisk "Generate document" w prawym dolnym rogu — czerwono-malinowe tło `rgb(168,45,73)`.

**Wartości CSS (Generate/Plan document button):**
- `background: rgb(168,45,73)`
- `color: rgb(255,255,255)`
- `border-radius: 8px`
- `font-size: 16px`
- `padding: 8px 16px`

---

#### COMP-D03 — Document Studio — Wygenerowany dokument

**Screenshot ID:** ss_6325v74gr  
**URL:** https://demo.consultify.ai/document-studio/artifact-d08980fa-...

**Opis wizualny:**  
Układ split: OUTLINE po lewej (~270px, lista sekcji z liczbą bloków) + DOCUMENT PREVIEW po prawej. Toolbar nawigacyjny w górze: History | QA (z zieloną kropką) | Override allowed (z żółtą kropką) | Share | AI Editor | **Export DOCX** (czerwony button). Po prawej "EN · internal / 0 sources · 6 assumptions".

**ASSUMPTION badges:**  
Tekst "ASSUMPTION — NEEDS SOURCE" pod każdą sekcją z placeholderowym contentem. Kolor: orange `rgb(232,125,30)` lub podobny — widoczny w zoomie jako pomarańczowy tekst.

**Export bar (górny):**  
- "Export DOCX": `background: rgb(168,45,73)` / `color: rgb(255,255,255)` / `border-radius: 8px` / `padding: 6px 12px`
- "Markdown", "DOCX", "PDF" (w preview area): `background: transparent` / `border: 1px solid rgb(42,54,85)` / `color: rgb(226,232,240)` / `border-radius: 8px`
- "Open in Sheets Builder": identyczne jak Markdown/DOCX/PDF
- "Start over": `background: transparent` / `color: rgb(148,163,184)` — ghost button

---

### 1d — Modal — Assign Interview

**Screenshot ID:** ss_5486h7ex8 (full) + zoom ss_5486h7ex8 (cropped)  
**URL:** https://demo.consultify.ai/interview (po kliknięciu "Assign")

**Wartości CSS (modal container):**
- `background: rgb(15,23,42)` (dark navy)
- `border-radius: 16px`
- `border: 1px solid rgb(42,54,85)`
- `box-shadow: rgba(0,0,0,0.25) 0px 25px 50px -12px`
- `width: 672px` / `height: 613px`

**Backdrop:**
- Klasa CSS: `fixed inset-0 z-50 flex items-center justify-center`
- `background: rgba(0,0,0,0)` — **BRAK backdrop dimming!** Aplikacja tła za modalem NIE jest przyciemniana.

**Opis wizualny:**  
Modal "Assign Interview" z nagłówkiem (ikona user+ w różowo-czerwonym kółku, tytuł, X button). Ciało: 2 custom dropdowns (Interview Template, Assign to) + row z date picker + priority dropdown + textarea. Footer: Cancel (ghost) + Assign (gradient button).

**Przyciski:**  
- "Assign" (primary): `background: linear-gradient(to right bottom, rgb(168,45,73), rgb(133,24,47))` / `color: rgb(255,255,255)` / `border-radius: 12px` / `font-size: 14px` / `padding: 10px 16px`
- "Cancel" (ghost): `background: transparent` / `color: rgb(148,163,184)` / `border-radius: 12px`

**Custom dropdown (modal):**  
- `background: rgba(255,255,255,0.04)` / `border: 1px solid rgba(255,255,255,0.08)` / `border-radius: 12px` / `font-size: 14px` / `height: 40px`

**PROBLEM:** Modal nie ma backdrop. Tło aplikacji jest widoczne przez cały czas — modal "wisi" na żywej aplikacji bez separacji wizualnej. Niespójne z VIS-007 (Crash modal który wyglądał jak ma backdrop).

---

### 1e — Toast notyfikacje

Toast nie pojawił się po kliknięciu "Save Changes" w Settings. Nie udało się wywołać observable toasta. Możliwe przyczyny:
- Profil nie zmieniono (żadna zmiana danych) więc backend nie zwraca 200
- Toast system może być niezaimplementowany w tej ścieżce

**Status:** Nie sfotografowano — niedostępne w teście.

---

## CZĘŚĆ 2 — Component Sweep

---

### 2.1 BTN — Przyciski

#### COMP-BTN-01 — Primary — Solidny czerwony (Export DOCX, Save Changes)

**Screenshot ID:** ss_6325v74gr (Export DOCX), ss_320771vyf (Save Changes)  
**URL:** Document Studio artifact / Settings Profile  

**Wartości CSS:**
- `background: rgb(168,45,73)` (`#a82d49`)
- `color: rgb(255,255,255)`
- `border-radius: 8px`
- `font-size: 14–16px` (różnie w zależności od kontekstu)
- `padding: 6–8px 12–16px`
- `font-weight: 400–500`

**Opis wizualny:** Ciemnoczerwony/malinowy button. "Save Changes" (Settings) = 16px, "Export DOCX" = 14px. Same kolor tła, różne rozmiary czcionki.

**Czy ten sam komponent wygląda inaczej w innym module?**  
TAK — `font-size` różni się: 14px vs 16px. `padding` różni się. `border-radius` ta sama (8px).

---

#### COMP-BTN-02 — Primary — Gradient (Assign modal button)

**Screenshot ID:** ss_5486h7ex8 (zoom)  
**URL:** https://demo.consultify.ai/interview (modal Assign)

**Wartości CSS:**
- `background: linear-gradient(to right bottom, rgb(168,45,73), rgb(133,24,47))`
- `color: rgb(255,255,255)`
- `border-radius: 12px`
- `font-size: 14px`
- `padding: 10px 16px`

**Opis wizualny:** Gradient od #a82d49 do #851830. Wygląda ciemniej niż zwykły solid #a82d49. Używa border-radius 12px (vs 8px w innych primary buttonach).

**Niespójność:** Border-radius 12px vs 8px. Gradient vs solid — ta sama semantyczna akcja "potwierdź" wygląda inaczej.

---

#### COMP-BTN-03 — Primary — "New X" buttons (różne kolory wg modułu)

**Screenshot ID:** ss_1825qus7k (Decisions), ss_6201fu157 (Interview)  

**Wartości CSS:**
- "New Decision": `background: rgba(232,125,30,0.85)` (pomarańczowy) / `border-radius: 9999px` / `font-size: 14px` / `padding: 0px 16px`
- "Assign" (Interview): `background: rgb(133,24,47)` (ciemnoczerwony) / `border-radius: 9999px` / `font-size: 14px`
- "New notebook" (wcześniej): fioletowe ~`#7C3AED`

**PROBLEM:** Każdy moduł ma własny kolor dla głównego CTA:
- Inbox/My Work: brak "New" CTA (tylko filtery)
- Decisions: pomarańczowy (#E87D1E)
- Interview: ciemnoczerwony (#851830)
- Notebook: fioletowy (#7C3AED)
- Tasks: fioletowy (~#7C3AED)
- Initiatives: nieaktywny (COMING SOON)

Brak globalnego spójnego koloru primary action.

---

#### COMP-BTN-04 — Approve — Semantyczne przyciski akcji (Decisions panel)

**Screenshot ID:** ss_5491jlssg (zoom)  
**URL:** https://demo.consultify.ai/my-work (Decisions, panel otwarty)

**Wartości CSS:**
- "Approve": `background: rgba(82,165,46,0.1)` / `color: rgb(199,230,159)` / `border: 1px solid rgba(82,165,46,0.3)` / `border-radius: 9999px` / `font-size: 12px`
- "Reject": `background: rgba(232,5,56,0.1)` / `color: rgb(244,186,171)` / `border: 1px solid rgba(232,5,56,0.3)` / `border-radius: 9999px`
- "More info": `background: rgba(255,255,255,0.04)` / `color: rgb(226,232,240)` / `border: 1px solid rgba(255,255,255,0.06)` / `border-radius: 9999px`
- "Delegate": identyczne jak "More info"
- "Remind": identyczne jak "More info"
- "Escalate": `background: rgba(232,125,30,0.1)` / `color: rgb(249,212,154)` / `border: 1px solid rgba(232,125,30,0.3)` / `border-radius: 9999px`
- "Snooze": identyczne jak "More info"

**Opis wizualny:** Spójny wzorzec "ghost z kolorowym tłem i obramowaniem semantycznym". Zielony=Approve, Czerwony=Reject, Pomarańczowy=Escalate, Biały=neutralne. border-radius: 9999px (pełne pill).

**Wzorzec spójny wewnętrznie.** Wszystkie mają padding: `0px 12px`, font-size: `12px`.

---

#### COMP-BTN-05 — Secondary / Outline — Table action buttons

**Wartości CSS (przykład):**
- `background: rgba(0,0,0,0)`
- `border: 1px solid rgb(42,54,85)`
- `color: rgb(226,232,240)`
- `border-radius: 8px`
- `padding: 6px 12px`

**Przykłady:** "Markdown", "DOCX", "PDF", "Open in Sheets Builder" w Document Studio.

---

#### COMP-BTN-06 — Ghost / Text-only

**Przykłady:** "Cancel" (modal), "Start over" (Document Studio), "History" (doc studio toolbar)  
**Wartości CSS:**
- `background: transparent`
- `color: rgb(148,163,184)` lub `rgb(203,213,225)`
- `border: none` lub `0px`
- `border-radius: 8–12px`

---

#### COMP-BTN-07 — "Talk to Teresa" — Główny CTA chat

**Screenshot ID:** ss_1284rxbmk  
**Wartości CSS:**
- `background: rgb(168,45,73)` (czerwony-malinowy)
- `color: rgb(255,255,255)`
- `border-radius: 9999px` (pill)
- Ikona mikrofonu wewnątrz

---

### 2.2 BADGE — Statusy i chips

#### COMP-BADGE-01 — Status "Submitted"

**Kontekst:** Interview Inbox, kolumna STATUS  
**Wartości CSS:**
- Kontener: `background: rgb(21,33,59)` / `border: 1px solid rgba(255,255,255,0.1)` / `border-radius: 9999px` / `padding: 0px 8px` / `height: 24px` / `width: 84px`
- Tekst: `color: rgb(148,163,184)` / `font-size: 11px`
- Dot (wewnątrz): nie widoczny w CS — kolor kropki tealowy/niebieski z screenshota

---

#### COMP-BADGE-02 — Status "Assigned"

**Kontekst:** Interview Inbox, kolumna STATUS  
**Wartości CSS:**
- `background: rgb(21,33,59)` / `border: 1px solid rgba(255,255,255,0.1)` / `border-radius: 9999px` / `height: 24px`
- Tekst: `color: rgb(148,163,184)` / `font-size: 11px`

**PROBLEM:** "Submitted" i "Assigned" mają IDENTYCZNE style tła/borderu — różnią się tylko kolorem kropki. Brak semantycznego wyróżnienia stanów.

---

#### COMP-BADGE-03 — Status "Open" (My Work Inbox)

**Kontekst:** My Work Inbox, kolumna Status  
**Wartości CSS:**
- Kontener (filtr pills górne): `background: rgba(168,45,73,0.3)` / `color: rgb(246,184,190)` / `border-radius: 9999px`
- Status w tabeli row: `background: rgba(232,125,30,0.15)` / `color: rgb(247,199,107)` / `border-radius: 9999px` / `padding: 2px 8px`

**PROBLEM:** "Open" jako filter pill (górne taby) ma inny kolor niż "Open" jako badge w tabeli. To samo słowo — dwie różne reprezentacje kolorystyczne.

---

#### COMP-BADGE-04 — Urgency "Critical" (My Work Inbox)

**Kontekst:** My Work Inbox, kolumna Urgency  
**Wartości CSS:**
- `background: rgba(232,5,56,0.15)` / `color: rgb(224,178,167)` / `border-radius: 9999px` / `padding: 2px 8px` / `font-size: 11px`
- Z ikoną ostrzeżenia (trójkąt)

---

#### COMP-BADGE-05 — Priority "MEDIUM" (Initiatives Kanban)

**Kontekst:** Karta Kanban Initiatives  
**Wartości CSS (z screenshota ss_94602ykr5):**
- Niebieskie tło, niebieski tekst
- Na podstawie Fazy 1: `~#1e3a5f` bg, niebieski tekst

---

#### COMP-BADGE-06 — Priority "CRITICAL" / "HIGH" (Initiatives Kanban)

**Kontekst:** Karta Kanban Initiatives  
**Wartości CSS (z screenshota):**
- CRITICAL: ciemnoczerwone tło `~rgba(232,5,56,0.2)`, czerwony tekst
- HIGH: ciemnopomarańczowe tło, pomarańczowy tekst

---

#### COMP-BADGE-07 — "On track" (status inicjatywy)

**Kontekst:** Karta Kanban Initiatives  
**Wartości CSS (z screenshota ss_94602ykr5):**
- Zielona kropka + "On track" — zielone tło/kolor

---

#### COMP-BADGE-08 — "Beta" badge (sidebar)

**Kontekst:** Expanded sidebar dla beta modułów  
**Wartości CSS:**
- `background: rgba(232,125,30,0.1)` (pomarańczowe tło)
- `color: rgb(234,155,32)` (amber)
- `font-size: 10px`
- `border-radius: 4px`
- `padding: 1px 6px`

---

#### COMP-BADGE-09 — Notification bubble (header)

**Kontekst:** Czerwona liczba "15" w prawym górnym rogu  
**Wartości CSS:**
- `background: rgb(232,5,56)` (jaskrawoczerwony)
- `color: rgb(255,255,255)`
- `border: 2px solid rgb(10,15,30)` (separator od tła)
- `font-size: 10px`
- `border-radius: 9999px`
- `padding: 0px 4px`

---

#### COMP-BADGE-10 — Filter pills (górne taby w My Work i Interview)

**Kontekst:** "ALL 5", "Answered 2", "Approved 0" itp.  
**Wartości CSS (aktywny "ALL"):**
- `background: rgba(168,45,73,0.3)` / `color: rgb(246,184,190)` / `border-radius: 9999px` / `padding: 2px 6px` / `font-size: 10px`

**Wartości CSS (nieaktywny licznik):**
- `background: rgb(42,54,85)` / `color: rgb(203,213,225)` / `border-radius: 9999px`

---

#### COMP-BADGE-11 — Category badge "QUICK", "digital", "custom" (Interview)

**Kontekst:** Interview Inbox, kategoria szablonu  
**Wartości CSS (z screenshota ss_6201fu157):**
- "QUICK": zielona kropka + tekst biały
- "digital": niebieska kropka + tekst biały
- "custom": pomarańczowa kropka + tekst biały
- Wzorzec: kolorowa kropka + szary/biały tekst — brak tła kontenera

---

### 2.3 INPUT — Pola formularzy

#### COMP-INP-01 — Text input (Settings)

**Kontekst:** Settings Profile — First Name, Last Name, etc.  
**Wartości CSS:**
- Default: `background: rgba(10,15,30,0.5)` / `border: 1px solid rgb(42,54,85)` / `border-radius: 6px` / `font-size: 16px` / `padding: 8px 12px 8px 36px` (z ikoną prefix)
- Focus: `outline: rgb(200,50,74) solid 2px` — czerwony ring

---

#### COMP-INP-02 — Text input (Document Studio)

**Kontekst:** Document Studio — Description textarea, Title input  
**Wartości CSS:**
- Default: `background: rgb(15,23,42)` / `border: 1px solid rgb(42,54,85)` / `border-radius: 8px` / `font-size: 14px` / `padding: 8px 12px`
- Focus: `outline: rgb(200,50,74) solid 2px` / `box-shadow: rgba(168,45,73,0.2) 0px 0px 0px 2px`

**NIESPÓJNOŚĆ z Settings:**  
- Settings input: `bg: rgba(10,15,30,0.5)`, `border-radius: 6px`, `font-size: 16px`
- DocStudio input: `bg: rgb(15,23,42)`, `border-radius: 8px`, `font-size: 14px`
- Oba mają ten sam focus ring kolor (czerwony), ale różne backgrounds i border-radius.

---

#### COMP-INP-03 — Native select (Document Studio)

**Kontekst:** Document Studio — Language, Density, Goal dropdowns  
**Wartości CSS:**
- `background: rgb(15,23,42)` / `border: 1px solid rgb(42,54,85)` / `border-radius: 8px` / `font-size: 14px` / `padding: 8px 12px`
- Focus: `outline: rgb(200,50,74) solid 2px` — wygląda jak error

**PROBLEM:** Native `<select>` używa systemowego appearance (strzałka OS). Focus ring jest czerwony — wygląda jak error state.

---

#### COMP-INP-04 — Custom dropdown (modal)

**Kontekst:** Modal "Assign Interview" — dropdowns  
**Wartości CSS:**
- `background: rgba(255,255,255,0.04)` / `border: 1px solid rgba(255,255,255,0.08)` / `border-radius: 12px` / `font-size: 14px` / `height: 40px` / `padding: 0px 12px`

**NIESPÓJNOŚĆ:** Custom dropdown ma `border-radius: 12px`, natywny select ma `border-radius: 8px`. Inny styl dla tej samej funkcji.

---

#### COMP-INP-05 — Checkbox

**Kontekst:** Document Studio — "Refine outline with AI" checkbox  
**Wartości CSS:**
- `width: 16px` / `height: 16px` / `accent-color: auto` (systemowy)

**PROBLEM:** Checkbox jest natywny, bez customowego stylowania. `accent-color: auto` = systemowy niebieski lub browser-default. Niespójne z dark theme.

---

### 2.4 CARD — Karty

#### COMP-CARD-01 — Karta inicjatywy (Kanban)

**Screenshot ID:** ss_94602ykr5  
**URL:** https://demo.consultify.ai/initiatives

**Wartości CSS (z DOM i screenshota):**
- Tło: ciemnoniebieskie (~`rgb(17,25,50)`)
- `border-radius: ~8px`
- `border: 1px solid rgba(255,255,255,0.08)` (prawie niewidoczny)
- Padding: ~12px
- Zawartość: Tytuł (biały, semi-bold) + Priority badge (MEDIUM/HIGH/CRITICAL) + Track badge (On track) + Avatar użytkownika + NEXT GATE section

**Hover state:** Widoczna subtelna zmiana tła (jaśniejsze) — szczegóły poniżej po zooming.

---

#### COMP-CARD-02 — Kafelek kontekstowy na home chat

**Screenshot ID:** ss_1284rxbmk  
**URL:** https://demo.consultify.ai/chat

**Opis wizualny:**  
4 kafelki "Market analysis", "Financial analysis", "Classic consulting", "Digital transformation". Każdy z ikoną (kolorową, małą), tytułem i krótkim opisem. Styl: ciemne tło z delikatnym borderem.

---

#### COMP-CARD-03 — Teresa panel kontekstowy

**Screenshot ID:** ss_94602ykr5 (dół-lewa strona)  
**Opis:** Panel "TERESA" z fioletową etykietą i promptami sugerowanymi. Ciemne tło, zaokrąglone rogi.

---

### 2.5 TABLE — Tabele

#### COMP-TBL-01 — Interview Inbox tabela

**Screenshot ID:** ss_6201fu157  
**URL:** https://demo.consultify.ai/interview

**Wartości CSS (z DOM):**

| Element | Wartości |
|---------|----------|
| Header row bg | `rgba(15,23,42,0.4)` |
| Header cell | `font-size: 16px` / `font-weight: 700` / `padding: 8px 12px` / `color: rgb(255,255,255)` |
| Data row bg | `rgba(255,255,255,0.03)` |
| Data cell | `font-size: 16px` / `padding: 12px` / `color: rgb(255,255,255)` |

**Opis wizualny:**  
Bardzo subtelne tło header (prawie niewidoczne). Data row ma minimalne tło (`0.03 opacity`). Podział wierszy przez bordery.

**Hover state:** Przy hover nad wierszem — brak widocznego wyróżnienia (test ss_98506hac9 nie pokazał zmiany).

---

#### COMP-TBL-02 — My Work Inbox tabela

**Screenshot ID:** ss_45194y0xf  
**URL:** https://demo.consultify.ai/my-work

**Opis wizualny:**  
Kolumny: Title (z subtext) | Status | Urgency | Received | SLA. Status badge "Open" z pomarańczowym tłem. Urgency badge "Critical" z czerwoną ikoną trójkąta. SLA badge np. "L1 120d" z szarą kropką.

---

#### COMP-TBL-03 — My Work Decisions tabela

**Screenshot ID:** ss_1825qus7k  
**URL:** https://demo.consultify.ai/my-work (tab Decisions)

**Opis wizualny:**  
Kolumny: Decision | Type (skrócone: APPR..., TECH, STRA...) | Status (Approved/Escalated + kropka) | Priority (Critical/High) | Due Date | Project. Problem z ucięciem Type badges nadal obecny.

---

### 2.6 NAV — Nawigacja i taby

#### COMP-NAV-01 — Sidebar — (patrz COMP-N01, COMP-N02)

---

#### COMP-NAV-02 — Taby poziome (Interview)

**Screenshot ID:** ss_6201fu157  
**URL:** https://demo.consultify.ai/interview

**Wartości CSS:**
- Aktywny tab "Inbox": `background: rgba(168,45,73,0.1)` / `color: rgb(241,245,249)` / `border-bottom: 1px solid rgba(168,45,73,0.4)` / `font-weight: 500` / `font-size: 14px` / `padding: 0px 14px`
- Nieaktywny tab: `background: rgba(0,0,0,0)` / `color: rgb(203,213,225)` / `border-bottom: 1px solid rgb(42,54,85)` / `font-weight: 500` / `font-size: 14px`
- `height: ~36px` (z paddingiem pionowym)

---

#### COMP-NAV-03 — Taby poziome (My Work — górna belka)

**Screenshot ID:** ss_45194y0xf  
**URL:** https://demo.consultify.ai/my-work

**Opis wizualny:**  
Taby: Ideas (z kłódką), Notebook, Inbox (aktywny), Calendar, Tasks, Decisions, Manager. Aktywny tab (Inbox) — ciemnoszare/granatowe tło. Taby wyglądają inaczej niż Interview — mają bardziej "pill" kształt niż underline.

---

#### COMP-NAV-04 — OUTPUT pills (Chat)

**Screenshot ID:** ss_1284rxbmk  
**URL:** https://demo.consultify.ai/chat

**Wartości CSS:**
- "Auto" (aktywny): `background: rgba(133,24,47,..) ` — ciemnoczerwony / `color: rgb(133,24,47)` — z ikoną / `font-size: 12px` / `font-weight: 500`
- "Documents", "Tables", "Presentations" (nieaktywne): transparentne / `color: rgb(148,163,184)` / `border: 1px solid`

---

### 2.7 TYPE — Typografia

#### COMP-TYPE-01 — Skala typograficzna (z całej aplikacji)

**Zebrana z JavaScript na /chat (Inter, sans-serif):**

| Rozmiar | Line-height | Font-weight | Kolor | Przykład |
|---------|-------------|-------------|-------|---------|
| 48px | 48px | 600 | rgb(228,88,104) reds | ", Piotr" (heading) |
| 20px | 28px | 600 | rgb(168,45,73) | "77" (logo) |
| 18px | 28px | 400 | rgb(203,213,225) | Podtytuł chat |
| 16px | 24px | 400 | rgb(255,255,255) | Body text |
| 16px | 24px | 700 | — | Table headers |
| 14px | 20px | 400–500 | rgb(255,255,255) / rgb(203,213,225) | Etykiety, taby |
| 12px | 16px | 500–600 | rgb(255,255,255) | Pills, avatary |
| 11px | 16.5px | 400–600 | mix | Small labels |
| 10px | 15px | 400–700 | mix | Badges, mini-labels |

**Font family:** `Inter, sans-serif` (potwierdzono)  
**Font loading:** Google Fonts lub wbudowany — do weryfikacji

---

#### COMP-TYPE-02 — Nagłówki w Settings

**Wartości CSS:**
- Section headers (MY SETTINGS etc.): `font-size: 11px` / `font-weight: 600` / `color: rgb(100,116,139)` / `letter-spacing: 0.55px` (small caps effect)
- "Personal Information" (h1-like): `font-size: ~24px` / `font-weight: bold`

---

### 2.8 OVERLAY — Modale, dropdowny, toasty

#### COMP-OVR-01 — Modal (Assign Interview)

Szczegóły w COMP-N04 / sekcja 1d.  
**Kluczowe:** `border-radius: 16px` / brak backdrop dimming / ciemne tło `rgb(15,23,42)`.

---

#### COMP-OVR-02 — Crash Error Modal (VIS-007 z Fazy 1)

**Kontener:** Ciemne tło + czerwona ikona + białe przyciski  
**Backdrop:** Prawdopodobnie `rgba(0,0,0,0.5)` — wyglądał jak przyciemniony (ss_4510y75gx Fazy 1)  
**NIESPÓJNOŚĆ z Assign modal:** Crash modal MA backdrop dimming, Assign Interview NIE MA.

---

#### COMP-OVR-03 — Tooltip sidebarze

**Screenshot ID:** ss_7241rnjeo (zoom)  
**Opis:** Szary prostokatny kontener z białym tekstem "MY WORK". Pojawia się po prawej stronie ikony. Brak strzałki (arrow). Wygląda jak standardowy browser tooltip lub bardzo prosty custom tooltip.

---

### 2.9 SPECIAL — Komponenty specjalne

#### COMP-SPEC-01 — Progress bar (Interview)

**Kontekst:** Interview Inbox — kolumna PROGRESS  
**Wartości CSS:**
- Container (tło): `background: rgba(255,255,255,0.06)` / `height: 4px` / `border-radius: 9999px` / `width: ~101–115px`
- Filled part (100%): `background: rgb(158,196,77)` (żółto-zielony lime) / `height: 4px` / `border-radius: 9999px`
- Filled part (0%): niewidoczna (pusta)

**Widok screenshota:** Dwa wiersze z 100% (zielony pasek) + trzy wiersze z 0% (puste szare tło).

---

#### COMP-SPEC-02 — Avatar z inicjałami "P" (tabela)

**Kontekst:** Kolumna ASSIGNEE w Interview/My Work  
**Wartości CSS:**
- `background: rgb(21,33,59)` (ciemna granatowa)
- `color: rgb(148,163,184)` (slate-400)
- `border-radius: 9999px`
- `font-size: 10px`
- `font-weight: 500`
- `width: 24px` / `height: 24px`

---

#### COMP-SPEC-03 — Avatar "PW" (header globalny)

**Kontekst:** Prawy górny róg aplikacji  
**Wartości CSS:**
- `background: transparent`
- `border: 1px solid rgb(55,65,81)` (slate-700)
- `border-radius: 9999px`
- `width: 32px` / `height: 32px`
- Tekst "PW": `font-size: 11px` / `color: rgb(148,163,184)`

**NIESPÓJNOŚĆ:** Avatar "P" w tabeli = `bg: rgb(21,33,59)` (ciemnogranatowy fill). Avatar "PW" w header = transparent z borderem. Dwa różne wizualne wzorce dla tej samej koncepcji.

---

#### COMP-SPEC-04 — Ikony (Lucide Icons)

**Potwierdzono:** Biblioteka **Lucide** (`lucide-[name]` klasy SVG)  
Klasy na stronie chat: lucide-message-square-text, lucide-briefcase, lucide-clipboard-list, lucide-wrench, lucide-lightbulb, lucide-rocket, lucide-trending-up, lucide-calculator, lucide-clipboard-check, lucide-folder-output, lucide-file-text, lucide-presentation, lucide-table, lucide-users, lucide-factory, lucide-lock, itd.

---

#### COMP-SPEC-05 — Spinner aplikacji (page load)

**Screenshot ID:** ss_6508s2nj3  
**Opis:** Animowany okrąg ~24px, fioletowo-szarawy kolor, animacja `spin`. Na bardzo ciemnym granatowym tle `~rgb(8,12,24)`.

---

## CZĘŚĆ 3 — Viewport Summary

### 1280px — wyniki

| Moduł | Status |
|-------|--------|
| Chat | OK — brak overflow |
| My Work Inbox | OK |
| Interview Inbox | OK |
| Document Studio form | OK |
| Initiatives Kanban | NIE TESTOWANO (znane problemy z VIS-028) |

---

## Podsumowanie screenshotów Fazy 1b

| ID | Opis |
|----|------|
| ss_1284rxbmk | Chat default + sidebar icon-only |
| ss_7241rnjeo | Sidebar hover tooltip "MY WORK" |
| ss_8357gyzo7 | Sidebar expanded z etykietami |
| ss_8491q31rr | Sidebar expanded (pełny widok) |
| ss_9640yux9s | Sidebar ultra-narrow (collapsed) |
| ss_7557ldnip | Sidebar collapsed |
| ss_4677evpz3 | Document Studio formularz pusty |
| ss_5627q1qk3 | Document Studio focus state textarea |
| ss_84166173l | Document Studio plan outline |
| ss_6325v74gr | Document Studio wygenerowany dokument |
| ss_94602ykr5 | Initiatives Kanban |
| ss_8509egx9t | Initiatives detail panel |
| ss_6201fu157 | Interview Inbox tabela |
| ss_98506hac9 | Interview Inbox tabela — hover state |
| ss_0963woefo | My Work Inbox |
| ss_1825qus7k | My Work Decisions lista |
| ss_5491jlssg | My Work Decisions + panel (Approve/Reject buttons) |
| ss_6508s2nj3 | Spinner loading |
| ss_45194y0xf | My Work Inbox załadowany |
| ss_320771vyf | Settings Profile |
| ss_0144x9fwr | Settings Profile + focused input |
| ss_5486h7ex8 | Modal "Assign Interview" |
| ss_9418gvw2e | Interview Inbox 1280px |
| ss_99780365m | My Work Inbox 1280px |
| ss_1656jkbcx | Document Studio 1280px |
| ss_6698w9ic0 | Chat + sidebar expanded |

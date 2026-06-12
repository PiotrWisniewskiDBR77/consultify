# Wizualny Audyt Consultify — Faza 1

**Data:** 2026-06-12  
**Środowisko:** staging (https://demo.consultify.ai)  
**Rola:** OWNER — DBR77  
**Viewport bazowy:** 1440×900 (ciemny motyw)  
**Audytor:** Claude Code (automatyczny)

---

## 1. Chat (`/chat`)

### VIS-001 — Chat — Empty state (nowa rozmowa)

**Screenshot ID:** ss_54225vqvg  
**URL:** https://demo.consultify.ai/chat  
**Stan:** pusty chat (nowa rozmowa, brak historii)

**Opis:**  
Ciemnoniebieskie tło (#0d1117-podobne). Na środku duży napis "Talk to Teresa, Piotr" — "Talk to Teresa," białe, "Piotr" w kolorze pomarańczowo-czerwonym (~#E55B4D). Poniżej podtytuł szarym tekstem. Przycisk "Talk to Teresa" ma tło czerwono-brązowe z ikoną mikrofonu.  
Pasek OUTPUT: etykieta "OUTPUT" w kolorze muted, następnie pill-buttony: "Auto" (aktywny, czerwono-pomarańczowy), "Documents" (ciemny border, szary tekst), "Tables" (j.w.), "Presentations" (j.w.).  
Input: ciemnoniebieska karta z placeholder "Ask Teresa about your work...".  
Dół strony: duży napis "Consultify®" z podtytułem "DBR77 INDUSTRIAL INTELLIGENCE" — bardzo jasny, prawie biały, duże litery.  
Cztery kafelki kontekstowe na dole: Market analysis, Financial analysis, Classic consulting, Digital transformation — każdy z ikoną, tytułem i opisem.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Napis "Consultify® / DBR77 INDUSTRIAL INTELLIGENCE" na dole strony głównej chatu jest bardzo duży i dominujący. Czy ma być tak eksponowany na stronie pracy?
- Czy pill-button "Auto" powinien mieć tę samą czerwoną barwę co przycisk destrukcyjny "Stop"? (Kolorystyczna kolizja — czerwień aktywnego taba = czerwień przycisku zatrzymania).

---

### VIS-002 — Chat — Input z wpisanym tekstem (przed wysłaniem)

**Screenshot ID:** ss_7697xt4o8  
**URL:** https://demo.consultify.ai/chat  
**Stan:** tekst "Cześć Teresa" wpisany w input

**Opis:**  
Input ma czerwony/pomarańczowy border (focus state) — kolor ~#E55B4D. Tekst jest biały. Przycisk send (strzałka w górę) ma tło w tym samym czerwonym kolorze. Pasek ACTION pod inputem: ikony +, ołówek, person+.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Focus border inputu jest czerwony — taki sam jak error state w większości design systemów. Czy to jest zamierzone?

---

### VIS-003 — Chat — Loading state (Thinking...)

**Screenshot ID:** ss_49108907f  
**URL:** https://demo.consultify.ai/chat/c8eef172-...  
**Stan:** wiadomość wysłana, Teresa generuje odpowiedź

**Opis:**  
Wiadomość użytkownika wyrównana do prawej w ciemnym pill-bubble (ciemny granatowy). Nazwa "Piotr Wiśniewski" nad wiadomością — biały tekst, małe litery.  
Po lewej stronie: "... Thinking..." — trzy animowane kropki i kursywny szary tekst.  
Przycisk Stop: czerwone kółko z białym kwadratem (stop icon) w prawym dolnym rogu inputu.

**Czy coś jest obiektywnie złe?**  
NIE.

---

### VIS-004 — Chat — Odpowiedź Teresy (po wygenerowaniu)

**Screenshot ID:** ss_7485i1q32  
**URL:** https://demo.consultify.ai/chat/c8eef172-...  
**Stan:** odpowiedź Teresy widoczna

**Opis:**  
Odpowiedź "Cześć! Jak mogę Ci dzisiaj pomóc? ..." — biały tekst, lewy margines, brak bubble tła (tekst bezpośrednio na tle strony).  
Pod odpowiedzią: zielony pill "1 sources" (ciemnozielone tło, jasnozielony tekst + ikona check).  
Trzy ikony akcji: kopiuj, głośnik, strzałka w prawo.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Odpowiedź Teresy nie ma "bubble" — tekst bezpośrednio na tle. Wiadomość użytkownika ma bubble. Czy asymetryczny styl (bubble tylko dla usera) jest zamierzony?

---

### VIS-005 — Chat — Canvas (split view) z edytorem TipTap

**Screenshot ID:** ss_4877q8hip  
**URL:** https://demo.consultify.ai/chat/c8eef172-...  
**Stan:** split view aktywny, kanwa "Company Work Note" po prawej

**Opis:**  
Split view: chat po lewej (węższa kolumna ~50%), editor po prawej.  
Toolbar kanwy: + | ikona prezentacji | tabela | dokument | przycisk "PROMOTE" (czerwony pill, duże litery) | glowbulb | plik | rakieta | młotek | kursor | kopiuj | dyskietka | X | ...  
Pasek formatowania TipTap: undo/redo | B I U S <> highlights | H1 H2 H3 | lista • lista 1 | lista check | blockquote (aktywna, ciemnoczerwone tło) | tabela | link.  
Dokument zawiera: tytuł "Company Work Note", sekcje Context / Working Draft / Notes.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Przycisk "PROMOTE" w toolbarze kanwy — duże czerwone capslock litery na tle pillu. Wygląda jak alert/warning. Czy to zamierzony styl dla tej akcji?
- Blockquote jest aktywny (ciemnoczerwone tło) na szablonowym dokumencie — czy to ma być default?

---

## 2. My Work — Inbox (`/my-work`)

### VIS-006 — My Work — Inbox — Lista

**Screenshot ID:** ss_5908izu0x  
**URL:** https://demo.consultify.ai/my-work  
**Stan:** inbox załadowany, 255 elementów

**Opis:**  
Header: "My Work > Inbox". Tabs: Ideas (z kłódką 🔒), Notebook, Inbox (aktywny), Calendar, Tasks, Decisions, Manager.  
Filtry: ALL 255 | Overdue 170 | Saved 0 | AI 1 | Critical 12 | Action required 240 | Today 0 | This week 0.  
Prawy side: Open 255 | Done 0 | Saved 0 | AI Triage.  
Kolumny tabeli: checkbox | Title ↕ | Status ↕ | Urgency ↕ | Received ↕ | SLA  
Status badge "Open": pomarańczowa kropka + tekst biały, ciemnopomarańczowe tło.  
Urgency badge "Critical": ciemnoczerwone tło, biały tekst z ikoną trójkąta ostrzeżenia.  
SLA badge "L1 120d": szara kropka, szare kółko z wartością "L1 120d".  
Teresa panel po lewej z sugerowanymi promptami: "Triage all new items for me", "Summarize notifications since yesterday", "What needs urgent attention?".

**Czy coś jest obiektywnie złe?**  
NIE (w stanie listy).

**Do decyzji właściciela:**  
- Ideas tab ma ikonę kłódki — wskazuje na moduł beta-zablokowany. Czy kłódka ma być widoczna w nawigacji, czy ukryta dla OWNER?
- 170/255 itemów to "Overdue" — duża liczba demo danych.

---

### VIS-007 — My Work — Inbox — CRASH przy kliknięciu na element (P0 BUG)

**Screenshot ID:** ss_4510y75gx  
**URL:** https://demo.consultify.ai/my-work  
**Stan:** kliknięcie na dowolny element listy inbox

**Opis:**  
Po kliknięciu na DOWOLNY element Inbox pojawia się modal błędu na ciemnym tle:  
- Duża ikona ostrzeżenia w kolorze czerwono-pomarańczowym (trójkąt z wykrzyknikiem), tło kółka w ciemnej szarości.  
- Tytuł: **"Coś poszło nie tak"** — biały, duży.  
- Podtytuł: "Wystąpił nieoczekiwany błąd podczas ładowania tej strony."  
- Box z orange/amber tekstem: "Strona napotkała problem i została bezpiecznie zatrzymana. Szczegóły techniczne nie są wyświetlane. Spróbuj ponownie lub wróć do strony głównej."  
- Zielony tekst poniżej: "Crash diagnostics were sent successfully."  
- Dwa przyciski: "Spróbuj ponownie" (ciemny border) + "Strona główna" (fioletowe tło ~#7C3AED, białe litery).

**Czy coś jest obiektywnie złe?**  
**TAK — KRYTYCZNY BŁĄD P0.** Każde kliknięcie na element Inbox powoduje pełny crash aplikacji. Błąd jest deterministyczny i reprodukowalny.

**Błąd z logów Railway:**  
`[ClientError] App-level crash: Minified React error #31 — component stack: PreviewRelations-Dqo_3cjK.js → TableWithPreviewLayout → MyWorkView`  
React #31 = invalid JSX element type — komponent zwraca obiekt zamiast ReactElement. Plik `PreviewRelations-Dqo_3cjK.js` jest sprawcą.

---

## 3. My Work — Decisions

### VIS-008 — My Work — Decisions — Lista

**Screenshot ID:** ss_9121ktrk6  
**URL:** https://demo.consultify.ai/my-work (tab Decisions)  
**Stan:** lista decyzji załadowana, 4+0 elementów

**Opis:**  
Filtry: All 4 | My decisions to make 4 | My requests pending 0.  
Kolumny: checkbox | DECISION ↕ | TYPE ↕ | STATUS ↕ | PRIORITY ↕ | DUE DATE ↕ | PROJECT ↕  
Status badges widoczne:  
- "Approved" — zielona/limonkowa kropka, ciemne tło  
- "Escalated" — pomarańczowa/żółta kropka  
Priority badges:  
- "Critical" — czerwona/koralowa kropka  
- "High" — pomarańczowa kropka  
Type badges: "APPR..." (Approval), "TECH", "STRA..." — ciemnoszare pill z obciętym tekstem.

**Czy coś jest obiektywnie złe?**  
TAK — Type badges są obcięte ("APPR...", "STRA..."). Tekst jest ucięty bez możliwości odczytania pełnej wartości w widoku listy.

---

### VIS-009 — My Work — Decisions — Detail panel

**Screenshot ID:** ss_2108k21jv / zoom: ss_powiększony  
**URL:** https://demo.consultify.ai/my-work (tab Decisions, panel otwarty)  
**Stan:** kliknięty element "Select AI model provider..."

**Opis:**  
Panel po prawej, ~265px szerokości. Nagłówek: "Select AI model ..." (tytuł ucięty). Przycisk pin + badge "Open" + X.  
Góra panelu: badges "Approved" (zielone tło #22C55E-like, czarny tekst), "Critical" (czerwone tło, biały tekst), "Urgent" (żółte/brązowe tło, biały tekst), data "20 Mar 2026". Szary opis "Review soon — approaching deadline".  
Sekcja DETAILS: "~14 words" + menu ···. Treść opisu.  
Sekcja AI: "Summarize context" | "Propose options" | "Assess risk" — każdy jako button z ikoną gwiazdki.  
"No relations" — szary tekst.  
Akcje: "✓ Approve A" (zielone tło, biały tekst) | "✗ Reject R" (ciemnoczerwone tło) | "More info I" + "Delegate G" (ciemne tła) | "Remind" + "Escalate" (żółte tło) + "Snooze ∨" (strzałka dropdown).

**Czy coś jest obiektywnie złe?**  
TAK — Tytuł w nagłówku panelu jest ucięty wielokropkiem "Select AI model ...". Użytkownik nie widzi pełnego tytułu.

**Do decyzji właściciela:**  
- Panel Decisions ma skróty klawiaturowe (A, R, I, G) widoczne obok przycisków jako badges. Czy to jest zamierzone? Wygląda na feature deweloperski (trudny do przeczytania).

---

## 4. My Work — Notebook

### VIS-010 — My Work — Notebook — Lista notebooków

**Screenshot ID:** ss_0627fgpw3  
**URL:** https://demo.consultify.ai/my-work (tab Notebook)  
**Stan:** lista notebooków

**Opis:**  
Filtry: All 1 | Personal 1 | Team 0.  
Kolumny: NOTEBOOK ↕ | TYPE ↕ | CONTEXT ↕ | NOTES ↕ | UPDATED ↕  
Jeden notebook: "🗒 Moje notatki" — ikona emoji + nazwa. TYPE = "Personal" badge (ciemnoniebieskie tło, szaro-niebieski tekst). CONTEXT = "—". NOTES = 15. UPDATED = "4d ago".  
Przycisk "New notebook" — fioletowe tło ~#7C3AED.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Emoji ikona "🗒" przed nazwą notebooka — czy to zamierzony wzorzec, czy powinna być ikona SVG spójna z resztą designu?

---

### VIS-011 — My Work — Notebook — Otwarty notebook z edytorem

**Screenshot ID:** ss_70479crq1  
**URL:** https://demo.consultify.ai/my-work?notebook=nb_default_...  
**Stan:** otwarty notebook "Moje notatki", wybrana nota

**Opis:**  
Układ split: lista notatek po lewej (~270px), edytor po prawej (reszta szerokości).  
Pasek statusów notatek: kolorowy pasek postępu (pomarańczowy, niebieski, zielony, szary) ~ 30px wysokości.  
Tabs: Inbox 1 | Active 14 | All 15 | ikona filtra.  
Karta notatki: ikona + tytuł + czas (12w, 4w itd.) + badges (ACTIONABLE, zielony; Uploaded file, szary; sprint, niebieski; priorities, niebieski).  
Tytuł edytora: "Weekly priorities — Sprint 14 focus areas" — duże, białe.  
Tags: "sprint", "priorities", "planning", "weekly", "+ tag" — szare pill-badges.  
VERIFICATION row: "Verified ∨" (select), "REVIEW" label, "Weekly ∨" (select), "Mark as reviewed" button (zielona obwódka, zielony tekst).  
Toolbar edytora: undo/redo | B I U S ⌀ highlight | H1 H2 H3 | lista • lista 1 lista check | tabela | link.  
Sekcja CANONICAL NOTEBOOK PATH: 4 karty (1. Add sources, 2. Draft AI proposal, 3. Review proposal, 4. Convert) — każda z tytułem, opisem i CTA buttonem.  
SEND TO: "⊙ Radar" | "💡 Initiatives" — pill buttony.  
Dolny prawy róg: pop-up "This note looks like action items. Convert?" + przycisk "Convert" (czerwono-fioletowy).

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- "Convert?" pop-up pojawia się automatycznie. Czy to ma być pokazywane od razu po otwarciu notatki (nawet bez działania użytkownika)?
- Karty CANONICAL NOTEBOOK PATH: przyciski "Attachments →" i "AI proposal →" mają fioletowe tło (aktywne), "Review →" i "To report →" mają ciemnoszare tło (nieaktywne). Wizualnie jasna progresja, ale "To report →" jest szare gdy nota jest "Verified" — czy to logicznie poprawne?

---

## 5. My Work — Tasks

### VIS-012 — My Work — Tasks — Lista

**Screenshot ID:** ss_5707behzz  
**URL:** https://demo.consultify.ai/my-work (tab Tasks)  
**Stan:** lista 200 zadań

**Opis:**  
Filtry: All 200 | Overdue 175 | Today 0 | This Week 0 | Urgent 39 | New 0.  
Kolumny: checkbox | Task ↕ | Status ↕ | Priority ↕ | Due Date ↕ | Assignee ↕  
Status badges: "To Do" (szara kropka, ciemnoszare tło), "In progress" (niebieska/fioletowa kropka, ciemny niebieski tło).  
Priority badges: "Critical" (czerwona kropka), "High" (pomarańczowa kropka).  
Due Date: "Feb 8", "Feb 11" — daty bez roku.  
Assignee: "P Piotr Wiśniewski" — inicjał P w kółku.  
Przyciski w header: Grid view | table view | kalendarz view | AI Priorities + "New Task" (fioletowy).

**Czy coś jest obiektywnie złe?**  
NIE.

---

## 6. My Work — Calendar

### VIS-013 — My Work — Calendar — Widok miesięczny

**Screenshot ID:** ss_0430id5z3  
**URL:** https://demo.consultify.ai/my-work (tab Calendar)  
**Stan:** czerwiec 2026, widok Monthly

**Opis:**  
Lewy panel: mini-kursor miesięczny z podświetloną datą 11. Sekcja SOURCES: Tasks (niebieski), Initiatives (pomarańczowy), Decisions (żółty), Consultify (różowy/malinowy). Google Calendar i Outlook — z opisem "Not connected" i wiadomością błędu.  
Główny widok: Kolumny MON–SUN. Zdarzenia: "RPA Implementation" (niebieski, pełna szerokość), "Cloud Migration Phase 2" (fioletowy), "Cybersecurity Enhancement Program" (fioletowy). "+4 more" / "+1 more" buttony przy przepełnionych dniach.  
Header view: Month | Week | Day | List.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Google Calendar i Outlook mają error panel w lewym panelu z tekstem "Not connected" + opis błędu widoczny od razu. Czy to ma być tak widoczne czy ukryte do momentu pierwszej konfiguracji?

---

## 7. Interview — Inbox

### VIS-014 — Interview — Inbox — Lista

**Screenshot ID:** ss_3915rd337  
**URL:** https://demo.consultify.ai/interview  
**Stan:** inbox z 5 elementami

**Opis:**  
Tabs: Inbox | Sessions | Assigned | Templates | Insights | Initiatives.  
Filtry: All 5 | Answered 2 | Approved 0 | Sent back 0.  
Kolumny: TEMPLATE ↕ | ASSIGNEE ↕ | STATUS ↕ | PROGRESS | DAYS TO DUE ↕  
Status badges:  
- "Submitted" — niebieska/tealowa kropka, ciemne tło  
- "Assigned" — szara kropka, ciemne tło  
Progress bar: zielony pasek na szarym tle, wartość "100%" lub "0%".  
Days to due: "41d overdue" (czerwona ikona zegara), "36d overdue", "28d overdue", "13d overdue" — wszystkie z czerwoną ikoną, "203d left" — szara ikona.  
Typ badge: "QUICK" (zielona mała kropka), "digital" (niebieska mała kropka), "custom" (pomarańczowa mała kropka).

**Czy coś jest obiektywnie złe?**  
NIE.

---

## 8. Interview — Insights

### VIS-015 — Interview — Insights — Lista

**Screenshot ID:** ss_7347ictw0  
**URL:** https://demo.consultify.ai/interview (tab Insights)  
**Stan:** lista 11 insightów

**Opis:**  
Filtry: All 11 | Ready 10 | Failed 1 | Published 0 | Archived.  
Kolumny: TITLE | CROSS-ROLE | TYPE ↕ | STATUS ↕ | SOURCE ↕ | EXPORTED TO ↕ | DATE  
Badges cross-role: "7 cross-role" (szarobłękitna ikona), "3 divergences" (czerwona ikona ostrzeżenia).  
Type badges: "Executive Summary" (fioletowe tło), "General Analysis" (ciemnoniebieskie tło).  
Status badges: "Completed" (zielona kropka).  
Source: "6 sessions", "2 sessions", "1 session".  
Tytuły: Część to debug/test nazwy ("DC Aggressive Test", "QA DEF-INT-03 Fixed", "Manual Test Insight").

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Widoczne są nazwy testowe ("QA UI Insight Submit", "QA Smoke General Analysis", "Manual Test Insight") — czy demo dane powinny zawierać takie nazwy?

---

### VIS-016 — Interview — Insights — Detail panel

**Screenshot ID:** zoom z ss_0690l7k7m  
**URL:** https://demo.consultify.ai/interview (Insights, panel otwarty)  
**Stan:** panel "DC Aggressive Test" otwarty

**Opis:**  
Badges w górnej sekcji: "Insight" (szary), "Summary" (biały border), "Completed" (zielony).  
"6 sessions | Created 36 days ago".  
Sekcja DETAILS: ~294 words | menu ···.  
Tytuł: "Executive Summary" — duże, białe.  
Sekcja AI: "Summarize insight" | "Suggest actions" — buttons.  
Sekcja "WHAT NEXT WITH THIS INSIGHT":  
- DOCUMENTS: "Report" (ciemny border), "Deck" (fioletowe tło)  
- "Table" (zielone tło)  
- IN APP: "Idea" (żółte/pomarańczowe tło), "Note" (ciemnoszare tło)  
- "Initiative" (ciemnoszare tło)

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Przyciski "WHAT NEXT" mają 3 różne kolory (fioletowy, zielony, żółty, ciemnoszary) — czy to zamierzone rozróżnienie semantyczne, czy przypadkowe?

---

## 9. Interview — Sessions

### VIS-017 — Interview — Sessions — Lista

**Screenshot ID:** ss_373409qas  
**URL:** https://demo.consultify.ai/interview (tab Sessions)  
**Stan:** 179 sesji

**Opis:**  
Filtry: All 179 | In progress 145 | Submitted 24 | Approved 10 | Active | Archive | Trash.  
Kolumny: NAME ↕ | ASSIGNEE ↕ | STATUS ↕  
Wszystkie widoczne nazwy to "Interview 5/1/2026" z datą. Kolumna Template pokazuje "Template: Szybki Wywiad ze Stakeholderem".  
Status: wszystkie "In Progress" (fioletowa/niebieska kropka).

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Wszystkie sesje mają ten sam tytuł "Interview 5/1/2026" — czy to jest poprawne dla demo danych, czy powinny mieć różne nazwy?

---

## 10. Interview — Templates

### VIS-018 — Interview — Templates — Lista

**Screenshot ID:** ss_2089ggn2o  
**URL:** https://demo.consultify.ai/interview (tab Templates)  
**Stan:** 15 szablonów (14 opublikowanych, 1 draft)

**Opis:**  
Filtry: All 15 | Draft 1 | In review 0 | Published 14 | Archived 2.  
Kolumny: NAME | CATEGORY ↕ | QUESTIONS | USAGE | STATUS ↕  
Category badges: "operational" (ciemnoniebieskie tło), "quick" (j.w.), "cost" (j.w.), "data" (j.w.), "commercial" (j.w.).  
Status badge "Published" — zielona kropka.  
Duplikaty: "DBR77 — How to Sell Better (Ideas)" pojawia się dwukrotnie, "DBR77 — Jak sprzedawać lepiej (pomysły)" dwukrotnie, "DBR77 — Marketing i promocja (pomysły)" dwukrotnie.

**Czy coś jest obiektywnie złe?**  
TAK — widoczne duplikaty szablonów (te same tytuły pojawiają się 2 razy). Pytania = 0 dla wielu szablonów commercial.

---

## 11. Initiatives Hub (`/initiatives`)

### VIS-019 — Initiatives — Kanban view

**Screenshot ID:** ss_7017g62gh  
**URL:** https://demo.consultify.ai/initiatives  
**Stan:** widok Kanban (Portfolio), wszystkie kolumny widoczne

**Opis:**  
Tabs nawigacyjne: "Portfolio" (aktywny, ciemny border, biały tekst) | "Analysis".  
Filter bar: ALL 20 | In Review 8 | Promoted 0 | Planning 6 | Approved 3 | Scheduled 3.  
Prawy filter: Active | All. Widok: lista | kanban | kalendarz | grid.  
Przycisk "New initiative" + badge "COMING SOON" (szary).  
Dodatkowe filtry: "AI Initiative Wizard COMING SOON" | "Charter COMING SOON".  
Kolumny Kanban: IN REVIEW | PROMOTED | PLANNING | APPROVED | SCHEDUL... (ucięta) + kolejna poza widokiem.  
"Drop initiatives here" — empty state w kolumnie PROMOTED.  
Karta inicjatywy: tytuł, badges (MEDIUM, On track / CRITICAL, On track), "PW Piotr Wiśniewski", "NEXT GATE" + wartość + rola.

**Czy coś jest obiektywnie złe?**  
TAK — "New initiative COMING SOON" — guzik jest całkowicie nieaktywny z watermark "COMING SOON". Użytkownik nie może tworzyć nowych inicjatyw.

**Do decyzji właściciela:**  
- Czy "COMING SOON" na "New initiative" jest zamierzone dla staging? Moduł Initiatives jest aktywny i ma dane, ale nowe nie mogą być tworzone.

---

### VIS-020 — Initiatives — Karty (zoom)

**Screenshot ID:** zoom z ss_7017g62gh  
**URL:** https://demo.consultify.ai/initiatives  
**Stan:** karta inicjatywy "Wave 1 Manual Gate Test..."

**Opis:**  
Karta: ciemnoniebieskie tło, zaokrąglone rogi (~8px). Tytuł "Wave 1 Manual Gate Test 2026-03-29 01:12" — biały, semi-bold. Badges: "MEDIUM" (ciemnoniebieskie tło, niebieski tekst) + "On track" (zielona kropka). "PW Piotr Wiśniewski" z inicjałem PW w kółku. "NEXT GATE" label (szary, small caps) + wartość "Promote to Initiatives" (biały, bold) + "Project Sponsor" (szary).

**Czy coś jest obiektywnie złe?**  
TAK — Tytuł inicjatywy zawiera timestamp "2026-03-29 01:12" — wygląda jak dane testowe/artefakt automatyczny.

---

### VIS-021 — Initiatives — Detail panel

**Screenshot ID:** zoom z ss_2642ei6pd  
**URL:** https://demo.consultify.ai/initiatives  
**Stan:** panel otwarty dla "Wave 1 Manual Gate Test..."

**Opis:**  
Badges górne: "Initiative" | "REVIEW" | "Progress: 0%" | "Axis: operational" | "Priority: MEDIUM".  
Created/Last modified daty.  
Sekcja DETAILS + opis.  
Sekcja FINANCIAL ANALYSIS: "Ratio Analysis", "Company Valuation", "Budget & Prediction", "Results & KPI reports" — linki z ikoną zewnętrznego linku (czerwona).  
Sekcja AI: "Next steps" | "Risks" | "Scope".  
Badge "Source: manual".  
Dolne akcje: "Chat C" | "Copy link" | "Finance" tag.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Linki FINANCIAL ANALYSIS (Ratio Analysis, Company Valuation etc.) — czerwone ikony zewnętrzne. Czy to są prawdziwe linki do istniejącej treści, czy placeholder?

---

## 12. Document Studio (`/document-studio`)

### VIS-022 — Document Studio — Formularz Generate

**Screenshot ID:** ss_3622ddikz  
**URL:** https://demo.consultify.ai/document-studio  
**Stan:** formularz pusty (Generate tab)

**Opis:**  
Header: "Consultify Document Studio" + podtytuł "AI Document Artifact Engine · Modes 1, 2, 3 · Word/PDF artifact runtime".  
Tabs: "Generate" (aktywny, z podkreśleniem) | "Plan template".  
Sekcja "Generate without template" — duży h2.  
Pola formularza:  
- "Use approved template (optional)" — dropdown "No template — Mode 1 (free generation)"  
- "Description *" — textarea z placeholder  
- "Title (optional)" — input z placeholder "Auto-derived from description if empty"  
- "Document type (optional)" — dropdown "Auto-detect from description"  
- "Language" — dropdown "Polish"  
- "Density" — dropdown "Standard (4–8 pages)"  
- "Goal" — dropdown "Inform"  
- "Audience (comma-separated)" — input  
- Checkbox "Refine outline with AI (optional)"  
Przycisk "Plan document" — fioletowe tło, prawy dolny róg.

**Czy coś jest obiektywnie złe?**  
NIE.

**Do decyzji właściciela:**  
- Dropdowny "Language", "Document type", "Density", "Goal" to natywne HTML `<select>` (nie customowe). Przy kliknięciu widoczne focus z czerwonym borderem (niespójne z resztą UI). Czy docelowo mają być customowe componenty?

---

### VIS-023 — Document Studio — Language dropdown (focus state)

**Screenshot ID:** ss_6470htpb4  
**URL:** https://demo.consultify.ai/document-studio  
**Stan:** focus na dropdown Language

**Opis:**  
Dropdown Language ma czerwony border przy focus (natywny `<select>`). Inne dropdowny (Document type, Density, Goal) mają strzałkę "∨" jako custom element ale i tak są native select.

**Czy coś jest obiektywnie złe?**  
TAK — Czerwony focus ring na native select wizualnie wygląda jak error state, nie focus state.

---

## 13. Settings (`/settings`)

### VIS-024 — Settings — Profile

**Screenshot ID:** ss_8837g9rmk  
**URL:** https://demo.consultify.ai/settings/profile  
**Stan:** załadowana strona Profile

**Opis:**  
Lewy panel: "SETTINGS" + "Personal preferences". Sekcje: MY SETTINGS (rozwinięta, items: Profile, Avatar & Photo, Email Signatures, Working Hours), WORK PREFERENCES (zwinięta ▸), AI & AUTOMATION (▸), NOTIFICATIONS (▸), SECURITY (▸), INTEGRATIONS (▸), DATA & PRIVACY (▸), APPEARANCE (▸), ADVANCED (▸).  
Aktywny item "Profile" ma czerwono-fioletowe tło i czerwony tekst.  
Prawy obszar: karta "Personal Information". Awatar placeholder (szary kółko z ikoną osoby). Nazwa wyświetlana: **"Piotr Testowy"** (nie "Piotr Wiśniewski") — to jest display name ustawiony w profilu. Email: piotr.wisniewski@dbr77.com.  
Przycisk "Save Changes" — fioletowy tło, ikona dyskietki.  
"PUBLIC PROFILE" i "PERSONAL INFORMATION" sekcje z polami.

**Czy coś jest obiektywnie złe?**  
NIE — "Piotr Testowy" to Display Name z bazy (może być celowy alias w demo).

**Do decyzji właściciela:**  
- Display Name "Piotr Testowy" dla konta właściciela — czy demo dane powinny mieć realistyczną nazwę?
- Nieaktywne sekcje (WORK PREFERENCES, AI & AUTOMATION...) są stylistycznie mniej widoczne (szare) — spójne.

---

### VIS-025 — Settings — Sidebar Menu

**Screenshot ID:** zoom z ss_0564nzg4e  
**URL:** https://demo.consultify.ai/settings/profile (WORK PREFERENCES rozwinięte)  
**Stan:** rozwinięta sekcja WORK PREFERENCES

**Opis:**  
Sekcja WORK PREFERENCES zawiera: Dashboard, Work Preferences, Regional, Language.  
Styl nagłówków sekcji: wszystkie caps, szary/muted tekst, ~11px.  
Items menu: ikona + tekst, szary/biały tekst.  
Aktywny item (Profile): tło ciemnofioletowe (#1a1040-podobne), tekst i ikona w kolorze pomarańczowo-czerwonym.

**Czy coś jest obiektywnie złe?**  
NIE.

---

## 14. Sidebar nawigacja

### VIS-026 — Sidebar — Ikony modułów (zoom)

**Screenshot ID:** zoom z ss_54225vqvg (lewa krawędź)  
**URL:** dowolny moduł  
**Stan:** sidebar widoczny, Chat aktywny

**Opis:**  
Sidebar ma stałą szerokość ~40px. Ikony są SVG, białe/szare. Aktywna ikona (Chat) ma czerwono-fioletowe/koralarowe tło pill (~32x32px), ikona biała.  
Ikony nieaktywne: brak tła, szary kolor.  
Brak etykiet tekstowych dla ikon (pure icon navigation).  
Dolna część sidebarr: ikony folderu, tarczy, koła zębatego, osoby+.  
Na dole: "DEMO @1b0ead22ff1f" — szary, mały tekst.

**Czy coś jest obiektywnie złe?**  
NIE — sidebar konsekwentnie ikoniczny.

**Do decyzji właściciela:**  
- Brak tooltipów widocznych podczas audytu (nie testowano hover na każdej ikonie). Czy tooltips są zaimplementowane?

---

## 15. Viewport 1280px

### VIS-027 — 1280px — Chat

**Screenshot ID:** ss_7493lnjh0  
**URL:** https://demo.consultify.ai/chat  
**Stan:** 1280×800

**Opis:**  
Layout identyczny jak 1440px. Brak overflow.

**Czy coś jest obiektywnie złe?**  
NIE.

---

### VIS-028 — 1280px — Initiatives Kanban — przycięta kolumna

**Screenshot ID:** ss_2962onx3u  
**URL:** https://demo.consultify.ai/initiatives  
**Stan:** 1280×800

**Opis:**  
Ostatnia widoczna kolumna to "APPROVED (3)". Kolumna "SCHEDULED" jest częściowo widoczna — tytuł "SCHEDUL..." ucięty, karty wypadają poza viewport. Brak poziomego paska przewijania widocznego w screenshocie.

**Czy coś jest obiektywnie złe?**  
TAK — Przy 1280px kanban nie mieści wszystkich kolumn. Nie wiadomo czy jest horizontal scroll. Kolumna jest faktycznie przycięta.

---

## Komponenty globalne

### VIS-029 — Crash Modal (patrz VIS-007)

Już opisany.

---

### VIS-030 — Status Badges — Kolekcja

Wszystkie widziane kolory statusów i priorytetów:

| Etykieta | Kolor tła (przybliżony) | Kolor tekstu |
|----------|------------------------|--------------|
| Open | Ciemnopomarańczowy ~#7c3010 | Biały |
| Approved | Ciemnozielony ~#14532d | Biały/zielony |
| Escalated | Ciemnożółty ~#78350f | Pomarańczowy |
| Completed | Tło strony + zielona kropka | Biały |
| Submitted | Tło strony + tealowa kropka | Biały |
| Assigned | Tło strony + szara kropka | Biały |
| In Progress | Tło strony + niebieska/fioletowa kropka | Biały |
| Published | Tło strony + zielona kropka | Biały |
| Failed | Brak bezpośrednio — czerwona kropka | Biały |
| Critical (priority) | Ciemnoczerwone ~#7f1d1d | Biały |
| High (priority) | Ciemnopomarańczowe ~#7c2d12 | Pomarańczowy |
| Medium (priority) | Ciemnonielbieski ~#1e3a5f | Niebieski |

**Do decyzji właściciela:**  
- Spójność badge'y "Status" (tylko kropka + tekst, brak tła) vs. badge'y "Priority" (tło + tekst) vs. badge'y "Type" (tło + tekst). Czy ta heterogeniczność jest zamierzona?

---

### VIS-031 — Loading State — Spinner

**Screenshot ID:** ss_3737phno3  
**URL:** https://demo.consultify.ai/ (initial load)  
**Stan:** ładowanie aplikacji

**Opis:**  
Centralny spinner: okrąg z przerwą (~24px), animowany obrót, kolor niebieskawoszary (~#6B7FC4-podobny). Tło: granatowe (#0b0f1a-podobne). Brak tekstu.

**Czy coś jest obiektywnie złe?**  
NIE.

---

## Logi Railway

### LOG-001 — React Crash #31 — My Work Inbox (KRYTYCZNY)

**Zapytanie:** POST /api/errors (zgłoszenie klienta)  
**Błąd:**  
```
[ClientError] App-level crash reported  
Minified React error #31 — object with keys {$$typeof, render, displayName}  
componentStack: PreviewRelations-Dqo_3cjK.js → TableWithPreviewLayout → MyWorkView
```  
**Wpływ:** WIDOCZNY — pełny crash UI przy kliknięciu na dowolny element Inbox.  
**Kiedy:** podczas testu modułu My Work, po kliknięciu na element listy.

---

### LOG-002 — 404 na /api/integrations — Calendar

**Zapytanie:** GET /api/integrations  
**Błąd:** `statusCode: 404, isError: true`  
**Wpływ:** niewidoczny bezpośrednio — Calendar ładuje się, ale integracje pokazują "Not connected" (może być spowodowane tym 404).

---

### LOG-003 — High DB query count — Calendar

**Zapytanie:** GET /api/v8/my-work/calendar/conflicts  
**Błąd:** `dbQueryCount: 53, dbQueryTime: 370ms`  
**Wpływ:** niewidoczny — Calendar ładuje się normalnie, ale 53 queries to potencjalny problem wydajności.

---

### LOG-004 — Schema gaps (non-critical)

**Zapytanie:** DB initialization  
**Błąd:** ~44 tabele brakujące w stagingowej DB (user_gdpr_consents, webhook_subscriptions, ai_system_prompts, billing_*, token_ledger, etc.)  
**Wpływ:** niewidoczny w UI podczas tego audytu. Serwer oznacza jako "non-critical".

---

## Podsumowanie Fazy 1

**Data:** 2026-06-12  
**Modułów przejrzanych:** 13 (Chat, My Work Inbox/Decisions/Notebook/Tasks/Calendar, Interview Inbox/Insights/Sessions/Templates, Initiatives, Document Studio, Settings)  
**Screenshotów wykonanych:** ~35  
**Obiektywnych błędów:** 7  
**Elementów do decyzji właściciela:** 22  
**Błędów w logach Railway:** 4 (1 krytyczny, 3 mniej pilne)

---

### Top 10 najciekawszych znalezisk (ranking)

1. **[P0-CRASH] My Work Inbox — klikalność = crash** — React error #31 w `PreviewRelations` sprawia, że KAŻDY klik na element inbox crashuje całą aplikację. Moduł Inbox jest de facto niedostępny w stagingu. (VIS-007 / LOG-001)

2. **[WAŻNY] Kanban Initiatives nie mieści kolumn przy 1280px** — Ostatnia kolumna "SCHEDULED" jest obcięta, brak widocznego horizontal scroll. Przy typowym laptopie użytkownik nie widzi wszystkich kolumn. (VIS-028)

3. **[WAŻNY] "New initiative" — przycisk całkowicie nieaktywny (COMING SOON)** — Użytkownik w module Initiatives nie może stworzyć nowej inicjatywy. Podstawowa akcja modułu zablokowana. (VIS-019)

4. **[UI] Czerwony focus ring na native select = wygląda jak error** — W Document Studio każdy dropdown (Language, Density, Goal) przy focus ma czerwony border — identyczny jak error state. Dezorientujący wzorzec. (VIS-023)

5. **[UI] Type badges w Decisions są obcinane** — "APPR...", "STRA..." — nie widać pełnych wartości. Brak tooltipa lub rozwijania. (VIS-008)

6. **[DECYZJA DESIGN] Czerwień = "Auto" tab + "Stop" + focus + error** — Ten sam czerwono-pomarańczowy kolor (#E55B4D-podobny) jest używany dla: aktywnego taba OUTPUT, przycisku Stop, focus ringu inputu, aktywnego item w Settings sidebar. Semantyczna przeciążenie jednego koloru. (VIS-001, VIS-002, VIS-024)

7. **[DATA] Tytuły inicjatyw zawierają timestamps** — "Wave 1 Manual Gate Test 2026-03-29 01:12" — ewidentne artefakty testowe w demo danych widoczne dla właściciela/klientów. (VIS-020)

8. **[DATA] Duplikaty szablonów w Interview Templates** — Te same szablony (np. "DBR77 — How to Sell Better") pojawiają się dwukrotnie. 0 pytań w kilku szablonach "commercial". (VIS-018)

9. **[DECYZJA] Odpowiedź Teresy bez bubble, wiadomość user z bubble** — Asymetryczny wzorzec chatu. Może być zamierzony (AI content "wypływa" bez opakowania), ale niespójny z większością chat UI. (VIS-004)

10. **[DECYZJA] Calendar — "Not connected" błędy widoczne od razu** — Google Calendar i Outlook pokazują panel błędu "Not connected" bez żadnej konfiguracji. Może demotywować użytkowników którzy nie zamierzają integrować kalendarzy. (VIS-013)

# Visual Audit Procedure V1 — Consultify Staging
**Przeznaczenie:** Procedura dla autonomicznego agenta AI. Uruchom jednorazowo, overnight.  
**Cel:** Sfotografować każdy moduł w każdym stanie, skatalogować wszystkie nieprawidłowości wizualne, wygenerować gotowy do naprawy raport z priorytetami.

---

## Środowisko

```
URL:       https://demo.consultify.ai
Login:     piotr.wisniewski@dbr77.com
Hasło:     (odczytaj z .env.staging.secrets → STAGING_ADMIN_PASSWORD)
Rola:      OWNER organizacji DBR77
Dark mode: domyślny (ciemny)
Viewport:  1440×900 (desktop)
```

**Narzędzia:**
- Przeglądarka Chrome (MCP tool: `mcp__Claude_in_Chrome__computer`)
- Railway logs (CLI: `railway logs --environment staging -n 30`)
- Do zdjęć: `mcp__Claude_in_Chrome__computer` → `screenshot`

---

## Co szukasz (definicja "nieprawidłowości wizualnej")

Każdy z poniższych symptomów jest osobnym znaleziskiem:

| Kategoria | Przykłady problemów |
|-----------|---------------------|
| **TYP** | Dwa różne rozmiary fontu dla "nagłówka sekcji" w tym samym widoku |
| **KOLOR** | Tekst nieczytelny na tle (kontrast <4.5:1), różne odcienie "primary" w tym samym widoku |
| **SPACING** | Przyciski/ikony nierówno odstępy, karta wychodząca poza grid |
| **STAN** | Brak stanu hover/disabled/focus na interaktywnym elemencie |
| **EMPTY STATE** | Pusta lista bez ilustracji/opisu ("tu nic nie ma" bez kontekstu) |
| **LOADING** | Spinner zamiast skeleton, lub odwrotnie — niespójność |
| **ERROR STATE** | Brak komunikatu błędu lub techniczny błąd pokazany użytkownikowi |
| **OVERFLOW** | Tekst przycięty, tooltip nie mieści się, tabela wychodzi poza layout |
| **ALIGNMENT** | Elementy nierówno wyrównane w kolumnie/wierszu |
| **IKONA** | Nieodpowiednia ikona do funkcji, brakująca ikona |
| **RESPONSYWNOŚĆ** | Przy 1280px layout się psuje (viewport zmień do 1280) |
| **DARK MODE** | Element niewidoczny na ciemnym tle (biały tekst na białym tle etc.) |
| **BETA BADGE** | Moduł "Coming Soon" blokuje funkcję, która powinna działać |
| **KONSYSTENCJA** | Ten sam komponent wygląda inaczej w dwóch modułach |

---

## Format raportowania znalezisk

Każde znalezisko zapisz w tej strukturze:

```
### VIS-[numer] [Moduł] — [Krótki opis problemu]
**Priorytet:** P0 / P1 / P2
**URL:** https://demo.consultify.ai/...
**Kategoria:** TYP / KOLOR / SPACING / STAN / itd.
**Opis:** Co konkretnie jest źle i gdzie.
**Screenshot ID:** (ID ze zdjęcia)
**Sugestia naprawy:** Co zmienić (komponent, klasa Tailwind, wartość).
```

**Priorytety:**
- **P0** — Blokuje użycie funkcji lub jest nieczytelne (kontrast, overflow ukrywający treść)
- **P1** — Widoczna niespójność, złe pierwsze wrażenie (mismatched fonts, brakujące stany)  
- **P2** — Drobna niezgodność estetyczna (piksel spacing, marginesy)

---

## Moduły do audytu — lista z URL-ami i stanami

Dla każdego modułu: (1) otwórz URL, (2) zrób screenshot bazowy, (3) sprawdź każdy stan, (4) zrób screenshot każdego problemu, (5) zapisz znaleziska.

### M01 — AI Chat (`/chat`)
**Stany do sprawdzenia:**
- [ ] Pusty chat (nowa rozmowa) — czy empty state jest czytelny?
- [ ] Czat z odpowiedzią Teresy — czy bubbles wyglądają OK?
- [ ] Chat z "2 sources" badge — czy badge jest poprawnie wyrównany?
- [ ] Loading state (podczas generowania) — spinner/animacja?
- [ ] Błąd odpowiedzi — czy jest komunikat błędu?
- [ ] OUTPUT tabs: Auto / Documents / Tables / Presentations — czy aktywny tab jest wyróżniony?
- [ ] Historia rozmów (sidebar history) — czy lista scrolluje się poprawnie?
- [ ] Sidebar zwężony/rozszerzony — czy layout się nie psuje?

### M02 — Dashboard / Analytics (`/dashboard` lub ikona w sidebarze)
**Stany do sprawdzenia:**
- [ ] Strona główna dashboardu — czy karty są wyrównane?
- [ ] Wykres/chart — czy labels się nie nakładają?
- [ ] Empty state (brak danych) — czy widoczny?

### M03 — Decisions (`/my-work?tab=decisions` lub Decisions tab)
**Stany do sprawdzenia:**
- [ ] Lista decyzji — tabela, kolumny, statusy (Open/Approved/Escalated)
- [ ] Detail panel (klik na decyzję) — czy panel wysuwa się poprawnie?
- [ ] AI tabs w detail: "Summarize context" / "Propose options" / "Assess risk" — wyrównanie
- [ ] Przyciski akcji: Approve/Reject/Delegate/Escalate — hover states
- [ ] Filter chips (Priority: all, Status filter) — aktywny stan wyróżniony?
- [ ] Empty state (brak decyzji)

### M04 — Notebook (`/my-work?tab=notebook`)
**Stany do sprawdzenia:**
- [ ] Lista notebooków — NOTEBOOK / TYPE / CONTEXT / NOTES / UPDATED kolumny
- [ ] Otwarcie notebooka — panel list + editor
- [ ] Notatka otwarta — toolbar edytora (bold/italic/code/etc) — czy ikony widoczne?
- [ ] CANONICAL NOTEBOOK PATH — 4 kroki wizualnie
- [ ] SEND TO: Radar / Initiatives — przyciski
- [ ] Tags — czy tag chips wyglądają OK?
- [ ] VERIFICATION badge (Verified/Not verified) — kolor?
- [ ] Empty state notatnika ("No pages yet" + Living Notebook template cards)
- [ ] Template cards (Blank page / Strategic observation / Risk analysis / Meeting notes)

### M05 — Interview Inbox (`/interview`)
**Stany do sprawdzenia:**
- [ ] Inbox lista — TEMPLATE / ASSIGNEE / STATUS / PROGRESS / DAYS TO DUE
- [ ] Status badges: Submitted/Assigned/Open — kolory
- [ ] Progress bar — czy 100% vs 0% wizualnie OK?
- [ ] Overdue badge — kolor czerwony widoczny?
- [ ] Grid vs List view toggle — czy działają oba widoki?

### M06 — Interview Sessions (`/interview?tab=sessions`)
**Stany do sprawdzenia:**
- [ ] Lista sesji — czy kolumny wyrównane?
- [ ] Sesja "Submitted" — status chip
- [ ] Przycisk "Assign" — hover state

### M07 — Process Flow (My Work → Ideas → Process Flow Tool)
**Stany:**
- [ ] Canvas z węzłami — czy węzły mają poprawne etykiety?
- [ ] Połączenia między węzłami — strzałki widoczne?
- [ ] Tryb connect/view — czy cursor się zmienia?

### M08 — Table Tool (My Work → Ideas → Table)  
**Stany:**
- [ ] Tabela z danymi — headers, rows
- [ ] Pusta tabela — empty state
- [ ] Toolbar tabeli — ikony edycji
- [ ] Audit trail panel (jeśli dostępny)

### M09 — Meeting Intelligence (`/meetings` lub sidebar)
**Stany:**
- [ ] Lista spotkań
- [ ] Detail spotkania z transkryptem
- [ ] AI insights panel

### M10 — Insights (`/interview?tab=insights`)
**Stany do sprawdzenia:**
- [ ] Lista insightów — TITLE / CROSS-ROLE / TYPE / STATUS / SOURCE / EXPORTED TO
- [ ] Cross-role badges (7 cross-role, 3 divergences) — czy wyrównane?
- [ ] Status chips: Completed / Failed — kolory
- [ ] Detail panel — Executive Summary tekst
- [ ] AI tabs: "Summarize insight" / "Suggest actions"
- [ ] "What next" sekcja: Documents/Table/Idea/Note/Initiative — ikony

### M11 — Interview Templates (`/interview?tab=templates`)
**Stany:**
- [ ] Lista szablonów
- [ ] Kategorie/tagi szablonów
- [ ] Preview szablonu

### M12 — Interview Initiatives (`/interview?tab=initiatives`)
**Stany:**
- [ ] Lista inicjatyw z Interview
- [ ] Statusy

### M13 — Initiatives Hub (`/initiatives`)
**Stany do sprawdzenia:**
- [ ] Kanban view — kolumny: In Review / Promoted / Planning / Approved / Scheduled
- [ ] Karta inicjatywy — tytuł, priority badge, owner avatar, NEXT GATE
- [ ] Karta w stanie "CRITICAL" vs "MEDIUM" vs "HIGH" — kolory badge
- [ ] "On track" vs "Overdue" badge — kolory
- [ ] Detail panel (klik na kartę)
- [ ] Detail: FINANCIAL ANALYSIS sekcja (Ratio Analysis etc.) — ikony
- [ ] Detail: AI tabs (Next steps / Risks / Scope)
- [ ] Detail: Chat / Copy link buttons
- [ ] List view vs Card view toggle
- [ ] Filter bar: V8 snapshot / V8 WBS / V8 critical path — czy "ready/complete/0" czytelne?
- [ ] "New initiative — COMING SOON" button — czy badge styling konsekwentny?
- [ ] "Charter — COMING SOON" — to samo
- [ ] Analysis tab (górny tab)

### M14 — KPI / Analytics (sidebar icon)
**Stany:**
- [ ] Dashboard KPI
- [ ] Wykresy/charts — labele
- [ ] Filter controls

### M15 — Survey (sidebar icon kompas?)
**Stany:**
- [ ] Lista ankiet
- [ ] Widok ankiety w toku

### M16 — Clients / Organizations (settings / admin)
**Stany:**
- [ ] Lista klientów/org
- [ ] Detail organizacji

### M17 — Settings (`/settings`)
**Stany do sprawdzenia:**
- [ ] Strona settings — navigation items
- [ ] Profile settings
- [ ] Notifications
- [ ] Appearance/Theme (jeśli jest)
- [ ] Integrations

### M18 — Wave5 / AI Artifacts (chat → OUTPUT → Documents/Tables/Presentations)
**Stany:**
- [ ] Document Studio form (pusta)
- [ ] Document outline wygenerowany
- [ ] Dokument z ASSUMPTION — NEEDS SOURCE markers — styling
- [ ] Export bar: Markdown / DOCX / PDF — przyciski
- [ ] History / QA / Override allowed badges w document view
- [ ] Share button
- [ ] AI Editor button
- [ ] Outline sidebar (lewa kolumna)

### M19 — Document Studio artifact view (`/document-studio/[id]`)
**Stany:**
- [ ] Section headers wyrównane
- [ ] ASSUMPTION badges — kolor/kontrast
- [ ] Sekcja z treścią vs z placeholder — wizualna różnica

### M20 — Table Studio (chat → OUTPUT → Tables)
**Stany:**
- [ ] Formularz Table Studio
- [ ] Wygenerowana tabela

### M21 — Presentation Studio (chat → OUTPUT → Presentations)
**Stany:**
- [ ] Formularz Presentation Studio
- [ ] Slajdy

### M22 — Wave5 Artifacts panel (chat z artifacts)
**Stany:**
- [ ] Panel artifacts — czy wyświetla się poprawnie?
- [ ] Error gate (jeśli ENABLE_V8_GLOBAL=false) — czy gate screen wygląda OK?

### M23 — Admin Settings (`/admin` lub Settings → Admin)
**Stany:**
- [ ] Admin dashboard
- [ ] User management panel

### M24 — Superadmin (jeśli dostępny)
**Stany:**
- [ ] Panel superadmin

### M25 — Deliverables Hub / Outputs
**Stany:**
- [ ] Document Studio strona główna (`/document-studio`)
- [ ] Plan template tab
- [ ] Dostępne szablony

### M26 — Partner / B2B panel
**Stany:**
- [ ] Panel partnerski (jeśli dostępny dla OWNER)

### M27 — Help / Support
**Stany:**
- [ ] Help Center overlay
- [ ] Dokumenty pomocy

---

## Komponenty globalne — sprawdź w każdym module

Poniższe elementy pojawiają się wszędzie — sprawdź ich konsystencję:

### Sidebar nawigacja (lewy panel)
- [ ] Aktywna ikona — kolor wyróżnienia
- [ ] Ikona hover state
- [ ] Badge licznika (np. "15" na avatarze) — pozycja, kolor
- [ ] "DEMO @id" badge w lewym dolnym rogu — czy nie zasłania czegoś
- [ ] Collapsed vs expanded sidebar

### Top bar
- [ ] "Data / Model" switcher — styling
- [ ] User avatar (PW) — rozmiar, pozycja
- [ ] Notification icon z licznikiem

### Teresa sidebar (lewa kolumna gdy otwarta)
- [ ] "TERESA" chip — kolor, font
- [ ] Quick prompt chips (Summarize this note / Extract action items)
- [ ] Textarea input — placeholder, borders

### Tabele danych (pattern ogólny)
- [ ] Header row — font weight, background
- [ ] Hover row — kolor hover
- [ ] Checkbox select — wyrównanie
- [ ] Sort indicator — widoczność
- [ ] Filtr dropdown — styling
- [ ] Pagination / infinite scroll — wskaźnik

### Modalne / dialogi
- [ ] Backdrop (overlay ciemny) — krycie
- [ ] Modal container — shadow, border radius
- [ ] Zamknij X — pozycja, rozmiar
- [ ] Przyciski w modalu — primary/secondary styling

### Toasty (powiadomienia)
- [ ] Success toast — kolor zielony, ikona
- [ ] Error toast — kolor czerwony
- [ ] Pozycja ekranu — prawy dolny róg vs górny

### Statusy / badges
- [ ] Open — kolor
- [ ] Completed — kolor
- [ ] Failed — kolor
- [ ] In Review / Approved / Escalated — kolory
- [ ] Critical / High / Medium / Low — kolory priority
- [ ] COMING SOON — kolor/styling

### Przyciski (CTA)
- [ ] Primary button (np. "New initiative") — gradient/kolor/hover
- [ ] Secondary button — outline/fill
- [ ] Destructive button (czerwony) — hover
- [ ] Disabled state — opacity
- [ ] Loading state (spinner w buttonie)

---

## Procedura uruchomienia — krok po kroku

```
1. Zaloguj się na https://demo.consultify.ai
   - Login: piotr.wisniewski@dbr77.com
   - Hasło: z .env.staging.secrets (STAGING_ADMIN_PASSWORD)
   - Potwierdź że jesteś na OWNER DBR77 (badge w lewym dolnym rogu)

2. Dla każdego modułu z listy powyżej:
   a. Otwórz URL lub nawiguj do modułu przez sidebar
   b. Zrób screenshot stanu bazowego
   c. Sprawdź każdy stan z checklisty
   d. Zrób screenshot każdego podejrzanego elementu
   e. Zapisz znalezisko w formacie VIS-[n]

3. Sprawdź widok przy 1280px viewport (browser resize)
   - Które moduły się psują? (overflow, wrap, collapse)
   
4. Sprawdź komponenty globalne (tabele, modalne, toasty)
   - Zrób co najmniej 1 toast success i 1 toast error (np. zapisz coś / wywołaj błąd)

5. Na końcu wygeneruj podsumowanie:
   - Liczba znalezisk per moduł
   - Lista P0 (blokujące)
   - Lista P1 (istotne)
   - Lista P2 (drobne)
   - Top 10 najpoważniejszych z sugestiami naprawy
```

---

## Plik wyjściowy

Zapisz wszystkie znaleziska w:
```
docs/qa/runs/[YYYY-MM-DD]/VISUAL_AUDIT_RESULTS.md
```

Struktura pliku:
```markdown
# Visual Audit Results — [data]
**Agent:** [ID agenta]
**Środowisko:** demo.consultify.ai
**Commit Londyn:** [git rev-parse HEAD na staging]

## Podsumowanie
- Łączna liczba znalezisk: X
- P0: X | P1: X | P2: X

## P0 — Blokujące
[lista VIS-nn]

## P1 — Istotne  
[lista VIS-nn]

## P2 — Drobne
[lista VIS-nn]

## Szczegóły znalezisk
[pełne opisy z formatem VIS-nn]
```

---

## Wskazówki dla agenta

- **Nie naprawiaj** niczego — tylko dokumentuj. Naprawki to Sprint 5+.
- **Zrób screenshot przed i po** każdym stanie zmienionym przez Ciebie (klik, hover).
- Jeśli coś nie ładuje się przez 10s — **zaloguj błąd jako VIS-nn (Error State)** i idź dalej.
- Jeśli widzisz "COMING SOON" — **zanotuj jako informację**, nie jako błąd (to funkcja beta gate).
- Przy logach Railway: `railway logs --environment staging -n 30` po każdym module sprawdź czy nie ma error/500.
- Dla hover states: użyj `mcp__Claude_in_Chrome__computer` z `hover` action.
- Dla viewport 1280: użyj `mcp__Claude_in_Chrome__resize_window`.
- Screenshoty zapisuj z ID do późniejszego referencjonowania w znaleziskach.

---

*Procedura wersja 1.0 — 2026-06-11 — CTO Piotr Wiśniewski*

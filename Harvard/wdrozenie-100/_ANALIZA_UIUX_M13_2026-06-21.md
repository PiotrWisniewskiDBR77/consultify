# Analiza graficzna M13 Inicjatywy przeciw 5 zasadom Piotra

> Data: 2026-06-21 · Branch: feat/deliverables-w1 → demo · Autor: CTO (Claude)
> Materiał: 38 screenshotów z `docs/qa/screens/m13-2026-06-21/` (Playwright, headless 1680×1050, sesja write-access non-demo) + odczyt kodu.
> Charakter: analiza wizualna oparta na realnych zrzutach + kod. Zero zmian w kodzie aplikacji w tym dokumencie.

---

## 1. Streszczenie

Powierzchnia M13 jest **funkcjonalnie kompletna i wizualnie spójna z resztą platformy** (ciemny motyw navy, lewy sidebar ikon, górny pasek z trybami AI Data/Model, pływające przyciski Help/Feedback). Dokument inicjatywy to dojrzały, gęsty obiekt: **26 nawigowalnych sekcji** pogrupowanych (Treść / Governance / Zespół / Załączniki), z lewą nawigacją w stylu Notion i kanwą sekcji po prawej. Pełne obejście wszystkich sekcji → **zero error-boundary** (s11-no-error-boundary).

Są jednak **3 realne problemy wizualno-UX** wykryte na zrzutach, w tym jeden **istotny** (P1) dotykający pierwszego wrażenia użytkownika, oraz **2 luki dowodowe** (light-mode i modale wizardów) wymagające domknięcia.

**Najważniejsze ustalenie (P1):** na domyślnej tablicy **Kanban hub pokazuje 10 utworzonych inicjatyw jako PUSTE kolumny** (s3-2-ai-wizard: licznik `ALL 10`, a kolumny IN REVIEW/PROMOTED/PLANNING/APPROVED/SCHEDULED wszystkie `0`, „Drop initiatives here"). Świeżo utworzona inicjatywa (status DRAFT/`null`) **nie ma kolumny i znika z tablicy** — użytkownik tworzy inicjatywę i widzi pustą tablicę → „gdzie ona jest?". To psuje pętlę tworzenia.

---

## 2. Macierz 5 zasad × powierzchnie M13

Legenda: ✅ spełnia · 🟡 częściowo · ❌ luka · 🔍 wymaga weryfikacji live

| Zasada | Hub (lista/kanban) | Dokument inicjatywy | Wizardy (Charter/AI) | Portfolio views | ROI/Ekonomika |
|---|---|---|---|---|---|
| **1. Spójność (shell / wzorzec)** | ✅ | ✅ | 🔍 | ✅ | 🟡 |
| **2. Metody jak u konkurencji (Kanban DnD / Gantt / Kalendarz)** | 🟡 (DRAFT znika) | ✅ | 🔍 | 🟡 | 🟡 |
| **3. Sterowanie Teresą (AI)** | ✅ (AI Wizard CTA) | ✅ (AI-fill sekcji) | 🔍 | n/d | n/d |
| **4. Praca na kontekście organizacji** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **5. Lekki UI (tokeny / budżet czerwieni / czytelność light)** | 🟡 | ✅ | 🔍 | 🟡 | 🟡 |

---

## 3. Ustalenia per powierzchnia (z dowodem-zrzutem)

### 3.1 Hub — Kanban (s1a-hub-cta, s3-2-ai-wizard) — **P1**
- **DRAFT/utworzone znikają z Kanban.** `ALL 10`, wszystkie kolumny `0`. Maszyna stanów M13 ma 13 statusów; tablica eksponuje tylko 5 (review→scheduled). DRAFT i pewne stany pośrednie nie mają kolumny → po utworzeniu inicjatywa jest niewidoczna na domyślnym widoku. **Rekomendacja:** dodać kolumnę DRAFT/„Szkice" na początku tablicy LUB domyślnie lądować na widoku Lista (gdzie wszystkie są widoczne), nie Kanban. Pilne — to pierwsze wrażenie.
- **CTA tworzenia OK** (zasada §1a manualnego): „AI Initiative Wizard", „Charter", „New initiative" widoczne i klikalne.
- **Budżet czerwieni — kandydat:** pigułka **„Model"** (prawy-górny, czerwona kropka + ramka) to jedyny mocny czerwony akcent na ekranie. Do sprawdzenia czy to token statusu czy leak — reszta UI trzyma navy/biały/niebieski focus. Help/Feedback floating = bursztyn (OK, nie czerwień).

### 3.2 Dokument inicjatywy (s2-section-00..25, 26 sekcji) — **mocny**
- **Lewa nawigacja**: czytelna, pogrupowana, ikony + drag-handle (reorder), aktywna sekcja podświetlona primary. Wzorzec Notion — spójny z M03/M04.
- **Kanwa sekcji**: nagłówek + treść; sekcje z danymi (Description & Context — PROBLEM/PROPOSED SOLUTION/COST OF INACTION) renderują się czysto (s2-section-00).
- **Empty-state**: sekcje bez danych (KPIs, Financial, Resources w tym seedzie) pokazują pustą kanwę — spójne, ale **nie zweryfikowano gęstej treści** (patrz §5 — ograniczenie seeda).

### 3.3 Wizardy Charter / AI (s3-1, s3-2) — **🔍 luka dowodowa**
- Klik „Charter" i „AI Initiative Wizard" w headless **nie pokazał modala na zrzucie** (oba zrzuty pokazują hub, nie modal). Możliwe: (a) modal renderuje się poza viewportem/z opóźnieniem, (b) realny bug otwierania. **Wymaga weryfikacji live** (computer-use / prawdziwa przeglądarka) — NIE potwierdzać jako działające bez tego.

### 3.4 Portfolio views (s5-1) — przełączniki list/kanban/kalendarz/grid + ROI + Active/All obecne; lista renderuje się. DnD Kanban i drag Gantt/Kalendarz dodane kodowo (W5 + ten commit) — wizualnie do potwierdzenia live.

### 3.5 ROI/Ekonomika (s6-1) — nawigacja wpięta; gęstość danych do oceny na bogatszym seedzie.

---

## 4. Lista naprawcza (priorytet)

| # | Priorytet | Problem | Plik/obszar | Akcja |
|---|---|---|---|---|
| 1 | ~~P1~~ ✅ **NAPRAWIONE** | ~~Utworzone/DRAFT inicjatywy niewidoczne na Kanban~~ | `utils/initiativeHelpers.ts` ACTIVE_STATUSES | **ZROBIONE `973138a3a3`**: DRAFT+PENDING_REVIEW na początku ACTIVE_STATUSES → kolumna „DRAFT" z kartami widoczna (dowód: s1a-P1-draft-visible-kanban.png, 6 kart). 17/17 manual green |
| 2 | **P2 🔍** | Modale Charter/AI Wizard nie potwierdzone (brak na zrzucie) | `InitiativesHub.tsx` wizard triggers | Weryfikacja live; jeśli realny bug otwierania — naprawić |
| 3 | ~~P3~~ ✅ **ZROBIONE** | Light-mode dograny — motyw to Zustand store `consultify-storage` (nie localStorage); `forceTheme` pre-seeduje store | s11-light-hub.png — białe tło, czytelny; jedyna uwaga: czerwona pigułka „Model" bardziej widoczna w light (→ item P4 budżet czerwieni) |
| 4 | **P3** | Czerwona pigułka „Model" — sprawdzić budżet czerwieni | górny pasek AI-mode | Potwierdzić czy token statusu; jeśli dekoracyjna czerwień → stonować |
| 5 | **P3** | Gęsta treść sekcji niezweryfikowana (empty-state seed) | spec seed | Wzbogacić seed (taski/KPI/decyzje/finanse) → re-capture sekcji |

---

## 5. Uczciwy zakres i ograniczenia

- **Seed wzbogacony (update 2026-06-22).** Po dodaniu `seedTasks` (3 taski z datami) **Timeline renderuje pełną tabelę** — Initiative Start + 3 taski (Analiza/Projekt/Wdrożenie) + Initiative Finish, kolumny START/END/STATUS, toggle Kalendarz/Gantt (s2-section-02-timeline). Tasks/Gantt/Kalendarz mają teraz realną treść = ocena gęstej treści dla osi czasu WIARYGODNA. Pozostałe sekcje bez własnego seeda (KPIs/Financial/Resources/Team) nadal empty-state — wymagałyby seeda per-sekcja (osobny follow-up, niższy priorytet).
- **Light-mode nie uchwycony.** App domyślnie startuje w dark; `setDark(false)` w teście nie dał czystego light (s11-dark-document ≈ sekcje). Light-mode wymaga osobnego przejścia.
- **Wizardy nie potwierdzone** (patrz 3.3).
- **Headless ≠ live.** Zgodnie z zasadą „verify-before-claiming": to analiza zrzutów headless; bramka **→UI** (odbiór graficzny przez Piotra) pozostaje otwarta. Ten dokument = wsad do →UI, nie jego zamknięcie.

---

## 6. Werdykt

M13 jest wizualnie **dojrzałe i spójne** — dokument 26-sekcyjny bez błędów, shell zgodny z platformą. Do domknięcia bramki →UI: **napraw P1 (DRAFT znika z Kanban)**, potwierdź modale wizardów live, dograj light-mode i bogatszy seed. Żaden z problemów nie jest blokerem architektonicznym — to szlif pierwszego wrażenia + dowody.

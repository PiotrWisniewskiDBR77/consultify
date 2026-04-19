# Moduł Feedback i Backlog realizacji w Super Admin — opis produktowy

**Wersja dokumentu:** 1.0 (2026-04-19)  
**Kontekst:** Consultify / platforma z panelem Super Admin  
**Cel:** opis funkcjonalności do przeniesienia lub spójnego zaprojektowania analogicznego modułu w innych produktach firmy.

---

## 1. Po co jest ten moduł

Moduł zamienia **zgłoszenia użytkowników** (błędy, pomysły, prośby o funkcje, krótkie oceny „pulse”) w **operacyjny pipeline**: każda wiadomość jest traktowana jak **jednostka pracy** ze statusem, właścicielem, śladem wdrożenia i możliwością powiązania z zadaniami realizacji (backlogiem), a nie jak „zgubiona wiadomość w skrzynce”.

Dla zespołu produktowo‑technicznego odpowiada na pytania:

- Co jest **krytyczne na produkcji**?
- Co jest **nieprzypisane**?
- Co **czeka na weryfikację** użytkownika?
- Co **leży zbyt długo w statusie NEW**?
- Jak wygląda **objętość i czas reakcji** (MTTR, aging)?

Szczegółowy kontrakt techniczny API, model metadanych i historia wersji pipeline’u są utrzymywane w dokumencie źródłowym: [`SUPERADMIN_FEEDBACK_PIPELINE.md`](./SUPERADMIN_FEEDBACK_PIPELINE.md).

---

## 2. Gdzie w produkcie to się znajduje

### 2.1 Nawigacja wysokiego poziomu

- Aplikacja: **Super Admin Console** (sekcja sidebaru typu *Tenant & User Ops* / odpowiednik „Customers”).
- W module **Customers** (zarządzanie tenantami i operacjami na użytkownikach) dostępne są **trzy powiązane zakładki**:
  1. **Feedback** — pełny rejestr zgłoszeń i praca operacyjna na pojedynczym tickecie.
  2. **Backlog** — lista **zadań utworzonych automatycznie** z ticketów feedbacku (implementacja).
  3. **Feedback Analytics** — dashboard KPI (read‑only).

### 2.2 Routing (skrót)

- Główna ścieżka widoku feedbacku w aplikacji hashowej jest spójna z konfiguracją tras (np. `/superadmin/customers/feedback` — szczegół w `routeConfig`).
- **Deep link** do konkretnego zgłoszenia: parametr zapytania `feedbackId=<uuid>` — po wejściu szczegóły ticketa otwierają się automatycznie (np. z centrum sygnałów Super Admin).

---

## 3. Jak użytkownik końcowy dostarcza dane (wejścia)

Te elementy nie są „w środku Super Admin”, ale zasilają ten sam backend i ten sam rejestr.

| Kanał | Opis |
| --- | --- |
| **Formularz zgłoszenia (BUG / IDEA)** | Wysyłka na endpoint tworzący rekord w `feedback_items`; może zawierać bogaty **dossier** diagnostyczny (logi konsoli, sieć, breadcrumbs, kontekst aplikacji, hash sygnatury duplikatu, opcjonalnie screenshot). |
| **Pulse** | Szybka ocena (np. 1–5) wraz z kontekstem ścieżki — osobna ścieżka zapisu (`feedback_pulse`) z możliwością eskalacji do kanałów operacyjnych. |
| **Feature request** | Dedykowany endpoint pod prośby o funkcje (kategoria, wpływ, itd.). |
| **AI compose** | Opcjonalne wsparcie LLM do ustrukturyzowania treści zgłoszenia przed wysłaniem (ścieżka `/feedback/compose`). |

**Globalny skrót / przycisk:** w layoucie aplikacji może być dostępny pływający przycisk zgłoszenia oraz skrót klawiszowy; widok Super Admin jest z projektu wyłączony z tego entry pointu (admin i tak korzysta z panelu).

**Ochrona:** na endpointy zgłoszeń nałożone są **limity częstotliwości** (rate limiting), żeby nie zalać kolejki ani nie umożliwić nadużyć.

---

## 4. Zakładka „Feedback” — rejestr i operacje

### 4.1 Lista zgłoszeń

- Pobieranie listy z paginacją (nagłówki typu `X-Total-Count` umożliwiają pokazanie „załadowano X z Y” i dociąganie kolejnych stron).
- **Widoki:** tablica (board) lub lista — do preferencji operatora.
- **Filtry:** status, typ (BUG / IDEA / FEATURE / PULSE), severity, środowisko (`source_env`), przypisanie właściciela workflow (przypisany / nieprzypisany), wyszukiwarka po tytule, treści, mailu, ID, ownerze, klastrze.

### 4.2 Statusy życia zgłoszenia

Logiczny przepływ obejmuje m.in.: `NEW` → `PENDING` → `IN_PROGRESS` → `REVIEWED` → `RESOLVED` → `ARCHIVED` (dokładna semantyka jest utrwelona w UI i API).

### 4.3 Wskaźniki „na pierwszy rzut oka” (pipeline stats)

Panel liczy m.in.:

- zgłoszenia **krytyczne na production**,
- liczbę **nieprzypisanych** (brak `workflow.owner`),
- zgłoszenia w **REVIEWED** (np. oczekujące na domknięcie),
- zgłoszenia w **NEW dłużej niż 24 h** („stale”).

### 4.4 Badges triage na liście

Na kartach widać m.in.:

- liczbę **powiązanych duplikatów** (klaster sygnatury),
- obecność **screenshota** i **diagnostyki** (logi / sieć / breadcrumbs).

### 4.5 Szczegół zgłoszenia (drawer / panel)

Po wybraniu rekordu operator widzi m.in.:

- pełną treść, metadane użytkownika i środowiska,
- historię statusów,
- **workflow realizacji**: owner, cluster (grupa tematyczna), źródło (np. `cursor` / `manual`), branch Git, link do PR, link do zewnętrznego zadania, status wdrożenia, cele wdrożenia, weryfikacja,
- **rozwiązanie** (typ, podsumowanie, root cause, notatki weryfikacji, plan testów),
- **oś czasu workflow** (append‑only, ograniczona długość),
- informacje o **wysyłce alertów** (in‑app, Slack, e‑mail, WhatsApp — statusy per kanał),
- dla pipeline’u V2: **pakiet do Cursor** — skrót markdown z kontekstem do pracy w IDE oraz przycisk kopiowania; pierwsze pobranie briefu może automatycznie ustawić pola workflow (np. `source`, `branch`).

### 4.6 Akcje administratora

- zmiana **statusu**,
- wysłanie **odpowiedzi do użytkownika** (endpoint respond) — aktualizacja treści odpowiedzi i znacznika czasu,
- zapis **workflow** przez PATCH (właściciel, linki, deploy, resolution z notatką do osi czasu).

---

## 5. Zakładka „Backlog” — zadania do realizacji

### 5.1 Idea

Każde poprawne zgłoszenie typu ticket w `feedback_items` może mieć **powiązane zadanie w tabeli `tasks`** utworzone **automatycznie przy zapisie feedbacku**.

### 5.2 Jak powiązanie jest technicznie utrwalone

- Zadanie dostaje tagi w stylu: `feedback:<uuid_zgłoszenia>` oraz `env:<środowisko>`.
- ID zadania zapisywane jest w ticketcie (`linked_task_id` / metadane).

### 5.3 Co widzi operator w UI

- Lista zadań z tytułem, priorytetem, statusem, tagami.
- Filtrowanie po priorytecie i wyszukiwanie po tytule / opisie / ID feedbacku.
- Rozwinięcie wiersza: pełny opis, tagi, **link powrotny do źródłowego ticketu feedbacku** w rejestrze (użytkownik pozostaje w kontekście Super Admin).

Ten widok jest świadomie **listą zadań pochodzących z feedbacku**, a nie ogólnym „My Work” — unika się pomylenia kontekstu produkcyjnego.

---

## 6. Zakładka „Feedback Analytics”

- Źródło: endpoint analityczny tylko do odczytu.
- Typowe KPI: liczba otwartych, rozkład po statusie / typie / severity / środowisku, **aging** zgłoszeń w NEW, **MTTR** (mediana i p90, okno czasowe), **wskaźnik ponownego otwarcia** w ostatnim oknie.

Służy do retro kwartalnych, planowania capacity i wykrywania regresji procesu (np. rośnie reopen rate).

---

## 7. Powiadomienia i integracje operacyjne

- **Super Adminzy** mogą dostawać powiadomienia in‑app o nowych / eskalowanych zgłoszeniach (konfiguracja odbiorców po stronie serwera).
- **Eskalacja** może obejmować Slack / e‑mail / WhatsApp w zależności od severity i konfiguracji — ważne przy ticketach krytycznych (wcześniejsza wersja uwzględniała asynchroniczną wysyłkę, żeby nie blokować odpowiedzi HTTP użytkownikowi).
- Opcjonalny **dzienny digest Slack** (konfiguracja przez zmienne środowiskowe): nowe w 24 h, utknęte w NEW, otwarte krytyczne na produkcji.

---

## 8. Artefakty, retencja, zgodność

- Screenshots mogą być zapisywane na dysku (katalog konfigurowalny; w produkcji zalecany wolumen trwały).
- Działa **przycinanie retencji** starych artefaktów (np. screenshoty po domyślnie 30 dniach).
- W UI zbierania feedbacku screenshot bywa **opcjonalny (domyślnie wyłączony)**, przy czym diagnostyka tekstowa pozostaje — mniejszy payload i mniej ryzyk GDPR przy podglądach administracyjnych.

---

## 9. Narzędzia developerskie (poza UI)

W repozytorium istnieją skrypty wspierające pracę z ticketami:

- powiązanie gałęzi Git / PR z polem workflow zgłoszenia,
- generowanie szkieletu testu regresji odwołującego się do ID feedbacku.

Mają usprawnić pracę zespołu, który domyka zgłoszenia w kodzie — nie są wymagane do samego działania panelu.

---

## 10. Checklist wdrożenia podobnego modułu w innym produkcie

Poniżej minimalny zestaw decyzji i komponentów, żeby odtworzyć **ten sam model wartości** (niekoniecznie 1:1 kod).

1. **Tożsamość i RBAC** — kto jest „superadminem”; wszystkie endpointy listowania, workflow PATCH, artefakty i backlog tylko dla tej roli.
2. **Magazyn zgłoszeń** — tabela ticketów + JSON na workflow/timeline (elastyczność bez ciągłych migracji schematu).
3. **Magazyn zadań** — tabela `tasks` (lub integracja Jira/Linear) z **niezawodnym tagiem** łączącym z ID feedbacku.
4. **Automatyzacja** — przy utworzeniu ticketu: utwórz zadanie realizacji i zapisz link zwrotny.
5. **Ingest** — jednolity POST dla głównego zgłoszenia; osobne ścieżki dla pulse/feature jeśli potrzebne analitycznie.
6. **Rate limiting** na publicznych endpointach zgłoszeń.
7. **Panel operatora** — lista z filtrami, szczegół z workflow, opcjonalnie eksport do narzędzia dev (brief).
8. **Metryki** — prosty endpoint agregujący dla dashboardu.
9. **Obserwowalność** — logi, digest, ewentualnie webhooks do Slack.

---

## 11. Mapowanie na pliki w repozytorium Consultify (orientacyjnie)

| Obszar | Przykładowa lokalizacja |
| --- | --- |
| Zakładki Customers (Feedback, Backlog, Analytics) | `src/views/superadmin/CustomersModule.tsx` |
| Widok rejestru | `src/views/superadmin/SuperAdminFeedbackView.tsx` |
| Widok backlogu zadań | `src/views/superadmin/SuperAdminFeedbackBacklogView.tsx` |
| Widok analityki | `src/views/superadmin/SuperAdminFeedbackAnalyticsView.tsx` |
| Klient API (frontend) | `src/services/api.ts` (sekcja feedback) |
| Routing HTTP (backend) | `server/src/routes/feedback.routes.ts` |
| Dokumentacja pipeline V2.x | `docs/SUPERADMIN_FEEDBACK_PIPELINE.md` |

---

## 12. Podsumowanie jednym zdaniem

**Super Admin łączy pełny rejestr feedbacku z automatycznym backlogiem zadań realizacji i dashboardem KPI**, tak aby zespół mógł priorytetyzować pracę, śledzić wdrożenie i mierzyć jakość obsługi zgłoszeń end‑to‑end — z możliwością głębokiego linkowania z innych widoków (np. sygnałów platformy) i wsparcia dla narzędzi developerskich poza przeglądarką.

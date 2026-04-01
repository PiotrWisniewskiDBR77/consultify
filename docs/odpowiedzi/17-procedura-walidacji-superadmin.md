# Plik 17: Procedura walidacji modułu Superadmin (end-to-end)

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** Consultify (consultify.ai)  
**Wersja dokumentu:** 1.1 | Marzec 2026

---

## 1. Cel procedury

Celem tej procedury jest przejście przez całość modułu **Superadmin** w sposób powtarzalny i audytowalny, tak aby:

- potwierdzić, że **wszystkie zakładki z referencyjnych obrazów** są dostępne, podłączone i działają,
- zweryfikować **prawdziwość połączeń** do bazy danych (docelowo: Railway) oraz możliwość zasilenia aplikacji **realistycznymi danymi testowymi**,
- znaleźć i zaproponować **uproszczenia IA/funkcji** (mniej zakładek, większa czytelność),
- sprawdzić zgodność UI/UX z **DBR77** (szczególnie hierarchia przycisków) i wskazać poprawki,
- ujednolicić onboarding: na każdym ekranie dodać/zweryfikować **ikonę informacji w prawym górnym rogu** oraz krótki, precyzyjny opis: „co to jest i jak używać”.

---

## 2. Definicje i kryteria „zaliczenia”

### 2.1 Definicja: „zakładka podłączona”
Zakładka jest **podłączona**, jeśli spełnia łącznie:

- route/URL działa (brak 404, brak pętli redirect, brak pustego ekranu),
- ekran renderuje dane lub poprawny stan **empty** (a nie „dziura w UI”),
- podstawowe akcje użytkownika są dostępne i nie wywołują błędów runtime,
- ekran ma obsłużone stany: **loading**, **error**, **empty** (czytelnie w UI),
- jeśli ekran wymaga uprawnień: brak uprawnienia daje czytelny stan „brak dostępu”.

### 2.2 Definicja: „zakładka sprawna”
Zakładka jest **sprawna**, jeśli:

- da się wykonać krytyczne ścieżki (Read + najważniejsze akcje),
- UI odzwierciedla rzeczywisty stan (zmiana w UI = zmiana w danych),
- brak „silent fail” (akcja coś robi, ale bez potwierdzenia/sygnalizacji).

### 2.3 Definicja: „prawdziwe połączenie do DB”
Połączenie jest **prawdziwe**, jeśli można jednoznacznie powiązać:

**akcja w UI → request HTTP → backend → query → rekord w Railway**  

oraz wykazać, że aplikacja **nie korzysta** w tle z alternatywnych baz (lokalnych/dev/stub).

### 2.4 Definicja: „zakładka” (poziomy nawigacji)
Żeby procedura była jednoznaczna, rozróżniamy poziomy:

- **L0 — Sekcja Superadmin (Sidebar)**: główne wejścia po lewej stronie (np. Overview, Customers, AI Platform…).
- **L1 — Tab w sekcji**: zakładki w nagłówku sekcji (np. w Overview: Dashboard/Metrics/Signals).
- **L2 — Sub-tab**: dodatkowe „pod-zakładki” w obrębie taba (np. w AI Platform: main tab + sub-tab).

W macierzy walidacyjnej zapisuj minimum L0/L1, a jeśli ekran ma L2 — również L2.

---

## 3. Artefakty wejściowe / wyjściowe

### 3.1 Wejście (co musi być dostępne)
- Referencyjne **obrazy/screeny** z listą zakładek i oczekiwanym UI (źródło prawdy dla pokrycia).
- Dostęp do środowiska uruchomieniowego aplikacji (frontend + backend).
- Dane dostępowe do **Railway** (lub innego wskazanego środowiska docelowego).
- Lista ról/uprawnień dla Superadmin (co powinno być widoczne, a co ukryte).
- Standardy UI/UX DBR77 (w szczególności zasady dot. przycisków i ich hierarchii).

### 3.2 Wyjście (co powstaje po walidacji)
- Macierz walidacyjna: **Zakładka → Widoki → Endpointy/DB → Status → Uwagi → Dalsze kroki**.
- Lista braków: P0/P1/P2.
- Lista propozycji uproszczeń: połączenia zakładek / zmiany IA.
- Lista niezgodności UI/UX z DBR77 + plan korekt.
- Lista ekranów bez ikonki info i/lub bez opisu + gotowe propozycje treści.

---

## 4. Procedura — fazy walidacji (krok po kroku)

### Faza A — Inwentaryzacja i pokrycie zakładek (zgodność z obrazami)
**Cel:** 100% pokrycia zakładek/sekcji z referencyjnych obrazów.

1. Zbuduj listę referencyjną:
   - nazwa zakładki (jak na obrazach),
   - kolejność i grupowanie (menu/sekcje),
   - jeśli jest: opis/podtytuł/ikona.
2. Zbuduj listę rzeczywistą (z aplikacji):
   - nazwy zakładek dostępnych w UI (L0/L1/L2),
   - rzeczywiste route’y / viewId (jeśli widoczne),
   - kluczowe endpointy (z Network → XHR/Fetch).
3. Porównaj listy:
   - brakujące elementy w UI,
   - elementy „nadmiarowe” (w UI, ale nie w referencji),
   - rozjazdy nazw/kolejności.
4. Każdą zakładkę otwórz i oceń wg definicji „podłączona”.

**Kryterium zaliczenia Faz A:** 100% zakładek z obrazów ma odpowiadające im ekrany w aplikacji, które są co najmniej „podłączone”.

#### A0. Lista startowa zakładek (stan implementacji: Marzec 2026)
Ta lista ułatwia start, ale **źródłem prawdy** dla pokrycia nadal są referencyjne screeny.

- **L0: Overview**
  - **L1: Dashboard**
  - **L1: Metrics** (Conversion Intelligence)
  - **L1: Signals**
- **L0: Customers**
  - **L1: Organizations**
  - **L1: Users**
  - **L1: Lifecycle**
  - **L1: Playbooks**
  - **L1: Contracts**
  - **L1: Security**
  - **L1: Support & CS**
  - **L1: Feedback**
  - **L1: Analytics**
  - **L1: Compliance**
  - **L1: Automation**
  - **L1: Communication**
  - **L1: Bulk Ops**
- **L0: AI Platform**
  - **L1: Configuration**
    - **L2: LLM Providers**
    - **L2: Model Tiers**
    - **L2: Routing Rules**
    - **L2: Purposes & Assignments**
    - **L2: Org AI Policy**
    - **L2: AI Governance**
    - **L2: Global Settings**
  - **L1: Development**
    - **L2: Prompts Library**
    - **L2: Prompt Builder**
    - **L2: Experiments**
    - **L2: Model Registry**
  - **L1: Operations**
    - **L2: Mission Control**
    - **L2: Health Monitoring**
    - **L2: Performance**
    - **L2: SLA Management**
    - **L2: Market Inbox**
  - **L1: Analytics**
    - **L2: Usage Analytics**
    - **L2: Cost Analytics**
    - **L2: Pricing Registry**
    - **L2: Performance Metrics**
    - **L2: Custom Reports**
  - **L1: Security**
    - **L2: API Keys**
    - **L2: Access Control**
    - **L2: Audit Logs**
    - **L2: Compliance**
  - **L1: Knowledge**
    - **L2: Knowledge Base**
    - **L2: Documents (RAG)**
    - **L2: Strategic Directions**
- **L0: System**
  - **L1: Health**
  - **L1: Audit Log**
  - **L1: Feature Flags**
  - **L1: Integrations**
  - **L1: Security**
  - **L1: Configuration**
  - **L1: Analytics**
  - **L1: Backup**
  - **L1: API Keys**
- **L0: Content**
  - **L1: Playbooks**
  - **L1: Email Templates**
  - **L1: Partner Outreach**
- **L0: Revenue**
  - **L1: Billing**
  - **L1: Invoices**
  - **L1: Usage**
  - **L1: Pricing Plans**
  - **L1: Subscriptions**
  - **L1: Revenue Recognition**
  - **L1: Forecasts**
  - **L1: Payments**
- **L0: Security**
  - **L1: SSO**
  - **L1: SCIM**
  - **L1: Roles**
  - **L1: Permissions**
  - **L1: Policies**
  - **L1: Admin Sessions**
  - **L1: Audit Logs**
  - **L1: Workflows**
  - **L1: Incidents**
  - **L1: Threats**
  - **L1: DLP**
  - **L1: AI Budgets**
  - **L1: Compliance**
- **L0: Analytics**
  - **L1: Dashboard Builder**
  - **L1: Reports**
  - **L1: Business Metrics**
  - **L1: Predictive Analytics**
- **L0: Configuration**
  - **L1: Settings**
  - **L1: White-label**
  - **L1: Legal**

---

### Faza B — Walidacja funkcjonalna per zakładka (read + akcje + stany)
**Cel:** potwierdzić, że ekran robi to, co obiecuje i obsługuje stany brzegowe.

Dla każdej zakładki wykonaj minimalny scenariusz:

1. **Read / Lista danych**
   - czy lista się ładuje,
   - czy dane mają sens (formaty, jednostki, daty),
   - czy tabela/karty nie pokazują pustych pól bez powodu.
2. **Filtry / wyszukiwanie / sortowanie / paginacja** (jeśli występują)
   - czy wpływają na wynik,
   - czy można je zresetować.
3. **Krytyczne akcje** (w zależności od ekranu)
   - create/update/delete, eksport, odświeżenie, retry, generowanie, itp.
4. **Stany UI**
   - loading (czy jest czytelny),
   - empty (czy mówi „co dalej”),
   - error (czy nie gubi użytkownika i ma retry).
5. **Uprawnienia**
   - czy brak uprawnienia daje poprawny UX,
   - czy UI nie zdradza akcji, których wykonać nie wolno.

**Kryterium zaliczenia Faz B:** wszystkie krytyczne akcje działają, a każdy ekran ma poprawne stany: loading/error/empty.

#### B0. Minimalne scenariusze (must-have) dla Overview (wg aktualnego UI)
Poniżej są scenariusze, które warto wykonać w pierwszej kolejności, bo pokrywają ścieżki widoczne na ekranach referencyjnych.

- **Globalnie (nagłówek Super Admin Console)**
  - **Read**: paski/statusy w headerze renderują się i odświeżają bez błędów.
  - **Endpoint do potwierdzenia (Network)**:
    - `GET /api/superadmin/platform-stats`
- **Overview → Dashboard**
  - **Read**: metryki i Recent Activity wczytują się bez błędów.
  - **Krytyczne akcje**: Quick Actions (Organizations / Invite User / Revenue / Pending) przenoszą do właściwych sekcji.
  - **Endpointy do potwierdzenia (Network)**:
    - `GET /api/superadmin/organizations`
    - `GET /api/superadmin/dashboard`
- **Overview → Metrics (Conversion Intelligence)**
  - **Read**: Funnel listy, Early Warnings, Attribution Channels, Partners Leaderboard, Help Effectiveness.
  - **Krytyczne akcje**: `Refresh Data` realnie odświeża dane (zmienia `updatedAt` / payload / timestamps).
  - **Endpointy do potwierdzenia (Network)**:
    - `GET /api/metrics/funnels?days=...`
    - `GET /api/metrics/warnings`
    - `GET /api/metrics/attribution?days=...`
    - `GET /api/metrics/partners?days=...`
    - `GET /api/metrics/help?days=...`
- **Overview → Signals**
  - **Read**: 3 kolumny (System Alerts / Client Tickets / User Feedback) mają poprawne loading/empty.
  - **Krytyczne akcje**: `Refresh` odświeża listę; `Dismiss` usuwa element z UI i potwierdza się po stronie API.
  - **Endpointy do potwierdzenia (Network)**:
    - `GET /api/superadmin/signals`
    - `PATCH /api/notifications/:id/read` (dismiss)

---

### Faza C — Dane testowe + odłączenie alternatywnych baz (walidacja prawdziwości połączeń)
**Cel:** zasilić aplikację sensownymi danymi i udowodnić, że działa na Railway (i tylko na Railway).

#### C1. Zestaw danych testowych (kanoniczny)
Ustal „mały, ale reprezentatywny” zestaw danych, tak aby każdy ekran Superadmin miał co pokazać:

- min. 2 organizacje (dla testów izolacji danych),
- min. 3 użytkowników (w tym 1 superadmin),
- min. po kilka rekordów per moduł (np. analityka, koszty AI, A/B, prompty, health, sesje, incydenty),
- min. 1 przypadek skrajny:
  - rekordy puste,
  - wartości graniczne (0, bardzo duże, null),
  - nietypowe daty / strefy czasowe,
  - brak danych do raportu.

#### C2. Zasilenie DB danymi
- Wypełnij Railway danymi testowymi w sposób:
  - powtarzalny (możliwy do ponownego uruchomienia),
  - bezpieczny (bez danych wrażliwych),
  - zgodny ze schematem.

#### C3. Odłączenie alternatywnych baz i weryfikacja
- Upewnij się, że aplikacja nie korzysta z:
  - lokalnych connection stringów,
  - fallback DB,
  - mockowanych adapterów,
  - plikowych „sample data”.
- Zweryfikuj:
  - UI pokazuje dokładnie to, co w Railway,
  - create/update/delete powodują zmianę danych w Railway,
  - logi backendu wskazują właściwe źródło danych,
  - w Network widać ruch do realnych endpointów (np. `/api/superadmin/...`, `/api/metrics/...`) i sensowne payloady (nie „stub”).

**Artefakty dowodowe (wymagane do audytu):**
- screenshot Network (request + response) dla minimum 1 akcji per kluczowy ekran,
- screenshot zmiany danych w Railway (rekord przed/po), jeśli ekran ma zapis,
- identyfikator testowych rekordów (np. prefiks `qa_` w nazwach) użyty w teście.

**Kryterium zaliczenia Faz C:** można jednoznacznie wykazać, że aplikacja działa na Railway, a dane testowe pokrywają wszystkie ekrany.

---

### Faza D — Uproszczenia: redukcja liczby zakładek i poprawa czytelności
**Cel:** zmniejszyć „przeskakiwanie”, połączyć to, co logicznie spójne, uprościć zakres funkcji.

#### D1. Ocena nadmiarowości
Oceń dla każdej zakładki:
- czy ma unikatową intencję użytkownika,
- czy różni się tylko parametrem/filtrami od innej zakładki,
- czy lepiej pasuje jako „tab/segment” wewnątrz większego ekranu.

#### D2. Grupowanie według intencji (przykładowe klasy)
- Monitoring: SLA, performance, health, koszty.
- Optymalizacja: A/B, prompty, jakość odpowiedzi.
- Bezpieczeństwo: incydenty, audyt, sesje.
- Administracja: konfiguracje globalne, uprawnienia, ustawienia.

#### D3. Wynik
Dla każdej propozycji:
- co łączymy i dlaczego,
- jak wygląda nowa nawigacja (zgrubnie),
- jakie ryzyka (linki, nawyki użytkowników, route’y),
- jakie zyski (mniej klików, lepsza czytelność, wspólne filtry).

**Kryterium zaliczenia Faz D:** istnieje spójna propozycja IA z mniejszą liczbą zakładek i uzasadnieniem.

---

### Faza E — Audyt UI/UX vs DBR77 (focus: przyciski i hierarchia)
**Cel:** spójność interfejsu i właściwa hierarchia decyzji.

#### E1. Checklist (minimum)
- **Jedna akcja główna (primary)** na ekran (jeśli to ma sens).
- Akcje drugorzędne jako secondary/tertiary, bez konkurowania z primary.
- Akcje destrukcyjne:
  - wyraźnie oznaczone (kolor/ikona/tekst),
  - odseparowane od primary,
  - wymagają potwierdzenia (gdy impact jest wysoki).
- Spójne nazewnictwo przycisków:
  - czasowniki, konkret („Utwórz…”, „Zapisz”, „Eksportuj”, „Odśwież”),
  - brak niejednoznacznych „OK”, „Dalej” bez kontekstu.
- Spójność spacing/układu i widoczności stanów (loading/disabled).

#### E2. Wynik audytu
Każdą niezgodność zapisz jako:
- ekran + element,
- co jest nie tak względem DBR77,
- impact (P0/P1/P2),
- rekomendacja (jak poprawić).

**Kryterium zaliczenia Faz E:** lista niezgodności + gotowe rekomendacje, oraz potwierdzenie kluczowych ekranów jako zgodnych.

---

### Faza F — Ikonka informacyjna + opis ekranu (onboarding)
**Cel:** nowy użytkownik rozumie ekran w 10–20 sekund.

#### F1. Standard opisu (w ikonę info)
Każdy ekran Superadmin powinien mieć ikonę „i” / przycisk pomocy w prawym górnym rogu (w headerze) oraz opis w formacie:

- **Po co jest ten ekran** (1–2 zdania, bez żargonu).
- **Co tu widzisz** (2–4 punkty: jak czytać metryki/tabelę).
- **Najczęstsze akcje** (co robi primary action, gdzie kliknąć dalej).
- **Źródło danych** (skąd dane pochodzą, jak często się odświeżają).
- (opcjonalnie) **Ryzyko/impact** (jeśli ekran ma akcje globalne/destrukcyjne).

**Uwaga implementacyjna (Marzec 2026):** w części ekranów rolę „ikonki info” pełni `InfoButton` (cardId → panel pomocy). To jest akceptowalne jako spełnienie standardu **pod warunkiem**, że treść karty jest kompletna i zrozumiała.

#### F2. Walidacja
- sprawdź, czy ikona istnieje na każdym ekranie,
- sprawdź, czy opis jest zrozumiały i wystarczający,
- spisz braki i przygotuj propozycje tekstów.

**Kryterium zaliczenia Faz F:** 100% ekranów ma ikonę info i opis zgodny ze standardem.

---

## 5. Szablon macierzy walidacyjnej (do wypełniania podczas przeglądu)

Uzupełniaj dla każdej zakładki (jeden wiersz per ekran lub per widok, jeśli ekran ma L2 / sub-widoki).

| L0 Sekcja | L1 Tab | L2 Sub-tab (opc.) | Route / viewId | Endpointy (Network) | Dane (skąd) | Krytyczne akcje | Stany (L/E/Empty) | DB Railway potwierdzone | DBR77 UI/UX | Ikona info + opis | Status (P0/P1/P2/OK) | Uwagi / next steps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |  |  |

Legenda: L/E/Empty = Loading/Error/Empty.

---

## 6. Raport końcowy: priorytety i definicja „Done”

### 6.1 Priorytety
- **P0 (blokery)**: zakładka nie działa, błędy runtime, złe DB, brak danych mimo danych w Railway, akcje krytyczne nie działają.
- **P1 (ważne)**: zła hierarchia przycisków, mylący UX, brak stanów, brak czytelnych komunikatów, brak opisu ekranu.
- **P2 (usprawnienia)**: porządki UI, copy, drobne niespójności, propozycje uproszczeń IA.

### 6.2 Definition of Done (Superadmin)
Superadmin uznajemy za zwalidowany, gdy:

- wszystkie zakładki z obrazów są dostępne i co najmniej „podłączone”,
- wszystkie krytyczne ścieżki działania są „sprawne”,
- potwierdzono prawdziwe połączenia do Railway (i brak alternatywnych baz),
- istnieje propozycja uproszczeń (lub świadoma decyzja „nie zmieniamy” z uzasadnieniem),
- UI/UX jest zgodny z DBR77 (albo mamy listę i wdrożony plan napraw),
- każdy ekran ma ikonę info i krótki opis zgodny ze standardem.


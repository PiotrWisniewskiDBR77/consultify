# TESTY — M12 Audyty (Audit Orchestrator)

> **Moduł:** M12 Audyty (`/audit-programs`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_C_wywiad_narzedzia_audyty.md` (sekcja AUDYTY, poz. 1–8).
> **Zakres tej paczki:** hub listy programów, kreator 4-krokowy (`AuditOrchestratorWizard`), presety ISO 27001 / new-company, panel dashboard programu, fan-out ankiet (`generate-surveys`), completion rollup, usuwanie — z weryfikacją end-to-end (UI + payload + DB).
> **Poza zakresem:** runner DRD/SIRI/ADMA/Lean (M11 Assessment), public showcase `/audits` (statyczna strona marketingowa bez logiki), edycja programu przez UI (PATCH bez ekranu FE — L-01, martwy FE per D-01).
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować pełną pętlę kreator→DB→fan-out M10→rollup, z dowodem w Network i DB.
> **Legenda:** **[MANUAL]** = ręczna weryfikacja (bez automatyki); **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie.
> **Wzorzec formatu:** `TESTY_M01_CZAT.md`, `TESTY_M03_MOJA_PRACA.md`.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### 0.1 Mapa komponentów i plików

| Warstwa | Komponent / Plik | Ścieżka |
|---|---|---|
| **Hub lista** | `AuditsHub` | `src/components/Audit/AuditsHub.tsx` |
| **Kreator 4-krokowy** | `AuditOrchestratorWizard` | `src/components/Audit/AuditOrchestratorWizard.tsx` |
| **Presety** | `auditPresets.ts` | `src/components/Audit/auditPresets.ts` |
| **API klient FE** | `auditApi.ts` | `src/components/Audit/auditApi.ts` |
| **Panel dashboard** | `ProgramDashboard` (wewnątrz `AuditsHub`) | `src/components/Audit/AuditsHub.tsx:521` |
| **Route** | `AppRoutes.tsx:1194` | `src/routes/AppRoutes.tsx` |
| **Beta gating** | `BetaGate`, `betaAccess.ts` | `src/components/ProtectedRoute.tsx`, `src/utils/betaAccess.ts` |
| **Backend trasy** | 7 handlerów | `server/src/routes/audit-programs.routes.ts` |
| **Serwis BE** | `auditProgramService.ts` | `server/src/services/auditProgramService.ts` |
| **Tabela DB** | `audit_programs` | lazy `CREATE TABLE IF NOT EXISTS` przez `ensureSchema()` |
| **Fan-out (współdzielony)** | `InterviewAssignmentService` | `server/src/services/InterviewAssignmentService.ts` |
| **Testy BE** | `audit-programs.test.ts` (17 testów PASS) | `server/src/routes/__tests__/audit-programs.test.ts` |

### 0.2 Przepływ danych (E2E)

```
AuditsHub → AuditOrchestratorWizard
  ↓ POST /api/audit/programs   (createProgram)
auditProgramService.createProgram()
  ↓ INSERT audit_programs (org_id, name, objective, preset, config{templateIds,assigneeIds,plan,surveysGenerated:false})
  ↓ zwrot: AuditProgram {id, config, status:'draft', ...}

  [po utworzeniu] AuditsHub.handleGenerate()
  ↓ POST /api/audit/programs/:id/generate-surveys
auditProgramService.generateSurveys()
  ↓ validateAssignees przez organization_members (SEC-3, fix 7df4b22d6d)
  ↓ interviewAssignmentService.create() × (templateIds.length × assigneeIds.length)
  ↓ PATCH config {surveysGenerated:true, generatedAssignmentIds:[], generation:{...}}
  ↓ zwrot: {program, requested, created, failed, errors, alreadyGenerated}

  [dashboard] ProgramDashboard → GET /api/audit/programs/:id/completion
auditProgramService.computeCompletion()
  ↓ SELECT status, COUNT(*) FROM interview_assignments WHERE id IN (generatedAssignmentIds)
  ↓ zwrot: {generated, total, done, percent, byStatus}
```

### 0.3 Beta gating — stan aktualny

**WAŻNE:** `betaAccess.ts:41` → `MODULE_AUDITS: 'open'`. Moduł jest **otwarty** (beta badge w sidebarze, ale **dostęp odblokowany dla wszystkich ról**). `BetaGate` na trasie `/audit-programs` (`AppRoutes.tsx:1197`) sprawdza `isBetaClosed('MODULE_AUDITS')` — zwraca `false` → brama przepuszcza każdego zalogowanego użytkownika.

Aby przetestować gating zamknięty: zmień `MODULE_AUDITS: 'open'` → `'closed'` w `betaAccess.ts` lokalnie, sprawdź, że nie-admin widzi blokadę, przywróć do `'open'`.

### 0.4 Role i uprawnienia

- **Twórca programu (test owner):** użytkownik z aktywną organizacją, rola OWNER lub ADMIN (org DBR77).
- **Zwykły user:** MEMBER — po otwarciu bety ma dostęp, ale testy cross-role obejmują też scenariusz zamkniętej bety.
- **Org-scope:** wszystkie 7 handlerów wymaga `organizationId` z tokenu; program innej org → 404. Sprawdzone w testach BE (17 PASS).

### 0.5 Zasada weryfikacji E2E (obowiązkowa)

Każda operacja CRUD / fan-out / rollup musi być potwierdzona w **trzech warstwach**:
1. **UI** — zmiana widoczna na ekranie.
2. **Network (DevTools → XHR)** — właściwy endpoint, właściwy HTTP status, payload request i response body.
3. **DB / trwałość** — odśwież stronę (`Ctrl+R`), sprawdź, że stan przetrwał; dla `[DB]` opcjonalnie: bezpośredni SELECT na bazie lub ponowne wczytanie z GET.

Sama zmiana wyglądu bez żądania sieciowego = **FAIL**.

---

## Setup środowiska testowego

1. Uruchom dev server: FE na `:3000`, BE na `:3001` (lub wg lokalnej konfiguracji).
2. Zaloguj się jako OWNER organizacji DBR77.
3. Otwórz DevTools → zakładka **Network** (filtr: `/api/audit`), zakładka **Console** (wymóg: zero błędów/warningów przez całą sesję).
4. Nawiguj do `/audit-programs` (lub kliknij „Audyty" w sidebarze, jeśli widoczne).
5. Przygotuj dane testowe:
   - **Szablony wywiadów:** min. 2 szablony w M10 (np. „Szablon Techniczny", „Szablon HR") — sprawdź przez `/discovery` → Szablony.
   - **Użytkownicy org:** min. 3 użytkowników należących do tej samej organizacji (sprawdź przez `/organization/members`). Zapamiętaj 1 e-mail spoza org (do testu SEC-3).
   - **Pusty stan:** jeśli są stare programy testowe z poprzednich sesji — usuń je przed testem lub wykonaj testy w osobnej organizacji testowej.
6. Dla testów `[FLAG]` — gating zamknięty: lokalnie ustaw `MODULE_AUDITS: 'closed'` w `src/utils/betaAccess.ts`, sprawdź, przywróć.

---

## 1. Hub listy programów (`AuditsHub`)

### 1.1 Wejście na moduł i nagłówek

**Kroki:**
1. Przejdź na `/audit-programs`.
2. Sprawdź nagłówek strony: ikona `ShieldCheck`, tytuł „Audyty" / „Audits", podtytuł orkiestracji.
3. Sprawdź przyciski w prawym górnym rogu: „ISO 27001" (z ikoną ShieldCheck) oraz „Nowy program audytu" / „New audit program" (z ikoną +, kolor primary).

**Asercje:**
- Strona ładuje się bez błędu 404/500 w konsoli.
- Tytuł wyświetlany w języku przeglądarki (PL lub EN).
- Przycisk „Wstecz" (ArrowLeft) widoczny; klik → nawigacja do poprzedniej trasy (bez twardego reloadu).
- DevTools Console: 0 błędów.

**Weryfikacja E2E:** Network → `GET /api/audit/programs?limit=50&offset=0` → status 200 → `{ programs: [...], total: N, limit: 50, offset: 0 }`.

### 1.2 Stan pusty (brak programów)

**Kroki:**
1. Wejdź na moduł przy pustej liście programów org.
2. Sprawdź komunikat pustego stanu.

**Asercje:**
- Widoczna ikona `ClipboardList` + komunikat „Brak programów audytu." / „No audit programs yet."
- Brak krasha, brak spinnerów w nieskończoność.

### 1.3 Stan loading

**Kroki:**
1. W DevTools → Network: ustaw wolny throttling (Slow 3G).
2. Odśwież stronę.
3. Obserwuj stan pośredni.

**Asercje:**
- Widoczny spinner `Loader2 animate-spin` + tekst „Ładowanie…" / „Loading…" w obszarze listy (NIE cała strona zablokowana).
- Po załadowaniu spinner znika, lista się pojawia.

### 1.4 Wyszukiwarka (filtr kliencki)

**Kroki:**
1. Utwórz co najmniej 3 programy o różnych nazwach: „Audyt ISO 2026", „Nowa firma Kowalski", „Test bezpieczeństwa".
2. W pole wyszukiwania wpisz „ISO".
3. Sprawdź wyniki.
4. Wyczyść pole.
5. Wpisz „xxxxxxxxxxxxxxx" (brak dopasowania).

**Asercje:**
- Wyniki filtrowane kliencko w czasie rzeczywistym (bez nowego żądania sieciowego).
- Filtrowanie obejmuje pola `name` i `objective` (wpisz fragment objective — sprawdź).
- Brak dopasowania → komunikat „Brak programów pasujących do filtrów." / „No programs match your filters." + ikona `ClipboardList`.
- Wyczyszczenie pola → pełna lista wraca.

**[MANUAL] Ograniczenie klienckie (L-02):** Filtr działa tylko na załadowanej stronie (`PAGE_SIZE=50`). Jeśli `total > 50` i wpisujesz termin pasujący do rekordu na stronie 2 — wynik jest pusty mimo że rekord istnieje. Odnotuj zachowanie i oznacz jako znane ograniczenie.

### 1.5 Filtr statusu (pills)

**Kroki:**
1. Utwórz programy o różnych statusach (draft przez kreator; active/completed/archived przez bezpośredni PATCH curl lub narzędzia developerskie — patrz §3.3).
2. Kliknij kolejno: Wszystkie / Draft / Active / Completed / Archived.

**Asercje:**
- Aktywny pill → `bg-primary-500 text-white`; nieaktywny → `bg-white text-slate-500`.
- Lista filtrowana po kliknięciu.
- Połączenie filtra statusu + wyszukiwarki działa łącznie (AND).

### 1.6 Wybór programu i panel dashboard

**Kroki:**
1. Kliknij w kartę programu na liście.

**Asercje:**
- Karta programu otrzymuje obwódkę `border-primary-500`.
- Panel po prawej (col-span-1) pokazuje `ProgramDashboard` z nazwą, liczbami szablonów, osób, sugerowanym planem.
- Przy braku zaznaczenia → komunikat „Wybierz program, aby zobaczyć panel." / „Select a program to see its dashboard."
- Dane dashboardu odpowiadają wartościom z config (templateIds.length, assigneeIds.length).

### 1.7 „Load more" (paginacja serwerowa)

**[MANUAL]** (wymaga >50 programów lub ręcznego zaseedowania)

**Kroki:**
1. Utwórz lub zaseed ≥51 programów dla org.
2. Wejdź na moduł.
3. Sprawdź, czy widoczny jest przycisk „Załaduj więcej" / „Load more" z etykietą „Pokazano 50 z N".

**Asercje:**
- Przycisk widoczny tylko gdy `programs.length < total`.
- Klik → `GET /api/audit/programs?limit=50&offset=50` → dołączenie kolejnych rekordów bez duplikatów.
- Deduplication guard: `seen = new Set(prev.map(p=>p.id))` — zweryfikuj brak duplikatów po załadowaniu.
- Przycisk znika, gdy `programs.length >= total`.

### 1.8 Obsługa błędu sieci

**[MANUAL]**

**Kroki:**
1. Odłącz serwer (lub wymuś błąd przez DevTools → Block request).
2. Odśwież stronę.

**Asercje:**
- Widoczna czerwona ramka z błędem (nie crash, nie biała strona).
- Komunikat po PL/EN zgodny ze zwróconym `error.message`.

---

## 2. Kreator 4-krokowy (`AuditOrchestratorWizard`)

### 2.1 Otwarcie kreatora

**Kroki:**
1. Klik „Nowy program audytu" → sprawdź otwarcie modala.
2. Klik „ISO 27001" → sprawdź otwarcie modala z wstępnie wybranym presetem.

**Asercje:**
- Modal (`z-[60]`) pojawia się na całym ekranie z overlay `bg-slate-900/50`.
- Nagłówek: „Nowy program audytu" / „New audit program", podtytuł opisu.
- Zamknięcie (X) → modal znika, stan listy programów niezmieniony.
- Kliknięcie poza modalem (overlay) — sprawdź, czy modal się zamyka (nie ma `onClose` na overlay — **odnotuj**: overlay kliknięcie może NIE zamknąć; to znane zachowanie self-contained, nie bug).

### 2.2 `WizardStepper` — nawigacja i stan kroków

**Kroki:**
1. Sprawdź widoczność 4 pillsów kroków: Cel / Szablony / Przypisani / Podsumowanie.
2. Sprawdź pasek postępu.
3. Bez wpisania nazwy — próba kliknięcia w pill „Szablony".
4. Wpisz nazwę → kliknij w pill „Szablony" → kliknij w pill „Cel".

**Asercje:**
- Aktywny krok = `status:'ready'` (podświetlony).
- Poprzedni krok z zawartością = `status:'complete'` (wizualny checkmark lub kolor zmieniony).
- Pusty poprzedni krok = `status:'empty'` (wyciszony).
- **`maxReachableIndex`:** Bez nazwy → `maxReachableIndex = stepIndex` (nie można przeskoczyć do późniejszego kroku).
- Z nazwą → `maxReachableIndex = 3` (można kliknąć w dowolny pill).
- Powrót do poprzedniego kroku przez pill → stan formularza zachowany (nazwa, preset, wybrane szablony).
- `accentColor="#3b82f6"` przekazany do `WizardStepper` — hardkodowany hex (L-08, do odnotowania).

### 2.3 Krok 1: Cel (`objective`)

**Kroki:**
1. Pole „Nazwa programu" (wymagane, oznaczone `*`) — zostaw puste.
2. Sprawdź przycisk „Dalej".
3. Wpisz nazwę: „Test Audyt ISO 2026".
4. Kliknij preset „ISO 27001".
5. Sprawdź auto-wypełnienie celu.
6. Wyczyść cel, kliknij inny preset „Diagnoza nowej firmy".
7. Sprawdź nowy cel.
8. Kliknij „Własny / Custom".
9. Wpisz własny cel ręcznie.

**Asercje:**
- Bez nazwy: przycisk „Dalej" disabled (`disabled:opacity-60 cursor-not-allowed`), `canProceed()` = false.
- Z nazwą: przycisk „Dalej" aktywny.
- Klik ISO 27001 → pole celu auto-wypełnione tekstem presetu PL: „Ocena gotowości organizacji względem kontroli z Załącznika A normy ISO/IEC 27001."
- Klik „Diagnoza nowej firmy" → cel wypełniony tylko jeśli pole było puste (nie nadpisuje istniejącego tekstu — `if (!objective.trim())`).
- Karta presetu aktywna → `border-primary-500 bg-primary-500/5`.
- „Własny" wybrany → żadne pole celu nie jest auto-wypełniane.
- Przy aktywnym presecie widoczny panel sugerowanego planu (ISO: 14 wierszy A.5–A.18; new-company: 6 obszarów). Zweryfikuj, że jest to heurystyka (tekst: „Sugestia heurystyczna."), nie LLM.

**Edge cases:**
- Pole nazwy: wpisz `   ` (same spacje) → `trim()` = pusty → przycisk Dalej nadal disabled.
- Wróć do kroku 1 po byciu na kroku 2 — nazwa i preset zachowane.

### 2.4 Krok 2: Szablony (`templates`)

**Kroki:**
1. Przejdź do kroku 2.
2. Sprawdź ładowanie szablonów (`loadingLookups`).
3. Wybierz 2 szablony z `MultiSelect`.
4. Sprawdź wygląd wybranych elementów.
5. Odznacz 1 szablon.

**Asercje:**
- Podczas ładowania: spinner + „Ładowanie szablonów…" / „Loading templates…".
- Po załadowaniu: `MultiSelect` z opcjami (value=id, label=name, description=category).
- Zaznaczenie → element pojawia się w wybranej liście.
- Odznaczenie → znika z listy.
- Krok może być ukończony z 0 szablonami (brak twardego `canProceed` dla tego kroku — przycisk Dalej aktywny).
- Pill kroku 2 w `WizardStepper` → `status:'complete'` gdy ≥1 szablon wybrany, `status:'empty'` gdy 0.

**Weryfikacja E2E:** Klik „Dalej" na kroku 2 NIE wysyła żadnego żądania — to operacja czysto lokalna. Brak żądania sieciowego = poprawne zachowanie.

**[FLAG] Brak szablonów w M10:** Jeśli organizacja nie ma żadnych szablonów wywiadów → lista pusta, `MultiSelect` pokazuje `emptyLabel`. Odnotuj zachowanie (brak szablonów nie blokuje kreatora).

### 2.5 Krok 3: Przypisani (`assignees`)

**Kroki:**
1. Przejdź do kroku 3.
2. Sprawdź listę użytkowników organizacji.
3. Wybierz 2 użytkowników.
4. Sprawdź wyświetlanie e-maila jako `description`.

**Asercje:**
- Lista załadowana z `GET /api/users` → filtrowana do użytkowników org.
- Wyświetlane: name + email (description).
- Wybór i odznaczanie jak w kroku 2.
- Krok opcjonalny (0 assignees nie blokuje przycisku Dalej).

**[DB] Weryfikacja SEC-3:** Nie testować bezpośrednio przez UI (P1 naprawiony w 7df4b22d6d), ale odnotować: po generacji fan-out serwer waliduje `assigneeIds` przez `organization_members` — użytkownik spoza org jest odrzucony. Dowód: test BE SEC-3 w `audit-programs.test.ts`.

### 2.6 Krok 4: Podsumowanie (`review`)

**Kroki:**
1. Przejdź do kroku 4.
2. Sprawdź wyświetlone wartości podsumowania.
3. Sprawdź baner informacyjny.
4. Kliknij „Utwórz program".

**Asercje:**
- `ReviewRow` dla każdego pola: Nazwa, Cel, Preset (lub „Własny"), Szablony (liczba), Przypisani (liczba).
- Baner bursztynowy: tekst o tym, że program zostanie teraz utworzony, a ankiety można wygenerować po utworzeniu (NIE „generowanie nie jest zautomatyzowane w MVP" — ten stary tekst L-03 jest już poprawiony).
- Przycisk „Utwórz program" disabled gdy brak nazwy (dodatkowe zabezpieczenie: `disabled={submitting || !name.trim()}`).
- Klik → spinner `Loader2` na przycisku, przycisk disabled podczas wysyłania.

**Weryfikacja E2E:** Network → `POST /api/audit/programs` → status 201 → `{ program: { id, organizationId, name, objective, preset, config: { templateIds, assigneeIds, plan, surveysGenerated: false }, status: 'draft', ... } }`.

**[DB]** Po zamknięciu modala: odśwież stronę (`Ctrl+R`) → program widoczny na liście → trwałość potwierdzona. `[DB]` opcjonalnie: `SELECT * FROM audit_programs WHERE id = '<uuid>'` → wiersz istnieje z `organization_id` = org twórcy.

### 2.7 Walidacja i błędy kreatora

| Scenariusz | Oczekiwane |
|---|---|
| Pusta nazwa, klik Utwórz | Przycisk disabled — niemożliwe (podwójna ochrona: `canProceed` + `disabled` na przycisku) |
| Błąd sieci przy POST | Czerwona ramka błędu w kroku Review + `error.message`; przycisk Dalej znów aktywny |
| Zamknięcie modala podczas submitting | `submitting=true` → nie blokuje zamknięcia, ale może stworzyć race condition — odnotuj |

### 2.8 Nawigacja wstecz i persystencja stanu

**Kroki:**
1. Krok 1: wpisz nazwę, wybierz ISO 27001.
2. Krok 2: wybierz 1 szablon.
3. Krok 3: wybierz 1 assignee.
4. Wróć do kroku 2 przez pill lub przycisk „Wstecz".
5. Wróć do kroku 1.

**Asercje:**
- Każdy krok po powrocie pokazuje wcześniej wybrane wartości (stan zachowany w `useState`).
- Pill kroku 2: `status:'complete'` (bo szablon był wybrany).
- Przycisk „Wstecz" na kroku 1 = „Anuluj" → modal zamknięty, stan wyczyszczony (przy ponownym otwarciu: `reset` przez `useEffect([open])`).
- **Zresetowanie stanu przy reotwarciu:** zamknij i otwórz modal ponownie → wszystkie pola puste, krok 1 aktywny. Preset = `initialPresetId` (null lub 'iso27001' zależnie od triggera).

---

## 3. Presety audytowe

### 3.1 ISO 27001 — weryfikacja zawartości

**Kroki:**
1. Otwórz kreator przez „ISO 27001" lub wybierz preset w kroku 1.
2. Sprawdź panel sugerowanego planu.

**Asercje:**
- Preset: `id='iso27001'`, 14 obszarów A.5–A.18 (A.5 Polityki, A.6 Organizacja, A.7 HR, A.8 Aktywa, A.9 Dostęp, A.10 Kryptografia, A.11 Fizyczne, A.12 Operacyjne, A.13 Komunikacja, A.14 Systemy, A.15 Dostawcy, A.16 Incydenty, A.17 Ciągłość, A.18 Zgodność).
- Każdy obszar ma `suggestedRole` (CISO, HR Lead, IT Lead...).
- Cel auto-wypełniony: „Ocena gotowości organizacji względem kontroli z Załącznika A normy ISO/IEC 27001." (PL).
- Plan renderowany jako `<ul>` — `area` | `suggestedRole` (2 kolumny, justify-between).
- Label nad planem: „Sugestia heurystyczna. Planowanie generowane przez AI z kontekstu organizacji to planowane rozszerzenie." (wyraźna granica AI — NIE LLM call).

**Weryfikacja payload:** Po kliknięciu „Utwórz program" → `POST /api/audit/programs` body: `{ preset: "iso27001", config: { plan: [{ areaKey, area, suggestedRole }, ...] } }` — 14 wierszy planu w payloadzie. `[DB]` config.plan przechowywany w kolumnie `config` jako JSON.

### 3.2 Preset „Diagnoza nowej firmy" (new-company)

**Kroki:**
1. Otwórz kreator, wybierz „Diagnoza nowej firmy".
2. Sprawdź plan.

**Asercje:**
- Preset: `id='new-company'`, 6 obszarów: Strategy (CEO), Finance (CFO), Sales (Sales Lead), Product (Product Lead), People (HR Lead), Tech (CTO).
- Cel: „Zmapuj organizację w kluczowych funkcjach, aby zaplanować kto na co odpowiada." (PL).
- W kroku Review: `Preset = "Diagnoza nowej firmy"`.
- W payloadzie POST: `preset: "new-company"`, `config.plan` = 6 wierszy.

### 3.3 Preset „Własny / Custom"

**Kroki:**
1. Otwórz kreator → „Własny" wybrany domyślnie.
2. Sprawdź brak panelu planu.
3. Wpisz własną nazwę i cel.

**Asercje:**
- Brak panelu sugerowanego planu (tylko gdy `activePreset !== null`).
- W payloadzie POST: `preset: null`, `config.plan: []` (pusta tablica).
- `ReviewRow` Preset = „Własny" / „Custom".

### 3.4 Modyfikacja presetu (zmiana podczas kreatora)

**Kroki:**
1. Wybierz ISO 27001 → cel auto-wypełniony.
2. Zmień na „Diagnoza nowej firmy" → sprawdź, czy cel jest nadpisany.
3. Ręcznie wpisz cel, zmień preset.

**Asercje:**
- `applyPreset()` auto-wypełnia cel tylko gdy `!objective.trim()` — jeśli użytkownik wpisał własny cel, nie jest nadpisywany (logika: `if (preset && !objective.trim())`).
- Zmiana presetu aktualizuje panel planu natychmiast (React `useMemo([activePreset, isPolish])`).
- Powrót do „Własny" → plan znika.

---

## 4. Zarządzanie programem (hub operacje)

### 4.1 Usuwanie programu

**Kroki:**
1. Utwórz program testowy „Do usunięcia".
2. Kliknij ikonę Trash2 przy programie na liście.
3. Potwierdź dialog `window.confirm`.
4. Sprawdź stan listy po usunięciu.
5. Powtórz: kliknij Trash2 → kliknij „Anuluj" w confirm.

**Asercje:**
- Klik ikony Trash2 → `e.stopPropagation()` (NIE otwiera dashboardu).
- Dialog potwierdzenia: „Usunąć ten program audytu?" / „Delete this audit program?"
- Potwierdzenie → `DELETE /api/audit/programs/:id` → status 200 → `{ success: true }`.
- Lista odświeżona (`load()`), usunięty program zniknął.
- Jeśli usunięty program był zaznaczony → `setSelectedId(null)`, panel dashboard czysty.
- Anulowanie → brak żądania DELETE, lista bez zmian.
- `[DB]` Odśwież stronę → program nie pojawia się ponownie.

**Edge case:** Usuwanie programu, który ma już wygenerowane ankiety (`surveysGenerated:true`) — serwer usuwa rekord `audit_programs`, ale `interview_assignments` pozostają (serwis nie kaskaduje). Odnotuj zachowanie — czy to oczekiwane (orphaned assignments).

### 4.2 Fan-out ankiet (`generate-surveys`)

**KRYTYCZNY — E2E S5**

**Wymagania wstępne:** Program z ≥1 szablonem i ≥1 assignee (z tej samej org). Otwórz M10 `/discovery` → Przydzielone — będziesz tu sprawdzał wyniki.

**Kroki:**
1. Znajdź na liście program z `templateCount ≥ 1` i `assigneeCount ≥ 1`.
2. Sprawdź przycisk `Send` (ikona Send, nie disabled, tooltip: „Generuj N ankiet").
3. Kliknij przycisk Send.
4. Potwierdź dialog: „Wygenerować N przydziałów ankiet (T szablonów × A osób)?"
5. Obserwuj stan spinnerowy.
6. Sprawdź wynik.

**Asercje:**
- Przed generacją: ikona Send aktywna (`text-slate-300 hover:bg-primary-50`).
- Podczas generacji: spinner `Loader2 animate-spin`, `isGenerating = true`.
- Dialog confirm oblicza `pairs = templateCount * assigneeCount` — poprawna liczba.
- `POST /api/audit/programs/:id/generate-surveys` → status 200 → `{ program, requested, created, failed, errors, alreadyGenerated }`.
- **Success (created == requested, failed == 0):** ikona Send staje się disabled (`text-slate-200 dark:text-white/20`), tooltip zmieniony na „Ankiety wygenerowane", odświeżenie listy.
- **Partial failure (failed > 0):** czerwona ramka błędu „Wygenerowano X z Y; Z nie powiodło się."
- `[DB]` Program config: `surveysGenerated: true`, `generatedAssignmentIds: [...]`, `generation: { requested, created, failed, at }`.
- **M10 cross-check:** Przejdź do `/discovery` → zakładka „Przydzielone" → assignee powinien widzieć nowe przydziały wywiadów (fan-out przez `interviewAssignmentService.create`).
- **M03 cross-check:** Przejdź do `/my-work/inbox` → assignee powinien mieć mirror-task z przydziału.

**Edge cases:**
- Program bez szablonów lub assignee: `pairs = 0` → wyświetlony komunikat błędu „Wybierz co najmniej jeden szablon...", brak żądania.
- Anulowanie confirm → brak żądania.

### 4.3 Idempotentność fan-out

**[DB] KRYTYCZNY**

**Kroki:**
1. Wygeneruj ankiety dla programu (§4.2).
2. Kliknij ponownie przycisk Send (jeśli jest disabled po pierwszej generacji — zweryfikuj przez direct `POST` przez Fetch w konsoli):
   ```js
   await fetch('/api/audit/programs/<id>/generate-surveys', {method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer <token>'}, body:'{}'})
   ```
3. Sprawdź odpowiedź.

**Asercje:**
- Drugi wywołanie → `{ alreadyGenerated: true }` (guard `surveysGenerated` w serwisie).
- UI pokazuje komunikat „Ankiety zostały już wygenerowane." / „Surveys were already generated."
- Brak duplikatów w `interview_assignments` — liczba wierszy ta sama co po pierwszej generacji.

### 4.4 Completion rollup (dashboard)

**KRYTYCZNY — E2E S6**

**Kroki:**
1. Wybierz na liście program, który ma `surveysGenerated: true`.
2. Sprawdź panel ProgramDashboard → sekcja „Postęp / Completion".
3. Otwórz DevTools → Network → sprawdź żądanie completion.
4. Zmień status jednego przydziału w M10 (np. prześlij odpowiedź, zatwierdź) i odśwież widok programu.

**Asercje:**
- Jeśli `!surveysGenerated`: tekst „Niewygenerowane. Użyj „Generuj ankiety"..." bez paska postępu.
- Jeśli `surveysGenerated`: ładowanie rollup z `GET /api/audit/programs/:id/completion`.
- Podczas ładowania: spinner + „Ładowanie…".
- Rollup załadowany: pasek postępu (`h-2 rounded-full bg-emerald-500`), szerokość = `${completion.percent}%`.
- Etykieta: „X z Y ankiet ukończonych" / „X of Y surveys completed".
- `[DB]` Zgodność z bazą: ręcznie `SELECT status, COUNT(*) FROM interview_assignments WHERE id IN (...)` → suma `submitted+completed` / `total` = `completion.percent`.
- Brak rollup (błąd GET): tekst „Postęp niedostępny." / „Completion unavailable." bez krasha.

### 4.5 Dashboard programu — sugerowany plan

**Kroki:**
1. Utwórz program z presetem ISO 27001.
2. Wybierz go na liście.

**Asercje:**
- Panel dashboardu pokazuje sekcję „Sugerowany plan" / „Suggested plan".
- Wiersze planu: `area | suggestedRole` (2 kolumny, 14 wierszy dla ISO).
- Brak programów z `config.plan = []` (custom) → sekcja planu ukryta (`plan.length > 0`).
- Preset badge pod nazwą programu: „Audyt gotowości ISO 27001" (label presetu, kolor `text-primary-600`).

### 4.6 Brak edycji FE (L-01 — martwa trasa) [FLAG]

**[MANUAL]** Odnotuj jako znane ograniczenie:
- Backend `PATCH /api/audit/programs/:id` istnieje i działa (zweryfikowano testami BE).
- Brak przycisku/formularza edycji w `AuditsHub` ani w `AuditOrchestratorWizard`.
- Żaden ekran nie wywołuje `auditApi.updateProgram()`.
- **Nie należy do zakresu testu manualnego** — odnotuj jako L-01 (D-01: DP-5 = ukryj stub za flagą + label), nie zgłaszaj jako regresja.

---

## 5. Testy presetsów — E2E payload (EPIK 2)

### 5.1 Payload ISO 27001 end-to-end [DB]

**Kroki:**
1. Otwórz kreator przez przycisk „ISO 27001" w nagłówku.
2. Wpisz nazwę „E2E ISO 27001 Test".
3. Pomiń wybór szablonów i assignees (kroki 2-3 opcjonalne).
4. Kliknij „Utwórz program".
5. W DevTools → Network → sprawdź Request Payload.

**Asercja payload:**
```json
{
  "name": "E2E ISO 27001 Test",
  "objective": "Ocena gotowości organizacji względem kontroli z Załącznika A normy ISO/IEC 27001.",
  "preset": "iso27001",
  "status": "draft",
  "config": {
    "templateIds": [],
    "assigneeIds": [],
    "plan": [
      { "areaKey": "a5", "area": "Polityki bezpieczeństwa informacji", "suggestedRole": "CISO" },
      ...
      { "areaKey": "a18", "area": "Zgodność", "suggestedRole": "Specjalista ds. zgodności" }
    ],
    "surveysGenerated": false
  }
}
```
- `plan` musi mieć dokładnie 14 wierszy.
- `surveysGenerated: false` (serwer nie generuje ankiet przy tworzeniu).
- Response: status 201, `{ program: { id, preset: "iso27001", config: { ... } } }`.

### 5.2 Payload „Diagnoza nowej firmy" end-to-end [DB]

**Asercja payload:**
- `preset: "new-company"`, `config.plan` = 6 wierszy (strategy, finance, sales, product, people, tech).
- `surveysGenerated: false`.

### 5.3 Payload Custom (własny) end-to-end [DB]

**Asercja payload:**
- `preset: null`, `config.plan: []`, `config.templateIds: []`, `config.assigneeIds: []`, `config.surveysGenerated: false`.

---

## 6. Beta gating [FLAG]

### 6.1 Moduł otwarty (stan bieżący)

**Kroki:**
1. Zaloguj się jako MEMBER (zwykły użytkownik, nie ADMIN/OWNER).
2. Nawiguj do `/audit-programs`.

**Asercje:**
- `MODULE_AUDITS: 'open'` w `betaAccess.ts:41` → `isBetaClosed('MODULE_AUDITS')` = false.
- `BetaGate` przepuszcza → strona ładuje się normalnie.
- Sidebar może pokazywać badge „beta" przy „Audyty" — tylko estetyczny.
- Brak przekierowania do `/chat`.

### 6.2 Moduł zamknięty (scenariusz testowy) [FLAG]

**[MANUAL]** — wymagana modyfikacja kodu lokalna.

**Kroki:**
1. Lokalnie ustaw `MODULE_AUDITS: 'closed'` w `src/utils/betaAccess.ts`.
2. Zaloguj się jako MEMBER (rola niebędąca ADMIN/OWNER/SUPERADMIN).
3. Nawiguj do `/audit-programs` bezpośrednio przez URL.
4. Sprawdź zachowanie.
5. Zaloguj się jako OWNER — spróbuj ponownie.

**Asercje:**
- MEMBER: `isLocked = true` → `dispatchBetaAccessBlocked()` (event = `access:blocked`, pokazuje modal) → `<Navigate to="/chat" replace />`.
- OWNER + `BETA_ADMINS_EXEMPT = true`: `isBetaLockedForRole('owner')` = false → dostęp przyznany.
- API org-scoped → dane chronione niezależnie od gating FE.
- Przywróć `MODULE_AUDITS: 'open'` po teście.

### 6.3 Direct URL bez tokenu (niezalogowany)

**Kroki:**
1. Wyloguj się.
2. Wejdź na `/audit-programs` przez URL.

**Asercje:**
- Middleware `verifyToken` na backendzie odrzuca żądania API → 401.
- FE `ProtectedRoute` (obok BetaGate) przekierowuje na `/login`.
- Brak wycieku danych w odpowiedzi.

---

## 7. Ścieżki cross-module

### 7.1 M12 → M10 Wywiad: szablony w kreatorze

**Kroki:**
1. W M10 (`/discovery`) utwórz nowy szablon wywiadu: „Szablon Bezpieczeństwo", kategoria „IT".
2. Wróć do M12, otwórz kreator → Krok 2 Szablony.
3. Sprawdź, czy nowy szablon jest widoczny na liście.

**Asercje:**
- `listTemplateOptions()` → `GET /api/interview/templates` → szablony z M10 widoczne w selektorze.
- Kategoria widoczna jako `description` w `MultiSelect`.
- Wybranie szablonu M10 → zapisane w `config.templateIds`.

### 7.2 M12 → M10 Wywiad: fan-out tworzy przydziały

**Kroki:**
1. Utwórz program z 1 szablonem M10 i 1 assignee.
2. Wygeneruj ankiety (§4.2).
3. Zaloguj się jako assignee → przejdź do M10 → „Moje przydziały" (`my_assignments`).

**Asercje:**
- Assignee widzi nowy przydział wywiadu w M10 inbox.
- Przydział zawiera: template_id = wybrany szablon, organization_id = ta sama org, created przez `interviewAssignmentService.create`.
- `[DB]` Tabela `interview_assignments`: nowy wiersz z `audit_program_id = null` (sprawdź — serwis może nie linkować zwrotnie do programu) lub z odpowiednim polem.

### 7.3 M12 → M03 My Work: mirror-task

**Kroki:**
1. Wygeneruj ankiety (§7.2).
2. Zaloguj się jako assignee → przejdź do `/my-work/inbox` lub `/my-work/tasks`.

**Asercje:**
- Mirror-task z przydziału widoczny w M03 inbox assignee.
- Zadanie odnosi się do konkretnego wywiadu/ankiety.
- `[DB]` `organization_id` w tasku = org programu (SEC-3: assignee spoza org nie dostaje taska).

### 7.4 M12 → M13 Inicjatywy (przyszłościowe — odnotuj brak)

**[MANUAL]** Stan obecny: brak bezpośredniej nawigacji z wyników programu audytu do M13.
- Odnotuj: po zakończeniu audytu wyniki (insights) mogą być generowane w M10, skąd przechodzą do M13 przez `InitiativeWizardModal`. Bezpośredni flow M12 → M13 nie jest zaimplementowany.
- Nie zgłaszaj jako bug — poza scope v1.

---

## 8. Mapa epików → sekcje (ZERO niepokrytych)

| Epik | Opis | Sekcja testu |
|---|---|---|
| **EPIK 1 — Front↔back domknięcie** | | |
| E1.1 Story 1.1 | Edycja programu (PATCH): martwy FE = L-01 (D-01 → DP-5) | §4.6 |
| E1.2 | Search/filter kliencki (L-02) | §1.4 [MANUAL] |
| E1.3 | Baner kreatora MVP (L-03) | §2.6 |
| E1.4 | Lista paginowana load-more | §1.7 |
| **EPIK 2 — Bezpieczeństwo** | | |
| E2.1 Story 2.1 | Beta-guard na route (L-04) | §6.2 |
| E2.2 | Org-scope 7/7 handlerów | §4.1, §4.2, §4.3 (serwer) |
| E2.3 | SEC-3 cross-org assignment (7df4b22d6d) | §2.5 [DB], §7.2 |
| **EPIK 3 — Kanony** | | |
| E3.1 | `ModuleHub` zamiast self-contained (L-05) | odnotuj §0.1 |
| E3.2 | §27 `FilterableTable` dla listy (L-06) | odnotuj §1.1 |
| **EPIK 4 — Szlif** | | |
| E4.1 | i18n `isPolish`+`tr()` → `t()` (L-07) | §9.2 |
| E4.2 | Hardkod `accentColor="#3b82f6"` (L-08) | §2.2 |
| **EPIK 5 — Testy FE/E2E** | | |
| E5.1 Story 5.1 | CI pętla kreator→fan-out→rollup | §2.6+§4.2+§4.4 |
| E5.2 | 17 testów BE PASS | §10 |

---

## 9. Testy przekrojowe

### 9.1 Kombinacje i stany

1. **Kreator → fail POST → retry:** Wymuś błąd 500 na `POST /api/audit/programs` (BlockRequest w DevTools). Sprawdź, że formularz nie jest wyczyszczony, przycisk Dalej działa po odblokowania sieci, retry tworzy program.
2. **Szybkie podwójne kliknięcie „Utwórz program":** Kliknij dwukrotnie szybko. `submitting=true` po pierwszym kliknięciu → drugi klik zignorowany (disabled). Sprawdź, że w DB jest tylko 1 rekord.
3. **Generuj ankiety + jednoczesny reload:** Kliknij „Generuj" → natychmiast odśwież stronę. Sprawdź, czy gen-surveys zakończyła się (sprawdź DB lub `/api/audit/programs/:id`).
4. **Usunięcie programu podczas ładowania rollup:** Kliknij program → panel dashboardu ładuje rollup → usuń program. Sprawdź, że rollup nie crashuje (guard `cancelled=true` w `useEffect`).

### 9.2 i18n PL / EN

**Kroki:**
1. Przełącz język aplikacji na PL → sprawdź hub, kreator, panel, toasty.
2. Przełącz na EN → sprawdź te same elementy.

**Asercje:**
- Wszystkie etykiety, buttony, toasty, placeholdery — przetłumaczone.
- Brak gołych kluczy (np. `t.undefined`, fallbacki bez tłumaczenia).
- Uwaga: `AuditsHub` i `AuditOrchestratorWizard` używają inline `isPolish`+`tr(en,pl)` (L-07) — dług techniczny, ale PL+EN **pełne** bez braków. Sprawdź każdy ciąg.
- **Szczególnie:** etykiety presetsów (PL: „Audyt gotowości ISO 27001", „Diagnoza nowej firmy"), nazwy obszarów ISO 27001 (14 PL), sugerowane role.
- Dialog `window.confirm` — treść dwujęzyczna.

### 9.3 Dark mode

**Kroki:**
1. Przełącz aplikację w tryb ciemny.
2. Sprawdź: hub lista (tło `dark:bg-navy-900`), karty programów, filtry pills, panel dashboard, kreator modal.

**Asercje:**
- Wszystkie elementy czytelne w trybie ciemnym (biały tekst na ciemnym tle, obwódki widoczne).
- Pasek postępu completion widoczny: `dark:bg-white/[0.08]` tło + `bg-emerald-500` pasek.
- Input wyszukiwarki: `dark:bg-white/[0.04] dark:text-white`.
- Baner bursztynowy kreatora: `dark:text-amber-300` czytelny.
- Brak białych artefaktów „przebijających" przez ciemne tło.

### 9.4 A11y (dostępność)

**Kroki:**
1. Przejdź przez hub klawiaturą (Tab, Enter).
2. Sprawdź aria-labels kluczowych elementów.
3. Focus ring widoczny na aktywnych elementach.

**Asercje:**
- Przycisk „Wstecz": `aria-label="Wstecz"` / `"Back"`.
- Przycisk „Generuj ankiety": `aria-label` dynamiczny (stan generated vs aktywny).
- Przycisk „Usuń": `aria-label="Usuń"` / `"Delete"`.
- `MultiSelect` ma `aria-label="Szablony"` / `"Assignees"`.
- Ikony Send/Trash2 z `role="button"` + `tabIndex` + `onKeyDown` (Enter/Space) — klawiatura działa.
- **Uwaga:** `Send` i `Trash2` używają `<span role="button">` zamiast `<button>` — sprawdź focus trap i kolejność tabindex.
- Modal kreatora: focus na pierwszym polu po otwarciu; Esc zamknięcie (sprawdź czy zaimplementowane — może brak; odnotuj).

### 9.5 Zero błędów konsoli

**Wymóg:** Przez całą sesję testową w DevTools Console: zero `console.error`, zero uncaught exceptions, zero unhandled rejections.

**Szczególnie sprawdź:**
- Montowanie/odmontowanie modala (timery, `cancelled=true` guard w `useEffect`).
- Przełączanie language (i18n).
- Rapid delete + reload (race condition).

---

## 10. Testy regresji / automatyczne

### 10.1 Istniejące testy BE (wymagane uruchomienie)

```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx vitest run server/src/routes/__tests__/audit-programs.test.ts
```

**Oczekiwane:** 17 testów PASS, 0 FAIL. Pokrycie: CRUD cross-org 404, fan-out math, SEC-3 foreign-assignee filter, idempotency, rollup.

**Jeśli jakiś FAIL:** plik `server/src/routes/__tests__/audit-programs.test.ts` + `server/src/services/auditProgramService.ts` → zidentyfikuj regresję, odnotuj `plik:linia`.

### 10.2 Brak testów FE/E2E (odnotuj)

Brak plików testowych w ścieżkach FE (`.test.tsx`, `.spec.tsx`) dla komponentów M12. Backlog:
- T5: wizard 4-krokowy (unit test: step navigation, state, canProceed, reset on open)
- T6: hub lista+dashboard (unit: filter, load, handleDelete, handleGenerate states)
- T7: E2E S2→S5→S6 (Playwright/Cypress: pełny flow kreator → generate → rollup)

Odnotuj brak pokrycia FE jako L-09.

### 10.3 Sprawdzenie `auditPresets.ts` (unit — ręczna weryfikacja)

**Kroki:**
1. W konsoli przeglądarki:
   ```js
   import('/src/components/Audit/auditPresets.ts').then(m => {
     console.log('ISO areas:', m.ISO_27001_PRESET.areas.length);
     console.log('NC areas:', m.NEW_COMPANY_PRESET.areas.length);
   });
   ```
2. Lub grep: `grep -c "key:" src/components/Audit/auditPresets.ts`

**Asercja:** ISO_27001 = 14 obszarów, NEW_COMPANY = 6 obszarów. Każdy obszar ma `key`, `label.en`, `label.pl`, `suggestedRole.en`, `suggestedRole.pl`.

---

## §0 Zagadnienia do weryfikacji (niepewności i punkty sporne)

1. **Baner MVP (L-03):** Karta audytu notuje, że baner „generowanie nie jest zautomatyzowane w MVP" miał być poprawiony. Kod `AuditOrchestratorWizard.tsx:467-473` (krok Review) pokazuje NOWY tekst: „Rekord programu zostanie utworzony teraz. Ankiety i przypisania można wygenerować ze strony programu po jego utworzeniu." — to jest POPRAWNY tekst, nie stary baner. Zweryfikuj runtime — jeśli stary tekst nadal widoczny, to regresja.

2. **`MODULE_AUDITS: 'open'` vs dokumentacja:** Teczka M12 (sekcja 05) podaje `MODULE_AUDITS: 'closed'`. Kod `betaAccess.ts:41` = `'open'`. Stan bieżący = OTWARTY. Dokumentacja przestarzała — odnotuj (nie bug kodu).

3. **Esc na kreatorze:** Nie znaleziono handlerów `onKeyDown` / Esc na overlay modala. Sprawdź czy Esc działa — jeśli nie, odnotuj jako luka dostępności.

4. **Kliknięcie overlay zamknięcie:** Overlay `<div className="fixed inset-0...">` nie ma `onClick`. Kliknięcie poza modalem NIE zamyka go. Zachowanie intentional dla stabilności formularza — odnotuj i potwierdź z Piotrem.

5. **Orphaned assignments po DELETE:** Usunięcie programu `audit_programs` nie kaskaduje na `interview_assignments`. Weryfikacja: po usunięciu programu z ankietami — czy assignee nadal widzi ankiety w M10? Czy to oczekiwane?

6. **`ProgramDashboard` rollup — odświeżanie:** Rollup ładowany raz przy wybraniu programu (`useEffect([program.id, surveysGenerated])`). Brak auto-refresh. Po zakończeniu ankiety przez assignee → rollup w dashboardzie nieaktualny do momentu ponownego kliknięcia programu na liście. Odnotuj zachowanie.

---

## 11. Format raportu

Dla każdego punktu testowego podaj:

| Pole | Opis |
|---|---|
| **ID** | np. §1.1, §2.3, §4.2 |
| **Kroki** | co wykonano |
| **Oczekiwane** | asercja z tej specyfikacji |
| **Faktyczne** | co zaobserwowano |
| **Status** | `PASS` / `FAIL` / `SKIP` / `ODNOTUJ` |
| **Dowód** | screenshot UI + zrzut z Network (URL, status, payload) + dla `[DB]`: wynik SELECT |
| **Dla FAIL** | `plik:linia` + opis przyczyny + propozycja fixu |

---

## Definition of Done (M12)

- [ ] Wszystkie sekcje §1–§9 PASS lub ODNOTUJ z uzasadnieniem (SKIP = uzasadnione niewykonanie).
- [ ] E2E pętla S2→S5→S6 potwierdzona w Network + DB: kreator → POST 201 → generate-surveys → completion rollup zgodny z DB.
- [ ] Fan-out M10 cross-check: assignee widzi ankiety w `/discovery` → moje przydziały.
- [ ] 17 testów BE PASS (bez regresji).
- [ ] Beta gating przetestowany (§6.1 otwarty, §6.2 zamknięty `[FLAG]`).
- [ ] Zero błędów w konsoli przez całą sesję.
- [ ] PL i EN — wszystkie etykiety przetłumaczone.
- [ ] Light i dark mode — brak błędów wizualnych.
- [ ] Baner kreatora (L-03) zweryfikowany runtime — stary tekst NIE jest widoczny.
- [ ] L-01 (martwy FE edycji), L-02 (search kliencki), L-08 (hardkod hex) odnotowane jako znane długi, nie zgłaszane jako nowe bugi.

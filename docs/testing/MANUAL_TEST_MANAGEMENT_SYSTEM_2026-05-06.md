# Manual Test Management System (Antygravity)

Status: active  
Owner: QA Lead + Product Owner  
Scope: wszystkie testy manualne dla `consultify`, ze szczegolnym priorytetem dla AI Chat.

---

## 1) Cel systemu

Ten dokument jest operacyjnym zrodlem prawdy dla testow manualnych:
- co testujemy (kolejka),
- w jakiej kolejnosci (priorytety),
- jak testujemy (scenariusze),
- jakie dowody zbieramy (evidence),
- kiedy decydujemy GO/NO-GO.

---

## 2) Workflow zarzadzania testami

Kazdy temat przechodzi 7 krokow:
1. `Intake` - zglozenie tematu i ryzyk.
2. `Triage` - przypisanie priorytetu P0/P1/P2/P3.
3. `Design` - scenariusze i expected outcomes.
4. `Execution` - wykonanie przez testera.
5. `Evidence` - screenshoty + network + notatki.
6. `Defect log` - rejestr bledow i severity.
7. `Decision` - GO / GO_WITH_RISK / NO-GO.

Statusy taskow:
- `todo`
- `in_progress`
- `blocked`
- `done`
- `retest_required`

---

## 3) Priorytety i SLA

| Priorytet | Definicja | SLA reakcji | Wplyw na release |
| --- | --- | --- | --- |
| P0 | krytyczny blad funkcji, fake success, utrata danych, niedzialajaca glowna sciezka | natychmiast / ten sam dzien | twardy NO-GO |
| P1 | powazna regresja biznesowa lub jakosciowa | <= 24h | NO-GO lub GO_WITH_RISK |
| P2 | sredni problem UX/logiki bez krytycznej utraty funkcji | <= 72h | mozliwy GO_WITH_RISK |
| P3 | kosmetyka / copy / drobny UX | backlog | bez blokady release |

---

## 4) Kolejka testow manualnych (Master Queue)

| ID | Temat | Priorytet | Owner | Status | Wejscie | Wyjscie |
| --- | --- | --- | --- | --- | --- | --- |
| MQ-CHAT-001 | AI Chat reliability and trust | P0 | QA + AI Team | in_progress | dzialajace stage/demo, konto testowe | brak P0/P1 lub formalny NO-GO |
| MQ-CHAT-002 | Deep Thinking and Show Reasoning parity | P0 | QA + AI Team | todo | feature flags aktywne | brak petli, brak raw artifacts |
| MQ-CHAT-003 | Conversation history and folders stability | P0 | QA + Backend | todo | API conversations zdrowe | persistence po refresh/switch |
| MQ-CHAT-004 | Attachment ingestion and degraded truthfulness | P1 | QA + Backend | todo | plik poprawny + uszkodzony PDF | poprawna degradacja bez halucynacji |
| MQ-CHAT-005 | Product assistant quality (DBR77-first) | P1 | QA + Product | todo | aktualna baza wiedzy | odpowiedzi konkretne i produktowe |
| MQ-CROSS-001 | Cross-module smoke (tabs/navigation/actions) | P1 | QA + Frontend | todo | build green | przejscie Tier-0 runbook |
| MQ-SEC-001 | Access and tenant guardrails | P1 | QA + Backend | todo | role testowe | brak wyciekow tenantowych |
| MQ-USERS-001 | SuperAdmin User Management: role projektowa + dzial + stanowisko | P1 | QA + Admin FE/BE | todo | `/superadmin/customers/users`, konto superadmin, min. 2 organizacje | poprawny zapis/read-back po refresh + brak fake success |

---

## 5) Tematy testowe (test domains)

Kazdy sprint manualny musi pokrywac:
1. `Core functionality` - czy glowna wartosc dziala.
2. `Data integrity` - czy dane nie znikaja i sa spójne po refresh.
3. `Trust and transparency` - brak fake statusow i brak raw internals.
4. `Performance UX` - odczuwalna responsywnosc i stabilnosc.
5. `Error/degraded handling` - uczciwe komunikaty i recovery path.
6. `Product grounding` - odpowiedzi zgodne z domena DBR77.

---

## 6) Wymagajace scenariusze testowe (High-Stress Scenarios)

### 6.1 Chat Stress Pack (must-run)

1. **Fast follow-up chain (context retention)**
   - 5 pytan follow-up w jednej rozmowie.
   - fail gdy model "resetuje sie" i traci kontekst.

2. **Source integrity under ambiguous prompts**
   - pytania o DBR77/Consultify z podobnymi slowami w internecie.
   - fail gdy zrodla sa literalnie po slowach promptu, bez kontekstu produktu.

3. **Deep Thinking loop breaker**
   - aktywuj deep mode i potwierdz krok raz.
   - fail gdy wraca petla potwierdzen lub brak finalnej analizy.

4. **Raw internals suppression**
   - sprawdz brak: `Source ledger`, `Blocked scopes`, `rag_*`, `artifact:*`.
   - fail gdy jakikolwiek raw artefact jest widoczny dla uzytkownika.

5. **History durability**
   - create -> switch -> rename -> folder move -> refresh -> reopen.
   - fail gdy rozmowa znika, nie otwiera sie, lub wisi na loading.

6. **Attachment truthfulness**
   - 1 plik czytelny + 1 uszkodzony/scan PDF.
   - fail gdy system udaje, ze przeczytal uszkodzony plik.

7. **Professional output quality**
   - odpowiedz musi byc konkretna, profesjonalna i uzyteczna.
   - fail gdy odpowiedz jest powierzchowna, generyczna, bez wartosci.

### 6.2 Cross-Module Stress Pack

1. Dynamic tabs persistence po reload.
2. Navigation/action cards z retry i error state.
3. ACL role switch (user/admin) bez wyciekow.

### 6.3 User Management Pack (new)

1. **Edit user metadata (happy path)**
   - zmien `Project Role`, `Department`, `Position` dla aktywnego usera.
   - PASS gdy po save i po refresh dane sa identyczne w tabeli.

2. **Create user with profile metadata**
   - dodaj usera z wypelnionymi polami `Project Role`, `Department`, `Position`.
   - PASS gdy rekord istnieje i pola sa widoczne bez ponownej edycji.

3. **Clear optional metadata**
   - wyczysc `Project Role`, `Department`, `Position` dla istniejacego usera.
   - PASS gdy UI pokazuje stan `Not set` / `Department not set` / `Position not set`.

4. **Filter by Project Role**
   - ustaw filtr `All project roles -> PROJECT_MANAGER`.
   - PASS gdy lista zawiera tylko userow z dana rola projektowa.

5. **Search by Department and Position**
   - wyszukaj po frazie z `department` i osobno po `jobTitle`.
   - PASS gdy wyniki odpowiadaja wyszukiwaniu i brak false positives.

---

## 7) Standard evidence (obowiazkowy)

Dla kazdego case:
- `UI evidence`: min. 1 screenshot.
- `Source evidence`: screenshot sekcji citations/sources (jesli dotyczy).
- `Network evidence`: request + status + kluczowe pola response.
- `Verdict`: PASS/BLOCKED + jedno zdanie "dlaczego".

Nazewnictwo plikow:
- `YYYY-MM-DD_<case-id>_<short-name>_ui.png`
- `YYYY-MM-DD_<case-id>_<short-name>_network.png`
- `YYYY-MM-DD_<case-id>_<short-name>_notes.md`

---

## 8) Defect governance

Format defektu:
- `Defect ID`
- `Case ID`
- `Severity`
- `Repro steps`
- `Expected`
- `Actual`
- `Evidence path`
- `Owner`
- `ETA`
- `Retest status`

Reguly:
- kazdy P0/P1 musi miec ownera i ETA przed koncem dnia,
- zamkniecie defektu wymaga retestu i dowodu "after fix".

---

## 9) Bramka decyzji release

`NO-GO`:
- jakikolwiek otwarty P0,
- >= 2 otwarte P1,
- brak dowodow dla krytycznych case.

`GO_WITH_RISK`:
- max 1 P1 i zaakceptowany plan naprawczy + deadline.

`GO`:
- brak P0/P1 i komplet evidence.

---

## 10) Aktualna kampania: Chat (start now)

Campaign ID: `CHAT-CAMPAIGN-2026-05-06-A`  
Queue binding: `MQ-CHAT-001..005`

Must-run order:
1. Basic Chat + DBR77 source gate
2. Deep Thinking / Show Reasoning
3. Real work steps + attachments
4. Web research integrity
5. History/folders stability
6. Product assistant quality
7. Follow-up context retention
8. Trust and confidence rating

Exit condition:
- brak P0 i max 1 P1 -> mozliwy GO_WITH_RISK
- inaczej -> NO-GO

---

## 11) Prompt do testera manualnego (copy-ready)

Uzyj ponizszego promptu 1:1:

`Wykonaj kampanie CHAT-CAMPAIGN-2026-05-06-A na demo.consultify.ai. Przejdz 8 obszarow: (1) Basic Chat DBR77/Consultify, (2) Deep Thinking + Show Reasoning, (3) Realne kroki pracy + zalaczniki, (4) Web research integrity, (5) Historia i foldery, (6) Pytania produktowe, (7) Follow-up context, (8) Jakosc i zaufanie. Dla kazdego obszaru zwroc: status PASS/BLOCKED_P0/BLOCKED_P1/INCONCLUSIVE, 2-4 zdania obserwacji, oraz evidence: screenshot UI + screenshot Sources + screenshot Network. Oznacz osobno wszystkie przypadki: Source ledger/Blocked scopes/rag_*/artifact:* oraz No cited sources przy widocznych cytowaniach. Na koncu podaj decyzje globalna: GO/GO_WITH_RISK/NO-GO z lista P0/P1.`


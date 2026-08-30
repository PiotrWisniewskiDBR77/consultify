---
doc_id: funkcje-odbior-162
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 162 — domknięcie pochodzenia i napis o cofaniu

**Klasyfikacja: A na kłamstwie o cofaniu, B na pochodzeniu zadania.**
Wykonawca sam zgłosił `PARTIAL` — i jego „częściowo" okazało się **precyzyjne**.

Marker `218d020958`, 2 commity, 4 pliki. **Zero naruszeń licencji.**

## Kłamstwo o cofaniu — usunięte, dowód mutacyjny odtworzony niezależnie

`rollbackStateForResult` traci parametr `result`, usuwa cały blok `hasOutputRef`
i zwraca **bezwarunkowo** `rollback_unavailable`. Jedyny wołający to
`aiActionExecutor.ts:845` — nie ma drugiego miejsca, które mogłoby to obejść.

Prześledzony cały łańcuch do oczu użytkownika: `ActionCenter.tsx:311` czyta
`selectedAudit.audit?.rollbackStatus`, zasilane przez `GET /ai/actions/:id/audit`
→ `getAIRunByAction` → kolumna `audit` w `ai_run_ledger`, zapisywana przez
`recordAIRunEvent`. **Dla ścieżki `executeAction` będzie to teraz zawsze prawda.**

**Dowód mutacyjny odtworzony własnoręcznie:** przywrócenie starej logiki
(`hasOutputRef` → `rollback_available`) → test **1 FAIL/1 PASS**, dokładnie na
asercji uczciwości (`expected 'rollback_available' to equal 'rollback_unavailable'`).
Po przywróceniu: **2/2 GREEN**, drzewo czyste.

Test uderza w **produkcyjne** funkcje (`executeAction`, `TaskExecutor.execute`),
a asercje czytają realne wiersze `ai_run_ledger`/`ai_run_events`/`tasks` przez
`pool.query` na żywym Postgresie. `retry: 0`. Sprząta po sobie — zero wierszy po teście.

## ★ Nie przesadzono w drugą stronę — sprawdzone osobno

To było moje główne podejrzenie: naprawa kłamstwa, która tworzy kłamstwo odwrotne.
**Nie ma go.** `git diff` na `teresaCopilotService.ts` jest **pusty**. Teresa ma
własną, odrębną logikę (`rollback_unavailable` domyślnie, `rolled_back` po **realnym**
cofnięciu) i **nie dzieli funkcji** z `aiActionExecutor.ts`. Żadna działająca ścieżka
cofania nie zaczęła raportować „niedostępne".

## Historia audytu nienaruszona — z dowodem

Zero `UPDATE`/`DELETE` na starych wierszach. Test **celowo zasiewa historyczne wpisy**
ze starą wartością i porównuje ich skrót przed i po — identyczny. Mój bezwarunkowy
zakaz dotrzymany z pomiarem, nie deklaracją.

## Co NADAL kłamie — uczciwie przyznane

Dwie autonomiczne ścieżki AI (`aiActionExecutor.ts::_executeCreateTask`,
`taskExecutor.ts::TaskExecutor`) zapisują teraz `source='ai'`. **Ale główna,
działająca ścieżka produktowa** — `POST /api/my-work/personal-tasks` →
`TaskService.createTask` — **nadal pokazuje „Manual", nawet gdy autorem jest agent**.

Powód jest mój, nie wykonawcy: `TaskService.ts`, `agentApprovedMaterializationService.ts`
i `my-work.routes.ts` **imiennie wyłączyłem z licencji**, żeby nie kolidowały
z dyżurami 160 i 163. `git diff` obu plików pusty — zakaz dotrzymany co do joty.

**To zostaje do domknięcia i wchodzi do następnej serii.**

## ★ Znalezisko o naszym własnym narzędziu

Audytor uruchomił **dokładnie tę komendę, którą raport dokumentuje** — i dostał
pułapkę: `expected 'sqlite' to be 'postgres'`, bo `server/vitest.config.ts:17`
przypina `DB_TYPE` w bloku `test.env`, który **wygrywa ze zmienną z linii komend**.
Test ruszył dopiero po tymczasowym wyłączeniu tej linii.

Wykonawca najpewniej użył zewnętrznego configu spoza repo — ale **raport tego nie
ujawnia wprost**, a jego opis „zewnętrzny config wyłączył pułapkę" nie tłumaczy,
jak ta sama komenda miałaby ominąć przypięcie.

**Substancja dowodu jest prawdziwa** (odtworzona niezależnie RED→GREEN). Problemem
jest **przejrzystość opisu drogi do zieleni** — a to znaczy, że nikt nie odtworzy
tego wyniku z samego raportu.

**Wniosek szerszy: `server/vitest.config.ts:17` kosztuje nas czas w KAŻDYM dyżurze
dotykającym Postgresa.** To już nie pułapka do opisania w instrukcji, tylko
**dług do spłaty**. Wchodzi do następnej serii.

## Dwa testy pinujące kłamstwo — zostają

```text
tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts:320  toBe('rollback_available')
tests/unit/ai/wave3-governance-contract.test.ts:116            expect(executor).toContain('rollback_available')
```

Pierwszy realnie pada. Drugi jest **gorszy**: sprawdza, czy **plik źródłowy zawiera
napis** — przechodzi nawet gdy napis został wyłącznie w deklaracji typu i żadna
ścieżka go nie produkuje. **Mierzy obecność tekstu, nie zachowanie.**

Wykonawca ich nie ruszył, bo były poza licencją, i **zgłosił to zamiast naciągnąć**.
Tak ma być.

## Czego NIE zweryfikowałem

- Pełnej ścieżki HTTP z podpisanym JWT dla obu executorów — test uderza w funkcje,
  nie przez sieć. **Wykonawca przyznał to sam.**
- Osiągalności `/ai/action-center` w przeglądarce (tylko statyczny grep routingu).
- Liczby 74/75 w zastanym pakiecie — potwierdzona wyłącznie obecność linii 320.
- Czy `rollback_available` nie jest zapisywane gdzieś jeszcze poza dwoma znanymi
  plikami — poleganie na grepie, nie pełnym przeglądzie.

## Werdykt

**Do scalenia jako B.** Naprawa jest realna, mutacja ją broni, licencja dotrzymana
co do joty, a wszystkie braki są nazwane przez samego wykonawcę przed odbiorem.

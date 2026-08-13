# COORDINATION_REQUIRED — trzy rozłączne rejestry treści Assessment

> To **nie jest** decyzja techniczna, którą wolno mi podjąć samodzielnie, i dlatego
> jej nie podejmuję. Opisuję mechanizm, dowody i konsekwencje każdej opcji.

---

## 1. Objaw

Na świeżej instalacji **nie istnieje sekwencja kliknięć tworząca sesję DRD ani SIRI.**
Potwierdzone niezależnie przez **dwa** źródła:

| Źródło | Ustalenie |
| --- | --- |
| mój agent E2E (własne środowisko, własny kontener) | `SELECT count(*) FROM assessment_definitions` → **0**; `canStart = supported && !!drdDefinition` → `false`; przycisk „Start" trwale wyszarzony |
| równoległa sesja (`assessment-trzy-rejestry-blokada-2026-08-13`) | ten sam wniosek, niezależnie, w prawdziwej przeglądarce |

---

## 2. Mechanizm — trzy rejestry, przycisk czyta pusty

| | Rejestr | Stan | Kto go czyta |
| --- | --- | --- | --- |
| **A** | legacy `assessment_definitions` | **0 wierszy** | ★ **jedyne** źródło sprawdzane przez widoczny przycisk „Start" (`AssessmentLibraryTab` → `V8AssessmentApi.getDefinitions('DRD')`) |
| **B** | `method_packs` | zaseedowany (DRD 2.0.0-methodpack.1: 39 jednostek / 233 poziomy / 699 pytań) | silnik method-core — ale **żaden widoczny komponent go nie sprawdza** |
| **C** | flagi `drdMethodWorkspaceSliceV1`, `drdHttpSourceOfTruthV1` | domyślnie OFF | brak działającej powierzchni do włączenia (zakładka Feature Flags zwraca błąd) |

★ Nawet gdyby rejestr A miał wiersz, `handleStart` woła `V8AssessmentApi.createAssessment()`
— **inny system** (`assessments`), nie `method_sessions`. To rozjazd **strukturalny**,
nie „pusta tabela".

---

## 3. Dlaczego NIE naprawiam tego sam

| Powód | |
| --- | --- |
| **Decyzja produktowa, nie inżynierska** | Trzeba rozstrzygnąć, **który rejestr jest kanoniczny** i czy legacy `assessment_definitions` umiera. To wybór o konsekwencjach poza tym modułem. |
| **Ryzyko dla istniejących danych klientów** | Legacy ścieżka V8 `assessments` może nieść wyniki istniejących klientów. Przełączenie lub wygaszenie jej jednostronnie to **nieodwracalna zmiana istniejących wyników** — pozycja z listy eskalacji koordynatora. |
| **Praca już trwa gdzie indziej** | Równoległa sesja ma kandydata `031772082b` na `codex/assessment-complete-20260813` dotykającego dokładnie tego obszaru. Duplikowanie = konflikt scalania i fantomowe defekty. |

---

## 4. Co to znaczy dla odbioru tej fali

| Element | Wpływ |
| --- | --- |
| Silnik method-core | **działa** — pełny łańcuch przez HTTP dowiedziony na żywym procesie, z restartem i reopen |
| Browser E2E (STRUMIEŃ 4) | wykonany przez harness `dev-render` z **realnym** HTTP; krok „Library → Session" **przez naturalny klik w aplikacji jest martwy** — zaraportowane jako ustalenie, **nie obejście** |
| „Library → Session" w produkcie | **BLOCKED** do czasu decyzji |

★ Mój agent E2E miał jawny zakaz obchodzenia tego SQL-em i **nie obszedł** —
oznaczył jako ustalenie. To jest poprawne zachowanie, nie brak wyniku.

---

## 5. Opcje dla koordynatora (bez rekomendacji wiążącej)

| Opcja | Skutek | Ryzyko |
| --- | --- | --- |
| **1. Most addytywny** — przycisk „Start" sprawdza **także** `method_packs`, legacy zostaje nietknięty | ścieżka klikalna odblokowana, zero utraty danych | dwa rejestry współistnieją dalej (dług) |
| **2. `method_packs` kanoniczny, legacy wygaszony** | jeden model, koniec rozjazdu | ★ **wymaga migracji istniejących danych klientów**; nieodwracalne |
| **3. Publikacja definicji do legacy** | najmniejsza zmiana kodu | utrwala model, który method-core i tak zastępuje |

Opcja **1** jest jedyną, którą dałoby się wykonać bez dotykania danych klientów —
ale nawet ona przesądza kierunek architektury, więc czekam na rozstrzygnięcie.

---

## 6. SIRI — osobno

Przycisk mówi „Not available in this MVP”, pakiet ma `readiness=draft`, **0 z 16
wymiarów niesie pytania**. Ścieżka jest niewykonalna niezależnie od bramek UI.
**Nie wolno tego uzupełnić generowaniem** — SIRI to metodyka licencjonowana INCIT.

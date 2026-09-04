---
doc_id: wave3-testy-puste-dowody-20260904
status: aktualny
data: 2026-09-04
---

# Testy puste — dowody mutacyjne z odbioru adwersaryjnego (04.09)

★ **Ten plik jest pisany ręcznie.** Sąsiedni `REJESTR_TESTY_PUSTE_20260903.md` jest
**generowany** przez `scripts/dev/testy-puste-skan.mjs` i każdy przebieg bezpiecznika
`tests/unit/config/noEmptyAssertions.test.ts` nadpisuje go w całości — ręczny dopisek tam
znika bez śladu (zdarzyło się 04.09, dopisek przeżył 12 minut). Wnioski, których skaner nie
umie wyprodukować, trzymamy tutaj.

## Dlaczego kolumna `PUSTY` w rejestrze stoi na 0

Skaner **nigdy** nie nadaje klasy `PUSTY` na podstawie tekstu — wymaga dowodu mutacyjnego,
którego sam wykonać nie może. Dyżur 309 odmówił zgadywania i to była decyzja uczciwa.
Odbiorca adwersaryjny (Opus, 04.09) wykonał 5 mutacji funkcji **produkcyjnych**:

| Kandydat | Mutacja produktu | Wynik | Klasa |
|---|---|---|---|
| `scimService.test.ts` | `SCIMService.ts` → `export default {}` | **12/12 PASS** | **PUSTY** |
| `contentService.test.ts` („should return dashboard data”) | funkcja zwraca `{-999,-999}` | **PASS** | **PUSTY** |
| `billingCron` | mutacja funkcji | test czerwieni | NIE pusty |
| `siemService` | mutacja funkcji | test czerwieni | NIE pusty |
| `chatPolicyGateway` | mutacja funkcji | test czerwieni | NIE pusty — ale broni **tylko literału**: produkcja bezwarunkowo dopisuje dwa napisy do listy, nie ma tam egzekucji do zmutowania |

**Ekstrapolacja odbiorcy: rzędu 8 pustych z 21 kandydatów.**

## Ślepa plama skanera — poza zasięgiem obecnej heurystyki

Skaner szuka sygnału sieci/bazy, więc nie widzi testów, które z produktem nie rozmawiają wcale:

- **267 plików / 1766 bloków** bez żadnego wiązania z produktem;
- **13 plików definiuje PODMIOT TESTU wewnątrz pliku testu** — np.
  `const MessageBubble = () => <div data-testid=... />`. Test renderuje własną atrapę
  i przechodzi niezależnie od tego, co robi produkt. To jest kształt „biblioteka bez
  wywołania” przeniesiony do testów;
- `tests/unit/services/api-extensions.test.ts` **testuje moduł, którego w repo nie ma** —
  `find` po `*api-extensions*` w `src/` i `server/` zwraca pustkę.

## Do następnego dyżuru
1. Rozszerzyć skaner o wykrywanie podmiotu testu zdefiniowanego w pliku testu.
2. Rozstrzygnąć mutacją pozostałe 16 kandydatów (2 z 21 już rozstrzygnięte jako `PUSTY`).
3. Usunąć albo naprawić `api-extensions.test.ts`.

## Dyżur 318 — dowody własne

| ID | Kandydat | Mutacja produktu | Przed | Po mutacji | Klasa na markerze | Działanie |
|---|---|---|---|---|---|---|
| E0016 | `billingCron.test.ts:111` — `should handle database errors` | `server/cron/billingCron.ts::checkAndTriggerAlerts` → natychmiastowy `return` | PASS | PASS | **PUSTY** | Mock bazy zmieniony na odrzucany Promise; dodano asercję zapytania i braku wywołania serwisu. Po naprawie: PASS; ta sama mutacja: FAIL. |
| E0017 | `billingCron.test.ts:119` — `should continue processing even if one org fails` | `server/cron/billingCron.ts::checkAndTriggerAlerts` → natychmiastowy `return` | PASS | PASS | **PUSTY** | Mock bazy zmieniony na Promise z dwiema organizacjami; dodano asercje obu wywołań serwisu. Po naprawie: PASS; ta sama mutacja: FAIL. |
| E0002 | `SlashMenu.behavior.test.tsx:145` — filtr `ai` | `SlashMenu.tsx` → filtr zawsze zwraca pustą listę | PASS | FAIL | **NIE PUSTY** | `e2-przed.json`, `e2-mutacja.json`; mutacja cofnięta, diff produktu pusty. |
| E0004 | `help.routes.test.ts:79` — rationale `en` + `pl` | `buildRationale` → `en=''`, `pl=''` | PASS | FAIL | **NIE PUSTY** | `e4-przed.json`, `e4-mutacja.json`; właściwy config serwerowy, mutacja cofnięta. |
| E0006 | `governedRetrievalService.test.ts:318` — walidacja ACL | `checkACL` → pusty obiekt | PASS | FAIL | **NIE PUSTY** | `e6-przed.json`, `e6-mutacja.json`; właściwy config serwerowy, mutacja cofnięta. |
| E0012 | `my-work.convert.contract.test.ts:226` — zapis `promoted_to` | SQL produktu `promoted_to` → `mutated_to` | PASS | FAIL | **NIE PUSTY** | `e12-przed.json`, `e12-mutacja.json`; mutacja cofnięta. |
| E0015 | `aiContextBuilder.test.ts:68` — pełny kontekst | `buildContext` → pusty obiekt | PASS | FAIL | **NIE PUSTY** | `e15-przed.json`, `e15-mutacja.json`; mutacja cofnięta. |
| E0001 | `MeetingHub.smoke.test.tsx:120` — błąd i retry | nie wykonano: baseline jest czerwony | FAIL (`querySelector` na `null`, linia 134) | n/d | **NOT_PROVEN** | `e1-przed.json`; bez zielonego kierunku mutacja nie rozstrzyga klasy. |
| E0003 | `table-platform.routes.test.ts:427` — istnienie route | nie wykonano: baseline jest czerwony | FAIL (`argument handler must be a function`) | n/d | **NOT_PROVEN** | `e3-przed.json`; uruchomiono z `server/vitest.config.ts`, bez zielonego kierunku. |
| E0008 | `CandidatesTable.t28.test.tsx:49` — kolumny kandydata | nie wykonano: suite nie ładuje produktu | FAIL (zerwana ścieżka importu `../../../src/...`) | n/d | **NOT_PROVEN** | `e8-przed.json`; 0 wykonanych przypadków, więc nie ma baseline do mutacji. |
| E0009 | `ollama.integration.test.ts:22` — health | brak funkcji produktu; blok woła bezpośrednio `localhost:11434` | SKIP przy `OLLAMA_TEST=false` | n/d | **NOT_PROVEN** | `e9-przed.json`; uruchomienie z `OLLAMA_TEST=true` narusza Z15. |
| E0010 | `ollama.integration.test.ts:82` — streaming | brak funkcji produktu; blok woła bezpośrednio `localhost:11434` | SKIP przy `OLLAMA_TEST=false` | n/d | **NOT_PROVEN** | `e10-przed.json`; brak dopuszczalnego celu mutacji produktu. |
| E0011 | `ollama.integration.test.ts:102` — chat completions | brak funkcji produktu; blok woła bezpośrednio `localhost:11434` | SKIP przy `OLLAMA_TEST=false` | n/d | **NOT_PROVEN** | `e11-przed.json`; brak dopuszczalnego celu mutacji produktu. |
| E0013 | `pmo-project-members.integration.test.ts:115` — typy RACI | nie uruchomiono: test importuje `server/src/index.ts` | n/d | n/d | **NOT_PROVEN** | Z30 wprost zakazuje uruchamiania pełnego `server/src/index.ts` dla testów; brak bezpiecznego celu mutacji. |
| E0014 | `workbook.p23ext.test.ts:374` — lista workbooków | brak funkcji produktu; bezpośredni `fetch` do runtime i `return` przy jego braku/401 | n/d | n/d | **NOT_PROVEN** | Blok nie importuje handlera; instrukcja przydziela harness 5474, a test nie montuje go i ma własny adres. |

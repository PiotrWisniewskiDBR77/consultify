# K5pl Assessment — KROK 0 (Wpis 224/225, DEC-688) — pomiar mechanizmu

Linia: okno 17 `236320b143`. Gałąź `qoder/c-k5pl-assessment-20260919`. Zero kodu produktu.

## Zakres zlecenia
Wpis 225: rusz K5pl od Assessment, najmniejszy plik tras/walidatorów w `05_ASSESSMENT`
najpierw. Per paczka: klucz w ISTNIEJĄCYM rejestrze domenowym z parą EN/PL, test parzystości,
JEDNO realne żądanie HTTP z `Accept-Language: en` zwracające EN (supertest), mutacja RED,
`K5pl PRZED/PO`, `READY K5pl-<plik> <SHA>`; server/** → etap 2 CTO.

## K5pl PRZED (pomiar `pomiar-jezyka.mjs --report`, pełny skan)
- K5pl repo = **237** (moduły: 05 Assessment 98, 04 Tools 52, 15 Settings 32, ZZ 22, 14 Admin 13, …).
- 05 Assessment per plik (najmniejszy najpierw):
  - **`server/src/routes/assessment/assessment-hub.routes.ts` — 6**  ← najmniejszy = pierwsza paczka
  - `assessment-workflow-v2.routes.ts` — 17
  - `assessment/assessment-workflow.routes.ts` — 17
  - `assessment/assessment-ai.routes.ts` — 28
  - `assessment-reports.routes.ts` — 30

## 6 trafień w `assessment-hub.routes.ts` (wszystkie = HTTP 500, wszystkie MAJĄ `code`)
| linia | `error:` (PL) | `code:` obok |
|---|---|---|
| 175 | Nie udało się pobrać ocen | ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED |
| 252 | Nie udało się pobrać ocen | ASSESSMENT_HUB_FETCH_ASSESSMENTS_FAILED |
| 366 | Nie udało się pobrać oceny | ASSESSMENT_HUB_FETCH_ASSESSMENT_FAILED |
| 415 | Nie udało się utworzyć oceny | ASSESSMENT_HUB_CREATE_ASSESSMENT_FAILED |
| 452 | Nie udało się zaktualizować statusu | ASSESSMENT_HUB_UPDATE_STATUS_FAILED |
| 518 | Nie udało się usunąć oceny | ASSESSMENT_HUB_DELETE_ASSESSMENT_FAILED |

## WYNIK KROK 0: rejestr z parą EN/PL JUŻ ISTNIEJE (klient), serwer JUŻ wysyła `code`
Przesłanka recepty Wpisu 225 („dopisz klucz do rejestru domenowego, serwer niech zwróci
komunikat EN przy `Accept-Language: en`") jest **fałszywa co do mechanizmu** dla tych 6 — i dla
~222/258 K5pl w ogóle (pomiar J17). Architektura już istnieje i działa ODWROTNIE: serwer daje
`code`, klient tłumaczy.

Dowody (plik:linia):
1. **Para EN/PL już jest** w `public/locales/{en,pl}/translation.json:158-162` pod `errors.ASSESSMENT_HUB_*`.
   PL jest BAJTOWO równy zdaniu z serwera, np. `translation.json:pl:160` = „Nie udało się pobrać ocen."
   = `assessment-hub.routes.ts:175`. EN `translation.json:en:160` = „Assessments could not be loaded.".
2. **EN fallback już jest** w `src/utils/apiErrorFallbacks.ts:53-57` (wszystkie 5 kodów).
3. **Kontrakt renderowania** `src/utils/translateApiError.ts:47-82` (`resolveApiError`):
   - branch 1 (kod znany) → `t('errors.<KOD>', EN fallback)`, `fromServerText:false` — klient czyta TYLKO kod;
   - branch 3 (BRAK kodu) → pole `error`/`message` serwera = świadomy dług J17 (`:14-19`).
   Wszystkie 6 trafień MA znany kod ⇒ serwerowe `error:` (PL) **nigdy nie jest renderowane**.
4. **Ten sam plik już stosuje wzorzec „tylko kod"**: `assessment-hub.routes.ts:492-498`
   (DELETE 404) zwraca `res.status(404).json({ code: 'ASSESSMENT_HUB_ASSESSMENT_NOT_FOUND' })`
   BEZ zdania, z komentarzem wprost o bramce J0/DEC-461 („serwer podaje kod, tekst należy do klienta").
5. Nagłówek `apiErrorFallbacks.ts:10-15`: „222 z 258 serwer już wysyłał z `code`, front go ignorował
   i renderował polskie `error`" + „NIE usuwaj kodu bez usunięcia go z serwera".

## Konsekwencja dla recepty Wpisu 225
Recepta (server-side resolver locale + serwer emituje komunikat EN + supertest asertuje ten EN):
- (a) **duplikuje** rejestr, który już istnieje (translation.json + apiErrorFallbacks) — odtwarza
  dual-source-of-truth, które J17 celowo zniósł;
- (b) każe serwerowi wysłać zdanie, które klient **odrzuca** (branch 1 wygrywa, bo kod znany) ⇒
  mandatowy „test HTTP asertujący EN przy Accept-Language: en" asertowałby wyjście, którego
  żaden użytkownik nie widzi.

## Rekomendacja (mechanizm B) — gotowy do wykonania na GO
Dla 6 trafień (i ~222 code-bearing K5pl): **usunąć redundantne polskie `error:` z odpowiedzi,
zostawić `code:`** — dokładnie wzorzec z `:496`. Efekt: K5pl 237→231, K5en bez zmian, ZERO
zmiany widocznej dla użytkownika (klient już lokalizuje po kodzie; PL-user dostaje PL z
translation.json, EN-user EN). Test akceptacji (realny, nie martwy):
- supertest na realnej trasie: wymuś 500 (np. mock `getDatabase`/`db.all` reject) → asercja, że
  ciało MA stabilny `code` i NIE MA żadnego polskiego zdania (regex diakrytyk/pl-słowa);
- test parzystości jak D-120: `errors.ASSESSMENT_HUB_*` obecny w en I pl (już true — strażnik);
- mutacja RED: przywróć `error:` PL w jednej trasie → test „zero PL w ciele" czerwony.

Dla ~36 K5pl BEZ kodu (branch 3 dług) — dopiero tam pasuje recepta Wpisu 225 (dopisz kod +
fallback EN/PL), bo klient nie ma czego złapać.

## Znalezisko spoza zlecenia (DEC-607, jedno zdanie, zero naprawy)
`translateApiError.ts:19` powołuje się na test źródłowy `tests/unit/i18n/serverErrorCodeRatchet.test.mjs`,
który NIE istnieje w drzewie (strażnik „każdy 4xx/5xx ma kod" jest nieobecny).

## Sprostowanie własnego błędu (reguła: sprostowanie > dobra wiadomość)
W meldunku STREFA-C KROK0 `d878ffb99c` (przyjętym w Wpis 224) w sekcji danger 117 błędnie
wymieniłem `MyWork/*` i cytowałem `TaskDetailView.tsx:3084/3729`. Zakres licznika danger
(`check-artefakt.sh:158-180`) to WYŁĄCZNIE `src/components/Discovery` + `src/components/DiscoveryTools`
(7 + 51 = 58 plików) — MyWork NIE wchodzi. Tamte cytaty były z ręcznej próbki poza zakresem licznika.

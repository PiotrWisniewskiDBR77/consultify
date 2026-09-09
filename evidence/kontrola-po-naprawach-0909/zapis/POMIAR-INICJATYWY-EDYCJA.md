# Inicjatywy — pomiar ścieżki EDYCJI (09.09.2026, 21:35–21:45)

Stanowisko: kopia `consultify_kontrola` ze zrzutu stagingu 21:08 (236 MB, schemat
zgodny ze stagingiem co do sztuki: 1817 tabel · 6031 indeksów · 16462 ograniczeń),
API 4213 (`NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`), Vite 3231, konto
`james.whitfield@northwind.example`.

## 1. Tworzenie — DZIAŁA (naprawa incydentu potwierdzona ruchem)

Kliknięte w UI: „New initiative" → **„Fill in the form"** → tytuł, poziom, projekt
(`RequiredProjectPicker`, wybrany „Operational Excellence Programme"), oś, podsumowanie
→ „Create".

    201 POST /api/initiatives/runtime-v1/source-proposals
    201 POST /api/initiatives/runtime-v1/registrations

Rekord widoczny na liście modułu (12 wierszy, nowy na pierwszej pozycji), 0 błędów
konsoli, 0 odpowiedzi 4xx na samej liście.

## 2. ★ Edycja — NIE DZIAŁA dla 12 z 13 inicjatyw (defekt nowy, nieopisany)

Zaraz po utworzeniu aplikacja otwiera ekran-artefakt nowej inicjatywy. Tam:

    404 GET  /api/initiatives/<id>
    404 GET  /api/v8/planning/initiatives/<id>
    404 GET  /api/my-work/object-attachments/initiative/<id>
    404 PUT  /api/initiatives/<id>        ← powtarzane co ~1,5 s bez końca

Plakietka na ekranie: **„Unsaved"**, na stałe.

### 2a. To NIE jest problem tylko nowego rekordu
Otwarcie ekranu-artefaktu **istniejącej** inicjatywy „MES Rollout Line 3"
(`d06a7a14-…`, status IN_EXECUTION) daje pętlę:

    400 PUT /api/initiatives/d06a7a14-…   co ~1,5 s, w nieskończoność
    {"error":"Status cannot be changed via this endpoint. Use POST /initiatives/:id/status
     (or the transition actions) so gate validation is enforced.",
     "field":"status","rule":"STATUS_TRANSITION_REQUIRES_GATE",
     "from":"IN_EXECUTION","to":"DRAFT"}

**Klient NIE wysyła pola `status`.** Zmierzone dwiema drogami:
- klucze ładunku PUT przechwycone w przeglądarce: `summary, description,
  problemStatement, deliverables, deliverablesDone, successCriteria, scopeIn,
  scopeOut, killCriteria, estimatedBudget, resourceTools, tags, targetState`
  — `status = undefined`;
- `PUT /api/initiatives/<id>` z ciałem `{"summary":"..."}` (jedno pole) → **400**,
  ta sama treść błędu.

### 2b. Zakres: pomiar per status (kolejno, na 4 realnych inicjatywach)

| status inicjatywy | `PUT /api/initiatives/:id` | wynik |
|---|---|---|
| DRAFT | 200 „Initiative updated" | zapis przechodzi |
| PROPOSED | **400** STATUS_TRANSITION_REQUIRES_GATE | zapis niemożliwy |
| APPROVED | **400** | zapis niemożliwy |
| IN_EXECUTION | **400** | zapis niemożliwy |

`GET /api/initiatives` zwraca 13 inicjatyw; DRAFT jest **jedna**. Czyli edycja
działa dla 1 z 13 rekordów.

### 2c. Przyczyna (dwa pliki, jedno zdanie)
1. `server/src/validators/initiative.validators.ts:70` —
   `status: InitiativeStatusEnum.optional().default('DRAFT')` w
   `InitiativePayloadBaseSchema`, z którego przez `.partial()` powstaje
   `UpdateInitiativeSchema`. `validateBody` **podmienia `req.body` na obiekt PO
   parsowaniu**, więc brak pola `status` w żądaniu zamienia się w `status:'DRAFT'`
   w ciele, które widzi kontroler.
2. `server/src/controllers/InitiativeController.ts:822-833` — bramka M13
   (`if (body.status !== undefined)`) widzi wstrzyknięty `DRAFT`, porównuje z
   rzeczywistym statusem i odrzuca żądanie jako niebramkowaną zmianę statusu.

Bramka jest słuszna; fałszywy jest `default('DRAFT')` na ścieżce aktualizacji.

## 3. Dwa źródła prawdy dla tej samej inicjatywy
Nowo utworzona inicjatywa:
- **jest** w `/api/initiatives/runtime-v1/initiatives` (stąd czyta lista modułu — sprawdzone
  przechwyceniem odpowiedzi zawierających jej tytuł: to JEDYNA taka trasa);
- **nie ma** jej w `GET /api/initiatives` (13 pozycji, bez niej) ani w tabeli
  `initiatives` (`SELECT … WHERE title LIKE 'KONTROLA-%'` → 0 wierszy);
- **jest** w `ie_aggregate_state` (`aggregate_type='initiative'`).

Skutek dla właściciela: rekord widać na liście, ale po otwarciu ekran nie ma czego
wczytać (404) i nie ma gdzie zapisać.

## 4. Sprostowanie własnego pomiaru
Po pierwszym przebiegu zameldowałem sobie „nowa inicjatywa nie trafiła na listę"
(licznik `naLiscie=0`). **Nieprawda** — licznik mierzył ekran-artefakt, na który
aplikacja przeskoczyła po utworzeniu, a nie listę. Przy wejściu na `/initiatives?tab=list`
rekord jest pierwszym z 12 wierszy. Powyżej jest wersja poprawiona.

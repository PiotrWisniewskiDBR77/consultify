---
doc_id: funkcje-odbior-168
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 168 — bootstrap polityki widoczności wskaźnika

**Klasyfikacja: A na WSZYSTKICH pięciu częściach. Zero naruszeń licencji.**
Pierwszy dyżur tego dnia bez ani jednej części na B lub niżej.

Marker `18ba1bd3cf`, 2 commity, **5 plików** — dokładnie te z licencji, diffstat
zgodny co do liczby. `server/src/services/resultsVnext/okr/**` — **pusty diff**,
granica z dyżurem 169 dotrzymana.

## ★ Bramka odbioru właściciela — SPEŁNIONA, powtórzona dwukrotnie

Warunek zapisany przez właściciela brzmiał: na czystej bazie, w świeżej organizacji
przejść całą ścieżkę, z dowodem **z bazy**, nie ze statusu HTTP.

Odtworzone niezależnie, **dwa razy, na dwóch różnych świeżych organizacjach**:

```text
POST /api/vnext/results/kpi        → 201
PUT  .../draft (cadence 30 → 14)   → OK
POST .../measurements              → 201, actual_value 73.5

psql (odczyt surowy, poza asercjami testu):
  polityka  kpi / OPEN_ORG / is_active = true
  definicja measurement_frequency_days = 14
  pomiar    actual_value = 73.5, source = day168-runtime-proof
```

**W świeżej organizacji da się teraz założyć pierwszy wskaźnik.**

## ★★ Kontrola widoczności NIE została osłabiona — to był zakaz najwyższej wagi

Sprawdzone linia po linii i potwierdzone własnym dowodem mutacyjnym:

- bramka `NO_ACTIVE_VISIBILITY_POLICY` (`kpiDefinitionCommands.ts:383`) **istnieje bez
  zmian** i wykonuje się **PO** próbie bootstrapu, na **osobnym, świeżym odczycie** —
  nie na wyniku bootstrapu z pamięci
- **brak `try/catch`** wokół `publishVisibilityPolicy` — błąd zapisu przerwałby
  transakcję, nie zostałby połknięty
- tryb `OPEN_ORG` **nie jest wyborem „najotwartszym na wszelki wypadek"** — to
  dokładnie ten sam tryb, który ustawia istniejący seed
  (`seed-wave3-results-owner-review.ts:181`: `['kpi','OPEN_ORG']` obok `['okr','OPEN_ORG']`)
- **org scoping z tokenu**: `organizationId` pochodzi z `auth.organizationId`
  (`kpi.routes.ts:362`), **nigdy z ciała żądania** → nie da się utworzyć polityki
  dla cudzej organizacji

**Dowód mutacyjny odtworzony osobiście:** podmiana `if (!existingPolicy)` na
`if (false && !existingPolicy)` → test **1/1 czerwony** z dokładnie
`409 NO_ACTIVE_VISIBILITY_POLICY` zamiast `201`. Po przywróceniu — drzewo czyste.

**Bramka jest nadal szczelna.**

## `measurement_frequency_days` — wszystkie CZTERY warstwy

To był kształt, który dziś wielokrotnie udawał gotowe: naprawa jednej warstwy
z czterech. Tu naprawiono wszystkie, każda potwierdzona `grep -n`:

| warstwa | linie |
|---|---|
| Zod | `resultsVnextKpi.validators.ts:110,150` |
| interfejsy komend | `kpiDefinitionCommands.ts:266,531` (+ przekazanie `315,443,603-606`) |
| SQL | `INSERT :424`, `UPDATE :602-632` |
| trasy | `kpi.routes.ts:379,623` |

**Dowód z bazy, nie z asercji testu:**
`measurement_frequency_days = 14`, `row_version = 2` — przez `POST` **i** `PUT`.

## Brak migracji — słusznie

Kolumna istniała od `20260813_rvn_kpi_measurement_cadence.sql`. Wykonawca **nie dodał
zbędnej migracji**, a mimo to uruchomił bramkę: `DAY161_FRESH_MIGRATION_GATE=PASS`.
**To jest właściwa dyscyplina** — sprawdzić łańcuch, nawet gdy się go nie dotyka.

## Uczciwość wobec pułapki configu

Oba configi (`vitest.config.ts:210` i `server/vitest.config.ts:17`) nadal mają
`DB_TYPE: 'sqlite'` w bloku `env`. Test nadpisuje `process.env.DB_TYPE` w `beforeAll`
**przed** inicjalizacją `ApiGateway`. **Wykonawca ujawnił to wprost** w sekcji pułapek,
zamiast przemilczeć — czyli audytor mógł odtworzyć przebieg z samego raportu.
**To jest dokładnie to, czego zabrakło w dyżurze 162.**

## Jedno ryzyko niezmierzone — nieopisane, ale nie z tego pakietu

Brak zabezpieczenia przed wyścigiem dwóch równoległych pierwszych zapisów do tej samej
świeżej organizacji: blokada doradcza jest kluczowana `org:idempotencyKey`, więc nie
serializuje dwóch różnych żądań. Tabela ma jednak `EXCLUDE USING gist` na
`(organization_id, domain, tstzrange)`, więc kolizja skończy się **błędem 500**, a nie
podwójną aktywną polityką ani obejściem bramki.

**To defekt odporności, nie bezpieczeństwa** — i **istnieje już w niezmienionym
wzorcu OKR**, więc nie jest regresją tego dyżuru. Do inwentarza, nie do naprawy tutaj.

## Czego NIE zweryfikowano

- Stanu polityk na demo, stagingu i produkcji — **zakaz połączenia, dotrzymany
  po obu stronach**.
- Realnego przebiegu `server/src/index.ts` — tylko montaż `ApiGateway` w teście.
- Zachowania przy równoległych pierwszych zapisach — opisane wyżej, nietestowane.
- Endpointu publikacji ROI w runtime — istnienie potwierdzone kodem, nie przebiegiem.

## Werdykt

**Do scalenia. Wzorcowy dyżur.** Naprawa jest transakcyjna, ograniczona do organizacji
wywołującego, naśladuje istniejący i zaakceptowany wzorzec zamiast wymyślać trzeci,
nie osłabia kontroli dostępu, pokrywa wszystkie cztery warstwy pola i **ujawnia własną
metodę uruchomienia testu** — dzięki czemu jest odtwarzalna.

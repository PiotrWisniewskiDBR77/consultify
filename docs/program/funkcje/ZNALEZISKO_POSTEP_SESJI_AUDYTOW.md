---
doc_id: funkcje-znalezisko-postep-sesji
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# Kolumna „Postęp" w Sesjach audytu pokazuje literalnie „/" — na KAŻDYM wierszu

Znalezione przy wykonywaniu rozkazu pomiarowego `W5` w FIX-220. **Defekt jest żywy,
istniał przed dyżurem 220 i nie został przez niego ani spowodowany, ani naprawiony.**
Zgłoszony, **nie łatany** — poza licencją tamtego dyżuru.

## Pomiar (realny Postgres, strict migracje, realny `ApiGateway`, podpisany token)

Trasa `GET /api/audits/programs` zwraca:
```
"criteriaTotal":1, "criteriaConcluded":1, "findingsOpen":1
```

Ekran czyta (`AuditProcessesTab.tsx:249`):
```
row.concludedCriteria / row.applicableCriteria      ← kolumna „Postęp"
row.openFindings                                    ← kolumna „Ustalenia otwarte"
```

**Żadna z tych trzech nazw nie istnieje w odpowiedzi.** Nazwy się rozjeżdżają:
`criteriaTotal` ≠ `applicableCriteria` · `criteriaConcluded` ≠ `concludedCriteria` ·
`findingsOpen` ≠ `openFindings`. `AuditsMethodHub.tsx:227-266` przekazuje dane
z `listPrograms()` **bez żadnego przemapowania**.

**Skutek na ekranie:** React renderuje `undefined` jako nic, więc kolumna „Postęp"
pokazuje **literalnie ukośnik**, a „Ustalenia otwarte" jest **pusta** — na każdym
wierszu programu.

## Dlaczego to jest ta sama rodzina co reszta dnia
To jest **rozjazd kontraktu front-backend** — dokładnie ten sam kształt co dwie
z trzech przyczyn zer na ekranie polityk AI (dyżur 218). Dane **są**, trasa je
**zwraca**, ekran ich **nie widzi**, bo pyta o inne nazwy. Ani jeden test tego nie
łapie, bo `undefined` renderuje się cicho.

## Rozstrzygnięcie drugiego rozkazu (`W3`) — defektu NIE MA
Sprawdzono, czy `AuditReportsTab` i `AuditInitiativesTab` pokazują surowe
identyfikatory zamiast nazw. **Nie pokazują — bo nie pokazują tych pól w ogóle.**
Trasy zwracają `createdBy`/`approvedBy`/`proposedOwnerId`, ale żaden z komponentów
ich nie czyta ani nie renderuje, a typy frontu nawet ich nie deklarują.
Brak mechanizmu `userNameById` w tych dwóch zakładkach **nie jest defektem** —
nie ma czego rozwiązywać.

**To jest przykład rozkazu pomiarowego, który dał wynik „nie ma problemu" — i taki
wynik też jest wart tyle samo co znalezisko.**

## Sprostowanie 2026-09-01 (dyżur 251) — defekt naprawiony

Żywy pomiar PostgreSQL opisany wyżej pozostaje dowodem historycznego defektu, ale defekt
nie występuje już na markerze `df7f13056f`. Jego przodek `8510fcb01d` dodał jawne
mapowanie trzech liczników w `mapProgramSummaryRow()` oraz fail-closed
`AUDITS_API_CONTRACT_ERROR`, poprawił mock `/audits/programs` do kształtu serwera i dodał
negatywny test kontraktu. Cztery zrzuty PRZED/PO w `evidence/grafika/190-audyty-sesje/`
pokazują przejście od „/" i pustych komórek do wartości m.in. `0/42`, `12/42`, `27/27`
oraz liczbowych ustaleń otwartych. Rejestr `status.json` nie przenosi oceny A Biblioteki
na niesfotografowaną wcześniej zakładkę Sesje — ta zakładka wraca do odbioru.

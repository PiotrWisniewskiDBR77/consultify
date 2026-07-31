---
doc_id: weekend-evidence-release-gate
truth_type: delivery-status
status: canonical
owner: codex-piotr
last_reviewed: 2026-07-30
---

# Evidence i bramka końcowa

## Definition of Done zadania

Zadanie jest `ACCEPTED`, gdy:

- rezultat spełnia kontrakt;
- diff nie wychodzi poza zakres;
- typy/build oraz testy odpowiednie do ryzyka przechodzą;
- mutacje mają backend guard, walidację i read-back;
- istnieje test błędu i uprawnień;
- dokumentacja AS-IS została zaktualizowana;
- dowód wskazuje revision i środowisko;
- rollback jest znany;
- Piotr zaakceptował elementy wymagające oceny biznesowej.

## Minimalny pakiet odbioru modułu

- funkcje w zakresie weekendu;
- status każdej funkcji;
- testy automatyczne;
- scenariusz runtime;
- zrzuty lub log;
- znane luki;
- decyzja `GO / GO_WITH_GAPS / NO_GO`.

## Globalna bramka

1. repo i revision są jednoznaczne;
2. build i typy przechodzą;
3. krytyczne testy przechodzą;
4. migracje są bezpieczne;
5. backup i restore są potwierdzone;
6. uwierzytelnienie, tenancy i admin mają test negatywny;
7. krytyczny golden flow działa;
8. nie ma niejawnego mock/demo w ścieżce produkcyjnej;
9. monitoring i rollback są gotowe;
10. wszystkie P0 są `ACCEPTED`, `DEFERRED_BY_OWNER` lub jawnie blokują release.

## Werdykty

- `GO` — wszystkie krytyczne bramki przechodzą;
- `GO_WITH_KNOWN_GAPS` — wyłącznie jawne, niekrytyczne odroczenia z ownerem;
- `NO_GO` — ryzyko utraty danych, bezpieczeństwa, niedziałający główny flow,
  brak rollbacku albo nierozstrzygnięte P0.

Codex przygotowuje rekomendację. Ostateczną decyzję biznesową podejmuje Piotr.

---
doc_id: funkcje-bramki-partia-3
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Bramki — partia 3 (pozycje 11-15) i PRZEBUDOWA RACHUNKU

## Pięć pokrytych

| # | bramka | co da się zrobić po złamaniu | GREEN → RED |
| --- | --- | --- | --- |
| 11 | `managementReportsService.ts:1184` | obcy **nadpisuje albo kasuje** komentarz w cudzym raporcie zarządczym | 3/3 → 0/3 |
| 12 | `managementReportsService.ts:156` | obcy generuje raport, którego **tytuł wciąga nazwę cudzego projektu** — wyciek bez żadnych powiązanych rekordów | 2/2 → 1/2 |
| 13 | `initiativeCapabilityMatrix.ts:473` | obcy zostaje wpisany jako **Accountable** w RACI — a RACI A/R daje prawo edycji inicjatywy, **bez zgody tej osoby ani jej organizacji** | 2/2 → 1/2 |
| 14 | `initiativeKpiAssignmentService.ts:250/260` | obcy **nadpisuje realną wartość KPI** albo kasuje wiersz — liczbę, którą klient śledzi | 3/3 → 1/3 |
| 15 | `kpiRecoveryChildCommands.ts:171` | obcy zostaje **właścicielem akcji naprawczej KPI** bez wiedzy i zgody | 2/2 → 1/2 |

Wszystkie przez realną warstwę: zamontowany router, realny podpisany token, realny
Postgres z pełnym łańcuchem migracji. Każda pozycja z **parą dowodową** — żadna
asercja nie świeciła z powodu wygaszonej funkcji.

## ★ Dwanaście pozycji ODRZUCONYCH z dowodem — inwentarz był zawyżony

Wykonawca nie dopchał liczby. Odrzucił i uzasadnił:
- **`gate-roles`** — cała trasa zwraca **409 „Legacy execution writes are retired"**;
  bramka pod nią jest **martwa od strony HTTP** (zweryfikowane bezpośrednim
  wywołaniem: atak i legalne żądanie oba dostają 409 przed kontrolerem). Zastąpiona
  żywą trasą z tym samym strażnikiem.
- **`embeddingService.ts:341`** — realna granica, ale chroni prywatność **wewnątrz**
  organizacji; granicę międzyorganizacyjną trzyma osobny predykat. Nie ten kształt testu.
- **cztery `buildScoped*Base`** (ROI, KPI, OKR ×2) — redundantne: wcześniejszy filtr
  widoczności już zawęża po organizacji, a identyfikator organizacji **nigdy nie jest
  sterowalny przez atakującego** (zawsze z tokenu).
- **dwie z `InterviewInsightService`** i **dwie z `interviewManagerScope`** — zasięg
  **wewnątrz** organizacji (rola, projekt, dział), zero predykatu organizacji.
- **trzy z `financeDemoCoherencePolicy`** — zero wołaczy poza własnym plikiem i dwoma
  skryptami offline; **nieosiągalne dla atakującego**.

## Nowy rachunek — inwentarz 34 pozycji był myślącym skrótem, nie mapą

| stan | ile |
| --- | --- |
| pokryte testem omijającym z dowodem mutacyjnym | **15** |
| odrzucone z dowodem (nie-granice, redundantne, nieosiągalne, martwe) | **15** |
| pozostałe do rozstrzygnięcia | **~4** |

**Wniosek metodyczny:** z 34 „bramek" niecała połowa jest granicą dzierżawy. Reszta to
nazwy pasujące do wzorca `assertXInOrg`, filtry wewnątrzorganizacyjne albo martwy kod.
**Sama nazwa niczego nie dowodzi** — potwierdzone teraz na piętnastu przypadkach.

Następna partia zaczyna od **jawnej listy pozostałych nieznanych**, nie od inwentarza.

## Znalezisko poboczne
`PUT /api/initiatives/:id/gate-roles` jest martwe dla zapisu (409 zawsze), a komentarze
w kodzie wokół niego mówią o „shadow mode", którego lokalny wrapper i tak zawsze
wyłącza. Dokumentacja w kodzie jest nieaktualna — drugi taki przypadek dzisiaj po
„NOT MOUNTED YET" przy trasie finansowej.

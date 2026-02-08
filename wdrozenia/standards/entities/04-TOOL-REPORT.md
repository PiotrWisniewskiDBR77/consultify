# ✅ Standard encji: Tool Report (Tools Output Report)

## Rola w systemie
Tool Report to **ustrukturyzowany artefakt** powstający w module **Tools**, który:
- zamraża wynik narzędzia (snapshot) w momencie review/approval,
- jest podstawą decyzji gate’owych (review → approve → generate initiatives),
- jest dowodem i materiałem wejściowym do **Reporting** (zarządczego) oraz audytu.

> Tool Report ≠ „management report” z modułu Reports.  
> Tool Report to artefakt *Discovery* (FAZA 1), a Report z `03-REPORT.md` to artefakt *governance* (raportowanie).

## Kontekst (powiązane moduły)
- Tools (źródło)
- Initiatives (inicjatywy wygenerowane z Tool)
- Decisions (gates + audit)
- Reporting (read-only konsumuje)
- My Work / Notifications (inbox review i alerty)

---

## Lifecycle (statusy Tool Report)
W idealnym modelu raport ma własny lifecycle (nawet jeśli technicznie jest materializowany jako stan sesji + wersje).

- `DRAFT`
  - raport roboczy, dane wciąż się zmieniają,
  - dozwolona edycja sesji narzędzia.
- `IN_REVIEW` (alias: `REVIEW`)
  - wysłany do odbioru jakości / zgodności,
  - edycja w Tools jest ograniczona (tylko poprawki w odpowiedzi na uwagi).
- `SENT_BACK`
  - reviewer odsyła do uzupełnienia z powodem + checklistą braków,
  - wraca do pracy autora; po poprawkach ponownie `IN_REVIEW`.
- `APPROVED`
  - raport zaakceptowany jako „quality‑checked snapshot”,
  - raport jest **immutable** (blokada edycji lub tworzy się nowa wersja).
- `GENERATED`
  - inicjatywy zostały wygenerowane (powstał batch),
  - raport pozostaje historycznym dowodem; UI pokazuje „Generated initiatives batch”.
- `ARCHIVED` (opcjonalnie)
  - archiwizacja starych wersji / starych sesji.

### Dozwolone przejścia
```
DRAFT → IN_REVIEW → APPROVED → GENERATED
  ↑        ↓
  └── SENT_BACK
```

---

## Gate decisions (bramki) i egzekucja
Tool Report ma trzy główne momenty kontrolne (gates), realizowane jako encja `Decision`:

1) **REQUEST_REVIEW**
- przejście: `DRAFT → IN_REVIEW`
- kto inicjuje: autor (w praktyce rola tworząca Tool Session)
- warunki: spełnione DoD + kompletność sekcji

2) **APPROVE_TOOL_REPORT**
- przejście: `IN_REVIEW → APPROVED`
- kto decyduje: rola reviewer (PM/Lead/Owner wg polityki projektu)
- outcome: approve albo send-back (z powodem i checklistą)

3) **GENERATE_INITIATIVES**
- przejście: `APPROVED → GENERATED`
- kto decyduje: rola uprawniona do generowania (zwykle PM/Lead lub osoba odpowiedzialna za discovery output)
- efekt: powstaje batch inicjatyw + linki source → initiatives

> **Zasada kanoniczna**: każdy gate musi mieć ownera, due date, audit log i uprawnienia RBAC.

---

## Stałe elementy Tool Report (minimum)
Raport ma być czytelny „dla kogoś spoza Tools”, dlatego sekcje są stałe i porównywalne między narzędziami.

### 1) Header / Metadata
- organization / project
- tool type + nazwa sesji
- autor (createdBy), data utworzenia, last updated
- status reportu + info o wersji (np. `v3`)
- link do źródła (Tool Session) + link do wygenerowanych inicjatyw (jeśli są)

### 2) Executive Summary (1 ekran)
- 3–7 kluczowych obserwacji,
- 3–7 kluczowych implikacji dla inicjatyw,
- ryzyka / ograniczenia (high level).

### 3) DoD / Quality Card
- completion % + lista braków (gaps),
- confidence (avg + rozkład),
- „quality warnings” (np. zbyt krótkie opisy, brak uzasadnień).

### 4) Findings (sekcje narzędzia)
Zależne od tool type, ale w ustandaryzowanym układzie:
- dane wejściowe / założenia,
- wynik (np. SWOT: Strengths/Weaknesses/Opportunities/Threats),
- zależności / korelacje (jeśli narzędzie je wspiera),
- evidence / cytaty / notatki (jeśli dostępne).

### 5) Risks / Assumptions / Dependencies (RAID-lite)
- lista ryzyk i założeń wykrytych w pracy na narzędziu,
- zależności zewnętrzne, blokery discovery.

### 6) Review & Approval Log
- request review (kto, kiedy, priorytet, due date),
- reviewer feedback (komentarze, checklisty),
- decyzja approve/send-back (kto, kiedy, outcome).

### 7) Initiatives Generation Summary (jeśli dotyczy)
- batchId, liczba inicjatyw, metodologia,
- link do listy inicjatyw (DRAFT) + linki source.

### 8) Export
- PDF (min), opcjonalnie „share link”.

---

## Wersjonowanie i niezmienność (kanon)
- `APPROVED` tworzy „snapshot” raportu:
  - albo blokuje edycję danych źródłowych narzędzia,
  - albo tworzy nową wersję sesji/raportu przy każdej zmianie po approval.
- `GENERATED` nie powinno pozwalać na „ciche zmiany”, które zmieniają sens wygenerowanych inicjatyw bez audytu.

---

## UI/UX – gdzie i jak pokazywać Tool Report
### Tools (główne)
- zakładka/sekcja „Report” w workspace,
- w statusie `IN_REVIEW`: widok „Review Panel” z checklistą DoD i komentarzami,
- w `APPROVED/GENERATED`: read-only report + link do initiatives batch.

### My Work
- „Tool Reports awaiting review” (dla reviewerów),
- „Tool Reports sent back” (dla autorów).

### Reporting (zarządcze)
- sekcja „Discovery evidence” – linki do Tool Reports jako źródła.

---

## Powiadomienia (kanon)
- request review → do reviewerów,
- send back → do autora,
- approved → do autora + inicjatywa owner/PMO (jeśli tak zdefiniujemy),
- generated → do autora + osób śledzących projekt.

---

## Testy / DoD (Tool Report)
- min. 1 test E2E: DRAFT → IN_REVIEW → SENT_BACK → IN_REVIEW → APPROVED → GENERATED
- walidacje backend: DoD + RBAC + audit log + decyzje.


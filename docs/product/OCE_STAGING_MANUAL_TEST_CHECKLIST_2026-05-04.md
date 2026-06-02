# OCE Staging Manual Test Checklist (May 2026)

Cel: szybka, powtarzalna walidacja manualna po wdrozeniu Organization Context Engine na staging.

Srodowisko:
- URL: `https://stage.consultinity.ai`
- Railway: `heartfelt-blessing / staging / consultify`
- Tryb testu (aktualny): safe-mode (`inline`, `async OFF`, `OCR disabled`, `audio disabled`)

Klasyfikacja werdyktu (wg `DRD/UI_UX_SOURCE_OF_TRUTH.md`):
- `PASS`
- `PASS_WITH_P2`
- `BLOCKED_P1`
- `FAIL_P0`
- `INCONCLUSIVE`

Klasyfikacja severity:
- `P0` blocker (security/trust/silent execution/cross-tenant/crash na krytycznej sciezce)
- `P1` high (core flow zablokowany, brak zapisu/read-back, infinite spinner)
- `P2` medium (dziala, ale UX/slabosci jakosciowe)
- `P3` low (polish)

---

## A) Pre-flight (obowiazkowe)

- [ ] Otworz czysta sesje (incognito albo wyczyszczony local storage/cache).
- [ ] Zaloguj sie poprawnym kontem testowym.
- [ ] Potwierdz brak petli auth/init po starcie.
- [ ] Potwierdz brak crashy renderera (`target closed`, `EOF`, white screen).

Werdykt A:
- PASS, jesli aplikacja startuje stabilnie.
- FAIL_P0, jesli wystepuje crash/petla.

---

## B) Stabilnosc Canvas i Chat (Track S)

- [ ] Wejdz: Chat -> Canvas -> My Work -> Interview -> powrot do Chat.
- [ ] Wykonaj hard refresh i soft refresh w trakcie sesji.
- [ ] Sprawdz, czy po refreshu nie wraca nieistniejaca konwersacja.
- [ ] Potwierdz brak burstu bledow 404/429/401 w network.
- [ ] Potwierdz uczciwe stany UI (loading/error/degraded), bez fake success.

Werdykt B:
- PASS/PASS_WITH_P2, jesli brak loopow i brak crashy.
- FAIL_P0, jesli petla requestow lub crash.
- BLOCKED_P1, jesli glowna akcja jest martwa.

---

## C) Document Library / OCE (manual smoke)

### C1. Typy, ktore musza dzialac teraz

Przetestuj upload po 1 pliku:
- [ ] PDF
- [ ] DOCX
- [ ] PPTX
- [ ] XLSX
- [ ] TXT

Dla kazdego pliku potwierdz:
- [ ] widoczny status (`ready` / `processing` / jawny degraded)
- [ ] brak wiecznego spinnera
- [ ] po odswiezeniu status nadal poprawny (refresh resistance)
- [ ] AI Chat z attachmentem zwraca odpowiedz (bez raw backend error)

### C2. Typy ograniczone w safe-mode (to nie bug, jesli UI jest uczciwe)

Przetestuj:
- [ ] PNG/JPG
- [ ] MP3/WAV

Oczekiwane teraz:
- moze byc `ocr_required`, `policy_blocked`, `quota_blocked` lub inny jawny degraded state
- nie moze byc fake success
- nie moze byc ukrytej porazki bez komunikatu

---

## D) Save/Read-back i governance UI

- [ ] Edycja Canvas -> Save -> Refresh -> stan po refresh jest zgodny.
- [ ] Rozroznienie `Saved` vs lifecycle (`Draft/In Review/Approved`) jest czytelne.
- [ ] Akcje AI sa osadzone kontekstowo w Menu 3 (nie duplikowane w canvas body).
- [ ] Brak silent execution dla mutacji AI (widoczne proposal/approval/execution/audit lub jawna informacja o braku).

---

## E) ACL i tenant safety

- [ ] User A nie widzi danych Usera B z innego org/projektu.
- [ ] Brak przeciekow metadanych/plikow miedzy tenantami.
- [ ] Endpointy bez uprawnien zwracaja kontrolowany blad (bez raw internals).

Werdykt E:
- FAIL_P0 przy cross-tenant leakage.
- BLOCKED_P1 przy stalej blokadzie dostepu dla poprawnego usera.

---

## F) Toast/banner/error quality

- [ ] Po krytycznych akcjach jest czytelny toast lub inline banner.
- [ ] Komunikaty nie klamia wzgledem realnego wyniku backendu.
- [ ] Brak `[object Object]`, stack trace, `INTERNAL_ERROR` jako jedynego komunikatu.
- [ ] Empty states sa czytelne i mowia, co dalej.

---

## G) Dowody wymagane do raportu

Dla kazdego faila:
- [ ] screenshot UI
- [ ] timestamp + URL
- [ ] krotkie kroki reprodukcji (1-2-3)
- [ ] network evidence (status + endpoint)
- [ ] czy po refresh problem nadal wystepuje

Dodatkowo dla mutacji AI/governance:
- [ ] evidence audit/lineage (jesli dostepne w UI/logach)

---

## H) Finalny raport testera (wklejka)

Uzyj ponizszego szablonu:

```md
## OCE Staging Manual Test Report

Date:
Tester:
Environment: stage.consultinity.ai

### Final Verdict
- Status: PASS | PASS_WITH_P2 | BLOCKED_P1 | FAIL_P0 | INCONCLUSIVE

### Top Findings
1.
2.
3.

### Defects (if any)
| Severity | Area | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|
| P1 | Canvas Save | ... | ... | ... | link/screenshot |

### Residual Risks
- 

### Recommendation
- Go / No-Go for next gate:
```

---

## I) Exit Gate (szybka decyzja)

Mozna przejsc do kolejnej rundy, jesli:
- [ ] brak `FAIL_P0`
- [ ] brak nowych `BLOCKED_P1` na core flow
- [ ] save/read-back/refresh przechodzi
- [ ] OCE upload dla PDF/DOCX/PPTX/XLSX/TXT przechodzi
- [ ] komunikacja UI jest uczciwa (brak fake success)

Jesli ktorykolwiek punkt nie przechodzi: zatrzymaj gate i oznacz `BLOCKED_P1` lub `FAIL_P0`.

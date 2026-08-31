---
doc_id: funkcje-zaleglosci-20260831
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Cztery zaległości zgłoszone i świadomie niezałatane — zamknięte

## 1. SIÓDMY cicho pomijany test bezpieczeństwa — pod nim CZYSTO

`accessCodes.routes.cross-org-escalation.mounted.realdb.test.ts` był przypięty do
nazwy bazy i przez to cicho się pomijał (wzorzec `Z31`, siódmy incydent w programie).
Strażnik odpięty, test uruchomiony na realnym Postgresie **dwukrotnie, na dwóch
różnie nazwanych bazach** — żeby dowieść, że pin **zniknął**, a nie tylko zmienił
nazwę. **6/6 zielonych za każdym razem.**

**W przeciwieństwie do incydentu szóstego (RAID, dziś) — tu nie było dziury.**
Bariery przed eskalacją między organizacjami działają. To jest dobra wiadomość
i jednocześnie dowód, że warto sprawdzać każdy taki pin: sam fakt pominięcia nie
mówi, czy coś się pod nim chowa.

## 2. Brakująca bramka organizacji — dowiedziona mutacją

`interviewEnterpriseService.getSegments` nie używa `assertSessionInOrg`; jest dziś
bezpieczna tylko dzięki warunkowi w samym zapytaniu, więc zmiana zapytania nie
zapaliłaby alarmu. Nowy test na realnym Postgresie, **para dowodowa symetryczna**
(org A/B × obcy/właściciel, 4 przypadki).
**Bramka:** usunięcie `organization_id = ?` ⇒ **2/4 czerwone** („obcy widzi cudzy
segment"); przywrócenie ⇒ 4/4. Kod produkcyjny **nietknięty** — commit zawiera sam test.

## 3. Komentarz przestał kłamać
`finance-intelligence.routes.ts:18` mówił „NOT MOUNTED YET", a trasa jest zamontowana.
Poprawiono na prawdę: gdzie jest wpięta i jaki łańcuch pośredników jej strzeże.
Zero zmian logiki.

## 4. Sprzężenie kolejności testów — naprawione
Drugi test padał w izolacji, przechodził tylko po pierwszym. Przyczyna: współdzielone
dane i brak własnego wywołania. Każdy test ma teraz własny komplet.
**Bramka: 3× w izolacji + 3× w pełnym pliku, wszystkie zielone.**
Ustalono też, czego nie wiedzieliśmy: **pierwszy test niczego nie maskował** — to był
wyłącznie błąd izolacji, nie ukryta wada produktu.

## ★ Dwa incydenty proceduralne — oba zgłoszone przez wykonawcę samodzielnie

1. **Użył `git stash`**, operacji zakazanej wprost (schowek jest współdzielony między
   worktree tego repozytorium). Natychmiast cofnął, nic nie utracono, a dalszą pracę
   przeprowadził poprawnie przez `git show` + `cp`. **Zgłosił to sam, bez pytania.**
2. **Wypchnął gałąź na `origin`** — główne repozytorium — zamiast na prywatny vault
   `github-backup`. Nadzorca wykrył to przy odbiorze, sprowadził gałąź do vaulta
   i zweryfikował zawartość (dokładnie cztery commity, nic poza nimi).
   **Gałąź `fix/zaleglosci-20260831` nadal istnieje na `origin` i wymaga decyzji
   właściciela, czy ją stamtąd usunąć.**

Wniosek do szkieletu instrukcji: zakaz pushu poza `github-backup` musi być w
instrukcji **tak samo widoczny** jak zakaz `git stash` — dziś nie był.

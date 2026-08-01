---
doc_id: claude-codex-handoff-protocol
truth_type: operations
status: canonical
owner: codex
last_reviewed: 2026-07-30
---

# Protokół Codex ↔ Claude

## Codex przed implementacją

Codex:

- wybiera zadanie z boardu;
- wskazuje kontrakt i źródła wykonawcze;
- rozdziela AS-IS, oczekiwany rezultat i zakazy;
- opisuje kryteria akceptacji oraz wymagane testy;
- sprawdza, czy worktree nie zawiera kolidujących zmian;
- nadaje jednoznaczny zakres plików.

## Claude podczas implementacji

Claude:

- pracuje wyłącznie w zakresie pakietu;
- nie usuwa historii ani zmian użytkownika;
- nie zmienia modelu produktu bez decyzji;
- stosuje owner-lane API i istniejące standardy;
- dodaje lub aktualizuje testy;
- raportuje każde odstępstwo, fallback i dług;
- nie oznacza zadania jako gotowe bez wykonanych kontroli.

## Obowiązkowy raport Claude

1. rezultat;
2. lista zmienionych plików;
3. decyzje techniczne;
4. wykonane testy i dokładne wyniki;
5. niewykonane testy;
6. znane ryzyka;
7. migracje, flagi i konfiguracja;
8. instrukcja rollback;
9. elementy wymagające decyzji Piotra.

## Codex po implementacji

Codex:

- przegląda rzeczywisty diff;
- porównuje zmianę z pakietem i SSOT;
- sprawdza security, dane, uprawnienia i skutki między modułami;
- uruchamia testy niezależnie;
- wykonuje lub organizuje smoke runtime;
- aktualizuje dokumentację i board;
- wydaje `ACCEPT`, `RETURN_FOR_FIX` albo `BLOCK`.

## Zakazane skróty

- „komponent istnieje, więc funkcja działa”;
- „test jednostkowy przeszedł, więc E2E jest gotowe”;
- cichy fallback do demo/mock;
- zapis bez tenant guard;
- AI wykonujące mutację bez approval;
- nowy plik `FINAL` zamiast aktualizacji kanonu;
- mieszanie kilku niepowiązanych napraw w jednym pakiecie.

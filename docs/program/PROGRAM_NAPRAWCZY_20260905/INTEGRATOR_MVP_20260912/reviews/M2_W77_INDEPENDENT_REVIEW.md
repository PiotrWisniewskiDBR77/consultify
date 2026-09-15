# M2 W77 — niezależny sceptyczny review

**Werdykt: HOLD — P0: 0, P1: 3, P2: 2.** Implementacja dodaje sensowny kanoniczny payload Document→task, lecz nie dowodzi kryterium 3×3, nie realizuje instrukcji „kliknij każdy”, a test nie obejmuje kontraktu idempotentnego retry ani polskiego zachowania błędu.

- Review target: `399a60214590b74fd235c3cd61f0e12cbf5eba04`.
- Exact backup autora: `origin/backup/codex/c-m2-manual-tools-20260915` = target.
- Exact base manifestu: `dcbd6c052a15f6ef65a6ec698bb0cbda4a7902fe`.
- Zakres diffu: 14 plików, z czego manifest hashuje 13 plików treści i pomija siebie.
- Produkt: 4 pliki (EN, PL, `DocumentSidePanel.tsx`, jeden plik testu); reszta to evidence.

## P1-1 — kryterium 3×3 nie ma readbacku identyfikowalnych zadań

Raport deklaruje po trzy zadania z Pomysłów, Notatnika i Dokumentów oraz twierdzi, że My Work pokazało wszystkie trzy tytuły dokumentów. Dostarczone obrazy tego nie pokazują:

- `tasks-ideas-and-notebook-readback.png` pokazuje licznik `All 23`, ale żaden z sześciu deklarowanych tytułów nie jest widoczny w tabeli;
- `local-candidate-document-tasks-readback.png` pokazuje licznik `All 26`, ale żaden z trzech tytułów `Review document: ...` nie jest widoczny;
- `local-candidate-documents-three-task-created.png` pokazuje stan `Task created` tylko przy jednym widocznym/hoverowanym dokumencie;
- `ideas-after-three-task-actions.png` pokazuje trzy źródłowe pomysły, lecz bez identyfikatora ani odnośnika do utworzonych zadań;
- `notebook-three-task-readbacks.png` pokazuje notatkę, nie task readback.

Nie ma zapisanego HTTP/JSON/SQL readbacku zawierającego `task.id`, `title`, `sourceType/sourceId` i właściciela. Zmiana licznika 23→26 dowodzi trzech nowych rekordów w przedziale czasu, lecz nie dowodzi ich pochodzenia ani tytułów. Kryterium `3/3 + 3/3 + 3/3` pozostaje `NOT_PROVEN`.

**Wymagana poprawka:** trwały readback dziewięciu konkretnych zadań z identyfikatorami, tytułami, właścicielem i źródłem; dla Dokumentów także trzy różne `sourceId`. Screenshot może być dodatkiem, nie jedynym dowodem.

## P1-2 — raport nie realizuje „kliknij każdy”

W77/W76 wymaga dla wszystkich pozycji przycisków/menu wyniku po kliknięciu. Raport wielokrotnie zapisuje tylko `widoczny`, `zinwentaryzowany` albo `menu otwiera się`, m.in. `New Idea`, `New notebook`, `Download`, zestawy filtrów i część akcji slash/kebab. Dla destrukcyjnego Delete uczciwie zatrzymano się przed potwierdzeniem, ale dla pozostałych pozycji brak wyniku działania. Mimo tego dokument nadaje całości werdykt `E1 COMPLETE`.

**Wymagana poprawka:** dla każdej niedestrukcyjnej pozycji zapisać wynik faktycznego wywołania (`działa / nic / błąd / język`) oraz dowód; pozycje celowo niewykonane oznaczyć `NOT_TESTED`, nie `COMPLETE`.

## P1-3 — idempotency i PL error nie mają dowodu zachowania

Kod wysyła właściwy payload: lokalizowany tytuł/opis, `tags=['from-document']`, `sourceType='document'`, `sourceId=doc.id` i `idempotencyKey`. Użyty `resolveIdempotencyKey` zachowuje klucz dla tego samego payloadu po nieudanej próbie, a serwer ma tenantowy writer idempotentny.

Test M2 sprawdza jednak tylko pojedyncze udane wywołanie i dopuszcza dowolny string jako klucz. Nie odtwarza:

- dwóch kliknięć w trakcie requestu i jednego wywołania API;
- failure→retry z tym samym kluczem;
- dwóch dokumentów z różnymi kluczami/sourceId;
- odpowiedzi bez `id` i widocznego błędu;
- polskiego locale.

Ponadto przy błędzie kod bezpośrednio pokazuje `error.message` wewnątrz polskiego prefiksu. Dla angielskiego fallbacku API może to dać mieszany komunikat PL+EN. Sześć kluczy en/pl istnieje i placeholder `{{name}}` ma parytet, ale to nie jest dowód zachowania PL.

**Wymagana poprawka:** behavior tests dla single-flight, stabilnego retry key, rozdzielenia dokumentów, missing-id/error i PL; dynamiczny reason mapować do kanonicznego klucza lub bezpiecznego lokalizowanego fallbacku.

## P2-1 — test `3/3 PASS` jest opisany myląco

Targeted Vitest rzeczywiście ma 3/3 GREEN, lecz tylko jeden test dotyczy Document→task. Dwa pozostałe dotyczą wcześniejszego upload error. Receipt powinien mówić `Document→task 1/1; cały plik 3/3`, a nie używać `3/3` obok kryterium trzech zadań.

## P2-2 — task id jest przechowywany, ale nie daje receipt/navigation

`createdTaskByDocId` przechowuje zwrócony `taskId`, lecz UI używa go wyłącznie jako boolean do wyłączenia przycisku. Użytkownik dostaje tekst `Task created` w grupie akcji widocznej przy hoverze, bez linku lub identyfikowalnego receipt. Nie blokuje samego zapisu, ale osłabia możliwość sprawdzenia przewodu.

## Odtworzone dowody

- `npx vitest run src/components/documents/__tests__/DocumentSidePanel.uploadBlad.test.tsx --retry=0`: **3/3 GREEN**; Document→task stanowi 1/1.
- Front TSC: `npm run type-check`, exit 2, **194** linie `error TS`, **0** wskazuje pliki M2; fingerprint zgodny z receipt i równoległym K1.
- Freeze inventory: **13/13 hash i bytes zgodne**.
- JSON en/pl: parse i parytet sześciu nowych kluczy — zgodne.
- `git diff --check dcbd6c052a..399a602145`: GREEN.
- Migracje, sekrety i drugi panel: 0.

## Ocena zakresu

Zmiana produktu jest mała i zgodna z celem Document→task. Nie naprawia pozostałych luk wskazanych w raporcie (`Process Flow`, ogólne `Done`), co jest uczciwie odłożone do M6. HOLD wynika z brakującego dowodu kryterium oraz niepełnej matrycy ręcznego przejścia, a także z nieudowodnionych zachowań idempotency/i18n.

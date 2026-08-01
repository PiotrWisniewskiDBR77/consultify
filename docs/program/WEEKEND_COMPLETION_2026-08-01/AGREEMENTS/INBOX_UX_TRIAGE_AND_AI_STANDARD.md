---
doc_kind: UI_TRIAGE_AI_CONTRACT
function_id: MW_INBOX
status: REVIEW
last_updated: 2026-07-31
---

# Inbox — UX, triage, Teresa i minimalizm

## 1. Anatomia wiersza

1. checkbox/focus;
2. typ + urgency/SLA signal;
3. tytuł i jednoliniowy brief;
4. actor/project/source;
5. received/due/aging;
6. maksymalnie dwie szybkie akcje + `…`;
7. pending/conflict indicator, jeżeli dotyczy.

Nie pokazujemy jednocześnie wszystkich tagów, sekcji, statusów i rekomendacji. Kolor wyłącznie jako wsparcie. Critical wymaga tekstu/ikony, nie tylko czerwonej krawędzi.

## 2. Preview

Preview pokazuje `Dlaczego to widzę`, źródłowy kontekst, wymagane działanie, deadline/SLA, relacje, activity oraz allowed actions. Pełna edycja obiektu należy do modułu właściciela; preview może wykonać tylko zatwierdzone szybkie komendy.

## 3. Pierwszy ekran

- liczba `Do działania`, nie wszystkich historycznych itemów;
- maksymalnie 4 taby główne;
- domyślny compact;
- sekcje zwijane, ale critical/overdue nie są domyślnie ukryte;
- jeden globalny CTA: `Przejrzyj z Teresą` tylko gdy wnosi wartość;
- zero osobnego prawego panelu AI obok preview.

## 4. Triage loop

`Select → Understand → Act/route/defer → Owner read-back → Next item`.

Po akcji fokus przechodzi do logicznego następnego itemu. Toast nie jest jedynym potwierdzeniem. Undo jest widoczne i zachowuje command status. Keyboard shortcuts nie działają podczas pisania w polu tekstowym.

## 5. Teresa

Teresa nie tworzy osobnej listy. Jej brief i rekomendacja są częścią preview. Dla batch review pokazuje tabelę: item, proponowana akcja, confidence, powód, wyjątek. Domyślnie zaznaczone mogą być tylko reversible, low-impact actions powyżej ustalonego progu; high-impact zawsze ręcznie.

## 6. Noise control

- grupowanie burstów;
- brak self-notifications;
- unsubscribe/mute przy źródle, jeśli polityka pozwala;
- saved views zamiast mnożenia tabów;
- digest dla FYI, realtime dla critical/action required;
- przypomnienie nie duplikuje otwartego itemu;
- nowa materialna aktywność może obudzić snoozed item.

## 7. Dostępność

Pełna obsługa klawiaturą, focus, screen-reader labels, live announcement po triage, alternatywa dla swipe i urgency nieoparta tylko na kolorze. Dense mode nadal zachowuje minimalny target size.

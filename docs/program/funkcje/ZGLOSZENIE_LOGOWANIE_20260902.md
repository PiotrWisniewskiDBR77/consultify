---
doc_id: funkcje-zgloszenie-logowanie-20260902
status: open
owner: piotr
truth_type: incident
established: 2026-09-02
---

# Zgłoszenie właściciela: „znowu mam problem z logowaniem"

**Słowa właściciela (dosłownie, 2026-09-02):** „Mam znowu problem z logowaniem się do bazy danych."
Słowo „znowu" znaczy, że to się już wcześniej zdarzało — szukaj powtórki, nie nowego defektu.

## Co zmierzono od razu (bez udziału właściciela)

| Sprawdzenie | staging | demo |
| --- | --- | --- |
| Serwer odpowiada | tak | tak |
| Połączenie z bazą | jest | jest |
| Strona logowania otwiera się | tak | tak |
| Błędne hasło daje uczciwą odmowę | tak (401) | tak (401) |
| Wersja kodu | `56913a0b3b` (dzisiejsza) | `f3237e9423` (14.08) |

**Wniosek wstępny:** warstwa techniczna stoi. Problem dotyczy konkretnego konta, hasła
albo tego, co użytkownik widzi PO zalogowaniu — a nie tego, że serwis leży.

## Czego jeszcze nie wiadomo (do uzupełnienia po odpowiedzi właściciela)
- Które miejsce: staging, demo, czy praca lokalna.
- Czy nie wpuszcza w ogóle, czy wpuszcza i pokazuje pustkę / cudze dane.
- Treść komunikatu na ekranie.

## Trop historyczny — sprawdzić NAJPIERW
31.08 naprawiano rozpoznawanie firmy po adresie strony (`fix(auth)`, pięć commitów, m.in.
„rozpoznawaj tenanta takze na hoscie staging", „prefer user primary organization").
Objaw tamtej usterki: **logowanie przechodzi, ale użytkownik ląduje w złej albo pustej
organizacji**. To pasuje do słowa „znowu". Sprawdzić, czy poprawki są w kodzie stagingu
(`56913a0b3b`) i czy działają dla konta właściciela.

## Zasada zapisana przy okazji
Właściciel poprosił wprost: „zapisz, bo nie wiem, o czym ty mówisz". Zgłoszenia opisujemy
językiem pracy konsultanta, bez nazw plików i mechanizmów; szczegóły techniczne idą do
osobnej sekcji na dole, nie do treści zgłoszenia.

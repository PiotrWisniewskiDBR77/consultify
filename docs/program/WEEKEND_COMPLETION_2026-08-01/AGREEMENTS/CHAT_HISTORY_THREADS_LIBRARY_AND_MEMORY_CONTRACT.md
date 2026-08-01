---
document_id: CHAT-HISTORY-THREADS-LIBRARY-MEMORY
module: Chat
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Chat — historia, wątki, biblioteka i pamięć

## 1. Trzy różne warstwy

- **History** przechowuje przebieg rozmów i ich operacje.
- **Library** pomaga odnaleźć i zorganizować rozmowy oraz ich artefakty.
- **Memory** przechowuje zatwierdzone fakty i preferencje używane poza jednym
  wątkiem.

Historia nie jest automatycznie pamięcią. Teresa nie może traktować każdej
luźnej wypowiedzi sprzed miesięcy jako aktualnej prawdy organizacji.

## 2. Conversation, thread i branch

Conversation jest kontenerem celu, uczestników, scope i artefaktów. Thread jest
uporządkowaną sekwencją wiadomości. Edycja wcześniejszej wiadomości lub „spróbuj
inaczej” tworzy branch z `parentMessageId` i `branchedFrom`, nie usuwa pierwotnej
historii.

Regenerate tworzy nowy wariant odpowiedzi dla tego samego promptu. UI pozwala
przełączać warianty i wybrać aktywny, a feedback odnosi się do konkretnego
wariantu.

## 3. Lista i wyszukiwanie

Lista pokazuje tytuł, krótki preview, folder, uczestników/scope, czas ostatniej
aktywności, pinned/starred, liczbę artefaktów oraz wskaźnik oczekującej akcji.
Wyszukiwanie obejmuje tytuły i treść dostępnych wiadomości, a w dalszej
kolejności załączniki, artefakty i citations. Wynik pokazuje matched snippet i
prowadzi do wiadomości, nie tylko początku rozmowy.

Server search jest obowiązkowy dla kompletności. Client filter może służyć
jedynie szybkiemu filtrowaniu już pobranego zakresu. Search stosuje ACL przed
rankingiem i nie zdradza liczby zablokowanych wyników zwykłemu użytkownikowi.

## 4. Operacje

| Operacja | Semantyka |
| --- | --- |
| rename | zmiana tytułu, nie treści |
| pin/star | osobisty priorytet, chyba że polityka folderu mówi inaczej |
| move | zmiana folderu z kontrolą jego ACL |
| archive | ukrycie z aktywnej historii, możliwość restore |
| delete | soft delete/retention zgodnie z polityką |
| fork | nowa rozmowa/gałąź z lineage i dozwolonym kontekstem |
| share | snapshot lub live thread według jawnego trybu |
| export | wersjonowany pakiet treści i dozwolonych załączników |

Bulk operations pokazują liczbę targetów, rezultat częściowy i elementy
niezmienione. Nie deklarują pełnego sukcesu po częściowym błędzie.

## 5. Foldery osobiste i zespołowe

Folder nie jest projektem biznesowym. Może być powiązany z projectId, lecz nie
tworzy równoległej struktury organizacji. Personal folder widzi właściciel. Team
folder ma ownera, members i role viewer/contributor/manager. Rozmowa przeniesiona
do folderu nie uzyskuje automatycznie szerszych praw do źródeł.

## 6. Tytuły i porządek

Pierwszy tytuł może wygenerować Teresa, ale użytkownik może go zmienić. System
nie nadpisuje ręcznego tytułu. Tytuły muszą być krótkie, odróżnialne i zgodne z
językiem rozmowy; „New conversation” nie może pozostawać po merytorycznej pracy.

## 7. Pamięć

Rodzaje pamięci:

- preferencje osobiste;
- trwałe fakty o użytkowniku zaakceptowane przez niego;
- pamięć projektu/organizacji pochodząca z kanonicznych źródeł;
- krótkoterminowe summary rozmowy;
- procedury i instrukcje systemowe.

Każdy wpis pamięci ma source, scope, owner, visibility, confidence, createdAt,
lastVerifiedAt i możliwość poprawienia/usunięcia. Teresa pokazuje „dlaczego to
pamiętam”. Wrażliwe fakty nie trafiają do pamięci domyślnie.

## 8. Retencja i usuwanie

Polityka Admin Panelu określa retencję rozmów, wiadomości, audio, tool traces i
soft-deleted records. Usunięcie rozmowy nie może osierocić kanonicznych Notes,
Tasks czy Initiatives; usuwa link lub zachowuje minimalne lineage zgodnie z
compliance. Legal hold blokuje fizyczne usunięcie i jest widoczny uprawnionym
administratorom.

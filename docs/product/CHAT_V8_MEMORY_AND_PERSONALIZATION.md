# Chat v8 - Memory and personalization

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny kontrakt dla memory, personalization i trust boundaries w `Chat v8`.

---

## 1. Po co istnieje ten dokument

Leader-grade chat nie konczy sie na jednej rozmowie.
User i organizacja oczekuja, ze system:
- pamieta to, co powinien,
- nie pamieta tego, czego nie powinien,
- daje kontrolowalna personalizacje,
- nie narusza boundaries tenant, role i privacy.

---

## 2. Nadrzedna zasada

Memory w `Chat v8` jest controlled capability, nie ukryta magia.

Kazde uzycie memory musi byc rozumiane jako jedna z warstw:
- `conversation memory`
- `user memory`
- `organizational memory`

Private mode i permissions moga te warstwy ograniczac.

---

## 3. Memory scopes

### 3.1 Conversation memory

To wszystko, co jest zapisane i odzyskiwane w ramach konkretnej rozmowy:
- messages,
- title,
- message metadata,
- attachment context,
- route continuity,
- response history.

To jest baseline i nie wymaga specjalnego opt-in poza samym uzyciem rozmowy.

### 3.2 User memory

To personalization layer usera, np.:
- preferred style,
- persistent instructions,
- recurring preferences,
- favored answer format.

Rules:
- musi byc odrozniona od jednorazowego promptu,
- musi miec przynajmniej conceptual user control.

### 3.3 Organizational memory

To memory layer organizacji, np.:
- company guidance,
- preferred terminology,
- org-wide instructions,
- knowledge or policy context.

Rules:
- tenant isolation is mandatory,
- role and permission boundaries are mandatory.

---

## 4. Personalization layers

`Chat v8` rozroznia:
- transient per-message intent,
- conversation-level context,
- user-level personalization,
- organization-level guidance.

To nie sa te same rzeczy i nie moga byc mieszane w dokumentacji.

---

## 5. Read/write rules

### 5.1 Read rules

System moze czytac memory tylko wtedy, gdy:
- user ma dostep do tej warstwy,
- private mode tego nie blokuje,
- tenant boundary pozwala na uzycie organizational layer.

### 5.2 Write rules

System moze zapisywac durable personalization tylko wtedy, gdy:
- istnieje do tego jawna warstwa produktu,
- zapis jest zgodny z polityka prywatnosci i tenancy,
- user experience nie sugeruje "nothing is remembered", jesli system cos zachowuje.

---

## 6. Private mode contract

Private mode ma znaczyc:
- ograniczenie memory injection i personalization,
- brak mylenia usera co do tego, jak bardzo odpowiedzi sa personalizowane,
- przewidywalne zachowanie w ramach tej rozmowy.

Private mode nie musi automatycznie znaczyc:
- braku conversation persistence,
- braku runtime safety logs,

jesli produkt nie obiecuje tego explicite.

---

## 7. User control requirements

User powinien miec conceptually zrozumialy model:
- co jest tymczasowe,
- co jest rozmowowe,
- co jest personalizowane,
- co jest organization-driven.

W `v8` minimum to:
- custom instructions contract,
- private mode semantics,
- uczciwa dokumentacja read/write behavior.

---

## 8. Admin and org control requirements

Organizacja powinna miec conceptually zdefiniowane:
- kto ustawia org guidance,
- czy i jak memory jest audytowalna,
- jak memory respectuje roles and permissions,
- co jest global policy, a co user preference.

---

## 9. Retention and deletion boundaries

Memory docs musza rozroznic:
- retention of conversation content,
- retention of personalization settings,
- retention of org guidance.

Jesli exact retention policy jest zdefiniowana gdzie indziej, `Chat v8` musi przynajmniej wskazac granice i ownera tej polityki.

---

## 10. UX rules

- user nie moze byc zaskakiwany "hidden memory",
- private mode musi byc zrozumialy,
- personalization nie moze przelamywac governance or permissions,
- memory-rich answer nie moze udawac, ze jest sourced z attachments lub web.

---

## 11. Anti-patterns

- memory opisana tylko sloganowo,
- brak rozroznienia user vs org memory,
- private mode o niejasnym znaczeniu,
- personalizacja naruszajaca permissions,
- brak ownera retention/deletion semantics.

---

## 12. Definition of done

Memory and personalization sa domkniete, gdy:
- trzy memory scopes sa jednoznaczne,
- private mode ma uczciwy contract,
- read/write rules sa zrozumiale,
- user i org controls sa opisane,
- retention boundaries maja wskazanego ownera.

Related specs:
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

# Chat v8 - Message and thread operations

> Status: Draft v8
> Cel: Zdefiniowac kanoniczny kontrakt dla operacji na wiadomosciach i watkach, tak aby `Chat v8` dorownywal liderom w iteracji rozmowy.

---

## 1. Po co istnieje ten dokument

Leader-grade chat to nie tylko send i history.
User oczekuje tez kontroli nad iteracja:
- edit prompt,
- regenerate answer,
- fork thread,
- compare variants,
- wracac do miejsca rozmowy bez utraty logiki watku.

---

## 2. Nadrzedna zasada

Operacje na watku nie moga niszczyc zaufania do historii.

Jesli user:
- edytuje prompt,
- regeneruje odpowiedz,
- rozwidla watek,

produkt musi jasno powiedziec:
- co zostaje zachowane,
- co zostaje zastapione,
- co staje sie nowa sciezka rozmowy.

---

## 3. Canonical operations

### 3.1 Edit user message

Znaczenie:
- user zmienia tresc promptu juz wyslanego.

Required semantics:
- produkt musi okreslic, czy to:
  - rewrites history in place,
  - tworzy branch,
  - truncates and replays from this point.

### 3.2 Regenerate assistant answer

Znaczenie:
- user chce nowa wersje odpowiedzi dla tego samego promptu/context.

Required semantics:
- system musi okreslic, czy stara odpowiedz zostaje:
  - nadpisana,
  - zachowana jako alternate variant,
  - przeniesiona do branch history.

### 3.3 Fork / branch thread

Znaczenie:
- user chce oddzielic nowa sciezke myslenia od glownej rozmowy.

Required semantics:
- nowy branch ma jasny relation do parent thread,
- attachments, scope and memory carry-over musza miec explicit rule,
- route and revisit model musi to wspierac lub jawnie odkladac jako non-goal.

### 3.4 Compare variants

Znaczenie:
- user moze porownac alternatywne odpowiedzi lub sciezki.

Required semantics:
- musi byc wiadomo, co jest canonical current answer,
- compare nie moze psuc prostego mainline workflow.

---

## 4. Thread state rules

### 4.1 Mainline vs branch

Kazda rozmowa ma:
- `mainline`,
- optional `branch variants`.

Jesli `v8` baseline nie promuje branches jako user-facing feature, dokumentacja musi to powiedziec wprost i zostawic branch semantics jako future/extension.

### 4.2 Title behavior

Rules:
- auto-title dziala tylko dopoki user nie przejmie tytulu,
- branch lub regenerated path nie moze niejawnie nadpisywac user-owned title.

### 4.3 Attachment carry-over

Thread operations musza okreslic:
- czy attachments zostaja,
- czy regenerated answer korzysta z tego samego attachment scope,
- czy branch dziedziczy source context.

---

## 5. UX rules

- edit, regenerate i fork nie moga wygladac identycznie,
- user musi rozumiec, czy zmienia mainline czy tworzy alternate path,
- message-level controls musza odpowiadac realnemu runtime,
- full i split shell nie moga oferowac sprzecznych thread operations.

---

## 6. Route and revisit implications

Thread operations maja implikacje dla:
- deep links,
- active conversation id,
- message ordering,
- history preview,
- conversation continuity in split/full mode.

Jesli produkt nie wspiera jeszcze branches jako route-visible entity, musi to byc jawny non-goal baseline.

---

## 7. Anti-patterns

- regenerate, ktory ukrywa poprzednia odpowiedz bez jasnej semantyki,
- edit prompt, ktory nie wiadomo czy przepisuje historie czy tworzy nowy path,
- branch logic istniejaca w runtime, ale nie opisana userowi,
- attachments silently dropped during thread operations.

---

## 8. Definition of done

Message and thread operations sa domkniete, gdy:
- edit, regenerate i fork maja jawne semantics,
- title and attachment carry-over sa okreslone,
- revisit and route implications sa zrozumiale,
- baseline i future/extension behaviors sa odroznione.

Related specs:
- `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `CHAT_V8_RESPONSE_MODEL.md`
- `CHAT_V8_CONTROL_SURFACE_SPEC.md`

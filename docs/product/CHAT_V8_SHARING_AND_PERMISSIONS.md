# Chat v8 - Sharing and permissions

> Status: Draft v8
> Cel: Zdefiniowac visibility, sharing i permissions semantics dla rozmow, folderow i related chat outputs.

---

## 1. Po co istnieje ten dokument

`Chat v8` wchodzi w team folders, org memory, artifact handoff i governed actions.
Bez jawnego modelu sharing i permissions:
- team folder moze byc tylko etykieta UI,
- conversation access moze byc niejasny,
- admin and support expectations beda rozjechane.

---

## 2. Nadrzedna zasada

Widocznosc rozmowy i mozliwosc pracy na niej musza wynikac z jawnych rules:
- ownership,
- folder scope,
- project/business context,
- organization policies,
- explicit sharing when supported.

---

## 3. Visibility layers

### 3.1 Private conversation

Rozmowa widoczna tylko dla ownera i tych system actors, ktorzy maja legalny operational reason zgodny z polityka.

### 3.2 Team-scoped folder conversation

Rozmowa przypieta do folderu o zakresie team.

Required semantics:
- kto widzi conversation metadata,
- kto moze otworzyc thread content,
- kto moze wykonywac actions na tej rozmowie.

### 3.3 Organization policy layer

Org policies moga ograniczac lub rozszerzac:
- visibility,
- action permissions,
- retention and export rights.

---

## 4. Permission domains

Permissions dla chat powinny byc rozroznione na:
- `view conversation`
- `write in conversation`
- `manage folder`
- `approve actions`
- `share conversation`
- `export conversation`
- `admin/audit access`

Nie wszystkie musza byc dostepne user-facing w v8 baseline, ale model powinien je rozroznic.

---

## 5. Folder semantics

### 5.1 Personal folder

Personal folder organizuje rozmowy usera.
Nie implikuje shared read/write semantics.

### 5.2 Team folder

Team folder implikuje shared organizational semantics.
Jednak sam fakt istnienia team folderu nie powinien automatycznie oznaczac niekontrolowanego dostepu bez jawnego permission contract.

---

## 6. Conversation sharing

### 6.1 Baseline

Jesli explicit conversation sharing nie jest jeszcze promoted feature, dokumentacja musi to powiedziec wprost.

### 6.2 When sharing exists

Jesli produkt wspiera lub bedzie wspieral sharing, conversation sharing contract musi okreslac:
- kto moze wygenerowac share access,
- czy to read-only czy collaborative,
- jak to sie ma do folderu i project context,
- jak revoke / expiry dziala.

---

## 7. Artifact and action permissions

Handoff z chatu do artifactu lub action approval nie moze omijac permissions modelu.

Rules:
- save-to-artifact respektuje target permissions,
- approve/reject action respektuje role and capability rules,
- conversation visibility nie daje automatycznie prawa do business mutation.

---

## 8. UX rules

- user powinien rozumiec, czy rozmowa jest prywatna czy team-scoped,
- folder type powinien byc zrozumialy,
- share/export actions nie moga byc widoczne bez sensownego contract,
- permissions failure musi byc user-readable.

---

## 9. Anti-patterns

- team folder bez realnych visibility rules,
- conversation sharing implied but not specified,
- permissions leaking from folder do business action bez jawnej polityki,
- owner vs admin vs approver semantics left implicit.

---

## 10. Definition of done

Sharing and permissions sa domkniete, gdy:
- visibility layers sa zdefiniowane,
- folder scope semantics sa jasne,
- conversation, artifact and action permissions sa rozroznione,
- baseline and future sharing behavior sa uczciwie oddzielone.

Related specs:
- `CHAT_V8_HISTORY_AND_LIBRARY_MODEL.md`
- `CHAT_V8_ACTIONS_AND_APPROVALS.md`
- `CHAT_V8_ENTERPRISE_AND_COMPLIANCE.md`

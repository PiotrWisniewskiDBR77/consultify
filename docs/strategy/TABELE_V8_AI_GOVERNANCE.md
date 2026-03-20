# Tabele v8 - AI Governance

> Status: Draft v8
> Cel: Ustalic twarde zasady uzycia AI w platformie tabel.

---

## 1. Core rule

Kanoniczna zasada:

`AI proposes. User reviews. System executes approved scope. Everything is auditable.`

W skrocie:
- zero silent schema mutations,
- zero silent automation activation,
- zero magic changes bez diff i decyzji.

---

## 2. Klasy operacji AI

### 2.1 Schema planning

AI moze proponowac:
- nowe `base`,
- nowe tabele,
- pola i ich typy,
- linked records,
- lookup/rollup/formula,
- starter views.

### 2.2 Schema refinement

AI moze proponowac:
- rename fields,
- type upgrades,
- cleanup options,
- dependency config,
- view improvements.

### 2.3 Data proposals

AI moze proponowac:
- sample/demo data,
- enrichment records,
- cleanup mapping,
- tagowanie, klasyfikacje i normowanie.

### 2.4 Workflow proposals

AI moze proponowac:
- forms,
- interfaces,
- automations,
- import mappings,
- sharing/distribution suggestions.

### 2.5 Analytical assistance

AI moze:
- wyjasniac co jest w bazie,
- proponowac queries i views,
- wskazywac anomalies, gaps i suspicious patterns,
- pomagac interpretowac data model.

---

## 3. Czego AI nie wolno

AI nie moze:
- wykonac zmiany schema bez jawnej akceptacji,
- zaktualizowac rekordow produkcyjnych bez zdefiniowanego review scope,
- aktywowac automation bez potwierdzenia,
- ukrywac skutkow ubocznych zmian,
- wykonywac broad migration bez pilotowego i kontrolowanego flow,
- traktowac projection layer jako miejsce do cichego rozjechania z canonical metadata layer.

---

## 4. Proposal contract

Kazdy proposal AI powinien zawierac:
- intencje uzytkownika,
- proposed objects,
- proposed operations,
- dependencies,
- ryzyka,
- przewidywany efekt,
- informacje, czy proposal dotyczy schema, danych, view, interface czy automation.

Jesli proposal dotyczy wielu warstw naraz, musi to byc jawne.

---

## 5. Review contract

Review powinien pokazac:
- co zostanie utworzone,
- co zostanie zmienione,
- co zostanie usuniete,
- jakie dane moga zostac dotkniete,
- jakie sa zaleznosci i ryzyka,
- czy zmiana jest odwracalna,
- czy wymaga rollout gating lub pilot scope.

Review nie moze byc tylko marketingowym opisem.
Musi byc operacyjnie uzyteczny.

---

## 6. Execution contract

Wykonanie moze nastapic tylko po decyzji:
- `accept`
- `accept with refinement`

Wykonanie powinno:
- ograniczac sie do zatwierdzonego zakresu,
- zapisac audit trail,
- zwrocic wynik operacji,
- wspierac `undo/redo` tam, gdzie system to deklaruje.

---

## 7. Audit contract

Minimalny zapis dla operacji AI:
- `proposal_id`
- `user_id`
- `workspace_id` / `base_id` / `table_id`
- `operation_type`
- `input_prompt`
- `proposed_diff`
- `decision`
- `execution_result`
- `created_at`

W idealnym modelu:
- widac tez refinements,
- widac reason codes dla rejection,
- widac scope impacted entities.

---

## 8. Safety rules by area

### 8.1 Schema safety

- typy pol nie moga byc zmieniane bez jawnego review,
- linked records i dependencies wymagaja szczegolnej widocznosci skutkow,
- destructive changes musza byc wyraznie oznaczone.

### 8.2 Data safety

- AI-generated updates na rekordach powinny domyslnie byc proposalem lub preview batch,
- bulk changes wymagaja jasnego scope.

### 8.3 Automation safety

- automation proposal nie moze byc rownoznaczny z aktywacja,
- trigger, target, side effects i notifications musza byc jawne.

### 8.4 Migration safety

- AI nie moze samodzielnie przelaczac organizacji na metadata-first mode,
- migration flows wymagaja gating, walidacji i rollback story.

---

## 9. UX rules

AI UX w tabelach powinien:
- mowic precyzyjnie, jakie byty zmienia,
- pokazywac diff zamiast niejasnej obietnicy,
- wspierac refine zamiast wymuszac jednorazowa decyzje,
- byc zintegrowany z realnym modelem danych,
- budowac zaufanie przez przewidywalnosc.

AI UX w tabelach nie powinien:
- udawac, ze system "sam wie najlepiej",
- chowac skutkow zmian pod uproszczonym CTA,
- mieszac create/update/delete w jednej nieprzezroczystej akcji.

---

## 10. Evaluation gates

Przed uznaniem AI layer za rollout-ready trzeba sprawdzic:
- jakosc proposalow schema,
- poprawnosc dependencies i field typing,
- czy diff jest czytelny,
- czy reject/refine dziala przewidywalnie,
- czy audit trail jest kompletny,
- czy destructive proposals sa odpowiednio oznaczane,
- czy pilot users ufaja flow `propose -> review -> accept/reject`.

---

## 11. Final statement

AI w `Tabele v8` ma byc akceleratorem budowy i ewolucji platformy danych.
Nie moze byc niekontrolowanym silnikiem mutacji.

Najwazniejsza przewaga `consultify` ma wynikac nie z "magii", tylko z:
- dobrych proposalow,
- jawnego review,
- bezpiecznego execution,
- audytowalnosci calosci.

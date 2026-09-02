---
doc_id: funkcje-bilans-2026-08-31
status: canonical
owner: piotr
truth_type: status
established: 2026-08-31
---

# Bilans 31.08.2026 — trzynaście dyżurów, żaden na słowo

Linia integracyjna: `codex/m03-admin-20260824`.

## Scalone (każdy po odbiorze adwersaryjnym i FIX-ie)

| dyżur | co realnie daje |
| --- | --- |
| **204** | migracja legacy→kanon: pilot JEDNEGO rekordu istnieje, zakres organizacji fail-closed, idempotencja broniona podwójną mutacją |
| **205** | pętla mądrości: praca w Organizacji dociera do **wyrenderowanego promptu** |
| **206** | pętla narzędziowa: 11 narzędzi READ, P0 cross-org zamknięty |
| **207** | propozycje zapisu; zadanie z czatu idzie **tym samym writerem** co My Work |
| **209** | indeksacja dokumentów i decków |
| **210** | P0 zasięgu embeddingów zamknięty **i funkcja przywrócona** |
| **211** | bezpiecznik cyklu życia atrap (blokuje prawdziwy commit) |
| **212** | 5 z 34 bramek z testem omijającym i dowodem w obie strony |
| **213** | sejf projektowy działa w obie strony; stara reguła fail-open zamknięta |
| **214** | adopcja szkicu z rozmowy; brama uprawnień broniona trzema mutacjami |
| **215** | indeksacja raportów — **trzeci i ostatni typ artefaktu** |
| **216** | atomowość migracji, `FAILED` ponawialny, ślad forensyczny naprawiony |
| **217** | **model po raz pierwszy sięgnął po narzędzie sam** (2 kroki, flaga rządzi) |

## Co NIE jest zamknięte

**Moduł 17 — jedna pozycja.** Model podał nazwę projektu zamiast identyfikatora,
więc narzędzie nie znalazło nic (poprawnie, fail-closed). Luka w **kontrakcie
parametru** `vault_project_id` w `search_knowledge_base`, nie w bezpieczeństwie.
Budżet realnego modelu wyczerpany (2/2) — dokończenie wymaga zgody właściciela.

## Decyzje czekające na właściciela

1. **Wdrożenie migracji rejestru na staging** — pierwszy zapis do wspólnej bazy;
   bez tego pilot D-13 nie ruszy. Wszystko inne gotowe.
2. **285 dokumentów wiedzy na stagingu ma zasięg prywatny, 0 organizacyjny** —
   przypisać wstecz zasięg organizacji czy zostawić. Dziś Teresa nie widzi tam
   praktycznie nic (indeks: 0 wierszy).
3. **Budżet na dokończenie modułu 17** — jeden przebieg realnego modelu po naprawie
   kontraktu parametru.
4. **Wybór poufności raportu w interfejsie** — pozycja produktowa: dziś żaden
   zamontowany ekran go nie oferuje (wizard jest kodem osieroconym od 27.07).
5. **29 z 34 bramek** nadal bez testu omijającego — partiami po pięć.

## Metodyka: co ten dzień zmienił

**Nowa reguła programu:** *zabezpieczenie bez testu, który czerwienieje po jego
usunięciu, jest nieudowodnione.* Powód: w czterech dyżurach (204, 207, 210, 214)
skasowanie zabezpieczenia **nie ruszyło** zestawu testów. 214 był pierwszym
złapanym PRZED scaleniem.

**Dwa nowe kształty fałszywego „gotowe":**
- **zamknięte przez wygaszenie** — fail-closed zielony, bo kontekst nie dociera;
  funkcja wyłączona dla wszystkich (210 `userId`, 207 nazwy pól, 213 `projectIds`).
  Wymagana **para**: „obcy nie widzi" **i** „właściciel widzi", na realnym łańcuchu.
- **dwa dostępy do jednej bazy, różne odpowiedzi** — `Database.ts:79-85` podstawia
  atrapę przy `NODE_ENV=test` bez `RUN_DB_TESTS=1`; surowy `pg.Pool` widzi wiersz,
  kod produkcyjny nie. Bez ostrzeżenia, bez wyjątku.

**Błędy autorskie nadzorcy, wszystkie złapane przez robotników, nie przeze mnie:**
liczba 87 plików (faktycznie **1**) · próg 41 zamiast 46 · fałszywy trop wzorca
adopcji · „poufność jest gubiona" (wizard okazał się osierocony) · zlecenie 34
pozycji naraz · katalog `m03` 205 commitów za linią · pomiar niewłaściwej bazy na
Railway (usługa `Postgres` zamiast `pgvector`) · literówka portu przypisana
wykonawcy zamiast sobie.

Wniosek do zapamiętania: **odruch „przekaż szybko" wyprzedzał u mnie „zmierz".**
Odbiór adwersaryjny zadziałał tego dnia głównie na nadzorcę.

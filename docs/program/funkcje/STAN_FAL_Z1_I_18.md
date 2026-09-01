---
doc_id: funkcje-stan-fal-z1-18
status: canonical
owner: piotr
truth_type: status
established: 2026-09-01
---

# Stan fal Z1 i 18 — zapis bieżący

Linia integracyjna: `codex/m03-admin-20260824`. **Piętnaście dyżurów wydanych
(218-232)**, wszystkie z instrukcjami w repo.

## SCALONE po odbiorze adwersaryjnym i FIX-ach

| dyżur | co realnie daje | ocena |
| --- | --- | --- |
| **218** Admin | ekran polityk AI przestał pokazywać zera zamiast błędu — **wszystkie trzy przyczyny** naprawione (brak tabeli + **dwa rozjazdy kontraktu front-backend**) | **A** |
| **219** Admin | schematy Rozliczeń i SCIM zgodne **na bazie z samych migracji**; osiem etykiet nawigacji po polsku | **A−** |
| **226** Gamma | edytor motywu: praca konsultanta dociera **do bajtów pliku PPTX** (audytor sparsował XML z archiwum) | **A−** |
| **228** Gamma | **styl obrazu z motywu dokleja się do polecenia dla modelu** — dowód na stringu, trzy dostawcy; bramki tekstu i twarzy realne | — |
| **231** Gamma | **★ konspekt decku powstaje z wiedzy organizacji** — para rozstrzygająca; stempel pochodzenia przestał kłamać | **B−→** |

## W ODBIORZE ADWERSARYJNYM (osiem dyżurów, trzy audyty równolegle)
**220** Audyty-rejestr · **221** Audyty-warsztat · **222** Moja praca · **223** Czat ·
**224** Partner · **225** Narzędzia · **230** Gamma-przepełnienie · **232** Gamma-agent.

## DO WYDANIA
**227** (jedna geometria — stanął na dysku, worktree usunięty jako pusty) ·
**229** (ciemny motyw i skala typograficzna — trzymany świadomie, bo dotyka tego
samego pliku co 227).

## Co ta praca znaczy dla marzenia właściciela
Właściciel prowadzi doradztwo **w Gammie** (367 prezentacji na jednym motywie).
Marzenie to **nie „ładne slajdy"**, tylko **koniec rozdwojenia**: treść żyje
w Consultify, artefakt powstaje w Gammie, więc każdą prezentację przepisuje ręcznie.
Nasza dokumentacja mówi to samo: Consultify **nie jest** *„generatorem dokumentów bez
powiązania ze źródłami"*, a łańcuch obietnicy kończy się słowem **„materiał"**.

> **Gamma ma formę bez wiedzy. Consultify ma wiedzę bez formy.**

Dyżur **231** zszył pierwszy szew: konspekt z wiedzy organizacji, dowiedziony faktem,
którego nie było w pytaniu.

## ★ Wzorzec dnia: „zbudowane, ale niepodłączone" — SIEDEM przypadków
1. edytor krojów i kolorów — front wysyła, backend nie odbiera; **praca znikała przy zapisie**;
2. 13 zestawów kolorystycznych — zapisywane, **nigdy nieczytane** przy eksporcie;
3. **6 presetów stylu obrazu** — selektor renderowany, wybór **nie trafiał do żądania**;
4. kolumny pochodzenia decku — istnieją, trasa **odczytuje**, **nikt nie zapisywał**;
5. parametr szerokości tabeli — bezpiecznik używany w dwóch modułach, **na pięciu
   ekranach Partnera niepodany** ⇒ obcięta kolumna;
6. filtr źródeł konspektu — szukał pola, którego wyszukiwarka **nigdy nie zwraca**;
7. brama zatwierdzania edycji decku — **w ogóle nie czytała statusu operacji**.

**To jest dług INTEGRACYJNY, nie projektowy.** Wyceny z kart są przez to
systematycznie zawyżone: zadanie brzmi „zbuduj X", a realnie jest „przeprowadź
wartość przez jedno żądanie".

## Reguły, które się dziś obroniły
- **Mutacja musi celować w zabezpieczenie, nie w mechanizm.** Bez tego testy bywają
  zielone przy skasowanej bramce — zdarzyło się **sześć razy**.
- **Para dowodowa**: „obcy nie widzi" **oraz** „właściciel widzi". Samo pierwsze bywa
  spełnione przez **wygaszenie funkcji** — **pięć razy**.
- **Przy podejrzeniu „złamałem cudze" — zmierz oba stany.** Autor 228 postawił worktree
  na cudzym tipie i udowodnił, że **3 z 4 czerwieni istniały przed jego scaleniem**;
  naprawił dwie, czwartej **nie zgadywał**.
- **Prototyp jako plik przed budową silnika** (221, warsztat Audytów).

## Incydenty operacyjne i ich naprawa
- **Cztery dyżury stanęły na braku miejsca** (2,5 GiB przy progu 5). Bezpiecznik
  zadziałał czysto — zatrzymały się **przed** utworzeniem czegokolwiek. Nadzorca
  zwolnił 14 GiB, usuwając worktree **scalonych** gałęzi i stare kontenery.
  **Wniosek: dyżur zajmuje ~1,7 GB; przy pięciu równoległych sprzątaj PRZED wydaniem.**
- **Marker podniesiony** dla wznawianych dyżurów (`9fb7942a01` → `0a35699021`) plus
  ramka: *stan wejściowy jest nowszy niż treść instrukcji — zmierz go sam*.
- **Nadzorca wycofał własne scalenie 228** i oddał je autorowi, bo konflikt dotyczył
  **dwóch bloków logiki**, nie dopisania pola. Linia integracyjna nietknięta.

## Otwarte decyzje właściciela
1. **Classic czy Studio** — slajd składany z bloków (edytowalny) kontra slajd wypalony
   jako obraz (swoboda kompozycji, brak edycji w PowerPoint). Gamma ma oba.
2. **API Gammy jako trzecia droga** — nie budować renderera, tylko wołać Gammę.
   Decyzja biznesowa: zależność od dostawcy, dane klientów wychodzą na zewnątrz.
3. **Krój pisma** — osadzania fontów w PPTX **nie da się zagwarantować**; rekomendacja
   analityka: **PDF dla odbiorcy, PPTX dla edytujących**. Gamma sama ostrzega, że
   układy się rozjeżdżają przy eksporcie.
4. **285 dokumentów wiedzy na stagingu** ma zasięg prywatny, zero organizacyjnego.
5. **Migracja legacy→kanon** jest większa, niż zakładała decyzja D-7: na stagingu
   **411 z 467 zadań nie ma właściciela**, a domy kanoniczne istnieją tylko dla
   organizacji testowych. To osobny program, nie pilot.

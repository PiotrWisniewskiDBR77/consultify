---
id: ODB-VAULT-01
tytul: Client Vault — 3 poziomy przypisania dokumentu (osoba / projekt / organizacja)
typ: odbior-wizualny
waga: wysoka
obszar: VLT
stan: do-odbioru
wlasciciel: piotr
partia: 2026-07-23
narzedzie: Client Vault
flaga: ff_clientVault (istniejąca, ON)
zrzut: rejestr/_zrzuty/ODB-VAULT-01.png
zrzut_dark: rejestr/_zrzuty/ODB-VAULT-01-dark.png
utworzone: 2026-07-23
---

## 1. CO SIĘ ZMIENIŁO

Dokument w Vault można przypisać do jednego z trzech poziomów: **Osoba** (prywatne, tylko dla Ciebie), **Projekt** (zespół engagementu), **Organizacja**. Na ekranie: selektor „Level" przy dodawaniu, filtr „All Levels" obok filtra kategorii, badge poziomu na każdym kafelku dokumentu. Przy poziomie „Projekt" pokazuje się lista **tylko Twoich** projektów (decyzja z 23.07).

Kluczowe: **zero migracji bazy** — kolumny `owner_id`/`scope`/`project_id` już fizycznie istniały, robota polegała na podłączeniu, nie budowaniu modelu.

## 2. NA CO PATRZEĆ

Czy trzy poziomy są zrozumiałe dla konsultanta bez tłumaczenia? Czy selektor jest we właściwym miejscu formularza (pod kategorią/tagami)? Czy badge na kafelku wystarczy, żeby jednym rzutem oka poznać, co jest prywatne, a co widzi cała firma?

## 3. RYZYKO / ZNANE OGRANICZENIA

- **Ostrzeżenie zmiany zakresu NIE jest na tym zrzucie** — wymaga interakcji (edycja dokumentu → zmiana poziomu → „N dokumentów stanie się widocznych dla całej organizacji" → Confirm/Cancel). Działa i zostało zweryfikowane w dev-render, ale zrzut pokazuje stan spoczynkowy.
- **Etykiety po angielsku** (Level, Private only me, Project, Organization) — spójne z resztą tego ekranu, który jest po angielsku. Powiedz, czy blokuje akcept.
- Poziom domyślny przy uploadzie = **Organization** (zachowanie sprzed zmiany, wstecznie zgodne).

## 4. JAK ZWERYFIKOWANO

Harness Playwright (dev-render, mock, bez logowania), light+dark, zero błędów konsoli. **Test negatywny prywatności 7/7**: dokument `scope=user` użytkownika A nie pojawia się ani na liście użytkownika B tej samej organizacji, ani w odpowiedziach AI (RAG) — filtr domknięty we wszystkich ścieżkach retrievalu. Wdrożone na demo (`7b1ba021c2`, health OK).

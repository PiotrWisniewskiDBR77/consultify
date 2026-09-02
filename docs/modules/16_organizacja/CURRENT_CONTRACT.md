---
module_id: MODULE_ORGANIZATION
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-31
---

# Organization — aktualny kontrakt funkcjonalny

> ### ★ STAN ZMIERZONY 2026-09-01 (dyżur 236) — pełny pomiar: `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`
>
> **Obalone 1.09.** `docs/FUNCTIONAL_DOCUMENTATION.md:55` nosi zapis
> **„CLOSED_FINAL 2026-08-25"**. To zamknięcie opierało się na akcepcie
> **prototypu** (`DEC-2026-08-26-78`), nie na odbiorze realnego builda —
> `DEC-2026-08-25-74` nazywa to wzorcem *RUNTIME-IDENTITY-MISMATCH*. Odbiór
> wizualny realnego builda **nigdy nie wrócił do rejestru jako akcept
> właściciela**.
>
> **Flaga `orgRedesignV1` (`src/utils/orgRedesignFlag.ts:86-93`) ma realny
> default OFF**, mimo że nagłówek pliku (linia 19, odnosząc się do linii 35)
> mówi „DEFAULT ON". To nie jest sprzeczność ukryta — ten sam plik w
> komentarzu przy `readEnvFlag()` (linie 54-58) tłumaczy świadome cofnięcie
> **29.08 do czasu odbioru wizualnego**. Skutek: Organizacja renderuje dziś
> **21 pozycji w 6 grupach** (stary układ), a **11 przeprojektowanych ekranów
> jest nieosiągalnych** bez ręcznego przełączenia flagi. Stan pozostaje
> `OWNER_NOT_REVIEWED`. Dwa zastałe testy (`src/utils/__tests__/orgRedesignFlag.test.ts:36`
> i sąsiedni) nadal oczekują starej wartości ON i realnie się nie powodzą.

## Cel

Organization jest kanoniczną, kontrolowaną pamięcią biznesową firmy. Utrzymuje
profil, kierunek, cele, wyzwania, strategię oraz wiedzę ze źródłami,
aktualnością i poziomem zaufania. Dostarcza zatwierdzony snapshot Teresie i
wszystkim modułom, ale nie przejmuje ich obiektów domenowych.

Organization nie jest panelem administracyjnym. Członkowie, role, billing,
limity, domeny i konfiguracja należą do Admin Panel albo Settings.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `ORG-F-001` | Profil firmy | AS-IS |
| `ORG-F-002` | Kierunek, cele i oczekiwania | AS-IS / partial |
| `ORG-F-003` | Wyzwania, dowody i przyczyny | AS-IS / partial |
| `ORG-F-004` | Strategia, decyzje i założenia | AS-IS / partial |
| `ORG-F-005` | Wiedza, źródła i Knowledge Graph | AS-IS / partial |
| `ORG-F-006` | Typy twierdzeń, konflikty, aktualność i snapshot | AS-IS / partial |
| `ORG-F-007` | Przegląd UI/UX i nawigacji według kanonu sekcji 2026 | ZBUDOWANE, dziś ZA FLAGĄ OFF (11 ekranów; zmierzone 2026-09-01, patrz adnotacja wyżej) |

## Przepływ, dane i governance

Informacja ma jawny typ: fakt, ambicja, decyzja, założenie, opinia albo sygnał.
Uprawniony użytkownik zatwierdza zmianę, a moduły otrzymują wersjonowany
snapshot. Teresa używa wyłącznie dozwolonego kontekstu, wskazuje jego źródło i
nie podnosi automatycznie hipotezy do rangi faktu.

## AS-IS

Kanoniczna rodzina tras to `/organization/*`; historyczne `/context/*` jest już
przekierowane. Backend ma persystencję per organizacja, źródła, claims,
confidence, widoczność, konflikty, timeline, audit i snapshot.

Stary shell prezentacji jest niespójny z nowszym kanonem. Nawigacja nadal
pokazuje grupę Administration, mimo że prowadzi ona do Admin Panel.

## TO-BE i luki

Golden flow:

`profil/dokument → propozycje twierdzeń → review → snapshot → Teresa używa
kontekstu i źródeł → aktualizacja lub konflikt → rozstrzygnięcie`.

- zunifikować nakładające się powierzchnie profilu, claims, dokumentów i KG;
- potwierdzić propagation do Teresy i modułów;
- udowodnić tenant isolation, konflikt i usunięcie źródła;
- ustalić role publikowania oraz poufność strategii;
- usunąć z Organization drugą administrację;
- wykonać proporcjonalny reskin i przegląd nawigacji;
- potwierdzić light/dark, responsywność i standardowe stany.

Pełna zatwierdzona definicja:
`docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/02_ORGANIZATION_REVIEW.md`.

Ocena: `B`. Merytoryka zaakceptowana; UI polish i trzy decyzje governance
pozostają otwarte.

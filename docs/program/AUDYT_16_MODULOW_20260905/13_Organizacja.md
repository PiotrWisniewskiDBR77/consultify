# 13. Organizacja — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

22 ekrany, zero Twoich uwag. Redesign włączony od 03.09. Izolacja między organizacjami udowodniona dla 1 z 49 obowiązków (G19).

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Przeprojektowana Organizacja (A3) | `VITE_ORG_REDESIGN_V1_ENABLED` | ON od 03.09 (DEC-349) |

## A. Zatwierdzone obrazy — 22 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `org-claims-sources` | Organizacja — Twierdzenia i źródła | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-claims-sources__PO__light.png` |
| `org-declared-challenges` | Organizacja — Zadeklarowane wyzwania | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-declared-challenges__PO__light.png` |
| `org-evidence` | Organizacja — Dowody | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-evidence__PO__light.png` |
| `org-files` | Organizacja — Pliki | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-files__PO__light.png` |
| `org-identity-operating` | Profil organizacji — tożsamość i skala | A | ok |  | `evidence/grafika/grafika-14-ekranow/org-identity-operating__PRZED__light.png` |
| `org-operating-model` | Organizacja — Model działania | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-operating-model__PO__light.png` |
| `org-position-direction` | Organizacja — Pozycja i kierunek | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-position-direction__PO__light.png` |
| `org-recommendation` | Organizacja — Rekomendacja | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-recommendation__PO__light.png` |
| `org-root-causes` | Organizacja — Przyczyny źródłowe | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-root-causes__PO__light.png` |
| `org-scope-boundaries` | Organizacja — Zakres i granice | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-scope-boundaries__PO__light.png` |
| `org-source-conflicts` | Organizacja — Konflikty źródeł | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-source-conflicts__PO__light.png` |
| `org-stakeholder-expectations` | Organizacja — Oczekiwania interesariuszy | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-stakeholder-expectations__PO__light.png` |
| `org-strategic-intent` | Organizacja — Intencja strategiczna | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-strategic-intent__PO__light.png` |
| `org-success-metrics` | Organizacja — Mierniki sukcesu | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-success-metrics__PO__light.png` |
| `org-summary` | Organizacja — Gotowość organizacji | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-summary__PO__light.png` |
| `org-technology-culture-constraints` | Organizacja — Technologia, kultura i ograniczenia | A | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-technology-culture-constraints__PO__light.png` |
| `org-executive-brief` | Organizacja — Executive brief | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-executive-brief__PO__light.png` |
| `org-goal-blockers` | Organizacja — Blokery celów | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-goal-blockers__PO__light.png` |
| `org-knowledge-graph` | Organizacja — Graf wiedzy | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-knowledge-graph__PO__light.png` |
| `org-risks-opportunities` | Organizacja — Ryzyka i szanse | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-risks-opportunities__PO__light.png` |
| `org-scenarios` | Organizacja — Scenariusze | B | ok |  | `evidence/grafika/216-poprawione-dzis/mini-org-scenarios__PO__light.png` |
| `org-redesign-v1-full-closed-final-20260825` | Organizacja — redesign 21→11, komplet | D | — |  | — |

Bez Twojej decyzji (1): `org-redesign-v1-full-closed-final-20260825`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B1. Zatwierdzony komponent ≠ komponent realnego użytkownika (audyt przewodów 03.09)

| Ekran | Werdykt | Co jest inaczej | Stan dziś |
|---|---|---|---|
| `org-identity-operating` | WARUNKOWY | src/utils/orgRedesignFlag.ts:58 „domyślną wartością jest OFF” (flaga `orgRedesignV1`); harness jawnie wymusza `?ff_org_redesign_v1=1` (patrz `_parametry` w `scripts/dev/g06-macierz-ekrany.json` i nagłówek harnessu). | przełącznik ON od 03.09 lub od dziś — sprawdzić na żywo |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `org-identity-operating`: Ten ekran ma DWA warianty. Domyslnie widac stary (naprawiony przez nas). Docelowy, za flaga ff_org_redesign_v1, jest czysty. Naprawa dotyczy tego, co uzytkownik widzi dzis.
- `org-redesign-v1-full-closed-final-20260825`: WIERSZ-DUCH: zmigrowany z historycznego odbioru (CLOSED_FINAL, DEC-2026-08-24-11 + DEC-2026-08-24-15, tag final-01-organization) BEZ ŻADNEGO zrzutu w tym drzewie roboczym — potwierdzone przeszukaniem evidence/. Realny katalog dowodowy (29 plików) żyje na INNYM branchu (codex/m01-organization-2026082
- `org-redesign-v1-full-closed-final-20260825`: ZASTĄPIONY realnymi ekranami z rundy 150-ustawienia-organizacja (2026-08-31) — 20 ekranów wariantu domyślnego (flaga orgRedesignV1 OFF) faktycznie zweryfikowanych w kodzie OrganizationSidebar.tsx, każdy z własnym zrzutem i oceną: patrz np. org-operating-model, org-summary, org-strategic-intent.
- `org-redesign-v1-full-closed-final-20260825`: Ten wiersz pozostaje w rejestrze jako ślad historii (nie kasujemy), ale ocena D wyklucza go z tego, co widzi właściciel (strona pokazuje tylko A/B).
- `org-goal-blockers`: Crimson na ikonie lupy i przycisku '+ Utwórz własny' — akcja niekrytyczna, narusza zasadę 'crimson tylko dla semantyki krytycznej' (Pułapka nr 1 z kodeksu).
- `org-risks-opportunities`: Baner 'Logika oceny ryzyka' w kolorze crimson — informacyjny, nie stan krytyczny.
- `org-scenarios`: Pigułka 'REKOMENDOWANY' wypełniona kolorem crimson — dekoracyjna, nie stan krytyczny.
- `org-executive-brief`: Wartość 'Docelowa dojrzałość: Brak danych' wyświetlona w kolorze crimson mimo że to zwykły brak danych, nie stan krytyczny.
- `org-executive-brief`: Motyw ciemny: cały baner z profilem firmy ma pełne tło crimson — bardzo widoczne naruszenie Pułapki nr 1, sprawdzone osobno w dark.
- `org-source-conflicts`: Ekran nie różni się treścią od 'Twierdzenia i źródła' — możliwe, że to celowy wspólny widok; do potwierdzenia, nieblokujące dla i18n.
- `org-knowledge-graph`: Etykiety typów encji (Process/Person/System/Organization) nieprzetłumaczone, reszta ekranu po polsku.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 0 w tym module (0 realnych defektów)

Brak uwag w korpusie dla tego modułu.

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-01_ORGANIZATION-20260903-reszta.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`
   G19 |`IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY`| data=2026-09-04, sha=2a7273e087, mianownik pokryty=1 z 49 wg `G19_INWENTARZ_OBOWIAZKOW_20260903.md` sekcja R2, przypadek „Day 360 G19 01 Organization cross-org workload isolation through ApiGateway denies a foreign organization
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY` (podniesione dyzurem 360 po scaleniu); P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/
```

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Organizację → sprawdź czy widzisz nowy, przeprojektowany układ (nie stary) →
otwórz realnego członka/dział z listy → z kebaba wybierz jedną akcję.

**Co się zmieniło od 22–23.08**: włączyłeś 03.09 wieczorem przeprojektowany moduł Organizacji —
robotnik jeszcze kończy wdrożenie przełącznika (patrz „Czego NIE zgłaszaj” na górze dokumentu);
kolor pierścienia fokusu poprawiony w 14 miejscach; dostępność doprowadzona do zera błędów. Ten
moduł już raz obejrzałeś 02.09 na zrzutach bez uwag — dzisiejszy przelot to potwierdzenie na
żywym stagingu, z realnym rekordem.

**Czego NIE zgłaszaj**: —

**Pytania (TAK/NIE)**:
- Widzisz nowy układ Organizacji (nie stary, sprzed przeprojektowania)?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.

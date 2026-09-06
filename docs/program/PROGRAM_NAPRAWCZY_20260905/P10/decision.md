# Decyzja (decision) — kontrakt karty N, AUDYT ZGODNOŚCI (P10-B0, DEC-429)

> B0 = audyt, nie budowa od zera. Tabela rundy 1 Codexa zachowana w §6a. Ten plik ją
> uzupełnia do formatu §0–§7 i dokłada pomiar NA ŻYWO flagi kontraktu (§6b), który
> **koryguje** zlecenie: flaga NIE jest twardym `return false` — patrz §6b.

## §0. Tożsamość

- **Nazwa PL:** Decyzja · **moduł:** 07_MY_WORK_AGENT (Moja Praca) · **archetyp:** C (Rekord)
- **Trasa:** `/my-work/decisions` (bez id w URL, panel to stan klienta)
- **Jak otworzyć z listy:** Moja Praca → Decyzje → wiersz → „Otwórz”
- **Komponent:** `src/components/MyWork/DecisionDetailView.tsx:1160` (10003 linii)
- **Powłoka dziś:** `StandardArtifactShell`; kontrakt: `src/components/MyWork/decisionCardContract.ts`
  (import `:135`), 8 kart `KanonicznaKarta`
- **Rejestr:** `registry.ts` → `decision`

## §1. Sekcje (katalog kanoniczny, 8 kart)

| sekcja | po co użytkownikowi | źródło danych (API pole → writer) | reguła pustki | kolejność | S/L |
|---|---|---|---|---|---|
| Zakres decyzji (`context-problem`) | rdzeń — co się rozstrzyga | pola decyzji → `DecisionController.ts:2627-2739`, prompt `decision.context-problem` | brak (zawsze) | 0 | L |
| Opcje i trade-offy (`options-tradeoffs`) | warianty i ich koszty/zyski | `alternatives` → `DecisionController.ts:2868-2987`, prompt `decision.options` | brak | 1 | L |
| Ryzyko i wpływ (`risk-impact`) | co może pójść źle | `risks` → `DecisionController.ts:3000-3164`, prompt `decision.risk` | brak | 2 | L |
| Konsekwencje (`consequences`) | koszt bezczynności | `consequences_of_inaction` → `DecisionController.ts:149-166`, prompt `decision.consequences` | brak | 3 | L |
| RACI i eskalacja (`governance`) | kto decyduje/eskaluje | interesariusze → `DecisionController.ts:3053-3090`, prompt `decision.raci` (asystuje) | brak | 4 | L |
| Załączniki i powiązania (`attachments`) | dowody podjęcia decyzji | agregat evidence links → `DecisionController.ts:2627-2739` | brak (rolaAI `dane`) | 5 | L |
| Komentarze (`comments`, prawy panel) | dyskusja | `DecisionController.ts:2784-2842` | brak | 6 | prawy panel |
| Logi aktywności (`activity-log`, prawy panel) | log zmian | systemowy log agregatu → `DecisionController.ts:2627-2739` | brak | 7 | prawy panel |

**K4:** żadna sekcja Decision nie ma reguły pustki — w przeciwieństwie do Task (DEC-411), Decision nie
ma odpowiednika `taskSectionVisibility.ts`. Wszystkie 8 kart renderują nagłówek niezależnie od danych
(nie zmierzone na pustym rekordzie — do potwierdzenia osobno).

## §2. Prawy panel

| sekcja | obowiązkowość | stan na zrzucie (`02-decision.png`, `decision-sekcje-bez.png`) |
|---|---|---|
| Akcje | obowiązkowa (K6) | ✓ „Zatwierdź decyzję / Odrzuć / Więcej akcji” |
| Właściwości (tabela) | obowiązkowa (K7) | ✓ Status→Przepływ pracy→Waga→Termin→Decydent, tabela prawdziwa |
| Powiązania | obowiązkowa (K8) | ✓ obecna |
| Źródła i założenia | obowiązkowa dla AI (K9) | ✓ obecna |
| Komentarze | warunkowa | ✓ obecna |
| Historia | obowiązkowa (K10) | ✓ „HISTORIA — 1” |

## §3. Menu 5 i nawigacja

Komplet trzech elementów Menu 5: „Sekcje ▾” / „Edycja/Podgląd” / „Pracuj z AI ▾” (K12 ✓). Manager
„Sekcje”:
- **baseline:** „Standardowy” / „Minimalny”
- **z kontraktem:** „Kompletna decyzja” / „Rdzeń decyzji” / „Pełny” (`decisionCardContract.ts:282-284`)

Klasa L. Edycja/Podgląd renderuje się (K14 nie testowane na roli bez prawa w tej rundzie).

## §4. AI — „Pracuj z AI ▾”

`PracujZAI` podpięty (`DecisionDetailView.tsx:6317`) przez `zbudujZrodlaPracujZAI` (`:6090`).
`generateAlternativesAI`/`generateRisksAI`/`generateConsequenceScenariosAI` (`:3357`,`:4070`,`:4416`)
są WPIĘTE JAKO ŹRÓDŁA `PracujZAI` (`:6146,6152,6158`) — inaczej niż Task, gdzie te same wzorce mają
DODATKOWO osobne stare przyciski. Decision nie duplikuje wejść AI (K21 czyściej spełnione niż Task).
Sekcje mają lokalne „Regeneruj”/„Edytuj”/„Retry” (`:6615-6623`, `:6962-6965`) — to standardowy wzorzec
regeneracji JUŻ wygenerowanej treści, nie osobny system AI, zgodny z K21.

| sekcja | rubryka (`cardAnalysisRubric.ts:190`) | AI może uzupełnić | tylko do odczytu |
|---|---|---|---|
| decision (cały typ) | `DECISION_CARDS` | zakres, opcje i trade-offy, ryzyko i wpływ, konsekwencje | dowody, decydent, status, RACI |

Teresa: brak wzmianek na zrzucie (K27 ✓).

## §5. Czytelność graficzna

Zrzut 1440 jasny (`02-decision.png`, `decision-sekcje-bez.png`) czysty; pigułka otwartej karty w
pasku modułu obecna (K19 ✓); brak angielskich literałów widocznych poza „AI” (K25 ✓, wg matrycy).
`primary-[0-9]` nie liczone przez grep pliku w tej rundzie — przyjęte 0 z matrycy `MATRYCA_21_KART.md`.

## §6a. Stan zastany vs kontrakt — tabela Codexa (runda 1, zachowana bez zmian)

| sekcja | kontrakt mówi (plik:linia) | ekran pokazuje (plik:linia + zrzut) | źródło danych | rozjazd | waga |
|---|---|---|---|---|---|
| Zakres decyzji | `decisionCardContract.ts:61-76` | `DecisionDetailView.tsx:1592`; brak dowodu runtime | pola decyzji → `DecisionController.ts:2627-2739` | brak | kosmetyka |
| Opcje i trade-offy | `decisionCardContract.ts:77-93` | jw. | `alternatives` → `DecisionController.ts:2868-2987` | brak | kosmetyka |
| Ryzyko i wpływ | `decisionCardContract.ts:94-110` | jw. | `risks` → `DecisionController.ts:3000-3164` | brak | kosmetyka |
| Konsekwencje | `decisionCardContract.ts:111-129` | jw. | `consequences_of_inaction` → `DecisionController.ts:149-166` | brak | kosmetyka |
| RACI i eskalacja | `decisionCardContract.ts:130-154` | jw. | interesariusze → `DecisionController.ts:3053-3090` | brak | kosmetyka |
| Załączniki i powiązania | `decisionCardContract.ts:155-180` | jw. | agregat evidence links → `DecisionController.ts:2627-2739` | brak | kosmetyka |
| Komentarze | `decisionCardContract.ts:181-198` | prawy panel `DecisionDetailView.tsx:9771`; brak dowodu runtime | comments → `DecisionController.ts:2784-2842` | brak | kosmetyka |
| Logi aktywności | `decisionCardContract.ts:199-223` | prawy panel; brak dowodu runtime | systemowy log agregatu → `DecisionController.ts:2627-2739` | brak | kosmetyka |

## §6b. POMIAR NA ŻYWO flagi `VITE_VF1_DECISION_CARD_CONTRACT` (P10-B0, 06.09.2026)

**Zlecenie zakładało „twardy `return false`” na `DecisionDetailView.tsx:529`. NIEŚCISŁE** — to znów
sam ostatni fallback. Pełny kod (`:503-530`) czyta: URL `?cardContract=1` → localStorage
`ff.cardContract` → env `VITE_VF1_DECISION_CARD_CONTRACT` → dopiero `false`. **Da się włączyć jednym
linkiem, bez zmiany kodu, bez zmiennej środowiskowej.**

**Metoda:** vite port 3111, sesja `stanowisko-noc/auth.json`, rekord „DBR77: Czy włączamy publiczne
linki do raportów?”, zrzut 1440 jasny bez/z `?cardContract=1`.
Dowody: `evidence/p10b0-kontrakty/decision-sekcje-{bez,z}.png(.json)`.

**Co się NIE zmienia:** treść i etykiety sekcji w centrum (pochodzą z `notionSections`,
`DecisionDetailView.tsx:1598` — tablica osobna od `DECISION_CARD_SPEC`, analogicznie do `taskNSections`
w Task). `bledyKonsoli:[]` w obu wariantach.

**Co się zmienia** (zrzut `decision-sekcje-{bez,z}.png`):
- Nazwy zestawów: „Standardowy/Minimalny” → „Kompletna decyzja/Rdzeń decyzji/Pełny”.
- Kolejność w spisie: OFF „…RACI i eskalacja, Komentarze, Załączniki i powiązania, Logi aktywności”;
  ON „…RACI i eskalacja, Załączniki i powiązania, Komentarze, Logi aktywności” (Załączniki przed
  Komentarzami — zgodne z `kolejnosc: 5` vs `6` w `decisionCardContract.ts:172,192`).
- Namespace klucza layoutu `v1`→`v2-contract` (`:1707-1709`) — jak w Task.

**Wniosek identyczny jak Task:** K2 pozostaje niespełnione nawet z flagą ON — kontrakt to warstwa
sortowania nad osobną, ręcznie zsynchronizowaną listą (`notionSections`), nie źródło treści.

## §7. Luki → naprawa

| # | luka | rozmiar | decyzja właściciela? | rekomendacja |
|---|---|---|---|---|
| 7.1 | K2: kontrakt nie steruje renderem nawet z flagą ON — `notionSections` (hardcode) vs `DECISION_CARD_SPEC` (kontrakt), dwie listy | L | tak — jak w Task (7.1), wspólna decyzja dla obu bliźniaczych kart | ujednolicić podejście z Task w jednym kroku (są bliźniakami wg komentarzy w kodzie) |
| 7.2 | brak reguły pustki (K4) na żadnej z 8 sekcji | M | tak — czy Decision ma dostać taką samą regułę jak Task (DEC-411) dla `options-tradeoffs`/`risk-impact`/`governance` | tak, wzorcem Task — ujednolicenie z bliźniaczą kartą |
| 7.3 | namespace localStorage layoutu bez migracji przy przełączeniu flagi | S | nie | jak w Task 7.5 |

**STOP:** nie testowałem K11/K14 w tej rundzie — poza zakresem B0.

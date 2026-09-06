# Wzorzec (szablon) — `template`

**Status:** PROPOZYCJA — do słowa właściciela. Karta #57 inwentarza, moduł `11_MATERIALS`.
Biblioteka wzorców po M-2 (właściciel odebrał listę — ten kontrakt dotyczy KARTY otwieranej z tej
listy, nie samej listy).

## §0. Tożsamość

- Nazwa PL: **Wzorzec** — jedna wspólna powłoka dla TRZECH typów: wzorzec Dokumentu, wzorzec
  Prezentacji (Deck), wzorzec Arkusza (`draft.type: 'doc'|'deck'|'sheet'`) — archetyp zmienia
  wyłącznie centrum (`centerEditor`) i etykiety spisu struktury.
- Moduł: `11_MATERIALS`. Archetyp: **B — Dokument** (edytor struktury szablonu).
- Otwarcie: Materiały → Szablony → wiersz → `TemplateBuilder.tsx:329`. **Brak dedykowanej trasy
  URL** — `grep TemplateBuilder src/routes/AppRoutes.tsx` = zero trafień; `templateId` jest
  propem/stanem lokalnym komponentu-rodzica, nie parametrem URL. **To łamie test
  record-identity z `_wzorzec-raport-dokument.md`** („czy istnieje `GET /.../<id>`, które po
  zamknięciu i ponownym otwarciu odda dokładnie ten sam dokument" — tu owszem istnieje
  `getWorkbookLifecycle(templateId)`/`updateTemplate(templateId, draft)` jako WYWOŁANIA API, ale
  ekran sam nie ma linku do ponownego otwarcia — otwiera się WYŁĄCZNIE jako panel/modal z listy,
  nie ma `/templates/:id` do wklejenia w pasek adresu).
- Komponent wspólnej powłoki: `src/components/TemplateBuilder/TemplateBuilderShell.tsx:1`
  (310 linii, komentarz nagłówkowy: „WSPÓLNA POWŁOKA 3 builderów template (#83d)"). Powłoka:
  **`ExecutiveModuleShell`** (`:259`), NIE `ArtifactRightPanel`/`NModeShell`.
- Prawy rail: `TemplateRightPanel.tsx:1` (105 linii) — **jedno jedyne narzędzie: „Właściwości"**
  (`TEMPLATE_RIGHT_TOOLS`, `:32-34`), żaden inny tool nie istnieje w tym railu.

## §1. Sekcje

Struktura wzorca (rozdziały dokumentu / slajdy / arkusze) żyje w `TemplateStructureList`
(lewa kolumna), nie w katalogu `KanonicznaKarta` (K1 ✗).

## §2. Prawy panel — jedna zakładka, i to FORMULARZ EDYCJI, nie odczyt

`TemplateRightPanel.tsx` renderuje WYŁĄCZNIE pola edycji draftu (Nazwa/Opis/Dostępność/Motyw,
`:61-100`) — nie ma nawet w zamierzeniu drugiej zakładki. Komentarz w kodzie mówi to wprost:
„Teresa wróci dopiero razem z bezpiecznym handlerem UnifiedChat — prawy rail nie może eksponować
martwego CTA ani obiecywać niewdrożonej funkcji" (`:5-6`) — **świadoma decyzja NIE dodawania AI
dopóki nie ma bezpiecznego handlera**, różna jakościowo od reszty partii (tu brak AI jest
udokumentowaną decyzją, nie przeoczeniem).

| kanon (K6–K11) | obecne? |
|---|---|
| Akcje | ✗ brak (akcje żyją w command-row górnym: „Zapisz jako szablon") |
| Właściwości (**tabela**) | ✗ — to jest FORMULARZ (pola do edycji: Nazwa/Opis/Dostępność/Motyw), nie tabela właściwości do odczytu; K7 wymaga dwukolumnowej tabeli „Właściwość \| Wartość", tu jest odwrotna natura ekranu (edycja, nie prezentacja) |
| Powiązania | ✗ brak |
| Źródła i założenia | ✗ brak |
| Komentarze | ✗ brak |
| Historia | ✗ brak (ale command-row ma osobny przycisk „Historia wersji" poza prawym panelem — nie zweryfikowano w tej partii) |

## §3. Menu 5 i nawigacja

Brak Menu 5 kanonu. Command-row górny: badge typu · badge zakresu · picker motywu · „Zapisz jako
szablon" (primary = navy, NIE crimson — zgodne z K17 z założenia projektowego, potwierdzone
komentarzem nagłówkowym pliku).

## §4. AI

Zero AI w ogóle — świadomie (§2). `template`/wzorzec poza `cardAnalysisRubric.ts`/`registry.ts`
(K21 ✗, K24 ✗ — ale tu przynajmniej udokumentowane DLACZEGO, nie milczenie).

## §5. Czytelność

- Wszystkie etykiety w `TemplateRightPanel.tsx` idą przez `t()` z domyślnymi wartościami PO
  POLSKU (`'Właściwości szablonu'`, `'Nazwa'`, `'Opis'` itd., `:58-100`) — **wzorcowo poprawne**:
  nawet fallback jest w języku UI, nie w angielskim.
  Command-row w `TemplateBuilderShell.tsx` — analogicznie (`'Kreator szablonu'`, `'Wróć'`,
  `'Sekcje'`/`'Slajdy'`/`'Arkusze'`, wszystko domyślnie PL).
- `primary-[0-9]`: nie znaleziono w przeglądzie obu plików.

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | ✗ | brak katalogu |
| K7 tabela Właściwości | ✗ (natura inna — formularz edycji) | `TemplateRightPanel.tsx:53-101` |
| K8–K10 Powiązania/Komentarze/Historia | ✗ brak wszystkich | — |
| K12 Menu 5 | ✗ | brak, command-row zamiast tego |
| K17 zero primary | ✓ | przegląd kodu, 0 trafień |
| K21 Pracuj z AI | ✗ (świadomie odłożone) | komentarz `:5-6` |
| K25 i18n | ✓ | fallbacki `t()` po polsku |
| K27 Teresa tylko Menu 1 | ✓ (trywialnie, brak AI w ogóle) | — |
| **Tożsamość rekordu** | **✗ brak trasy `/…/:id`** | `templateId` to prop, nie parametr URL — łamie test z `_wzorzec-raport-dokument.md` |
| K30 zrzut żywy | brak w tej partii | — |

## §7. Luki → naprawa

1. **Brak trasy z tożsamością (`/templates/:id`)** — to jest fundamentalna luka, głębsza niż
   kosmetyka: bez URL nie da się wysłać linku do konkretnego szablonu, wrócić po odświeżeniu
   strony, ani otworzyć go z powiadomienia. **Do decyzji właściciela**, czy to w ogóle ma być
   „karta N" w rozumieniu SSOT, czy zostaje panelem-modalem otwieranym WYŁĄCZNIE z listy (jak
   dziś) — analogiczna sytuacja do `management-report.md`. Rozmiar M (dodanie trasy + parsowanie
   `useParams`), Sonnet, PO decyzji.
2. **Prawy panel — tylko edycja, zero odczytu/Powiązań/Historii** — jeśli wzorzec ma zostać
   kartą N pełnoprawną, potrzebuje też WIDOKU (nie tylko formularza): kto go użył, ile razy,
   powiązane dokumenty. Rozmiar L, Opus (nowa funkcjonalność, nie kosmetyka).
3. **AI odłożone świadomie** — nie luka do „naprawy" w tej partii; zostawić jako jest, dopóki nie
   ma bezpiecznego handlera UnifiedChat (cytat z kodu). Rekomendacja: nie dodawać AI-guza na siłę
   tylko żeby zamknąć K21 — właściciel sam to zaznaczył jako świadomy dług.

**STOP:** brak zrzutu żywego w tej partii (K30) — biblioteka wzorców nie miała czasu w budżecie
tej sesji na osobne uruchomienie z realnym rekordem DBR77.

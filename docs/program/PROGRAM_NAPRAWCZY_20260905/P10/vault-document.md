# Dokument sejfu klienta (`vault-document`)

**Status:** PROPOZYCJA — do słowa właściciela. Karta #60 inwentarza, moduł `11_MATERIALS`.
**STOP z matrycy P10-S rozwiązany w tej partii**: oba sejfy DBR77 miały 0 dokumentów
(`06-vault-lista.png`, matryca wiersz 06); w tej sesji utworzono JEDEN realny dokument przez
kontrakt produktu (API uploadu, nie SQL) — patrz §0 „Dowód utworzenia" i STOP na końcu (README
stanowiska NIE zaktualizowany — powód w STOP).

## §0. Tożsamość

- Nazwa PL: **Dokument sejfu klienta** — plik wgrany do „Sejfu" (My safe / Organization safe),
  indeksowany dla RAG (odpowiedzi AI w tym sejfie).
- Moduł: `11_MATERIALS` (dostęp z „Moja Praca" → zakładka Sejfy, `?tab=vault`).
- Otwarcie: `/my-work?tab=vault` → sejf → wiersz dokumentu → **PODGLĄD BOCZNY (preview pane)**,
  NIE osobna karta/trasa z `:id`. **To jest kluczowe rozstrzygnięcie zmierzone w tej partii**:
  inwentarz (#60) wskazywał `VaultDocumentPanel.tsx:101` jako „komponent karty" — pomiar pokazuje,
  że ten komponent to w rzeczywistości **formularz „Dodaj dokument"/„Edytuj metadane"**
  (`Sheet`/`SheetContent`, panel boczny do UPLOADU, nie do OGLĄDANIA treści —
  `VaultDocumentPanel.tsx:1-17`, komentarz nagłówkowy wprost: „panel boczny WNĘTRZA SEJFU: 'Dodaj
  dokument' i 'Edytuj metadane'"). Otwarcie dokumentu z listy renderuje standardowy PODGLĄD
  (Preview pane, kanon `consultify-preview`) w `VaultDocumentsView.tsx:1400-1442`, NIE osobną
  kartę pełnostronicową. **Nie istnieje trasa `/vault/documents/:id`** — brak własnego adresu
  do wklejenia w pasek przeglądarki.
- Bramka: `isClientVaultEnabled()` (`src/utils/clientVaultFlag.ts`) — **domyślnie ON**
  („AKCEPT Piotra 2026-07-15 — default ON", `:59-64`).

## Dowód utworzenia (ten kontrakt, 06.09.2026 ~20:43 CEST)

Sejf organizacji DBR77 miał 0 dokumentów (matryca P10-S, potwierdzone ponownie na żywo tuż przed
uploadem: `GET /api/knowledge/vault-safes` → `organization.documentCount: 0`). Utworzono JEDEN
realny dokument **przez kontrakt produktu** — `POST /api/knowledge/documents` (multipart,
`server/src/routes/knowledge.routes.ts:878-1017`, ten sam endpoint, którego używa
`Api.uploadKnowledgeDocument` z UI, `src/services/api.ts:8922-8955`), NIE wstawka SQL:

- Plik: `DBR77 - Raport z oceny DRD.docx` (kopia realnego, wygenerowanego wcześniej raportu z
  oceny DBR77, `evidence/dokument-plik-20260906/DBR77_Raport_z_oceny_DRD.docx` w tym worktree —
  treść merytoryczna, nie plik-śmieć).
- `scope=organization`, `category=raport-oceny`.
- Wynik: `docId=c0fc94e7-d5dc-4938-a919-f2c0e7144d54`, `versionId=672bdc13-98b2-4e87-b59a-1055be56a789`,
  `chunkCount=62`, zindeksowany.
- Zweryfikowano NA ŻYWO (przeglądarka, port 3101, `auth.json` DBR77): sejf organizacji pokazuje
  „Dokumenty: 1", „Rozmiar: 253 KB", „W wiedzy AI: 1/1"; podgląd dokumentu otwiera się z prawidłową
  treścią (§2). Zrzuty: `evidence/p10b3-materialy/00-vault-lista.png`,
  `01-vault-sejf-organizacji.png`, `02-vault-dokument-preview.png` (+ `.json`, `bledyKonsoli: []`
  w obu).

## §1. Sekcje — nie ma „karty", jest podgląd

Brak sekcji w rozumieniu kanonu — treść to jeden PODGLĄD (nie wielosekcyjny dokument). Podgląd na
żywo (§2 poniżej, tekst zrzutu) pokazuje: nagłówek (nazwa, status „Zindeksowany"), meta (Poziom,
Kategoria, data dodania), notatka „Dokument zasila odpowiedzi AI w tym sejfie (62 fragmentów)",
blok METADANE (Streszczenie/Nazwa pliku/Kategoria/Tagi/Rozmiar/Fragmenty/Dodano/Poziom), blok AI,
blok POWIĄZANIA, akcja „Edytuj".

## §2. „Prawy panel" = treść PODGLĄDU (Preview pane), nie ArtifactRightPanel

Zmierzone bezpośrednio na żywo (`02-vault-dokument-preview.png.json`, `tekst`):

```
DBR77 - Raport z oceny DRD
Zindeksowany · Organizacja · raport-oceny · 6 wrz 2026
Dokument zasila odpowiedzi AI w tym sejfie (62 fragmentów).
METADANE
~35 słów · Streszczenie: —
Nazwa pliku / Kategoria / Tagi / Rozmiar / Fragmenty w indeksie / Dodano / Poziom
AI
  Streść dokument
  Wyciągnij wnioski
POWIĄZANIA
  Brak powiązań
Edytuj
```

To jest kanon `consultify-preview` (nagłówek·meta·treść·akcje), NIE kanon karty N
(`ArtifactRightPanel` z Akcje/Właściwości-tabela/Powiązania/Źródła/Komentarze/Historia). Bloki AI
i POWIĄZANIA istnieją, ale w strukturze podglądu, nie prawego panelu karty.

**AI — realnie WYŁĄCZONE (phantom, potwierdzone kodem i zrzutem)**: `VaultDocumentsView.tsx`
buduje ten blok z `disabled: true` na sztywno (`:1425-1432`):
```
ai={{
  hints: ['Streść dokument', 'Wyciągnij wnioski'],
  disabled: true,
  disabledTooltip: t('common.comingSoonBackend', 'Wkrótce (backend)'),
}}
```
Zrzut na żywo potwierdza dokładnie te dwie etykiety w bloku „AI" — **przyciski są WIDOCZNE, ale
nieklikalne, z komunikatem „Wkrótce (backend)"** — dokładnie wzorzec „przyrząd pokazuje nie
produkt"/fantom z pamięci sesji: UI obiecuje funkcję, backend jej nie ma.

**POWIĄZANIA**: `relations={[]}` na sztywno w kodzie (`:1432`) — zawsze puste, niezależnie od
danych; `relationsEmptyLabel` poprawnie po polsku.

## §3. Menu 5 i nawigacja

Nie dotyczy — to podgląd bez własnej trasy, nie ma Menu 5. „Edytuj" otwiera
`VaultDocumentPanel` (sheet formularza metadanych), nie kartę.

## §4. AI (K21–K24)

Zero `PracujZAI`. AI ograniczone do dwóch podpowiedzi w bloku podglądu, **jawnie disabled**
(§2) — to NIE jest luka „zapomniano podłączyć", to jest UCZCIWIE oznaczony brak backendu
(`disabledTooltip`), różne jakościowo od kart, gdzie AI wygląda na żywe, a nie działa po kliku.
`vault-document` poza `cardAnalysisRubric.ts`/`registry.ts` (K24 ✗ pusty wiersz — matryca P10-S
(§P2) już to odnotowała: „dokument sejfu" wchodzi do rejestru dopiero „po decyzji o writerze
streszczenia" — streszczenie dziś = „—" w zrzucie, backend go nie generuje).

## §5. Czytelność

Zrzut na żywo (`02-vault-dokument-preview.png.json`): `bledyKonsoli: []` (K29 ✓), zero angielskich
literałów widocznych w tekście zrzutu (K25 ✓ na tym ekranie), zero identyfikatorów technicznych w
tekście widocznym (docId nie pojawia się w treści zrzutu — K28 ✓).

## §6. Stan zastany vs kontrakt (K1–K30)

| K | wynik | dowód |
|---|---|---|
| K1 kontrakt sekcji | n/d | to podgląd, nie karta wielosekcyjna |
| K7 tabela Właściwości | ✗ (natura inna) | blok METADANE to lista etykieta-wartość, nie karta N z prawym panelem |
| K8 Powiązania | ✓ obecne (zawsze puste) | `relations={[]}` na sztywno, kod |
| K9 Źródła i założenia | n/d | dokument JEST źródłem (dla innych kart), nie ma własnych źródeł |
| K10 Komentarze/Historia | ✗ brak | nie ma tych bloków w podglądzie |
| K12 Menu 5 | ✗ n/d | brak własnej karty/trasy |
| K21 Pracuj z AI | ✗ | dwie podpowiedzi zamiast 3-pozycyjnego menu, i to disabled |
| K24 AI per typ | ✗ | brak wpisu w rubryce; matryca już to odnotowała jako świadomy warunek |
| K27 Teresa tylko Menu 1 | ✓ | zero wzmianek Teresy w zrzucie |
| K28 zero ID technicznych | ✓ | docId nie widoczny w tekście zrzutu |
| K29 zero błędów konsoli | ✓ | `bledyKonsoli: []` |
| K30 zrzut 1440 z realnym rekordem | **✓ (naprawione w tej partii)** | `evidence/p10b3-materialy/02-vault-dokument-preview.png` |
| **Tożsamość rekordu (test z `_wzorzec-raport-dokument.md`)** | **✗ nie ma `GET /.../:id` z własną trasą** | otwarcie to podgląd, nie routowana karta |

## §7. Luki → naprawa

1. **AI disabled bez backendu (K21/K24)** — dwie podpowiedzi „Streść dokument"/„Wyciągnij
   wnioski" są PRAWDOMÓWNE (jawny `disabled`+tooltip), ale to wciąż brakująca funkcja, nie
   kosmetyka. Wymaga: (a) writera streszczenia dokumentu (matryca P10-S §P2 już to nazwała
   warunkiem wejścia do rejestru), (b) decyzji czy to ma być kanoniczne „Pracuj z AI" czy zostaje
   dwiema podpowiedziami w podglądzie. **Do decyzji właściciela.** Rozmiar L, Opus.
2. **Brak własnej trasy/karty** — dziś to WYŁĄCZNIE podgląd; jeśli właściciel chce pełną kartę N
   (Menu 4/5, prawy panel standardu) zamiast podglądu, to nowa praca, nie naprawa istniejącego
   ekranu. **Do decyzji właściciela**: czy dokument sejfu w ogóle POWINIEN być kartą N pełną, czy
   podgląd + „Edytuj metadane" to docelowy, wystarczający kształt dla pliku (w odróżnieniu od
   dokumentu TWORZONEGO w produkcie, jak `document`/#52). Rozmiar: decyzja produktowa.
3. **Relacje zawsze puste na sztywno** (`relations={[]}`) — jeśli dokument sejfu MA sensowne
   powiązania (np. z inicjatywą, która go cytuje), warto je realnie policzyć zamiast trzymać
   listę pustą z założenia. Rozmiar M, Sonnet — po ustaleniu źródła danych.

**STOP dot. README stanowiska**: zlecenie tej partii instruowało zapisanie wpisu w „README
stanowiska" (`/private/tmp/stanowisko-noc/`) po utworzeniu dokumentu pokazowego. **Zasady wspólne
tej partii wyraźnie ZAKAZUJĄ dotykania `/private/tmp/stanowisko-noc` poza odczytem `auth.json` i
`server.env`** — te dwie instrukcje są sprzeczne. Rozstrzygnięcie: trzymam się zakazu (silniejsza,
bezwarunkowa reguła bezpieczeństwa) i NIE pisałem do tego katalogu. Zamiast tego cały dowód
utworzenia (docId, endpoint, plik źródłowy, wynik weryfikacji) jest spisany w sekcji „Dowód
utworzenia" powyżej — nadzorca/sesja główna może przenieść tę notatkę do README stanowiska, jeśli
uzna to za bezpieczne i potrzebne. Dokument POZOSTAJE w sejfie organizacji DBR77 jako dane
pokazowe (zgodnie z instrukcją zlecenia) — nie został usunięty.

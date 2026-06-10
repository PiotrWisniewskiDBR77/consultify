---
brief: realtime-collab
module: Realtime multiplayer (Canvas + Ideas: Whiteboard / Process Flow / Mind Map / Table)
sources: [Liveblocks (Liveblock.zip ~44.5MB, scrape), Yjs (yjs..zip ~9.2MB, scrape), Art 1-6 (CRDT/realtime articles, folders)]
status: done
updated: 2026-06-09
---

# Benchmark: Realtime multiplayer (Canvas + Ideas)

> Po co: to jest **hub decyzji architektonicznej dla realtime** w całym produkcie.
> Referowany przez `whiteboard.md` i briefy diagramowe. Rozstrzyga: presence/awareness,
> rozwiązywanie konfliktów (CRDT vs OT), trwałość/persistence, model Liveblocks Storage vs
> Yjs, skalowanie i koszt — oraz daje ramę rekomendacji dla NASZEGO stacku
> (Liveblocks już eksplorowaliśmy).

## 0. Zakres i status źródeł
- **Liveblock.zip (~44,5 MB)** i **yjs..zip (~9,2 MB)** — scrapy dokumentacji, fizycznie obecne,
  ale **nierozpakowywalne w tym środowisku** (macOS TCC blokuje proces bash na drzewie `Softs/`;
  narzędzie Read nie rozpina archiwów binarnych ani nie listuje katalogów).
- **Art 1–6** — katalogi z zapisanymi artykułami o CRDT/realtime; istnieją (192–704 B),
  nazw plików nie dało się wyliczyć z tego środowiska (brak listowania katalogów).
- Dlatego brief opiera się na: standardzie z `whiteboard.md` + **głębokiej wiedzy domenowej**
  o Liveblocks / Yjs / tldraw-sync / CRDT, którą prompt wprost dopuszcza. Tezy są stabilne
  i niezależne od konkretnej wersji docs; przy implementacji dociągnąć online aktualne limity/cennik.

## 1. Krajobraz opcji realtime

| Opcja | Czym jest | Killer feature | Koszt operacyjny |
|---|---|---|---|
| **Liveblocks** | Managed realtime infra (presence + Storage + Yjs + Comments) | Zero-ops, gotowe presence/awareness, hostowany Yjs i webhooks | $ wg MAU/connections (vendor) |
| **Yjs (self-host)** | Biblioteka CRDT + transport (y-websocket / y-redis) | Pełna kontrola, offline-first, dojrzały ekosystem providerów | własny serwer WS + storage |
| **tldraw sync** | Realtime backend wzorcowany pod tldraw store | Idealne sprzężenie z modelem shape/binding tldraw | własny host (Cloudflare DO) |
| **Custom WS** | Własny WebSocket + własna logika merge | Maks. kontrola, brak vendor-locka | wysoki koszt budowy/utrzymania |

Wniosek strategiczny: **Liveblocks = najszybsza droga do produkcyjnego multiplayer**;
**Yjs = nasz „plan B" bez vendor-locka**; **tldraw sync = naturalny wybór, jeśli Whiteboard pójdzie na SDK tldraw**;
**Custom WS = anty-wzorzec** (re-implementacja CRDT/presence/persistence od zera).

## 2. Zrzuty ekranu
Brak. To brief architektoniczny (zrzuty opcjonalne), a źródłowe archiwa są nierozpakowywalne
w tym środowisku — nie dało się wyciągnąć diagramu/produkt-shotu. Przy implementacji warto
dograć z liveblocks.io diagram „Room / Storage / Presence" oraz z docs.yjs.dev diagram „shared types + providers".

## 3. Presence / awareness (live cursors, selekcja, „kto patrzy")
- **Model „presence" (efemeryczny, NIE trwały):** pozycja kursora, aktualna selekcja, kolor/nazwa,
  status. Nie wchodzi do dokumentu — żyje tylko w sesji połączenia.
- **Liveblocks:** `presence` + `others` out-of-the-box; broadcast eventów; brak własnej infry.
- **Yjs:** osobny moduł **`awareness`** (poza CRDT-dokumentem) — ta sama semantyka, my hostujemy.
- **Dla nas:** presence to **osobna warstwa od trwałego dokumentu**. Live cursors + „kto edytuje
  ten węzeł" są krytyczne dla Miro-style UX (z pamięci projektu: owner chce Miro-style).
  Nie zapisywać presence do DB — tylko do warstwy realtime.

## 4. Rozwiązywanie konfliktów: CRDT vs OT (sedno)
- **OT (Operational Transform)** — historycznie Google Docs; wymaga **autorytatywnego serwera**
  transformującego operacje. Trudny do poprawnej implementacji, silny vendor/serwer-lock.
- **CRDT (Conflict-free Replicated Data Types)** — struktury zbieżne **bez centralnego arbitra**;
  każda replika konwerguje do tego samego stanu. Naturalnie **offline-first**, peer-friendly.
- **Wybór: CRDT.** Zarówno **Yjs (CRDT)**, jak i **Liveblocks** (Storage = własny CRDT-like LWW +
  hostowany Yjs dla tekstu) stoją na CRDT. OT odrzucamy — droższy w utrzymaniu, gorszy offline.
- **Niuans „intent vs convergence":** CRDT gwarantuje zbieżność stanu, ale nie „intencji" w grafach.
  Dla **Process Flow / Mind Map** (krawędzie/bindingi) potrzebny rekordowy model (patrz `whiteboard.md` §3),
  żeby równoległe edycje strzałek nie produkowały „wiszących" krawędzi — to projekt schematu, nie sama biblioteka.

## 5. Model danych: Liveblocks Storage vs Yjs
- **Liveblocks Storage** — typowane struktury **`LiveObject` / `LiveList` / `LiveMap`**; granularny
  merge per-pole; idealne pod **strukturalny stan kanwy** (shapes, węzły, wiersze tabeli).
  Dla **długiego tekstu** Liveblocks rekomenduje swój **hostowany Yjs** (`Y.Text`).
- **Yjs** — typy współdzielone **`Y.Map` / `Y.Array` / `Y.Text` / `Y.XmlFragment`**; `Y.Text`/`XmlFragment`
  to złoty standard pod edytory rich-text (TipTap — łączy się z `canvas-overhaul.md`).
- **Mapowanie na nasze moduły:**
  - **Whiteboard** → rekordowy store (`LiveMap`/`Y.Map` per kształt) + `Y.Text` w notatkach.
  - **Process Flow / Mind Map** → `LiveMap` węzłów + `LiveList`/`Y.Array` krawędzi (bindingi jako rekordy).
  - **Table** → `LiveList<LiveObject>` wierszy (merge per-komórka, nie per-tabela).
  - **Canvas (czat split-view)** → `Y.XmlFragment` pod TipTap (rich-text współdzielony) + presence.
- **Anty-wzorzec:** monolityczny JSON całej kanwy (zabija granularny merge i undo — spójne z `whiteboard.md` §3/§5).

## 6. Trwałość / persistence
- **Liveblocks:** automatyczny persist Room + **webhooks** (`storageUpdated`) → możemy mirrorować
  do naszego Postgres jako SSOT/audyt; eksport REST. Backup „za darmo" po stronie vendora.
- **Yjs:** my odpowiadamy za persist — `y-leveldb` / `y-redis` / własny snapshot do Postgres;
  dokument = binarny update-log, który okresowo kompaktujemy do snapshotu.
- **Dla nas (kluczowe):** realtime-doc i **nasz Postgres SSOT to dwie różne rzeczy**. Zawsze
  utrzymywać autorytatywny snapshot w naszej DB (audyt, RBAC, eksport do Deliverables/EE),
  niezależnie od warstwy transportu. Realtime = warstwa edycji, DB = źródło prawdy.

## 7. Skalowanie i koszt
- **Liveblocks:** skaluje vendor; koszt rośnie z **MAU / równoległymi połączeniami / liczbą Rooms**.
  Uwaga na model rozliczeń przy „pokój per dokument" × wielu klientów (B2B multi-tenant) — policzyć MAU.
- **Yjs self-host:** koszt = infra WS (sticky sessions / `y-redis` pub-sub do skalowania poziomego)
  + storage + nasz ops/SRE. Tańsze w skali, droższe w czasie inżynierów.
- **tldraw sync:** zwykle Cloudflare Durable Objects (pokój = 1 DO) — świetne sprzężenie z tldraw,
  ale wiąże nas z modelem tldraw i Cloudflare.
- **Reguła kciuka:** do **GA i pierwszych klientów** koszt Liveblocks << koszt zbudowania i utrzymania
  własnej infry CRDT. Self-host opłaca się dopiero przy dużej skali / twardych wymogach data-residency.

## 8. Rekomendacja dla Consultify
**Faza 1 (GA / teraz): Liveblocks.**
- Najszybsza droga do produkcyjnego multiplayer; presence/awareness, Storage i hostowany Yjs out-of-the-box;
  webhooks → mirror do Postgres SSOT. Zgadza się z tym, że **Liveblocks już eksplorowaliśmy**.
- **Warunek izolacji vendor-locka:** budować na **Yjs-owym modelu danych** (przez Liveblocks-Yjs tam,
  gdzie tekst; `LiveObject/List/Map` tam, gdzie struktura) — tak, by ewentualne wyjście na self-host Yjs
  było migracją transportu, nie przepisaniem modelu.

**Faza 2 (skala / data-residency): Yjs self-host** jako ścieżka wyjścia, jeśli koszt MAU lub wymogi
enterprise tego zażądają. Ten sam model danych = niska bariera migracji.

**tldraw sync — warunkowo:** jeśli `whiteboard.md` rozstrzygnie na rzecz **integracji SDK tldraw**,
to tldraw sync jest naturalnym backendem realtime dla samego Whiteboard; wtedy reszta Ideas (Table,
Mind Map, Process Flow, Canvas-czat) i tak idzie na Liveblocks/Yjs → utrzymać **jedną warstwę presence**.

**Custom WS — odrzucamy** poza wąskimi efemerycznymi sygnałami (np. „typing" w czacie),
bo re-implementacja CRDT/persistence/presence to miesiące pracy bez przewagi.

## 9. Decyzje dla Consultify
- ✅ **Kradniemy:** rozdział **presence (efemeryczny) ↔ dokument (trwały)** — dwie warstwy, presence nigdy do DB.
- ✅ **Kradniemy:** **CRDT** jako mechanizm merge (Yjs / Liveblocks-Storage); OT odrzucamy.
- ✅ **Kradniemy:** **rekordowy model danych** (`LiveMap`/`Y.Map` per element), spójny z `whiteboard.md` §3.
- ✅ **Kradniemy:** **webhook → mirror do Postgres SSOT** jako wzorzec trwałości/audytu/eksportu (EE/Deliverables).
- ⚠️ **Adaptujemy:** Liveblocks na Fazę 1, ale **na modelu Yjs**, żeby migracja na self-host była tania.
- ⚠️ **Adaptujemy:** `Y.Text`/`Y.XmlFragment` pod TipTap dla Canvas-czatu (link do `canvas-overhaul.md`).
- ❌ **Unikamy:** monolitycznego JSON kanwy; OT; własnego serwera CRDT na Fazę 1.
- ❌ **Unikamy:** dwóch różnych warstw presence w różnych modułach Ideas (jedna, wspólna).

## 10. Otwarte pytania
- Liveblocks vs Yjs(self-host): policzyć **realny koszt MAU/connections** przy B2B multi-tenant (pokój per dokument × klienci).
- Jeśli Whiteboard → SDK tldraw: **tldraw sync czy Liveblocks** dla samego Whiteboard? (utrzymać jedną warstwę presence).
- **Granica pokoju (Room):** per-dokument czy per-projekt? (wpływa na koszt i model RBAC).
- Wspólny model bindingów dla całego Ideas (z `whiteboard.md` §6) — jak ujednolicić rekordy krawędzi pod CRDT.

## Załączniki
Surowe źródła (nierozpakowane w tym środowisku — macOS TCC):
`Softs/Multiplayer/Liveblock.zip` (~44,5 MB), `Softs/0 Miro/added/yjs..zip` (~9,2 MB),
`Softs/Multiplayer/Art 1..6` (katalogi z artykułami o CRDT/realtime).
Uwaga: archiwa do rozpakowania w środowisku z Full Disk Access; aktualne limity/cennik Liveblocks
i diagramy architektury dociągnąć online (liveblocks.io, docs.yjs.dev) przy implementacji.

# AUDYT IDEE — 4 narzędzia robocze (Mind Map · Tabela · Whiteboard · Process Flow)
**Data:** 2026-07-22 · **Baza:** świeży worktree z `origin/demo` (HEAD `fe5c86d279`) · **Metoda:** czytanie REALNEGO kodu (nie flag/doców), 4 robotników + adwersaryjna weryfikacja każdego znaleziska na plik:linia. **Bez** żywego renderu w przeglądarce (brak harnessu dla tych narzędzi — patrz „Czego nie zweryfikowano").

---

## WERDYKT (jedno zdanie)
**Silniki tych narzędzi są dojrzałe, a 3 canvasy (Mind Map/Whiteboard/Process Flow) mają realną kolaborację na żywo — ale sztandarowa droga „Teresa tworzy narzędzie z czatu" jest zepsuta przy pierwszym kontakcie dla tych trzech (regex w czacie połyka naturalną frazę → fałszywy komunikat sukcesu i NIC nie powstaje), a Tabela jest najsłabsza (jej bogaty silnik i cała jej kolaboracja są nieosiągalne — zablokowane flagą/zepsutym linkiem — zostaje uboga tabela-w-grafie).** Da się z nimi dziś pracować przy kliencie **tylko** gdy tworzysz ręcznie (nie komendą w czacie) i nie robisz jednoczesnej edycji w kilka osób na tej samej mapie.

---

## TABELA STANU — 4 narzędzia × 3 warstwy

| Narzędzie | SILNIK (tworzy/zapisuje/przeżywa reload) | TERESA (tworzenie z czatu) | KOLABORACJA (na żywo, komentarze) |
|---|---|---|---|
| **Mind Map** | 🟡 CZĘŚCIOWO — rdzeń zahartowany, ale wspólny autosave `/map/sync` ma cichy wyścig (utrata edycji przy 2 edytorach) | 🔴 CZĘŚCIOWO — dobra ścieżka serwerowa istnieje, ale regex czatu ją przechwytuje: „stwórz mapę myśli o X" = fałszywy sukces, nic nie powstaje | 🟢 GOTOWE — realny WebSocket, presence, kursory, komentarze, snapshoty |
| **Whiteboard** | 🟡 CZĘŚCIOWO — sticky/kształty/sesje persystują dobrze; ryzyko: obrazy na dysku efemerycznym (giną przy redeployu, o ile demo nie ma S3) | 🔴 CZĘŚCIOWO — jw., dodatkowo gubi treść żądania → pusta karteczka; a przy zamkniętej tablicy: fałszywy toast + zero efektu | 🟢 GOTOWE — wspólny kod z Mind Map |
| **Process Flow** | 🟢 GOTOWE — wspólny runtime (żaden split-brain), naprawione wyścigi | 🔴 CZĘŚCIOWO — jw. (wewnątrz otwartego kanwasu działa; z czatu globalnego = fałszywy sukces + nic) | 🟢 GOTOWE — wspólny kod; komentarze nie-realtime (ograniczenie całego produktu) |
| **Tabela (Ideas)** | 🔴 CZĘŚCIOWO — realnie aktywny silnik to uboga „tabela-w-grafie" (JSON), a bogaty relacyjny silnik (23 tys. linii) jest ZABLOKOWANY flagą bez możliwości włączenia | 🔴 CZĘŚCIOWO — brak prostego „stwórz tabelę X"; jedyna droga (Canvas → „Send to Table Studio") zwraca **klikalny link prowadzący na 404** | 🔴 NIE — dla realnego użytkownika 0%: realtime/komentarze istnieją tylko za zablokowaną flagą; osiągalna trasa `/tabele` nie ma ich wcale |

Legenda: 🟢 gotowe · 🟡 częściowo (użyteczne z zastrzeżeniem) · 🔴 częściowo/nie (blokuje kluczowy scenariusz)

---

## ★ CO BOLI NAJMOCNIEJ (uszeregowane wg kosztu dla konsultanta PRZY KLIENCIE, nie wg kosztu naprawy)

**1. „Teresa, zrób mapę myśli / proces / tablicę o X" → fałszywy sukces i NIC nie powstaje.** (MM/WB/PF)
To pierwszy odruch każdego, kto testuje demo. Regex w czacie (`UnifiedChatPanel` linie 3122/3153/3244) łapie tę frazę ZANIM trafi do modelu, pokazuje „Working on…/Running…", robi `return` — i albo nic (bo słuchacz akcji istnieje tylko przy otwartym narzędziu), albo pustą karteczkę (Whiteboard gubi treść). **Dobrze zbudowana ścieżka serwerowa `generate_deliverable` istnieje i jest sensowna — ale ten regex nie daje jej się uruchomić.** Koszt: **najwyższy** — psuje zaufanie do Teresy dokładnie w pierwszej sekundzie. *(Wyjątek: Tabela — jej intercept otwiera działający modal.)*
> Dowód: `src/components/AIChat/UnifiedChatPanel.tsx:3122,3153,3244`; `mindmapIntentDetector.ts:37`; `useMindMapQuickActions.ts:323`; `whiteboardIntentDetector.ts:21` + `useWhiteboardQuickActions.ts:142`.

**2. Tabela: cała kolaboracja i cały bogaty silnik są dziś dla klienta niewidoczne.** (Tabela)
Relacyjny silnik (tp_tables) + realtime + komentarze są schowane za flagą `tablePlatformMetadataFirst`, która ma `default OFF`, `zakaz nadpisania` i jest aktywnie kasowana z pamięci przeglądarki — **nie da się jej włączyć**. Osiągalna trasa `/tabele` nie ma realtime ani komentarzy w ogóle. Zostaje uboga „tabela w grafie".
> Dowód: `src/hooks/useFeatureFlags.tsx:142-144,264`; `IdeaTableTool.tsx:266`; brak callera w `server/src` (grep=0).

**3. Obrazy na tablicy mogą znikać przy każdym wdrożeniu.** (Whiteboard) — *zależne od żywego env*
Mechanizm trwałego storage (S3/R2) jest w kodzie gotowy, ale domyślnie system pisze na lokalny dysk Railway (`STORAGE_PROVIDER='local'`), który jest kasowany przy redeployu. W lokalnym configu flaga jest nieustawiona. Jeśli na Railway demo też — obrazy warsztatowe giną.
> Dowód: `server/src/services/storage/index.ts:53`; `whiteboard-uploads.routes.ts:72`. **Wymaga sprawdzenia jednej zmiennej na Railway.**

**4. Cichy wyścig zapisu = utrata edycji przy współpracy.** (MM/WB/PF — wspólny endpoint)
Autosave map (`POST /map/sync`) sprawdza wersję osobnym zapytaniem PRZED zapisem, ale sam zapis NIE ma atomowego zamka wersji (siostrzany `PUT /map` 100 linii dalej robi to poprawnie). Tryb współdzielony jest domyślnie włączony → dwóch edytorów tej samej mapy: obaj przejdą kontrolę, obaj zapiszą, pierwszy ginie **cicho, bez ostrzeżenia**.
> Dowód: `server/src/routes/my-work.routes.ts:4590` (kontrola) + `:4718-4738` (zapis bez `AND version=?`, komentarz wprost to przyznaje) vs poprawny `:4405-4433`.

**5. „Send to Table Studio" tworzy dane i gubi je w linku 404.** (Tabela)
Teresa realnie zapisuje wiersz tabeli, po czym daje w czacie klikalne „Open →" prowadzące na nieistniejącą trasę `/table-studio` (jest tylko `/tabele`). Jednowierszowa literówka gubi dopiero co wygenerowaną pracę.
> Dowód: `server/src/routes/work-canvas.routes.ts:4465,4478` vs `src/routes/routeConfig.ts:41` (`TABELE:'/tabele'`), brak trasy `/table-studio`.

---

## CO JEST NAPRAWDĘ DOBRE (żeby nie naprawiać tego, co działa)
- **Generatory treści Teresy** (`canvasGraphLlm.ts`, 1327 lin) — strukturalny output, **guardrail anty-halucynacja** (Process Flow: „odwzoruj DOKŁADNIE kroki z prośby, nie dorabiaj"), fail-soft do szkieletu, serwerowe utworzenie prawdziwego wiersza. To NIE jest kaszanka ani fantom — problem jest w dostępie (pkt 1), nie w treści.
- **Persist canvasów** — realnie zahartowany na wyścig-po-reloadzie, anti-wipe, kolejkę offline, keepalive na zamknięciu karty (ślady realnych napraw produkcyjnych).
- **Kolaboracja 3 canvasów** — realny WebSocket `/ws/collab/:ideaId`: presence, kursory, komentarze, snapshoty, blokada org-scope. Nie szkielet.

---

## DO DECYZJI PIOTRA (nie defekty — wybory)
1. **Storage na Railway demo:** czy `STORAGE_PROVIDER=s3` jest ustawione? Jeśli nie — obrazy Whiteboard trzeba naprawić przed pokazem klientowi (pkt 3).
2. **Dwie Tabele:** `IdeaTableTool` (w Ideas) vs `TabeleView` (`/tabele`). Która jest kanoniczna? Konsolidacja czy świadome dwie ścieżki?
3. **Flaga `tablePlatformMetadataFirst`:** zaparkowana świadomie (WIP na później) czy przypadkiem osierocona? Od tego zależy, czy Tabela dostaje bogaty silnik, czy zostaje uboga.
4. **Blokada „obserwatora" (read-only) z sesji Whiteboard** jest stosowana też do zapisu Mind Mapy — zamierzone (jeden dokument) czy uboczne?
5. **Wyciek węzłów między narzędziami:** filtr kolaboracji jest po `ideaId`, nie po narzędziu — dwie osoby w różnych narzędziach na tej samej idei mogą sobie „wstrzyknąć" obcy typ węzła. Rzadkie; naprawić czy zignorować?

---

## CZEGO NIE ZWERYFIKOWANO (uczciwie, z ograniczeniami)
- **Żywe env Railway demo** — wartości `STORAGE_PROVIDER`, `ENABLE_TERESA_MINDMAP`, `ENABLE_SHARED_IDEA_MAPS` czytałem z kodu (defaulty) i z lokalnego `.env.staging.local`, **nie** z dashboardu Railway. Kilka werdyktów (storage, retrieval map, wyścig w trybie współdzielonym) zależy od tych wartości na produkcji.
- **Żywa baza** — nie potwierdziłem odpytaniem: migracji `is_canonical`, kolumny `tp_records.version` (od niej zależy ochrona przed nadpisaniem), ani wiersza w DB-owym `feature_flags` (teoretyczne obejście blokady flagi Tabeli).
- **Realny render w przeglądarce** — dla tych narzędzi NIE istnieje harness dev-render; nie uruchamiałem pełnej apki staging. Cały audyt to analiza statyczna kodu (bardzo pewna dla logiki, ale nie widziałem pikseli ani realnego outputu LLM).
- **Jakość żywego outputu Teresy** — prompty są dobre, ale nie odpaliłem generacji na żywo (czy treść jest trafna dla klienta).
- **Eksporty** (PPTX/PDF/DOCX), health-score'y i walidatory procesu — nie prześledzone end-to-end (mogą być częściowo fasadowe).
- Wyścig zapisu (pkt 4) potwierdzony **analizą kodu**, nie odtworzony pod obciążeniem.

---

## REKOMENDOWANA KOLEJNOŚĆ NAPRAWY (Faza 3 — wg kosztu dla klienta)
1. **Odblokować drogę „Teresa tworzy z czatu"** (pkt 1) — zawęzić regex-interceptory tak, by frazy „stwórz/utwórz [nowe]" szły do LLM (`generate_deliverable`), a interceptory obsługiwały tylko edycję wewnątrz otwartego narzędzia. Największy zysk, umiarkowany koszt.
2. **Potwierdzić/naprawić storage obrazów** (pkt 3) — najpierw jedna komenda sprawdzająca Railway; jeśli `local` → włączyć S3/R2.
3. **Naprawić link „Send to Table Studio"** (pkt 5) — literówka `/table-studio` → `/tabele?artifactId=`.
4. **Zamknąć wyścig `/map/sync`** (pkt 4) — dodać atomowy `AND version=?` jak w siostrzanym `PUT /map`.
5. **Decyzja o Tabeli** (pkt 2) — po rozstrzygnięciu „dwie Tabele + flaga" (DO DECYZJI 2-3).

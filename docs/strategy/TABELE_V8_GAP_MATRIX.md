# Tabele v8 - Gap Matrix

> Status: Draft v8
> Cel: Zmapowac `as-is -> v8 target` dla platformy tabel i przelozyc luki na priorytety wdrozeniowe.

---

## 1. Jak czytac te mape

`As-is` opisuje to, co rzeczywiscie istnieje dzisiaj.
`V8 target` opisuje stan docelowy.
`Gap` to nie brak kodu per se, ale brak domknietego produktu.

---

## 2. Gap matrix

| Obszar | As-is | V8 target | Gap | Priorytet | Zaleznosci | Ryzyko |
|---|---|---|---|---|---|---|
| Base shell | Backend ma `base`, ale glowny UX nie jest jawnie zorganizowany wokol `multi-table base` | `base` jest pierwszoplanowym kontenerem z jasnym switching/sharing/governance | Brak kanonicznego multi-table operating shell | P0 | bridge/integration, FE navigation | Produkt pozostanie zbiorem capability zamiast platforma |
| Canonical persistence | Metadata-first backend istnieje, ale rollout jest nadal izolowany | Metadata-first jest jednoznacznie kanoniczny, projection = compatibility layer | Nadal za slaba czytelnosc granicy canonical vs projection | P0 | migration, flags, docs | Rozjazd danych i decyzji architektonicznych |
| Schema management | Szeroki field system i config istnieja | Schema management jest jednym, przewidywalnym centrum modelu danych | Brak domknietego canonical workflow dla zmian schema | P0 | FieldManager, services, AI review | Niespojne mutacje i slabnace zaufanie |
| Field governance | Typy pol i computed semantics istnieja | Typ, config i konsekwencje zmian sa transparentne i governowane | Za malo twardych zasad governance i destructive-change UX | P0 | audit, review UX | Regresje i uszkodzenia modelu danych |
| Records core | CRUD, batch, bulk, expand, comments, watchers sa obecne | Records flow jest pilot-grade i konsekwentny we wszystkich surfaces | Miejscami bogactwo funkcji nie tworzy jednej glownej sciezki pracy | P1 | records API, FE consolidation | Trudny onboarding i niepewne wsparcie |
| Views model | Wiele view types istnieje | Saved views sa first-class i spojne z query/presentation semantics | Potrzeba silniejszego rozroznienia core views vs advanced surfaces | P1 | query engine, FE IA | Rozrost funkcji bez spojnego modelu |
| Footers/status cues | `StatusBar` istnieje | Operacyjne sygnaly gridu sa stalym elementem core experience | Nie jest jeszcze oczywiste, co jest kanonicznym standardem grid discipline | P2 | FE polish | Mniejsza czytelnosc pracy operacyjnej |
| Relations | Linked records, lookup, rollup sa obecne | Relacje staja sie czytelna semantyka miedzy tabelami i workflows | Potrzebna mocniejsza definicja reverse semantics i UX contract | P0 | backend relations, FE record expand | Pol-relacje beda zbyt eksperckie |
| Dependencies | Date dependencies i cycle detection sa obecne | Zaleznosci procesowe sa backendowo trwale i pilot-ready | Trzeba domknac, co jest trwala semantyka, a co tylko affordance view | P1 | DateDependencyConfig, persistence | Pozorna funkcja bez zaufania procesowego |
| Forms | Forms istnieja w API i UI | Forms sa first-class warstwa intake z pelnym osadzeniem w workflow | Trzeba mocniej osadzic forms w main product story | P1 | FormService, FE routing | Forms pozostana funkcja poboczna |
| Record templates | Istnieje `RowTemplatePicker` i `TemplateGallery` | Templates sa oficjalna warstwa szybkiego startu i inputu | Brak formalnego modelu productowego dla templates | P1 | FE + docs + starter assets | Dublowanie wzorcow i niespojnosc |
| Interfaces | Interface surfaces istnieja | Interfaces sa pelnoprawna curated warstwa na tych samych danych | Brak jasnej granicy views vs interfaces i ich roli w produkcie | P1 | InterfaceService, FE information architecture | Builder bez czytelnego celu |
| Automation | Services i UI istnieja | Automations sa governowane i rollout-safe | Potrzebna wyrazna kolejnosc: core first, automation second | P1 | automation services, audit | Zbyt szybkie rozszerzenie scope |
| Distribution/sharing | Sharing i publishing-adjacent capabilities istnieja czesciowo | Distribution ma jawny model odbiorcow, channels i scope | Brak skonsolidowanego modelu dystrybucji nad tabela | P2 | sharing, interface, notifications | Fragmentacja funkcji |
| Imports | CSV/XLSX/Google Sheets sa obecne | Import to kontrollowany onboarding data flow | Brakuje spojnego import-first workflow i safety language | P1 | import services, AI mapping | Slabsza jakosc pierwszych danych |
| AI schema flow | Proposal/execute/reject/refine/undo/redo istnieja | AI schema building jest glowna przewaga produktu i ma twarde governance | Brak formalnego SSOT AI contract i completeness gates | P0 | AI docs, FE review UX, audit | Brak zaufania i wysokie ryzyko produktowe |
| AI beyond schema | Fundament istnieje, ale story jest glownie wokol schema | AI wspiera tez views, interfaces, demo data, automations | Brak usystematyzowanego modelu rozszerzen AI | P2 | AI governance, staged rollout | Rozlanie scope bez priorytetow |
| Migration | Migrations i rollback istnieja | Legacy -> metadata-first ma przewidywalna, mierzalna sciezke pilotu | Potrzeba ostrzejszego operational rollout planu i readiness gates | P0 | migration service, feature flags | Rozjazd miedzy pilotem a realnym uzyciem |
| Docs truth model | Istnieje kilka strategii, auditow i status docs | Jedno SSOT `v8` porzadkuje calosc | Historyczne dokumenty rozmywaja obraz aktualnego stanu | P0 | docs package | Mylne decyzje na bazie nieaktualnych zalozen |
| App table vs platform | Granica istnieje implicite | Granica jest twardo nazwana i stosowana produktowo | Dzis latwo mieszac obie kategorie | P0 | SSOT, UI standards | Zle decyzje projektowe i UX debt |

---

## 3. Priorytety v8

### P0 - bez tego `v8` nie jest domkniete

- multi-table base shell i canonical metadata-first story,
- twarda granica canonical persistence vs projection,
- schema governance,
- relation semantics,
- AI governance,
- migration and rollout readiness,
- porzadek dokumentacyjny `SSOT`.

### P1 - warstwy, ktore maja wejsc zaraz po core

- records workflow consolidation,
- views/product hierarchy,
- forms,
- record templates,
- interfaces,
- automations,
- import-first onboarding,
- date dependencies productization.

### P2 - rozszerzenia po ustabilizowaniu core

- distribution model,
- deeper AI beyond schema,
- broader publishing/composite surfaces,
- polish w obszarze footers/status cues.

---

## 4. Strategic interpretation

Najwieksza luka `as-is -> v8` nie polega na "braku wielu funkcji".
Najwieksza luka polega na tym, ze:
- system juz ma bardzo wiele funkcji,
- ale nie ma jeszcze wystarczajaco ostrego `kanonicznego modelu produktu`,
- ktory mowi, co jest core, co jest projection, co jest rollout-safe i jak wyglada pelna sciezka pracy.

To oznacza, ze `v8` jest przede wszystkim:
- programem domkniecia produktu,
- programem truth alignment,
- a dopiero w drugiej kolejnosci programem dopisywania nowych capability.

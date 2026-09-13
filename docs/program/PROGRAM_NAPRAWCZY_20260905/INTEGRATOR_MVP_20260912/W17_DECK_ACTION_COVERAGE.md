# W17 Deck — mianownik akcji i pokrycie, 2026-09-12

Read-only inventory root WT `codex-integrator-mvp-20260912` na podstawie W17_EXECUTION_PACKET.md oraz aktualnych DeckBuilder, obu powłok, toolbar/canvas/sorter, commandregistry, media/share/history/review i testów. Bez nowych runtime, zapisów, testów czy implementacji. **Nie jest to pełny odbiór prezentacji.** Identyfikatory `ppt.*` z registry zachowano; `audit.*` poniżej są lokalnymi kluczami tej tabeli, nie nowym rejestrem produktu.

Mianownik ma dwie warstwy: wszystkie operacje w źródłowej powierzchni i osobne wystąpienia menu/toolbar/context/keyboard/AI dla tej samej operacji. Wiersze z listą wariantów wymagają osobnego wyniku KAŻDEGO wariantu, nie jednego zbiorczego PASS. Dynamiczne media, kolory, typybloków, layouty i komendy wymagają utrwalenia dostępnych opcji dla faktycznego SHA/role/flags przed klikaniem. Ten audyt nie udaje, że nierozwinięte menu zostało obejrzane w runtime. Ukryty classic nie jest zamiennikiem aktualnego MELS/ArtifactStudio; N/A wymaga podstawy w rzeczywistej konfiguracji i decyzji, nie braku testu.

## Statusy dowodu

- `R-RED`: własny rzeczywisty rootbuilt5290+C8API4218+PG6459 dowód z W17_DECK_RUNTIME_REOPEN.md;0edycji,2PUT200,version1→2→3,history0→1→2. Osiągalny OWNER/MELS,1440light, otwarcie ze sztucznego APIdecka. APIcreate201 to dowód writera, **nie kliknięcia CreateUI**.
- `C-RED`: root W17_DECK_CURRENT_BRIDGE.log,5wykonanych/5FAIL; adaptowany prawdziwy komponent, transportmock. Szczegóły W17_DECK_BASELINE_REVIEW.md. Odczytany test hooka nie obala tego wyniku integracji.
- `T`: istniejący test źródłowy nadający się do reużycia, **bieżący wynik NOT_PROVEN**; nie uruchamiano w tym audycie. Nazwa .pg/.signed/.e2e nie jest gwarancją poziomu dowodu.
- `N`: behavior i runtime NOT_PROVEN w zebranym pakiecie; źródło pokazuje kontrolkę/handler, nie PASS.

Testy krótkie w tabelach odnoszą się do katalogu `src/components/Presentations/DeckBuilder/__tests__/`, chyba że wpis ma prefiks `tests/` lub `server/`.

## A. Wejście, trwałość, konflikt i historia

| Action ID | Wyzwalacz / source | Kontrakt | Dowód / brak |
|---|---|---|---|
| audit.deck.create.api | existing POST presentations/decks | własnytenant, canonicaldeck+cards, stabilnyid | real201 R; UIcreate N |
| audit.deck.open / audit.deck.reload | Materials/deeplink; DeckBuilder684–836 | canonicalGET, zero zapisów bezedytu, brak utratytreści | R-RED; renderczytelny i dostęp OWNER potwierdzone |
| audit.deck.load.retry / audit.deck.back | error view Retry/Back;1536–37 oraz topbar | retrybezduplikatu; Back wraca do właściwej biblioteki | N |
| audit.deck.title.edit | tytuł topbara;1033,1609 | zapis tytułu tej samej talii i listy po reload | C-RED zatrzymanyprzed pełnymflow; runtimeN |
| audit.deck.autosave | dowolna rzeczywista edycja;843–937 |1writer, właściwyCAS, bez no-opwrite, zachowanie queuedundo | R-RED reopen; C-RED inflight; T useDeckAutosave.test.ts |
| audit.deck.save.reject403 / reject500 / network | fault podczasedycji | jawne unsaved, brakfałszywegoSaved, następnaedycjaretry | T useDeckAutosave/useVersionHistory; runtimeN |
| audit.deck.conflict.reload / keepMine | ConflictBanner; resolveConflictReload/KeepMine | reloadadoptujealready-persisted bezPUT; keep jawnie zachowujeedycjęznowymCAS | T tests/components/Presentations/ConflictBanner.p3.1.test.tsx (callback); runtimeN |
| audit.deck.history.open / close / retry | headerMore,rail,VersionHistoryPanel | ta sama durablehistoria; niedostępna≠pusta | T VersionHistoryPanel/useVersionHistory; runtimeN |
| audit.deck.history.checkpoint | Savecheckpoint | ephemeral checkpoint odróżniony od durable save | T useVersionHistory; runtimeN |
| audit.deck.history.restore.server | wersja→Restore | serverPOST+canonicalGET, tokenaktualny,0ponownychPUT | C-RED; T useVersionHistory; runtimeN |
| audit.deck.history.restore.session | sessioncheckpoint→Restore | lokalna zmiana musi być zapisana, nie baseline-server | T useVersionHistory; runtimeN |
| audit.deck.navigation.unsaved / switchDeck | Back/routechange/unload podczaswrite | ostrzeżenie, staryACK nie zmienia nowegodecka | T useDeckAutosave epoch; pełnynavigationN |

## B. Dokładne 11 komend registry + osobne wejścia

Źródło `presentationArtifactCommands.ts`; command predicates obejmują artifact.edit, draft/in_review, brakconflict, selection. `implementation:available`, alias keyboard/context-menu i undoPolicy są deklaracjami źródła. Każdy wiersz ma T `presentationArtifactCommands.test.ts` (visibility/permission/callback); to nie readback.

| Action ID | Wyzwalacz / dodatkowycaller | Kontrakt | Dowód |
|---|---|---|---|
| ppt.edit.undo | commandbar,toolbar,keyboard | odwróć faktyczną operację; deklarowanylimit3 bezcichejutraty | T tests/components/Presentations/DeckBuilder.test.tsx; C-RED inflight; runtimeN |
| ppt.edit.redo | commandbar,toolbar,keyboard | ponów ostatniundo, ten samid/kolejność | T DeckBuilder.test.tsx; runtimeN |
| ppt.slide.addAfter | toolbar,Blankslide,sorter gap,paletteadd_card | poaktywnym, noweid, klik-event nie staje sięindex | T manualEditing + SlideSorter.visualContract; runtimeN |
| ppt.insert.text | toolbar,blockpanel,paletteadd_text | edytowalnyblok naaktywnymslajdzie, unikalnyid | T manualEditing; runtimeN |
| ppt.insert.image | toolbar,mediapanel,paletteadd_image | prawdziwy obraz naaktywnymslajdzie, prawidłowescope | T BlockToolbar.p2.2 callback; runtimeN |
| ppt.design.theme.open | toolbar,topbar,rail,palettechange_theme | dostępniezależnyodselekcji; otwarcie≠zapiswyboru | T registry; runtimeN |
| ppt.slide.duplicate | toolbar,sortermenu | noweIDslajdu/bloków, pozostałeIDzachowane | T DeckBuilder.test.tsx; runtimeN |
| ppt.slide.lock.toggle | toolbar,sorter lock/menu | lockpersisted, zablokowanyslajd chroniony zgodnieAI/manualcontract | T registry; runtimeN |
| ppt.slide.delete | toolbar,sortermenu | tylkoaktywny; nie usuwajostatniego wbrewguard;undo | T registry + DeckBuilder.test.tsx; runtimeN |
| ppt.block.duplicate | context/toolbar | noweid, właściwecard_id/region/order, originalbezmutacji | T blockOps; runtimeN |
| ppt.block.delete | context/toolbar | tylkozaznaczonyblok; undo, inneblokibezstrat | T blockOps; runtimeN |

## C. Manual canvas, warianty i selekcja

| Action ID (warianty liczone osobno) | Wyzwalacz / source | Kontrakt | Dowód |
|---|---|---|---|
| audit.slide.select / view.cards / view.list | SlideSorter | właściwyaktywnyID i dostępny tytuł; zmiana widoku nie zapisuje danych | T SlideSorter.visualContract; runtimeN |
| audit.slide.reorder | dragSort | kolejnośćpersisted, IDsniezmienne | T DeckBuilder.test.tsx pure; runtimeN |
| audit.block.select / additiveSelect / deselect | CardCanvas/CardRenderer | selekcjabloku nie chowa narzędzislajdu, owningcardzgodne | T manualMultiselect + registry; runtimeN |
| audit.block.text.edit / typography | EditableBlock/TipTap/BlockToolbar | treść+font/size/weight/style/color/alignment/list zapisane i renderowane | T PowerPointManualLayoutTypography + manualEditing; runtimeN |
| audit.block.position / resize / rotate / layer / region | freeformhandles i panelwłaściwości | zakresgeometrybezwyjściapoza slajd; render/save/exportzgodne | T geometryOps/manualEditing/CardRenderer.freeformHandles; runtimeN |
| audit.block.group / ungroup | multiselecttoolbar | grupa spójna, undoatomiczne | T geometryOps/manualMultiselect; runtimeN |
| audit.block.align.{left,center,right,top,middle,bottom} | multiselecttoolbar | tylkozaznaczonebloki, każdywariant osobno | T geometryOps; runtimeN |
| audit.block.distribute.{horizontal,vertical} | multiselecttoolbar | równyodstęp w osi, inneblokinietknięte | T geometryOps; runtimeN |
| audit.block.move.{previous,next} | blockcontext | tylko w regionie, granicanoop | T blockOps; runtimeN |
| audit.slide.layout.{auto,content_full,content_left_right,content_right_image,content_top_bottom,content_overlay} | CardFloatingToolbar | wspieranelayouty, treśćniewypada po zmianie i reload | T CardCanvas.notes+PowerPointManualLayoutTypography; runtimeN |
| audit.slide.background.{theme,color,gradient,image} | CardFloatingToolbar | rzeczywistyzapiswyboru+koloru/obrazu, źródłoobrazudostępne | T typography częśćcallback; runtimeN |
| audit.slide.contentDistribution / animations.toggle | CardFloatingToolbar | cykldystrybucji i animacje; export/presentkontraktjawny | T typography; runtimeN |
| audit.notes.toggle / edit | bottombar+CardCanvas | zmiana speaker notespersisted, nie mylićztreściąslajdu | T CardCanvas.notes; runtimeN |
| audit.block.metricStrip.edit | BlockToolbar | label,value,unit,trend/change bezutraty0/brakdanych | T metricStripEditor; runtimeN |
| audit.block.chart.edit / table.edit / diagram.edit | wyspecjalizowanebloki+toolbar | liczby/wiersze/relacjezgodne zmodelem i exportem | T ChartBlock.p23/metricStrip; pełnevariantyN |
| audit.block.insert.{heading,paragraph,bullet_list,table,chart,image,kpi_widget,smart_diagram} | CommandPalette literal IDs add_heading/add_text/add_bullets/add_table/add_chart/add_image/add_kpi/add_diagram | działająca treśćstartowa, unikaneID, edycja/reload | T manualEditing seed; runtimeN |
| audit.blockpanel.{search,basic,images,layouts,diagrams,charts} | BlockToolbar panels | otwieranie/zamykanie i dostępneelementy; każdy wariant typu/układu/wykresu osobo | T BlockToolbar.p2.2 częściowo; pełny dynamicznypodmianownikN |
| audit.slide.search / jump | BlockToolbarsearch | właściwyslajd z wyników, bezmutacji | N |

## D. Media, AI i dane

| Action ID | Wyzwalacz / source | Kontrakt | Dowód |
|---|---|---|---|
| audit.media.open / search / filter / select / close | MediaLibraryBrowser,Imagespanel | assetswłasnejorg, selekcja wstawia jeden poprawnyobraz | T toolbarcallback; runtimeN |
| audit.media.upload | Upload→fileinput | realfile,limity/format, orgboundary, readback/reload | T toolbarcallback; runtimeN |
| audit.ai.image.generate | ImagesAI Generate; handleGenerateAiImage1360 | rzeczywistywynik z istniejącego rewrite, pending/error, bezfikcyjnegoobrazka | T BlockToolbar.p2.2; runtimeN |
| audit.ai.teresa.open / submit | globalchat+registeredmoduleintent1303 | jedno okno, poprawnydeckscope, pytanienieedycyjne oddanechatowi | T adaptedC-RED reachesaccept; wholechat runtimeN |
| audit.ai.deck.propose / accept / reject | agentproposalbanner | przedaccept0mutacji; rejectbezwrite; acceptjedenpersistedstan+CAS | C-RED accept; rejectruntimeN |
| audit.ai.slide.regenerate / rewrite | CardCanvasRegenerateslide/Rewrite prompt | tylkoaktywnyslajd, stabilnycard_id, siblingsnietknięte, undo | T tests/components/Presentations/DeckRewriteR4.test.tsx; runtimeN |
| audit.ai.quick.{improve_writing,fix_spelling,translate,make_longer,make_shorter,simplify,more_visual,add_image,add_chart,swap_org_photo,update_data,change_chart_type,try_new_layout} | EditCardPopup quickaction IDs | każdy13osobno, właściwyscope i efekt zgodnyznapisem; odróżnić proposal od bezpośredniego rewrite | UNMOUNTED_SOURCE: brak importu/callera EditCardPopup w aktualnym DeckBuilder subtree; nie zaliczać13 opcji jako widocznych przycisków ani rozszerzać MVP o ich przywrócenie |
| audit.data.refresh.block / card / all | useDataRefresh,Refreshcontrols | tylkooutdatedsource;0≠missing,provenance i selekcjapersisted | N |
| audit.sources.open / relation.open / jump | SourceTraceability,DeckRelationsPanel,Evidence | faktyczneźródłotegodecka, uprawnienia, bezpożyczonych danych | N |
| audit.activity.open / refresh | AgentActivityPanel/runtimeevents | realreceipt/degraded, brakudawanychwykonań | N |

## E. Review, QA, historyczne dane i udostępnienie

| Action ID | Wyzwalacz / source | Kontrakt | Dowód |
|---|---|---|---|
| audit.review.open / submit / approve / requestChanges | QAleftmode,PresentationReviewPanel,ArtifactApprovalStatusBar | assignedreviewer, powód, status+reload; autorniemożeudawaćrecenzenta | T PresentationReviewPanel.test.tsx + tests/e2e/presentations/artifact-studio-approval-realdb.spec.ts; wynikN |
| audit.qa.open / close / retry / jumpToCard / expandWarnings | DeckQualityGatesPanel+qualitybanner | prawdziweqa/warnings, żadnejfikcyjnejoceny; skokdoprawidłowejkarty | T MELS QA/governancemerge; runtimeN |
| audit.governance.open / close / refresh | DeckGovernanceCardModal | verdictodserwera, aktualnytenantscope | N |
| audit.audit.open / close / filter | DeckAuditLogModal | zdarzeniategoobiektu, błędyjawne | N |
| audit.comments.open / refresh / filter.{all,open,resolved} / jumpSlide | DeckCommentsPanel | statusfiltr,prawidłowykontekst i brakfałszywejpustki | T deckCommentsApi envelopes; runtimeN |
| audit.comments.create / reply / resolve / reopen / delete | DeckCommentsPanel | trwałość,role,thread i licznik, reload | T deckCommentsApi mutations; runtimeN |
| audit.share.open / close / tab.{collaborate,share,export,embed} | ShareModal | każdy faktycznie widocznytab oddzielnie; etykiety aktualnegoUIzinventory | T ShareModal.invite.p3.1; runtimeN |
| audit.share.invite / permission.{view,edit} | email+role+Invite | nieważnyemail odmowa, rzeczywisteudostępnienie≠obietnicawysłaniaemail | T ShareModal.invite.p3.1; runtimeN |
| audit.share.link.enable / disable / copy / rotate / generate | ShareModal | jawnaintencja, tokensekret, starylinkpo revoke/rotatenieważny | T ShareModal.invite.p3.1 + route share-revoke/public-viewer; runtimeN |
| audit.share.embed.copy | Shareembed | poprawnykod, uprawnienia i revokedlinkhonorowane | N |
| audit.share.analytics.open / close | ShareAnalyticsPanel | faktycznezdarzenia, empty/degradedbezfabrykacji | N |

## F. Present, eksport i pełny odbiór pliku

| Action ID | Wyzwalacz / source | Kontrakt | Dowód |
|---|---|---|---|
| audit.present.current / beginning / presenter | MELSsplitbutton,TopBar,palette | właściwyindexstart, audience vs notes/timer/nextslide | T DeckBuilderMelsView.artifactStudio + PresentMode; runtimeN |
| audit.present.next / previous / exit | PresentModecontrols+keyboard | granice slajdów, ESC, notes nie wyciekają do widza; timer jest odczytem, nie osobną akcją | T PresentMode; runtimeN |
| audit.export.pdf / pptx / png | Shareexportbuttons→handleExport1121 | klikwybranegoformatu→legalgate→plik→otwarcie/render; kompletność i aktualnawersja | T server presentationDeckLifecycle.pg/PptxDownloadCurrentExport + tests/e2e/presentations-export-contract.spec.ts; realfileN |
| audit.export.blocked / retry | gate/lifecycle/quality/trial/403 | odmowaprawdziwa, bezfałszywegodownloadsuccess, retrybezduplikacji | T export-gate/export-approval routes; runtimeN |
| audit.palette.open / search / run / close | CommandPalettekeyboard | każdyzarejestrowanycommandmapowanydohandlera; focus/ESC, bezdrugiejTeresy | T registrycallback; fullpaletteN |
| audit.shell.railToggle / sectionExpand / leftTab / compactOpen | MELS/ArtifactStudio/classic | wszystkie widocznekontrolki osiągalne, canvasnieucięty, focuszachowany | T responsive + MELSshell; realtylkoopenlight1440 |

## Trudne scenariusze do odbioru pełnej prezentacji

1. **Ręczna talia zarządcza:** minimum8różnychslajdów, tabela/wykres/KPI0orazbrakwartości, zdjęcie/link, długietytuły/UTF8, notes. Insert/duplicate/delete/reorder, multiselectgroup/align/distribute, freeformresize i typography. Każdyaliasmenu/context/keyboard osobno; reloadID/content/geometry; druga karta powoduje409, keep/reloadbezutraty. Readonlyreopen0write musi być naprawiony przedgreen.
2. **AI ze sprzecznymi źródłami:** dwalockedslajdy, wybranajednakarta, dwaźródłazróżnymiliczbami. Propozycjaodrzucona→poprawiona→accept; proof0mutationprzedaccept, siblings/lockedunchanged, zachowanyrodowód, świadome brakdanych. Timeout/retry i równoległa ręcznaedycja nie mogą nadpisać zmian. Regenerate slide rozliczyć osobno; quickactions tylko jeżeli istnieje osiągalny caller. Nie uznawać przycisku AI Generate za gotowy obraz.
3. **Recenzja→odbiorca→plik:** autor, assignedreviewer, viewer i obcytenant. Submit→requestchangespowód→poprawa→approve→reload; legalnyPDF/PPTX/PNG z TEJ wersji. Otworzyćkażdyplik, obejrzećwszystkieslajdy, porównaćliczby/układ/czcionki/notes iźródła. Shareview/edit, revoke/rotate, stale/anonymouslinknegatywne. Odbiór zewnętrznegoemailu wymagaosobnejautoryzacji; lokalnytest nie wysyła wiadomości.

Przekrojowo: pendingwrite→undo→ACKkolejność; restore→edit→CAS; agentaccept→edit; historyfailure≠empty; offline/403/500; deckswitch/unmount; emptydeck/ostatnislajd; długiebloki/overflow; light/dark1440orazcompact1280; read/editpermissions i persistedorg. Niedostępneprzezlegalgate scenariusze oznaczyć BLOCKED zkonkretnąprzyczyną, bezflagoverride.

## Bramka zakończenia W17

Nie podajemy procentu pokrycia z liczby plikówtestowych. Na dziś: reopen/autosave **realRED**, restore/accept/inflight **componentRED**, reszta funkcjonalnego mianownika **NOT_PROVEN na bieżącym kandydacie** mimo istniejących testów. Pełny receipt ma zawierać exactSHA, rola/flags, actionID+konkretnykontroler, precondition, klik, wynik, API/PGreadback+reload albohash/renderpliku, negatyw, PNG i verdict. Sourcegrep, mockedcallback, sam status200 i screenshotsbezwykonanejoperacji nie zastępują tego łańcucha.

Pozostała luka mianownika jest jawna: dynamiczne listy opcji i każde podmenu/helperchild wymagają rzeczywistego inventory kontrolki w danym środowisku. Ten dokument jest pełną mapą rodzin i literalnychcommandIDs znalezionych w ograniczonym odczycie, a nie fałszywym twierdzeniem, że wszystkie przyciski aktualnegoUI policzono i kliknięto. Priorytet kolejnego odbioru po finalSHA pozostajeW05.


Korekta mianownika po sprawdzeniu callerów: EditCardPopup ma13 quickaction IDs, lecz bieżący DeckBuilder subtree go nie importuje. Pozostawiono je jako UNMOUNTED_SOURCE poza mianownikiem widocznych akcji; nie przywracać ich w celu spełnienia audytu. ShareModal literalne taby to collaborate/share/export/embed (collaborate warunkowe). PresentMode ma next/previous/exit i skróty, a timer jest informacją, nie przyciskiem.

---
doc_kind: MARKET_BENCHMARK
function_id: MW_NOTEBOOK
status: REVIEW
last_updated: 2026-07-31
---

# Notes — benchmark rynku i brakujące zdolności

## 1. Metoda

Porównanie opiera się na oficjalnej dokumentacji produktów. Nie kopiujemy całych produktów. Wybieramy mechanizmy, które wspierają rolę Notes w Consultify: szybki capture, uporządkowanie wiedzy, odnalezienie, współpracę, AI z kontrolą oraz przejście wiedzy do działania.

Źródła:

- [Microsoft OneNote — organizacja notatek](https://support.microsoft.com/en-us/onenote/organize-your-notes);
- [Microsoft OneNote — wyszukiwanie](https://support.microsoft.com/en-US/OneNote/onenote-help-and-learning/search-notes-in-onenote);
- [Microsoft OneNote — Copilot](https://support.microsoft.com/en-us/onenote/welcome-to-copilot-in-onenote);
- [Microsoft OneNote — organizowanie przez Copilot](https://support.microsoft.com/en-us/onenote/organize-your-notes-with-copilot-in-onenote);
- [Notion — linki i backlinki](https://www.notion.com/help/create-links-and-backlinks);
- [Notion — wyszukiwanie](https://www.notion.com/en-gb/help/search);
- [Notion — możliwości AI](https://www.notion.com/help/notion-ai-faqs);
- [Evernote — Tasks](https://help.evernote.com/hc/en-us/articles/1500003792141-Tasks-Overview);
- [Evernote — Web Clipper](https://help.evernote.com/hc/en-us/articles/208314738-Evernote-Web-Clipper-settings).

## 2. Wzorce konkurencji

| Produkt | Mocny wzorzec | Lekcja dla Consultify |
| --- | --- | --- |
| OneNote | notebook/section/page, ciągły autosave, wyszukiwanie w wybranym zakresie, multimedia | hierarchia i zapis mają być niewidoczne, ale niezawodne |
| Notion | bloki, linki do strony/bloku, backlinki respektujące dostęp, search/filter, AI w kontekście workspace | relacje i AI muszą działać blisko treści, z ACL |
| Evernote | silny capture/web clipper, smart filing, task pozostający w kontekście notatki | capture ma być natychmiastowy, a działania zachowywać źródło |
| Obsidian-like knowledge tools | graf i relacje jako sposób odkrywania wiedzy | graf jest wartościowym widokiem pomocniczym, nie głównym workflow MVP |

## 3. Macierz zdolności

| Zdolność | Dojrzali gracze | Consultify AS-IS | Decyzja |
| --- | --- | --- | --- |
| hierarchia wiedzy | dojrzała | notebook/page, lecz stara dokumentacja miesza Folder | P0: ujednolicić |
| autosave/resume | standard bazowy | istnieje, są konflikty i flush | P0: udowodnić E2E/recovery |
| rich block editor | Notion bardzo szeroki | Tiptap + wiele bloków/menu | P0: ograniczyć i ustabilizować katalog |
| web clipper | Evernote bardzo mocny | backend web clip, brak kompletnego capture UX | P1: dopracować preview i source |
| e-mail capture | częste w knowledge tools | endpoint istnieje | P1: dopiąć connector/provenance |
| OCR/image/audio search | OneNote oferuje szeroki zakres | pliki/semantic search, brak potwierdzonego pełnego OCR/audio | P2, nie udawać w MVP |
| exact + scoped search | standard | zapytania/list filters istnieją | P0: jeden search i jawny scope |
| semantic/enterprise search | Notion AI rozwinięty | backend semantic/RAG istnieje | P1: citations + ACL test |
| backlinks | Notion/Obsidian standard | link graph i panel istnieją | P1: uprościć UI i relacje |
| link do bloku | Notion oferuje granularność | niepotwierdzony stabilny public block anchor | P1: dodać stabilne block IDs |
| templates | standard w dużych produktach | brak spójnego katalogu stron | P1: mały katalog, nie marketplace |
| offline | OneNote/Notion desktop wspierają scenariusze ciągłości | brak potwierdzonego offline-first | P2; MVP recovery bez obietnicy offline |
| collaboration/comments | standard zespołowy | presence/collab istnieją, komentarze niejasne | P1: decyzja zakresu współpracy |
| version history/restore | standard zespołowy | komponent i routes istnieją | P0: przywracanie jako nowa wersja |
| tasks in context | Evernote silnie łączy task z notatką | extraction + direct create istnieją | P0: zmienić na proposal/preview/read-back |
| AI rewrite/summarize | OneNote/Notion standard | istnieją quick actions/chat | P0: diff/accept/reject |
| AI organize | OneNote pokazuje preview przed Apply | topic/classify istnieje | P1: batch preview, bez auto-reorganizacji |
| meeting notes | Notion AI rozwija transkrypcję i summary | Meeting jest osobnym modułem | zachować granicę: Notes przyjmuje wynik |
| database-like properties | Notion bardzo szeroki | metadata/tags/status istnieją | nie budować drugiego Airtable w Notes |
| publish/share link | produkty oferują share/publication | brak jasnego kontraktu share link | P1/P2 zależnie od security |
| export/import portability | standard | export/import fragmentarycznie istnieją | P1: jawny katalog formatów i fidelity report |

## 4. Najważniejsze braki, które realnie warto uzupełnić

### P0 — przed stagingiem

1. stabilny save/resume/conflict/recovery;
2. jeden search z zakresem i filtrami autora/projektu/statusu/dat;
3. źródła i cytaty na poziomie strony, a docelowo także bloku;
4. proposal/diff dla każdej mutacji AI;
5. jeden handoff z preview i idempotentnym read-backiem;
6. prosty UX prawego panelu zgodny z osobnym standardem;
7. kontrola ACL obejmująca listę, search, RAG, graph, preview i AI.

### P1 — przewaga produktu

1. stabilne linki do bloku i cytowanie konkretnego fragmentu;
2. mały katalog template'ów: meeting note, research note, decision memo, client note, project log, learning note;
3. web clipper z wyborem `article/simplified/selection/bookmark` albo rozsądnym odpowiednikiem;
4. batch triage z AI preview (`uporządkuj według projektu/tematu/priorytetu`);
5. komentarze lub review requests dla stron projektowych;
6. pełny import/export z raportem utraty formatowania;
7. saved searches/smart views, ale bez rozbudowanej bazy danych.

### P2 — po potwierdzeniu popytu

1. pełny offline i synchronizacja wielourządzeniowa;
2. OCR obrazu i kontrolowane indeksowanie audio/video;
3. publiczne/klienckie share links z expiry i watermarkiem;
4. graph analytics i knowledge health;
5. automatyczne digesty oraz reminders wynikające z treści.

## 5. Przewagi specyficzne dla Consultify

Nie wygramy liczbą formatów edytora. Możemy wygrać tym, że notatka przechodzi bez utraty kontekstu do zarządzania zmianą:

- źródło → wiedza → zweryfikowany wniosek → decyzja/task/inicjatywa/material;
- Teresa zna metodologię konsultingową, nie tylko poprawia tekst;
- output ma właściciela, status, backlink i ślad audytowy;
- prywatność i uprawnienia są sprawdzane w retrieval;
- po realizacji można wrócić do przesłanek, które uruchomiły działanie.

## 6. Funkcje, których nie dokładamy teraz

- dowolnie rozbudowane database views, formulas i automations wewnątrz Notes;
- osobny system zarządzania taskami w notatkach;
- duży marketplace template'ów;
- drugi moduł Meeting ukryty w Notes;
- stale otwarty graf;
- automatyczne publikowanie i automatyczna promocja do pamięci;
- dziesiątki przycisków AI widocznych jednocześnie.

Minimalizm jest tutaj decyzją produktową: Notes ma być najlepszym wejściem i warsztatem wiedzy dla Consultify, nie kopią całego Notion.

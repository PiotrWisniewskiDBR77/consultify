# Wie man IoT-Daten in der Schichtuebergabe nutzt, ohne mehr Reporting zu erzeugen

Zielpersona: Schichtfuehrer / Produktionskoordinator / Werksleitung Operations  
Funnel-Phase: Consideration  
Kernproblem: Uebergabe laeuft noch auf verbaler Erinnerung und statischen Boegen, waehrend IoT Datenstroeme liefert, die niemand in ein weiteres Reporting tippen will  
Hauptversprechen: ein straffes Uebergabemuster: drei Live-Fakten, ein offenes Risiko, eine bestaetigte Folgeaktion, verankert im Maschinenzustand ohne neuen Reporting-Stack

Uebergabe bricht zusammen, wenn sie zum Storytelling-Wettbewerb wird.

IoT kann das reparieren, wenn Sie es als gemeinsame Maschinenwahrheit im Uebergabemoment behandeln, nicht als zweite Papier-Spur.

Ziel sind weniger Ueberraschungen fuer die kommende Schicht, nicht mehr Dashboards zum Pflegen.

## Direkte Antwort

Nutzen Sie IoT in der Uebergabe als **kurzen, wiederholbaren Zustandssnapshot**, gekoppelt an Anlagen und Linien, die die Schicht ohnehin traegt.

Erfassen Sie:

- was die Maschine jetzt tut im Vergleich zur Planerwartung
- was sich seit der letzten stabilen Phase geaendert hat
- was auf Instandhaltung, Qualitaet oder Material mit benanntem Owner wartet

Alles andere bleibt im Sichtbarkeitsmodus, bis es einen Uebergabe-Slot verdient.

## Warum Reporting-Kriechen entsteht

Reporting-Kriechen entsteht, wenn Teams IoT "fair" machen wollen, indem sie alles exportieren.

Fairness in Operations sind keine gleichen Spalten.

Es ist gleiche Klarheit darueber, was die naechste Schicht nicht verpassen darf.

Wird die Uebergabe zum Daten-Dump, fallen Teams auf Stimme zurueck und die IoT-Investition wirkt optional.

## Qualitaetsleiste fuer Uebergabe-Signale

Bevor ein Signal in das Uebergabe-Skript kommt, sollte es bestehen:

- **Stabil genug**: gleicher Messwert ist ueber zwei Fenster konsistent oder durch ein zweites Signal oder einen physikalischen Check bestaetigt
- **Aktionsverbunden**: an ein bekanntes Playbook, Override-Regel oder Eskalationspfad gebunden
- **Schicht-eigen**: jemand auf der Flaeche kann es in wenigen Minuten bestaetigen oder verwerfen

Wenn eine dieser Regeln fehlschlaegt, bleibt es fuer Engineering-Review, nicht fuer den Schichtwechsel.

## Framework: die fuenfminuetige Uebergabe-Karte

Eine Karte pro kritische Linie oder Asset-Gruppe.

1. **Plan versus Realitaet**  
   Eine Zeile: planmaessig, mit bekannter Ursache im Rueckstand, Stillstand mit Grundcode

2. **Maschinenzustandsmodell in Klartext**  
   stabil, degradierend, Stillstand bekannter Fehler, Stillstand unbekannter Fehler

3. **Offene Overrides**  
   was umgangen wurde, wie lange, unter wessen Autoritaet, wann es auslaeuft

4. **Instandhaltungs-Prioritaet**  
   ein Top-Punkt, der das Risiko aendert, wenn er in der naechsten Schicht ignoriert wird

5. **Eskalationsstatus**  
   nichts offen / wartet auf Instandhaltung / wartet auf Engineering / wartet auf Material

Das reicht als Struktur zum Skalieren, ohne jede Woche eine neue Report-Taxonomie zu erfinden.

## Vergleich: reporting-first versus zustands-first

| Reporting-first | Zustands-first |
|---|---|
| lange Decks oder Tabellen | eine Karte pro kritische Einheit |
| streitet ueber Zahlen | einigt sich auf Maschinenzustand |
| vergraetzt Overrides | hebt Overrides und Ablauf hervor |
| ueberrascht die kommende Schicht | uebergibt ein entscheidungsreifes Bild |

## Checkliste: IoT aus der Reporting-Falle halten

- [ ] Uebergabe-Fakten pro Linie auf eine feste Zahl begrenzen
- [ ] Standard "alles exportieren" verbieten; nur Exceptions exportieren
- [ ] Overrides mit Owner, Grund und Ablauf im Workflow-Tool loggen, nicht per Mail
- [ ] Signalqualitaet monatlich mit Bedienern pruefen, nicht nur mit IT
- [ ] Uebergabe-Items an Standards binden: Sicherheit, Qualitaet, Lieferung, Kosten

## Wann es funktioniert und wann nicht

**Funktioniert**, wenn Fuehrung das kurze Format schuetzt und ehrliche Unwissenheit belohnt.

**Scheitert**, wenn jede Funktion ihren Lieblings-KPI auf den Uebergabe-Screen setzt, bis Bediener abschalten.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT ist fuer **Echtzeit-Maschinensichtbarkeit** und **Edge-first Entscheidungsunterstuetzung** gebaut, nicht fuer eine weitere Dashboard-Schicht.

Retrofit-freundliche Konnektivitaet laesst Brownfield-Linien im gleichen Uebergabemuster starten, ohne auf einen vollen MES-Rewrite zu warten.

Schnelle Piloten beweisen ruhigere Uebergaben auf einer Linie, bevor Sie standardisieren.

## Bottom line

Nutzen Sie IoT, damit die Uebergabe **kuerzer und wahrer** wird, nicht voller.

Drei Live-Fakten, ein Risiko, eine Folgeaktion schlagen einen weiteren Nacht-Report, den niemand liest.

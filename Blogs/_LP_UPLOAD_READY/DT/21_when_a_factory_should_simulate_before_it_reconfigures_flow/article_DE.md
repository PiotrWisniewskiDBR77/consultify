# Wann eine Fabrik vor der Umstellung des Materialflusses simulieren sollte

Target persona: COO / Werksleitung / Leitung Industrieengineering  
Funnel stage: Consideration  
Core problem: Fluss-Umbauten werden oft aus Zeichnungen und Meetings freigegeben und danach teuer auf der Flur korrigiert, weil Wechselwirkungen und Variabilitaet nie belastet wurden  
Main promise: Simulation gehoert vor die Flussaenderung, wenn die Aenderung Engpaesse, geteilte Ressourcen oder Nachfragevariabilitaet beruehrt, die statische Plaene nicht abbilden

Sie sollten vor der Umstellung des Flusses simulieren, wenn die Aenderung Grenzen verschieben, Uebergaben aendern oder die Art, wie Arbeit zwischen Stationen staut, veraendern kann.

Ist die Aenderung kosmetisch oder isoliert, kann eine leichtere Pruefung reichen.

Aendert sie das Systemverhalten unter Last, ist Simulation der guenstigste Ort fuer Fehler.

## Direkte Antwort

Zuerst simulieren, wenn mindestens eines zutrifft:

- der neue Fluss teilt Engpass oder Puffer mit anderen Linien
- Besetzung, Schichtlogik oder Batchregeln aendern sich
- Arbeit fuer neuen Takt oder Mix neu verteilt wird
- Wege der Intralogistik oder Supermarkt-Groessen sich aendern
- der Business Case einen bestimmten Durchsatz oder Durchlaufzeit annimmt

Trifft nichts davon zu, kann ein leichter Sanity-Check genuegen; volles Szenario-Testing ist weniger kritisch.

## Warum Zeichnungen fuer Flussaenderungen nicht reichen

CAD und Layout beantworten Geometrie.

Sie beantworten nicht zuverlaessig:

- wo sich Warteschlangen bilden, wenn Variabilitaet zurueckkommt
- wie ein "kleiner" Zug den Systemengpass verschiebt
- ob ein schnellerer lokaler Schritt upstream Hungern erzeugt
- wie Ruesten oder Batch-Bruiche propagieren

Digital Twin ist hier kein 3D-Schaufenster.

Es ist ein Entscheidungssystem, das Flusslogik testet, bevor Beton und Arbeit gebunden werden.

## Einfaches Entscheidungstor

Vor Freigabe des Umbau-Budgets:

| Signal | Zuerst simulieren? |
| --- | --- |
| Beruehrt aktuellen Engpass | Ja |
| Fuegt Zusammenfuehrung hinzu oder entfernt sie | Ja |
| Aendert WIP-Grenzen oder Pufferpolitik | Ja |
| Verschiebt nur innerhalb einer Insel bei stabiler Nachfrage | Vielleicht |
| Reines 5S oder Beschriftung ohne Flusslogik | Meist nein |

## Was "gut genug" heisst fuer Eingaben

Keine Live-MES-Stroeme noetig fuer ersten Nutzen.

Ueblich sind:

1. glaubwuerdige Prozessfolge mit realistischen Zykluszeit-Spannen
2. Ruest- und Ausfall-Annahmen als Spannen, nicht als Einzelpunkte
3. Nachfrage- oder Mix-Szenarien fuer Spitze und Flaute
4. Besetzungsregeln, die der realen Linie entsprechen

Illustrative: Teams ohne Spannen und nur mit Mittel-Nachfrage genehmigen oft Fluesse, die in der ersten starken Woche brechen.

## Was im Twin verglichen wird

Mindestens drei Szenario-Familien:

- Baseline aktueller Fluss
- Vorschlag unter erwarteter Nachfrage
- Vorschlag unter Stress-Nachfrage oder schlimmstem Mix

Viertes bei Politik: Hybrid mit alter Pufferpolitik bei neuem Layout.

## Wann Simulation keinen trivialen Block bilden soll

Simulation ist Risiko-Werkzeug, keine Moralpflicht.

Klein, in Stunden rueckgaengig, keine geteilten Grenzen: dokumentierter Pilot auf ruhiger Schicht kann schneller sein als Modell.

Der Fehler ist, diese Ausnahme fuer Aenderungen zu nutzen, die Systemverhalten wirklich verschieben.

## Was DBR77 Digital Twin ergaenzt

DBR77 Digital Twin ist fuer Szenario-Vergleich und operatives Entriskieren gebaut, nicht fuer visuelles Theater.

Bei Fluss-Umbau helfen Varianten, Annahmen zu stressen und Ops und Engineering auf "gut" zu einigen, bevor die Flur zum Testfeld wird.

## Fazit

Vor Fluss-Umbau simulieren, wenn Grenzen oder Warte-Verhalten im System sich verschieben koennen.

Nur Optik oder lokale Ordnung: leichtere Governance reicht.

Verhalten unter Variabilitaet: im Twin sollten die teuren Debatten laufen.

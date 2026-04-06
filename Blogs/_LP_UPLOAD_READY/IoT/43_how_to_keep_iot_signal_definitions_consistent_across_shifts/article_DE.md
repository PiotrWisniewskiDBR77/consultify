# Wie Sie IoT-Signaldefinitionen ueber Schichten hinweg konsistent halten

Zielpersona: Engineering-Lead / CI-Lead / Schicht-Operations-Sponsor  
Funnel-Phase: Consideration  
Kernproblem: jede Schicht benennt Zustaende anders, rundet Zeitstempel anders und interpretiert Schwellen im Gespraech, dadurch wird Uebergabe Meinung statt Evidenz  
Hauptversprechen: ein gemeinsames Signalwoerterbuch plus Uebergaberegeln, die stabil bleiben wenn Menschen, Vendor oder Screens wechseln

Schichtuebergabe bricht zuerst wenn Definitionen driften.

IoT repariert Vokabular nicht von allein.

Es zeigt, ob das Werk sich einig ist, was ein Signal bedeutet.

## Direkte Antwort

Halten Sie IoT-Signaldefinitionen schichtuebergreifend konsistent mit einem **einen Werk-Woerterbuch**, **eingefrorenen Uebergabefeldern** und einer **monatlichen Stichproben-Audit**, in der Bediener denselben Tag in eigenen Worten erklaeren.

Wenn zwei Schichten unterschiedliche Worte fuer denselben Maschinenzustand nutzen, haben Sie nicht nur ein State-Model-Problem.

Sie haben einen Kommunikationsfehler, der Maintenance-Prioritaet und Eskalation vergiftet.

## Framework: der Definitions-Stack

1. **Semantik-Schicht**  
   Klartext-Bedeutung: running, faulted, starved, blocked, changeover, warmup, hold fuer Qualitaet

2. **Technik-Schicht**  
   Tag-Name, Einheit, Abtasttakt und Edge versus Cloud als Source of Truth

3. **Operations-Schicht**  
   was Vorgesetzte bei Eskalation erwarten, was Planner fuer Work-Order-Routing brauchen, was Qualitaet fuer Traceability braucht

4. **Training-Schicht**  
   kurzes Glossar in Shopfloor-Sprache, gekoppelt an echte Bediener-Screens

5. **Governance-Schicht**  
   wer Umbenennungen freigibt, wie Versionshistorie gefuehrt wird, wie Overrides zu Definitionen stehen

## Checkliste: minimale Woerterbuch-Felder pro kritischem Signal

- [ ] Business-Name in der Uebergabe (nicht nur PLC-Kurzform)
- [ ] numerische Einheit und Rundungsregel
- [ ] erwarteter Bereich in Normalproduktion und im Idle
- [ ] bekannte False-Positive-Ursachen und wie sie geloggt werden
- [ ] Link zur Maintenance-Prioritaetsklasse wenn das Signal Arbeit ausloesen kann
- [ ] Retention-Klasse fuer Evidenz und Audit-Erwartungen

## Vergleich: Stammes-Namensgebung versus Werk-Woerterbuch

| Stammes-Namensgebung | Werk-Woerterbuch |
|---|---|
| "das Vibrations-Ding" | benanntes Signal mit Owner |
| verschiedene Excel-Tabs pro Schicht | eine freigegebene Liste |
| Schwellen-Aenderungen im Chat | geloggtes Change Control |
| Training nur durch Shadowing | Glossar plus Sign-off |

## Signalqualitaet und Standards

Definitionen sind die Eingangstuer zur Signalqualitaet.

Schwache Definitionen erzeugen noisy Alerts, wiederholte Overrides und schwache Evidenz in Kunden- oder Regulatorik-Reviews.

Binden Sie Definitionsarbeit an Standards die Ihr Werk schon besitzt: Safety-Interlocks, Qualitaetsholds, Maintenance-Klassen.

## Was das fuer DBR77 IoT bedeutet

DBR77 IoT ist **kein weiteres Dashboard**.

Es ist **Echtzeit-Maschinensichtbarkeit**, **retrofit-freundliche Konnektivitaet**, **schnelle Piloten** und **Edge-first Entscheidungsunterstuetzung**, die schichtuebergreifend lesbar bleibt wenn Definitionen diszipliniert sind.

## Bottom line

Konsistenz ist kein Dokumentations-Hobby.

So bleiben Uebergabe, Eskalation und Evidenz aligned wenn die Nachtschicht den Chat der Fruehschicht nicht liest.
